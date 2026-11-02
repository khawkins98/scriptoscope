// #621 region reuse stays observationally equivalent to rebuilding (HP15/20/22).
// Build counts are report-only: HP20 permits, but does not require, cache hits.
import { test, expect, MODES, boot, fixture, hitAt, settle } from './frame-pass-through-fixture.mjs';

for (const mode of MODES) test(`${mode}: HPT45 reusable regions preserve box preparation and distinguish templates sharing a theme name`, async ({ page, servers }, info) => {
  await boot(page, servers, mode);
  await page.evaluate(async () => { const f = window.__fpt; f.manager(); await f.add('A', { slug: 'dolphin-som', hit: 'box' }); });
  const original = await fixture(page, 'A');
  const rows = [];
  const snapshot = () => page.evaluate(() => { const f = window.__fpt; return { builds: f.builds().length, path: f.layers('A').L2.style.clipPath, state: f.state('A') }; });
  const first = await snapshot();
  await page.evaluate(async () => { const f = window.__fpt; await f.hosts.A.m.applyState(f.hosts.A.host, { hit: 'region' }); });
  const switched = await snapshot();
  expect(switched.builds, 'box-to-region consumes the prepared region synchronously').toBe(first.builds);
  expect(switched.path).toMatch(/^path\(/);
  expect(await hitAt(page, original.vp.p_out)).toBe('sentinel');
  expect(await hitAt(page, original.vp.p_in)).toMatch(/:A$/);
  // Explicit re-renders with identical region inputs. Preserve exact path and
  // decoded hit behavior whether implemented with reuse or fresh preparation.
  for (let i = 0; i < 3; i++) {
    await page.evaluate(async () => { const f = window.__fpt; await f.hosts.A.m.retheme(await f.theme('dolphin-som')); });
    const next = await snapshot();
    expect(next.path, 'unchanged region inputs preserve the filled set').toBe(switched.path);
    rows.push({ action: 'same-theme', iteration: i, builds: next.builds });
  }
  await page.evaluate(async () => {
    const f = window.__fpt;
    const replacement = await f.synth('dolphin-som', ['document-window'], rgba => { for (let i = 3; i < rgba.length; i += 4) rgba[i] = 0; });
    window.__cacheReplacement = replacement;
    window.__cacheThemeNames = [replacement.theme.baseUrl, (await f.theme('dolphin-som')).baseUrl];
    await f.hosts.A.m.retheme(replacement.theme);
    f.hosts.A.synthetic = replacement.synthetic;
  });
  expect(await page.evaluate(() => window.__cacheThemeNames[0] === window.__cacheThemeNames[1]), 'fixture deliberately shares nominal theme identity').toBe(true);
  const transparent = await snapshot();
  expect(transparent.path, 'new template invalidates a reused path').not.toBe(switched.path);
  expect(await hitAt(page, original.vp.p_in), 'the replacement mask excludes the formerly solid frame point').toBe('sentinel');
  const content = original.vp.p_c;
  expect(await hitAt(page, content), 'solid content stays included with an empty frame template').toMatch(/:A$/);
  rows.push({ action: 'same-name-new-template', builds: transparent.builds });
  await page.evaluate(async () => { const f = window.__fpt; await f.hosts.A.m.retheme(await f.theme('dolphin-som')); delete f.hosts.A.synthetic; });
  expect((await snapshot()).path, 'restoring the template restores its own path').toBe(switched.path);
  // Changed geometry must prepare a new region even after repeated cache hits.
  await page.evaluate(async () => { const f = window.__fpt; await f.hosts.A.m.setContentSize(f.hosts.A.host, 367, 239); });
  await settle(page);
  const grown = await fixture(page, 'A');
  expect(grown.W).toBeGreaterThan(original.W);
  expect(await hitAt(page, grown.vp.p_out)).toBe('sentinel');
  expect(await hitAt(page, grown.vp.p_in)).toMatch(/:A$/);
  expect((await snapshot()).path).not.toBe(switched.path);
  rows.push({ action: 'new-size', builds: (await snapshot()).builds });
  await info.attach('hpt45-region-reuse.json', { body: JSON.stringify({ mode, rows }), contentType: 'application/json' });
});
