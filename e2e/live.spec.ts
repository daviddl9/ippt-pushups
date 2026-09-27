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
  expect(spoken).toContain('1');
  expect(spoken).toContain('3. Calibrated');
  expect(spoken.filter((line) => /^\d+$/.test(line)).length).toBeGreaterThanOrEqual(20);
  expect(spoken.at(-1)).toMatch(/^Done\. \d+, \d+ no counts?$/);
  await page.getByTestId('rep-chip').nth(4).click();
  await expect(page.getByTestId('rep-detail').locator('img')).toHaveCount(2);

  await page.getByTestId('redo').click();
  await expect(page).toHaveURL(/#\/live\/untimed$/);
  await expect(page.getByTestId('count')).toHaveText('0');
  expect((await spokenLines(page)).at(-1)).toBe('Get into position, side-on to the camera');
});
