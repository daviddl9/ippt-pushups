import type { RepPhotos } from './repSnapshots';

const photosBySession = new Map<string, ReadonlyMap<number, RepPhotos>>();

/** Rep photos live in memory only; they are gone after a reload. */
export function rememberPhotos(sessionId: string, photos: ReadonlyMap<number, RepPhotos>): void {
  photosBySession.set(sessionId, photos);
}

export function photosFor(sessionId: string): ReadonlyMap<number, RepPhotos> {
  return photosBySession.get(sessionId) ?? new Map();
}
