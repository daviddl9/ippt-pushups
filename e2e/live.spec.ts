import { expect, test } from '@playwright/test';
import { recordSpeech, spokenLines } from './speech';

test('live free-training set is counted aloud and summarised', async ({ page }) => {
  await recordSpeech(page);
  await page.goto('?delegate=CPU#/');
  await page.getByTestId('start-untimed').click();
  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('rep-chip')).toHaveCount(25);
  const spoken = await spokenLines(page);
  expect(spoken).toContain('Ready');
  expect(spoken).toContain('3. Calibrated');
  expect(spoken.at(-1)).toMatch(/^Done\. \d+, \d+ no counts?$/);
});
