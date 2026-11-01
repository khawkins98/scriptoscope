// #621 web host policy; independent public-behavior regressions, not fidelity claims.
import { test, expect, MODES, boot, fixture, hitAt, settle } from './frame-pass-through-fixture.mjs';

// Delay a real browser service awaited during preparation, without calling private render methods.
const holdFonts = page => page.evaluate(() => {
  const original = document.fonts.load;
  window.__fontGate = { entered: 0 };
  const gate = new Promise(resolve => { window.__fontGate.release = resolve; });
  document.fonts.load = async function (...args) {
    window.__fontGate.entered++;
    await gate;
    return original.apply(this, args);
  };
  window.__fontGate.restore = () => { document.fonts.load = original; window.__fontGate.release(); };
});
const releaseFonts = page => page.evaluate(() => window.__fontGate.restore());
const clip = page => page.evaluate(() => getComputedStyle(window.__fpt.layers('A').L2).clipPath);

for (const mode of MODES) {
  test(`${mode}: HPT42 a resize commit cannot restore the clip during a newer captured frame drag`, async ({ page, servers }, info) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => { const f = window.__fpt; f.manager(); await f.add('A', { slug: 'dolphin-som', title: 'Resize then drag', left: 90, top: 90 }); });
    const fix = await fixture(page, 'A');
    const before = await clip(page);
    const gb = await page.evaluate(() => { const r = window.__fpt.hosts.A.host.shadowRoot.querySelector('.scriptoscope-growbox').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const width = await page.evaluate(() => window.__fpt.geom('A').W);
    await holdFonts(page);
    try {
      await page.mouse.move(gb.x, gb.y); await page.mouse.down();
      await page.mouse.move(gb.x + 40, gb.y + 30, { steps: 3 });
      expect(await clip(page), 'resize holds the clip suspended').toBe('none');
      await page.mouse.up();
      await page.waitForFunction(() => window.__fontGate.entered > 0);
      expect(await page.evaluate(() => window.__fpt.geom('A').W), 'resize preparation is pending').toBe(width);
      await page.mouse.move(fix.vp.p_in.x, fix.vp.p_in.y); await page.mouse.down();
      await page.mouse.move(fix.vp.p_in.x + 12, fix.vp.p_in.y + 8, { steps: 2 });
      await page.evaluate(() => {
        const { L1, L2 } = window.__fpt.layers('A');
        window.__race = { pointer: null, writes: [] };
        // The capture target is L1, not the transparent move button.
        window.__race.observer = new MutationObserver(records => {
          for (const r of records) window.__race.writes.push({ old: r.oldValue, current: L2.style.clipPath });
        });
        window.__race.observer.observe(L2, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
        L1.addEventListener('pointermove', e => { window.__race.pointer = e.pointerId; }, { once: true });
      });
      await page.mouse.move(fix.vp.p_in.x + 24, fix.vp.p_in.y + 16, { steps: 2 });
      expect(await page.evaluate(() => { const f = window.__fpt; return f.layers('A').L1.hasPointerCapture(window.__race.pointer); }), 'new drag really owns pointer capture').toBe(true);
      await releaseFonts(page);
      await page.waitForFunction(w => window.__fpt.geom('A').W > w, width);
      await settle(page);
      const during = await clip(page);
      const writes = await page.evaluate(() => { window.__race.observer.disconnect(); return window.__race.writes; });
      await info.attach('resize-drag-overlap.json', { body: JSON.stringify({ mode, during, writes }), contentType: 'application/json' });
      expect(during === 'none', 'older resize commit leaves newer drag suspended').toBe(true);
      expect(writes.every(w => w.current === 'none' && !/clip-path:\s*path\(/.test(w.old ?? '')), 'no intermediate path write while newer drag is captured').toBe(true);
      await page.mouse.up(); await settle(page);
      const after = await clip(page);
      expect(after, 'drag release restores a path').toMatch(/^path\(/);
      expect(after, 'the restored path belongs to resized chrome').not.toBe(before);
      expect(await hitAt(page, (await fixture(page, 'A')).vp.p_out), 'new region passes through after final release').toBe('sentinel');
    } finally { await releaseFonts(page); await page.mouse.up(); }
  });

  test(`${mode}: HPT43 dispose releases tracked listeners, pending renders and windows while retaining caller ownership`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.__fpt, original = document.addEventListener;
      window.__outsideSignals = [];
      document.addEventListener = function (type, fn, options) {
        if (['pointerdown', 'pointercancel', 'click', 'keydown', 'contextmenu'].includes(type) && options?.capture && options?.passive && options?.signal)
          window.__outsideSignals.push({ type, signal: options.signal });
        return original.call(this, type, fn, options);
      };
      try { f.manager(); await f.add('A', { slug: 'dolphin-som', title: 'Dispose pending render' }); }
      finally { document.addEventListener = original; }
    });
    expect(await page.evaluate(() => [...new Set(window.__outsideSignals.filter(s => !s.signal.aborted).map(s => s.type))].sort()), 'HP38 listeners are armed before disposal').toEqual(['click', 'contextmenu', 'keydown', 'pointercancel', 'pointerdown']);
    await holdFonts(page);
    try {
      await page.evaluate(() => {
        const f = window.__fpt, { host, m } = f.hosts.A;
        window.__pendingResize = m.setContentSize(host, 410, 270);
      });
      await page.waitForFunction(() => window.__fontGate.entered > 0);
      const result = await page.evaluate(() => {
        const f = window.__fpt, { host, m } = f.hosts.A;
        window.__disposeChanges = 0; m.setChangeListener(() => window.__disposeChanges++);
        window.__disposeCanvas = f.layers('A').canvas;
        window.__disposeSize = [window.__disposeCanvas.width, window.__disposeCanvas.height];
        m.dispose(); m.dispose();
        return { described: m.describe(host), port: m.contentPort(host), connected: host.isConnected,
          allAborted: window.__outsideSignals.every(s => s.signal.aborted) };
      });
      expect(result).toEqual({ described: null, port: null, connected: true, allAborted: true });
      await releaseFonts(page);
      await page.evaluate(() => window.__pendingResize);
      await settle(page);
      expect(await page.evaluate(() => ({ changes: window.__disposeChanges, size: [window.__disposeCanvas.width, window.__disposeCanvas.height], before: window.__disposeSize }))).toEqual(expect.objectContaining({ changes: 0 }));
      expect(await page.evaluate(() => [window.__disposeCanvas.width, window.__disposeCanvas.height])).toEqual(await page.evaluate(() => window.__disposeSize));
      // Retained host handlers must not resurrect entries; outside clicks must not commit either.
      await page.evaluate(() => { const f = window.__fpt; f.hosts.A.host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, isPrimary: true })); });
      await page.mouse.click(20, 20); await settle(page);
      expect(await page.evaluate(() => window.__disposeChanges)).toBe(0);
      await page.evaluate(async () => { const f = window.__fpt; await f.add('B', { slug: 'dolphin-som', m: f.managers[0], left: 500, top: 100 }); });
      expect(await page.evaluate(() => window.__fpt.managers[0].describe(window.__fpt.hosts.B.host)?.hitEffective), 'manager and borrowed theme remain reusable').toBe('region');
      await page.evaluate(() => { const m = window.__fpt.managers[0]; m.dispose(); m.dispose(); });
    } finally { await releaseFonts(page); }
  });
}
