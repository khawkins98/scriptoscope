import { execFileSync } from 'node:child_process';
// Linux golden verification is a separate CI command beside browser contracts.
// Verification never creates a missing baseline. Update produces candidates only.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
import { goldenCasePages } from './golden-cases.mjs';
const directory = new URL('./goldens/', import.meta.url);
const manifestPath = new URL('manifest.json', directory);
const catalog = JSON.parse(readFileSync(new URL('../../demo/themes-manifest.json', import.meta.url)));
const playwrightVersion = JSON.parse(readFileSync(new URL('../../node_modules/@playwright/test/package.json', import.meta.url))).version;
const update = process.env.SCRIPTOSCOPE_UPDATE_GOLDENS === '1';
// Keep comparable representative state groups, auto/explicit sizes, raw pixels,
// and consumer DOM together. This is reviewed sampling, not exhaustive fidelity.
const pages = goldenCasePages();
const caseDigest = createHash('sha256').update(JSON.stringify(pages)).digest('hex');
const executionProvenance = {
  gitCommit: process.env.SCRIPTOSCOPE_GIT_COMMIT ?? process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  bundleSha256: createHash('sha256').update(readFileSync(new URL('../../dist/scriptoscope.js', import.meta.url))).digest('hex'),
  stylesheetSha256: createHash('sha256').update(readFileSync(new URL('../../dist/scriptoscope.css', import.meta.url))).digest('hex'),
  packageLockSha256: createHash('sha256').update(readFileSync(new URL('../../package-lock.json', import.meta.url))).digest('hex'),
};

for (const { slug } of catalog) for (const [pageIndex, cases] of pages.entries()) test(`${slug}: reviewed Linux Chromium contact sheet page${pageIndex + 1}`, async ({ page, browser, browserName, servers }, testInfo) => {
  expect(process.platform, 'goldens are pinned to Linux; use workflow-dispatch to record candidates').toBe('linux');
  expect(browserName).toBe('chromium');
  expect(process.arch, 'CI golden platform is linux/amd64').toBe('x64');
  expect(testInfo.project.use.deviceScaleFactor).toBe(1);
  const environment = { schema: 1, platform: 'linux', arch: process.arch, browser: 'chromium',
    browserVersion: browser.version(), playwrightVersion, deviceScaleFactor: 1, viewport: [1280, 960],
    caseDigest, casePages: pages.map(cases => cases.map(c => c.id)), themeSlugs: catalog.map(t => t.slug),
    requiredContainerImage: 'mcr.microsoft.com/playwright:v1.64.0-noble@sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f',
    fonts: Object.fromEntries(['virtue.woff', 'charcoal-12.woff'].map(name => [name, createHash('sha256').update(readFileSync(new URL(`../../demo/assets/fonts/${name}`, import.meta.url))).digest('hex')])),
    sourceArchives: Object.fromEntries(catalog.map(({ slug, source }) => [slug, createHash('sha256').update(readFileSync(new URL(`../../themes/${slug}/${source}`, import.meta.url))).digest('hex')])),
    sourceZoom: 4, labelZoom: 1, runtime: 'built-public-entry' };
  if (update) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ environment, provenance: executionProvenance }, null, 2)+'\n');
  } else {
    expect(existsSync(manifestPath), 'Missing reviewed golden manifest. Recording requires explicit update + visual review.').toBe(true);
    expect(JSON.parse(readFileSync(manifestPath)).environment, 'baseline environment/case inventory must match').toEqual(environment);
  }
  let current, result;
  const observed = [];
  const attachObserved = complete => attachObservations(testInfo, 'golden-pages', `${slug}-page-${pageIndex + 1}`, {
    slug, page: pageIndex + 1, complete, operation: update ? 'record-candidates' : 'verify',
    environment, executionProvenance,
    interpretation: 'Statuses and dimensions describe this execution, not independent expected availability or fidelity.',
    cases: observed,
  });
  await openHarness(page, servers, 'built');
  const actualInputs = await page.evaluate(() => window.controlMatrix.ready);
  expect(actualInputs.sourceZoom).toBe(environment.sourceZoom);
  expect(actualInputs.labelZoom).toBe(environment.labelZoom);
  try {
    for (const c of cases) {
      current = c;
      result = await page.evaluate(({ c, slug }) => window.controlMatrix.runCase(c, { slug, retain: true, includeReferences: false }), { c, slug });
      observed.push({ id: c.id, family: c.family, mode: c.mode, options: c.options, status: result.status,
        renderPath: result.renderPath, canvases: result.canvases.map(({ width, height, opaqueBounds }) => ({ width, height, opaqueBounds })),
        controlRects: result.controls.map(({ rect }) => rect), error: result.error, resolutionTrace: result.resolutionTrace });
      expect(result.status, result.error ?? c.id).not.toBe('error');
    }
    // Hide transient server URLs; the cases, labels, dimensions and native DOM
    // stay visible. Backing font binaries and viewport are pinned above.
    await page.locator('#status').evaluate(el => el.remove());
    await expect(page.locator('#matrix')).toHaveScreenshot(`${slug}-page-${pageIndex + 1}.png`, {
      animations: 'disabled', caret: 'hide', threshold: 0, maxDiffPixels: 0,
    });
    await attachObserved(true);
  } catch (error) {
    await attachObserved(false).catch(() => {});
    await attachCase(page, testInfo, { slug, current, result, environment }, error); throw error;
  }
});
