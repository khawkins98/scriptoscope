// Window family driver: the Kaleidoscope 2.3.1 kDEF window recipe for the 13
// archives that ship `wnd#` (docs/spec/engine/window-widgets.md). Units:
// `window.layout` (PV, LS, TS, AP, AW, TT, CR rows: `0x4a64..0x552e`) and
// `window.widgets` (RM remap `0x5cb6`, WD widget draw `0x6062`, HT widget hit
// `0x5ddc`, dispatch `0x4124..0x42d6`). The grower arithmetic is
// compositor-spec "Distribution"; the blits are qd-primitives.
//
// Every literal comes from tables/window.ts. Not modelled, by the §2.3
// declared defaults or because the spec leaves it open (window-widgets §6):
//   - the layout cache (LC1): the runtime has no message stream, so every call lays out (LC2);
//   - who writes the popup data after creation (§6 Q10): PP7 declares the creation values;
//   - the partial-zoom widget (WD5, WD8), the outline draw and the exact-point
//     hit fallbacks (§6 Q6);
//   - TT2 needs a condensed StringWidth; the declared default is TT2a.
import type { Pixmap, QdRect } from '../qd/types.js';
import type { EngineTrace } from '../trace.js';
import { emptyRect, rect } from '../qd/rect.js';
import { newRegion, regionAddMappedMask, regionAddRect, regionAddTiledMask, scaleBlit, type Region } from '../../raster.js';
import { windowBlitRow } from '../tables/windowBlit.js';
import {
  ALLOCATION, ALLOCATION_PATH, CELL_RECT, CELL_WIDTH, LAYOUT_SUMS, PART_VERDICT, POPUP_PLACEMENT, TITLED_SIDE, TOO_SHORT,
  WIDGET_DRAW, WIDGET_HIT, WIDGET_PARTS, WINDOW_DECLARED_DEFAULTS, WINDOW_RECT_TYPE, WINDOW_SIDES,
  type VerdictFlag, type WidgetPartRow,
} from '../tables/window.js';

export interface WindowRecipeEntry { readonly code: number; readonly border: number }

/** §2.2 window flags (declared defaults §2.3, then the caller's). */
export interface WindowFlags {
  hasClose: boolean; hasZoom: boolean; collapseRequested: boolean; widgetFrame: boolean; noWidgets: boolean;
  drawActive: boolean; popupFamily: boolean; collapsed: boolean; sideTitle: boolean; altWidgets: boolean;
}

export interface WindowLayoutInput {
  /** The four side lists `S` in side order (0 top, 1 bottom, 2 left, 3 right), entries 0..N in list order; null or empty = no recipe. */
  sides: readonly (readonly WindowRecipeEntry[] | null | undefined)[];
  /** Rect-list entries in list order, template coordinates. */
  rects: readonly { readonly type: number; readonly rect: QdRect }[];
  /** Template bounds `B`. */
  B: QdRect;
  /** Content rect `C`, in the coordinates the placed cells are drawn in. */
  C: QdRect;
  /** `SW`, StringWidth(title). */
  titleWidth: number;
  /** `SWc`, StringWidth(title) in the condensed face (TT2); default TT2a `SW − titleLen`. */
  titleWidthCondensed?: number;
  /** Popup data (family 63, §2.1); default the creation values (PP6, PP7). */
  popup?: { pdMode: number; pdX: number; pdLen: number; pdCentre: number };
  /** `titleLen`, the title's length byte. */
  titleLength: number;
  flags?: Partial<WindowFlags>;
}

export interface SideLayout {
  readonly side: number;
  readonly horizontal: boolean;
  /** Part codes, entries 0..N. */
  readonly codes: readonly number[];
  /** Working template borders (TT8 may rewrite two of them). */
  readonly S: number[];
  /** Placed borders. */
  readonly P: number[];
  readonly anchor: number;
  /** Rows taken for this side, in order. */
  readonly rows: string[];
  /** Per segment 1..N: the AW row that sized it (absent: not in an allocation, the anchor cell). */
  readonly cellRow: (string | undefined)[];
}

export interface WindowLayout {
  readonly A: QdRect;
  readonly B: QdRect;
  readonly C: QdRect;
  readonly T4: QdRect;
  /** Flags after the layout (TS3 may have cleared `collapseRequested`). */
  readonly flags: WindowFlags;
  readonly sides: readonly (SideLayout | null)[];
  readonly rects: WindowLayoutInput['rects'];
}

const trunc = Math.trunc;
const inCodes = (codes: readonly number[] | '*', c: number): boolean => codes === '*' || codes.includes(c);
const ptIn = (x: number, y: number, r: QdRect): boolean => x >= r.left && x < r.right && y >= r.top && y < r.bottom;
const collapseBox = (f: WindowFlags): boolean => f.collapseRequested && f.widgetFrame && !f.noWidgets;

/** §2.1 rect-list lookup by type: the last entry of that type, else the first entry's rect. */
export function rectOfType(rects: WindowLayoutInput['rects'], type: number): QdRect {
  for (let i = rects.length - 1; i >= 0; i--) if (rects[i]!.type === type) return rects[i]!.rect;
  return rects[0]?.rect ?? rect(0, 0, 0, 0);
}

/** §4.1 `V(code, drop)`: true when the code collapses to width 0. */
function verdictZero(code: number, f: WindowFlags, drop: boolean): boolean {
  const row = PART_VERDICT.find(r => inCodes(r.codes, code))!;
  if (!row.flag) return row.zeroWhen;
  const v: Record<VerdictFlag, boolean> = { hasClose: f.hasClose, hasZoom: f.hasZoom, collapseBox: collapseBox(f), drop };
  return v[row.flag] === row.zeroWhen;
}

/** Lay out the four sides (LS, TS, AP, AW, TT rows; LC2: no cache). */
export function layoutWindow(input: WindowLayoutInput, trace?: EngineTrace): WindowLayout {
  const { source: _s, ...defaults } = WINDOW_DECLARED_DEFAULTS;
  const flags: WindowFlags = { ...defaults, drawActive: true, popupFamily: false, ...input.flags };
  const A = rectOfType(input.rects, WINDOW_RECT_TYPE.body), T4 = rectOfType(input.rects, WINDOW_RECT_TYPE.title);
  const sides = WINDOW_SIDES.map(sd => {
    const list = input.sides[sd.side];
    if (!list?.length) return null; // N = −1: no segments
    const s = layoutSide(sd.side, sd.horizontal, list, input, A, T4, flags);
    trace?.drawOps.push({ op: 'layout', side: sd.side, row: s.rows.join(','), P: [...s.P] });
    return s;
  });
  return { A, B: input.B, C: input.C, T4, flags, sides, rects: input.rects };
}

function layoutSide(side: number, horizontal: boolean, list: readonly WindowRecipeEntry[], input: WindowLayoutInput,
  A: QdRect, T4: QdRect, flags: WindowFlags): SideLayout {
  const N = list.length - 1;
  const codes = list.map(e => e.code), S = list.map(e => e.border);
  const w = (i: number): number => S[i]! - S[i - 1]!;
  const [c0, c1, a0, a1] = horizontal ? [input.C.left, input.C.right, A.left, A.right] : [input.C.top, input.C.bottom, A.top, A.bottom];
  const P = new Array<number>(N + 1).fill(0);
  P[0] = S[0]! + c0 - a0; P[N] = S[N]! + c1 - a1; // LS7
  const rows: string[] = [LAYOUT_SUMS.LS7.id];
  const cellRow: (string | undefined)[] = [];
  const out: SideLayout = { side, horizontal, codes, S, P, anchor: 0, rows, cellRow };

  // §4.2 first pass, drop = 0.
  const L = LAYOUT_SUMS;
  const box = collapseBox(flags);
  let F = 0, D = 0, G = 0, anchor = 0, gb = 0, ga = 0, W = input.titleWidth;
  for (let i = 1; i <= N; i++) {
    const c = codes[i]!;
    if (!verdictZero(c, flags, false) && !L.LS1.excluded.includes(c as never)) F += w(i);
    if (c === L.LS2.droppable) D += w(i);
    if (box && c === L.LS3.gap) G += w(i);
    if (box && c === L.LS3.cell) G -= w(i);
    if (c === L.LS4.anchor) { anchor = i; W -= (T4.right - S[i]!) + (S[i - 1]! - T4.left); }
    if (L.LS5.growers.includes(c as never)) { if (anchor) ga++; else gb++; }
  }
  (out as { anchor: number }).anchor = anchor;
  const E = P[N]! - P[0]!; // LS8
  let drop = false, titleLen = input.titleLength;

  // AW rows over segments first..last; AW7 walk, AW8 unclamped budget, AW9 skip.
  const allocate = (first: number, last: number, required: number, primary: number, gate: number): void => {
    if (first > last) return;
    const budget = P[last]! - P[first - 1]! - required;
    const skip = primary === 0 || budget === 0;
    const share = skip ? 0 : trunc(budget / primary);
    let rem = skip ? 0 : budget - share * primary, recipients = 0;
    for (let i = first; i <= last && !skip; i++) {
      const c = codes[i]!;
      // AW1a: a code-12 cell of template width 0 adds nothing (its fraction is skipped, not divided).
      if (inCodes(CELL_WIDTH[0]!.codes, c) && w(i) !== 0) rem += share - trunc(share / w(i)) * w(i);
      if (ALLOCATION.remainderRecipients.includes(c as never)) recipients++;
    }
    rows.push(skip ? ALLOCATION.AW9.id : budget < 0 ? ALLOCATION.AW8.id : ALLOCATION.AW7.id);
    for (let i = first; i <= last; i++) {
      const c = codes[i]!;
      const row = CELL_WIDTH.find(r => inCodes(r.codes, c)
        && (r.kind !== 'verdictZero' || verdictZero(c, flags, drop)) && (r.kind !== 'titleGate' || gate === 0))!;
      let width = 0;
      if (row.kind === 'tiles') width = skip || w(i) === 0 ? 0 : trunc(share / w(i)) * w(i); // AW1, AW1a
      else if (row.kind === 'primaryRemainder' || row.kind === 'remainder') {
        const extra = skip || recipients <= 0 ? 0 : trunc(rem / recipients);
        rem -= extra; recipients--;
        width = skip ? 0 : (row.kind === 'primaryRemainder' ? share : 0) + extra;
      } else if (row.kind === 'template') width = w(i);
      cellRow[i] = row.id;
      P[i] = P[i - 1]! + width; // AW7
    }
  };

  // §4.6 titled side (AP2).
  const titled = (): void => {
    let Fb = 0, Fa = 0;
    for (let i = 1; i <= N; i++) {
      if (i === anchor || verdictZero(codes[i]!, flags, drop) || TITLED_SIDE.TT1.excluded.includes(codes[i]! as never)) continue;
      if (i < anchor) Fb += w(i); else Fa += w(i);
    }
    rows.push(TITLED_SIDE.TT1.id);
    const R = E - Fb - Fa;
    if (R < W) {
      const SWc = input.titleWidthCondensed ?? input.titleWidth - TITLED_SIDE.TT2a.perCharacter * input.titleLength;
      W -= input.titleWidth - SWc;
      rows.push(input.titleWidthCondensed === undefined ? `${TITLED_SIDE.TT2.id},${TITLED_SIDE.TT2a.id}` : TITLED_SIDE.TT2.id);
    }
    if (R <= TITLED_SIDE.TT3.minRoom) { titleLen = 0; W = 0; rows.push(TITLED_SIDE.TT3.id); }
    if (titleLen === 0) {
      // Only segments 1..N exist; anchor − 1 = 0 is not a segment.
      if (anchor + 1 <= N && codes[anchor + 1] === TITLED_SIDE.TT4.bezel) Fa -= w(anchor + 1);
      if (anchor - 1 >= 1 && codes[anchor - 1] === TITLED_SIDE.TT4.bezel) Fb -= w(anchor - 1);
      rows.push(TITLED_SIDE.TT4.id);
    }
    const a = anchor;
    P[a - 1] = P[0]! + Fb; P[a] = P[N]! - Fa; // TT5
    const mid = trunc((c0 + c1) / 2);
    if (gb > 0 && ga > 0 && Fb > Fa) {
      const Lx = mid - trunc((W + (T4.left - S[a - 1]!) + (T4.right - S[a]!)) / 2);
      if (Lx > P[a - 1]!) P[a - 1] = Lx;
      if (P[a - 1]! + W < P[a]!) P[a] = P[a - 1]! + W;
      rows.push(TITLED_SIDE.TT6.id);
    } else {
      if (ga > 0) {
        const Rx = gb > 0 ? mid + trunc((W + (S[a]! - T4.right) + (S[a - 1]! - T4.left)) / 2) : P[a - 1]! + W;
        if (Rx < P[a]!) P[a] = Rx;
      }
      if (gb > 0 && P[a]! - W > P[a - 1]!) P[a - 1] = P[a]! - W;
      rows.push(TITLED_SIDE.TT7.id);
    }
    if (W < 0) {
      const dl = S[a - 1]! - T4.left, dr = S[a]! - T4.right;
      P[a - 1] = P[a - 1]! - dl; Fb -= dl; P[a] = P[a]! - dr; Fa += dr;
      S[a - 1] = T4.left; S[a] = T4.right;
      rows.push(TITLED_SIDE.TT8.id);
    }
    rows.push(TITLED_SIDE.TT9.id);
    allocate(1, a - 1, Fb, gb, titleLen);
    allocate(a + 1, N, Fa, ga, titleLen);
  };

  if (anchor && flags.popupFamily) { // AP1 (§4.6a): no too-short step, no TT rows
    const PP = POPUP_PLACEMENT, d = input.popup ?? PP.PP6, a = anchor;
    const X = d.pdMode === PP.PP1.mode ? d.pdCentre - input.C.left + PP.PP1.nudge - trunc(d.pdLen / 2) : d.pdX;
    let Fb = 0, Fa = 0;
    for (let i = 1; i <= N; i++) {
      if (i === a || verdictZero(codes[i]!, flags, false) || PP.PP3.excluded.includes(codes[i]! as never)) continue;
      if (i < a) Fb += w(i); else Fa += w(i);
    }
    P[a - 1] = input.C.left + X + PP.PP4.inset + S[a - 1]! - T4.left;
    P[a] = input.C.left + X + d.pdLen - PP.PP4.inset + S[a]! - T4.right;
    rows.push(ALLOCATION_PATH.AP1.id, d.pdMode === PP.PP1.mode ? PP.PP1.id : PP.PP2.id, PP.PP3.id, PP.PP4.id, PP.PP5.id,
      ...(input.popup ? [] : [PP.PP7.id]));
    allocate(1, a - 1, Fb, gb, PP.PP5.titleGate);
    allocate(a + 1, N, Fa, ga, PP.PP5.titleGate);
    return out;
  }
  if (E < F) {
    drop = true; F -= D; W = 0; titleLen = 0; rows.push(TOO_SHORT.TS1.id);
    if (E < F && G > 0) { flags.collapseRequested = false; F -= G; rows.push(TOO_SHORT.TS3.id); } else rows.push(TOO_SHORT.TS4.id);
  } else rows.push(TOO_SHORT.TS2.id);
  if (anchor && horizontal) { rows.push(ALLOCATION_PATH.AP2.id, ...(input.titleLength === 0 ? [TITLED_SIDE.TT10.id] : [])); titled(); }
  else { rows.push(ALLOCATION_PATH.AP3.id); allocate(1, N, F, gb + ga, ALLOCATION_PATH.AP3.titleGate); }
  return out;
}

/** §4.8 template cell `t` and placed cell `p` of segment `i` (CR rows). */
export function windowCell(layout: WindowLayout, side: number, i: number): { t: QdRect; p: QdRect } {
  const s = layout.sides[side]!, cr = CELL_RECT[side]!;
  const band = (e: typeof cr.from): number => e ? layout[e[0]][e[1]] : 0;
  const t0 = band(cr.from), t1 = band(cr.to), d = layout.C[cr.shift] - layout.A[cr.shift];
  const [s0, s1, p0, p1] = [s.S[i - 1]!, s.S[i]!, s.P[i - 1]!, s.P[i]!];
  return s.horizontal
    ? { t: rect(t0, s0, t1, s1), p: rect(t0 + d, p0, t1 + d, p1) }
    : { t: rect(s0, t0, s1, t1), p: rect(p0, t0 + d, p1, t1 + d) };
}

/**
 * hit-regions §4.2–§4.3: the structure region in the coordinates of `C`, built from the chrome
 * template's mask (SR4–SR12, TR1–TR4); its draw-time pixels are never consulted (SR13). SR1–SR3
 * have no runtime input: no public window type maps to a rect-only procID (HP5), and a missing
 * template leaves the window on its box (HP7).
 */
export function windowStructure(layout: WindowLayout, template: Pixmap, width: number, height: number,
  collapsed = layout.flags.collapsed): Region {
  const r = newRegion({ width, height }), { A, B, C, flags: f } = layout;
  if (C.right - C.left <= 1 && C.bottom - C.top <= 1) { // SR4; U4: the bottom term reads C.r, as decoded
    regionAddRect(r, rect(C.top - A.top + B.top, C.left - A.left + B.left, C.right - A.bottom + B.bottom, C.right - A.right + B.right));
    return r;
  }
  regionAddRect(r, C); // SR5, SR11
  for (const sd of WINDOW_SIDES) {
    if (collapsed && sd.horizontal === f.sideTitle) continue; // SR6; HP8: the caller's collapsed state
    const s = layout.sides[sd.side];
    for (let i = 1; s && i < s.S.length; i++) {
      const { t, p } = windowCell(layout, sd.side, i);
      if (emptyRect(p) || emptyRect(t)) continue; // SR7: an empty source has no mask to place
      const row = windowBlitRow(s.codes[i]!), sw = t.right - t.left, sh = t.bottom - t.top;
      if (row.blit === 'scale' || sw <= 1 || sh <= 1 || (sw === p.right - p.left && sh === p.bottom - p.top)) {
        regionAddMappedMask(r, template, t, p); // SR8, TR1, TR2
      } else regionAddTiledMask(r, template, t, p, row.direction!); // SR9, TR3, TR4
    }
  }
  return r;
}

/** §4.9 widget rect remap (RM2–RM8; RM1 does not arise: a layout always has its template). */
export function remapWidget(layout: WindowLayout, r: QdRect): QdRect {
  type Cell = { t: QdRect; p: QdRect };
  let tl: Cell | null = null, br: Cell | null = null;
  for (let side = 0; side < layout.sides.length && !(tl && br); side++) {
    const s = layout.sides[side];
    for (let i = 1; s && i < s.S.length && !(tl && br); i++) {
      const cell = windowCell(layout, side, i);
      if (!tl && ptIn(r.left, r.top, cell.t)) tl = cell;
      if (!br && ptIn(r.right - 1, r.bottom - 1, cell.t)) br = cell;
    }
  }
  if (!tl || !br) return rect(0, 0, 0, 0); // RM8
  return rect(r.top + tl.p.top - tl.t.top, r.left + tl.p.left - tl.t.left,
    r.bottom + br.p.bottom - br.t.bottom, r.right + br.p.right - br.t.right); // RM5, RM6
}

export interface WindowWidget {
  readonly row: WidgetPartRow;
  /** The rect-list entry, template coordinates. */
  readonly entry: QdRect;
  /** The remapped entry rect (RM rows); empty when it cannot be placed. */
  readonly rect: QdRect;
}

/** WD7 / HT6: every widget entry of types 1–3, last to first within a type, remapped. */
export function windowWidgets(layout: WindowLayout): WindowWidget[] {
  const out: WindowWidget[] = [];
  for (const row of WIDGET_PARTS) {
    for (let i = layout.rects.length - 1; i >= 0; i--) {
      const e = layout.rects[i]!;
      if (e.type === row.type) out.push({ row, entry: e.rect, rect: remapWidget(layout, e.rect) });
    }
  }
  return out;
}

/**
 * WD6: the popup family's three raw blits from the chrome template, not through the remap.
 * Type 5 moves with C's top-left, type 6 with its top-right, and the corner rect ending at
 * A's bottom-right with C's bottom-right (each `C − A` on the named edges).
 */
export function popupRawBlits(layout: WindowLayout): { src: QdRect; dst: QdRect }[] {
  if (!layout.flags.popupFamily) return [];
  const { A, C } = layout, d = WIDGET_DRAW.WD6, k = d.corner;
  const move = (r: QdRect, dx: number, dy: number) => rect(r.top + dy, r.left + dx, r.bottom + dy, r.right + dx);
  // §2.1: the last entry of each type (no fallback: a missing type is not blitted).
  const [t5, t6] = d.types.map(t => [...layout.rects].reverse().find(e => e.type === t)?.rect ?? null);
  const out: { src: QdRect; dst: QdRect }[] = [];
  if (t5) out.push({ src: t5, dst: move(t5, C.left - A.left, C.top - A.top) });
  if (t6) out.push({ src: t6, dst: move(t6, C.right - A.right, C.top - A.top) });
  const corner = rect(A.bottom - k, A.right - k, A.bottom, A.right);
  out.push({ src: corner, dst: move(corner, C.right - A.right, C.bottom - A.bottom) });
  return out.filter(b => !emptyRect(b.src));
}

/** WD11 / WD9: the pressed-strip cicn ids to request, in order (the `sideTitle` retry second). */
export function widgetCicnIds(flags: Partial<WindowFlags> = {}): number[] {
  const f = { ...WINDOW_DECLARED_DEFAULTS, ...flags }, d = WIDGET_DRAW.WD11;
  const base = d.base + (f.altWidgets ? d.altWidgets + (f.sideTitle ? d.altSideTitle : 0) : 0);
  return f.sideTitle ? [base, base + WIDGET_DRAW.WD9.sideTitleOffset] : [base];
}

/** WD9 / HT7 source sub-rect in the pressed strip. */
function stripSource(layout: WindowLayout, w: WindowWidget, strip: Pixmap): QdRect {
  const x = w.row.stripAfter.reduce((s, t) => { const r = rectOfType(layout.rects, t); return s + r.right - r.left; }, 0);
  const h = w.entry.bottom - w.entry.top;
  const y = layout.flags.collapsed && strip.height >= 2 * h ? h : 0;
  return rect(y, x, y + h, x + w.entry.right - w.entry.left);
}

/** WD9: the pressed widget, from the pressed strip to its remapped rect. A missing cicn draws nothing. */
export function drawPressedWidget(port: Pixmap, layout: WindowLayout, w: WindowWidget, strip: Pixmap | null, trace?: EngineTrace): void {
  trace?.drawOps.push({ op: 'widget', row: WIDGET_DRAW.WD9.id, part: w.row.part, found: !!strip });
  if (!strip || emptyRect(w.rect)) return;
  scaleBlit(port, strip, stripSource(layout, w, strip), w.rect, 'copyMask', trace);
}

/** HT7: the point hits this widget entry (mask of the strip, offset onto the remapped rect, and the rect). */
function hitsEntry(layout: WindowLayout, w: WindowWidget, strip: Pixmap | null, x: number, y: number): boolean {
  if (!strip || !ptIn(x, y, w.rect)) return false;
  const src = stripSource(layout, w, strip);
  const sx = src.left + x - w.rect.left, sy = src.top + y - w.rect.top;
  return sx >= 0 && sy >= 0 && sx < strip.width && sy < strip.height && strip.data[(sy * strip.width + sx) * 4 + 3]! > 0;
}

/** Whether a widget's `wHit` branch is reachable at all (HT1, HT2, HT3–HT5 flag, HT7 cicn and a non-empty rect). */
export function widgetHittable(layout: WindowLayout, w: WindowWidget, strip: Pixmap | null): boolean {
  const f = layout.flags;
  const on = w.row.flag === 'collapseBox' ? collapseBox(f) : f[w.row.flag];
  return f.widgetFrame && f.drawActive && on && !!strip && !emptyRect(w.rect);
}

/** §4.11 widget hit: the `wHit` result and the widget it names (null for 1 or 2). */
export function widgetHit(layout: WindowLayout, widgets: readonly WindowWidget[], strip: Pixmap | null, x: number, y: number,
  trace?: EngineTrace): { result: number; role: WidgetPartRow['role'] | null } {
  const H = WIDGET_HIT, f = layout.flags;
  const done = (row: string, result: number, role: WidgetPartRow['role'] | null = null) => {
    trace?.drawOps.push({ op: 'hit', row, result });
    return { result, role };
  };
  if (!f.widgetFrame) return done(H.HT1.id, H.HT1.result);
  if (!f.drawActive) return done(H.HT2.id, H.HT2.result);
  for (const row of WIDGET_PARTS) {
    const hit = widgets.find(w => w.row === row && widgetHittable(layout, w, strip) && hitsEntry(layout, w, strip, x, y));
    if (hit) return done(row.hitRow, row.hit, row.role);
  }
  return done(H.HT5a.id, H.HT5a.result);
}
