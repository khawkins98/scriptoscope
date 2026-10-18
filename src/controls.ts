import { ownerDisplayPolicyMatches } from '../tools/theme-loader/display-profile.js';
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
import { withControlDiagnostics, type ControlDiagnostics, type ControlTraceCollector, type ControlResolutionStep, type LegacyFacePaint } from './controlDiagnostics.js';

/** 9-slice corner inset for a control cicn — matches the kDEF's ~6px for
 *  a 15px button face (FUN_30a8): floor((min(w,h)-3)/2). */
function sliceInset(w: number, h: number): number {
  return Math.max(2, Math.floor((Math.min(w, h) - 3) / 2));
}

/**
 * Measure a border-ring cicn's border thickness: scan in from the middle
 * row/column until alpha drops out (the transparent interior begins). Used
 * to inset a progress track inside its frame and to size the frame's
 * 9-slice corners. Falls back to a small inset if the cicn has no
 * transparent interior.
 */
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

function frameBorder(buf: PixelBuffer): number {
  const my = buf.height >> 1;
  let l = 0;
  while (l < buf.width && buf.getPixel(l, my)[3] >= 40) l++;
  const mx = buf.width >> 1;
  let t = 0;
  while (t < buf.height && buf.getPixel(mx, t)[3] >= 40) t++;
  if (l >= buf.width >> 1 || t >= buf.height >> 1) return Math.max(1, Math.min(2, (Math.min(buf.width, buf.height) - 1) >> 1));
  return Math.max(1, Math.min(l, t));
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
interface ResolvedFaceMetadata { theme: LoadedTheme; element: ChromeElement; key: string; chainDepth: number; }
interface ResolvedControlFace extends ResolvedFaceMetadata { buffer: PixelBuffer; loadedIdentity?: Pick<LegacyFacePaint, 'owner' | 'resource'>; }
type TraceLookup = Pick<ControlResolutionStep, 'role' | 'basis' | 'usage'>;
const FACE_LOOKUP: TraceLookup = { role: 'face', basis: 'source-dispatch', usage: 'paint' };

function resourceIdentity(hit: ResolvedFaceMetadata): Extract<NonNullable<ControlResolutionStep['resource']>, { type: 'cicn' }> {
  return { type: 'cicn', signedId: Number.isInteger(hit.element.sourceCicnId) ? hit.element.sourceCicnId! : null,
    sourceCinfId: Number.isInteger(hit.element.sourceCinfId) ? hit.element.sourceCinfId! : null, manifestKey: hit.key,
    assetUrl: assetUrl(hit.theme, hit.element.asset),
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
  const url = assetUrl(hit.theme, hit.element.asset);
  const resource = trace ? resourceIdentity(hit) : undefined;
  const loadedIdentity = resource ? {
    owner: { baseUrl: hit.theme.baseUrl, chainDepth: hit.chainDepth },
    resource: { ...resource, assetUrl: url, ...(resource.byteProvenance ? { byteProvenance: { ...resource.byteProvenance } } : {}) },
  } : undefined;
  return { ...hit, buffer: await loadCicnBuffer(url), ...(loadedIdentity ? { loadedIdentity } : {}) };
}

async function loadFaceById(theme: LoadedTheme, id: number, trace?: ControlTraceCollector,
  lookup: TraceLookup = FACE_LOOKUP): Promise<ResolvedControlFace | null> {
  const hit = resolveFaceById(theme, id, trace, lookup);
  return hit ? loadResolvedFace(hit, trace) : null;
}

async function loadById(theme: LoadedTheme, id: number): Promise<PixelBuffer | null> {
  return (await loadFaceById(theme, id))?.buffer ?? null;
}

/**
 * Load an `ics4` GLYPH (a scheme's own pictogram) by its Kaleidoscope
 * RESOURCE ID and return it as a PixelBuffer. Mirrors {@link loadById}, but
 * resolves through the `glyphs` map {@link loadTheme} built from the bundle's
 * `icons/index.json` (id-string → `icons/ics4-<id>.png`) rather than the
 * chrome-cicn catalogue. Walks the base chain so a lightly-skinned scheme can
 * inherit a base scheme's glyphs. Returns null when no scheme in the chain
 * ships that glyph (→ the caller's procedural fallback). The id is passed as a
 * NEGATIVE resource id (e.g. -10198), matching how icons/index.json keys them.
 */
async function loadGlyphById(theme: LoadedTheme, id: number): Promise<PixelBuffer | null> {
  const hit = resolveInChain(theme, (t) => {
    const asset = t.glyphs?.[String(id)];
    return asset ? { theme: t, asset } : null; // first theme in the chain that ships it
  });
  return hit ? loadCicnBuffer(assetUrl(hit.theme, hit.asset)) : null;
}

/**
 * SELF-ONLY variants of {@link loadById} / {@link loadGlyphById}: resolve a
 * control resource on the scheme ITSELF, never walking the base chain. Used for
 * controls whose art a scheme must OWN to render faithfully (checkbox/radio) —
 * a scheme that ships none falls to the PROCEDURAL Platinum glyph rather than
 * inheriting from an unrelated base bundle. The corner-sprite schemes —
 * apple-platinum-2 / platinum-8 / system7-nostalgia-silver — ship a control-
 * glyph ics4 family (-10197..-10240: scroll arrows, slider/indicator thumb orbs,
 * push-button faces, window-widget boxes) but NO checkbox/radio art in it
 * (verified by pixel-decode; the kDEF 2.3.1 has no -9488..-9504 immediate either
 * — see docs/spec/kdef231-reference.md §2.4), so self-resolution misses →
 * procedural Platinum, which is the faithful look for these Platinum-family
 * schemes. */
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

/** Runtime named-key preferences for the push-button face, by state. The
 *  list captures the synonyms different Kaleidoscope authoring tools emitted
 *  (`push-button-active` / `active-push-button` / `active-button` / bare
 *  `push-button`). Used by {@link loadPushButtonFace} to resolve via the
 *  manifest's friendly key before the raw kDEF id slot — the
 *  monkey-paradise + animals fix (both authored `solo-menu-background-2` onto
 *  id -10239 leaving no active push-button cicn, just inactive + pressed). */
const PUSH_BUTTON_FACE_KEYS = {
  active: ['push-button-active', 'active-push-button', 'active-button', 'push-button'],
  pressed: ['push-button-pressed', 'pressed-push-button', 'pressed-button'],
  inactive: ['push-button-inactive', 'inactive-push-button', 'inactive-button'],
} as const;

/** Compatibility rejection heuristic for labels/keys on push-button slots.
 * A matching label is observed metadata, not proof that the original engine
 * rejected the resource or that its author intended a different runtime role.
 *
 *  TWO detection paths share this regex:
 *    - PRIMARY: the bundle's `authorLabel` (the verbatim NAMED-resource label;
 *      e.g. animals + monkey-paradise both ship `-10239` with authorLabel
 *      "Solo Menu Background"). It preserves the author's words, while our
 *      interpretation of those words remains a runtime policy.
 *    - FALLBACK: the friendly chromeElement key (decoder-emitted slug). Used
 *      when authorLabel is missing — 9 of 18 bundles (1138, apple-platinum-2,
 *      etc.) ship no labels on the push-button slots.
 *
 *  The substring match is over-broad on the friendly-key path (parked #185:
 *  `dialog-button-active` would false-positive) but is the necessary fallback
 *  shape retained for compatibility with unlabelled bundles. */
const PUSH_BUTTON_FACE_ANTI_KEY_RE = /menu|tab.pane|pull.down|popup|window|dialog|scroll/i;

/** Resolve a push-button face via named keys, then numeric ID with an
 * anti-role label/key rejection heuristic. Walk the base chain self-first,
 * trying both strategies before inheriting. This is a runtime compatibility
 * policy for corpus aliases, not a verified historical role resolver: kDEF
 * 0x7572–0x7594 requests numeric IDs. A source label is evidence to review,
 * not proof of author intent. composeButton handles state fallback separately.
 */
export async function loadPushButtonFace(
  theme: LoadedTheme,
  state: keyof typeof PUSH_BUTTON_FACE_KEYS,
): Promise<PixelBuffer | null> {
  return (await resolvePushButtonFace(theme, state))?.buffer ?? null;
}

async function resolvePushButtonFace(
  theme: LoadedTheme,
  state: keyof typeof PUSH_BUTTON_FACE_KEYS,
  trace?: ControlTraceCollector,
): Promise<ResolvedControlFace | null> {
  const id = state === 'active' ? 10239 : state === 'pressed' ? 10238 : 10240;
  let chainDepth = -1;
  // Resource ownership outranks lookup spelling: a child's canonical slot wins
  // over a named base resource. Within each owner, authored role names win.
  const found = resolveInChain(theme, (t) => {
    chainDepth++;
    if (chainDepth > 0) traceOwner(trace, FACE_LOOKUP, id, t, chainDepth, 'fallback', 'base-inheritance');
    const ce = t.manifest.chromeElements ?? {};
    for (const k of PUSH_BUTTON_FACE_KEYS[state]) {
      if (ce[k]?.asset) {
        const hit = { theme: t, element: ce[k]!, key: k, chainDepth };
        traceHit(trace, { ...FACE_LOOKUP, basis: 'compatibility-policy' }, id, hit, 'selected', 'named-role');
        return hit;
      }
    }
    // Reject repurposed id slots before considering the next base theme.
    const ces = t.manifest.chromeElements ?? {};
    for (const [k, v] of Object.entries(ces)) {
      if (Math.abs(v.sourceCicnId ?? 0) !== id) continue;
      // Prefer the verbatim source label for this rejection heuristic.
      // The label itself is provenance; interpreting its words is policy.
      const hit = { theme: t, element: v, key: k, chainDepth };
      if (v.authorLabel && PUSH_BUTTON_FACE_ANTI_KEY_RE.test(v.authorLabel)) {
        traceHit(trace, { ...FACE_LOOKUP, basis: 'compatibility-policy' }, id, hit, 'rejected', 'anti-role-label');
        return null;
      }
      // Fallback check: the friendly key. Only consulted when the bundle
      // ships no authorLabel (9 of 18 corpus bundles — kept for back-compat).
      if (!v.authorLabel && PUSH_BUTTON_FACE_ANTI_KEY_RE.test(k)) {
        traceHit(trace, { ...FACE_LOOKUP, basis: 'compatibility-policy' }, id, hit, 'rejected', 'anti-role-key');
        return null;
      }
      traceHit(trace, v.sourceCicnId! > 0 ? { ...FACE_LOOKUP, basis: 'compatibility-policy' } : FACE_LOOKUP,
        id, hit, 'selected', v.sourceCicnId! > 0 ? 'positive-id-alias' : 'resource-id');
      return hit;
    }
    traceOwner(trace, FACE_LOOKUP, id, t, chainDepth, 'missing', 'missing-resource');
    return null;
  });
  return found ? loadResolvedFace(found, trace) : null;
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

/**
 * Draw a solid triangular scroll-arrow glyph centered in the size×size box
 * at (bx,by), pointing in `dir`. Platinum schemes (e.g. apple-platinum-2)
 * ship the arrow-button FACE as a cicn but leave the glyph itself to the
 * CDEF — so we stamp the face, then draw this glyph on top.
 */
function drawArrowGlyph(
  buf: PixelBuffer,
  bx: number,
  by: number,
  size: number,
  dir: 'l' | 'r' | 'u' | 'd',
  [r, g, b]: [number, number, number],
): void {
  const depth = Math.max(2, Math.floor((size - 6) / 2)); // ~3 for a 16px button
  const cx = bx + (size >> 1);
  const cy = by + (size >> 1);
  const off = Math.ceil(depth / 2);
  for (let d = 0; d <= depth; d++) {
    const halfH = depth - d; // full base at d=0, single-px tip at d=depth
    for (let t = -halfH; t <= halfH; t++) {
      let px: number, py: number;
      if (dir === 'r') { px = cx - off + d; py = cy + t; }
      else if (dir === 'l') { px = cx + off - d; py = cy + t; }
      else if (dir === 'd') { px = cx + t; py = cy - off + d; }
      else { px = cx + t; py = cy + off - d; }
      buf.setPixel(px, py, r, g, b, 255);
    }
  }
}

export type Orientation = 'horizontal' | 'vertical';
export type ControlState = 'normal' | 'pressed' | 'disabled' | 'inactive';

export interface ScrollbarOptions {
  orientation?: Orientation;
  /** Length along the scroll axis, in px (thickness is fixed by the cicn). */
  length?: number;
  /** Thumb position, 0..1. */
  value?: number;
  /** Thumb size as a fraction of the track, 0..1 (used when `proportional`). */
  thumbExtent?: number;
  /**
   * Thumb LENGTH model. `true` (default) = OS 8 Appearance proportional thumb
   * (length scales with `thumbExtent` / the content ratio); `false` = the classic
   * System 7 fixed-size thumb (the cicn's native length). Era preference — exposed so
   * a host can wire it to a user setting (System-7 vs Platinum scrolling).
   */
  proportional?: boolean;
  state?: ControlState;
}

/**
 * Locate the centred grip motif of a capsule thumb cicn along its long axis. The kDEF thumb is a
 * capsule — rounded end caps + a small grip in the CENTRE — that grows by stretching ONLY the
 * uniform body between cap and grip; the caps and grip stay 1:1 (verified on the corpus art:
 * `#oooooooXXXXXXXoooooo#` — flat edge, beveled body, a busy centre grip). The body is near-uniform
 * along the long axis, so the grip is the central run of lines that differ from a body reference
 * line. Returns the grip's native start+length, or null when there's no distinct centre motif.
 */
function thumbGrip(thumb: PixelBuffer, horiz: boolean): { start: number; len: number } | null {
  const len = horiz ? thumb.width : thumb.height;
  const cross = horiz ? thumb.height : thumb.width;
  if (len < 8) return null;
  const at = (i: number, j: number) => (horiz ? thumb.getPixel(i, j) : thumb.getPixel(j, i));
  const ref = Math.floor(len * 0.25); // a body line: inside the cap, outside the centre grip
  const diff = (i: number) => {
    let d = 0;
    for (let j = 0; j < cross; j++) {
      const p = at(i, j), r = at(ref, j);
      d += Math.abs(p[0] - r[0]) + Math.abs(p[1] - r[1]) + Math.abs(p[2] - r[2]) + Math.abs(p[3] - r[3]);
    }
    return d / cross; // avg per-cross-pixel RGBA delta from the body reference
  };
  const THRESH = 28;
  let gs = -1, ge = -1;
  for (let i = Math.floor(len * 0.2); i < Math.ceil(len * 0.8); i++) {
    if (diff(i) > THRESH) { if (gs < 0) gs = i; ge = i; }
  }
  return gs >= 0 ? { start: gs, len: ge - gs + 1 } : null;
}

/**
 * Compose a scrollbar into a pixel buffer (docs/spec/kdef231-reference.md §1.3 / §2.6):
 * stretch the track cicn along the axis, stamp the thumb at the
 * value-proportional position. 7 Le ships an empty (white) track + a
 * blue striped thumb; arrows are OS-baseline (not in the bundle).
 *
 * Returns null if the scheme ships no scrollbar cicns (baseline path).
 */
export async function composeScrollbar(
  theme: LoadedTheme,
  opts: ScrollbarOptions = {},
): Promise<PixelBuffer | null> {
  const orientation = opts.orientation ?? 'vertical';
  const length = Math.max(16, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0));
  const state = opts.state ?? 'normal';

  const horiz = orientation === 'horizontal';

  // Track cicn by RESOURCE ID. The state→id mapping is taken from the kDEF
  // scrollbar drawer (decompiled FUN_000066b4), which is authoritative — the
  // bundle slugs mislabel these (e.g. -8287 "empty" is the kDEF's disabled,
  // -8288 "disabled" is actually pressed):
  //   horizontal: active -8285 / inactive -8286 / disabled -8287 / pressed -8288
  //   vertical:   active -8277 / inactive -8278 / disabled -8279 / pressed -8280
  const idInactive = horiz ? 8286 : 8278;
  const idDisabled = horiz ? 8287 : 8279;
  const idPressed = horiz ? 8288 : 8280;
  const wantId = state === 'pressed' ? idPressed : state === 'disabled' ? idDisabled : idInactive;
  const track = (await loadById(theme, wantId)) ?? (await loadById(theme, idInactive));
  if (!track) return null; // baseline path

  // Thumb by resource id: -10206 h / -10208 v (pressed -10205 / -10207).
  const thumb = await loadById(theme, horiz ? (state === 'pressed' ? 10205 : 10206) : state === 'pressed' ? 10207 : 10208);

  // Arrow-BUTTON glyphs — the scheme's OWN ics4 pictograms for the end buttons.
  // The directional arrow family is -10197..-10204 (a 16×16 button: face + arrow +
  // bevel), NOT -10205..-10208 (those are the slider THUMB, h/v × normal/pressed).
  //
  // The normal/pressed id split is UNIVERSAL — it is NOT stored per scheme (the
  // scheme resource forks carry no CDEF/control template, only art). It is hardcoded
  // in Kaleidoscope's shared CDEF, decoded at kDEF231_0.asm:9f0e-9f38, which writes
  // BOTH ids per direction into the control record and selects at draw time by
  // contrlHilite — the PRESSED id for the one arrow under the mouse, the RAISED id
  // for the rest; a disabled control draws the RAISED art dimmed (there is no
  // separate inactive-arrow bitmap). Canonical table mirrored in
  // docs/spec/kdef231-reference.md §"Scroll-arrow ics4 family" — keep all three in sync.
  //   RAISED / normal: right -10201 · left -10202 · down -10203 · up -10204
  //   PRESSED:         right -10197 · left -10198 · down -10199 · up -10200
  // NB the scheme art APPEARANCE of each quartet varies (s7-nostalgia-silver's raised
  // set is a beveled 3-D arrow, platinum-8's is a boxed gray button whose pressed
  // quartet is a flat arrow), but the id→state mapping above is the engine's and we
  // apply it universally. CONSEQUENCE: platinum-8 (a 1998/Kaleidoscope-1.x scheme that
  // placed art the other way) renders its boxed -10202 at rest rather than the flat
  // -10198 its own preview shows — an accepted divergence (owner: follow the 2.3.1
  // decode universally, see kdef-faithfulness-ledger). Earlier these were swapped, so
  // every resting scrollbar drew the depressed arrows.
  // For a horizontal bar the LOW end is the left button, the HIGH end the right;
  // for vertical, low = up (top), high = down (bottom). These glyphs are the WHOLE
  // button (they carry their own face), so we stamp them in place of the
  // procedural face+triangle when the scheme ships them; otherwise fall back to
  // drawArrowGlyph so the sliced schemes + cicn-less schemes render unchanged.
  const pressed = state === 'pressed';
  const lowArrowId = horiz ? (pressed ? 10198 : 10202) : (pressed ? 10200 : 10204); // left / up
  const highArrowId = horiz ? (pressed ? 10197 : 10201) : (pressed ? 10199 : 10203); // right / down
  const lowArrow = await loadGlyphById(theme, -lowArrowId);
  const highArrow = await loadGlyphById(theme, -highArrowId);

  const thickness = horiz ? track.height : track.width;
  const longSrc = horiz ? track.width : track.height;
  const out = horiz ? PixelBuffer.alloc(length, thickness) : PixelBuffer.alloc(thickness, length);

  // Two cicn FORMATS (empirically, by aspect ratio):
  //  • wide composite (48×16, 43×16, 33×16 …) — the arrow boxes are baked
  //    into the two ends and the track sits between them. Render as a
  //    3-slice along the long axis: copy each end 1:1, stretch the middle.
  //    Arrows are part of the bitmap; we never stamp them separately.
  //  • single track cell (7 Le, 16×16) — square, no baked arrows (those
  //    are left to the OS). Stretch one interior slice for a clean track.
  const composite = longSrc >= thickness * 2;
  let trackStart = 0;
  let trackLen = length;

  if (composite) {
    // Read the artist's authored answer from the cinf when present (slice.corner
    // for the end-cap thickness, slice.tile for middle-band repeat vs stretch).
    // Mirrors composeFaceButton / composeProgress / composeTab — same shape, same
    // failure mode: stretching a pixel-rate tile pattern smears it at long lengths.
    const trackEl = elementById(theme, wantId);
    const end = trackEl?.slice?.corner ?? Math.min(thickness, Math.floor((longSrc - 1) / 2));
    const tileMid = !!trackEl?.slice?.tile;
    const mid = longSrc - end * 2;
    const dmid = length - end * 2;
    const drawMid = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void => {
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
      if (!tileMid) { out.copyBits(track, { x: sx, y: sy, w: sw, h: sh }, { x: dx, y: dy, w: dw, h: dh }); return; }
      // Tile mode: repeat the source slab across the destination axis at 1:1.
      const axisLen = horiz ? dw : dh;
      const slab = horiz ? sw : sh;
      for (let t = 0; t < axisLen; t += slab) {
        const r = Math.min(slab, axisLen - t);
        if (horiz) out.copyBits(track, { x: sx, y: sy, w: r, h: sh }, { x: dx + t, y: dy, w: r, h: sh });
        else        out.copyBits(track, { x: sx, y: sy, w: sw, h: r }, { x: dx, y: dy + t, w: sw, h: r });
      }
    };
    if (horiz) {
      out.copyBits(track, { x: 0, y: 0, w: end, h: thickness }, { x: 0, y: 0, w: end, h: thickness });
      out.copyBits(track, { x: longSrc - end, y: 0, w: end, h: thickness }, { x: length - end, y: 0, w: end, h: thickness });
      drawMid(end, 0, mid, thickness, end, 0, dmid, thickness);
    } else {
      out.copyBits(track, { x: 0, y: 0, w: thickness, h: end }, { x: 0, y: 0, w: thickness, h: end });
      out.copyBits(track, { x: 0, y: longSrc - end, w: thickness, h: end }, { x: 0, y: length - end, w: thickness, h: end });
      drawMid(0, end, thickness, mid, 0, end, thickness, dmid);
    }
    trackStart = end;
    trackLen = Math.max(0, length - end * 2);
  } else if (length >= thickness * 3) {
    // Single square cell = a Platinum arrow-BUTTON face with no baked glyph
    // (apple-platinum-2's 16×16 bevelled square). Stamp the face at both
    // ends as the two arrow buttons, stretch its interior for the track
    // between, then draw the arrow glyph procedurally (the CDEF's job).
    const btn = thickness;
    const arrowDark: [number, number, number] = state === 'disabled' ? [165, 165, 165] : [72, 72, 72];
    // Stamp an end button: prefer the scheme's OWN ics4 arrow-button glyph
    // (a complete face+arrow, centered in the button box); otherwise lay the
    // track-square face + the procedural triangle, exactly as before.
    const stampButton = (
      bx: number,
      by: number,
      glyph: PixelBuffer | null,
      dir: 'l' | 'r' | 'u' | 'd',
    ): void => {
      out.copyBits(track, { x: 0, y: 0, w: track.width, h: track.height }, { x: bx, y: by, w: btn, h: thickness });
      if (glyph) {
        out.drawOver(glyph, bx + Math.round((btn - glyph.width) / 2), by + Math.round((thickness - glyph.height) / 2));
      } else {
        drawArrowGlyph(out, bx, by, btn, dir, arrowDark);
      }
    };
    if (horiz) {
      const sx = Math.max(1, Math.min(track.width - 2, track.width >> 1));
      out.copyBits(track, { x: sx, y: 0, w: 1, h: track.height }, { x: btn, y: 0, w: length - btn * 2, h: thickness });
      stampButton(0, 0, lowArrow, 'l');
      stampButton(length - btn, 0, highArrow, 'r');
    } else {
      const sy = Math.max(1, Math.min(track.height - 2, track.height >> 1));
      out.copyBits(track, { x: 0, y: sy, w: track.width, h: 1 }, { x: 0, y: btn, w: thickness, h: length - btn * 2 });
      stampButton(0, 0, lowArrow, 'u');
      stampButton(0, length - btn, highArrow, 'd');
    }
    trackStart = btn;
    trackLen = Math.max(0, length - btn * 2);
  } else if (horiz) {
    const sx = Math.max(1, Math.min(track.width - 2, track.width >> 1));
    out.copyBits(track, { x: sx, y: 0, w: 1, h: track.height }, { x: 0, y: 0, w: length, h: thickness });
  } else {
    const sy = Math.max(1, Math.min(track.height - 2, track.height >> 1));
    out.copyBits(track, { x: 0, y: sy, w: track.width, h: 1 }, { x: 0, y: 0, w: thickness, h: length });
  }

  // ── thumb: positioned by value within the track region (between arrows) ──
  if (thumb) {
    const native = horiz ? thumb.width : thumb.height;
    const cross = horiz ? thumb.height : thumb.width;
    const offC = Math.round((thickness - cross) / 2);
    // PROPORTIONAL (OS 8) thumb length scales with the track; FIXED (System 7) keeps
    // the cicn's native length. Default proportional (the bundled themes are Platinum
    // -era); ScrollbarOptions.proportional flips it. Never shorter than the cicn.
    const proportional = opts.proportional ?? true;
    const thumbLen = proportional
      ? Math.max(native, Math.round(trackLen * Math.min(1, Math.max(0.08, opts.thumbExtent ?? 0.4))))
      : native;
    const pos = trackStart + Math.round(value * Math.max(0, trackLen - thumbLen));
    if (thumbLen <= native) {
      // fixed (or proportional collapsed to native) — stamp 1:1
      if (horiz) out.copyBits(thumb, { x: 0, y: 0, w: thumb.width, h: thumb.height }, { x: pos, y: offC, w: thumb.width, h: thumb.height });
      else out.copyBits(thumb, { x: 0, y: 0, w: thumb.width, h: thumb.height }, { x: offC, y: pos, w: thumb.width, h: thumb.height });
    } else {
      // Capsule multi-slice: the rounded end caps AND the centre grip stay 1:1 (never stretched);
      // only the uniform body fill between them grows. The grip is re-CENTRED in the grown thumb.
      // (The body is uniform along the long axis, so stretching a 1px body slice is seamless.)
      const grip = thumbGrip(thumb, horiz);
      let cap = Math.max(2, Math.min(Math.floor((native - 1) / 2), Math.round(cross / 2)));
      if (grip) cap = Math.max(1, Math.min(cap, grip.start, native - (grip.start + grip.len)));
      const gw = grip ? grip.len : 0;
      const gctr = pos + Math.round((thumbLen - gw) / 2); // grip centred in the grown thumb
      const refIdx = grip ? Math.max(0, Math.min(cap, grip.start - 1)) : cap; // a uniform body line
      const W = thumb.width, Hh = thumb.height;
      if (horiz) {
        const fill = (x0: number, x1: number) => { if (x1 > x0) out.copyBits(thumb, { x: refIdx, y: 0, w: 1, h: Hh }, { x: x0, y: offC, w: x1 - x0, h: Hh }); };
        out.copyBits(thumb, { x: 0, y: 0, w: cap, h: Hh }, { x: pos, y: offC, w: cap, h: Hh });
        out.copyBits(thumb, { x: native - cap, y: 0, w: cap, h: Hh }, { x: pos + thumbLen - cap, y: offC, w: cap, h: Hh });
        if (grip) {
          fill(pos + cap, gctr);
          out.copyBits(thumb, { x: grip.start, y: 0, w: gw, h: Hh }, { x: gctr, y: offC, w: gw, h: Hh });
          fill(gctr + gw, pos + thumbLen - cap);
        } else fill(pos + cap, pos + thumbLen - cap);
      } else {
        const fill = (y0: number, y1: number) => { if (y1 > y0) out.copyBits(thumb, { x: 0, y: refIdx, w: W, h: 1 }, { x: offC, y: y0, w: W, h: y1 - y0 }); };
        out.copyBits(thumb, { x: 0, y: 0, w: W, h: cap }, { x: offC, y: pos, w: W, h: cap });
        out.copyBits(thumb, { x: 0, y: native - cap, w: W, h: cap }, { x: offC, y: pos + thumbLen - cap, w: W, h: cap });
        if (grip) {
          fill(pos + cap, gctr);
          out.copyBits(thumb, { x: 0, y: grip.start, w: W, h: gw }, { x: offC, y: gctr, w: W, h: gw });
          fill(gctr + gw, pos + thumbLen - cap);
        } else fill(pos + cap, pos + thumbLen - cap);
      }
    }
  }

  // ── CDEF scrollbar frame: mirror a one-sided long-edge border ──────────────
  // The classic Control Manager strokes a 1px outline around the whole bar; some
  // scheme TRACK cicns bake it onto only ONE long edge. platinum-8's -8286 carries
  // the content-facing line but no frame-facing line, so its resting scrollbar reads
  // as missing the hairline against the window's bottom/right frame. If one long edge
  // is a continuous dark border and the opposite edge is opaque fill WITHOUT one,
  // copy the border across — restoring the bar's outline. Transparent tracks (e.g.
  // system7-nostalgia-silver, whose frame shows through the window chrome) have no
  // border to mirror, so this is a no-op for them; schemes already framed both sides
  // see the source edge re-painted onto itself (unchanged).
  {
    const lum = (p: readonly [number, number, number, number]): number => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
    const N = length;
    const cross = thickness - 1;
    const at = (i: number, c: number): readonly [number, number, number, number] =>
      horiz ? out.getPixel(i, c) : out.getPixel(c, i);
    const paint = (c: number, col: [number, number, number]): void => {
      for (let i = 0; i < N; i += 1) {
        if (horiz) out.setPixel(i, c, col[0], col[1], col[2], 255);
        else out.setPixel(c, i, col[0], col[1], col[2], 255);
      }
    };
    let darkA = 0, darkB = 0, opaqA = 0, opaqB = 0;
    const colA = new Map<number, number>(), colB = new Map<number, number>();
    for (let i = 0; i < N; i += 1) {
      const a = at(i, 0), b = at(i, cross);
      if (a[3] > 200) { opaqA += 1; if (lum(a) < 110) { darkA += 1; const k = (a[0] << 16) | (a[1] << 8) | a[2]; colA.set(k, (colA.get(k) ?? 0) + 1); } }
      if (b[3] > 200) { opaqB += 1; if (lum(b) < 110) { darkB += 1; const k = (b[0] << 16) | (b[1] << 8) | b[2]; colB.set(k, (colB.get(k) ?? 0) + 1); } }
    }
    const dom = (m: Map<number, number>): [number, number, number] => {
      let bk = -1, bc = 0; for (const [k, c] of m) if (c > bc) { bc = c; bk = k; }
      return bk < 0 ? [0, 0, 0] : [(bk >> 16) & 255, (bk >> 8) & 255, bk & 255];
    };
    if (darkA / N > 0.6 && darkB / N < 0.5 && opaqB > N * 0.6) paint(cross, dom(colA));
    else if (darkB / N > 0.6 && darkA / N < 0.5 && opaqA > N * 0.6) paint(0, dom(colB));
  }

  return out;
}

export interface SliderOptions {
  orientation?: Orientation;
  length?: number;
  value?: number;
  state?: ControlState;
}

/**
 * Compose a slider (docs/spec/kdef231-reference.md §2.4 / §2.6): stretch the groove track
 * along the axis, stamp the thumb at the value position. 7 Le's thumb
 * cicns are 15×64 sprite sheets — 4 stacked 15×16 states
 * (blank / normal / pressed / disabled).
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
  opts: SliderOptions = {},
  signal?: AbortSignal,
): Promise<SliderComposition | null> {
  // Native faces can be disposed while a track is decoding. Guard every
  // sequential dependency so resuming cannot start a thumb/fallback read from
  // a theme whose owned URLs have already been revoked.
  const load = async (id: number): Promise<PixelBuffer | null> => {
    if (signal?.aborted) return null;
    const buffer = await loadByIdSelf(theme, id);
    return signal?.aborted ? null : buffer;
  };
  const orientation = opts.orientation ?? 'horizontal';
  const length = Math.max(32, opts.length ?? 120);
  const value = Math.min(1, Math.max(0, opts.value ?? 0.5));
  const state = opts.state ?? 'normal';
  const horiz = orientation === 'horizontal';

  // Resolve by RESOURCE ID (slugs vary per scheme; ids are stable). The
  // non-directional slider: horizontal track -10131 (pressed -10130 /
  // inactive -10132) + thumbs -10129 · vertical track -10115 (-10114 /
  // -10116) + thumbs -10113.
  const tA = horiz ? 10131 : 10115;
  const tP = horiz ? 10130 : 10114;
  const tI = horiz ? 10132 : 10116;
  const tId = state === 'pressed' ? tP : state === 'disabled' || state === 'inactive' ? tI : tA;
  // SELF-ONLY (like composeCheckable): a scheme renders its OWN slider groove +
  // thumb (the -10131/-10129 h · -10115/-10113 v family) or falls to procedural
  // Platinum — it does NOT borrow the base bundle's. Every texture/cicn scheme +
  // 1990 + the replica ship this family in their OWN bundle (self hop hits); the
  // corner-sprite schemes ship NO slider groove (their -10205..-10208 are the
  // scrollbar thumb / directional indicators, not a groove+thumb pair — verified
  // by pixel-decode), so they fall to platinumSlider rather than the replica's.
  const track = (await load(tId)) ?? (await load(tA));
  if (!track) return null;
  const thumbs = await load(horiz ? 10129 : 10113);
  if (signal?.aborted) return null;

  const thickness = horiz ? track.height : track.width;
  const longSrc = horiz ? track.width : track.height;
  const groove = horiz ? PixelBuffer.alloc(length, thickness) : PixelBuffer.alloc(thickness, length);

  // groove: 3-slice along the axis — keep the rounded end caps 1:1, stretch
  // OR TILE the uniform middle per the cinf's slice.tile. (Full-stretch would
  // smear the caps; tiling preserves pixel-rate detail at long lengths.)
  // Read the cinf's slice.corner for the cap thickness; fall back to the
  // historical 6-clamp.
  const trackEl = elementById(theme, tId);
  const end = trackEl?.slice?.corner ?? Math.min(6, Math.floor((longSrc - 1) / 2));
  const tileMid = !!trackEl?.slice?.tile;
  const mid = longSrc - end * 2;
  const dmid = length - end * 2;
  const drawMid = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void => {
    if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
    if (!tileMid) { groove.copyBits(track, { x: sx, y: sy, w: sw, h: sh }, { x: dx, y: dy, w: dw, h: dh }); return; }
    const axisLen = horiz ? dw : dh;
    const slab = horiz ? sw : sh;
    for (let t = 0; t < axisLen; t += slab) {
      const r = Math.min(slab, axisLen - t);
      if (horiz) groove.copyBits(track, { x: sx, y: sy, w: r, h: sh }, { x: dx + t, y: dy, w: r, h: sh });
      else        groove.copyBits(track, { x: sx, y: sy, w: sw, h: r }, { x: dx, y: dy + t, w: sw, h: r });
    }
  };
  if (horiz) {
    groove.copyBits(track, { x: 0, y: 0, w: end, h: thickness }, { x: 0, y: 0, w: end, h: thickness });
    groove.copyBits(track, { x: longSrc - end, y: 0, w: end, h: thickness }, { x: length - end, y: 0, w: end, h: thickness });
    drawMid(end, 0, mid, thickness, end, 0, dmid, thickness);
  } else {
    groove.copyBits(track, { x: 0, y: 0, w: thickness, h: end }, { x: 0, y: 0, w: thickness, h: end });
    groove.copyBits(track, { x: 0, y: longSrc - end, w: thickness, h: end }, { x: 0, y: length - end, w: thickness, h: end });
    drawMid(0, end, thickness, mid, 0, end, thickness, dmid);
  }

  // The groove is often much thinner than the authored thumb cell (Windows95:
  // 4px groove, 16px cell). Keep both at native cross-axis size instead of
  // clipping the thumb to the groove's buffer. Floor-centering is our explicit
  // integer placement policy; exact 2.3.1 slider geometry remains untraced.
  const cellW = thumbs ? (horiz ? thumbs.width : Math.floor(thumbs.width / 4)) : 0;
  const cellH = thumbs ? (horiz ? Math.floor(thumbs.height / 4) : thumbs.height) : 0;
  const cross = Math.max(thickness, horiz ? cellH : cellW);
  const out = horiz ? PixelBuffer.alloc(length, cross) : PixelBuffer.alloc(cross, length);
  const grooveOffset = Math.floor((cross - thickness) / 2);
  out.copyBits(groove, { x: 0, y: 0, w: groove.width, h: groove.height },
    { x: horiz ? 0 : grooveOffset, y: horiz ? grooveOffset : 0, w: groove.width, h: groove.height });

  // Retain the complete selected state cell. Preserve the existing srcCopy
  // transfer behavior; the original slider's mask/painter path is untraced.
  let thumb: SliderComposition['layout']['thumb'] = null;
  const travel = Math.max(0, length - (horiz ? cellW : cellH));
  if (thumbs && cellW > 0 && cellH > 0) {
    const stateRow = state === 'pressed' ? 2 : state === 'disabled' || state === 'inactive' ? 3 : 1;
    const pos = Math.round(value * travel);
    const thumbOffset = Math.floor((cross - (horiz ? cellH : cellW)) / 2);
    thumb = { x: horiz ? pos : thumbOffset, y: horiz ? thumbOffset : pos, w: cellW, h: cellH };
    out.copyBits(thumbs,
      { x: horiz ? 0 : stateRow * cellW, y: horiz ? stateRow * cellH : 0, w: cellW, h: cellH }, thumb);
  }
  return { buffer: out, layout: { orientation, axisLength: length, thumb, travelStart: 0, travelEnd: travel, value } };
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
  // composeProgress — read the artist's authored answer rather than the heuristic.
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
  length?: number;
  value?: number;
  state?: ControlState;
}

/**
 * Compose a determinate progress bar (docs/spec/kdef231-reference.md §2.6): stretch
 * the unfilled track across the bar, overlay the fill cicn across the
 * 0..value portion (inset to the interior), cap with the frame ends.
 */
export async function composeProgress(
  theme: LoadedTheme,
  opts: ProgressOptions = {},
): Promise<PixelBuffer | null> {
  const length = Math.max(16, opts.length ?? 160);
  const value = Math.min(1, Math.max(0, opts.value ?? 0.5));
  const active = (opts.state ?? 'normal') !== 'inactive';

  // PROGRESS-BAR RESOURCE MODEL — TWO FAMILIES (enumerate the FULL id set before
  // assuming roles from slug names; that was the recurring trap here):
  //  • LAVENDER 2-PART (apple-platinum-2 / system7-nostalgia-silver / black-platinum /
  //    platinum-8 / beos-r503): a dedicated FILL `-10223` ("lavender", the canonical
  //    DEFAULT — owner-chosen) + an empty TRACK `-10224`. These schemes ALSO ship
  //    `-10071..-10080` + `-10220..-10222` — but those are ALTERNATE HUE fills
  //    (teal/rose/…/copper/aquamarine; picker deferred), NOT frame/track/fill roles,
  //    and they carry NO progress frame. (I repeatedly mis-modelled these by reading
  //    only the -1007x hue slugs and missing that -10223/-10224 also ship here.)
  //  • ROLE 3-PART (1138 / 1984 / 1990 / evolution; replica = 2-part): the
  //    deconstructed layers — frame `-10080`/`-10077`, fill `-10079`/`-10076`, track
  //    `-10078`/`-10075` (active/inactive). Used only by schemes WITHOUT `-10223`.
  // See kdef231-reference §2.4 + the per-theme resource-role manifest.
  const lavender = await loadById(theme, 10223);
  if (lavender) {
    const trk = await loadById(theme, 10224);
    const ph = (trk ?? lavender).height;
    const out = PixelBuffer.alloc(length, ph);
    // 3-slice a tile into `dst` across its full width: rounded end caps 1:1, middle
    // stretched. `dst` width sets the run (so the fill goes in its own buffer, below).
    const slice3 = (dst: PixelBuffer, src: PixelBuffer): void => {
      const w = dst.width;
      if (w <= 0) return;
      if (w <= src.width) { dst.copyBits(src, { x: 0, y: 0, w: src.width, h: src.height }, { x: 0, y: 0, w, h: ph }); return; }
      const cap = Math.min(4, Math.max(1, (src.width - 2) >> 1));
      dst.copyBits(src, { x: 0, y: 0, w: cap, h: src.height }, { x: 0, y: 0, w: cap, h: ph });
      dst.copyBits(src, { x: src.width - cap, y: 0, w: cap, h: src.height }, { x: w - cap, y: 0, w: cap, h: ph });
      dst.copyBits(src, { x: cap, y: 0, w: src.width - cap * 2, h: src.height }, { x: cap, y: 0, w: w - cap * 2, h: ph });
    };
    // Empty track across the full bar, then the FILL tile 3-sliced to value over it.
    // The fill keeps its OWN tile (bevel + highlight + leading edge) — 3-slicing (caps
    // 1:1, middle stretched) preserves that, where stretching only the interior colour
    // came out flat/awkward. drawOver (alpha-respecting) composites the fill so its
    // rounded corners don't erase the track at the leading edge (a 1px seam otherwise).
    if (trk) slice3(out, trk);
    if (value > 0) {
      const fb = PixelBuffer.alloc(Math.max(1, Math.round(value * length)), ph);
      slice3(fb, lavender);
      out.drawOver(fb, 0, 0);
    }
    return out;
  }

  // ROLE 3-part (schemes WITHOUT -10223): the id is the stable selector (slugs differ:
  // "progress-bar-frame-active" vs "progress-indicator-frame"). Inactive uses -1007{7,6,5}.
  const frame = await loadById(theme, active ? 10080 : 10077);
  const track = (await loadById(theme, active ? 10078 : 10075)) ?? (await loadById(theme, 10078));
  const fill = (await loadById(theme, active ? 10079 : 10076)) ?? (await loadById(theme, 10079));
  if (!frame && !track) return null;

  const h = frame ? frame.height : track!.height;
  const out = PixelBuffer.alloc(length, h);

  // The frame is a border ring with a transparent interior; its border thickness
  // (the inset where alpha drops out) sets where the track/fill live. Prefer the
  // cinf-decoded `slice.corner` when present (the artist's authored answer); fall
  // back to the pixel-scan only when no cinf was shipped. Same shape as the just-
  // landed `composeFaceButton` / `composeButton` ring fix — the cinf is the
  // source of truth, the pixel scan is a heuristic that drifts from artist intent.
  const frameEl = elementById(theme, active ? 10080 : 10077);
  const border = frameEl?.slice?.corner ?? (frame ? frameBorder(frame) : 1);
  const borderV = frameEl?.slice?.side ?? border;
  // Track + fill placement use the SAME pair of insets the frame's 9-slice does
  // — horizontal corner width for x, vertical side thickness for y. Mixing
  // border for y (the prior code) misaligned the interior against the frame
  // when corner ≠ side, leaving the track/fill drawn outside the visible
  // frame bands. Latent today (all corpus -10080 ship symmetric), exposed the
  // moment a future scheme imports an asymmetric authoring.
  const ix = border;
  const iw = Math.max(0, length - border * 2);
  const iy = borderV;
  const ih = Math.max(0, h - borderV * 2);

  // 1) unfilled track stretched across the interior (the empty look for
  //    schemes whose frame has a transparent interior, e.g. 1990).
  if (track && iw > 0 && ih > 0) {
    out.copyBits(track, { x: 0, y: 0, w: track.width, h: track.height }, { x: ix, y: iy, w: iw, h: ih });
  }

  // 2) frame border: 9-slice so corners stay crisp. Some schemes' frames
  //    have a transparent interior (track shows through), others an opaque
  //    one (1984 is solid white) — either way the fill goes on TOP next.
  if (frame) {
    // Honour the cinf-declared slice.tile (same as composeFaceButton / composeButton ring).
    const frameMode = frameEl?.slice?.tile ? 'tile' : 'stretch';
    out.nineSlice(frame, { x: 0, y: 0, w: frame.width, h: frame.height }, { l: border, t: borderV, r: border, b: borderV }, { x: 0, y: 0, w: length, h }, frameMode);
  }

  // 3) fill across 0..value of the interior, ON TOP of the frame — 3-slice
  //    along the bar: keep the section's rounded end caps 1:1, stretch the
  //    middle (NOT tiled — tiling repeats the section into visible chevrons).
  if (fill && value > 0 && iw > 0 && ih > 0) {
    const fw = Math.round(value * iw);
    if (fw > 0 && fw <= fill.width) {
      out.copyBits(fill, { x: 0, y: 0, w: fill.width, h: fill.height }, { x: ix, y: iy, w: fw, h: ih });
    } else if (fw > 0) {
      // cap = the rounded-corner width (~a few px); keep it small so a
      // non-empty middle remains even for narrow (12px) fill sections.
      const cap = Math.min(4, Math.max(1, (fill.width - 2) >> 1));
      const fmid = fill.width - cap * 2;
      out.copyBits(fill, { x: 0, y: 0, w: cap, h: fill.height }, { x: ix, y: iy, w: cap, h: ih });
      out.copyBits(fill, { x: fill.width - cap, y: 0, w: cap, h: fill.height }, { x: ix + fw - cap, y: iy, w: cap, h: ih });
      out.copyBits(fill, { x: cap, y: 0, w: fmid, h: fill.height }, { x: ix + cap, y: iy, w: fw - cap * 2, h: ih });
    }
  }
  return out;
}

export interface ButtonOptions {
  /** Logical face/port coordinates. Omission applies local compatibility defaults, not known original state. */
  compositionContext?: ControlCompositionContext;
  /** Opt-in completed resource-resolution trace; does not certify fidelity. */
  diagnostics?: ControlDiagnostics;
  label?: string;
  /** Resolved nominal CSS pixel size, finite and >= 6. Compatibility default: 12, independent of face height. */
  fontSize?: number;
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

interface FaceOptions { composition?: ControlCompositionSnapshot; signal?: AbortSignal | undefined; trace?: ControlTraceCollector | undefined; label?: string; fontSize?: number; disabled?: boolean; minWidth?: number; fg?: string; padX?: number; width?: number; height?: number; align?: 'center' | 'left'; }

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

async function loadBodyPattern(face: ResolvedControlFace, opts: FaceOptions, usage: 'paint' | 'admission' = 'paint'): Promise<{ buffer: PixelBuffer | null; solidFallback: boolean }> {
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
  const buffer = await loadCicnBuffer(url);
  assertControlAlive(opts.signal);
  opts.trace?.record({ ...common, action: 'selected', reason: usage === 'admission' ? selectionReason.replace(/-paint$/, '-admission') : selectionReason, resource: {
    type: 'ppat', signedId: pattern.sourcePpatId ?? null, sourceCinfId: null, manifestKey: key!, assetUrl: url,
    ...(pattern.byteProvenance ? { byteProvenance: pattern.byteProvenance } : {}),
  } });
  return { buffer, solidFallback: false };
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
  let glyphs = label ? rasterizeText(label, fontSize, fg) : null;
  // A cicn is a resizable template, not a minimum control rectangle. Tiny
  // templates (e.g. a 5×6 face) cannot contain even our smallest label raster.
  // Use the existing standard height without changing the button font size.
  // Caller-specified heights remain authoritative, including compact controls.
  if (opts.height == null && glyphs && glyphs.height > lineH) {
    lineH = APPLE_PUSH_BUTTON_HEIGHT;
    if (geometry === 'legacy-list-header') {
      fontSize = Math.max(8, Math.round(lineH * 0.6));
      glyphs = rasterizeText(label, fontSize, fg);
    }
  }
  const padX = opts.padX ?? 12;
  const innerW = opts.width ?? Math.max(opts.minWidth ?? 56, (glyphs ? glyphs.width : 0) + padX * 2);
  const innerH = lineH;
  const out = PixelBuffer.alloc(innerW, innerH);
  const context = opts.composition ?? snapshotControlComposition();
  // A completed body dependency describes a published composition, not an
  // intermediate offscreen write. Borders can still decode asynchronously.
  let mode5PaintStep: ControlResolutionStep | undefined;
  let legacyFacePaint: LegacyFacePaint | undefined;
  if (geometry === 'button') opts.trace?.composition({ context, originalPortState: 'unverified',
    faceRect: { x: context.controlOrigin[0], y: context.controlOrigin[1], w: innerW, h: innerH },
    appliedUnknownPatternOffset: context.patternOrigin.status === 'unknown' });
  const mode5 = geometry === 'button' && faceEl.bodyRequest?.mode === 5;
  const cicnBody = mode5 ? await loadCicnBody(resolved, opts, innerW, innerH, context) : null;
  const body = mode5 ? { buffer: null, solidFallback: cicnBody?.kind === 'missing' }
    : geometry === 'button' ? await loadBodyPattern(resolved, opts) : { buffer: null, solidFallback: false };
  const pattern = body.buffer;
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
  if (mode5PaintStep) opts.trace?.record(mode5PaintStep);
  if (legacyFacePaint) opts.trace?.legacyFacePaint(legacyFacePaint);
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

/**
 * Compose a THEMED push button (docs/spec/kdef231-reference.md §1.2 / §2.2,
 * FUN_30a8 — Platinum fallback: docs/kaleidoscope-asset-catalog.md §6.1): compose the
 * push-button face (-10239 active / -10238 pressed / -10240 inactive) into the
 * button rect; for the default button wrap the shipped ring (-10231/-10232) around
 * it. Returns null if the scheme ships no push-button cicn (→ baselineButton).
 */
export async function composeButton(theme: LoadedTheme, opts: ButtonOptions = {}, signal?: AbortSignal): Promise<PixelBuffer | null> {
  return (await composeButtonWithLayout(theme, opts, signal))?.buffer ?? null;
}

/** Internal adapter seam: actual face placement, never a second ring resolver. */
export async function composeButtonWithLayout(theme: LoadedTheme, opts: ButtonOptions = {}, signal?: AbortSignal, preparedContext?: ControlCompositionSnapshot): Promise<ButtonComposition | null> {
  let result: ButtonComposition | null = null;
  const state = opts.disabled ? 'inactive' : opts.pressed ? 'pressed' : 'active';
  await withControlDiagnostics(opts.diagnostics, 'push-button', {
    state, pressed: !!opts.pressed, disabled: !!opts.disabled, default: !!opts.default,
  }, async trace => {
    const composition = preparedContext ?? snapshotControlComposition(opts.compositionContext);
    const preparedOptions = { ...opts, fontSize: buttonFontSize(opts.fontSize) };
    result = await composeButtonWithTrace(theme, preparedOptions, composition, trace, signal);
    return result?.buffer ?? null;
  });
  return result;
}

async function composeButtonWithTrace(theme: LoadedTheme, opts: ButtonOptions, composition: ControlCompositionSnapshot,
  trace?: ControlTraceCollector, signal?: AbortSignal): Promise<ButtonComposition | null> {
  assertControlAlive(signal);
  const faceId = opts.disabled ? 10240 : opts.pressed ? 10238 : 10239;
  const state: keyof typeof PUSH_BUTTON_FACE_KEYS = opts.disabled ? 'inactive' : opts.pressed ? 'pressed' : 'active';
  // Compatibility policy: try named roles/ID slots with anti-role rejection,
  // then active→pressed or inactive→active when the requested role is missing.
  // Animals/Monkey repurpose -10239 with a menu label and supply other face
  // states. These choices handle that corpus convention; they are not proven
  // original Appearance Manager/kDEF state fallbacks. Keep the final raw-ID
  // fallback visible to diagnostics rather than inferring historical intent.
  let face = await resolvePushButtonFace(theme, state, trace);
  assertControlAlive(signal);
  if (!face && state === 'active') {
    traceFallback(trace, 10238, 'active-to-pressed');
    face = await resolvePushButtonFace(theme, 'pressed', trace);
    assertControlAlive(signal);
  }
  if (!face && state === 'inactive') {
    traceFallback(trace, 10239, 'inactive-to-active');
    face = await resolvePushButtonFace(theme, 'active', trace);
    assertControlAlive(signal);
  }
  if (!face) {
    const lookup: TraceLookup = { ...FACE_LOOKUP, basis: 'compatibility-policy' };
    traceFallback(trace, faceId, 'raw-id-escape');
    face = await loadFaceById(theme, faceId, trace, lookup);
    assertControlAlive(signal);
    if (!face) {
      traceFallback(trace, 10239, 'active-id-fallback');
      face = await loadFaceById(theme, 10239, trace, lookup);
      assertControlAlive(signal);
    }
  }
  assertControlAlive(signal);
  if (!face) return null; // baseline path
  const faceBuf = await composeFaceButton(face, { ...opts, composition, signal, trace });
  assertControlAlive(signal);
  // kDEF 2.3.1 copies the control rectangle at 0x7434, draws its face
  // through 0x7572/0x7594, then expands that SAME rectangle by four pixels
  // (InsetRect(-4,-4), 0x7698–0x76a2) before drawing the default ring.
  // Template dimensions do not determine this outset. Separately, our layout
  // policy reserves that footprint for plain buttons too, so changing default
  // or pressed state never shifts neighboring controls.
  // Footprint reservation needs metadata only. Unused state rasters must not
  // add decode work or make a plain button fail because another state is bad.
  const reservation: TraceLookup = { role: 'default-ring', basis: 'compatibility-policy', usage: 'layout-reservation' };
  const activeRing = resolveFaceById(theme, 10231, trace, reservation);
  const pressedRing = resolveFaceById(theme, 10230, trace, reservation);
  const inactiveRing = resolveFaceById(theme, 10232, trace, reservation);
  // The original dispatch uses inactive -10232; pressed -10230 falls back
  // to active -10231 when absent (0x76b8–0x770e).
  const ring = opts.default
    ? opts.disabled ? inactiveRing : opts.pressed ? pressedRing ?? activeRing : activeRing
    : null;
  if (opts.default) {
    const ringId = opts.disabled ? 10232 : opts.pressed ? 10230 : 10231;
    const paint: TraceLookup = { role: 'default-ring', basis: 'source-dispatch', usage: 'paint' };
    if (opts.pressed && !opts.disabled && !pressedRing) traceFallback(trace, 10231, 'pressed-ring-to-active', paint);
    if (ring) traceHit(trace, paint, ringId, ring, 'selected', 'ring-paint');
    else trace?.record({ ...paint, requestedId: -ringId, action: 'missing', reason: 'ring-unavailable' });
  }
  if (!activeRing && !pressedRing && !inactiveRing) return { buffer: faceBuf, layout: { faceRect: { x: 0, y: 0, w: faceBuf.width, h: faceBuf.height } } };
  const outset = 4;
  const out = PixelBuffer.alloc(faceBuf.width + outset * 2, faceBuf.height + outset * 2);
  out.drawOver(faceBuf, outset, outset);
  if (ring) {
    const { element } = ring;
    assertControlAlive(signal);
    const buffer = await loadCicnBuffer(assetUrl(ring.theme, element.asset));
    assertControlAlive(signal);
    // Full source raster, including transparent margins. The ring is painted
    // after face/text (0x76c8 onward), with its body-fill flag false.
    out.drawOver(await composeControlBorder({ ...ring, buffer }, out.width, out.height, { trace, signal },
      (x, y) => controlPointVisible(composition, x - outset, y - outset), 'default-ring'), 0, 0);
  }
  if (composition.clip.kind === 'rect') for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    if (!controlPointVisible(composition, x - outset, y - outset)) out.setPixel(x, y, 0, 0, 0, 0);
  }
  return { buffer: out, layout: { faceRect: { x: outset, y: outset, w: faceBuf.width, h: faceBuf.height } } };
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
export async function composeBevelButtonWithLayout(theme: LoadedTheme, opts: BevelButtonOptions = {}): Promise<ButtonComposition | null> {
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
    const finish = (value: HeaderSurfaceResult, extra: Partial<Pick<HeaderSurfaceTrace, 'backgroundPolicy' | 'lineSampling' | 'painted'>> = {}): PixelBuffer | null => {
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
      if (body.buffer) return finish({ status: 'unsupported', reason: 'pattern-body' });
      if (!body.solidFallback) return finish({ status: 'unsupported', reason: 'ambiguous-body-selection' });
      const background = headerBackground(face.buffer, face.element, face.theme.manifest);
      if (!background) return finish({ status: 'unsupported', reason: 'missing-background-sample' });
      const painted = paintHeaderSurface(face.buffer, face.element, plan, background, face.theme.manifest);
      if (painted.painted && identity) trace?.record({ ...identity, role: 'face', requestedId: -id,
        action: 'selected', basis: 'compatibility-policy', usage: 'paint', reason: 'admitted-header-surface-paint' });
      return finish(painted.result, { ...(painted.result.status === 'rendered' ? { painted: painted.painted,
        ...(painted.painted ? { backgroundPolicy: 'raw-sample-current-display' as const } : {}) } : {}), lineSampling: painted.lineSampling });
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

/**
 * Compose a THEMED checkbox/radio glyph + label into a buffer. Stamps
 * the fixed-size state cicn 1:1 (radio: `radio-buttons-{on|off}-...`;
 * checkbox: `normal-{on|off}-...`). Returns null → baselineCheckable.
 *
 * Resolution is deliberately SELF-ONLY (no base-chain walk): a scheme renders
 * its OWN checkbox/radio art, and one that ships none returns null so the caller
 * draws the procedural Platinum glyph — rather than inheriting from an unrelated
 * base bundle. Every texture/cicn scheme (1138/1984/beos/evolution) and 1990 ship
 * -9488..-9504 as cicns in their OWN bundle, so they resolve on the first hop
 * unchanged.
 *
 * The corner-sprite Platinum-family schemes — apple-platinum-2 / platinum-8 /
 * system7-nostalgia-silver — ship NO checkbox/radio CICN, but they DO author the
 * art as ics4 GLYPHS in the -10214..-10240 family (pixel-VERIFIED across all
 * three schemes, 12×12 each, identical glyph shapes to the replica's -9488/-9500
 * cicns):
 *   • CHECKBOX (square box; cols = X / dash=mixed / CHECK / empty, rows =
 *     active / pressed / disabled — pixel-verified 8× grid):
 *       active  → empty -10232 · checked(✓) -10231 · mixed(–) -10230
 *       disabled→ empty -10240 · checked(✓) -10239 · mixed(–) -10238
 *   • RADIO (round orb; cols = mixed / ON / off, rows = active/pressed/disabled):
 *       active  → off -10216 · on -10215 · mixed -10214
 *       disabled→ off -10224 · on -10223 · mixed -10222
 * So self-resolution now hits the scheme's OWN glyph; only a scheme that ships
 * neither cicn nor ics4 falls through to the procedural Platinum glyph.
 */
export async function composeCheckable(
  theme: LoadedTheme,
  kind: 'checkbox' | 'radio',
  opts: { label?: string; checked?: boolean; mixed?: boolean; disabled?: boolean; fg?: string } = {},
): Promise<PixelBuffer | null> {
  // Resolve by RESOURCE ID. radio: on -9488 active / -9489 inactive,
  // off -9491 active / -9492 inactive · checkbox: checked -9500 active /
  // -9501 inactive, empty -9503 active / -9504 inactive. (Schemes that ship
  // no themed checkbox/radio — e.g. apple-platinum-2 — return null → baseline.)
  let wantId: number, activeId: number;
  if (kind === 'radio') {
    activeId = opts.checked ? 9488 : 9491;
    wantId = opts.disabled ? (opts.checked ? 9489 : 9492) : activeId;
  } else {
    activeId = opts.checked ? 9500 : 9503;
    wantId = opts.disabled ? (opts.checked ? 9501 : 9504) : activeId;
  }
  // The corner-sprite schemes' OWN ics4 glyph ids for this control+state (the
  // -10214..-10240 family, pixel-verified — see the doc-comment). Tried as ics4
  // glyphs, NEVER walking the base chain. Active-state id is the fallback so a
  // disabled control that lacks a disabled glyph still shows the scheme's own art.
  // The cluster is 4 marks × 3 tiers (pixel-verified across the 3 schemes):
  //   checkbox cols = [X, mixed/dash, CHECK, empty]; rows = active / pressed / disabled.
  //     active  -10229..-10232 · pressed -10233..-10236 · DISABLED -10237..-10240
  //   radio    cols = [mixed, ON, off]; rows = active / pressed / disabled.
  //     active  -10214..-10216 · pressed -10218..-10220 · DISABLED -10222..-10224
  // "checked" is the CHECK glyph (not the X), and the inactive/disabled state is
  // the grayed THIRD row (not the pressed second row).
  let glyphId: number, glyphActiveId: number;
  if (kind === 'radio') {
    glyphActiveId = opts.mixed ? 10214 : opts.checked ? 10215 : 10216;
    glyphId = opts.disabled ? (opts.mixed ? 10222 : opts.checked ? 10223 : 10224) : glyphActiveId;
  } else {
    glyphActiveId = opts.mixed ? 10230 : opts.checked ? 10231 : 10232;
    glyphId = opts.disabled ? (opts.mixed ? 10238 : opts.checked ? 10239 : 10240) : glyphActiveId;
  }
  // SELF-ONLY resolution order (no base-chain hop → no replica borrow):
  //   1. own cicn for this state          (texture/cicn schemes, 1990, replica)
  //   2. own cicn for the active state     (cicn scheme lacking a disabled cell)
  //   3. own ics4 glyph at the -1021x..-1024x family for this state  (icon schemes)
  //   4. own ics4 glyph at the active state of that family
  // Falls to null (→ procedural baseline) only when the scheme ships neither.
  const glyph =
    (await loadByIdSelf(theme, wantId)) ??
    (await loadByIdSelf(theme, activeId)) ??
    (await loadGlyphByIdSelf(theme, -glyphId)) ??
    (await loadGlyphByIdSelf(theme, -glyphActiveId));
  if (!glyph) return null;
  const label = opts.label ?? '';
  const glyphs = label ? rasterizeText(label, 9, opts.fg ?? '#000000') : null;
  const gap = 5;
  const w = glyph.width + (glyphs ? gap + glyphs.width : 0);
  const h = Math.max(glyph.height, glyphs ? glyphs.height : 0);
  const out = PixelBuffer.alloc(w, h);
  out.copyBits(glyph, { x: 0, y: 0, w: glyph.width, h: glyph.height }, { x: 0, y: Math.round((h - glyph.height) / 2), w: glyph.width, h: glyph.height });
  if (glyphs) out.drawOver(glyphs, glyph.width + gap, Math.round((h - glyphs.height) / 2));
  return out;
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
