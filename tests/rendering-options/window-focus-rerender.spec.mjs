import { test as base, expect } from '@playwright/test';
import { startServers } from './servers.mjs';

const test = base.extend({ servers: [async ({}, use) => {
  const servers = await startServers();
  try { await use(servers); } finally { await servers.close(); }
}, { scope: 'worker' }] });

// #525: keyboard focus must survive the window re-render that the operated
// control itself triggers (activation of an inactive window, keyboard resize,
// collapse). Focus is identified by host + accessible name, never by element
// identity: the runtime may legitimately recreate the control. The page is
// larger than the viewport in both axes, so an arrow key that reaches <body>
// after a focus drop scrolls the page and the scroll assertion can fail.
// Two windows keep one inactive (#169 design: arrows keep nudging/resizing).
const STEP = 8;
const SLUG = 'windows-95';

async function setup(page, servers, mode) {
  await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
  await page.evaluate(async ({ mode, slug }) => {
    const css = document.createElement('link'); css.rel = 'stylesheet';
    css.href = mode === 'source' ? '/src/scriptoscope.css' : '/dist/scriptoscope.css';
    await new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const theme = await api.loadTheme(`/themes/${slug}`);
    document.body.innerHTML = '<div id="spacer" style="position:absolute;left:0;top:0;width:4000px;height:4000px"></div>'
      + '<input id="outside" aria-label="Outside field" style="position:absolute;left:20px;top:420px">';
    const manager = new api.WindowManager();
    const add = async (name, left) => {
      const content = document.createElement('p'); content.textContent = `${name} content`;
      const host = await manager.add(theme, { width: 240, height: 120, title: name }, {}, { contentEl: content });
      document.body.append(host);
      Object.assign(host.style, { position: 'absolute', left: `${left}px`, top: '60px' });
      return host;
    };
    // The first window added is active; B starts inactive.
    const A = await add('A', 20), B = await add('B', 320);
    window.focusFixture = { api, theme, manager, hosts: { A, B } };
    await document.fonts.ready;
  }, { mode, slug: SLUG });
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Observable state, by host + accessible name; settled = two frames after the last commit. */
const snapshot = (page, name) => page.evaluate(async name => {
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const f = window.focusFixture, host = f.hosts[name], d = f.manager.describe(host);
  const active = host.shadowRoot.activeElement;
  const winState = name => f.hosts[name].shadowRoot.querySelector('[data-scriptoscope-current-state]')?.dataset.scriptoscopeCurrentState;
  return {
    documentActive: document.activeElement === host ? `host ${name}` : (document.activeElement?.id || document.activeElement?.tagName),
    shadowActive: active ? `${active.tagName.toLowerCase()}:${active.getAttribute('aria-label') ?? ''}` : null,
    left: parseFloat(host.style.left), width: d.width, collapsed: d.collapsed,
    state: { A: winState('A'), B: winState('B') },
    scroll: { x: window.scrollX, y: window.scrollY },
  };
}, name);

const focusControl = async (page, name, label) => {
  const ok = await page.evaluate(({ name, label }) => {
    const host = window.focusFixture.hosts[name];
    const btn = [...host.shadowRoot.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === label);
    if (!btn) return false;
    btn.focus({ preventScroll: true });
    return host.shadowRoot.activeElement === btn;
  }, { name, label });
  expect(ok, `${name}: "${label}" exists and takes focus`).toBe(true);
};

for (const mode of ['source', 'built']) {
  test(`${mode}: ArrowRight ×3 on an inactive window's move handle keeps focus and moves 3 steps`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const start = await snapshot(page, 'B');
    expect(start.state, 'B starts inactive').toEqual({ A: 'active', B: 'inactive' });
    await focusControl(page, 'B', 'Move window');
    for (let n = 1; n <= 3; n++) {
      await page.keyboard.press('ArrowRight');
      // Wait for the activation re-render (B active, A inactive) before judging focus.
      await expect.poll(async () => (await snapshot(page, 'B')).state).toEqual({ A: 'inactive', B: 'active' });
      const s = await snapshot(page, 'B');
      expect({ documentActive: s.documentActive, shadowActive: s.shadowActive }, `after ArrowRight ${n}`)
        .toEqual({ documentActive: 'host B', shadowActive: 'button:Move window' });
      expect(s.left, `after ArrowRight ${n}`).toBe(start.left + n * STEP);
      expect(s.scroll, `after ArrowRight ${n}: page scroll`).toEqual(start.scroll);
    }
  });

  test(`${mode}: ArrowRight ×3 on the grow box keeps focus and resizes 3 steps`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const start = await snapshot(page, 'A');
    const chromeWidth = () => page.evaluate(() =>
      window.focusFixture.hosts.A.shadowRoot.querySelector('canvas.scriptoscope-chrome')?.width ?? 0);
    let painted = await chromeWidth();
    await focusControl(page, 'A', 'Resize window');
    for (let n = 1; n <= 3; n++) {
      await page.keyboard.press('ArrowRight');
      await expect.poll(async () => (await snapshot(page, 'A')).width, `width after ArrowRight ${n}`).toBe(start.width + n * STEP);
      // Judge focus only after the resize render has committed its wider chrome.
      await expect.poll(chromeWidth, `chrome repainted after ArrowRight ${n}`).toBe(painted + STEP);
      painted += STEP;
      const s = await snapshot(page, 'A');
      expect({ documentActive: s.documentActive, shadowActive: s.shadowActive }, `after ArrowRight ${n}`)
        .toEqual({ documentActive: 'host A', shadowActive: 'button:Resize window' });
      expect(s.scroll, `after ArrowRight ${n}: page scroll`).toEqual(start.scroll);
    }
  });

  test(`${mode}: Enter ×2 on Collapse collapses then re-expands and keeps focus`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const start = await snapshot(page, 'A');
    expect(start.collapsed).toBe(false);
    await focusControl(page, 'A', 'Collapse window');
    for (const [n, collapsed] of [[1, true], [2, false]]) {
      await page.keyboard.press('Enter');
      await expect.poll(async () => (await snapshot(page, 'A')).collapsed, `collapsed after Enter ${n}`).toBe(collapsed);
      const s = await snapshot(page, 'A');
      expect({ documentActive: s.documentActive, shadowActive: s.shadowActive }, `after Enter ${n}`)
        .toEqual({ documentActive: 'host A', shadowActive: 'button:Collapse window' });
      expect(s.scroll, `after Enter ${n}: page scroll`).toEqual(start.scroll);
    }
  });

  // Negative guard: a fix must restore focus only where it was. Re-rendering a
  // window that does not contain focus must leave focus where it is.
  test(`${mode}: re-rendering a window without focus does not move focus`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    await page.locator('#outside').focus();
    const where = () => page.evaluate(() => {
      const f = window.focusFixture, a = document.activeElement;
      return a === f.hosts.A || a === f.hosts.B
        ? `${a === f.hosts.A ? 'A' : 'B'}:${a.shadowRoot.activeElement?.getAttribute('aria-label') ?? ''}` : a?.id || a?.tagName;
    });
    // Public re-render paths: resize, persisted-state collapse/expand, whole-desktop retheme.
    await page.evaluate(async () => { const f = window.focusFixture; await f.manager.setContentSize(f.hosts.B, 264, 136); });
    expect(await where(), 'after setContentSize(B)').toBe('outside');
    await page.evaluate(async () => { const f = window.focusFixture; await f.manager.applyState(f.hosts.B, { collapsed: true }); await f.manager.applyState(f.hosts.B, { collapsed: false }); });
    expect(await where(), 'after applyState(B)').toBe('outside');
    await page.evaluate(async () => {
      const f = window.focusFixture, next = await f.api.loadTheme('/themes/1138');
      await f.manager.retheme(next); await f.manager.retheme(f.theme); next.dispose?.();
    });
    expect(await where(), 'after retheme').toBe('outside');
    // Focus inside window A is not pulled into B when B (which shares control names) re-renders.
    await focusControl(page, 'A', 'Move window');
    await page.evaluate(async () => { const f = window.focusFixture; await f.manager.setContentSize(f.hosts.B, 240, 120); });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    expect(await where(), 'A focus after setContentSize(B)').toBe('A:Move window');
    expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({ x: 0, y: 0 });
  });
}
