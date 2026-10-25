// Public push adapter: browser allocation, declared context and font/display
// policies around the source-backed engine callback (push-button.md §2/§5/§6).
import type { ButtonOptions } from './controls.js';
import { assertThemeAlive, type ThemeView } from './ownedTheme.js';
import type { ChromeElement } from './types.js';
import { PixelBuffer } from './pixelBuffer.js';
import { resolveInChain } from './baseChain.js';
import { snapshotControlComposition, controlPointVisible, recordButtonFaceStage, type ButtonComposition, type ControlCompositionSnapshot } from './controlComposition.js';
import { prepareBitmapGlyphRun, type BitmapGlyphRun } from './preparedBitmapFont.js';
import { paintBitmapText } from './paintBitmapText.js';
import { withControlDiagnostics, type ControlTraceCollector } from './controlDiagnostics.js';
import { CinfEnvironmentError, snapshotBodyCinfFace } from '../tools/theme-loader/cinf-environment.js';
import { ownerDisplayPolicyMatches, realizeRgb16 } from '../tools/theme-loader/display-profile.js';
import { createTrace, type EngineTrace } from './engine/trace.js';
import { ResourceChain } from './engine/resources/chain.js';
import { themeResourceChain } from './engine/resources/theme.js';
import { rect } from './engine/qd/rect.js';
import { prepareCinfFrameSamples, type CinfIconSource, type CinfRecord } from './engine/qd/cinfFrame.js';
import type { Rgba } from './engine/qd/types.js';
import { normalizeControlState } from './engine/state/control.js';
import { drawPushButton, type PushLabelPass } from './engine/families/pushButton.js';
import { PUSH_BUTTON as P, PUSH_FACADE as F, PUSH_PRESSED_PARTS } from './engine/tables/pushButton.js';

const alive = (signal?: AbortSignal): void => { if (signal?.aborted) throw new DOMException('Control preparation aborted', 'AbortError'); };
function faceEntry(theme: ThemeView, id: number): { theme: ThemeView; element: ChromeElement; key: string; chainDepth: number } | undefined {
  let chainDepth = -1;
  return resolveInChain(theme, t => {
    chainDepth++;
    const entry = Object.entries(t.manifest.chromeElements ?? {}).find(([, e]) => e.sourceCicnId === id && e.asset);
    return entry ? { theme: t, element: entry[1], key: entry[0], chainDepth } : null;
  });
}
/** Exact signed identity; no author-label, alias or different-state art inference. */
export async function loadEnginePushFace(theme: ThemeView, state: 'active' | 'pressed' | 'inactive'): Promise<PixelBuffer | null> {
  const id = state === 'inactive' ? P.PB5.resource : state === 'pressed' ? P.PB6.resource : P.PB7.resource;
  const entry = faceEntry(theme, id);
  return entry ? entry.theme.asset(entry.element.asset).pixels() : null;
}
const css = (p: Rgba): string => `rgb(${p.r}, ${p.g}, ${p.b})`;

/** Browser Font Manager substitute: same Chicago/Charcoal family and nominal
 * size as the public control policy, with actual browser widths and metrics. */
function browserFont(size: number, label: string) {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('Push label canvas unavailable');
  const font = `${size}px Chicago, "Charcoal", Geneva, sans-serif`;
  ctx.font = font;
  const metrics = ctx.measureText(label || 'M');
  const ascent = Math.ceil(metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent);
  const descent = Math.ceil(metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent);
  return { font, metrics: { ascent, descent, leading: 0 }, width: (text: string) => Math.ceil(ctx.measureText(text).width) };
}

/** Preserve the admitted standalone cinf-only environment. It is a caller
 * declaration, never a claim about the historical cicn file or search chain. */
function declaredEnvironment(theme: ThemeView, element: ChromeElement, id: number, opts: ButtonOptions,
  diagnostics?: ControlTraceCollector) {
  const prepared = snapshotBodyCinfFace(theme.manifest, element);
  if (!prepared && !theme.manifest.cinfEnvironment) return undefined;
  const view = prepared?.view;
  const reject = (reason: string): never => { throw new CinfEnvironmentError(reason, 'UNSUPPORTED_CINF_ENVIRONMENT'); };
  if (theme.base) reject('cinf-environment-base-inheritance');
  if (opts.default) reject('cinf-environment-default-ring-unsupported');
  if (!view || view.requestedId !== id || view.bindingId !== prepared?.environment.bindingId) reject('cinf-environment-role-binding-missing');
  if (view!.status === 'unsupported') reject(view!.reason ?? 'cinf-environment-unknown');
  if (!ownerDisplayPolicyMatches(theme.manifest, view!.displayPolicy)) reject('cinf-environment-display-policy-mismatch');
  const { metadata, ...lookup } = view!;
  if (view!.status === 'ready' && (!metadata?.slice || !metadata.bodyRequest)) reject('cinf-environment-metadata-unavailable');
  if (metadata?.bodyRequest?.mode === 5) reject('cinf-environment-mode5-unsupported');
  if (opts.label && (view!.status === 'no-body-or-border' || !metadata?.colorSamples?.text || metadata.colorSamples.embossDecision === 'unknown'))
    reject('cinf-environment-text-outputs-unavailable');
  diagnostics?.record({ role: 'face', requestedId: id, action: view!.status === 'ready' ? 'selected' : 'missing',
    reason: 'declared-cinf-role-view', basis: 'compatibility-policy', usage: 'admission',
    owner: { baseUrl: theme.origin, chainDepth: 0 }, cinfLookup: lookup });
  let record: CinfRecord | null = null;
  if (metadata?.slice && metadata.bodyRequest && metadata.bgAnchor && metadata.textAnchor && metadata.embossAnchor) {
    record = { cornerSize: metadata.slice.corner, sideThickness: metadata.slice.side, tileSides: metadata.slice.tile ? 1 : 0,
      patternAnchor: metadata.bodyRequest.mode, bgPatternId: metadata.bodyRequest.resourceId,
      bgPixel: { x: metadata.bgAnchor[0], y: metadata.bgAnchor[1] }, textPixel: { x: metadata.textAnchor[0], y: metadata.textAnchor[1] },
      embossPixel: { x: metadata.embossAnchor[0], y: metadata.embossAnchor[1] } };
  }
  return { view: lookup, metadata, record };
}

/** Render a single browser glyph pass with the engine's baseline and face clip. */
function browserPass(out: PixelBuffer, pass: PushLabelPass, font: string, override?: string): void {
  const canvas = document.createElement('canvas'); canvas.width = out.width; canvas.height = out.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Push label canvas unavailable');
  ctx.imageSmoothingEnabled = false; ctx.font = font; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = override ?? css(pass.color);
  ctx.beginPath(); ctx.rect(pass.clip.left, pass.clip.top, pass.clip.right - pass.clip.left, pass.clip.bottom - pass.clip.top); ctx.clip();
  for (const line of pass.lines) if (line.text) ctx.fillText(line.text, line.x + pass.offset.x, line.baseline + pass.offset.y);
  out.drawOver(new PixelBuffer(out.width, out.height, ctx.getImageData(0, 0, out.width, out.height).data), 0, 0);
}

function publishEngineTrace(trace: EngineTrace, collector?: ControlTraceCollector, completed = false): void {
  if (!collector) return;
  let role: 'face' | 'default-ring' = 'face';
  let pressedRingMissing = false;
  for (const [index, request] of trace.resolved.entries()) {
    const artAttempt = request.type === 'cicn' && /^(PB|DR)/.test(request.row ?? '');
    if (artAttempt) role = request.row!.startsWith('DR') ? 'default-ring' : 'face';
    const body = request.type === 'ppat' || request.row === 'B1';
    const requestRole = body ? 'body-fill' : role;
    if (artAttempt && request.row === P.DR3.id && request.id === P.DR4.resource && pressedRingMissing)
      collector.record({ role: 'default-ring', requestedId: P.DR3.resource, action: 'fallback', basis: 'source-dispatch',
        usage: 'admission', reason: 'pressed-ring-to-active', ...request.selection });
    if (artAttempt && request.id === P.DR3.resource && !request.found) pressedRingMissing = true;
    // The transcript describes lookup, including metadata and NULL. A selected
    // art dependency is a separate decision and never inferred from its name.
    collector.record({ role: requestRole, requestedId: request.id, action: request.found ? 'selected' : 'missing',
      basis: 'source-dispatch', usage: 'admission', ...request.selection,
      reason: `engine:${request.row ?? ''}:${request.type}:${request.provider ?? 'NULL'}` });
    if (!body && request.found && request.selection?.resource) {
      let metadataFound: boolean = false;
      let consumedCinf;
      if (artAttempt) for (const following of trace.resolved.slice(index + 1)) {
        if (following.type !== 'cinf') break;
        if (following.found) { metadataFound = true; consumedCinf = following.selection?.cinfLookup; }
      }
      const frame = role === 'face' ? trace.rects.D : trace.rects.ringRect;
      if (artAttempt && trace.drawOps.some(op => op.op === 'cinfFrame' && op.dst === frame)) metadataFound = false;
      collector.record({ role: requestRole, requestedId: request.id, action: 'selected', basis: 'source-dispatch',
        usage: completed && metadataFound ? 'paint' : 'admission', reason: 'resource-id', ...request.selection,
        ...(consumedCinf ? { cinfLookup: consumedCinf, resource: { ...request.selection.resource, consumedCinf } } : {}) });
    }
  }
  if (completed) {
    for (const body of trace.controlPaint?.bodies ?? []) collector.record(body);
    for (const band of trace.controlPaint?.bands ?? []) collector.bandPaint(band);
  }
  for (const op of trace.drawOps) if (op.unsupported || op.unspecified || op.unimplemented) collector.record({ role: 'face', requestedId: 0,
    action: 'rejected', basis: 'compatibility-policy', usage: 'admission',
    reason: op.unsupported ? `${op.unsupported}` : `${op.row}: ${op.unspecified ?? op.unimplemented}` });
}

export async function composeEnginePush(theme: ThemeView, opts: ButtonOptions = {}, signal?: AbortSignal,
  preparedContext?: ControlCompositionSnapshot): Promise<ButtonComposition | null> {
  const current = (): void => { alive(signal); assertThemeAlive(theme); };
  let result: ButtonComposition | null = null;
  const state = opts.disabled ? 'disabled' : opts.pressed ? 'pressed' : 'normal';
  await withControlDiagnostics(opts.diagnostics, 'push-button', { state: state === 'normal' ? 'active' : state === 'disabled' ? 'inactive' : state,
    pressed: !!opts.pressed, disabled: !!opts.disabled, default: !!opts.default }, async diagnostics => {
    current();
    let composition = preparedContext ?? snapshotControlComposition(opts.compositionContext);
    if (opts.bitmapFont && composition.basis === 'compatibility-default') composition = Object.freeze({ ...composition, clip: Object.freeze({ kind: 'unbounded' as const }) });
    const run: BitmapGlyphRun | undefined = opts.bitmapFont ? prepareBitmapGlyphRun(opts.bitmapFont, opts.label ?? '', opts.fontSize, composition) : undefined;
    const size = run?.font.data.strikeSize ?? opts.fontSize ?? F.fontSize;
    if (!Number.isFinite(size) || size < 6) throw new RangeError('fontSize must be finite and at least 6 CSS pixels');
    if (run) for (const [name, value] of [['height', opts.height], ['minWidth', opts.minWidth]] as const)
      if (value !== undefined && (!Number.isInteger(value) || value < (name === 'height' ? 1 : 0) || value > 32767)) throw new RangeError(`Bitmap ${name} must be a bounded integer`);
    const native = normalizeControlState({ state }, PUSH_PRESSED_PARTS);
    const id = opts.disabled ? P.PB5.resource : opts.pressed ? P.PB6.resource : P.PB7.resource;
    const entry = faceEntry(theme, id);
    if (!entry) {
      diagnostics?.record({ role: 'face', requestedId: id, action: 'missing', basis: 'source-dispatch', usage: 'paint', reason: 'engine:PB8:cicn:NULL' });
      return null;
    }
    const declared = declaredEnvironment(theme, entry.element, id, opts, diagnostics);
    const label = opts.label ?? '';
    const browser = !run && label ? browserFont(size, label) : undefined;
    const metrics = run?.font.data.metrics ?? browser?.metrics;
    const widths = label.split('\r').map(line => run ? run.advance : browser?.width(line) ?? 0);
    const width = Math.max(opts.minWidth ?? F.minWidth, Math.max(...widths) + F.padding * 2);
    let height = opts.height ?? (entry.element.height <= F.reasonableHeight ? entry.element.height : F.height);
    const labelHeight = run?.lineHeight ?? (label ? Math.ceil(size * F.browserRasterHeight) : 0);
    if (opts.height === undefined && labelHeight > height) height = F.height;
    const reserve = [P.DR2.resource, P.DR3.resource, P.DR4.resource].some(r => faceEntry(theme, r));
    const outset = reserve ? P.DR5.outset : 0;
    const out = PixelBuffer.alloc(width + outset * 2, height + outset * 2);
    const requests: { type: string; id: number }[] = [{ type: 'cicn', id }, { type: 'cinf', id }, { type: 'cinf', id: P.PB9.fallback }];
    let ringId: number | null = null;
    if (opts.default) {
      const first = opts.disabled ? P.DR2.resource : opts.pressed ? P.DR3.resource : P.DR4.resource;
      requests.push({ type: 'cicn', id: first });
      const selected = faceEntry(theme, first) ? first : opts.pressed && !opts.disabled ? P.DR4.resource : null;
      ringId = selected;
      if (selected !== null) requests.push({ type: 'cicn', id: selected }, { type: 'cinf', id: selected }, { type: 'cinf', id: P.DR5.fallback });
    }
    const D = rect(outset, outset, outset + height, outset + width);
    const clip = composition.clip.kind === 'rect' ? rect(composition.clip.rect.y - composition.controlOrigin[1] + outset,
      composition.clip.rect.x - composition.controlOrigin[0] + outset,
      composition.clip.rect.y + composition.clip.rect.h - composition.controlOrigin[1] + outset,
      composition.clip.rect.x + composition.clip.rect.w - composition.controlOrigin[0] + outset) : undefined;
    let chain = await themeResourceChain(theme, requests, { ...(signal ? { signal } : {}),
      prepareSamples: async prepared => {
        await prepareCinfFrameSamples(prepared, id, true, D, out, clip, declared?.record);
        if (ringId !== null) await prepareCinfFrameSamples(prepared, ringId, false,
          rect(0, 0, out.height, out.width), out, clip);
      },
      traceProvenance: !!diagnostics, cinfBodies: declared ? [] : [id, P.PB9.fallback],
      bodyEnvironment: { owner: entry.theme, face: entry.element, width, height,
        ...(composition.clip.kind === 'rect' ? { clip: rect(composition.clip.rect.y - composition.controlOrigin[1],
          composition.clip.rect.x - composition.controlOrigin[0], composition.clip.rect.y + composition.clip.rect.h - composition.controlOrigin[1],
          composition.clip.rect.x + composition.clip.rect.w - composition.controlOrigin[0]) } : {}),
        ...(declared?.metadata?.bodyRequest
        ? { requests: [{ type: 'ppat', id: declared.metadata.bodyRequest.resourceId }] } : {}) } });
    current();
    if (declared) {
      const parent = chain.providers[0]!;
      chain = new ResourceChain([{ name: `declared:${declared.view.bindingId}`, tier: 'archive',
        selection: (type, resourceId) => type === 'cinf' ? { cinfLookup: declared.view }
          : parent.selection?.(type, resourceId), get(type, resourceId) {
        if (type === 'cinf') return resourceId === declared.view.selected?.signedId ? declared.record : null;
        const value = parent.get(type, resourceId);
        if (type !== 'cicn' || resourceId !== id || !value) return value;
        const md = declared.metadata;
        return { ...(value as CinfIconSource), sampleRgb16(point: { x: number; y: number }) {
          for (const [anchor, sample] of [[md?.bgAnchor, md?.colorSamples?.background], [md?.textAnchor, md?.colorSamples?.text], [md?.embossAnchor, md?.colorSamples?.emboss]] as const)
            if (anchor?.[0] === point.x && anchor[1] === point.y) return sample?.rgb16 ?? null;
          return null;
        } };
      } }], chain.bodyProvider);
    }
    const trace = createTrace('push-button', { ...native, default: !!opts.default, composition, fontPolicy: run ? 'caller-declared-bitmap' : 'browser-font-substitute' });
    if (diagnostics) {
      const clip = composition.clip;
      trace.controlPaint = { bodies: [], bands: [], context: composition, ...(clip.kind === 'rect' ? {
        clip: rect(clip.rect.y - composition.controlOrigin[1] + outset, clip.rect.x - composition.controlOrigin[0] + outset,
          clip.rect.y + clip.rect.h - composition.controlOrigin[1] + outset, clip.rect.x + clip.rect.w - composition.controlOrigin[0] + outset),
      } : {}) };
    }
    const [ox, oy] = composition.controlOrigin;
    diagnostics?.composition({ context: composition, originalPortState: 'unverified', faceRect: { x: ox, y: oy, w: width, h: height }, appliedUnknownPatternOffset: composition.patternOrigin.status === 'unknown' });
    let labelOverride: Rgba | undefined;
    if (label && opts.fg) {
      const c = document.createElement('canvas').getContext('2d')!;
      c.canvas.width = c.canvas.height = 1; c.fillStyle = opts.fg; c.fillRect(0, 0, 1, 1);
      const rgba = c.getImageData(0, 0, 1, 1).data;
      labelOverride = { r: rgba[0]!, g: rgba[1]!, b: rgba[2]!, a: rgba[3]! };
    }
    let emboss: string | null = null;
    const drawLabel = (pass: PushLabelPass): void => {
      if (opts.fg && pass.offset.x) return;
      const color = opts.fg ?? css(pass.color);
      if (run) {
        if (pass.offset.x) { emboss = color; return; }
        const text = PixelBuffer.alloc(width, height);
        const paint = paintBitmapText(text, run, composition, color, opts.fg ? null : emboss);
        out.drawOver(text, outset, outset);
        if (paint) diagnostics?.bitmapTextPaint(paint);
      } else if (browser) browserPass(out, pass, browser.font, opts.fg);
    };
    try {
      const drawn = drawPushButton(out, chain, { rect: D, hilite: native.hilite, visible: true, defaultDataValid: true,
        defaultFlag: opts.default ? 1 : 0, depth: 32, lowDepth: false, label }, {
        ...(labelOverride ? { labelOverride } : {}),
        ...(metrics ? { fontMetrics: metrics } : {}), textWidth: text => run ? run.advance : browser?.width(text) ?? 0, drawLabel,
        realize: rgb => { const [r, g, b] = realizeRgb16(rgb, theme.manifest.displayProfile); return { r: r!, g: g!, b: b!, a: 255 }; },
        allocationOrigin: { x: ox - outset, y: oy - outset },
        patternOffset: composition.patternOrigin.status === 'known'
          ? { x: -composition.patternOrigin.offset[0], y: -composition.patternOrigin.offset[1] } : { x: 0, y: 0 },
      }, trace);
      if (drawn.unsupported) throw new Error(`Unsupported push-button output: ${drawn.unsupported}`);
      if (!drawn.faceFound) return null;
      if (drawn.face?.colorsAvailable && drawn.face.textRGB) {
        const face = drawn.face;
        const decision = opts.fg ? 'caller-override' : face.embossRGB ? 'present'
          : face.embossRGB16?.[0] === P.PB10.sentinel ? 'sentinel'
          : face.embossRGB16 ? 'same-as-background' : 'absent-coordinates';
        diagnostics?.textColors({ foreground: opts.fg ?? css(drawn.face.textRGB),
          emboss: opts.fg || !face.embossRGB ? null : css(face.embossRGB),
          policy: opts.fg ? 'caller-override' : 'source-samples', embossDecision: decision,
          sampleFallbackReason: null, labelPainted: !!label && !label.endsWith('\r'), deviceMode: 'full-color-policy',
          sourceManifestKey: entry.key, sourceOwnerDepth: entry.chainDepth });
      }
      for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++)
        if (!controlPointVisible(composition, x - outset, y - outset)) out.setPixel(x, y, 0, 0, 0, 0);
      current();
      result = { buffer: out, layout: { faceRect: { x: outset, y: outset, w: width, h: height } } };
      recordButtonFaceStage(result, drawn.face?.drawn === true);
      return out;
    } finally { publishEngineTrace(trace, diagnostics, result !== null); }
  });
  return result;
}
