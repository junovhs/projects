// projects/pages/cat.AI/pixshop/app.js

// ===== DOM =====
const els = Object.fromEntries(
  [
    'file','drop','img','meta','dot','preview','mode','prompt','run','clear',
    'out','download','log','prog','outcropControls','out_side','out_amount',
    'undo','redo','resultPanel','debugPanel','dbg_view','dbg_fade',
    'dbg_apply','dbg_recompose','dbg_close','dbg_canvas','dbg_download_gen'
  ].map(id => [id, document.getElementById(id)])
);

let state = {
  workingDu: null, uploadDu: null, natural: { w:0, h:0 }, hotspot: null,
  preOutcropDu: null, lastInfo: null, lastGenSnippetDu: null
};

// ===== History (undo/redo) =====
const HIST_KEY = 'pixshop_hist_v6';
const History = {
  stack: [], idx: -1, limit: 10,
  load(){ try{ const p=JSON.parse(localStorage.getItem(HIST_KEY)||'null'); if(p){ this.stack=p.stack.slice(-this.limit); this.idx=Math.min(p.idx,this.stack.length-1);} }catch{} updateHistoryUi(); },
  save(){ try{ localStorage.setItem(HIST_KEY, JSON.stringify({stack:this.stack,idx:this.idx})); }catch{} updateHistoryUi(); },
  init(du){ this.stack=[du]; this.idx=0; this.save(); },
  push(du){ if(this.idx<this.stack.length-1) this.stack=this.stack.slice(0,this.idx+1); this.stack.push(du); while(this.stack.length>this.limit) this.stack.shift(); this.idx=this.stack.length-1; this.save(); },
  undo(){ if(this.idx>0){ this.idx--; this.save(); return this.stack[this.idx]; } return null; },
  redo(){ if(this.idx<this.stack.length-1){ this.idx++; this.save(); return this.stack[this.idx]; } return null; }
};
function updateHistoryUi(){ els.undo.disabled=!(History.idx>0); els.redo.disabled=!(History.idx<History.stack.length-1 && History.idx>=0); }

// ===== Utils =====
function setLog(s){ els.log.textContent=s||''; }
function appendLog(s){ els.log.textContent+=(els.log.textContent?'\n':'')+s; }
function setBusy(b){ els.run.disabled=b; document.body.style.cursor=b?'progress':'default'; els.prog.style.display=b?'block':'none'; if(!b) els.prog.value=0; }
function prettyBytes(n){ if(!Number.isFinite(n))return'—'; const u=['B','KB','MB','GB']; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return `${n.toFixed(1)} ${u[i]}`; }
function dataUrlBytes(du){ const i=du.indexOf(','); if(i<0) return 0; const b64=du.slice(i+1); const pad=(b64.endsWith('==')?2:b64.endsWith('=')?1:0); return Math.floor((b64.length*3)/4)-pad; }

function showImage(du){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=du; }); }
function drawCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return { c, ctx:c.getContext('2d') }; }
function drawToDataUrl(img,w,h,type,q){ const {c,ctx}=drawCanvas(w,h); ctx.drawImage(img,0,0,w,h); return c.toDataURL(type,q); }

// compression to avoid 413
const TARGET_MAX_BYTES = 3.5*1024*1024;
async function compressDataUrl(du,{maxEdge=2200,minEdge=1200,qualityStart=0.92,qualityMin=0.65,stepQ=0.08,stepEdge=256}={}){
  const img=await showImage(du); const nat={w:img.naturalWidth,h:img.naturalHeight};
  let edge=Math.min(maxEdge,Math.max(nat.w,nat.h)), q=qualityStart;
  let best={du,bytes:dataUrlBytes(du),w:nat.w,h:nat.h,q:1}; if(best.bytes<=TARGET_MAX_BYTES) return {...best,natural:nat};
  while(edge>=minEdge){
    const s=edge/Math.max(nat.w,nat.h); const w=Math.round(nat.w*s), h=Math.round(nat.h*s);
    while(q>=qualityMin){ const out=drawToDataUrl(img,w,h,'image/jpeg',q); const bytes=dataUrlBytes(out);
      if(bytes<best.bytes) best={du:out,bytes,w,h,q};
      if(bytes<=TARGET_MAX_BYTES) return {du:out,bytes,w,h,q,natural:nat};
      q-=stepQ;
    }
    q=qualityStart; edge-=stepEdge;
  }
  return {...best,natural:nat};
}

// ===== Outcrop snippet builder =====
const YELLOW='#FFFF00';
async function buildOutcropSnippet(sourceDu, side='right', frac=0.2){
  const src=await showImage(sourceDu); const W=src.naturalWidth, H=src.naturalHeight;
  const pad=Math.max(4,Math.round((side==='left'||side==='right'?W:H)*frac));
  const ov =Math.max(24,Math.min(160,Math.round(pad*0.33)));
  const fade=Math.min(64,Math.max(24,Math.floor(ov*0.6)));
  const horiz=(side==='left'||side==='right');
  const snipW=horiz?(pad+ov):W, snipH=horiz?H:(pad+ov);

  const {c,ctx}=drawCanvas(snipW,snipH);
  ctx.fillStyle=YELLOW; ctx.fillRect(0,0,snipW,snipH);
  if(side==='left')      ctx.drawImage(src,0,0,ov,H,pad,0,ov,H);
  else if(side==='right')ctx.drawImage(src,W-ov,0,ov,H,0,0,ov,H);
  else if(side==='top')  ctx.drawImage(src,0,0,W,ov,0,pad,W,ov);
  else                   ctx.drawImage(src,0,H-ov,W,ov,0,0,W,ov);
  const snippetDu=c.toDataURL('image/png');

  // upload: cap long edge at 1024, remember scale
  const maxEdge=1024, scale=Math.min(1,maxEdge/Math.max(snipW,snipH));
  let uploadDu=snippetDu, upW=snipW, upH=snipH, upScale=1;
  if(scale<1){ const {c:cs,ctx:cx}=drawCanvas(Math.round(snipW*scale),Math.round(snipH*scale));
    const tmp=await showImage(snippetDu); cx.drawImage(tmp,0,0,cs.width,cs.height);
    uploadDu=cs.toDataURL('image/jpeg',0.92); upW=cs.width; upH=cs.height; upScale=scale;
  }

  const finalW=horiz?W+pad:W, finalH=horiz?H:H+pad;
  return { side,pad,ov,fade, snippet:{du:snippetDu,w:snipW,h:snipH}, upload:{du:uploadDu,w:upW,h:upH,scale:upScale}, source:{w:W,h:H}, final:{w:finalW,h:finalH} };
}

// ===== Compose (seam anchored; fade does not move content) =====
async function composeOutcropFromSnippet(baseDu, genSnippetDu, info, opts={}) {
  const { side, pad, ov, snippet, upload, source, final } = info;
  const fade = Math.max(0, Math.round(opts.fade ?? info.fade));
  const view = opts.view || 'composite';

  const baseImg = await showImage(baseDu);
  const genImg  = await showImage(genSnippetDu);

  // 1) Define the crop in UPLOAD space (what part of returned image we want)
  let cropUp = { x:0, y:0, w:0, h:0 };
  if (side==='left') {
    cropUp = { x: 0, y: 0, w: (pad+fade)*(upload.w/snippet.w), h: upload.h };
  } else if (side==='right') {
    const start = Math.max(0, ov - fade); // include fade *into* overlap
    cropUp = { x: start*(upload.w/snippet.w), y: 0, w: (pad+fade)*(upload.w/snippet.w), h: upload.h };
  } else if (side==='top') {
    cropUp = { x: 0, y: 0, w: upload.w, h: (pad+fade)*(upload.h/snippet.h) };
  } else { // bottom
    const startY = Math.max(0, ov - fade);
    cropUp = { x: 0, y: startY*(upload.h/snippet.h), w: upload.w, h: (pad+fade)*(upload.h/snippet.h) };
  }

  // 2) Remap that crop from UPLOAD → RETURNED coordinates
  const kx = genImg.naturalWidth  / upload.w;
  const ky = genImg.naturalHeight / upload.h;
  const srcX = Math.round(cropUp.x * kx);
  const srcY = Math.round(cropUp.y * ky);
  const srcW = Math.round(cropUp.w * kx);
  const srcH = Math.round(cropUp.h * ky);

  // 3) Final canvas & place ORIGINAL
  const { c: out, ctx } = drawCanvas(final.w, final.h);
  if (side==='left')      ctx.drawImage(baseImg, pad, 0);
  else if (side==='right')ctx.drawImage(baseImg, 0, 0);
  else if (side==='top')  ctx.drawImage(baseImg, 0, pad);
  else                    ctx.drawImage(baseImg, 0, 0);

  // 4) Build the extension (pad + fade), WITHOUT shifting when fade changes
  const extW = (side==='left'||side==='right') ? (pad + fade) : source.w;
  const extH = (side==='left'||side==='right') ? source.h     : (pad + fade);

  // Unmasked extension
  const { c: extRaw, ctx: exRaw } = drawCanvas(extW, extH);
  exRaw.drawImage(genImg, srcX, srcY, srcW, srcH, 0, 0, extW, extH);

  // Masked copy with seam-anchored gradient
  const { c: extMasked, ctx: ex } = drawCanvas(extW, extH);
  ex.drawImage(extRaw, 0, 0);
  ex.globalCompositeOperation = 'destination-in';

  if (side==='left') {
    // Seam at local x = pad (extension is left of seam)
    const g = ex.createLinearGradient(pad, 0, pad + Math.max(1, fade), 0);
    g.addColorStop(0, 'rgba(0,0,0,1)');   // fully visible at seam
    g.addColorStop(1, 'rgba(0,0,0,0)');   // fade out into overlap
    ex.fillStyle = g; ex.fillRect(0,0,extW,extH);
  } else if (side==='right') {
    // Seam at local x = pad (extension is right of seam)
    const g = ex.createLinearGradient(Math.max(0, pad - fade), 0, pad, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');   // far in overlap
    g.addColorStop(1, 'rgba(0,0,0,1)');   // fully visible at seam
    ex.fillStyle = g; ex.fillRect(0,0,extW,extH);
  } else if (side==='top') {
    const g = ex.createLinearGradient(0, pad, 0, pad + Math.max(1, fade));
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ex.fillStyle = g; ex.fillRect(0,0,extW,extH);
  } else { // bottom
    const g = ex.createLinearGradient(0, Math.max(0, pad - fade), 0, pad);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ex.fillStyle = g; ex.fillRect(0,0,extW,extH);
  }
  ex.globalCompositeOperation = 'source-over';

  // 5) Place extension so SEAM NEVER MOVES with fade
  const placeX =
    side==='left'  ? 0 :
    side==='right' ? (source.w - pad) :
    0;
  const placeY =
    side==='top'    ? 0 :
    side==='bottom' ? (source.h - pad) :
    0;

  // Final composite or debug views
  if (view==='original') {
    // original only (already drawn)
  } else if (view==='extMasked') {
    ctx.drawImage(extMasked, placeX, placeY);
  } else if (view==='extensionUnmasked') {
    ctx.drawImage(extRaw, placeX, placeY);
  } else if (view==='mask') {
    const { c: mC, ctx: mX } = drawCanvas(extW, extH);
    mX.drawImage(extMasked, 0, 0);
    const imgD = mX.getImageData(0,0,extW,extH);
    for (let i=0;i<imgD.data.length;i+=4){ const a=imgD.data[i+3]; imgD.data[i]=imgD.data[i+1]=imgD.data[i+2]=a; imgD.data[i+3]=255; }
    mX.putImageData(imgD,0,0);
    ctx.drawImage(mC, placeX, placeY);
  } else if (view==='snippet') {
    const sn = await showImage(info.snippet.du); ctx.drawImage(sn, 0, 0);
  } else if (view==='gen') {
    const gn = await showImage(genSnippetDu); ctx.drawImage(gn, 0, 0);
  } else {
    ctx.drawImage(extMasked, placeX, placeY);
  }

  return out.toDataURL('image/png');
}

// ===== UI wiring =====
function placeDot(x,y){ els.dot.style.display='block'; els.dot.style.left=(x*100)+'%'; els.dot.style.top=(y*100)+'%'; }
function pickHotspot(ev){ const r=els.img.getBoundingClientRect(); const x=(ev.clientX-r.left)/r.width, y=(ev.clientY-r.top)/r.height; state.hotspot={x:Math.max(0,Math.min(1,x)), y:Math.max(0,Math.min(1,y))}; placeDot(state.hotspot.x,state.hotspot.y); }
function fileToDataUrl(f){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(f); }); }
async function handleFile(file){
  if(!file) return;
  const du = await fileToDataUrl(file);
  const im = await showImage(du);
  state.workingDu=du; state.natural={w:im.naturalWidth,h:im.naturalHeight};
  state.uploadDu=(await compressDataUrl(du)).du;
  History.init(du);
  els.img.src=du; els.img.style.display='block';
  els.meta.textContent=`${state.natural.w}×${state.natural.h} • ~${prettyBytes(dataUrlBytes(du))}`;
  const sp=els.preview.querySelector('span'); if(sp) sp.remove();
  els.download.disabled=true; setLog(''); hideDebug(); updateModeUI();
}
function updateModeUI(){ const isOut=(els.mode.value==='outcrop'); els.outcropControls.style.display=isOut?'grid':'none'; els.resultPanel.style.display=isOut?'none':'block'; }
els.mode.addEventListener('change',updateModeUI);

els.file.addEventListener('change',e=>handleFile(e.target.files?.[0]));
els.preview.addEventListener('click',e=>{ if(e.target!==els.img) els.file.click(); });
['dragenter','dragover'].forEach(t=>[document,els.drop,els.file].forEach(el=>el.addEventListener(t,e=>{e.preventDefault();e.stopPropagation();els.drop.style.borderColor='#4b7bf7';})));
['dragleave','drop'].forEach(t=>[document,els.drop,els.file].forEach(el=>el.addEventListener(t,e=>{e.preventDefault();e.stopPropagation();els.drop.style.borderColor='var(--border)'; if(t==='drop') handleFile((e.dataTransfer?.files?.[0])||(e.target?.files?.[0]));})));
window.addEventListener('paste',async e=>{ const it=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/')); if(it){ await handleFile(it.getAsFile()); }});
els.img.addEventListener('click',pickHotspot);

function hideDebug(){ els.debugPanel.style.display='none'; els.dbg_canvas.width=0; els.dbg_canvas.height=0; state.preOutcropDu=null; }
els.clear.addEventListener('click',()=>{ state={...state,workingDu:null,uploadDu:null,natural:{w:0,h:0},hotspot:null,preOutcropDu:null,lastInfo:null,lastGenSnippetDu:null}; History.stack=[]; History.idx=-1; History.save(); els.img.src=''; els.img.style.display='none'; els.dot.style.display='none'; els.meta.textContent=''; els.out.src=''; els.out.style.display='none'; els.download.disabled=true; setLog(''); els.prog.value=0; els.prog.style.display='none'; hideDebug(); });
els.download.addEventListener('click',()=>{ const a=document.createElement('a'); a.download='pixshop.png'; a.href=els.img.src||els.out.src; a.click(); });

els.undo.addEventListener('click',async()=>{ const du=History.undo(); if(!du)return; state.workingDu=du; const im=await showImage(du); state.natural={w:im.naturalWidth,h:im.naturalHeight}; state.uploadDu=(await compressDataUrl(du)).du; els.img.src=du; els.img.style.display='block'; els.out.src=''; els.out.style.display='none'; els.download.disabled=false; hideDebug(); });
els.redo.addEventListener('click',async()=>{ const du=History.redo(); if(!du)return; state.workingDu=du; const im=await showImage(du); state.natural={w:im.naturalWidth,h:im.naturalHeight}; state.uploadDu=(await compressDataUrl(du)).du; els.img.src=du; els.img.style.display='block'; els.out.src=''; els.out.style.display='none'; els.download.disabled=false; hideDebug(); });

// API
async function callApiStreaming(payload){
  const KEY='ai-pass'; let pass=sessionStorage.getItem(KEY)||window.prompt('Enter AI API password'); if(!pass) throw new Error('No password'); sessionStorage.setItem(KEY,pass);
  const t0=performance.now(); appendLog('Preparing request…');
  const body=JSON.stringify(payload); const approxUpload=new Blob([body]).size; appendLog(`Upload payload ~${prettyBytes(approxUpload)} (includes base64 image & JSON)`);
  const t1=performance.now(); const res=await fetch('/api/pixshop-image',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${pass}`},body});
  const tTFB=performance.now(); appendLog(`TTFB: ${(tTFB-t1).toFixed(0)} ms (server + network)`);
  const reader=res.body?.getReader?.(); const decoder=new TextDecoder(); let received=0, chunks='';
  if(reader){ while(true){ const {done,value}=await reader.read(); if(done)break; received+=value.byteLength; chunks+=decoder.decode(value,{stream:true}); if(received%(128*1024)<8192) appendLog(`Downloading… ${prettyBytes(received)}`);} chunks+=decoder.decode(); }
  else chunks=await res.text();
  if(!res.ok){ let m=chunks; try{ const p=JSON.parse(chunks); m=p?.error||p?.details||chunks; }catch{} if(res.status===413) throw new Error('413: Payload too large.'); throw new Error(`${res.status}: ${m}`); }
  let json; try{ json=JSON.parse(chunks); }catch{ throw new Error('Response parse error'); }
  appendLog(`Done in ${(performance.now()-t0).toFixed(0)} ms. Model: ${json?.model||''}`); return json;
}

// Debug panel
function showDebug(defaults){
  els.debugPanel.style.display='block';
  els.dbg_view.value = defaults.view || 'composite';
  els.dbg_fade.value = defaults.fade;

  const rerender = async () => {
    if (!state.lastInfo || !state.lastGenSnippetDu || !state.preOutcropDu) return;
    const fade = Number(els.dbg_fade.value);
    const view = els.dbg_view.value;

    const { w, h } = state.lastInfo.final;
    const cv = els.dbg_canvas, maxW=Math.min(els.debugPanel.clientWidth-24,1100), s=Math.min(1,maxW/w);
    cv.width=Math.round(w*s); cv.height=Math.round(h*s);

    const tmp = await composeOutcropFromSnippet(state.preOutcropDu, state.lastGenSnippetDu, state.lastInfo, { fade, view });
    const img = await showImage(tmp);
    const g = cv.getContext('2d'); g.setTransform(s,0,0,s,0,0); g.clearRect(0,0,w,h); g.drawImage(img,0,0);
  };

  els.dbg_recompose.onclick = rerender;
  els.dbg_fade.oninput = rerender;
  els.dbg_view.onchange = rerender;

  els.dbg_apply.onclick = async () => {
    const fade = Number(els.dbg_fade.value);
    const finalDu = await composeOutcropFromSnippet(state.preOutcropDu, state.lastGenSnippetDu, state.lastInfo, { fade, view:'composite' });
    state.workingDu = finalDu;
    const im = await showImage(finalDu); state.natural = { w: im.naturalWidth, h: im.naturalHeight };
    state.uploadDu=(await compressDataUrl(finalDu)).du;
    History.push(finalDu); els.img.src=finalDu; els.img.style.display='block'; els.download.disabled=false; hideDebug();
  };
  els.dbg_close.onclick = hideDebug;
  els.dbg_download_gen.onclick = () => { const a=document.createElement('a'); a.download='pixshop-returned-snippet.png'; a.href=state.lastGenSnippetDu; a.click(); };

  rerender();
}

// Run
els.run.addEventListener('click', async ()=>{
  if(!state.workingDu){ alert('Add an image first'); return; }
  setBusy(true); setLog('');
  try{
    const mode=els.mode.value;
    if(mode==='outcrop'){
      const side=els.out_side.value; const frac=parseFloat(els.out_amount.value);
      appendLog(`Outcrop (snippet): side=${side}, amount=${(frac*100).toFixed(0)}%`);
      const info=await buildOutcropSnippet(state.workingDu, side, frac);
      appendLog(`Snippet ${info.upload.w}×${info.upload.h} (pad=${info.pad}px, overlap=${info.ov}px, fade=${info.fade}px)`);
      const res=await callApiStreaming({mode:'outcrop', prompt:els.prompt.value.trim(), image:info.upload.du, outcrop:{side,frac,overlapPx:info.ov,maskColor:YELLOW}});
      const genDu=res?.dataUrl; if(!genDu) throw new Error('No image returned');
      state.preOutcropDu=state.workingDu; state.lastInfo=info; state.lastGenSnippetDu=genDu;
      els.out.src=''; els.out.style.display='none';
      showDebug({ fade: info.fade, view: 'composite' });
      setBusy(false); return;
    }
    // non-outcrop
    const res=await callApiStreaming({mode, prompt:els.prompt.value.trim(), image:state.uploadDu, hotspot:(mode==='retouch')?state.hotspot:undefined});
    const du=res?.dataUrl; if(!du) throw new Error('No image returned');
    els.out.src=du; els.out.style.display='block'; els.download.disabled=false;
  }catch(e){ console.error(e); appendLog('Error: '+(e?.message||String(e))); }
  finally{ setBusy(false); }
});

// Init
History.load(); updateModeUI();
