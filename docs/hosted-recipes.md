# Hosted page recipes

Start with the [complete page in the README](../README.md#five-minute-setup). These recipes add theme switching, local-file themes and self-hosting to that working page. Look up individual attributes and host options in the [hosted reference](./hosted-reference.md).

## Theme switching at runtime

```html
<select data-scriptoscope-theme-switcher>
  <option value="1138">1138</option>
  <option value="beos-r503">BeOS R5</option>
  <option value="crayon-os">Crayon OS</option>
  <option value="https://example.com/themes/your-own/">A theme from somewhere else</option>
</select>
```

Selecting an option fires the existing `retheme()` flow; every promoted window flips chrome live.

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
  addEventListener('pagehide', () => {
    active = false; ++generation; drop.detach(); handle.disconnect();
    for (const theme of themes) theme.dispose();
  }, { once: true });
</script>
```

That's the full BYO path. `loadKaleidoscopeScheme` accepts every container the [Mac Themes Garden](https://macthemes.garden/) and [Kaleidoscope Scheme Archive](https://kaleidoscope.hryjksn.com/) archives ship (`.sit`, `.hqx`, `.bin`, AppleSingle/Double, raw `.rsrc`); the decode runs entirely client-side via the bundled StuffIt WASM. The dropped theme persists for the session; reload restores the default.

**The richer pattern** (used by the demo's "Load your own" picker tile) opens a themed `movable-modal` window with the drop zone inside it. Use `handle.openModal(wrap, { returnFocusTo: triggerButton })` — the helper toggles `data-scriptoscope-modal-open` on the wrap (your CSS scopes off the attribute), traps focus inside (including the shadow-DOM chrome focusables), dismisses on Esc + backdrop click, and listens for the chrome's close widget via `scriptoscope:close`. The full markup is in [`demo/showcase.html`](https://github.com/khawkins98/scriptoscope/blob/main/demo/showcase.html) (search for `powers-byo-modal-wrap`): a `position: fixed` wrap with `visibility: hidden; opacity: 0; pointer-events: none` until `[data-scriptoscope-modal-open]` flips them on, with a themed `<article data-scriptoscope-window data-scriptoscope-window-type="movable-modal">` inside.

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

## Trying it locally

Three demo pages sit on the same runtime, each showing a different integration path. To hack on them locally, clone the repo and run the dev server:

```sh
git clone https://github.com/khawkins98/scriptoscope.git
cd scriptoscope
npm install        # dev dependencies (vite, tsc, playwright) — NOT the library itself
npm run dev        # http://localhost:5173/
```

- **[`demo/index.html`](https://github.com/khawkins98/scriptoscope/blob/main/demo/index.html)** — the **ad-style landing page**. A period multimedia-ad composition with one portrait split across five live Kaleidoscope windows. Drag, resize, close, zoom or shade the windows; “Reassemble the face” restores the composition while keeping the chosen scheme. The footer scheme buttons retheme the portrait in place, “Original mix” restores the five-theme arrangement, and “Explore the possibilities” opens the interactive demonstration with the installation example. The short pitch introduces the HTML attribute workflow, and a compact row links to all four example websites. A visible credit links to the original Apple New Media Forum: World Tour ’95 advertisement. Links lead to the interactive demo, integration guide, and project source. Existing `?theme=<slug>` links redirect to the interactive demo.
- **[`demo/showcase.html`](https://github.com/khawkins98/scriptoscope/blob/main/demo/showcase.html)** — the **interactive showcase**. Try original schemes, native controls, movable engine windows, bare HTML mode, and a local-file theme picker. The example gallery links to four complete page layouts. “Install” opens the separate guide while carrying the chosen scheme.
- **[`demo/install.html`](https://github.com/khawkins98/scriptoscope/blob/main/demo/install.html)** — the **installation guide**. Complete copyable starters, data attributes, runtime options, and recipes for picked or hosted Kaleidoscope schemes. Legacy `showcase.html#install` links redirect here.
- **[`demo/diagnostic.html`](https://github.com/khawkins98/scriptoscope/blob/main/demo/diagnostic.html)** — the **runtime showcase + developer diagnostic**. Pick any scheme from the ribbon and get its scene + reference comparison, live themed controls, and an interactive playground (every window type at any size, plus live buttons / checkboxes / radios / sliders / scrollbars / title-bar widgets). A drop-zone decodes any `.sit` / `.hqx` / `.rsrc` Kaleidoscope archive entirely in the browser. The dev-facing inspectors (geometry, slice inspector, icon inventory, raster foldout, resource roles) live behind the **"Developer tools"** disclosure at the bottom of each scheme's section — open it manually or visit with `?dev=1` to default-open.
- **[`demo/declarative-hostile-css.html`](https://github.com/khawkins98/scriptoscope/blob/main/demo/declarative-hostile-css.html)** — the **Shadow-DOM litmus test for ADR-0001 Decision 2**. A host page deliberately ships aggressive CSS (universal `!important` resets, opinionated `div`/`canvas`/`button` rules — the kind of thing a real CMS or third-party site does) to prove the chrome inside the shadow root survives unscathed. Slotted body content still picks up host styling (it stays in the light DOM by design); only the chrome is quarantined.

