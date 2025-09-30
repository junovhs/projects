// Film Grain Module
// Complete film grain simulation with procedural noise

import { compileShader, bindProgram } from '../gl-context.js';

// Parameter definitions - add new params here and UI auto-generates
export const GRAIN_PARAMS = {
  grainASA: { min: 50, max: 3200, step: 50, default: 800, label: 'ASA' },
  grainDevelop: { min: -2, max: 2, step: 0.1, default: 0, label: 'Develop' },
  grainStock: { min: 0, max: 1, step: 0.01, default: 0.6, label: 'Stock Type' },
  grainChroma: { min: 0, max: 1, step: 0.01, default: 0.6, label: 'Color Grain' },
  grainMagnify: { min: 0.5, max: 3, step: 0.01, default: 1.0, label: 'Print Size' }
};

const VERTEX_SHADER = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0, 1);
}
`;

const COMMON = `
precision highp float;
varying vec2 v_uv;
uniform vec2 uRes;
vec3 toLin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toSRGB(vec3 c) { return pow(max(c, 0.0), vec3(1.0/2.2)); }
`;

const GRAIN_SHADER = COMMON + `
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
`;

export class FilmGrainModule {
  constructor(gl, quad) {
    this.gl = gl;
    this.quad = quad;
    this.program = this.createProgram();
  }
  
  createProgram() {
    const gl = this.gl;
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, GRAIN_SHADER);
    
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Grain program link error:', gl.getProgramInfoLog(program));
      return null;
    }
    
    return program;
  }
  
  apply(inputTex, params, time, frameSeed, canvasW, canvasH) {
    const gl = this.gl;
    
    bindProgram(gl, this.program, this.quad, canvasW, canvasH);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uTex'), 0);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    gl.uniform1f(gl.getUniformLocation(this.program, 'uASA'), params.grainASA);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uDev'), params.grainDevelop);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uStock'), params.grainStock);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uChroma'), params.grainChroma);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uMag'), params.grainMagnify);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uShadow'), 0.70);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uTime'), time * 0.001);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uSeed'), frameSeed);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uDither'), 0.5);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}