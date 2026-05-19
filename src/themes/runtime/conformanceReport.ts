// Conformance report — spec C §4.5 + spec B §12.
//
// Given a loaded Theme, compute a structured report on what the runtime
// actually consumes. Useful for:
//   - The diagnostics page (Coverage section)
//   - Programmatic introspection ("does this scheme support menus?")
//   - Future bundle-builder validation (warn on incomplete schemes)
//
// Pure function: no side effects, no JSDOM dependency, deterministic
// output for a given Theme. Safe to call repeatedly.

import type { ConformanceReport, Theme } from '../schema/types.js';

// Slugs the runtime actively renders today. Sourced from each family's
// composer / attachThemeTo helper. Keep this in sync as new families
// move from "extracted but not rendered" to "rendered".
//
// Window chrome slugs are dynamic (per windowType.chrome) — handled
// separately below.
const RUNTIME_CONSUMED_PATTERNS: RegExp[] = [
  // Checkbox + radio (step 3a)
  /^checkboxes-(empty|checked|mixed|traditional)-(active|pressed|inactive)$/,
  /^radio-buttons-(off|on|mixed)-(active|pressed|inactive)$/,
  // Disclosure triangle (step 3b) — handle both correct + "tringle"
  // typo variants observed in 7 Le's extracted bundle.
  /^(right|down)-pointing-disclosure-(triangle|tringle)$/,
  /^(pressed|inactive)-(right|down)-pointing-disclosure-(triangle|tringle)$/,
];

// Family classifier — slug-name regex match. Buckets every cicn into
// one of these for the per-family coverage breakdown.
//
// Order matters: more-specific families must come before more-general
// ones. Examples of collisions handled by ordering below:
//   - "popup-menu-arrow-only" → popup, not scroll (which also has /arrow/)
//   - "active-progress-frame" → progress, not chrome (which has /frame/)
//   - "down-pointing-disclosure-triangle" → disclosure, not popup
const FAMILY_PATTERNS: Array<readonly [string, RegExp]> = [
  ['disclosure', /disclosure|triangle|tringle/i],
  ['progress',   /progress/i],
  ['popup',      /popup|combo/i],
  ['slider',     /slider/i],
  ['tab',        /tab/i],
  ['menu',       /menu/i],
  ['scroll',     /scroll|thumb|arrow/i],
  ['control',    /button|checkbox|radio|control/i],
  ['chrome',     /window|grow-box|widget|collapsed|chrome|frame/i],
  ['cursor',     /cursor|point-arrow|arrow-only/i],
  ['misc',       /divider|list-|sort-column|standard-file|desktop|icon-background|generator|unnamed/i],
];

export function classifyCicnFamily(slug: string): string {
  for (const [family, pattern] of FAMILY_PATTERNS) {
    if (pattern.test(slug)) return family;
  }
  return 'unclassified';
}

/**
 * Compute the runtime's consumption report for a loaded theme.
 *
 * Returns counts + a per-family breakdown for diagnostics.
 *
 * @param theme The fully-loaded Theme (post-resolveAssetUrls).
 */
export function computeConformanceReport(theme: Theme): ExtendedConformanceReport {
  const cicns = Object.entries(theme.chromeElements ?? {});
  const cicnsExtracted = cicns.length;

  // Window chrome: every URL referenced by any windowType.chrome state
  // is "rendered" by the chrome composer (composeKaleidoscopeChrome).
  const consumedAssets = new Set<string>();
  for (const wt of Object.values(theme.windowTypes ?? {})) {
    for (const url of Object.values(wt?.chrome ?? {})) {
      if (typeof url === 'string') consumedAssets.add(url);
    }
  }

  // Walk chromeElements; mark each as rendered if either:
  //   (a) its asset URL is referenced by a windowType.chrome state, OR
  //   (b) its slug matches a RUNTIME_CONSUMED_PATTERNS regex.
  const renderedSlugs = new Set<string>();
  const familyCounts: Record<string, FamilyCount> = {};

  for (const [slug, entry] of cicns) {
    const family = classifyCicnFamily(slug);
    if (!familyCounts[family]) {
      familyCounts[family] = { total: 0, rendered: 0 };
    }
    familyCounts[family].total += 1;

    const isRendered =
      consumedAssets.has(entry.asset) ||
      RUNTIME_CONSUMED_PATTERNS.some((re) => re.test(slug));

    if (isRendered) {
      renderedSlugs.add(slug);
      familyCounts[family].rendered += 1;
    }
  }

  const cicnsRendered = renderedSlugs.size;

  // Warnings — flag well-formed but suspicious data.
  const warnings: string[] = [];
  if (!theme.windowTypes?.['document-window']) {
    warnings.push('No document-window windowType defined; chrome won\'t render');
  }
  for (const [slug, entry] of cicns) {
    if (entry.width == null || entry.height == null) {
      warnings.push(`chromeElements[${JSON.stringify(slug)}] missing width/height`);
    }
  }

  // Fallbacks — populated by step 6's future work as families gain
  // explicit fallback chains. Empty for now.
  const fallbacks: ConformanceReport['fallbacks'] = [];

  return {
    cicnsExtracted,
    cicnsRendered,
    fallbacks,
    warnings,
    familyCounts,
  };
}

export interface FamilyCount {
  total: number;
  rendered: number;
}

/**
 * The base ConformanceReport (per the schema) plus a per-family
 * breakdown that's diagnostically useful but not part of the canonical
 * schema. Down-cast to `ConformanceReport` when only the canonical
 * fields are needed.
 */
export interface ExtendedConformanceReport extends ConformanceReport {
  familyCounts: Record<string, FamilyCount>;
}
