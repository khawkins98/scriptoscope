# PRD — Scriptoscope

A Mac OS Appearance-style window manager + theme engine for the web.

*This is the original product charter (~2026-05-16). The **vision** below — a framework-agnostic, declarative, clean-room Kaleidoscope-compatibility runtime — still holds. The **implementation** has since gone through a v2 clean-break and a v3 part-code-compositor reset, so the phased-delivery sketch, architecture sketches, and some file paths below are historical. For where the code actually is today, read [`docs/history.md`](./docs/history.md) and [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md).*

> **Reconciliation note (2026-05-25; updated 2026-05-28).** The v3 reset built a faithful **canvas chrome compositor** (`src/composeChrome.ts` → `src/renderWindow.ts`), not the CSS-custom-property theme model this charter originally sketched. Two consequences the sections below predate: (1) the theme bundle format is `theme.json` + `cicns/` PNGs (see [`docs/theme-bundle-layout.md`](./docs/theme-bundle-layout.md)), **not** `chrome.css`/`controls.css`/sounds/fonts; (2) the **consumption layer front door** (the declarative `data-aaron-*` scanner + a real WindowManager with drag/resize/z-order/shade/zoom/themed-scrollbars/runtime-theme-switching + themed `data-aaron-control` promotion) **shipped 2026-05-27/28** and is exercised by `demo/declarative.html` (OS 8.6 desktop) and `demo/declarative-site.html` (skin-an-existing-site). What's still open in that layer: the CSS `border-image` emitter, the representability classifier, Shadow-DOM encapsulation around chrome, and persistence — all still spike-gated. How the rest of the layer should be built (CSS-first hybrid rendering, Shadow-DOM encapsulation, scope guards) is decided in **[`docs/adr/0001-consumption-architecture.md`](./docs/adr/0001-consumption-architecture.md)** — read it (especially its 2026-05-28 Update section) before acting on the Theme System, Phased Delivery, or Architecture Sketches sections below.*

This document is the project charter, ported from the upstream extraction ticket [classic-vibe-mac #246](https://github.com/khawkins98/classic-vibe-mac/issues/246). When this document and the upstream ticket disagree, **this document wins** — the ticket records the decision moment, but it lives in another repo and won't be updated as Scriptoscope evolves.

---

## North Star

A web window manager that **any** project — built with any framework, or no framework at all — can drop in by adding **data attributes to plain HTML**, and that ships a **runtime for the Kaleidoscope theme corpus**: loads `.ksc` schemes directly (chrome `cicn`s, tile patterns, geometry metadata, color schemes) and renders them faithfully in CSS / SVG / JS, no hand-authoring required.

This compresses to three principles, each of which constrains downstream architecture:

### 1. Framework-agnostic by default

No React peer dep, no Vue plugin, no Solid integration layer. Scriptoscope is plain TypeScript + CSS that works wherever HTML works:

- Vanilla DOM apps.
- Server-rendered HTML from any backend (Rails, Django, Laravel, PHP, Go templates, static-site generators).
- Every modern JS framework, used as escape-hatch components.
- htmx / Alpine / petite-vue and similar HTML-augmenting libraries.
- A single `<script>` tag on an otherwise-static page.

**Architectural consequence:** the core ships as ES modules with no JS dependencies. dev-deps only (TypeScript, bundler). The public API surface is HTML attributes + CSS custom properties first; an imperative TS class API exists but is not the primary integration story.

### 2. Declarative-first integration via data attributes

The primary integration path is markup-only. The library scans the DOM (on `DOMContentLoaded` and via a `MutationObserver` for dynamic additions) for elements bearing `data-aaron-*` attributes and promotes them into the right Scriptoscope control. No one should *need* to write JS to use the library for the common case.

```html
<link rel="stylesheet" href="scriptoscope.css">
<script type="module" src="scriptoscope.js"></script>

<!-- A window. Title bar, drag, resize, close, focus all just work. -->
<div data-aaron-window
     data-aaron-title="Welcome"
     data-aaron-x="100" data-aaron-y="80"
     data-aaron-width="380" data-aaron-height="240">
  <p>Window content here.</p>

  <!-- A Platinum default button, declared inline. -->
  <button data-aaron-button data-aaron-default>OK</button>
  <button data-aaron-button>Cancel</button>
</div>

<!-- Theme switching, declarative. -->
<select data-aaron-theme-switcher>
  <option value="apple-platinum-2">Apple Platinum</option>
  <option value="beos-r503">BeOS R5.0.3</option>
  <option value="https://example.com/themes/your-scheme/">A scheme served from somewhere else</option>
</select>
```

**CSS class hooks as a fallback.** Environments where data attributes are awkward (CSP-restricted, some CMSes, some template engines) can use class selectors instead — `.aaron-window`, `.aaron-button`, etc. — with the same semantics. Data attributes are the recommended path because they cleanly separate "this is configuration" from "this is a styling hook," but class fallback exists.

**Imperative API stays available** for dynamic / programmatic cases:

```ts
import { AaronWindow, loadTheme } from 'scriptoscope';

await loadTheme('https://example.com/themes/beos-r503/');
const win = new AaronWindow({
  title: 'Dynamic Window',
  x: 200, y: 200, width: 400, height: 300,
  html: '<p>Created in JS.</p>',
});
```

**Architectural consequence:** the imperative API is the *foundation*; the declarative scanner is a thin layer on top that calls it. Same code path, two front doors.

### 3. Kaleidoscope-compatibility runtime, clean-room from Kaleidoscope itself

Scriptoscope is **a web-native runtime for the Kaleidoscope theme genre — not a re-authoring project.** Period themes authored as Kaleidoscope schemes (`.ksc` files) are the corpus *and* the input format. We read their compiled resources (`cicn`, `ppat`, `cinf`, `wnd#`, `Colr`) directly. The decoders live in [`tools/theme-loader/`](./tools/theme-loader/) — pure-JS, browser-portable — so the rendering can replay any well-formed scheme, the way Kaleidoscope itself did. Build-time bundles ([`scripts/extract-scheme.mjs`](./scripts/extract-scheme.mjs) → `theme.json` + PNG cache) are the current materialisation step. We re-implement the *rendering* entirely in our own CSS / SVG / JS — Scriptoscope never uses Kaleidoscope's source code, but it does honour Kaleidoscope's data layout.

**A consequence worth naming: classic-Mac Kaleidoscope authoring tools become Scriptoscope authoring tools.** Anyone with ResEdit + the period Kaleidoscope SDK (or a modern emulator running them) can produce a `.ksc` that Scriptoscope will load. The format is the contract; the runtime is incidental.

We do **not** hand-author chrome from the HIG; we do **not** ship a first-party Platinum theme. Every look is a community-authored Kaleidoscope scheme, loaded through the same code path as every other theme.

**The clean-room boundary is from Kaleidoscope's source code, not from scheme assets.** This is the same distinction that holds for any reader of a file format: a Photoshop `.psd` parser can read files without touching Photoshop's source. Specifically:

- **We do** read and extract assets from Kaleidoscope scheme files (`.ksc`) whose original authors explicitly licensed them as freeware-with-redistribution. We use those assets *as* the rendered chrome — no copy-and-redraw step, the runtime composites the same raster/metadata Kaleidoscope did.
- **We do** read Kaleidoscope's *published format documentation* (SDK docs, scheme-authoring guides — mirrored on Wayback) and the `TMPL` resources every scheme embeds, which self-document the binary layout.
- **We do not** read Kaleidoscope's source code (the closed engine itself).
- **We do not** read decompiled Mac OS Toolbox source or clean-room emulator implementations that have themselves derived from such material.
- **Apple's own themes (`.afm`: Hi-Tech, Drawing Board, Gizmo) are out of scope.** License friction with Apple isn't worth managing, and the Kaleidoscope corpus is large enough (thousands of schemes, many Platinum-faithful, many freeware) that we don't need them. Decision revisited + confirmed 2026-05-28 (#174 closed `wontfix`). Consumers with their own `.afm` files have a documented user-side conversion path: [`docs/converting-from-afm.md`](./docs/converting-from-afm.md).
- **We do not hand-author chrome from Apple's HIG.** The HIG remains useful background reading, but Scriptoscope's job is to faithfully render whatever scheme the user loads — not to produce a competing first-party Platinum interpretation. The 2026-05-17 LEARNINGS entry "Scriptoscope is a Kaleidoscope-compatibility runtime, not a Platinum re-author" records the pivot.

**Architectural consequence:** every extracted theme bundle documents its provenance in `meta.json` / `PROVENANCE.md` — original Kaleidoscope scheme author, year, source URL, the readme-stated license. No first-party Platinum is authored, ever. No Apple binaries are touched at any stage.

---

## TL;DR

Scriptoscope is a standalone open-source library that gives any web page draggable, resizable windows with authentic Mac OS-era chrome. The first-class architectural concept is **themes** — loadable Kaleidoscope schemes (chrome `cicn`s + tile `ppat`s + `cinf`/`wnd#` geometry + `Colr` palette) read by Scriptoscope's runtime and rendered with CSS / SVG / JS. Loading any freeware-licensed Kaleidoscope scheme is a single `loadTheme()` call. Scriptoscope never hand-authors a competing first-party theme.

[classic-vibe-mac](https://github.com/khawkins98/classic-vibe-mac) is the first consumer. It is never a privileged one.

## Why this exists

Three things shifted at once:

1. **The Platinum-fidelity ceiling is real.** cv-mac built a Mac OS 8 Platinum chrome layer on top of [WinBox](https://nextapps-de.github.io/winbox/) and hit a structural wall: ~30% of the remaining authenticity gap can't be closed by CSS overrides because WinBox imposes a fixed DOM (`.wb-header / .wb-body / .wb-n / .wb-ne / …`) where the chrome we need doesn't fit. Scrollbars live inside `.wb-body`, not in a window-frame gutter. There's no slot for a windowshade arrow or status bar. Drag has web-style acceleration, not Mac-instant snap-to-cursor.

2. **AI-agent-assisted development changes the cost equation.** A custom WM is the most well-trodden algorithmic territory in UI history — drag, resize, z-order have been implemented in every windowing toolkit since Smalltalk. With AI assistance, the WM core is ~600-800 lines of TypeScript and a 1-2 day project, plus a week-ish of discovery polish across the following months for edge cases (iPad touch, IME composition, screen-reader semantics). That's a different calculus than the multi-week WM project this would have been in 2019.

3. **The themes angle turns this from "another retro CSS framework" into a product.** Mac OS 7.x–9.x had a rich theming ecosystem, anchored by the third-party [Kaleidoscope](https://en.wikipedia.org/wiki/Kaleidoscope_(software)) engine — chrome + controls + colors + (sometimes) sounds, packaged as loadable bundles. The community produced thousands of schemes across roughly a decade, archived now on Macintosh Garden and Mac Themes Garden. A web library that ships the *theming engine* — and ports a curated set of those schemes as web-native bundles with original-author attribution — is a genuinely interesting reproduction of how Mac OS appearance actually worked, with no IP friction from Apple's own themes (which we deliberately stay out of).

## What it is

- A window manager: open / close / focus / raise / drag / resize / z-order / persistence.
- A theme-able chrome library: title bars, window controls (close / zoom / windowshade), status bars, growboxes, scrollbars — rendered from whatever Kaleidoscope scheme is loaded, never hard-coded.
- A starter set of controls: buttons (push, default, popup, popup-menu), tabs, group boxes/frames, fields, sliders, checkboxes, radios, progress bars, standard alerts/dialogs/sheets — each driven by the loaded scheme's `cicn` artwork for its state variants.
- **A theme runtime, not a theme authoring effort.** Scriptoscope consumes Kaleidoscope schemes directly. What a loaded scheme provides:
  - Window chrome (`cicn` window-frame composites; `wnd#` part rects; per-side edge recipes)
  - Control appearance (`cicn` state-variant artwork per control; `cinf` 9-slice metadata)
  - Tileable patterns (`ppat` resources for body backgrounds, scrollbar tracks, etc.)
  - Color palette (`Colr` scheme settings)
  - *Not* desktop background, system sounds, or fonts — Kaleidoscope schemes in practice didn't carry these; Scriptoscope doesn't fabricate them.
- A starter theme library:
  - **Extracted scheme bundles** — a curated set of freeware-licensed Kaleidoscope schemes (currently `1138`, `1984`, `1990`, `apple-platinum-2`, `beos-r503`, `evolution`), each with single-author provenance, pre-extracted into `themes/<slug>/` so `loadTheme()` can fetch them with no decode step at runtime.
  - **Loadable Kaleidoscope schemes from the wider corpus** — the thousands of schemes on Macintosh Garden / Mac Themes Garden / [Kaleidoscope Scheme Archive](https://kaleidoscope.hryjksn.com/). Any with explicit freeware-with-redistribution readmes can be pre-extracted via [`scripts/extract-scheme.mjs`](./scripts/extract-scheme.mjs) and then served from any URL.
  - **Newly-authored schemes** — produced via period Kaleidoscope authoring tools (ResEdit + the Kaleidoscope SDK, on classic Mac OS or under emulation) and ported into Scriptoscope through the same extractor. Because we honour Kaleidoscope's format as the contract, the long-dormant authoring toolchain becomes a live authoring path again.

(Framework-agnostic, HIG-faithful, and the integration model are all spelled out in §North Star above; not repeated here to avoid drift.)

## What it isn't

- An emulator. cv-mac has one.
- A full AppKit / Carbon reproduction. No NSTextView, no NSScrollView, no view-controller hierarchy.
- Mobile-first. Touch should work as a fallback but isn't the primary target.
- A theme authoring tool (initially). Theme bundles are authored by hand or with external tooling. A theme-builder UI is a separate possible future project.
- Tied to cv-mac. cv-mac is the first consumer; never a privileged one. No cv-mac-specific code, conventions, or assumptions leak into Scriptoscope.

## Target consumers

1. **cv-mac itself.** We need this. If no one else ever uses it, that's still fine.
2. **Retro / period-software web projects** — emulator sites, retro games, abandonware archives, "look like Mac OS 8" portfolios.
3. **The retro-theming community.** Anyone who'd want to publish a Kaleidoscope scheme as a web-loadable theme. Because Scriptoscope honours the `.ksc` format directly, **classic-Mac authoring tools (ResEdit + the Kaleidoscope SDK) become live authoring tools again** — author on a real machine or under SheepShaver, drop the `.ksc` through the extractor, serve.
4. **Educational / demo projects** teaching HCI history or interface design.
5. **The long tail** of devs who'd say "I'd ship this if there were a drop-in Mac OS Appearance theme engine, the way [98.css](https://jdan.github.io/98.css/) exists for Windows 98."

## Core principles

The North Star (above) is principles 1-3. The remaining four:

4. **Scheme-faithful or it doesn't ship.** When Scriptoscope loads a Kaleidoscope scheme, the rendered result should match Kaleidoscope's own output as closely as the modern web allows — `cinf` 9-slice geometry honored, `ppat` body composition honored, `wnd#` part rects honored. Faithfulness is to the *loaded scheme*, not to any external HIG reference. (If a scheme deviates from HIG, that's the scheme's authorial choice; we render what's there.)
5. **Schemes are first-class; Scriptoscope bakes nothing in.** No first-party Platinum, no first-party anything. The runtime ships chrome only through loaded schemes — including the bundled default. If the bundled default is removed, the WM works but renders un-styled (the "engine fallback" state); that's intentional.
6. **DOM-light, CSS-heavy.** Chrome is CSS-driven so themes can be authored without forking the engine. JS only where it has to be (drag, focus, persistence, sound triggering, theme loading, the declarative scanner).
7. **Accessibility considered from the start, not retrofitted.** Real keyboard nav, real ARIA, real focus management. Period-correct UX should not mean inaccessible.
8. **Bundle-size honest.** Tree-shakeable; gzipped target for core WM + Platinum theme should be competitive with WinBox (~30 KB minified / ~10 KB gz).
9. **No breaking changes after 1.0** without a major version bump.

## Theme system (the key architectural primitive)

> **Superseded by the v3 reset.** The `chrome.css`/`controls.css`/sounds/fonts sketch below was the v0.x guess. The **actual** bundle format is a decoded-Kaleidoscope manifest + raster assets: `theme.json` (window types, part rects, edge recipes, chrome-element + cinf geometry, palette) plus `cicns/` PNGs and optional `patterns/`. Canonical layout: [`docs/theme-bundle-layout.md`](./docs/theme-bundle-layout.md); compositor model: [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md). Sounds/fonts/desktop are out (Kaleidoscope schemes don't carry them — see "What it is"). The sketch is retained for historical intent.

Themes are loadable bundles. ~~The exact format is for v0.x design to settle, but the shape is roughly:~~ *(historical sketch — see the note above for the real format)*

```
my-theme/
  theme.json          # metadata, version, asset manifest
  chrome.css          # CSS custom properties + chrome-specific rules
  controls.css        # button, popup, tab, scrollbar appearance
  desktop.{png,jpg}   # background picture
  sounds/
    open.wav
    close.wav
    beep.wav
    click.wav
    drag.wav
    drop.wav
    error.wav
  fonts/              # optional theme-specific webfonts
  icons/              # window control glyphs (close, zoom, windowshade)
```

Two integration paths, declarative first per the North Star:

**Declarative (recommended for most consumers):**

```html
<!-- Tell the page which theme to use. Exact attribute syntax is
     a design call; this is illustrative. -->
<html data-aaron-theme="beos-r503">
  <head>
    <link rel="stylesheet" href="scriptoscope.css">
    <script type="module" src="scriptoscope.js"></script>
    <link rel="aaron-theme" href="/themes/beos-r503/theme.json">
  </head>
  <body>
    <div data-aaron-window data-aaron-title="Window">...</div>
  </body>
</html>
```

**Imperative (for dynamic / programmatic cases):**

```ts
import { loadTheme, AaronWindow } from 'scriptoscope';

await loadTheme('https://example.com/themes/beos-r503/');
const win = new AaronWindow({ title: 'Window', html: '...' });
```

Themes are **switchable at runtime**. The headline marketing artifact is a demo page showing the same windows under one curated community scheme → another, one click each — by switching the loaded scheme. (See [`demo/index.html`](./demo/index.html) for the current walking skeleton of this.)

## Phased delivery

> **Current cut lives in the ADR.** The phases below (and the tracker issues #22–#31) predate the v3 canvas reset and the consumption-layer analysis. The up-to-date phase map — P0 reconcile/spike → PA front door → PB window-manager behaviors → PC CSS emitter → PD ingestion → PE control decoration, plus cross-cutting — is in **[`docs/adr/0001-consumption-architecture.md`](./docs/adr/0001-consumption-architecture.md) §Phase map**. New epic issues are cut from there *after* the gating spike resolves. The list below is retained for history.

Sketch, not commitment. Maintainer may re-split. Each phase has a GitHub milestone + a tracker epic issue with full acceptance criteria.

- ✅ **Phase 1 — WM core.** *Shipped (later superseded by the v2/v3 resets, which refocused the project on the chrome compositor — see [`docs/history.md`](./docs/history.md)).* Window class, drag, 8-direction resize, z-order, focus, raise-on-click, programmatic open/close/focus/minimize/maximize, mount/unmount lifecycle, declarative `data-aaron-window` scanner, ARIA + keyboard + focus-trap on modals. Live at https://khawkins98.github.io/aaron-ui/. [Milestone](https://github.com/khawkins98/aaron-ui/milestone/1).
- ❌ **Phase 2 — Platinum chrome (default theme).** *Dropped 2026-05-17.* Hand-authoring a Platinum theme from the HIG would duplicate freeware Platinum-faithful Kaleidoscope schemes that already exist and weaken the "Scriptoscope is a Kaleidoscope-compatibility runtime" product story. Phase 2 collapses into Phase 4 — chrome comes only from loaded schemes, through the same runtime as every other scheme. See [LEARNINGS entry "Scriptoscope is a Kaleidoscope-compatibility runtime, not a Platinum re-author"](./LEARNINGS.md) and the closing comment on [#21](https://github.com/khawkins98/aaron-ui/issues/21).
- **Phase 3 — Core controls.** Wire each control class (push button, default button, checkbox, radio, popup menu, tab, slider, progress, scrollbar) to consume `cicn` state-variant artwork + `cinf` 9-slice metadata from the loaded scheme. State machinery (`:active`, `[aria-disabled]`, `[data-checked]`) toggles the underlying asset URL. [Tracker issue #22](https://github.com/khawkins98/aaron-ui/issues/22).
- **Phase 4 — Theme engine (absorbs former Phase 2).** Theme bundle format (see [`docs/theme-bundle-layout.md`](./docs/theme-bundle-layout.md)), `loadTheme()` API, runtime switching, `ppat` composition layer, `wnd#`-driven part-rect rendering, `cinf`-driven geometry. Ship a curated set of extracted schemes. *(The v3 reset rebuilt this around the part-code compositor — see [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md).)* [Tracker issue #23](https://github.com/khawkins98/aaron-ui/issues/23).
- **Phase 5 — Dialogs & sheets.** Standard alert (note / caution / stop), modal dialog, sheet animations. [Tracker issue #24](https://github.com/khawkins98/aaron-ui/issues/24).
- **Phase 6 — Polish.** Animations (zoom-to-icon close, windowshade roll-up), advanced theming hooks, demo site showcasing the theme library. [Tracker issue #25](https://github.com/khawkins98/aaron-ui/issues/25).

### Cross-cutting tracker issues

Items that don't map cleanly to a single phase:

- [License decision](https://github.com/khawkins98/aaron-ui/issues/26) (PRD §License + §Open questions Q2)
- [cv-mac integration / WinBox swap](https://github.com/khawkins98/aaron-ui/issues/27) (Success Criterion #1)
- [npm publish + distribution](https://github.com/khawkins98/aaron-ui/issues/28)
- [Web Components alongside class API decision](https://github.com/khawkins98/aaron-ui/issues/29) (Open question Q4)
- [scheme-extractor browser version](https://github.com/khawkins98/aaron-ui/issues/30)
- ✅ [GitHub Pages deploy](https://github.com/khawkins98/aaron-ui/issues/31) — *Shipped.*

## Non-goals (worth restating)

- No reimplementing AppKit.
- No state-management opinion. Consumers wire data however they like.
- No build-step requirement. Consumers should be able to drop a `<script>` tag and CDN-load.
- No IE / pre-2020 browser support. Modern evergreens only.
- Not a theme authoring tool (initially).

## Architecture sketches

These were suggestions when written. *The v2/v3 resets reorganised the code substantially — the WM-centric layout (`src/window-manager/`) and the old `runtime-rendering-architecture.md` spec no longer exist. For the actual implementation, see [`src/`](./src/) (the runtime lives in `composeChrome.ts` / `renderWindow.ts` / `loadTheme.ts`) and [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md) for the current chrome model.* The sketches below are retained as historical intent.

- **Two integration surfaces, declarative-first per the North Star:**
  - **Primary:** declarative scanner — on `DOMContentLoaded` and via `MutationObserver`, the library scans for `[data-aaron-window]` / `[data-aaron-button]` / etc. and promotes them into Scriptoscope controls. CSS class selectors (`.aaron-window`, …) accepted as a fallback.
  - **Foundation:** imperative TypeScript class API (`new AaronWindow({...})`, `loadTheme(url)`) underneath. The scanner just calls into it. Both surfaces share one code path.
  - Web-component wrapper as a *possible* additional layer — see Open Question 4 below; not yet committed.
- **CSS custom properties drive the theme system.** Each theme defines its own values. The engine ships a documented property catalog (`--aaron-titlebar-bg`, `--aaron-default-button-outline-width`, etc.) that themes set.
- **No JS dependencies in the core.** dev-deps (TypeScript, bundler) only.
- **WinBox compatibility shim is cv-mac's responsibility, not Scriptoscope's.** cv-mac currently calls `new WinBox({title, x, y, width, height, html, onclose})` in many places. To enable a one-day swap, cv-mac will write a thin adapter wrapping Scriptoscope's imperative API to match the WinBox signature. Scriptoscope itself does *not* ship a WinBox-compat layer — that would couple it to a library it's replacing. This is an intentional separation.

## Success criteria

1. cv-mac swaps WinBox for Scriptoscope in a single PR with zero behavioral regression at merge.
2. A third party can `npm install scriptoscope` (or `<script src>`) and have draggable, Kaleidoscope-themed windows on a page in <50 LOC.
3. At least two Kaleidoscope schemes load and switch live without page reload (one extracted bundle plus one additional loaded from an external URL).
4. Visual spot-check against the source scheme: under a loaded scheme, a panel of 5–10 controls renders pixel-faithfully enough that someone comparing against Kaleidoscope's own scheme preview would recognise it as the same scheme.
5. Bundle ≤30 KB gzipped for the WM core + theme runtime (excluding the bundled-default scheme's PNG assets, which are accounted separately).
6. Accessibility audit (axe / keyboard-only walkthrough) passes for the core controls.

## License

**Deliberately undecided.** Three real candidates:

- **MIT / Apache-2.0** — best for adoption; consumers can embed without worrying about copyleft.
- **LGPL** — copyleft on the library itself but consumers can dynamically link without their app inheriting; classic library license.
- **GPL-3.0-or-later** — matches the cv-mac / wasm-retro-cc family; honest if the project values share-back over adoption.

The right answer depends on how much we want Scriptoscope used by closed-source projects. There is no defaulting to "match the upstream family" here, because this isn't a fork or extension of cv-mac — it's a separate sibling that may have a different lifecycle and consumer base.

**Decision still deferred** but now actionable — Phase 1 has shipped. Tracked at [issue #26](https://github.com/khawkins98/aaron-ui/issues/26), which carries a non-binding recommendation (MIT) for discussion before Phase 4 (theme engine) ships.

## Open questions for v1.0

1. **Scope for v1.0** — Phase 1 (WM core) only, or Phases 1+3+4 (WM + controls + theme runtime with a curated set of extracted schemes) as the v1.0 target? *(Phase 1 has now shipped; Phase 2 has been dropped 2026-05-17 with its scope absorbed into Phase 4; npm-publish tracker [#28](https://github.com/khawkins98/aaron-ui/issues/28) will revisit.)*
2. **License** — see §License above. Tracker: [#26](https://github.com/khawkins98/aaron-ui/issues/26).
3. ~~**Legal pass on theme reproductions.**~~ **Resolved 2026-05-16:** Apple's own themes (Hi-Tech, Drawing Board, Gizmo) are out of scope entirely — license friction isn't worth it. Scriptoscope focuses on Kaleidoscope-corpus schemes, prioritizing those with explicit freeware-with-redistribution readmes. See LEARNINGS entry "Apple themes dropped; Kaleidoscope is the corpus."
4. **Web Components alongside the class API** — yes from v1.0, or defer? Tracker: [#29](https://github.com/khawkins98/aaron-ui/issues/29) (non-binding recommendation: defer). *(Informed by [ADR-0001](./docs/adr/0001-consumption-architecture.md) §Decision 3: a custom element + Shadow DOM is the likely internal realization of the data-attribute front door — the public contract stays the data-attribute, not a hand-authored element.)*
5. **Consumption rendering: canvas vs CSS** — **decided in [ADR-0001](./docs/adr/0001-consumption-architecture.md)**: CSS-first hybrid (border-image body frame from the slice recipe + canvas title-bar/fallback), gated by a spike. Native host form-control reskinning is out of scope for v1.

## Naming (decision recorded)

**Chosen: Scriptoscope.** *Renamed 2026-05-28 — the prior "Aaron UI" decision below is preserved as the recorded reasoning of its time.*

The JavaScript pun ("Script") + instrument-suffix homage ("-oscope") fit the project's character — an instrument you look through to see classic Mac themes rendered on the modern web. Forcing function: the `aaron-ui` package name was already taken on npm. Researched name candidates (commit `352ad93` on `origin/platinum-fidelity`'s `blog-post-outline.md`) ranked Schemeoscope cleanest-slate, Scriptoscope runner-up (best JS pun); maintainer picked Scriptoscope. Full rationale: `LEARNINGS.md` 2026-05-28 "Scriptoscope pivot" entry.

Internal API surface (`data-aaron-*` attributes, `.aw-*` CSS classes, `AaronWindow` class name) stays stable across the rebrand on the Lodash-kept-`_` model.

---

**Prior decision (2026-05-16 → 2026-05-17): Aaron UI.** *Superseded 2026-05-28 by Scriptoscope above; preserved verbatim for the historical record.*

After *Aaron*, the Apple internal codename for the Copland-era demo that previewed both the Appearance Manager and the Platinum default theme. The `UI` suffix sits in the established `[Name] UI` family (Material UI, Chakra UI, Shadcn UI) and is self-describing for newcomers who don't know the Aaron reference.

*Etymology note (updated 2026-05-17):* with the project now scoped as a *Kaleidoscope-compatibility runtime* — not an Appearance Manager re-implementation, and explicitly not a Platinum re-author — the connection to the original Aaron codename is loose. Poetic origin story, not tight technical description. The name is retained because (a) renaming costs are real and (b) the `[Name] UI` family signals "UI library" cleanly. The README spells out the looser etymology so the gap doesn't surprise anyone.

Alternatives considered (preserved for posterity): Aaron alone (unsearchable), AaronKit (assumes knowledge of the reference), AaronJS (generic), Mac-Aaron (trademark exposure), Aaron Web UI ("Web" redundant next to "UI"), Appearance / AppearanceJS (technically clearest but unsearchable), Copland (failed-Apple-project baggage), PlatinumKit / Charcoal (tied to one theme — mismatched scope for a theme engine), Kaleidoscope (collides with the modern git-diff tool), Collidoscope (a Kaleidoscope-flavored alternative considered at the pivot moment — fun but jokey).

## References

- **Canonical architecture spec:** [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md) — the current window-chrome model — plus [`docs/history.md`](./docs/history.md) for how it got there. (The original `docs/kaleidoscope-geometry-spec.md` this charter cited was retired in the v3 reset.) Resource layout (`cicn`, `ppat`, `cinf`, `wnd#`, `Colr`) and bundle schema are documented in [`docs/kaleidoscope-asset-catalog.md`](./docs/kaleidoscope-asset-catalog.md) and [`docs/theme-bundle-layout.md`](./docs/theme-bundle-layout.md).
- **Background reference (no longer a spec target):** [Mac OS 8 HIG, Appearance chapter](https://dev.os9.ca/techpubs/mac/HIGOS8Guide/thig-82.html) — useful for understanding the period design vocabulary; **not** what Scriptoscope implements against. The runtime renders whatever scheme is loaded.
- **Upstream extraction ticket:** [classic-vibe-mac #246](https://github.com/khawkins98/classic-vibe-mac/issues/246)
- **Historical / cv-mac-side Platinum accuracy spec (not an Scriptoscope deliverable):** [classic-vibe-mac #229](https://github.com/khawkins98/classic-vibe-mac/issues/229) — tracks cv-mac's WinBox-era CSS work; retained as reference, not as Scriptoscope acceptance criteria.
- **First consumer:** [classic-vibe-mac](https://github.com/khawkins98/classic-vibe-mac)
- **Comparison: WinBox** — <https://nextapps-de.github.io/winbox/> — the library Scriptoscope replaces in cv-mac.
- **Comparison: 98.css** — <https://jdan.github.io/98.css/> — the Windows 98 equivalent in spirit, though 98.css is hand-authored CSS rather than a format-faithful runtime.
- **Period theme engine: Kaleidoscope** — <https://en.wikipedia.org/wiki/Kaleidoscope_(software)> — the third-party engine for classic Mac OS whose scheme format Scriptoscope implements.
- **Kaleidoscope scheme archives:** [Macintosh Garden — Kaleidoscope](https://macintoshgarden.org/apps/kaleidoscope) (≈4,010 schemes), [Mac Themes Garden](https://macthemes.garden/) (curated, thumbnailed index).
- **Example scheme source:** [mass:werk schemes](https://www.masswerk.at/schemes.php) — N. Landsteiner's author-hosted set of freeware-licensed Platinum-faithful Kaleidoscope schemes, an example of the kind of source the corpus draws from.
