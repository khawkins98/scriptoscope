// Shared cinf painter, docs/spec/engine/qd-primitives.md B/P/E/S tables.
// Face/ring drivers request cicn first; this primitive requests metadata only.
// Source: `0x107fe..0x10fbe`; wrappers `0x10fc0`, `0x107a4..0x107f6`.
import type { Pixmap, QdPoint, QdRect, Rgba } from './types.js';
import type { ControlBandPaint, ControlResolutionStep } from '../../controlDiagnostics.js';
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
/** Shared metadata admission for preparation and the synchronous painter. */
function admitCinf(value: unknown): CinfRecord | string {
  if (!value || typeof value !== 'object') return 'malformed cinf metadata';
  if ('status' in value && value.status === 'unknown')
    return ('reason' in value && typeof value.reason === 'string' && value.reason
      ? value.reason : 'cinf metadata unknown');
  let cinf: CinfRecord;
  if ('bytes' in value) {
    const bytes = value.bytes;
    if (!(Array.isArray(bytes) || bytes instanceof Uint8Array)
      || !Array.from(bytes).every((b, i) => Object.hasOwn(bytes, i)
        && Number.isInteger(b) && b >= 0 && b <= CINF_SAMPLE.opaque))
      return 'malformed cinf bytes';
    if (bytes.length < CINF_SAMPLE.headerLength) return 'short cinf header';
    cinf = decodeCinfHeader(Array.from(bytes))!;
  } else {
    const record = value as Partial<CinfRecord>;
    const point = (p: QdPoint | undefined): boolean => !!p && Number.isInteger(p.x) && Number.isInteger(p.y);
    if (![record.cornerSize, record.sideThickness, record.tileSides, record.patternAnchor, record.bgPatternId].every(Number.isInteger)
      || !point(record.bgPixel) || !point(record.textPixel) || !point(record.embossPixel))
      return 'malformed cinf metadata';
    cinf = record as CinfRecord;
  }
  return cinf;
}

export type CinfRgb16 = readonly [number, number, number];
/** Raw samples are inputs; display pixels cannot recover serialized palette values. */
export interface CinfIconSource extends IconSource {
  readonly status?: never;
  /** Opt-in identity of the prepared line-colour companion actually loaded. */
  readonly sampledSource?: ControlBandPaint['derived'];
  /** Public facade dependency; absent on ordinary synchronous engine inputs. */
  readonly prepareSampled?: () => Promise<void>;
  readonly sampleRgb16?: (point: QdPoint) => CinfRgb16 | null;
  readonly realizeRgb16?: (rgb: CinfRgb16) => Rgba;
}
/** Adapter diagnostic: a non-NULL resource whose decoded pixels are unavailable. */
export interface CinfUnknownIconSource {
  readonly status: 'unknown';
  readonly reason?: string;
  readonly pixmap?: never;
}
export interface CinfFrameInput {
  id: number; cicn: Pixmap | undefined; dstRect: QdRect; bodyFill: boolean;
  icon?: CinfIconSource | CinfUnknownIconSource;
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
  unsupported?: string;
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

/** Count the completed operation's visible write coverage, never the final raster. */
function bodyWriteCount(port: Pixmap, boxes: readonly QdRect[], clip?: QdRect,
  mask?: { pixmap: Pixmap; destination: QdRect }): number {
  let count = 0;
  for (const [index, r] of boxes.entries()) {
    for (let y = Math.max(0, r.top, clip?.top ?? 0); y < Math.min(port.height, r.bottom, clip?.bottom ?? port.height); y++) {
      for (let x = Math.max(0, r.left, clip?.left ?? 0); x < Math.min(port.width, r.right, clip?.right ?? port.width); x++) {
        if (boxes.some((earlier, i) => i < index && x >= earlier.left && x < earlier.right
          && y >= earlier.top && y < earlier.bottom)) continue;
        if (mask && !getPixel(mask.pixmap, x - mask.destination.left, y - mask.destination.top)?.a) continue;
        count++;
      }
    }
  }
  return count;
}

export interface CinfBorderPiece {
  piece: typeof CINF_BORDER_ORDER.pieces[number]; src: QdRect; dst: QdRect; fast: 'T1' | 'T2' | null;
  extents: readonly [sourceWidth: number, sourceHeight: number, destinationWidth: number, destinationHeight: number];
}
/** Shared geometry; scalar extents retain bevel arithmetic independently of engine Rects. */
export function cinfBorderPlan(cicn: Pick<Pixmap, 'width' | 'height'>,
  cinf: { cornerSize: number; sideThickness: number; tileSides: number | boolean }, D: QdRect): CinfBorderPiece[] {
  const c = cinf.cornerSize, s = cinf.sideThickness;
  const W = cicn.width, H = cicn.height, cw = Math.min(c, W), ch = Math.min(c, H), sw = Math.min(s, W), sh = Math.min(s, H);
  const bw = cinf.tileSides ? W - 2 * c : 1, bh = cinf.tileSides ? H - 2 * c : 1;
  const scalarW = cinf.tileSides ? Math.max(0, W - c * 2) : c < W ? 1 : 0;
  const scalarH = cinf.tileSides ? Math.max(0, H - c * 2) : c < H ? 1 : 0;
  const band = (piece: 'top' | 'bottom' | 'left' | 'right'): [QdRect, QdRect] => {
    switch (piece) {
      case 'top': return [rect(0, c, sh, c + bw), rect(D.top, D.left + c, D.top + sh, D.right - c)];
      case 'bottom': return [rect(H - sh, c, H, c + bw), rect(D.bottom - sh, D.left + c, D.bottom, D.right - c)];
      case 'left': return [rect(c, 0, c + bh, sw), rect(D.top + c, D.left, D.bottom - c, D.left + sw)];
      case 'right': return [rect(c, W - sw, c + bh, W), rect(D.top + c, D.right - sw, D.bottom - c, D.right)];
    }
  };
  return CINF_BORDER_ORDER.pieces.map((piece): CinfBorderPiece => {
    if (piece === 'TL' || piece === 'TR' || piece === 'BL' || piece === 'BR') {
      const right = piece === 'TR' || piece === 'BR', bottom = piece === 'BL' || piece === 'BR';
      const x = right ? W - cw : 0, y = bottom ? H - ch : 0;
      const dx = right ? D.right - cw : D.left, dy = bottom ? D.bottom - ch : D.top;
      return { piece, src: rect(y, x, y + ch, x + cw), dst: rect(dy, dx, dy + ch, dx + cw), fast: null,
        extents: [cw, ch, cw, ch] };
    }
    const [src, dst] = band(piece);
    const extents: CinfBorderPiece['extents'] = piece === 'top' || piece === 'bottom'
      ? [scalarW, sh, (D.right - D.left) - c * 2, sh] : [sw, scalarH, sw, (D.bottom - D.top) - c * 2];
    return { piece, src, dst, fast: tileFastPathRow(src, dst), extents };
  });
}

function bandVisible(port: Pick<Pixmap, 'width' | 'height'>, cicn: Pixmap, src: QdRect, dst: QdRect,
  branch: ControlBandPaint['branch'], clip?: QdRect): boolean {
  if (emptyRect(src) || emptyRect(dst) || !insideBounds(cicn, src)) return false;
  for (let y = Math.max(0, dst.top, clip?.top ?? 0); y < Math.min(port.height, dst.bottom, clip?.bottom ?? port.height); y++) {
    for (let x = Math.max(0, dst.left, clip?.left ?? 0); x < Math.min(port.width, dst.right, clip?.right ?? port.width); x++) {
      if (branch === 'horizontal-lines' && y - dst.top >= src.bottom - src.top
        || branch === 'vertical-lines' && x - dst.left >= src.right - src.left) continue;
      const sx = src.left + (branch === 'horizontal-lines' ? 0 : (x - dst.left) % (src.right - src.left));
      const sy = src.top + (branch === 'vertical-lines' ? 0 : (y - dst.top) % (src.bottom - src.top));
      if (getPixel(cicn, sx, sy)?.a) return true;
    }
  }
  return false;
}

/** Public preparation policy only: resolve actual art/metadata without publishing requests. */
export async function prepareCinfFrameSamples(chain: ResourceChain, id: number, bodyFill: boolean, dst: QdRect,
  port: Pick<Pixmap, 'width' | 'height'>, clip?: QdRect, declared?: CinfRecord | null): Promise<void> {
  const icon = chain.getResource<CinfIconSource | CinfUnknownIconSource>('cicn', id)?.value;
  if (!icon || icon.status === 'unknown' || !icon.prepareSampled) return;
  const retry = CINF_RETRY.find(r => r.bodyFill === bodyFill)!;
  const value = declared !== undefined ? declared : chain.probe<unknown>(CINF_REQUEST.type, [id, retry.retryId])?.value;
  const cinf = admitCinf(value);
  if (typeof cinf === 'string') return;
  for (const { src, dst: destination, fast } of cinfBorderPlan(icon.pixmap, cinf, dst)) {
    if (fast && bandVisible(port, icon.pixmap, src, destination, fast === 'T1' ? 'horizontal-lines' : 'vertical-lines', clip)) {
      await icon.prepareSampled();
      return;
    }
  }
}

export function drawCinfFrame(port: Pixmap, chain: ResourceChain, input: CinfFrameInput, trace?: EngineTrace): CinfFrameResult {
  const { id, cicn, dstRect: D, bodyFill } = input;
  const icon = input.icon;
  // Captured before metadata/body requests: this is the actual art admission.
  const art = trace?.controlPaint ? trace.resolved.at(-1)?.selection : undefined;
  // Diagnostic propagation only; UNKNOWN is not a native NULL or a painting rule.
  if (icon?.status === 'unknown' || !cicn) {
    const unsupported = icon?.status === 'unknown' ? icon.reason || 'cicn resource unknown' : 'cicn pixmap unavailable';
    trace?.drawOps.push({ op: 'cinfFrame', dst: D, status: 'unknown', unsupported });
    return { ...none(), unsupported };
  }
  const retry = CINF_RETRY.find(r => r.bodyFill === bodyFill)!;
  const hit = chain.probe<unknown>(CINF_REQUEST.type, [id, retry.retryId],
    { row: `${CINF_REQUEST.id},${retry.id}`, ...(trace ? { trace } : {}) });
  if (!hit) { trace?.drawOps.push({ op: 'cinfFrame', row: CINF_SKIP.id, dst: D }); return none(); }
  // Modern admission policy: a present but unusable record is not a native
  // NULL. Stop without retrying metadata or claiming a completed paint stage.
  const unsupported = (reason: string): CinfFrameResult => {
    trace?.drawOps.push({ op: 'cinfFrame', dst: D, status: 'unknown', cinfId: hit.id,
      provider: hit.provider.name, unsupported: reason });
    return { ...none(), cinfId: hit.id, unsupported: reason };
  };
  const admitted = admitCinf(hit.value);
  if (typeof admitted === 'string') return unsupported(admitted);
  const cinf = admitted;
  const consumedCinf = trace?.controlPaint ? hit.provider.selection?.('cinf', hit.id)?.cinfLookup : undefined;
  const artResource = art?.resource && { ...art.resource, ...(consumedCinf ? { consumedCinf } : {}) };
  const c = cinf.cornerSize, s = cinf.sideThickness;
  let backgroundRGB: Rgba | null = null, textRGB: Rgba | null = null, embossRGB: Rgba | null = null;
  let backgroundRGB16: CinfRgb16 | null = null, textRGB16: CinfRgb16 | null = null, embossRGB16: CinfRgb16 | null = null;
  let colorsAvailable = false;
  if (bodyFill) {
    const raw = icon?.sampleRgb16;
    backgroundRGB16 = raw?.(cinf.bgPixel) ?? null;
    textRGB16 = raw?.(cinf.textPixel) ?? null;
    const absent = cinf.embossPixel.x === CINF_EMBOSS_ABSENT.x && cinf.embossPixel.y === CINF_EMBOSS_ABSENT.y;
    embossRGB16 = absent ? null : raw?.(cinf.embossPixel) ?? null;
    const display = (point: QdPoint, rgb: CinfRgb16 | null): Rgba | null => {
      const realize = icon?.realizeRgb16 ?? input.realize;
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
    const request = { row: body.id, ...(trace ? { trace } : {}) };
    const res = chain.bodyProvider
      ? chain.get1Resource<Pixmap | IconSource>(body.type, cinf.bgPatternId, chain.bodyProvider, request)
      : chain.getResource<Pixmap | IconSource>(body.type, cinf.bgPatternId, request);
    if (res && 'status' in res.value && res.value.status === 'unknown')
      return unsupported('reason' in res.value && typeof res.value.reason === 'string' && res.value.reason
        ? res.value.reason : 'cinf body resource unknown');
    let patternPhase: QdPoint | undefined;
    const clippedBody = !!chain.bodyProvider && res && 'status' in res.value && res.value.status === 'clipped';
    if (clippedBody) {
      // Public allocation policy: there are no visible body writes, and no
      // dependent decode was needed. Keep the resource observation only.
    } else if (res && body.found === 'B2') {
      const icon = 'pixmap' in res.value ? res.value : { pixmap: res.value, pixelSize: null, unmasked: null };
      if (chain.bodyProvider) {
        const dst = insetRect(D, s, s);
        if (emptyRect(dst) || icon.pixmap.width !== dst.right - dst.left || icon.pixmap.height !== dst.bottom - dst.top)
          return unsupported('cicn-body-scaling-unsupported');
        const unmasked = icon.pixelSize !== 1 && icon.pixelSize !== null && icon.unmasked;
        const source = unmasked || icon.pixmap;
        for (let i = 3; i < source.data.length; i += 4)
          if (unmasked ? source.data[i] !== CINF_SAMPLE.opaque : source.data[i] !== 0 && source.data[i] !== CINF_SAMPLE.opaque)
            return unsupported('cicn-body-alpha-mismatch');
      }
      iconBlit(port, icon, rect(0, 0, icon.pixmap.height, icon.pixmap.width), insetRect(D, s, s), trace, 'B2');
    } else if (res) {
      const pattern = 'pixmap' in res.value ? res.value.pixmap : res.value;
      const origin = input.allocationOrigin ?? { x: 0, y: 0 };
      const { row, phase } = cinfPhase(offsetRect(D, origin.x, origin.y), cinf.patternAnchor), off = input.patternOffset;
      const shifted = { x: phase.x - origin.x + (off?.x ?? 0), y: phase.y - origin.y + (off?.y ?? 0) };
      for (const r of cinfBodyRects(D, c, s)) fillPattern(port, r, pattern, shifted, trace, `B5,${row.id}`);
      if (trace?.controlPaint) patternPhase = shifted;
    } else if (backgroundRGB) {
      for (const r of cinfBodyRects(D, c, s)) eraseRect(port, r, backgroundRGB, trace, body.absent);
    } else trace?.drawOps.push({ op: 'cinfBody', row: body.absent, dst: D, unspecified: 'background sample unavailable' });
    if (trace?.controlPaint) {
      const detail = trace.controlPaint;
      const selected = res?.provider.selection?.(body.type, cinf.bgPatternId);
      const owner = res ? selected?.owner : art?.owner;
      const box = (r: QdRect) => ({ x: r.left - D.left, y: r.top - D.top, w: r.right - r.left, h: r.bottom - r.top });
      const union = () => cinfBodyRects(D, c, s).map(r => rect(Math.max(D.top, r.top), Math.max(D.left, r.left),
        Math.min(D.bottom, r.bottom), Math.min(D.right, r.right))).filter(r => !emptyRect(r));
      let bodyPaint: ControlResolutionStep['bodyPaint'];
      if (clippedBody) {
        // Selection is retained below without a completed operation.
      } else if (res && body.found === 'B2' && selected?.resource) {
        const source = 'pixmap' in res.value ? res.value : { pixmap: res.value, pixelSize: null, unmasked: null };
        const dst = insetRect(D, s, s), pm = source.pixmap;
        const unmasked = source.pixelSize !== 1 && source.pixelSize !== null && !!source.unmasked;
        const transport = unmasked ? res.provider.unmaskedSource?.(body.type, cinf.bgPatternId) : undefined;
        // Observe the actual aligned branch, including the masked fallback
        // when depth or opaque companion metadata is unavailable.
        if (!emptyRect(dst) && pm.width === dst.right - dst.left && pm.height === dst.bottom - dst.top
          && (!unmasked || transport)) {
          const paintedPixels = bodyWriteCount(port, [dst], detail.clip, unmasked ? undefined : { pixmap: pm, destination: dst });
          if (paintedPixels) bodyPaint = { branch: unmasked ? 'unmasked-copy' : 'masked-copy',
            sourceRect: { x: 0, y: 0, w: pm.width, h: pm.height }, destinationRect: box(dst), paintedPixels,
            sourceAssetUrl: transport?.assetUrl ?? selected.resource.assetUrl,
            ...(transport?.derivedPath ? { derivedPath: transport.derivedPath } : {}) };
        }
      } else if (res && patternPhase && selected?.resource && detail.context) {
        const pattern = 'pixmap' in res.value ? res.value.pixmap : res.value;
        const boxes = union();
        const paintedPixels = pattern.width > 0 && pattern.height > 0 ? bodyWriteCount(port, boxes, detail.clip) : 0;
        if (paintedPixels) bodyPaint = { branch: 'pattern-fill-union', coordinateSpace: 'face-local-before-ring',
          unionRects: boxes.map(box), paintedPixels, sourceAssetUrl: selected.resource.assetUrl,
          sourceSize: [pattern.width, pattern.height], context: detail.context,
          phase: { basis: 'modern-composition-policy', offset: [D.left - patternPhase.x, D.top - patternPhase.y], originalPatternPhase: 'unverified' } };
      } else if (!res && body.found === 'B2' && backgroundRGB && backgroundRGB16) {
        const paintedPixels = bodyWriteCount(port, union(), detail.clip);
        if (paintedPixels) bodyPaint = { branch: 'missing-erase', destinationRect: box(D), paintedPixels };
      }
      trace.controlPaint.bodies.push({ role: 'body-fill', requestedId: cinf.bgPatternId,
        bodyMode: cinf.patternAnchor, requestedResourceType: body.type,
        action: res ? 'selected' : 'missing', basis: 'source-dispatch', usage: 'paint',
        ...(owner ? { owner } : {}),
        ...(selected?.resource ? { resource: { ...selected.resource, ...(consumedCinf ? { consumedCinf } : {}) } } : {}),
        ...(consumedCinf ? { cinfLookup: consumedCinf } : {}),
        ...(bodyPaint ? { bodyPaint } : {}),
        reason: res ? 'resource-id' : 'same-face-owner-pattern-unavailable' });
      if (!res && body.found === 'B2' && !backgroundRGB16) detail.bodies.push({ role: 'body-fill', requestedId: cinf.bgPatternId,
        bodyMode: cinf.patternAnchor, requestedResourceType: body.type, action: 'fallback', basis: 'compatibility-policy',
        usage: 'paint', ...(owner ? { owner } : {}), reason: 'missing-cicn-body-background-unverified' });
    }
  } else trace?.drawOps.push({ op: 'cinfBody', row: CINF_BODY_SKIP.id, dst: D });

  const edge = CINF_EDGE.find(r => r.tile === (cinf.tileSides ? 'nonzero' : 'zero'))!;
  // Observe only supported, completed operations with an opaque destination
  // inside the allocation and the facade's declared clip. This never paints.
  const completedBand = (piece: string, src: QdRect, dst: QdRect,
    branch: ControlBandPaint['branch'], policy: ControlBandPaint['policy']): void => {
    const detail = trace?.controlPaint;
    if (!detail || !art?.owner || !artResource || emptyRect(src) || emptyRect(dst) || !insideBounds(cicn, src)) return;
    if (!bandVisible(port, cicn, src, dst, branch, detail.clip)) return;
    const box = (r: QdRect) => ({ x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top });
    const regions: Record<string, number> = { TL: 0, TR: 1, top: 2, BL: 3, BR: 4, bottom: 5, left: 6, right: 7 };
    detail.bands.push({ role: bodyFill ? 'face' : 'default-ring', region: regions[piece]!, branch, policy,
      owner: art.owner, resource: artResource, sourceRect: box(src), destinationRect: box(dst),
      ...(policy === 'sampled-companion' && icon?.sampledSource ? { derived: icon.sampledSource } : {}) });
  };
  for (const { piece, src, dst, fast } of cinfBorderPlan(cicn, cinf, D)) {
    if (piece === 'TL' || piece === 'TR' || piece === 'BL' || piece === 'BR') {
      trace?.drawOps.push({ op: 'cinfCorner', row: 'E1', piece, src, dst, transfer: 'copyMask' });
      transferBits(port, cicn, src, dst, 'copyMask');
      completedBand(piece, src, dst, 'copy', 'ordinary-raster');
    } else {
      if (emptyRect(src) || emptyRect(dst)) continue;
      trace?.drawOps.push({ op: 'cinfEdge', row: `E2,${edge.id}`, piece, src, dst, transfer: 'copyMask' });
      if (!insideBounds(cicn, src)) trace?.drawOps.push({ op: 'cinfEdgeSample', row: 'S5', src,
        unspecified: 'source sample outside icon bounds; stored padding unavailable' });
      if (fast) {
        const colours = lineColourSource(icon ?? { pixmap: cicn, pixelSize: null, unmasked: null }, 'cinf E3/E4');
        if (colours.unspecified && (!icon?.prepareSampled
          || bandVisible(port, cicn, src, dst, fast === 'T1' ? 'horizontal-lines' : 'vertical-lines', trace?.controlPaint?.clip)))
          trace?.drawOps.push({ op: 'cinfLine', row: `${fast},S2`, unspecified: colours.unspecified });
        sourceLines(port, cicn, colours.pm, src, dst, fast === 'T1');
        if (!colours.unspecified || icon?.prepareSampled) completedBand(piece, src, dst, fast === 'T1' ? 'horizontal-lines' : 'vertical-lines',
          colours.unspecified ? 'compatibility-raster' : colours.shortcut ? 'equivalent-raster' : 'sampled-companion');
      } else {
        tileBlit(port, cicn, src, dst, 1, 'copyMask', trace);
        if (src.bottom - src.top === dst.bottom - dst.top || src.right - src.left === dst.right - dst.left)
          completedBand(piece, src, dst, 'copy', 'ordinary-raster');
      }
    }
  }
  return { drawn: true, cinfId: hit.id, backgroundRGB, textRGB, embossRGB,
    backgroundRGB16, textRGB16, embossRGB16, colorsAvailable };
}
