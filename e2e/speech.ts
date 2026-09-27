import type { Page } from '@playwright/test';

interface SpeechLog {
  readonly heard: string[];
  readonly silent: string[];
}

/** Replaces speech synthesis with a recorder that separates audible lines from silent (volume 0) unlocks. */
export async function recordSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: SpeechLog = { heard: [], silent: [] };
    Object.assign(window, { __speech: log });
    window.speechSynthesis.speak = (utterance) => void (utterance.volume === 0 ? log.silent : log.heard).push(utterance.text);
    window.speechSynthesis.cancel = () => {};
  });
}

const speechLog = (page: Page): Promise<SpeechLog> => page.evaluate(() => (window as unknown as { __speech: SpeechLog }).__speech);

export async function spokenLines(page: Page): Promise<string[]> {
  return (await speechLog(page)).heard;
}

export async function silentUnlocks(page: Page): Promise<number> {
  return (await speechLog(page)).silent.length;
}
