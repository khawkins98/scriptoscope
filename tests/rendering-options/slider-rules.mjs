// Slider (Kaleidoscope 2.3.1 CDEF 3) gate, selection, geometry, draw-order,
// hit-test and tracking rules. Pure ESM; imports nothing from src/. Every rule
// is transcribed from docs/spec/engine/slider.md (verified, #400) and cites the
// spec row it mirrors; nothing is fitted to runtime output. Addresses in the
// comments are CDEF 3 file offsets, as in the spec.
//
// Coordinates are port pixels; rects are { top, left, bottom, right } with
// half-open intervals. Declared defaults (spec §2 "Scriptoscope mapping"): one
// device at depth >= 8, colour port, not recording, pen visible, the archive's
// own fork, the System file holds its own CDEF 3 (G2 hands off).

export const BASE = { horizontal: -10144, vertical: -10128 };          // CDEF 3 0x34a..0x35c
export const SLUGS = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503', 'black-platinum', 'crayon-os', 'dolphin-som',
  'evolution', 'floppies', 'monkey-paradise', 'platinum-8', 'slimes', 'system7-nostalgia-silver', 'windows-31', 'windows-95'];
/** Slider resource ids: every cinf/cicn CDEF 3 can request (base .. base + 6·2 + 5). */
export const inSliderRange = id => id >= -10144 && id <= -10111;
/** HISlider.h variation bits (spec §1.1). */
export const VARIATION = { liveFeedback: 1, ticks: 2, reverse: 4, nonDirectional: 8 };
export const PARTS = { none: 0, pageUp: 22, pageDown: 23, thumb: 129 };

/** The decode, as named rules. A wrong reading overrides one of them (mutation tests only). */
export const DECODE = {
  gate: 'cinf',                                   // G1 0x13c..0x1d2: cinf base / base+12 (bit 3) / base+6 (bit 2)
  systemSlider: true,                             // G2 0x21c..0x286 (declared: the System file holds CDEF 3)
  trackTier: h => (h === 254 || h === 255 ? 0 : h >= 1 && h <= 253 ? 2 : 1),          // TR1 0xed2..0xef6
  thumbCell: h => (h === 254 || h === 255 ? 0 : h === 129 ? 2 : 1),                    // §2 0x103a..0x1060
  trackNeedsCinf: true,                           // TR4 0x2970..0x29ae
  trackGbNormal: true,                            // TR3 candidate gb + 1
  bandCentre: (a, b) => Math.trunc((a + b) / 2) - 8,  // §5.1 group 2, trunc
  bandIsR: false,                                 // §5.1: a 16-px band, not R
  thumbRound: Math.trunc,                         // §5.2 trunc
  verticalMinAtBottom: true,                      // §5.2 vertical
  insetAtRangeZero: false,                        // §5.2: range 0 -> R.left/R.top
  capClamp: null,                                 // SL3: cap = cinf byte 0, no clamp (runtime fallback: 6)
  halves: true,                                   // SL2
  oneColumnMiddle: true,                          // SL4: byte 2 = 0 -> one column, drawn as lines
  stretchMiddle: false,                           // SL6: tiles 1:1, never stretched
  endAnchor: byte3 => byte3 !== 0,                // SL6
  tickBaseFallback: true,                         // TK4: cicn gb + 4 + tickState, else base + 4 + tickState
  tickCrossMin: 24,                               // TK3: no ticks when the cross size of R < 24
  tickRound: true,                                // §5.4 v_i rounded (+ trunc((n−1)/2))
  tickBandOutsideB: true,                         // §5.4 ticks at 16 from the band edge
  tickCentre: (tA, t) => Math.trunc((tA - t.right - t.left) / 2),   // §5.4 subtracts right AND left
  masked: true,                                   // BL1 CopyMask
  erase: true,                                    // OS4 EraseRect R
  order: ['erase', 'track', 'ghost', 'thumb', 'ticks', 'composite'],   // §3.3 O4..O9
  ghostOnly13: true,                              // TH5
  hitArea: 'band',                                // HT1: B, not R
  pages: [22, 23],                                // HT3 / HT4
  trackRound: true,                               // §5.6 / §5.7 + trunc(T/2)
  valueFromGhost: true,                           // §5.6 p from G, not an inverse of §5.2
  verticalPosSign: true,                          // §5.7 vertical Δ sign flipped
};
const rd = reading => ({ ...DECODE, ...reading });
const s16 = (d, at) => (((d[at] << 8) | d[at + 1]) << 16) >> 16;

/**
 * Census from a parsed fork (checkable-rules.mjs parseResourceMap): every slider
 * cinf (its first four bytes) and cicn (iconPMap bounds at +6, Inside
 * Macintosh: Imaging 4-58) in -10144..-10111.
 */
export function sliderCensus(map) {
  const cinf = new Map(), cicn = new Map();
  for (const r of map.filter(r => inSliderRange(r.id))) {
    if (r.type === 'cinf') cinf.set(r.id, [...r.data.slice(0, 4)]);
    if (r.type === 'cicn') cicn.set(r.id, { top: s16(r.data, 6), left: s16(r.data, 8), bottom: s16(r.data, 10), right: s16(r.data, 12) });
  }
  return { cinf, cicn };
}
export const W = b => b.right - b.left, H = b => b.bottom - b.top;
export const rect = (top, left, bottom, right) => ({ top, left, bottom, right });

/** §2 derived `horizontal` (0x144..0x170): a square control is vertical. */
export const isHorizontal = R => R.right - R.left > R.bottom - R.top;
/** §2 group g (0x316..0x332). */
export const group = variation => (variation & 8 ? 2 : variation & 4 ? 1 : 0);
/** ID4/ID5 (0x59c..0x5c6): tick count set at message 3. */
export const tickCount = ({ variation, initialValue = 0 }) => (variation & 2 && group(variation) !== 2 ? initialValue : 0);

/** §4.1 gate. Returns 'kaleidoscope' (G1 or G3) or 'system' (G2). */
export function gate({ rect: R, variation = 8 }, census, { reading = {}, systemSlider } = {}) {
  const r = rd(reading), base = BASE[isHorizontal(R) ? 'horizontal' : 'vertical'];
  const sys = systemSlider ?? r.systemSlider;
  let found;
  if (r.gate === 'cicn') found = [base, base + 1, base + 6, base + 12].some(id => census.cicn.has(id));  // mutation: gate on the track cicn
  else if (r.gate === 'gbOnly') found = census.cinf.has(base + 6 * group(variation));                   // mutation: cinf gb only
  else found = census.cinf.has(base) || (variation & 8 && census.cinf.has(base + 12)) || (variation & 4 && census.cinf.has(base + 6));
  return found ? 'kaleidoscope' : sys ? 'system' : 'kaleidoscope';
}

/**
 * Resource selection for one draw (§3.1, §4.3, §4.5, §4.6). `native` = { rect,
 * hilite, variation, initialValue (the message-3 value: the tick count, ID4) }. Returns { gate } alone when handed off.
 */
export function select(native, census, { reading = {}, systemSlider } = {}) {
  const r = rd(reading);
  const { rect: R, hilite = 0, variation = 8 } = native;
  const g8 = gate(native, census, { reading, systemSlider });
  if (g8 === 'system') return { gate: 'system' };
  const horizontal = isHorizontal(R), base = BASE[horizontal ? 'horizontal' : 'vertical'], g = group(variation), gb = base + 6 * g;
  const tier = r.trackTier(hilite), cell = r.thumbCell(hilite), tickState = cell === 0 ? 0 : 1;
  const thumb = census.cicn.has(gb + 3) ? gb + 3 : census.cicn.has(base + 3) ? base + 3 : null;             // TH1
  const cornerId = census.cinf.has(gb) ? gb : census.cinf.has(base) ? base : null;                           // ID6
  const c = cornerId === null ? undefined : census.cinf.get(cornerId)[0];                                    // ID8: undefined
  const candidates = [gb + tier, ...(r.trackGbNormal ? [gb + 1] : []), base + tier, base + 1];               // TR3
  const track = candidates.find(id => census.cicn.has(id) && (!r.trackNeedsCinf || census.cinf.has(id))) ?? null;  // TR4/TR5
  const n = tickCount(native);                                                                              // ID4 / ID5
  const tickId = n > 1 ? [gb + 4 + tickState, ...(r.tickBaseFallback ? [base + 4 + tickState] : [])].find(id => census.cicn.has(id)) ?? null : null;  // TK1/TK4
  return { gate: 'kaleidoscope', horizontal, base, g, gb, tier, cell, tickState, thumb, cornerId, c, candidates, track, trackCinf: track === null ? null : census.cinf.get(track) ?? null, tickId, n };
}

const along = (h, R) => (h ? [R.left, R.right] : [R.top, R.bottom]);
const mk = (h, a, x) => (h ? rect(x[0], a[0], x[1], a[1]) : rect(a[0], x[0], a[1], x[1]));   // along a, cross x

/** §5.1 band B (0x866..0x92c). */
export function band(R, g, horizontal, { reading = {} } = {}) {
  const r = rd(reading);
  if (r.bandIsR) return { ...R };
  const [c0, c1] = horizontal ? [R.top, R.bottom] : [R.left, R.right];
  const x = g === 0 ? [c0, c0 + 16] : g === 1 ? [c1 - 16, c1] : (s => [s, s + 16])(r.bandCentre(c0, c1));
  return mk(horizontal, along(horizontal, R), x);
}

/**
 * §5.5 track slicing (SL1..SL6) into B. Returns pieces { kind: 'copy' | 'lines' |
 * 'tile', dst, src } in port / source coordinates (BL1, BL4/BL5, BL6).
 */
export function sliceTrack(S, cinfBytes, B, horizontal, { reading = {} } = {}) {
  const r = rd(reading);
  let k = cinfBytes[0];
  if (r.capClamp !== null) k = Math.min(r.capClamp, k);
  const sc = horizontal ? H(S) : W(S);
  const [b0, b1] = horizontal ? [B.top, B.bottom] : [B.left, B.right];
  const d0 = Math.trunc((b0 + b1 - sc) / 2), xd = [d0, d0 + sc];                       // SL1
  const xs = horizontal ? [S.top, S.bottom] : [S.left, S.right];
  const [D0, D1] = along(horizontal, B), [S0, S1] = horizontal ? [S.left, S.right] : [S.top, S.bottom], L = D1 - D0;
  const piece = (kind, da, sa) => ({ kind, dst: mk(horizontal, da, xd), src: mk(horizontal, sa, xs) });
  if (r.halves && L <= 2 * k) {                                                         // SL2
    const a = Math.trunc((L + 1) / 2), b = Math.trunc(L / 2);
    return [piece('copy', [D0, D0 + a], [S0, S0 + a]), piece('copy', [D1 - b, D1], [S1 - b, S1])].filter(p => (horizontal ? W(p.dst) : H(p.dst)) > 0);
  }
  const out = [piece('copy', [D0, D0 + k], [S0, S0 + k]), piece('copy', [D1 - k, D1], [S1 - k, S1])];   // SL3
  const M = [D0 + k, D1 - k];
  if (M[1] - M[0] <= 0) return out;
  const oneCol = cinfBytes[2] === 0 && r.oneColumnMiddle;
  const ms = oneCol ? [S0 + k, S0 + k + 1] : [S0 + k, S1 - k];                          // SL4 / SL5
  if (r.stretchMiddle) { out.push(piece('stretch', M, cinfBytes[2] === 0 ? [S0 + k, S1 - k] : ms)); return out; }
  if (oneCol) { out.push(piece('lines', M, ms)); return out; }                          // BL4 / BL5
  const m = ms[1] - ms[0];
  if (m <= 0) return out;                                                               // §6 item 6
  if (!r.endAnchor(cinfBytes[3])) {
    for (let p = M[0]; p < M[1]; p += m) { const len = Math.min(m, M[1] - p); out.push(piece('tile', [p, p + len], [ms[0], ms[0] + len])); }
  } else {
    for (let p = M[1]; p > M[0]; p -= m) { const len = Math.min(m, p - M[0]); out.push(piece('tile', [p - len, p], [ms[1] - len, ms[1]])); }
  }
  return out;
}

/**
 * One draw (messages 0, 13, 26) laid out from the spec. `native` = { rect,
 * hilite, variation, initialValue, min, max, value, message, ghost (G) }.
 */
export function layout(native, census, { reading = {}, systemSlider } = {}) {
  const r = rd(reading);
  const sel = select(native, census, { reading, systemSlider });
  if (sel.gate === 'system') return { gate: 'system', order: [] };
  const { rect: R, min = 0, max = 100, value = 0, message = 0 } = native;
  const h = sel.horizontal, B = band(R, sel.g, h, { reading });
  const range = ((max - min) << 16) >> 16, offset = ((value - min) << 16) >> 16;      // §2 16-bit differences
  const c = sel.c ?? 0, tb = sel.thumb === null ? null : census.cicn.get(sel.thumb);
  const tA = tb ? (h ? W(tb) : H(tb)) : 0, alongR = h ? W(R) : H(R), T = alongR - tA - 2 * c;   // ID7 (steady state)
  // §5.2 thumb rect
  let Th = rect(0, 0, 0, 0);
  if (tb) {
    const inset = range === 0 && !r.insetAtRangeZero ? 0 : c;
    const num = h || !r.verticalMinAtBottom ? offset : range - offset;
    const pos = range === 0 ? 0 : r.thumbRound((alongR - tA - 2 * c) * num / range);
    const start = (h ? R.left : R.top) + inset + pos;
    Th = mk(h, [start, start + tA], h ? [B.top, B.bottom] : [B.left, B.right]);
  }
  // TH3 / §5.3 thumb cell source (16-px rows or columns)
  const cellSrc = cell => (h ? rect(16 * cell, tb.left, 16 * cell + 16, tb.right) : rect(tb.top, 16 * cell, tb.bottom, 16 * cell + 16));
  const thumbDst = message === 26 && native.ghost ? native.ghost : Th;
  const thumbOp = tb ? { id: sel.thumb, cell: sel.cell, src: cellSrc(sel.cell), dst: thumbDst } : null;
  const ghostOp = tb && message === 13 && native.ghost ? { id: sel.thumb, cell: 3, src: cellSrc(3), dst: native.ghost } : null;
  // §4.3 track
  const trackPieces = sel.track === null ? [] : sliceTrack(census.cicn.get(sel.track), sel.trackCinf, B, h, { reading });
  // §4.6 / §5.4 ticks
  const ticks = [];
  const crossR = h ? H(R) : W(R);
  if (sel.n > 1 && range > 0 && crossR >= r.tickCrossMin && sel.tickId !== null) {          // TK1..TK4
    const t = census.cicn.get(sel.tickId), tw = W(t), th = H(t), n = sel.n;
    const off = r.tickBandOutsideB ? 16 : 0;
    for (let i = 0; i < n; i++) {
      const v = r.tickRound ? Math.trunc((i * range + Math.trunc((n - 1) / 2)) / (n - 1)) : Math.trunc((i * range) / (n - 1));
      const centre = h ? r.tickCentre(tA, { left: t.left, right: t.right }) : r.tickCentre(tA, { left: t.top, right: t.bottom });
      if (h) {
        const x = R.left + c + Math.trunc((T * v) / range) + centre;
        const y = sel.g === 0 ? [R.top + off, R.top + off + th] : [R.bottom - off - th, R.bottom - off];
        ticks.push({ v, id: sel.tickId, dst: rect(y[0], x, y[1], x + tw) });
      } else {
        const y = R.top + c + Math.trunc((T * (range - v)) / range) + centre;
        const x = sel.g === 0 ? [R.left + off, R.left + off + tw] : [R.right - off - tw, R.right - off];
        ticks.push({ v, id: sel.tickId, dst: rect(y, x[0], y + th, x[1]) });
      }
    }
  }
  // §3.3 draw order
  const order = r.order.filter(step => step !== 'ghost' || (r.ghostOnly13 ? ghostOp : tb && native.ghost))
    .filter(step => step !== 'thumb' || thumbOp).filter(step => step !== 'ticks' || ticks.length).filter(step => step !== 'erase' || r.erase)
    .filter(step => step !== 'track' || trackPieces.length);
  return { gate: 'kaleidoscope', sel, R, B, Th, tA, T, c, range, offset, min, max, value, thumbOp, ghostOp: r.ghostOnly13 ? ghostOp : (tb && native.ghost ? { id: sel.thumb, cell: 3, src: cellSrc(3), dst: native.ghost } : null), trackPieces, ticks, order, horizontal: h };
}

const inR = (p, R) => p.h >= R.left && p.h < R.right && p.v >= R.top && p.v < R.bottom;
/** §4.9 hit test (message 1, 0xb90..0xbf6). `P` = { h, v }. */
export function hitTest(l, P, { reading = {} } = {}) {
  const r = rd(reading);
  if (!inR(P, r.hitArea === 'band' ? l.B : l.R)) return 0;                             // HT1
  if (inR(P, l.Th)) return 129;                                                         // HT2
  return P.h < l.Th.left || P.v < l.Th.top ? r.pages[0] : r.pages[1];                   // HT3 / HT4
}
const layoutThumbStart = (l, v) => {
  const off = v - l.min, num = l.horizontal ? off : l.range - off;
  return (l.horizontal ? l.R.left : l.R.top) + l.c + Math.trunc((l.T * num) / l.range);
};
/** §5.6 value from the ghost rect (message 26). */
export function valueFromGhost(l, G, { reading = {} } = {}) {
  const r = rd(reading);
  if (!r.valueFromGhost) {                                                              // mutation: invert §5.2 (the value whose Th starts at G)
    const at = l.horizontal ? G.left : G.top;
    for (let v = l.min; v <= l.max; v++) { const t = layoutThumbStart(l, v); if (t === at) return v; }
    return null;
  }
  const p = l.horizontal ? G.left - l.B.left - l.c : l.B.bottom - l.c - G.bottom;
  return l.min + Math.trunc((p * l.range + (r.trackRound ? Math.trunc(l.T / 2) : 0)) / l.T);
}
/** §5.7 posCntl (message 5): the new value for an along drag offset d. */
export function posCntl(l, d, { reading = {} } = {}) {
  const r = rd(reading);
  const q = x => Math.trunc((x * l.range + (r.trackRound ? Math.trunc(l.T / 2) : 0)) / l.T);
  let delta = d > 0 ? q(d) : -q(-d);
  if (!l.horizontal && r.verticalPosSign) delta = -delta;
  return l.value + delta;
}
/** §5.8 thumbCntl (message 6): limit and slop rects and the axis for press point P. */
export function thumbCntl(l, P) {
  const limit = { ...l.B }, slop = rect(l.B.top - 15, l.B.left - 15, l.B.bottom + 15, l.B.right + 15);
  if (l.horizontal) { limit.left = P.h - Math.trunc((l.T * l.offset) / l.range); limit.right = limit.left + l.T + 1; return { axis: 1, limit, slop }; }
  limit.top = P.v - Math.trunc(((l.range - l.offset) * l.T) / l.range); limit.bottom = limit.top + l.T + 1;
  return { axis: 2, limit, slop };
}

/**
 * Source map of R after the draw: for each port pixel of R, `null` (the O4
 * background; 'port' for the port's prior pixels if R were not erased) or { id, x, y } (the cicn source pixel that reached it).
 * `mask(id, x, y)` reads a cicn's mask bit at source coordinates (BL10: equal
 * to bounds-relative coordinates for every corpus cicn, bounds at 0,0).
 */
export function sourceMap(l, mask, { reading = {} } = {}) {
  const r = rd(reading), R = l.R, w = W(R), hgt = H(R);
  const start = l.order.includes('erase') ? null : 'port';                              // OS4: without the erase, R keeps the port's pixels
  const map = Array.from({ length: hgt }, () => Array(w).fill(start));
  const put = (x, y, v) => { if (x >= R.left && x < R.right && y >= R.top && y < R.bottom) map[y - R.top][x - R.left] = v; };
  const blit = (id, src, dst) => {                                                      // BL1 (1:1 or nearest scale)
    for (let y = dst.top; y < dst.bottom; y++) for (let x = dst.left; x < dst.right; x++) {
      const sx = src.left + Math.floor(((x - dst.left) * W(src)) / W(dst)), sy = src.top + Math.floor(((y - dst.top) * H(src)) / H(dst));
      if (!r.masked || mask(id, sx, sy)) put(x, y, { id, x: sx, y: sy });
    }
  };
  for (const step of l.order) {
    if (step === 'track') for (const p of l.trackPieces) {
      if (p.kind === 'lines') {                                                         // BL4 / BL5 (BL10 source coordinates)
        if (W(p.src) === 1 && W(p.dst) > 1) { for (let sy = p.src.top; sy < p.src.bottom; sy++) if (mask(l.sel.track, p.src.left, sy)) for (let x = p.dst.left; x < p.dst.right; x++) put(x, p.dst.top + sy - p.src.top, { id: l.sel.track, x: p.src.left, y: sy }); }
        else for (let sx = p.src.left; sx < p.src.right; sx++) if (mask(l.sel.track, sx, p.src.top)) for (let y = p.dst.top; y < p.dst.bottom; y++) put(p.dst.left + sx - p.src.left, y, { id: l.sel.track, x: sx, y: p.src.top });
      } else blit(l.sel.track, p.src, p.dst);
    }
    if (step === 'ghost' && l.ghostOp) blit(l.ghostOp.id, l.ghostOp.src, l.ghostOp.dst);
    if (step === 'thumb' && l.thumbOp) blit(l.thumbOp.id, l.thumbOp.src, l.thumbOp.dst);
    if (step === 'ticks') for (const t of l.ticks) blit(t.id, rect(0, 0, H(t.dst), W(t.dst)), t.dst);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Public mapping (DECISIONS #9, maintainer decision 2026-10-22; spec §2
// "Scriptoscope mapping"). MODERN POLICY, not a decode: composeSlider draws a
// non-directional (group 2, variation 8) slider in R = length × 16 at the
// origin, min 0, max 100, value = round(100 · public value). state 'pressed' is
// the thumb press (hilite 129); pressedPart 'thumb' | 'pageUp' | 'pageDown' is
// 129 / 22 / 23 (a page press: pressed track art with the normal thumb).
export const STATE_HILITE = { normal: 0, pressed: 129, inactive: 254, disabled: 255 };
export const PRESSED_PART = { thumb: 129, pageUp: 22, pageDown: 23 };
export const STATES = ['normal', 'pressed', 'disabled', 'inactive'];
export const PUBLIC_ROWS = ['horizontal', 'vertical'].flatMap(orientation => STATES.map(state => ({ orientation, state })));
/** Rows that need the public pressedPart option (DECISIONS #9); bound in slider-rules.spec.mjs since the slider driver (#416). */
export const AWAITING_ROWS = ['horizontal', 'vertical'].flatMap(orientation => ['pageUp', 'pageDown'].map(pressedPart => ({ orientation, state: 'pressed', pressedPart })));
export const SAMPLE = { length: 120, value: 0.25 };
export function nativeFor({ orientation, state, pressedPart }, { length = SAMPLE.length, value = SAMPLE.value } = {}) {
  const hilite = state === 'pressed' && pressedPart ? PRESSED_PART[pressedPart] : STATE_HILITE[state];
  return { rect: orientation === 'horizontal' ? rect(0, 0, 16, length) : rect(0, 0, length, 16), hilite, variation: 8, min: 0, max: 100, value: Math.round(100 * value) };
}

// Engine-trace rows for the slider driver (spec §7: "geometry rows need the
// engine trace"). Expected values are the spec's literals, pinned against this
// model by slider-rules.test.mjs (row = its ROWS id); a driver binding compares
// the driver's trace with them. `needs` names what the binding requires.
export const DRIVER_ROWS = {
  D1: { row: 'R12 §5.2 Th of examples A, B, C', needs: 'engine trace Th (groups 0 and 2; group 0 needs a public variation input)',
    expected: [rect(0, 52, 16, 67), rect(58, 0, 77, 16), rect(0, 44, 16, 55)] },
  D2: { row: 'R15 SL3/SL5/SL6 example A track pieces', needs: 'engine trace slice pieces',
    expected: [['copy', [0, 5], [0, 5]], ['copy', [115, 120], [44, 49]], ['tile', [5, 44], [5, 44]], ['tile', [44, 83], [5, 44]], ['tile', [83, 115], [5, 37]]] },
  D3: { row: 'R16 SL1/SL4/BL4 example C one-column lines', needs: 'engine trace slice pieces (BL4 lines)',
    expected: [['copy', [6, 0, 10, 2], [0, 0, 4, 2]], ['copy', [6, 98, 10, 100], [0, 3, 4, 5]], ['lines', [6, 2, 10, 98], [0, 2, 4, 3]]] },
  D4: { row: 'R17 SL2 example D halves (1984 h, along 15; vertical twin)', needs: 'engine trace source rects (1984 art is symmetric, so pixels cannot tell halves from caps); along 15 is below the public minimum length 32',
    expected: [[['copy', [0, 8], [0, 8]], ['copy', [8, 15], [42, 49]]], [['copy', [0, 8], [0, 8]], ['copy', [8, 15], [42, 49]]]] },
  D5: { row: 'R11 §5.1 F1 group-2 centre of rows (−10, 5)', needs: 'engine trace band B at a negative R', expected: [-10, 6] },
  D6: { row: 'R19 TK5/§5.4 example A tick rects', needs: 'public group and tick-count inputs', expected: [[0, 10, 16, 15, 23], [25, 33, 16, 38, 23], [50, 57, 16, 62, 23], [75, 81, 16, 86, 23], [100, 105, 16, 110, 23]] },
  D7: { row: 'R20 TK5/§5.4 example B tick rects', needs: 'public group and tick-count inputs', expected: [[0, 84, 16, 87, 23], [50, 48, 16, 51, 23], [100, 13, 16, 16, 23]] },
  D8: { row: 'R21 §5.4 F2 v_i for range 0..10, n = 4', needs: 'public tick count and range', expected: [0, 3, 7, 10] },
  D9: { row: 'R25 §3.3 O-order (example A; message 13)', needs: 'engine trace order', expected: [['erase', 'track', 'thumb', 'ticks', 'composite'], ['erase', 'track', 'ghost', 'thumb', 'ticks', 'composite']] },
  D10: { row: 'R26 HT1–HT4 example A points and a tick-band point', needs: 'driver hit test', expected: [22, 129, 23, 0, 0] },
  D11: { row: 'R27 §5.6 value 50 → Th.left 52 → 49; G.left 53 → 51', needs: 'driver tracking (message 26)', expected: [52, 49, 51] },
  D12: { row: 'R31 pressedPart pageUp/pageDown: pressed track, normal thumb (awaits the slider driver)', needs: 'public pressedPart (DECISIONS #9)',
    expected: { 'h/pageUp': [-10130, 1], 'h/pageDown': [-10130, 1], 'v/pageUp': [-10114, 1], 'v/pageDown': [-10114, 1] } },
};

/**
 * Disagreement classes for one public row (docs/spec/engine/slider.md §8; the
 * slider issue lists them). `pred` = layout() of the row, `predMap` its
 * sourceMap, `obs` = { isNull, size: [w, h], map } where map[y][x] is null
 * (the sentinel `background` the host supplied, BG6: the O4 erase),
 * { id: 'transparent' } (alpha 0: R was not erased or not copied opaque) or
 * { id, x, y } (the sentinel-decoded source pixel).
 *   S1 gate (G1/G2): drew a slider the gate hands off, or vice versa.
 *   S2 thumb cell (TH3, cell map): the thumb drawn from another 16-px cell.
 *   S3 thumb transfer (BL1/TH4): mask-clear thumb pixels erase what is below.
 *   S4 no erase (OS4/OS5, BG5/BG6): pixels of R the decode leaves as the background are transparent.
 *   S5 thumb position (§5.2): the thumb drawn at another along offset.
 *   S6 track middle (SL4/BL4): track middle pixels from other source columns/rows.
 *   S7 track id (TR3/TR4): another track cicn.
 *   SX anything else (an unclassified difference: never expected).
 */
export function classify(pred, predMap, obs) {
  const out = new Set();
  if (pred.gate === 'system') { if (!obs.isNull) out.add('S1'); return [...out]; }
  if (obs.isNull) return ['S1'];
  const w = W(pred.R), hgt = H(pred.R);
  if (obs.size[0] !== w || obs.size[1] !== hgt) return ['SX'];
  const thumbId = pred.sel.thumb, trackId = pred.sel.track, h = pred.horizontal;
  const tPix = [];
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) { const o = obs.map[y][x]; if (o && o.id === thumbId) tPix.push({ x, y, o }); }
  // observed thumb placement: along start = min along coordinate minus the source along offset
  const starts = new Set(tPix.map(({ x, y, o }) => (h ? x - o.x : y - o.y)));
  const cells = new Set(tPix.map(({ o }) => Math.floor((h ? o.y : o.x) / 16)));
  if (pred.thumbOp) {
    const pStart = h ? pred.Th.left : pred.Th.top;
    if ([...cells].some(c => c !== pred.thumbOp.cell)) out.add('S2');
    if ([...starts].some(s => s !== pStart)) out.add('S5');
  }
  const obsStart = starts.size === 1 ? [...starts][0] : null;
  const inObsThumb = (x, y) => obsStart !== null && (h ? x >= obsStart && x < obsStart + pred.tA : y >= obsStart && y < obsStart + pred.tA);
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
    const p = predMap[y][x], seen = obs.map[y][x], transparent = !!seen && seen.id === 'transparent', o = transparent ? null : seen;
    if (p === null && transparent) { out.add('S4'); continue; }   // the decode's O4 background, observed transparent
    if (!transparent && JSON.stringify(p) === JSON.stringify(o)) continue;   // includes the background (null) where the decode leaves it
    if (o && o.id === thumbId) continue;                          // thumb pixels: S2 / S5 above
    if (p && p.id === thumbId) { if (!out.has('S5')) out.add('SX'); continue; }   // decode's thumb pixel; the observed thumb moved
    if (!o) { out.add(p.id === trackId && inObsThumb(x, y) ? 'S3' : 'SX'); continue; }   // track erased under the observed thumb
    if (o.id !== trackId || (p && p.id !== trackId)) { out.add('S7'); continue; }
    out.add('S6');                                                // track pixel from another source pixel, or where the decode leaves background
  }
  return [...out].sort();
}
