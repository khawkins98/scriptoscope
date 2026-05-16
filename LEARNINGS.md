# Learnings

A running log of things we've learned building Aaron UI — gotchas, dead ends, surprises, and decisions worth remembering. The goal is to save the next person (or future-you) from rediscovering the same lessons.

This file is intentionally empty at project start. Entries are added bottom-up as the project ships, with dated headers and enough narrative to be useful in six months without context. The companion file in [classic-vibe-mac/LEARNINGS.md](https://github.com/khawkins98/classic-vibe-mac/blob/main/LEARNINGS.md) is worth reading for the convention.

---

## Pre-implementation context (read first)

The handful of decisions below were made before any Aaron UI code was written. They're recorded here so that anyone picking up Phase 1 doesn't have to reverse-engineer the reasoning from the upstream ticket trail.

### 2026-05-16 — why Aaron UI exists at all (the extraction decision)

cv-mac built Mac OS 8 Platinum chrome on top of [WinBox](https://nextapps-de.github.io/winbox/) over several months. The chrome got closer and closer to the real thing but hit a structural ceiling: roughly 70% of the remaining authenticity gap was within reach via cv-mac's own CSS (the work tracked in [classic-vibe-mac #229](https://github.com/khawkins98/classic-vibe-mac/issues/229)), another ~15% via a thin shell layer ([classic-vibe-mac #215](https://github.com/khawkins98/classic-vibe-mac/issues/215) Phase 2), but ~30% was structural to WinBox itself.

The specific structural items:

- **Integrated scrollbar gutter.** Platinum scrollbars share a gutter with the window frame. WinBox puts scrollbars *inside* `.wb-body`; the grow handle is a separate `.wb-se` overlay. We can fake the look, never the geometry.
- **Status bar at window bottom.** Platinum windows had an optional thin status strip. WinBox has no such slot; we'd have to fake it inside body content with no integration into the frame.
- **Title-bar windowshade arrow.** Mac OS 8 had a visible arrow on the right of the title bar to collapse the window. WinBox doesn't expose a slot for it.
- **Mac-instant drag with pattern flicker.** WinBox drag has web-style acceleration and renders the pinstripe as a static background-image during drag. Different feel entirely.

The AI-agent shift was the second factor. In 2019, replacing a window manager was a multi-week project — expensive enough that the answer was always "live with the library you have." In 2026, with AI assistance, the WM core sizes out at ~600-800 LOC of TypeScript and a 1-2 day project, plus a week of edge-case polish over the following months. That's a different calculus.

The themes angle was the third. Once we were owning the WM anyway, building it around an Appearance-Manager-style *theme engine* (rather than baking in Platinum) turned the project from "a Platinum CSS library" into "a faithful reproduction of how Mac OS appearance actually worked." Apple's Mac OS 8.5 shipped themes as first-class loadable bundles (chrome + controls + desktop + sounds); third-party Kaleidoscope did the same on 7.x/8.x earlier. None of that exists on the web.

**Application:** when picking up Phase 1, design the WM around the eventual theme engine — even though Phase 4 is the engine itself, Phase 1's data structures should leave the seam clean. Don't bake the Platinum look into the WM core.

### 2026-05-16 — naming (Aaron UI, after considering nine others)

The name comes from Apple's internal codename for the Copland-era demo that previewed both the Appearance Manager and the Platinum default theme. The `UI` suffix sits in the established `[Name] UI` family (Material UI, Chakra UI, Shadcn UI) and is self-describing for newcomers who don't know the Aaron reference.

Alternatives considered and rejected (full trail in [classic-vibe-mac #246](https://github.com/khawkins98/classic-vibe-mac/issues/246)):

- *Aaron* alone — unsearchable.
- *AaronKit* — period-coherent (UIKit/AppKit lineage) but assumes the reader knows the Aaron reference; hides the "UI library" signal.
- *AaronJS* — generic.
- *Mac-Aaron* — Apple trademark exposure.
- *Aaron Web UI* — "Web" redundant next to "UI".
- *Appearance / AppearanceJS* — technically clearest but unsearchable.
- *Copland* — failed-Apple-project baggage.
- *PlatinumKit / Charcoal* — tie too tightly to one theme; mismatched scope for a theme engine.
- *Kaleidoscope* — collides with the modern git diff tool.

**Application:** if anyone proposes renaming during early development, this entry is the rationale. The decision was load-bearing on the project's positioning (drop-in UI library for the retro/period niche), not aesthetic preference.

### 2026-05-16 — North Star: framework-agnostic, declarative-first, spec-faithful re-implementation

Three load-bearing positioning decisions made together. The PRD's North Star section is the canonical statement; this entry records the reasoning so future contributors don't have to derive it.

**Framework-agnostic (no React/Vue/Solid peer dep).** The library aims for the same niche WinBox occupies — "any page, any framework, drop in" — but with authentic Mac OS Appearance chrome and a theme engine. Tying to a framework would halve the addressable consumer set for no real engineering benefit. The cost (we don't get framework-idiomatic component APIs out of the box) is paid by writing thin framework wrappers in separate companion packages later if demand justifies them.

**Declarative-first via data attributes.** The primary integration story is `<div data-aaron-window data-aaron-title="...">` markup that "just works" once the library loads — no JS required for the common case. Inspired by [HTMX](https://htmx.org/) and [Bootstrap's `data-bs-*` attributes](https://getbootstrap.com/docs/5.3/components/dropdowns/), both of which succeed largely because the integration cost is "add an attribute" rather than "import a component."

Architectural consequence: the imperative TypeScript API is the foundation; the declarative scanner is a thin layer on top that constructs `new AaronWindow(...)` from `[data-aaron-window]` elements (on `DOMContentLoaded` plus a `MutationObserver` for dynamic additions). Same code path, two front doors. Class selectors (`.aaron-window`) are accepted as a fallback for environments where data attributes are awkward (CSP-restricted contexts, certain CMSes), but `data-*` is the recommended path because it cleanly separates "this is configuration" from "this is a styling hook."

**Spec-faithful, never decompiled.** Aaron UI is positioned as an **API-compatible re-implementation of the Mac OS 8/9 Appearance Manager** — themes that worked under Apple's system should be adaptable into Aaron UI bundles with their intent preserved. But the implementation is independent and clean-room:

- Sources are Apple's published HIG, archived API docs, period screenshots, and the visible behavior of real Mac OS 8.5 running under emulation.
- We do not look at decompiled Apple source.
- We do not extract pixel artwork from Apple binaries; period themes are re-authored from screenshots.
- Provenance is documented per-theme in `theme.json`.

This is both an ethical/legal stance *and* a design discipline. It forces every visual decision to be traceable to a public spec or reference, which incidentally produces a much cleaner codebase than "look at what the original did and copy it."

**Application:** when implementing, every PR touching the default Platinum theme should cite the relevant HIG section in the commit message. Every theme port from a period source should document its provenance. If someone proposes shortcuts ("just grep through this Mac OS source dump for the answer"), this entry is the reason to say no.

### 2026-05-16 — license deliberately left open

The temptation is to match the upstream cv-mac / wasm-retro-cc family (GPL-3.0-or-later). The honest reason to defer: this is a library *meant to be embedded in other projects*, and the right license depends on a question we can't yet answer — how much do we want it used by closed-source projects?

- MIT / Apache-2.0 maximizes adoption.
- LGPL is the classic library-license compromise (copyleft on the library, not on consumers who dynamically link).
- GPL-3.0-or-later matches family and is honest if we value share-back.

The decision is deferred until after Phase 1 ships and we have a sense of who's actually picking it up. Until then `package.json` says `UNLICENSED` and the README is explicit that the project is pre-license.

**Application:** do not pick a license on someone's reflexive "all repos should have a LICENSE" instinct. The deferral is deliberate. Open an issue to discuss before merging any LICENSE file.

---

*New learnings get appended below this line as the project ships.*
