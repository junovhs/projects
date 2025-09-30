// Tone curve operations

export function applyTone(gl, programs, quad, inputTex, outputFB, params, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.tone,
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uSc'), params.scurve);
      gl.uniform1f(gl.getUniformLocation(p, 'uBl'), params.blacks);
      gl.uniform1f(gl.getUniformLocation(p, 'uKnee'), params.knee);
      gl.uniform1f(gl.getUniformLocation(p, 'uLift'), params.blackLift);
    },
    canvasW,
    canvasH
  );
}