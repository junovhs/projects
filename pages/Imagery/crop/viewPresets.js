"use strict";

function createTopCenterPresets() {
  return `
    <div class="top-center" onclick="event.stopPropagation()">
      <div class="preset-label">Presets</div>

      <div class="preset-dropdown">
        <div
          id="preset-social-trigger"
          class="preset-trigger"
          onclick="togglePresetMenu(event, 'social')">
          <span>${state.presetLabels.social}</span><span>▾</span>
        </div>
        <div id="preset-social-menu" class="preset-menu">
          ${createSocialPresets()}
        </div>
      </div>

      <div class="preset-dropdown">
        <div
          id="preset-docs-trigger"
          class="preset-trigger"
          onclick="togglePresetMenu(event, 'docs')">
          <span>${state.presetLabels.docs}</span><span>▾</span>
        </div>
        <div id="preset-docs-menu" class="preset-menu">
          ${createDocsPresets()}
        </div>
      </div>

      <div class="preset-dropdown">
        <div
          id="preset-custom-trigger"
          class="preset-trigger ${state.customPixelActive ? "active pulsing" : ""}"
          onclick="toggleCustomPixelActive(event)">
          <span>${state.presetLabels["custom-pixel"]}</span><span>▾</span>
        </div>
        <div id="preset-custom-pixel-menu"
             class="preset-menu ${state.customPixelActive ? "visible" : ""}">
          ${createCustomPixelControl()}
        </div>
      </div>
    </div>
  `;
}

function createSocialPresets() {
  return `
    <div class="preset-group-label">Instagram</div>
    <div class="preset-item" onclick="selectPixelPreset('social','Social Media - IG Square 1080×1080',1080,1080)">Square 1:1 1080×1080</div>
    <div class="preset-item" onclick="selectPixelPreset('social','Social Media - IG Portrait 4:5 1080×1350',1080,1350)">Portrait 4:5 1080×1350</div>
    <div class="preset-item" onclick="selectPixelPreset('social','Social Media - IG Landscape 1080×566',1080,566)">Landscape 1080×566</div>
    <div class="preset-item" onclick="selectPixelPreset('social','Social Media - IG Story 1080×1920',1080,1920)">Story/Reel 1080×1920</div>

    <div class="preset-group-label">Facebook</div>
    <div class="preset-item" onclick="selectPixelPreset('social','Social Media - FB Link 1200×630',1200,630)">Link 1200×630</div>
    <div class="preset-item" onclick="selectPixelPreset('social','Social Media - FB Post 1080×1080',1080,1080)">Post 1080×1080</div>
    <div class="preset-item" onclick="selectPixelPreset('social','Social Media - FB Cover 820×312',820,312)">Cover 820×312</div>

    <div class="preset-group-label">X / Twitter</div>
    <div class="preset-item" onclick="selectPixelPreset('social','Social Media - X Post 1600×900',1600,900)">Post 1600×900</div>
    <div class="preset-item" onclick="selectPixelPreset('social','Social Media - X Header 1500×500',1500,500)">Header 1500×500</div>

    <div class="preset-group-label">YouTube</div>
    <div class="preset-item" onclick="selectPixelPreset('social','Social Media - YT Thumb 1280×720',1280,720)">Thumbnail 1280×720</div>
    <div class="preset-item" onclick="selectPixelPreset('social','Social Media - YT Frame 1920×1080',1920,1080)">Frame 1920×1080</div>
  `;
}

function createDocsPresets() {
  return `
    <div class="preset-group-label">Print @300dpi</div>
    <div class="preset-item" onclick="selectPixelPreset('docs','Documents - A4 2480×3508',2480,3508)">A4 2480×3508</div>
    <div class="preset-item" onclick="selectPixelPreset('docs','Documents - Letter 2550×3300',2550,3300)">Letter 2550×3300</div>
    <div class="preset-item" onclick="selectPixelPreset('docs','Documents - A5 1748×2480',1748,2480)">A5 1748×2480</div>
  `;
}

function createCustomPixelControl() {
  return `
    <div class="preset-group-label">Custom Output Size</div>
    <div class="custom-pixel-inline">
      <input id="custom-pixel-w" type="number" min="1" placeholder="W"
             class="custom-aspect-input"
             value="${state.customPixelW || ""}">
      <span>×</span>
      <input id="custom-pixel-h" type="number" min="1" placeholder="H"
             class="custom-aspect-input"
             value="${state.customPixelH || ""}">
      <button class="btn" onclick="applyCustomPixelPreset()">✔ Apply</button>
    </div>
  `;
}

function togglePresetMenu(ev, key) {
  assert(typeof key === "string", "togglePresetMenu: key must be string");
  assert(["social", "docs"].includes(key), "togglePresetMenu: invalid key");

  ev.stopPropagation();

  if (key === "social" || key === "docs") {
    const menu = document.getElementById(`preset-${key}-menu`);
    if (!menu) {
      console.error(`togglePresetMenu: menu not found for ${key}`);
      return;
    }

    const visible = menu.classList.contains("visible");
    closeAllPresetMenus();
    if (!visible) menu.classList.add("visible");
  }
}

function toggleCustomPixelActive(ev) {
  ev.stopPropagation();
  closeAllPresetMenus();

  state.customPixelActive = !state.customPixelActive;

  if (!state.customPixelActive) {
    const menu = document.getElementById("preset-custom-pixel-menu");
    if (menu) menu.classList.remove("visible");
  }

  requestRender();
}

function closeAllPresetMenus() {
  document
    .querySelectorAll(".preset-menu.visible")
    .forEach((m) => m.classList.remove("visible"));
}

function selectPixelPreset(key, label, w, h) {
  if (!state.image) {
    console.warn("selectPixelPreset: no image loaded");
    return;
  }

  assert(typeof key === "string", "selectPixelPreset: key must be string");
  assert(typeof label === "string", "selectPixelPreset: label must be string");
  validatePixelDimension(w);
  validatePixelDimension(h);

  closeAllPresetMenus();
  clearAllSelections();
  setMode(MODE.PIXEL_PRESET);
  markPresetActive(key, label);

  const ratio = w / h;
  validateAspectRatio(ratio);
  state.aspectRatio = ratio;
  applyAspectToCrop(ratio);

  state.exportW = String(w);
  state.exportH = String(h);

  requestRender();
  scheduleCommit();
}

function applyCustomPixelPreset() {
  if (!state.image) {
    console.warn("applyCustomPixelPreset: no image loaded");
    return;
  }

  const wEl = document.getElementById("custom-pixel-w");
  const hEl = document.getElementById("custom-pixel-h");

  if (!wEl || !hEl) {
    console.error("applyCustomPixelPreset: input elements not found");
    return;
  }

  const w = parseInt(wEl.value, 10);
  const h = parseInt(hEl.value, 10);

  if (!(w > 0 && h > 0)) {
    console.warn("applyCustomPixelPreset: invalid dimensions");
    return;
  }

  validatePixelDimension(w);
  validatePixelDimension(h);

  closeAllPresetMenus();
  state.customPixelActive = false;

  clearAllSelections();
  setMode(MODE.CUSTOM_PIXEL);
  state.customPixelW = String(w);
  state.customPixelH = String(h);
  markPresetActive("custom-pixel", `Custom Pixels - ${w}×${h}`);

  state.exportW = String(w);
  state.exportH = String(h);

  const ratio = w / h;
  validateAspectRatio(ratio);
  state.aspectRatio = ratio;
  applyAspectToCrop(ratio);

  requestRender();
  scheduleCommit();
}

function updatePresetTriggers() {
  const map = {
    social: "preset-social-trigger",
    docs: "preset-docs-trigger",
    "custom-pixel": "preset-custom-trigger",
  };

  Object.entries(map).forEach(([key, id]) => {
    const trigger = document.getElementById(id);
    if (!trigger) return;

    const span = trigger.querySelector("span");
    if (span) span.textContent = state.presetLabels[key];

    if (state.activePresetKey === key) {
      trigger.classList.add("active");
    } else {
      trigger.classList.remove("active");
    }
  });

  const customMenu = document.getElementById("preset-custom-pixel-menu");
  if (customMenu) {
    if (state.customPixelActive) customMenu.classList.add("visible");
    else customMenu.classList.remove("visible");
  }
}
