const framesBySession = new Map<string, ReadonlyMap<number, string>>();

/** No-count snapshots live in memory only; they are gone after a reload. */
export function rememberFrames(sessionId: string, frames: ReadonlyMap<number, string>): void {
  framesBySession.set(sessionId, frames);
}

export function framesFor(sessionId: string): ReadonlyMap<number, string> {
  return framesBySession.get(sessionId) ?? new Map();
}
