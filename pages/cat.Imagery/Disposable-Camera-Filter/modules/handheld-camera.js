// Handheld Camera Module
// Simulates realistic handheld camera shake using Perlin noise

import { compileShader, bindProgram } from '../gl-context.js';

export const HANDHELD_PARAMS = {
  shakeIntensity: { min: 0, max: 1, step: 0.01, default: 0.3, label: 'Intensity' },
  shakeFrequency: { min: 0.5, max: 8, step: 0.1, default: 2.5, label: 'Frequency' },
  shakeTremor: { min: 0, max: 1, step: 0.01, default: 0.4, label: 'Tremor' }
};

const VERTEX_SHADER = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0, 1);
}
`;

const SHAKE_SHADER = `
precision highp float;
varying vec2 v_uv;
uniform vec2 uRes;
uniform sampler2D uTex;
uniform float uTime;
uniform float uIntensity;
uniform float uFrequency;
uniform float uTremor;

// Perlin noise implementation
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float perlinNoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  
  return 130.0 * dot(m, g);
}

// Multi-octave Perlin for layered realism
float layeredNoise(float t, float seed, int octaves) {
  float total = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  float maxValue = 0.0;
  
  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    total += perlinNoise(vec2(t * frequency, seed)) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return total / maxValue;
}

void main() {
  // Time-based noise sampling
  float time = uTime * uFrequency;
  
  // Low-frequency sway (breathing, weight shifts)
  float swayX = layeredNoise(time * 0.5, 0.0, 2);
  float swayY = layeredNoise(time * 0.5, 10.0, 2);
  
  // High-frequency tremor (muscle micro-movements)
  float tremorX = layeredNoise(time * 4.0, 20.0, 3) * uTremor;
  float tremorY = layeredNoise(time * 4.0, 30.0, 3) * uTremor;
  
  // Combine - tremor rides on top of sway
  float offsetX = (swayX * 0.7 + tremorX * 0.3) * uIntensity * 0.015;
  float offsetY = (swayY * 0.7 + tremorY * 0.3) * uIntensity * 0.012; // Slightly more vertical
  
  // Subtle rotation (from hand twist)
  float rotation = layeredNoise(time * 0.8, 40.0, 2) * uIntensity * 0.008;
  
  // Apply rotation around center
  vec2 center = vec2(0.5);
  vec2 pos = v_uv - center;
  
  float c = cos(rotation);
  float s = sin(rotation);
  mat2 rotMat = mat2(c, -s, s, c);
  pos = rotMat * pos;
  
  // Apply translation
  vec2 uv = center + pos + vec2(offsetX, offsetY);
  
  // Simple edge handling - clamp to avoid black borders
  uv = clamp(uv, vec2(0.001), vec2(0.999));
  
  gl_FragColor = texture2D(uTex, uv);
}
`;

export class HandheldCameraModule {
  constructor(gl, quad) {
    this.gl = gl;
    this.quad = quad;
    this.program = this.createProgram();
  }
  
  createProgram() {
    const gl = this.gl;
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, SHAKE_SHADER);
    
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Handheld shake program link error:', gl.getProgramInfoLog(program));
      return null;
    }
    
    return program;
  }
  
  apply(inputTex, outputFB, params, frameSeed, canvasW, canvasH) {
    const gl = this.gl;
    
    bindProgram(gl, this.program, this.quad, canvasW, canvasH);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uTex'), 0);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFB ? outputFB.fbo : null);
    
    // Time in seconds (assuming 30fps)
    const time = frameSeed * 0.033;
    
    gl.uniform1f(gl.getUniformLocation(this.program, 'uTime'), time);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uIntensity'), params.intensity);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uFrequency'), params.frequency);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uTremor'), params.tremor);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}