import { describe, expect, it } from 'vitest';
import { createFpsMeter } from '../../src/app/fpsMeter';

describe('createFpsMeter', () => {
  it('counts the frames of the last second', () => {
    const fps = createFpsMeter();
    let latest = 0;
    for (let i = 0; i < 60; i++) latest = fps(i * 50);
    expect(latest).toBe(20);
  });
});
