import { describe, expect, it } from 'vitest';
import { otherCamera } from '../../src/io/camera';

describe('otherCamera', () => {
  it('swaps front and back', () => {
    expect(otherCamera('user')).toBe('environment');
    expect(otherCamera('environment')).toBe('user');
  });
});
