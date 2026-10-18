// Minimal validator for theme.json bundles, used by the extractor (plain JS, no
// dependencies, no dist/ build needed). It checks the field shapes of the
// schema of record, src/types.ts — keep them in sync when the schema changes.
import { macRgbToSrgb } from './mac-gamma.js';

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
  for (const k of ['originalSchemeId', 'minimumKaleidoscopeVersion']) {
    if (k in obj) assertNumber(obj[k], `${path}.${k}`);
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
    if ('bodyRequest' in c && c.bodyRequest !== null) {
      const request = assertObject(c.bodyRequest, `${path}.${key}.bodyRequest`);
      for (const [field, min, max] of [['mode', 0, 255], ['resourceId', -32768, 32767]]) {
        if (!Number.isInteger(request[field]) || request[field] < min || request[field] > max) {
          throw new ThemeValidationError(`must be an integer in [${min}, ${max}]`, `${path}.${key}.bodyRequest.${field}`);
        }
      }
    }
    if ('bodyPattern' in c && c.bodyPattern !== null) {
      assertString(c.bodyPattern, `${path}.${key}.bodyPattern`);
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
    if ('cicnBody' in c) {
      const bodyPath = `${path}.${key}.cicnBody`, b = assertObject(c.cicnBody, bodyPath);
      const reasons = { ready: ['unique-source-occurrence'], missing: ['same-owner-resource-absent'],
        ambiguous: ['duplicate-resource-id', 'ambiguous-asset-path'], unsupported: ['resource-decoding-unavailable',
          'missing-source-layout', 'unsupported-source-layout', 'ambiguous-palette-index', 'missing-palette-index', 'unsupported-one-bit-palette'] };
      if (b.model !== 'kaleidoscope-2.3.1-cicn-body-v1' || b.selectionPolicy !== 'unique-same-face-owner'
          || c.bodyRequest?.mode !== 5 || b.requestedId !== c.bodyRequest.resourceId
          || !Object.prototype.hasOwnProperty.call(reasons, b.status) || !reasons[b.status].includes(b.reason))
        throw new ThemeValidationError('invalid cicn body binding/request/decision', bodyPath);
      if (b.status === 'ready') {
        const target = obj[b.manifestKey], r = b.sourceRect;
        if (!target || target.sourceCicnId !== b.requestedId || b.displayPolicy !== 'mac-1.8-to-2.2-high-byte'
            || ![1, 2, 4, 8].includes(b.pixelSize) || !r || r.x !== 0 || r.y !== 0
            || !Number.isInteger(r.w) || r.w <= 0 || r.w !== target.width
            || !Number.isInteger(r.h) || r.h <= 0 || r.h !== target.height
            || typeof b.asset !== 'string' || !b.asset
            || (b.pixelSize === 1 ? b.copy !== 'masked' || b.derivedPath !== undefined || b.asset !== target.asset
              : b.copy !== 'unmasked' || typeof b.derivedPath !== 'string' || !/^cicn-body\/[^/]+\.png$/.test(b.derivedPath)))
          throw new ThemeValidationError('invalid cicn body source/asset', bodyPath);
      } else if (['asset', 'derivedPath', 'manifestKey', 'sourceRect', 'pixelSize', 'copy'].some(k => k in b))
        throw new ThemeValidationError('unavailable cicn body must not carry a selected source', bodyPath);
    }
    if ('samplingEquivalence' in c && c.samplingEquivalence !== null) {
      const samplePath = `${path}.${key}.samplingEquivalence`;
      const proof = assertObject(c.samplingEquivalence, samplePath);
      const reasons = { equivalent: ['all-opaque-display-rgb-equal'], different: ['opaque-display-mismatch'],
        unknown: ['unsupported-layout', 'missing-sampler', 'unsafe-palette-access', 'ambiguous-asset-path'] };
      if (proof.model !== 'kaleidoscope-2.3.1-opaque-sampling-v1'
          || proof.comparison !== 'opaque-current-display-rgb' || proof.displayPolicy !== 'mac-1.8-to-2.2-high-byte'
          || !Object.prototype.hasOwnProperty.call(reasons, proof.status) || !reasons[proof.status].includes(proof.reason)
          || !Number.isSafeInteger(proof.width) || proof.width <= 0 || proof.width !== c.width
          || !Number.isSafeInteger(proof.height) || proof.height <= 0 || proof.height !== c.height) {
        throw new ThemeValidationError('invalid sampling equivalence model, dimensions or decision', samplePath);
      }
    }
    if ('sampledBandAsset' in c) {
      const samplePath = `${path}.${key}.sampledBandAsset`;
      const a = assertObject(c.sampledBandAsset, samplePath);
      if (a.model !== 'kaleidoscope-2.3.1-opaque-sampling-v1'
          || a.comparison !== 'opaque-current-display-rgb' || a.displayPolicy !== 'mac-1.8-to-2.2-high-byte'
          || !Number.isSafeInteger(a.width) || a.width <= 0 || a.width !== c.width
          || !Number.isSafeInteger(a.height) || a.height <= 0 || a.height !== c.height
          || typeof a.asset !== 'string' || !a.asset || typeof a.derivedPath !== 'string'
          || !/^cicn-sampled\/[^/]+\.png$/.test(a.derivedPath)) {
        throw new ThemeValidationError('invalid sampled band asset model, dimensions or path', samplePath);
      }
    }
    if ('colorSamples' in c && c.colorSamples !== null) {
      const samplePath = `${path}.${key}.colorSamples`;
      const colors = assertObject(c.colorSamples, samplePath);
      if (colors.model !== 'kdef-2.3.1-color' || colors.displayPolicy !== 'mac-1.8-to-2.2-high-byte') {
        throw new ThemeValidationError('unknown color sample model/display policy', samplePath);
      }
      for (const role of ['background', 'text', 'emboss']) {
        if (colors[role] === null) continue;
        const sample = assertObject(colors[role], `${samplePath}.${role}`);
        for (const [field, max] of [['rgb16', 65535], ['displayRgb', 255]]) {
          if (!Array.isArray(sample[field]) || sample[field].length !== 3
              || sample[field].some(value => !Number.isInteger(value) || value < 0 || value > max)) {
            throw new ThemeValidationError(`expected three integers in [0, ${max}]`, `${samplePath}.${role}.${field}`);
          }
        }
        const display = macRgbToSrgb(sample.rgb16.map(value => value >> 8));
        if (sample.displayRgb.some((value, i) => value !== display[i])) {
          throw new ThemeValidationError('display RGB disagrees with raw RGB16/display policy', `${samplePath}.${role}.displayRgb`);
        }
      }
      if (!['absent-coordinates', 'same-as-background', 'sentinel', 'present', 'unknown'].includes(colors.embossDecision)
          || (colors.embossDecision === 'present' && !colors.emboss)) {
        throw new ThemeValidationError('invalid emboss decision/sample', `${samplePath}.embossDecision`);
      }
    }
    if ('colorSamplesUnavailableReason' in c && (c.colorSamplesUnavailableReason !== 'ambiguous-asset-path' || c.colorSamples !== null)) {
      throw new ThemeValidationError('ambiguous samples must be null', `${path}.${key}.colorSamplesUnavailableReason`);
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
