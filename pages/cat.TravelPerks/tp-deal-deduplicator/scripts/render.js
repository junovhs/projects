/* render.js — safe, id-flexible, and crash-resistant */

/* -------------------- Utilities -------------------- */

function $(id) {
  return document.getElementById(id);
}

function _getContainer(primaryId, ...aliases) {
  return $(primaryId) || aliases.map((id) => $(id)).find(Boolean) || null;
}

function clearNode(node) {
  // Null guard fixes: "Cannot read properties of null (reading 'firstChild')"
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function _asText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return String(v);
  } catch {
    return "";
  }
}

function _normalizeStr(s) {
  return _asText(s).toLowerCase();
}

function _textMatches(query, str) {
  const q = _normalizeStr(query).trim();
  if (!q) return true; // empty query matches everything
  const hay = _normalizeStr(str);
  return hay.includes(q);
}

function _create(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class" || k === "className") el.className = v;
    else if (k === "dataset" && v && typeof v === "object") {
      Object.entries(v).forEach(([dk, dv]) => (el.dataset[dk] = dv));
    } else if (k in el) {
      try {
        el[k] = v;
      } catch {
        el.setAttribute(k, v);
      }
    } else {
      el.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null) continue;
    if (Array.isArray(c)) c.forEach((cc) => el.appendChild(_node(cc)));
    else el.appendChild(_node(c));
  }
  return el;
}

function _node(x) {
  if (x == null) return document.createTextNode("");
  return x instanceof Node ? x : document.createTextNode(_asText(x));
}

/* -------------------- Rendering helpers -------------------- */

function _dealRow(label, value) {
  return _create(
    "div",
    { class: "tp-row", style: "display:flex; gap:.5rem; margin:.125rem 0;" },
    _create("div", { class: "tp-k", style: "min-width:7rem; font-weight:600;" }, label),
    _create("div", { class: "tp-v" }, value || "—")
  );
}

function _renderMatchedCard(item) {
  const hq = item?.hqDeal || {};
  const js = item?.jsonDeal || {};
  return _create(
    "div",
    {
      class:
        "tp-card matched",
      style:
        "border:1px solid #e5e7eb; border-radius:12px; padding:12px; margin:8px 0; box-shadow:0 1px 2px rgba(0,0,0,.04);",
    },
    _create(
      "div",
      { style: "display:flex; justify-content:space-between; align-items:center; margin-bottom:.25rem" },
      _create("div", { style: "font-size:1rem; font-weight:700;" }, hq.title || js.title || "Matched Deal"),
      _create(
        "div",
        { style: "font-size:.75rem; opacity:.7" },
        "matched"
      )
    ),
    _dealRow("HQ Title", hq.title),
    _dealRow("HQ Vendor", hq.vendor),
    _dealRow("JSON Title", js.title),
    _dealRow("JSON Vendor", js.shopListing || js.vendor),
    (hq.url || js.url)
      ? _dealRow(
          "Link",
          _create("a", { href: hq.url || js.url, target: "_blank", rel: "noopener noreferrer" }, hq.url || js.url)
        )
      : null
  );
}

function _renderNonMatchedCard(item) {
  const hq = item?.hqDeal || {};
  const cj = item?.closestJson || {};
  return _create(
    "div",
    {
      class:
        "tp-card nonmatched",
      style:
        "border:1px solid #f3f4f6; border-radius:12px; padding:12px; margin:8px 0; background:#fafafa;",
    },
    _create(
      "div",
      { style: "display:flex; justify-content:space-between; align-items:center; margin-bottom:.25rem" },
      _create("div", { style: "font-size:1rem; font-weight:700;" }, hq.title || "Unmatched HQ Deal"),
      _create("div", { style: "font-size:.75rem; opacity:.7" }, "unmatched")
    ),
    _dealRow("HQ Title", hq.title),
    _dealRow("HQ Vendor", hq.vendor),
    cj && (cj.title || cj.shopListing)
      ? _dealRow("Closest JSON", `${cj.title || ""}${cj.title && cj.shopListing ? " · " : ""}${cj.shopListing || ""}`)
      : _dealRow("Closest JSON", "—"),
    (hq.url || cj.url)
      ? _dealRow(
          "Link",
          _create("a", { href: hq.url || cj.url, target: "_blank", rel: "noopener noreferrer" }, hq.url || cj.url)
        )
      : null
  );
}

/* -------------------- Core list renderers -------------------- */

function renderMatchedList(container, items) {
  if (!container) {
    console.warn("[renderMatchedList] Missing container (#matched / #matchedDealsContainer). Nothing to render.");
    return;
  }
  clearNode(container);

  if (!Array.isArray(items) || items.length === 0) {
    container.appendChild(_create("div", { style: "opacity:.7; padding:8px 0" }, "No matched deals."));
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach((it) => frag.appendChild(_renderMatchedCard(it)));
  container.appendChild(frag);
}

function renderNonMatchedList(container, items) {
  if (!container) {
    console.warn("[renderNonMatchedList] Missing container (#nonMatched / #nonMatchedDealsContainer). Nothing to render.");
    return;
  }
  clearNode(container);

  if (!Array.isArray(items) || items.length === 0) {
    container.appendChild(_create("div", { style: "opacity:.7; padding:8px 0" }, "No unmatched deals."));
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach((it) => frag.appendChild(_renderNonMatchedCard(it)));
  container.appendChild(frag);
}

/* -------------------- Top-level renderers -------------------- */

function renderMatchedDeals() {
  // Read optional filter input if present
  const filterInput = $("matchedFilter");
  const q = _asText(filterInput?.value).trim().toLowerCase();

  // Allow either legacy or new IDs
  const container = _getContainer("matched", "matchedDealsContainer");

  const items = (window.matchedDeals || []).filter((it) => {
    if (!q) return true;
    const hq = it?.hqDeal || {};
    const js = it?.jsonDeal || {};
    return (
      _textMatches(q, hq.title) ||
      _textMatches(q, hq.vendor) ||
      _textMatches(q, js.title) ||
      _textMatches(q, js.shopListing) ||
      _textMatches(q, js.vendor)
    );
  });

  renderMatchedList(container, items);
}

function renderNonMatchedDeals() {
  const filterInput = $("nonMatchedFilter");
  const q = _asText(filterInput?.value).trim().toLowerCase();

  const container = _getContainer("nonMatched", "nonMatchedDealsContainer");

  const items = (window.nonMatchedDeals || []).filter((it) => {
    if (!q) return true;
    const hq = it?.hqDeal || {};
    const cj = it?.closestJson || {};
    return (
      _textMatches(q, hq.title) ||
      _textMatches(q, hq.vendor) ||
      _textMatches(q, cj.title) ||
      _textMatches(q, cj.shopListing) ||
      _textMatches(q, cj.vendor)
    );
  });

  renderNonMatchedList(container, items);
}

function renderAll() {
  renderMatchedDeals();
  renderNonMatchedDeals();
}

/**
 * Optional convenience: if your compare step produces an object like:
 *   { matchedDeals: [...], nonMatchedDeals: [...] }
 * you can call renderResults(result) to set globals and render once.
 */
function renderResults(result) {
  if (!result || typeof result !== "object") {
    console.warn("[renderResults] No result object provided.");
    return;
  }
  if (Array.isArray(result.matchedDeals)) window.matchedDeals = result.matchedDeals;
  if (Array.isArray(result.nonMatchedDeals)) window.nonMatchedDeals = result.nonMatchedDeals;
  renderAll();
}

/* -------------------- Expose API on window -------------------- */

window.clearNode = clearNode;
window.renderMatchedList = renderMatchedList;
window.renderNonMatchedList = renderNonMatchedList;
window.renderMatchedDeals = renderMatchedDeals;
window.renderNonMatchedDeals = renderNonMatchedDeals;
window.renderAll = renderAll;
window.renderResults = renderResults;

/* -------------------- Nice-to-haves (non-breaking) -------------------- */

// If filter inputs exist, re-render on input for snappy filtering
["matchedFilter", "nonMatchedFilter"].forEach((id) => {
  const el = $(id);
  if (el && typeof el.addEventListener === "function") {
    el.addEventListener("input", () => {
      if (id === "matchedFilter") renderMatchedDeals();
      else renderNonMatchedDeals();
    });
  }
});

// Soft warning if expected containers are truly missing (helps debugging)
(function sanityCheckContainers() {
  const m = _getContainer("matched", "matchedDealsContainer");
  const n = _getContainer("nonMatched", "nonMatchedDealsContainer");
  if (!m) console.warn('Expected a container with id="matched" or id="matchedDealsContainer".');
  if (!n) console.warn('Expected a container with id="nonMatched" or id="nonMatchedDealsContainer".');
})();
