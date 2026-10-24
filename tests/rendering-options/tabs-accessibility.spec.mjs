import { test, expect } from '@playwright/test';
import { startServers } from './servers.mjs';

// Public-consumer regression using the repository's separate source/built
// transports. No preexisting preview server, fixtures or pixel goldens needed.
let servers;
test.beforeAll(async () => { servers = await startServers(); });
test.afterAll(async () => { await servers?.close(); });

for (const mode of ['source', 'built']) {
test(`${mode}: tabs keep semantic ownership, native identity and keyboard selection through retheme`, async ({ page }) => {
  const base = servers[mode];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/tabs-accessibility-fixture.html', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><title>Tab accessibility fixture</title><main id="fixture"></main></html>',
  }));
  await page.goto(new URL('/tabs-accessibility-fixture.html', base).href);
  await page.evaluate(async ({ runtimeUrl, themeUrl }) => {
    const api = await import(runtimeUrl);
    const root = document.getElementById('fixture');
    root.innerHTML = `<div id="fixture-tabs" data-scriptoscope-tabs aria-label="Example settings">
      <button type="button" data-scriptoscope-tab="one" data-scriptoscope-selected>One</button>
      <button type="button" data-scriptoscope-tab="two">Two</button>
      <button type="button" data-scriptoscope-tab="three">Three</button>
      <div data-scriptoscope-panel="one">First panel</div>
      <div data-scriptoscope-panel="two">Second panel</div>
      <div data-scriptoscope-panel="three">Third panel</div>
    </div>`;
    const native = [...root.querySelectorAll('button')];
    let clicks = 0;
    native[0].addEventListener('click', () => { clicks += 1; });
    const handle = await api.mountDeclarative({ root, pageThemeDefault: themeUrl,
      themes: [{ slug: '1138', source: 'scheme.rsrc' }], bootAffordance: 'none', rejectOnEmptyMount: true });
    const empty = { baseUrl: new URL('no-tab-assets/', location.href).href,
      manifest: { name: 'Explicit empty theme', windowTypes: {}, chromeElements: {}, patterns: {} } };
    handle.registerTheme('empty-tabs', empty);
    window.tabsFixture = { api, root, native, handle, empty, clicks: () => clicks, themeUrl };
  }, { runtimeUrl: new URL(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js', base).href,
    themeUrl: new URL('/themes/1138', base).href });

  const tabs = page.getByRole('tablist', { name: 'Example settings' });
  const assertStructure = async () => {
    await expect(tabs).toHaveCount(1);
    await expect(tabs.getByRole('tab')).toHaveCount(3);
    await expect(tabs.getByRole('tabpanel')).toHaveCount(0);
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    expect(await page.evaluate(() => {
      const { root, native } = window.tabsFixture;
      const ids = [...root.querySelectorAll('[id]')].map(el => el.id);
      return new Set(ids).size === ids.length && native.every(el => el.isConnected)
        && [...root.querySelectorAll('[role=tabpanel]')].every(el => !el.closest('[role=tablist]'));
    })).toBe(true);
  };
  await assertStructure();
  await tabs.getByRole('tab', { name: 'One', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tabpanel')).toHaveText('Second panel');
  await page.keyboard.press('End');
  await expect(page.getByRole('tabpanel')).toHaveText('Third panel');

  // Exercise both resource-present and explicit no-resource themes repeatedly.
  for (const ref of ['empty-tabs', 'original', 'empty-tabs', 'original']) {
    await page.evaluate(async ref => {
      const fixture = window.tabsFixture;
      await fixture.handle.retheme(ref === 'original' ? fixture.themeUrl : ref);
    }, ref);
    await assertStructure();
    await expect(tabs.getByRole('tab', { name: 'Three', exact: true })).toBeFocused();
    await expect(page.getByRole('tabpanel')).toHaveText('Third panel');
  }
  await page.evaluate(() => window.tabsFixture.handle.retheme('empty-tabs'));
  await tabs.getByRole('tab', { name: 'One', exact: true }).click();
  await expect(page.getByRole('tabpanel')).toHaveText('First panel');
  expect(await page.evaluate(() => window.tabsFixture.clicks())).toBe(1);
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await expect(page.getByRole('tabpanel')).toHaveText('First panel');

  // Aborted replacement must not mutate the committed semantic strip.
  expect(await page.evaluate(async () => {
    const { api, root, empty } = window.tabsFixture;
    const before = root.innerHTML;
    const controller = new AbortController();
    controller.abort();
    await api.promoteTabs(root.querySelector('[data-scriptoscope-tabs]'), empty,
      { forceRescan: true, signal: controller.signal });
    return before === root.innerHTML;
  })).toBe(true);
  await page.evaluate(() => {
    window.tabsFixture.handle.disconnect();
    window.tabsFixture.handle.disconnect();
  });
  // Existing disconnect retains promoted tabs; this test claims no new teardown
  // contract, but requires native nodes and valid ownership to survive.
  await assertStructure();
  expect(errors).toEqual([]);
});
}
