import type { Point } from './pose';

export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const length = (a: Point): number => Math.hypot(a.x, a.y);
export const unit = (a: Point): Point => ({ x: a.x / length(a), y: a.y / length(a) });
export const mean = (xs: readonly number[]): number => xs.reduce((sum, x) => sum + x, 0) / xs.length;
export const meanPoint = (ps: readonly Point[]): Point => ({ x: mean(ps.map((p) => p.x)), y: mean(ps.map((p) => p.y)) });
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function median(xs: readonly number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function angleDeg(a: Point, vertex: Point, c: Point): number {
  const u = sub(a, vertex);
  const v = sub(c, vertex);
  return toDegrees(Math.acos(clamp(dot(u, v) / (length(u) * length(v)), -1, 1)));
}

/** Angle between the a→b line and the plane perpendicular to `up` (0° = level). */
export function tiltDeg(a: Point, b: Point, up: Point): number {
  return toDegrees(Math.asin(clamp(Math.abs(dot(unit(sub(b, a)), up)), 0, 1)));
}

/** Signed distance of p from the a→b line along `up`, as a fraction of |ab|. */
export function signedOffset(p: Point, a: Point, b: Point, up: Point): number {
  const ab = sub(b, a);
  const direction = unit(ab);
  const ap = sub(p, a);
  const along = dot(ap, direction);
  const perpendicular = { x: ap.x - along * direction.x, y: ap.y - along * direction.y };
  return dot(perpendicular, up) / length(ab);
}
