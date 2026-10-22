import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { readCicnIndexed } from '../../tools/theme-loader/decoders/cicn.js';
import { makeKdefColorSampler } from '../../tools/theme-loader/kdef-color-samples.js';
import { parseResourceMap } from './checkable-rules.mjs';
import {
  SCHEMES, DECODE, STANDARD, PIXEL_PROBES, DRIVER_ROWS, HIT_POINTS, decodeVariation, titleHeight, alertColouring, growOwned, geometry, regions,
  selectArt, titleMode, documentFrameOps, titleOps, dialogRingOps, textPasses, titleBaseline, hitTest,
  toggleRun, ctEntry, ctEqual, copyPixel, kind5GrowOps, UDECODE, utilityInputs, utilityGeometry, utilityFrameOps, utilityFrameArt,
  utilityStripes, utilityTitleRect, utilityTitleOps, utilityDrawOrder, utilityWidgets, utilityGrowArt, utilityMessage6, utilityHit,
  UTILITY_TYPES, UTILITY_EXCLUDED, utilityPlan,
} from './procedural-frame-rules.mjs';

// Rule rows of docs/spec/engine/procedural-frame.md (§3–§6, test hooks §12).
// Every expected literal is the spec's own number, a value derived by hand
// from a spec formula (the arithmetic is written next to it), or an archive
// fact read from the archive's own resource fork (cicn clut entries, ics#
// masks, resource presence). Nothing here reads runtime output. Rows that need
// the engine driver are DRIVER_ROWS at the end: todo tests marked "awaits
// procedural-frame driver", their expected values pinned to the model now.

const corpus = new Map();
for (const slug of SCHEMES) {
  const bytes = readFileSync(['scheme.sit', 'scheme.rsrc'].map(f => new URL(`../../themes/${slug}/${f}`, import.meta.url)).find(existsSync));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  corpus.set(slug, parseResourceMap(fork));
}
const res = (slug, type, id) => corpus.get(slug).find(r => r.type === type && r.id === id);
const has = slug => (type, id) => !!res(slug, type, id);
const cicns = new Map();
const cicn = (slug, id) => { const k = `${slug}/${id}`; if (!cicns.has(k)) cicns.set(k, readCicnIndexed(res(slug, 'cicn', id).data)); return cicns.get(k); };
const hex = rgb => rgb.map(v => v.toString(16).padStart(4, '0')).join('');
/** P(x, y): the cicn pixel's colour from its own colour table (§3.5 "Sampling"), RGB16 hex. */
const P = (slug, id, [x, y]) => {
  const c = cicn(slug, id), index = c.indices[y * c.pmap.width + x];
  const e = c.colorTable.entries.find(en => en.value === index) ?? c.colorTable.entries[index];
  return hex([e.r, e.g, e.b]);
};
/** ics# mask bit (bytes 32..63, 2 bytes per row), icon-relative. */
const mask = slug => (id, x, y) => { const d = res(slug, 'ics#', id)?.data; return !!d && x >= 0 && x < 16 && y >= 0 && y < 16 && !!(d[32 + y * 2 + (x >> 3)] & (0x80 >> (x & 7))); };

const STATES = { active: true, inactive: false };
const perScheme = fn => Object.fromEntries(SCHEMES.map(slug => [slug, fn(slug)]));
const perState = fn => Object.fromEntries(Object.entries(STATES).map(([name, hl]) => [name, fn(hl)]));
const win = over => ({ ...STANDARD, ...over });
const geo = (over, r) => geometry(win(over), { reading: r });
const H22 = { ascent: 12, descent: 3 };   // Chicago 12 (§3.2)

/** Named rule rows: id -> (reading) => observed value. EXPECTED pins each under the decode. */
const ROWS = {
  // ---- resource selection (§3.5, §6.1, §5.2, §6.4)
  'S1 §3.5 document frame cicn by state (kinds 0, 4)': r => perScheme(slug => [8, 12].map(variation => perState(hl => selectArt(win({ variation, hilited: hl }), has(slug), { reading: r }).frame))),
  'S2 §3.5 dialog frame cicn (kinds 1, 5; alert × state)': r => perScheme(slug => [1, 5].map(variation => Object.fromEntries([true, false].map(alert =>
    [alert ? 'alert' : 'plain', perState(hl => selectArt(win({ variation, hilited: hl }), has(slug), { reading: r, alert }).frame)])))),
  'S3 §3.5/§6.1 widget glyphs, normal state (standard, active)': r => perScheme(slug => selectArt(win({ hilited: true }), has(slug), { reading: r }).widgets),
  'S4 §3.5/§5.2 stripe layers (active; document, kind 5 plain, kind 5 alert)': r => perScheme(slug => ({
    document: selectArt(win({ hilited: true }), has(slug), { reading: r }).stripes,
    plain: selectArt(win({ variation: 5, hilited: true }), has(slug), { reading: r }).stripes,
    alert: selectArt(win({ variation: 5, hilited: true }), has(slug), { reading: r, alert: true }).stripes })),
  'S5 §3.5/§6.4 grow art (kind 0 and kind 5, by state)': r => perScheme(slug => [8, 85].map(variation => perState(hl => selectArt(win({ variation, hilited: hl }), has(slug), { reading: r }).grow))),
  // ---- geometry (§3.2, §3.3, §3.4)
  'G1 §3.2 title height and adjusted ascent': r => [[12, 3], [10, 2], [13, 3], [14, 4], [15, 4], [16, 4]].map(([ascent, descent]) => titleHeight({ ascent, descent }, { reading: r })),
  'G2 §3.3 structure region by kind': r => Object.fromEntries([['documentProc', { variation: 8 }], ['noGrowDocProc', { variation: 12 }], ['dBoxProc', { variation: 1 }],
    ['dBoxProc thin', { variation: 17 }], ['plainDBox', { variation: 2 }], ['altDBoxProc', { variation: 3 }], ['movableDBoxProc', { variation: 5 }],
    ['movableDBoxProc thin', { variation: 21 }], ['documentProc collapsed', { variation: 8, collapsed: true }]].map(([name, over]) => [name, geo(over, r).structure])),
  'G3 §12 structure size = content + 12 + 1 by content + H + 6 + 1 (kind 0)': r => { const g = geo({}, r), s = g.structure;
    const w = Math.max(...s.map(x => x[2])) - Math.min(...s.map(x => x[0])), h = Math.max(...s.map(x => x[3])) - Math.min(...s.map(x => x[1])); return [w, h]; },
  'G4 §3.3 named rects (standard)': r => { const g = geo({}, r); return { T: g.T, wy: g.wy, close: g.close, zoom: g.zoom, collapse: g.collapse, grow: g.grow, L: g.L, R: g.R }; },
  'G5 §3.3 kind-5 title bar and grow (not thin, thin)': r => [5, 21].map(variation => { const g = geo({ variation }, r); return { T: g.T, grow: g.grow, wy: g.wy }; }),
  'G6 §3.3 widget presence by title width': r => [[41, 8], [40, 8], [25, 8], [24, 8], [25, 0], [24, 0]].map(([cw, variation]) => {
    const g = geo({ variation, C: [100, 60, 100 + cw, 200] }, r); return [g.T[2] - g.T[0], g.shown]; }),
  'G7 §3.3 title text rect and limits': r => [[60, true, 8], [190, true, 8], [60, false, 0], [60, true, 0]].map(([titleWidth, goAway, variation]) => {
    const g = geo({ titleWidth, goAway, variation }, r); return { L: g.L, R: g.R, text: g.titleText }; }),
  'G8 §5.2 stripe rows and segments': r => [0, 60, 148, 150].map(titleWidth => geo({ titleWidth }, r).stripes),
  'G9 §3.4 message-8 regions (standard, title width 60)': r => regions(geo({ titleWidth: 60 }, r)),
  'G10 §3.1 variation flags and get-features': r => [0, 8, 4, 1, 2, 3, 5, 65, 17, 49].map(v => { const d = decodeVariation(v, { reading: r }); return [v, d.kind, d.features]; }),
  'G11 §6.4 grow box belongs to the frame; content minus grow': r => [[8, true], [8, false], [64 | 1 | 16, false], [1, false], [5, true], [12, true]].map(([variation, growFlag]) => {
    const g = geo({ variation, growFlag }, r); return [g.growOwned, g.contentMinusGrow]; }),
  'G12 §4 document frame draw list (standard)': r => documentFrameOps(geo({}, r), { reading: r }),
  'G13 §5 title draw list, joined (standard) and box (kind 5)': r => [titleOps(geo({}, r), 'joined', { reading: r }), titleOps(geo({ variation: 5 }, r), 'box', { reading: r })],
  'G14 §5A dialog ring (kind 1; thin)': r => [1, 17].map(variation => dialogRingOps(geo({ variation }, r), { reading: r })),
  'G15 §5.1 title baseline (Chicago 12; a 10/2 font raised to H 22)': r => { const g = geo({ titleWidth: 60 }, r);
    return [H22, { ascent: 10, descent: 2 }].map(m => titleBaseline(g.titleText, m, { reading: r })); },
  // ---- sampled colours (§5 row 1, §5.1, §4, §5A)
  'C1 §5 row 1 sampled fill, text, shadow (document)': r => perScheme(slug => perState(hl => {
    const id = selectArt(win({ hilited: hl }), has(slug), { reading: r }).frame, s = rd(r).samples;
    return { fill: P(slug, id, s.fill), text: P(slug, id, s.text), shadow: P(slug, id, s.shadow) }; })),
  'C2 §5.1 title text passes (shadow pass at +1/+1 only when shadow ≠ text)': r => perScheme(slug => perState(hl => {
    const id = selectArt(win({ hilited: hl }), has(slug), { reading: r }).frame, s = rd(r).samples;
    return textPasses({ fill: P(slug, id, s.fill), text: P(slug, id, s.text), shadow: P(slug, id, s.shadow) }, [120, 55], { reading: r }).map(p => [p.at, p.colour]); })),
  'C3 §4 row 6 drop-shadow colour P(0, 0)': r => perScheme(slug => perState(hl => {
    const id = selectArt(win({ hilited: hl }), has(slug), { reading: r }).frame; return [...new Set(documentFrameOps(geo({}, r), { reading: r }).filter(o => o[0] === 'line').slice(-2).map(o => P(slug, id, o[2])))]; })),
  'C4 §4 rows 3–5 band colours, outer → inner (left, right, bottom)': r => perScheme(slug => perState(hl => {
    const id = selectArt(win({ hilited: hl }), has(slug), { reading: r }).frame, ops = documentFrameOps(geo({}, r), { reading: r }).filter(o => o[0] === 'line').slice(0, 18);
    return { bottom: ops.slice(0, 6).map(o => P(slug, id, o[2])).join(' '), left: ops.slice(6, 12).map(o => P(slug, id, o[2])).join(' '), right: ops.slice(12, 18).map(o => P(slug, id, o[2])).join(' ') }; })),
  'C5 §5A ring line colours (kind 1 plain, outer → inner)': r => perScheme(slug => perState(hl => {
    const id = selectArt(win({ variation: 1, hilited: hl }), has(slug), { reading: r }).frame;
    return dialogRingOps(geo({ variation: 1 }, r), { reading: r }).filter(o => o[0] === 'line').slice(2).map(o => P(slug, id, o[2])).join(' '); })),
  'C6 §5.1 synthetic: shadow = text draws one pass; shadow = fill still draws two': r => [
    textPasses({ fill: 'f', text: 't', shadow: 't' }, [0, 0], { reading: r }).length, textPasses({ fill: 'f', text: 't', shadow: 'f' }, [0, 0], { reading: r }).length],
  // ---- state gating (§5 rows 11–12)
  'H1 §5 rows 11–12 widgets and stripes only when hilited (standard)': r => perScheme(slug => perState(hl => {
    const a = selectArt(win({ hilited: hl }), has(slug), { reading: r }); return { widgets: a.widgets.length, stripes: a.stripes.length }; })),
  // ---- hit test (§6.3)
  'T1 §6.3 hit codes (standard, active)': r => perScheme(slug => HIT_POINTS.map(p => hitTest(geo({}, r), win({ hilited: true }), p, mask(slug), { reading: r }))),
  'T2 §6.3 hit codes (standard, inactive)': r => perScheme(slug => HIT_POINTS.map(p => hitTest(geo({}, r), win({ hilited: false }), p, mask(slug), { reading: r }))),
  'T3 §6.3 zoom part: 5 at the stored zoom rect, else 6; kind-5 title (+1 row)': r => [
    hitTest(geo({}, r), win({ hilited: true }), [279, 48], mask('platinum-8'), { reading: r, atZoomRect: true }),
    hitTest(geo({ variation: 5 }, r), win({ variation: 5, hilited: true }), [200, 55], mask('platinum-8'), { reading: r }),
    hitTest(geo({ variation: 5 }, r), win({ variation: 5, hilited: true }), [200, 56], mask('platinum-8'), { reading: r })],
  // ---- title mode (§5 table, Gestalt WdrB)
  'M1 §5 title mode table (kind × collapsed × WdrB × gap)': r => [
    { kind: 5, collapsed: false, wdrb: false }, { kind: 0, collapsed: false, wdrb: false }, { kind: 4, collapsed: false, wdrb: true, gap: 0 },
    { kind: 0, collapsed: true, wdrb: false, gap: 22 }, { kind: 0, collapsed: true, wdrb: true, gap: 22 }, { kind: 4, collapsed: true, wdrb: true, gap: 27 },
    { kind: 5, collapsed: true, wdrb: true, gap: 27 }].map(input => titleMode({ H: 22, ...input }, { reading: r })),
};
const rd = r => ({ ...DECODE, ...r });

// Standard window (§3.3 worked by hand): C = (100, 60, 300, 200), H = 22.
// T = (94, 38, 306, 60); wy = 38 + trunc(10 / 2) − 1 = 42; close (98, 42, 114, 58);
// collapse (289, …, 305); zoom (273, …, 289); grow (285, 185, 302, 202);
// structure (94, 38, 306, 206) ∪ (96, 40, 307, 207).
// HIT_POINTS (module), in order:
//   [93, 100],   // outside → 0
//   [306, 38],   // structure bounding-box corner, outside both rects → 0
//   [306, 40],   // drop-shadow pixel: in the structure, not content, not the band, not T → 1
//   [200, 100],  // content → 1
//   [290, 190],  // grow (also content) → 3 / 1
//   [301, 201],  // grow rect beyond the content (in the band) → 3 / 1
//   [97, 100],   // left band → 2
//   [200, 203],  // bottom band → 2
//   [200, 50],   // title bar between the widgets → 2
//   [110, 50],   // the close probe point (T.l + 16, T.t + 12) → 4
//   [104, 48],   // close icon, rel (6, 6) → 4 where the mask is set
//   [113, 57],   // close rect, rel (15, 15): mask clear in every scheme → 2
//   [98, 42],    // close rect, rel (0, 0) → 4 where the mask is set
//   [290, 50],   // the zoom probe (T.r − 16, T.t + 12): inside the collapse rect, zoom tested first → 6
//   [279, 48],   // zoom icon, rel (6, 6) → 6
//   [295, 48],   // collapse icon, rel (6, 6) → 9
//   [304, 57],   // collapse rect, rel (15, 15): mask clear → 2

const docOps = [
  // §4 rows 1–2: 6 × 6 corners copied from F rows 10–15.
  ['copy', [94, 200, 100, 206], [0, 10, 6, 16]], ['copy', [300, 200, 306, 206], [10, 10, 16, 16]],
  // row 3: bottom rows C.b + 5 − i = 205..200, columns 100..299, P(6, 15 − i).
  ...[0, 1, 2, 3, 4, 5].map(i => ['line', [100, 205 - i, 299, 205 - i], [6, 15 - i]]),
  // row 4: columns 94 + i, rows 60..199, P(i, 6); row 5: columns 305 − i, P(15 − i, 6).
  ...[0, 1, 2, 3, 4, 5].map(i => ['line', [94 + i, 60, 94 + i, 199], [i, 6]]),
  ...[0, 1, 2, 3, 4, 5].map(i => ['line', [305 - i, 60, 305 - i, 199], [15 - i, 6]]),
  // row 6: row B = 206 from L + 2 = 96 to R = 306; column 306 from C.t − H + 2 = 40 to 206.
  ['line', [96, 206, 306, 206], [0, 0]], ['line', [306, 40, 306, 206], [0, 0]],
  // row 7: grow box (record flag set).
  ['grow', [285, 185, 302, 202]],
];
const joinedOps = [
  ['copy', [94, 38, 98, 42], [0, 0, 4, 4]], ['copy', [302, 38, 306, 42], [12, 0, 16, 4]],
  ['copy', [98, 57, 100, 60], [4, 3, 6, 6]], ['copy', [300, 57, 302, 60], [10, 3, 12, 6]],
  ...[0, 1, 2, 3].flatMap(i => [['line', [94 + i, 42, 94 + i, 59], [i, 6]], ['line', [305 - i, 42, 305 - i, 59], [15 - i, 6]]]),
  ...[0, 1, 2].map(i => ['line', [98, 38 + i, 301, 38 + i], [6, i]]),
  ...[0, 1, 2].map(i => ['line', [100, 59 - i, 299, 59 - i], [6, 5 - i]]),
  ['paint', [98, 41, 302, 57], [6, 3]],
];
// Kind 5: T = (94, 33, 306, 55) (C.t − 5 − H = 33, C.t − 5 = 55).
const boxOps = [
  ['copy', [94, 33, 98, 37], [0, 0, 4, 4]], ['copy', [302, 33, 306, 37], [12, 0, 16, 4]],
  ['copy', [94, 51, 98, 55], [0, 12, 4, 16]], ['copy', [302, 51, 306, 55], [12, 12, 16, 16]],
  ...[0, 1, 2, 3].flatMap(i => [['line', [94 + i, 37, 94 + i, 50], [i, 6]], ['line', [305 - i, 37, 305 - i, 50], [15 - i, 6]]]),
  ...[0, 1, 2].map(i => ['line', [98, 33 + i, 301, 33 + i], [6, i]]),
  ...[0, 1, 2].map(i => ['line', [98, 54 - i, 301, 54 - i], [6, 15 - i]]),
  ['paint', [98, 36, 302, 52], [6, 3]],
];
// §5A kind 1: outer = C outset 6 = (94, 54, 306, 206); thin: outset 3 = (97, 57, 303, 203).
const ring = ([l, t, r, b], top, gap) => [
  ['line', [l + 2, b, r, b], [0, 0]], ['line', [r, top + 2, r, b], [0, 0]],
  ['copy', [l, t, l + 3, t + 3], [5, 5, 8, 8]], ['copy', [r - 3, t, r, t + 3], [8, 5, 11, 8]], ['copy', [l, b - 3, l + 3, b], [5, 8, 8, 11]], ['copy', [r - 3, b - 3, r, b], [8, 8, 11, 11]],
  ...[0, 1, 2].map(i => ['line', [l + i, t + 3, l + i, b - 4], [5 + i, 7]]), ...[0, 1, 2].map(i => ['line', [r - 1 - i, t + 3, r - 1 - i, b - 4], [10 - i, 8]]),
  ...[0, 1, 2].map(i => ['line', [l + 3, t + i, r - 4, t + i], [7, 5 + i]]), ...[0, 1, 2].map(i => ['line', [l + 3, b - 1 - i, r - 4, b - 1 - i], [8, 10 - i]]),
  ...(gap ? [['gap', [97, 57, 303, 203], [100, 60, 300, 200]]] : []),
];
const W = (n, id, c) => [n, id, c];
const fiveOf = v => Object.fromEntries(SCHEMES.map(s => [s, v]));
const a = (active, inactive) => ({ active, inactive });

const EXPECTED = {
  'S1 §3.5 document frame cicn by state (kinds 0, 4)': fiveOf([a(-14332, -14336), a(-14332, -14336)]),
  'S2 §3.5 dialog frame cicn (kinds 1, 5; alert × state)': fiveOf([1, 5].map(() => ({ alert: a(-14322, -14324), plain: a(-14326, -14328) }))),
  // ics# + ics8 -14336/-14334/-14335 ship in all five (black-platinum has no ics4; the others' ics4 is never read).
  'S3 §3.5/§6.1 widget glyphs, normal state (standard, active)': fiveOf([W('close', -14336, 'ics8'), W('zoom', -14334, 'ics8'), W('collapse', -14335, 'ics8')]),
  // slimes: ppat -14331/-14325/-14321, cicn only -14325/-14321 (§8); the others: cicn only.
  'S4 §3.5/§5.2 stripe layers (active; document, kind 5 plain, kind 5 alert)': { ...fiveOf({ document: [['cicn', -14331]], plain: [['cicn', -14325]], alert: [['cicn', -14321]] }),
    slimes: { document: [['ppat', -14331]], plain: [['ppat', -14325], ['cicn', -14325]], alert: [['ppat', -14321], ['cicn', -14321]] } },
  // Kind 5 owns a frame grow box only with thin + grow (§6.4): variation 85 = 5 | 16 | 64. -14309/-14310 are
  // absent in all five → the procedural grow with clut -14336 / -14335 (§8).
  'S5 §3.5/§6.4 grow art (kind 0 and kind 5, by state)': fiveOf([a(['cicn', -14330], ['cicn', -14334]), a(['clut', -14336], ['clut', -14335])]),
  // (12,3): 21 odd, < 22 → ascent + trunc(1/2), 22. (10,2): 18 → 17 → ascent 10 + trunc(5/2) = 12, 22.
  // (13,3): 22 even → 21 → 22, ascent 13. (14,4): 24 → 23. (15,4): 25. (16,4): 26 → 25.
  'G1 §3.2 title height and adjusted ascent': [{ H: 22, ascent: 12 }, { H: 22, ascent: 12 }, { H: 22, ascent: 13 }, { H: 23, ascent: 14 }, { H: 25, ascent: 15 }, { H: 25, ascent: 16 }],
  'G2 §3.3 structure region by kind': {
    documentProc: [[94, 38, 306, 206], [96, 40, 307, 207]], noGrowDocProc: [[94, 38, 306, 206], [96, 40, 307, 207]],
    dBoxProc: [[94, 54, 306, 206], [96, 56, 307, 207]], 'dBoxProc thin': [[97, 57, 303, 203], [99, 59, 304, 204]],
    plainDBox: [[99, 59, 301, 201]], altDBoxProc: [[99, 59, 301, 201], [101, 61, 303, 203]],
    // kind 5: outset 6, top raised by H − 1 = 21 → 54 − 21 = 33; thin: 57 − 21 = 36.
    movableDBoxProc: [[94, 33, 306, 206], [96, 35, 307, 207]], 'movableDBoxProc thin': [[97, 36, 303, 203], [99, 38, 304, 204]],
    'documentProc collapsed': [[94, 38, 306, 60], [96, 40, 307, 61]] },
  'G3 §12 structure size = content + 12 + 1 by content + H + 6 + 1 (kind 0)': [200 + 12 + 1, 140 + 22 + 6 + 1],
  'G4 §3.3 named rects (standard)': { T: [94, 38, 306, 60], wy: 42, close: [98, 42, 114, 58], zoom: [273, 42, 289, 58], collapse: [289, 42, 305, 58], grow: [285, 185, 302, 202], L: 115, R: 269 },
  // not thin: T (94, 33, 306, 55), wy 33 + 4 = 37, grow (285, 185, 302, 202) + (3, 3); thin: T (97, 36, 303, 58), wy 40, no offset.
  'G5 §3.3 kind-5 title bar and grow (not thin, thin)': [{ T: [94, 33, 306, 55], grow: [288, 188, 305, 205], wy: 37 }, { T: [97, 36, 303, 58], grow: [285, 185, 302, 202], wy: 40 }],
  // T width = content + 12. Zoom ∩ close at T.r − 33 < T.l + 20 (width < 53); after dropping collapse, zoom at T.r − 17 (width < 37).
  'G6 §3.3 widget presence by title width': [[53, { close: true, zoom: true, collapse: true }], [52, { close: true, zoom: true, collapse: false }],
    [37, { close: true, zoom: true, collapse: false }], [36, { close: true, zoom: false, collapse: false }],
    [37, { close: true, zoom: false, collapse: true }], [36, { close: true, zoom: false, collapse: false }]],
  // w 60: centre 94 + trunc(152 / 2) = 170 (≥ L 115), text (170, 41, 230, 57). w 190: centre 105 < 115 → left 115.
  // no goAway: L = T.l + 5 = 99. no zoom: R = collapse.l − 4 = 285.
  'G7 §3.3 title text rect and limits': [{ L: 115, R: 269, text: [170, 41, 230, 57] }, { L: 115, R: 269, text: [115, 41, 305, 57] },
    { L: 99, R: 285, text: [170, 41, 230, 57] }, { L: 115, R: 285, text: [170, 41, 230, 57] }],
  // rows close.t .. close.t + 12 → [42, 55). w 60: (115, 167), (233, 269). w 148: left 126 → (115, 123) 8 px kept;
  // w 150: left 125 → (115, 122) 7 px skipped; right segments negative.
  'G8 §5.2 stripe rows and segments': [{ rows: [42, 55], segments: [[115, 269]] }, { rows: [42, 55], segments: [[115, 167], [233, 269]] },
    { rows: [42, 55], segments: [[115, 123]] }, { rows: [42, 55], segments: [] }],
  'G9 §3.4 message-8 regions (standard, title width 60)': { 0: [94, 38, 306, 60], 1: [170, 40, 230, 58], 2: [98, 42, 114, 58], 3: [273, 42, 289, 58], 6: [285, 185, 302, 202], 7: [289, 42, 305, 58],
    32: [[94, 38, 306, 206], [96, 40, 307, 207]], 33: [100, 60, 300, 200] },
  // grow 1, zoom 2, canCollapse 4, modal 8, 16, titled 64, 0x0F80. v 0: 1|4|16|64|0xf80 = 0xfd5 = 4053.
  'G10 §3.1 variation flags and get-features': [[0, 0, 4053], [8, 0, 4055], [4, 4, 4052], [1, 1, 3992], [2, 2, 3984], [3, 3, 3984], [5, 5, 4056], [65, 1, 3993], [17, 1, 3992], [49, 1, 3992]],
  'G11 §6.4 grow box belongs to the frame; content minus grow': [[true, [285, 185, 302, 202]], [false, null], [true, [285, 185, 302, 202]], [false, null], [false, null], [true, null]],
  'G12 §4 document frame draw list (standard)': docOps,
  'G13 §5 title draw list, joined (standard) and box (kind 5)': [joinedOps, boxOps],
  'G14 §5A dialog ring (kind 1; thin)': [ring([94, 54, 306, 206], 54, true), ring([97, 57, 303, 203], 57, false)],
  // text rect (170, 41, 230, 57): 41 + trunc((16 − 15) / 2) + 12 = 53; (10, 2): ascent 10 + 2 (G1) → 41 + trunc((16 − 14) / 2) + 12 = 54.
  'G15 §5.1 title baseline (Chicago 12; a 10/2 font raised to H 22)': [53, 54],
  // Archive facts: raw RGB16 clut entries of -14332 (active) / -14336 (inactive) at (6, 3), (7, 3), (9, 3).
  'C1 §5 row 1 sampled fill, text, shadow (document)': {
    'apple-platinum-2': a({ fill: 'cccccccccccc', text: '000000000000', shadow: 'cccccccccccc' }, { fill: 'cccccccccccc', text: '000000000000', shadow: 'cccccccccccc' }),
    'black-platinum': a({ fill: '318c318c318c', text: 'ffffffffffff', shadow: '318c318c318c' }, { fill: '529452945294', text: '210821082108', shadow: '529452945294' }),
    'platinum-8': a({ fill: 'cccccccccccc', text: '222222222222', shadow: 'cccccccccccc' }, { fill: 'bbbbbbbbbbbb', text: '333333333333', shadow: 'ffffffffffff' }),
    slimes: a({ fill: 'ccccffff3333', text: '000000009999', shadow: 'eeeeeeeeeeee' }, { fill: 'ccccffff9999', text: '777777777777', shadow: 'ccccffff9999' }),
    'system7-nostalgia-silver': a({ fill: 'eeeeeeeeeeee', text: '000000000000', shadow: 'eeeeeeeeeeee' }, { fill: 'eeeeeeeeeeee', text: '777777777777', shadow: 'eeeeeeeeeeee' }),
  },
  'C3 §4 row 6 drop-shadow colour P(0, 0)': {
    'apple-platinum-2': a(['000000000000'], ['000000000000']), 'black-platinum': a(['000000000000'], ['210821082108']),
    'platinum-8': a(['333333333333'], ['bbbbbbbbbbbb']), slimes: a(['000033330000'], ['bbbbbbbbbbbb']), 'system7-nostalgia-silver': a(['000000000000'], ['555555555555']) },
  'C6 §5.1 synthetic: shadow = text draws one pass; shadow = fill still draws two': [1, 2],
  'H1 §5 rows 11–12 widgets and stripes only when hilited (standard)': { ...fiveOf(a({ widgets: 3, stripes: 1 }, { widgets: 0, stripes: 0 })) },
  'T3 §6.3 zoom part: 5 at the stored zoom rect, else 6; kind-5 title (+1 row)': [5, 2, 1],
  'M1 §5 title mode table (kind × collapsed × WdrB × gap)': ['box', 'joined', 'joined', 'box', 'box', 'joined', 'box'],
};
const EXPECTED_C1 = EXPECTED['C1 §5 row 1 sampled fill, text, shadow (document)'];
// Every corpus shadow sample differs from its text sample, so every cell draws both passes (shadow first, at +1/+1).
EXPECTED['C2 §5.1 title text passes (shadow pass at +1/+1 only when shadow ≠ text)'] = perScheme(slug => perState(hl => {
  const c = EXPECTED_C1[slug][hl ? 'active' : 'inactive']; return [[[121, 56], c.shadow], [[120, 55], c.text]]; }));
// Archive facts, outer → inner. C4 (-14332 / -14336): bottom rows 205..200 = P(6, 15..10), left columns
// 94..99 = P(0..5, 6), right columns 305..300 = P(15..10, 6). C5 (-14326 / -14328): left P(5..7, 7),
// right P(10..8, 8), top P(7, 5..7), bottom P(8, 10..8).
const K = { a: '000000000000', w: 'ffffffffffff', c: 'cccccccccccc', n: '999999999999', d: 'dddddddddddd', e: 'eeeeeeeeeeee', f5: '555555555555', f8: '888888888888', f7: '777777777777', b: 'bbbbbbbbbbbb' };
const j = (...xs) => xs.join(' ');
const band = (bottom, left, right = bottom) => ({ bottom, left, right });
EXPECTED['C4 §4 rows 3–5 band colours, outer → inner (left, right, bottom)'] = {
  'apple-platinum-2': a(band(j(K.a, K.n, K.c, K.c, K.w, K.a), j(K.a, K.w, K.c, K.c, K.n, K.a)), band(j(K.a, K.n, K.c, K.c, K.w, K.a), j(K.a, K.w, K.c, K.c, K.n, K.a))),
  'black-platinum': a(band(j(K.a, '210821082108', '318c318c318c', '318c318c318c', '529452945294', K.a), j(K.a, '529452945294', '318c318c318c', '318c318c318c', '210821082108', K.a)),
    band(j('210821082108', '421042104210', '529452945294', '529452945294', '529452945294', '210821082108'), j('210821082108', '739c739c739c', '529452945294', '529452945294', '529452945294', '210821082108'))),
  'platinum-8': a(band(j('333333333333', K.n, K.c, K.c, K.w, '333333333333'), j('333333333333', K.w, K.c, K.c, K.n, '333333333333')), band(j(K.b, K.b, K.b, K.b, K.b, K.b), j(K.b, K.b, K.b, K.b, K.b, K.b))),
  slimes: a(band(j('000033330000', '9999ffff0000', 'ccccffff3333', 'ccccffff3333', K.e, '666666666666'), j('000033330000', 'ffffffffcccc', 'ccccffff3333', 'ccccffff3333', K.f7, '666666666666')),
    band(j(K.b, 'ccccffff9999', 'ccccffff9999', 'ccccffff9999', 'ccccffff9999', K.b), j(K.b, 'ccccffff9999', 'ccccffff9999', 'ccccffff9999', 'ccccffff9999', K.b))),
  'system7-nostalgia-silver': a(band(j(K.a, 'aaaaaaaaaaaa', K.e, K.e, K.d, K.a), j(K.a, K.d, K.e, K.e, 'aaaaaaaaaaaa', K.a)), band(j(K.f5, K.d, K.e, K.e, K.w, K.f5), j(K.f5, K.w, K.e, K.e, K.d, K.f5))),
};
const ring4 = (x, y, z, u = x, v = y, w = z) => j(x, y, z, u, v, w, x, y, z, u, v, w);
EXPECTED['C5 §5A ring line colours (kind 1 plain, outer → inner)'] = {
  'apple-platinum-2': a(ring4(K.a, K.d, K.w, K.a, K.f5, K.f8), ring4(K.a, K.d, K.w, K.a, K.f5, K.f8)),
  'black-platinum': a(ring4(K.a, 'ce73ce73ce73', K.w, K.a, '529452945294', '8c638c638c63'), ring4(K.a, 'def7def7def7', 'def7def7def7')),
  'platinum-8': a(ring4(K.a, K.d, K.w, K.a, K.f5, K.f8), ring4(K.f7, K.d, K.d)),
  slimes: a(ring4('444444444444', K.e, K.w, '444444444444', K.f5, K.f8), ring4(K.f7, K.d, K.d)),
  'system7-nostalgia-silver': a(ring4(K.a, K.e, K.d, K.a, K.d, K.e), ring4(K.f5, K.e, K.e)),
};
// Hit codes in HIT_POINTS order. Mask facts (ics# -14336/-14334/-14335 share one mask per scheme):
// apple-platinum-2, black-platinum, system7: columns 0–12 of rows 0–12 set; platinum-8: columns 1–11 of
// rows 1–11; slimes: a drop shape (rel (0, 0) clear, rel (6, 6) set). Rel (0, 0) of close is the only
// mask-dependent point that differs by scheme.
const ACTIVE = mask00 => [0, 0, 1, 1, 3, 3, 2, 2, 2, 4, 4, 2, mask00, 6, 6, 9, 2];
EXPECTED['T1 §6.3 hit codes (standard, active)'] = { 'apple-platinum-2': ACTIVE(4), 'black-platinum': ACTIVE(4), 'platinum-8': ACTIVE(2), slimes: ACTIVE(2), 'system7-nostalgia-silver': ACTIVE(4) };
EXPECTED['T2 §6.3 hit codes (standard, inactive)'] = fiveOf([0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);

test('every rule row equals the spec value under the decode', () => {
  assert.deepEqual(Object.keys(ROWS).sort(), Object.keys(EXPECTED).sort());
  for (const [id, row] of Object.entries(ROWS)) assert.deepEqual(row({}), EXPECTED[id], id);
});

test('corpus: the five schemes reach this unit and ship what it reads (§1.1, §8)', () => {
  for (const slug of SCHEMES) {
    const h = has(slug), types = new Set(corpus.get(slug).map(r => r.type));
    assert.ok(!types.has('wnd#') && !h('WDEF', -14330), `${slug}: no wnd#, no WDEF -14330`);
    for (const id of [-14336, -14332, -14328, -14326, -14324, -14322, -14330, -14334]) assert.ok(h('cicn', id), `${slug} cicn ${id}`);
    for (const id of [-14336, -14335, -14334, -14333, -14332, -14331]) assert.ok(h('ics#', id) && h('ics8', id), `${slug} ics#/ics8 ${id}`);
    for (const id of [-14309, -14310]) assert.ok(!h('cicn', id), `${slug} cicn ${id} absent`);
    assert.ok(h('clut', -14336) && h('clut', -14335) && h('actb', -14336), `${slug} clut/actb`);
    for (const id of [-14336, -14332]) assert.deepEqual([cicn(slug, id).pmap.width, cicn(slug, id).pmap.height], [16, 16], `${slug} ${id} 16 × 16`);
    for (const id of [-14330, -14334]) assert.deepEqual([cicn(slug, id).pmap.width, cicn(slug, id).pmap.height], [17, 17], `${slug} ${id} 17 × 17`);
  }
  assert.equal(has('black-platinum')('ics4', -14336), false);   // §8: black-platinum ships no ics4 (S3 cannot see an ics4 reading there)
});

test('the colour lookup cannot matter: value-match and the kDEF serialized-palette sampler agree on every frame/dialog pixel', () => {
  for (const slug of SCHEMES) for (const id of [-14336, -14332, -14328, -14326, -14324, -14322]) {
    const c = cicn(slug, id), s = makeKdefColorSampler(c.indices, c.pmap.width, c.pmap.height, c.colorTable.entries);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) assert.equal(P(slug, id, [x, y]), hex(s(x, y)), `${slug} ${id} (${x}, ${y})`);
  }
});

test('alert colouring decision rows (§3.5, 0x14c64)', () => {
  const ctab = [0xffff, 0xffff, 0xffff];
  assert.equal(alertColouring({ thin: true, alertBit: true, kind: 0 }), true);            // thin: alertBit alone
  assert.equal(alertColouring({ thin: true, alertBit: false, auxBit4: true, kind: 1 }), false);
  assert.equal(alertColouring({ thin: false, auxBit4: true, kind: 0 }), true);
  assert.equal(alertColouring({ thin: false, kind: 0, actb: ctab, windowEntry0: ctab }), false); // not kind 1, not movable
  assert.equal(alertColouring({ thin: false, kind: 1, actb: null, windowEntry0: ctab }), false);
  assert.equal(alertColouring({ thin: false, kind: 5, actb: ctab, windowEntry0: ctab }), true);
  assert.equal(alertColouring({ thin: false, kind: 1, actb: ctab, windowEntry0: [0, 0, 0] }), false);
  assert.equal(growOwned(decodeVariation(5), true), false);                                // movable: record flag alone never owns
});

// Plausible wrong readings (spec §12 "each row must be able to fail"), each a model override.
// Several are the current runtime's readings (spec §11), named "(runtime)".
const swapZoomCollapse = { widgetIds: { close: [-14336, -14333], zoom: [-14335, -14332], collapse: [-14334, -14331] } };
const MUTATIONS = {
  'fill sampled from row 4 (P(6, 4))': { samples: { ...DECODE.samples, fill: [6, 4] } },
  'text and shadow sample points swapped': { samples: { ...DECODE.samples, text: [9, 3], shadow: [7, 3] } },
  'shadow pass always drawn': { shadowPass: () => true },
  'shadow pass only when shadow ≠ fill': { shadowPass: (s, t, f) => JSON.stringify(s) !== JSON.stringify(f) },
  'shadow offset (+1, 0)': { shadowOffset: [1, 0] },
  'drop shadow from P(15, 15)': { samples: { ...DECODE.samples, drop: [15, 15] } },
  'drop shadow in the fill colour P(6, 3)': { samples: { ...DECODE.samples, drop: [6, 3] } },
  'kind 0 without an implied grow box': { growKinds: [] },
  'movable modal not reported modal': { modalKinds: [1] },
  'kind 5 untitled': { titledKinds: [0, 4] },
  'zoom codes swapped (5 ↔ 6)': { zoomCodes: { atZoomRect: 6, otherwise: 5 } },
  'baseline from the unadjusted ascent': { baselineAscent: 'raw' },
  'side and bottom bands 5 px': { side: 5 },
  'no 22-px floor': { titleFloor: 0 },
  'no parity step': { titleParity: false },
  'zoom and collapse ids swapped (runtime map close + 1 / + 2)': swapZoomCollapse,
  'widgets drawn when inactive (runtime)': { widgetsWhenInactive: true },
  'stripes drawn when inactive (runtime)': { stripesWhenInactive: true },
  'stripes: cicn preferred, ppat fallback (runtime cicnOrPpatRecord)': { stripeLayers: (h, id) => (h('cicn', id) ? [['cicn', id]] : h('ppat', id) ? [['ppat', id]] : []) },
  'ics4 preferred over ics8': { iconColour: ['ics4', 'ics8'] },
  'stripes: cicn layer only (ppat ignored)': { stripeLayers: (h, id) => (h('cicn', id) ? [['cicn', id]] : []) },
  'collapse box never shown (shadeOn ignored)': { collapseBox: false },
  'ring right column unmirrored (P_D(8 + i, 8))': { ring: { ...DECODE.ring, right: i => [8 + i, 8] } },
  'ring rows and columns transposed (left P_D(7, 5 + i))': { ring: { left: i => [7, 5 + i], right: i => [8, 10 - i], top: i => [5 + i, 7], bottom: i => [10 - i, 8] } },
  'frame cicn states swapped': { frameCicn: { true: -14336, false: -14332 } },
  'dialog alert / plain swapped (published §2.1 labels)': { dialogCicn: { alert: DECODE.dialogCicn.plain, plain: DECODE.dialogCicn.alert } },
  'grow inactive id = active id': { growCicn: { true: -14330, false: -14330 } },
  'grow at the inner frame corner (runtime, C.r − 17 .. C.r)': { grow: { ...DECODE.grow, inset: 17, outset: 0 } },
  'dialog outset 3 when not thin': { dialogOutset: 3 },
  'shadow shifted 1 px': { shadowShift: 1 },
  'widget top T.t + 3': { widgetTop: T => T[1] + 3 },
  'close at T.l + 5': { closeDx: 5 },
  'collapse at T.r − 16': { collapseDx: 16 },
  'zoom at T.r − 32': { zoomDx: 32 },
  'title left limit close.l + 16': { limits: { ...DECODE.limits, afterClose: 16 } },
  'title right limit widget.l − 3': { limits: { ...DECODE.limits, beforeWidget: 3 } },
  'stripe gap 2': { stripeGap: 2 },
  'stripe band 12 rows': { stripeRows: 12 },
  'stripe segments < 7 px skipped (not ≤ 7)': { stripeMinSkip: 6 },
  'right band unmirrored (P(i, 6))': { bands: { ...DECODE.bands, right: i => [i, 6] } },
  'bottom band unmirrored (P(6, 10 + i))': { bands: { ...DECODE.bands, bottom: i => [6, 10 + i] } },
  'hit probes at ±15': { hitProbe: { close: 15, zoom: 15, dy: 12 } },
  'hit probes at row T.t + 11': { hitProbe: { close: 16, zoom: 16, dy: 11 } },
  'widget hit by rect, not by the ics# mask': { hitIconByMask: false },
  'no +1 title row in the drag test': { titleRowPlusOne: 0 },
  'WdrB ignored (collapsed always box)': { titleMode: ({ kind, collapsed }) => (kind === 5 || collapsed ? 'box' : 'joined') },
  'WdrB gap test inverted': { titleMode: ({ kind, collapsed, wdrb, gap, H }) => (kind === 5 ? 'box' : !collapsed ? 'joined' : !wdrb ? 'box' : gap !== H ? 'box' : 'joined') },
};

const PER_SCHEME = id => /^(S[1-5]|C[1-5]|H1|T[12]) /.test(id);
const sameJson = (x, y) => JSON.stringify(x) === JSON.stringify(y);
/** The cells of a row: one per scheme, split by state where the row is keyed { active, inactive }. */
const cells = (id, value) => !PER_SCHEME(id) ? [['all', value]]
  : SCHEMES.flatMap(s => (value[s] && 'active' in value[s] ? Object.keys(STATES).map(st => [`${s}/${st}`, value[s][st]]) : [[s, value[s]]]));
const ROW_VALUES = Object.fromEntries(Object.keys(ROWS).map(id => [id, cells(id, EXPECTED[id])]));
/** For each mutation: failing rows, each 'all' or the failing scheme (/state) cells. */
function mutationTable() {
  return Object.fromEntries(Object.entries(MUTATIONS).map(([name, reading]) => {
    const fails = {};
    for (const [id, row] of Object.entries(ROWS)) {
      let value; try { value = row(reading); } catch { fails[id.split(' ')[0]] = 'throws'; continue; }   // the wrong reading has no value here
      const got = cells(id, value), want = ROW_VALUES[id];
      const bad = want.filter(([k, v], i) => !sameJson(got[i]?.[1], v) || got[i][0] !== k).map(([k]) => k);
      if (bad.length) fails[id.split(' ')[0]] = bad.length === want.length ? 'all' : bad;
    }
    return [name, fails];
  }));
}
const AB = { 'apple-platinum-2': 'ap2', 'black-platinum': 'bp', 'platinum-8': 'p8', slimes: 'slimes', 'system7-nostalgia-silver': 's7' };
/** Short cell names: 'bp' when both states of a scheme fail, else 'bp/active'. */
const short = v => { if (!Array.isArray(v)) return v; const out = [];
  for (const x of v) { const [slug, st] = x.split('/'); if (st === 'inactive' && out.at(-1) === `${AB[slug]}/active`) out[out.length - 1] = AB[slug]; else out.push(st ? `${AB[slug]}/${st}` : AB[slug]); }
  return out; };

test('mutation table: each wrong reading fails the named rows, per scheme and state', () => {
  const table = Object.fromEntries(Object.entries(mutationTable()).map(([m, f]) => [m, Object.fromEntries(Object.entries(f).map(([k, v]) => [k, short(v)]))]));
  // A list names the cells that see the mutation; the cells it omits cannot discriminate it (findings below).
  assert.deepEqual(table, {
    "fill sampled from row 4 (P(6, 4))": { G13: "all", C1: ["ap2", "bp/active", "p8/active", "slimes/active", "s7"] },
    "text and shadow sample points swapped": { C1: "all", C2: "all" },
    "shadow pass always drawn": { C6: "all" },
    "shadow pass only when shadow ≠ fill": { C2: ["ap2", "bp", "p8/active", "slimes/inactive", "s7"], C6: "all" },
    "shadow offset (+1, 0)": { C2: "all" },
    "drop shadow from P(15, 15)": { G12: "all" },
    "drop shadow in the fill colour P(6, 3)": { G12: "all", C3: ["ap2", "bp", "p8/active", "slimes", "s7"] },
    "kind 0 without an implied grow box": { G10: "all", G11: "all", G12: "all", T1: "all", T2: "all" },
    "movable modal not reported modal": { G10: "all" },
    "kind 5 untitled": { S4: "all", G5: "all", G10: "all", G13: "throws", T3: "all" },
    "zoom codes swapped (5 ↔ 6)": { T1: "all", T3: "all" },
    "baseline from the unadjusted ascent": { G15: "all" },
    "side and bottom bands 5 px": { G2: "all", G3: "all", G4: "all", G6: "all", G7: "all", G8: "all", G9: "all", G12: "all", G13: "all", C4: "all", T1: "all", T2: "all" },
    "no 22-px floor": { G1: "all", G15: "all" },
    "no parity step": { G1: "all" },
    "zoom and collapse ids swapped (runtime map close + 1 / + 2)": { S3: "all" },
    "widgets drawn when inactive (runtime)": { H1: ["ap2/inactive", "bp/inactive", "p8/inactive", "slimes/inactive", "s7/inactive"] },
    "stripes drawn when inactive (runtime)": { H1: ["ap2/inactive", "bp/inactive", "p8/inactive", "slimes/inactive", "s7/inactive"] },
    "stripes: cicn preferred, ppat fallback (runtime cicnOrPpatRecord)": { S4: ["slimes"] },
    "ics4 preferred over ics8": { S3: ["ap2", "p8", "slimes", "s7"] },
    "stripes: cicn layer only (ppat ignored)": { S4: ["slimes"], H1: ["slimes/active"] },
    "collapse box never shown (shadeOn ignored)": { S3: "all", G4: "all", G6: "all", G7: "all", G8: "all", G9: "all", H1: ["ap2/active", "bp/active", "p8/active", "slimes/active", "s7/active"], T1: "all", T3: "all" },
    "ring right column unmirrored (P_D(8 + i, 8))": { G14: "all", C5: "all" },
    "ring rows and columns transposed (left P_D(7, 5 + i))": { G14: "all" },
    "frame cicn states swapped": { S1: "all", C1: ["bp", "p8", "slimes", "s7"], C2: ["bp", "p8", "slimes", "s7"], C3: ["bp", "p8", "slimes", "s7"], C4: ["bp", "p8", "slimes", "s7"] },
    "dialog alert / plain swapped (published §2.1 labels)": { S2: "all", C5: ["bp/active", "p8", "slimes", "s7"] },
    "grow inactive id = active id": { S5: "all" },
    "grow at the inner frame corner (runtime, C.r − 17 .. C.r)": { G4: "all", G5: "all", G9: "all", G11: "all", G12: "all" },
    "dialog outset 3 when not thin": { G2: "all", G14: "all" },
    "shadow shifted 1 px": { G2: "all", G3: "all", G9: "all", T1: "all", T2: "all" },
    "widget top T.t + 3": { G4: "all", G5: "all", G8: "all", G9: "all" },
    "close at T.l + 5": { G4: "all", G6: "all", G7: "all", G8: "all", G9: "all", T1: ["ap2", "bp", "s7"] },
    "collapse at T.r − 16": { G4: "all", G6: "all", G7: "all", G9: "all" },
    "zoom at T.r − 32": { G4: "all", G6: "all", G7: "all", G8: "all", G9: "all" },
    "title left limit close.l + 16": { G4: "all", G7: "all", G8: "all" },
    "title right limit widget.l − 3": { G4: "all", G7: "all", G8: "all" },
    "stripe gap 2": { G8: "all" },
    "stripe band 12 rows": { G8: "all" },
    "stripe segments < 7 px skipped (not ≤ 7)": { G8: "all" },
    "right band unmirrored (P(i, 6))": { G12: "all", C4: ["ap2", "bp", "p8/active", "slimes/active", "s7"] },
    "bottom band unmirrored (P(6, 10 + i))": { G12: "all", C4: ["ap2", "bp", "p8/active", "slimes/active", "s7"] },
    "hit probes at ±15": { T1: "all" },
    "hit probes at row T.t + 11": { T1: "all" },
    "widget hit by rect, not by the ics# mask": { T1: "all" },
    "no +1 title row in the drag test": { T3: "all" },
    "WdrB ignored (collapsed always box)": { M1: "all" },
    "WdrB gap test inverted": { M1: "all" },
  });
  // Every row fails under at least one mutation, and so does every scheme (/state) cell of a per-scheme row.
  const raw = mutationTable(), blind = [];
  for (const id of Object.keys(ROWS)) {
    const key = id.split(' ')[0], seen = new Set();
    for (const f of Object.values(raw)) { const v = f[key]; if (v === 'all' || v === 'throws') ROW_VALUES[id].forEach(([c]) => seen.add(c)); else v?.forEach(c => seen.add(c)); }
    for (const [c] of ROW_VALUES[id]) if (!seen.has(c)) blind.push(`${key} ${c}`);
  }
  assert.deepEqual(blind, []);
});

test('findings: readings the corpus cannot tell apart from the decode (named, not dropped)', () => {
  const t = mutationTable();
  // 1. Every corpus shadow sample P(9, 3) differs from its text sample P(7, 3), so "always draw the shadow
  //    pass" changes no corpus cell; only the synthetic C6 row fails it.
  assert.deepEqual(Object.keys(t['shadow pass always drawn']), ['C6']);
  // 2. P(15, 15) = P(0, 0) in all ten document frame cicns: a mirrored drop-shadow sample is visible only
  //    as the op's sample point (G12), never as a colour (C3).
  assert.deepEqual(Object.keys(t['drop shadow from P(15, 15)']), ['G12']);
  // 3. apple-platinum-2's -14332 and -14336 sample identically at every point this unit reads, so its
  //    colour rows cannot see a swapped state; only S1 (the id) can.
  for (const k of ['C1', 'C2', 'C3', 'C4']) assert.ok(!t['frame cicn states swapped'][k].includes('apple-platinum-2/active'), k);
  // 4. P(6, 4) = P(6, 3) in black-platinum, platinum-8 and slimes inactive (-14336): the spec's own §12
  //    mutation ("sample row 4") is blind there.
  assert.deepEqual(['black-platinum/inactive', 'platinum-8/inactive', 'slimes/inactive'].filter(c => !t['fill sampled from row 4 (P(6, 4))'].C1.includes(c)),
    ['black-platinum/inactive', 'platinum-8/inactive', 'slimes/inactive']);
  // 5. black-platinum ships no ics4: an ics4 reading is invisible there (S3).
  assert.ok(!t['ics4 preferred over ics8'].S3.includes('black-platinum'));
  // 6. Only slimes ships a stripes ppat; the ppat/cicn layer order is invisible in the other four.
  assert.deepEqual(t['stripes: cicn preferred, ppat fallback (runtime cicnOrPpatRecord)'].S4, ['slimes']);
  // 7. The dialog cicns -14326/-14324 sample like -14328/-14322 on the ring in apple-platinum-2 (both
  //    states) and black-platinum inactive; ring sample points are symmetric under transposition in all five.
  assert.deepEqual(t['dialog alert / plain swapped (published §2.1 labels)'].C5.filter(c => c.startsWith('apple-platinum-2') || c === 'black-platinum/inactive'), []);
  assert.deepEqual(Object.keys(t['ring rows and columns transposed (left P_D(7, 5 + i))']), ['G14']);
  // 8. The shadow pass is visible (shadow ≠ fill) only in platinum-8 inactive and slimes active (spec §8).
  assert.deepEqual(SCHEMES.flatMap(s => Object.keys(STATES).map(st => `${s}/${st}`)).filter(c => !t['shadow pass only when shadow ≠ fill'].C2.includes(c)),
    ['platinum-8/inactive', 'slimes/active']);
  // 9. The close probe point (T.l + 16, T.t + 12) lies on the close mask in apple-platinum-2,
  //    black-platinum, system7 and slimes; only platinum-8's mask (columns 1–11) leaves it to the probe.
  assert.equal(mask('platinum-8')(-14336, 12, 8), false);
  for (const s of ['apple-platinum-2', 'black-platinum', 'slimes', 'system7-nostalgia-silver']) assert.equal(mask(s)(-14336, 12, 8), true, s);
});

// D1–D11: rows needing the engine driver. Their expected values are data in
// procedural-frame-rules.mjs (DRIVER_ROWS); here each is pinned to the spec model.
const MODEL = {
  D1: () => perScheme(slug => perState(hl => { const x = selectArt(win({ hilited: hl }), has(slug)); return { frame: x.frame, stripes: x.stripes, widgets: x.widgets, grow: x.grow }; })),
  D2: () => Object.fromEntries([8, 1, 2, 3, 5].map(v => { const g = geo({ variation: v }); return [v, { structure: g.structure, content: g.content }]; })),
  D3: () => { const x = selectArt(win({ hilited: true }), has('platinum-8'));
    assert.deepEqual(titleOps(geo({}), 'joined'), EXPECTED['G13 §5 title draw list, joined (standard) and box (kind 5)'][0]);
    assert.deepEqual(documentFrameOps(geo({})), EXPECTED['G12 §4 document frame draw list (standard)']);
    return ['sample fill/text/shadow', 'G13 joined', 'title text', ...(x.stripes.length ? ['stripes'] : []), ...x.widgets.map(w => w[0]), 'G12']; },
  D4: () => {
    // Each probe lies on exactly the op the spec says supplies it (frame, title or shadow), or on no op.
    const g = geo({}), ops = [...titleOps(g, 'joined'), ...documentFrameOps(g)];
    const covers = ([x, y], op) => op[0] === 'line' ? x >= op[1][0] && x <= op[1][2] && y >= op[1][1] && y <= op[1][3] : x >= op[1][0] && x < op[1][2] && y >= op[1][1] && y < op[1][3];
    const source = (p, op) => op[0] === 'line' || op[0] === 'paint' ? op[2] : op[0] === 'copy' ? [op[2][0] + p[0] - op[1][0], op[2][1] + p[1] - op[1][1]] : null;
    const probes = Object.fromEntries(Object.entries(PIXEL_PROBES).map(([name, [p]]) => { const last = ops.filter(op => covers(p, op)).at(-1); return [name, [p, last ? source(p, last) : 'untouched']]; }));
    const inactive = selectArt(win({ hilited: false }), has('platinum-8'));
    assert.deepEqual([inactive.stripes, inactive.widgets], [[], []]);
    return { frame: { active: selectArt(win({ hilited: true }), has('slimes')).frame, inactive: inactive.frame }, probes,
      inactiveOnly: { 'stripe band shows the fill when inactive (200, 48)': [[200, 48], source([200, 48], titleOps(g, 'joined').at(-1))], 'no close glyph when inactive (104, 48)': [[104, 48], source([104, 48], titleOps(g, 'joined').at(-1))] } }; },
  D5: () => { const g = geo({}), seg = g.stripes.segments[0];
    return { document: selectArt(win({ hilited: true }), has('slimes')).stripes.map(([t, id]) => [t, id, [seg[0], g.stripes.rows[0], seg[1], g.stripes.rows[1]], [seg[0], g.stripes.rows[0]]]),
      movablePlain: selectArt(win({ variation: 5, hilited: true }), has('slimes')).stripes }; },
  D6: () => { const g = geo({}); return perState(hl => selectArt(win({ hilited: hl }), has('apple-platinum-2')).widgets.map(([n, id]) => [n, id, g[n]])); },
  D7: () => titleHeight(H22),
  D8: () => ({ active: ROWS['T1 §6.3 hit codes (standard, active)']({}), inactive: ROWS['T2 §6.3 hit codes (standard, inactive)']({})['platinum-8'] }),
  D9: () => { const all = Object.values(ROWS['C2 §5.1 title text passes (shadow pass at +1/+1 only when shadow ≠ text)']({})).flatMap(Object.values);
    assert.ok(all.every(p => p.length === all[0].length)); return { passes: all[0].length, shadowOffset: [all[0][0][0][0] - all[0][1][0][0], all[0][0][0][1] - all[0][1][0][1]] }; },
  D10: () => perState(hl => [...selectArt(win({ hilited: hl }), has('system7-nostalgia-silver')).grow, documentFrameOps(geo({})).at(-1)[1]]),
  D11: () => { assert.deepEqual(dialogRingOps(geo({ variation: 1 })), EXPECTED['G14 §5A dialog ring (kind 1; thin)'][0]);
    const gap = dialogRingOps(geo({ variation: 1 })).at(-1); return { dialog: perState(hl => selectArt(win({ variation: 1, hilited: hl }), has('black-platinum')).frame), ops: 'G14', gap: gap.slice(1) }; },
};

test('driver rows: DRIVER_ROWS expected values are the spec model values', () => {
  assert.deepEqual(Object.keys(DRIVER_ROWS), Object.keys(MODEL));
  for (const [id, row] of Object.entries(DRIVER_ROWS)) assert.deepEqual(MODEL[id](), row.expected, `${id} ${row.title}`);
  assert.deepEqual(DRIVER_ROWS.D8.expected.active, EXPECTED['T1 §6.3 hit codes (standard, active)']);
});

for (const [id, row] of Object.entries(DRIVER_ROWS)) test(`${id} ${row.title} (${row.needs})`, { todo: 'awaits procedural-frame driver' });

// ===========================================================================
// Revision 3 (#415): the shared rows TG / WP / CT / GB and the utility family §9
// (UI / UG / UP / UFA / UFC / UFH / UFS / UFT / US / UW / UT / UGB / UM / UH).
// Same discipline as above: each expected literal is the spec's number, a hand
// derivation (written next to it) or an archive fact read from the fork.
// Utility windows (C = (100, 60, 260, 150), 160 × 90 content):
//   titled horizontal, H 15 (t 16): T = (96, 44, 264, 60); structure (96, 44, 264, 154) ∪ (98, 46, 265, 155);
//     F = (96, 44, 264, 154); boxes top 44 + trunc(7 / 2) = 47: close (98, 47, 108, 57), collapse (252, …, 262),
//     zoom shifted (241, …, 251); Lu = 108 + 2 = 110; Ru = 252 − 2 = 250 (no zoom) or 241 − 2 = 239 (zoom).
//   untitled horizontal, H 13 (t 14): T = (96, 46, 264, 60); boxes top 46 + trunc(5 / 2) = 48.
//   side, H 13: T = (86, 56, 100, 154); structure (86, 56, 264, 154) ∪ (88, 58, 265, 155); boxes left 88:
//     close (88, 58, 98, 68), collapse (88, 142, 98, 152), zoom shifted (88, 131, 98, 141).
//   collapsed: structure = T ∪ T shifted (+2, +2) with right/bottom − 1; content degenerate at C's top (side: left) edge.
const UC = [100, 60, 260, 150];
const uw = over => ({ variation: 3, C: UC, hilited: true, goAway: true, shadeOn: true, collapsed: false, title: 'x', ...over });
const UT = { variation: 3 }, UN = { variation: 1, title: '' }, US_ = { variation: 9, goAway: false, title: '' };
const UCOL = { variation: 1, collapsed: true }, UCOLS = { variation: 9, collapsed: true, goAway: false, title: '' };
const ug = (over, r) => utilityGeometry(uw(over), { reading: r });
const uhas = slug => (type, id) => has(slug)(type, id);
const usize = slug => id => [cicn(slug, id).pmap.width, cicn(slug, id).pmap.height];
const TEXT = { title: 'x', width: 40, condensedWidth: 36, ascent: 10, descent: 2, colours: { fill: 'f', text: 't', shadow: 's' } };
// A colour table as [{ value, rgb }] in position order, from a clut / actb resource (ctSeed 4, ctFlags 2, ctSize 2, then 8 bytes each).
const ctab = d => Array.from({ length: ((d[6] << 8) | d[7]) + 1 }, (_, i) => { const o = 8 + i * 8, w = k => (d[o + k] << 8) | d[o + k + 1]; return { value: w(0), rgb: [w(2), w(4), w(6)] }; });
const A = [1, 1, 1], B = [2, 2, 2], Cc = [3, 3, 3];
const NARROW = (cw, r) => utilityGeometry(uw({ goAway: false, shadeOn: false, C: [100, 60, 100 + cw, 150] }), { reading: r });
const U_ROWS = {
  // ---- shared rows (§2, §3.3, §3.5, §6.4)
  'TG1 §2 a part-0 draw clears the bit; then two part-4 calls draw pressed, then normal': r => [true, false].map(hilited => toggleRun('document', [0, 4, 4], 1, { reading: r, hilited })),
  'TG2 §2 parts 4, 5/6, 9 by the bit; 258 flips, 258 and 1 draw nothing (document)': r => toggleRun('document', [5, 6, 9, 258, 4, 1], 1, { reading: r }),
  'TG3 §2 signed part compare: 0xFFFF (−1) clears the bit': r => toggleRun('document', [0xffff, 4], 1, { reading: r }),
  'WP1 §3.3 goAway + zoom + collapse box: zoom ∩ close drops collapse, then zoom (document, Tw 36 / 40)': r => [24, 28].map(cw => { const g = geo({ C: [100, 60, 100 + cw, 200] }, r); return [g.T[2] - g.T[0], g.shown, g.R - g.T[0]]; }),
  'WP3 §3.3 no goAway, zoom + collapse box: only collapse ∩ close, zoom never dropped (Tw 36 / 40)': r => [24, 28].map(cw => { const g = geo({ goAway: false, C: [100, 60, 100 + cw, 200] }, r); return [g.T[2] - g.T[0], g.shown, g.R - g.T[0]]; }),
  'WP4 §3.3 no goAway, no zoom: nothing dropped (Tw 30)': r => { const g = geo({ goAway: false, variation: 0, C: [100, 60, 118, 200] }, r); return [g.T[2] - g.T[0], g.shown]; },
  'CT1 §3.5 entry n at position n when its value is n (also when a later entry repeats n)': r => [ctEntry([{ value: 0, rgb: A }, { value: 1, rgb: B }, { value: 2, rgb: Cc }], 1, { reading: r }).rgb,
    ctEntry([{ value: 0, rgb: A }, { value: 1, rgb: B }, { value: 1, rgb: Cc }], 1, { reading: r }).rgb],
  'CT2 §3.5 last value 0: position n': r => [ctEntry([{ value: 3, rgb: A }, { value: 2, rgb: B }, { value: 0, rgb: Cc }], 1, { reading: r }).rgb],
  'CT3 §3.5 search from the last entry down; none → position 0 (value-0 entry at position 1 read there)': r => [
    ctEntry([{ value: 5, rgb: A }, { value: 0, rgb: B }, { value: 7, rgb: Cc }], 0, { reading: r }).rgb,
    ctEntry([{ value: 1, rgb: A }, { value: 9, rgb: B }, { value: 1, rgb: Cc }], 1, { reading: r }).rgb,
    ctEntry([{ value: 4, rgb: A }, { value: 5, rgb: B }], 1, { reading: r }).rgb],
  'CT4 §3.5 stored RGB16 compared exactly (one unit in one channel differs)': r => [ctEqual([0xffff, 0xffff, 0xffff], [0xffff, 0xffff, 0xffff], { reading: r }), ctEqual([0xffff, 0xffff, 0xffff], [0xffff, 0xffff, 0xfffe], { reading: r }), ctEqual([0x1234, 0, 0], [0x12ff, 0, 0], { reading: r })],
  'CT5 §3.5 corpus: the positions CT1–CT3 read in actb -14336 (entry 0) and clut -14336/-14335 (entries 1, 5, 6)': r => perScheme(slug => {
    const pos = (type, id, n) => { const t = ctab(res(slug, type, id).data); return t.indexOf(ctEntry(t, n, { reading: r })); };
    return [pos('actb', -14336, 0), ...[1, 5, 6].map(n => pos('clut', -14336, n)), ...[1, 5, 6].map(n => pos('clut', -14335, n))]; }),
  'GB1 §6.4/GB3/GB3a which copies use the mask (8-bit source, mask clear)': r => Object.fromEntries(Object.keys(DECODE.copyModes).map(use => [use, copyPixel(use, { depth: 8, under: 'u', src: 's', mask: false }, { reading: r })])),
  'GB2 §6.4 GB3a: a 1-bit cicn always goes through its mask': r => ['documentCorners', 'utilityStripes', 'documentGrow'].map(use => [copyPixel(use, { depth: 1, under: 'u', src: 's', mask: false }, { reading: r }), copyPixel(use, { depth: 1, under: 'u', src: 's', mask: true }, { reading: r })]),
  'GB4 §6.4 GB4–GL4 procedural kind-5 grow box (grow (288, 188, 305, 205)), by state and clut presence': r => [
    kind5GrowOps([288, 188, 305, 205], true, () => true, { reading: r }), kind5GrowOps([288, 188, 305, 205], false, () => true, { reading: r }), kind5GrowOps([288, 188, 305, 205], true, () => false, { reading: r })],
  // ---- utility: inputs, geometry, drops (§9.1–§9.3)
  'UI1 §9.1 UI1–UI6 flags (hilited false; then variation 1 hilited)': r => [[0, false], [1, false], [3, false], [5, false], [9, false], [17, false], [31, false], [1, true]].map(([variation, hilited]) => {
    const f = utilityInputs({ variation, hilited }, { reading: r }); return [variation, hilited, ['alwaysActive', 'grow', 'zoom', 'side', 'smallGrow', 'active'].filter(k => f[k]).join(' ')]; }),
  'UI10 §9.1 H: 13 side, else 15 titled, 13 untitled': r => [[1, 'x'], [1, ''], [9, 'x'], [9, '']].map(([variation, title]) => utilityInputs({ variation, title }, { reading: r }).H),
  'UG1 §9.2 UG1–UG3 T, structure, content (titled, untitled, side, collapsed, collapsed side)': r => [UT, UN, US_, UCOL, UCOLS].map(o => { const g = ug(o, r); return { T: g.T, structure: g.structure, content: g.content }; }),
  'UG2 §9.2 public-type frame insets [l, t, r, b] and structure size, 160 × 90 content': r => UTILITY_TYPES.map(t => { const p = utilityPlan(t, undefined, { reading: r }); return [t.slug, p.insets, p.size]; }),
  'UG3 §9.2 UG4/UG10 grow rect and content minus grow (grow; smallGrow + grow; smallGrow only)': r => [3, 19, 17].map(variation => { const g = ug({ variation }, r); return [g.grow, g.contentMinusGrow]; }),
  'UG4 §9.2 UG5–UG9 boxes and limits': r => [UT, { variation: 7 }, UN, US_, { goAway: false, shadeOn: false }].map(o => { const g = ug(o, r); return { close: g.close, zoom: g.zoom, collapse: g.collapse, shown: g.shown, Lu: g.Lu, Ru: g.Ru }; }),
  'UP1 §9.3 goAway + zoom: 7-px outsets; recomputed zoom not outset (Tw 49, 48, 31, 30; then shadeOn off at Tw 37)': r => [[41, true], [40, true], [23, true], [22, true], [29, false]].map(([cw, shadeOn]) => {
    const g = ug({ variation: 7, shadeOn, C: [100, 60, 100 + cw, 150] }, r); return [cw + 8, g.shown, g.zoom[0] - g.T[0]]; }),
  'UP2 §9.3 goAway, no zoom: k⁺ ∩ c⁺ clears shadeOn (Tw 38, 37)': r => [30, 29].map(cw => [cw + 8, ug({ C: [100, 60, 100 + cw, 150] }, r).shown]),
  'UP3 §9.3 no goAway, zoom + shadeOn: k⁺ ∩ c⁺ clears shadeOn, zoom kept (Tw 38, 37); UP4 nothing (Tw 20)': r => [[30, 7], [29, 7], [12, 3]].map(([cw, variation]) => [cw + 8, ug({ variation, goAway: false, C: [100, 60, 100 + cw, 150] }, r).shown]),
  // ---- utility frame (§9.4)
  'UFA1 §9.4 UFA1 frame cicn by orientation and state (corpus)': r => perScheme(slug => perState(hl => [1, 9].map(variation => utilityFrameArt({ variation, hilited: hl }, uhas(slug), { reading: r })))),
  'UFA2 §9.4 UFA2/UFA3 absent cicns (synthetic presence)': r => [['-14316'], ['-14320'], [], ['-14315', '-14320']].map(ids => {
    const h = (type, id) => type === 'cicn' && ids.includes(String(id)); return [[1, true], [1, false], [9, false]].map(([variation, hilited]) => utilityFrameArt({ variation, hilited }, h, { reading: r })); }),
  'UFC1 §9.4 UFC1–UFC6 collapsed frame ops (horizontal titled, side)': r => [UCOL, UCOLS].map(o => utilityFrameOps(ug(o, r), { reading: r })),
  'UFH1 §9.4 UFH1–UFH12 horizontal frame ops (titled)': r => utilityFrameOps(ug(UT, r), { reading: r }),
  'UFS1 §9.4 UFS1–UFS12 side frame ops': r => utilityFrameOps(ug(US_, r), { reading: r }),
  'UFT1 §9.4 UFT1 sample points; UFT2 small grow in the tail (expanded and collapsed); UFT3 shadow (untitled)': r => [
    ug(UT, r), ug(US_, r)].map(g => utilityFrameOps(g, { reading: r }).find(o => o[0] === 'sample')[1]).concat([
    utilityFrameOps(ug({ variation: 19 }, r), { reading: r }).filter(o => o[0] === 'smallGrow'), utilityFrameOps(ug({ variation: 19, collapsed: true }, r), { reading: r }).filter(o => o[0] === 'smallGrow'),
    utilityFrameOps(ug(UN, r), { reading: r }).slice(-2)]),
  'UFT2 §9.4 UFT1 corpus colours and §9.6.1 UT7 passes (fill / text / shadow, shadow pass)': r => perScheme(slug => perState(hl => [1, 9].map(variation => {
    const id = utilityFrameArt({ variation, hilited: hl }, uhas(slug), { reading: r }), g = ug({ variation, hilited: hl, title: 'x' }, r);
    const s = utilityFrameOps(g, { reading: r }).find(o => o[0] === 'sample')[1], c = { fill: P(slug, id, s.fill), text: P(slug, id, s.text), shadow: P(slug, id, s.shadow) };
    return `${c.fill}/${c.text}/${c.shadow} ${utilityTitleOps(ug({ variation: 1, hilited: hl }, r), { ...TEXT, colours: c }, { reading: r }).filter(o => o[0] === 'text').length}`; }))),
  // ---- stripes, title, interior, grow, widgets, hits (§9.5–§9.9)
  'US1 §9.5 US1–US6 band, art, tiles (horizontal titled, side; inactive)': r => perScheme(slug => [UT, US_, { hilited: false }].map(o => {
    const s = utilityStripes(ug(o, r), uhas(slug), usize(slug), { reading: r }); return s && { band: s.band, art: s.art, tiles: s.ops.length, first: s.ops[0], last: s.ops.at(-1) }; })),
  'US2 §9.5 US4 narrow band painted with the fill (length 3), tiled at 4': r => [5, 6].map(cw => utilityStripes(NARROW(cw, r), (t, id) => t === 'cicn' && id === -14314, () => [9, 9], { reading: r }).ops.map(o => o.slice(0, 2))),
  'UT1 §9.6.1 UT1 title rect (fits; condensed; condensed at Lu; side; width 0)': r => [[40, 36, UT], [150, 140, UT], [150, 120, UT], [160, 158, UT], [40, 36, US_], [0, 0, UT]].map(([width, condensedWidth, o]) => utilityTitleRect(ug(o, r), { width, condensedWidth }, { reading: r })),
  'UT2 §9.6.1 UT2–UT8 title ops (fits; condensed + truncated; UT2 skip; empty title)': r => [
    utilityTitleOps(ug(UT, r), TEXT, { reading: r }), utilityTitleOps(ug(UT, r), { ...TEXT, width: 150, condensedWidth: 140 }, { reading: r }),
    utilityTitleOps(utilityGeometry(uw({ shadeOn: false, C: [100, 60, 112, 150] }), { reading: r }), { ...TEXT, width: 10, condensedWidth: 8 }, { reading: r }),
    utilityTitleOps(ug(UT, r), { ...TEXT, title: '' }, { reading: r })],
  'UT3 §9.6.1 UT7 shadow pass compares shadow with the fill (shadow = fill; shadow = text)': r => [{ fill: 'f', text: 't', shadow: 'f' }, { fill: 'f', text: 't', shadow: 't' }].map(colours => utilityTitleOps(ug(UT, r), { ...TEXT, colours }, { reading: r }).filter(o => o[0] === 'text').map(o => o[2])),
  'UW1 §9.6 UW1–UW5 step order and fill region (active, inactive, side)': r => [UT, { hilited: false }, US_].map(o => utilityDrawOrder(ug(o, r), uhas('black-platinum'), usize('black-platinum'), TEXT, { reading: r })),
  'UGB1 §9.7 UGB1–UGB2 grow art (corpus, by state; normal and small)': r => perScheme(slug => perState(hl => [3, 19].map(variation => utilityGrowArt(ug({ variation, hilited: hl }, r), uhas(slug), usize(slug), { reading: r })))),
  'UGB2 §9.7 UGB1 small grow cicn when present (synthetic -14285 12 × 12)': r => utilityGrowArt(ug({ variation: 19 }, r), (t, id) => t === 'cicn' && (id === -14285 || id === -14313), id => (id === -14285 ? [12, 12] : [16, 16]), { reading: r }),
  'UM1 §9.8 UM1–UM2 utility parts and the shared bit (258 does not flip)': r => [true, false].map(hilited => toggleRun('utility', [0, 4, 4, 5, 9, 258, 4], 1, { reading: r, hilited })),
  'UM2 §9.6 UW4 / §9.8 UM3 widget plots of a full draw (titled, zoom, side; inactive)': r => [UT, { variation: 7 }, US_, { hilited: false }].map(o => utilityWidgets(ug(o, r), { reading: r })),
  'UM3 §9.8 UM4 message 6 (grow; collapsed; no grow; invisible)': r => [[{}, {}], [{ collapsed: true }, {}], [{ variation: 1 }, {}], [{}, { visible: false }]].map(([o, w]) => utilityMessage6(ug(o, r), w)),
  'UH1 §9.9 UH1–UH8 hit codes (variation 7, active; inactive; atZoom)': r => [true, false].map(hilited => { const g = ug({ variation: 7, hilited }, r);
    return U_HIT_POINTS.map(p => utilityHit(g, { hilited }, p, { reading: r })); }).concat([[utilityHit(ug({ variation: 7 }, r), {}, [246, 52], { reading: r, atZoom: true })]]),
};
// variation 7 (grow + zoom), titled: zoom (241, 47, 251, 57), grow (246, 136, 262, 152), box (96, 44, 264, 154), inner (102, 50, 258, 148).
const U_HIT_POINTS = [
  [95, 100],   // outside → 0
  [264, 44],   // bounding-box corner, in neither rect → 0
  [264, 100],  // shadow column: not grow (y < 136), not content, not T, not the drag box (x = box.r) → 1
  [150, 100],  // content → 1
  [250, 140],  // grow ∩ content → 3 / 1 (inactive: UH2 needs active)
  [263, 153],  // grow extended into the frame → 3 / 2 (band)
  [97, 100],   // left band → 2
  [150, 47],   // bar between the boxes → 2
  [99, 48],    // close box inset 1 → 4 / 2
  [98, 47],    // close box corner, outside the inset → 2 (spec §12 UH4 hook)
  [246, 52],   // zoom box inset → 6 / 2
  [257, 52],   // collapse box inset → 9 / 2
];
const fiveU = v => Object.fromEntries(SCHEMES.map(s => [s, v]));
const ln = (pts, P) => ['line', pts, P];
const U_EXPECTED = {
  // TG1: part 0 clears (TG1) and draws the frame; the bit is clear → pressed -14333, flip → 1 → normal -14336, flip → 0. Hilite does not gate (TG2).
  'TG1 §2 a part-0 draw clears the bit; then two part-4 calls draw pressed, then normal': [{ drawn: ['frame', -14333, -14336], bit: 0 }, { drawn: ['frame', -14333, -14336], bit: 0 }],
  // bit 1: 5 normal -14334 → 0; 6 pressed -14331 → 1; 9 normal -14335 → 0; 258 nothing, flips → 1; 4 normal -14336 → 0; 1 clears, nothing.
  'TG2 §2 parts 4, 5/6, 9 by the bit; 258 flips, 258 and 1 draw nothing (document)': { drawn: [-14334, -14331, -14335, null, -14336, null], bit: 0 },
  'TG3 §2 signed part compare: 0xFFFF (−1) clears the bit': { drawn: [null, -14333], bit: 1 },
  // Document T width = content + 12. Close (T.l + 4 .. + 20). Shifted zoom at T.r − 33 meets close when Tw < 53; at T.r − 17 when Tw < 37.
  // Tw 36: collapse dropped, zoom dropped; R = (T.r − 17) − 4 = Tw − 21 = 15 (bit 3 still set). Tw 40: collapse dropped, zoom kept; R = 19.
  'WP1 §3.3 goAway + zoom + collapse box: zoom ∩ close drops collapse, then zoom (document, Tw 36 / 40)': [[36, { close: true, zoom: false, collapse: false }, 15], [40, { close: true, zoom: true, collapse: false }, 19]],
  // Collapse (T.r − 17) meets close when Tw < 37. Tw 36: collapse dropped, zoom kept at T.r − 17 → R = 15. Tw 40: nothing dropped; zoom at T.r − 33 → R = 3.
  'WP3 §3.3 no goAway, zoom + collapse box: only collapse ∩ close, zoom never dropped (Tw 36 / 40)': [[36, { close: false, zoom: true, collapse: false }, 15], [40, { close: false, zoom: true, collapse: true }, 3]],
  'WP4 §3.3 no goAway, no zoom: nothing dropped (Tw 30)': [30, { close: false, zoom: false, collapse: true }],
  'CT1 §3.5 entry n at position n when its value is n (also when a later entry repeats n)': [B, B],
  'CT2 §3.5 last value 0: position n': [B],
  // value 0 sits at position 1 (7 ≠ 0 last, so CT3 searches down: 7, then 0 at position 1); duplicates: the last match; none: position 0.
  'CT3 §3.5 search from the last entry down; none → position 0 (value-0 entry at position 1 read there)': [B, Cc, A],
  'CT4 §3.5 stored RGB16 compared exactly (one unit in one channel differs)': [true, false, false],
  // Archive facts: every corpus actb/clut has value = position, so CT1 reads position n.
  'CT5 §3.5 corpus: the positions CT1–CT3 read in actb -14336 (entry 0) and clut -14336/-14335 (entries 1, 5, 6)': fiveU([0, 1, 5, 6, 1, 5, 6]),
  'GB1 §6.4/GB3/GB3a which copies use the mask (8-bit source, mask clear)': { documentGrow: 'u', kind5Grow: 'u', utilityCorners: 'u', utilityGrow: 'u', documentCorners: 's', titleCorners: 's', ringCorners: 's', utilityStripes: 's' },
  'GB2 §6.4 GB3a: a 1-bit cicn always goes through its mask': [['u', 's'], ['u', 's'], ['u', 's']],
  // l 288, t 188, r 305, b 205. GL2 k = 3, 7, 11: (r − 4, t + k) → (l + k, b − 4) → (l + k − 1, b − 4); GL3 k = 2, 6, 10: (r − 4, t + k) → (r − 5, t + k) → (l + k, b − 5).
  'GB4 §6.4 GB4–GL4 procedural kind-5 grow box (grow (288, 188, 305, 205)), by state and clut presence': [
    [['region', [[303, 188], [301, 188], [288, 201], [288, 203], [303, 203], [303, 188]]], ['clut', -14336], ['erase', 1],
      ['line', 6, [[301, 191], [291, 201], [290, 201]]], ['line', 6, [[301, 195], [295, 201], [294, 201]]], ['line', 6, [[301, 199], [299, 201], [298, 201]]],
      ['line', 5, [[301, 190], [300, 190], [290, 200]]], ['line', 5, [[301, 194], [300, 194], [294, 200]]], ['line', 5, [[301, 198], [300, 198], [298, 200]]]],
    [['region', [[303, 188], [301, 188], [288, 201], [288, 203], [303, 203], [303, 188]]], ['clut', -14335], ['erase', 1]],
    [['region', [[303, 188], [301, 188], [288, 201], [288, 203], [303, 203], [303, 188]]]]],
  'UI1 §9.1 UI1–UI6 flags (hilited false; then variation 1 hilited)': [[0, false, 'alwaysActive active'], [1, false, ''], [3, false, 'grow'], [5, false, 'zoom'], [9, false, 'side'], [17, false, 'smallGrow'],
    [31, false, 'grow zoom side smallGrow'], [1, true, 'active']],
  'UI10 §9.1 H: 13 side, else 15 titled, 13 untitled': [15, 13, 13, 13],
  'UG1 §9.2 UG1–UG3 T, structure, content (titled, untitled, side, collapsed, collapsed side)': [
    { T: [96, 44, 264, 60], structure: [[96, 44, 264, 154], [98, 46, 265, 155]], content: UC },
    { T: [96, 46, 264, 60], structure: [[96, 46, 264, 154], [98, 48, 265, 155]], content: UC },
    { T: [86, 56, 100, 154], structure: [[86, 56, 264, 154], [88, 58, 265, 155]], content: UC },
    { T: [96, 44, 264, 60], structure: [[96, 44, 264, 60], [98, 46, 265, 61]], content: [100, 60, 260, 60] },
    { T: [86, 56, 100, 154], structure: [[86, 56, 100, 154], [88, 58, 101, 155]], content: [100, 60, 100, 150] }],
  // Insets = content edge − structure bounding box: horizontal 4 / H + 1 / 4 + 1 / 4 + 1; side H + 1 / 4 / 5 / 5;
  // collapsed: the 1-px shadow beyond T on the far edge. These equal the round-2 measured insets of IMPL-REVIEW-421.
  'UG2 §9.2 public-type frame insets [l, t, r, b] and structure size, 160 × 90 content': [
    ['titled-utility-window', [4, 16, 5, 5], [169, 111]], ['collapsed-titled-utility-window', [4, 16, 5, 1], [169, 17]],
    ['side-floating-utility-window', [14, 4, 5, 5], [179, 99]], ['collapsed-side-floating-utility-window', [14, 4, 1, 5], [15, 99]],
    ['no-title-utility-window', [4, 14, 5, 5], [169, 109]]],
  // 16 × 16 at (C.r − 14, C.b − 14); small 12 × 12 at (C.r − 10, C.b − 10); content minus grow only with smallGrow and grow.
  'UG3 §9.2 UG4/UG10 grow rect and content minus grow (grow; smallGrow + grow; smallGrow only)': [[[246, 136, 262, 152], null], [[250, 140, 262, 152], [250, 140, 262, 152]], [[250, 140, 262, 152], null]],
  'UG4 §9.2 UG5–UG9 boxes and limits': [
    { close: [98, 47, 108, 57], zoom: [241, 47, 251, 57], collapse: [252, 47, 262, 57], shown: { close: true, zoom: false, collapse: true }, Lu: 110, Ru: 250 },
    { close: [98, 47, 108, 57], zoom: [241, 47, 251, 57], collapse: [252, 47, 262, 57], shown: { close: true, zoom: true, collapse: true }, Lu: 110, Ru: 239 },
    { close: [98, 48, 108, 58], zoom: [241, 48, 251, 58], collapse: [252, 48, 262, 58], shown: { close: true, zoom: false, collapse: true }, Lu: 110, Ru: 250 },
    // side: no goAway → Lu = T.t + 5 = 61; Ru = collapse.t − 2 = 140.
    { close: [88, 58, 98, 68], zoom: [88, 131, 98, 141], collapse: [88, 142, 98, 152], shown: { close: false, zoom: false, collapse: true }, Lu: 61, Ru: 140 },
    // no goAway, no shadeOn: zoom box unshifted; Lu = T.l + 5 = 101, Ru = T.r − 5 = 259.
    { close: [98, 47, 108, 57], zoom: [252, 47, 262, 57], collapse: [252, 47, 262, 57], shown: { close: false, zoom: false, collapse: false }, Lu: 101, Ru: 259 }],
  // c⁺ = (T.l − 5 .. T.l + 19). Shifted z⁺ = (T.r − 30 .. T.r − 6) meets it when Tw < 49; the recomputed zoom (T.r − 12 .. T.r − 2), not
  // outset, when Tw < 31. Without shadeOn the zoom starts unshifted: z⁺ (T.r − 19 ..) meets c⁺ when Tw < 38 (Tw 37: zoom kept).
  'UP1 §9.3 goAway + zoom: 7-px outsets; recomputed zoom not outset (Tw 49, 48, 31, 30; then shadeOn off at Tw 37)': [
    [49, { close: true, zoom: true, collapse: true }, 26], [48, { close: true, zoom: true, collapse: false }, 36], [31, { close: true, zoom: true, collapse: false }, 19],
    [30, { close: true, zoom: false, collapse: false }, 18], [37, { close: true, zoom: true, collapse: false }, 25]],
  // k⁺ = (T.r − 19 .. T.r + 5) meets c⁺ when Tw < 38.
  'UP2 §9.3 goAway, no zoom: k⁺ ∩ c⁺ clears shadeOn (Tw 38, 37)': [[38, { close: true, zoom: false, collapse: true }], [37, { close: true, zoom: false, collapse: false }]],
  'UP3 §9.3 no goAway, zoom + shadeOn: k⁺ ∩ c⁺ clears shadeOn, zoom kept (Tw 38, 37); UP4 nothing (Tw 20)': [[38, { close: false, zoom: true, collapse: true }], [37, { close: false, zoom: true, collapse: false }],
    [20, { close: false, zoom: false, collapse: true }]],
  'UFA1 §9.4 UFA1 frame cicn by orientation and state (corpus)': fiveU({ active: [-14316, -14315], inactive: [-14320, -14319] }),
  // Present: only active horizontal → inactive falls back (UFA2), side absent (UFA3 null); only inactive → active absent → null; none → null.
  'UFA2 §9.4 UFA2/UFA3 absent cicns (synthetic presence)': [[-14316, -14316, null], [null, -14320, null], [null, null, null], [null, -14320, -14315]],
  // Collapsed horizontal F = (96, 44, 264, 60); side F = (86, 56, 100, 154).
  'UFC1 §9.4 UFC1–UFC6 collapsed frame ops (horizontal titled, side)': [
    [['copy', [96, 44, 98, 46], [0, 0, 2, 2]], ['copy', [262, 44, 264, 46], [10, 0, 12, 2]], ['copy', [96, 58, 98, 60], [0, 10, 2, 12]], ['copy', [262, 58, 264, 60], [10, 10, 12, 12]],
      ...[0, 1].flatMap(i => [ln([96 + i, 46, 96 + i, 57], [i, 6]), ln([263 - i, 46, 263 - i, 57], [11 - i, 6]), ln([98, 44 + i, 261, 44 + i], [6, i]), ln([98, 59 - i, 261, 59 - i], [6, 11 - i])]),
      ['interior', [98, 46, 262, 58]], ['sample', { fill: [4, 3], text: [5, 3], shadow: [7, 3] }], ln([98, 60, 264, 60], [0, 0]), ln([264, 60, 264, 46], [0, 0])],
    [['copy', [86, 56, 88, 58], [0, 0, 2, 2]], ['copy', [98, 56, 100, 58], [10, 0, 12, 2]], ['copy', [86, 152, 88, 154], [0, 10, 2, 12]], ['copy', [98, 152, 100, 154], [10, 10, 12, 12]],
      ...[0, 1].flatMap(i => [ln([86 + i, 58, 86 + i, 151], [i, 6]), ln([99 - i, 58, 99 - i, 151], [11 - i, 6]), ln([88, 56 + i, 97, 56 + i], [6, i]), ln([88, 153 - i, 97, 153 - i], [6, 11 - i])]),
      ['interior', [88, 58, 98, 152]], ['sample', { fill: [3, 4], text: [3, 5], shadow: [3, 7] }], ln([88, 154, 100, 154], [0, 0]), ln([100, 154, 100, 58], [0, 0])]],
  // F = (96, 44, 264, 154), C = (100, 60, 260, 150): Fr − 4 = 260, Fl + 4 = 100, Fr − 5 = 259, Fb − 5 = 149.
  'UFH1 §9.4 UFH1–UFH12 horizontal frame ops (titled)': [
    ['copy', [96, 44, 99, 47], [0, 0, 3, 3]], ['copy', [261, 44, 264, 47], [9, 0, 12, 3]], ['copy', [96, 150, 100, 154], [0, 8, 4, 12]], ['copy', [260, 150, 264, 154], [8, 8, 12, 12]],
    ['copy', [98, 57, 100, 60], [2, 3, 4, 6]], ['copy', [260, 57, 262, 60], [8, 3, 10, 6]],
    ...[0, 1, 2].map(i => ln([98, 44 + i, 260, 44 + i], [4, i])), ...[0, 1, 2, 3].map(i => ln([100, 153 - i, 259, 153 - i], [4, 11 - i])),
    ...[0, 1, 2, 3].flatMap(i => [ln([96 + i, i < 2 ? 46 : 60, 96 + i, 149], [i, 6]), ln([263 - i, i < 2 ? 46 : 60, 263 - i, 149], [11 - i, 6])]),
    ...[0, 1, 2].map(i => ln([100, 59 - i, 259, 59 - i], [4, 5 - i])),
    ['interior', [98, 47, 262, 57]], ['sample', { fill: [4, 3], text: [5, 3], shadow: [7, 3] }], ln([98, 154, 264, 154], [0, 0]), ln([264, 154, 264, 46], [0, 0])],
  // F = (86, 56, 264, 154), C = (100, 60, 260, 150): Fb − 4 = 150, Ft + 4 = 60, Fb − 5 = 149, Fr − 5 = 259.
  'UFS1 §9.4 UFS1–UFS12 side frame ops': [
    ['copy', [86, 56, 89, 59], [0, 0, 3, 3]], ['copy', [86, 151, 89, 154], [0, 9, 3, 12]], ['copy', [260, 56, 264, 60], [8, 0, 12, 4]], ['copy', [260, 150, 264, 154], [8, 8, 12, 12]],
    ['copy', [97, 58, 100, 60], [3, 2, 6, 4]], ['copy', [97, 150, 100, 152], [3, 8, 6, 10]],
    ...[0, 1, 2].map(i => ln([86 + i, 58, 86 + i, 150], [i, 4])), ...[0, 1, 2, 3].map(i => ln([263 - i, 60, 263 - i, 149], [11 - i, 4])),
    ...[0, 1, 2, 3].flatMap(i => [ln([i < 2 ? 88 : 100, 56 + i, 259, 56 + i], [6, i]), ln([i < 2 ? 88 : 100, 153 - i, 259, 153 - i], [6, 11 - i])]),
    ...[0, 1, 2].map(i => ln([99 - i, 60, 99 - i, 149], [5 - i, 4])),
    ['interior', [89, 58, 97, 152]], ['sample', { fill: [3, 4], text: [3, 5], shadow: [3, 7] }], ln([88, 154, 264, 154], [0, 0]), ln([264, 154, 264, 58], [0, 0])],
  // UFT2 has no collapsed condition in the spec (the runtime's skip is declared policy). Untitled F = (96, 46, 264, 154): shadow column to Ft + 2 = 48.
  'UFT1 §9.4 UFT1 sample points; UFT2 small grow in the tail (expanded and collapsed); UFT3 shadow (untitled)': [
    { fill: [4, 3], text: [5, 3], shadow: [7, 3] }, { fill: [3, 4], text: [3, 5], shadow: [3, 7] },
    [['smallGrow', [250, 140, 262, 152]]], [['smallGrow', [250, 140, 262, 152]]], [ln([98, 154, 264, 154], [0, 0]), ln([264, 154, 264, 48], [0, 0])]],
  // Archive facts: raw RGB16 of Q at the UFT1 points, [horizontal, side]; then the number of text passes. Every corpus
  // utility shadow sample equals its fill, so UT7 never draws the shadow pass (under the document rule, shadow ≠ text, it would).
  'UFT2 §9.4 UFT1 corpus colours and §9.6.1 UT7 passes (fill / text / shadow, shadow pass)': (() => {
    const c = (fill, text) => `${fill}/${text}/${fill} 1`, both = (fill, text) => [c(fill, text), c(fill, text)];
    return {
      'apple-platinum-2': a(both(K.c, K.a), both(K.c, K.a)),
      'black-platinum': a(both('318c318c318c', K.w), both('529452945294', '212121212121')),
      'platinum-8': a([c(K.c, '444444444444'), c(K.c, K.a)], both(K.d, K.f7)),
      slimes: a(both('6666cccc0000', '222222222222'), both('ccccffff6666', K.f7)),
      'system7-nostalgia-silver': a(both(K.e, K.a), both(K.e, K.f7)),
    }; })(),
  // Band: titled rows T.t + trunc((16 − 8) / 2) = 48 .. 57, columns Lu 110 .. Ru 250: 9-px tiles at 110 + 9k, k = 0..15.
  // Side: columns T.l + trunc((14 − 8) / 2) = 89 .. 98, rows Lu 61 .. Ru 140: tiles at 61 + 9k, k = 0..8. Inactive: none.
  'US1 §9.5 US1–US6 band, art, tiles (horizontal titled, side; inactive)': perScheme(slug => {
    const side = slug === 'apple-platinum-2' ? -14314 : -14318;   // US3: apple-platinum-2 ships no cicn -14318
    return [{ band: [110, 48, 250, 57], art: -14314, tiles: 16, first: ['tile', -14314, [110, 48, 119, 57], [0, 0, 9, 9]], last: ['tile', -14314, [245, 48, 254, 57], [0, 0, 9, 9]] },
      { band: [89, 61, 98, 140], art: side, tiles: 9, first: ['tile', side, [89, 61, 98, 70], [0, 0, 9, 9]], last: ['tile', side, [89, 133, 98, 142], [0, 0, 9, 9]] }, null]; }),
  // No goAway, no shadeOn: Lu = T.l + 5, Ru = T.r − 5, length = content + 8 − 10: 3 → paint; 4 → one tile.
  'US2 §9.5 US4 narrow band painted with the fill (length 3), tiled at 4': [[['paint', [101, 48, 104, 57]]], [['tile', -14314]]],
  // T.w 168. w 40: left 96 + 64 = 160. w 150: 96 + 9 = 105 < Lu → condensed 140: 96 + 14 = 110; 120: 120; 158: 101 → Lu 110.
  'UT1 §9.6.1 UT1 title rect (fits; condensed; condensed at Lu; side; width 0)': [[160, 47, 200, 57], [110, 47, 250, 57], [120, 47, 240, 57], [110, 47, 268, 57], null, null],
  // r = rect with bottom + 1 = (160, 47, 200, 58), h 11. y = 47 + trunc((11 − 1 − 12) / 2) + 10 = 56. Erase widened by 2; clip (Lu, r.t, Ru, r.b).
  // Condensed: r.w 140 < bold 150 → TruncString to Ru − r.l = 140. Skip: T (96 .. 116), Lu 110, Ru 111, rect left 110: 112 > 111.
  'UT2 §9.6.1 UT2–UT8 title ops (fits; condensed + truncated; UT2 skip; empty title)': [
    [['clip', [110, 47, 250, 58]], ['erase', [158, 47, 202, 58], 'fill'], ['remove', [158, 47, 202, 58]], ['text', [161, 57], 'shadow'], ['text', [160, 56], 'text']],
    [['condense', 140], ['clip', [110, 47, 250, 58]], ['erase', [108, 47, 252, 58], 'fill'], ['remove', [110, 47, 250, 58]], ['text', [111, 57], 'shadow'], ['text', [110, 56], 'text']],
    [], []],
  'UT3 §9.6.1 UT7 shadow pass compares shadow with the fill (shadow = fill; shadow = text)': [['text'], ['shadow', 'text']],
  'UW1 §9.6 UW1–UW5 step order and fill region (active, inactive, side)': [
    { steps: ['frame', 'stripes', 'title', 'close', 'collapse', 'fill'], fill: { interior: [98, 47, 262, 57], minus: [[110, 48, 250, 57], [158, 47, 202, 58], [98, 47, 108, 57], [252, 47, 262, 57]] } },
    { steps: ['frame', 'title', 'fill'], fill: { interior: [98, 47, 262, 57], minus: [[158, 47, 202, 58]] } },
    { steps: ['frame', 'stripes', 'collapse', 'fill'], fill: { interior: [89, 58, 97, 152], minus: [[89, 61, 98, 140], [88, 142, 98, 152]] } }],
  // Archive facts: -14313/-14317 are 16 × 16 except system7 (17 × 17); no -14285/-14286. Small: trunc(16 · 11 / 15) = 11, trunc(17 · 11 / 15) = 12.
  'UGB1 §9.7 UGB1–UGB2 grow art (corpus, by state; normal and small)': perScheme(slug => { const n = slug === 'system7-nostalgia-silver' ? 17 : 16, s = slug === 'system7-nostalgia-silver' ? 12 : 11;
    return perState(hl => [[hl ? -14313 : -14317, [n, n], [246, 136]], [hl ? -14313 : -14317, [s, s], [250, 140]]]); }),
  'UGB2 §9.7 UGB1 small grow cicn when present (synthetic -14285 12 × 12)': [-14285, [12, 12], [250, 140]],
  // bit 1: 0 clears, frame; 4 pressed -14317 → 1; 4 normal -14320 → 0; 5 pressed -14315 → 1; 9 normal -14319 → 0; 258 nothing, no flip; 4 pressed → 1.
  'UM1 §9.8 UM1–UM2 utility parts and the shared bit (258 does not flip)': [{ drawn: ['frame', -14317, -14320, -14315, -14319, null, -14317], bit: 1 }, { drawn: ['frame', -14317, -14320, -14315, -14319, null, -14317], bit: 1 }],
  'UM2 §9.6 UW4 / §9.8 UM3 widget plots of a full draw (titled, zoom, side; inactive)': [
    [['close', -14320, [98, 47, 114, 63]], ['collapse', -14319, [252, 47, 268, 63]]],
    [['close', -14320, [98, 47, 114, 63]], ['zoom', -14318, [241, 47, 257, 63]], ['collapse', -14319, [252, 47, 268, 63]]],
    [['collapse', -14319, [88, 142, 104, 158]]], []],
  'UM3 §9.8 UM4 message 6 (grow; collapsed; no grow; invisible)': [true, false, false, false],
  'UH1 §9.9 UH1–UH8 hit codes (variation 7, active; inactive; atZoom)': [[0, 0, 1, 1, 3, 3, 2, 2, 4, 2, 6, 9], [0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2], [5]],
};

test('rev 3: every utility and shared rule row equals the spec value under the decode', () => {
  assert.deepEqual(Object.keys(U_ROWS).sort(), Object.keys(U_EXPECTED).sort());
  for (const [id, row] of Object.entries(U_ROWS)) assert.deepEqual(row({}), U_EXPECTED[id], id);
});

test('rev 3 corpus: the utility resources each archive ships (§8, §9.4–§9.8)', () => {
  for (const slug of SCHEMES) {
    const h = has(slug);
    for (const id of [-14316, -14320, -14315, -14319]) assert.deepEqual(usize(slug)(id), [12, 12], `${slug} cicn ${id} 12 × 12`);
    assert.deepEqual(usize(slug)(-14314), [9, 9], `${slug} -14314`);
    assert.equal(h('cicn', -14318), slug !== 'apple-platinum-2', `${slug} -14318`);
    for (const id of [-14313, -14317]) assert.deepEqual(usize(slug)(id), slug === 'system7-nostalgia-silver' ? [17, 17] : [16, 16], `${slug} ${id}`);
    for (const id of [-14285, -14286]) assert.ok(!h('cicn', id), `${slug} cicn ${id} absent`);
    for (const id of [-14320, -14319, -14318]) assert.ok(h('ics#', id) && h('ics8', id), `${slug} normal glyph ${id}`);
    // Pressed glyphs: slimes ships none (UM3 parts 4/5/6/9 draw nothing there, §6.1 'required').
    for (const id of [-14317, -14316, -14315]) assert.equal(h('ics#', id), slug !== 'slimes', `${slug} pressed ics# ${id}`);
    // Every utility frame, utility grow and document grow cicn mask is all ones (GB3 masked = opaque on this corpus).
    for (const id of [-14316, -14320, -14315, -14319, -14313, -14317, -14330, -14334]) assert.ok(cicn(slug, id).maskAlpha.every(v => v === 255), `${slug} ${id} mask all ones`);
  }
  // apple-platinum-2: the active and inactive utility frames are pixel-identical (state non-discriminating).
  const same12 = (slug, x, y) => Array.from({ length: 144 }, (_, i) => [i % 12, Math.trunc(i / 12)]).every(p => P(slug, x, p) === P(slug, y, p));
  assert.ok(same12('apple-platinum-2', -14316, -14320) && same12('apple-platinum-2', -14315, -14319));
  for (const slug of SCHEMES.filter(s => s !== 'apple-platinum-2')) assert.ok(!same12(slug, -14316, -14320) && !same12(slug, -14315, -14319), slug);
  // The excluded type is a real public type (#423) and the binding drives the other five.
  assert.equal(UTILITY_EXCLUDED.issue, 423);
  assert.deepEqual(UTILITY_TYPES.map(t => t.slug), ['titled-utility-window', 'collapsed-titled-utility-window', 'side-floating-utility-window', 'collapsed-side-floating-utility-window', 'no-title-utility-window']);
});

test('rev 3 binding plan: every browser probe lies on the frame op the spec names, outside the interior', () => {
  for (const t of UTILITY_TYPES) {
    const plan = utilityPlan(t);
    for (const p of plan.probes) {
      assert.ok(p.src, `${t.slug} ${p.name}: on a frame line`);
      assert.equal(p.inInterior, false, `${t.slug} ${p.name}: outside the interior`);
      const [group] = p.name.split(' '), i = Number(p.name.at(-1));
      // The probe's sample point is the one its rule names (P(4, i), P(i, 6), …; UFT3 P(0, 0)).
      const want = { UFH7: [4, i], UFH8: [4, 11 - i], UFH9: [i, 6], UFH10: [11 - i, 6], UFH11: [4, 5 - i], UFS7: [i, 4], UFS8: [11 - i, 4], UFS9: [6, i], UFS10: [6, 11 - i],
        UFS11: [5 - i, 4], UFC2: [i, 6], UFC3: [11 - i, 6], UFC4: [6, i], UFC5: [6, 11 - i], UFT3: [0, 0] }[group];
      assert.deepEqual(p.src, want, `${t.slug} ${p.name}`);
    }
    assert.ok(plan.probes.filter(p => p.activeSafe).length >= 7, t.slug);
    // Every stripes-window pixel lies in the interior (US2 clip) …
    for (const k of plan.stripes.across) for (const x of plan.stripes.along) assert.ok(t.side ? k >= plan.interior[0] && k < plan.interior[2] && x >= plan.interior[1] && x < plan.interior[3]
      : x >= plan.interior[0] && x < plan.interior[2] && k >= plan.interior[1] && k < plan.interior[3], `${t.slug} stripes (${k}, ${x})`);
    // … and inside [Lu, Ru) for every goAway / zoom / shadeOn combination.
    for (const variation of [1, 5].map(v => v | (t.side ? 8 : 0))) for (const goAway of [true, false]) for (const shadeOn of [true, false]) {
      const g = utilityGeometry({ variation, C: plan.C, hilited: true, goAway, shadeOn, collapsed: t.collapsed, title: t.titled ? 'x' : '' });
      assert.ok(plan.stripes.along[0] >= g.Lu && plan.stripes.along.at(-1) < g.Ru, `${t.slug} ${variation}/${goAway}/${shadeOn}`);
    }
  }
});

// Plausible wrong readings of rev 3, each a model override (utility readings under `utility`).
const u = utility => ({ utility });
const U_MUTATIONS = {
  'TG1 no clear for part 0': { toggle: { ...DECODE.toggle, clearBelow: 0 } },
  'TG1 unsigned part compare': { toggle: { ...DECODE.toggle, signed: false } },
  'TG2 pressed when the bit is set': { toggle: { ...DECODE.toggle, pressedWhenClear: false } },
  'TG2 widget parts gated on hilited': { toggle: { ...DECODE.toggle, gatedOnHilite: true } },
  'TG3 part 258 does not flip (document)': { toggle: { ...DECODE.toggle, flipParts: [4, 5, 6, 9] } },
  'WP1/WP2 applied without goAway (the #412 reading)': { dropsIgnoreGoAway: true },
  'WP1 drops zoom without re-testing it at T.r − 17': { wp1Recheck: false },
  'CT1–CT3 entry n read by position': { ctLookup: (e, n) => e[n] },
  'CT1–CT3 one-based positions': { ctLookup: (e, n) => e[n + 1] ?? e[0] },
  'CT1 skipped (search only)': { ctLookup: (e, n) => { const last = e.length - 1; if (e[last].value === 0) return e[n]; for (let i = last; i >= 0; i--) if (e[i].value === n) return e[i]; return e[0]; } },
  'CT2 skipped': { ctLookup: (e, n) => { const last = e.length - 1; if (n <= last && e[n].value === n) return e[n]; for (let i = last; i >= 0; i--) if (e[i].value === n) return e[i]; return e[0]; } },
  'CT3 search from position 0 up': { ctLookup: (e, n) => { const last = e.length - 1; if (n <= last && e[n].value === n) return e[n]; if (e[last].value === 0) return e[n]; return e.find(x => x.value === n) ?? e[0]; } },
  'CT4 high bytes only': { ctEqual: (x, y) => x.every((c, i) => c >> 8 === y[i] >> 8) },
  'GB1 grow cicn copied opaque': { copyModes: { ...DECODE.copyModes, documentGrow: 'opaque', utilityGrow: 'opaque' } },
  'GB3a stripes copied through the mask at every depth': { copyModes: { ...DECODE.copyModes, utilityStripes: 'masked' } },
  'GB3a 1-bit cicn copied opaque': { oneBitMasked: false },
  'GB5 kind-5 clut states swapped': { kind5Clut: { true: -14335, false: -14336 } },
  'GL2 light lines in entry 5': { gripLight: 5 },
  'UI1 alwaysActive when bit 0 set': u({ bits: { ...UDECODE.bits, alwaysActiveClear: 0 } }),
  'UI2/UI3 grow and zoom bits swapped': u({ bits: { ...UDECODE.bits, grow: 4, zoom: 2 } }),
  'UI6 active = hilited only': u({ activeRule: hl => hl }),
  'UI10 H always 15 when not side': u({ barHeight: ({ side }) => (side ? 13 : 15) }),
  'UI10 side H 15 when titled': u({ barHeight: ({ titled }) => (titled ? 15 : 13) }),
  'UG2 structure raised by H − 2': u({ raise: H => H - 2 }),
  'UG2 outset 5': u({ outset: 5 }),
  'UG5 box offset without + 1 (trunc((t − 10) / 2))': u({ boxOffset: t => Math.trunc((t - 10) / 2) }),
  'UG5 box top T.t + 3 for every bar': u({ boxOffset: () => 3 }),
  'UG6 collapse at T.r − 11': u({ collapseInset: 11 }),
  'UG7 zoom shift 10': u({ zoomShift: 10 }),
  'UG8/UG9 limit gap 3': u({ limitGap: 3 }),
  'UG10 normal grow 15 × 15 inside': u({ grow: { ...UDECODE.grow, normal: 15 } }),
  'UP no 7-px outset': u({ dropOutset: 0 }),
  'UP1 recomputed zoom also outset': u({ recomputedZoomOutset: 7 }),
  'UP3 drops zoom too': u({ up3DropsZoom: true }),
  'UFA1 states swapped': u({ frameCicn: { horizontal: { true: -14320, false: -14316 }, side: { true: -14319, false: -14315 } } }),
  'UFA1 side uses the horizontal ids': u({ frameCicn: { horizontal: UDECODE.frameCicn.horizontal, side: UDECODE.frameCicn.horizontal } }),
  'UFA2 no inactive fallback': u({ inactiveFallback: false }),
  'UFT1 document sample points (6, 3) / (7, 3) / (9, 3)': u({ samples: { ...UDECODE.samples, horizontal: { fill: [6, 3], text: [7, 3], shadow: [9, 3] } } }),
  'UFT1 side samples untransposed': u({ samples: { ...UDECODE.samples, side: UDECODE.samples.horizontal } }),
  'UFT2 skipped when collapsed (runtime declared policy)': u({ collapsedSkipsSmallGrow: true }),
  'UFT3 drop shadow from P(11, 11)': u({ drop: [11, 11] }),
  'US1 band offset trunc((t − 6) / 2)': u({ bandOffset: t => Math.trunc((t - 6) / 2) }),
  'US1 band 8 rows': u({ stripeExtent: 8 }),
  'US3 side stripes from -14314 only': u({ stripeIds: { ...UDECODE.stripeIds, side: [-14314] } }),
  'US4 narrow threshold 5': u({ stripeNarrow: 5 }),
  'UW2 stripes when inactive': u({ stripesWhenInactive: true }),
  'UW4 widgets when inactive': u({ widgetsWhenInactive: true }),
  'UW3 title on side windows': u({ titleOnSide: true }),
  'UT1 vertical inset 2': u({ titleInset: 2 }),
  'UT5 erase widened by 3': u({ eraseWiden: 3 }),
  'UT6 baseline without − 1': u({ baseline: (r, asc, d) => r[1] + Math.trunc((r[3] - r[1] - (asc + d)) / 2) + asc }),
  'UT6 document pen x + 3': u({ penDx: 3 }),
  'UT7 shadow pass when shadow ≠ text (document rule)': u({ shadowPass: (shadow, text) => JSON.stringify(shadow) !== JSON.stringify(text) }),
  'UT2 skip pad 1': u({ titleSkip: 1 }),
  'UGB1 small grow cicn never tried': u({ smallGrowCicn: false }),
  'UGB2 ids swapped by state': u({ growCicn: { ...UDECODE.growCicn, normal: { true: -14317, false: -14313 } } }),
  'UGB2 small crop scaled 12/16': u({ smallCrop: n => Math.trunc((n * 12) / 16) }),
  'UM2 part 258 flips (utility)': u({ flipParts: [4, 5, 6, 9, 258] }),
  'UM3 zoom and collapse ids swapped': u({ widgetIds: { close: [-14320, -14317], zoom: [-14319, -14316], collapse: [-14318, -14315] } }),
  'UH4 widget hit on the full 10 × 10 box': u({ hitInset: 0 }),
  'UH4–UH6 widget hits when inactive': u({ hitGateActive: false }),
  'UH7 drag band 4': u({ dragBand: 4 }),
};
const U_PER_SCHEME = id => /^(CT5|UFA1|UFT2|US1|UGB1) /.test(id);
const uCells = (id, value) => !U_PER_SCHEME(id) ? [['all', value]]
  : SCHEMES.flatMap(s => (value[s] && 'active' in value[s] ? Object.keys(STATES).map(st => [`${s}/${st}`, value[s][st]]) : [[s, value[s]]]));
const U_VALUES = Object.fromEntries(Object.keys(U_ROWS).map(id => [id, uCells(id, U_EXPECTED[id])]));
function uMutationTable() {
  return Object.fromEntries(Object.entries(U_MUTATIONS).map(([name, reading]) => {
    const fails = {};
    for (const [id, row] of Object.entries(U_ROWS)) {
      let value; try { value = row(reading); } catch { fails[id.split(' ')[0]] = 'throws'; continue; }
      const got = uCells(id, value), want = U_VALUES[id];
      const bad = want.filter(([k, v], i) => !sameJson(got[i]?.[1], v) || got[i][0] !== k).map(([k]) => k);
      if (bad.length) fails[id.split(' ')[0]] = bad.length === want.length ? 'all' : bad;
    }
    return [name, fails];
  }));
}

test('rev 3 mutation table: each wrong reading fails the named rows; every row and cell can fail', () => {
  const table = Object.fromEntries(Object.entries(uMutationTable()).map(([m, f]) => [m, Object.fromEntries(Object.entries(f).map(([k, v]) => [k, short(v)]))]));
  // A list names the cells that see the mutation; the cells it omits cannot discriminate it (findings below).
  assert.deepEqual(table, {
    "TG1 no clear for part 0": {"TG1": "all", "UM1": "all"},
    "TG1 unsigned part compare": {"TG3": "all"},
    "TG2 pressed when the bit is set": {"TG1": "all", "TG2": "all", "TG3": "all", "UM1": "all"},
    "TG2 widget parts gated on hilited": {"TG1": "all", "UM1": "all"},
    "TG3 part 258 does not flip (document)": {"TG2": "all"},
    "WP1/WP2 applied without goAway (the #412 reading)": {"WP3": "all", "WP4": "all"},
    "WP1 drops zoom without re-testing it at T.r − 17": {"WP1": "all"},
    "CT1–CT3 entry n read by position": {"CT3": "all"},
    "CT1–CT3 one-based positions": {"CT1": "all", "CT2": "all", "CT5": "all"},
    "CT1 skipped (search only)": {"CT1": "all"},
    "CT2 skipped": {"CT2": "all"},
    "CT3 search from position 0 up": {"CT3": "all"},
    "CT4 high bytes only": {"CT4": "all"},
    "GB1 grow cicn copied opaque": {"GB1": "all"},
    "GB3a stripes copied through the mask at every depth": {"GB1": "all"},
    "GB3a 1-bit cicn copied opaque": {"GB2": "all"},
    "GB5 kind-5 clut states swapped": {"GB4": "all"},
    "GL2 light lines in entry 5": {"GB4": "all"},
    "UI1 alwaysActive when bit 0 set": {"UI1": "all", "UFA1": ["ap2/inactive", "bp/inactive", "p8/inactive", "slimes/inactive", "s7/inactive"], "UFA2": "all", "UFT2": ["bp/inactive", "p8/inactive", "slimes/inactive", "s7/inactive"], "US1": "all", "UW1": "all", "UGB1": ["ap2/inactive", "bp/inactive", "p8/inactive", "slimes/inactive", "s7/inactive"], "UM2": "all", "UH1": "all"},
    "UI2/UI3 grow and zoom bits swapped": {"UI1": "all", "UG3": "all", "UG4": "all", "UP2": "all", "UP3": "all", "UFT1": "all", "US1": "all", "US2": "all", "UT2": "all", "UW1": "all", "UM2": "all", "UM3": "all"},
    "UI6 active = hilited only": {"UI1": "all"},
    "UI10 H always 15 when not side": {"UI10": "all", "UG1": "all", "UG2": "all", "UG4": "all", "UFT1": "all"},
    "UI10 side H 15 when titled": {"UI10": "all"},
    "UG2 structure raised by H − 2": {"UG1": "all", "UG2": "all", "UFH1": "all", "UFS1": "all", "UFT1": "all", "UW1": "all"},
    "UG2 outset 5": {"UG1": "all", "UG2": "all", "UG4": "all", "UP1": "all", "UP2": "all", "UP3": "all", "UFC1": "all", "UFH1": "all", "UFS1": "all", "UFT1": "all", "US1": "all", "US2": "all", "UT1": "all", "UT2": "all", "UW1": "all", "UM2": "all", "UH1": "all"},
    "UG5 box offset without + 1 (trunc((t − 10) / 2))": {},
    "UG5 box top T.t + 3 for every bar": {"UG4": "all", "UW1": "all", "UM2": "all"},
    "UG6 collapse at T.r − 11": {"UG4": "all", "UP1": "all", "UP2": "all", "UP3": "all", "US1": "all", "UT2": "all", "UW1": "all", "UM2": "all"},
    "UG7 zoom shift 10": {"UG4": "all", "UP1": "all", "UM2": "all"},
    "UG8/UG9 limit gap 3": {"UG4": "all", "US1": "all", "UT1": "all", "UT2": "all", "UW1": "all"},
    "UG10 normal grow 15 × 15 inside": {"UG3": "all", "UGB1": "all"},
    "UP no 7-px outset": {"UP1": "all", "UP2": "all", "UP3": "all"},
    "UP1 recomputed zoom also outset": {"UP1": "all"},
    "UP3 drops zoom too": {"UP3": "all"},
    "UFA1 states swapped": {"UFA1": "all", "UFA2": "all", "UFT2": ["bp", "p8", "slimes", "s7"]},
    "UFA1 side uses the horizontal ids": {"UFA1": "all", "UFA2": "all", "UFT2": "all"},
    "UFA2 no inactive fallback": {"UFA2": "all"},
    "UFT1 document sample points (6, 3) / (7, 3) / (9, 3)": {"UFC1": "all", "UFH1": "all", "UFT1": "all", "UFT2": "all"},
    "UFT1 side samples untransposed": {"UFC1": "all", "UFS1": "all", "UFT1": "all", "UFT2": "all"},
    "UFT2 skipped when collapsed (runtime declared policy)": {"UFT1": "all"},
    "UFT3 drop shadow from P(11, 11)": {"UFC1": "all", "UFH1": "all", "UFS1": "all", "UFT1": "all"},
    "US1 band offset trunc((t − 6) / 2)": {"US1": "all", "US2": "all", "UW1": "all"},
    "US1 band 8 rows": {"US1": "all", "US2": "all", "UW1": "all"},
    "US3 side stripes from -14314 only": {"US1": ["bp", "p8", "slimes", "s7"]},
    "US4 narrow threshold 5": {"US2": "all"},
    "UW2 stripes when inactive": {"US1": "all", "UW1": "all"},
    "UW4 widgets when inactive": {"UW1": "all", "UM2": "all"},
    "UW3 title on side windows": {"UT1": "all", "UW1": "all"},
    "UT1 vertical inset 2": {"UT1": "all", "UT2": "all", "UW1": "all"},
    "UT5 erase widened by 3": {"UT2": "all", "UW1": "all"},
    "UT6 baseline without − 1": {"UT2": "all"},
    "UT6 document pen x + 3": {"UT2": "all"},
    "UT7 shadow pass when shadow ≠ text (document rule)": {"UFT2": "all", "UT3": "all"},
    "UT2 skip pad 1": {"UT2": "all"},
    "UGB1 small grow cicn never tried": {"UGB2": "all"},
    "UGB2 ids swapped by state": {"UGB1": "all"},
    "UGB2 small crop scaled 12/16": {"UGB1": ["ap2", "bp", "p8", "slimes"]},
    "UM2 part 258 flips (utility)": {"UM1": "all"},
    "UM3 zoom and collapse ids swapped": {"UM1": "all", "UM2": "all"},
    "UH4 widget hit on the full 10 × 10 box": {"UH1": "all"},
    "UH4–UH6 widget hits when inactive": {"UH1": "all"},
    "UH7 drag band 4": {},
  });
  const raw = uMutationTable(), blind = [];
  for (const id of Object.keys(U_ROWS)) {
    const key = id.split(' ')[0], seen = new Set();
    for (const f of Object.values(raw)) { const v = f[key]; if (v === 'all' || v === 'throws') U_VALUES[id].forEach(([c]) => seen.add(c)); else v?.forEach(c => seen.add(c)); }
    for (const [c] of U_VALUES[id]) if (!seen.has(c)) blind.push(`${key} ${c}`);
  }
  assert.deepEqual(blind, []);
  // Every rule group named by the task (spec rev 3) has a row that a mutation fails.
  const groups = ['TG', 'WP', 'CT', 'GB', 'UI', 'UG', 'UP', 'UFA', 'UFC', 'UFH', 'UFS', 'UFT', 'US', 'UW', 'UT', 'UGB', 'UM', 'UH'];
  const failing = new Set(Object.values(raw).flatMap(Object.keys));
  assert.deepEqual(groups.filter(g => ![...failing].some(k => k.replace(/[0-9]+$/, '') === g)), []);
});

test('rev 3 findings: readings the decode and corpus cannot tell apart (named, not dropped)', () => {
  const t = uMutationTable();
  // 1. UG5's "+ 1": trunc((t + 1 − 10) / 2) = trunc((t − 10) / 2) for both bar thicknesses that occur (t 16 and 14).
  assert.deepEqual(t['UG5 box offset without + 1 (trunc((t − 10) / 2))'], {});
  // 2. UH7's band width: the content (UH3) and T (+1 row) cover every point between a 4-px and a 6-px band.
  assert.deepEqual(t['UH7 drag band 4'], {});
  // 3. apple-platinum-2's active and inactive utility frames are pixel-identical: a state swap shows only as the id (UFA1).
  assert.ok(!t['UFA1 states swapped'].UFT2.includes('apple-platinum-2'));
  // 4. apple-platinum-2 ships no cicn -14318, so its side stripes already come from -14314 (US3).
  assert.ok(!t['US3 side stripes from -14314 only'].US1.includes('apple-platinum-2'));
  // 5. system7's 17 × 17 grow cicn crops to 12 × 12 under both 11/15 and 12/16.
  assert.ok(!t['UGB2 small crop scaled 12/16'].UGB1.includes('system7-nostalgia-silver'));
  // 6. Every corpus colour table has value = position, so CT1–CT3 cannot be told apart on the corpus (CT5);
  //    only the synthetic CT rows fail. Every corpus mask is all ones (corpus test), so GB3 = GB3a there.
  for (const m of ['CT1–CT3 entry n read by position', 'CT3 search from position 0 up', 'CT2 skipped']) assert.ok(!('CT5' in t[m]), m);
  // 7. Every corpus utility shadow sample equals its fill: UT7 never draws a shadow pass, and the document rule always would.
  assert.equal(t['UT7 shadow pass when shadow ≠ text (document rule)'].UFT2, 'all');
});
