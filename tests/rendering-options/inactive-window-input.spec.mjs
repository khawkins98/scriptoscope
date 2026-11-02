// #614 inactive-window widget and grow-box input (docs/spec/engine/inactive-window-input.md
// §7.1, §7.4, §8: hooks IPT1–IPT7 and IPT11–IPT14; the wheel hooks IPT10/IPT10a and the
// initial-activation hooks IPT8/IPT9 live in inactive-window-wheel.spec.mjs and
// inactive-window-initial-state.spec.mjs).
//
// Policy, not decode (§7): a primary pointer press on an inactive window's title widget
// or grow box only activates and raises it (IP1, IP14); the next press acts (IP2);
// keyboard and assistive technology are unchanged (IP3, DECISIONS #12); a detail-0 zoom or
// collapse activates first (IP5) and zoom no longer bumps `z` by itself.
//
// Every expectation is a public observable: `describe()` (active, z, width, height,
// collapsed), the host's z-index and box, the shadow DOM (overlay buttons, focus, the grow
// outline), the change listener, `onClose`/`onZoom`/`onCollapse` call counts,
// `scriptoscope:userresize`, the `region` debug channel and chrome-canvas pixels. Mouse
// input is real Playwright input; pen and touch are dispatched as PointerEvents at the
// element the browser hit-tests, as frame-pass-through-deactivation.spec.mjs does, and each
// synthetic path is calibrated against an active window so a dead path cannot pass.
import { test, expect, MODES, boot, settle, fixture } from './frame-pass-through-fixture.mjs';

const PAGE = { x: 1240, y: 930 }; // the sentinel: inside the viewport, outside every window
const tabKey = browserName => process.platform === 'darwin' && browserName === 'webkit' ? 'Alt+Tab' : 'Tab';

/** Boot the #597 fixture and add the #614 helpers (window.__iw). */
async function bootIW(page, servers, mode) {
  await boot(page, servers, mode);
  await page.evaluate(() => {
    const f = window.__fpt;
    const calls = [], closeEvents = [], userResize = [];
    addEventListener('scriptoscope:close', e => closeEvents.push(e.target?.dataset?.fptName), true);
    addEventListener('scriptoscope:userresize', e => userResize.push(e.target?.dataset?.fptName), true);
    const iw = window.__iw = {
      calls, closeEvents, userResize,
      /** Counting handlers for `kinds` of window `name`. */
      handlers: (name, kinds) => Object.fromEntries(kinds.map(k => [`on${k[0].toUpperCase()}${k.slice(1)}`, () => calls.push(`${name}:${k}`)])),
      count: (name, kind) => calls.filter(c => c === `${name}:${kind}`).length,
      resized: name => userResize.filter(n => n === name).length,
      closed: name => closeEvents.filter(n => n === name).length,
      root: name => f.hosts[name].host.shadowRoot,
      widget: (name, role) => iw.root(name).querySelector(`.scriptoscope-titlewidget-${role}`),
      widgets: name => [...iw.root(name).querySelectorAll('.scriptoscope-titlewidget')],
      // The built-in frame also draws its grow art into a canvas with the same class: the control is the button.
      grow: name => iw.root(name).querySelector('button.scriptoscope-growbox'),
      canvas: name => iw.root(name).querySelector('canvas.scriptoscope-chrome'),
      d: name => { const h = f.hosts[name]; return h && h.m.describe(h.host); },
      zi: name => Number(getComputedStyle(f.hosts[name].host).zIndex),
      box: name => { const r = f.hosts[name].host.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; },
      flow: name => { const host = f.hosts[name].host; return { inline: host.style.position, computed: getComputedStyle(host).position,
        placeholders: document.querySelectorAll('[data-scriptoscope-placeholder]').length }; },
      outlines: name => iw.root(name).querySelectorAll('.scriptoscope-decoration div[style*="dotted"]').length
        + f.hosts[name].host.querySelectorAll(':scope > div[style*="dotted"]').length,
      /**
       * A viewport point over `el` (a node in window `name`'s shadow root) that the browser
       * hit-tests to it, nearest the element's centre. Null when none.
       */
      pointOn(name, el) {
        const host = f.hosts[name].host, r = el.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        let best = null;
        for (let y = Math.floor(r.top); y < r.bottom; y++) for (let x = Math.floor(r.left); x < r.right; x++) {
          const px = x + 0.5, py = y + 0.5;
          if (document.elementFromPoint(px, py) !== host || host.shadowRoot.elementFromPoint(px, py) !== el) continue;
          const dist = (px - cx) ** 2 + (py - cy) ** 2;
          if (!best || dist < best.dist) best = { x: px, y: py, dist };
        }
        return best && { x: best.x, y: best.y };
      },
      /** Viewport → chrome-canvas pixel of window `name`. */
      toCanvas(name, vx, vy) {
        const c = iw.canvas(name), r = c.getBoundingClientRect(), k = r.width / c.width;
        return { x: Math.floor((vx - r.left) / k), y: Math.floor((vy - r.top) / k) };
      },
      pixel(name, cx, cy) { return Array.from(iw.canvas(name).getContext('2d').getImageData(cx, cy, 1, 1).data); },
      image(name) { const c = iw.canvas(name); return { w: c.width, h: c.height, data: Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data) }; },
      /** Dispatch a pen or touch pointer sequence at the element the browser hit-tests at `p`. */
      synth(name, p, steps) {
        const host = f.hosts[name].host, target = host.shadowRoot.elementFromPoint(p.x, p.y) ?? host;
        for (const [type, pointerType, dx = 0, dy = 0] of steps) {
          const init = { bubbles: true, composed: true, cancelable: true, clientX: p.x + dx, clientY: p.y + dy, pointerType, isPrimary: true,
            pointerId: pointerType === 'touch' ? 7 : 3, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0,
            ...(type === 'click' ? { detail: 1 } : {}) };
          target.dispatchEvent(new PointerEvent(type, init));
        }
        return target.className || target.tagName;
      },
    };
  });
}

/** Two windows A (active) and B in one manager, side by side. */
async function pair(page, { slug, type = 'document-window', kinds = ['close'], w = 240, h = 140, titleB = 'B', flowB = false, zoomable = false } = {}) {
  await page.evaluate(async ({ slug, type, kinds, w, h, titleB, flowB, zoomable }) => {
    const f = window.__fpt, iw = window.__iw;
    f.reset(); iw.calls.length = 0; iw.closeEvents.length = 0; iw.userResize.length = 0;
    document.querySelectorAll('.iw-flow').forEach(n => n.remove());
    f.manager();
    // Built-in zoom grows a window to its content's scroll size (docs/interaction.md §4), so a
    // zoomable window gets content larger than the window.
    const content = name => {
      if (!zoomable) return undefined;
      const el = document.createElement('div');
      el.style.cssText = 'height:100%;box-sizing:border-box;overflow:auto;background:rgb(255,255,255)';
      el.innerHTML = `<div style="width:420px;height:300px">${name} content</div>`;
      return el;
    };
    await f.add('A', { slug, type, w, h, title: 'A', left: 40, top: 60, content: content('A'), handlers: iw.handlers('A', kinds) });
    if (flowB) {
      const wrap = document.createElement('div');
      wrap.className = 'iw-flow';
      wrap.style.cssText = 'position:relative;margin:60px 0 0 460px;width:600px;z-index:1';
      document.body.append(wrap);
      await f.promote('B', { slug, type, parent: wrap, html: `<div data-scriptoscope-window data-scriptoscope-title="${titleB}" data-scriptoscope-window-type="${type}" data-scriptoscope-width="${w}" data-scriptoscope-height="${h}">B content</div>` });
    } else {
      await f.add('B', { slug, type, w, h, title: titleB, left: 460, top: 60, content: content('B'), handlers: iw.handlers('B', kinds) });
    }
  }, { slug, type, kinds, w, h, titleB, flowB, zoomable });
  await settle(page);
  expect(await page.evaluate(() => [window.__iw.d('A').active, window.__iw.d('B').active]), `${slug} ${type}: A starts active, B inactive`).toEqual([true, false]);
}

const iw = (page, fn, arg) => page.evaluate(([src, arg]) => (0, eval)(src)(window.__iw, window.__fpt, arg), [fn.toString(), arg]);
const pointOn = (page, name, sel) => iw(page, (iw, f, [name, sel]) => {
  const el = sel === 'grow' ? iw.grow(name) : sel === 'move' ? iw.root(name).querySelector('.scriptoscope-movehandle') : iw.widget(name, sel);
  return el ? iw.pointOn(name, el) : null;
}, [name, sel]);
const snap = (page, name) => iw(page, (iw, f, name) => {
  const d = iw.d(name);
  return { exists: !!d && f.hosts[name].host.isConnected, active: d?.active, z: d?.z, zi: d ? iw.zi(name) : null,
    width: d?.width, height: d?.height, collapsed: d?.collapsed, box: d ? iw.box(name) : null, changes: d ? f.changes.get(f.hosts[name].host) ?? 0 : null,
    close: iw.count(name, 'close'), closeEvents: iw.closed(name), zoom: iw.count(name, 'zoom'), collapse: iw.count(name, 'collapse'), resized: iw.resized(name) };
}, name);

/** B became active and is above A. */
async function expectActivatedAbove(page, why) {
  await expect.poll(async () => (await snap(page, 'B')).active, `${why}: B is active`).toBe(true);
  const [a, b] = [await snap(page, 'A'), await snap(page, 'B')];
  expect(a.active, `${why}: A is inactive (one active window)`).toBe(false);
  expect(b.zi, `${why}: B's z-index is above A's`).toBeGreaterThan(a.zi);
}

// ── IPT1 (IP1, IP2) ──────────────────────────────────────────────────────────
// The first click on an inactive window's widget only activates it; the second acts.
// Frame drag capture retargets the real mouse click away from the widget in every
// engine. IPT1 cannot guard the click-time check; IPT3 is its only guard.
// beos-r503 has no collapse widget; collapse is exercised on windows-95.
for (const mode of MODES) for (const slug of ['windows-95', 'beos-r503']) {
  test(`${mode}: IPT1 ${slug} first click on an inactive window's close, zoom or collapse only activates; the second acts`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    const roles = slug === 'windows-95' ? ['close', 'zoom', 'collapse'] : ['close', 'zoom'];
    for (const role of roles) {
      await pair(page, { slug, zoomable: true });
      const why = `${slug} ${role}`;
      const p = await pointOn(page, 'B', role);
      expect(p, `${why}: B has a ${role} widget overlay`).not.toBeNull();
      const before = await snap(page, 'B');
      await page.mouse.click(p.x, p.y);
      await settle(page);
      await expectActivatedAbove(page, `${why} first click`);
      expect(await iw(page, (iw, f) => iw.root('B').activeElement?.className ?? ''),
        `${why}: first press moves keyboard focus to B's move handle (IP1)`).toContain('scriptoscope-movehandle');
      const first = await snap(page, 'B');
      expect(first.exists, `${why}: B still exists`).toBe(true);
      expect([first.close, first.closeEvents], `${why}: no close on the first click`).toEqual([0, 0]);
      expect([first.width, first.height, first.box.w, first.box.h], `${why}: size unchanged by the first click`).toEqual([before.width, before.height, before.box.w, before.box.h]);
      expect(first.collapsed, `${why}: not collapsed by the first click`).toBe(false);
      // The second click acts (IP2). Re-measure: the activation render may move the widget art.
      const q = await pointOn(page, 'B', role);
      await page.mouse.click(q.x, q.y);
      await settle(page);
      const second = await snap(page, 'B');
      if (role === 'close') expect(second.close, `${why}: the second click closes`).toBe(1);
      if (role === 'zoom') expect([second.width, second.height], `${why}: the second click zooms`).not.toEqual([before.width, before.height]);
      if (role === 'collapse') expect(second.collapsed, `${why}: the second click collapses`).toBe(true);
    }
  });
}

// ── IPT1a (IP1, pressed art) ─────────────────────────────────────────────────
// Sampled every animation frame from before the press until the release, holding at
// least 300 ms past B's activation commit: the pressed-close value never appears.
for (const mode of MODES) for (const slug of ['windows-95', 'platinum-8']) {
  test(`${mode}: IPT1a ${slug} holding a press on an inactive window's close never draws pressed art`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    const w = 240, h = 140;
    // Reference: an active window R with B's geometry and title, pressed on its close (IP2).
    await page.evaluate(async ({ slug, w, h }) => {
      const f = window.__fpt, iw = window.__iw;
      f.reset(); f.manager();
      await f.add('R', { slug, w, h, title: 'B', left: 460, top: 60, handlers: iw.handlers('R', ['close']) });
    }, { slug, w, h });
    await settle(page);
    const rp = await pointOn(page, 'R', 'close');
    expect(rp, `${slug}: R has a close overlay`).not.toBeNull();
    const normal = await iw(page, iw => iw.image('R'));
    const rect = await iw(page, (iw, f) => { const r = iw.widget('R', 'close').getBoundingClientRect(), a = iw.toCanvas('R', r.left, r.top), b = iw.toCanvas('R', r.right - 0.01, r.bottom - 0.01); return { l: a.x, t: a.y, r: b.x + 1, b: b.y + 1 }; });
    await page.mouse.move(rp.x, rp.y); await page.mouse.down();
    await expect.poll(() => iw(page, (iw, f, n) => iw.image('R').data.some((v, i) => v !== n[i]), normal.data), `${slug}: a press on the active window's close draws pressed art`).toBe(true);
    const pressed = await iw(page, iw => iw.image('R'));
    await page.mouse.move(rp.x, rp.y + 200, { steps: 4 }); await page.mouse.up(); await settle(page);
    expect(await iw(page, iw => iw.count('R', 'close')), `${slug}: release outside the active widget cancels`).toBe(0);

    await pair(page, { slug, w, h });
    const inactive = await iw(page, iw => iw.image('B'));
    expect([inactive.w, inactive.h], `${slug}: B's canvas matches the reference geometry`).toEqual([normal.w, normal.h]);
    // A pixel inside the close rect where pressed differs from both normal-active and inactive.
    const at = (img, x, y) => img.data.slice((y * img.w + x) * 4, (y * img.w + x) * 4 + 4);
    const cx = (rect.l + rect.r) / 2, cy = (rect.t + rect.b) / 2;
    let pick = null;
    for (let y = rect.t; y < rect.b; y++) for (let x = rect.l; x < rect.r; x++) {
      const P = at(pressed, x, y), N = at(normal, x, y), I = at(inactive, x, y);
      if (P.join() === N.join() || P.join() === I.join()) continue;
      const dist = (x - cx) ** 2 + (y - cy) ** 2;
      if (!pick || dist < pick.dist) pick = { x, y, dist, P, N, I };
    }
    expect(pick, `${slug}: a close pixel distinguishes pressed from normal and inactive`).not.toBeNull();

    const p = await pointOn(page, 'B', 'close');
    expect(p, `${slug}: B has a close overlay (IP3/IP4)`).not.toBeNull();
    await page.evaluate(({ x, y }) => {
      const f = window.__fpt, iw = window.__iw, h = f.hosts.B;
      const s = iw.sampler = { samples: [], activeAt: null, stop: false, downAt: null, changes0: f.changes.get(h.host) ?? 0 };
      addEventListener('pointerdown', () => { s.downAt ??= s.samples.length; }, { capture: true, once: true });
      const step = () => {
        if (s.stop) return;
        const t = performance.now(), active = h.m.describe(h.host)?.active, ch = (f.changes.get(h.host) ?? 0) - s.changes0;
        if (s.activeAt === null && active && ch >= 1) s.activeAt = t;
        s.samples.push({ t, v: iw.pixel('B', x, y).join(), active });
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { x: pick.x, y: pick.y });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await expect.poll(() => page.evaluate(() => window.__iw.sampler.activeAt !== null), `${slug}: B activates (and commits) during the press`).toBe(true);
    await page.waitForFunction(() => { const s = window.__iw.sampler; return performance.now() - s.activeAt >= 320; });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    // Release outside the widget (after IP1 the press is a frame press, so B may move with it).
    await page.mouse.move(p.x, p.y + 120, { steps: 4 });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const s = await page.evaluate(() => { const s = window.__iw.sampler; s.stop = true; return { samples: s.samples, activeAt: s.activeAt, downAt: s.downAt }; });
    await page.mouse.up(); await settle(page);
    const held = s.samples.filter(x => x.t >= s.activeAt);
    expect(s.downAt, `${slug}: sampling began before the pointerdown`).toBeGreaterThan(0);
    expect(held.length, `${slug}: sampled every frame over the hold`).toBeGreaterThanOrEqual(10);
    expect(held.at(-1).t - s.activeAt, `${slug}: held at least 300 ms past activation`).toBeGreaterThanOrEqual(300);
    const pressedAt = s.samples.findIndex(x => x.v === pick.P.join());
    expect(pressedAt, `${slug}: the pressed value ${pick.P} never appears (first at sample ${pressedAt} of ${s.samples.length})`).toBe(-1);
    expect(s.samples.at(-1).v, `${slug}: the last sample before release is the normal active render`).toBe(pick.N.join());
    expect((await snap(page, 'B')).close, `${slug}: no close`).toBe(0);
  });
}

// ── IPT1b (IP1, IP14, #620 outside-press deactivation) ──────────────────────
for (const mode of MODES) {
  test(`${mode}: IPT1b a window deactivated by an outside press is inactive, not "frontmost means active"`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    for (const part of ['close', 'grow']) {
      await pair(page, { slug: 'dolphin-som' });
      // Make A the frontmost window by stacking number too: a press on the active window raises it.
      // p_in: a title-bar point in A's structure region, clear of the widgets (the #597 oracle).
      const grip = (await fixture(page, 'A')).vp.p_in;
      await page.mouse.click(grip.x, grip.y); await settle(page);
      expect((await snap(page, 'A')).z, `${part}: A has the highest stacking number`).toBeGreaterThan((await snap(page, 'B')).z);
      // A is the active, frontmost window; an outside press deactivates it (HP39) and keeps its order.
      await page.mouse.click(PAGE.x, PAGE.y); await settle(page);
      const a0 = await snap(page, 'A'), b0 = await snap(page, 'B');
      expect(a0.active, `${part}: the outside press deactivated A`).toBe(false);
      expect(a0.zi, `${part}: A stays frontmost`).toBeGreaterThan(b0.zi);
      const p = await pointOn(page, 'A', part);
      expect(p, `${part}: A's ${part} overlay is hit-testable`).not.toBeNull();
      if (part === 'close') await page.mouse.click(p.x, p.y);
      else {
        await page.mouse.move(p.x, p.y); await page.mouse.down();
        await page.mouse.move(p.x + 20, p.y + 15, { steps: 3 }); await page.mouse.move(p.x + 40, p.y + 30, { steps: 3 });
        await page.mouse.up();
      }
      await settle(page);
      const a1 = await snap(page, 'A');
      expect(a1.active, `${part}: A becomes active`).toBe(true);
      expect([a1.exists, a1.close], `${part}: A is not closed`).toEqual([true, 0]);
      expect([a1.width, a1.height, a1.resized], `${part}: A keeps its size`).toEqual([a0.width, a0.height, 0]);
    }
  });
}

// ── IPT2 (IP1) ───────────────────────────────────────────────────────────────
for (const mode of MODES) {
  test(`${mode}: IPT2 a drag from an inactive window's zoom moves and activates it without zooming`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    await pair(page, { slug: 'windows-95', zoomable: true });
    let before = await snap(page, 'B');
    let p = await pointOn(page, 'B', 'zoom');
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x + 15, p.y, { steps: 3 }); await page.mouse.move(p.x + 30, p.y, { steps: 3 });
    await page.mouse.up(); await settle(page);
    await expectActivatedAbove(page, 'drag from zoom');
    let after = await snap(page, 'B');
    expect([Math.round(after.box.x - before.box.x), Math.round(after.box.y - before.box.y)], 'B moved by (30, 0)').toEqual([30, 0]);
    expect([after.width, after.height, after.box.w, after.box.h], 'B is not zoomed').toEqual([before.width, before.height, before.box.w, before.box.h]);
    // A press without movement only activates (#561).
    await pair(page, { slug: 'windows-95', zoomable: true });
    before = await snap(page, 'B');
    p = await pointOn(page, 'B', 'zoom');
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up(); await settle(page);
    await expectActivatedAbove(page, 'press without movement');
    after = await snap(page, 'B');
    expect(after.box, 'no move').toEqual(before.box);
    expect([after.width, after.height], 'no zoom').toEqual([before.width, before.height]);
  });
}

// ── IPT3 (IP1): touch and pen ───────────────────────────────────────────────
for (const mode of MODES) for (const pointerType of ['touch', 'pen']) {
  test(`${mode}: IPT3 a ${pointerType} tap on an inactive window's close only activates; a second tap closes`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    await pair(page, { slug: 'windows-95' });
    const p = await pointOn(page, 'B', 'close');
    const tap = [['pointerdown', pointerType], ['pointerup', pointerType], ['click', pointerType]];
    expect(await iw(page, (iw, f, [p, tap]) => iw.synth('B', p, tap), [p, tap])).toContain('scriptoscope-titlewidget-close');
    await settle(page);
    await expectActivatedAbove(page, `${pointerType} tap`);
    const first = await snap(page, 'B');
    expect([first.exists, first.close, first.closeEvents], `${pointerType}: B still exists, no close`).toEqual([true, 0, 0]);
    // Calibration: the same synthetic tap on the now-active window closes it (IP2).
    const q = await pointOn(page, 'B', 'close');
    await iw(page, (iw, f, [p, tap]) => iw.synth('B', p, tap), [q, tap]);
    await settle(page);
    expect((await snap(page, 'B')).close, `${pointerType}: a second tap closes`).toBe(1);
  });
}

// ── IPT4 (IP4): built-in frame draws no widgets while inactive ───────────────
for (const mode of MODES) for (const [slug, type] of [['platinum-8', 'document-window'], ['system7-nostalgia-silver', 'titled-utility-window']]) {
  test(`${mode}: IPT4 ${slug} ${type} a click where the inactive window's close would be only activates; the glyph then draws`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    await pair(page, { slug, type });
    const p = await pointOn(page, 'B', 'close');
    expect(p, 'the close button stays in place on the inactive window (IP3, IP4)').not.toBeNull();
    const c = await iw(page, (iw, f, p) => iw.toCanvas('B', p.x, p.y), p);
    const before = await iw(page, (iw, f, c) => iw.pixel('B', c.x, c.y), c);
    await page.mouse.click(p.x, p.y); await settle(page);
    await expectActivatedAbove(page, `${slug}`);
    const first = await snap(page, 'B');
    expect([first.exists, first.close], 'not closed').toEqual([true, 0]);
    await expect.poll(() => iw(page, (iw, f, c) => iw.pixel('B', c.x, c.y), c), 'the active re-render draws the close glyph').not.toEqual(before);
    const q = await pointOn(page, 'B', 'close');
    await page.mouse.click(q.x, q.y); await settle(page);
    expect((await snap(page, 'B')).close, 'the second click closes').toBe(1);
  });
}

// ── IPT5 (IP3, IP4): keyboard unchanged ──────────────────────────────────────
// Guards existing behaviour (DECISIONS #12, #550): expected to pass before #614.
for (const mode of MODES) for (const slug of ['platinum-8', 'windows-95']) {
  test(`${mode}: IPT5 ${slug} Tab reaches an inactive window's Close, activates it, and Enter closes it`, async ({ page, servers, browserName }) => {
    await bootIW(page, servers, mode);
    await pair(page, { slug, kinds: ['close', 'zoom', 'collapse'] });
    await iw(page, iw => { iw.kept = iw.widgets('B'); return iw.kept.length; }).then(n => expect(n, 'B has its widget buttons while inactive').toBeGreaterThan(0));
    await page.evaluate(() => { document.activeElement?.blur?.(); });
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press(tabKey(browserName));
      reached = await iw(page, iw => iw.root('B').activeElement === iw.widget('B', 'close'));
    }
    expect(reached, 'Tab reaches B\'s Close').toBe(true);
    await expect.poll(async () => (await snap(page, 'B')).active, 'B is active before Enter').toBe(true);
    await settle(page);
    expect(await iw(page, iw => iw.widgets('B').length === iw.kept.length && iw.widgets('B').every((b, i) => b === iw.kept[i])), 'the widget buttons are the same nodes after activation (#533)').toBe(true);
    await page.keyboard.press('Enter');
    expect((await snap(page, 'B')).close, 'Enter closes B').toBe(1);
  });
}

// ── IPT6 (IP5): detail-0 zoom and collapse activate first ────────────────────
for (const mode of MODES) {
  test(`${mode}: IPT6 element.click() on an inactive window's zoom or collapse activates and raises it; close does not`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    const click = role => iw(page, (iw, f, role) => iw.widget('B', role).click(), role);
    // Built-in zoom and collapse.
    for (const role of ['zoom', 'collapse']) {
      await pair(page, { slug: 'windows-95', zoomable: true });
      const before = await snap(page, 'B');
      await click(role); await settle(page);
      const after = await snap(page, 'B');
      if (role === 'zoom') expect([after.width, after.height], 'built-in zoom ran').not.toEqual([before.width, before.height]);
      else expect(after.collapsed, 'built-in collapse ran').toBe(true);
      await expectActivatedAbove(page, `built-in ${role}`);
    }
    // Consumer handlers.
    for (const role of ['zoom', 'collapse']) {
      await pair(page, { slug: 'windows-95', kinds: ['close', role] });
      await click(role); await settle(page);
      expect((await snap(page, 'B'))[role], `onZ${role.slice(1)} handler ran once`).toBe(1);
      await expectActivatedAbove(page, `handler ${role}`);
    }
    // Close does not activate.
    await pair(page, { slug: 'windows-95' });
    await click('close'); await settle(page);
    expect((await snap(page, 'B')).close, 'onClose fired once').toBe(1);
    expect((await snap(page, 'A')).active, 'A stays active').toBe(true);
    expect((await snap(page, 'B')).active, 'B is not activated by close').toBe(false);
  });
}

// ── IPT7 (IP5): a widget press on the active window leaves z alone ───────────
for (const mode of MODES) {
  test(`${mode}: IPT7 zooming the active window by pointer leaves its z unchanged`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    await pair(page, { slug: 'windows-95', zoomable: true });
    const z0 = (await snap(page, 'A')).z;
    for (const n of [1, 2]) {
      const w0 = (await snap(page, 'A')).width;
      const p = await pointOn(page, 'A', 'zoom');
      await page.mouse.click(p.x, p.y); await settle(page);
      const a = await snap(page, 'A'), b = await snap(page, 'B');
      expect(a.width, `zoom ${n} ran`).not.toBe(w0);
      expect(a.z, `zoom ${n}: A's z unchanged`).toBe(z0);
      expect([a.active, a.zi > b.zi], `zoom ${n}: A stays active and above B`).toEqual([true, true]);
    }
  });
}

// ── IPT11 (IW14): transparent widget pixels pass through ─────────────────────
// Guards existing behaviour (#597): expected to pass before #614.
// dolphin-som's own close rect is opaque in both templates at this size (every pixel of the
// §4.2 oracle is IN), so, as HPT31 does for windows-95, the left half of the close part's
// template rect is made mask-clear in a synthetic copy. The point is chosen from the decode
// oracle applied to that copy, never from the runtime's region or clip.
for (const mode of MODES) {
  test(`${mode}: IPT11 a press on a transparent pixel inside an inactive window's close rect reaches the page`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    // Find which part is close on an unedited window, then build the synthetic pair.
    const closePart = await page.evaluate(async () => {
      const f = window.__fpt, iw = window.__iw;
      f.reset(); f.manager();
      await f.add('P', { slug: 'dolphin-som', w: 240, h: 140, left: 460, top: 60, handlers: iw.handlers('P', ['close']) });
      const o = await f.oracle('P'), cv = iw.canvas('P').getBoundingClientRect(), wr = iw.widget('P', 'close').getBoundingClientRect();
      const rect = { left: Math.round(wr.left - cv.left), top: Math.round(wr.top - cv.top), right: Math.round(wr.right - cv.left), bottom: Math.round(wr.bottom - cv.top) };
      const parts = ['part-1', 'part-2', 'part-3'].filter(k => o.wt.parts[k]);
      const i = o.widgets.findIndex(w => w.left === rect.left && w.top === rect.top && w.right === rect.right && w.bottom === rect.bottom);
      return i < 0 ? null : parts[i];
    });
    expect(closePart, 'the close overlay is one of the decoded widget parts').not.toBeNull();
    const p = await page.evaluate(async closePart => {
      const f = window.__fpt, iw = window.__iw;
      f.reset(); iw.calls.length = 0; f.manager();
      const dec = await f.decode('dolphin-som'), wt = dec.manifest.windowTypes['document-window'], [l, t, rr, b] = wt.parts[closePart].rect;
      const s = await f.synth('dolphin-som', ['document-window'], (rgba, w) => { for (let y = t; y < b; y++) for (let x = l; x < l + Math.floor((rr - l) / 2); x++) rgba[(y * w + x) * 4 + 3] = 0; });
      await f.add('A', { themeObject: s.theme, synthetic: s.synthetic, slug: 'dolphin-som', w: 240, h: 140, title: 'A', left: 40, top: 60, handlers: iw.handlers('A', ['close']) });
      await f.add('B', { themeObject: s.theme, synthetic: s.synthetic, slug: 'dolphin-som', w: 240, h: 140, title: 'B', left: 460, top: 60, handlers: iw.handlers('B', ['close']) });
      const o = await f.oracle('B');
      const cv = iw.canvas('B').getBoundingClientRect(), wr = iw.widget('B', 'close').getBoundingClientRect();
      const a = { x: Math.round(wr.left - cv.left), y: Math.round(wr.top - cv.top) }, z = { x: Math.round(wr.right - cv.left), y: Math.round(wr.bottom - cv.top) };
      const cx = (a.x + z.x) / 2, cy = (a.y + z.y) / 2;
      let best = null;
      for (let y = a.y + 1; y < z.y - 1; y++) for (let x = a.x + 1; x < z.x - 1; x++) {
        let clear = true;
        for (let dy = -1; dy <= 1 && clear; dy++) for (let dx = -1; dx <= 1; dx++) if (f.value(o, [x + dx, y + dy]) !== f.rules.OUT) { clear = false; break; }
        if (!clear) continue;
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (!best || d < best.d) best = { x, y, d };
      }
      return { state: o.state, vp: best && f.vp('B', [best.x, best.y]) };
    }, closePart);
    expect(p.state, 'the oracle used B\'s inactive template').toBe('inactive');
    expect(p.vp, 'the synthetic close rect has a transparent pixel (oracle OUT)').not.toBeNull();
    await settle(page);
    expect(await page.evaluate(() => [window.__iw.d('A').active, window.__iw.d('B').active]), 'A active, B inactive').toEqual([true, false]);
    await page.evaluate(() => window.__fpt.events.splice(0));
    await page.mouse.click(p.vp.x, p.vp.y); await settle(page);
    const ev = await page.evaluate(() => window.__fpt.events.splice(0));
    expect(ev.filter(e => e.at === 'sentinel').map(e => e.type), 'the press reaches the page beneath').toEqual(expect.arrayContaining(['pointerdown', 'click']));
    const b = await snap(page, 'B');
    expect([b.active, b.close], 'B is not activated and not closed').toEqual([false, 0]);
  });
}

// ── IPT12 (IP14): the first grow-box press only activates ────────────────────
async function growDrag(page, p, { dx = 40, dy = 30, midCheck } = {}) {
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await settle(page);
  const afterPress = await page.evaluate(() => window.__fpt.builds().length);
  await page.mouse.move(p.x + dx / 2, p.y + dy / 2, { steps: 3 });
  await page.mouse.move(p.x + dx, p.y + dy, { steps: 3 });
  const mid = midCheck ? await midCheck() : null;
  await page.mouse.up();
  await settle(page);
  return { afterPress, mid };
}

for (const mode of MODES) for (const slug of ['windows-95', 'platinum-8']) for (const placement of ['absolute', 'in-flow']) {
  test(`${mode}: IPT12 ${slug} ${placement} the first press on an inactive window's grow box only activates; the next resizes`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    const flowB = placement === 'in-flow';
    await pair(page, { slug, flowB });
    const watch = () => iw(page, iw => {
      const added = iw.added = [];
      iw.mo?.disconnect();
      iw.mo = new MutationObserver(list => { for (const r of list) for (const n of r.addedNodes) if (n.nodeType === 1) added.push(n.outerHTML.slice(0, 160)); });
      iw.mo.observe(iw.root('B'), { childList: true, subtree: true });
      iw.mo.observe(window.__fpt.hosts.B.host, { childList: true });
    });
    const dotted = () => iw(page, iw => { iw.mo.takeRecords().forEach(r => r.addedNodes.forEach(n => n.nodeType === 1 && iw.added.push(n.outerHTML.slice(0, 160)))); return iw.added.filter(s => /dotted/.test(s)).length + iw.outlines('B'); });
    const flow = () => iw(page, iw => iw.flow('B'));
    const before = await snap(page, 'B'), flow0 = await flow();
    if (flowB) expect(flow0.computed, 'B is in flow').toBe('static');
    const p = await pointOn(page, 'B', 'grow');
    expect(p, 'B\'s grow box is hit-testable').not.toBeNull();
    await watch();
    const g1 = await growDrag(page, p, { midCheck: dotted });
    await expectActivatedAbove(page, `${slug} ${placement} first grow press`);
    const after = await snap(page, 'B');
    expect([after.width, after.height], 'content size unchanged').toEqual([before.width, before.height]);
    expect(after.box, 'host position and size unchanged').toEqual(before.box);
    expect(await flow(), 'no Posture-B handoff: position style unchanged, no placeholder').toEqual(flow0);
    expect(after.resized, 'no scriptoscope:userresize').toBe(0);
    expect(g1.mid, 'no resize outline appeared during the drag').toBe(0);
    expect(await dotted(), 'no resize outline at any point of the gesture').toBe(0);
    expect(await page.evaluate(() => window.__fpt.builds().length), 'no region build beyond the activation commit').toBe(g1.afterPress);
    expect(await iw(page, iw => iw.root('B').activeElement === iw.grow('B')), 'keyboard focus is on B\'s grow box').toBe(true);
    // The next identical drag resizes by (40, 30) / scale (scale 1) and fires userresize once.
    const q = await pointOn(page, 'B', 'grow');
    await watch();
    const g2 = await growDrag(page, q, { midCheck: dotted });
    const resized = await snap(page, 'B');
    expect(g2.mid, 'calibration: the active resize draws an outline').toBeGreaterThan(0);
    expect([resized.width - before.width, resized.height - before.height], 'the second drag resizes by (40, 30)').toEqual([40, 30]);
    expect(resized.resized, 'scriptoscope:userresize fired once').toBe(1);
    // A press without movement on the inactive grow box also only activates.
    await pair(page, { slug, flowB });
    const b0 = await snap(page, 'B'), f0 = await flow();
    const r = await pointOn(page, 'B', 'grow');
    await page.mouse.move(r.x, r.y); await page.mouse.down(); await page.mouse.up(); await settle(page);
    await expectActivatedAbove(page, 'press without movement');
    const b1 = await snap(page, 'B');
    expect([b1.width, b1.height, b1.resized], 'no resize').toEqual([b0.width, b0.height, 0]);
    expect([b1.box, await flow()], 'no move, no handoff').toEqual([b0.box, f0]);
  });
}

// Utility frame: the grow overlay's outer 2 px decode to wInDrag (IW10a), but IP14 makes the
// whole overlay one rule: activate only, no frame drag.
for (const mode of MODES) {
  test(`${mode}: IPT12 system7-nostalgia-silver utility: a drag from the grow overlay's outer 2 px only activates`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    await pair(page, { slug: 'system7-nostalgia-silver', type: 'titled-utility-window' });
    const p = await iw(page, (iw, f) => {
      const host = f.hosts.B.host, c = host.shadowRoot.querySelector('.scriptoscope-content').getBoundingClientRect();
      const cv = iw.canvas('B').getBoundingClientRect(), k = cv.width / iw.canvas('B').width;
      // Canvas pixel (C.r + 1, C.b + 1): inside the grow rect (C.r − 14 … C.r + 2), past the content edges.
      const x = c.right + 1.5 * k, y = c.bottom + 1.5 * k;
      return { x, y, hit: host.shadowRoot.elementFromPoint(x, y) === iw.grow('B') && document.elementFromPoint(x, y) === host };
    });
    expect(p.hit, 'the outer-2px point is on B\'s grow overlay').toBe(true);
    const before = await snap(page, 'B');
    await growDrag(page, p);
    await expectActivatedAbove(page, 'utility outer 2 px');
    const after = await snap(page, 'B');
    expect(after.box, 'no move (no frame drag), no resize').toEqual(before.box);
    expect([after.width, after.height, after.resized], 'size unchanged, no userresize').toEqual([before.width, before.height, 0]);
  });
}

// ── IPT13 (IP14): touch and pen on the inactive grow box ─────────────────────
for (const mode of MODES) for (const pointerType of ['touch', 'pen']) {
  test(`${mode}: IPT13 a ${pointerType} drag on an inactive window's grow box only activates; the next resizes`, async ({ page, servers }) => {
    await bootIW(page, servers, mode);
    await pair(page, { slug: 'windows-95' });
    const drag = [['pointerdown', pointerType], ['pointermove', pointerType, 20, 15], ['pointermove', pointerType, 40, 30], ['pointerup', pointerType, 40, 30]];
    const before = await snap(page, 'B');
    const p = await pointOn(page, 'B', 'grow');
    expect(await iw(page, (iw, f, [p, drag]) => iw.synth('B', p, drag), [p, drag])).toContain('scriptoscope-growbox');
    await settle(page);
    await expectActivatedAbove(page, `${pointerType} grow drag`);
    const after = await snap(page, 'B');
    expect([after.width, after.height, after.resized], `${pointerType}: no resize, no userresize`).toEqual([before.width, before.height, 0]);
    expect(after.box, `${pointerType}: no move`).toEqual(before.box);
    // Calibration: the same synthetic drag on the now-active window resizes.
    const q = await pointOn(page, 'B', 'grow');
    await iw(page, (iw, f, [p, drag]) => iw.synth('B', p, drag), [q, drag]);
    await settle(page);
    const resized = await snap(page, 'B');
    expect([resized.width - before.width, resized.height - before.height, resized.resized], `${pointerType}: the second drag resizes`).toEqual([40, 30, 1]);
  });
}

// ── IPT14 (IP14, IP3): keyboard resize unchanged ─────────────────────────────
// Guards existing behaviour (#550): expected to pass before #614.
for (const mode of MODES) {
  test(`${mode}: IPT14 focusing an inactive window's grow box activates it; ArrowRight resizes by 8 px`, async ({ page, servers, browserName }) => {
    await bootIW(page, servers, mode);
    await pair(page, { slug: 'windows-95' });
    // A page button after B in DOM order: Shift+Tab lands on B's last stop, its grow box, while B is inactive.
    await page.evaluate(() => { const b = window.__fpt.pageButton('after-b', 1100, 20); document.body.append(b); b.focus(); });
    const back = `Shift+${tabKey(browserName)}`;
    await iw(page, iw => {
      iw.focusLog = [];
      iw.grow('B').addEventListener('focus', () => iw.focusLog.push(iw.d('B').active), { once: true });
    });
    await page.keyboard.press(back);
    expect(await iw(page, iw => iw.root('B').activeElement === iw.grow('B')), 'Shift+Tab reaches B\'s grow box').toBe(true);
    expect(await iw(page, iw => iw.focusLog), 'B was inactive when its grow box took focus').toEqual([false]);
    await expect.poll(async () => (await snap(page, 'B')).active, 'focus activates B').toBe(true);
    const w0 = (await snap(page, 'B')).width;
    await page.keyboard.press('ArrowRight'); await settle(page);
    expect((await snap(page, 'B')).width - w0, 'ArrowRight resizes by 8 px').toBe(8);
  });
}
