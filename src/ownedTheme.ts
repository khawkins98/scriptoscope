import type { LoadedTheme } from './types.js';
import { loadCicnBuffer, rasterDimensions } from './cicnImage.js';
import { PixelBuffer } from './pixelBuffer.js';
import { assetUrl } from './loadTheme.js';
import { rasterOwner } from '../tools/theme-loader/rasterAssets.js';

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
/** Captured transport identity. key is internal identity, never a public image URL. */
export interface RasterSource {
  readonly key: string;
  readonly path?: string;
  pixels(): Promise<PixelBuffer>;
  imageUrl(): Promise<string>;
  dimensions(): Promise<{ width: number; height: number }>;
}
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
  asset(ref: string): RasterSource;
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

    view = {
      [viewTag]: true,
      get manifest() { return source().manifest; },
      get glyphs() { return source().glyphs; },
      get inspector() { return source().inspector; },
      get byteProvenance() { return source().byteProvenance; },
      get origin() { return owned ? input.origin : input.baseUrl; },
      get base() { return input.base ? themeView(input.base) : undefined; },
      get lifetime() { return rasterOwner(source()); },
      asset(ref) {
        const owner = rasterOwner(source());
        const external = /^(?:blob:|https?:|data:)/.test(ref);
        const entry = owner && !external ? owner.capture(ref) : undefined;
        const key = entry?.key ?? (owned ? ref : assetUrl(input, ref));
        const exportImage = owned && !entry && !external ? input.imageUrl.bind(input, ref) : () => Promise.resolve(key);
        const current = () => { if (owner?.disposed) throw new DOMException('Raster owner disposed', 'AbortError'); };
        return {
          key,
          ...(!external ? { path: ref } : {}),
          async pixels() {
            current();
            const decoded = entry?.decoded();
            if (decoded) return new PixelBuffer(decoded.width, decoded.height, decoded.data);
            return loadCicnBuffer(entry ? await entry.imageUrl() : owned && !external ? await exportImage() : key);
          },
          async dimensions() {
            current();
            const decoded = entry?.decoded();
            if (decoded) return { width: decoded.width, height: decoded.height };
            return rasterDimensions(entry ? await entry.imageUrl() : owned && !external ? await exportImage() : key);
          },
          async imageUrl() { current(); return entry ? entry.imageUrl() : exportImage(); },
        };
      },
    };
    views.set(input, view);
  }
  return view;
}

/** Shared preparation lifetime for public renderers accepting either theme contract. */
export async function withThemeView<T>(input: ThemeInput | ThemeView, render: (view: ThemeView) => Promise<T>): Promise<T> {
  const view = themeView(input);
  assertThemeAlive(view);
  const result = await render(view);
  assertThemeAlive(view);
  return result;
}

/** Explicit image boundary for an owned reference or an existing image URL. */
export async function themeImageUrl(input: ThemeInput, ref: string): Promise<string> {
  return themeView(input).asset(ref).imageUrl();
}
