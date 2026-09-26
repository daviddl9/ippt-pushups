import { expect, test } from '@playwright/test';

test('debug screen tracks the camera', async ({ page }) => {
  await page.goto('?delegate=CPU#/debug');
  await expect(page.getByTestId('load-ms')).toHaveText(/\d+/, { timeout: 60_000 });
  await expect.poll(async () => Number(await page.getByTestId('fps').textContent()), { timeout: 30_000 }).toBeGreaterThan(10);
});
