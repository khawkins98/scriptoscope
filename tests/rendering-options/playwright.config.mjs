import { defineConfig } from '@playwright/test';
import { INTERACTION_SPECS } from './interaction-specs.mjs';
import { releaseOnlySpecs, builtTwinGrepInvert } from './pr-tier.mjs';
const MATRIX_SPEC = 'matrix.spec.mjs';
const goldens = process.env.SCRIPTOSCOPE_RENDERING_GOLDENS === '1';
const extended = process.env.SCRIPTOSCOPE_RENDERING_PROFILE === 'extended';
// The interaction suite (#598) runs only INTERACTION_SPECS, by default in the
// engines the bounded Chromium shards do not cover.
const interaction = process.env.SCRIPTOSCOPE_RENDERING_SUITE === 'interaction';
if (interaction && (goldens || extended)) throw new Error('SCRIPTOSCOPE_RENDERING_SUITE=interaction runs the bounded profile only');
// The bounded PR profile leaves built-mode twins and report-only specs to the
// release tier (pr-tier.mjs). SCRIPTOSCOPE_RENDERING_BUILT=all opts back in.
const prTier = !goldens && !extended && !interaction && process.env.SCRIPTOSCOPE_RENDERING_BUILT !== 'all';
// CI part (ci.yml): `matrix` runs only the per-theme corpus matrix, `rest` every
// other bounded spec. The matrix is ~18 tests that take as long as ~160 others,
// and Playwright shards by test count, so it gets its own jobs. Unset runs all.
const part = process.env.SCRIPTOSCOPE_RENDERING_PART ?? 'all';
if (!['all', 'matrix', 'rest'].includes(part)) throw new Error(`SCRIPTOSCOPE_RENDERING_PART must be matrix or rest, not ${part}`);
if (part !== 'all' && (goldens || interaction)) throw new Error('SCRIPTOSCOPE_RENDERING_PART applies to the bounded and extended profiles only');
const browsers = (process.env.SCRIPTOSCOPE_RENDERING_BROWSERS ?? (extended ? 'chromium,firefox,webkit' : interaction ? 'firefox,webkit' : 'chromium')).split(',');
export default defineConfig({
  globalSetup: './launch-preflight.mjs',
  testDir: '.', testMatch: goldens ? 'goldens.spec.mjs' : interaction ? [...INTERACTION_SPECS] : part === 'matrix' ? MATRIX_SPEC : '*.spec.mjs',
  testIgnore: goldens ? [] : ['goldens.spec.mjs', ...(part === 'rest' ? [MATRIX_SPEC] : []), ...(prTier ? releaseOnlySpecs(browsers) : [])],
  ...(prTier ? { grepInvert: builtTwinGrepInvert() } : {}),
  updateSnapshots: process.env.SCRIPTOSCOPE_UPDATE_GOLDENS === '1' ? 'all' : 'none',
  snapshotPathTemplate: '{testDir}/goldens/{arg}{ext}', fullyParallel: false, workers: 1,
  timeout: extended ? 180_000 : 90_000, expect: { timeout: 10_000 }, retries: 0,
  outputDir: '../../test-results/rendering-options',
  // CI shards (#576) also write a JSON report; tests/rendering-options/shards.mjs
  // checks their union against the unsharded `--list` inventory.
  reporter: [['./failure-reporter.mjs'], ...(goldens ? [] : [['../rendering-requirements/reporter.mjs']]), ['list'], ['html', { outputFolder: '../../playwright-report/rendering-options', open: 'never' }],
    ...(process.env.SCRIPTOSCOPE_RENDERING_JSON_REPORT ? [['json', { outputFile: process.env.SCRIPTOSCOPE_RENDERING_JSON_REPORT }]] : [])],
  // Goldens disable Chromium partial raster: re-rastering only an invalidated
  // part of a tile left the CSS fallback buttons' rounded anti-aliased edges
  // ±1-2 levels apart between runs (#526). Full-tile raster is reproducible.
  use: { viewport: { width: 1280, height: 960 }, screenshot: 'only-on-failure', trace: 'retain-on-failure',
    ...(goldens ? { launchOptions: { args: ['--disable-partial-raster'] } } : {}) },
  projects: browsers.flatMap(browserName => (extended && browserName === 'chromium' ? [1, 2] : [1]).map(deviceScaleFactor => ({
    name: `${browserName}-dpr${deviceScaleFactor}`, metadata: { caseProfile: extended && browserName === 'chromium' && deviceScaleFactor === 1 ? 'extended' : 'smoke' }, use: { browserName, deviceScaleFactor },
  }))),
});
