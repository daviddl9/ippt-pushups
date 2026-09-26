import type { Delegate, ModelVariant } from '../pose/poseEstimator';

export interface Settings {
  readonly model: ModelVariant;
  readonly delegate: Delegate;
}

export const DEFAULT_SETTINGS: Settings = { model: 'lite', delegate: 'GPU' };
const KEY = 'ippt-pushups.settings.v1';
const MODELS: readonly string[] = ['lite', 'full'];
const DELEGATES: readonly string[] = ['GPU', 'CPU'];

/** URL parameters win over saved settings, which win over defaults. */
export function readSettings(search: string, storage: Pick<Storage, 'getItem'>): Settings {
  const saved = JSON.parse(storage.getItem(KEY) ?? '{}') as Partial<Settings>;
  const params = new URLSearchParams(search);
  const pick = <T extends string>(key: keyof Settings, allowed: readonly string[], fallback: T): T =>
    [params.get(key), saved[key]].find((v): v is T => typeof v === 'string' && allowed.includes(v)) ?? fallback;
  return { model: pick('model', MODELS, DEFAULT_SETTINGS.model), delegate: pick('delegate', DELEGATES, DEFAULT_SETTINGS.delegate) };
}

export function saveSettings(settings: Settings, storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(KEY, JSON.stringify(settings));
}
