// Types shared across modules.
// Source adapted from original inline script in index.html :contentReference[oaicite:0]{index=0}

export type UnitKey = "px" | "in" | "mm" | "cm";

export interface UnitDef {
name: string;
factor: number;
toIn: (value: number) => number;
fromIn: (value: number) => number;
}

export type PresetKey =
| "letter"
| "a4"
| "comic-standard"
| "manga"
| "tabloid"
| "a3"
| "square"
| "custom";

export interface PresetDef {
wIn: number;
hIn: number;
name: string;
}

export interface Point {
x: number;
y: number;
}

export type CutType = "global" | "panel";

export interface Cut {
id: string;
type: CutType;
panelId?: string;
start: Point;
end: Point;
}

export interface Panel {
id: string;
points: Point[];
}

export type DragMode = "start" | "end" | "line" | null;

export interface BaseRects {
cw: number;
ch: number;
scale: number;
bleed: number;
liveRect: Point[];
insetRect: Point[];
trimRect: Point[];
}

export interface ExportSize {
inW: number;
inH: number;
pxW: number;
pxH: number;
}

export type ExportKind = "line" | "fills";

export interface AppState {
panels: Panel[];
cuts: Cut[];
currentCut: Cut | null;
isDragging: boolean;
dragStart: Point | null;
dragMode: DragMode;
hoveredCutIndex: number;
selectedPanelId: string | null;
selectedCutIndex: number | null;
showSplitButtons: boolean;
showDeleteButton: boolean;
splitPos: Point;
delPos: Point;
mergeSel: string[];

documentSize: PresetKey;
isLandscape: boolean;
units: UnitKey;
dpi: number;

docWIn: number;
docHIn: number;

bleedIn: number;
liveIn: number;
insetIn: number;

gutterPx: number;
strokePx: number;

idSeq: number;
rafId: number;
}

export interface DomRefs {
size: HTMLSelectElement;
units: HTMLSelectElement;
dpi: HTMLSelectElement;
landscape: HTMLInputElement;
wInp: HTMLInputElement;
hInp: HTMLInputElement;

bleedRange: HTMLInputElement;
bleedNum: HTMLInputElement;
liveRange: HTMLInputElement;
liveNum: HTMLInputElement;
insetRange: HTMLInputElement;
insetNum: HTMLInputElement;

readout: HTMLElement;

gutterRange: HTMLInputElement;
gutterNum: HTMLInputElement;
strokeRange: HTMLInputElement;
strokeNum: HTMLInputElement;

g22: HTMLButtonElement;
g33: HTMLButtonElement;
g23: HTMLButtonElement;
g32: HTMLButtonElement;

reset: HTMLButtonElement;
merge: HTMLButtonElement;
exLine: HTMLButtonElement;
exFill: HTMLButtonElement;

canvas: HTMLCanvasElement;
splitOverlay: HTMLDivElement;
deleteOverlay: HTMLDivElement;
btnSplitV: HTMLButtonElement;
btnSplitH: HTMLButtonElement;
btnDelPanel: HTMLButtonElement;
btnDelCut: HTMLButtonElement;

docInfo: HTMLElement;
}