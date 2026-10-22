// Binds the spec-pinned D rows (scrollbar-geometry-rules.mjs DRIVER_ROWS) to
// the v2 scroll-bar engine driver, through its trace, on each archive's own
// fork. This file is the runtime binding, so unlike the rule modules it
// imports src/engine; the expected values come only from DRIVER_ROWS (spec §7
// values pinned against the spec model), never from the driver.
//
// The resource chain mirrors src/engine/resources/theme.ts (archive provider,
// lookup by structured signed id; cicn pixels + loader iconBlit depth and
// opaque companion; ppat; ics# census; ics8 only when the fork ships one) over
// the loader's raw (un-encoded) assets, because Node has no canvas to decode
// the blob PNGs the browser adapter reads. D1 (public pressedPart) is bound in
// range-rules.spec.mjs through composeScrollbar, source and built.
import '../helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import { DRIVER_ROWS, D8_POINTS } from './scrollbar-geometry-rules.mjs';

const E = await import('../../src/engine/index.ts');
const { SCROLLBAR_ICON_DRAW } = await import('../../src/engine/tables/scrollbar.ts');

const raw = new Map();
async function chainFor(slug, horizontal) {
  if (!raw.has(slug)) {
    const bytes = readFileSync(['scheme.sit', 'scheme.rsrc'].map(f => new URL(`../../themes/${slug}/${f}`, import.meta.url)).find(existsSync));
    raw.set(slug, await loadKaleidoscopeScheme(bytes, { encodeAssets: false, iconBlitCicnIds: E.scrollbarIconBlitCicnIds() }));
  }
  const t = raw.get(slug);
  const asset = path => { const a = t.assets.find(x => x.path === path || x.path.endsWith(`/${path}`)); return a && { width: a.width, height: a.height, data: new Uint8ClampedArray(a.rgba) }; };
  const elements = Object.values(t.manifest.chromeElements), patterns = Object.values(t.manifest.patterns ?? {});
  const entries = [];
  for (const { type, id } of E.scrollbarResourceIds(horizontal)) {
    if (type === 'cicn') {
      const el = elements.find(e => e.sourceCicnId === id && e.asset);
      if (el) entries.push([`cicn:${id}`, { pixmap: asset(el.asset), pixelSize: el.iconBlit?.pixelSize ?? null, unmasked: el.iconBlit?.unmaskedAsset ? asset(el.iconBlit.unmaskedAsset) : null }]);
    } else if (type === 'ppat') {
      const p = patterns.find(e => e.sourcePpatId === id && e.asset);
      if (p) entries.push([`ppat:${id}`, asset(p.asset)]);
    } else if (type === 'ics#') {
      if (t.iconMaskResources.some(m => m.id === id && m.byteLength >= SCROLLBAR_ICON_DRAW.maskRecordBytes)) entries.push([`ics#:${id}`, { id }]);
    } else if (type === 'ics8') {
      const icon = t.iconIndex.find(i => i.id === id && i.type === 'ics8');
      if (icon) entries.push([`ics8:${id}`, asset(icon.file)]);
    }
  }
  return new E.ResourceChain([E.mapProvider(slug, 'archive', entries)]);
}

const H = (left, top, w, h) => E.rect(top, left, top + h, left + w);
const port = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
const along = r => [r.left, r.right];
async function draw(slug, { rect = H(0, 0, 120, 16), hilite = 0, min = 0, max = 100, value = 50 } = {}) {
  const chain = await chainFor(slug, rect.right - rect.left > rect.bottom - rect.top);
  const trace = E.createTrace('scrollbar');
  const p = port(rect.right + 4, rect.bottom + 4);
  const { geometry } = E.drawScrollbar(p, chain, { rect, hilite, min, max, value }, trace);
  return { trace, geometry, port: p, chain };
}
/** Which cicn each composite arrow box was cut from, read from the trace's AC2 requests (AC3: the track cicn). */
function boxSources(trace, geometry) {
  const ac2 = trace.resolved.filter(r => r.type === 'cicn' && r.row === 'AC2');
  let k = 0;
  const first = trace.drawOps.filter((o, i, all) => o.op === 'arrow' && (o.arrow === 0 || o.arrow === 3) && all.findIndex(p => p.op === 'arrow' && p.arrow === o.arrow) === i);
  return Object.fromEntries(first.map(o => {
    if (!/AC2/.test(o.row)) return [o.arrow, geometry.trackId];
    const r = ac2[k++];
    return [o.arrow, r.found ? r.id : geometry.trackId];
  }));
}
/** §3 draw steps from the trace: arrow calls, a drawn thumb (TH7 slices), track segments. */
function steps(trace) {
  const out = [];
  for (const o of trace.drawOps) {
    let s = null;
    if (o.op === 'arrow' || o.op === 'arrowIcon') s = `arrow${o.arrow}`;
    else if ((o.op === 'slice' || o.op === 'sliceLines') && /TH7/.test(o.row)) s = 'thumb';
    else if (o.op === 'segment' && !/TF5/.test(o.row) && o.row !== 'offscreen') s = /TF2-low/.test(o.row) ? 'track-low' : /TF2-high/.test(o.row) ? 'track-high' : 'track-whole';
    if (s && out[out.length - 1] !== s) out.push(s);
  }
  return out;
}
const rgb = (pm, x, y) => [...pm.data.slice((y * pm.width + x) * 4, (y * pm.width + x) * 4 + 3)];

const BIND = {
  D2: async () => { const out = {}; for (const h of [0, 20, 21, 22, 23, 129]) { const { trace, geometry } = await draw('1138', { hilite: h }); out[h] = boxSources(trace, geometry); } return out; },
  D3: async () => [steps((await draw('1138')).trace), steps((await draw('1138', { hilite: 255 })).trace)],
  D4: async () => {
    const { trace } = await draw('1138');
    return { boxes: { 0: along(trace.rects.box0), 3: along(trace.rects.box3) }, T: along(trace.rects.T), Th: along(trace.rects.Th),
      segments: trace.drawOps.filter(o => o.op === 'segment' && o.row !== 'offscreen').map(o => along(o.dst)) };
  },
  D5: async () => {
    const { trace, geometry } = await draw('1990', { rect: H(0, 0, 120, 11) });
    const thumb = trace.resolved.filter(r => r.type === 'cicn' && r.found && /TH4/.test(r.row ?? '')).map(r => r.id).pop();
    const Th = along(trace.rects.Th);
    return { thumb, minLen: geometry.len, Th, cross: trace.rects.Th.bottom - trace.rects.Th.top,
      pieces: trace.drawOps.filter(o => (o.op === 'slice' || o.op === 'sliceLines') && /TH7/.test(o.row)).map(o => [[o.dst.left - Th[0], o.dst.right - Th[0]], along(o.src)]) };
  },
  D6: async () => {
    const R = H(13, 5, 120, 16), { port: p, chain, geometry } = await draw('crayon-os', { rect: R });
    const exp = DRIVER_ROWS.D6.expected, pat = chain.getResource('ppat', exp.track.id).value, cell = chain.getResource('cicn', exp.arrow.id).value.pixmap;
    const sameAs = (got, want) => JSON.stringify(got) === JSON.stringify(want);
    return { pattern: geometry.trackPattern ? exp.pattern : null,
      track: sameAs(rgb(p, 40, 9), rgb(pat, exp.track.u, exp.track.v)) ? exp.track : { got: rgb(p, 40, 9) },
      arrow: sameAs(rgb(p, 14, 9), rgb(cell, exp.arrow.x, exp.arrow.y)) ? exp.arrow : { got: rgb(p, 14, 9) } };
  },
  D8: async () => {
    const g = (await draw('1138')).geometry, d = (await draw('1138', { hilite: 255 })).geometry;
    return D8_POINTS.map(([x, y]) => E.scrollbarPartAt(g, { x, y }).part).concat(E.scrollbarPartAt(d, { x: 60, y: 8 }).part);
  },
  D10: async () => {
    // Port pre-filled with a sentinel so untouched pixels are visible; the trace must mark the cell unspecified.
    const rect = H(0, 0, 120, 16), chain = await chainFor('1138', true), trace = E.createTrace('scrollbar');
    const p = port(124, 20); for (let i = 0; i < p.data.length; i += 4) p.data.set([1, 2, 3, 255], i);
    E.drawScrollbar(p, chain, { rect, hilite: 20, min: 0, max: 0, value: 0 }, trace);
    const g = E.scrollbarGeometry(chain, { rect, hilite: 20, min: 0, max: 0, value: 0 }), src = boxSources(trace, g);
    return Object.fromEntries([0, 3].map(i => {
      const ops = trace.drawOps.filter(o => o.op === 'arrow' && o.arrow === i), cell = along(ops[0].src);
      const out = { id: src[i], cell };
      if (ops.some(o => o.unspecified)) {
        // Columns of the box left exactly as they were (every row still the sentinel).
        const cols = []; for (let x = g.boxes[i].left; x < g.boxes[i].right; x++) if ([...Array(16).keys()].every(y => rgb(p, x, y).join() === '1,2,3')) cols.push(x);
        out.outOfSource = cols.length ? [[cols[0], cols[cols.length - 1] + 1]] : [];
      }
      return [i, out];
    }));
  },
  D11: async () => {
    // Arrow indices that received a blit: composite arrows (AC4/AC5 ops carry dst) or icon-lane arrowIcon ops with dst.
    const out = {};
    for (const slug of ['1138', 'platinum-8']) {
      const { trace } = await draw(slug, { hilite: 254 });
      out[slug] = [...new Set(trace.drawOps.filter(o => (o.op === 'arrow' || o.op === 'arrowIcon') && o.dst).map(o => o.arrow))].sort();
    }
    return out;
  },
  D12: async () => {
    const { trace } = await draw('1984', { hilite: 254 });
    const segs = trace.drawOps.filter(o => o.op === 'segment' && o.row !== 'offscreen');
    // Track slices are drawn into the segment's offscreen, so their dst is segment-local; the one segment starts at T.left.
    const T = along(trace.rects.T), off = along(segs[0].dst)[0];
    return { T, source: [...new Set(trace.drawOps.filter(o => (o.op === 'slice' || o.op === 'sliceLines') && /TF8/.test(o.row)).map(o => o.src))].reduce((acc, r) => [Math.min(acc[0], r.left), Math.max(acc[1], r.right)], [Infinity, -Infinity]),
      segments: segs.map(o => along(o.dst)),
      pieces: trace.drawOps.filter(o => (o.op === 'slice' || o.op === 'sliceLines') && /TF8/.test(o.row)).map(o => [[o.dst.left + off, o.dst.right + off], along(o.src)]) };
  },
  D9: async () => {
    const out = {};
    for (const slug of ['animals', 'monkey-paradise']) {
      const { trace, geometry } = await draw(slug, { hilite: 20 }), src = boxSources(trace, geometry);
      out[slug] = Object.fromEntries([0, 3].map(i => [i, { id: src[i], cell: along(trace.drawOps.find(o => o.op === 'arrow' && o.arrow === i).src) }]));
    }
    return out;
  },
};

// Rows that stay pending, with the reason (expected values unchanged).
// D1 is bound in range-rules.spec.mjs (public composeScrollbar pressedPart, source and built).
const ELSEWHERE = ['D1'];
const PENDING = {
  D7: 'the driver has no atiPresent input and its trace records no offscreen flag: every segment goes through a temporary pixmap by construction, but nothing in the trace can show it, so the row cannot fail here',
};
// Rows where the driver disagrees with the spec value (recorded, not expected): row -> note.
// (D9 was recorded here against #395's first head; it agrees since 08d224b5 adopted #396.)
const DISAGREE = {};

assert.deepEqual(Object.keys(DRIVER_ROWS).sort(), [...Object.keys(BIND), ...ELSEWHERE, ...Object.keys(PENDING)].sort());
for (const [id, bind] of Object.entries(BIND)) {
  const row = DRIVER_ROWS[id];
  if (DISAGREE[id]) {
    test(`${id} ${row.title}: recorded disagreement`, async () => {
      // Pinned so a driver fix is noticed: the row must still differ; when it matches, move it out of DISAGREE.
      assert.notDeepEqual(await bind(), row.expected, `${id} now agrees; remove it from DISAGREE`);
    });
    test(`${id} ${row.title} — awaits driver fix (${DISAGREE[id]})`, { todo: DISAGREE[id] });
  } else {
    test(`${id} ${row.title}: driver equals the spec value`, async () => assert.deepEqual(await bind(), row.expected));
  }
}
for (const [id, note] of Object.entries(PENDING)) test(`${id} ${DRIVER_ROWS[id].title} — pending`, { todo: note });
