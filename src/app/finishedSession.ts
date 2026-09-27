import type { SessionState } from '../core/session';
import type { RepPhotos } from './repSnapshots';

export interface FinishedSession {
  readonly state: SessionState;
  readonly photos: ReadonlyMap<number, RepPhotos>;
}
