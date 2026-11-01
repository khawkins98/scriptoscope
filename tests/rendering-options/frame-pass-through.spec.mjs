// #597 frame pass-through, hit and mode hooks (docs/spec/engine/hit-regions.md §9.8):
// HPT1, HPT2, HPT3, HPT7, HPT17, HPT20, HPT21, HPT22, HPT23, HPT24.
// Points come from hit-region-rules.mjs (the §4.2 decode on the archive's own
// template and placed cells). Observations claim web host policy (§9); the
// Window Manager half is U1.
import { test, expect, MODES, FIXTURES, NEGATIVE, boot, fixture, hitAt, state, events, settle, observe } from './frame-pass-through-fixture.mjs';

async function drag(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 3 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 3 });
  await page.mouse.up();
  await settle(page);
}

for (const mode of MODES) {
  for (const [label, fx] of Object.entries(FIXTURES)) {
    test(`${mode}: HPT1/HPT2 ${label} region mode passes p_out to the page, keeps p_in, p_c and title drag`, async ({ page, servers }, info) => {
      await boot(page, servers, mode);
      await page.evaluate(async fx => { const f = window.__fpt; f.manager(); await f.add('A', { slug: fx.slug, type: fx.type }); }, fx);
      const fix = await fixture(page, 'A', { out: fx.out ?? 'top' });
      // Fixture preconditions: the decode places C where the runtime's content box is (HP16)
      // and agrees with the drawn alpha outside C (HP15 cross-check, not a source).
      expect(fix.domC, 'content box at the decoded C').toEqual(fix.C);
      const cc = await page.evaluate(async () => { const f = window.__fpt; return f.crossCheck('A', await f.oracle('A')); });
      expect(cc.disagree, `HP15 cross-check ${JSON.stringify(cc.samples)}`).toBe(0);
      expect(fix.points.p_out && fix.points.p_in && fix.points.p_c, 'decode yields p_out, p_in, p_c').toBeTruthy();
      const before = await state(page, 'A');
      expect(before.hitEffective, 'describe().hitEffective').toBe('region');
      expect(before.attr, 'data-scriptoscope-hit-effective').toBe('region');
      // HPT1: elementFromPoint and a real mouse click at p_out reach the sentinel.
      expect(await hitAt(page, fix.vp.p_out), 'elementFromPoint(p_out)').toBe('sentinel');
      await events(page);
      await page.mouse.click(fix.vp.p_out.x, fix.vp.p_out.y);
      await settle(page);
      const ev = (await events(page)).filter(e => e.at === 'sentinel').map(e => e.type);
      expect(ev, 'sentinel receives the press and the click').toEqual(expect.arrayContaining(['pointerdown', 'click']));
      const after = await state(page, 'A');
      expect(after.downs, 'host saw no pointerdown').toBe(before.downs);
      expect([after.left, after.top], 'not dragged').toEqual([before.left, before.top]);
      // HPT2: p_in hits the host (retargeted), p_c the content.
      expect(await hitAt(page, fix.vp.p_in), 'elementFromPoint(p_in)').toBe('host:A');
      expect(await hitAt(page, fix.vp.p_c), 'elementFromPoint(p_c)').toBe('content:A');
      // A press-drag from the title-bar p_in moves the window.
      const r0 = await page.evaluate(() => window.__fpt.hosts.A.host.getBoundingClientRect().toJSON());
      await drag(page, fix.vp.p_in, 37, 23);
      const r1 = await page.evaluate(() => window.__fpt.hosts.A.host.getBoundingClientRect().toJSON());
      expect([r1.x - r0.x, r1.y - r0.y], 'title-bar drag from p_in').toEqual([37, 23]);
      await observe(info, 'frame-pass-through', `${mode}-hpt1-${label}`, { mode, fixture: fx, points: fix.points, census: fix.census, crossCheck: cc });
    });
  }

  test(`${mode}: HPT2 windows-95 negative control: every sampled box point hits the window`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async fx => { const f = window.__fpt; f.manager(); await f.add('W', { slug: fx.slug, type: fx.type }); }, NEGATIVE);
    const fix = await fixture(page, 'W');
    expect(fix.census.out, 'windows-95 S is the whole box').toBe(0);
    expect(fix.points.p_out).toBeNull();
    const misses = await page.evaluate(() => {
      const f = window.__fpt, g = f.geom('W'), out = [];
      for (let y = 0; y < g.H; y += 7) for (let x = 0; x < g.W; x += 7) {
        const p = f.vp('W', [x, y]), hit = f.hitAt(p.x, p.y);
        if (hit !== 'host:W' && hit !== 'content:W') out.push([x, y, hit]);
      }
      return out;
    });
    expect(misses).toEqual([]);
    expect((await state(page, 'W')).hitEffective).toBe('region');
  });

  test(`${mode}: HPT2 (T14) S comes from the template mask, not canvas alpha after the title`, async ({ page, servers }) => {
    // windows-95 with every top-band template pixel mask-clear: the whole title band is
    // outside S whatever the title layout (SR10), yet the title text paints ink there.
    await boot(page, servers, mode);
    const result = await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      const dec = await f.decode('windows-95'), A = dec.manifest.windowTypes['document-window'].parts['part-0'].rect;
      const { theme, synthetic } = await f.synth('windows-95', ['document-window'], (rgba, w) => { for (let y = 0; y < A[1]; y++) for (let x = 0; x < w; x++) rgba[(y * w + x) * 4 + 3] = 0; });
      await f.add('T', { themeObject: theme, slug: 'windows-95', synthetic, title: 'WWWW MMMM Synthetic Title Ink' });
      const o = await f.oracle('T'), g = f.geom('T');
      const canvas = f.layers('T').canvas, px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let sampled = 0, inked = 0; const hits = [];
      for (let y = 0; y < o.C.top; y++) for (let x = 0; x < g.W; x++) {
        if (o.region[y * o.W + x] !== f.rules.OUT) continue;
        sampled++;
        if (px[(y * g.W + x) * 4 + 3] !== 0) inked++;
        const p = f.vp('T', [x, y]), hit = f.hitAt(p.x, p.y);
        if (hit !== 'sentinel' && hits.length < 10) hits.push([x, y, hit]);
      }
      return { sampled, inked, hits };
    });
    expect(result.sampled).toBeGreaterThan(1000);
    expect(result.inked, 'precondition: title ink is drawn over mask-clear pixels').toBeGreaterThan(0);
    expect(result.hits, 'every mask-clear title-band pixel passes, inked or not').toEqual([]);
  });

  test(`${mode}: HPT3 box opt-out (attribute, case/whitespace, option), reflection and a mode-only switch to region`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const html = v => `<article data-scriptoscope-window ${v === undefined ? '' : `data-scriptoscope-hit="${v}"`} data-scriptoscope-title="" data-scriptoscope-width="320" data-scriptoscope-height="200" data-scriptoscope-x="120" data-scriptoscope-y="140"><p>Body</p></article>`;
    const cases = [['box', 'box'], [' BOX ', 'box'], ['boxed', 'region']];
    for (const [value, expected] of cases) {
      await page.evaluate(async ({ html }) => { const f = window.__fpt; f.reset(); f.manager(); await f.promote('D', { slug: 'dolphin-som', html }); }, { html: html(value) });
      const fix = await fixture(page, 'D');
      const s = await state(page, 'D');
      expect([s.attr, s.hitEffective], `attribute "${value}"`).toEqual([expected, expected]);
      expect(s.hit, `describe().hit for "${value}"`).toBe(expected === 'box' ? 'box' : undefined);
      expect(await hitAt(page, fix.vp.p_out), `p_out for "${value}"`).toBe(expected === 'box' ? 'host:D' : 'sentinel');
    }
    // Imperative option, then applyState({ hit: 'region' }) as a mode-only change.
    await page.evaluate(async () => { const f = window.__fpt; f.reset(); f.manager(); await f.add('I', { slug: 'dolphin-som', hit: 'box' }); f.watch('I'); });
    const fix = await fixture(page, 'I');
    let s = await state(page, 'I');
    expect([s.attr, s.hitEffective, s.hit]).toEqual(['box', 'box', 'box']);
    expect(await hitAt(page, fix.vp.p_out)).toBe('host:I');
    const c0 = s.changes;
    await page.evaluate(async () => { const f = window.__fpt; await f.hosts.I.m.applyState(f.hosts.I.host, { hit: 'region' }); });
    expect(await hitAt(page, fix.vp.p_out), 'region after the switch, no commit').toBe('sentinel');
    s = await state(page, 'I');
    expect([s.attr, s.hitEffective, s.hit]).toEqual(['region', 'region', 'region']);
    expect(s.changes - c0, 'change-listener calls').toBe(0);
    expect(await page.evaluate(() => window.__fpt.records('I')), 'canvas mutation records').toBe(0);
  });

  test(`${mode}: HPT20 manager default, per-window precedence, unknown values and setDefaultHit`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const html = (v, x = 120) => `<article data-scriptoscope-window ${v === undefined ? '' : `data-scriptoscope-hit="${v}"`} data-scriptoscope-title="" data-scriptoscope-width="320" data-scriptoscope-height="200" data-scriptoscope-x="${x}" data-scriptoscope-y="140"><p>Body</p></article>`;
    const run = (opts, windows) => page.evaluate(async ({ opts, windows }) => {
      const f = window.__fpt; f.reset(); f.logs.length = 0; f.manager(opts === null ? undefined : opts);
      for (const [name, value, x] of windows) await f.promote(name, { slug: 'dolphin-som', html: value });
      return f.logs.map(l => l.text);
    }, { opts, windows: windows.map(([n, v, x]) => [n, html(v, x), x]) });
    // Manager { hit: 'box' }: inheriting window is box; a page press does not deactivate it.
    await run({ hit: 'box' }, [['N', undefined, 40], ['R', 'region', 720]]);
    const fN = await fixture(page, 'N'), fR = await fixture(page, 'R');
    expect((await state(page, 'N')).hitEffective).toBe('box');
    expect((await state(page, 'N')).hit).toBeUndefined();
    expect(await hitAt(page, fN.vp.p_out)).toBe('host:N');
    expect((await state(page, 'R')).hitEffective).toBe('region');
    expect(await hitAt(page, fR.vp.p_out)).toBe('sentinel');
    // Activate N, then press the page: N (inherited box) stays active.
    await page.mouse.click(fN.vp.p_c.x, fN.vp.p_c.y); await settle(page);
    expect((await state(page, 'N')).active).toBe(true);
    await page.mouse.click(1240, 930); await settle(page);
    expect((await state(page, 'N')).active, 'inherited box: no outside-press deactivation').toBe(true);
    // Manager default region with attribute box: box.
    await run(null, [['B', 'box', 120]]);
    expect((await state(page, 'B')).hitEffective).toBe('box');
    // Manager { hit: 'Boxed' }: region, logged once.
    const logs = await run({ hit: 'Boxed' }, [['X', undefined, 120]]);
    expect((await state(page, 'X')).hitEffective).toBe('region');
    expect(logs.filter(t => t.includes('Boxed')), 'unknown manager default logs once').toHaveLength(1);
    // Attribute "boxed" under manager box: ignored, so it inherits box.
    await run({ hit: 'box' }, [['Y', 'boxed', 120]]);
    expect((await state(page, 'Y')).hitEffective).toBe('box');
    expect((await state(page, 'Y')).hit).toBeUndefined();
    // setDefaultHit('region'): the inheriting window switches, the own-box window stays, no commit.
    await run({ hit: 'box' }, [['N', undefined, 40], ['O', 'box', 720]]);
    const fN2 = await fixture(page, 'N'), fO = await fixture(page, 'O');
    await page.evaluate(() => { const f = window.__fpt; f.watch('N'); f.watch('O'); });
    const c0 = [(await state(page, 'N')).changes, (await state(page, 'O')).changes];
    await page.evaluate(() => window.__fpt.managers[0].setDefaultHit('region'));
    expect(await hitAt(page, fN2.vp.p_out), 'inheriting window now region').toBe('sentinel');
    expect(await hitAt(page, fO.vp.p_out), 'own box untouched').toBe('host:O');
    expect([(await state(page, 'N')).hitEffective, (await state(page, 'O')).hitEffective]).toEqual(['region', 'box']);
    expect([(await state(page, 'N')).changes - c0[0], (await state(page, 'O')).changes - c0[1]], 'change-listener calls').toEqual([0, 0]);
    expect([await page.evaluate(() => window.__fpt.records('N')), await page.evaluate(() => window.__fpt.records('O'))], 'canvas records').toEqual([0, 0]);
    // applyState({ hit: null }) returns O to inheriting (now region).
    await page.evaluate(async () => { const f = window.__fpt; await f.hosts.O.m.applyState(f.hosts.O.host, { hit: null }); });
    expect((await state(page, 'O')).hit).toBeUndefined();
    expect((await state(page, 'O')).hitEffective).toBe('region');
    expect(await hitAt(page, fO.vp.p_out)).toBe('sentinel');
  });

  test(`${mode}: HPT21 a bare renderWindow() element is never clipped`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const r = await page.evaluate(async () => {
      const f = window.__fpt;
      const el = await f.api.renderWindow(await f.theme('dolphin-som'), { width: 320, height: 200, title: '' });
      Object.assign(el.style, { position: 'absolute', left: '120px', top: '140px', zIndex: '3' });
      document.body.append(el);
      f.hosts.R = { host: el, slug: 'dolphin-som', type: 'document-window', m: { describe: () => null } };
      await f.settle();
      const o = await f.oracle('R'), p = f.points(o), v = f.vp('R', p.p_out);
      const all = [el, ...el.querySelectorAll('*')];
      const clipped = all.filter(n => getComputedStyle(n).clipPath !== 'none').length;
      // Inline pointer-events as before #597 (the chrome canvas alone sets none).
      const pe = all.filter(n => n.style.pointerEvents !== '').map(n => `${n.className}:${n.style.pointerEvents}`);
      return { clipped, pe, hit: document.elementFromPoint(v.x, v.y) === el || el.contains(document.elementFromPoint(v.x, v.y)) };
    });
    expect(r.clipped).toBe(0);
    expect(r.pe, 'no pointer-events change from the pre-#597 element').toEqual(['scriptoscope-chrome:none']);
    expect(r.hit, 'p_out returns the window element').toBe(true);
  });

  test(`${mode}: HPT22 no-chrome baseline and a recipe whose template fails to load are box`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const dolphin = await page.evaluate(async () => { const f = window.__fpt; f.manager(); await f.add('ref', { slug: 'dolphin-som' }); const o = await f.oracle('ref'); const p = f.points(o); f.drop('ref'); return p; });
    for (const variant of ['no-chrome', 'missing-template']) {
      const r = await page.evaluate(async ({ variant, p }) => {
        const f = window.__fpt; f.reset(); f.manager();
        const base = await f.theme('dolphin-som');
        const windowTypes = variant === 'no-chrome' ? {} : { ...base.manifest.windowTypes,
          'document-window': { ...base.manifest.windowTypes['document-window'], chrome: { active: '/themes/dolphin-som/fpt-missing-active.png', inactive: '/themes/dolphin-som/fpt-missing-inactive.png' } } };
        const themeObject = { ...base, base: undefined, manifest: { ...base.manifest, windowTypes, chromeElements: variant === 'no-chrome' ? {} : base.manifest.chromeElements } };
        let error = null;
        try { await f.add('S', { themeObject, slug: 'dolphin-som' }); } catch (e) { error = String(e); }
        if (error) return { error };
        // The box: the host's border box (there may be no chrome canvas without chrome).
        const b = f.hosts.S.host.getBoundingClientRect(), s = f.state('S');
        const frame = { x: b.x + Math.min(p.p_out[0], b.width - 1) + 0.5, y: b.y + Math.min(p.p_out[1], b.height - 1) + 0.5 }, corner = { x: b.x + 1.5, y: b.y + 1.5 };
        const cr = f.hosts.S.contentEl.getBoundingClientRect();
        return { s, frame: f.hitAt(frame.x, frame.y), corner: f.hitAt(corner.x, corner.y), content: f.hitAt(cr.x + cr.width / 2, cr.y + cr.height / 2) };
      }, { variant, p: dolphin });
      // HP7 reachability: a template that cannot be decoded rejects add() (pre-#597
      // behaviour), so no public input reaches "recipe without a template" this way.
      if (r.error && variant === 'missing-template') { test.info().annotations.push({ type: 'observation', description: `HP7 unreachable through an undecodable template: ${r.error}` }); continue; }
      expect(r.error, `${variant}: the window still mounts`).toBeUndefined();
      expect([r.s.hitEffective, r.s.attr], variant).toEqual(['box', 'box']);
      expect(r.frame, `${variant}: frame point`).toMatch(/^(host|content):S$/);
      expect(r.corner, `${variant}: corner`).toMatch(/^(host|content):S$/);
      expect(r.content, `${variant}: p_c`).toMatch(/^(host|content):S$/);
    }
  });

  test(`${mode}: HPT23 1984 popup-window: the tab hits, the band beside it passes`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const r = await page.evaluate(async () => {
      const f = window.__fpt; f.manager(); await f.add('P', { slug: '1984', type: 'popup-window' });
      const o = await f.oracle('P'), top = o.layout.sides[0], a = top.anchor;
      const { p } = f.chromeRules.cellRects(o.layout, top, a);
      const uniform = (x, y, v) => f.rules.uniform(o.region, o.W, o.H, x, y, v, 1);
      let tab = null, band = null;
      for (let y = p.top; y < p.bottom && !tab; y++) for (let x = p.left; x < p.right && !tab; x++) if (uniform(x, y, f.rules.IN)) tab = [x, y];
      for (let y = 0; y < o.C.top && !band; y++) for (let x = p.right + 2; x < o.W && !band; x++) if (uniform(x, y, f.rules.OUT)) band = [x, y];
      const at = q => { const v = f.vp('P', q); return f.hitAt(v.x, v.y); };
      return { anchor: a, tabRect: p, tab, band, tabHit: tab && at(tab), bandHit: band && at(band) };
    });
    expect(r.anchor, 'popup top side has a code-5 tab').toBeGreaterThan(0);
    expect(r.tab && r.band, `decoded tab ${r.tab} and band ${r.band}`).toBeTruthy();
    expect(r.tabHit).toBe('host:P');
    expect(r.bandHit).toBe('sentinel');
  });

  test(`${mode}: HPT24 the clip is one path() on L2 with integer multiples of k`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    for (const scale of [1, 2]) {
      const r = await page.evaluate(async scale => {
        const f = window.__fpt; f.reset(); f.manager(); await f.add('K', { slug: 'dolphin-som', scale, w: 160, h: 100 });
        const { L1, L2 } = f.layers('K'), host = f.hosts.K.host;
        const cs = n => getComputedStyle(n);
        const value = cs(L2).clipPath;
        const props = [host, L1, L2].map(n => ({ clip: cs(n).clipPath, mask: cs(n).maskImage ?? cs(n).webkitMaskImage ?? 'none', webkitMask: cs(n).webkitMaskImage ?? 'none' }));
        return { value: value.slice(0, 40), numbers: f.rules.pathNumbers(value), props, l2IsL1: L2 === L1 };
      }, scale);
      expect(r.l2IsL1, 'L2 is a separate layer inside L1').toBe(false);
      expect(r.value.startsWith('path('), `L2 clip-path at k=${scale}: ${r.value}`).toBe(true);
      expect(r.numbers?.length).toBeGreaterThan(4);
      expect(r.numbers.filter(n => !Number.isInteger(n) || n % scale !== 0), `k=${scale} coordinates`).toEqual([]);
      for (const p of r.props) {
        expect(p.clip.startsWith('url(') || p.clip.startsWith('polygon(')).toBe(false);
        expect(p.mask === 'none' && p.webkitMask === 'none', 'no mask-image').toBe(true);
      }
    }
  });

  test(`${mode}: HPT7 retheme recomputes S and the effective mode; a box request survives`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    await page.evaluate(async () => { const f = window.__fpt; f.manager(); await f.add('A', { slug: 'dolphin-som', left: 60 }); await f.add('O', { slug: 'dolphin-som', hit: 'box', left: 620 }); });
    const fA = await fixture(page, 'A'), fO = await fixture(page, 'O');
    expect(await hitAt(page, fA.vp.p_out)).toBe('sentinel');
    const step = async slug => {
      await page.evaluate(async slug => { const f = window.__fpt; await f.managers[0].retheme(await f.theme(slug)); for (const n of ['A', 'O']) f.hosts[n].slug = slug; await f.settle(); }, slug);
      return { A: await state(page, 'A'), O: await state(page, 'O') };
    };
    let s = await step('windows-95');
    const w95 = await page.evaluate(async p => { const f = window.__fpt, o = await f.oracle('A'); return p[0] < o.W && p[1] < o.H ? f.value(o, p) : null; }, fA.points.p_out);
    expect(w95, "dolphin's p_out lies in windows-95's S").toBe(1);
    expect(await hitAt(page, fA.vp.p_out), 'windows-95: dolphin p_out hits').toBe('host:A');
    expect([s.A.hitEffective, s.O.hit, s.O.hitEffective]).toEqual(['region', 'box', 'box']);
    s = await step('platinum-8');
    expect([s.A.hitEffective, s.A.attr, s.O.hit, s.O.hitEffective]).toEqual(['box', 'box', 'box', 'box']);
    s = await step('dolphin-som');
    expect([s.A.hitEffective, s.A.hit, s.O.hit, s.O.hitEffective]).toEqual(['region', undefined, 'box', 'box']);
    expect(await hitAt(page, fA.vp.p_out), 'dolphin again: p_out passes').toBe('sentinel');
    expect(await hitAt(page, fO.vp.p_out), 'box opt-out survives').toBe('host:O');
  });

  test(`${mode}: HPT17 the effective mode follows the base-chain owner, not the requested slug`, async ({ page, servers }) => {
    await boot(page, servers, mode);
    const r = await page.evaluate(async () => {
      const f = window.__fpt; f.manager();
      const [plat, dol] = [await f.theme('platinum-8'), await f.theme('dolphin-som')];
      // A built-in-frame-slugged child with no window types of its own resolves to the dolphin recipe…
      const toRecipe = { ...plat, manifest: { ...plat.manifest, windowTypes: {} }, base: dol };
      // …and a recipe-slugged child with none resolves to the platinum-8 built-in frame.
      const toBuiltIn = { ...dol, manifest: { ...dol.manifest, windowTypes: {} }, base: plat };
      await f.add('toRecipe', { themeObject: toRecipe, slug: 'dolphin-som', left: 40 });
      await f.add('toBuiltIn', { themeObject: toBuiltIn, slug: 'platinum-8', left: 620 });
      const o = await f.oracle('toRecipe'), p = f.points(o), v = f.vp('toRecipe', p.p_out);
      return { recipe: f.state('toRecipe').hitEffective, builtIn: f.state('toBuiltIn').hitEffective, pass: f.hitAt(v.x, v.y) };
    });
    expect(r).toEqual({ recipe: 'region', builtIn: 'box', pass: 'sentinel' });
  });
}
