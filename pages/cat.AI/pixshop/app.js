// projects/pages/cat.AI/pixshop/app.js

// ===== DOM =====
const els = Object.fromEntries(
  [
    'file','drop','img','meta','dot','preview','mode','prompt','run','clear',
    'out','download','log','prog','outcropControls','out_side','out_amount',
    'undo','redo','resultPanel','debugPanel','dbg_view','dbg_fade','dbg_offset',
    'dbg_scale','dbg_apply','dbg_recompose','dbg_close','dbg_canvas'
  ].map(id => [id, document.getElementById(id)])
);

let state = {
  workingDu: null,            // main image that grows
  uploadDu: null,             // compressed copy for API
  natural: { w:0, h:0 },
  hotspot: null,

  // debug (after outcrop)
  preOutcropDu: null,
  lastInfo: null,
  lastGenSnippetDu: null
};

// ===== History (undo/redo, localStorage) =====
const HIST_KEY = 'pixshop_hist_v3';
const History = {
  stack: [], idx: -1, limit: 10,
  load() {
    try {
      const raw = localStorage.getItem(HIST_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (Array.isArray(p?.stack) && typeof p.idx === 'number') {
        this.stack = p.stack.slice(-this.limit);
        this.idx = Math.min(p.idx, this.stack.length - 1);
      }
    } catch {}
    updateHistoryUi();
  },
  save(){ try { localStorage.setItem(HIST_KEY, JSON.stringify({stack:this.stack, idx:this.idx})); } catch{} updateHistoryUi(); },
  init(du){ this.stack=[du]; this.idx=0; this.save(); },
  push(du){
    if (this.idx < this.stack.length - 1) this.stack = this.stack.slice(0, this.idx + 1);
    this.stack.push(du);
    while (this.stack.length > this.limit) this.stack.shift();
    this.idx = this.stack.length - 1; this.save();
  },
  undo(){ if (this.idx > 0) { this.idx--; this.save(); return this.stack[this.idx]; } return null; },
  redo(){ if (this.idx < this.stack.length - 1) { this.idx++; this.save(); return this.stack[this.idx]; } return null; },
};
function updateHistoryUi(){
  els.undo.disabled = !(History.idx > 0);
  els.redo.disabled = !(History.idx < History.stack.length - 1 && History.idx >= 0);
}

// ===== Logging & progress =====
function setLog(msg){ els.log.textContent = msg || ''; }
function appendLog(line){ els.log.textContent += (els.log.textContent ? '\n' : '') + line; }
function setBusy(b){
  els.run.disabled = b;
  document.body.style.cursor = b ? 'progress' : 'default';
  els.prog.style.display = b ? 'block' : 'none';
  if (!b) els.prog.value = 0;
}
function prettyBytes(n){
  if (!Number.isFinite(n)) return '—';
  const u=['B','KB','MB','GB']; let i=0; while(n>=1024 && i<u.length-1){ n/=1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}
function dataUrlBytes(dataUrl){
  const i = dataUrl.indexOf(','); if (i < 0) return 0;
  const b64 = dataUrl.slice(i+1); const len = b64.length;
  const padding = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  return Math.floor((len * 3) / 4) - padding;
}

// ===== Image helpers =====
function showImage(dataUrl){
  return new Promise((resolve,reject)=>{
    const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = dataUrl;
  });
}
function drawCanvas(w, h) { const c = document.createElement('canvas'); c.width=w; c.height=h; return { c, ctx: c.getContext('2d') }; }
function drawToDataUrl(img, w, h, type, quality){
  const { c, ctx } = drawCanvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL(type, quality);
}

// ===== Compression to avoid 413 =====
const TARGET_MAX_BYTES = 3.5 * 1024 * 1024;
async function compressDataUrl(inputDataUrl, {
  maxEdge = 2200, minEdge = 1200, qualityStart = 0.92, qualityMin = 0.65, stepQ = 0.08, stepEdge = 256
} = {}) {
  const img = await showImage(inputDataUrl);
  const natural = { w: img.naturalWidth, h: img.naturalHeight };
  let edge = Math.min(maxEdge, Math.max(natural.w, natural.h));
  let q = qualityStart;
  let best = { du: inputDataUrl, bytes: dataUrlBytes(inputDataUrl), w: natural.w, h: natural.h, q: 1 };
  if (best.bytes <= TARGET_MAX_BYTES) return { ...best, natural };
  while (edge >= minEdge) {
    const scale = edge / Math.max(natural.w, natural.h);
    const w = Math.round(natural.w * scale), h = Math.round(natural.h * scale);
    while (q >= qualityMin) {
      const du = drawToDataUrl(img, w, h, 'image/jpeg', q);
      const bytes = dataUrlBytes(du);
      if (bytes < best.bytes) best = { du, bytes, w, h, q };
      if (bytes <= TARGET_MAX_BYTES) return { du, bytes, w, h, q, natural };
      q -= stepQ;
    }
    q = qualityStart; edge -= stepEdge;
  }
  return { ...best, natural };
}

// ===== Outcrop: snippet + overlap + yellow mask =====
const YELLOW = '#FFFF00';

// Build snippet with (pad + overlap), copy overlap from original.
async function buildOutcropSnippet(sourceDu, side='right', frac=0.2) {
  const src = await showImage(sourceDu);
  const W = src.naturalWidth, H = src.naturalHeight;
  const pad = Math.max(4, Math.round((side==='left'||side==='right'?W:H) * frac));
  const ov  = Math.max(24, Math.min(160, Math.round(pad * 0.33))); // overlap
  const fade = Math.min(64, Math.max(24, Math.floor(ov * 0.6)));   // default seam fade

  const horizontal = (side==='left'||side==='right');
  const snipW = horizontal ? (pad + ov) : W;
  const snipH = horizontal ? H : (pad + ov);

  const { c, ctx } = drawCanvas(snipW, snipH);
  ctx.fillStyle = YELLOW; ctx.fillRect(0,0,snipW,snipH);

  if (side === 'left') {
    ctx.drawImage(src, 0, 0, ov, H, pad, 0, ov, H);
  } else if (side === 'right') {
    ctx.drawImage(src, W - ov, 0, ov, H, 0, 0, ov, H);
  } else if (side === 'top') {
    ctx.drawImage(src, 0, 0, W, ov, 0, pad, W, ov);
  } else { // bottom
    ctx.drawImage(src, 0, H - ov, W, ov, 0, 0, W, ov);
  }

  const snippetDu = c.toDataURL('image/png');

  // scale snippet for API (≤ 1024 long edge)
  const maxEdge = 1024;
  const scale = Math.min(1, maxEdge / Math.max(snipW, snipH));
  let uploadDu = snippetDu, upW = snipW, upH = snipH, upScale = 1;
  if (scale < 1) {
    const { c: cs, ctx: cx } = drawCanvas(Math.round(snipW*scale), Math.round(snipH*scale));
    const tmp = await showImage(snippetDu);
    cx.drawImage(tmp, 0, 0, cs.width, cs.height);
    uploadDu = cs.toDataURL('image/jpeg', 0.92);
    upW = cs.width; upH = cs.height; upScale = scale;
  }

  const finalW = horizontal ? W + pad : W;
  const finalH = horizontal ? H : H + pad;

  return {
    side, pad, ov, fade,
    snippet: { du: snippetDu, w: snipW, h: snipH },
    upload:  { du: uploadDu,  w: upW,   h: upH, scale: upScale },
    source:  { w: W, h: H },
    final:   { w: finalW, h: finalH }
  };
}

// draw composite into a context; returns dataURL if ctx is omitted
async function composeOutcropFromSnippet(baseDu, genSnippetDu, info, opts = {}) {
  const { side, pad, ov, snippet, upload, source, final } = info;
  const fade = Math.max(0, Math.round(opts.fade ?? info.fade));
  const offset = Math.round(opts.offset || 0); // px; horizontal or vertical depending on side
  const scale = Math.max(0.95, Math.min(1.05, Number(opts.scale || 1)));

  const baseImg = await showImage(baseDu);
  const genImg  = await showImage(genSnippetDu);

  // where to crop from GENERATED snippet (pad + fade) in upload-space
  const crop = { x:0, y:0, w:0, h:0 };
  if (side === 'left') {
    crop.x = 0; crop.y = 0;
    crop.w = Math.round((pad + fade) * (upload.w / snippet.w)); crop.h = upload.h;
  } else if (side === 'right') {
    crop.x = Math.round(ov * (upload.w / snippet.w)); crop.y = 0;
    crop.w = Math.round((pad + fade) * (upload.w / snippet.w)); crop.h = upload.h;
  } else if (side === 'top') {
    crop.x = 0; crop.y = 0; crop.w = upload.w;
    crop.h = Math.round((pad + fade) * (upload.h / snippet.h));
  } else { // bottom
    crop.x = 0; crop.y = Math.round(ov * (upload.h / snippet.h)); crop.w = upload.w;
    crop.h = Math.round((pad + fade) * (upload.h / snippet.h));
  }

  // final canvas
  const { c: out, ctx } = drawCanvas(final.w, final.h);

  // draw ORIGINAL first
  if (side === 'left')      ctx.drawImage(baseImg, pad, 0);
  else if (side === 'right')ctx.drawImage(baseImg, 0, 0);
  else if (side === 'top')  ctx.drawImage(baseImg, 0, pad);
  else                      ctx.drawImage(baseImg, 0, 0);

  // extension (pad+fade)
  const extW = (side==='left'||side==='right') ? (pad + fade) : source.w;
  const extH = (side==='left'||side==='right') ? source.h     : (pad + fade);
  const { c: extC, ctx: ex } = drawCanvas(extW, extH);

  // draw cropped generated region, with micro-scale
  const drawW = Math.round(extW * scale);
  const drawH = Math.round(extH * (side==='left'||side==='right' ? 1 : scale)); // scale along major axis only
  const dx = Math.round((extW - drawW)/2);
  const dy = Math.round((extH - drawH)/2);
  ex.drawImage(genImg, crop.x, crop.y, crop.w, crop.h, dx, dy, drawW, drawH);

  // build mask (alpha on extension)
  ex.globalCompositeOperation = 'destination-in';
  const g = ex.createLinearGradient(
    ...(side==='left'  ? [extW - fade, 0, extW, 0] :
       side==='right' ? [0, 0, fade, 0] :
       side==='top'   ? [0, extH - fade, 0, extH] :
                        [0, 0, 0, fade])
  );
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ex.fillStyle = g; ex.fillRect(0, 0, extW, extH);
  ex.globalCompositeOperation = 'source-over';

  // place extension with offset
  if (side === 'left')      ctx.drawImage(extC, 0 + offset, 0);
  else if (side === 'right')ctx.drawImage(extC, source.w - fade + offset, 0);
  else if (side === 'top')  ctx.drawImage(extC, 0, 0 + offset);
  else                      ctx.drawImage(extC, 0, source.h - fade + offset);

  if (!opts || !opts.view || opts.view === 'composite') return out.toDataURL('image/png');

  // debug draws for other views
  const { c: dbg, ctx: dxctx } = drawCanvas(final.w, final.h);
  if (opts.view === 'original') {
    if (side === 'left')      dxctx.drawImage(baseImg, pad, 0);
    else if (side === 'right')dxctx.drawImage(baseImg, 0, 0);
    else if (side === 'top')  dxctx.drawImage(baseImg, 0, pad);
    else                      dxctx.drawImage(baseImg, 0, 0);
  } else if (opts.view === 'extMasked') {
    dxctx.drawImage(extC,
      (side==='left') ? 0 + offset : (side==='right') ? (source.w - fade + offset) : 0,
      (side==='top') ? 0 + offset : (side==='bottom') ? (source.h - fade + offset) : 0
    );
  } else if (opts.view === 'mask') {
    const { c: mC, ctx: mX } = drawCanvas(extW, extH);
    const mg = mX.createLinearGradient(
      ...(side==='left'  ? [extW - fade, 0, extW, 0] :
         side==='right' ? [0, 0, fade, 0] :
         side==='top'   ? [0, extH - fade, 0, extH] :
                          [0, 0, 0, fade])
    );
    mg.addColorStop(0, 'rgba(255,255,255,1)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    mX.fillStyle = mg; mX.fillRect(0,0,extW,extH);
    dxctx.drawImage(mC,
      (side==='left') ? 0 + offset : (side==='right') ? (source.w - fade + offset) : 0,
      (side==='top') ? 0 + offset : (side==='bottom') ? (source.h - fade + offset) : 0
    );
  }
  return dbg.toDataURL('image/png');
}

// ===== UI helpers =====
function placeDot(x,y){ els.dot.style.display='block'; els.dot.style.left=(x*100)+'%'; els.dot.style.top=(y*100)+'%'; }
function pickHotspot(ev){
  const r = els.img.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width;
  const y = (ev.clientY - r.top) / r.height;
  state.hotspot = { x: Math.max(0,Math.min(1,x)), y: Math.max(0,Math.min(1,y)) };
  placeDot(state.hotspot.x, state.hotspot.y);
}
function fileToDataUrl(file){
  return new Promise((res,rej)=>{
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file);
  });
}
async function handleFile(file){
  if (!file) return;
  const du = await fileToDataUrl(file);
  const im = await showImage(du);
  state.workingDu = du;
  state.natural = { w: im.naturalWidth, h: im.naturalHeight };
  const compressed = await compressDataUrl(du);
  state.uploadDu = compressed.du;

  History.init(du);
  els.img.src = du; els.img.style.display='block';
  els.meta.textContent = `${state.natural.w}×${state.natural.h} • ~${prettyBytes(dataUrlBytes(du))}`;
  const sp = els.preview.querySelector('span'); if (sp) sp.remove();
  els.download.disabled = true; setLog('');
  hideDebug();
  updateModeUI();
}

function updateModeUI(){
  const isOutcrop = (els.mode.value === 'outcrop');
  els.outcropControls.style.display = isOutcrop ? 'grid' : 'none';
  els.resultPanel.style.display     = isOutcrop ? 'none' : 'block'; // hide duplicate on outcrop
}
els.mode.addEventListener('change', updateModeUI);

// ----- file input + drag/drop + click anywhere in preview (except on image) -----
els.file.addEventListener('change', e => handleFile(e.target.files?.[0]));
els.preview.addEventListener('click', e => { if (e.target !== els.img) els.file.click(); });

['dragenter','dragover'].forEach(t => {
  [document, els.drop, els.file].forEach(el => el.addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); els.drop.style.borderColor = '#4b7bf7'; }));
});
['dragleave','drop'].forEach(t => {
  [document, els.drop, els.file].forEach(el => el.addEventListener(t, e => {
    e.preventDefault(); e.stopPropagation(); els.drop.style.borderColor = 'var(--border)';
    if (t === 'drop') handleFile((e.dataTransfer?.files?.[0]) || (e.target?.files?.[0]));
  }));
});
window.addEventListener('paste', async (e)=>{
  const item = [...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));
  if (item){ const file = item.getAsFile(); await handleFile(file); }
});

// Click-to-focus (retouch)
els.img.addEventListener('click', pickHotspot);

// Clear & Download
els.clear.addEventListener('click', ()=>{
  state = { ...state, workingDu:null, uploadDu:null, natural:{w:0,h:0}, hotspot:null, preOutcropDu:null, lastInfo:null, lastGenSnippetDu:null };
  History.stack = []; History.idx = -1; History.save();
  els.img.src=''; els.img.style.display='none'; els.dot.style.display='none';
  els.meta.textContent=''; els.out.src=''; els.out.style.display='none';
  els.download.disabled=true; setLog(''); els.prog.value = 0; els.prog.style.display='none';
  hideDebug();
});
els.download.addEventListener('click', ()=>{
  const a=document.createElement('a'); a.download='pixshop.png'; a.href=els.img.src || els.out.src; a.click();
});

// Undo / Redo
els.undo.addEventListener('click', async ()=>{
  const du = History.undo(); if (!du) return;
  state.workingDu = du;
  const im = await showImage(du);
  state.natural = { w: im.naturalWidth, h: im.naturalHeight };
  const compressed = await compressDataUrl(du);
  state.uploadDu = compressed.du;
  els.img.src = du; els.img.style.display='block';
  els.out.src=''; els.out.style.display='none'; els.download.disabled = false;
  hideDebug();
});
els.redo.addEventListener('click', async ()=>{
  const du = History.redo(); if (!du) return;
  state.workingDu = du;
  const im = await showImage(du);
  state.natural = { w: im.naturalWidth, h: im.naturalHeight };
  const compressed = await compressDataUrl(du);
  state.uploadDu = compressed.du;
  els.img.src = du; els.img.style.display='block';
  els.out.src=''; els.out.style.display='none'; els.download.disabled = false;
  hideDebug();
});

// ===== API streaming (bypass ai.js) =====
async function callApiStreaming(payload) {
  const KEY='ai-pass';
  let pass = sessionStorage.getItem(KEY) || window.prompt('Enter AI API password');
  if (!pass) throw new Error('No password');
  sessionStorage.setItem(KEY, pass);

  const t0 = performance.now();
  appendLog('Preparing request…');

  const reqBody = JSON.stringify(payload);
  const approxUpload = new Blob([reqBody]).size;
  appendLog(`Upload payload ~${prettyBytes(approxUpload)} (includes base64 image & JSON)`);

  const t1 = performance.now();
  const res = await fetch('/api/pixshop-image', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${pass}` },
    body: reqBody
  });
  const tTFB = performance.now();

  appendLog(`TTFB: ${(tTFB - t1).toFixed(0)} ms (server + network)`);

  const contentLen = Number(res.headers.get('Content-Length') || 0);
  els.prog.max = 100; els.prog.value = 0;

  const reader = res.body?.getReader?.();
  const decoder = new TextDecoder();
  let received = 0;
  let chunks = '';

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      chunks += decoder.decode(value, { stream:true });
      if (contentLen > 0) els.prog.value = Math.min(100, Math.round((received / contentLen) * 100));
      else els.prog.value = Math.min(100, Math.round((received % (1024*100)) / (1024)) );
      if (received % (128 * 1024) < 8192) appendLog(`Downloading… ${prettyBytes(received)}${contentLen ? ' / '+prettyBytes(contentLen) : ''}`);
    }
    chunks += decoder.decode();
  } else {
    chunks = await res.text();
  }

  if (!res.ok) {
    let errMsg = chunks;
    try { const parsed = JSON.parse(chunks); errMsg = parsed?.error || parsed?.details || chunks; } catch {}
    if (res.status === 413) throw new Error('413: Payload too large. Try a smaller image or let compression reduce it more.');
    throw new Error(`${res.status}: ${errMsg}`);
  }

  let json;
  try { json = JSON.parse(chunks); } catch (e) { console.error('Parse error', e, chunks); throw new Error('Response parse error'); }

  const tEnd = performance.now();
  appendLog(`Done in ${(tEnd - t0).toFixed(0)} ms. Model: ${json?.model || ''}`);
  return json;
}

// ===== Debug panel =====
function showDebug(defaults){
  els.debugPanel.style.display = 'block';
  els.dbg_view.value = defaults.view || 'composite';
  els.dbg_fade.value = defaults.fade;
  els.dbg_offset.value = defaults.offset;
  els.dbg_scale.value = (defaults.scale*100).toFixed(1);

  const rerender = async () => {
    if (!state.lastInfo || !state.lastGenSnippetDu || !state.preOutcropDu) return;
    const fade = Number(els.dbg_fade.value);
    const offset = Number(els.dbg_offset.value);
    const scale = Number(els.dbg_scale.value) / 100;
    const view = els.dbg_view.value;

    // draw into canvas (scaled to fit)
    const { w, h } = state.lastInfo.final;
    const canvas = els.dbg_canvas;
    const maxW = Math.min(els.debugPanel.clientWidth - 24, 1000);
    const s = Math.min(1, maxW / w);
    canvas.width = Math.round(w * s);
    canvas.height = Math.round(h * s);
    const tmp = await composeOutcropFromSnippet(state.preOutcropDu, state.lastGenSnippetDu, state.lastInfo, { fade, offset, scale, view });
    const img = await showImage(tmp);
    const g = canvas.getContext('2d');
    g.setTransform(s,0,0,s,0,0); g.clearRect(0,0,w,h);
    g.drawImage(img, 0, 0);
  };

  els.dbg_recompose.onclick = rerender;
  els.dbg_fade.oninput = rerender;
  els.dbg_offset.oninput = rerender;
  els.dbg_scale.oninput = rerender;
  els.dbg_view.onchange = rerender;

  els.dbg_apply.onclick = async () => {
    const fade = Number(els.dbg_fade.value);
    const offset = Number(els.dbg_offset.value);
    const scale = Number(els.dbg_scale.value) / 100;
    const finalDu = await composeOutcropFromSnippet(state.preOutcropDu, state.lastGenSnippetDu, state.lastInfo, { fade, offset, scale, view:'composite' });

    // commit
    state.workingDu = finalDu;
    const im = await showImage(finalDu);
    state.natural = { w: im.naturalWidth, h: im.naturalHeight };
    const compressed = await compressDataUrl(finalDu);
    state.uploadDu = compressed.du;

    History.push(finalDu);
    els.img.src = finalDu; els.img.style.display='block';
    els.download.disabled = false;

    hideDebug();
  };

  els.dbg_close.onclick = hideDebug;

  rerender();
}
function hideDebug(){
  els.debugPanel.style.display = 'none';
  els.dbg_canvas.width = 0; els.dbg_canvas.height = 0;
  state.preOutcropDu = null;
  // keep lastInfo/gen so you can reopen if needed after Undo/Redo
}

// ===== Run =====
els.run.addEventListener('click', async ()=>{
  if (!state.workingDu){ alert('Add an image first'); return; }
  setBusy(true); setLog('');

  try{
    const mode = els.mode.value;

    if (mode === 'outcrop') {
      const side = els.out_side.value;
      const frac = parseFloat(els.out_amount.value);
      appendLog(`Outcrop (snippet): side=${side}, amount=${(frac*100).toFixed(0)}%`);

      const info = await buildOutcropSnippet(state.workingDu, side, frac);
      appendLog(`Snippet ${info.upload.w}×${info.upload.h} (pad=${info.pad}px, overlap=${info.ov}px, fade=${info.fade}px)`);

      const res = await callApiStreaming({
        mode: 'outcrop',
        prompt: els.prompt.value.trim(),
        image: info.upload.du,
        outcrop: { side, frac, overlapPx: info.ov, maskColor: YELLOW }
      });

      const genDu = res?.dataUrl;
      if (!genDu) throw new Error('No image returned');

      // Open debug panel for manual alignment BEFORE committing
      state.preOutcropDu = state.workingDu;        // hold base
      state.lastInfo = info;
      state.lastGenSnippetDu = genDu;

      // show ‘gen’/‘snippet’ in the debug view list
      els.dbg_view.value = 'composite';
      showDebug({ fade: info.fade, offset: 0, scale: 1, view: 'composite' });

      // no duplicate result
      els.out.src=''; els.out.style.display='none';
      setBusy(false);
      return;
    }

    // non-outcrop modes
    const res = await callApiStreaming({
      mode, prompt: els.prompt.value.trim(),
      image: state.uploadDu,
      hotspot: (mode === 'retouch') ? state.hotspot : undefined
    });
    const du = res?.dataUrl;
    if (!du) throw new Error('No image returned');
    els.out.src = du; els.out.style.display='block'; els.download.disabled=false;

  } catch(e) {
    console.error(e);
    appendLog('Error: ' + (e?.message || String(e)));
  } finally {
    setBusy(false);
  }
});

// Init
History.load();
updateModeUI();
