import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { expect } from '@playwright/test';
import { test as demoTest } from './demo-fixtures.mjs';
import { startServers } from './servers.mjs';

// #550, WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum): keyboard focus that
// enters a window activates and raises it, as the classic Mac keeps keyboard
// focus in the front window (WindowManager doc: "the active window is raised in
// z-order"). Without it, Tab lands on controls of a background window that a
// higher window fully covers. Visibility is judged by hit-testing sample points
// on the focused element (centre and corners): at least one must resolve to the
// focused element's own window. windows-95 draws wnd# recipe chrome; evolution
// was one of the issue's reproductions (title widgets and scrollbar obscured).
const SLUGS = ['windows-95', 'evolution'];

const test = demoTest.extend({
  servers: [async ({}, use) => {
    const servers = await startServers();
    try { await use(servers); } finally { await servers.close(); }
  }, { scope: 'worker' }],
  production: [async ({}, use) => {
    const base = resolve('dist/demo');
    const mime = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html', '.wasm': 'application/wasm', '.png': 'image/png' };
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/scriptoscope/')) throw Error('Outside demo');
        const file = resolve(base, '.' + decodeURIComponent(url.pathname.slice('/scriptoscope'.length)));
        if (!file.startsWith(base + sep) || !(await stat(file)).isFile()) throw Error('Not a file');
        res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      } catch { res.writeHead(404); res.end('Not found'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try { await use(`http://127.0.0.1:${server.address().port}/scriptoscope`); }
    finally { await new Promise(resolve => server.close(resolve)); }
  }, { scope: 'worker' }],
});

/** Installed in the page: waits (up to `ms`) for the focused element to be visible in its own window. */
const PROBE = `window.focusProbe = async (ms = 2000) => {
  const hostOf = e => { let x = e; while (x && !x.matches?.('[data-scriptoscope-window-host]')) x = x.parentElement ?? x.getRootNode().host; return x ?? null; };
  const label = e => e ? (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 40) || e.id || e.tagName) : null;
  const read = () => {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    if (!a || a === document.body) return { where: 'body' };
    const mine = hostOf(a);
    if (!mine) return { where: 'page', el: label(a) };
    const r = a.getBoundingClientRect();
    const pts = [[r.x + r.width / 2, r.y + r.height / 2], [r.x + 1, r.y + 1], [r.right - 1, r.y + 1], [r.x + 1, r.bottom - 1], [r.right - 1, r.bottom - 1]];
    const hits = pts.map(([x, y]) => hostOf(document.elementFromPoint(x, y)));
    const hosts = [...document.querySelectorAll('[data-scriptoscope-window-host]')];
    const z = h => Number(getComputedStyle(h).zIndex) || 0;
    const overlapping = hosts.filter(h => { const o = h.getBoundingClientRect(), m = mine.getBoundingClientRect();
      return h !== mine && o.left < m.right && m.left < o.right && o.top < m.bottom && m.top < o.bottom; });
    return {
      where: 'window', el: label(a), title: mine.shadowRoot?.querySelector('[aria-label]')?.getAttribute('aria-label'),
      visible: hits.some(h => h === mine),
      active: mine.shadowRoot?.querySelector('[data-scriptoscope-current-state]')?.dataset.scriptoscopeCurrentState,
      frontmost: overlapping.every(h => z(h) < z(mine)),
      rect: [r.x, r.y, r.width, r.height].map(Math.round),
      covers: [...new Set(hits.filter(h => h && h !== mine).map(h => h.className || h.id || 'host'))],
    };
  };
  const t0 = performance.now();
  for (;;) {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const s = read();
    if (s.where !== 'window' || (s.visible && s.active === 'active' && s.frontmost) || performance.now() - t0 > ms) return s;
  }
};`;

// ── Fixture: window A fully covers inactive window B ─────────────────────────
async function setup(page, servers, mode, slug) {
  await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
  await page.evaluate(async ({ mode, slug, probe }) => {
    (0, eval)(probe);
    const css = document.createElement('link'); css.rel = 'stylesheet';
    css.href = mode === 'source' ? '/src/scriptoscope.css' : '/dist/scriptoscope.css';
    await new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const theme = await api.loadTheme(`/themes/${slug}`);
    document.body.innerHTML = '<input id="before" aria-label="Before field">';
    const manager = new api.WindowManager();
    const commits = { A: 0, B: 0 }, churn = { A: [], B: [] };
    const add = async (name) => {
      const content = document.createElement('div');
      // Taller than the body, so the themed vertical scrollbar is a Tab stop too.
      content.innerHTML = `<a href="#${name}">${name} link</a>` + `<p>${name} content</p>`.repeat(12);
      Object.assign(content.style, { height: '100%', overflow: 'auto', boxSizing: 'border-box' });
      const host = await manager.add(theme, { width: 240, height: 120, title: name }, { onClose() {} }, { contentEl: content });
      document.body.append(host);
      // Same rect: A (active, above) hides B entirely.
      Object.assign(host.style, { position: 'absolute', left: '40px', top: '60px' });
      host.addEventListener('focusin', e => churn[name].push(`focusin:${e.composedPath()[0].getAttribute?.('aria-label') ?? e.composedPath()[0].textContent}`));
      host.addEventListener('focusout', e => churn[name].push(`focusout:${e.composedPath()[0].getAttribute?.('aria-label') ?? e.composedPath()[0].textContent}`));
      return host;
    };
    const A = await add('A'), B = await add('B');
    const after = document.createElement('input'); after.id = 'after'; after.setAttribute('aria-label', 'After field');
    Object.assign(after.style, { position: 'absolute', left: '40px', top: '400px' });
    document.body.append(after);
    manager.setChangeListener(host => { commits[host === A ? 'A' : 'B']++; });
    const settle = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const control = (name, label) => [...window.raiseFixture.hosts[name].shadowRoot.querySelectorAll('button, [role=scrollbar]')]
      .find(el => el.getAttribute('aria-label') === label) ?? null;
    window.raiseFixture = { api, theme, manager, hosts: { A, B }, commits, churn, settle, control };
    await document.fonts.ready;
    await settle();
  }, { mode, slug, probe: PROBE });
}

const where = page => page.evaluate(async () => {
  const f = window.raiseFixture; await f.settle();
  const a = document.activeElement, name = a === f.hosts.A ? 'A' : a === f.hosts.B ? 'B' : null;
  if (!name) return a.closest?.('[data-scriptoscope-window-host]') === f.hosts.A ? 'A:' + a.textContent
    : a.closest?.('[data-scriptoscope-window-host]') === f.hosts.B ? 'B:' + a.textContent : a.id || a.tagName;
  return `${name}:${a.shadowRoot.activeElement?.getAttribute('aria-label') ?? ''}`;
});
const winState = page => page.evaluate(() => {
  const f = window.raiseFixture, s = n => f.hosts[n].shadowRoot.querySelector('[data-scriptoscope-current-state]')?.dataset.scriptoscopeCurrentState;
  return { A: s('A'), B: s('B') };
});
const resetCounters = page => page.evaluate(() => {
  const f = window.raiseFixture; f.commits.A = f.commits.B = 0; f.churn.A.length = f.churn.B.length = 0;
});

/** Tab (or Shift+Tab) from `from` to `to`, asserting every window stop is visible, active and frontmost. */
async function walk(page, from, to, key) {
  await page.locator(`#${from}`).focus();
  const stops = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press(key);
    const s = await page.evaluate(() => window.focusProbe());
    if (s.where !== 'window') { expect(await where(page), `${key} walk ends on #${to}`).toBe(to); return stops; }
    stops.push(`${s.title}:${s.el}`);
    expect({ visible: s.visible, active: s.active, frontmost: s.frontmost }, `${key} stop ${i}: ${s.title} "${s.el}" ${JSON.stringify(s)}`)
      .toEqual({ visible: true, active: 'active', frontmost: true });
  }
  throw new Error(`${key} walk never reached #${to}`);
}

for (const mode of ['source', 'built']) for (const slug of SLUGS) {
  test(`${mode} ${slug}: Tab into a covered window activates and raises it at every stop`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    expect(await winState(page)).toEqual({ A: 'active', B: 'inactive' });
    const stops = await walk(page, 'before', 'after', 'Tab');
    // The walk really crossed into B: its link and its chrome controls were stops.
    expect(stops).toEqual(expect.arrayContaining(['B:B link', 'B:Move window', 'B:Resize window']));
    expect(await winState(page)).toEqual({ A: 'inactive', B: 'active' });
  });

  test(`${mode} ${slug}: Shift+Tab backwards activates each window it enters`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    const stops = await walk(page, 'after', 'before', 'Shift+Tab');
    expect(stops).toEqual(expect.arrayContaining(['B:Resize window', 'A:Resize window', 'A:A link']));
    expect(await winState(page)).toEqual({ A: 'active', B: 'inactive' });
  });

  test(`${mode} ${slug}: a focused chrome control keeps focus through one activation render, no focusin loop`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    // Shift+Tab from the trailing field lands on B's last chrome control, its themed scrollbar
    // (re-wired on every render, so the most exposed control).
    await page.locator('#after').focus();
    await resetCounters(page);
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => winState(page)).toEqual({ A: 'inactive', B: 'active' });
    // Let any echo of the activation (a re-focus, a second render) surface.
    for (let i = 0; i < 5; i++) await page.evaluate(() => window.raiseFixture.settle());
    expect(await where(page)).toBe('B:Scroll content vertically');
    const after = await page.evaluate(() => { const f = window.raiseFixture; return { commits: { ...f.commits }, churn: { A: [...f.churn.A], B: [...f.churn.B] } }; });
    expect(after.commits, 'one render per window whose state flipped').toEqual({ A: 1, B: 1 });
    expect(after.churn, 'focus entered B once and never bounced').toEqual({ A: [], B: ['focusin:Scroll content vertically'] });

    // Script focus (as assistive technology moves it) onto A's move handle: same contract.
    await resetCounters(page);
    expect(await page.evaluate(() => { const el = window.raiseFixture.control('A', 'Move window'); el.focus(); return window.raiseFixture.hosts.A.shadowRoot.activeElement === el; })).toBe(true);
    await expect.poll(() => winState(page)).toEqual({ A: 'active', B: 'inactive' });
    for (let i = 0; i < 5; i++) await page.evaluate(() => window.raiseFixture.settle());
    expect(await where(page)).toBe('A:Move window');
    const back = await page.evaluate(() => { const f = window.raiseFixture; return { commits: { ...f.commits }, churn: { A: [...f.churn.A], B: [...f.churn.B] } }; });
    expect(back.commits).toEqual({ A: 1, B: 1 });
    expect(back.churn).toEqual({ A: ['focusin:Move window'], B: ['focusout:Scroll content vertically'] });
    // Moving focus within the active window raises nothing and renders nothing.
    await resetCounters(page);
    await page.keyboard.press('Tab');
    for (let i = 0; i < 3; i++) await page.evaluate(() => window.raiseFixture.settle());
    expect(await where(page)).toBe('A:Resize window');
    expect(await page.evaluate(() => ({ ...window.raiseFixture.commits }))).toEqual({ A: 0, B: 0 });
  });

  test(`${mode} ${slug}: raising never moves or resizes the window`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    const geometry = () => page.evaluate(() => {
      const f = window.raiseFixture;
      return Object.fromEntries(Object.entries(f.hosts).map(([n, h]) => [n, { left: h.style.left, top: h.style.top, position: h.style.position, w: h.offsetWidth, h: h.offsetHeight }]));
    });
    const g0 = await geometry();
    await walk(page, 'before', 'after', 'Tab');
    expect(await geometry()).toEqual(g0);
  });

  test(`${mode} ${slug}: programmatic activation does not take focus from page content`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    await page.locator('#before').focus();
    await resetCounters(page);
    // The manager's internal activation (#535 contract) and a synthetic pointerdown on the host.
    await page.evaluate(async () => {
      const f = window.raiseFixture, entry = f.manager.windows.find(w => w.host === f.hosts.B);
      await f.manager.focus(entry);
    });
    expect(await winState(page)).toEqual({ A: 'inactive', B: 'active' });
    expect(await where(page)).toBe('before');
    await page.evaluate(() => { window.raiseFixture.hosts.A.dispatchEvent(new PointerEvent('pointerdown')); });
    await expect.poll(() => winState(page)).toEqual({ A: 'active', B: 'inactive' });
    expect(await where(page)).toBe('before');
    expect(await page.evaluate(() => window.raiseFixture.churn)).toEqual({ A: [], B: [] });
  });
}

// ── The built showcase: every Tab stop is at least partly visible ────────────
for (const mode of ['source', 'production']) for (const slug of SLUGS) for (const width of [1280, 390]) {
  test(`${mode} showcase ${slug} @${width}: every Tab stop inside a window hit-tests to its own window`, async ({ page, demo, production }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${mode === 'source' ? demo : production}/showcase.html?theme=${slug}`);
    await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
    await page.evaluate(PROBE);
    await page.evaluate(() => document.fonts.ready);
    const failures = [];
    let windowStops = 0, first = null;
    for (let i = 0; i < 400; i++) {
      await page.keyboard.press('Tab');
      const s = await page.evaluate(() => window.focusProbe(1500));
      const id = `${s.where}:${s.title ?? ''}:${s.el ?? ''}`;
      if (i > 0 && (s.where === 'body' || id === first)) break; // wrapped to the top
      first ??= id;
      if (s.where !== 'window') continue;
      windowStops++;
      if (!s.visible || s.active !== 'active' || !s.frontmost) failures.push(`stop ${i}: ${JSON.stringify(s)}`);
    }
    // The walk reached the windows (the section 02 cascade alone has dozens of stops).
    expect(windowStops).toBeGreaterThan(20);
    expect(failures, 'Tab stops obscured, inactive or not frontmost').toEqual([]);
  });
}
