import { AppState, Point, PresetKey, UnitKey } from "./types"; import { PRESETS } from "./config";

function zeroPoint(): Point {
return { x: 0, y: 0 };
}

export function createInitialState(): AppState {
const presetKey: PresetKey = "letter";
const preset = PRESETS[presetKey];

return {
panels: [],
cuts: [],
currentCut: null,
isDragging: false,
dragStart: null,
dragMode: null,
hoveredCutIndex: -1,
selectedPanelId: null,
selectedCutIndex: null,
showSplitButtons: false,
showDeleteButton: false,
splitPos: zeroPoint(),
delPos: zeroPoint(),
mergeSel: [],

documentSize: presetKey,
isLandscape: false,
units: "in" as UnitKey,
dpi: 300,

docWIn: preset.wIn,
docHIn: preset.hIn,

bleedIn: 0.125,
liveIn: 0.25,
insetIn: 0.35,

gutterPx: 20,
strokePx: 3,

idSeq: 1,
rafId: 0


};
}

export function nextId(state: AppState, prefix: string): string {
const id = prefix + String(state.idSeq);
state.idSeq += 1;
return id;
}