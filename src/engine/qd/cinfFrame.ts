// cinf body + border engine (docs/spec/engine/qd-primitives.md `qd.cinfFrame`:
// §2 inputs, §3 requests / draw order / samples, §4 tables B, P and "Border
// bands", §5 body inset rects). Cited range `0x107fe..0x10f82`; wrappers face
// `0x10fc0` (bodyFill true) and ring `0x107de` (bodyFill false).
//
// Rows are selected from tables/cinfFrame.ts. What the spec leaves open is not
// guessed; it is traced as `unimplemented` and drawn as nothing:
//   B2  mode-5 icon body: the destination inset is unreconciled (§6 Q6).
//   E4  tile != 0 edge repeat: the direction byte passed to the tile blit is
//       not stated (spec question L4-Q2).
// Band rect geometry (which source and destination rects a corner block and
// an edge band occupy) is this module's reading of E1–E3 and is spec question
// L4-Q1: corners are the c × c blocks at the cicn's and D's four corners;
// edge bands are s thick, run between the corner blocks (`[c, extent − c)`
// along the band), and sit flush with the matching outer edge.
//
// The cicn is supplied by the caller (the face / ring wrappers own its
// request; its order relative to the cinf request is not in this unit).
import type { Pixmap, QdPoint, QdRect, Rgba } from './types.js';
import type { EngineTrace } from '../trace.js';
import type { ResourceChain } from '../resources/chain.js';
import {
  CINF_BODY, CINF_BODY_SKIP, CINF_BODY_SOURCES, CINF_BORDER_ORDER, CINF_EDGE, CINF_EMBOSS_ABSENT,
  CINF_PHASE, CINF_REQUEST, CINF_RETRY, CINF_SKIP, type CinfPhaseRow,
} from '../tables/cinfFrame.js';
import { emptyRect, rect } from './rect.js';
import { getPixel } from './pixel.js';
import { eraseRect, fillPattern } from './pattern.js';
import { tileBlit, transferForPort } from './tile.js';
import { transferBits } from './transfer.js';

/** The decoded cinf header (field names as tools/theme-loader/decoders/cinf.js). */
export interface CinfRecord {
  cornerSize: number;
  sideThickness: number;
  tileSides: number;
  patternAnchor: number;
  bgPatternId: number;
  bgPixel: QdPoint;
  textPixel: QdPoint;
  embossPixel: QdPoint;
}

export interface CinfFrameInput {
  /** Resource id used for the cinf (and, by the caller, the cicn). */
  id: number;
  /** The id's cicn: border source and sample source. */
  cicn: Pixmap;
  /** The face rect `D`. */
  dstRect: QdRect;
  /** True from the face wrapper, false from the ring wrapper. */
  bodyFill: boolean;
}

export interface CinfFrameResult {
  /** False when both cinf requests returned NULL (stage skipped). */
  drawn: boolean;
  /** The cinf id that was found, or null. */
  cinfId: number | null;
  backgroundRGB: Rgba | null;
  textRGB: Rgba | null;
  embossRGB: Rgba | null;
}

/** Body inset rects R1, R2 (§5), absolute; R2 omitted when c == s. Empty rects dropped. */
export function cinfBodyRects(D: QdRect, c: number, s: number): QdRect[] {
  const W = D.right - D.left, H = D.bottom - D.top;
  const box = (x: number, y: number, w: number, h: number): QdRect => rect(D.top + y, D.left + x, D.top + y + h, D.left + x + w);
  const out = [box(c, s, W - 2 * c, H - 2 * s)];
  if (c !== s) out.push(box(s, c, W - 2 * s, H - 2 * c));
  return out.filter(r => !emptyRect(r));
}

/** The table-P phase point for a body mode. */
export function cinfPhase(D: QdRect, mode: number): { row: CinfPhaseRow; phase: QdPoint } {
  const row = CINF_PHASE.find(r => r.mode === '*' || r.mode === mode)!;
  const x = row.x === 'left' ? D.left : row.x === 'right' ? D.right : 0;
  const y = row.y === 'top' ? D.top : row.y === 'bottom' ? D.bottom : 0;
  return { row, phase: { x, y } };
}

const opaque = (p: Rgba | null): Rgba | null => (p ? { r: p.r, g: p.g, b: p.b, a: 255 } : null);

export function drawCinfFrame(port: Pixmap, chain: ResourceChain, input: CinfFrameInput, trace?: EngineTrace): CinfFrameResult {
  const { id, cicn, dstRect: D, bodyFill } = input;
  const retry = CINF_RETRY.find(r => r.bodyFill === bodyFill)!;
  const hit = chain.probe<CinfRecord>(CINF_REQUEST.type, [id, retry.retryId], { row: `${CINF_REQUEST.id},${retry.id}`, ...(trace ? { trace } : {}) });
  if (!hit) {
    trace?.drawOps.push({ op: 'cinfFrame', row: CINF_SKIP.id, dst: D });
    return { drawn: false, cinfId: null, backgroundRGB: null, textRGB: null, embossRGB: null };
  }
  const cinf = hit.value;
  const c = cinf.cornerSize, s = cinf.sideThickness;

  // Samples (§3 "Sampled colours"): background, then text and emboss.
  const backgroundRGB = opaque(getPixel(cicn, cinf.bgPixel.x, cinf.bgPixel.y));
  const textRGB = opaque(getPixel(cicn, cinf.textPixel.x, cinf.textPixel.y));
  const embossAbsent = cinf.embossPixel.x === CINF_EMBOSS_ABSENT.x && cinf.embossPixel.y === CINF_EMBOSS_ABSENT.y;
  const embossRGB = embossAbsent ? null : opaque(getPixel(cicn, cinf.embossPixel.x, cinf.embossPixel.y));

  // Body (table B).
  if (!bodyFill) {
    trace?.drawOps.push({ op: 'cinfBody', row: CINF_BODY_SKIP.id, dst: D });
  } else {
    const body = CINF_BODY.find(r => r.mode === '*' || r.mode === cinf.patternAnchor)!;
    const res = chain.getResource<Pixmap>(body.type, cinf.bgPatternId, { row: body.id, ...(trace ? { trace } : {}) });
    const rects = cinfBodyRects(D, c, s);
    if (res && body.found === 'B2') {
      trace?.drawOps.push({ op: 'cinfBody', row: 'B2', dst: D, unimplemented: 'mode-5 icon body inset unreconciled (qd-primitives §6 Q6)', source: CINF_BODY_SOURCES.B2 });
    } else if (res) {
      const { row, phase } = cinfPhase(D, cinf.patternAnchor);
      for (const r of rects) fillPattern(port, r, res.value, phase, trace, `B5,${row.id}`);
    } else if (backgroundRGB) {
      for (const r of rects) eraseRect(port, r, backgroundRGB, trace, body.absent);
    } else {
      trace?.drawOps.push({ op: 'cinfBody', row: body.absent, dst: D, unspecified: 'background sample outside the cicn' });
    }
  }

  // Border (E1–E4), in the §3 order. Masked pixels preserve earlier ones (E2).
  const transfer = transferForPort({ customBottlenecks: false });
  const sw = cicn.width, sh = cicn.height;
  const edge = CINF_EDGE.find(r => r.tile === (cinf.tileSides !== 0 ? 'nonzero' : 'zero'))!;
  const corner = (sl: number, st: number, dl: number, dt: number): [QdRect, QdRect] =>
    [rect(st, sl, st + c, sl + c), rect(dt, dl, dt + c, dl + c)];
  // Edge bands: [src, dst, horizontal]. The E3 source is the first middle column/row.
  const band = (piece: 'top' | 'bottom' | 'left' | 'right'): [QdRect, QdRect, boolean] => {
    switch (piece) {
      case 'top': return [rect(0, c, s, sw - c), rect(D.top, D.left + c, D.top + s, D.right - c), true];
      case 'bottom': return [rect(sh - s, c, sh, sw - c), rect(D.bottom - s, D.left + c, D.bottom, D.right - c), true];
      case 'left': return [rect(c, 0, sh - c, s), rect(D.top + c, D.left, D.bottom - c, D.left + s), false];
      case 'right': return [rect(c, sw - s, sh - c, sw), rect(D.top + c, D.right - s, D.bottom - c, D.right), false];
    }
  };
  for (const piece of CINF_BORDER_ORDER.pieces) {
    if (piece === 'TL' || piece === 'TR' || piece === 'BL' || piece === 'BR') {
      const right = piece === 'TR' || piece === 'BR', bottom = piece === 'BL' || piece === 'BR';
      const [src, dst] = corner(right ? sw - c : 0, bottom ? sh - c : 0, right ? D.right - c : D.left, bottom ? D.bottom - c : D.top);
      trace?.drawOps.push({ op: 'cinfCorner', row: 'E1', piece, src, dst, transfer });
      transferBits(port, cicn, src, dst, transfer);
      continue;
    }
    const [full, dst, horizontal] = band(piece);
    if (edge.id === 'E4') {
      trace?.drawOps.push({ op: 'cinfEdge', row: 'E4', piece, src: full, dst, unimplemented: 'tile-blit direction for cinf edges not stated (L4-Q2)' });
      continue;
    }
    const src = horizontal ? rect(full.top, full.left, full.bottom, full.left + 1) : rect(full.top, full.left, full.top + 1, full.right);
    trace?.drawOps.push({ op: 'cinfEdge', row: 'E2,E3', piece, src, dst, transfer });
    // A 1-px source along the run is direction-neutral (qd-primitives §6 corpus note).
    tileBlit(port, cicn, src, dst, 1, transfer);
  }
  return { drawn: true, cinfId: hit.id, backgroundRGB, textRGB, embossRGB };
}
