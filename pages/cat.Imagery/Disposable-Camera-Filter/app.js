// Main application - WebGL setup, render loop, and module orchestration
import { initGL, getCapabilities, createQuadBuffer, ensureFramebuffer, compileShader, bindProgram } from './gl-context.js';
import { ExposureFlashModule, EXPOSURE_FLASH_PARAMS } from './modules/exposure-flash.js';
import { ToneModule, TONE_PARAMS } from './modules/tone.js';
import { SplitCastModule, SPLIT_CAST_PARAMS } from './modules/split-cast.js';
import { BloomVignetteOpticsModule, BLOOM_VIGNETTE_OPTICS_PARAMS } from './modules/bloom-vignette-optics.js';
import { MotionBlurModule, MOTION_BLUR_PARAMS, sliderToShutterSeconds, shutterToPixels } from './modules/motion-blur.js';
import { HandheldCameraModule, HANDHELD_PARAMS } from './modules/handheld-camera.js';
import { FilmGrainModule, GRAIN_PARAMS } from './modules/film-grain.js';
import { generateUI, setupTabs, bindAllSliders, setupFlashPad, setupCanvasInteraction, setupViewModeToggle } from './ui.js';
import { setupFileInput, setupTransportControls, setupResetButton } from './media.js';
import { setupExportButtons } from './export.js';

const $ = s => document.querySelector(s);

// Collect all parameters
const ALL_PARAMS = {
  ...EXPOSURE_FLASH_PARAMS,
  ...TONE_PARAMS,
  ...SPLIT_CAST_PARAMS,
  ...BLOOM_VIGNETTE_OPTICS_PARAMS,
  ...MOTION_BLUR_PARAMS,
  ...HANDHELD_PARAMS,
  ...GRAIN_PARAMS
};

// Application state
const state = {
  mediaW: 960,
  mediaH: 540,
  dpr: Math.min(2, devicePixelRatio || 1),
  tex: null,
  isVideo: false,
  frameSeed: 0,
  flashCenterX: 0.5,
  flashCenterY: 0.5,
  viewMode: 'fit',
  panX: 0,
  panY: 0,
  needsRender: true,
  showOriginal: false
};

// Initialize state from module defaults
for (const [key, config] of Object.entries(ALL_PARAMS)) {
  state[key] = config.default;
}

// Initialize WebGL
const canvas = $('#gl');
const gl = initGL(canvas);
if (!gl) throw new Error('WebGL initialization failed');

const caps = getCapabilities(gl);
const quad = createQuadBuffer(gl);

// Initialize effect modules
const exposureFlash = new ExposureFlashModule(gl, quad);
const tone = new ToneModule(gl, quad);
const splitCast = new SplitCastModule(gl, quad);
const bloomVignetteOptics = new BloomVignetteOpticsModule(gl, quad);
const motionBlur = new MotionBlurModule(gl, quad);
const handheldCamera = new HandheldCameraModule(gl, quad);
const filmGrain = new FilmGrainModule(gl, quad);

// Copy program for showing original
const COPY_VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0, 1);
}
`;

const COPY_FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D uTex;
void main() {
  gl_FragColor = vec4(texture2D(uTex, v_uv).rgb, 1.0);
}
`;

const vs = compileShader(gl, gl.VERTEX_SHADER, COPY_VERTEX);
const fs = compileShader(gl, gl.FRAGMENT_SHADER, COPY_FRAGMENT);
const copyProgram = gl.createProgram();
gl.attachShader(copyProgram, vs);
gl.attachShader(copyProgram, fs);
gl.linkProgram(copyProgram);

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

function layout() {
  if (!state.mediaW || !state.mediaH) {
    canvas.style.width = canvas.style.height = '0px';
    return;
  }
  
  const container = $('#viewer');
  const containerW = container.clientWidth;
  const containerH = container.clientHeight;
  
  if (state.viewMode === 'fit') {
    canvas.style.position = 'static';
    canvas.style.left = '';
    canvas.style.top = '';
    canvas.style.transform = '';
    
    const scale = Math.min(containerW / state.mediaW, containerH / state.mediaH);
    const cssW = Math.max(1, Math.round(state.mediaW * scale));
    const cssH = Math.max(1, Math.round(state.mediaH * scale));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    
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
    canvas.style.position = 'absolute';
    const viewW = Math.min(state.mediaW, containerW);
    const viewH = Math.min(state.mediaH, containerH);
    
    if (canvas.width !== viewW || canvas.height !== viewH) {
      canvas.width = viewW;
      canvas.height = viewH;
      gl.viewport(0, 0, viewW, viewH);
      ensureRenderTargets();
      state.needsRender = true;
    }
    
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
    
    if (typeof state.panX !== 'number' || typeof state.panY !== 'number') {
      state.panX = Math.round((containerW - state.mediaW) / 2);
      state.panY = Math.round((containerH - state.mediaH) / 2);
    }
    
    const minX = containerW - state.mediaW;
    const maxX = 0;
    const minY = containerH - state.mediaH;
    const maxY = 0;
    state.panX = Math.max(minX, Math.min(maxX, state.panX));
    state.panY = Math.max(minY, Math.min(maxY, state.panY));
    
    canvas.style.left = state.panX + 'px';
    canvas.style.top = state.panY + 'px';
  }
  
  state.needsRender = true;
}

window.addEventListener('resize', layout);

// Initialize UI
generateUI();
setupTabs();
bindAllSliders(state, ALL_PARAMS);
setupFlashPad(state);
setupCanvasInteraction(canvas, state, layout);
setupViewModeToggle(state, canvas, layout);

// Initialize media controls
const { video } = setupFileInput(state, gl, layout, null);
setupTransportControls(state);
setupResetButton(state, ALL_PARAMS, setupFlashPad);

// Initialize export controls
setupExportButtons(state, canvas, gl, video, render, ensureRenderTargets);

// Main render function
function render(t = performance.now()) {
  if (!state.tex) {
    gl.clearColor(0.05, 0.06, 0.08, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    requestAnimationFrame(render);
    return;
  }
  
  if (state.showOriginal) {
    bindProgram(gl, copyProgram, quad, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.tex);
    gl.uniform1i(gl.getUniformLocation(copyProgram, 'uTex'), 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    state.needsRender = false;
    requestAnimationFrame(render);
    return;
  }
  
  const pxX = 1 / canvas.width;
  const pxY = 1 / canvas.height;
  
  // Apply all effects in pipeline
  exposureFlash.applyExposure(state.tex, rtA, state.ev, canvas.width, canvas.height);
  let currentTex = rtA.tex;
  
  // Handheld shake (video only)
  if (state.isVideo && state.shakeHandheld > 0.001) {
    const shakeDst = (currentTex === rtA.tex) ? rtB : rtA;
    handheldCamera.apply(currentTex, shakeDst, state, state.frameSeed, canvas.width, canvas.height);
    currentTex = shakeDst.tex;
  }
  
  // Motion blur
  const sh = sliderToShutterSeconds(state.shutterUI);
  const motionAmt = shutterToPixels(sh, state.shake);
  if (motionAmt > 0.05) {
    const motionDst = (currentTex === rtA.tex) ? rtB : rtA;
    motionBlur.apply(
      currentTex, motionDst,
      { amount: motionAmt, angle: state.motionAngle, shake: state.shake },
      pxX, pxY, canvas.width, canvas.height
    );
    currentTex = motionDst.tex;
  }
  
  // Flash
  const flashDst = (currentTex === rtA.tex) ? rtB : rtA;
  exposureFlash.applyFlash(
    currentTex, flashDst,
    { centerX: state.flashCenterX, centerY: state.flashCenterY, strength: state.flashStrength, falloff: state.flashFalloff },
    canvas.width, canvas.height
  );
  currentTex = flashDst.tex;
  
  // Bloom pipeline
  const brightDst = (currentTex === rtA.tex) ? rtB : rtA;
  bloomVignetteOptics.extractBright(currentTex, brightDst, state.bloomThreshold, state.bloomWarm, canvas.width, canvas.height);
  bloomVignetteOptics.downsample(brightDst.tex, brightDst.w, brightDst.h, rtH_A, canvas.width, canvas.height);
  bloomVignetteOptics.downsample(rtH_A.tex, rtH_A.w, rtH_A.h, rtQ_A, canvas.width, canvas.height);
  bloomVignetteOptics.downsample(rtQ_A.tex, rtQ_A.w, rtQ_A.h, rtE_A, canvas.width, canvas.height);
  bloomVignetteOptics.blurHorizontalVertical(rtE_A, rtE_B, state.bloomRadius * 0.6, canvas.width, canvas.height);
  bloomVignetteOptics.blurHorizontalVertical(rtQ_A, rtQ_B, state.bloomRadius * 0.8, canvas.width, canvas.height);
  bloomVignetteOptics.blurHorizontalVertical(rtH_A, rtH_B, state.bloomRadius * 1.0, canvas.width, canvas.height);
  bloomVignetteOptics.upsampleAdd(rtE_A.tex, rtQ_A.tex, rtQ_B, canvas.width, canvas.height);
  bloomVignetteOptics.upsampleAdd(rtQ_B.tex, rtH_A.tex, rtH_B, canvas.width, canvas.height);
  bloomVignetteOptics.upsampleAdd(rtH_B.tex, brightDst.tex, rtBloom, canvas.width, canvas.height);
  
  // Tone, color, and optics
  const toneDst = (currentTex === rtA.tex) ? rtB : rtA;
  tone.apply(currentTex, toneDst, { scurve: state.scurve, blacks: state.blacks, knee: state.knee, blackLift: state.blackLift }, canvas.width, canvas.height);
  
  const splitDst = (toneDst === rtA) ? rtB : rtA;
  splitCast.applySplit(toneDst.tex, splitDst, { shadowCool: state.shadowCool, highlightWarm: state.highlightWarm }, canvas.width, canvas.height);
  
  const castDst = (splitDst === rtA) ? rtB : rtA;
  splitCast.applyCast(splitDst.tex, castDst, { greenShadows: state.greenShadows, magentaMids: state.magentaMids }, canvas.width, canvas.height);
  
  const vigDst = (castDst === rtA) ? rtB : rtA;
  bloomVignetteOptics.applyVignette(castDst.tex, vigDst, state.vignette, state.vignettePower, canvas.width, canvas.height);
  
  const bloomCompDst = (vigDst === rtA) ? rtB : rtA;
  bloomVignetteOptics.compositeBloom(vigDst.tex, rtBloom.tex, bloomCompDst, state.bloomIntensity, state.halation, canvas.width, canvas.height);
  let currentFB = bloomCompDst;
  
  if (state.clarity > 0.001) {
    const clarDst = (currentFB === rtA) ? rtB : rtA;
    bloomVignetteOptics.applyClarity(currentFB.tex, clarDst, state.clarity, pxX, pxY, canvas.width, canvas.height);
    currentFB = clarDst;
  }
  
  const caDst = (currentFB === rtA) ? rtB : rtA;
  bloomVignetteOptics.applyChromaticAberration(currentFB.tex, caDst, state.ca, pxX, pxY, canvas.width, canvas.height);
  currentFB = caDst;
  
  // Final grain and output
  filmGrain.apply(currentFB.tex, state, t, state.isVideo ? state.frameSeed : 0, canvas.width, canvas.height);
  
  state.needsRender = false;
  requestAnimationFrame(render);
}

// Boot
layout();
ensureRenderTargets();
requestAnimationFrame(render);