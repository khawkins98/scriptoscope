# Aaron UI

A Mac OS Appearance-style window manager and theme engine for the web.

Drop it into any page to get draggable, resizable windows that look and feel like System 7.5+ / Mac OS 8 — pinstripe title bars, paper title pills, ink-bordered close boxes, windowshade collapse, integrated grow boxes. Then swap themes at runtime to load curated [Kaleidoscope](https://en.wikipedia.org/wiki/Kaleidoscope_(software))-era community schemes — chrome, controls, colors, optional sounds, optional desktop background. The default Platinum theme is hand-authored from the Mac OS 8 HIG; alternate themes are ported from freeware-licensed Kaleidoscope schemes with original-author attribution.

> **Status: Phase 1 shipped.** The window-manager core is in: `AaronWindow` class with drag, 8-direction resize, z-order, focus, programmatic API, declarative `[data-aaron-window]` scanner, ARIA + keyboard + focus-trap. 140 unit tests + 30 e2e tests, ~7 KB gzipped. Live demo: <https://khawkins98.github.io/aaron-ui/>. Phase 2 (default Platinum chrome) is next — see the [milestones](https://github.com/khawkins98/aaron-ui/milestones).

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

3. **A Kaleidoscope-corpus theme engine, clean-room from Kaleidoscope's code.** Aaron UI loads and faithfully renders Kaleidoscope-style theme bundles. The corpus is the ≈4,010 community-authored schemes on [Macintosh Garden](https://macintoshgarden.org/apps/kaleidoscope) and [Mac Themes Garden](https://macthemes.garden/), prioritizing those with explicit freeware-with-redistribution readmes. **We extract compiled assets from individual schemes** (with the author's stated permission) and **re-implement the rendering entirely in our own CSS / SVG / JS** — Aaron UI never uses Kaleidoscope's source code. Apple's own themes (Hi-Tech, Drawing Board, Gizmo) are deliberately out of scope; the default Platinum theme is hand-authored from Apple's *published* [Human Interface Guidelines](https://dev.os9.ca/techpubs/mac/HIGOS8Guide/thig-82.html), period screenshots, and mass:werk's freeware Platinum-faithful "7 Le" scheme as a community reference. No Apple binaries are touched at any stage. The result is a clean-room re-implementation that's *behaviorally* and *aesthetically* faithful, with every shipped theme bundle carrying provenance metadata (original author, source URL, license-of-origin).

> The name "Aaron" comes from Apple's internal codename for the Copland-era demo that previewed the Appearance Manager and Platinum default theme. With the project's scope clarified to Kaleidoscope-corpus themes (rather than Appearance Manager re-implementation), the etymology is now poetic origin rather than tight description — and that's fine.

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

Mac OS 8 chrome had exactly three control states: **Normal, Pressed, Disabled**. There was no "hover" — that's a post-OS X / web-era concept. Aaron UI's default Platinum theme honors this: pointing at a close box looks the same as pointing anywhere else. If that surprises modern-web reflexes, it's intentional and authentic. A light, opt-in hover affordance may land in a later phase for ergonomic / accessibility cases; it'll never be on by default. See [`LEARNINGS.md`](./LEARNINGS.md) for the full reasoning.

## What ported themes carry (and don't)

The PRD describes theme bundles as ideally shipping chrome + controls + colors + desktop background + sounds + fonts. In practice, that depends on the theme's origin:

- **Aaron UI first-party / preset themes** (Platinum, eventually a small curated set) — may include sounds and a desktop background as opt-in extras, hand-authored by us.
- **Ported third-party themes** (Kaleidoscope-derived community schemes) — chrome + controls + colors only. Sounds, desktop background, and fonts are not part of what Kaleidoscope schemes carried in practice, and Aaron UI doesn't fabricate them when porting.

So loading "mass:werk 7 Le" gets you the look; loading the "Platinum" preset gets you the look *plus* the period sounds, if you opt in.

## Documents

- **[`PRD.md`](./PRD.md)** — what we're building and why.
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — how to land changes.
- **[`LEARNINGS.md`](./LEARNINGS.md)** — running log of gotchas and decisions, populated as we build.

## License

**Deliberately undecided.** See PRD §License — the consumption pattern (library embedded in other projects) creates real tradeoffs between MIT/Apache (best for adoption), LGPL (classic library posture), and GPL-3.0-or-later (matches the upstream family). The call is deferred until after Phase 1 ships and we have a sense of who's actually picking it up.
