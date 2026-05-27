// Pure, DOM-free parsing for the declarative (`data-aaron-*`) window layer. No imports, no DOM —
// so it's unit-testable in Node. The scanner (scanner.ts) collects the DOM-side inputs (dataset
// records, the ancestor theme chain) and feeds them here.

export type SizeMode = 'declared' | 'fit';

/** A window's options parsed from `data-aaron-*` attributes. */
export interface ParsedWindow {
  windowType: string; // default 'document-window'
  title?: string;
  state: 'active' | 'inactive'; // default 'active'
  x?: number;
  y?: number;
  width?: number; // CONTENT width (px)
  height?: number; // CONTENT height (px)
  /** 'fit' when BOTH width and height are omitted → size to the content; else 'declared'. */
  sizeMode: SizeMode;
}

/** A button's options parsed from `data-aaron-button` + neighbours. */
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

/** Parse a `data-aaron-window` element's `dataset` (a plain record here) into window options. */
export function parseWindowAttrs(d: Record<string, string | undefined>): ParsedWindow {
  const width = num(d.aaronWidth);
  const height = num(d.aaronHeight);
  const x = num(d.aaronX);
  const y = num(d.aaronY);
  return {
    windowType: d.aaronWindowType?.trim() || 'document-window',
    state: d.aaronState === 'inactive' ? 'inactive' : 'active',
    sizeMode: width === undefined && height === undefined ? 'fit' : 'declared',
    ...(d.aaronTitle != null ? { title: d.aaronTitle } : {}),
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
}

/** Parse a `data-aaron-button` element's `dataset` + its text content into button options. */
export function parseButtonAttrs(d: Record<string, string | undefined>, text: string): ParsedButton {
  const label = text.trim();
  return {
    isDefault: present(d.aaronDefault),
    disabled: present(d.aaronDisabled),
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
/** True if a `data-aaron-theme` value is already a URL/path (vs. a bare bundle slug). */
export function isThemeUrl(ref: string): boolean {
  return URL_RE.test(ref);
}

/** Resolve a `data-aaron-theme` value (slug OR url) to a bundle URL under `themeBaseUrl`. */
export function themeRefToUrl(ref: string, themeBaseUrl: string): string {
  return isThemeUrl(ref) ? ref : `${themeBaseUrl.replace(/\/$/, '')}/${ref}`;
}
