# Scriptoscope

[Landing page](https://khawkins98.github.io/scriptoscope/) · [Interactive demo](https://khawkins98.github.io/scriptoscope/showcase.html) · [Install](#install)

Scriptoscope renders classic Mac **Kaleidoscope** themes on the web from their original `.sit` and `.rsrc` resource files. Add attributes to ordinary HTML; window chrome and controls paint into canvas while your content and native forms stay live underneath. No framework required. Try the [interactive demo](https://khawkins98.github.io/scriptoscope/showcase.html), including its local-file theme picker: decoding runs in your browser, with no upload.

Kaleidoscope, by Greg Landweber and Arlo Rose, let people skin classic Mac OS in the nineties. OS X arrived and the format went quiet. I rebuilt the rendering layer so those schemes could run in a browser tab. This is a deeply silly use of anyone's time, including yours. If you ship it on a real website, [I want to hear about it](https://github.com/khawkins98/scriptoscope/issues).

**Pre-1.0:** consult the [changelog](./CHANGELOG.md) before upgrading. The runtime is a clean-room compatibility implementation; no original Kaleidoscope code ships or executes as its runtime. Rendering regression coverage does **not** establish full original-engine fidelity; see [coverage and limits](#rendering-regression-coverage).

**Scheme authors:** the bundles retain their original attribution and terms, separate from the MIT runtime. Every bundle in [`themes/`](https://github.com/khawkins98/scriptoscope/tree/main/themes/) contains its archive, `meta.json` and `PROVENANCE.md`. Redistribution follows a preservation posture with takedown on request. If you are an original author, or can put me in touch with Greg Landweber or Arlo Rose, please email <khawkins98@gmail.com>.

More schemes are preserved at [Mac Themes Garden](https://macthemes.garden/) and the [Kaleidoscope Scheme Archive](https://kaleidoscope.hryjksn.com/). Download a scheme there and open it in the demo.

## If you build a scheme

Start with the [creation guide](https://github.com/khawkins98/scriptoscope/blob/main/docs/authoring-a-scheme.md). It covers concept
art, frame geometry, editable sprites, control families and visual review.
[`tools/theme-author/`](https://github.com/khawkins98/scriptoscope/tree/main/tools/theme-author/) builds real Kaleidoscope resource
forks; [Scriptoscope Reference Native Theme](https://github.com/khawkins98/scriptoscope/tree/main/authoring/schemes/scriptoscope/) is the worked reference implementation.

Run `npm run author -- authoring/schemes/scriptoscope` to build an example. Load
the resulting `scheme.rsrc` in the browser demo, or transfer the generated
MacBinary `scheme.bin` to a classic Mac. Validate the final build in the browser,
at 8-bit colour and in native Kaleidoscope before publishing it.

## Install

You don't need npm to use Scriptoscope. Choose the setup that fits your site:

| Your site | Start here | What you manage |
| --- | --- | --- |
| Plain HTML, a personal page, or a quick experiment | [Hosted starter](#five-minute-setup) — copy the HTML and load the stylesheet and module | Add attributes to your HTML; the example host attaches the windows and controls and loads hosted themes. |
| An app that already bundles JavaScript, where you want dependency versioning and your own deployment | [npm integration guide](./docs/npm-consumer.md) | Install the runtime, host your theme files, and attach/clean up windows and controls in your app's lifecycle. |

Both paths use the same renderer and theme format. npm gives you versioned dependencies and deployment control:

```sh
npm install @khawkins98/scriptoscope
```

The [npm integration guide](./docs/npm-consumer.md) includes a complete TypeScript example, a first-party theme, nested-URL deployment and teardown. Applications explicitly attach decoration after creating native DOM and remove it before replacing that DOM. Upgrade notes live in the [changelog](./CHANGELOG.md) and [migration guide](https://github.com/khawkins98/scriptoscope/blob/main/docs/v2/integration-release-notes.md).

For plain HTML, use the complete hosted starter below. The optional stylesheet supplies shell decoration. Set `--scriptoscope-window-shadow: 2px 2px 0 #0006` on `:root` or a window host to opt into a rectangular shadow; the default is `none`.

Dialogs and alerts use the scheme's body and text colours; document windows use white or the scheme's body pattern. Override dialog defaults with `--scriptoscope-dialog-background` and `--scriptoscope-dialog-text`, or style your own content elements.

Hosted files follow the project's `main` deployment. Use npm with a committed lockfile, or [vendor a matching build](#vendoring-if-you-dont-want-a-third-party-cdn-dependency), to control updates.

## Five-minute setup

For the hosted option without a build step, here is a complete page with one
window and a button. For an application using npm, follow the
[npm integration guide](./docs/npm-consumer.md).

```html
<!doctype html>
<html>
<head>
  <!-- 1. Optional outer-shell stylesheet (drop shadow, focus ring, desktop background).
       Without this, chrome still renders faithfully — this just adds polish. -->
  <link rel="stylesheet" href="https://khawkins98.github.io/scriptoscope/scriptoscope.css">
</head>
<body>

  <!-- 2. Tag any element to become a Mac window. The children stay live HTML
       (selectable, accessible, real form values) — only the chrome is canvas. -->
  <!-- (No x/y/width/height needed: position + size default to the element's current page rect.) -->
  <div data-scriptoscope-window
       data-scriptoscope-title="Welcome">
    <p>Anything in here is the window's body. <a href="#">Real links</a> work.</p>
    <button data-scriptoscope-button data-scriptoscope-default>OK</button>
  </div>

  <!-- 3. The example host captures this page’s sources once.
       Application code explicitly attaches later controls. -->
  <script type="module">
    import { mountExplicitPage } from 'https://khawkins98.github.io/scriptoscope/explicit-host.mjs';
    const handle = await mountExplicitPage({
      themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes',
      pageThemeDefault: '1138',
    });
  </script>

</body>
</html>
```

The example host captures sources once. It owns their promotion, theme replacement, URL state and teardown; it does not discover later DOM automatically. For a newly inserted control call `await handle.attach({ controls: [input] })`; before removing it call `handle.detach({ controls: [input] })`. Buttons use the `buttons` array. Keep the returned handle and call `handle.disconnect()` before replacing the page integration.

### Three things to know up front

1. **Layout stays in flow unless you opt out.** Omit `data-scriptoscope-x` and `-y` to keep the window in normal, Grid or Flex flow. Set either in pixels for an absolute-positioned floater. Dragging an in-flow window makes it float.
2. **The host protects its geometry.** Inline styles lock host layout properties so consumer CSS cannot separate the host from its chrome. Style content inside the window; use custom properties for supported shell options.
3. **Promotion replaces the source wrapper.** Its children move into the runtime host. Framework references to the old wrapper become detached. Attach after the framework creates DOM, and tear down before it replaces that DOM; see the [npm lifecycle example](./docs/npm-consumer.md).

[Integration edge cases](https://github.com/khawkins98/scriptoscope/blob/main/docs/integration-edge-cases.md) covers sizing, CSS conflicts, framework lifecycles and SSR.

#### Available theme slugs

Use the [theme manifest](https://khawkins98.github.io/scriptoscope/themes-manifest.json) for slugs, author credits and source filenames, or browse the [interactive demo](https://khawkins98.github.io/scriptoscope/showcase.html). Examples include `1138`, `beos-r503`, `apple-platinum-2`, `crayon-os` and `windows-95`. Individual bundle metadata and provenance remain authoritative for attribution and terms.

### The full `data-scriptoscope-*` vocabulary

These options are parsed by explicit promotion primitives or the example page host. Attributes describe sources; they do not start an automatic DOM scanner.

| Attribute (`data-scriptoscope-` prefix) | Source | Purpose |
|---|---|---|
| `window` | any element | Promote a window; children become its body. |
| `title` | window | Title-bar text. |
| `window-type` | window | `document-window` (default), `dialog`, `alert`, `movable-modal`, `movable-alert`, `titled-utility-window`, `side-floating-utility-window`, `no-title-utility-window`, `popup-window`, or `collapsed-document-window`, `collapsed-titled-utility`, `collapsed-side-utility`, `collapsed-no-title-utility` (art varies by scheme). |
| `x`, `y` | window | Pixel offsets relative to the positioned ancestor. Either opts into absolute positioning; omit both for normal flow. |
| `width`, `height` | window | Fixed **content** dimensions in pixels. Omitted axes use measured **outer-box** bounds including chrome, and follow content growth until user resize. |
| `extra-width`, `extra-height` | window | Reserve additional outer space on an automatically measured axis; ignored on a declared axis. |
| `state` | window | Initial `active`/`inactive` state. One active window per manager; last explicit active wins. |
| `z` | window | Initial stacking order. |
| `collapsed` | window | Start shaded; double-click the frame to toggle. |
| `widgets` | window | Enabled handlers from `close,zoom,collapse`; absent enables supported widgets, empty makes them inert. Artwork stays visible. |
| `hit` | window | `region` (default) passes transparent frame pixels through; `box` takes the whole rectangle. See limits below. |
| `theme` | window or ancestor | Theme slug or URL; nearest ancestor wins. |
| `theme-switcher` | select | Switch the active theme. |
| `button`, `default`, `disabled` | button | Themed button, optional default ring and disabled paint. Native form/keyboard behavior remains. |
| `control` | checkbox/radio/range/select | Native-control decoration, selected by the example host. `control="off"` opts out. |
| `field` | text input/textarea | Opt into sunken-bevel decoration. |
| `tabs` | container | Tab buttons and panels with ARIA and keyboard navigation. |
| `tab="panel-id"`, `selected` | tab button | Target panel and optional initial selection; first tab is the default. |
| `panel="id"` | panel | Panel identity; hidden unless selected. |
| `window-id` | window | Stable persistence identity; otherwise DOM ordinal is used. |
| `theme-picker` | container | Folder-style picker populated from the host's `themes` catalog. |
| `cascade` | container | One-shot absolute cascade, 32px right/28px down per window. Override `cascade-step-x`, `cascade-step-y`, `cascade-base-x`, `cascade-base-y`; explicit window positions win. |
| `icon`, `icon-id` | img/span | Scheme-resolved named Finder icon or raw resource id, refreshed on retheme. |

**Hit testing:** `region` deactivates a window on outside presses; `box` retains the older whole-box/outside-press behavior. Built-in procedural frames and open modal windows keep box-shaped hit regions. In region mode, overflowing fixed-position children are clipped: put tooltips/menus in the top layer or outside the window, or choose `box`. Closed shadow roots prevent outside-press deactivation. Read at promotion; change later with `WindowManager.applyState(host, { hit })`.

The [interaction reference](https://github.com/khawkins98/scriptoscope/blob/main/docs/interaction.md) covers gestures, keyboard/touch behavior and events. [Integration edge cases](https://github.com/khawkins98/scriptoscope/blob/main/docs/integration-edge-cases.md) details geometry and host constraints.

### Explicit page host options

`mountExplicitPage` is a hosted **example helper**, not a package mount export. Its main options are:

```js
const handle = await mountExplicitPage({
  themeBaseUrl: '/themes',
  pageThemeDefault: '1138',
  // Optional:
  baseSlug: 'apple-platinum-2',
  root: document.body,
  hit: 'region',
  persistKey: 'my-app-layout',
  themes: [], // ThemeEntry catalog: slug, name?, author?, year?, source?, meta?
  syncToUrlParam: 'theme',
  rejectOnEmptyMount: true,
  onPromoteError: detail => console.error(detail),
  bootAffordance: 'auto', // 'none' (or false) disables the reveal
});
```

`autoCycle` optionally sets picker cycling in milliseconds; user interaction or a restored theme deep-link suppresses it. `bootAffordance` respects reduced motion. Readiness waits for promotion, scrollbar refresh and the bounded reveal; a hidden/stalled reveal cannot hold boot indefinitely.

| Handle member | Purpose |
|---|---|
| `attach({ controls, buttons })`, `detach(...)` | Attach later sources / restore before removal. |
| `whenReady()` | Await the latest explicit work and scrollbar refresh. |
| `retheme(slugOrUrl)` | Replace selected themes asynchronously. |
| `registerTheme(ref, theme)` | Borrow a decoded theme; caller owns disposal. |
| `openModal(wrap, { returnFocusTo })` | Return a `{ close() }` modal helper with focus trap, Esc/backdrop dismissal and chrome-close handling. Scope visibility through `data-scriptoscope-modal-open`. |
| `disconnect()` | End owned lifetimes and restore supported sources. |
| `stats` | Live numeric counts: `windows`, `buttons`, `controls`, `tabs`, `fields`. |
| `failures` | Per-target promotion failures. |

The handle emits `ready`, `retheme`, `promoteError` and `unmounted`. Listen for bubbling DOM events (`scriptoscope:promoted`, `scriptoscope:close`, `scriptoscope:userresize`, `scriptoscope:promoteError`) on a **stable ancestor**, since promotion removes the source window wrapper. See the [event table](https://github.com/khawkins98/scriptoscope/blob/main/docs/interaction.md#8-events-reference) for details.

**Failure and ordering:** boot load failures reject. `rejectOnEmptyMount` rejects with `PagePromotionError.failures` when selected sources exist but all fail. Partial failures call `onPromoteError` and leave other sources usable. The latest retheme request owns completion, including when it fails; superseded/disconnected work cannot publish completion. A load or window-preparation failure leaves existing windows intact. Controls replace after the window batch, so retheme is not a whole-desktop rollback transaction. Picker/URL state advances only on success.

**Ownership and teardown:** disconnect releases internally loaded themes and pending assets, while registered themes and their base chains remain borrowed. Release borrowed themes only after their last dependent unmounts. Standalone resolvers need `resolver.dispose()`.

Windows, buttons and native checkbox/radio/range/select controls restore their live values, form association and consumer listeners. Teardown removes owned faces, listeners and pending work without undoing unrelated consumer changes. Tabs/text-field restoration is outside that guarantee. Native range inputs own bounds, steps, keyboard and accessibility; synthetic `input`/`change` events report pointer changes. After assigning `.value` in script, dispatch either event to refresh the art immediately. Button disabled/default paint is sampled on promotion/retheme, without live attribute observation.

Detailed lifecycle and failure boundaries: [integration edge cases](https://github.com/khawkins98/scriptoscope/blob/main/docs/integration-edge-cases.md) and [runtime ownership contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/compositor-spec.md#runtime-theme-request-ownership).

### CSS classes (fallback if `data-scriptoscope-*` isn't an option)

For environments that strip data attributes (some CMSes, some CSP setups), use the class equivalents: `.scriptoscope-window-fallback`, `.scriptoscope-button-fallback` — the example host can select both during its initial capture. The data-attribute path is preferred.

### Theme switching at runtime

```html
<select data-scriptoscope-theme-switcher>
  <option value="1138">1138</option>
  <option value="beos-r503">BeOS R5</option>
  <option value="crayon-os">Crayon OS</option>
  <option value="https://example.com/themes/your-own/">A theme from somewhere else</option>
</select>
```

Selecting an option fires the existing `retheme()` flow; every promoted window flips chrome live.

### Bring your own theme — drop a `.sit` / `.rsrc` and see it render

A complete page with a file picker/drop target:

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

The decoder accepts `.sit`, `.hqx`, MacBinary, AppleSingle/Double and raw `.rsrc`; loading is entirely client-side. Registered themes are borrowed, so the example disconnects dependents before disposing them. Reload restores the default.

For a themed picker dialog, use `handle.openModal(wrap, { returnFocusTo: triggerButton })` and visibility CSS keyed to `data-scriptoscope-modal-open`. See [`demo/showcase.html`](https://github.com/khawkins98/scriptoscope/blob/main/demo/showcase.html) (`powers-byo-modal-wrap`) for the complete modal markup.

### CDN paths reference

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

### Vendoring (if you don't want a third-party CDN dependency)

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

Clone the repository and run its Vite server:

```sh
git clone https://github.com/khawkins98/scriptoscope.git
cd scriptoscope
npm install
npm run dev
```

Open the URL Vite prints. `/` is the landing page, `/showcase.html` the interactive demo, `/install.html` the copyable integration guide, and `/diagnostic.html` the developer showcase (`?dev=1` opens its inspectors). `/declarative-hostile-css.html` exercises shadow-root chrome under aggressive consumer CSS. See [CONTRIBUTING](https://github.com/khawkins98/scriptoscope/blob/main/CONTRIBUTING.md) for development prerequisites and checks.

## The runtime API

Two surfaces, same engine.

### Renderer-only entry

Renderer-only consumers that already have a `LoadedTheme` or `OwnedTheme` can
import the shared rendering API from `@khawkins98/scriptoscope/renderer`. The full
`@khawkins98/scriptoscope` entry continues to support theme loaders and declarative DOM
integration; use it when your application needs those features.

```ts
import { renderWindow, type ThemeInput } from '@khawkins98/scriptoscope/renderer';

async function showWindow(theme: ThemeInput, container: HTMLElement) {
  container.append(await renderWindow(theme, {
    title: 'Hello', width: 240, height: 120,
  }));
}
```

### Owned raster loading

`loadOwnedTheme()` and `loadOwnedKaleidoscopeScheme()` return a distinct
`OwnedTheme`. `createOwnedThemeResolver()` provides owned loading. The explicit page host
uses that resolver and owns its selected source lifetimes. Window/control composition
and interactive promotion accept owned inputs;
selected images export asynchronously through `themeImageUrl()`. Its `source`
fields contain local resource paths, including fields historically named `url`.
Existing loaders retain ready image URLs. See the [owned API and lifecycle
contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/v2/owned-theme-api.md) for examples and the current adoption boundary.
Existing raw loading and factory APIs remain available. Registered themes are borrowed; release them only after host dependents are disconnected.

### Native form-control migration (0.7.0, #484)

Use native checkbox/radio inputs, labels, initial checked state and `change` listeners. The removed `interactiveCheckbox`/`radioGroup` factories no longer own selection: shared radio names give that job to the browser. The [migration guide](https://github.com/khawkins98/scriptoscope/blob/main/docs/v2/integration-release-notes.md) records the compatibility changes.

For standalone controls using an already loaded `OwnedTheme` named `theme`,
mount an empty attached container, register the borrowed theme, then append the
controls. This reuses the theme without another load:

```js
import { mountExplicitPage } from 'https://khawkins98.github.io/scriptoscope/explicit-host.mjs';

const root = document.createElement('div');
document.body.append(root);
const handle = await mountExplicitPage({
  root, pageThemeDefault: 'session', bootAffordance: 'none',
});
handle.registerTheme('session', theme);
root.addEventListener('change', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  console.log(input.name, input.type === 'checkbox' ? input.checked : input.value);
});
root.insertAdjacentHTML('beforeend', `
  <label><input type="checkbox" name="invisibles" checked>Show invisibles</label>
  <label><input type="radio" name="mode" value="on" checked>On</label>
  <label><input type="radio" name="mode" value="off">Off</label>
`);

await handle.attach({controls: [...root.querySelectorAll("input")]});

// Before replacing the container or its controls:
handle.disconnect();
root.replaceChildren();
```

Native inputs retain identity, values and form association; while mounted they may move into carrier labels. `disconnect()` does not dispose registered borrowed themes. Release the theme after all consumers finish.

`interactiveButton` returns a native `HTMLButtonElement` with `type="button"`; use browser click/keyboard/disabled behavior rather than depending on old callback timing or wrapper markup. Closed selects likewise keep the native select as their sole interaction surface. Low-level composition and standalone slider/scrollbar APIs remain available.

### Imperative — `loadTheme()` + `renderWindow()`

A scheme bundle is a directory containing the **original Kaleidoscope archive** (`scheme.sit` preferred, `scheme.rsrc` fallback) plus `meta.json` + `PROVENANCE.md`. `loadTheme()` fetches the archive and decodes it in-browser via the bundled StuffIt + Kaleidoscope decoders; `renderWindow()` composites a window from the result. The ready-image path eagerly encodes its image assets. The declarative resolver caches bundle loads; direct calls load independently.

```ts
import { loadTheme, renderWindow } from 'https://khawkins98.github.io/scriptoscope/scriptoscope.js';

const theme = await loadTheme('https://khawkins98.github.io/scriptoscope/themes/beos-r503');
const win = await renderWindow(theme, {
  title: 'Hello!',
  width: 320, height: 200,
  state: 'active',
});
document.body.appendChild(win);
```

Window titles use substitute browser fonts. Recipe titles fit the complete request vertically before truncating horizontally; procedural frames keep their own policies. This is conditional modern compatibility, **not native typography equivalence**. Unsupported measurements, coverage assumptions or canvas failures reject the operation with `TitleCoverageUnavailableError`; handle that failure. Coverage work can be quadratic and has seconds-scale costs on long titles. The [title-coverage contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/engine/window-title-fit.md) defines support premises, error semantics and bounded scratch storage; it makes no hard realtime or total-memory guarantee.

`loadTheme` tries `scheme.sit` first, then falls back to `scheme.rsrc` by default. When you already know which form the bundle ships (e.g. from a catalog manifest), pass `{ source: 'scheme.sit' }` to skip the cascade and avoid the dev-console 404 noise on `.rsrc`-only bundles:

```ts
const theme = await loadTheme('/themes/1990', { source: 'scheme.rsrc' });
```

Picker `name`, `author`, and `year` are display labels. The loader fetches the complete
`meta.json` sidecar alongside the archive to retain source and license provenance.
If your catalog already includes that complete sidecar, pass it as `ThemeEntry.meta`
(or `loadTheme`’s `meta` option) to avoid the metadata request.

The `LoadedTheme` returned carries optional `dispose()` to revoke its blob URLs and evict its raster-cache entries; call it after its last consumer permanently unmounts.

The released control facades include `composeScrollbar` / `composeSlider` with
optional `pressedPart` (a pressed state without a part means the thumb).
`composeProgress` accepts normalized `value` or signed 16-bit native `range`,
never both, plus `indeterminate` and a phase byte. `composeProgressFrame` returns
the phase after drawing; `ProgressIdle` handles idle advancement in the interactive
layer. These are public exports; `src/engine/` remains internal. The option types
in [`src/controls.ts`](https://github.com/khawkins98/scriptoscope/blob/main/src/controls.ts) describe the released wrapper contract.

See [`demo/diagnostic.html`](https://github.com/khawkins98/scriptoscope/blob/main/demo/diagnostic.html) for the full integration, [`docs/spec/compositor-spec.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/compositor-spec.md) for the chrome model, and [`docs/scene-slot-spec.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/scene-slot-spec.md) + [`docs/scene-codex.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/scene-codex.md) for the per-theme tier resolution of every Scene visual slot.

### Optional measured display preparation

Load raw scheme colors through an explicit finite display profile when you have
reviewed mappings for a particular device/producer environment:

```js
import { prepareDisplayProfile, loadTheme } from '@khawkins98/scriptoscope';
const data = await fetch('/my-reviewed-display-profile.json').then(r => r.json());
const displayProfile = await prepareDisplayProfile(data);
const theme = await loadTheme('/themes/windows-95', { displayProfile });
```

The same option is available to `loadKaleidoscopeScheme` and the example host resolver.
Missing exact RGB16 mappings reject the load before asset URLs are allocated;
base themes must use the same profile. Omitting the option preserves the default
colors and reviewed goldens. A profile is finite environment data, not a general
original-device emulator or whole-theme fidelity claim. See the
[display-profile contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/display-profile.md) for producer tables,
fixed-icon conventions, ownership and unsupported inputs.

### Whole-header pixel surfaces

`composeHeaderSurface` draws a whole Appearance header rectangle without labels
or column layout. `composeListHeader` and `platinumListHeader` retain their
existing multi-column behavior. The API requires explicit dimensions, raw
state and a declared coordinate/clip context:

```js
import { composeHeaderSurface, bufferToCanvas } from 'https://khawkins98.github.io/scriptoscope/scriptoscope.js';

const result = await composeHeaderSurface(theme, {
  kind: 'list-view-header', width: 180, height: 18, drawState: 1,
  compositionContext: {
    controlOrigin: [12, 24], portOrigin: [0, 0],
    patternOrigin: { status: 'unknown' },
    clip: { kind: 'rect', rect: { x: 12, y: 24, w: 180, h: 18 } },
  },
});
if (result.status === 'rendered') document.body.append(bufferToCanvas(result.buffer));
```

Handle `unavailable` and `unsupported` explicitly. The initial supported subset
uses solid bodies, binary masks and verified current-display sampling; patterns,
device caches and recording remain outside it. See the [header-surface contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/header-surface.md)
for state selection, list-view extension before clipping, diagnostics and limits.

### Button label sizing

Themed push and bevel buttons accept an explicit `fontSize` (finite, at least
6px), with a 12px compatibility default independent of face height. See the
[font-size policy and source boundary](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/control-font-size.md).

Plain push buttons also accept an opt-in caller-owned `bitmapFont`, prepared with
`prepareBitmapFont`. It keeps advances, line metrics and signed ink bearings
separate and uses the bounded source-derived single-line layout. Browser fonts
remain the default; see [the prepared-strike contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/prepared-bitmap-font.md).

### Managed button pattern context

Push buttons promoted inside a window owned by the same declarative mount follow
that content viewport's logical position and scroll. Standalone controls keep
local context. Imperative consumers opt in explicitly:

```ts
import { interactiveButton, WindowManager, bindButtonToContentPort } from '@khawkins98/scriptoscope';

const content = document.createElement('div');
const button = await interactiveButton(theme, { label: 'OK', default: true });
content.append(button);
const manager = new WindowManager();
const host = await manager.add(theme, { width: 320, height: 180, scale: 2 }, {}, { contentEl: content });
document.body.append(host);
const binding = bindButtonToContentPort(button, manager.contentPort(host)!);
await binding.refresh();
// binding.state separates requested measurement from committedContext/pending/error.
// Before releasing the theme:
await binding.dispose();
manager.remove(host);
host.remove();
```

Import these functions from `@khawkins98/scriptoscope`. Binding adopts the committed window
scale by default, so a 1x button deliberately grows to 2x in this example; ordinary
HTML siblings do not. `{ scale: 'preserve' }` keeps the caller's size and reports
incompatible units explicitly. A direct `setButtonCompositionContext(button,
context)` replaces provider ownership. Unbind preserves newer consumer style
edits. Unsupported mappings use explicit compatibility defaults; measured browser
coordinates do not establish original GrafPort state. See the
[managed-context contract](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/managed-control-context.md) for lifetimes,
coordinate limits and automatic/foreign-manager boundaries.

### Explicit hosts and `data-scriptoscope-*`

The [complete starter](#five-minute-setup) and [attribute table](#the-full-data-scriptoscope--vocabulary) show the declarative route. It uses the same engine as imperative rendering; applications own which source elements attach and when they detach. For gestures and events, see the [interaction reference](https://github.com/khawkins98/scriptoscope/blob/main/docs/interaction.md).

### Bring your own theme (in-browser conversion)

Use the [drop-zone recipe](#bring-your-own-theme--drop-a-sit--rsrc-and-see-it-render) above. The public `loadKaleidoscopeScheme` / `loadOwnedKaleidoscopeScheme` wrappers include the engine's companion resource defaults; no build-time extraction is needed.

## Documents

- **[npm integration guide](./docs/npm-consumer.md)** — install the package, run a complete example with a first-party theme, and manage window/control attachment and teardown in your application.
- **[Interaction reference](https://github.com/khawkins98/scriptoscope/blob/main/docs/interaction.md)** — what users can do with a window and its controls (activation, focus, moving, resizing, title widgets, scroll bars, controls, modals), every `scriptoscope:*` event, keyboard equivalents, and touch and browser differences.
- **[Measured simplification](https://github.com/khawkins98/scriptoscope/blob/main/docs/measured-simplification.md)** — our approach to reducing runtime complexity and execution cost through consolidation, prepared inputs and differential validation; includes a reusable optimization prompt.

- **[`llms.txt`](https://github.com/khawkins98/scriptoscope/blob/main/llms.txt)** ([live](https://khawkins98.github.io/scriptoscope/llms.txt)) — discovery file for LLM agents helping a consumer integrate. Curates pointers to README + integration docs + recipes + API surface so an agent has one canonical entry point. Follows the [llmstxt.org](https://llmstxt.org/) standard. Drop the live URL into your AI assistant's context if you're integrating Scriptoscope and want better answers.
- **Runtime implementers: [`docs/spec/engine/IMPLEMENTER-BRIEF.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/engine/IMPLEMENTER-BRIEF.md) first**, then the assigned safe family spec under [`docs/spec/engine/`](https://github.com/khawkins98/scriptoscope/tree/main/docs/spec/engine/). Ask spec questions rather than inspecting original evidence, independent test sources or verifier material. The brief's exhaustive read scope overrides general reading suggestions here.
- **[`docs/v2/DECISIONS.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/v2/DECISIONS.md)** — current October integration and compatibility decisions. Integration owners/spec writers also use the amended [`PLAN.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/v2/PLAN.md); implementers use their brief and lane assignment.
- **[`docs/history.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/history.md)** and **[`LEARNINGS.md`](https://github.com/khawkins98/scriptoscope/blob/main/LEARNINGS.md)** — historical project arc and dated decisions, for readers outside the implementer sandbox. May v2/v3 names are historical; current architecture is in the engine family specs and code.
- **[`docs/maintainer-reference-environment.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/maintainer-reference-environment.md)** — private Forgejo reference assets, verified fetch instructions and native acquisition/restore limits; for spec writers/verifiers acquiring original evidence, optional for maintainers, never a public CI dependency.
- **[`docs/spec/README.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/README.md)** — source-reference index for spec writers and independent verifiers. Original binary references, including `kdef231-reference.md`, are for those roles; this index is not an implementer entry point.
- **[`docs/spec/compositor-spec.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/compositor-spec.md)** — listing-free window model alongside the current [`window/widgets family spec`](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/engine/window-widgets.md).
- **[`docs/superpowers/specs/2026-05-27-declarative-windows-design.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/superpowers/specs/2026-05-27-declarative-windows-design.md)** — design + multi-night build log for the declarative (`data-scriptoscope-*`) front door: the attribute contract, the feature-rich pass (window-shade, zoom, themed scrollbars, runtime theme-switch, themed controls), the OS 8.6 desktop redesign, the review-driven hardening, and the known follow-ups. Read this when extending the declarative layer.
- **[`PRD.md`](https://github.com/khawkins98/scriptoscope/blob/main/PRD.md)** — the original product charter (vision still largely valid; implementation has since moved on — see `docs/history.md`).
- **[`CONTRIBUTING.md`](https://github.com/khawkins98/scriptoscope/blob/main/CONTRIBUTING.md)** — how to land changes and port a scheme.

## North Star

Three principles guide the project:

1. **Framework-independent:** ordinary HTML, TypeScript and CSS; no framework peer dependency.
2. **Explicit lifetimes:** applications select source nodes and own attachment/teardown. Native controls retain browser behavior.
3. **Compatibility from original assets:** the clean-room runtime reads existing scheme resources; the authoring toolkit writes the same format. Apple's own Appearance themes are outside scope. First-party authoring examples remain separate from the community corpus.

## Where the idea came from

Scriptoscope grew out of [classic-vibe-mac](https://github.com/khawkins98/classic-vibe-mac), a System 7.5.5 emulator and in-browser C compiler. Its Platinum-styled WinBox layer exposed limits in window geometry and chrome. Earlier [NeXTSTEP](https://github.com/khawkins98/PDF-A-go-actionable#visual-design) and [classic-Mac](https://github.com/khawkins98/PDF-A-go-slim#why-it-looks-like-that) experiments had the same problem: hand-drawing every control in CSS creates endless drift. Reading the original art offered a reusable alternative.

The original name was **Aaron UI**, a nod to Landweber's earlier extension; it became Scriptoscope as the scope grew to Kaleidoscope compatibility. Three people would have caught that. Hello, three people. See [project history](https://github.com/khawkins98/scriptoscope/blob/main/docs/history.md), the [upstream charter](https://github.com/khawkins98/classic-vibe-mac/issues/246), and the [longer desktop-paradigm essay](https://www.allaboutken.com/posts/20260216-90s-desktop-paradigm-browser-utilities/) for the background.

## What this isn't

- An emulator. cv-mac has one.
- A full AppKit / Carbon reproduction.
- A mobile-first toolkit. This is desktop windowing.

## A heads-up on hover

Pointing at a close box does not invent a hover face: scheme control artwork uses normal, pressed and disabled states. Scriptoscope preserves the loaded artwork's behavior.

## What loaded themes carry (and don't)

The runtime renders scheme chrome, controls and colours. Some archives also contain fonts, sounds, cursors or desktop extras; loading a scheme does not automatically install those on your page. Supply page audio/backgrounds separately. Browser font substitutes remain separate from scheme art; see the [font terms](#license).

## Rendering regression coverage

The [control matrix](https://github.com/khawkins98/scriptoscope/blob/main/tests/rendering-options/README.md) exercises source/built APIs, promoted DOM and consumer CSS. Reviewed Linux Chromium goldens detect regression; screenshots of current output **cannot establish original fidelity**. That needs independently source-backed expected values and reviewed references with matching inputs.

Scoped empty-face observations cannot certify masks, typography, unobserved states or private painter selection. The [original reference corpus](https://github.com/khawkins98/scriptoscope/blob/main/tests/reference-captures/ORIGINALS.md) remains evidence-incomplete for broader requests. [Resource-byte provenance](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/resource-byte-provenance.md) establishes input identity, not independent decoder correctness.

See the [fidelity plan](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/fidelity-verification-plan.md), [control limits #218](https://github.com/khawkins98/scriptoscope/issues/218), [fidelity epic #221](https://github.com/khawkins98/scriptoscope/issues/221), and [reference corpus #190](https://github.com/khawkins98/scriptoscope/issues/190). The [private reference environment](https://github.com/khawkins98/scriptoscope/blob/main/docs/maintainer-reference-environment.md) is optional for maintainers and never a public CI dependency. [CONTRIBUTING](https://github.com/khawkins98/scriptoscope/blob/main/CONTRIBUTING.md) explains required checks and role boundaries.

## Roadmap — ideas if this project gets traction

These are discussion topics, not release promises. Track progress in the linked issues.

### Themes — bring more in, surface what they ship

[Variants and extra assets (#177)](https://github.com/khawkins98/scriptoscope/issues/177); [Appearance-theme conversion tooling (#176)](https://github.com/khawkins98/scriptoscope/issues/176). Direct `.afm` import is outside scope; see the [external conversion path](https://github.com/khawkins98/scriptoscope/blob/main/docs/converting-from-afm.md).

### Renderer — richer chrome + state coverage

[Menu/popup APIs (#166)](https://github.com/khawkins98/scriptoscope/issues/166), [richer control states (#178)](https://github.com/khawkins98/scriptoscope/issues/178), and the [fidelity work (#221)](https://github.com/khawkins98/scriptoscope/issues/221).

### Discovery — find themes without leaving the project

Community archive browsing and remix are possible extensions of the existing local-file picker.

### Adopter-facing extras

[Period-style animations (#25)](https://github.com/khawkins98/scriptoscope/issues/25) and [cv-mac integration (#27)](https://github.com/khawkins98/scriptoscope/issues/27). Propose other ideas through [issues](https://github.com/khawkins98/scriptoscope/issues/new).

## License

The site’s [Acknowledgements page](https://github.com/khawkins98/scriptoscope/blob/main/demo/acknowledgements.html) collects scheme authors, archives, visual inspiration, image provenance, fonts, and supporting tools.

**Scriptoscope's own code is [MIT](./LICENSE)** (best for adoption — the library is meant to be embedded in other projects). The bundled third-party material keeps its own terms and is **not** relicensed:

- **`themes/<slug>/`** — assets extracted from community-authored Kaleidoscope schemes, redistributed under each original author's freeware-with-redistribution terms. Provenance is in every bundle's `meta.json` (`origin.originalLicense`, `sourceUrl`) and `PROVENANCE.md`.
- **`tools/sit-wasm/munbox/`** — a vendored subset of [munbox](https://github.com/idolpx/munbox) (MIT); see `tools/sit-wasm/munbox/LICENSE` and `PATCHES.md`.
- **`demo/assets/fonts/`** — Instrument Serif and Cormorant Garamond (SIL OFL 1.1), Charcoal 12 (Jeremy Sachs, CC BY-SA), and Virtue (Marty Pfeiffer, author’s terms); see the license files alongside them.

The standalone StuffIt decoder, [`tools/sit-wasm/`](https://github.com/khawkins98/scriptoscope/tree/main/tools/sit-wasm/), carries its own MIT `LICENSE` so it stays self-contained if extracted.
