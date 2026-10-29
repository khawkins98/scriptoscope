import { defineConfig } from '@playwright/test';
const browsers = (process.env.SCRIPTOSCOPE_NATIVE_DOM_BROWSERS ?? 'chromium').split(',');
export default defineConfig({ testDir: '.', testMatch: 'native-dom-contract.spec.mjs',
 workers: 1, timeout: 90000, expect: { timeout: 10000 }, reporter: 'list',
 outputDir: '../../test-results/native-dom',
 projects: browsers.map(browserName => ({ name: browserName, use: { browserName } })) });
