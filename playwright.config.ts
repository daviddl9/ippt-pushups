import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}/ippt-pushups/`,
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-file-for-fake-video-capture=test-assets/img8568.mjpeg',
      ],
    },
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/ippt-pushups/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
