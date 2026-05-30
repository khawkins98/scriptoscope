# Scriptoscope

Eighteen [Kaleidoscope](https://en.wikipedia.org/wiki/Kaleidoscope_(software)) schemes, running in a browser tab twenty-five years too late.

Kaleidoscope was a control panel some of us couldn't leave alone. Greg Landweber and Arlo Rose wrote it; the rest of us kept a Scheme Folder we'd refresh every weekend because Hayato Mori or Erik Ekengren or somebody on Info-Mac had just posted a new one. Then OS X arrived and the whole format went quiet.

Scriptoscope is a compatibility layer that reads those same scheme files — the actual `.sit` and `.rsrc` bundles people made in the nineties — and paints them onto your webpage. Same color icons, same window frames, same fill patterns. Your HTML stays live underneath; only the skin is canvas.

A Kaleidoscope scheme is a Mac resource fork: a little database of typed records authored against a system that stopped shipping in 2001. So Scriptoscope reads one the way the old Finder did. Drop a scheme on the page, and it unpacks the archive, walks the resource map, pulls each record into memory, and hands the lot to a `<canvas>` renderer that speaks the same scheme format the original control panel did. *(That renderer is a spec-compatible reimplementation of the 2.3.1 engine; the divergences are logged in [the ledger](./docs/spec/kdef-faithfulness-ledger.md) if you care.)* All of it runs in the tab. Nothing's uploaded, and a refresh throws the bytes away.

To skin your own page, tag an element for what it is — window, button, slider — add one script tag, and it wears the current scheme. No framework, no build step. The children stay real HTML; only the chrome is painted.

Why? No good reason. Kaleidoscope lost to OS X a quarter-century ago and the world was right to move on. I rebuilt the rendering layer anyway, so eighteen schemes by people who mostly stopped making them in 2002 could run in a browser tab. This is a deeply silly use of anyone's time, including yours. If you're unhinged enough to ship it on a real website, [I genuinely want to hear about it](https://github.com/khawkins98/aaron-ui/issues). And if you ever wrote a Kaleidoscope scheme, [the door's open](#if-you-build-a-scheme).

> *P.S. The repo is named **aaron-ui** because **Aaron** was Landweber's earlier extension — the one that faked the Mac OS 8 Platinum look on System 7 before Kaleidoscope existed. Three people will catch that. Hello, three people.*

I emailed Greg Landweber and Arlo Rose and a few of the scheme authors I could find addresses for; if any of them ever reply, that'll be the best day of this project.

The current corpus of bundles lives under [`themes/`](./themes/): `1138`, `1984`, `1990`, `animals`, `apple-lisa`, `apple-platinum-2`, `beos-r503`, `black-platinum`, `crayon-os`, `dolphin-som`, `evolution`, `floppies`, `monkey-paradise`, `platinum-8`, `slimes`, `system7-nostalgia-silver`, `windows-31`, `windows-95`. Each bundle ships only the original archive (`scheme.sit` or `scheme.rsrc`) + `meta.json` + `PROVENANCE.md` — the runtime decodes them client-side, no pre-extraction in git.

Want more? Two community archives where Scriptoscope's drop-zone can read schemes from directly:
- **[Mac Themes Garden](https://macthemes.garden/)** — a beautifully curated gallery + archive with reference renders and the original `.sit` downloads. The 2026-05-28 corpus additions came from here.
- **[Kaleidoscope Scheme Archive (kaleidoscope.hryjksn.com)](https://kaleidoscope.hryjksn.com/)** — a community-maintained archive of 3000+ schemes, with hash-stamped reference renders. The largest corpus available; the initial bundled schemes were ported from here.

Both let you grab a `.sit` and drop it on the demo to see it render live without a build step.

> **Status (pre-1.0, 2026-05-29):** prototype mode. Two public surfaces are in: the **imperative runtime** (`loadTheme()` / `renderWindow()` in [`src/index.ts`](./src/index.ts)) and the **declarative front door** (`mountDeclarative()` + `data-scriptoscope-*` in [`src/declarative/index.ts`](./src/declarative/index.ts)) — both exercised by the demo pages below. The chrome renderer is rebuilt around Kaleidoscope's own part-code model and validated against the decompiled 2.3.1 kDEF. See [`docs/history.md`](./docs/history.md) for the project arc (and the "Dead ends — don't relitigate these" list — read it first), [`docs/superpowers/specs/2026-05-27-declarative-windows-design.md`](./docs/superpowers/specs/2026-05-27-declarative-windows-design.md) for the declarative layer's design, and [`LEARNINGS.md`](./LEARNINGS.md) for the Aaron UI → Scriptoscope rebrand (2026-05-28) + the full `data-scriptoscope-*` sweep (2026-05-29 — the Lodash-kept-`_` argument didn't survive the first integration guide). Live demo: <https://khawkins98.github.io/aaron-ui/>.

## If you build a scheme

The original tooling — Greg Landweber and Arlo Rose's Kaleidoscope.app, Edwin Wong's Scheme Factory, the various ResEdit templates that floated around Info-Mac — is gone, or close enough. But the *format* isn't. Scriptoscope reads the same `cicn` / `wnd#` / `cinf` / `ppat` / `Colr` records the 1999 control panel did, so a scheme authored today against this runtime will render the same way an Erik Ekengren scheme from 1998 does.

Nobody's authored a new Kaleidoscope scheme in roughly twenty years. The corpus is closed because the tools closed, not because the form ran out. If you want to be the one who reopens it, I'd love to help — [file an issue](https://github.com/khawkins98/aaron-ui/issues), mail me a `.rsrc`, draw a single button cicn and see what happens. The renderer doesn't know what year it is.

## Install

```sh
npm install scriptoscope     # not yet on npm — first publish gated on #28 prep
```

CDN / unpkg:

```html
<script type="module">
  import { mountDeclarative } from 'https://unpkg.com/scriptoscope/dist/scriptoscope.js';
  await mountDeclarative({ themeBaseUrl: '/path/to/your/themes' });
</script>
<link rel="stylesheet" href="https://unpkg.com/scriptoscope/dist/scriptoscope.css">
```

Themes are loaded from a base URL you serve — they're not bundled in the npm tarball (so you can host the corpus once and use it from many projects, and so the npm package stays small). See `themes/` in this repo for the bundle format and the corpus we ship for the demos.

## Integration guide — drop Scriptoscope on any page

The runtime is hosted at <https://khawkins98.github.io/aaron-ui/> alongside the demo, so you can integrate without installing from npm. Five-minute setup:

```html
<!doctype html>
<html>
<head>
  <!-- 1. Optional outer-shell stylesheet (drop shadow, focus ring, desktop background).
       Without this, chrome still renders faithfully — this just adds polish. -->
  <link rel="stylesheet" href="https://khawkins98.github.io/aaron-ui/scriptoscope.css">
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

  <!-- 3. Bootstrap. mountDeclarative() scans the page once, then watches
       MutationObserver-style for new data-scriptoscope-* elements. -->
  <script type="module">
    import { mountDeclarative } from 'https://khawkins98.github.io/aaron-ui/scriptoscope.js';
    await mountDeclarative({
      themeBaseUrl: 'https://khawkins98.github.io/aaron-ui/themes',
      pageThemeDefault: '1138',
    });
  </script>

</body>
</html>
```

That's it. The bundled themes (`1138`, `beos-r503`, `apple-platinum-2`, `crayon-os`, `windows-95`, etc. — see [`themes/`](./themes/)) are served from the same URL, so `themeBaseUrl` resolves them transparently.

#### How positioning works

`data-scriptoscope-window` elements **inherit their position and size from the DOM** at promotion time. If you don't specify `data-scriptoscope-x/y/width/height`, the runtime calls `getBoundingClientRect()` on the element and uses that — meaning whatever CSS you've written for the element (grid cell, flexbox child, absolute, or normal flow) is the source of truth. The chrome wraps **in place**. No new positioning vocabulary to learn.

After mount, drag + resize update the host's inline `style.left/top/width/height` directly; CSS is the initial state, runtime owns runtime state. Reload restores CSS defaults (unless you pass `persistKey` — see below).

#### Common pitfall — don't change child layout after mount class flips

The runtime captures each window's `getBoundingClientRect()` at scan time. If your CSS reflows / hides / re-displays children based on a "mounted" or "ready" class your boot script adds, AND you add that class before `mountDeclarative()` runs, the runtime captures the **wrong** geometry — windows end up positioned and sized as if the page were already mid-mount.

Bad:
```css
/* This rule changes display when .ready is added → cards stack on top of each other */
.app.ready .card-row { display: block; }
```
```js
container.classList.add('ready');           // ← layout changes here
await mountDeclarative({ root: container }); // ← runtime sees the WRONG geometry
```

Good — scope CSS off the runtime's structural marker `.scriptoscope-slot` (added at promotion) instead of a custom class your code manages:
```css
/* Fires AFTER promotion → measurement already happened */
.scriptoscope-slot .glyph { display: none; }
```

Or: keep custom `.skinned`-style classes for **visual** changes only (filter, mask, border, background). Never let them change `display`, `grid-template`, `max-width`, `padding`, `margin`, or anything that moves siblings.

#### Shadow DOM — what's reachable from your CSS, what isn't

Each promoted window's CHROME (the canvas, the scrollbars, the title-bar widgets, the inner `.scriptoscope-window` / `.scriptoscope-content` wrappers) lives inside a **shadow root** attached to the window host. That shadow is opened-mode but isolated from page CSS — selectors like `.scriptoscope-window { box-shadow: ... }` or `canvas { … }` from your stylesheet will **not** reach inside. Your consumer content moved into the slot (`.scriptoscope-slot > .scriptoscope-fit > your children`) stays in the LIGHT DOM, so your normal styling still applies to it.

Practical rules:
- Restyle the **host** (the absolute-positioned `<div>` mountDeclarative inserted): `.scriptoscope-ready [data-scriptoscope-window] { filter: drop-shadow(…) }`. The host is light-DOM and reachable.
- Restyle your CONTENT (`h3`, `p`, your custom classes): works normally — content's in light DOM.
- Do NOT try to style chrome (canvas, scrollbar art, title bar): the shadow root quarantines them by design (ADR-0001 Decision 2). If you need a chrome tweak, file an issue — the right answer is usually a runtime knob, not consumer CSS.

#### Promotion is destructive — your original element is moved + removed

`ScriptoscopeWindow.promote` takes your `<article data-scriptoscope-window>` (or whatever element), moves its CHILDREN into the runtime's slot wrapper, then removes the original element from the DOM. The host is inserted where the original sat. Two consequences:
- Refs to the original element (from your framework's binding, jQuery cache, etc.) are now pointing at a detached node.
- Event listeners on **children** survive (the nodes themselves moved); listeners on the **wrapper element** are lost (that element is gone).

If your framework expects to manage the lifecycle of the wrapper (React owns the DOM, Vue mounts here), promote AFTER the framework has rendered + use the `scriptoscope:promoted` event on `document` to react to the swap.

#### Known incompatibilities

Things that work in the lab but bite once integrated:

- **`* { box-sizing: content-box }` global resets** — the WindowManager's width math is based on content-box content sizes. Most CSS frameworks already set `border-box`, which we expect; flipping global box-sizing on `*` for `<div>` or `canvas` will produce windows wider than declared geometry by `padding + border`.
- **`* { transform: translateZ(0) }` iOS scroll-perf hacks** — `transform` on any element creates a CSS containing block, breaking `findPositionedAncestor`'s walk. Windows position relative to the wrong ancestor, usually the nearest hacked element instead of your intended container.
- **`body { overflow: hidden }` from modal libraries** — promoted windows use viewport-coordinate drag handlers. Freezing scroll while drag is in progress means the pointer/window math diverges; release works but the visual lags. Toggle this off while a Scriptoscope window has focus.
- **`position: fixed` on consumer content INSIDE a promoted window** — the inner fixed element now anchors to the window host's transformed ancestor (if any), not the viewport. The runtime doesn't warn; this is a CSS spec edge that breaks consumers' assumptions.
- **Heavy CSS reset on `<button>` and `<input>` (Tailwind preflight, Bootstrap reset)** — generally OK because we set chrome inside the shadow root. The HOST checkbox/select gets the reset normally, which is what you want.

If you hit one of these and the fix isn't obvious, the diagnostic page at `/diagnostic.html` has DOM inspectors that surface the actual measured rects.

#### Internal stamps — don't set these yourself

The runtime uses these DOM attributes as re-entrancy guards. Consumers should not set them; SSR / static-render consumers should specifically AVOID emitting them:

- `data-scriptoscope-promoted` (on windows, buttons, controls — "I've processed this")
- `data-scriptoscope-tabs-promoted`, `data-scriptoscope-field-promoted`, `data-scriptoscope-icon-promoted`, `data-scriptoscope-theme-picker-promoted` (per-kind stamps)
- `data-scriptoscope-switcher-wired` (on `<select data-scriptoscope-theme-switcher>`)
- `data-scriptoscope-current-state="active|inactive"` (on the inner `.scriptoscope-window`, indicates focus state)
- `data-scriptoscope-theme="<slug>"` (on each window host, indicates which theme is painted)
- (Transient pre-mount-rect stamps used to live here but moved to a WeakMap in 2026-05-30; the dataset is now clean.)

`SCRIPTOSCOPE_PROMOTED_ATTR` is exported as a constant for SSR setups that need to assert the attribute is absent.

#### Available theme slugs

The live list (with display labels and reference renders) is served at <https://khawkins98.github.io/aaron-ui/themes-manifest.json> and rendered visually at <https://khawkins98.github.io/aaron-ui/> (the demo page's theme switcher). Current bundled corpus:

| slug | name | author |
|---|---|---|
| `1138` | 1138 | Erik Ekengren (1998) |
| `1984` | 1984 | Geoffrey Hamilton (1999) |
| `1990` | 1990 | SHIOCOP (1999) |
| `animals` | Animals | Masashi Ichikawa (1999) |
| `apple-lisa` | Apple Lisa for K2.1 | R. Bensam & E. Deans |
| `apple-platinum-2` | Apple Platinum 2 | Orion Dimitrakopoulos (1999) |
| `beos-r503` | BeOS R5.0.3 | Jon Alexander (2002) |
| `black-platinum` | Black Platinum | Daisuke Yamashita (1999) |
| `crayon-os` | Crayon OS | Karl von Laudermann (2000) |
| `dolphin-som` | Dolphin SOM (dsom) | unknown |
| `evolution` | 1991 evolution | SHIOCOP (1999) |
| `floppies` | Floppies! | unknown |
| `monkey-paradise` | Monkey Paradise | Masashi Ichikawa (1998) |
| `platinum-8` | Platinum 8 | Russell Silver Jr. (1998) |
| `slimes` | slimes 1.5 | JUN (1998) |
| `system7-nostalgia-silver` | System 7 Nostalgia Silver | mollusc (1997) |
| `windows-31` | Windows 3.1 | Scott Naness |
| `windows-95` | Windows 95 | Scott Naness |

Want more? Drop any `.sit`/`.rsrc` you've grabbed from [Mac Themes Garden](https://macthemes.garden/) or [Kaleidoscope Scheme Archive](https://kaleidoscope.hryjksn.com/) onto the BYO drop-zone (see "Bring your own theme" below) and it'll render in the browser with no upload step.

### The full `data-scriptoscope-*` vocabulary

| Attribute | Where | What it does |
|---|---|---|
| `data-scriptoscope-window` | any element | Promote into a Mac window. Children become the window body. |
| `data-scriptoscope-title="…"` | a window | Title-bar text. Optional. |
| `data-scriptoscope-window-type="…"` | a window | One of: `document-window`, `dialog`, `alert`, `movable-modal`, `movable-alert`, `titled-utility-window`, `side-floating-utility-window`, `no-title-utility-window`, `collapsed-document-window`, `popup-window` (+ collapsed variants). Default: `document-window`. |
| `data-scriptoscope-x="…"` / `data-scriptoscope-y="…"` | a window | Initial position (px), relative to the nearest positioned ancestor. **Optional** — omitted values inherit from the element's current page position, so the window appears in place where the original `<div>` was. Fallback (24,24) only kicks in when the element has no bounding rect (e.g. `display:none` at promotion time). |
| `data-scriptoscope-width="…"` / `data-scriptoscope-height="…"` | a window | Declared size. **Optional** — omitted values inherit the element's currently-rendered width/height (one-shot capture). When neither is declared AND the element has no rect, content-fit kicks in (a `ResizeObserver` re-renders the chrome to fit content reflow). The combination "natural-rect capture or content-fit fallback" gives correct behavior whether the element is static (CSS-sized) or dynamic. |
| `data-scriptoscope-state="active"` or `"inactive"` | a window | Initial focus state. Default `active` for first window, `inactive` after. |
| `data-scriptoscope-z="…"` | a window | Initial stacking order. Higher = on top. |
| `data-scriptoscope-collapsed` | a window | Boot pre-shaded (just title bar visible). Double-click the title to toggle at runtime. |
| `data-scriptoscope-theme="…"` | a window OR any ancestor | Per-element theme override (slug or URL). Nearest-ancestor wins. |
| `data-scriptoscope-theme-switcher` | a `<select>` | Runtime theme picker. Selecting an option re-skins every window + control. |
| `data-scriptoscope-button` | a `<button>` | Themed push button. Native button stays underneath (form/keyboard/a11y preserved). |
| `data-scriptoscope-default` | a `<button data-scriptoscope-button>` | Adds the "OK ring" (the period-correct default-button outline). |
| `data-scriptoscope-disabled` | a `<button data-scriptoscope-button>` | Disabled state — flatten + grey. |
| `data-scriptoscope-control` | `<input type=checkbox\|radio\|range>` or `<select>` | **Auto-applied** to every matching input — themed chrome over the native control. Opt out per-input with `data-scriptoscope-control="off"`. |
| `data-scriptoscope-field` | `<input type=text\|email\|password\|…>` or `<textarea>` | Mac OS 8 sunken-bevel chrome over a native text input. Opt-in (consumer CSS can conflict). |
| `data-scriptoscope-tabs` | a `<div>` containing `data-scriptoscope-tab` buttons + `data-scriptoscope-panel` siblings | Tab strip. Click cycles panels; ARIA + roving tabindex + keyboard nav wired. |
| `data-scriptoscope-tab="<panel-id>"` | a `<button>` inside `data-scriptoscope-tabs` | One tab. Value references the panel id. |
| `data-scriptoscope-panel="<id>"` | a `<div>` inside `data-scriptoscope-tabs` | A panel. Hidden unless its id matches the selected tab. |
| `data-scriptoscope-selected` | a `<button data-scriptoscope-tab>` | Initial selected tab. Default: first tab. |
| `data-scriptoscope-window-id="…"` | a window | Stable identity for layout persistence (see `persistKey` below). Without it, DOM ordinal is used. |

### `mountDeclarative()` options

```ts
await mountDeclarative({
  themeBaseUrl: 'https://khawkins98.github.io/aaron-ui/themes', // where bundles live
  pageThemeDefault: '1138',         // theme slug or URL for windows w/o explicit data-scriptoscope-theme
  persistKey: 'my-app-layout',      // optional: save window positions to localStorage.scriptoscope:layout:<key>
  baseSlug: 'apple-platinum-2',     // optional: base scheme to inherit from (any slug in your themeBaseUrl)
  root: document,                   // optional: scan a subtree instead of the whole page
});
```

The call returns `{ disconnect, retheme, registerTheme }` — `retheme(slug)` to switch programmatically, `registerTheme(ref, loadedTheme)` to register a runtime-decoded theme (used by drop-zones).

### CSS classes (fallback if `data-scriptoscope-*` isn't an option)

For environments that strip data attributes (some CMSes, some CSP setups), use the class equivalents: `.scriptoscope-window-fallback`, `.scriptoscope-button-fallback` — the scanner picks both. The data-attribute path is preferred.

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

For a consumer-side "drop your Kaleidoscope scheme here" affordance, two extra modules ride on the same CDN URL:

```html
<button id="byo">📂 Drop or pick a theme</button>
<span id="byo-status" aria-live="polite"></span>

<script type="module">
  // Both `mountDeclarative` and `loadKaleidoscopeScheme` are exported from the same `scriptoscope`
  // entry — npm consumers `import from 'scriptoscope'`; CDN consumers use the GH Pages URL below.
  // The decoder is bundled into the main module; StuffIt WASM lazy-loads only when a .sit is decoded.
  import {
    mountDeclarative, attachThemeDropZone, loadKaleidoscopeScheme,
  } from 'https://khawkins98.github.io/aaron-ui/scriptoscope.js';

  const handle = await mountDeclarative({
    themeBaseUrl: 'https://khawkins98.github.io/aaron-ui/themes',
    pageThemeDefault: '1138',
  });

  attachThemeDropZone(document.getElementById('byo'), {
    onFile: async (file) => {
      const status = document.getElementById('byo-status');
      status.textContent = `Decoding ${file.name}…`;
      try {
        // Decode the .sit / .rsrc / .hqx / .bin / .as / .adf / .cpt entirely in the browser.
        // StuffIt unpack uses a 70 KB WASM blob loaded lazily from the same CDN.
        const theme = await loadKaleidoscopeScheme(file, { source: file.name });
        const ref = `dropped:${file.name}`;
        handle.registerTheme(ref, theme);
        await handle.retheme(ref); // applies to every promoted window on the page
        status.textContent = `✓ ${file.name} loaded`;
      } catch (err) {
        status.textContent = `Couldn't read ${file.name}: ${err?.message ?? err}`;
      }
    },
  });
</script>
```

That's the full BYO path. `loadKaleidoscopeScheme` accepts every container the [Mac Themes Garden](https://macthemes.garden/) and [Kaleidoscope Scheme Archive](https://kaleidoscope.hryjksn.com/) archives ship (`.sit`, `.hqx`, `.bin`, AppleSingle/Double, raw `.rsrc`); the decode runs entirely client-side via the bundled StuffIt WASM. The dropped theme persists for the session; reload restores the default.

For a richer "add the dropped theme to the switcher + remember across reload" wiring, see the demo source at [`demo/_theme-drop.mjs`](./demo/_theme-drop.mjs).

### CDN paths reference

| URL | What |
|---|---|
| `https://khawkins98.github.io/aaron-ui/scriptoscope.js` | Runtime (ESM, ~187 KB raw / ~55 KB gzip — includes the in-browser `.sit`/`.rsrc` decoder) |
| `https://khawkins98.github.io/aaron-ui/scriptoscope.css` | Optional outer-shell stylesheet (~6 KB) |
| `https://khawkins98.github.io/aaron-ui/themes/<slug>/scheme.sit` (or `scheme.rsrc`) | The bundle's source archive — fetched + decoded client-side by `loadTheme()` |
| `https://khawkins98.github.io/aaron-ui/themes-manifest.json` | Catalog of every bundled slug (label, author, source filename, ref screenshot) |
| `https://khawkins98.github.io/aaron-ui/sit-wasm/munbox.wasm` | StuffIt unpack WASM (~70 KB, loaded lazily by the decoder only when a `.sit` is decoded) |

For a versioned URL (locks to a specific release), use **unpkg** once the package is published: `https://unpkg.com/scriptoscope@0.0.1/dist/scriptoscope.js`. Until then, GH Pages tracks `main`.

### npm install (for build pipelines)

If you want to bundle Scriptoscope into your own build artifact instead of loading from CDN:

```sh
npm install scriptoscope
```

```js
import { mountDeclarative } from 'scriptoscope';
import 'scriptoscope/scriptoscope.css'; // optional
```

Subpath available: `scriptoscope/declarative` exposes the focused declarative entry (`createThemeResolver`, `ThemeResolver`, `ScriptoscopeWindowDeps`, `SizeMode`, `ThemeBootstrapOpts` — not re-exported from the root).

## Trying it locally

Three demo pages sit on the same runtime, each showing a different integration path. Run them together:

```sh
npm install
npm run dev        # http://localhost:5173/
```

- **[`demo/index.html`](./demo/index.html)** — the **landing page**. The 1999-Apple-styled consumer pitch: "Eighteen schemes. One runtime." with a one-line install snippet, a hero control strip showing every promotable widget (button + checkbox + radio + slider + text + select) themed live, an authentic-folder-icon theme picker (click a folder = wear that scheme), and four named-technology cards (kDEF Replay Engine / ResourceForkLib / data-scriptoscope-* / The Scheme Library) that float as Mac windows. Top-right toggle reveals the bare HTML.
- **[`demo/diagnostic.html`](./demo/diagnostic.html)** — the **runtime showcase + developer diagnostic**. Pick any scheme from the ribbon and get its scene + reference comparison, live themed controls, and an interactive playground (every window type at any size, plus live buttons / checkboxes / radios / sliders / scrollbars / title-bar widgets). A drop-zone decodes any `.sit` / `.hqx` / `.rsrc` Kaleidoscope archive entirely in the browser. The dev-facing inspectors (geometry, slice inspector, icon inventory, raster foldout, resource roles) live behind the **"Developer tools"** disclosure at the bottom of each scheme's section — open it manually or visit with `?dev=1` to default-open.
- **[`demo/declarative-hostile-css.html`](./demo/declarative-hostile-css.html)** — the **Shadow-DOM litmus test for ADR-0001 Decision 2**. A host page deliberately ships aggressive CSS (universal `!important` resets, opinionated `div`/`canvas`/`button` rules — the kind of thing a real CMS or third-party site does) to prove the chrome inside the shadow root survives unscathed. Slotted body content still picks up host styling (it stays in the light DOM by design); only the chrome is quarantined.

## The runtime API

Two surfaces, same engine.

### Imperative — `loadTheme()` + `renderWindow()`

A scheme bundle is a directory containing the **original Kaleidoscope archive** (`scheme.sit` preferred, `scheme.rsrc` fallback) plus `meta.json` + `PROVENANCE.md`. `loadTheme()` fetches the archive and decodes it in-browser via the bundled StuffIt + Kaleidoscope decoders; `renderWindow()` composites a window from the result. First per-bundle load is ~234 ms on a fast machine (browser decode + 500 OffscreenCanvas PNG encodes); subsequent calls hit the in-page cache.

```ts
import { loadTheme, renderWindow } from 'scriptoscope';

const theme = await loadTheme('/themes/beos-r503');
const win = await renderWindow(theme, {
  title: 'Hello!',
  width: 320, height: 200,
  state: 'active',
});
document.body.appendChild(win);
```

`loadTheme` races `scheme.sit` → `scheme.rsrc` by default. When you already know which form the bundle ships (e.g. from a catalog manifest), pass `{ source: 'scheme.sit' }` to skip the cascade and avoid the dev-console 404 noise on `.rsrc`-only bundles:

```ts
const theme = await loadTheme('/themes/1990', { source: 'scheme.rsrc' });
```

The `LoadedTheme` returned carries optional `dispose()` to revoke its blob URLs (~500 per scheme); call it when permanently unmounting to avoid pinning the decoded ImageBitmap memory.

See [`demo/diagnostic.html`](./demo/diagnostic.html) for the full integration, [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md) for the chrome model, and [`docs/scene-slot-spec.md`](./docs/scene-slot-spec.md) + [`docs/scene-codex.md`](./docs/scene-codex.md) for the per-theme tier resolution of every Scene visual slot.

### Declarative — `mountDeclarative()` + `data-scriptoscope-*`

The same runtime exposed as markup. Put `data-scriptoscope-window` on a plain `<div>` and one bootstrap line promotes it into a faithful Mac window wrapping the live HTML content — no per-window JS:

```html
<body>
  <div id="desktop">
    <div data-scriptoscope-window data-scriptoscope-title="Read Me" data-scriptoscope-x="32" data-scriptoscope-y="28"
         data-scriptoscope-width="360" data-scriptoscope-height="280">
      <h2>About</h2>
      <p>This is real HTML. Selectable, focusable, accessible. The chrome is canvas behind it.</p>
      <button data-scriptoscope-button data-scriptoscope-default onclick="alert('OK')">OK</button>
    </div>
  </div>

  <script type="module">
    import { mountDeclarative } from 'scriptoscope';
    await mountDeclarative({ themeBaseUrl: '/themes', baseSlug: 'apple-platinum-2' });
  </script>
</body>
```

**Window attributes** (all `data-scriptoscope-*`): `window`, `title`, `window-type` (`document-window` / `movable-modal` / `dialog` / `titled-utility-window` / `side-floating-utility-window` / …), `x` / `y`, `width` / `height` (omit both → content-fit with a `ResizeObserver`), `state` (`active`/`inactive`), `z` (initial stacking order), `collapsed` (boot pre-shaded), `theme` (per-window scheme override, nearest-ancestor wins).

**Promoted children**: `<button data-scriptoscope-button>` (with `data-scriptoscope-default` for the OK ring), and `<input type=checkbox|radio|range>` are auto-promoted to themed art (opt-out per-input with `data-scriptoscope-control="off"`). The native input is hidden in place — form values, events, accessibility all preserved.

**Runtime theme switching**: any `<select data-scriptoscope-theme-switcher>` re-skins every window + control live, the Kaleidoscope way.

**Gestures**: drag the title bar (or any frame edge for side-titled palettes); drag the gripper to resize; click the **collapse** box or **double-click** the title bar to window-shade; click the **zoom** box to grow-to-fit; click a window to focus it.

Full design + the feature-rich pass: [`docs/superpowers/specs/2026-05-27-declarative-windows-design.md`](./docs/superpowers/specs/2026-05-27-declarative-windows-design.md). Live: <https://khawkins98.github.io/aaron-ui/>.

### Bring your own theme (in-browser conversion)

Beyond the bundled corpus, the demo has a **drop-zone**: drag a Kaleidoscope theme file onto the page and it's decoded and rendered entirely client-side — no build step, no upload. Accepted inputs: a StuffIt `.sit` archive, a `.hqx` / MacBinary / AppleSingle·Double wrapper, or a raw `.rsrc` resource fork. The conversion runs through [`tools/theme-loader/loadKaleidoscopeScheme.js`](./tools/theme-loader/loadKaleidoscopeScheme.js); StuffIt is decoded by [`tools/sit-wasm/`](./tools/sit-wasm/) (the munbox C library compiled to WebAssembly — a self-contained, MIT, in-browser StuffIt decoder). Design + status: [`docs/superpowers/specs/2026-05-27-browser-conversion-design.md`](./docs/superpowers/specs/2026-05-27-browser-conversion-design.md); design context: [`docs/archive/byo-theme-todo.md`](./docs/archive/byo-theme-todo.md) (work completed 2026-05-27, archived as the planning record).

## Documents

- **[`docs/history.md`](./docs/history.md)** — the full project arc (v1 → v2 clean-break → v3 part-code reset) and the "Dead ends — don't relitigate these" list. Start here.
- **[`docs/spec/README.md`](./docs/spec/README.md)** — the **index** of every primary-source decode under `docs/spec/` (the citation chain: corpus → Scheme Factory → Apple → kDEF 2.3.1 → kDEF 1.8.2). First stop when chasing "what does id/field/address X mean?". The spec tree has grown to 30+ docs and this index is kept current.
- **[`docs/spec/kdef-architecture.md`](./docs/spec/kdef-architecture.md)** — the runtime architecture tour: the subsystems, the compose pipeline, and how a `wnd#` recipe maps to a drawn window. Read this for **"how does it work?"**
- **[`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md)** — the current window-chrome model (the implemented spec).
- **[`docs/spec/kdef231-reference.md`](./docs/spec/kdef231-reference.md)** — the standing Kaleidoscope **2.3.1** kDEF reference: a lookup rubric of every routine address, resource id, struct offset, and coordinate mapping. The first stop for **"where is X?"**; it indexes the architecture tour, the compositor spec, the recipe-walk, and the faithfulness ledger.
- **[`docs/superpowers/specs/2026-05-27-declarative-windows-design.md`](./docs/superpowers/specs/2026-05-27-declarative-windows-design.md)** — design + multi-night build log for the declarative (`data-scriptoscope-*`) front door: the attribute contract, the feature-rich pass (window-shade, zoom, themed scrollbars, runtime theme-switch, themed controls), the OS 8.6 desktop redesign, the review-driven hardening, and the known follow-ups. Read this when extending the declarative layer.
- **[`PRD.md`](./PRD.md)** — the original product charter (vision still largely valid; implementation has since moved on — see `docs/history.md`).
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — how to land changes and port a scheme.
- **[`LEARNINGS.md`](./LEARNINGS.md)** — running log of gotchas and decisions, populated as we build.

## North Star

A web window manager that **any** project — built with any framework, or no framework at all — can drop in by adding **data attributes to plain HTML**, and that ships a **Kaleidoscope-style theme engine** capable of loading freeware-licensed period theme bundles and rendering them faithfully on the modern web.

The declarative front door (principle 2 below) is **now built** — `mountDeclarative()` + the `data-scriptoscope-*` contract, with the demo pages exercising it (see "Trying it" above). Three principles do the load-bearing work:

1. **Framework-agnostic by default.** No React peer dep, no Vue plugin, no Solid integration layer. Scriptoscope is plain TypeScript + CSS that works wherever HTML works — vanilla DOM, htmx, server-rendered Rails/Django/Laravel, every JS framework, and a `<script>` tag on a static page.

2. **Declarative-first integration via data attributes.** The primary integration path is markup-only: add `data-scriptoscope-window` (with `data-scriptoscope-title`, `data-scriptoscope-x`, etc.) to any element and Scriptoscope promotes it into a draggable window on load. Native form controls inside (`<button data-scriptoscope-button>`, `<input type=checkbox|radio|range>`) are auto-skinned to the current theme while staying real accessible inputs. An imperative `mountDeclarative()` exists for dynamic cases, but no one should *need* to write more than one bootstrap line to use the library. CSS class hooks (`.scriptoscope-window-fallback`, etc.) are accepted as a fallback for environments where data attributes are awkward. See the full attribute contract in "The runtime API → Declarative" above.

3. **A Kaleidoscope-compatibility runtime, clean-room from Kaleidoscope's code.** Scriptoscope is a *runtime for an existing corpus*, not a new theme-authoring project. It reads Kaleidoscope resource bundles (`cicn`, `ppat`, `cinf`, `wnd#`, `Colr`) directly — decoded by [`tools/theme-loader/`](./tools/theme-loader/) via [`scripts/extract-scheme.mjs`](./scripts/extract-scheme.mjs) — and re-implements the rendering entirely in our own compositor (see [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md)). The corpus is the community-authored schemes archived on [Macintosh Garden](https://macintoshgarden.org/apps/kaleidoscope) and [Mac Themes Garden](https://macthemes.garden/), prioritizing those with explicit freeware-with-redistribution readmes. **We extract compiled assets from individual schemes** (with the author's stated permission) and **re-implement the rendering entirely in our own code** — Scriptoscope never uses Kaleidoscope's source code. Apple's own themes (Hi-Tech, Drawing Board, Gizmo) are deliberately out of scope, and **Scriptoscope does not hand-author chrome from the HIG** — it renders whatever scheme is loaded. Every extracted theme bundle carries provenance metadata (original author, source URL, license-of-origin); the only first-party visual artifacts Scriptoscope produces are the un-themed engine fallbacks needed when no scheme has loaded yet.

> *Name note:* "Scriptoscope" = JavaScript ("Script") × the instrument-suffix family of names ("-oscope" — the instrument you look through to see classic Mac themes rendered on the modern web). Renamed 2026-05-28 from Aaron UI; the prior name was a deep-cut nod to *Aaron*, Apple's internal codename for the Copland-era Appearance Manager demo, but the etymology got loose after the project pivoted to a Kaleidoscope-compatibility runtime. Full rationale in [`LEARNINGS.md`](./LEARNINGS.md). The consumer-facing API surface is `data-scriptoscope-*` attributes, `.scriptoscope-*` CSS classes, and the `ScriptoscopeWindow` class (swept 2026-05-29 from the original `data-aaron-*`/.aw-/AaronWindow naming).

## Where the idea came from

The proximate origin is the [classic-vibe-mac](https://github.com/khawkins98/classic-vibe-mac) project — a System 7.5.5 emulator + in-browser C compiler running in a tab. cv-mac built a Mac OS 8 Platinum chrome layer on top of WinBox over several months and eventually hit a ceiling: roughly 70% of the Platinum gap was CSS work in cv-mac's own court, ~15% could be closed by a thin shell layer, but ~30% of the remaining authenticity was structural to WinBox itself (fixed DOM hierarchy, scrollbars-inside-body geometry, no slot for windowshade arrow or status bar, drag with web-style acceleration). The honest move was to own the window manager.

The deeper origin is a recurring frustration across earlier "give a modern web utility a classic-OS look" experiments:

- [**PDF-A-go-actionable**](https://github.com/khawkins98/PDF-A-go-actionable#visual-design) — a NeXTSTEP-styled PDF utility. The visual-design notes catalogue the by-hand CSS work it took to *approximate* NeXT chrome, and how quickly the result diverges from the real thing once you look closely.
- [**PDF-A-go-slim**](https://github.com/khawkins98/PDF-A-go-slim#why-it-looks-like-that) — same impulse, classic-Mac flavour, same conclusion in its "why it looks like that" section: hand-authored chrome is tedious to build, never quite right, and rots whenever you reach for a control you haven't yet drawn.
- [**The 90s desktop paradigm for browser utilities**](https://www.allaboutken.com/posts/20260216-90s-desktop-paradigm-browser-utilities/) — the longer essay that pulls those experiments together: a web utility *as a windowed desktop app* is a richer, more legible UX than a single-flow webpage, but only if the chrome is authentic — and authentic chrome is something you *render from the original art*, not something you re-draw in CSS.

Scriptoscope is the answer to that recurring frustration. Read the OS's own resource files, render them faithfully once, and every utility downstream gets the look for free — no per-project CSS Platinum, no per-project drift.

The full extraction context, decision trail, and naming rationale for the cv-mac side are in the upstream charter ticket:

- **[classic-vibe-mac #246](https://github.com/khawkins98/classic-vibe-mac/issues/246)** — PRD: Scriptoscope — Mac OS Appearance-style window manager + theme engine for the web

For the visual specification Scriptoscope's default Platinum theme must achieve, see:

- **[classic-vibe-mac #229](https://github.com/khawkins98/classic-vibe-mac/issues/229)** — Platinum chrome accuracy pass with concrete Mac OS 8 references

The primary reference for any visual question is Apple's own Mac OS 8 Human Interface Guidelines:

- <https://dev.os9.ca/techpubs/mac/HIGOS8Guide/thig-82.html>

## What this isn't

- An emulator. cv-mac has one.
- A full AppKit / Carbon reproduction.
- A mobile-first toolkit. This is desktop windowing.

## A heads-up on hover

Mac OS 8 chrome had exactly three control states: **Normal, Pressed, Disabled**. There was no "hover" — that's a post-OS X / web-era concept. Kaleidoscope schemes ship `cicn` artwork only for those three states, so Scriptoscope renders them faithfully: pointing at a close box looks the same as pointing anywhere else. If that surprises modern-web reflexes, it's intentional and authentic. A light, opt-in hover affordance may land in a later phase for ergonomic / accessibility cases; it'll never be on by default. See [`LEARNINGS.md`](./LEARNINGS.md) for the full reasoning.

## What loaded themes carry (and don't)

Scriptoscope loads what Kaleidoscope schemes actually shipped: **chrome + controls + colors.** Empirically, after deconstructing the corpus, almost no Kaleidoscope scheme carried sounds, desktop backgrounds, or fonts — the OS supplied those. Scriptoscope doesn't fabricate them. (The one font the OS *would* have supplied — Charcoal, for window titles — the demo provides as a license-clean stand-in: Jeremy Sachs' CC BY-SA "Charcoal 12" bitmap, with Marty Pfeiffer's free "Virtue" as fallback, and `local('Charcoal')` preferred when installed. Schemes still bring no fonts of their own.)

If a consumer wants period sounds or a desktop picture alongside a loaded scheme, that's a host-page concern: drop in your own `<audio>` and CSS `background-image`. Scriptoscope may eventually add an opt-in `extras/` sidecar concept for bundling sounds with a scheme bundle, but it's not a runtime built-in — and there is no "first-party preset theme that ships sounds." Every theme Scriptoscope ships is a port of an existing Kaleidoscope scheme with the original author's attribution.

## Roadmap — ideas if this project gets traction

A non-binding "things that would be cool to build next" list, organized by theme. Each item links to an existing tracker if one is open. If you want to push any of these forward, open an issue or PR.

### Themes — bring more in, surface what they ship

- **Mac OS Appearance Manager theme import (.afm / kTHM)** — currently out of scope by deliberate decision ([#174](https://github.com/khawkins98/aaron-ui/issues/174) closed `wontfix`; the user-side `.afm` → `.rsrc` conversion path is documented at [`docs/converting-from-afm.md`](./docs/converting-from-afm.md)). If trademark posture changes, [#176](https://github.com/khawkins98/aaron-ui/issues/176) tracks the positive-side conversion-tooling roadmap (Tier 1: worked docs; Tier 2: Node CLI converter; Tier 3: standalone npm package; Tier 4: drop-zone integration).
- **Theme variants / accents** — some Kaleidoscope schemes ship multiple palettes in one `.ksc` (day/night, gold/silver/copper, B/W vs colour). Currently we extract one variant deterministically. Whether they become theme **siblings** (separate slugs) or a runtime **knob** (`LoadedTheme.variant`) is an open design call. Tracked in [#177](https://github.com/khawkins98/aaron-ui/issues/177).
- **Bonus assets in scheme bundles** — schemes routinely ship more than chrome: desktop patterns (`crayon-os`'s "Crayon OS Desktop"), bitmap fonts (`apple-lisa`'s Lisa Classic 12 / Icon Names 10), custom cursors (`slimes`' Slime cursor), zip icon overlays, HTML readmes with embedded GIFs, custom Finder icons. Currently silently discarded. [#177](https://github.com/khawkins98/aaron-ui/issues/177) tracks per-asset-type wiring.

### Renderer — richer chrome + state coverage

- **Better icon coverage** — `icl`/`ics` icon families (Finder/system icons) extract cleanly today (4-bit + 8-bit), but the runtime renders only what a window needs. A page-level "show me every icon the loaded scheme ships" view would let consumers browse and pick by name. Also: small `icm#` mini-icons (`apple-lisa` ships 33 of them) and `cicn` icons in id ranges -3800..-20800 aren't wired everywhere they could be.
- **Better body backgrounds** — `bodyBackground` ppat tiling is shipped per-scheme (some ship one, some don't). Per-window-type backgrounds work in principle (the `cinf.bgPatternId` decode is wired) but no corpus scheme exercises them yet. Worth surfacing as a configurable knob: "use the scheme's background everywhere / only in document windows / override with a CSS value."
- **Navigation bars + menu bar chrome** — Kaleidoscope schemes ship menubar background + highlight cicns at `-12272/-12287/-12288` and accent-menu families at `-12256+`. The corpus has these but the runtime doesn't compose them yet ([#166](https://github.com/khawkins98/aaron-ui/issues/166) tracks the menu/popup API design — alpha-deferred).
- **Sound packs** — schemes occasionally ship `snd ` (system-7 sound) resources. Out of corpus norm but interesting if a consumer wanted period-correct beep/click/drag audio.
- **State-rich slot vocabulary** — current schema knows `active|inactive|collapsed-active|collapsed-inactive`. The catalog defines additional states (pressed/disabled/normal/empty/small × N) that schemes ship for richer control vocabularies. [#178](https://github.com/khawkins98/aaron-ui/issues/178) item 12.

### Discovery — find themes without leaving the project

- **In-browser theme browsing + remix** — pair the existing drop-zone with a curated gallery sourced from the community archives (see the "Want more?" block above). Drag any `.sit` from a Mac Themes Garden listing into Scriptoscope's demo and see it render live; save a favorites set; flip between them with the existing theme switcher.
- **A Kaleidoscope-like configuration panel** — Scriptoscope's drop-zone is a thin echo of Kaleidoscope's own control panel. A consumer-side config UI that lets the user toggle desktop pattern / sounds / extras / accent variant per-scheme (the same checkboxes Kaleidoscope's CP shipped) is the natural next step.
- **CDN-delivered sprites** — for the published npm package, themes are loaded from a base URL the consumer hosts. A community-run sprite CDN (`https://themes.scriptoscope.dev/<slug>/`) would let consumers point at it without hosting the bundles themselves. Per-bundle sprites could be served as compact atlas PNGs to cut round-trips.
- **Theme curator / submission flow** — once the corpus grows beyond what we want to bundle in-repo, a community submission flow (`scriptoscope-themes` repo + a contributor guide) would scale better than hand-curated additions.

### Adopter-facing extras

- **`<scriptoscope-window>` Custom Element** alongside the data-attribute scanner ([#29](https://github.com/khawkins98/aaron-ui/issues/29) — open decision).
- ~~**CSS `border-image` emitter** for the body-frame chrome~~ — **retired 2026-05-28** after three spike rounds couldn't reach fidelity on exotic schemes (BeOS asymmetric title bar, evolution, etc.). The architecture is now explicitly "DOM structure + canvas decoration" — see [`docs/adr/0001-consumption-architecture.md`](./docs/adr/0001-consumption-architecture.md) §Spike result.
- **Visual regression suite** — Playwright snapshots of each control state, cross-referenced against the per-theme reference renders (`demo/assets/references/<slug>.png`). [#79](https://github.com/khawkins98/aaron-ui/issues/79) closed but the framework would live here.
- **High-contrast / accessibility variants** — auto-generate a high-contrast pair from each scheme (override headerColors, force pinstripe density) so accessibility-mode users can still pick a theme they like.
- **VS Code / editor theme generation** — export a scheme's palette + chrome accents as a `vscode-theme.json` so developers can match their editor to their windowing chrome.
- **Period-correct animation polish** — zoom-to-icon close, windowshade collapse, sheet slide-in. Tracked under [#25](https://github.com/khawkins98/aaron-ui/issues/25) Phase 6.
- **cv-mac integration** — the upstream project this was extracted from. WinBox swap one PR away once the API stabilizes; [#27](https://github.com/khawkins98/aaron-ui/issues/27).

Tracker issues for new ideas: <https://github.com/khawkins98/aaron-ui/issues/new>.

## License

**Scriptoscope's own code is [MIT](./LICENSE)** (best for adoption — the library is meant to be embedded in other projects). The bundled third-party material keeps its own terms and is **not** relicensed:

- **`themes/<slug>/`** — assets extracted from community-authored Kaleidoscope schemes, redistributed under each original author's freeware-with-redistribution terms. Provenance is in every bundle's `meta.json` (`origin.originalLicense`, `sourceUrl`) and `PROVENANCE.md`.
- **`tools/sit-wasm/munbox/`** — a vendored subset of [munbox](https://github.com/idolpx/munbox) (MIT); see `tools/sit-wasm/munbox/LICENSE` and `PATCHES.md`.
- **`demo/assets/fonts/`** — Charcoal 12 (Jeremy Sachs, CC BY-SA) and Virtue (Marty Pfeiffer, free-with-credit); see the license files alongside them.

The standalone StuffIt decoder, [`tools/sit-wasm/`](./tools/sit-wasm/), carries its own MIT `LICENSE` so it stays self-contained if extracted.
