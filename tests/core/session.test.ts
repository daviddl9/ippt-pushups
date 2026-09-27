import { describe, expect, it } from 'vitest';
import { stopSession, type SessionEvent } from '../../src/core/session';
import { runSession, type TimedEvent } from '../helpers';
import { hidden, hold, rep, reps, sequence } from '../synthetic';

type RepEvent = Extract<SessionEvent, { type: 'rep' }>;
const types = (events: readonly TimedEvent[]) => events.map((e) => e.event.type);
const repEvents = (events: readonly TimedEvent[]) =>
  events.map((e) => e.event).filter((event): event is RepEvent => event.type === 'rep');

describe('session setup', () => {
  it('says ready after a steady one-second hold', () => {
    const { events } = runSession(sequence(hold(1200)), 'untimed');
    expect(types(events)).toEqual(['ready']);
    expect(events[0].tMs).toBeGreaterThanOrEqual(1000);
  });

  it('does not get ready while kneeling', () => {
    expect(runSession(sequence(hold(2000, { kneeDeg: 90 })), 'untimed').events).toEqual([]);
  });

  it('ignores reps before ready', () => {
    expect(runSession(sequence(reps(3), hold(1200), reps(2)), 'untimed').state.reps).toHaveLength(2);
  });
});

describe('session counting', () => {
  it('counts clean reps and calibrates after the third', () => {
    const { events } = runSession(sequence(hold(1200), reps(5)), 'untimed');
    expect(types(events)).toEqual(['ready', 'rep', 'rep', 'rep', 'calibrated', 'rep', 'rep']);
    expect(repEvents(events).map((e) => e.validCount)).toEqual([1, 2, 3, 4, 5]);
  });

  it('flags a half rep once calibrated', () => {
    const { state } = runSession(sequence(hold(1200), reps(3), rep({ bottom: 0.75 }), rep()), 'untimed');
    expect(state.reps.map((r) => r.reasons)).toEqual([[], [], [], ['not_low_enough'], []]);
  });

  it.each([
    ['butt_high', { hipLift: 0.1 }],
    ['hips_sagging', { hipLift: -0.1 }],
    ['knees_down', { kneeDeg: 110 }],
  ] as const)('flags %s', (reason, shape) => {
    const { state } = runSession(sequence(hold(1200), reps(3), rep(shape), rep()), 'untimed');
    expect(state.reps[3].reasons).toEqual([reason]);
  });

  it('flags a rep that goes down again without locking out', () => {
    const { state } = runSession(sequence(hold(1200), reps(3), rep({ topElbowDeg: 140 }), rep({ topElbowDeg: 140 })), 'untimed');
    expect(state.reps.map((r) => r.reasons)).toEqual([[], [], [], ['no_lockout']]);
  });
});

describe('session timing', () => {
  const ippt = runSession(sequence(hold(1200), reps(70)), 'ippt60');

  it('starts the clock when the first rep begins', () => {
    expect(ippt.state.startMs).toBeGreaterThanOrEqual(1000);
    expect(ippt.state.startMs).toBeLessThan(ippt.state.reps[0].endMs);
  });

  it('ends at 60 s and ignores reps finishing later', () => {
    expect(ippt.events.at(-1)?.event).toMatchObject({ type: 'done', timeUp: true, validCount: 60 });
    expect(ippt.state.endMs! - ippt.state.startMs!).toBe(60_000);
    expect(ippt.state.reps.every((r) => r.endMs <= ippt.state.endMs!)).toBe(true);
  });

  it('announces 30 and 10 seconds left', () => {
    const warnings = ippt.events.filter((e) => e.event.type === 'timeLeft');
    expect(warnings.map((e) => e.event)).toEqual([{ type: 'timeLeft', seconds: 30 }, { type: 'timeLeft', seconds: 10 }]);
    expect(warnings[0].tMs - ippt.state.startMs!).toBeGreaterThanOrEqual(30_000);
  });

  it('ignores rocking on the knees after the set, while the IPPT clock runs out', () => {
    const rocking = Array.from({ length: 20 }, (_, i) => hold(1000, { kneeDeg: 90, height: i % 2 ? 0.8 : 1 }));
    const { state } = runSession(sequence(hold(1200), reps(20), ...rocking), 'ippt60');
    expect(state.reps).toHaveLength(20);
    expect(state.reps.every((r) => r.reasons.length === 0)).toBe(true);
  });

  it('ends an untimed set after 5 s resting on the knees', () => {
    const { state } = runSession(sequence(hold(1200), reps(2), hold(6000, { kneeDeg: 90 })), 'untimed');
    expect(state.phase).toBe('done');
  });

  it('ends an untimed set 5 s after leaving position', () => {
    const { state, events } = runSession(sequence(hold(1200), reps(2), hold(6000, { standing: true })), 'untimed');
    expect(state.phase).toBe('done');
    expect(events.at(-1)?.event).toEqual({ type: 'done', timeUp: false, validCount: 2, noCount: 0 });
  });
});

describe('session tracking', () => {
  it('says it cannot see you once after a second without a pose', () => {
    const { events } = runSession(sequence(hold(1200), hidden(2500), reps(1)), 'untimed');
    expect(types(events).filter((type) => type === 'lost')).toHaveLength(1);
  });

  it('drops a final knees-down attempt when the set ends', () => {
    const { state } = runSession(sequence(hold(1200), reps(3), rep({ kneeDeg: 100 })), 'untimed');
    expect(state.reps).toHaveLength(4);
    expect(stopSession(state, 99_999).state.reps).toHaveLength(3);
  });
});
