"use strict";

// Tunables
const MIN_CROP = 20;
const COMMIT_DELAY = 350;
const CENTER_MARGIN = 0.15;
const TRANSITION_MS = 500;
const MAX_CANVAS_DIM = 16384;
const EPSILON = 0.001;
const MAX_ASPECT_VALUE = 100;
const MAX_PIXEL_DIM = 50000;

const MODE = {
  NONE: "none",
  ASPECT_RATIO: "aspect-ratio",
  PIXEL_PRESET: "pixel-preset",
  CUSTOM_PIXEL: "custom-pixel",
};

const state = {
  image: null,
  crop: { x: 0, y: 0, w: 0, h: 0 },
  viewport: { w: 0, h: 0 },
  imageTransform: { scale: 1, tx: 0, ty: 0 },
  drag: null,
  committing: false,
  commitTimer: null,
  needsRender: false,
  mode: MODE.NONE,
  aspectRatio: 0,
  exportW: "",
  exportH: "",
  activePresetKey: null,
  presetLabels: {
    social: "Social Media",
    docs: "Documents",
    "custom-pixel": "Custom Pixels",
  },
  customAspectActive: false,
  customAspectW: "",
  customAspectH: "",
  customAspectLabel: "Custom",
  customPixelActive: false,
  customPixelW: "",
  customPixelH: "",
  showGrid: true,
  scaleFactor: 1,
  scaleLevel: "ok",
};

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

function clamp(val, min, max) {
  assert(typeof val === "number", "clamp: val must be number");
  assert(typeof min === "number", "clamp: min must be number");
  assert(typeof max === "number", "clamp: max must be number");
  assert(min <= max, "clamp: min must be <= max");
  return Math.max(min, Math.min(max, val));
}

function getCropAspect() {
  const valid = state.crop.w > 0 && state.crop.h > 0;
  return valid ? state.crop.w / state.crop.h : 0;
}

function reduceRatio(w, h) {
  assert(typeof w === "number", "reduceRatio: w must be number");
  assert(typeof h === "number", "reduceRatio: h must be number");

  if (!(w > 0 && h > 0)) return { w: 0, h: 0 };

  let a = w;
  let b = h;
  let iterations = 0;
  const MAX_ITERATIONS = 1000;

  while (b !== 0 && iterations < MAX_ITERATIONS) {
    const t = b;
    b = a % b;
    a = t;
    iterations++;
  }

  assert(iterations < MAX_ITERATIONS, "reduceRatio: exceeded iteration limit");
  const g = a || 1;
  return { w: w / g, h: h / g };
}

function setMode(newMode) {
  assert(Object.values(MODE).includes(newMode), "setMode: invalid mode");
  state.mode = newMode;
}

function clearAllSelections() {
  state.mode = MODE.NONE;
  state.aspectRatio = 0;
  state.exportW = "";
  state.exportH = "";
  state.activePresetKey = null;
  state.customAspectActive = false;
  state.customAspectW = "";
  state.customAspectH = "";
  state.customAspectLabel = "Custom";
  state.customPixelActive = false;
  state.customPixelW = "";
  state.customPixelH = "";
  state.presetLabels.social = "Social Media";
  state.presetLabels.docs = "Documents";
  state.presetLabels["custom-pixel"] = "Custom Pixels";
}

function markPresetActive(key, label) {
  assert(typeof key === "string", "markPresetActive: key must be string");
  assert(typeof label === "string", "markPresetActive: label must be string");
  assert(key in state.presetLabels, "markPresetActive: invalid key");

  state.activePresetKey = key;

  if (key === "social") {
    state.presetLabels.social = label;
    state.presetLabels.docs = "Documents";
    state.presetLabels["custom-pixel"] = "Custom Pixels";
  } else if (key === "docs") {
    state.presetLabels.docs = label;
    state.presetLabels.social = "Social Media";
    state.presetLabels["custom-pixel"] = "Custom Pixels";
  } else if (key === "custom-pixel") {
    state.presetLabels["custom-pixel"] = label;
    state.presetLabels.social = "Social Media";
    state.presetLabels.docs = "Documents";
  }
}

function requestRender() {
  if (state.needsRender) return;
  state.needsRender = true;
  window.requestAnimationFrame(() => {
    state.needsRender = false;
    renderFrame();
  });
}

function validateCrop(crop) {
  assert(crop !== null, "validateCrop: crop is null");
  assert(typeof crop.x === "number", "validateCrop: x must be number");
  assert(typeof crop.y === "number", "validateCrop: y must be number");
  assert(typeof crop.w === "number", "validateCrop: w must be number");
  assert(typeof crop.h === "number", "validateCrop: h must be number");
  assert(crop.x >= 0, "validateCrop: x must be >= 0");
  assert(crop.y >= 0, "validateCrop: y must be >= 0");
  assert(crop.w >= MIN_CROP, "validateCrop: w must be >= MIN_CROP");
  assert(crop.h >= MIN_CROP, "validateCrop: h must be >= MIN_CROP");
  return true;
}

function validateAspectRatio(ratio) {
  assert(typeof ratio === "number", "validateAspectRatio: must be number");
  assert(ratio >= 0, "validateAspectRatio: must be >= 0");
  assert(ratio <= MAX_ASPECT_VALUE, "validateAspectRatio: exceeds max");
  return true;
}

function validatePixelDimension(dim) {
  assert(typeof dim === "number", "validatePixelDimension: must be number");
  assert(dim > 0, "validatePixelDimension: must be > 0");
  assert(dim <= MAX_PIXEL_DIM, "validatePixelDimension: exceeds max");
  assert(Number.isInteger(dim), "validatePixelDimension: must be integer");
  return true;
}
