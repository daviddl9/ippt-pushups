import { describe, expect, it } from 'vitest';
import { statusText, timerText } from '../../src/app/liveText';
import { newSession } from '../../src/core/session';

describe('timerText', () => {
  it('counts down from 1:00 in IPPT mode', () => {
    expect(timerText(newSession('ippt60'), 5_000)).toBe('1:00');
    expect(timerText({ ...newSession('ippt60'), startMs: 1_000 }, 18_500)).toBe('0:43');
  });

  it('counts up in untimed mode and freezes when done', () => {
    expect(timerText({ ...newSession('untimed'), startMs: 1_000 }, 66_000)).toBe('1:05');
    expect(timerText({ ...newSession('untimed'), startMs: 1_000, endMs: 31_000 }, 99_000)).toBe('0:30');
  });
});

describe('statusText', () => {
  it('guides setup, says ready, then stays quiet during the set', () => {
    const active = { ...newSession('ippt60'), phase: 'active' as const };
    expect(statusText(newSession('ippt60'))).toBe('Get into a plank, side-on to the camera');
    expect(statusText(active)).toBe('Ready. Start when you like');
    expect(statusText({ ...active, startMs: 0 })).toBe('');
    expect(statusText({ ...active, tracking: { ...active.tracking, lostAnnounced: true } })).toBe("Can't see you. Check the camera");
  });
});
