import type { Voice } from '../io/voice';
import type { Settings } from './settings';

export interface AppDeps {
  readonly settings: Settings;
  readonly voice: Voice;
  readonly storage: Storage;
  navigate(hash: string): void;
}
