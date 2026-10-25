import type { LoadedTheme } from './types.js';
import { bindRasterOwner, materializeRasterImage, rasterOwner } from '../tools/theme-loader/rasterAssets.js';

/** Render-focused source. Asset strings under source are references, not image URLs. */
export interface OwnedTheme {
  readonly kind: 'owned-theme';
  readonly source: Omit<LoadedTheme, 'base' | 'dispose' | 'baseUrl'>;
  origin: string;
  base?: ThemeInput;
  imageUrl(ref: string): Promise<string>;
  dispose(): void;
}
export type ThemeInput = LoadedTheme | OwnedTheme;
const views = new WeakMap<OwnedTheme, LoadedTheme>();
function isOwned(input: ThemeInput): input is OwnedTheme { return 'kind' in input && input.kind === 'owned-theme'; }

export function assertThemeAlive(theme: LoadedTheme): void {
  const seen = new Set<LoadedTheme>();
  for (let t: LoadedTheme | undefined = theme; t && !seen.has(t); t = t.base) {
    seen.add(t);
    if (rasterOwner(t)?.disposed) throw new DOMException('Raster owner disposed', 'AbortError');
  }
}

/** Internal view: selectors and painters share one implementation for both inputs. */
export function themeView(input: ThemeInput): LoadedTheme {
  if (!isOwned(input)) return input;
  let view = views.get(input);
  if (!view) {
    view = Object.create(input.source) as LoadedTheme;
    Object.defineProperty(view, 'baseUrl', { get: () => input.origin });
    Object.defineProperty(view, 'base', { get: () => input.base ? themeView(input.base) : undefined });
    Object.defineProperty(view, 'dispose', { value: () => input.dispose() });
    views.set(input, view);
    const owner = rasterOwner(input.source);
    if (owner) bindRasterOwner(view, owner);
  }
  return view;
}

/** Explicit image boundary for an owned reference or an existing image URL. */
export function themeImageUrl(input: ThemeInput, ref: string): Promise<string> {
  if (isOwned(input) && !/^(?:scriptoscope-raster:|blob:|https?:|data:)/.test(ref)) return input.imageUrl(ref);
  const view = themeView(input);
  return materializeRasterImage(/^(?:scriptoscope-raster:|blob:|https?:|data:)/.test(ref) ? ref : `${view.baseUrl}/${ref}`);
}
