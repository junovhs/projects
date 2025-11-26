import { AppState, Panel, Cut, BaseRects, Point } from "./types"; import { splitPolygonByStrip, polygonBounds } from "./geometry"; import { computeBaseRects } from "./layout"; import { nextId } from "./state";

interface Adjacency {
[id: string]: Set<string>;
}

export function recomputePanels(state: AppState): void {
const base: BaseRects = computeBaseRects(state);
const panels: Panel[] = [{ id: "p0", points: base.insetRect }];

let acc = panels;

for (const cut of state.cuts) {
const next: Panel[] = [];

for (const panel of acc) {
  const appliesToPanel =
    cut.type === "global" || cut.panelId === panel.id;

  if (!appliesToPanel) {
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


}

state.panels = acc;
}

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

function overlapLength(
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

if (Math.abs(cross) > 1e-3) {
return 0;
}

const useX = Math.abs(v1x) >= Math.abs(v1y);
const a1 = useX ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y);
const a2 = useX ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y);
const b1 = useX ? Math.min(q1.x, q2.x) : Math.min(q1.y, q2.y);
const b2 = useX ? Math.max(q1.x, q2.x) : Math.max(q1.y, q2.y);

const lo = Math.max(a1, b1);
const hi = Math.min(a2, b2);
const len = hi - lo;

return len > 0 ? len : 0;
}

function edgeShared(a: Panel, b: Panel): boolean {
const threshold = 2;
const ea = segments(a);
const eb = segments(b);

for (const segA of ea) {
for (const segB of eb) {
const len = overlapLength(
segA[0],
segA[1],
segB[0],
segB[1]
);
if (len > threshold) {
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
const a = panels[i];
const b = panels[j];
if (edgeShared(a, b)) {
adj[a.id].add(b.id);
adj[b.id].add(a.id);
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
const current = queue.shift() as string;

if (target.has(current)) {
  result.push(current);
}

const neighbours = adj[current] || new Set<string>();
for (const n of neighbours) {
  if (!seen.has(n) && target.has(n)) {
    seen.add(n);
    queue.push(n);
  }
}


}

return result;
}

function boundsOverlap(
cut: Cut,
panel: Panel,
gutter: number
): boolean {
const b = polygonBounds(panel.points);

const minX = Math.min(cut.start.x, cut.end.x) - gutter;
const maxX = Math.max(cut.start.x, cut.end.x) + gutter;
const minY = Math.min(cut.start.y, cut.end.y) - gutter;
const maxY = Math.max(cut.start.y, cut.end.y) + gutter;

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
const hitA = boundsOverlap(cut, a, gutter);
const hitB = boundsOverlap(cut, b, gutter);
return hitA && hitB;
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
start: {
x: cut.start.x,
y: cut.start.y
},
end: {
x: cut.end.x,
y: cut.end.y
}
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

  if (!edgeShared(a, b)) {
    continue;
  }

  const cutsCopy = state.cuts.slice();
  for (const cut of cutsCopy) {
    const separates = cutSeparatesPanels(
      cut,
      a,
      b,
      state.gutterPx
    );
    if (!separates) {
      continue;
    }

    if (cut.type === "panel") {
      if (cut.panelId === a.id || cut.panelId === b.id) {
        state.cuts = state.cuts.filter(
          (c) => c !== cut
        );
      }
    } else {
      scopeGlobalCut(state, cut);
    }
  }
}


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

const minX = Math.min.apply(null, xs);
const maxX = Math.max.apply(null, xs);
const minY = Math.min.apply(null, ys);
const maxY = Math.max.apply(null, ys);
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

const minX = Math.min.apply(null, xs);
const maxX = Math.max.apply(null, xs);
const minY = Math.min.apply(null, ys);
const maxY = Math.max.apply(null, ys);
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
const base: BaseRects = computeBaseRects(state);
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