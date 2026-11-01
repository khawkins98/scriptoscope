// #597 frame pass-through, recompute, identity and gesture hooks
// (docs/spec/engine/hit-regions.md §9.4, §9.5, §9.8): HPT4, HPT5, HPT6, HPT13,
// HPT14, HPT25, HPT26, HPT27, HPT30, HPT31, HPT32, HPT35, HPT38, HPT39 (top- and side-titled), HPT41.
import { test, expect, MODES, boot, fixture, hitAt, state, events, settle, regionLogs, capture, SENTINEL_RGB } from './frame-pass-through-fixture.mjs';

/** Snapshot the decoded S of `name` for a later comparison (chrome pixels; host origin fixed). */
const snap = (page, name, opts = {}) => page.evaluate(async ({ name, opts }) => {
  const f = window.__fpt, o = await f.oracle(name, opts);
  return { W: o.W, H: o.H, C: o.C, region: Array.from(o.region) };
}, { name, opts });

/**
 * Every decoded point whose membership differs between `old` and the current S
 * (uniform 3 × 3 in both), plus up to `limit` points excluded at the new size,
 * hit-tested now. Returns mismatches against the new S.
 */
const checkAgainst = (page, name, old, { limit = 400, opts = {} } = {}) => page.evaluate(async ({ name, old, limit, opts }) => {
  const f = window.__fpt, o = await f.oracle(name, opts), R = f.rules;
  const inOld = (x, y) => x < old.W && y < old.H;
  const oldAt = (x, y) => old.region[y * old.W + x];
  const oldUniform = (x, y, v) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (!inOld(X, Y) || oldAt(X, Y) !== v) return false; } return true; };
  const inC = (C, x, y) => x >= C.left && x < C.right && y >= C.top && y < C.bottom;
  const changed = [], newlyOut = [], nowInC = [];
  for (let y = 1; y < o.H - 1; y++) for (let x = 1; x < o.W - 1; x++) {
    const v = o.region[y * o.W + x];
    if (v === R.UNKNOWN || !R.uniform(o.region, o.W, o.H, x, y, v, 1)) continue;
    if (inOld(x, y) && oldUniform(x, y, v === R.IN ? R.OUT : R.IN)) {
      changed.push([x, y, v]);
      if (v === R.OUT) newlyOut.push([x, y]);
      if (v === R.IN && inC(o.C, x, y) && !inC(old.C, x, y)) nowInC.push([x, y]);
    }
  }
  const sample = (list, n) => list.length <= n ? list : Array.from({ length: n }, (_, i) => list[Math.floor(i * list.length / n)]);
  const mismatches = [];
  for (const [x, y, v] of sample(changed, limit)) {
    const p = f.vp(name, [x, y]), hit = f.hitAt(p.x, p.y), want = v === R.OUT ? 'sentinel' : 'window';
    const got = hit === 'sentinel' ? 'sentinel' : /:(.*)$/.exec(hit)?.[1] === name ? 'window' : hit;
    if (got !== want && mismatches.length < 10) mismatches.push([x, y, want, hit]);
  }
  return { W: o.W, H: o.H, changed: changed.length, newlyOut: newlyOut.length, nowInC: nowInC.length, mismatches };
}, { name, old, limit, opts });

/** Ghost outlines anywhere on the window: L3 (HP31) or the host's light DOM. */
const outlines = page => page.evaluate(() => { const h = window.__fpt.hosts.A.host;
  return h.querySelectorAll(':scope > div[style*="dotted"]').length + h.shadowRoot.querySelectorAll('div[style*="dotted"]').length; });
const growbox = (page, name) => page.evaluate(name => {
  const b = window.__fpt.hosts[name].host.shadowRoot.querySelector('button.scriptoscope-growbox'), r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, rect: r.toJSON() };
}, name);

for (const mode of MODES) {
  test(`${mode}: HPT4 S is recomputed on setOuterSize, auto-fit, pointer and keyboard grow-box commits`, async ({ page, servers }, info) => {
    test.setTimeout(180_000);
    await boot(page, servers, mode);
    await page.evaluate(async () => { const f = window.__fpt; f.manager(); await f.add('A', { slug: 'dolphin-som', w: 300, h: 180, left: 60, top: 60 }); });
    const rows = [];
    const run = async (label, act, name = 'A') => {
      const old = await snap(page, name);
      await act();
      await settle(page, 300);
      const r = await checkAgainst(page, name, old);
      rows.push({ label, ...r });
      expect(r.W * r.H, `${label}: the window grew`).toBeGreaterThan(old.W * old.H);
      expect(r.changed, `${label}: decoded points that change membership`).toBeGreaterThan(0);
      expect(r.mismatches, `${label}: hits follow the new S`).toEqual([]);
    };
    await run('setOuterSize', () => page.evaluate(async () => { const f = window.__fpt, g = f.geom('A'); await f.hosts.A.m.setOuterSize(f.hosts.A.host, { width: g.W + 41, height: g.H + 29 }); }));
    const gb = await growbox(page, 'A');
    await run('grow-box pointer', async () => { await page.mouse.move(gb.x, gb.y); await page.mouse.down(); await page.mouse.move(gb.x + 23, gb.y + 17, { steps: 4 }); await page.mouse.move(gb.x + 47, gb.y + 33, { steps: 4 }); await page.mouse.up(); });
    await run('grow-box keyboard', async () => {
      await page.evaluate(() => window.__fpt.hosts.A.host.shadowRoot.querySelector('button.scriptoscope-growbox').focus());
      for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); }
    });
    // Declarative auto-fit growth (undeclared size; content grows after promote).
    await page.evaluate(async () => {
      const f = window.__fpt;
      await f.promote('D', { slug: 'dolphin-som', html: '<article data-scriptoscope-window data-scriptoscope-title="" data-scriptoscope-x="560" data-scriptoscope-y="420" style="width:260px"><p>Fit</p><div class="grow"></div></article>' });
    });
    await run('auto-fit growth', () => page.evaluate(() => {
      const g = window.__fpt.hosts.D.host.querySelector('.grow');
      g.style.cssText = 'width:330px;height:150px;background:rgb(200,220,240)';
    }), 'D');
    info.annotations.push({ type: 'observation', description: JSON.stringify(rows.map(({ mismatches, ...r }) => r)) });
  });

  test(`${mode}: HPT5 collapsed: the former content area passes, expanded again it hits`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => { const f = window.__fpt; f.manager(); await f.add('A', { slug: 'dolphin-som' }); });
    const expanded = await snap(page, 'A');
    await page.evaluate(async () => { const f = window.__fpt; await f.hosts.A.m.applyState(f.hosts.A.host, { collapsed: true }); await f.settle(); });
    const r = await page.evaluate(async old => {
      const f = window.__fpt, o = await f.oracle('A', { collapsed: true }), cc = f.crossCheck('A', o), pts = [];
      for (let y = 1; y < o.H - 1; y++) for (let x = 1; x < o.W - 1; x++) {
        const inOldC = x >= old.C.left + 2 && x < old.C.right - 2 && y >= old.C.top + 2 && y < old.C.bottom - 2;
        if (inOldC && f.rules.uniform(o.region, o.W, o.H, x, y, f.rules.OUT, 1)) pts.push([x, y]);
      }
      const pick = pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 40)) === 0);
      const hits = pick.map(p => { const v = f.vp('A', p); return [p, f.hitAt(v.x, v.y)]; });
      return { cc, H: o.H, n: pts.length, pick, hits };
    }, expanded);
    expect(r.cc.disagree, 'collapsed decode agrees with the drawn alpha (HP15 cross-check)').toBe(0);
    expect(r.n, 'decoded former-content points outside the collapsed S').toBeGreaterThan(0);
    expect(r.hits.filter(([, h]) => h !== 'sentinel')).toEqual([]);
    expect((await state(page, 'A')).hitEffective).toBe('region');
    await page.evaluate(async () => { const f = window.__fpt; await f.hosts.A.m.applyState(f.hosts.A.host, { collapsed: false }); await f.settle(); });
    const back = await page.evaluate(pick => pick.map(p => { const f = window.__fpt, v = f.vp('A', p); return f.hitAt(v.x, v.y); }), r.pick);
    expect(back.filter(h => h !== 'content:A' && h !== 'host:A'), 'expanded: the content area hits').toEqual([]);
  });

  test(`${mode}: HPT6 animals: a mask-difference pixel follows the drawn template in both activation states`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => { const f = window.__fpt; f.manager(); await f.add('A', { slug: 'animals', left: 60 }); await f.add('B', { slug: 'animals', left: 700, top: 500 }); });
    const diff = await page.evaluate(async () => {
      const f = window.__fpt, a = await f.oracle('A', { state: 'active' }), i = await f.oracle('A', { state: 'inactive' }), out = [];
      for (let j = 0; j < a.region.length; j++) if (a.region[j] !== i.region[j] && a.region[j] !== f.rules.UNKNOWN && i.region[j] !== f.rules.UNKNOWN) out.push([j % a.W, Math.floor(j / a.W), a.region[j], i.region[j]]);
      return out;
    });
    expect(diff.length, 'decoded active/inactive mask differences').toBeGreaterThan(0);
    const probe = expected => page.evaluate(({ diff, expected }) => {
      const f = window.__fpt, bad = [];
      for (const [x, y, act, inact] of diff) {
        const v = f.vp('A', [x, y]), hit = f.hitAt(v.x, v.y), want = (expected === 'active' ? act : inact) === f.rules.IN;
        if ((hit === 'sentinel') === want) bad.push([x, y, expected, hit]);
      }
      return bad;
    }, { diff, expected });
    // B pressed: A inactive (an activation flip, HP22c).
    const fb = await fixture(page, 'B');
    await page.mouse.click(fb.vp.p_c.x, fb.vp.p_c.y); await settle(page);
    expect((await state(page, 'A')).current).toBe('inactive');
    const cci = await page.evaluate(async () => { const f = window.__fpt; return f.crossCheck('A', await f.oracle('A')); });
    expect(cci.disagree, 'inactive decode vs drawn alpha').toBe(0);
    expect(await probe('inactive')).toEqual([]);
    const fa = await fixture(page, 'A');
    await page.mouse.click(fa.vp.p_c.x, fa.vp.p_c.y); await settle(page);
    expect((await state(page, 'A')).current).toBe('active');
    expect(await probe('active')).toEqual([]);
  });

  test(`${mode}: HPT13 Posture B handoff: the clip moves with the host, the old flow slot is page`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      const box = document.createElement('div'); box.id = 'flow'; box.style.cssText = 'position:relative;z-index:1;margin:140px 0 0 120px;width:520px';
      document.body.append(box);
      await f.promote('N', { slug: 'dolphin-som', parent: box, html: '<article data-scriptoscope-window data-scriptoscope-title="" data-scriptoscope-width="320" data-scriptoscope-height="200"><p>Flow</p></article>' });
    });
    expect(await page.evaluate(() => getComputedStyle(window.__fpt.hosts.N.host).position)).toBe('static');
    const before = await fixture(page, 'N');
    await page.mouse.move(before.vp.p_in.x, before.vp.p_in.y);
    await page.mouse.down();
    await page.mouse.move(before.vp.p_in.x + 100, before.vp.p_in.y + 75, { steps: 4 });
    await page.mouse.move(before.vp.p_in.x + 200, before.vp.p_in.y + 150, { steps: 4 });
    await page.mouse.up();
    await settle(page, 300);
    expect(await page.evaluate(() => getComputedStyle(window.__fpt.hosts.N.host).position), 'handed off').toBe('absolute');
    const after = await fixture(page, 'N');
    expect(after.vp.p_in.x - before.vp.p_in.x).toBeCloseTo(200, 0);
    expect(await hitAt(page, after.vp.p_out), 'new position: p_out passes').not.toMatch(/:N$/);
    expect(await hitAt(page, after.vp.p_in), 'new position: p_in hits').toBe('host:N');
    expect(await hitAt(page, before.vp.p_in), 'old flow slot: page beneath').not.toMatch(/:N$/);
    expect(await page.evaluate(() => window.__fpt.hosts.N.host.style.pointerEvents), 'handoff leaves the host pointer-transparent (HP27, HP33)').toBe('none');
  });

  test(`${mode}: HPT14 the grow overlay: excluded frame pixels pass, its part inside C resizes`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    // Synthetic (T9-style): dolphin with its bottom-right corner cell mask-clear, so the
    // overlay's part outside C lies over excluded frame pixels.
    const r = await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      const dec = await f.decode('dolphin-som'), A = dec.manifest.windowTypes['document-window'].parts['part-0'].rect;
      const { theme, synthetic } = await f.synth('dolphin-som', ['document-window'], (rgba, w, h) => { for (let y = A[3]; y < h; y++) for (let x = A[2]; x < w; x++) rgba[(y * w + x) * 4 + 3] = 0; });
      await f.add('G', { themeObject: theme, slug: 'dolphin-som', synthetic });
      const o = await f.oracle('G'), g = f.geom('G');
      const b = f.hosts.G.host.shadowRoot.querySelector('button.scriptoscope-growbox').getBoundingClientRect();
      const toChrome = (X, Y) => [Math.floor((X - g.left) / g.k), Math.floor((Y - g.top) / g.k)];
      let out = null, inside = null;
      for (let Y = Math.ceil(b.top) + 1; Y < b.bottom - 1; Y++) for (let X = Math.ceil(b.left) + 1; X < b.right - 1; X++) {
        const [x, y] = toChrome(X, Y);
        const inC = x >= o.C.left + 1 && x < o.C.right - 1 && y >= o.C.top + 1 && y < o.C.bottom - 1;
        if (!out && x >= o.C.right && y >= o.C.bottom && f.rules.uniform(o.region, o.W, o.H, x, y, f.rules.OUT, 1)) out = [x, y];
        if (!inside && inC && x > o.C.right - 12 && y > o.C.bottom - 12) inside = [x, y];
      }
      return { out, inside, rect: b.toJSON(), outVp: out && f.vp('G', out), inVp: inside && f.vp('G', inside), W: g.W, H: g.H };
    });
    expect(r.out, 'the overlay overlaps decoded excluded pixels').toBeTruthy();
    expect(r.inside, 'the overlay has a part inside C').toBeTruthy();
    await events(page);
    await page.mouse.move(r.outVp.x, r.outVp.y); await page.mouse.down(); await page.mouse.move(r.outVp.x + 30, r.outVp.y + 20, { steps: 4 }); await page.mouse.up();
    await settle(page, 300);
    expect((await events(page)).filter(e => e.at === 'sentinel').map(e => e.type), 'press over excluded pixels reaches the page').toContain('pointerdown');
    expect(await page.evaluate(() => { const g = window.__fpt.geom('G'); return [g.W, g.H]; }), 'no resize').toEqual([r.W, r.H]);
    // The pass-through press is an outside press, so it deactivated G (HP39, #620). By
    // #614 IP14 the first grow-box press on the now inactive G only activates it; the
    // next press inside C resizes.
    expect((await state(page, 'G')).active, 'the outside press deactivated G').toBe(false);
    const growInside = async () => { await page.mouse.move(r.inVp.x, r.inVp.y); await page.mouse.down(); await page.mouse.move(r.inVp.x + 30, r.inVp.y + 20, { steps: 4 }); await page.mouse.up(); await settle(page, 300); };
    await growInside();
    expect((await state(page, 'G')).active, 'press inside C activates G').toBe(true);
    expect(await page.evaluate(() => { const g = window.__fpt.geom('G'); return [g.W, g.H]; }), 'first press on inactive G: no resize').toEqual([r.W, r.H]);
    await growInside();
    expect(await page.evaluate(() => { const g = window.__fpt.geom('G'); return [g.W, g.H]; }), 'press inside C resizes').toEqual([r.W + 30, r.H + 20]);
  });

  test(`${mode}: HPT25 no S build on drag, hover, resize ghost, raise, reflow or mode-only switches; one on release`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => { const f = window.__fpt; f.manager(); await f.add('A', { slug: 'dolphin-som', w: 320, h: 200 }); f.watch('A'); });
    const fix = await fixture(page, 'A');
    const counts = async () => ({ builds: await regionLogs(page), records: await page.evaluate(() => window.__fpt.records('A')), changes: (await state(page, 'A')).changes });
    const delta = (a, b) => ({ builds: b.builds - a.builds, records: b.records - a.records, changes: b.changes - a.changes });
    // Precondition: the observable exists (a commit builds once).
    let c0 = await counts();
    await page.evaluate(async () => { const f = window.__fpt; await f.hosts.A.m.setContentSize(f.hosts.A.host, 330, 210); });
    let d = delta(c0, await counts());
    expect(d.builds, 'a commit emits exactly one region build event').toBe(1);
    const fx = await fixture(page, 'A');
    // Title-bar drag (moves and release).
    c0 = await counts();
    await page.mouse.move(fx.vp.p_in.x, fx.vp.p_in.y); await page.mouse.down();
    await page.mouse.move(fx.vp.p_in.x + 40, fx.vp.p_in.y + 30, { steps: 10 }); await page.mouse.up(); await settle(page);
    d = delta(c0, await counts());
    expect([d.builds, d.records], 'title-bar drag').toEqual([0, 0]);
    const fy = await fixture(page, 'A');
    // 200-step hover sweep across the frame.
    c0 = await counts();
    await page.mouse.move(fy.vp.p_out.x - 150, fy.vp.p_out.y); await page.mouse.move(fy.vp.p_out.x + 150, fy.vp.p_out.y, { steps: 200 }); await settle(page);
    d = delta(c0, await counts());
    expect([d.builds, d.records], 'hover sweep').toEqual([0, 0]);
    // Raise of the already active window; content reflow with no size change.
    c0 = await counts();
    await page.mouse.click(fy.vp.p_c.x, fy.vp.p_c.y);
    await page.evaluate(() => { const c = window.__fpt.hosts.A.contentEl; c.textContent = 'Reflowed '.repeat(30); });
    await settle(page);
    d = delta(c0, await counts());
    expect([d.builds, d.records], 'raise and reflow').toEqual([0, 0]);
    // Pointer resize: nothing before release; the old p_out still passes; one build and one commit on release.
    const gb = await growbox(page, 'A');
    c0 = await counts();
    await page.mouse.move(gb.x, gb.y); await page.mouse.down();
    await page.mouse.move(gb.x + 25, gb.y + 15, { steps: 6 }); await page.mouse.move(gb.x + 50, gb.y + 30, { steps: 6 }); await settle(page);
    d = delta(c0, await counts());
    expect([d.builds, d.records], 'pointer resize before release').toEqual([0, 0]);
    // HP49: the clip is suspended for the captured resize (pass-through mid-gesture is not
    // required), and suspension is not a build (HP24): the counts above stay zero.
    expect(await page.evaluate(() => getComputedStyle(window.__fpt.layers('A').L2).clipPath), 'clip suspended during the resize (HP49)').toBe('none');
    await page.mouse.up(); await settle(page, 300);
    d = delta(c0, await counts());
    expect(d.builds, 'release: one build').toBe(1);
    expect(d.changes, 'release: one commit').toBe(1);
    expect(d.records, 'release: canvas rewritten').toBeGreaterThan(0);
    // Mode-only switches.
    c0 = await counts();
    await page.evaluate(async () => { const f = window.__fpt, { m, host } = f.hosts.A; await m.applyState(host, { hit: 'box' }); await m.applyState(host, { hit: 'region' }); });
    await settle(page);
    d = delta(c0, await counts());
    expect([d.builds, d.records, d.changes], 'mode-only switch').toEqual([0, 0, 0]);
  });

  test(`${mode}: HPT26 the clip and the canvas change in the same MutationObserver callback`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const r = await page.evaluate(async () => {
      const f = window.__fpt; f.manager(); await f.add('A', { slug: 'dolphin-som' });
      const { L2, canvas } = f.layers('A'), batches = [];
      const mo = new MutationObserver(list => batches.push(list.map(m => (m.target === L2 ? 'L2:' : m.target === canvas ? 'canvas:' : 'other:') + m.attributeName)));
      mo.observe(L2, { attributes: true }); mo.observe(canvas, { attributes: true });
      await f.hosts.A.m.setContentSize(f.hosts.A.host, 347, 219);
      await f.settle();
      mo.disconnect();
      return { batches, l2Differs: L2 !== f.hosts.A.host.shadowRoot.querySelector('[part~=window]') };
    });
    expect(r.l2Differs, 'L2 is not L1').toBe(true);
    const withCanvas = r.batches.filter(b => b.some(x => x.startsWith('canvas:')));
    expect(withCanvas.length, `canvas records ${JSON.stringify(r.batches)}`).toBeGreaterThan(0);
    expect(withCanvas.every(b => b.some(x => x.startsWith('L2:'))), `same callback ${JSON.stringify(r.batches)}`).toBe(true);
    expect(r.batches.filter(b => b.some(x => x.startsWith('L2:')) && !b.some(x => x.startsWith('canvas:'))), 'no L2 record in a later callback').toEqual([]);
  });

  test(`${mode}: HPT27 k = 2 scales S by k; runtime setters for k and the title are conditional`, async ({ page, servers }, info) => {
    await boot(page, servers, mode);
    const r = await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      await f.add('K1', { slug: 'dolphin-som', w: 160, h: 100, left: 40, top: 60 });
      await f.add('K2', { slug: 'dolphin-som', w: 160, h: 100, scale: 2, left: 360, top: 60 });
      const o1 = await f.oracle('K1'), o2 = await f.oracle('K2'), bad = [];
      let same = o1.W === o2.W && o1.H === o2.H;
      for (let j = 0; same && j < o1.region.length; j++) if (o1.region[j] !== o2.region[j]) same = false;
      // Every decoded chrome pixel with a uniform 3 × 3 neighbourhood, sampled at two sub-points of its k × k cell.
      for (let y = 1; y < o2.H - 1; y += 2) for (let x = 1; x < o2.W - 1; x += 2) {
        const v = o2.region[y * o2.W + x];
        if (!f.rules.uniform(o2.region, o2.W, o2.H, x, y, v, 1) || v === f.rules.UNKNOWN) continue;
        const g = f.geom('K2');
        for (const [sx, sy] of [[0.25, 0.25], [0.75, 0.75]]) {
          const X = g.left + (x + sx) * g.k, Y = g.top + (y + sy) * g.k, hit = f.hitAt(X, Y);
          if ((hit === 'sentinel') !== (v === f.rules.OUT) && bad.length < 10) bad.push([x, y, v, hit]);
        }
      }
      const m = f.managers[0];
      return { same, k: f.geom('K2').k, bad, setters: ['setScale', 'setTitle', 'setOptions'].filter(n => typeof m[n] === 'function') };
    });
    expect(r.k).toBe(2);
    expect(r.same, 'the decode gives the same S in chrome pixels at k = 1 and 2').toBe(true);
    expect(r.bad).toEqual([]);
    info.annotations.push({ type: 'observation', description: r.setters.length ? `setters present: ${r.setters} (HPT27 setter clause must be written)` : 'no setter (HPT27 setter clause conditional)' });
    expect(r.setters, 'a k/title setter now exists: extend HPT27 (HP22e/f)').toEqual([]);
  });

  test(`${mode}: HPT30 the resize ghost outline is visible beyond the old box in both modes`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    for (const hit of ['region', 'box']) {
      await page.evaluate(async hit => { const f = window.__fpt; f.reset(); f.manager(); await f.add('A', { slug: 'dolphin-som', hit, left: 60, top: 60 }); }, hit);
      const box = await page.evaluate(() => window.__fpt.hosts.A.host.getBoundingClientRect().toJSON());
      const gb = await growbox(page, 'A');
      await page.mouse.move(gb.x, gb.y); await page.mouse.down();
      await page.mouse.move(gb.x + 60, gb.y + 50, { steps: 4 }); await page.mouse.move(gb.x + 120, gb.y + 100, { steps: 4 });
      await settle(page);
      // Beyond the old box: the strip between the old and new right edges, around the new bottom
      // edge, and the strip below the old bottom around the new right edge.
      const nb = box.bottom + 100, nr = box.right + 120;
      const strips = [{ x: box.right + 4, y: nb - 6, width: 110, height: 12 }, { x: nr - 6, y: box.bottom + 4, width: 12, height: 90 }];
      const ink = [];
      for (const s of strips) {
        const img = await capture(page, s);
        let n = 0;
        for (let i = 0; i < img.data.length; i += 4) if (Math.abs(img.data[i] - SENTINEL_RGB[0]) + Math.abs(img.data[i + 1] - SENTINEL_RGB[1]) + Math.abs(img.data[i + 2] - SENTINEL_RGB[2]) > 30) n++;
        ink.push(n);
      }
      await page.mouse.up(); await settle(page);
      expect(ink.every(n => n > 0), `${hit}: outline ink beyond the old box ${ink}`).toBe(true);
      expect(await outlines(page), `${hit}: outline gone after release`).toBe(0);
      // Ended by pointercancel at the capture target.
      const gb2 = await growbox(page, 'A');
      await page.evaluate(() => { addEventListener('pointerdown', e => { window.__pid30 = e.pointerId; }, { capture: true, once: true }); });
      await page.mouse.move(gb2.x, gb2.y); await page.mouse.down(); await page.mouse.move(gb2.x + 40, gb2.y + 30, { steps: 4 });
      expect(await outlines(page), `${hit}: outline shown before the cancel`).toBe(1);
      await page.evaluate(() => { const b = window.__fpt.hosts.A.host.shadowRoot.querySelector('button.scriptoscope-growbox');
        b.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.__pid30, pointerType: 'mouse', bubbles: true, composed: true })); });
      await settle(page);
      expect(await outlines(page), `${hit}: outline gone after pointercancel`).toBe(0);
      await page.mouse.up(); await settle(page);
    }
  });

  test(`${mode}: HPT31 a widget-mask pixel outside S misses; one inside S runs the handler`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const r = await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      const dec = await f.decode('windows-95'), wt = dec.manifest.windowTypes['document-window'], [l, t, rr, b] = wt.parts['part-1'].rect;
      // Template pixels under the left half of the close widget's template rect become mask-clear.
      const { theme, synthetic } = await f.synth('windows-95', ['document-window'], (rgba, w) => { for (let y = t; y < b; y++) for (let x = l; x < l + Math.floor((rr - l) / 2); x++) rgba[(y * w + x) * 4 + 3] = 0; });
      window.__closes = 0;
      await f.add('W', { themeObject: theme, slug: 'windows-95', synthetic, handlers: { onClose: () => { window.__closes++; } } });
      const o = await f.oracle('W'), strip = f.chromeRules.widgetStrip(dec, f.api.PixelBuffer);
      let out = null, inside = null;
      for (let y = 1; y < o.C.top; y++) for (let x = 1; x < o.W - 1; x++) {
        const widget = f.chromeRules.widgetHitAt(o.layout, o.wt, strip, x, y) === 'close';
        const all = (v) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (f.chromeRules.widgetHitAt(o.layout, o.wt, strip, x + dx, y + dy) !== 'close' || o.region[(y + dy) * o.W + x + dx] !== v) return false; return true; };
        if (widget && !out && all(f.rules.OUT)) out = [x, y];
        if (widget && !inside && all(f.rules.IN)) inside = [x, y];
      }
      return { strip: !!strip, out, inside, outVp: out && f.vp('W', out), inVp: inside && f.vp('W', inside) };
    });
    expect(r.strip, 'windows-95 ships the −14330 strip').toBe(true);
    expect(r.out && r.inside, `decoded widget pixels outside (${r.out}) and inside (${r.inside}) S`).toBeTruthy();
    await events(page);
    await page.mouse.click(r.outVp.x, r.outVp.y); await settle(page);
    expect((await events(page)).filter(e => e.at === 'sentinel').map(e => e.type), 'outside S: the press reaches the page').toContain('pointerdown');
    expect(await page.evaluate(() => window.__closes), 'outside S: no handler').toBe(0);
    // The pass-through press is an outside press, so it deactivated W (HP39, #620). By
    // #614 IP1 the first click inside S on the now inactive W only activates it; the
    // next click runs the handler.
    expect((await state(page, 'W')).active, 'the outside press deactivated W').toBe(false);
    await page.mouse.click(r.inVp.x, r.inVp.y); await settle(page);
    expect((await state(page, 'W')).active, 'inside S: the press reaches W and activates it').toBe(true);
    expect(await page.evaluate(() => window.__closes), 'inside S on inactive W: no handler yet').toBe(0);
    await page.mouse.click(r.inVp.x, r.inVp.y); await settle(page);
    expect(await page.evaluate(() => window.__closes), 'inside S: the handler runs').toBe(1);
  });

  test(`${mode}: HPT32 a captured drag survives leaving S and a mid-drag retheme`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => { const f = window.__fpt; f.manager(); await f.add('A', { slug: 'dolphin-som', left: 100, top: 120 }); });
    for (const retheme of [false, true]) {
      const fix = await fixture(page, 'A');
      const start = await state(page, 'A');
      await events(page);
      const dx = fix.vp.p_out.x - fix.vp.p_in.x + 180, dy = fix.vp.p_out.y - fix.vp.p_in.y + 140;
      await page.mouse.move(fix.vp.p_in.x, fix.vp.p_in.y); await page.mouse.down();
      // Jump onto where p_out lies, then far over the sentinel.
      await page.mouse.move(fix.vp.p_out.x, fix.vp.p_out.y);
      if (retheme) await page.evaluate(async () => { const f = window.__fpt; await f.managers[0].retheme(await f.theme('1984')); f.hosts.A.slug = '1984'; });
      await page.mouse.move(fix.vp.p_in.x + dx, fix.vp.p_in.y + dy, { steps: 3 });
      await page.mouse.up(); await settle(page);
      const end = await state(page, 'A');
      expect([parseFloat(end.left) - parseFloat(start.left), parseFloat(end.top) - parseFloat(start.top)], `retheme=${retheme}: moved by the pointer delta`).toEqual([dx, dy]);
      expect((await events(page)).filter(e => e.at === 'sentinel' && ['pointerdown', 'pointerup', 'click'].includes(e.type)), `retheme=${retheme}: sentinel`).toEqual([]);
      expect(end.active, `retheme=${retheme}: still active`).toBe(true);
    }
    // Pointer leaves the window: a grow-box resize dragged inward past the minimum size, released
    // over page content (the sentinel covers the area around the box).
    await page.evaluate(async () => { const f = window.__fpt; f.reset(); f.manager(); await f.add('A', { slug: 'dolphin-som', left: 400, top: 300, w: 200, h: 120 }); });
    const shrink = async () => {
      const gb = await growbox(page, 'A');
      await events(page);
      await page.mouse.move(gb.x, gb.y); await page.mouse.down();
      await page.mouse.move(gb.x - 200, gb.y - 150, { steps: 5 }); await page.mouse.move(gb.x - 380, gb.y - 280, { steps: 5 });
      const at = { x: gb.x - 380, y: gb.y - 280 };
      const box = await page.evaluate(() => window.__fpt.hosts.A.host.getBoundingClientRect().toJSON());
      await page.mouse.up(); await settle(page, 300);
      return { at, outside: at.x < box.left || at.y < box.top, size: await page.evaluate(() => { const g = window.__fpt.geom('A'); return [g.W, g.H]; }) };
    };
    const size0 = await page.evaluate(() => { const g = window.__fpt.geom('A'); return [g.W, g.H]; });
    const first = await shrink();
    expect(first.outside, 'the release point is outside the window box').toBe(true);
    expect(await page.evaluate(p => window.__fpt.hitAt(p.x, p.y), first.at), 'the page lies under the release point').toBe('sentinel');
    expect((await events(page)).filter(e => e.at === 'sentinel' && ['pointerdown', 'pointerup', 'click'].includes(e.type)), 'sentinel: no press, release or click').toEqual([]);
    expect(first.size[0] < size0[0] && first.size[1] < size0[1], `resize committed ${size0} -> ${first.size}`).toBe(true);
    expect((await state(page, 'A')).active, 'still active').toBe(true);
    const second = await shrink();
    expect(second.size, 'committed at the minimum size (a further inward drag changes nothing)').toEqual(first.size);
    expect((await state(page, 'A')).active).toBe(true);
  });

  for (const phase of ['commits', 'collapse']) test(`${mode}: HPT35 (${phase}) L2, the canvas and every overlay keep their identity${phase === 'commits' ? '; focus survives a retheme' : ' across collapse and expand'}`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      const content = document.createElement('div'); content.innerHTML = '<p>Tall</p>'.repeat(30);
      Object.assign(content.style, { height: '100%', overflow: 'auto', boxSizing: 'border-box' });
      await f.add('A', { slug: 'dolphin-som', content, handlers: { onClose() {} }, left: 60 });
      await f.add('B', { slug: 'dolphin-som', left: 700, top: 500 });
      const root = f.hosts.A.host.shadowRoot, { L2, canvas } = f.layers('A');
      L2.__mark = 'L2'; canvas.__mark = 'canvas';
      const L3 = root.querySelector('.scriptoscope-decoration'); if (L3) L3.__mark = 'L3';
      for (const el of root.querySelectorAll('button, [role=scrollbar]')) el.__mark = el.getAttribute('aria-label');
    });
    const check = () => page.evaluate(async () => {
      const f = window.__fpt; await f.settle();
      const root = f.hosts.A.host.shadowRoot, { L1, L2, canvas, first } = f.layers('A');
      const overlays = [...root.querySelectorAll('button, [role=scrollbar]')].map(el => [el.getAttribute('aria-label'), el.__mark === el.getAttribute('aria-label') ? 'same' : 'new']);
      const L3 = root.querySelector('.scriptoscope-decoration');
      return { L2: L2?.__mark ?? null, canvas: canvas.__mark ?? null, L3: L3?.__mark ?? null, L1first: first === L1, L2inL1: !!L2 && L2 !== L1 && L1.contains(L2), overlays,
        grow: !!root.querySelector('button.scriptoscope-growbox') };
    });
    const start = await check();
    expect(start.L2inL1, 'L2 sits inside L1').toBe(true);
    expect(start.overlays.length).toBeGreaterThan(3);
    const steps = [
      ['resize', f => f.hosts.A.m.setContentSize(f.hosts.A.host, 330, 210)],
      ['activation flip', f => { f.hosts.B.host.dispatchEvent(new PointerEvent('pointerdown')); }],
      ['activation back', f => { f.hosts.A.host.dispatchEvent(new PointerEvent('pointerdown')); }],
      ['collapse', f => f.hosts.A.m.applyState(f.hosts.A.host, { collapsed: true })],
      ['expand', f => f.hosts.A.m.applyState(f.hosts.A.host, { collapsed: false })],
      ['retheme', async f => { await f.managers[0].retheme(await f.theme('1984')); await f.managers[0].retheme(await f.theme('dolphin-som')); }],
      ['mode box', f => f.hosts.A.m.applyState(f.hosts.A.host, { hit: 'box' })],
      ['mode region', f => f.hosts.A.m.applyState(f.hosts.A.host, { hit: 'region' })],
    ];
    // Collapse and expand are their own test: HP43 keeps every overlay for the window's
    // lifetime, including the grow box and scrollbar a collapsed window does not show.
    let absentCollapsed = [];
    for (const [label, run] of steps.filter(([l]) => (phase === 'collapse') === (l === 'collapse' || l === 'expand'))) {
      await page.evaluate(`(${run.toString()})(window.__fpt)`);
      const s = await check();
      expect([s.L2, s.L3, s.canvas, s.L1first, s.L2inL1], label).toEqual(['L2', 'L3', 'canvas', true, true]);
      // HP43 exception: the grow box exists only while expanded; its identity across collapse is not asserted.
      // Overlays that do not exist while collapsed (HP43: only those in both states) are exempt on expand.
      const exempt = phase === 'collapse' ? ['Resize window', ...(label === 'expand' ? absentCollapsed : [])] : [];
      if (label === 'collapse') absentCollapsed = start.overlays.map(([l]) => l).filter(l => !s.overlays.some(([m]) => m === l));
      expect(s.overlays.filter(([l, v]) => v !== 'same' && !exempt.includes(l)), `${label}: overlays`).toEqual([]);
      if (label === 'collapse') expect(s.grow, 'collapsed: no grow box').toBe(false);
      if (label === 'expand') expect(s.grow, 'expanded again: a grow box').toBe(true);
    }
    if (phase === 'collapse') return;
    // A focused title widget keeps focus across a retheme.
    const focus = await page.evaluate(async () => {
      const f = window.__fpt, root = f.hosts.A.host.shadowRoot, close = [...root.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Close window');
      close.focus();
      await f.managers[0].retheme(await f.theme('1984')); await f.settle();
      return root.activeElement === close && document.activeElement === f.hosts.A.host;
    });
    expect(focus).toBe(true);
  });

  test(`${mode}: HPT38 a failed region build is box with one log; a mode-only switch builds nothing; a later commit recovers`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    // Synthetic 1984 with fully mask-clear templates: collapsed, C is empty, so S is empty (HP44).
    const r0 = await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      const { theme, synthetic } = await f.synth('1984', ['document-window', 'collapsed-document-window'], rgba => { for (let i = 3; i < rgba.length; i += 4) rgba[i] = 0; });
      f.logs.length = 0;
      await f.add('F', { themeObject: theme, slug: '1984', synthetic, hit: 'box', extra: { collapsed: true } });
      const region = f.region();
      return { region: region.map(l => l.text), state: f.state('F'), W: f.geom('F').W, H: f.geom('F').H };
    });
    expect(r0.W * r0.H, 'the chrome still commits').toBeGreaterThan(0);
    expect(r0.state.hitEffective).toBe('box');
    expect(r0.region.filter(t => /build failed/.test(t)), `one \`build failed\` event ${JSON.stringify(r0.region)}`).toHaveLength(1);
    const before = await regionLogs(page);
    await page.evaluate(async () => { const f = window.__fpt; await f.hosts.F.m.applyState(f.hosts.F.host, { hit: 'region' }); });
    const s1 = await state(page, 'F');
    expect([s1.hit, s1.hitEffective], 'stays box after the switch').toEqual(['region', 'box']);
    expect(await regionLogs(page) - before, 'no build during the mode-only switch').toBe(0);
    // Expanding commits; S = C is non-empty, so the window becomes region.
    await page.evaluate(async () => { const f = window.__fpt; await f.hosts.F.m.applyState(f.hosts.F.host, { collapsed: false }); await f.settle(); });
    const s2 = await state(page, 'F');
    expect(s2.hitEffective, 'a later successful commit applies S').toBe('region');
    const pts = await page.evaluate(() => { const f = window.__fpt, g = f.geom('F'), top = f.vp('F', [Math.floor(g.W / 2), 2]), c = f.vp('F', [Math.floor(g.W / 2), Math.floor(g.H / 2)]); return { top: f.hitAt(top.x, top.y), c: f.hitAt(c.x, c.y) }; });
    expect(pts).toEqual({ top: 'sentinel', c: 'content:F' });
  });

  test(`${mode}: HPT39 collapsed: only the title-axis sides are in S (animals collapsed utilities)`, async ({ page, servers }, info) => {
    await boot(page, servers, mode);
    const rows = [];
    for (const [type, key] of [['titled-utility-window', 'collapsed-titled-utility'], ['no-title-utility-window', 'collapsed-no-title-utility']]) {
      const r = await page.evaluate(async ({ type, key }) => {
        const f = window.__fpt; f.reset(); f.manager();
        await f.add('U', { slug: 'animals', type, w: 320, h: 120, extra: { collapsed: true } });
        const o = await f.oracle('U', { collapsed: true, type: key });
        // Configuration input, not points: the runtime lays the collapsed window out at content
        // height 0 with all four sides (HP8) and its own frame placement. Solve C as the content
        // rect whose four-side decode reproduces the drawn chrome exactly (HP15 cross-check), then
        // take every point from the decode: SR6 (title-axis sides only) vs the four-side layout.
        const dec = await f.decode('animals'), wt = dec.manifest.windowTypes[key], [al, aTop] = wt.parts['part-0'].rect;
        const build = (C, mutation) => f.rules.structureRegion({ windowType: wt, cicn: o.cicn, C, W: o.W, H: o.H, flags: { ...f.chromeRules.DECLARED_FLAGS }, collapsed: true, mutation });
        let solved = null;
        for (let l = al - 4; l <= al + 4 && !solved; l++) for (let t = aTop - 4; t <= aTop + 4 && !solved; t++)
          for (let w = o.W - l - 40; w <= o.W - l && !solved; w++) {
            const C = { left: l, top: t, right: l + w, bottom: t };
            if (f.crossCheck('U', { ...o, C, region: build(C, 'fourSidesCollapsed').region }).disagree === 0) solved = C;
          }
        if (!solved) return { unsolved: true, W: o.W, H: o.H };
        const sr6 = { ...o, C: solved, region: build(solved).region }, four = build(solved, 'fourSidesCollapsed');
        const cc = { disagree: 0 };
        const extra = [], titled = [];
        for (let y = 0; y < sr6.H; y++) for (let x = 0; x < sr6.W; x++) {
          const j = y * sr6.W + x;
          if (four.region[j] === f.rules.IN && sr6.region[j] === f.rules.OUT) extra.push([x, y]);
          else if (sr6.region[j] === f.rules.IN && f.rules.uniform(sr6.region, sr6.W, sr6.H, x, y, f.rules.IN, 1) && titled.length < 400) titled.push([x, y]);
        }
        const at = p => { const v = f.vp('U', p); return f.hitAt(v.x, v.y); };
        return { W: sr6.W, H: sr6.H, C: solved, collapsed: f.hosts.U.m.describe(f.hosts.U.host).collapsed, cc, extra: extra.map(p => [p, at(p)]),
          titled: titled.filter((_, i) => i % 20 === 0).map(p => [p, at(p)]), effective: f.state('U').hitEffective };
      }, { type, key });
      expect(r.unsolved, `${key}: a content rect reproduces the drawn chrome`).toBeUndefined();
      rows.push({ key, W: r.W, H: r.H, C: r.C, extra: r.extra.length });
      expect(r.collapsed, key).toBe(true);
      expect(r.cc.disagree, `${key}: the four-side reading matches the drawn chrome`).toBe(0);
      expect(r.extra.length, `${key}: decoded side-cell pixels the four-side layout adds`).toBeGreaterThan(0);
      expect(r.effective, key).toBe('region');
      expect(r.extra.filter(([, h]) => h !== 'sentinel'), `${key}: left/right cell pixels pass (SR6)`).toEqual([]);
      expect(r.titled.filter(([, h]) => h !== 'host:U'), `${key}: title-axis pixels in S hit`).toEqual([]);
    }
    info.annotations.push({ type: 'observation', description: JSON.stringify(rows) });
  });


  test(`${mode}: HPT39 side-titled (HP48): a collapsed side utility keeps its left title strip and passes top/bottom cells`, async ({ page, servers }, info) => {
    await boot(page, servers, mode);
    // Corpus 1138: the left title strip hits. No corpus collapsed-side-utility places top or bottom
    // cell pixels at the runtime's collapsed size (HP8, spec 5b7a5f4c), so the pass-through clause
    // uses a synthetic 1138 whose collapsed side utility borrows the expanded side utility's top and
    // bottom lists, with opaque template bands right of the strip for their mask.
    const run = variant => page.evaluate(async variant => {
      const f = window.__fpt; f.reset(); f.manager();
      const dec = await f.decode('1138'), [bl, bt, , bb] = dec.manifest.windowTypes['collapsed-side-utility'].parts['part-0'].rect;
      let themeObject, synthetic, wt = dec.manifest.windowTypes['collapsed-side-utility'];
      if (variant === 'synthetic') {
        const made = await f.synth('1138', ['collapsed-side-utility'], (rgba, w, h) => {
          for (let y = 0; y < h; y++) for (let x = bl; x < w; x++) if (y < bt || y >= bb) rgba[(y * w + x) * 4 + 3] = 255;
        });
        const withEdges = wts => ({ ...wts, 'collapsed-side-utility': { ...wts['collapsed-side-utility'],
          edges: { ...wts['collapsed-side-utility'].edges, top: wts['side-floating-utility-window'].edges.top, bottom: wts['side-floating-utility-window'].edges.bottom } } });
        themeObject = { ...made.theme, manifest: { ...made.theme.manifest, windowTypes: withEdges(made.theme.manifest.windowTypes) } };
        synthetic = made.synthetic; wt = withEdges(dec.manifest.windowTypes)['collapsed-side-utility'];
      }
      await f.add('S', { ...(themeObject ? { themeObject, synthetic } : {}), slug: '1138', type: 'side-floating-utility-window', w: 120, h: 200, extra: { collapsed: true } });
      const o = await f.oracle('S', { collapsed: true, type: 'collapsed-side-utility' });
      const build = (C, mutation) => f.rules.structureRegion({ windowType: wt, cicn: o.cicn, C, W: o.W, H: o.H, flags: { ...f.chromeRules.DECLARED_FLAGS }, collapsed: true, sideTitle: true, mutation });
      // Configuration input: the committed content rect, nearest the template body inset, whose
      // four-side decode reproduces the drawn chrome (either collapsed form).
      const candidates = [];
      for (let l = bl - 4; l <= bl + 4; l++) for (let t = bt - 4; t <= bt + 4; t++) {
        for (let w = Math.max(0, o.W - l - 60); w <= o.W - l; w++) candidates.push({ left: l, top: t, right: l + w, bottom: t });
        for (let h = Math.max(0, o.H - t - 60); h <= o.H - t; h++) candidates.push({ left: l, top: t, right: l, bottom: t + h });
      }
      candidates.sort((a, b) => (Math.abs(a.left - bl) + Math.abs(a.top - bt)) - (Math.abs(b.left - bl) + Math.abs(b.top - bt)));
      const solved = candidates.find(C => f.crossCheck('S', { ...o, C, region: build(C, 'fourSidesCollapsed').region }).disagree === 0);
      if (!solved) return { unsolved: true, W: o.W, H: o.H };
      const sr6 = build(solved), four = build(solved, 'fourSidesCollapsed'), at = p => { const v = f.vp('S', p); return f.hitAt(v.x, v.y); };
      const strip = [], passes = [];
      for (let y = 0; y < o.H; y++) for (let x = 0; x < o.W; x++) {
        const j = y * o.W + x;
        if (x < solved.left && sr6.region[j] === f.rules.IN && f.rules.uniform(sr6.region, o.W, o.H, x, y, f.rules.IN, 1)) strip.push([x, y]);
        if (four.region[j] === f.rules.IN && sr6.region[j] === f.rules.OUT) passes.push([x, y]);
      }
      const pick = (l, n) => l.filter((_, i) => i % Math.max(1, Math.floor(l.length / n)) === 0);
      return { W: o.W, H: o.H, C: solved, collapsed: f.hosts.S.m.describe(f.hosts.S.host).collapsed, effective: f.state('S').hitEffective,
        strip: pick(strip, 40).map(p => [p, at(p)]), passes: pick(passes, 60).map(p => [p, at(p)]), nStrip: strip.length, nPasses: passes.length };
    }, variant);
    const corpus = await run('corpus'), synth = await run('synthetic');
    info.annotations.push({ type: 'observation', description: JSON.stringify([corpus, synth].map(r => ({ W: r.W, H: r.H, C: r.C, strip: r.nStrip, passes: r.nPasses }))) });
    for (const [label, r] of [['corpus', corpus], ['synthetic', synth]]) {
      expect(r.unsolved, `${label}: a content rect reproduces the drawn chrome (${r.W}x${r.H})`).toBeUndefined();
      expect([r.collapsed, r.effective], label).toEqual([true, 'region']);
    }
    expect(corpus.nStrip, 'corpus: decoded left title-strip pixels in S').toBeGreaterThan(0);
    expect(corpus.strip.filter(([, h]) => h !== 'host:S'), 'corpus: the left title strip hits').toEqual([]);
    expect(corpus.passes, 'corpus: no top/bottom cell pixels at this size (HP8)').toEqual([]);
    expect(synth.nPasses, 'synthetic: decoded top/bottom cell pixels the layout places').toBeGreaterThan(0);
    expect(synth.passes.filter(([, h]) => h !== 'sentinel'), 'synthetic: top/bottom cell pixels pass (SR6 under HP48)').toEqual([]);
    expect(synth.strip.filter(([, h]) => h !== 'host:S'), 'synthetic: the left title strip still hits').toEqual([]);
  });


  for (const part of ['pointer', 'pointercancel', 'lostpointercapture', 'collapse', 'retheme', 'keyboard']) test(`${mode}: HPT41 (${part}) the clip is suspended during a captured drag or resize and restored when it ends (HP49)`, async ({ page, servers }) => {
    test.setTimeout(180_000);
    await boot(page, servers, mode);
    // A timeline of L2 clip-path writes and gesture events, in the order the page sees them.
    const setup = () => page.evaluate(async () => {
      const f = window.__fpt; f.reset(); f.manager(); await f.add('A', { slug: 'dolphin-som', left: 100, top: 120 });
      const { L2 } = f.layers('A');
      window.__tl = [];
      window.__mo?.disconnect();
      window.__mo = new MutationObserver(() => window.__tl.push(`clip:${L2.style.clipPath.startsWith('path(') ? 'path' : L2.style.clipPath || 'unset'}`));
      window.__mo.observe(L2, { attributes: true, attributeFilter: ['style'] });
      if (!window.__tlEvents) {
        window.__tlEvents = true;
        for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) addEventListener(t, e => { window.__pid = e.pointerId; window.__tl.push(t); }, true);
        addEventListener('pointerdown', e => { window.__pid = e.pointerId; }, true);
      }
    });
    const clip = () => page.evaluate(() => { const v = getComputedStyle(window.__fpt.layers('A').L2).clipPath; return v.startsWith('path(') ? v : v; });
    const tl = () => page.evaluate(async () => { await new Promise(r => setTimeout(r, 50)); return window.__tl.slice(); });
    const isPath = v => v.startsWith('path(');
    const begin = async (p, dx = 30, dy = 20) => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + dx / 2, p.y + dy / 2, { steps: 2 }); await page.mouse.move(p.x + dx, p.y + dy, { steps: 2 }); };

    let fix;
    if (part === 'pointer') {
    // Title-bar drag, ended by pointerup.
    await setup();
    fix = await fixture(page, 'A');
    const committed = await clip();
    expect(isPath(committed), 'committed clip').toBe(true);
    await begin(fix.vp.p_in);
    expect(await clip(), 'drag: suspended after the first move').toBe('none');
    // Mid-drag capture with the pointer still matches box mode at the same position (HP49: invisible).
    const box = await page.evaluate(() => window.__fpt.hosts.A.host.getBoundingClientRect().toJSON());
    const shot = { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 };
    const mid = await capture(page, shot);
    await page.mouse.up(); await settle(page);
    expect(await clip(), 'drag: restored to the committed path').toBe(committed);
    const t = await tl();
    expect(t.indexOf('pointerup') >= 0 && t.lastIndexOf('clip:path') > t.indexOf('pointerup'), `drag: restored only after the capture ends ${t}`).toBe(true);
    fix = await fixture(page, 'A');
    expect(await hitAt(page, fix.vp.p_out), 'drag: p_out passes again').toBe('sentinel');
    await page.evaluate(async () => { const f = window.__fpt; await f.hosts.A.m.applyState(f.hosts.A.host, { hit: 'box' }); await f.settle(); });
    const boxShot = await capture(page, shot);
    let diff = 0; for (let k = 0; k < mid.data.length; k += 4) if (Math.abs(mid.data[k] - boxShot.data[k]) + Math.abs(mid.data[k + 1] - boxShot.data[k + 1]) + Math.abs(mid.data[k + 2] - boxShot.data[k + 2]) > 6) diff++;
    expect(diff, 'mid-drag capture matches box mode at the same position').toBe(0);

    // Grow-box resize: restored with the new commit's S.
    await setup();
    fix = await fixture(page, 'A');
    const before = await clip();
    const gb = await page.evaluate(() => { const r = window.__fpt.hosts.A.host.shadowRoot.querySelector('button.scriptoscope-growbox').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await begin(gb, 40, 30);
    expect(await clip(), 'resize: suspended after the first move').toBe('none');
    await page.mouse.up(); await settle(page, 300);
    const after = await clip();
    expect(isPath(after) && after !== before, 'resize: restored with a new path').toBe(true);
    const t2 = await tl();
    expect(t2.lastIndexOf('clip:path') > t2.indexOf('pointerup'), `resize: restored after pointerup ${t2}`).toBe(true);
    const newFix = await fixture(page, 'A');
    expect(await hitAt(page, newFix.vp.p_out), 'resize: the new S applies').toBe('sentinel');
    }

    // Ended by pointercancel, by lostpointercapture, by a collapse and by a retheme mid-drag.
    for (const ending of ['pointercancel', 'lostpointercapture', 'collapse', 'retheme'].filter(e => e === part)) {
      await setup();
      fix = await fixture(page, 'A');
      const committedNow = await clip();
      await begin(fix.vp.p_in);
      expect(await clip(), `${ending}: suspended`).toBe('none');
      await page.evaluate(async ending => {
        const f = window.__fpt, host = f.hosts.A.host, L1 = host.shadowRoot.firstElementChild;
        if (ending === 'pointercancel') L1.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.__pid, pointerType: 'mouse', bubbles: true, composed: true }));
        else if (ending === 'lostpointercapture') L1.releasePointerCapture(window.__pid);
        else if (ending === 'collapse') await f.hosts.A.m.applyState(host, { collapsed: true });
        else { await f.managers[0].retheme(await f.theme('1984')); f.hosts.A.slug = '1984'; }
        await f.settle();
      }, ending);
      // WebKit delivers lostpointercapture with the pointer's next event (#577).
      if (ending === 'lostpointercapture') await page.mouse.move(fix.vp.p_in.x + 31, fix.vp.p_in.y + 21);
      await settle(page);
      const restored = await clip();
      expect(restored.slice(0, 12) + (isPath(restored) ? "" : ` effective=${(await state(page, "A")).hitEffective}`), `${ending}: restored while the button is still down`).toMatch(/^path\(/);
      if (ending === 'retheme' || ending === 'collapse') expect(restored, `${ending}: the new commit's path`).not.toBe(committedNow);
      else expect(restored, `${ending}: the committed path`).toBe(committedNow);
      await page.mouse.up(); await settle(page);
      expect(isPath(await clip()), `${ending}: still restored after release`).toBe(true);
    }

    if (part !== 'keyboard') return;
    // Keyboard move and resize steps never touch the clip.
    await setup();
    await page.evaluate(() => { window.__tl.length = 0; });
    for (const sel of ['.scriptoscope-movehandle', 'button.scriptoscope-growbox']) {
      await page.evaluate(sel => window.__fpt.hosts.A.host.shadowRoot.querySelector(sel).focus(), sel);
      for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight'); // real (composed) key events
    }
    await settle(page, 300);
    expect(await page.evaluate(() => window.__fpt.geom('A').W), 'keyboard steps happened').toBeGreaterThan(0);
    expect((await tl()).filter(x => x === 'clip:none'), 'keyboard steps: never suspended').toEqual([]);
    expect(isPath(await clip())).toBe(true);
  });

}
