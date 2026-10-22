import { existsSync, readFileSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { readCicnIndexed } from '../../tools/theme-loader/decoders/cicn.js';
import { parseResourceMap } from './checkable-rules.mjs';
import { PUBLIC_ROWS, SAMPLE, SLUGS, classify, inSliderRange, layout, nativeFor, sliderCensus, sourceMap } from './slider-rules.mjs';

// The slider rule table (slider-rules.mjs, docs/spec/engine/slider.md) run
// against the public source and built composeSlider. Predictions are computed
// here in Node from each archive's own resource map and cicn masks. In the page
// every slider cicn (-10144..-10111) of the loaded theme is replaced by a
// same-size "source-map" sentinel: pixel (x, y) becomes rgb(64 + index, x, y),
// opaque where the decoded asset is opaque and transparent elsewhere. Each
// output pixel then names the cicn source pixel that reached it, so the test
// compares WHICH source pixel lands WHERE (selection, cell, placement,
// slicing, transfer); colour decoding is not asserted.
const corpus = {};
for (const slug of SLUGS) {
  const file = ['scheme.sit', 'scheme.rsrc'].find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)));
  const bytes = readFileSync(new URL(`../../themes/${slug}/${file}`, import.meta.url));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  const map = parseResourceMap(fork), census = sliderCensus(map), masks = new Map();
  for (const r of map.filter(r => r.type === 'cicn' && inSliderRange(r.id))) { const c = readCicnIndexed(r.data); masks.set(r.id, { w: c.pmap.width, a: c.maskAlpha }); }
  const mask = (id, x, y) => { const m = masks.get(id); return m.a[y * m.w + x] !== 0; };
  corpus[slug] = { census, masks, rows: PUBLIC_ROWS.map(row => { const l = layout(nativeFor(row), census); return { l, map: l.gate === 'system' ? null : sourceMap(l, mask) }; }) };
}

// Recorded disagreements with the decode (docs/spec/engine/slider.md §8; issue
// #407, linked from tests/rendering-requirements/families/slider.json). NOT
// expectations: the slider driver must shrink these lists. Classes are defined
// in slider-rules.mjs classify(). Rows are slug/orientation/state.
const G1 = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'beos-r503', 'crayon-os', 'dolphin-som', 'evolution', 'windows-31', 'windows-95'];
const ROWS = (slugs, specs) => slugs.flatMap(s => specs.map(x => `${s}/${x}`));
const BOTH = states => states.flatMap(x => [`h/${x}`, `v/${x}`]);
const ALL_STATES = BOTH(['normal', 'pressed', 'disabled', 'inactive']);
const CLASSES = {
  // S1 gate (G1/G2): floppies ships slider cicns but no slider cinf; the runtime draws it.
  S1: ROWS(['floppies'], ALL_STATES).sort(),
  // S2 cell map (TH3): disabled/inactive draw the ghost cell 3, not cell 0.
  S2: ROWS(G1, BOTH(['disabled', 'inactive'])).sort(),
  // S3 thumb transfer (BL1/TH4): srcCopy clears opaque track pixels under mask-clear thumb pixels
  // (rows where such an overlap exists at the sampled value; cell and position as the runtime draws them).
  S3: [...ROWS(['1138'], ALL_STATES), ...ROWS(['1990', 'dolphin-som', 'evolution'], [...BOTH(['disabled', 'inactive']), 'v/normal', 'v/pressed']),
    ...ROWS(['animals'], BOTH(['disabled', 'inactive']))].sort(),
  // S4 no erase (OS4/OS5): pixels of R the decode leaves as the O4 background are transparent (all G1 but
  // windows-31, whose track and thumb art covers the whole band opaquely).
  S4: ROWS(G1.filter(s => s !== 'windows-31'), ALL_STATES).sort(),
  // S5 thumb position (§5.2): no c inset, round instead of trunc, vertical minimum at the top. beos-r503 h
  // and windows-31 h coincide at value 25 (both formulas give 26).
  S5: ROWS(G1, ALL_STATES).filter(k => !['beos-r503/h/', 'windows-31/h/'].some(x => k.startsWith(x))).sort(),
  // S6 track middle (SL4/BL4): byte 2 = 0 with a middle wider than one source column is stretched, not drawn
  // as lines from the single column at k (windows-31 and windows-95 have a one-column middle, so they agree).
  S6: ROWS(['1984', 'animals', 'apple-lisa', 'beos-r503'], ALL_STATES).sort(),
};
const KNOWN = [...new Set(Object.values(CLASSES).flat())].sort();

for (const mode of ['source', 'built']) {
  test(`${mode}: public composeSlider draws what the 2.3.1 slider CDEF 3 draws, or a recorded disagreement`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'slider.selection-rules' });
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async ({ mode, slugs, rows, sample }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const out = {};
      for (const slug of slugs) {
        const theme = await api.loadTheme(`/themes/${slug}`);
        const tags = {}, alpha = {}; let k = 0;
        const swapped = new Map();
        for (const el of Object.values(theme.manifest.chromeElements)) {
          const id = el.sourceCicnId ?? 0;
          if (!(id >= -10144 && id <= -10111)) continue;
          if (!swapped.has(id)) {
            const bitmap = await createImageBitmap(await (await fetch(el.asset)).blob());
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height), tag = 64 + k++;
            alpha[id] = [];
            for (let y = 0; y < bitmap.height; y++) for (let x = 0; x < bitmap.width; x++) {
              const i = (y * bitmap.width + x) * 4, a = img.data[i + 3] ? 255 : 0;
              alpha[id].push(a ? 1 : 0);
              img.data[i] = tag; img.data[i + 1] = x; img.data[i + 2] = y; img.data[i + 3] = a;
            }
            ctx.clearRect(0, 0, bitmap.width, bitmap.height); ctx.putImageData(img, 0, 0);
            tags[tag] = id;
            swapped.set(id, URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' })));
          }
          el.asset = swapped.get(id);
        }
        out[slug] = { alpha, rows: [] };
        for (const { orientation, state } of rows) {
          const buffer = await api.composeSlider(theme, { orientation, state, ...sample });
          if (!buffer) { out[slug].rows.push({ isNull: true }); continue; }
          const map = []; let unknownPixels = 0;
          for (let y = 0; y < buffer.height; y++) {
            const line = [];
            for (let x = 0; x < buffer.width; x++) {
              const i = (y * buffer.width + x) * 4, d = buffer.data;
              if (!d[i + 3]) { line.push(null); continue; }
              const id = tags[d[i]];
              if (d[i + 3] !== 255 || id === undefined) { unknownPixels++; line.push({ id: 'unknown' }); continue; }
              line.push({ id, x: d[i + 1], y: d[i + 2] });
            }
            map.push(line);
          }
          out[slug].rows.push({ isNull: false, size: [buffer.width, buffer.height], map, unknownPixels });
        }
        theme.dispose?.();
      }
      return out;
    }, { mode, slugs: SLUGS, rows: PUBLIC_ROWS, sample: SAMPLE });

    expect(Object.keys(observed)).toEqual(SLUGS);
    // Input identity: the page's decoded alpha equals this file's cicn mask for every slider cicn.
    for (const slug of SLUGS) {
      expect(Object.keys(observed[slug].alpha).map(Number).sort((a, b) => a - b), slug).toEqual([...corpus[slug].masks.keys()].sort((a, b) => a - b));
      for (const [id, a] of Object.entries(observed[slug].alpha)) expect(a.join(''), `${slug} ${id} mask`).toEqual(Array.from(corpus[slug].masks.get(Number(id)).a, v => (v ? 1 : 0)).join(''));
    }
    const results = SLUGS.flatMap(slug => PUBLIC_ROWS.map((row, i) => {
      const { l, map } = corpus[slug].rows[i], obs = observed[slug].rows[i];
      return { slug, key: `${slug}/${row.orientation[0]}/${row.state}`, unknownPixels: obs.unknownPixels ?? 0, classes: classify(l, map, obs) };
    }));
    await attachObservations(info, 'slider-rules', mode, { mode, results });
    expect(results).toHaveLength(144);
    expect(results.filter(r => r.unknownPixels).map(r => r.key)).toEqual([]);
    expect(results.filter(r => r.classes.length).map(r => r.key).sort()).toEqual(KNOWN);
    const classes = {};
    for (const r of results) for (const c of r.classes) (classes[c] ??= []).push(r.key);
    for (const c of Object.keys(classes)) classes[c].sort();
    expect(classes).toEqual(CLASSES);
    // Agreement: the six archives without slider resources return null (the gate hands off; the procedural
    // Platinum slider is the declared substitute, spec §6 item 3), and windows-31 h normal/pressed, whose
    // opaque art and coinciding thumb offset leave no difference at the sample.
    const NONE = ['apple-platinum-2', 'black-platinum', 'monkey-paradise', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
    expect(results.filter(r => !r.classes.length).map(r => r.key).sort()).toEqual([...ROWS(NONE, ALL_STATES), 'windows-31/h/normal', 'windows-31/h/pressed'].sort());
    for (const slug of NONE) expect(observed[slug].rows.every(o => o.isNull), slug).toBe(true);
  });
}
