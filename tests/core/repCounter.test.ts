import { describe, expect, it } from 'vitest';
import { INITIAL_COUNTER, stepCounter, type RepAttempt, type Sample } from '../../src/core/repCounter';

const LOCKOUT = 160;

function attemptsFrom(samples: readonly Partial<Sample>[]): RepAttempt[] {
  let state = INITIAL_COUNTER;
  const attempts: RepAttempt[] = [];
  samples.forEach((partial, i) => {
    const sample = { tMs: i * 100, height: 1, elbowDeg: 170, hipOffsetPct: 0, kneeDeg: 178, ...partial };
    const step = stepCounter(state, sample, LOCKOUT);
    state = step.state;
    if (step.attempt) attempts.push(step.attempt);
  });
  return attempts;
}

const heights = (...hs: number[]) => hs.map((height) => ({ height, elbowDeg: height > 0.9 ? 170 : 100 }));

describe('stepCounter', () => {
  it('emits one locked-out attempt when a rep returns to the top', () => {
    const attempts = attemptsFrom(heights(1, 0.9, 0.7, 0.5, 0.45, 0.6, 0.8, 0.95));
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ bottom: 0.45, lockedOut: true, startMs: 0, endMs: 700 });
  });

  it('ignores dips smaller than the prominence', () => {
    expect(attemptsFrom(heights(1, 0.95, 0.92, 0.97, 1))).toHaveLength(0);
  });

  it('closes an attempt without lockout when the user goes down again first', () => {
    const samples = [...heights(1, 0.7, 0.45, 0.7), { height: 0.95, elbowDeg: 140 }, ...heights(0.7, 0.45, 0.7, 0.95)];
    const attempts = attemptsFrom(samples);
    expect(attempts.map((a) => a.lockedOut)).toEqual([false, true]);
  });

  it('starts an attempt at the last moment at the top', () => {
    const attempts = attemptsFrom(heights(1, 1, 0.99, 0.98, 0.7, 0.45, 0.7, 0.95));
    expect(attempts[0].startMs).toBe(300);
  });

  it('tracks hip and knee extremes across the attempt', () => {
    const samples = [{ height: 1 }, { height: 0.7, hipOffsetPct: 3 }, { height: 0.45, hipOffsetPct: -4, kneeDeg: 120 }, { height: 0.95 }];
    expect(attemptsFrom(samples)[0]).toMatchObject({ hipMaxPct: 3, hipMinPct: -4, kneeMinDeg: 120 });
  });
});
