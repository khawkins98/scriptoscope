// #631 independent modern-browser acceptance. Geometry comes from archive rules,
// never runtime clip paths or candidate child rectangles. No presentation timing.
import { test, expect, MODES, boot, fixture, settle, state } from './frame-pass-through-fixture.mjs';

async function setup(page, servers, mode) {
  await boot(page, servers, mode);
  await page.evaluate(async () => {
    const f = window.__fpt; f.manager();
    f.sentinel.style.overflow = 'auto';
    f.sentinel.innerHTML = '<div style="height:10000px;width:20px"></div>';
    const content = document.createElement('div');
    content.style.cssText = 'height:100%;overflow:auto;background:white';
    content.innerHTML = '<div id="nw-content" style="height:140px;overflow:auto"><div id="nw-nested" style="height:70px;overflow:auto"><div style="height:5000px">nested</div></div><div style="height:10000px">outer</div></div>';
    await f.add('A', { slug: 'dolphin-som', content });
    window.__nw = { root: content, content: content.querySelector('#nw-content'), nested: content.querySelector('#nw-nested') };
    if (f.hosts.A.host.shadowRoot.querySelector('[role=scrollbar]')) throw Error('Native fixture must fit host content without themed scrollbars');
  });
  return fixture(page, 'A');
}
const positions = page => page.evaluate(() => ({ sentinel: window.__fpt.sentinel.scrollTop,
  content: window.__nw.content.scrollTop, nested: window.__nw.nested.scrollTop, page: scrollY }));
// WebKit animates one wheel notch over several frames (a CI trace read the
// nested scroller at 117, 119, then 120 px). Reading positions as soon as the
// target first moves left the animation's tail to land after the next wheel's
// `before` snapshot, which then saw the previous target move by 1 px. Both
// snapshots are therefore taken at rest: no position changed for 150 ms of
// animation frames. This only waits; it does not relax any comparison.
const restingPositions = page => page.evaluate(() => new Promise((resolve, reject) => {
  const read = () => JSON.stringify({ sentinel: window.__fpt.sentinel.scrollTop,
    content: window.__nw.content.scrollTop, nested: window.__nw.nested.scrollTop, page: scrollY });
  const start = performance.now();
  let last = read(), since = start;
  const tick = now => {
    const current = read();
    if (current !== last) { last = current; since = now; }
    if (now - since >= 150) resolve(JSON.parse(current));
    else if (now - start > 5000) reject(new Error(`scroll positions never came to rest: ${current}`));
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
async function wheel(page, point, target) {
  const before = await restingPositions(page);
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => (await positions(page))[target]).toBeGreaterThan(before[target]);
  const after = await restingPositions(page);
  for (const key of Object.keys(before)) if (key !== target) expect(after[key], `${target} wheel leaves ${key} fixed`).toBe(before[key]);
  return { before, after };
}

for (const mode of MODES) {
  test(`${mode}: issue631 first and continued native gap wheels survive escaped content and mode/lifecycle changes`, async ({ page, servers, browserName, browser }, info) => {
    const rows = [];
    let fix;
    for (const firstGap of ['top', 'bottom']) {
      fix = await setup(page, servers, mode);
      const bottom = await page.evaluate(async () => {
        const f = window.__fpt, o = await f.oracle('A');
        // Nearest robust OUT point to bottom-right, from the independent region.
        for (let d = 2; d < 80; d++) for (let y = o.H - 2; y >= Math.max(o.C.bottom, o.H - d); y--) {
          const x = o.W - d;
          if (x < 1 || x >= o.W - 1) continue;
          let out = true;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out &&= o.region[(y + dy) * o.W + x + dx] === f.rules.OUT;
          if (out) return f.vp('A', [x, y]);
        }
        return null;
      });
      expect(bottom, 'archive supplies a bottom frame gap').toBeTruthy();
      // This fixed native descendant is clipped at the upper frame gap; it must
      // not redirect a separate frame gap's default scrolling to another plane.
      await page.evaluate(p => {
        const e = document.createElement('div'); e.id = 'nw-escaped';
        e.style.cssText = `position:fixed;left:${p.x - 10}px;top:${p.y - 10}px;width:20px;height:20px;overflow:auto`;
        e.innerHTML = '<div style="height:4000px">escaped</div>'; window.__nw.root.append(e);
      }, fix.vp.p_out);
      const p = firstGap === 'top' ? fix.vp.p_out : bottom;
      for (const gap of [0, 32, 250]) {
        if (gap) await page.waitForTimeout(gap);
        rows.push({ label: firstGap, requestedGapMs: gap, ...await wheel(page, p, 'sentinel') });
      }
    }
    await page.evaluate(async () => { const f = window.__fpt, h = f.hosts.A; await h.m.applyState(h.host, { hit: 'box' }); await h.m.applyState(h.host, { hit: 'region' }); await f.settle(); });
    expect((await state(page, 'A')).hitEffective).toBe('region');
    await wheel(page, fix.vp.p_out, 'sentinel');
    await page.mouse.click(fix.vp.p_out.x, fix.vp.p_out.y); await settle(page);
    expect((await state(page, 'A')).active, 'outside native press deactivates the window').toBe(false);
    await wheel(page, fix.vp.p_out, 'sentinel');
    // Removal and reuse keep native content caller-owned; stale hit planes may
    // not swallow the page beneath a now unmanaged host.
    await page.evaluate(() => { const f = window.__fpt, h = f.hosts.A; h.m.remove(h.host); h.host.remove(); });
    await wheel(page, fix.vp.p_out, 'sentinel');
    await page.evaluate(async () => { const f = window.__fpt; f.managers[0].dispose(); f.managers[0].dispose(); await f.add('B', { slug: 'dolphin-som', m: f.managers[0] }); });
    const reused = await fixture(page, 'B');
    await wheel(page, reused.vp.p_out, 'sentinel');
    await page.evaluate(() => { const f = window.__fpt, h = f.hosts.B; h.m.dispose(); h.m.dispose(); if (h.m.describe(h.host)) throw Error('Disposed window remains managed'); h.host.remove(); });
    await wheel(page, reused.vp.p_out, 'sentinel');
    await info.attach('native-gap-observations.json', { body: JSON.stringify({ mode, browserName, browserVersion: browser.version(), rows,
      limitation: 'Routing only; requested gaps do not prove native gesture boundaries or visual latency.' }, null, 2), contentType: 'application/json' });
  });

  test(`${mode}: issue631 native nested/content/page targets and canceling calibration`, async ({ page, servers }) => {
    const fix = await setup(page, servers, mode);
    const points = await page.evaluate(() => {
      const n = window.__nw.nested.getBoundingClientRect(), c = window.__nw.content.getBoundingClientRect();
      return { nested: { x: n.x + 30, y: n.y + 30 }, content: { x: c.x + 100, y: c.y + 120 } };
    });
    await wheel(page, points.nested, 'nested');
    await wheel(page, points.content, 'content');
    await page.evaluate(() => { window.__nw.content.scrollTop = 0; window.__nw.nested.scrollTop = window.__nw.nested.scrollHeight; });
    await settle(page);
    await wheel(page, points.nested, 'content');
    await page.evaluate(() => { window.__nw.content.scrollTop = 0; window.__nw.nested.scrollTop = 0; });
    await settle(page);
    await page.evaluate(() => { window.__nw.cancel = e => e.preventDefault(); window.__nw.nested.addEventListener('wheel', window.__nw.cancel, { passive: false }); });
    const before = await positions(page);
    await page.mouse.move(points.nested.x, points.nested.y); await page.mouse.wheel(0, 120); await settle(page, 250);
    expect(await positions(page), 'canceling native control suppresses all scroll displacement').toEqual(before);
    await page.evaluate(() => { window.__nw.nested.removeEventListener('wheel', window.__nw.cancel); window.__fpt.sentinel.style.overflow = 'visible'; });
    await wheel(page, fix.vp.p_out, 'page');
  });

  test(`${mode}: issue631 native frame double-click survives activation reconciliation`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const p = await page.evaluate(async () => {
      const f = window.__fpt, { widgetFamilyTheme } = await import('/tests/rendering-options/widget-family-fixture.mjs');
      f.manager();
      const theme = widgetFamilyTheme(['document-window']);
      await f.add('Other', { slug: 'independent-synthetic', themeObject: theme, w: 60, h: 40, left: 700, top: 500 });
      await f.add('A', { slug: 'independent-synthetic', themeObject: theme, w: 60, h: 40 });
      // The fixture's solid top edge at (30,2) is outside all three widget
      // rectangles [6,4,10,8], [12,4,16,8], [18,4,22,8].
      window.__nwDoubles = [];
      f.layers('A').L1.addEventListener('dblclick', e => window.__nwDoubles.push(e.isTrusted), { passive: true });
      return f.vp('A', [30, 2]);
    });
    expect((await state(page, 'A')).active, 'first native press starts inactive').toBe(false);
    await page.mouse.dblclick(p.x, p.y, { delay: 70 });
    await expect.poll(() => page.evaluate(() => window.__fpt.hosts.A.m.describe(window.__fpt.hosts.A.host).collapsed)).toBe(true);
    expect((await state(page, 'A')).active).toBe(true);
    expect(await page.evaluate(() => window.__nwDoubles), 'browser-native double-click reaches retained frame ancestry').toEqual([true]);
  });

  test(`${mode}: issue631 child-origin title-widget masks preserve native pointer and keyboard coordinates under scale`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const points = await page.evaluate(async () => {
      const f = window.__fpt, { widgetFamilyTheme } = await import('/tests/rendering-options/widget-family-fixture.mjs');
      const theme = widgetFamilyTheme(['document-window']);
      // Independent 4x4 close mask: clear (0,0) and (3,2), opaque (2,1).
      // A child beginning at (2,1) maps those native targets to (0,0) and
      // (1,1); using event.offsetX/Y therefore reverses both mask decisions.
      const e = theme.manifest.chromeElements['-14330'];
      const img = new Image(); img.src = e.asset; await img.decode();
      const cv = document.createElement('canvas'); cv.width = 12; cv.height = 8;
      const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0); ctx.clearRect(3, 2, 1, 1); e.asset = cv.toDataURL();
      const parent = document.createElement('div'); parent.style.cssText = 'position:absolute;left:40px;top:60px;transform:scale(1.5);transform-origin:0 0'; document.body.append(parent);
      f.manager(); window.__nwCalls = 0;
      await f.add('A', { slug: 'independent-synthetic', themeObject: theme, parent, left: 0, top: 0, w: 40, h: 40,
        handlers: { onClose: () => window.__nwCalls++ } });
      const original = f.hosts.A.host.shadowRoot.querySelector('.scriptoscope-titlewidget-close'); window.__nwOriginal = original;
      const child = document.createElement('span'); child.dataset.nwChild = ''; window.__nwChild = child;
      child.style.cssText = 'position:absolute;left:2px;top:1px;width:2px;height:3px;pointer-events:auto'; window.__nwDowns = []; original.addEventListener('pointerdown', e => window.__nwDowns.push({ child: e.target === child, trusted: e.isTrusted, offset: [e.offsetX, e.offsetY] }), { capture: true, passive: true });
      // Fixture's authored close rect is [6,4,10,8], not renderer/proxy output.
      return { opaque: f.vp('A', [8, 5]), hole: f.vp('A', [9, 6]) };
    });
    await page.mouse.click(points.opaque.x, points.opaque.y); await settle(page);
    expect(await page.evaluate(() => window.__nwCalls), 'calibration: original opaque mask point acts without added child').toBe(1);
    await page.mouse.click(points.hole.x, points.hole.y); await settle(page);
    expect(await page.evaluate(() => window.__nwCalls), 'calibration: original hole does not act without added child').toBe(1);
    await page.evaluate(() => { window.__nwCalls = 0; window.__nwOriginal.append(window.__nwChild); });
    await page.mouse.click(points.opaque.x, points.opaque.y); await settle(page);
    expect(await page.evaluate(() => window.__nwDowns.at(-1)), 'native trusted press actually targets the offset child').toEqual(expect.objectContaining({ child: true, trusted: true }));
    expect.soft(await page.evaluate(() => window.__nwCalls), 'opaque original-mask point acts through offset child').toBe(1);
    const beforeHole = await page.evaluate(() => window.__nwCalls);
    await page.mouse.click(points.hole.x, points.hole.y); await settle(page);
    expect.soft(await page.evaluate(() => window.__nwCalls), 'original mask hole never becomes opaque through child offset').toBe(beforeHole);
    const beforeKeyboard = await page.evaluate(() => window.__nwCalls);
    await page.evaluate(() => window.__nwOriginal.focus());
    await page.keyboard.press('Enter'); await settle(page);
    expect(await page.evaluate(() => window.__nwCalls), 'original keyboard default action remains available').toBe(beforeKeyboard + 1);
    expect(await page.evaluate(() => { const f = window.__fpt; return f.hosts.A.host.shadowRoot.querySelector('.scriptoscope-titlewidget-close') === window.__nwOriginal && window.__nwOriginal.isConnected; }), 'original button identity survives pointer and keyboard actions').toBe(true);
  });
}
