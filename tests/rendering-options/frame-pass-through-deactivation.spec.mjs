// #597 outside-press deactivation (docs/spec/engine/hit-regions.md §9.5a) and the
// exempt / modal / closed-root rows: HPT16, HPT18, HPT19, HPT34, HPT37.
// Mouse presses are real input. Pen and touch sequences are dispatched as
// PointerEvents at the element the browser hit-tests (`elementFromPoint`), the
// same targets and order a browser uses, because Playwright has no pen and its
// touch emulation differs per engine; HP38/HP39 classify by `composedPath()`,
// `isPrimary` and `pointerType`, which these events carry.
import { test, expect, MODES, boot, fixture, hitAt, state, events, settle } from './frame-pass-through-fixture.mjs';

const PAGE = { x: 1240, y: 930 }; // sentinel, inside the viewport, outside every window

/** Dispatch a pointer sequence at what the browser hit-tests at (x, y). */
const synth = (page, p, steps) => page.evaluate(({ p, steps }) => {
  const el = document.elementFromPoint(p.x, p.y);
  for (const [type, pointerType, extra] of steps) {
    const init = { bubbles: true, composed: true, cancelable: true, clientX: p.x, clientY: p.y, pointerType, isPrimary: true, pointerId: pointerType === 'touch' ? 7 : 3, button: 0, ...(extra ?? {}) };
    const ev = type === 'contextmenu' ? new MouseEvent(type, init) : new PointerEvent(type, init);
    el.dispatchEvent(ev);
  }
  return el === window.__fpt.sentinel ? 'sentinel' : el.tagName;
}, { p, steps });

/** Fresh page state: a dolphin window A (active) and a parked window C, both region. */
async function twoWindows(page, { slug = 'dolphin-som', hitA } = {}) {
  await page.evaluate(async ({ slug, hitA }) => {
    const f = window.__fpt; f.reset(); f.manager();
    await f.add('A', { slug, left: 100, top: 120, ...(hitA ? { hit: hitA } : {}) });
    await f.add('C', { slug: 'dolphin-som', left: 760, top: 520, w: 200, h: 120 });
    f.pageButton('page-btn', 1250, 20);
  }, { slug, hitA });
  return fixture(page, 'A');
}

for (const mode of MODES) {
  test(`${mode}: HPT18 mouse click through p_out: trusted default actions, one deactivation commit, order kept`, async ({ page, servers }) => {
    await boot(page, servers, mode, { sentinel: 'button' });
    // Whether a click focuses the sentinel <button> at all is engine policy (WebKit does not):
    // the default action must match a click on the sentinel where no window is.
    await page.evaluate(() => window.__fpt.reset());
    await page.mouse.click(1240, 930);
    const focusesOnClick = await page.evaluate(() => { const r = document.activeElement === window.__fpt.sentinel; document.activeElement?.blur?.(); return r; });
    const fix = await twoWindows(page);
    const s0 = await state(page, 'A'), z0 = await page.evaluate(() => ['A', 'C'].map(n => window.__fpt.hosts[n].m.describe(window.__fpt.hosts[n].host).z));
    expect(s0.active).toBe(true);
    await events(page);
    await page.mouse.click(fix.vp.p_out.x, fix.vp.p_out.y);
    await settle(page);
    const ev = await events(page), s1 = await state(page, 'A');
    expect(ev.filter(e => e.at === 'sentinel').map(e => e.type)).toEqual(expect.arrayContaining(['pointerdown', 'click']));
    expect(await page.evaluate(() => document.activeElement === window.__fpt.sentinel), 'the sentinel\'s focus default action').toBe(focusesOnClick);
    expect([s1.active, s1.current], 'deactivated').toEqual([false, 'inactive']);
    expect(s1.changes - s0.changes, 'exactly one change-listener call').toBe(1);
    expect(await page.evaluate(() => ['A', 'C'].map(n => window.__fpt.hosts[n].m.describe(window.__fpt.hosts[n].host).z)), 'stacking order kept').toEqual(z0);
    expect((await state(page, 'C')).active, 'no window becomes active').toBe(false);
    // windows-95 in region mode: a page click outside the box deactivates.
    await twoWindows(page, { slug: 'windows-95' });
    await page.mouse.click(PAGE.x, PAGE.y); await settle(page);
    expect((await state(page, 'A')).active, 'windows-95 region: outside click').toBe(false);
  });

  test(`${mode}: HPT18 pen deactivates at press, touch only on the completed tap, never on a swipe or keyboard click`, async ({ page, servers }) => {
    await boot(page, servers, mode, { sentinel: 'button' });
    let fix = await twoWindows(page);
    expect(await synth(page, fix.vp.p_out, [['pointerdown', 'pen']])).toBe('sentinel');
    await settle(page);
    expect((await state(page, 'A')).active, 'pen: inactive at press').toBe(false);
    await synth(page, fix.vp.p_out, [['pointerup', 'pen'], ['click', 'pen']]);
    // Touch tap: pending after pointerdown, committed by the click.
    fix = await twoWindows(page);
    await synth(page, fix.vp.p_out, [['pointerdown', 'touch']]); await settle(page);
    expect((await state(page, 'A')).active, 'touch: still active after pointerdown').toBe(true);
    await synth(page, fix.vp.p_out, [['pointerup', 'touch'], ['click', 'touch']]); await settle(page);
    expect((await state(page, 'A')).active, 'touch: inactive after the click').toBe(false);
    // Touch swipe: pointercancel discards it.
    fix = await twoWindows(page);
    await synth(page, fix.vp.p_out, [['pointerdown', 'touch'], ['pointercancel', 'touch']]); await settle(page);
    expect((await state(page, 'A')).active, 'touch swipe (pointercancel)').toBe(true);
    // Keyboard-activated click on a page button.
    await page.evaluate(() => document.getElementById('page-btn').focus());
    await page.keyboard.press('Enter'); await settle(page);
    expect((await events(page)).some(e => e.at === 'page-btn' && e.type === 'click'), 'the keyboard click happened').toBe(true);
    expect((await state(page, 'A')).active, 'keyboard click').toBe(true);
    // A click with no pending touch tap (element.click()).
    await page.evaluate(() => document.getElementById('page-btn').click()); await settle(page);
    expect((await state(page, 'A')).active, 'element.click()').toBe(true);
  });

  test(`${mode}: HPT18 inside presses (p_c, p_in, a popover from the content) keep the window active; B beneath A's gap takes over`, async ({ page, servers }) => {
    await boot(page, servers, mode, { sentinel: 'button' });
    const fix = await twoWindows(page);
    const c0 = (await state(page, 'A')).changes;
    await page.mouse.click(fix.vp.p_c.x, fix.vp.p_c.y); await settle(page);
    expect((await state(page, 'A')).active, 'p_c').toBe(true);
    await page.mouse.click(fix.vp.p_in.x, fix.vp.p_in.y); await settle(page);
    expect((await state(page, 'A')).active, 'p_in').toBe(true);
    // Inside presses are not deactivate-then-reactivate pairs: no commit at all.
    expect((await state(page, 'A')).changes - c0, 'inside presses: no change-listener call').toBe(0);
    const pop = await page.evaluate(async () => {
      const f = window.__fpt, p = document.createElement('div');
      p.setAttribute('popover', 'manual'); p.textContent = 'popover';
      p.style.cssText = 'position:fixed;inset:auto;left:1150px;top:700px;width:120px;height:60px;margin:0;background:rgb(10,200,10)';
      f.hosts.A.contentEl.append(p); p.showPopover(); await f.settle();
      const box = f.hosts.A.host.getBoundingClientRect();
      return { x: 1210, y: 730, outside: 1210 > box.right || 730 > box.bottom };
    });
    expect(pop.outside, 'the popover is shown outside the box').toBe(true);
    expect(await hitAt(page, pop), 'the popover is hit (top layer)').toMatch(/^content:A$/);
    await page.mouse.click(pop.x, pop.y); await settle(page);
    expect((await state(page, 'A')).active, 'click in the popover is inside').toBe(true);
    // Two windows: B (behind) with its content under A's p_out.
    await page.evaluate(async p => {
      const f = window.__fpt; f.reset(); f.manager();
      await f.add('B', { slug: 'windows-95', left: Math.round(p.x - 160), top: Math.round(p.y - 60), w: 320, h: 200 });
      await f.add('A', { slug: 'dolphin-som', left: 100, top: 120 });
      f.hosts.A.host.dispatchEvent(new PointerEvent('pointerdown')); await f.settle();
    }, fix.vp.p_out);
    expect([(await state(page, 'A')).active, (await state(page, 'B')).active]).toEqual([true, false]);
    expect(await hitAt(page, fix.vp.p_out), 'B lies beneath A\'s gap').toBe('content:B');
    await page.mouse.click(fix.vp.p_out.x, fix.vp.p_out.y); await settle(page);
    expect([(await state(page, 'A')).active, (await state(page, 'B')).active], 'B activates, A deactivates').toEqual([false, true]);
  });

  test(`${mode}: HPT18/HPT16 requested region deactivates exempt windows (built-in, no template, failed build); modal-exempt and box do not`, async ({ page, servers }) => {
    await boot(page, servers, mode, { sentinel: 'button' });
    const cases = {
      'platinum-8': async f => { await f.add('X', { slug: 'platinum-8' }); },
      // HP7 (PM ruling): a recipe whose window type names no chrome template.
      'no-template': async f => {
        const base = await f.theme('dolphin-som');
        const themeObject = { ...base, manifest: { ...base.manifest, windowTypes: { ...base.manifest.windowTypes, 'document-window': { ...base.manifest.windowTypes['document-window'], chrome: {} } } } };
        await f.add('X', { themeObject, slug: 'dolphin-som' });
      },
      'failed-build': async f => {
        const { theme, synthetic } = await f.synth('1984', ['document-window', 'collapsed-document-window'], rgba => { for (let i = 3; i < rgba.length; i += 4) rgba[i] = 0; });
        await f.add('X', { themeObject: theme, slug: '1984', synthetic, extra: { collapsed: true } });
      },
    };
    for (const [label, make] of Object.entries(cases)) {
      const error = await page.evaluate(`(async f => { f.reset(); f.manager(); try { await (${make.toString()})(f); return null; } catch (e) { return String(e); } })(window.__fpt)`);
      expect(error, `${label}: mounts`).toBeNull();
      const s0 = await state(page, 'X');
      expect([s0.active, s0.hitEffective, s0.hit], `${label}: active, effective box, inherited request`).toEqual([true, 'box', undefined]);
      await page.mouse.click(PAGE.x, PAGE.y); await settle(page);
      const s1 = await state(page, 'X');
      expect(s1.active, `${label}: page click deactivates`).toBe(false);
      if (label === 'platinum-8') expect(s1.changes - s0.changes, 'platinum-8: one change-listener call').toBe(1);
    }
    // HPT16: platinum-8 effective box; a PF1 notch pixel hits the window; explicit box stays active.
    await page.evaluate(async () => { const f = window.__fpt; f.reset(); f.manager(); await f.add('P', { slug: 'platinum-8' }); });
    const notch = await page.evaluate(() => { const f = window.__fpt, g = f.geom('P'); return f.rules.builtInNotches(g.W, g.H).map(p => { const v = f.vp('P', p); return f.hitAt(v.x, v.y); }); });
    expect(notch, 'PF1 notches hit the window (box)').toEqual(['host:P', 'host:P', 'host:P', 'host:P']);
    await page.evaluate(async () => {
      const f = window.__fpt; f.reset(); f.manager();
      await f.promote('Q', { slug: 'platinum-8', html: '<article data-scriptoscope-window data-scriptoscope-hit="box" data-scriptoscope-title="" data-scriptoscope-width="320" data-scriptoscope-height="200" data-scriptoscope-x="100" data-scriptoscope-y="120"><p>Q</p></article>' });
    });
    expect((await state(page, 'Q')).active).toBe(true);
    await page.mouse.click(PAGE.x, PAGE.y); await settle(page);
    expect((await state(page, 'Q')).active, 'explicit box: a page press leaves it active').toBe(true);
  });

  test(`${mode}: HPT18 stale touch taps are discarded; the listener set follows the active window's tracking`, async ({ page, servers }) => {
    await boot(page, servers, mode, { sentinel: 'button' });
    // Long-press (contextmenu, no click), then a click with no pending tap.
    let fix = await twoWindows(page);
    await synth(page, fix.vp.p_out, [['pointerdown', 'touch'], ['contextmenu', 'touch']]); await settle(page);
    await page.evaluate(() => document.getElementById('page-btn').click()); await settle(page);
    expect((await state(page, 'A')).active, 'long-press then a click').toBe(true);
    // Touch pointerdown whose touchend the page cancels (no click), then Enter on a button.
    fix = await twoWindows(page);
    await synth(page, fix.vp.p_out, [['pointerdown', 'touch'], ['pointerup', 'touch']]); await settle(page);
    await page.evaluate(() => document.getElementById('page-btn').focus());
    await page.keyboard.press('Enter'); await settle(page);
    expect((await state(page, 'A')).active, 'cancelled touchend then Enter').toBe(true);
    // A pending tap discarded by a later pointerdown (inside, with no click of its own),
    // so the following click carries no pending tap.
    fix = await twoWindows(page);
    await synth(page, fix.vp.p_out, [['pointerdown', 'touch']]);
    await synth(page, fix.vp.p_c, [['pointerdown', 'mouse', { pointerId: 1 }], ['pointerup', 'mouse', { pointerId: 1 }]]);
    await page.evaluate(() => document.getElementById('page-btn').click()); await settle(page);
    expect((await state(page, 'A')).active, 'pending tap discarded by a later pointerdown').toBe(true);
    // Lifecycle: A tracked (inherited region), B explicit box.
    await page.evaluate(async () => {
      const f = window.__fpt; f.reset(); f.manager();
      await f.add('A', { slug: 'dolphin-som', left: 100, top: 120 });
      await f.add('B', { slug: 'dolphin-som', left: 700, top: 500, w: 200, h: 120, hit: 'box' });
    });
    const fa = await fixture(page, 'A'), fb = await fixture(page, 'B');
    await page.mouse.click(fb.vp.p_c.x, fb.vp.p_c.y); await settle(page);
    expect((await state(page, 'B')).active).toBe(true);
    await page.mouse.click(PAGE.x, PAGE.y); await settle(page);
    expect((await state(page, 'B')).active, 'explicit box: page click leaves B active').toBe(true);
    await page.mouse.click(fa.vp.p_c.x, fa.vp.p_c.y); await settle(page);
    expect((await state(page, 'A')).active).toBe(true);
    await page.mouse.click(PAGE.x, PAGE.y); await settle(page);
    expect((await state(page, 'A')).active, 'pressing A re-arms deactivation').toBe(false);
  });

  test(`${mode}: HPT19 iframe presses, window blur and Tab to a page link leave the window active`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await twoWindows(page);
    await page.evaluate(async () => {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:absolute;left:1000px;top:120px;width:240px;height:120px;z-index:5;border:1px solid';
      frame.srcdoc = '<button id="in-frame" style="width:200px;height:80px">frame</button>';
      document.body.append(frame);
      await new Promise(r => frame.addEventListener('load', r, { once: true }));
    });
    await page.frameLocator('iframe').locator('#in-frame').click(); await settle(page);
    expect((await state(page, 'A')).active, 'same-origin iframe press').toBe(true);
    await page.evaluate(() => window.blur()); await settle(page);
    expect((await state(page, 'A')).active, 'window.blur()').toBe(true);
    await page.evaluate(async () => {
      const f = window.__fpt, input = document.createElement('input'); input.id = 'in-content';
      f.hosts.A.contentEl.append(input);
      // Explicit tabindex: WebKit and Firefox on macOS skip plain links on Tab.
      const link = document.createElement('a'); link.href = '#x'; link.id = 'page-link'; link.textContent = 'link'; link.tabIndex = 0;
      link.style.cssText = 'position:absolute;left:1250px;top:60px;z-index:5';
      f.hosts.A.host.after(link);
      window.focus(); input.focus(); await f.settle();
    });
    // Tab out through the window's own controls to the page link.
    let where = null;
    for (let i = 0; i < 12 && where !== 'page-link'; i++) { await page.keyboard.press('Tab'); where = await page.evaluate(() => document.activeElement?.id); }
    await settle(page);
    expect(where, 'focus reached the page link').toBe('page-link');
    expect((await state(page, 'A')).active, 'Tab to a page link').toBe(true);
  });

  test(`${mode}: HPT34 openModal windows are box, are not deactivated, and return to region on close`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      const style = document.createElement('style');
      style.textContent = '#wrap{position:fixed;inset:0;z-index:50;visibility:hidden;background:rgba(0,0,0,.15)} #wrap[data-scriptoscope-modal-open]{visibility:visible}';
      document.head.append(style);
      const wrap = document.createElement('div'); wrap.id = 'wrap'; document.body.append(wrap);
      await f.promote('M', { slug: 'beos-r503', type: 'movable-modal', parent: wrap,
        html: '<article data-scriptoscope-window data-scriptoscope-window-type="movable-modal" data-scriptoscope-title="" data-scriptoscope-width="320" data-scriptoscope-height="200" data-scriptoscope-x="200" data-scriptoscope-y="160"><p>Modal</p></article>' });
    });
    const fix = await fixture(page, 'M');
    expect(fix.points.p_out, 'beos-r503 movable-modal has a decoded gap').toBeTruthy();
    expect((await state(page, 'M')).hitEffective, 'closed wrap: region').toBe('region');
    await page.evaluate(() => { window.__modal = window.__fpt.decl.openModal(document.getElementById('wrap')); });
    await settle(page);
    let s = await state(page, 'M');
    expect([s.hitEffective, s.attr], 'open: box').toEqual(['box', 'box']);
    expect(await hitAt(page, fix.vp.p_out), 'open: p_out hits the modal window').toBe('host:M');
    const c0 = s.changes;
    await page.mouse.click(fix.vp.p_out.x, fix.vp.p_out.y); await settle(page);
    expect(await page.evaluate(() => document.getElementById('wrap').hasAttribute('data-scriptoscope-modal-open')), 'the gap press does not close the modal').toBe(true);
    expect((await state(page, 'M')).changes - c0, 'no change-listener call').toBe(0);
    // A commit while exempt still builds S (HP22), so close can apply it without a commit.
    await page.evaluate(async () => { const f = window.__fpt; await f.hosts.M.m.applyState(f.hosts.M.host, { width: 340, height: 210 }); await f.settle(); });
    const fixOpen = await fixture(page, 'M');
    // Backdrop press: the window is not deactivated by it (the click then closes the modal).
    await page.mouse.move(1200, 900); await page.mouse.down(); await settle(page);
    expect((await state(page, 'M')).active, 'backdrop press does not deactivate the modal').toBe(true);
    await page.mouse.up(); await settle(page);
    expect(await page.evaluate(() => document.getElementById('wrap').hasAttribute('data-scriptoscope-modal-open')), 'backdrop click closed it').toBe(false);
    s = await state(page, 'M');
    expect(s.hitEffective, 'after close: region again').toBe('region');
    expect(await hitAt(page, fixOpen.vp.p_out), 'after close: the S built while exempt is applied').not.toMatch(/:M$/);
    // A window promoted into the wrap while it is open.
    await page.evaluate(async () => {
      const f = window.__fpt; window.__modal = f.decl.openModal(document.getElementById('wrap')); await f.settle();
      await f.promote('M2', { slug: 'beos-r503', type: 'movable-modal', parent: document.getElementById('wrap'),
        html: '<article data-scriptoscope-window data-scriptoscope-window-type="movable-modal" data-scriptoscope-title="" data-scriptoscope-width="200" data-scriptoscope-height="120" data-scriptoscope-x="700" data-scriptoscope-y="160"><p>Late</p></article>' });
    });
    expect((await state(page, 'M2')).hitEffective, 'promoted into an open wrap: box').toBe('box');
    await page.evaluate(async () => { window.__modal.close(); await window.__fpt.settle(); });
    const fix2 = await fixture(page, 'M2');
    expect([(await state(page, 'M')).hitEffective, (await state(page, 'M2')).hitEffective], 'both region after close').toEqual(['region', 'region']);
    expect(await hitAt(page, fix2.vp.p_out), 'S built while exempt applies at close').not.toMatch(/:M2$/);
  });

  test(`${mode}: HPT37 a host inside a closed shadow root: an inside press makes no change-listener call; one log`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const r = await page.evaluate(async () => {
      const f = window.__fpt, m = f.manager(); f.logs.length = 0;
      const outer = document.createElement('div'); outer.style.cssText = 'position:absolute;left:0;top:0;z-index:2';
      document.body.append(outer);
      const root = outer.attachShadow({ mode: 'closed' });
      const contentEl = document.createElement('div'); contentEl.textContent = 'closed'; contentEl.style.height = '100%';
      const host = await m.add(await f.theme('dolphin-som'), { width: 320, height: 200, title: '' }, {}, { contentEl });
      root.append(host); m.setPosition(host, 120, 140);
      f.hosts.Z = { host, slug: 'dolphin-som', type: 'document-window', m, contentEl };
      await f.settle();
      const o = await f.oracle('Z'), p = f.points(o);
      return { pc: f.vp('Z', p.p_c), active: m.describe(host).active };
    });
    expect(r.active).toBe(true);
    const c0 = (await state(page, 'Z')).changes;
    await page.mouse.click(r.pc.x, r.pc.y); await settle(page);
    // HP47 (PM ruling): one `closed shadow root` event by the first sync or press after insertion.
    const logs = await page.evaluate(() => window.__fpt.region().filter(l => /closed shadow root/.test(l.label)).map(l => l.label));
    expect(logs, 'one debug log for the closed root').toHaveLength(1);
    expect((await state(page, 'Z')).changes - c0, 'no deactivate-then-reactivate').toBe(0);
    expect((await state(page, 'Z')).active).toBe(true);
  });
}
