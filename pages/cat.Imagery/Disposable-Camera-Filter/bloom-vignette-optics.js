// Bloom, vignette, chromatic aberration, clarity

export function extractBright(gl, programs, quad, inputTex, outputFB, threshold, warmth, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.bright,
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uT'), threshold);
      gl.uniform1f(gl.getUniformLocation(p, 'uWarm'), warmth);
    },
    canvasW,
    canvasH
  );
}

export function downsample(gl, programs, quad, inputTex, inputW, inputH, outputFB, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.downsample,
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uTexel'), 1 / inputW, 1 / inputH);
    },
    canvasW,
    canvasH
  );
}

export function blurHorizontalVertical(gl, programs, quad, srcFB, dstFB, radius, canvasW, canvasH, drawQuad) {
  // Horizontal pass
  drawQuad(
    gl,
    programs.blur,
    quad,
    { uTex: srcFB.tex },
    dstFB,
    (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uTexel'), 1 / srcFB.w, 0);
      gl.uniform1f(gl.getUniformLocation(p, 'uR'), radius);
    },
    canvasW,
    canvasH
  );
  
  // Vertical pass
  drawQuad(
    gl,
    programs.blur,
    quad,
    { uTex: dstFB.tex },
    srcFB,
    (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uTexel'), 0, 1 / srcFB.h);
      gl.uniform1f(gl.getUniformLocation(p, 'uR'), radius);
    },
    canvasW,
    canvasH
  );
}

export function upsampleAdd(gl, programs, quad, lowTex, highTex, outputFB, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.upsampleAdd,
    quad,
    { uLow: lowTex, uHigh: highTex },
    outputFB,
    (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uAdd'), 1.0);
    },
    canvasW,
    canvasH
  );
}

export function compositeBloom(gl, programs, quad, baseTex, bloomTex, outputFB, intensity, halation, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.bloomComposite,
    quad,
    { uBase: baseTex, uBloom: bloomTex },
    outputFB,
    (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uI'), intensity);
      gl.uniform1f(gl.getUniformLocation(p, 'uHal'), halation);
    },
    canvasW,
    canvasH
  );
}

export function applyVignette(gl, programs, quad, inputTex, outputFB, amount, power, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.vignette,
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uV'), amount);
      gl.uniform1f(gl.getUniformLocation(p, 'uP'), power);
    },
    canvasW,
    canvasH
  );
}

export function applyClarity(gl, programs, quad, inputTex, outputFB, amount, pxX, pxY, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.clarity,
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uPx'), pxX, pxY);
      gl.uniform1f(gl.getUniformLocation(p, 'uAmt'), amount);
    },
    canvasW,
    canvasH
  );
}

export function applyChromaticAberration(gl, programs, quad, inputTex, outputFB, amount, pxX, pxY, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.chromaticAberration,
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uPx'), pxX, pxY);
      gl.uniform1f(gl.getUniformLocation(p, 'uCA'), amount);
    },
    canvasW,
    canvasH
  );
}