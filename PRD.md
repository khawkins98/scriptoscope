# PRD — Aaron UI

A Mac OS Appearance-style window manager + theme engine for the web.

This document is the project charter, ported from the upstream extraction ticket [classic-vibe-mac #246](https://github.com/khawkins98/classic-vibe-mac/issues/246). When this document and the upstream ticket disagree, **this document wins** — the ticket records the decision moment, but it lives in another repo and won't be updated as Aaron UI evolves.

---

## North Star

A web window manager that **any** project — built with any framework, or no framework at all — can drop in by adding **data attributes to plain HTML**, and that ships a **runtime for the Kaleidoscope theme corpus**: loads `.ksc` schemes directly (chrome `cicn`s, tile patterns, geometry metadata, color schemes) and renders them faithfully in CSS / SVG / JS, no hand-authoring required.

This compresses to three principles, each of which constrains downstream architecture:

### 1. Framework-agnostic by default

No React peer dep, no Vue plugin, no Solid integration layer. Aaron UI is plain TypeScript + CSS that works wherever HTML works:

- Vanilla DOM apps.
- Server-rendered HTML from any backend (Rails, Django, Laravel, PHP, Go templates, static-site generators).
- Every modern JS framework, used as escape-hatch components.
- htmx / Alpine / petite-vue and similar HTML-augmenting libraries.
- A single `<script>` tag on an otherwise-static page.

**Architectural consequence:** the core ships as ES modules with no JS dependencies. dev-deps only (TypeScript, bundler). The public API surface is HTML attributes + CSS custom properties first; an imperative TS class API exists but is not the primary integration story.

### 2. Declarative-first integration via data attributes

The primary integration path is markup-only. The library scans the DOM (on `DOMContentLoaded` and via a `MutationObserver` for dynamic additions) for elements bearing `data-aaron-*` attributes and promotes them into the right Aaron UI control. No one should *need* to write JS to use the library for the common case.

```html
<link rel="stylesheet" href="aaron-ui.css">
<script type="module" src="aaron-ui.js"></script>

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
  <option value="masswerk-7-le">mass:werk 7 Le (Platinum, bundled default)</option>
  <option value="masswerk-dark-ergobox2">mass:werk Dark ErgoBox 2</option>
  <option value="https://example.com/themes/your-scheme/">A scheme served from somewhere else</option>
</select>
```

**CSS class hooks as a fallback.** Environments where data attributes are awkward (CSP-restricted, some CMSes, some template engines) can use class selectors instead — `.aaron-window`, `.aaron-button`, etc. — with the same semantics. Data attributes are the recommended path because they cleanly separate "this is configuration" from "this is a styling hook," but class fallback exists.

**Imperative API stays available** for dynamic / programmatic cases:

```ts
import { AaronWindow, loadTheme } from 'aaron-ui';

await loadTheme('https://example.com/themes/masswerk-7-le/');
const win = new AaronWindow({
  title: 'Dynamic Window',
  x: 200, y: 200, width: 400, height: 300,
  html: '<p>Created in JS.</p>',
});
```

**Architectural consequence:** the imperative API is the *foundation*; the declarative scanner is a thin layer on top that calls it. Same code path, two front doors.

### 3. Kaleidoscope-compatibility runtime, clean-room from Kaleidoscope itself

Aaron UI is **a web-native runtime for the Kaleidoscope theme genre — not a re-authoring project.** Period themes authored as Kaleidoscope schemes (`.ksc` files) are the corpus *and* the input format. We read their compiled resources (`cicn`, `ppat`, `cinf`, `wnd#`, `Colr`) directly, via the [scheme-extractor](./tools/scheme-extractor/) pipeline, and re-implement the *rendering* entirely in our own CSS / SVG / JS — Aaron UI never uses Kaleidoscope's source code, but it does honour Kaleidoscope's data layout.

**A consequence worth naming: classic-Mac Kaleidoscope authoring tools become Aaron UI authoring tools.** Anyone with ResEdit + the period Kaleidoscope SDK (or a modern emulator running them) can produce a `.ksc` that Aaron UI will load. The format is the contract; the runtime is incidental.

We do **not** hand-author chrome from the HIG; we do **not** ship a first-party Platinum theme. The bundled default is mass:werk's freeware "7 Le" scheme — a community-authored Platinum-faithful Kaleidoscope reference — loaded through the same code path as every other theme.

**The clean-room boundary is from Kaleidoscope's source code, not from scheme assets.** This is the same distinction that holds for any reader of a file format: a Photoshop `.psd` parser can read files without touching Photoshop's source. Specifically:

- **We do** read and extract assets from Kaleidoscope scheme files (`.ksc`) whose original authors explicitly licensed them as freeware-with-redistribution. We use those assets *as* the rendered chrome — no copy-and-redraw step, the runtime composites the same raster/metadata Kaleidoscope did.
- **We do** read Kaleidoscope's *published format documentation* (SDK docs, scheme-authoring guides — mirrored on Wayback) and the `TMPL` resources every scheme embeds, which self-document the binary layout.
- **We do not** read Kaleidoscope's source code (the closed engine itself).
- **We do not** read decompiled Mac OS Toolbox source or clean-room emulator implementations that have themselves derived from such material.
- **Apple's own themes (`.afm`: Hi-Tech, Drawing Board, Gizmo) are out of scope.** License friction with Apple isn't worth managing, and the Kaleidoscope corpus is large enough (≈4,010 schemes, many Platinum-faithful, many freeware) that we don't need them.
- **We do not hand-author chrome from Apple's HIG.** The HIG remains useful background reading, but Aaron UI's job is to faithfully render whatever scheme the user loads — not to produce a competing first-party Platinum interpretation. The 2026-05-17 LEARNINGS entry "Aaron UI is a Kaleidoscope-compatibility runtime, not a Platinum re-author" records the pivot.

**Architectural consequence:** every theme bundle Aaron UI ships documents its provenance in `theme.json` — original Kaleidoscope scheme author, year, source URL, the readme-stated license. The bundled default is mass:werk's freeware "7 Le" scheme; no first-party Platinum is authored, ever. No Apple binaries are touched at any stage.

---

## TL;DR

Aaron UI is a standalone open-source library that gives any web page draggable, resizable windows with authentic Mac OS-era chrome. The first-class architectural concept is **themes** — loadable Kaleidoscope schemes (chrome `cicn`s + tile `ppat`s + `cinf`/`wnd#` geometry + `Colr` palette) read by Aaron UI's runtime and rendered with CSS / SVG / JS. The bundled default is mass:werk's freeware "7 Le" scheme; loading any other freeware-licensed Kaleidoscope scheme is a single `loadTheme()` call. Aaron UI never hand-authors a competing first-party theme.

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
- **A theme runtime, not a theme authoring effort.** Aaron UI consumes Kaleidoscope schemes directly. What a loaded scheme provides:
  - Window chrome (`cicn` window-frame composites; `wnd#` part rects; per-side edge recipes)
  - Control appearance (`cicn` state-variant artwork per control; `cinf` 9-slice metadata)
  - Tileable patterns (`ppat` resources for body backgrounds, scrollbar tracks, etc.)
  - Color palette (`Colr` scheme settings)
  - *Not* desktop background, system sounds, or fonts — Kaleidoscope schemes in practice didn't carry these; Aaron UI doesn't fabricate them.
- A starter theme library:
  - **Bundled default: mass:werk's "7 Le"** — Platinum-faithful, freeware-licensed, single-author provenance. Shipped inside the npm package so `import 'aaron-ui'` renders something immediately, with no extra fetch.
  - **Loadable Kaleidoscope schemes from the wider corpus** — ≈4,010 schemes on Macintosh Garden / Mac Themes Garden archives. Any with explicit freeware-with-redistribution readmes can be loaded via the extractor → `theme.json` pipeline, then served from any URL.
  - **Newly-authored schemes** — produced via period Kaleidoscope authoring tools (ResEdit + the Kaleidoscope SDK, on classic Mac OS or under emulation) and dropped into Aaron UI directly. Because we honour Kaleidoscope's format as the contract, the long-dormant authoring toolchain becomes a live authoring path again.

(Framework-agnostic, HIG-faithful, and the integration model are all spelled out in §North Star above; not repeated here to avoid drift.)

## What it isn't

- An emulator. cv-mac has one.
- A full AppKit / Carbon reproduction. No NSTextView, no NSScrollView, no view-controller hierarchy.
- Mobile-first. Touch should work as a fallback but isn't the primary target.
- A theme authoring tool (initially). Theme bundles are authored by hand or with external tooling. A theme-builder UI is a separate possible future project.
- Tied to cv-mac. cv-mac is the first consumer; never a privileged one. No cv-mac-specific code, conventions, or assumptions leak into Aaron UI.

## Target consumers

1. **cv-mac itself.** We need this. If no one else ever uses it, that's still fine.
2. **Retro / period-software web projects** — emulator sites, retro games, abandonware archives, "look like Mac OS 8" portfolios.
3. **The retro-theming community.** Anyone who'd want to publish a Kaleidoscope scheme as a web-loadable theme. Because Aaron UI honours the `.ksc` format directly, **classic-Mac authoring tools (ResEdit + the Kaleidoscope SDK) become live authoring tools again** — author on a real machine or under SheepShaver, drop the `.ksc` through the extractor, serve.
4. **Educational / demo projects** teaching HCI history or interface design.
5. **The long tail** of devs who'd say "I'd ship this if there were a drop-in Mac OS Appearance theme engine, the way [98.css](https://jdan.github.io/98.css/) exists for Windows 98."

## Core principles

The North Star (above) is principles 1-3. The remaining four:

4. **Scheme-faithful or it doesn't ship.** When Aaron UI loads a Kaleidoscope scheme, the rendered result should match Kaleidoscope's own output as closely as the modern web allows — `cinf` 9-slice geometry honored, `ppat` body composition honored, `wnd#` part rects honored. Faithfulness is to the *loaded scheme*, not to any external HIG reference. (If a scheme deviates from HIG, that's the scheme's authorial choice; we render what's there.)
5. **Schemes are first-class; Aaron UI bakes nothing in.** No first-party Platinum, no first-party anything. The runtime ships chrome only through loaded schemes — including the bundled default. If the bundled default is removed, the WM works but renders un-styled (the "engine fallback" state); that's intentional.
6. **DOM-light, CSS-heavy.** Chrome is CSS-driven so themes can be authored without forking the engine. JS only where it has to be (drag, focus, persistence, sound triggering, theme loading, the declarative scanner).
7. **Accessibility considered from the start, not retrofitted.** Real keyboard nav, real ARIA, real focus management. Period-correct UX should not mean inaccessible.
8. **Bundle-size honest.** Tree-shakeable; gzipped target for core WM + Platinum theme should be competitive with WinBox (~30 KB minified / ~10 KB gz).
9. **No breaking changes after 1.0** without a major version bump.

## Theme system (the key architectural primitive)

Themes are loadable bundles. The exact format is for v0.x design to settle, but the shape is roughly:

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
     a Phase 1 / Phase 4 design call; this is illustrative. -->
<html data-aaron-theme="masswerk-7-le">
  <head>
    <link rel="stylesheet" href="aaron-ui.css">
    <script type="module" src="aaron-ui.js"></script>
    <link rel="aaron-theme" href="/themes/masswerk-7-le/theme.json">
  </head>
  <body>
    <div data-aaron-window data-aaron-title="Window">...</div>
  </body>
</html>
```

**Imperative (for dynamic / programmatic cases):**

```ts
import { loadTheme, AaronWindow } from 'aaron-ui';

await loadTheme('https://example.com/themes/masswerk-7-le/');
const win = new AaronWindow({ title: 'Window', html: '...' });
```

Themes are **switchable at runtime**. The headline marketing artifact is a demo page showing the same windows under mass:werk 7 Le → Dark ErgoBox 2 → another curated community scheme, one click each — declaratively, by changing a single `data-aaron-theme` attribute on `<html>`. (See `demo/themes.html` for an early walking skeleton of this.)

## Phased delivery

Sketch, not commitment. Maintainer may re-split. Each phase has a GitHub milestone + a tracker epic issue with full acceptance criteria.

- ✅ **Phase 1 — WM core.** *Shipped.* Window class, drag, 8-direction resize, z-order, focus, raise-on-click, programmatic open/close/focus/minimize/maximize, mount/unmount lifecycle, declarative `data-aaron-window` scanner, ARIA + keyboard + focus-trap on modals. Live at https://khawkins98.github.io/aaron-ui/. [Milestone](https://github.com/khawkins98/aaron-ui/milestone/1) · 10 issues, all closed · 140 unit + 30 e2e tests · ~7 KB gzipped.
- ❌ **Phase 2 — Platinum chrome (default theme).** *Dropped 2026-05-17.* Hand-authoring a Platinum theme from the HIG would duplicate mass:werk's freeware "7 Le" scheme (already Platinum-faithful) and weaken the "Aaron UI is a Kaleidoscope-compatibility runtime" product story. Phase 2 collapses into Phase 4. The bundled default is "7 Le", loaded through the same runtime as every other scheme. See [LEARNINGS entry "Aaron UI is a Kaleidoscope-compatibility runtime, not a Platinum re-author"](./LEARNINGS.md) and the closing comment on [#21](https://github.com/khawkins98/aaron-ui/issues/21).
- **Phase 3 — Core controls.** Wire each control class (push button, default button, checkbox, radio, popup menu, tab, slider, progress, scrollbar) to consume `cicn` state-variant artwork + `cinf` 9-slice metadata from the loaded scheme. State machinery (`:active`, `[aria-disabled]`, `[data-checked]`) toggles the underlying asset URL. [Tracker issue #22](https://github.com/khawkins98/aaron-ui/issues/22).
- **Phase 4 — Theme engine (absorbs former Phase 2).** Theme bundle format (per [`docs/kaleidoscope-geometry-spec.md`](./docs/kaleidoscope-geometry-spec.md) §7), `loadTheme()` API, runtime switching, `ppat` composition layer, `wnd#`-driven part-rect hit testing, `cinf`-driven 9-slice. Ship mass:werk's "7 Le" as bundled default and at least one additional loadable scheme (mass:werk's "Dark ErgoBox 2" is the current Tier-2 candidate). [Tracker issue #23](https://github.com/khawkins98/aaron-ui/issues/23).
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

These were suggestions when written; Phase 1 has now shipped and pinned them down. See [`src/window-manager/`](./src/window-manager/) for the actual implementation choices, and [`docs/runtime-rendering-architecture.md`](./docs/runtime-rendering-architecture.md) for the canonical output-contract spec covering DOM model, CSS strategy, composition layers, control state machine, WM↔runtime seam, and lifecycle sequences — the artifact Phase 4 tickets build against.

- **Two integration surfaces, declarative-first per the North Star:**
  - **Primary:** declarative scanner — on `DOMContentLoaded` and via `MutationObserver`, the library scans for `[data-aaron-window]` / `[data-aaron-button]` / etc. and promotes them into Aaron UI controls. CSS class selectors (`.aaron-window`, …) accepted as a fallback.
  - **Foundation:** imperative TypeScript class API (`new AaronWindow({...})`, `loadTheme(url)`) underneath. The scanner just calls into it. Both surfaces share one code path.
  - Web-component wrapper as a *possible* additional layer — see Open Question 4 below; not yet committed.
- **CSS custom properties drive the theme system.** Each theme defines its own values. The engine ships a documented property catalog (`--aaron-titlebar-bg`, `--aaron-default-button-outline-width`, etc.) that themes set.
- **No JS dependencies in the core.** dev-deps (TypeScript, bundler) only.
- **WinBox compatibility shim is cv-mac's responsibility, not Aaron UI's.** cv-mac currently calls `new WinBox({title, x, y, width, height, html, onclose})` in many places. To enable a one-day swap, cv-mac will write a thin adapter wrapping Aaron UI's imperative API to match the WinBox signature. Aaron UI itself does *not* ship a WinBox-compat layer — that would couple it to a library it's replacing. This is an intentional separation.

## Success criteria

1. cv-mac swaps WinBox for Aaron UI in a single PR with zero behavioral regression at merge.
2. A third party can `npm install aaron-ui` (or `<script src>`) and have draggable, mass:werk-7-Le-themed windows on a page in <50 LOC.
3. At least two Kaleidoscope schemes load and switch live without page reload (the bundled 7 Le plus one additional loaded from an external URL).
4. Visual spot-check against the source scheme: under the loaded mass:werk 7 Le, a panel of 5–10 controls renders pixel-faithfully enough that someone comparing against Kaleidoscope's own scheme preview would recognise it as the same scheme.
5. Bundle ≤30 KB gzipped for the WM core + theme runtime (excluding the bundled-default scheme's PNG assets, which are accounted separately).
6. Accessibility audit (axe / keyboard-only walkthrough) passes for the core controls.

## License

**Deliberately undecided.** Three real candidates:

- **MIT / Apache-2.0** — best for adoption; consumers can embed without worrying about copyleft.
- **LGPL** — copyleft on the library itself but consumers can dynamically link without their app inheriting; classic library license.
- **GPL-3.0-or-later** — matches the cv-mac / wasm-retro-cc family; honest if the project values share-back over adoption.

The right answer depends on how much we want Aaron UI used by closed-source projects. There is no defaulting to "match the upstream family" here, because this isn't a fork or extension of cv-mac — it's a separate sibling that may have a different lifecycle and consumer base.

**Decision still deferred** but now actionable — Phase 1 has shipped. Tracked at [issue #26](https://github.com/khawkins98/aaron-ui/issues/26), which carries a non-binding recommendation (MIT) for discussion before Phase 4 (theme engine) ships.

## Open questions for v1.0

1. **Scope for v1.0** — Phase 1 (WM core) only, or Phases 1+3+4 (WM + controls + theme runtime with bundled 7 Le) as the v1.0 target? *(Phase 1 has now shipped; Phase 2 has been dropped 2026-05-17 with its scope absorbed into Phase 4; npm-publish tracker [#28](https://github.com/khawkins98/aaron-ui/issues/28) will revisit.)*
2. **License** — see §License above. Tracker: [#26](https://github.com/khawkins98/aaron-ui/issues/26).
3. ~~**Legal pass on theme reproductions.**~~ **Resolved 2026-05-16:** Apple's own themes (Hi-Tech, Drawing Board, Gizmo) are out of scope entirely — license friction isn't worth it. Aaron UI focuses on Kaleidoscope-corpus schemes, prioritizing those with explicit freeware-with-redistribution readmes. See LEARNINGS entry "Apple themes dropped; Kaleidoscope is the corpus."
4. **Web Components alongside the class API** — yes from v1.0, or defer? Tracker: [#29](https://github.com/khawkins98/aaron-ui/issues/29) (non-binding recommendation: defer).

## Naming (decision recorded)

**Chosen: Aaron UI.** After *Aaron*, the Apple internal codename for the Copland-era demo that previewed both the Appearance Manager and the Platinum default theme. The `UI` suffix sits in the established `[Name] UI` family (Material UI, Chakra UI, Shadcn UI) and is self-describing for newcomers who don't know the Aaron reference.

**Etymology note (updated 2026-05-17):** with the project now scoped as a *Kaleidoscope-compatibility runtime* — not an Appearance Manager re-implementation, and explicitly not a Platinum re-author — the connection to the original Aaron codename is loose. Poetic origin story, not tight technical description. The name is retained because (a) renaming costs are real and (b) the `[Name] UI` family signals "UI library" cleanly. The README spells out the looser etymology so the gap doesn't surprise anyone.

Alternatives considered (preserved for posterity): Aaron alone (unsearchable), AaronKit (assumes knowledge of the reference), AaronJS (generic), Mac-Aaron (trademark exposure), Aaron Web UI ("Web" redundant next to "UI"), Appearance / AppearanceJS (technically clearest but unsearchable), Copland (failed-Apple-project baggage), PlatinumKit / Charcoal (tied to one theme — mismatched scope for a theme engine), Kaleidoscope (collides with the modern git-diff tool), Collidoscope (a Kaleidoscope-flavored alternative considered at the pivot moment — fun but jokey).

## References

- **Canonical architecture spec:** [`docs/kaleidoscope-geometry-spec.md`](./docs/kaleidoscope-geometry-spec.md) — Kaleidoscope resource layout (`cicn`, `ppat`, `cinf`, `wnd#`, `Colr`), proposed `theme.json` schema, mapping to Aaron UI primitives.
- **Background reference (no longer a spec target):** [Mac OS 8 HIG, Appearance chapter](https://dev.os9.ca/techpubs/mac/HIGOS8Guide/thig-82.html) — useful for understanding the period design vocabulary; **not** what Aaron UI implements against. The runtime renders whatever scheme is loaded.
- **Upstream extraction ticket:** [classic-vibe-mac #246](https://github.com/khawkins98/classic-vibe-mac/issues/246)
- **Historical / cv-mac-side Platinum accuracy spec (not an Aaron UI deliverable):** [classic-vibe-mac #229](https://github.com/khawkins98/classic-vibe-mac/issues/229) — tracks cv-mac's WinBox-era CSS work; retained as reference, not as Aaron UI acceptance criteria.
- **First consumer:** [classic-vibe-mac](https://github.com/khawkins98/classic-vibe-mac)
- **Comparison: WinBox** — <https://nextapps-de.github.io/winbox/> — the library Aaron UI replaces in cv-mac.
- **Comparison: 98.css** — <https://jdan.github.io/98.css/> — the Windows 98 equivalent in spirit, though 98.css is hand-authored CSS rather than a format-faithful runtime.
- **Period theme engine: Kaleidoscope** — <https://en.wikipedia.org/wiki/Kaleidoscope_(software)> — the third-party engine for classic Mac OS whose scheme format Aaron UI implements.
- **Kaleidoscope scheme archives:** [Macintosh Garden — Kaleidoscope](https://macintoshgarden.org/apps/kaleidoscope) (≈4,010 schemes), [Mac Themes Garden](https://macthemes.garden/) (curated, thumbnailed index).
- **Bundled default scheme reference:** [mass:werk schemes](https://www.masswerk.at/schemes.php) — N. Landsteiner's author-hosted set, including "7 Le" (Platinum-faithful, bundled as Aaron UI's default) and "Dark ErgoBox 2" (BeOS-tab dark, Tier-2 loadable candidate), both freeware-licensed.
