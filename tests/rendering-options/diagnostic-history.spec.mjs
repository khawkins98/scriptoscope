// Independent #459 regression: expected navigation state is literal test input.
// Intended location: tests/rendering-options/diagnostic-history.spec.mjs.
import { test, expect } from '@playwright/test';
import { createServer, preview } from 'vite';
import { createServer as reservePort } from 'node:net';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = process.env.SCRIPTOSCOPE_REVIEW_ROOT ?? fileURLToPath(new URL('../..', import.meta.url));
let source, production;
const bases = {};
async function freePort() {
  const server = reservePort();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
test.beforeAll(async () => {
  // test:rendering and test:package rebuild the library and can delete dist/demo.
  // Build the actual shipped demo once; never serve source as built parity.
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:demo'],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 << 20 });
  const sourcePort = await freePort();
  source = await createServer({ configFile: resolve(root, 'vite.config.js'), root: resolve(root, 'demo'),
    server: { host: '127.0.0.1', port: sourcePort, strictPort: true, open: false } });
  await source.listen();
  bases.source = `http://127.0.0.1:${sourcePort}/diagnostic.html`;
  const productionPort = await freePort();
  production = await preview({ configFile: resolve(root, 'vite.demo.config.js'), root: resolve(root, 'demo'),
    build: { outDir: resolve(root, 'dist/demo') },
    preview: { host: '127.0.0.1', port: productionPort, strictPort: true, open: false } });
  bases.production = `http://127.0.0.1:${productionPort}/scriptoscope/diagnostic.html`;
});
test.afterAll(async () => {
  await source?.close();
  if (production) await new Promise(resolve => production.httpServer.close(resolve));
});

const A = { theme: 'black-platinum', wt: 'no-title-utility-window', title: 'History A', w: '160', h: '90', state: 'active', scale: '2' };
const B = { theme: 'slimes', wt: 'collapsed-no-title-utility', title: 'History B', w: '180', h: '100', state: 'inactive', scale: '1' };
const C = { theme: 'floppies', wt: 'document-window', title: 'History C', w: '200', h: '110', state: 'active', scale: '2' };
const hash = state => new URLSearchParams(state).toString();
async function snapshot(page) {
  return page.evaluate(() => {
    const section = [...document.querySelectorAll('.theme-row')].find(e => e.querySelector('h2')?.textContent === 'Window playground');
    const url = new URL(location.href);
    return {
      query: url.searchParams.get('theme'), hash: Object.fromEntries(new URLSearchParams(url.hash.slice(1))),
      ribbon: document.querySelector('#ribbon .active')?.getAttribute('data-slug'),
      heading: document.querySelector('#detail h2')?.textContent,
      ribbonTitle: document.querySelector('#ribbon .active .ribbon-title')?.textContent,
      controls: section ? {
        wt: section.querySelectorAll('select')[0]?.value,
        title: section.querySelector('input[type=text]')?.value,
        w: section.querySelectorAll('input[type=number]')[0]?.value,
        h: section.querySelectorAll('input[type=number]')[1]?.value,
        state: section.querySelectorAll('select')[1]?.value,
        scale: section.querySelectorAll('select')[2]?.value,
      } : null,
      renderedTitle: section?.querySelector('.scriptoscope-window')?.getAttribute('aria-label'),
    };
  });
}
function expected(state) {
  const { theme, ...controls } = state;
  return { query: theme, hash: state, ribbon: theme, controls, renderedTitle: state.title };
}
function comparable(actual) {
  const { heading, ribbonTitle, ...rest } = actual;
  expect(heading, 'detail heading agrees with selected ribbon').toBe(ribbonTitle);
  return rest;
}
async function ready(page) {
  // Settle active work, without waiting for the desired target (which would
  // turn the missing-history-handler defect into a generic timeout).
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    const section = [...document.querySelectorAll('.theme-row')].find(e => e.querySelector('h2')?.textContent === 'Window playground');
    return document.querySelector('#detail h2') && section?.querySelector('.scriptoscope-window') &&
      !/loading…|failed to load|render error/i.test(document.querySelector('#detail').textContent) &&
      !/rendering…|render failed/.test(section.textContent);
  });
}
async function positive(page, state) {
  await ready(page);
  expect(comparable(await snapshot(page)), 'valid hash positive control').toEqual(expected(state));
}
async function traversal(page, direction) {
  await page.evaluate(direction => new Promise(resolve => {
    addEventListener('popstate', () => setTimeout(resolve, 0), { once: true });
    history[direction]();
  }), direction);
  await ready(page);
}
for (const mode of ['source', 'production']) {
  test(`${mode}: diagnostic Back and Forward restore URL theme and playground after query replacement`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(`${bases[mode]}?theme=1138#${hash(A)}`);
    expect(response.status(), 'valid diagnostic HTTP response').toBe(200);
    await positive(page, A);
    for (const state of [B, C]) {
      await page.evaluate(value => { location.hash = value; }, hash(state));
      await positive(page, state);
    }
    const observations = [];
    for (const [direction, state] of [['back', B], ['back', A], ['forward', B], ['forward', C]]) {
      await traversal(page, direction);
      observations.push({ direction, actual: comparable(await snapshot(page)), expected: expected(state) });
    }
    await info.attach('diagnostic-history.json', { body: JSON.stringify({ mode, observations, errors }, null, 2), contentType: 'application/json' });
    expect(errors, 'no product page errors during navigation').toEqual([]);
    expect(observations.map(row => ({ direction: row.direction, state: row.actual })),
      'DIAGNOSTIC_HISTORY_RESTORES_TARGET: settled Back/Forward must restore URL theme and every playground control')
      .toEqual(observations.map(row => ({ direction: row.direction, state: row.expected })));
  });

  test(`${mode}: delayed older theme cannot replace newest rapid hash target`, async ({ page }, info) => {
    const response = await page.goto(`${bases[mode]}?theme=1138#${hash(A)}`);
    expect(response.status()).toBe(200);
    await positive(page, A);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/themes/1984/scheme.*', async route => { await held; await route.continue(); });
    try {
      const requested = page.waitForRequest(request => /\/themes\/1984\/scheme\./.test(request.url()));
      await page.evaluate(() => { location.hash = 'theme=1984&title=Older'; });
      await requested;
      await page.evaluate(value => { location.hash = value; }, hash(B));
      // The older response is deliberately pending, so networkidle is not the
      // readiness signal for the newer positive control.
      await page.waitForFunction(() => document.querySelector('#ribbon .active')?.getAttribute('data-slug') === 'slimes' &&
        [...document.querySelectorAll('.theme-row input[type=text]')].some(e => e.value === 'History B'));
      const olderResponse = page.waitForResponse(response => /\/themes\/1984\/scheme\./.test(response.url()));
      release();
      await olderResponse;
      await positive(page, B);
      await info.attach('diagnostic-rapid.json', { body: JSON.stringify(await snapshot(page), null, 2), contentType: 'application/json' });
    } finally { release(); }
  });
}
