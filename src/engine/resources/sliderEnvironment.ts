// Declared modern group2 resource environment (slider-layout-cinf.md).
// The loader only prepares/binds generic cinf inputs; this adapter owns their
// slider interpretation and exact loaded-theme/asset identity.
import { CinfEnvironmentError, snapshotCinfResourceOwner, copiedCinfPayload } from '../../../tools/theme-loader/cinf-environment.js';
import type { LoadedTheme } from '../../types.js';
import { SLIDER_THUMB } from '../tables/slider.js';
import type { SliderState } from '../families/slider.js';
import type { ResourceProvider } from './chain.js';
import type { CinfProviderReference } from '../../../tools/theme-loader/cinf-environment.js';
const fields = ['asset', 'width', 'height', 'sourceCicnId', 'byteProvenance'] as const;
export function unsupportedSliderEnvironment(reason: string): never {
  throw new CinfEnvironmentError(`Unsupported group2 slider environment: ${reason}`, 'UNSUPPORTED_CINF_ENVIRONMENT');
}
interface CinfPayload { readonly bytes: readonly number[]; readonly resource: CinfProviderReference }
export interface SliderEnvironment {
  readonly providers: readonly ResourceProvider[];
  readonly corner: number;
  readonly selected: CinfProviderReference;
  readonly attempts: readonly { readonly id: number; readonly outcome: 'found' | 'missing'; readonly resource?: CinfProviderReference }[];
}

/** Snapshot before any image load. Each provider owns copied complete payloads.
 * Missing is explicit; incomplete or duplicate input never becomes a NULL hit. */
export function snapshotSliderEnvironment(theme: Pick<LoadedTheme, 'manifest'> & { readonly base?: unknown }, orientation: 'horizontal' | 'vertical'): SliderEnvironment | undefined {
  const manifest = theme.manifest, saved = snapshotCinfResourceOwner(manifest, 'sliderLayoutEnvironment');
  if (!manifest.sliderLayoutEnvironment && !saved) return undefined;
  const id = orientation === 'horizontal' ? -10129 : -10113;
  const element = Object.values(manifest.chromeElements ?? {}).find(e => e.sourceCicnId === id);
  const thumb = element && saved?.elementSnapshot(element);
  const elements = Object.values(manifest.chromeElements ?? {});
  if (!saved || !element || !thumb || fields.some(key => thumb[key] !== element[key])
    || elements.filter(other => other.asset === element.asset).length !== 1
    || elements.filter(other => other.sourceCicnId === id).length !== 1)
    unsupportedSliderEnvironment('input does not belong to the actual loaded group2 thumb');
  if (theme.base) unsupportedSliderEnvironment('base inheritance');
  const binding = saved.binding;
  if (!binding.complete || binding.providers.some(p => !p.complete))
    unsupportedSliderEnvironment('incomplete declared environment/provider');
  const providers: ResourceProvider[] = binding.providers.map(p => {
    const resources = new Map<number, CinfPayload | { ambiguous: true }>();
    for (const r of p.resources) {
      const existing = resources.get(r.signedId);
      resources.set(r.signedId, existing ? { ambiguous: true } : { bytes: Object.freeze(copiedCinfPayload(r)), resource: Object.freeze({
        providerId: p.id, providerKind: p.kind, forkSha256: p.forkSha256, occurrence: r.occurrence,
        signedId: r.signedId, byteLength: r.byteLength, sha256: r.sha256,
      }) });
    }
    return { name: p.id, tier: 'cinf', get(type: string, resourceId: number) {
      if (type !== 'cinf') return null;
      const result = resources.get(resourceId);
      if (result && 'ambiguous' in result) unsupportedSliderEnvironment('duplicate cinf');
      return result ?? null;
    } };
  });
  const attempts: { id: number; outcome: 'found' | 'missing'; resource?: CinfProviderReference }[] = [];
  let selected: CinfPayload | undefined;
  for (const resourceId of orientation === 'horizontal' ? [-10132, -10144] : [-10116, -10128]) {
    let hit: CinfPayload | undefined;
    for (const p of providers) { hit = p.get('cinf', resourceId) as CinfPayload | undefined; if (hit) break; }
    attempts.push(Object.freeze({ id: resourceId, outcome: hit ? 'found' : 'missing', ...(hit ? { resource: hit.resource } : {}) }));
    if (hit) { selected = hit; break; }
  }
  if (!selected || selected.bytes.length === 0) unsupportedSliderEnvironment('required corner missing or empty');
  return { providers, corner: selected.bytes[0]!, attempts: Object.freeze(attempts), selected: selected.resource };
}

/** Strict modern opt-in domain; groove cross size is intentionally unrestricted (SL1). */
export function admitSliderGeometry(environment: SliderEnvironment | undefined, input: {
  length: number; along: number; cross: number; value: number; variant: string;
}): void {
  if (!environment) return;
  if (input.variant !== 'nonDirectional' || !Number.isInteger(input.length)
    || !Number.isInteger(input.cross) || input.along > 32767 || input.cross > 32767 || !Number.isFinite(input.value))
    unsupportedSliderEnvironment('geometry outside admitted group2 Rect');
}
export function admitSliderState(environment: SliderEnvironment | undefined, state: SliderState): void {
  if (!environment) return;
  const thumb = state.Th;
  if (!thumb || thumb.right <= thumb.left || thumb.bottom <= thumb.top || (state.record.travel ?? -1) < 0 || !state.thumb)
    unsupportedSliderEnvironment('thumb geometry or travel outside admitted local Rect');
  if (environment.corner !== state.c) unsupportedSliderEnvironment('declared corner differs from resource-chain corner');
  const pm = state.thumb.value.pixmap;
  const cell = SLIDER_THUMB.TH3.cellSize, cells = SLIDER_THUMB.TH5.ghostCell + 1;
  if ((state.record.horizontal ? pm.height : pm.width) !== cells * cell)
    unsupportedSliderEnvironment('thumb cross-cell is not 16 px');
}
