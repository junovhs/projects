// render.js — styled output with strict/score states + highlighting + counts
// Works with: utils.js (parsers/extractors), match.js (performMatching)

/* -------------------- DOM helpers -------------------- */
function $(...ids) { for (const id of ids) { const el = document.getElementById(id); if (el) return el; } return null; }
function clearNode(node) { if (!node) return; while (node.firstChild) node.removeChild(node.firstChild); }
function formatISODate(iso) {
  if (!iso) return "N/A";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "N/A";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class" || k === "className") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) e.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}

/* -------------------- Small UI primitives -------------------- */
function chip(text, state = "ok") { return el("span", { class: `chip ${state}` }, text); }
function tooltipEye(lines = []) {
  const wrap = el("span", { class: "tooltip" }, "👁️");
  wrap.appendChild(el("span", { class: "tooltiptext" }, lines.join("\n")));
  return wrap;
}
function countInto(id, n) { const c = $(id); if (c) c.textContent = String(n); }

/* -------------------- Highlighting shared tokens -------------------- */
/* We highlight values that overlap between HQ and JSON:
   - Money: <span class="price-value">$150</span>
   - Percents: <span class="percentage-value">25%</span>
   (Leave generic numbers alone to avoid noisy over-highlighting.) */
function intersectNums(a = [], b = []) {
  const A = new Set((a || []).map(Number));
  const out = [];
  for (const x of (b || [])) { const n = Number(x); if (A.has(n)) out.push(n); }
  // dedupe & sort desc so longer numbers replace first
  return Array.from(new Set(out)).sort((x, y) => String(y).length - String(x).length);
}

function highlightMoney(html, values) {
  let out = html;
  for (const v of values) {
    const num = String(v).replace(/[^\d.]/g, "");
    if (!num) continue;
    // matches $150, $ 150, 150 (when preceded by $ optionally), with optional decimals/commas
    const re = new RegExp(`(\\$\\s*${num.replace(/\./g, "\\.")}(?:\\b|(?=\\D)))`, "gi");
    out = out.replace(re, '<span class="price-value">$1</span>');
  }
  return out;
}

function highlightPercents(html, values) {
  let out = html;
  for (const v of values) {
    const num = String(v).replace(/[^\d.]/g, "");
    if (!num) continue;
    const re = new RegExp(`(${num.replace(/\./g, "\\.")}\\s*%)`, "gi");
    out = out.replace(re, '<span class="percentage-value">$1</span>');
  }
  return out;
}

function highlightText(raw, moneyHits = [], percentHits = []) {
  let html = esc(raw);
  html = highlightMoney(html, moneyHits);
  html = highlightPercents(html, percentHits);
  return html;
}

/* -------------------- Row builder -------------------- */
function row(label, valueHtml) {
  const r = el("div", { class: "tp-row" });
  r.appendChild(el("div", { class: "tp-row-label" }, label));
  const v = el("div", { class: "tp-row-value" });
  if (typeof valueHtml === "string") v.innerHTML = valueHtml; else v.appendChild(valueHtml || document.createTextNode("—"));
  r.appendChild(v);
  return r;
}

/* -------------------- Card renderers -------------------- */
function renderMatchedItem(item) {
  const { hqDeal: hq = {}, jsonDeal: js = {}, score = 0, reasons = [], flags = {}, perfect = false } = item || {};
  // Overlap sets for highlighting
  const moneyHits = intersectNums(hq.moneyValues, js.moneyValues);
  const pctHits   = intersectNums(hq.percents,     js.percents);

  // Container
  const card = el("div", { class: "matched-deal" });

  // Left “score/rail” area
  const scoreBox = el("div", { class: "match-score" }, perfect ? "✓" : String(score));
  card.appendChild(scoreBox);

  // Middle: vendor/title + chips
  const info = el("div", { class: "deal-info" });
  const header = el("div");
  header.appendChild(el("span", { class: "deal-vendor" }, (hq.vendor ? `${hq.vendor}: ` : "")));
  // Title with highlights
  header.appendChild(el("span", { html: highlightText(hq.title || js.title || "", moneyHits, pctHits) }));
  info.appendChild(header);

  // Chips: PERFECT + triage
  const chips = el("div");
  if (perfect) chips.appendChild(chip("PERFECT MATCH", "ok"));
  chips.appendChild(chip(`Vendor ${flags.vendor ? "✓" : "×"}`, flags.vendor ? "ok" : "bad"));
  chips.appendChild(chip(`Numbers ${flags.numberFlag ? "×" : "–"}`, flags.numberFlag ? "bad" : "warn"));
  chips.appendChild(chip(`Date ${flags.dateFlag ? "×" : "✓"}`, flags.dateFlag ? "warn" : "ok"));
  info.appendChild(chips);

  card.appendChild(info);

  // Right: JSON side preview (with highlighting)
  const right = el("div", { class: "json-match" });
  right.appendChild(row("Vendor:", esc(js.vendor || "N/A")));
  right.appendChild(row("Expiry:", esc(formatISODate(js.expiryDate))));
  if (js.startDate) right.appendChild(row("Start:", esc(formatISODate(js.startDate))));
  right.appendChild(row("Title:", highlightText(js.title || "—", moneyHits, pctHits)));
  right.appendChild(row("Listing:", highlightText(js.shopListing || "—", moneyHits, pctHits)));

  // Reasons eye
  const actions = el("div");
  actions.appendChild(tooltipEye(reasons.length ? reasons : ["No details"]));
  right.appendChild(actions);

  card.appendChild(right);
  return card;
}

function renderNonMatchedItem(item) {
  const { hqDeal: hq = {}, closestJson: cj = null, score = 0, reasons = [], flags = {} } = item || {};

  const moneyHits = intersectNums(hq.moneyValues, cj?.moneyValues || []);
  const pctHits   = intersectNums(hq.percents,     cj?.percents || []);

  const card = el("div", { class: "non-matched-deal" });

  // Left score (closest score, if any)
  card.appendChild(el("div", { class: "match-score" }, score > 0 ? String(score) : "•"));

  // Middle: HQ details
  const info = el("div", { class: "deal-info" });
  const header = el("div");
  header.appendChild(el("span", { class: "deal-vendor" }, (hq.vendor ? `${hq.vendor}: ` : "")));
  header.appendChild(el("span", { html: highlightText(hq.title || "", moneyHits, pctHits) }));
  info.appendChild(header);

  const chips = el("div");
  chips.appendChild(chip("NEEDS REVIEW", "warn"));
  chips.appendChild(chip(`Vendor ${flags.vendor ? "✓" : "×"}`, flags.vendor ? "ok" : "bad"));
  if (flags.numberFlag) chips.appendChild(chip("Numbers ×", "bad"));
  if (flags.dateFlag) chips.appendChild(chip("Date ×", "warn"));
  info.appendChild(chips);

  card.appendChild(info);

  // Right: closest JSON (if any)
  const right = el("div", { class: "json-match" });
  if (cj) {
    right.appendChild(row("Closest Vendor:", esc(cj.vendor || "N/A")));
    right.appendChild(row("Expiry:", esc(formatISODate(cj.expiryDate))));
    if (cj.startDate) right.appendChild(row("Start:", esc(formatISODate(cj.startDate))));
    right.appendChild(row("Title:", highlightText(cj.title || "—", moneyHits, pctHits)));
    right.appendChild(row("Listing:", highlightText(cj.shopListing || "—", moneyHits, pctHits)));
    right.appendChild(tooltipEye(reasons.length ? reasons : ["Why this was closest: unknown"]));
  } else {
    right.appendChild(row("Closest JSON:", "None with matching vendor"));
  }
  card.appendChild(right);

  return card;
}

/* -------------------- List renderers -------------------- */
function renderMatchedList(container, items) {
  if (!container) return;
  clearNode(container);
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) { container.appendChild(el("div", { class: "no-matches" }, "No matched deals.")); countInto("matchedCount", 0); return; }
  for (const it of arr) container.appendChild(renderMatchedItem(it));
  countInto("matchedCount", arr.length);
}

function renderNonMatchedList(container, items) {
  if (!container) return;
  clearNode(container);
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) { container.appendChild(el("div", { class: "no-matches" }, "No non-matched deals.")); countInto("nonMatchedCount", 0); return; }
  for (const it of arr) container.appendChild(renderNonMatchedItem(it));
  countInto("nonMatchedCount", arr.length);
}

/* -------------------- Results + filters (supports old IDs) -------------------- */
function _filterVal(id) { return (document.getElementById(id)?.value || "").trim().toLowerCase(); }
function _getMatchedContainer() { return $("matchedDealsContainer","matched"); }
function _getNonMatchedContainer() { return $("nonMatchedDealsContainer","nonMatched"); }

function renderMatchedDeals() {
  const q = _filterVal("matchedFilter");
  const items = (window.matchedDeals || []).filter(it => {
    if (!q) return true;
    const hq = it.hqDeal || {}, js = it.jsonDeal || {};
    const hay = [hq.title, hq.vendor, js.title, js.shopListing, js.vendor].join(" ").toLowerCase();
    return hay.includes(q);
  });
  renderMatchedList(_getMatchedContainer(), items);
}

function renderNonMatchedDeals() {
  const q = _filterVal("nonMatchedFilter");
  const items = (window.nonMatchedDeals || []).filter(it => {
    if (!q) return true;
    const hq = it.hqDeal || {}, cj = it.closestJson || {};
    const hay = [hq.title, hq.vendor, cj.title, cj.shopListing, cj.vendor].join(" ").toLowerCase();
    return hay.includes(q);
  });
  renderNonMatchedList(_getNonMatchedContainer(), items);
}

function renderAll() { renderMatchedDeals(); renderNonMatchedDeals(); }

function renderResults(result) {
  const matchedList = _getMatchedContainer();
  const nonMatchedList = _getNonMatchedContainer();
  // Allow being called with full result object (preferred)
  if (result && typeof result === "object" && Array.isArray(result.matched) && Array.isArray(result.nonMatched)) {
    window.matchedDeals = result.matched;
    window.nonMatchedDeals = result.nonMatched;
  }
  if (matchedList) renderMatchedList(matchedList, window.matchedDeals || []);
  if (nonMatchedList) renderNonMatchedList(nonMatchedList, window.nonMatchedDeals || []);
}

/* -------------------- Export helpers used by app.js -------------------- */
function copyNonMatchedToClipboard() {
  const arr = (window.nonMatchedDeals || []).map(x => {
    const v = x.hqDeal?.vendor ? `${x.hqDeal.vendor}: ` : "";
    return `${v}${x.hqDeal?.title || ""}`;
  });
  const text = arr.join("\n");
  if (!text) return;
  navigator.clipboard.writeText(text).catch(() => {});
}

/* -------------------- Wire up live filtering if inputs exist -------------------- */
["matchedFilter","nonMatchedFilter"].forEach(id => {
  const input = document.getElementById(id);
  if (input && typeof input.addEventListener === "function") {
    input.addEventListener("input", () => id === "matchedFilter" ? renderMatchedDeals() : renderNonMatchedDeals());
  }
});

/* -------------------- Expose -------------------- */
window.clearNode = clearNode;
window.renderMatchedList = renderMatchedList;
window.renderNonMatchedList = renderNonMatchedList;
window.renderMatchedDeals = renderMatchedDeals;
window.renderNonMatchedDeals = renderNonMatchedDeals;
window.renderResults = renderResults;
window.renderAll = renderAll;
window.copyNonMatchedToClipboard = copyNonMatchedToClipboard;
