import { RULES } from '../core/rules.config';
import type { SessionState } from '../core/session';

/** Milliseconds as m:ss, rounding partial seconds up. */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** IPPT: time left. Untimed: time elapsed. */
export function timerText(state: SessionState, tMs: number): string {
  const elapsedMs = state.startMs === null ? 0 : (state.endMs ?? tMs) - state.startMs;
  return formatClock(state.mode === 'ippt60' ? RULES.ipptDurationMs - elapsedMs : elapsedMs);
}

export function statusText(state: SessionState): string {
  if (state.phase === 'setup') return 'Get into a plank, side-on to the camera';
  if (state.phase === 'done') return 'Done';
  if (state.tracking.lostAnnounced) return "Can't see you. Check the camera";
  return state.startMs === null ? 'Ready. Start when you like' : '';
}
