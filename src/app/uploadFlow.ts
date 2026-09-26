import type { AppDeps } from './deps';
import { getEstimator } from './estimator';
import { finishSession } from './finishSession';
import { analyzeVideo } from './uploadSession';

/** Analyses a picked video in a hidden <video> (Safari only decodes attached elements) and opens its summary. */
export async function analyzeUpload(file: File, deps: AppDeps, onProgress: (fraction: number) => void): Promise<void> {
  const startedAt = new Date();
  const estimator = await getEstimator(deps.settings);
  const video = Object.assign(document.createElement('video'), { muted: true, playsInline: true });
  video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.append(video);
  try {
    const finished = await analyzeVideo(file, video, estimator, onProgress);
    finishSession(finished, { startedAt, source: 'upload', model: deps.settings.model }, deps);
  } finally {
    video.remove();
  }
}
