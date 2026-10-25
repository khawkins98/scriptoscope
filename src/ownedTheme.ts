import type { LoadedTheme } from './types.js';
import { loadCicnBuffer, rasterDimensions } from './cicnImage.js';
import type { PixelBuffer } from './pixelBuffer.js';
import { assetUrl } from './loadTheme.js';
import { materializeRasterImage, rasterOwner } from '../tools/theme-loader/rasterAssets.js';

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
const viewTag = Symbol('ThemeView');
/** Internal rendering capability. It neither owns nor exposes ready images. */
export interface ThemeView {
  readonly [viewTag]: true;
  readonly manifest: LoadedTheme['manifest'];
  readonly glyphs: LoadedTheme['glyphs'];
  readonly inspector: LoadedTheme['inspector'];
  readonly byteProvenance: LoadedTheme['byteProvenance'];
  readonly origin: string;
  readonly base: ThemeView | undefined;
  readonly lifetime: { readonly lifetime: string; readonly disposed: boolean } | undefined;
  assetKey(ref: string): string;
  pixels(ref: string): Promise<PixelBuffer>;
  imageUrl(ref: string): Promise<string>;
  dimensions(ref: string): Promise<{ width: number; height: number }>;
}
const views = new WeakMap<ThemeInput, ThemeView>();
function isOwned(input: ThemeInput): input is OwnedTheme { return 'kind' in input && input.kind === 'owned-theme'; }

export function assertThemeAlive(theme: ThemeView): void {
  const seen = new Set<ThemeView>();
  for (let t: ThemeView | undefined = theme; t && !seen.has(t); t = t.base) {
    seen.add(t);
    if (t.lifetime?.disposed) throw new DOMException('Raster owner disposed', 'AbortError');
  }
}

/** Normalize once at the renderer boundary; selection retains the owning view. */
export function themeView(input: ThemeInput | ThemeView): ThemeView {
  if (viewTag in input) return input;
  let view = views.get(input);
  if (!view) {
    const owned = isOwned(input);
    const source = () => owned ? input.source : input;
    const key = (ref: string) => owned ? ref : assetUrl(input, ref);
    view = {
      [viewTag]: true,
      get manifest() { return source().manifest; },
      get glyphs() { return source().glyphs; },
      get inspector() { return source().inspector; },
      get byteProvenance() { return source().byteProvenance; },
      get origin() { return owned ? input.origin : input.baseUrl; },
      get base() { return input.base ? themeView(input.base) : undefined; },
      get lifetime() { return rasterOwner(source()); },
      assetKey: key,
      pixels: ref => loadCicnBuffer(key(ref)),
      dimensions: ref => rasterDimensions(key(ref)),
      imageUrl: ref => owned && !/^(?:scriptoscope-raster:|blob:|https?:|data:)/.test(ref)
        ? input.imageUrl(ref) : materializeRasterImage(key(ref)),
    };
    views.set(input, view);
  }
  return view;
}

/** Explicit image boundary for an owned reference or an existing image URL. */
export function themeImageUrl(input: ThemeInput, ref: string): Promise<string> {
  return themeView(input).imageUrl(ref);
}
