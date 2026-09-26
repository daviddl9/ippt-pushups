import { describe, expect, it } from 'vitest';
import type { RepResult, SessionEvent } from '../../src/core/session';
import { speechFor } from '../../src/core/speech';

const rep = (reasons: RepResult['reasons']): RepResult => ({
  index: 1, reasons, startMs: 0, endMs: 900, bottom: 0.45, hipMaxPct: 0, hipMinPct: 0, kneeMinDeg: 175, lockedOut: true,
});

describe('speechFor', () => {
  it.each<[SessionEvent, string | null]>([
    [{ type: 'ready' }, 'Ready'],
    [{ type: 'rep', rep: rep([]), validCount: 12 }, null],
    [{ type: 'rep', rep: rep(['not_low_enough']), validCount: 12 }, 'No count, go lower'],
    [{ type: 'rep', rep: rep(['no_lockout']), validCount: 3 }, 'No count, straighten arms'],
    [{ type: 'rep', rep: rep(['butt_high']), validCount: 3 }, 'No count, straighten back'],
    [{ type: 'rep', rep: rep(['hips_sagging']), validCount: 3 }, 'No count, straighten back'],
    [{ type: 'rep', rep: rep(['knees_down', 'butt_high']), validCount: 3 }, 'No count, knees up'],
    [{ type: 'calibrated', shallow: false }, 'Calibrated'],
    [{ type: 'calibrated', shallow: true }, 'Calibration too shallow. Restart and go lower'],
    [{ type: 'lost' }, "Can't see you"],
    [{ type: 'timeLeft', seconds: 10 }, '10 seconds'],
    [{ type: 'done', timeUp: true, validCount: 42, noCount: 5 }, 'Time. 42, 5 no counts'],
    [{ type: 'done', timeUp: false, validCount: 20, noCount: 0 }, 'Done. 20, 0 no counts'],
    [{ type: 'done', timeUp: false, validCount: 24, noCount: 1 }, 'Done. 24, 1 no count'],
  ])('%j → %s', (event, text) => {
    expect(speechFor(event)).toBe(text);
  });
});
