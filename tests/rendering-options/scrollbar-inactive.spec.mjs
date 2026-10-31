import { expect } from '@playwright/test';
import { test as base } from './demo-fixtures.mjs';
import { startServers } from './servers.mjs';

// #594: an inactive window's scroll bars draw the inactive tier. The 2.3.1
// scroll-bar CDEF picks the track by state (docs/spec/engine/scrollbar.md §4.2,
// TR1-TR4: inactive 0, disabled 1, normal 2, pressed 3). The window manager
// repaints its bars in place on every activation flip, as it does the chrome,
// keeping each bar element (#535) and its ARIA state.
//
// The oracle is independent of the window wiring: the source engine's own
// composeScrollbarFrame for the bar's length and value, with and without
// `state: 'inactive'`, loaded from the source server for every mode.
const SLUGS = ['windows-95', 'beos-r503', 'apple-platinum-2'];
const AXES = ['vertical', 'horizontal'];
const NAMES = ['A', 'B'];

const test = base.extend({
  servers: [async ({}, use) => {
    const servers = await startServers();
    try { await use(servers); } finally { await servers.close(); }
  }, { scope: 'worker' }],
});

async function setup(page, servers, mode, slug) {
  await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
  await page.evaluate(async ({ mode, slug, source }) => {
    const frames = (n = 3) => new Promise(r => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); });
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const index = await import(`${source}/src/index.ts`);
    const controls = await import(`${source}/src/controls.ts`);
    const oracleTheme = await index.loadTheme(`${source}/themes/${slug}`);
    const theme = await api.loadTheme(`/themes/${slug}`);
    const manager = new api.WindowManager();
    const hosts = {}, scrollEls = {};
    for (const [i, name] of ['A', 'B'].entries()) {
      const content = document.createElement('div');
      content.style.cssText = 'width:100%;height:100%;overflow:auto;box-sizing:border-box';
      content.innerHTML = '<div style="width:900px;height:3000px"></div>';
      const host = await manager.add(theme, { title: name, width: 220, height: 160 }, {}, { contentEl: content });
      document.body.append(host);
      manager.setPosition(host, 40 + i * 340, 40);
      hosts[name] = host; scrollEls[name] = content;
    }
    const sp = window.__sp = {
      frames, manager, hosts, scrollEls,
      bar: (w, axis) => hosts[w].shadowRoot.querySelector(`[role=scrollbar][aria-orientation=${axis}]`),
      canvas: (w, axis) => sp.bar(w, axis)?.querySelector('canvas'),
      current: w => hosts[w].shadowRoot.querySelector('.scriptoscope-window')?.dataset.scriptoscopeCurrentState,
      value(w, axis) {
        const s = scrollEls[w], v = axis === 'vertical';
        const max = v ? s.scrollHeight - s.clientHeight : s.scrollWidth - s.clientWidth;
        return max > 0 ? Math.min(1, Math.max(0, (v ? s.scrollTop : s.scrollLeft) / max)) : 0;
      },
      /** The engine's pixels for this bar's length and current value in `state`. */
      async oracle(w, axis, state) {
        const c = sp.canvas(w, axis);
        const frame = await controls.composeScrollbarFrame(oracleTheme, {
          orientation: axis, length: axis === 'vertical' ? c.height : c.width, value: sp.value(w, axis),
          ...(state === 'inactive' ? { state } : {}),
        });
        if (!frame) throw new Error(`${slug} ${axis} ${state}: no engine scrollbar (procedural fallback is out of this spec's scope)`);
        return controls.bufferToCanvas(frame.buffer).toDataURL();
      },
      /** Which engine frame the bar shows: 'normal', 'inactive' or 'other'. */
      async paintedAs(w, axis) {
        const pixels = sp.canvas(w, axis)?.toDataURL();
        if (pixels === await sp.oracle(w, axis, 'normal')) return 'normal';
        if (pixels === await sp.oracle(w, axis, 'inactive')) return 'inactive';
        return 'other';
      },
      aria(w, axis) {
        const bar = sp.bar(w, axis);
        return Object.fromEntries(['role', 'aria-orientation', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-label', 'tabindex']
          .map(name => [name, bar.getAttribute(name)]));
      },
    };
    await frames(6);
  }, { mode, slug, source: servers.source });
  await expect.poll(() => page.evaluate(() => ['A', 'B'].every(w => ['vertical', 'horizontal'].every(a => window.__sp.canvas(w, a))))).toBe(true);
}

/** Click a window's title bar (its move handle) to activate it. */
async function activate(page, w) {
  const grip = await page.evaluate(w => {
    const r = window.__sp.hosts[w].shadowRoot.querySelector('.scriptoscope-movehandle').getBoundingClientRect();
    return { x: r.x + 40, y: r.y + r.height / 2 };
  }, w);
  await page.mouse.click(grip.x, grip.y);
  await expect.poll(() => page.evaluate(w => window.__sp.current(w), w)).toBe('active');
}

/** Each bar shows the engine frame for its window's state. */
async function expectPainted(page, active, why) {
  for (const w of NAMES) for (const axis of AXES) {
    const want = w === active ? 'normal' : 'inactive';
    await expect.poll(() => page.evaluate(([w, axis]) => window.__sp.paintedAs(w, axis), [w, axis]),
      `${why}: window ${w} ${axis} bar draws the engine's ${want} frame`).toBe(want);
  }
}

for (const mode of ['source', 'built']) for (const slug of SLUGS) {
  test(`${mode} ${slug}: an inactive window's scroll bars draw the inactive tier and flip with activation (#594)`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    const why = `${mode} ${slug}`;
    await expect.poll(() => page.evaluate(() => [window.__sp.current('A'), window.__sp.current('B')])).toEqual(['active', 'inactive']);

    // The inactive frame differs from the normal one, so the state checks below can fail.
    for (const axis of AXES) {
      expect(await page.evaluate(async axis => await window.__sp.oracle('A', axis, 'normal') !== await window.__sp.oracle('A', axis, 'inactive'), axis),
        `${why}: the engine draws the ${axis} bar inactive differently from normal`).toBe(true);
    }

    // B scrolled while inactive: the repaint for the new value keeps the inactive tier.
    await page.evaluate(() => { const s = window.__sp.scrollEls.B; s.scrollTo({ top: 400, left: 200, behavior: 'instant' }); });
    await page.evaluate(() => window.__sp.frames(4));
    await expectPainted(page, 'A', `${why} initial`);

    const identity = () => page.evaluate(() => {
      const keep = window.__sp.kept ??= {};
      const same = {};
      for (const w of ['A', 'B']) for (const a of ['vertical', 'horizontal']) {
        const bar = window.__sp.bar(w, a);
        keep[`${w}-${a}`] ??= bar;
        same[`${w}-${a}`] = keep[`${w}-${a}`] === bar && bar.isConnected;
      }
      return same;
    });
    const aria = () => page.evaluate(() => Object.fromEntries(['A', 'B'].flatMap(w => ['vertical', 'horizontal']
      .map(a => [`${w}-${a}`, window.__sp.aria(w, a)]))));
    const allKept = { 'A-vertical': true, 'A-horizontal': true, 'B-vertical': true, 'B-horizontal': true };
    expect(await identity()).toEqual(allKept);
    const ariaBefore = await aria();
    expect(ariaBefore['B-vertical']['aria-valuenow'], `${why}: B's bar reports its scrolled value`).not.toBe('0');

    // Activation flips both windows' bars, in place.
    await activate(page, 'B');
    expect(await page.evaluate(() => window.__sp.current('A'))).toBe('inactive');
    await expectPainted(page, 'B', `${why} after activating B`);
    expect(await identity(), `${why}: every bar keeps its element across the flip (#535)`).toEqual(allKept);
    expect(await aria(), `${why}: ARIA state unchanged by the flip`).toEqual(ariaBefore);

    // And back.
    await activate(page, 'A');
    expect(await page.evaluate(() => window.__sp.current('B'))).toBe('inactive');
    await expectPainted(page, 'A', `${why} after reactivating A`);
    expect(await identity(), `${why}: every bar keeps its element across the second flip`).toEqual(allKept);
    expect(await aria(), `${why}: ARIA state unchanged by the second flip`).toEqual(ariaBefore);
  });
}

// A press on an inactive window's bar activates the window and does nothing else, as a
// first click in an inactive classic Mac window. Before #594 the bar swallowed the press
// (no activation) and paged the inactive window. Pressed and inactive never combine: the
// bar ends normal and unscrolled.
for (const mode of ['source', 'built']) for (const slug of SLUGS) {
  test(`${mode} ${slug}: pressing an inactive window's scroll bar activates it without scrolling (#594)`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    const why = `${mode} ${slug}`;
    await expectPainted(page, 'A', `${why} initial`);
    const p = await page.evaluate(() => {
      const r = window.__sp.canvas('B', 'vertical').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };   // the track below the thumb
    });
    expect(await page.evaluate(([x, y]) => {
      const host = window.__sp.hosts.B;
      return host.shadowRoot.elementFromPoint(x, y) === window.__sp.canvas('B', 'vertical');
    }, [p.x, p.y]), `${why}: the press lands on B's bar`).toBe(true);
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await expect.poll(() => page.evaluate(() => window.__sp.current('B')), `${why}: the press activates B`).toBe('active');
    await page.waitForTimeout(600);
    await page.mouse.up();
    expect(await page.evaluate(() => window.__sp.scrollEls.B.scrollTop), `${why}: the activating press does not scroll`).toBe(0);
    await expectPainted(page, 'B', `${why} after the activating press`);
    // The next press acts as usual.
    await page.mouse.click(p.x, p.y);
    await expect.poll(() => page.evaluate(() => window.__sp.scrollEls.B.scrollTop), `${why}: a press on the now-active bar scrolls`).toBeGreaterThan(0);
  });
}
