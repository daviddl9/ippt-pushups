import { expect, test } from '@playwright/test';

const session = (startedAt: string, valid: number) => ({
  id: startedAt,
  startedAt,
  mode: 'ippt60',
  source: 'camera',
  model: 'lite',
  summary: { valid, noCount: 1, byReason: { not_low_enough: 1 }, durationMs: 60_000 },
  thresholds: null,
  reps: [],
});

test('history lists saved sessions newest first and opens their summary', async ({ page }) => {
  const sessions = [session('2026-09-27T09:00:00.000Z', 42), session('2026-09-26T09:00:00.000Z', 38)];
  await page.addInitScript((saved) => localStorage.setItem('ippt-pushups.sessions.v1', JSON.stringify(saved)), sessions);
  await page.goto('#/history');
  await expect(page.getByTestId('history-item')).toHaveCount(2);
  await page.getByTestId('history-item').first().click();
  await expect(page.getByTestId('valid-total')).toHaveText('42');
});
