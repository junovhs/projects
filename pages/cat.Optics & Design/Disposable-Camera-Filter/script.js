(function () {
  // ---------- State ----------
  const state = {
    img: null,
    imgTex: null,
    width: 1280,
    height: 720,
    dpr: Math.min(2, window.devicePixelRatio || 1),
    ev: -0.40,
    flashStrength: 1.00,
    flashFalloff: 4.50,
    flashCenterX: 0.50,
    flashCenterY: 0.46,
    scurve: 0.60,
    blacks: 0.06,
    knee: 0.12,
    shadowCool: 0.35,
    highlightWarm: 0.35,
    bloomThreshold: 0.80,
    bloomRadius: 14.0,
    bloomIntensity: 0.50,
    bloomWarm: 0.30,
    vignette: 0.18,
    vignettePower: 2.5,
    ca: 1.00,
    clarity: 0.00,
    grain: 0.025,
    grainShadowBoost: 0.70,
    needsRender: true,
    draggingFlash: false,
    zoom: 1.0,
    panX: 0,
    panY: 0,
    showingBefore: false,
  };

  const presetDefs = {
    street: {
      ev: -0.40, flashStrength: 0.95, flashFalloff: 4.8, flashCenterY: 0.47,
      scurve: 0.58, blacks: 0.06, knee: 0.12, shadowCool: 0.32, highlightWarm: 0.35,
      bloomThreshold: 0.80, bloomRadius: 16, bloomIntensity: 0.45, bloomWarm: 0.30,
      vignette: 0.18, vignettePower: 2.4, ca: 1.0, clarity: 0.05, grain: 0.028
    },
    kids: {
      ev: -0.30, flashStrength: 1.05, flashFalloff: 3.6,
      scurve: 0.65, blacks: 0.05, knee: 0.15, shadowCool: 0.20, highlightWarm: 0.40,
      bloomThreshold: 0.82, bloomRadius: 20, bloomIntensity: 0.60, bloomWarm: 0.36,
      vignette: 0.12, vignettePower: 2.2, ca: 0.9, clarity: 0.06, grain: 0.02
    },
    skate: {
      ev: -0.52, flashStrength: 0.75, flashFalloff: 5.8,
      scurve: 0.48, blacks: 0.08, knee: 0.10, shadowCool: 0.45, highlightWarm: 0.25,
      bloomThreshold: 0.85, bloomRadius: 10, bloomIntensity: 0.25, bloomWarm: 0.20,
      vignette: 0.22, vignettePower: 2.8, ca: 1.1, clarity: 0.00, grain: 0.035
    },
    club: {
      ev: -0.38, flashStrength: 1.10, flashFalloff: 4.0,
      scurve: 0.62, blacks: 0.06, knee: 0.16, shadowCool: 0.30, highlightWarm: 0.40,
      bloomThreshold: 0.78, bloomRadius: 22, bloomIntensity: 0.65, bloomWarm: 0.42,
      vignette: 0.16, vignettePower: 2.3, ca: 0.8, clarity: 0.07, grain: 0.026
    }
  };

  // ---------- Mobile tab system ----------
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      
      // Update tab buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update tab content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${targetTab}`) {
          content.classList.add('active');
        }
      });
    });
  });

  // ---------- Control bindings ----------
  function setupControlBinding(desktopId, mobileId, stateKey, updateCallback) {
    const desktopControl = document.getElementById(desktopId);
    const mobileControl = document.getElementById(mobileId);
    
    function updateValue(value) {
      state[stateKey] = parseFloat(value);
      if (desktopControl) {
        desktopControl.value = value;
        const valueDisplay = desktopControl.parentElement.querySelector('.control-value');
        if (valueDisplay) valueDisplay.textContent = parseFloat(value).toFixed(3);
      }
      if (mobileControl) {
        mobileControl.value = value;
        const valueDisplay = mobileControl.parentElement.querySelector('.control-value');
        if (valueDisplay) valueDisplay.textContent = parseFloat(value).toFixed(3);
      }
      if (updateCallback) updateCallback(value);
      state.needsRender = true;
    }
    
    if (desktopControl) {
      desktopControl.addEventListener('input', e => updateValue(e.target.value));
    }
    if (mobileControl) {
      mobileControl.addEventListener('input', e => updateValue(e.target.value));
    }
    
    return updateValue;
  }

  // Setup control bindings
  const updateEV = setupControlBinding('ev-slider', 'mobile-ev', 'ev');
  const updateFalloff = setupControlBinding('falloff-slider', 'mobile-falloff', 'flashFalloff');
  const updateScurve = setupControlBinding('scurve-slider', 'mobile-scurve', 'scurve');
  const updateBlacks = setupControlBinding('blacks-slider', 'mobile-blacks', 'blacks');
  const updateKnee = setupControlBinding('knee-slider', 'mobile-knee', 'knee');
  const updateShadowCool = setupControlBinding('shadow-cool-slider', null, 'shadowCool');
  const updateHighlightWarm = setupControlBinding('highlight-warm-slider', null, 'highlightWarm');
  const updateBloomThreshold = setupControlBinding('bloom-threshold-slider', null, 'bloomThreshold');
  const updateBloomRadius = setupControlBinding('bloom-radius-slider', null, 'bloomRadius');
  const updateBloomIntensity = setupControlBinding('bloom-intensity-slider', 'mobile-bloom-intensity', 'bloomIntensity');
  const updateBloomWarm = setupControlBinding('bloom-warm-slider', null, 'bloomWarm');
  const updateVignette = setupControlBinding('vignette-slider', 'mobile-vignette', 'vignette');
  const updateVignettePower = setupControlBinding('vignette-power-slider', null, 'vignettePower');
  const updateCA = setupControlBinding('ca-slider', null, 'ca');
  const updateClarity = setupControlBinding('clarity-slider', null, 'clarity');
  const updateGrain = setupControlBinding('grain-slider', 'mobile-grain', 'grain');

  // Wire desktop x-knob and mobile slider to flashStrength
  const flashKnob = document.getElementById('flash-knob');
  const mobileFlashStrengthSlider = document.getElementById('mobile-flash-strength');

  function updateFlashStrength(value) {
    const v = parseFloat(value);
    state.flashStrength = v;
    state.needsRender = true;
    
    if (flashKnob) {
      flashKnob.value = v;
      const vSpan = document.getElementById('flash-knob-value');
      if (vSpan) vSpan.textContent = v.toFixed(2);
    }
    if (mobileFlashStrengthSlider) {
      mobileFlashStrengthSlider.value = v;
      const valueDisplay = mobileFlashStrengthSlider.parentElement.querySelector('.control-value');
      if (valueDisplay) valueDisplay.textContent = v.toFixed(2);
    }
  }

  if (flashKnob) {
    flashKnob.min = 0; flashKnob.max = 1.5; flashKnob.step = 0.01; flashKnob.value = state.flashStrength;
    flashKnob.addEventListener('input', e => updateFlashStrength(e.currentTarget.value));
    flashKnob.addEventListener('change', e => updateFlashStrength(e.currentTarget.value));
    updateFlashStrength(state.flashStrength);
  }

  if(mobileFlashStrengthSlider) {
    mobileFlashStrengthSlider.addEventListener('input', e => updateFlashStrength(e.target.value));
  }

  // 2D position pad
  function setup2DPad() {
    const pad = document.getElementById('position-pad');
    const handle = document.getElementById('position-handle');
    if (!pad || !handle) return;
    
    let isDragging = false;
    
    function updatePosition(x, y) {
      state.flashCenterX = Math.max(0, Math.min(1, x));
      state.flashCenterY = Math.max(0, Math.min(1, y));
      
      const padRect = pad.getBoundingClientRect();
      const handleX = state.flashCenterX * (padRect.width - 12);
      const handleY = state.flashCenterY * (padRect.height - 12);
      
      handle.style.left = handleX + 'px';
      handle.style.top = handleY + 'px';
      
      state.needsRender = true;
    }
    
    function handlePointerEvent(e) {
      const rect = pad.getBoundingClientRect();
      const x = ((e.clientX || e.touches[0].clientX) - rect.left) / rect.width;
      const y = ((e.clientY || e.touches[0].clientY) - rect.top) / rect.height;
      updatePosition(x, y);
    }
    
    pad.addEventListener('mousedown', e => {
      isDragging = true;
      handlePointerEvent(e);
    });
    
    pad.addEventListener('touchstart', e => {
      isDragging = true;
      handlePointerEvent(e);
    });
    
    window.addEventListener('mousemove', e => {
      if (isDragging) handlePointerEvent(e);
    });
    
    window.addEventListener('touchmove', e => {
      if (isDragging) handlePointerEvent(e);
    });
    
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('touchend', () => isDragging = false);
    
    // Initialize position
    updatePosition(state.flashCenterX, state.flashCenterY);
  }
  
  setup2DPad();

  // Mobile position presets
  const posPresets = document.querySelectorAll('.pos-preset');
  posPresets.forEach(preset => {
    preset.addEventListener('click', () => {
      const [x, y] = preset.dataset.pos.split(',').map(parseFloat);
      state.flashCenterX = x;
      state.flashCenterY = y;
      
      // Update active state
      posPresets.forEach(p => p.classList.remove('active'));
      preset.classList.add('active');
      
      // Update 2D pad if on desktop
      const handle = document.getElementById('position-handle');
      if (handle) {
        const pad = document.getElementById('position-pad');
        const padRect = pad.getBoundingClientRect();
        handle.style.left = (x * (padRect.width - 12)) + 'px';
        handle.style.top = (y * (padRect.height - 12)) + 'px';
      }
      
      state.needsRender = true;
    });
  });

  // ---------- Canvas controls ----------
  document.getElementById('zoom-fit')?.addEventListener('click', () => {
    state.zoom = 1.0;
    state.panX = 0;
    state.panY = 0;
    if (state.img) resizeToFit(state.img.naturalWidth, state.img.naturalHeight);
  });

  document.getElementById('zoom-100')?.addEventListener('click', () => {
    state.zoom = 1.0;
    state.panX = 0;
    state.panY = 0;
    if (state.img) setSize(state.img.naturalWidth, state.img.naturalHeight);
  });

  let compareTimeout;
  document.getElementById('compare')?.addEventListener('mousedown', () => {
    state.showingBefore = true;
    state.needsRender = true;
  });

  document.getElementById('compare')?.addEventListener('mouseup', () => {
    state.showingBefore = false;
    state.needsRender = true;
  });

  document.getElementById('compare')?.addEventListener('touchstart', () => {
    state.showingBefore = true;
    state.needsRender = true;
  });

  document.getElementById('compare')?.addEventListener('touchend', () => {
    state.showingBefore = false;
    state.needsRender = true;
  });

  // ---------- File input and controls ----------
  const fileIn = document.getElementById('file');
  document.getElementById('open').onclick = () => fileIn.click();
  
  function resetControls() {
    Object.assign(state, defaultState());
    
    // Update all UI elements
    updateEV(state.ev);
    updateFalloff(state.flashFalloff);
    updateScurve(state.scurve);
    updateBlacks(state.blacks);
    updateKnee(state.knee);
    updateShadowCool(state.shadowCool);
    updateHighlightWarm(state.highlightWarm);
    updateBloomThreshold(state.bloomThreshold);
    updateBloomRadius(state.bloomRadius);
    updateBloomIntensity(state.bloomIntensity);
    updateBloomWarm(state.bloomWarm);
    updateVignette(state.vignette);
    updateVignettePower(state.vignettePower);
    updateCA(state.ca);
    updateClarity(state.clarity);
    updateGrain(state.grain);
    
    // Update position controls
    const handle = document.getElementById('position-handle');
    if (handle) {
      handle.style.left = '50%';
      handle.style.top = '46%';
    }
    
    // Update mobile position presets
    posPresets.forEach(p => {
      p.classList.toggle('active', p.dataset.pos === '0.5,0.46');
    });
    
    // Update flash strength
    updateFlashStrength(state.flashStrength);
    
    state.needsRender = true;
  }

  document.getElementById('reset').onclick = resetControls;
  document.getElementById('mobile-reset')?.addEventListener('click', resetControls);
  
  document.getElementById('preset').onchange = e => {
    const p = presetDefs[e.target.value];
    if (p) {
      Object.assign(state, p);
      
      // Update all controls with new values
      Object.keys(p).forEach(key => {
        if (key === 'flashStrength') {
          updateFlashStrength(p[key]);
        } else if (key === 'ev') updateEV(p[key]);
        else if (key === 'flashFalloff') updateFalloff(p[key]);
        else if (key === 'scurve') updateScurve(p[key]);
        else if (key === 'blacks') updateBlacks(p[key]);
        else if (key === 'knee') updateKnee(p[key]);
        else if (key === 'shadowCool') updateShadowCool(p[key]);
        else if (key === 'highlightWarm') updateHighlightWarm(p[key]);
        else if (key === 'bloomThreshold') updateBloomThreshold(p[key]);
        else if (key === 'bloomRadius') updateBloomRadius(p[key]);
        else if (key === 'bloomIntensity') updateBloomIntensity(p[key]);
        else if (key === 'bloomWarm') updateBloomWarm(p[key]);
        else if (key === 'vignette') updateVignette(p[key]);
        else if (key === 'vignettePower') updateVignettePower(p[key]);
        else if (key === 'ca') updateCA(p[key]);
        else if (key === 'clarity') updateClarity(p[key]);
        else if (key === 'grain') updateGrain(p[key]);
      });
      
      // Update flash strength
      updateFlashStrength(p.flashStrength ?? state.flashStrength);
      
      state.needsRender = true;
    }
    e.target.value = '';
  };
  
  function exportImage() {
    if (!gl) return;
    renderFrame(0);
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'disposable-night.png';
    a.click();
  }

  document.getElementById('export').onclick = exportImage;
  document.getElementById('mobile-export')?.addEventListener('click', exportImage);

  function defaultState() {
    return {
      ev: -0.40, flashStrength: 1.00, flashFalloff: 4.50, flashCenterX: 0.50, flashCenterY: 0.46,
      scurve: 0.60, blacks: 0.06, knee: 0.12, shadowCool: 0.35, highlightWarm: 0.35,
      bloomThreshold: 0.80, bloomRadius: 14.0, bloomIntensity: 0.50, bloomWarm: 0.30,
      vignette: 0.18, vignettePower: 2.5, ca: 1.00, clarity: 0.00, grain: 0.025, grainShadowBoost: 0.70
    };
  }

  // ---------- WebGL ----------
  const canvas = document.getElementById('glcanvas');
  const dropHelp = document.getElementById('drophelp');
  let gl;

  function initGL() {
    gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true })
      || canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) {
      alert('WebGL not supported.');
      return;
    }
    gl.getExtension('OES_texture_float');
    gl.getExtension('OES_texture_float_linear');
    gl.getExtension('EXT_color_buffer_float');
    buildPrograms();
    initBuffers();
  }

  let quadVbo;
  function initBuffers() {
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  }

  function createTexture(w, h, data = null) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function createFBO(w, h) {
    const tex = createTexture(w, h);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fbo, tex, w, h };
  }

  function setSize(w, h) {
    state.width = w;
    state.height = h;
    const dpr = state.dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  // ---------- Shaders ----------
  const COMMON = `
    precision highp float;
    varying vec2 v_uv;
    uniform vec2 uResolution;
    vec3 toLinear(vec3 c){ return pow(c, vec3(2.2)); }
    vec3 toSRGB(vec3 c){ return pow(max(c,0.0), vec3(1.0/2.2)); }
    float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  `;
  
  const VS = `
    attribute vec2 a_pos; varying vec2 v_uv;
    void main(){ v_uv = a_pos*0.5 + 0.5; gl_Position = vec4(a_pos,0.0,1.0); }
  `;

  const FS_pre = COMMON + `
    uniform sampler2D uTex;
    uniform float uEV;
    void main(){
      vec3 c = toLinear(texture2D(uTex, v_uv).rgb);
      c *= exp2(uEV);
      gl_FragColor = vec4(c,1.0);
    }`;

  const FS_flash = COMMON + `
    uniform sampler2D uTex;
    uniform vec2 uFlashCenter;
    uniform float uFlashStrength;
    uniform float uFlashFalloff;
    void main(){
      vec2 uv = v_uv;
      vec2 ac = vec2(uResolution.y/uResolution.x, 1.0);
      float r = length((uv - uFlashCenter) * ac);
      float mask = 1.0 / (1.0 + pow(uFlashFalloff * r, 2.0));
      float boost = 1.0 + uFlashStrength * mask;
      vec3 c = texture2D(uTex, uv).rgb * boost;
      gl_FragColor = vec4(c,1.0);
    }`;

  const FS_tone = COMMON + `
    uniform sampler2D uTex;
    uniform float uScurve;
    uniform float uBlacks;
    uniform float uKnee;
    vec3 sCurve(vec3 x){ return mix(x, x*x*(3.0-2.0*x), uScurve); }
    vec3 blackCrush(vec3 x){ return max(vec3(0.0), x - uBlacks) / (1.0 - uBlacks + 1e-6); }
    vec3 shoulder(vec3 x){ return 1.0 - pow(1.0 - x, vec3(1.0 + 5.0*uKnee)); }
    void main(){
      vec3 c = texture2D(uTex, v_uv).rgb;
      c = sCurve(c);
      c = blackCrush(c);
      c = shoulder(c);
      gl_FragColor = vec4(c,1.0);
    }`;

  const FS_split = COMMON + `
    uniform sampler2D uTex;
    uniform float uShadowCool;
    uniform float uHighlightWarm;
    void main(){
      vec3 c = texture2D(uTex, v_uv).rgb;
      float Y = luma(c);
      float wSh = smoothstep(0.7, 0.2, Y);
      float wHi = smoothstep(0.5, 0.9, Y);
      vec3 shTint = mix(vec3(1.0), vec3(0.98, 1.04, 1.07), uShadowCool);
      vec3 hiTint = mix(vec3(1.0), vec3(1.06, 1.00, 0.96), uHighlightWarm);
      c *= mix(vec3(1.0), shTint, wSh);
      c *= mix(vec3(1.0), hiTint, wHi);
      gl_FragColor = vec4(c,1.0);
    }`;

  const FS_vignette = COMMON + `
    uniform sampler2D uTex;
    uniform float uVStrength;
    uniform float uVPower;
    void main(){
      vec2 ac = vec2(uResolution.x/uResolution.y, 1.0);
      float r = length((v_uv - 0.5) * ac);
      float vig = pow(r, uVPower);
      vec3 c = texture2D(uTex, v_uv).rgb * (1.0 - uVStrength * vig);
      gl_FragColor = vec4(c,1.0);
    }`;

  const FS_bright = COMMON + `
    uniform sampler2D uTex;
    uniform float uThreshold;
    uniform float uWarm;
    void main(){
      vec3 c = texture2D(uTex, v_uv).rgb;
      float Y = luma(c);
      float m = smoothstep(uThreshold, 1.0, Y);
      vec3 warm = mix(vec3(1.0), vec3(1.06, 1.00, 0.96), uWarm);
      gl_FragColor = vec4(c * m * warm, 1.0);
    }`;

  const FS_blur = COMMON + `
    uniform sampler2D uTex;
    uniform vec2 uTexel;
    uniform float uRadius;
    void main(){
      vec3 s = vec3(0.0);
      float w[5]; w[0]=0.227027; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.054054; w[4]=0.016216;
      vec2 stepv = uTexel * max(uRadius, 1.0);
      s += texture2D(uTex, v_uv).rgb * w[0];
      for(int i=1;i<5;i++){
        s += texture2D(uTex, v_uv + stepv * float(i)).rgb * w[i];
        s += texture2D(uTex, v_uv - stepv * float(i)).rgb * w[i];
      }
      gl_FragColor = vec4(s,1.0);
    }`;

  const FS_bloomComposite = COMMON + `
    uniform sampler2D uBase;
    uniform sampler2D uBloom;
    uniform float uIntensity;
    vec3 screen(vec3 a, vec3 b){ return 1.0 - (1.0 - a)*(1.0 - b); }
    void main(){
      vec3 base = texture2D(uBase, v_uv).rgb;
      vec3 bloom = texture2D(uBloom, v_uv).rgb;
      vec3 outc = screen(base, bloom * uIntensity);
      gl_FragColor = vec4(outc, 1.0);
    }`;

  const FS_ca = COMMON + `
    uniform sampler2D uTex;
    uniform vec2 uPx;
    uniform float uCA;
    void main(){
      vec2 ac = vec2(uResolution.x/uResolution.y, 1.0);
      vec2 dir = normalize(((v_uv-0.5)*ac));
      dir = mix(vec2(1.0,0.0), dir, step(0.0001, length(dir)));
      vec2 delta = dir * uPx * uCA;
      vec3 c;
      c.r = texture2D(uTex, v_uv + delta).r;
      c.g = texture2D(uTex, v_uv).g;
      c.b = texture2D(uTex, v_uv - delta).b;
      gl_FragColor = vec4(c,1.0);
    }`;

  const FS_clarity = COMMON + `
    uniform sampler2D uTex; uniform vec2 uPx; uniform float uAmount;
    vec3 blur9(vec2 uv){
      vec3 s = vec3(0.0);
      float w[5]; w[0]=0.227027; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.054054; w[4]=0.016216;
      s += texture2D(uTex, uv).rgb * w[0];
      for(int i=1;i<5;i++){
        s += texture2D(uTex, uv + uPx * float(i)).rgb * w[i];
        s += texture2D(uTex, uv - uPx * float(i)).rgb * w[i];
      }
      return s;
    }
    void main(){
      vec3 c = texture2D(uTex, v_uv).rgb;
      vec3 blur = blur9(v_uv);
      vec3 hi = c - blur;
      c += hi * uAmount * 2.0;
      gl_FragColor = vec4(c,1.0);
    }`;

  const FS_grainFinal = COMMON + `
    uniform sampler2D uTex;
    uniform float uGrain;
    uniform float uShadowBoost;
    uniform float uTime;

    float hash12(vec2 p){
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main(){
      vec3 c = texture2D(uTex, v_uv).rgb;
      float Y = luma(c);

      vec2 ip = floor(v_uv * uResolution);

      float n  = hash12(ip) * 2.0 - 1.0;
      float n2 = hash12(ip + 17.0) * 2.0 - 1.0;
      float white = (n + n2) * 0.5;

      float amt = uGrain * (0.5 + uShadowBoost * (1.0 - Y));
      c += white * amt;

      c = toSRGB(clamp(c, 0.0, 1.0));
      gl_FragColor = vec4(c, 1.0);
    }`;

  const programs = {};
  function buildPrograms() {
    programs.pre = makeProgram(VS, FS_pre);
    programs.flash = makeProgram(VS, FS_flash);
    programs.tone = makeProgram(VS, FS_tone);
    programs.split = makeProgram(VS, FS_split);
    programs.vignette = makeProgram(VS, FS_vignette);
    programs.bright = makeProgram(VS, FS_bright);
    programs.blur = makeProgram(VS, FS_blur);
    programs.bloomComposite = makeProgram(VS, FS_bloomComposite);
    programs.ca = makeProgram(VS, FS_ca);
    programs.clarity = makeProgram(VS, FS_clarity);
    programs.grainFinal = makeProgram(VS, FS_grainFinal);
  }

  function makeProgram(vsSrc, fsSrc) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(vs));
    
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(fs));
    
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
    return prog;
  }

  function bindFSQ(prog) {
    gl.useProgram(prog);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const resLoc = gl.getUniformLocation(prog, 'uResolution');
    if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);
  }

  function draw(prog, texBindings, targetFbo, extraUniforms = (p) => { }) {
    bindFSQ(prog);
    let unit = 0;
    for (const [name, tex] of Object.entries(texBindings || {})) {
      const loc = gl.getUniformLocation(prog, name);
      gl.activeTexture(gl['TEXTURE' + unit]);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc, unit);
      unit++;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo ? targetFbo.fbo : null);
    extraUniforms(prog);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ---------- Render targets ----------
  let rtA, rtB, rtBloomHalfA, rtBloomHalfB;
  function ensureTargets() {
    function recreate(rt, W, H) {
      if (!rt || rt.w !== W || rt.h !== H) {
        return createFBO(W, H);
      }
      return rt;
    }
    const cw = canvas.width, ch = canvas.height;
    rtA = recreate(rtA, cw, ch);
    rtB = recreate(rtB, cw, ch);
    rtBloomHalfA = recreate(rtBloomHalfA, cw / 2 | 0, ch / 2 | 0);
    rtBloomHalfB = recreate(rtBloomHalfB, cw / 2 | 0, ch / 2 | 0);
  }

  // ---------- Image loading (with vertical flip fix) ----------
  fileIn.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      state.img = img;
      dropHelp.style.display = 'none';
      resizeToFit(img.naturalWidth, img.naturalHeight);
      if (state.imgTex) gl.deleteTexture(state.imgTex);
      state.imgTex = createTexture(img.naturalWidth, img.naturalHeight);
      gl.bindTexture(gl.TEXTURE_2D, state.imgTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      state.needsRender = true;
      renderFrame(0);
    };
    img.src = URL.createObjectURL(file);
  });

  function resizeToFit(w, h) {
    const wrap = document.querySelector('.canvas-wrap');
    const maxW = wrap.clientWidth, maxH = wrap.clientHeight;
    const scale = Math.min(maxW / w, maxH / h, 1.0);
    setSize(Math.round(w * scale), Math.round(h * scale));
    ensureTargets();
  }

  // Drag & drop
  (function setupDrop() {
    const wrap = document.querySelector('.canvas-wrap');
    wrap.addEventListener('dragover', e => { e.preventDefault(); });
    wrap.addEventListener('drop', e => {
      e.preventDefault();
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) {
        fileIn.files = e.dataTransfer.files;
        fileIn.dispatchEvent(new Event('change'));
      }
    });
  })();

  // ---------- Interaction: flash center (mouse + touch) ----------
  let touchStartTime = 0;
  let longPressTimer = null;
  let isLongPress = false;

  // Mouse events
  canvas.addEventListener('mousedown', (e) => {
    if (!state.img) return;
    state.draggingFlash = true;
    setFlashFromEvent(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.draggingFlash) return;
    setFlashFromEvent(e);
  });

  window.addEventListener('mouseup', () => {
    state.draggingFlash = false;
  });

  // Touch events
  canvas.addEventListener('touchstart', (e) => {
    if (!state.img) return;
    e.preventDefault();
    
    touchStartTime = Date.now();
    isLongPress = false;
    
    // Long press detection for horizontal-only mode
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 300);
    
    state.draggingFlash = true;
    setFlashFromTouch(e.touches[0]);
  });

  canvas.addEventListener('touchmove', (e) => {
    if (!state.draggingFlash) return;
    e.preventDefault();
    setFlashFromTouch(e.touches[0]);
  });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    clearTimeout(longPressTimer);
    state.draggingFlash = false;
    isLongPress = false;
  });

  function setFlashFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    if (e.shiftKey) {
      state.flashCenterX = x;
    } else {
      state.flashCenterX = x;
      state.flashCenterY = y;
    }
    
    // Update 2D pad
    const handle = document.getElementById('position-handle');
    if (handle) {
      const pad = document.getElementById('position-pad');
      const padRect = pad.getBoundingClientRect();
      handle.style.left = (state.flashCenterX * (padRect.width - 12)) + 'px';
      handle.style.top = (state.flashCenterY * (padRect.height - 12)) + 'px';
    }
    
    state.needsRender = true;
  }

  function setFlashFromTouch(touch) {
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    
    if (isLongPress) {
      // Long press = horizontal only
      state.flashCenterX = x;
    } else {
      state.flashCenterX = x;
      state.flashCenterY = y;
    }
    
    // Update 2D pad
    const handle = document.getElementById('position-handle');
    if (handle) {
      const pad = document.getElementById('position-pad');
      const padRect = pad.getBoundingClientRect();
      handle.style.left = (state.flashCenterX * (padRect.width - 12)) + 'px';
      handle.style.top = (state.flashCenterY * (padRect.height - 12)) + 'px';
    }
    
    state.needsRender = true;
  }

  // ---------- Render loop ----------
  let lastTime = 0;
  function renderFrame(t) {
    if (!gl) return;
    const time = t * 0.001;
    if (!state.needsRender && Math.abs(time - lastTime) < 1 / 60) {
      requestAnimationFrame(renderFrame);
      return;
    }
    lastTime = time;

    if (!state.imgTex) {
      gl.clearColor(0.05, 0.06, 0.08, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      requestAnimationFrame(renderFrame);
      return;
    }
    ensureTargets();

    const px = [1 / canvas.width, 1 / canvas.height];

    // If showing before, skip processing
    if (state.showingBefore) {
      draw(programs.pre, { uTex: state.imgTex }, null, (p) => {
        gl.uniform1f(gl.getUniformLocation(p, 'uEV'), 0); // No exposure adjustment for "before"
      });
      state.needsRender = false;
      requestAnimationFrame(renderFrame);
      return;
    }

    // 0) Pre exposure
    draw(programs.pre, { uTex: state.imgTex }, rtA, (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uEV'), state.ev);
    });

    // 1) Flash
    draw(programs.flash, { uTex: rtA.tex }, rtB, (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uFlashCenter'), state.flashCenterX, 1.0 - state.flashCenterY);
      gl.uniform1f(gl.getUniformLocation(p, 'uFlashStrength'), state.flashStrength);
      gl.uniform1f(gl.getUniformLocation(p, 'uFlashFalloff'), state.flashFalloff);
    });

    // 2) Tone
    draw(programs.tone, { uTex: rtB.tex }, rtA, (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uScurve'), state.scurve);
      gl.uniform1f(gl.getUniformLocation(p, 'uBlacks'), state.blacks);
      gl.uniform1f(gl.getUniformLocation(p, 'uKnee'), state.knee);
    });

    // 3) Split toning
    draw(programs.split, { uTex: rtA.tex }, rtB, (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uShadowCool'), state.shadowCool);
      gl.uniform1f(gl.getUniformLocation(p, 'uHighlightWarm'), state.highlightWarm);
    });

    // 4) Vignette
    draw(programs.vignette, { uTex: rtB.tex }, rtA, (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uVStrength'), state.vignette);
      gl.uniform1f(gl.getUniformLocation(p, 'uVPower'), state.vignettePower);
    });

    // Bloom chain (half-res)
    draw(programs.bright, { uTex: rtA.tex }, rtBloomHalfA, (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uThreshold'), state.bloomThreshold);
      gl.uniform1f(gl.getUniformLocation(p, 'uWarm'), state.bloomWarm);
    });
    draw(programs.blur, { uTex: rtBloomHalfA.tex }, rtBloomHalfB, (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uTexel'), 1 / rtBloomHalfA.w, 0.0);
      gl.uniform1f(gl.getUniformLocation(p, 'uRadius'), state.bloomRadius);
    });
    draw(programs.blur, { uTex: rtBloomHalfB.tex }, rtBloomHalfA, (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uTexel'), 0.0, 1 / rtBloomHalfB.h);
      gl.uniform1f(gl.getUniformLocation(p, 'uRadius'), state.bloomRadius);
    });
    draw(programs.bloomComposite, { uBase: rtA.tex, uBloom: rtBloomHalfA.tex }, rtB, (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uIntensity'), state.bloomIntensity);
    });

    // 5) Clarity (optional) -> rtA
    if (state.clarity > 0.001) {
      draw(programs.clarity, { uTex: rtB.tex }, rtA, (p) => {
        gl.uniform2f(gl.getUniformLocation(p, 'uPx'), px[0], px[1]);
        gl.uniform1f(gl.getUniformLocation(p, 'uAmount'), state.clarity);
      });
    } else {
      draw(programs.vignette, { uTex: rtB.tex }, rtA, (p) => {
        gl.uniform1f(gl.getUniformLocation(p, 'uVStrength'), 0.0);
        gl.uniform1f(gl.getUniformLocation(p, 'uVPower'), 2.0);
      });
    }

    // 6) Chromatic aberration -> rtB
    draw(programs.ca, { uTex: rtA.tex }, rtB, (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uPx'), px[0], px[1]);
      gl.uniform1f(gl.getUniformLocation(p, 'uCA'), state.ca);
    });

    // 7) Grain + gamma to screen
    draw(programs.grainFinal, { uTex: rtB.tex }, null, (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uGrain'), state.grain);
      gl.uniform1f(gl.getUniformLocation(p, 'uShadowBoost'), state.grainShadowBoost);
      gl.uniform1f(gl.getUniformLocation(p, 'uTime'), lastTime);
    });

    state.needsRender = false;
    requestAnimationFrame(renderFrame);
  }

  // ---------- Boot / Resize ----------
  initGL();
  setSize(960, 540);
  ensureTargets();
  requestAnimationFrame(renderFrame);
  
  // Throttled ResizeObserver to avoid resize write/read loops
  let roScheduled = false;
  new ResizeObserver(() => {
    if (roScheduled) return;
    roScheduled = true;
    requestAnimationFrame(() => {
      roScheduled = false;
      if (state.img) {
        resizeToFit(state.img.naturalWidth, state.img.naturalHeight);
      } else {
        setSize(document.querySelector('.canvas-wrap').clientWidth, 480);
      }
      state.needsRender = true;
    });
  }).observe(document.querySelector('.canvas-wrap'));

  // Handle orientation changes on mobile
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (state.img) {
        resizeToFit(state.img.naturalWidth, state.img.naturalHeight);
      } else {
        setSize(document.querySelector('.canvas-wrap').clientWidth, 480);
      }
      state.needsRender = true;
    }, 100);
  });
})();