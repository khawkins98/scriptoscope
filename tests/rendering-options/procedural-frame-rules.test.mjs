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
