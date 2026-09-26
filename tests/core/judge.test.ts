import { describe, expect, it } from 'vitest';
import { calibratedThresholds, isShallow, isValid, judge, provisionalThresholds, type Thresholds } from '../../src/core/judge';
import type { RepAttempt } from '../../src/core/repCounter';

const GOOD: RepAttempt = { startMs: 0, endMs: 900, bottom: 0.45, hipMaxPct: 1, hipMinPct: -1, kneeMinDeg: 175, lockedOut: true };
const THRESHOLDS: Thresholds = { lockoutElbowDeg: 160, depthLine: 0.57, hipBaselinePct: 0 };

describe('judge', () => {
  it('passes a good rep', () => {
    expect(judge(GOOD, THRESHOLDS)).toEqual([]);
    expect(isValid({ reasons: judge(GOOD, THRESHOLDS) })).toBe(true);
  });

  it.each([
    ['not_low_enough', { bottom: 0.7 }],
    ['no_lockout', { lockedOut: false }],
    ['butt_high', { hipMaxPct: 8 }],
    ['hips_sagging', { hipMinPct: -8 }],
    ['knees_down', { kneeMinDeg: 120 }],
  ])('flags %s', (reason, change) => {
    expect(judge({ ...GOOD, ...change }, THRESHOLDS)).toEqual([reason]);
  });

  it('skips depth until calibrated', () => {
    expect(judge({ ...GOOD, bottom: 0.9 }, { ...THRESHOLDS, depthLine: null })).toEqual([]);
  });

  it('judges hips relative to the calibrated baseline', () => {
    expect(judge({ ...GOOD, hipMaxPct: 8 }, { ...THRESHOLDS, hipBaselinePct: 4 })).toEqual([]);
  });
});

describe('thresholds', () => {
  const calibration = { side: 'right', up: { x: 0, y: -1 }, setupHeight: 0.3, setupElbowDeg: 170 } as const;

  it('starts from the setup hold', () => {
    expect(provisionalThresholds(calibration)).toEqual({ lockoutElbowDeg: 158, depthLine: null, hipBaselinePct: 0 });
  });

  it('sets the depth line and hip baseline from the calibration reps', () => {
    const reps = [0.4, 0.5, 0.45].map((bottom, i) => ({ ...GOOD, bottom, hipMaxPct: i, hipMinPct: i }));
    const thresholds = calibratedThresholds(provisionalThresholds(calibration), reps);
    expect(thresholds.depthLine).toBeCloseTo(0.57);
    expect(thresholds.hipBaselinePct).toBe(1);
    expect(isShallow(thresholds)).toBe(false);
  });

  it('calls calibration shallow when the median bottom is above 0.6', () => {
    expect(isShallow({ ...THRESHOLDS, depthLine: 0.75 })).toBe(true);
  });
});
