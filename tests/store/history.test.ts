import { describe, expect, it } from 'vitest';
import { newSession } from '../../src/core/session';
import { loadSessions, saveSession, toSavedSession } from '../../src/store/history';
import { memoryStorage } from '../memoryStorage';

const saved = (iso: string) =>
  toSavedSession({ ...newSession('ippt60'), startMs: 0, endMs: 60_000 }, { startedAt: new Date(iso), source: 'camera', model: 'lite' });

describe('history', () => {
  it('starts empty', () => {
    expect(loadSessions(memoryStorage())).toEqual([]);
  });

  it('keeps sessions newest first', () => {
    const storage = memoryStorage();
    saveSession(saved('2026-09-26T09:00:00Z'), storage);
    saveSession(saved('2026-09-27T09:00:00Z'), storage);
    expect(loadSessions(storage).map((s) => s.startedAt)).toEqual(['2026-09-27T09:00:00.000Z', '2026-09-26T09:00:00.000Z']);
  });

  it('stores the summary with the session', () => {
    const storage = memoryStorage();
    saveSession(saved('2026-09-26T09:00:00Z'), storage);
    expect(loadSessions(storage)[0]).toMatchObject({ mode: 'ippt60', source: 'camera', summary: { valid: 0, durationMs: 60_000 } });
  });
});
