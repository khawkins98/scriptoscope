/** Segmented tab body, docs/spec/engine/tab.md B1–B8, C1–C5, P1–P4.
 * CDEF 8 0x16e..0x634. Resources and modern label policy are adapter inputs. */
import type { Pixmap, QdPoint, QdRect, Rgba } from '../qd/types.js';
import type { EngineTrace } from '../trace.js';
import { rect, emptyRect } from '../qd/rect.js';
import { tileBlit } from '../qd/tile.js';
import { transferBits } from '../qd/transfer.js';
import { sourceLines } from '../qd/lines.js';
import { eraseRect, fillPattern } from '../qd/pattern.js';
import { TAB_BODY, TAB_DOMAIN, TAB_PHASE, TAB_STATE, TAB_VARIANTS } from '../tables/tab.js';

/** Original resting/tracking context only; public composeTab keeps F1/F2. */
export function tabOriginalState(hilite: number, enabled: boolean, selected: boolean, trackingInside?: boolean): number {
  const base = !enabled ? TAB_STATE[2].state : trackingInside !== undefined
    ? trackingInside ? TAB_STATE[3].inside : TAB_STATE[3].outside
    : TAB_STATE[0].hilites.some(value => value === hilite) ? TAB_STATE[0].state : TAB_STATE[1].state;
  return base + (selected ? TAB_STATE[4].selectedOffset : 0);
}
export function tabOriginalResourceIds(variant: 'small' | 'large', state: number): readonly number[] {
  const row = TAB_VARIANTS.find(row => row.variant === variant)!;
  return [row.first + state, row.retry + state];
}
export interface TabMetadata { corner: number; side: number; tile: boolean; mode: number; patternId: number }
export interface TabInput {
  source: Pixmap; destination: QdRect; metadata: TabMetadata;
  sampled?: Pixmap | null; samplingEquivalent?: boolean;
  backgroundRGB?: Rgba | null; textRGB?: Rgba | null; embossRGB?: Rgba | null;
  pattern?: Pixmap | null;
}
export interface TabBodyResult {
  drawn: boolean; unsupported?: 'unsupported-metadata' | 'unsupported-sampling' | 'unsupported-pattern'; reason?: string;
  bottom: number; backgroundRGB: Rgba | null; textRGB: Rgba | null; embossRGB: Rgba | null;
  center: 'empty' | 'solid' | 'pattern'; phase: QdPoint;
}
export function tabPhase(D: QdRect, mode: number): QdPoint {
  const r = TAB_PHASE.find(r => r.mode === mode || r.mode === '*')!;
  return { x: r.x === 'left' ? D.left : r.x === 'right' ? D.right : 0,
    y: r.y === 'top' ? D.top : r.y === 'bottom' ? D.bottom : 0 };
}
export function tabCenter(input: Pick<TabInput, 'source' | 'destination' | 'metadata'>): QdRect {
  const { destination: D, metadata: { corner: c, side: s }, source } = input;
  return rect(D.top + s, D.left + c, D.top + source.height - s, D.right - c);
}
/** AD4: declared complete bounds and binary mask; no opaque-bounds substitution. */
export function admitTabGeometry(source: Pixmap, D: QdRect, m: TabMetadata): string | null {
  const integer = (v: number) => Number.isInteger(v) && v >= TAB_DOMAIN.min && v <= TAB_DOMAIN.max;
  if (![source.width, source.height, D.left, D.top, D.right, D.bottom, D.top + source.height].every(integer)
    || source.width <= 0 || source.height <= 0 || D.right - D.left < 0 || D.right - D.left > TAB_DOMAIN.max) return 'invalid-source-or-destination-bounds';
  if (!Number.isInteger(m.corner) || m.corner < 0 || 2 * m.corner >= source.width
    || !Number.isInteger(m.side) || m.side < 0 || m.side > source.height
    || D.right - D.left < 2 * m.corner || typeof m.tile !== 'boolean') return 'invalid-slice-or-size';
  if (!integer(m.patternId) || !Number.isInteger(m.mode) || m.mode < 0 || m.mode > TAB_DOMAIN.opaque)
    return 'invalid-body-request';
  if (source.data.length !== source.width * source.height * TAB_DOMAIN.channels) return 'invalid-raster-length';
  for (let i = TAB_DOMAIN.channels - 1; i < source.data.length; i += TAB_DOMAIN.channels)
    if (source.data[i] !== 0 && source.data[i] !== TAB_DOMAIN.opaque) return 'non-binary-mask';
  return null;
}
export function tabBandPlan(input: Pick<TabInput, 'source' | 'destination' | 'metadata'>) {
  const { source: { width: w, height: H }, destination: D, metadata: { corner: c, side: s, tile } } = input;
  const q = tile ? w - 2 * c : 1;
  return [
    { row: TAB_BODY[0]!, src: rect(0, 0, H, c), dst: rect(D.top, D.left, D.top + H, D.left + c), lines: false },
    { row: TAB_BODY[1]!, src: rect(0, w - c, H, w), dst: rect(D.top, D.right - c, D.top + H, D.right), lines: false },
    { row: TAB_BODY[2]!, src: rect(0, c, s, c + q), dst: rect(D.top, D.left + c, D.top + s, D.right - c), lines: q === 1 && D.right - D.left - 2 * c > 1 },
    { row: TAB_BODY[3]!, src: rect(H - s, c, H, c + q), dst: rect(D.top + H - s, D.left + c, D.top + H, D.right - c), lines: q === 1 && D.right - D.left - 2 * c > 1 },
  ];
}
export function tabNeedsSampledBands(input: Pick<TabInput, 'source' | 'destination' | 'metadata'>): boolean {
  return tabBandPlan(input).some(p => p.lines && !emptyRect(p.src) && !emptyRect(p.dst));
}
/** Complete sampled companion must retain the icon's mask (C1). */
export function validTabCompanion(source: Pixmap, sampled: Pixmap): boolean {
  if (source.width !== sampled.width || source.height !== sampled.height || source.data.length !== sampled.data.length) return false;
  for (let i = TAB_DOMAIN.channels - 1; i < source.data.length; i += TAB_DOMAIN.channels)
    if (source.data[i] !== sampled.data[i]) return false;
  return true;
}
export function drawTab(port: Pixmap, input: TabInput, trace?: EngineTrace): TabBodyResult {
  const { source, destination: D, metadata: m } = input;
  const centre = tabCenter(input), phase = tabPhase(D, m.mode);
  const pattern = m.patternId !== 0 ? input.pattern : null;
  const result: TabBodyResult = { drawn: false, bottom: D.top + source.height,
    backgroundRGB: input.backgroundRGB ?? null, textRGB: input.textRGB ?? null, embossRGB: input.embossRGB ?? null,
    center: emptyRect(centre) ? 'empty' : pattern ? 'pattern' : 'solid', phase };
  const reject = (unsupported: NonNullable<TabBodyResult['unsupported']>, reason: string) => {
    trace?.drawOps.push({ op: 'tabAdmission', row: unsupported === 'unsupported-metadata' ? 'AD4' : 'AD5', unsupported, reason });
    return { ...result, unsupported, reason };
  };
  const invalid = admitTabGeometry(source, D, m);
  if (invalid) return reject('unsupported-metadata', invalid);
  if (tabNeedsSampledBands(input) && !input.samplingEquivalent
    && (!input.sampled || !validTabCompanion(source, input.sampled))) return reject('unsupported-sampling', 'sampled-band-companion-or-equivalence-unavailable');
  if (!emptyRect(centre)) {
    if (!pattern && !input.backgroundRGB) return reject('unsupported-sampling', 'background-sample-unavailable');
    if (pattern && (pattern.width <= 0 || pattern.height <= 0
      || !Number.isInteger(pattern.width) || !Number.isInteger(pattern.height)
      || pattern.data.length !== pattern.width * pattern.height * TAB_DOMAIN.channels))
      return reject('unsupported-pattern', 'invalid-pattern-raster');
    if (pattern) for (let i = TAB_DOMAIN.channels - 1; i < pattern.data.length; i += TAB_DOMAIN.channels)
      if (pattern.data[i] !== TAB_DOMAIN.opaque) return reject('unsupported-pattern', 'non-opaque-pattern');
  }
  for (const p of tabBandPlan(input)) {
    if (emptyRect(p.src) || emptyRect(p.dst)) continue;
    trace?.drawOps.push({ op: 'tabBand', row: p.row.id, src: p.src, dst: p.dst, branch: p.lines ? 'sampled-lines' : 'masked-copy' });
    if (p.lines) sourceLines(port, source, input.samplingEquivalent ? source : input.sampled!, p.src, p.dst, true);
    else if (p.row.piece === 'left' || p.row.piece === 'right') transferBits(port, source, p.src, p.dst, 'copyMask');
    else tileBlit(port, source, p.src, p.dst, 1, 'copyMask', trace);
  }
  if (!emptyRect(centre)) {
    if (pattern) fillPattern(port, centre, pattern, phase, trace, 'B5,P3,P4');
    else eraseRect(port, centre, input.backgroundRGB!, trace, m.patternId === 0 ? 'B5,P1' : 'B5,P2');
  }
  trace?.drawOps.push({ op: 'tabBottom', row: 'B6', bottom: result.bottom });
  return { ...result, drawn: true };
}
