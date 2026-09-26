import { isValid, type Reason } from './judge';
import type { SessionEvent } from './session';

const REASON_WORDS: Record<Reason, string> = {
  not_low_enough: 'lower',
  no_lockout: 'lock arms',
  butt_high: 'butt high',
  hips_sagging: 'hips sagging',
  knees_down: 'knees',
};

export function speechFor(event: SessionEvent): string {
  switch (event.type) {
    case 'ready':
      return 'Ready';
    case 'rep':
      return isValid(event.rep) ? String(event.validCount) : `No count, ${REASON_WORDS[event.rep.reasons[0]]}`;
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
