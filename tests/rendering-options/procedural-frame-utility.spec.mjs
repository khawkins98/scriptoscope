import { existsSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { SCHEMES, UTILITY_TYPES, UTILITY_CONTENT, utilityPlan } from './procedural-frame-rules.mjs';

// Public renderWindow (source and built) against the procedural-frame utility rows
// (docs/spec/engine/procedural-frame.md rev 3, §9), for the five archives with no wnd#.
// Every expected value is the rule module's spec geometry (utilityPlan: UG1–UG3, UI10,
// UFC/UFH/UFS sample points, UFT3, US1/US5, UG5–UG7) resolved against the archive's own
// decoded resources: the utility frame cicns -14316/-14320 (side -14315/-14319), the
// stripes cicn -14314 (side -14318, else -14314) and the widget ics8/ics# -14320/-14318/-14319.
// Nothing is read from the runtime's tables. Each type is driven by its canonical slug and,
// where one exists, its legacy alias (the #421 B1 class: an alias that misses the record falls
// back to a document frame). Includes the exact collapsed-no-title-utility-window (#423).
const archiveOf = slug => ['scheme.sit', 'scheme.rsrc'].find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)));
const archives = Object.fromEntries(SCHEMES.map(slug => [slug, archiveOf(slug)]));
const plans = UTILITY_TYPES.map(type => {
  const { geo: _geo, ...plan } = utilityPlan(type);
  return { type, plan };
});
const TITLE = 'Inspector';
for (const mode of ['source', 'built']) {
  test(`${mode}: public renderWindow draws the utility frame the procedural-frame §9 rules predict`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'window.procedural-frame-utility' });
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, archives, plans, content, title }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const key = a => a.join(',');
      const rows = [];
      for (const [slug, file] of Object.entries(archives)) {
        // Expected side: the archive's own decoded resources, by resource id.
        const bytes = new Uint8Array(await (await fetch(`/themes/${slug}/${file}`)).arrayBuffer());
        const raw = await api.loadKaleidoscopeScheme(bytes, { encodeAssets: false });
        const asset = path => raw.assets.find(a => a.path === path);
        const px = (a, x, y) => Array.from(a.rgba.slice((y * a.width + x) * 4, (y * a.width + x) * 4 + 4));
        const cicn = id => asset(Object.values(raw.manifest.chromeElements).find(e => e.sourceCicnId === id)?.asset);
        const ics8 = id => { const e = Object.values(raw.iconIndex).find(i => i.type === 'ics8' && i.id === id); return e && asset(`icons/${e.file}`); };
        const mask = (id, x, y) => !!(raw.iconMaskPlanes[String(id)]?.[32 + y * 2 + (x >> 3)] & (0x80 >> (x & 7)));
        const theme = await api.loadTheme(`/themes/${slug}`);
        for (const { type, plan } of plans) {
          const Q = { active: cicn(plan.frameId.true), inactive: cicn(plan.frameId.false) };
          const stripeId = plan.stripeIds.find(id => cicn(id)), tile = stripeId === undefined ? null : cicn(stripeId);
          for (const state of ['active', 'inactive']) {
            const fill = px(Q[state], ...plan.samples.fill), other = Q[state === 'active' ? 'inactive' : 'active'];
            const renders = [];
            for (const windowType of [type.slug, ...(type.legacy ? [type.legacy] : [])]) {
              const el = await api.renderWindow(theme, { width: content[0], height: content[1], title, state, windowType });
              const canvas = el.querySelector('canvas.scriptoscope-chrome') ?? el.querySelector('canvas');
              const image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
              const at = (x, y) => Array.from(image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
              const f = el._scriptoscopeComposed?.frame;
              const probes = plan.probes.filter(p => state === 'inactive' || p.activeSafe).map(p => {
                const expected = px(Q[state], ...p.src), actual = at(...p.at);
                return { name: p.name, expected, actual, ok: key(expected) === key(actual), discriminating: key(expected) !== key(px(other, ...p.src)) };
              });
              const untouched = plan.untouched.map(([x, y]) => ({ at: [x, y], alpha: at(x, y)[3] }));
              // §9.6 UW4 / §9.8 UM3: glyph pixels inside each potential 10 × 10 box where the ics# mask is set.
              // "Discriminating" = the glyph pixel differs from this state's fill P; a hit = the port shows it.
              const widgets = Object.entries(plan.boxes).map(([name, [l, t]]) => {
                const id = plan.widgetIds[name][0], g = ics8(id); let discriminating = 0, hits = 0;
                for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (mask(id, x, y)) {
                  const glyph = key(px(g, x, y)); if (glyph === key(fill)) continue;
                  discriminating++; if (key(at(l + x, t + y)) === glyph) hits++;
                }
                return { name, id, discriminating, hits };
              });
              // §9.5 US1/US5: one 9-px period along the band. Active: each row (side: column) holds the
              // tile row's colours (any phase of a 1:1 tiling). Inactive: every pixel is the fill.
              const stripes = plan.stripes.across.map(k => {
                const line = plan.stripes.along.map(a => key(type.side ? at(k, a) : at(a, k))).sort();
                const r = k - plan.stripes.bandStart;
                const tileLine = tile ? Array.from({ length: 9 }, (_, i) => key(type.side ? px(tile, r, i) : px(tile, i, r))).sort() : null;
                return { k, line, tileLine, fill: key(fill) };
              });
              // §9.6 UW3 / UW5 (#424 review N3): an inactive window that draws no title (no-title, side) has
              // no stripes, no widgets and no title, so its whole frame interior is the fill.
              const [il, it, ir, ib] = plan.interior; let interiorOff = 0;
              if (state === 'inactive' && !type.titled) for (let y = it; y < ib; y++) for (let x = il; x < ir; x++) if (key(at(x, y)) !== key(fill)) interiorOff++;
              let hash = 0; for (let i = 0; i < image.data.length; i++) hash = (Math.imul(hash, 31) + image.data[i]) | 0;
              renders.push({ windowType, size: [image.width, image.height], frame: f ? [f.left, f.top, f.right, f.bottom] : null, probes, untouched, widgets, stripes, interiorOff, hash });
            }
            rows.push({ slug, type: type.slug, state, frameFound: !!Q.active && !!Q.inactive, stripeId: stripeId ?? null, renders });
          }
        }
        theme.dispose?.();
      }
      return rows;
    }, { mode, archives, plans, content: UTILITY_CONTENT, title: TITLE });
    await attachObservations(info, 'procedural-frame', `${mode}-utility`, { mode, rows });
    expect(UTILITY_TYPES.map(t => t.slug)).toContain('collapsed-no-title-utility-window');
    expect(rows).toHaveLength(SCHEMES.length * UTILITY_TYPES.length * 2);
    const planOf = slug => plans.find(p => p.type.slug === slug).plan;
    for (const r of rows) {
      const plan = planOf(r.type), type = UTILITY_TYPES.find(t => t.slug === r.type);
      expect(r.frameFound, `${r.slug}/${r.type}`).toBe(true);
      expect(r.renders).toHaveLength(type.legacy ? 2 : 1);
      for (const x of r.renders) {
        const where = `${r.slug}/${x.windowType}/${r.state}`;
        // Routing + geometry (UG1–UG3, UI10): structure size and frame insets; a document fallback is 6/22/7/7.
        expect(x.size, where).toEqual(plan.size);
        expect(x.frame, where).toEqual(plan.insets);
        // Frame selection and sample points (UFA1, UFC2–UFC5 / UFH7–UFH11 / UFS7–UFS11, UFT3).
        expect(x.probes.filter(p => !p.ok), where).toEqual([]);
        expect(x.untouched.filter(u => u.alpha !== 0), where).toEqual([]);
        // Stripes (UW2, US5) and widgets (UW4) only when active.
        const flat = x.stripes.filter(s => s.line.some(c => c !== s.fill));
        if (r.state === 'inactive') {
          expect(flat, where).toEqual([]);
          expect(x.widgets.filter(w => w.discriminating === 0 || w.hits > 0), where).toEqual([]);
          if (!type.titled) expect(x.interiorOff, `${where} interior`).toBe(0);
        } else {
          expect(r.stripeId, where).not.toBeNull();
          expect(x.stripes.filter(s => JSON.stringify(s.line) !== JSON.stringify(s.tileLine)), where).toEqual([]);
          expect(x.widgets.reduce((n, w) => n + w.hits, 0), where).toBeGreaterThan(0);
        }
      }
      // A legacy alias draws exactly what its canonical slug draws.
      expect(new Set(r.renders.map(x => x.hash)).size, `${r.slug}/${r.type}/${r.state} alias`).toBe(1);
    }
    // #421 B2: the collapsed titled bar is the expanded titled bar (H 15, frame top 16).
    expect(planOf('collapsed-titled-utility-window').insets[1]).toBe(planOf('titled-utility-window').insets[1]);
    // Frame state discriminates wherever the active and inactive cicns differ at the probes: every
    // archive but apple-platinum-2, whose -14316/-14320 and -14315/-14319 are pixel-identical.
    const disc = rows.filter(r => r.renders[0].probes.some(p => p.discriminating));
    expect([...new Set(disc.map(r => r.slug))]).toEqual(SCHEMES.filter(s => s !== 'apple-platinum-2'));
    for (const slug of SCHEMES.filter(s => s !== 'apple-platinum-2')) for (const t of UTILITY_TYPES) for (const state of ['active', 'inactive'])
      expect(disc.some(r => r.slug === slug && r.type === t.slug && r.state === state), `${slug}/${t.slug}/${state} discriminates`).toBe(true);
    // The stripes window can see "stripes drawn when inactive" in every archive: each tile has a pixel
    // that differs from the inactive fill (platinum-8's tile is one flat colour, the active fill, which
    // its inactive fill P(4, 3) of -14320 is not).
    const stripesSeen = rows.filter(r => r.state === 'inactive' && r.renders[0].stripes.some(s => s.tileLine?.some(c => c !== s.fill)));
    expect(SCHEMES.filter(slug => UTILITY_TYPES.some(t => !stripesSeen.some(r => r.slug === slug && r.type === t.slug)))).toEqual([]);
  });
}
