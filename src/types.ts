import type { BodyCinfView, CinfBindingSummary } from '../tools/theme-loader/cinf-environment.js';
import type { DisplayProfile, DisplayPolicy } from '../tools/theme-loader/display-profile.js';
import type { ElementByteProvenance, PatternByteProvenance, ThemeByteProvenance, WindowByteProvenance } from './loadProvenance.js';
// Theme-bundle types — the fields the runtime reads from theme.json. This file
// is the schema of record; the full bundle (produced by the extractor) is
// richer, and fields are surfaced here as the runtime needs them.

export type WindowState =
  | 'active'
  | 'inactive'
  | 'collapsed-active'
  | 'collapsed-inactive';

/** [left, top, right, bottom] in chrome-cicn pixel coordinates. */
export type Rect = [number, number, number, number];

export interface WindowPart {
  rect: Rect;
}

/**
 * One step of an edge recipe: `at` is a cicn-pixel border, `part` its
 * frame-piece slug (`part-N`, where N is the true wnd# part code — structural
 * pieces, not widget refs). Association is END-BASED: the entry
 * describes the cell that ENDS at `at`, spanning from the PREVIOUS border —
 * segment i is `[border[i-1], border[i])` tagged `part[i]`. See
 * docs/spec/kdef231-recipe-walk.md Q2 and `recipeCells` in composeChrome.ts.
 */
export interface EdgeStep {
  at: number;
  part: string;
}

export interface WindowEdges {
  top: EdgeStep[];
  bottom: EdgeStep[];
  left: EdgeStep[];
  right: EdgeStep[];
}

/**
 * The window-frame `cinf` (Color INFo) geometry the kDEF reads alongside
 * the `wnd#` recipe + cicn. `tileSides` gates the per-cell fill draw
 * (0 = stretch, 1 = tile/repeat per the cicn cell size). `cornerSize` /
 * `sideThickness` describe the fixed corner block and frame thickness.
 * `textPixel` is the cicn coordinate whose colour is the title-text colour.
 *
 * NOTE: in the bundled corpus NO scheme ships a cinf for the document
 * window itself (the cinf resources are all menu/button/slider/tab/dialog
 * elements). When a window has no cinf this is `null` and the compositor
 * uses tileSides=0 (stretch), the recipe's own corner cells, and the
 * declared header text colour. See compositor-spec.md "known gaps".
 */
export interface WindowCinf {
  cornerSize: number;
  sideThickness: number;
  /** 0 = stretch the fill cells, 1 = tile (repeat at the cicn cell size). */
  tileSides: number;
  /** cicn [x, y] whose pixel colour is the authored title-text colour. */
  textPixel?: [number, number] | null;
}

/** Exact template samples for window-widgets TC1–TC5, before remapping. */
export interface WindowTitleSamples {
  readonly background: ControlColorSample | null;
  readonly text: ControlColorSample | null;
  readonly shadow: ControlColorSample | null;
}

export interface WindowType {
  /** Per-template samples; mask-clear pixels retain their original RGB16. */
  readonly titleSamples?: Partial<Record<WindowState, WindowTitleSamples>>;
  /** Opt-in exact converted input occurrences; not a paint/provider claim. */
  readonly byteProvenance?: WindowByteProvenance;
  /** State → relative path of the chrome cicn for that state. */
  chrome: Partial<Record<WindowState, string>>;
  /**
   * Named widget rects within the chrome cicn. `part-0` is the body
   * anchor (its rect's insets define the frame thicknesses); the rest
   * are widgets (close box, zoom box, windowshade, ...) for hit-testing.
   */
  parts: Record<string, WindowPart>;
  /** Per-edge fill recipe (the wnd# side lists). */
  edges?: WindowEdges;
  /**
   * The window-frame cinf geometry, when the scheme ships one paired with
   * this window type's cicn family. Null/absent for every scheme in the
   * bundled corpus (windows have no dedicated cinf) → compositor defaults
   * to stretch (tileSides=0). See WindowCinf.
   */
  cinf?: WindowCinf | null;
  /**
   * Which compositor renders this window type. ABSENT (the default) selects
   * the SLICED path — the kDEF cicn 9-walk in composeChrome.ts, driven by the
   * `edges` recipe. `'corner-sprite'` (the loader's name for schemes with no
   * wnd# recipe: apple-platinum-2, black-platinum, platinum-8, slimes,
   * system7-nostalgia-silver) selects Kaleidoscope's built-in window frame, the
   * v2 engine family proceduralFrame (docs/spec/engine/procedural-frame.md),
   * which reads its art by resource id and ignores `parts`, `sprites` and
   * `widgets` below.
   */
  model?: 'sliced' | 'corner-sprite';
  /**
   * Loader-synthesised sprite paths for corner-sprite window types (the
   * pinstripe and grow-box cicns). Kept in the theme schema for compatibility;
   * the runtime no longer reads them (the built-in frame selects its stripes
   * and grow box by id, procedural-frame §3.5).
   */
  sprites?: { pinstripe?: string; growBox?: string };
  /**
   * Loader-synthesised widget list for corner-sprite window types. Kept for
   * compatibility; the runtime's widget set comes from the declared window
   * record (src/engine/tables/proceduralFrame.ts PF_WINDOW_SLUGS).
   */
  widgets?: ('close' | 'collapse' | 'zoom')[];
}

export interface ControlColorSample {
  /** Exact serialized ColorSpec channels, before high-byte/display conversion. */
  readonly rgb16: readonly [number, number, number];
  /** Current project display policy, not historical destination palette RGB. */
  readonly displayRgb: readonly [number, number, number];
}

export interface ControlColorSamples {
  readonly model: 'kdef-2.3.1-color';
  readonly displayPolicy: DisplayPolicy;
  readonly background: ControlColorSample | null;
  readonly text: ControlColorSample | null;
  readonly emboss: ControlColorSample | null;
  readonly embossDecision: 'absent-coordinates' | 'same-as-background' | 'sentinel' | 'present' | 'unknown';
}

/** Caller-declared metadata unless joined to an actual loader occurrence.
 * Equality covers only opaque pixels under the current display policy. */
export interface CicnSamplingEquivalence {
  readonly model: 'kaleidoscope-2.3.1-opaque-sampling-v1';
  readonly comparison: 'opaque-current-display-rgb';
  readonly displayPolicy: DisplayPolicy;
  readonly width: number;
  readonly height: number;
  readonly status: 'equivalent' | 'different' | 'unknown';
  readonly reason: 'all-opaque-display-rgb-equal' | 'opaque-display-mismatch'
    | 'unsupported-layout' | 'missing-sampler' | 'unsafe-palette-access' | 'ambiguous-asset-path';
}

/** Derived image from the same cicn occurrence, not another original resource.
 * Caller-declared unless joined to actual per-load byte provenance. */
export interface CicnSampledBandAsset {
  readonly model: 'kaleidoscope-2.3.1-opaque-sampling-v1';
  readonly comparison: 'opaque-current-display-rgb';
  readonly displayPolicy: DisplayPolicy;
  readonly width: number; readonly height: number;
  readonly asset: string;
  /** Stable generated path; unlike asset, never rewritten to a blob URL. */
  readonly derivedPath: string;
}

/** Same-owner compatibility binding, not original Resource Manager ordering.
 * Actual loader occurrences can be joined through the selected manifest key. */
export type CicnBodyBinding = {
  readonly model: 'kaleidoscope-2.3.1-cicn-body-v1';
  readonly selectionPolicy: 'unique-same-face-owner';
  readonly requestedId: number;
} & ({ readonly status: 'missing' | 'unsupported' | 'ambiguous'; readonly reason: string } | {
  readonly status: 'ready'; readonly reason: 'unique-source-occurrence';
  readonly manifestKey: string; readonly displayPolicy: DisplayPolicy;
  readonly pixelSize: 1 | 2 | 4 | 8;
  readonly sourceRect: { readonly x: 0; readonly y: 0; readonly w: number; readonly h: number };
  readonly copy: 'masked' | 'unmasked'; readonly asset: string;
  /** Stable derived identity; present only for unmasked color assets. */
  readonly derivedPath?: string;
});

/** One loader-owned cicn occurrence. Shared object identity is load-local and
 * survives URL encoding, but JSON copies cannot establish a finite-sample binding.
 * These scalar fields describe the occurrence; they are not byte provenance. */
export interface CicnSourceIdentity {
  readonly id: number;
  readonly resourceIndex: number;
  readonly byteLength: number;
  /** Validated full pixel-map bounds; absent for an undecoded occurrence. */
  readonly bounds?: { readonly top: number; readonly left: number; readonly bottom: number; readonly right: number };
}

export interface ChromeElement {
  /** Actual decoder occurrence, shared with the raw census independently of
   * optional public byte provenance. Absent on older declared environments. */
  readonly cicnSource?: CicnSourceIdentity;
  /** Finite raw colour samples at the exact points of engine cinfs available at
   * conversion. Bound to this asset occurrence; absent points are unspecified. */
  readonly engineColorSamples?: {
    readonly model: 'kdef-2.3.1-engine-points';
    /** Must share the selected element's actual census object. Missing or
     * serialized/copied bindings leave colours unknown, including legacy samples. */
    readonly source?: CicnSourceIdentity;
    readonly asset: string;
    readonly width: number; readonly height: number;
    readonly displayPolicy: DisplayPolicy;
    readonly points: Readonly<Record<string, ControlColorSample | null>>;
  };
  /** Opt-in role view; common fields below retain their local pairing. */
  readonly bodyCinf?: BodyCinfView;
  readonly cicnBody?: CicnBodyBinding;
  readonly sampledBandAsset?: CicnSampledBandAsset;
  /** Finite unmasked transfer pixels with separately applied modern source-mask alpha. */
  readonly cicnTransfer?: import('../tools/theme-loader/cicn-transfer-results.js').CicnTransferProvenance;
  /** Absent/null is unknown. No raw RGB16, cache/device or selection claim. */
  readonly samplingEquivalence?: CicnSamplingEquivalence | null;
  /** Actual decoded input references, only from an opted-in load. */
  readonly byteProvenance?: ElementByteProvenance;
  /** Exact selected cicn/cinf color samples before PNG transport. Absent/null
   * means legacy/unknown; no default cinf or device palette is synthesized. */
  readonly colorSamples?: ControlColorSamples | null;
  /** Default loads retain legacy image aliasing; colors cannot claim a unique
   * source/image join for duplicate generated paths. Observed loads reject them. */
  readonly colorSamplesUnavailableReason?: 'ambiguous-asset-path';
  asset: string;
  width: number;
  height: number;
  /**
   * 9-slice geometry from the element's cinf (TMPL 129): `corner` = cinf
   * `cornerSize` (byte 0) — the 9-slice corner inset,
   * not a value derived from the bitmap; `side` = `sideThickness`
   * (byte 1); `tile` = the cinf `tileSides` flag (center/edges repeat rather
   * than stretch — e.g. 1990's default-button ring). Null when the scheme
   * ships no cinf for this element (→ fall back to a derived inset).
   */
  slice?: { corner: number; side: number; tile: boolean; resizeBehavior?: string } | null;
  /**
   * Label/text anchor `[x, y]` from the element's cinf `textPixel` (TMPL
   * 129): the source color-sample coordinate, not label positioning geometry.
   * Null when the scheme ships no same-ID cinf.
   */
  textAnchor?: [number, number] | null;
  /**
   * The original Kaleidoscope cicn RESOURCE ID this element decoded from (signed —
   * a negative id like -10239 is the push-button face, positive like 128 is the
   * pressed-window-widgets cicn). Written by the decoder on every chromeElement;
   * the runtime's `elementById` / `loadById` resolve controls against this rather
   * than parsing the asset path string (which becomes a `blob:` URL under the
   * in-memory load path; see controls.ts:elementById).
   */
  sourceCicnId?: number;
  /**
   * Icon-blit inputs (docs/spec/engine/qd-primitives.md I1–I3), present only for
   * cicn ids the runtime asks the loader for (`iconBlitCicnIds`): the pixel
   * map's depth and, deeper than 1 bit, an opaque companion raster with every
   * stored pixel (mask ignored) for the I3 copy.
   */
  iconBlit?: { pixelSize: number; unmaskedAsset?: string };
  /**
   * Compatibility pixel-map origin for engineCinfIds, or a legacy caller
   * declaration. New loaders bind full bounds through cicnSource for every
   * decoded cicn. Engine pixmaps use storage coordinates and drop the origin.
   */
  boundsOrigin?: { top: number; left: number };
  /**
   * Peer of `sourceCicnId`: the cinf RESOURCE ID this element's slice / anchor /
   * bgPattern metadata decoded from. Lets the runtime jump from a chromeElement to
   * its sibling cinf for spec lookups without re-scanning the manifest. Decoded by
   * `tools/theme-loader/buildThemeJson.js`.
   */
  sourceCinfId?: number;
  /**
   * The bundle author's original NAMED-resource label (verbatim from the .sit /
   * .rsrc), e.g. `"Push Button Active"`, `"Inactive Grow Box"`, `"Snap-To-Grid"`.
   * Primary-source role label — cross-corroborated in `docs/spec/
   * corpus-corroborated-ids.md` across 17 of 18 bundles (6,842 NAMED labels).
   * Surfaces the structural answer to "what role does this id play" without
   * inference; the codex tier resolvers can trust this over heuristics when
   * present. Null when the bundle author shipped the cicn without a label
   * (windows-31 + windows-95 are the only corpus bundles with zero labels).
   */
  authorLabel?: string | null;
  /** Raw cinf byte3 mode and signed bytes4..5 request, including zero.
   * Absent/null means unknown; this does not identify a selected or painted resource. */
  bodyRequest?: { mode: number; resourceId: number } | null;
  /** Same-owner ppat key carried from the loader's last decoded occurrence,
   * including raw ID0 and excluding mode5. Absent means legacy/unknown binding;
   * null means no catalog binding was selected. This is compatibility policy,
   * separate from the actual paint trace and original Resource Manager lookup. */
  bodyPattern?: string | null;
  /** Legacy same-manifest pattern-catalog reference derived from nonzero cinf ID.
   * It does not encode the original mode-dependent resource type or lookup scope.
   * See bodyRequest for the raw request, including zero. */
  bgPattern?: string | null;
  /**
   * The cinf-declared `(x, y)` source pixel used to sample the background RGB
   * (TMPL 129 `bgPixel`). Despite the historical property
   * name this is a color-sample coordinate, not a background-pattern tile origin.
   */
  bgAnchor?: [number, number] | null;
  /**
   * The cinf-declared `(x, y)` anchor for embossing this element's label highlight /
   * shadow (TMPL 129 `embossPixel`). The colorSamples seam preserves its exact
   * RGB/sentinel decision for push/bevel labels. List-header dispatch remains
   * separate and unverified.
   */
  embossAnchor?: [number, number] | null;
}

export interface Palette {
  'titlebar-active-bg'?: string;
  'titlebar-active-fg'?: string;
  'titlebar-inactive-bg'?: string;
  'titlebar-inactive-fg'?: string;
  'window-frame'?: string;
  [key: string]: string | undefined;
}

/**
 * Window title-bar FRAME/bevel colors, decoded from the scheme's header cluts
 * (-14335 active / -14336 inactive) by part code: `fill` (part 1) is the bar
 * background, the rest are frame/tinge/bevel. (Clut part 2 is NOT surfaced — it
 * is a frame tint, not the title-text colour; the title text is the classic-Mac
 * default, see docs/tracking/title-text-color.md.)
 */
export interface HeaderColors {
  frame?: string;
  fill?: string;
  lightTinge?: string;
  darkTinge?: string;
  lightBevel?: string;
  darkBevel?: string;
}

export interface ThemeManifest {
  readonly cinfEnvironment?: CinfBindingSummary;
  /** Opaque load-bound identity marker for the declared slider cinf providers. */
  readonly sliderLayoutEnvironment?: Readonly<{ environmentId: string; bindingId: string }>;
  /**
   * Raw bytes of the first cinf at each id the engine families read (loader
   * option `engineCinfIds`; src/engine/tables/loaderNeeds.ts), keyed by the
   * signed id as a string. Present only for loads that asked for it.
   */
  readonly engineCinfs?: Readonly<Record<string, readonly number[]>>;
  /** Prepared immutable display profile; absent preserves the legacy display policy. */
  readonly displayProfile?: DisplayProfile;
  name: string;
  palette?: Palette;
  headerColors?: { active?: HeaderColors; inactive?: HeaderColors };
  windowTypes: Record<string, WindowType>;
  chromeElements: Record<string, ChromeElement>;
  /**
   * Window-content (body) background, from the scheme's Icon/List View
   * cinf bgPatternId. `pattern` is a bundle-relative ppat asset path the
   * runtime tiles behind window content. Absent → OS default (white).
   */
  bodyBackground?: { pattern?: string };
  /**
   * Catalog of every decoded ppat the scheme ships, keyed by SLUG (e.g.
   * `'desktop-pattern'`, `'utility-pattern'`, `'manilla-for-everything'`) or by
   * `ppat-<id>` for unnamed entries (`'ppat--9567'`, `'ppat-129'`). Each value's
   * `asset` is the bundle-relative path the runtime tiles. Chromeelements'
   * `bgPattern` field references these keys; the demo + future per-slot lookups
   * resolve through this map. Always present (may be empty for slim schemes).
   */
  patterns?: Record<string, { asset: string; sourcePpatId?: number; authorLabel?: string | null; readonly byteProvenance?: PatternByteProvenance }>;
}

/** A fetched bundle plus the base URL its asset paths resolve against. */
export interface LoadedTheme {
  /** Immutable load-local evidence; absent means unobserved, including borrowed bases. */
  readonly byteProvenance?: ThemeByteProvenance;
  manifest: ThemeManifest;
  baseUrl: string;
  /**
   * Map of Kaleidoscope resource id (as a string, e.g. `'-10198'`) → the
   * bundle-relative path of that resource's decoded `ics4` GLYPH
   * (`icons/ics4-<id>.png`). Built by {@link loadTheme} from the scheme's
   * `icons/index.json` so the renderer can stamp a scheme's OWN pictograms
   * (e.g. the scroll-arrow buttons -10197..-10204) instead of synthesising
   * them. Absent/empty when the scheme ships no decoded icons. Resolved
   * through the base chain like the cicn loaders (`loadGlyphById`).
   */
  glyphs?: Record<string, string>;
  /**
   * Optional BASE theme this one defers to for any control/chrome it doesn't
   * ship itself (the "base Platinum look" lightly-skinned schemes inherit).
   * Control lookups that follow this chain fall back to `base` on a miss, loading
   * the asset from the base bundle's own URL. Chains (base.base) are followed.
   */
  base?: LoadedTheme;
  /**
   * Optional inspector catalog — the data the demo's diagnostic foldouts (icon
   * inventory, raster inventory, resource-roles viewer) used to fetch from
   * per-bundle JSON files. Present when the theme was decoded in-browser via
   * `loadKaleidoscopeScheme` (Option A); absent for pre-extracted bundles. The
   * catalog mirrors the on-disk JSON shape (`icons/index.json`, `rasters.json`,
   * `resource-roles.json`) plus baked-in URLs so the panel can render directly.
   * Demo panels prefer this over fetch() when present.
   */
  inspector?: ThemeInspector;
  /**
   * Revokes every `blob:` URL minted during this theme's decode (~500 per scheme
   * for asset rasters + glyphs). Call after the theme is unmounted to release the
   * pinned ImageBitmap memory — without it, switching themes 50× across a session
   * leaves 25k blob URLs alive until tab unload. Idempotent; absent on pre-extracted
   * (file-fetched) themes since they don't own any blob: URLs. Also evicts the
   * runtime's raster cache for these URLs. Does not dispose the base theme.
   */
  dispose?: () => void;
}

/** Inspector catalog returned by an in-memory decode — the source of truth for the demo's
 *  diagnostic panels now that bundles ship only the original archive. Public surface:
 *  consumers building a theme picker / browser can enumerate every icon + cicn + ppat
 *  off `theme.inspector` without re-fetching the bundle. URLs are pre-baked (blob: in a
 *  browser; pass-through in Node when an `assetUrlFactory` was set). */
export interface ThemeInspector {
  /** Complete same-fork raw ppat census, including undecoded occurrences.
   * Absent retains declared-catalog policy; [] records raw absence. */
  ppatResources?: Array<{ id: number; resourceIndex: number; byteLength: number }>;
  /** Complete same-fork cicn occurrence census. Present-but-undecoded and
   * duplicate inputs stay unresolved; absence of this field is an older declared environment. */
  cicnResources?: CicnSourceIdentity[];
  /** Complete same-owner colour-icon census. Missing is unknown; [] proves absence.
   * Signed type/id and occurrence bind decoded art; duplicate/short inputs are unresolved. */
  iconColorResources?: Array<{ type: 'icl4' | 'ics4' | 'icl8' | 'ics8'; id: number; resourceIndex: number; byteLength: number }>;
  /** Complete same-fork ics# input census, including masks without color art.
   * Absent means unknown; [] means no such raw resources. Duplicate IDs and
   * fewer than 64 bytes are unsupported by the checkable icon path, not NULL.
   * Occurrence indices refer to parsed resource order in this loaded fork. */
  iconMaskResources?: Array<{ id: number; resourceIndex: number; byteLength: number }>;
  /** First-occurrence 16 × 16 ics# planes by id string: 64 raw bytes, the
   * 32-byte 1-bit image then the 32-byte mask (rows of 2 bytes, MSB first). */
  iconMaskPlanes?: Record<string, number[]>;
  /** Colour-table resources (`actb`, `clut`) keyed `type:id`, entries in index
   * order: stored 16-bit channels plus the display colour under the load's
   * display policy. Read by engine families (procedural-frame §3.5, §5A). */
  colorTables?: Record<string, { entries: Array<{ value: number; rgb16: [number, number, number]; rgb: [number, number, number] }> }>;
  iconIndex: Array<{
    id: number;
    type: 'icl4' | 'ics4' | 'icl8' | 'ics8';
    size?: number;
    depth?: number;
    file: string;
    name?: string | null;
    /** Asset URL (blob: in a browser; pass-through in Node when assetUrlFactory was set). */
    url?: string;
    /** Opaque pixels from this exact decoded occurrence, before Canvas mask loss.
     * Prepared only for requested identities; older manifests leave this unknown. */
    unmaskedUrl?: string;
    /** Raw color-resource occurrence in this loaded fork, when decoded by the loader. */
    resourceIndex?: number;
    /** True iff the first matching mask supplied a complete decoded mask plane. */
    masked?: boolean;
    /** Decoder-side coverage metric (fraction of opaque pixels). */
    coverage?: number;
  }>;
  cicns: Array<{ file: string; id: number | null; name: string | null; url?: string }>;
  ppats: Array<{ file: string; label: string; url?: string }>;
  resourceRoles: {
    theme: string;
    scrollArrows: ThemeScrollArrowMap | null;
    resources: Array<{
      id: number | null; type: string; size?: number;
      slug: string | null; family: string; role: string;
    }>;
  };
}

/** The universal kDEF231 CDEF scroll-arrow mapping. */
export interface ThemeScrollArrowMap {
  note: string;
  raised: { right: number | null; left: number | null; down: number | null; up: number | null };
  pressed: { right: number | null; left: number | null; down: number | null; up: number | null };
}
