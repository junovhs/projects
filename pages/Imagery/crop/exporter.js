// FILE: crop/exporter.js
"use strict";

function onExportInput(dim, val) {
  if (!state.image || !state.crop.w || !state.crop.h) {
    console.warn("onExportInput: no valid crop");
    return;
  }

  assert(dim === "w" || dim === "h", "onExportInput: invalid dimension");
  assert(typeof val === "string", "onExportInput: val must be string");

  let w = parseInt(state.exportW, 10) || Math.round(state.crop.w);
  let h = parseInt(state.exportH, 10) || Math.round(state.crop.h);

  const nv = parseInt(val, 10);
  if (!(nv > 0)) {
    console.warn("onExportInput: invalid value");
    return;
  }

  if (dim === "w") w = nv;
  else h = nv;

  if (w > MAX_PIXEL_DIM || h > MAX_PIXEL_DIM) {
    console.warn("onExportInput: dimension exceeds max");
    return;
  }

  if (
    state.mode === MODE.ASPECT_RATIO ||
    state.mode === MODE.PIXEL_PRESET ||
    state.mode === MODE.CUSTOM_PIXEL
  ) {
    const r = state.aspectRatio || getCropAspect() || 1;
    validateAspectRatio(r);

    if (dim === "w") {
      h = Math.round(w / r);
    } else {
      w = Math.round(h * r);
    }
  }

  state.exportW = String(w);
  state.exportH = String(h);

  syncExportInputsToCrop();
  updateScaleIndicator();
}

function syncExportInputsToCrop() {
  const ew = document.getElementById("export-w");
  const eh = document.getElementById("export-h");

  if (!ew || !eh) return;
  if (!state.crop.w || !state.crop.h) return;

  const cropW = Math.round(state.crop.w);
  const cropH = Math.round(state.crop.h);

  let w = parseInt(state.exportW, 10);
  let h = parseInt(state.exportH, 10);

  if (state.mode === MODE.CUSTOM_PIXEL) {
    if (!(w > 0 && h > 0)) {
      w = cropW;
      h = cropH;
    }
  } else if (
    state.mode === MODE.PIXEL_PRESET ||
    state.mode === MODE.ASPECT_RATIO
  ) {
    const r = state.aspectRatio || getCropAspect() || 1;

    if (!(w > 0 && h > 0)) {
      w = cropW;
      h = Math.round(w / r);
    }

    if (w > cropW) w = cropW;
    h = Math.round(w / r);

    if (h > cropH) {
      h = cropH;
      w = Math.round(h * r);
    }
  } else {
    w = cropW;
    h = cropH;
  }

  if (!(w > 0 && h > 0)) {
    w = cropW;
    h = cropH;
  }

  state.exportW = String(w);
  state.exportH = String(h);
  ew.value = w;
  eh.value = h;
}

function updateScaleIndicator() {
  const el = document.getElementById("scale-indicator");
  if (!el) return;

  if (state.mode !== MODE.CUSTOM_PIXEL) {
    el.className = "scale-indicator hidden";
    return;
  }

  const cropW = state.crop.w;
  const cropH = state.crop.h;
  const w = parseInt(state.exportW, 10);
  const h = parseInt(state.exportH, 10);

  if (!(cropW > 0 && cropH > 0 && w > 0 && h > 0)) {
    el.className = "scale-indicator hidden";
    return;
  }

  const scaleX = cropW / w;
  const scaleY = cropH / h;
  const scale = Math.min(scaleX, scaleY);

  state.scaleFactor = scale;

  let level = "ok";
  if (scale < 1) level = "bad";
  else if (scale < 1.5) level = "warn";
  state.scaleLevel = level;

  const pct = (scale * 100).toFixed(0);
  let text = `Scale: ${pct}%`;

  if (level === "ok") text += " (good detail)";
  else if (level === "warn") text += " (near native)";
  else text += " (UPSCALING - may pixelate)";

  el.textContent = text;
  el.className = `scale-indicator ${level}`;
}

function exportImage() {
  if (!state.image) {
    console.error("exportImage: no image");
    alert("No image loaded");
    return;
  }

  validateCrop(state.crop);

  const w = parseInt(state.exportW, 10) || Math.round(state.crop.w);
  const h = parseInt(state.exportH, 10) || Math.round(state.crop.h);

  if (!(w > 0 && h > 0)) {
    console.error("exportImage: invalid dimensions");
    alert("Invalid export dimensions");
    return;
  }

  if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
    console.error("exportImage: dimensions exceed canvas max");
    alert(`Export dimensions exceed maximum (${MAX_CANVAS_DIM}px)`);
    return;
  }

  const offCanvas = document.createElement("canvas");
  offCanvas.width = w;
  offCanvas.height = h;

  const ctx = offCanvas.getContext("2d");
  if (!ctx) {
    console.error("exportImage: failed to get context");
    alert("Failed to create export canvas");
    return;
  }

  const { x, y, w: cw, h: ch } = state.crop;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(state.image, x, y, cw, ch, 0, 0, w, h);

  offCanvas.toBlob(
    (blob) => {
      if (!blob) {
        console.error("exportImage: blob creation failed");
        alert("Failed to create image blob");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const filename = generateFilename(w, h);
      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 100);
    },
    "image/png",
    1.0,
  );
}

function generateFilename(w, h) {
  const ratio = reduceRatio(w, h);
  const ar = `${ratio.w}-${ratio.h}`;
  const timestamp = Date.now();
  return `crop_${ar}_${w}x${h}_${timestamp}.png`;
}
