const { useState, useEffect } = React;

// --- UI Components ---

const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`notification ${type}`}>
      <span>{message}</span>
      <button onClick={onClose}>×</button>
    </div>
  );
};

const Modal = ({ title, children, onConfirm, onCancel, confirmText = "Confirm" }) => (
  <div className="modal-overlay">
    <div className="modal">
      <h3>{title}</h3>
      <div className="modal-content">{children}</div>
      <div className="modal-buttons">
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
        {onConfirm && <button className="btn-primary" onClick={onConfirm}>{confirmText}</button>}
      </div>
    </div>
  </div>
);

// --- Logic: The "Vendor-Locked" Parser ---

const parseRawToGroups = (text) => {
  if (!text) return [];
  const lines = text.split("\n");
  let groups = [];
  let currentVendor = null;

  lines.forEach(line => {
    const parts = line.split(/\s(.+)/);
    if (parts.length < 2) return;
    const [type, content] = parts; // 'v', 'd', 'ed'
    const cleanContent = content.trim();

    if (type === "v") {
      // Start new vendor group
      currentVendor = {
        name: cleanContent,
        deals: []
      };
      groups.push(currentVendor);
    } else if ((type === "d" || type === "ed") && currentVendor) {
      // Add deal to current vendor
      currentVendor.deals.push({
        originalText: cleanContent,
        isExclusive: type === 'ed'
      });
    }
  });
  return groups;
};

const cleanAndParseJSON = (input) => {
  const start = input.indexOf('[');
  const end = input.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error("No JSON array found.");
  
  let clean = input.substring(start, end + 1);
  clean = clean.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}'); // Fix trailing commas
  return JSON.parse(clean);
};

// --- Main App ---

function DealProcessor() {
  // Data State
  const [view, setView] = useState("input"); 
  const [rawInput, setRawInput] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [finalGroups, setFinalGroups] = useState([]); // The merged, validated data
  
  // UI State
  const [notify, setNotify] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [copySuccess, setCopySuccess] = useState({});
  const [showReset, setShowReset] = useState(false);

  const showToast = (msg, type = 'info') => setNotify({ msg, type });

  // --- Step 1: Generate Vendor-Grouped Prompt ---
  const generatePrompt = () => {
    const groups = parseRawToGroups(rawInput);
    
    if (groups.length === 0) {
      showToast("No vendors found. Use 'v Name' format.", "error");
      return;
    }

    let promptText = `You are a travel marketing assistant.
    
INSTRUCTIONS:
1. I will provide a list of Vendors and their Deals.
2. You must return a JSON structure that MIRRORS this structure exactly.
3. Do NOT include the Vendor Name in the headlines or descriptions.
4. Headlines: 8-12 words. No "Unlock/Score/Dream".
5. Descriptions: 10-16 words.
6. Dates: Extract startDate/endDate (MM/DD/YYYY).
7. Exclusives: If input says (EXCLUSIVE), start headline with "EXCLUSIVE: ".

INPUT DATA:
`;

    groups.forEach((g, i) => {
      promptText += `\nVENDOR ${i+1}: ${g.name}\n`;
      g.deals.forEach((d, j) => {
        promptText += `   Deal ${j+1}: ${d.isExclusive ? '(EXCLUSIVE) ' : ''}${d.originalText}\n`;
      });
    });

    promptText += `
OUTPUT JSON FORMAT:
[
  {
    "vendorIndex": 1,
    "deals": [
      { "headline": "...", "description": "...", "startDate": "...", "endDate": "..." },
      { "headline": "...", "description": "...", "startDate": "...", "endDate": "..." }
    ]
  }
  ... (Repeat for all vendors)
]`;

    navigator.clipboard.writeText(promptText).then(() => {
      showToast(`Prompt for ${groups.length} Vendors copied!`, "success");
    });
  };

  // --- Step 2: The Audit (Validation & Merge) ---
  const validateAndImport = () => {
    try {
      // 1. Parse Inputs
      const rawGroups = parseRawToGroups(rawInput);
      const aiGroups = cleanAndParseJSON(jsonInput);

      // 2. Validate Vendor Count
      if (rawGroups.length !== aiGroups.length) {
        setValidationError({
          title: "Vendor Count Mismatch",
          msg: `You provided ${rawGroups.length} vendors, but AI returned ${aiGroups.length}. Cannot proceed.`
        });
        return;
      }

      // 3. Validate Deal Counts Per Vendor
      const errors = [];
      const mergedData = rawGroups.map((rawGroup, idx) => {
        const aiGroup = aiGroups[idx]; // We trust the order: AI Group 1 is Raw Group 1
        
        // Check deal count for this specific vendor
        if (rawGroup.deals.length !== aiGroup.deals.length) {
          errors.push(`Vendor "${rawGroup.name}": Sent ${rawGroup.deals.length} deals, got ${aiGroup.deals.length}.`);
        }

        // Merge: Use RAW Vendor Name (Safety) + AI Deal Content
        const mergedDeals = rawGroup.deals.map((rawDeal, dealIdx) => {
          const aiDeal = aiGroup.deals[dealIdx] || {}; // Fallback if length mismatch (caught above)
          return {
            headline: aiDeal.headline || "MISSING HEADLINE",
            description: aiDeal.description || "MISSING DESCRIPTION",
            startDate: aiDeal.startDate,
            endDate: aiDeal.endDate,
            originalText: rawDeal.originalText,
            isExclusive: rawDeal.isExclusive, // Use RAW truth
            checked: false
          };
        });

        return {
          name: rawGroup.name,
          deals: mergedDeals
        };
      });

      if (errors.length > 0) {
        setValidationError({
          title: "Deal Count Mismatch",
          msg: "The AI dropped or added deals. Please fix the JSON or Regenerate.",
          details: errors
        });
        return;
      }

      // 4. Success!
      setFinalGroups(mergedData);
      setView("work");
      window.scrollTo(0,0);

    } catch (e) {
      console.error(e);
      showToast("JSON Syntax Error: " + e.message, "error");
    }
  };

  // --- Step 3: Work Actions ---
  const handleCopy = (text, key, isComplete, vIdx, dIdx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(prev => ({ ...prev, [key]: true }));
      if (isComplete) toggleCheck(vIdx, dIdx, true);
      setTimeout(() => setCopySuccess(prev => {
        const n = {...prev}; delete n[key]; return n;
      }), 1500);
    });
  };

  const toggleCheck = (vIdx, dIdx, forceState = null) => {
    setFinalGroups(prev => {
      const newGroups = [...prev];
      const deal = newGroups[vIdx].deals[dIdx];
      const nextState = forceState !== null ? forceState : !deal.checked;
      deal.checked = nextState;
      if (nextState && window.triggerSpecialConfetti) window.triggerSpecialConfetti();
      return newGroups;
    });
  };

  const reset = () => {
    setRawInput("");
    setJsonInput("");
    setFinalGroups([]);
    setView("input");
    setShowReset(false);
  };

  // --- Views ---

  const renderInput = () => (
    <div className="view-input fade-in">
      <div className="step-card">
        <div className="step-header">
          <div className="badge">1</div>
          <h3>Raw Text</h3>
        </div>
        <textarea 
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          placeholder="v Vendor Name&#10;d Deal text..." 
        />
        <button className="btn-primary full-width" onClick={generatePrompt}>
          Copy Prompt
        </button>
      </div>

      <div className="step-card">
        <div className="step-header">
          <div className="badge">2</div>
          <h3>AI Response</h3>
        </div>
        <textarea 
          value={jsonInput}
          onChange={e => setJsonInput(e.target.value)}
          placeholder="Paste JSON here..." 
        />
        <button 
          className="btn-success full-width" 
          onClick={validateAndImport}
          disabled={!jsonInput}
        >
          Verify & Start
        </button>
      </div>
    </div>
  );

  const renderWork = () => {
    const totalDeals = finalGroups.reduce((acc, g) => acc + g.deals.length, 0);
    const doneDeals = finalGroups.reduce((acc, g) => acc + g.deals.filter(d => d.checked).length, 0);

    return (
      <div className="view-work fade-in">
        <div className="toolbar">
          <button className="btn-text" onClick={() => setShowReset(true)}>← Start Over</button>
          <div className="stats">
            <span className="stat-pill">Vendors: {finalGroups.length}</span>
            <span className="stat-pill active">Deals: {doneDeals} / {totalDeals}</span>
          </div>
        </div>

        {finalGroups.map((group, vIdx) => (
          <div key={vIdx} className="vendor-block">
            <h2 className="vendor-title">{group.name}</h2>
            <div className="deal-list">
              {group.deals.map((deal, dIdx) => (
                <div key={dIdx} className={`deal-row ${deal.checked ? 'checked' : ''}`}>
                  <div className="checkbox-col">
                    <div 
                      className={`circle-check ${deal.checked ? 'active' : ''}`} 
                      onClick={() => toggleCheck(vIdx, dIdx)}
                    >
                      {deal.checked && "✓"}
                    </div>
                  </div>
                  <div className="content-col">
                    {/* Headline */}
                    <div className="row-line">
                      <span 
                        className={`copy-text headline ${deal.isExclusive ? 'exclusive' : ''}`}
                        onClick={() => handleCopy(deal.headline, `h${vIdx}${dIdx}`)}
                      >
                        {deal.headline}
                      </span>
                      {copySuccess[`h${vIdx}${dIdx}`] && <span className="toast-inline">Copied</span>}
                    </div>
                    {/* Description */}
                    <div className="row-line">
                      <span 
                        className="copy-text description"
                        onClick={() => handleCopy(deal.description, `d${vIdx}${dIdx}`, true, vIdx, dIdx)}
                      >
                        {deal.description}
                      </span>
                      {copySuccess[`d${vIdx}${dIdx}`] && <span className="toast-inline">Copied</span>}
                    </div>
                    {/* Context */}
                    <div className="original-context">
                      <span className="label">ORIGINAL:</span> {deal.originalText}
                    </div>
                    {/* Dates */}
                    <div className="dates-wrapper">
                      {deal.startDate && (
                        <span className="pill start" onClick={() => handleCopy(deal.startDate, `sd${vIdx}${dIdx}`)}>
                          Starts: {deal.startDate}
                        </span>
                      )}
                      {deal.endDate && (
                        <span className="pill end" onClick={() => handleCopy(deal.endDate, `ed${vIdx}${dIdx}`)}>
                          Ends: {deal.endDate}
                        </span>
                      )}
                      {(copySuccess[`sd${vIdx}${dIdx}`] || copySuccess[`ed${vIdx}${dIdx}`]) && 
                         <span className="toast-inline">Copied</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container">
      <h1 className="app-title">Deal Checklist 3.0</h1>
      
      {notify && <Notification message={notify.msg} type={notify.type} onClose={() => setNotify(null)} />}
      
      {showReset && (
        <Modal title="Start Over?" onConfirm={reset} onCancel={() => setShowReset(false)} confirmText="Yes, Reset">
          <p>All current progress will be lost.</p>
        </Modal>
      )}

      {validationError && (
        <Modal 
          title={validationError.title} 
          onConfirm={() => setValidationError(null)} 
          confirmText="OK, I'll Fix It"
        >
          <div className="error-list">
            <p>{validationError.msg}</p>
            {validationError.details && (
              <ul>
                {validationError.details.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            )}
          </div>
        </Modal>
      )}

      {view === 'input' ? renderInput() : renderWork()}
    </div>
  );
}

ReactDOM.render(<DealProcessor />, document.getElementById("root"));