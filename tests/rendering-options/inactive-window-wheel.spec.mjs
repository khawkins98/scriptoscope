// #614 wheel axis (docs/spec/engine/inactive-window-input.md §7.3, hooks IPT10 and IPT10a).
//
// IP11: with Shift held, the horizontal amount is deltaX when it is not 0, otherwise deltaY,
// and the vertical amount is 0; without Shift, deltaX and deltaY. IP12: each themed bar
// applies its own amount; an axis without a themed bar ignores its amount. IP13: the event is
// consumed (preventDefault) iff some themed bar receives >= 0.5 px, and wheel input never
// activates a window.
//
// The events are synthetic WheelEvents created with `bubbles: true, cancelable: true` (without
// `cancelable`, `defaultPrevented` is always false), dispatched on an element inside the
// window's content. A synthetic wheel event has no native default action, so any scroll comes
// from the window's own wheel handling. Observables: the content's scrollLeft/scrollTop,
// `defaultPrevented`, `describe().active` and the change listener.
import { test, expect, MODES, boot, settle } from './frame-pass-through-fixture.mjs';

/** Add windows: `bars` 'both' (900 × 3000 content) or 'vertical' (full-width, 3000 tall). */
async function setup(page, specs) {
  await page.evaluate(async specs => {
    const f = window.__fpt;
    f.reset(); f.manager();
    for (const { name, bars, left, top } of specs) {
      const content = document.createElement('div');
      content.style.cssText = 'width:100%;height:100%;overflow:auto;box-sizing:border-box;background:rgb(255,255,255)';
      content.innerHTML = bars === 'both' ? '<div class="iw-inner" style="width:900px;height:3000px"></div>' : '<div class="iw-inner" style="height:3000px"></div>';
      await f.add(name, { slug: 'windows-95', w: 240, h: 160, title: name, left, top, content });
    }
    const wheel = window.__wheel = {
      bars: name => ['vertical', 'horizontal'].filter(axis => f.hosts[name].host.shadowRoot.querySelector(`[role=scrollbar][aria-orientation=${axis}]`)),
      el: name => f.hosts[name].contentEl,
      pos: name => ({ left: wheel.el(name).scrollLeft, top: wheel.el(name).scrollTop }),
      middle(name) {
        const s = wheel.el(name);
        s.scrollTo({ left: Math.round((s.scrollWidth - s.clientWidth) / 2), top: Math.round((s.scrollHeight - s.clientHeight) / 2), behavior: 'instant' });
        return wheel.pos(name);
      },
      /** Dispatch one cancelable wheel event inside the content; returns the scroll change and defaultPrevented. */
      async send(name, init) {
        const target = wheel.el(name).querySelector('.iw-inner'), before = wheel.pos(name);
        const ev = new WheelEvent('wheel', { bubbles: true, cancelable: true, composed: true, deltaMode: 0, clientX: 0, clientY: 0, ...init });
        target.dispatchEvent(ev);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const after = wheel.pos(name);
        return { dx: after.left - before.left, dy: after.top - before.top, prevented: ev.defaultPrevented };
      },
    };
  }, specs);
  await settle(page);
}

const send = (page, name, init) => page.evaluate(([name, init]) => window.__wheel.send(name, init), [name, init]);

for (const mode of MODES) {
  test(`${mode}: IPT10 Shift turns a vertical wheel into horizontal scrolling; only themed bars consume`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await setup(page, [{ name: 'W', bars: 'both', left: 40, top: 60 }, { name: 'V', bars: 'vertical', left: 460, top: 60 }]);
    expect(await page.evaluate(() => window.__wheel.bars('W')), 'W shows both themed bars').toEqual(['vertical', 'horizontal']);
    expect(await page.evaluate(() => window.__wheel.bars('V')), 'V shows only the vertical themed bar').toEqual(['vertical']);
    const cases = [
      ['a', { deltaY: 120, shiftKey: true }, { dx: 120, dy: 0 }],
      ['b', { deltaX: 120, deltaY: 0, shiftKey: true }, { dx: 120, dy: 0 }],
      ['c', { deltaY: 120 }, { dx: 0, dy: 120 }],
      ['d', { deltaX: 120 }, { dx: 120, dy: 0 }],
    ];
    for (const [id, init, want] of cases) {
      const mid = await page.evaluate(() => window.__wheel.middle('W'));
      expect(mid.left > 120 && mid.top > 120, `(${id}) W is scrolled to the middle with room on both axes`).toBe(true);
      const r = await send(page, 'W', init);
      expect({ dx: Math.round(r.dx), dy: Math.round(r.dy) }, `(${id}) ${JSON.stringify(init)}: scroll change`).toEqual(want);
      expect(r.prevented, `(${id}) ${JSON.stringify(init)}: defaultPrevented`).toBe(true);
    }
    // Vertical-only window, case (a): the horizontal amount has no themed bar, the vertical amount is 0.
    await page.evaluate(() => window.__wheel.middle('V'));
    const v = await send(page, 'V', { deltaY: 120, shiftKey: true });
    expect({ dx: Math.round(v.dx), dy: Math.round(v.dy) }, 'vertical-only (a): nothing scrolls').toEqual({ dx: 0, dy: 0 });
    expect(v.prevented, 'vertical-only (a): not defaultPrevented').toBe(false);
    // Calibration: the same window does consume an unshifted vertical wheel.
    const vc = await send(page, 'V', { deltaY: 120 });
    expect([Math.round(vc.dy), vc.prevented], 'vertical-only (c) still scrolls and consumes').toEqual([120, true]);
  });

  // Guards existing behaviour (docs/interaction.md §1: wheel scrolls an inactive window without
  // activating it): expected to pass before #614.
  test(`${mode}: IPT10a a wheel over an inactive window scrolls it without activating either window`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await setup(page, [{ name: 'A', bars: 'vertical', left: 40, top: 60 }, { name: 'B', bars: 'vertical', left: 460, top: 60 }]);
    const state = () => page.evaluate(() => Object.fromEntries(['A', 'B'].map(n => { const h = window.__fpt.hosts[n]; return [n, { active: h.m.describe(h.host).active, changes: window.__fpt.changes.get(h.host) ?? 0 }]; })));
    const s0 = await state();
    expect([s0.A.active, s0.B.active], 'A active, B inactive').toEqual([true, false]);
    expect(await page.evaluate(() => window.__wheel.bars('B')), 'B shows a themed vertical bar').toEqual(['vertical']);
    // B's content is not covered by A at the dispatch point.
    expect(await page.evaluate(() => {
      const r = window.__wheel.el('B').getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const host = window.__fpt.hosts.B.host;
      return document.elementFromPoint(x, y) === host || host.contains(document.elementFromPoint(x, y));
    }), 'B\'s content is uncovered').toBe(true);
    const r = await send(page, 'B', { deltaY: 120 });
    await settle(page);
    expect([Math.round(r.dy), r.prevented], 'B scrolls by 120 and consumes the event').toEqual([120, true]);
    expect(await state(), 'B stays inactive, A stays active, no change-listener call').toEqual(s0);
  });
}
