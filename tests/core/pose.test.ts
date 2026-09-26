import { describe, expect, it } from 'vitest';
import { jointPoint, nearSide, sideVisibility, type Landmark } from '../../src/core/pose';

const pose = (leftVisibility: number, rightVisibility: number): Landmark[] =>
  Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: 0.25, visibility: i % 2 ? leftVisibility : rightVisibility }));

describe('pose', () => {
  it('scales x by the aspect ratio so both axes share frame-height units', () => {
    expect(jointPoint({ tMs: 0, aspect: 16 / 9, pose: pose(1, 1) }, 'shoulder', 'left')).toEqual({ x: (0.5 * 16) / 9, y: 0.25 });
  });

  it('takes the weakest joint as the side visibility', () => {
    const p = pose(0.9, 0.9);
    p[27] = { ...p[27], visibility: 0.2 };
    expect(sideVisibility(p, 'left')).toBe(0.2);
  });

  it('picks the more visible side as the camera side', () => {
    expect(nearSide(pose(0.4, 0.95))).toBe('right');
    expect(nearSide(pose(0.95, 0.4))).toBe('left');
  });
});
