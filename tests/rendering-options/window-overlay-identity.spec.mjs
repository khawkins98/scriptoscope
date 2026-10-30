import { test as base, expect } from '@playwright/test';
import { startServers } from './servers.mjs';

const test = base.extend({ servers: [async ({}, use) => {
  const servers = await startServers();
  try { await use(servers); } finally { await servers.close(); }
}, { scope: 'worker' }] });

// #533: the shadow-DOM overlay controls (title widgets, move handle, grow box,
// themed scrollbars) keep their DOM identity across every WindowManager
// re-render, like the pooled chrome canvas. A rebuilt control makes assistive
// technology re-announce it on each keyboard step, and anything focus-based
// has to be patched back. Identity is checked by a marker property set on the
// element before the re-render; focus churn by counting focusout/focusin on
// each window's shadow root. Pointer activation of another window moves focus
// into that window (N4). windows-95 draws wnd# recipe chrome; platinum-8 draws
// the procedural kDEF 0 frame, whose grow-box art canvas shares the class name.
const STEP = 8;
const SLUGS = ['windows-95', 'platinum-8'];
const LABELS = ['Close window', 'Zoom window', 'Collapse window', 'Move window', 'Resize window'];

async function setup(page, servers, mode, slug) {
  await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
  await page.evaluate(async ({ mode, slug }) => {
    const css = document.createElement('link'); css.rel = 'stylesheet';
    css.href = mode === 'source' ? '/src/scriptoscope.css' : '/dist/scriptoscope.css';
    await new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const theme = await api.loadTheme(`/themes/${slug}`);
    document.body.innerHTML = '<div style="position:absolute;left:0;top:0;width:4000px;height:4000px"></div>';
    const manager = new api.WindowManager();
    const churn = { A: [], B: [] };
    const add = async (name, left) => {
      const content = document.createElement('div');
      // Taller than the declared body, so the themed vertical scrollbar is wired.
      content.innerHTML = `<p>${name} content</p>`.repeat(12);
      Object.assign(content.style, { height: '100%', overflow: 'auto', boxSizing: 'border-box' });
      const host = await manager.add(theme, { width: 240, height: 120, title: name }, { onClose() {} }, { contentEl: content });
      document.body.append(host);
      Object.assign(host.style, { position: 'absolute', left: `${left}px`, top: '60px' });
      for (const type of ['focusin', 'focusout'])
        host.shadowRoot.addEventListener(type, e => churn[name].push(`${type}:${e.target.getAttribute('aria-label')}`));
      return host;
    };
    const A = await add('A', 20), B = await add('B', 340);
    const settle = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const control = (name, label) => [...window.overlayFixture.hosts[name].shadowRoot.querySelectorAll(':not(canvas)')]
      .find(el => el.getAttribute('aria-label') === label) ?? null;
    window.overlayFixture = { api, theme, manager, hosts: { A, B }, churn, settle, control };
    await document.fonts.ready;
    await settle();
  }, { mode, slug });
}

/** Mark every overlay control of `name` so a later `identity()` can tell reuse from rebuild. */
const mark = (page, name) => page.evaluate(name => {
  const f = window.overlayFixture;
  for (const el of f.hosts[name].shadowRoot.querySelectorAll('button, [role=scrollbar]'))
    el.__overlayMark = el.getAttribute('aria-label');
  f.churn.A.length = 0; f.churn.B.length = 0;
}, name);

/** Per control label: 'same' (marked element still mounted), 'new' (unmarked), or count when duplicated. */
const identity = (page, name) => page.evaluate(async name => {
  const f = window.overlayFixture;
  await f.settle();
  const out = {};
  for (const el of f.hosts[name].shadowRoot.querySelectorAll('button, [role=scrollbar]')) {
    const label = el.getAttribute('aria-label');
    out[label] = label in out ? 'duplicate' : el.__overlayMark === label ? 'same' : 'new';
  }
  return out;
}, name);

const focusState = (page) => page.evaluate(async () => {
  const f = window.overlayFixture;
  await f.settle();
  const a = document.activeElement, name = a === f.hosts.A ? 'A' : a === f.hosts.B ? 'B' : null;
  const inner = name ? a.shadowRoot.activeElement : null;
  return {
    where: name ? `${name}:${inner?.getAttribute('aria-label') ?? ''}` : a?.tagName,
    marked: inner ? inner.__overlayMark === inner.getAttribute('aria-label') : null,
    focusVisible: inner ? inner.matches(':focus-visible') : null,
  };
});

const focus = (page, name, label) => page.evaluate(({ name, label }) => {
  const el = window.overlayFixture.control(name, label);
  el.focus({ preventScroll: true });
  return window.overlayFixture.hosts[name].shadowRoot.activeElement === el;
}, { name, label });

const state = (page, name) => page.evaluate(name => {
  const f = window.overlayFixture, d = f.manager.describe(f.hosts[name]);
  return { width: d.width, height: d.height, collapsed: d.collapsed, left: parseFloat(f.hosts[name].style.left),
    active: f.hosts[name].shadowRoot.querySelector('[data-scriptoscope-current-state]')?.dataset.scriptoscopeCurrentState };
}, name);

const churn = (page, name) => page.evaluate(name => [...window.overlayFixture.churn[name]], name);

for (const mode of ['source', 'built']) for (const slug of SLUGS) {
  test(`${mode} ${slug}: every overlay control keeps its identity across re-render paths`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    const start = await identity(page, 'A');
    // Precondition: the fixture really has every overlay control, once each.
    for (const label of [...LABELS, 'Scroll content vertically']) expect(start[label], `A has ${label}`).toBeDefined();
    const all = Object.fromEntries(Object.keys(start).map(k => [k, 'same']));
    await mark(page, 'A'); await mark(page, 'B');
    // [label, run, settled]: `settled` polls the observable end state when `run` cannot await it.
    const paths = [
      ['activation of B', f => { f.hosts.B.dispatchEvent(new PointerEvent('pointerdown')); }, async () => (await state(page, 'A')).active === 'inactive'],
      ['activation of A', f => { f.hosts.A.dispatchEvent(new PointerEvent('pointerdown')); }, async () => (await state(page, 'A')).active === 'active'],
      ['setContentSize', f => f.manager.setContentSize(f.hosts.A, 256, 128)],
      ['retheme round trip', async f => { const next = await f.api.loadTheme('/themes/1138'); await f.manager.retheme(next); await f.manager.retheme(f.theme); next.dispose?.(); }],
      ['refreshScrollbars', f => f.manager.refreshScrollbars(f.hosts.A)],
      ['overlapping renders', f => Promise.all([f.manager.setContentSize(f.hosts.A, 264, 136), f.manager.setContentSize(f.hosts.A, 248, 124), f.manager.applyState(f.hosts.A, { width: 240, height: 120 })])],
    ];
    for (const [label, run, settled] of paths) {
      await page.evaluate(`(${run.toString()})(window.overlayFixture)`);
      if (settled) await expect.poll(settled, `${label} settled`).toBe(true);
      expect(await identity(page, 'A'), `A after ${label}`).toEqual(all);
    }
    expect(await identity(page, 'B'), 'B after all paths').toEqual(Object.fromEntries(Object.keys(await identity(page, 'B')).map(k => [k, 'same'])));
  });

  test(`${mode} ${slug}: keyboard grow box and move handle steps keep the element and fire no focus churn`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    await mark(page, 'A'); await mark(page, 'B');
    const a0 = await state(page, 'A');
    expect(await focus(page, 'A', 'Resize window')).toBe(true);
    await page.evaluate(() => { window.overlayFixture.churn.A.length = 0; });
    for (let n = 1; n <= 3; n++) {
      await page.keyboard.press('ArrowRight');
      await expect.poll(async () => (await state(page, 'A')).width, `width after ArrowRight ${n}`).toBe(a0.width + n * STEP);
      expect(await focusState(page), `after ArrowRight ${n}`).toMatchObject({ where: 'A:Resize window', marked: true });
    }
    expect(await churn(page, 'A'), 'no focusout/focusin while resizing').toEqual([]);
    // B is inactive: its first step also activates it (two windows re-render).
    const b0 = await state(page, 'B');
    expect(await focus(page, 'B', 'Move window')).toBe(true);
    await page.evaluate(() => { window.overlayFixture.churn.B.length = 0; });
    for (let n = 1; n <= 3; n++) {
      await page.keyboard.press('ArrowRight');
      await expect.poll(async () => (await state(page, 'B')).active).toBe('active');
      expect((await state(page, 'B')).left, `B moved exactly ${n} steps`).toBe(b0.left + n * STEP);
      expect(await focusState(page), `after ArrowRight ${n}`).toMatchObject({ where: 'B:Move window', marked: true });
    }
    expect(await churn(page, 'B'), 'no focusout/focusin while moving').toEqual([]);
    expect(Object.values(await identity(page, 'A'))).not.toContain('duplicate');
  });

  test(`${mode} ${slug}: Enter twice on Collapse keeps the widget; a vanished grow box hands focus to the move handle`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    await mark(page, 'A');
    const order = () => page.evaluate(() => [...window.overlayFixture.hosts.A.shadowRoot.querySelectorAll('button, [role=scrollbar]')].map(b => b.getAttribute('aria-label')));
    const tabOrder = await order();
    expect(await focus(page, 'A', 'Collapse window')).toBe(true);
    await page.evaluate(() => { window.overlayFixture.churn.A.length = 0; });
    for (const [n, collapsed] of [[1, true], [2, false]]) {
      await page.keyboard.press('Enter');
      await expect.poll(async () => (await state(page, 'A')).collapsed, `collapsed after Enter ${n}`).toBe(collapsed);
      expect(await focusState(page), `after Enter ${n}`).toMatchObject({ where: 'A:Collapse window', marked: true });
    }
    expect(await churn(page, 'A'), 'no focus churn on the collapse widget').toEqual([]);
    // One Enter toggles exactly once: listeners from earlier renders were released.
    const ids = await identity(page, 'A');
    expect(Object.values(ids)).not.toContain('duplicate');
    // The grow box has no meaning on a shaded window: focus must stay in A.
    expect(await focus(page, 'A', 'Resize window')).toBe(true);
    await page.evaluate(() => { const f = window.overlayFixture; return f.manager.applyState(f.hosts.A, { collapsed: true }); });
    expect(await focusState(page)).toMatchObject({ where: 'A:Move window', marked: true });
    expect(await identity(page, 'A')).not.toHaveProperty('Resize window');
    await page.evaluate(() => { const f = window.overlayFixture; return f.manager.applyState(f.hosts.A, { collapsed: false }); });
    expect((await identity(page, 'A'))['Resize window'], 'grow box back after expand').toBe('new');
    // Tab order is unchanged by the re-created grow box: it still follows the move handle.
    await expect.poll(order).toEqual(tabOrder);
  });

  test(`${mode} ${slug}: Zoom keeps focus and identity on the zoom widget`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    await mark(page, 'A');
    // Zoom-to-fit grows the body to the taller content.
    const h0 = (await state(page, 'A')).height;
    expect(await focus(page, 'A', 'Zoom window')).toBe(true);
    await page.evaluate(() => { window.overlayFixture.churn.A.length = 0; });
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await state(page, 'A')).height).toBeGreaterThan(h0);
    expect(await focusState(page)).toMatchObject({ where: 'A:Zoom window', marked: true });
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await state(page, 'A')).height).toBe(h0);
    expect(await focusState(page)).toMatchObject({ where: 'A:Zoom window', marked: true });
    expect(await churn(page, 'A')).toEqual([]);
  });

  test(`${mode} ${slug}: a focused themed scrollbar survives a re-render`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    await mark(page, 'A');
    expect(await focus(page, 'A', 'Scroll content vertically')).toBe(true);
    await page.keyboard.press('ArrowDown');
    await page.evaluate(() => { const f = window.overlayFixture; f.churn.A.length = 0; return f.manager.setContentSize(f.hosts.A, 248, 124); });
    expect(await focusState(page)).toMatchObject({ where: 'A:Scroll content vertically', marked: true });
    // Exactly one line per key: the re-render released the previous keydown/wheel listeners.
    const top = () => page.evaluate(() => window.overlayFixture.hosts.A.firstElementChild.scrollTop);
    const before = await top();
    await page.keyboard.press('ArrowDown');
    await expect.poll(top).toBeGreaterThan(before);
    expect(await churn(page, 'A')).toEqual([]);
  });

  test(`${mode} ${slug}: pointer-dragging B's title bar moves keyboard focus from A into B`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    expect(await focus(page, 'A', 'Move window')).toBe(true);
    await page.keyboard.press('ArrowDown'); // a keyboard interaction, so A's handle shows its ring
    const a0 = await state(page, 'A'), b0 = await state(page, 'B');
    const grip = await page.evaluate(() => {
      const r = window.overlayFixture.control('B', 'Move window').getBoundingClientRect();
      return { x: r.left + r.width / 2 + 20, y: r.top + r.height / 2 };
    });
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x + 30, grip.y + 10, { steps: 3 });
    await page.mouse.up();
    await expect.poll(async () => (await state(page, 'B')).active).toBe('active');
    expect((await state(page, 'B')).left, 'pointer drag still moves B').toBe(b0.left + 30);
    expect(await focusState(page)).toMatchObject({ where: 'B:Move window', focusVisible: false });
    await page.keyboard.press('ArrowRight');
    expect((await state(page, 'A')).left, 'A did not move').toBe(a0.left);
    expect((await state(page, 'B')).left, 'the arrow moved B').toBe(b0.left + 30 + STEP);
    expect((await state(page, 'A')).active).toBe('inactive');
  });

  test(`${mode} ${slug}: pointer-resizing B's grow box moves focus into B and still resizes`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    expect(await focus(page, 'A', 'Move window')).toBe(true);
    const b0 = await state(page, 'B');
    const grip = await page.evaluate(() => {
      const r = window.overlayFixture.control('B', 'Resize window').getBoundingClientRect();
      return { x: r.right - 3, y: r.bottom - 3 };
    });
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x + 24, grip.y + 16, { steps: 3 });
    await page.mouse.up();
    await expect.poll(async () => (await state(page, 'B')).width).toBe(b0.width + 24);
    expect((await focusState(page)).where).toMatch(/^B:/);
  });
}
