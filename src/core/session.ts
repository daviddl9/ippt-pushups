import { computeFeatures, type Features } from './features';
import type { Mode } from './mode';
import { calibratedThresholds, isShallow, isValid, judge, provisionalThresholds, type Reason, type Thresholds } from './judge';
import type { Frame } from './pose';
import { INITIAL_COUNTER, stepCounter, type CounterState, type RepAttempt, type Signals } from './repCounter';
import { RULES } from './rules.config';
import { calibrateFromHold, extendRun, setupSample, type Calibration, type SetupSample } from './setup';
import { smooth, type Smoothed } from './smoothing';

export interface RepResult extends RepAttempt {
  readonly index: number;
  readonly reasons: readonly Reason[];
}

export type SessionEvent =
  | { readonly type: 'ready' }
  | { readonly type: 'rep'; readonly rep: RepResult; readonly validCount: number }
  | { readonly type: 'calibrated'; readonly shallow: boolean }
  | { readonly type: 'lost' }
  | { readonly type: 'timeLeft'; readonly seconds: number }
  | { readonly type: 'done'; readonly timeUp: boolean; readonly validCount: number; readonly noCount: number };

interface Tracking {
  readonly lastSeenMs: number;
  readonly lastPlankMs: number;
  readonly lostAnnounced: boolean;
}

export interface SessionState {
  readonly mode: Mode;
  readonly phase: 'setup' | 'active' | 'done';
  readonly run: readonly SetupSample[];
  readonly calibration: Calibration | null;
  readonly thresholds: Thresholds | null;
  readonly counter: CounterState;
  readonly smoothed: Smoothed<Signals> | null;
  readonly reps: readonly RepResult[];
  readonly startMs: number | null;
  readonly endMs: number | null;
  readonly warnings: number;
  readonly tracking: Tracking;
}

export interface SessionStep {
  readonly state: SessionState;
  readonly events: readonly SessionEvent[];
}

const NO_EVENTS: readonly SessionEvent[] = [];

export function newSession(mode: Mode): SessionState {
  return {
    mode,
    phase: 'setup',
    run: [],
    calibration: null,
    thresholds: null,
    counter: INITIAL_COUNTER,
    smoothed: null,
    reps: [],
    startMs: null,
    endMs: null,
    warnings: 0,
    tracking: { lastSeenMs: 0, lastPlankMs: 0, lostAnnounced: false },
  };
}

export function stepSession(state: SessionState, frame: Frame): SessionStep {
  if (state.phase === 'setup') return stepSetup(state, frame);
  if (state.phase === 'active') return stepActive(state, frame);
  return { state, events: NO_EVENTS };
}

export function stopSession(state: SessionState, tMs: number): SessionStep {
  return state.phase === 'done' ? { state, events: NO_EVENTS } : finish(state, tMs, false);
}

function stepSetup(state: SessionState, frame: Frame): SessionStep {
  const run = extendRun(state.run, setupSample(frame));
  const calibration = calibrateFromHold(run);
  if (!calibration) return { state: { ...state, run }, events: NO_EVENTS };
  return {
    state: {
      ...state,
      phase: 'active',
      run: [],
      calibration,
      thresholds: provisionalThresholds(calibration),
      tracking: { lastSeenMs: frame.tMs, lastPlankMs: frame.tMs, lostAnnounced: false },
    },
    events: [{ type: 'ready' }],
  };
}

function stepActive(state: SessionState, frame: Frame): SessionStep {
  if (isTimeUp(state, frame.tMs)) return finish(state, state.startMs! + RULES.ipptDurationMs, true);
  if (isIdle(state, frame.tMs)) return finish(state, frame.tMs, false);
  const warned = warnTime(state, frame.tMs);
  const features = computeFeatures(frame, state.calibration!);
  const next = features ? stepVisible(warned.state, features) : stepHidden(warned.state, frame.tMs);
  return { state: next.state, events: [...warned.events, ...next.events] };
}

function isTimeUp(state: SessionState, tMs: number): boolean {
  return state.mode === 'ippt60' && state.startMs !== null && tMs - state.startMs >= RULES.ipptDurationMs;
}

function isIdle(state: SessionState, tMs: number): boolean {
  return state.mode === 'untimed' && state.startMs !== null && tMs - state.tracking.lastPlankMs >= RULES.untimedEndAfterMs;
}

function warnTime(state: SessionState, tMs: number): SessionStep {
  if (state.mode !== 'ippt60' || state.startMs === null) return { state, events: NO_EVENTS };
  const remainingMs = RULES.ipptDurationMs - (tMs - state.startMs);
  const due = RULES.timeWarningsSecondsLeft.filter((s) => remainingMs <= s * 1000).length;
  if (due === state.warnings) return { state, events: NO_EVENTS };
  return { state: { ...state, warnings: due }, events: [{ type: 'timeLeft', seconds: RULES.timeWarningsSecondsLeft[due - 1] }] };
}

function stepHidden(state: SessionState, tMs: number): SessionStep {
  const { tracking } = state;
  if (tracking.lostAnnounced || tMs - tracking.lastSeenMs <= RULES.lostAfterMs) return { state, events: NO_EVENTS };
  return { state: { ...state, tracking: { ...tracking, lostAnnounced: true } }, events: [{ type: 'lost' }] };
}

function stepVisible(state: SessionState, features: Features): SessionStep {
  const { tMs, inPosition } = features;
  const lastPlankMs = isPlank(features) ? tMs : state.tracking.lastPlankMs;
  const seen = { ...state, tracking: { lastSeenMs: tMs, lastPlankMs, lostAnnounced: false } };
  return inPosition ? stepInPosition(seen, features) : { state: seen, events: NO_EVENTS };
}

/** In position with straight legs; kneeling still feeds the counter (to flag knees) but counts as resting. */
function isPlank(features: Features): boolean {
  return features.inPosition && features.kneeDeg >= RULES.minKneeDeg;
}

function stepInPosition(state: SessionState, features: Features): SessionStep {
  const { tMs, height, elbowDeg, hipOffsetPct, kneeDeg } = features;
  const smoothed = smooth(state.smoothed, { height, elbowDeg, hipOffsetPct, kneeDeg }, tMs);
  const step = stepCounter(state.counter, { tMs, ...smoothed.values }, state.thresholds!.lockoutElbowDeg);
  const next = { ...state, smoothed, counter: step.state };
  return step.attempt ? recordRep(next, step.attempt) : { state: next, events: NO_EVENTS };
}

function recordRep(state: SessionState, attempt: RepAttempt): SessionStep {
  const rep: RepResult = { ...attempt, index: state.reps.length + 1, reasons: judge(attempt, state.thresholds!) };
  const reps = [...state.reps, rep];
  const next = { ...state, reps, startMs: state.startMs ?? attempt.startMs };
  const repEvent: SessionEvent = { type: 'rep', rep, validCount: reps.filter(isValid).length };
  if (reps.length !== RULES.calibrationReps) return { state: next, events: [repEvent] };
  const thresholds = calibratedThresholds(next.thresholds!, reps);
  return { state: { ...next, thresholds }, events: [repEvent, { type: 'calibrated', shallow: isShallow(thresholds) }] };
}

function finish(state: SessionState, endMs: number, timeUp: boolean): SessionStep {
  const reps = withoutGettingUp(state.reps);
  const validCount = reps.filter(isValid).length;
  return {
    state: { ...state, phase: 'done', endMs, reps },
    events: [{ type: 'done', timeUp, validCount, noCount: reps.length - validCount }],
  };
}

/** A final no-count with knees down is the user getting up, not a rep. */
function withoutGettingUp(reps: readonly RepResult[]): readonly RepResult[] {
  return reps.at(-1)?.reasons.includes('knees_down') ? reps.slice(0, -1) : reps;
}
