import { defineConfig } from '@playwright/test';
const goldens = process.env.SCRIPTOSCOPE_RENDERING_GOLDENS === '1';
const extended = process.env.SCRIPTOSCOPE_RENDERING_PROFILE === 'extended';
const browsers = (process.env.SCRIPTOSCOPE_RENDERING_BROWSERS ?? (extended ? 'chromium,firefox,webkit' : 'chromium')).split(',');
export default defineConfig({
  globalSetup: './launch-preflight.mjs',
  testDir: '.', testMatch: goldens ? 'goldens.spec.mjs' : '*.spec.mjs', testIgnore: goldens ? [] : ['goldens.spec.mjs'],
  updateSnapshots: process.env.SCRIPTOSCOPE_UPDATE_GOLDENS === '1' ? 'all' : 'none',
  snapshotPathTemplate: '{testDir}/goldens/{arg}{ext}', fullyParallel: false, workers: 1,
  timeout: extended ? 180_000 : 90_000, expect: { timeout: 10_000 }, retries: 0,
  outputDir: '../../test-results/rendering-options',
  reporter: [['./failure-reporter.mjs'], ...(goldens ? [] : [['../rendering-requirements/reporter.mjs']]), ['list'], ['html', { outputFolder: '../../playwright-report/rendering-options', open: 'never' }]],
  use: { viewport: { width: 1280, height: 960 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: browsers.flatMap(browserName => (extended && browserName === 'chromium' ? [1, 2] : [1]).map(deviceScaleFactor => ({
    name: `${browserName}-dpr${deviceScaleFactor}`, metadata: { caseProfile: extended && browserName === 'chromium' && deviceScaleFactor === 1 ? 'extended' : 'smoke' }, use: { browserName, deviceScaleFactor },
  }))),
});
