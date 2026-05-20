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
 * One step of an edge recipe: at cicn pixel `at`, the segment begins;
 * `part` is its frame-piece slug (`part-N`, where N is the true wnd#
 * part code). Per docs/tracking/kdef-disassembly-findings §8: these are
 * structural pieces, not widget refs. A segment runs from one entry's
 * `at` to the next entry's `at`.
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
}

export interface ChromeElement {
  asset: string;
  width: number;
  height: number;
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
