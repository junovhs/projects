// projects/pages/cat.AI/pixshop/app.js

// ===== DOM =====
const els = Object.fromEntries(
  ['file','drop','img','meta','dot','preview','mode','prompt','run','clear','out','download','log','prog','outcropControls','out_side','out_amount','undo','redo','resultPanel']
    .map(id => [id, document.getElementById(id)])
);

let state = {
  workingDu: null,            // current main image (what grows)
  uploadDu: null,             // compressed copy for API
  natural: { w:0, h:0 },
  hotspot: null
};

// ===== History (undo/redo, localStorage) =====
const HIST_KEY = 'pixshop_hist_v2';
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
    updateHistoryUi();
  },
  save() {
    try { localStorage.setItem(HIST_KEY, JSON.stringify({ stack:this.stack, idx:this.idx })); } catch {}
    updateHistoryUi();
  },
  init(du) { this.stack=[du]; this.idx=0; this.save(); },
  push(du) {
    if (this.idx < this.stack.length - 1) this.stack = this.stack.slice(0, this.idx + 1);
    this.stack.push(du);
    while (this.stack.length > this.limit) this.stack.shift();
    this.idx = this.stack.length - 1; this.save();
  },
  undo() { if (this.idx > 0) { this.idx--; this.save(); return this.stack[this.idx]; } return null; },
  redo() { if (this.idx < this.stack.length - 1) { this.idx++; this.save(); return this.stack[this.idx]; } return null; },
  current(){ return (this.idx >= 0 ? this.stack[this.idx] : null); }
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
function drawCanvas(w, h) { const c = document.createElement('canvas'); c.width=w; c.height=h; return { c, ctx: c.getContext('2d') }; }

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

// ===== Build outcrop SNIPPET (overlap + yellow mask) =====
const YELLOW = '#FFFF00';
// returns: { snippet:{du,w,h}, uploadDu, pad, ov, fade, side, final:{w,h}, map:{} }
async function buildOutcropSnippet(sourceDu, side='right', frac=0.2) {
  const src = await showImage(sourceDu);
  const W = src.naturalWidth, H = src.naturalHeight;
  const pad = Math.max(4, Math.round((side === 'left' || side === 'right' ? W : H) * frac)); // pixels to GROW
  const ov = Math.max(24, Math.min(160, Math.round(pad * 0.33))); // overlap pixels to show
  const fade = Math.min(48, Math.floor(ov * 0.6));                // crossfade inside overlap

  // Snippet logical size BEFORE any scaling (horizontal case: width = pad + ov, height = H)
  let snipW = (side === 'left' || side === 'right') ? (pad + ov) : W;
  let snipH = (side === 'left' || side === 'right') ? H : (pad + ov);

  // Build snippet: yellow fill + copy of overlap from original
  const { c, ctx } = drawCanvas(snipW, snipH);
  ctx.fillStyle = YELLOW; ctx.fillRect(0,0,snipW,snipH);

  if (side === 'left') {
    // copy rightmost ov pixels from original into snippet's right ov area
    ctx.drawImage(src, 0, 0, ov, H, pad, 0, ov, H);
  } else if (side === 'right') {
    // copy leftmost ov pixels into snippet's left ov area
    ctx.drawImage(src, W - ov, 0, ov, H, 0, 0, ov, H);
  } else if (side === 'top') {
    // copy bottom ov pixels into snippet's bottom ov area
    ctx.drawImage(src, 0, 0, W, ov, 0, pad, W, ov);
  } else { // bottom
    // copy top ov pixels into snippet's top ov area
    ctx.drawImage(src, 0, H - ov, W, ov, 0, 0, W, ov);
  }

  let snippetDu = c.toDataURL('image/png');

  // Limit snippet payload to ~1024 on long edge for the API (keeps cost+speed, helps alignment)
  const maxSnippetEdge = 1024;
  const scale = Math.min(1, maxSnippetEdge / Math.max(snipW, snipH));
  let uploadDu = snippetDu, upW = snipW, upH = snipH, upScale = 1;
  if (scale < 1) {
    const { c: cs, ctx: cstx } = drawCanvas(Math.round(snipW*scale), Math.round(snipH*scale));
    const tmp = new Image(); tmp.src = snippetDu; await new Promise(r => tmp.onload=r);
    cstx.drawImage(tmp, 0, 0, cs.width, cs.height);
    uploadDu = cs.toDataURL('image/jpeg', 0.92);
    upW = cs.width; upH = cs.height; upScale = scale;
  }

  // Final grown image size
  const finalW = (side === 'left' || side === 'right') ? W + pad : W;
  const finalH = (side === 'left' || side === 'right') ? H : H + pad;

  return {
    side, pad, ov, fade,
    snippet: { du: snippetDu, w: snipW, h: snipH },
    upload: { du: uploadDu, w: upW, h: upH, scale: upScale },
    source: { w: W, h: H },
    final: { w: finalW, h: finalH }
  };
}

// Compose: take pad (+fade) from generated snippet and blend with original into a larger canvas
async function composeOutcropFromSnippet(originalDu, genSnippetDu, info) {
  const { side, pad, ov, fade, snippet, upload, source, final } = info;
  const srcImg = await showImage(originalDu);
  const genImg = await showImage(genSnippetDu);

  // crop from the GENERATED snippet (coords in upload space; gen == upload dims)
  const crop = { x:0, y:0, w:0, h:0 };
  if (side === 'left') {
    // yellow area was [0..pad]; take pad+fade so we can underlap+blend
    crop.x = 0; crop.y = 0;
    crop.w = Math.round((pad + fade) * (upload.w / snippet.w));
    crop.h = upload.h;
  } else if (side === 'right') {
    // yellow area was [ov..ov+pad] in snippet
    crop.x = Math.round(ov * (upload.w / snippet.w)); crop.y = 0;
    crop.w = Math.round((pad + fade) * (upload.w / snippet.w));
    crop.h = upload.h;
  } else if (side === 'top') {
    crop.x = 0; crop.y = 0;
    crop.w = upload.w;
    crop.h = Math.round((pad + fade) * (upload.h / snippet.h));
  } else { // bottom
    crop.x = 0; crop.y = Math.round(ov * (upload.h / snippet.h));
    crop.w = upload.w;
    crop.h = Math.round((pad + fade) * (upload.h / snippet.h));
  }

  // final canvas
  const { c: out, ctx } = (() => {
    const c = document.createElement('canvas'); c.width = final.w; c.height = final.h;
    return { c, ctx: c.getContext('2d') };
  })();

  // draw ORIGINAL first (never punch holes in it)
  if (side === 'left') ctx.drawImage(srcImg, pad, 0);
  else if (side === 'right') ctx.drawImage(srcImg, 0, 0);
  else if (side === 'top') ctx.drawImage(srcImg, 0, pad);
  else ctx.drawImage(srcImg, 0, 0);

  // build EXTENSION layer (pad+fade) and apply a gradient MASK on the extension itself
  const extW = (side === 'left' || side === 'right') ? (pad + fade) : source.w;
  const extH = (side === 'left' || side === 'right') ? source.h : (pad + fade);
  const extC = document.createElement('canvas'); extC.width = extW; extC.height = extH;
  const extX = extC.getContext('2d');

  // draw the generated crop scaled into the extension layer
  extX.drawImage(genImg, crop.x, crop.y, crop.w, crop.h, 0, 0, extW, extH);

  // create alpha mask on the EXTENSION:
  // - alpha = 1 away from seam
  // - alpha -> 0 approaching seam (across "fade" px)
  extX.globalCompositeOperation = 'destination-in';
  const mask = extX.createLinearGradient(
    ...(side === 'left'  ? [extW - fade, 0, extW, 0] :
       side === 'right' ? [0, 0, fade, 0] :
       side === 'top'   ? [0, extH - fade, 0, extH] :
                          [0, 0, 0, fade])
  );
  // opaque far from seam
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  // transparent right at the seam edge
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  extX.fillStyle = mask;
  extX.fillRect(0, 0, extW, extH);
  extX.globalCompositeOperation = 'source-over';

  // place extension UNDER the seam with a slight underlap so gradient crosses the join
  if (side === 'left')      ctx.drawImage(extC, 0, 0);                 // original starts at x=pad
  else if (side === 'right')ctx.drawImage(extC, source.w - fade, 0);   // overlap onto original by fade
  else if (side === 'top')  ctx.drawImage(extC, 0, 0);
  else                      ctx.drawImage(extC, 0, source.h - fade);

  return out.toDataURL('image/png');
}
  const { side, pad, ov, fade, snippet, upload, source, final } = info;
  const srcImg = await showImage(originalDu);
  const genImg = await showImage(genSnippetDu);

  // Where to crop from GENERATED snippet (in upload-space)
  // We need pad + fade width of generated area (so the extension continues under the blend)
  const crop = { x:0, y:0, w:0, h:0 };
  if (side === 'left') {
    // yellow was on the LEFT => generated content fills [0 .. pad] (+ a bit of overlap)
    crop.x = 0; crop.y = 0; crop.w = Math.round((pad + fade) * (upload.w / snippet.w)); crop.h = upload.h;
  } else if (side === 'right') {
    // yellow on RIGHT => generated content fills [ov .. ov+pad]
    crop.x = Math.round(ov * (upload.w / snippet.w));
    crop.y = 0; crop.w = Math.round((pad + fade) * (upload.w / snippet.w)); crop.h = upload.h;
  } else if (side === 'top') {
    crop.x = 0; crop.y = 0; crop.w = upload.w; crop.h = Math.round((pad + fade) * (upload.h / snippet.h));
  } else { // bottom
    crop.x = 0; crop.y = Math.round(ov * (upload.h / snippet.h));
    crop.w = upload.w; crop.h = Math.round((pad + fade) * (upload.h / snippet.h));
  }

  // Final canvas
  const { c: out, ctx } = drawCanvas(final.w, final.h);

  if (side === 'left' || side === 'right') {
    // Draw extension strip scaled to pad(+fade) × H
    const extW = pad + fade, extH = source.h;
    const { c: extLayer, ctx: extCtx } = drawCanvas(extW, extH);
    extCtx.drawImage(genImg, crop.x, crop.y, crop.w, crop.h, 0, 0, extW, extH);

    // Place extension
    const placeX = (side === 'left') ? 0 : source.w - fade;
    ctx.drawImage(extLayer, placeX, 0);

    // Draw original with feathered edge
    if (side === 'left') {
      // original shifted right by pad
      ctx.drawImage(srcImg, pad, 0);
      const g = ctx.createLinearGradient(pad - fade, 0, pad, 0);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = g; ctx.fillRect(pad - fade, 0, fade, source.h);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // extension underlaps by fade, original at x=0
      ctx.drawImage(srcImg, 0, 0);
      const seamX = source.w;
      const g = ctx.createLinearGradient(seamX, 0, seamX + fade, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = g; ctx.fillRect(seamX, 0, fade, source.h);
      ctx.globalCompositeOperation = 'source-over';
    }
  } else {
    // vertical
    const extW = source.w, extH = pad + fade;
    const { c: extLayer, ctx: extCtx } = drawCanvas(extW, extH);
    extCtx.drawImage(genImg, crop.x, crop.y, crop.w, crop.h, 0, 0, extW, extH);

    const placeY = (side === 'top') ? 0 : source.h - fade;
    ctx.drawImage(extLayer, 0, placeY);

    if (side === 'top') {
      ctx.drawImage(srcImg, 0, pad);
      const g = ctx.createLinearGradient(0, pad - fade, 0, pad);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = g; ctx.fillRect(0, pad - fade, source.w, fade);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.drawImage(srcImg, 0, 0);
      const seamY = source.h;
      const g = ctx.createLinearGradient(0, seamY, 0, seamY + fade);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = g; ctx.fillRect(0, seamY, source.w, fade);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  return out.toDataURL('image/png');
}

// ===== UI =====
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
  els.preview.querySelector('span')?.remove();
  els.download.disabled = true;
  setLog('');
  updateModeUI();
}

function updateModeUI(){
  const isOutcrop = (els.mode.value === 'outcrop');
  els.outcropControls.style.display = isOutcrop ? 'grid' : 'none';
  // Hide result panel on outcrop to avoid duplicate image
  els.resultPanel.style.display = isOutcrop ? 'none' : 'block';
}
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

    if (mode === 'outcrop') {
      const side = els.out_side.value;
      const frac = parseFloat(els.out_amount.value);
      appendLog(`Outcrop (snippet): side=${side}, amount=${(frac*100).toFixed(0)}%`);

      // Build snippet (overlap + yellow mask), send to API
      const info = await buildOutcropSnippet(state.workingDu, side, frac);
      appendLog(`Snippet ${info.upload.w}×${info.upload.h} (pad=${info.pad}px, overlap=${info.ov}px, fade=${info.fade}px)`);

      const res = await callApiStreaming({
        mode: 'outcrop',
        prompt: els.prompt.value.trim(),
        image: info.upload.du,
        outcrop: { side, frac, overlapPx: info.ov, maskColor: YELLOW }
      });

      const genDu = res?.dataUrl;
      if(!genDu) throw new Error('No image returned');

      // Compose back to a grown image (replace main image)
      const finalDu = await composeOutcropFromSnippet(state.workingDu, genDu, info);

      state.workingDu = finalDu;
      const im = await showImage(finalDu);
      state.natural = { w: im.naturalWidth, h: im.naturalHeight };
      const compressed = await compressDataUrl(finalDu);
      state.uploadDu = compressed.du;

      History.push(finalDu);
      els.img.src = finalDu; els.img.style.display='block';
      els.download.disabled=false;

      // No duplicate “Result” image in outcrop mode
      els.out.src=''; els.out.style.display='none';

      appendLog(`Applied extension → new size ${state.natural.w}×${state.natural.h}`);
      return;
    }

    // Non-outcrop modes → show result below but do NOT replace main unless you decide to
    const res = await callApiStreaming({
      mode, prompt: els.prompt.value.trim(),
      image: state.uploadDu,
      hotspot: (mode === 'retouch') ? state.hotspot : undefined
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

// Init
History.load(); updateModeUI();
