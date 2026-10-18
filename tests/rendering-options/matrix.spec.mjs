import { readFileSync } from 'node:fs';
import { test, expect, openHarness, attachCase } from './fixtures.mjs';
import { listCases } from './cases.mjs';
const catalog = JSON.parse(readFileSync(new URL('../../demo/themes-manifest.json', import.meta.url)));

async function pixels(page, canvases) {
  return page.evaluate(async selectors => Promise.all(selectors.map(async selector => {
    const canvas = document.querySelector(selector);
    const rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const digest = await crypto.subtle.digest('SHA-256', rgba);
    return { width: canvas.width, height: canvas.height,
      sha256: [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('') };
  })), canvases.map(c => c.selector));
}

function assertOutput(result, c) {
  expect(result.status, result.error ?? c.id).not.toBe('error');
  if (result.status === 'unavailable') {
    expect(c.mode, 'only direct compositor calls may report missing themed art').toBe('direct');
    expect(result.canvases).toHaveLength(0);
    return;
  }
  if (c.mode === 'direct') expect(result.canvases.length, `${c.id} produces visible backing pixels`).toBeGreaterThan(0);
  // Native/CSS fallback controls can correctly have no canvas. Their real DOM
  // remains subject to style, focus, geometry and source/built screenshot checks.
  for (const canvas of result.canvases) {
    expect(canvas.width).toBeGreaterThan(0); expect(canvas.height).toBeGreaterThan(0);
    expect(canvas.opaqueBounds, 'a rendered canvas contains art').not.toBeNull();
    expect(canvas.rect.width, 'CSS must not squash backing width').toBeCloseTo(canvas.width, 4);
    expect(canvas.rect.height, 'CSS must not squash backing height').toBeCloseTo(canvas.height, 4);
  }
  if (c.mode === 'declarative') {
    expect(result.controls.length, 'the real scanner produced control DOM').toBeGreaterThan(0);
    for (const control of result.controls) {
      expect(control.boxShadow, 'window-only shadow must not decorate promoted controls').toBe('none');
      expect(control.filter, 'window-only filter must not decorate promoted controls').toBe('none');
    }
    expect(result.windows, 'both scanner and imperative windows must really be promoted').toHaveLength(2);
    for (const window of result.windows) {
      expect(window.isWindowHost).toBe(true);
      expect(window.boxShadow, 'stretchable outer hosts must not cast window shadows').toBe('none');
      expect(window.part, 'actual chrome exposes its window part').not.toBeNull();
      expect(window.part.boxShadow, 'configured shadow reaches the actual chrome part').not.toBe('none');
    }
    if (result.native && 'disabled' in c.options) expect(result.native.disabled).toBe(c.options.disabled);
  }
}

async function assertKeyboardFocus(page, result) {
  const candidates = result.controls.filter(c => c.tabIndex >= 0 && c.ariaDisabled !== 'true');
  if (!candidates.length) return;
  const selector = candidates[0].selector;
  // Enter keyboard modality before focusing, rather than checking a mouse-only
  // pseudo-state or merely trusting tabIndex metadata.
  await page.keyboard.press('Tab');
  await page.locator(selector).focus();
  const focus = await page.locator(selector).evaluate(el => {
    const style = getComputedStyle(el);
    return { active: document.activeElement === el, visible: el.matches(':focus-visible'),
      outline: style.outlineStyle, width: parseFloat(style.outlineWidth), clip: style.clipPath };
  });
  expect(focus.active).toBe(true); expect(focus.visible).toBe(true);
  expect(focus.outline).not.toBe('none'); expect(focus.width).toBeGreaterThan(0);
  expect(focus.clip, 'focus must not be hidden by boot animation').toBe('none');
}

for (const { slug } of catalog) test(`${slug}: option contracts and source/built pixels`, async ({ browser, servers }, testInfo) => {
  const profile = testInfo.project.metadata.caseProfile ?? 'smoke';
  const cases = listCases({ profile }).sort((a, b) => (a.mode === 'declarative') - (b.mode === 'declarative'));
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: testInfo.project.use.deviceScaleFactor ?? 1 });
  const pages = { source: await context.newPage(), built: await context.newPage() };
  let activePage = pages.source, current, mode, result;
  const summary = [];
  try {
    for (const m of ['source', 'built']) await openHarness(pages[m], servers, m);
    const groupSizes = new Map();
    for (const c of cases) {
      current = c;
      const versions = {};
      for (mode of ['source', 'built']) {
        activePage = pages[mode];
        result = await activePage.evaluate(({ c, slug }) => window.controlMatrix.runCase(c, { slug }), { c, slug });
        assertOutput(result, c);
        versions[mode] = { status: result.status, pixels: await pixels(activePage, result.canvases) };
        if (c.mode === 'declarative' && result.canvases.length === 0) {
          versions[mode].domPng = (await activePage.locator(result.outputSelector).screenshot({ animations: 'disabled', caret: 'hide' })).toString('base64');
        }
        if (mode === 'built' && c.mode === 'declarative') await assertKeyboardFocus(activePage, result);
        if (['push', 'default', 'bevel'].includes(c.family) && c.labelKind !== 'empty' && result.status === 'rendered') {
          const key = `${mode}/${c.group}`;
          const geometry = result.canvases.map(({ width, height }) => ({ width, height }));
          if (groupSizes.has(key)) expect(geometry, `${c.group}: state changes preserve footprint`).toEqual(groupSizes.get(key));
          else groupSizes.set(key, geometry);
        }
      }
      expect(versions.built, `${c.id}: actual published entry preserves source pixels`).toEqual(versions.source);
      const { domPng, ...record } = versions.built;
      summary.push({ id: c.id, ...record, nativeScreenshotCompared: !!domPng });
    }
    // Keep a compact executed-case inventory even on success. It distinguishes
    // absent source art from an asserted fallback and exposes actual coverage.
    await testInfo.attach('coverage.json', { body: JSON.stringify({ slug, profile, cases: summary }), contentType: 'application/json' });
  } catch (error) {
    await attachCase(activePage, testInfo, { slug, profile, mode, case: current, result, completed: summary }, error);
    throw error;
  } finally {
    for (const page of Object.values(pages)) await page.evaluate(() => window.controlMatrix?.dispose()).catch(() => {});
    await context.close();
  }
});
