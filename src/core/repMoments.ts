import { RULES } from './rules.config';
import type { SessionState } from './session';

/** True when this frame is the lowest point so far of the rep in progress. */
export function reachedNewBottom(previous: SessionState, next: SessionState): boolean {
  const bottom = next.counter.open?.bottom;
  const before = previous.counter.open?.bottom;
  return bottom !== undefined && (before === undefined || bottom < before);
}

/** True when this frame is the highest point since the last bottom, i.e. the best view of the lockout. */
export function reachedNewTop(previous: SessionState, next: SessionState): boolean {
  const { counter } = next;
  if (counter.phase === 'down') return false;
  if (counter.phase === 'top' && !settlingLockout(next)) return false;
  if (previous.counter.phase === 'down') return true;
  return counter.peak > previous.counter.peak;
}

/**
 * Just after a rep is judged, in a plank, the arms may still be straightening. Later frames at the top are resting
 * or getting up (shoulders rise as you sit back onto your knees), so they can't replace the photo.
 */
function settlingLockout({ reps, tracking }: SessionState): boolean {
  const judgedMs = reps.at(-1)?.endMs;
  const inPlank = tracking.lastPlankMs === tracking.lastSeenMs;
  return inPlank && judgedMs !== undefined && tracking.lastSeenMs - judgedMs <= RULES.topPhotoWindowMs;
}

/** True on the frame where a new rep starts going down. */
export function startedNewRep(previous: SessionState, next: SessionState): boolean {
  return next.counter.phase === 'down' && previous.counter.phase !== 'down';
}
