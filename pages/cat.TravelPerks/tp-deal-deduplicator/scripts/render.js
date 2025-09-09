/* render.js — colorful cards + live counts, null-safe, CSS-injected */

/* -------------------- One-time CSS injection -------------------- */
(function ensureStyles() {
  if (document.getElementById("tp-deal-styles")) return;
  const css = `
  .tp-card{border:1px solid #e5e7eb;border-radius:14px;padding:12px 12px 12px 0;margin:10px 0;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.05)}
  .tp-rail{width:6px;border-top-left-radius:14px;border-bottom-left-radius:14px;align-self:stretch}
  .tp-rail.green{background:linear-gradient(180deg,#22c55e,#16a34a)}
  .tp-rail.amber{background:linear-gradient(180deg,#f59e0b,#d97706)}
  .tp-rail.blue{background:linear-gradient(180deg,#3b82f6,#2563eb)}
  .tp-body{padding-left:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .tp-left{display:flex;flex-direction:column;gap:8px}
  .tp-right{display:flex;flex-direction:column;gap:8px}
  .tp-title{font-weight:800;font-size:1rem;line-height:1.2;margin-bottom:4px}
  .tp-chiprow{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:2px}
  .tp-chip{font-size:.72rem;font-weight:700;border-radius:999px;padding:4px 8px;border:1px solid transparent;display:inline-flex;gap:6px;align-items:center}
  .tp-chip.perfect{background:#e8fff2;color:#065f46;border-color:#a7f3d0}
  .tp-chip.exclusive{background:#eff6ff;color:#1e3a8a;border-color:#bfdbfe}
  .tp-chip.issue{background:#fff7ed;color:#7c2d12;border-color:#fed7aa}
  .tp-mini{font-size:.68rem;border-radius:8px;padding:2px 6px;border:1px solid transparent}
  .tp-mini.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
  .tp-mini.meh{background:#fefce8;border-color:#fde68a;color:#713f12}
  .tp-mini.bad{background:#fef2f2;border-color:#fecaca;color:#7f1d1d}
  .tp-subcard{background:#f8fafc;border:1px solid #eef2f7;border-radius:10px;padding:10px}
  .tp-k{min-width:6.5rem;font-weight:700;color:#475569}
  .tp-row{display:flex;gap:.5rem;margin:.1rem 0}
  .tp-right .tp-subcard .tp-row{margin:.15rem 0}
  .tp-count{display:inline-flex;min-width:26px;height:26px;padding:0 8px;border-radius:999px;align-items:center;justify-content:center;background:#eef2ff;color:#1e3a8a;font-weight:800}
  .tp-badgeScore{min-width:34px;height:34px;border-radius:10px;background:#fffbeb;color:#92400e;font-weight:900;display:flex;align-items:center;justify-content:center;border:1px solid #fde68a}
  .tp-leftline{display:flex;gap:10px;align-items:center}
  .tp-check{width:24px;height:24px;border-radius:999px;background:#e8fff2;border:1px solid #a7f3d0;display:flex;align-items:center;justify-content:center}
  .tp-check::after{content:"✓";font-weight:900;color:#065f46}
  .tp-muted{opacity:.7}
  `;
  const style = document.createElement("style");
  style.id = "tp-deal-styles";
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
})();

/* -------------------- Utilities -------------------- */
function $(id){ return document.getElementById(id); }

function _getContainer(primaryId, ...aliases) {
  return $(primaryId) || aliases.map((id) => $(id)).find(Boolean) || null;
}

function clearNode(node){ if(!node) return; while(node.firstChild) node.removeChild(node.firstChild); }

function _asText(v){ if(v==null) return ""; try{return String(v);}catch{return "";} }
function _norm(s){ return _asText(s).toLowerCase(); }
function _textMatches(q,str){ q=_norm(q).trim(); if(!q) return true; return _norm(str).includes(q); }

function _create(tag, attrs = {}, ...children){
  const el = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==="class"||k==="className") el.className=v;
    else if(k==="dataset"&&v&&typeof v==="object") Object.entries(v).forEach(([dk,dv])=>el.dataset[dk]=dv);
    else if(k in el){ try{ el[k]=v; }catch{ el.setAttribute(k,v); } }
    else el.setAttribute(k,v);
  }
  for(const c of children){
    if(c==null) continue;
    if(Array.isArray(c)) c.forEach(cc=>el.appendChild(_node(cc)));
    else el.appendChild(_node(c));
  }
  return el;
}
function _node(x){ return x instanceof Node ? x : document.createTextNode(_asText(x)); }

/* -------------------- Count helpers -------------------- */
function _setCount(kind, n){
  const id = kind==="matched" ? "matchedCount" : "nonMatchedCount";
  const el = $(id) || document.querySelector(`[data-count="${kind}"]`);
  if (el) { el.textContent = n; return; }

  // Fallback: prepend a tiny header with count if none exists
  const container = _getContainer(kind==="matched" ? "matched" : "nonMatched",
                                  kind==="matched" ? "matchedDealsContainer" : "nonMatchedDealsContainer");
  if (!container) return;
  const first = container.firstElementChild;
  const header = _create("div", { style:"display:flex;align-items:center;gap:8px;margin:4px 2px 8px 2px" },
    _create("div", { style:"font-size:1.05rem;font-weight:800" }, kind==="matched" ? "Matched Deals" : "Unmatched Deals"),
    _create("span", { class:"tp-count", dataset:{autoinsert:"1"} }, n)
  );
  if (!first || first.dataset?.autoinsert!=="1") container.insertBefore(header, first || null);
  else first.querySelector(".tp-count").textContent = n;
}

/* -------------------- Tiny status helpers (robust to missing fields) -------------------- */
function _flags(item){
  const f = item?.flags || {};
  // Accepts booleans or "ok"/"meh"/"bad". Soft defaults.
  const norm = (x)=> x===true||x==="ok" ? "ok" : (x==="bad"||x===false ? "bad" : (x==="meh" ? "meh" : null));
  return {
    vendor: norm(f.vendor),
    numbers: norm(f.numbers),
    date: norm(f.date)
  };
}
function _status(item){
  // Prefer explicit status; otherwise infer "perfect" if all flags ok
  const s = (item?.status || "").toLowerCase();
  if (s) return s; 
  const fl = _flags(item);
  return (fl.vendor==="ok" && fl.numbers==="ok" && fl.date==="ok") ? "perfect" : "synergy";
}
function _railColor(item){
  const st = _status(item);
  if (st==="perfect") return "green";
  if (item?.score != null) return "amber";
  return "blue";
}

/* -------------------- Rendering primitives -------------------- */
function _mini(label, kind){ return _create("span", { class:`tp-mini ${kind||"meh"}` }, label); }
function _chip(text, kind){ return _create("span", { class:`tp-chip ${kind||""}` }, text); }

function _dealRow(label, value) {
  return _create("div", { class:"tp-row" },
    _create("div", { class:"tp-k" }, label),
    _create("div", null, value || "—")
  );
}

/* -------------------- Card renderers -------------------- */
function _renderMatchedCard(item){
  const hq = item?.hqDeal || {};
  const js = item?.jsonDeal || {};

  const fl = _flags(item);
  const st = _status(item);
  const rail = _railColor(item);

  const title = hq.title || js.title || "Matched Deal";

  const chips = [];
  if (st==="perfect") chips.push(_chip("PERFECT MATCH","perfect"));
  if (item?.badges?.length) item.badges.forEach(b => chips.push(_chip(b, "exclusive")));
  if (item?.issues?.length) item.issues.forEach(b => chips.push(_chip(b, "issue")));

  const minis = [
    _mini(`Vendor ${fl.vendor==="ok"?"✓":fl.vendor==="bad"?"✕":"–"}`, fl.vendor||"meh"),
    _mini(`Numbers ${fl.numbers==="ok"?"✓":fl.numbers==="bad"?"✕":"–"}`, fl.numbers||"meh"),
    _mini(`Date ${fl.date==="ok"?"✓":fl.date==="bad"?"✕":"–"}`, fl.date||"meh"),
  ];

  const leftRail = _create("div", { class:`tp-rail ${rail}` });
  const leftColumn = _create("div", { class:"tp-left" },
    _create("div", { class:"tp-leftline" },
      (st==="perfect" ? _create("div", { class:"tp-check"}) :
        (item?.score!=null ? _create("div", { class:"tp-badgeScore" }, _asText(item.score)) :
          _create("div", { class:"tp-badgeScore tp-muted" }, "•"))),
      _create("div", { class:"tp-title" }, title)
    ),
    _create("div", { class:"tp-chiprow" }, chips, minis)
  );

  const rightColumn = _create("div", { class:"tp-right" },
    _create("div", { class:"tp-subcard" },
      _dealRow("Vendor:", js.vendor || js.shopListing || "—"),
      _dealRow("Expiry:", js.expiry || js.exp || js.endDate || "N/A"),
      _dealRow("Title:", js.title || "—"),
      _dealRow("Listing:", js.shopListing || js.description || "—")
    ),
    _create("div", { class:"tp-subcard" },
      _dealRow("Vendor:", hq.vendor || "—"),
      _dealRow("Expiry:", hq.expiry || hq.exp || hq.endDate || "N/A"),
      _dealRow("Title:", hq.title || "—"),
      hq.url ? _dealRow("Link:", _create("a", { href:hq.url, target:"_blank", rel:"noopener noreferrer" }, hq.url)) : null
    )
  );

  const body = _create("div", { class:"tp-body" }, leftColumn, rightColumn);

  return _create("div", { class:"tp-card" }, leftRail, body);
}

function _renderNonMatchedCard(item){
  const hq = item?.hqDeal || {};
  const cj = item?.closestJson || {};
  const rail = "blue";
  const title = hq.title || "Unmatched HQ Deal";

  const left = _create("div", { class:"tp-left" },
    _create("div", { class:"tp-leftline" },
      _create("div", { class:"tp-badgeScore tp-muted" }, "•"),
      _create("div", { class:"tp-title" }, title)
    ),
    _create("div", { class:"tp-chiprow" },
      _chip("NEEDS ATTENTION","issue"),
      _mini("No JSON match","bad")
    )
  );

  const right = _create("div", { class:"tp-right" },
    _create("div", { class:"tp-subcard" },
      _dealRow("HQ Vendor:", hq.vendor || "—"),
      _dealRow("HQ Title:", hq.title || "—"),
      hq.url ? _dealRow("Link:", _create("a", { href:hq.url, target:"_blank", rel:"noopener noreferrer" }, hq.url)) : null
    ),
    (cj && (cj.title||cj.shopListing)) ? _create("div", { class:"tp-subcard" },
      _dealRow("Closest JSON:", `${cj.title || ""}${cj.title && cj.shopListing ? " · " : ""}${cj.shopListing || ""}`),
      _dealRow("Vendor:", cj.vendor || cj.shopListing || "—")
    ) : null
  );

  return _create("div", { class:"tp-card" }, _create("div",{class:`tp-rail ${rail}`}), _create("div",{class:"tp-body"}, left, right));
}

/* -------------------- List renderers -------------------- */
function renderMatchedList(container, items){
  if(!container){ console.warn("[renderMatchedList] Missing container"); return; }
  clearNode(container);

  // Count badge
  _setCount("matched", Array.isArray(items) ? items.length : 0);

  if (!Array.isArray(items) || items.length===0){
    container.appendChild(_create("div", { class:"tp-muted", style:"padding:8px 0" }, "No matched deals."));
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach(it => frag.appendChild(_renderMatchedCard(it)));
  container.appendChild(frag);
}

function renderNonMatchedList(container, items){
  if(!container){ console.warn("[renderNonMatchedList] Missing container"); return; }
  clearNode(container);

  _setCount("nonMatched", Array.isArray(items) ? items.length : 0);

  if (!Array.isArray(items) || items.length===0){
    container.appendChild(_create("div", { class:"tp-muted", style:"padding:8px 0" }, "No unmatched deals."));
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach(it => frag.appendChild(_renderNonMatchedCard(it)));
  container.appendChild(frag);
}

/* -------------------- Top-level API -------------------- */
function _filterValue(id){ return _asText($(id)?.value).trim().toLowerCase(); }

function renderMatchedDeals(){
  const q = _filterValue("matchedFilter");
  const container = _getContainer("matched","matchedDealsContainer");

  const items = (window.matchedDeals || []).filter((it)=>{
    if(!q) return true;
    const hq = it?.hqDeal || {}, js = it?.jsonDeal || {};
    return _textMatches(q, hq.title) || _textMatches(q, hq.vendor) ||
           _textMatches(q, js.title) || _textMatches(q, js.shopListing) || _textMatches(q, js.vendor);
  });

  renderMatchedList(container, items);
}

function renderNonMatchedDeals(){
  const q = _filterValue("nonMatchedFilter");
  const container = _getContainer("nonMatched","nonMatchedDealsContainer");

  const items = (window.nonMatchedDeals || []).filter((it)=>{
    if(!q) return true;
    const hq = it?.hqDeal || {}, cj = it?.closestJson || {};
    return _textMatches(q, hq.title) || _textMatches(q, hq.vendor) ||
           _textMatches(q, cj.title) || _textMatches(q, cj.shopListing) || _textMatches(q, cj.vendor);
  });

  renderNonMatchedList(container, items);
}

function renderAll(){ renderMatchedDeals(); renderNonMatchedDeals(); }

function renderResults(result){
  if(!result || typeof result!=="object"){ console.warn("[renderResults] No result object"); return; }
  if(Array.isArray(result.matchedDeals)) window.matchedDeals = result.matchedDeals;
  if(Array.isArray(result.nonMatchedDeals)) window.nonMatchedDeals = result.nonMatchedDeals;
  renderAll();
}

/* -------------------- Expose globals -------------------- */
window.clearNode = clearNode;
window.renderMatchedList = renderMatchedList;
window.renderNonMatchedList = renderNonMatchedList;
window.renderMatchedDeals = renderMatchedDeals;
window.renderNonMatchedDeals = renderNonMatchedDeals;
window.renderAll = renderAll;
window.renderResults = renderResults;

/* -------------------- QoL: live filter re-render -------------------- */
["matchedFilter","nonMatchedFilter"].forEach(id=>{
  const el=$(id);
  if(el && typeof el.addEventListener==="function"){
    el.addEventListener("input", ()=> id==="matchedFilter" ? renderMatchedDeals() : renderNonMatchedDeals());
  }
});
