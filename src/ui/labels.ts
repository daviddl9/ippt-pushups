import type { Reason } from '../core/judge';
import type { Mode } from '../core/mode';

export const MODE_LABELS: Record<Mode, string> = {
  ippt60: 'IPPT 1-min',
  untimed: 'Free training',
};

export const REASON_LABELS: Record<Reason, string> = {
  knees_down: 'Knees down',
  not_low_enough: 'Not low enough',
  no_lockout: 'Arms not locked',
  butt_high: 'Butt high',
  hips_sagging: 'Hips sagging',
};
