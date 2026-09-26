import type { Thresholds } from '../core/judge';
import type { Mode } from '../core/mode';
import type { RepResult, SessionState } from '../core/session';
import { summarize, type Summary } from '../core/summary';
import type { ModelVariant } from '../pose/poseEstimator';

export interface SavedSession {
  readonly id: string;
  readonly startedAt: string;
  readonly mode: Mode;
  readonly source: 'camera' | 'upload';
  readonly model: ModelVariant;
  readonly summary: Summary;
  readonly thresholds: Thresholds | null;
  readonly reps: readonly RepResult[];
}

export interface SessionMeta {
  readonly startedAt: Date;
  readonly source: SavedSession['source'];
  readonly model: ModelVariant;
}

const KEY = 'ippt-pushups.sessions.v1';
const MAX_SESSIONS = 200;

export function toSavedSession(state: SessionState, meta: SessionMeta): SavedSession {
  return {
    id: meta.startedAt.toISOString(),
    startedAt: meta.startedAt.toISOString(),
    mode: state.mode,
    source: meta.source,
    model: meta.model,
    summary: summarize(state),
    thresholds: state.thresholds,
    reps: state.reps,
  };
}

/** Newest first. */
export function loadSessions(storage: Pick<Storage, 'getItem'>): SavedSession[] {
  return JSON.parse(storage.getItem(KEY) ?? '[]') as SavedSession[];
}

export function saveSession(session: SavedSession, storage: Pick<Storage, 'getItem' | 'setItem'>): void {
  const others = loadSessions(storage).filter((s) => s.id !== session.id);
  storage.setItem(KEY, JSON.stringify([session, ...others].slice(0, MAX_SESSIONS)));
}
