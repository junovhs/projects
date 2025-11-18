const { useState, useEffect } = React;

// --- Helper: Assign IDs to raw text ---
const parseRawTextToObjects = (text) => {
  if (!text) return [];
  const lines = text.split("\n");
  let structuredData = [];
  let currentVendor = "";
  let globalIdCounter = 1;

  lines.forEach(line => {
    const parts = line.split(/\s(.+)/);
    if (parts.length < 2) return;
    const [type, content] = parts; // type is 'v', 'd', or 'ed'

    if (type === "v") {
      currentVendor = content.trim();
    } else if ((type === "d" || type === "ed") && currentVendor) {
      structuredData.push({
        id: globalIdCounter++,
        vendor: currentVendor,
        originalText: content.trim(),
        type: type
      });
    }
  });
  return structuredData;
};

// --- Helper: Robust JSON Cleaner ---
// Fixes trailing commas and strips AI chat text
const cleanAndParseJSON = (input) => {
  // 1. Extract content between first '[' and last ']'
  const firstBracket = input.indexOf('[');
  const lastBracket = input.lastIndexOf(']');
  
  if (firstBracket === -1 || lastBracket === -1) {
    throw new Error("No JSON array found. Make sure the AI response contains [...]");
  }
  
  let jsonString = input.substring(firstBracket, lastBracket + 1);
  
  // 2. Fix multiple arrays pasted together (e.g. "][")
  jsonString = jsonString.replace(/\]\s*\[/g, ",");

  // 3. Remove trailing commas before closing braces/brackets (common AI error)
  // Matches ,} -> } and ,] -> ]
  jsonString = jsonString.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

  return JSON.parse(jsonString);
};

function DealProcessor() {
  // --- State ---
  const [view, setView] = useState("input"); // 'input' | 'work'
  const [rawInput, setRawInput] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  
  // We no longer store parsedRawData in state to avoid sync issues.
  // We derive it on the fly when needed.
  
  const [missingIds, setMissingIds] = useState([]); 
  const [deals, setDeals] = useState([]);
  const [copySuccess, setCopySuccess] = useState({});

  // --- Step 1: Generate Prompt ---
  const generatePrompt = () => {
    if (!rawInput.trim()) {
      alert("Please paste some deals first.");
      return;
    }

    const structured = parseRawTextToObjects(rawInput);
    
    // Build the string for the AI
    const dataString = structured.map(item => 
      `[ID:${item.id}] ${item.type === 'ed' ? '(EXCLUSIVE) ' : ''}Vendor: ${item.vendor} | Deal: ${item.originalText}`
    ).join("\n");

    const systemPrompt = `You are a travel marketing expert.
    
INPUT DATA:
I have provided a list of travel deals. Each line starts with an [ID]. 
You MUST retain this ID in your output JSON.

YOUR TASK:
1. Read each line.
2. Rewrite the headline (8-12 words, catchy, no "Unlock/Score/Dream").
3. Rewrite the description (10-16 words, straightforward).
4. Extract Start/End dates (MM/DD/YYYY).
5. Format specific terms: "PPG"->"Free Gratuities", "OBC"->"Onboard Credit", "PP"->"Per Person".
6. If text says "Exclusive", headline must start with "EXCLUSIVE: ".

OUTPUT JSON FORMAT (Strict List of Objects):
[
  {
    "id": 123,
    "vendor": "Vendor Name",
    "headline": "Written headline...",
    "description": "Written description...",
    "startDate": "MM/DD/YYYY" or null,
    "endDate": "MM/DD/YYYY" or null,
    "isExclusive": boolean
  }
]

DATA TO PROCESS:
${dataString}`;

    navigator.clipboard.writeText(systemPrompt).then(() => {
      alert(`PROMPT COPIED for ${structured.length} deals! \n\nPaste into AI, then copy the JSON reply back here.`);
    });
  };

  // --- Step 1.5: Handle Missing Deals ---
  const generateFixPrompt = () => {
    const currentRawData = parseRawTextToObjects(rawInput);
    const missingItems = currentRawData.filter(item => missingIds.includes(item.id));
    
    const dataString = missingItems.map(item => 
      `[ID:${item.id}] ${item.type === 'ed' ? '(EXCLUSIVE) ' : ''}Vendor: ${item.vendor} | Deal: ${item.originalText}`
    ).join("\n");

    const fixPrompt = `You missed some items in the previous batch. Please process ONLY these specific items and output them in the same JSON format as before (including the ID).

MISSING ITEMS:
${dataString}`;

    navigator.clipboard.writeText(fixPrompt).then(() => {
      alert("FIX PROMPT COPIED!\n\n1. Paste into AI chat.\n2. Copy the new JSON.\n3. Paste it BELOW the existing JSON in the box.");
    });
  };

  // --- Step 2: Import & Verify ---
  const handleProcessJson = () => {
    try {
      // 1. Parse the RAW text again to ensure we match exactly what is on screen currently
      const currentRawData = parseRawTextToObjects(rawInput);
      
      if (currentRawData.length === 0) {
        alert("Your raw deals text box is empty. Please paste your deals first.");
        return;
      }

      // 2. Clean and Parse JSON
      let aiData;
      try {
        aiData = cleanAndParseJSON(jsonInput);
      } catch (jsonError) {
        console.error("JSON Parse Error:", jsonError);
        alert(`Failed to read AI Code:\n${jsonError.message}\n\nCheck the console for details.`);
        return;
      }
      
      // 3. Validate IDs
      const receivedIds = aiData.map(d => d.id);
      const allRawIds = currentRawData.map(d => d.id);
      
      // Find which IDs from Raw Data are NOT in AI Data
      const missing = allRawIds.filter(id => !receivedIds.includes(id));
      
      // Update missing state
      setMissingIds(missing);

      if (missing.length > 0) {
        // Return early to show the UI warning, don't load the view yet
        return; 
      }

      // 4. Merge Data (AI Data + Original Text)
      const groupedDeals = [];
      const uniqueVendors = [...new Set(currentRawData.map(d => d.vendor))];

      uniqueVendors.forEach(vendorName => {
        const vendorDeals = aiData
          .filter(d => d.vendor === vendorName)
          .map(d => {
            const originalData = currentRawData.find(r => r.id === d.id);
            return {
              ...d,
              originalText: originalData ? originalData.originalText : "Original text not found",
              checked: false
            };
          });
        
        if (vendorDeals.length > 0) {
          groupedDeals.push({
            vendor: vendorName,
            deals: vendorDeals
          });
        }
      });

      setDeals(groupedDeals);
      setView("work");
      window.scrollTo(0,0);

    } catch (e) {
      console.error("General Error:", e);
      alert(`An error occurred: ${e.message}`);
    }
  };

  // --- Step 3: Work Actions ---
  const handleCopy = (text, key, isCompletionAction = false, vendorIdx = null, dealIdx = null) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess({ [key]: true });
      if (isCompletionAction && vendorIdx !== null && dealIdx !== null) {
        toggleDeal(vendorIdx, dealIdx, true);
      }
      setTimeout(() => {
         setCopySuccess(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
         });
      }, 1500);
    });
  };

  const toggleDeal = (vendorIndex, dealIndex, forceState = null) => {
    setDeals(prev => {
      const newDeals = [...prev];
      const deal = newDeals[vendorIndex].deals[dealIndex];
      const newState = forceState !== null ? forceState : !deal.checked;
      deal.checked = newState;
      
      if (newState === true && typeof window.triggerSpecialConfetti === 'function') {
        window.triggerSpecialConfetti();
      }
      return newDeals;
    });
  };

  const resetApp = () => {
    if(confirm("Start over with new text?")) {
      setRawInput("");
      setJsonInput("");
      setMissingIds([]);
      setDeals([]);
      setView("input");
    }
  };

  // --- Views ---

  const renderInputView = () => (
    <div className="input-view fade-in">
      <div className="split-container">
        {/* Step 1 */}
        <div className="step-box">
          <div className="step-header">
            <div className="step-number">1</div>
            <h3>Get AI Prompt</h3>
          </div>
          <p className="help-text">Paste your raw deal text here.</p>
          <textarea 
            className="raw-input" 
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              setMissingIds([]); // Clear warning if they edit text
            }}
            placeholder="v Vendor Name&#10;d Deal Text..."
          />
          <button className="action-button primary" onClick={generatePrompt}>
            Step 1: Copy Prompt
          </button>
        </div>

        {/* Step 2 */}
        <div className="step-box">
          <div className="step-header">
            <div className="step-number">2</div>
            <h3>Import Reply</h3>
          </div>
          
          <p className="help-text">Paste the JSON response here.</p>
          
          {missingIds.length > 0 && (
            <div className="missing-alert">
              <strong>⚠️ {missingIds.length} Deals Missing!</strong>
              <p>The AI missed some IDs.</p>
              <button className="action-button warning-btn" onClick={generateFixPrompt}>
                Copy "Fix Missing" Prompt
              </button>
              <div className="small-instruction">Paste the fix reply below the existing JSON.</div>
            </div>
          )}

          <textarea 
            className={`json-input ${missingIds.length > 0 ? 'input-warning' : ''}`}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste JSON here..."
          />
          <button 
            className="action-button success" 
            onClick={handleProcessJson}
            disabled={!jsonInput}
          >
            {missingIds.length > 0 ? "Retry Verification" : "Step 2: Verify & Start"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderWorkView = () => (
    <div className="work-view fade-in">
      <div className="toolbar">
        <button className="back-button" onClick={resetApp}>← Start Over</button>
        <div className="progress-indicator">
          {deals.reduce((acc, v) => acc + v.deals.filter(d => d.checked).length, 0)} / 
          {deals.reduce((acc, v) => acc + v.deals.length, 0)} Completed
        </div>
      </div>

      <div className="deals-list">
        {deals.map((vendor, vIdx) => (
          <div key={vIdx} className="vendor-card">
            <h2 className="vendor-name">{vendor.vendor}</h2>
            <div className="vendor-deals">
              {vendor.deals.map((deal, dIdx) => {
                const isDone = deal.checked;
                return (
                  <div key={dIdx} className={`deal-row ${isDone ? 'deal-done' : ''}`}>
                    <div className="check-circle" onClick={() => toggleDeal(vIdx, dIdx)}>
                      {isDone && "✓"}
                    </div>
                    <div className="deal-content">
                      
                      {/* Headline */}
                      <div className="content-line">
                        <span 
                          className={`clickable-text headline ${deal.isExclusive ? 'exclusive' : ''}`}
                          onClick={() => handleCopy(deal.headline, `h-${vIdx}-${dIdx}`)}
                        >
                          {deal.headline}
                        </span>
                        {copySuccess[`h-${vIdx}-${dIdx}`] && <span className="copied-badge">Copied!</span>}
                      </div>

                      {/* Description */}
                      <div className="content-line">
                        <span 
                          className="clickable-text description"
                          onClick={() => handleCopy(deal.description, `d-${vIdx}-${dIdx}`, true, vIdx, dIdx)}
                        >
                          {deal.description}
                        </span>
                        {copySuccess[`d-${vIdx}-${dIdx}`] && <span className="copied-badge">Copied!</span>}
                      </div>

                      {/* Original Text */}
                      <div className="original-text-box">
                        <span className="orig-label">Original:</span> {deal.originalText}
                      </div>

                      {/* Dates */}
                      <div className="dates-row">
                        {deal.startDate && (
                          <span 
                            className="date-pill start-pill"
                            onClick={() => handleCopy(deal.startDate, `sd-${vIdx}-${dIdx}`)}
                          >
                            Starts: {deal.startDate}
                          </span>
                        )}
                        {deal.endDate && (
                          <span 
                            className="date-pill end-pill"
                            onClick={() => handleCopy(deal.endDate, `ed-${vIdx}-${dIdx}`)}
                          >
                            Ends: {deal.endDate}
                          </span>
                        )}
                        {(!deal.startDate && !deal.endDate) && (
                           <span className="date-pill ongoing-pill">Ongoing / Check Dates</span>
                        )}
                        {(copySuccess[`sd-${vIdx}-${dIdx}`] || copySuccess[`ed-${vIdx}-${dIdx}`]) && 
                          <span className="copied-badge-small">Copied!</span>
                        }
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="container">
      <h1 className="app-title">Deal Checklist 2.2</h1>
      {view === 'input' ? renderInputView() : renderWorkView()}
    </div>
  );
}

ReactDOM.render(<DealProcessor />, document.getElementById("root"));