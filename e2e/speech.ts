import type { Page } from '@playwright/test';

/** Replaces speech synthesis with a recorder; read the lines back with spokenLines(page). */
export async function recordSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const lines: string[] = [];
    Object.assign(window, { __spoken: lines });
    window.speechSynthesis.speak = (utterance) => void lines.push(utterance.text);
    window.speechSynthesis.cancel = () => {};
  });
}

export function spokenLines(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
}
