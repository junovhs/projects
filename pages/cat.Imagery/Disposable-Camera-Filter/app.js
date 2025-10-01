// Main application orchestrator with auto-generated UI

import { initGL, getCapabilities, createQuadBuffer, createTexture, createFramebuffer, ensureFramebuffer, compileShader, bindProgram } from './gl-context.js';
import { ExposureFlashModule, EXPOSURE_FLASH_PARAMS } from './modules/exposure-flash.js';
import { ToneModule, TONE_PARAMS } from './modules/tone.js';
import { SplitCastModule, SPLIT_CAST_PARAMS } from './modules/split-cast.js';
import { BloomVignetteOpticsModule, BLOOM_VIGNETTE_OPTICS_PARAMS } from './modules/bloom-vignette-optics.js';
import { MotionBlurModule, MOTION_BLUR_PARAMS, sliderToShutterSeconds, formatShutter, shutterToPixels } from './modules/motion-blur.js';
import { HandheldCameraModule, HANDHELD_PARAMS } from './modules/handheld-camera.js';
import { FilmGrainModule, GRAIN_PARAMS } from './modules/film-grain.js';
import { buildTar, exportPNGSequence } from './export-images.js';
import { initFFmpeg, exportMP4 } from './export-video.js';
import { download, toast, waitForVideoSeeked } from './utils.js';

const $ = s => document.querySelector(s);

// Copy shader for showing original
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

// Application state - will be populated from module params
const state = {
  mediaW: 960,
  mediaH: 540,
  dpr: Math.min(2, devicePixelRatio || 1),
  tex: null,
  isVideo: false,
  frameSeed: 0,
  
  // Special params
  flashCenterX: 0.5,
  flashCenterY: 0.5,
  
  // View state
  viewMode: 'fit',
  panX: 0,
  panY: 0,
  needsRender: true,
  showOriginal: false
};

// Initialize state from module params
function initStateFromModules() {
  const allParams = {
    ...EXPOSURE_FLASH_PARAMS,
    ...TONE_PARAMS,
    ...SPLIT_CAST_PARAMS,
    ...BLOOM_VIGNETTE_OPTICS_PARAMS,
    ...MOTION_BLUR_PARAMS,
    ...HANDHELD_PARAMS,
    ...GRAIN_PARAMS
  };
  
  for (const [key, config] of Object.entries(allParams)) {
    state[key] = config.default;
  }
}

initStateFromModules();

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

// Copy program for original view
const vs = compileShader(gl, gl.VERTEX_SHADER, COPY_VERTEX);
const fs = compileShader(gl, gl.FRAGMENT_SHADER, COPY_FRAGMENT);
const copyProgram = gl.createProgram();
gl.attachShader(copyProgram, vs);
gl.attachShader(copyProgram, fs);
gl.linkProgram(copyProgram);

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

function layout() {
  if (!state.mediaW || !state.mediaH) {
    canvas.style.width = canvas.style.height = '0px';
    return;
  }
  
  const container = document.getElementById('viewer');
  const containerW = container.clientWidth;
  const containerH = container.clientHeight;
  
  if (state.viewMode === 'fit') {
    // Fit mode - scale to container
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
    // 1:1 mode - render only visible area
    canvas.style.position = 'absolute';
    
    // Canvas buffer is only the size of the viewport
    const viewW = Math.min(state.mediaW, containerW);
    const viewH = Math.min(state.mediaH, containerH);
    
    if (canvas.width !== viewW || canvas.height !== viewH) {
      canvas.width = viewW;
      canvas.height = viewH;
      gl.viewport(0, 0, viewW, viewH);
      ensureRenderTargets();
      state.needsRender = true;
    }
    
    // CSS size matches actual pixels (1:1)
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
    
    // Initialize pan position
    if (typeof state.panX !== 'number' || typeof state.panY !== 'number') {
      state.panX = Math.round((containerW - state.mediaW) / 2);
      state.panY = Math.round((containerH - state.mediaH) / 2);
    }
    
    // Constrain pan
    const minX = containerW - state.mediaW;
    const maxX = 0;
    const minY = containerH - state.mediaH;
    const maxY = 0;
    state.panX = Math.max(minX, Math.min(maxX, state.panX));
    state.panY = Math.max(minY, Math.min(maxY, state.panY));
    
    // Position canvas
    canvas.style.left = state.panX + 'px';
    canvas.style.top = state.panY + 'px';
  }
  
  state.needsRender = true;
}

window.addEventListener('resize', layout);

// Auto-generate UI with intelligent tab organization
function generateUI() {
  // Organize controls into tabs - max 4 controls per tab on mobile
  const tabGroups = [
    {
      id: 'exposure',
      label: 'Exposure',
      controls: [
        { params: EXPOSURE_FLASH_PARAMS, keys: ['ev', 'flashStrength', 'flashFalloff'], hasFlashPad: true }
      ]
    },
    {
      id: 'tone',
      label: 'Tone',
      controls: [
        { params: TONE_PARAMS, keys: ['scurve', 'blacks', 'blackLift', 'knee'] }
      ]
    },
    {
      id: 'color',
      label: 'Color',
      controls: [
        { params: SPLIT_CAST_PARAMS, keys: ['shadowCool', 'highlightWarm', 'greenShadows', 'magentaMids'] }
      ]
    },
    {
      id: 'bloom',
      label: 'Bloom',
      controls: [
        { params: BLOOM_VIGNETTE_OPTICS_PARAMS, keys: ['bloomThreshold', 'bloomRadius', 'bloomIntensity', 'bloomWarm'] }
      ]
    },
    {
      id: 'optics',
      label: 'Optics',
      controls: [
        { params: BLOOM_VIGNETTE_OPTICS_PARAMS, keys: ['halation', 'vignette', 'vignettePower', 'ca', 'clarity'] }
      ]
    },
    {
      id: 'motion1',
      label: 'Motion',
      controls: [
        { params: MOTION_BLUR_PARAMS, keys: ['shutterUI', 'shake', 'motionAngle'] }
      ]
    },
    {
      id: 'motion2',
      label: 'Handheld',
      controls: [
        { params: HANDHELD_PARAMS, keys: ['shakeHandheld', 'shakeFreq', 'shakeAmpX', 'shakeAmpY', 'shakeRot'] }
      ]
    },
    {
      id: 'grain',
      label: 'Grain',
      controls: [
        { params: GRAIN_PARAMS, keys: Object.keys(GRAIN_PARAMS) }
      ]
    },
    {
      id: 'file',
      label: 'File',
      special: 'file'
    }
  ];
  
  const tabNav = document.getElementById('tab-nav');
  const tabContent = document.getElementById('tab-content');
  
  tabGroups.forEach(({ id, label, controls, special }) => {
    // Create tab button
    const tabBtn = document.createElement('button');
    tabBtn.className = 'tab';
    tabBtn.textContent = label;
    tabBtn.dataset.tab = id;
    tabNav.appendChild(tabBtn);
    
    // Create tab pane
    const pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.dataset.pane = id;
    
    if (special === 'file') {
      // File tab
      pane.innerHTML = `
        <div class="file-grid">
          <label class="btn btn-primary btn-full">
            <input id="file" type="file" accept="image/*,video/*" style="display:none" />
            Open File
          </label>
          <button id="play" class="btn btn-secondary" disabled>Play</button>
          <button id="original" class="btn btn-secondary">Original</button>
          <button id="view-mode" class="btn btn-secondary">Fit</button>
          <button id="reset" class="btn btn-secondary btn-full">Reset All</button>
          <button id="save-png" class="btn btn-primary btn-full">Save PNG</button>
          <button id="export-pngs" class="btn btn-secondary">Frames</button>
          <button id="export-mp4" class="btn btn-secondary">MP4</button>
        </div>
      `;
    } else {
      // Control tab
      controls.forEach(({ params, keys, hasFlashPad }) => {
        if (hasFlashPad) {
          const flashControl = document.createElement('div');
          flashControl.className = 'control';
          flashControl.innerHTML = `
            <div class="control-label">Flash Position</div>
            <div class="flash-pad" id="flashPad">
              <div class="flash-dot" id="flashDot"></div>
            </div>
          `;
          pane.appendChild(flashControl);
        }
        
        keys.forEach(key => {
          const config = params[key];
          if (!config) return;
          
          const control = document.createElement('div');
          control.className = 'control';
          
          if (config.special === 'shutter') {
            control.innerHTML = `
              <div class="control-header">
                <span class="control-label">${config.label}</span>
                <span class="control-value" id="${key}Label">${formatShutter(sliderToShutterSeconds(config.default))}</span>
              </div>
              <input type="range" id="${key}" min="${config.min}" max="${config.max}" step="${config.step}" value="${config.default}">
            `;
          } else {
            const displayValue = config.step < 0.01 ? config.default.toFixed(3) : 
                                config.step < 1 ? config.default.toFixed(2) : 
                                config.default.toFixed(0);
            control.innerHTML = `
              <div class="control-header">
                <span class="control-label">${config.label}</span>
                <span class="control-value" data-for="${key}">${displayValue}</span>
              </div>
              <input type="range" id="${key}" min="${config.min}" max="${config.max}" step="${config.step}" value="${config.default}">
            `;
          }
          
          pane.appendChild(control);
        });
      });
    }
    
    tabContent.appendChild(pane);
  });
  
  // Activate first tab
  tabNav.querySelector('.tab').classList.add('active');
  tabContent.querySelector('.tab-pane').classList.add('active');
}

// Tab switching
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panes = document.querySelectorAll('.tab-pane');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      document.querySelector(`[data-pane="${targetTab}"]`).classList.add('active');
    });
  });
}

// View mode toggle
function setupViewModeToggle() {
  const btn = document.getElementById('view-mode');
if (!btn) return;
  
  btn.addEventListener('click', () => {
    if (state.viewMode === 'fit') {
      state.viewMode = '1x';
      btn.textContent = '1:1';
      canvas.classList.add('grabbable');
      state.panX = undefined;
      state.panY = undefined;
    } else {
      state.viewMode = 'fit';
      btn.textContent = 'Fit';
      canvas.classList.remove('grabbable');
    }
    layout();
  });
}

// Bind all sliders
function bindAllSliders() {
  const allParams = {
    ...EXPOSURE_FLASH_PARAMS,
    ...TONE_PARAMS,
    ...SPLIT_CAST_PARAMS,
    ...BLOOM_VIGNETTE_OPTICS_PARAMS,
    ...MOTION_BLUR_PARAMS,
    ...HANDHELD_PARAMS,
    ...GRAIN_PARAMS
  };
  
  for (const [key, config] of Object.entries(allParams)) {
    const el = $(`#${key}`);
    if (!el) continue;
    
    if (config.special === 'shutter') {
      const lbl = $(`#${key}Label`);
      el.addEventListener('input', e => {
        state[key] = parseFloat(e.target.value);
        lbl.textContent = formatShutter(sliderToShutterSeconds(state[key]));
        state.needsRender = true;
      });
    } else {
      const lbl = $(`.control-value[data-for="${key}"]`);
      el.addEventListener('input', e => {
        state[key] = parseFloat(e.target.value);
        if (lbl) {
          const val = config.step < 0.01 ? state[key].toFixed(3) :
                      config.step < 1 ? state[key].toFixed(2) :
                      state[key].toFixed(0);
          lbl.textContent = val;
        }
        state.needsRender = true;
      });
    }
  }
}

// Setup flash pad
function setupFlashPad() {
  const pad = $('#flashPad');
  const dot = $('#flashDot');
  if (!pad || !dot) return;
  
  function showDot() {
    const r = pad.getBoundingClientRect();
    dot.style.left = ((1.0 - state.flashCenterX) * r.width) + 'px';
    dot.style.top = ((1.0 - state.flashCenterY) * r.height) + 'px';
  }
  
  function setFromPointer(e) {
    const r = pad.getBoundingClientRect();
    const cx = (e.clientX ?? e.touches?.[0]?.clientX);
    const cy = (e.clientY ?? e.touches?.[0]?.clientY);
    const fx = (cx - r.left) / r.width;
    const fy = (cy - r.top) / r.height;
    state.flashCenterX = 1.0 - Math.max(0, Math.min(1, fx));
    state.flashCenterY = 1.0 - Math.max(0, Math.min(1, fy));
    showDot();
    state.needsRender = true;
  }
  
  let drag = false;
  
  pad.addEventListener('mousedown', e => {
    drag = true;
    setFromPointer(e);
  });
  
  window.addEventListener('mousemove', e => {
    if (drag) setFromPointer(e);
  });
  
  window.addEventListener('mouseup', () => drag = false);
  
  pad.addEventListener('touchstart', e => {
    drag = true;
    setFromPointer(e);
  }, { passive: false });
  
  window.addEventListener('touchmove', e => {
    if (drag) {
      e.preventDefault();
      setFromPointer(e);
    }
  }, { passive: false });
  
  window.addEventListener('touchend', () => drag = false);
  
  showDot();
}

// Setup canvas interaction
function setupCanvasInteraction() {
  const container = document.getElementById('viewer');
  
  function showFlashDot() {
    const pad = document.getElementById('flashPad');
    const dot = document.getElementById('flashDot');
    if (!pad || !dot) return;
    const r = pad.getBoundingClientRect();
    dot.style.left = ((1.0 - state.flashCenterX) * r.width) + 'px';
    dot.style.top = ((1.0 - state.flashCenterY) * r.height) + 'px';
  }
  
  function setFlashFromCanvas(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const fx = (cx - r.left) / r.width;
    const fy = (cy - r.top) / r.height;
    state.flashCenterX = 1.0 - Math.max(0, Math.min(1, fx));
    state.flashCenterY = 1.0 - Math.max(0, Math.min(1, fy));
    showFlashDot();
    state.needsRender = true;
  }
  
  const ppos = e => {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };
  
  let dragging = false;
  let mode = 'flash';
  let sx = 0, sy = 0, ox = 0, oy = 0;
  
  const onDown = e => {
    const p = ppos(e);
    if (state.viewMode === '1x') {
      mode = 'pan';
      dragging = true;
      container.classList.add('dragging');
      sx = p.x;
      sy = p.y;
      ox = state.panX || 0;
      oy = state.panY || 0;
      e.preventDefault();
    } else {
      mode = 'flash';
      dragging = true;
      setFlashFromCanvas(p.x, p.y);
    }
  };
  
  const onMove = e => {
    if (!dragging) return;
    const p = ppos(e);
    if (mode === 'pan') {
      state.panX = ox + (p.x - sx);
      state.panY = oy + (p.y - sy);
      layout();
      e.preventDefault();
    } else {
      setFlashFromCanvas(p.x, p.y);
    }
  };
  
  const onUp = () => {
    dragging = false;
    container.classList.remove('dragging');
  };
  
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  
  canvas.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('touchmove', e => {
    if (dragging && mode === 'pan') {
      e.preventDefault();
      onMove(e);
    }
  }, { passive: false });
  window.addEventListener('touchend', onUp);
}

// Initialize UI
generateUI();
setupTabs();
bindAllSliders();
setupFlashPad();
setupCanvasInteraction();
setupViewModeToggle();

// File loading - the label already triggers the file input, no need for separate handler
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
const playBtn = document.getElementById('play');
if (playBtn) {
  playBtn.onclick = () => {
    if (!state.isVideo) return;
    if (video.paused) {
      video.play();
      playBtn.textContent = 'Pause';
    } else {
      video.pause();
      playBtn.textContent = 'Play';
    }
  };
}

const originalBtn = document.getElementById('original');
if (originalBtn) {
  originalBtn.onclick = () => {
    state.showOriginal = !state.showOriginal;
    originalBtn.classList.toggle('active', state.showOriginal);
    state.needsRender = true;
  };
}

// Reset
$('#reset').onclick = () => {
  initStateFromModules();
  state.flashCenterX = 0.5;
  state.flashCenterY = 0.5;
  
  // Re-bind all sliders to defaults
  const allParams = {
    ...EXPOSURE_FLASH_PARAMS,
    ...TONE_PARAMS,
    ...SPLIT_CAST_PARAMS,
    ...BLOOM_VIGNETTE_OPTICS_PARAMS,
    ...MOTION_BLUR_PARAMS,
    ...HANDHELD_PARAMS,
    ...GRAIN_PARAMS
  };
  
  for (const [key, config] of Object.entries(allParams)) {
    const el = $(`#${key}`);
    if (!el) continue;
    el.value = config.default;
    
    if (config.special === 'shutter') {
      const lbl = $(`#${key}Label`);
      if (lbl) lbl.textContent = formatShutter(sliderToShutterSeconds(config.default));
    } else {
      const lbl = $(`.control-value[data-for="${key}"]`);
      if (lbl) {
        const val = config.step < 0.01 ? config.default.toFixed(3) :
                    config.step < 1 ? config.default.toFixed(2) :
                    config.default.toFixed(0);
        lbl.textContent = val;
      }
    }
  }
  
  setupFlashPad();
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
  
  // Pre-exposure
  exposureFlash.applyExposure(state.tex, rtA, state.ev, canvas.width, canvas.height);
  let currentTex = rtA.tex;
  
  // Handheld shake (video only)
  if (state.isVideo && state.shakeHandheld > 0.001) {
    const shakeDst = (currentTex === rtA.tex) ? rtB : rtA;
    handheldCamera.apply(
      currentTex, shakeDst,
      state,
      state.frameSeed,
      canvas.width, canvas.height
    );
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
      pxX, pxY,
      canvas.width, canvas.height
    );
    currentTex = motionDst.tex;
  }
  
  // Flash
  const flashDst = (currentTex === rtA.tex) ? rtB : rtA;
  exposureFlash.applyFlash(
    currentTex, flashDst,
    {
      centerX: state.flashCenterX,
      centerY: state.flashCenterY,
      strength: state.flashStrength,
      falloff: state.flashFalloff
    },
    canvas.width, canvas.height
  );
  currentTex = flashDst.tex;
  
  // Bloom prepass
  const brightDst = (currentTex === rtA.tex) ? rtB : rtA;
  bloomVignetteOptics.extractBright(
    currentTex, brightDst,
    state.bloomThreshold, state.bloomWarm,
    canvas.width, canvas.height
  );
  
  bloomVignetteOptics.downsample(brightDst.tex, brightDst.w, brightDst.h, rtH_A, canvas.width, canvas.height);
  bloomVignetteOptics.downsample(rtH_A.tex, rtH_A.w, rtH_A.h, rtQ_A, canvas.width, canvas.height);
  bloomVignetteOptics.downsample(rtQ_A.tex, rtQ_A.w, rtQ_A.h, rtE_A, canvas.width, canvas.height);
  
  bloomVignetteOptics.blurHorizontalVertical(rtE_A, rtE_B, state.bloomRadius * 0.6, canvas.width, canvas.height);
  bloomVignetteOptics.blurHorizontalVertical(rtQ_A, rtQ_B, state.bloomRadius * 0.8, canvas.width, canvas.height);
  bloomVignetteOptics.blurHorizontalVertical(rtH_A, rtH_B, state.bloomRadius * 1.0, canvas.width, canvas.height);
  
  bloomVignetteOptics.upsampleAdd(rtE_A.tex, rtQ_A.tex, rtQ_B, canvas.width, canvas.height);
  bloomVignetteOptics.upsampleAdd(rtQ_B.tex, rtH_A.tex, rtH_B, canvas.width, canvas.height);
  bloomVignetteOptics.upsampleAdd(rtH_B.tex, brightDst.tex, rtBloom, canvas.width, canvas.height);
  
  // Tone
  const toneDst1 = (currentTex === rtA.tex) ? rtB : rtA;
  tone.apply(
    currentTex, toneDst1,
    {
      scurve: state.scurve,
      blacks: state.blacks,
      knee: state.knee,
      blackLift: state.blackLift
    },
    canvas.width, canvas.height
  );
  
  // Split toning
  const splitDst = (toneDst1 === rtA) ? rtB : rtA;
  splitCast.applySplit(
    toneDst1.tex, splitDst,
    { shadowCool: state.shadowCool, highlightWarm: state.highlightWarm },
    canvas.width, canvas.height
  );
  
  // Color cast
  const castDst = (splitDst === rtA) ? rtB : rtA;
  splitCast.applyCast(
    splitDst.tex, castDst,
    { greenShadows: state.greenShadows, magentaMids: state.magentaMids },
    canvas.width, canvas.height
  );
  
  // Vignette
  const vigDst = (castDst === rtA) ? rtB : rtA;
  bloomVignetteOptics.applyVignette(
    castDst.tex, vigDst,
    state.vignette, state.vignettePower,
    canvas.width, canvas.height
  );
  
  // Bloom composite
  const bloomCompDst = (vigDst === rtA) ? rtB : rtA;
  bloomVignetteOptics.compositeBloom(
    vigDst.tex, rtBloom.tex, bloomCompDst,
    state.bloomIntensity, state.halation,
    canvas.width, canvas.height
  );
  let currentFB = bloomCompDst;
  
  // Clarity
  if (state.clarity > 0.001) {
    const clarDst = (currentFB === rtA) ? rtB : rtA;
    bloomVignetteOptics.applyClarity(
      currentFB.tex, clarDst,
      state.clarity, pxX, pxY,
      canvas.width, canvas.height
    );
    currentFB = clarDst;
  }
  
  // Chromatic aberration
  const caDst = (currentFB === rtA) ? rtB : rtA;
  bloomVignetteOptics.applyChromaticAberration(
    currentFB.tex, caDst,
    state.ca, pxX, pxY,
    canvas.width, canvas.height
  );
  currentFB = caDst;
  
  // Grain and output to screen
  filmGrain.apply(
    currentFB.tex,
    state,
    t,
    state.isVideo ? state.frameSeed : 0,
    canvas.width, canvas.height
  );
  
  state.needsRender = false;
  requestAnimationFrame(render);
}

// Boot
layout();
ensureRenderTargets();
requestAnimationFrame(render);