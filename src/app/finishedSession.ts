import type { SessionState } from '../core/session';

export interface FinishedSession {
  readonly state: SessionState;
  readonly frames: ReadonlyMap<number, string>;
}
