import type { Pose } from '../core/pose';
import { startCamera } from '../io/camera';
import { eachVideoFrame } from '../io/videoFrames';
import type { AppDeps } from './deps';
import { getEstimator } from './estimator';
import { createFpsMeter } from './fpsMeter';
import { saveSettings, type Settings } from './settings';

export interface DebugView {
  readonly video: HTMLVideoElement;
  drawPose(pose: Pose | null): void;
  showFps(fps: number): void;
  showLoadMs(ms: number): void;
  showSettings(settings: Settings): void;
  showError(message: string): void;
  onSettingsChange(handler: (settings: Settings) => void): void;
  onVoiceTest(handler: () => void): void;
}

/** Camera + skeleton + fps for checking the phone; returns a cleanup. */
export function startDebugScreen(view: DebugView, deps: AppDeps): () => void {
  view.showSettings(deps.settings);
  view.onSettingsChange((settings) => {
    saveSettings(settings, deps.storage);
    location.reload();
  });
  view.onVoiceTest(() => deps.voice.say('Voice check. One, two, three'));
  let left = false;
  let stop = () => {};
  void run(view, deps)
    .then((stopRun) => (left ? stopRun() : (stop = stopRun)))
    .catch((error: unknown) => view.showError(error instanceof Error ? error.message : String(error)));
  return () => {
    left = true;
    stop();
  };
}

async function run(view: DebugView, deps: AppDeps): Promise<() => void> {
  const loadStart = performance.now();
  const estimator = await getEstimator(deps.settings);
  view.showLoadMs(performance.now() - loadStart);
  const stopCamera = await startCamera(view.video, deps.settings.camera);
  const fps = createFpsMeter();
  const stopFrames = eachVideoFrame(view.video, (tMs) => {
    view.drawPose(estimator.detect(view.video, tMs));
    view.showFps(fps(tMs));
  });
  return () => {
    stopFrames();
    stopCamera();
  };
}
