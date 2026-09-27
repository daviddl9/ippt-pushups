import { expect, test } from '@playwright/test';

test('uploaded clip is analysed into a summary', async ({ page }) => {
  await page.goto('?delegate=CPU#/');
  await page.getByTestId('upload-input').setInputFiles('test-assets/img8568.webm');
  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 150_000 });
  await expect(page.getByTestId('rep-chip')).toHaveCount(25);
  await page.getByTestId('rep-chip').nth(4).click();
  await expect(page.getByTestId('rep-detail').locator('img')).toHaveCount(2);
});
