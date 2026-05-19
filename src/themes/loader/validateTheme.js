// Minimal runtime validator for theme.json bundles — JS port of the critical
// assertions from src/themes/schema/parseTheme.ts.
//
// WHY a separate JS port: the extractor is plain JS (so it can run in browsers
// once the resource-fork parser lands), but the library validator is TS.
// Importing the TS validator would require building dist/ first, which is
// friction for end users running `scheme-extract --validate`. The JS port
// covers the same field shapes with no dependencies.
//
// SOURCE OF TRUTH: src/themes/schema/parseTheme.ts. When the schema version
// bumps or shapes change, mirror them here. The shared-fixture test in
// src/themes/schema/parseTheme.test.ts and the buildThemeJson tests both
// validate the same shapes, so drift surfaces quickly.

export class ThemeValidationError extends Error {
  constructor(message, path) {
    super(`${path}: ${message}`);
    this.name = 'ThemeValidationError';
    this.path = path;
  }
}

export function validateTheme(input) {
  const root = assertObject(input, 'theme.json');
  if (root.version !== '0.1') {
    throw new ThemeValidationError(
      `expected version "0.1", got ${JSON.stringify(root.version)}`,
      'theme.json.version',
    );
  }

  if ('name' in root) assertString(root.name, 'theme.json.name');
  if ('source' in root) assertString(root.source, 'theme.json.source');
  if ('generatedAt' in root) assertString(root.generatedAt, 'theme.json.generatedAt');
  if ('note' in root) assertString(root.note, 'theme.json.note');

  if ('author' in root) validateAuthor(root.author, 'theme.json.author');
  if ('origin' in root) validateOrigin(root.origin, 'theme.json.origin');
  if ('options' in root) validateOptions(root.options, 'theme.json.options');
  if ('windowTypes' in root) validateWindowTypes(root.windowTypes, 'theme.json.windowTypes');
  if ('chromeElements' in root) validateChromeElements(root.chromeElements, 'theme.json.chromeElements');
  if ('patterns' in root) validatePatterns(root.patterns, 'theme.json.patterns');
  if ('palette' in root) validatePalette(root.palette, 'theme.json.palette');

  return root;
}

function validateAuthor(value, path) {
  const obj = assertObject(value, path);
  assertString(obj.name, `${path}.name`);
  if ('email' in obj) assertString(obj.email, `${path}.email`);
  if ('url' in obj) assertString(obj.url, `${path}.url`);
  if ('year' in obj) assertNumber(obj.year, `${path}.year`);
}

function validateOrigin(value, path) {
  const obj = assertObject(value, path);
  assertString(obj.kind, `${path}.kind`);
  for (const k of ['originalFormat', 'originalLicense', 'originalReadme', 'sourceUrl']) {
    if (k in obj) assertString(obj[k], `${path}.${k}`);
  }
}

function validateOptions(value, path) {
  const obj = assertObject(value, path);
  for (const k of [
    'menuHighlightOverlay',
    'unifiedScrollbarTrack',
    'windowsStyleScrollbars',
    'extendedScrollbarArrows',
    'stretchScrollbarThumbFromCenter',
  ]) {
    if (k in obj) assertBoolean(obj[k], `${path}.${k}`);
  }
}

function validateWindowTypes(value, path) {
  const obj = assertObject(value, path);
  for (const [key, entry] of Object.entries(obj)) {
    const w = assertObject(entry, `${path}.${key}`);
    const chrome = assertObject(w.chrome, `${path}.${key}.chrome`);
    let stateCount = 0;
    for (const state of ['active', 'inactive', 'collapsed-active', 'collapsed-inactive']) {
      if (state in chrome) {
        assertString(chrome[state], `${path}.${key}.chrome.${state}`);
        stateCount++;
      }
    }
    if (stateCount === 0) {
      throw new ThemeValidationError(
        'window chrome must define at least one state (active, inactive, collapsed-active, collapsed-inactive)',
        `${path}.${key}.chrome`,
      );
    }
    if ('parts' in w) {
      const parts = assertObject(w.parts, `${path}.${key}.parts`);
      for (const [partKey, partEntry] of Object.entries(parts)) {
        const p = assertObject(partEntry, `${path}.${key}.parts.${partKey}`);
        assertRect(p.rect, `${path}.${key}.parts.${partKey}.rect`);
      }
    }
    if ('edges' in w) {
      const edges = assertObject(w.edges, `${path}.${key}.edges`);
      for (const side of ['top', 'bottom', 'left', 'right']) {
        if (side in edges) {
          if (!Array.isArray(edges[side])) {
            throw new ThemeValidationError(
              'expected array of edge recipes',
              `${path}.${key}.edges.${side}`,
            );
          }
          edges[side].forEach((e, i) => {
            const er = assertObject(e, `${path}.${key}.edges.${side}[${i}]`);
            assertNumber(er.at, `${path}.${key}.edges.${side}[${i}].at`);
            assertString(er.part, `${path}.${key}.edges.${side}[${i}].part`);
          });
        }
      }
    }
    if ('bodyPattern' in w && w.bodyPattern !== null) {
      assertString(w.bodyPattern, `${path}.${key}.bodyPattern`);
    }
  }
}

function validateChromeElements(value, path) {
  const obj = assertObject(value, path);
  for (const [key, entry] of Object.entries(obj)) {
    const c = assertObject(entry, `${path}.${key}`);
    assertString(c.asset, `${path}.${key}.asset`);
    if ('width' in c) assertNumber(c.width, `${path}.${key}.width`);
    if ('height' in c) assertNumber(c.height, `${path}.${key}.height`);
    if ('slice' in c && c.slice !== null) {
      const s = assertObject(c.slice, `${path}.${key}.slice`);
      assertNumber(s.corner, `${path}.${key}.slice.corner`);
      assertNumber(s.side, `${path}.${key}.slice.side`);
      assertBoolean(s.tile, `${path}.${key}.slice.tile`);
    }
    if ('bgPattern' in c && c.bgPattern !== null) {
      assertString(c.bgPattern, `${path}.${key}.bgPattern`);
    }
    if ('bgAnchor' in c && c.bgAnchor !== null) {
      assertPair(c.bgAnchor, `${path}.${key}.bgAnchor`);
    }
    if ('textAnchor' in c && c.textAnchor !== null) {
      assertPair(c.textAnchor, `${path}.${key}.textAnchor`);
    }
    if ('embossAnchor' in c && c.embossAnchor !== null) {
      assertPair(c.embossAnchor, `${path}.${key}.embossAnchor`);
    }
    if ('tile' in c && c.tile !== null) {
      const t = assertString(c.tile, `${path}.${key}.tile`);
      if (t !== 'horizontal' && t !== 'vertical' && t !== 'both') {
        throw new ThemeValidationError(
          `expected "horizontal" | "vertical" | "both", got ${JSON.stringify(t)}`,
          `${path}.${key}.tile`,
        );
      }
    }
  }
}

function validatePatterns(value, path) {
  const obj = assertObject(value, path);
  for (const [key, entry] of Object.entries(obj)) {
    const p = assertObject(entry, `${path}.${key}`);
    assertString(p.asset, `${path}.${key}.asset`);
    if ('repeat' in p) {
      const r = assertString(p.repeat, `${path}.${key}.repeat`);
      if (r !== 'horizontal' && r !== 'vertical' && r !== 'both') {
        throw new ThemeValidationError(
          `expected "horizontal" | "vertical" | "both", got ${JSON.stringify(r)}`,
          `${path}.${key}.repeat`,
        );
      }
    }
  }
}

function validatePalette(value, path) {
  const obj = assertObject(value, path);
  for (const [key, raw] of Object.entries(obj)) {
    assertString(raw, `${path}.${key}`);
  }
}

// ─── Primitives ────────────────────────────────────────────────────────

function assertObject(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ThemeValidationError(`expected object, got ${describe(value)}`, path);
  }
  return value;
}

function assertString(value, path) {
  if (typeof value !== 'string') {
    throw new ThemeValidationError(`expected string, got ${describe(value)}`, path);
  }
  return value;
}

function assertNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ThemeValidationError(`expected finite number, got ${describe(value)}`, path);
  }
  return value;
}

function assertBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw new ThemeValidationError(`expected boolean, got ${describe(value)}`, path);
  }
}

function assertRect(value, path) {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new ThemeValidationError('expected [left, top, right, bottom] tuple', path);
  }
  value.forEach((n, i) => assertNumber(n, `${path}[${i}]`));
}

function assertPair(value, path) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new ThemeValidationError('expected [x, y] tuple', path);
  }
  value.forEach((n, i) => assertNumber(n, `${path}[${i}]`));
}

function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
