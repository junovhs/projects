import { clampPoint, distancePointToSegment, pointInPolygon } from "./geometry";
import { previewDimsPx } from "./layout";
import {
	deletePanelById,
	splitPanelHorizontal,
	splitPanelVertical,
} from "./panels";
import type { AppState, DomRefs } from "./types";

export interface CanvasCallbacks {
	drawOnly: () => void;
	recomputeAndDraw: () => void;
}

function hitThreshold(state: AppState): number {
	const dims = previewDimsPx(state);
	const scale = Math.max(dims.scale, 1e-3);
	return 15 / scale;
}

function canvasPos(
	canvas: HTMLCanvasElement,
	event: MouseEvent,
): { x: number; y: number } {
	const rect = canvas.getBoundingClientRect();
	return {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
	};
}

function handleHover(
	state: AppState,
	dom: DomRefs,
	callbacks: CanvasCallbacks,
	pos: { x: number; y: number },
): void {
	const dims = previewDimsPx(state);
	const clamped = clampPoint(pos, dims.cw, dims.ch);

	let index = -1;
	const threshold = hitThreshold(state);

	for (let i = 0; i < state.cuts.length; i += 1) {
		const cut = state.cuts[i];
		const d = distancePointToSegment(clamped, cut.start, cut.end);
		if (d < threshold) {
			index = i;
			break;
		}
	}

	state.hoveredCutIndex = index;
	dom.canvas.style.cursor = index >= 0 ? "move" : "crosshair";
	callbacks.drawOnly();
}

function handleDragMove(state: AppState, pos: { x: number; y: number }): void {
	const dims = previewDimsPx(state);
	const idx = state.cuts.findIndex((c) => c.id === state.currentCut?.id);
	if (idx < 0) return;

	const cut = state.cuts[idx];

	if (state.dragMode === "line" && state.dragStart) {
		const dx = pos.x - state.dragStart.x;
		const dy = pos.y - state.dragStart.y;

		cut.start = clampPoint(
			{ x: cut.start.x + dx, y: cut.start.y + dy },
			dims.cw,
			dims.ch,
		);
		cut.end = clampPoint(
			{ x: cut.end.x + dx, y: cut.end.y + dy },
			dims.cw,
			dims.ch,
		);
		state.dragStart = pos;
	} else if (state.dragMode === "start") {
		cut.start = pos;
	} else if (state.dragMode === "end") {
		cut.end = pos;
	}
}

function setupMousedown(state: AppState, dom: DomRefs): void {
	dom.canvas.addEventListener("mousedown", (e) => {
		const dims = previewDimsPx(state);
		const pos = clampPoint(canvasPos(dom.canvas, e), dims.cw, dims.ch);

		if (state.hoveredCutIndex >= 0) {
			const cut = state.cuts[state.hoveredCutIndex];
			const dStart = Math.hypot(pos.x - cut.start.x, pos.y - cut.start.y);
			const dEnd = Math.hypot(pos.x - cut.end.x, pos.y - cut.end.y);

			if (dStart < 10) {
				state.dragMode = "start";
				state.currentCut = cut;
			} else if (dEnd < 10) {
				state.dragMode = "end";
				state.currentCut = cut;
			} else {
				state.dragMode = "line";
				state.currentCut = cut;
				state.dragStart = pos;
			}
			return;
		}

		state.isDragging = true;
		state.dragStart = pos;
		state.currentCut = {
			id: "",
			type: "global",
			start: pos,
			end: pos,
		};
	});
}

function setupMousemove(
	state: AppState,
	dom: DomRefs,
	callbacks: CanvasCallbacks,
): void {
	dom.canvas.addEventListener("mousemove", (e) => {
		const dims = previewDimsPx(state);
		const pos = clampPoint(canvasPos(dom.canvas, e), dims.cw, dims.ch);

		if (!state.isDragging && !state.dragMode) {
			handleHover(state, dom, callbacks, pos);
			return;
		}

		if (state.dragMode && state.currentCut) {
			handleDragMove(state, pos);
			callbacks.recomputeAndDraw();
			return;
		}

		if (state.isDragging && state.currentCut) {
			state.currentCut.end = pos;
			callbacks.drawOnly();
		}
	});
}

function setupMouseup(state: AppState, callbacks: CanvasCallbacks): void {
	const canvas = document.getElementById("canvas") as HTMLCanvasElement;

	canvas.addEventListener("mouseup", () => {
		if (state.isDragging && state.currentCut) {
			const dx = state.currentCut.end.x - state.currentCut.start.x;
			const dy = state.currentCut.end.y - state.currentCut.start.y;

			if (Math.hypot(dx, dy) > 10) {
				state.currentCut.id = `c${state.idSeq}`;
				state.idSeq += 1;
				state.cuts.push(state.currentCut);
				callbacks.recomputeAndDraw();
			}
		}

		state.isDragging = false;
		state.dragMode = null;
		state.currentCut = null;
		state.dragStart = null;
		callbacks.drawOnly();
	});
}

function handlePanelClick(state: AppState, panelId: string): void {
	state.selectedPanelId = panelId;
	state.showSplitButtons = true;
	state.selectedCutIndex = null;
	state.showDeleteButton = false;

	if (!state.mergeSel.includes(panelId)) {
		const maxPanels = 8;
		if (state.mergeSel.length >= maxPanels) {
			state.mergeSel.shift();
		}
		state.mergeSel.push(panelId);
	}
}

function setupClick(
	state: AppState,
	dom: DomRefs,
	callbacks: CanvasCallbacks,
): void {
	dom.canvas.addEventListener("click", (e) => {
		const dims = previewDimsPx(state);
		const pos = clampPoint(canvasPos(dom.canvas, e), dims.cw, dims.ch);

		for (let i = 0; i < state.cuts.length; i += 1) {
			const cut = state.cuts[i];
			const d = distancePointToSegment(pos, cut.start, cut.end);
			if (d < hitThreshold(state)) {
				state.selectedCutIndex = i;
				state.showDeleteButton = true;
				state.delPos = {
					x: (cut.start.x + cut.end.x) / 2,
					y: (cut.start.y + cut.end.y) / 2,
				};
				state.selectedPanelId = null;
				state.showSplitButtons = false;
				callbacks.drawOnly();
				return;
			}
		}

		for (const panel of state.panels) {
			if (pointInPolygon(pos, panel.points)) {
				handlePanelClick(state, panel.id);
				callbacks.drawOnly();
				return;
			}
		}

		state.selectedPanelId = null;
		state.showSplitButtons = false;
		state.selectedCutIndex = null;
		state.showDeleteButton = false;
		callbacks.drawOnly();
	});
}

function setupSplitButtons(
	state: AppState,
	dom: DomRefs,
	callbacks: CanvasCallbacks,
): void {
	dom.btnSplitV.addEventListener("click", () => {
		if (!state.selectedPanelId) return;
		splitPanelVertical(state, state.selectedPanelId);
		callbacks.recomputeAndDraw();
	});

	dom.btnSplitH.addEventListener("click", () => {
		if (!state.selectedPanelId) return;
		splitPanelHorizontal(state, state.selectedPanelId);
		callbacks.recomputeAndDraw();
	});

	dom.btnDelPanel.addEventListener("click", () => {
		if (!state.selectedPanelId) return;
		deletePanelById(state, state.selectedPanelId);
		callbacks.drawOnly();
	});
}

export function createCanvasHandlers(
	state: AppState,
	dom: DomRefs,
	callbacks: CanvasCallbacks,
): void {
	setupMousedown(state, dom);
	setupMousemove(state, dom, callbacks);
	setupMouseup(state, callbacks);
	setupClick(state, dom, callbacks);
	setupSplitButtons(state, dom, callbacks);
}
