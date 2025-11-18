const { useState, useEffect, useRef } = React;

function DealProcessor() {
  // Workflow State
  const [rawInput, setRawInput] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [view, setView] = useState("input"); // 'input' or 'work'
  
  // Data State
  const [deals, setDeals] = useState([]);
  const [copySuccess, setCopySuccess] = useState({});

  // --- Configuration for the External AI ---
  const getSystemPrompt = (dealsText) => {
    return `You are a travel marketing expert helper. I will provide a list of raw travel deals. 
    
INPUT FORMAT LEGEND:
"v [Name]" = Vendor Name
"d [Text]" = Standard Deal
"ed [Text]" = Exclusive Deal

YOUR TASK:
Parse the text, group deals by vendor, and rewrite the content into a strict JSON format.

CONTENT RULES:
1. Headlines: 8-12 words. Catchy but professional. No "Sail Away", "Unlock", "Score", "Dream", "Escape".
2. Descriptions: 10-16 words. Straightforward.
3. EXCLUSIVES: If input is "ed", Headline MUST start with "EXCLUSIVE: ".
4. FORMATTING: Replace "PPG" -> "Free Gratuities", "OBC" -> "Onboard Credit", "PP" -> "Per Person".
5. DATES: Extract start and end dates from the text. 
   - If a date is a range (11/18-11/25), split into startDate and endDate.
   - If "Ends 12/31", set endDate. 
   - Format dates as "MM/DD/YYYY" (e.g., 05/21/2025).
   - REMOVE the date text from the generated description.
   - If date is "ongoing", leave dates null.

OUTPUT JSON STRUCTURE (Return ONLY this JSON, no markdown, no conversational text):
[
  {
    "vendor": "Vendor Name",
    "deals": [
      {
        "headline": "The generated headline",
        "description": "The generated description ending with a period.",
        "startDate": "MM/DD/YYYY" or null,
        "endDate": "MM/DD/YYYY" or null,
        "isExclusive": boolean
      }
    ]
  }
]

HERE IS THE RAW DATA TO PROCESS:
${dealsText}`;
  };

  // --- Step 1: Generate Prompt ---
  const copyPromptToClipboard = () => {
    if (!rawInput.trim()) {
      alert("Please paste some deals first.");
      return;
    }
    const prompt = getSystemPrompt(rawInput);
    navigator.clipboard.writeText(prompt).then(() => {
      alert("PROMPT COPIED! \n\n1. Go to ChatGPT/Claude. \n2. Paste this prompt. \n3. Copy their JSON reply.");
    });
  };

  // --- Step 2: Import JSON ---
  const handleJsonParse = () => {
    try {
      // Clean up potential Markdown code blocks from AI (```json ... ```)
      let cleanJson = jsonInput.trim();
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```(json)?|```$/g, "");
      }
      
      const parsedData = JSON.parse(cleanJson);
      
      // Add local state fields (checked) to the data
      const initializedData = parsedData.map(v => ({
        ...v,
        deals: v.deals.map(d => ({ ...d, checked: false }))
      }));

      setDeals(initializedData);
      setView("work"); // Switch to the working view
      window.scrollTo(0,0);
    } catch (e) {
      console.error(e);
      alert("Error parsing JSON. Make sure you pasted the exact code block from the AI.");
    }
  };

  // --- Step 3: Work Actions ---
  
  const handleCopy = (text, key, isCompletionAction = false, vendorIdx = null, dealIdx = null) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess({ [key]: true });
      
      // If this was the description (completion action), mark as done
      if (isCompletionAction && vendorIdx !== null && dealIdx !== null) {
        toggleDeal(vendorIdx, dealIdx, true);
      }

      setTimeout(() => {
        setCopySuccess(prev => {
          const newState = { ...prev };
          delete newState[key];
          return newState;
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
    if(confirm("Clear all data and start over?")) {
      setRawInput("");
      setJsonInput("");
      setDeals([]);
      setView("input");
    }
  };

  // --- Render Views ---

  const renderInputView = () => (
    <div className="input-view fade-in">
      <div className="split-container">
        
        {/* LEFT: Prompt Generator */}
        <div className="step-box">
          <div className="step-header">
            <div className="step-number">1</div>
            <h3>Prepare Prompt</h3>
          </div>
          <p className="help-text">Paste your raw deal text here (v Vendor, d Deal...)</p>
          <textarea 
            className="raw-input" 
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="v Vendor Name:&#10;d Deal text here...&#10;ed Exclusive deal text..."
          />
          <button className="action-button primary" onClick={copyPromptToClipboard}>
            Copy Prompt for AI
          </button>
        </div>

        {/* RIGHT: JSON Importer */}
        <div className="step-box">
          <div className="step-header">
            <div className="step-number">2</div>
            <h3>Import AI Reply</h3>
          </div>
          <p className="help-text">Paste the JSON response from the AI here.</p>
          <textarea 
            className="json-input" 
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='[{"vendor": "...", "deals": [...]}]'
          />
          <button 
            className="action-button success" 
            onClick={handleJsonParse}
            disabled={!jsonInput}
          >
            Process & Start Working
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
          {deals.reduce((acc, v) => acc + v.deals.length, 0)} Deals Completed
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
                    
                    {/* Checkbox */}
                    <div 
                      className="check-circle" 
                      onClick={() => toggleDeal(vIdx, dIdx)}
                    >
                      {isDone && "✓"}
                    </div>

                    {/* Content */}
                    <div className="deal-content">
                      
                      {/* Headline Row */}
                      <div className="content-line">
                        <span 
                          className={`clickable-text headline ${deal.isExclusive ? 'exclusive' : ''}`}
                          onClick={() => handleCopy(deal.headline, `h-${vIdx}-${dIdx}`)}
                          title="Click to Copy Headline"
                        >
                          {deal.headline}
                        </span>
                        {copySuccess[`h-${vIdx}-${dIdx}`] && <span className="copied-badge">Copied!</span>}
                      </div>

                      {/* Description Row (Completes deal on click) */}
                      <div className="content-line">
                        <span 
                          className="clickable-text description"
                          onClick={() => handleCopy(deal.description, `d-${vIdx}-${dIdx}`, true, vIdx, dIdx)}
                          title="Click to Copy Description & Mark Complete"
                        >
                          {deal.description}
                        </span>
                        {copySuccess[`d-${vIdx}-${dIdx}`] && <span className="copied-badge">Copied!</span>}
                      </div>

                      {/* Dates Row */}
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
      <h1 className="app-title">Deal Checklist 2.0</h1>
      {view === 'input' ? renderInputView() : renderWorkView()}
    </div>
  );
}

ReactDOM.render(<DealProcessor />, document.getElementById("root"));