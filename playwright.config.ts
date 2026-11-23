import { randomUUID } from 'node:crypto';
import { defineConfig } from '@playwright/test';

// The release preview and its test workers share one disposable requester account.
process.env.CONTRACTLEDGER_TEST_PASSWORD ??= randomUUID();

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
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    timeout: 60_000,
  },
});
