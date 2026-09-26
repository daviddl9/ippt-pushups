import { median } from './geometry';
import type { RepAttempt } from './repCounter';
import { RULES } from './rules.config';
import type { Calibration } from './setup';

export type Reason = 'knees_down' | 'not_low_enough' | 'no_lockout' | 'butt_high' | 'hips_sagging';

export interface Thresholds {
  readonly lockoutElbowDeg: number;
  /** Null until the calibration reps are done. */
  readonly depthLine: number | null;
  readonly hipBaselinePct: number;
}

type Check = readonly [Reason, (attempt: RepAttempt, thresholds: Thresholds) => boolean];

const CHECKS: readonly Check[] = [
  ['knees_down', (a) => a.kneeMinDeg < RULES.minKneeDeg],
  ['not_low_enough', (a, t) => t.depthLine !== null && a.bottom > t.depthLine],
  ['no_lockout', (a) => !a.lockedOut],
  ['butt_high', (a, t) => a.hipMaxPct - t.hipBaselinePct > RULES.hipTolerancePct],
  ['hips_sagging', (a, t) => t.hipBaselinePct - a.hipMinPct > RULES.hipTolerancePct],
];

export const isValid = (rep: { readonly reasons: readonly Reason[] }): boolean => rep.reasons.length === 0;

export function judge(attempt: RepAttempt, thresholds: Thresholds): Reason[] {
  return CHECKS.filter(([, fails]) => fails(attempt, thresholds)).map(([reason]) => reason);
}

export function provisionalThresholds(calibration: Calibration): Thresholds {
  return {
    lockoutElbowDeg: calibration.setupElbowDeg - RULES.lockoutElbowToleranceDeg,
    depthLine: null,
    hipBaselinePct: 0,
  };
}

export function calibratedThresholds(provisional: Thresholds, reps: readonly RepAttempt[]): Thresholds {
  return {
    ...provisional,
    depthLine: median(reps.map((r) => r.bottom)) + RULES.depthTolerance,
    hipBaselinePct: median(reps.map((r) => (r.hipMaxPct + r.hipMinPct) / 2)),
  };
}

export function isShallow(thresholds: Thresholds): boolean {
  return thresholds.depthLine !== null && thresholds.depthLine - RULES.depthTolerance > RULES.maxCalibrationBottom;
}
