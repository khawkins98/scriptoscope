# Aaron UI

A web-native runtime that renders classic [Kaleidoscope](https://en.wikipedia.org/wiki/Kaleidoscope_(software)) themes 1:1 from their own binary resources.

Load any freeware-licensed Kaleidoscope scheme and Aaron UI draws its windows — chrome, controls, and colors — pixel-faithfully in the browser. Aaron UI doesn't hand-author a "Platinum theme" (or any theme). It reads each scheme's `cicn` artwork, `wnd#` layout recipe, and `cinf`/`Colr` metadata and replays the rendering itself: the window-chrome compositor (`src/composeChrome.ts`) is a clean-room reimplementation of the decompiled Kaleidoscope **2.3.1** kDEF (a 68k `WDEF`), driven by a part-code jump table. Get the engine right once and every scheme renders for free.

The current corpus of extracted bundles lives under [`themes/`](./themes/): `1138`, `1984`, `1990`, `apple-platinum-2`, `beos-r503`, `black-platinum`, `evolution`, `platinum-8`, `system7-nostalgia-silver`, plus the generated `apple-platinum-replica` universal base.

> **Status (v3, 2026-05-28):** the project went through a v2 clean-break and is now on the **v3 part-code-compositor reset** — the chrome renderer is rebuilt around Kaleidoscope's own part-code model and validated against the 2.3.1 binary. ("v1/v2/v3" are *architecture* generations — internal resets — not release versions; the package itself is pre-1.0.) The codebase is in prototype mode. Two public surfaces are now in: the **imperative runtime** (`loadTheme()` / `renderWindow()` in [`src/index.ts`](./src/index.ts)) and the **declarative front door** (`mountDeclarative()` + `data-aaron-*` in [`src/declarative/index.ts`](./src/declarative/index.ts)) — both exercised by the demo pages below. See [`docs/history.md`](./docs/history.md) for the full arc (and the "Dead ends — don't relitigate these" list — read it first); see [`docs/superpowers/specs/2026-05-27-declarative-windows-design.md`](./docs/superpowers/specs/2026-05-27-declarative-windows-design.md) for the declarative layer's design + feature-rich pass. Live demo: <https://khawkins98.github.io/aaron-ui/>.

## Trying it

Three demo pages sit on the same runtime, each showing a different integration path. Run them all together:

```sh
npm install
npm run dev        # http://localhost:5173/
```

- **[`demo/index.html`](./demo/index.html)** — the **runtime debugger**. Every control type, the full raster foldout (every `cicn`/`ics4`/`ppat` per scheme), and a drop-zone where a `.sit` / `.hqx` / `.rsrc` Kaleidoscope archive decodes and renders entirely in the browser. The page to open when you're working on the renderer itself or porting a scheme.
- **[`demo/declarative.html`](./demo/declarative.html)** — a **Mac OS 8.6 desktop simulation built entirely from `data-aaron-*` markup**: menu bar, Welcome modal, Read Me window, Tools palette, Inspector (with live theme switching across native-recipe AND corner-sprite schemes), shaded Notepad, Trash icon that spawns themed dialogs. Window-shade (collapse box / double-click), zoom-to-fit, themed scrollbars on overflow, themed checkbox/radio/slider — all wired declaratively. The "what could you build with this" answer.
- **[`demo/declarative-site.html`](./demo/declarative-site.html)** — the **"skin an existing site" exemplar**: an ordinary article/form/list/gallery page with `data-aaron-*` attributes sprinkled onto real content. The form's native `<input>`s stay native (accessible, real form values); only the explicit `data-aaron-button` / `data-aaron-control` elements are skinned.

## The runtime API

Two surfaces, same engine.

### Imperative — `loadTheme()` + `renderWindow()`

A scheme bundle is a directory (`theme.json` + decoded `cicns/`, `ppats/` PNGs); `loadTheme()` fetches it and `renderWindow()` composites a window from it:

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

See [`demo/index.html`](./demo/index.html) for the full integration and [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md) for the chrome model.

### Declarative — `mountDeclarative()` + `data-aaron-*`

The same runtime exposed as markup. Put `data-aaron-window` on a plain `<div>` and one bootstrap line promotes it into a faithful Mac window wrapping the live HTML content — no per-window JS:

```html
<body>
  <div id="desktop">
    <div data-aaron-window data-aaron-title="Read Me" data-aaron-x="32" data-aaron-y="28"
         data-aaron-width="360" data-aaron-height="280">
      <h2>About</h2>
      <p>This is real HTML. Selectable, focusable, accessible. The chrome is canvas behind it.</p>
      <button data-aaron-button data-aaron-default onclick="alert('OK')">OK</button>
    </div>
  </div>

  <script type="module">
    import { mountDeclarative } from 'aaron-ui';
    await mountDeclarative({ themeBaseUrl: '/themes', baseSlug: 'apple-platinum-replica' });
  </script>
</body>
```

**Window attributes** (all `data-aaron-*`): `window`, `title`, `window-type` (`document-window` / `movable-modal` / `dialog` / `titled-utility-window` / `side-floating-utility-window` / …), `x` / `y`, `width` / `height` (omit both → content-fit with a `ResizeObserver`), `state` (`active`/`inactive`), `z` (initial stacking order), `collapsed` (boot pre-shaded), `theme` (per-window scheme override, nearest-ancestor wins).

**Promoted children**: `<button data-aaron-button>` (with `data-aaron-default` for the OK ring), and `<input type=checkbox|radio|range>` are auto-promoted to themed art (opt-out per-input with `data-aaron-control="off"`). The native input is hidden in place — form values, events, accessibility all preserved.

**Runtime theme switching**: any `<select data-aaron-theme-switcher>` re-skins every window + control live, the Kaleidoscope way.

**Gestures**: drag the title bar (or any frame edge for side-titled palettes); drag the gripper to resize; click the **collapse** box or **double-click** the title bar to window-shade; click the **zoom** box to grow-to-fit; click a window to focus it.

Full design + the feature-rich pass: [`docs/superpowers/specs/2026-05-27-declarative-windows-design.md`](./docs/superpowers/specs/2026-05-27-declarative-windows-design.md). Live: <https://khawkins98.github.io/aaron-ui/declarative.html>.

### Bring your own theme (in-browser conversion)

Beyond the bundled corpus, the demo has a **drop-zone**: drag a Kaleidoscope theme file onto the page and it's decoded and rendered entirely client-side — no build step, no upload. Accepted inputs: a StuffIt `.sit` archive, a `.hqx` / MacBinary / AppleSingle·Double wrapper, or a raw `.rsrc` resource fork. The conversion runs through [`tools/theme-loader/loadKaleidoscopeScheme.js`](./tools/theme-loader/loadKaleidoscopeScheme.js); StuffIt is decoded by [`tools/sit-wasm/`](./tools/sit-wasm/) (the munbox C library compiled to WebAssembly — a self-contained, MIT, in-browser StuffIt decoder). Design + status: [`docs/superpowers/specs/2026-05-27-browser-conversion-design.md`](./docs/superpowers/specs/2026-05-27-browser-conversion-design.md); remaining work: [`docs/tracking/byo-theme-todo.md`](./docs/tracking/byo-theme-todo.md).

## Documents

- **[`docs/history.md`](./docs/history.md)** — the full project arc (v1 → v2 clean-break → v3 part-code reset) and the "Dead ends — don't relitigate these" list. Start here.
- **[`docs/spec/kdef-architecture.md`](./docs/spec/kdef-architecture.md)** — the runtime architecture tour: the subsystems, the compose pipeline, and how a `wnd#` recipe maps to a drawn window. Read this for **"how does it work?"**
- **[`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md)** — the current window-chrome model (the implemented spec).
- **[`docs/spec/kdef231-reference.md`](./docs/spec/kdef231-reference.md)** — the standing Kaleidoscope **2.3.1** kDEF reference: a lookup rubric of every routine address, resource id, struct offset, and coordinate mapping. The first stop for **"where is X?"**; it indexes the architecture tour, the compositor spec, the recipe-walk, and the faithfulness ledger.
- **[`docs/superpowers/specs/2026-05-27-declarative-windows-design.md`](./docs/superpowers/specs/2026-05-27-declarative-windows-design.md)** — design + multi-night build log for the declarative (`data-aaron-*`) front door: the attribute contract, the feature-rich pass (window-shade, zoom, themed scrollbars, runtime theme-switch, themed controls), the OS 8.6 desktop redesign, the review-driven hardening, and the known follow-ups. Read this when extending the declarative layer.
- **[`PRD.md`](./PRD.md)** — the original product charter (vision still largely valid; implementation has since moved on — see `docs/history.md`).
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — how to land changes and port a scheme.
- **[`LEARNINGS.md`](./LEARNINGS.md)** — running log of gotchas and decisions, populated as we build.

## North Star

A web window manager that **any** project — built with any framework, or no framework at all — can drop in by adding **data attributes to plain HTML**, and that ships a **Kaleidoscope-style theme engine** capable of loading freeware-licensed period theme bundles and rendering them faithfully on the modern web.

The declarative front door (principle 2 below) is **now built** — `mountDeclarative()` + the `data-aaron-*` contract, with two demo pages exercising it (see "Trying it" above). Three principles do the load-bearing work:

1. **Framework-agnostic by default.** No React peer dep, no Vue plugin, no Solid integration layer. Aaron UI is plain TypeScript + CSS that works wherever HTML works — vanilla DOM, htmx, server-rendered Rails/Django/Laravel, every JS framework, and a `<script>` tag on a static page.

2. **Declarative-first integration via data attributes.** The primary integration path is markup-only: add `data-aaron-window` (with `data-aaron-title`, `data-aaron-x`, etc.) to any element and Aaron UI promotes it into a draggable window on load. Native form controls inside (`<button data-aaron-button>`, `<input type=checkbox|radio|range>`) are auto-skinned to the current theme while staying real accessible inputs. An imperative `mountDeclarative()` exists for dynamic cases, but no one should *need* to write more than one bootstrap line to use the library. CSS class hooks (`.aaron-window`, etc.) are accepted as a fallback for environments where data attributes are awkward. See the full attribute contract in "The runtime API → Declarative" above.

3. **A Kaleidoscope-compatibility runtime, clean-room from Kaleidoscope's code.** Aaron UI is a *runtime for an existing corpus*, not a new theme-authoring project. It reads Kaleidoscope resource bundles (`cicn`, `ppat`, `cinf`, `wnd#`, `Colr`) directly — decoded by [`tools/theme-loader/`](./tools/theme-loader/) via [`scripts/extract-scheme.mjs`](./scripts/extract-scheme.mjs) — and re-implements the rendering entirely in our own compositor (see [`docs/spec/compositor-spec.md`](./docs/spec/compositor-spec.md)). The corpus is the community-authored schemes archived on [Macintosh Garden](https://macintoshgarden.org/apps/kaleidoscope) and [Mac Themes Garden](https://macthemes.garden/), prioritizing those with explicit freeware-with-redistribution readmes. **We extract compiled assets from individual schemes** (with the author's stated permission) and **re-implement the rendering entirely in our own code** — Aaron UI never uses Kaleidoscope's source code. Apple's own themes (Hi-Tech, Drawing Board, Gizmo) are deliberately out of scope, and **Aaron UI does not hand-author chrome from the HIG** — it renders whatever scheme is loaded. Every extracted theme bundle carries provenance metadata (original author, source URL, license-of-origin); the only first-party visual artifacts Aaron UI produces are the un-themed engine fallbacks needed when no scheme has loaded yet.

> The name "Aaron" comes from Apple's internal codename for the Copland-era demo that previewed the Appearance Manager and Platinum default theme. With the project now scoped as a *Kaleidoscope-compatibility runtime* (not Appearance Manager re-implementation, not Platinum re-author), the etymology is poetic origin rather than tight description — and that's fine.

## Where the idea came from

The proximate origin is the [classic-vibe-mac](https://github.com/khawkins98/classic-vibe-mac) project — a System 7.5.5 emulator + in-browser C compiler running in a tab. cv-mac built a Mac OS 8 Platinum chrome layer on top of WinBox over several months and eventually hit a ceiling: roughly 70% of the Platinum gap was CSS work in cv-mac's own court, ~15% could be closed by a thin shell layer, but ~30% of the remaining authenticity was structural to WinBox itself (fixed DOM hierarchy, scrollbars-inside-body geometry, no slot for windowshade arrow or status bar, drag with web-style acceleration). The honest move was to own the window manager.

The deeper origin is a recurring frustration across earlier "give a modern web utility a classic-OS look" experiments:

- [**PDF-A-go-actionable**](https://github.com/khawkins98/PDF-A-go-actionable#visual-design) — a NeXTSTEP-styled PDF utility. The visual-design notes catalogue the by-hand CSS work it took to *approximate* NeXT chrome, and how quickly the result diverges from the real thing once you look closely.
- [**PDF-A-go-slim**](https://github.com/khawkins98/PDF-A-go-slim#why-it-looks-like-that) — same impulse, classic-Mac flavour, same conclusion in its "why it looks like that" section: hand-authored chrome is tedious to build, never quite right, and rots whenever you reach for a control you haven't yet drawn.
- [**The 90s desktop paradigm for browser utilities**](https://www.allaboutken.com/posts/20260216-90s-desktop-paradigm-browser-utilities/) — the longer essay that pulls those experiments together: a web utility *as a windowed desktop app* is a richer, more legible UX than a single-flow webpage, but only if the chrome is authentic — and authentic chrome is something you *render from the original art*, not something you re-draw in CSS.

Aaron UI is the answer to that recurring frustration. Read the OS's own resource files, render them faithfully once, and every utility downstream gets the look for free — no per-project CSS Platinum, no per-project drift.

The full extraction context, decision trail, and naming rationale for the cv-mac side are in the upstream charter ticket:

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

Aaron UI loads what Kaleidoscope schemes actually shipped: **chrome + controls + colors.** Empirically, after deconstructing the corpus, almost no Kaleidoscope scheme carried sounds, desktop backgrounds, or fonts — the OS supplied those. Aaron UI doesn't fabricate them. (The one font the OS *would* have supplied — Charcoal, for window titles — the demo provides as a license-clean stand-in: Jeremy Sachs' CC BY-SA "Charcoal 12" bitmap, with Marty Pfeiffer's free "Virtue" as fallback, and `local('Charcoal')` preferred when installed. Schemes still bring no fonts of their own.)

If a consumer wants period sounds or a desktop picture alongside a loaded scheme, that's a host-page concern: drop in your own `<audio>` and CSS `background-image`. Aaron UI may eventually add an opt-in `extras/` sidecar concept for bundling sounds with a scheme bundle, but it's not a runtime built-in — and there is no "first-party preset theme that ships sounds." Every theme Aaron UI ships is a port of an existing Kaleidoscope scheme with the original author's attribution.

## License

**Aaron UI's own code is [MIT](./LICENSE)** (best for adoption — the library is meant to be embedded in other projects). The bundled third-party material keeps its own terms and is **not** relicensed:

- **`themes/<slug>/`** — assets extracted from community-authored Kaleidoscope schemes, redistributed under each original author's freeware-with-redistribution terms. Provenance is in every bundle's `meta.json` (`origin.originalLicense`, `sourceUrl`) and `PROVENANCE.md`.
- **`tools/sit-wasm/munbox/`** — a vendored subset of [munbox](https://github.com/idolpx/munbox) (MIT); see `tools/sit-wasm/munbox/LICENSE` and `PATCHES.md`.
- **`demo/assets/fonts/`** — Charcoal 12 (Jeremy Sachs, CC BY-SA) and Virtue (Marty Pfeiffer, free-with-credit); see the license files alongside them.

The standalone StuffIt decoder, [`tools/sit-wasm/`](./tools/sit-wasm/), carries its own MIT `LICENSE` so it stays self-contained if extracted.
