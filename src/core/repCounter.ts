import { RULES } from './rules.config';

export interface Signals {
  readonly height: number;
  readonly elbowDeg: number;
  readonly hipOffsetPct: number;
  readonly kneeDeg: number;
}

export type Sample = Signals & { readonly tMs: number };

export interface RepAttempt {
  readonly startMs: number;
  readonly endMs: number;
  readonly bottom: number;
  readonly hipMaxPct: number;
  readonly hipMinPct: number;
  readonly kneeMinDeg: number;
  readonly lockedOut: boolean;
}

type OpenAttempt = Omit<RepAttempt, 'endMs' | 'lockedOut'>;

export interface CounterState {
  readonly phase: 'top' | 'down' | 'up';
  readonly peak: number;
  readonly peakMs: number;
  readonly open: OpenAttempt | null;
}

export interface CounterStep {
  readonly state: CounterState;
  readonly attempt?: RepAttempt;
}

export const INITIAL_COUNTER: CounterState = { phase: 'top', peak: -Infinity, peakMs: 0, open: null };

export function stepCounter(state: CounterState, sample: Sample, lockoutElbowDeg: number): CounterStep {
  if (state.phase === 'top') return stepTop(state, sample);
  if (state.phase === 'down') return stepDown(state, sample, lockoutElbowDeg);
  return stepUp(state, sample, lockoutElbowDeg);
}

/** Reps start from a plank: resting on the knees between reps (or after the set) is never an attempt. */
const inPlank = (s: Sample): boolean => s.kneeDeg >= RULES.minKneeDeg;

function stepTop(state: CounterState, s: Sample): CounterStep {
  if (!inPlank(s)) return { state };
  if (s.height >= state.peak) return { state: { ...state, peak: s.height, peakMs: s.tMs } };
  if (s.height >= state.peak - RULES.atTopTolerance) return { state: { ...state, peakMs: s.tMs } };
  if (s.height > state.peak - RULES.prominence) return { state };
  return { state: { ...state, phase: 'down', open: openAttempt(state.peakMs, s) } };
}

function stepDown(state: CounterState, s: Sample, lockoutElbowDeg: number): CounterStep {
  const open = track(state.open!, s);
  if (s.height <= open.bottom + RULES.prominence) return { state: { ...state, open } };
  return stepUp({ phase: 'up', peak: s.height, peakMs: s.tMs, open }, s, lockoutElbowDeg);
}

function stepUp(state: CounterState, s: Sample, lockoutElbowDeg: number): CounterStep {
  const open = track(state.open!, s);
  if (s.height >= RULES.topLine && s.elbowDeg >= lockoutElbowDeg) {
    return { state: { phase: 'top', peak: s.height, peakMs: s.tMs, open: null }, attempt: close(open, s.tMs, true) };
  }
  if (s.height < state.peak - RULES.prominence) {
    const attempt = close(open, s.tMs, false);
    if (!inPlank(s)) return { state: { ...INITIAL_COUNTER, peakMs: s.tMs }, attempt };
    return { state: { ...state, phase: 'down', open: openAttempt(state.peakMs, s) }, attempt };
  }
  const risen = s.height > state.peak;
  return { state: { ...state, open, peak: risen ? s.height : state.peak, peakMs: risen ? s.tMs : state.peakMs } };
}

function openAttempt(startMs: number, s: Sample): OpenAttempt {
  return { startMs, bottom: s.height, hipMaxPct: s.hipOffsetPct, hipMinPct: s.hipOffsetPct, kneeMinDeg: s.kneeDeg };
}

function track(open: OpenAttempt, s: Sample): OpenAttempt {
  return {
    startMs: open.startMs,
    bottom: Math.min(open.bottom, s.height),
    hipMaxPct: Math.max(open.hipMaxPct, s.hipOffsetPct),
    hipMinPct: Math.min(open.hipMinPct, s.hipOffsetPct),
    kneeMinDeg: Math.min(open.kneeMinDeg, s.kneeDeg),
  };
}

function close(open: OpenAttempt, endMs: number, lockedOut: boolean): RepAttempt {
  return { ...open, endMs, lockedOut };
}
