# Project background and rendering scope

This explanation preserves the project story, design goals and rendering-evidence boundaries. For setup, use the [README](../README.md). Current releases belong in the [changelog](../CHANGELOG.md); current implementation policy belongs in [CONTRIBUTING](../CONTRIBUTING.md).


[Kaleidoscope](https://en.wikipedia.org/wiki/Kaleidoscope_(software)) was a classic Mac OS themer many of us remember fondly. Greg Landweber and Arlo Rose wrote it, and a community of authors filled it out with 4,400-plus schemes from 900-plus people, preserved today by [Mac Themes Garden](https://macthemes.garden/) and the [Kaleidoscope Scheme Archive](https://kaleidoscope.hryjksn.com/). Then OS X arrived in 2001 and the whole format went quiet.

There was hope for a while that Kaleidoscope might survive into the OS X era — but the refactor was enormous, and OS X's own theming layer was never as stable as classic Mac OS had been. The various third-party attempts that did ship (ShapeShifter, Magnifique, et al.) had a reputation for corrupting installs more often than they worked. A few macOS versions later, the platform was locked down enough that no third-party chrome layer could ever ship again.

Decades on, the schemes are remembered with nostalgia but largely unreachable — the only way to actually see them is through period Macintosh emulators, fun for archaeology but hardly practical. What if, through the beauty of JavaScript and a `<canvas>`, we could just apply them to our websites?

If you're in that very small Venn diagram overlap, behold: Scriptoscope is a compatibility layer that reads those same scheme files — the actual `.sit` and `.rsrc` bundles people made in the nineties — and paints them onto your webpage. Same color icons, same window frames, same fill patterns. Your HTML stays live underneath; only the skin is canvas.

A Kaleidoscope scheme is a [Mac resource fork](https://en.wikipedia.org/wiki/Resource_fork): a little database of typed records authored against a system that stopped shipping in 2001. So Scriptoscope reads one the way the old Finder did. Drop a scheme on the page, and it unpacks the archive, walks the resource map, pulls each record into memory, and hands the lot to a `<canvas>` renderer that speaks the same scheme format the original control panel did. *(That renderer is a spec-compatible reimplementation of the 2.3.1 engine; the divergences are logged in [the ledger](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/kdef-faithfulness-ledger.md) if you care.)* All of it runs in the tab. Nothing's uploaded, and a refresh throws the bytes away.

To skin your own page, tag an element for what it is — window, button, slider — add one script tag, and it wears the current scheme. No framework, no build step. The children stay real HTML; only the chrome is painted.

Why? No good reason. Kaleidoscope lost to OS X a quarter-century ago and the world was right to move on. I rebuilt the rendering layer anyway, so eighteen schemes by people who mostly stopped making them in 2002 could run in a browser tab. This is a deeply silly use of anyone's time, including yours. If you're unhinged enough to ship it on a real website, [I genuinely want to hear about it](https://github.com/khawkins98/scriptoscope/issues). And if you ever wrote a Kaleidoscope scheme, [the door's open](../README.md#if-you-build-a-scheme).

Building it has been an interesting endeavor — a real education in how Kaleidoscope's theming actually worked, and how Mac OS theming worked more generally. It also led me into some fun side quests, like extracting `.sit` files inside the browser.

> *P.S. The project was originally **Aaron UI** — **Aaron** was Landweber's earlier extension, the one that faked the Mac OS 8 Platinum look on System 7 before Kaleidoscope existed. Three people would have caught that. Hello, three people. Renamed to Scriptoscope 2026-05-28 once the project pivoted to a Kaleidoscope-compatibility runtime + the etymology stopped paying rent.*

**A note on authorship.** I've tried to contact the original Kaleidoscope authors (Greg Landweber, Arlo Rose, and a handful of scheme authors I could find addresses for) about this project, and haven't heard back. Most of the addresses I could find are decades old. **If you can put me in touch with any of them, or if you ARE one of them reading this, please email me: <khawkins98@gmail.com>.**

**The legal posture.** Two distinct things, with different frames.

The runtime is a clean-room reimplementation of the scheme-rendering interpreter, written from the decompiled 2.3.1 kDEF used only as a test oracle. No original Kaleidoscope code ships or executes. This is the same posture every modern emulator operates under; the canonical precedent is [*Sony v. Connectix* (2000)](https://en.wikipedia.org/wiki/Sony_Computer_Entertainment,_Inc._v._Connectix_Corp.), where the Ninth Circuit held that clean-room reverse engineering of the PlayStation BIOS for compatibility was fair use. Sega v. Accolade (1992) is the older relative on the same principle.

The bundled scheme files in `themes/` are a separate matter: third-party freeware from the 1990s whose authors are largely unreachable today. Scriptoscope ships them under the same good-faith preservation posture [Macintosh Garden](https://macintoshgarden.org/) and the [Internet Archive's classic-software collection](https://archive.org/details/softwarelibrary_apple) use for orphan classic-software, including the take-down-on-request commitment. This project is a hobby, MIT-licensed, no profit motive, no advertising. If any of the original authors object, I'll take it down.

The current corpus of bundles lives under [`themes/`](https://github.com/khawkins98/scriptoscope/tree/main/themes/): `1138`, `1984`, `1990`, `animals`, `apple-lisa`, `apple-platinum-2`, `beos-r503`, `black-platinum`, `crayon-os`, `dolphin-som`, `evolution`, `floppies`, `monkey-paradise`, `platinum-8`, `slimes`, `system7-nostalgia-silver`, `windows-31`, `windows-95`. Each bundle ships only the original archive (`scheme.sit` or `scheme.rsrc`) + `meta.json` + `PROVENANCE.md` — the runtime decodes them client-side, no pre-extraction in git.

Want more? Two community archives where Scriptoscope's drop-zone can read schemes from directly:
- **[Mac Themes Garden](https://macthemes.garden/)** — a beautifully curated gallery + archive with reference renders and the original `.sit` downloads. The 2026-05-28 corpus additions came from here.
- **[Kaleidoscope Scheme Archive (kaleidoscope.hryjksn.com)](https://kaleidoscope.hryjksn.com/)** — a community-maintained archive of 3000+ schemes, with hash-stamped reference renders. The largest corpus available; the initial bundled schemes were ported from here.

Both let you grab a `.sit` and drop it on the demo to see it render live without a build step.

## North Star

A web window manager that **any** project — built with any framework, or no framework at all — can drop in by adding **data attributes to plain HTML**, and that ships a **Kaleidoscope-style theme engine** capable of loading freeware-licensed period theme bundles and rendering them faithfully on the modern web.

The public promotion primitives and the `data-scriptoscope-*` parsers support explicit application hosts; the demo pages exercise the example host (see the [local demo recipes](./hosted-recipes.md#trying-it-locally)). Three principles do the load-bearing work:

1. **Framework-agnostic by default.** No React peer dep, no Vue plugin, no Solid integration layer. Scriptoscope is plain TypeScript + CSS that works wherever HTML works — vanilla DOM, htmx, server-rendered Rails/Django/Laravel, every JS framework, and a `<script>` tag on a static page.

2. **Explicit integration with ordinary HTML.** Data attributes describe window and control options; application code chooses source identities and owns their lifetimes. The example page host captures sources once. Later additions and removals use explicit attach/detach calls; theme replacements await current work. The runtime does not scan, move or retry newly discovered DOM. Native controls retain browser form and accessibility behavior.

3. **A Kaleidoscope-compatibility runtime, clean-room from Kaleidoscope's code.** Scriptoscope is first a *runtime for an existing corpus*; its authoring toolkit writes ordinary scheme files rather than a second theme format. It reads Kaleidoscope resource bundles (`cicn`, `ppat`, `cinf`, `wnd#`, `Colr`) directly — decoded by [`tools/theme-loader/`](https://github.com/khawkins98/scriptoscope/tree/main/tools/theme-loader/) via [`scripts/extract-scheme.mjs`](https://github.com/khawkins98/scriptoscope/blob/main/scripts/extract-scheme.mjs) — and re-implements the rendering entirely in our own compositor (see [`docs/spec/compositor-spec.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/compositor-spec.md)). The corpus is the community-authored schemes archived on [Macintosh Garden](https://macintoshgarden.org/apps/kaleidoscope) and [Mac Themes Garden](https://macthemes.garden/), prioritizing those with explicit freeware-with-redistribution readmes. **We extract compiled assets from individual schemes** (with the author's stated permission) and **re-implement the rendering entirely in our own code** — Scriptoscope never uses Kaleidoscope's source code. Apple's own themes (Hi-Tech, Drawing Board, Gizmo) are deliberately out of scope, and **Scriptoscope does not hand-author chrome from the HIG** — it renders whatever scheme is loaded. Every extracted theme bundle carries provenance metadata (original author, source URL, license-of-origin); the only first-party visual artifacts Scriptoscope produces are the un-themed engine fallbacks needed when no scheme has loaded yet, plus authoring examples under [`authoring/`](https://github.com/khawkins98/scriptoscope/tree/main/authoring/) that are themselves ordinary scheme files rendered through the same path (they are not part of the bundled corpus).

> *Name note:* "Scriptoscope" = JavaScript ("Script") × the instrument-suffix family of names ("-oscope" — the instrument you look through to see classic Mac themes rendered on the modern web). Renamed 2026-05-28 from Aaron UI; the prior name was a deep-cut nod to *Aaron*, Apple's internal codename for the Copland-era Appearance Manager demo, but the etymology got loose after the project pivoted to a Kaleidoscope-compatibility runtime. Full rationale in [`LEARNINGS.md`](https://github.com/khawkins98/scriptoscope/blob/main/LEARNINGS.md). The consumer-facing API surface is `data-scriptoscope-*` attributes, `.scriptoscope-*` CSS classes, and the `ScriptoscopeWindow` class (swept 2026-05-29 from the original `data-aaron-*`/.aw-/AaronWindow naming).

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

Mac OS 8 chrome had exactly three control states: **Normal, Pressed, Disabled**. There was no "hover" — that's a post-OS X / web-era concept. Kaleidoscope schemes ship `cicn` artwork only for those three states, so Scriptoscope renders them faithfully: pointing at a close box looks the same as pointing anywhere else. If that surprises modern-web reflexes, it's intentional and authentic. A light, opt-in hover affordance may land in a later phase for ergonomic / accessibility cases; it'll never be on by default. See [`LEARNINGS.md`](https://github.com/khawkins98/scriptoscope/blob/main/LEARNINGS.md) for the full reasoning.

## What loaded themes carry (and don't)

Scriptoscope loads what Kaleidoscope schemes actually shipped: **chrome + controls + colors.** Empirically, after deconstructing the corpus, almost no Kaleidoscope scheme carried sounds, desktop backgrounds, or fonts — the OS supplied those. Scriptoscope doesn't fabricate them. (The one font the OS *would* have supplied — Charcoal, for window titles — the demo provides as a license-clean stand-in: Jeremy Sachs' CC BY-SA "Charcoal 12" bitmap, with Marty Pfeiffer's free "Virtue" as fallback, and `local('Charcoal')` preferred when installed. Schemes still bring no fonts of their own.)

If a consumer wants period sounds or a desktop picture alongside a loaded scheme, that's a host-page concern: drop in your own `<audio>` and CSS `background-image`. Scriptoscope may eventually add an opt-in `extras/` sidecar concept for bundling sounds with a scheme bundle, but it's not a runtime built-in — and there is no "first-party preset theme that ships sounds." Every theme Scriptoscope ships is a port of an existing Kaleidoscope scheme with the original author's attribution.

## Rendering regression coverage

The [control matrix](https://github.com/khawkins98/scriptoscope/blob/main/tests/rendering-options/README.md) exercises all 18 schemes
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
The [reference intake](https://github.com/khawkins98/scriptoscope/blob/main/tests/reference-captures/README.md) also defines a narrow
review scope for complete fixed-size empty face observations.
Such composited-pixel evidence leaves the broader requirements unresolved; it
cannot certify masks, typography, unobserved states or private painter selection.
The [original corpus](https://github.com/khawkins98/scriptoscope/blob/main/tests/reference-captures/ORIGINALS.md) now contains fifty-four
independently AI-reviewed scoped observations. All fifty-four whole requests remain
evidence-incomplete, with all broader requirements unresolved. Maintainers can
reuse the [private original-reference environment](https://github.com/khawkins98/scriptoscope/blob/main/docs/maintainer-reference-environment.md)
to acquire additional evidence; access is optional and never required by public CI.

[Actual resource-byte provenance](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/resource-byte-provenance.md) can opt in
to joining loaded archive, fork and resource bytes to selected manifest entries
and painted push/default/bevel faces. It establishes input identity through shared
conversion; independent decoder correctness and broader control families remain
separate requirements.

The [draft acceptance inventory](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/acceptance-inventory-proposal.md) proposes
full-target families, paths and boundary classes; its closure and unresolved evidence remain open.

A [pinned-source emulator build](https://github.com/khawkins98/scriptoscope/blob/main/docs/research/emulator-build-reproduction/2026-10-19/README.md)
now reproduces the preserved JS/WASM exactly; glyph-provider tracing remains unresolved.

See [CONTRIBUTING.md](https://github.com/khawkins98/scriptoscope/blob/main/CONTRIBUTING.md) for setup and the required checks. The
[fidelity plan](https://github.com/khawkins98/scriptoscope/blob/main/docs/spec/fidelity-verification-plan.md) and
[epic #221](https://github.com/khawkins98/scriptoscope/issues/221) define the path
from regression coverage to independently verified rendering.

## Roadmap snapshot (2026-11-05)

This is the idea list moved from the README on 2026-11-05, preserved as project context rather than release promises. Linked issues own current decisions and status. Open an issue or PR to discuss an idea.

## Themes — bring more in, surface what they ship

- **Mac OS Appearance Manager theme import (.afm / kTHM)** — currently out of scope by deliberate decision ([#174](https://github.com/khawkins98/scriptoscope/issues/174) closed `wontfix`; the user-side `.afm` → `.rsrc` conversion path is documented at [`docs/converting-from-afm.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/converting-from-afm.md)). If trademark posture changes, [#176](https://github.com/khawkins98/scriptoscope/issues/176) tracks the positive-side conversion-tooling roadmap (Tier 1: worked docs; Tier 2: Node CLI converter; Tier 3: standalone npm package; Tier 4: drop-zone integration).
- **Theme variants / accents** — some Kaleidoscope schemes ship multiple palettes in one `.ksc` (day/night, gold/silver/copper, B/W vs colour). Currently we extract one variant deterministically. Whether they become theme **siblings** (separate slugs) or a runtime **knob** (`LoadedTheme.variant`) is an open design call. Tracked in [#177](https://github.com/khawkins98/scriptoscope/issues/177).
- **Bonus assets in scheme bundles** — schemes routinely ship more than chrome: desktop patterns (`crayon-os`'s "Crayon OS Desktop"), bitmap fonts (`apple-lisa`'s Lisa Classic 12 / Icon Names 10), custom cursors (`slimes`' Slime cursor), zip icon overlays, HTML readmes with embedded GIFs, custom Finder icons. Currently silently discarded. [#177](https://github.com/khawkins98/scriptoscope/issues/177) tracks per-asset-type wiring.

## Renderer — richer chrome + state coverage

- **Better icon coverage** — `icl`/`ics` icon families (Finder/system icons) extract cleanly today (4-bit + 8-bit), but the runtime renders only what a window needs. A page-level "show me every icon the loaded scheme ships" view would let consumers browse and pick by name. Also: small `icm#` mini-icons (`apple-lisa` ships 33 of them) and `cicn` icons in id ranges -3800..-20800 aren't wired everywhere they could be.
- **Better body backgrounds** — `bodyBackground` ppat tiling is shipped per-scheme (some ship one, some don't). Per-window-type backgrounds work in principle (the `cinf.bgPatternId` decode is wired) but no corpus scheme exercises them yet. Worth surfacing as a configurable knob: "use the scheme's background everywhere / only in document windows / override with a CSS value."
- **Navigation bars + menu bar chrome** — Kaleidoscope schemes ship menubar background + highlight cicns at `-12272/-12287/-12288` and accent-menu families at `-12256+`. The corpus has these but the runtime doesn't compose them yet ([#166](https://github.com/khawkins98/scriptoscope/issues/166) tracks the menu/popup API design — alpha-deferred).
- **Sound packs** — schemes occasionally ship `snd ` (system-7 sound) resources. Out of corpus norm but interesting if a consumer wanted period-correct beep/click/drag audio.
- **State-rich slot vocabulary** — current schema knows `active|inactive|collapsed-active|collapsed-inactive`. The catalog defines additional states (pressed/disabled/normal/empty/small × N) that schemes ship for richer control vocabularies. [#178](https://github.com/khawkins98/scriptoscope/issues/178) item 12.

## Discovery — find themes without leaving the project

- **In-browser theme browsing + remix** — pair the existing drop-zone with a curated gallery sourced from the community archives (see the "Want more?" block above). Drag any `.sit` from a Mac Themes Garden listing into Scriptoscope's demo and see it render live; save a favorites set; flip between them with the existing theme switcher.
- **A Kaleidoscope-like configuration panel** — Scriptoscope's drop-zone is a thin echo of Kaleidoscope's own control panel. A consumer-side config UI that lets the user toggle desktop pattern / sounds / extras / accent variant per-scheme (the same checkboxes Kaleidoscope's CP shipped) is the natural next step.
- **Theme hosting** — the [npm integration guide](../docs/npm-consumer.md) shows how to host theme archives alongside your application. A community-run theme CDN could provide an optional alternative. The runtime decodes the original archives in-browser.
- **Theme curator / submission flow** — once the corpus grows beyond what we want to bundle in-repo, a community submission flow (`scriptoscope-themes` repo + a contributor guide) would scale better than hand-curated additions.

## Adopter-facing extras

- **`<scriptoscope-window>` Custom Element** alongside explicit data-attribute promotion ([#29](https://github.com/khawkins98/scriptoscope/issues/29) — open decision).
- ~~**CSS `border-image` emitter** for the body-frame chrome~~ — **retired 2026-05-28** after three spike rounds couldn't reach fidelity on exotic schemes (BeOS asymmetric title bar, evolution, etc.). The architecture is now explicitly "DOM structure + canvas decoration" — see [`docs/adr/0001-consumption-architecture.md`](https://github.com/khawkins98/scriptoscope/blob/main/docs/adr/0001-consumption-architecture.md) §Spike result.
- **High-contrast / accessibility variants** — auto-generate a high-contrast pair from each scheme (override headerColors, force pinstripe density) so accessibility-mode users can still pick a theme they like.
- **VS Code / editor theme generation** — export a scheme's palette + chrome accents as a `vscode-theme.json` so developers can match their editor to their windowing chrome.
- **Period-correct animation polish** — zoom-to-icon close, windowshade collapse, sheet slide-in. Tracked under [#25](https://github.com/khawkins98/scriptoscope/issues/25) Phase 6.
- **cv-mac integration** — the upstream project this was extracted from. WinBox swap one PR away once the API stabilizes; [#27](https://github.com/khawkins98/scriptoscope/issues/27).

Tracker issues for new ideas: <https://github.com/khawkins98/scriptoscope/issues/new>.

