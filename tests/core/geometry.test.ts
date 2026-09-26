import { describe, expect, it } from 'vitest';
import { angleDeg, median, signedOffset, tiltDeg } from '../../src/core/geometry';

const UP = { x: 0, y: -1 };

describe('geometry', () => {
  it('measures the angle at a vertex', () => {
    expect(angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
    expect(angleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180);
  });

  it('measures tilt from level relative to up', () => {
    expect(tiltDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, UP)).toBeCloseTo(0);
    expect(tiltDeg({ x: 0, y: 0 }, { x: 1, y: 1 }, UP)).toBeCloseTo(45);
    expect(tiltDeg({ x: 0, y: 0 }, { x: 0, y: 1 }, UP)).toBeCloseTo(90);
  });

  it('gives a signed offset from a line, positive towards up', () => {
    const a = { x: 0, y: 0.5 };
    const b = { x: 1, y: 0.5 };
    expect(signedOffset({ x: 0.5, y: 0.4 }, a, b, UP)).toBeCloseTo(0.1);
    expect(signedOffset({ x: 0.5, y: 0.6 }, a, b, UP)).toBeCloseTo(-0.1);
  });

  it('takes the median of odd and even lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
