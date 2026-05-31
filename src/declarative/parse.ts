// Pure, DOM-free parsing for the declarative (`data-scriptoscope-*`) window layer. No imports, no DOM —
// so it's unit-testable in Node. The scanner (scanner.ts) collects the DOM-side inputs (dataset
// records, the ancestor theme chain) and feeds them here.

export type SizeMode = 'declared' | 'fit';

/** A window's options parsed from `data-scriptoscope-*` attributes. */
export interface ParsedWindow {
  windowType: string; // default 'document-window'
  title?: string;
  state: 'active' | 'inactive'; // default 'active'
  x?: number;
  y?: number;
  width?: number; // CONTENT width (px)
  height?: number; // CONTENT height (px)
  /** Additive padding on the auto-captured natural rect — `data-scriptoscope-extra-width`
   *  / `data-scriptoscope-extra-height`. Use when the consumer's element will GROW after
   *  promote (e.g. a theme-picker whose tiles are populated by the runtime, so the bare-
   *  HTML rect doesn't represent the final content size). Ignored when explicit
   *  `width` / `height` is set (the consumer already specified absolute dimensions). */
  extraWidth?: number;
  extraHeight?: number;
  /** 'fit' when BOTH width and height are omitted → size to the content; else 'declared'. */
  sizeMode: SizeMode;
  /** Initial z-order — `data-scriptoscope-z`. Higher = closer to the front. Lets the page DECLARE which
   *  window should boot on top (without it the scanner falls back to document order). Optional. */
  z?: number;
  /** Boot the window already window-shaded — `data-scriptoscope-collapsed`. Classic Mac users left
   *  Notepad / palettes rolled-up at startup; this restores that. Default false. */
  collapsed: boolean;
}

/** A button's options parsed from `data-scriptoscope-button` + neighbours. */
export interface ParsedButton {
  label?: string;
  isDefault: boolean; // the OK ring
  disabled: boolean;
}

/** Coerce an attribute string to a finite number, else undefined (empty / NaN → undefined). */
const num = (v: string | undefined): number | undefined => {
  if (v == null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** A boolean attribute is "present" unless its value is literally "false". */
const present = (v: string | undefined): boolean => v != null && v !== 'false';

/** Parse a `data-scriptoscope-window` element's `dataset` (a plain record here) into window options. */
export function parseWindowAttrs(d: Record<string, string | undefined>): ParsedWindow {
  const width = num(d.scriptoscopeWidth);
  const height = num(d.scriptoscopeHeight);
  const extraWidth = num(d.scriptoscopeExtraWidth);
  const extraHeight = num(d.scriptoscopeExtraHeight);
  const x = num(d.scriptoscopeX);
  const y = num(d.scriptoscopeY);
  const z = num(d.scriptoscopeZ);
  return {
    windowType: d.scriptoscopeWindowType?.trim() || 'document-window',
    state: d.scriptoscopeState === 'inactive' ? 'inactive' : 'active',
    sizeMode: width === undefined && height === undefined ? 'fit' : 'declared',
    collapsed: present(d.scriptoscopeCollapsed),
    ...(d.scriptoscopeTitle != null ? { title: d.scriptoscopeTitle } : {}),
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(extraWidth !== undefined ? { extraWidth } : {}),
    ...(extraHeight !== undefined ? { extraHeight } : {}),
    ...(z !== undefined ? { z } : {}),
  };
}

/** Parse a `data-scriptoscope-button` element's `dataset` + its text content into button options. */
export function parseButtonAttrs(d: Record<string, string | undefined>, text: string): ParsedButton {
  const label = text.trim();
  return {
    isDefault: present(d.scriptoscopeDefault),
    disabled: present(d.scriptoscopeDisabled),
    ...(label ? { label } : {}),
  };
}

/** Nearest-ancestor-wins theme ref: `chain` is OUTERMOST→INNERMOST; the last non-empty wins,
 *  falling back to `pageDefault`. (The caller collects the chain by walking ancestors.) */
export function resolveThemeRef(
  chainOuterToInner: (string | null | undefined)[],
  pageDefault?: string,
): string | undefined {
  let ref = pageDefault;
  for (const v of chainOuterToInner) {
    if (v != null && v.trim() !== '') ref = v.trim();
  }
  return ref;
}

const URL_RE = /^(?:https?:|\/|\.\/|\.\.\/|blob:|data:)/;
/** True if a `data-scriptoscope-theme` value is already a URL/path (vs. a bare bundle slug). */
export function isThemeUrl(ref: string): boolean {
  return URL_RE.test(ref);
}

/** Resolve a `data-scriptoscope-theme` value (slug OR url) to a bundle URL under `themeBaseUrl`. */
export function themeRefToUrl(ref: string, themeBaseUrl: string): string {
  return isThemeUrl(ref) ? ref : `${themeBaseUrl.replace(/\/$/, '')}/${ref}`;
}
