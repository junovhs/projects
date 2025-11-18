const { useState, useEffect, useRef } = React;

// --- UI Components ---

const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`notification ${type}`}>
      <span>{message}</span>
      <button onClick={onClose}>×</button>
    </div>
  );
};

const Modal = ({ title, message, onConfirm, onCancel }) => (
  <div className="modal-overlay">
    <div className="modal">
      <h3>{title}</h3>
      <p>{message}</p>
      <div className="modal-buttons">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm}>Confirm</button>
      </div>
    </div>
  </div>
);

// --- Logic Helpers ---

const extractRawDeals = (text) => {
  if (!text) return [];
  const lines = text.split("\n");
  let deals = [];
  let currentVendor = "";

  lines.forEach(line => {
    const parts = line.split(/\s(.+)/);
    if (parts.length < 2) return;
    const [type, content] = parts; // 'v', 'd', 'ed'

    if (type === "v") {
      currentVendor = content.trim();
    } else if ((type === "d" || type === "ed") && currentVendor) {
      deals.push({
        vendor: currentVendor,
        originalText: content.trim(),
        isExclusive: type === 'ed'
      });
    }
  });
  return deals;
};

const safeJsonParse = (input) => {
  // Find the outer array brackets ignoring all AI chatter
  const start = input.indexOf('[');
  const end = input.lastIndexOf(']');
  
  if (start === -1 || end === -1) throw new Error("No JSON array [...] found in text.");
  
  let clean = input.substring(start, end + 1);
  // Fix common AI trailing commas: ",]" -> "]" and ",}" -> "}"
  clean = clean.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
  
  return JSON.parse(clean);
};

// --- Main Component ---

function DealProcessor() {
  // State
  const [view, setView] = useState("input"); 
  const [rawInput, setRawInput] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [deals, setDeals] = useState([]);
  const [copySuccess, setCopySuccess] = useState({});
  
  // UI State
  const [notify, setNotify] = useState(null); // { msg, type }
  const [showResetModal, setShowResetModal] = useState(false);

  // Actions
  const showToast = (msg, type = 'info') => setNotify({ msg, type });

  const generatePrompt = () => {
    const rawDeals = extractRawDeals(rawInput);
    if (rawDeals.length === 0) {
      showToast("Paste some deals first!", "error");
      return;
    }

    // Simple Prompt - relies on order, not IDs
    const prompt = `You are a travel marketing helper.
    
INPUT:
${rawDeals.map((d, i) => `[${i+1}] ${d.isExclusive ? '(EXCLUSIVE)' : ''} ${d.vendor}: ${d.originalText}`).join('\n')}

TASK:
Rewrite these ${rawDeals.length} deals. 
1. MAINTAIN EXACT ORDER. Result 1 must match Input 1.
2. Headlines: 8-12 words, catchy. No "Unlock/Score/Dream".
3. Descriptions: 10-16 words.
4. Dates: Extract Start/End (MM/DD/YYYY).
5. Replace: "PPG"->"Free Gratuities", "OBC"->"Onboard Credit", "PP"->"Per Person".
6. Exclusives: Headline must start with "EXCLUSIVE: ".

OUTPUT JSON ONLY:
[
  {
    "headline": "...",
    "description": "...",
    "startDate": "MM/DD/YYYY" or null,
    "endDate": "MM/DD/YYYY" or null
  }
]`;

    navigator.clipboard.writeText(prompt).then(() => {
      showToast("Prompt Copied! Paste to AI.", "success");
    }).catch(() => showToast("Clipboard failed. Copy manually.", "error"));
  };

  const processImport = () => {
    try {
      const aiResult = safeJsonParse(jsonInput);
      const rawDeals = extractRawDeals(rawInput);

      // Merge Logic: Map by Index
      // If lists are different lengths, we just map what we can
      const merged = aiResult.map((aiDeal, index) => {
        const original = rawDeals[index] || { vendor: "Unknown", originalText: "No matching original text found." };
        return {
          ...aiDeal,
          vendor: original.vendor,
          originalText: original.originalText,
          isExclusive: original.isExclusive, // Trust raw input for exclusive flag
          checked: false
        };
      });

      // Group by Vendor for display
      const grouped = {};
      merged.forEach(deal => {
        if (!grouped[deal.vendor]) grouped[deal.vendor] = [];
        grouped[deal.vendor].push(deal);
      });

      // Convert to array
      const finalDeals = Object.keys(grouped).map(v => ({
        vendor: v,
        items: grouped[v]
      }));

      setDeals(finalDeals);
      setView("work");
      window.scrollTo(0,0);
    } catch (e) {
      console.error(e);
      showToast(`JSON Error: ${e.message}`, "error");
    }
  };

  const handleCopy = (text, key, isCompleteAction, vIdx, dIdx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(prev => ({ ...prev, [key]: true }));
      
      if (isCompleteAction) {
        toggleCheck(vIdx, dIdx, true);
      }
      
      setTimeout(() => {
        setCopySuccess(prev => {
          const n = { ...prev };
          delete n[key];
          return n;
        });
      }, 1500);
    });
  };

  const toggleCheck = (vIdx, dIdx, forceState = null) => {
    setDeals(prev => {
      const next = [...prev];
      const item = next[vIdx].items[dIdx];
      const newState = forceState !== null ? forceState : !item.checked;
      
      item.checked = newState;
      
      if (newState && window.triggerSpecialConfetti) {
        window.triggerSpecialConfetti();
      }
      return next;
    });
  };

  const resetApp = () => {
    setRawInput("");
    setJsonInput("");
    setDeals([]);
    setView("input");
    setShowResetModal(false);
  };

  // --- Renders ---

  return (
    <div className="container">
      {notify && <Notification message={notify.msg} type={notify.type} onClose={() => setNotify(null)} />}
      
      {showResetModal && (
        <Modal 
          title="Start Over?" 
          message="This will clear all your current work." 
          onConfirm={resetApp} 
          onCancel={() => setShowResetModal(false)} 
        />
      )}

      <h1 className="app-title">Deal Checklist</h1>

      {view === 'input' ? (
        <div className="view-input fade-in">
          <div className="step-card">
            <div className="step-header">
              <div className="badge">1</div>
              <h3>Raw Text</h3>
            </div>
            <textarea 
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              placeholder="v Vendor&#10;d Deal..."
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
              onClick={processImport}
              disabled={!jsonInput}
            >
              Start Working
            </button>
          </div>
        </div>
      ) : (
        <div className="view-work fade-in">
          <div className="toolbar">
            <button className="btn-text" onClick={() => setShowResetModal(true)}>← Start Over</button>
            <div className="counter">
              {deals.reduce((acc, v) => acc + v.items.filter(i => i.checked).length, 0)} / 
              {deals.reduce((acc, v) => acc + v.items.length, 0)} Done
            </div>
          </div>

          {deals.map((vendor, vIdx) => (
            <div key={vIdx} className="vendor-block">
              <h2 className="vendor-title">{vendor.vendor}</h2>
              <div className="deal-list">
                {vendor.items.map((deal, dIdx) => (
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
                          className={`copy-text headline ${deal.headline && deal.headline.startsWith("EXCLUSIVE") ? 'exclusive' : ''}`}
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

                      {/* Original Text Context */}
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
      )}
    </div>
  );
}

ReactDOM.render(<DealProcessor />, document.getElementById("root"));