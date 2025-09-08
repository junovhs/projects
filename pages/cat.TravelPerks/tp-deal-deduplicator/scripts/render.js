// render.js — UI

function highlightText(text){
  let r = String(text||"").replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  r = r.replace(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/g,'<span class="expiry-date">$1</span>');
  r = r.replace(/(\$\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/g,'<span class="price-value">$1</span>');
  r = r.replace(/(\d+\s*%|\d+\s*percent)/gi,'<span class="percentage-value">$1</span>');
  return r;
}
const highlightTextJSON = highlightText;

function filterDeals(deals, searchText){
  if (!searchText) return deals;
  const terms = searchText.toLowerCase().split(/\s+/).filter(Boolean);
  return deals.filter(m => terms.every(t => (m.hqDeal.vendor + " " + m.hqDeal.text).toLowerCase().includes(t)));
}
function filterNonMatched(deals, searchText){
  if (!searchText) return deals;
  const terms = searchText.toLowerCase().split(/\s+/).filter(Boolean);
  return deals.filter(d => terms.every(t => (d.vendor + " " + d.text).toLowerCase().includes(t)));
}

function renderMatchedDeals(){
  const container = document.getElementById("matchedDealsContainer");
  const fb = document.getElementById("matchedFilter").value.trim();
  const list = filterDeals(matchedDeals, fb);
  document.getElementById("matchedCount").textContent = matchedDeals.length;
  container.innerHTML = list.length ? "" : "<div class='no-matches'>No matched deals found.</div>";

  list.forEach(match => {
    const res = match.jsonDeal ? compareDealScore(match.hqDeal, match.jsonDeal) : {score: match.score||0, reasons: match.reasons||[], flags:{}, numbersEqual:false, dateFlag:false, dateDiffDays:null, commonKW:[]};
    const row = document.createElement("div");
    row.className = res.dateFlag ? "matched-deal possible-date-change" : "matched-deal";

    // Score badge
    const scoreDiv = document.createElement("div");
    scoreDiv.className = "match-score";
    scoreDiv.textContent = match.isStrictMatch ? "✓" : match.score;
    if (match.isStrictMatch){
      scoreDiv.style.backgroundColor = "#2ecc71"; scoreDiv.style.color = "#083";
      scoreDiv.title = "Perfect Match";
    }

    // Left (HQ) with triage chips
    const left = document.createElement("div"); left.className = "deal-info";

    // Chips: Vendor / Numbers / Date
    const triage = document.createElement("div"); triage.className = "triage-row";
    const chipV = document.createElement("span"); chipV.className = "chip ok"; chipV.textContent = "Vendor ✓";
    const chipN = document.createElement("span");
    if (res.numbersEqual) { chipN.className="chip ok"; chipN.textContent="Numbers ✓"; }
    else if (res.flags && res.flags.numericOneSided) { chipN.className="chip warn"; chipN.textContent="Numbers –"; }
    else { chipN.className="chip bad"; chipN.textContent="Numbers ×"; }
    const chipD = document.createElement("span");
    if (!res.dateFlag) { chipD.className="chip ok"; chipD.textContent="Date ✓"; }
    else if (res.dateDiffDays != null && res.dateDiffDays <= 5) { chipD.className="chip warn"; chipD.textContent="Date ±5"; }
    else { chipD.className="chip bad"; chipD.textContent="Date ×"; }
    triage.appendChild(chipV); triage.appendChild(chipN); triage.appendChild(chipD);

    // Flags
    if (match.isStrictMatch){
      const s = document.createElement("span"); s.className="date-flag"; s.style.background="#d5f5e3"; s.style.color="#1e7d4f"; s.textContent="PERFECT MATCH"; left.appendChild(s);
    } else if (res.numbersEqual && res.commonKW && res.commonKW.length){
      const s = document.createElement("span"); s.className="date-flag"; s.textContent="SYNERGY"; left.appendChild(s);
    }
    if (res.dateFlag){
      const s = document.createElement("span"); s.className="date-flag"; s.textContent = (res.dateDiffDays<=5) ? "POSSIBLE DATE CHANGE" : "DATE MISMATCH"; left.appendChild(s);
    }
    if (res.flags && res.flags.exclusiveFlag){
      const s = document.createElement("span"); s.className="exclusive-flag"; s.textContent="Exclusive listed on JSON"; left.appendChild(s);
    }

    left.innerHTML += `<span class="deal-vendor">${match.hqDeal.vendor}:</span> `;
    left.appendChild(triage);

    // HQ text with date re-render to show raw+display
    let rendered = match.hqDeal.text.replace(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/g, m => {
      return `<span class="expiry-date">${m}</span>`;
    });
    rendered = rendered.replace(/(\$\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/g,'<span class="price-value">$1</span>');
    rendered = rendered.replace(/(\d+\s*%|\d+\s*percent)/gi,'<span class="percentage-value">$1</span>');
    left.innerHTML += rendered;

    // Right JSON block
    const right = document.createElement("div"); right.className = "json-match";
    if (match.jsonDeal){
      right.innerHTML = `<strong>Vendor:</strong> ${match.jsonDeal.vendor}<br>
      <strong>Expiry:</strong> <span class="expiry-date">${match.jsonDeal.expiryDate ? formatDate(new Date(match.jsonDeal.expiryDate)) : "N/A"}</span><br>
      <strong>Title:</strong> ${highlightTextJSON(match.jsonDeal.title)}<br>
      <strong>Listing:</strong> ${highlightTextJSON(match.jsonDeal.shopListing)}`;
    } else {
      right.textContent = "No JSON deal chosen for this row.";
    }

    // Tooltip with reasons
    const tooltip = document.createElement("div"); tooltip.className="tooltip"; tooltip.innerHTML="👁️";
    const tip = document.createElement("span"); tip.className="tooltiptext"; tip.innerHTML = (match.reasons||res.reasons||[]).join("<br>");
    tooltip.appendChild(tip);

    // Move to non-matched
    const btn = document.createElement("button"); btn.textContent="👎"; btn.title="Move to non‑matched";
    btn.addEventListener("click", ()=>{
      const i = matchedDeals.indexOf(match);
      if (i>=0){ matchedDeals.splice(i,1); nonMatchedDeals.push(match.hqDeal); renderAll(); }
    });

    [scoreDiv,left,right,tooltip,btn].forEach(el => row.appendChild(el));
    container.appendChild(row);
  });
}

function renderNonMatchedDeals(){
  const container = document.getElementById("nonMatchedDealsContainer");
  const fb = document.getElementById("nonMatchedFilter").value.trim();
  const list = filterNonMatched(nonMatchedDeals, fb);
  document.getElementById("nonMatchedCount").textContent = nonMatchedDeals.length;
  container.innerHTML = list.length ? "" : "<div class='no-matches'>No non‑matched deals.</div>";

  list.forEach(d => {
    const row = document.createElement("div");
    row.className = "non-matched-deal";
    const score = document.createElement("div"); score.className="match-score"; score.textContent = "–";
    const left = document.createElement("div"); left.className="deal-info";
    left.innerHTML = `<span class="deal-vendor">${d.vendor}:</span> ${highlightText(d.text)}`;

    const right = document.createElement("div"); right.className="json-match";
    const close = findClosestMatch(d, _lastJSONDeals, _lastThreshold);
    right.innerHTML = close ? `<div><strong>Closest JSON (below threshold):</strong></div>
      <div><strong>Vendor:</strong> ${close.jsonDeal.vendor}</div>
      <div><strong>Title:</strong> ${highlightTextJSON(close.jsonDeal.title)}</div>
      <div><strong>Listing:</strong> ${highlightTextJSON(close.jsonDeal.shopListing)}</div>
      <div><strong>Why:</strong> ${close.reasons.join("<br>")}</div>` : "No decent candidate below the threshold.";

    const tooltip = document.createElement("div"); tooltip.className="tooltip"; tooltip.innerHTML="👁️";
    const tip = document.createElement("span"); tip.className="tooltiptext"; tip.textContent = d.original||d.text;
    tooltip.appendChild(tip);

    const btn = document.createElement("button"); btn.textContent="➕"; btn.title="Promote to matched (will not lock to JSON)";
    btn.addEventListener("click", ()=>{
      matchedDeals.push({ hqDeal: d, jsonDeal: close?close.jsonDeal:{vendor:d.vendor,title:"",shopListing:"",expiryDate:null}, score: close?close.score:0, reasons: close?close.reasons:[], jsonIndex: -1, isStrictMatch:false });
      const idx = nonMatchedDeals.indexOf(d);
      if (idx>=0) nonMatchedDeals.splice(idx,1);
      renderAll();
    });

    [score,left,right,tooltip,btn].forEach(el => row.appendChild(el));
    container.appendChild(row);
  });
}

function copyNonMatchedToClipboard(){
  const groups = {};
  nonMatchedDeals.forEach(d => {
    groups[d.vendor] = groups[d.vendor] || [];
    groups[d.vendor].push(d.original || `d\t${d.text}`);
  });
  let out = "";
  for (const v in groups){
    out += `v\t${v}:\n` + groups[v].map(line => line + "\n").join("");
  }
  navigator.clipboard.writeText(out).then(
    ()=>alert("Copied!"),
    ()=>alert("Copy failed")
  );
}

function renderAll(){
  renderMatchedDeals();
  renderNonMatchedDeals();
}

// expose UI fns used by app.js
window.renderAll = renderAll;
window.renderMatchedDeals = renderMatchedDeals;
window.renderNonMatchedDeals = renderNonMatchedDeals;
window.copyNonMatchedToClipboard = copyNonMatchedToClipboard;
