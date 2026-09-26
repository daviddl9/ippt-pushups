import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { Frame } from '../src/core/pose';
import type { Mode } from '../src/core/mode';
import { newSession, stepSession, type SessionEvent, type SessionState } from '../src/core/session';

type CompactPose = readonly (readonly [number, number, number])[];
interface CompactFixture {
  readonly aspect: number;
  readonly frames: readonly { readonly tMs: number; readonly pose: CompactPose | null }[];
}

export function loadFixture(name: string, everyNthFrame = 1): Frame[] {
  const buffer = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
  const text = name.endsWith('.gz') ? gunzipSync(buffer).toString() : buffer.toString();
  const { aspect, frames } = JSON.parse(text) as CompactFixture;
  return frames
    .filter((_, i) => i % everyNthFrame === 0)
    .map(({ tMs, pose }) => ({ tMs, aspect, pose: pose && pose.map(([x, y, visibility]) => ({ x, y, visibility })) }));
}

export interface TimedEvent {
  readonly tMs: number;
  readonly event: SessionEvent;
}

export function runSession(frames: readonly Frame[], mode: Mode): { state: SessionState; events: TimedEvent[] } {
  let state = newSession(mode);
  const events: TimedEvent[] = [];
  for (const frame of frames) {
    const step = stepSession(state, frame);
    state = step.state;
    events.push(...step.events.map((event) => ({ tMs: frame.tMs, event })));
  }
  return { state, events };
}
