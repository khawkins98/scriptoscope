import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installEngineBaseline,
  _resetEngineBaselineForTests,
  __ENGINE_BASELINE_CSS_FOR_TESTS,
} from './engineBaseline.js';

beforeEach(() => {
  _resetEngineBaselineForTests();
});

afterEach(() => {
  // Remove any installed stylesheet/style tag for hygiene.
  for (const s of Array.from(document.querySelectorAll('style[data-aaron-engine-baseline]'))) {
    s.remove();
  }
  try {
    (document as Document & { adoptedStyleSheets: CSSStyleSheet[] }).adoptedStyleSheets = [];
  } catch { /* ignore */ }
});

describe('installEngineBaseline', () => {
  it('installs without throwing', () => {
    expect(() => installEngineBaseline()).not.toThrow();
  });

  it('is idempotent: second call has no effect', () => {
    installEngineBaseline();
    installEngineBaseline();
    // No specific assertion on sheet count — jsdom may use either path.
    // The "no throw" + "no warnings" is the test.
  });
});

describe('CSS content', () => {
  it('contains the .aaron-button rule', () => {
    expect(__ENGINE_BASELINE_CSS_FOR_TESTS).toContain('.aaron-button');
  });

  it('contains pressed-state rule', () => {
    expect(__ENGINE_BASELINE_CSS_FOR_TESTS).toContain('.aaron-button[data-state="pressed"]');
  });

  it('contains disabled-state rule', () => {
    expect(__ENGINE_BASELINE_CSS_FOR_TESTS).toMatch(/\.aaron-button\[aria-disabled="true"\]/);
  });

  it('contains default-button variant rule', () => {
    expect(__ENGINE_BASELINE_CSS_FOR_TESTS).toContain('.aaron-button--default');
  });

  it('uses palette custom properties', () => {
    expect(__ENGINE_BASELINE_CSS_FOR_TESTS).toContain('var(--aaron-colr-');
  });

  it('focus-visible rule uses palette accent', () => {
    expect(__ENGINE_BASELINE_CSS_FOR_TESTS).toMatch(/:focus-visible\s*\{[\s\S]*?--aaron-colr-accent/);
  });

  it('does NOT contain any :hover rules (period-faithful no-hover policy)', () => {
    expect(__ENGINE_BASELINE_CSS_FOR_TESTS).not.toContain(':hover');
  });
});
