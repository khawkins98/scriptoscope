import themes from './themes-manifest.json';
import { mountResponsiveExample } from './example-responsive.mjs';

// Story, acknowledgements and inspiration wear a few real scheme windows.
// Each page names its default scheme on the root; a ?theme carried over from
// the showcase wins, so the whole site follows the visitor's choice.
const root = document.querySelector('[data-site-windows]');
if (root) {
  const requested = new URL(location.href).searchParams.get('theme');
  const slug = themes.some(theme => theme.slug === requested) ? requested : root.dataset.siteWindows;
  try {
    await mountResponsiveExample({
      root,
      themeBaseUrl: `${import.meta.env.BASE_URL}themes`,
      pageThemeDefault: slug,
      themes,
      rejectOnEmptyMount: true,
    });
  } catch (error) {
    // The content stays ordinary, readable HTML if a scheme cannot load.
    console.warn('[scriptoscope] Page windows unavailable:', error);
  }
}
