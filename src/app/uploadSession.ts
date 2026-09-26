import { newSession, stepSession, stopSession } from '../core/session';
import { seekFrames } from '../io/videoFrames';
import type { PoseEstimator } from '../pose/poseEstimator';
import { createBottomSnapshots } from './bottomSnapshots';
import type { FinishedSession } from './finishedSession';

const UPLOAD_FPS = 15;

/** Runs a video file through the same pipeline as the camera, voice off. Analyses the first set. */
export async function analyzeVideo(file: File, video: HTMLVideoElement, estimator: PoseEstimator, onProgress: (fraction: number) => void): Promise<FinishedSession> {
  video.src = URL.createObjectURL(file);
  await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
  const snapshots = createBottomSnapshots(video);
  let state = newSession('untimed');
  let lastMs = 0;
  for await (const tMs of seekFrames(video, UPLOAD_FPS)) {
    const step = stepSession(state, { tMs, pose: estimator.detect(video, tMs), aspect: video.videoWidth / video.videoHeight });
    snapshots.observe(state, step);
    state = step.state;
    lastMs = tMs;
    onProgress(tMs / 1000 / video.duration);
    if (state.phase === 'done') break;
  }
  URL.revokeObjectURL(video.src);
  return { state: stopSession(state, lastMs).state, frames: snapshots.frames };
}
