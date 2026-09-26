import type { Frame, Landmark, Point } from '../src/core/pose';

/** A side-on push-up posture; the camera sees the right side. */
export interface Posture {
  /** Shoulder height above the wrist, 1 = top of the setup hold. */
  readonly height?: number;
  readonly elbowDeg?: number;
  /** Hip distance from the shoulder→ankle line as a fraction of its length, + = up. */
  readonly hipLift?: number;
  readonly kneeDeg?: number;
  readonly standing?: boolean;
  readonly visibility?: number;
}

/** Faults (hipLift, kneeDeg) peak at the bottom of the rep. */
export interface RepShape {
  readonly bottom?: number;
  readonly top?: number;
  readonly topElbowDeg?: number;
  readonly bottomElbowDeg?: number;
  readonly hipLift?: number;
  readonly kneeDeg?: number;
  readonly durationMs?: number;
}

const WRIST: Point = { x: 0.7, y: 0.8 };
const ANKLE: Point = { x: 0.1, y: 0.78 };
const ARM_HEIGHT = 0.3;
const FRAME_MS = 1000 / 30;
const RIGHT = [12, 14, 16, 24, 26, 28];
const LEFT = [11, 13, 15, 23, 25, 27];

const add = (a: Point, b: Point, k = 1): Point => ({ x: a.x + k * b.x, y: a.y + k * b.y });
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Unit normal of a→b on the side where `pick` is positive. */
function normal(a: Point, b: Point, pick: (n: Point) => number): Point {
  const d = distance(a, b);
  const n = { x: -(b.y - a.y) / d, y: (b.x - a.x) / d };
  return pick(n) > 0 ? n : { x: -n.x, y: -n.y };
}

/** A joint between a and b such that the angle a-joint-b equals angleDeg. */
function bend(a: Point, b: Point, angleDeg: number, towards: Point): Point {
  const offset = distance(a, b) / 2 / Math.tan((angleDeg * Math.PI) / 360);
  return add(mid(a, b), towards, offset);
}

function joints(p: Required<Posture>): Point[] {
  if (p.standing) return [{ x: 0.5, y: 0.3 }, { x: 0.5, y: 0.42 }, { x: 0.5, y: 0.55 }, { x: 0.5, y: 0.55 }, { x: 0.5, y: 0.72 }, { x: 0.5, y: 0.9 }];
  const shoulder = { x: WRIST.x, y: WRIST.y - ARM_HEIGHT * p.height };
  const elbow = bend(shoulder, WRIST, p.elbowDeg, normal(shoulder, WRIST, (n) => -n.x));
  const up = normal(shoulder, ANKLE, (n) => -n.y);
  const hip = add(mid(shoulder, ANKLE), up, p.hipLift * distance(shoulder, ANKLE));
  const knee = bend(hip, ANKLE, p.kneeDeg, normal(hip, ANKLE, (n) => n.y));
  return [shoulder, elbow, WRIST, hip, knee, ANKLE];
}

export function frameAt(tMs: number, posture: Posture = {}): Frame {
  const p = { height: 1, elbowDeg: 172, hipLift: 0, kneeDeg: 178, standing: false, visibility: 0.99, ...posture };
  const points = joints(p);
  const pose: Landmark[] = Array.from({ length: 33 }, () => ({ ...points[0], visibility: 0.9 }));
  RIGHT.forEach((index, i) => (pose[index] = { ...points[i], visibility: p.visibility }));
  LEFT.forEach((index, i) => (pose[index] = { ...points[i], visibility: Math.min(0.4, p.visibility) }));
  return { tMs: Math.round(tMs), aspect: 1, pose };
}

export function holdFrames(startMs: number, durationMs: number, posture: Posture = {}): Frame[] {
  const count = Math.round(durationMs / FRAME_MS);
  return Array.from({ length: count }, (_, i) => frameAt(startMs + i * FRAME_MS, posture));
}

export function hiddenFrames(startMs: number, durationMs: number): Frame[] {
  return holdFrames(startMs, durationMs).map((frame) => ({ ...frame, pose: null }));
}

export function repFrames(startMs: number, shape: RepShape = {}): Frame[] {
  const s = { bottom: 0.45, top: 0.95, topElbowDeg: 170, bottomElbowDeg: 80, hipLift: 0, kneeDeg: 178, durationMs: 1000, ...shape };
  const count = Math.round(s.durationMs / FRAME_MS);
  return Array.from({ length: count }, (_, i) => {
    const phase = (1 - Math.cos((2 * Math.PI * i) / count)) / 2;
    return frameAt(startMs + i * FRAME_MS, {
      height: s.top - (s.top - s.bottom) * phase,
      elbowDeg: s.topElbowDeg - (s.topElbowDeg - s.bottomElbowDeg) * phase,
      hipLift: s.hipLift * phase,
      kneeDeg: 178 - (178 - s.kneeDeg) * phase,
    });
  });
}

/** Frames played back to back, each list shifted to start where the previous ended. */
export function sequence(...parts: ((startMs: number) => Frame[])[]): Frame[] {
  const frames: Frame[] = [];
  for (const part of parts) frames.push(...part(frames.length ? frames.at(-1)!.tMs + FRAME_MS : 0));
  return frames;
}

export const hold = (durationMs: number, posture?: Posture) => (startMs: number) => holdFrames(startMs, durationMs, posture);
export const hidden = (durationMs: number) => (startMs: number) => hiddenFrames(startMs, durationMs);
export const rep = (shape?: RepShape) => (startMs: number) => repFrames(startMs, shape);
export const reps = (count: number, shape?: RepShape) => (startMs: number) =>
  sequence(...Array.from({ length: count }, () => rep(shape))).map((f) => ({ ...f, tMs: f.tMs + Math.round(startMs) }));
