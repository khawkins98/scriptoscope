// Modern host input policy (#619, #628); no original-engine fidelity claim.
// Assertions use public manager state, actual keyboard traversal and native DOM events.
import { test as base, expect } from '@playwright/test';
import { startServers } from './servers.mjs';

const test = base.extend({ servers: [async ({}, use) => {
  const servers = await startServers();
  try { await use(servers); } finally { await servers.close(); }
}, { scope: 'worker' }] });

async function boot(page, servers, mode) {
  await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
  await page.evaluate(async mode => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const decl = await import(mode === 'source' ? '/src/declarative/index.ts' : '/dist/declarative.js');
    const theme = await api.loadTheme('/themes/windows-95');
    document.body.innerHTML = '<button id="before">Before</button><button id="after">After</button>';
    const manager = new api.WindowManager({ hit: 'box' });
    const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(r => requestAnimationFrame(r)); };
    const add = async (title, state) => {
      const host = await manager.add(theme, { title, width: 240, height: 120, ...(state ? { state } : {}) });
      document.querySelector('#after').before(host);
      manager.setPosition(host, title === 'A' ? 40 : 400, 70);
      await settle(); return host;
    };
    window.inputPolicy = { api, decl, theme, manager, settle, add, hosts: {} };
    await document.fonts.ready;
  }, mode);
}
const settle = page => page.evaluate(() => window.inputPolicy.settle());

for (const mode of ['source', 'built']) {
  test(`${mode}: #628 L1 completed captured widget gesture cannot swallow standalone nonzero-detail click`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.inputPolicy; f.calls = 0;
      f.hosts.A = await f.add('A');
      f.hosts.B = await f.manager.add(f.theme, { title: 'B', width: 240, height: 120 }, { onClose: () => f.calls++ });
      document.querySelector('#after').before(f.hosts.B); f.manager.setPosition(f.hosts.B, 400, 70);
      f.clicks = [];
      f.hosts.B.addEventListener('click', e => f.clicks.push(e.composedPath()[0].className));
      await f.settle();
    });
    await page.locator('[data-scriptoscope-window-host]').nth(1).locator('.scriptoscope-titlewidget-close').click();
    await settle(page);
    const afterGesture = await page.evaluate(() => {
      const f = window.inputPolicy;
      return { calls: f.calls, active: f.manager.describe(f.hosts.B).active, clicks: f.clicks };
    });
    expect(afterGesture.calls, 'inactive press only activates').toBe(0);
    expect(afterGesture.active).toBe(true);
    expect(afterGesture.clicks.length, 'positive control: browser delivered captured click').toBe(1);
    expect(afterGesture.clicks[0], 'capture retargeted click away from widget').not.toContain('titlewidget-close');
    const standalone = await page.evaluate(() => {
      const f = window.inputPolicy, button = f.hosts.B.shadowRoot.querySelector('.scriptoscope-titlewidget-close');
      // No preceding pointerdown: AT/synthetic click, placed on the real widget.
      const r = button.getBoundingClientRect();
      const click = () => button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
      click(); const first = f.calls;
      click(); return { first, second: f.calls };
    });
    expect(standalone.second - standalone.first, 'positive control: same standalone click reaches a working handler').toBe(1);
    expect(standalone.first, 'unrelated nonzero-detail click acts exactly once').toBe(1);
  });

  test(`${mode}: #628 L2 failed initial active add preserves prior active window and permits retry`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const result = await page.evaluate(async () => {
      const f = window.inputPolicy, A = await f.add('A');
      // Deterministic render-input failure, without patching private manager methods.
      const broken = Object.create(f.theme);
      Object.defineProperty(broken, 'manifest', { get() { throw new Error('expected initial render failure'); } });
      let error = null;
      try { await f.manager.add(broken, { title: 'Failed', state: 'active' }); }
      catch (e) { error = e.message; }
      await f.settle();
      const afterFailure = { active: f.manager.describe(A).active,
        chrome: A.shadowRoot.querySelector('[data-scriptoscope-current-state]').dataset.scriptoscopeCurrentState };
      const B = await f.add('B', 'active');
      return { error, afterFailure, afterRetry: [f.manager.describe(A).active, f.manager.describe(B).active] };
    });
    expect(result.error).toContain('expected initial render failure');
    expect(result.afterFailure, 'rejected provisional claim leaves prior active state and art intact').toEqual({ active: true, chrome: 'active' });
    expect(result.afterRetry, 'a subsequent successful explicit claim still wins').toEqual([false, true]);
  });
}

// A complete walk records the *actual* sequential navigation stops, rather than
// assuming a tabindex value describes browser auto-focusability.
async function walk(page, browserName, backwards = false) {
  const macWebKit = process.platform === 'darwin' && browserName === 'webkit';
  const key = `${backwards ? 'Shift+' : ''}${macWebKit ? 'Alt+' : ''}Tab`;
  await page.locator(backwards ? '#after' : '#before').focus();
  const stops = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press(key);
    await settle(page);
    const stop = await page.evaluate(() => {
      let el = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      return el.id || el.getAttribute('aria-label') || el.className || el.tagName;
    });
    if (stop === (backwards ? 'before' : 'after')) return stops;
    stops.push(stop);
  }
  throw new Error(`Tab traversal never reached sentinel: ${JSON.stringify(stops)}`);
}

for (const mode of ['source', 'built']) for (const kind of ['viewport', 'supplied', 'declarative', 'explicit']) {
  test(`${mode}: #619 ${kind} content has deterministic Tab stops through style rebuild and retheme`, async ({ page, servers, browserName }) => {
    await boot(page, servers, mode);
    await page.evaluate(async kind => {
      const f = window.inputPolicy;
      const html = '<div style="height:500px">Scrollable prose</div>';
      let host;
      if (kind === 'declarative') {
        const source = document.createElement('div');
        source.setAttribute('data-scriptoscope-window', '');
        source.setAttribute('data-scriptoscope-title', 'Tab policy');
        source.setAttribute('data-scriptoscope-width', '240');
        source.setAttribute('data-scriptoscope-height', '120');
        source.innerHTML = html;
        document.querySelector('#after').before(source);
        const instance = await f.decl.ScriptoscopeWindow.promote(source, { manager: f.manager, theme: f.theme });
        host = instance.host;
      } else {
        let content;
        if (kind !== 'viewport') {
          content = document.createElement('div');
          content.style.cssText = 'height:100%;overflow:auto;box-sizing:border-box';
          content.innerHTML = html;
          if (kind === 'explicit') { content.tabIndex = 0; content.id = 'explicit-content'; }
        }
        host = await f.manager.add(f.theme, { title: 'Tab policy', width: 240, height: 120 }, {}, content ? { contentEl: content } : {});
        document.querySelector('#after').before(host);
        if (!content) host.shadowRoot.querySelector('.scriptoscope-content').insertAdjacentHTML('beforeend', html);
      }
      f.hosts.subject = host;
      f.manager.setPosition(host, 40, 70);
      await f.manager.refreshScrollbars(host); await f.settle();
    }, kind);
    await expect(page.locator('[role=scrollbar][aria-orientation=vertical]')).toBeVisible();
    const expected = [...(kind === 'explicit' ? ['explicit-content'] : []), 'Collapse window', 'Zoom window', ...(kind === 'declarative' ? ['Close window'] : []), 'Move window', 'Resize window', 'Scroll content vertically'];
    const check = async label => {
      expect(await walk(page, browserName), `${label}: forward order`).toEqual(expected);
      expect(await walk(page, browserName, true), `${label}: reverse order`).toEqual([...expected].reverse());
    };
    await check('initial layout');
    await page.evaluate(async () => {
      const f = window.inputPolicy, host = f.hosts.subject;
      for (const el of [host, host.shadowRoot.querySelector('.scriptoscope-content'), host.querySelector('.scriptoscope-slot')].filter(Boolean)) {
        el.style.willChange = 'transform'; void el.offsetHeight;
        el.style.willChange = ''; el.style.clipPath = 'inset(0px)'; void el.offsetHeight; el.style.clipPath = '';
      }
      host.shadowRoot.querySelector('.scriptoscope-content').addEventListener('click', () => {});
      f.manager.setDefaultHit('region');
      await f.settle();
    });
    await check('style rebuild and region hit mode');
    await page.evaluate(async () => { const f = window.inputPolicy; await f.manager.retheme(f.theme); await f.settle(); });
    await check('retheme');
  });
}

for (const mode of ['source', 'built']) test(`${mode}: #619 native content click retains focus and action while activating its window`, async ({ page, servers }) => {
  await boot(page, servers, mode);
  await page.evaluate(async () => {
    const f = window.inputPolicy; f.hosts.A = await f.add('A'); f.calls = 0;
    const content = document.createElement('div');
    content.style.cssText = 'height:100%;overflow:auto';
    content.innerHTML = '<input id="content-action" aria-label="Content field"><div style="height:500px">Prose</div>';
    content.querySelector('input').addEventListener('click', () => f.calls++);
    f.hosts.B = await f.manager.add(f.theme, { title: 'B', width: 240, height: 120 }, {}, { contentEl: content });
    document.querySelector('#after').before(f.hosts.B); f.manager.setPosition(f.hosts.B, 400, 70);
    await f.settle();
  });
  await page.locator('#before').focus();
  await page.locator('#content-action').click(); await settle(page);
  expect(await page.evaluate(() => {
    const f = window.inputPolicy;
    return { active: [f.manager.describe(f.hosts.A).active, f.manager.describe(f.hosts.B).active], focused: document.activeElement.id, calls: f.calls };
  })).toEqual({ active: [false, true], focused: 'content-action', calls: 1 });
});

for (const mode of ['source', 'built']) for (const concurrent of ['activation', 'removal', 'active add']) {
  test(`${mode}: #628 L2 rejected active add respects subsequent ${concurrent}`, async ({ page, servers }) => {
    const unhandled = [];
    page.on('pageerror', error => unhandled.push(error.message));
    await boot(page, servers, mode);
    const result = await page.evaluate(async concurrent => {
      const f = window.inputPolicy, A = await f.add('A'), B = await f.add('B');
      const broken = Object.create(f.theme);
      Object.defineProperty(broken, 'manifest', { get() { throw new Error('expected concurrent render failure'); } });
      const failure = f.manager.add(broken, { title: 'Failed', state: 'active' }).then(() => null, e => e.message);
      let C;
      // These actions happen before the rejected add promise is observed. They must
      // remain authoritative after its cleanup, rather than restoring a stale claim.
      if (concurrent === 'activation') B.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      if (concurrent === 'removal') { f.manager.remove(A); A.remove(); }
      if (concurrent === 'active add') C = await f.add('C', 'active');
      const error = await failure; await f.settle();
      const states = { error, A: f.manager.describe(A)?.active ?? null, B: f.manager.describe(B)?.active ?? null,
        C: C ? f.manager.describe(C)?.active : null };
      for (const host of [A, B, C].filter(Boolean)) { f.manager.remove(host); host.remove(); }
      const retry = await f.add('Retry');
      return { ...states, retryActive: f.manager.describe(retry).active };
    }, concurrent);
    expect(unhandled, 'background preparation failures are handled').toEqual([]);
    expect(result.error).toContain('expected concurrent render failure');
    expect(result.retryActive, 'failed provisional entry was removed; next default add is first and active').toBe(true);
    if (concurrent === 'activation') expect(result).toMatchObject({ A: false, B: true });
    if (concurrent === 'removal') expect(result).toMatchObject({ A: null, B: false });
    if (concurrent === 'active add') expect(result).toMatchObject({ A: false, B: false, C: true });
  });
}


for (const mode of ['source', 'built']) test(`${mode}: #628 L2 a committed replacement can satisfy a superseded initial add`, async ({ page, servers }) => {
  const unhandled = [];
  page.on('pageerror', error => unhandled.push(error.message));
  await boot(page, servers, mode);
  const result = await page.evaluate(async () => {
    const f = window.inputPolicy;
    await f.add('A'); const B = await f.add('B');
    let reads = 0;
    const transient = Object.create(f.theme);
    Object.defineProperty(transient, 'manifest', { get() {
      if (++reads === 1) throw new Error('obsolete initial preparation failure');
      return f.theme.manifest;
    } });
    const adding = f.manager.add(transient, { title: 'Replaced', state: 'active', width: 240, height: 120 });
    B.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const host = await adding;
    const chromeAtResolution = !!host.shadowRoot.querySelector('.scriptoscope-window');
    document.querySelector('#after').before(host);
    await f.settle();
    return { reads, chromeAtResolution, active: f.manager.describe(host).active, laterActive: f.manager.describe(B).active };
  });
  expect(result.reads, 'a replacement actually prepared valid theme data').toBeGreaterThan(1);
  expect(result.chromeAtResolution, 'add resolves only after valid initial chrome committed').toBe(true);
  expect(result).toMatchObject({ active: false, laterActive: true });
  expect(unhandled, 'obsolete failure is handled after successful replacement').toEqual([]);
});
