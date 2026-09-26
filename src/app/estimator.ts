import { createPoseEstimator, type PoseEstimator } from '../pose/poseEstimator';
import type { Settings } from './settings';

let current: { key: string; estimator: Promise<PoseEstimator> } | null = null;

/** One MediaPipe instance for the whole app; recreating them leaks memory in WebKit (mediapipe#5036). */
export function getEstimator(settings: Settings): Promise<PoseEstimator> {
  const key = `${settings.model}/${settings.delegate}`;
  if (current?.key === key) return current.estimator;
  void current?.estimator.then((old) => old.close());
  current = { key, estimator: createPoseEstimator(settings.model, settings.delegate) };
  return current.estimator;
}
