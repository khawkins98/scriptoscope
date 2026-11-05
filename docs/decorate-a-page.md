# Decorate a page without a build step

Use the [complete hosted starter](../README.md#five-minute-setup) for your first
window. The helper selects sources once; it is example application code, separate
from package exports. For a versioned dependency and application-owned teardown,
use the [npm tutorial](./npm-consumer.md).

Use this page to choose/switch themes, accept a dropped archive or self-host the
starter. The [hosted reference](./hosted-reference.md) owns markup, options and
handle contracts; [integration troubleshooting](./integration-edge-cases.md)
covers layout, CSS, frameworks and CSP.

## Choose a theme

Browse the [gallery](https://khawkins98.github.io/scriptoscope/) or
[manifest](https://khawkins98.github.io/scriptoscope/themes-manifest.json) for
slugs and attribution. Set `pageThemeDefault` for the page, or author a
`data-scriptoscope-theme` override on a window/ancestor. Retain the archive,
`meta.json`, `PROVENANCE.md` and original terms when redistributing a theme.

## Style the window shell and dialog body

The optional stylesheet applies `--scriptoscope-window-shadow` to the rendered
window's `::part(window)`. WindowManager marks its outer hosts with
`data-scriptoscope-window-host`, including imperative windows. The default is
`none`: shell shadows are optional page decoration, and a CSS
box shadow fills a rectangle even when theme artwork has transparent or jagged
edges. To opt in, set e.g. `--scriptoscope-window-shadow: 2px 2px 0 #0006` on
`:root`, a desktop container or a window host. The shadow bounds stay aligned
with the frame when grid or flex stretches the outer host; theme-painted pixels
are unchanged.

Dialog and alert windows (`dialog`, `movable-modal`, `alert`, `movable-alert`)
fill their body with the scheme's dialog colour, as Kaleidoscope does: entry 0
of the scheme's `dctb`/`actb` -14336, or Kaleidoscope's own light grey when the
scheme ships none. Document windows stay white or use the scheme's body
pattern. The body's text colour comes from the same table (black, or white on
1984's dark blue), so it replaces a `color` set on the window host. Your content
sits on top of the fill, so a background or colour on your own elements wins. To
change the defaults, set `--scriptoscope-dialog-background` (e.g. `#ffffff`) and
`--scriptoscope-dialog-text` on `:root` or a window host.

## Theme switching at runtime

```html
<select data-scriptoscope-theme-switcher>
  <option value="1138">1138</option>
  <option value="beos-r503">BeOS R5</option>
  <option value="crayon-os">Crayon OS</option>
  <option value="https://example.com/themes/your-own/">A theme from somewhere else</option>
</select>
```

Selecting an option runs `retheme()` for windows and controls that follow the
page theme. Authored `data-scriptoscope-theme` overrides keep their selected
scheme instead of following page-level switches.

## Bring your own theme — drop a `.sit` / `.rsrc` and see it render

Two ways to wire it. The simpler one is a button or any element that doubles as a drop target:

```html
<link rel="stylesheet" href="https://khawkins98.github.io/scriptoscope/scriptoscope.css">
<article data-scriptoscope-window data-scriptoscope-title="Your page">
  <p>Pick a scheme to change this window.</p>
</article>
<button id="pick-theme" type="button">Pick or drop a Kaleidoscope theme</button>
<p id="theme-status" role="status"></p>
<script type="module">
  import {
    attachThemeDropZone, loadOwnedKaleidoscopeScheme,
  } from 'https://khawkins98.github.io/scriptoscope/scriptoscope.js';
  import { mountExplicitPage } from 'https://khawkins98.github.io/scriptoscope/explicit-host.mjs';
  const handle = await mountExplicitPage({
    themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes',
    pageThemeDefault: '1138',
  });
  const themes = new Set();
  let active = true;
  let generation = 0;
  const drop = attachThemeDropZone(document.getElementById('pick-theme'), {
    onFile: async file => {
      const token = ++generation;
      const status = document.getElementById('theme-status');
      status.textContent = `Decoding ${file.name}…`;
      try {
        const theme = await loadOwnedKaleidoscopeScheme(file, { source: file.name });
        if (!active || token !== generation) { theme.dispose(); return; }
        themes.add(theme);
        handle.registerTheme('my-scheme', theme);
        await handle.retheme('my-scheme');
        if (active && token === generation) status.textContent = `Loaded ${file.name}`;
      } catch (error) {
        if (active && token === generation) status.textContent = `Could not load this scheme: ${error.message}`;
      }
    },
  });
  addEventListener('pagehide', event => {
    if (event.persisted) return; // Preserve the mounted page in the Back/Forward cache.
    active = false; ++generation; drop.detach(); handle.disconnect();
    for (const theme of themes) theme.dispose();
  });
</script>
```

That's the full BYO path. `loadKaleidoscopeScheme` accepts every container the [Mac Themes Garden](https://macthemes.garden/) and [Kaleidoscope Scheme Archive](https://kaleidoscope.hryjksn.com/) archives ship (`.sit`, `.hqx`, `.bin`, AppleSingle/Double, raw `.rsrc`); the decode runs entirely client-side via the bundled StuffIt WASM. The dropped theme persists for the session; reload restores the default.

**The richer pattern** (used by the demo's "Load your own" picker tile) opens a themed `movable-modal` window with the drop zone inside it. Use `handle.openModal(wrap, { returnFocusTo: triggerButton })` — the helper toggles `data-scriptoscope-modal-open` on the wrap (your CSS scopes off the attribute), traps focus inside (including the shadow-DOM chrome focusables), dismisses on Esc + backdrop click, and listens for the chrome's close widget via `scriptoscope:close`. The full markup is in [`demo/showcase.html`](https://github.com/khawkins98/scriptoscope/blob/main/demo/showcase.html) (search for `powers-byo-modal-wrap`): a `position: fixed` wrap with `visibility: hidden; opacity: 0; pointer-events: none` until `[data-scriptoscope-modal-open]` flips them on, with a themed `<article data-scriptoscope-window data-scriptoscope-window-type="movable-modal">` inside.

## CDN paths reference

| URL | What |
|---|---|
| `https://khawkins98.github.io/scriptoscope/scriptoscope.js` | Runtime ESM entry; imports a sibling lazy decoder chunk for `.sit` sources |
| `https://khawkins98.github.io/scriptoscope/scriptoscope.css` | Optional outer-shell stylesheet |
| `https://khawkins98.github.io/scriptoscope/themes/<slug>/scheme.sit` (or `scheme.rsrc`) | The bundle's source archive — fetched + decoded client-side by `loadTheme()` |
| `https://khawkins98.github.io/scriptoscope/themes-manifest.json` | Catalog of every bundled slug (label, author, source filename, ref screenshot) |
| `https://khawkins98.github.io/scriptoscope/theme-loader/loadKaleidoscopeScheme.js` | Standalone decoder ESM: the public `loadKaleidoscopeScheme` wrapper (engine `cinf` and icon-blit cicn ids on by default, so themed sliders draw and icon blits get their companions; pass `engineCinfIds: []` / `iconBlitCicnIds: []` to opt out) bundled with the conversion core. Same function `scriptoscope.js` exports; use it when you want the decoder without the runtime. `theme-loader/index.js` re-exports it. Lazily imports `../sit-wasm/index.mjs` for `.sit` input |
| `https://khawkins98.github.io/scriptoscope/sit-wasm/dist/munbox.wasm` | Standalone decoder WASM; the bundled runtime embeds its WASM in the lazy JavaScript chunk |

The hosted URLs track the project's `main` deployment. To control when your
runtime updates, use npm with a committed lockfile and your own deployment, or
vendor the files from a chosen commit as described below.

## Vendoring (if you don't want a third-party CDN dependency)

If you want to host the no-build starter yourself, copy a chosen build rather
than importing the GitHub Pages URLs:

1. Build a chosen commit with `npm run build:demo`. Copy every top-level `dist/*.js` file, `dist/scriptoscope.css`, `dist/demo/explicit-host.mjs`, `dist/demo/explicit-layout.mjs`, and the theme bundles you use from `dist/demo/themes/`, retaining their metadata and provenance. Keep the JavaScript and helper files beside each other so relative imports resolve. If importing the standalone decoder for a drop zone, also copy `dist/demo/theme-loader/` and `dist/demo/sit-wasm/` beside them; `dist/demo/theme-loader/loadKaleidoscopeScheme.js` there is the built public wrapper (engine `cinf` ids on by default), not the raw `tools/theme-loader/` file, which leaves them off and hands every slider to the Platinum fallback.
2. Host them alongside your site, retaining `LICENSE` and `THIRD_PARTY_NOTICES`
   with the runtime files.
3. Change the starter's stylesheet URL to your local `./scriptoscope.css`, import
   `mountExplicitPage` from `./explicit-host.mjs`, and set `themeBaseUrl` to your
   local `./themes`. Adjust those paths if you host the files in a subdirectory.

The page still loads an ESM module from a URL; it does not need npm or a bundler
to run. Building the vendored files is a maintainer/setup step.


## The full `data-scriptoscope-*` vocabulary

See the canonical [markup table](./hosted-reference.md#the-full-data-scriptoscope--vocabulary).

## Explicit page host options

See [options and handle members](./hosted-reference.md#explicit-page-host-options)
and [ownership/completion](./hosted-reference.md#ownership-and-completion).

## CSS classes (fallback if `data-scriptoscope-*` isn't an option)

See [initial selection alternatives](./hosted-reference.md#the-full-data-scriptoscope--vocabulary).
