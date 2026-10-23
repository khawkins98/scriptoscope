// Progress-bar family driver: the Kaleidoscope 2.3.1 progress bar CDEF 5
// (docs/spec/engine/progress.md; every address below is a CDEF 5 file offset).
// Messages implemented: 0 draw, 3 init, 18 idle (its advance; the redraw is
// the caller's), 20 setData (main CDEF 5 `0x13c..0x30e`). Messages 1, 2/10/11,
// 4, 19, 21 and 27 have no runtime caller: their rows (HIT, MSG, DATA2) stay in
// tables/progress.ts as cited data and are not driven here.
// Cited ranges: draw entry CDEF 5 `0x30e`, device pass and procedural bar
// `0x5d2..0x7f0`, Kaleidoscope art `0x35a..0x5d0`, frame `0x1fd2..0x2740`,
// fill and track slicing `0x1d7e..0x1f6a`, tiler `0x1516..0x18f4`, rect blit
// `0x18f6..0x1a4a`, pattern fill `0xf56..0x1048`, pixel colour `0x129c..0x1460`.
//
// Every literal comes from tables/progress.ts; every branch names its spec row
// in the trace. Not implemented, by declaration (progress §2 declared defaults)
// or because the spec leaves it open (§6; v2-lanes/progress/IMPL-NOTES.md):
//   - `lowDepth` and black-and-white ports (BLIT2, COL1a, PAT2), picture or
//     region recording and custom bottlenecks (BLIT7), the screen-port device
//     loop and the Window Manager port path (DRAW3, DRAW5), several devices
//     (§6 item 5): the declared defaults never reach them; they are traced;
//   - the clip culls FRAME7 and BLIT8 are pixel-neutral under the declared
//     wide-open clip; only BLIT8's empty-rect skip is modelled;
//   - the undefined cases (FB9's rect, CINF3, COL1b/COL1c, a cut tile's mask in
//     BLIT5, degenerate slices; §6 items 2, 6, 7): traced `unspecified`, drawn
//     as nothing, never guessed;
//   - PACH 130's PaintRect patch (§6 item 1) is outside this unit.
import type { Pixmap, QdRect, Rgba } from '../qd/types.js';
import type { EngineTrace } from '../trace.js';
import type { ResourceChain, ResourceHit } from '../resources/chain.js';
import type { IconSource } from '../qd/region.js';
import { emptyRect, insetRect, rect } from '../qd/rect.js';
import { transferBits } from '../qd/transfer.js';
import { tileBlit } from '../qd/tile.js';
import { fillPattern } from '../qd/pattern.js';
import { getPixel, setPixel } from '../qd/pixel.js';
import { newPen, moveTo, lineTo, type Pen } from '../qd/pen.js';
import { pixmapBounds } from '../qd/axis.js';
import { expandIdGrid } from '../resources/ids.js';
import { lineColourSource } from '../resources/iconSource.js';
import { sourceLines } from '../qd/lines.js';
import {
  PROGRESS_BLIT, PROGRESS_CHAIN, PROGRESS_CINF, PROGRESS_COL, PROGRESS_COLOURS, PROGRESS_DATA, PROGRESS_DECLARED_DEFAULTS,
  PROGRESS_DET, PROGRESS_DRAW, PROGRESS_DRAW_ORDER, PROGRESS_ERASE, PROGRESS_FALLBACK, PROGRESS_FRAME,
  PROGRESS_GATE, PROGRESS_HILITE, PROGRESS_IDLE, PROGRESS_IDS, PROGRESS_IND, PROGRESS_INSET,
  PROGRESS_MSG, PROGRESS_PAT, PROGRESS_RECT, PROGRESS_SLICE, PROGRESS_WORD, type Rgb16,
} from '../tables/progress.js';

/** Control inputs (§2). */
export interface ProgressInput {
  /** The control rect `R`, in port coordinates (RECT1 forces its height). */
  rect: QdRect;
  hilite: number;
  value: number;
  min: number;
  max: number;
  visible?: boolean;
}

/** A `cinf` resource value: its raw bytes. */
export interface ProgressCinf {
  readonly bytes: readonly number[];
}

/** The 8-byte private record (IDLE1). Survives across messages. */
export interface ProgressRecord {
  /** The `'inde'` flag byte: 0 determinate, anything else indeterminate. */
  indeterminate: number;
  /** TickCount at the last advance. */
  idleTime: number;
  /** Phase byte, 0..255. */
  phase: number;
}

export interface ProgressDrawOptions {
  /** COL4: converts a COL3 16-bit QuickDraw triple through the display policy of the decoded resources. */
  realize: (rgb: Rgb16) => Rgba;
}

export interface ProgressDrawResult {
  /** `kaleidoscope` (GATE4), `procedural` (GATE2/GATE3, §4.9) or null when nothing ran (DRAW1/DRAW2). */
  path: 'kaleidoscope' | 'procedural' | null;
  /** R after RECT1. */
  rect: QdRect;
  /** The record's phase after the draw (frame mode may reset it, IND2/IND3). */
  phase: number;
}

const toWord = (v: number): number => (v << PROGRESS_WORD.bits) >> PROGRESS_WORD.bits;
const req = (trace: EngineTrace | undefined, row: string): { trace?: EngineTrace; row: string } => ({ ...(trace ? { trace } : {}), row });
const outsideSource = (pm: Pixmap, r: QdRect): boolean => r.left < 0 || r.top < 0 || r.right > pm.width || r.bottom > pm.height;

/** RECT1/RECT2: every message forces R to 14 rows; left, right and top are the caller's. */
export function progressRect(R: QdRect, trace?: EngineTrace): QdRect {
  const forced = R.bottom - R.top === PROGRESS_RECT.RECT1.height ? R : rect(R.top, R.left, toWord(R.top + PROGRESS_RECT.RECT1.height), R.right);
  trace?.drawOps.push({ op: 'rect', row: `${PROGRESS_RECT.RECT1.id},${PROGRESS_RECT.RECT2.id},${PROGRESS_MSG.MSG2.id}`, src: R, dst: forced });
  return forced;
}

/** Message 3 (init, IDLE1): not indeterminate, idle time 0, phase 0. */
export function newProgressRecord(trace?: EngineTrace): ProgressRecord {
  trace?.drawOps.push({ op: 'record', row: PROGRESS_IDLE.IDLE1.id });
  return { indeterminate: 0, idleTime: 0, phase: 0 };
}

/** Message 20 (setData, DATA1/DATA3/IDLE4): `'inde'` sets the flag to the first data byte; no redraw. */
export function progressSetData(record: ProgressRecord, tag: string, data: readonly number[]): { result: number; row: string } {
  if (tag !== PROGRESS_DATA.tag) return { result: PROGRESS_DATA.errDataNotSupported, row: PROGRESS_DATA.DATA3.id };
  record.indeterminate = (data[0] ?? record.indeterminate) & PROGRESS_IDLE.byteMask;
  return { result: 0, row: `${PROGRESS_DATA.DATA1.id},${PROGRESS_IDLE.IDLE4.id}` };
}

/**
 * Message 18's state half (IDLE2): when indeterminate and TickCount ≥ idle time + 3
 * (unsigned), the phase advances (8-bit) and the idle time becomes TickCount.
 */
export function progressIdleAdvance(record: ProgressRecord, tickCount: number, trace?: EngineTrace): boolean {
  const I = PROGRESS_IDLE;
  const due = (tickCount >>> 0) >= ((record.idleTime + I.ticks) >>> 0);
  if (record.indeterminate === 0 || !due) return false;
  record.phase = (record.phase + 1) % I.phaseModulo;
  record.idleTime = tickCount;
  trace?.drawOps.push({ op: 'idle', row: I.IDLE2.id, phase: record.phase, idleTime: tickCount });
  return true;
}

/** A cinf request; CINF3: a cinf shorter than the bytes read is treated as missing. */
function getCinf(chain: ResourceChain, id: number, bytes: readonly number[], row: string, trace?: EngineTrace): ProgressCinf | null {
  const hit = chain.getResource<ProgressCinf>('cinf', id, req(trace, `${row},${PROGRESS_CHAIN.CHAIN2.id},${PROGRESS_CINF.CINF1.id}`));
  if (!hit) return null;
  if (bytes.some(b => hit.value.bytes[b] === undefined)) {
    trace?.drawOps.push({ op: 'cinf', row: `${row},${PROGRESS_CINF.CINF3.id}`, id, unspecified: 'cinf shorter than the bytes CINF2 reads; treated as missing' });
    return null;
  }
  return hit.value;
}

const FRAME_BYTES = [PROGRESS_FRAME.bytes.corner, PROGRESS_FRAME.bytes.side, PROGRESS_FRAME.bytes.tile];
const SLICE_BYTES = [PROGRESS_SLICE.bytes.cap, PROGRESS_SLICE.bytes.middle, PROGRESS_SLICE.bytes.anchor];

/**
 * Message 0 (draw): DRAW1/DRAW2, then one direct pass (DRAW4) of §3.3 O1–O6.
 * Draws straight into `port` with no erase (ERASE1): pixels no step covers keep
 * their prior content (ERASE2).
 */
export function drawProgress(port: Pixmap, chain: ResourceChain, record: ProgressRecord, input: ProgressInput,
  opts: ProgressDrawOptions, trace?: EngineTrace): ProgressDrawResult {
  const R = progressRect(input.rect, trace);
  const none: ProgressDrawResult = { path: null, rect: R, phase: record.phase };
  if (!(input.visible ?? true)) { trace?.drawOps.push({ op: 'skip', row: PROGRESS_DRAW.DRAW1.id }); return none; }
  const visible = rect(Math.max(R.top, 0), Math.max(R.left, 0), Math.min(R.bottom, port.height), Math.min(R.right, port.width));
  if (emptyRect(visible) || !PROGRESS_DECLARED_DEFAULTS.penVisible) {
    trace?.drawOps.push({ op: 'skip', row: PROGRESS_DRAW.DRAW2.id, reason: 'empty draw region or pen hidden' });
    return none;
  }
  trace?.drawOps.push({ op: 'pass', row: PROGRESS_DRAW.DRAW4.id, screenPort: PROGRESS_DECLARED_DEFAULTS.screenPort });
  if (trace) trace.rects.R = R;
  let path: ProgressDrawResult['path'] = null;
  for (const step of PROGRESS_DRAW_ORDER) {
    switch (step.id) {
      case 'O1': trace?.drawOps.push({ op: 'savePort', row: 'O1' }); break;
      case 'O2': trace?.drawOps.push({ op: 'normalisePort', row: `O2,${PROGRESS_COL.COL3.id}` }); break;
      case 'O3': trace?.drawOps.push({ op: 'lowDepth', row: 'O3', lowDepth: PROGRESS_DECLARED_DEFAULTS.lowDepth }); break;
      case 'O4': if (drawArt(port, chain, record, input, R, trace)) path = 'kaleidoscope'; break;
      case 'O5': if (!path) { drawProcedural(port, chain, record, input, R, opts, trace); path = 'procedural'; } break;
      case 'O6': trace?.drawOps.push({ op: 'restorePort', row: 'O6' }); break;
    }
  }
  if (trace && (R.right > port.width || R.left < 0)) trace.drawOps.push({ op: 'clip', row: PROGRESS_ERASE.ERASE3.id, note: 'pixels outside the output buffer are clipped (§6 item 4)' });
  return { path, rect: R, phase: record.phase };
}

/** O4: GATE1–GATE4 and the Kaleidoscope art (§4.3–§4.8). False when the path declines. */
function drawArt(port: Pixmap, chain: ResourceChain, record: ProgressRecord, input: ProgressInput, R: QdRect, trace?: EngineTrace): boolean {
  const G = PROGRESS_GATE;
  let inactive = false;
  let frameCinf: ProgressCinf | null = null;
  if (input.hilite === PROGRESS_HILITE.inactive || input.hilite === PROGRESS_HILITE.disabled) {
    frameCinf = getCinf(chain, G.inactiveFrame, FRAME_BYTES, G.GATE1.id, trace);
    inactive = frameCinf !== null;
    if (!inactive) trace?.drawOps.push({ op: 'gate', row: G.GATE1a.id, note: 'no inactive cinf: the whole bar draws with the active ids' });
  }
  const F = inactive ? G.inactiveFrame : G.activeFrame;
  if (!inactive) frameCinf = getCinf(chain, F, FRAME_BYTES, G.GATE2.id, trace);
  if (!frameCinf) { trace?.drawOps.push({ op: 'gate', row: G.GATE2.id, id: F }); return false; }
  // FRAME1: the frame cicn (CHAIN1, the declared chain CHAIN3), then the frame cinf again.
  const frame = chain.getResource<IconSource>('cicn', F, req(trace, `${G.GATE3.id},${PROGRESS_FRAME.FRAME1.id},${PROGRESS_CHAIN.CHAIN1.id}`));
  if (!frame) { trace?.drawOps.push({ op: 'gate', row: G.GATE3.id, id: F }); return false; }
  const cinf = getCinf(chain, F, FRAME_BYTES, PROGRESS_FRAME.FRAME1.id, trace) ?? frameCinf;
  trace?.drawOps.push({ op: 'gate', row: `${inactive ? G.GATE1.id : 'active'},${G.GATE4.id}`, id: F });
  drawFrame(port, frame.value, cinf, R, trace);

  // §5.2 inner rect (INSET1/INSET2).
  const k = cinf.bytes[PROGRESS_FRAME.bytes.corner]!, s = cinf.bytes[PROGRESS_FRAME.bytes.side]!;
  const h = k > PROGRESS_INSET.minInset ? k : PROGRESS_INSET.minInset;
  const I = wordRect(insetRect(R, h, s));
  if (trace) {
    trace.rects.I = I;
    trace.drawOps.push({ op: 'inset', row: k > PROGRESS_INSET.minInset ? PROGRESS_INSET.INSET1.id : PROGRESS_INSET.INSET2.id, k, s, dst: I });
  }
  if (record.indeterminate !== 0) { drawIndeterminate(port, chain, record, inactive, I, trace); return true; }
  // DET1: fill [I.left, x), then track [x, I.right).
  trace?.drawOps.push({ op: 'determinate', row: PROGRESS_DET.DET1.id });
  const x = split(I, input, trace);
  drawSlices(port, chain, F + PROGRESS_DET.fillOffset, rect(I.top, I.left, I.bottom, x), 'fill', trace);
  drawSlices(port, chain, F + PROGRESS_DET.trackOffset, rect(I.top, x, I.bottom, I.right), 'track', trace);
  return true;
}

const wordRect = (r: QdRect): QdRect => rect(toWord(r.top), toWord(r.left), toWord(r.bottom), toWord(r.right));

/** §5.3 split: `x = I.left + trunc(w · offset / range)`, no clamp (DET2, DET3), 32-bit product. */
function split(I: QdRect, input: ProgressInput, trace?: EngineTrace): number {
  const w = I.right - I.left;
  const raw = toWord(input.max) - toWord(input.min);
  const range = raw === 0 ? 1 : raw;
  const offset = toWord(input.value) - toWord(input.min);
  const x = toWord(I.left + Math.trunc(Math.imul(w, offset) / range));
  const rows = [PROGRESS_DET.DET1.id, ...(raw === 0 ? [PROGRESS_DET.DET2.id] : []), ...(x < I.left || x > I.right ? [PROGRESS_DET.DET3.id] : [])];
  trace?.drawOps.push({ op: 'split', row: rows.join(','), w, range, offset, x,
    ...(x > I.right ? { overflow: 'value past max: the fill runs past I.right (DET3, DECISIONS #10)' } : {}),
    ...(x < I.left ? { overflow: 'value below min: the track starts left of I.left (DET3, DECISIONS #10)' } : {}) });
  return x;
}

type Piece = [QdRect, QdRect];

/** §4.4 / §5.1: the frame pieces, D = R, in FRAME3 order; no body (FRAME8). */
function drawFrame(port: Pixmap, icon: IconSource, cinf: ProgressCinf, D: QdRect, trace?: EngineTrace): void {
  const B = PROGRESS_FRAME.bytes;
  const c = cinf.bytes[B.corner]!, s = cinf.bytes[B.side]!, tile = cinf.bytes[B.tile]!;
  const W = icon.pixmap.width, H = icon.pixmap.height;
  const cw = Math.min(c, W), ch = Math.min(c, H), sw = Math.min(s, W), sh = Math.min(s, H);
  const e = tile !== 0 ? W - c : c + 1, f = tile !== 0 ? H - c : c + 1;
  traceOrigin(icon, PROGRESS_FRAME.FRAME1.id, trace);
  trace?.drawOps.push({ op: 'frame', row: `${PROGRESS_FRAME.FRAME2.id},${PROGRESS_FRAME.FRAME3.id},${PROGRESS_FRAME.FRAME8.id},${PROGRESS_ERASE.ERASE1.id}`, c, s, tile, dst: D });
  const pieces: Record<(typeof PROGRESS_FRAME.pieces)[number], Piece> = {
    TL: [rect(0, 0, ch, cw), rect(D.top, D.left, D.top + ch, D.left + cw)],
    TR: [rect(0, W - cw, ch, W), rect(D.top, D.right - cw, D.top + ch, D.right)],
    top: [rect(0, c, sh, e), rect(D.top, D.left + c, D.top + sh, D.right - c)],
    BL: [rect(H - ch, 0, H, cw), rect(D.bottom - ch, D.left, D.bottom, D.left + cw)],
    BR: [rect(H - ch, W - cw, H, W), rect(D.bottom - ch, D.right - cw, D.bottom, D.right)],
    bottom: [rect(H - sh, c, H, e), rect(D.bottom - sh, D.left + c, D.bottom, D.right - c)],
    left: [rect(c, 0, f, sw), rect(D.top + c, D.left, D.bottom - c, D.left + sw)],
    right: [rect(c, W - sw, f, W), rect(D.top + c, D.right - sw, D.bottom - c, D.right)],
  };
  for (const piece of PROGRESS_FRAME.pieces) {
    const [src, dst] = pieces[piece];
    if (piece === 'TL' || piece === 'TR' || piece === 'BL' || piece === 'BR') blit(port, icon.pixmap, src, dst, `${PROGRESS_FRAME.FRAME4.id},${piece}`, 'frameCorner', trace);
    else tiler(port, icon, src, dst, true, `${tile !== 0 ? PROGRESS_FRAME.FRAME6.id : PROGRESS_FRAME.FRAME5.id},${piece}`, trace);
  }
  if (c * 2 > W || c * 2 > H || e > W) trace?.drawOps.push({ op: 'frame', row: PROGRESS_FRAME.FRAME3.id, unspecified: 'frame cicn smaller than its pieces (§6 item 6)' });
}

/** BLIT1 (with BLIT8's empty-rect skip): a 1:1 CopyMask. */
function blit(port: Pixmap, pm: Pixmap, s: QdRect, d: QdRect, row: string, op: string, trace?: EngineTrace): void {
  if (emptyRect(s) || emptyRect(d)) { trace?.drawOps.push({ op, row: `${row},${PROGRESS_BLIT.BLIT8.id}`, src: s, dst: d }); return; }
  trace?.drawOps.push({ op, row: `${row},${PROGRESS_BLIT.BLIT1.id}`, src: s, dst: d, transfer: 'copyMask',
    ...(outsideSource(pm, s) ? { unspecified: 'source rect extends outside the cicn; those pixels are left untouched (§6 item 6)' } : {}) });
  transferBits(port, pm, s, d, 'copyMask');
}

/** COL1: the line colours (the slider BL8/BL12 adapter policy, resources/iconSource.ts). */
const lineColours = (icon: IconSource): { pm: Pixmap; unspecified?: string } => lineColourSource(icon, PROGRESS_COL.COL1.id);

/** COL1b: trace a cicn whose bounds origin is not (0, 0); it is evaluated at origin 0. */
function traceOrigin(icon: IconSource, row: string, trace?: EngineTrace): void {
  const o = icon.origin;
  if (o && (o.top !== 0 || o.left !== 0)) trace?.drawOps.push({ op: 'origin', row: `${row},${PROGRESS_COL.COL1b.id}`, origin: { top: o.top, left: o.left },
    unspecified: 'cicn bounds origin is not (0, 0); evaluated at origin 0' });
}

/** The tiler: BLIT3/BLIT4 lines in COL1 colours, else BLIT5/BLIT6 masked tiles (forward or from the end). */
function tiler(port: Pixmap, icon: IconSource, s: QdRect, d: QdRect, forward: boolean, row: string, trace?: EngineTrace): void {
  const pm = icon.pixmap;
  if (emptyRect(s) || emptyRect(d)) { trace?.drawOps.push({ op: 'tile', row: `${row},${PROGRESS_BLIT.BLIT8.id}`, src: s, dst: d }); return; }
  const sw = s.right - s.left, sh = s.bottom - s.top, dw = d.right - d.left, dh = d.bottom - d.top;
  const outside = outsideSource(pm, s) ? { unspecified: 'source rect extends outside the cicn (§6 item 6)' } : {};
  if ((sw === 1 && dw > 1) || (sh === 1 && dh > 1)) {
    const columnSource = sw === 1 && dw > 1; // BLIT3, else BLIT4
    const colours = lineColours(icon);
    trace?.drawOps.push({ op: 'tileLines', row: `${row},${columnSource ? PROGRESS_BLIT.BLIT3.id : PROGRESS_BLIT.BLIT4.id},${PROGRESS_COL.COL1.id}`, src: s, dst: d,
      ...(colours.unspecified ? { unspecified: colours.unspecified } : {}), ...outside });
    sourceLines(port, pm, colours.pm, s, d, columnSource);
    return;
  }
  const cut = sh !== dh ? dh % sh !== 0 : dw % sw !== 0;
  trace?.drawOps.push({ op: 'tile', row: `${row},${PROGRESS_BLIT.BLIT5.id},${PROGRESS_BLIT.BLIT6.id}`, src: s, dst: d, anchor: forward ? 'start' : 'end',
    axis: sh !== dh ? 'vertical' : 'horizontal', transfer: 'copyMask', ...outside,
    ...(cut && hasClearMask(pm, s) ? { unspecified: 'cut tile whose source has mask-clear pixels: BLIT5 mask rect not decoded (§6 item 6); masked through the cut source' } : {}) });
  tileBlit(port, pm, s, d, forward ? 1 : 0, 'copyMask');
}

function hasClearMask(pm: Pixmap, s: QdRect): boolean {
  for (let y = s.top; y < s.bottom; y++) for (let x = s.left; x < s.right; x++) if ((getPixel(pm, x, y)?.a ?? 0) === 0) return true;
  return false;
}

/** §4.8 / §5.4: fill or track art `A` sliced into target `T` (SLICE1–SLICE7, DET4). */
function drawSlices(port: Pixmap, chain: ResourceChain, A: number, T: QdRect, part: 'fill' | 'track', trace?: EngineTrace): void {
  const S1 = PROGRESS_SLICE.SLICE1.id;
  const cicn: ResourceHit<IconSource> | null = chain.getResource<IconSource>('cicn', A, req(trace, `${part},${S1},${PROGRESS_CHAIN.CHAIN1.id}`));
  const cinf = cicn ? getCinf(chain, A, SLICE_BYTES, `${part},${S1}`, trace) : null;
  if (!cicn || !cinf) { trace?.drawOps.push({ op: part, row: `${S1},${PROGRESS_GATE.GATE4.id}`, id: A, reason: 'cicn or cinf missing: nothing drawn' }); return; }
  const icon = cicn.value, pm = icon.pixmap, SB = PROGRESS_SLICE.bytes;
  traceOrigin(icon, S1, trace);
  const a = cinf.bytes[SB.cap]!, fullMiddle = cinf.bytes[SB.middle]!, endAnchor = cinf.bytes[SB.anchor]!;
  const S = pixmapBounds(pm), Sh = S.bottom - S.top;
  const top = toWord(Math.trunc((T.top + T.bottom - Sh) / 2)); // SLICE2
  const Dt = top, Db = toWord(top + Sh);
  const L = toWord(T.right - T.left);
  const piece = (s0: number, s1: number, d0: number): Piece => [rect(S.top, s0, S.bottom, s1), rect(Dt, d0, Db, d0 + (s1 - s0))];
  trace?.drawOps.push({ op: part, row: `${S1},${PROGRESS_SLICE.SLICE2.id}${emptyRect(T) ? `,${PROGRESS_DET.DET4.id}` : ''}`, id: A, src: S, dst: rect(Dt, T.left, Db, T.right), a, fullMiddle, endAnchor });
  if (L <= 2 * a) {
    const p = Math.trunc((L + 1) / 2), q = Math.trunc(L / 2);
    blit(port, pm, ...piece(S.left, S.left + p, T.left), PROGRESS_SLICE.SLICE3.id, 'halves', trace);
    blit(port, pm, ...piece(S.right - q, S.right, T.right - q), PROGRESS_SLICE.SLICE3.id, 'halves', trace);
    return;
  }
  if (2 * a > S.right - S.left) trace?.drawOps.push({ op: part, row: PROGRESS_SLICE.SLICE4.id, unspecified: 'cap wider than half the art (§6 item 6)' });
  blit(port, pm, ...piece(S.left, S.left + a, T.left), PROGRESS_SLICE.SLICE4.id, 'cap', trace);
  blit(port, pm, ...piece(S.right - a, S.right, T.right - a), PROGRESS_SLICE.SLICE4.id, 'cap', trace);
  const midRow = fullMiddle === 0 ? PROGRESS_SLICE.SLICE5.id : PROGRESS_SLICE.SLICE6.id;
  const ms = fullMiddle === 0 ? rect(S.top, S.left + a, S.bottom, S.left + a + 1) : rect(S.top, S.left + a, S.bottom, S.right - a);
  if (emptyRect(ms)) trace?.drawOps.push({ op: part, row: midRow, unspecified: 'empty middle source (§6 item 6)' });
  tiler(port, icon, ms, rect(Dt, T.left + a, Db, T.right - a), endAnchor === 0, `${midRow},${PROGRESS_SLICE.SLICE7.id}`, trace);
}

/** §4.7 indeterminate content (IND1–IND7), filling all of I. */
function drawIndeterminate(port: Pixmap, chain: ResourceChain, record: ProgressRecord, inactive: boolean, I: QdRect, trace?: EngineTrace): void {
  const N = PROGRESS_IND, row = (id: string) => `${id},${PROGRESS_CHAIN.CHAIN2.id}`;
  const Fp = inactive ? N.inactivePattern : N.activePattern;
  trace?.drawOps.push({ op: 'indeterminate', row: N.IND7.id, patternBase: Fp });
  const probe = chain.getResource<Pixmap>('ppat', Fp + N.probeOffset, req(trace, row(N.IND1.id))); // released at once
  let pattern: Pixmap | null = null;
  let phaseX = I.left, rows: string;
  if (probe) {
    if (record.phase < N.frames) {
      pattern = chain.getResource<Pixmap>('ppat', Fp + record.phase, req(trace, row(N.IND2.id)))?.value ?? null;
      rows = N.IND2.id;
      if (!pattern) { record.phase = 0; pattern = chain.getResource<Pixmap>('ppat', Fp, req(trace, row(N.IND2.id)))?.value ?? null; }
    } else {
      record.phase = 0;
      rows = N.IND3.id;
      pattern = chain.getResource<Pixmap>('ppat', Fp, req(trace, row(N.IND3.id)))?.value ?? null;
    }
    rows += `,${N.IND4.id}`;
  } else {
    pattern = chain.getResource<Pixmap>('ppat', Fp, req(trace, row(N.IND5.id)))?.value ?? null;
    phaseX = toWord(I.left + N.shiftStep * record.phase);
    rows = N.IND5.id;
  }
  if (!pattern) { trace?.drawOps.push({ op: 'indeterminate', row: `${rows},${N.IND6.id},${PROGRESS_ERASE.ERASE2.id}`, phase: record.phase, dst: I }); return; }
  patternFill(port, I, pattern, phaseX, I.top, rows, trace, record.phase);
}

/** §5.5 PAT1/PAT3 (ERASE4: opaque): port pixel (X, Y) shows pattern pixel ((X − px) mod pw, (Y − py) mod ph). */
function patternFill(port: Pixmap, P: QdRect, pattern: Pixmap, px: number, py: number, rows: string, trace: EngineTrace | undefined, phase: number): void {
  trace?.drawOps.push({ op: 'pattern', row: `${rows},${PROGRESS_PAT.PAT1.id},${PROGRESS_PAT.PAT3.id},${PROGRESS_ERASE.ERASE4.id}`, dst: P,
    phase: { x: px, y: py }, phaseByte: phase, pattern: { width: pattern.width, height: pattern.height } });
  fillPattern(port, P, pattern, { x: px, y: py });
}

/** COL1/COL2: a cicn pixel's colour, mask ignored. */
function sampleColour(icon: IconSource, at: { x: number; y: number }, row: string, trace?: EngineTrace): Rgba | null {
  const colours = lineColours(icon);
  const c = getPixel(colours.pm, at.x, at.y);
  const notes: string[] = [];
  if (colours.unspecified) notes.push(colours.unspecified);
  if (icon.pixelSize != null && PROGRESS_COL.COL1c.directDepths.includes(icon.pixelSize)) notes.push('16- or 32-bit pixel map: colour undefined (COL1c)');
  let out: Rgba | null = c ? { r: c.r, g: c.g, b: c.b, a: 255 } : null;
  if (c && c.a === 0 && colours.pm !== icon.pixmap) {
    // COL2 on a mask-clear pixel: the sampler companion holds opaque pixels only; use the decoded colour.
    const d = getPixel(icon.pixmap, at.x, at.y)!;
    out = { r: d.r, g: d.g, b: d.b, a: 255 };
    notes.push('mask-clear sample: decoded colour used (COL2)');
  }
  if (!c) notes.push('sample point outside the cicn: no range check, undefined (COL1b); the foreground is unchanged');
  trace?.drawOps.push({ op: 'sample', row: `${row},${PROGRESS_COL.COL1.id},${PROGRESS_COL.COL2.id}`, at: { x: at.x, y: at.y },
    ...(out ? { rgb: { r: out.r, g: out.g, b: out.b } } : {}), ...(notes.length ? { unspecified: notes.join('; ') } : {}) });
  return out;
}

function line(port: Pixmap, pen: Pen, x0: number, y0: number, x1: number, y1: number): void {
  moveTo(pen, x0, y0);
  lineTo(port, pen, x1, y1);
}

/** PaintRect in `fore` (ERASE4: opaque). */
function paintRect(port: Pixmap, r: QdRect, fore: Rgba): void {
  for (let y = r.top; y < r.bottom; y++) for (let x = r.left; x < r.right; x++) setPixel(port, x, y, fore.r, fore.g, fore.b, 255);
}

/** O5: the procedural bar (§4.9 FB1–FB10). Hilite is never read (FB10). */
function drawProcedural(port: Pixmap, chain: ResourceChain, record: ProgressRecord, input: ProgressInput, R: QdRect,
  opts: ProgressDrawOptions, trace?: EngineTrace): void {
  const P = PROGRESS_FALLBACK, C = PROGRESS_COLOURS;
  trace?.drawOps.push({ op: 'procedural', row: P.FB10.id });
  const pen = newPen(opts.realize(C.black)); // O2
  const icon = chain.getResource<IconSource>('cicn', P.cicn, req(trace, `${P.FB1.id},${PROGRESS_CHAIN.CHAIN1.id},${PROGRESS_CHAIN.CHAIN3.id}`));
  if (icon) {
    pen.fore = sampleColour(icon.value, P.samples.bottomRight, P.FB1.id, trace) ?? pen.fore;
    trace?.drawOps.push({ op: 'bevel', row: P.FB1.id, rgb: { r: pen.fore.r, g: pen.fore.g, b: pen.fore.b } });
    line(port, pen, R.left + 1, R.bottom - 1, R.right - 1, R.bottom - 1);
    line(port, pen, R.right - 1, R.top + 1, R.right - 1, R.bottom - 1);
    pen.fore = sampleColour(icon.value, P.samples.topLeft, P.FB2.id, trace) ?? pen.fore;
    trace?.drawOps.push({ op: 'bevel', row: P.FB2.id, rgb: { r: pen.fore.r, g: pen.fore.g, b: pen.fore.b } });
    line(port, pen, R.left, R.top, R.left, R.bottom - 2);
    line(port, pen, R.left, R.top, R.right - 2, R.top);
    pen.fore = sampleColour(icon.value, P.samples.frame, P.FB3.id, trace) ?? pen.fore;
  } else trace?.drawOps.push({ op: 'bevel', row: P.FB4.id });
  // FB5: FrameRect of R inset by 1 in the current foreground.
  const fr = insetRect(R, P.frameInset, P.frameInset);
  trace?.drawOps.push({ op: 'frameRect', row: P.FB5.id, dst: fr, rgb: { r: pen.fore.r, g: pen.fore.g, b: pen.fore.b } });
  if (!emptyRect(fr)) {
    line(port, pen, fr.left, fr.top, fr.right - 1, fr.top);
    line(port, pen, fr.left, fr.bottom - 1, fr.right - 1, fr.bottom - 1);
    line(port, pen, fr.left, fr.top, fr.left, fr.bottom - 1);
    line(port, pen, fr.right - 1, fr.top, fr.right - 1, fr.bottom - 1);
  }
  const If = insetRect(R, P.innerInset, P.innerInset); // FB6
  if (trace) { trace.rects.I_f = If; trace.drawOps.push({ op: 'inset', row: P.FB6.id, dst: If }); }
  if (record.indeterminate === 0) {
    const x = split(If, input, trace);
    const dark = opts.realize(C.darkGrey), lavender = opts.realize(C.lavender);
    const filled = rect(If.top, If.left, If.bottom, x), empty = rect(If.top, x, If.bottom, If.right);
    trace?.drawOps.push({ op: 'paintRect', row: `${P.FB7.id},${PROGRESS_COL.COL3.id},${PROGRESS_COL.COL4.id},${PROGRESS_ERASE.ERASE4.id}`, dst: filled, rgb: { r: dark.r, g: dark.g, b: dark.b } });
    paintRect(port, filled, dark);
    trace?.drawOps.push({ op: 'paintRect', row: `${P.FB7.id},${PROGRESS_COL.COL3.id},${PROGRESS_COL.COL4.id},${PROGRESS_ERASE.ERASE4.id}`, dst: empty, rgb: { r: lavender.r, g: lavender.g, b: lavender.b } });
    paintRect(port, empty, lavender);
    return;
  }
  const pat = chain.getResource<Pixmap>('ppat', P.ppat, req(trace, `${P.FB8.id},${PROGRESS_CHAIN.CHAIN2.id},${PROGRESS_CHAIN.CHAIN3.id}`));
  if (pat) { patternFill(port, If, pat.value, toWord(If.left + PROGRESS_IND.shiftStep * record.phase), If.top, P.FB8.id, trace, record.phase); return; }
  trace?.drawOps.push({ op: 'paintRect', row: `${P.FB9.id},${PROGRESS_CHAIN.CHAIN3.id}`, dst: If,
    unspecified: 'FB9 paints lavender into a rect the routine never sets (§6 item 2): declared policy, nothing drawn in I_f',
    divergence: 'control-panel ppat −10064 not shipped (DECISIONS #5, CHAIN3)' });
}

/**
 * Every (type, id) the progress tables can request, so an asynchronous adapter
 * can preload a synchronous ResourceChain.
 */
export function progressResourceIds(): { type: string; id: number }[] {
  const art = expandIdGrid(PROGRESS_IDS.art).flatMap(id => [{ type: 'cicn', id }, { type: 'cinf', id }]);
  const patterns = expandIdGrid(PROGRESS_IDS.patterns).map(id => ({ type: 'ppat', id }));
  return [...art, ...patterns, { type: 'cicn', id: PROGRESS_FALLBACK.cicn }, { type: 'ppat', id: PROGRESS_FALLBACK.ppat }];
}
