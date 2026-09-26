import { describe, expect, it } from 'vitest';
import { monotonicClock } from '../../src/pose/monotonicClock';

describe('monotonicClock', () => {
  it('passes increasing timestamps through', () => {
    const clock = monotonicClock();
    expect([0, 33, 67].map(clock)).toEqual([0, 33, 67]);
  });

  it('shifts a restarted video past the last timestamp, keeping its spacing', () => {
    const clock = monotonicClock();
    [0, 33, 67].forEach(clock);
    expect([0, 33].map(clock)).toEqual([68, 101]);
  });
});
