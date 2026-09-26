import { expect, test, type Page } from '@playwright/test';

const SETUP_OR_READY = /plank|Ready/;
const savedCamera = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('ippt-pushups.settings.v1') ?? '{}') as { camera?: string }).camera);

test('live screen flips to the back camera and restarts the set', async ({ page }) => {
  await page.goto('?delegate=CPU#/live/untimed');
  await expect(page.getByTestId('status')).toHaveText(SETUP_OR_READY, { timeout: 60_000 });
  await expect(page.getByTestId('flip-camera')).toHaveText(/back/i);
  await page.getByTestId('flip-camera').click();
  await expect(page.getByTestId('flip-camera')).toHaveText(/front/i);
  expect(await savedCamera(page)).toBe('environment');
  await expect(page.getByTestId('status')).toHaveText(SETUP_OR_READY, { timeout: 60_000 });
});

test('camera check switches camera and keeps tracking', async ({ page }) => {
  await page.goto('?delegate=CPU#/debug');
  await page.getByTestId('camera-select').selectOption('environment');
  await expect(page.getByTestId('camera-select')).toHaveValue('environment');
  await expect.poll(async () => Number(await page.getByTestId('fps').textContent()), { timeout: 60_000 }).toBeGreaterThan(10);
});
