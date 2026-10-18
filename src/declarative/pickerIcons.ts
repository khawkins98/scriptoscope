import { displayRealizer, DisplayProfileError } from '../../tools/theme-loader/display-profile.js';
import { loadKaleidoscopeIcon } from '../../tools/theme-loader/loadKaleidoscopeIcon.js';
import { themeRefToUrl } from './parse.js';
import type { ThemeBootstrapOpts } from './theme.js';

/** Per-picker lightweight cache. Values are self-contained PNG data URLs, so
 * retained OFF-mode tiles need no global blob lifetime or full theme cache. */
export function createPickerIconLoader(opts: ThemeBootstrapOpts) {
  const displayProfile = opts.displayProfile;
  displayRealizer(displayProfile);
  const hints = new Map((opts.themes ?? []).map((theme) => [theme.slug, theme]));
  const cache = new Map<string, Promise<string | null>>();
  const load = (slug: string, primaryId: number, fallbackId: number): Promise<string | null> => {
    const key = `${slug}:${primaryId}:${fallbackId}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const pending = (async () => {
      const url = themeRefToUrl(slug, opts.themeBaseUrl ?? '/themes').replace(/\/$/, '');
      const hint = hints.get(slug);
      const candidates = hint?.source ? [hint.source] : ['scheme.sit', 'scheme.rsrc'];
      let foundSource = false;
      for (const file of candidates) {
        try {
          const response = await fetch(`${url}/${file}`);
          if (!response.ok) continue;
          const bytes = new Uint8Array(await response.arrayBuffer());
          const icon = await loadKaleidoscopeIcon(bytes, [primaryId, fallbackId], undefined, displayProfile);
          foundSource = true;
          if (icon) return icon;
          break;
        } catch (error) {
          if (error instanceof DisplayProfileError) throw error;
          // An SPA fallback may return HTML with status 200 for a missing file.
          // Try the alternative source, but don't hide failure for explicit hints.
          if (hint?.source) throw error;
        }
      }
      if (!foundSource) throw new Error(`No readable icon source for ${slug}`);
      if (opts.baseSlug && slug !== opts.baseSlug) return load(opts.baseSlug, primaryId, fallbackId);
      return null;
    })();
    cache.set(key, pending);
    void pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
    return pending;
  };
  return load;
}
