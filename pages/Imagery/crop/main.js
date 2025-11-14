// FILE: crop/main.js
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  initAppView();
  setupGlobalDrop();
});

function setupGlobalDrop() {
  let dragDepth = 0;
  const MAX_DRAG_DEPTH = 100;

  ["dragenter", "dragleave", "dragover", "drop"].forEach((type) => {
    document.addEventListener(type, (e) => {
      if (!e.dataTransfer || !e.dataTransfer.types) return;

      const hasFiles = Array.from(e.dataTransfer.types).includes("Files");
      if (!hasFiles) return;

      e.preventDefault();

      if (type === "dragenter") {
        dragDepth += 1;

        if (dragDepth > MAX_DRAG_DEPTH) {
          console.warn("setupGlobalDrop: drag depth exceeded, resetting");
          dragDepth = MAX_DRAG_DEPTH;
        }

        showDropHint();
      } else if (type === "dragleave") {
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) hideDropHint();
      } else if (type === "drop") {
        dragDepth = 0;
        hideDropHint();
        handleFileDrop(e);
      }
    });
  });
}

function handleFileDrop(e) {
  const dt = e.dataTransfer;

  if (!dt || !dt.files || dt.files.length === 0) {
    console.warn("handleFileDrop: no files in drop");
    return;
  }

  const file = dt.files[0];

  if (!file || !file.type || !file.type.startsWith("image/")) {
    console.warn("handleFileDrop: not an image file");
    return;
  }

  if (state.image) {
    loadImageFile(file);
    return;
  }

  const dropZone = document.getElementById("drop-zone");
  if (!dropZone) {
    loadImageFile(file);
    return;
  }

  const rect = dropZone.getBoundingClientRect();
  const x = e.clientX;
  const y = e.clientY;

  if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
    loadImageFile(file);
  }
}

function showDropHint() {
  let hint = document.getElementById("global-drop-hint");

  if (!hint) {
    hint = document.createElement("div");
    hint.id = "global-drop-hint";
    hint.className = "global-drop-hint";
    document.body.appendChild(hint);
  }

  hint.textContent = state.image
    ? "Drop image to replace"
    : "Drop image to start";
  hint.classList.add("visible");
}

function hideDropHint() {
  const hint = document.getElementById("global-drop-hint");
  if (!hint) return;

  hint.classList.remove("visible");

  setTimeout(() => {
    if (hint.parentNode && !hint.classList.contains("visible")) {
      hint.parentNode.removeChild(hint);
    }
  }, 150);
}
