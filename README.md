# Aaron UI

A Mac OS Appearance-style window manager and theme engine for the web.

Drop it into any page to get draggable, resizable windows that look and feel like System 7.5+ / Mac OS 8 — pinstripe title bars, paper title pills, ink-bordered close boxes, windowshade collapse, integrated grow boxes. Then swap themes at runtime to load Apple's other official Mac OS 8.5 looks (Hi-Tech, Drawing Board, Gizmo), Kaleidoscope-era community themes, or your own — themes carry chrome + controls + desktop background + system sounds together.

> ⚠️ **Status: pre-implementation.** This repo currently contains the project charter (see [`PRD.md`](./PRD.md)) and contribution conventions. No code yet. Phase 1 (WM core, API-compatible drop-in for [WinBox](https://nextapps-de.github.io/winbox/)) is the next step.

## North Star

A web window manager that **any** project — built with any framework, or no framework at all — can drop in by adding **data attributes to plain HTML**, and that ships an **API-compatible re-implementation of the Mac OS 8/9 Appearance Manager** capable of loading period theme packs and rendering them faithfully on the modern web.

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

3. **An API-compatible re-implementation of the Mac OS 8/9 Appearance Manager — from spec, never from decompile.** Aaron UI's theme bundle format and runtime behavior aim to be conceptually compatible with how Mac OS 8.5's Appearance Manager loaded themes (Platinum, Hi-Tech, Drawing Board, the Kaleidoscope ecosystem), so period themes can be adapted into Aaron UI bundles and rendered faithfully on web pages. **The implementation is independent.** We work from Apple's published [Human Interface Guidelines](https://dev.os9.ca/techpubs/mac/HIGOS8Guide/thig-82.html), period screenshots, and the public theme-bundle format documentation — never from decompiled Apple source or copied artwork. The result is a clean-room re-implementation that's *behaviorally* and *aesthetically* faithful, but legally and technically our own work.

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

## Documents

- **[`PRD.md`](./PRD.md)** — what we're building and why.
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — how to land changes.
- **[`LEARNINGS.md`](./LEARNINGS.md)** — running log of gotchas and decisions, populated as we build.

## License

**Deliberately undecided.** See PRD §License — the consumption pattern (library embedded in other projects) creates real tradeoffs between MIT/Apache (best for adoption), LGPL (classic library posture), and GPL-3.0-or-later (matches the upstream family). The call is deferred until after Phase 1 ships and we have a sense of who's actually picking it up.
