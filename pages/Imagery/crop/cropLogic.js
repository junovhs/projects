// FILE: crop/cropLogic.js
"use strict";

function loadImageFile(file) {
  if (!file) {
    console.error("loadImageFile: no file provided");
    return;
  }

  assert(file instanceof File, "loadImageFile: not a File object");

  const hadPrev = !!state.image;
  const prev = hadPrev
    ? {
        x: state.crop.x,
        y: state.crop.y,
        w: state.crop.w,
        h: state.crop.h,
        imgW: state.image.naturalWidth,
        imgH: state.image.naturalHeight,
      }
    : null;

  const reader = new FileReader();

  reader.onerror = () => {
    console.error("loadImageFile: FileReader error", reader.error);
    alert("Failed to read file");
  };

  reader.onload = (e) => {
    const img = new Image();

    img.onerror = () => {
      console.error("loadImageFile: Image load error");
      alert("Failed to load image");
    };

    img.onload = () => {
      assert(img.naturalWidth > 0, "loadImageFile: invalid image width");
      assert(img.naturalHeight > 0, "loadImageFile: invalid image height");
      assert(
        img.naturalWidth <= MAX_CANVAS_DIM,
        "loadImageFile: image width exceeds max",
      );
      assert(
        img.naturalHeight <= MAX_CANVAS_DIM,
        "loadImageFile: image height exceeds max",
      );

      state.image = img;

      if (hadPrev && prev && prev.imgW > 0 && prev.imgH > 0) {
        preserveRelativeCrop(prev, img);
      } else {
        resetCropToFull(img);
      }

      clearAllSelections();
      state.committing = false;

      if (state.commitTimer) {
        clearTimeout(state.commitTimer);
        state.commitTimer = null;
      }

      renderCropView();
      fitImageToViewport();
      requestRender();
    };

    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

function preserveRelativeCrop(prev, img) {
  assert(prev, "preserveRelativeCrop: no prev");
  assert(img, "preserveRelativeCrop: no img");

  const relX = prev.x / prev.imgW;
  const relY = prev.y / prev.imgH;
  const relW = prev.w / prev.imgW;
  const relH = prev.h / prev.imgH;

  const newW = relW * img.naturalWidth;
  const newH = relH * img.naturalHeight;
  const newX = relX * img.naturalWidth;
  const newY = relY * img.naturalHeight;

  state.crop = {
    x: clamp(newX, 0, Math.max(0, img.naturalWidth - newW)),
    y: clamp(newY, 0, Math.max(0, img.naturalHeight - newH)),
    w: Math.max(MIN_CROP, Math.min(newW, img.naturalWidth)),
    h: Math.max(MIN_CROP, Math.min(newH, img.naturalHeight)),
  };

  validateCrop(state.crop);
}

function resetCropToFull(img) {
  assert(img, "resetCropToFull: no img");

  state.crop = {
    x: 0,
    y: 0,
    w: img.naturalWidth,
    h: img.naturalHeight,
  };

  validateCrop(state.crop);
}

function startDrag(e, handle) {
  if (!state.image) {
    console.warn("startDrag: no image loaded");
    return;
  }
  if (!handle) {
    console.error("startDrag: no handle provided");
    return;
  }

  assert(typeof handle === "string", "startDrag: handle must be string");

  e.preventDefault();
  e.stopPropagation();

  beginInteract();

  state.drag = {
    handle,
    startScreen: { x: e.clientX, y: e.clientY },
    startCrop: { ...state.crop },
  };

  assert(state.drag.startScreen.x !== undefined, "startDrag: invalid clientX");
  assert(state.drag.startScreen.y !== undefined, "startDrag: invalid clientY");

  window.addEventListener("mousemove", handleDrag);
  window.addEventListener("mouseup", endDrag);
}

function handleDrag(e) {
  if (!state.drag || !state.image) return;

  const { scale } = state.imageTransform;
  assert(scale > 0, "handleDrag: invalid scale");

  const dx = (e.clientX - state.drag.startScreen.x) / scale;
  const dy = (e.clientY - state.drag.startScreen.y) / scale;

  assert(Number.isFinite(dx), "handleDrag: dx not finite");
  assert(Number.isFinite(dy), "handleDrag: dy not finite");

  const next = { ...state.drag.startCrop };

  if (state.drag.handle === "move") {
    moveCrop(next, dx, dy);
  } else {
    resizeCrop(next, state.drag.startCrop, state.drag.handle, dx, dy);
  }

  state.crop = next;
  requestRender();
}

function endDrag() {
  if (!state.drag) return;

  state.drag = null;
  window.removeEventListener("mousemove", handleDrag);
  window.removeEventListener("mouseup", endDrag);

  scheduleCommit();
}

function resetCrop() {
  if (!state.image) {
    console.warn("resetCrop: no image loaded");
    return;
  }

  beginInteract();

  state.crop = {
    x: 0,
    y: 0,
    w: state.image.naturalWidth,
    h: state.image.naturalHeight,
  };

  validateCrop(state.crop);
  clearAllSelections();

  fitImageToViewport();
  requestRender();
  scheduleCommit();
}

function newImage() {
  if (state.commitTimer) {
    clearTimeout(state.commitTimer);
    state.commitTimer = null;
  }

  state.image = null;
  clearAllSelections();
  state.committing = false;

  initAppView();
}
