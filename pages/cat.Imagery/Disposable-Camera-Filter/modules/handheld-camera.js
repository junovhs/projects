// Handheld Camera Module
// Simulates realistic handheld camera shake using multi-octave Perlin noise

import { compileShader, bindProgram } from '../gl-context.js';

export const HANDHELD_PARAMS = {
  shakeHandheld: { min: 0, max: 1, step: 0.01, default: 0.3, label: 'Intensity' },
  shakeDrift: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Drift' },
  shakeJitter: { min: 0, max: 1, step: 0.01, default: 0.6, label: 'Jitter' },
  shakeRotation: { min: 0, max: 1, step: 0.01, default: 0.7, label: 'Rotation' }
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
`;

const SHAKE_SHADER = COMMON + `
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
`;

// Perlin noise
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(t, a, b) {
  return a + t * (b - a);
}

function grad(hash, x, y) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

const p = new Uint8Array(512);
for (let i = 0; i < 256; i++) {
  const val = Math.floor(Math.random() * 256);
  p[i] = p[i + 256] = val;
}

function perlin2D(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  
  x -= Math.floor(x);
  y -= Math.floor(y);
  
  const u = fade(x);
  const v = fade(y);
  
  const a = p[X] + Y;
  const aa = p[a];
  const ab = p[a + 1];
  const b = p[X + 1] + Y;
  const ba = p[b];
  const bb = p[b + 1];
  
  return lerp(v,
    lerp(u, grad(p[aa], x, y), grad(p[ba], x - 1, y)),
    lerp(u, grad(p[ab], x, y - 1), grad(p[bb], x - 1, y - 1))
  );
}

function layeredPerlin(x, y, octaves, persistence, lacunarity) {
  let total = 0;
  let amplitude = 1;
  let maxValue = 0;
  let frequency = 1;
  
  for (let i = 0; i < octaves; i++) {
    total += perlin2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  
  return total / maxValue;
}

function computeShakeScale(offsetX, offsetY, rot) {
  const duvs = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];
  const cosR = Math.cos(rot), sinR = Math.sin(rot);
  const Rx = [cosR, -sinR], Ry = [sinR, cosR];
  
  function inBoundsX(s) {
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < 4; i++) {
      const dx = s * duvs[i][0], dy = s * duvs[i][1];
      const rx = Rx[0] * dx + Rx[1] * dy;
      const tx = 0.5 + rx + offsetX;
      minX = Math.min(minX, tx);
      maxX = Math.max(maxX, tx);
    }
    return minX >= 0 && maxX <= 1;
  }
  
  function inBoundsY(s) {
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < 4; i++) {
      const dx = s * duvs[i][0], dy = s * duvs[i][1];
      const ry = Ry[0] * dx + Ry[1] * dy;
      const ty = 0.5 + ry + offsetY;
      minY = Math.min(minY, ty);
      maxY = Math.max(maxY, ty);
    }
    return minY >= 0 && maxY <= 1;
  }
  
  let lowX = 0, highX = 1;
  for (let iter = 0; iter < 30; iter++) {
    const midX = (lowX + highX) / 2;
    if (inBoundsX(midX)) lowX = midX;
    else highX = midX;
  }
  const sx = Math.max(0.01, lowX);
  
  let lowY = 0, highY = 1;
  for (let iter = 0; iter < 30; iter++) {
    const midY = (lowY + highY) / 2;
    if (inBoundsY(midY)) lowY = midY;
    else highY = midY;
  }
  const sy = Math.max(0.01, lowY);
  
  return [sx, sy];
}

export class HandheldCameraModule {
  constructor(gl, quad) {
    this.gl = gl;
    this.quad = quad;
    this.program = this.createProgram();
    
    this.phaseOffsets = {
      rotLow: Math.random() * 100,
      rotMid: Math.random() * 100,
      rotHigh: Math.random() * 100,
      xLow: Math.random() * 100,
      xMid: Math.random() * 100,
      xHigh: Math.random() * 100,
      yLow: Math.random() * 100,
      yMid: Math.random() * 100,
      yHigh: Math.random() * 100
    };
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
    const time = frameSeed * 0.033;
    
    const intensity = params.intensity || 0;
    const driftAmount = params.drift || 0;
    const jitterAmount = params.jitter || 0;
    const rotationAmount = params.rotation || 0;
    
    if (intensity < 0.001) {
      // No shake, just copy through
      bindProgram(gl, this.program, this.quad, canvasW, canvasH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTex);
      gl.uniform1i(gl.getUniformLocation(this.program, 'uTex'), 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, outputFB ? outputFB.fbo : null);
      gl.uniform2f(gl.getUniformLocation(this.program, 'uShakeOffset'), 0, 0);
      gl.uniform1f(gl.getUniformLocation(this.program, 'uShakeRot'), 0);
      gl.uniform2f(gl.getUniformLocation(this.program, 'uScale'), 1, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return [1, 1];
    }
    
    // LOW FREQUENCY DRIFT (slow wandering)
    const driftX = layeredPerlin(time * 0.25 + this.phaseOffsets.xLow, 0, 2, 0.5, 2.0);
    const driftY = layeredPerlin(time * 0.22 + this.phaseOffsets.yLow, 0, 2, 0.5, 2.0);
    const driftRot = layeredPerlin(time * 0.2 + this.phaseOffsets.rotLow, 0, 2, 0.5, 2.0);
    
    // MID FREQUENCY (breathing/adjustment ~1Hz)
    const midX = layeredPerlin(time * 0.9 + this.phaseOffsets.xMid, 0, 2, 0.5, 2.0);
    const midY = layeredPerlin(time * 1.1 + this.phaseOffsets.yMid, 0, 2, 0.5, 2.0);
    const midRot = layeredPerlin(time * 1.0 + this.phaseOffsets.rotMid, 0, 2, 0.5, 2.0);
    
    // HIGH FREQUENCY JITTER (hand tremor 3-4Hz)
    const jitterX = layeredPerlin(time * 4.0 + this.phaseOffsets.xHigh, 0, 3, 0.4, 2.1);
    const jitterY = layeredPerlin(time * 3.8 + this.phaseOffsets.yHigh, 0, 3, 0.4, 2.1);
    const jitterRot = layeredPerlin(time * 3.5 + this.phaseOffsets.rotHigh, 0, 3, 0.4, 2.1);
    
    // Combine with individual control over each frequency layer
    const offsetX = (
      driftX * 0.005 * driftAmount +
      midX * 0.003 * intensity +
      jitterX * 0.002 * jitterAmount
    ) * intensity;
    
    const offsetY = (
      driftY * 0.004 * driftAmount +
      midY * 0.0025 * intensity +
      jitterY * 0.0015 * jitterAmount
    ) * intensity;
    
    const rotation = (
      driftRot * 0.012 * driftAmount +
      midRot * 0.008 * intensity +
      jitterRot * 0.004 * jitterAmount
    ) * rotationAmount * intensity;
    
    const [scaleX, scaleY] = computeShakeScale(offsetX, offsetY, rotation);
    
    bindProgram(gl, this.program, this.quad, canvasW, canvasH);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uTex'), 0);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFB ? outputFB.fbo : null);
    
    gl.uniform2f(gl.getUniformLocation(this.program, 'uShakeOffset'), offsetX, offsetY);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uShakeRot'), rotation);
    gl.uniform2f(gl.getUniformLocation(this.program, 'uScale'), scaleX, scaleY);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    return [scaleX, scaleY];
  }
}