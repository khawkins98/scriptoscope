// Progress bar (Kaleidoscope 2.3.1 CDEF 5) gate, state, geometry, draw-order,
// erase, colour, cinf, pattern, idle and data-access rules. Pure ESM; imports
// nothing from src/. Every rule is transcribed from docs/spec/engine/progress.md
// (#430 with the FB1 fix #443) and cites the spec row it mirrors; nothing is
// fitted to runtime output. Addresses are CDEF 5 file offsets, as in the spec.
//
// Coordinates are port pixels; rects are { top, left, bottom, right }, half-open.
// Declared defaults (spec §2): one device at depth >= 8 (lowDepth clear), colour
// port, offscreen (one direct pass, DRAW4), not recording, pen visible, visible
// true, the archive's own fork as the resource chain (CHAIN3), output buffer = R
// starting transparent (ERASE3).

export const SLUGS = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'apple-platinum-2', 'beos-r503', 'black-platinum', 'crayon-os', 'dolphin-som',
  'evolution', 'floppies', 'monkey-paradise', 'platinum-8', 'slimes', 'system7-nostalgia-silver', 'windows-31', 'windows-95'];
/** Spec §6 corpus table: GATE4 (Kaleidoscope art) and GATE2 (procedural bar) archives. */
export const GATE4 = ['1138', '1984', '1990', 'apple-lisa', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'windows-31', 'windows-95'];
export const PROCEDURAL = ['animals', 'apple-platinum-2', 'beos-r503', 'black-platinum', 'monkey-paradise', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
export const ID = {
  frame: -10080, inactiveFrame: -10077,                 // GATE1 CDEF 5 0x370, 0x38a, 0x3a6
  patternActive: -10080, patternInactive: -10072,       // §4.7 F_p
  fbCicn: -10224, fbPpat: -10064, neverRequested: -10223,   // FB1, FB8, §3.1
};
/** Every id CDEF 5 can request, plus -10223 (shipped, never requested). */
export const inProgressRange = id => (id >= -10080 && id <= -10064) || id === -10224 || id === -10223;
export const HILITE = { inactive: 254, disabled: 255 };
export const DATA_TAG = 'inde', ERR_DATA_NOT_SUPPORTED = -30581, FEATURES = 72;     // §1.2

/** The decode, as named rules. A wrong reading overrides one of them (mutation tests only). */
export const DECODE = {
  frameBytes: [0, 1, 2],                          // CINF2: frame k, s, tile = cinf bytes 0, 1, 2
  rect14: true,                                   // RECT1 0x15a..0x188: R forced to 14 rows
  inactiveNeedsCinf: true,                        // GATE1/GATE1a 0x376..0x3a6
  gate: 'cinf+cicn',                              // GATE2/GATE3 0x3bc..0x3ec ('cicn': gate on the frame cicn alone)
  retryActiveFrame: false,                        // GATE3: no retry of -10080 after a missing cicn -10077
  perPartFallback: false,                         // GATE1a: no per-part inactive -> active fallback
  gate4Declines: false,                           // GATE4: never declines after the frame
  inset: (k, s) => (k > 2 ? k : 2),               // INSET1/INSET2 0x3fc..0x430 (horizontal inset)
  insetVertical: (k, s) => s,                     // §5.2 vertical inset s
  split: (w, offset, range) => Math.trunc((w * offset) / range),   // §5.3 trunc
  clamp: false,                                   // DET3: no clamp
  rangeZero: 'one',                               // DET2: range 0 taken as 1 ('full': x = I.right)
  sliceNeedsCinf: true,                           // SLICE1
  artRows: 'centre',                              // SLICE2 ('stretch' | 'clip' | 'top')
  halves: true,                                   // SLICE3
  secondHalf: L => Math.trunc(L / 2),             // §5.4 halves: piece 2 is trunc(L / 2) wide
  invertedCopies: false,                          // DET4: an empty or inverted T copies nothing
  capClamp: null,                                 // SLICE4: cap = cinf byte 0, no clamp (old runtime: 4)
  capByte: 0,                                     // CINF2: fill/track cap from byte 0
  middleOneColumn: byte2 => byte2 === 0,          // SLICE5 / SLICE6
  stretchMiddle: false,                           // SLICE7: tiles 1:1, never stretched
  endAnchor: byte3 => byte3 !== 0,                // SLICE7
  frameTileFlag: byte2 => byte2 !== 0,            // FRAME5/FRAME6
  frameBandWholeMiddle: false,                    // FRAME5: tile = 0 uses the one column at c
  frameStretch: false,                            // FRAME5/FRAME6: never 9-slice stretched
  frameBody: false,                               // FRAME8: no body
  frameOrder: ['TL', 'TR', 'top', 'BL', 'BR', 'bottom', 'left', 'right'],   // FRAME3
  cutKeeps: 'anchor',                             // BLIT6: forward cut keeps leading, reverse trailing
  masked: true,                                   // BLIT1/BLIT3-5 CopyMask
  erase: false,                                   // ERASE1
  ind6Paint: false,                               // IND6: nothing inside I
  probeOffset: 1,                                 // IND1: probe F_p + 1 ('phase': F_p + phase)
  frameModeLimit: 8,                              // IND2/IND3
  writeBack: true,                                // IND2/IND3 phase := 0 written back
  shiftStep: 4,                                   // IND5 / FB8
  shiftResets: false,                             // IND5: phase not reset
  inactivePatternBase: true,                      // §4.7 F_p = -10072 when inactive
  mod: (a, n) => ((a % n) + n) % n,               // §5.5 non-negative remainder
  patternTiled: true,                             // §5.5 / ERASE4: the pattern repeats over P
  fbSamples: { br: [11, 13], tl: [0, 0], ring: [1, 1] },   // FB1-FB3 (#443)
  fbFullRing: false,                              // FB1/FB2 leave (R.left, R.bottom - 1), (R.right - 1, R.top)
  fbStateDependent: false,                        // FB10
  fb9Paint: false,                                // FB9 declared policy: nothing
  fbInset: 2,                                     // FB6
  fbParts: ['dark', 'lavender'],                  // FB7: filled part dark grey, empty part lavender
  col3: { dark: [0x4445, 0x4444, 0x4444], lavender: [0xcccc, 0xcccc, 0xffff] },   // COL3
  col1: 'decode',                                 // COL1 ('firstMatch')
  col2IgnoresMask: true,                          // COL2
  shortCinfMissing: true,                         // CINF3 declared policy
  dataAnyTag: false,                              // DATA3
  idleStrict: false,                              // IDLE2 >= ('>' when true)
  idleAdvancesDeterminate: false,                 // IDLE2 needs the flag
  idleTicks: 3,                                   // IDLE2
  hitPart: 0,                                     // HIT1
};
const rd = reading => ({ ...DECODE, ...reading });
const s16 = (d, at) => (((d[at] << 8) | d[at + 1]) << 16) >> 16;
const u32 = (d, at) => ((d[at] << 24) >>> 0) + (d[at + 1] << 16) + (d[at + 2] << 8) + d[at + 3];
export const rect = (top, left, bottom, right) => ({ top, left, bottom, right });
export const W = b => b.right - b.left, H = b => b.bottom - b.top;
const empty = r => r.right <= r.left || r.bottom <= r.top;

/**
 * Census from a parsed fork (checkable-rules.mjs parseResourceMap): every
 * progress cinf (all its bytes), cicn (iconPMap bounds at +6, Inside Macintosh:
 * Imaging 4-58) and ppat (its PixMap bounds; patMap offset at +2, Imaging 4-102).
 */
export function progressCensus(map) {
  const cinf = new Map(), cicn = new Map(), ppat = new Map();
  for (const r of map.filter(r => inProgressRange(r.id))) {
    if (r.type === 'cinf') cinf.set(r.id, [...r.data]);
    if (r.type === 'cicn') cicn.set(r.id, rect(s16(r.data, 6), s16(r.data, 8), s16(r.data, 10), s16(r.data, 12)));
    if (r.type === 'ppat') { const pm = u32(r.data, 2); ppat.set(r.id, { width: s16(r.data, pm + 12) - s16(r.data, pm + 8), height: s16(r.data, pm + 10) - s16(r.data, pm + 6) }); }
  }
  return { cinf, cicn, ppat };
}
/** A synthetic census: { cinf: {id: bytes}, cicn: {id: [w, h]}, ppat: {id: [w, h]} }. */
export function synthetic({ cinf = {}, cicn = {}, ppat = {} } = {}) {
  const m = (o, f) => new Map(Object.entries(o).map(([k, v]) => [Number(k), f(v)]));
  return { cinf: m(cinf, v => [...v]), cicn: m(cicn, ([w, h]) => rect(0, 0, h, w)), ppat: m(ppat, ([width, height]) => ({ width, height })) };
}

// CINF2/CINF3: the highest byte each reader takes; a shorter cinf is treated as missing (declared policy).
const FRAME_BYTES = 3, ART_BYTES = 4;
function cinfOf(census, id, need, r) {
  const b = census.cinf.get(id);
  if (!b) return null;
  if (b.length < need) return r.shortCinfMissing ? null : [...b, 0, 0, 0, 0].slice(0, Math.max(need, b.length));
  return b;
}

/** §4.3 gate and state: { path, inactive, F }. */
export function gate({ hilite = 0 }, census, { reading = {} } = {}) {
  const r = rd(reading);
  const wantsInactive = hilite === HILITE.inactive || hilite === HILITE.disabled;
  const inactive = wantsInactive && (!r.inactiveNeedsCinf || census.cinf.has(ID.inactiveFrame));          // GATE1 / GATE1a
  let F = inactive ? ID.inactiveFrame : ID.frame;
  const frameCinf = cinfOf(census, F, FRAME_BYTES, r);
  if (r.gate === 'cicn') return census.cicn.has(F) ? { path: 'kaleidoscope', inactive, F } : { path: 'procedural', inactive, F };   // mutation
  if (!frameCinf) return { path: 'procedural', inactive, F };                                                // GATE2
  if (!census.cicn.has(F)) {                                                                                  // GATE3
    if (r.retryActiveFrame && F !== ID.frame && census.cicn.has(ID.frame) && census.cinf.has(ID.frame)) F = ID.frame;
    else return { path: 'procedural', inactive, F };
  }
  return { path: 'kaleidoscope', inactive, F };                                                               // GATE4
}

/** §5.3 split. */
export function split(Iv, { value, min, max }, { reading = {} } = {}) {
  const r = rd(reading);
  const w = Iv.right - Iv.left;
  let range = max - min, offset = value - min;                     // sign-extended 16-bit differences, no wrap
  if (range === 0) { if (r.rangeZero === 'full') return Iv.right; range = 1; }   // DET2
  if (r.clamp) offset = Math.max(0, Math.min(range, offset));
  return ((Iv.left + r.split(w, offset, range)) << 16) >> 16;       // stored as 16 bits
}

/**
 * Tiler (BLIT3-BLIT6) pieces for source `src` into `dst`: 'hlines' (one-column
 * source, BLIT3), 'vlines' (one-row source, BLIT4) or 'copy' tiles (BLIT5/BLIT6).
 */
export function tiler(src, dst, { anchor = 'start', reading = {} } = {}) {
  const r = rd(reading);
  if (empty(src) || empty(dst)) return [];                          // BLIT8
  if (W(src) === 1 && W(dst) > 1) return [{ kind: 'hlines', src, dst }];
  if (H(src) === 1 && H(dst) > 1) return [{ kind: 'vlines', src, dst }];
  const alongX = H(dst) === H(src), m = alongX ? W(src) : H(src), [d0, d1] = alongX ? [dst.left, dst.right] : [dst.top, dst.bottom];
  const [s0, s1] = alongX ? [src.left, src.right] : [src.top, src.bottom];
  const keepLeading = r.cutKeeps === 'anchor' ? anchor === 'start' : r.cutKeeps === 'leading';
  const out = [], piece = (da, sa) => ({ kind: 'copy', src: alongX ? rect(src.top, sa[0], src.bottom, sa[1]) : rect(sa[0], src.left, sa[1], src.right),
    dst: alongX ? rect(dst.top, da[0], dst.bottom, da[1]) : rect(da[0], dst.left, da[1], dst.right) });
  if (anchor === 'start') for (let p = d0; p < d1; p += m) { const len = Math.min(m, d1 - p); out.push(piece([p, p + len], keepLeading ? [s0, s0 + len] : [s1 - len, s1])); }
  else for (let p = d1; p > d0; p -= m) { const len = Math.min(m, p - d0); out.push(piece([p - len, p], keepLeading ? [s0, s0 + len] : [s1 - len, s1])); }
  return out;
}

/** §4.4 / §5.1 frame pieces from cicn bounds B and cinf bytes into D. */
export function framePieces(B, bytes, D, { reading = {} } = {}) {
  const r = rd(reading);
  const [c, s, t] = r.frameBytes.map(i => bytes[i]), tile = r.frameTileFlag(t);
  const Wb = W(B), Hb = H(B), cw = Math.min(c, Wb), ch = Math.min(c, Hb), sw = Math.min(s, Wb), sh = Math.min(s, Hb);
  const whole = tile || r.frameBandWholeMiddle;
  const e = whole ? Wb - c : c + 1, f = whole ? Hb - c : c + 1;
  const rel = (t, l, b, rr) => rect(B.top + t, B.left + l, B.top + b, B.left + rr);
  const spec = {
    TL: ['copy', rel(0, 0, ch, cw), rect(D.top, D.left, D.top + ch, D.left + cw)],
    TR: ['copy', rel(0, Wb - cw, ch, Wb), rect(D.top, D.right - cw, D.top + ch, D.right)],
    top: ['band', rel(0, c, sh, e), rect(D.top, D.left + c, D.top + sh, D.right - c)],
    BL: ['copy', rel(Hb - ch, 0, Hb, cw), rect(D.bottom - ch, D.left, D.bottom, D.left + cw)],
    BR: ['copy', rel(Hb - ch, Wb - cw, Hb, Wb), rect(D.bottom - ch, D.right - cw, D.bottom, D.right)],
    bottom: ['band', rel(Hb - sh, c, Hb, e), rect(D.bottom - sh, D.left + c, D.bottom, D.right - c)],
    left: ['band', rel(c, 0, f, sw), rect(D.top + c, D.left, D.bottom - c, D.left + sw)],
    right: ['band', rel(c, Wb - sw, f, Wb), rect(D.top + c, D.right - sw, D.bottom - c, D.right)],
  };
  const out = [];
  for (const name of r.frameOrder) {
    const [kind, src, dst] = spec[name];
    if (kind === 'copy') { if (!empty(dst) && !empty(src)) out.push({ name, kind: 'copy', src, dst }); continue; }
    if (r.frameStretch) {                                                                      // mutation: 9-slice stretch
      const mid = name === 'top' || name === 'bottom' ? rect(src.top, B.left + c, src.bottom, B.right - c) : rect(B.top + c, src.left, B.bottom - c, src.right);
      if (!empty(dst)) out.push({ name, kind: 'stretch', src: mid, dst });
      continue;
    }
    for (const p of tiler(src, dst, { reading })) out.push({ name, ...p });
  }
  if (r.frameBody) out.push({ name: 'body', kind: 'stretch', src: rel(c, c, Hb - c, Wb - c), dst: rect(D.top + c, D.left + c, D.bottom - c, D.right - c) });   // mutation: legacy centre cell
  return { c, s, tile: t, pieces: out };
}

/** §4.8 / §5.4 fill or track pieces for art bounds S and cinf bytes into target T. */
export function slicePieces(S, bytes, T, { reading = {} } = {}) {
  const r = rd(reading);
  let a = bytes[r.capByte];
  if (r.capClamp !== null) a = Math.min(r.capClamp, a);
  const Sh = H(S), L0 = ((T.right - T.left) << 16) >> 16, L = r.invertedCopies ? Math.abs(L0) : L0;
  let rows = (() => { const top = Math.trunc((T.top + T.bottom - Sh) / 2); return [top, top + Sh]; })();   // SLICE2
  if (r.artRows === 'top') rows = [T.top, T.top + Sh];
  const stretchRows = r.artRows === 'stretch', clipRows = r.artRows === 'clip';
  const at = (x0, x1) => (stretchRows ? rect(T.top, x0, T.bottom, x1) : clipRows ? rect(Math.max(rows[0], T.top), x0, Math.min(rows[1], T.bottom), x1) : rect(rows[0], x0, rows[1], x1));
  const sr = (x0, x1) => (clipRows ? rect(S.top + Math.max(0, T.top - rows[0]), x0, S.bottom - Math.max(0, rows[1] - T.bottom), x1) : rect(S.top, x0, S.bottom, x1));
  const copy = (sx, dx) => ({ kind: stretchRows ? 'stretch' : 'copy', src: sr(sx[0], sx[1]), dst: at(dx[0], dx[1]) });
  const out = [];
  if (r.halves && L <= 2 * a) {                                                                     // SLICE3
    const p = Math.trunc((L + 1) / 2), q = r.secondHalf(L);
    if (p > 0) out.push(copy([S.left, S.left + p], [T.left, T.left + p]));
    if (q > 0) out.push(copy([S.right - q, S.right], [T.right - q, T.right]));
    return out;
  }
  if (L <= 0) return out;                                                                            // DET4
  out.push(copy([S.left, S.left + a], [T.left, T.left + a]), copy([S.right - a, S.right], [T.right - a, T.right]));   // SLICE4
  const M = [T.left + a, T.right - a];
  if (M[1] <= M[0]) return out;
  const oneCol = r.middleOneColumn(bytes[2]);
  const ms = oneCol ? [S.left + a, S.left + a + 1] : [S.left + a, S.right - a];                      // SLICE5 / SLICE6
  if (r.stretchMiddle) { out.push({ kind: 'stretch', src: sr(S.left + a, S.right - a), dst: at(M[0], M[1]) }); return out; }
  if (ms[1] <= ms[0]) return out;                                                                    // §6 item 6
  for (const p of tiler(sr(ms[0], ms[1]), at(M[0], M[1]), { anchor: r.endAnchor(bytes[3]) ? 'end' : 'start', reading })) out.push(p);   // SLICE7
  return out;
}

/** §4.7 pattern selection: { id, point, phaseAfter, mode } or { id: null }. */
export function selectPattern(I, { phase = 0 }, census, inactive, { reading = {} } = {}) {
  const r = rd(reading);
  const Fp = inactive && r.inactivePatternBase ? ID.patternInactive : ID.patternActive;
  const probe = r.probeOffset === 'phase' ? Fp + phase : Fp + r.probeOffset;
  if (census.ppat.has(probe)) {                                                                     // frame mode
    let p = phase, id;
    if (p < r.frameModeLimit && census.ppat.has(Fp + p)) id = Fp + p;                               // IND2
    else { id = Fp; if (r.writeBack) p = 0; }                                                       // IND2 missing / IND3
    if (!census.ppat.has(id)) return { mode: 'frame', Fp, id: null, phaseAfter: p };               // IND6
    return { mode: 'frame', Fp, id, point: { x: I.left, y: I.top }, phaseAfter: p };               // IND4
  }
  let p = phase;
  if (r.shiftResets && p >= 8) p = 0;                                                               // mutation
  if (!census.ppat.has(Fp)) return { mode: 'shift', Fp, id: null, phaseAfter: p };                 // IND6
  return { mode: 'shift', Fp, id: Fp, point: { x: I.left + r.shiftStep * p, y: I.top }, phaseAfter: p };   // IND5
}

/**
 * One draw (message 0) laid out from the spec. `native` = { rect, hilite,
 * value, min, max, indeterminate, phase }.
 */
export function layout(native, census, { reading = {} } = {}) {
  const r = rd(reading);
  const R0 = native.rect, R = r.rect14 ? { ...R0, bottom: R0.top + 14 } : { ...R0 };                // RECT1 / RECT2
  const g = gate(native, census, { reading });
  const ind = !!native.indeterminate, phase = native.phase ?? 0;
  const base = { R, path: g.path, inactive: g.inactive, F: g.F, indeterminate: ind, phaseIn: phase, phaseAfter: phase };
  if (g.path === 'procedural') return { ...base, procedural: procedural(R, native, census, { reading }) };
  const F = g.F;
  const fb = cinfOf(census, F, FRAME_BYTES, r);
  const frame = { id: F, ...framePieces(census.cicn.get(F), fb, R, { reading }) };
  const k = frame.c, s = frame.s, h = r.inset(k, s);
  const I = rect(R.top + r.insetVertical(k, s), R.left + h, R.bottom - r.insetVertical(k, s), R.right - h);   // §5.2
  const out = { ...base, frame, I };
  if (ind) {
    const pat = selectPattern(I, native, census, g.inactive, { reading });
    return { ...out, pattern: pat.id === null ? null : { id: pat.id, point: pat.point, dst: I, mode: pat.mode }, patternMode: pat.mode, phaseAfter: pat.phaseAfter };
  }
  const x = split(I, native, { reading });
  const part = (offset, T) => {
    let id = F + offset;
    const has = j => census.cicn.has(j) && (!r.sliceNeedsCinf || !!cinfOf(census, j, ART_BYTES, r));
    if (!has(id) && r.perPartFallback && F === ID.inactiveFrame && has(ID.frame + offset)) id = ID.frame + offset;   // mutation
    if (!has(id)) return null;                                                                       // SLICE1
    const bytes = cinfOf(census, id, ART_BYTES, r) ?? [0, 0, 0, 0];
    return { id, T, pieces: slicePieces(census.cicn.get(id), bytes, T, { reading }) };
  };
  const fill = part(1, rect(I.top, I.left, I.bottom, x)), track = part(2, rect(I.top, x, I.bottom, I.right));   // DET1
  if (r.gate4Declines && (!fill || !track)) return { ...base, path: 'procedural', procedural: procedural(R, native, census, { reading }) };   // mutation
  return { ...out, x, fill, track };
}

/** §4.9 / §5.6 procedural bar. */
export function procedural(R, native, census, { reading = {} } = {}) {
  const r = rd(reading);
  const has = census.cicn.has(ID.fbCicn), ops = [];
  const sample = ([x, y]) => ({ id: ID.fbCicn, x, y });
  const hline = (y, x0, x1, c) => ops.push({ kind: 'line', c, pts: Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y]) });
  const vline = (x, y0, y1, c) => ops.push({ kind: 'line', c, pts: Array.from({ length: y1 - y0 + 1 }, (_, i) => [x, y0 + i]) });
  let ring = { rgb: 'black' };                                                                       // FB4 / O2
  if (has) {
    const br = sample(r.fbSamples.br), tl = sample(r.fbSamples.tl);
    hline(R.bottom - 1, r.fbFullRing ? R.left : R.left + 1, R.right - 1, br);                          // FB1
    vline(R.right - 1, r.fbFullRing ? R.top : R.top + 1, R.bottom - 1, br);
    vline(R.left, R.top, r.fbFullRing ? R.bottom - 1 : R.bottom - 2, tl);                              // FB2
    hline(R.top, R.left, r.fbFullRing ? R.right - 1 : R.right - 2, tl);
    ring = sample(r.fbSamples.ring);                                                                  // FB3
  }
  const F1 = rect(R.top + 1, R.left + 1, R.bottom - 1, R.right - 1);                                  // FB5 FrameRect
  hline(F1.top, F1.left, F1.right - 1, ring); hline(F1.bottom - 1, F1.left, F1.right - 1, ring);
  vline(F1.left, F1.top, F1.bottom - 1, ring); vline(F1.right - 1, F1.top, F1.bottom - 1, ring);
  const n = r.fbInset, If = rect(R.top + n, R.left + n, R.bottom - n, R.right - n);                    // FB6
  const inactive = native.hilite === HILITE.inactive || native.hilite === HILITE.disabled;
  let xf = null, pattern = null, unspecified = false;
  if (r.fbStateDependent && inactive) ops.push({ kind: 'paint', c: { rgb: 'lavender' }, dst: If });    // mutation
  else if (!native.indeterminate) {
    xf = split(If, native, { reading });                                                              // FB7
    ops.push({ kind: 'paint', c: { rgb: r.fbParts[0] }, dst: rect(If.top, If.left, If.bottom, xf) }, { kind: 'paint', c: { rgb: r.fbParts[1] }, dst: rect(If.top, xf, If.bottom, If.right) });
  } else if (census.ppat.has(ID.fbPpat)) {                                                           // FB8
    pattern = { id: ID.fbPpat, point: { x: If.left + r.shiftStep * (native.phase ?? 0), y: If.top }, dst: If };
    ops.push({ kind: 'pattern', ...pattern });
  } else {                                                                                            // FB9
    unspecified = true;
    if (r.fb9Paint) ops.push({ kind: 'paint', c: { rgb: 'lavender' }, dst: If });
  }
  return { sampled: has, If, xf, pattern, unspecified, ops };
}

/**
 * Source map of R after the draw: map[y][x] is null (transparent: no step
 * covered it, ERASE2/ERASE3), 'erased' (mutation only), { t: 'cicn' | 'ppat',
 * id, x, y } (the source pixel that reached it) or { rgb: 'dark' | 'lavender' |
 * 'black' } (COL3). `mask(id, x, y)` reads a cicn's mask bit at source
 * coordinates (every corpus progress cicn has bounds at 0, 0, COL1b).
 */
export function sourceMap(l, mask, census, { reading = {} } = {}) {
  const r = rd(reading), R = l.R, w = W(R), hgt = H(R);
  const map = Array.from({ length: hgt }, () => Array(w).fill(r.erase ? 'erased' : null));
  const put = (x, y, v) => { if (x >= R.left && x < R.right && y >= R.top && y < R.bottom) map[y - R.top][x - R.left] = v; };
  const cicn = (id, x, y) => ({ t: 'cicn', id, x, y });
  const draw = (id, p) => {
    const { src, dst } = p;
    if (p.kind === 'copy') {
      for (let y = dst.top; y < dst.bottom; y++) for (let x = dst.left; x < dst.right; x++) {
        const sx = src.left + x - dst.left, sy = src.top + y - dst.top;
        if (!r.masked || mask(id, sx, sy)) put(x, y, cicn(id, sx, sy));
      }
    } else if (p.kind === 'stretch') {
      for (let y = dst.top; y < dst.bottom; y++) for (let x = dst.left; x < dst.right; x++) {
        const sx = src.left + Math.floor(((x - dst.left) * W(src)) / W(dst)), sy = src.top + Math.floor(((y - dst.top) * H(src)) / H(dst));
        if (!r.masked || mask(id, sx, sy)) put(x, y, cicn(id, sx, sy));
      }
    } else if (p.kind === 'hlines') {                                                                 // BLIT3
      for (let sy = src.top; sy < src.bottom && dst.top + sy - src.top < dst.bottom; sy++) if (!r.masked || mask(id, src.left, sy))
        for (let x = dst.left; x < dst.right; x++) put(x, dst.top + sy - src.top, cicn(id, src.left, sy));
    } else if (p.kind === 'vlines') {                                                                 // BLIT4
      for (let sx = src.left; sx < src.right && dst.left + sx - src.left < dst.right; sx++) if (!r.masked || mask(id, sx, src.top))
        for (let y = dst.top; y < dst.bottom; y++) put(dst.left + sx - src.left, y, cicn(id, sx, src.top));
    }
  };
  const fillPattern = ({ id, point, dst }) => {                                                       // §5.5, ERASE4
    const { width: pw, height: ph } = census.ppat.get(id);
    for (let y = dst.top; y < dst.bottom; y++) for (let x = dst.left; x < dst.right; x++) {
      const dx = x - point.x, dy = y - point.y;
      if (!r.patternTiled && (dx < 0 || dx >= pw || dy < 0 || dy >= ph)) continue;
      put(x, y, { t: 'ppat', id, x: r.mod(dx, pw), y: r.mod(dy, ph) });
    }
  };
  if (l.path === 'procedural') {
    for (const op of l.procedural.ops) {
      const v = op.c && (op.c.rgb ? { rgb: op.c.rgb } : cicn(op.c.id, op.c.x, op.c.y));
      if (op.kind === 'line') for (const [x, y] of op.pts) put(x, y, v);
      if (op.kind === 'paint') for (let y = op.dst.top; y < op.dst.bottom; y++) for (let x = op.dst.left; x < op.dst.right; x++) put(x, y, v);
      if (op.kind === 'pattern') fillPattern(op);
    }
    return map;
  }
  const body = l.frame.pieces.filter(p => p.name === 'body');
  for (const p of l.frame.pieces.filter(p => p.name !== 'body')) draw(l.frame.id, p);                  // O4 frame
  if (l.indeterminate) {
    if (l.pattern) fillPattern(l.pattern);
    else if (r.ind6Paint) for (let y = l.I.top; y < l.I.bottom; y++) for (let x = l.I.left; x < l.I.right; x++) put(x, y, { rgb: 'lavender' });
  } else {
    for (const part of [l.fill, l.track]) if (part) for (const p of part.pieces) draw(part.id, p);      // DET1: fill, then track
  }
  for (const p of body) draw(l.frame.id, p);
  return map;
}

/** COL1 colour lookup: `table` = [{ value, rgb }], `pixel` = the stored pixel value. Returns the entry index used. */
export function col1Entry(table, pixel, { reading = {} } = {}) {
  const r = rd(reading);
  if (r.col1 === 'firstMatch') { const i = table.findIndex(e => e.value === pixel); return i < 0 ? 0 : i; }
  if (pixel < table.length && table[pixel].value === pixel) return pixel;
  if (table.at(-1).value === 0) return pixel;                                       // by position (undefined past the end: no corpus case)
  for (let i = table.length - 1; i >= 0; i--) if (table[i].value === pixel) return i;
  return 0;
}
/** COL2: an FB sample of cicn pixel (x, y); `maskSet` its mask bit. Returns the pixel or null (mutation only). */
export function col2Sample(pixel, maskSet, { reading = {} } = {}) { return rd(reading).col2IgnoresMask || maskSet ? pixel : null; }

// ---- message-level rules (§1.2, §4.10, §4.15). A record is { indeterminate, idleTime, phase }.
export const newRecord = () => ({ indeterminate: 0, idleTime: 0, phase: 0 });          // IDLE1 / message 3
export function setData(rec, tag, bytes, { reading = {} } = {}) {                     // DATA1 / DATA3 / IDLE4
  if (tag !== DATA_TAG && !rd(reading).dataAnyTag) return ERR_DATA_NOT_SUPPORTED;
  rec.indeterminate = bytes[0] & 0xff; return 0;
}
export function getData(rec, tag, { reading = {} } = {}) {                            // DATA2 / DATA3
  if (tag !== DATA_TAG && !rd(reading).dataAnyTag) return { result: ERR_DATA_NOT_SUPPORTED };
  return { result: 0, size: 1, byte: rec.indeterminate };
}
/** Message 18 (IDLE2/IDLE3): returns the number of draws. */
export function idle(rec, ticks, { reading = {} } = {}) {
  const r = rd(reading), t = ticks >>> 0, due = (rec.idleTime + r.idleTicks) >>> 0;   // unsigned compare
  const reached = r.idleStrict ? t > due : t >= due;
  if ((rec.indeterminate || r.idleAdvancesDeterminate) && reached) { rec.phase = (rec.phase + 1) & 0xff; rec.idleTime = ticks; return 2; }
  return 1;
}
/** HIT1 / HIT2. */
export const hitTest = (_l, _P, { reading = {} } = {}) => rd(reading).hitPart;
export const region = l => ({ ...l.R });

// ---------------------------------------------------------------------------
// Public mapping (DECISIONS #10, #11; spec §2 "Scriptoscope mapping"). MODERN
// POLICY, not a decode: composeProgress draws R = (0, 0, 14, length); 'normal'
// and 'pressed' are hilite 0, 'inactive' 254, 'disabled' 255; `range` is the
// native value/min/max; a normalized `value` maps to min 0, max 10000,
// value = trunc(clamp(v) × 10000).
export const STATE_HILITE = { normal: 0, pressed: 0, inactive: 254, disabled: 255 };
export const FACADE = { min: 0, max: 10000, defaultValue: 0.5 };
export function nativeFor(row, { stateHilite = STATE_HILITE, normalize = v => Math.trunc(v * FACADE.max) } = {}) {
  const { state = 'normal', length = 100, range, value, indeterminate = false, phase = 0 } = row;
  const v = range ?? { value: FACADE.min + normalize(Math.min(1, Math.max(0, value ?? FACADE.defaultValue))), min: FACADE.min, max: FACADE.max };
  return { rect: rect(0, 0, 14, length), hilite: stateHilite[state], ...v, indeterminate, phase };
}
/** The public rows the browser spec draws on every archive (progress-rules.spec.mjs). */
export const PUBLIC_ROWS = [
  { key: 'normal/100/50of100', length: 100, range: { value: 50, min: 0, max: 100 } },
  { key: 'normal/40/3of10', length: 40, range: { value: 3, min: 0, max: 10 } },              // example B: trunc 12, round 13
  { key: 'normal/40/1of4', length: 40, range: { value: 1, min: 0, max: 4 } },               // x = 11, fill L = 9: odd-length halves (§5.4, 1984 [2,7)<-[0,5), [7,11)<-[14,18))
  { key: 'normal/100/29of96', length: 100, range: { value: 29, min: 0, max: 96 } },           // fill L = 29 (SLICE7 hook)
  { key: 'normal/100/-10of100', length: 100, range: { value: -10, min: 0, max: 100 } },       // DET3 under: x = -7
  { key: 'normal/100/150of100', length: 100, range: { value: 150, min: 0, max: 100 } },       // DET3 over: x = 146
  { key: 'normal/100/5of5..5', length: 100, range: { value: 5, min: 5, max: 5 } },            // DET2
  { key: 'normal/104/v0.57', length: 104, value: 0.57 },                                      // facade trunc: 5699 -> x = 58 (round: 59)
  { key: 'normal/160/default', length: 160 },
  { key: 'pressed/100/50of100', state: 'pressed', length: 100, range: { value: 50, min: 0, max: 100 } },
  { key: 'inactive/100/50of100', state: 'inactive', length: 100, range: { value: 50, min: 0, max: 100 } },
  { key: 'disabled/100/50of100', state: 'disabled', length: 100, range: { value: 50, min: 0, max: 100 } },
  { key: 'inactive/40/3of10', state: 'inactive', length: 40, range: { value: 3, min: 0, max: 10 } },
  ...[0, 1, 2, 3, 4, 9].map(phase => ({ key: `normal/ind/phase${phase}`, length: 100, indeterminate: true, phase })),
  { key: 'inactive/ind/phase2', state: 'inactive', length: 100, indeterminate: true, phase: 2 },
  { key: 'disabled/ind/phase9', state: 'disabled', length: 100, indeterminate: true, phase: 9 },
];
