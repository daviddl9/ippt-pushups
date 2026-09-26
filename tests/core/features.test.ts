import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../../src/core/features';
import type { Calibration } from '../../src/core/setup';
import { frameAt } from '../synthetic';

const CALIBRATION: Calibration = { side: 'right', up: { x: 0, y: -1 }, setupHeight: 0.3, setupElbowDeg: 172 };

describe('computeFeatures', () => {
  it('measures height relative to the setup hold', () => {
    expect(computeFeatures(frameAt(0), CALIBRATION)?.height).toBeCloseTo(1);
    expect(computeFeatures(frameAt(0, { height: 0.45 }), CALIBRATION)?.height).toBeCloseTo(0.45);
  });

  it('measures elbow and knee angles', () => {
    const features = computeFeatures(frameAt(0, { elbowDeg: 90, kneeDeg: 120 }), CALIBRATION);
    expect(features?.elbowDeg).toBeCloseTo(90);
    expect(features?.kneeDeg).toBeCloseTo(120);
  });

  it('signs the hip offset: positive for butt high, negative for sagging', () => {
    expect(computeFeatures(frameAt(0, { hipLift: 0.1 }), CALIBRATION)?.hipOffsetPct).toBeGreaterThan(8);
    expect(computeFeatures(frameAt(0, { hipLift: -0.1 }), CALIBRATION)?.hipOffsetPct).toBeLessThan(-8);
  });

  it('knows when the body is out of push-up position', () => {
    expect(computeFeatures(frameAt(0), CALIBRATION)?.inPosition).toBe(true);
    expect(computeFeatures(frameAt(0, { standing: true }), CALIBRATION)?.inPosition).toBe(false);
  });

  it('returns null when the camera-side limbs are hidden', () => {
    expect(computeFeatures(frameAt(0, { visibility: 0.3 }), CALIBRATION)).toBeNull();
  });
});
