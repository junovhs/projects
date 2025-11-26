import {
  AppState,
  Panel,
  Cut,
  BaseRects
} from "./types";
import {
  splitPolygonByStrip,
  polygonBounds
} from "./geometry";
import { computeBaseRects } from "./layout";
import { nextId } from "./state";

interface Adjacency {
[id: string]: Set<string>;
}

export function recomputePanels(state: AppState): void {
const base: BaseRects = computeBaseRects(state);
const panels: Panel[] = [{ id: "p0", points: base.insetRect }];

let acc = panels;

for (const cut of state.cuts) {
const next: Panel[] = [];

```
for (const panel of acc) {
  const shouldApply =
    cut.type === "global" || cut.panelId === panel.id;

  if (!shouldApply) {
    next.push(panel);
    continue;
  }

  const parts = splitPolygonByStrip(
    panel.points,
    cut.start,
    cut.end,
    state.gutterPx
  );

  if (parts.length === 1) {
    next.push(panel);
    continue;
  }

  for (const pts of parts) {
    const id = nextId(state, "p");
    next.push({ id, points: pts });
  }
}

acc = next;
```

}

state.panels = acc;
}

function edgeShared(a: Panel, b: Panel): boolean {
const threshold = 2;

function segments(poly: Panel): Array<[Point, Point]> {
const pts = poly.points;
const n = pts.length;
const segs: Array<[Point, Point]> = [];
for (let i = 0; i < n; i += 1) {
const p = pts[i];
const q = pts[(i + 1) % n];
segs.push([p, q]);
}
return segs;
}

function overlapLen(
p1: Point,
p2: Point,
q1: Point,
q2: Point
): number {
const v1x = p2.x - p1.x;
const v1y = p2.y - p1.y;
const v2x = q2.x - q1.x;
const v2y = q2.y - q1.y;
const cross = v1x * v2y - v1y * v2x;

```
if (Math.abs(cross) > 1e-3) {
  return 0;
}

const axis = Math.abs(v1x) >= Math.abs(v1y) ? "x" : "y";

const a1 = Math.min(p1[axis], p2[axis]);
const a2 = Math.max(p1[axis], p2[axis]);
const b1 = Math.min(q1[axis], q2[axis]);
const b2 = Math.max(q1[axis], q2[axis]);

const lo = Math.max(a1, b1);
const hi = Math.min(a2, b2);
const len = hi - lo;

return len > 0 ? len : 0;
```

}

const ea = segments(a);
const eb = segments(b);

for (const [p1, p2] of ea) {
for (const [q1, q2] of eb) {
if (overlapLen(p1, p2, q1, q2) > threshold) {
return true;
}
}
}

return false;
}

function buildAdjacency(panels: Panel[]): Adjacency {
const adj: Adjacency = {};

for (const p of panels) {
adj[p.id] = new Set<string>();
}

const n = panels.length;
for (let i = 0; i < n; i += 1) {
for (let j = i + 1; j < n; j += 1) {
if (edgeShared(panels[i], panels[j])) {
adj[panels[i].id].add(panels[j].id);
adj[panels[j].id].add(panels[i].id);
}
}
}

return adj;
}

function connectedSubset(
ids: string[],
adj: Adjacency
): string[] {
if (!ids.length) {
return [];
}

const target = new Set(ids);
const result: string[] = [];
const seen = new Set<string>();
const queue: string[] = [];

const first = ids[0];
queue.push(first);
seen.add(first);

while (queue.length > 0) {
const u = queue.shift() as string;
if (target.has(u)) {
result.push(u);
}

```
const neighbours = adj[u] || new Set<string>();
for (const v of neighbours) {
  if (!seen.has(v) && target.has(v)) {
    seen.add(v);
    queue.push(v);
  }
}
```

}

return result;
}

function boundsOverlap(
cut: Cut,
panel: Panel,
gutter: number
): boolean {
const b = polygonBounds(panel.points);

const minX =
Math.min(cut.start.x, cut.end.x) - gutter;
const maxX =
Math.max(cut.start.x, cut.end.x) + gutter;
const minY =
Math.min(cut.start.y, cut.end.y) - gutter;
const maxY =
Math.max(cut.start.y, cut.end.y) + gutter;

const noOverlap =
b.x1 > maxX ||
b.x2 < minX ||
b.y1 > maxY ||
b.y2 < minY;

return !noOverlap;
}

function cutSeparatesPanels(
cut: Cut,
a: Panel,
b: Panel,
gutter: number
): boolean {
return (
boundsOverlap(cut, a, gutter) &&
boundsOverlap(cut, b, gutter)
);
}

function scopeGlobalCut(
state: AppState,
cut: Cut
): void {
const affected: string[] = [];

for (const p of state.panels) {
if (boundsOverlap(cut, p, state.gutterPx)) {
affected.push(p.id);
}
}

state.cuts = state.cuts.filter((c) => c.id !== cut.id);

for (const pid of affected) {
const id = nextId(state, "c");
state.cuts.push({
id,
type: "panel",
panelId: pid,
start: { ...cut.start },
end: { ...cut.end }
});
}
}

export function mergeSelectedPanels(state: AppState): void {
if (state.mergeSel.length < 2) {
return;
}

const adj = buildAdjacency(state.panels);
const connectedIds = connectedSubset(state.mergeSel, adj);
const selectedSet = new Set(connectedIds);
const selectedPanels = state.panels.filter((p) =>
selectedSet.has(p.id)
);

for (let i = 0; i < selectedPanels.length; i += 1) {
for (let j = i + 1; j < selectedPanels.length; j += 1) {
const a = selectedPanels[i];
const b = selectedPanels[j];

```
  if (!edgeShared(a, b)) {
    continue;
  }

  for (const cut of [...state.cuts]) {
    if (!cutSeparatesPanels(cut, a, b, state.gutterPx)) {
      continue;
    }

    if (cut.type === "panel") {
      if (cut.panelId === a.id || cut.panelId === b.id) {
        state.cuts = state.cuts.filter((c) => c !== cut);
      }
    } else {
      scopeGlobalCut(state, cut);

      state.cuts = state.cuts.filter((c) => {
        if (c.type !== "panel") {
          return true;
        }
        const matches =
          c.panelId === a.id || c.panelId === b.id;
        const separates = cutSeparatesPanels(
          c,
          a,
          b,
          state.gutterPx
        );
        return !(matches && separates);
      });
    }
  }
}
```

}

state.mergeSel = [];
state.selectedPanelId = null;
state.showSplitButtons = false;
}

export function splitPanelVertical(
state: AppState,
panelId: string
): void {
const panel = state.panels.find((p) => p.id === panelId);
if (!panel) {
return;
}

const xs = panel.points.map((p) => p.x);
const ys = panel.points.map((p) => p.y);

const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);
const cx = (minX + maxX) / 2;

const id = nextId(state, "c");
state.cuts.push({
id,
type: "panel",
panelId,
start: { x: cx, y: minY - 10 },
end: { x: cx, y: maxY + 10 }
});

state.selectedPanelId = null;
state.showSplitButtons = false;
}

export function splitPanelHorizontal(
state: AppState,
panelId: string
): void {
const panel = state.panels.find((p) => p.id === panelId);
if (!panel) {
return;
}

const xs = panel.points.map((p) => p.x);
const ys = panel.points.map((p) => p.y);

const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);
const cy = (minY + maxY) / 2;

const id = nextId(state, "c");
state.cuts.push({
id,
type: "panel",
panelId,
start: { x: minX - 10, y: cy },
end: { x: maxX + 10, y: cy }
});

state.selectedPanelId = null;
state.showSplitButtons = false;
}

export function deleteCutAtIndex(
state: AppState,
index: number
): void {
state.cuts = state.cuts.filter((_, i) => i !== index);
state.selectedCutIndex = null;
state.showDeleteButton = false;
}

export function deletePanelById(
state: AppState,
panelId: string
): void {
state.panels = state.panels.filter(
(p) => p.id !== panelId
);
state.selectedPanelId = null;
state.showSplitButtons = false;
}

export function resetAllPanels(state: AppState): void {
state.cuts = [];
state.selectedPanelId = null;
state.selectedCutIndex = null;
state.showSplitButtons = false;
state.showDeleteButton = false;
state.mergeSel = [];
}

export function generateGrid(
state: AppState,
rows: number,
cols: number
): void {
const base = computeBaseRects(state);
const live = state.liveIn * 96 * base.scale;
const inset = state.insetIn * 96 * base.scale;

const x1 = live + inset;
const y1 = live + inset;
const x2 = base.cw - live - inset;
const y2 = base.ch - live - inset;

const width = x2 - x1;
const height = y2 - y1;
const cuts: Cut[] = [];

for (let i = 1; i < cols; i += 1) {
const x = x1 + (width / cols) * i;
cuts.push({
id: nextId(state, "c"),
type: "global",
start: { x, y: y1 },
end: { x, y: y2 }
});
}

for (let i = 1; i < rows; i += 1) {
const y = y1 + (height / rows) * i;
cuts.push({
id: nextId(state, "c"),
type: "global",
start: { x: x1, y },
end: { x: x2, y }
});
}

state.cuts = state.cuts.concat(cuts);
}