// #459 browser contract. Expected slugs/state are literals supplied by the test;
// no selector, hash parser or activation helper is imported from the runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createServer as reservePort } from 'node:net';
import { fileURLToPath } from 'node:url';

let server, browser, base;
test.before(async () => {
  const reservation = reservePort();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const root = fileURLToPath(new URL('../..', import.meta.url));
  server = await createServer({ configFile: `${root}/vite.config.js`, root: `${root}/demo`,
    server: { host: '127.0.0.1', port, strictPort: true, open: false } });
  await server.listen();
  base = server.resolvedUrls.local[0];
  browser = await chromium.launch();
});
test.after(async () => { await browser?.close(); await server?.close(); });

const mutation = process.env.SCRIPTOSCOPE_459_MUTATION;
const fault = process.env.SCRIPTOSCOPE_459_HARNESS_FAULT;
const evidence = new WeakMap();
async function pageFor(t, suffix) {
  const page = await browser.newPage();
  const receipt = { mutation, applications: 0, resources: [], navigations: 0,
    routeErrors: [], navigationErrors: [], pageErrors: [], requestErrors: [], selectedFailure: null };
  evidence.set(page, receipt);
  page.on('pageerror', error => receipt.pageErrors.push(error.message));
  page.on('requestfailed', request => receipt.requestErrors.push(`${request.url()}: ${request.failure()?.errorText}`));
  t.after(async () => {
    await page.close();
    if (mutation) t.diagnostic(`459-browser-receipt ${Buffer.from(JSON.stringify(receipt)).toString('base64')}`);
    assert.deepEqual(receipt.routeErrors, [], 'no route exceptions');
    assert.deepEqual(receipt.navigationErrors, [], 'navigation completed');
    assert.deepEqual(receipt.pageErrors, [], 'no uncaught diagnostic errors');
    assert.deepEqual(receipt.requestErrors, [], 'no failed diagnostic requests');
    if (['initial-hash', 'hashchange'].includes(mutation)) {
      assert.equal(receipt.applications, 1, 'hash selection mutation must apply exactly once');
    }
  });
  if (['initial-hash', 'hashchange'].includes(mutation)) {
    // Vite extracts the inline module into this proxy. The HTML is not the
    // executable source; responses without the exact target pass through.
    await page.route('**/diagnostic.html?html-proxy*', async route => {
      try {
        if (fault === 'route-error') throw new Error('injected route exception');
        const response = await route.fetch();
        const original = await response.text();
        const target = mutation === 'initial-hash'
          ? 'st?.theme ?? (themeBySlug.has(want)'
          : 'if (st) activate(st.theme, st);';
        const replacement = mutation === 'initial-hash'
          ? 'null ?? (themeBySlug.has(want)'
          : 'if (false) activate(st.theme, st);';
        const count = original.split(target).length - 1;
        if (!count || fault === 'unapplied') {
          await route.fulfill({ response });
          return;
        }
        assert.equal(count, 1, 'exactly one source target in the JavaScript resource');
        receipt.applications += count;
        receipt.resources.push(route.request().url());
        await route.fulfill({ response, body: original.replace(target, replacement) });
      } catch (error) {
        receipt.routeErrors.push(error.message);
        await route.abort();
      }
    });
  }
  if (fault === 'navigation') await page.route(url => url.pathname === '/diagnostic.html' && !url.searchParams.has('html-proxy'), route => route.abort('failed'));
  try {
    const response = await page.goto(`${base}diagnostic.html${suffix}`);
    assert.equal(response?.status(), 200, 'diagnostic navigation returns HTTP 200');
    receipt.navigations++;
  } catch (error) {
    receipt.navigationErrors.push(error.message);
    throw error;
  }
  if (fault === 'unrelated') assert.fail('injected unrelated assertion');
  return page;
}
const playground = page => page.locator('.theme-row').filter({ has: page.getByRole('heading', { name: 'Window playground', exact: true }) });
async function selected(page, slug, title) {
  try {
    await page.waitForFunction(({ slug, title }) => {
      const section = [...document.querySelectorAll('.theme-row')].find(s => s.querySelector('h2')?.textContent === 'Window playground');
      return document.querySelector('#ribbon .active')?.getAttribute('data-slug') === slug &&
        document.querySelector('#detail h2') && !/loading|failed|render error/i.test(document.querySelector('#detail').textContent) &&
        section?.querySelector('input[type=text]')?.value === title &&
        section?.querySelector('.scriptoscope-window') && !/rendering…|render failed|failed to load/.test(section.textContent);
    }, { slug, title }, { timeout: mutation ? 5_000 : 30_000 });
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
    const actual = await page.evaluate(() => document.querySelector('#ribbon .active')?.getAttribute('data-slug') ?? null);
    // Only a wrong selected theme becomes this assertion. A rendering timeout
    // with the correct theme remains an unrelated failure.
    if (actual !== slug) {
      evidence.get(page).selectedFailure = { expected: slug, actual };
      assert.equal(actual, slug, `selected-theme contract: expected ${slug}`);
    }
    throw error;
  }
  const detail = await page.locator('#detail h2').first().textContent();
  const label = await page.locator(`#ribbon [data-slug="${slug}"] .ribbon-title`).textContent();
  assert.equal(detail, label, 'detail header agrees with selected ribbon');
  assert.equal(new URL(page.url()).searchParams.get('theme'), slug, 'query selection agrees');
}
async function controls(page) {
  return playground(page).evaluate(section => ({
    title: section.querySelector('input[type=text]').value,
    dimensions: [...section.querySelectorAll('input[type=number]')].map(el => el.value),
    selects: [...section.querySelectorAll('select')].map(el => el.value),
    windowTitle: section.querySelector('.scriptoscope-window')?.getAttribute('aria-label'),
  }));
}

test('initial valid hash overrides query and restores rendered playground controls', async t => {
  const page = await pageFor(t, '?theme=1138#theme=beos-r503&wt=document-window&title=Hash+receipt&w=180&h=110&state=inactive&scale=2');
  await selected(page, 'beos-r503', 'Hash receipt');
  const state = await controls(page);
  assert.deepEqual(state.dimensions, ['180', '110']);
  assert.deepEqual(state.selects, ['document-window', 'inactive', '2']);
  assert.equal(state.windowTitle, 'Hash receipt');
  await page.reload();
  await selected(page, 'beos-r503', 'Hash receipt');
});

test('hashchange switches the selected theme and invalid hashes or anchors preserve it', async t => {
  const page = await pageFor(t, '?theme=1138');
  await selected(page, '1138', 'Hello!');
  await page.evaluate(() => { location.hash = 'theme=windows-95&title=Changed&w=190&h=130&state=inactive&scale=3'; });
  await selected(page, 'windows-95', 'Changed');
  const before = await controls(page);
  for (const hash of ['theme=not-a-theme&title=BAD&w=NaN', 'd-controls', 'theme=%E0%A4%A&state=invalid']) {
    await page.evaluate(hash => { location.hash = hash; }, hash);
    // Event-turn barrier, not a fixed rendering delay.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('#ribbon .active').getAttribute('data-slug'), 'windows-95');
    assert.deepEqual(await controls(page), before);
  }
});

test('query fallback survives unknown initial hash and invalid control values stay usable', async t => {
  const page = await pageFor(t, '?theme=windows-95#theme=unknown&title=BAD');
  await selected(page, 'windows-95', 'Hello!');
  await page.evaluate(() => { location.hash = 'theme=windows-95&wt=missing&title=Safe&w=Infinity&h=-20&state=bad&scale=99'; });
  await selected(page, 'windows-95', 'Safe');
  const state = await controls(page);
  assert.deepEqual(state.dimensions, ['150', '98']);
  assert.deepEqual(state.selects, ['document-window', 'active', '1']);
  await page.evaluate(() => { location.hash = 'theme=windows-95&title=Clamped&w=99999&h=1'; });
  await selected(page, 'windows-95', 'Clamped');
  assert.deepEqual((await controls(page)).dimensions, ['600', '30']);
});

test('unknown query and section anchor fall back to the first catalog theme', async t => {
  const page = await pageFor(t, '?theme=unknown#d-controls');
  await selected(page, '1138', 'Hello!');
});

test('rapid switching keeps the newest hash after an older source response finishes', async t => {
  const page = await pageFor(t, '?theme=1138');
  await selected(page, '1138', 'Hello!');
  let release, requested;
  const held = new Promise(resolve => { release = resolve; });
  const seen = new Promise(resolve => { requested = resolve; });
  await page.route('**/themes/beos-r503/scheme.*', async route => { requested(); await held; await route.continue(); });
  t.after(() => release());
  await page.evaluate(() => { location.hash = 'theme=beos-r503&title=Stale'; });
  await seen;
  await page.evaluate(() => { location.hash = 'theme=windows-95&title=Newest&w=175&h=105'; });
  await selected(page, 'windows-95', 'Newest');
  const before = await controls(page);
  const response = page.waitForResponse(r => /\/themes\/beos-r503\/scheme\./.test(r.url()));
  release();
  await response;
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('#ribbon .active').getAttribute('data-slug'), 'windows-95');
  assert.deepEqual(await controls(page), before, 'older completion cannot overwrite new controls or rendered title');
  assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('theme'), 'windows-95');
});
