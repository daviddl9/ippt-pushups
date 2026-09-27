import { saveSession, toSavedSession, type SessionMeta } from '../store/history';
import type { AppDeps } from './deps';
import type { FinishedSession } from './finishedSession';
import { routeHash } from './routes';
import { rememberPhotos } from './sessionPhotos';

/** Saves a session with reps and shows its summary; an empty session just goes home. */
export function finishSession({ state, photos }: FinishedSession, meta: SessionMeta, deps: Pick<AppDeps, 'storage' | 'navigate'>): void {
  if (state.reps.length === 0) return deps.navigate(routeHash({ name: 'home' }));
  const saved = toSavedSession(state, meta);
  saveSession(saved, deps.storage);
  rememberPhotos(saved.id, photos);
  deps.navigate(routeHash({ name: 'summary', id: saved.id }));
}
