// Handheld Camera Module
// Simulates handheld camera shake (video only)

import { compileShader, bindProgram } from '../gl-context.js';

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

// Calculate scale to keep image within bounds after rotation/offset
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
    
    // Multi-frequency sine wave for natural camera shake
    const time = frameSeed * 0.033;
    const freq = params.frequency;
    const phaseBase = time * freq;
    
    const offsetX = (
      Math.sin(phaseBase * 1.0) * 0.6 +
      Math.sin(phaseBase * 2.3) * 0.3 +
      Math.sin(phaseBase * 4.1) * 0.1
    ) * (params.ampX / canvasW) * params.intensity;
    
    const phaseY = phaseBase + 0.7;
    const offsetY = (
      Math.sin(phaseY * 1.0) * 0.6 +
      Math.sin(phaseY * 2.7) * 0.3 +
      Math.sin(phaseY * 3.9) * 0.1
    ) * (params.ampY / canvasH) * params.intensity;
    
    const phaseRot = phaseBase + 1.3;
    const rot = (
      Math.sin(phaseRot * 1.0) * 0.6 +
      Math.sin(phaseRot * 1.8) * 0.3 +
      Math.sin(phaseRot * 3.2) * 0.1
    ) * (params.rotation * Math.PI / 180) * params.intensity;
    
    const [scaleX, scaleY] = computeShakeScale(offsetX, offsetY, rot);
    
    bindProgram(gl, this.program, this.quad, canvasW, canvasH);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uTex'), 0);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFB ? outputFB.fbo : null);
    
    gl.uniform2f(gl.getUniformLocation(this.program, 'uShakeOffset'), offsetX, offsetY);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uShakeRot'), rot);
    gl.uniform2f(gl.getUniformLocation(this.program, 'uScale'), scaleX, scaleY);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    return [scaleX, scaleY];
  }
}