import { describe, expect, it } from 'vitest';
import {
  computeConformanceReport,
  classifyCicnFamily,
} from './conformanceReport.js';
import { THEME_SCHEMA_VERSION, type Theme } from '../schema/types.js';

describe('classifyCicnFamily', () => {
  it.each([
    ['active-document-window', 'chrome'],
    ['normal-horizontal-scrollbar', 'scroll'],
    ['horizontal-slider-tick', 'slider'],
    ['checkboxes-empty-active', 'control'],
    ['radio-buttons-on-active', 'control'],
    ['lsf-front-tab', 'tab'],
    ['menu-bar', 'menu'],
    ['popup-menu-arrow-only', 'popup'],
    ['active-progress-frame', 'progress'],
    ['down-pointing-disclosure-triangle', 'disclosure'],
    ['inactive-right-pointing-disclosure-tringle', 'disclosure'],
    ['standard-file-divider-line', 'misc'],
    ['some-thing-not-known', 'unclassified'],
  ])('classifies %s → %s', (slug, family) => {
    expect(classifyCicnFamily(slug)).toBe(family);
  });
});

describe('computeConformanceReport', () => {
  const theme: Theme = {
    version: THEME_SCHEMA_VERSION,
    windowTypes: {
      'document-window': {
        chrome: {
          active: 'cicns/active.png',
          inactive: 'cicns/inactive.png',
        },
        parts: { 'part-0': { rect: [1, 22, 72, 23] } },
        edges: { top: [{ at: 0, part: 'part-0' }] },
      },
    },
    chromeElements: {
      // Window chrome — rendered (via consumedAssets)
      'active-document-window': { asset: 'cicns/active.png', width: 74, height: 25 },
      'inactive-document-window': { asset: 'cicns/inactive.png', width: 74, height: 25 },
      // Checkbox — rendered (via RUNTIME_CONSUMED_PATTERNS)
      'checkboxes-empty-active': { asset: 'cicns/cb1.png', width: 12, height: 12 },
      'checkboxes-checked-active': { asset: 'cicns/cb2.png', width: 12, height: 12 },
      // Radio — rendered
      'radio-buttons-off-active': { asset: 'cicns/r1.png', width: 12, height: 12 },
      // Disclosure — rendered (including typo variant)
      'right-pointing-disclosure-triangle': { asset: 'cicns/d1.png', width: 11, height: 11 },
      'inactive-right-pointing-disclosure-tringle': { asset: 'cicns/d2.png', width: 11, height: 11 },
      // Scrollbar — NOT rendered (no composer yet)
      'normal-horizontal-scrollbar': { asset: 'cicns/s1.png', width: 100, height: 16 },
      // Slider — NOT rendered
      'horizontal-slider-tick': { asset: 'cicns/sl1.png', width: 3, height: 8 },
      // Unclassified — NOT rendered
      'whatever-mystery': { asset: 'cicns/m1.png', width: 20, height: 20 },
    },
  };

  it('counts extracted cicns', () => {
    const r = computeConformanceReport(theme);
    expect(r.cicnsExtracted).toBe(10);
  });

  it('counts rendered cicns (chrome states + control families)', () => {
    const r = computeConformanceReport(theme);
    // 2 window chrome + 2 checkbox + 1 radio + 2 disclosure = 7
    expect(r.cicnsRendered).toBe(7);
  });

  it('breaks down counts per family', () => {
    const r = computeConformanceReport(theme);
    expect(r.familyCounts['chrome']).toEqual({ total: 2, rendered: 2 });
    expect(r.familyCounts['control']).toEqual({ total: 3, rendered: 3 });
    expect(r.familyCounts['disclosure']).toEqual({ total: 2, rendered: 2 });
    expect(r.familyCounts['scroll']).toEqual({ total: 1, rendered: 0 });
    expect(r.familyCounts['slider']).toEqual({ total: 1, rendered: 0 });
    expect(r.familyCounts['unclassified']).toEqual({ total: 1, rendered: 0 });
  });

  it('warns when document-window windowType is missing', () => {
    const noDoc: Theme = { ...theme, windowTypes: {} };
    const r = computeConformanceReport(noDoc);
    expect(r.warnings.some((w) => /document-window/.test(w))).toBe(true);
  });

  it('warns when a cicn entry is missing width/height', () => {
    const partial: Theme = {
      version: THEME_SCHEMA_VERSION,
      chromeElements: {
        'active-document-window': { asset: 'cicns/a.png' },
      },
    };
    const r = computeConformanceReport(partial);
    expect(r.warnings.some((w) => /missing width\/height/.test(w))).toBe(true);
  });

  it('handles empty themes gracefully', () => {
    const empty: Theme = { version: THEME_SCHEMA_VERSION };
    const r = computeConformanceReport(empty);
    expect(r.cicnsExtracted).toBe(0);
    expect(r.cicnsRendered).toBe(0);
    expect(r.familyCounts).toEqual({});
  });

  it('fallbacks array is empty (step 6 baseline; populated later)', () => {
    const r = computeConformanceReport(theme);
    expect(r.fallbacks).toEqual([]);
  });
});
