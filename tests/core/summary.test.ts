import { describe, expect, it } from 'vitest';
import { newSession, type RepResult } from '../../src/core/session';
import { summarize } from '../../src/core/summary';

const rep = (index: number, reasons: RepResult['reasons']): RepResult => ({
  index, reasons, startMs: 0, endMs: 900, bottom: 0.45, hipMaxPct: 0, hipMinPct: 0, kneeMinDeg: 175, lockedOut: true,
});

describe('summarize', () => {
  it('totals valid reps, no-counts by reason, and duration', () => {
    const state = {
      ...newSession('ippt60'),
      startMs: 1000,
      endMs: 61_000,
      reps: [rep(1, []), rep(2, ['not_low_enough']), rep(3, ['not_low_enough', 'butt_high']), rep(4, [])],
    };
    expect(summarize(state)).toEqual({ valid: 2, noCount: 2, byReason: { not_low_enough: 2, butt_high: 1 }, durationMs: 60_000 });
  });

  it('has zero duration before the first rep', () => {
    expect(summarize(newSession('untimed')).durationMs).toBe(0);
  });
});
