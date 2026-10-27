import { test as base, expect } from '@playwright/test';
import { startServers } from './servers.mjs';
const test = base.extend({ servers: [async ({}, use) => {
  const servers = await startServers(); try { await use(servers); } finally { await servers.close(); }
}, { scope: 'worker' }] });

for (const mode of ['source', 'built']) test(`${mode}: committed select stays synchronized until explicit abort and restore`, async ({ page, servers }) => {
  await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
  try {
    await page.evaluate(async mode => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const resolver = api.createOwnedThemeResolver({ themeBaseUrl: '/themes', themes: [{ slug: '1138', source: 'scheme.rsrc' }] });
      const theme = await resolver.load('1138'), source = document.createElement('select');
      source.innerHTML = '<option value="A">A</option><option value="B">B</option>'; document.body.append(source);
      const f = window.committedSelect = { api, resolver, source, life: new AbortController(), canCommit: true };
      f.face = await api.promoteGuardedControl(source, theme, f.life.signal, () => f.canCommit);
      if (!f.face) throw new Error('Independent committed-select setup did not attach');
      f.face.id = 'committed-select-face';
    }, mode);
    await expect(page.locator('#committed-select-face .scriptoscope-button')).toHaveAttribute('aria-label', /^A(?:\s|$)/);
    await page.evaluate(() => {
      const f = window.committedSelect;
      f.canCommit = false;
      f.source.value = 'B'; f.source.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.locator('#committed-select-face .scriptoscope-button')).toHaveAttribute('aria-label', /^B(?:\s|$)/, { timeout: 3000 });
    expect(await page.evaluate(() => {
      const f = window.committedSelect;
      return { live: !f.life.signal.aborted, connected: f.face.isConnected, native: f.source.isConnected, value: f.source.value };
    })).toEqual({ live: true, connected: true, native: true, value: 'B' });
  } finally {
    await page.evaluate(() => {
      const f = window.committedSelect; if (!f) return;
      f.life.abort(); f.api.restoreControl(f.source); f.resolver.dispose(); f.source.remove();
    }).catch(() => {});
  }
});
