// Minimal theme-bundle types — only the fields slice 1 reads.
// The full bundle schema is richer (see docs/aaron-ui-composer-spec.md);
// we add fields here as the rebuild needs them, not before.

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
 * pieces, not widget refs). Association is END-BASED (kDEF `0x5356`): the entry
 * describes the cell that ENDS at `at`, spanning from the PREVIOUS border —
 * segment i is `[border[i-1], border[i])` tagged `part[i]`. See
 * docs/tracking/kdef231-recipe-walk.md Q2 and `recipeCells` in composeChrome.ts.
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

export interface WindowType {
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
}

export interface ChromeElement {
  asset: string;
  width: number;
  height: number;
  /**
   * Label/text anchor `[x, y]` from the element's cinf `textPixel` (TMPL
   * 129): the coordinate the label is anchored at, and whose pixel in the
   * cicn is the authored text color. Null when the scheme ships no cinf.
   */
  textAnchor?: [number, number] | null;
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
 * Window title-bar colors, decoded from the scheme's header cluts
 * (-14335 active / -14336 inactive) by part code: `text` (part 2) and
 * `fill` (part 1) drive the title; the rest are frame/tinge/bevel.
 */
export interface HeaderColors {
  frame?: string;
  fill?: string;
  text?: string;
  lightTinge?: string;
  darkTinge?: string;
  lightBevel?: string;
  darkBevel?: string;
}

export interface ThemeManifest {
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
}

/** A fetched bundle plus the base URL its asset paths resolve against. */
export interface LoadedTheme {
  manifest: ThemeManifest;
  baseUrl: string;
}
