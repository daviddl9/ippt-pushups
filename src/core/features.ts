import { angleDeg, dot, signedOffset, sub, tiltDeg } from './geometry';
import { type Frame, type Joint, jointPoint, sideVisibility } from './pose';
import { RULES } from './rules.config';
import type { Calibration } from './setup';

export interface Features {
  readonly tMs: number;
  readonly inPosition: boolean;
  /** Shoulder height above the wrist, as a fraction of the setup height. */
  readonly height: number;
  readonly elbowDeg: number;
  /** Hip distance from the shoulder→ankle line, % of its length; positive = hip above. */
  readonly hipOffsetPct: number;
  readonly kneeDeg: number;
}

/** Per-frame signals from the camera-side limbs, or null when they aren't visible. */
export function computeFeatures(frame: Frame, calibration: Calibration): Features | null {
  if (!frame.pose || sideVisibility(frame.pose, calibration.side) < RULES.minVisibility) return null;
  const at = (joint: Joint) => jointPoint({ ...frame, pose: frame.pose! }, joint, calibration.side);
  const shoulder = at('shoulder');
  const wrist = at('wrist');
  const hip = at('hip');
  const ankle = at('ankle');
  return {
    tMs: frame.tMs,
    inPosition: tiltDeg(shoulder, ankle, calibration.up) <= RULES.maxBodyTiltDeg,
    height: dot(sub(shoulder, wrist), calibration.up) / calibration.setupHeight,
    elbowDeg: angleDeg(shoulder, at('elbow'), wrist),
    hipOffsetPct: 100 * signedOffset(hip, shoulder, ankle, calibration.up),
    kneeDeg: angleDeg(hip, at('knee'), ankle),
  };
}
