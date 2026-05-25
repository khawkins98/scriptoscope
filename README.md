# Aaron UI

A web-native runtime that renders classic [Kaleidoscope](https://en.wikipedia.org/wiki/Kaleidoscope_(software)) themes 1:1 from their own binary resources.

Load any freeware-licensed Kaleidoscope scheme and Aaron UI draws its windows — chrome, controls, and colors — pixel-faithfully in the browser. Aaron UI doesn't hand-author a "Platinum theme" (or any theme). It reads each scheme's `cicn` artwork, `wnd#` layout recipe, and `cinf`/`Colr` metadata and replays the rendering itself: the window-chrome compositor (`src/composeChrome.ts`) is a clean-room reimplementation of the decompiled Kaleidoscope **2.3.1** kDEF (a 68k `WDEF`), driven by a part-code jump table. Get the engine right once and every scheme renders for free.

The current corpus of extracted bundles lives under [`themes/`](./themes/): `1138`, `1984`, `1990`, `apple-platinum-2`, `beos-r503`, `evolution`, `platinum-8`, `system7-nostalgia-silver`.

> **Status (v3, 2026-05-23):** the project went through a v2 clean-break and is now on the **v3 part-code-compositor reset** — the chrome renderer is rebuilt around Kaleidoscope's own part-code model and validated against the 2.3.1 binary. ("v1/v2/v3" are *architecture* generations — internal resets — not release versions; the package itself is pre-1.0.) The codebase is in prototype mode: the public surface is the `loadTheme()` / `renderWindow()` runtime in [`src/index.ts`](./src/index.ts), exercised by the demo. See [`docs/history.md`](./docs/history.md) for the full arc (and the "Dead ends — don't relitigate these" list — read it first). Live demo: <https://khawkins98.github.io/aaron-ui/>.

## Trying it

The runtime is exercised through the demo page, which loads bundles from `themes/<slug>/` and renders windows from them:

```sh
npm install
npm run dev        # http://localhost:5173 — opens demo/index.html
```

The core API is small. A scheme bundle is a directory (`theme.json` + decoded `cicns/`, `ppats/` PNGs); `loadTheme()` fetches it and `renderWindow()` composites a window from it:

```ts
import { loadTheme, renderWindow } from 'aaron-ui';

const theme = await loadTheme('/themes/beos-r503');
const win = await renderWindow(theme, {
  title: 'Hello!',
  width: 320, height: 200,
  state: 'active',
});
document.body.appendChild(win);
```

See [`demo/index.html`](./demo/index.html) for the live integration and [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md) for the chrome model.

## Documents

- **[`docs/history.md`](./docs/history.md)** — the full project arc (v1 → v2 clean-break → v3 part-code reset) and the "Dead ends — don't relitigate these" list. Start here.
- **[`docs/spec/kdef-architecture.md`](./docs/spec/kdef-architecture.md)** — the runtime architecture tour: the subsystems, the compose pipeline, and how a `wnd#` recipe maps to a drawn window. Read this for **"how does it work?"**
- **[`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md)** — the current window-chrome model (the implemented spec).
- **[`docs/spec/kdef231-reference.md`](./docs/spec/kdef231-reference.md)** — the standing Kaleidoscope **2.3.1** kDEF reference: a lookup rubric of every routine address, resource id, struct offset, and coordinate mapping. The first stop for **"where is X?"**; it indexes the architecture tour, the compositor spec, the recipe-walk, and the faithfulness ledger.
- **[`PRD.md`](./PRD.md)** — the original product charter (vision still largely valid; implementation has since moved on — see `docs/history.md`).
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — how to land changes and port a scheme.
- **[`LEARNINGS.md`](./LEARNINGS.md)** — running log of gotchas and decisions, populated as we build.

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

3. **A Kaleidoscope-compatibility runtime, clean-room from Kaleidoscope's code.** Aaron UI is a *runtime for an existing corpus*, not a new theme-authoring project. It reads Kaleidoscope resource bundles (`cicn`, `ppat`, `cinf`, `wnd#`, `Colr`) directly — decoded by [`tools/theme-loader/`](./tools/theme-loader/) via [`scripts/extract-scheme.mjs`](./scripts/extract-scheme.mjs) — and re-implements the rendering entirely in our own compositor (see [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md)). The corpus is the community-authored schemes archived on [Macintosh Garden](https://macintoshgarden.org/apps/kaleidoscope) and [Mac Themes Garden](https://macthemes.garden/), prioritizing those with explicit freeware-with-redistribution readmes. **We extract compiled assets from individual schemes** (with the author's stated permission) and **re-implement the rendering entirely in our own code** — Aaron UI never uses Kaleidoscope's source code. Apple's own themes (Hi-Tech, Drawing Board, Gizmo) are deliberately out of scope, and **Aaron UI does not hand-author chrome from the HIG** — it renders whatever scheme is loaded. Every extracted theme bundle carries provenance metadata (original author, source URL, license-of-origin); the only first-party visual artifacts Aaron UI produces are the un-themed engine fallbacks needed when no scheme has loaded yet.

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

## License

**Deliberately undecided.** See PRD §License — the consumption pattern (library embedded in other projects) creates real tradeoffs between MIT/Apache (best for adoption), LGPL (classic library posture), and GPL-3.0-or-later (matches the upstream family). The call is deferred until after Phase 1 ships and we have a sense of who's actually picking it up.
