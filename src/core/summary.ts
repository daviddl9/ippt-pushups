import { isValid, type Reason } from './judge';
import type { SessionState } from './session';

export interface Summary {
  readonly valid: number;
  readonly noCount: number;
  readonly byReason: Readonly<Partial<Record<Reason, number>>>;
  readonly durationMs: number;
}

export function summarize(state: SessionState): Summary {
  const valid = state.reps.filter(isValid).length;
  const byReason: Partial<Record<Reason, number>> = {};
  for (const reason of state.reps.flatMap((rep) => rep.reasons)) byReason[reason] = (byReason[reason] ?? 0) + 1;
  const durationMs = state.startMs === null || state.endMs === null ? 0 : state.endMs - state.startMs;
  return { valid, noCount: state.reps.length - valid, byReason, durationMs };
}
