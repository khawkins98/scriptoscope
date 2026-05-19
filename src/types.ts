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

export interface WindowType {
  /** State → relative path of the chrome cicn for that state. */
  chrome: Partial<Record<WindowState, string>>;
  /**
   * Named widget rects within the chrome cicn. `part-0` is the body
   * anchor (its rect's insets define the frame thicknesses); the rest
   * are widgets (close box, zoom box, windowshade, ...).
   */
  parts: Record<string, WindowPart>;
}

export interface ChromeElement {
  asset: string;
  width: number;
  height: number;
}

export interface ThemeManifest {
  name: string;
  windowTypes: Record<string, WindowType>;
  chromeElements: Record<string, ChromeElement>;
}

/** A fetched bundle plus the base URL its asset paths resolve against. */
export interface LoadedTheme {
  manifest: ThemeManifest;
  baseUrl: string;
}
