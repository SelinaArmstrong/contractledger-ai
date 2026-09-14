import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8791',
    channel: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/start-release-preview.mjs',
    url: 'http://127.0.0.1:8791',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
