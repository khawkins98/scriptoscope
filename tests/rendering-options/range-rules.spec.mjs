import { existsSync, readFileSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { parseResourceMap } from './checkable-rules.mjs';
import { PUBLIC_ROWS, SAMPLE, SLUGS, checkRow, classify, expectedSet, nativeFor, scrollCensus, selectScrollbar } from './range-rules.mjs';
import { DRIVER_ROWS } from './scrollbar-geometry-rules.mjs';

// The scroll-bar rule table of range-rules.test.mjs, run against the public
// source and built composeScrollbar. Expectations are computed here in Node from
// each archive's own resource map. In the page every candidate cicn and arrow
// icon of the loaded theme is replaced by a solid sentinel raster of the same
// size, so the output reports WHICH resources were drawn (selection only; art
// decoding and geometry are not asserted).
const predictions = {}, censuses = {};
for (const slug of SLUGS) {
  const file = ['scheme.sit', 'scheme.rsrc'].find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)));
  const bytes = readFileSync(new URL(`../../themes/${slug}/${file}`, import.meta.url));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  const census = scrollCensus(parseResourceMap(fork));
  censuses[slug] = census;
  predictions[slug] = PUBLIC_ROWS.map(row => nativeFor(row).map(native => ({ native, prediction: selectScrollbar(native, census) })));
}

// Recorded disagreements with the decode. With the v2 engine driver (#395) the
// rule table predicts every public row: KNOWN and CLASSES are empty. They stay
// as named lists so a regression is reported per class (R1 track tier, R2
// thumb while disabled/inactive, R3 icon-lane arrows, R4 composite
// discriminator, R5 non-hit arrow boxes; docs/spec/range-controls.md). The
// empty lists are the rule table's claim, not a reading of runtime output: the
// predictions are unchanged from the table that pinned the 112 prior rows.
const ICON = ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
const KNOWN = [];
const CLASSES = {};
// D1 (scrollbar-geometry-rules.mjs DRIVER_ROWS): public pressedPart -> exactly
// the hilite's resource set (engine/scrollbar.md §2 mapping 20/21/22/23/129).
const PARTS = { up: 20, down: 21, pageUp: 22, pageDown: 23, thumb: 129 };
const D1_SLUGS = Object.keys(DRIVER_ROWS.D1.expected);
const D1_ROWS = Object.keys(PARTS).map(pressedPart => ({ orientation: 'horizontal', state: 'pressed', pressedPart }));

for (const mode of ['source', 'built']) {
  test(`${mode}: public composeScrollbar selects the resources the 2.3.1 scroll-bar CDEF selects (all 144 rows; D1 pressedPart)`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'scrollbar.selection-rules' });
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async ({ mode, slugs, rows, sample, d1Slugs, d1Rows }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const inCicn = id => (id >= -8288 && id <= -8249) || (id >= -10208 && id <= -10197), inIcon = id => id >= -10208 && id <= -10197;
      const out = {};
      for (const slug of slugs) {
        const theme = await api.loadTheme(`/themes/${slug}`);
        const sentinel = new Map(); let k = 0;
        const paint = async (url, name) => {
          const bitmap = await createImageBitmap(await (await fetch(url)).blob());
          const i = k++, rgb = [160 + (i % 8) * 12, 120 + ((i >> 3) % 8) * 16, 140 + (i >> 6) * 40]; // luminance > 110
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
          ctx.fillStyle = `rgb(${rgb})`; ctx.fillRect(0, 0, bitmap.width, bitmap.height);
          sentinel.set(rgb.join(','), name);
          return URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' }));
        };
        const swapped = new Map();
        for (const el of Object.values(theme.manifest.chromeElements)) {
          if (!inCicn(el.sourceCicnId ?? 0)) continue;
          const name = `cicn ${el.sourceCicnId}`;
          if (!swapped.has(name)) swapped.set(name, await paint(el.asset, name));
          el.asset = swapped.get(name);
        }
        for (const id of Object.keys(theme.glyphs ?? {})) if (inIcon(Number(id))) theme.glyphs[id] = await paint(theme.glyphs[id], `icon ${id}`);
        out[slug] = { candidates: [...sentinel.values()].sort(), rows: [] };
        for (const { orientation, state, pressedPart } of [...rows, ...(d1Slugs.includes(slug) ? d1Rows : [])]) {
          const buffer = await api.composeScrollbar(theme, { orientation, state, ...(pressedPart ? { pressedPart } : {}), ...sample });
          if (!buffer) { out[slug].rows.push({ isNull: true, present: [] }); continue; }
          const present = new Set(); let procedural = 0;
          for (let i = 0; i < buffer.data.length; i += 4) {
            if (!buffer.data[i + 3]) continue;
            const name = buffer.data[i + 3] === 255 ? sentinel.get(`${buffer.data[i]},${buffer.data[i + 1]},${buffer.data[i + 2]}`) : undefined;
            if (name) present.add(name); else procedural += 1;
          }
          out[slug].rows.push({ isNull: false, size: [buffer.width, buffer.height], present: [...present].sort(), procedural });
        }
        theme.dispose?.();
      }
      return out;
    }, { mode, slugs: SLUGS, rows: PUBLIC_ROWS, sample: SAMPLE, d1Slugs: D1_SLUGS, d1Rows: D1_ROWS });

    const results = SLUGS.flatMap(slug => PUBLIC_ROWS.map((row, i) => ({ slug, row, key: `${slug}/${row.orientation[0]}/${row.state}`,
      observed: observed[slug].rows[i], ...checkRow(predictions[slug][i], observed[slug].rows[i]) })));
    await attachObservations(info, 'range-rules', mode, { mode, results });
    expect(Object.keys(observed)).toEqual(SLUGS);
    // Sentinel coverage: every candidate the decode can name was substituted.
    for (const slug of SLUGS) {
      const named = new Set(predictions[slug].flat().flatMap(p => [...p.prediction.tracks.map(id => `cicn ${id}`), ...(p.prediction.thumb ? [`cicn ${p.prediction.thumb}`] : []), ...p.prediction.icons.map(id => `icon ${id}`)]));
      for (const n of named) expect(observed[slug].candidates, `${slug} ${n}`).toContain(n);
    }
    expect(results).toHaveLength(144);
    expect(results.filter(r => r.skipped)).toEqual([]);
    const failing = results.filter(r => r.failure);
    expect(failing.map(r => r.key).sort()).toEqual(KNOWN);
    const classes = {};
    for (const r of failing) for (const c of classify(predictions[r.slug][PUBLIC_ROWS.indexOf(r.row)], r.observed)) (classes[c] ??= []).push(r.key);
    for (const c of Object.keys(classes)) classes[c].sort();
    await attachObservations(info, 'range-rules', `${mode}-classes`, { classes });
    expect(classes).toEqual(CLASSES);
    // Agreement is meaningful only where the row passes; name what those rows draw.
    const agreeing = results.filter(r => !r.failure);
    expect(agreeing).toHaveLength(144 - KNOWN.length);
    expect(agreeing.filter(r => ICON.includes(r.slug))).toHaveLength(40);
    // Public `pressed` without a part is hilite 129 (engine/scrollbar.md §2 mapping).
    for (const r of agreeing.filter(r => r.row.state === 'pressed')) expect(r.matched, r.key).toContain(129);
    // D1: each pressedPart draws exactly its hilite's set, and that set is the spec value.
    const d1 = Object.fromEntries(D1_SLUGS.map(slug => [slug, Object.fromEntries(D1_ROWS.map((row, i) => [row.pressedPart, observed[slug].rows[PUBLIC_ROWS.length + i]]))]));
    for (const slug of D1_SLUGS) for (const [part, hilite] of Object.entries(PARTS)) {
      expect(expectedSet(selectScrollbar({ hilite, orientation: 'horizontal' }, censuses[slug])), `${slug} ${part} rule`).toEqual(DRIVER_ROWS.D1.expected[slug][part]);
      expect(d1[slug][part].procedural, `${slug} ${part} procedural`).toBe(0);
    }
    expect(Object.fromEntries(D1_SLUGS.map(slug => [slug, Object.fromEntries(Object.entries(d1[slug]).map(([part, o]) => [part, o.present]))]))).toEqual(DRIVER_ROWS.D1.expected);
  });
}
