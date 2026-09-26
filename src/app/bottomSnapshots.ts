import { isValid } from '../core/judge';
import { reachedNewBottom, type SessionState, type SessionStep } from '../core/session';

const WIDTH = 320;

export interface BottomSnapshots {
  /** No-count rep index → JPEG data URL of its lowest frame. Memory only. */
  readonly frames: ReadonlyMap<number, string>;
  observe(previous: SessionState, step: SessionStep): void;
}

export function createBottomSnapshots(video: HTMLVideoElement): BottomSnapshots {
  const canvas = document.createElement('canvas');
  const frames = new Map<number, string>();
  const capture = () => {
    canvas.width = WIDTH;
    canvas.height = Math.round((WIDTH * video.videoHeight) / video.videoWidth);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  };
  return {
    frames,
    observe(previous, step) {
      for (const event of step.events) {
        if (event.type === 'rep' && !isValid(event.rep)) frames.set(event.rep.index, canvas.toDataURL('image/jpeg', 0.7));
      }
      if (reachedNewBottom(previous, step.state)) capture();
    },
  };
}
