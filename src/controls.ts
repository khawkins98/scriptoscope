import { composeEngineCheckable, type CheckableOptions } from './checkableFacade.js';
import { withThemeView, type ThemeInput, type ThemeView, type RasterSource } from './ownedTheme.js';
import { composeEnginePush, loadEnginePushFace } from './pushButtonFacade.js';
import { CinfEnvironmentError, snapshotBodyCinfFace, type CinfLookupView } from '../tools/theme-loader/cinf-environment.js';
import type { PreparedBitmapFont } from './preparedBitmapFont.js';
import { drawCinfFrame, prepareCinfFrameSamples, type PreparedCinfFrame } from './engine/qd/cinfFrame.js';
import { ownerDisplayPolicyMatches, realizeRgb16 } from '../tools/theme-loader/display-profile.js';
import { snapshotControlComposition, controlPointVisible, type ControlCompositionContext, type ControlCompositionSnapshot, type ButtonComposition } from './controlComposition.js';
import type { SliderComposition } from './sliderLayout.js';
import type { ChromeElement } from './types.js';
import { resolveInChain } from './baseChain.js';
import { PixelBuffer } from './pixelBuffer.js';
import { rasterizeText } from './textRaster.js';
import { controlTextColors } from './controlTextColors.js';
import { composeEngineTab } from './tabFacade.js';
import type { HeaderSurfaceOptions, HeaderSurfaceResult } from './headerSurface.js';
import { composeEngineHeaderSurface, composeEngineHeaderColumns } from './headerFacade.js';
import { createTrace, type EngineTrace } from './engine/trace.js';
import { rect } from './engine/qd/rect.js';
import { normalizeControlState } from './engine/state/control.js';
import { SCROLLBAR_PRESSED_PARTS, SLIDER_PRESSED_PARTS } from './engine/tables/controlState.js';
import { SCROLLBAR_FACADE_RANGE, SCROLLBAR_FACADE_THICKNESS } from './engine/tables/scrollbar.js';
import { drawScrollbar, scrollbarPartAt, scrollbarResourceIds, type ScrollbarInput } from './engine/families/scrollbar.js';
import { SLIDER_FACADE_BACKGROUND, SLIDER_FACADE_RANGE, SLIDER_FACADE_THICKNESS, SLIDER_VARIATION } from './engine/tables/slider.js';
import { drawSlider, sliderInit, sliderPartAt, sliderResourceIds, type SliderInput } from './engine/families/slider.js';
import { PROGRESS_DATA, PROGRESS_FACADE_LENGTH, PROGRESS_FACADE_RANGE, PROGRESS_FACADE_VALUE, PROGRESS_IDLE, PROGRESS_RECT, PROGRESS_STATE,
  PROGRESS_VALUE_DOMAIN } from './engine/tables/progress.js';
import { drawProgress, newProgressRecord, progressResourceIds, progressSetData, type ProgressInput } from './engine/families/progress.js';
import { snapshotSliderEnvironment, unsupportedSliderEnvironment, admitSliderGeometry, admitSliderState } from './engine/resources/sliderEnvironment.js';
import { themeResourceChain, prepareThemeIcon } from './engine/resources/theme.js';
import { ResourceChain, mapProvider } from './engine/resources/chain.js';
import { withControlDiagnostics, type ControlDiagnostics, type ControlTraceCollector, type ControlResolutionStep, type LegacyFacePaint } from './controlDiagnostics.js';

/** 9-slice corner inset for a control cicn — matches the kDEF's ~6px for
 *  a 15px button face (kDEF routine `0x30a8`): floor((min(w,h)-3)/2). */
function sliceInset(w: number, h: number): number {
  return Math.max(2, Math.floor((Math.min(w, h) - 3) / 2));
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
interface ResolvedFaceMetadata { consumedCinf?: CinfLookupView; theme: ThemeView; element: ChromeElement; key: string; chainDepth: number; }
interface ResolvedControlFace extends ResolvedFaceMetadata { declaredCinf?: NonNullable<ReturnType<typeof snapshotBodyCinfFace>>; buffer: PixelBuffer; raster: RasterSource; loadedIdentity?: Pick<LegacyFacePaint, 'owner' | 'resource'>; }
type TraceLookup = Pick<ControlResolutionStep, 'role' | 'basis' | 'usage'>;
const FACE_LOOKUP: TraceLookup = { role: 'face', basis: 'source-dispatch', usage: 'paint' };

function resourceIdentity(hit: ResolvedFaceMetadata, assetUrl: string): Extract<NonNullable<ControlResolutionStep['resource']>, { type: 'cicn' }> {
  return { type: 'cicn', signedId: Number.isInteger(hit.element.sourceCicnId) ? hit.element.sourceCicnId! : null,
    sourceCinfId: Number.isInteger(hit.element.sourceCinfId) ? hit.element.sourceCinfId! : null, manifestKey: hit.key,
    assetUrl,
    ...(hit.consumedCinf ? { consumedCinf: hit.consumedCinf } : {}),
    ...(hit.element.byteProvenance ? { byteProvenance: { ...hit.element.byteProvenance } } : {}) };
}

function traceOwner(trace: ControlTraceCollector | undefined, lookup: TraceLookup, id: number,
  theme: ThemeView, chainDepth: number, action: 'missing' | 'fallback', reason: string): void {
  trace?.record({ ...lookup, requestedId: -Math.abs(id), action, reason,
    ...(action === 'fallback' ? { basis: 'compatibility-policy' as const } : {}),
    owner: { baseUrl: theme.origin, chainDepth } });
}

function traceFallback(trace: ControlTraceCollector | undefined, id: number, reason: string,
  lookup: TraceLookup = { ...FACE_LOOKUP, basis: 'compatibility-policy' }): void {
  trace?.record({ ...lookup, requestedId: -Math.abs(id), action: 'fallback', reason });
}

function resolveFaceById(theme: ThemeView, id: number, trace?: ControlTraceCollector,
  lookup: TraceLookup = FACE_LOOKUP): ResolvedFaceMetadata | undefined {
  let chainDepth = -1;
  return resolveInChain(theme, (t) => {
    chainDepth++;
    if (chainDepth > 0) traceOwner(trace, lookup, id, t, chainDepth, 'fallback', 'base-inheritance');
    const entry = elementEntryById(t, id);
    if (!entry) { traceOwner(trace, lookup, id, t, chainDepth, 'missing', 'missing-resource'); return null; }
    const hit = { theme: t, element: entry[1], key: entry[0], chainDepth };
    return hit;
  });
}

/** Capture the actual requested asset and scalar identity before its decode
 * await. Diagnostics must not relabel that buffer after consumer metadata edits. */
async function loadResolvedFace(hit: ResolvedFaceMetadata, id: number, lookup: TraceLookup, trace?: ControlTraceCollector): Promise<ResolvedControlFace> {
  const declaredCinf = snapshotBodyCinfFace(hit.theme.manifest, hit.element);
  if (declaredCinf) hit = { ...hit, element: { ...hit.element } };
  const raster = hit.theme.asset(hit.element.asset), selectedId = hit.element.sourceCicnId!;
  const resource = trace ? resourceIdentity(hit, raster.key) : undefined;
  const owner = { baseUrl: hit.theme.origin, chainDepth: hit.chainDepth };
  const loadedIdentity = resource ? { owner, resource: { ...resource, assetUrl: await raster.imageUrl() } } : undefined;
  if (loadedIdentity) trace?.record({ ...lookup, requestedId: -Math.abs(id), action: 'selected', ...loadedIdentity,
    ...(selectedId > 0 ? { basis: 'compatibility-policy' as const } : {}), reason: selectedId > 0 ? 'positive-id-alias' : 'resource-id' });
  return { ...hit, ...(declaredCinf ? { declaredCinf } : {}), buffer: await raster.pixels(), raster, ...(loadedIdentity ? { loadedIdentity } : {}) };
}

/** Select a prepared role view without mutating common element/local pair facts. */
function declaredBodyFace(root: ThemeView, face: ResolvedControlFace, requestedId: number, label: string,
  trace?: ControlTraceCollector): ResolvedControlFace {
  const environment = face.declaredCinf?.environment ?? root.manifest.cinfEnvironment;
  if (!environment) return face;
  const view = face.declaredCinf?.view;
  const reject = (reason: string): never => {
    trace?.record({ role: 'face', usage: 'admission', basis: 'compatibility-policy', action: 'rejected',
      requestedId, reason, ...(view ? { cinfLookup: lookupOnly(view) } : {}) });
    throw new CinfEnvironmentError(reason, 'UNSUPPORTED_CINF_ENVIRONMENT');
  };
  if (root.base || face.chainDepth !== 0 || face.theme !== root) reject('cinf-environment-base-inheritance');
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
    owner: { baseUrl: face.theme.origin, chainDepth: 0 }, cinfLookup: consumed });
  const loadedIdentity = face.loadedIdentity && { ...face.loadedIdentity, resource: { ...face.loadedIdentity.resource, consumedCinf: consumed } };
  return { ...face, consumedCinf: consumed, ...(loadedIdentity ? { loadedIdentity } : {}),
    element: view!.status === 'ready' ? { ...face.element, ...view!.metadata } : face.element };
}
function lookupOnly(view: NonNullable<ChromeElement['bodyCinf']>): CinfLookupView {
  const { metadata: _metadata, ...lookup } = view;
  return lookup;
}

async function loadFaceById(theme: ThemeView, id: number, trace?: ControlTraceCollector,
  lookup: TraceLookup = FACE_LOOKUP): Promise<ResolvedControlFace | null> {
  const hit = resolveFaceById(theme, id, trace, lookup);
  return hit ? loadResolvedFace(hit, id, lookup, trace) : null;
}

async function loadById(theme: ThemeView, id: number): Promise<PixelBuffer | null> {
  return (await loadFaceById(theme, id))?.buffer ?? null;
}

/** Self-only art lookup retained by the disclosure compatibility path. */
async function loadByIdSelf(theme: ThemeView, id: number): Promise<PixelBuffer | null> {
  const el = elementById(theme, id);
  return el ? theme.asset(el.asset).pixels() : null;
}

async function loadGlyphByIdSelf(theme: ThemeView, id: number): Promise<PixelBuffer | null> {
  const asset = theme.glyphs?.[String(id)];
  return asset ? theme.asset(asset).pixels() : null;
}

/** Load a scheme's own chromeElement by key for disclosure compatibility,
 *  without walking the base chain. */
async function loadByKeySelf(theme: ThemeView, key: string): Promise<PixelBuffer | null> {
  const asset = theme.manifest.chromeElements?.[key]?.asset;
  return asset ? theme.asset(asset).pixels() : null;
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
export async function loadPushButtonFace(theme: ThemeInput, state: 'active' | 'pressed' | 'inactive'): Promise<PixelBuffer | null> {
  return withThemeView(theme, view => loadEnginePushFace(view, state));
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
function elementById(theme: Pick<ThemeView, 'manifest'>, id: number) {
  return elementEntryById(theme, id)?.[1];
}

function elementEntryById(theme: Pick<ThemeView, 'manifest'>, id: number): [string, ChromeElement] | undefined {
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
  theme: ThemeInput,
  opts: ScrollbarOptions = {},
): Promise<PixelBuffer | null> {
  return (await composeScrollbarFrame(theme, opts))?.buffer ?? null;
}

/** @internal Shared draw path for the interactive scroll bar's hit test. */
export async function composeScrollbarFrame(
  inputTheme: ThemeInput,
  opts: ScrollbarOptions & { trace?: boolean } = {},
): Promise<ScrollbarFrame | null> {
  return withThemeView(inputTheme, async theme => {
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
  });
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
  theme: ThemeInput,
  opts: SliderOptions = {},
): Promise<PixelBuffer | null> {
  return (await composeSliderWithLayout(theme, opts))?.buffer ?? null;
}

/** @internal Shared draw path for native-backed slider hit testing. */
export async function composeSliderWithLayout(
  inputTheme: ThemeInput,
  opts: SliderOptions & { trace?: boolean } = {},
  signal?: AbortSignal,
): Promise<SliderFrame | null> {
  return withThemeView(inputTheme, async theme => {
    const orientation = opts.orientation ?? 'horizontal';
    const horiz = orientation === 'horizontal';
    const length = Math.max(32, opts.length ?? 120);
    const value = Math.min(1, Math.max(0, opts.value ?? 0.5));
    // Declared group2 layout environment (slider-layout-cinf.md): its admission
    // rules still apply; the geometry itself now comes from the engine (§5.2).
    const endpoint = snapshotSliderEnvironment(theme, orientation);
    const unsupported = unsupportedSliderEnvironment;

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
    admitSliderGeometry(endpoint, { length, along, cross, value, variant });
    if (signal?.aborted) return null;
    const chain = await themeResourceChain(theme, sliderResourceIds(horiz), { ...(signal ? { signal } : {}), ...(endpoint ? { cinfProviders: endpoint.providers } : {}) });
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
    admitSliderState(endpoint, state);
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
      },
      partAt: (x, y) => {
        const { part } = sliderPartAt(state, { x, y });
        return (names.find(([, code]) => code === part)?.[0] ?? null) as NonNullable<SliderOptions['pressedPart']> | null;
      },
      ...(trace ? { trace } : {}),
    };
  });
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
  inputTheme: ThemeInput,
  opts: DisclosureOptions = {},
): Promise<PixelBuffer | null> {
  return withThemeView(inputTheme, async theme => {
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
  });
}

export interface TabOptions {
  label?: string;
  /** Opt-in actual selection/paint decisions; no historical typography claim. */
  diagnostics?: ControlDiagnostics;
  /** The SELECTED tab uses the "front"/"on" cicn (taller, raised); an
   *  unselected tab uses the shorter "rear"/"off" cicn. */
  selected?: boolean;
}

/** Compose one resting enabled segmented tab (engine/tab.md modern facade). */
export async function composeTab(theme: ThemeInput, opts: TabOptions = {}): Promise<PixelBuffer | null> {
  return composeEngineTab(theme, opts);
}

/**
 * Compose a window grow box (the bottom-right resize control) from the
 * scheme's cicn — active -14333 (apple-platinum-2 uses -14330) /
 * inactive -14334. Stamped 1:1 (it's a fixed-size corner glyph, 15–20px).
 * Returns null when the scheme ships no grow box (→ caller's CSS fallback).
 */
export async function composeGrowBox(
  inputTheme: ThemeInput,
  opts: { state?: ControlState } = {},
): Promise<PixelBuffer | null> {
  return withThemeView(inputTheme, async theme => {
    const inactive = opts.state === 'inactive';
    if (inactive) return loadById(theme, 14334);
    return (await loadById(theme, 14333)) ?? (await loadById(theme, 14330));
  });
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
export async function composeProgress(theme: ThemeInput, opts: ProgressOptions = {}): Promise<PixelBuffer> {
  return (await composeProgressFrame(theme, opts)).buffer;
}

const int16 = (name: string, v: number): number => {
  const D = PROGRESS_VALUE_DOMAIN;
  if (!Number.isInteger(v) || v < D.min || v > D.max) throw new RangeError(`composeProgress: range.${name} must be a 16-bit signed integer`);
  return v;
};

/** Compose one progress frame (DECISIONS #11): draws once and reports the phase after the draw. */
export async function composeProgressFrame(inputTheme: ThemeInput, opts: ProgressOptions & { trace?: boolean } = {}): Promise<ProgressFrame> {
  return withThemeView(inputTheme, async theme => {
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
    if (res.path === null) throw new Error('composeProgress: engine skipped a visible, nonempty progress bar');
    return { buffer: out, phase: res.phase, path: res.path, ...(trace ? { trace } : {}) };
  });
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

interface FaceOptions { composition: ControlCompositionSnapshot; trace?: ControlTraceCollector | undefined; label?: string; fontSize: number; disabled?: boolean; minWidth: number; fg?: string; height?: number; }

function buttonFontSize(value: number | undefined): number {
  const size = value === undefined ? 12 : value;
  if (!Number.isFinite(size) || size < 6) throw new RangeError('fontSize must be finite and at least 6 CSS pixels');
  return size;
}

/** Retained legacy admission produces typed operations, never serialized cinf facts. */
async function prepareBevelFrame(face: ResolvedControlFace, opts: FaceOptions, width: number, height: number,
  validBg: boolean, sampled: readonly number[]): Promise<PreparedCinfFrame | null> {
  const e = face.element, request = e.bodyRequest, slice = e.slice;
  if (!slice) return null;
  const owner = { baseUrl: face.theme.origin, chainDepth: face.chainDepth };
  let value: PixelBuffer | { pixmap: PixelBuffer; pixelSize: number; unmasked: PixelBuffer | null } | undefined;
  let step: ControlResolutionStep | undefined, transport: { assetUrl: string; derivedPath?: string } | undefined;
  let missing = false, rawEligible = false;
  const common = { role: 'body-fill' as const, requestedId: request?.resourceId ?? 0, bodyMode: request?.mode ?? 0,
    requestedResourceType: request?.mode === 5 ? 'cicn' as const : 'ppat' as const,
    basis: 'compatibility-policy' as const, usage: 'paint' as const, owner };
  const reject = (reason: string) => opts.trace?.record({ ...common, action: 'fallback', reason });
  const validRequest = request && Number.isInteger(request.resourceId) && request.resourceId >= -32768 && request.resourceId <= 32767;
  const validSlice = [slice.corner, slice.side].every(n => Number.isInteger(n) && n >= 0 && n <= 255);
  if (request?.mode === 5) {
    const binding = e.cicnBody;
    if (!validRequest || !validSlice) reject('cicn-body-invalid-request-or-slice');
    else if (!binding || binding.model !== 'kaleidoscope-2.3.1-cicn-body-v1' || binding.selectionPolicy !== 'unique-same-face-owner'
      || binding.requestedId !== request.resourceId) reject('cicn-body-binding-unavailable');
    else if (binding.status === 'missing' && binding.reason === 'same-owner-resource-absent') {
      missing = rawEligible = true;
      opts.trace?.record({ ...common, action: 'missing', reason: binding.reason });
    } else if (binding.status !== 'ready') reject(`cicn-body-${binding.status}:${binding.reason}`);
    else {
      const target = face.theme.manifest.chromeElements[binding.manifestKey], r = binding.sourceRect;
      if (!target || target.sourceCicnId !== request.resourceId || binding.reason !== 'unique-source-occurrence'
        || !ownerDisplayPolicyMatches(face.theme.manifest, binding.displayPolicy) || ![1, 2, 4, 8].includes(binding.pixelSize)
        || !r || r.x !== 0 || r.y !== 0 || !Number.isInteger(r.w) || r.w <= 0 || r.w !== target.width
        || !Number.isInteger(r.h) || r.h <= 0 || r.h !== target.height || typeof binding.asset !== 'string' || !binding.asset
        || (binding.pixelSize === 1 ? binding.copy !== 'masked' || binding.asset !== target.asset || binding.derivedPath !== undefined
          : binding.copy !== 'unmasked' || !/^cicn-body\/[^/]+\.png$/.test(binding.derivedPath ?? '')))
        reject('cicn-body-invalid-source-binding');
      else if (width - 2 * slice.side !== r.w || height - 2 * slice.side !== r.h) reject('cicn-body-scaling-unsupported');
      else {
        const context = opts.composition;
        let visible = false;
        for (let y = slice.side; y < height - slice.side && !visible; y++) for (let x = slice.side; x < width - slice.side; x++)
          if (controlPointVisible(context, x, y)) { visible = true; break; }
        if (!visible) reject('cicn-body-outside-clip');
        else {
          const resource = resourceIdentity({ ...face, element: target, key: binding.manifestKey }, '');
          const raster = face.theme.asset(binding.asset), targetRaster = face.theme.asset(target.asset);
          const copy = binding.copy, derivedPath = binding.derivedPath;
          const pixels = await raster.pixels();
          let validAlpha = true;
          for (let i = 3; validAlpha && i < pixels.data.length; i += 4)
            validAlpha = copy === 'unmasked' ? pixels.data[i] === 255 : pixels.data[i] === 0 || pixels.data[i] === 255;
          if (pixels.width !== r.w || pixels.height !== r.h) reject('cicn-body-decoded-size-mismatch');
          else if (!validAlpha) reject('cicn-body-alpha-mismatch');
          else {
            const [assetUrl, targetUrl] = opts.trace ? await Promise.all([raster.imageUrl(), targetRaster.imageUrl()]) : [raster.key, targetRaster.key];
            value = { pixmap: pixels, pixelSize: binding.pixelSize, unmasked: copy === 'unmasked' ? pixels : null };
            transport = { assetUrl: assetUrl!, ...(derivedPath ? { derivedPath } : {}) };
            step = { ...common, action: 'selected', reason: 'same-owner-cicn-body-paint', resource: { ...resource, assetUrl: targetUrl! } };
          }
        }
      }
    }
  } else if (request && Number.isInteger(request.mode) && request.mode >= 0 && request.mode <= 255) {
    const patterns = face.theme.manifest.patterns ?? {}, visited = new Set<string>();
    const rejected: { step: ControlResolutionStep; source?: RasterSource }[] = [];
    let key: string | undefined, reason = 'unique-id-pattern-paint', ambiguous = false;
    for (const [candidate, linkedReason] of [[e.bodyPattern, 'carried-body-pattern-paint'], [e.bgPattern, 'legacy-linked-pattern-paint']] as const) {
      if (!candidate || visited.has(candidate)) continue;
      visited.add(candidate);
      const p = patterns[candidate];
      if (p?.sourcePpatId === request.resourceId) { key = candidate; reason = linkedReason; break; }
      if (opts.trace) rejected.push({ ...(p ? { source: face.theme.asset(p.asset) } : {}), step: { ...common, action: 'rejected', reason: 'linked-pattern-id-mismatch',
        ...(p ? { resource: { type: 'ppat', signedId: p.sourcePpatId ?? null, sourceCinfId: null, manifestKey: candidate, assetUrl: '',
          ...(p.byteProvenance ? { byteProvenance: { ...p.byteProvenance } } : {}) } } : {}) } });
    }
    if (!key) for (const candidate of Object.keys(patterns)) if (patterns[candidate]!.sourcePpatId === request.resourceId) {
      if (key !== undefined) { ambiguous = true; break; }
      key = candidate;
    }
    const pattern = !ambiguous && key ? patterns[key] : undefined;
    const raster = pattern ? face.theme.asset(pattern.asset) : undefined;
    const resource = pattern ? { type: 'ppat' as const, signedId: pattern.sourcePpatId ?? null, sourceCinfId: null, manifestKey: key!, assetUrl: '',
      ...(pattern.byteProvenance ? { byteProvenance: { ...pattern.byteProvenance } } : {}) } : undefined;
    for (const rejectedLink of rejected) opts.trace?.record({ ...rejectedLink.step,
      ...(rejectedLink.step.resource && rejectedLink.source ? { resource: { ...rejectedLink.step.resource, assetUrl: await rejectedLink.source.imageUrl() } } : {}) });
    if (raster) {
      value = await raster.pixels();
      step = { ...common, action: 'selected', reason, resource: { ...resource!, assetUrl: opts.trace ? await raster.imageUrl() : raster.key } };
      opts.trace?.record(step);
    } else {
      opts.trace?.record({ ...common, action: 'missing', reason: ambiguous ? 'ambiguous-legacy-pattern-order' : 'same-face-owner-pattern-unavailable' });
      rawEligible = !ambiguous && !!validRequest && validSlice;
    }
  } else if (request) reject('body-mode-or-geometry-not-implemented');
  const samples = e.colorSamples, bg = e.bgAnchor, raw = samples?.background;
  const triple = (v: readonly number[] | undefined, max: number) => Array.isArray(v) && v.length === 3 && v.every(n => Number.isInteger(n) && n >= 0 && n <= max);
  const rawBg = rawEligible && !e.colorSamplesUnavailableReason && samples?.model === 'kdef-2.3.1-color'
    && ownerDisplayPolicyMatches(face.theme.manifest, samples.displayPolicy) && raw && triple(raw.rgb16, 65535) && triple(raw.displayRgb, 255)
    && bg && Number.isInteger(bg[0]) && Number.isInteger(bg[1]) && bg[0] >= 0 && bg[0] < face.buffer.width && bg[1] >= 0 && bg[1] < face.buffer.height
    ? raw.displayRgb : null;
  if (face.consumedCinf && !value && (!rawEligible || !rawBg))
    throw new CinfEnvironmentError('Declared cinf body pattern or background unavailable', 'UNSUPPORTED_CINF_ENVIRONMENT');
  if (missing && !rawBg) reject('missing-cicn-body-background-unverified');
  if (!value && !rawBg && !validBg) return null;
  if (missing && rawBg) step = { ...common, basis: 'source-dispatch', action: 'missing', reason: 'missing-cicn-body-erase-union' };
  const rgb = rawBg ?? (validBg ? sampled : null);
  const bodyProvider = { ...mapProvider('prepared:bevel-body', 'archive', value ? [[`${common.requestedResourceType}:${common.requestedId}`, value]] : []),
    selection: () => step, ...(transport ? { unmaskedSource: () => transport } : {}) };
  return { geometry: { cornerSize: slice.corner, sideThickness: slice.side, tileSides: slice.tile },
    bodyMode: request?.mode ?? 0, bodyId: request?.resourceId ?? 0, bodyProvider,
    background: rgb ? { r: rgb[0]!, g: rgb[1]!, b: rgb[2]!, a: 255 } : null, rawBackground: !!rawBg,
    ...(step ? { step } : {}) };
}

/** One facade over prepared engine icons or rectangular legacy artwork. */
async function composeFaceButton(
  resolved: ResolvedControlFace,
  opts: FaceOptions,
): Promise<PixelBuffer> {
  const label = opts.label ?? '';
  const { buffer: face, element: faceEl } = resolved;
  if (resolved.consumedCinf?.status === 'no-body-or-border') {
    const width = Math.max(opts.minWidth, 16), height = resolveControlHeight(face, opts.height);
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
  // Legacy button manifests retain their prior policy.
  const colors = controlTextColors(faceEl, opts.fg, fallbackFg, resolved.theme.manifest);
  const fg = colors.foreground;
  opts.trace?.textColors({ ...colors, labelPainted: label.length > 0,
    deviceMode: 'full-color-policy', sourceManifestKey: resolved.key, sourceOwnerDepth: resolved.chainDepth });
  let lineH = resolveControlHeight(face, opts.height);
  // kDEF reads effective port txSize (0x7546/0x754a), not Rect height.
  const fontSize = opts.fontSize!;
  const glyphs = label ? rasterizeText(label, fontSize, fg) : null;
  // A cicn is a resizable template, not a minimum control rectangle. Tiny
  // templates (e.g. a 5×6 face) cannot contain even our smallest label raster.
  // Use the existing standard height without changing the button font size.
  // Caller-specified heights remain authoritative, including compact controls.
  if (opts.height == null && glyphs && glyphs.height > lineH) {
    lineH = APPLE_PUSH_BUTTON_HEIGHT;
  }
  const innerW = Math.max(opts.minWidth, (glyphs ? glyphs.width : 0) + 16);
  const innerH = lineH;
  if (![innerW, innerH].every(n => Number.isInteger(n) && n > 0 && n <= 32767))
    throw new RangeError('Bevel allocation dimensions must be positive bounded integers');
  const out = PixelBuffer.alloc(innerW, innerH);
  const context = opts.composition ?? snapshotControlComposition();
  const D = rect(0, 0, innerH, innerW);
  const clip = context.clip.kind === 'rect' ? rect(context.clip.rect.y - context.controlOrigin[1],
    context.clip.rect.x - context.controlOrigin[0], context.clip.rect.y + context.clip.rect.h - context.controlOrigin[1],
    context.clip.rect.x + context.clip.rect.w - context.controlOrigin[0]) : undefined;
  let legacyFacePaint: LegacyFacePaint | undefined;
  opts.trace?.composition({ context, originalPortState: 'unverified',
    faceRect: { x: context.controlOrigin[0], y: context.controlOrigin[1], w: innerW, h: innerH },
    appliedUnknownPatternOffset: context.patternOrigin.status === 'unknown' });
  const frame = await prepareBevelFrame(resolved, opts, innerW, innerH, !!validBg, [cr, cg, cb]);
  let engineTrace: EngineTrace | undefined;
  if (frame) {
    const matches = (a: ChromeElement['samplingEquivalence'] | ChromeElement['sampledBandAsset']) =>
      a?.model === 'kaleidoscope-2.3.1-opaque-sampling-v1' && a.comparison === 'opaque-current-display-rgb'
        && ownerDisplayPolicyMatches(resolved.theme.manifest, a.displayPolicy) && a.width === face.width && a.height === face.height;
    const proof = faceEl.samplingEquivalence, companion = faceEl.sampledBandAsset;
    const equivalent = !!matches(proof) && proof?.status === 'equivalent' && proof.reason === 'all-opaque-display-rgb-equal';
    const descriptor = matches(companion) && companion && typeof companion.asset === 'string' && /^cicn-sampled\/[^/]+\.png$/.test(companion.derivedPath)
      ? companion : undefined;
    const prepared = await prepareThemeIcon(resolved.theme, faceEl.sourceCicnId!, faceEl, resolved.raster,
      { pixels: face, lazySamples: true, traceProvenance: !!opts.trace, sampling: { equivalent, ...(descriptor ? { descriptor } : {}) } });
    const chain = new ResourceChain([]);
    await prepareCinfFrameSamples(chain, faceEl.sourceCicnId!, true, D, out, clip, undefined, prepared.icon, frame.geometry);
    engineTrace = opts.trace ? createTrace('bevel-button') : undefined;
    if (engineTrace) engineTrace.controlPaint = { bodies: [], bands: [], context, ...(clip ? { clip } : {}) };
    const result = drawCinfFrame(out, chain, { id: faceEl.sourceCicnId!, cicn: face, icon: prepared.icon, dstRect: D,
      bodyFill: true, prepared: frame, ...(resolved.loadedIdentity ? { selection: resolved.loadedIdentity } : {}),
      allocationOrigin: { x: context.controlOrigin[0], y: context.controlOrigin[1] },
      patternOffset: context.patternOrigin.status === 'known'
        ? { x: -context.patternOrigin.offset[0], y: -context.patternOrigin.offset[1] } : { x: 0, y: 0 },
    }, engineTrace);
    if (result.unsupported) throw new Error(`Unsupported bevel output: ${result.unsupported}`);
  } else {
    // Explicit rectangular compatibility recipe; no historical body claim.
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
    if (opts.trace && resolved.loadedIdentity) {
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
  if (glyphs) {
    const gx = Math.round((innerW - glyphs.width) / 2);
    const gy = Math.round((innerH - glyphs.height) / 2);
    if (colors.emboss) out.drawOver(rasterizeText(label, fontSize, colors.emboss), gx + 1, gy + 1);
    out.drawOver(glyphs, gx, gy);
  }
  if (context.clip.kind === 'rect') {
    for (let y = 0; y < innerH; y++) for (let x = 0; x < innerW; x++)
      if (!controlPointVisible(context, x, y)) out.setPixel(x, y, 0, 0, 0, 0);
  }
  for (const body of engineTrace?.controlPaint?.bodies ?? []) {
    if (body.bodyPaint?.branch === 'pattern-fill-union' && frame?.step) opts.trace?.completeBodyPaint(frame.step, body.bodyPaint);
    else opts.trace?.record(body);
  }
  for (const band of engineTrace?.controlPaint?.bands ?? []) opts.trace?.bandPaint(band);
  if (legacyFacePaint) opts.trace?.legacyFacePaint(legacyFacePaint);
  return out;
}

/** Compose a push face, label and optional default ring with the v2 engine. */
export async function composeButton(theme: ThemeInput, opts: ButtonOptions = {}, signal?: AbortSignal): Promise<PixelBuffer | null> {
  return (await composeButtonWithLayout(theme, opts, signal))?.buffer ?? null;
}

/** Internal adapter seam: actual face placement, never a second ring resolver. */
export async function composeButtonWithLayout(theme: ThemeInput, opts: ButtonOptions = {}, signal?: AbortSignal,
  preparedContext?: ControlCompositionSnapshot): Promise<ButtonComposition | null> {
  return withThemeView(theme, view => composeEnginePush(view, opts, signal, preparedContext));
}

/**
 * Compose a THEMED bevel button (toolbar / palette toggle). The scheme ships a
 * 12-cicn set — NORMAL size -10162..-10167 and SMALL size -10171..-10176, each laid
 * out [set/on: pressed, unpressed, inactive] then [clear/off: pressed, unpressed,
 * inactive]. Compose the state's face like the push button. Falls back within the
 * bundle (exact → same-value unpressed → -10163) and returns null (→
 * platinumBevelButton) when the scheme ships no bevel-button cicn for this state.
 */
export async function composeBevelButton(inputTheme: ThemeInput, opts: BevelButtonOptions = {}): Promise<PixelBuffer | null> {
  return withThemeView(inputTheme, async theme => {
    const state = opts.pressed ? 'pressed' : opts.disabled ? 'inactive' : 'active';
    return withControlDiagnostics(opts.diagnostics, 'bevel-button', {
      state, pressed: !!opts.pressed, disabled: !!opts.disabled, on: !!opts.on, small: !!opts.small,
    }, async trace => {
      const composition = snapshotControlComposition(opts.compositionContext);
      const preparedOptions = { ...opts, fontSize: buttonFontSize(opts.fontSize) };
      return composeBevelButtonWithTrace(theme, preparedOptions, composition, trace);
    });
  });
}

async function composeBevelButtonWithTrace(theme: ThemeView, opts: BevelButtonOptions, composition: ControlCompositionSnapshot,
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
  face = declaredBodyFace(theme, face, -reqId, opts.label ?? '', trace);
  const faceOpts: FaceOptions = { composition, trace, fontSize: opts.fontSize!, minWidth: opts.minWidth ?? (opts.small ? 18 : 22) };
  if (opts.label != null) faceOpts.label = opts.label;
  if (opts.disabled != null) faceOpts.disabled = opts.disabled;
  if (opts.fg != null) faceOpts.fg = opts.fg;
  if (opts.height != null) faceOpts.height = opts.height;
  return composeFaceButton(face, faceOpts);
}

/** Whole Appearance header surface with explicit Rect/state/clip and finite
 * source admission. Existing composeListHeader remains a column compatibility API. */
export async function composeHeaderSurface(theme: ThemeInput, opts: HeaderSurfaceOptions): Promise<HeaderSurfaceResult> {
  return composeEngineHeaderSurface(theme, opts);
}

export interface ListHeaderColumn { label: string; width: number; }
export interface ListHeaderOptions { columns?: ListHeaderColumn[]; height?: number; inactive?: boolean; }

/**
 * Compatibility multi-column/text helper, using -9567 active / -9568 inactive
 * art with the existing per-cell sizing, slicing and left-aligned label policy.
 * This is not the original whole-header call. See composeHeaderSurface for the
 * separately admitted Rect/state model. Returns null when the scheme ships none.
 */
export async function composeListHeader(theme: ThemeInput, opts: ListHeaderOptions = {}): Promise<PixelBuffer | null> {
  return composeEngineHeaderColumns(theme, opts);
}

/** Checkable Boolean mapping, browser fonts and archive/base environment are
 * declared public policies. The engine owns typed state selection and paint order. */
export async function composeCheckable(theme: ThemeInput, kind: 'checkbox' | 'radio', opts: CheckableOptions = {}): Promise<PixelBuffer | null> {
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
