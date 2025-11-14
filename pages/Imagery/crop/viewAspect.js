"use strict";

function setAspectFromBar(ratio) {
  assert(typeof ratio === "number", "setAspectFromBar: ratio must be number");

  if (!state.image && ratio !== 0) {
    console.warn("setAspectFromBar: no image loaded");
    return;
  }

  clearAllSelections();

  if (!ratio || ratio <= 0) {
    setMode(MODE.NONE);
    state.aspectRatio = 0;
  } else {
    validateAspectRatio(ratio);
    setMode(MODE.ASPECT_RATIO);
    state.aspectRatio = ratio;
    applyAspectToCrop(ratio);
  }

  requestRender();
  scheduleCommit();
}

function createAspectButtons() {
  const ratios = [
    { label: "Free", value: 0 },
    { label: "1:1", value: 1 },
    { label: "4:3", value: 4 / 3 },
    { label: "3:2", value: 3 / 2 },
    { label: "5:4", value: 5 / 4 },
    { label: "16:9", value: 16 / 9 },
    { label: "9:16", value: 9 / 16 },
    { label: "21:9", value: 21 / 9 },
  ];

  const current = state.mode === MODE.ASPECT_RATIO ? state.aspectRatio : 0;

  return ratios
    .map((r) => {
      const isActive =
        (r.value === 0 && state.mode === MODE.NONE) ||
        (state.mode === MODE.ASPECT_RATIO &&
          r.value > 0 &&
          Math.abs(current - r.value) < EPSILON);
      const cls = isActive ? "aspect-btn active" : "aspect-btn";
      return `<button class="${cls}" onclick="setAspectFromBar(${r.value})">${r.label}</button>`;
    })
    .join("");
}

function createCustomAspectControl() {
  const isWaiting = state.customAspectActive;
  const hasCustom =
    state.mode === MODE.ASPECT_RATIO &&
    !state.customAspectActive &&
    state.customAspectLabel !== "Custom";

  const label = hasCustom ? state.customAspectLabel : "Custom";

  const btnClsParts = ["aspect-btn"];
  if (state.mode === MODE.ASPECT_RATIO && (isWaiting || hasCustom)) {
    btnClsParts.push("active");
  }
  if (isWaiting) {
    btnClsParts.push("pulsing");
  }
  const btnCls = btnClsParts.join(" ");

  const inputs = isWaiting
    ? `
      <input id="custom-aspect-w" class="custom-aspect-input" type="number" min="1"
             placeholder="W" value="${state.customAspectW || ""}">
      <span>:</span>
      <input id="custom-aspect-h" class="custom-aspect-input" type="number" min="1"
             placeholder="H" value="${state.customAspectH || ""}">
      <button class="btn" onclick="applyCustomAspectInline()">✔ Apply</button>
    `
    : "";

  return `
    <div class="custom-aspect-inline">
      <button class="${btnCls}" onclick="toggleCustomAspectActive()">${label}</button>
      ${inputs}
    </div>
  `;
}

function toggleCustomAspectActive() {
  if (!state.customAspectActive) {
    clearAllSelections();
    state.customAspectActive = true;
    setMode(MODE.ASPECT_RATIO);
  } else {
    state.customAspectActive = false;
    setMode(MODE.NONE);
    state.aspectRatio = 0;
  }
  requestRender();
}

function applyCustomAspectInline() {
  if (!state.image) {
    console.warn("applyCustomAspectInline: no image loaded");
    return;
  }

  const wEl = document.getElementById("custom-aspect-w");
  const hEl = document.getElementById("custom-aspect-h");

  if (!wEl || !hEl) {
    console.error("applyCustomAspectInline: input elements not found");
    return;
  }

  const w = parseInt(wEl.value, 10);
  const h = parseInt(hEl.value, 10);

  if (!(w > 0 && h > 0)) {
    console.warn("applyCustomAspectInline: invalid dimensions");
    return;
  }

  const reduced = reduceRatio(w, h);
  if (!(reduced.w > 0 && reduced.h > 0)) {
    console.error("applyCustomAspectInline: reduceRatio failed");
    return;
  }

  const ratio = reduced.w / reduced.h;
  validateAspectRatio(ratio);

  clearAllSelections();
  setMode(MODE.ASPECT_RATIO);
  state.customAspectActive = false;
  state.aspectRatio = ratio;
  state.customAspectW = String(reduced.w);
  state.customAspectH = String(reduced.h);
  state.customAspectLabel = `Custom ${reduced.w}:${reduced.h}`;

  applyAspectToCrop(ratio);
  requestRender();
  scheduleCommit();
}
