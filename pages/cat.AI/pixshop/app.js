// projects/pages/cat.AI/pixshop/app.js

// ===== DOM =====
const els = Object.fromEntries(
  ['file','drop','img','meta','dot','preview','mode','prompt','run','clear','out','download','log','prog']
    .map(id => [id, document.getElementById(id)])
);

let state = { dataUrl: null, natural:{w:0,h:0}, hotspot:null };

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
  const u=['B','KB','MB','GB']; let i=0;
  while(n>=1024 && i<u.length-1){ n/=1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

// ===== Size helpers =====
function dataUrlBytes(dataUrl){
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i+1);
  // base64 -> bytes (rough): len * 3/4 - padding
  const len = b64.length;
  const padding = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  return Math.floor((len * 3) / 4) - padding;
}

// ===== Image compression (to avoid 413 on Vercel) =====
// Target under ~3.5 MB to leave room for JSON wrapping, etc.
const TARGET_MAX_BYTES = 3.5 * 1024 * 1024;
async function compressDataUrl(inputDataUrl, {
  maxEdge = 2048,
  minEdge = 1024,
  qualityStart = 0.92,
  qualityMin = 0.65,
  stepQ = 0.08,
  stepEdge = 256
} = {}) {
  const img = await showImage(inputDataUrl);
  const natural = { w: img.naturalWidth, h: img.naturalHeight };
  let edge = Math.min(maxEdge, Math.max(natural.w, natural.h));
  let q = qualityStart;

  let best = { du: inputDataUrl, bytes: dataUrlBytes(inputDataUrl), w: natural.w, h: natural.h, q: 1 };
  // If already small enough, return original
  if (best.bytes <= TARGET_MAX_BYTES) return { ...best, natural };

  // Iteratively reduce quality, then dimensions
  while (edge >= minEdge) {
    const scale = edge / Math.max(natural.w, natural.h);
    const w = Math.round(natural.w * scale);
    const h = Math.round(natural.h * scale);

    while (q >= qualityMin) {
      const du = await drawToDataUrl(img, w, h, 'image/jpeg', q);
      const bytes = dataUrlBytes(du);
      if (bytes < best.bytes) best = { du, bytes, w, h, q };
      if (bytes <= TARGET_MAX_BYTES) return { du, bytes, w, h, q, natural };
      q -= stepQ;
    }
    q = qualityStart;
    edge -= stepEdge;
  }
  return { ...best, natural }; // return best-effort
}

function drawToDataUrl(img, w, h, type, quality){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return Promise.resolve(c.toDataURL(type, quality));
}

function showImage(dataUrl){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function placeDot(x,y){
  els.dot.style.display='block';
  els.dot.style.left=(x*100)+'%';
  els.dot.style.top=(y*100)+'%';
}

function pickHotspot(ev){
  const r = els.img.getBoundingClientRect();
  const x = (ev.clientX - r.left) / r.width;
  const y = (ev.clientY - r.top) / r.height;
  state.hotspot = { x: Math.max(0,Math.min(1,x)), y: Math.max(0,Math.min(1,y)) };
  placeDot(state.hotspot.x, state.hotspot.y);
}

function fileToDataUrl(file){
  return new Promise((res,rej)=>{
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

async function handleFile(file){
  if (!file) return;
  const originalDu = await fileToDataUrl(file);
  const originalImg = await showImage(originalDu);
  const originalBytes = dataUrlBytes(originalDu);

  // Compress if needed
  appendLog(`Loaded: ${file.name} — ${originalImg.naturalWidth}×${originalImg.naturalHeight} • ${prettyBytes(file.size)} (payload ~${prettyBytes(originalBytes)})`);
  const compressed = await compressDataUrl(originalDu);
  if (compressed.bytes < originalBytes) {
    appendLog(`Compressed for upload → ${compressed.w}×${compressed.h} • payload ~${prettyBytes(compressed.bytes)} (q=${compressed.q?.toFixed?.(2) ?? 1})`);
  } else {
    appendLog('No compression needed.');
  }

  state.dataUrl = compressed.du;
  state.natural = { w: compressed.natural?.w ?? originalImg.naturalWidth, h: compressed.natural?.h ?? originalImg.naturalHeight };

  els.img.src = originalDu; // show original in UI
  els.img.style.display='block';
  els.meta.textContent = `${file.name} — ${state.natural.w}×${state.natural.h} • ${prettyBytes(file.size)}`;
  els.preview.querySelector('span')?.remove();
  els.download.disabled = true;
}

// ===== Drag/drop, paste, click-to-focus, clear & download =====
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

els.img.addEventListener('click', pickHotspot);
els.preview.addEventListener('click', ev => { if(ev.target===els.preview) els.file.click(); });

els.clear.addEventListener('click', ()=>{
  state = { dataUrl:null, natural:{w:0,h:0}, hotspot:null };
  els.img.src=''; els.img.style.display='none'; els.dot.style.display='none';
  els.meta.textContent=''; els.out.src=''; els.out.style.display='none';
  els.download.disabled=true; setLog(''); els.prog.value = 0; els.prog.style.display='none';
});

els.download.addEventListener('click', ()=>{
  const a=document.createElement('a');
  a.download='pixshop.png';
  a.href=els.out.src;
  a.click();
});

// ===== Bypass ai.js and stream response text for progress =====
async function callApiStreaming(payload) {
  // Auth: reuse your pass storage pattern, but do NOT use window.AI.call (it double-reads body)
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

  appendLog(`TTFB: ${(tTFB - t1).toFixed(0)} ms (server time + network)`);

  // Handle non-OK early (but still drain to show any body text)
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

      // Update progress if content-length known
      if (contentLen > 0) {
        const pct = Math.min(100, Math.round((received / contentLen) * 100));
        els.prog.value = pct;
      } else {
        // Fallback: show raw bytes count
        els.prog.value = Math.min(100, Math.round((received % (1024*100)) / (1024)) ); // cycles visually
      }

      // Occasionally log
      if (received % (128 * 1024) < 8192) {
        appendLog(`Downloading… ${prettyBytes(received)}${contentLen ? ' / '+prettyBytes(contentLen) : ''}`);
      }
    }
    // flush decoder
    chunks += decoder.decode();
  } else {
    // If stream not available, fall back to text()
    chunks = await res.text();
  }

  if (!res.ok) {
    let errMsg = chunks;
    try { const parsed = JSON.parse(chunks); errMsg = parsed?.error || parsed?.details || chunks; } catch {}
    if (res.status === 413) {
      // Vercel body limit
      throw new Error('413: Payload too large. Your image was still too big for the server. Try a smaller image or let compression reduce it more.');
    }
    throw new Error(`${res.status}: ${errMsg}`);
  }

  // Parse JSON
  let json;
  try { json = JSON.parse(chunks); } catch (e) {
    console.error('Parse error', e, chunks);
    throw new Error('Response parse error');
  }

  const tEnd = performance.now();
  appendLog(`Done in ${(tEnd - t0).toFixed(0)} ms. Model: ${json?.model || ''}`);

  return json;
}

els.run.addEventListener('click', async ()=>{
  if (!state.dataUrl){ alert('Add an image first'); return; }
  setBusy(true); setLog('');

  try{
    const payload = {
      mode: els.mode.value,
      prompt: els.prompt.value.trim(),
      image: state.dataUrl,       // already compressed if needed
      hotspot: state.hotspot
    };

    const res = await callApiStreaming(payload);
    const du = res?.dataUrl;
    if(!du) throw new Error('No image returned');

    els.out.src = du;
    els.out.style.display='block';
    els.download.disabled=false;
  }catch(e){
    console.error(e);
    appendLog('Error: ' + (e?.message || String(e)));
    if (String(e?.message || '').includes('413')) {
      appendLog('Tip: Large images can exceed Vercel’s 4.5 MB function limit. We auto-compress, but you may need a smaller source or fewer pixels.');
    }
  }finally{
    setBusy(false);
  }
});
