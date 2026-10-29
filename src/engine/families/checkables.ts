// checkables.draw, docs/spec/engine/checkables.md CB1–CB24, §5.
// Sources: 0x66e8..0x7420, 0xf4ba..0xf68a. Native font/device outputs
// remain provider inputs; archive/base selection is a separate caller policy.
import type { Pixmap, QdRect, Rgba } from '../qd/types.js';
import type { IconSource } from '../../raster.js';
import { cornerBlit } from '../../raster.js';
import { transferBits } from '../../raster.js';
import type { ResourceChain, ResourceHit } from '../resources/chain.js';
import type { EngineTrace } from '../trace.js';
import type { PushFontMetrics, PushLabelLine } from './pushButton.js';
import { CHECKABLES as C, CHECKABLE_ICON_ROWS, CHECKABLE_GEOMETRY as G, CHECKABLE_IDS } from '../tables/checkables.js';

/** A present resource whose identity or decoding cannot establish an output.
 * This is deliberately non-NULL, so it stops selection/retry. */
export interface CheckableUnknown { status: 'unknown'; reason: string }
export interface CheckableMask { planes: readonly number[] }
export interface CheckableCicn extends IconSource { mono?: Pixmap }
export interface CheckableInput {
  rect: QdRect; variation: number; hilite: number; value: number;
  visible?: boolean; regionRecording?: boolean; eraseControl?: boolean; acidAlternate: boolean;
  colorPort: boolean; lowDepth: boolean; colorIconMapAvailable: boolean;
  recordingPicture?: boolean; customBottlenecks?: boolean; label?: string;
}
export interface CheckableLabelPass { lines: readonly PushLabelLine[]; clip: QdRect; mode: number }
export interface CheckableEnvironment {
  /** Explicit System-file GetResource environment, independent of cicn loader. */
  systemResources: ResourceChain;
  /** Native erase pattern/clip provider; omitted output remains unresolved. */
  erase?: (rect: QdRect, maskClear?: { source: Pixmap; bounds: QdRect; storageOrigin: { x: number; y: number } }) => void;
  frameRect?: (rect: QdRect) => void;
  fontMetrics?: PushFontMetrics; drawLabel?: (pass: CheckableLabelPass) => void;
  /** Required destination colours for the 1-bit image; no inferred RGB map. */
  monoColors?: { foreground: Rgba; background: Rgba };
}
export interface CheckableResult { path: 'none' | 'cicn' | 'icon'; drawn: boolean; unsupported?: string }
export function checkableLabelLines(D: QdRect, label: string, metrics: PushFontMetrics): PushLabelLine[] {
  if (!label || label.endsWith('\r')) return [];
  const lines = label.split('\r'), n = lines.length;
  const h = metrics.ascent + metrics.descent + metrics.leading;
  const q = Math.trunc((D.bottom + 1 - D.top - n * h) / 2);
  const base = D.bottom - q - metrics.leading - metrics.descent - (n - 1) * h;
  return lines.map((text, i) => ({ text, x: D.left + G.label, baseline: base + i * h }));
}
type SelectionInput = Pick<CheckableInput, 'variation' | 'hilite' | 'value' | 'acidAlternate' | 'colorPort' | 'lowDepth'>;
const checkableState = (hilite: number) => (C.CB4.hilites as readonly number[]).includes(hilite) ? C.CB4 : hilite ? C.CB5 : C.CB6;
export function checkableResourceIds(input?: SelectionInput): { type: string; id: number }[] {
  if (input) {
    const state = checkableState(input.hilite), kind = (C.CB3.radio as readonly number[]).includes(input.variation & C.CB3.variationMask) ? 1 : 0;
    const value = kind === 0 && input.value === 1 && input.acidAlternate ? C.CB8.alternate : input.value;
    const cicns = (value >= 2 ? [value, C.CB9.retry] : [value]).map(v => ({ type: 'cicn', id: C.CB10.base + C.CB10.kindStep * kind + C.CB10.valueStep * v + state.cicnTier }));
    const iconValue = input.value === 1 && input.acidAlternate ? C.CB13.alternate : input.value;
    const row = CHECKABLE_ICON_ROWS.find(r => r.kind === kind && r.tier === state.iconTier)!;
    const icons = (iconValue >= 2 ? [iconValue, C.CB14.retry] : [iconValue]).flatMap(v => [
      { type: 'ics#', id: row.ids[v]! }, ...(input.colorPort && !input.lowDepth ? [{ type: 'ics8', id: row.ids[v]! }] : []),
    ]);
    return [...cicns, ...icons];
  }
  const ids = CHECKABLE_IDS.terms.reduce<number[]>((values, terms) => values.flatMap(v => terms.map(t => v + t)), [...CHECKABLE_IDS.bases]);
  return [...ids.map(id => ({ type: 'cicn', id })), ...[...new Set(CHECKABLE_ICON_ROWS.flatMap(r => [...r.ids]))]
    .flatMap(id => [{ type: 'ics#', id }, { type: 'ics8', id }])];
}
const unknown = (value: unknown): value is CheckableUnknown => !!value && typeof value === 'object' && 'status' in value && value.status === 'unknown';

/** CB1–CB24; only proven NULL advances a fallback. */
export function drawCheckable(port: Pixmap, resources: ResourceChain, input: CheckableInput,
  env: CheckableEnvironment, trace?: EngineTrace): CheckableResult {
  const none: CheckableResult = { path: 'none', drawn: false };
  const op = (row: string, fields: Record<string, unknown>) => trace?.drawOps.push({ op: 'checkable', row, ...fields });
  const unresolved = (row: string, reason: string, path: CheckableResult['path'] = 'none'): CheckableResult => {
    op(row, { unspecified: reason }); return { path, drawn: false, unsupported: reason };
  };
  if (input.visible === false) { op(C.CB1.id, { visible: false }); return none; }
  const D = input.rect;
  if (trace) trace.rects.D = D;
  if (input.regionRecording) {
    op(C.CB2.id, { operation: 'FrameRect', dst: D });
    if (!env.frameRect) return unresolved(C.CB2.id, 'region recorder unavailable');
    env.frameRect(D); return none;
  }
  const variation = input.variation & C.CB3.variationMask;
  const kind = (C.CB3.checkbox as readonly number[]).includes(variation) ? 0
    : (C.CB3.radio as readonly number[]).includes(variation) ? 1 : null;
  if (kind === null) return unresolved(C.CB3.id, 'variation outside checkable unit');
  if (!Number.isInteger(input.value) || input.value < 0 || input.value > C.CB8.alternate)
    return unresolved(C.CB3.id, 'control value outside decoded 0..3 domain');
  const state = checkableState(input.hilite);
  op(`${C.CB3.id},${state.id}`, { kind, cicnTier: state.cicnTier, iconTier: state.iconTier });
  const erase = (rect: QdRect, row: string, maskClear?: { source: Pixmap; bounds: QdRect; storageOrigin: { x: number; y: number } }) => {
    op(row, { operation: maskClear ? 'eraseMaskClear' : 'EraseRect', dst: rect,
      ...(!env.erase ? { unspecified: 'erase pattern provider unavailable' } : {}) });
    env.erase?.(rect, maskClear);
  };
  const mode = state === C.CB4 ? C.CB7.disabledMode : C.CB7.mode;
  op(C.CB7.id, { operation: 'prepareText', mode });
  if (input.eraseControl) erase(D, C.CB7.id);
  if (input.label) {
    const lines = env.fontMetrics ? checkableLabelLines(D, input.label, env.fontMetrics) : null;
    op(C.CB7.id, { operation: 'label', mode, lines, clip: D,
      ...(!lines || !env.drawLabel || input.label.endsWith('\r') ? { unspecified: 'font provider or final carriage-return semantics unavailable' } : {}) });
    if (lines && env.drawLabel) env.drawLabel({ lines, clip: D, mode });
  }
  let value = input.value;
  if (kind === 0 && value === 1 && input.acidAlternate) value = C.CB8.alternate;
  op(C.CB8.id, { effectiveValue: value });
  const cicnId = () => C.CB10.base + C.CB10.kindStep * kind + C.CB10.valueStep * value + state.cicnTier;
  let art: ResourceHit<CheckableCicn | CheckableUnknown> | null = null;
  if (value >= 2) {
    art = resources.getResource('cicn', cicnId(), { row: C.CB9.id, ...(trace ? { trace } : {}) });
    if (!art) value = C.CB9.retry;
  }
  if (!art) art = resources.getResource('cicn', cicnId(), { row: C.CB10.id, ...(trace ? { trace } : {}) });
  if (art) {
    if (unknown(art.value)) return unresolved(C.CB11.id, art.value.reason, 'cicn');
    const icon = art.value, pixmap = input.lowDepth || !input.colorPort ? icon.mono : icon.pixmap;
    if (!pixmap) return unresolved(C.CB11.id, 'mono cicn plane unavailable', 'cicn');
    if (!icon.origin || !Number.isInteger(icon.origin.left) || !Number.isInteger(icon.origin.top))
      return unresolved(C.CB11.id, 'cicn full bounds origin unavailable', 'cicn');
    const bounds = { left: icon.origin.left, top: icon.origin.top,
      right: icon.origin.left + pixmap.width, bottom: icon.origin.top + pixmap.height };
    const w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
    const x = D.left + G.center - Math.trunc(w / 2), y = Math.trunc((D.top + D.bottom - h) / 2);
    const dst = { left: x, top: y, right: x + w, bottom: y + h };
    const storageOrigin = { x: icon.origin.left, y: icon.origin.top };
    // The full logical S reaches the raster boundary. Image and mask share
    // the same translation to decoded storage; this never trims mask holes.
    const storageRect = { left: bounds.left - storageOrigin.x, top: bounds.top - storageOrigin.y,
      right: bounds.right - storageOrigin.x, bottom: bounds.bottom - storageOrigin.y };
    erase(dst, C.CB11.id, { source: pixmap, bounds, storageOrigin });
    op(C.CB11.id, { operation: 'cornerFullBounds', src: bounds, storageOrigin, storageRect, dst, transfer: 'copyMask',
      nativeTransfer: input.recordingPicture || input.customBottlenecks ? 'CopyBits through mapped mask region (SC4)' : 'CopyMask (SC3)' });
    cornerBlit(port, pixmap, storageRect, x, y, 'copyMask');
    op(C.CB11.id, { operation: 'releaseCicn', provider: art.provider.name });
    return { path: 'cicn', drawn: true };
  }
  op(C.CB12.id, { originalValue: input.value });
  const y = Math.floor((D.top + D.bottom - C.CB24.eraseHeight) / 2);
  const erased = { left: D.left, top: y, right: D.left + C.CB24.width, bottom: y + C.CB24.eraseHeight };
  erase(erased, C.CB24.id);
  const dst = { ...erased, bottom: y + C.CB24.height };
  // System selection is separate from the mask's owner used by CB18.
  op(C.CB15.id, { operation: 'UseResFile', file: 'System', providers: env.systemResources.providers.map(p => p.name) });
  try {
    value = input.value === 1 && input.acidAlternate ? C.CB13.alternate : input.value;
    op(C.CB13.id, { effectiveValue: value });
    const row = CHECKABLE_ICON_ROWS.find(r => r.kind === kind && r.tier === state.iconTier)!;
    const iconId = () => row.ids[value]!;
    if (value >= 2) {
      const probe = env.systemResources.getResource<CheckableMask | CheckableUnknown>('ics#', iconId(), { row: C.CB14.id, ...(trace ? { trace } : {}) });
      if (probe && unknown(probe.value)) return unresolved(C.CB14.id, probe.value.reason, 'icon');
      if (!probe) value = C.CB14.retry;
    }
    const id = iconId();
    const mask = env.systemResources.getResource<CheckableMask | CheckableUnknown>('ics#', id, { row: C.CB15.id, ...(trace ? { trace } : {}) });
    if (!mask) { op(C.CB16.id, { missing: true }); return { path: 'icon', drawn: false }; }
    if (unknown(mask.value)) return unresolved(C.CB15.id, mask.value.reason, 'icon');
    const planes = mask.value.planes;
    if (!planes || planes.length !== G.planes || planes.some(n => !Number.isInteger(n) || n < 0 || n > G.byteMax))
      return unresolved(C.CB15.id, 'invalid ics# planes', 'icon');
    let color: Pixmap | null = null;
    if (input.colorPort && !input.lowDepth) {
      op(C.CB18.id, { operation: 'UseResFile', file: mask.provider.name, scope: 'mask-owner-only' });
      const hit = env.systemResources.get1Resource<Pixmap | CheckableUnknown>('ics8', id, mask.provider, { row: C.CB18.id, ...(trace ? { trace } : {}) });
      op(C.CB18.id, { operation: 'restoreResourceFile', file: 'System' });
      if (hit && input.colorIconMapAvailable) {
        if (unknown(hit.value)) return unresolved(C.CB18.id, hit.value.reason, 'icon');
        color = hit.value;
      }
      else op(C.CB19.id, { mono: true, ...(hit && unknown(hit.value) ? { unusedColorResourceUnknown: hit.value.reason } : {}) });
    } else op(C.CB17.id, { mono: true });
    const allSet = planes.slice(G.imageBytes).every(n => n === G.byteMax);
    const opaque = allSet || input.recordingPicture || (!color && input.customBottlenecks);
    const transfer = opaque ? 'copyBits' : 'copyMask';
    const transferRow = color ? opaque ? C.CB22 : C.CB23 : opaque ? C.CB20 : C.CB21;
    if (!color && !env.monoColors) return unresolved(transferRow.id, '1-bit destination RGB mapping unavailable', 'icon');
    if (color && (color.width !== C.CB24.width || color.height !== C.CB24.height || color.data.length !== color.width * color.height * 4
      || color.data.some((n, i) => i % 4 === C.CB8.alternate && n !== G.opaque)))
      return unresolved(C.CB18.id, 'invalid or non-opaque ics8 source', 'icon');
    const data = new Uint8ClampedArray(C.CB24.width * C.CB24.height * 4);
    for (let py = 0; py < C.CB24.height; py++) for (let px = 0; px < C.CB24.width; px++) {
      const byte = py * G.rowBytes + Math.floor(px / G.byteBits), bit = G.highBit >> (px % G.byteBits);
      const offset = (py * C.CB24.width + px) * 4;
      const rgb = planes[byte]! & bit ? env.monoColors?.foreground : env.monoColors?.background;
      data[offset] = color ? color.data[offset]! : rgb!.r;
      data[offset + 1] = color ? color.data[offset + 1]! : rgb!.g;
      data[offset + 2] = color ? color.data[offset + 2]! : rgb!.b;
      data[offset + 3] = opaque || (planes[byte + G.imageBytes]! & bit) ? G.opaque : 0;
    }
    const source = { width: C.CB24.width, height: C.CB24.height, data };
    const src = { left: 0, top: 0, right: source.width, bottom: source.height };
    op(transferRow.id, { src, dst, transfer, allSet, tableSource: row.source });
    transferBits(port, source, src, dst, transfer);
    return { path: 'icon', drawn: true };
  } finally { op(C.CB18.id, { operation: 'restoreResourceFileAndZone' }); }
}
