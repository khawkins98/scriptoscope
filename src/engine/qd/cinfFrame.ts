// Shared cinf painter, docs/spec/engine/qd-primitives.md B/P/E/S tables.
// Face/ring drivers request cicn first; this primitive requests metadata only.
// Source: `0x107fe..0x10fbe`; wrappers `0x10fc0`, `0x107a4..0x107f6`.
import type { Pixmap, QdPoint, QdRect, Rgba } from './types.js';
import type { EngineTrace } from '../trace.js';
import type { ResourceChain } from '../resources/chain.js';
import { CINF_BODY, CINF_BODY_SKIP, CINF_BORDER_ORDER, CINF_EDGE, CINF_EMBOSS_ABSENT,
  CINF_PHASE, CINF_REQUEST, CINF_RETRY, CINF_SKIP, CINF_SAMPLE, CINF_HEADER, type CinfPhaseRow } from '../tables/cinfFrame.js';
import { emptyRect, rect, insetRect, offsetRect } from './rect.js';
import { getPixel } from './pixel.js';
import { eraseRect, fillPattern } from './pattern.js';
import { tileBlit, tileFastPathRow } from './tile.js';
import { transferBits } from './transfer.js';
import { iconBlit, insideBounds, type IconSource } from './region.js';
import { sourceLines } from './lines.js';
import { lineColourSource } from '../resources/iconSource.js';

export interface CinfRecord {
  cornerSize: number; sideThickness: number; tileSides: number; patternAnchor: number; bgPatternId: number;
  bgPixel: QdPoint; textPixel: QdPoint; embossPixel: QdPoint;
}
/** Decode the complete serialized TMPL 129 header; short reads remain unavailable. */
export function decodeCinfHeader(bytes: readonly number[]): CinfRecord | null {
  if (bytes.length < CINF_SAMPLE.headerLength) return null;
  const b = Uint8Array.from(bytes), v = new DataView(b.buffer), h = CINF_HEADER;
  return { cornerSize: b[h.corner]!, sideThickness: b[h.side]!, tileSides: b[h.tile]!, patternAnchor: b[h.mode]!,
    bgPatternId: v.getInt16(h.backgroundId), bgPixel: { x: v.getInt16(h.backgroundX), y: v.getInt16(h.backgroundY) },
    textPixel: { x: v.getInt16(h.textX), y: v.getInt16(h.textY) },
    embossPixel: { x: v.getInt16(h.embossX), y: v.getInt16(h.embossY) } };
}
export type CinfRgb16 = readonly [number, number, number];
/** Raw samples are inputs; display pixels cannot recover serialized palette values. */
export interface CinfIconSource extends IconSource {
  readonly sampleRgb16?: (point: QdPoint) => CinfRgb16 | null;
  readonly realizeRgb16?: (rgb: CinfRgb16) => Rgba;
}
export interface CinfFrameInput {
  id: number; cicn: Pixmap; dstRect: QdRect; bodyFill: boolean;
  icon?: CinfIconSource;
  /** Requires raw samples for colour outputs; absent keeps older callers' display-pixel policy. */
  requireRawSamples?: boolean;
  realize?: (rgb: CinfRgb16) => Rgba;
  /** Added to the decoded anchor; browser logical-port allocation policy. */
  patternOffset?: QdPoint;
  /** Logical port position of allocation pixel (0,0); geometry stays in allocation coordinates. */
  allocationOrigin?: QdPoint;
}
export interface CinfFrameResult {
  drawn: boolean; cinfId: number | null;
  backgroundRGB: Rgba | null; textRGB: Rgba | null; embossRGB: Rgba | null;
  backgroundRGB16?: CinfRgb16 | null; textRGB16?: CinfRgb16 | null; embossRGB16?: CinfRgb16 | null;
  /** Unknown is distinct from an absent emboss. */
  colorsAvailable?: boolean;
}

export function cinfBodyRects(D: QdRect, c: number, s: number): QdRect[] {
  const boxes = [rect(D.top + s, D.left + c, D.bottom - s, D.right - c)];
  if (c !== s) boxes.push(rect(D.top + c, D.left + s, D.bottom - c, D.right - s));
  return boxes.filter(r => !emptyRect(r));
}
export function cinfPhase(D: QdRect, mode: number): { row: CinfPhaseRow; phase: QdPoint } {
  const row = CINF_PHASE.find(r => r.mode === '*' || r.mode === mode)!;
  return { row, phase: { x: row.x === 'left' ? D.left : row.x === 'right' ? D.right : 0,
    y: row.y === 'top' ? D.top : row.y === 'bottom' ? D.bottom : 0 } };
}
const none = (): CinfFrameResult => ({ drawn: false, cinfId: null, backgroundRGB: null, textRGB: null, embossRGB: null, colorsAvailable: false });

export function drawCinfFrame(port: Pixmap, chain: ResourceChain, input: CinfFrameInput, trace?: EngineTrace): CinfFrameResult {
  const { id, cicn, dstRect: D, bodyFill } = input;
  const retry = CINF_RETRY.find(r => r.bodyFill === bodyFill)!;
  const hit = chain.probe<CinfRecord | { bytes: readonly number[] }>(CINF_REQUEST.type, [id, retry.retryId],
    { row: `${CINF_REQUEST.id},${retry.id}`, ...(trace ? { trace } : {}) });
  if (!hit) { trace?.drawOps.push({ op: 'cinfFrame', row: CINF_SKIP.id, dst: D }); return none(); }
  let cinf: CinfRecord;
  if ('bytes' in hit.value) {
    if (hit.value.bytes.length < CINF_SAMPLE.headerLength) {
      trace?.drawOps.push({ op: 'cinfFrame', row: CINF_SKIP.id, unspecified: 'short cinf header', dst: D });
      return { ...none(), cinfId: hit.id };
    }
    cinf = decodeCinfHeader(hit.value.bytes)!;
  } else cinf = hit.value;
  const c = cinf.cornerSize, s = cinf.sideThickness;
  let backgroundRGB: Rgba | null = null, textRGB: Rgba | null = null, embossRGB: Rgba | null = null;
  let backgroundRGB16: CinfRgb16 | null = null, textRGB16: CinfRgb16 | null = null, embossRGB16: CinfRgb16 | null = null;
  let colorsAvailable = false;
  if (bodyFill) {
    const raw = input.icon?.sampleRgb16;
    backgroundRGB16 = raw?.(cinf.bgPixel) ?? null;
    textRGB16 = raw?.(cinf.textPixel) ?? null;
    const absent = cinf.embossPixel.x === CINF_EMBOSS_ABSENT.x && cinf.embossPixel.y === CINF_EMBOSS_ABSENT.y;
    embossRGB16 = absent ? null : raw?.(cinf.embossPixel) ?? null;
    const display = (point: QdPoint, rgb: CinfRgb16 | null): Rgba | null => {
      const realize = input.icon?.realizeRgb16 ?? input.realize;
      if (rgb && realize) return realize(rgb);
      if (input.requireRawSamples) return null;
      const p = getPixel(cicn, point.x, point.y);
      return p ? { ...p, a: CINF_SAMPLE.opaque } : null;
    };
    backgroundRGB = display(cinf.bgPixel, backgroundRGB16); textRGB = display(cinf.textPixel, textRGB16);
    const same = embossRGB16 && backgroundRGB16 && embossRGB16.every((v, i) => v === backgroundRGB16![i]);
    const sentinel = embossRGB16?.[0] === CINF_SAMPLE.sentinel;
    embossRGB = absent || same || sentinel ? null : display(cinf.embossPixel, embossRGB16);
    const embossKnown = absent || sentinel || (embossRGB16 !== null && backgroundRGB16 !== null);
    colorsAvailable = textRGB !== null && (input.requireRawSamples
      ? textRGB16 !== null && embossKnown : absent || !!same || sentinel || embossRGB !== null);
    if (!colorsAvailable) trace?.drawOps.push({ op: 'cinfSamples', row: 'S1,S2,S4,S5', unspecified: 'raw colour output unavailable' });
    const body = CINF_BODY.find(r => r.mode === '*' || r.mode === cinf.patternAnchor)!;
    const res = chain.getResource<Pixmap | IconSource>(body.type, cinf.bgPatternId, { row: body.id, ...(trace ? { trace } : {}) });
    if (res && body.found === 'B2') {
      const icon = 'pixmap' in res.value ? res.value : { pixmap: res.value, pixelSize: null, unmasked: null };
      iconBlit(port, icon, rect(0, 0, icon.pixmap.height, icon.pixmap.width), insetRect(D, s, s), trace, 'B2');
    } else if (res) {
      const pattern = 'pixmap' in res.value ? res.value.pixmap : res.value;
      const origin = input.allocationOrigin ?? { x: 0, y: 0 };
      const { row, phase } = cinfPhase(offsetRect(D, origin.x, origin.y), cinf.patternAnchor), off = input.patternOffset;
      const shifted = { x: phase.x - origin.x + (off?.x ?? 0), y: phase.y - origin.y + (off?.y ?? 0) };
      for (const r of cinfBodyRects(D, c, s)) fillPattern(port, r, pattern, shifted, trace, `B5,${row.id}`);
    } else if (backgroundRGB) {
      for (const r of cinfBodyRects(D, c, s)) eraseRect(port, r, backgroundRGB, trace, body.absent);
    } else trace?.drawOps.push({ op: 'cinfBody', row: body.absent, dst: D, unspecified: 'background sample unavailable' });
  } else trace?.drawOps.push({ op: 'cinfBody', row: CINF_BODY_SKIP.id, dst: D });

  const W = cicn.width, H = cicn.height, cw = Math.min(c, W), ch = Math.min(c, H), sw = Math.min(s, W), sh = Math.min(s, H);
  const edge = CINF_EDGE.find(r => r.tile === (cinf.tileSides ? 'nonzero' : 'zero'))!;
  const bw = cinf.tileSides ? W - 2 * c : 1, bh = cinf.tileSides ? H - 2 * c : 1;
  const band = (piece: 'top' | 'bottom' | 'left' | 'right'): [QdRect, QdRect] => {
    switch (piece) {
      case 'top': return [rect(0, c, sh, c + bw), rect(D.top, D.left + c, D.top + sh, D.right - c)];
      case 'bottom': return [rect(H - sh, c, H, c + bw), rect(D.bottom - sh, D.left + c, D.bottom, D.right - c)];
      case 'left': return [rect(c, 0, c + bh, sw), rect(D.top + c, D.left, D.bottom - c, D.left + sw)];
      case 'right': return [rect(c, W - sw, c + bh, W), rect(D.top + c, D.right - sw, D.bottom - c, D.right)];
    }
  };
  for (const piece of CINF_BORDER_ORDER.pieces) {
    if (piece === 'TL' || piece === 'TR' || piece === 'BL' || piece === 'BR') {
      const right = piece === 'TR' || piece === 'BR', bottom = piece === 'BL' || piece === 'BR';
      const x = right ? W - cw : 0, y = bottom ? H - ch : 0;
      const dx = right ? D.right - cw : D.left, dy = bottom ? D.bottom - ch : D.top;
      const src = rect(y, x, y + ch, x + cw), dst = rect(dy, dx, dy + ch, dx + cw);
      trace?.drawOps.push({ op: 'cinfCorner', row: 'E1', piece, src, dst, transfer: 'copyMask' });
      transferBits(port, cicn, src, dst, 'copyMask');
    } else {
      const [src, dst] = band(piece);
      if (emptyRect(src) || emptyRect(dst)) continue;
      trace?.drawOps.push({ op: 'cinfEdge', row: `E2,${edge.id}`, piece, src, dst, transfer: 'copyMask' });
      const fast = tileFastPathRow(src, dst);
      if (!insideBounds(cicn, src)) trace?.drawOps.push({ op: 'cinfEdgeSample', row: 'S5', src,
        unspecified: 'source sample outside icon bounds; stored padding unavailable' });
      if (fast) {
        const icon = input.icon ?? { pixmap: cicn, pixelSize: null, unmasked: null };
        const colours = lineColourSource(icon, 'cinf E3/E4');
        if (colours.unspecified) trace?.drawOps.push({ op: 'cinfLine', row: `${fast},S2`, unspecified: colours.unspecified });
        sourceLines(port, cicn, colours.pm, src, dst, fast === 'T1');
      } else tileBlit(port, cicn, src, dst, 1, 'copyMask', trace);
    }
  }
  return { drawn: true, cinfId: hit.id, backgroundRGB, textRGB, embossRGB,
    backgroundRGB16, textRGB16, embossRGB16, colorsAvailable };
}
