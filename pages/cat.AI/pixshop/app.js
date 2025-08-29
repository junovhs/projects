// projects/pages/cat.AI/pixshop/app.js

// ===== DOM =====
const els = Object.fromEntries(
  ['file','drop','img','meta','dot','preview','mode','prompt','run','clear','out','download','log','prog','outcropControls','out_side','out_amount','undo','redo']
    .map(id => [id, document.getElementById(id)])
);

let state = {
  workingDu: null,            // full-quality current image (what user sees/edits)
  uploadDu: null,             // compressed copy for API upload
  natural: { w:0, h:0 },      // original dims (updates as we extend)
  hotspot: null
};

// ===== History (undo/redo with localStorage, capped at 10) =====
const HIST_KEY = 'pixshop_hist_v1';
const History = {
  stack: [],
  idx: -1,
  limit: 10,
  load() {
    try {
      const raw = localStorage.getItem(HIST_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.stack) && typeof parsed.idx === 'number') {
        this.stack = parsed.stack.slice(-this.limit);
        this.idx = Math.min(parsed.idx, this.stack.length - 1);
      }
    } catch {}
  },
  save() {
    try { localStorage.setItem(HIST_KEY, JSON.stringify({ stack:this.stack, idx:this.idx })); } catch {}
    updateHistoryUi();
  },
  init(du) {
    this.stack = [du];
    this.idx = 0;
    this.save();
  },
  push(du) {
    // drop any redo tail
    if (this.idx < this.stack.length - 1) this.stack = this.stack.slice(0, this.idx + 1);
    this.stack.push(du);
    // enforce limit
    while (this.stack.length > this.limit) {
      this.stack.shift();
    }
    this.idx = this.stack.length - 1;
    this.save();
  },
  undo() {
    if (this.idx > 0) { this.idx--; this.save(); return this.stack[this.idx]; }
    return null;
  },
  redo() {
    if (this.idx < this.stack.length - 1) { this.idx++; this.save(); return this.stack[this.idx]; }
    return null;
  },
  current() { return (this.idx >= 0 ? this.stack[this.idx] : null); }
};

function updateHistoryUi() {
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
function drawToDataUrl(img, w, h, type, quality){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
  return Promise.resolve(c.toDataURL(type, quality));
}
function drawCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, ctx: c.getContext('2d') };
}

// Compression to avoid 413
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
      const du = await drawToDataUrl(img, w, h, 'image/jpeg', q);
      const bytes = dataUrlBytes(du);
      if (bytes < best.bytes) best = { du, bytes, w, h, q };
      if (bytes <= TARGET_MAX_BYTES) return { du, bytes, w, h, q, natural };
      q -= stepQ;
    }
    q = qualityStart; edge -= stepEdge;
  }
  return { ...best, natural };
}

// ===== Outcrop (double-pad) =====
async function buildOutcrop2x(sourceDu, side='right', frac=0.2) {
  const img = await showImage(sourceDu);
  const W = img.naturalWidth, H = img.naturalHeight;
  const pad = Math.max(1, Math.round((side === 'left' || side === 'right' ? W : H) * frac));
  let newW = W, newH = H, dx = 0, dy = 0;

  if (side === 'left' || side === 'right') {
    newW = W + 2 * pad;
    dx = (side === 'left') ? 2 * pad : 0; // original offset
  } else {
    newH = H + 2 * pad;
    dy = (side === 'top') ? 2 * pad : 0;
  }

  const { c, ctx } = drawCanvas(newW, newH);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, newW, newH);
  ctx.drawImage(img, dx, dy);

  const fullDu = c.toDataURL('image/png'); // exact black
  const compressed = await compressDataUrl(fullDu);
  const normRect = { l: dx/newW, t: dy/newH, r: (dx+W)/newW, b: (dy+H)/newH };

  return {
    pad, side,
    full: { du: fullDu, w: newW, h: newH },
    upload: { du: compressed.du, w: compressed.w, h: compressed.h },
    source: { w: W, h: H },
    normRect
  };
}

// Compose: take ONLY inner-half (adjacent strip) from generated image and blend over original with a small fade.
async function composeOutcropBack(sourceDu, genDu, details, fadePx = 24) {
  const { pad, side, full, upload, source } = details;
  const srcImg = await showImage(sourceDu);
  const genImg = await showImage(genDu);

  // Scale from upload -> full geometry
  const sx = full.w / upload.w;
  const sy = full.h / upload.h;

  // Crop rectangle (in upload-space) for the inner-half of blank area
  let crop = { x:0, y:0, w:0, h:0 };
  if (side === 'left') {
    crop = { x: Math.round(pad / sx), y: 0, w: Math.round(pad / sx), h: upload.h };
  } else if (side === 'right') {
    const start = Math.round((source.w + 0) / sx); // inner half immediately after original
    crop = { x: start, y: 0, w: Math.round(pad / sx), h: upload.h };
  } else if (side === 'top') {
    crop = { x: 0, y: Math.round(pad / sy), w: upload.w, h: Math.round(pad / sy) };
  } else { // bottom
    const startY = Math.round((source.h + 0) / sy);
    crop = { x: 0, y: startY, w: upload.w, h: Math.round(pad / sy) };
  }

  // Final canvas size: original + pad on chosen side
  const finalW = (side === 'left' || side === 'right') ? source.w + pad : source.w;
  const finalH = (side === 'top' || side === 'bottom') ? source.h + pad : source.h;

  const { c: extLayer, ctx: extCtx } = drawCanvas(finalW, finalH);
  const { c: origLayer, ctx: origCtx } = drawCanvas(finalW, finalH);
  const { c: out, ctx } = drawCanvas(finalW, finalH);

  // Draw extension crop, scaled to pad width/height
  if (side === 'left') {
    extCtx.drawImage(genImg, crop.x, crop.y, crop.w, crop.h, 0, 0, pad, source.h);
    origCtx.drawImage(srcImg, pad, 0);
    // Feather the seam on the original layer (left edge)
    const g = origCtx.createLinearGradient(pad - fadePx, 0, pad, 0);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    origCtx.globalCompositeOperation = 'destination-out';
    origCtx.fillStyle = g;
    origCtx.fillRect(pad - fadePx, 0, fadePx, source.h);
    origCtx.globalCompositeOperation = 'source-over';
  } else if (side === 'right') {
    extCtx.drawImage(genImg, crop.x, crop.y, crop.w, crop.h, source.w, 0, pad, source.h);
    origCtx.drawImage(srcImg, 0, 0);
    const seamX = source.w;
    const g = origCtx.createLinearGradient(seamX, 0, seamX + fadePx, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    origCtx.globalCompositeOperation = 'destination-out';
    origCtx.fillStyle = g;
    origCtx.fillRect(seamX, 0, fadePx, source.h);
    origCtx.globalCompositeOperation = 'source-over';
  } else if (side === 'top') {
    extCtx.drawImage(genImg, crop.x, crop.y, crop.w, crop.h, 0, 0, source.w, pad);
    origCtx.drawImage(srcImg, 0, pad);
    const g = origCtx.createLinearGradient(0, pad - fadePx, 0, pad);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    origCtx.globalCompositeOperation = 'destination-out';
    origCtx.fillStyle = g;
    origCtx.fillRect(0, pad - fadePx, source.w, fadePx);
    origCtx.globalCompositeOperation = 'source-over';
  } else { // bottom
    extCtx.drawImage(genImg, crop.x, crop.y, crop.w, crop.h, 0, source.h, source.w, pad);
    origCtx.drawImage(srcImg, 0, 0);
    const seamY = source.h;
    const g = origCtx.createLinearGradient(0, seamY, 0, seamY + fadePx);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    origCtx.globalCompositeOperation = 'destination-out';
    origCtx.fillStyle = g;
    origCtx.fillRect(0, seamY, source.w, fadePx);
    origCtx.globalCompositeOperation = 'source-over';
  }

  // Compose: extension below, faded original above
  ctx.drawImage(extLayer, 0, 0);
  ctx.drawImage(origLayer, 0, 0);

  return out.toDataURL('image/png');
}

// ===== UI wiring =====
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
  els.meta.textContent = `${file.name} — ${state.natural.w}×${state.natural.h} • ${prettyBytes(file.size)}`;
  els.preview.querySelector('span')?.remove();
  els.download.disabled = true;
  setLog('');
}

// Toggle outcrop controls
function updateModeUI() { els.outcropControls.style.display = (els.mode.value === 'outcrop') ? 'grid' : 'none'; }
els.mode.addEventListener('change', updateModeUI);

// Drag/drop & paste
els.file.addEventListener('change', e => handleFile(e.target.files?.[0]));
['dragenter','dragover'].forEach(t => els.drop.addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); els.drop.style.borderColor = '#4b7bf7'; }));
['dragleave','drop'].forEach(t => els.drop.addEventListener(t, e => {
  e.preventDefault(); e.stopPropagation(); els.drop.style.borderColor = 'var(--border)';
  if (t==='drop') handleFile(e.dataTransfer.files?.[0]);
}));
window.addEventListener('paste', async (e)=>{
  const item = [...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));
  if (item){ const file = item.getAsFile(); await handleFile(file); }
});

// Click-to-focus (retouch)
els.img.addEventListener('click', pickHotspot);
els.preview.addEventListener('click', ev => { if(ev.target===els.preview) els.file.click(); });

// Clear & Download
els.clear.addEventListener('click', ()=>{
  state = { workingDu:null, uploadDu:null, natural:{w:0,h:0}, hotspot:null };
  History.stack = []; History.idx = -1; History.save();
  els.img.src=''; els.img.style.display='none'; els.dot.style.display='none';
  els.meta.textContent=''; els.out.src=''; els.out.style.display='none';
  els.download.disabled=true; setLog(''); els.prog.value = 0; els.prog.style.display='none';
});
els.download.addEventListener('click', ()=>{
  const a=document.createElement('a'); a.download='pixshop.png'; a.href=els.out.src; a.click();
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
  els.out.src=''; els.out.style.display='none'; els.download.disabled = true;
});
els.redo.addEventListener('click', async ()=>{
  const du = History.redo(); if (!du) return;
  state.workingDu = du;
  const im = await showImage(du);
  state.natural = { w: im.naturalWidth, h: im.naturalHeight };
  const compressed = await compressDataUrl(du);
  state.uploadDu = compressed.du;
  els.img.src = du; els.img.style.display='block';
  els.out.src=''; els.out.style.display='none'; els.download.disabled = true;
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
  try { json = JSON.parse(chunks); } catch (e) {
    console.error('Parse error', e, chunks);
    throw new Error('Response parse error');
  }

  const tEnd = performance.now();
  appendLog(`Done in ${(tEnd - t0).toFixed(0)} ms. Model: ${json?.model || ''}`);
  return json;
}

// ===== Run =====
els.run.addEventListener('click', async ()=>{
  if (!state.workingDu){ alert('Add an image first'); return; }
  setBusy(true); setLog('');

  try{
    const mode = els.mode.value;
    let imageForApi = state.uploadDu;
    let payloadExtra = {};

    if (mode === 'outcrop') {
      const side = els.out_side.value;
      const frac = parseFloat(els.out_amount.value);
      appendLog(`Building outcrop (double-pad): side=${side}, amount=${(frac*100).toFixed(0)}%`);
      // Build from full-res working image, then compress for upload
      const built = await buildOutcrop2x(state.workingDu, side, frac);
      imageForApi = built.upload.du;
      appendLog(`Outcrop canvas: ${built.full.w}×${built.full.h} (upload ~${built.upload.w}×${built.upload.h}, ~${prettyBytes(dataUrlBytes(imageForApi))})`);
      payloadExtra = { outcrop: { side, frac, normRect: built.normRect } };

      const res = await callApiStreaming({
        mode, prompt: els.prompt.value.trim(), image: imageForApi, ...payloadExtra
      });

      const genDu = res?.dataUrl;
      if(!genDu) throw new Error('No image returned');
      const finalDu = await composeOutcropBack(state.workingDu, genDu, built);

      // Update UI and history — final becomes new working image
      state.workingDu = finalDu;
      const im = await showImage(finalDu);
      state.natural = { w: im.naturalWidth, h: im.naturalHeight };
      const compressed = await compressDataUrl(finalDu);
      state.uploadDu = compressed.du;

      History.push(finalDu);
      els.img.src = finalDu; els.img.style.display='block';
      els.out.src = finalDu; els.out.style.display='block';
      els.download.disabled=false;
      appendLog(`Applied extension → new size ${state.natural.w}×${state.natural.h}`);
      return;
    }

    // Non-outcrop modes (still show in Result, but do not replace working image yet)
    const res = await callApiStreaming({
      mode, prompt: els.prompt.value.trim(), image: imageForApi, hotspot: (mode === 'retouch') ? state.hotspot : undefined
    });
    const du = res?.dataUrl;
    if(!du) throw new Error('No image returned');
    els.out.src = du; els.out.style.display='block'; els.download.disabled=false;

  }catch(e){
    console.error(e);
    appendLog('Error: ' + (e?.message || String(e)));
  }finally{
    setBusy(false);
  }
});

// Initialize UI state
History.load(); updateHistoryUi();
function updateModeUI(){ els.outcropControls.style.display = (els.mode.value === 'outcrop') ? 'grid' : 'none'; }
updateModeUI();
