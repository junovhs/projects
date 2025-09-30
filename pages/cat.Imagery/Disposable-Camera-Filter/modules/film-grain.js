// Enhanced Film Grain Module
// Authentic film grain with proper temporal characteristics

import { compileShader, bindProgram } from '../gl-context.js';

// Actually useful parameters that do different things
export const GRAIN_PARAMS = {
  grainAmount: { min: 0, max: 2, step: 0.05, default: 0.8, label: 'Grain Amount' },
  grainSize: { min: 0.3, max: 3, step: 0.1, default: 1.0, label: 'Grain Size' },
  grainRoughness: { min: 0, max: 1, step: 0.01, default: 0.5, label: 'Roughness' }, // smooth fine grain vs chunky coarse grain
  grainDefinition: { min: 0, max: 1, step: 0.01, default: 0.7, label: 'Definition' }, // soft/blurry vs sharp/crisp
  grainChroma: { min: 0, max: 1, step: 0.01, default: 0.4, label: 'Color Grain' }
};

const VERTEX_SHADER = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0, 1);
}
`;

const GRAIN_SHADER = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uAmount, uSize, uRoughness, uDefinition, uChroma, uSeed;

// Better color space
vec3 toLinear(vec3 s) {
  return mix(s / 12.92, pow((s + 0.055) / 1.055, vec3(2.4)), step(0.04045, s));
}

vec3 toSRGB(vec3 l) {
  return mix(l * 12.92, pow(l, vec3(1.0/2.4)) * 1.055 - 0.055, step(0.0031308, l));
}

// High-quality hash with better distribution
float hash1(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 hash3(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

// Gradient noise - proper Perlin-style
float gradNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  
  // Quintic for C2 continuity
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  
  // Gradient vectors at corners
  vec2 ga = hash2(i + vec2(0.0, 0.0)) * 2.0 - 1.0;
  vec2 gb = hash2(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
  vec2 gc = hash2(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
  vec2 gd = hash2(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
  
  float va = dot(ga, f - vec2(0.0, 0.0));
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));
  
  return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y);
}

// Value noise for different character
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  
  float a = hash1(i + vec2(0.0, 0.0));
  float b = hash1(i + vec2(1.0, 0.0));
  float c = hash1(i + vec2(0.0, 1.0));
  float d = hash1(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}

// Worley/cellular for clumpy structure
float worley(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  
  float minDist = 1.0;
  
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash2(i + neighbor);
      vec2 diff = neighbor + point - f;
      float dist = length(diff);
      minDist = min(minDist, dist);
    }
  }
  
  return minDist;
}

// Multi-layer grain with different characteristics
float grainLayer(vec2 p, float seed, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  
  // Offset position by seed for temporal variation
  vec2 offset = hash2(vec2(seed, seed * 1.234)) * 100.0;
  p += offset;
  
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    
    // Mix gradient and value noise for organic quality
    float n = mix(
      gradNoise(p * freq),
      valueNoise(p * freq * 1.3 + 7.77),
      0.5
    );
    
    sum += amp * n;
    freq *= 2.1; // Slightly off 2.0 for less repetition
    amp *= 0.5;
  }
  
  return sum;
}

void main() {
  vec3 color = texture2D(uTex, v_uv).rgb;
  vec3 linear = toLinear(color);
  float luma = dot(linear, vec3(0.2126, 0.7152, 0.0722));
  
  // === GRAIN COORDINATE SPACE ===
  
  // Base grain size in pixels (realistic film grain is 1-4 pixels typically)
  float grainPixelSize = mix(0.8, 4.0, uSize);
  vec2 grainUV = (v_uv * uRes) / grainPixelSize;
  
  // Add sub-pixel jitter for temporal variation (critical for video!)
  vec2 temporalJitter = hash2(vec2(uSeed * 0.1234, uSeed * 0.5678)) - 0.5;
  grainUV += temporalJitter * 0.8;
  
  // === LUMINANCE-DEPENDENT RESPONSE ===
  
  // Film grain is most visible in midtones, less in pure black/white
  float midtones = 1.0 - pow(abs(luma - 0.5) * 2.0, 1.5);
  midtones = mix(0.3, 1.0, midtones); // Always some grain
  
  // Shadow clumping (real film does this)
  float shadows = smoothstep(0.35, 0.0, luma);
  
  // Highlight compression
  float highlights = smoothstep(0.8, 1.0, luma);
  
  // === GENERATE GRAIN STRUCTURE ===
  
  // High-frequency fine detail (always present)
  float fineGrain = grainLayer(grainUV, uSeed, 5);
  
  // Lower-frequency coarse structure (controlled by roughness)
  float coarseGrain = grainLayer(grainUV * 0.4, uSeed * 0.777, 4);
  
  // Clumpy cellular structure (for shadows)
  float clumps = worley(grainUV * 0.6 + hash2(vec2(uSeed)) * 10.0);
  clumps = pow(clumps, 0.8) * 2.0 - 1.0;
  
  // Mix fine and coarse based on roughness parameter
  float structuredGrain = mix(fineGrain, coarseGrain, uRoughness);
  
  // Add clumping in shadows
  structuredGrain = mix(structuredGrain, clumps, shadows * 0.6);
  
  // === CHROMATIC GRAIN (PER-CHANNEL) ===
  
  // Color channels have different grain (silver halides are random)
  vec3 chromaGrain = vec3(
    grainLayer(grainUV * 0.85 + vec2(12.34, 56.78), uSeed * 1.1, 4),
    grainLayer(grainUV * 0.85 + vec2(91.01, 23.45), uSeed * 1.2, 4),
    grainLayer(grainUV * 0.85 + vec2(67.89, 34.56), uSeed * 1.3, 4)
  );
  
  // Blend luma and chroma grain
  vec3 grain = mix(vec3(structuredGrain), chromaGrain, uChroma);
  
  // === GRAIN SHARPNESS/DEFINITION ===
  
  // Soft grain: compress dynamic range
  // Sharp grain: expand dynamic range
  float sharpness = mix(0.6, 1.4, uDefinition);
  grain = sign(grain) * pow(abs(grain), vec3(1.0 / sharpness));
  
  // === INTENSITY MODULATION ===
  
  float intensity = uAmount * 0.025; // Base intensity
  intensity *= midtones; // Midtone emphasis
  intensity *= (1.0 - highlights * 0.6); // Reduce in highlights
  intensity *= (1.0 + shadows * 0.4); // Boost in shadows
  
  // === APPLY GRAIN (IN LINEAR SPACE) ===
  
  vec3 grainedLinear = linear + grain * intensity;
  grainedLinear = max(grainedLinear, 0.0);
  
  // === OUTPUT ===
  
  vec3 finalColor = toSRGB(grainedLinear);
  
  // High-quality dithering (blue noise pattern)
  float dither = hash1(v_uv * uRes + temporalJitter * 123.45);
  dither = (dither - 0.5) / 255.0;
  finalColor += dither;
  
  gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
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
    
    gl.uniform1f(gl.getUniformLocation(this.program, 'uAmount'), params.grainAmount);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uSize'), params.grainSize);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uRoughness'), params.grainRoughness);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uDefinition'), params.grainDefinition);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uChroma'), params.grainChroma);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uSeed'), frameSeed);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}