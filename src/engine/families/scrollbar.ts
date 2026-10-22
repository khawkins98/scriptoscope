// Scroll-bar family driver: message 0 (draw) and message 1 (test, part codes)
// of the Kaleidoscope 2.3.1 scroll-bar CDEF, service-table slot 1
// (`0x997e`; docs/spec/engine/scrollbar.md). Cited ranges: per-message state
// `0x9d84..0xa194`, draw `0xa2b6..0xa502`, hit test `0xa506..0xa676`, geometry
// `0xa8c6..0xae1c`, thumb/track/slicing `0xaed6..0xbcee`, arrows `0xc2d2..0xc850`.
//
// Every literal comes from tables/scrollbar.ts; every branch names its spec row
// in the trace. Not implemented, by declaration or pending spec answers
// (v2-lanes/L6/SPEC-QUESTIONS.md):
//   - SmartScroll's thumb rect (§6 item 6; absent by declaration);
//   - `lowDepth` / black-and-white ports (declared clear; I1, SC1, F3, X3);
// Engine policy (scrollbar §6 item 4): offscreen pixels nothing draws are left
// unwritten in the port and traced `unspecified`.
import type { Pixmap, QdPoint, QdRect } from '../qd/types.js';
import type { EngineTrace } from '../trace.js';
import type { ResourceChain, ResourceHit } from '../resources/chain.js';
import { emptyRect, rect } from '../qd/rect.js';
import { scaleBlit } from '../qd/scale.js';
import { transferBits } from '../qd/transfer.js';
import { fillPattern } from '../qd/pattern.js';
import {
  copyClipped, fillMaskClearRegion, iconBlit, insideBounds, newRegion, regionAddRect, regionHas,
  type IconSource,
} from '../qd/region.js';
import { axis, alongLength, pixmapBounds } from '../qd/axis.js';
import { drawSlices } from '../qd/slice.js';
import { expandIdGrid } from '../resources/ids.js';
import {
  SCROLLBAR_AD4, SCROLLBAR_ARROWS, SCROLLBAR_COMPOSITE, SCROLLBAR_COMPOSITE_ARROW, SCROLLBAR_DECLARED_DEFAULTS,
  SCROLLBAR_DOUBLE_MIN_THICKNESSES, SCROLLBAR_DRAW_ORDER, SCROLLBAR_GEOMETRY, SCROLLBAR_HILITE, SCROLLBAR_HIT_ARROWS,
  SCROLLBAR_HIT_TEST, SCROLLBAR_ICON_DRAW, SCROLLBAR_ICONS, SCROLLBAR_PATTERN_PROBE, SCROLLBAR_STATE, SCROLLBAR_THUMB,
  SCROLLBAR_ICS_PLANES, SCROLLBAR_THUMB_ID, SCROLLBAR_TIER, SCROLLBAR_TRACK_BASE, SCROLLBAR_TRACK_FILL, SCROLLBAR_TRACK_IDS, SCROLLBAR_TRACK_PROBE,
  type ScrollbarStateRow,
} from '../tables/scrollbar.js';

/** Option bytes of the Gestalt('Acid') block (§2); all clear by declaration. */
export interface ScrollbarOptionBytes {
  thumbSlice?: number;
  wholeTrack?: number;
  pressedHalves?: number;
  double?: number;
  proportional?: number;
  pressedSideOnly?: number;
}

export interface ScrollbarInput {
  /** The control rect `R`, in port coordinates. */
  rect: QdRect;
  hilite: number;
  value: number;
  min: number;
  max: number;
  visible?: boolean;
  /** An embedding parent exists and is inactive (read only at hilite 255, ST2). */
  parentInactive?: boolean;
  options?: ScrollbarOptionBytes;
  /** Owner is a Finder window (§2 `finderWindow`); false by declaration. */
  finderWindow?: boolean;
}

/** A cicn resource value as the adapter supplies it. */
export type ScrollbarCicn = IconSource;

/** An `ics#` resource value: its raw planes (image then mask, SCROLLBAR_ICS_PLANES). */
export interface ScrollbarIconMask {
  readonly planes: readonly number[];
}

/**
 * AI5: the `ics#` image plane in srcCopy, black foreground on white background,
 * through the `ics#` mask plane: set bits black, clear bits white, mask-clear
 * pixels transparent (left untouched by the masked copy).
 */
export function icsImagePixmap(planes: readonly number[]): Pixmap {
  const P = SCROLLBAR_ICS_PLANES;
  const data = new Uint8ClampedArray(P.size * P.size * 4);
  const bit = (offset: number, x: number, y: number): boolean =>
    (((planes[offset + y * P.rowBytes + (x >> 3)] ?? 0) >> (7 - (x & 7))) & 1) === 1;
  for (let y = 0; y < P.size; y++) {
    for (let x = 0; x < P.size; x++) {
      const i = (y * P.size + x) * 4;
      const v = bit(P.imageOffset, x, y) ? P.black : P.white;
      data[i] = v; data[i + 1] = v; data[i + 2] = v;
      data[i + 3] = bit(P.maskOffset, x, y) ? P.opaque : 0;
    }
  }
  return { width: P.size, height: P.size, data };
}

export interface ScrollbarState {
  row: ScrollbarStateRow['id'];
  inactive: boolean;
  disabled: boolean;
  /** hilite in 1..253, read alone (ST4 note; AC2). */
  pressedHilite: boolean;
  horizontal: boolean;
  t: number;
  double: boolean;
  proportional: boolean;
  wholeTrack: boolean;
  thumbSlice: number;
  pressedHalves: boolean;
  pressedSideOnly: boolean;
}

export interface ScrollbarGeometry {
  state: ScrollbarState;
  tier: number;
  trackId: number;
  trackCicn: ScrollbarCicn | null;
  trackPattern: Pixmap | null;
  doubleArt: boolean;
  composite: boolean;
  R: QdRect;
  T: QdRect;
  /** Arrow boxes 0..3 (§5.3). */
  boxes: readonly [QdRect, QdRect, QdRect, QdRect];
  len: number;
  Th: QdRect;
}

const toSigned8 = (b: number): number => ((b & 255) ^ 128) - 128;
const has = (b: number | undefined): boolean => (b ?? 0) !== 0;

/** §4.1 state rows and §2 derived state. */
export function scrollbarState(input: ScrollbarInput): ScrollbarState {
  const { hilite, min, max, rect: R } = input;
  const o = input.options ?? {};
  const H = SCROLLBAR_HILITE;
  const pick = (id: ScrollbarStateRow['id']): ScrollbarStateRow => SCROLLBAR_STATE.find(r => r.id === id)!;
  let row: ScrollbarStateRow;
  if (hilite === H.inactive) row = pick('ST1');
  else if (hilite === H.disabled && SCROLLBAR_DECLARED_DEFAULTS.appearancePresent && input.parentInactive === true) row = pick('ST2');
  else if (hilite === H.disabled) row = pick('ST3');
  else if (min === max) row = pick('ST4');
  else if (hilite >= H.pressedFrom && hilite <= H.pressedTo) row = pick('ST5');
  else row = pick('ST6');
  const disabled = row.disabled || hilite >= H.disabledFrom;
  const width = R.right - R.left, height = R.bottom - R.top;
  const horizontal = width > height;
  const t = horizontal ? height : width;
  const alongR = horizontal ? width : height;
  const wholeTrack = has(o.wholeTrack);
  return {
    row: row.id, inactive: row.inactive, disabled,
    pressedHilite: hilite >= H.pressedFrom && hilite <= H.pressedTo,
    horizontal, t,
    double: has(o.double) && alongR >= SCROLLBAR_DOUBLE_MIN_THICKNESSES.factor * t,
    proportional: has(o.proportional) && (input.finderWindow ?? SCROLLBAR_DECLARED_DEFAULTS.finderWindow),
    wholeTrack,
    thumbSlice: toSigned8(o.thumbSlice ?? 0),
    pressedHalves: has(o.pressedHalves) && wholeTrack && !disabled && hilite !== 0,
    pressedSideOnly: has(o.pressedSideOnly) && !wholeTrack && !disabled && hilite !== 0,
  };
}

function req(trace?: EngineTrace, row?: string): { trace?: EngineTrace; row?: string } {
  return { ...(trace ? { trace } : {}), ...(row ? { row } : {}) };
}

/** Thumb cicn (TH3–TH5): returns the hit and whether the small (+1956) thumb was missing. */
function probeThumb(chain: ResourceChain, st: ScrollbarState, hilite: number, trace?: EngineTrace, row?: string):
  { hit: (ResourceHit<ScrollbarCicn> & { id: number }) | null; smallMissing: boolean; idRow: string } {
  const idRow = SCROLLBAR_THUMB_ID.find(r => r.hilite === '*' || r.hilite === hilite)!;
  const thumbId = st.horizontal ? idRow.horizontal : idRow.vertical;
  const small = st.t <= SCROLLBAR_THUMB.TH5.maxThickness;
  const smallId = thumbId + SCROLLBAR_THUMB.TH5.smallOffset;
  const ids = small ? [smallId, thumbId] : [thumbId];
  const hit = chain.probe<ScrollbarCicn>('cicn', ids, req(trace, `${row ? `${row},` : ''}${idRow.id}${small ? ',TH5' : ''}`));
  return { hit, smallMissing: small && hit?.id !== smallId, idRow: idRow.id };
}

/**
 * Per-message state (§4.1–§4.4) and geometry (§5.2–§5.7). Issues the track
 * cicn, track pattern and (unless disabled) thumb-length requests in §3 order.
 */
export function scrollbarGeometry(chain: ResourceChain, input: ScrollbarInput, trace?: EngineTrace): ScrollbarGeometry {
  const st = scrollbarState(input);
  const ax = axis(st.horizontal);
  const R = input.rect;
  // §4.2 track cicn.
  const base = st.horizontal ? SCROLLBAR_TRACK_BASE.horizontal : SCROLLBAR_TRACK_BASE.vertical;
  const tierRow = SCROLLBAR_TIER.find(r => r.when === 'otherwise'
    || (r.when === 'inactive' && st.inactive) || (r.when === 'disabled' && st.disabled && !st.inactive)
    || (r.when === 'pressed' && st.pressedHilite && !st.disabled))!;
  const tier = tierRow.tier;
  const P = SCROLLBAR_TRACK_PROBE;
  let trackId = base + tier; // TR5
  let found: ResourceHit<ScrollbarCicn> | null = null;
  let doubleArt = false;
  const small = st.t <= P.small.maxThickness;
  if (small && st.double) {
    found = chain.getResource<ScrollbarCicn>('cicn', base + tier + P.TR6.offset, req(trace, `${tierRow.id},TR6`));
    if (found) { trackId = base + tier + P.TR6.offset; doubleArt = true; }
  }
  if (small && !found) {
    found = chain.getResource<ScrollbarCicn>('cicn', base + tier + P.TR7.offset, req(trace, `${tierRow.id},TR7`));
    trackId = base + tier + P.TR7.offset;
  }
  if (!found && st.double) {
    found = chain.getResource<ScrollbarCicn>('cicn', base + tier + P.TR8.offset, req(trace, `${tierRow.id},TR8`));
    if (found) { trackId += P.TR8.offset; doubleArt = true; }
  }
  if (!found) found = chain.getResource<ScrollbarCicn>('cicn', base + tier + P.TR9.offset, req(trace, `${tierRow.id},TR9`));
  const trackCicn = found?.value ?? null; // TR10 when null
  // §4.3 track pattern.
  let pat = chain.getResource<Pixmap>('ppat', trackId, req(trace, 'TP1'));
  if (!pat && doubleArt) pat = chain.getResource<Pixmap>('ppat', trackId + SCROLLBAR_PATTERN_PROBE.TP2.offset, req(trace, 'TP2'));
  if (!pat) pat = chain.getResource<Pixmap>('ppat', base + tier, req(trace, 'TP3'));
  const trackPattern = pat?.value ?? null; // TP4 when null
  // §4.4 composite flag.
  const cb = SCROLLBAR_COMPOSITE.CF1.boundsAbove;
  const composite = !!trackCicn && (trackCicn.pixmap.width > cb || trackCicn.pixmap.height > cb);
  // §5.2–§5.3.
  const c = st.t - 1, e = composite ? 0 : 1;
  const L = ax.a0(R), Rr = ax.a1(R), C0 = ax.c0(R), C1 = ax.c1(R);
  const n = st.double ? 2 * c : c;
  const T = st.inactive ? R : ax.mk(L + n, Rr - n, C0, C1);
  const boxes = [
    ax.mk(L, L + c + e, C0, C1),
    ax.mk(L + c, L + 2 * c + e, C0, C1),
    ax.mk(Rr - 2 * c - e, Rr - c, C0, C1),
    ax.mk(Rr - c - e, Rr, C0, C1),
  ] as const;
  // §5.6–§5.7 thumb length and rect (not when disabled, TH2).
  let len = 0;
  let Th = rect(0, 0, 0, 0);
  const visible = (input.visible ?? true) && !emptyRect(R);
  if (!st.disabled && visible) {
    const { hit, smallMissing } = probeThumb(chain, st, input.hilite, trace, 'thumb-length');
    const L5 = SCROLLBAR_THUMB.length;
    let minLen = hit ? (st.horizontal ? hit.value.pixmap.width : hit.value.pixmap.height) : st.t + L5.noThumbExtra;
    if (smallMissing) minLen -= L5.smallMissingTrim;
    const trackLen = alongLength(ax, T);
    if (st.proportional) {
      const alongR = alongLength(ax, R);
      len = Math.trunc((trackLen * alongR) / (input.max - input.min + alongR));
      len = Math.max(minLen, Math.min(trackLen, len));
    } else {
      len = minLen; // SmartScroll absent by declaration
      if (len > trackLen) len = 0;
    }
    const range = input.max - input.min;
    const offset = len === 0 ? 0 : input.value - input.min;
    const free = trackLen - len;
    const pos = range === 0 ? 0 : Math.trunc(((offset * free) >>> 0) / Math.fround(range) + 0.5);
    Th = ax.mk(ax.a0(T) + pos, ax.a0(T) + pos + len, ax.c0(T), ax.c0(T) + st.t);
  }
  if (trace) {
    trace.rects.R = R; trace.rects.T = T; trace.rects.Th = Th;
    boxes.forEach((b, i) => { trace.rects[`box${i}`] = b; });
  }
  return { state: st, tier, trackId, trackCicn, trackPattern, doubleArt, composite, R, T, boxes, len, Th };
}

/** §4.8 hit test: the part code at port point `P`. */
export function scrollbarPartAt(g: ScrollbarGeometry, P: QdPoint): { part: number; row: string } {
  const ax = axis(g.state.horizontal);
  const inside = (r: QdRect): boolean => P.x >= r.left && P.x < r.right && P.y >= r.top && P.y < r.bottom;
  const a = g.state.horizontal ? P.x : P.y;
  for (const row of SCROLLBAR_HIT_TEST) {
    switch (row.test) {
      case 'outside': if (g.state.disabled || !inside(g.R)) return { part: row.part, row: row.id }; break;
      case 'box': if ((!row.onlyDouble || g.state.double) && inside(g.boxes[row.box!])) return { part: row.part, row: row.id }; break;
      case 'thumb': if (inside(g.Th)) return { part: row.part, row: row.id }; break;
      case 'lowSide': if (a < ((ax.a0(g.Th) + ax.a1(g.Th)) >> 1)) return { part: row.part, row: row.id }; break;
      case 'otherwise': return { part: row.part, row: row.id };
    }
  }
  return { part: 0, row: 'HT1' };
}

export interface ScrollbarDrawResult {
  geometry: ScrollbarGeometry;
  drawn: boolean;
}

/** Message 0: draw the scroll bar into `port` (§3 draw order). */
export function drawScrollbar(port: Pixmap, chain: ResourceChain, input: ScrollbarInput, trace?: EngineTrace): ScrollbarDrawResult {
  const g = scrollbarGeometry(chain, input, trace);
  const { state: st, R } = g;
  const ax = axis(st.horizontal);
  if (!(input.visible ?? true) || emptyRect(R)) {
    trace?.drawOps.push({ op: 'skip', row: 'draw-guard', reason: 'invisible or empty control rect' });
    return { geometry: g, drawn: false };
  }
  const phase: QdPoint = { x: R.left, y: R.top };
  const hitArrows = SCROLLBAR_HIT_ARROWS.find(r => r.hilite === input.hilite);
  const halfClip = newRegion(port);

  // §5.4 cells from the bounds of the cicn that supplies the cell (AC2/AC3
  // choice), recomputed per arrow; only composite/doubleArt/half are the track's.
  const cellFor = (index: number, box: QdRect, source: ScrollbarCicn): { cell: QdRect; box: QdRect; half: boolean } => {
    const tb = pixmapBounds(source.pixmap);
    const l = ax.a0(tb), r = ax.a1(tb), h = ax.c1(tb) - ax.c0(tb), d = h - 1;
    const cc0 = ax.c0(tb), cc1 = ax.c1(tb);
    const half = st.pressedHalves;
    const bs = ax.a0(box), be = ax.a1(box), bc0 = ax.c0(box), bc1 = ax.c1(box);
    const cell = (a0: number, a1: number) => ax.mk(a0, a1, cc0, cc1);
    if (half && index === 0 && !st.double) { const ce = (l + r) >> 1; return { cell: cell(l, ce), box: ax.mk(bs, bs + (ce - l), bc0, bc1), half: true }; }
    if (half && index === 1 && g.doubleArt) { const ce = (l + r) >> 1; return { cell: cell(l + d, ce), box: ax.mk(bs, bs + (ce - l - d), bc0, bc1), half: true }; }
    if (half && index === 2 && g.doubleArt) { const cs = (l + r + 1) >> 1; return { cell: cell(cs, r - d), box: ax.mk(be - (r - d - cs), be, bc0, bc1), half: true }; }
    if (half && index === 3 && !st.double) { const cs = (l + r + 1) >> 1; return { cell: cell(cs, r), box: ax.mk(be - (r - cs), be, bc0, bc1), half: true }; }
    switch (index) {
      case 0: return { cell: cell(l, l + d), box, half: false };
      case 1: return { cell: g.doubleArt ? cell(l + d, l + 2 * d) : cell(r - d - 1, r - 1), box, half: false };
      case 2: return { cell: g.doubleArt ? cell(r - 2 * d, r - d) : cell(l + 1, l + d + 1), box, half: false };
      default: return { cell: cell(r - d, r), box, half: false };
    }
  };

  /** The arrow drawer (§4.5). Returns the drawn box when it was drawn in half mode. */
  const drawArrow = (index: 0 | 1 | 2 | 3, step: string): QdRect | null => {
    if (st.inactive) { trace?.drawOps.push({ op: 'arrow', row: `${step},${SCROLLBAR_AD4.id}`, arrow: index }); return null; }
    const isHit = !!hitArrows?.arrows.includes(index);
    const hitRow = hitArrows ? hitArrows.id : 'AH3';
    const box = g.boxes[index];
    if (g.composite) {
      const A = SCROLLBAR_COMPOSITE_ARROW;
      let src = g.trackCicn!, pat = g.trackPattern, srcRow = 'AC3';
      if (st.pressedHilite && !isHit) {
        srcRow = 'AC2';
        const c2 = chain.getResource<ScrollbarCicn>('cicn', g.trackId + A.AC2.offset, req(trace, 'AC2'));
        const p2 = chain.getResource<Pixmap>('ppat', g.trackId + A.AC2.offset, req(trace, 'AC2'));
        src = c2?.value ?? g.trackCicn!;
        pat = p2?.value ?? g.trackPattern;
      }
      const { cell, box: dst, half } = cellFor(index, box, src);
      const row = `${step},${hitRow},AC1,${srcRow}`;
      trace?.rects && (trace.rects[`cell${index}`] = cell);
      // §5.4: a cell can extend past a source shorter than d; those pixels are
      // undefined (qd-primitives S5). Not clamped: the blits leave them untouched.
      if (!insideBounds(src.pixmap, cell)) trace?.drawOps.push({ op: 'arrow', row: `${row},5.4`, arrow: index, src: cell,
        unspecified: 'cell extends outside its source cicn; those destination pixels are left untouched' });
      if (pat) {
        trace?.drawOps.push({ op: 'arrow', row: `${row},AC4`, arrow: index, src: cell, dst, half });
        scaleBlit(port, src.pixmap, cell, dst, 'copyMask');
        fillMaskClearRegion(port, src.pixmap, cell, { x: dst.left, y: dst.top }, pat, phase, trace, 'AC4');
      } else {
        trace?.drawOps.push({ op: 'arrow', row: `${row},AC5`, arrow: index, src: cell, dst, half });
        iconBlit(port, src, cell, dst, trace, 'AC5');
      }
      return half ? dst : null;
    }
    // Icon lane (AI1–AI4).
    const which = SCROLLBAR_ARROWS[index]!.arrow;
    const iconRow = SCROLLBAR_ICONS.find(r => (r.when === 'disabled' && st.disabled)
      || (r.when === 'hit' && !st.disabled && isHit) || r.when === 'raised')!;
    const id = iconRow.ids[which][st.horizontal ? 'horizontal' : 'vertical'];
    const row = `${step},${hitRow},${iconRow.id},${SCROLLBAR_ICON_DRAW.id}`;
    const mask = chain.getResource<ScrollbarIconMask>(SCROLLBAR_ICON_DRAW.maskType, id, req(trace, row));
    if (!mask) { trace?.drawOps.push({ op: 'arrowIcon', row, arrow: index, id, drawn: false }); return null; }
    const color = SCROLLBAR_DECLARED_DEFAULTS.colorPort && !SCROLLBAR_DECLARED_DEFAULTS.lowDepth
      ? chain.get1Resource<Pixmap>(SCROLLBAR_ICON_DRAW.colorType, id, mask.provider, req(trace, row)) : null;
    // AI6: the icon's 16 × 16 frame into the arrow box (scaled when t ≠ 16).
    const icon = color ? color.value : icsImagePixmap(mask.value.planes);
    const drawRow = color ? `${row},AI6` : `${row},AI5,AI6`;
    trace?.drawOps.push({ op: 'arrowIcon', row: drawRow, arrow: index, id, src: pixmapBounds(icon), dst: box, transfer: 'copyMask' });
    transferBits(port, icon, pixmapBounds(icon), box, 'copyMask');
    return null;
  };

  // §5.5 track source rect: the bounds of the cicn the segment draws.
  const trackSource = (cicn: ScrollbarCicn): QdRect => {
    const tb = pixmapBounds(cicn.pixmap);
    if (!g.composite || st.inactive) return tb;
    const k = (ax.c1(tb) - ax.c0(tb) - 1) * (g.doubleArt ? 2 : 1);
    return ax.mk(ax.a0(tb) + k, ax.a1(tb) - k, ax.c0(tb), ax.c1(tb));
  };

  const thumbRegion = newRegion(port);
  const F = SCROLLBAR_TRACK_FILL;
  const drawSegment = (G: QdRect, pageFlag: boolean, segRow: string): void => {
    if (emptyRect(G)) { trace?.drawOps.push({ op: 'segment', row: `${segRow},TF5`, dst: G }); return; }
    let cicn = g.trackCicn, pat = g.trackPattern, srcRow = 'TF4';
    if (st.pressedHalves || (st.pressedSideOnly && !pageFlag)) {
      srcRow = 'TF3';
      cicn = chain.getResource<ScrollbarCicn>('cicn', g.trackId + F.TF3.offset, req(trace, 'TF3'))?.value ?? null;
      pat = chain.getResource<Pixmap>('ppat', g.trackId + F.TF3.offset, req(trace, 'TF3'))?.value ?? null;
    }
    trace?.drawOps.push({ op: 'segment', row: `${segRow},${srcRow}`, dst: G, pageFlag });
    const w = G.right - G.left, hgt = G.bottom - G.top;
    const off: Pixmap = { width: w, height: hgt, data: new Uint8ClampedArray(w * hgt * 4) };
    const local = rect(0, 0, hgt, w);
    if (!cicn && !pat) {
      trace?.drawOps.push({ op: 'erase', row: 'TF6', dst: G, rgb: { r: 255, g: 255, b: 255 } });
      off.data.fill(255);
    }
    if (pat) fillPattern(off, local, pat, { x: phase.x - G.left, y: phase.y - G.top }, trace, 'TF7');
    if (cicn) drawSlices(off, st.horizontal, cicn.pixmap, trackSource(cicn), local, F.TF8.sliceMode,
      { modeZeroCap: SCROLLBAR_GEOMETRY.caps.modeZeroCap, row: 'TF8', ...(trace ? { trace } : {}) });
    const undef = new Uint8Array(w * hgt);
    let undefCount = 0;
    for (let i = 0; i < w * hgt; i++) if (off.data[i * 4 + 3] === 0) { undef[i] = 1; undefCount++; }
    if (undefCount) trace?.drawOps.push({ op: 'segment', row: 'offscreen', dst: G, unspecified: `${undefCount} offscreen pixels drawn by neither pattern nor cicn (scrollbar §6 item 4)` });
    const inR = (x: number, y: number): boolean => x >= R.left && x < R.right && y >= R.top && y < R.bottom;
    copyClipped(port, off, { x: G.left, y: G.top }, (x, y) => inR(x, y) && !regionHas(thumbRegion, x, y) && !regionHas(halfClip, x, y), undef);
  };

  for (const step of SCROLLBAR_DRAW_ORDER) {
    if (step.onlyDouble && !st.double) continue;
    if (step.arrow !== undefined) { drawArrow(step.arrow, step.id); continue; }
    if (step.id === 'TH') {
      if (emptyRect(g.T)) { trace?.drawOps.push({ op: 'thumb', row: 'TH1' }); break; } // no thumb and no track
      if (st.disabled) { trace?.drawOps.push({ op: 'thumb', row: 'TH2' }); continue; }
      const { hit, idRow } = probeThumb(chain, st, input.hilite, trace);
      if (!hit) { trace?.drawOps.push({ op: 'thumb', row: `${idRow},TH6` }); continue; }
      drawSlices(port, st.horizontal, hit.value.pixmap, pixmapBounds(hit.value.pixmap), g.Th, st.thumbSlice,
        { modeZeroCap: SCROLLBAR_GEOMETRY.caps.modeZeroCap, row: `${idRow},TH7`, region: thumbRegion, ...(trace ? { trace } : {}) });
      continue;
    }
    // Track (TF).
    if (st.disabled) { drawSegment(g.T, false, 'TH2'); continue; }
    if (st.wholeTrack) {
      if (st.pressedHalves && hitArrows) {
        // TF9: redraw the hit arrow(s); arrows drawn in half mode leave the fill clip.
        const redraw: (0 | 1 | 2 | 3)[] = hitArrows.hilite === SCROLLBAR_HIT_ARROWS[0]!.hilite
          ? (st.double ? [0, 2] : [0]) : (st.double ? [3, 1] : [3]);
        for (const i of redraw) { const halfBox = drawArrow(i, 'TF9'); if (halfBox) regionAddRect(halfClip, halfBox); }
      }
      drawSegment(g.T, false, 'TF1');
      continue;
    }
    const T = g.T, Th = g.Th;
    if (ax.a0(Th) > ax.a0(T)) drawSegment(ax.mk(ax.a0(T), ax.a0(Th) + 1, ax.c0(T), ax.c1(T)), input.hilite === F.TF2.lowPageHilite, 'TF2-low');
    if (ax.a1(T) > ax.a1(Th)) drawSegment(ax.mk(ax.a1(Th) - 1, ax.a1(T), ax.c0(T), ax.c1(T)), input.hilite === F.TF2.highPageHilite, 'TF2-high');
  }
  return { geometry: g, drawn: true };
}

/**
 * Every (type, id) the scroll-bar tables can request for one orientation, so
 * an asynchronous adapter can preload a synchronous ResourceChain. Derived from
 * the table rows only.
 */
export function scrollbarResourceIds(horizontal: boolean): { type: string; id: number }[] {
  const out: { type: string; id: number }[] = [];
  for (const id of expandIdGrid(horizontal ? SCROLLBAR_TRACK_IDS.horizontal : SCROLLBAR_TRACK_IDS.vertical)) out.push({ type: 'cicn', id }, { type: 'ppat', id });
  for (const r of SCROLLBAR_THUMB_ID) {
    const id = horizontal ? r.horizontal : r.vertical;
    out.push({ type: 'cicn', id }, { type: 'cicn', id: id + SCROLLBAR_THUMB.TH5.smallOffset });
  }
  for (const r of SCROLLBAR_ICONS) for (const end of ['low', 'high'] as const) {
    const id = r.ids[end][horizontal ? 'horizontal' : 'vertical'];
    out.push({ type: SCROLLBAR_ICON_DRAW.maskType, id }, { type: SCROLLBAR_ICON_DRAW.colorType, id });
  }
  return out;
}
