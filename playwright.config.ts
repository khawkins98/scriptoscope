import type { PlaywrightTestConfig, ReporterDescription } from '@playwright/test';
import { defineConfig, devices } from '@playwright/test';

// Playwright drives the dev server itself via the `webServer` block, so
// `npm run test:e2e` works both locally and in CI without manual server
// orchestration.
//
// tsconfig has `exactOptionalPropertyTypes: true`, so optional fields like
// `workers` are set conditionally (spread-in only in CI) rather than passed
// as `undefined`.

const reporter: ReporterDescription[] = process.env.CI
  ? [['list'], ['html', { open: 'never' }]]
  : [['list']];

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    // Use a known-good page for the readiness probe — vite's root returns
    // 404 because demo/ has no index.html (themes-raster.html is the entry).
    url: 'http://localhost:5173/themes-raster.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
};

if (process.env.CI) config.workers = 1;

export default defineConfig(config);
