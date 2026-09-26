export interface Voice {
  say(text: string): void;
}

/** Latest line wins, so counts never queue up behind each other. Call once inside a tap first (iOS unlock). */
export function createVoice(synth: SpeechSynthesis = window.speechSynthesis): Voice {
  return {
    say(text) {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      synth.speak(utterance);
    },
  };
}
