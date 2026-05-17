# Aaron UI

A web-native runtime for [Kaleidoscope](https://en.wikipedia.org/wiki/Kaleidoscope_(software)) themes — and the window manager that hosts them.

Drop it into any page to get draggable, resizable windows. Then load any freeware-licensed Kaleidoscope scheme — System 7, Platinum, BeOS-tab, anything in the ≈4,010-scheme corpus — and the windows render with its chrome, controls, and colors. Aaron UI doesn't hand-author a "Platinum theme." It reads `cicn` / `ppat` / `cinf` / `wnd#` resources out of `.ksc` files and renders them with CSS, SVG, and JS. The default look you get when you `import 'aaron-ui'` is mass:werk's freeware-licensed "7 Le" scheme — a community-authored Platinum-faithful Kaleidoscope theme, bundled.

> **Status: Phase 1 + most of Phase 4 shipped.** WM core (drag, resize, z-order, focus, ARIA, declarative scanner) plus the full theme runtime — schema + extractor + canonical bundles + `loadTheme()` + cinf/ppat/wnd# renderers + theme switching + bundled-default auto-load. `import 'aaron-ui'` now triggers the bundled mass:werk 7 Le scheme to fetch + apply on `DOMContentLoaded`; opt out via `import 'aaron-ui/no-default'`. Live demo: <https://khawkins98.github.io/aaron-ui/>. CI status: <https://github.com/khawkins98/aaron-ui/actions>.
>
> **Phase 2 reframe (2026-05-17):** the original Phase 2 ("hand-author Platinum chrome from the HIG") is dropped. Aaron UI is a Kaleidoscope-compatibility runtime, not a theme re-authoring project — recreating Platinum from the HIG when mass:werk's "7 Le" already exists as freeware would duplicate work and weaken the product story. Phase 2 and Phase 4 collapse into one effort: ship the theme-engine runtime, with 7 Le as the bundled default. See [LEARNINGS.md](./LEARNINGS.md) for the full reasoning and [issue #23](https://github.com/khawkins98/aaron-ui/issues/23) for the work.

## Quick start

```sh
npm install aaron-ui
```

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module">
      // Default entry — auto-loads mass:werk 7 Le from `themes/masswerk-7-le/`.
      // Make sure your web server is hosting that path (the npm package
      // ships the files at `themes/masswerk-7-le/` for direct copying).
      import { AaronWindow, attachThemeToWindow } from 'aaron-ui';
      window.addEventListener('DOMContentLoaded', () => {
        const w = new AaronWindow({ title: 'Hi', width: 320, height: 200 });
        w.mount(document.body);
        attachThemeToWindow(w.element); // chrome paints on first themechange
      });
    </script>
  </head>
  <body></body>
</html>
```

Opt out of the auto-load (own theme loading entirely):

```js
import { AaronWindow, loadTheme, attachThemeToWindow } from 'aaron-ui/no-default';
await loadTheme('/path/to/your/scheme/');
// ... same as above
```

Override where the default is fetched from (e.g., CDN hosting):

```js
import { setBundledDefaultUrl, AaronWindow } from 'aaron-ui';
setBundledDefaultUrl('https://cdn.example.com/aaron/themes/masswerk-7-le/');
// ... AaronWindow usage proceeds; auto-load fires against the new URL
```

## North Star

A web window manager that **any** project — built with any framework, or no framework at all — can drop in by adding **data attributes to plain HTML**, and that ships a **Kaleidoscope-style theme engine** capable of loading freeware-licensed period theme bundles and rendering them faithfully on the modern web.

Three principles do the load-bearing work:

1. **Framework-agnostic by default.** No React peer dep, no Vue plugin, no Solid integration layer. Aaron UI is plain TypeScript + CSS that works wherever HTML works — vanilla DOM, htmx, server-rendered Rails/Django/Laravel, every JS framework, and a `<script>` tag on a static page.

2. **Declarative-first integration via data attributes.** The primary integration path is markup-only: add `data-aaron-window` (with `data-aaron-title`, `data-aaron-x`, etc.) to any element and Aaron UI promotes it into a draggable window on load. An imperative class-based API is available for dynamic cases, but no one should *need* to write JS to use the library. CSS class hooks (`.aaron-window`, etc.) are accepted as a fallback for environments where data attributes are awkward.

   ```html
   <!-- This is the entire integration. -->
   <link rel="stylesheet" href="aaron-ui.css">
   <script type="module" src="aaron-ui.js"></script>

   <div data-aaron-window
        data-aaron-title="Welcome"
        data-aaron-x="100" data-aaron-y="80"
        data-aaron-width="380" data-aaron-height="240">
     <p>Drop this on any page and it becomes a Platinum window.</p>
   </div>
   ```

3. **A Kaleidoscope-compatibility runtime, clean-room from Kaleidoscope's code.** Aaron UI is a *runtime for an existing corpus*, not a new theme-authoring project. It reads Kaleidoscope resource bundles (`cicn`, `ppat`, `cinf`, `wnd#`, `Colr`) directly via the [scheme-extractor](./tools/scheme-extractor/) pipeline and renders them with CSS, SVG, and JS per [`docs/kaleidoscope-geometry-spec.md`](./docs/kaleidoscope-geometry-spec.md). The corpus is the ≈4,010 community-authored schemes on [Macintosh Garden](https://macintoshgarden.org/apps/kaleidoscope) and [Mac Themes Garden](https://macthemes.garden/), prioritizing those with explicit freeware-with-redistribution readmes. **We extract compiled assets from individual schemes** (with the author's stated permission) and **re-implement the rendering entirely in our own code** — Aaron UI never uses Kaleidoscope's source code. Apple's own themes (Hi-Tech, Drawing Board, Gizmo) are deliberately out of scope, and **Aaron UI does not hand-author chrome from the HIG** — for the Platinum look, we ship mass:werk's freeware "7 Le" scheme bundled as the default. Every shipped theme bundle carries provenance metadata (original author, source URL, license-of-origin); the only first-party visual artifacts Aaron UI produces are the un-themed engine fallbacks needed when no scheme has loaded yet.

> The name "Aaron" comes from Apple's internal codename for the Copland-era demo that previewed the Appearance Manager and Platinum default theme. With the project now scoped as a *Kaleidoscope-compatibility runtime* (not Appearance Manager re-implementation, not Platinum re-author), the etymology is poetic origin rather than tight description — and that's fine.

## Where the idea came from

Aaron UI was extracted from the [classic-vibe-mac](https://github.com/khawkins98/classic-vibe-mac) project — a System 7.5.5 emulator + in-browser C compiler running in a tab. cv-mac built a Mac OS 8 Platinum chrome layer on top of WinBox over several months and eventually hit a ceiling: roughly 70% of the Platinum gap was CSS work in cv-mac's own court, ~15% could be closed by a thin shell layer, but ~30% of the remaining authenticity was structural to WinBox itself (fixed DOM hierarchy, scrollbars-inside-body geometry, no slot for windowshade arrow or status bar, drag with web-style acceleration). The honest move was to own the window manager.

The full extraction context, decision trail, and naming rationale are in the upstream charter ticket:

- **[classic-vibe-mac #246](https://github.com/khawkins98/classic-vibe-mac/issues/246)** — PRD: Aaron UI — Mac OS Appearance-style window manager + theme engine for the web

For the visual specification Aaron UI's default Platinum theme must achieve, see:

- **[classic-vibe-mac #229](https://github.com/khawkins98/classic-vibe-mac/issues/229)** — Platinum chrome accuracy pass with concrete Mac OS 8 references

The primary reference for any visual question is Apple's own Mac OS 8 Human Interface Guidelines:

- <https://dev.os9.ca/techpubs/mac/HIGOS8Guide/thig-82.html>

## What this isn't

- An emulator. cv-mac has one.
- A full AppKit / Carbon reproduction.
- A mobile-first toolkit. This is desktop windowing.

## A heads-up on hover

Mac OS 8 chrome had exactly three control states: **Normal, Pressed, Disabled**. There was no "hover" — that's a post-OS X / web-era concept. Kaleidoscope schemes ship `cicn` artwork only for those three states, so Aaron UI renders them faithfully: pointing at a close box looks the same as pointing anywhere else. If that surprises modern-web reflexes, it's intentional and authentic. A light, opt-in hover affordance may land in a later phase for ergonomic / accessibility cases; it'll never be on by default. See [`LEARNINGS.md`](./LEARNINGS.md) for the full reasoning.

## What loaded themes carry (and don't)

Aaron UI loads what Kaleidoscope schemes actually shipped: **chrome + controls + colors.** Empirically, after deconstructing the corpus, almost no Kaleidoscope scheme carried sounds, desktop backgrounds, or fonts — the OS supplied those. Aaron UI doesn't fabricate them.

If a consumer wants period sounds or a desktop picture alongside a loaded scheme, that's a host-page concern: drop in your own `<audio>` and CSS `background-image`. Aaron UI may eventually add an opt-in `extras/` sidecar concept for bundling sounds with a scheme bundle, but it's not a runtime built-in — and there is no "first-party preset theme that ships sounds." Every theme Aaron UI ships is a port of an existing Kaleidoscope scheme with the original author's attribution.

## Documents

- **[`PRD.md`](./PRD.md)** — what we're building and why.
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — how to land changes.
- **[`LEARNINGS.md`](./LEARNINGS.md)** — running log of gotchas and decisions, populated as we build.

## License

**Deliberately undecided.** See PRD §License — the consumption pattern (library embedded in other projects) creates real tradeoffs between MIT/Apache (best for adoption), LGPL (classic library posture), and GPL-3.0-or-later (matches the upstream family). The call is deferred until after Phase 1 ships and we have a sense of who's actually picking it up.
