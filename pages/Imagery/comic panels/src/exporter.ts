import { previewDimsPx } from "./layout";
import { err, ok, type Result } from "./result";
import type { AppState, ExportKind, ExportSize } from "./types";

export function exportReadout(state: AppState): ExportSize {
	const inW = state.isLandscape ? state.docHIn : state.docWIn;
	const inH = state.isLandscape ? state.docWIn : state.docHIn;
	const pxW = Math.round(inW * state.dpi);
	const pxH = Math.round(inH * state.dpi);

	return { inW, inH, pxW, pxH };
}

function buildPanelPath(
	points: { x: number; y: number }[],
	scaleX: number,
	scaleY: number,
): string {
	let d = "";

	for (let i = 0; i < points.length; i += 1) {
		const pt = points[i];
		const x = pt.x * scaleX;
		const y = pt.y * scaleY;

		if (i === 0) {
			d += `M ${x} ${y}`;
		} else {
			d += ` L ${x} ${y}`;
		}
	}

	return `${d} Z`;
}

export function exportSvg(
	kind: ExportKind,
	state: AppState,
): Result<void, Error> {
	try {
		const size = exportReadout(state);
		const dim = previewDimsPx(state);

		const scaleX = size.pxW / dim.cw;
		const scaleY = size.pxH / dim.ch;

		const svgNs = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(svgNs, "svg");

		svg.setAttribute("width", String(size.pxW));
		svg.setAttribute("height", String(size.pxH));
		svg.setAttribute("xmlns", svgNs);

		for (const panel of state.panels) {
			const path = document.createElementNS(svgNs, "path");
			const d = buildPanelPath(panel.points, scaleX, scaleY);

			path.setAttribute("d", d);

			if (kind === "fills") {
				path.setAttribute("fill", "white");
				const thin = Math.min(Math.max(state.strokePx * 0.51, 0.5), 1.5);
				path.setAttribute("stroke", "white");
				path.setAttribute("stroke-width", String(thin));
			} else {
				path.setAttribute("fill", "none");
				path.setAttribute("stroke", "black");
				path.setAttribute("stroke-width", String(state.strokePx));
			}

			path.setAttribute("stroke-linejoin", "miter");
			path.setAttribute("stroke-linecap", "square");
			svg.appendChild(path);
		}

		const xml = new XMLSerializer().serializeToString(svg);
		const blob = new Blob([xml], { type: "image/svg+xml" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `comic-panel-${kind}-${state.dpi}dpi.svg`;
		a.click();
		URL.revokeObjectURL(url);

		return ok(undefined);
	} catch (e) {
		const error = e instanceof Error ? e : new Error("Unknown export error");
		return err(error);
	}
}
