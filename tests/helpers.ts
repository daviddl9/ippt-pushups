import type { Frame } from '../src/core/pose';
import type { Mode } from '../src/core/mode';
import { newSession, stepSession, type SessionEvent, type SessionState } from '../src/core/session';

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
