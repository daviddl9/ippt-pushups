import type { Mode } from '../core/mode';
import { startCamera } from '../io/camera';
import { keepScreenOn } from '../io/wakeLock';
import type { AppDeps } from './deps';
import { getEstimator } from './estimator';
import { finishSession } from './finishSession';
import { runLiveSession, type LiveSession, type SessionView } from './liveSession';

export interface LiveScreenView extends SessionView {
  readonly video: HTMLVideoElement;
  showError(message: string): void;
  onStop(handler: () => void): void;
}

/** Runs one live set on the view; returns a cleanup that stops it (the set is still saved). */
export function startLiveScreen(mode: Mode, view: LiveScreenView, deps: AppDeps): () => void {
  let left = false;
  const guarded = { ...deps, navigate: (hash: string) => left || deps.navigate(hash) };
  const started = begin(mode, view, guarded).catch((error: unknown) => {
    view.showError(error instanceof Error ? error.message : String(error));
    return null;
  });
  const stop = () => void started.then((live) => live?.stop());
  view.onStop(stop);
  return () => {
    left = true;
    stop();
  };
}

async function begin(mode: Mode, view: LiveScreenView, deps: AppDeps): Promise<LiveSession> {
  const startedAt = new Date();
  const estimator = await getEstimator(deps.settings);
  const stopCamera = await startCamera(view.video);
  const releaseScreen = await keepScreenOn();
  const live = runLiveSession(mode, view.video, estimator, deps.voice, view);
  const stopWhenHidden = () => document.hidden && live.stop();
  document.addEventListener('visibilitychange', stopWhenHidden);
  void live.done.then((finished) => {
    document.removeEventListener('visibilitychange', stopWhenHidden);
    stopCamera();
    releaseScreen();
    finishSession(finished, { startedAt, source: 'camera', model: deps.settings.model }, deps);
  });
  return live;
}
