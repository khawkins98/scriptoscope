// Hand-rolled runtime validator for theme.json bundles.
//
// Throws ThemeValidationError on first violation. No external dependency:
// zod et al. would add bundle weight, and the schema is shallow enough that
// hand-rolling is cheaper and clearer.

import {
  THEME_SCHEMA_VERSION,
  type ChromeElementEntry,
  type CursorEntry,
  type EdgeRecipe,
  type PartEntry,
  type PatternEntry,
  type SliceSpec,
  type Theme,
  type ThemeAuthor,
  type ThemeOptions,
  type ThemeOrigin,
  type WindowChromeStates,
  type WindowEdges,
  type WindowTypeEntry,
} from './types.js';

export class ThemeValidationError extends Error {
  override name = 'ThemeValidationError';
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(`${path}: ${message}`);
  }
}

/**
 * Validate an arbitrary JSON value and narrow it to {@link Theme}.
 *
 * Throws {@link ThemeValidationError} on first violation. The validator is
 * permissive about unknown extra fields (forward-compat) and strict about
 * field shapes that are present.
 *
 * @example
 * const json = await fetch('/themes/7-le/theme.json').then(r => r.json());
 * const theme = parseTheme(json);   // typed as Theme
 */
export function parseTheme(input: unknown): Theme {
  const root = assertObject(input, 'theme.json');
  const version = root['version'];
  if (version !== THEME_SCHEMA_VERSION) {
    throw new ThemeValidationError(
      `expected version "${THEME_SCHEMA_VERSION}", got ${JSON.stringify(version)}`,
      'theme.json.version',
    );
  }

  const out: Theme = { version: THEME_SCHEMA_VERSION };

  // Optional top-level scalars.
  if ('name' in root) out.name = assertString(root['name'], 'theme.json.name');
  if ('source' in root) out.source = assertString(root['source'], 'theme.json.source');
  if ('generatedAt' in root)
    out.generatedAt = assertString(root['generatedAt'], 'theme.json.generatedAt');
  if ('note' in root) out.note = assertString(root['note'], 'theme.json.note');

  // Optional nested structures.
  if ('author' in root) out.author = parseAuthor(root['author'], 'theme.json.author');
  if ('origin' in root) out.origin = parseOrigin(root['origin'], 'theme.json.origin');
  if ('options' in root)
    out.options = parseOptions(root['options'], 'theme.json.options');
  if ('windowTypes' in root)
    out.windowTypes = parseWindowTypes(root['windowTypes'], 'theme.json.windowTypes');
  if ('chromeElements' in root)
    out.chromeElements = parseChromeElements(
      root['chromeElements'],
      'theme.json.chromeElements',
    );
  if ('patterns' in root)
    out.patterns = parsePatterns(root['patterns'], 'theme.json.patterns');
  if ('palette' in root)
    out.palette = parsePalette(root['palette'], 'theme.json.palette');
  if ('cursors' in root)
    out.cursors = parseCursors(root['cursors'], 'theme.json.cursors');

  return out;
}

// ─── Section parsers ─────────────────────────────────────────────────────

function parseAuthor(value: unknown, path: string): ThemeAuthor {
  const obj = assertObject(value, path);
  const author: ThemeAuthor = {
    name: assertString(obj['name'], `${path}.name`),
  };
  if ('email' in obj) author.email = assertString(obj['email'], `${path}.email`);
  if ('url' in obj) author.url = assertString(obj['url'], `${path}.url`);
  if ('year' in obj) author.year = assertNumber(obj['year'], `${path}.year`);
  return author;
}

function parseOrigin(value: unknown, path: string): ThemeOrigin {
  const obj = assertObject(value, path);
  const origin: ThemeOrigin = {
    kind: assertString(obj['kind'], `${path}.kind`),
  };
  if ('originalFormat' in obj)
    origin.originalFormat = assertString(obj['originalFormat'], `${path}.originalFormat`);
  if ('originalLicense' in obj)
    origin.originalLicense = assertString(obj['originalLicense'], `${path}.originalLicense`);
  if ('originalReadme' in obj)
    origin.originalReadme = assertString(obj['originalReadme'], `${path}.originalReadme`);
  if ('sourceUrl' in obj)
    origin.sourceUrl = assertString(obj['sourceUrl'], `${path}.sourceUrl`);
  return origin;
}

function parseOptions(value: unknown, path: string): ThemeOptions {
  const obj = assertObject(value, path);
  const opts: ThemeOptions = {};
  const flagKeys = [
    'menuHighlightOverlay',
    'unifiedScrollbarTrack',
    'windowsStyleScrollbars',
    'extendedScrollbarArrows',
    'stretchScrollbarThumbFromCenter',
  ] as const;
  for (const key of flagKeys) {
    if (key in obj) opts[key] = assertBoolean(obj[key], `${path}.${key}`);
  }
  return opts;
}

function parseWindowTypes(
  value: unknown,
  path: string,
): Record<string, WindowTypeEntry> {
  const obj = assertObject(value, path);
  const out: Record<string, WindowTypeEntry> = {};
  for (const [key, raw] of Object.entries(obj)) {
    out[key] = parseWindowType(raw, `${path}.${key}`);
  }
  return out;
}

function parseWindowType(value: unknown, path: string): WindowTypeEntry {
  const obj = assertObject(value, path);
  const chrome = parseWindowChromeStates(obj['chrome'], `${path}.chrome`);
  const entry: WindowTypeEntry = { chrome };
  if ('parts' in obj)
    entry.parts = parseParts(obj['parts'], `${path}.parts`);
  if ('edges' in obj)
    entry.edges = parseEdges(obj['edges'], `${path}.edges`);
  if ('bodyPattern' in obj) {
    const bp = obj['bodyPattern'];
    if (bp === null) entry.bodyPattern = null;
    else entry.bodyPattern = assertString(bp, `${path}.bodyPattern`);
  }
  return entry;
}

function parseWindowChromeStates(
  value: unknown,
  path: string,
): WindowChromeStates {
  const obj = assertObject(value, path);
  const out: WindowChromeStates = {};
  for (const state of ['active', 'inactive', 'collapsed-active', 'collapsed-inactive'] as const) {
    if (state in obj) out[state] = assertString(obj[state], `${path}.${state}`);
  }
  // At least one state must be present — otherwise the chrome can't render.
  if (Object.keys(out).length === 0) {
    throw new ThemeValidationError(
      'window chrome must define at least one state (active, inactive, collapsed-active, collapsed-inactive)',
      path,
    );
  }
  return out;
}

function parseParts(value: unknown, path: string): Record<string, PartEntry> {
  const obj = assertObject(value, path);
  const out: Record<string, PartEntry> = {};
  for (const [key, raw] of Object.entries(obj)) {
    const partObj = assertObject(raw, `${path}.${key}`);
    out[key] = { rect: parseRect(partObj['rect'], `${path}.${key}.rect`) };
  }
  return out;
}

function parseRect(value: unknown, path: string): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new ThemeValidationError('expected [left, top, right, bottom] tuple', path);
  }
  return [
    assertNumber(value[0], `${path}[0]`),
    assertNumber(value[1], `${path}[1]`),
    assertNumber(value[2], `${path}[2]`),
    assertNumber(value[3], `${path}[3]`),
  ];
}

function parseEdges(value: unknown, path: string): WindowEdges {
  const obj = assertObject(value, path);
  const out: WindowEdges = {};
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    if (side in obj) out[side] = parseEdgeRecipes(obj[side], `${path}.${side}`);
  }
  return out;
}

function parseEdgeRecipes(value: unknown, path: string): EdgeRecipe[] {
  if (!Array.isArray(value)) {
    throw new ThemeValidationError('expected array of edge recipes', path);
  }
  return value.map((entry, i) => {
    const obj = assertObject(entry, `${path}[${i}]`);
    return {
      at: assertNumber(obj['at'], `${path}[${i}].at`),
      part: assertString(obj['part'], `${path}[${i}].part`),
    };
  });
}

function parseChromeElements(
  value: unknown,
  path: string,
): Record<string, ChromeElementEntry> {
  const obj = assertObject(value, path);
  const out: Record<string, ChromeElementEntry> = {};
  for (const [key, raw] of Object.entries(obj)) {
    out[key] = parseChromeElement(raw, `${path}.${key}`);
  }
  return out;
}

function parseChromeElement(value: unknown, path: string): ChromeElementEntry {
  const obj = assertObject(value, path);
  const entry: ChromeElementEntry = {
    asset: assertString(obj['asset'], `${path}.asset`),
  };
  if ('width' in obj) entry.width = assertNumber(obj['width'], `${path}.width`);
  if ('height' in obj) entry.height = assertNumber(obj['height'], `${path}.height`);
  if ('slice' in obj) {
    const slice = obj['slice'];
    if (slice === null) entry.slice = null;
    else entry.slice = parseSlice(slice, `${path}.slice`);
  }
  if ('bgPattern' in obj) {
    const bp = obj['bgPattern'];
    if (bp === null) entry.bgPattern = null;
    else entry.bgPattern = assertString(bp, `${path}.bgPattern`);
  }
  if ('bgAnchor' in obj) {
    const ba = obj['bgAnchor'];
    if (ba === null) entry.bgAnchor = null;
    else entry.bgAnchor = parsePair(ba, `${path}.bgAnchor`);
  }
  if ('textAnchor' in obj) {
    const ta = obj['textAnchor'];
    if (ta === null) entry.textAnchor = null;
    else entry.textAnchor = parsePair(ta, `${path}.textAnchor`);
  }
  if ('embossAnchor' in obj) {
    const ea = obj['embossAnchor'];
    if (ea === null) entry.embossAnchor = null;
    else entry.embossAnchor = parsePair(ea, `${path}.embossAnchor`);
  }
  if ('tile' in obj) {
    const t = obj['tile'];
    if (t === null) entry.tile = null;
    else {
      const tileStr = assertString(t, `${path}.tile`);
      if (tileStr !== 'horizontal' && tileStr !== 'vertical' && tileStr !== 'both') {
        throw new ThemeValidationError(
          `expected "horizontal" | "vertical" | "both", got ${JSON.stringify(tileStr)}`,
          `${path}.tile`,
        );
      }
      entry.tile = tileStr;
    }
  }
  if ('sourceCicnId' in obj) {
    const v = obj['sourceCicnId'];
    if (v === null) entry.sourceCicnId = null;
    else entry.sourceCicnId = assertNumber(v, `${path}.sourceCicnId`);
  }
  if ('sourceCinfId' in obj) {
    const v = obj['sourceCinfId'];
    if (v === null) entry.sourceCinfId = null;
    else entry.sourceCinfId = assertNumber(v, `${path}.sourceCinfId`);
  }
  return entry;
}

const RESIZE_BEHAVIORS = new Set([
  'stretch-whole', 'stretch-top', 'stretch-left', 'stretch-bottom', 'stretch-right',
  'repeat-whole', 'repeat-top', 'repeat-left', 'repeat-bottom', 'repeat-right',
  'anchor-center', 'anchor-top-left', 'anchor-top-right', 'anchor-bottom-left', 'anchor-bottom-right',
]);

function parseSlice(value: unknown, path: string): SliceSpec {
  const obj = assertObject(value, path);
  const slice: SliceSpec = {
    corner: assertNumber(obj['corner'], `${path}.corner`),
    side: assertNumber(obj['side'], `${path}.side`),
    tile: assertBoolean(obj['tile'], `${path}.tile`),
  };
  if ('resizeBehavior' in obj && obj['resizeBehavior'] != null) {
    const rb = assertString(obj['resizeBehavior'], `${path}.resizeBehavior`);
    if (!RESIZE_BEHAVIORS.has(rb)) {
      throw new ThemeValidationError(
        `expected one of ${[...RESIZE_BEHAVIORS].join(', ')}, got ${JSON.stringify(rb)}`,
        `${path}.resizeBehavior`,
      );
    }
    slice.resizeBehavior = rb as NonNullable<SliceSpec['resizeBehavior']>;
  }
  return slice;
}

function parsePair(value: unknown, path: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new ThemeValidationError('expected [x, y] tuple', path);
  }
  return [assertNumber(value[0], `${path}[0]`), assertNumber(value[1], `${path}[1]`)];
}

function parsePatterns(value: unknown, path: string): Record<string, PatternEntry> {
  const obj = assertObject(value, path);
  const out: Record<string, PatternEntry> = {};
  for (const [key, raw] of Object.entries(obj)) {
    const patObj = assertObject(raw, `${path}.${key}`);
    const entry: PatternEntry = { asset: assertString(patObj['asset'], `${path}.${key}.asset`) };
    if ('repeat' in patObj) {
      const r = assertString(patObj['repeat'], `${path}.${key}.repeat`);
      if (r !== 'horizontal' && r !== 'vertical' && r !== 'both') {
        throw new ThemeValidationError(
          `expected "horizontal" | "vertical" | "both", got ${JSON.stringify(r)}`,
          `${path}.${key}.repeat`,
        );
      }
      entry.repeat = r;
    }
    out[key] = entry;
  }
  return out;
}

function parseCursors(value: unknown, path: string): Record<string, CursorEntry> {
  const obj = assertObject(value, path);
  const out: Record<string, CursorEntry> = {};
  for (const [key, raw] of Object.entries(obj)) {
    const cur = assertObject(raw, `${path}.${key}`);
    const entry: CursorEntry = {
      asset: assertString(cur['asset'], `${path}.${key}.asset`),
      hotspot: parsePair(cur['hotspot'], `${path}.${key}.hotspot`),
    };
    if ('fallback' in cur)
      entry.fallback = assertString(cur['fallback'], `${path}.${key}.fallback`);
    out[key] = entry;
  }
  return out;
}

function parsePalette(value: unknown, path: string): Record<string, string> {
  const obj = assertObject(value, path);
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(obj)) {
    out[key] = assertString(raw, `${path}.${key}`);
  }
  return out;
}

// ─── Primitive assertion helpers ─────────────────────────────────────────

function assertObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ThemeValidationError(`expected object, got ${describe(value)}`, path);
  }
  return value as Record<string, unknown>;
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new ThemeValidationError(`expected string, got ${describe(value)}`, path);
  }
  return value;
}

function assertNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ThemeValidationError(`expected finite number, got ${describe(value)}`, path);
  }
  return value;
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ThemeValidationError(`expected boolean, got ${describe(value)}`, path);
  }
  return value;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
