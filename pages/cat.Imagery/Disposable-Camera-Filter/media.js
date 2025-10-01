// Media file loading and video playback controls
import { createTexture } from './gl-context.js';
import { sliderToShutterSeconds, formatShutter } from './modules/motion-blur.js';

const $ = s => document.querySelector(s);

export function setupFileInput(state, gl, layout, onMediaLoaded) {
  const video = $('#vid');
  
  $('#file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    
    (f.type || '').startsWith('video/') ? 
      loadVideo(f, state, gl, video, layout, onMediaLoaded) : 
      loadImage(f, state, gl, layout, onMediaLoaded);
  });
  
  return { video };
}

function loadImage(file, state, gl, layout, onMediaLoaded) {
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
    if (onMediaLoaded) onMediaLoaded();
  };
  img.src = URL.createObjectURL(file);
}

function loadVideo(file, state, gl, video, layout, onMediaLoaded) {
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
    if (onMediaLoaded) onMediaLoaded();
    
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

export function setupTransportControls(state) {
  const video = $('#vid');
  const playBtn = $('#play');
  const originalBtn = $('#original');
  
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
  
  if (originalBtn) {
    originalBtn.onclick = () => {
      state.showOriginal = !state.showOriginal;
      originalBtn.classList.toggle('active', state.showOriginal);
      state.needsRender = true;
    };
  }
}

export function setupResetButton(state, allParams, setupFlashPad) {
  $('#reset').onclick = () => {
    // Reset state to defaults
    for (const [key, config] of Object.entries(allParams)) {
      state[key] = config.default;
    }
    state.flashCenterX = 0.5;
    state.flashCenterY = 0.5;
    
    // Update all sliders
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
    
    setupFlashPad(state);
    state.needsRender = true;
  };
}