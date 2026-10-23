import { composeEngineCheckable, type CheckableOptions } from './checkableFacade.js';
import { composeEnginePush, loadEnginePushFace } from './pushButtonFacade.js';
import { CinfEnvironmentError, snapshotBodyCinfFace, snapshotSliderLayoutCinf, type CinfLookupView } from '../tools/theme-loader/cinf-environment.js';
import type { PreparedBitmapFont, BitmapGlyphRun } from './preparedBitmapFont.js';
import { paintBitmapText } from './paintBitmapText.js';
import { ownerDisplayPolicyMatches, realizeRgb16 } from '../tools/theme-loader/display-profile.js';
import { snapshotControlComposition, bodyPatternPhase, controlPointVisible, type ControlCompositionContext, type ControlCompositionSnapshot, type ButtonComposition } from './controlComposition.js';
import type { SliderComposition } from './sliderLayout.js';
import type { LoadedTheme, ChromeElement } from './types.js';
import { resolveInChain } from './baseChain.js';
import { assetUrl } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { PixelBuffer } from './pixelBuffer.js';
import { rasterizeText } from './textRaster.js';
import { controlTextColors } from './controlTextColors.js';
import { composeTabBody } from './composeTabBody.js';
import { planHeaderSurface, headerMetadataRejection, headerBackground, paintHeaderSurface,
  type HeaderSurfaceOptions, type HeaderSurfaceResult, type HeaderSurfaceTrace } from './headerSurface.js';
import { createTrace, type EngineTrace } from './engine/trace.js';
import { rect } from './engine/qd/rect.js';
import { normalizeControlState } from './engine/state/control.js';
import { SCROLLBAR_PRESSED_PARTS, SLIDER_PRESSED_PARTS } from './engine/tables/controlState.js';
import { SCROLLBAR_FACADE_RANGE, SCROLLBAR_FACADE_THICKNESS } from './engine/tables/scrollbar.js';
import { drawScrollbar, scrollbarPartAt, scrollbarResourceIds, type ScrollbarInput } from './engine/families/scrollbar.js';
import { SLIDER_FACADE_BACKGROUND, SLIDER_FACADE_RANGE, SLIDER_FACADE_THICKNESS, SLIDER_THUMB, SLIDER_VARIATION } from './engine/tables/slider.js';
import { drawSlider, sliderInit, sliderPartAt, sliderResourceIds, type SliderInput } from './engine/families/slider.js';
import { PROGRESS_DATA, PROGRESS_FACADE_LENGTH, PROGRESS_FACADE_RANGE, PROGRESS_FACADE_VALUE, PROGRESS_IDLE, PROGRESS_RECT, PROGRESS_STATE,
  PROGRESS_VALUE_DOMAIN } from './engine/tables/progress.js';
import { drawProgress, newProgressRecord, progressResourceIds, progressSetData, type ProgressInput } from './engine/families/progress.js';
import { themeResourceChain } from './engine/resources/theme.js';
import { withControlDiagnostics, type ControlDiagnostics, type ControlTraceCollector, type ControlResolutionStep, type LegacyFacePaint } from './controlDiagnostics.js';

/** 9-slice corner inset for a control cicn — matches the kDEF's ~6px for
 *  a 15px button face (kDEF routine `0x30a8`): floor((min(w,h)-3)/2). */
function sliceInset(w: number, h: number): number {
  return Math.max(2, Math.floor((Math.min(w, h) - 3) / 2));
}

/** Bounding box of the buffer's non-transparent pixels (alpha > 0). */
function opaqueBounds(buf: PixelBuffer): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = buf.width, y0 = buf.height, x1 = -1, y1 = -1;
  for (let y = 0; y < buf.height; y++)
    for (let x = 0; x < buf.width; x++)
      if (buf.getPixel(x, y)[3] > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return { x0, y0, x1, y1 };
}

/**
 * Look up a chromeElement by its bundle key (e.g.
 * `'normal-horizontal-scrollbar'`) and load its cicn into a PixelBuffer.
 * Returns null if the scheme doesn't ship that element (→ baseline path).
 */
async function loadByKey(theme: LoadedTheme, key: string): Promise<PixelBuffer | null> {
  const hit = resolveInChain(theme, (t) => {
    const asset = t.manifest.chromeElements?.[key]?.asset;
    return asset ? { theme: t, asset } : null; // first theme in the chain that ships it
  });
  return hit ? loadCicnBuffer(assetUrl(hit.theme, hit.asset)) : null;
}

/**
 * Look up a chromeElement by its Kaleidoscope RESOURCE ID and load it.
 * The id is the authoritative selector the kDEF uses (e.g. -8286 = the
 * horizontal scrollbar track); bundle slugs for the same resource vary
 * wildly between schemes ("normal-horizontal-scrollbar" vs
 * "horizontal-scrollbar-active" vs "horizontal-scroll-bar-track-arrows"),
 * so these generic lookups use structured sourceCicnId metadata. The runtime
 * matches its absolute value for compatibility with signed corpus aliases;
 * diagnostics preserve the actual sign instead of claiming an original alias.
 */
interface ResolvedFaceMetadata { consumedCinf?: CinfLookupView; theme: LoadedTheme; element: ChromeElement; key: string; chainDepth: number; }
interface ResolvedControlFace extends ResolvedFaceMetadata { declaredCinf?: NonNullable<ReturnType<typeof snapshotBodyCinfFace>>; buffer: PixelBuffer; loadedIdentity?: Pick<LegacyFacePaint, 'owner' | 'resource'>; }
type TraceLookup = Pick<ControlResolutionStep, 'role' | 'basis' | 'usage'>;
const FACE_LOOKUP: TraceLookup = { role: 'face', basis: 'source-dispatch', usage: 'paint' };

function resourceIdentity(hit: ResolvedFaceMetadata): Extract<NonNullable<ControlResolutionStep['resource']>, { type: 'cicn' }> {
  return { type: 'cicn', signedId: Number.isInteger(hit.element.sourceCicnId) ? hit.element.sourceCicnId! : null,
    sourceCinfId: Number.isInteger(hit.element.sourceCinfId) ? hit.element.sourceCinfId! : null, manifestKey: hit.key,
    assetUrl: assetUrl(hit.theme, hit.element.asset),
    ...(hit.consumedCinf ? { consumedCinf: hit.consumedCinf } : {}),
    ...(hit.element.byteProvenance ? { byteProvenance: hit.element.byteProvenance } : {}) };
}

function traceHit(trace: ControlTraceCollector | undefined, lookup: TraceLookup, id: number,
  hit: ResolvedFaceMetadata, action: 'selected' | 'rejected', reason: string): void {
  trace?.record({ ...lookup, requestedId: -Math.abs(id), action, reason,
    owner: { baseUrl: hit.theme.baseUrl, chainDepth: hit.chainDepth }, resource: resourceIdentity(hit) });
}

function traceOwner(trace: ControlTraceCollector | undefined, lookup: TraceLookup, id: number,
  theme: LoadedTheme, chainDepth: number, action: 'missing' | 'fallback', reason: string): void {
  trace?.record({ ...lookup, requestedId: -Math.abs(id), action, reason,
    ...(action === 'fallback' ? { basis: 'compatibility-policy' as const } : {}),
    owner: { baseUrl: theme.baseUrl, chainDepth } });
}

function traceFallback(trace: ControlTraceCollector | undefined, id: number, reason: string,
  lookup: TraceLookup = { ...FACE_LOOKUP, basis: 'compatibility-policy' }): void {
  trace?.record({ ...lookup, requestedId: -Math.abs(id), action: 'fallback', reason });
}

function resolveFaceById(theme: LoadedTheme, id: number, trace?: ControlTraceCollector,
  lookup: TraceLookup = FACE_LOOKUP): ResolvedFaceMetadata | undefined {
  let chainDepth = -1;
  return resolveInChain(theme, (t) => {
    chainDepth++;
    if (chainDepth > 0) traceOwner(trace, lookup, id, t, chainDepth, 'fallback', 'base-inheritance');
    const entry = elementEntryById(t, id);
    if (!entry) { traceOwner(trace, lookup, id, t, chainDepth, 'missing', 'missing-resource'); return null; }
    const hit = { theme: t, element: entry[1], key: entry[0], chainDepth };
    traceHit(trace, hit.element.sourceCicnId! > 0 ? { ...lookup, basis: 'compatibility-policy' } : lookup,
      id, hit, 'selected', hit.element.sourceCicnId! > 0 ? 'positive-id-alias' : 'resource-id');
    return hit;
  });
}

/** Capture the actual requested asset and scalar identity before its decode
 * await. Diagnostics must not relabel that buffer after consumer metadata edits. */
async function loadResolvedFace(hit: ResolvedFaceMetadata, trace?: ControlTraceCollector): Promise<ResolvedControlFace> {
  const declaredCinf = snapshotBodyCinfFace(hit.theme.manifest, hit.element);
  if (declaredCinf) hit = { ...hit, element: { ...hit.element } };
  const url = assetUrl(hit.theme, hit.element.asset);
  const resource = trace ? resourceIdentity(hit) : undefined;
  const loadedIdentity = resource ? {
    owner: { baseUrl: hit.theme.baseUrl, chainDepth: hit.chainDepth },
    resource: { ...resource, assetUrl: url, ...(resource.byteProvenance ? { byteProvenance: { ...resource.byteProvenance } } : {}) },
  } : undefined;
  return { ...hit, ...(declaredCinf ? { declaredCinf } : {}), buffer: await loadCicnBuffer(url), ...(loadedIdentity ? { loadedIdentity } : {}) };
}

/** Select a prepared role view without mutating common element/local pair facts. */
function declaredBodyFace(root: LoadedTheme, face: ResolvedControlFace, requestedId: number, label: string,
  defaultRing: boolean, trace?: ControlTraceCollector): ResolvedControlFace {
  const environment = face.declaredCinf?.environment ?? root.manifest.cinfEnvironment;
  if (!environment) return face;
  const view = face.declaredCinf?.view;
  const reject = (reason: string): never => {
    trace?.record({ role: 'face', usage: 'admission', basis: 'compatibility-policy', action: 'rejected',
      requestedId, reason, ...(view ? { cinfLookup: lookupOnly(view) } : {}) });
    throw new CinfEnvironmentError(reason, 'UNSUPPORTED_CINF_ENVIRONMENT');
  };
  if (root.base || face.chainDepth !== 0 || face.theme !== root) reject('cinf-environment-base-inheritance');
  if (defaultRing) reject('cinf-environment-default-ring-unsupported');
  if (face.element.sourceCicnId !== requestedId) reject('cinf-environment-requested-selected-id-mismatch');
  if (!view || view.bindingId !== environment.bindingId || view.requestedId !== requestedId) reject('cinf-environment-role-binding-missing');
  const consumed = lookupOnly(view!);
  if (view!.status === 'unsupported') reject(view!.reason ?? 'cinf-environment-unknown');
  if (!ownerDisplayPolicyMatches(face.theme.manifest, view!.displayPolicy)) reject('cinf-environment-display-policy-mismatch');
  if (view!.status === 'no-body-or-border') {
    if (label.length) reject('cinf-environment-text-outputs-unavailable');
  } else {
    const metadata = view!.metadata;
    if (!metadata?.slice || !metadata.bodyRequest) reject('cinf-environment-metadata-unavailable');
    if (metadata!.bodyRequest!.mode === 5) reject('cinf-environment-mode5-unsupported');
    if (label.length && (!metadata!.colorSamples?.text || metadata!.colorSamples.embossDecision === 'unknown'))
      reject('cinf-environment-text-sampling-unavailable');
  }
  trace?.record({ role: 'face', usage: 'admission', basis: 'compatibility-policy', action: view!.status === 'ready' ? 'selected' : 'missing',
    requestedId, reason: view!.status === 'ready' ? 'declared-cinf-role-view' : 'declared-cinf-two-null-skip',
    owner: { baseUrl: face.theme.baseUrl, chainDepth: 0 }, cinfLookup: consumed });
  return { ...face, consumedCinf: consumed, element: view!.status === 'ready' ? { ...face.element, ...view!.metadata } : face.element };
}
function lookupOnly(view: NonNullable<ChromeElement['bodyCinf']>): CinfLookupView {
  const { metadata: _metadata, ...lookup } = view;
  return lookup;
}

async function loadFaceById(theme: LoadedTheme, id: number, trace?: ControlTraceCollector,
  lookup: TraceLookup = FACE_LOOKUP): Promise<ResolvedControlFace | null> {
  const hit = resolveFaceById(theme, id, trace, lookup);
  return hit ? loadResolvedFace(hit, trace) : null;
}

async function loadById(theme: LoadedTheme, id: number): Promise<PixelBuffer | null> {
  return (await loadFaceById(theme, id))?.buffer ?? null;
}

/** Self-only art lookup retained by the disclosure compatibility path. */
async function loadByIdSelf(theme: LoadedTheme, id: number): Promise<PixelBuffer | null> {
  const el = elementById(theme, id);
  return el ? loadCicnBuffer(assetUrl(theme, el.asset)) : null;
}

async function loadGlyphByIdSelf(theme: LoadedTheme, id: number): Promise<PixelBuffer | null> {
  const asset = theme.glyphs?.[String(id)];
  return asset ? loadCicnBuffer(assetUrl(theme, asset)) : null;
}

/** SELF-ONLY variant of {@link loadByKey}: a scheme's own chromeElement by key,
 *  no base-chain walk. */
async function loadByKeySelf(theme: LoadedTheme, key: string): Promise<PixelBuffer | null> {
  const asset = theme.manifest.chromeElements?.[key]?.asset;
  return asset ? loadCicnBuffer(assetUrl(theme, asset)) : null;
}

/** Apple's documented push-button standard height. Per `docs/spec/apple-primary-source.md`
 *  Control metrics (Inside Macintosh: Mac OS 8 Appearance, `kThemeMetricPushButtonHeight`).
 *  The kDEF / Appearance Manager renders push-button faces at this height regardless
 *  of the cicn's native dimensions — the artist authors a face cicn at WHATEVER size
 *  fits their tile pattern, and the OS 9-slices it down to the standard control height.
 *  Used as the upper bound when `opts.height` isn't specified: small (≤28 px) cicns
 *  pass through unchanged; oversized (>28 px) cicns clamp to this metric so themes
 *  like `crayon-os` (74×74 face, 80×80 ring, 70×70 bevel + finder-header) don't blow
 *  buttons up to ~80 px in any UI context expecting a normal-height control. */
const APPLE_PUSH_BUTTON_HEIGHT = 20;

/** Maximum cicn height before the clamp kicks in (≈1.4× Apple's 20-px metric).
 *  Below this, we trust the artist's authored dimensions; above this, the cicn
 *  is clearly meant to be 9-sliced to the standard control height. */
const APPLE_REASONABLE_FACE_MAX = 28;

/** Standard control-height resolver. Caller-specified `height` always wins
 *  (context-specific sizing: the demo's Options dialog passes 22 to match the
 *  segmented On/Off tab height). Otherwise: pass through small cicns; clamp
 *  oversized ones to Apple's metric. Citation: `docs/spec/apple-primary-source.md`
 *  "Control metrics" + the discussion in `docs/spec/apple-cdef-button-vs-our-compose.md`
 *  about per-scheme face-height variance. */
function resolveControlHeight(face: PixelBuffer, optsHeight?: number): number {
  if (optsHeight != null) return optsHeight;
  return face.height <= APPLE_REASONABLE_FACE_MAX ? face.height : APPLE_PUSH_BUTTON_HEIGHT;
}

/** Exact signed push art selected by the engine's state table. */
export async function loadPushButtonFace(theme: LoadedTheme, state: 'active' | 'pressed' | 'inactive'): Promise<PixelBuffer | null> {
  return loadEnginePushFace(theme, state);
}

/** The chromeElement whose asset encodes resource `id` (for textAnchor etc).
 *  Uses the explicit `sourceCicnId` field the decoder writes on every chromeElement
 *  (matched against |id| — the same id can appear with either sign in different
 *  schemes). Previously parsed the resource id out of the `asset` PATH STRING; that
 *  broke under Option A's in-memory load path, where `rewriteAssetRefs` replaces
 *  paths with `blob:` URLs (the regex `/cicn-n?-?(\d+)/` finds no match against a
 *  blob URL → every elementById call returned null → buttons / default-rings /
 *  textAnchors silently un-themed). `sourceCicnId` is the decoder's own field, lives
 *  in `theme.json`, survives the URL rewrite, and is what `lint-themes` reads too. */
function elementById(theme: LoadedTheme, id: number) {
  return elementEntryById(theme, id)?.[1];
}

function elementEntryById(theme: LoadedTheme, id: number): [string, ChromeElement] | undefined {
  const abs = Math.abs(id);
  const elements = theme.manifest.chromeElements ?? {};
  for (const key of Object.keys(elements)) {
    const element = elements[key]!;
    if (typeof element.sourceCicnId === 'number' && Math.abs(element.sourceCicnId) === abs) return [key, element];
  }
  return undefined;
}

export type Orientation = 'horizontal' | 'vertical';
export type ControlState = 'normal' | 'pressed' | 'disabled' | 'inactive';

export interface ScrollbarOptions {
  orientation?: Orientation;
  /** Length along the scroll axis, in px. The bar is 16 px thick (Apple's standard scroll bar). */
  length?: number;
  /** Thumb position, 0..1. */
  value?: number;
  /**
   * Accepted for compatibility; no effect. The 2.3.1 CDEF sizes the thumb from
   * its cicn unless a Kaleidoscope option byte and a Finder window both say
   * otherwise, and the engine runs with those declared off
   * (docs/spec/engine/scrollbar.md §2, §5.6).
   */
  thumbExtent?: number;
  /** Accepted for compatibility; no effect (see `thumbExtent`). */
  proportional?: boolean;
  state?: ControlState;
  /**
   * The part being pressed when `state` is `'pressed'` (DECISIONS #4): native
   * part 20 `up`, 21 `down`, 22 `pageUp`, 23 `pageDown`, 129 `thumb`. Pressed
   * without a part means `thumb`. Ignored for other states.
   */
  pressedPart?: 'up' | 'down' | 'pageUp' | 'pageDown' | 'thumb';
}

/** @internal A composed scroll bar plus its part test (scrollbar §4.8). */
export interface ScrollbarFrame {
  buffer: PixelBuffer;
  /** Public part name at buffer pixel (x, y), or null for part 0 (outside / disabled). */
  partAt(x: number, y: number): NonNullable<ScrollbarOptions['pressedPart']> | null;
  trace?: EngineTrace;
}

/**
 * Compose a scroll bar on the v2 engine: the Kaleidoscope 2.3.1 scroll-bar CDEF
 * (docs/spec/engine/scrollbar.md; driver src/engine/families/scrollbar.ts)
 * drawing into a port whose control rect is the whole buffer.
 *
 * Returns null when the theme chain has no track cicn at the selected tier
 * (TR10): the facade then leaves the bar to the caller's procedural fallback,
 * a compatibility policy for art-less themes.
 */
export async function composeScrollbar(
  theme: LoadedTheme,
  opts: ScrollbarOptions = {},
): Promise<PixelBuffer | null> {
  return (await composeScrollbarFrame(theme, opts))?.buffer ?? null;
}

/** @internal Shared draw path for the interactive scroll bar's hit test. */
export async function composeScrollbarFrame(
  theme: LoadedTheme,
  opts: ScrollbarOptions & { trace?: boolean } = {},
): Promise<ScrollbarFrame | null> {
  const horizontal = (opts.orientation ?? 'vertical') === 'horizontal';
  const length = Math.max(16, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0));
  const { hilite } = normalizeControlState({ state: opts.state ?? 'normal', ...(opts.pressedPart ? { pressedPart: opts.pressedPart } : {}) },
    SCROLLBAR_PRESSED_PARTS);
  const t = SCROLLBAR_FACADE_THICKNESS.thickness;
  const range = SCROLLBAR_FACADE_RANGE;
  const input: ScrollbarInput = {
    rect: horizontal ? rect(0, 0, t, length) : rect(0, 0, length, t),
    hilite, min: range.min, max: range.max, value: range.min + Math.round(value * (range.max - range.min)),
  };
  const chain = await themeResourceChain(theme, scrollbarResourceIds(horizontal));
  const trace = opts.trace ? createTrace('scrollbar', { ...input }) : undefined;
  const out = PixelBuffer.alloc(input.rect.right, input.rect.bottom);
  const { geometry } = drawScrollbar(out, chain, input, trace);
  if (!geometry.trackCicn) return null;
  const names = Object.entries(SCROLLBAR_PRESSED_PARTS.parts);
  return {
    buffer: out,
    partAt: (x, y) => {
      const { part } = scrollbarPartAt(geometry, { x, y });
      return (names.find(([, code]) => code === part)?.[0] ?? null) as NonNullable<ScrollbarOptions['pressedPart']> | null;
    },
    ...(trace ? { trace } : {}),
  };
}

export interface SliderOptions {
  orientation?: Orientation;
  /** Length along the slider axis, in px (minimum 32). */
  length?: number;
  /** Thumb position, 0..1 (native 0..100, rounded; minimum at the left / bottom). */
  value?: number;
  state?: ControlState;
  /**
   * The part being pressed when `state` is `'pressed'` (DECISIONS #9): native
   * part 129 `thumb`, 22 `pageUp`, 23 `pageDown`. Pressed without a part means
   * `thumb`. A page press draws the pressed track with the normal thumb.
   * Ignored for other states.
   */
  pressedPart?: 'thumb' | 'pageUp' | 'pageDown';
  /**
   * Slider variant (Appearance HISlider.h variation bits; slider §1.1, §5.1):
   * `'nonDirectional'` (default, variation bit 3, group 2, centred band),
   * `'pointsDownOrRight'` (no bit, group 0, band at the top / left) or
   * `'pointsUpOrLeft'` (bit 2, group 1, band at the bottom / right).
   */
  variant?: 'nonDirectional' | 'pointsDownOrRight' | 'pointsUpOrLeft';
  /**
   * Tick-mark count (variation bit 1; slider §4.6). Directional variants only:
   * the 2.3.1 CDEF draws no ticks for the non-directional variant (ID4).
   */
  tickMarks?: number;
  /** Control rect cross size in px. Default 16, or 32 with tick marks on a directional variant (facade policy). */
  thickness?: number;
  /**
   * The colour R is erased to before the art is drawn (slider O3/O4; the
   * 2.3.1 CDEF repaints the whole control rect opaque). Default white.
   */
  background?: { r: number; g: number; b: number };
}

/** @internal A composed slider plus its part test and tracking (slider §4.9, §5.6). */
export interface SliderFrame extends SliderComposition {
  /** Public part name at buffer pixel (x, y), or null for part 0 (outside the band). */
  partAt(x: number, y: number): NonNullable<SliderOptions['pressedPart']> | null;
  trace?: EngineTrace;
}

/**
 * Compose a slider on the v2 engine: the Kaleidoscope 2.3.1 slider CDEF 3
 * (docs/spec/engine/slider.md; driver src/engine/families/slider.ts) drawing
 * into a port whose control rect is the whole buffer.
 *
 * Returns null when the gate hands the control off to the System slider (G2:
 * the theme chain has no slider `cinf`); callers then draw the procedural
 * Platinum slider, the declared substitute (slider §6 item 3).
 */
export async function composeSlider(
  theme: LoadedTheme,
  opts: SliderOptions = {},
): Promise<PixelBuffer | null> {
  return (await composeSliderWithLayout(theme, opts))?.buffer ?? null;
}

/** @internal Shared draw path for native-backed slider hit testing. */
export async function composeSliderWithLayout(
  theme: LoadedTheme,
  opts: SliderOptions & { trace?: boolean } = {},
  signal?: AbortSignal,
): Promise<SliderFrame | null> {
  const orientation = opts.orientation ?? 'horizontal';
  const horiz = orientation === 'horizontal';
  const length = Math.max(32, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0.5));
  // Declared group2 layout environment (slider-layout-cinf.md): its admission
  // rules still apply; the geometry itself now comes from the engine (§5.2).
  const endpoint = snapshotSliderLayoutCinf(theme.manifest, elementById(theme, horiz ? 10129 : 10113), orientation);
  const unsupported = (reason: string): never => {
    throw new CinfEnvironmentError(`Unsupported group2 slider layout: ${reason}`, 'UNSUPPORTED_CINF_ENVIRONMENT');
  };
  if (endpoint && (endpoint.status !== 'ready' || endpoint.corner === undefined)) unsupported(endpoint.reason ?? 'missing corner');
  if (endpoint && (theme.base || !Number.isInteger(length) || length > 32767 || !Number.isFinite(value))) unsupported('base chain or geometry outside admitted local Rect');

  const V = SLIDER_VARIATION;
  const variant = opts.variant ?? 'nonDirectional';
  const ticks = variant !== 'nonDirectional' && (opts.tickMarks ?? 0) > 1 ? Math.trunc(opts.tickMarks!) : 0;
  const variation = (variant === 'nonDirectional' ? V.nonDirectional : variant === 'pointsUpOrLeft' ? V.reverse : 0) | (ticks ? V.tickMarks : 0);
  const cross = Math.max(1, Math.trunc(opts.thickness ?? (ticks ? SLIDER_FACADE_THICKNESS.withTicks : SLIDER_FACADE_THICKNESS.plain)));
  // The engine reads a square or taller rect as vertical (§2): keep the axis the caller asked for.
  const along = Math.max(length, cross + 1);
  const { hilite } = normalizeControlState({ state: opts.state ?? 'normal', ...(opts.pressedPart ? { pressedPart: opts.pressedPart } : {}) },
    SLIDER_PRESSED_PARTS);
  const range = SLIDER_FACADE_RANGE;
  const native = range.min + Math.round(value * (range.max - range.min));
  const R = horiz ? rect(0, 0, cross, along) : rect(0, 0, along, cross);
  const input: SliderInput = { rect: R, hilite, min: range.min, max: range.max, value: native, variation };
  if (signal?.aborted) return null;
  const chain = await themeResourceChain(theme, sliderResourceIds(horiz), signal ? { signal } : {});
  if (signal?.aborted) return null;
  const trace = opts.trace ? createTrace('slider', { ...input, ticks }) : undefined;
  // Message 3 (init) creates the record and sets the tick count; the host then sets the value.
  const init = sliderInit(chain, { ...input, value: range.min }, ticks, trace);
  if (!init) return endpoint ? unsupported('handed off (no slider cinf)') : null;
  const out = PixelBuffer.alloc(R.right, R.bottom);
  const bg = opts.background ?? SLIDER_FACADE_BACKGROUND;
  const { state } = drawSlider(out, chain, init.record, input, { background: { r: bg.r, g: bg.g, b: bg.b, a: 255 } }, trace);
  if (!state) return endpoint ? unsupported('handed off (no slider cinf)') : null;
  const Th = state.Th && !(state.Th.right <= state.Th.left || state.Th.bottom <= state.Th.top) ? state.Th : null;
  const c = state.c ?? 0, travel = Math.max(0, init.record.travel ?? 0);
  if (endpoint && (!Th || (init.record.travel ?? -1) < 0)) unsupported('thumb geometry or travel outside admitted local Rect');
  if (endpoint) {
    // slider-layout-cinf.md admission, kept until the declared environment becomes
    // the chain's cinf tier: the declared corner must be the corner the chain
    // resolved (never silently select other geometry), and the thumb must hold four
    // exact 16-px cross cells.
    if (endpoint.corner !== state.c) unsupported('declared corner differs from the resource-chain corner');
    const pm = state.thumb!.value.pixmap, cell = SLIDER_THUMB.TH3.cellSize, cells = SLIDER_THUMB.TH5.ghostCell + 1;
    if ((horiz ? pm.height : pm.width) !== cells * cell) unsupported('thumb cross-cell is not 16 px');
  }
  const names = Object.entries(SLIDER_PRESSED_PARTS.parts);
  return {
    buffer: out,
    layout: {
      orientation, axisLength: along,
      thumb: Th ? { x: Th.left, y: Th.top, w: Th.right - Th.left, h: Th.bottom - Th.top } : null,
      // TRK4 (modern pointer policy): with a thumb the travel is [c, c + T); without one the
      // whole axis, with no corner inset (a track click maps over the full length).
      travelStart: Th ? c : 0, travelEnd: Th ? c + travel : along, value,
      valueDirection: horiz ? 1 : -1,
      ...(endpoint ? { endpointPolicy: 'declared-group2' as const } : {}),
    },
    partAt: (x, y) => {
      const { part } = sliderPartAt(state, { x, y });
      return (names.find(([, code]) => code === part)?.[0] ?? null) as NonNullable<SliderOptions['pressedPart']> | null;
    },
    ...(trace ? { trace } : {}),
  };
}

export interface DisclosureOptions {
  direction?: 'right' | 'down';
  state?: ControlState;
}

/**
 * Compose a disclosure triangle: a fixed state glyph, stamped 1:1.
 *
 * SELF-ONLY (like composeCheckable / composeSlider): a scheme draws its OWN
 * disclosure triangle or falls to the procedural Platinum one — it does not
 * inherit the base bundle's (the replica ships -9990/-9991 triangles that would
 * otherwise leak into every cicn-less scheme via the chain). Resolution order on
 * the scheme itself: (1) the named disclosure chromeElement (texture schemes),
 * (2) the canonical kDEF id family -10102..-10112 (right/down × normal/pressed/
 * inactive; no corpus scheme ships it as a cicn today, kept for completeness),
 * (3) the scheme's OWN ics4 triangle pictogram. apple-platinum-2 is the only
 * corner-sprite scheme that ships a disclosure triangle: a pixel-VERIFIED clean
 * pair under the NON-canonical positive ics4 ids 3060 (right/collapsed) and 3061
 * (down/expanded) — wired here by id. platinum-8 + system7-nostalgia-silver ship
 * none → procedural Platinum.
 */
export async function composeDisclosure(
  theme: LoadedTheme,
  opts: DisclosureOptions = {},
): Promise<PixelBuffer | null> {
  const dir = opts.direction ?? 'right';
  const state = opts.state ?? 'normal';
  const prefix = state === 'pressed' ? 'pressed-' : state === 'disabled' || state === 'inactive' ? 'inactive-' : '';
  // note: the bundle has a typo "tringle" for inactive-right
  const keys = [
    `${prefix}${dir}-pointing-disclosure-triangle`,
    `${prefix}${dir}-pointing-disclosure-tringle`,
    `${dir}-pointing-disclosure-triangle`,
  ];
  for (const k of keys) {
    const g = await loadByKeySelf(theme, k);
    if (g) return g;
  }
  // Canonical kDEF disclosure-triangle id family (docs/spec/kdef231-reference.md
  // §2.6): -10102..-10112, right/down × normal/pressed/inactive (rows of 5 per
  // the period doc; we map only the normal right/down here, which is all the
  // renderer needs). Resolved self-only as a cicn, then as an ics4 glyph.
  const canonical = dir === 'right' ? 10102 : 10103;
  const byId = (await loadByIdSelf(theme, canonical)) ?? (await loadGlyphByIdSelf(theme, -canonical));
  if (byId) return byId;
  // apple-platinum-2's pixel-verified own triangles (non-canonical positive ics4
  // ids — see the doc-comment). 3060 = right/collapsed, 3061 = down/expanded.
  return loadGlyphByIdSelf(theme, dir === 'right' ? 3060 : 3061);
}

export interface TabOptions {
  label?: string;
  /** Opt-in actual selection/paint decisions; no historical typography claim. */
  diagnostics?: ControlDiagnostics;
  /** The SELECTED tab uses the "front"/"on" cicn (taller, raised); an
   *  unselected tab uses the shorter "rear"/"off" cicn. */
  selected?: boolean;
}

/**
 * Compose one segmented TAB (e.g. an On|Off pair) from the scheme's tab cicns.
 * Selected = the "front"/"on" tab (`-9972` SSF small / `-9980` LSF large — the
 * taller, raised trapezoid); unselected = the shorter "rear"/"off" tab
 * (`-9975` / `-9983`). Supported cinf bodies use CDEF 8 full-height end strips
 * and independent bands/solid center. Unsupported bodies retain the legacy
 * three-slice compatibility path. Returns null when the
 * scheme ships no tab cicn (caller falls back to a CSS segmented control).
 *
 * NB: this is NOT the popup-menu tab `-12319` (a different control that no
 * corpus scheme ships) — the segmented tab control is the `-998x` family
 * (SSF/LSF front/rear tabs + tab pane). See docs/spec/kdef231-reference.md.
 */
export async function composeTab(theme: LoadedTheme, opts: TabOptions = {}): Promise<PixelBuffer | null> {
  return withControlDiagnostics(opts.diagnostics, 'tab', {
    state: 'active', pressed: false, disabled: false, selected: !!opts.selected,
  }, trace => composeTabWithTrace(theme, opts, trace));
}

async function composeTabWithTrace(theme: LoadedTheme, opts: TabOptions, trace?: ControlTraceCollector): Promise<PixelBuffer | null> {
  const lookup: TraceLookup = { ...FACE_LOOKUP, basis: 'compatibility-policy' };
  const ids = opts.selected ? [9972, 9980] : [9975, 9983]; // small then large; front/rear
  let face: ResolvedControlFace | null = null;
  for (const [index, id] of ids.entries()) {
    if (index > 0) traceFallback(trace, id, 'tab-small-to-large', lookup);
    face = await loadFaceById(theme, id, trace, lookup);
    if (face) break;
  }
  if (!face) return null;
  const tab = face.buffer;
  const b = opaqueBounds(tab);
  if (b.x1 < b.x0 || b.y1 < b.y0) return null;
  const bw = b.x1 - b.x0 + 1;
  const bh = b.y1 - b.y0 + 1;

  // Retained compatibility typography: CDEF 8 has authored text/emboss
  // samples and data-driven fonts, but those separate rules are not implemented
  // by this body correction. Do not infer original text color from contrast.
  const cx = (b.x0 + b.x1) >> 1;
  const cy = (b.y0 + b.y1) >> 1;
  const [fr, fgc, fbc] = tab.getPixel(cx, cy);
  const faceLum = 0.299 * fr + 0.587 * fgc + 0.114 * fbc;
  const fg = faceLum < 128 ? '#ffffff' : '#000000';

  const label = opts.label ?? '';
  const glyphs = label ? rasterizeText(label, Math.max(8, Math.round(bh * 0.42)), fg) : null;
  // Prefer cinf-declared slice.corner for the end-cap thickness; fall back to the
  // historical clamp when no cinf was shipped. Same shape as composeFaceButton /
  // the cinf-driven controls — read the artist's authored answer rather than the heuristic.
  const tabEl = face.element;
  const cap = tabEl?.slice?.corner ?? Math.max(2, Math.min(12, Math.floor((bw - 1) / 2)));
  const labelWidth = (glyphs ? glyphs.width : 0) + cap * 2 + 6;
  const body = composeTabBody(tab, tabEl, Math.max(tab.width, labelWidth), trace?.tabBody, face.theme.manifest);
  if (body) {
    // Preserve the previous glyph size and vertical offset; source body height
    // is independent of that still-unverified typography policy.
    if (glyphs) body.drawOver(glyphs, Math.round((body.width - glyphs.width) / 2), Math.round((bh - glyphs.height) / 2) + 1);
    return body;
  }
  // Missing cinf/safe background or a positive pattern-backed center retains
  // the old compatibility compositor until its separate contract is supported.
  const outW = Math.max(bw, labelWidth);
  const out = PixelBuffer.alloc(outW, bh);
  const tileMiddle = !!tabEl?.slice?.tile;

  // 3-slice the tab box across its width: fixed ends 1:1, stretched OR tiled middle
  // depending on the cinf slice.tile flag. Crayon-os's tab cicns ship slice.tile:true
  // so the artist's pixel-rate pattern is preserved instead of smeared.
  out.copyBits(tab, { x: b.x0, y: b.y0, w: cap, h: bh }, { x: 0, y: 0, w: cap, h: bh });
  out.copyBits(tab, { x: b.x1 - cap + 1, y: b.y0, w: cap, h: bh }, { x: outW - cap, y: 0, w: cap, h: bh });
  const midSrcW = bw - cap * 2;
  const midDstW = outW - cap * 2;
  if (midSrcW > 0 && midDstW > 0) {
    if (tileMiddle) {
      // Repeat the source middle band 1:1 across the destination.
      for (let tx = 0; tx < midDstW; tx += midSrcW) {
        const w = Math.min(midSrcW, midDstW - tx);
        out.copyBits(tab, { x: b.x0 + cap, y: b.y0, w, h: bh }, { x: cap + tx, y: 0, w, h: bh });
      }
    } else {
      out.copyBits(tab, { x: b.x0 + cap, y: b.y0, w: midSrcW, h: bh }, { x: cap, y: 0, w: midDstW, h: bh });
    }
  }
  // The body label sits slightly below center (the trapezoid's top is the bevel).
  if (glyphs) out.drawOver(glyphs, Math.round((outW - glyphs.width) / 2), Math.round((bh - glyphs.height) / 2) + 1);
  return out;
}

/**
 * Compose a window grow box (the bottom-right resize control) from the
 * scheme's cicn — active -14333 (apple-platinum-2 uses -14330) /
 * inactive -14334. Stamped 1:1 (it's a fixed-size corner glyph, 15–20px).
 * Returns null when the scheme ships no grow box (→ caller's CSS fallback).
 */
export async function composeGrowBox(
  theme: LoadedTheme,
  opts: { state?: ControlState } = {},
): Promise<PixelBuffer | null> {
  const inactive = opts.state === 'inactive';
  if (inactive) return loadById(theme, 14334);
  return (await loadById(theme, 14333)) ?? (await loadById(theme, 14330));
}

export interface ProgressOptions {
  /** Bar width in px (facade policy: at least 16, default 160). The bar is always 14 px tall (progress RECT1). */
  length?: number;
  /**
   * Normalized fill, 0..1 (compatibility facade, DECISIONS #10): clamped, then
   * mapped to native `min = 0`, `max = 10000`, `value = trunc(v × 10000)`.
   * Default 0.5. Passing both `value` and `range` throws a `TypeError` (DECISIONS #10).
   */
  value?: number;
  /**
   * Native control values (DECISIONS #10): 16-bit signed integers, unclamped, as
   * CDEF 5 reads them (progress §5.3, DET2, DET3). A value outside `[min, max]`
   * moves the split past the track, and the trace records the overflow.
   */
  range?: { value: number; min: number; max: number };
  /** `'pressed'` draws as `'normal'` (no pressed art); `'disabled'` draws as `'inactive'` (hilite 255 / 254). */
  state?: ControlState;
  /** Indeterminate mode (DECISIONS #11; the `'inde'` flag, progress §4.7). */
  indeterminate?: boolean;
  /** The stored phase byte at draw time, integer 0..255 (DECISIONS #11). Default 0. */
  phase?: number;
}

/** A composed progress bar plus the phase byte after the draw (frame mode resets it, IND2/IND3). */
export interface ProgressFrame {
  buffer: PixelBuffer;
  phase: number;
  /** `kaleidoscope` (the scheme's art, GATE4) or `procedural` (CDEF 5's own bar, §4.9). */
  path: 'kaleidoscope' | 'procedural';
  trace?: EngineTrace;
}

/**
 * Compose a progress bar on the v2 engine: the Kaleidoscope 2.3.1 progress bar
 * CDEF 5 (docs/spec/engine/progress.md; driver src/engine/families/progress.ts)
 * drawing into a transparent 14-row port whose control rect is the whole buffer.
 * CDEF 5 always draws: the scheme's art when it ships `cinf`/`cicn −10080`, else
 * its own procedural bar. Pixels no step covers stay transparent (ERASE3).
 */
export async function composeProgress(theme: LoadedTheme, opts: ProgressOptions = {}): Promise<PixelBuffer> {
  return (await composeProgressFrame(theme, opts)).buffer;
}

const int16 = (name: string, v: number): number => {
  const D = PROGRESS_VALUE_DOMAIN;
  if (!Number.isInteger(v) || v < D.min || v > D.max) throw new RangeError(`composeProgress: range.${name} must be a 16-bit signed integer`);
  return v;
};

/** Compose one progress frame (DECISIONS #11): draws once and reports the phase after the draw. */
export async function composeProgressFrame(theme: LoadedTheme, opts: ProgressOptions & { trace?: boolean } = {}): Promise<ProgressFrame> {
  const length = Math.max(PROGRESS_FACADE_LENGTH.min, Math.trunc(opts.length ?? PROGRESS_FACADE_LENGTH.default));
  const phase = opts.phase ?? 0;
  if (!Number.isInteger(phase) || phase < 0 || phase >= PROGRESS_IDLE.phaseModulo) throw new RangeError('composeProgress: phase must be an integer 0..255');
  let native: { value: number; min: number; max: number };
  if (opts.range && opts.value !== undefined) throw new TypeError('composeProgress: pass either value or range, not both (DECISIONS #10)');
  if (opts.range) native = { value: int16('value', opts.range.value), min: int16('min', opts.range.min), max: int16('max', opts.range.max) };
  else {
    const F = PROGRESS_FACADE_RANGE, v = Math.min(1, Math.max(0, opts.value ?? PROGRESS_FACADE_VALUE.default));
    native = { value: F.min + Math.trunc(v * (F.max - F.min)), min: F.min, max: F.max };
  }
  const state = opts.state ?? 'normal';
  const row = PROGRESS_STATE.find(r => r.state === state);
  if (!row) throw new TypeError(`composeProgress: unknown state ${String(state)}`);
  const input: ProgressInput = { rect: rect(0, 0, PROGRESS_RECT.RECT1.height, length), hilite: row.hilite, ...native };
  const chain = await themeResourceChain(theme, progressResourceIds());
  const trace = opts.trace ? createTrace('progress', { ...input, indeterminate: !!opts.indeterminate, phase }) : undefined;
  const record = newProgressRecord(trace);
  progressSetData(record, PROGRESS_DATA.tag, [opts.indeterminate ? 1 : 0]);
  record.phase = phase;
  const out = PixelBuffer.alloc(length, PROGRESS_RECT.RECT1.height);
  const profile = theme.manifest.displayProfile;
  const realize = (rgb: readonly number[]) => { const [r, g, b] = realizeRgb16(rgb, profile); return { r: r!, g: g!, b: b!, a: 255 }; };
  const res = drawProgress(out, chain, record, input, { realize }, trace);
  return { buffer: out, phase: res.phase, path: res.path ?? 'procedural', ...(trace ? { trace } : {}) };
}

export interface ButtonOptions {
  /** Logical face/port coordinates. Omission applies local compatibility defaults, not known original state. */
  compositionContext?: ControlCompositionContext;
  /** Opt-in completed resource-resolution trace; does not certify fidelity. */
  diagnostics?: ControlDiagnostics;
  label?: string;
  /** Resolved nominal CSS pixel size, finite and >= 6. Compatibility default: 12, independent of face height; a supplied bitmapFont defaults to its strikeSize. */
  fontSize?: number;
  /** Opt-in caller-owned single-line strike. Explicit fontSize must match; no scaling or provider lookup. */
  bitmapFont?: PreparedBitmapFont;
  /** Request the kDEF-style control-painter ring; does not select a DialogManager default item or bind Return/Enter. */
  default?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  minWidth?: number;
  /** Force the button face height, including deliberately compact controls.
   *  Without an override, oversized templates use the standard 20px height;
   *  a template shorter than its label raster also uses 20px. Otherwise the
   *  native height is retained. Cinf slicing preserves the source border art. */
  height?: number;
  /** Override the authored foreground color; suppresses authored emboss. */
  fg?: string;
}

export interface BevelButtonOptions {
  /** Logical face/port coordinates. Omission applies local compatibility defaults, not known original state. */
  compositionContext?: ControlCompositionContext;
  /** Opt-in completed resource-resolution trace; does not certify fidelity. */
  diagnostics?: ControlDiagnostics;
  label?: string;
  /** Resolved nominal CSS pixel size, finite and >= 6. Compatibility default: 12, independent of face height. */
  fontSize?: number;
  on?: boolean;       // set / selected (latched)
  pressed?: boolean;  // momentary press
  disabled?: boolean;
  small?: boolean;
  minWidth?: number;
  /** Force the face height. Automatic sizing remains a runtime policy;
   * explicit cinf borders and supported pattern bodies use their source model. */
  height?: number;
  fg?: string;
}

interface FaceOptions { composition?: ControlCompositionSnapshot; signal?: AbortSignal | undefined; trace?: ControlTraceCollector | undefined; label?: string; bitmapRun?: BitmapGlyphRun; fontSize?: number; disabled?: boolean; minWidth?: number; fg?: string; padX?: number; width?: number; height?: number; align?: 'center' | 'left'; }

function buttonFontSize(value: number | undefined): number {
  const size = value === undefined ? 12 : value;
  if (!Number.isFinite(size) || size < 6) throw new RangeError('fontSize must be finite and at least 6 CSS pixels');
  return size;
}

function assertControlAlive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Control preparation aborted', 'AbortError');
}

type PreparedCicnBody = { kind: 'missing' | 'unsupported' } | { kind: 'ready'; buffer: PixelBuffer;
  sourceRect: { x: number; y: number; w: number; h: number }; side: number;
  step: ControlResolutionStep; copy: 'masked' | 'unmasked'; sourceAssetUrl: string; derivedPath?: string };

async function loadCicnBody(face: ResolvedControlFace, opts: FaceOptions, width: number, height: number,
  context: ControlCompositionSnapshot): Promise<PreparedCicnBody> {
  const request = face.element.bodyRequest!, binding = face.element.cicnBody;
  const common = { role: 'body-fill' as const, requestedId: request.resourceId, bodyMode: 5,
    requestedResourceType: 'cicn' as const, basis: 'compatibility-policy' as const, usage: 'paint' as const,
    owner: { baseUrl: face.theme.baseUrl, chainDepth: face.chainDepth } };
  const reject = (reason: string): PreparedCicnBody => {
    opts.trace?.record({ ...common, action: 'fallback', reason }); return { kind: 'unsupported' };
  };
  if (!Number.isInteger(request.resourceId) || request.resourceId < -32768 || request.resourceId > 32767
      || !face.element.slice || ![face.element.slice.corner, face.element.slice.side].every(v => Number.isInteger(v) && v >= 0 && v <= 255))
    return reject('cicn-body-invalid-request-or-slice');
  if (!binding || binding.model !== 'kaleidoscope-2.3.1-cicn-body-v1' || binding.selectionPolicy !== 'unique-same-face-owner'
      || binding.requestedId !== request.resourceId) return reject('cicn-body-binding-unavailable');
  if (binding.status === 'missing' && binding.reason === 'same-owner-resource-absent') {
    opts.trace?.record({ ...common, action: 'missing', reason: binding.reason }); return { kind: 'missing' };
  }
  if (binding.status !== 'ready') return reject(`cicn-body-${binding.status}:${binding.reason}`);
  const target = face.theme.manifest.chromeElements?.[binding.manifestKey], rect = binding.sourceRect;
  const side = face.element.slice?.side, corner = face.element.slice?.corner;
  if (!target || target.sourceCicnId !== request.resourceId || binding.reason !== 'unique-source-occurrence'
      || !ownerDisplayPolicyMatches(face.theme.manifest, binding.displayPolicy) || ![1, 2, 4, 8].includes(binding.pixelSize)
      || !rect || rect.x !== 0 || rect.y !== 0 || !Number.isInteger(rect.w) || rect.w <= 0 || rect.w !== target.width
      || !Number.isInteger(rect.h) || rect.h <= 0 || rect.h !== target.height
      || typeof binding.asset !== 'string' || !binding.asset
      || (binding.pixelSize === 1 ? binding.copy !== 'masked' || binding.asset !== target.asset || binding.derivedPath !== undefined
        : binding.copy !== 'unmasked' || !/^cicn-body\/[^/]+\.png$/.test(binding.derivedPath ?? ''))
      || !Number.isInteger(side) || side! < 0 || side! > 255 || !Number.isInteger(corner) || corner! < 0 || corner! > 255)
    return reject('cicn-body-invalid-source-binding');
  if (width - 2 * side! !== rect.w || height - 2 * side! !== rect.h) return reject('cicn-body-scaling-unsupported');
  const sourceRect = { ...rect }, inset = side!;
  let visible = false;
  for (let y = inset; y < height - inset && !visible; y++) for (let x = inset; x < width - inset; x++)
    if (controlPointVisible(context, x, y)) { visible = true; break; }
  if (!visible) return reject('cicn-body-outside-clip');
  // Snapshot the actual target, owner and URL before awaiting dependent decoding.
  const step: ControlResolutionStep = { ...common, action: 'selected', reason: 'same-owner-cicn-body-paint',
    resource: resourceIdentity({ theme: face.theme, element: target, key: binding.manifestKey, chainDepth: face.chainDepth }) };
  const url = assetUrl(face.theme, binding.asset), copy = binding.copy, derivedPath = binding.derivedPath;
  assertControlAlive(opts.signal);
  const buffer = await loadCicnBuffer(url);
  assertControlAlive(opts.signal);
  if (buffer.width !== sourceRect.w || buffer.height !== sourceRect.h) return reject('cicn-body-decoded-size-mismatch');
  for (let i = 3; i < buffer.data.length; i += 4)
    if (copy === 'unmasked' ? buffer.data[i] !== 255 : buffer.data[i] !== 0 && buffer.data[i] !== 255)
      return reject('cicn-body-alpha-mismatch');
  return { kind: 'ready', buffer, sourceRect, side: inset, step, copy, sourceAssetUrl: url, ...(derivedPath ? { derivedPath } : {}) };
}

async function loadBodyPattern(face: ResolvedControlFace, opts: FaceOptions, usage: 'paint' | 'admission' = 'paint'): Promise<{ buffer: PixelBuffer | null; solidFallback: boolean; selection?: ControlResolutionStep }> {
  const request = face.element.bodyRequest;
  if (!request) return { buffer: null, solidFallback: false }; // Legacy manifests have no observed raw request.
  const common = { role: 'body-fill' as const, requestedId: request.resourceId, bodyMode: request.mode,
    requestedResourceType: request.mode === 5 ? 'cicn' as const : 'ppat' as const,
    basis: 'compatibility-policy' as const, usage,
    owner: { baseUrl: face.theme.baseUrl, chainDepth: face.chainDepth } };
  if (!Number.isInteger(request.mode) || request.mode < 0 || request.mode > 255 || request.mode === 5 || !face.element.slice) {
    opts.trace?.record({ ...common, action: 'fallback', reason: request.mode === 5 ? 'cicn-body-not-implemented' : 'body-mode-or-geometry-not-implemented' });
    return { buffer: null, solidFallback: false };
  }
  const patterns = face.theme.manifest.patterns ?? {};
  let key: string | null = null;
  let selectionReason = 'unique-id-pattern-paint';
  // The loader carries its last decoded occurrence before numeric catalog keys
  // can reorder. Legacy links remain supported, but enumeration cannot recover
  // occurrence order for multiple otherwise-unbound candidates.
  const links = [
    [face.element.bodyPattern, 'carried-body-pattern-paint'],
    [face.element.bgPattern, 'legacy-linked-pattern-paint'],
  ] as const;
  const visited = new Set<string>();
  for (const [candidate, reason] of links) {
    if (!candidate || visited.has(candidate)) continue;
    visited.add(candidate);
    const linked = patterns[candidate];
    if (linked?.sourcePpatId === request.resourceId) { key = candidate; selectionReason = reason; break; }
    opts.trace?.record({ ...common, action: 'rejected', reason: 'linked-pattern-id-mismatch', ...(linked ? { resource: {
      type: 'ppat' as const, signedId: linked.sourcePpatId ?? null, sourceCinfId: null, manifestKey: candidate,
      assetUrl: assetUrl(face.theme, linked.asset), ...(linked.byteProvenance ? { byteProvenance: linked.byteProvenance } : {}),
    } } : {}) });
  }
  if (!key) {
    for (const candidate of Object.keys(patterns)) {
      if (patterns[candidate]!.sourcePpatId !== request.resourceId) continue;
      if (key !== null) {
        opts.trace?.record({ ...common, action: 'missing', reason: 'ambiguous-legacy-pattern-order' });
        return { buffer: null, solidFallback: false };
      }
      key = candidate;
    }
  }
  const pattern = key ? patterns[key] : undefined;
  if (!pattern) {
    opts.trace?.record({ ...common, action: 'missing', reason: 'same-face-owner-pattern-unavailable' });
    // Current same-owner lookup miss corresponds to the full-color solid path.
    // This is not proof of historical Resource Manager search ownership.
    const solidFallback = Number.isInteger(request.resourceId) && request.resourceId >= -32768 && request.resourceId <= 32767
      && [face.element.slice.corner, face.element.slice.side].every(value => Number.isInteger(value) && value >= 0 && value <= 255);
    return { buffer: null, solidFallback };
  }
  assertControlAlive(opts.signal);
  const url = assetUrl(face.theme, pattern.asset);
  // Capture actual owner/occurrence at the load boundary for completed header
  // paint reporting, without repeating resolution after asynchronous decoding.
  const selection: ControlResolutionStep | undefined = opts.trace ? { ...common, action: 'selected',
    reason: usage === 'admission' ? selectionReason.replace(/-paint$/, '-admission') : selectionReason,
    resource: { type: 'ppat', signedId: pattern.sourcePpatId ?? null, sourceCinfId: null, manifestKey: key!, assetUrl: url,
      ...(pattern.byteProvenance ? { byteProvenance: { ...pattern.byteProvenance } } : {}) } } : undefined;
  const buffer = await loadCicnBuffer(url);
  assertControlAlive(opts.signal);
  if (selection) opts.trace?.record(selection);
  return { buffer, solidFallback: false, ...(selection ? { selection } : {}) };
}

/**
 * Compose a button face and its label. For explicit cinf metadata with a valid
 * solid background sample, use kDEF 0x10fc0 → 0x107fe: fill the inset cross,
 * then paint square corners and independent masked edge bands. Full-color pattern bodies use the same
 * inset union with explicit port phase. Unsupported body modes and list headers
 * retain the legacy approximation pending separate call-site evidence. Text RGB/emboss use preserved samples
 * from 0x10922–0x10990; font metrics and browser alpha-over remain policies.
 */
async function composeFaceButton(
  resolved: ResolvedControlFace,
  opts: FaceOptions,
  geometry: 'button' | 'legacy-list-header' = 'button',
): Promise<PixelBuffer> {
  const label = opts.label ?? '';
  const { buffer: face, element: faceEl } = resolved;
  if (geometry === 'button' && resolved.consumedCinf?.status === 'no-body-or-border') {
    const width = opts.width ?? Math.max(opts.minWidth ?? 56, (opts.padX ?? 12) * 2), height = resolveControlHeight(face, opts.height);
    const context = opts.composition ?? snapshotControlComposition();
    opts.trace?.composition({ context, originalPortState: 'unverified', faceRect: { x: context.controlOrigin[0], y: context.controlOrigin[1], w: width, h: height },
      appliedUnknownPatternOffset: context.patternOrigin.status === 'unknown' });
    return PixelBuffer.alloc(width, height); // Explicit modern initial plane; no legacy or successful paint.
  }
  const fIns = faceEl?.slice?.corner ?? sliceInset(face.width, face.height);
  const fSide = faceEl?.slice?.side ?? fIns;
  // TMPL 129 bgPixel is a source RGB sample, not a tiling origin. kDEF
  // 0x10904–0x1091a samples cinf+6/+8; 0x109b2 applies RGBBackColor.
  // Keep the metadata attached to the actual resolved face (including state
  // and base-theme fallbacks), never to the originally requested resource ID.
  const bg = faceEl.bgAnchor;
  const validBg = !faceEl.bgPattern && bg && Number.isInteger(bg[0]) && Number.isInteger(bg[1])
    && bg[0] >= 0 && bg[0] < face.width && bg[1] >= 0 && bg[1] < face.height
    && face.getPixel(bg[0], bg[1])[3] > 0;
  // These decoded-raster samples retain the prior legacy fallback policy.
  // Supported solid bodies below prefer raw color metadata, while resolved
  // pattern bodies remain independent of bgPixel and raster-mask eligibility.
  const ta = faceEl.textAnchor;
  const sx = validBg ? bg[0] : ta ? Math.max(0, Math.min(face.width - 1, ta[0] - 3)) : fIns;
  const sy = validBg ? bg[1] : ta ? Math.max(0, Math.min(face.height - 1, ta[1])) : fIns;
  const [cr, cg, cb, ca] = face.getPixel(sx, sy);
  const lum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
  const fallbackFg = opts.disabled
    ? (lum < 128 ? '#b0b0b0' : '#707070')
    : lum < 128 ? '#ffffff' : '#000000';
  // 0x10922–0x10990 samples exact cicn/cinf colors. Preserve hidden RGB and
  // 16-bit sentinel/equality decisions through metadata, not canvas readback.
  // The traced push/bevel call sites draw emboss first at (+1,+1), then text.
  // List-header dispatch and legacy manifests retain their prior policy.
  const colors = geometry === 'button' ? controlTextColors(faceEl, opts.fg, fallbackFg, resolved.theme.manifest)
    : { foreground: opts.fg ?? fallbackFg, emboss: null, policy: 'contrast-fallback' as const, embossDecision: 'unavailable' as const, sampleFallbackReason: null };
  const fg = colors.foreground;
  if (geometry === 'button') opts.trace?.textColors({ ...colors, labelPainted: label.length > 0,
    deviceMode: 'full-color-policy', sourceManifestKey: resolved.key, sourceOwnerDepth: resolved.chainDepth });
  let lineH = resolveControlHeight(face, opts.height);
  // kDEF reads effective port txSize (0x7546/0x754a), not Rect height.
  // Keep the separate multi-column compatibility helper's existing typography.
  let fontSize = geometry === 'button' ? opts.fontSize! : Math.max(8, Math.round(lineH * 0.6));
  const bitmapRun = opts.bitmapRun;
  let glyphs = !bitmapRun && label ? rasterizeText(label, fontSize, fg) : null;
  // A cicn is a resizable template, not a minimum control rectangle. Tiny
  // templates (e.g. a 5×6 face) cannot contain even our smallest label raster.
  // Use the existing standard height without changing the button font size.
  // Caller-specified heights remain authoritative, including compact controls.
  if (opts.height == null && ((glyphs && glyphs.height > lineH) || (bitmapRun && label && bitmapRun.lineHeight > lineH))) {
    lineH = APPLE_PUSH_BUTTON_HEIGHT;
    if (geometry === 'legacy-list-header') {
      fontSize = Math.max(8, Math.round(lineH * 0.6));
      glyphs = rasterizeText(label, fontSize, fg);
    }
  }
  const padX = opts.padX ?? 12;
  const innerW = opts.width ?? Math.max(opts.minWidth ?? 56, (bitmapRun ? bitmapRun.advance : glyphs ? glyphs.width : 0) + padX * 2);
  const innerH = lineH;
  const out = PixelBuffer.alloc(innerW, innerH);
  const context = opts.composition ?? snapshotControlComposition();
  // A completed body dependency describes a published composition, not an
  // intermediate offscreen write. Borders can still decode asynchronously.
  let mode5PaintStep: ControlResolutionStep | undefined;
  let patternPaint: NonNullable<ControlResolutionStep['bodyPaint']> | undefined;
  let legacyFacePaint: LegacyFacePaint | undefined;
  if (geometry === 'button') opts.trace?.composition({ context, originalPortState: 'unverified',
    faceRect: { x: context.controlOrigin[0], y: context.controlOrigin[1], w: innerW, h: innerH },
    appliedUnknownPatternOffset: context.patternOrigin.status === 'unknown' });
  const mode5 = geometry === 'button' && faceEl.bodyRequest?.mode === 5;
  const cicnBody = mode5 ? await loadCicnBody(resolved, opts, innerW, innerH, context) : null;
  const body = mode5 ? { buffer: null, solidFallback: cicnBody?.kind === 'missing' }
    : geometry === 'button' ? await loadBodyPattern(resolved, opts) : { buffer: null, solidFallback: false };
  const pattern = body.buffer;
  if (resolved.consumedCinf && !pattern && !body.solidFallback)
    throw new CinfEnvironmentError('Declared cinf body pattern lookup is ambiguous or unsupported', 'UNSUPPORTED_CINF_ENVIRONMENT');
  const samples = faceEl.colorSamples;
  const rawBg = samples?.background;
  const triple = (values: readonly number[] | undefined, max: number): boolean =>
    Array.isArray(values) && values.length === 3 && values.every(value => Number.isInteger(value) && value >= 0 && value <= max);
  // 10904..1091a samples source RGB independently of the mask; 109b2..109b6
  // applies it before a NULL pattern result reaches solid fill at10b72.
  // Prefer its already-transformed display triple even for opaque raster pixels:
  // source palette lookup can differ from the ordinary raster decoder's policy.
  // Loader validation binds RGB16/display consistency. Direct hand-built theme
  // metadata remains caller-declared; do not apply or duplicate that LUT here.
  const sourceBg = body.solidFallback && faceEl.slice && !faceEl.colorSamplesUnavailableReason
    && samples?.model === 'kdef-2.3.1-color' && ownerDisplayPolicyMatches(resolved.theme.manifest, samples.displayPolicy)
    && rawBg && triple(rawBg.rgb16, 65535) && triple(rawBg.displayRgb, 255)
    && bg && Number.isInteger(bg[0]) && Number.isInteger(bg[1])
    && bg[0] >= 0 && bg[0] < face.width && bg[1] >= 0 && bg[1] < face.height
    ? rawBg.displayRgb : null;
  if (resolved.consumedCinf && !pattern && !sourceBg)
    throw new CinfEnvironmentError('Declared cinf raw background sample unavailable', 'UNSUPPORTED_CINF_ENVIRONMENT');
  if (cicnBody?.kind === 'missing' && !sourceBg) opts.trace?.record({
    role: 'body-fill', requestedId: faceEl.bodyRequest!.resourceId, bodyMode: 5, requestedResourceType: 'cicn',
    basis: 'compatibility-policy', usage: 'paint', owner: { baseUrl: resolved.theme.baseUrl, chainDepth: resolved.chainDepth },
    action: 'fallback', reason: 'missing-cicn-body-background-unverified',
  });
  if (cicnBody?.kind === 'ready') {
    let paintedPixels = 0;
    const { buffer, side, sourceRect, copy } = cicnBody;
    for (let y = 0; y < sourceRect.h; y++) for (let x = 0; x < sourceRect.w; x++) {
      if (!controlPointVisible(context, x + side, y + side)) continue;
      const pixel = buffer.getPixel(x, y);
      if (copy === 'masked' && pixel[3] === 0) continue;
      out.setPixel(x + side, y + side, ...pixel); paintedPixels++;
    }
    if (paintedPixels) mode5PaintStep = { ...cicnBody.step, bodyPaint: {
      branch: copy === 'masked' ? 'masked-copy' : 'unmasked-copy', sourceRect, sourceAssetUrl: cicnBody.sourceAssetUrl,
      destinationRect: { x: side, y: side, w: sourceRect.w, h: sourceRect.h }, paintedPixels,
      ...(cicnBody.derivedPath ? { derivedPath: cicnBody.derivedPath } : {}),
    } };
    else {
      const unpainted = { ...cicnBody.step }; delete unpainted.resource;
      opts.trace?.record({ ...unpainted, action: 'fallback', reason: 'cicn-body-no-visible-source-pixels' });
    }
    out.drawOver(await composeControlBorder(resolved, innerW, innerH, opts, (x, y) => controlPointVisible(context, x, y)), 0, 0);
  } else if (pattern && faceEl.slice && faceEl.bodyRequest) {
    const [phaseX, phaseY] = bodyPatternPhase(context, faceEl.bodyRequest.mode, innerW, innerH);
    let paintedPixels = 0;
    // Full-color f7cc/FillCRect: both inset rectangles share the original D/P
    // phase. Their union is filled before the masked border; do not tile each
    // inset from its own origin or alpha-mask the body by the face raster.
    for (let y = 0; y < innerH; y++) for (let x = 0; x < innerW; x++) {
      const inBody = (x >= fIns && x < innerW - fIns && y >= fSide && y < innerH - fSide)
        || (x >= fSide && x < innerW - fSide && y >= fIns && y < innerH - fIns);
      if (!inBody || !controlPointVisible(context, x, y)) continue;
      const px = ((phaseX + x) % pattern.width + pattern.width) % pattern.width;
      const py = ((phaseY + y) % pattern.height + pattern.height) % pattern.height;
      out.setPixel(x, y, ...pattern.getPixel(px, py));
      // Count writes, including transparent samples, once across the overlapping union.
      paintedPixels++;
    }
    if (opts.trace && body.selection && paintedPixels) {
      const rect = (x: number, y: number) => {
        const left = Math.max(0, x), top = Math.max(0, y);
        return { x: left, y: top, w: Math.max(0, Math.min(innerW, innerW - x) - left),
          h: Math.max(0, Math.min(innerH, innerH - y) - top) };
      };
      const unionRects = [rect(fIns, fSide), ...(fIns === fSide ? [] : [rect(fSide, fIns)])]
        .filter(r => r.w > 0 && r.h > 0);
      patternPaint = { branch: 'pattern-fill-union', coordinateSpace: 'face-local-before-ring',
        unionRects, paintedPixels, sourceAssetUrl: body.selection.resource!.assetUrl,
        sourceSize: [pattern.width, pattern.height], context,
        phase: { basis: 'modern-composition-policy', offset: [phaseX, phaseY], originalPatternPhase: 'unverified' } };
    }
    out.drawOver(await composeControlBorder(resolved, innerW, innerH, opts, (x, y) => controlPointVisible(context, x, y)), 0, 0);
  } else if (geometry === 'button' && faceEl.slice && (sourceBg || validBg)) {
    // 0x10b72–0x10bb8 erases two rectangles using the sampled background:
    // inset(horizontal=corner, vertical=side), then the transposed insets.
    // Their union is a cross when corner != side. Fill precedes the border,
    // so transparent edge samples reveal the body without erasing earlier art.
    const [br, bgc, bb] = sourceBg ?? [cr, cg, cb];
    out.fillRect({ x: fIns, y: fSide, w: innerW - fIns * 2, h: innerH - fSide * 2 }, br!, bgc!, bb!, 255);
    if (fIns !== fSide) out.fillRect({ x: fSide, y: fIns, w: innerW - fSide * 2, h: innerH - fIns * 2 }, br!, bgc!, bb!, 255);
    if (cicnBody?.kind === 'missing' && sourceBg) {
      let paintedPixels = 0;
      for (let y = 0; y < innerH; y++) for (let x = 0; x < innerW; x++)
        if (controlPointVisible(context, x, y) && ((x >= fIns && x < innerW - fIns && y >= fSide && y < innerH - fSide)
          || (x >= fSide && x < innerW - fSide && y >= fIns && y < innerH - fIns))) paintedPixels++;
      if (paintedPixels) mode5PaintStep = { role: 'body-fill', requestedId: faceEl.bodyRequest!.resourceId, bodyMode: 5,
        requestedResourceType: 'cicn', basis: 'source-dispatch', usage: 'paint', action: 'missing',
        owner: { baseUrl: resolved.theme.baseUrl, chainDepth: resolved.chainDepth }, reason: 'missing-cicn-body-erase-union',
        bodyPaint: { branch: 'missing-erase', destinationRect: { x: 0, y: 0, w: innerW, h: innerH }, paintedPixels } };
    }
    out.drawOver(await composeControlBorder(resolved, innerW, innerH, opts, (x, y) => controlPointVisible(context, x, y)), 0, 0);
  } else {
    // Retained approximation for unsupported pattern modes, unresolved legacy
    // metadata and list headers; no historical body claim for these paths.
    const faceIns = { l: fIns, t: fSide, r: fIns, b: fSide };
    const faceMode = faceEl?.slice?.tile ? 'tile' : 'stretch';
    out.nineSlice(face, { x: 0, y: 0, w: face.width, h: face.height }, faceIns, { x: 0, y: 0, w: innerW, h: innerH }, faceMode);
    let centerFill: LegacyFacePaint['centerFill'];
    if (ca > 0) {
      const cw = innerW - fIns * 2, ch = innerH - fSide * 2;
      if (cw > 0 && ch > 0) {
        out.fillRect({ x: fIns, y: fSide, w: cw, h: ch }, cr, cg, cb, 255);
        if (opts.trace) centerFill = { sourcePoint: [sx, sy], sampledDisplayRgba: [cr, cg, cb, ca],
          destinationRect: { x: fIns, y: fSide, w: cw, h: ch }, outputAlpha: 255 };
      }
    }
    if (geometry === 'button' && opts.trace && resolved.loadedIdentity) {
      // Occupancy of this stage under the actual clip, before glyphs. This is
      // neither historical band attribution nor final surviving contribution.
      let retainedNonzeroAlphaPixels = 0;
      for (let y = 0; y < innerH; y++) for (let x = 0; x < innerW; x++)
        if (controlPointVisible(context, x, y) && out.getPixel(x, y)[3] > 0) retainedNonzeroAlphaPixels++;
      if (retainedNonzeroAlphaPixels) {
        const clip = context.clip;
        const [ox, oy] = context.controlOrigin;
        const x = clip.kind === 'rect' ? Math.max(0, Math.min(innerW, clip.rect.x - ox)) : 0;
        const y = clip.kind === 'rect' ? Math.max(0, Math.min(innerH, clip.rect.y - oy)) : 0;
        const right = clip.kind === 'rect' ? Math.max(x, Math.min(innerW, clip.rect.x + clip.rect.w - ox)) : innerW;
        const bottom = clip.kind === 'rect' ? Math.max(y, Math.min(innerH, clip.rect.y + clip.rect.h - oy)) : innerH;
        legacyFacePaint = { ...resolved.loadedIdentity, basis: 'compatibility-policy', operation: 'legacy-nine-slice-and-sample-fill',
          coordinateSpace: 'face-local-before-ring', sourceRect: { x: 0, y: 0, w: face.width, h: face.height },
          destinationRect: { x: 0, y: 0, w: innerW, h: innerH }, requestedInsets: faceIns,
          insetPolicy: 'pixel-buffer-nine-slice-source-clamp', mode: faceMode, rasterAlpha: 'copy-source-rgba',
          ...(centerFill ? { centerFill } : {}), controlOrigin: context.controlOrigin, declaredClip: clip,
          effectiveFaceClip: { x, y, w: right - x, h: bottom - y }, retainedNonzeroAlphaPixels };
      }
    }
  }
  const bitmapTextPaint = bitmapRun ? paintBitmapText(out, bitmapRun, context, fg, colors.emboss) : null;
  if (glyphs) {
    const gx = opts.align === 'left' ? padX : Math.round((innerW - glyphs.width) / 2);
    const gy = Math.round((innerH - glyphs.height) / 2);
    if (colors.emboss) out.drawOver(rasterizeText(label, fontSize, colors.emboss), gx + 1, gy + 1);
    out.drawOver(glyphs, gx, gy);
  }
  if (geometry === 'button' && context.clip.kind === 'rect') {
    for (let y = 0; y < innerH; y++) for (let x = 0; x < innerW; x++)
      if (!controlPointVisible(context, x, y)) out.setPixel(x, y, 0, 0, 0, 0);
  }
  assertControlAlive(opts.signal);
  if (patternPaint && body.selection) opts.trace?.completeBodyPaint(body.selection, patternPaint);
  if (mode5PaintStep) opts.trace?.record(mode5PaintStep);
  if (legacyFacePaint) opts.trace?.legacyFacePaint(legacyFacePaint);
  if (bitmapTextPaint) opts.trace?.bitmapTextPaint(bitmapTextPaint);
  return out;
}

/** The border path shared by kDEF 0x107fe faces and rings: square corners plus independently thick
 * bands, in painter order TL/TR/top/BL/BR/bottom/left/right. Cinf side thickness
 * may exceed corner size (e.g. 7/14 in a 21px ring); these are overlapping
 * masked bands, not a rectangular nine-slice partition. Body fill is disabled
 * by the ring wrapper at 0x107de; solid faces fill it separately first. */
async function composeControlBorder(resolved: ResolvedControlFace, width: number, height: number,
  opts: Pick<FaceOptions, 'trace' | 'signal'>, visible: (x: number, y: number) => boolean,
  role: 'face' | 'default-ring' = 'face'): Promise<PixelBuffer> {
  assertControlAlive(opts.signal);
  const { buffer: source, element } = resolved;
  const out = PixelBuffer.alloc(width, height);
  const c = Math.max(0, element.slice?.corner ?? sliceInset(source.width, source.height));
  const side = Math.max(0, element.slice?.side ?? c);
  const cw = Math.min(c, source.width), ch = Math.min(c, source.height);
  const sw = Math.min(side, source.width), sh = Math.min(side, source.height);
  const repeat = element.slice?.tile ?? false;
  // 0x10cf6/0x10e54 restrict non-repeated horizontal bands to the first
  // source column; 0x10ecc/0x10f44 do the same with the first vertical row.
  const middleW = source.width - c * 2, middleH = source.height - c * 2;
  const bandW = repeat ? Math.max(0, middleW) : c < source.width ? 1 : 0;
  const bandH = repeat ? Math.max(0, middleH) : c < source.height ? 1 : 0;
  const regions: [number, number, number, number, number, number, number, number][] = [
    [0, 0, cw, ch, 0, 0, cw, ch],
    [source.width - cw, 0, cw, ch, width - cw, 0, cw, ch],
    [c, 0, bandW, sh, c, 0, width - c * 2, sh],
    [0, source.height - ch, cw, ch, 0, height - ch, cw, ch],
    [source.width - cw, source.height - ch, cw, ch, width - cw, height - ch, cw, ch],
    [c, source.height - sh, bandW, sh, c, height - sh, width - c * 2, sh],
    [0, c, sw, bandH, 0, c, sw, height - c * 2],
    [source.width - sw, c, sw, bandH, width - sw, c, sw, height - c * 2],
  ];
  const proof = element.samplingEquivalence;
  const identityMatches = (a: { model: string; comparison: string; displayPolicy: string; width: number; height: number } | undefined | null) =>
    a?.model === 'kaleidoscope-2.3.1-opaque-sampling-v1' && a.comparison === 'opaque-current-display-rgb'
      && ownerDisplayPolicyMatches(resolved.theme.manifest, a.displayPolicy) && a.width === source.width && a.height === source.height;
  const equivalent = identityMatches(proof) && proof?.status === 'equivalent' && proof.reason === 'all-opaque-display-rgb-equal';
  const companion = element.sampledBandAsset;
  const eligible = identityMatches(companion) && companion && typeof companion.asset === 'string'
    && /^cicn-sampled\/[^/]+\.png$/.test(companion.derivedPath);
  let sampled: PixelBuffer | null = null;
  let attempted = false;
  for (const [regionIndex, region] of regions.entries()) {
    const [sx, sy, rw, rh, dx, dy, dw, dh] = region;
    if (rw <= 0 || rh <= 0 || dw <= 0 || dh <= 0) continue;
    // Clip allocation to the output, while retaining the original tile phase.
    const x0 = Math.max(0, dx), y0 = Math.max(0, dy);
    const x1 = Math.min(width, dx + dw), y1 = Math.min(height, dy + dh);
    if (x1 <= x0 || y1 <= y0) continue;
    // FEAE branch uses original source/destination dimensions before clipping,
    // width expansion first. tile=true does not bypass a one-pixel sampler.
    const branch = rw === 1 && dw > 1 ? 'horizontal-lines' : rh === 1 && dh > 1 ? 'vertical-lines' : 'copy';
    let paints = false;
    for (let y = y0; y < y1 && !paints; y++) for (let x = x0; x < x1; x++) {
      if (visible(x, y) && source.getPixel(sx + (x - dx) % rw, sy + (y - dy) % rh)[3] > 0) { paints = true; break; }
    }
    if (!paints) continue;
    if (branch !== 'copy' && !equivalent && eligible && !attempted) {
      assertControlAlive(opts.signal);
      attempted = true;
      const decoded = await loadCicnBuffer(assetUrl(resolved.theme, companion.asset));
      assertControlAlive(opts.signal);
      if (decoded.width === source.width && decoded.height === source.height) {
        let sameMask = true;
        for (let i = 3; i < source.data.length; i += 4) if (decoded.data[i] !== source.data[i]) { sameMask = false; break; }
        if (sameMask) sampled = decoded;
      }
    }
    const pixels = branch !== 'copy' && !equivalent && sampled ? sampled : source;
    const policy = branch === 'copy' ? 'ordinary-raster' : equivalent ? 'equivalent-raster'
      : pixels === sampled ? 'sampled-companion' : 'compatibility-raster';
    const band = PixelBuffer.alloc(x1 - x0, y1 - y0);
    let opaqueUsed = false;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!visible(x, y)) continue;
      const pixel = pixels.getPixel(sx + (x - dx) % rw, sy + (y - dy) % rh);
      if (pixel[3] > 0) opaqueUsed = true;
      band.setPixel(x - x0, y - y0, ...pixel);
    }
    // FEAE's masked blits preserve earlier bands below transparent samples.
    out.drawOver(band, x0, y0);
    if (opaqueUsed) opts.trace?.bandPaint({ role, region: regionIndex, branch, policy,
      owner: { baseUrl: resolved.theme.baseUrl, chainDepth: resolved.chainDepth }, resource: resourceIdentity(resolved),
      ...(policy === 'sampled-companion' && companion ? { derived: { path: companion.derivedPath,
        assetUrl: assetUrl(resolved.theme, companion.asset), model: companion.model, displayPolicy: companion.displayPolicy } } : {}) });
  }
  return out;
}

/** Compose a push face, label and optional default ring with the v2 engine. */
export async function composeButton(theme: LoadedTheme, opts: ButtonOptions = {}, signal?: AbortSignal): Promise<PixelBuffer | null> {
  return (await composeButtonWithLayout(theme, opts, signal))?.buffer ?? null;
}

/** Internal adapter seam: actual face placement, never a second ring resolver. */
export async function composeButtonWithLayout(theme: LoadedTheme, opts: ButtonOptions = {}, signal?: AbortSignal,
  preparedContext?: ControlCompositionSnapshot): Promise<ButtonComposition | null> {
  return composeEnginePush(theme, opts, signal, preparedContext);
}

/**
 * Compose a THEMED bevel button (toolbar / palette toggle). The scheme ships a
 * 12-cicn set — NORMAL size -10162..-10167 and SMALL size -10171..-10176, each laid
 * out [set/on: pressed, unpressed, inactive] then [clear/off: pressed, unpressed,
 * inactive]. Compose the state's face like the push button. Falls back within the
 * bundle (exact → same-value unpressed → -10163) and returns null (→
 * platinumBevelButton) when the scheme ships no bevel-button cicn for this state.
 */
export async function composeBevelButton(theme: LoadedTheme, opts: BevelButtonOptions = {}): Promise<PixelBuffer | null> {
  return (await composeBevelButtonWithLayout(theme, opts))?.buffer ?? null;
}

/** Internal adapter seam; bevel faces have no reserved ring offset. */
async function composeBevelButtonWithLayout(theme: LoadedTheme, opts: BevelButtonOptions = {}): Promise<ButtonComposition | null> {
  let result: ButtonComposition | null = null;
  const state = opts.pressed ? 'pressed' : opts.disabled ? 'inactive' : 'active';
  await withControlDiagnostics(opts.diagnostics, 'bevel-button', {
    state, pressed: !!opts.pressed, disabled: !!opts.disabled, on: !!opts.on, small: !!opts.small,
  }, async trace => {
    const composition = snapshotControlComposition(opts.compositionContext);
    const preparedOptions = { ...opts, fontSize: buttonFontSize(opts.fontSize) };
    const buffer = await composeBevelButtonWithTrace(theme, preparedOptions, composition, trace);
    result = buffer ? { buffer, layout: { faceRect: { x: 0, y: 0, w: buffer.width, h: buffer.height } } } : null;
    return buffer;
  });
  return result;
}

async function composeBevelButtonWithTrace(theme: LoadedTheme, opts: BevelButtonOptions, composition: ControlCompositionSnapshot,
  trace?: ControlTraceCollector): Promise<PixelBuffer | null> {
  const sizeBase = opts.small ? 10171 : 10162;
  const valueOff = opts.on ? 0 : 3;                          // set/on group, then clear/off (+3)
  const stateOff = opts.pressed ? 0 : opts.disabled ? 2 : 1; // pressed · unpressed · inactive
  const reqId = sizeBase + valueOff + stateOff;
  const ids = [reqId, sizeBase + valueOff + 1, 10163];
  let face: ResolvedControlFace | null = null;
  for (const [index, id] of ids.entries()) {
    const lookup = index === 0 ? FACE_LOOKUP : { ...FACE_LOOKUP, basis: 'compatibility-policy' as const };
    if (index > 0) traceFallback(trace, id, index === 1 ? 'bevel-unpressed-fallback' : 'bevel-default-fallback');
    face = await loadFaceById(theme, id, trace, lookup);
    if (face) break;
  }
  if (!face) return null; // → platinumBevelButton
  face = declaredBodyFace(theme, face, -reqId, opts.label ?? '', false, trace);
  const faceOpts: FaceOptions = { composition, trace, fontSize: opts.fontSize!, padX: 8, minWidth: opts.minWidth ?? (opts.small ? 18 : 22) };
  if (opts.label != null) faceOpts.label = opts.label;
  if (opts.disabled != null) faceOpts.disabled = opts.disabled;
  if (opts.fg != null) faceOpts.fg = opts.fg;
  if (opts.height != null) faceOpts.height = opts.height;
  return composeFaceButton(face, faceOpts);
}

/** Whole Appearance header surface with explicit Rect/state/clip and finite
 * source admission. Existing composeListHeader remains a column compatibility API. */
export async function composeHeaderSurface(theme: LoadedTheme, opts: HeaderSurfaceOptions): Promise<HeaderSurfaceResult> {
  let result: HeaderSurfaceResult = { status: 'unavailable', reason: 'missing-face' };
  await withControlDiagnostics(opts?.diagnostics, 'header-surface', {
    state: opts?.drawState === 0 ? 'inactive' : 'active', pressed: false, disabled: false,
  }, async trace => {
    const plan = planHeaderSurface(opts);
    const finish = (value: HeaderSurfaceResult, extra: Partial<Pick<HeaderSurfaceTrace, 'backgroundPolicy' | 'lineSampling' | 'painted' | 'patternBody'>> = {}): PixelBuffer | null => {
      result = value;
      trace?.headerSurface({ ...plan, admission: value.status, ...(value.status === 'rendered' ? {} : { reason: value.reason }),
        geometry: 'pach130-ordinary-full-color', sourceSelection: 'current-manifest-compatibility', ...extra });
      return value.status === 'rendered' ? value.buffer : null;
    };
    if (!plan.effectiveClip) return finish({ status: 'unsupported', reason: 'unknown-clip' });
    // PACH130 c430..c4d4 treats this ordinary-header sentinel specially using
    // window visibility/port bounds that this explicit Rect API does not carry.
    if (plan.kind === 'window-header' && plan.requestedRect.x === -1 && plan.requestedRect.y === -1)
      return finish({ status: 'unsupported', reason: 'special-window-origin' });
    try {
      // Callback state dispatch is source-backed; manifest ownership, aliases and
      // base search remain the current compatibility resolver's policy.
      const id = plan.drawState === 0 ? 9568 : 9567;
      const selected = resolveFaceById(theme, id, trace,
        { ...FACE_LOOKUP, basis: 'compatibility-policy', usage: 'admission' });
      if (!selected) return finish({ status: 'unavailable', reason: 'missing-face' });
      // Capture the actual selected identity before decoding. The successful
      // paint record reuses it; it never repeats lookup or guesses an owner.
      const identity = trace ? { owner: { baseUrl: selected.theme.baseUrl, chainDepth: selected.chainDepth }, resource: resourceIdentity(selected) } : null;
      const face: ResolvedControlFace = { ...selected, buffer: await loadCicnBuffer(assetUrl(selected.theme, selected.element.asset)) };
      const rejection = headerMetadataRejection(face.element);
      if (rejection) return finish({ status: 'unsupported', reason: rejection });
      // A selected ppat (including ID0) takes priority. Keep real decode errors
      // as errors, not a manufactured NULL lookup/solid fallback.
      const body = await loadBodyPattern(face, { trace }, 'admission');
      if (body.buffer && plan.context.patternOrigin.status === 'unknown')
        return finish({ status: 'unsupported', reason: 'unknown-pattern-origin' });
      if (!body.buffer && !body.solidFallback) return finish({ status: 'unsupported', reason: 'ambiguous-body-selection' });
      const background = headerBackground(face.buffer, face.element, face.theme.manifest);
      if (!body.buffer && !background) return finish({ status: 'unsupported', reason: 'missing-background-sample' });
      const companion = face.element.sampledBandAsset;
      const companionUrl = companion ? assetUrl(face.theme, companion.asset) : null;
      const painted = await paintHeaderSurface(face.buffer, face.element, plan, background ?? [], face.theme.manifest,
        companionUrl ? () => loadCicnBuffer(companionUrl) : undefined, body.buffer ?? undefined);
      if (identity && companion && companionUrl) for (const band of painted.sampledRegions ?? []) trace?.bandPaint({
        ...identity, role: 'face', ...band, policy: 'sampled-companion',
        derived: { path: companion.derivedPath, assetUrl: companionUrl, model: companion.model, displayPolicy: companion.displayPolicy },
      });
      if (painted.patternBody && body.selection) trace?.record({ ...body.selection, usage: 'paint', reason: 'completed-header-pattern-inset-union' });
      if (painted.painted && identity) trace?.record({ ...identity, role: 'face', requestedId: -id,
        action: 'selected', basis: 'compatibility-policy', usage: 'paint', reason: 'admitted-header-surface-paint' });
      return finish(painted.result, { ...(painted.result.status === 'rendered' ? { painted: painted.painted,
        ...(painted.patternBody ? { patternBody: painted.patternBody } : {}),
        ...(painted.painted && !body.buffer ? { backgroundPolicy: 'raw-sample-current-display' as const } : {}) } : {}), lineSampling: painted.lineSampling });
    } catch (error) {
      trace?.headerSurface({ ...plan, admission: 'error', geometry: 'pach130-ordinary-full-color', sourceSelection: 'current-manifest-compatibility' });
      throw error;
    }
  });
  return result;
}

export interface ListHeaderColumn { label: string; width: number; }
export interface ListHeaderOptions { columns?: ListHeaderColumn[]; height?: number; inactive?: boolean; }

/**
 * Compatibility multi-column/text helper, using -9567 active / -9568 inactive
 * art with the existing per-cell sizing, slicing and left-aligned label policy.
 * This is not the original whole-header call. See composeHeaderSurface for the
 * separately admitted Rect/state model. Returns null when the scheme ships none.
 */
export async function composeListHeader(theme: LoadedTheme, opts: ListHeaderOptions = {}): Promise<PixelBuffer | null> {
  const cellId = opts.inactive ? 9568 : 9567;
  const cell = await loadFaceById(theme, cellId);
  if (!cell) return null; // → platinumListHeader
  const cols = opts.columns ?? [{ label: 'Name', width: 140 }, { label: 'Size', width: 56 }, { label: 'Kind', width: 90 }];
  // List-header cells follow the same clamp rule as buttons — crayon-os ships
  // -9567 at 70×70 (Finder Header Active), which would blow the list header up
  // to ~70 px without the Apple-metric cap. `Math.max(16, …)` here is a floor
  // (the cicn can't shrink below a usable size); `resolveControlHeight` is the
  // CEILING (the cicn can't blow up beyond Apple's metric).
  const H = Math.max(16, resolveControlHeight(cell.buffer, opts.height));
  const W = cols.reduce((a, c) => a + c.width, 0);
  const out = PixelBuffer.alloc(W, H);
  let x = 0;
  for (const c of cols) {
    const cellBuf = await composeFaceButton(cell, { label: c.label, width: c.width, height: H, align: 'left', padX: 6 }, 'legacy-list-header');
    out.drawOver(cellBuf, x, 0);
    x += c.width;
  }
  return out;
}

/** Checkable Boolean mapping, browser fonts and archive/base environment are
 * declared public policies. The engine owns typed state selection and paint order. */
export async function composeCheckable(theme: LoadedTheme, kind: 'checkbox' | 'radio', opts: CheckableOptions = {}): Promise<PixelBuffer | null> {
  return composeEngineCheckable(theme, kind, opts);
}

// ─── Baseline (procedural Platinum) controls ───────────────────────────
// Kaleidoscope leaves standard controls to the OS unless the scheme ships
// cicns (kdef-findings §2.2). 7 Le ships none, so these render as the
// Platinum default — DOM elements with procedural styling, not cicn
// composites. Accessible + the faithful path for cicn-less schemes.

export interface BaselineButtonOptions {
  default?: boolean;
  disabled?: boolean;
  /** Minimum button width in px (default 62). Use a small value for compact
   *  buttons like a segmented On/Off pair. */
  minWidth?: number;
}

export function baselineButton(label: string, opts: BaselineButtonOptions = {}): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.disabled = !!opts.disabled;
  // Platinum push button: rounded face with a top-light gradient, a dark
  // outer frame, a white top-inner highlight + soft bottom-inner shadow.
  // The default button gets the classic black ring (1px light gap, then a
  // 2px black rounded outline) via stacked box-shadows.
  const bevel = 'inset 0 1px 0 #ffffff, inset 0 -1px 1px rgba(0,0,0,0.14)';
  Object.assign(b.style, {
    font: '12px Charcoal, Chicago, Geneva, sans-serif',
    padding: '3px 16px',
    minWidth: `${opts.minWidth ?? 56}px`,
    margin: '3px',
    color: opts.disabled ? '#9a9a9a' : '#000',
    background: opts.disabled ? '#e0e0e0' : 'linear-gradient(180deg, #fefefe 0%, #ececec 48%, #cdcdcd 100%)',
    border: '1px solid #5a5a5a',
    borderRadius: '10px',
    boxShadow: opts.default ? `${bevel}, 0 0 0 1px #d4d4d4, 0 0 0 3px #000000` : bevel,
    cursor: opts.disabled ? 'default' : 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
  return b;
}

export function baselineCheckable(
  kind: 'checkbox' | 'radio',
  label: string,
  opts: { checked?: boolean; disabled?: boolean } = {},
): HTMLLabelElement {
  const wrap = document.createElement('label');
  Object.assign(wrap.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    font: '12px Chicago, Charcoal, Geneva, sans-serif',
    color: opts.disabled ? '#888' : '#000',
  } satisfies Partial<CSSStyleDeclaration>);
  const box = document.createElement('span');
  Object.assign(box.style, {
    width: '12px',
    height: '12px',
    background: 'linear-gradient(#ffffff, #dcdcdc)',
    border: '1px solid #555555',
    borderRadius: kind === 'radio' ? '50%' : '2px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    lineHeight: '1',
  } satisfies Partial<CSSStyleDeclaration>);
  if (opts.checked) box.textContent = kind === 'radio' ? '●' : '✓';
  const text = document.createElement('span');
  text.textContent = label;
  wrap.append(box, text);
  return wrap;
}

/** Blit a composed control buffer to a CSS-scaled, pixelated canvas. */
export function bufferToCanvas(buf: PixelBuffer, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = buf.width;
  canvas.height = buf.height;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.putImageData(buf.toImageData(), 0, 0);
  Object.assign(canvas.style, {
    width: `${buf.width * scale}px`,
    height: `${buf.height * scale}px`,
    imageRendering: 'pixelated',
    display: 'block',
  } satisfies Partial<CSSStyleDeclaration>);
  return canvas;
}
