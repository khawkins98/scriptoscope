// Scroll-bar geometry, hit-test, slicing and fill rules (Kaleidoscope 2.3.1
// kDEF 0, scroll-bar CDEF 0x997e, service slot 1). Pure ESM; imports nothing
// from src/. Every formula is transcribed from docs/spec/engine/scrollbar.md
// (§4.5–§4.8, §5) and cites the spec row it mirrors; nothing is fitted to
// runtime output. Selection (which ids) stays in range-rules.mjs.
//
// Coordinates are port pixels, intervals half-open [start, end). "Along" is the
// axis the bar runs on (x horizontal, y vertical). Declared defaults (spec §2):
// every Gestalt('Acid') option byte clear (so no double arrows, whole-track,
// pressed-halves or proportional thumb), finderWindow false, SmartScroll and
// ATIr absent, >= 8-bit output, the archive's own fork.

import { TRACK_BASE, SMALL_TRACK_OFFSET, THUMB, SMALL_THUMB_OFFSET, scrollBytes, trackTier, compositeTrack } from './range-rules.mjs';

/** The decode, as named rules. A wrong reading overrides one of them (mutation tests only). */
export const GEOMETRY = {
  composite: compositeTrack,                        // CF1 0xa14e–0xa184: bounds > 16 in either axis
  keepSmallTrackId: true,                           // TR7 0xa0c2: trackId keeps +18 after a small-art miss
  arrowLen: t => t - 1,                             // §5.1 c = t − 1
  iconBoxExtra: 1,                                  // §5.1 e = 1 in the icon lane (t × t boxes)
  cellLen: h => h - 1,                              // §5.4 d = h − 1; §5.5 inset k = h − 1
  proportional: false,                              // §5.6: needs option34 + finderWindow
  smallThumbMissPenalty: 5,                         // §5.6 0xab74–0xac16
  round: x => Math.trunc(x + 0.5),                  // §5.7 0xaa36–0xaaea
  segmentOverlap: 1,                                // §5.8: each segment reaches one pixel under the thumb
  trackSliceMode: 1,                                // TF8: halves
  thumbSliceMode: 0,                                // TH7: option27, clear -> caps
  capForMode0: 3,                                   // §5.9 k = 3 for mode 0
  arrowsBeforeThumb: true,                          // §4.8 order: arrows, thumb, sides
  pageSplit: (p, th) => (p < ((th[0] + th[1]) >> 1) ? 22 : 23), // HT7/HT8 thumb-centre split
  hitHilite: { low: 20, high: 21 },                 // AH1/AH2 0xc3a0–0xc3c0
  nonHitBoxFromIdMinus1: true,                      // AC2 0xc3cc–0xc3fe
  cellsFromDrawnCicn: true,                         // §5.4 (#396): cells from the bounds of the cicn that supplies the cell
  patternAnchor: 'rect',                            // TF7/AC4 0xf930, 0xf87e: phase at R's top-left
  patternOverCicn: false,                           // TF7 before TF8; AC4 fills only mask-clear pixels
  offscreen: ({ atiPresent, pattern, picSave }) => !atiPresent || (pattern && picSave), // §4.7 0xba74–0xbbea
  drawOrder: ['arrow0', 'arrow3', 'thumb', 'track'], // §3 draw order (double clear)
};

const span = ([a, b]) => b - a;
const inside = (p, [a, b]) => p >= a && p < b;

/**
 * Slice an along interval `S` into `D` (§5.9, 0xb44c–0xba0c). `sameCross` says
 * whether the source and destination cross sizes match. Returns pieces
 * { dst, src } (along intervals; each spans the full cross of S and D), or one
 * { dst, src, copy: true } for an equal-size 1:1 copy. Empty pieces are dropped.
 */
export function slice(S, D, mode, sameCross, g = GEOMETRY) {
  const s = span(S), w = span(D);
  if (s === w && sameCross) return [{ dst: D, src: S, copy: true }];
  const m = Math.min(s, w), a = m >> 1, [s0, s1] = S, [d0, d1] = D;
  let pieces;
  if (mode > 0) {
    pieces = [
      { dst: [d0, d0 + a], src: [s0, s0 + a] },
      ...(s < w ? [{ dst: [d0 + a, d1 - (m - a)], src: [s0 + a, s0 + a + 1] }] : []),
      { dst: [d1 - (m - a), d1], src: [s1 - (m - a), s1] },
    ];
  } else {
    const k = mode === 0 ? g.capForMode0 : -mode, mid = (d0 + d1) >> 1;
    const q1 = s > w ? Math.trunc((s - w + 1) / 2) : 0, q2 = s > w ? Math.trunc((s - w) / 2) : 0;
    pieces = [
      { dst: [d0, d0 + k], src: [s0, s0 + k] },
      ...(s < w ? [{ dst: [d0 + k, mid - a + k], src: [s0 + k - 1, s0 + k] }] : []),
      { dst: [mid - a + k, mid + (m - a) - k + 1], src: [s0 + k + q1, s1 - k + 1 - q2] },
      ...(s < w ? [{ dst: [mid + (m - a) - k + 1, d1 - k + 1], src: [s1 - k, s1 - k + 1] }] : []),
      { dst: [d1 - k + 1, d1], src: [s1 - k + 1, s1] },
    ];
  }
  return pieces.filter(p => span(p.dst) > 0);
}

/**
 * Lay out one scroll bar. `native` = { rect: { left, top, right, bottom },
 * hilite, min, max, value, parentInactive }. `census` = range-rules.mjs census
 * (cicn: Map<id, [w, h]>, ppat: Set<id>). Returns along intervals in port
 * coordinates plus the ids each part uses.
 */
export function layout(native, census, { reading = {} } = {}) {
  const g = { ...GEOMETRY, ...reading };
  const R = native.rect, { hilite = 0, min = 0, max = 100, value = 0 } = native;
  const horizontal = R.right - R.left > R.bottom - R.top;                       // 0xadfe
  const orientation = horizontal ? 'horizontal' : 'vertical';
  const [L, Rr] = horizontal ? [R.left, R.right] : [R.top, R.bottom];
  const cross = horizontal ? [R.top, R.bottom] : [R.left, R.right];
  const t = span(cross);                                                       // 0xbc92
  const b = scrollBytes({ hilite, min, max, parentInactive: native.parentInactive });
  const tier = trackTier(b), base = TRACK_BASE[orientation];
  const dims = id => { const d = census.cicn.get(id); return d && (horizontal ? { along: d[0], cross: d[1] } : { along: d[1], cross: d[0] }); };
  // TR5–TR9 (double clear): trackId keeps +18 after a small miss (TR7).
  const small18 = base + tier + SMALL_TRACK_OFFSET;
  const trackCicn = t <= 11 && census.cicn.has(small18) ? small18 : census.cicn.has(base + tier) ? base + tier : null;
  const trackId = t <= 11 && (g.keepSmallTrackId || trackCicn === small18) ? small18 : base + tier;
  // TP1/TP3 (TP2 needs doubleArt).
  const pattern = census.ppat?.has(trackId) ? trackId : census.ppat?.has(base + tier) ? base + tier : null;
  const art = trackCicn === null ? null : dims(trackCicn);
  const composite = art !== null && g.composite(census.cicn.get(trackCicn));
  const c = g.arrowLen(t), e = composite ? 0 : g.iconBoxExtra;
  // §5.2 track rect T (0xbbf4–0xbc90).
  const T = b.inactive ? [L, Rr] : [L + c, Rr - c];
  // §5.3 arrow boxes (0xa8c6–0xa97a), double clear: arrows 0 and 3.
  const boxes = { 0: [L, L + c + e], 3: [Rr - c - e, Rr] };
  // §5.4 composite cells and §5.5 track source (bounds-relative).
  const d = art && g.cellLen(art.cross);
  const cells = composite ? { 0: [0, d], 3: [art.along - d, art.along] } : null;
  const trackSource = art && (composite && !b.inactive ? [g.cellLen(art.cross), art.along - g.cellLen(art.cross)] : [0, art.along]);
  // AH1–AH3 / AC2 / AC3: which cicn each composite arrow box is cut from.
  let boxSource = null;
  if (composite && !b.inactive) {
    const hit = { 0: hilite === g.hitHilite.low, 3: hilite === g.hitHilite.high };
    const minus1 = census.cicn.has(trackId - 1) ? trackId - 1 : trackCicn;
    boxSource = Object.fromEntries([0, 3].map(i => [i, b.pressed && !hit[i] && g.nonHitBoxFromIdMinus1 ? minus1 : trackCicn]));
  }
  // §5.4 as answered in #396: each box's cell from its own source cicn's bounds.
  const boxCells = boxSource && Object.fromEntries([0, 3].map(i => {
    const sd = dims(g.cellsFromDrawnCicn ? boxSource[i] : trackCicn), dd = g.cellLen(sd.cross);
    return [i, { id: boxSource[i], cell: i === 0 ? [0, dd] : [sd.along - dd, sd.along] }];
  }));
  // TH2–TH5 thumb id; §5.6 length (0xab68–0xad60).
  const thumbId = THUMB[orientation][hilite === 129 ? 'pressed' : 'normal'];
  const small = t <= 11 && census.cicn.has(thumbId + SMALL_THUMB_OFFSET);
  const thumbCicn = small ? thumbId + SMALL_THUMB_OFFSET : census.cicn.has(thumbId) ? thumbId : null;
  const trackLen = span(T);
  let minLen = thumbCicn !== null ? dims(thumbCicn).along : t + 1;
  if (t <= 11 && !small) minLen -= g.smallThumbMissPenalty;
  let len;
  if (g.proportional) len = Math.max(minLen, Math.min(trackLen, Math.trunc(trackLen * (Rr - L) / (max - min + (Rr - L)))));
  else { len = minLen; if (len > trackLen) len = 0; }
  // §5.7 thumb rect (0xa97c–0xab66).
  let Th = null, pos = null;
  if (!b.disabled) {
    const range = max - min, offset = len === 0 ? 0 : value - min, free = trackLen - len;
    pos = range === 0 ? 0 : g.round((((offset * free) >>> 0)) / Math.fround(range));
    Th = [T[0] + pos, T[0] + pos + len];
  }
  // §5.8 two-pass segments, or TH2's whole T when disabled.
  const ov = g.segmentOverlap;
  const segments = b.disabled ? [{ name: 'whole', rect: T }]
    : [...(Th[0] > T[0] ? [{ name: 'low', rect: [T[0], Th[0] + ov] }] : []), ...(T[1] > Th[1] ? [{ name: 'high', rect: [Th[1] - ov, T[1]] }] : [])];
  // TF8 / TH7 slices.
  const trackPieces = trackCicn === null ? [] : segments.map(sg => ({ segment: sg.name, pieces: slice(trackSource, sg.rect, g.trackSliceMode, art.cross === t, g) }));
  const thumbPieces = Th && thumbCicn !== null && span(Th) > 0 ? slice([0, dims(thumbCicn).along], Th, g.thumbSliceMode, dims(thumbCicn).cross === t, g) : [];
  // §3 draw order (TH1: empty T draws neither thumb nor track).
  const order = g.drawOrder.flatMap(step => step === 'track' ? (span(T) > 0 ? segments.map(sg => `track-${sg.name}`) : [])
    : step === 'thumb' ? (span(T) > 0 && !b.disabled && thumbCicn !== null ? ['thumb'] : []) : [step]);
  return { orientation, t, c, e, tier, trackId, trackCicn, pattern, composite, T, boxes, cells, trackSource, boxSource, boxCells,
    thumbCicn, minLen, len, pos, Th, segments, trackPieces, thumbPieces, order, disabled: b.disabled, cross, rect: R, horizontal };
}

/** §4.8 hit test (0xa506–0xa676): part code for port point { x, y }. */
export function hitTest(l, { x, y }, { reading = {} } = {}) {
  const g = { ...GEOMETRY, ...reading };
  const R = l.rect;
  if (l.disabled || x < R.left || x >= R.right || y < R.top || y >= R.bottom) return 0;   // HT1
  const p = l.horizontal ? x : y;
  const arrows = () => (inside(p, l.boxes[0]) ? 20 : inside(p, l.boxes[3]) ? 21 : null);  // HT2, HT5
  const thumb = () => (inside(p, l.Th) ? 129 : null);                                       // HT6
  const first = g.arrowsBeforeThumb ? arrows() ?? thumb() : thumb() ?? arrows();
  return first ?? g.pageSplit(p, l.Th);                                                      // HT7, HT8
}

/** TF7/AC4 pattern phase at port pixel (x, y) for a pw × ph ppat. */
export function patternPhase(l, x, y, [pw, ph], { reading = {} } = {}) {
  const g = { ...GEOMETRY, ...reading };
  const [ox, oy] = g.patternAnchor === 'rect' ? [l.rect.left, l.rect.top] : [0, 0];
  const mod = (a, n) => ((a % n) + n) % n;
  return { u: mod(x - ox, pw), v: mod(y - oy, ph) };
}

/**
 * Which source pixel reaches port pixel (x, y) of a composite bar at rest,
 * outside the thumb, where every piece involved is exact (equal-size copy or a
 * one-column piece with matching cross size). `art.mask(id, x, y)` says whether
 * a cicn pixel is mask-set; `art.ppatSize(id)` gives [w, h]. Returns
 * { from: 'cicn', id, x, y } or { from: 'ppat', id, u, v }, or null where the
 * spec leaves the pixel to the scale blit or to an undefined offscreen.
 */
export function pixelSource(l, x, y, art, { reading = {} } = {}) {
  const g = { ...GEOMETRY, ...reading };
  const p = l.horizontal ? x : y, q = (l.horizontal ? y : x) - l.cross[0];
  const fromPattern = () => (l.pattern === null ? null : { from: 'ppat', id: l.pattern, ...patternPhase(l, x, y, art.ppatSize(l.pattern), { reading }) });
  const cicnPixel = (id, a) => (l.horizontal ? { from: 'cicn', id, x: a, y: q } : { from: 'cicn', id, x: q, y: a });
  const opaque = (id, a) => (l.horizontal ? art.mask(id, a, q) : art.mask(id, q, a));
  const resolve = (id, a) => (g.patternOverCicn && l.pattern !== null ? fromPattern() : opaque(id, a) ? cicnPixel(id, a) : fromPattern());
  for (const i of [0, 3]) {
    if (!inside(p, l.boxes[i])) continue;
    if (!l.composite || span(l.boxes[i]) !== span(l.cells[i])) return null;                // AC1 (1:1 when sizes match)
    return resolve(l.boxSource[i], l.cells[i][0] + (p - l.boxes[i][0]));                    // AC4 / AC5
  }
  if (l.Th && inside(p, l.Th)) return null;                                                   // thumb (TH7): not modelled here
  for (const { pieces } of l.trackPieces) for (const pc of pieces) {
    if (!inside(p, pc.dst)) continue;
    const a = pc.copy || span(pc.src) === span(pc.dst) ? pc.src[0] + (p - pc.dst[0]) : span(pc.src) === 1 ? pc.src[0] : null;
    return a === null ? null : resolve(l.trackCicn, a);                                       // TF7 then TF8
  }
  return null;
}

/** §4.7 offscreen rule (0xba74–0xbbea): does a track segment draw through a temporary GWorld? */
export const segmentOffscreen = (env, { reading = {} } = {}) => ({ ...GEOMETRY, ...reading }).offscreen(env);

// D1–D8: spec §7 rows that need the runtime's pressedPart option or an engine
// trace. Expected values are spec values (pinned against this model by
// scrollbar-geometry-rules.test.mjs); scrollbar-driver-binding.test.mjs and
// range-rules.spec.mjs compare the runtime with them. Horizontal, R = (0, 0)
// 120 × 16, value 50 of 0..100 unless stated.
const C3 = ['cicn -10206', 'cicn -8285', 'cicn -8286'];
export const DRIVER_ROWS = {
  D1: { title: 'pressedPart selection (1138 h, platinum-8 h)', needs: 'public pressedPart option', expected: {
    '1138': { up: C3, down: C3, pageUp: C3, pageDown: C3, thumb: ['cicn -10205', 'cicn -8285', 'cicn -8286'] },
    'platinum-8': { up: ['cicn -10206', 'cicn -8285', 'icon -10198', 'icon -10201'], down: ['cicn -10206', 'cicn -8285', 'icon -10197', 'icon -10202'],
      pageUp: ['cicn -10206', 'cicn -8285', 'icon -10201', 'icon -10202'], pageDown: ['cicn -10206', 'cicn -8285', 'icon -10201', 'icon -10202'],
      thumb: ['cicn -10205', 'cicn -8285', 'icon -10201', 'icon -10202'] } } },
  D2: { title: 'arrow-box source cicn by hilite (1138 h)', needs: 'engine trace', expected: {
    0: { 0: -8286, 3: -8286 }, 20: { 0: -8285, 3: -8286 }, 21: { 0: -8286, 3: -8285 }, 22: { 0: -8286, 3: -8286 }, 23: { 0: -8286, 3: -8286 }, 129: { 0: -8286, 3: -8286 } } },
  D3: { title: 'draw-step order (1138 normal, disabled)', needs: 'engine trace order (pixels cannot show track-after-thumb with a mask-honouring blit)',
    expected: [['arrow0', 'arrow3', 'thumb', 'track-low', 'track-high'], ['arrow0', 'arrow3', 'track-whole']] },
  D4: { title: 'traced rects (1138 worked example)', needs: 'engine trace rects',
    expected: { boxes: { 0: [0, 15], 3: [105, 120] }, T: [15, 105], Th: [52, 69], segments: [[15, 53], [68, 105]] } },
  D5: { title: 'traced thumb slice at t = 11 (1990, R 120 × 11)', needs: 'engine trace slice pieces',
    expected: { thumb: -10206, minLen: 11, Th: [55, 66], cross: 11, pieces: [[[0, 3], [0, 3]], [[3, 9], [6, 12]], [[9, 11], [14, 16]]] } },
  D6: { title: 'pattern underlay pixels (crayon-os, R at 13,5; port pixels (40,9) track, (14,9) arrow)', needs: 'driver drawing at a port offset',
    expected: { pattern: -8286, track: { from: 'ppat', id: -8286, u: 27, v: 4 }, arrow: { from: 'cicn', id: -8286, x: 1, y: 4 } } },
  D7: { title: 'every track segment draws through the offscreen (ATIr absent)', needs: 'engine trace (offscreen per segment)', expected: [true, true] },
  D8: { title: 'testCntl part codes (1138 worked example)', needs: 'driver hit test',
    expected: [0, 20, 20, 22, 22, 129, 129, 129, 23, 23, 21, 21, 0, 0, 0] },
  // §5.4 as answered in #396 (spec Q1): animals/monkey-paradise h, hilite 20; track -8285 is 61 × 16,
  // the non-hit high arrow draws from -8286 (43 × 16), so its cell is [28, 43) of -8286, not [46, 61).
  D9: { title: 'non-hit pressed arrow cell from its own cicn (animals, monkey-paradise h, hilite 20)', needs: 'engine trace cell rects',
    expected: { animals: { 0: { id: -8285, cell: [0, 15] }, 3: { id: -8286, cell: [28, 43] } }, 'monkey-paradise': { 0: { id: -8285, cell: [0, 15] }, 3: { id: -8286, cell: [28, 43] } } } },
};
/** D8's probe points, in order (the last code is a disabled control at (60, 8)). */
export const D8_POINTS = [[-1, 8], [0, 8], [14, 8], [15, 8], [51, 8], [52, 8], [60, 8], [68, 8], [69, 8], [104, 8], [105, 8], [119, 8], [120, 8], [60, 16]];
