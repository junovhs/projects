// Film grain effect

export function applyGrain(gl, programs, quad, inputTex, params, time, frameSeed, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.grain,
    quad,
    { uTex: inputTex },
    null, // Draw to screen
    (p) => {
      gl.uniform1f(gl.getUniformLocation(p, 'uASA'), params.asa);
      gl.uniform1f(gl.getUniformLocation(p, 'uDev'), params.develop);
      gl.uniform1f(gl.getUniformLocation(p, 'uStock'), params.stock);
      gl.uniform1f(gl.getUniformLocation(p, 'uChroma'), params.chroma);
      gl.uniform1f(gl.getUniformLocation(p, 'uMag'), params.magnify);
      gl.uniform1f(gl.getUniformLocation(p, 'uShadow'), 0.70);
      gl.uniform1f(gl.getUniformLocation(p, 'uTime'), time * 0.001);
      gl.uniform1f(gl.getUniformLocation(p, 'uSeed'), frameSeed);
      gl.uniform1f(gl.getUniformLocation(p, 'uDither'), 0.5);
    },
    canvasW,
    canvasH
  );
}