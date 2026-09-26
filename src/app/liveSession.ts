import type { Pose } from '../core/pose';
import type { Mode } from '../core/mode';
import { newSession, stepSession, stopSession, type SessionEvent, type SessionState, type SessionStep } from '../core/session';
import { speechFor } from '../core/speech';
import { eachVideoFrame } from '../io/videoFrames';
import type { Voice } from '../io/voice';
import type { PoseEstimator } from '../pose/poseEstimator';
import { createBottomSnapshots } from './bottomSnapshots';
import type { FinishedSession } from './finishedSession';

export interface SessionView {
  render(state: SessionState, pose: Pose | null, tMs: number): void;
  announce(events: readonly SessionEvent[]): void;
}

export interface LiveSession {
  readonly done: Promise<FinishedSession>;
  stop(): void;
}

export function runLiveSession(mode: Mode, video: HTMLVideoElement, estimator: PoseEstimator, voice: Voice, view: SessionView): LiveSession {
  let state = newSession(mode);
  let finish: (session: FinishedSession) => void = () => {};
  const done = new Promise<FinishedSession>((resolve) => (finish = resolve));
  const snapshots = createBottomSnapshots(video);
  const apply = (step: SessionStep, pose: Pose | null, tMs: number) => {
    snapshots.observe(state, step);
    state = step.state;
    if (step.events.length > 0) voice.say(step.events.map(speechFor).join('. '));
    view.announce(step.events);
    view.render(state, pose, tMs);
    if (state.phase !== 'done') return;
    stopFrames();
    finish({ state, frames: snapshots.frames });
  };
  const stopFrames = eachVideoFrame(video, (tMs) => {
    const pose = estimator.detect(video, tMs);
    apply(stepSession(state, { tMs, pose, aspect: video.videoWidth / video.videoHeight }), pose, tMs);
  });
  const stop = () => {
    const tMs = performance.now();
    apply(stopSession(state, tMs), null, tMs);
  };
  return { done, stop };
}
