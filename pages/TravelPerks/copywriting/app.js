const { useState, useEffect } = React;

// Helper to assign IDs to raw text before sending to AI
const parseRawTextToObjects = (text) => {
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
        type: type // 'd' or 'ed'
      });
    }
  });
  return structuredData;
};

function DealProcessor() {
  // --- State ---
  const [view, setView] = useState("input"); // 'input' | 'work'
  const [rawInput, setRawInput] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [parsedRawData, setParsedRawData] = useState([]); // Stores the ID mapping
  const [missingIds, setMissingIds] = useState([]); // IDs not found in JSON
  
  const [deals, setDeals] = useState([]);
  const [copySuccess, setCopySuccess] = useState({});

  // --- Step 1: Generate Prompt ---
  const generatePrompt = () => {
    if (!rawInput.trim()) {
      alert("Please paste some deals first.");
      return;
    }

    // 1. Parse raw text to assign IDs
    const structured = parseRawTextToObjects(rawInput);
    setParsedRawData(structured); // Save this state to compare later

    // 2. Build the string for the AI
    // We format it as: [ID] Vendor | Text
    const dataString = structured.map(item => 
      `[ID:${item.id}] ${item.type === 'ed' ? '(EXCLUSIVE) ' : ''}Vendor: ${item.vendor} | Deal: ${item.originalText}`
    ).join("\n");

    const systemPrompt = `You are a travel marketing expert.
    
INPUT DATA:
I have provided a list of travel deals. Each line starts with an [ID]. 
You MUST retain this ID in your output JSON.

YOUR TASK:
1.  Read each line.
2.  Rewrite the headline (8-12 words, catchy, no "Unlock/Score/Dream").
3.  Rewrite the description (10-16 words, straightforward).
4.  Extract Start/End dates (MM/DD/YYYY).
5.  Format specific terms: "PPG"->"Free Gratuities", "OBC"->"Onboard Credit", "PP"->"Per Person".
6.  If text says "Exclusive", headline must start with "EXCLUSIVE: ".

OUTPUT JSON FORMAT (Strict List of Objects):
[
  {
    "id": 123,  <-- CRITICAL: COPY THE EXACT ID FROM INPUT
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
    const missingItems = parsedRawData.filter(item => missingIds.includes(item.id));
    
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
      // 1. Sanitize Input (handle multiple code blocks if user pasted fix below original)
      let rawJsonStr = jsonInput;
      // Remove markdown code block syntax if present
      rawJsonStr = rawJsonStr.replace(/```json/g, "").replace(/```/g, "");
      // If user pasted two arrays like [...] [...] we need to join them
      rawJsonStr = rawJsonStr.replace(/\]\s*\[/g, ","); 
      
      const aiData = JSON.parse(rawJsonStr);
      
      // 2. Validate IDs
      const receivedIds = aiData.map(d => d.id);
      const allRawIds = parsedRawData.map(d => d.id);
      
      const missing = allRawIds.filter(id => !receivedIds.includes(id));
      setMissingIds(missing);

      if (missing.length > 0) {
        // Don't proceed, show alert UI
        return; 
      }

      // 3. Merge Data (AI Data + Original Text)
      // We transform the flat list of deals back into Vendor Groups for the UI
      const groupedDeals = [];
      
      // Get unique vendors from the processed data to maintain order
      const vendors = [...new Set(parsedRawData.map(d => d.vendor))];

      vendors.forEach(vendorName => {
        // Find all AI processed deals for this vendor
        const vendorDeals = aiData
          .filter(d => d.vendor === vendorName)
          .map(d => {
            // Attach the original text from our raw parsing
            const originalData = parsedRawData.find(r => r.id === d.id);
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
      console.error(e);
      alert("JSON Error. If you pasted multiple blocks, ensure they form valid JSON or just paste them one after another.");
    }
  };

  // --- Step 3: Work Actions (Copy/Confetti) ---
  const handleCopy = (text, key, isCompletionAction = false, vendorIdx = null, dealIdx = null) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess({ [key]: true });
      if (isCompletionAction && vendorIdx !== null && dealIdx !== null) {
        toggleDeal(vendorIdx, dealIdx, true);
      }
      setTimeout(() => setCopySuccess({}), 1500);
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
    if(confirm("Start over?")) {
      setRawInput("");
      setJsonInput("");
      setParsedRawData([]);
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
          <textarea 
            className="raw-input" 
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              setParsedRawData([]); // Reset parsed state on edit
              setMissingIds([]);
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
          
          {missingIds.length > 0 && (
            <div className="missing-alert">
              <strong>⚠️ {missingIds.length} Deals Missing!</strong>
              <p>The AI skipped some items.</p>
              <button className="action-button warning-btn" onClick={generateFixPrompt}>
                Copy "Fix Missing" Prompt
              </button>
              <div className="small-instruction">Paste the AI's NEW reply to the bottom of the box below.</div>
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

                      {/* Original Text Display */}
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
      <h1 className="app-title">Deal Checklist 2.1</h1>
      {view === 'input' ? renderInputView() : renderWorkView()}
    </div>
  );
}

ReactDOM.render(<DealProcessor />, document.getElementById("root"));