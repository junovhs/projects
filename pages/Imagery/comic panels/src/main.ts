import { createInitialState } from "./state";
import { AppState } from "./types";
import { initDomRefs, populateSetupControls } from "./dom";
import { Result, isOk } from "./result";
import {
  inchesToUnit,
  unitToInches,
  formatNumber,
  PRESETS
} from "./config";
import {
  recomputePanels,
  resetAllPanels,
  generateGrid,
  mergeSelectedPanels,
  deleteCutAtIndex
} from "./panels";
import { draw, updateSplitOverlayPosition } from "./render";
import { createCanvasHandlers } from "./events";
import { exportSvg } from "./exporter";
import { ExportKind, DomRefs } from "./types";

function setBleed(state: AppState, dom: DomRefs): void {
const value = parseFloat(dom.bleedRange.value) || 0;
state.bleedIn = Math.max(
0,
unitToInches(value, state.units)
);
dom.bleedNum.value = formatNumber(
inchesToUnit(state.bleedIn, state.units),
3
);
}

function setLive(state: AppState, dom: DomRefs): void {
const value = parseFloat(dom.liveRange.value) || 0;
state.liveIn = Math.max(
0,
unitToInches(value, state.units)
);
}

function setInset(state: AppState, dom: DomRefs): void {
const value = parseFloat(dom.insetRange.value) || 0;
state.insetIn = Math.max(
0,
unitToInches(value, state.units)
);
}

function setGutter(state: AppState, dom: DomRefs): void {
const value = parseFloat(dom.gutterRange.value) || 0;
state.gutterPx = Math.max(0, value | 0);
dom.gutterNum.value = String(state.gutterPx);
}

function setStroke(state: AppState, dom: DomRefs): void {
const value = parseFloat(dom.strokeRange.value) || 1;
state.strokePx = Math.max(1, value);
dom.strokeNum.value = String(state.strokePx);
}

function setupSizeControls(
state: AppState,
dom: DomRefs,
redraw: () => void
): void {
dom.size.addEventListener("change", () => {
state.documentSize = dom.size.value as any;
const preset = PRESETS[state.documentSize];
state.docWIn = preset.wIn;
state.docHIn = preset.hIn;

```
dom.wInp.value = formatNumber(
  inchesToUnit(state.docWIn, state.units),
  3
);
dom.hInp.value = formatNumber(
  inchesToUnit(state.docHIn, state.units),
  3
);

recomputePanels(state);
redraw();
```

});

dom.units.addEventListener("change", () => {
state.units = dom.units.value as any;

```
dom.wInp.value = formatNumber(
  inchesToUnit(state.docWIn, state.units),
  3
);
dom.hInp.value = formatNumber(
  inchesToUnit(state.docHIn, state.units),
  3
);
dom.bleedRange.value = String(
  inchesToUnit(state.bleedIn, state.units)
);
dom.bleedNum.value = formatNumber(
  inchesToUnit(state.bleedIn, state.units),
  3
);
dom.liveRange.value = String(
  inchesToUnit(state.liveIn, state.units)
);
dom.liveNum.value = formatNumber(
  inchesToUnit(state.liveIn, state.units),
  3
);
dom.insetRange.value = String(
  inchesToUnit(state.insetIn, state.units)
);
dom.insetNum.value = formatNumber(
  inchesToUnit(state.insetIn, state.units),
  3
);

redraw();
```

});

dom.dpi.addEventListener("change", () => {
state.dpi = parseInt(dom.dpi.value, 10) || 300;
redraw();
});

dom.landscape.addEventListener("change", () => {
state.isLandscape = dom.landscape.checked;
redraw();
});

dom.wInp.addEventListener("input", () => {
const v = parseFloat(dom.wInp.value);
if (!Number.isNaN(v) && v > 0) {
state.docWIn = unitToInches(v, state.units);
recomputePanels(state);
redraw();
}
});

dom.hInp.addEventListener("input", () => {
const v = parseFloat(dom.hInp.value);
if (!Number.isNaN(v) && v > 0) {
state.docHIn = unitToInches(v, state.units);
recomputePanels(state);
redraw();
}
});
}

function setupGuideControls(
state: AppState,
dom: DomRefs,
redraw: () => void
): void {
dom.bleedRange.addEventListener("input", () => {
setBleed(state, dom);
redraw();
});

dom.bleedNum.addEventListener("input", () => {
const n = parseFloat(dom.bleedNum.value);
if (!Number.isNaN(n) && n >= 0) {
state.bleedIn = unitToInches(n, state.units);
redraw();
}
});

dom.liveRange.addEventListener("input", () => {
setLive(state, dom);
recomputePanels(state);
redraw();
});

dom.liveNum.addEventListener("input", () => {
const n = parseFloat(dom.liveNum.value);
if (!Number.isNaN(n) && n >= 0) {
state.liveIn = unitToInches(n, state.units);
recomputePanels(state);
redraw();
}
});

dom.insetRange.addEventListener("input", () => {
setInset(state, dom);
recomputePanels(state);
redraw();
});

dom.insetNum.addEventListener("input", () => {
const n = parseFloat(dom.insetNum.value);
if (!Number.isNaN(n) && n >= 0) {
state.insetIn = unitToInches(n, state.units);
recomputePanels(state);
redraw();
}
});
}

function setupGridControls(
state: AppState,
dom: DomRefs,
redraw: () => void
): void {
dom.gutterRange.addEventListener("input", () => {
setGutter(state, dom);
recomputePanels(state);
redraw();
});

dom.gutterNum.addEventListener("input", () => {
const n = parseFloat(dom.gutterNum.value);
if (!Number.isNaN(n) && n >= 0) {
state.gutterPx = n;
recomputePanels(state);
redraw();
}
});

dom.strokeRange.addEventListener("input", () => {
setStroke(state, dom);
redraw();
});

dom.strokeNum.addEventListener("input", () => {
const n = parseFloat(dom.strokeNum.value);
if (!Number.isNaN(n) && n > 0) {
state.strokePx = n;
redraw();
}
});

dom.g22.addEventListener("click", () => {
generateGrid(state, 2, 2);
recomputePanels(state);
redraw();
});

dom.g33.addEventListener("click", () => {
generateGrid(state, 3, 3);
recomputePanels(state);
redraw();
});

dom.g23.addEventListener("click", () => {
generateGrid(state, 2, 3);
recomputePanels(state);
redraw();
});

dom.g32.addEventListener("click", () => {
generateGrid(state, 3, 2);
recomputePanels(state);
redraw();
});
}

function setupActions(
state: AppState,
dom: DomRefs,
redraw: () => void
): void {
dom.reset.addEventListener("click", () => {
resetAllPanels(state);
recomputePanels(state);
redraw();
});

dom.merge.addEventListener("click", () => {
mergeSelectedPanels(state);
recomputePanels(state);
redraw();
});

dom.exLine.addEventListener("click", () => {
const res = exportSvg("line" as ExportKind, state);
if (!res.ok) {
console.error(res.error);
}
});

dom.exFill.addEventListener("click", () => {
const res = exportSvg("fills" as ExportKind, state);
if (!res.ok) {
console.error(res.error);
}
});

dom.btnDelCut.addEventListener("click", () => {
if (
state.selectedCutIndex !== null &&
state.selectedCutIndex >= 0
) {
deleteCutAtIndex(state, state.selectedCutIndex);
recomputePanels(state);
redraw();
}
});
}

function initApp(): void {
const state = createInitialState();
const domResult: Result<DomRefs, string[]> = initDomRefs();

if (!isOk(domResult)) {
console.error("DOM init errors:", domResult.error);
return;
}

const dom = domResult.value;

populateSetupControls(state, dom);

const drawOnly = (): void => {
updateSplitOverlayPosition(state);
draw(state, dom);
};

const recomputeAndDraw = (): void => {
recomputePanels(state);
updateSplitOverlayPosition(state);
draw(state, dom);
};

const callbacks = { drawOnly, recomputeAndDraw };

createCanvasHandlers(state, dom, callbacks);

setupSizeControls(state, dom, recomputeAndDraw);
setupGuideControls(state, dom, recomputeAndDraw);
setupGridControls(state, dom, recomputeAndDraw);
setupActions(state, dom, recomputeAndDraw);

recomputePanels(state);
drawOnly();
}

window.addEventListener("DOMContentLoaded", () => {
initApp();
});