import { MAX_CANVAS_H, MAX_CANVAS_W } from "./config";
import type { AppState, BaseRects, Point } from "./types";

export function docPixelDims(state: AppState): { wPx: number; hPx: number } {
	const wPx = Math.round(state.docWIn * state.dpi);
	const hPx = Math.round(state.docHIn * state.dpi);
	return { wPx, hPx };
}

export function previewDimsPx(state: AppState): {
	cw: number;
	ch: number;
	scale: number;
} {
	const wCss = state.docWIn * 96;
	const hCss = state.docHIn * 96;

	const width = state.isLandscape ? hCss : wCss;
	const height = state.isLandscape ? wCss : hCss;

	const sW = MAX_CANVAS_W / width;
	const sH = MAX_CANVAS_H / height;
	const scale = Math.min(sW, sH, 1);

	return {
		cw: width * scale,
		ch: height * scale,
		scale,
	};
}

function rectFrom(x1: number, y1: number, x2: number, y2: number): Point[] {
	return [
		{ x: x1, y: y1 },
		{ x: x2, y: y1 },
		{ x: x2, y: y2 },
		{ x: x1, y: y2 },
	];
}

export function computeBaseRects(state: AppState): BaseRects {
	const dim = previewDimsPx(state);
	const bleed = state.bleedIn * 96 * dim.scale;
	const live = state.liveIn * 96 * dim.scale;
	const inset = state.insetIn * 96 * dim.scale;

	const trimRect = rectFrom(0, 0, dim.cw, dim.ch);

	const liveRect = rectFrom(live, live, dim.cw - live, dim.ch - live);

	const insetRect = rectFrom(
		live + inset,
		live + inset,
		dim.cw - live - inset,
		dim.ch - live - inset,
	);

	return {
		cw: dim.cw,
		ch: dim.ch,
		scale: dim.scale,
		bleed,
		liveRect,
		insetRect,
		trimRect,
	};
}
