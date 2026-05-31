# Scriptoscope

A web-native re-implementation of Apple's Mac OS 8 [Appearance Manager](https://developer.apple.com/library/archive/documentation/Carbon/Reference/Appearance_Manager/index.html). Period Mac window-types (`kThemeDocumentWindow`, `kThemeUtilityWindow`, `kThemeMovableModalWindow`) are HTML attributes; the chrome paints into a `<canvas>` from the original `cicn` / `ppat` / `Colr` resources the [Kaleidoscope](https://en.wikipedia.org/wiki/Kaleidoscope_(software)) control panel read in 1998. Eighteen vintage schemes ship as evidence — running in a browser tab twenty-five years too late.

[Kaleidoscope](https://en.wikipedia.org/wiki/Kaleidoscope_(software)) was a classic Mac OS themer many of us remember fondly. Greg Landweber and Arlo Rose wrote it, and a community of authors filled it out with 4,400-plus schemes from 900-plus people, preserved today by [Mac Themes Garden](https://macthemes.garden/) and the [Kaleidoscope Scheme Archive](https://kaleidoscope.hryjksn.com/). Then OS X arrived in 2001 and the whole format went quiet.

There was hope for a while that Kaleidoscope might survive into the OS X era — but the refactor was enormous, and OS X's own theming layer was never as stable as classic Mac OS had been. The various third-party attempts that did ship (ShapeShifter, Magnifique, et al.) had a reputation for corrupting installs more often than they worked. A few macOS versions later, the platform was locked down enough that no third-party chrome layer could ever ship again.

Decades on, the schemes are remembered with nostalgia but largely unreachable — the only way to actually see them is through period Macintosh emulators, fun for archaeology but hardly practical. What if, through the beauty of JavaScript and a `<canvas>`, we could just apply them to our websites?

If you're in that very small Venn diagram overlap, behold: Scriptoscope is a compatibility layer that reads those same scheme files — the actual `.sit` and `.rsrc` bundles people made in the nineties — and paints them onto your webpage. Same color icons, same window frames, same fill patterns. Your HTML stays live underneath; only the skin is canvas.

A Kaleidoscope scheme is a [Mac resource fork](https://en.wikipedia.org/wiki/Resource_fork): a little database of typed records authored against a system that stopped shipping in 2001. So Scriptoscope reads one the way the old Finder did. Drop a scheme on the page, and it unpacks the archive, walks the resource map, pulls each record into memory, and hands the lot to a `<canvas>` renderer that speaks the same scheme format the original control panel did. *(That renderer is a spec-compatible reimplementation of the 2.3.1 engine; the divergences are logged in [the ledger](./docs/spec/kdef-faithfulness-ledger.md) if you care.)* All of it runs in the tab. Nothing's uploaded, and a refresh throws the bytes away.

To skin your own page, tag an element for what it is — window, button, slider — add one script tag, and it wears the current scheme. No framework, no build step. The children stay real HTML; only the chrome is painted.

Why? No good reason. Kaleidoscope lost to OS X a quarter-century ago and the world was right to move on. I rebuilt the rendering layer anyway, so eighteen schemes by people who mostly stopped making them in 2002 could run in a browser tab. This is a deeply silly use of anyone's time, including yours. If you're unhinged enough to ship it on a real website, [I genuinely want to hear about it](https://github.com/khawkins98/scriptoscope/issues). And if you ever wrote a Kaleidoscope scheme, [the door's open](#if-you-build-a-scheme).

Building it has been an interesting endeavor — a real education in how Kaleidoscope's theming actually worked, and how Mac OS theming worked more generally. It also led me into some fun side quests, like extracting `.sit` files inside the browser.

> *P.S. The project was originally **Aaron UI** — **Aaron** was Landweber's earlier extension, the one that faked the Mac OS 8 Platinum look on System 7 before Kaleidoscope existed. Three people would have caught that. Hello, three people. Renamed to Scriptoscope 2026-05-28 once the project pivoted to a Kaleidoscope-compatibility runtime + the etymology stopped paying rent.*

**A note on authorship.** I've tried to contact the original Kaleidoscope authors (Greg Landweber, Arlo Rose, and a handful of scheme authors I could find addresses for) about this project, and haven't heard back. Most of the addresses I could find are decades old. **If you can put me in touch with any of them, or if you ARE one of them reading this, please email me: <khawkins98@gmail.com>.**

**The legal posture.** Two distinct things, with different frames.

The runtime is a clean-room reimplementation of the scheme-rendering interpreter, written from the decompiled 2.3.1 kDEF used only as a test oracle. No original Kaleidoscope code ships or executes. This is the same posture every modern emulator operates under; the canonical precedent is [*Sony v. Connectix* (2000)](https://en.wikipedia.org/wiki/Sony_Computer_Entertainment,_Inc._v._Connectix_Corp.), where the Ninth Circuit held that clean-room reverse engineering of the PlayStation BIOS for compatibility was fair use. Sega v. Accolade (1992) is the older relative on the same principle.

The bundled scheme files in `themes/` are a separate matter: third-party freeware from the 1990s whose authors are largely unreachable today. Scriptoscope ships them under the same good-faith preservation posture [Macintosh Garden](https://macintoshgarden.org/) and the [Internet Archive's classic-software collection](https://archive.org/details/softwarelibrary_apple) use for orphan classic-software, including the take-down-on-request commitment. This project is a hobby, MIT-licensed, no profit motive, no advertising. If any of the original authors object, I'll take it down.

**Beyond the legal questions:** this is really a technical curiosity, a way to bring back to life a corner of computing that's effectively dead and bit-rotting. The corpus is closed because the tools closed; nobody's authored a new Kaleidoscope scheme in roughly twenty years. Maybe someone will be crazy enough to code up a new one. If you do, [the door's open](#if-you-build-a-scheme).

The current corpus of bundles lives under [`themes/`](./themes/): `1138`, `1984`, `1990`, `animals`, `apple-lisa`, `apple-platinum-2`, `beos-r503`, `black-platinum`, `crayon-os`, `dolphin-som`, `evolution`, `floppies`, `monkey-paradise`, `platinum-8`, `slimes`, `system7-nostalgia-silver`, `windows-31`, `windows-95`. Each bundle ships only the original archive (`scheme.sit` or `scheme.rsrc`) + `meta.json` + `PROVENANCE.md` — the runtime decodes them client-side, no pre-extraction in git.

Want more? Two community archives where Scriptoscope's drop-zone can read schemes from directly:
- **[Mac Themes Garden](https://macthemes.garden/)** — a beautifully curated gallery + archive with reference renders and the original `.sit` downloads. The 2026-05-28 corpus additions came from here.
- **[Kaleidoscope Scheme Archive (kaleidoscope.hryjksn.com)](https://kaleidoscope.hryjksn.com/)** — a community-maintained archive of 3000+ schemes, with hash-stamped reference renders. The largest corpus available; the initial bundled schemes were ported from here.

Both let you grab a `.sit` and drop it on the demo to see it render live without a build step.

> **Status (pre-1.0, 2026-05-29):** prototype mode. Two public surfaces are in: the **imperative runtime** (`loadTheme()` / `renderWindow()` in [`src/index.ts`](./src/index.ts)) and the **declarative front door** (`mountDeclarative()` + `data-scriptoscope-*` in [`src/declarative/index.ts`](./src/declarative/index.ts)) — both exercised by the demo pages below. The chrome renderer is rebuilt around Kaleidoscope's own part-code model and validated against the decompiled 2.3.1 kDEF. See [`docs/history.md`](./docs/history.md) for the project arc (and the "Dead ends — don't relitigate these" list — read it first), [`docs/superpowers/specs/2026-05-27-declarative-windows-design.md`](./docs/superpowers/specs/2026-05-27-declarative-windows-design.md) for the declarative layer's design, and [`LEARNINGS.md`](./LEARNINGS.md) for the Aaron UI → Scriptoscope rebrand (2026-05-28) + the full `data-scriptoscope-*` sweep (2026-05-29 — the Lodash-kept-`_` argument didn't survive the first integration guide). Live demo: <https://khawkins98.github.io/scriptoscope/>.

## If you build a scheme

The original tooling — Greg Landweber and Arlo Rose's Kaleidoscope.app, Edwin Wong's Scheme Factory, the various ResEdit templates that floated around Info-Mac — is gone, or close enough. But the *format* isn't. Scriptoscope reads the same `cicn` / `wnd#` / `cinf` / `ppat` / `Colr` records the 1999 control panel did, so a scheme authored today against this runtime will render the same way an Erik Ekengren scheme from 1998 does.

Nobody's authored a new Kaleidoscope scheme in roughly twenty years. The corpus is closed because the tools closed, not because the form ran out. If you want to be the one who reopens it, I'd love to help — [file an issue](https://github.com/khawkins98/scriptoscope/issues), mail me a `.rsrc`, draw a single button cicn and see what happens. The renderer doesn't know what year it is.

## Install

Scriptoscope is a hobby project — there's no npm package. The runtime + the 18 themes are hosted on the project's own GitHub Pages and that **is** the install path. Two URLs, no build step:

```html
<link rel="stylesheet" href="https://khawkins98.github.io/scriptoscope/scriptoscope.css">
<script type="module">
  import { mountDeclarative } from 'https://khawkins98.github.io/scriptoscope/scriptoscope.js';
  await mountDeclarative({
    themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes',
    pageThemeDefault: '1138',
  });
</script>
```

If you'd prefer to vendor it (no third-party CDN dependency), grab `dist/scriptoscope.js` (~220 KB raw / 66 KB gzip), `dist/scriptoscope.css` (~13 KB / 5 KB gzip), and the `themes/` directory from this repo, and host them yourself.

## Five-minute setup

A more complete page with the script wired in, one window, and a button:

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

  <!-- 3. Bootstrap. mountDeclarative() scans the page once, then watches
       MutationObserver-style for new data-scriptoscope-* elements. -->
  <script type="module">
    import { mountDeclarative } from 'https://khawkins98.github.io/scriptoscope/scriptoscope.js';
    await mountDeclarative({
      themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes',
      pageThemeDefault: '1138',
    });
  </script>

</body>
</html>
```

**That's it.** The bundled themes (`1138`, `beos-r503`, `apple-platinum-2`, `crayon-os`, `windows-95`, etc. — see [`themes/`](./themes/)) are served from the same URL, so `themeBaseUrl` resolves them transparently.

### Three things to know up front

If you only need it to work, you can skip this section. If something looks slightly off after you've dropped Scriptoscope on your page, one of these is probably why:

1. **Your element stays where you put it.** No `-x`/`-y` attributes = the runtime host sits in normal flow at the source element's DOM position (CSS Grid / Flex / normal flow all respected). Set `data-scriptoscope-x="N"` / `-y="N"` (px only, no `%` / `em` / `vh`) to opt into a floating overlay. Dragging an in-flow window converts it to a floater on the first drag.
2. **Your `.my-class { display: grid }` won't reach the host.** Ten CSS properties (`display`, `box-sizing`, `padding`, `border`, `background`, `overflow`, `margin`, `transform`, `filter`, `contain`) are locked down inline on the runtime host so consumer-class CSS can't break the host ↔ chrome-canvas correspondence. Everything else — color, font, custom properties, your `position: relative` for stacking — still applies.
3. **Promotion is destructive.** The runtime moves your element's children into its slot and removes the original element. Framework refs to the wrapper become detached. Mount Scriptoscope AFTER your framework's first paint (`useEffect(() => mountDeclarative(...), [])` in React; `onMounted` in Vue).

The full set of behaviours, with the gotchas + framework integration notes + known incompatibilities ([`* { transform: translateZ(0) }`, `box-sizing: content-box`, `body { overflow: hidden }`, etc.), lives in **[docs/integration-edge-cases.md](./docs/integration-edge-cases.md)**. Open it when you hit a weird CSS issue and the cause isn't obvious; you don't need to read it first.

#### Available theme slugs

The live list (with display labels and reference renders) is served at <https://khawkins98.github.io/scriptoscope/themes-manifest.json> and rendered visually at <https://khawkins98.github.io/scriptoscope/> (the demo page's theme switcher). Current bundled corpus:

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
| `data-scriptoscope-window-type="…"` | a window | One of: `document-window`, `dialog`, `alert`, `movable-modal`, `movable-alert`, `titled-utility-window`, `side-floating-utility-window`, `no-title-utility-window`, `popup-window`, plus boot-shaded variants `collapsed-document-window`, `collapsed-titled-utility`, `collapsed-side-utility`, `collapsed-no-title-utility` (most schemes ship art for `collapsed-document-window` only; double-click any window's title at runtime to shade regardless of boot-type). Default: `document-window`. |
| `data-scriptoscope-x="…"` / `data-scriptoscope-y="…"` | a window | Initial position (px), relative to the nearest positioned ancestor. **Setting either flips the host to `position: absolute`** — the opt-in to the floater posture (overlays, desktop scatters, palettes). When BOTH are omitted, the host stays in flow at the source element's DOM position — `getBoundingClientRect` is never consulted for layout; the browser places it natively. The cascade fallback (`24+26·n`, `24+26·n`) applies only on this absolute path when the source element has no bounding rect (e.g. `display:none` at promotion time). |
| `data-scriptoscope-width="…"` / `data-scriptoscope-height="…"` | a window | **Absolute** declared size in px. **Optional** — omitted values inherit the element's currently-rendered width/height (one-shot capture). When declared, the size is fixed: the auto-resize observer is suppressed for that dimension. Use for overlay-style windows that should be a specific size regardless of where the source element sits in the DOM. |
| `data-scriptoscope-extra-width="…"` / `data-scriptoscope-extra-height="…"` | a window | **Additive** padding (in px) on the auto-captured natural rect — pre-reserves space for content that will grow after promote. **Mutually exclusive** with `data-scriptoscope-width` / `-height` (ignored when the absolute form is set). Use case: a theme-picker whose tile children are populated by the runtime itself; without `extra-height`, the chrome boots at the empty-strip size and momentarily shows nested scrollbars until the auto-resize observer catches up. Setting `extra-height` synchronously reserves the space and avoids the visual pop. (The runtime ALSO auto-resizes via `ResizeObserver` regardless — `extra-*` is the synchronous version that skips the pop.) |
| `data-scriptoscope-state="active"` or `"inactive"` | a window | Initial focus state. Default `active` for first window, `inactive` after. |
| `data-scriptoscope-z="…"` | a window | Initial stacking order. Higher = on top. |
| `data-scriptoscope-collapsed` | a window | Boot pre-shaded (just title bar visible). Double-click the title to toggle at runtime. |
| `data-scriptoscope-widgets` | a window | Comma-separated subset of `close,zoom,collapse` whose click handlers wire up. Omitted widgets are still painted by the cicn art (we don't paint over chrome) but clicking does nothing. Default (attribute absent): every widget the type supports is wired. The demo uses `document-window` + `widgets="zoom,collapse"` for both the Read Me and the Schemes Folder — page-essential content, not dismissible. `widgets=""` makes every painted widget inert. |
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
| `data-scriptoscope-theme-picker` | a `<div>` | Promote into a folder-strip theme switcher. The runtime auto-populates one tile per entry in `mountOptions.themes` (icon + name + author/year). Full ARIA tab pattern + keyboard nav; clicking a tile calls `handle.retheme(slug)` internally. |
| `data-scriptoscope-cascade` | a container `<div>` | Mac-OS-classic "newly-opened windows cascade" layout for the descendant `data-scriptoscope-window` elements. Each window flips to `position: absolute` at a cumulative offset from the container's top-left; later windows sit on top in z-order. Defaults: 32px right + 28px down per window. Override via `data-scriptoscope-cascade-step-x="N"` / `-step-y="N"` / `-base-x="N"` / `-base-y="N"` on the same container. Per-window `data-scriptoscope-x` / `-y` always wins; cascade skips windows that have either. One-shot at mount; after drag or resize, the window owns its position. The consumer-friendly answer to "I want a bunch of windows to scatter like a real desktop without hand-writing position math." |
| `data-scriptoscope-icon="<name>"` | `<img>` or `<span>` | Render a scheme-resolved Finder icon by named key (`folder`, `system-folder`, `document`, `prefs`, etc.). Re-resolves on every retheme so the icon follows the active scheme. |
| `data-scriptoscope-icon-id="<id>"` | `<img>` or `<span>` | Raw Apple resource id (e.g. `-3999`) — bypasses the named-key lookup for power users. |

### `mountDeclarative()` options

```ts
await mountDeclarative({
  themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes', // where bundles live
  pageThemeDefault: '1138',         // theme slug or URL for windows w/o explicit data-scriptoscope-theme
  persistKey: 'my-app-layout',      // optional: save window positions to localStorage.scriptoscope:layout:<key>
  baseSlug: 'apple-platinum-2',     // optional: base scheme to inherit from (any slug in your themeBaseUrl)
  root: document,                   // optional: scan a subtree instead of the whole page
  themes: THEMES,                   // optional: catalog for <div data-scriptoscope-theme-picker> tiles + autoCycle.
                                    //   ThemeEntry[] — { slug, name?, author?, year?, source? }. Imported from
                                    //   your themes-manifest.json or hand-built. (Pre-2026-05 manifests used a
                                    //   combined `label` field; still accepted as a fallback if `name` is absent.)
  autoCycle: 4000,                  // optional: ms between picker auto-cycle steps (suppressed when
                                    //   syncToUrlParam restored a deep-link or first user interaction fired).
  syncToUrlParam: 'theme',          // optional: mirror current theme to ?theme=<slug>; restored on load.
                                    //   Makes the landing the shareable URL.
  rejectOnEmptyMount: true,         // optional: throw if scan found data-scriptoscope-* targets but
                                    //   ZERO promoted (catches theme-bundle 404s + decoder errors in one place).
  onPromoteError: (err, ctx) => {…},// optional: hook per-target promotion failures (vs the rejectOnEmpty above).
  bootAffordance: 'auto',           // optional: chrome wipe-in animation + boot-state CSS hook
                                    //   (data-scriptoscope-loading on the root + .scriptoscope-ready class
                                    //   on the root once promotion settles). 'auto' (default) picks per
                                    //   element; 'none' (alias false) suppresses entirely. Respects
                                    //   prefers-reduced-motion automatically.
});
```

The call returns a `MountHandle` which extends `EventTarget`. Full API:

```ts
const handle = await mountDeclarative({…});

// Event API — four events on the handle
handle.addEventListener('ready', (e) => { /* initial scan complete; e.detail.stats has counts */ });
handle.addEventListener('retheme', (e) => { /* theme just switched; e.detail.ref is the slug or URL */ });
handle.addEventListener('promoteError', (e) => { /* a promotion failed; e.detail = { kind, el, cause } */ });
handle.addEventListener('unmounted', () => { /* disconnect() finished */ });

// On the runtime-inserted HOST element (the original consumer element is removed
// at promote time — its children move into the host's slot). The event bubbles
// UP from the host, so listen on a stable ancestor of the source element's
// original position (document, document.body, your app root). Do NOT cache a
// ref to the original element and listen on it — it's detached by the time
// this fires.
document.body.addEventListener('scriptoscope:promoted', (e) => { /* e.detail = { kind: 'window', host } */ });

// On the runtime-inserted HOST element: bubbling + composed CustomEvents that cross
// the shadow boundary into your consumer wraps (modal overlays, etc.). Same listener
// rule as scriptoscope:promoted — listen on an ancestor, not the original element.
document.body.addEventListener('scriptoscope:close', (e) => { /* runtime is about to restore bare HTML */ });
document.body.addEventListener('scriptoscope:userresize', (e) => { /* user finished grow-box drag; e.detail = { w, h } */ });

// On the ORIGINAL consumer element (or any ancestor): a per-target failure event
// when promotion throws. Bubbles. Same shape as the handle's 'promoteError'.
document.body.addEventListener('scriptoscope:promoteError', (e) => { /* e.detail = { kind, el, cause } */ });

// Methods
handle.disconnect();                       // tear down observers + restore source elements
handle.retheme(slugOrUrl);                 // programmatic theme switch (fires the 'retheme' event)
handle.registerTheme(ref, loadedTheme);    // register a runtime-decoded theme (used by drop-zones)
handle.openModal(wrap, { returnFocusTo }); // themed modal helper: focus trap (including shadow-DOM chrome
                                           //   focusables), Esc, backdrop-click, listens for the inner
                                           //   window's scriptoscope:close. Toggles `data-scriptoscope-modal-open`
                                           //   on the wrap; your CSS scopes visibility off that attribute.
                                           //   Returns { close() }. Idempotent on the same wrap.

// Properties
handle.stats;  // { windows, buttons, controls, tabs, fields } — five numeric counts updated on each promote
```

The `promoteError` event is the per-target failure hook; pair with `rejectOnEmptyMount: true` for the "did everything fail" gate.

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

Two ways to wire it. The simpler one is a button or any element that doubles as a drop target:

```html
<button id="byo">📂 Drop or pick a theme</button>
<span id="byo-status" aria-live="polite"></span>

<script type="module">
  // mountDeclarative + attachThemeDropZone + loadKaleidoscopeScheme are all
  // exported from the same module entry. The GH Pages URL below is the install
  // path (no npm package — see the Install section above). The Kaleidoscope
  // decoder is bundled into the main module; StuffIt WASM lazy-loads only when
  // a .sit is decoded.
  import {
    mountDeclarative, attachThemeDropZone, loadKaleidoscopeScheme,
  } from 'https://khawkins98.github.io/scriptoscope/scriptoscope.js';

  const handle = await mountDeclarative({
    themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes',
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

**The richer pattern** (used by the demo's "Load your own" picker tile) opens a themed `movable-modal` window with the drop zone inside it. Use `handle.openModal(wrap, { returnFocusTo: triggerButton })` — the helper toggles `data-scriptoscope-modal-open` on the wrap (your CSS scopes off the attribute), traps focus inside (including the shadow-DOM chrome focusables), dismisses on Esc + backdrop click, and listens for the chrome's close widget via `scriptoscope:close`. The full markup is in [`demo/index.html`](./demo/index.html) (search for `powers-byo-modal-wrap`): a `position: fixed` wrap with `visibility: hidden; opacity: 0; pointer-events: none` until `[data-scriptoscope-modal-open]` flips them on, with a themed `<article data-scriptoscope-window data-scriptoscope-window-type="movable-modal">` inside.

### CDN paths reference

| URL | What |
|---|---|
| `https://khawkins98.github.io/scriptoscope/scriptoscope.js` | Runtime (ESM, ~220 KB raw / 66 KB gzip — includes the in-browser `.sit`/`.rsrc` decoder) |
| `https://khawkins98.github.io/scriptoscope/scriptoscope.css` | Optional outer-shell stylesheet (~13 KB raw / 5 KB gzip) |
| `https://khawkins98.github.io/scriptoscope/themes/<slug>/scheme.sit` (or `scheme.rsrc`) | The bundle's source archive — fetched + decoded client-side by `loadTheme()` |
| `https://khawkins98.github.io/scriptoscope/themes-manifest.json` | Catalog of every bundled slug (label, author, source filename, ref screenshot) |
| `https://khawkins98.github.io/scriptoscope/sit-wasm/munbox.wasm` | StuffIt unpack WASM (~70 KB, loaded lazily by the decoder only when a `.sit` is decoded) |

> **Heads-up:** the CDN URL points at a single-account GitHub Pages deploy tracking `main` — there's no versioned URL, no integrity hash, and no SLA. Fine for prototyping, hobby projects, and demos. If you're shipping to a real-traffic site, **vendor the files** (see below) at a commit you choose.

### Vendoring (if you don't want a third-party CDN dependency)

There's no npm package. If you'd rather not pin your site to this repo's GitHub Pages, vendor the files into your own build:

1. Grab `dist/scriptoscope.js` (~220 KB raw / 66 KB gzip), `dist/scriptoscope.css` (~13 KB / 5 KB gzip), and the `themes/` directory from this repo.
2. Host them alongside your site.
3. Point `themeBaseUrl` at wherever you put `themes/`.

Same import path either way (ESM module from a URL), no bundler required.

## Trying it locally

Three demo pages sit on the same runtime, each showing a different integration path. To hack on them locally, clone the repo and run the dev server:

```sh
git clone https://github.com/khawkins98/scriptoscope.git
cd scriptoscope
npm install        # dev dependencies (vite, tsc, playwright) — NOT the library itself
npm run dev        # http://localhost:5173/
```

- **[`demo/index.html`](./demo/index.html)** — the **landing page** (showcase, not a minimal copy-paste recipe — for that, see "Five-minute setup" above). The 1999-Apple-styled consumer pitch: "Eighteen schemes. One runtime." with a one-line install snippet, a hero control strip showing every promotable widget (button + checkbox + radio + slider + text + select) themed live, and an authentic-folder-icon theme picker (click a folder = wear that scheme) bracketed by two special tiles — **No theme** (⊘) unmounts the runtime to show the bare HTML; **Load your own** (↑) opens a themed `movable-modal` window with a drag-drop + file-picker for arbitrary `.sit` / `.rsrc` schemes. Four outcome-headlined cards ("One engine, eighteen looks" / "Bring your own scheme" / "data-scriptoscope-*" / "The Scheme Library" — chrome titlebars keep the architecture names `kDEF Replay Engine` / `ResourceForkLib` for tooling continuity) float as Mac windows. Re-skin from bare-HTML mode via the top-right "Restore the chrome ←" button.
- **[`demo/diagnostic.html`](./demo/diagnostic.html)** — the **runtime showcase + developer diagnostic**. Pick any scheme from the ribbon and get its scene + reference comparison, live themed controls, and an interactive playground (every window type at any size, plus live buttons / checkboxes / radios / sliders / scrollbars / title-bar widgets). A drop-zone decodes any `.sit` / `.hqx` / `.rsrc` Kaleidoscope archive entirely in the browser. The dev-facing inspectors (geometry, slice inspector, icon inventory, raster foldout, resource roles) live behind the **"Developer tools"** disclosure at the bottom of each scheme's section — open it manually or visit with `?dev=1` to default-open.
- **[`demo/declarative-hostile-css.html`](./demo/declarative-hostile-css.html)** — the **Shadow-DOM litmus test for ADR-0001 Decision 2**. A host page deliberately ships aggressive CSS (universal `!important` resets, opinionated `div`/`canvas`/`button` rules — the kind of thing a real CMS or third-party site does) to prove the chrome inside the shadow root survives unscathed. Slotted body content still picks up host styling (it stays in the light DOM by design); only the chrome is quarantined.

## The runtime API

Two surfaces, same engine.

### Imperative — `loadTheme()` + `renderWindow()`

A scheme bundle is a directory containing the **original Kaleidoscope archive** (`scheme.sit` preferred, `scheme.rsrc` fallback) plus `meta.json` + `PROVENANCE.md`. `loadTheme()` fetches the archive and decodes it in-browser via the bundled StuffIt + Kaleidoscope decoders; `renderWindow()` composites a window from the result. First per-bundle load is ~234 ms on a fast machine (browser decode + 500 OffscreenCanvas PNG encodes); subsequent calls hit the in-page cache.

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
    import { mountDeclarative } from 'https://khawkins98.github.io/scriptoscope/scriptoscope.js';
    await mountDeclarative({
      themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes',
      baseSlug: 'apple-platinum-2',
    });
  </script>
</body>
```

**Window attributes** (all `data-scriptoscope-*`): `window`, `title`, `window-type` (`document-window` / `movable-modal` / `dialog` / `titled-utility-window` / `side-floating-utility-window` / …), `x` / `y`, `width` / `height` (omit both → content-fit with a `ResizeObserver`), `state` (`active`/`inactive`), `z` (initial stacking order), `collapsed` (boot pre-shaded), `theme` (per-window scheme override, nearest-ancestor wins).

**Promoted children**: `<button data-scriptoscope-button>` (with `data-scriptoscope-default` for the OK ring), and `<input type=checkbox|radio|range>` are auto-promoted to themed art (opt-out per-input with `data-scriptoscope-control="off"`). The native input is hidden in place — form values, events, accessibility all preserved.

**Runtime theme switching**: any `<select data-scriptoscope-theme-switcher>` re-skins every window + control live, the Kaleidoscope way.

**Gestures**: drag the title bar (or any frame edge for side-titled palettes); drag the gripper to resize; click the **collapse** box or **double-click** the title bar to window-shade; click the **zoom** box to grow-to-fit; click a window to focus it.

Full design + the feature-rich pass: [`docs/superpowers/specs/2026-05-27-declarative-windows-design.md`](./docs/superpowers/specs/2026-05-27-declarative-windows-design.md). Live: <https://khawkins98.github.io/scriptoscope/>.

### Bring your own theme (in-browser conversion)

Beyond the bundled corpus, the demo has a **drop-zone**: drag a Kaleidoscope theme file onto the page and it's decoded and rendered entirely client-side — no build step, no upload. Accepted inputs: a StuffIt `.sit` archive, a `.hqx` / MacBinary / AppleSingle·Double wrapper, or a raw `.rsrc` resource fork. The conversion runs through [`tools/theme-loader/loadKaleidoscopeScheme.js`](./tools/theme-loader/loadKaleidoscopeScheme.js); StuffIt is decoded by [`tools/sit-wasm/`](./tools/sit-wasm/) (the munbox C library compiled to WebAssembly — a self-contained, MIT, in-browser StuffIt decoder). Design + status: [`docs/superpowers/specs/2026-05-27-browser-conversion-design.md`](./docs/superpowers/specs/2026-05-27-browser-conversion-design.md); design context: [`docs/archive/byo-theme-todo.md`](./docs/archive/byo-theme-todo.md) (work completed 2026-05-27, archived as the planning record).

## Documents

- **[`llms.txt`](./llms.txt)** ([live](https://khawkins98.github.io/scriptoscope/llms.txt)) — discovery file for LLM agents helping a consumer integrate. Curates pointers to README + integration docs + recipes + API surface so an agent has one canonical entry point. Follows the [llmstxt.org](https://llmstxt.org/) standard. Drop the live URL into your AI assistant's context if you're integrating Scriptoscope and want better answers.
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

- **Mac OS Appearance Manager theme import (.afm / kTHM)** — currently out of scope by deliberate decision ([#174](https://github.com/khawkins98/scriptoscope/issues/174) closed `wontfix`; the user-side `.afm` → `.rsrc` conversion path is documented at [`docs/converting-from-afm.md`](./docs/converting-from-afm.md)). If trademark posture changes, [#176](https://github.com/khawkins98/scriptoscope/issues/176) tracks the positive-side conversion-tooling roadmap (Tier 1: worked docs; Tier 2: Node CLI converter; Tier 3: standalone npm package; Tier 4: drop-zone integration).
- **Theme variants / accents** — some Kaleidoscope schemes ship multiple palettes in one `.ksc` (day/night, gold/silver/copper, B/W vs colour). Currently we extract one variant deterministically. Whether they become theme **siblings** (separate slugs) or a runtime **knob** (`LoadedTheme.variant`) is an open design call. Tracked in [#177](https://github.com/khawkins98/scriptoscope/issues/177).
- **Bonus assets in scheme bundles** — schemes routinely ship more than chrome: desktop patterns (`crayon-os`'s "Crayon OS Desktop"), bitmap fonts (`apple-lisa`'s Lisa Classic 12 / Icon Names 10), custom cursors (`slimes`' Slime cursor), zip icon overlays, HTML readmes with embedded GIFs, custom Finder icons. Currently silently discarded. [#177](https://github.com/khawkins98/scriptoscope/issues/177) tracks per-asset-type wiring.

### Renderer — richer chrome + state coverage

- **Better icon coverage** — `icl`/`ics` icon families (Finder/system icons) extract cleanly today (4-bit + 8-bit), but the runtime renders only what a window needs. A page-level "show me every icon the loaded scheme ships" view would let consumers browse and pick by name. Also: small `icm#` mini-icons (`apple-lisa` ships 33 of them) and `cicn` icons in id ranges -3800..-20800 aren't wired everywhere they could be.
- **Better body backgrounds** — `bodyBackground` ppat tiling is shipped per-scheme (some ship one, some don't). Per-window-type backgrounds work in principle (the `cinf.bgPatternId` decode is wired) but no corpus scheme exercises them yet. Worth surfacing as a configurable knob: "use the scheme's background everywhere / only in document windows / override with a CSS value."
- **Navigation bars + menu bar chrome** — Kaleidoscope schemes ship menubar background + highlight cicns at `-12272/-12287/-12288` and accent-menu families at `-12256+`. The corpus has these but the runtime doesn't compose them yet ([#166](https://github.com/khawkins98/scriptoscope/issues/166) tracks the menu/popup API design — alpha-deferred).
- **Sound packs** — schemes occasionally ship `snd ` (system-7 sound) resources. Out of corpus norm but interesting if a consumer wanted period-correct beep/click/drag audio.
- **State-rich slot vocabulary** — current schema knows `active|inactive|collapsed-active|collapsed-inactive`. The catalog defines additional states (pressed/disabled/normal/empty/small × N) that schemes ship for richer control vocabularies. [#178](https://github.com/khawkins98/scriptoscope/issues/178) item 12.

### Discovery — find themes without leaving the project

- **In-browser theme browsing + remix** — pair the existing drop-zone with a curated gallery sourced from the community archives (see the "Want more?" block above). Drag any `.sit` from a Mac Themes Garden listing into Scriptoscope's demo and see it render live; save a favorites set; flip between them with the existing theme switcher.
- **A Kaleidoscope-like configuration panel** — Scriptoscope's drop-zone is a thin echo of Kaleidoscope's own control panel. A consumer-side config UI that lets the user toggle desktop pattern / sounds / extras / accent variant per-scheme (the same checkboxes Kaleidoscope's CP shipped) is the natural next step.
- **CDN-delivered sprites** — for the published npm package, themes are loaded from a base URL the consumer hosts. A community-run sprite CDN (`https://themes.scriptoscope.dev/<slug>/`) would let consumers point at it without hosting the bundles themselves. Per-bundle sprites could be served as compact atlas PNGs to cut round-trips.
- **Theme curator / submission flow** — once the corpus grows beyond what we want to bundle in-repo, a community submission flow (`scriptoscope-themes` repo + a contributor guide) would scale better than hand-curated additions.

### Adopter-facing extras

- **`<scriptoscope-window>` Custom Element** alongside the data-attribute scanner ([#29](https://github.com/khawkins98/scriptoscope/issues/29) — open decision).
- ~~**CSS `border-image` emitter** for the body-frame chrome~~ — **retired 2026-05-28** after three spike rounds couldn't reach fidelity on exotic schemes (BeOS asymmetric title bar, evolution, etc.). The architecture is now explicitly "DOM structure + canvas decoration" — see [`docs/adr/0001-consumption-architecture.md`](./docs/adr/0001-consumption-architecture.md) §Spike result.
- **Visual regression suite** — Playwright snapshots of each control state, cross-referenced against the per-theme reference renders (`demo/assets/references/<slug>.png`). [#79](https://github.com/khawkins98/scriptoscope/issues/79) closed but the framework would live here.
- **High-contrast / accessibility variants** — auto-generate a high-contrast pair from each scheme (override headerColors, force pinstripe density) so accessibility-mode users can still pick a theme they like.
- **VS Code / editor theme generation** — export a scheme's palette + chrome accents as a `vscode-theme.json` so developers can match their editor to their windowing chrome.
- **Period-correct animation polish** — zoom-to-icon close, windowshade collapse, sheet slide-in. Tracked under [#25](https://github.com/khawkins98/scriptoscope/issues/25) Phase 6.
- **cv-mac integration** — the upstream project this was extracted from. WinBox swap one PR away once the API stabilizes; [#27](https://github.com/khawkins98/scriptoscope/issues/27).

Tracker issues for new ideas: <https://github.com/khawkins98/scriptoscope/issues/new>.

## License

**Scriptoscope's own code is [MIT](./LICENSE)** (best for adoption — the library is meant to be embedded in other projects). The bundled third-party material keeps its own terms and is **not** relicensed:

- **`themes/<slug>/`** — assets extracted from community-authored Kaleidoscope schemes, redistributed under each original author's freeware-with-redistribution terms. Provenance is in every bundle's `meta.json` (`origin.originalLicense`, `sourceUrl`) and `PROVENANCE.md`.
- **`tools/sit-wasm/munbox/`** — a vendored subset of [munbox](https://github.com/idolpx/munbox) (MIT); see `tools/sit-wasm/munbox/LICENSE` and `PATCHES.md`.
- **`demo/assets/fonts/`** — Charcoal 12 (Jeremy Sachs, CC BY-SA) and Virtue (Marty Pfeiffer, free-with-credit); see the license files alongside them.

The standalone StuffIt decoder, [`tools/sit-wasm/`](./tools/sit-wasm/), carries its own MIT `LICENSE` so it stays self-contained if extracted.
