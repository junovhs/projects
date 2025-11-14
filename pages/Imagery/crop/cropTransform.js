// FILE: crop/cropTransform.js
"use strict";

function fitImageToViewport() {
  const img = state.image;
  assert(img, "fitImageToViewport: no image");
  assert(state.viewport.w > 0, "fitImageToViewport: invalid viewport width");
  assert(state.viewport.h > 0, "fitImageToViewport: invalid viewport height");

  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const marginW = state.viewport.w * CENTER_MARGIN * 2;
  const marginH = state.viewport.h * CENTER_MARGIN * 2;

  const scale = Math.min(
    1,
    (state.viewport.w - marginW) / imgW,
    (state.viewport.h - marginH) / imgH,
  );

  const tx = (state.viewport.w - imgW * scale) / 2;
  const ty = (state.viewport.h - imgH * scale) / 2;

  assert(scale > 0, "fitImageToViewport: scale must be positive");
  assert(Number.isFinite(tx), "fitImageToViewport: tx must be finite");
  assert(Number.isFinite(ty), "fitImageToViewport: ty must be finite");

  state.imageTransform.scale = scale;
  state.imageTransform.tx = tx;
  state.imageTransform.ty = ty;
}

function computeCenteredTransform() {
  const img = state.image;
  if (!img || !state.viewport.w || !state.viewport.h) return null;

  const { x, y, w, h } = state.crop;
  const { scale, tx, ty } = state.imageTransform;

  assert(scale > 0, "computeCenteredTransform: invalid scale");
  validateCrop(state.crop);

  const cropCx = tx + (x + w / 2) * scale;
  const cropCy = ty + (y + h / 2) * scale;

  const viewportCx = state.viewport.w / 2;
  const viewportCy = state.viewport.h / 2;

  let dx = viewportCx - cropCx;
  let dy = viewportCy - cropCy;

  const marginX = state.viewport.w * CENTER_MARGIN;
  const marginY = state.viewport.h * CENTER_MARGIN;

  const left = tx + x * scale + dx;
  const top = ty + y * scale + dy;
  const right = left + w * scale;
  const bottom = top + h * scale;

  if (left < marginX) dx += marginX - left;
  if (right > state.viewport.w - marginX) {
    dx -= right - (state.viewport.w - marginX);
  }
  if (top < marginY) dy += marginY - top;
  if (bottom > state.viewport.h - marginY) {
    dy -= bottom - (state.viewport.h - marginY);
  }

  const result = {
    scale,
    tx: tx + dx,
    ty: ty + dy,
  };

  assert(Number.isFinite(result.tx), "computeCenteredTransform: tx not finite");
  assert(Number.isFinite(result.ty), "computeCenteredTransform: ty not finite");

  return result;
}

function scheduleCommit() {
  if (state.commitTimer) {
    clearTimeout(state.commitTimer);
  }

  state.commitTimer = setTimeout(() => {
    state.commitTimer = null;
    if (!state.image) return;

    const target = computeCenteredTransform();
    if (!target) return;

    const canvas = document.getElementById("canvas");
    if (!canvas) {
      state.imageTransform.tx = target.tx;
      state.imageTransform.ty = target.ty;
      requestRender();
      return;
    }

    state.committing = true;

    canvas.classList.add("canvas-committing");

    void canvas.offsetHeight;

    window.requestAnimationFrame(() => {
      state.imageTransform.tx = target.tx;
      state.imageTransform.ty = target.ty;
      requestRender();

      setTimeout(() => {
        state.committing = false;
      }, TRANSITION_MS + 30);
    });
  }, COMMIT_DELAY);
}

function beginInteract() {
  if (state.commitTimer) {
    clearTimeout(state.commitTimer);
    state.commitTimer = null;
  }

  state.committing = false;

  const canvas = document.getElementById("canvas");
  if (canvas) {
    canvas.classList.remove("canvas-committing");
  }
}

function applyAspectToCrop(ratio) {
  const img = state.image;
  assert(img, "applyAspectToCrop: no image");
  assert(ratio > 0, "applyAspectToCrop: ratio must be positive");
  validateAspectRatio(ratio);

  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  let w;
  let h;
  if (imgW / imgH > ratio) {
    h = imgH;
    w = h * ratio;
  } else {
    w = imgW;
    h = w / ratio;
  }

  assert(w > 0 && w <= imgW, "applyAspectToCrop: invalid width");
  assert(h > 0 && h <= imgH, "applyAspectToCrop: invalid height");

  state.crop = {
    x: (imgW - w) / 2,
    y: (imgH - h) / 2,
    w,
    h,
  };

  validateCrop(state.crop);
}
