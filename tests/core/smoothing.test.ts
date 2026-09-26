import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/core/rules.config';
import { smooth, type Smoothed } from '../../src/core/smoothing';

type One = { readonly v: number };

function stepResponse(fps: number, seconds: number): number {
  let state: Smoothed<One> = smooth<One>(null, { v: 0 }, 0);
  for (let i = 1; i <= fps * seconds; i++) state = smooth(state, { v: 1 }, (i * 1000) / fps);
  return state.values.v;
}

describe('smooth', () => {
  it('passes the first value through', () => {
    expect(smooth<One>(null, { v: 5 }, 100)).toEqual({ tMs: 100, values: { v: 5 } });
  });

  it('closes 1 - 1/e of the gap after one time constant', () => {
    const next = smooth({ tMs: 0, values: { v: 0 } }, { v: 1 }, RULES.smoothingTauMs);
    expect(next.values.v).toBeCloseTo(1 - Math.exp(-1));
  });

  it('gives the same result at 15 and 30 fps', () => {
    expect(stepResponse(15, 0.2)).toBeCloseTo(stepResponse(30, 0.2), 6);
  });
});
