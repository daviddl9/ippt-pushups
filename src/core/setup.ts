import { angleDeg, dot, mean, meanPoint, sub, tiltDeg, unit } from './geometry';
import { type Frame, type Point, type Side, jointPoint, nearSide, sideVisibility } from './pose';
import { RULES } from './rules.config';

export interface Calibration {
  readonly side: Side;
  readonly up: Point;
  readonly setupHeight: number;
  readonly setupElbowDeg: number;
}

export interface SetupSample {
  readonly tMs: number;
  readonly side: Side;
  readonly arm: Point;
  readonly elbowDeg: number;
}

const IMAGE_UP: Point = { x: 0, y: -1 };

/** The frame as a top-position sample, or null if it isn't one. */
export function setupSample(frame: Frame): SetupSample | null {
  if (!frame.pose) return null;
  const side = nearSide(frame.pose);
  if (sideVisibility(frame.pose, side) < RULES.minVisibility) return null;
  const at = (joint: Parameters<typeof jointPoint>[1]) => jointPoint({ ...frame, pose: frame.pose! }, joint, side);
  const arm = sub(at('shoulder'), at('wrist'));
  const elbowDeg = angleDeg(at('shoulder'), at('elbow'), at('wrist'));
  const isTop =
    elbowDeg >= RULES.setupMinElbowDeg &&
    angleDeg(at('hip'), at('knee'), at('ankle')) >= RULES.minKneeDeg &&
    tiltDeg(at('shoulder'), at('ankle'), IMAGE_UP) <= RULES.maxBodyTiltDeg &&
    dot(arm, IMAGE_UP) > 0;
  return isTop ? { tMs: frame.tMs, side, arm, elbowDeg } : null;
}

/** Consecutive same-side samples; any other frame restarts the run. */
export function extendRun(run: readonly SetupSample[], sample: SetupSample | null): SetupSample[] {
  if (!sample) return [];
  if (run.length > 0 && run[0].side !== sample.side) return [sample];
  return [...run, sample].filter((s) => sample.tMs - s.tMs <= 2 * RULES.setupHoldMs);
}

/** Calibration once the run is a steady hold of at least `setupHoldMs`, else null. */
export function calibrateFromHold(run: readonly SetupSample[]): Calibration | null {
  const last = run.at(-1);
  if (!last || last.tMs - run[0].tMs < RULES.setupHoldMs) return null;
  const hold = run.filter((s) => last.tMs - s.tMs <= RULES.setupHoldMs);
  const up = unit(meanPoint(hold.map((s) => s.arm)));
  const heights = hold.map((s) => dot(s.arm, up));
  const setupHeight = mean(heights);
  if (Math.max(...heights) - Math.min(...heights) > RULES.setupMaxWobble * setupHeight) return null;
  return { side: last.side, up, setupHeight, setupElbowDeg: mean(hold.map((s) => s.elbowDeg)) };
}
