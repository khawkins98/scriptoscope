import { ownerDisplayPolicyMatches } from '../tools/theme-loader/display-profile.js';
import type { ThemeManifest } from './types.js';
import type { ChromeElement, ControlColorSamples } from './types.js';

/** Color policy only: does not change font metrics, label placement or device
 * transfer mode. Source samples are paired with the actual resolved face. */
export function controlTextColors(element: ChromeElement, override: string | undefined, fallback: string, owner?: ThemeManifest): {
  foreground: string; emboss: string | null; policy: 'caller-override' | 'source-samples' | 'contrast-fallback';
  embossDecision: ControlColorSamples['embossDecision'] | 'unavailable' | 'caller-override';
  sampleFallbackReason: 'ambiguous-asset-path' | 'missing-text-sample' | null;
} {
  if (override !== undefined) return { foreground: override, emboss: null, policy: 'caller-override', embossDecision: 'caller-override', sampleFallbackReason: null };
  const colors = element.colorSamples;
  if (colors?.model !== 'kdef-2.3.1-color' || !ownerDisplayPolicyMatches(owner, colors.displayPolicy) || !colors.text) {
    return { foreground: fallback, emboss: null, policy: 'contrast-fallback', embossDecision: 'unavailable',
      sampleFallbackReason: element.colorSamplesUnavailableReason ?? 'missing-text-sample' };
  }
  const css = (rgb: readonly number[]): string => `rgb(${rgb.join(',')})`;
  return { foreground: css(colors.text.displayRgb),
    emboss: colors.embossDecision === 'present' && colors.emboss ? css(colors.emboss.displayRgb) : null,
    policy: 'source-samples', embossDecision: colors.embossDecision, sampleFallbackReason: null };
}
