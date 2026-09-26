export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Landmark extends Point {
  readonly visibility: number;
}

export type Pose = readonly Landmark[];

export interface Frame {
  readonly tMs: number;
  readonly pose: Pose | null;
  readonly aspect: number;
}

export type VisibleFrame = Frame & { readonly pose: Pose };
export type Side = 'left' | 'right';
export type Joint = 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle';

const LANDMARK_INDEX: Record<Joint, readonly [left: number, right: number]> = {
  shoulder: [11, 12],
  elbow: [13, 14],
  wrist: [15, 16],
  hip: [23, 24],
  knee: [25, 26],
  ankle: [27, 28],
};

const JOINTS = Object.keys(LANDMARK_INDEX) as Joint[];

function landmark(pose: Pose, joint: Joint, side: Side): Landmark {
  return pose[LANDMARK_INDEX[joint][side === 'left' ? 0 : 1]];
}

/** Joint position in frame-height units, so x and y share one scale. */
export function jointPoint(frame: VisibleFrame, joint: Joint, side: Side): Point {
  const { x, y } = landmark(frame.pose, joint, side);
  return { x: x * frame.aspect, y };
}

export function sideVisibility(pose: Pose, side: Side): number {
  return Math.min(...JOINTS.map((joint) => landmark(pose, joint, side).visibility));
}

export function nearSide(pose: Pose): Side {
  return sideVisibility(pose, 'left') > sideVisibility(pose, 'right') ? 'left' : 'right';
}
