import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { readCicnIndexed } from '../../tools/theme-loader/decoders/cicn.js';
import { realizeRgb16 } from '../../tools/theme-loader/display-profile.js';
import { parseResourceMap } from './checkable-rules.mjs';
import {
  DECODE, GATE4, ID, PROCEDURAL, PUBLIC_ROWS, SLUGS, STATE_HILITE, H, W, col1Entry, col2Sample, gate, getData, hitTest, idle, inProgressRange, layout,
  nativeFor, newRecord, progressCensus, rect, region, setData, sourceMap, synthetic,
} from './progress-rules.mjs';

// Rule rows of docs/spec/engine/progress.md (§4 decision tables, §5 geometry,
// §7 test hooks). Every expected literal is the spec's own number (worked
// examples A–E, the §7 table) or an archive fact read from the archive's own
// resource map; progress-rules.mjs transcribes the spec formulas. Nothing here
// reads runtime output (the runtime binding is progress-rules.spec.mjs).

const corpus = new Map();
for (const slug of SLUGS) {
  const bytes = readFileSync(['scheme.sit', 'scheme.rsrc'].map(f => new URL(`../../themes/${slug}/${f}`, import.meta.url)).find(existsSync));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  const map = parseResourceMap(fork);
  corpus.set(slug, { map, census: progressCensus(map), loaded: await loadKaleidoscopeScheme(bytes, { encodeAssets: false, provenance: true }) });
}
const census = slug => corpus.get(slug).census;
const masks = new Map();
const maskOf = slug => (id, x, y) => {
  const key = `${slug}/${id}`;
  if (!masks.has(key)) { const c = readCicnIndexed(corpus.get(slug).map.find(r => r.type === 'cicn' && r.id === id).data); masks.set(key, { w: c.pmap.width, h: c.pmap.height, a: c.maskAlpha }); }
  const m = masks.get(key); return x >= 0 && y >= 0 && x < m.w && y < m.h && m.a[y * m.w + x] !== 0;
};
const allSet = () => true;
const n = (o = {}) => ({ rect: rect(0, 0, 14, 100), hilite: 0, value: 50, min: 0, max: 100, indeterminate: false, phase: 0, ...o });
const at = (slug, native, r) => layout(native, census(slug), { reading: r });
const mapOf = (slug, native, r) => { const l = at(slug, native, r); return sourceMap(l, maskOf(slug), census(slug), { reading: r }); };
const pc = p => [p.kind, [p.dst.left, p.dst.right], [p.src.left, p.src.right]];
const pieceRects = p => [p.name, p.kind, [p.dst.top, p.dst.left, p.dst.bottom, p.dst.right], [p.src.top, p.src.left, p.src.bottom, p.src.right]];
const inside = (map, I, pred) => { let k = 0; for (let y = I.top; y < I.bottom; y++) for (let x = I.left; x < I.right; x++) if (pred(map[y][x])) k++; return k; };
// Example B (spec §5.7): 1984, R = (0, 0, 14, 40), max 10, value 3.
const B = n({ rect: rect(0, 0, 14, 40), max: 10, value: 3 });
// Synthetic forks (spec §7). Frame 5 × 14, cinf (2, 2, 0, 0); fill / track 7 × 10, cinf (3, 3, 0, 0).
const FR = { cinf: [2, 2, 0, 0], cicn: [5, 14] }, ART = { cinf: [3, 3, 0, 0], cicn: [7, 10] };
const fork = ids => synthetic({ cinf: Object.fromEntries(ids.filter(([, k]) => k.includes('f')).map(([id]) => [id, id === -10080 || id === -10077 ? FR.cinf : ART.cinf])),
  cicn: Object.fromEntries(ids.filter(([, k]) => k.includes('c')).map(([id]) => [id, id === -10080 || id === -10077 ? FR.cicn : ART.cicn])) });
const syn = (c, native, r) => layout(native, c, { reading: r });
const procMap = (slug, native, r) => mapOf(slug, native, r);

/** Named rule rows: id -> (reading) => observed value. EXPECTED pins each under the decode. Group = the id's leading letters. */
const ROWS = {
  'RECT1 R (0, 0, 20, 100) is drawn as (0, 0, 14, 100), I rows [2, 12) (1138)': r => { const l = at('1138', n({ rect: rect(0, 0, 20, 100) }), r); return [l.R, [l.I.top, l.I.bottom]]; },
  'GATE-path and frame id per archive (hilite 0 / 255)': r => Object.fromEntries(SLUGS.map(slug => [slug, [0, 255].map(hilite => { const g = gate({ hilite }, census(slug), { reading: r }); return `${g.path[0]}${g.F}`; })])),
  'GATE1 / GATE1a ids: 1984 inactive, apple-lisa inactive': r => ['1984', 'apple-lisa'].map(slug => { const l = at(slug, n({ hilite: 254 }), r); return [l.frame.id, l.fill.id, l.track.id]; }),
  'GATE1a no per-part fallback: inactive fork without cicn -10076 draws no fill': r => {
    const l = syn(fork([[-10080, 'fc'], [-10077, 'fc'], [-10079, 'fc'], [-10076, 'f'], [-10075, 'fc']]), n({ hilite: 254 }), r); return [l.frame.id, l.fill?.id ?? null, l.track?.id ?? null]; },
  'GATE2 / GATE3 synthetic forks: cicn -10080 without cinf; inactive cinf -10077 without cicn -10077': r => [
    syn(fork([[-10080, 'c'], [-10079, 'fc'], [-10078, 'fc']]), n(), r).path,
    syn(fork([[-10077, 'f'], [-10080, 'fc'], [-10079, 'fc'], [-10078, 'fc']]), n({ hilite: 254 }), r).path],
  'GATE4 frame only: frame drawn, no fill / track, never the procedural bar': r => { const l = syn(fork([[-10080, 'fc']]), n(), r); return [l.path, l.fill ?? null, l.track ?? null]; },
  'INSET1 / INSET2 synthetic k = 3, k = 1; windows-95 inactive s = 1': r => [
    syn(synthetic({ cinf: { [-10080]: [3, 2, 0, 0] }, cicn: { [-10080]: [5, 14] } }), n(), r).I.left,
    syn(synthetic({ cinf: { [-10080]: [1, 2, 0, 0] }, cicn: { [-10080]: [5, 14] } }), n(), r).I.left,
    at('windows-95', n({ hilite: 254 }), r).I],
  'DET1 split: example A x = 50, example B x = 12': r => [at('1138', n(), r).x, at('1984', B, r).x],
  'DET2 min = max = 5, value 5: x = I.left': r => at('1138', n({ min: 5, max: 5, value: 5 }), r).x,
  'DET3 no clamp: value -10 track starts at -7; value 150 fill ends at 146 (1138)': r => [at('1138', n({ value: -10 }), r).track.T.left, at('1138', n({ value: 150 }), r).fill.T.right],
  'DET4 empty or inverted fill / track rects copy nothing (1138 value -10 / 150)': r => [at('1138', n({ value: -10 }), r).fill.pieces.length, at('1138', n({ value: 150 }), r).track.pieces.length],
  'SLICE1 fill cicn without its cinf draws no fill (synthetic)': r => { const l = syn(fork([[-10080, 'fc'], [-10079, 'c'], [-10078, 'fc']]), n(), r); return [l.fill?.id ?? null, l.track?.id ?? null]; },
  'SLICE2 windows-31 fill (14 rows) keeps its height, centred: rows [0, 14)': r => [...new Set(at('windows-31', n(), r).fill.pieces.map(p => `${p.dst.top},${p.dst.bottom}`))],
  'SLICE3-SLICE5 example B fill halves and track caps + one-column middle (1984)': r => { const l = at('1984', B, r); return [l.fill.pieces.map(pc), l.track.pieces.map(pc)]; },
  'SLICE3 odd-length halves: 1984 fill at x = 11 (1 of 4, length 40), L = 9': r => at('1984', n({ rect: rect(0, 0, 14, 40), max: 4, value: 1 }), r).fill.pieces.map(pc),
  'SLICE4/SLICE5 example A fill and track (1138)': r => { const l = at('1138', n(), r); return [l.fill.pieces.map(pc), l.track.pieces.map(pc)]; },
  'SLICE6 crayon-os fill (byte 2 = 1): the whole middle tiled': r => at('crayon-os', n(), r).fill.pieces.map(pc),
  'SLICE7 1990 fill (byte 3 = 4) at L = 29: tiles from the end': r => at('1990', n({ max: 96, value: 29 }), r).fill.pieces.map(pc),
  'FRAME3-FRAME5 example A frame pieces in order (1138)': r => at('1138', n(), r).frame.pieces.map(pieceRects),
  'FRAME5 1984 top band (tile = 0): source [2, 3) x [0, 2) as lines over [2, 98)': r => at('1984', n(), r).frame.pieces.filter(p => p.name === 'top').map(pieceRects),
  'FRAME6 crayon-os top band (tile = 1): tiles [2, 68) and [68, 98), the second from [2, 32)': r => at('crayon-os', n(), r).frame.pieces.filter(p => p.name === 'top').map(pieceRects),
  'FRAME8 no body: 1990 indeterminate (IND6) leaves all of I transparent': r => { const m = mapOf('1990', n({ indeterminate: true }), r); return inside(m, rect(2, 2, 12, 98), v => v !== null); },
  'BLIT1 masked frame band: a mask-clear band source pixel leaves row 0 transparent over [2, 98) (synthetic)': r => {
    const c = synthetic({ cinf: { [-10080]: [2, 2, 0, 0] }, cicn: { [-10080]: [5, 14] } }), l = syn(c, n(), r);
    const m = sourceMap(l, (id, x, y) => !(x === 2 && y === 0), c, { reading: r }); return inside(m, rect(0, 2, 1, 98), v => v === null); },
  'BLIT3/BLIT4 one-column and one-row sources become lines (example A bands)': r => at('1138', n(), r).frame.pieces.filter(p => !['TL', 'TR', 'BL', 'BR'].includes(p.name)).map(p => p.kind),
  'ERASE2/ERASE3 procedural corner pixels (0, 13) and (99, 0) stay transparent (example E)': r => { const m = procMap('platinum-8', n({ value: 25 }), r); return [m[13][0], m[0][99]]; },
  'ERASE1 no erase, no body: a frame-only fork leaves all of I transparent (synthetic)': r => { const c = fork([[-10080, 'fc']]), l = syn(c, n(), r), m = sourceMap(l, allSet, c, { reading: r }); return inside(m, l.I, v => v !== null); },
  'ERASE4 crayon-os indeterminate phase 3: every pixel of I opaque (pattern)': r => { const m = mapOf('crayon-os', n({ indeterminate: true, phase: 3 }), r); return inside(m, rect(2, 2, 12, 98), v => v === null); },
  'COL1 lookup: table values (0, 2, 2), pixel 2 -> entry 2; (0, 1, 1), pixel 1 -> entry 1': r => [col1Entry([{ value: 0 }, { value: 2 }, { value: 2 }], 2, { reading: r }), col1Entry([{ value: 0 }, { value: 1 }, { value: 1 }], 1, { reading: r })],
  'COL2 an FB sample on a mask-clear pixel still gives its colour': r => col2Sample('pixel', false, { reading: r }),
  'COL3/COL4 FB7 colours after the display policy': r => { const c = { ...DECODE.col3, ...(r.col3 ?? {}) }; return [realizeRgb16(c.dark), realizeRgb16(c.lavender)]; },
  'CINF2 frame bytes (k, s, tile) per GATE4 archive, active / inactive': r => Object.fromEntries(GATE4.map(slug => [slug, [0, 254].map(hilite => { const f = at(slug, n({ hilite }), r).frame; return [f.c, f.s, f.tile].join(''); })])),
  'CINF3 a 2-byte frame cinf is treated as missing (procedural bar)': r => syn(synthetic({ cinf: { [-10080]: [2, 2] }, cicn: { [-10080]: [5, 14] } }), n(), r).path,
  'DATA1-DATA3 inde round trip; another tag -30581': r => { const rec = newRecord(); return [setData(rec, 'inde', [1], { reading: r }), getData(rec, 'inde', { reading: r }), setData(rec, 'abcd', [0], { reading: r }), rec.indeterminate, getData(rec, 'abcd', { reading: r }).result]; },
  'DATA-IDLE1-IDLE4 idle at t + 2 / t + 3; a determinate idle; setData keeps the phase': r => {
    const rec = { ...newRecord(), indeterminate: 1, idleTime: 100 }, out = [idle(rec, 102, { reading: r }), rec.phase, idle(rec, 103, { reading: r }), rec.phase, rec.idleTime];
    const det = { ...newRecord(), idleTime: 0 }; out.push(idle(det, 200, { reading: r }), det.phase);
    setData(rec, 'inde', [0]); out.push(rec.phase); const wrap = { ...newRecord(), indeterminate: 1, phase: 255 }; idle(wrap, 3, { reading: r }); out.push(wrap.phase); return out; },
  'DATA-HIT1/HIT2 part 0 everywhere; region = R (14 rows)': r => { const l = at('1138', n({ rect: rect(0, 0, 20, 100) }), r); return [hitTest(l, { h: 30, v: 5 }, { reading: r }), region(l)]; },
  'IND2/IND3 1138 phases 0, 1, 2, 3, 4, 9 and 1984 phase 8: pattern id and phase after': r => [...[0, 1, 2, 3, 4, 9].map(phase => ['1138', phase]), ['1984', 8]].map(([slug, phase]) => {
    const l = at(slug, n({ indeterminate: true, phase }), r); return [l.pattern?.id ?? null, l.phaseAfter]; }),
  'IND1 probe F_p + 1: a fork with ppat -10080 and -10078 (no -10079) is in shift mode at phase 2': r => {
    const c = synthetic({ cinf: { [-10080]: [2, 2, 0, 0] }, cicn: { [-10080]: [5, 14] }, ppat: { [-10080]: [16, 16], [-10078]: [16, 16] } }), l = syn(c, n({ indeterminate: true, phase: 2 }), r);
    return [l.patternMode, l.pattern.id, l.pattern.point]; },
  'IND4/IND5 phase points: 1138 phase 2; crayon-os phase 3, 9; apple-lisa phase 1': r => [['1138', 2], ['crayon-os', 3], ['crayon-os', 9], ['apple-lisa', 1]].map(([slug, phase]) => {
    const l = at(slug, n({ indeterminate: true, phase }), r); return [l.pattern.id, l.pattern.point.x, l.pattern.point.y, l.phaseAfter]; }),
  'IND-Fp inactive: crayon-os phase 3, 1138 phase 2, apple-lisa (GATE1a) phase 1': r => [['crayon-os', 3], ['1138', 2], ['apple-lisa', 1]].map(([slug, phase]) => at(slug, n({ hilite: 255, indeterminate: true, phase }), r).pattern.id),
  'IND6 1990 / dolphin-som / evolution indeterminate: no pattern, I keeps its prior (transparent) pixels': r => ['1990', 'dolphin-som', 'evolution'].map(slug => {
    const nat = n({ indeterminate: true, phase: 1 }), l = at(slug, nat, r); return [l.pattern, inside(mapOf(slug, nat, r), l.I, v => v !== null)]; }),
  'PAT1-§5.5 crayon-os phase 3: pattern pixels at port (2, 2) and (60, 5)': r => { const m = mapOf('crayon-os', n({ indeterminate: true, phase: 3 }), r); return [m[2][2], m[5][60]]; },
  'FB1-FB6 example E line and ring sources (platinum-8)': r => { const m = procMap('platinum-8', n({ value: 25 }), r); return [m[13][1], m[13][99], m[5][99], m[5][0], m[0][50], m[0][98], m[1][50], m[12][50], m[5][1], m[5][98]]; },
  'FB4 no cicn -10224: no lines, the FrameRect black (synthetic)': r => { const c = synthetic(), l = syn(c, n(), r), m = sourceMap(l, allSet, c, { reading: r }); return [m[0][50], m[1][50], m[13][50], m[5][1]]; },
  'FB7 example E split 26: dark grey [2, 26), lavender [26, 98); example B geometry split 12': r => { const m = procMap('platinum-8', n({ value: 25 }), r);
    return [at('platinum-8', n({ value: 25 }), r).procedural.xf, m[5][2], m[5][25], m[5][26], m[5][97], at('platinum-8', B, r).procedural.xf]; },
  'FB8 platinum-8 indeterminate phase 3: ppat -10064 at (14, 2)': r => at('platinum-8', n({ indeterminate: true, phase: 3 }), r).procedural.pattern,
  'FB9 monkey-paradise indeterminate: nothing in I_f, the step unspecified': r => { const l = at('monkey-paradise', n({ indeterminate: true }), r), m = procMap('monkey-paradise', n({ indeterminate: true }), r);
    return [l.procedural.unspecified, inside(m, l.procedural.If, v => v !== null)]; },
  'FB10 platinum-8 inactive and disabled equal active, pixel for pixel': r => [254, 255].map(hilite => JSON.stringify(procMap('platinum-8', n({ hilite }), r)) === JSON.stringify(procMap('platinum-8', n(), r))),
};
const groupOf = id => id.match(/^[A-Z]+/)[0];

const PROC_GATE = Object.fromEntries(SLUGS.map(slug => [slug, GATE4.includes(slug) ? ['k-10080', slug === 'apple-lisa' ? 'k-10080' : 'k-10077'] : ['p-10080', 'p-10080']]));
const fbs = (x, y) => ({ t: 'cicn', id: -10224, x, y });
const EXPECTED = {
  'RECT1 R (0, 0, 20, 100) is drawn as (0, 0, 14, 100), I rows [2, 12) (1138)': [rect(0, 0, 14, 100), [2, 12]],
  'GATE-path and frame id per archive (hilite 0 / 255)': PROC_GATE,
  'GATE1 / GATE1a ids: 1984 inactive, apple-lisa inactive': [[-10077, -10076, -10075], [-10080, -10079, -10078]],
  'GATE1a no per-part fallback: inactive fork without cicn -10076 draws no fill': [-10077, null, -10075],
  'GATE2 / GATE3 synthetic forks: cicn -10080 without cinf; inactive cinf -10077 without cicn -10077': ['procedural', 'procedural'],
  'GATE4 frame only: frame drawn, no fill / track, never the procedural bar': ['kaleidoscope', null, null],
  'INSET1 / INSET2 synthetic k = 3, k = 1; windows-95 inactive s = 1': [3, 2, rect(1, 2, 13, 98)],
  'DET1 split: example A x = 50, example B x = 12': [50, 12],
  'DET2 min = max = 5, value 5: x = I.left': 2,
  'DET3 no clamp: value -10 track starts at -7; value 150 fill ends at 146 (1138)': [-7, 146],
  'DET4 empty or inverted fill / track rects copy nothing (1138 value -10 / 150)': [0, 0],
  'SLICE1 fill cicn without its cinf draws no fill (synthetic)': [null, -10078],
  'SLICE2 windows-31 fill (14 rows) keeps its height, centred: rows [0, 14)': ['0,14'],
  'SLICE3-SLICE5 example B fill halves and track caps + one-column middle (1984)': [[['copy', [2, 7], [0, 5]], ['copy', [7, 12], [13, 18]]],
    [['copy', [12, 21], [0, 9]], ['copy', [29, 38], [9, 18]], ['hlines', [21, 29], [9, 10]]]],
  'SLICE3 odd-length halves: 1984 fill at x = 11 (1 of 4, length 40), L = 9': [['copy', [2, 7], [0, 5]], ['copy', [7, 11], [14, 18]]],
  'SLICE4/SLICE5 example A fill and track (1138)': [[['copy', [2, 5], [0, 3]], ['copy', [47, 50], [4, 7]], ['hlines', [5, 47], [3, 4]]],
    [['copy', [50, 53], [0, 3]], ['copy', [95, 98], [4, 7]], ['hlines', [53, 95], [3, 4]]]],
  'SLICE6 crayon-os fill (byte 2 = 1): the whole middle tiled': [['copy', [2, 3], [0, 1]], ['copy', [49, 50], [65, 66]], ['copy', [3, 49], [1, 47]]],
  // 1990 fill -10079 is 14 × 10, cinf (4, 4, 1, 4): caps 4, middle [4, 10) tiled from 27 back to 6, the last tile cut to its trailing 3 columns.
  'SLICE7 1990 fill (byte 3 = 4) at L = 29: tiles from the end': [['copy', [2, 6], [0, 4]], ['copy', [27, 31], [10, 14]], ['copy', [21, 27], [4, 10]], ['copy', [15, 21], [4, 10]], ['copy', [9, 15], [4, 10]], ['copy', [6, 9], [7, 10]]],
  'FRAME3-FRAME5 example A frame pieces in order (1138)': [
    ['TL', 'copy', [0, 0, 2, 2], [0, 0, 2, 2]], ['TR', 'copy', [0, 98, 2, 100], [0, 3, 2, 5]], ['top', 'hlines', [0, 2, 2, 98], [0, 2, 2, 3]],
    ['BL', 'copy', [12, 0, 14, 2], [12, 0, 14, 2]], ['BR', 'copy', [12, 98, 14, 100], [12, 3, 14, 5]], ['bottom', 'hlines', [12, 2, 14, 98], [12, 2, 14, 3]],
    ['left', 'vlines', [2, 0, 12, 2], [2, 0, 3, 2]], ['right', 'vlines', [2, 98, 12, 100], [2, 3, 3, 5]]],
  'FRAME5 1984 top band (tile = 0): source [2, 3) x [0, 2) as lines over [2, 98)': [['top', 'hlines', [0, 2, 2, 98], [0, 2, 2, 3]]],
  'FRAME6 crayon-os top band (tile = 1): tiles [2, 68) and [68, 98), the second from [2, 32)': [['top', 'copy', [0, 2, 2, 68], [0, 2, 2, 68]], ['top', 'copy', [0, 68, 2, 98], [0, 2, 2, 32]]],
  'FRAME8 no body: 1990 indeterminate (IND6) leaves all of I transparent': 0,
  'BLIT1 masked frame band: a mask-clear band source pixel leaves row 0 transparent over [2, 98) (synthetic)': 96,
  'BLIT3/BLIT4 one-column and one-row sources become lines (example A bands)': ['hlines', 'hlines', 'vlines', 'vlines'],
  'ERASE2/ERASE3 procedural corner pixels (0, 13) and (99, 0) stay transparent (example E)': [null, null],
  'ERASE1 no erase, no body: a frame-only fork leaves all of I transparent (synthetic)': 0,
  'ERASE4 crayon-os indeterminate phase 3: every pixel of I opaque (pattern)': 0,
  'COL1 lookup: table values (0, 2, 2), pixel 2 -> entry 2; (0, 1, 1), pixel 1 -> entry 1': [2, 1],
  'COL2 an FB sample on a mask-clear pixel still gives its colour': 'pixel',
  'COL3/COL4 FB7 colours after the display policy': [[86, 86, 86], [212, 212, 255]],
  'CINF2 frame bytes (k, s, tile) per GATE4 archive, active / inactive': { 1138: ['220', '220'], 1984: ['220', '220'], 1990: ['221', '221'], 'apple-lisa': ['220', '220'], 'crayon-os': ['221', '221'],
    'dolphin-som': ['221', '221'], evolution: ['221', '221'], floppies: ['221', '221'], 'windows-31': ['220', '220'], 'windows-95': ['220', '210'] },
  'CINF3 a 2-byte frame cinf is treated as missing (procedural bar)': 'procedural',
  'DATA1-DATA3 inde round trip; another tag -30581': [0, { result: 0, size: 1, byte: 1 }, -30581, 1, -30581],
  'DATA-IDLE1-IDLE4 idle at t + 2 / t + 3; a determinate idle; setData keeps the phase': [1, 0, 2, 1, 103, 1, 0, 1, 0],
  'DATA-HIT1/HIT2 part 0 everywhere; region = R (14 rows)': [0, rect(0, 0, 14, 100)],
  'IND2/IND3 1138 phases 0, 1, 2, 3, 4, 9 and 1984 phase 8: pattern id and phase after': [[-10080, 0], [-10079, 1], [-10078, 2], [-10077, 3], [-10080, 0], [-10080, 0], [-10080, 0]],
  'IND1 probe F_p + 1: a fork with ppat -10080 and -10078 (no -10079) is in shift mode at phase 2': ['shift', -10080, { x: 10, y: 2 }],
  'IND4/IND5 phase points: 1138 phase 2; crayon-os phase 3, 9; apple-lisa phase 1': [[-10078, 2, 2, 2], [-10080, 14, 2, 3], [-10080, 38, 2, 9], [-10080, 6, 2, 1]],
  'IND-Fp inactive: crayon-os phase 3, 1138 phase 2, apple-lisa (GATE1a) phase 1': [-10072, -10070, -10080],
  'IND6 1990 / dolphin-som / evolution indeterminate: no pattern, I keeps its prior (transparent) pixels': [[null, 0], [null, 0], [null, 0]],
  'PAT1-§5.5 crayon-os phase 3: pattern pixels at port (2, 2) and (60, 5)': [{ t: 'ppat', id: -10080, x: 52, y: 0 }, { t: 'ppat', id: -10080, x: 46, y: 3 }],
  'FB1-FB6 example E line and ring sources (platinum-8)': [fbs(11, 13), fbs(11, 13), fbs(11, 13), fbs(0, 0), fbs(0, 0), fbs(0, 0), fbs(1, 1), fbs(1, 1), fbs(1, 1), fbs(1, 1)],
  'FB4 no cicn -10224: no lines, the FrameRect black (synthetic)': [null, { rgb: 'black' }, null, { rgb: 'black' }],
  'FB7 example E split 26: dark grey [2, 26), lavender [26, 98); example B geometry split 12': [26, { rgb: 'dark' }, { rgb: 'dark' }, { rgb: 'lavender' }, { rgb: 'lavender' }, 12],
  'FB8 platinum-8 indeterminate phase 3: ppat -10064 at (14, 2)': { id: -10064, point: { x: 14, y: 2 }, dst: rect(2, 2, 12, 98) },
  'FB9 monkey-paradise indeterminate: nothing in I_f, the step unspecified': [true, 0],
  'FB10 platinum-8 inactive and disabled equal active, pixel for pixel': [true, true],
};

// Plausible wrong readings (spec §7 "mutations that must fail", §8 runtime divergences), each a DECODE override.
const MUTATIONS = {
  'caller height kept (no RECT1)': { rect14: false },
  'inactive by hilite alone (no cinf -10077 check)': { inactiveNeedsCinf: false },
  'gate on the frame cicn': { gate: 'cicn' },
  'retry cicn -10080 after a missing cicn -10077': { retryActiveFrame: true },
  'per-part inactive -> active fallback (old runtime)': { perPartFallback: true },
  'procedural bar when the fill or track is missing': { gate4Declines: true },
  'inset by k always': { inset: k => k },
  'inset by 2 always': { inset: () => 2 },
  'inset by s horizontally': { inset: (k, s) => s },
  'split rounded': { split: (w, o, rg) => Math.round((w * o) / rg) },
  'split floored': { split: (w, o, rg) => Math.floor((w * o) / rg) },
  'value clamped to [min, max]': { clamp: true },
  'range 0 read as full': { rangeZero: 'full' },
  'fill / track drawn without their cinf': { sliceNeedsCinf: false },
  'art stretched to I': { artRows: 'stretch' },
  'art clipped to I': { artRows: 'clip' },
  'art top-aligned': { artRows: 'top' },
  'halves rule omitted': { halves: false },
  'second half 1 px wider (P5)': { secondHalf: L => Math.trunc((L + 1) / 2) },
  'cap clamped at 4 (old runtime)': { capClamp: 4 },
  'cap from cinf byte 1': { capByte: 1 },
  'one-column middle read as the full middle': { middleOneColumn: () => false },
  'full middle read as one column': { middleOneColumn: () => true },
  'middle stretched': { stretchMiddle: true },
  'tiles from the start when byte 3 ≠ 0': { endAnchor: () => false },
  'tiles from the end always': { endAnchor: () => true },
  'frame tile flag ignored (always lines)': { frameTileFlag: () => false },
  'tile = 0 band uses the whole middle': { frameBandWholeMiddle: true },
  'frame bands 9-slice stretched': { frameStretch: true },
  'frame centre cell drawn (legacy body)': { frameBody: true },
  'frame pieces in reading order (bands first)': { frameOrder: ['top', 'bottom', 'left', 'right', 'TL', 'TR', 'BL', 'BR'] },
  'frame k and s read swapped': { frameBytes: [1, 0, 2] },
  'cut tile keeps leading always': { cutKeeps: 'leading' },
  'unmasked (srcCopy) art': { masked: false },
  'R erased first': { erase: true },
  'IND6 paints I': { ind6Paint: true },
  'probe F_p': { probeOffset: 0 },
  'probe F_p + phase': { probeOffset: 'phase' },
  'phases 8..255 valid frames': { frameModeLimit: 256 },
  'phase not written back': { writeBack: false },
  'shift by phase, not 4·phase': { shiftStep: 1 },
  'phase reset in shift mode': { shiftResets: true },
  'inactive patterns from -10080': { inactivePatternBase: false },
  'truncating remainder for the pattern phase': { mod: (a, m) => a % m },
  'pattern not repeated over P': { patternTiled: false },
  'FB bottom/right sampled at (0, 0)': { fbSamples: { br: [0, 0], tl: [0, 0], ring: [1, 1] } },
  'FB bottom/right sampled at (11, 11) (pre-#443)': { fbSamples: { br: [11, 11], tl: [0, 0], ring: [1, 1] } },
  'FB bevel over the whole outer ring': { fbFullRing: true },
  'FB state-dependent (inactive lavender)': { fbStateDependent: true },
  'FB9 paints I_f lavender': { fb9Paint: true },
  'FB7 parts swapped (lavender filled part)': { fbParts: ['lavender', 'dark'] },
  'inverted rect sliced by its width magnitude': { invertedCopies: true },
  'FB colours swapped': { col3: { dark: [0xcccc, 0xcccc, 0xffff], lavender: [0x4445, 0x4444, 0x4444] } },
  'COL1 first-match lookup': { col1: 'firstMatch' },
  'COL2 sample honours the mask': { col2IgnoresMask: false },
  'short cinf zero-padded': { shortCinfMissing: false },
  'data access accepts any tag': { dataAnyTag: true },
  "idle '>' instead of '>='": { idleStrict: true },
  'idle advances a determinate bar': { idleAdvancesDeterminate: true },
  'hit test returns a part': { hitPart: 1 },
};

test('own resource-map census agrees with the loader over all 18 archives (input identity)', () => {
  const sha = b => createHash('sha256').update(b).digest('hex');
  for (const [slug, { map, census: c, loaded }] of corpus) {
    for (const type of ['cicn', 'cinf', 'ppat']) {
      const own = map.filter(r => r.type === type && inProgressRange(r.id)).map(r => [r.id, r.data.length, sha(r.data)]).sort((a, b) => a[0] - b[0]);
      const prov = loaded.byteProvenance.resources.filter(r => r.type === type && inProgressRange(r.signedId)).map(r => [r.signedId, r.byteLength, r.sha256]).sort((a, b) => a[0] - b[0]);
      assert.deepEqual(own, prov, `${slug} ${type} id -> bytes`);
    }
    for (const e of Object.values(loaded.manifest.chromeElements).filter(e => inProgressRange(e.sourceCicnId ?? 0))) {
      const b = c.cicn.get(e.sourceCicnId); assert.deepEqual([W(b), H(b)], [e.width, e.height], `${slug} ${e.sourceCicnId} bounds`);
    }
  }
});

test('corpus impact (spec §6 table): gate, frame cinf, art sizes, pattern modes, FB samples', () => {
  assert.deepEqual(SLUGS.filter(s => census(s).cinf.has(-10080) && census(s).cicn.has(-10080)), GATE4);
  assert.deepEqual(SLUGS.filter(s => !census(s).cinf.has(-10080)), PROCEDURAL);
  assert.deepEqual(PROCEDURAL.filter(s => !census(s).cicn.has(ID.fbCicn)), []);                                   // all ship cicn -10224
  assert.deepEqual(GATE4.filter(s => !census(s).cinf.has(-10077)), ['apple-lisa']);                               // GATE1a
  assert.deepEqual(SLUGS.filter(s => [-10080, -10077].some(F => census(s).cinf.has(F) && !census(s).cicn.has(F))), []);   // GATE3: none
  for (const s of SLUGS) for (const [id, b] of census(s).cinf) assert.equal(b.length, 18, `${s} cinf ${id} is 18 bytes`);
  for (const s of SLUGS) for (const [id, b] of census(s).cicn) assert.ok(b.top === 0 && b.left === 0, `${s} cicn ${id} bounds origin`);
  for (const s of GATE4) for (const F of [-10080, -10077]) if (census(s).cicn.has(F)) assert.equal(H(census(s).cicn.get(F)), 14, `${s} frame ${F} 14 rows`);
  const art = s => [-10079, -10078].map(id => { const b = census(s).cicn.get(id); return `${W(b)}x${H(b)}`; }).join('/');
  assert.deepEqual(Object.fromEntries(GATE4.map(s => [s, art(s)])), { 1138: '7x10/7x10', 1984: '18x10/18x10', 1990: '14x10/15x10', 'apple-lisa': '6x10/6x10', 'crayon-os': '66x10/66x10',
    'dolphin-som': '14x10/15x10', evolution: '14x10/15x10', floppies: '31x14/38x12', 'windows-31': '5x14/3x14', 'windows-95': '10x14/3x14' });
  const reverse = GATE4.filter(s => [-10079, -10078, -10076, -10075].some(id => census(s).cinf.get(id)?.[3]));
  assert.deepEqual(reverse, ['1990', 'apple-lisa', 'dolphin-som', 'evolution']);
  const mode = s => (census(s).ppat.has(-10079) ? 'frame' : census(s).ppat.has(-10080) ? 'shift' : 'none');
  assert.deepEqual(Object.fromEntries(GATE4.map(s => [s, mode(s)])), { 1138: 'frame', 1984: 'frame', 1990: 'none', 'apple-lisa': 'shift', 'crayon-os': 'shift', 'dolphin-som': 'none',
    evolution: 'none', floppies: 'frame', 'windows-31': 'frame', 'windows-95': 'frame' });
  const frames = (s, Fp) => { let k = 0; while (k < 8 && census(s).ppat.has(Fp + k)) k++; return k; };
  assert.deepEqual(['1138', 'floppies', 'windows-31', 'windows-95', '1984'].map(s => [frames(s, -10080), frames(s, -10072)]), [[4, 4], [4, 4], [4, 4], [4, 4], [8, 8]]);
  assert.deepEqual(PROCEDURAL.filter(s => !census(s).ppat.has(ID.fbPpat)), ['monkey-paradise']);
  assert.deepEqual(SLUGS.filter(s => census(s).cicn.has(ID.neverRequested)), PROCEDURAL);
});

test('decode rows equal the spec values', () => {
  for (const [id, row] of Object.entries(ROWS)) assert.deepEqual(row({}), EXPECTED[id], id);
});

test('mutation table: each wrong reading fails the named rows; every row and every rule group is failed by one', () => {
  const table = Object.fromEntries(Object.entries(MUTATIONS).map(([name, reading]) => [name,
    Object.keys(ROWS).filter(id => { try { return JSON.stringify(ROWS[id](reading)) !== JSON.stringify(EXPECTED[id]); } catch { return true; } }).map(id => id.split(' ')[0])]));
  assert.deepEqual(table, MUTATION_TABLE);
  const failed = new Set(Object.values(table).flat());
  assert.deepEqual(Object.keys(ROWS).map(id => id.split(' ')[0]).filter(id => !failed.has(id)), []);
  const groups = [...new Set(Object.keys(ROWS).map(groupOf))].sort();
  assert.deepEqual(groups, ['BLIT', 'CINF', 'COL', 'DATA', 'DET', 'ERASE', 'FB', 'FRAME', 'GATE', 'IND', 'INSET', 'PAT', 'RECT', 'SLICE']);
  for (const g of groups) assert.ok(Object.values(table).some(ids => ids.some(id => groupOf(id) === g)), `group ${g} has a failing mutation`);
});
const MUTATION_TABLE = {
  'caller height kept (no RECT1)': ['RECT1', 'DATA-HIT1/HIT2'],
  'inactive by hilite alone (no cinf -10077 check)': ['GATE-path', 'GATE1', 'CINF2', 'IND-Fp'],
  'gate on the frame cicn': ['GATE-path', 'GATE2', 'CINF3'],
  'retry cicn -10080 after a missing cicn -10077': ['GATE2'],
  'per-part inactive -> active fallback (old runtime)': ['GATE1a'],
  'procedural bar when the fill or track is missing': ['GATE1a', 'GATE4', 'INSET1', 'SLICE1', 'ERASE1'],
  'inset by k always': ['INSET1'],
  'inset by 2 always': ['INSET1'],
  'inset by s horizontally': ['INSET1'],
  'split rounded': ['DET1', 'DET3', 'SLICE3-SLICE5', 'FB7'],
  'split floored': ['DET3'],
  'value clamped to [min, max]': ['DET3'],
  'range 0 read as full': ['DET2'],
  'fill / track drawn without their cinf': ['SLICE1'],
  'art stretched to I': ['SLICE2', 'SLICE3-SLICE5', 'SLICE3', 'SLICE4/SLICE5', 'SLICE6', 'SLICE7'],
  'art clipped to I': ['SLICE2'],
  'art top-aligned': ['SLICE2'],
  'halves rule omitted': ['SLICE3-SLICE5', 'SLICE3'],
  'second half 1 px wider (P5)': ['SLICE3'],
  'cap clamped at 4 (old runtime)': ['SLICE3-SLICE5', 'SLICE3'],
  'cap from cinf byte 1': ['SLICE3-SLICE5', 'SLICE3'],
  'one-column middle read as the full middle': ['SLICE3-SLICE5'],
  'full middle read as one column': ['SLICE6', 'SLICE7'],
  'middle stretched': ['SLICE3-SLICE5', 'SLICE4/SLICE5', 'SLICE6', 'SLICE7'],
  'tiles from the start when byte 3 ≠ 0': ['SLICE7'],
  'tiles from the end always': ['SLICE6'],
  'frame tile flag ignored (always lines)': ['FRAME6'],
  'tile = 0 band uses the whole middle': ['FRAME3-FRAME5', 'FRAME5', 'BLIT3/BLIT4'],
  'frame bands 9-slice stretched': ['FRAME3-FRAME5', 'FRAME5', 'FRAME6', 'BLIT3/BLIT4'],
  'frame centre cell drawn (legacy body)': ['FRAME3-FRAME5', 'FRAME8', 'BLIT3/BLIT4', 'ERASE1', 'IND6', 'PAT1-§5.5'],
  'frame pieces in reading order (bands first)': ['FRAME3-FRAME5'],
  'frame k and s read swapped': ['INSET1', 'CINF2'],
  'cut tile keeps leading always': ['SLICE7'],
  'unmasked (srcCopy) art': ['BLIT1'],
  'R erased first': ['FRAME8', 'BLIT1', 'ERASE2/ERASE3', 'ERASE1', 'IND6', 'FB4', 'FB9'],
  'IND6 paints I': ['FRAME8', 'IND6'],
  'probe F_p': ['IND1', 'IND4/IND5', 'PAT1-§5.5'],
  'probe F_p + phase': ['IND2/IND3', 'IND1'],
  'phases 8..255 valid frames': ['IND2/IND3'],
  'phase not written back': ['IND2/IND3'],
  'shift by phase, not 4·phase': ['IND1', 'IND4/IND5', 'PAT1-§5.5', 'FB8'],
  'phase reset in shift mode': ['IND4/IND5'],
  'inactive patterns from -10080': ['IND-Fp'],
  'truncating remainder for the pattern phase': ['PAT1-§5.5'],
  'pattern not repeated over P': ['ERASE4', 'PAT1-§5.5'],
  'FB bottom/right sampled at (0, 0)': ['FB1-FB6'],
  'FB bottom/right sampled at (11, 11) (pre-#443)': ['FB1-FB6'],
  'FB bevel over the whole outer ring': ['ERASE2/ERASE3'],
  'FB state-dependent (inactive lavender)': ['FB10'],
  'FB9 paints I_f lavender': ['FB9'],
  'FB7 parts swapped (lavender filled part)': ['FB7'],
  'inverted rect sliced by its width magnitude': ['DET4'],
  'FB colours swapped': ['COL3/COL4'],
  'COL1 first-match lookup': ['COL1'],
  'COL2 sample honours the mask': ['COL2'],
  'short cinf zero-padded': ['CINF3'],
  'data access accepts any tag': ['DATA1-DATA3'],
  "idle '>' instead of '>='": ['DATA-IDLE1-IDLE4'],
  'idle advances a determinate bar': ['DATA-IDLE1-IDLE4'],
  'hit test returns a part': ['DATA-HIT1/HIT2'],
};

// Per-archive discrimination over the public rows the browser spec draws: which
// archives' source maps change under each reading. Readings no archive
// discriminates are named; the synthetic rows above are their only check.
const sig = (slug, reading) => { try { return JSON.stringify(PUBLIC_ROWS.map(row => { const nat = nativeFor(row), l = layout(nat, census(slug), { reading });
  return [l.path, l.phaseAfter, sourceMap(l, maskOf(slug), census(slug), { reading })]; })); } catch (e) { return `throws ${e.message}`; } };
test('per-archive mutation table over the public rows; readings no archive discriminates are named', () => {
  const pixelMutations = Object.keys(MUTATIONS).filter(m => !/COL1|COL2|data access|idle|hit test|short cinf|FB colours/.test(m));
  const table = Object.fromEntries(pixelMutations.map(name => [name, SLUGS.filter(slug => sig(slug, MUTATIONS[name]) !== sig(slug, {}))]));
  assert.deepEqual(table, ARCHIVE_TABLE);
});
const ARCHIVE_TABLE = {
  'caller height kept (no RECT1)': [],   // the facade always passes 14 rows: RECT1 is a node row only
  'inactive by hilite alone (no cinf -10077 check)': ['apple-lisa'],   // apple-lisa is the only GATE1a archive
  'gate on the frame cicn': ['apple-platinum-2', 'black-platinum', 'system7-nostalgia-silver'],
  'retry cicn -10080 after a missing cicn -10077': [],   // GATE3 has no corpus case (spec §6): synthetic GATE2 row only
  'per-part inactive -> active fallback (old runtime)': [],   // every corpus inactive set is complete: synthetic GATE1a row only
  'procedural bar when the fill or track is missing': [],   // every GATE4 archive ships fill and track: synthetic GATE4 row only
  'inset by k always': [],   // k = 2 everywhere (spec §6): synthetic INSET1 row only
  'inset by 2 always': [],   // k = 2 everywhere (spec §6): synthetic INSET1 row only
  'inset by s horizontally': ['windows-95'],
  'split rounded': SLUGS,
  'split floored': ['1984', 'crayon-os', 'floppies'],   // only where the value -10 split lands a non-uniform track column inside R
  'value clamped to [min, max]': SLUGS,
  'range 0 read as full': SLUGS,
  'fill / track drawn without their cinf': [],   // every corpus fill/track cicn ships its cinf: synthetic SLICE1 row only
  'art stretched to I': ['floppies', 'windows-31', 'windows-95'],
  'art clipped to I': ['floppies', 'windows-31', 'windows-95'],
  'art top-aligned': ['floppies', 'windows-31', 'windows-95'],
  'halves rule omitted': ['1984'],
  'second half 1 px wider (P5)': ['1984'],                 // odd L <= 2a only on the 1-of-4 row (1984 fill L = 9)
  'cap clamped at 4 (old runtime)': ['1984'],
  'cap from cinf byte 1': ['1984', '1990', 'apple-lisa', 'dolphin-som', 'evolution', 'floppies', 'windows-95'],
  'one-column middle read as the full middle': ['1984'],
  'full middle read as one column': ['1990', 'apple-lisa', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'windows-95'],
  'middle stretched': ['1984', '1990', 'apple-lisa', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'windows-95'],
  'tiles from the start when byte 3 ≠ 0': ['1990', 'apple-lisa', 'dolphin-som', 'evolution'],
  'tiles from the end always': ['apple-lisa', 'crayon-os', 'floppies', 'windows-95'],
  'frame tile flag ignored (always lines)': ['1990', 'crayon-os', 'dolphin-som', 'evolution', 'floppies'],
  'tile = 0 band uses the whole middle': ['1138', '1984', 'apple-lisa', 'windows-31', 'windows-95'],
  'frame bands 9-slice stretched': GATE4,
  'frame centre cell drawn (legacy body)': ['1984', '1990', 'crayon-os', 'dolphin-som', 'evolution', 'windows-31', 'windows-95'],
  'frame pieces in reading order (bands first)': [],   // corners and bands never overlap in the corpus: trace order only (FRAME3 row)
  'frame k and s read swapped': ['windows-95'],
  'cut tile keeps leading always': ['1990', 'apple-lisa', 'dolphin-som', 'evolution'],
  'unmasked (srcCopy) art': [],   // no drawn corpus frame/fill/track piece has a mask-clear pixel (spec §7): synthetic BLIT1 row only
  'R erased first': ['1990', 'animals', 'apple-platinum-2', 'beos-r503', 'black-platinum', 'dolphin-som', 'evolution', 'monkey-paradise', 'platinum-8', 'slimes', 'system7-nostalgia-silver', 'windows-95'],   // the other archives leave no pixel of R uncovered on these rows; windows-95 inactive s = 1 leaves columns 1 and 98
  'IND6 paints I': ['1990', 'dolphin-som', 'evolution'],
  'probe F_p': ['apple-lisa', 'crayon-os'],
  'probe F_p + phase': ['1138', '1984', 'floppies', 'windows-31', 'windows-95'],
  'phases 8..255 valid frames': ['1138', '1984', 'floppies', 'windows-31', 'windows-95'],
  'phase not written back': ['1138', '1984', 'floppies', 'windows-31', 'windows-95'],
  'shift by phase, not 4·phase': ['animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503', 'black-platinum', 'crayon-os', 'platinum-8', 'slimes', 'system7-nostalgia-silver'],
  'phase reset in shift mode': ['1990', 'apple-lisa', 'crayon-os', 'dolphin-som', 'evolution'],
  'inactive patterns from -10080': ['1138', '1984', 'crayon-os', 'floppies', 'windows-31', 'windows-95'],
  'truncating remainder for the pattern phase': ['animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503', 'black-platinum', 'crayon-os', 'platinum-8', 'slimes', 'system7-nostalgia-silver'],
  'pattern not repeated over P': ['1138', '1984', 'animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503', 'black-platinum', 'crayon-os', 'floppies', 'platinum-8', 'slimes', 'system7-nostalgia-silver', 'windows-31', 'windows-95'],
  'FB bottom/right sampled at (0, 0)': PROCEDURAL,
  'FB bottom/right sampled at (11, 11) (pre-#443)': PROCEDURAL,
  'FB bevel over the whole outer ring': PROCEDURAL,
  'FB state-dependent (inactive lavender)': PROCEDURAL,
  'FB9 paints I_f lavender': ['monkey-paradise'],
  'FB7 parts swapped (lavender filled part)': PROCEDURAL,
  'inverted rect sliced by its width magnitude': GATE4,
};

test('public mapping (DECISIONS #10/#11): state hilites, normalized trunc, range passthrough', () => {
  assert.deepEqual(STATE_HILITE, { normal: 0, pressed: 0, inactive: 254, disabled: 255 });
  assert.deepEqual(['normal/104/v0.57', 'normal/160/default', 'normal/40/3of10'].map(k => { const v = nativeFor(PUBLIC_ROWS.find(r => r.key === k)); return [v.value, v.min, v.max, v.rect.right]; }),
    [[5699, 0, 10000, 104], [5000, 0, 10000, 160], [3, 0, 10, 40]]);
  // v0.57 at length 104 (w = 100): trunc gives x = 2 + 56 = 58; a rounding facade (5700) gives 59.
  assert.equal(layout(nativeFor(PUBLIC_ROWS.find(r => r.key === 'normal/104/v0.57')), census('1138')).x, 58);
  assert.equal(layout(nativeFor(PUBLIC_ROWS.find(r => r.key === 'normal/104/v0.57'), { normalize: v => Math.round(v * 10000) }), census('1138')).x, 59);
});
