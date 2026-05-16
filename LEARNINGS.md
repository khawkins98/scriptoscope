# Learnings

A running log of things we've learned building Aaron UI — gotchas, dead ends, surprises, and decisions worth remembering. The goal is to save the next person (or future-you) from rediscovering the same lessons.

Entries are added as the project ships, with dated headers and enough narrative to be useful in six months without context. The companion file in [classic-vibe-mac/LEARNINGS.md](https://github.com/khawkins98/classic-vibe-mac/blob/main/LEARNINGS.md) is worth reading for the convention.

The entries currently in the file are *pre-implementation* — they capture the positioning, naming, and licensing decisions made before any code was written. Once Phase 1 ships, regular entries get appended chronologically below the pre-implementation section.

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

### 2026-05-16 — Kaleidoscope is the primary deconstruction corpus, even though the spec spine is the Appearance Manager

The PRD positions Aaron UI as "an API-compatible re-implementation of the Mac OS 8/9 Appearance Manager." The natural reading is "deconstruct Apple `.afm` files." Resisting that reading is deliberate.

**The corpus problem:** there are ~4,010 Kaleidoscope `.ksc` schemes on Macintosh Garden and a handful of Apple `.afm` files. For "study several real bundles, find the patterns," that ratio matters.

**The provenance problem:** Apple's official theme artwork has the strongest IP posture of anything in this space. Even as visual reference it's the riskiest source. A community Kaleidoscope scheme that reproduces Platinum is *cleaner provenance* than Apple's own Platinum bitmaps — and they exist (mass:werk's "7 Le" is described by its author as "Apple's System 7 with a touch of platinum"). Notably, Macintosh Garden ships a `kaleidoscope_banned.zip` of 32 schemes Apple actually issued takedowns against — all of them OS X Aqua reproductions, none of them Platinum. That's evidence of where Apple's enforcement attention actually goes.

**Why this doesn't undermine the PRD's "Appearance Manager re-implementation" framing:**

- Apple published Appearance Manager documentation (legacy developer.apple.com, mirrored on Wayback). The format *spec* is available as written prose. We don't need a binary `.afm` to learn the format.
- Kaleidoscope predates the Appearance Manager by ~2 years and was substantially the model Apple formalized when shipping the Appearance Manager in Mac OS 8.5. Studying `.ksc` is studying the same design DNA, one step closer to the ground.
- Both formats are Mac resource-fork bundles. Resource type categories overlap heavily. Studying one teaches you the shape of the other.

**The discipline this requires:** what we learn from `.ksc` informs Aaron UI's bundle format — it does not *become* Aaron UI's bundle format. We are designing a re-implementation of the *Appearance Manager*, not a port of *Kaleidoscope*. If `.ksc` has a quirk the Appearance Manager doesn't, we don't inherit it. The format spine remains Apple's documented spec; Kaleidoscope is corpus and visual reference.

**Application:** the spike at `docs/RESEARCH-SPIKE-THEMES.md` codifies this. When someone in six months asks "why didn't we start with Apple's own theme files," this entry is the reason. The short version: better corpus, better provenance, same underlying design DNA, and the spec we claim compat with is published as prose so we don't need the binary.

---

### 2026-05-16 — Period chrome had no hover state; Aaron UI defaults to that

Surfaced during the first scheme deconstruction ([`docs/scheme-deconstruction/masswerk-7-le.md`](docs/scheme-deconstruction/masswerk-7-le.md)). Mac OS 8 chrome had exactly three interaction states for any control: **Normal, Pressed, Disabled**. There is no "Hover" — that's a post-OS X / web-era concept. The `cicn` named-resource vocabulary in mass:werk 7 Le has 18 distinct state variants for checkboxes alone (3 sizes × 2 selections × 3 states), and none of them are hover.

**Application:**

- **Default behavior:** Aaron UI's Platinum theme renders no hover effect on chrome controls. A pointer over a close box looks the same as a pointer elsewhere. Period-faithful.
- **What this means for the framework:** chrome CSS uses `:active` for the Pressed state and `:disabled` / `[aria-disabled]` for Disabled, but **no `:hover` rule** in the default theme.
- **Possible future:** a light, opt-in hover indication (cursor change, subtle 1px outline) could land in a later phase under a `--aaron-allow-hover-affordance` opt-in. Modern web users have hover-formed expectations and accessibility benefits, so we don't want to close the door — but enabling it by default would compromise authenticity. Any future implementation should be tasteful (no full-state hover artwork) and configurable per-theme.
- **Document for consumers:** README should set the expectation up front — "no hover effects by default" — so anyone evaluating Aaron UI against a modern web component library doesn't think it's broken.

[[masswerk-7-le-deconstruction]] is where this surfaced; [[multi-theme-demo]] inherits the no-hover default.

---

### 2026-05-16 — Themes don't bring sounds or desktop backgrounds; preset themes can offer them as extras

Surfaced after deconstructing both [`mass:werk 7 Le`](docs/scheme-deconstruction/masswerk-7-le.md) and [`mass:werk Dark ErgoBox 2`](docs/scheme-deconstruction/masswerk-dark-ergobox2.md). Neither scheme ships `snd ` resources, a desktop background, or fonts. Kaleidoscope *supported* sound resources via its format, but in practice almost no schemes carried them; desktop backgrounds and fonts were never in the format. The OS supplied all three.

This affects the PRD's "theme bundle ships chrome + controls + desktop + sounds + colors + fonts" aspiration. After two deconstructions, the empirical pattern is clear:

- **Chrome + controls + colors:** every scheme ships these. Aaron UI can reasonably expect a ported theme to define them.
- **Desktop background + sounds + fonts:** essentially no scheme ships these. Aaron UI cannot expect ported themes to provide them.

**Application — split into two consumer-facing categories:**

1. **First-party / preset Aaron UI themes** (Platinum, eventually Hi-Tech, Drawing Board, etc.) — *may* include sounds + desktop + a webfont, as opt-in extras. Authentic to the *Apple Appearance Manager* aspiration. The user gets a "full" thematic experience.
2. **Ported third-party themes** (Kaleidoscope-derived: mass:werk schemes, community ports, etc.) — chrome + controls + colors only. No sounds, no desktop, no fonts. The OS/host page provides what the scheme doesn't.

**Document for consumers (README + future docs):** "When you load a Kaleidoscope-derived theme, expect chrome and color changes only — sounds and desktop are an Aaron-UI-preset-theme feature."

**Architectural consequence:** Aaron UI's bundle format should make sounds/desktop/fonts *optional* fields in `theme.json`. The theme loader degrades gracefully when they're absent — no warnings, no fallback artwork, the page just behaves as if those features aren't enabled. The PRD's "theme is a complete bundle" framing remains true; "complete" just doesn't mean "must have every category."

[[masswerk-dark-ergobox2-deconstruction]] is the second data point that confirmed this; the [[theme-bundle-format]] design owes this entry an "optional fields" treatment.

---

### 2026-05-16 — Same-author vocabulary isn't normalized; Aaron UI must pick one canonical convention

Surfaced when comparing the two mass:werk schemes. Same author (N. Landsteiner), 10 years apart, used opposite noun-state ordering in `cicn` names:

- **2001 (7 Le):** `Active Document Window` / `Inactive Document Window`
- **2011 (ErgoBox 2):** `Document Window Active` / `Document Window Inactive`

**Implication:** Aaron UI's canonical chrome vocabulary must normalize. We don't get a clean ready-made convention from "what Kaleidoscope authors did" — even one author's body of work disagrees with itself.

**Recommendation:** adopt **`<noun> <state>`** (matches HIG prose: "the active document window" — but the *catalog entry* reads "Document Window — Active"). This puts the chrome element first, which is more searchable in the catalog and aligns with how CSS custom properties read (`--aaron-document-window-active-bg`, not `--aaron-active-document-window-bg`).

Apply this to [[theme-bundle-format]] when drafted.

---

*New learnings get appended below this line as the project ships.*
