// Message-0 push/button colour callback, docs/spec/engine/push-button.md.
// Sources `0x66e8..0x6770`, `0x67fc..0x6812`, `0x6c28..0x6d20`,
// `0x7424..0x772a`. Device/offscreen, font and caller defaults remain inputs.
import type { Pixmap, QdPoint, QdRect, Rgba } from '../qd/types.js';
import type { EngineTrace } from '../trace.js';
import type { ResourceChain } from '../resources/chain.js';
import { drawCinfFrame, type CinfIconSource, type CinfUnknownIconSource, type CinfFrameResult, type CinfRgb16 } from '../qd/cinfFrame.js';
import { insetRect, offsetRect } from '../qd/rect.js';
import { PUSH_BUTTON as P, PUSH_IDS, PUSH_LABEL } from '../tables/pushButton.js';

export interface PushButtonInput {
  rect: QdRect; hilite: number; visible?: boolean; regionRecording?: boolean;
  defaultDataValid?: boolean; defaultFlag?: number;
  depth: number; lowDepth: boolean;
  label?: string;
}
export interface PushFontMetrics { ascent: number; descent: number; leading: number }
export interface PushLabelLine { text: string; x: number; baseline: number }
export interface PushLabelPass { lines: readonly PushLabelLine[]; color: Rgba; offset: QdPoint; mode: number; clip: QdRect }
export interface PushButtonEnvironment {
  fontMetrics?: PushFontMetrics; textWidth?: (text: string) => number;
  /** Provider implements glyph transfer; native transfer is not inferred from browser fonts. */
  drawLabel?: (pass: PushLabelPass) => void;
  frameRoundRect?: (rect: QdRect, ovalWidth: number, ovalHeight: number) => void;
  realize?: (rgb: CinfRgb16) => Rgba;
  /** Modern caller foreground override; suppresses authored emboss. */
  labelOverride?: Rgba;
  patternOffset?: QdPoint;
  allocationOrigin?: QdPoint;
}
export interface PushButtonResult {
  faceFound: boolean; face: CinfFrameResult | null;
  ringAttempted: boolean; ringFound: boolean;
  unsupported?: string;
}

/** §5 plain label geometry; final CR glyph semantics remain an explicit provider boundary. */
export function pushLabelLines(D: QdRect, label: string, metrics: PushFontMetrics,
  textWidth: (text: string) => number): PushLabelLine[] {
  if (!label || label.endsWith('\r')) return [];
  const lines = label.split('\r'), n = lines.length;
  const h = metrics.ascent + metrics.descent + metrics.leading;
  const q = Math.trunc((D.bottom + 1 - D.top - n * h) / 2);
  const base = D.bottom - q - metrics.leading - metrics.descent - (n - 1) * h - (h < PUSH_LABEL.shortLine ? 1 : 0);
  return lines.map((text, i) => ({ text, x: Math.trunc((D.left + D.right - textWidth(text)) / 2), baseline: base + i * h }));
}
export function pushButtonState(hilite: number): { disabled: boolean; pressed: boolean } {
  const disabled = (P.PB3.hilites as readonly number[]).includes(hilite);
  return { disabled, pressed: !disabled && hilite !== 0 };
}
/** PB11 selection is independent of whether a mono pixel provider is available. */
export function pushButtonTextMode(hilite: number, depth: number): number {
  return pushButtonState(hilite).disabled && depth < P.PB11.depth ? P.PB11.grayishTextOr : P.PB11.srcOr;
}
export function pushButtonResourceIds(): { type: string; id: number }[] {
  return [...PUSH_IDS.bases.map(id => ({ type: 'cicn', id })),
    ...[...PUSH_IDS.bases, P.PB9.fallback, P.DR5.fallback].map(id => ({ type: 'cinf', id }))];
}
/** PB1–PB13 then DR1–DR6. The cicn's existence defines success, independently of metadata. */
export function drawPushButton(port: Pixmap, chain: ResourceChain, input: PushButtonInput,
  env: PushButtonEnvironment = {}, trace?: EngineTrace): PushButtonResult {
  const result: PushButtonResult = { faceFound: false, face: null, ringAttempted: false, ringFound: false };
  if (input.visible === false) { trace?.drawOps.push({ op: 'skip', row: P.PB1.id }); return result; }
  const D = input.rect;
  if (trace) trace.rects.D = D;
  if (input.regionRecording) {
    trace?.drawOps.push({ op: 'FrameRoundRect', row: P.PB2.id, dst: D, ovalWidth: P.PB2.oval, ovalHeight: P.PB2.oval,
      ...(!env.frameRoundRect ? { unspecified: 'region recorder provider unavailable' } : {}) });
    env.frameRoundRect?.(D, P.PB2.oval, P.PB2.oval); return result;
  }
  const { disabled, pressed } = pushButtonState(input.hilite);
  const mode = pushButtonTextMode(input.hilite, input.depth);
  if (input.lowDepth) {
    trace?.drawOps.push({ op: 'environment', row: 'PB11,S3,X3,F3', mode,
      unimplemented: 'low-depth cicn image and ppat planes require a mono resource provider' });
    return { ...result, unsupported: 'low-depth resource provider unavailable' };
  }
  const faceRow = disabled ? P.PB5 : pressed ? P.PB6 : P.PB7;
  trace?.drawOps.push({ op: 'state', row: disabled ? P.PB3.id : P.PB4.id, disabled, pressed });
  const attempt = (id: number, bodyFill: boolean, dstRect: QdRect, row: string): CinfFrameResult | null => {
    const art = chain.getResource<CinfIconSource | CinfUnknownIconSource>('cicn', id, { row, ...(trace ? { trace } : {}) });
    if (!art) return null;
    return drawCinfFrame(port, chain, { id, cicn: art.value.pixmap, icon: art.value, dstRect, bodyFill,
      requireRawSamples: true, ...(env.realize ? { realize: env.realize } : {}),
      ...(env.allocationOrigin ? { allocationOrigin: env.allocationOrigin } : {}),
      ...(env.patternOffset ? { patternOffset: env.patternOffset } : {}) }, trace);
  };
  result.face = attempt(faceRow.resource, true, D, faceRow.id); result.faceFound = result.face !== null;
  if (result.face?.unsupported) return { ...result, unsupported: result.face.unsupported };
  const label = input.label ?? '';
  const face = result.face;
  if (!face) trace?.drawOps.push({ op: 'face', row: P.PB8.id, unspecified: 'face absent; no face-state retry; label outputs unavailable' });
  else if (!face.drawn) trace?.drawOps.push({ op: 'face', row: P.PB9.id, unspecified: 'face metadata absent; label outputs unavailable' });
  const textColor = env.labelOverride ?? (face?.colorsAvailable ? face.textRGB : null);
  if (label.endsWith('\r')) trace?.drawOps.push({ op: 'label', row: '5', unspecified: 'final carriage-return scan and glyph semantics; label stage skipped' });
  else if (label && textColor && env.fontMetrics && env.textWidth && env.drawLabel) {
    const origin = env.allocationOrigin ?? { x: 0, y: 0 };
    const lines = pushLabelLines(offsetRect(D, origin.x, origin.y), label, env.fontMetrics, env.textWidth)
      .map(line => ({ ...line, x: line.x - origin.x, baseline: line.baseline - origin.y }));
    const pass = (color: Rgba, offset: number, row: string): void => {
      trace?.drawOps.push({ op: 'label', row, lines, color, mode, offset, clip: D, ...(env.labelOverride ? { policy: 'caller foreground override' } : {}) });
      env.drawLabel!({ lines, color, offset: { x: offset, y: offset }, mode, clip: D });
    };
    if (!env.labelOverride && face?.embossRGB) pass(face.embossRGB, P.PB12.offset, `${P.PB10.id},${P.PB11.id},${P.PB12.id}`);
    pass(textColor, 0, `${P.PB10.id},${P.PB11.id},${!env.labelOverride && face?.embossRGB ? P.PB12.id : P.PB13.id}`);
  } else if (label) trace?.drawOps.push({ op: 'label', row: P.PB10.id, unspecified: 'label colour outputs or font provider unavailable' });
  if (!input.defaultDataValid || !input.defaultFlag) { trace?.drawOps.push({ op: 'ring', row: P.DR1.id }); return result; }
  result.ringAttempted = true;
  const R = insetRect(D, -P.DR5.outset, -P.DR5.outset);
  if (trace) trace.rects.ringRect = R;
  const ringRow = disabled ? P.DR2 : pressed ? P.DR3 : P.DR4;
  let ring = attempt(ringRow.resource, false, R, ringRow.id);
  if (!ring && pressed) ring = attempt(P.DR4.resource, false, R, P.DR3.id);
  result.ringFound = ring !== null;
  if (ring?.unsupported) return { ...result, unsupported: ring.unsupported };
  if (ring && !ring.drawn) trace?.drawOps.push({ op: 'ring', row: P.DR6.id, success: true });
  return result;
}
