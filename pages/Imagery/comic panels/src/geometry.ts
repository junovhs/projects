import type { Point } from "./types";

export function clamp(value: number, min: number, max: number): number {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

export function clampPoint(pt: Point, width: number, height: number): Point {
	return {
		x: clamp(pt.x, 0, width),
		y: clamp(pt.y, 0, height),
	};
}

export function distancePointToSegment(p: Point, a: Point, b: Point): number {
	const ax = p.x - a.x;
	const ay = p.y - a.y;
	const bx = b.x - a.x;
	const by = b.y - a.y;
	const len = bx * bx + by * by;

	if (len === 0) return Math.hypot(ax, ay);

	const dot = ax * bx + ay * by;
	const t = clamp(dot / len, 0, 1);
	const x = a.x + bx * t;
	const y = a.y + by * t;

	return Math.hypot(p.x - x, p.y - y);
}

export function pointInPolygon(pt: Point, poly: Point[]): boolean {
	let inside = false;
	const n = poly.length;

	for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
		const a = poly[i];
		const b = poly[j];
		const crossesY = a.y > pt.y !== b.y > pt.y;

		if (crossesY) {
			const x = ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y + 1e-12) + a.x;
			if (pt.x < x) {
				inside = !inside;
			}
		}
	}

	return inside;
}

export function polygonCenter(poly: Point[]): Point {
	const sum = poly.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
		x: 0,
		y: 0,
	});
	const n = poly.length || 1;
	return { x: sum.x / n, y: sum.y / n };
}

export function dedupePolygon(poly: Point[]): Point[] {
	if (poly.length <= 3) return poly.slice();

	const out: Point[] = [];
	const minLen = 1e-4;

	for (let i = 0; i < poly.length; i += 1) {
		const p = poly[i];
		const next = poly[(i + 1) % poly.length];
		const d = Math.hypot(next.x - p.x, next.y - p.y);
		if (d > minLen) out.push(p);
	}

	return out;
}

export function normalizeVector(dx: number, dy: number): Point {
	const len = Math.hypot(dx, dy);
	if (len < 1e-12) return { x: 0, y: 0 };
	return { x: dx / len, y: dy / len };
}

function signedDistanceToLine(
	p: Point,
	origin: Point,
	nx: number,
	ny: number,
): number {
	const px = p.x - origin.x;
	const py = p.y - origin.y;
	return px * nx + py * ny;
}

function intersectSegmentWithOffset(
	a: Point,
	b: Point,
	origin: Point,
	nx: number,
	ny: number,
	side: number,
): Point {
	const da = signedDistanceToLine(a, origin, nx, ny) - side;
	const db = signedDistanceToLine(b, origin, nx, ny) - side;
	const denom = da - db || 1e-12;
	const t = da / denom;

	return {
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t,
	};
}

interface ClipParams {
	poly: Point[];
	origin: Point;
	nx: number;
	ny: number;
	side: number;
	keepOut: boolean;
}

function clipHalfPlane(params: ClipParams): Point[] {
	const { poly, origin, nx, ny, side, keepOut } = params;
	const out: Point[] = [];
	const n = poly.length;

	for (let i = 0; i < n; i += 1) {
		const a = poly[i];
		const b = poly[(i + 1) % n];

		const da = signedDistanceToLine(a, origin, nx, ny) - side;
		const db = signedDistanceToLine(b, origin, nx, ny) - side;

		const insideA = keepOut ? da <= 0 : da >= 0;
		const insideB = keepOut ? db <= 0 : db >= 0;

		if (insideA && insideB) {
			out.push(b);
		} else if (insideA && !insideB) {
			out.push(intersectSegmentWithOffset(a, b, origin, nx, ny, side));
		} else if (!insideA && insideB) {
			out.push(intersectSegmentWithOffset(a, b, origin, nx, ny, side));
			out.push(b);
		}
	}

	return dedupePolygon(out);
}

export function splitPolygonByStrip(
	poly: Point[],
	start: Point,
	end: Point,
	gutter: number,
): Point[][] {
	const dx = end.x - start.x;
	const dy = end.y - start.y;

	const t = normalizeVector(dx, dy);
	const nx = -t.y;
	const ny = t.x;
	const offset = gutter / 2;

	const high = clipHalfPlane({
		poly,
		origin: start,
		nx,
		ny,
		side: +offset,
		keepOut: false,
	});
	const low = clipHalfPlane({
		poly,
		origin: start,
		nx,
		ny,
		side: -offset,
		keepOut: true,
	});

	const res: Point[][] = [];
	if (high.length >= 3) res.push(high);
	if (low.length >= 3) res.push(low);

	if (res.length === 0) return [poly.slice()];
	return res;
}

export interface Bounds {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export function polygonBounds(poly: Point[]): Bounds {
	let x1 = Infinity;
	let y1 = Infinity;
	let x2 = -Infinity;
	let y2 = -Infinity;

	for (const p of poly) {
		if (p.x < x1) x1 = p.x;
		if (p.x > x2) x2 = p.x;
		if (p.y < y1) y1 = p.y;
		if (p.y > y2) y2 = p.y;
	}

	return { x1, y1, x2, y2 };
}
