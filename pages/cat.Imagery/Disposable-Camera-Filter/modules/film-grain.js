// Enhanced Film Grain Module
// Physically-based film grain simulation with authentic film stock characteristics

import { compileShader, bindProgram } from '../gl-context.js';

export const GRAIN_PARAMS = {
  grainASA: { min: 50, max: 3200, step: 50, default: 400, label: 'Film Speed (ISO)' },
  grainDevelop: { min: -2, max: 2, step: 0.1, default: 0, label: 'Push/Pull' },
  grainStock: { 
    min: 0, 
    max: 3, 
    step: 1, 
    default: 0, 
    label: 'Film Stock',
    labels: ['Kodak Gold', 'Fuji Superia', 'Kodak Portra', 'Agfa Vista']
  },
  grainIntensity: { min: 0, max: 2, step: 0.05, default: 1.0, label: 'Grain Amount' },
  grainSize: { min: 0.5, max: 2.5, step: 0.1, default: 1.0, label: 'Scan Resolution' }
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
uniform float uASA, uDev, uStock, uIntensity, uGrainSize, uSeed;

// Physically accurate color space conversion
vec3 toLinear(vec3 srgb) {
  return mix(
    srgb / 12.92,
    pow((srgb + 0.055) / 1.055, vec3(2.4)),
    step(0.04045, srgb)
  );
}

vec3 toSRGB(vec3 linear) {
  return mix(
    linear * 12.92,
    pow(linear, vec3(1.0/2.4)) * 1.055 - 0.055,
    step(0.0031308, linear)
  );
}

// High-quality hash for grain generation
vec3 hash3(vec2 p) {
  vec3 q = vec3(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3)),
    dot(p, vec2(419.2, 371.9))
  );
  return fract(sin(q) * 43758.5453);
}

float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Improved gradient noise (better than value noise)
float gradientNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  
  // Quintic interpolation for C2 continuity
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  
  float a = hash1(i + vec2(0.0, 0.0));
  float b = hash1(i + vec2(1.0, 0.0));
  float c = hash1(i + vec2(0.0, 1.0));
  float d = hash1(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}

// Multi-scale grain texture
float grainFBM(vec2 p, int octaves, float lacunarity, float gain) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amp * gradientNoise(p * freq);
    freq *= lacunarity;
    amp *= gain;
  }
  
  return sum;
}

// Simulate clumpy/clustered grain structure (realistic for shadows)
float clumpyGrain(vec2 p) {
  // Large-scale clumping
  float clumps = grainFBM(p * 0.3, 3, 2.0, 0.5);
  // Fine detail
  float detail = grainFBM(p, 4, 2.3, 0.48);
  // Clumps modulate detail
  return detail * (0.5 + 0.5 * clumps);
}

// Film stock characteristics based on real films
struct FilmStock {
  float grainScale;      // Base grain size
  float chromaRatio;     // Color grain vs luma grain
  float clumpiness;      // Grain clustering
  float shadowBoost;     // Extra shadow grain
  float sharpness;       // Grain edge sharpness
  vec3 colorBias;        // Per-channel grain color
};

FilmStock getFilmStock(float id) {
  // Kodak Gold 200 - consumer film, warm, visible grain
  if (id < 0.5) {
    return FilmStock(1.1, 0.75, 0.45, 0.9, 0.8, vec3(1.08, 1.0, 0.94));
  }
  // Fuji Superia 400 - cooler tones, fine uniform grain
  else if (id < 1.5) {
    return FilmStock(0.9, 0.65, 0.25, 0.6, 0.9, vec3(0.96, 1.0, 1.06));
  }
  // Kodak Portra 400 - professional, very fine grain
  else if (id < 2.5) {
    return FilmStock(0.75, 0.5, 0.15, 0.4, 1.0, vec3(1.0, 1.0, 1.0));
  }
  // Agfa Vista 400 - discontinued, punchy, grainy
  else {
    return FilmStock(1.35, 0.85, 0.55, 1.1, 0.75, vec3(1.12, 0.96, 0.88));
  }
}

void main() {
  vec3 color = texture2D(uTex, v_uv).rgb;
  vec3 linear = toLinear(color);
  
  // Luminance in linear space (physically correct)
  float luma = dot(linear, vec3(0.2126, 0.7152, 0.0722));
  
  FilmStock stock = getFilmStock(uStock);
  
  // ISO grain relationship (logarithmic)
  float isoFactor = log2(uASA / 100.0) / log2(32.0);
  isoFactor = clamp(isoFactor, 0.0, 1.0);
  
  // Push/pull processing affects grain structure
  float pushPull = 1.0 + uDev * 0.25;
  
  // Calculate grain size in pixels (simulates silver halide crystal size)
  float baseGrainSize = mix(0.6, 5.0, pow(isoFactor, 0.9));
  float grainPixels = baseGrainSize * stock.grainScale * uGrainSize * pushPull;
  
  // Grain space UV with temporal seed
  vec2 grainUV = (v_uv * uRes) / grainPixels;
  vec2 seedOffset = hash3(vec2(uSeed * 123.45, uSeed * 678.90)).xy * 999.0;
  grainUV += seedOffset;
  
  // === LUMINANCE-DEPENDENT GRAIN RESPONSE ===
  
  // Midtone response (grain most visible in midtones)
  float midtoneCurve = 1.0 - pow(abs(luma - 0.5) * 2.0, 1.5);
  midtoneCurve = max(midtoneCurve, 0.2); // Always some grain
  
  // Shadow grain characteristics (clumpy, more visible)
  float shadowMask = pow(max(0.0, 1.0 - luma * 2.5), 2.5);
  float shadowGrainBoost = shadowMask * stock.shadowBoost;
  
  // Highlight compression (blown highlights show less grain)
  float highlightRolloff = smoothstep(0.85, 1.0, luma);
  
  // === GENERATE GRAIN TEXTURE ===
  
  // Luminance grain (shared across channels)
  float lumaGrain;
  
  if (luma < 0.35) {
    // Shadows: clumpy, irregular grain
    lumaGrain = mix(
      grainFBM(grainUV, 5, 2.2, 0.5),
      clumpyGrain(grainUV),
      stock.clumpiness
    );
  } else {
    // Midtones/highlights: clean, regular grain
    lumaGrain = grainFBM(grainUV, 5, 2.1, 0.5);
  }
  
  // Chromatic grain (coarser, per-channel)
  float chromaticScale = 0.7; // Chroma grain is coarser
  vec3 chromaGrain = vec3(
    grainFBM(grainUV * chromaticScale + vec2(127.3, 311.7), 4, 2.0, 0.5),
    grainFBM(grainUV * chromaticScale + vec2(269.5, 183.3), 4, 2.0, 0.5),
    grainFBM(grainUV * chromaticScale + vec2(419.2, 371.9), 4, 2.0, 0.5)
  );
  
  // Blend luma and chroma grain based on film stock
  vec3 grain = mix(vec3(lumaGrain), chromaGrain, stock.chromaRatio);
  
  // Apply film stock color bias
  grain *= stock.colorBias;
  
  // Sharpen grain slightly (film grain has crisp edges)
  grain = sign(grain) * pow(abs(grain), vec3(1.0 / stock.sharpness));
  
  // === CALCULATE GRAIN INTENSITY ===
  
  // Base intensity from ISO
  float baseIntensity = mix(0.001, 0.04, pow(isoFactor, 1.2));
  
  // Modulate by luminance response
  float intensity = baseIntensity * uIntensity * pushPull;
  intensity *= midtoneCurve;
  intensity *= (1.0 + shadowGrainBoost * 1.8);
  intensity *= (1.0 - highlightRolloff * 0.7);
  
  // === APPLY GRAIN IN LINEAR SPACE (PHYSICALLY CORRECT) ===
  
  // Film grain is additive in linear light (density is additive)
  vec3 grainedLinear = linear + grain * intensity;
  
  // Prevent negative values
  grainedLinear = max(grainedLinear, 0.0);
  
  // === CONVERT BACK TO DISPLAY SPACE ===
  
  vec3 output = toSRGB(grainedLinear);
  
  // Subtle dithering to prevent banding in smooth gradients
  float dither = hash1(v_uv * uRes + seedOffset) - 0.5;
  output += dither / 255.0;
  
  gl_FragColor = vec4(clamp(output, 0.0, 1.0), 1.0);
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
    gl.uniform1f(gl.getUniformLocation(this.program, 'uIntensity'), params.grainIntensity);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uGrainSize'), params.grainSize);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uSeed'), frameSeed);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}