// render.js — UI rendering for matches & non-matches
// Expects window.performMatching(...) (from match.js) and the parsers (from utils.js)

// ---------------- UI helpers ----------------
function $(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function formatISODate(iso) {
  if (!iso) return "N/A";
  // iso is "YYYY-MM-DD"
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function makeBadge(text, variant = "neutral", title = "") {
  const span = document.createElement("span");
  span.className = `tp-badge tp-${variant}`;
  if (title) span.title = title;
  span.textContent = text;
  return span;
}

function makeReasonEye(reasons = []) {
  const btn = document.createElement("span");
  btn.className = "tp-eye";
  btn.textContent = "👁️";
  if (reasons && reasons.length) {
    btn.title = "Why:\n" + reasons.join("\n");
  } else {
    btn.title = "No details.";
  }
  return btn;
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function row(label, value) {
  const div = document.createElement("div");
  div.className = "tp-row";
  const l = document.createElement("div");
  l.className = "tp-row-label";
  l.textContent = label;
  const v = document.createElement("div");
  v.className = "tp-row-value";
  v.textContent = value;
  div.appendChild(l);
  div.appendChild(v);
  return div;
}

function dealHeader(hqDeal, isPerfect) {
  const wrap = document.createElement("div");
  wrap.className = "tp-deal-header";
  const strong = document.createElement("strong");
  strong.textContent = (isPerfect ? "PERFECT MATCH " : "") + (hqDeal.vendor ? `${hqDeal.vendor}:` : "");
  wrap.appendChild(strong);
  return wrap;
}

function checkmark(ok) { return ok ? "✓" : "×"; }

// ---------------- Item renderers ----------------
function renderMatchedItem({ hqDeal, jsonDeal, score, reasons, flags, perfect }) {
  const card = document.createElement("div");
  card.className = "tp-card tp-card--match";

  // Header
  const hdr = dealHeader(hqDeal, perfect);
  // Triaging chips: Vendor / Numbers / Date
  const chips = document.createElement("div");
  chips.className = "tp-chips";
  chips.appendChild(makeBadge(`Vendor ${checkmark(true)}`, "good"));
  chips.appendChild(makeBadge(`Numbers ${checkmark(!flags.numberFlag)}`, !flags.numberFlag ? "good" : "bad",
    flags.numberFlag ? "Numbers conflicted earlier" : "Numbers look consistent"));
  chips.appendChild(makeBadge(`Date ${checkmark(!flags.dateFlag)}`, !flags.dateFlag ? "good" : "warn",
    flags.dateFlag ? "Some date(s) differ beyond tolerance" : "Dates look consistent"));

  hdr.appendChild(chips);
  card.appendChild(hdr);

  // HQ body
  const left = document.createElement("div");
  left.className = "tp-col tp-col--left";
  left.appendChild(row("HQ Title", hqDeal.title));
  left.appendChild(row("Start", formatISODate(hqDeal.startDate)));
  left.appendChild(row("End", formatISODate(hqDeal.expiryDate)));
  if (hqDeal.ongoing) left.appendChild(makeBadge("Ongoing", "info"));

  // JSON body
  const right = document.createElement("div");
  right.className = "tp-col tp-col--right";
  right.appendChild(row("Vendor", jsonDeal.vendor || "N/A"));
  right.appendChild(row("Expiry", formatISODate(jsonDeal.expiryDate)));
  right.appendChild(row("Title", jsonDeal.title || "—"));
  right.appendChild(row("Listing", jsonDeal.shopListing || "—"));
  if (jsonDeal.startDate) right.appendChild(row("Start", formatISODate(jsonDeal.startDate)));
  if (jsonDeal.ongoing) right.appendChild(makeBadge("Ongoing", "info"));

  const cols = document.createElement("div");
  cols.className = "tp-cols";
  cols.appendChild(left);
  cols.appendChild(right);

  card.appendChild(cols);

  // Footer: score + eye
  const foot = document.createElement("div");
  foot.className = "tp-foot";
  foot.appendChild(makeBadge(`Score ${perfect ? "999" : String(score)}`, perfect ? "good" : "neutral"));
  foot.appendChild(makeReasonEye(reasons));
  card.appendChild(foot);

  return card;
}

function renderNonMatchedItem({ hqDeal, closestJson, score, reasons, flags }) {
  const card = document.createElement("div");
  card.className = "tp-card tp-card--nomatch";

  // Header & chips (use flags if present)
  const hdr = dealHeader(hqDeal, false);
  const chips = document.createElement("div");
  chips.className = "tp-chips";
  chips.appendChild(makeBadge(`Vendor ${checkmark(!!flags?.vendor)}`, flags?.vendor ? "good" : "bad"));
  chips.appendChild(makeBadge(`Numbers ${checkmark(!flags?.numberFlag)}`, !flags?.numberFlag ? "neutral" : "bad"));
  chips.appendChild(makeBadge(`Date ${checkmark(!flags?.dateFlag)}`, !flags?.dateFlag ? "neutral" : "warn"));
  hdr.appendChild(chips);
  card.appendChild(hdr);

  // HQ side
  const left = document.createElement("div");
  left.className = "tp-col tp-col--left";
  left.appendChild(row("HQ Title", hqDeal.title));
  left.appendChild(row("Start", formatISODate(hqDeal.startDate)));
  left.appendChild(row("End", formatISODate(hqDeal.expiryDate)));
  if (hqDeal.ongoing) left.appendChild(makeBadge("Ongoing", "info"));

  const cols = document.createElement("div");
  cols.className = "tp-cols";
  cols.appendChild(left);

  // Closest JSON candidate (if any)
  const right = document.createElement("div");
  right.className = "tp-col tp-col--right";
  if (closestJson) {
    right.appendChild(row("Closest Vendor", closestJson.vendor || "N/A"));
    right.appendChild(row("Expiry", formatISODate(closestJson.expiryDate)));
    if (closestJson.startDate) right.appendChild(row("Start", formatISODate(closestJson.startDate)));
    if (closestJson.ongoing) right.appendChild(makeBadge("Ongoing", "info"));
    right.appendChild(row("Title", closestJson.title || "—"));
    right.appendChild(row("Listing", closestJson.shopListing || "—"));
  } else {
    right.appendChild(row("Closest JSON", "None with matching vendor"));
  }
  cols.appendChild(right);

  card.appendChild(cols);

  // reasons / score
  const foot = document.createElement("div");
  foot.className = "tp-foot";
  foot.appendChild(makeBadge(`Closest score ${String(score)}`, "neutral"));
  foot.appendChild(makeReasonEye(reasons));
  card.appendChild(foot);

  return card;
}

// ---------------- Bulk renderers ----------------
function renderMatchedList(container, items) {
  clearNode(container);
  if (!items || !items.length) {
    const p = document.createElement("p");
    p.textContent = "No matched deals.";
    container.appendChild(p);
    return;
  }
  for (const it of items) container.appendChild(renderMatchedItem(it));
}

function renderNonMatchedList(container, items) {
  clearNode(container);
  if (!items || !items.length) {
    const p = document.createElement("p");
    p.textContent = "No non-matched deals.";
    container.appendChild(p);
    return;
  }
  for (const it of items) container.appendChild(renderNonMatchedItem(it));
}

// ---------------- Results & wiring ----------------
function renderCounts(matchedCnt, nonMatchedCnt) {
  const mc = $("matchedCount", "matched-count", "matched_count");
  const nc = $("nonMatchedCount", "nonmatched-count", "non_matched_count");
  if (mc) mc.textContent = String(matchedCnt);
  if (nc) nc.textContent = String(nonMatchedCnt);
}

function renderResults(result) {
  const matchedList = $("matched", "matched-list", "matched_container");
  const nonMatchedList = $("nonMatched", "nonmatched-list", "non_matched_container");

  if (matchedList) renderMatchedList(matchedList, result.matched || []);
  if (nonMatchedList) renderNonMatchedList(nonMatchedList, result.nonMatched || []);
  renderCounts((result.matched || []).length, (result.nonMatched || []).length);
}

// ---------------- Copy non-matched helper (optional) ----------------
function copyNonMatchedToClipboard(result) {
  const arr = (result?.nonMatched || []).map(x => {
    const v = x.hqDeal?.vendor ? `${x.hqDeal.vendor}: ` : "";
    return `${v}${x.hqDeal?.title || ""}`;
  });
  const text = arr.join("\n");
  if (!text) return;
  navigator.clipboard.writeText(text).catch(() => {});
}

// ---------------- Expose ----------------
window.renderResults = renderResults;
window.renderMatchedList = renderMatchedList;
window.renderNonMatchedList = renderNonMatchedList;
window.copyNonMatchedToClipboard = copyNonMatchedToClipboard;

/* ---------------- Tiny CSS recommendations (optional)
.tp-card { border: 1px solid #ddd; border-radius: 12px; padding: 12px; margin: 10px 0; }
.tp-card--match { background: #f9fffb; }
.tp-card--nomatch { background: #fff9f9; }
.tp-deal-header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; }
.tp-chips { display:flex; gap:6px; flex-wrap:wrap; }
.tp-badge { display:inline-block; font-size:12px; padding:2px 8px; border-radius:999px; border:1px solid transparent; }
.tp-good { background:#e8f7ee; border-color:#bfe8cf; }
.tp-warn { background:#fff7e6; border-color:#ffe1a5; }
.tp-bad  { background:#ffefef; border-color:#ffd0d0; }
.tp-info { background:#eef4ff; border-color:#d6e2ff; }
.tp-cols { display:grid; grid-template-columns: 1fr 1fr; gap:14px; }
.tp-row { display:grid; grid-template-columns: 100px 1fr; gap:8px; font-size:14px; }
.tp-row-label { color:#666; }
.tp-eye { margin-left:auto; cursor:help; }
.tp-foot { display:flex; align-items:center; gap:8px; margin-top:8px; }
@media (max-width: 720px) {
  .tp-cols { grid-template-columns: 1fr; }
}
*/ 
