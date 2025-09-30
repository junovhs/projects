// Motion blur effect

export function sliderToShutterSeconds(v) {
  const sMin = 1 / 250, sMax = 0.5;
  return Math.pow(sMax / sMin, v) * sMin;
}

export function formatShutter(s) {
  return s >= 1 ? `${s.toFixed(1)}s` : `1/${Math.round(1 / s)}`;
}

export function shutterToPixels(shutterSeconds, shake01) {
  const sMin = 1 / 250, sMax = 0.5;
  const t = Math.log(shutterSeconds / sMin) / Math.log(sMax / sMin);
  const base = 0.5 + 26.0 * Math.pow(t, 0.85);
  return base * (0.2 + 1.2 * shake01);
}

export function applyMotionBlur(gl, programs, quad, inputTex, outputFB, params, pxX, pxY, canvasW, canvasH, drawQuad) {
  drawQuad(
    gl,
    programs.motion,
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uPx'), pxX, pxY);
      gl.uniform1f(gl.getUniformLocation(p, 'uAmt'), params.amount);
      gl.uniform1f(gl.getUniformLocation(p, 'uAng'), params.angle * Math.PI / 180);
      gl.uniform1f(gl.getUniformLocation(p, 'uShake'), params.shake);
    },
    canvasW,
    canvasH
  );
}