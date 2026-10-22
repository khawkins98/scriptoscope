import { existsSync, readFileSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { readCicnIndexed } from '../../tools/theme-loader/decoders/cicn.js';
import { realizeRgb16 } from '../../tools/theme-loader/display-profile.js';
import { parseResourceMap } from './checkable-rules.mjs';
import { DECODE, GATE4, PROCEDURAL, PUBLIC_ROWS, SLUGS, inProgressRange, layout, nativeFor, progressCensus, sourceMap } from './progress-rules.mjs';

// The progress rule table (progress-rules.mjs, docs/spec/engine/progress.md)
// run against the public source and built composeProgressFrame on all 18
// archives. Predictions are computed here in Node from each archive's own
// resource map and cicn masks. In the page every progress cicn (-10080..-10064,
// -10224, -10223) and ppat (-10080..-10064) of the loaded theme is replaced by a
// same-size "source-map" sentinel: pixel (x, y) becomes rgb(tag, x, y), opaque
// where the decoded asset is opaque. Each output pixel then names the source
// pixel that reached it, so the test compares WHICH source pixel lands WHERE
// (gate, state, inset, split, slicing, tiling, pattern phase, FB sample points,
// transfer and erase). The sentinel is also the spec's synthetic -10224 whose
// (11, 11) and (11, 13) differ (§7 FB1). The fixed FB7 colours (COL3) are
// compared after the default display policy (COL4). Art colour is not asserted.

const corpus = {};
for (const slug of SLUGS) {
  const file = ['scheme.sit', 'scheme.rsrc'].find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)));
  const bytes = readFileSync(new URL(`../../themes/${slug}/${file}`, import.meta.url));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  const map = parseResourceMap(fork), census = progressCensus(map), masks = new Map();
  for (const r of map.filter(r => r.type === 'cicn' && inProgressRange(r.id))) { const c = readCicnIndexed(r.data); masks.set(r.id, { w: c.pmap.width, a: c.maskAlpha }); }
  const mask = (id, x, y) => { const m = masks.get(id); return m.a[y * m.w + x] !== 0; };
  corpus[slug] = { census, masks, rows: PUBLIC_ROWS.map(row => { const l = layout(nativeFor(row), census); return { l, map: sourceMap(l, mask, census) }; }) };
}
const COL = { dark: realizeRgb16(DECODE.col3.dark), lavender: realizeRgb16(DECODE.col3.lavender) };
const opts = ({ state, length, range, value, indeterminate, phase }) => ({ length, ...(state ? { state } : {}), ...(range ? { range } : {}), ...(value !== undefined ? { value } : {}),
  ...(indeterminate ? { indeterminate, phase } : {}) });

// Recorded disagreements with the decode, by row key: none. Any entry must carry its reason.
const DISAGREEMENTS = {};

for (const mode of ['source', 'built']) {
  test(`${mode}: public composeProgressFrame draws what the 2.3.1 progress CDEF 5 draws on all 18 archives`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'progress.rules' });
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async ({ mode, slugs, rows }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const inRange = id => (id >= -10080 && id <= -10064) || id === -10224 || id === -10223;
      const b64 = d => { let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000)); return btoa(s); };
      const out = {};
      for (const slug of slugs) {
        const theme = await api.loadTheme(`/themes/${slug}`);
        const tags = {}, alpha = {}; let k = 0;
        const swap = async (holder, key, type, base) => {
          const done = new Map();
          for (const el of Object.values(holder ?? {})) {
            const id = el[key];
            if (typeof id !== 'number' || !inRange(id) || (type === 'ppat' && id === -10224)) continue;
            if (!done.has(id)) {
              const bitmap = await createImageBitmap(await (await fetch(el.asset)).blob());
              const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
              ctx.drawImage(bitmap, 0, 0);
              const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height), tag = base + k++;
              const a = [];
              for (let y = 0; y < bitmap.height; y++) for (let x = 0; x < bitmap.width; x++) {
                const i = (y * bitmap.width + x) * 4, on = img.data[i + 3] ? 255 : 0;
                a.push(on ? 1 : 0); img.data[i] = tag; img.data[i + 1] = x; img.data[i + 2] = y; img.data[i + 3] = on;
              }
              if (type === 'cicn') alpha[id] = a.join('');
              ctx.clearRect(0, 0, bitmap.width, bitmap.height); ctx.putImageData(img, 0, 0);
              tags[tag] = [type, id, bitmap.width, bitmap.height];
              done.set(id, URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' })));
            }
            el.asset = done.get(id);
          }
        };
        await swap(theme.manifest.chromeElements, 'sourceCicnId', 'cicn', 64);
        k = 0; await swap(theme.manifest.patterns, 'sourcePpatId', 'ppat', 160);
        const res = [];
        for (const row of rows) {
          const f = await api.composeProgressFrame(theme, { ...row.opts, trace: true });
          const split = f.trace.drawOps.find(o => o.op === 'split');
          res.push({ key: row.key, w: f.buffer.width, h: f.buffer.height, data: b64(f.buffer.data), phase: f.phase, path: f.path,
            I: f.trace.rects.I ?? null, If: f.trace.rects.I_f ?? null, x: split ? split.x : null });
        }
        out[slug] = { tags, alpha, displayProfile: theme.manifest.displayProfile ?? null, rows: res };
        theme.dispose?.();
      }
      return out;
    }, { mode, slugs: SLUGS, rows: PUBLIC_ROWS.map(r => ({ key: r.key, opts: opts(r) })) });

    expect(Object.keys(observed)).toEqual(SLUGS);
    for (const slug of SLUGS) {
      // Input identity: the page's decoded alpha equals this file's cicn mask for every progress cicn.
      expect(Object.keys(observed[slug].alpha).map(Number).sort((a, b) => a - b), slug).toEqual([...corpus[slug].masks.keys()].sort((a, b) => a - b));
      for (const [id, a] of Object.entries(observed[slug].alpha)) expect(a, `${slug} ${id} mask`).toEqual(Array.from(corpus[slug].masks.get(Number(id)).a, v => (v ? 1 : 0)).join(''));
      // Sentinel sizes equal the archive's own cicn bounds and ppat bounds.
      for (const [type, id, w, h] of Object.values(observed[slug].tags)) {
        const c = corpus[slug].census, b = type === 'cicn' ? c.cicn.get(id) : c.ppat.get(id);
        expect(type === 'cicn' ? [b.right - b.left, b.bottom - b.top] : [b.width, b.height], `${slug} ${type} ${id} size`).toEqual([w, h]);
      }
      expect(observed[slug].displayProfile, `${slug}: COL4 expectations use the default display policy`).toBeNull();
    }
    const decode = (slug, o) => {
      const d = Buffer.from(o.data, 'base64'), tags = observed[slug].tags, map = [];
      for (let y = 0; y < o.h; y++) {
        const line = [];
        for (let x = 0; x < o.w; x++) {
          const i = (y * o.w + x) * 4, [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
          if (a === 0) { line.push(null); continue; }
          if (a !== 255) { line.push({ unknown: [r, g, b, a] }); continue; }
          const rgb = Object.entries(COL).find(([, c]) => c[0] === r && c[1] === g && c[2] === b)?.[0] ?? (r === 0 && g === 0 && b === 0 ? 'black' : null);
          if (rgb) { line.push({ rgb }); continue; }
          const t = tags[r];
          line.push(t ? { t: t[0], id: t[1], x: g, y: b } : { unknown: [r, g, b, a] });
        }
        map.push(line);
      }
      return map;
    };
    const results = SLUGS.flatMap(slug => PUBLIC_ROWS.map((row, i) => {
      const { l, map: pred } = corpus[slug].rows[i], o = observed[slug].rows[i], key = `${slug}/${row.key}`;
      const obs = decode(slug, o), diffs = [];
      if (o.w !== pred[0].length || o.h !== pred.length) diffs.push(`size ${o.w}x${o.h}`);
      else for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (JSON.stringify(obs[y][x]) !== JSON.stringify(pred[y][x])) diffs.push(`(${x},${y}) ${JSON.stringify(obs[y][x])} != ${JSON.stringify(pred[y][x])}`);
      const facts = { path: o.path, phase: o.phase, I: l.path === 'kaleidoscope' ? o.I : o.If, x: o.x };
      const want = { path: l.path, phase: l.phaseAfter, I: l.path === 'kaleidoscope' ? l.I : l.procedural.If, x: l.indeterminate ? null : l.path === 'kaleidoscope' ? l.x : l.procedural.xf };
      if (JSON.stringify(facts) !== JSON.stringify(want)) diffs.unshift(`facts ${JSON.stringify(facts)} != ${JSON.stringify(want)}`);
      return { key, diffs: diffs.length, first: diffs.slice(0, 4), unknown: obs.flat().filter(v => v && v.unknown).length };
    }));
    await attachObservations(info, 'progress-rules', mode, { mode, results: results.map(({ key, diffs, first }) => ({ key, diffs, first })) });
    expect(results).toHaveLength(SLUGS.length * PUBLIC_ROWS.length);   // 18 × 20 = 360
    // Every drawn pixel is named: a sentinel source pixel, a COL3 colour, the black FrameRect or transparent.
    expect(results.filter(r => r.unknown).map(r => r.key)).toEqual([]);
    expect(Object.fromEntries(results.filter(r => r.diffs).map(r => [r.key, r.first]))).toEqual(DISAGREEMENTS);
    // The gate (§4.3): the 10 GATE4 archives draw the art on every row, the 8 GATE2 archives the procedural bar.
    for (const slug of SLUGS) expect([...new Set(observed[slug].rows.map(o => o.path))], slug).toEqual([GATE4.includes(slug) ? 'kaleidoscope' : 'procedural']);
    // Non-vacuity: transparent pixels the decode leaves (ERASE2) occur and were observed; FB lines carry the
    // (11, 13) sample; trunc and DET3 splits are exercised; the phase is written back in frame mode only.
    const fact = (slug, key) => observed[slug].rows[PUBLIC_ROWS.findIndex(r => r.key === key)];
    // The 8 procedural bars leave (0, 13) and (R.right - 1, 0); 1990 / dolphin-som / evolution leave I (IND6); windows-95 inactive (s = 1) leaves columns 1 and 98.
    const WITH_TRANSPARENT = SLUGS.filter(s => PROCEDURAL.includes(s) || ['1990', 'dolphin-som', 'evolution', 'windows-95'].includes(s));
    expect(SLUGS.filter(slug => corpus[slug].rows.some(r => r.map.flat().some(v => v === null)))).toEqual(WITH_TRANSPARENT);
    expect(SLUGS.filter(slug => observed[slug].rows.some(o => Buffer.from(o.data, 'base64').some((v, i) => i % 4 === 3 && v === 0)))).toEqual(WITH_TRANSPARENT);
    expect(GATE4.map(slug => [fact(slug, 'normal/40/3of10').x, fact(slug, 'normal/100/-10of100').x, fact(slug, 'normal/100/150of100').x, fact(slug, 'normal/104/v0.57').x, fact(slug, 'normal/100/5of5..5').x]))
      .toEqual(GATE4.map(() => [12, -7, 146, 58, 2]));
    expect(['1138', '1984', 'floppies', 'windows-31', 'windows-95'].map(slug => fact(slug, 'normal/ind/phase4').phase)).toEqual([0, 4, 0, 0, 0]);
    expect(['1138', 'crayon-os', 'apple-lisa', '1990', 'platinum-8'].map(slug => fact(slug, 'normal/ind/phase9').phase)).toEqual([0, 9, 9, 9, 9]);
    for (const slug of PROCEDURAL) expect(decode(slug, fact(slug, 'normal/100/50of100'))[13][1], slug).toEqual({ t: 'cicn', id: -10224, x: 11, y: 13 });
  });

  test(`${mode}: DECISIONS #10/#11 public progress API (range guards, phase report, ProgressIdle)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const r = await page.evaluate(async ({ mode }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const theme = await api.loadTheme('/themes/1138');
      const err = async o => { try { await api.composeProgressFrame(theme, o); return 'ok'; } catch (e) { return e.constructor.name; } };
      const errors = [await err({ value: 0.5, range: { value: 1, min: 0, max: 2 } }), await err({ range: { value: 1.5, min: 0, max: 2 } }), await err({ range: { value: 40000, min: 0, max: 2 } }),
        await err({ range: { value: 0, min: -32769, max: 2 } }), await err({ indeterminate: true, phase: 256 }), await err({ indeterminate: true, phase: -1 }), await err({ range: { value: -32768, min: -32768, max: 32767 } })];
      const same = async o => { const a = await api.composeProgress(theme, o), b = (await api.composeProgressFrame(theme, o)).buffer; return a.width === b.width && a.height === b.height && a.data.every((v, i) => v === b.data[i]); };
      const idle = new api.ProgressIdle({ indeterminate: true });
      const steps = [idle.phase, idle.idle(2), idle.phase, idle.idle(3), idle.phase, idle.idle(5), idle.idle(6), idle.idle(9), idle.idle(12), idle.phase];
      await idle.compose(theme, { length: 100 });
      steps.push(idle.phase);                                    // 1138 has 4 frames: phase 4 is written back as 0 (IND2)
      const det = new api.ProgressIdle({ indeterminate: false });
      steps.push(det.idle(100), det.phase);
      return { errors, same: [await same({ length: 120, range: { value: 3, min: 0, max: 10 } }), await same({ length: 120, indeterminate: true, phase: 2 })], steps };
    }, { mode });
    expect(r.errors).toEqual(['TypeError', 'RangeError', 'RangeError', 'RangeError', 'RangeError', 'RangeError', 'ok']);
    expect(r.same).toEqual([true, true]);
    expect(r.steps).toEqual([0, false, 0, true, 1, false, true, true, true, 4, 0, false, 0]);
  });
}
