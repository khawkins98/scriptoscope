import { existsSync, readFileSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { readCicnIndexed } from '../../tools/theme-loader/decoders/cicn.js';
import { parseResourceMap } from './checkable-rules.mjs';
import { AWAITING_ROWS, PUBLIC_ROWS, SAMPLE, SLUGS, classify, inSliderRange, layout, nativeFor, sliderCensus, sourceMap } from './slider-rules.mjs';

// The slider rule table (slider-rules.mjs, docs/spec/engine/slider.md) run
// against the public source and built composeSlider. Predictions are computed
// here in Node from each archive's own resource map and cicn masks. In the page
// every slider cicn (-10144..-10111) of the loaded theme is replaced by a
// same-size "source-map" sentinel: pixel (x, y) becomes rgb(64 + index, x, y),
// opaque where the decoded asset is opaque and transparent elsewhere. Each
// output pixel then names the cicn source pixel that reached it, so the test
// compares WHICH source pixel lands WHERE (selection, cell, placement,
// slicing, transfer); colour decoding is not asserted.
// The 8 public state rows plus the 4 pressedPart rows (DECISIONS #9: pageUp 22 / pageDown 23 draw the pressed
// track with the normal thumb, slider-rules R31), bound now that composeSlider takes pressedPart (#416).
const ROWS_ALL = [...PUBLIC_ROWS, ...AWAITING_ROWS];
const keyOf = row => `${row.orientation[0]}/${row.pressedPart ?? row.state}`;
const corpus = {};
for (const slug of SLUGS) {
  const file = ['scheme.sit', 'scheme.rsrc'].find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)));
  const bytes = readFileSync(new URL(`../../themes/${slug}/${file}`, import.meta.url));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  const map = parseResourceMap(fork), census = sliderCensus(map), masks = new Map();
  for (const r of map.filter(r => r.type === 'cicn' && inSliderRange(r.id))) { const c = readCicnIndexed(r.data); masks.set(r.id, { w: c.pmap.width, a: c.maskAlpha }); }
  const mask = (id, x, y) => { const m = masks.get(id); return m.a[y * m.w + x] !== 0; };
  corpus[slug] = { census, masks, rows: ROWS_ALL.map(row => { const l = layout(nativeFor(row), census); return { l, map: l.gate === 'system' ? null : sourceMap(l, mask) }; }) };
}

// Disagreements with the decode (docs/spec/engine/slider.md §8). #407 pinned
// S1–S6 here against the pre-engine composer; the v2 slider driver (#416) is
// expected to agree on every row: S1 floppies hands off (G1/G2), S2 cell 0 for
// disabled/inactive (TH3), S3 masked thumb (BL1/TH4), S4 R erased to the
// background and copied opaque (OS4/OS5, BG5/BG6), S5 thumb at §5.2, S6
// one-column middles drawn as lines (SL4/BL4). Classes are defined in
// slider-rules.mjs classify(). Any row listed here must carry its reason.
const G1 = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'beos-r503', 'crayon-os', 'dolphin-som', 'evolution', 'windows-31', 'windows-95'];
const ROWS = (slugs, specs) => slugs.flatMap(s => specs.map(x => `${s}/${x}`));
const BOTH = states => states.flatMap(x => [`h/${x}`, `v/${x}`]);
const ALL_STATES = BOTH(['normal', 'pressed', 'disabled', 'inactive']);
const CLASSES = {};
const KNOWN = [...new Set(Object.values(CLASSES).flat())].sort();
// BG6 sentinel: the host-supplied erase colour. Its red channel (7) is below every source-map tag (64 + index),
// so a background pixel can never be read as art, nor art as background.
const BACKGROUND = { r: 7, g: 233, b: 19 };
// Archives whose sampled rows leave some pixel of R to the background (spec §6 "mask-clear track pixels"):
// every G1 archive but windows-31, whose track and thumb art covers the band opaquely and R = B (cross 16).
const WITH_BACKGROUND = G1.filter(s => s !== 'windows-31');

for (const mode of ['source', 'built']) {
  test(`${mode}: public composeSlider draws what the 2.3.1 slider CDEF 3 draws, or a recorded disagreement`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'slider.selection-rules' });
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async ({ mode, slugs, rows, sample, bg }) => {
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
        const isBg = (d, i) => d[i] === bg.r && d[i + 1] === bg.g && d[i + 2] === bg.b;
        for (const { orientation, state, pressedPart } of rows) {
          const part = pressedPart ? { pressedPart } : {};
          const buffer = await api.composeSlider(theme, { orientation, state, ...part, ...sample, background: bg });
          if (!buffer) { out[slug].rows.push({ isNull: true }); continue; }
          // BG6 default: the same draw with no background supplied. Every pixel the sentinel run left as the
          // background must be opaque white here, and every other pixel must be unchanged (the background is
          // an input, never derived from the art).
          const plain = await api.composeSlider(theme, { orientation, state, ...part, ...sample });
          const map = []; let unknownPixels = 0, transparentPixels = 0, translucentBackground = 0, defaultNotWhite = 0, defaultArtChanged = 0;
          for (let y = 0; y < buffer.height; y++) {
            const line = [];
            for (let x = 0; x < buffer.width; x++) {
              const i = (y * buffer.width + x) * 4, d = buffer.data, p = plain.data;
              if (!d[i + 3]) { transparentPixels++; line.push({ id: 'transparent' }); continue; }
              if (isBg(d, i)) {
                if (d[i + 3] !== 255) translucentBackground++;
                if (p[i] !== 255 || p[i + 1] !== 255 || p[i + 2] !== 255 || p[i + 3] !== 255) defaultNotWhite++;
                line.push(null); continue;
              }
              if (p[i] !== d[i] || p[i + 1] !== d[i + 1] || p[i + 2] !== d[i + 2] || p[i + 3] !== d[i + 3]) defaultArtChanged++;
              const id = tags[d[i]];
              if (d[i + 3] !== 255 || id === undefined) { unknownPixels++; line.push({ id: 'unknown' }); continue; }
              line.push({ id, x: d[i + 1], y: d[i + 2] });
            }
            map.push(line);
          }
          const sameSize = plain.width === buffer.width && plain.height === buffer.height;
          out[slug].rows.push({ isNull: false, size: [buffer.width, buffer.height], map, unknownPixels, transparentPixels, translucentBackground,
            defaultNotWhite: sameSize ? defaultNotWhite : -1, defaultArtChanged: sameSize ? defaultArtChanged : -1 });
        }
        theme.dispose?.();
      }
      return out;
    }, { mode, slugs: SLUGS, rows: ROWS_ALL, sample: SAMPLE, bg: BACKGROUND });

    expect(Object.keys(observed)).toEqual(SLUGS);
    // Input identity: the page's decoded alpha equals this file's cicn mask for every slider cicn.
    for (const slug of SLUGS) {
      expect(Object.keys(observed[slug].alpha).map(Number).sort((a, b) => a - b), slug).toEqual([...corpus[slug].masks.keys()].sort((a, b) => a - b));
      for (const [id, a] of Object.entries(observed[slug].alpha)) expect(a.join(''), `${slug} ${id} mask`).toEqual(Array.from(corpus[slug].masks.get(Number(id)).a, v => (v ? 1 : 0)).join(''));
    }
    const results = SLUGS.flatMap(slug => ROWS_ALL.map((row, i) => {
      const { l, map } = corpus[slug].rows[i], obs = observed[slug].rows[i];
      return { slug, key: `${slug}/${keyOf(row)}`, unknownPixels: obs.unknownPixels ?? 0, classes: classify(l, map, obs) };
    }));
    await attachObservations(info, 'slider-rules', mode, { mode, results });
    expect(results).toHaveLength(SLUGS.length * ROWS_ALL.length);   // 18 × 12 = 216
    const drawn = SLUGS.flatMap(slug => ROWS_ALL.map((row, i) => ({ key: `${slug}/${keyOf(row)}`, obs: observed[slug].rows[i], pred: corpus[slug].rows[i] })))
      .filter(r => !r.obs.isNull);
    // Every drawn pixel is named: a source-map art pixel or the sentinel background.
    expect(results.filter(r => r.unknownPixels).map(r => r.key)).toEqual([]);
    // BG5/OS5: R is erased and copied opaque, so no pixel of R is transparent and the background is fully opaque.
    expect(drawn.filter(r => r.obs.transparentPixels).map(r => r.key)).toEqual([]);
    expect(drawn.filter(r => r.obs.translucentBackground).map(r => r.key)).toEqual([]);
    // BG6: with no background supplied, exactly the sentinel's pixels are opaque white and the art is unchanged.
    expect(drawn.filter(r => r.obs.defaultNotWhite !== 0 || r.obs.defaultArtChanged !== 0).map(r => [r.key, r.obs.defaultNotWhite, r.obs.defaultArtChanged])).toEqual([]);
    // The BG checks are not vacuous: the decode leaves background pixels in these rows, and the page observed them there.
    const bgRows = rs => [...new Set(rs.map(r => r.key.split('/')[0]))].sort();
    expect(bgRows(drawn.filter(r => r.pred.map.flat().some(v => v === null)))).toEqual(WITH_BACKGROUND);
    expect(bgRows(drawn.filter(r => r.obs.map.flat().some(v => v === null)))).toEqual(WITH_BACKGROUND);
    expect(results.filter(r => r.classes.length).map(r => r.key).sort()).toEqual(KNOWN);
    const classes = {};
    for (const r of results) for (const c of r.classes) (classes[c] ??= []).push(r.key);
    for (const c of Object.keys(classes)) classes[c].sort();
    expect(classes).toEqual(CLASSES);
    // G2 hand-off (§4.1): the six archives without slider resources and floppies (slider cicns, no slider cinf)
    // return null; the procedural Platinum slider is the declared substitute (spec §6 item 3). The 11 G1 archives draw.
    const HANDED_OFF = ['apple-platinum-2', 'black-platinum', 'floppies', 'monkey-paradise', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
    for (const slug of SLUGS) expect(observed[slug].rows.every(o => o.isNull), slug).toBe(HANDED_OFF.includes(slug));
    for (const slug of SLUGS) expect(observed[slug].rows.some(o => o.isNull), slug).toBe(HANDED_OFF.includes(slug));
  });
}
