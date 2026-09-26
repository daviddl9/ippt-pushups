import { RULES } from './rules.config';

type Numbers<T> = { readonly [K in keyof T]: number };

export interface Smoothed<T extends Numbers<T>> {
  readonly tMs: number;
  readonly values: T;
}

/** Time-based exponential moving average of each value, so results don't depend on fps. */
export function smooth<T extends Numbers<T>>(previous: Smoothed<T> | null, values: T, tMs: number): Smoothed<T> {
  if (!previous) return { tMs, values };
  const alpha = 1 - Math.exp(-(tMs - previous.tMs) / RULES.smoothingTauMs);
  const keys = Object.keys(values) as (keyof T)[];
  const blended = Object.fromEntries(keys.map((k) => [k, previous.values[k] + alpha * (values[k] - previous.values[k])]));
  return { tMs, values: blended as T };
}
