import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { createVoice } from '../../src/io/voice';

class FakeUtterance {
  rate = 1;
  volume = 1;
  constructor(readonly text: string) {}
}

function fakeSynth(calls: string[]): SpeechSynthesis {
  const synth = {
    cancel: () => calls.push('cancel'),
    speak: (u: FakeUtterance) => calls.push(`speak "${u.text}" volume ${u.volume}`),
  };
  return synth as unknown as SpeechSynthesis;
}

describe('createVoice', () => {
  beforeEach(() => vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance));
  afterEach(() => vi.unstubAllGlobals());

  it('cancels whatever is playing, then speaks the new line', () => {
    const calls: string[] = [];
    createVoice(fakeSynth(calls)).say('12');
    expect(calls).toEqual(['cancel', 'speak "12" volume 1']);
  });

  it('unlocks speech with a silent utterance', () => {
    const calls: string[] = [];
    createVoice(fakeSynth(calls)).unlock();
    expect(calls).toEqual(['speak "" volume 0']);
  });
});
