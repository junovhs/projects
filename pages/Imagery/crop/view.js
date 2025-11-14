// FILE: crop/view.js
"use strict";

function initAppView() {
  const app = document.getElementById("app");
  assert(app, "initAppView: missing #app container");
  app.innerHTML = createDropZone();
  bindDropZone();
}

function createDropZone() {
  return `
    <div class="drop-zone" id="drop-zone">
      <input type="file" id="file-input" accept="image/*" class="hidden">
      <div>Drop image here</div>
    </div>
  `;
}

function bindDropZone() {
  const zone = document.getElementById("drop-zone");
  const input = document.getElementById("file-input");
  assert(zone, "bindDropZone: missing drop zone");
  assert(input, "bindDropZone: missing file input");

  zone.onclick = () => input.click();

  input.onchange = (e) => {
    if (e.target.files && e.target.files.length) {
      loadImageFile(e.target.files[0]);
    }
  };

  zone.ondragover = (e) => {
    e.preventDefault();
    zone.classList.add("dragging");
  };

  zone.ondragleave = () => zone.classList.remove("dragging");

  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("dragging");
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      loadImageFile(e.dataTransfer.files[0]);
    }
  };
}

function renderCropView() {
  assert(state.image, "renderCropView: no image");

  const app = document.getElementById("app");
  assert(app, "renderCropView: missing #app container");

  app.innerHTML = createCropView();
  bindCropView();

  const viewport = document.getElementById("viewport");
  assert(viewport, "renderCropView: missing viewport");

  const observer = new ResizeObserver(onViewportResize);
  observer.observe(viewport);

  onViewportResize();
}

function createCropView() {
  const img = state.image;
  const crop = state.crop;
  const srcText = `Src: ${img.naturalWidth}×${img.naturalHeight}`;
  const cropText = `Crop: ${Math.round(crop.w)}×${Math.round(crop.h)}`;

  return `
    <div class="viewport" id="viewport">
      <canvas id="canvas"></canvas>
      <div class="crop-overlay" id="crop-overlay">
        <div class="crop-area" id="crop-area"></div>
        ${createHandles()}
        ${createEdges()}
        <canvas id="grid-canvas" class="grid-canvas"></canvas>
      </div>
    </div>

    ${createTopLeft()}
    ${createTopCenterPresets()}
    ${createTopRight()}
    ${createBottomCenter(srcText, cropText)}
  `;
}

function createHandles() {
  return `
    <div class="handle nw" data-handle="nw"></div>
    <div class="handle ne" data-handle="ne"></div>
    <div class="handle sw" data-handle="sw"></div>
    <div class="handle se" data-handle="se"></div>
  `;
}

function createEdges() {
  return `
    <div class="edge n" data-handle="n"></div>
    <div class="edge s" data-handle="s"></div>
    <div class="edge w" data-handle="w"></div>
    <div class="edge e" data-handle="e"></div>
  `;
}

function createTopLeft() {
  return `
    <div class="top-left">
      <button class="btn" onclick="resetCrop()">Reset Crop</button>
      <button class="btn" onclick="newImage()">New Image</button>
      <label class="grid-toggle">
        <input type="checkbox" id="grid-toggle-input" checked
               onchange="toggleGrid(this.checked)">
        <span>Grid (Rule of Thirds)</span>
      </label>
    </div>
  `;
}

function createTopRight() {
  return `
    <div class="top-right">
      <div class="top-right-label">Export</div>
      <div class="dim-field">
        <span class="dim-caption">Width</span>
        <input
          type="number"
          id="export-w"
          class="export-input"
          inputmode="numeric"
          oninput="onExportInput('w', this.value)">
      </div>
      <span style="color:#555;">×</span>
      <div class="dim-field">
        <span class="dim-caption">Height</span>
        <input
          type="number"
          id="export-h"
          class="export-input"
          inputmode="numeric"
          oninput="onExportInput('h', this.value)">
      </div>
      <button class="btn btn-primary" onclick="exportImage()">Export</button>
      <div id="scale-indicator" class="scale-indicator hidden"></div>
    </div>
  `;
}

function createBottomCenter(srcText, cropText) {
  return `
    <div class="bottom-center">
      <div class="info">
        <div id="src-info">${srcText}</div>
        <div id="crop-info">${cropText}</div>
      </div>
      <div class="aspect-btns" id="aspect-btns">
        ${createAspectButtons()}
        ${createCustomAspectControl()}
      </div>
    </div>
  `;
}

function bindCropView() {
  document
    .querySelectorAll("[data-handle]")
    .forEach((h) => (h.onmousedown = (e) => startDrag(e, h.dataset.handle)));

  const area = document.getElementById("crop-area");
  assert(area, "bindCropView: missing crop area");
  area.onmousedown = (e) => startDrag(e, "move");

  const gridToggle = document.getElementById("grid-toggle-input");
  if (gridToggle) {
    gridToggle.checked = state.showGrid;
  }

  syncExportInputsToCrop();
  updatePresetTriggers();

  document.addEventListener("click", closeAllPresetMenus);
}

function onViewportResize() {
  if (!state.image) return;

  const viewport = document.getElementById("viewport");
  if (!viewport) {
    console.error("onViewportResize: viewport not found");
    return;
  }

  state.viewport.w = viewport.clientWidth;
  state.viewport.h = viewport.clientHeight;

  assert(state.viewport.w > 0, "onViewportResize: invalid width");
  assert(state.viewport.h > 0, "onViewportResize: invalid height");

  if (!state.drag && !state.committing) {
    fitImageToViewport();
  }

  requestRender();
}

function renderFrame() {
  if (!state.image) return;

  const canvas = document.getElementById("canvas");
  const overlay = document.getElementById("crop-overlay");
  const gridCanvas = document.getElementById("grid-canvas");

  if (!canvas || !overlay || !gridCanvas) {
    console.error("renderFrame: missing DOM elements");
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("renderFrame: failed to get 2d context");
    return;
  }

  const img = state.image;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const { scale, tx, ty } = state.imageTransform;
  const { x, y, w, h } = state.crop;

  canvas.style.transformOrigin = "0 0";
  canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;

  const cropLeft = tx + x * scale;
  const cropTop = ty + y * scale;
  const cropW = w * scale;
  const cropH = h * scale;

  overlay.style.left = `${cropLeft}px`;
  overlay.style.top = `${cropTop}px`;
  overlay.style.width = `${cropW}px`;
  overlay.style.height = `${cropH}px`;

  overlay.className = state.committing
    ? "crop-overlay committing"
    : "crop-overlay";

  updateCropInfo();
  updatePresetTriggers();
  syncExportInputsToCrop();
  updateScaleIndicator();
  renderGrid(gridCanvas, cropW, cropH);
  updateAspectBar();
}

function updateCropInfo() {
  const cropInfo = document.getElementById("crop-info");
  if (cropInfo) {
    const w = Math.round(state.crop.w);
    const h = Math.round(state.crop.h);
    cropInfo.textContent = `Crop: ${w}×${h}`;
  }
}

function updateAspectBar() {
  const aspectBar = document.getElementById("aspect-btns");
  if (aspectBar) {
    aspectBar.innerHTML = createAspectButtons() + createCustomAspectControl();
  }
}

function renderGrid(gridCanvas, cropW, cropH) {
  if (!state.showGrid || cropW <= 0 || cropH <= 0) {
    gridCanvas.width = 0;
    gridCanvas.height = 0;
    return;
  }

  gridCanvas.width = cropW;
  gridCanvas.height = cropH;
  gridCanvas.style.left = "0";
  gridCanvas.style.top = "0";

  const gctx = gridCanvas.getContext("2d");
  if (!gctx) return;

  gctx.clearRect(0, 0, cropW, cropH);
  gctx.strokeStyle = "rgba(255,255,255,0.25)";
  gctx.lineWidth = 1;

  const x1 = cropW / 3;
  const x2 = (cropW * 2) / 3;
  const y1 = cropH / 3;
  const y2 = (cropH * 2) / 3;

  gctx.beginPath();
  gctx.moveTo(x1, 0);
  gctx.lineTo(x1, cropH);
  gctx.moveTo(x2, 0);
  gctx.lineTo(x2, cropH);
  gctx.moveTo(0, y1);
  gctx.lineTo(cropW, y1);
  gctx.moveTo(0, y2);
  gctx.lineTo(cropW, y2);
  gctx.stroke();
}

function toggleGrid(on) {
  state.showGrid = !!on;
  requestRender();
}
