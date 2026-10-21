import { existsSync, readFileSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { parseResourceMap } from './checkable-rules.mjs';
import { PUBLIC_ROWS, SAMPLE, SLUGS, checkRow, classify, nativeFor, scrollCensus, selectScrollbar } from './range-rules.mjs';

// The scroll-bar rule table of range-rules.test.mjs, run against the public
// source and built composeScrollbar. Expectations are computed here in Node from
// each archive's own resource map. In the page every candidate cicn and arrow
// icon of the loaded theme is replaced by a solid sentinel raster of the same
// size, so the output reports WHICH resources were drawn (selection only; art
// decoding and geometry are not asserted).
const predictions = {};
for (const slug of SLUGS) {
  const file = ['scheme.sit', 'scheme.rsrc'].find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)));
  const bytes = readFileSync(new URL(`../../themes/${slug}/${file}`, import.meta.url));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  const census = scrollCensus(parseResourceMap(fork));
  predictions[slug] = PUBLIC_ROWS.map(row => nativeFor(row).map(native => ({ native, prediction: selectScrollbar(native, census) })));
}

// Recorded disagreements with the decode (docs/spec/range-controls.md
// "Demonstrated disagreements"). NOT expectations: a runtime fix must shrink
// this list. R1 pressed/inactive track tier; R2 thumb drawn when disabled or
// inactive; R3 icon-lane arrows for disabled/inactive/pressed; R4 composite
// discriminator; R5 non-hit arrow boxes of a pressed composite track.
const ROWS = (slugs, specs) => slugs.flatMap(s => specs.map(x => `${s}/${x}`));
const ICON = ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
const KNOWN = ROWS(SLUGS, ['h/pressed', 'h/disabled', 'h/inactive', 'v/pressed', 'v/disabled', 'v/inactive'])
  .concat(ROWS(['crayon-os', 'windows-95'], ['h/normal', 'v/normal'])).sort();
const COMPOSITE = SLUGS.filter(slug => !ICON.includes(slug));
const BOTH = states => states.flatMap(x => [`h/${x}`, `v/${x}`]);
// Per class, the exact rows (pinned corpus property of the current runtime):
//   R1 every archive, pressed and inactive; R2 every archive, disabled and
//   inactive; R3 the five icon-lane archives, disabled/inactive/pressed;
//   R4 crayon-os/windows-95 all rows (31px tracks drawn as square cells) plus the
//   pressed rows where R1 picks a 5px/20px track (1138, 1990, dolphin-som,
//   evolution); R5 the 13 composite-track archives, pressed.
const CLASSES = {
  R1: ROWS(SLUGS, BOTH(['pressed', 'inactive'])).sort(),
  R2: ROWS(SLUGS, BOTH(['disabled', 'inactive'])).sort(),
  R3: ROWS(ICON, BOTH(['pressed', 'disabled', 'inactive'])).sort(),
  R4: ROWS(['1138', '1990', 'dolphin-som', 'evolution'], BOTH(['pressed'])).concat(ROWS(['crayon-os', 'windows-95'], BOTH(['normal', 'pressed', 'disabled', 'inactive']))).sort(),
  R5: ROWS(COMPOSITE, BOTH(['pressed'])).sort(),
};

for (const mode of ['source', 'built']) {
  test(`${mode}: public composeScrollbar selects the resources the 2.3.1 scroll-bar CDEF selects, or a recorded disagreement`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'scrollbar.selection-rules' });
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async ({ mode, slugs, rows, sample }) => {
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
        for (const { orientation, state } of rows) {
          const buffer = await api.composeScrollbar(theme, { orientation, state, ...sample });
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
    }, { mode, slugs: SLUGS, rows: PUBLIC_ROWS, sample: SAMPLE });

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
    for (const r of agreeing) expect(r.row.state, r.key).toBe('normal');
    expect(agreeing.filter(r => ICON.includes(r.slug))).toHaveLength(10);
  });
}
