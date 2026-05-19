// theme.json schema — TypeScript codification of the `Theme` data object
// defined in docs/aaron-ui-composer-spec.md §3 (spec C).
//
// Every shape here maps to a Kaleidoscope resource category:
//   - ChromeElementEntry → cicn + cinf
//   - PartEntry          → wnd# named parts
//   - PatternEntry       → ppat
//   - palette            → extracted colors (Colr / dialog cicns / Finder cicns)
//   - options            → Colr scheme-global flags
//   - cursors            → crsr resources
//
// See docs/aaron-ui-architecture-spec.md §6 for canonical resource IDs and
// docs/aaron-ui-raster-mapping-spec.md (spec B) for how these become DOM at
// runtime.

export const THEME_SCHEMA_VERSION = '0.1' as const;

/** A loaded, validated theme. The runtime consumes this directly. */
export interface Theme {
  /** Schema version. Currently fixed at "0.1" until a breaking change ships. */
  version: typeof THEME_SCHEMA_VERSION;
  /** Human-readable scheme name. E.g. "mass:werk 7 Le". */
  name?: string;
  /** Original scheme author. Required when shipping; optional for draft bundles. */
  author?: ThemeAuthor;
  /** Provenance — where this bundle came from and under what terms. */
  origin?: ThemeOrigin;
  /** Per-scheme rendering option flags (from Kaleidoscope's Colr settings). */
  options?: ThemeOptions;
  /** Window-type chrome (document, modal-dialog, alert, etc.) — derived from wnd#. */
  windowTypes?: Record<string, WindowTypeEntry>;
  /** Flat catalog of every chrome element (buttons, scrollbars, menus) by slug. */
  chromeElements?: Record<string, ChromeElementEntry>;
  /** Tileable patterns referenced by `bgPattern` / `bodyPattern` fields. */
  patterns?: Record<string, PatternEntry>;
  /** CSS-ready palette derived from the scheme's `Colr` resource. */
  palette?: Record<string, string>;
  /** Cursors (crsr resources) extracted from the scheme. Keyed by slug
   *  (`arrow`, `contextual-menu`, `alias`, `copy`). Per spec A §18 + spec B §4.19. */
  cursors?: Record<string, CursorEntry>;

  // ─── Extractor draft metadata ───────────────────────────────────────────
  // These fields are populated by tools/scheme-extractor on emit. They're
  // diagnostic, not load-bearing. Runtime ignores them.

  /** Original DeRez `.r` file name the bundle was extracted from. */
  source?: string;
  /** ISO-8601 timestamp of extractor emit. */
  generatedAt?: string;
  /** Free-form note from the extractor (e.g., "metadata must be added manually"). */
  note?: string;
}

export interface ThemeAuthor {
  name: string;
  email?: string;
  url?: string;
  year?: number;
}

export interface ThemeOrigin {
  /** "kaleidoscope-port" for ported schemes; "native" for hypothetical first-party. */
  kind: 'kaleidoscope-port' | 'native' | (string & {});
  /** Source format. For Kaleidoscope ports: "ksc". */
  originalFormat?: 'ksc' | (string & {});
  /** Verbatim license string from the original scheme's readme. */
  originalLicense?: string;
  /** Original readme file name, preserved alongside the bundle. */
  originalReadme?: string;
  /** Canonical URL where the scheme can be downloaded. */
  sourceUrl?: string;
  /** Original Kaleidoscope scheme ID (for archive cross-reference). */
  originalSchemeId?: number;
  /** Minimum Kaleidoscope version required, as decoded from Colr byte 2
   *  (e.g. 0x23 = "2.3"). Populated by the Colr decoder; absent when
   *  no Colr is present. */
  minimumKaleidoscopeVersion?: number;
}

/** Scheme-level rendering flags from Kaleidoscope's Colr resource. */
export interface ThemeOptions {
  menuHighlightOverlay?: boolean;
  unifiedScrollbarTrack?: boolean;
  windowsStyleScrollbars?: boolean;
  extendedScrollbarArrows?: boolean;
  stretchScrollbarThumbFromCenter?: boolean;
}

/** One window type (document, modal-dialog, alert, utility-window, ...). */
export interface WindowTypeEntry {
  /** Chrome cicn URLs per state. At least one state must be present. */
  chrome: WindowChromeStates;
  /** Named parts (closeBox, zoomBox, collapseBox, divider) with hit-target rects. */
  parts?: Record<string, PartEntry>;
  /** Per-side edge composition recipes from wnd#. */
  edges?: WindowEdges;
  /** Slug into the `patterns` catalog, or null. Tiles over the body region. */
  bodyPattern?: string | null;
}

/** Per-state chrome URLs for a window type. */
export interface WindowChromeStates {
  active?: string;
  inactive?: string;
  /** Collapsed (windowshade) active state. */
  'collapsed-active'?: string;
  /** Collapsed (windowshade) inactive state. */
  'collapsed-inactive'?: string;
}

/** A hit-target rectangle inside a window-chrome cicn. */
export interface PartEntry {
  /** [left, top, right, bottom] in chrome-cicn pixel coordinates. */
  rect: [number, number, number, number];
}

/** Per-side edge composition recipes. Each side is a sequence of regions. */
export interface WindowEdges {
  top?: EdgeRecipe[];
  bottom?: EdgeRecipe[];
  left?: EdgeRecipe[];
  right?: EdgeRecipe[];
}

/** One region along a window edge. */
export interface EdgeRecipe {
  /** Pixel offset along the edge where this region starts. */
  at: number;
  /** Region kind — "fill" or a part slug (e.g. "close", "zoom"). */
  part: string;
}

/** One control-level chrome bitmap (button, scrollbar, menu, etc.). */
export interface ChromeElementEntry {
  /** PNG path relative to the bundle root. */
  asset: string;
  /** Bitmap pixel dimensions. Populated when known. */
  width?: number;
  height?: number;
  /** 9-slice geometry from cinf. Null when the bitmap is non-stretchable. */
  slice?: SliceSpec | null;
  /** Slug into the `patterns` catalog, or null. Overlay tile composited at runtime. */
  bgPattern?: string | null;
  /** [x, y] pixel coord in the cicn from which Kaleidoscope extracts the
   *  control's BACKGROUND color (used by spec B §4.16-§4.18 color
   *  extraction for dialog/alert/Finder colors). Per cinf TMPL 129;
   *  confirmed via kDEF disassembly. */
  bgAnchor?: [number, number] | null;
  /** [x, y] pixel anchor for text labels (button captions, menu items). */
  textAnchor?: [number, number] | null;
  /** [x, y] pixel offset for the engraved-emboss text-shadow effect. */
  embossAnchor?: [number, number] | null;
  /** Tile direction for periodic patterns (e.g. barber-pole progress fill). */
  tile?: 'horizontal' | 'vertical' | 'both' | null;

  // ─── Extractor draft fields ─────────────────────────────────────────────
  // Negative cicn IDs are Kaleidoscope's convention (range -8000…-15000ish).

  sourceCicnId?: number | null;
  sourceCinfId?: number | null;
}

/** Canonical per-region resize behavior from cinf, per Scheme Factory
 *  MENU 139. See docs/aaron-ui-raster-mapping-spec.md (spec B) §13.3 —
 *  the full 15-value bit layout is parked against kDEF disassembly.
 *  - `stretch-*` family: stretch the fill (whole region or one side)
 *  - `repeat-*` family: tile the fill (whole region or one side)
 *  - `anchor-*` family: pin without resize (encoding 10-14 unverified) */
export type ResizeBehavior =
  | 'stretch-whole'
  | 'stretch-top'
  | 'stretch-left'
  | 'stretch-bottom'
  | 'stretch-right'
  | 'repeat-whole'
  | 'repeat-top'
  | 'repeat-left'
  | 'repeat-bottom'
  | 'repeat-right'
  | 'anchor-center'
  | 'anchor-top-left'
  | 'anchor-top-right'
  | 'anchor-bottom-left'
  | 'anchor-bottom-right';

/** 9-slice composition geometry derived from cinf. */
export interface SliceSpec {
  /** Corner inset in pixels. CSS: `border-image-slice`. */
  corner: number;
  /** Edge thickness in pixels. CSS: `border-width` + `border-image-width`. */
  side: number;
  /** When true, the middle stretches tile-repeat instead of stretch.
   *  Kept for back-compat; prefer `resizeBehavior` for full fidelity. */
  tile: boolean;
  /** Full 15-value resize behavior from cinf's (tileSides, patternAnchor)
   *  bytes. See ResizeBehavior + spec B §13.3 (open question, parked
   *  against kDEF disassembly). */
  resizeBehavior?: ResizeBehavior;
}

/** A ppat tile available for composition. */
export interface PatternEntry {
  /** PNG path relative to the bundle root. */
  asset: string;
  /** Repeat axis. Default: "both" (CSS: `background-repeat: repeat`). */
  repeat?: 'horizontal' | 'vertical' | 'both';
}

/** A cursor (crsr resource) — PNG + hotspot for CSS `cursor: url(...)`. */
export interface CursorEntry {
  /** PNG path relative to the bundle root. */
  asset: string;
  /** [x, y] hotspot in cursor-pixel coordinates. CSS: `cursor: url(...) x y, fallback`. */
  hotspot: [number, number];
  /** Optional CSS-cursor fallback keyword. Defaults to `auto` if absent.
   *  Examples: `context-menu` (for contextual cursor), `alias`, `copy`. */
  fallback?: string;
}

/** Conformance report emitted by the loader. Per spec C §4.5 + spec B §12. */
export interface ConformanceReport {
  /** Total cicns decoded from the resource fork. */
  cicnsExtracted: number;
  /** Cicns the runtime can render (consumed by windowTypes or known control families). */
  cicnsRendered: number;
  /** Missing-resource fallbacks the loader applied (per spec B §9). */
  fallbacks: Array<{ kind: string; from: string; to: string; reason: string }>;
  /** Validation warnings — well-formed but suspicious data. */
  warnings: string[];
}
