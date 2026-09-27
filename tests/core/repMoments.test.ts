import { describe, expect, it } from 'vitest';
import type { Frame } from '../../src/core/pose';
import { reachedNewBottom, reachedNewTop, startedNewRep } from '../../src/core/repMoments';
import { newSession, stepSession, type SessionState } from '../../src/core/session';
import { hold, rep, sequence } from '../synthetic';

type Moment = (previous: SessionState, next: SessionState) => boolean;

const HOLD_FRAMES = 36;
const REP_FRAMES = 30;
const FRAMES = sequence(hold(1200), rep(), rep());

/** Where the moment fires, as [rep number, frame within that rep]; rep 0 is the setup hold. */
function firings(moment: Moment, frames: readonly Frame[] = FRAMES): [number, number][] {
  let state = newSession('untimed');
  const fired: [number, number][] = [];
  frames.forEach((frame, i) => {
    const next = stepSession(state, frame).state;
    if (moment(state, next)) fired.push(i < HOLD_FRAMES ? [0, i] : [1 + Math.floor((i - HOLD_FRAMES) / REP_FRAMES), (i - HOLD_FRAMES) % REP_FRAMES]);
    state = next;
  });
  return fired;
}

describe('rep moments', () => {
  it('reachedNewBottom fires only while a rep is going down', () => {
    const fired = firings(reachedNewBottom);
    expect(fired.every(([repNumber, frame]) => repNumber > 0 && frame <= REP_FRAMES / 2 + 2)).toBe(true);
    expect(fired.filter(([repNumber]) => repNumber === 1).length).toBeGreaterThan(3);
  });

  it('reachedNewTop fires on the way up, never on the way down', () => {
    const fired = firings(reachedNewTop).filter(([repNumber]) => repNumber > 0);
    expect(fired.some(([, frame]) => frame > 5 && frame < REP_FRAMES / 2)).toBe(false);
    expect(fired.filter(([repNumber, frame]) => repNumber === 1 && frame > REP_FRAMES / 2).length).toBeGreaterThan(3);
  });

  it('reachedNewTop ignores getting up onto the knees after a rep is judged', () => {
    const gettingUp = sequence(hold(1200), rep(), hold(1000, { kneeDeg: 90, height: 1.1 }));
    const fired = firings(reachedNewTop, gettingUp);
    expect(fired.some(([repNumber, frame]) => repNumber > 1 || (repNumber === 1 && frame >= REP_FRAMES))).toBe(false);
  });

  it('reachedNewTop stops improving a judged rep once the arms have had time to lock', () => {
    const lateRise = sequence(hold(1200), rep(), hold(600, { height: 0.95, elbowDeg: 170 }), hold(600, { height: 1.1 }));
    const fired = firings(reachedNewTop, lateRise);
    expect(fired.some(([repNumber, frame]) => repNumber > 1 && frame >= 18)).toBe(false);
  });

  it('startedNewRep fires once per rep, as the descent starts', () => {
    expect(firings(startedNewRep)).toEqual([expect.arrayContaining([1]), expect.arrayContaining([2])]);
  });
});
