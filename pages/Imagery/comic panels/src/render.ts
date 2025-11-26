import {
  AppState,
  DomRefs,
  ExportSize
} from "./types";
import { computeBaseRects } from "./layout";
import { polygonCenter } from "./geometry";
import { exportReadout } from "./exporter";
import { Result, ok, err, isOk } from "./result";

function strokePolygon(
ctx: CanvasRenderingContext2D,
pts: { x: number; y: number }[],
color: string,
dash: number[],
width: number
): void {
ctx.save();
ctx.strokeStyle = color;
ctx.lineWidth = width;

if (dash.length > 0) {
ctx.setLineDash(dash);
} else {
ctx.setLineDash([]);
}

ctx.beginPath();
pts.forEach((p, idx) => {
if (idx === 0) {
ctx.moveTo(p.x, p.y);
} else {
ctx.lineTo(p.x, p.y);
}
});
ctx.closePath();
ctx.stroke();
ctx.restore();
}

function fillPolygon(
ctx: CanvasRenderingContext2D,
pts: { x: number; y: number }[]
): void {
ctx.beginPath();
pts.forEach((p, idx) => {
if (idx === 0) {
ctx.moveTo(p.x, p.y);
} else {
ctx.lineTo(p.x, p.y);
}
});
ctx.closePath();
ctx.fill();
}

function getContext2D(
canvas: HTMLCanvasElement
): Result<CanvasRenderingContext2D, string> {
const ctx = canvas.getContext("2d");
if (!ctx) {
return err("Failed to acquire 2D context");
}
return ok(ctx);
}

function cssVar(name: string): string {
const root = document.documentElement;
const style = getComputedStyle(root);
return style.getPropertyValue(name).trim();
}

function updateOverlays(
state: AppState,
dom: DomRefs
): void {
const splitVisible =
state.showSplitButtons && !!state.selectedPanelId;
dom.splitOverlay.style.display = splitVisible ? "flex" : "none";

if (splitVisible) {
dom.splitOverlay.style.left = `${state.splitPos.x - 75}px`;
dom.splitOverlay.style.top = `${state.splitPos.y - 20}px`;
}

const hasCut =
state.showDeleteButton &&
state.selectedCutIndex !== null &&
state.selectedCutIndex >= 0;

dom.deleteOverlay.style.display = hasCut ? "flex" : "none";

if (hasCut) {
dom.deleteOverlay.style.left = `${state.delPos.x}px`;
dom.deleteOverlay.style.top = `${state.delPos.y - 30}px`;
}
}

function updateReadouts(
state: AppState,
dom: DomRefs,
exportSize: ExportSize
): void {
const exp = exportSize;
dom.readout.textContent =
`Export: ${exp.pxW} x ${exp.pxH} px ` +
`(${exp.inW.toFixed(3)} x ${exp.inH.toFixed(3)} in @ ${state.dpi} DPI)`;

const cssW = Math.round(state.docWIn * 96);
const cssH = Math.round(state.docHIn * 96);
const orient = state.isLandscape ? "(Landscape)" : "(Portrait)";

dom.docInfo.textContent =
`Document: ${cssW} x ${cssH} CSS px ` +
`(${state.docWIn.toFixed(3)} x ${state.docHIn.toFixed(3)} in) ${orient}`;
}

export function draw(
state: AppState,
dom: DomRefs
): void {
const ctxRes = getContext2D(dom.canvas);
if (!isOk(ctxRes)) {
// Nothing else we can do here without a context.
return;
}

const ctx = ctxRes.value;
const base = computeBaseRects(state);

dom.canvas.width = base.cw;
dom.canvas.height = base.ch;

ctx.fillStyle = "#f8f9fa";
ctx.fillRect(0, 0, base.cw, base.ch);

const bleedColor = cssVar("--guide-bleed");
ctx.save();
ctx.strokeStyle = bleedColor;
ctx.lineWidth = 1;
ctx.setLineDash([3, 3]);
ctx.strokeRect(
base.bleed,
base.bleed,
base.cw - 2 * base.bleed,
base.ch - 2 * base.bleed
);
ctx.restore();

const liveColor = cssVar("--guide-live");
strokePolygon(ctx, base.liveRect, liveColor, [5, 3], 1);

const insetColor = cssVar("--guide-inset");
strokePolygon(ctx, base.insetRect, insetColor, [6, 4], 1);

ctx.strokeStyle = "black";
ctx.lineWidth = state.strokePx;
ctx.lineJoin = "miter";
ctx.lineCap = "square";

for (const panel of state.panels) {
const selected =
panel.id === state.selectedPanelId ||
state.mergeSel.includes(panel.id);

```
if (selected) {
  ctx.fillStyle = "rgba(59,130,246,0.12)";
  fillPolygon(ctx, panel.points);
}

strokePolygon(ctx, panel.points, "black", [], state.strokePx);
```

}

if (state.isDragging && state.currentCut) {
ctx.save();
ctx.strokeStyle = "#ffcc00";
ctx.lineWidth = 2;
ctx.setLineDash([5, 5]);
ctx.beginPath();
ctx.moveTo(
state.currentCut.start.x,
state.currentCut.start.y
);
ctx.lineTo(
state.currentCut.end.x,
state.currentCut.end.y
);
ctx.stroke();
ctx.restore();
}

if (
state.hoveredCutIndex >= 0 &&
state.hoveredCutIndex < state.cuts.length
) {
const cut = state.cuts[state.hoveredCutIndex];
const isPanel = cut.type === "panel";
const color = isPanel ? "#10b981" : "#0066ff";

```
ctx.save();
ctx.strokeStyle = color;
ctx.lineWidth = 3;
ctx.shadowBlur = 10;
ctx.shadowColor = color;
ctx.beginPath();
ctx.moveTo(cut.start.x, cut.start.y);
ctx.lineTo(cut.end.x, cut.end.y);
ctx.stroke();

ctx.fillStyle = color;
ctx.beginPath();
ctx.arc(cut.start.x, cut.start.y, 5, 0, Math.PI * 2);
ctx.fill();

ctx.beginPath();
ctx.arc(cut.end.x, cut.end.y, 5, 0, Math.PI * 2);
ctx.fill();

ctx.restore();
```

}

if (
state.selectedCutIndex !== null &&
state.selectedCutIndex >= 0 &&
state.selectedCutIndex < state.cuts.length
) {
const cut = state.cuts[state.selectedCutIndex];
ctx.save();
ctx.strokeStyle = "#ff6b6b";
ctx.lineWidth = 4;
ctx.shadowBlur = 15;
ctx.shadowColor = "#ff6b6b";
ctx.beginPath();
ctx.moveTo(cut.start.x, cut.start.y);
ctx.lineTo(cut.end.x, cut.end.y);
ctx.stroke();

```
ctx.fillStyle = "#ff6b6b";
ctx.beginPath();
ctx.arc(cut.start.x, cut.start.y, 6, 0, Math.PI * 2);
ctx.fill();

ctx.beginPath();
ctx.arc(cut.end.x, cut.end.y, 6, 0, Math.PI * 2);
ctx.fill();

ctx.restore();
```

}

updateOverlays(state, dom);

const exportSize: ExportSize = exportReadout(state);
updateReadouts(state, dom, exportSize);
}

export function updateSplitOverlayPosition(
state: AppState
): void {
if (!state.selectedPanelId) {
return;
}

const panel = state.panels.find(
(p) => p.id === state.selectedPanelId
);
if (!panel) {
return;
}

state.splitPos = polygonCenter(panel.points);
}