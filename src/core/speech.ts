import { isValid, type Reason } from './judge';
import type { SessionEvent } from './session';

const CUES: Record<Reason, string> = {
  knees_down: 'knees up',
  not_low_enough: 'go lower',
  no_lockout: 'straighten arms',
  butt_high: 'straighten back',
  hips_sagging: 'straighten back',
};

/** What the voice says for an event: the count for a good rep, a correction cue for a no-count. */
export function speechFor(event: SessionEvent): string {
  switch (event.type) {
    case 'ready':
      return 'Ready';
    case 'rep':
      return isValid(event.rep) ? String(event.validCount) : `No count, ${CUES[event.rep.reasons[0]]}`;
    case 'calibrated':
      return event.shallow ? 'Calibration too shallow. Restart and go lower' : 'Calibrated';
    case 'lost':
      return "Can't see you";
    case 'timeLeft':
      return `${event.seconds} seconds`;
    case 'done':
      return `${event.timeUp ? 'Time' : 'Done'}. ${event.validCount}, ${event.noCount} no count${event.noCount === 1 ? '' : 's'}`;
  }
}
