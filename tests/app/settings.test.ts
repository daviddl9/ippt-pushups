import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, readSettings, saveSettings } from '../../src/app/settings';
import { memoryStorage } from '../memoryStorage';

describe('settings', () => {
  it('defaults to the lite model on the GPU with the front camera', () => {
    expect(readSettings('', memoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.camera).toBe('user');
  });

  it('prefers URL parameters over saved settings', () => {
    const storage = memoryStorage();
    saveSettings({ model: 'full', delegate: 'GPU', camera: 'environment' }, storage);
    expect(readSettings('?delegate=CPU', storage)).toEqual({ model: 'full', delegate: 'CPU', camera: 'environment' });
  });

  it('ignores unknown values', () => {
    expect(readSettings('?model=heavy&delegate=TPU&camera=side', memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });
});
