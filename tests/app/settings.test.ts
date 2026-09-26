import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, readSettings, saveSettings } from '../../src/app/settings';
import { memoryStorage } from '../memoryStorage';

describe('settings', () => {
  it('defaults to the lite model on the GPU', () => {
    expect(readSettings('', memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('prefers URL parameters over saved settings', () => {
    const storage = memoryStorage();
    saveSettings({ model: 'full', delegate: 'GPU' }, storage);
    expect(readSettings('?delegate=CPU', storage)).toEqual({ model: 'full', delegate: 'CPU' });
  });

  it('ignores unknown values', () => {
    expect(readSettings('?model=heavy&delegate=TPU', memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });
});
