import { DomRefs, UnitKey, PresetKey } from "./types";
import { Result, ok, err, isOk } from "./result";
import {
  UNITS,
  PRESETS,
  DPI_OPTIONS,
  inchesToUnit,
  formatNumber
} from "./config";
import { AppState } from "./types";

function getRequiredElement<T extends HTMLElement>(
id: string
): Result<T, string> {
const el = document.getElementById(id);
if (!el) {
return err(`Missing element with id "${id}"`);
}
return ok(el as T);
}

export function initDomRefs(): Result<DomRefs, string[]> {
const ids = {
size: "size",
units: "units",
dpi: "dpi",
landscape: "landscape",
wInp: "w-inp",
hInp: "h-inp",
bleedRange: "bleed-range",
bleedNum: "bleed-num",
liveRange: "live-range",
liveNum: "live-num",
insetRange: "inset-range",
insetNum: "inset-num",
readout: "export-readout",
gutterRange: "gutter-range",
gutterNum: "gutter-num",
strokeRange: "stroke-range",
strokeNum: "stroke-num",
g22: "grid-22",
g33: "grid-33",
g23: "grid-23",
g32: "grid-32",
reset: "reset",
merge: "merge-selected",
exLine: "export-line",
exFill: "export-fills",
canvas: "canvas",
splitOverlay: "split-overlay",
deleteOverlay: "delete-overlay",
btnSplitV: "btn-split-v",
btnSplitH: "btn-split-h",
btnDelPanel: "btn-delete-panel",
btnDelCut: "btn-delete-cut",
docInfo: "doc-info"
} as const;

const errors: string[] = [];
const refs = {} as DomRefs;

function assign<K extends keyof typeof ids>(
key: K,
type: string
): void {
const res = getRequiredElement<HTMLElement>(ids[key]);
if (!isOk(res)) {
errors.push(res.error);
return;
}

```
const el = res.value;

switch (type) {
  case "select":
  case "input":
  case "button":
  case "canvas":
  case "div":
  case "generic":
    (refs as any)[key] = el;
    break;
  default:
    (refs as any)[key] = el;
    break;
}
```

}

assign("size", "select");
assign("units", "select");
assign("dpi", "select");
assign("landscape", "input");
assign("wInp", "input");
assign("hInp", "input");
assign("bleedRange", "input");
assign("bleedNum", "input");
assign("liveRange", "input");
assign("liveNum", "input");
assign("insetRange", "input");
assign("insetNum", "input");
assign("readout", "div");
assign("gutterRange", "input");
assign("gutterNum", "input");
assign("strokeRange", "input");
assign("strokeNum", "input");
assign("g22", "button");
assign("g33", "button");
assign("g23", "button");
assign("g32", "button");
assign("reset", "button");
assign("merge", "button");
assign("exLine", "button");
assign("exFill", "button");
assign("canvas", "canvas");
assign("splitOverlay", "div");
assign("deleteOverlay", "div");
assign("btnSplitV", "button");
assign("btnSplitH", "button");
assign("btnDelPanel", "button");
assign("btnDelCut", "button");
assign("docInfo", "div");

if (errors.length > 0) {
return err(errors);
}

return ok(refs);
}

export function populateSetupControls(
state: AppState,
dom: DomRefs
): void {
Object.entries(PRESETS).forEach(([key, preset]) => {
const option = document.createElement("option");
option.value = key as PresetKey;
option.textContent = preset.name;
dom.size.appendChild(option);
});

Object.entries(UNITS).forEach(([key, def]) => {
const option = document.createElement("option");
option.value = key as UnitKey;
option.textContent = def.name;
dom.units.appendChild(option);
});

DPI_OPTIONS.forEach((dpi) => {
const option = document.createElement("option");
option.value = String(dpi);
option.textContent = `${dpi} DPI`;
dom.dpi.appendChild(option);
});

dom.size.value = state.documentSize;
dom.units.value = state.units;
dom.dpi.value = String(state.dpi);
dom.landscape.checked = state.isLandscape;

dom.wInp.value = formatNumber(
inchesToUnit(state.docWIn, state.units),
3
);
dom.hInp.value = formatNumber(
inchesToUnit(state.docHIn, state.units),
3
);
}