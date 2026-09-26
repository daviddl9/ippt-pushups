import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Pose } from '../core/pose';
import { monotonicClock } from './monotonicClock';

export type ModelVariant = 'lite' | 'full';
export type Delegate = 'GPU' | 'CPU';

export interface PoseEstimator {
  detect(source: TexImageSource, tMs: number): Pose | null;
  close(): void;
}

const toPose = (landmarks: readonly NormalizedLandmark[] | undefined): Pose | null =>
  landmarks?.map(({ x, y, visibility }) => ({ x, y, visibility })) ?? null;

export async function createPoseEstimator(model: ModelVariant, delegate: Delegate): Promise<PoseEstimator> {
  const assets = `${import.meta.env.BASE_URL}mediapipe`;
  const fileset = await FilesetResolver.forVisionTasks(`${assets}/wasm`);
  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${assets}/pose_landmarker_${model}.task`, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
  const clock = monotonicClock();
  return {
    detect: (source, tMs) => toPose(landmarker.detectForVideo(source, clock(tMs)).landmarks[0]),
    close: () => landmarker.close(),
  };
}
