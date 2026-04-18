import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  timeout: 60_000,
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: {
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  },
});
