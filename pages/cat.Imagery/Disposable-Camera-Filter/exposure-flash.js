// Exposure and flash effects

export function applyExposure(gl, programs, quad, inputTex, outputFB, ev, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl, 
    programs.pre, 
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uEV'), ev);
    },
    canvasW,
    canvasH
  );
}

export function applyFlash(gl, programs, quad, inputTex, outputFB, params, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.flash,
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uCenter'), 
        1.0 - params.centerX, params.centerY);
      gl.uniform1f(gl.getUniformLocation(p, 'uStrength'), params.strength);
      gl.uniform1f(gl.getUniformLocation(p, 'uFall'), params.falloff);
    },
    canvasW,
    canvasH
  );
}