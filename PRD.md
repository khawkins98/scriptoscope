# PRD — Aaron UI

A Mac OS Appearance-style window manager + theme engine for the web.

This document is the project charter, ported from the upstream extraction ticket [classic-vibe-mac #246](https://github.com/khawkins98/classic-vibe-mac/issues/246). When this document and the upstream ticket disagree, **this document wins** — the ticket records the decision moment, but it lives in another repo and won't be updated as Aaron UI evolves.

---

## North Star

A web window manager that **any** project — built with any framework, or no framework at all — can drop in by adding **data attributes to plain HTML**, and that ships an **API-compatible re-implementation of the Mac OS 8/9 Appearance Manager** capable of loading period theme packs and rendering them faithfully on the modern web.

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
  <option value="platinum">Platinum</option>
  <option value="hi-tech">Hi-Tech</option>
  <option value="drawing-board">Drawing Board</option>
</select>
```

**CSS class hooks as a fallback.** Environments where data attributes are awkward (CSP-restricted, some CMSes, some template engines) can use class selectors instead — `.aaron-window`, `.aaron-button`, etc. — with the same semantics. Data attributes are the recommended path because they cleanly separate "this is configuration" from "this is a styling hook," but class fallback exists.

**Imperative API stays available** for dynamic / programmatic cases:

```ts
import { AaronWindow, loadTheme } from 'aaron-ui';

await loadTheme('https://example.com/themes/hi-tech/');
const win = new AaronWindow({
  title: 'Dynamic Window',
  x: 200, y: 200, width: 400, height: 300,
  html: '<p>Created in JS.</p>',
});
```

**Architectural consequence:** the imperative API is the *foundation*; the declarative scanner is a thin layer on top that calls it. Same code path, two front doors.

### 3. An API-compatible re-implementation of the Mac OS 8/9 Appearance Manager — from spec, never from decompile

Aaron UI's **theme bundle format and runtime behavior aim to be conceptually compatible** with how Mac OS 8.5's Appearance Manager loaded themes (Platinum, Hi-Tech, Drawing Board, the Kaleidoscope third-party ecosystem). The goal is that period themes can be adapted into Aaron UI bundles with their *intent preserved* — chrome appearance, control bevels, color palette, desktop picture, system sounds — and rendered faithfully on web pages.

**The implementation is independent and clean-room.** Sources for the re-implementation:

- Apple's published [Mac OS 8 Human Interface Guidelines](https://dev.os9.ca/techpubs/mac/HIGOS8Guide/thig-82.html).
- Archived Apple Appearance Manager API documentation (developer.apple.com legacy / Wayback Machine).
- Period screenshots and visual references from Macintosh Garden, archive.org, and similar archives.
- Public documentation of the Kaleidoscope and Apple theme-bundle formats.
- The visible behavior of real Mac OS 8.5 + Kaleidoscope running under emulation, used as a behavioral oracle.

**What we don't do:**

- We do not look at decompiled Apple source.
- We do not copy Apple's pixel artwork directly. Where period artwork is referenced (e.g., reproducing the Hi-Tech theme's look), we re-author from screenshots rather than extracting from binaries. When in doubt, we ship "inspired by" reinterpretations.
- We do not copy code from leaked Mac OS sources or from clean-room emulator implementations that have themselves derived from such material.

**Architectural consequence:** every visual decision in the default Platinum theme has a HIG citation in the commit message. Every theme port from a period source documents its provenance in `theme.json` (original author, year, source URL, license-of-origin, what we adapted vs. re-authored). The default Platinum theme is auditable from spec.

---

## TL;DR

Aaron UI is a standalone open-source library that gives any web page draggable, resizable windows with authentic Mac OS Appearance Manager chrome. The first-class architectural concept is **themes** (in the literal Mac OS 8.5 sense) — bundles that ship window chrome, controls, desktop background, and system sounds together — with Platinum as the default and a path to load Apple's other official themes, Kaleidoscope-era community themes, and our own.

[classic-vibe-mac](https://github.com/khawkins98/classic-vibe-mac) is the first consumer. It is never a privileged one.

## Why this exists

Three things shifted at once:

1. **The Platinum-fidelity ceiling is real.** cv-mac built a Mac OS 8 Platinum chrome layer on top of [WinBox](https://nextapps-de.github.io/winbox/) and hit a structural wall: ~30% of the remaining authenticity gap can't be closed by CSS overrides because WinBox imposes a fixed DOM (`.wb-header / .wb-body / .wb-n / .wb-ne / …`) where the chrome we need doesn't fit. Scrollbars live inside `.wb-body`, not in a window-frame gutter. There's no slot for a windowshade arrow or status bar. Drag has web-style acceleration, not Mac-instant snap-to-cursor.

2. **AI-agent-assisted development changes the cost equation.** A custom WM is the most well-trodden algorithmic territory in UI history — drag, resize, z-order have been implemented in every windowing toolkit since Smalltalk. With AI assistance, the WM core is ~600-800 lines of TypeScript and a 1-2 day project, plus a week-ish of discovery polish across the following months for edge cases (iPad touch, IME composition, screen-reader semantics). That's a different calculus than the multi-week WM project this would have been in 2019.

3. **The themes angle turns this from "another retro CSS framework" into a product.** Mac OS 8.5's Appearance Manager (an evolution of the 8.0/8.1 system) shipped Platinum as the default and was *designed* to load alternative themes — bundles of chrome + control appearance + desktop pictures + system sounds. Apple shipped a few (Hi-Tech, Drawing Board, Gizmo) though most were pulled before final release. The third-party [Kaleidoscope](https://en.wikipedia.org/wiki/Kaleidoscope_(software)) ecosystem produced thousands. A web library that ships the *theming engine* — not just one fixed look — is a genuinely interesting reproduction of how Mac OS appearance actually worked.

## What it is

- A window manager: open / close / focus / raise / drag / resize / z-order / persistence.
- A Mac OS Appearance-style chrome library: title bars, window controls (close / zoom / windowshade), status bars, growboxes, scrollbars — implemented as theme-able primitives, not hard-coded Platinum.
- A starter set of Appearance-style controls: buttons (push, default, popup, popup-menu), tabs, group boxes/frames, fields, sliders, checkboxes, radios, progress bars, standard alerts/dialogs/sheets.
- **A theme engine.** Themes are first-class bundles that ship together:
  - Window chrome (title bar background, control glyphs, borders, growbox)
  - Control appearance (button bevels, popup styles, scroll thumbs)
  - Desktop background (the picture behind the windows)
  - System sounds (open, close, beep, click, drag, drop, error)
  - Color palette
  - Font(s)
- A starter theme library:
  - **Platinum** — built-in default, hand-authored from the Mac OS 8 HIG.
  - **Apple's official Mac OS 8.5 themes** (Hi-Tech, Drawing Board, Gizmo) — if we can reproduce them with a clean legal posture. "Inspired by" is the fallback.
  - **Curated Kaleidoscope-era community themes** — many thousands exist on Macintosh Garden / ResExcellence archives; adapt a few as web bundles with original-author credit.
  - **New themes** — eventually, our own and community-submitted.
- Framework-agnostic: vanilla TypeScript, no React/Vue/Solid/etc. dependency.
- HIG-faithful by default. Primary spec: <https://dev.os9.ca/techpubs/mac/HIGOS8Guide/thig-82.html>.

## What it isn't

- An emulator. cv-mac has one.
- A full AppKit / Carbon reproduction. No NSTextView, no NSScrollView, no view-controller hierarchy.
- Mobile-first. Touch should work as a fallback but isn't the primary target.
- A theme authoring tool (initially). Theme bundles are authored by hand or with external tooling. A theme-builder UI is a separate possible future project.
- Coupled to cv-mac.

## Target consumers

1. **cv-mac itself.** We need this. If no one else ever uses it, that's still fine.
2. **Retro / period-software web projects** — emulator sites, retro games, abandonware archives, "look like Mac OS 8" portfolios.
3. **The retro-theming community.** Anyone who'd want to ship a Kaleidoscope theme as a web bundle that anyone can load.
4. **Educational / demo projects** teaching HCI history or interface design.
5. **The long tail** of devs who'd say "I'd ship this if there were a drop-in Mac OS Appearance theme engine, the way [98.css](https://jdan.github.io/98.css/) exists for Windows 98."

## Core principles

The North Star (above) is principles 1-3. The remaining four:

4. **HIG-faithful or it doesn't ship** (for the engine and the default Platinum theme). Alternative themes are free to deviate — that's the point of themes.
5. **Theme bundles are first-class.** Themes aren't CSS overrides on top of a Platinum baseline; they're complete bundles that fully describe a look (chrome + controls + desktop + sounds + colors + fonts). The engine loads themes; it doesn't bake one in.
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
<!-- Tell the page which theme to use. -->
<html data-aaron-theme="hi-tech">
  <head>
    <link rel="stylesheet" href="aaron-ui.css">
    <script type="module" src="aaron-ui.js"></script>
    <link rel="aaron-theme" href="/themes/hi-tech/theme.json">
  </head>
  <body>
    <div data-aaron-window data-aaron-title="Window">...</div>
  </body>
</html>
```

**Imperative (for dynamic / programmatic cases):**

```ts
import { loadTheme, AaronWindow } from 'aaron-ui';

await loadTheme('https://example.com/themes/hi-tech/');
const win = new AaronWindow({ title: 'Window', html: '...' });
```

Themes are **switchable at runtime**. The headline marketing artifact is a demo page showing the same windows under Platinum → Hi-Tech → Drawing Board → a community theme, one click each — declaratively, by changing a single `data-aaron-theme` attribute on `<html>`.

## Phased delivery

Sketch, not commitment. Maintainer may re-split.

- **Phase 1 — WM core.** Window class, drag, 8-direction resize, z-order, focus, raise-on-click, programmatic open/close/focus, mount/unmount lifecycle. **Two integration surfaces:** the imperative TS class API (foundation), and the declarative `data-aaron-window` scanner that calls into it on `DOMContentLoaded` + `MutationObserver`. **API-compatible with WinBox** at the imperative call-site level so cv-mac can swap with minimal diff.
- **Phase 2 — Platinum chrome (default theme).** Pinstripe title bar, paper title pill, ink-bordered close box (left), zoom + windowshade controls (right), integrated grow box, optional status bar, diagonal-stripe corner. Replace WinBox in cv-mac.
- **Phase 3 — Core controls.** Buttons (push, default with thick black outline, popup-menu with arrow box), tabs (merged with content panel), group boxes/frames, fields, popup menus, checkboxes, radios.
- **Phase 4 — Theme engine.** Theme bundle format, loader, runtime switching, sound triggering, desktop background mounting. The first non-Platinum theme (likely Hi-Tech or a curated Kaleidoscope-era community theme) lands here as the proof.
- **Phase 5 — Dialogs & sheets.** Standard alert (note / caution / stop), modal dialog, sheet animations.
- **Phase 6 — Polish.** Animations (zoom-to-icon close, windowshade roll-up), advanced theming hooks, demo site showcasing the theme library.

## Non-goals (worth restating)

- No reimplementing AppKit.
- No state-management opinion. Consumers wire data however they like.
- No build-step requirement. Consumers should be able to drop a `<script>` tag and CDN-load.
- No IE / pre-2020 browser support. Modern evergreens only.
- Not a theme authoring tool (initially).

## Architecture sketches

These are suggestions, not decisions. Phase 1 will pin them down.

- **Vanilla TS class API as the primary interface.** Optional web-component wrapper for declarative use.
- **CSS custom properties drive the theme system.** Each theme defines its own values. The engine ships a documented property catalog (`--aaron-titlebar-bg`, `--aaron-default-button-outline-width`, etc.) that themes set.
- **No JS dependencies in the core.** dev-deps (TypeScript, bundler) only.
- **WinBox API-compatible drop-in** at boot time in cv-mac: a thin adapter so `new AaronWindow({title, x, y, width, height, html, onclose})` matches the current WinBox call signature. One-day swap in cv-mac with zero behavioral change at merge, then progressively use the new DOM control to unlock features in separate small PRs.

## Success criteria

1. cv-mac swaps WinBox for Aaron UI in a single PR with zero behavioral regression at merge.
2. A third party can `npm install aaron-ui` (or `<script src>`) and have draggable Platinum windows on a page in <50 LOC.
3. At least two non-Platinum themes load and switch live without page reload.
4. Visual spot-check against the Mac OS 8 HIG: under the default Platinum theme, a panel of 5–10 controls renders pixel-faithfully enough that someone who used Mac OS 8 in 1998 would recognise it instantly.
5. Bundle ≤30 KB gzipped for the WM + Platinum theme.
6. Accessibility audit (axe / keyboard-only walkthrough) passes for the core controls.

## License

**Deliberately undecided.** Three real candidates:

- **MIT / Apache-2.0** — best for adoption; consumers can embed without worrying about copyleft.
- **LGPL** — copyleft on the library itself but consumers can dynamically link without their app inheriting; classic library license.
- **GPL-3.0-or-later** — matches the cv-mac / wasm-retro-cc family; honest if the project values share-back over adoption.

The right answer depends on how much we want Aaron UI used by closed-source projects. There is no defaulting to "match the upstream family" here, because this isn't a fork or extension of cv-mac — it's a separate sibling that may have a different lifecycle and consumer base.

**Decision deferred until after Phase 1 ships** and we have a sense of who's actually picking it up.

## Open questions for v1.0

1. **Scope for v1.0** — Phase 1 (WM core) only, or Phases 1-4 (WM + Platinum theme + controls + theme engine) as the v1.0 target?
2. **License** — see §License above. Resolve after Phase 1 ships.
3. **Legal pass on theme reproductions.** Reproducing Apple's official Mac OS 8.5 themes (Hi-Tech, Drawing Board, etc.) needs a real licensing look. "Inspired by" reproductions are safest; literal artwork reproduction may have issues. Not blocking Phase 1-3; should be decided before Phase 4.
4. **Web Components alongside the class API** — yes from v1.0, or defer?

## Naming (decision recorded)

**Chosen: Aaron UI.** After *Aaron*, the Apple internal codename for the Copland-era demo that previewed both the Appearance Manager and the Platinum default theme. The `UI` suffix sits in the established `[Name] UI` family (Material UI, Chakra UI, Shadcn UI) and is self-describing for newcomers who don't know the Aaron reference.

Alternatives considered (preserved for posterity): Aaron alone (unsearchable), AaronKit (assumes knowledge of the reference), AaronJS (generic), Mac-Aaron (trademark exposure), Aaron Web UI ("Web" redundant next to "UI"), Appearance / AppearanceJS (technically clearest but unsearchable), Copland (failed-Apple-project baggage), PlatinumKit / Charcoal (tied to one theme — mismatched scope for a theme engine), Kaleidoscope (collides with the modern git-diff tool).

## References

- **Primary visual spec:** [Mac OS 8 HIG, Appearance chapter](https://dev.os9.ca/techpubs/mac/HIGOS8Guide/thig-82.html)
- **Upstream extraction ticket:** [classic-vibe-mac #246](https://github.com/khawkins98/classic-vibe-mac/issues/246)
- **Per-element Platinum accuracy spec (Phase 2 acceptance):** [classic-vibe-mac #229](https://github.com/khawkins98/classic-vibe-mac/issues/229)
- **First consumer:** [classic-vibe-mac](https://github.com/khawkins98/classic-vibe-mac)
- **Comparison: WinBox** — <https://nextapps-de.github.io/winbox/> — the library Aaron UI replaces in cv-mac.
- **Comparison: 98.css** — <https://jdan.github.io/98.css/> — the Windows 98 equivalent in spirit.
- **Period reference: Kaleidoscope** — <https://en.wikipedia.org/wiki/Kaleidoscope_(software)> — the third-party theme engine for classic Mac OS that defined the genre.
- **Inside Macintosh: Appearance Manager** — archived Apple developer documentation (search Wayback for `developer.apple.com/legacy/library/documentation/Carbon/Reference/Appearance_Manager/`).
