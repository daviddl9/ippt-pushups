import { describe, expect, it } from 'vitest';
import { stopSession } from '../src/core/session';
import { loadFixture, runSession } from './helpers';

const SHALLOW_REP = 10;

describe.each([
  ['img8568.lite.json.gz', 1],
  ['img8568.lite.json.gz', 2],
  ['img8568.full.json.gz', 1],
  ['img8568.full.json.gz', 2],
])('IMG_8568 golden run (%s, every %i frames)', (fixture, everyNth) => {
  const frames = loadFixture(fixture, everyNth);
  const untimed = runSession(frames, 'untimed');
  const { state } = stopSession(untimed.state, frames.at(-1)!.tMs);

  it('gets ready once in plank, around 0:09', () => {
    const readyMs = untimed.events.find((e) => e.event.type === 'ready')?.tMs ?? 0;
    expect(readyMs).toBeGreaterThan(8_000);
    expect(readyMs).toBeLessThan(10_000);
  });

  it('counts all 25 reps', () => {
    expect(state.reps).toHaveLength(25);
  });

  it('finds no faults except, possibly, the shallow rep at 0:21', () => {
    const faults = state.reps.filter((r) => r.reasons.length > 0);
    for (const fault of faults) expect(fault).toMatchObject({ index: SHALLOW_REP, reasons: ['not_low_enough'] });
  });

  it('starts the IPPT clock as the first rep begins, and warns at 30 s left', () => {
    const ippt = runSession(frames, 'ippt60');
    expect(ippt.state.startMs).toBeGreaterThan(12_000);
    expect(ippt.state.startMs).toBeLessThan(13_300);
    expect(ippt.events.filter((e) => e.event.type === 'timeLeft')).toHaveLength(1);
  });
});
