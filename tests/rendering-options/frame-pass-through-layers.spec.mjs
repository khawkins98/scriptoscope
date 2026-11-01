// #597 layering, focus, shadow, transforms and accessibility hooks
// (docs/spec/engine/hit-regions.md §9.3, §9.5, §9.6, §9.8): HPT8, HPT9, HPT10,
// HPT11, HPT12, HPT15, HPT28, HPT29, HPT33, HPT40. Captures run at DPR 1, k = 1 (HP18) unless a
// hook says otherwise.
import { readFileSync } from 'node:fs';
import { TAB_SCENARIO, tabSequence } from './frame-pass-through-tab-order.mjs';
import { test, expect, MODES, FIXTURES, NEGATIVE, EXEMPT, boot, fixture, hitAt, state, events, settle, capture } from './frame-pass-through-fixture.mjs';

const SHADOW = '4px 5px 0 rgb(1, 2, 3)';
const TAB_REFERENCE = JSON.parse(readFileSync(new URL('./frame-pass-through-tab-order.json', import.meta.url), 'utf8'));
const setHit = (page, name, hit) => page.evaluate(async ({ name, hit }) => { const f = window.__fpt; await f.hosts[name].m.applyState(f.hosts[name].host, { hit }); await f.settle(); }, { name, hit });
// Pixels that differ by more than 2 levels in a channel. Firefox composites a clipped layer
// with ±1-level blending differences on anti-aliased ring edges; a clipped or missing ring
// or shadow changes pixels by far more.
const TOLERANCE = 2;
const diffCount = (a, b) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) > TOLERANCE || Math.abs(a.data[i + 1] - b.data[i + 1]) > TOLERANCE || Math.abs(a.data[i + 2] - b.data[i + 2]) > TOLERANCE) n++; return n; };
const sameImage = (a, b) => a.w === b.w && a.h === b.h && diffCount(a, b) === 0;

/** Tab from the document start until the deep active element has `label` (or `test` passes). */
async function tabTo(page, target) {
  const match = l => l === target;
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return a?.getAttribute?.('aria-label') ?? a?.id ?? a?.tagName; });
    if (match(label)) return label;
  }
  // WebKit's default Tab skips <button>s (no full keyboard access): focus the control
  // programmatically after keyboard input, so it still matches :focus-visible.
  return page.evaluate(target => {
    const test = l => l === target;
    for (const host of document.querySelectorAll('[data-scriptoscope-window-host]'))
      for (const el of [...host.shadowRoot.querySelectorAll('[aria-label]'), ...host.querySelectorAll('[id]')])
        if (test(el.getAttribute('aria-label') ?? el.id)) { el.focus(); return el.getAttribute('aria-label') ?? el.id; }
    for (const el of document.querySelectorAll('[id]')) if (test(el.id)) { el.focus(); return el.id; }
    return null;
  }, target);
}

for (const mode of MODES) {
  test(`${mode}: HPT8 focus rings of overlays are drawn unclipped in region mode and match box mode`, async ({ page, servers }, info) => {
    test.setTimeout(180_000);
    await boot(page, servers, mode);
    const controls = ['Move window', 'Close window', 'Resize window', 'Scroll content vertically'];
    const rows = [];
    for (const label of controls) {
      await page.evaluate(async () => {
        const f = window.__fpt; f.reset(); f.manager();
        const content = document.createElement('div'); content.innerHTML = '<p>Tall content</p>'.repeat(30);
        Object.assign(content.style, { height: '100%', overflow: 'auto', boxSizing: 'border-box', background: 'rgb(255,255,255)' });
        await f.add('A', { slug: 'dolphin-som', content, handlers: { onClose() {} }, left: 120, top: 140 });
      });
      expect((await state(page, 'A')).hitEffective).toBe('region');
      expect(await tabTo(page, label), `Tab reaches ${label}`).toBe(label);
      await settle(page);
      const rect = await page.evaluate(label => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return a.getBoundingClientRect().toJSON(); }, label);
      const clip = { x: rect.x - 8, y: rect.y - 8, width: rect.width + 16, height: rect.height + 16 };
      const region = await capture(page, clip);
      await setHit(page, 'A', 'box');
      const box = await capture(page, clip);
      await setHit(page, 'A', 'region');
      await page.evaluate(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; a.blur(); });
      await settle(page);
      const none = await capture(page, clip);
      // Ring pixels: changed by focus. Outside S: decoded excluded pixels or beyond the box.
      const o = await page.evaluate(async () => { const f = window.__fpt, o = await f.oracle('A'), g = f.geom('A'); return { W: o.W, H: o.H, left: g.left, top: g.top, region: Array.from(o.region) }; });
      let ring = 0, outside = 0, above = 0;
      for (let y = 0; y < region.h; y++) for (let x = 0; x < region.w; x++) {
        const i = (y * region.w + x) * 4;
        if (region.data[i] === none.data[i] && region.data[i + 1] === none.data[i + 1] && region.data[i + 2] === none.data[i + 2]) continue;
        ring++;
        const cx = region.x + x - o.left, cy = region.y + y - o.top;
        if (cy < 0) above++;
        if (cx < 0 || cy < 0 || cx >= o.W || cy >= o.H || o.region[cy * o.W + cx] === 0) outside++;
      }
      rows.push({ label, ring, outside, above, sameAsBox: sameImage(region, box), diffVsBox: diffCount(region, box) });
      expect(ring, `${label}: a visible ring`).toBeGreaterThan(0);
      expect(sameImage(region, box), `${label}: region capture matches box (${diffCount(region, box)} px differ)`).toBe(true);
      if (label === 'Move window') expect(above, 'move-handle ring above the top edge').toBeGreaterThan(0);
    }
    info.annotations.push({ type: 'observation', description: JSON.stringify(rows) });
    expect(rows.reduce((s, r) => s + r.outside, 0), 'ring pixels lie outside S').toBeGreaterThan(0);
  });

  test(`${mode}: HPT9 the shell shadow paints past the bottom-right edge in both modes`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async shadow => { const f = window.__fpt; f.manager(); await f.add('A', { slug: 'dolphin-som' }); f.hosts.A.host.style.setProperty('--scriptoscope-window-shadow', shadow); await f.settle(); }, SHADOW);
    for (const hit of ['region', 'box']) {
      await setHit(page, 'A', hit);
      expect((await state(page, 'A')).hitEffective).toBe(hit);
      const r = await page.evaluate(() => { const f = window.__fpt, h = f.hosts.A.host, part = h.shadowRoot.querySelector('[part~=window]'), b = h.getBoundingClientRect();
        return { b: b.toJSON(), host: getComputedStyle(h).boxShadow, part: getComputedStyle(part).boxShadow, filter: getComputedStyle(part).filter }; });
      expect([r.host, r.part, r.filter], hit).toEqual(['none', 'rgb(1, 2, 3) 4px 5px 0px 0px', 'none']);
      const img = await capture(page, { x: r.b.right - 2, y: r.b.bottom - 2, width: 8, height: 8 });
      const at = (x, y) => img.data.slice(((y - img.y) * img.w + (x - img.x)) * 4, ((y - img.y) * img.w + (x - img.x)) * 4 + 3);
      expect(at(Math.round(r.b.right) + 2, Math.round(r.b.bottom) + 3), `${hit}: shadow colour`).toEqual([1, 2, 3]);
    }
  });

  test(`${mode}: HPT10 at rest every fixture looks the same in region and box modes, shadow included`, async ({ page, servers }) => {
    test.setTimeout(240_000);
    await boot(page, servers, mode);
    const all = { ...FIXTURES, 'windows-95': NEGATIVE, 'platinum-8': EXEMPT };
    for (const [label, fx] of Object.entries(all)) {
      await page.evaluate(async ({ fx, shadow }) => { const f = window.__fpt; f.reset(); f.manager(); await f.add('A', { slug: fx.slug, type: fx.type }); f.hosts.A.host.style.setProperty('--scriptoscope-window-shadow', shadow); await f.settle(); }, { fx, shadow: SHADOW });
      if (label !== 'platinum-8') expect((await state(page, 'A')).hitEffective, label).toBe('region');
      const b = await page.evaluate(() => window.__fpt.hosts.A.host.getBoundingClientRect().toJSON());
      const clip = { x: b.x - 4, y: b.y - 4, width: b.width + 14, height: b.height + 14 };
      const region = await capture(page, clip);
      await setHit(page, 'A', 'box');
      const box = await capture(page, clip);
      expect(diffCount(region, box), `${label}: pixels differing between modes`).toBe(0);
    }
  });

  test(`${mode}: HPT11 scaled, rotated and skewed ancestors and k = 2: p_out passes, p_in hits`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const rows = [];
    for (const [label, transform, scale] of [['scale', 'scale(1.5)', 1], ['rotate', 'rotate(7deg)', 1], ['skew', 'skewX(10deg)', 1], ['k2', 'none', 2]]) {
      const r = await page.evaluate(async ({ transform, scale }) => {
        const f = window.__fpt; f.reset(); f.manager();
        document.getElementById('wrapper')?.remove();
        const wrapper = document.createElement('div'); wrapper.id = 'wrapper';
        wrapper.style.cssText = `position:absolute;left:80px;top:60px;width:900px;height:700px;transform-origin:0 0;transform:${transform};z-index:1`;
        document.body.append(wrapper);
        await f.add('A', { slug: 'dolphin-som', w: scale === 2 ? 200 : 320, h: scale === 2 ? 120 : 200, scale, parent: wrapper, left: 20, top: 20 });
        const o = await f.oracle('A'), p = f.points(o, { r: 2 });
        const [out, inn, c] = f.vpT('A', [p.p_out, p.p_in, p.p_c], wrapper);
        return { p, out: f.hitAt(out.x, out.y), in: f.hitAt(inn.x, inn.y), c: f.hitAt(c.x, c.y) };
      }, { transform, scale });
      rows.push({ label, ...r });
      // p_out passes to whatever lies beneath: the transformed wrapper or the sentinel.
      expect([r.out.replace('#wrapper', 'sentinel'), r.in, r.c], label).toEqual(['sentinel', 'host:A', 'content:A']);
    }
  });

  test(`${mode}: HPT11 at DPR 2 p_out passes and p_in hits`, async ({ browser, servers }) => {
    const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1280, height: 960 } });
    try {
      const page = await context.newPage();
      await boot(page, servers, mode);
      await page.evaluate(async () => { const f = window.__fpt; f.manager(); await f.add('A', { slug: 'dolphin-som' }); });
      const fix = await fixture(page, 'A');
      expect([await hitAt(page, fix.vp.p_out), await hitAt(page, fix.vp.p_in), await hitAt(page, fix.vp.p_c)]).toEqual(['sentinel', 'host:A', 'content:A']);
    } finally { await context.close(); }
  });

  test(`${mode}: HPT12 a fixed descendant is clipped to S in region mode only; a popover shows fully in both`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.__fpt; f.manager(); await f.add('A', { slug: 'dolphin-som', left: 120, top: 140 });
      const b = f.hosts.A.host.getBoundingClientRect();
      const fixed = document.createElement('div'); fixed.id = 'fixed';
      fixed.style.cssText = `position:fixed;left:${b.right - 60}px;top:${b.top + 100}px;width:160px;height:60px;background:rgb(200,0,0);z-index:3`;
      const pop = document.createElement('div'); pop.id = 'pop'; pop.setAttribute('popover', 'manual');
      pop.style.cssText = `position:fixed;inset:auto;margin:0;left:${b.right - 60}px;top:${b.top + 220}px;width:160px;height:60px;background:rgb(0,0,200)`;
      f.hosts.A.contentEl.append(fixed, pop); pop.showPopover();
      await f.settle();
    });
    const pts = await page.evaluate(() => { const b = window.__fpt.hosts.A.host.getBoundingClientRect(); return { fixed: { x: b.right + 40, y: b.top + 130 }, pop: { x: b.right + 40, y: b.top + 250 } }; });
    const probe = () => page.evaluate(pts => Object.fromEntries(Object.entries(pts).map(([k, p]) => { const el = document.elementFromPoint(p.x, p.y); return [k, el === window.__fpt.sentinel ? 'sentinel' : el?.id || el?.tagName]; })), pts);
    expect((await state(page, 'A')).hitEffective).toBe('region');
    expect(await probe(), 'region').toEqual({ fixed: 'sentinel', pop: 'pop' });
    await setHit(page, 'A', 'box');
    expect(await probe(), 'box').toEqual({ fixed: 'fixed', pop: 'pop' });
  });

  test(`${mode}: HPT15 accessibility tree and Tab order are identical in both modes; keyboard move and resize work in region mode`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      const content = document.createElement('div'); content.innerHTML = '<p>Tall</p>'.repeat(30) + '<button id="in-content">inside</button>';
      Object.assign(content.style, { height: '100%', overflow: 'auto', boxSizing: 'border-box' });
      await f.add('A', { slug: 'dolphin-som', content, title: 'Accessible', handlers: { onClose() {}, onZoom() {} } });
      // Bracket the window between two page controls, so the sequence never wraps into browser UI.
      const b = document.createElement('input'); b.id = 'tab-start'; b.style.cssText = 'position:absolute;left:1100px;top:900px;z-index:5;width:60px'; document.body.prepend(b);
      const e = document.createElement('input'); e.id = 'tab-end'; e.style.cssText = 'position:absolute;left:1180px;top:900px;z-index:5;width:60px'; f.hosts.A.host.after(e);
    });
    expect((await state(page, 'A')).hitEffective).toBe('region');
    const order = async () => {
      // A fixed starting point: a page button before everything else.
      await page.evaluate(() => document.getElementById('tab-start').focus());
      const out = [];
      for (let i = 0; i < 20 && out.at(-1) !== 'tab-end'; i++) {
        await page.keyboard.press('Tab');
        out.push(await page.evaluate(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return a?.getAttribute?.('aria-label') ?? (a?.id || `${a?.tagName}.${a?.className}`); }));
      }
      return out;
    };
    const regionTree = await page.locator('body').ariaSnapshot(), regionOrder = await order();
    await setHit(page, 'A', 'box');
    const boxTree = await page.locator('body').ariaSnapshot(), boxOrder = await order();
    expect(regionTree).toBe(boxTree);
    expect(regionOrder).toEqual(boxOrder);
    expect(regionOrder, 'the Tab sequence reaches the window').toContain('Move window');
    await setHit(page, 'A', 'region');
    const left0 = parseFloat((await state(page, 'A')).left);
    expect(await tabTo(page, 'Move window')).toBe('Move window');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await settle(page);
    expect(parseFloat((await state(page, 'A')).left), 'keyboard move').toBeGreaterThan(left0);
    const w0 = await page.evaluate(() => window.__fpt.geom('A').W);
    expect(await tabTo(page, 'Resize window')).toBe('Resize window');
    await page.keyboard.press('ArrowRight'); await settle(page, 300);
    expect(await page.evaluate(() => window.__fpt.geom('A').W), 'keyboard resize').toBeGreaterThan(w0);
  });

  test(`${mode}: HPT28 consumer clip-path and pointer-events on the host cannot clip or disable a region window`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(() => { const s = document.createElement('style'); s.textContent = '.hostile{clip-path:circle(10px);pointer-events:none}'; document.head.append(s); });
    for (const kind of ['declarative', 'imperative']) {
      await page.evaluate(async kind => {
        const f = window.__fpt; f.reset(); f.manager();
        if (kind === 'declarative') await f.promote('A', { slug: 'dolphin-som', html: '<article class="hostile" data-scriptoscope-window data-scriptoscope-title="" data-scriptoscope-width="320" data-scriptoscope-height="200" data-scriptoscope-x="120" data-scriptoscope-y="140"><p>Body</p></article>' });
        else { await f.add('A', { slug: 'dolphin-som' }); f.hosts.A.host.classList.add('hostile'); await f.settle(); }
      }, kind);
      const fix = await fixture(page, 'A');
      expect(await page.evaluate(() => window.__fpt.hosts.A.host.classList.contains('hostile')), `${kind}: class on the host`).toBe(true);
      expect(await page.evaluate(() => getComputedStyle(window.__fpt.hosts.A.host).clipPath), `${kind}: host clip-path locked`).toBe('none');
      expect(await hitAt(page, fix.vp.p_in), `${kind} region: p_in hits`).toBe('host:A');
      expect(await hitAt(page, { x: fix.vp.p_c.x + 140, y: fix.vp.p_c.y + 80 }), `${kind} region: far from the circle`).toBe('content:A');
      await setHit(page, 'A', 'box');
      expect(await page.evaluate(() => getComputedStyle(window.__fpt.hosts.A.host).pointerEvents), `${kind} box: consumer pointer-events applies`).toBe('none');
      expect(await hitAt(page, fix.vp.p_in), `${kind} box: the consumer's pointer-events: none applies again`).toBe('sentinel');
      expect(await page.evaluate(() => window.__fpt.hosts.A.host.style.pointerEvents), `${kind} box: no inline pointer-events`).toBe('');
      await page.evaluate(() => window.__fpt.hosts.A.host.classList.remove('hostile'));
      expect(await hitAt(page, fix.vp.p_in), `${kind} box: without the consumer rule the host hits again`).toBe('host:A');
    }
  });

  test(`${mode}: HPT29 the host focus outline and a content input's ring look the same in both modes`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      await f.promote('A', { slug: 'dolphin-som', html: '<article data-scriptoscope-window data-scriptoscope-title="" data-scriptoscope-width="320" data-scriptoscope-height="200" data-scriptoscope-x="120" data-scriptoscope-y="140"><p>Body</p><input id="field" value="text"></article>' });
      f.hosts.A.host.tabIndex = 0; f.hosts.A.host.id = 'the-host';
    });
    for (const [label, target] of [['host outline', 'the-host'], ['input ring', 'field']]) {
      expect(await tabTo(page, target), `Tab reaches ${label}`).toBe(target);
      await settle(page);
      const b = await page.evaluate(() => window.__fpt.hosts.A.host.getBoundingClientRect().toJSON());
      const clip = { x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 16 };
      await setHit(page, 'A', 'region');
      expect((await state(page, 'A')).hitEffective).toBe('region');
      const region = await capture(page, clip);
      await setHit(page, 'A', 'box');
      const box = await capture(page, clip);
      expect(diffCount(region, box), `${label}: differing pixels`).toBe(0);
    }
  });

  test(`${mode}: HPT33 at p_out hover, cursor and wheel go to the page beneath`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      f.sentinel.style.overflow = 'auto';
      const tall = document.createElement('div'); tall.style.cssText = 'height:4000px;width:10px'; f.sentinel.append(tall);
      const content = document.createElement('div'); content.innerHTML = '<p>Tall content</p>'.repeat(40);
      Object.assign(content.style, { height: '100%', overflow: 'auto', boxSizing: 'border-box' });
      await f.add('A', { slug: 'dolphin-som', content });
    });
    const fix = await fixture(page, 'A');
    await page.mouse.move(fix.vp.p_c.x, fix.vp.p_c.y);
    await events(page);
    await page.mouse.move(fix.vp.p_out.x, fix.vp.p_out.y);
    await settle(page);
    expect((await events(page)).filter(e => e.at === 'sentinel').map(e => e.type), 'pointerover on the sentinel').toContain('pointerover');
    const cursor = await page.evaluate(p => { const el = document.elementFromPoint(p.x, p.y); return { sentinel: el === window.__fpt.sentinel, cursor: getComputedStyle(el).cursor }; }, fix.vp.p_out);
    expect(cursor, 'the computed cursor is the sentinel\'s').toEqual({ sentinel: true, cursor: 'crosshair' });
    await page.mouse.wheel(0, 300); await settle(page, 300);
    const scroll = await page.evaluate(() => ({ sentinel: window.__fpt.sentinel.scrollTop, content: window.__fpt.hosts.A.contentEl.scrollTop }));
    expect(scroll.sentinel, 'the wheel scrolls the page beneath').toBeGreaterThan(0);
    expect(scroll.content, 'not the window content').toBe(0);
  });


  test(`${mode}: HPT40 the Tab sequence matches the pre-#597 recording in both modes`, async ({ page, servers, browserName }) => {
    const reference = TAB_REFERENCE.sequences[browserName];
    expect(reference, `a ${browserName} reference recorded at ${TAB_REFERENCE.recordedAt}`).toBeTruthy();
    for (const hit of ['region', 'box']) {
      await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
      await page.evaluate(TAB_SCENARIO, { mode, hit });
      expect(await page.evaluate(() => window.__tabHost.getAttribute('data-scriptoscope-hit-effective')), hit).toBe(hit);
      expect(await tabSequence(page), `${hit} mode`).toEqual(reference);
    }
  });

}
