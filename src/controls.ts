import { composeEngineCheckable, type CheckableOptions } from './checkableFacade.js';
import { withThemeView, type ThemeInput, type ThemeView, type RasterSource } from './ownedTheme.js';
import { composeEnginePush, loadEnginePushFace } from './pushButtonFacade.js';
import { CinfEnvironmentError, snapshotBodyCinfFace, type CinfLookupView } from '../tools/theme-loader/cinf-environment.js';
import type { PreparedBitmapFont } from './preparedBitmapFont.js';
import { cinfBorderPlan, cinfBodyRects, bodyWriteCount } from './engine/qd/cinfFrame.js';
import { ownerDisplayPolicyMatches, realizeRgb16 } from '../tools/theme-loader/display-profile.js';
import { snapshotControlComposition, bodyPatternPhase, controlPointVisible, type ControlCompositionContext, type ControlCompositionSnapshot, type ButtonComposition } from './controlComposition.js';
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
import { fillPattern } from './engine/qd/pattern.js';
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
import { themeResourceChain } from './engine/resources/theme.js';
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
interface ResolvedControlFace extends ResolvedFaceMetadata { declaredCinf?: NonNullable<ReturnType<typeof snapshotBodyCinfFace>>; buffer: PixelBuffer; loadedIdentity?: Pick<LegacyFacePaint, 'owner' | 'resource'>; }
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
  return { ...hit, ...(declaredCinf ? { declaredCinf } : {}), buffer: await raster.pixels(), ...(loadedIdentity ? { loadedIdentity } : {}) };
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

type PreparedCicnBody = { kind: 'missing' | 'unsupported' } | { kind: 'ready'; buffer: PixelBuffer;
  sourceRect: { x: number; y: number; w: number; h: number }; side: number;
  step: ControlResolutionStep; copy: 'masked' | 'unmasked'; sourceAssetUrl: string; derivedPath?: string };

async function loadCicnBody(face: ResolvedControlFace, opts: FaceOptions, width: number, height: number,
  context: ControlCompositionSnapshot): Promise<PreparedCicnBody> {
  const request = face.element.bodyRequest!, binding = face.element.cicnBody;
  const common = { role: 'body-fill' as const, requestedId: request.resourceId, bodyMode: 5,
    requestedResourceType: 'cicn' as const, basis: 'compatibility-policy' as const, usage: 'paint' as const,
    owner: { baseUrl: face.theme.origin, chainDepth: face.chainDepth } };
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
    resource: resourceIdentity({ theme: face.theme, element: target, key: binding.manifestKey, chainDepth: face.chainDepth }, '') };
  const raster = face.theme.asset(binding.asset), targetRaster = face.theme.asset(target.asset);
  const copy = binding.copy, derivedPath = binding.derivedPath;
  const buffer = await raster.pixels();
  if (buffer.width !== sourceRect.w || buffer.height !== sourceRect.h) return reject('cicn-body-decoded-size-mismatch');
  for (let i = 3; i < buffer.data.length; i += 4)
    if (copy === 'unmasked' ? buffer.data[i] !== 255 : buffer.data[i] !== 0 && buffer.data[i] !== 255)
      return reject('cicn-body-alpha-mismatch');
  const [url, targetUrl] = opts.trace ? await Promise.all([raster.imageUrl(), targetRaster.imageUrl()]) : [raster.key, targetRaster.key];
  const selected = { ...step, resource: { ...step.resource!, assetUrl: targetUrl! } };
  return { kind: 'ready', buffer, sourceRect, side: inset, step: selected, copy, sourceAssetUrl: url!, ...(derivedPath ? { derivedPath } : {}) };
}

async function loadBodyPattern(face: ResolvedControlFace, opts: FaceOptions): Promise<{ buffer: PixelBuffer | null; solidFallback: boolean; selection?: ControlResolutionStep }> {
  const request = face.element.bodyRequest;
  if (!request) return { buffer: null, solidFallback: false }; // Legacy manifests have no observed raw request.
  const common = { role: 'body-fill' as const, requestedId: request.resourceId, bodyMode: request.mode,
    requestedResourceType: request.mode === 5 ? 'cicn' as const : 'ppat' as const,
    basis: 'compatibility-policy' as const, usage: 'paint' as const,
    owner: { baseUrl: face.theme.origin, chainDepth: face.chainDepth } };
  if (!Number.isInteger(request.mode) || request.mode < 0 || request.mode > 255 || request.mode === 5 || !face.element.slice) {
    opts.trace?.record({ ...common, action: 'fallback', reason: request.mode === 5 ? 'cicn-body-not-implemented' : 'body-mode-or-geometry-not-implemented' });
    return { buffer: null, solidFallback: false };
  }
  const patterns = face.theme.manifest.patterns ?? {};
  const rejected: { step: ControlResolutionStep; raster: RasterSource | undefined }[] = [];
  const reportRejected = async () => {
    for (const { step, raster } of rejected) {
      const resource = step.resource && raster ? { ...step.resource, assetUrl: await raster.imageUrl() } : undefined;
      opts.trace?.record({ ...step, ...(resource ? { resource } : {}) });
    }
  };
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
    if (opts.trace) rejected.push({ raster: linked ? face.theme.asset(linked.asset) : undefined, step: { ...common, action: 'rejected', reason: 'linked-pattern-id-mismatch', ...(linked ? { resource: {
      type: 'ppat', signedId: linked.sourcePpatId ?? null, sourceCinfId: null, manifestKey: candidate,
      assetUrl: '', ...(linked.byteProvenance ? { byteProvenance: { ...linked.byteProvenance } } : {}),
    } } : {}) } });
  }
  if (!key) {
    for (const candidate of Object.keys(patterns)) {
      if (patterns[candidate]!.sourcePpatId !== request.resourceId) continue;
      if (key !== null) {
        await reportRejected();
        opts.trace?.record({ ...common, action: 'missing', reason: 'ambiguous-legacy-pattern-order' });
        return { buffer: null, solidFallback: false };
      }
      key = candidate;
    }
  }
  const pattern = key ? patterns[key] : undefined;
  const raster = pattern ? face.theme.asset(pattern.asset) : undefined;
  const resource = pattern && opts.trace ? { type: 'ppat' as const, signedId: pattern.sourcePpatId ?? null, sourceCinfId: null, manifestKey: key!,
    assetUrl: '', ...(pattern.byteProvenance ? { byteProvenance: { ...pattern.byteProvenance } } : {}) } : undefined;
  await reportRejected();
  if (!pattern) {
    opts.trace?.record({ ...common, action: 'missing', reason: 'same-face-owner-pattern-unavailable' });
    // Current same-owner lookup miss corresponds to the full-color solid path.
    // This is not proof of historical Resource Manager search ownership.
    const solidFallback = Number.isInteger(request.resourceId) && request.resourceId >= -32768 && request.resourceId <= 32767
      && [face.element.slice.corner, face.element.slice.side].every(value => Number.isInteger(value) && value >= 0 && value <= 255);
    return { buffer: null, solidFallback };
  }
  const buffer = await raster!.pixels();
  const selection: ControlResolutionStep | undefined = resource ? { ...common, action: 'selected', reason: selectionReason,
    resource: { ...resource, assetUrl: await raster!.imageUrl() } } : undefined;
  if (selection) opts.trace?.record(selection);
  return { buffer, solidFallback: false, ...(selection ? { selection } : {}) };
}

/**
 * Compose a button face and its label. For explicit cinf metadata with a valid
 * solid background sample, use kDEF 0x10fc0 → 0x107fe: fill the inset cross,
 * then paint square corners and independent masked edge bands. Full-color pattern bodies use the same
 * inset union with explicit port phase. Unsupported button body modes
 * retain their compatibility approximation. Text RGB/emboss use preserved samples
 * from 0x10922–0x10990; font metrics and browser alpha-over remain policies.
 */
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
  const out = PixelBuffer.alloc(innerW, innerH);
  const context = opts.composition ?? snapshotControlComposition();
  const bodyRects = cinfBodyRects(rect(0, 0, innerH, innerW), fIns, fSide);
  const pixelBodyRects = bodyRects.map(r => rect(Math.ceil(r.top), Math.ceil(r.left), Math.ceil(r.bottom), Math.ceil(r.right)));
  const clip = context.clip.kind === 'rect' ? rect(context.clip.rect.y - context.controlOrigin[1],
    context.clip.rect.x - context.controlOrigin[0], context.clip.rect.y + context.clip.rect.h - context.controlOrigin[1],
    context.clip.rect.x + context.clip.rect.w - context.controlOrigin[0]) : undefined;
  // A completed body dependency describes a published composition, not an
  // intermediate offscreen write. Borders can still decode asynchronously.
  let mode5PaintStep: ControlResolutionStep | undefined;
  let patternPaint: NonNullable<ControlResolutionStep['bodyPaint']> | undefined;
  let legacyFacePaint: LegacyFacePaint | undefined;
  opts.trace?.composition({ context, originalPortState: 'unverified',
    faceRect: { x: context.controlOrigin[0], y: context.controlOrigin[1], w: innerW, h: innerH },
    appliedUnknownPatternOffset: context.patternOrigin.status === 'unknown' });
  const mode5 = faceEl.bodyRequest?.mode === 5;
  const cicnBody = mode5 ? await loadCicnBody(resolved, opts, innerW, innerH, context) : null;
  const body = mode5 ? { buffer: null, solidFallback: cicnBody?.kind === 'missing' }
    : await loadBodyPattern(resolved, opts);
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
    basis: 'compatibility-policy', usage: 'paint', owner: { baseUrl: resolved.theme.origin, chainDepth: resolved.chainDepth },
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
    // Both insets share the original phase. The final face clip clears writes
    // outside the declared port; coverage counts the overlapping union once.
    for (const box of pixelBodyRects) fillPattern(out, box, pattern, { x: -phaseX, y: -phaseY });
    const paintedPixels = pattern.width > 0 && pattern.height > 0 ? bodyWriteCount(out, pixelBodyRects, clip) : 0;
    if (opts.trace && body.selection && paintedPixels) {
      const unionRects = bodyRects.map(r => ({ x: Math.max(0, r.left), y: Math.max(0, r.top),
        w: Math.max(0, Math.min(innerW, r.right) - Math.max(0, r.left)),
        h: Math.max(0, Math.min(innerH, r.bottom) - Math.max(0, r.top)) })).filter(r => r.w > 0 && r.h > 0);
      patternPaint = { branch: 'pattern-fill-union', coordinateSpace: 'face-local-before-ring',
        unionRects, paintedPixels, sourceAssetUrl: body.selection.resource!.assetUrl,
        sourceSize: [pattern.width, pattern.height], context,
        phase: { basis: 'modern-composition-policy', offset: [phaseX, phaseY], originalPatternPhase: 'unverified' } };
    }
    out.drawOver(await composeControlBorder(resolved, innerW, innerH, opts, (x, y) => controlPointVisible(context, x, y)), 0, 0);
  } else if (faceEl.slice && (sourceBg || validBg)) {
    // 0x10b72–0x10bb8 erases two rectangles using the sampled background:
    // inset(horizontal=corner, vertical=side), then the transposed insets.
    // Their union is a cross when corner != side. Fill precedes the border,
    // so transparent edge samples reveal the body without erasing earlier art.
    const [br, bgc, bb] = sourceBg ?? [cr, cg, cb];
    for (const r of bodyRects) out.fillRect({ x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top }, br!, bgc!, bb!, 255);
    if (cicnBody?.kind === 'missing' && sourceBg) {
      const paintedPixels = bodyWriteCount(out, pixelBodyRects, clip);
      if (paintedPixels) mode5PaintStep = { role: 'body-fill', requestedId: faceEl.bodyRequest!.resourceId, bodyMode: 5,
        requestedResourceType: 'cicn', basis: 'source-dispatch', usage: 'paint', action: 'missing',
        owner: { baseUrl: resolved.theme.origin, chainDepth: resolved.chainDepth }, reason: 'missing-cicn-body-erase-union',
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
  if (patternPaint && body.selection) opts.trace?.completeBodyPaint(body.selection, patternPaint);
  if (mode5PaintStep) opts.trace?.record(mode5PaintStep);
  if (legacyFacePaint) opts.trace?.legacyFacePaint(legacyFacePaint);
  return out;
}

/** Bevel compatibility transfers consume shared cinf geometry in painter order. */
async function composeControlBorder(resolved: ResolvedControlFace, width: number, height: number,
  opts: Pick<FaceOptions, 'trace'>, visible: (x: number, y: number) => boolean): Promise<PixelBuffer> {
  const { buffer: source, element } = resolved;
  const out = PixelBuffer.alloc(width, height);
  const c = Math.max(0, element.slice?.corner ?? sliceInset(source.width, source.height));
  const side = Math.max(0, element.slice?.side ?? c);
  const repeat = element.slice?.tile ?? false;
  const regions = cinfBorderPlan(source, { cornerSize: c, sideThickness: side, tileSides: repeat }, rect(0, 0, height, width));
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
  let sampledRaster: RasterSource | undefined, sampledImage: string | undefined;
  for (const [regionIndex, region] of regions.entries()) {
    const { src: { left: sx, top: sy }, dst: { left: dx, top: dy }, extents: [rw, rh, dw, dh] } = region;
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
      attempted = true;
      sampledRaster = resolved.theme.asset(companion.asset);
      const decoded = await sampledRaster.pixels();
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
    if (opaqueUsed && opts.trace && policy === 'sampled-companion') sampledImage ??= await sampledRaster!.imageUrl();
    if (opaqueUsed) opts.trace?.bandPaint({ role: 'face', region: regionIndex, branch, policy,
      owner: { baseUrl: resolved.theme.origin, chainDepth: resolved.chainDepth }, resource: resolved.loadedIdentity!.resource,
      ...(policy === 'sampled-companion' && companion ? { derived: { path: companion.derivedPath,
        assetUrl: sampledImage!, model: companion.model, displayPolicy: companion.displayPolicy } } : {}) });
  }
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
