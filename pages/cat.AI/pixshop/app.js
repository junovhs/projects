// projects/pages/cat.AI/pixshop/app.js
const els = Object.fromEntries(['file','drop','img','meta','dot','preview','mode','prompt','run','clear','out','download','log'].map(id=>[id,document.getElementById(id)]));

let state = { dataUrl: null, natural:{w:0,h:0}, hotspot:null };

function setLog(msg){ els.log.textContent = msg || ''; }
function setBusy(b){ els.run.disabled = b; document.body.style.cursor = b ? 'progress' : 'default'; }

function bytes(n){ if(!n) return '0 B'; const u=['B','KB','MB','GB']; let i=0; while(n>999 && i<u.length-1){n/=1024;i++} return n.toFixed(1)+' '+u[i]; }

function showImage(dataUrl){ return new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=dataUrl; }); }

function placeDot(x,y){ els.dot.style.display='block'; els.dot.style.left=(x*100)+'%'; els.dot.style.top=(y*100)+'%'; }

function pickHotspot(ev){ const r = els.img.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width; const y = (ev.clientY - r.top) / r.height; state.hotspot = { x: Math.max(0,Math.min(1,x)), y: Math.max(0,Math.min(1,y)) }; placeDot(state.hotspot.x, state.hotspot.y); }

function fileToDataUrl(file){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); }); }

async function handleFile(file){ if(!file) return; const du = await fileToDataUrl(file); const img = await showImage(du); state.dataUrl = du; state.natural = { w: img.naturalWidth, h: img.naturalHeight }; els.img.src = du; els.img.style.display='block'; els.meta.textContent = `${file.name} — ${state.natural.w}×${state.natural.h} • ${bytes(file.size)}`; els.preview.querySelector('span')?.remove(); els.download.disabled = true; setLog(''); }

// Drag/drop and input
els.file.addEventListener('change', e => handleFile(e.target.files?.[0]));
['dragenter','dragover'].forEach(t => els.drop.addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); els.drop.style.borderColor = '#4b7bf7'; }));
;['dragleave','drop'].forEach(t => els.drop.addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); els.drop.style.borderColor = 'var(--border)'; if(t==='drop') handleFile(e.dataTransfer.files?.[0]); }));

// Paste from clipboard
window.addEventListener('paste', async (e)=>{ const item = [...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/')); if(item){ const file = item.getAsFile(); await handleFile(file); } });

// Click-to-focus
els.img.addEventListener('click', pickHotspot);
els.preview.addEventListener('click', ev => { if(ev.target===els.preview) els.file.click(); });

// Clear + Download
els.clear.addEventListener('click', ()=>{ state={ dataUrl:null, natural:{w:0,h:0}, hotspot:null }; els.img.src=''; els.img.style.display='none'; els.dot.style.display='none'; els.meta.textContent=''; els.out.src=''; els.out.style.display='none'; els.download.disabled=true; setLog(''); });
els.download.addEventListener('click', ()=>{ const a=document.createElement('a'); a.download='pixshop.png'; a.href=els.out.src; a.click(); });

// API call
async function callApi(payload){
  // Prefer your shared helper if present (prompts for AI_API_PASSWORD & attaches Bearer)
  if (window.AI?.call) {
    try { await window.AI.ensurePassword?.(); } catch(e){ throw new Error('Password required'); }
    return await window.AI.call('/api/pixshop-image', payload);
  }
  // Fallback minimal client (sessionStorage like your helper)
  const KEY='ai-pass'; let pass=sessionStorage.getItem(KEY)||window.prompt('Enter AI API password'); if(!pass) throw new Error('No password'); sessionStorage.setItem(KEY,pass);
  const r = await fetch('/api/pixshop-image', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${pass}` }, body:JSON.stringify(payload)});
  if(!r.ok){ let d; try{ d=await r.json(); }catch{ d={ error: await r.text() }; } throw new Error(d?.error||'Request failed'); }
  return await r.json();
}

els.run.addEventListener('click', async ()=>{
  if(!state.dataUrl){ alert('Add an image first'); return; }
  setBusy(true); setLog('Calling Gemini…');
  try{
    const payload = { mode: els.mode.value, prompt: els.prompt.value.trim(), image: state.dataUrl, hotspot: state.hotspot };
    const res = await callApi(payload);
    const du = res?.dataUrl;
    if(!du) throw new Error('No image returned');
    els.out.src = du; els.out.style.display='block'; els.download.disabled=false; setLog(`Model: ${res?.model || ''}`);
  }catch(e){ console.error(e); setLog('Error: '+(e?.message||String(e))); }
  finally{ setBusy(false); }
});

// If the user clicks on the dot-free preview text, open file picker
els.preview.addEventListener('click', () => { if(!state.dataUrl) els.file.click(); });