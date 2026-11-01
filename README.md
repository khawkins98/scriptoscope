# Scriptoscope

[Landing page](https://khawkins98.github.io/scriptoscope/) · [Interactive demo](https://khawkins98.github.io/scriptoscope/showcase.html)

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

The current corpus of bundles lives under [`themes/`](./themes/): `1138`, `1984`, `1990`, `animals`, `apple-lisa`, `apple-platinum-2`, `beos-r503`, `black-platinum`, `crayon-os`, `dolphin-som`, `evolution`, `floppies`, `monkey-paradise`, `platinum-8`, `slimes`, `system7-nostalgia-silver`, `windows-31`, `windows-95`. Each bundle ships only the original archive (`scheme.sit` or `scheme.rsrc`) + `meta.json` + `PROVENANCE.md` — the runtime decodes them client-side, no pre-extraction in git.

Want more? Two community archives where Scriptoscope's drop-zone can read schemes from directly:
- **[Mac Themes Garden](https://macthemes.garden/)** — a beautifully curated gallery + archive with reference renders and the original `.sit` downloads. The 2026-05-28 corpus additions came from here.
- **[Kaleidoscope Scheme Archive (kaleidoscope.hryjksn.com)](https://kaleidoscope.hryjksn.com/)** — a community-maintained archive of 3000+ schemes, with hash-stamped reference renders. The largest corpus available; the initial bundled schemes were ported from here.

Both let you grab a `.sit` and drop it on the demo to see it render live without a build step.

> **Status (pre-1.0, 2026-11-01):** The package version is **0.8.0**. The current **incremental decode-first v2** milestone moves families onto `src/engine/` through focused PRs to `main` and per-family releases ([decision #8](./docs/v2/DECISIONS.md)); the former `v2` integration branch was retired on 2026-10-30 ([decision #1](./docs/v2/DECISIONS.md)). Scroll bars, sliders, progress, procedural frames, window recipe/widgets, push/default-ring buttons and checkboxes/radios have engine drivers; follow-up work and review state are tracked in [issue #459](https://github.com/khawkins98/scriptoscope/issues/459). This is not an all-family cutover. `src/composeChrome.ts` is now a facade over `src/engine/families/window.ts`; the engine holds the decoded layout/widget rules. The May “v2 clean-break” and “v3 reset” names describe earlier architecture generations, not the retired October `v2` branch or package versions. Runtime contributors start with the [implementer brief](./docs/spec/engine/IMPLEMENTER-BRIEF.md) and assigned safe family spec; unresolved rules become spec questions. Consumers can use the imperative and declarative examples below.

## If you build a scheme

Start with the [creation guide](./docs/authoring-a-scheme.md). It covers concept
art, frame geometry, editable sprites, control families and visual review.
[`tools/theme-author/`](./tools/theme-author/) builds real Kaleidoscope resource
forks; [Kingfisher](./authoring/schemes/kingfisher/) is the worked reference implementation.

Run `npm run author -- authoring/schemes/kingfisher` to build an example. Load
the resulting `scheme.rsrc` in the browser demo, or transfer the generated
MacBinary `scheme.bin` to a classic Mac. Validate the final build in the browser,
at 8-bit colour and in native Kaleidoscope before publishing it.

## Install

> **Upgrading to 0.8.0:** auto-sized windows now fit their chrome inside the element's box; see the Breaking note in the [CHANGELOG](CHANGELOG.md).
>
> **0.7.0:** applications own window/control attachment and lifetime through
> explicit promotion primitives; the old `mountDeclarative` front door is gone. See
> the [installation and migration guide](docs/v2/integration-release-notes.md).
> `v2` is an internal development branch label, not public release 2.0 or a
> 1.0 threshold.

The runtime and the 18 themes are hosted on the project's GitHub Pages. For a
matching deployed build, the page integration uses two URLs and no build step:

```html
<link rel="stylesheet" href="https://khawkins98.github.io/scriptoscope/scriptoscope.css">
<script type="module">
  import { mountExplicitPage } from 'https://khawkins98.github.io/scriptoscope/explicit-host.mjs';
  await mountExplicitPage({
    themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes',
    pageThemeDefault: '1138',
  });
</script>
```

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

If you'd prefer to vendor it (no third-party CDN dependency), copy every top-level `dist/*.js` file (including lazy decoder chunks), `dist/scriptoscope.css`, and the deployed themes from a matching build (see [Vendoring](#vendoring-if-you-dont-want-a-third-party-cdn-dependency)), and host them yourself.

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

  <!-- 3. The example host captures this page’s sources once.
       Application code explicitly attaches later controls. -->
  <script type="module">
    import { mountExplicitPage } from 'https://khawkins98.github.io/scriptoscope/explicit-host.mjs';
    await mountExplicitPage({
      themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes',
      pageThemeDefault: '1138',
    });
  </script>

</body>
</html>
```

**That's it.** The bundled themes (`1138`, `beos-r503`, `apple-platinum-2`, `crayon-os`, `windows-95`, etc. — see [`themes/`](./themes/)) are served from the same URL, so `themeBaseUrl` resolves them transparently.

The runtime exports explicit window/control promotion primitives. The published
`explicit-host.mjs` example owns a finite set of sources, theme replacement, URL
state and teardown. It has no automatic discovery, move service or retry loop.
After inserting a new native control call `await handle.attach({controls:[input]})`;
before removing or replacing it call `handle.detach({controls:[input]})`. Buttons
use the equivalent `buttons` array. Reflow is an application-controlled teardown
and fresh selection; native source nodes and handlers survive it.

### Three things to know up front

If you only need it to work, you can skip this section. If something looks slightly off after you've dropped Scriptoscope on your page, one of these is probably why:

1. **Your element stays where you put it.** No `-x`/`-y` attributes = the runtime host sits in normal flow at the source element's DOM position (CSS Grid / Flex / normal flow all respected). Set `data-scriptoscope-x="N"` / `-y="N"` (px only, no `%` / `em` / `vh`) to opt into a floating overlay. Dragging an in-flow window converts it to a floater on the first drag.
2. **Your `.my-class { display: grid }` won't reach the host.** Ten CSS properties (`display`, `box-sizing`, `padding`, `border`, `background`, `overflow`, `margin`, `transform`, `filter`, `contain`) are locked down inline on the runtime host so consumer-class CSS can't break the host ↔ chrome-canvas correspondence. Everything else — color, font, custom properties, your `position: relative` for stacking — still applies.
3. **Promotion is destructive.** The runtime moves your element's children into its slot and removes the original element. Framework refs to the wrapper become detached. Mount Scriptoscope AFTER your framework's first paint (`useEffect(() => mountExplicitPage(...), [])` in React; `onMounted` in Vue).

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
| `data-scriptoscope-tabs` | a `<div>` containing `data-scriptoscope-tab` buttons + `data-scriptoscope-panel` siblings | Tab strip. Pressing a tab selects it and shows its panel; Arrow keys move and select (wrapping), Home/End jump; ARIA + roving tabindex wired. |
| `data-scriptoscope-tab="<panel-id>"` | a `<button>` inside `data-scriptoscope-tabs` | One tab. Value references the panel id. |
| `data-scriptoscope-panel="<id>"` | a `<div>` inside `data-scriptoscope-tabs` | A panel. Hidden unless its id matches the selected tab. |
| `data-scriptoscope-selected` | a `<button data-scriptoscope-tab>` | Initial selected tab. Default: first tab. |
| `data-scriptoscope-window-id="…"` | a window | Stable identity for layout persistence (see `persistKey` below). Without it, DOM ordinal is used. |
| `data-scriptoscope-theme-picker` | a `<div>` | Promote into a folder-strip theme switcher. The runtime auto-populates one tile per entry in `mountOptions.themes` (icon + name + author/year). Full ARIA tab pattern + keyboard nav; clicking a tile calls `handle.retheme(slug)` internally. |
| `data-scriptoscope-cascade` | a container `<div>` | Mac-OS-classic "newly-opened windows cascade" layout for the descendant `data-scriptoscope-window` elements. Each window flips to `position: absolute` at a cumulative offset from the container's top-left; later windows sit on top in z-order. Defaults: 32px right + 28px down per window. Override via `data-scriptoscope-cascade-step-x="N"` / `-step-y="N"` / `-base-x="N"` / `-base-y="N"` on the same container. Per-window `data-scriptoscope-x` / `-y` always wins; cascade skips windows that have either. One-shot at mount; after drag or resize, the window owns its position. The consumer-friendly answer to "I want a bunch of windows to scatter like a real desktop without hand-writing position math." |
| `data-scriptoscope-icon="<name>"` | `<img>` or `<span>` | Render a scheme-resolved Finder icon by named key (`folder`, `system-folder`, `document`, `prefs`, etc.). Re-resolves on every retheme so the icon follows the active scheme. |
| `data-scriptoscope-icon-id="<id>"` | `<img>` or `<span>` | Raw Apple resource id (e.g. `-3999`) — bypasses the named-key lookup for power users. |

For what each window and control does once promoted (pointer, keyboard and touch behaviour, and every event you can listen for), see the **[interaction reference](./docs/interaction.md)**.

### Explicit page host options

```ts
await mountExplicitPage({
  themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes', // where bundles live
  pageThemeDefault: '1138',         // theme slug or URL for windows w/o explicit data-scriptoscope-theme
  persistKey: 'my-app-layout',      // optional: save window positions to localStorage.scriptoscope:layout:<key>
  baseSlug: 'apple-platinum-2',     // optional: base scheme to inherit from (any slug in your themeBaseUrl)
  root: document.body,              // optional: application-owned source-selection boundary
  themes: THEMES,                   // optional: catalog for <div data-scriptoscope-theme-picker> tiles + autoCycle.
                                    //   ThemeEntry[] — { slug, name?, author?, year?, source?, meta? }. Imported from
                                    //   your themes-manifest.json or hand-built. (Pre-2026-05 manifests used a
                                    //   combined `label` field; still accepted as a fallback if `name` is absent.)
  autoCycle: 4000,                  // optional: ms between picker auto-cycle steps (suppressed when
                                    //   syncToUrlParam restored a deep-link or first user interaction fired).
  syncToUrlParam: 'theme',          // optional: mirror current theme to ?theme=<slug>; restored on load.
                                    //   Makes the landing the shareable URL.
  rejectOnEmptyMount: true,         // optional: throw PagePromotionError if selected sources exist but
                                    //   ZERO promoted (catches theme-bundle 404s + decoder errors in one place).
  onPromoteError: detail => {…},// optional: hook per-target promotion failures (vs the rejectOnEmpty above).
  bootAffordance: 'auto',           // optional: chrome wipe-in animation + boot-state CSS hook
                                    //   (data-scriptoscope-loading on the root + .scriptoscope-ready class
                                    //   on the root once promotion and the wipe-in finish, so the class
                                    //   means "clickable"). 'auto' (default) picks per
                                    //   element; 'none' (alias false) suppresses entirely. Respects
                                    //   prefers-reduced-motion automatically.
});
```

This is a public example helper, not a package runtime mount export. The call
returns an `EventTarget` handle after selected promotions, scrollbar refreshes and
the boot wipe-in settle. A wipe-in that stops advancing (a hidden tab, an off-screen
iframe) is finished at once when the page is or becomes hidden, and otherwise once
the wait for it has lasted 360 ms. Boot load errors reject; with `rejectOnEmptyMount`, an all-failed boot
rejects with `PagePromotionError` and its `failures`. Partial target errors call
`onPromoteError(detail)`, bubble `scriptoscope:promoteError`, and remain available
in `handle.failures`; other sources remain usable. Retheme load errors reject and
retain previous faces. Superseded work cannot publish a completion event.

The handle API:

```ts
const handle = await mountExplicitPage({…});
await handle.attach({controls: [newInput]});
handle.detach({controls: [newInput]});
await handle.whenReady(); // latest requested explicit work

// Event API — four events on the handle
handle.addEventListener('ready', (e) => { /* initial selected sources complete; e.detail.stats has counts */ });
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
document.body.addEventListener('scriptoscope:close', (e) => { /* the window is being unmounted (close widget or a direct ScriptoscopeWindow.unmount()); fires before the bare HTML is restored. Not fired by handle.disconnect() */ });
document.body.addEventListener('scriptoscope:userresize', (e) => { /* user finished grow-box drag; e.detail = { w, h } */ });

// On the ORIGINAL consumer element (or any ancestor): a per-target failure event
// when promotion throws. Bubbles. Same shape as the handle's 'promoteError'.
document.body.addEventListener('scriptoscope:promoteError', (e) => { /* e.detail = { kind, el, cause } */ });

// Methods
handle.disconnect();                       // abort selected source lifetimes + restore windows and native form controls
handle.retheme(slugOrUrl);                 // programmatic theme switch ('retheme' after current request succeeds)
handle.registerTheme(ref, loadedTheme);    // register a runtime-decoded theme (used by drop-zones)
handle.openModal(wrap, { returnFocusTo }); // themed modal helper: focus trap (including shadow-DOM chrome
                                           //   focusables), Esc, backdrop-click, listens for the inner
                                           //   window's scriptoscope:close. Toggles `data-scriptoscope-modal-open`
                                           //   on the wrap; your CSS scopes visibility off that attribute.
                                           //   Returns { close() }. Idempotent on the same wrap.

// Properties
handle.stats;  // { windows, buttons, controls, tabs, fields } — five numeric counts updated on each promote
```

Overlapping `handle.retheme(ref)` calls use the latest **request**, even if that
request fails. Superseded or disconnected requests settle without a completion
event; a current load/window-preparation failure rejects. Window chrome prepares
as a batch before it commits, so such a failure leaves existing windows intact.
The completed theme URL/default and picker selection advance only on success.
Controls replace after the window batch; this is not a rollback transaction for
the entire desktop. Explicit attach calls wait for the current request to settle;
`whenReady()` includes their promotion and post-attachment scrollbar work.

`disconnect()` releases themes loaded internally by that mount and their decoded
raster caches. Pending loads release their assets when they finish. Themes passed
to `registerTheme`, including their base chains, are borrowed: the caller owns
their lifetime and calls `theme.dispose?.()` after their last consumer unmounts.
Standalone `createThemeResolver()` users should call `resolver.dispose()` at the
same point; disposed resolvers reject loads and registrations.

Teardown restores mounted windows and promoted buttons, checkbox, radio, range
and select controls. Their live values, checked state, selection and form association survive;
only runtime-owned visibility, focus/ARIA attributes, label styles and select
wrappers are restored. Replacement-face listeners, active slider drags, pending
paints and mount-owned theme-switcher listeners are released. Unrelated consumer
attribute/style changes are preserved. Pending preparation cannot insert a form
face after disconnect or move a removed/reparented source back.

Promoted ranges retain the original input as their sole keyboard and accessibility
control. Native bounds, fractional steps, `step="any"`, labels, disabled fieldsets
and keyboard event timing remain browser-owned. The themed canvas handles pointer
position; the native input sanitizes each value. The pointer adapter dispatches synthetic
`input` when it changes and `change` when a drag commits a changed value. The optional stylesheet paints native
focus on the visible canvas. Live constraint/disabled attributes and form reset
refresh the art; after assigning `.value` in script, dispatch `input` or `change`
to refresh it immediately. A bare property assignment is sampled on the next
interaction, persisted pageshow or retheme. The imperative `interactiveSlider`
API still uses normalized values and its existing keyboard/callback behavior.
Promoted native ranges use the thumb geometry from the composition that drew the
canvas: stationary grabs preserve exact values, dragging retains the grab offset,
and track clicks center the thumb under the pointer before native sanitization.
The imperative slider and scrollbar pointer contracts remain unchanged.

Button teardown removes every mount-owned face and its click/keyboard listeners,
restores the original element's display (including priority) and promotion stamp,
and returns owned focus after enclosing window content is restored. Native form
actions and consumer listeners remain attached to the same source element. Button
disabled/default state is sampled on promotion and retheme; this does not add live
button-attribute observation. Tab and text-field decoration restoration remains
outside this contract. Latest-request theme ordering and its window-batch scope
are described in the [runtime ownership spec](docs/spec/compositor-spec.md#runtime-theme-request-ownership).

The `promoteError` event is the per-target failure hook; pair with `rejectOnEmptyMount: true` for the "did everything fail" gate.

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

**The richer pattern** (used by the demo's "Load your own" picker tile) opens a themed `movable-modal` window with the drop zone inside it. Use `handle.openModal(wrap, { returnFocusTo: triggerButton })` — the helper toggles `data-scriptoscope-modal-open` on the wrap (your CSS scopes off the attribute), traps focus inside (including the shadow-DOM chrome focusables), dismisses on Esc + backdrop click, and listens for the chrome's close widget via `scriptoscope:close`. The full markup is in [`demo/showcase.html`](./demo/showcase.html) (search for `powers-byo-modal-wrap`): a `position: fixed` wrap with `visibility: hidden; opacity: 0; pointer-events: none` until `[data-scriptoscope-modal-open]` flips them on, with a themed `<article data-scriptoscope-window data-scriptoscope-window-type="movable-modal">` inside.

### CDN paths reference

| URL | What |
|---|---|
| `https://khawkins98.github.io/scriptoscope/scriptoscope.js` | Runtime ESM entry; imports a sibling lazy decoder chunk for `.sit` sources |
| `https://khawkins98.github.io/scriptoscope/scriptoscope.css` | Optional outer-shell stylesheet |
| `https://khawkins98.github.io/scriptoscope/themes/<slug>/scheme.sit` (or `scheme.rsrc`) | The bundle's source archive — fetched + decoded client-side by `loadTheme()` |
| `https://khawkins98.github.io/scriptoscope/themes-manifest.json` | Catalog of every bundled slug (label, author, source filename, ref screenshot) |
| `https://khawkins98.github.io/scriptoscope/theme-loader/loadKaleidoscopeScheme.js` | Standalone decoder ESM: the public `loadKaleidoscopeScheme` wrapper (engine `cinf` and icon-blit cicn ids on by default, so themed sliders draw and icon blits get their companions; pass `engineCinfIds: []` / `iconBlitCicnIds: []` to opt out) bundled with the conversion core. Same function `scriptoscope.js` exports; use it when you want the decoder without the runtime. `theme-loader/index.js` re-exports it. Lazily imports `../sit-wasm/index.mjs` for `.sit` input |
| `https://khawkins98.github.io/scriptoscope/sit-wasm/dist/munbox.wasm` | Standalone decoder WASM; the bundled runtime embeds its WASM in the lazy JavaScript chunk |

> **Heads-up:** the CDN URL points at a single-account GitHub Pages deploy tracking `main` — there's no versioned URL, no integrity hash, and no SLA. Fine for prototyping, hobby projects, and demos. If you're shipping to a real-traffic site, **vendor the files** (see below) at a commit you choose.

### Vendoring (if you don't want a third-party CDN dependency)

There's no npm package. If you'd rather not pin your site to this repo's GitHub Pages, vendor the files into your own build:

1. Build a chosen commit with `npm run build:demo`. Copy every top-level `dist/*.js` file, `dist/scriptoscope.css`, and `dist/demo/themes/`. Keep the JavaScript files beside each other so relative lazy imports resolve. If importing the standalone decoder for a drop zone, also copy `dist/demo/theme-loader/` and `dist/demo/sit-wasm/` beside them; `dist/demo/theme-loader/loadKaleidoscopeScheme.js` there is the built public wrapper (engine `cinf` ids on by default), not the raw `tools/theme-loader/` file, which leaves them off and hands every slider to the Platinum fallback.
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

- **[`demo/index.html`](./demo/index.html)** — the **ad-style landing page**. A period multimedia-ad composition with one portrait split across five live Kaleidoscope windows. Drag, resize, close, zoom or shade the windows; “Reassemble the face” restores the composition while keeping the chosen scheme. The footer scheme buttons retheme the portrait in place, “Original mix” restores the five-theme arrangement, and “Explore the possibilities” opens the interactive demonstration with the installation example. The short pitch introduces the HTML attribute workflow, and a compact row links to all four example websites. A visible credit links to the original Apple New Media Forum: World Tour ’95 advertisement. Links lead to the interactive demo, integration guide, and project source. Existing `?theme=<slug>` links redirect to the interactive demo.
- **[`demo/showcase.html`](./demo/showcase.html)** — the **interactive showcase**. Try original schemes, native controls, movable engine windows, bare HTML mode, and a local-file theme picker. The example gallery links to four complete page layouts. “Install” opens the separate guide while carrying the chosen scheme.
- **[`demo/install.html`](./demo/install.html)** — the **installation guide**. Complete copyable starters, data attributes, runtime options, and recipes for picked or hosted Kaleidoscope schemes. Legacy `showcase.html#install` links redirect here.
- **[`demo/diagnostic.html`](./demo/diagnostic.html)** — the **runtime showcase + developer diagnostic**. Pick any scheme from the ribbon and get its scene + reference comparison, live themed controls, and an interactive playground (every window type at any size, plus live buttons / checkboxes / radios / sliders / scrollbars / title-bar widgets). A drop-zone decodes any `.sit` / `.hqx` / `.rsrc` Kaleidoscope archive entirely in the browser. The dev-facing inspectors (geometry, slice inspector, icon inventory, raster foldout, resource roles) live behind the **"Developer tools"** disclosure at the bottom of each scheme's section — open it manually or visit with `?dev=1` to default-open.
- **[`demo/declarative-hostile-css.html`](./demo/declarative-hostile-css.html)** — the **Shadow-DOM litmus test for ADR-0001 Decision 2**. A host page deliberately ships aggressive CSS (universal `!important` resets, opinionated `div`/`canvas`/`button` rules — the kind of thing a real CMS or third-party site does) to prove the chrome inside the shadow root survives unscathed. Slotted body content still picks up host styling (it stays in the light DOM by design); only the chrome is quarantined.

## The runtime API

Two surfaces, same engine.

### Renderer-only entry

Renderer-only consumers that already have a `LoadedTheme` or `OwnedTheme` can
import the shared rendering API from `scriptoscope/renderer`. The full
`scriptoscope` entry continues to support theme loaders and declarative DOM
integration; use it when your application needs those features.

```ts
import { renderWindow, type ThemeInput } from 'scriptoscope/renderer';

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
contract](docs/v2/owned-theme-api.md) for examples and the current adoption boundary.
Existing raw loading and factory APIs remain available. Registered themes are borrowed; release them only after host dependents are disconnected.

### Native form-control migration (0.7.0, #484)

These compatibility changes have landed on `v2`.
`interactiveCheckbox`, `radioGroup` and their corresponding option types are
removed from the public exports. Replace those factories with native checkbox/radio
inputs, labels, initial `checked` state and native `change` listeners. Shared
radio `name` values give the browser ownership of group selection and keyboard
behavior. Explicit hosts promote the native inputs selected by the application.

For standalone controls using an already loaded `OwnedTheme` named `theme`,
mount an empty attached container, register the borrowed theme, then append the
controls. This reuses the theme without another load:

```js
import { mountExplicitPage } from './demo/explicit-host.mjs';

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

The native inputs retain their identity, form association and values. Checkboxes
and radios may move into a themed carrier label while mounted; do not depend on
their parent markup. `disconnect()` does not dispose a registered borrowed theme;
its owner releases it after its last consumer finishes.

`interactiveButton(theme, options)` and its `onClick` option remain available,
but the returned themed element is now an actual `HTMLButtonElement` with
`type="button"`. Native click, Space, Enter, focus and disabled-fieldset behavior
apply, including programmatic `.click()`. Enter activation can occur on keydown;
do not depend on the former pointerup/keyup callback timing, wrapper spans or
internal ARIA structure. Decorative pointer/key handlers only update paint feedback;
activation follows the native button.

Closed selects keep the native `<select>` as their sole interaction surface;
themed art is passive. Low-level `composeCheckable`, `composeButton` and raster
APIs, the managed button binder, and standalone `interactiveSlider` and
`interactiveScrollbar` APIs (including vertical scrollbars) remain available.

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
in [`src/controls.ts`](./src/controls.ts) describe the released wrapper contract.

See [`demo/diagnostic.html`](./demo/diagnostic.html) for the full integration, [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md) for the chrome model, and [`docs/scene-slot-spec.md`](./docs/scene-slot-spec.md) + [`docs/scene-codex.md`](./docs/scene-codex.md) for the per-theme tier resolution of every Scene visual slot.

### Optional measured display preparation

Load raw scheme colors through an explicit finite display profile when you have
reviewed mappings for a particular device/producer environment:

```js
import { prepareDisplayProfile, loadTheme } from 'scriptoscope';
const data = await fetch('/my-reviewed-display-profile.json').then(r => r.json());
const displayProfile = await prepareDisplayProfile(data);
const theme = await loadTheme('/themes/windows-95', { displayProfile });
```

The same option is available to `loadKaleidoscopeScheme` and the example host resolver.
Missing exact RGB16 mappings reject the load before asset URLs are allocated;
base themes must use the same profile. Omitting the option preserves the default
colors and reviewed goldens. A profile is finite environment data, not a general
original-device emulator or whole-theme fidelity claim. See the
[display-profile contract](./docs/spec/display-profile.md) for producer tables,
fixed-icon conventions, ownership and unsupported inputs.

### Whole-header pixel surfaces

`composeHeaderSurface` draws a whole Appearance header rectangle without labels
or column layout. `composeListHeader` and `platinumListHeader` retain their
existing multi-column behavior. The new API requires explicit dimensions, raw
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
device caches and recording remain outside it. See the [header-surface contract](./docs/spec/header-surface.md)
for state selection, list-view extension before clipping, diagnostics and limits.

### Button label sizing

Themed push and bevel buttons accept an explicit `fontSize` (finite, at least
6px), with a 12px compatibility default independent of face height. See the
[font-size policy and source boundary](docs/spec/control-font-size.md).

Plain push buttons also accept an opt-in caller-owned `bitmapFont`, prepared with
`prepareBitmapFont`. It keeps advances, line metrics and signed ink bearings
separate and uses the bounded source-derived single-line layout. Browser fonts
remain the default; see [the prepared-strike contract](docs/spec/prepared-bitmap-font.md).

### Managed button pattern context

Push buttons promoted inside a window owned by the same declarative mount follow
that content viewport's logical position and scroll. Standalone controls keep
local context. Imperative consumers opt in explicitly:

```ts
import { interactiveButton, WindowManager, bindButtonToContentPort } from 'scriptoscope';

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

Import these functions from `scriptoscope`. Binding adopts the committed window
scale by default, so a 1x button deliberately grows to 2x in this example; ordinary
HTML siblings do not. `{ scale: 'preserve' }` keeps the caller's size and reports
incompatible units explicitly. A direct `setButtonCompositionContext(button,
context)` replaces provider ownership. Unbind preserves newer consumer style
edits. Unsupported mappings use explicit compatibility defaults; measured browser
coordinates do not establish original GrafPort state. See the
[managed-context contract](docs/spec/managed-control-context.md) for lifetimes,
coordinate limits and automatic/foreign-manager boundaries.

### Explicit hosts and `data-scriptoscope-*`

The same runtime exposed as markup. Put `data-scriptoscope-window` on a plain `<div>` and an explicit application host promotes it into a faithful Mac window wrapping the live HTML content — no per-window JS:

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
    import { mountExplicitPage } from 'https://khawkins98.github.io/scriptoscope/explicit-host.mjs';
    await mountExplicitPage({
      themeBaseUrl: 'https://khawkins98.github.io/scriptoscope/themes',
      baseSlug: 'apple-platinum-2',
    });
  </script>
</body>
```

**Window attributes** (all `data-scriptoscope-*`): `window`, `title`, `window-type` (`document-window` / `movable-modal` / `dialog` / `titled-utility-window` / `side-floating-utility-window` / …), `x` / `y`, `width` / `height` (omit both → content-fit with a `ResizeObserver`), `state` (`active`/`inactive`), `z` (initial stacking order), `collapsed` (boot pre-shaded), `theme` (per-window scheme override, nearest-ancestor wins).

**Promoted children**: `<button data-scriptoscope-button>` (with `data-scriptoscope-default` for the OK ring), and `<input type=checkbox|radio|range>` are selected once by the example host and promoted to themed art (opt-out per-input with `data-scriptoscope-control="off"`). The native input remains the form, event and accessibility control beneath the themed art.

**Runtime theme switching**: any `<select data-scriptoscope-theme-switcher>` re-skins every window + control live, the Kaleidoscope way.

**Gestures**: drag the title bar or any other frame edge; drag the gripper to resize; click the **collapse** box or **double-click** any frame edge to window-shade; click the **zoom** box to grow-to-fit; click a window to focus it. Keyboard equivalents, scroll-bar behaviour and the full event list: [docs/interaction.md](./docs/interaction.md).

Full design + the feature-rich pass: [`docs/superpowers/specs/2026-05-27-declarative-windows-design.md`](./docs/superpowers/specs/2026-05-27-declarative-windows-design.md). Live: <https://khawkins98.github.io/scriptoscope/>.

### Bring your own theme (in-browser conversion)

Beyond the bundled corpus, the demo has a **drop-zone**: drag a Kaleidoscope theme file onto the page and it's decoded and rendered entirely client-side — no build step, no upload. Accepted inputs: a StuffIt `.sit` archive, a `.hqx` / MacBinary / AppleSingle·Double wrapper, or a raw `.rsrc` resource fork. The conversion runs through the public `loadKaleidoscopeScheme` wrapper ([`src/loadKaleidoscopeScheme.ts`](./src/loadKaleidoscopeScheme.ts)), which calls [`tools/theme-loader/loadKaleidoscopeScheme.js`](./tools/theme-loader/loadKaleidoscopeScheme.js) with the engine's `cinf` and icon-blit cicn ids; StuffIt is decoded by [`tools/sit-wasm/`](./tools/sit-wasm/) (the munbox C library compiled to WebAssembly — a self-contained, MIT, in-browser StuffIt decoder). Design + status: [`docs/superpowers/specs/2026-05-27-browser-conversion-design.md`](./docs/superpowers/specs/2026-05-27-browser-conversion-design.md); design context: [`docs/archive/byo-theme-todo.md`](./docs/archive/byo-theme-todo.md) (work completed 2026-05-27, archived as the planning record).

## Documents

- **[Interaction reference](./docs/interaction.md)** — what users can do with a window and its controls (activation, focus, moving, resizing, title widgets, scroll bars, controls, modals), every `scriptoscope:*` event, keyboard equivalents, and touch and browser differences.
- **[Measured simplification](./docs/measured-simplification.md)** — our approach to reducing runtime complexity and execution cost through consolidation, prepared inputs and differential validation; includes a reusable optimization prompt.

- **[`llms.txt`](./llms.txt)** ([live](https://khawkins98.github.io/scriptoscope/llms.txt)) — discovery file for LLM agents helping a consumer integrate. Curates pointers to README + integration docs + recipes + API surface so an agent has one canonical entry point. Follows the [llmstxt.org](https://llmstxt.org/) standard. Drop the live URL into your AI assistant's context if you're integrating Scriptoscope and want better answers.
- **Runtime implementers: [`docs/spec/engine/IMPLEMENTER-BRIEF.md`](./docs/spec/engine/IMPLEMENTER-BRIEF.md) first**, then the assigned safe family spec under [`docs/spec/engine/`](./docs/spec/engine/). Ask spec questions rather than inspecting original evidence, independent test sources or verifier material. The brief's exhaustive read scope overrides general reading suggestions here.
- **[`docs/v2/DECISIONS.md`](./docs/v2/DECISIONS.md)** — current October integration and compatibility decisions. Integration owners/spec writers also use the amended [`PLAN.md`](./docs/v2/PLAN.md); implementers use their brief and lane assignment.
- **[`docs/history.md`](./docs/history.md)** and **[`LEARNINGS.md`](./LEARNINGS.md)** — historical project arc and dated decisions, for readers outside the implementer sandbox. May v2/v3 names are historical; current architecture is in the engine family specs and code.
- **[`docs/maintainer-reference-environment.md`](./docs/maintainer-reference-environment.md)** — private Forgejo reference assets, verified fetch instructions and native acquisition/restore limits; for spec writers/verifiers acquiring original evidence, optional for maintainers, never a public CI dependency.
- **[`docs/spec/README.md`](./docs/spec/README.md)** — source-reference index for spec writers and independent verifiers. Original binary references, including `kdef231-reference.md`, are for those roles; this index is not an implementer entry point.
- **[`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md)** — listing-free window model alongside the current [`window/widgets family spec`](./docs/spec/engine/window-widgets.md).
- **[`docs/superpowers/specs/2026-05-27-declarative-windows-design.md`](./docs/superpowers/specs/2026-05-27-declarative-windows-design.md)** — design + multi-night build log for the declarative (`data-scriptoscope-*`) front door: the attribute contract, the feature-rich pass (window-shade, zoom, themed scrollbars, runtime theme-switch, themed controls), the OS 8.6 desktop redesign, the review-driven hardening, and the known follow-ups. Read this when extending the declarative layer.
- **[`PRD.md`](./PRD.md)** — the original product charter (vision still largely valid; implementation has since moved on — see `docs/history.md`).
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — how to land changes and port a scheme.

## North Star

A web window manager that **any** project — built with any framework, or no framework at all — can drop in by adding **data attributes to plain HTML**, and that ships a **Kaleidoscope-style theme engine** capable of loading freeware-licensed period theme bundles and rendering them faithfully on the modern web.

The public promotion primitives and the `data-scriptoscope-*` parsers support explicit application hosts; the demo pages exercise the example host (see "Trying it" above). Three principles do the load-bearing work:

1. **Framework-agnostic by default.** No React peer dep, no Vue plugin, no Solid integration layer. Scriptoscope is plain TypeScript + CSS that works wherever HTML works — vanilla DOM, htmx, server-rendered Rails/Django/Laravel, every JS framework, and a `<script>` tag on a static page.

2. **Explicit integration with ordinary HTML.** Data attributes describe window and control options; application code chooses source identities and owns their lifetimes. The example page host captures sources once. Later additions and removals use explicit attach/detach calls; theme replacements await current work. The runtime does not scan, move or retry newly discovered DOM. Native controls retain browser form and accessibility behavior.

3. **A Kaleidoscope-compatibility runtime, clean-room from Kaleidoscope's code.** Scriptoscope is first a *runtime for an existing corpus*; its authoring toolkit writes ordinary scheme files rather than a second theme format. It reads Kaleidoscope resource bundles (`cicn`, `ppat`, `cinf`, `wnd#`, `Colr`) directly — decoded by [`tools/theme-loader/`](./tools/theme-loader/) via [`scripts/extract-scheme.mjs`](./scripts/extract-scheme.mjs) — and re-implements the rendering entirely in our own compositor (see [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md)). The corpus is the community-authored schemes archived on [Macintosh Garden](https://macintoshgarden.org/apps/kaleidoscope) and [Mac Themes Garden](https://macthemes.garden/), prioritizing those with explicit freeware-with-redistribution readmes. **We extract compiled assets from individual schemes** (with the author's stated permission) and **re-implement the rendering entirely in our own code** — Scriptoscope never uses Kaleidoscope's source code. Apple's own themes (Hi-Tech, Drawing Board, Gizmo) are deliberately out of scope, and **Scriptoscope does not hand-author chrome from the HIG** — it renders whatever scheme is loaded. Every extracted theme bundle carries provenance metadata (original author, source URL, license-of-origin); the only first-party visual artifacts Scriptoscope produces are the un-themed engine fallbacks needed when no scheme has loaded yet, plus authoring examples under [`authoring/`](./authoring/) that are themselves ordinary scheme files rendered through the same path (they are not part of the bundled corpus).

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

## Rendering regression coverage

The [control matrix](./tests/rendering-options/README.md) exercises all 18 schemes
through source and built APIs, actual promoted DOM and consumer CSS. Its bounded
profile covers 70 cases per scheme; the extended profile covers 660 valid
combinations. Development is driven by this harness: reproduce a concrete issue,
add a focused acceptance case, and retain reviewed exact Linux Chromium goldens
as regression evidence. Independent source-backed expected values and reviewed
original references with matching inputs determine fidelity; screenshots of
current output alone cannot establish it. Remaining control limits are tracked in
[#218](https://github.com/khawkins98/scriptoscope/issues/218). Broader original
tab, font, device and window fidelity remain active work in
[epic #221](https://github.com/khawkins98/scriptoscope/issues/221); the independent
reference corpus is tracked in [#190](https://github.com/khawkins98/scriptoscope/issues/190).
The [reference intake](./tests/reference-captures/README.md) also defines a narrow
review scope for complete fixed-size empty face observations.
Such composited-pixel evidence leaves the broader requirements unresolved; it
cannot certify masks, typography, unobserved states or private painter selection.
The [original corpus](./tests/reference-captures/ORIGINALS.md) now contains fifty-four
independently AI-reviewed scoped observations. All fifty-four whole requests remain
evidence-incomplete, with all broader requirements unresolved. Maintainers can
reuse the [private original-reference environment](./docs/maintainer-reference-environment.md)
to acquire additional evidence; access is optional and never required by public CI.

[Actual resource-byte provenance](./docs/spec/resource-byte-provenance.md) can opt in
to joining loaded archive, fork and resource bytes to selected manifest entries
and painted push/default/bevel faces. It establishes input identity through shared
conversion; independent decoder correctness and broader control families remain
separate requirements.

The [draft acceptance inventory](./docs/spec/acceptance-inventory-proposal.md) proposes
full-target families, paths and boundary classes; its closure and unresolved evidence remain open.

A [pinned-source emulator build](./docs/research/emulator-build-reproduction/2026-10-19/README.md)
now reproduces the preserved JS/WASM exactly; glyph-provider tracing remains unresolved.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and the required checks. The
[fidelity plan](./docs/spec/fidelity-verification-plan.md) and
[epic #221](https://github.com/khawkins98/scriptoscope/issues/221) define the path
from regression coverage to independently verified rendering.

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

- **`<scriptoscope-window>` Custom Element** alongside explicit data-attribute promotion ([#29](https://github.com/khawkins98/scriptoscope/issues/29) — open decision).
- ~~**CSS `border-image` emitter** for the body-frame chrome~~ — **retired 2026-05-28** after three spike rounds couldn't reach fidelity on exotic schemes (BeOS asymmetric title bar, evolution, etc.). The architecture is now explicitly "DOM structure + canvas decoration" — see [`docs/adr/0001-consumption-architecture.md`](./docs/adr/0001-consumption-architecture.md) §Spike result.
- **High-contrast / accessibility variants** — auto-generate a high-contrast pair from each scheme (override headerColors, force pinstripe density) so accessibility-mode users can still pick a theme they like.
- **VS Code / editor theme generation** — export a scheme's palette + chrome accents as a `vscode-theme.json` so developers can match their editor to their windowing chrome.
- **Period-correct animation polish** — zoom-to-icon close, windowshade collapse, sheet slide-in. Tracked under [#25](https://github.com/khawkins98/scriptoscope/issues/25) Phase 6.
- **cv-mac integration** — the upstream project this was extracted from. WinBox swap one PR away once the API stabilizes; [#27](https://github.com/khawkins98/scriptoscope/issues/27).

Tracker issues for new ideas: <https://github.com/khawkins98/scriptoscope/issues/new>.

## License

The site’s [Acknowledgements page](./demo/acknowledgements.html) collects scheme authors, archives, visual inspiration, image provenance, fonts, and supporting tools.

**Scriptoscope's own code is [MIT](./LICENSE)** (best for adoption — the library is meant to be embedded in other projects). The bundled third-party material keeps its own terms and is **not** relicensed:

- **`themes/<slug>/`** — assets extracted from community-authored Kaleidoscope schemes, redistributed under each original author's freeware-with-redistribution terms. Provenance is in every bundle's `meta.json` (`origin.originalLicense`, `sourceUrl`) and `PROVENANCE.md`.
- **`tools/sit-wasm/munbox/`** — a vendored subset of [munbox](https://github.com/idolpx/munbox) (MIT); see `tools/sit-wasm/munbox/LICENSE` and `PATCHES.md`.
- **`demo/assets/fonts/`** — Instrument Serif and Cormorant Garamond (SIL OFL 1.1), Charcoal 12 (Jeremy Sachs, CC BY-SA), and Virtue (Marty Pfeiffer, author’s terms); see the license files alongside them.

The standalone StuffIt decoder, [`tools/sit-wasm/`](./tools/sit-wasm/), carries its own MIT `LICENSE` so it stays self-contained if extracted.
