import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: ['explicit-host-contract.spec.mjs', 'explicit-host-committed-sync.spec.mjs', 'native-dom-contract.spec.mjs', 'tabs-accessibility.spec.mjs', 'range-name.spec.mjs', 'range-constraints.spec.mjs', 'range-pointer.spec.mjs', 'slider-endpoints.spec.mjs', 'display-profile.spec.mjs', 'pattern-lifetime.spec.mjs', 'slider-decode-lifetime.spec.mjs'],
  workers: 1, timeout: 60000, expect: { timeout: 10000 }, reporter: 'list',
  outputDir: '../../test-results/explicit-host', use: { browserName: 'chromium' } });
