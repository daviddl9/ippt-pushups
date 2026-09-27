import { reachedNewBottom, reachedNewTop, startedNewRep } from '../core/repMoments';
import type { SessionState, SessionStep } from '../core/session';

const WIDTH = 480;
const QUALITY = 0.75;

export interface RepPhotos {
  readonly bottom: string;
  readonly top: string;
}

export interface RepSnapshots {
  /** Rep index → JPEG data URLs of its lowest and highest frames. Memory only. */
  readonly photos: ReadonlyMap<number, RepPhotos>;
  observe(previous: SessionState, step: SessionStep): void;
}

/**
 * The bottom photo is taken when a rep is judged. The top photo waits until the next rep starts (or the set ends),
 * so it shows the most extended arms, not just the first locked frame.
 */
export function createRepSnapshots(video: HTMLVideoElement): RepSnapshots {
  const bottom = document.createElement('canvas');
  const top = document.createElement('canvas');
  const photos = new Map<number, RepPhotos>();
  let pending: { readonly index: number; readonly bottom: string } | null = null;
  const settle = () => {
    if (pending) photos.set(pending.index, { bottom: pending.bottom, top: jpeg(top) });
    pending = null;
  };
  return {
    photos,
    observe(previous, step) {
      if (reachedNewTop(previous, step.state)) capture(video, top);
      for (const event of step.events) {
        if (event.type !== 'rep') continue;
        settle();
        pending = { index: event.rep.index, bottom: jpeg(bottom) };
      }
      if (startedNewRep(previous, step.state) || step.state.phase === 'done') settle();
      if (reachedNewBottom(previous, step.state)) capture(video, bottom);
    },
  };
}

function capture(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
  canvas.width = WIDTH;
  canvas.height = Math.round((WIDTH * video.videoHeight) / video.videoWidth);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
}

const jpeg = (canvas: HTMLCanvasElement): string => canvas.toDataURL('image/jpeg', QUALITY);
