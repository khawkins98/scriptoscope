// Slider family driver: the Kaleidoscope 2.3.1 slider CDEF 3
// (docs/spec/engine/slider.md; every address below is a CDEF 3 file offset).
// Messages: 0 draw, 1 test, 2/10/11 regions, 3 init, 5 posCntl, 6 thumbCntl,
// 13 drawGhost, 19 getFeatures and 26 calcValueFromPos (main CDEF 3
// `0x4ac..0x6a6`). Cited ranges: gate CDEF 3 `0x13c..0x286`, per-message state
// `0x28a..0x4a8`, band `0x866..0x92c`, thumb rect `0xa82..0xb5a`, hit test
// `0xb90..0xbf6`, tracking `0x6d6..0x7a6`, `0x95e..0xa34`, `0xc22..0xd2e`,
// drawer `0xdce..0x1474`, slicing `0x2970..0x2b5a`, `0x1486..0x167c`, blits
// `0x205e..0x25f2`.
//
// Every literal comes from tables/slider.ts; every branch names its spec row in
// the trace. Not implemented, by declaration (slider §2 declared defaults) or
// because the spec leaves it open (§6; v2-lanes/family3/SPEC-QUESTIONS.md):
//   - the handed-off System slider (G2): reported, never drawn here (§6 item 3);
//   - `lowDepth` / black-and-white ports (BL2), picture recording (BL3), the
//     monochrome Window Manager port path and several devices (§6 items 4, 8);
//   - messages 4 (dispose), 27 and 34 (no drawing effect; §6 item 9);
//   - the undefined cases of §6 items 5–7 (division by zero, degenerate slices,
//     undefined `c`): traced `unspecified`, never guessed.
import type { Pixmap, QdPoint, QdRect, Rgba } from '../qd/types.js';
import type { EngineTrace } from '../trace.js';
import type { ResourceChain, ResourceHit } from '../resources/chain.js';
import type { IconSource } from '../qd/region.js';
import { emptyRect, insetRect, offsetRect, rect } from '../qd/rect.js';
import { transferBits } from '../qd/transfer.js';
import { tileBlit } from '../qd/tile.js';
import { getPixel } from '../qd/pixel.js';
import { newPen, moveTo, lineTo } from '../qd/pen.js';
import { axis, alongLength, pixmapBounds, type Axis } from '../qd/axis.js';
import { expandIdGrid } from '../resources/ids.js';
import {
  SLIDER_BAND, SLIDER_BASE, SLIDER_BLIT, SLIDER_CORNER, SLIDER_DECLARED_DEFAULTS, SLIDER_DRAW_GUARD, SLIDER_DRAW_ORDER,
  SLIDER_FEATURES, SLIDER_GATE, SLIDER_GROUP, SLIDER_GROUP_STRIDE, SLIDER_HILITE, SLIDER_HIT_TEST, SLIDER_IDS,
  SLIDER_MESSAGE, SLIDER_RECORD, SLIDER_SLICE, SLIDER_THUMB, SLIDER_THUMB_CELL, SLIDER_THUMB_RECT, SLIDER_TICKS,
  SLIDER_TRACK, SLIDER_TRACK_TIER, SLIDER_TRACKING, SLIDER_VARIATION, SLIDER_WORD, SLIDER_CINF_LENGTH,
} from '../tables/slider.js';

/** Control inputs (§2). */
export interface SliderInput {
  /** The control rect `R`, in port coordinates. */
  rect: QdRect;
  hilite: number;
  value: number;
  min: number;
  max: number;
  /** procID − 48 (§1.1). */
  variation: number;
  visible?: boolean;
}

/** A `cinf` resource value: its raw bytes (at least the header bytes the slider reads). */
export interface SliderCinf {
  readonly bytes: readonly number[];
}

/** The per-control private record (§4.2). Survives across messages. */
export interface SliderRecord {
  /** Fixed at creation (ID1, ID3). */
  readonly horizontal: boolean;
  readonly group: 0 | 1 | 2;
  /** Tick count `n` (ID2, ID4, ID5). */
  ticks: number;
  /** Corner `c` (ID6); null while undefined (ID8 on a new record). */
  corner: number | null;
  /** `tA` and `T` (ID7); null until a message with a thumb cicn and a defined `c`. */
  thumbAlong: number | null;
  travel: number | null;
}

/** Per-message state (§2 derived state, §5.1, §5.2). */
export interface SliderState {
  record: SliderRecord;
  input: SliderInput;
  base: number;
  gb: number;
  thumb: (ResourceHit<IconSource> & { id: number }) | null;
  /** Corner `c` used by this message (current, §5.2); null when undefined (ID8). */
  c: number | null;
  range: number;
  offset: number;
  /** Track band (§5.1). */
  B: QdRect;
  /** Thumb rect (§5.2); null when `c` is undefined and `range ≠ 0` (§6 item 7). */
  Th: QdRect | null;
}

export type SliderGateRow = 'G1' | 'G2' | 'G3';

const toWord = (v: number): number => (v << SLIDER_WORD.bits) >> SLIDER_WORD.bits;
const has = (variation: number, bit: number): boolean => (variation & bit) !== 0;
const req = (trace: EngineTrace | undefined, row: string): { trace?: EngineTrace; row: string } => ({ ...(trace ? { trace } : {}), row });
const isHorizontal = (R: QdRect): boolean => R.right - R.left > R.bottom - R.top;

/** §4.1 gate, on every message: `cinf` only, `horizontal` from the current R. */
export function sliderGate(chain: ResourceChain, input: SliderInput, trace?: EngineTrace): SliderGateRow {
  const base = isHorizontal(input.rect) ? SLIDER_BASE.horizontal : SLIDER_BASE.vertical;
  for (const p of SLIDER_GATE.G1.probes) {
    if (p.bit !== 0 && !has(input.variation, p.bit)) continue;
    if (chain.getResource<SliderCinf>(SLIDER_GATE.G1.type, base + p.offset, req(trace, SLIDER_GATE.G1.id))) return 'G1';
  }
  const row: SliderGateRow = SLIDER_DECLARED_DEFAULTS.systemSlider ? 'G2' : 'G3';
  trace?.drawOps.push({ op: 'gate', row, ...(row === 'G2' ? { handOff: 'System CDEF 3 (procedural Platinum substitute, §6 item 3)' } : {}) });
  return row;
}

/** ID1/ID2: a new private record; `horizontal` and `g` fixed now (ID3). */
export function newSliderRecord(input: SliderInput, trace?: EngineTrace): SliderRecord {
  const row = SLIDER_GROUP.find(r => r.bit === 0 || has(input.variation, r.bit))!;
  trace?.drawOps.push({ op: 'record', row: `${SLIDER_RECORD.ID1.id},${SLIDER_RECORD.ID2.id},${row.id}` });
  return { horizontal: isHorizontal(input.rect), group: row.group, ticks: 0, corner: null, thumbAlong: null, travel: null };
}

/** §5.1 track band B. */
function band(ax: Axis, R: QdRect, group: 0 | 1 | 2): QdRect {
  const c0 = ax.c0(R), c1 = ax.c1(R), w = SLIDER_BAND.cross;
  const s = group === 0 ? c0 : group === 1 ? c1 - w : Math.trunc(toWord(c0 + c1) / 2) - SLIDER_BAND.centreHalf;
  return ax.mk(ax.a0(R), ax.a1(R), toWord(s), toWord(s + w));
}

/**
 * Per-message state (§4.2) after the gate: thumb (TH1), `tA`/`T` with the
 * previous `c` (ID7), then `c` (ID6/ID8), `range`/`offset` (ID9), B and Th.
 * Issues the thumb and corner requests in §3.1 order.
 */
export function sliderMessageState(chain: ResourceChain, record: SliderRecord, input: SliderInput, trace?: EngineTrace): SliderState {
  const ax = axis(record.horizontal); // ID3
  const R = input.rect;
  const base = record.horizontal ? SLIDER_BASE.horizontal : SLIDER_BASE.vertical;
  const gb = base + SLIDER_GROUP_STRIDE.stride * record.group;
  const thumb = chain.probe<IconSource>('cicn', [gb + SLIDER_THUMB.TH1.offset, base + SLIDER_THUMB.TH1.offset], req(trace, SLIDER_THUMB.TH1.id));
  const alongR = alongLength(ax, R);
  if (thumb) {
    record.thumbAlong = alongLength(ax, pixmapBounds(thumb.value.pixmap));
    record.travel = record.corner === null ? null : alongR - record.thumbAlong - 2 * record.corner; // ID7
  }
  const cinf = chain.probe<SliderCinf>('cinf', [gb, base], req(trace, SLIDER_CORNER.ID6.id));
  if (cinf) {
    const b = cinf.value.bytes[SLIDER_CORNER.ID6.byte];
    // CF3: a cinf too short for byte 0 is an undefined read; declared policy: the corner is not found (ID8).
    if (b === undefined) trace?.drawOps.push({ op: 'state', row: `${SLIDER_CORNER.ID6.id},${SLIDER_CINF_LENGTH.CF3.id},${SLIDER_CORNER.ID8.id}`,
      unspecified: 'corner cinf shorter than its first byte; treated as not found', corner: record.corner });
    else record.corner = b; // unsigned byte
  } else trace?.drawOps.push({ op: 'state', row: SLIDER_CORNER.ID8.id, corner: record.corner });
  const c = record.corner;
  const range = toWord(input.max - input.min), offset = toWord(input.value - input.min); // ID9
  const B = band(ax, R, record.group);
  let Th: QdRect | null = rect(0, 0, 0, 0); // TH2 when no thumb
  if (thumb) {
    const tA = record.thumbAlong!;
    let start: number | null;
    if (range === 0) start = ax.a0(R);
    else if (c === null) start = null;
    else start = ax.a0(R) + c + Math.trunc(((alongR - tA - 2 * c) * (record.horizontal ? offset : range - offset)) / range);
    if (start === null) trace?.drawOps.push({ op: 'state', row: SLIDER_CORNER.ID8.id, unspecified: 'thumb position needs c, which is undefined (§6 item 7)' });
    Th = start === null ? null : ax.mk(toWord(start), toWord(start + tA), ax.c0(B), ax.c1(B));
  }
  if (trace) {
    trace.rects.R = R; trace.rects.B = B;
    if (Th) trace.rects.Th = Th;
    trace.drawOps.push({ op: 'state', row: `${SLIDER_RECORD.ID9.id},5.1,5.2`, c, range, offset, travel: record.travel, thumbAlong: record.thumbAlong,
      source: SLIDER_THUMB_RECT.source });
  }
  return { record, input, base, gb, thumb, c, range, offset, B, Th };
}

/** Message 3 (init): gate, record, state, then ID4/ID5. Null when handed off (G2). */
export function sliderInit(chain: ResourceChain, input: SliderInput, initialValue: number, trace?: EngineTrace):
  { record: SliderRecord; value: number } | null {
  if (sliderGate(chain, input, trace) === 'G2') return null;
  const record = newSliderRecord(input, trace);
  sliderMessageState(chain, record, input, trace);
  let value = input.value;
  if (has(input.variation, SLIDER_VARIATION.tickMarks) && record.group !== 2) {
    record.ticks = initialValue; value = input.min;
    trace?.drawOps.push({ op: 'init', row: SLIDER_RECORD.ID4.id, ticks: record.ticks });
  } else {
    record.ticks = 0;
    trace?.drawOps.push({ op: 'init', row: SLIDER_RECORD.ID5.id });
  }
  return { record, value };
}

/** Run the gate then the per-message state; null when handed off (G2). */
export function sliderMessage(chain: ResourceChain, record: SliderRecord, input: SliderInput, trace?: EngineTrace): SliderState | null {
  if (sliderGate(chain, input, trace) === 'G2') return null;
  return sliderMessageState(chain, record, input, trace);
}

const inside = (r: QdRect, P: QdPoint): boolean => P.x >= r.left && P.x < r.right && P.y >= r.top && P.y < r.bottom;

/** Message 1 (test): §4.9. */
export function sliderPartAt(st: SliderState, P: QdPoint): { part: number; row: string } {
  const Th = st.Th ?? rect(0, 0, 0, 0);
  for (const row of SLIDER_HIT_TEST) {
    switch (row.test) {
      case 'outsideBand': if (!inside(st.B, P)) return { part: row.part, row: row.id }; break;
      case 'thumb': if (inside(Th, P)) return { part: row.part, row: row.id }; break;
      case 'before': if (P.x < Th.left || P.y < Th.top) return { part: row.part, row: row.id }; break;
      case 'otherwise': return { part: row.part, row: row.id };
    }
  }
  return { part: 0, row: 'HT1' };
}

/** Messages 2, 10, 11: the control region (`R`) or the thumb region (`Th`). */
export function sliderRegion(st: SliderState, message: number, highBit = false): QdRect | null {
  const thumb = message === SLIDER_MESSAGE.calcThumbRgn || (message === SLIDER_MESSAGE.calcCRgns && highBit);
  return thumb ? st.Th : st.input.rect;
}

/** Message 19 (getFeatures). */
export function sliderFeatures(variation: number): number {
  const F = SLIDER_FEATURES;
  return F.ghosting + F.bit13 + (has(variation, SLIDER_VARIATION.liveFeedback) ? F.liveFeedback : 0);
}

/** `q(x) = trunc((x · range + trunc(T / 2)) / T)` (§5.6, §5.7); null when T is 0 or undefined (§6 item 5). */
function quantise(st: SliderState, x: number): number | null {
  const T = st.record.travel;
  if (!T) return null;
  return Math.trunc((x * st.range + Math.trunc(T / 2)) / T);
}

/**
 * Message 26 (calcValueFromPos, §5.6): the value for ghost rect `G`, written
 * without pinning. Returns the current value when there is no thumb (TH2), null
 * when undefined (§6 items 5, 7).
 */
export function sliderValueFromGhost(st: SliderState, G: QdRect): number | null {
  if (!st.thumb) return st.input.value;
  if (st.c === null) return null;
  const p = st.record.horizontal ? G.left - st.B.left - st.c : st.B.bottom - st.c - G.bottom;
  const q = quantise(st, p);
  return q === null ? null : st.input.min + q;
}

/** Message 5 (posCntl, §5.7): the new value for drag offset `d` along the axis (before SetControlValue's own pinning). */
export function sliderPosCntl(st: SliderState, d: number): number | null {
  if (!st.thumb) return st.input.value; // TH2
  const q = quantise(st, Math.abs(d));
  if (q === null) return null;
  const delta = st.record.horizontal ? (d > 0 ? q : -q) : (d > 0 ? -q : q);
  return st.input.value + delta;
}

/** Message 6 (thumbCntl, §5.8): the drag constraint for press point `P`. Null with no thumb (TH2) or when undefined. */
export function sliderThumbCntl(st: SliderState, P: QdPoint): { limit: QdRect; slop: QdRect; axis: number } | null {
  const T = st.record.travel, K = SLIDER_TRACKING.thumbCntl;
  if (!st.thumb || T === null || st.range === 0) return null;
  const B = st.B;
  const slop = insetRect(B, -K.slop, -K.slop);
  if (st.record.horizontal) {
    const left = P.x - Math.trunc((T * st.offset) / st.range);
    return { limit: rect(B.top, left, B.bottom, left + T + 1), slop, axis: K.axisH };
  }
  const top = P.y - Math.trunc(((st.range - st.offset) * T) / st.range);
  return { limit: rect(top, B.left, top + T + 1, B.right), slop, axis: K.axisV };
}

export interface SliderDrawOptions {
  /** 0 draw (default), 13 drawGhost, 26 calcValueFromPos. */
  message?: number;
  /** Ghost rect `G` (messages 13 and 26). */
  ghost?: QdRect;
  /** What the erase fills R with (O3/O4; §6 item 1: a host input). */
  background: Rgba;
}

export interface SliderDrawResult {
  /** Null when the gate handed the message off (G2). */
  state: SliderState | null;
  drawn: boolean;
}

const tierRow = (hilite: number) => SLIDER_TRACK_TIER.find(r => (r.when === 'inactive' && hilite >= SLIDER_HILITE.inactiveFrom)
  || (r.when === 'pressed' && hilite >= SLIDER_HILITE.pressedFrom && hilite <= SLIDER_HILITE.pressedTo)
  || r.when === 'normal')!;
const cellRow = (hilite: number) => SLIDER_THUMB_CELL.find(r => (r.when === 'inactive' && hilite >= SLIDER_HILITE.inactiveFrom)
  || (r.when === 'thumbPressed' && hilite === SLIDER_HILITE.thumbPressed) || r.when === 'otherwise')!;

/** The §5.3 thumb source cell `cell` of `pm`. */
function thumbCell(ax: Axis, pm: Pixmap, cell: number): QdRect {
  const b = pixmapBounds(pm), n = SLIDER_THUMB.TH3.cellSize;
  return ax.mk(ax.a0(b), ax.a1(b), n * cell, n * cell + n);
}

const outsideSource = (pm: Pixmap, r: QdRect): boolean => r.left < 0 || r.top < 0 || r.right > pm.width || r.bottom > pm.height;

/**
 * Messages 0, 13 and 26: draw the slider into `port` (§3.3 O1–O9). The whole of
 * R is repainted opaque: erased to `background`, then the track, ghost, thumb and
 * ticks are drawn masked, and the result replaces R.
 */
export function drawSlider(port: Pixmap, chain: ResourceChain, record: SliderRecord, input: SliderInput,
  opts: SliderDrawOptions, trace?: EngineTrace): SliderDrawResult {
  const message = opts.message ?? SLIDER_MESSAGE.draw;
  const st = sliderMessage(chain, record, input, trace);
  if (!st) return { state: null, drawn: false };
  const R = input.rect;
  const visibleArea = rect(Math.max(R.top, 0), Math.max(R.left, 0), Math.min(R.bottom, port.height), Math.min(R.right, port.width));
  if ((message === SLIDER_MESSAGE.draw && !(input.visible ?? true)) || emptyRect(visibleArea) || !SLIDER_DECLARED_DEFAULTS.penVisible) {
    trace?.drawOps.push({ op: 'skip', row: SLIDER_DRAW_GUARD.id, reason: 'invisible, empty visible area or pen hidden' });
    return { state: st, drawn: false };
  }
  const ax = axis(record.horizontal);
  const w = R.right - R.left, h = R.bottom - R.top;
  const off: Pixmap = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  const local = (r: QdRect): QdRect => offsetRect(r, -R.left, -R.top);
  const blit = (src: Pixmap, s: QdRect, d: QdRect, row: string, op: string): void => {
    if (emptyRect(d) || emptyRect(s)) { trace?.drawOps.push({ op, row: `${row},${SLIDER_BLIT.BL9.id}`, src: s, dst: d }); return; }
    trace?.drawOps.push({ op, row: `${row},${SLIDER_BLIT.BL1.id}`, src: s, dst: d, transfer: 'copyMask',
      ...(outsideSource(src, s) ? { unspecified: 'source rect extends outside the cicn; those pixels are left untouched' } : {}) });
    transferBits(off, src, s, local(d), 'copyMask');
  };
  const thumbRow = cellRow(input.hilite);

  for (const step of SLIDER_DRAW_ORDER) {
    switch (step.id) {
      case 'O1': trace?.drawOps.push({ op: 'offscreen', row: 'O1,OS1', dst: R }); break;
      case 'O2': trace?.drawOps.push({ op: 'portColours', row: 'O2,OS3', colorPort: SLIDER_DECLARED_DEFAULTS.colorPort }); break;
      case 'O3': trace?.drawOps.push({ op: 'background', row: 'O3', rgb: { r: opts.background.r, g: opts.background.g, b: opts.background.b } }); break;
      case 'O4': {
        trace?.drawOps.push({ op: 'erase', row: 'O4,OS4', dst: R });
        const { r, g, b, a } = opts.background;
        for (let i = 0; i < w * h; i++) off.data.set([r, g, b, a], i * 4);
        break;
      }
      case 'O5': drawTrack(chain, st, ax, off, local, blit, trace); break;
      case 'O6': {
        if (message !== SLIDER_MESSAGE.drawGhost || !opts.ghost) break;
        if (!st.thumb) { trace?.drawOps.push({ op: 'ghost', row: `${step.id},${SLIDER_THUMB.TH2.id}` }); break; }
        blit(st.thumb.value.pixmap, thumbCell(ax, st.thumb.value.pixmap, SLIDER_THUMB.TH5.ghostCell), opts.ghost, `${step.id},${SLIDER_THUMB.TH5.id}`, 'ghost');
        break;
      }
      case 'O7': {
        if (!st.thumb) { trace?.drawOps.push({ op: 'thumb', row: `${step.id},${SLIDER_THUMB.TH2.id}` }); break; }
        const dst = message === SLIDER_MESSAGE.calcValueFromPos && opts.ghost ? opts.ghost : st.Th;
        if (!dst) { trace?.drawOps.push({ op: 'thumb', row: `${step.id},${SLIDER_CORNER.ID8.id}`, unspecified: 'thumb rect undefined (§6 item 7)' }); break; }
        traceOrigin(st.thumb.value, st.thumb.id, step.id, trace);
        blit(st.thumb.value.pixmap, thumbCell(ax, st.thumb.value.pixmap, thumbRow.cell), dst, `${step.id},${thumbRow.id},${SLIDER_THUMB.TH4.id}`, 'thumb');
        break;
      }
      case 'O8': drawTicks(chain, st, ax, thumbRow.cell === 0 ? 0 : 1, blit, trace); break;
      case 'O9': {
        trace?.drawOps.push({ op: 'composite', row: 'O9,OS5', src: rect(0, 0, h, w), dst: R, transfer: 'copyBits' });
        transferBits(port, off, rect(0, 0, h, w), R, 'copyBits');
        break;
      }
    }
  }
  return { state: st, drawn: true };
}

type Blit = (src: Pixmap, s: QdRect, d: QdRect, row: string, op: string) => void;

/** O5: the track (TR1–TR6) sliced into B (§4.4, §5.5). */
function drawTrack(chain: ResourceChain, st: SliderState, ax: Axis, off: Pixmap, local: (r: QdRect) => QdRect, blit: Blit, trace?: EngineTrace): void {
  const tier = tierRow(st.input.hilite);
  let found: { cicn: IconSource; cinf: SliderCinf; id: number } | null = null;
  for (const cand of SLIDER_TRACK.TR3.candidates) {
    const id = (cand.from === 'gb' ? st.gb : st.base) + (cand.tier === 'tier' ? tier.tier : cand.tier);
    const row = `O5,${tier.id},${SLIDER_TRACK.TR3.id}`;
    const cicn = chain.getResource<IconSource>('cicn', id, req(trace, row));
    if (!cicn) continue; // TR4
    const cinf = chain.getResource<SliderCinf>('cinf', id, req(trace, row));
    if (!cinf) { trace?.drawOps.push({ op: 'track', row: SLIDER_TRACK.TR4.id, id, reason: 'cicn without a cinf at the same id' }); continue; }
    const SB = SLIDER_SLICE.bytes, b = cinf.value.bytes;
    if (b[SB.cap] === undefined || b[SB.middle] === undefined || b[SB.anchor] === undefined) {
      // CF3: an undefined read; declared policy: this candidate fails (TR4).
      trace?.drawOps.push({ op: 'track', row: `${SLIDER_CINF_LENGTH.CF3.id},${SLIDER_TRACK.TR4.id}`, id,
        unspecified: 'track cinf shorter than the bytes the slicer reads; candidate treated as failed' });
      continue;
    }
    found = { cicn: cicn.value, cinf: cinf.value, id };
    break;
  }
  if (!found) { trace?.drawOps.push({ op: 'track', row: SLIDER_TRACK.TR5.id }); return; }
  traceOrigin(found.cicn, found.id, 'O5', trace);
  const pm = found.cicn.pixmap, bytes = found.cinf.bytes, SB = SLIDER_SLICE.bytes;
  const k = bytes[SB.cap]!, fullMiddle = bytes[SB.middle]!, endAnchor = bytes[SB.anchor]!;
  const S = pixmapBounds(pm), B = st.B;
  const sc = ax.c1(S) - ax.c0(S);
  const dc0 = Math.trunc((ax.c0(B) + ax.c1(B) - sc) / 2); // SL1
  const D = ax.mk(ax.a0(B), ax.a1(B), dc0, dc0 + sc);
  const L = alongLength(ax, D), Sa0 = ax.a0(S), Sa1 = ax.a1(S), Da0 = ax.a0(D), Da1 = ax.a1(D);
  const piece = (s0: number, s1: number, d0: number, d1: number): [QdRect, QdRect] =>
    [ax.mk(s0, s1, ax.c0(S), ax.c1(S)), ax.mk(d0, d1, ax.c0(D), ax.c1(D))];
  trace?.drawOps.push({ op: 'track', row: `${SLIDER_TRACK.TR6.id},${SLIDER_SLICE.SL1.id}`, id: found.id, src: S, dst: D, k, fullMiddle, endAnchor });
  if (2 * k > Sa1 - Sa0) trace?.drawOps.push({ op: 'track', row: SLIDER_SLICE.SL2.id, unspecified: '2k exceeds the source length (§6 item 6)' });
  if (L <= 2 * k) {
    const a = Math.trunc((L + 1) / 2), b = Math.trunc(L / 2);
    blit(pm, ...piece(Sa0, Sa0 + a, Da0, Da0 + a), SLIDER_SLICE.SL2.id, 'halves');
    blit(pm, ...piece(Sa1 - b, Sa1, Da1 - b, Da1), SLIDER_SLICE.SL2.id, 'halves');
    return;
  }
  blit(pm, ...piece(Sa0, Sa0 + k, Da0, Da0 + k), SLIDER_SLICE.SL3.id, 'cap');
  blit(pm, ...piece(Sa1 - k, Sa1, Da1 - k, Da1), SLIDER_SLICE.SL3.id, 'cap');
  const midRow = fullMiddle === 0 ? SLIDER_SLICE.SL4.id : SLIDER_SLICE.SL5.id;
  const [ms, md] = fullMiddle === 0 ? piece(Sa0 + k, Sa0 + k + 1, Da0 + k, Da1 - k) : piece(Sa0 + k, Sa1 - k, Da0 + k, Da1 - k);
  tiler(found.cicn, ms, md, endAnchor === 0, off, local, `${midRow},${SLIDER_SLICE.SL6.id}`, trace);
}

/** The tiler (BL4–BL7, BL9): middle source `s` into `d`. */
/**
 * BL8/BL12: where the BL4/BL5 line colours come from. The decoded colour is
 * BL8's colour when the loader found the two equal at every opaque pixel
 * (`equivalent`); otherwise the loader's sampler companion supplies BL8's
 * colours; with neither, the decoded colour is drawn and the shortcut traced.
 */
function lineColours(icon: IconSource): { pm: Pixmap; row: string; unspecified?: string } {
  const B = SLIDER_BLIT;
  if (icon.sampling === 'equivalent') return { pm: icon.pixmap, row: `${B.BL8.id},${B.BL12.id}` };
  if (icon.sampled) return { pm: icon.sampled, row: B.BL8.id };
  return { pm: icon.pixmap, row: `${B.BL8.id},${B.BL12.id}`,
    unspecified: `decoded colour used for BL8 without an equivalence record (sampling ${icon.sampling ?? 'unknown'})` };
}

/** BL11: trace a cicn whose bounds origin is not (0, 0); it is drawn at origin 0. */
function traceOrigin(icon: IconSource, id: number, row: string, trace?: EngineTrace): void {
  const o = icon.origin;
  if (o && (o.top !== 0 || o.left !== 0)) trace?.drawOps.push({ op: 'origin', row: `${row},${SLIDER_BLIT.BL11.id}`, id, origin: { top: o.top, left: o.left },
    unspecified: 'cicn bounds origin is not (0, 0): outside the declared domain; evaluated at origin 0' });
}

function tiler(icon: IconSource, s: QdRect, d: QdRect, startAnchored: boolean, off: Pixmap, local: (r: QdRect) => QdRect, row: string, trace?: EngineTrace): void {
  const pm = icon.pixmap;
  if (emptyRect(s) || emptyRect(d)) { trace?.drawOps.push({ op: 'tile', row: `${row},${SLIDER_BLIT.BL9.id}`, src: s, dst: d,
    ...(emptyRect(s) ? { note: 'empty middle source: background gap (§6 item 6)' } : {}) }); return; }
  const sw = s.right - s.left, sh = s.bottom - s.top, dw = d.right - d.left, dh = d.bottom - d.top;
  const L = local(d);
  if ((sw === 1 && dw > 1) || (sh === 1 && dh > 1)) {
    const columnSource = sw === 1 && dw > 1; // BL4, else BL5
    const colours = lineColours(icon);
    trace?.drawOps.push({ op: 'tileLines', row: `${row},${columnSource ? SLIDER_BLIT.BL4.id : SLIDER_BLIT.BL5.id},${colours.row}`, src: s, dst: d,
      ...(colours.unspecified ? { unspecified: colours.unspecified } : {}) });
    const n = columnSource ? sh : sw;
    for (let j = 0; j < n; j++) {
      if (columnSource ? L.top + j >= L.bottom : L.left + j >= L.right) break; // while inside the destination
      const sx = columnSource ? s.left : s.left + j, sy = columnSource ? s.top + j : s.top;
      const mask = getPixel(pm, sx, sy);
      if (!mask || mask.a === 0) continue; // mask bit clear: left alone
      const pen = newPen(getPixel(colours.pm, sx, sy) ?? mask);
      if (columnSource) { moveTo(pen, L.left, L.top + j); lineTo(off, pen, L.right - 1, L.top + j); }
      else { moveTo(pen, L.left + j, L.top); lineTo(off, pen, L.left + j, L.bottom - 1); }
    }
    return;
  }
  trace?.drawOps.push({ op: 'tile', row: `${row},${SLIDER_BLIT.BL6.id},${SLIDER_BLIT.BL7.id}`, src: s, dst: d, anchor: startAnchored ? 'start' : 'end',
    axis: sh !== dh ? 'vertical' : 'horizontal', transfer: 'copyMask' });
  tileBlit(off, pm, s, L, startAnchored ? 1 : 0, 'copyMask');
}

/** O8: tick marks (§4.6, §5.4). */
function drawTicks(chain: ResourceChain, st: SliderState, ax: Axis, tickState: number, blit: Blit, trace?: EngineTrace): void {
  const K = SLIDER_TICKS, n = st.record.ticks, R = st.input.rect;
  if (n < K.TK1.minCount) { trace?.drawOps.push({ op: 'ticks', row: `O8,${K.TK1.id}` }); return; }
  const off = K.TK4.offset + tickState;
  const hit = chain.probe<IconSource>('cicn', [st.gb + off, st.base + off], req(trace, `O8,${K.TK4.id}`));
  if (!hit) { trace?.drawOps.push({ op: 'ticks', row: `O8,${K.TK4.id}`, reason: 'no tick cicn' }); return; }
  if (ax.c1(R) - ax.c0(R) < K.TK3.minCross) { trace?.drawOps.push({ op: 'ticks', row: `O8,${K.TK3.id}` }); return; }
  if (st.range <= 0) { trace?.drawOps.push({ op: 'ticks', row: `O8,${K.TK2.id}` }); return; }
  const T = st.record.travel, tA = st.record.thumbAlong, c = st.c;
  if (T === null || tA === null || c === null || st.record.group === 2) {
    trace?.drawOps.push({ op: 'ticks', row: `O8,${K.TK5.id}`, unspecified: 'T, tA or c undefined, or a group without a tick band' });
    return;
  }
  traceOrigin(hit.value, hit.id, 'O8', trace);
  const t = pixmapBounds(hit.value.pixmap);
  const tw = t.right - t.left, th = t.bottom - t.top;
  const band = K.rects.bandOffset;
  for (let i = 0; i < n; i++) {
    const v = Math.trunc((i * st.range + Math.trunc((n - 1) / 2)) / (n - 1));
    let dst: QdRect;
    if (st.record.horizontal) {
      const x = R.left + c + Math.trunc((T * v) / st.range) + Math.trunc((tA - t.right - t.left) / 2);
      const top = st.record.group === 0 ? R.top + band : R.bottom - band - th;
      dst = rect(top, x, top + th, x + tw);
    } else {
      const y = R.top + c + Math.trunc((T * (st.range - v)) / st.range) + Math.trunc((tA - t.bottom - t.top) / 2);
      const left = st.record.group === 0 ? R.left + band : R.right - band - tw;
      dst = rect(y, left, y + th, left + tw);
    }
    blit(hit.value.pixmap, t, dst, `O8,${K.TK5.id}`, 'tick');
  }
}

/**
 * Every (type, id) the slider tables can request for one orientation, so an
 * asynchronous adapter can preload a synchronous ResourceChain. The gate reads
 * the orientation of the current R, the drawing the record's (§4.2 note); a
 * facade whose R does not change shape needs one orientation.
 */
export function sliderResourceIds(horizontal: boolean): { type: string; id: number }[] {
  return expandIdGrid(horizontal ? SLIDER_IDS.horizontal : SLIDER_IDS.vertical).flatMap(id => [{ type: 'cicn', id }, { type: 'cinf', id }]);
}
