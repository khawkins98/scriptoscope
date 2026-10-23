// Source-addressed window-chrome acceptance rules (Kaleidoscope 2.3.1 kDEF 0).
// Pure ESM, no Node or DOM dependencies: the Node test and the source/built
// browser spec import this same module and inject the runtime under test.
// Nothing here imports src/.
//
// Every row is transcribed from docs/spec/engine/window-widgets.md (rule ids
// LS, TS, AP, TT, PP, AW, CR, RM, WD, HT, TX), docs/spec/engine/qd-primitives.md
// (tile blit T, X and W rows) and docs/spec/kdef231-reference.md §3.4.1 (the
// wnd# ladder). Expected values are recomputed from each archive's own decoded
// wnd# side lists, rect list and cicns, never from runtime output. Inputs the
// decode leaves to the runtime are named as declared defaults (window-widgets
// §2.3, PP7, TT2a) and passed explicitly, so a row never asserts them as
// original behaviour. See tests/rendering-options/README.md "Window-chrome
// source rules".

const int16 = v => ((v & 0xffff) << 16) >> 16;
const trunc = Math.trunc;

// docs/spec/kdef231-reference.md §3.4.1: `GetResource('wnd#', id & MASK)` at
// 0x3574, 0x358c, 0x35a4, 0x35bc, 0x35d4, 0x35ec, 0x3604, 0x361c, 0x3634,
// 0x364c, 0x3664, 0x367c; the first non-null handle wins (the rest are skipped).
export const WND_LADDER = [0xffff, 0xfffe, 0xfffd, 0xfffc, 0xfffb, 0xfffa, 0xfff1, 0xfff0, 0xffef, 0xffee, 0xffeb, 0xffea];
// The canonical id grid of the same section's landing table.
export const CANONICAL_WND = {
  'document-window': -14336, 'collapsed-document-window': -14332, dialog: -14328, alert: -14326,
  'movable-modal': -14324, 'movable-alert': -14322, 'titled-utility-window': -14304,
  'collapsed-titled-utility-window': -14300, 'side-floating-utility-window': -14296,
  'collapsed-side-floating-utility-window': -14292, 'no-title-utility-window': -14288,
  'collapsed-no-title-utility-window': -14284, 'popup-window': -12320,
};
/** First wnd# id the 0x356c ladder would load from `present`, or null (0x36a0 → 0x373e). */
export function ladderSelection(id, present) {
  for (const mask of WND_LADDER) { const candidate = int16(id & mask); if (present.has(candidate)) return candidate; }
  return null;
}

// ── Inputs (window-widgets §2) ──────────────────────────────────────────────
/**
 * §2.2 flags at the runtime's declared defaults (§2.3): widgetFrame set,
 * noWidgets, collapsed, sideTitle, altWidgets, partialZoom clear. hasClose,
 * hasZoom and collapseRequested are one runtime flag (finding F7), passed here
 * as present. These are modern-policy inputs, not original observations; every
 * row below is conditioned on them.
 */
export const DECLARED_FLAGS = Object.freeze({ hasClose: true, hasZoom: true, collapseRequested: true, widgetFrame: true, noWidgets: false, drawActive: true, popupFamily: false });
/** PP6/PP7: the popup data at window creation, the declared runtime values. */
export const POPUP_CREATION = Object.freeze({ pdMode: 0, pdX: 0, pdLen: 33, pdCentre: 0 });
/** TT2a: the declared condensed width, `SWc = SW − titleLen` (Inside Macintosh: Text). */
export const condensedDefault = (SW, titleLen) => SW - titleLen;

const code = slug => Number(/^part-(-?\d+)$/.exec(slug)?.[1] ?? NaN);
const R = ([left, top, right, bottom]) => ({ left, top, right, bottom });
const empty = r => r.right <= r.left || r.bottom <= r.top;
const ptIn = (x, y, r) => x >= r.left && x < r.right && y >= r.top && y < r.bottom; // $A8AD, half-open
export const xywh = r => ({ x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top });
/**
 * §2.1 rect-list lookup by type: the last entry of the type, else the first
 * entry. The loader keeps one rect per type (the last); §6.2 shows that is the
 * same lookup on this corpus. The first entry is type 0 on 137 of 138 lists;
 * the other (crayon-os −14332) has every type, so the fallback is `part-0`.
 */
export const lookupRect = (windowType, type) => R((windowType.parts[`part-${type}`] ?? windowType.parts['part-0']).rect);

const SIDES = [{ side: 0, edge: 'top', horizontal: true }, { side: 1, edge: 'bottom', horizontal: true },
  { side: 2, edge: 'left', horizontal: false }, { side: 3, edge: 'right', horizontal: false }];
export const SIDE_EDGES = SIDES.map(s => s.edge);

// ── Part-code verdict V(code, drop) (PV1–PV9, 0x49d6) ───────────────────────
const collapseBox = f => f.collapseRequested && f.widgetFrame && !f.noWidgets; // 0x487e
export function verdictZero(c, drop, f) {
  switch (c) {
    case 0: return true; // PV1
    case 2: return !f.hasClose; // PV2
    case 3: return !f.hasZoom; // PV3
    case 4: return !collapseBox(f); // PV4
    case 10: return !!drop; // PV5
    case 15: return f.hasClose; // PV6
    case 16: return f.hasZoom; // PV7
    case 17: return collapseBox(f); // PV8
    default: return false; // PV9
  }
}
const LS1_EXCLUDED = new Set([5, 6, 8, 11, 12, 13, 14, 18]); // LS1
const TT1_EXCLUDED = new Set([8, 11, 12, 13, 14, 18]); // TT1, PP3
const GROWERS = new Set([8, 11, 12, 18]); // LS5
const RECIPIENTS = new Set([8, 11, 13, 14, 18]); // AW2, AW3

/**
 * Mutations a check must fail (window-widgets §7.1). Each switches one row of
 * this model to a refuted reading; the test file proves the corpus or a
 * synthetic row rejects it. Never set in a real check.
 */
export const MUTATIONS = Object.freeze({
  clampBudget: 'AW8: clamp a negative budget to 0',
  fullExtent: 'LS7/LS9: budget the side to the window\'s full extent instead of P[N]',
  pinLast: 'LS9: pin the last border to P[N] after the walk',
  nearEdge: 'RM6: move the bottom-right corner by the cell\'s near edge',
  keepBezels: 'TT4/TT10: keep the code-6 bezels of an untitled side',
  dropPlate: 'TT10: give an untitled side\'s anchor plate width 0',
  skipTT8: 'TT8: skip the overhang correction',
  reverseOrder: 'WD4: draw the sides right, left, bottom, top',
  opaque: 'WD4/X2: an opaque copy instead of CopyMask',
  paintTrailing: 'Q3/LS9: paint the trailing region [S[N], extent) 1:1 after P[N]',
  noWD6: 'WD6: skip the popup-family raw template blits',
  tt2aInert: 'TT2a: the default condensed width SWc = SW (TT2 inert)',
  rectHit: 'HT7/HT8: hit on the remapped rect without the strip mask',
  noStripGate: 'HT7: hit without the pressed-strip cicn',
});

// ── Layout (LS, TS, AP, TT, PP, AW; 0x4a64..0x5354) ─────────────────────────
/**
 * The allocation walk (AW1–AW9, 0x5178) over segments first..last of side L.
 * Returns nothing; rewrites L.P[first..last] (AW7).
 */
function allocate(L, first, last, required, primary, drop, gate, f, mutation) {
  const { S, codes, P } = L, w = i => S[i] - S[i - 1];
  let budget = P[last] - P[first - 1] - required; // AW8: not clamped
  if (mutation === 'clampBudget') budget = Math.max(0, budget);
  if (budget < 0) L.rows.add('AW8');
  const skip = primary === 0 || budget === 0; // AW9
  let share = 0, pool = 0;
  if (!skip) {
    share = trunc(budget / primary); pool = budget - share * primary;
    for (let i = first; i <= last; i++) if (codes[i] === 12 && w(i) !== 0) pool += share % w(i); // AW1a: width 0 adds nothing
  } else L.rows.add('AW9');
  let left = 0;
  for (let i = first; i <= last; i++) if (RECIPIENTS.has(codes[i])) left++;
  for (let i = first; i <= last; i++) {
    const c = codes[i];
    let width;
    if (c === 12) { width = skip || w(i) === 0 ? 0 : share - share % w(i); if (w(i) === 0) L.rows.add('AW1a'); } // AW1, AW1a
    else if (RECIPIENTS.has(c)) {
      if (skip) width = 0;
      else { const extra = trunc(pool / left); pool -= extra; left--; width = (c === 13 || c === 14 ? 0 : share) + extra; } // AW2, AW3
    } else if (verdictZero(c, drop, f)) width = 0; // AW4
    else if ((c === 5 || c === 6) && gate === 0) width = 0; // AW5
    else width = w(i); // AW6
    P[i] = P[i - 1] + width; // AW7
  }
}

/**
 * Lay out one window (window-widgets §4.2–§4.6a). `C` is the content rect in
 * output coordinates, `A` the template body rect, `T4` the title rect, `B` the
 * chrome template's bounds. Returns per-side `{ S, codes, P, anchor, rows }`
 * (S is the working template list after TT8) and the flags after TS3.
 */
export function layoutWindow({ windowType, B, C, SW = 0, SWc, titleLen = SW > 0 ? 1 : 0, flags = DECLARED_FLAGS, pd = POPUP_CREATION, full, mutation }) {
  const f = { ...flags };
  const A = R(windowType.parts['part-0'].rect), T4 = lookupRect(windowType, 4);
  // TT2a: with no measured SWc the runtime default applies; the tt2aInert mutation is the
  // divergence TT2a names (SWc = SW, TT2 inert), and only changes the default path.
  const condensed = SWc ?? (mutation === 'tt2aInert' ? SW : condensedDefault(SW, titleLen));
  const sides = SIDES.map(({ side, edge, horizontal }) => {
    const list = windowType.edges?.[edge] ?? [];
    if (!list.length) return null; // N = −1: no recipe (0x4a8a)
    const S = list.map(e => e.at), codes = list.map(e => code(e.part)), N = S.length - 1;
    const L = { side, edge, horizontal, S, codes, N, P: new Array(N + 1).fill(0), anchor: 0, rows: new Set() };
    const w = i => S[i] - S[i - 1];
    const lo = horizontal ? C.left - A.left : C.top - A.top, hi = horizontal ? C.right - A.right : C.bottom - A.bottom;
    L.P[0] = S[0] + lo; L.P[N] = S[N] + hi; // LS7
    if (mutation === 'fullExtent') L.P[N] = horizontal ? full.w : full.h;
    L.PN = L.P[N];
    // First pass, drop = 0 (LS1–LS6).
    let F = 0, D = 0, G = 0, gb = 0, ga = 0, W = SW, tl = titleLen, seen5 = false;
    for (let i = 1; i <= N; i++) {
      const c = codes[i];
      if (!verdictZero(c, false, f) && !LS1_EXCLUDED.has(c)) F += w(i); // LS1
      if (c === 10) D += w(i); // LS2
      if (collapseBox(f)) { if (c === 4) G += w(i); if (c === 17) G -= w(i); } // LS3
      if (c === 5) { L.anchor = i; seen5 = true; W -= (T4.right - S[i]) + (S[i - 1] - T4.left); } // LS4, LS6
      if (GROWERS.has(c)) { if (seen5) ga++; else gb++; } // LS5
    }
    const a = L.anchor, E = L.P[N] - L.P[0]; // LS8
    Object.assign(L, { F, D, G, gb, ga, E });
    if (a && f.popupFamily) { // AP1, §4.6a: no too-short step, no TT rows
      L.rows.add('AP1');
      const X = pd.pdMode === -2 ? int16(pd.pdCentre - C.left + 4 - trunc(pd.pdLen / 2)) : pd.pdX; // PP1, PP2
      let Fb = 0, Fa = 0;
      for (let i = 1; i <= N; i++) if (i !== a && !verdictZero(codes[i], false, f) && !TT1_EXCLUDED.has(codes[i])) { if (i < a) Fb += w(i); else Fa += w(i); } // PP3
      L.P[a - 1] = C.left + X + 10 + S[a - 1] - T4.left; // PP4
      L.P[a] = C.left + X + pd.pdLen - 10 + S[a] - T4.right;
      allocate(L, 1, a - 1, Fb, gb, 0, 1, f, mutation); // PP5
      allocate(L, a + 1, N, Fa, ga, 0, 1, f, mutation);
      return L;
    }
    let drop = 0;
    if (E < F) { // TS1
      drop = 1; F -= D; W = 0; tl = 0; L.rows.add('TS1');
      if (E < F && G > 0) { f.collapseRequested = false; F -= G; L.rows.add('TS3'); } // TS3 (window-wide)
    }
    L.drop = drop;
    if (!(a && horizontal)) { // AP3
      L.rows.add('AP3');
      allocate(L, 1, N, F, gb + ga, drop, 0, f, mutation);
      return L;
    }
    L.rows.add('AP2'); // §4.6
    let Fb = 0, Fa = 0;
    for (let i = 1; i <= N; i++) if (i !== a && !verdictZero(codes[i], drop, f) && !TT1_EXCLUDED.has(codes[i])) { if (i < a) Fb += w(i); else Fa += w(i); } // TT1
    const room = E - Fb - Fa;
    if (room < W) { W -= SW - condensed; L.rows.add('TT2'); if (SWc === undefined && room > 2) L.rows.add('TT2a'); } // TT2
    if (room <= 2) { tl = 0; W = 0; L.rows.add('TT3'); } // TT3
    if (tl === 0 && mutation !== 'keepBezels') { // TT4 (TT4a: no subtraction at the list ends)
      if (a + 1 <= N && codes[a + 1] === 6) Fa -= w(a + 1);
      if (a - 1 >= 1 && codes[a - 1] === 6) Fb -= w(a - 1);
    }
    if (tl === 0 && SW === 0 && !drop) L.rows.add('TT10');
    L.P[a - 1] = L.P[0] + Fb; L.P[a] = L.P[N] - Fa; // TT5
    const mid = trunc((C.left + C.right) / 2);
    if (gb > 0 && ga > 0 && Fb > Fa) { // TT6
      L.rows.add('TT6');
      const Lx = mid - trunc((W + (T4.left - S[a - 1]) + (T4.right - S[a])) / 2);
      if (Lx > L.P[a - 1]) L.P[a - 1] = Lx;
      if (L.P[a - 1] + W < L.P[a]) L.P[a] = L.P[a - 1] + W;
    } else { // TT7
      L.rows.add('TT7');
      if (ga > 0) {
        const Rx = gb > 0 ? mid + trunc((W + (S[a] - T4.right) + (S[a - 1] - T4.left)) / 2) : L.P[a - 1] + W;
        if (Rx < L.P[a]) L.P[a] = Rx;
      }
      if (gb > 0 && L.P[a] - W > L.P[a - 1]) L.P[a - 1] = L.P[a] - W;
    }
    if (mutation === 'dropPlate' && tl === 0) L.P[a] = L.P[a - 1];
    if (W < 0 && mutation !== 'skipTT8') { // TT8
      L.rows.add('TT8');
      const d1 = S[a - 1] - T4.left, d2 = S[a] - T4.right;
      L.P[a - 1] -= d1; Fb -= d1; L.P[a] -= d2; Fa += d2;
      S[a - 1] = T4.left; S[a] = T4.right;
    }
    const gate = mutation === 'keepBezels' ? 1 : tl;
    allocate(L, 1, a - 1, Fb, gb, drop, gate, f, mutation); // TT9 (the first walk stops at P[anchor−1])
    allocate(L, a + 1, N, Fa, ga, drop, gate, f, mutation);
    Object.assign(L, { Fb, Fa, W, titleLen: tl, mid });
    return L;
  });
  for (const L of sides) if (L && mutation === 'pinLast') L.P[L.N] = L.PN;
  return { A, B, C, T4, sides, flags: f, windowType };
}

// ── Cell rects (CR1–CR4, 0x5356) ────────────────────────────────────────────
/** Template cell `t` and placed cell `p` of segment i on side L. */
export function cellRects(layout, L, i) {
  const { A, B, C } = layout, s0 = L.S[i - 1], s1 = L.S[i], p0 = L.P[i - 1], p1 = L.P[i];
  switch (L.side) {
    case 0: return { t: { left: s0, right: s1, top: 0, bottom: A.top }, p: { left: p0, right: p1, top: C.top - A.top, bottom: C.top } }; // CR1
    case 1: return { t: { left: s0, right: s1, top: A.bottom, bottom: B.bottom }, p: { left: p0, right: p1, top: C.bottom, bottom: C.bottom + B.bottom - A.bottom } }; // CR2
    case 2: return { t: { top: s0, bottom: s1, left: B.left, right: A.left }, p: { top: p0, bottom: p1, left: C.left - A.left + B.left, right: C.left } }; // CR3
    default: return { t: { top: s0, bottom: s1, left: A.right, right: B.right }, p: { top: p0, bottom: p1, left: C.right, right: C.right + B.right - A.right } }; // CR4
  }
}

// ── Widget rect remap (RM1–RM8, 0x5cb6) ─────────────────────────────────────
export function remap(layout, r, mutation) {
  const out = { ...r }, tl = [r.left, r.top], br = [r.right - 1, r.bottom - 1]; // RM2
  let tlm = false, brm = false;
  for (const L of layout.sides) { // RM3: sides 0..3, segments 1..N
    if (!L) continue;
    for (let i = 1; i <= L.N && !(tlm && brm); i++) {
      const { t, p } = cellRects(layout, L, i);
      if (!tlm && ptIn(tl[0], tl[1], t)) { out.left += p.left - t.left; out.top += p.top - t.top; tlm = true; } // RM4, RM5
      if (!brm && ptIn(br[0], br[1], t)) { // RM4, RM6: the far edges
        if (mutation === 'nearEdge') { out.right += p.left - t.left; out.bottom += p.top - t.top; }
        else { out.right += p.right - t.right; out.bottom += p.bottom - t.bottom; }
        brm = true;
      }
    }
    if (tlm && brm) break; // RM7
  }
  return tlm && brm ? out : { left: 0, top: 0, right: 0, bottom: 0 }; // RM8
}

// ── Full draw (WD4, qd-primitives T/X/W) ────────────────────────────────────
// 0xfeae direction byte: `(pc==11||pc==14)?0:1` (W2, W3). 0 means reverse.
export const TILE_REVERSE = new Set([11, 14]);
/** Along-run source offset for dst index k of a dw-long run tiled from an sw-long source (qd-primitives §5). */
export function tileSourceOffset(k, sw, dw, reverse) {
  return reverse ? sw - 1 - ((dw - 1 - k) % sw) : k % sw;
}
/**
 * Replay the full draw into an expected RGBA plane of size W×H: sides 0..3,
 * segments 1..N (WD4), each a tile blit (W2/W3) or, for code 18, a scale blit
 * (W1) whose pixel mapping is not decoded (qd-primitives "Scale blit"), so its
 * destination pixels become unknown unless it is 1:1. On-screen transfer is
 * CopyMask (X2): a mask-clear source pixel leaves the destination. Pixels no
 * cell paints stay 0,0,0,0 (Q3: no routine of the full draw paints the leading
 * or trailing region). `known` marks the pixels whose value the decode fixes.
 */
export function expectedChrome(layout, cicn, W, H, mutation) {
  const rgba = new Uint8ClampedArray(W * H * 4), known = new Uint8Array(W * H).fill(1), painter = new Int8Array(W * H).fill(-1), cell = new Int16Array(W * H).fill(-1);
  let orderSensitive = 0;
  const order = mutation === 'reverseOrder' ? [...layout.sides].reverse() : layout.sides;
  const paint = (L, t, p, c) => {
    if (empty(t) || empty(p)) return; // WD4, T0
    const along = L.horizontal, sw = along ? t.right - t.left : t.bottom - t.top, dw = along ? p.right - p.left : p.bottom - p.top;
    const thick = along ? t.bottom - t.top : t.right - t.left;
    const scaled = c === 18 && sw !== dw, reverse = TILE_REVERSE.has(c);
    for (let k = 0; k < dw; k++) for (let x = 0; x < thick; x++) {
      const dx = along ? p.left + k : p.left + x, dy = along ? p.top + x : p.top + k;
      if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
      const j = dy * W + dx;
      if (scaled) { known[j] = 0; continue; }
      const off = tileSourceOffset(k, sw, dw, reverse);
      const sx = along ? t.left + off : t.left + x, sy = along ? t.top + x : t.top + off;
      const px = sx >= 0 && sy >= 0 && sx < cicn.width && sy < cicn.height ? cicn.getPixel(sx, sy) : [0, 0, 0, 0];
      if (px[3] === 0 && mutation !== 'opaque') continue; // X2: mask clear
      if (px[3] !== 255 && px[3] !== 0) { known[j] = 0; continue; }
      if (painter[j] >= 0 && painter[j] !== L.side && (rgba[j * 4] !== px[0] || rgba[j * 4 + 1] !== px[1] || rgba[j * 4 + 2] !== px[2] || rgba[j * 4 + 3] !== px[3])) orderSensitive++;
      rgba.set(px, j * 4); known[j] = 1; painter[j] = L.side; cell[j] = c;
    }
  };
  for (const L of order) {
    if (!L) continue;
    for (let i = 1; i <= L.N; i++) { const { t, p } = cellRects(layout, L, i); paint(L, t, p, L.codes[i]); }
    if (mutation === 'paintTrailing') {
      const ext = L.horizontal ? cicn.width : cicn.height, n = L.S[L.N];
      if (ext > n) {
        const tail = { ...L, S: [n, ext], P: [L.P[L.N], L.P[L.N] + ext - n], N: 1 };
        const { t, p } = cellRects(layout, tail, 1); paint(L, t, p, 1);
      }
    }
  }
  // WD6: after the sides, a popup-family window gets three raw blits from the
  // template at rect-list rects, not through the remap: type 5 moved by
  // (C.left − A.left, C.top − A.top), type 6 by (C.right − A.right, C.top − A.top)
  // and the 15×15 rect at A's bottom-right corner by (C.right − A.right,
  // C.bottom − A.bottom). Reading: the 15×15 source rect ends at that corner,
  // [A.right − 15, A.bottom − 15, A.right, A.bottom), so it lands ending at C's
  // bottom-right. Each is a same-size scale blit: a 1:1 CopyMask (SC3).
  if (layout.flags.popupFamily && mutation !== 'noWD6' && layout.windowType) {
    const { A, C, windowType } = layout, rect = t => R(windowType.parts[`part-${t}`].rect);
    const blits = [];
    if (windowType.parts['part-5']) blits.push([rect(5), C.left - A.left, C.top - A.top]);
    if (windowType.parts['part-6']) blits.push([rect(6), C.right - A.right, C.top - A.top]);
    blits.push([{ left: A.right - 15, top: A.bottom - 15, right: A.right, bottom: A.bottom }, C.right - A.right, C.bottom - A.bottom]);
    for (const [r, dx, dy] of blits) for (let y = r.top; y < r.bottom; y++) for (let x = r.left; x < r.right; x++) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const px = x >= 0 && y >= 0 && x < cicn.width && y < cicn.height ? cicn.getPixel(x, y) : [0, 0, 0, 0];
      const j = Y * W + X;
      if (px[3] === 0 && mutation !== 'opaque') continue;
      if (px[3] !== 255 && px[3] !== 0) { known[j] = 0; continue; }
      rgba.set(px, j * 4); known[j] = 1; painter[j] = 4; cell[j] = -6;
    }
  }
  return { rgba, known, orderSensitive, painter, cell };
}

// ── Widget hit (HT1–HT8, 0x4124..0x41e6, 0x5ddc) ────────────────────────────
const ROLE_TYPE = { close: 1, zoom: 2, collapse: 3 }; // WD7
/** HT7 source sub-rect of a widget entry in the pressed strip (collapsed clear: row 0). */
export function stripSource(windowType, role) {
  const r = R(windowType.parts[`part-${ROLE_TYPE[role]}`].rect), w1 = lookupRect(windowType, 1), w2 = lookupRect(windowType, 2);
  const x = role === 'close' ? 0 : role === 'zoom' ? w1.right - w1.left : (w1.right - w1.left) + (w2.right - w2.left);
  return { left: x, top: 0, right: x + r.right - r.left, bottom: r.bottom - r.top };
}
/**
 * The `wHit` widget branch at output pixel (x, y): 'close', 'zoom', 'collapse'
 * or null (wInContent / wInDrag). `strip` is the WD11 base cicn (−14330 at the
 * declared defaults) or null.
 */
export function widgetHitAt(layout, windowType, strip, x, y, mutation) {
  const f = layout.flags;
  if (!f.widgetFrame || !f.drawActive) return null; // HT1, HT2
  const entryHit = role => {
    const slug = `part-${ROLE_TYPE[role]}`;
    if (!windowType.parts[slug]) return false;
    if (!strip && mutation !== 'noStripGate') return false; // HT7: no cicn
    const p = remap(layout, R(windowType.parts[slug].rect), mutation);
    if (!ptIn(x, y, p)) return false; // HT7 PtInRect
    if (mutation === 'rectHit' || !strip) return true;
    const s = stripSource(windowType, role), sx = s.left + (x - p.left), sy = s.top + (y - p.top); // HT8: offset 1:1, not scaled
    return sx >= 0 && sy >= 0 && sx < strip.width && sy < strip.height && strip.getPixel(sx, sy)[3] !== 0;
  };
  if (f.hasClose && entryHit('close')) return 'close'; // HT3
  if (f.hasZoom && entryHit('zoom')) return 'zoom'; // HT4 (5 or 6 by zoom state)
  if (collapseBox(f) && entryHit('collapse')) return 'collapse'; // HT5
  return null; // HT5a
}

// ── Checker ─────────────────────────────────────────────────────────────────
const COUNTERS = ['compositions', 'cells', 'sides', 'segments', 'tooShortSides', 'code10', 'code10Zero', 'negativeBudget', 'shortSides', 'titledSides', 'popupSides', 'untitledPlates', 'tt8', 'pixels', 'unpaintedFrame', 'orderSensitive', 'pixels1px', 'pixelsWhole', 'pixelsForward', 'pixelsReverse', 'titleRects', 'tt2Default', 'hitPoints', 'hits', 'emptyCollapse', 'maskClearMisses'];
export const emptyTotals = () => Object.fromEntries(COUNTERS.map(k => [k, 0]));

/**
 * Check one composed window against the decoded rules. `content` is the
 * requested content size; `C` is taken from the runtime's frame inset (runtime
 * policy: the structure is sized to the template's drawable extent, so C
 * starts at the body inset). Returns `{ failures, checked }`.
 */
export function checkComposition({ cicn, windowType, composed, content, title = { SW: 0, titleLen: 0 }, flags = DECLARED_FLAGS, strip = null, pixels = true, hits = !!strip, mutation }) {
  const failures = [], checked = emptyTotals();
  const fail = message => { if (failures.length < 20) failures.push(message); };
  const { frame, fullWidth: W, fullHeight: H, buffer } = composed;
  const cw = content?.w ?? W - frame.left - frame.right, ch = content?.h ?? H - frame.top - frame.bottom;
  if (W !== frame.left + cw + frame.right || H !== frame.top + ch + frame.bottom) fail(`structure ${W}x${H} does not hold content ${cw}x${ch} in frame ${JSON.stringify(frame)}`);
  const C = { left: frame.left, top: frame.top, right: frame.left + cw, bottom: frame.top + ch };
  const B = { left: 0, top: 0, right: cicn.width, bottom: cicn.height };
  const layout = layoutWindow({ windowType, B, C, ...title, flags, full: { w: W, h: H }, mutation });
  checked.compositions++;
  // Placement: every segment with template pixels, in side order (WD4).
  layout.sides.forEach((L, side) => {
    if (!L && composed.placement.some(p => p.edge === SIDE_EDGES[side])) fail(`${SIDE_EDGES[side]}: drew cells without a side list`);
  });
  for (const L of layout.sides) {
    if (!L) continue;
    checked.sides++;
    if (L.rows.has('TS1')) checked.tooShortSides++;
    if (L.rows.has('AW8')) checked.negativeBudget++;
    if (L.rows.has('AP2')) checked.titledSides++;
    if (L.rows.has('AP1')) checked.popupSides++;
    if (L.rows.has('TT10')) checked.untitledPlates++;
    if (L.rows.has('TT8')) checked.tt8++;
    if (L.rows.has('TT2a')) checked.tt2Default++;
    if (L.P[L.N] !== L.PN) checked.shortSides++;
    const placed = composed.placement.filter(p => p.edge === L.edge);
    let n = 0;
    for (let i = 1; i <= L.N; i++) {
      if (L.S[i] <= L.S[i - 1]) continue; // no template pixels: nothing drawn or reported
      const { t, p } = cellRects(layout, L, i), slice = placed[n++];
      checked.segments++;
      if (L.codes[i] === 10) { checked.code10++; if (L.P[i] === L.P[i - 1]) checked.code10Zero++; }
      if (!slice) { fail(`${L.edge}[${i}]: missing placed cell`); continue; }
      const want = { code: L.codes[i], src: xywh(t), dst: xywh(p) }, got = { code: slice.code, src: slice.src, dst: slice.rects[0] };
      if (JSON.stringify(want) !== JSON.stringify(got)) fail(`${L.edge}[${i}] (${[...L.rows].join(',')}): spec ${JSON.stringify(want)}, drawn ${JSON.stringify(got)}`);
      else checked.cells++;
    }
    if (placed.length !== n) fail(`${L.edge}: ${placed.length} placed cells, spec ${n}`);
  }
  // TX3: the title rect is T4 remapped.
  if (composed.titleRect) {
    const want = xywh(remap(layout, layout.T4, mutation));
    if (JSON.stringify(want) !== JSON.stringify(composed.titleRect)) fail(`titleRect: spec ${JSON.stringify(want)}, runtime ${JSON.stringify(composed.titleRect)}`);
    else checked.titleRects++;
  }
  // Pixels: the full draw, every known pixel of the structure.
  if (pixels) {
    const { rgba, known, orderSensitive, painter, cell } = expectedChrome(layout, cicn, W, H, mutation);
    checked.orderSensitive += orderSensitive;
    let reported = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const j = y * W + x;
      if (!known[j]) continue;
      const out = buffer.getPixel(x, y), k = j * 4;
      checked.pixels++;
      const inContent = x >= C.left && x < C.right && y >= C.top && y < C.bottom;
      if (rgba[k + 3] === 0 && !inContent) checked.unpaintedFrame++;
      if (out[0] !== rgba[k] || out[1] !== rgba[k + 1] || out[2] !== rgba[k + 2] || out[3] !== rgba[k + 3]) {
        const by = painter[j] < 0 ? 'unpainted' : painter[j] === 4 ? 'WD6 blit' : `${SIDE_EDGES[painter[j]]} p${cell[j]} ${TILE_REVERSE.has(cell[j]) ? 'reverse' : 'forward'} tile`;
        if (reported++ < 3) fail(`pixel (${x},${y}) [${by}] = ${out}, spec ${[...rgba.subarray(k, k + 4)]}`);
      }
    }
    // Tile buckets (kept from the 0xfeae rule: a vacuous pass stays visible).
    for (const L of layout.sides) if (L) for (let i = 1; i <= L.N; i++) {
      const { t, p } = cellRects(layout, L, i);
      if (empty(t) || empty(p) || L.codes[i] === 18) continue;
      const sw = L.horizontal ? t.right - t.left : t.bottom - t.top, dw = L.horizontal ? p.right - p.left : p.bottom - p.top, area = dw * (L.horizontal ? t.bottom - t.top : t.right - t.left);
      checked[sw === 1 ? 'pixels1px' : dw === sw ? 'pixelsWhole' : TILE_REVERSE.has(L.codes[i]) ? 'pixelsReverse' : 'pixelsForward'] += area;
    }
  }
  // Hits: every pixel of each widget's remapped rect and of its template-size
  // rect at the top-left translation (which covers a remap that empties it).
  if (hits && composed.hitWidget) {
    for (const role of ['close', 'zoom', 'collapse']) {
      const slug = `part-${ROLE_TYPE[role]}`;
      if (!windowType.parts[slug]) continue;
      const r = R(windowType.parts[slug].rect), p = remap(layout, r, mutation), near = remap(layout, r, 'nearEdge');
      if (role === 'collapse' && empty(p) && !empty(r)) checked.emptyCollapse++;
      const boxes = [p, near].filter(b => !empty(b));
      const seen = new Set();
      let bad = false;
      for (const b of boxes) for (let y = b.top; y < b.bottom && !bad; y++) for (let x = b.left; x < b.right && !bad; x++) {
        if (seen.has(y * 65536 + x)) continue; seen.add(y * 65536 + x);
        const want = widgetHitAt(layout, windowType, strip, x, y, mutation), got = composed.hitWidget(x, y) ?? null;
        checked.hitPoints++;
        if (want) checked.hits++;
        if (!want && ptIn(x, y, p) && strip && layout.flags.drawActive) checked.maskClearMisses++;
        if (want !== got) { fail(`hit (${x},${y}) near ${role}: spec ${want}, runtime ${got}`); bad = true; }
      }
    }
  }
  return { failures, checked, layout };
}

/** Sampled content sizes: one below-template sample (the too-short step), the template size plus odd/even and tile-remainder offsets. */
export const SIZE_OFFSETS = { width: [-12, 0, 1, 2, 7, 97], height: [-12, 0, 1, 33] };
/**
 * Sampled titles (SW, titleLen, SWc): untitled (TT10); a short title; a title
 * wider than every sampled room (TT2 then TT3 or a capped plate), both with
 * the declared TT2a SWc passed explicitly; and one with SWc omitted, so the
 * runtime's own TT2a default is exercised. Layout, cells, title rect and hits
 * are checked for every title; pixels for the untitled sample only (cost).
 */
export const TITLE_SAMPLES = [
  { SW: 0, titleLen: 0 },
  { SW: 41, titleLen: 7, SWc: condensedDefault(41, 7) },
  { SW: 300, titleLen: 40, SWc: condensedDefault(300, 40) },
  // SWc omitted: the runtime's own TT2a default is exercised (composeWindowChrome gets no
  // titleWidthCondensedPx). The model uses the declared default, SW − titleLen.
  { SW: 60, titleLen: 12 },
];

// Archives that ship wnd# recipes vs none. The five without wnd# draw through
// the built-in procedural frame (docs/spec/engine/procedural-frame.md); every
// recipe rule above is NOT APPLICABLE to them.
export const SLICED = ['1138', '1984', '1990', 'animals', 'apple-lisa', 'beos-r503', 'crayon-os', 'dolphin-som', 'evolution', 'floppies', 'monkey-paradise', 'windows-31', 'windows-95'];
export const CORNER_SPRITE = ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver'];
/** WD11 base id at the declared defaults (altWidgets and sideTitle clear). */
export const WIDGET_STRIP_ID = -14330;

const pixmapOf = (decoded, PixelBuffer, asset) => new PixelBuffer(asset.width, asset.height, new Uint8ClampedArray(asset.rgba));
/** The archive's own WD11 strip cicn, or null. */
export function widgetStrip(decoded, PixelBuffer) {
  const el = Object.values(decoded.manifest.chromeElements ?? {}).find(e => e.sourceCicnId === WIDGET_STRIP_ID);
  const asset = el && decoded.assets.find(a => a.path === el.asset);
  return asset ? pixmapOf(decoded, PixelBuffer, asset) : null;
}

/**
 * Run the rules over one decoded (encodeAssets:false) theme. The caller
 * injects the runtime under test so source and built bundles share this table.
 * `filter(key, state, dw, dh, title)` restricts the sample (mutation proofs).
 */
export function checkTheme(decoded, { PixelBuffer, composeWindowChrome }, { mutation, filter, titles = TITLE_SAMPLES, pixels = true, hits = true, withoutStrip = false } = {}) {
  const totals = emptyTotals(), failures = [];
  const strip = withoutStrip ? null : widgetStrip(decoded, PixelBuffer);
  for (const [key, windowType] of Object.entries(decoded.manifest.windowTypes)) {
    if (windowType.model) continue;
    const [l, t, r, b] = windowType.parts['part-0'].rect;
    for (const state of ['active', 'inactive']) {
      const asset = decoded.assets.find(a => a.path === windowType.chrome[state]);
      const cicn = pixmapOf(decoded, PixelBuffer, asset);
      const popupFamily = key === 'popup-window'; // service slot 8, procID family 63 (0x3210)
      const flags = { ...DECLARED_FLAGS, popupFamily, drawActive: state === 'active' };
      for (const dw of SIZE_OFFSETS.width) for (const dh of SIZE_OFFSETS.height) for (const title of titles) {
        if (filter && !filter(key, state, dw, dh, title)) continue;
        const content = { w: Math.max(0, Math.max(0, r - l) + dw), h: Math.max(0, Math.max(0, b - t) + dh) };
        const composed = composeWindowChrome(cicn, windowType, content.w, content.h, {
          popupFamily, active: state === 'active', widgetCicn: strip,
          titleWidthPx: title.SW, titleLength: title.titleLen, ...(title.SWc !== undefined ? { titleWidthCondensedPx: title.SWc } : {}),
        });
        const result = checkComposition({ cicn, windowType, composed, content, title, flags, strip, pixels: pixels && title.SW === 0, hits: hits && (!!strip || mutation === 'noStripGate'), mutation });
        for (const [k, v] of Object.entries(result.checked)) totals[k] += v;
        for (const f of result.failures) failures.push(`${key}/${state} +${dw}x+${dh} SW${title.SW}: ${f}`);
      }
    }
  }
  return { totals, failures };
}

/**
 * Author-supplied NAMED cicn labels (docs/spec/corpus-corroborated-ids.md) are
 * source art for the state role. A selected state's frame label must not name
 * the opposite state; unlabelled and state-neutral labels are not evidence.
 */
export function stateLabelContradiction(state, label) {
  if (!label) return null;
  const inactive = /\b(inactive|disabled)\b/i.test(label), active = /\bactive\b/i.test(label.replace(/\binactive\b/ig, ''));
  if (state === 'active' && inactive) return `active frame labelled "${label}"`;
  if (state === 'inactive' && active && !inactive) return `inactive frame labelled "${label}"`;
  return null;
}
