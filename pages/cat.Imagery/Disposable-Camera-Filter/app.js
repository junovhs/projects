// Main application orchestrator

import { initGL, getCapabilities, createQuadBuffer, createTexture, createFramebuffer, ensureFramebuffer } from './gl-context.js';
import { SHADERS, initPrograms, drawQuad } from './shaders.js';
import { applyExposure, applyFlash } from './exposure-flash.js';
import { applyTone } from './tone.js';
import { applySplitToning, applyColorCast } from './split-cast.js';
import {
  extractBright, downsample, blurHorizontalVertical, upsampleAdd,
  compositeBloom, applyVignette, applyClarity, applyChromaticAberration
} from './bloom-vignette-optics.js';
import { sliderToShutterSeconds, formatShutter, shutterToPixels, applyMotionBlur } from './motion-blur.js';
import { applyHandheldShake } from './handheld-camera.js';
import { applyGrain } from './film-grain.js';
import { buildTar, exportPNGSequence } from './export-images.js';
import { initFFmpeg, exportMP4 } from './export-video.js';
import { setupRangeBindings, setupShutterBinding, setupFlashPad, setupCanvasInteraction } from './ui-bindings.js';
import { download, toast, waitForVideoSeeked } from './utils.js';

const $ = s => document.querySelector(s);

// Application state
const state = {
  mediaW: 960,
  mediaH: 540,
  dpr: Math.min(2, devicePixelRatio || 1),
  tex: null,
  isVideo: false,
  frameSeed: 0,
  
  // Processing params
  ev: 0.0,
  flashStrength: 0.19,
  flashFalloff: 10.0,
  flashCenterX: 0.5,
  flashCenterY: 0.5,
  scurve: 0.18,
  blacks: 0.011,
  blackLift: 0.009,
  knee: 0.0,
  shadowCool: 0.0,
  highlightWarm: 0.0,
  greenShadows: 0.5,
  magentaMids: 0.31,
  bloomThreshold: 1.0,
  bloomRadius: 48.9,
  bloomIntensity: 0.0,
  bloomWarm: 0.0,
  halation: 0.0,
  vignette: 0.5,
  vignettePower: 2.5,
  ca: 0.59,
  clarity: 0.0,
  shutterUI: 0.214,
  shake: 0.18,
  motionAngle: 0,
  grainASA: 700,
  grainDevelop: -2.0,
  grainStock: 1.0,
  grainChroma: 1.0,
  grainMagnify: 0.82,
  shakeHandheld: 0.3,
  shakeFreq: 2.0,
  shakeAmpX: 8.0,
  shakeAmpY: 6.0,
  shakeRot: 0.4,
  
  // View state
  viewMode: 'fit',
  panX: 0,
  panY: 0,
  needsRender: true,
  showOriginal: false
};

// Initialize WebGL
const canvas = $('#gl');
const gl = initGL(canvas);
if (!gl) throw new Error('WebGL initialization failed');

const caps = getCapabilities(gl);
const quad = createQuadBuffer(gl);
const programs = initPrograms(gl);

const video = $('#vid');

// Render targets
let rtA, rtB, rtH_A, rtH_B, rtQ_A, rtQ_B, rtE_A, rtE_B, rtBloom;

function ensureRenderTargets() {
  const W = canvas.width | 0;
  const H = canvas.height | 0;
  
  rtA = ensureFramebuffer(rtA, gl, caps, W, H);
  rtB = ensureFramebuffer(rtB, gl, caps, W, H);
  rtH_A = ensureFramebuffer(rtH_A, gl, caps, W >> 1 || 1, H >> 1 || 1);
  rtH_B = ensureFramebuffer(rtH_B, gl, caps, W >> 1 || 1, H >> 1 || 1);
  rtQ_A = ensureFramebuffer(rtQ_A, gl, caps, W >> 2 || 1, H >> 2 || 1);
  rtQ_B = ensureFramebuffer(rtQ_B, gl, caps, W >> 2 || 1, H >> 2 || 1);
  rtE_A = ensureFramebuffer(rtE_A, gl, caps, W >> 3 || 1, H >> 3 || 1);
  rtE_B = ensureFramebuffer(rtE_B, gl, caps, W >> 3 || 1, H >> 3 || 1);
  rtBloom = ensureFramebuffer(rtBloom, gl, caps, W, H);
}

// Layout management
function layout() {
  const containerW = Math.max(50, Math.floor(window.innerWidth * 0.70));
  const containerH = Math.max(50, Math.floor(window.innerHeight * 0.70));
  const vp = $('#viewport');
  vp.style.width = containerW + 'px';
  vp.style.height = containerH + 'px';
  
  if (!state.mediaW || !state.mediaH) {
    canvas.style.width = canvas.style.height = '0px';
    return;
  }
  
  if (state.viewMode === 'fit') {
    const scale = Math.min(containerW / state.mediaW, containerH / state.mediaH);
    const cssW = Math.max(1, Math.round(state.mediaW * scale));
    const cssH = Math.max(1, Math.round(state.mediaH * scale));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.style.left = ((containerW - cssW) / 2) + 'px';
    canvas.style.top = ((containerH - cssH) / 2) + 'px';
    
    const W = Math.round(cssW * state.dpr);
    const H = Math.round(cssH * state.dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      gl.viewport(0, 0, W, H);
      ensureRenderTargets();
      state.needsRender = true;
    }
  } else {
    // 1:1 mode
    if (canvas.width !== state.mediaW || canvas.height !== state.mediaH) {
      canvas.width = state.mediaW;
      canvas.height = state.mediaH;
      gl.viewport(0, 0, state.mediaW, state.mediaH);
      ensureRenderTargets();
      state.needsRender = true;
    }
    canvas.style.width = state.mediaW + 'px';
    canvas.style.height = state.mediaH + 'px';
    
    if (typeof state.panX !== 'number' || typeof state.panY !== 'number') {
      state.panX = Math.round((containerW - state.mediaW) / 2);
      state.panY = Math.round((containerH - state.mediaH) / 2);
    }
    
    const minX = Math.min(0, containerW - state.mediaW);
    const maxX = Math.max(0, containerW - state.mediaW);
    const minY = Math.min(0, containerH - state.mediaH);
    const maxY = Math.max(0, containerH - state.mediaH);
    state.panX = Math.max(minX, Math.min(maxX, state.panX));
    state.panY = Math.max(minY, Math.min(maxY, state.panY));
    canvas.style.left = state.panX + 'px';
    canvas.style.top = state.panY + 'px';
  }
  
  state.needsRender = true;
}

window.addEventListener('resize', layout);

// UI Setup
const rangeParams = [
  'ev', 'flashStrength', 'flashFalloff',
  'scurve', 'blacks', 'blackLift', 'knee',
  'shadowCool', 'highlightWarm', 'greenShadows', 'magentaMids',
  'bloomThreshold', 'bloomRadius', 'bloomIntensity', 'bloomWarm', 'halation',
  'vignette', 'vignettePower', 'ca', 'clarity',
  'shake', 'motionAngle',
  'grainASA', 'grainDevelop', 'grainStock', 'grainChroma', 'grainMagnify',
  'shakeHandheld', 'shakeFreq', 'shakeAmpX', 'shakeAmpY', 'shakeRot'
];

const bindings = setupRangeBindings(state, rangeParams);
const shutterBinding = setupShutterBinding(state);
const flashPad = setupFlashPad(state);
setupCanvasInteraction(canvas, state);

// File loading
$('#open').onclick = () => $('#file').click();

$('#file').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  
  (f.type || '').startsWith('video/') ? loadVideo(f) : loadImage(f);
});

function loadImage(file) {
  const img = new Image();
  img.onload = () => {
    state.isVideo = false;
    state.mediaW = img.naturalWidth;
    state.mediaH = img.naturalHeight;
    state.tex = createTexture(gl, state.mediaW, state.mediaH);
    gl.bindTexture(gl.TEXTURE_2D, state.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    layout();
    state.needsRender = true;
    $('#play').disabled = true;
  };
  img.src = URL.createObjectURL(file);
}

function loadVideo(file) {
  if (state._vfcb && video.cancelVideoFrameCallback) {
    try {
      video.cancelVideoFrameCallback(state._vfcb);
    } catch (e) {}
  }
  
  video.src = URL.createObjectURL(file);
  video.loop = video.muted = true;
  video.playsInline = true;
  
  video.onloadedmetadata = () => {
    state.isVideo = true;
    state.mediaW = video.videoWidth;
    state.mediaH = video.videoHeight;
    state.tex = createTexture(gl, state.mediaW, state.mediaH);
    $('#play').disabled = false;
    $('#play').textContent = 'Pause';
    layout();
    video.play().catch(() => {});
    
    const upload = () => {
      gl.bindTexture(gl.TEXTURE_2D, state.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      state.frameSeed = (state.frameSeed + 1) | 0;
      state.needsRender = true;
    };
    
    if (video.requestVideoFrameCallback) {
      const loop = () => {
        if (!state.isVideo) return;
        if (!video.paused) upload();
        state._vfcb = video.requestVideoFrameCallback(loop);
      };
      state._vfcb = video.requestVideoFrameCallback(loop);
    } else {
      (function pump() {
        if (!state.isVideo) return;
        if (!video.paused && !video.ended) upload();
        requestAnimationFrame(pump);
      })();
    }
  };
}

// Transport controls
$('#play').onclick = () => {
  if (!state.isVideo) return;
  if (video.paused) {
    video.play();
    $('#play').textContent = 'Pause';
  } else {
    video.pause();
    $('#play').textContent = 'Play';
  }
};

$('#original').onclick = () => {
  state.showOriginal = !state.showOriginal;
  $('#original').classList.toggle('active', state.showOriginal);
  state.needsRender = true;
};

// View mode toggles
$('#view-fit').onclick = () => {
  state.viewMode = 'fit';
  $('#view-fit').classList.add('on');
  $('#view-1x').classList.remove('on');
  layout();
};

$('#view-1x').onclick = () => {
  state.viewMode = '1x';
  $('#view-1x').classList.add('on');
  $('#view-fit').classList.remove('on');
  state.panX = undefined;
  state.panY = undefined;
  layout();
};

// Reset
$('#reset').onclick = () => {
  Object.assign(state, {
    ev: 0.0, flashStrength: 0.0, flashFalloff: 4.5,
    flashCenterX: 0.5, flashCenterY: 0.5,
    scurve: 0.0, blacks: 0.0, blackLift: 0.0, knee: 0.0,
    shadowCool: 0.0, highlightWarm: 0.0, greenShadows: 0.0, magentaMids: 0.0,
    bloomThreshold: 1.0, bloomRadius: 48.9, bloomIntensity: 0.0,
    bloomWarm: 0.0, halation: 0.0,
    vignette: 0.0, vignettePower: 2.5, ca: 0.0, clarity: 0.0,
    shutterUI: 0.0, shake: 0.0, motionAngle: 0.0,
    grainASA: 800, grainDevelop: 0.0, grainStock: 0.0,
    grainChroma: 0.0, grainMagnify: 1.0,
    shakeHandheld: 0.3, shakeFreq: 2.0, shakeAmpX: 8.0,
    shakeAmpY: 6.0, shakeRot: 0.4
  });
  
  rangeParams.forEach(id => {
    if (bindings[id]) bindings[id](state[id]);
  });
  shutterBinding(state.shutterUI);
  flashPad.showDot();
  state.needsRender = true;
};

// Save PNG
$('#save-png').onclick = async () => {
  if (!state.tex) {
    toast('Load media first', 'err');
    return;
  }
  
  const prevCssW = canvas.style.width;
  const prevCssH = canvas.style.height;
  const prevW = canvas.width;
  const prevH = canvas.height;
  
  canvas.style.width = state.mediaW + 'px';
  canvas.style.height = state.mediaH + 'px';
  canvas.width = state.mediaW;
  canvas.height = state.mediaH;
  gl.viewport(0, 0, canvas.width, canvas.height);
  ensureRenderTargets();
  state.needsRender = true;
  
  if (state.isVideo) {
    gl.bindTexture(gl.TEXTURE_2D, state.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    state.frameSeed = (state.frameSeed + 1) | 0;
    state.needsRender = true;
  }
  
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  download(blob, state.isVideo ? 'frame_current.png' : 'image_processed.png');
  
  canvas.style.width = prevCssW;
  canvas.style.height = prevCssH;
  canvas.width = prevW;
  canvas.height = prevH;
  gl.viewport(0, 0, prevW, prevH);
  ensureRenderTargets();
  state.needsRender = true;
};

// Export PNGs
$('#export-pngs').onclick = async () => {
  if (!state.tex) {
    toast('Load media first', 'err');
    return;
  }
  
  const prevCssW = canvas.style.width;
  const prevCssH = canvas.style.height;
  const prevW = canvas.width;
  const prevH = canvas.height;
  
  canvas.style.width = state.mediaW + 'px';
  canvas.style.height = state.mediaH + 'px';
  canvas.width = state.mediaW;
  canvas.height = state.mediaH;
  gl.viewport(0, 0, canvas.width, canvas.height);
  ensureRenderTargets();
  state.needsRender = true;
  
  const renderFunc = async () => {
    if (state.isVideo) {
      gl.bindTexture(gl.TEXTURE_2D, state.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      state.frameSeed = (state.frameSeed + 1) | 0;
      state.needsRender = true;
    }
    render(performance.now());
  };
  
  const tarBlob = await exportPNGSequence(
    canvas,
    state.tex,
    video,
    state.isVideo,
    renderFunc,
    $('#overlay'),
    $('#overlayText')
  );
  
  download(tarBlob, state.isVideo ? 'frames.tar' : 'image.tar');
  
  canvas.style.width = prevCssW;
  canvas.style.height = prevCssH;
  canvas.width = prevW;
  canvas.height = prevH;
  gl.viewport(0, 0, prevW, prevH);
  ensureRenderTargets();
  state.needsRender = true;
  
  toast('PNG sequence exported');
};

// Export MP4
$('#export-mp4').onclick = async () => {
  if (!state.isVideo) {
    toast('Load video first', 'err');
    return;
  }
  
  const prevCssW = canvas.style.width;
  const prevCssH = canvas.style.height;
  const prevW = canvas.width;
  const prevH = canvas.height;
  
  canvas.style.width = state.mediaW + 'px';
  canvas.style.height = state.mediaH + 'px';
  canvas.width = state.mediaW;
  canvas.height = state.mediaH;
  gl.viewport(0, 0, canvas.width, canvas.height);
  ensureRenderTargets();
  state.needsRender = true;
  
  const renderFunc = async () => {
    gl.bindTexture(gl.TEXTURE_2D, state.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    state.frameSeed = (state.frameSeed + 1) | 0;
    state.needsRender = true;
    render(performance.now());
  };
  
  try {
    const { blob, filename } = await exportMP4(
      canvas,
      video,
      renderFunc,
      $('#overlay'),
      $('#overlayText')
    );
    download(blob, filename);
    toast('Video exported successfully');
  } catch (err) {
    console.error('Export error:', err);
    toast('Export failed: ' + err.message, 'err');
  }
  
  canvas.style.width = prevCssW;
  canvas.style.height = prevCssH;
  canvas.width = prevW;
  canvas.height = prevH;
  gl.viewport(0, 0, prevW, prevH);
  ensureRenderTargets();
  state.needsRender = true;
};

// Main render function
function render(t = performance.now()) {
  if (!state.tex) {
    gl.clearColor(0.05, 0.06, 0.08, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    requestAnimationFrame(render);
    return;
  }
  
  if (state.showOriginal) {
    drawQuad(gl, programs.copy, quad, { uTex: state.tex }, null, null, canvas.width, canvas.height);
    state.needsRender = false;
    requestAnimationFrame(render);
    return;
  }
  
  const pxX = 1 / canvas.width;
  const pxY = 1 / canvas.height;
  
  // Pre-exposure
  applyExposure(gl, programs, quad, state.tex, rtA, state.ev, canvas.width, canvas.height, drawQuad);
  let currentTex = rtA.tex;
  
  // Handheld shake (video only)
  if (state.isVideo && state.shakeHandheld > 0.001) {
    const shakeDst = (currentTex === rtA.tex) ? rtB : rtA;
    applyHandheldShake(
      gl, programs, quad, currentTex, shakeDst,
      {
        intensity: state.shakeHandheld,
        frequency: state.shakeFreq,
        ampX: state.shakeAmpX,
        ampY: state.shakeAmpY,
        rotation: state.shakeRot
      },
      state.frameSeed,
      canvas.width, canvas.height,
      drawQuad
    );
    currentTex = shakeDst.tex;
  }
  
  // Motion blur
  const sh = sliderToShutterSeconds(state.shutterUI);
  const motionAmt = shutterToPixels(sh, state.shake);
  if (motionAmt > 0.05) {
    const motionDst = (currentTex === rtA.tex) ? rtB : rtA;
    applyMotionBlur(
      gl, programs, quad, currentTex, motionDst,
      { amount: motionAmt, angle: state.motionAngle, shake: state.shake },
      pxX, pxY,
      canvas.width, canvas.height,
      drawQuad
    );
    currentTex = motionDst.tex;
  }
  
  // Flash
  const flashDst = (currentTex === rtA.tex) ? rtB : rtA;
  applyFlash(
    gl, programs, quad, currentTex, flashDst,
    {
      centerX: state.flashCenterX,
      centerY: state.flashCenterY,
      strength: state.flashStrength,
      falloff: state.flashFalloff
    },
    canvas.width, canvas.height,
    drawQuad
  );
  currentTex = flashDst.tex;
  
  // Bloom prepass
  const brightDst = (currentTex === rtA.tex) ? rtB : rtA;
  extractBright(
    gl, programs, quad, currentTex, brightDst,
    state.bloomThreshold, state.bloomWarm,
    canvas.width, canvas.height,
    drawQuad
  );
  
  downsample(gl, programs, quad, brightDst.tex, brightDst.w, brightDst.h, rtH_A, canvas.width, canvas.height, drawQuad);
  downsample(gl, programs, quad, rtH_A.tex, rtH_A.w, rtH_A.h, rtQ_A, canvas.width, canvas.height, drawQuad);
  downsample(gl, programs, quad, rtQ_A.tex, rtQ_A.w, rtQ_A.h, rtE_A, canvas.width, canvas.height, drawQuad);
  
  blurHorizontalVertical(gl, programs, quad, rtE_A, rtE_B, state.bloomRadius * 0.6, canvas.width, canvas.height, drawQuad);
  blurHorizontalVertical(gl, programs, quad, rtQ_A, rtQ_B, state.bloomRadius * 0.8, canvas.width, canvas.height, drawQuad);
  blurHorizontalVertical(gl, programs, quad, rtH_A, rtH_B, state.bloomRadius * 1.0, canvas.width, canvas.height, drawQuad);
  
  upsampleAdd(gl, programs, quad, rtE_A.tex, rtQ_A.tex, rtQ_B, canvas.width, canvas.height, drawQuad);
  upsampleAdd(gl, programs, quad, rtQ_B.tex, rtH_A.tex, rtH_B, canvas.width, canvas.height, drawQuad);
  upsampleAdd(gl, programs, quad, rtH_B.tex, brightDst.tex, rtBloom, canvas.width, canvas.height, drawQuad);
  
  // Tone
  const toneDst1 = (currentTex === rtA.tex) ? rtB : rtA;
  applyTone(
    gl, programs, quad, currentTex, toneDst1,
    {
      scurve: state.scurve,
      blacks: state.blacks,
      knee: state.knee,
      blackLift: state.blackLift
    },
    canvas.width, canvas.height,
    drawQuad
  );
  
  // Split toning
  const splitDst = (toneDst1 === rtA) ? rtB : rtA;
  applySplitToning(
    gl, programs, quad, toneDst1.tex, splitDst,
    { shadowCool: state.shadowCool, highlightWarm: state.highlightWarm },
    canvas.width, canvas.height,
    drawQuad
  );
  
  // Color cast
  const castDst = (splitDst === rtA) ? rtB : rtA;
  applyColorCast(
    gl, programs, quad, splitDst.tex, castDst,
    { greenShadows: state.greenShadows, magentaMids: state.magentaMids },
    canvas.width, canvas.height,
    drawQuad
  );
  
  // Vignette
  const vigDst = (castDst === rtA) ? rtB : rtA;
  applyVignette(
    gl, programs, quad, castDst.tex, vigDst,
    state.vignette, state.vignettePower,
    canvas.width, canvas.height,
    drawQuad
  );
  
  // Bloom composite
  const bloomCompDst = (vigDst === rtA) ? rtB : rtA;
  compositeBloom(
    gl, programs, quad, vigDst.tex, rtBloom.tex, bloomCompDst,
    state.bloomIntensity, state.halation,
    canvas.width, canvas.height,
    drawQuad
  );
  let currentFB = bloomCompDst;
  
  // Clarity
  if (state.clarity > 0.001) {
    const clarDst = (currentFB === rtA) ? rtB : rtA;
    applyClarity(
      gl, programs, quad, currentFB.tex, clarDst,
      state.clarity, pxX, pxY,
      canvas.width, canvas.height,
      drawQuad
    );
    currentFB = clarDst;
  }
  
  // Chromatic aberration
  const caDst = (currentFB === rtA) ? rtB : rtA;
  applyChromaticAberration(
    gl, programs, quad, currentFB.tex, caDst,
    state.ca, pxX, pxY,
    canvas.width, canvas.height,
    drawQuad
  );
  currentFB = caDst;
  
  // Grain and output to screen
  applyGrain(
    gl, programs, quad, currentFB.tex,
    {
      asa: state.grainASA,
      develop: state.grainDevelop,
      stock: state.grainStock,
      chroma: state.grainChroma,
      magnify: state.grainMagnify
    },
    t,
    state.isVideo ? state.frameSeed : 0,
    canvas.width, canvas.height,
    drawQuad
  );
  
  state.needsRender = false;
  requestAnimationFrame(render);
}

// Boot
layout();
ensureRenderTargets();
requestAnimationFrame(render);