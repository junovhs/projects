// UI generation, tab management, and user interaction
import { EXPOSURE_FLASH_PARAMS } from './modules/exposure-flash.js';
import { TONE_PARAMS } from './modules/tone.js';
import { SPLIT_CAST_PARAMS } from './modules/split-cast.js';
import { BLOOM_VIGNETTE_OPTICS_PARAMS } from './modules/bloom-vignette-optics.js';
import { MOTION_BLUR_PARAMS, sliderToShutterSeconds, formatShutter } from './modules/motion-blur.js';
import { HANDHELD_PARAMS } from './modules/handheld-camera.js';
import { GRAIN_PARAMS } from './modules/film-grain.js';

const $ = s => document.querySelector(s);

// Tab configuration with correct parameter keys
const TAB_GROUPS = [
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
    id: 'motion',
    label: 'Motion',
    controls: [
      { params: MOTION_BLUR_PARAMS, keys: ['shutterUI', 'shake', 'motionAngle'] }
    ]
  },
  {
    id: 'handheld',
    label: 'Handheld',
    controls: [
      { params: HANDHELD_PARAMS, keys: ['shakeHandheld', 'shakeStyle', 'shakeWobble', 'shakeJitter'] }
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

export function generateUI() {
  const tabNav = $('#tab-nav');
  const tabContent = $('#tab-content');
  
  TAB_GROUPS.forEach(({ id, label, controls, special }) => {
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

export function setupTabs() {
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

export function bindAllSliders(state, allParams) {
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

export function setupFlashPad(state) {
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
  
  return { showDot };
}

export function setupCanvasInteraction(canvas, state, layout) {
  const container = $('#viewer');
  
  function showFlashDot() {
    const pad = $('#flashPad');
    const dot = $('#flashDot');
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

export function setupViewModeToggle(state, canvas, layout) {
  const btn = $('#view-mode');
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