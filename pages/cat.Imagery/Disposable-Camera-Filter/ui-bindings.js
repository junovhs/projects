// UI control bindings and interactions

export function setupRangeBindings(state, params) {
  const $ = s => document.querySelector(s);
  
  function fmt(v, step) {
    return (step && step < 0.01) ? (+v).toFixed(3) : (+v).toFixed(2);
  }
  
  function bindRange(id, key) {
    const el = $('#' + id);
    const lbl = $(`.val[data-for="${id}"]`);
    
    const set = v => {
      v = parseFloat(v);
      state[key] = v;
      el.value = v;
      if (lbl) {
        lbl.textContent = (id === 'motionAngle' ? v.toFixed(0) : fmt(v, el.step));
      }
      state.needsRender = true;
    };
    
    el.addEventListener('input', e => set(e.target.value));
    set(state[key]);
    
    return set;
  }
  
  const bindings = {};
  
  params.forEach(id => {
    bindings[id] = bindRange(id, id);
  });
  
  return bindings;
}

export function setupShutterBinding(state) {
  const $ = s => document.querySelector(s);
  const el = $('#shutterUI');
  const lbl = $('#shutterLabel');
  
  const sliderToShutterSeconds = (v) => {
    const sMin = 1 / 250, sMax = 0.5;
    return Math.pow(sMax / sMin, v) * sMin;
  };
  
  const formatShutter = (s) => {
    return s >= 1 ? `${s.toFixed(1)}s` : `1/${Math.round(1 / s)}`;
  };
  
  const set = v => {
    state.shutterUI = +v;
    lbl.textContent = formatShutter(sliderToShutterSeconds(state.shutterUI));
    state.needsRender = true;
  };
  
  el.addEventListener('input', e => set(e.target.value));
  set(state.shutterUI);
  
  return set;
}

export function setupFlashPad(state) {
  const $ = s => document.querySelector(s);
  const pad = $('#flashPad');
  const dot = $('#flashDot');
  
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

export function setupCanvasInteraction(canvas, state) {
  const vp = document.getElementById('viewport');
  const flashPad = document.getElementById('flashPad');
  const flashDot = document.getElementById('flashDot');
  
  function showFlashDot() {
    const r = flashPad.getBoundingClientRect();
    flashDot.style.left = ((1.0 - state.flashCenterX) * r.width) + 'px';
    flashDot.style.top = ((1.0 - state.flashCenterY) * r.height) + 'px';
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
      vp.classList.add('dragging');
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
      state.needsRender = true;
      e.preventDefault();
    } else {
      setFlashFromCanvas(p.x, p.y);
    }
  };
  
  const onUp = () => {
    dragging = false;
    vp.classList.remove('dragging');
  };
  
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  
  canvas.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('touchmove', e => {
    if (dragging) {
      e.preventDefault();
      onMove(e);
    }
  }, { passive: false });
  window.addEventListener('touchend', onUp);
}