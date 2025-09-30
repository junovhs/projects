// Handheld camera shake (video only)

export function computeShakeScale(offsetX, offsetY, rot) {
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

export function applyHandheldShake(gl, programs, quad, inputTex, outputFB, params, frameSeed, canvasW, canvasH, drawQuad) {
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
  
  drawQuad(
    gl,
    programs.handheldShake,
    quad,
    { uTex: inputTex },
    outputFB,
    (p) => {
      gl.uniform2f(gl.getUniformLocation(p, 'uShakeOffset'), offsetX, offsetY);
      gl.uniform1f(gl.getUniformLocation(p, 'uShakeRot'), rot);
      gl.uniform2f(gl.getUniformLocation(p, 'uScale'), scaleX, scaleY);
    },
    canvasW,
    canvasH
  );
  
  return [scaleX, scaleY];
}