// Source-addressed structure-region oracle (Kaleidoscope 2.3.1 kDEF 0, wCalcRgns)
// for the #597 web host policy tests (docs/spec/engine/hit-regions.md §4.2, §4.3,
// §4.6 and §9.8 "Fixtures").
//
// Pure ESM, no Node or DOM dependencies. Nothing here imports src/. The layout
// (placed cells) comes from window-chrome-rules.mjs, itself transcribed from
// window-widgets.md and checked against every corpus window; the template mask
// is the archive's own decoded chrome cicn (alpha 0 = mask bit clear). Points are
// chosen from this decode, never from the runtime's region, canvas, clip string
// or elementFromPoint (§9.8).
//
// Region values: OUT (excluded), IN (in S), UNKNOWN (a scaled cell pixel whose
// MapRgn rounding the decode does not fix, §5: "QuickDraw's own scaling; not
// re-derived here"). Fixtures never pick UNKNOWN pixels or their neighbours.

import { layoutWindow, cellRects, DECLARED_FLAGS, POPUP_CREATION } from './window-chrome-rules.mjs';

export const OUT = 0, IN = 1, UNKNOWN = 2;
const empty = r => r.right <= r.left || r.bottom <= r.top;
const TR4_CODES = new Set([11, 14]); // SR9: direction 0 for part codes 11 and 14

/**
 * Mutations a fixture or hook must reject (hit-regions §7, mirrored for the
 * oracle's own node test). Never set in a real fixture.
 */
export const REGION_MUTATIONS = Object.freeze({
  noMask: 'T1: build the structure from the placed cell rects without the mask',
  invertMask: 'T2: invert the mask',
  cellsOnly: 'T3: union only cells, not C',
  scaleTiles: 'T4: scale a tiled cell instead of repeating it',
  forwardAll: 'T4: anchor codes 11/14 at the top-left',
  reverseAll: 'T4: anchor direction 1 at the bottom-right',
  tile18: 'T5: tile code 18 instead of scaling it',
  bbox: 'T8: fill the structure\'s bounding box',
  fourSidesCollapsed: 'T12: walk four sides when collapsed',
});

/**
 * Scaled (MapRgn) membership of destination pixel (dx, dy) of `dst` from source
 * `src` (SR8, TR1). Exact on an axis scaled by a whole factor, or when the
 * destination pixel and its two neighbours map into one source pixel; UNKNOWN
 * otherwise (rounding not decoded).
 */
function scaledAt(maskAt, src, dst, dx, dy) {
  const sw = src.right - src.left, sh = src.bottom - src.top, dw = dst.right - dst.left, dh = dst.bottom - dst.top;
  const axis = (d, dlo, dn, slo, sn) => {
    // An integer upscale maps every source edge to a whole destination pixel: exact.
    if (dn % sn === 0) return slo + Math.floor(((d - dlo) * sn) / dn);
    const lo = Math.floor(((d - 1 - dlo) * sn) / dn), hi = Math.floor(((d + 2 - dlo) * sn - 1) / dn);
    const a = Math.max(0, Math.min(sn - 1, lo)), b = Math.max(0, Math.min(sn - 1, hi));
    return a === b ? slo + a : null;
  };
  const sx = axis(dx, dst.left, dw, src.left, sw), sy = axis(dy, dst.top, dh, src.top, sh);
  if (sx !== null && sy !== null) return maskAt(sx, sy) ? IN : OUT;
  // Uniform over every source pixel the neighbourhood can reach: still exact.
  const xs = sx !== null ? [sx] : range(src.left, src.right), ys = sy !== null ? [sy] : range(src.top, src.bottom);
  let any = false, all = true;
  for (const y of ys) for (const x of xs) { const m = maskAt(x, y); any ||= m; all &&= m; }
  return all ? IN : !any ? OUT : UNKNOWN;
}
const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);
const mod = (a, n) => ((a % n) + n) % n;

/** Membership of one placed cell's pixel (SR7–SR9, TR1–TR4). */
export function cellAt(maskAt, code, src, dst, x, y, mutation) {
  const sw = src.right - src.left, sh = src.bottom - src.top, dw = dst.right - dst.left, dh = dst.bottom - dst.top;
  if (mutation === 'noMask') return IN;
  const m = (sx, sy) => (mutation === 'invertMask' ? !maskAt(sx, sy) : maskAt(sx, sy));
  if (code === 18 && mutation !== 'tile18') return sw === dw && sh === dh ? (m(src.left + x - dst.left, src.top + y - dst.top) ? IN : OUT) : scaledAt(m, src, dst, x, y); // SR8
  if (sw <= 1 || sh <= 1 || mutation === 'scaleTiles') return sw === dw && sh === dh ? (m(src.left + x - dst.left, src.top + y - dst.top) ? IN : OUT) : scaledAt(m, src, dst, x, y); // TR1
  if (sw === dw && sh === dh) return m(src.left + x - dst.left, src.top + y - dst.top) ? IN : OUT; // TR2
  const reverse = mutation === 'reverseAll' ? true : mutation === 'forwardAll' ? false : TR4_CODES.has(code);
  if (!reverse) return m(src.left + mod(x - dst.left, sw), src.top + mod(y - dst.top, sh)) ? IN : OUT; // TR3
  return m(src.right - 1 - mod(dst.right - 1 - x, sw), src.bottom - 1 - mod(dst.bottom - 1 - y, sh)) ? IN : OUT; // TR4
}

/**
 * Structure region S (§4.2 SR3–SR12) of one recipe window, in chrome-buffer
 * pixels W × H (an integer upscale is exact; other scaled pixels near a source
 * edge are UNKNOWN). `cicn` is the chrome template for the drawn state (SR14):
 * `{ width, height, alphaAt(x, y) }`. `C` is the content rect in the same space.
 * Returns `{ region: Uint8Array(W*H), layout }`, or null when no template
 * (SR3; HP7 keeps the box).
 */
export function structureRegion({ windowType, cicn, C, W, H, SW = 0, titleLen = SW > 0 ? 1 : 0, flags = DECLARED_FLAGS, popupFamily = false,
  collapsed = false, sideTitle = false, pd = POPUP_CREATION, mutation }) {
  if (!cicn) return null; // SR3
  const B = { left: 0, top: 0, right: cicn.width, bottom: cicn.height };
  const maskAt = (x, y) => x >= 0 && y >= 0 && x < cicn.width && y < cicn.height && cicn.alphaAt(x, y) !== 0;
  const f = { ...flags, popupFamily };
  const layout = layoutWindow({ windowType, B, C, SW, titleLen, flags: f, pd, full: { w: W, h: H } });
  const region = new Uint8Array(W * H);
  const cw = C.right - C.left, ch = C.bottom - C.top;
  if (cw <= 1 && ch <= 1) { // SR4 (U4: bottom uses C.r, implemented as decoded)
    const { A } = layout;
    const r = { left: C.left - A.left + B.left, top: C.top - A.top + B.top, right: C.right - A.right + B.right, bottom: C.right - A.bottom + B.bottom };
    for (let y = Math.max(0, r.top); y < Math.min(H, r.bottom); y++) for (let x = Math.max(0, r.left); x < Math.min(W, r.right); x++) region[y * W + x] = IN;
    return { region, layout };
  }
  const put = (x, y, v) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const j = y * W + x;
    if (region[j] === IN) return;
    if (v === IN || (v === UNKNOWN && region[j] === OUT)) region[j] = v;
  };
  if (mutation !== 'cellsOnly') for (let y = C.top; y < C.bottom; y++) for (let x = C.left; x < C.right; x++) put(x, y, IN); // SR5, SR11
  const walked = collapsed && mutation !== 'fourSidesCollapsed' ? (sideTitle ? [2, 3] : [0, 1]) : [0, 1, 2, 3]; // SR6
  for (const L of layout.sides) {
    if (!L || !walked.includes(L.side)) continue;
    for (let i = 1; i <= L.N; i++) {
      const { t, p } = cellRects(layout, L, i);
      if (empty(p) || empty(t)) continue; // SR7: placed rect non-empty (an empty source has no mask)
      for (let y = p.top; y < p.bottom; y++) for (let x = p.left; x < p.right; x++) put(x, y, cellAt(maskAt, L.codes[i], t, p, x, y, mutation));
    }
  }
  if (mutation === 'bbox') {
    let l = W, t = H, r = -1, b = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (region[y * W + x] !== OUT) { l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x); b = Math.max(b, y); }
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) region[y * W + x] = IN;
  }
  return { region, layout };
}

/** Built-in frame (PF1, procedural-frame §3.3) notch pixels of a W × H structure box: top-right and bottom-left. */
export function builtInNotches(W, H) {
  return [[W - 1, 0], [W - 1, 1], [0, H - 1], [1, H - 1]];
}

/** Every pixel of the (2r+1)² neighbourhood of (x, y) inside W × H has value v. */
export function uniform(region, W, H, x, y, v, r = 1) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const X = x + dx, Y = y + dy;
    if (X < 0 || Y < 0 || X >= W || Y >= H || region[Y * W + X] !== v) return false;
  }
  return true;
}

/**
 * Pick fixture points (§9.8): `p_out` an excluded frame pixel, `p_in` an opaque
 * frame pixel in S, `p_c` a content pixel, each with a uniform (2r+1)²
 * neighbourhood. `prefer(x, y)` scores candidates (higher first; ties: scan order).
 * `where(x, y)` restricts candidates. Returns null for a point with no candidate.
 */
export function pickPoints({ region, W, H, C }, { r = 2, prefer = () => 0, whereOut = () => true, whereIn = () => true } = {}) {
  const inC = (x, y) => x >= C.left && x < C.right && y >= C.top && y < C.bottom;
  let pOut = null, pIn = null, so = -Infinity, si = -Infinity;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = region[y * W + x];
    if (inC(x, y)) continue;
    if (v === OUT && whereOut(x, y) && uniform(region, W, H, x, y, OUT, r)) { const s = prefer(x, y, 'out'); if (s > so) { so = s; pOut = [x, y]; } }
    if (v === IN && whereIn(x, y) && uniform(region, W, H, x, y, IN, r) && !anyInC(C, x, y, r)) { const s = prefer(x, y, 'in'); if (s > si) { si = s; pIn = [x, y]; } }
  }
  const pC = C.right > C.left && C.bottom > C.top ? [Math.floor((C.left + C.right) / 2), Math.floor((C.top + C.bottom) / 2)] : null;
  return { p_out: pOut, p_in: pIn, p_c: pC };
}
const anyInC = (C, x, y, r) => x + r >= C.left && x - r < C.right && y + r >= C.top && y - r < C.bottom;

/** Counts per value, for observations. */
export function census(region) {
  const n = [0, 0, 0];
  for (const v of region) n[v]++;
  return { out: n[OUT], in: n[IN], unknown: n[UNKNOWN] };
}

/** Parse the numbers of a CSS `path("…")` value (HPT24 static checks). */
export function pathNumbers(value) {
  const m = /path\(\s*(?:(?:nonzero|evenodd)\s*,\s*)?["']([^"']*)["']\s*\)/.exec(value ?? '');
  if (!m) return null;
  return (m[1].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
}
