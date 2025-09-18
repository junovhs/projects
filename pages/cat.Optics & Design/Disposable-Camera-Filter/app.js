// Disposable Night — v5 (mobile-friendly exports; no File System Access API)
// Changes:
// - “Export PNGs” bundles frames into a .tar and triggers a normal download (works on mobile).
// - “Save PNG” downloads the current processed frame.
// - MP4 export via ffmpeg.wasm with a single-thread core (no cross-origin isolation needed).

const S = {
  mediaW:960, mediaH:540, dpr:Math.min(2, devicePixelRatio||1),
  tex:null, isVideo:false, frameSeed:0,

  // Defaults (your look)
  ev:0.00,
  flashStrength:0.19,
  flashFalloff:10.00,
  flashCenterX:0.50,
  flashCenterY:0.50,

  scurve:0.18,
  blacks:0.011,
  blackLift:0.009,
  knee:0.000,

  shadowCool:0.00,
  highlightWarm:0.00,
  greenShadows:0.50,
  magentaMids:0.31,

  bloomThreshold:1.000,
  bloomRadius:48.90,
  bloomIntensity:0.00,
  bloomWarm:0.00,
  halation:0.00,

  vignette:0.500,
  vignettePower:2.50,
  ca:0.59,
  clarity:0.00,

  // Shutter ≈ 1/89 -> slider ~0.214
  shutterUI:0.214,
  shake:0.18,
  motionAngle:0,

  grainASA:700,
  grainDevelop:-2.00,
  grainStock:1.00,
  grainChroma:1.00,
  grainMagnify:0.82,

  // View state
  viewMode:'fit',  // 'fit' | '1x'
  panX:0,
  panY:0,

  needsRender:true, showOriginal:false
};

const $  = s => document.querySelector(s);
const CAN= $('#gl');
const GL = CAN.getContext('webgl2', {premultipliedAlpha:false, preserveDrawingBuffer:true})
        || CAN.getContext('webgl',  {premultipliedAlpha:false, preserveDrawingBuffer:true});
if(!GL) alert('WebGL not supported');
const gl = GL;
const V  = $('#vid');

/* ---------- layout: 70% window container + Fit/1:1 modes ---------- */
function layout(){
  const stage = document.querySelector('.stage');
  const fullW = stage.clientWidth;
  const fullH = stage.clientHeight;

  // container is 70% of available window area
  const containerW = Math.max(50, Math.floor(window.innerWidth  * 0.70));
  const containerH = Math.max(50, Math.floor(window.innerHeight * 0.70));

  const vp = document.getElementById('viewport');
  vp.style.width  = containerW + 'px';
  vp.style.height = containerH + 'px';

  if (!S.mediaW || !S.mediaH){
    CAN.style.width='0px'; CAN.style.height='0px';
    return;
  }

  if (S.viewMode === 'fit'){
    // scale to fit entirely within container
    const scale = Math.min(containerW / S.mediaW, containerH / S.mediaH);
    const cssW = Math.max(1, Math.round(S.mediaW * scale));
    const cssH = Math.max(1, Math.round(S.mediaH * scale));

    CAN.style.width  = cssW + 'px';
    CAN.style.height = cssH + 'px';
    CAN.style.left   = ((containerW - cssW)/2) + 'px';
    CAN.style.top    = ((containerH - cssH)/2) + 'px';

    const W = Math.round(cssW * S.dpr);
    const H = Math.round(cssH * S.dpr);
    if (CAN.width !== W || CAN.height !== H){
      CAN.width = W; CAN.height = H;
      gl.viewport(0,0,W,H);
      ensureRTs(); S.needsRender = true;
    }
  } else { // '1x' (1 image pixel == 1 CSS pixel) with pan
    if (CAN.width !== S.mediaW || CAN.height !== S.mediaH){
      CAN.width = S.mediaW; CAN.height = S.mediaH;
      gl.viewport(0,0,S.mediaW,S.mediaH);
      ensureRTs(); S.needsRender = true;
    }

    CAN.style.width  = S.mediaW + 'px';
    CAN.style.height = S.mediaH + 'px';

    if (typeof S.panX !== 'number' || typeof S.panY !== 'number'){
      S.panX = Math.round((containerW - S.mediaW)/2);
      S.panY = Math.round((containerH - S.mediaH)/2);
    }

    const minX = Math.min(0, containerW - S.mediaW), maxX = Math.max(0, containerW - S.mediaW);
    const minY = Math.min(0, containerH - S.mediaH), maxY = Math.max(0, containerH - S.mediaH);
    S.panX = Math.max(minX, Math.min(maxX, S.panX));
    S.panY = Math.max(minY, Math.min(maxY, S.panY));

    CAN.style.left = S.panX + 'px';
    CAN.style.top  = S.panY + 'px';
  }
}
window.addEventListener('resize', layout);

/* ---------- UI binders ---------- */
function fmt(v,step){ const p=(step && step<0.01)?3:2; return (+v).toFixed(p); }
function bindRange(id,key){
  const el=$('#'+id), lbl=$(`.val[data-for="${id}"]`);
  const set=(v)=>{ v=parseFloat(v); S[key]=v; el.value=v; lbl && (lbl.textContent=(id==='motionAngle'?v.toFixed(0):fmt(v,el.step))); S.needsRender=true; };
  el.addEventListener('input', e=> set(e.target.value));
  set(S[key]); return set;
}
[
  'ev','flashStrength','flashFalloff','scurve','blacks','blackLift','knee','shadowCool','highlightWarm',
  'greenShadows','magentaMids','bloomThreshold','bloomRadius','bloomIntensity','bloomWarm','halation',
  'vignette','vignettePower','ca','clarity','shake','motionAngle','grainASA','grainDevelop','grainStock','grainChroma','grainMagnify'
].forEach(id=>bindRange(id,id));
(()=>{ const el=$('#shutterUI'), lbl=$('#shutterLabel'); const set=v=>{ S.shutterUI=+v; lbl.textContent=formatShutter(sliderToShutterSeconds(S.shutterUI)); S.needsRender=true; }; el.addEventListener('input', e=>set(e.target.value)); set(S.shutterUI); })();

/* ---------- flash pad (drag; UI matches image) ---------- */
(()=>{ const pad=$('#flashPad'), dot=$('#flashDot');
  function showDot(){ const r=pad.getBoundingClientRect();
    dot.style.left=((1.0-S.flashCenterX)*r.width)+'px';
    dot.style.top =((1.0-S.flashCenterY)*r.height)+'px';
  }
  function setFromPointer(e){
    const r=pad.getBoundingClientRect();
    const fx=((e.clientX||e.touches?.[0]?.clientX)-r.left)/r.width;
    const fy=((e.clientY||e.touches?.[0]?.clientY)-r.top )/r.height;
    S.flashCenterX = 1.0 - Math.max(0,Math.min(1,fx));
    S.flashCenterY = 1.0 - Math.max(0,Math.min(1,fy));
    showDot(); S.needsRender=true;
  }
  let drag=false; pad.addEventListener('mousedown', e=>{ drag=true; setFromPointer(e); });
  window.addEventListener('mousemove', e=>{ if(drag) setFromPointer(e); }); window.addEventListener('mouseup', ()=>drag=false);
  pad.addEventListener('touchstart', e=>{ drag=true; setFromPointer(e); });
  window.addEventListener('touchmove', e=>{ if(drag) setFromPointer(e); }); window.addEventListener('touchend', ()=>drag=false);
  showDot();
})();

/* ---------- file open ---------- */
$('#open').onclick=()=>$('#file').click();
$('#file').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  if ((f.type||'').startsWith('video/')) loadVideo(f); else loadImage(f);
});
function loadImage(file){
  const img=new Image();
  img.onload=()=>{
    S.isVideo=false; S.mediaW=img.naturalWidth; S.mediaH=img.naturalHeight;
    S.tex=createTex(S.mediaW,S.mediaH);
    gl.bindTexture(gl.TEXTURE_2D,S.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
    layout(); S.needsRender=true; $('#play').disabled=true;
  };
  img.src=URL.createObjectURL(file);
}
function loadVideo(file){
  if (S._vfcb && V.cancelVideoFrameCallback) { try{ V.cancelVideoFrameCallback(S._vfcb);}catch{} }
  V.src=URL.createObjectURL(file); V.loop=true; V.muted=true; V.playsInline=true;
  V.onloadedmetadata=()=>{
    S.isVideo=true; S.mediaW=V.videoWidth; S.mediaH=V.videoHeight;
    S.tex=createTex(S.mediaW,S.mediaH);
    $('#play').disabled=false; $('#play').textContent='Pause';
    layout(); V.play().catch(()=>{});
    const upload=()=>{
      gl.bindTexture(gl.TEXTURE_2D,S.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,V);
      S.frameSeed=(S.frameSeed+1)|0; S.needsRender=true;
    };
    if (V.requestVideoFrameCallback){
      const loop=()=>{ if(!S.isVideo) return; if(!V.paused) upload(); S._vfcb=V.requestVideoFrameCallback(loop); };
      S._vfcb=V.requestVideoFrameCallback(loop);
    } else {
      (function pump(){ if(!S.isVideo) return; if(!V.paused&&!V.ended) upload(); requestAnimationFrame(pump); })();
    }
  };
}

/* ---------- transport ---------- */
$('#play').onclick=()=>{ if(!S.isVideo) return; if(V.paused){ V.play(); $('#play').textContent='Pause'; } else { V.pause(); $('#play').textContent='Play'; } };
$('#original').onclick=()=>{ S.showOriginal=!S.showOriginal; $('#original').classList.toggle('active',S.showOriginal); S.needsRender=true; };

/* ---------- Save single PNG (current canvas) at native resolution ---------- */
$('#save-png').onclick = async ()=>{
  if (!S.tex){ toast('Load an image or video first','err'); return; }

  // Remember preview state
  const prevCssW = CAN.style.width, prevCssH = CAN.style.height;
  const prevW = CAN.width, prevH = CAN.height;

  // Switch to native
  CAN.style.width  = S.mediaW + 'px';
  CAN.style.height = S.mediaH + 'px';
  CAN.width  = S.mediaW;
  CAN.height = S.mediaH;
  gl.viewport(0,0,CAN.width,CAN.height);
  ensureRTs(); S.needsRender = true;

  // If video, upload current frame
  if (S.isVideo){
    gl.bindTexture(gl.TEXTURE_2D,S.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,document.getElementById('vid'));
    S.frameSeed=(S.frameSeed+1)|0; S.needsRender=true;
  }

  const raf2 = () => new Promise(r=> requestAnimationFrame(()=>requestAnimationFrame(r)));
  await raf2(); // ensure the render is caught up

  const blob = await new Promise(r => CAN.toBlob(r, 'image/png'));
  download(blob, S.isVideo ? 'frame_current.png' : 'image_processed.png');

  // Restore preview
  CAN.style.width = prevCssW; CAN.style.height = prevCssH;
  CAN.width = prevW; CAN.height = prevH;
  gl.viewport(0,0,prevW,prevH);
  ensureRTs(); S.needsRender = true;
};

/* ---------- Export MP4 (ffmpeg.wasm) + progress overlay ---------- */
$('#export-mp4').onclick = async ()=>{
  if (!S.isVideo){ toast('Load a video first','err'); return; }
  const {ffmpeg} = await getFFmpeg();

  // switch canvas to native resolution for capture
  const prevCssW = CAN.style.width, prevCssH = CAN.style.height;
  const prevW = CAN.width, prevH = CAN.height;
  CAN.style.width  = S.mediaW + 'px';
  CAN.style.height = S.mediaH + 'px';
  CAN.width  = S.mediaW;
  CAN.height = S.mediaH;
  gl.viewport(0,0,CAN.width,CAN.height);
  ensureRTs(); S.needsRender = true;

  const ov=$('#overlay'), txt=$('#overlayText');
  ov.classList.remove('hidden'); txt.textContent='Export: grabbing frames… 0%';

  let i = 0;
  const dur = Math.max(0.01, V.duration||1);
  const wasLoop=V.loop, wasPaused=V.paused, prevRate=V.playbackRate;
  V.loop=false; V.playbackRate = 1.0;
  V.pause(); V.currentTime=0; await waitSeeked();
  const pngOfCanvas = () => new Promise(r => CAN.toBlob(r, 'image/png'));
  const raf2 = () => new Promise(r=> requestAnimationFrame(()=>requestAnimationFrame(r)));

  const grabOne = async ()=>{
    gl.bindTexture(gl.TEXTURE_2D,S.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,V);
    S.frameSeed=(S.frameSeed+1)|0; S.needsRender=true;
    await raf2();

    const blob = await pngOfCanvas();
    const ab   = await blob.arrayBuffer();
    const name = `f_${String(i).padStart(6,'0')}.png`;
    ffmpeg.FS('writeFile', name, new Uint8Array(ab));
    i++;
    txt.textContent = `Export: grabbing frames… ${Math.round((V.currentTime/dur)*100)}%`;
  };

  await new Promise(async (resolve)=>{
    const onFrame = async ()=>{
      V.pause();
      await grabOne();
      if (V.ended || V.currentTime >= dur - 1e-4){ resolve(); return; }
      await V.play();
      S._vfcb = V.requestVideoFrameCallback(onFrame);
    };
    await V.play();
    S._vfcb = V.requestVideoFrameCallback(onFrame);
    V.addEventListener('ended', ()=>resolve(), {once:true});
  });

  txt.textContent='Export: encoding…';
  ffmpeg.setLogger(({message})=>{
    const m = /frame=\s*(\d+)/.exec(message);
    if (m){ const f=+m[1]; txt.textContent=`Export: encoding… frame ${f}`; }
  });

  let outName='export.mp4', outMime='video/mp4';
  try{
    await ffmpeg.run(
      '-framerate','30','-i','f_%06d.png',
      '-c:v','libx264','-pix_fmt','yuv420p','-crf','12','-preset','veryslow','-movflags','+faststart',
      outName
    );
  } catch(e1){
    try{
      await ffmpeg.run(
        '-framerate','30','-i','f_%06d.png',
        '-c:v','mpeg4','-q:v','1','-movflags','+faststart',
        outName
      );
    } catch(e2){
      outName='export.webm'; outMime='video/webm';
      await ffmpeg.run(
        '-framerate','30','-i','f_%06d.png',
        '-c:v','libvpx-vp9','-pix_fmt','yuv420p','-b:v','0','-crf','18',
        outName
      );
    }
  }

  const data = ffmpeg.FS('readFile', outName);
  download(new Blob([data.buffer], {type: outMime}), outName);

  // cleanup ffmpeg FS
  for (let k=0;k<i;k++){ try{ ffmpeg.FS('unlink', `f_${String(k).padStart(6,'0')}.png`);}catch{} }
  try{ ffmpeg.FS('unlink', outName);}catch{}

  ov.classList.add('hidden');

  // restore preview size & video state
  CAN.style.width = prevCssW; CAN.style.height = prevCssH;
  CAN.width = prevW;  CAN.height = prevH;
  gl.viewport(0,0,prevW,prevH); ensureRTs(); S.needsRender = true;
  V.loop=wasLoop; V.playbackRate=prevRate; if (wasPaused) V.pause();
};

/* ---------- Export PNG sequence (native res) -> single .tar download ---------- */
$('#export-pngs').onclick = async ()=>{
  if (!S.tex){ toast('Load an image or video first','err'); return; }

  const prevCssW = CAN.style.width, prevCssH = CAN.style.height;
  const prevW = CAN.width, prevH = CAN.height;
  CAN.style.width  = S.mediaW + 'px';
  CAN.style.height = S.mediaH + 'px';
  CAN.width  = S.mediaW;
  CAN.height = S.mediaH;
  gl.viewport(0,0,CAN.width,CAN.height);
  ensureRTs(); S.needsRender = true;

  const ov=$('#overlay'), txt=$('#overlayText');
  ov.classList.remove('hidden'); txt.textContent='Exporting PNGs… 0%';
  const raf2 = () => new Promise(r=> requestAnimationFrame(()=>requestAnimationFrame(r)));
  const savePNG = () => new Promise(r => CAN.toBlob(r, 'image/png'));

  const entries = []; // {name, data:ArrayBuffer}

  if (!S.isVideo){
    await raf2();
    const blob = await savePNG();
    const ab = await blob.arrayBuffer();
    entries.push({name:'frame_000000.png', data:ab});
  } else {
    const dur = Math.max(0.01, V.duration||1);
    const wasLoop=V.loop, wasPaused=V.paused; V.loop=false;
    V.pause(); V.currentTime = 0; await waitSeeked();

    let i=0;
    await new Promise(async (resolve)=>{
      const onFrame = async ()=>{
        V.pause();
        gl.bindTexture(gl.TEXTURE_2D,S.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,V);
        S.frameSeed=(S.frameSeed+1)|0; S.needsRender=true;
        await raf2();

        const blob = await savePNG();
        const ab   = await blob.arrayBuffer();
        const name = `frame_${String(i).padStart(6,'0')}.png`;
        entries.push({name, data:ab});
        i++;
        txt.textContent = `Exporting PNGs… ${Math.round((V.currentTime/dur)*100)}%`;

        if (V.ended || V.currentTime >= dur - 1e-4){ resolve(); return; }
        await V.play();
        S._vfcb = V.requestVideoFrameCallback(onFrame);
      };
      await V.play();
      S._vfcb = V.requestVideoFrameCallback(onFrame);
      V.addEventListener('ended', ()=>resolve(), {once:true});
    });

    V.loop=wasLoop; if (wasPaused) V.pause();
  }

  // Build a simple tar archive (uncompressed) so users get 1 download
  const tarBlob = buildTar(entries);
  download(tarBlob, S.isVideo ? 'frames.tar' : 'image.tar');

  ov.classList.add('hidden');

  CAN.style.width = prevCssW; CAN.style.height = prevCssH;
  CAN.width = prevW; CAN.height = prevH;
  gl.viewport(0,0,prevW,prevH); ensureRTs(); S.needsRender = true;

  toast('PNG sequence exported');
};

/* ---------- helpers ---------- */
function toast(msg,kind='ok'){ const t=$('#toast'); t.textContent=msg; t.className='toast '+(kind==='ok'?'ok':'err'); t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2200); }
function sliderToShutterSeconds(v){ const sMin=1/250, sMax=0.5; return Math.pow(sMax/sMin, v)*sMin; }
function formatShutter(s){ return (s>=1) ? `${s.toFixed(1)}s` : `1/${Math.round(1/s)}`; }
function shutterToPixels(shutterSeconds,shake01){ const sMin=1/250,sMax=0.5; const t=Math.log(shutterSeconds/sMin)/Math.log(sMax/sMin); const base=0.5+26.0*Math.pow(t,0.85); return base*(0.2+1.2*shake01); }
function download(blob,name){
  const a=document.createElement('a');
  const url=URL.createObjectURL(blob);
  a.href=url; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },2000);
}
function waitSeeked(){ return new Promise(r=> V.addEventListener('seeked', r, {once:true})); }


/* -- ffmpeg.wasm loader (auto-injects script if missing; single-thread core) -- */
let _ffmpegCache=null;
async function getFFmpeg(){
  if (_ffmpegCache) return _ffmpegCache;
  if (!window.FFmpeg) throw new Error('FFmpeg script not loaded. Check index.html <script> tag.');

  const { createFFmpeg } = window.FFmpeg;
  const ffmpeg = createFFmpeg({
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js'
  });
  await ffmpeg.load();
  _ffmpegCache = { ffmpeg };
  return _ffmpegCache;
}

/* ---------- GL caps ---------- */
const caps = (() => {
  const gl2   = (typeof WebGL2RenderingContext!=='undefined') && (gl instanceof WebGL2RenderingContext);
  const extCBF= gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
  const extHF = !gl2 && gl.getExtension('OES_texture_half_float');
  const extHFL= !gl2 && gl.getExtension('OES_texture_half_float_linear');
  const halfType = gl2 ? gl.HALF_FLOAT : (extHF && extHF.HALF_FLOAT_OES);
  const canFloatRT = !!(extCBF && (gl2 || extHF));
  const canLinear  = gl2 || !!extHFL;
  return { gl2, canFloatRT, halfType, canLinear };
})();

/* ---------- GL helpers ---------- */
const quad=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,quad);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);

function createTex(w,h){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); return t; }

function createRenderTex(w,h){
  const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
  if (caps.canFloatRT){
    if (caps.gl2) gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null);
    else          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,caps.halfType,null);
    const filter = caps.canLinear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
  } else {
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  }
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return t;
}
function createFBO(w,h){ const tex=createRenderTex(w,h); const fbo=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0); return {fbo,tex,w,h}; }

let rtA,rtB, rtH_A,rtH_B, rtQ_A,rtQ_B, rtE_A,rtE_B, rtBloom;
function ensureRTs(){
  const W=CAN.width|0, H=CAN.height|0;
  const mk=(rt,w,h)=>(!rt||rt.w!==w||rt.h!==h)?createFBO(w,h):rt;
  rtA=mk(rtA,W,H); rtB=mk(rtB,W,H);
  rtH_A=mk(rtH_A,W>>1||1,H>>1||1); rtH_B=mk(rtH_B,W>>1||1,H>>1||1);
  rtQ_A=mk(rtQ_A,W>>2||1,H>>2||1); rtQ_B=mk(rtQ_B,W>>2||1,H>>2||1);
  rtE_A=mk(rtE_A,W>>3||1,H>>3||1); rtE_B=mk(rtE_B,W>>3||1,H>>3||1);
  rtBloom=mk(rtBloom,W,H);
}

/* ---------- shaders ---------- */
const COMMON=`precision highp float; varying vec2 v_uv; uniform vec2 uRes;
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); } vec3 toSRGB(vec3 c){ return pow(max(c,0.0), vec3(1.0/2.2)); }`;
const VS=`attribute vec2 a_pos; varying vec2 v_uv; void main(){ v_uv=a_pos*0.5+0.5; gl_Position=vec4(a_pos,0,1);} `;
function makeProg(fs){ const vs=gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs,VS); gl.compileShader(vs);
  const fsS=gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fsS,fs); gl.compileShader(fsS);
  const p=gl.createProgram(); gl.attachShader(p,vs); gl.attachShader(p,fsS); gl.linkProgram(p); return p; }
function bind(p){ gl.useProgram(p); const loc=gl.getAttribLocation(p,'a_pos'); gl.bindBuffer(gl.ARRAY_BUFFER,quad); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0); const r=gl.getUniformLocation(p,'uRes'); if(r) gl.uniform2f(r,CAN.width,CAN.height); }
function draw(p,bindings,target,uniforms=()=>{}){ bind(p); let unit=0; for(const [name,tex] of Object.entries(bindings||{})){ const loc=gl.getUniformLocation(p,name); gl.activeTexture(gl[`TEXTURE${unit}`]); gl.bindTexture(gl.TEXTURE_2D,tex); gl.uniform1i(loc,unit); unit++; } gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.fbo:null); uniforms(p); gl.drawArrays(gl.TRIANGLES,0,6); }

const FS_COPY  = COMMON+`uniform sampler2D uTex; void main(){ gl_FragColor=vec4(texture2D(uTex,v_uv).rgb,1.0);} `;
const FS_PRE   = COMMON+`uniform sampler2D uTex; uniform float uEV; void main(){ vec3 c=toLin(texture2D(uTex,v_uv).rgb)*exp2(uEV); gl_FragColor=vec4(c,1.0);} `;
const FS_FLASH = COMMON+`
uniform sampler2D uTex; uniform vec2 uCenter; uniform float uStrength,uFall;
void main(){
  vec3 c=texture2D(uTex,v_uv).rgb;
  vec2 ac=vec2(uRes.x/uRes.y,1.0);
  float r=length((v_uv-uCenter)*ac);
  float m=1.0/(1.0+pow(max(0.0,uFall)*r,2.0));
  c *= (1.0 + uStrength * m);
  gl_FragColor=vec4(c,1.0);
}`;
const FS_MOTION= COMMON+`
uniform sampler2D uTex; uniform vec2 uPx; uniform float uAmt,uAng,uShake;
void main(){
  vec2 dir=vec2(cos(uAng),sin(uAng));
  const int N=24; vec3 acc=vec3(0.0);
  for(int i=0;i<N;i++){
    float t=float(i)/float(N-1)-0.5;
    float w1=sin(6.28318*2.7*t+1.7), w2=sin(6.28318*4.9*t+5.1);
    vec2 wig=uShake*0.25*vec2(w1,w2);
    acc+=texture2D(uTex,v_uv+(dir*t+wig)*uAmt*uPx).rgb;
  }
  gl_FragColor=vec4(acc/float(N),1.0);
}`;
const FS_TONE= COMMON+`
uniform sampler2D uTex; uniform float uSc,uBl,uKnee,uLift;
vec3 s(vec3 x){ return mix(x, x*x*(3.0-2.0*x), uSc); }
vec3 crush(vec3 x){ return max(vec3(0.0), x-uBl)/(1.0-uBl+1e-6); }
vec3 lift(vec3 x){ return x*(1.0-uLift)+vec3(uLift); }
vec3 shoulder(vec3 x){ vec3 t = clamp(x, 0.0, 1.0); return 1.0 - pow(1.0 - t, vec3(1.0 + 5.0*uKnee)); }
void main(){ vec3 c=texture2D(uTex,v_uv).rgb; c=s(c); c=crush(c); c=lift(c); c=shoulder(c); gl_FragColor=vec4(c,1.0); }`;
const FS_SPLIT= COMMON+`uniform sampler2D uTex; uniform float uSh,uHi;
void main(){ vec3 c=texture2D(uTex,v_uv).rgb; float Y=luma(c); float wS=1.0 - smoothstep(0.18,0.55,Y); float wH=smoothstep(0.5,0.9,Y);
  vec3 sh=mix(vec3(1.0),vec3(0.95,1.08,1.15),uSh); vec3 hi=mix(vec3(1.0),vec3(1.15,1.00,0.90),uHi);
  c*=mix(vec3(1.0),sh,wS); c*=mix(vec3(1.0),hi,wH); gl_FragColor=vec4(c,1.0);} `;
const FS_CAST= COMMON+`uniform sampler2D uTex; uniform float uGS,uMM;
void main(){ vec3 c=texture2D(uTex,v_uv).rgb; float Y=luma(c); float wS=1.0 - smoothstep(0.18,0.55,Y);
  float wM=smoothstep(0.20,0.60,Y)*(1.0-smoothstep(0.60,0.90,Y));
  c*=mix(vec3(1.0), vec3(0.80,1.25,0.82), uGS*wS);
  c*=mix(vec3(1.0), vec3(1.22,0.80,1.22), uMM*wM);
  gl_FragColor=vec4(c,1.0);} `;
const FS_VIG= COMMON+`uniform sampler2D uTex; uniform float uV,uP;
void main(){ vec2 ac=vec2(uRes.x/uRes.y,1.0); float r=length((v_uv-0.5)*ac); float v=pow(r,uP); gl_FragColor=vec4(texture2D(uTex,v_uv).rgb*(1.0-uV*v),1.0);} `;
const FS_BRIGHT= COMMON+`uniform sampler2D uTex; uniform float uT,uWarm;
vec3 warm(float a){return mix(vec3(1.0),vec3(1.15,1.0,0.88),a);}
void main(){ vec3 c=texture2D(uTex,v_uv).rgb; float Y=luma(c);
  float m=clamp((Y-uT)/max(1e-5,1.0-uT),0.0,1.0); vec3 b=clamp(c,0.0,1.0)*m*warm(uWarm)*1.5; gl_FragColor=vec4(b,1.0);} `;
const FS_DOWNS= COMMON+`uniform sampler2D uTex; uniform vec2 uTexel;
void main(){ vec3 s=vec3(0.0);
  s+=texture2D(uTex,v_uv+uTexel*vec2(-.5,-.5)).rgb;
  s+=texture2D(uTex,v_uv+uTexel*vec2(.5,-.5)).rgb;
  s+=texture2D(uTex,v_uv+uTexel*vec2(-.5,.5)).rgb;
  s+=texture2D(uTex,v_uv+uTexel*vec2(.5,.5)).rgb;
  gl_FragColor=vec4(s*.25,1.0);} `;
const FS_BLUR= COMMON+`uniform sampler2D uTex; uniform vec2 uTexel; uniform float uR;
void main(){ vec3 s=vec3(0.0); float w[5]; w[0]=0.227027;w[1]=0.1945946;w[2]=0.1216216;w[3]=0.054054;w[4]=0.016216;
  vec2 st=uTexel*max(uR,1.0); s+=texture2D(uTex,v_uv).rgb*w[0];
  for(int i=1;i<5;i++){ s+=texture2D(uTex,v_uv+st*float(i)).rgb*w[i]; s+=texture2D(uTex,v_uv-st*float(i)).rgb*w[i]; }
  gl_FragColor=vec4(s,1.0);} `;
const FS_UPADD= COMMON+`uniform sampler2D uLow,uHigh; uniform float uAdd;
void main(){ vec3 low=texture2D(uLow,v_uv).rgb, hi=texture2D(uHigh,v_uv).rgb; gl_FragColor=vec4(hi + low*uAdd, 1.0);} `;
const FS_BCOMP= COMMON+`uniform sampler2D uBase,uBloom; uniform float uI,uHal;
vec3 screen(vec3 a, vec3 b){ return 1.0-(1.0-a)*(1.0-b); }
void main(){ vec3 base=texture2D(uBase,v_uv).rgb, bloom=texture2D(uBloom,v_uv).rgb;
  vec3 outc=screen(base, bloom*uI);
  vec3 hal=bloom*(uHal*2.0)*vec3(1.0,0.22,0.07);
  gl_FragColor=vec4(outc+hal,1.0);} `;
const FS_CLAR= COMMON+`uniform sampler2D uTex; uniform vec2 uPx; uniform float uAmt;
vec3 blur9(vec2 uv){ vec3 s=vec3(0.0); float w[5]; w[0]=0.227027;w[1]=0.1945946;w[2]=0.1216216;w[3]=0.054054;w[4]=0.016216;
  s+=texture2D(uTex,uv).rgb*w[0];
  for(int i=1;i<5;i++){ s+=texture2D(uTex,uv+uPx*float(i)).rgb*w[i]; s+=texture2D(uTex,uv-uPx*float(i)).rgb*w[i]; } return s; }
void main(){ vec3 c=texture2D(uTex,v_uv).rgb; vec3 b=blur9(v_uv); vec3 hi=c-b; c+=hi*uAmt*2.0; gl_FragColor=vec4(c,1.0);} `;
const FS_CA = COMMON+`
uniform sampler2D uTex; uniform vec2 uPx; uniform float uCA;
void main(){
  vec2 ac=vec2(uRes.x/uRes.y,1.0);
  vec2 dir=normalize((v_uv-0.5)*ac);
  dir=mix(vec2(1.0,0.0), dir, step(0.0001,length(dir)));
  vec2 d=dir*uPx*uCA; vec3 c;
  c.r=texture2D(uTex,v_uv+d).r; c.g=texture2D(uTex,v_uv).g; c.b=texture2D(uTex,v_uv-d).b;
  gl_FragColor=vec4(c,1.0);
}`;
const FS_GRAIN= COMMON+`
uniform sampler2D uTex; uniform float uASA,uDev,uStock,uChroma,uMag,uShadow,uTime,uSeed,uDither;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=h(i),b=h(i+vec2(1,0)),c=h(i+vec2(0,1)),d=h(i+vec2(1,1)); vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.0; a*=0.5; } return s; }
mat2 R(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
vec2 seedOf(float s){ return vec2(fract(sin((s+1.0)*12.99)*43758.54), fract(sin((s+2.0)*78.23)*12345.67))*173.0; }
void main(){
  vec3 c=texture2D(uTex,v_uv).rgb; float Y=dot(c,vec3(0.2126,0.7152,0.0722));
  float asaN=clamp((log2(uASA)-log2(50.0))/(log2(3200.0)-log2(50.0)),0.0,1.0);
  float cell=mix(0.6,3.2,asaN)*uMag, base=mix(0.006,0.040,asaN);
  float aniso=mix(0.55,1.0,uStock); mat2 A=R(1.13)*mat2(1.0,0.0,0.0,aniso);
  vec2 uv=(v_uv*uRes)/cell; uv=A*uv + seedOf(uSeed);
  float dev=clamp((uDev+2.0)/4.0,0.0,1.0); float gain=mix(0.9,1.8,dev);
  float gL=fbm(uv)-0.5; vec3 gC=vec3(fbm(uv+vec2(17.2,3.1)), fbm(uv+vec2(-9.7,11.4)), fbm(uv+vec2(6.3,-21.7)))-0.5;
  vec3 g=mix(vec3(gL), mix(vec3(gL),gC,0.35), uChroma);
  float shadow=pow(max(0.0, 1.0 - Y), 1.0 + 1.2*uShadow);;
  float amp=base*gain*(0.55+uShadow*shadow);
  vec3 outc = toSRGB(clamp(c + g*amp, 0.0, 16.0));
  outc = clamp(outc, 0.0, 1.0);
  float n = fract(sin(dot(v_uv*uRes, vec2(12.9898,78.233))) * 43758.5453);
  outc += (uDither) * (n-0.5)/255.0;
  gl_FragColor=vec4(outc,1.0);
}`; 

const P={copy:makeProg(FS_COPY),pre:makeProg(FS_PRE),flash:makeProg(FS_FLASH),motion:makeProg(FS_MOTION),
  tone:makeProg(FS_TONE),split:makeProg(FS_SPLIT),cast:makeProg(FS_CAST),vig:makeProg(FS_VIG),
  bright:makeProg(FS_BRIGHT),down:makeProg(FS_DOWNS),blur:makeProg(FS_BLUR),upadd:makeProg(FS_UPADD),
  bcomp:makeProg(FS_BCOMP),clar:makeProg(FS_CLAR),ca:makeProg(FS_CA),grain:makeProg(FS_GRAIN)};

/* ---------- render ---------- */
let lastT=0;
function render(t=performance.now()){
  if (!S.tex){ gl.clearColor(0.05,0.06,0.08,1); gl.clear(gl.COLOR_BUFFER_BIT); requestAnimationFrame(render); return; }
  if (!S.needsRender && (t-lastT)<(1000/60)){ requestAnimationFrame(render); return; }
  lastT=t;

  const identity =
    Math.abs(S.ev) < 1e-6 &&
    S.flashStrength === 0 &&
    S.scurve === 0 && S.blacks === 0 && S.blackLift === 0 && S.knee === 0 &&
    S.shadowCool === 0 && S.highlightWarm === 0 && S.greenShadows === 0 && S.magentaMids === 0 &&
    S.vignette === 0 && S.bloomIntensity === 0 && S.halation === 0 &&
    S.clarity === 0 && S.ca === 0 &&
    S.shake === 0 && S.motionAngle === 0 && S.shutterUI === 0 &&
    S.grainDevelop === 0 && S.grainStock === 0 && S.grainChroma === 0 && S.grainMagnify === 1.0;

  if (S.showOriginal || identity){ draw(P.copy,{uTex:S.tex},null); S.needsRender=false; requestAnimationFrame(render); return; }

  const pxX=1/CAN.width, pxY=1/CAN.height;

  // Linearize + EV
  draw(P.pre,{uTex:S.tex},rtA,p=> gl.uniform1f(gl.getUniformLocation(p,'uEV'),S.ev));
  let cur = rtA.tex;

  // Motion blur (optional)
  const sh=sliderToShutterSeconds(S.shutterUI), amt=shutterToPixels(sh,S.shake);
  if (amt>0.05){
    draw(P.motion,{uTex:cur},rtB,p=>{
      gl.uniform2f(gl.getUniformLocation(p,'uPx'),pxX,pxY);
      gl.uniform1f(gl.getUniformLocation(p,'uAmt'),amt);
      gl.uniform1f(gl.getUniformLocation(p,'uAng'),S.motionAngle*Math.PI/180);
      gl.uniform1f(gl.getUniformLocation(p,'uShake'),S.shake);
    });
    cur = rtB.tex;
  }

  // Flash (mirror BOTH axes so UI & canvas match)
  const flashDst = (cur===rtA.tex) ? rtB : rtA;
  draw(P.flash,{uTex:cur},flashDst,p=>{
    gl.uniform2f(gl.getUniformLocation(p,'uCenter'), 1.0 - S.flashCenterX, 1.0 - S.flashCenterY);
    gl.uniform1f(gl.getUniformLocation(p,'uStrength'), S.flashStrength);
    gl.uniform1f(gl.getUniformLocation(p,'uFall'), S.flashFalloff);
  });
  cur = flashDst.tex;

  // Bloom: bright pass + pyramid
  const brightDst = (cur===rtA.tex) ? rtB : rtA;
  draw(P.bright,{uTex:cur},brightDst,p=>{ gl.uniform1f(gl.getUniformLocation(p,'uT'),S.bloomThreshold); gl.uniform1f(gl.getUniformLocation(p,'uWarm'),S.bloomWarm); });
  draw(P.down,{uTex:brightDst.tex},rtH_A,p=> gl.uniform2f(gl.getUniformLocation(p,'uTexel'),1/brightDst.w,1/brightDst.h));
  draw(P.down,{uTex:rtH_A.tex},rtQ_A,p=> gl.uniform2f(gl.getUniformLocation(p,'uTexel'),1/rtH_A.w,1/rtH_A.h));
  draw(P.down,{uTex:rtQ_A.tex},rtE_A,p=> gl.uniform2f(gl.getUniformLocation(p,'uTexel'),1/rtQ_A.w,1/rtQ_A.h));
  const blurHV=(src,dst,rad)=>{ draw(P.blur,{uTex:src.tex},dst,p=>{ gl.uniform2f(gl.getUniformLocation(p,'uTexel'),1/src.w,0); gl.uniform1f(gl.getUniformLocation(p,'uR'),rad); });
                                draw(P.blur,{uTex:dst.tex},src,p=>{ gl.uniform2f(gl.getUniformLocation(p,'uTexel'),0,1/src.h); gl.uniform1f(gl.getUniformLocation(p,'uR'),rad); }); };
  blurHV(rtE_A,rtE_B,S.bloomRadius*0.6);
  blurHV(rtQ_A,rtQ_B,S.bloomRadius*0.8);
  blurHV(rtH_A,rtH_B,S.bloomRadius*1.0);
  draw(P.upadd,{uLow:rtE_A.tex,uHigh:rtQ_A.tex},rtQ_B,p=> gl.uniform1f(gl.getUniformLocation(p,'uAdd'),1.0));
  draw(P.upadd,{uLow:rtQ_B.tex,uHigh:rtH_A.tex},rtH_B,p=> gl.uniform1f(gl.getUniformLocation(p,'uAdd'),1.0));
  draw(P.upadd,{uLow:rtH_B.tex,uHigh:brightDst.tex},rtBloom,p=> gl.uniform1f(gl.getUniformLocation(p,'uAdd'),1.0));

  // Tone stack
  const toneDst1 = (cur===rtA.tex) ? rtB : rtA;
  draw(P.tone,{uTex:cur},toneDst1,p=>{
    gl.uniform1f(gl.getUniformLocation(p,'uSc'), S.scurve);
    gl.uniform1f(gl.getUniformLocation(p,'uBl'), S.blacks);
    gl.uniform1f(gl.getUniformLocation(p,'uKnee'), S.knee);
    gl.uniform1f(gl.getUniformLocation(p,'uLift'), S.blackLift);
  });
  draw(P.split,{uTex:toneDst1.tex},(toneDst1===rtA)?rtB:rtA,p=>{ gl.uniform1f(gl.getUniformLocation(p,'uSh'),S.shadowCool); gl.uniform1f(gl.getUniformLocation(p,'uHi'),S.highlightWarm); });
  const afterSplit = ((toneDst1===rtA)?rtB:rtA).tex;
  draw(P.cast,{uTex:afterSplit},(toneDst1===rtA)?rtA:rtB,p=>{ gl.uniform1f(gl.getUniformLocation(p,'uGS'),S.greenShadows); gl.uniform1f(gl.getUniformLocation(p,'uMM'),S.magentaMids); });
  const afterCastFB = (toneDst1===rtA)?rtA:rtB;
  draw(P.vig,{uTex:afterCastFB.tex},(afterCastFB===rtA)?rtB:rtA,p=>{ gl.uniform1f(gl.getUniformLocation(p,'uV'),S.vignette); gl.uniform1f(gl.getUniformLocation(p,'uP'),S.vignettePower); });
  const baseFB = (afterCastFB===rtA)?rtB:rtA;

  // Bloom composite
  draw(P.bcomp,{uBase:baseFB.tex,uBloom:rtBloom.tex},(baseFB===rtA)?rtB:rtA,p=>{
    gl.uniform1f(gl.getUniformLocation(p,'uI'), S.bloomIntensity);
    gl.uniform1f(gl.getUniformLocation(p,'uHal'), S.halation);
  });
  let curFB = (baseFB===rtA)?rtB:rtA;

  // Clarity
  if (S.clarity>0.001){
    draw(P.clar,{uTex:curFB.tex},(curFB===rtA)?rtB:rtA,p=>{ gl.uniform2f(gl.getUniformLocation(p,'uPx'),pxX,pxY); gl.uniform1f(gl.getUniformLocation(p,'uAmt'),S.clarity); });
    curFB = (curFB===rtA)?rtB:rtA;
  }

  // CA
  draw(P.ca,{uTex:curFB.tex},(curFB===rtA)?rtB:rtA,p=>{ gl.uniform2f(gl.getUniformLocation(p,'uPx'),pxX,pxY); gl.uniform1f(gl.getUniformLocation(p,'uCA'),S.ca); });
  curFB = (curFB===rtA)?rtB:rtA;

  // Grain + sRGB (+dither) -> screen
  draw(P.grain,{uTex:curFB.tex},null,p=>{
    gl.uniform1f(gl.getUniformLocation(p,'uASA'),S.grainASA);
    gl.uniform1f(gl.getUniformLocation(p,'uDev'),S.grainDevelop);
    gl.uniform1f(gl.getUniformLocation(p,'uStock'),S.grainStock);
    gl.uniform1f(gl.getUniformLocation(p,'uChroma'),S.grainChroma);
    gl.uniform1f(gl.getUniformLocation(p,'uMag'),S.grainMagnify);
    gl.uniform1f(gl.getUniformLocation(p,'uShadow'),0.70);
    gl.uniform1f(gl.getUniformLocation(p,'uTime'),t*0.001);
    gl.uniform1f(gl.getUniformLocation(p,'uSeed'), S.isVideo ? S.frameSeed : 0.0);
    gl.uniform1f(gl.getUniformLocation(p,'uDither'), 0.5);
  });

  S.needsRender=false; requestAnimationFrame(render);
}

/* ---------- boot ---------- */
layout(); ensureRTs(); requestAnimationFrame(render);

/* click+drag: in Fit = set flash, in 1:1 = pan */
(()=>{
  const vp = document.getElementById('viewport');
  let dragging=false, mode='flash'; // 'flash' or 'pan'
  let sx=0, sy=0, ox=0, oy=0;

  function setFlashFromCanvas(x,y){
    const r=CAN.getBoundingClientRect();
    const fx=(x-r.left)/r.width, fy=(y-r.top)/r.height;
    S.flashCenterX = 1.0 - Math.max(0,Math.min(1,fx));
    S.flashCenterY = 1.0 - Math.max(0,Math.min(1,fy));
    S.needsRender = true;
  }
  function ppos(e){ const t=e.touches?e.touches[0]:e; return {x:t.clientX,y:t.clientY}; }

  const onDown=(e)=>{
    if (S.viewMode==='1x'){ mode='pan'; dragging=true; vp.classList.add('dragging');
      const p=ppos(e); sx=p.x; sy=p.y; ox=S.panX||0; oy=S.panY||0; e.preventDefault();
    } else { mode='flash'; dragging=true; const p=ppos(e); setFlashFromCanvas(p.x,p.y); }
  };
  const onMove=(e)=>{
    if (!dragging) return;
    if (mode==='pan'){
      const p=ppos(e); S.panX = ox + (p.x - sx); S.panY = oy + (p.y - sy); layout(); e.preventDefault();
    } else {
      const p=ppos(e); setFlashFromCanvas(p.x,p.y);
    }
  };
  const onUp=()=>{ dragging=false; vp.classList.remove('dragging'); };

  CAN.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  CAN.addEventListener('touchstart', onDown, {passive:false});
  window.addEventListener('touchmove', onMove, {passive:false});
  window.addEventListener('touchend', onUp);
})();

/* reset everything */
$('#reset').onclick=()=>{
  Object.assign(S,{
    ev:0.0, flashStrength:0.0, flashFalloff:4.5, flashCenterX:0.50, flashCenterY:0.50,
    scurve:0.0, blacks:0.0, blackLift:0.0, knee:0.0, shadowCool:0.0, highlightWarm:0.0,
    greenShadows:0.0, magentaMids:0.0, bloomThreshold:1.0, bloomRadius:48.9, bloomIntensity:0.0, bloomWarm:0.0, halation:0.0,
    vignette:0.0, vignettePower:2.5, ca:0.0, clarity:0.0, shutterUI:0.0, shake:0.0, motionAngle:0.0,
    grainASA:800, grainDevelop:0.0, grainStock:0.0, grainChroma:0.0, grainMagnify:1.0
  });
  [
    'ev','flashStrength','flashFalloff','scurve','blacks','blackLift','knee','shadowCool','highlightWarm',
    'greenShadows','magentaMids','bloomThreshold','bloomRadius','bloomIntensity','bloomWarm','halation',
    'vignette','vignettePower','ca','clarity','shake','motionAngle','grainASA','grainDevelop','grainStock','grainChroma','grainMagnify'
  ].forEach(id=>{
    const el=$('#'+id), lbl=$(`.val[data-for="${id}"]`); if(el&&lbl){ el.value=S[id]; lbl.textContent=(id==='motionAngle'?S[id].toFixed(0):fmt(S[id],el.step)); }
  });
  $('#shutterUI').value=S.shutterUI; $('#shutterLabel').textContent=formatShutter(sliderToShutterSeconds(S.shutterUI));
  S.needsRender=true;
};

/* ---------- Minimal tar builder (no compression) ---------- */
function buildTar(entries){
  // entries: [{name, data:ArrayBuffer}]
  const blocks = [];
  function padOctal(n, len){ // n as number, octal string with null
    const s = n.toString(8);
    return ('000000000000'.slice(s.length) + s).slice(-len) + '\0';
  }
  function putString(buf, off, str){
    for (let i=0;i<str.length;i++) buf[off+i] = str.charCodeAt(i) & 0xFF;
  }
  function headerFor(name, size){
    const buf = new Uint8Array(512); // zero filled
    let prefix = '';
    if (name.length > 100){
      const lastSlash = name.lastIndexOf('/');
      if (lastSlash > -1 && lastSlash < 155){
        prefix = name.slice(0, lastSlash);
        name = name.slice(lastSlash+1);
      }
    }
    putString(buf,   0, name.slice(0,100));
    putString(buf, 100, '0000777\0');           // mode
    putString(buf, 108, '0000000\0');           // uid
    putString(buf, 116, '0000000\0');           // gid
    putString(buf, 124, padOctal(size, 11));    // size
    putString(buf, 136, padOctal(Math.floor(Date.now()/1000), 11)); // mtime
    putString(buf, 156, '0');                   // typeflag '0' = file
    putString(buf, 257, 'ustar\0');             // magic
    putString(buf, 263, '00');                  // version
    putString(buf, 265, 'user');                // uname
    putString(buf, 297, 'user');                // gname
    if (prefix) putString(buf, 345, prefix.slice(0,155)); // prefix

    // checksum: treat chksum field as spaces
    for (let i=148;i<156;i++) buf[i] = 0x20;
    let sum = 0; for (let i=0;i<512;i++) sum += buf[i];
    const chk = (sum.toString(8).padStart(6,'0')).slice(-6) + '\0 ';
    putString(buf, 148, chk);
    return buf;
  }
  function padBlock(n){ return (512 - (n % 512)) % 512; }

  for (const {name, data} of entries){
    const size = data.byteLength;
    blocks.push(headerFor(name, size));
    blocks.push(new Uint8Array(data));
    const pad = padBlock(size);
    if (pad) blocks.push(new Uint8Array(pad));
  }
  // two 512-byte zero blocks
  blocks.push(new Uint8Array(512));
  blocks.push(new Uint8Array(512));

  const total = blocks.reduce((a,b)=>a + b.length, 0);
  const out = new Uint8Array(total);
  let off=0;
  for (const b of blocks){ out.set(b, off); off += b.length; }
  return new Blob([out], {type:'application/x-tar'});
}
document.getElementById('view-fit').onclick = ()=>{
  S.viewMode='fit';
  document.getElementById('view-fit').classList.add('on');
  document.getElementById('view-1x').classList.remove('on');
  layout();
};
document.getElementById('view-1x').onclick = ()=>{
  S.viewMode='1x';
  document.getElementById('view-1x').classList.add('on');
  document.getElementById('view-fit').classList.remove('on');
  // reset pan to center on enter
  S.panX = undefined; S.panY = undefined;
  layout();
};
// Ensure layout sizes are correct on load and after media load
layout();
window.addEventListener('load', layout);
