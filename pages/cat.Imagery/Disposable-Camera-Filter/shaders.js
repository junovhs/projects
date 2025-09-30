// All shader code and program compilation

const COMMON = `
precision highp float;
varying vec2 v_uv;
uniform vec2 uRes;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 toLin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSRGB(vec3 c) { return pow(max(c, 0.0), vec3(1.0/2.2)); }
`;

const VS = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0, 1);
}
`;

export const SHADERS = {
  copy: COMMON + `
    uniform sampler2D uTex;
    void main() {
      gl_FragColor = vec4(texture2D(uTex, v_uv).rgb, 1.0);
    }
  `,
  
  pre: COMMON + `
    uniform sampler2D uTex;
    uniform float uEV;
    void main() {
      vec3 c = toLin(texture2D(uTex, v_uv).rgb) * exp2(uEV);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  
  flash: COMMON + `
    uniform sampler2D uTex;
    uniform vec2 uCenter;
    uniform float uStrength, uFall;
    void main() {
      vec3 c = texture2D(uTex, v_uv).rgb;
      vec2 ac = vec2(uRes.x / uRes.y, 1.0);
      float r = length((v_uv - uCenter) * ac);
      float m = 1.0 / (1.0 + pow(max(0.0, uFall) * r, 2.0));
      c *= (1.0 + uStrength * m);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  
  motion: COMMON + `
    uniform sampler2D uTex;
    uniform vec2 uPx;
    uniform float uAmt, uAng, uShake;
    void main() {
      vec2 dir = vec2(cos(uAng), sin(uAng));
      const int N = 24;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < N; i++) {
        float t = float(i) / float(N - 1) - 0.5;
        float w1 = sin(6.28318 * 2.7 * t + 1.7);
        float w2 = sin(6.28318 * 4.9 * t + 5.1);
        vec2 wig = uShake * 0.25 * vec2(w1, w2);
        acc += texture2D(uTex, v_uv + (dir * t + wig) * uAmt * uPx).rgb;
      }
      gl_FragColor = vec4(acc / float(N), 1.0);
    }
  `,
  
  tone: COMMON + `
    uniform sampler2D uTex;
    uniform float uSc, uBl, uKnee, uLift;
    
    vec3 s(vec3 x) { return mix(x, x * x * (3.0 - 2.0 * x), uSc); }
    vec3 crush(vec3 x) { return max(vec3(0.0), x - uBl) / (1.0 - uBl + 1e-6); }
    vec3 lift(vec3 x) { return x * (1.0 - uLift) + vec3(uLift); }
    vec3 shoulder(vec3 x) {
      vec3 t = clamp(x, 0.0, 1.0);
      return 1.0 - pow(1.0 - t, vec3(1.0 + 5.0 * uKnee));
    }
    
    void main() {
      vec3 c = texture2D(uTex, v_uv).rgb;
      c = s(c);
      c = crush(c);
      c = lift(c);
      c = shoulder(c);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  
  split: COMMON + `
    uniform sampler2D uTex;
    uniform float uSh, uHi;
    void main() {
      vec3 c = texture2D(uTex, v_uv).rgb;
      float Y = luma(c);
      float wS = 1.0 - smoothstep(0.18, 0.55, Y);
      float wH = smoothstep(0.5, 0.9, Y);
      vec3 sh = mix(vec3(1.0), vec3(0.95, 1.08, 1.15), uSh);
      vec3 hi = mix(vec3(1.0), vec3(1.15, 1.00, 0.90), uHi);
      c *= mix(vec3(1.0), sh, wS);
      c *= mix(vec3(1.0), hi, wH);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  
  cast: COMMON + `
    uniform sampler2D uTex;
    uniform float uGS, uMM;
    void main() {
      vec3 c = texture2D(uTex, v_uv).rgb;
      float Y = luma(c);
      float wS = 1.0 - smoothstep(0.18, 0.55, Y);
      float wM = smoothstep(0.20, 0.60, Y) * (1.0 - smoothstep(0.60, 0.90, Y));
      c *= mix(vec3(1.0), vec3(0.80, 1.25, 0.82), uGS * wS);
      c *= mix(vec3(1.0), vec3(1.22, 0.80, 1.22), uMM * wM);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  
  vignette: COMMON + `
    uniform sampler2D uTex;
    uniform float uV, uP;
    void main() {
      vec2 ac = vec2(uRes.x / uRes.y, 1.0);
      float r = length((v_uv - 0.5) * ac);
      float v = pow(r, uP);
      gl_FragColor = vec4(texture2D(uTex, v_uv).rgb * (1.0 - uV * v), 1.0);
    }
  `,
  
  bright: COMMON + `
    uniform sampler2D uTex;
    uniform float uT, uWarm;
    vec3 warm(float a) { return mix(vec3(1.0), vec3(1.15, 1.0, 0.88), a); }
    void main() {
      vec3 c = texture2D(uTex, v_uv).rgb;
      float Y = luma(c);
      float m = clamp((Y - uT) / max(1e-5, 1.0 - uT), 0.0, 1.0);
      vec3 b = clamp(c, 0.0, 1.0) * m * warm(uWarm) * 1.5;
      gl_FragColor = vec4(b, 1.0);
    }
  `,
  
  downsample: COMMON + `
    uniform sampler2D uTex;
    uniform vec2 uTexel;
    void main() {
      vec3 s = vec3(0.0);
      s += texture2D(uTex, v_uv + uTexel * vec2(-.5, -.5)).rgb;
      s += texture2D(uTex, v_uv + uTexel * vec2(.5, -.5)).rgb;
      s += texture2D(uTex, v_uv + uTexel * vec2(-.5, .5)).rgb;
      s += texture2D(uTex, v_uv + uTexel * vec2(.5, .5)).rgb;
      gl_FragColor = vec4(s * .25, 1.0);
    }
  `,
  
  blur: COMMON + `
    uniform sampler2D uTex;
    uniform vec2 uTexel;
    uniform float uR;
    void main() {
      vec3 s = vec3(0.0);
      float w[5];
      w[0] = 0.227027; w[1] = 0.1945946; w[2] = 0.1216216;
      w[3] = 0.054054; w[4] = 0.016216;
      vec2 st = uTexel * max(uR, 1.0);
      s += texture2D(uTex, v_uv).rgb * w[0];
      for (int i = 1; i < 5; i++) {
        s += texture2D(uTex, v_uv + st * float(i)).rgb * w[i];
        s += texture2D(uTex, v_uv - st * float(i)).rgb * w[i];
      }
      gl_FragColor = vec4(s, 1.0);
    }
  `,
  
  upsampleAdd: COMMON + `
    uniform sampler2D uLow, uHigh;
    uniform float uAdd;
    void main() {
      vec3 low = texture2D(uLow, v_uv).rgb;
      vec3 hi = texture2D(uHigh, v_uv).rgb;
      gl_FragColor = vec4(hi + low * uAdd, 1.0);
    }
  `,
  
  bloomComposite: COMMON + `
    uniform sampler2D uBase, uBloom;
    uniform float uI, uHal;
    vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }
    void main() {
      vec3 base = texture2D(uBase, v_uv).rgb;
      vec3 bloom = texture2D(uBloom, v_uv).rgb;
      vec3 outc = screen(base, bloom * uI);
      vec3 hal = bloom * (uHal * 2.0) * vec3(1.0, 0.22, 0.07);
      gl_FragColor = vec4(outc + hal, 1.0);
    }
  `,
  
  clarity: COMMON + `
    uniform sampler2D uTex;
    uniform vec2 uPx;
    uniform float uAmt;
    vec3 blur9(vec2 uv) {
      vec3 s = vec3(0.0);
      float w[5];
      w[0] = 0.227027; w[1] = 0.1945946; w[2] = 0.1216216;
      w[3] = 0.054054; w[4] = 0.016216;
      s += texture2D(uTex, uv).rgb * w[0];
      for (int i = 1; i < 5; i++) {
        s += texture2D(uTex, uv + uPx * float(i)).rgb * w[i];
        s += texture2D(uTex, uv - uPx * float(i)).rgb * w[i];
      }
      return s;
    }
    void main() {
      vec3 c = texture2D(uTex, v_uv).rgb;
      vec3 b = blur9(v_uv);
      vec3 hi = c - b;
      c += hi * uAmt * 2.0;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  
  chromaticAberration: COMMON + `
    uniform sampler2D uTex;
    uniform vec2 uPx;
    uniform float uCA;
    void main() {
      vec2 ac = vec2(uRes.x / uRes.y, 1.0);
      vec2 dir = normalize((v_uv - 0.5) * ac);
      dir = mix(vec2(1.0, 0.0), dir, step(0.0001, length(dir)));
      vec2 d = dir * uPx * uCA;
      vec3 c;
      c.r = texture2D(uTex, v_uv + d).r;
      c.g = texture2D(uTex, v_uv).g;
      c.b = texture2D(uTex, v_uv - d).b;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  
  grain: COMMON + `
    uniform sampler2D uTex;
    uniform float uASA, uDev, uStock, uChroma, uMag, uShadow, uTime, uSeed, uDither;
    
    float h(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      float a = h(i), b = h(i + vec2(1, 0));
      float c = h(i + vec2(0, 1)), d = h(i + vec2(1, 1));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
    
    float fbm(vec2 p) {
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) {
        s += a * vnoise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return s;
    }
    
    mat2 R(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, -s, s, c);
    }
    
    vec2 seedOf(float s) {
      return vec2(
        fract(sin((s + 1.0) * 12.99) * 43758.54),
        fract(sin((s + 2.0) * 78.23) * 12345.67)
      ) * 173.0;
    }
    
    void main() {
      vec3 c = texture2D(uTex, v_uv).rgb;
      float Y = dot(c, vec3(0.2126, 0.7152, 0.0722));
      
      float asaN = clamp(
        (log2(uASA) - log2(50.0)) / (log2(3200.0) - log2(50.0)),
        0.0, 1.0
      );
      float cell = mix(0.6, 3.2, asaN) * uMag;
      float base = mix(0.006, 0.040, asaN);
      
      float aniso = mix(0.55, 1.0, uStock);
      mat2 A = R(1.13) * mat2(1.0, 0.0, 0.0, aniso);
      vec2 uv = (v_uv * uRes) / cell;
      uv = A * uv + seedOf(uSeed);
      
      float dev = clamp((uDev + 2.0) / 4.0, 0.0, 1.0);
      float gain = mix(0.9, 1.8, dev);
      
      float gL = fbm(uv) - 0.5;
      vec3 gC = vec3(
        fbm(uv + vec2(17.2, 3.1)),
        fbm(uv + vec2(-9.7, 11.4)),
        fbm(uv + vec2(6.3, -21.7))
      ) - 0.5;
      
      vec3 g = mix(vec3(gL), mix(vec3(gL), gC, 0.35), uChroma);
      
      float shadow = pow(max(0.0, 1.0 - Y), 1.0 + 1.2 * uShadow);
      float amp = base * gain * (0.55 + uShadow * shadow);
      
      vec3 outc = toSRGB(clamp(c + g * amp, 0.0, 16.0));
      outc = clamp(outc, 0.0, 1.0);
      
      float n = fract(sin(dot(v_uv * uRes, vec2(12.9898, 78.233))) * 43758.5453);
      outc += (uDither) * (n - 0.5) / 255.0;
      
      gl_FragColor = vec4(outc, 1.0);
    }
  `,
  
  handheldShake: COMMON + `
    uniform sampler2D uTex;
    uniform vec2 uShakeOffset;
    uniform float uShakeRot;
    uniform vec2 uScale;
    void main() {
      vec2 center = vec2(0.5);
      vec2 duv = (v_uv - center) * uScale;
      float r = uShakeRot;
      mat2 R = mat2(cos(r), -sin(r), sin(r), cos(r));
      duv = R * duv;
      vec2 new_uv = clamp(center + duv + uShakeOffset, 0.0, 1.0);
      gl_FragColor = texture2D(uTex, new_uv);
    }
  `
};

export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  
  return shader;
}

export function createProgram(gl, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  
  if (!vs || !fs) return null;
  
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return null;
  }
  
  return program;
}

export function initPrograms(gl) {
  const programs = {};
  for (const [name, source] of Object.entries(SHADERS)) {
    programs[name] = createProgram(gl, source);
  }
  return programs;
}

export function bindProgram(gl, program, quad, canvasWidth, canvasHeight) {
  gl.useProgram(program);
  
  const posLoc = gl.getAttribLocation(program, 'a_pos');
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  
  const resLoc = gl.getUniformLocation(program, 'uRes');
  if (resLoc) {
    gl.uniform2f(resLoc, canvasWidth, canvasHeight);
  }
}

export function drawQuad(gl, program, quad, textures, target, uniforms, canvasWidth, canvasHeight) {
  bindProgram(gl, program, quad, canvasWidth, canvasHeight);
  
  let unit = 0;
  for (const [name, tex] of Object.entries(textures || {})) {
    const loc = gl.getUniformLocation(program, name);
    gl.activeTexture(gl[`TEXTURE${unit}`]);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
    unit++;
  }
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
  
  if (uniforms) uniforms(program);
  
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}