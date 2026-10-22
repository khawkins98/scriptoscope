import { existsSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { SCHEMES, STANDARD, DRIVER_ROWS } from './procedural-frame-rules.mjs';

// Public renderWindow (source and built) against the procedural-frame rule rows
// (docs/spec/engine/procedural-frame.md), for the five archives with no wnd#.
// Expected values come from procedural-frame-rules.mjs (spec values, reviewed in
// #409) resolved against each archive's own decoded resources; nothing here is
// read from the runtime's own tables. Document window only: utility frames are
// undecoded (spec §9, #414). The standard window is C = [100, 60, 300, 200]
// (200 × 140 content, H 22), so the structure starts at (94, 38).
const archives = Object.fromEntries(SCHEMES.map(slug => [slug, ['scheme.sit', 'scheme.rsrc']
  .find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)))]));
const [cl, ct, cr, cb] = STANDARD.C;
for (const mode of ['source', 'built']) {
  test(`${mode}: public renderWindow draws the built-in document frame the procedural-frame rules predict`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'window.procedural-frame' });
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, archives, D, size }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rows = [];
      for (const [slug, file] of Object.entries(archives)) {
        // Expected side: the archive's own decoded resources, by resource id.
        const raw = await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch(`/themes/${slug}/${file}`)).arrayBuffer()), { encodeAssets: false });
        const asset = path => raw.assets.find(a => a.path === path);
        const px = (a, x, y) => Array.from(a.rgba.slice((y * a.width + x) * 4, (y * a.width + x) * 4 + 4));
        const cicn = id => asset(Object.values(raw.manifest.chromeElements).find(e => e.sourceCicnId === id)?.asset);
        const ics8 = id => { const e = Object.values(raw.iconIndex).find(i => i.type === 'ics8' && i.id === id); return e && asset(`icons/${e.file}`); };
        const mask = (id, x, y) => !!(raw.iconMaskPlanes[String(id)]?.[32 + y * 2 + (x >> 3)] & (0x80 >> (x & 7)));
        // Gate (§1.1): wnd# -14336 and WDEF -14330 both absent.
        const theme = await api.loadTheme(`/themes/${slug}`, { provenance: true });
        const res = theme.byteProvenance.resources;
        const gate = { wnd: res.filter(r => r.type === 'wnd#').map(r => r.signedId), wdef: res.filter(r => r.type === 'WDEF' && r.signedId === -14330).length };
        for (const state of ['active', 'inactive']) {
          const el = await api.renderWindow(theme, { width: size[0], height: size[1], title: '', state, windowType: 'document-window' });
          const canvas = el.querySelector('canvas');
          const image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
          const at = (x, y) => Array.from(image.data.slice(((y - 38) * image.width + (x - 94)) * 4, ((y - 38) * image.width + (x - 94)) * 4 + 4));
          const frameId = D.D4.expected.frame[state], frame = cicn(frameId);
          const probes = { ...D.D4.expected.probes, ...(state === 'inactive' ? D.D4.expected.inactiveOnly : {}) };
          const probeRows = Object.entries(probes).map(([name, [[x, y], src]]) => {
            const actual = at(x, y);
            const expected = src === 'untouched' ? 'untouched' : px(frame, src[0], src[1]);
            const ok = src === 'untouched' ? actual[3] === 0 : JSON.stringify(actual) === JSON.stringify(expected);
            return { name, expected, actual, ok };
          });
          // §3.3 / §6.1 widget glyphs (D6): ics8 pixel wherever the ics# mask is set, at the 16 × 16 slot.
          const widgetRows = D.D6.expected[state].map(([name, id, [l, t]]) => {
            const g = ics8(id); let set = 0, bad = 0;
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (mask(id, x, y)) {
              set++; if (JSON.stringify(at(l + x, t + y)) !== JSON.stringify(px(g, x, y))) bad++;
            }
            return { name, id, set, bad };
          });
          rows.push({ slug, state, gate, width: image.width, height: image.height, frameId, frameFound: !!frame, probes: probeRows, widgets: widgetRows,
            discriminating: probeRows.filter(p => p.expected !== 'untouched' && JSON.stringify(p.expected) !== JSON.stringify(px(cicn(D.D4.expected.frame[state === 'active' ? 'inactive' : 'active']), ...probes[p.name][1]))).length });
        }
        theme.dispose?.();
      }
      return rows;
    }, { mode, archives, D: DRIVER_ROWS, size: [cr - cl, cb - ct] });
    await attachObservations(info, 'procedural-frame', `${mode}-document`, { mode, rows });
    expect(rows).toHaveLength(SCHEMES.length * 2);
    for (const r of rows) {
      const where = `${r.slug}/${r.state}`;
      expect(r.gate, where).toEqual({ wnd: [], wdef: 0 });
      expect(r.frameFound, where).toBe(true);
      // §3.3 / G3: structure = content + 12 + 1 shadow by content + H + 6 + 1.
      expect([r.width, r.height], where).toEqual([cr - cl + 13, cb - ct + 22 + 7]);
      expect(r.probes.filter(p => !p.ok), where).toEqual([]);
      expect(r.widgets.filter(w => w.set === 0 || w.bad > 0), where).toEqual([]);
      expect(r.widgets.length, where).toBe(r.state === 'active' ? 3 : 0);
    }
    // The frame-state probes can fail only where -14332 and -14336 differ: every archive
    // but apple-platinum-2, whose two frame cicns are pixel-identical (selection-non-discriminating).
    expect([...new Set(rows.filter(r => r.discriminating > 0).map(r => r.slug))]).toEqual(SCHEMES.filter(s => s !== 'apple-platinum-2'));
  });
}
