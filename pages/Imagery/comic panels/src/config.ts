import type { PresetDef, PresetKey, UnitDef, UnitKey } from "./types";

export const UNITS: Record<UnitKey, UnitDef> = {
	px: {
		name: "Pixels",
		factor: 1,
		toIn: (v: number) => v / 96,
		fromIn: (v: number) => v * 96,
	},
	in: {
		name: "Inches",
		factor: 96,
		toIn: (v: number) => v,
		fromIn: (v: number) => v,
	},
	mm: {
		name: "Millimeters",
		factor: 96 / 25.4,
		toIn: (v: number) => v / 25.4,
		fromIn: (v: number) => v * 25.4,
	},
	cm: {
		name: "Centimeters",
		factor: 96 / 2.54,
		toIn: (v: number) => v / 2.54,
		fromIn: (v: number) => v * 2.54,
	},
};

export const PRESETS: Record<PresetKey, PresetDef> = {
	letter: { wIn: 8.5, hIn: 11, name: 'Letter (8.5" x 11")' },
	a4: { wIn: 8.27, hIn: 11.69, name: "A4 (210mm x 297mm)" },
	"comic-standard": {
		wIn: 6.875,
		hIn: 10.4375,
		name: 'Comic Standard (6.875" x 10.4375")',
	},
	manga: { wIn: 7.165, hIn: 10.118, name: "Manga (182mm x 257mm)" },
	tabloid: { wIn: 11, hIn: 17, name: 'Tabloid (11" x 17")' },
	a3: { wIn: 11.69, hIn: 16.54, name: "A3 (297mm x 420mm)" },
	square: {
		wIn: 8.333,
		hIn: 8.333,
		name: "Square (800 x 800 at 96DPI approx.)",
	},
	custom: { wIn: 6.25, hIn: 5.208, name: "Custom" },
};

export const DPI_OPTIONS: number[] = [72, 150, 300, 600];

export const MAX_CANVAS_W = 800;
export const MAX_CANVAS_H = 600;

export const EPS = 1e-6;

export function inchesToUnit(valueIn: number, unit: UnitKey): number {
	return UNITS[unit].fromIn(valueIn);
}

export function unitToInches(value: number, unit: UnitKey): number {
	return UNITS[unit].toIn(value);
}

export function formatNumber(value: number, digits = 2): string {
	const factor = 10 ** digits;
	const rounded = Math.round(value * factor) / factor;
	return rounded.toString();
}
