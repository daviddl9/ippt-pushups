export interface Voice {
  say(text: string): void;
  /** Call inside a tap: iOS only allows speech once something was spoken from a user gesture. Silent. */
  unlock(): void;
}

/** Latest line wins, so counts never queue up behind each other. */
export function createVoice(synth: SpeechSynthesis = window.speechSynthesis): Voice {
  return {
    say(text) {
      synth.cancel();
      synth.speak(utterance(text, 1));
    },
    unlock() {
      synth.speak(utterance('', 0));
    },
  };
}

function utterance(text: string, volume: number): SpeechSynthesisUtterance {
  const line = new SpeechSynthesisUtterance(text);
  line.rate = 1.1;
  line.volume = volume;
  return line;
}
