import { describe, expect, it } from 'vitest';
import { calibrateFromHold, extendRun, setupSample, type SetupSample } from '../../src/core/setup';
import { frameAt, holdFrames } from '../synthetic';

function runOf(frames: ReturnType<typeof holdFrames>): SetupSample[] {
  return frames.reduce<SetupSample[]>((run, frame) => extendRun(run, setupSample(frame)), []);
}

describe('setupSample', () => {
  it('accepts the top push-up position on the camera side', () => {
    expect(setupSample(frameAt(0))).toMatchObject({ side: 'right', tMs: 0 });
  });

  it.each([
    ['kneeling', { kneeDeg: 90 }],
    ['bent arms', { elbowDeg: 120 }],
    ['standing', { standing: true }],
    ['hidden limbs', { visibility: 0.3 }],
  ])('rejects %s', (_, posture) => {
    expect(setupSample(frameAt(0, posture))).toBeNull();
  });

  it('rejects frames without a pose', () => {
    expect(setupSample({ ...frameAt(0), pose: null })).toBeNull();
  });
});

describe('extendRun', () => {
  it('restarts on a missing sample', () => {
    const run = runOf(holdFrames(0, 500));
    expect(extendRun(run, null)).toEqual([]);
  });
});

describe('calibrateFromHold', () => {
  it('waits for a full second', () => {
    expect(calibrateFromHold(runOf(holdFrames(0, 900)))).toBeNull();
  });

  it('learns side, up, height and lockout angle from a steady hold', () => {
    const calibration = calibrateFromHold(runOf(holdFrames(0, 1100)));
    expect(calibration?.side).toBe('right');
    expect(calibration?.up.x).toBeCloseTo(0);
    expect(calibration?.up.y).toBeCloseTo(-1);
    expect(calibration?.setupHeight).toBeCloseTo(0.3);
    expect(calibration?.setupElbowDeg).toBeCloseTo(172);
  });

  it('rejects a wobbly hold', () => {
    const frames = holdFrames(0, 1100).map((frame, i) => (i % 2 ? frameAt(frame.tMs, { height: 0.8 }) : frame));
    expect(calibrateFromHold(runOf(frames))).toBeNull();
  });
});
