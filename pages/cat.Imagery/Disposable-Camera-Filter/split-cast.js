// Split toning and color casts

export function applySplitToning(gl, programs, quad, inputTex, outputFB, params, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.split,
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uSh'), params.shadowCool);
      gl.uniform1f(gl.getUniformLocation(p, 'uHi'), params.highlightWarm);
    },
    canvasW,
    canvasH
  );
}

export function applyColorCast(gl, programs, quad, inputTex, outputFB, params, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.cast,
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uGS'), params.greenShadows);
      gl.uniform1f(gl.getUniformLocation(p, 'uMM'), params.magentaMids);
    },
    canvasW,
    canvasH
  );
}