import { describe, expect, it, vi } from 'vitest';
import { createVoice } from '../../src/io/voice';

class FakeUtterance {
  rate = 1;
  constructor(readonly text: string) {}
}

describe('createVoice', () => {
  it('cancels whatever is playing, then speaks the new line', () => {
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    const calls: string[] = [];
    const synth = { cancel: () => calls.push('cancel'), speak: (u: FakeUtterance) => calls.push(`speak ${u.text}`) };
    createVoice(synth as unknown as SpeechSynthesis).say('12');
    expect(calls).toEqual(['cancel', 'speak 12']);
    vi.unstubAllGlobals();
  });
});
