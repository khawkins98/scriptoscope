# Learnings

> **Read this first — this is a historical, append-only running log.** Entries are
> never deleted; they're added chronologically as the project ships. The
> **authoritative current narrative and architecture now live elsewhere**:
> [`docs/history.md`](docs/history.md) (especially its
> "[Dead ends — don't relitigate these](docs/history.md#dead-ends--dont-relitigate-these)"
> section) and the specs under [`docs/spec/`](docs/spec/) (start with
> `compositor-spec.md`). **Many entries below predate the v3 part-code-compositor
> reset (2026-05-22)** and describe approaches that have since been superseded —
> CSS `border-image` / 9-slice chrome, stretching fill regions, uniformity- or
> width-based stretch-vs-fixed decisions, start-based cell↔part-code association,
> `cornerSize` heuristics, widget carving + a second stamping pass, the kDEF 1.8.2
> decode, and the Kind A/B/C chrome classifier, among others. **Read them as
> history; verify against the current docs before acting on them.** Entries that
> directly contradict the current v3 model are tagged inline with a
> `> ⚠️ Superseded` blockquote pointing back to `docs/history.md`.

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

### 2026-05-16 — naming (Aaron UI, after considering nine others)  *(superseded 2026-05-28 — see "Scriptoscope pivot" below)*

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

### 2026-05-16 — license deliberately left open  *(superseded 2026-05-28 — see below)*

The temptation is to match the upstream cv-mac / wasm-retro-cc family (GPL-3.0-or-later). The honest reason to defer: this is a library *meant to be embedded in other projects*, and the right license depends on a question we can't yet answer — how much do we want it used by closed-source projects?

- MIT / Apache-2.0 maximizes adoption.
- LGPL is the classic library-license compromise (copyleft on the library, not on consumers who dynamically link).
- GPL-3.0-or-later matches family and is honest if we value share-back.

The decision is deferred until after Phase 1 ships and we have a sense of who's actually picking it up. Until then `package.json` says `UNLICENSED` and the README is explicit that the project is pre-license.

**Application:** do not pick a license on someone's reflexive "all repos should have a LICENSE" instinct. The deferral is deliberate. Open an issue to discuss before merging any LICENSE file.

### 2026-05-28 — license decided: MIT (first-party code), themes scoped out

Resolved the deferred decision from 2026-05-16. The library is **MIT** for first-party code (`src/`, `tools/` first-party files, `scripts/`, `demo/` code); bundled third-party material keeps its own terms.

The reasoning that broke the tie: Aaron UI's value is being *embedded* in other people's projects (the declarative `data-aaron-*` front door + the cv-mac integration target both ask for this). MIT is the dominant choice for UI libraries that want broad adoption (Bootstrap, Tailwind, Headless UI, MUI), and the "share-back-to-cv-mac" argument is weaker once we recognize that the value flowing *to* cv-mac is the runtime running their app, not the runtime being modified. LGPL would add real friction for the typical consumer who'd vendor or bundle Aaron UI into a bundle (their build tool effectively static-links). GPL would make Aaron UI a tool that consumers route around.

Scope: the LICENSE file is explicit that it covers code only. Themes carry per-scheme freeware-with-redistribution terms in `themes/<slug>/meta.json` (`origin.originalLicense`, `sourceUrl`) — these are NOT relicensed. The vendored munbox subset (`tools/sit-wasm/munbox/`) keeps its own MIT (already MIT-compatible). Demo fonts (Charcoal 12 / Virtue) keep their own terms (CC BY-SA / free-with-credit).

Shipped: `LICENSE` (b7ceb4a), `package.json` `"license": "MIT"`, README "License" section breaking out themes / munbox / fonts. This entry is the rationale companion to #26.

**Application:** don't second-guess the MIT call without a concrete reason — the deferral was real, and so was the resolution. If a future scheme imports a non-MIT-compatible chunk (an asset under stricter terms), handle it in `themes/<slug>/meta.json` per-bundle, not by relicensing the runtime.

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

Surfaced during the first scheme deconstruction (`mass:werk 7 Le`; the working notes have since been retired with the scheme). Mac OS 8 chrome had exactly three interaction states for any control: **Normal, Pressed, Disabled**. There is no "Hover" — that's a post-OS X / web-era concept. The `cicn` named-resource vocabulary in mass:werk 7 Le has 18 distinct state variants for checkboxes alone (3 sizes × 2 selections × 3 states), and none of them are hover.

**Application:**

- **Default behavior:** Aaron UI's Platinum theme renders no hover effect on chrome controls. A pointer over a close box looks the same as a pointer elsewhere. Period-faithful.
- **What this means for the framework:** chrome CSS uses `:active` for the Pressed state and `:disabled` / `[aria-disabled]` for Disabled, but **no `:hover` rule** in the default theme.
- **Possible future:** a light, opt-in hover indication (cursor change, subtle 1px outline) could land in a later phase under a `--aaron-allow-hover-affordance` opt-in. Modern web users have hover-formed expectations and accessibility benefits, so we don't want to close the door — but enabling it by default would compromise authenticity. Any future implementation should be tasteful (no full-state hover artwork) and configurable per-theme.
- **Document for consumers:** README should set the expectation up front — "no hover effects by default" — so anyone evaluating Aaron UI against a modern web component library doesn't think it's broken.

[[masswerk-7-le-deconstruction]] is where this surfaced; [[multi-theme-demo]] inherits the no-hover default.

---

### 2026-05-16 — Themes don't bring sounds or desktop backgrounds; preset themes can offer them as extras

Surfaced after deconstructing both `mass:werk 7 Le` and `mass:werk Dark ErgoBox 2` (both since dropped from the corpus; the working notes were retired with them). Neither scheme ships `snd ` resources, a desktop background, or fonts. Kaleidoscope *supported* sound resources via its format, but in practice almost no schemes carried them; desktop backgrounds and fonts were never in the format. The OS supplied all three.

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

### 2026-05-16 — Apple themes dropped; Kaleidoscope is the corpus, and the clean-room boundary is sharpened

Strategic pivot recorded explicitly. The PRD's original positioning ("API-compatible re-implementation of the Mac OS 8/9 Appearance Manager") and the implied roadmap commitment to reproducing Apple's official themes (Hi-Tech, Drawing Board, Gizmo) are both dropped. The replacement framing: Aaron UI is a Kaleidoscope-style theme engine that loads and faithfully renders schemes from the Kaleidoscope corpus, prioritizing those whose authors explicitly licensed redistribution.

**What forced the pivot:**

1. **License friction with Apple's themes is real and not worth managing.** Even with clean-room re-authoring discipline, reproducing Hi-Tech / Drawing Board / Gizmo introduces ongoing legal risk and reduces our freedom in how we ship. Apple's enforcement record (the 32 schemes in `kaleidoscope_banned.zip` were all Aqua reproductions) shows they actively defend visual IP that matters to them currently. We don't need this distraction.
2. **The Kaleidoscope corpus is large enough that we don't need Apple's themes.** ≈4,010 schemes on Macintosh Garden, many Platinum-faithful (mass:werk "7 Le" is one), many with explicit freeware-with-redistribution readmes. The headline "Platinum → alternate look → another alternate look" demo works just as well with mass:werk 7 Le → Dark ErgoBox 2 → a community classic.
3. **The clean-room boundary is conceptually cleaner this way.** It's "we never use Kaleidoscope's *source code*" — same as any file-format reader is clean-room from the original engine that produced the files. We *do* use the compiled scheme assets, exactly as their freeware licenses permit. This is the right kind of distinction to make.

**What this changes in the docs:**

- PRD §North Star principle #3 rewritten — no more "Appearance Manager re-implementation"; now "Kaleidoscope-corpus theme engine, clean-room from Kaleidoscope itself."
- PRD §What it is — Apple's official themes removed from starter theme library.
- PRD §Phased delivery, Phase 4 — first non-Platinum theme is a Kaleidoscope scheme port (mass:werk 7 Le candidate), not Hi-Tech.
- PRD §Open questions — Q3 (legal pass on theme reproductions) marked resolved.
- PRD §Naming — added etymology note acknowledging the Aaron→Appearance-Manager connection is now looser.
- README — lede paragraph updated; North Star paraphrase updated; etymology note added.

**What this does NOT change:**

- The default Platinum theme. Still ships, still hand-authored. Provenance is now triangulated cleanly from three public sources: Apple's HIG (documentation, not binary), period screenshots (public, abundant), mass:werk's "7 Le" scheme (freeware-licensed Platinum-faithful Kaleidoscope reference).
- The window manager core (Phase 1).
- The framework-agnostic, declarative-first positioning.
- The Aaron UI name. The etymology is looser; the name stays — renaming costs are real and don't pay for themselves.

**Application:**

- When porting a Kaleidoscope scheme: extract its compiled assets, attribute the original author per readme terms, document provenance in `theme.json`, ship.
- When asked "does Aaron UI support Hi-Tech?": no, and intentionally — see this entry.
- When asked "is Aaron UI an Appearance Manager reimplementation?": no longer — it's a Kaleidoscope-style theme engine. The lineage to the Appearance Manager is the project's name etymology, not its scope.

[[masswerk-7-le-deconstruction]] and [[masswerk-dark-ergobox2-deconstruction]] are the first two ports under the new framing.

---

### 2026-05-16 — Chrome cicns alone don't reproduce a theme's full aesthetic; Kaleidoscope composites at runtime

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends" (CSS `border-image` / 9-slice chrome).

Surfaced while building `demo/themes-raster.html` with extracted raster assets and comparing to mass:werk's own preview JPGs. Two findings, both with bundle-format consequences:

**1. ErgoBox's cicn body is white, not gray.** The Document Window cicn renders pixel-perfectly as a white-body chrome with a small projecting tab. The masswerk reference thumbnail shows the same window with a *medium-gray* body. Inspecting the cicn's pixel data (via the scheme-extractor decoder) confirms the cicn is genuinely white — the gray in the reference is runtime composition, almost certainly a `ppat` pattern resource overlaid on the body region by Kaleidoscope at draw time. We have 25 `ppat` resources extracted from ErgoBox but the bundle format hasn't yet encoded "which ppat layers over which cicn region."

**2. Chrome shape can carry layout, but bitmap chrome can't natively reflow.** ErgoBox's tab-projecting titlebar is *encoded* in the cicn's pixel geometry (top-left has the tab; rest of top is transparent). When `border-image` 9-slice stretches the top slice horizontally, the tab geometry is destroyed. The demo's workaround — render the cicn at native pixel size only — gets pixel fidelity but loses variable window sizing. A real Aaron UI bundle format needs *either* separate per-region assets (tab.png + frame.png) or a richer descriptor than 9-slice.

**Application:**

- The Phase 4 theme bundle format must include a *runtime composition layer*: which `ppat` patterns get layered over which `cicn` regions, in which blend mode. Without this, ported themes will look "incomplete" vs their period-Kaleidoscope appearance.
- The same format must declare *chrome geometry separately from chrome paint*: a "tab" element with its own size and origin, sliced from the source asset by explicit coordinates rather than CSS 9-slice. This is the price of supporting BeOS-tab and other non-rectangular chrome shapes.
- For the demo, both findings are captured as visible artifacts. Pure-fidelity rendering of the extracted cicns is more honest than papering over with synthetic gray fills.

[[multi-theme-demo]] [[masswerk-dark-ergobox2-deconstruction]]

---

### 2026-05-16 — Bitmap chrome rendering: 9-slice for variable elements, tile-repeat for periodic patterns, fixed-aspect for full-frame composites

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends" (9-slice / `border-image`; stretch-vs-fixed is the part code, not a per-category heuristic).

Surfaced while iterating `demo/themes-raster.html` with actual extracted cicn raster assets and validating against the masswerk reference thumbnails via headless Chromium. Three findings, each with bundle-format consequences for Phase 4.

**1. CSS `background-image` stretching destroys bitmap chrome.** Stretching a 132×64 cicn to fill a 340×180 window via `background-size: 100% 100%` produces visible browser interpolation — 1px borders become fuzzy ~3px lines, widget glyphs blur, period crispness is lost. `image-rendering: pixelated` helps for integer scale multiples but does not save uneven stretch (2.58× horizontal vs 2.81× vertical is still bilinear-filtered in practice).

**Right tool per category:**

| Chrome category | Asset shape | Correct CSS render |
|---|---|---|
| Window-frame composite (full BeOS tab + body in one cicn) | Fixed-aspect bitmap | Fixed window size at integer scale (1×, 2×, 3×). Either lock the window to the cicn aspect, OR ship separate per-region assets (tab.png + frame.png) and assemble. |
| Scrollbar track background | Periodic tile (e.g., 16×16 stippled pattern) | `background-repeat: repeat-x` — natural fit. |
| Progress bar fill (barber pole) | Periodic tile (e.g., 12×10 diagonal stripes) | `background-repeat: repeat-x` — also natural fit. |
| Scrollbar thumb | Fixed end-caps + middle grip | `border-image` 9-slice with end-cap-width slices; middle stretches. |
| Progress bar track | Engraved frame, possibly with end caps | `border-image` 9-slice with 1px slices preserves the engraved edges crisp at any width. |
| Window controls (close, zoom) | Fixed-size glyphs (~16×16) at fixed positions inside a larger composite | Pseudo-elements with `background-position` offsets to clip the relevant region. |

**2. The cicn's "white body" is a runtime-composition issue.** mass:werk Dark ErgoBox 2's Document Window cicn body is genuinely white pixels (verified by parsing the PNG RGBA buffer directly). The reference thumbnail shows gray. Kaleidoscope must have layered a separate gray `ppat` over the body region at draw time. The demo fakes this with `mix-blend-mode: multiply` against a gray overlay (`#b4b4b4` ish), which produces the correct visual but is the wrong mechanism. Phase 4 needs to support **declared composition** in `theme.json`: which `ppat` overlays which `cicn` region, in which blend mode, masked to which sub-rectangle.

**3. Bitmap chrome is inherently fixed-aspect.** A 132×64 cicn rendered at 2× gives a 264×128 window. To get variable-aspect windows under bitmap chrome (which the masswerk reference clearly does — inactive is wider but shorter than main), Kaleidoscope must have used the `cinf` interaction-rect metadata to declare WHICH regions stretch and WHICH stay fixed. Our scheme-extractor currently parses `cinf` but doesn't decode the rect data. For the demo we accepted uniform fixed-size ErgoBox windows; for Phase 4 the bundle format needs to translate `cinf` rects into 9-slice CSS rules (or a richer composition descriptor).

**Application:**

- **Demo / immediate:** the existing `demo/themes-raster.html` uses the right tool per category. Future control additions (sliders, popups, menubars) should follow the same per-category mapping.
- **Phase 4 bundle format `theme.json` needs at minimum:**
  - For each window-type entry: source cicn(s), 9-slice positions, OR separate-asset layout
  - For tileable patterns: which patterns tile in which direction, repeat behavior
  - For runtime composition: layer descriptors (cicn + optional ppat overlay + blend mode + masked region)
  - For interaction-rect mapping: cinf-equivalent metadata so the WM knows where the close-box click target actually is
- **scheme-extractor evolution:** add `cinf` rect decoding to the lib, surface interaction-rect data in the manifest alongside the PNG references.

[[multi-theme-demo]] [[masswerk-dark-ergobox2-deconstruction]] [[theme-bundle-format]]

**Addendum 2026-05-16 — building from the geometry spec works.** Within the same day we (a) wrote `docs/kaleidoscope-geometry-spec.md` from the TMPL data, (b) extended the scheme-extractor with `cinf` and `wnd#` decoders that emit a draft `theme.json` per the spec's §7 schema, and (c) rewrote the demo's JS to fetch theme.json at runtime and position widget hit-targets by scaling wnd# part rects to current titlebar dimensions. Result: the per-theme hand-tuned magic numbers for "where is the close box click area" disappeared, replaced by one positioning function that works for both themes by reading the same data Kaleidoscope itself reads. Independent proof that the spec is workable as Aaron UI's Phase 4 contract: hand-coded JS in the demo today, TypeScript WM code in Phase 1+4, both consume the same JSON. Functional checkboxes/radios/buttons added in the same pass — they swap the underlying cicn URL via `[data-checked]` selectors, no JS-controlled image manipulation needed. This iteration also clarified the architectural truth that `cicn` (raster) and `cinf`/`wnd#` (geometry) are *paired but not always 1:1*: window-chrome cicns pair with `wnd#` (parts + edge recipes), individual control cicns pair with `cinf` (9-slice + bgPattern). The extractor's pairing logic handles both via the shared resource ID convention.

**Addendum 2026-05-16 — Kaleidoscope ships its own spec inside every scheme.** Cont'd from the bitmap-chrome rendering thread: the `cinf` and `wnd#` resources we'd been treating as opaque "Kaleidoscope custom metadata" are actually the canonical 9-slice geometry data + per-window-type composition recipe. Each scheme also embeds the `TMPL` resources that define their structure — the format is self-documenting. `cinf` literally encodes `cornerSize`, `sideThickness`, `tileSides`, and `bgPatternId` (the ppat to layer over the chrome body — i.e., the runtime composition that turns ErgoBox's white-body cicn into the gray you see in the reference thumbnail). `wnd#` encodes named clickable parts with rectangles inside the chrome cicn (the close box rect, the zoom box rect, etc.) plus per-side edge recipes. Full deconstruction + Aaron UI mapping + proposed `theme.json` schema is now in [`docs/kaleidoscope-geometry-spec.md`](docs/kaleidoscope-geometry-spec.md). The implication for the demo: stop guessing slice values, read them from `cinf`. The implication for Phase 4: `theme.json` is essentially a JSON serialization of the relevant Kaleidoscope resources, paths-to-extracted-PNGs included. Several earlier hacks (the multiply-blend gray-tint over ErgoBox) become principled once we honor `cinf.bgPatternId`.

**Addendum 2026-05-16 — never guess `border-image-slice` values, decode the cicn first.** My first attempt at 9-slicing the scrollbar thumb used a 4px slice, which cut INTO the grip-dot art and made the dots stretch with the thumb width. The fix was to actually decode the cicn pixels (via the scheme-extractor's PNG output, parsed back with pngjs, ASCII-printed one row at a time) and discover the grip dots sit at pixels 5/7/9/11 of the 17-wide cicn — so the correct slice is 8px from each side, leaving only the single solid-white pixel 8 to stretch. The discipline this teaches: for every 9-slice CSS rule we write against a Kaleidoscope cicn, inspect the pixels first, pick slice values that fall at color/value boundaries. Phase 4's bundle format should encode these slice positions per-asset in `theme.json` rather than re-deriving them every time, and the scheme-extractor manifest could plausibly compute and emit suggested slice positions automatically by detecting flat-color regions vs detail-rich regions.

---

### 2026-05-17 — Phase 1 shipped: the implementation actually works the way the planning said it would

Closing out Phase 1 of the PRD's phased delivery. All 10 issues in the [Phase 1 — WM core](https://github.com/khawkins98/aaron-ui/milestone/1) milestone landed in 10 PRs over a single working session: toolchain (TS strict + Vite library + Vitest + Playwright + CI), AaronWindow class with full lifecycle + options + WinBox option-key parity, drag with Pointer Events, 8-direction resize with proper min-size clamping, WindowManager singleton for z-order + focus + raise-on-click, programmatic close/minimize/restore/maximize, declarative `[data-aaron-window]` scanner with MutationObserver, ARIA + keyboard + focus-trap on modals + axe-core in CI, and a behavioral test suite. Final shape: 140 unit + 30 e2e tests, all green; ~7 KB gzipped bundle (well under PRD's 30 KB target); live demo at <https://khawkins98.github.io/aaron-ui/>.

**What the planning got right:** the PRD's Phase 1 description was sufficient to drive 10 issues that decomposed cleanly into one-PR-each work. The "imperative API is the foundation; declarative scanner is a thin layer on top" architectural call from §North Star principle #2 held up — the scanner is genuinely thin and shares the same code path. The WinBox option-key parity (issue #3) costs almost nothing and unblocks the cv-mac swap (Success Criterion #1).

**What the planning didn't anticipate** (so worth noting):

- **The WindowManager singleton.** The PRD doesn't mention one, but z-order + focus + raise-on-click naturally cluster into a shared registry. Introduced in issue #6 as a module-level singleton with explicit `reset()` for tests. If multi-WM scenarios surface later (embedded apps?) we factor out a `createWindowManager()` constructor; for now one shared instance suffices.
- **The data-aaron-promoted sentinel.** The scanner needs to skip already-rendered windows or it infinite-loops (the rendered window also has `data-aaron-window`). The PRD didn't surface this; obvious in retrospect.
- **jsdom's PointerEvent gap.** jsdom doesn't constructor-ify `PointerEvent`. The test helper synthesises one off `MouseEvent` + `Object.defineProperty(pointerId)`. Documented in the test file.

**Application for Phase 2-6:** the per-phase tracker-issue pattern works — 10 right-sized issues per phase, opened in advance with acceptance criteria, then worked sequentially with one PR per issue. Each PR ~15-30 minutes to write + ~45 seconds CI. Use this cadence for Phase 2 onwards. Trackers for Phase 2-6 + cross-cutting concerns are already open at issues [#21-31](https://github.com/khawkins98/aaron-ui/issues?q=is%3Aissue+is%3Aopen+label%3Atype-epic).

---

### 2026-05-17 — Aaron UI is a Kaleidoscope-compatibility runtime, not a Platinum re-author

Strategic pivot, recorded same day Phase 1 docs sync landed. The PRD's original Phase 2 — hand-author a first-party Platinum theme from the Mac OS 8 HIG — is dropped. Phase 2 collapses into Phase 4. The bundled default theme is mass:werk's freeware "7 Le" scheme, loaded through the same runtime as every other Kaleidoscope scheme.

**What forced the pivot.** Three things stacked up:

1. **mass:werk's "7 Le" already exists, is freeware-with-redistribution-licensed, and is explicitly Platinum-faithful.** Hand-authoring a competing Platinum from the HIG would duplicate work that's already been done — and done well, by an author with deeper Mac OS 8 fluency than we'll acquire on the side. The freeware-licensed Platinum is *right there*.
2. **"Hand-authored first-party Platinum + runtime for everyone else's Kaleidoscope themes" is a confused product story.** Two rendering paths, two authoring disciplines, two sets of bugs. "Aaron UI is the runtime; schemes are the format" is a much sharper story — one code path, one mental model, one boundary to defend.
3. **The pivot makes classic-Mac authoring tools live again.** Because Aaron UI honours `.ksc` as the input format (not a new web-native bundle format), anyone with ResEdit + the Kaleidoscope SDK on a real classic Mac or under SheepShaver can author a new theme that Aaron UI loads. The long-dormant Kaleidoscope authoring toolchain becomes a live authoring path for the modern web — a genuinely interesting consequence of the pivot, not just an architectural simplification.

**What it changes in scope.** Phase 2 (Platinum chrome) is gone. Phase 4 (theme engine) absorbs its scope and becomes the critical path. Issue #21 (Phase 2 epic) closes as not-planned with a pointer to this entry. Phase 4 milestone gains the "bundled-default scheme = 7 Le" deliverable, plus an "at least one externally-loaded scheme" deliverable that proves the runtime end-to-end. Phase 3 (controls) is unchanged structurally but is now wired against `cicn` state-variant artwork from the loaded scheme, not against first-party CSS primitives.

**What it changes in tradeoffs.** Risk goes up before it goes down:

- **The runtime is now on the critical path before any visible chrome can ship.** Previously, Phase 2 could have delivered a visible Platinum window with hand-authored CSS while Phase 4 worked on the engine in parallel. Now nothing renders chrome until the runtime + a loaded scheme work together. The `docs/kaleidoscope-geometry-spec.md` foundation makes this less scary than it sounds, but the dependency is real.
- **No fallback if `cicn`/`ppat`/`cinf`/`wnd#` rendering hits hard problems.** Previously, "first-party Platinum CSS" was a fallback that didn't depend on the format-faithful runtime. That fallback is now gone — if 9-slice composition under `cinf` rules can't render a tab-projecting titlebar correctly, the bug has to be solved, not designed-around.
- **Bundle size accounting splits.** "WM core ≤30 KB gzipped" was the original target. Bundled-default scheme PNGs (cicns + ppats for 7 Le) push the unconditional download up. Acceptance criterion now distinguishes "runtime ≤30 KB gz" from "+bundled scheme assets" so the headline number stays honest.

**What it does NOT change.**

- The window manager core (Phase 1). Still shipped, still good.
- The framework-agnostic, declarative-first positioning.
- The clean-room boundary from Kaleidoscope's source code (sharpened, not relaxed — we still never read the closed engine).
- The Aaron UI name. Already loose etymologically after the 2026-05-16 "Apple themes dropped" pivot; one notch looser now. Renaming costs are real and don't pay for themselves.

**Application:**

- When someone asks "where's the hand-authored Platinum theme?" — there isn't one, intentionally. The answer is "load mass:werk 7 Le, which is Platinum-faithful and freeware-licensed."
- When designing a new control in Phase 3: do not author CSS that renders the control's chrome directly. Wire it to consume `cicn` state-variant artwork from the loaded scheme via the runtime, the way Phase 1's checkboxes/radios/buttons already do in `demo/themes-raster.html`.
- When evaluating new theme contributions: the contribution is a `.ksc` plus a license-of-origin note, not CSS. If a contributor wants to author something new, the recommended path is "open ResEdit under SheepShaver, use the Kaleidoscope SDK." (We may eventually ship a web-based scheme builder — that's a much later project.)
- When reading older docs that say "default Platinum theme is hand-authored": they're stale. Update if encountered.

[[masswerk-7-le-deconstruction]] is the bundled default. [[kaleidoscope-geometry-spec]] is the contract. The cv-mac swap (Success Criterion #1) now arrives via Phase 4 instead of Phase 2.

---

### 2026-05-17 — Hand-rolled validator beat zod for theme.json (bundle-weight discipline)

Surfaced shipping [#35](https://github.com/khawkins98/aaron-ui/issues/35) (Phase 4.1, theme.json schema + runtime validator). The obvious choice for runtime JSON validation in 2026 is `zod` — declarative, well-typed, ergonomic. We didn't pick it.

**Why hand-rolled won:**

- **Bundle weight is a project constraint, not a vibe.** PRD §Success criteria #5 caps the WM core + theme runtime at ≤30 KB gzipped. zod is ~14 KB minified gz on its own. The theme schema is shallow (~7 nested shapes, no recursion, no discriminated unions worth speaking of). A ~250-line hand-rolled validator with `assertObject` / `assertString` / `assertNumber` / `assertBoolean` helpers does the same job for under 2 KB.
- **The error-path UX we wanted is awkward in zod.** We wanted `theme.json.windowTypes.document.parts.close.rect[3]` — a dotted path the user can grep for. zod's `ZodError.issues[].path` is an array that needs joining at the call site; hand-rolling lets the path travel as a string from the entry point and arrive shaped exactly right.
- **The validator is mostly forward-compat anyway.** Most of what zod buys (refinements, transforms, branded types) we don't need. We need "is this a Theme or not, and if not, where exactly is the problem."

**The principle this teaches:** for a library with a bundle-size target, default to "can this be hand-rolled in ~200 lines" before reaching for a validation library. If yes, hand-roll. The validator code in `src/themes/schema/parseTheme.ts` is dull and obvious — no abstraction, no cleverness — which is the right shape for code that's going to be on the critical path of every theme load.

### 2026-05-17 — Forward-compat on `ThemeOptions`: silently drop unknown keys

Smaller decision recorded for honesty. `parseTheme()` accepts `{options: {newFutureFlag: true}}` and silently drops `newFutureFlag` rather than throwing. The reason: future Kaleidoscope-scheme bundles may carry option flags Aaron UI doesn't yet recognize (the scheme format is older than the runtime); rejecting the entire bundle for an unknown option would be the wrong failure mode.

**Tradeoff accepted:** typos in option names (`menuHighlightOverlay` written as `menuHilightOverlay`) silently misbehave. We accept this because (a) the option set is small and stable, (b) the extractor populates these mechanically so typos at the bundle author's hand are rare, (c) the alternative — strict mode — is worse for the documented forward-compat use case.

If Phase 4.2 (#36) extends the extractor to emit additional flags, those bundles will validate cleanly against the current schema. When the schema's `THEME_SCHEMA_VERSION` bumps to `"0.2"`, the validator throws a clear version error — so genuinely-breaking changes are caught loudly, not silently.

### 2026-05-17 — `exactOptionalPropertyTypes` shapes the parser

The tsconfig has `exactOptionalPropertyTypes: true`. This means `field?: T` permits *absence* but not explicit `undefined` — you can't write `out.author = obj.author` if `obj.author` might be `undefined`. The parser uses `'author' in obj` guards before every assignment, which makes the code slightly noisier but ensures the output Theme has fields exactly where present and absent where not (no `{author: undefined}` foot-guns for the runtime to handle later).

This pattern travels: anywhere the schema grows new optional fields, the `'key' in obj` guard goes with it. Documented inline in `parseTheme.ts`.

---

### 2026-05-17 — Extractor → library schema sharing: dual-implementation with a parity test, not "build first"

Surfaced shipping [#36](https://github.com/khawkins98/aaron-ui/issues/36) (Phase 4.2, scheme-extractor emits full theme.json per schema + `--validate` flag). The extractor lives in `tools/scheme-extractor/` (plain JS, intentionally browser-portable for the eventual web-based version) and needs to validate its `theme.json` output. The library's `parseTheme` validator from [#35](https://github.com/khawkins98/aaron-ui/issues/35) is TypeScript. Three ways to share:

1. **Build-first.** Extractor dynamic-imports `dist/index.js`. Cost: end-user porters running `scheme-extract --validate` have to `npm run build` first. Friction.
2. **Single source via `tsx` at runtime.** Extractor spawns a child process to run the TS validator via `tsx` or `node --experimental-strip-types`. Cost: adds a runtime dependency or experimental Node flag; spawn overhead per `--validate` call.
3. **Dual-implement: TS for the library, JS mirror for the extractor, parity test enforces agreement.** Cost: 150 lines of duplicated assertion logic that have to be updated together.

**We picked option 3.** Reasons:

- The extractor and library are *conceptually different packages* (the extractor's `package.json` says `@aaron-ui/scheme-extractor`; the library has its own). Each having its own validator is consistent with normal multi-package conventions (protobuf/openapi schemas generate per-language bindings exactly this way).
- The schema is shallow and stable at v0.1 — drift between two ~150-line validators is manageable.
- The parity test (`tools/scheme-extractor/lib/buildThemeJson.test.js` → "mirrors parseTheme behavior on the canonical fixtures") runs both validators against the two committed mass:werk extraction manifests and asserts they reach the same yes/no verdict. Any divergence fails CI immediately.
- End-user porters get `--validate` working out of the box with zero setup.

**Application:** when shipping a new schema version (a 0.2 bump or any structural change), update *both* `src/themes/schema/parseTheme.ts` and `tools/scheme-extractor/lib/validateTheme.js`. The parity test will fail loudly if either is out of step.

### 2026-05-17 — wnd# part IDs are scheme-relative integers, not a stable semantic enum

Surfaced while mapping `wnd#` parts to schema's `Record<string, PartEntry>`. The wnd# rectangle list encodes each named part as a 2-byte integer (`part: int16`). Reading the spec, you'd hope these IDs map to a stable enum (`wInGoAway = 4`, `wInZoom = 5`, etc., like classic Mac OS WDEF part codes). They don't — different schemes assign different integers to "close box" vs "zoom box". Sometimes part 1 is the close box; sometimes it's a divider. The binding from integer → semantic role lives in the cicn name field of the *paired* cicn, not in the wnd# itself.

For now the extractor emits part IDs as `"part-<n>"` string keys (a faithful preservation of what's in the resource fork). Phase 4.8 (#42, wnd#-driven hit targets) will need to either:
- Heuristically classify parts by their rect dimensions + position (close-box-shaped square in the top-left corner = close box), or
- Accept a sidecar mapping per scheme (`{ "part-1": "close", "part-2": "zoom" }` in the bundle's meta.json), or
- Probe the *cicn* for graphical features (a tiny ⊠ glyph at the part's rect = close box).

**Application:** when implementing #42, don't assume part IDs are universal. The runtime needs per-scheme classification. The extractor doesn't try — it preserves wnd#'s raw shape and defers semantic naming to a later layer.

### 2026-05-17 — Sidecar `meta.json` is where Kaleidoscope-corpus provenance lives

The binary `.ksc` carries chrome and geometry, not author/license. We needed somewhere to put that metadata. The choices were:
1. **Force the porter to hand-edit theme.json after extraction** — what the previous version did. Brittle: regenerate the bundle, you lose the metadata.
2. **Extract from the scheme's readme file via a separate text-parsing step** — ambitious but unreliable; readmes are unstructured prose.
3. **Sidecar `meta.json` file the porter writes once, passed to the extractor via `--meta`** — what we shipped.

The sidecar is durable (lives next to the source `.r`), regeneration-safe (next extraction reuses it), and unambiguous (the porter is asserting what the readme actually said). It's the right shape for the "port a freeware Kaleidoscope scheme" flow that CONTRIBUTING.md §"Adding a theme" describes.

**Application:** when adding new bundle-level metadata fields (e.g., a `tags: string[]` for browse/search), put them in meta.json. The extractor doesn't synthesize provenance; it stamps what the porter declares.

---

### 2026-05-17 — `meta.json` + `PROVENANCE.md` carry the same facts in two forms, and that's deliberate

Shipping [#37](https://github.com/khawkins98/aaron-ui/issues/37) (canonical theme bundles), we ended up with two files per bundle that say overlapping things:

- `themes/<slug>/meta.json` — structured JSON: `{name, author, origin: {kind, originalLicense, sourceUrl, ...}}`. Fed to the extractor; gets merged into `theme.json` on regeneration.
- `themes/<slug>/PROVENANCE.md` — human-readable markdown: author bio, readme excerpt, license interpretation, why the scheme is in the corpus.

The temptation was to pick one — either generate the markdown from the JSON, or extract the JSON from the markdown. We picked **dual-source-of-truth with a precedence rule:** if they drift, `PROVENANCE.md` is authoritative (it's the curated human record) and `meta.json` is corrected to match.

**Why two:**

- The JSON is what tooling needs — the loader, the extractor, the bundle-rebuild script. Machine-parseable.
- The markdown is what *people* need — a contributor evaluating "can we ship this scheme?" reads the prose, not the JSON. License interpretation, scheme history, and the "why we picked this" narrative don't survive flattening into structured fields.
- Auto-generating either direction loses something. Markdown-from-JSON produces sterile prose. JSON-from-markdown requires NLP-grade parsing of free-form author readmes.

**Application:** when a new bundle is added, both files are hand-authored. The `scripts/build-theme-bundles.mjs` script reads `meta.json` (so the structured side wins for the loader) but does not touch `PROVENANCE.md`. When facts change (a scheme moves to a new URL, the author's email changes), update both — and if they ever conflict, the markdown wins and the JSON is the one with the bug.

### 2026-05-17 — Bundle PNGs live next to the canonical bundle; demo PNGs are a fixture

There are now *two* copies of every extracted PNG on disk:

- `demo/assets/themes/<slug>/cicn-...png` — flat, alongside the old-shape `theme.json` and the `extraction-manifest.json`. Consumed by the current `demo/themes-raster.html` and serves as the regeneration source.
- `themes/<slug>/cicns/cicn-...png` and `themes/<slug>/ppats/ppat-...png` — subdir-organized, alongside the new schema-conformant `theme.json`. Consumed by Phase 4 runtime tickets (#38+) and the future demo refit (#44).

We could deduplicate by symlinking, but that breaks Windows checkouts and the build script. We could put the canonical bundles under `demo/assets/` to share assets, but that mixes "runtime contract" with "demo scaffolding" and they have different lifecycles.

**Decision:** keep them duplicated. ~1.4 MB total for 309 PNGs in the canonical bundles is small enough that the duplication cost is acceptable; the conceptual cleanliness of "canonical bundles are their own thing under `themes/`" pays for itself in clarity. When #44 (demo refit) lands, the demo will switch to consuming `themes/<slug>/` and `demo/assets/themes/` can be deleted in the same PR.

**Application:** treat `themes/<slug>/` as the source of truth for any Phase 4 runtime work. `demo/assets/themes/` is a soon-to-be-removed legacy fixture; don't add new code that consumes it.

### 2026-05-17 — `.gitattributes` keeps PNG bundle assets binary-safe

Caught preemptively before the first cross-OS contributor hit it: without an explicit `*.png binary` rule, git's CRLF normalization on Windows checkouts can corrupt PNG files in unpredictable ways (depending on the exact byte sequence inside the IDAT chunk). Added `*.png binary` to `.gitattributes` along with `themes/**/*.json text eol=lf` to lock JSON line endings too.

**Application:** when adding a new binary asset type to a bundle (sounds, fonts, archive sidecars), add it to `.gitattributes` in the same commit. The cost of forgetting is silent corruption that surfaces months later when a Windows user opens an issue.

---

### 2026-05-17 — Asset-URL absolutization is a loadTheme concern, not a renderer concern

Shipping [#38](https://github.com/khawkins98/aaron-ui/issues/38) (Phase 4.4, `loadTheme()` core), we had to decide *where* relative bundle paths (`cicns/cicn-n14335-active-document-window.png`) become absolute URLs that browsers can fetch (`http://localhost:5173/themes/masswerk-7-le/cicns/cicn-n14335-active-document-window.png`). Three layers could plausibly own it:

1. **Renderer** — each Phase 4.6/4.7/4.8 ticket re-derives the bundle URL and resolves on demand
2. **ThemeRegistry** — the singleton resolves on `replace()`
3. **loadTheme** — resolves once, before handing off to the registry

We picked **3 (loadTheme)** and made `resolveAssetUrls()` a pure exported function. Reasons:

- **Single concern.** The bundle URL is loadTheme's input parameter; nobody else has it. Forcing renderers to track "the bundle URL of the currently-loaded theme" creates a hidden coupling between layers that should not need to know each other.
- **Parsed Theme is the contract.** The `Theme` object handed to renderers should describe a *loaded* bundle in absolute terms — the same way a parsed `<img>` resolves `src` against the document base before exposing `.currentSrc`. Renderers downstream of loadTheme just consume URLs as strings.
- **Testability.** `resolveAssetUrls` is pure: `(theme, themeJsonUrl) → theme`. Easy to unit-test all the edge cases (paths that escape the bundle root, already-absolute URLs, missing optional sections).
- **Theme swap correctness.** When ThemeRegistry replaces theme A with theme B, the absolute URLs in B don't accidentally still point at A's bundle root — because B's URLs were resolved against B's bundle URL at fetch time, not against some stored "current bundle URL" on the registry.

**Application:** for Phase 4.6/4.7/4.8 renderers, treat `chromeElements[*].asset` / `patterns[*].asset` / `windowTypes[*].chrome.*` as *opaque absolute URL strings*. Never try to derive them from the bundle URL — that's loadTheme's job. If a future feature needs the bundle root (e.g., a "reload this theme" button), expose it via `ThemeRegistry.currentBundleUrl()` or add it to the parsed Theme as a sealed field. Don't make renderers reach for `document.baseURI` or guess.

### 2026-05-17 — `ThemeRegistry.reset()` must drop listeners *before* the final `replace(null)`

Subtle bug caught by a unit test. The first draft of `reset()`:

```ts
reset(): void {
  this.replace(null);     // ← calls listeners with null
  this.#listeners.clear();
}
```

This calls all subscribed listeners with `null` *as part of the test cleanup*. If a listener has stale references or fires assertions when the registry resets, the cleanup itself becomes a test failure. The fix:

```ts
reset(): void {
  this.#listeners.clear();   // drop subscribers first
  this.replace(null);        // then clear state — fires DOM event but no listeners left
}
```

The DOM event still fires (any listeners attached via `document.addEventListener` get the `theme: null` event), but the internal subscribe-API listeners are gone. Test setup is symmetric: `beforeEach(() => themeRegistry.reset())` works as the natural "clean slate" hook.

**Application:** in any future singleton with both an event-dispatch path and a subscribe-API path, the `reset()` method should clear the subscribe-API path *first*, then perform the state teardown. The two paths have different test lifecycles and shouldn't intermix.

### 2026-05-17 — Vite dev needs a tiny middleware to serve repo-root `themes/` at `/themes/`

The dev server has `root: 'demo'`, so by default `/themes/` resolves to nothing. The canonical bundles live at `<repoRoot>/themes/`, and Phase 4 runtime fetches them by absolute URL (`/themes/masswerk-7-le/`). We needed Vite to serve the parent dir's `themes/` under that URL prefix.

Options surveyed:

- **`publicDir: '../themes'`** — would serve files as `/masswerk-7-le/...`, not `/themes/masswerk-7-le/...`. Wrong URL shape.
- **`server.fs.allow: ['..']` alone** — allows file imports across the boundary (needed for `<script src="../src/index.ts">` in demo fixtures), but doesn't expose static files at arbitrary URL paths.
- **vite-plugin-static-copy** — would work but adds a dependency for ~15 lines of logic.
- **Inline plugin with `configureServer`** — what we shipped. ~15 lines: intercept any URL starting with `/themes/`, resolve to the repo-root file, stream it. No dep.

**Application:** for the production demo build (`vite.demo.config.js` → `dist/demo/`), `themes/` needs to be copied into the output via the existing `scripts/copy-demo-assets.mjs` pattern (next time we deploy gh-pages with a Phase 4 demo). Don't assume the dev middleware suffices — production-build assets are static-served from the dist root, not from a Node middleware.

---

### 2026-05-17 — Inline styles beat constructable stylesheets for per-element chrome (in #40, at least)

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends" (cinf-driven `border-image` 9-slice chrome). The inline-vs-stylesheet call may still inform other CSS work, but the 9-slice rendering it describes is gone.

The runtime rendering architecture spec (`docs/runtime-rendering-architecture.md` §5.1) prescribes a three-layer CSS cascade: engine baseline (static), theme-generated (constructable stylesheet, rebuilt per theme), per-window inline. Shipping [#40](https://github.com/khawkins98/aaron-ui/issues/40) (cinf-driven 9-slice), I had to decide where the cinf-derived `border-image` rules go: theme-generated stylesheet (one rule per chromeElement slug, targeted via `[data-aaron-cicn=<slug>]`) or per-element inline style.

**Picked inline.** Reasons:

- **Per-element chrome IS per-element.** A cicn URL is specific to one chromeElement entry; a window has dozens of chromed sub-regions (titlebar, body frame, growbox, every control inside). Generating "shared" rules to be `var(--aaron-cicn-url)`-driven from inline custom properties is one layer of indirection, but the cicn URL still has to live as a per-element inline anyway — so the indirection saves nothing in DOM bytes.
- **Constructable stylesheets shine when many elements share one rule.** For per-window chrome, the "many elements" assumption doesn't hold: each window has its own per-state cicns, each control has its own per-state cicns. The 1:1 mapping defeats the stylesheet-sharing benefit.
- **Debuggability.** Inline styles show up directly in DevTools' Computed → Inline rules. Stylesheet rules show up in the Sources panel under a generated `<style>` element. For chrome-rendering bugs, "click the broken element, see what got applied" is dramatically easier with inline.
- **No stylesheet lifecycle management.** With inline, theme swap is just "re-apply" or "clear" per element. With stylesheets, you have to invalidate the old stylesheet (or maintain a per-theme stylesheet keyed map), risk leaving zombie rules around, etc.

**When constructable stylesheets WILL win:** the *engine-baseline* CSS — the rules that don't change per theme (window mount/unmount transitions, focus-trap visuals, scrollbar layout boilerplate). That's static and can be a single adopted stylesheet attached once at library init. Different concern, different decision.

**Application:** Phase 4.7 (#41 ppat overlay) and Phase 4.8 (#42 wnd# parts) should follow the same "inline-style first" rule. If a future profiling pass shows the inline-style approach is slow at 100+ windows, *then* hoist common rules into a generated stylesheet — but don't optimize prophylactically.

### 2026-05-17 — jsdom's CSSOM rejects backslash-escaped quotes in `url()`

Caught while testing asset-URL escape behavior. A CSS-valid `background-image: url("path/odd \"name\".png")` (backslash-escaped internal quotes) is rejected by jsdom's CSSOM parser — `el.style.backgroundImage` returns the empty string after the assignment. Real browsers (Chrome, Firefox, Safari) accept it fine.

**Workaround:** the escape-correctness assertion was moved from a DOM round-trip test (`applyChromeElement` writes to `el.style`, test reads it back) to a pure-text test against `chromeElementCss` (no DOM, just generated CSS string). The text assertion is the more meaningful one anyway — escape correctness is a property of the generated string, not of how jsdom parses it back.

**Application:** when a CSS feature works in real browsers but jsdom can't roundtrip it, prefer testing the *output text* (via a pure generator) over the *DOM-after-assignment* state. The pure test catches the same bugs without depending on jsdom's CSSOM faithfulness. Add a Playwright e2e test if real-browser confirmation matters.

### 2026-05-17 — `border-image-slice: <N> fill` is mutually exclusive with a separate ppat body fill

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends" (CSS `border-image` chrome). We own the pixels now; `border-image-slice` is no longer the chrome mechanism.

Shipping [#41](https://github.com/khawkins98/aaron-ui/issues/41) (ppat overlay), the CSS for "9-slice chrome with a body pattern" turned out to require dropping the `fill` keyword from `border-image-slice`. The reasoning:

- `border-image-slice: <N> fill` tells the browser to *include* the source image's middle region in the border-image rendering — i.e., the cicn middle draws as part of the border-image, covering the box's content area.
- `background-image` is rendered *behind* the border-image's content area when `fill` is set. The browser renders `background-image` first, then `border-image` (including the filled middle) on top.

So if we set `background-image: url(ppat)` and `border-image-slice: 8 fill`, the cicn middle (drawn by the border-image) covers the ppat tile. The user sees the cicn middle, not the ppat. Wrong outcome.

The fix: when bgPattern is present, drop `fill`. The border-image then draws only corners + edges (4 slices, no middle); the cicn body region is *not* drawn. The ppat tile (via `background-image`) fills the box content area instead. This is what the architecture doc §6 was getting at without spelling it out.

```css
/* No bgPattern: cicn fills everything */
border-image-slice: 8 fill;
background-image: url(cicn.png);   /* fallback, hidden by fill */

/* With bgPattern: ppat fills the middle */
border-image-slice: 8;             /* no fill */
background-image: url(ppat.png);   /* shows through */
background-repeat: repeat;
```

**Application:** any future renderer that combines `border-image` with a separate body fill must drop `fill`. If we later want both the cicn middle AND a ppat overlay (e.g., for translucent overlays), that needs a child overlay element — CSS doesn't compose border-image-fill with background-image on the same element.

### 2026-05-17 — Canonical bundles don't yet carry bgPattern; #41 ships the mechanism ahead of the data

Both shipped scheme bundles (mass:werk 7 Le + Dark ErgoBox 2) have `cinf.bgPatternId === 0` for every extracted cinf — no chromeElement currently references a ppat overlay. The ppat-overlay rendering still ships in #41 because:

- The mechanism is small (~40 lines in `applyChromeElement`).
- The architecture spec calls for it explicitly (§6 composition layers).
- We've already documented in earlier LEARNINGS (2026-05-16 "Chrome cicns alone don't reproduce a theme's full aesthetic") that ErgoBox's gray window body really is supposed to be a ppat overlay — but the extractor's path to *encoding* that hasn't been built yet (it needs Colr decoding plus a window-type→bodyPattern mapping, neither of which is in #36).

So #41 is "renderer-side ready, encoder-side TBD." The unit tests cover the rendering paths against synthetic Themes; once Colr decoding lands and ErgoBox's bundle includes the bgPatternId, no #41 work needs to be revisited.

**Application:** when a future ticket adds Colr decoding or extends the extractor's bgPatternId resolution, no changes to `applyChromeElement` should be needed. The visible-rendering payoff (ErgoBox body actually renders gray) happens at that ticket's PR, not this one's.

---

### 2026-05-17 — gh-pages cut-through: the landing page lied about the project state for ~4 PRs

First cut-through pass under the new CONTRIBUTING.md §"Periodic documentation cut-throughs" section. Caught three categories of drift in `demo/index.html`:

1. **Architectural claims that the pivot invalidated.** The lede said "ships Platinum as the default" — false since the 2026-05-17 Kaleidoscope-runtime pivot (we ship mass:werk 7 Le, not a hand-authored Platinum). Same paragraph said "Pre-implementation. Phase 1 (WM core) just shipped" — wrong tense, Phase 4 has shipped half its tickets since.
2. **Card descriptions that referenced dropped phases.** `platinum-static.html`'s card called itself "Pure-CSS reference for Phase 2." Phase 2 was dropped; the file is now historical context.
3. **Numbers that always go stale.** "140 unit tests + 30 e2e tests, all green" was true on the day Phase 1 shipped. Reframed as "stats live in README; CI status on Actions" — a link that stays current automatically.

**Bigger discovery: the gh-pages build was missing the Phase 4 runtime fixture entirely.** `demo/theme-loader-fixture.html` (added for #38's e2e) wasn't in `vite.demo.config.js`'s input list, so it never made it into `dist/demo/` for the gh-pages deploy. Same for the canonical `themes/<slug>/` bundles — they were only served by the dev-only Vite middleware, never copied into the production demo. Both gaps would have surfaced as 404s for anyone clicking through the deployed demo.

**Fix:**
- Added `theme-loader-fixture` to `vite.demo.config.js` inputs
- Added `themes/` subdir copy to `scripts/copy-demo-assets.mjs` so loader fixtures find their bundles at gh-pages
- Switched the fixture's `loadTheme()` paths from absolute (`/themes/...`) to relative (`themes/...`) so the same fixture works under Vite dev root (`/`) AND gh-pages base (`/aaron-ui/`)

**Application:**

- **Audit gh-pages every time a new fixture or asset path lands.** The deploy is a separate codepath from CI tests; "all green locally" and "works on gh-pages" are not the same assertion. A test passes against `localhost:5173/...`; gh-pages serves at `khawkins98.github.io/aaron-ui/...`. Anything absolute breaks; anything not in the build inputs gets silently dropped.
- **Prefer relative URLs in deployable artifacts.** Absolute paths in HTML or JS break under any non-root base path. The exception is when the consumer of the lib will own their own deploy — `loadTheme('/themes/foo/')` is fine in their app code, but our deploy fixtures should be relative.
- **The cut-through cadence works.** This pass took ~20 minutes and surfaced both a stale lede and a missing deploy entry — neither of which any CI check could have caught. The "every phase milestone close, or after a pivot, or on any 'wait, that's not right' moment" rule from CONTRIBUTING.md earned its keep on its first invocation.

---

### 2026-05-17 — wnd# part rects convert to percent-positioned overlays for free-resize chrome

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". wnd# part rects are hit-test metadata, not render geometry; chrome is composed via the part-code recipe walk, not percent-positioned overlays over a stretched `border-image`.

Shipping [#42](https://github.com/khawkins98/aaron-ui/issues/42) (wnd#-driven hit targets). The rendering model from the architecture spec — "part rects expressed as percentage of the titlebar" — turned out to be near-trivial in practice once cinf 9-slice is already in place. Math:

- Chrome cicn is rendered via `border-image`, which stretches the source bitmap to the box dimensions
- A part rect `[left, top, right, bottom]` in chrome-cicn pixel coordinates becomes `(left/cicnWidth, top/cicnHeight, …)` percentages
- Those percentages, applied as `style.left/top/width/height`, position the overlay correctly *at any rendered size* because both the cicn (via border-image) and the overlay percentages reflow proportionally

The clean version: caller supplies the chrome cicn's native dimensions; helper writes percent-positioned divs. ~150 lines including options + clear + pure-CSS-text variant. No `requestAnimationFrame` throttle needed for normal resize because CSS handles it natively.

**The exception flagged in the architecture spec** — fixed-aspect chrome (ErgoBox's projecting tab) where the cicn shouldn't stretch — still needs JS-driven recomputation per resize. That's not in #42; it's a future ticket once a real fixed-aspect scheme is being demo'd.

**Application:** the percent-positioning pattern works for any wnd#-derived overlay (parts, edge insets, growbox hit area). When a future feature needs "absolute position inside chrome cicn coordinates," use the same `pct = (coord / cicnDimension) * 100` formula. Don't be tempted to compute absolute pixels — those don't survive resize without JS.

### 2026-05-17 — jsdom strips trailing zeros from CSS percentage strings ("20.0000%" → "20%")

Same kind of jsdom CSSOM normalization gotcha we've seen twice already (URL escapes #40, comma-separated multi-layer backgrounds #41). When `el.style.left = "20.0000%"` and you read it back, jsdom returns `"20%"`. Real browsers preserve the original string.

**Two fixes layered together this time:**

1. **`pct()` helper strips trailing zeros at write time** via `Number(value.toFixed(4))` so the emitted CSS is compact and matches jsdom's normalized read-back. (Also nicer for DevTools: `left: 20%` vs `left: 20.000000%`.)
2. **Tests parse percentage strings into numbers** via a `parsePct()` helper and assert numerical equality (or `toBeCloseTo`) instead of string equality. Robust against future jsdom-or-browser quirks.

**Application:** any future helper that emits CSS numeric values via `toFixed(N)` should pipe through `Number(...)` to strip trailing zeros. Tests that need to compare CSS values across helpers (e.g., "applyX writes what Xcss returns") should parse to numbers, not assert string equality. The `apply*` + `*Css` pure-helper pattern is now battle-tested across #40, #41, #42.

---

### 2026-05-17 — The runtime trio composes — `applyChromeFromTheme` is the seam

Shipping [#43](https://github.com/khawkins98/aaron-ui/issues/43) (runtime theme switching) earned the prior tier's value: the four renderer primitives from #38 / #40 / #41 / #42 compose into a single per-window applier with ~60 lines of glue. The architecture-doc spec predicted this shape (§8 WM↔runtime seam) but it's worth recording that the prediction held — composition was easy, no per-primitive escape hatches needed.

The seam pattern:

```
applyChromeFromTheme(windowEl, theme, opts?)
  ├─ resolveWindowType(theme, opts?.windowTypeSlug)   // pick the windowType entry
  ├─ deriveStateFromDom(windowEl, chrome)             // active/inactive/collapsed
  ├─ findChromeElementByAsset(theme, cicnUrl)         // get cinf + bgPattern metadata
  ├─ applyChromeElement(titlebar, chromeEntry, {theme})  // #40 + #41 baked in
  └─ applyWindowParts(titlebar, windowType, {chromeWidth, chromeHeight, aria}) // #42
```

The function is ~100 lines including JSDoc and error cases. It doesn't import AaronWindow — it takes a DOM element and uses the `.aaron-titlebar` selector contract. That keeps the WM core fully un-coupled from theme code, which was the architecture spec's main design directive.

**Application:** for any future per-window concern that crosses the WM↔runtime seam (theme swap, control state machinery, animation transitions), follow the same pattern: take an `HTMLElement`, use class-selector contracts, return a result + accept options. Don't import AaronWindow. The seam survives only if every helper respects it.

### 2026-05-17 — `attachThemeToWindow` swallows applyChromeFromTheme errors by design

The integration helper `attachThemeToWindow(windowEl, opts?)` wraps `applyChromeFromTheme` in a try/catch that, on failure, calls `clearChromeFromTheme(windowEl)` instead of letting the error propagate. Subjective call, recorded here so the choice doesn't get accidentally reverted:

**Why swallow:** the subscription is asynchronous and runs across many windows. A theme that defines `chromeElements` but no `windowTypes` (or one whose windowType slug doesn't match) shouldn't crash the entire subscription chain — that would leave other windows un-styled too. The graceful degradation: this window goes un-themed (engine-baseline CSS) until the next theme change.

**When this hides bugs:** consumer typos in `windowTypeSlug` (e.g., `'documnet-window'`) silently disable theming for the affected windows. The escape hatch is calling `applyChromeFromTheme` directly — it throws loudly on the same conditions.

**Application:** keep error-swallowing only at the subscription boundary. Lower-level functions (`applyChromeFromTheme`, `applyChromeElement`, `applyWindowParts`) all throw on invalid input. Consumers who want strict behaviour skip `attachThemeToWindow` and wire their own subscription.

### 2026-05-17 — MutationObserver tests must clean up observers across tests

`enableThemeSwitching()` returns a teardown function for its `MutationObserver`. The first cut of the unit tests forgot to call this teardown between tests — each test installed its own observer, but observers from prior tests were still active and fired on later attribute mutations. Result: a test asserting "fetch was not called" failed because a prior test's observer triggered an unintended load.

**Fix:** test-file-scoped `disables: Array<() => void>` array, with a `enable(opts)` wrapper that pushes the returned teardown. `afterEach` pops and invokes every teardown.

**Application:** any helper that returns a teardown function needs a similar pattern in its tests. Without explicit cleanup, observers / event listeners / interval timers leak across the test suite and cause flaky cross-test interference. The wrapper-over-the-real-function pattern keeps test bodies readable without forgetting cleanup.

### 2026-05-17 — gh-pages now shows visible runtime chrome, not just buttons

Folded a visible runtime demo into #43 rather than waiting for #44 (demo refit). The new `theme-switcher-fixture.html` mounts a real `AaronWindow`, subscribes it to the theme registry via `attachThemeToWindow`, and provides swap buttons. The window's chrome — cicn 9-slice border-image + ppat overlay (none for these schemes today) + wnd# part overlays — visibly changes between 7 Le and ErgoBox 2.

Before this PR, gh-pages had `theme-loader-fixture.html` (just buttons + palette assertions) but no page actually *rendered* a chromed window using the new runtime. Anyone visiting the deployed demo would have seen Phase 1 fixtures + the legacy raster demo, with no indication that Phase 4 had landed at all.

**Application:** for any future tier that produces a visible UX change, ship a minimal visible-demo fixture in the same PR. Don't defer visible demonstration to a "demo refit" ticket — by the time that lands, multiple weeks may have passed where the deployed demo misrepresented the project. The CONTRIBUTING.md cut-through cadence catches this *after the fact*; in-PR fixtures catch it *as the work ships*.

---

### 2026-05-17 — Bundled-default: ship-assets-separately + side-effect-on-import won the architectural call

Shipping [#39](https://github.com/khawkins98/aaron-ui/issues/39) (Phase 4.5, bundled-default 7 Le auto-load). The ticket's original AC was strict ("no network request fires for the default theme"), which would have required inlining ~564 KB of PNG data as base64 in the JS bundle. Three viable approaches:

1. **Inline PNGs + theme.json into the JS bundle as base64.** Truly zero-network. Cost: bundle gzip jumps past PRD §Success criteria #5's "≤30 KB gzipped" target by an order of magnitude.
2. **Ship theme.json + PNGs as separate files in the npm package; consumer hosts them.** One-time deploy step. Bundle stays tiny. Cost: not truly zero-network — assets stream as the chrome references them.
3. **Lazy fetch from CDN on first use.** Truly minimal bundle. Cost: tight coupling to a CDN we don't own; offline use broken.

**We picked (2).** Reasons:

- Bundle size constraint is a real PRD commitment. Blowing past 30 KB gz for a "convenience" feature is the wrong tradeoff.
- Most consumer bundlers (Vite, esbuild, webpack with their default copy plugins) automatically resolve `import.meta.url`-anchored paths and emit referenced files in dist. The "one-time deploy step" is usually zero steps in practice.
- Asset streaming is fine for the chrome use case: the WM can mount before chrome is fully painted, and the per-window theme application picks up the cicns as they arrive.
- The fallback story is honest: `setBundledDefaultUrl()` lets consumers point at any hosting they want (CDN, S3, GitHub Pages, internal Artifactory).

**Auto-load mechanism:** the main entry (`./index.ts`) calls `enableBundledDefault()` as a side-effect at import time. This schedules `loadBundledDefault()` to fire on `DOMContentLoaded`. The opt-out sub-entry (`./no-default.ts`) re-exports the same API *without* the side-effect call. Consumers who want full control of theme loading import from there.

**Why side-effect on import (controversial):**

- Library imports having side effects is generally a smell — they make tree-shaking unpredictable and surprise consumers.
- Here, the side-effect IS the feature: "drop in `import 'aaron-ui'` and get a themed window." Without auto-load, the consumer has to wire up `loadTheme()` themselves, which contradicts the "drop-in" UX promise.
- The opt-out sub-entry is a first-class peer (not an afterthought), so consumers who dislike side-effect imports have a clear documented path.
- The auto-load is fire-and-forget on a `DOMContentLoaded` listener — it doesn't block module evaluation, doesn't throw if it fails (warns to console), and skips entirely if a theme is already loaded.

**Bundle output:** Vite library mode with dual entry produces:
- `dist/aaron-ui.js` (1.5 KB raw) — thin side-effect wrapper
- `dist/no-default.js` (44 KB raw / 12 KB gzip) — the bulk of the code

Consumers of either entry pull in the same shared chunk; the gzipped delta is negligible. PRD's "≤30 KB gz" target satisfied with headroom.

### 2026-05-17 — Past-DCL auto-load needs a microtask defer for consumer-init ordering

Subtle case in `enableBundledDefault()`. When library import happens AFTER `DOMContentLoaded` (e.g., dynamic import, late-injected script tag, test fixtures with `readyState === 'complete'`), there's no DOMContentLoaded event to fire — the auto-load would happen on the next tick.

If we fire *synchronously* from `enableBundledDefault()`, the consumer can't intercept:

```js
// Won't work — auto-load fires before this line runs
import { setBundledDefaultUrl } from 'aaron-ui';
setBundledDefaultUrl('/custom/');
```

If we fire via `queueMicrotask`, the consumer's synchronous code runs first:

```js
// Works — setBundledDefaultUrl runs in the same sync chunk; auto-load
// fires in the next microtask and sees the updated URL.
import { setBundledDefaultUrl } from 'aaron-ui';
setBundledDefaultUrl('/custom/');
```

The microtask defer is the difference between "auto-load is configurable" and "auto-load fights the consumer." Trivial code change, important behavior.

**Application:** any side-effect that runs at import time should defer at least one microtask to give the consumer's sync code a chance to configure before it fires. Document the timing window so consumers know what's safe (sync calls work; async calls before DCL also work; async calls after DCL race with the auto-load).

---

### 2026-05-17 — Auto-load on import races with fixtures that assert "first event"

Hit this immediately after shipping #39 (bundled-default auto-load): the `theme-loader-fixture.html` e2e test "dispatches aaron:themechange on document" started flaking under parallel Playwright load. The test pattern was:

```js
await page.goto('/theme-loader-fixture.html');
await page.evaluate(() => {
  window.__themeChanges = [];
  document.addEventListener('aaron:themechange', (e) => {
    window.__themeChanges.push((e as CustomEvent).detail.theme?.name ?? null);
  });
});
await page.locator('#load-7le').click();
// expects __themeChanges === ['mass:werk 7 Le']
```

Pre-#39 this was deterministic — the page imported `aaron-ui` and idled until the click. Post-#39, `aaron-ui` auto-loads the bundled default on DOMContentLoaded. Under parallel 5-worker load with slower page settles, the auto-load sometimes fires BEFORE the listener install, sometimes AFTER. When AFTER, `__themeChanges` has two entries (`'mass:werk 7 Le'` from auto-load + `'mass:werk 7 Le'` from the click), and the strict equality fails.

**Fix:** the fixture switched to `import { loadTheme } from '../src/no-default.ts'`. The fixture's purpose is testing `loadTheme` in isolation; the bundled-default auto-load is a separate concern with its own dedicated fixture (`auto-default-fixture.html` from #39).

**Application:** any fixture whose tests assert specific event sequences should use the `no-default` sub-entry. Tests that assert "the bundled default loads" should use the default entry. Mix them and the auto-load WILL race with assertions. The two-entry pattern from #39 isn't just for end-users; it's testing infrastructure too.

### 2026-05-17 — Landing demo: real windows + provenance + per-scheme thumbnail = the whole product story on one page

Shipping [#44](https://github.com/khawkins98/aaron-ui/issues/44) (Phase 4.10, landing demo refit). The pre-#44 landing page was a card directory: dark page with links to fixtures. The new landing page IS the product: four `AaronWindow` instances on a desktop, themed by the bundled mass:werk 7 Le at first paint, with a `<select>` to swap to ErgoBox 2.

Three design choices worth recording:

1. **The page body picks up `--aaron-colr-*` palette colors.** When the bundled-default theme loads, the topbar background changes to match the scheme's `titlebar-active-bg`. The whole page tints itself with the loaded scheme. Cheap visual win that makes the auto-load feel intentional rather than incidental.
2. **The provenance bar names the original author and license verbatim.** This is the *clean-room boundary* made human-visible: every visitor sees that this scheme is freeware from Norbert Landsteiner at mass:werk. The corpus's legitimacy is part of the demo, not buried in a `LICENSE` file.
3. **Side-by-side "original preview vs. live render" is one of the four windows.** Visitors can immediately judge fidelity: if our render diverges from the scheme's own preview, you see the difference at first glance. Beats text claims of "pixel-faithful."

**Application:** for any future visible-tier ticket, ask "what's the single page that tells the whole story?" not "what fixture demonstrates this feature?" The fixtures live on for dev/test use, but the landing page should be the product, not a sitemap of dev tooling. The CONTRIBUTING.md cut-through discipline catches drift; making the *first* page actively demonstrate the value prop catches the bigger failure mode.

---

### 2026-05-17 — Visible chrome bug: window-type cicns have no cinf, so applyChromeElement painted them at native size

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". The `background-size: 100% 100%` stretch fix described here is exactly the stretching the kDEF doesn't do (it tiles); the compositor now sizes from the drawable extent and walks the part-code recipe.

Visual cut-through from gh-pages after the Phase 4 close caught a real rendering bug: chrome titlebars rendered as small ~74×25 tabs in the top-left of each window instead of stretching to fill. Diagnosed via the canonical bundle:

```
Document window chrome states (theme.json):
  active:  cicns/cicn-n14335-active-document-window.png  (74×25 native)
  inactive: ...
Matching chromeElements: slice=None for all four states
```

Root cause: the extractor pairs `cinf` only with **control-level** cicns (buttons, scrollbars, etc.). Window-type chrome cicns get a `chromeElements` entry with `width` + `height` but **no `slice`**. With no slice, `applyChromeElement` falls through to the static-bitmap branch, which respects `entry.width`/`height` as `background-size`. Combined with `background-repeat: no-repeat`, the cicn rendered at its native 74×25 in the top-left corner of titlebars that were 400+ pixels wide. Hence "small tab at top-left."

Fix landed in `applyChromeFromTheme`: for chrome entries without `slice`, omit `width`/`height` before passing to `applyChromeElement`, then explicitly set `background-size: 100% 100%` after. The cicn stretches to fill the titlebar width; `image-rendering: pixelated` on the titlebar CSS keeps the stretch crisp-ish.

**The deeper missing piece:** Kaleidoscope schemes carry per-side rendering recipes in `wnd#` (top/bottom/left/right edges as `(part, position)` lists describing which pixels to stamp where). Aaron UI's runtime doesn't honor those yet — we render the chrome cicn as a single stretched background, which works for the titlebar but doesn't give the scheme's actual side/bottom window borders. Tracked as a future polish ticket.

**Application:** when the runtime renders a Kaleidoscope concept, ask "what does the scheme provide vs. what does Aaron UI need to synthesize?" The chromeElement→cinf pairing handles control-level chrome; window-type chrome needs `wnd#`-aware composition for full fidelity. The two paths shouldn't share assumptions about whether `slice` data is present.

### 2026-05-17 — Run visual cut-throughs on gh-pages after every visible-tier ship

Second time this session that visual feedback from the deployed demo caught a real bug invisible to CI. First time (#54): missing fixture + bundle assets in dist. This time: rendering bug that all unit + e2e tests passed but the user immediately spotted on the live page.

**Pattern:** unit tests assert *that values are set*; e2e tests assert *that elements exist*. Neither asserts *that the rendered output looks right*. Visual regression tools (Percy, Chromatic, Playwright snapshots) can close part of the gap, but the human "does this look like a Mac OS window?" judgment is the real check.

**Application:** for any phase that ends with visible UX, add a "visual cut-through" step to the close-out checklist: deploy to gh-pages, open the live URL, screenshot the result, compare against intent. The CONTRIBUTING.md "Periodic documentation cut-throughs" section should add a sister entry on visual cut-throughs (next time someone touches CONTRIBUTING). For now the discipline lives in this LEARNINGS entry.

---

### 2026-05-17 — Polish round 2: glyph crispness via the cicn-slice trick + 1px scheme-derived window border

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". Parts no longer render as percent-positioned overlays sliced from a stretched titlebar; widgets ride the fixed recipe cells they sit in.

After the first polish PR fixed the titlebar full-width stretch, the next visible problem was: close/zoom/windowshade controls inside the titlebar were also stretching with the background, distorting them into elongated smudges.

**Fix:** parts now render as **crisp slices of the cicn at native pixel size**, positioned at the part's rect's percentage location within the titlebar. The implementation:

```ts
el.style.left = pct(rect.left, cicnWidth);
el.style.top = pct(rect.top, cicnHeight);
el.style.width = `${rectWidth}px`;     // native px, not %
el.style.height = `${rectHeight}px`;
el.style.backgroundImage = `url("${cicnUrl}")`;
el.style.backgroundPosition = `-${rect.left}px -${rect.top}px`;
el.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;
```

The background-position negative offset is the trick: it shifts the cicn so that `(rect.left, rect.top)` of the cicn appears at `(0, 0)` of the overlay div. The overlay's native size (rectWidth × rectHeight) clips to just the part's region. Result: close box always renders 11×11 px at 12.16% from left, regardless of titlebar width. No stretching, no smudging.

**The deeper lesson:** when stretching the background image distorts what should be crisp, slice it out at native size and re-overlay. Same idea as CSS sprites. The cicn already contains the crisp glyph; the trick is showing only that region at native scale.

### 2026-05-17 — Scheme-derived 1px window border via cicn outer pixels

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". The 1px `border-image` frame approximation is gone; the frame comes from the drawable extent + the side recipes.

For the "no themed borders" feedback: applied the chrome cicn as a 1px-slice border-image on the window root. The cicn's outermost edge pixels become the window's borders — gray for 7 Le, near-black for ErgoBox. Implementation in `applyChromeFromTheme`:

```ts
windowEl.style.borderImageSource = cssUrl(cicnUrl);
windowEl.style.borderImageSlice = '1';
windowEl.style.borderImageWidth = '1';
windowEl.style.borderImageRepeat = 'stretch';
windowEl.style.borderStyle = 'solid';
windowEl.style.borderWidth = '1px';
windowEl.style.borderColor = 'transparent';
windowEl.style.boxSizing = 'border-box';
```

**What this is not:** full `wnd#` side-recipe composition. A real scheme-correct border would parse `wnd#`'s `topSide` / `bottomSide` / `leftSide` / `rightSide` recipes — sequences of `(part, position)` pairs that describe which cicn regions to stamp at which pixel offsets along each edge. That's much bigger work (probably a canvas-based compositor, or multi-layered absolute-positioned divs per region). The 1px approach is a useful approximation: every window gets a scheme-derived thin frame that visually unifies the chrome, without the architecture investment.

**Known limitation introduced by this round:** title text now overlaps with the crisp control glyphs because the demo's `.aaron-titlebar__title` uses `inset: 0` (covers full titlebar) and the controls render at their wnd#-specified rect positions. Real schemes carry "title pill" geometry as a separate concept (or implicit in the cicn art) — needs scheme-data extension. Documented for future polish.

---

### 2026-05-17 — wnd# composer V2 ships: named parts at native size, part 8 as fill

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". Recipe entries are not per-segment paint commands, association is end-based (not the "named vs fill, part-8 = fill" model here), and cells are classified by the 2.3.1 part-code jump table.

After PR #66's research and PR #67's canonical spec roll-up, V2 of the wnd# composer ([#64.1](https://github.com/khawkins98/aaron-ui/issues/64)) is now in place. Distinguishes:

- **Named parts** (in rectangleList): render the rect at native pixel size, positioned at the recipe's `at` coordinate. Close box, zoom box, windowshade, divider stay crisp regardless of titlebar width.
- **Part 8** (universal stretchable fill code from research): tile cicn pixels at the segment's x-range across the segment's rendered width. Preserves pinstripe rhythm.
- **Other unknown codes** (5, 6, 10, 11, 15, 17): treat as fill (same as part 8). Best-guess fallback; refinement is per-code polish.

The V1 attempt (PR #65, reverted) failed because it treated all parts as fills — including the rectangleList parts (close, zoom, etc.). That stretched the control glyphs into smears and produced visible fragmentation between segments. V2 fixes it by using rectList membership to distinguish "discrete visual element" (named) from "fill region" (everything else).

**Visual result** (verified via `browse` against `localhost:5173`): named control glyphs render crisp at scheme-relative positions; fills tile the cicn's pinstripe between them. Much closer to Kaleidoscope's actual rendering than uniform stretch (PR #62) or the V1 attempt (PR #65 findings).

**Remaining gaps** (tracked as sub-tickets):
- Title-pill positioning (#64.2) — title text still overlaps with named parts in the center of the titlebar
- Bottom/left/right side composition (#64.3) — still CSS placeholder window borders
- Per-code refinement for parts 5, 6, 10, etc. — visual comparison against mass:werk reference thumbnails to determine if they need distinct rendering

**Application:** for any future wnd#-driven rendering, follow the same "named vs fill" distinction. The rectList membership is the discriminator. When schemes introduce new fill codes (which they likely do as we port more bundles), default behavior should be "treat as part-8 equivalent" until a specific visual difference forces refinement.

### 2026-05-17 — E2E tests checking element styles need to follow architecture changes

V2 moved the cicn background-image from `.aaron-titlebar` itself to child `[data-aaron-chrome-segment]` divs. Five e2e tests broke that were checking `titlebar.style.backgroundImage` directly. Fix: update selectors to `.aaron-titlebar [data-aaron-chrome-segment]`.

**Pattern observed:** every visible-tier architecture change (Phase 4 rendering rework, segment composer) breaks at least one selector-based e2e assertion. The tests are correct in WHAT they assert (the theme is loaded, the chrome is applied) but wrong in HOW they check (specific DOM element holds the style). Need to factor brittle selectors into shared helpers per fixture so the architecture-change updates are one-place edits, not five.

**Application:** when refactoring the renderer in future PRs, search the e2e suite for hard-coded `.aaron-titlebar` style assertions and update them at the same time. CI breakages from this pattern are predictable — anticipate and batch.

### 2026-05-17 — Push buttons are CSS-drawn, not cicn-rendered (Kaleidoscope didn't ship button artwork)

Started Phase 3.2 / #71 expecting to map push-button states to chromeElements slugs the way #3.1 wired the universal state machine. Inspection of both canonical bundles (mass:werk 7 Le: 119 entries, Dark ErgoBox 2: 159 entries) found **zero push-button cicn entries**.

This isn't an oversight in either scheme — it's faithful to how Mac OS Appearance Manager actually worked. The CDEF (Control DEFinition resource) drew push buttons; schemes themed the *surroundings* (titlebars, scrollbars, frames, dividers) and let buttons inherit the system rendering. Kaleidoscope schemes followed the same division.

**Architectural pivot:** controls split into two rendering paths:
- **cicn-rendered** (checkbox, radio, popup, slider, scrollbar arrows) — use `applyControlChrome` with a per-state chromeElements map
- **CSS-drawn** (push button, default button, group box, likely tabs for some schemes) — use the new `wireControlStateMachine` helper for state machine wiring only, and style via engine-baseline CSS tinted by `--aaron-colr-*` palette custom properties

The discriminator is "is the artwork present in canonical bundles?" — answer that *first* per per-control ticket, then choose the path. Don't assume cicn-rendered just because the spec listed a chromeElements mapping.

**Knock-on:** `applyControlChrome` was split — `wireControlStateMachine` (state machine only, no rendering) is the new primitive. `applyControlChrome` keeps wrapping it for cicn controls.

**Application:** when implementing the remaining control tickets (#72–#77), the first step is `grep "<slug>" themes/*/theme.json` to confirm artwork exists. If not, route through `wireControlStateMachine` + engine-baseline CSS. The decision belongs in §9 of the control architecture doc per control, with the empirical evidence cited.

---

### 2026-05-17 — Checkboxes + radios follow the CSS-drawn precedent too; native <input> stays in the tree

The discriminator from the #71 pivot worked: ran `jq -r '.chromeElements | keys[]' themes/*/theme.json | grep -iE 'check|radio'` before designing #72, found zero matches in either bundle. Mac OS CDEFs drew form controls; Kaleidoscope themed surroundings. Same rendering path as push buttons applied: CSS + palette tinting + engine baseline.

**Implementation detail worth keeping in mind:** the native `<input>` stays in the DOM tree, visually hidden via `opacity: 0` + `position: absolute` rather than `display: none` / `hidden`. The `hidden` attribute removes the input from the focus order and disables the change event in some edge cases. `display: none` similarly drops it out of the accessibility tree. Opacity-zero preserves all the native behaviour (`:checked`, `:focus-visible`, Space activation, form submission, screen reader announcement) while letting the sibling `<span class="aaron-checkbox__chrome">` paint the visible chrome. The chrome span gets `aria-hidden="true"` since the input is the a11y-meaningful element.

**Checked-glyph period detail:** rendered the classic Mac **X** mark (two crossed strokes via `::before` + `::after`), not the NeXT/OS X checkmark. Mac OS 7-9 used X. Don't reach for the unicode checkmark muscle memory.

**Cumulative count after #71 + #72:** push button, default button, checkbox, radio — four controls, all CSS-drawn. The pattern's confirmed; #73 (text fields) is likely the first cicn-rendered control since text-field bezels DO appear in `chromeElements` (`field-frame` variants in both bundles).

---

### 2026-05-17 — Prediction was wrong: text fields are CSS-drawn too. All of Phase 3 form controls might be.

In the #72 LEARNINGS I predicted text fields would be the first cicn-rendered Phase 3 control because both bundles ship `progress-bar-frame-*` slugs — surely they'd ship a field frame too. Wrong. Ran the discriminator before designing #73: `jq -r '.chromeElements | keys[]' themes/*/theme.json | grep -iE 'field|frame|input|text|edit'` — only matches were `progress-bar-frame-active/inactive` (progress bars, not fields) and `popup-menu-text-section` (the text half of popup menus). Zero `field` slugs.

Three Phase 3 controls now confirmed CSS-drawn: push button, checkbox, radio, text field. Updated mental model: Mac OS Appearance schemes themed *chrome* (titlebars, scrollbars, popups, sliders, progress bars, group box dividers, disclosure triangles, grow boxes) — the things with substantial pixel-art geometry. They did NOT theme the simple form widgets (button, checkbox, radio, edit text), which were tiny CDEF-drawn primitives the system handled. Aaron UI matches that split.

**Updated prediction for #74+:** popup-menu IS cicn-rendered (slugs confirmed: `popup-menu-text-section`, `pressed-popup-menu-text-section`, `inactive-popup-menu-text-section`, `inactive-large-popup-menu-arrow`). Sliders (`down-pointing-slider-thumbs`, `down-pointing-slider-track`, `horizontal-slider-tick`), scrollbars (`empty-horizontal-scrollbar`, `horizontal-thumb`, `horizontal-thumb-ghost`), and progress bars (`progress-bar-frame-*`) all confirmed cicn-rendered too. That's where `applyControlChrome` infrastructure (built in #70) finally gets a consumer — popup menu (#74) should be the first to exercise it.

**Implementation detail for text fields:** native `<input type="text">` / `<textarea>` stays in tree, NOT hidden — it's the only thing the user sees inside the wrapper, since the wrapper just paints the inset bezel border. Used `:focus-within` on the wrapper for the focus affordance + `outline` (not border-width change) so focus doesn't reflow surrounding layout. `readOnly` gets its own visual treatment (slight tint, normal cursor) distinct from `disabled`.

---

### 2026-05-17 — Title pill via CSS custom properties pinned by the renderer

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". The title plate is sized from the measured title width and grows the title region; the "widest coalesced fill run" heuristic over the wnd# top recipe is gone.

For #64.2 (title-pill positioning), the cleanest interface between the runtime renderer and the consumer's CSS turned out to be **two CSS custom properties** stamped on the titlebar element: `--aaron-title-pill-left` and `--aaron-title-pill-right`. The renderer computes them from the wnd# top recipe (widest coalesced fill-segment run); the consumer's CSS reads them via `var()` with sensible fallbacks.

**Why custom properties over inline `left:` / `right:` styles:** consumers retain full control over the title element's other styling (font, color, padding, focus treatment, etc.). The runtime contributes only the *constraint* — where the title is allowed to live. This matches the broader Aaron UI ethos that the runtime drives geometry, the consumer drives presentation.

**Algorithm choice:** widest *coalesced* fill run, not single widest fill. A run of consecutive non-named parts (e.g., part-8 then part-6 then part-5) should be treated as one zone since they're all fillable; only a named part actually breaks the zone. Without coalescing, the 7 Le pill would have picked a 3-pixel single-fill segment instead of the 10-pixel run.

**Known sharp edge:** the pill is computed in *cicn-pixel* space, not *titlebar-pixel* space. For schemes with narrow cicn widths (7 Le is 74px) and many named parts, the pill ends up small relative to typical title lengths, forcing ellipsization. A future refinement could recompute on resize in titlebar-pixel space, but the current implementation is strictly better than the prior "title overflows everything" state and ships without a ResizeObserver cost on every window. Document the limitation, ship, iterate from real consumer feedback.

---

### 2026-05-17 — Side composition: same algorithm as top, just with the axes (and the anchor) swapped

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". This extends the per-segment composer + bottom-strip inference heuristics that the part-code walk replaced.

For #64.3 I extended the V2 top composer to bottom/left/right. The structural decision worth recording: **don't generalize over directions prematurely**. I wrote three near-duplicate functions (`composeBottomEdge`, `composeLeftEdge`, `composeRightEdge`) rather than one parameterized `composeEdge(side)` — the per-edge differences (which axis to iterate, which cicn region to sample for fills, which container edge to anchor named parts to) compound just enough that the parameterized version would have been a knot of conditionals.

Later, I did factor `composeLeftEdge` + `composeRightEdge` into a private `composeVerticalEdge(..., side)` helper because they really are mirror images (only the sample column and anchor edge differ). But top + bottom stayed separate — anchoring to `top:0` vs `bottom:0` plus the cicn-sample-row inference for bottom made them more divergent than the left/right pair. Good rule of thumb: factor only the *true* mirror pairs; let the "similar but actually different" cases stay as separate functions until a third or fourth call site forces them together.

**Container model:** the three new edge containers (`.aaron-window__edge--{bottom,left,right}`) added to `AaronWindow` are pure structural — `position: absolute; pointer-events: none; overflow: hidden` and nothing else. All visible styling (thickness, where they sit relative to the titlebar) lives in the consumer's CSS. This matches the pattern from #64.2 (CSS custom properties carry constraints, consumer carries presentation) and keeps the runtime contract narrow.

**Heuristic risk:** the bottom-strip-start inference (look for a named part whose rect sits in the bottom 5px of the cicn) works for both canonical bundles but is brittle for schemes that don't follow the same convention. Documented as a known limitation; will iterate from real consumer feedback. Don't over-engineer the heuristic now — wait for a scheme that breaks it, then add explicit fallback or `edgeThickness` schema field.

**Test discipline (jsdom gotcha):** writing tests for the side composer surfaced a jsdom behavior — the browser normalizes `-0px` to `0px` in serialized `style.backgroundPosition`. Cost me one failing assertion. Use string `.startsWith` checks for px values that might be zero, not strict equality with the `-0` form.

---

### 2026-05-18 — The chrome composer was structurally wrong; reference image is the authoritative spec

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". The "3-slice template via CSS `border-image`" conclusion is itself a dead end; chrome is a part-code recipe walk, not 3-slice. (The "check the reference image first" methodology point still holds.)

After three composer iterations (V1 stretched-segments, V2 named-vs-fill, V3 with side composition) the user surfaced screenshots showing the rendering still didn't read right — "still lots of weird artefacts." The root cause was a flawed mental model of how Kaleidoscope chrome works: I'd been assuming the cicn is a **per-segment composition** with named parts spreading proportionally across the titlebar width. The reference rendering (already on the page in the side-by-side fidelity window) shows otherwise: close-box pinned to the **left pixel edge**, zoom-box pinned to the **right pixel edge**, and the middle **tiles** the cicn's pinstripe pattern as the window grows.

This is structurally a **3-slice template**, which CSS `border-image` ships natively. Took one PR to replace ~500 lines of per-segment composer logic with ~100 lines of inline `border-image-*` styles + 6 piece divs for the bottom/side edges (where `border-image` doesn't fit because the container is too thin).

**Pattern worth keeping:** when the user shows screenshots and says "weird artefacts," check the rendering against the reference image *first*, before reaching for incremental fixes. Three PRs of "make the per-segment composer slightly less wrong" was less productive than one PR of "throw out the model and use the standard CSS feature designed for this." The reference image was sitting there the whole time.

**Implementation detail:** `border-image-repeat: round` tiles whole-number copies of the middle slice and resizes them slightly to fit — period-correct for pinstripe patterns where partial cuts at the ends would look broken. `image-rendering: pixelated` is essential — without it browsers smooth the cicn upscale and the crisp 1-bit chrome looks blurry.

**Edge case the rewrite uncovered:** `border-image` requires the container to have enough height for the slice geometry to make sense. The titlebar at 25px tall, with slice `0 39 0 25` (top 0, right 39, bottom 0, left 25), works fine — top/bottom borders are 0 width so the middle "fill" region spans full height. But for the bottom edge container which is only 3px tall and wants to show the cicn's bottom rows, `border-image` would scale the entire cicn into that 3px height (terrible). Solved by falling back to the per-piece div approach for thin edges where `background-position-y: bottom` does the alignment correctly.

**Cumulative chrome PR count:** #58 → #59 → #60 → #61 (gap analysis) → #62 (revert) → #65 (V1) → #66 (research) → #67 (spec) → #68 (V2) → #85 (title pill) → #86 (side composition) → this PR (3-slice). 11 PRs across two days. Don't pretend the path was linear — it wasn't. Every iteration moved understanding forward even when the implementation got reverted. The honest gap analysis from #61 was the critical methodological step that made the rest possible; without it I'd still be shipping reactive per-segment fixes.

---

### 2026-05-18 — Border THICKNESS is also per-scheme (1px for 7 Le, 6px for ErgoBox); derive both color + geometry from the cicn

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". Frame insets come from the body rect vs the cicn's drawable extent (`frameFromBody`), not from scanning inward counting border pixels with a clamp heuristic.

After shipping the 1px hairline (initial pass on this PR) the user immediately corrected: ErgoBox's reference shows a 6px beveled border with shading and patterns. Same scheme that needed a 3-slice titlebar approach needs a fundamentally different *side* approach too — its chrome cicn (132×64) carries a full bordered window, not just a titlebar.

**Solution:** derive per-side thickness at runtime via pixel scanning. New `deriveFrameGeometry(url)` returns `{ color, top, right, bottom, left }`. Scans inward from each edge at the mid-axis counting consecutive "border" pixels (opaque + not near-white) until it hits a "body" pixel. For ErgoBox this returns `{ left: 6, right: 6, bottom: 7 }`; for 7 Le it returns the cap (titlebar-only cicn has no body), which gets clamped to `{ left: 1, right: 1, bottom: 2 }`.

**Clamp rule:** if scanned thickness > max(8, extent/4), treat as titlebar-only cicn → use 1px. Otherwise use scanned value. This makes the same renderer work for both "titlebar-only" and "full-window" cicns without per-scheme conditionals.

**Stamped as CSS custom properties:** `--aaron-frame-{left,right,bottom}-px` on the window root. Consumer CSS sizes the edge containers from these. Both canonical bundles now render with their period-correct border thickness.

**Meta-lesson:** when correcting a course based on user feedback, look at MULTIPLE references before re-implementing. I assumed all schemes had thin hairline frames (because 7 Le does) and shipped a "drop the edge containers" PR. The ErgoBox reference would have revealed the structural-difference-per-scheme answer before any code was written. Both canonical bundles are on the demo page — always check both before generalizing.

### 2026-05-18 — Palette `window-frame` is often wrong; sample the cicn's outermost opaque pixel at runtime

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". This entry is built on the 1px-hairline-frame / dropped-edge-composer model; the frame now comes from the drawable extent + side recipes. (The general "prefer sampling source pixels over approximated palette hints" instinct may still apply.)

The extractor pre-fills `theme.palette.window-frame` with a generic gray (`#888` for 7 Le), but the actual cicn's outermost opaque pixel is `#000` (solid black — the 1-bit Mac chrome). When the frame color was wired to `--aaron-colr-window-frame` in CSS, the rendered hairline read as a faint gray instead of the period-correct black line.

**Fix:** new runtime helper `deriveFrameColor(cicnUrl)` — fetch the cicn, draw to an OffscreenCanvas, find the first opaque pixel scanning leftmost column then rightmost column. Cache per URL. Stamp as `--aaron-cicn-frame-color` on the window root. Consumer CSS uses it: `box-shadow: inset 0 0 0 1px var(--aaron-cicn-frame-color, var(--aaron-colr-window-frame, #666))`.

**Subtle correctness:** windows in the demo default to `data-state="inactive"`. The runtime resolves `cicnUrl` from `windowType.chrome[state]`, so the INACTIVE cicn gets sampled by default — which has a dimmer outer pixel (`#555` for 7 Le inactive vs `#000` active). Period-faithful: classic Mac OS dimmed the frame of unfocused windows. The frame color tracks state automatically because `applyChromeFromTheme` runs again when state flips and re-samples.

**Architecture pivot also in this PR:** dropped the per-edge composer rendering (#86's bottom/left/right `applyXxxEdgeAs3Slice` calls) in favor of the single hairline frame. The edge containers remain as DOM placeholders (`display: none`) for future scheme-specific decoration where a 1px line isn't enough — but for both canonical bundles, a 1px line matches the reference rendering exactly. Saved ~100 lines of CSS background-position math that wasn't adding visual value.

**Pattern worth keeping:** when palette values look approximated or generic, prefer sampling the source pixels. The cicn is the source of truth; the palette is a hint. Same applies to other palette fields (`titlebar-active-bg`, etc.) — if the extractor pre-fills them, double-check against the actual rendered cicn before trusting.

---

### 2026-05-18 — Chrome cicns split into 3 kinds; classifier dispatches 3-slice vs 9-slice rendering

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". The Kind A/B/C chrome-cicn classifier (and its 3-slice/9-slice dispatch) is a retired dead end; one general part-code recipe walk handles every cicn, no per-kind branches.

After importing 5 exotic Kaleidoscope schemes from the archive (#89), the gallery exposed that **chrome cicns aren't structurally uniform** — they fall into three kinds:

- **Kind A (titlebar-only):** thin horizontal strip, e.g., 7 Le 74×25. Render as 3-slice on the titlebar element + a 1px hairline derived frame for the rest of the window.
- **Kind B (full-window):** encodes the WHOLE window frame including sides + bottom + corners, e.g., ErgoBox 132×64, Big Blue 89×82, 1990 170×170. Render as **9-slice via CSS border-image on the window ROOT** — corners pinned, sides tile, center fills the content box.
- **Kind C (fixed-bitmap):** elaborate decoration that doesn't tile cleanly (Acid's lego blocks, evolution's metallic pipes). Fall back to Kind A treatment — distortion accepted as the documented limitation.

New `classifyChromeCicn(url)` helper detects the kind by inspecting the cicn:
1. Height ≤ 30 → titlebar-only
2. Center 4×4 sample grid is mostly body-like (transparent or near-white) → full-window
3. Otherwise → fixed-bitmap

`applyChromeFromTheme` dispatches based on the classifier result — 9-slice apply runs on the window root for Kind B (`applyChromeAs9Slice.ts`); existing 3-slice on titlebar runs for Kinds A and C.

**Subtle test infrastructure gotcha:** the gallery's `attachThemeToWindow` subscribed each window to a global registry, so loading scheme N's theme would re-render windows 0..N-1 with scheme N's chrome. The fix was to bypass `loadTheme` (which always publishes) and instead fetch + parse + resolve manually per-window, then call `applyChromeFromTheme` directly. The registry is the right model for single-active-theme apps; the gallery is a multi-active-theme view that needs per-window apply.

**Schematics + decision rules** documented in `docs/chrome-rendering-architecture.md`. New per-PR pattern: when shipping a renderer change, the architecture doc gets a new section with ASCII diagrams of the slice geometry, not just code-level comments.

---

### 2026-05-18 — The build-time extraction step was the wrong default; decoders belong in the runtime

After importing 5 exotic schemes (#89) and seeing the gallery expose fidelity gaps, the user articulated the structural problem: we've been doing **lossy build-time conversion** + manual per-scheme patches when something doesn't extract cleanly (SHIOCOP wnd# slug orphans, missing cinf usage, missing bgPattern tiling). That doesn't scale to the 3000+ scheme archive.

**Kaleidoscope's actual model:** it was a System extension that opened the resource fork at runtime, enumerated standard Mac OS resource types, and rendered windows by interpretation. No conversion step. The renderer was the authoritative interpretation layer.

**Plan (multi-phase loader rewrite):**
1. **Phase 1 (this entry):** move decoders from `tools/scheme-extractor/lib/` to `src/themes/loader/` so they're runtime-importable. README explicitly noted they were already browser-portable; the move is mostly mechanical (`git mv`, update CLI imports, update vitest config). Behavior unchanged for existing schemes.
2. **Phase 2 (next):** add a pure-JS Mac OS resource fork parser + `loadKaleidoscopeScheme(bytes|url|File)` that returns an in-memory `Theme` matching the schema. Replaces `theme.json` as the source of truth for runtime.
3. **Phase 3:** distribute themes as raw `.rsrc` (resource fork bytes) — runtime decodes on load; `theme.json` becomes a cache, not a contract.
4. **Phase 4:** recipe-driven per-segment renderer (separate workstream — orthogonal to the loader move but unblocked by it).

**Pattern worth recording:** when a build-time pipeline accumulates per-scheme manual patches, the pipeline is the wrong place to do the work. Move to runtime; let the renderer be the spec compliance layer. Apply the same logic when other build-time conversion steps emerge.

---

### 2026-05-18 — Pure-JS Mac OS resource fork parser + runtime scheme loader (Phase 2)

Phase 2 of the loader rewrite: added `parseResourceFork(bytes)` and `loadKaleidoscopeScheme(bytes|url|Blob|ArrayBuffer)`. The runtime can now decode any well-formed Kaleidoscope `.ksc` or raw `.rsrc` blob into a complete `Theme` matching `docs/kaleidoscope-geometry-spec.md §7` — without `DeRez`, without a build step, without per-scheme manual patches.

**Parser:** ~190 lines, pure JS (`src/themes/loader/resource-fork.js`). Implements the Inside Macintosh: Resource Manager format. Validated against the Acid (#1022) scheme's actual resource fork: parses 666 resources in single-digit milliseconds with type/id/name/data fields matching what `DeRez` produces. Synthetic single-resource fixture covers the structural happy path.

**Runtime loader (`loadKaleidoscopeScheme.js`):** ties parser + per-type decoders + `buildThemeJson` + `validateTheme`. Accepts Uint8Array, ArrayBuffer, SharedArrayBuffer, Blob, or a URL string (fetches it). Optional `assetUrlFactory` for caller-controlled blob URL encoding (default uses `OffscreenCanvas.convertToBlob` in browsers). `meta` option supplies provenance the binary doesn't carry (author, license, source URL).

**Validation result:** loading 1022.rsrc through the runtime produces the SAME 10 windowTypes + 190 chromeElements + 2 patterns + correctly-mapped `document-window` chrome (active=cicn -14335, inactive=cicn -14336) as the build-time bundle in `themes/acid/theme.json`. End-to-end parity confirmed.

**SharedArrayBuffer gotcha (Node):** `Buffer.buffer` in some Node configurations is a `SharedArrayBuffer`, not `ArrayBuffer`. `slice()` preserves the type. So `instanceof ArrayBuffer` checks miss it. Switched to duck-typing on `byteLength` + `!ArrayBuffer.isView(input)` for the input normalizer. Trivial but easy to miss.

**What this enables:** Phase 3 can drop the `.rsrc` files directly into `themes/<slug>/` (or fetch them on demand from an archive URL), retiring the build-time `theme.json` bundles as the source of truth. The `theme.json` files we currently ship become an optional cache, not a contract.

---

### 2026-05-18 — Phase 3 of the loader rewrite: distribute themes as .rsrc + runtime decode

Phase 3 lands: every bundled scheme now has a `scheme.rsrc` file (the raw Mac OS resource fork bytes) alongside the legacy build-time bundle (`theme.json` + PNGs). The demo's `smartLoadTheme(slug)` helper prefers the runtime path when `.rsrc` is available, falls back to the bundle otherwise.

**File sizes** (illustrative): `masswerk-7-le` 117 KB, `acid` 826 KB, `evolution` 1.6 MB. The 1.6 MB worst case decodes in <100 ms in the runtime; smaller schemes well under that. Compared to the bundle path (single `theme.json` fetch + 100+ PNG fetches as needed), the .rsrc path is faster overall because it's one round-trip for everything.

**Canonical wnd# ID → slug fallback table** (added in `buildThemeJson.js`): fixes the SHIOCOP orphan-slug problem at the *source* — both build-time and runtime paths now produce `document-window` for `wnd# -14336` regardless of whether the resource carried a name. The fallback table maps the well-known Mac OS Window Manager IDs (`-14336` → `document-window`, `-14328` → `dialog`, `-14326` → `alert`, etc.).

**Runtime parity** (manual verification): loading any of the 7 schemes via `?theme=<slug>` produces the same visible chrome as the legacy bundle path. The 3-slice/9-slice renderer is unchanged (Phase 4 scope); we're just feeding it from the runtime decoder instead of a JSON file.

**E2E gotcha — radio click triggering theme switch:** the demo Controls window has a radio group wired to swap schemes. Initially I swapped its handler to `smartLoadTheme`, which then ran the runtime decoder for the 516KB ErgoBox scheme inline. That added a few hundred ms which made the radio-click → name-update assertion flaky in Playwright. The radio group is a UI illustration, not a loader test — kept it on the fast bundle path. **General rule:** when a slow path is OPTIONAL for a given user interaction, default to the fast path for that interaction even if the slow path is correct architecturally.

**What's NOT yet changed:**
- The `themes/<slug>/theme.json` + PNG bundles are still on disk (cache; not deleted yet — needs deprecation cycle)
- The bundled-default still loads via the legacy path (`enableBundledDefault` uses `loadTheme(bundleUrl)`) — could swap to runtime in a follow-up
- The renderer is unchanged — Phase 4 picks that up

---

### 2026-05-18 — Phase 4a: recipe-driven top-edge composer (what Kaleidoscope itself did)

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". This composer treats each recipe entry as a paint command and dispatches a Kind B 9-slice in parallel; the v3 walk is end-based, classifies by part code, and tiles (never proportionally positions) fills.

Replaces the CSS `border-image` shortcut for the titlebar top with a faithful walk of `wnd#.edges.top` + `parts` rects. Same algorithm Kaleidoscope's renderer used: for each `{at, part}` segment, if `part` is named → cut the part's cicn rect at native size + paint at PIXEL position `at` from the appropriate side edge; if fill → tile cicn pixels between named parts.

**Key correction over PR #65/#68 V1/V2:** those used **proportional** positioning (`left: X%`). As windows grew, close-boxes drifted inward proportionally. The fix is **pixel-anchored** positioning from the matching screen edge — `cicn center.x < cicnWidth/2 → anchor LEFT (offset = at px from left)`, else `anchor RIGHT (offset = (cicnWidth - at - partWidth) px from right)`. Close-box stays pinned to left, zoom-box pinned to right, middle fills absorb the slack as the titlebar widens.

**Hybrid path for Kind B schemes:** the recipe path handles only the top edge in this phase. For schemes like ErgoBox (full-window cicns), the classifier still dispatches the 9-slice on the window root in parallel — that handles the side+bottom borders the recipe path doesn't yet cover. Title pill bounds come from the recipe's middle-fill cicn-pixel zone (`leftClusterCicnEnd .. rightClusterCicnStart`), exposed as `--aaron-title-pill-{left,right}` custom properties same as before.

**Visual results across 7 schemes** (`docs/screenshots/`):
- mass:werk 7 Le — clean titlebar with close+zoom pinned, pinstripe tiled in the middle ✓
- mass:werk Dark ErgoBox 2 — recipe handles top widgets, 9-slice handles dark frame on sides+bottom ✓
- Big Blue (#1984) — Apple-tab silhouette widgets visible at corners (the iconic chrome) ✓
- Acid (#1022) — titlebars cleaner than before, but the elaborate lego-block decoration in the cicn's middle is lost (Kind C scheme — the cicn isn't actually a slice template, it's a bitmap; the loss is faithful to "this scheme's design can't tile") ⚠️
- 1990, evolution — similar story to Acid; widgets visible at corners, decoration in cicn middle is gone

**Honest trade-off recorded:** for Kind C schemes the recipe path produces "cleaner" but less decorated chrome. The previous CSS-border-image rendering of these schemes was a *broken* attempt at faithful — it tiled decoration that wasn't designed to tile. The recipe path is *honest* about what the scheme actually specifies. Future phase: Kind C schemes could render via a centered/scaled bitmap mode that respects the design intent.

**Phase 4b/c queued:** bottom + side recipe handling. Once those land, the border-image fallbacks become entirely unused (kept as dead code for one cycle, then deleted).

---

### 2026-05-18 — Phase 4b: recipe-driven bottom edge

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". Part of the per-segment composer + Kind B 9-slice dispatch the part-code walk replaced.

Mirror of `composeTopRecipe` for the bottom-edge container. Same logic with vertical anchoring flipped (named parts anchor to container *bottom* via `bottom: (cicnHeight - rect.bottom)`), and fills sample from the cicn's bottom rows via `background-position-y: bottom` so the bottom-strip frame line / decoration shows in the rendered bottom edge.

**Wiring:** when the top recipe applies + a `[data-aaron-edge="bottom"]` container exists, we also run the bottom recipe. If bottom recipe applies → 9-slice on window root is *not* dispatched (would otherwise double-render). If bottom recipe doesn't apply but the cicn is Kind B → 9-slice still runs as before for sides + bottom.

**Visible:** Big Blue's iconic Apple-tab silhouettes now visible at window *bottoms* too (previously only top corners). 1990 + evolution show their bottom frame decorations. 7 Le + ErgoBox unchanged from before — they were already clean.

**Demo CSS observation:** the bottom-edge container is sized by `--aaron-frame-bottom-px` (derived from cicn, typically 1-7px). For schemes whose bottom-row decoration is tall (Big Blue's 17px tabs), the named parts get partially clipped by `overflow: hidden` on the container. That's a demo-CSS choice, not a renderer limitation — consumers can make the container taller if they want more decoration visible.

**Phase 4c queued:** left + right edges (vertical iteration of the recipe walker). After 4c lands, the border-image fallback paths become unused — kept for one cycle as dead code, then deleted.

---

### 2026-05-18 — Phase 4c: recipe-driven left + right edges (loader rewrite complete)

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". Same per-segment composer + Kind B 9-slice fallback the part-code walk replaced. (The loader-rewrite scope summary — `.rsrc` runtime decode, slug fallback table — is unaffected.)

`composeSideRecipe(container, windowType, options, 'left' | 'right')` mirrors top + bottom with axes swapped:
- Recipe `at` values are Y coordinates (positions down the side, not across)
- Named parts anchor `top` or `bottom` based on cicn-Y half center
- Fills tile vertically (`repeat-y`), sampling cicn's leftmost column (left edge) or rightmost column (right edge)

**Dispatch in `applyChromeFromTheme`:** when top recipe applies, also run bottom + left + right recipes (each on their `[data-aaron-edge]` container if present). Only fall back to 9-slice-on-window for Kind B schemes that DIDN'T get all four sides recipe-handled. For well-formed schemes that's now rare.

**Visible across schemes:** the side widgets/decoration that 1990, evolution, ErgoBox encode in their side recipes now show as thin vertical strips down the windows. Big Blue's silhouette stays at top + bottom (it has no side decoration in its wnd# data — faithful).

**Phase 4 plan complete:** all four sides driven by `wnd#` recipes + `parts` rects, the way Kaleidoscope itself rendered. The CSS-`border-image` paths (`applyTitlebarAs3Slice`, `applyWindowAs9Slice`) remain in the tree as fallbacks for schemes without recipe data — dead code for now since every bundled scheme ships recipes. Will deprecate + delete in a follow-up cycle once stability is confirmed.

**Loader rewrite cumulative scope** (across Phases 1–4):
- Phase 1: move decoders from `tools/scheme-extractor/lib/` to `src/themes/loader/` (#93)
- Phase 2: pure-JS resource fork parser + `loadKaleidoscopeScheme(bytes|url|Blob)` (#94)
- Phase 3: distribute themes as `.rsrc` blobs + canonical Mac OS wnd# slug fallback table (#95)
- Phase 4a: recipe-driven top edge (#96)
- Phase 4b: recipe-driven bottom edge (#97)
- Phase 4c: recipe-driven left + right edges (this entry)

End state: drop any well-formed `.ksc` URL into `loadKaleidoscopeScheme()` → faithful Kaleidoscope-style rendering on all 4 sides via per-segment composition. No build step, no per-scheme patches, no CSS `border-image` shortcuts for schemes that ship recipes.

---

### 2026-05-18 — Diagnostics page: per-scheme breakdown of extraction + rendering

Added `demo/diagnostics.html?theme=<slug>` — a persistent debug + learning surface for understanding what the runtime sees and does for any given scheme. Built in response to repeated "is it extraction or rendering?" questions on exotic schemes (Acid, 1990, evolution) where the live render looked broken but the cause wasn't obvious.

The page shows, per scheme:
1. **Metadata card** — name, author, year, source URL
2. **Classifier verdict** — Kind A (titlebar-only) / B (full-window) / C (fixed-bitmap), with the rendering strategy each kind triggers
3. **Cicn explorer** — every chrome state cicn (active, inactive, collapsed-*) at 4× scale, with three toggleable SVG overlays:
   - Parts rects: each named part outlined in a distinct color (matches legend)
   - Recipe positions: tick marks at each `recipe.at` along every side
   - Half-line: dashed yellow showing the cicn-half split that drives anchor-side decisions
4. **Recipes** — per-side table of `{at, part, kind, part rect}` entries
5. **Parts** — table of all named slugs + their cicn rects
6. **Live render** — a real `AaronWindow` with the scheme applied, width slider so you can see how the chrome adapts, plus a "highlight segments" toggle that outlines each rendered piece (named in pink, fills in blue)

**Workflow this unblocks:** when a scheme renders incorrectly, open the diagnostics page → compare the live render to the cicn with overlays. If the recipe data + parts look reasonable but the live render is wrong, the bug is in the renderer (`composeRecipeBased.ts` or the dispatch in `applyChromeFromTheme.ts`). If the recipe data is empty / orphan-slugged / clearly mis-parsed, the bug is in the extractor (`buildThemeJson.js`). The split shortens the debug loop substantially.

**Linked from:** the main demo's "For developers" footer, alongside the gallery.

---

### 2026-05-18 — Phase 4 reverted: wnd# recipe entries are slice-boundary markers, not render commands

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". The revert *target* here — back to 3-slice/9-slice via CSS `border-image` — is itself a dead end. In v3, recipe cells ARE walked (end-based) and classified by part code; they're not just slice-boundary markers feeding a `border-image`.

The user spotted a structural bug in the recipe-driven composer (#96/#97/#98). For 7 Le, the live render showed **7 widgets** clustered across the titlebar; the cicn template clearly has only **3**.

Root cause: I'd interpreted each `{at, part}` recipe entry as "render this part's rect at position `at`." For schemes where the same named part appears at multiple recipe positions (7 Le has `part-1` at `at=5, 24, 35, 74`), the composer duplicated widgets.

**Correct interpretation:** recipe entries are markers that the renderer USES to determine WHERE the fill zone (stretchable middle) is. They are NOT individual paint commands. The actual widgets are at their cicn-native positions (per the `parts` map's rects); the recipe just tells you what's on each side of the fill so you can slice the cicn into left/middle/right correctly.

The 3-slice via CSS `border-image` approach from Phase 3 (#87) does this correctly:
- Slice the cicn at the fill-zone boundaries
- Pin left slice (cicn pixels [0..fillStart]) to titlebar left at native size — includes the close-box-area
- Pin right slice (cicn pixels [fillEnd..cicnW]) to titlebar right — includes the zoom-area
- Tile middle slice across the gap

**Reverted scope:** dispatch in `applyChromeFromTheme` no longer calls `composeTopRecipe`/`composeBottomRecipe`/`composeSideRecipe`. Returns to: Kind A → `applyTitlebarAs3Slice`; Kind B → `applyWindowAs9Slice` on window root. The recipe-based composer code stays in tree (might be useful for future hit-target overlay positioning — that IS a per-entry concern).

**Diagnostics highlight extended** to cover the now-active rendering modes:
- Yellow outline on `.aaron-titlebar[style*="border-image-source"]` (Kind A 3-slice)
- Cyan outline on `.aaron-window[data-aaron-chrome-9slice]` (Kind B 9-slice)
- Pink/blue on `[data-aaron-recipe-segment]` (currently unused; for future)

**Meta-lesson:** the diagnostics page (#102) paid for itself within a session — it surfaced the duplicate-widget bug in the live render immediately by comparison to the cicn-with-overlays. Without the page I'd have spent more cycles speculating. New project pattern: when a renderer behaves unexpectedly, the diagnostics view is the first check.

---

*New learnings get appended below this line as the project ships.*

---

## 2026-05-18 — Display gaps look identical to extraction gaps (#105)

User reported that mass:werk 7 Le "only shows titlebar assets but no scrollbar/buttons" and suspected the loader wasn't extracting everything. The loader was actually extracting everything (119 cicns + 6 ppats for 7 Le). The diagnostics page just didn't show them — it only rendered the four document-window chrome states because that's what the renderer consumes.

**Lesson:** when a user reports "missing data," distinguish three failure modes before debugging:
1. Loader didn't extract → check `themes/<slug>/cicns/` directory size + `chromeElements` count
2. Theme JSON drops it → diff `chromeElements` keys against on-disk cicn filenames
3. Renderer doesn't use it → that's what was happening here

Fix: added a full chromeElements catalog grid to the diagnostics page so all extracted rasters are visible regardless of which the runtime consumes. Now extraction-vs-display is a glance, not an investigation.

**Meta-lesson:** the diagnostics page is the right place to make EVERY extracted-vs-rendered comparison visible — if a category of assets isn't currently rendered, show it anyway so the gap is obvious. The page's value compounds with each section added.

## 2026-05-18 — Kind C has reasonable workarounds; don't treat it as "broken" (#105)

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". The Kind A/B/C classifier is retired, so "Kind C" no longer exists as a rendering path.

When the chrome classifier returns "fixed-bitmap" (Kind C), I had been describing it as a hard limitation. It's actually a soft one: period Mac apps that used these schemes typically were fixed-size (splash screens, About boxes), so the constraint matches the original usage pattern.

**Lesson:** the diagnostics page's verdict text should explain WHAT can be done about each limitation, not just that the limitation exists. Added three workaround options to the Kind C verdict (lock to native size, fixed-size-apps-only usage, future canvas-composite) plus a "Lock to native cicn width" button in the live render pane that snaps the slider to the cicn's authored width.

**How to apply:** every classifier verdict should answer "now what?" with concrete actions, not just "this is the situation." Pure diagnosis without remediation paths makes the tool less useful.

## 2026-05-18 — Doc-first locked in a fictional threshold before code shipped (#111)

For the rich-recipe composer dispatch, I wrote `docs/chrome-rendering-architecture.md §7.1` (the threshold rule + per-scheme table) before implementing. My first-draft table had **fictional numbers** — 7 Le at "4 max segments per edge", ErgoBox at "3", 1990 at "22". I'd eyeballed them from the segment overlay screenshots.

Then I ran `jq` against every `themes/*/theme.json` to verify before committing. Real numbers: 7 Le = 13, ErgoBox = 13, Big Blue = 11, 1138 = 8, 1990 = 21. My proposed `> 6` threshold on *total entries* would flag everything as rich.

The fix: the discriminator should be **fill segments per edge** (entries whose part is NOT in the parts table), not total entries. Named widgets don't strain border-image; only fill spans do. Real fill counts: Kind B simple = 4-5; 1990 = 9 — clean gap.

**Why it matters:** had I built the composer first and documented after, the threshold would have been hardcoded against vibes. The doc-first phase forced quantitative justification and caught the mistake when it cost 30 seconds to fix instead of a follow-up PR.

**How to apply:** when proposing thresholds, default-values, or empirical ranges in any spec, run the discriminating query against the actual corpus inline in the doc. "I think it's around X" is fine in conversation; in a doc it's a future bug.

## 2026-05-18 — Part rects are hit-test metadata, NOT render geometry (#112)

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". The headline ("part rects are hit-test metadata, not render geometry") still holds, but the `composeRichRecipe` "every segment crops the cicn at its own edge position" rendering model it lives inside is gone — v3 walks end-based cells classified by part code.

V1 of `composeRichRecipe` cropped named-widget segments to their part rect: "segment references part-1 → display cicn[part-1.rect]". For 1990's top edge this looked correct (close-box pixels appeared at the close-box position). On the bottom edge it produced visible mismapping — part-1 is referenced 7× on the bottom recipe but part-1's rect is at cicn y=11..19 (top region). Painting top-row widget pixels onto the bottom edge gave a scattered widget look.

The fix (V2): **every segment crops the cicn at its own edge position**, regardless of whether it's named. The only thing that varies between widget vs fill is flex behavior (widget pins at native width; fill grows proportional to span). The part rect is metadata for *hit-testing* (which we may wire later as a click-target overlay), not for *rendering*.

**Why it matters:** this is the same flavor of mistake as the #103 Phase 4 revert — interpreting wnd# entries as paint commands instead of as boundary markers. Same lesson, different angle. The wnd# `part` field on a recipe entry identifies what KIND of segment lives at that boundary (widget anchor vs fill zone); it doesn't specify where to source pixels.

**How to apply:** when designing renderers from the wnd#/cinf data, ask "is this geometry metadata for rendering, or topology metadata for behavior?" before using it. Most rect-like fields in Kaleidoscope's format are the latter.

## 2026-05-18 — Corner pinning is non-optional for recipe composers (#112)

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". Corners are intrinsic to the walk (the fixed leading `[0,border[0])` cell), not a "pin the first/last fill segment of each edge" heuristic.

V2 of the composer rendered all fill segments with `flex: span span auto` (grow proportional to recipe span). The result for 1990 at 380px window width: the top-left corner zone (containing distinctive red/blue/yellow widget squares) stretched to 2.2× cicn width, scattering the widgets across the top edge.

The fix (V3): pin the **first and last fill segments of each edge** as `flex: 0 0 spanPx` (no stretch). Named widgets already pinned. Only interior fills grow.

**Why it matters:** CSS `border-image` corners pin automatically (the slice values define them; the corners aren't subject to repeat). A hand-rolled segment composer has no implicit corner concept — corners must be marked explicitly or the decoration that lives in them gets stretched. The "first + last fill of each edge" heuristic worked across the corpus because recipe authors consistently put corner-zone graphics as the first/last fill segments. If a future scheme breaks that convention, the heuristic needs revisiting; the safer long-term move is deriving the corner extents from the body rect (cinf-equivalent) and synthesizing dedicated corner segments rather than relying on recipe ordering.

**How to apply:** any time we replace `border-image` with a hand-rolled composer, audit what implicit properties of `border-image` we're losing. Corners-don't-stretch was the headline one here; others (slice-aware caching, etc.) will surface as the composer hits more schemes.


## 2026-05-18 — "Missing spec" was actually a slice-math bug (#120)

The 1990 scheme had two visible chrome issues that I diagnosed (over multiple PRs) as fundamental format limitations:

1. Bottom-left of every rich-recipe window showed colored squares that don't exist in the cicn's bottom band
2. The bottom-right star was missing entirely

I built elaborate explanations: "Kaleidoscope authors drew chrome assuming near-native render dimensions," "the format has no per-segment static metadata," "there's a missing geometry/sprite mapping technique." Wrote three PRs (#116 part-overlap pinning, #117 period window constraints, #119 part-code dispatcher) that each chipped at the surface symptoms.

The actual bug: `composeRichRecipe`'s `border-image-slice` math always cropped the cicn's **TOP band** for non-vertical edges. The `isVertical` branch handled left vs right correctly; the non-vertical branch quietly applied top-edge slice values to BOTH top and bottom edges. So the bottom edge rendered top-row pixels (including the close/zoom widgets at cicn x=46-64) at the bottom of the window. The star at bottom-right was missing because we were sampling top-right pixels there (which is just background pattern).

The user finally surfaced it by pixel-sampling the cicn directly: `cicn(60, 145) = pure gray`, yet the rendered window showed colored squares there. There was no missing format field; the renderer was just looking in the wrong place.

**Why it matters:** I had spent multiple PRs working around a bug I'd misclassified as an unfixable format limitation. The pattern was: I'd notice the visual artifact, build a theory about why the format couldn't represent the intent, then PR a workaround that targeted the theory. Each workaround did real-but-marginal good while the actual bug persisted.

**How to apply:** when a visual artifact persists across multiple fix attempts, the next step is ALWAYS to pixel-sample the source. If the rendered output doesn't match what's actually in the source bitmap at that position, the bug is in the renderer's pixel-source math, not in the format's expressiveness. Don't theorize about format limitations before confirming the renderer is reading from the right pixels.

Meta-lesson on user feedback: the user's repeated "this looks wrong" pushback, even after multiple targeted fixes, should have triggered "is my theory wrong?" earlier. Every time they said "the close buttons are still repeating" I added more pinning heuristics — when the right move was to question the slice math. Persistent user disagreement with my framing is information; treat it as a debugging signal, not a UX complaint to mitigate.


## 2026-05-18 — Kaleidoscope is a WDEF replacement; format docs are unrecoverable but the rendering CONTEXT is Apple's

Research spike (sources at end). Three load-bearing findings:

**1. Kaleidoscope IS a WDEF (Window Definition Procedure) replacement.** It hooks into Apple's Window Manager + Appearance Manager and overrides the per-window-type WDEF. The Window Manager dispatches `wDraw`, `wHit`, `wCalcRgns`, `wGrow` messages; Kaleidoscope responds by reading the loaded scheme's cicn / cinf / wnd# / ppat / Colr resources and rendering accordingly. So the rendering CONTEXT is Apple's documented WDEF protocol, even though Kaleidoscope's scheme FORMAT was Greg Landweber's own design.

**2. Apple's window part codes are documented** (Inside Macintosh: Macintosh Toolbox Essentials, Window Manager chapter):

  | const | value | region |
  |---|---:|---|
  | wNoHit | 0 | missed |
  | wInContent | 1 | content area |
  | wInDrag | 2 | titlebar drag |
  | wInGrow | 3 | resize handle |
  | wInGoAway | 4 | close box |
  | wInZoomIn | 5 | zoom box (state 1) |
  | wInZoomOut | 6 | zoom box (state 2) |
  | wInCollapseBox | 7 | windowshade (8.0+) |
  | wInCollapseBoxAll | 8 | windowshade-all (8.0+) |
  | wInProxyIcon | 9 | doc proxy icon |

**BUT Kaleidoscope's `part` field in wnd# is NOT Apple's part codes verbatim.** Cross-checking 7 Le's rectList: part-1 is the close box (Apple's wInGoAway=4); part-2 is zoom (5/6); part-3 is windowshade (7). Kaleidoscope uses scheme-internal sequential indices, then translates to Apple's wInXxx codes at runtime for the WDEF's wHit response. The match of our observed parts 5/6 to Apple's wInZoomIn/Out is coincidence; cross-scheme audit shows 5/6 are author-convention divider-decoration markers, not zoom regions.

**3. No third-party Kaleidoscope renderer exists.** Confirmed:
  - kaleidoscope.net SDK pages are gone; Apple's Wayback snapshots don't cover the SDK era
  - Scheme Factory (official scheme editor) was abandoned in pre-release with no docs
  - Damien Erambert's Mac Themes Garden (4,000-scheme archive) renders previews by running real Kaleidoscope in a Mac OS 9 VM via UTM — there is no third-party rendering library in existence
  - Apple "released little documentation" for competing theme formats (per Wikipedia)

Aaron UI's runtime is the only third-party Kaleidoscope renderer ever shipped outside Classic Mac OS. That's exciting and validates the diagnostics-first approach — we don't have anyone to copy from, so empirical cross-scheme audit IS the spec.

### What this changes

- **Our part-code dispatcher (#119) was right in spirit.** Parts 5/6 are scheme-internal divider markers, not Apple's zoom codes. Cross-scheme empirical audit was the correct method.
- **The recipe may be primarily hit-test data, not paint data.** Kaleidoscope's WDEF needed both — paint at scaled positions + hit-test at scheme-defined zones mapping to Apple codes. We've leaned heavily on the recipe for paint; a simpler 9-slice paint path (cinf-derived geometry only) might match Kaleidoscope's actual behavior better. To test.
- **Click-handling becomes tractable.** With Apple's codes documented + Kaleidoscope's part indices visible in rectList, we can map (click) → (Kaleidoscope part) → (Apple wInXxx) → (DOM event). Close-box click could trigger AaronWindow.close() correctly per-scheme.

### How to apply

When a format is undocumented and the renderer is unrecoverable, **cross-scheme empirical audit + period-protocol research** is the highest-leverage research move. Don't try to find a missing spec doc that may not exist; instead, audit what the format ACTUALLY contains across the corpus, then cross-reference with the period APIs the format was designed to feed.

### Sources (audit trail)

- [Mac OS 8 Window Manager Reference (Inside Macintosh archive)](https://dev.os9.ca/techpubs/new/WindowMgr8Ref/WindowMgrRef.1.html)
- [Inside Macintosh: Macintosh Toolbox Essentials PDF](https://developer.apple.com/library/archive/documentation/mac/pdf/MacintoshToolboxEssentials.pdf)
- [Mac Themes Garden — 4,000-scheme archive](https://macthemes.garden/about/)
- [Damien Erambert on Mac Themes Garden's UTM-VM preview workflow](https://damien.zone/introducing-mac-themes-garden/)
- [Low End Mac on Kaleidoscope's Appearance Manager hooking](https://lowendmac.com/2001/change-your-classic-macs-appearance-with-kaleidoscope-and-custom-icons/)

## 2026-05-18 — Scheme Factory's resource fork is the missing spec

User downloaded [Scheme Factory v1.0PR2](https://www.macintoshrepository.org/11058-scheme-factory-kaleidoscope-editor-) — the OFFICIAL Kaleidoscope scheme editor by Joe Stenger + Arlo Rose — and we parsed its 361KB resource fork. Two finds that change everything:

### Find 1: STR# 128 — canonical 127-entry region vocabulary

The editor stores its UI labels in a `STR#` resource that enumerates **every editable region of a Kaleidoscope scheme** in 127 named entries: 14 window types, 14 menu region kinds, 10+ popup-menu states, 30+ buttons (push, default ring, bevel × size × state), 14 tab/header/placard kinds, 25+ slider/progress regions, color/pattern slots.

**This is the missing canonical vocabulary we'd been reverse-engineering from filenames.** The vocabulary we built in `docs/kaleidoscope-asset-catalog.md` was correct in spirit but missing the precise control naming — Scheme Factory's STR# 128 is now the authoritative source.

### Find 2: MENU 139 — 15 per-region resize behaviors

Scheme Factory's "resize" menu lists exactly 15 options that can apply to each fill region:

```
Stretch to new size              Repeat to fill new size              Anchor to center
Stretch along top side           Repeat along top side                Anchor to top left corner
Stretch along left side          Repeat along left side               Anchor to top right corner
Stretch along bottom side        Repeat along bottom side             Anchor to bottom left corner
Stretch along right side         Repeat along right side              Anchor to bottom right corner
```

**Exactly the per-region behavior encoding the user intuited had to exist.** Cinf bytes encode it via `(tileSides ∈ {0,1}, patternAnchor ∈ {0,1,2,3,4})` — stretch-vs-tile × whole/top/left/bottom/right. Distribution across 1990's 91 cinfs: 61× (0,0) "Stretch whole", 21× (1,0) "Repeat whole", rest = directional variants. **We've been honoring `tileSides` as a boolean but completely ignoring `patternAnchor`** — that's the side-anchor that selects which 5 of the 15 behaviors apply.

The 5 "Anchor to corner" options (pin to a corner, no stretch/tile) likely encode via a value range we haven't yet identified — possibly `tileSides=2+` or a combined byte.

### Critical implication for window chrome

For **window chrome** cicns (1990, Acid, evolution — the wnd# series), **cinf doesn't exist at all** (confirmed earlier — cicn -14336 has no matching cinf in any scheme). So Kaleidoscope must have applied a **default resize behavior** to window chrome — probably "Repeat to fill new size", which matches the multiplying-plaque artifact we observe. **The 1990 author had no way to mark the plaque as "Anchor to bottom-left corner" because the format gives that knob only to control elements (cinf-paired), not to window chrome (wnd#-only).**

### Other resources of interest

- **`cnfo` (14 resources)** — Scheme Factory's UI-panel metadata. Contains labels like "End Caps:", "Top Cap:", "Top & Bottom Caps:", "Tile Center" — confirms the cinf edit UI organizes behaviors as caps (corners) + center (fill).
- **`PCS#` (13 resources)** — "Part Code Sets," one per window type, IDs match wnd# IDs. Probably maps Kaleidoscope-internal part indices to Apple's `wInXxx` codes for hit-testing. Yet to fully decode.
- **`MENU 134` "wnd# edit"** — confirms wnd# structure: Content & Controls (= rectList), Top of the Window, Bottom of the Window, Left Side, Right Side (= the 4 side recipes). Matches our decoder.
- **`MENU 136` "cinf edit"** — cinf has three sections: Corners & Sides, Text, Background. Confirms our decoder coverage.
- **`MENU 137` "cinf fill"** — three fill TYPES: No Fill, Pattern Fill, Color Icon Fill. We've been treating fill uniformly; really there are three modes with different rendering.

### What to do with this

1. **Update the cinf decoder** to extract the full 15-value resize behavior enum, not a `tileSides: boolean`. Honor `patternAnchor` everywhere.
2. **Update `kaleidoscope-geometry-spec.md`** §2 with the canonical 15-behavior table.
3. **For window chrome rendering**, the format doesn't encode per-region static anchors. Stretching the chrome (vs repeating) is the closest "Kaleidoscope-faithful" rendering at large widths — the plaque distorts but appears once, vs tiling 3×.
4. **For Phase 3 controls**, honoring the full 15-value resize behavior is critical — without it every cicn-driven control will get the wrong stretch behavior.
5. **Decode PCS#** to recover the part-index → `wInXxx` mapping so future click-handling can dispatch to the correct AaronWindow events.

### Process meta-lesson

When the spec docs are unrecoverable, **the editor's binary IS the spec**. Scheme Factory's STR#/MENU resources literally enumerate the editor's vocabulary — which IS the format's vocabulary, since the editor's UI maps 1:1 to scheme fields. **20 minutes of parsing the editor's binary recovered more spec than 2 hours of web research.** If we hit another undocumented format in the future: find the official authoring tool, parse its resource fork, read its UI strings + menu items.

## 2026-05-19 — Period principle: tile at native, never stretch (#125)

The faithful composer landed in #124 used `border-image-repeat: stretch` for the chrome 9-slice. That preserved once-ness of static graphics (1990's plaque + star appeared once instead of multiplying) but stretched the decoration when the window grew beyond cicn-native — chrome distortion that looked wrong in a different way.

User-stated correction: **classic Mac OS chrome was always bitblt-tiled at native pixel size; QuickDraw stretching was both slow and visually wrong for the period's bitmap authoring style. Authors drew assuming tile, not stretch.**

This reversed the design direction. Per-segment composition came back (the right idea originally), but with a cleaner principle than the previous heuristic stack:

  Every segment is one of:
    a) ONE-OFF — drawn once at native cicn-px size, anchored in flex layout
    b) REPEATING FILL — cicn slice tiles at native pixel size via
       `border-image-repeat: repeat` to fill flex-grown width

  NEVER stretches.

`border-image-repeat: repeat` (not `round` or `stretch`) is the critical CSS — it tiles at the native source size, accepting a partial tile at the trailing edge. The partial tile is a period-correct artifact, not a bug.

**Why it matters:** in just one user message we eliminated the "stretch vs tile" debate that had driven multiple PRs (#116-#120, #124, #125). The answer was always "tile, period-correctly." Once stated, every visual artifact across all 7 schemes was resolvable with a single, consistent rule.

**How to apply:** when designing rendering behavior for a period-era format, the period's HARDWARE CONSTRAINTS often dictate the right answer. "QuickDraw stretching was slow" is itself a render-model constraint that excludes a whole class of options. Future-format renderer work: ask "what was performant in the era?" before "what does CSS support?"

**Process meta:** the architectural cleanup in #124 was correct (delete the heuristic stack, use one simple model) even though the specific composition was wrong. Cleanup first, then iterate on the principle. The wrong rendering principle in clean code is easier to fix than the right principle buried in a heuristic stack.

## 2026-05-19 — Three-layer architecture reset, spec A landed (#132)

After PR #130's per-segment composer (span-threshold hybrid: small spans get 1px-stretch, large spans get full-slice stretch), we hit a wall. The remaining heuristic questions — "what exactly should each cinf field do?", "when does part-1 vs part-8 win at a corner?", "is the period-faithful tile policy actually stretch or repeat?" — can't be answered from K2 documentation alone. The actual algorithm lives in 60-100KB of 68k assembly inside Kaleidoscope's kDEF resources. Disassembling that looked like a multi-week ticket at the time — it was later done (the 2.3.1 decode; see [`docs/spec/kdef231-recipe-walk.md`](./docs/spec/kdef231-recipe-walk.md) + [`docs/spec/kdef231-reference.md`](./docs/spec/kdef231-reference.md)).

The reset: rather than continuing to iterate the rendering heuristics, we split the problem into **three layered specs** that can each be written and validated independently:

- **Spec A — HTML skeleton** (this PR, #132). The DOM contract Aaron UI emits for every Kaleidoscope-supported element family: shape, state attributes, ARIA roles, declarative-promotion sentinels, programmatic API parity. 829 lines covering 11 element families + ancillary subsystems (cursors, color extraction, scheme-global Colr flags).
- **Spec B — Raster-to-skeleton mapping** (TBD). How cicn/cinf/wnd#/ppat fill the DOM defined in spec A. This is where rendering policy decisions get locked in — and where future kDEF disassembly findings will plug in.
- **Spec C — JS parser/composer** (TBD). The runtime that walks a loaded scheme and produces spec-A DOM.

**Why this order matters:** spec A is the **stable public contract**. External consumers (people building Kaleidoscope-themed web apps) only need to know A. Spec B can iterate on rendering policy without breaking A consumers. Spec C can be rewritten entirely (today's per-segment composer is one of many possible implementations) without breaking A consumers OR spec B authors.

**Process meta:** when you're cycling on the same problem (#116-#120-#124-#125-#130 all touched the same composition policy with different heuristics), the lesson isn't "try a different heuristic." It's that the problem has been mis-framed. The right move is to **split the conceptual layers** so that the load-bearing decisions land in the layer that can actually settle them — and let the higher layers commit to a stable contract.

**Application:** spec B + spec C work resumes after spec A merges. Both specs reference A's section numbers for cross-cutting elements (e.g., "checkboxes are rendered into the DOM defined in [spec-A §4]"). Treat A as load-bearing — changes to A invalidate sections of B + C, so revisions to A should be deliberate.

## 2026-05-19 — Binary archaeology session (Kaleidoscope 1.8.2 + 2.3.1)

> ⚠️ Partly superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends" (decoding kDEF 1.8.2 was the wrong engine — K2 schemes use 2.3.1). The architecture confirmations (QuickDraw/CopyBits, OS-drawn buttons, table-driven kDEF) hold; the tile-vs-stretch threshold and resize-matrix reframing here predate the 2.3.1 part-code decode that settled them.

After landing the spec-trilogy rebuild (#132-#143), we did a 4-hour focused archaeology pass on the actual Kaleidoscope binaries (1.8.2 Installer.app + 2.3.1 Installer.bin). Findings + applications:

### What got confirmed (we weren't guessing anymore)

- **Pure QuickDraw + CopyBits architecture.** kDEF 1 (PowerPC, 100KB) imports 174 InterfaceLib symbols, dominated by `CopyBits`, `CopyMask`, region operations, GWorld. NO custom blitter. Stretching = sample-and-hold via CopyBits-with-different-src/dst-sizes. **Our `image-rendering: pixelated` IS the same algorithm, not an approximation.**

- **Buttons drawn by OS, not Kaleidoscope.** kDEF 1 imports only 2 symbols from AppearanceLib: `GetMenuItemIconHandle` + `SetUpControlBackground`. The second one is the giveaway — Kaleidoscope sets up the BACKGROUND for a control before AppearanceLib + system CDEF draws the control on top. **Aaron UI's AaronButton CSS-only approach is period-correct, not a compromise.**

- **kDEF is table-driven.** Only 4 literal `_GetResource(type, id)` calls in the entire 60KB 68k kDEF. All other resource lookups use computed IDs from internal dispatch tables. Confirms spec C §11's table-driven composer model.

### What got reframed

- **§13.2 tile-vs-stretch threshold isn't a thing in Kaleidoscope.** Each segment is either stamped-at-native, stretched-via-1px-source, or tiled-via-cinf.tileSides. Our `TINY_STRETCH_THRESHOLD = 2` is a CSS-border-image artifact, not period intent. Documented in spec B §3.2 + the mapping doc.

- **15-value resize matrix is practically a 10-value matrix.** Zero anchor-* behaviors observed across all 7 bundled schemes. Behaviors 0-9 (stretch-* + repeat-*) cover 100% of corpus. The 10-14 encoding remains technically open but practically settled.

### What got built from findings

- `bgAnchor` field in chrome-element schema (#149) — surfaces the explicit pixel coords for color extraction that the cinf TMPL 129 already carries
- `extractColorsFromCicn()` helper (#149) — sampling helper that uses bgAnchor / textAnchor / embossAnchor
- Colr resource decoder (#151) — was missing entirely; populates `theme.options.stretchScrollbarThumbFromCenter` + `theme.origin.minimumKaleidoscopeVersion`
- Two re-extracted bundled themes (47 + 57 entries with new bgAnchor data)

### What's still open after the session

- **Colr bytes 5-15** (the additional flags introduced after Kaleidoscope 2.1): Unified Scroll Bar Track, Windows-style Scrollbars, etc. Their byte layout isn't in the bundled-with-scheme TMPL 128.
- **§13.1 divider sandwich semantics** (parts 5/6): not directly visible from binary surface analysis.
- **15-value resize matrix bits 10-14**: theoretically open, practically irrelevant for the corpus.

### Methodology meta-lesson

Disassembly without an interactive disassembler (Ghidra/IDA) is doable for **architectural confirmation** but not for **single-instruction tracing**. A 4-hour focused session can:
- Extract resources from a classic Mac binary
- Parse PEF symbol tables for high-level imports
- Find literal `_GetResource(type, id)` call sites
- Compare flag values across multiple schemes to triangulate semantics

It CAN'T (in the same timebox):
- Trace inner loops (e.g., the cinf parser at `kDEF 0` `0x77b4+`)
- Recover undocumented bit layouts (e.g., Colr bytes 5-15)

Net value: **moderate.** Confirmed several design decisions weren't guesses, surfaced two concrete actionable changes (bgAnchor + Colr decoder), reframed one open question. Cost: ~4 hours.

Future deeper traces should: (1) install Ghidra + load the PEF for the PowerPC kDEF (has symbol info), (2) follow specific named functions like `DrawWindow*` rather than scanning all instructions.

## 2026-05-19 — Clean-break v2 reset (the churn got too expensive)

After the spec-trilogy rebuild + the chrome composer iterations, the project had ~608 tests (540 unit + 68 e2e) and a per-PR ceremony that broke on every HTML-structure revision — while we were *still* figuring out the right structure to map Kaleidoscope chrome into. The owner called a clean break: new `v2-reset` branch, `src/` blanked to a stub, **no tests**, build up from zero. v1 stays frozen on `main`.

Preserved (the expensive stuff): the extracted theme bundles (`themes/<slug>/`, 1375 files), the docs/specs, the reference screenshots, and the `.rsrc → theme.json` decoder (relocated `src/themes/loader/` → `tools/theme-loader/` — it's archaeology tooling, not UI runtime). Dropped: the entire UI implementation + all tests.

**Lesson:** when structure is genuinely unsettled, a heavy test suite is an anchor, not a safety net — every structural experiment costs a test-rewrite tax. Reset the *implementation*, keep the *artifacts + knowledge*. The decoder/bundles/docs were the real assets; the runtime was a guess that needed redoing anyway.

## 2026-05-19 — CSS is the wrong primitive; Kaleidoscope is an imperative compositor

Slice-by-slice rebuild kept hitting walls on the titlebar "racing stripe." The reveal: the stripe is **not in the window cicn** — the cicn holds only widget glyphs + frame on plain gray; its middle is dotted "divider" columns that *mark the fill zone*. The live window replaces them by `CopyBits`-stretching a **1px-wide vertical column** horizontally (a column through a horizontal-stripe pattern looks dotted at native size; stretched, it reproduces the stripe). Confirmed empirically: stretching column x=25 of 7 Le's active-document-window reproduces the exact racing stripe.

That's why declarative CSS (border-image, gradients) kept fighting us — it has no clean "stretch a 1px slice of a bitmap" op, which is Kaleidoscope's bread and butter. **Pivot: build a pure pixel-buffer compositor** (`src/pixelBuffer.ts`) that replays the QuickDraw ops — `copyBits` with sample-and-hold — and blit the finished buffer to a `<canvas>` *behind real DOM content*. CSS does only positioning + integer upscale (`image-rendering: pixelated`). The title text rasterizes into the buffer too (single source of truth, period bitmap-font look). This is the "native compatibility runtime" — fully owned, faithful by construction.

## 2026-05-20 — Full kDEF decompilation (the prediction came true)

> ⚠️ Superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". This decompiled the **1.8.2** kDEF (the wrong engine for K2 schemes); its layout findings (the 3×3 anchor grid, the side-list-as-recipe-walk reading) were reframed by the 2.3.1 part-code jump-table decode (`kDEF231_0.asm`). The Ghidra tooling lessons (objdump-as-020, A-trap NOP-patching, defining jump tables) still apply.

The prior entry said "install Ghidra + follow named functions." Did exactly that, and it unlocked the layout logic.

**Three tooling lessons that made it work:**
1. **Objdump the 68k as `MC68020`, not `68000`.** The kDEF uses `0xff` BSR.L long branches (68020+). As `68000`, objdump mis-decodes them → control flow is garbage. As `MC68020`, every call resolves.
2. **NOP-patch the A-traps before Ghidra.** Ghidra's generic m68k decoder treats Mac A-line traps (`$Axxx` — CopyBits etc.) as illegal instructions, so every drawing function truncates at its first OS call. Replace the 1445 trap words (objdump marks them `.short 0xaXXX`) with `0x4e71` (NOP) → Ghidra decompiles through them → **198/210 functions as readable C**. You lose trap semantics but keep the integer layout math, which is what you're after.
3. **Define the embedded jump tables as data.** 14 switch tables live inline in the code; if Ghidra disassembles through them it produces bad data. Read each table's size from its `cmpi #N` bound, define as a word array.

**What the code revealed** (this was the 1.8.2 decode; the surviving, version-independent findings were later consolidated into `docs/spec/kdef231-reference.md` — both the old `kdef-layout-recipes.md` and `kdef-disassembly-findings.md` write-ups have since been retired):
- **Window frames = recipe walk.** The `wnd#` side list is a structural frame-piece segment list (proven: the Modal Dialog has no widgets yet uses the same `p1/p8` codes). Fixed segments copy 1:1; grow segments (codes 5/6/8) stretch. Widgets are baked into the cicn; the recipe edge-anchors them as the window grows.
- **Part positioning = a 3×3 anchor grid + center** (`0x35b0`), per-part offsets (`@44` anchor mode, `@46/@48` offsets, `@50` title sub-anchor). This is the Appearance-Manager model — close→left, zoom/shade→right, grow box→bottom-right. My left-to-right layout was the wrong model; that's what "felt hacked."
- **Buttons = 3 state cicns (`-10240/-10239/-10238`) 9-sliced** into the rect. **Scrollbars = orientation × 4-state cicn selection** (`-8286…` horiz / `-8278…` vert), 1px track stretch, value-positioned thumb.

**Methodology reversal from the prior entry:** with the right tooling (objdump-as-020 + A-trap NOP + table-defining + Ghidra), single-instruction tracing of named drawers IS feasible in a session — the opposite of the "can't trace inner loops in the timebox" conclusion. The blocker was never the difficulty; it was using `objdump` linear-sweep alone without a decompiler.

## 2026-05-20 — Resolve controls by RESOURCE ID, never by bundle slug

Scrollbars/sliders/progress rendered only for 7 Le; every other scheme showed black bars or nothing. Root cause: the composers looked elements up by human-readable bundle key, and those keys are **not** stable — the same Kaleidoscope resource is named "normal-horizontal-scrollbar" (7 Le) / "horizontal-scrollbar-active" (acid, 1990) / "horizontal-scroll-bar-track-arrows" (1138). The **resource id is the authoritative selector** (it's what the kDEF switches on), and it's preserved in every asset filename as `cicn-n8286-…`. Match on `abs(id)` → works for all themes. Lesson: any drop-in compatibility layer must key off the spec's ids, treating bundle slugs as decoration.

**Two scrollbar cicn FORMATS, told apart by aspect ratio:** wide composite (48×16 etc.) bakes the arrow boxes into the two ends → 3-slice along the long axis, do NOT stamp arrows. Square cell (7 Le 16×16) has no arrows (OS draws them) → stretch one interior slice. The "arrow cicns" I almost stamped (`-10111` "normal-right-point-arrow") are actually the **disclosure-triangle** resource range (`-10102..-10112`) — a bundle mislabel; the real scroll arrows are inside the composite.

**Two gotchas that look like missing assets but aren't:**
- Button faces carry a 1px text-color **marker** at the center (same idea as the window-title marker). 9-slicing stretches it into a cross through the label. Sample a clean pixel at the slice inset for both fill + fg-contrast; the center pixel also lies about contrast (acid's marker is light on a black face → forced invisible black text).
- Progress **frame** interiors differ: 1990's is transparent, big-blue's is opaque white. Draw track → frame → fill so the fill always lands on top regardless. Measure the frame border from the cicn (alpha drop-out), with an opaque-interior fallback.

**Grow regions TILE, they don't stretch.** The recipe walk was sample-and-hold *stretching* each grow segment, which smears a multi-px titlebar pinstripe/motif into bands. The period doc says "stretch the single row/column," and for a 1px column tile == stretch — but real schemes have multi-px grow zones (7 Le 10px dotted motif, evolution 4px coil, 1138 56px panels, big-blue 12px). Coalesce the contiguous grow sub-segments (the recipe fragments one zone into several 1–3px part-5/6/8 pieces) and **tile** the block at 1:1. Crisp repetition across every theme; 1px-pinstripe schemes unaffected. Determinate progress fill is the opposite — 3-slice (caps + stretched middle), NOT tile, or the section repeats into chevrons.

## 2026-05-20 — Platinum is procedural; the title rides the grow zone

> ⚠️ Partly superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". The title-positioning mechanics here derive from the 1.8.2 decode (the `0x35b0` 3×3 anchor grid + grow-zone reasoning); v3 sizes the title plate from the measured title width per the 2.3.1 decode. The "no sourceable Platinum / Platinum is procedural" and "resolve-by-resource-id, not slug" findings still hold.

**There is no sourceable Platinum scheme.** Proven three ways: the Mac OS 8.5 AND 8.6 System files draw windows/controls with `WDEF`/`CDEF` *code* (parsed their resource forks via `hfsutils` + MacBinary: 13 WDEF, 33 CDEF, zero `wnd#`/`thme`, no window-range cicns); and all four "Platinum" Kaleidoscope schemes (Apple Platinum 2, Black/Carl's/Chiper's) score 6–7/12 on `scripts/check-completeness.mjs` — **none ships a window frame `wnd#`**, by design (they defer windows + standard controls to the OS). So the Platinum baseline MUST be procedural (`src/platinum.ts`) — reimplementing the CDEFs in gray. It only fills gaps: a scheme's own cicns win (resolve-by-id); apple-platinum-2 ships scrollbars/buttons but needs procedural checkbox/radio/slider.

**The window title rides the grow/fill zone, not the full width.** Per *Creating Color Schemes* + decompiled `0x35b0`: the kDEF stretches the titlebar fill "to make room for the title" and centers the title in that grow zone — so it's offset per-theme past the baked widget clusters (BeOS tab, 1990 offset box, all fall out of one rule). `composeEdgeFromRecipe` now returns the top grow-zone output span → `composeWindowChrome.titleRegion` → `renderWindow` centers there. Title text height is ~Chicago 12 capped (NOT `frame.top * x`, which blew up + clipped on thick frames → "Options"→"tio"); erase band is text-sized + vertically centered (chrome keeps repeating around it). Open: the horizontal sub-anchor `@50` (center vs left within the zone) isn't in the `wnd#` we decode.

**resolve-by-RESOURCE-ID, not by slug** is the load-bearing pattern for everything (scrollbar -8286/-8278, button -10239, checkbox -9500, etc.) — bundle slugs are inconsistent/absent across schemes and even mislabel state (the scrollbar pressed/disabled slugs disagree with the decompiled kDEF `FUN_000066b4`; trust the id table from the code).

## 2026-05-21 — Per-edge tile-vs-stretch, single-cell Platinum scrollbars, scheme icons

> ⚠️ Partly superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". Per-edge tile-vs-stretch is decided by the part code (the default blit always tiles), not a per-edge `tileMotif` flag or a uniformity sample; the title-plate "clean column via luminance-variance + saturation" pick is a uniformity heuristic the part-code model retired. (The resolve-by-resource-id and scheme-icon `icl4` findings still hold.)

**The grow zone TILES on the top edge but STRETCHES on the sides/bottom.** The "grow regions tile" finding (2026-05-20) is right for the titlebar pinstripe but wrong for the side frames: BeOS's left/right fill is a 5px slice that, tiled down the window, repeats its notch into evenly-spaced "railroad-tie" ticks. Per *Creating Color Schemes* §8.1 the sides "stretch the single row/column between the grow regions." So `composeEdgeFromRecipe` now takes a `tileMotif` flag — `true` for the top (keep motif tiling), `false` for sides+bottom (sample one mid-line and sample-and-hold it to a uniform border). Among the displayed corpus only BeOS has multi-px side fills, so the change is otherwise invisible.

**Some edges ship no grow code at all.** BeOS's bottom recipe is `0 1 18 1` — no part 5/6/8, so nothing stretched and the bottom border stopped at its native ~80px while the window was ~260px wide (the "bottom not full-width" artifact). Fallback: when an edge has no fill segment but must absorb extra length, designate its widest interior (non-corner) segment as the stretch zone; trailing caps (the resize box) stay anchored to their end.

**Platinum single-cell scrollbar = an arrow-BUTTON face, not a track.** Refines the prior "square 16×16 cell = no arrows, OS draws them" note. apple-platinum-2's `-8286/-8278` is a 16×16 bevelled gray *arrow-button face* with NO baked glyph (the thumb is a separate `-10206/-10208` "ghost-thumb"). The faithful Platinum layout: stamp the face at both ends as the two arrow buttons, stretch its interior for the track between, and draw the arrow glyph procedurally (a new `drawArrowGlyph`). That's the "no left scroll arrow" report — there was no arrow because Platinum leaves the glyph to the CDEF.

**Scheme icons: decode `icl4` (4-bit), not `icl8`.** Schemes ship their custom Finder icons as full icon families (`icl8`/`icl4`/`ICN#` 32px + `ics8`/`ics4`/`ics#` 16px). Decode the **4-bit** variants against Apple's fixed 16-colour palette — exact and embeddable — because 8-bit needs the system 256-colour clut, which schemes don't embed. Alpha comes from the matching 1-bit mask resource (`ICN#`/`ics#`, same id, second bitmap half). `scripts/extract-icons.mjs` writes `themes/<slug>/icons/*.png` + `index.json` (kept separate from extract-scheme.mjs so it never churns the cicn/ppat PNGs). Pick "object" icons for scene content by opaque-coverage (<0.95 skips full-bleed scheme logos like the globe / "1984" wordmark). 1990 ships zero icons → SVG-folder fallback.

**Resolve the grow box by id too:** active `-14333` (apple-platinum-2 uses `-14330`), inactive `-14334`. And a stray bug: `platinum.ts arrow()` drew its tip on the wrong side (a 'right' arrow pointed left), inverting both the disclosure triangles and the platinumScrollbar buttons — the tip is at loop index `i=n`, so the per-direction sign has to put `i=n` on the named side.

**Title background = the stretched fill PLATE, not a solid erase box (and not a fixed slice number).** The title region (recipe codes 5/6) holds the title PLATE *plus* decorations — 1138's central pyramid, 1990's coloured LED dots — so a fixed "use slice 5/6" pick lands on the decoration. The plate is the CLEAN column: lowest luminance variance + lowest saturation across the title-region segment centres. `composeEdgeFromRecipe` scores each and exposes the winner as `titleFillSrcX`; `renderWindow` lays that one cicn column across the title band (= the plate stretched to the title width) and draws the glyphs transparently on top. This replaced a solid `fillRect` in the declared header-fill colour, which clashed with the bar (1138's mid-grey box on a light bar). Verified clean on 1138 (light), 1990 (dark, LEDs now beside not behind), 1984 (blue), evolution, beos.

**The title plate GROWS to the title width (geometry), it isn't a band painted over static chrome.** The kDEF inserts the title's width at the title seam, so `renderWindow` rasterizes the title first and passes the plate width to `composeWindowChrome`; the plate segment (the clean title-region column from the variance+saturation metric) is kept STANDALONE through coalescing and absorbs `titleWidth − native` of the window growth, with the remainder distributed to the other fill. Decorations within the title region (1138's pyramid, 1990's LED dots, 1984/beos widgets) get pushed aside as the plate widens — instead of the title overlapping a fixed-size space. Title text then draws transparently on the stretched plate (no erase box, no re-tiled band). Utility/mini/floating windows render label-free (modern convention) with the title on `aria-label` + `role=dialog` only — both the cicn and baseline (no-wnd#) paths.

## 2026-05-21 — The missing gap: a segment's SIZE DRIVER (recipe + bitmap + content, not recipe alone)

> ⚠️ Partly superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". The "plate vs decoration lives in the PIXELS" clean-column (variance/saturation) classification is a uniformity heuristic the part-code model retired — the part code decides behaviour. The content-driven title-plate insight (the plate grows to the measured title width) does carry into v3.

We finally cracked the repeating/growing titlebar background. The thing that
made it hard for so long is worth stating sharply, because it generalises to
all the other geometry (tabs, list rows, progress fills, scrollbar tracks).

**What the data gave us:** the `wnd#` recipe encodes WHERE each segment sits
(`at` offsets) and a coarse ROLE code (corner / widget / fill 5·6·8). The K2
Reference (architecture-spec §3–4) adds the semantics: `5/6` = the `(6)(5)(6)`
"divider sandwich" around the title pill; `8` = universal stretch fill; default
behaviour is **stretch the cicn slice across the segment's rendered width**;
fastest is a **1-pixel stretch region** (stretch one clean pixel's colour).

**The gap — three things none of that encodes:**

1. **A segment's SIZE DRIVER.** "Stretch across the rendered width" never says
   what sets the rendered width. Two drivers exist, both called "stretch":
   *window-driven* (side fill `p8` absorbs leftover window width) and
   *content-driven* (the title PLATE grows by the rasterized **title** width —
   a size from outside the recipe AND outside the window dims). The original
   error: lumping the title region into the window-driven fill (one proportional
   distribution across all `5/6/8`). The plate is content-driven — the kDEF
   inserts the title's width at the title seam, decorations shift right.
   So `renderWindow` rasterizes the title FIRST and feeds its width back into
   `composeWindowChrome` as `plateWidth`. Composition is title-aware; it isn't a
   compose-then-overlay two-pass.

2. **Plate vs. decoration lives in the PIXELS, not the code.** 1138's clean
   plate and 1990's LED dots share a fill code; the recipe can't tell them
   apart. The plate is the clean column (min `stddev(luminance)+mean(saturation)`)
   — which turns out to BE the K2 "1-pixel stretch region" the author
   designated, recovered from the bitmap because we don't have their annotation.
   Real schemes embed decorations inside the title zone that the idealized
   "stretch the slice" model smears; the clean-column score skips them.

3. **Coalescing fill was actively harmful.** Merging adjacent `5/6/8` into one
   block (done for side-fill motif tiling) destroyed the sandwich and merged
   plate + decoration + side-fill. The plate must stay standalone to grow alone.

**The generalised model:** layout = **recipe position + bitmap classification +
content-driven sizing**. Every region has a *size driver* — fixed /
fill-container / grow-to-content / repeat-per-item — and you cannot read the
driver off the part code. When a control "repeats/grows for some layouts but not
others," it's this distinction. The recipe is necessary but not sufficient; the
answer needs the recipe AND the pixels AND the content size.

## 2026-05-21 — Detect, don't override: the fill-code set + mini-window resolution

> ⚠️ Partly superseded by the v3 part-code compositor (2026-05-22). See docs/history.md → "Dead ends". The `code ≥ 5` fill set, the widget-carving (clean-background-over-rect) + second stamping pass, and the `{5,6,8,18}` set are all retired: v3 classifies each cell by the 2.3.1 jump table, corners are intrinsic, and widgets ride the fixed cells they sit in (no carve/stamp pass). The mini/utility-window "resolve by chrome cicn asset name, not type key" finding still holds.

Two more "general detection, not per-theme overrides" wins, both from reading
the K2 vocabulary instead of hand-patching.

**Windows render in TWO passes; the stretch set is the full K2 `code ≥ 5`.**
(Supersedes an earlier `{5,6,8,18}` workaround.) The kDEF draws a window frame
in two passes: **(1)** stretch/tile the background from the side recipes, **(2)**
stamp the rectList widgets (close/zoom/collapse boxes) at native size on top.
We had only pass 1 — walking the recipe and reading widget art inline from the
cicn — so a fill segment carrying a baked widget either *tiled it into
duplicates* (1138 doc window's zoom cluster sits inside the `p8` side fill → two
copies) or, with the `{5,6,8,18}` workaround, forced widget-bearing codes
(10/11/15/17) to stay fixed and stopped backgrounds stretching. Now
`composeWindowChrome`: runs `isFillPart = code ≥ 5` (full K2); in the recipe
walk a fill segment overlapping a **rectList widget rect** renders CLEAN
background (the fill column, not its own art) so the baked widget isn't
tiled/smeared; records each segment's native→output placement; then pass 2
stamps each top-band widget once at its growth-mapped position. Code 18 is still
the GRADIENT part (`isGradientPart`: sample-and-hold scale, not tile/flatten).
**Meta-lesson: a documented spec rule ("everything ≥5 is stretch") was right
about the FORMAT but failed in our PIPELINE until we matched the kDEF's pass
structure — the fix was to add the missing pass, not to narrow the rule.**

**Mini/utility windows: resolve by the CHROME CICN ASSET NAME, not the type
key.** The Options dialog was rendering with the document window's edges. Cause:
`resolveWindowType`'s utility branch matched friendly type keys
(`titled-utility-window`) + a few hard-coded ids, but schemes key these
inconsistently — 1990/evolution use raw `wnd--14296`/`wnd--14304` — so they fell
through to `document-window`. Fix: score every window type by its chrome cicn
asset name (`/titled-utility/` > `/utility/` > `/floating/`), require it to ship
its OWN top recipe (else it can't be a distinct mini frame) AND a renderable
active chrome (beos's `titled-utility` is recipe-only with no active cicn → use
its `no-title-utility` / side-utility cicn instead), skip `collapsed` variants.
General lesson: window-type KEYS are unreliable across schemes; the cicn ASSET
NAME (and resource id) is the stable selector — same principle as resolving
controls by resource id, not slug.

## 2026-05-21 — Diagnostic tooling: the placement map as the single source of truth

To debug rendering in absolute terms (not by eyeballing screenshots), the
compositor now records a **placement map** (`ComposedChrome.placement`): for
every slice it draws — recipe segment or stamped widget — the cicn SOURCE rect,
the render MODE (fixed/stretch/tile/gradient/clean/plate/stamp), the part
code/role, and the OUTPUT rect(s) (one per tile). One data structure powers
three tools: (1) the demo **slice inspector** — forward (click a slice → its
usages light up) AND inverse (hover a pixel → name its slice); (2) a headless
**render CLI** (`diag:render`) that runs the real `composeWindowChrome` in Node
(via a minimal PNG decoder + `new PixelBuffer(w,h,rgba)`) and dumps PNG + JSON;
(3) a headless **audit** (`diag:audit`) that checks placement invariants
(coverage / code→mode / widget-stamping / mega-tile) and prints warnings as
`theme · window · edge · slice`, exit-coded for CI.

**The audit immediately paid for itself**: it found a real demo-theme bug (beos
document-window's top-right gap) that screenshots had missed, and pinned it to a
cause (recipe extent < cicn width → undrawn far corner; plus beos's trailing
transparent cicn padding overstating `frame.right`). Lesson: once the renderer
exposes WHY each output pixel looks the way it does (provenance), regressions
become greppable instead of visual — and the compositor's own invariants become
testable without a browser.

---

### 2026-05-25 — Titles, the default-button ring, and the all-rasters inspector: the corpus ships more than we render

A run of fidelity work on the Platinum/default controls, tied together by one
recurring lesson: **before drawing anything procedurally, check what the scheme
actually ships.** It paid off three times in a row.

**Window titles now render in a real Charcoal.** The `mac-fonts-todo` gap (titles in
bold-sans fallback) is closed for window titles: two license-clean Charcoal faces are
bundled — Jeremy Sachs' CC BY-SA **Charcoal 12** bitmap (primary; crisp only at its
grid-native 16px, so pinned there with zero tracking + an integer baseline, then
upscaled pixelated) and Marty Pfeiffer's free **Virtue** (the `@font-face` fallback +
UI-label font; itself descended from Greg Landweber's Aaron/Kaleidoscope Charcoal).
`local('Charcoal')` is still preferred when installed. Control labels + the
`textRaster` pixel path still use the platform fallback — the remaining gap.

**Title VERTICAL placement is in the scheme, not a constant.** Titles sat too high on
tall ornate bars (evolution) while flat bars (1138) were fine. The fix wasn't a magic
offset: the scheme's title-text MARKER — the ≤2px-wide line the kDEF samples for the
title colour (`0x5530`) — is drawn AT the title, so its y-span IS the text's vertical
band. `composeChrome` exposes its centre as `titleRegion.midY`; `renderWindow` anchors
there (else `frame.top/2`). The same marker whose *colour* we couldn't pin turned out
to be the faithful signal for *placement*. Guarded by a `title` rule in `lint:themes`.

**The default-button ring is SHIPPED ART, not procedural.** The OK button's ring
looked flat/missing; instinct said "draw it procedurally with some depth." Wrong:
every Platinum scheme ships it as cicn **-10231/-10232** with the bevel baked in
(system7-nostalgia-silver even names them). The bug was in `composeButton` — the ring
outset was `(ring.width - face.width)/2`, which is 0 when ring and face are both the
16px control template, collapsing the ring into a 2px band. apple-platinum-2's ring is
a solid indigo frame, not a gray ring — and that's CORRECT (its own reference shows a
purple ring), so we render whatever -10231 ships.

**The "All rasters" inspector makes the question greppable.** cicns (the bulk) + ppats
had no manifest, so the browser couldn't enumerate them — only icons did.
`scripts/index-rasters.mjs` writes a per-theme `rasters.json` (wired into
`build:themes`), and a demo foldout dumps every cicn/icon/ppat with click-to-copy. It
immediately surfaced shipped-but-unused art (menu-highlight cicns, colored progress
bars, thumbs, finder-header) — the next coverage pass.

**Application:** when a control/chrome element "needs depth/texture we'd have to
draw," open the All-rasters foldout (or grep the bundle) for a shipped cicn FIRST — the
corpus almost always carries it; procedural is the fallback, not the default. When
placement looks off, look for a scheme-provided marker/anchor before reaching for a
constant. See `docs/spec/compositor-spec.md` (Title TEXT + plate), the `title` /
control-coverage rules in `scripts/lint-themes.mjs`, and `docs/tracking/mac-fonts-todo.md`.

## 2026-05-26 — Palette sourcing, geometry-from-the-decode, and the faithfulness punch-list

A few days of corner-sprite/icon/geometry work. The reusable lessons, apart from the per-bug
detail in `docs/geometry-refactor-todo.md`:

**The 8-bit icons looked "too dark" — and the decode wasn't the problem, the palette SOURCE was.**
I'd asserted the icon decode was correct and blamed gamma. The owner pushed back ("that didn't fix
the darkness — where did we source?") and was right. Two real issues, neither in the decode logic:
(1) the 256-colour palette was **mis-sourced** — we'd grabbed clut **9** (entry 0 is ~50% gray) and
oversaturated it dividing by `0x7fff`; the fix was reconstructing the **canonical Apple clut 8** (the
6×6×6 cube + four 10-step ramps) from first principles. (2) Mac used a deeper display gamma (1.8) than
sRGB (2.2). LESSON: when colours look wrong, suspect the **palette resource you sourced** and the
**gamma** before the decode loop — and when someone says "that didn't fix it," believe them and
re-check the source instead of re-asserting the code is right.

**Gamma is a BAKE-TIME display transform, not part of the decoders.** Mac 1.8 → sRGB 2.2 is applied
when writing PNGs (`extract-scheme`/`extract-icons`), NOT inside the cicn/clut decoders — because the
lint and resource-role tooling need the RAW bytes. Keep display correction at the I/O edge.

**Prefer the highest bit-depth a scheme ships; key out maskless icons.** Schemes carry icl4+icl8 /
ics4+ics8 for the same id — extract ALL depths (full gallery inventory) but render the highest
(icl8 over icl4) for richer colour. Maskless 8-bit icons were rendering as opaque white boxes; they
need their background colour-keyed to transparent.

**Window geometry is DATA sourced from the decode — a font RECREATION is not a valid metric source.**
Unified the per-window-type recipe (widget positions, bar heights) into one shared data source (was
duplicated + drifting between the runtime and the generator). Title-bar height is **font-derived**
(ascent + descent + offset) from the decode, NOT measured off our Charcoal *recreation* woff (which
renders ~9px@12pt and would be a wrong source). Source geometry from the binary/decode, never from a
proxy artifact.

**The faithfulness punch-list trap: most "glitches" were faithful.** A long sweep of suspected
rendering bugs — the platinum-8 pinstripe "glitch," apple-platinum-2 fidelity, the 1138 inset border,
the title-bar-top crop, missing icon "shades" — each resolved to **"this matches the original"** or
**"the decode is correct; it's the recreation-art ceiling,"** not a compositor bug. LESSON: before
patching the compositor to fix a "glitch," check the **reference image / the original** FIRST; reactive
fixes to faithful output are wasted and risk introducing un-faithfulness. Record each finding
("faithful, no patch") so it isn't relitigated.

**Built-then-reverted: don't generate what the corpus already ships.** A data-driven Platinum control
generator (push button / ring / scrollbar from a spec + drawer) was built — elegant — then reverted
because the scheme's **real shipped control art** is more faithful. Echoes the all-rasters lesson:
procedural is the fallback; ship the corpus's own pixels when it has them. (Decode work confirmed the
unbuildable part — Platinum control pixels live in AppearanceLib, a PPC PEF — so the procedural path
stays a calibrated FALLBACK, not the source of truth.)

## 2026-05-27 — Drop a real `.sit` in the browser: the StuffIt→WASM port and its gotchas

The whole drag-and-drop vision shipped: drop a Kaleidoscope theme (`.sit`, `.hqx`, MacBinary,
AppleDouble, or raw `.rsrc`) onto the demo and it decodes + renders **entirely client-side** — no
server, no build. The conversion core (`tools/theme-loader/convert.js`) stayed pure; the browser
shell (`loadKaleidoscopeScheme`) runs it and emits OffscreenCanvas blob-URL assets. Container
unwrappers (`containers.js`) are pure JS; StuffIt is a separate MIT artifact, `tools/sit-wasm/`
(munbox C lib → WASM). Design/status: `docs/superpowers/specs/2026-05-27-browser-conversion-design.md`;
remaining work (since completed and archived): `docs/archive/byo-theme-todo.md`.

**The 64 KB WASM stack overflow — "works native, breaks in WASM."** The single biggest time-sink.
munbox decoded our `.sit` perfectly when compiled natively, but the *same source* compiled to
wasm32 mis-decoded (garbage `num_files`, corrupted `archive_data`) and sometimes trapped. Cause:
the default Emscripten stack is **64 KB**, and a single 64 KB stack buffer in our shim (plus
munbox's own decoder frames) overflowed it, silently clobbering the heap. Native has an 8 MB
stack, so it never showed. **Optimization level was a RED HERRING** (failed at `-O0`/`-O1`/`-O2`/
`-Os`); **AddressSanitizer MASKED it** (its redzones/relocation made the one passing build, which
sent me chasing "UB under -O2"). `-sSAFE_HEAP=1` named it instantly: "stack overflow… set SP…".
Fix: small stack buffers + `-sSTACK_SIZE=5MB`. Lesson: for a "works native / breaks WASM" memory
bug, reach for **SAFE_HEAP first** (it pinpoints the faulting access); don't trust ASan's silence
or blame the optimizer; and remember WASM's stack is tiny — no multi-KB stack arrays.

**Validate the candidate against a REAL file before committing — "young/unproven" is concrete.**
Research (a background agent) picked munbox: MIT, right methods (0/1/2/13/15), emits resource
forks, WASM-portable. All true. But a native validation run against our actual `.sit` immediately
found a real bug: classic-SIT **folder markers were counted against `num_files`**, so a single file
nested in a folder (which is *every* Kaleidoscope `.sit`) extracted **nothing** while reporting
success. A second bug surfaced on a SIT5 archive: the iterator **over-runs the last entry** and
returns an error instead of clean end-of-archive. Both are tiny, both are now patched/worked-around
(`tools/sit-wasm/munbox/PATCHES.md`, and a shim "keep what decoded before a trailing error"). The
research verdict was right *and* the library needed fixing — only a real fixture showed which.

**Debug native-first, then WASM.** Reproducing in a 40-line native `clang` harness (same source)
proved the bug was WASM-specific and gave a fast edit/run loop, before fighting the WASM toolchain.

**Multi-file archives: pick the LARGEST resource fork, not the first.** A real scheme ships in a
folder alongside a custom-folder-icon file (`Icon\r`) and a ReadMe, each with its own little
resource fork. `stuffItResourceFork` returning the *first* fork gave the 7 KB folder icon, not the
119 KB scheme. Largest-non-`Icon` is the robust heuristic for the corpus.

**Two tiers of "validated."** Method 13 (classic) we proved **byte-identical** to the committed
corpus fork — the gold standard. Method 15 (SIT5/Arsenic BWT) we only proved **decodes to a
structurally valid theme** (6 window types, 161 cicn assets) because we have no method-15 corpus
fixture. Keep the distinction explicit; a structurally-valid pass is "didn't crash + parses," not
"bit-exact."

**Ship the build output, not the toolchain.** `dist/munbox.{mjs,wasm}` is committed (a `.gitignore`
negation past the blanket `dist/` rule), so consumers never need Emscripten — only rebuilding does.
The lazy `import('../sit-wasm/…')` in the loader keeps WASM out of the pure conversion core until a
`.sit` is actually dropped.

**Application:** when porting a C lib to WASM and it "works native, breaks in WASM," suspect the
stack (default 64 KB) and use `-sSAFE_HEAP=1` before ASan or the optimizer. Always validate a
chosen decoder against a real corpus file, not just its README. Reproduce native-first. For
multi-fork Mac archives, the scheme is the largest non-`Icon` resource fork.

## 2026-05-27 — One core / two shells, and docs that drifted within a day

Meta-lessons from the same thread, worth remembering apart from the StuffIt specifics.

**One conversion core, two shells, gated by byte-identity.** `tools/theme-loader/convert.js` is
PURE (no fs/zlib/canvas) and is called by BOTH the Node extractors (`extract-scheme`/`extract-icons`,
which add a PNG-encode shell) and the browser `loadKaleidoscopeScheme` (which adds an OffscreenCanvas
blob-URL shell). That ended a two-implementation drift (the browser path previously skipped gamma /
headerColors / icons that the Node path did). The safety net for extracting the core was a
**byte-identity gate**: re-run the extractors and `git diff` must be empty across all bundles (modulo
the `extractedAt` timestamp). A `convert.test.mjs` asserts `convertScheme(fork)` deep-equals the
committed `theme.json` + `icons/index.json`. That gate let us move ~hundreds of lines with confidence
and is the thing that makes the browser path trustworthy without re-validating every theme by eye.

**Layer separation paid off immediately, not "someday."** Because the core had no platform deps, the
browser drop-a-fork feature was a *thin* shell (RGBA → blob URL) + a one-line `assetUrl` passthrough
in `src/loadTheme.ts` (absolute `blob:`/`http(s):`/`data:` refs pass through; relative ones still
resolve to `baseUrl`). The seam — the `theme.json`/`ThemeManifest` contract — is what made "drop a
theme in the browser" a small change instead of a second renderer.

**Specs/comments drift within a DAY of writing them.** A 3-persona review (developer advocate /
technical writer / user advocate) found three docs/comments contradicting code shipped *hours*
earlier: `containers.js` still said ".sit not supported," the sit-decoder spike was frozen at
"plan / emsdk not installed," and ADR-0001 Decision 4 still said "no clean JS decompressor; don't
promise drop-any-download." Staleness isn't a six-months-later problem. Lesson: when you write a
design/spec doc *before* finishing the implementation, schedule a reconciliation pass when it lands.
The multi-persona review was a cheap, effective catch — and **convergence was the signal**: all three
independently flagged the same top gap (a converted theme renders but can't be saved — the
preview-only dead-end). Review findings were filed as tracked work in
`docs/archive/byo-theme-todo.md` (the to-do list, since completed and archived 2026-05-30).

**Application:** keep one portable core + thin platform shells, and gate any core refactor on a
byte-identity diff. After shipping a feature you spec'd earlier the same day, grep the spec/comments
you wrote for now-false claims. When you want a fresh-eyes audit, a few role-specific review passes
(adopter / reader / end-user) surface non-overlapping issues; treat the points where they agree as
the priorities.

## 2026-05-28 — Consumption-layer front door SHIPPED: `data-aaron-*` from spec to live demos in two nights

ADR-0001 Decision 3 (imperative + declarative front door) shipped to `main` in
commits `2e22d48` … `bca005e` (2026-05-27/28). The North Star "drop a data-
attribute on a div → it becomes a Mac window" is now real and validated on
realistic third-party pages. Two demos exercise it: `demo/declarative.html`
(Mac OS 8.6 desktop — menu bar, Welcome modal, Read Me, Inspector with theme-
switcher, Tools palette, Notepad, Trash) and `demo/declarative-site.html` (a
"Kaleidoscope fan page" — article, guestbook form, link list, image gallery —
where the only addition to the HTML is a few `data-aaron-window` attributes
and one bootstrap line).

**Framework-agnostic-via-data-attributes is a real architecture.** No React
peer dep, no Vue plugin, no Solid wrapper. A single `mountDeclarative({})` call
drives a `MutationObserver`-backed scanner that promotes `[data-aaron-window]`,
`[data-aaron-button]`, and `[data-aaron-control]` (the opt-in `<input
type=checkbox|radio|range>` skinner). Window children move into `.aw-content >
.aw-slot > .aw-fit` as live LIGHT-DOM children (kept light-DOM deliberately —
host CSS still reaches its own content; the chrome is canvas in the same tree).
Lesson confirmed: the data-attribute surface is enough for the canonical use
case ("skin an existing site"), and it kept the runtime + the declarative layer
cleanly separable — `src/declarative/` imports the runtime; the runtime knows
nothing about it.

**Scope-guard the OPT-IN, not the surface.** ADR-0001 Decision 4 ruled out
native form-control reskinning. The shipped reality is more nuanced: native
`<input type=checkbox|radio|range>` IS themed, but only when the consumer adds
`data-aaron-control` (or the page-wide `mountDeclarative` includes them by
default). The native input stays in the DOM (a11y, screen readers, keyboard);
a `<span class="aw-button">` overlay paints the chrome and forwards events.
That's a faithful read of "themes window CHROME + OPT-IN controls" — the scope
guard moved from "no native form-control theming at all" to "no IMPLICIT
theming," which is the spirit of the rule with the right ergonomic.

**Defensive guards against your own inheritance chain are a smell.** The
runtime had explicit `loadByIdSelf` / `loadGlyphByIdSelf` /
`composeCheckable`-self-only variants in `src/controls.ts` whose entire job was
to PREVENT the universal base (`apple-platinum-replica`) from polluting corner-
sprite schemes via the base chain. When you have to write code to stop your
inheritance from working, your inheritance is fighting you. That signal —
combined with the replica's `PROVENANCE.md` explicitly flagging its sliced real-
Mac-OS-8-screenshot pixels for "revisit before any redistribution" — was the
prompt to retire it (see next entry).

**Working-tree commit sweep beat the "auto-commit my changes" surprise.** A
concurrent session committed my doc edits along with its feature commit
(`bca005e`), which was helpful but caught me off guard. Lesson: when working
on a fast-moving prototype-mode branch, `git status` is a SNAPSHOT, not a
contract — re-check before claiming "the working tree is clean / dirty."

**Application:** when shipping a North-Star-defining feature, write its
architectural decisions back into the ADR the same day, not when you remember
to. When two sources of truth disagree about a bundle's licensing posture
(`theme.json` origin string vs `PROVENANCE.md`), trust the PROVENANCE prose and
fix the JSON. When designing a scope guard, attach it to the OPT-IN surface
(an attribute), not a blanket prohibition.

## 2026-05-28 — `apple-platinum-replica` retired: the universal base was carrying real Apple bitmaps

The generated "universal base" theme `apple-platinum-replica` is retired. Why:
its `PROVENANCE.md` was unambiguous (the cicns "embed real Mac OS 8 screenshot
pixels … revisit before any redistribution"), its `theme.json` origin string
disagreed ("no Apple bitmaps shipped" — wrong), and the recent declarative
layer was using it as the DEFAULT base for `mountDeclarative()` — meaning every
consumer of Aaron UI's primary integration surface was inheriting it by
default. Post-ics4-wiring (2026-05-26), the corner-sprite schemes ship their
own checkbox/radio/widget glyphs; `src/platinum.ts` already had procedural
fallbacks for every control kind; the replica's unique remaining supply was a
slider cicn fallback and `wnd#` recipes for unmapped window types — none of
which justified the licensing exposure.

**The cleanup:** 118 files changed, **8922 deletions / 53 insertions**. Deleted
`themes/apple-platinum-replica/` (~1MB of sliced Apple bitmaps + sources), the
whole `scripts/generate-platinum/` toolchain (the slicer + 6 test files),
`scripts/generate-platinum.mjs`. Dropped the base-chain wiring from
`src/declarative/theme.ts` + `scanner.ts` (default `baseSlug` now undefined —
themes load standalone, missing chrome falls through to procedural Platinum in
`platinum.ts`). Updated `demo/index.html` (`loadWithBase` rewired to call
`loadTheme` without a base), `demo/declarative.html` (page-theme default
swapped to `apple-platinum-2`), `demo/declarative-site.html` (replica dropped
from the theme-switcher), `demo/themes-manifest.json` (regenerated). All 9
remaining themes render correctly post-removal; `npm run typecheck` clean, `npm
test` 20/20 (was 46 — the 26 deleted tests covered the deleted generator),
`npm run lint:themes` 100 windows / 0 errors / 0 warnings.

**The architectural lesson is bigger than the licensing one.** A "universal
base" that has to be opted OUT of (via `loadByIdSelf` style guards) is
upside-down inheritance. The cleaner pattern: themes are self-sufficient or
explicitly declare a base; the runtime has procedural fallbacks for the cases
no theme handles. After this change there is no shared "Platinum baseline" any
scheme inherits silently — and the corpus still renders identically.

**The two-sources-of-truth disagreement is its own bug class.** A `PROVENANCE.md`
saying "real Apple pixels, revisit before redistribution" and a `theme.json`
saying "clean-room reproduction, no Apple bitmaps" had coexisted for weeks. The
runtime reads the JSON; the human reads the markdown. Anyone checking
distribution rights via the JSON would get the wrong answer. Lesson: when human-
readable and machine-readable provenance disagree, the human one is almost
always right (it's harder to copy-paste and forget to update); fix the JSON, do
not "reconcile" by softening the prose.

**Application:** before defaulting a downstream consumer to inherit from a
bundled artifact, audit that artifact's `PROVENANCE.md` not just its `meta.json`
or `theme.json`. When you find yourself writing code to defend against your own
inheritance chain, treat that as evidence the inheritance is wrong-shaped — fix
the architecture, not the symptom. Universal-base inheritance is a Norman-door
in disguise: cheap to add, expensive to take back.

## 2026-05-28 — Docs/memory cut-through: ADR-0001 + PRD + 8 memories reconciled

A focused review pass + cut-through covering the post-declarative-ship state.

**ADR-0001** went `Proposed` → `Partially Accepted`. The 2026-05-26 update's
"Confirmed still absent: any `data-aaron-*` scanner, MutationObserver,
customElements, AaronWindow, ResizeObserver, or emitted CSS" was flipped
overnight by the declarative ship; left in place with a strikethrough +
supersession note so the historical record survives. A new 2026-05-28 update
section enumerates what shipped (Decision 3 + the partial Decision-4 relaxation
above) and what's still spike-gated (Decision 1 CSS `border-image` emitter,
Decision 2 Shadow DOM — both still the next gates).

**PRD.md line 7** reconciliation note updated: "consumption layer is not built
yet (`WindowManager` today does focus/z-index only)" was already wrong by the
time my review agent finished reading. New text records both what shipped and
what's still open in one sentence — preserves the original v3-vs-CSS-custom-
property reconciliation context.

**Memory store** (32 → 31 after pruning): 6 memories updated,
`project_extractor_regeneration.md` deleted (superseded by
`project_import_pipeline.md`'s one-command `npm run import` path), and 1 split
into two modes (`feedback_ship_cadence.md` — prototype-direct-to-branch vs
tight-loop-PR; both keep the no-Co-Authored-By rule).

**Application:** when shipping a feature that contradicts an ADR Update note,
update the ADR the same day — not when the next cut-through finds it. When
a memory's "BUILT (commitsha) then REVERTED (commitsha)" framing buries the
revert, lead with the revert.

## 2026-05-28 — Topology vs fidelity: don't approve your own work on a faithful-to-decode project

Spent half a session running the ADR-0001 §Gating spike (a throwaway CSS
`border-image` emitter to validate or kill the CSS-first hybrid rendering
decision). Wrote up a "PASSED" verdict — committed the writeup, updated the
ADR's status to `Partially Accepted (Decision 1 PASSED 2026-05-28)`. **The
verdict was wrong.**

What I'd compared: my CSS rendition had the same *parts* as the canvas runtime
(border, title bar, widgets, grow box, in the right positions). I called that
"trivially expressible." The owner opened the spike, looked at the side-by-side,
and pointed out the gap I'd glossed over: the canvas renders a **3px beveled
panel** (`headerColors.lightBevel` highlight + `darkBevel` shadow per
`composeCornerSprite §0x434`), and my CSS rendered a flat 1px border. The
widgets had the same gap. **The topology matched, the pixels didn't.**

I'd self-approved a comparison that the project's faithful-to-the-decode posture
should never have let through. The `[[feedback_reference_image_first]]` memory
warns against exactly this; my comparison checked "do the same things appear"
but not "do they look the same."

**Two passes after the catch — Path 1 (pure-CSS-with-box-shadow-bevels) and
Path 2 (synthesized PNG source images used via `border-image`)** — landed at:
Path 1 gets ~95% but has a sharper/harder feel than the canvas's softer
rendering; Path 2 is pixel-faithful because the source image IS the pixels.
The architectural call: Path 2. The CSS emitter generates a small PNG per
(scheme, role) at theme-load time — synthesized from `headerColors` for
corner-sprite schemes, cropped from the chrome cicn for recipe schemes — and
uses it via `border-image`. Same mechanism for both compositor paths; emitter
is uniform.

**Lessons:**

1. **Topology ≠ fidelity. Pixel-by-pixel side-by-side IS the comparison.**
   "Same parts, same positions" is a structural check, not a faithfulness
   check. On a project whose central commitment is replaying a decoded
   binary 1:1, "approximately Mac" loses the brand. Match pixels or document
   the gap.

2. **Don't approve your own work on a fidelity-driven project.** I wrote the
   spike, wrote the verdict, updated the ADR — all without surfacing the
   side-by-side to a second pair of eyes. The owner caught it in 30 seconds.
   Build the surface, then *ask*; don't ship "PASSED" without independent
   review.

3. **Withdraw verdicts when they're wrong; don't paper over.** When the gap
   came out, the right move was to update the ADR back to "in iteration" the
   same minute — not patch over with a clarification. A doc that records its
   own wrong moves and corrections is more trustworthy than one that quietly
   rewrites history.

4. **When you find a project memory says exactly the thing you're about to
   miss, you're missing it.** [[feedback_reference_image_first]] was loaded
   in this very session. I read it, nodded, then walked into the trap it
   describes. Memories cost nothing to write — but they only protect against
   the next mistake if you LOOK at the reference image before claiming the
   thing renders right. Make that the first step.

**Application:** for any "does our X faithfully render Y" question, the
canonical comparison is a screenshot side-by-side with no third option. If the
two images differ at any pixel that wouldn't be lost in display compression,
the answer is no, not yet. Run the test before writing the verdict, not after.
For spike work specifically: surface the side-by-side to the owner BEFORE
updating any decision doc.

## 2026-05-28 — Three rounds of premature verdicts: the existing architecture was the answer

Same session as the topology-vs-fidelity entry above. After Round 1's verdict
was caught and withdrawn, two more iterations followed — each producing a
verdict the next iteration disproved:

- **Round 1:** "trivially expressible in plain CSS." Withdrawn — topology vs
  fidelity.
- **Round 2:** "Path 2 passes — synthesized PNG sources for both compositor
  paths, pixel-faithful." Verified only on the simplest scheme
  (apple-platinum-2) plus one moderate scheme (1138). Withdrawn when the owner
  asked "what about the visually distinctive schemes — evolution, 1138, BeOS?"
- **Round 3:** added a scheme switcher, tested 4 schemes, fixed two more
  bugs (canvas-title-bar overlay; DOM-measured frame thickness). 1138 +
  evolution body frames passed; BeOS exposed an asymmetric title bar the
  clip-path simplification couldn't preserve; apple-platinum-2's synthesizer
  produced a thinner body frame than canvas. **Two distinct fidelity failures,
  both fixable with more per-scheme tuning.**

The owner reframed the question instead of asking me to iterate again: *"If we
use canvas everywhere, is there a way to do more of a hybrid — have the basic
window frames managed by HTML, but use canvas for the decoration?"* The answer:
**that's what already ships.** `renderWindow` returns a DOM container with a
canvas overlay for chrome and real DOM body content. The data-attribute
scanner + WindowManager (shipped 2026-05-27/28) already drive this hybrid.
Three rounds of spike were trying to push chrome rendering INTO CSS at cost
the corpus wouldn't accept — when the architecture for "skin an existing site"
was DOM-structure-canvas-decoration all along.

ADR-0001 §Decision 1 retired in its CSS-first-hybrid form, replaced with the
explicit hybrid framing. The CSS emitter + representability classifier + PC's
border-image work are dropped from the phase map. Full retrospective:
`docs/archive/2026-05-28-css-emitter-spike.md` (archived 2026-05-30).

**Lessons:**

1. **Iteration's own pattern is signal.** When round N+1 reveals a gap round N
   missed, fine. When round N+2 reveals a gap round N+1 missed, the iteration
   itself is the message. The architecture under test is signaling something —
   probably that the problem framing is wrong, not that I need to try harder.
   Three rounds is enough; if you can't see your way to the answer at that
   point, the question itself probably needs to change.

2. **The existing code is often the spec.** I was building a CSS emitter to
   express what the canvas chrome already expressed. Every iteration added
   "cleverness" (synthesizer recipe, title-height heuristic, frame measurement,
   clip-path) that the existing `composeChrome.ts` already computed correctly.
   Before iterating a third time, ask: *is the runtime already doing this
   correctly, and am I reinventing it badly?* If yes, the work isn't iteration
   — it's delegation.

3. **The owner reframing is the fastest path through a stuck spike.** I had
   been about to start Round 4 (delegate to the runtime, use composeChrome's
   pixels directly). The owner's question — "could we keep canvas and just be
   HTML-around-it?" — cut to the architectural reality in one sentence. That
   reframe was the actual answer; my next iteration would have been more work
   to arrive at the same place. **Spike fatigue is itself information.** When
   the agent is about to "just one more iteration," that's a moment to surface
   the broader question, not to push through.

4. **Approximately-faithful is unbranded.** This project's commitments — the
   feedback memories about reference-image-first, faithful-to-the-decode, the
   clean-room replay of the kDEF — all add up to: pixel-faithful or it doesn't
   count. "Close enough" is a different product. If the architecture being
   tested only achieves "close enough," the architecture is wrong for THIS
   project even if it'd be fine elsewhere.

**Application:** before starting a third iteration of any spike, write down
what the second iteration's failure tells you about the question framing. If
you can't articulate what changed, the iteration is probably wrong. If you can,
the next move is often to reframe with the owner, not to iterate. And for
spike work on a fidelity-driven project: when the existing implementation
already does it, the spike's job is usually to KILL the alternative, not to
build it. Three rounds is a credible kill.

## 2026-05-28 — Shadow DOM gotchas: host.firstChild semantics, mount timing, slot geometry

Wrapped `WindowManager`'s window chrome in a shadow root per ADR-0001
Decision 2. The architectural change is small; the integration gotchas were
the interesting part. Three caught here as future-protection:

**1. `host.firstChild` no longer points at the chrome.** WindowManager had a
staleness check `if (entry.host.firstChild !== win) return` — pre-Shadow this
read as "did a newer render replace the chrome subtree?". Post-Shadow,
`host.firstChild` is the slotted `.aw-slot` (light-DOM consumer content),
NOT `win` (which lives in `host.shadowRoot`). So the check always failed →
`wireScrollbars` bailed → no themed scrollbar attached → native browser
scrollbar bled through. The right check post-Shadow is:

  ```ts
  const currentChrome = entry.host.shadowRoot?.firstChild ?? entry.host.firstChild;
  if (currentChrome !== win) return;
  ```

This passes pre-mount (shadow has win) and fails after a re-render replaced
win — preserving the original semantic across both compositor configurations.
(The intermediate "fix" via `win.isConnected` was wrong too — see #2.)

**2. `win.isConnected` is FALSE at first render for the declarative path.**
Subtle. `AaronWindow.promote` inserts the host into the document AFTER
`manager.add` returns. Inside `add`, `render()` runs synchronously then
fires `wireScrollbars` (fire-and-forget). At that moment, the host (and
therefore win, via the shadow) is NOT YET in the document. `isConnected`
returns false. A "bail if disconnected" guard would short-circuit the
intended retry path (the existing `ch === 0` rAF retry catches the
not-yet-laid-out case). The host gets inserted into the document a few
lines later in `AaronWindow.promote`, and by the rAF callback layout
has happened, ch > 0, scrollbar attaches. Don't conflate "not yet in
document (will be soon)" with "stale (was replaced)" — they need
different guards.

**3. Slotted content's CSS sizing computes against its light-DOM ancestor,
not its visual rendering box.** `.aw-slot` has `width: 100%; height: 100%`.
Its light-DOM ancestor is the host (which sizes to its shadow's intrinsic
content — the `.aw-window`, e.g. 320×240). So `.aw-slot` resolves to
320×240 in CSS, but is visually rendered inside the shadow's smaller
`.aw-content` (e.g. 314×175). The slot's CSS dimensions don't match its
visual container. For `wireScrollbars` this works out because it measures
`scrollEl.scrollHeight` vs `scrollEl.clientHeight` on `.aw-slot` itself,
and both are computed in the slot's CSS frame of reference. Just don't
assume slotted-element dimensions match their visual rendering — that's
not how slots work.

**Application:**
- Slot model is genuinely two-DOMs-talking. Any code that crosses the
  boundary (queries across, assumes parent-child by visual nesting, checks
  `firstChild`) is a bug waiting to manifest.
- Add a hostile-CSS regression page (we shipped `demo/declarative-hostile-css.html`)
  the day you wrap things in shadow. It catches both the protective wins
  (host CSS doesn't leak in) AND the integration breakage you didn't
  expect (CSS resets on common selectors that USED to apply now don't —
  inline styles inside the shadow had better cover what the host CSS
  previously did).
- The render-frequency contract on `WindowManager.render()` (audited the
  same day, comment block now lives above the method) was confirmed
  unchanged by the Shadow DOM wrap: click-same-window-twice = 0 renders;
  click-different-window = 2 renders (old + new active state); theme switch
  = N renders. Shadow added zero overhead.

## 2026-05-28 — DOM-twin a11y audit: friendly labels, the host double-labeling near-miss, keyboard parity

Audited every focusable element in `src/interactive.ts` + `src/declarative/`
for proper DOM target / focus / ARIA. Most was already good (button /
checkbox / radio / disclosure / slider all had role + tabIndex + aria-state +
keyboard handlers). The gaps were specific:

**Friendly aria-label text matters more than I expected.** The title
widgets had `aria-label={hit.role}` — literally `"close"`, `"zoom"`,
`"collapse"`. Technically correct (those ARE the roles). But screen
readers would announce just the word. Changed to `"Close window"`,
`"Zoom window"`, `"Collapse window"`. Same edit for the grow box
(`"Resize window"`) and the themed scrollbar (`"Scroll content"`).
This is unglamorous but it's the difference between AT users hearing
"close, button" and "close window, button" — semantic vs descriptive.

**The host double-labeling near-miss.** When adding `role` + `aria-label`
to the WindowManager's outer host element (initial first-pass), I thought
I was filling a gap. Then verified `renderWindow.ts` already emits
`role={dialog|group}` + `aria-label={title}` on the INNER `.aw-window`.
Double-labeling would have made screen readers announce the window twice
("Welcome group, Welcome group"). Reverted with an explanatory comment so
the next agent doesn't re-add it. **Always check what the runtime already
emits before adding new ARIA at a different layer.**

**Keyboard parity for pointer-only interactions is a real gap class.** The
grow box was `<div>` with pointer-only resize handlers — no role, no
tabindex, no keyboard alternative. Promoted to `<button class="aw-growbox"
aria-label="Resize window">` with arrow-key resize (Shift × 4 for bigger
steps). Production WMs do this; demo WMs often don't. The pattern is:
every pointer-only interaction (drag, resize, pinch) needs a keyboard
sibling for AT users. The grow box was caught; window-drag itself is
still pointer-only (move-via-arrow-keys is an outstanding follow-up).

**`<button>` vs `<span role="button">` is fine in both directions, but
buttons give you keyboard activation for free.** `interactiveButton` uses
`<span role="button" tabindex="0">` and wires its own Enter/Space keyboard
handlers. Works, but native `<button>` gets activation + form-submit
semantics + focus-ring CSS for free. The grow box swap from div to button
turned out to be cleaner than expected — same trick where we can.

**Application:** the audit script for the next consumer-facing surface
that ships (menu, popup, list-header, …) should be: enumerate every
clickable thing, check for DOM target / role / tabindex / aria-label /
keyboard activation / state ARIA. If a category is missing, fix it
before shipping — easier than retrofitting later, and the audit itself
takes ~30 minutes.

## 2026-05-28 — Classic Mac OS lessons for expensive chrome paint (the things our renderer doesn't yet do)

A consequence of the architecture review (the 2026-05-28 three-agent sweep)
identifying canvas allocation as the headline cost at 50+ windows: how would
classic Mac OS have handled expensive window paints? It ran on 8 MHz 68000s
with megabytes of RAM. It HAD to be aggressive about not repainting. The
patterns it used translate directly to optimizations our pixel-faithful
runtime hasn't picked up yet — captured here so the next agent doesn't
re-derive them from scratch.

We've already nailed the render-FREQUENCY axis (the 2026-05-28 audit locked
in the contract: focus = 2 renders, theme switch = N renders, no per-mousemove
canvas repaints). What classic Mac would push next is render COST: every one
of our renders repaints the WHOLE chrome canvas. Classic Mac would have
repainted only the changed region.

**The six patterns + Aaron mappings:**

1. **Update events with dirty regions (`InvalRect`/`BeginUpdate`).** The OS
   maintained per-window dirty regions and clipped the WDEF's drawing to just
   that region. Multiple `InvalRect` calls in one event cycle coalesced into
   a single `update` event. **Aaron does the opposite:** every state mutation
   synchronously triggers a full chrome re-render. → translate to `invalidate(entry)`
   that sets a dirty flag and rAF-schedules render(); coalesces cascading
   mutations. ~30 LOC. Modest impact; mutations are mostly isolated in
   practice today.

2. **Active/inactive flip only repainted the title bar.** This is the
   headline classic-Mac optimization for focus changes. The body frame +
   sides + bottom — none of those pixels changed when you clicked window B;
   only the title-bar tinting did. So the WDEF was called with a clipped
   region that was just the title bar. **Aaron repaints the entire canvas**
   on focus change. → at first render, pre-compose BOTH active and inactive
   title-bar strips. On focus change, `putImageData` the new strip into the
   existing canvas — no full recomposition, no widget overlay rebuild, no
   scrollbar re-wire. **THE BIGGEST AVAILABLE WIN.** Generalizes the existing
   `pressedCanvas` pattern (interactive.ts:1023-1038) which already does this
   for title-widget pressed state. Filed as a tracker.

3. **Resize was "redraw the exposed strip, not the whole window."** When
   the user grew a window by 10px, classic Mac knew which 10px were newly
   exposed; the previously-covered area was untouched. **Aaron rebuilds the
   whole chrome** on every size change. → low priority for us: resize is
   rare (drag uses the ghost-outline pattern; the keyboard fallback nudges
   8px/step). Worth knowing the pattern; not worth implementing.

4. **Window-shade and zoom were essentially free.** Shade hid the body by
   clipping; the title bar stayed exactly as it was. Zoom restored from
   saved geometry. **Aaron re-renders the chrome** on both. → falls out
   naturally from #2: if active/inactive title strips are cached, shade and
   zoom can use the cached strip and skip the recomposition.

5. **Off-screen `GWorld` pre-rendering.** Performance-sensitive Mac apps
   drew complex content into an off-screen `GWorld` once, then `CopyBits`'d
   it to screen on each refresh. **The on-screen `<canvas>` is essentially a
   `GWorld` already — but we throw it away every render.** → canvas pooling
   (issue #171). Classic Mac's contract is: keep the canvas; rewrite pixels
   in place via `putImageData`. Combined with #2, the per-render allocation
   cost for focus-flip vanishes.

6. **Occluded windows didn't repaint.** If window A was fully covered by
   window B, A's pixels stayed unchanged; the OS knew A was invisible and
   skipped its update events. **Aaron has no occlusion model** — a theme
   switch repaints all 50 windows even if 45 are scrolled off-page. →
   `IntersectionObserver` signals visibility; mark off-screen windows as
   "lazy"; defer their next render until they re-enter the viewport.
   Significant win for many-window pages; nothing at low counts.

**Pattern that classic Mac did NOT need that we DO:** none. Region calculus
for non-rect windows (rounded-corner alerts), CopyBits modes (XOR ghost
dragging), scroll via `CopyBits` of the visible strip — all map cleanly to
modern primitives we already use (or correctly don't need).

**Pattern that exists in our codebase already as a microcosm:** the
`pressedCanvas` in `interactive.ts:1023-1038`. When a title widget is
press-rendered for the first time, we cache the alternate canvas and swap
on pointerdown/pointerup. This is EXACTLY pattern #2 at a smaller scope.
Generalizing it from "press state for widgets" to "active state for chrome"
is the natural extension.

**Lesson worth internalizing for the next renderer-touching agent:** when
considering an expensive operation, the classic-Mac question is "can we just
not do the operation?" before it's "can we do the operation faster?" Our
render() audit already verified frequency is bounded. The remaining cost is
the operation itself — and the operation is "compose chrome, allocate canvas,
overlay widgets, wire scrollbars." Each step has a "could we cache this
specific subresult?" answer. The pre-cached title-strip is the highest-value
of these. Canvas pooling is the second.

**Application:** before adding a new optimization in the renderer, ask: (1)
does it ACTUALLY change pixels (or is it a no-op masquerading as work)? (2)
do we already have the result cached from a prior render? (3) is the changed
region a proper subset of the canvas? If (3), don't repaint the whole canvas
— `putImageData` the changed strip. Classic Mac's WDEF model treated chrome
as a composable strip-machine; ours treats it as a monolithic recipe. The
gap between the two is where the wins live.

### 2026-05-28 — Scriptoscope pivot (project rename + npm publish prep)  *(internal-API-stable claim superseded 2026-05-29 — see "Full data-scriptoscope-* sweep" below)*

*Tracker companion: [#175](https://github.com/khawkins98/aaron-ui/issues/175) (closed `wontfix` — "decision recorded"). Same shape as #174's Appearance-themes confirmed-no, so the question "why is this called Scriptoscope?" has a tracker to point at, not just prose.*

Two prior naming decisions had explicitly KEPT "Aaron UI" despite the loose etymology (the original was Apple's Copland-era Appearance Manager codename, and the project no longer matches that scope after the "Apple themes dropped" pivot). The npm-publish work for #28 was the forcing function — `aaron-ui` is taken on npm by an unrelated Vue avatar component, so scoping under `@khawkins98/aaron-ui` was the easy path and a real-name pivot was the harder path. The maintainer chose the harder path.

**Chosen: Scriptoscope.** Per the research recorded in commit `352ad93` (on `origin/platinum-fidelity`'s `blog-post-outline.md`) — npm + GitHub + most TLDs free; the JS pun ("Script") + instrument-suffix homage ("-oscope") fit the project's character; runner-up "Schemeoscope" was cleaner-slate but lost the JavaScript signal. The `.com` is taken (2024) but the project doesn't need a vanity domain yet — `.dev`/`.app` are options when the time comes. Avoided "Kaleido-*" names because Kaleidoscope.app (a commercial macOS diff tool, very much in this project's audience) creates real confusion + trademark exposure.

**Scope of the rebrand:**
- Package name on npm + brand-name occurrences across docs/code/README/PRD/CLAUDE/comments → `Scriptoscope`.
- `dist/aaron-ui.js` → `dist/scriptoscope.js`; `src/aaron-ui.css` → `src/scriptoscope.css`; exports map + vite entry name follow.
- The `aaron-ui` GitHub repo + the GH Pages URL `/aaron-ui/` stay for now (independent pivot; not coupled to the publish).
- **The consumer-facing internal API namespace stays stable** — `data-aaron-*` attributes, `.aw-*` CSS classes, `AaronWindow` class name. Lodash kept `_` after the underscore.js → Lodash rebrand for the same reason: renaming every consumer touchpoint creates a real API break with marginal brand value. This is documented in `src/index.ts`'s declarative front-door comment so future contributors don't relitigate.
- Logged in `docs/history.md` (the canonical archeology record), with the prior PRD §285 and the 2026-05-16 LEARNINGS entry marked superseded. PRD §285's `[Name] UI`-family rationale no longer applies but stays as the recorded reasoning of its time.

**Application:** when the brand pops up in future writing, default to Scriptoscope. The `data-aaron-*`/`AaronWindow`/`.aw-*` identifiers in code are deliberate stable surface — don't "fix" them to match the brand. If a future API break IS appropriate (e.g., for a 1.0 stabilization), bundle that decision separately, not as a casual rename.

### 2026-05-28 — `num_files` in classic SIT! counts ROOT entries, not files-in-tree (decoder patch #3)

Owner dropped four real-world Kaleidoscope `.sit` archives on the demo (`duplex.sit`, `fantasia.sit`, `falloutiv.sit`, `dtunderfloatsnow.sit` — all from Mac Themes Garden). None loaded a usable scheme. My first hypothesis was "the picker is choosing the wrong fork." It wasn't — the picker's `largest non-Icon resource fork` heuristic was fine. The decoder was MISSING FILES. Native munbox CLI, run on `duplex.sit` (which Finder shows containing 4 items), extracts 1. Same story on the other three.

Root cause: classic `SIT!` format's `num_files` field at offset 4 counts **root archive entries**, not total files. A folder IS one root entry that contains N sub-entries. Patch #2 from the original spike (2026-05-27) correctly stopped folder MARKER bytes (methods 32/33) from counting against `num_files` — but sub-FILES inside a folder still incremented `files_processed`, so the iterator hit `1 >= 1` and exited after the first nested file. Every Kaleidoscope `.sit` is shaped this way (scheme wrapped in a named folder alongside ReadMe / custom folder Icon / desktop-pattern sidecar), so this silently broke virtually everything.

Patch #3 (a01dd7a) makes the accounting consistent: only ROOT-level entries count against `num_files`. Three sites in `tools/sit-wasm/munbox/lib/layers/sit.c`:

1. Termination check + while-loop condition stay in the loop when `folder_depth > 0`, regardless of the root budget — keep reading sub-entries until the root folder closes.
2. Folder END (method 33) increments `files_processed` when depth returns to 0 (the root folder is one finished root entry).
3. Regular file entry only increments `files_processed` when `folder_depth == 0` (root-level files); files inside a folder are sub-entries of their parent.

Verified post-patch: all four user files decode every fork; the picker correctly lands on each scheme (type='Colr' creator='Acid', 152–696 KB). Browser E2E on the declarative demo's drop-zone: `duplex.sit` and `fantasia.sit` re-theme all four promoted windows live.

**Side effect: the emsdk gate is gone for rebuilds.** Originally the spike noted "~1 GB emsdk install (owner authorization, heavy env change)" as a blocker. Docker has an `emscripten/emsdk:latest` image — `docker run --rm -v "$(pwd):/src" -w /src emscripten/emsdk:latest bash build.sh` rebuilds the WASM in under a minute on a cold image pull. Recipe added to `tools/sit-wasm/munbox/PATCHES.md`'s Rebuild section.

**Test fixture nuance.** `tools/sit-wasm/sit-wasm.test.mjs` test #8 had `assert.equal(rsrcEntries.length, 1, 'exactly one resource fork')` — that assertion was hard-coded to the buggy pre-patch behavior (the `system7nostalgiasilver.sit` fixture genuinely has scheme + ReadMe = 2 entries). Relaxed to `>= 1`; the byte-for-byte equality of the **picked** fork against the corpus is unchanged and still holds.

**Application — meta-lesson:** when a binary-format integer field is named ambiguously (`num_files`, `num_entries`, `count`), verify what it actually counts: top-level entries, total leaves, immediate children? The choice matters most when the format supports nesting. Don't treat the field as authoritative without tracing through a real multi-entry, nested example. Classic SIT!'s `num_files` looks like "files" but means "root entries"; folder trees decompose it the way the iterator state machine has to model. Same trap likely exists in adjacent classic-Mac formats (Compact Pro, DiskDoubler) and possibly in modern formats too — verify before assuming.

### 2026-05-29 — Full `data-scriptoscope-*` sweep: the Lodash-kept-`_` model didn't survive 24 hours

Yesterday's "Scriptoscope pivot" entry argued for keeping the internal API surface (`data-aaron-*` attributes, `.aw-*` CSS classes, `AaronWindow` class name) stable across the package rename, on the Lodash-kept-`_` model. The reasoning was about API-break cost vs marginal brand value.

That call held for **one day**. Today the integration guide went out — the first piece of documentation a real consumer would copy-paste — and the brand wobble immediately read wrong. `data-aaron-window` in code published as Scriptoscope is the equivalent of `data-_-toggle` in Bootstrap: legible only to readers who know the project's history. The Lodash precedent was set when `_` was an established convention; nobody had typed `data-aaron-*` in any consumer integration yet.

Pre-publish (0.0.1 unpublished) is the cheapest possible moment to break this contract. Decision today: **full sweep, no internal/external split**.

### What changed

- **Consumer attribute namespace:** `data-aaron-*` → `data-scriptoscope-*` (all 30 attributes).
- **JS dataset access:** `dataset.aaronWindow` → `dataset.scriptoscopeWindow` (every camelCase variant).
- **CSS class prefix:** `.aw-*` → `.scriptoscope-*` (runtime-emitted classes inside Shadow DOM).
- **CSS fallback selectors:** `.aaron-window` / `.aaron-button` → `.scriptoscope-window-fallback` / `.scriptoscope-button-fallback` (kept distinct from the shadow `.scriptoscope-window` to avoid selector ambiguity).
- **JS class name:** `AaronWindow` → `ScriptoscopeWindow`. The file `src/declarative/AaronWindow.ts` renamed to `ScriptoscopeWindow.ts` (git mv tracked).
- **Private field markers:** `_awComposed` / `_awNative` / `_awSetChecked` → `_scriptoscope*`.
- **localStorage prefix:** `aaron:layout:` → `scriptoscope:layout:` (breaks any persisted layouts — fine pre-publish, no users yet).
- **Debug + error log prefix:** `[aaron:category]` → `[scriptoscope:category]`; `[aaron]` (errors) → `[scriptoscope]`.
- **URL param:** `?aaron-debug=` → `?scriptoscope-debug=`.
- **CSS custom properties:** `--aaron-window-shadow` / `--aaron-desktop` / `--aaron-focus-color` / `--aaron-focus-width` → `--scriptoscope-*`.
- **Style IDs + default names:** `'aaron-tabs-css'` / `'aaron-field-css'` / `'aaron-drop-active'` → `'scriptoscope-*'`.

Roughly 60 files touched across `src/`, `demo/`, `docs/`, `README.md`, `CLAUDE.md`. Tests + lint + build all clean post-sweep. Browser smoke confirms the demo's four declarative windows promote correctly with `data-scriptoscope-window` and render their themed chrome end-to-end.

**Application:** the new public API surface is `data-scriptoscope-*` and `.scriptoscope-*`. Any documentation, error message, or consumer-facing string going forward uses these. The prior Lodash-style argument is recorded but doesn't hold — the threshold was lower than the entry estimated.

**Meta-lesson on rebrands:** when "rename costs are real" is the argument for keeping legacy identifiers in a brand-fresh package, validate the cost against a concrete consumer-integration scenario before committing. Yesterday I imagined a cv-mac consumer who'd already typed `data-aaron-window` everywhere; today's reality is that no such consumer existed, so the rename cost was zero. Estimate carefully when the cost-to-defer math is symmetric to the cost-to-execute math.

---

### 2026-05-29 — Option A: source-only bundles + the elementById path-parse trap

**Context.** The repo's `themes/<slug>/` directories carried both the original Kaleidoscope archive (`scheme.rsrc`) AND a full bake of derivative artifacts (`theme.json` + `cicns/*.png` + `ppats/*.png` + `icons/*.png` + `resource-roles.json` + `rasters.json` + `extraction-manifest.json`). ~55 MB across 18 bundles. The runtime read `theme.json` + the PNGs at runtime; the bake pipeline wrote them at port time.

**The change.** Bundles now ship only the source-of-truth files: `scheme.sit` (preferred — the original StuffIt archive the author published) or `scheme.rsrc` (fallback for wayback-recovered schemes whose `.sit` is no longer reachable), plus `meta.json` + `PROVENANCE.md`. Three files per bundle. The runtime decodes the archive in-browser via `loadKaleidoscopeScheme` — same code path the demo's drop-zone has used since 2026-05-27.

**Why it works.** The browser decoder (`tools/theme-loader/loadKaleidoscopeScheme.js`) already produces a render-ready `LoadedTheme`: bytes → resource fork → cicns + ppats + icons + windowTypes; every decoded asset gets PNG-encoded to a `blob:` URL via `OffscreenCanvas`; manifest asset paths get rewritten to those URLs. Per-load decode lands at ~234 ms on a fast machine after `Promise.all`-parallelising the asset encoding (was ~19.7s serial — single biggest perf cliff in the migration). Repo dropped to 6.3 MB; bundle weight halved.

**The gotcha that almost shipped silently.** `src/controls.ts:elementById` resolved a chromeElement for a given resource id by **regex'ing the id out of the `asset` path string** (`/cicn-n?-?(\d+)/`). Pre-Option-A asset strings were `cicns/cicn-n10239-pushbutton.png` and the regex worked. Under the in-memory load path the asset string IS a `blob:` URL with no id in it. Every `elementById` call silently returned null. Buttons, default rings, scrollbar arrows, textAnchors — all silently un-themed. The lint pass missed it entirely (lints `theme.json` shape, not the in-memory wiring). The eyeballed render caught it first.

**The fix that didn't survive review:** patching the regex to also match blob URLs. There's no id in a blob URL — it's an opaque content-handle.

**The actual fix:** the decoder already writes a `sourceCicnId` numeric field on every chromeElement (`tools/theme-loader/buildThemeJson.js` writes it; `lint-themes.mjs`'s control-coverage rule already reads it). `elementById` now resolves against `|sourceCicnId|` directly. Survives URL rewrite. Single source of truth for "what id is this element," shared with the lint pass.

**Sibling gotcha — `theme.baseUrl=''`.** The browser decoder's default `baseUrl` is `''` (asset refs are already absolute blob URLs; `assetUrl()` passes them through; no `baseUrl` fetch is needed). `loadTheme` returned the decoded theme verbatim, so EVERY theme had `baseUrl=''`. Demo + interactive.ts cache by `theme.baseUrl` as the per-theme identity — the empty key collapsed every theme into the first-loaded theme's slot. 1138's folder icons leaked into 1984's Scene preview, etc. Fix: `loadTheme` now sets `baseUrl` to the consumer-passed URL.

**Application.** Whenever a runtime path *parses information out of a string that the loader also writes as structured data*, prefer the structured field. Path-parsing under in-memory load paths is a recurring footgun. Three callers were fixed in this migration window:

1. `controls.ts:elementById` — was the prompting case, switched to `sourceCicnId`.
2. `demo/index.html:930` (Geometry Inspector raster preview) — was concatenating `${theme.baseUrl}/${ce.asset}` where both are now blob URLs, routed through `assetUrl()` instead.
3. `demo/index.html:973` (loadImgSafe) — same pattern, same fix.

Visual baselines (`tests/visual-baselines/scenes/<slug>.png`) are now the eyeball net for this regression class — the lint pass alone won't catch "ran the path but it produced empty output." Capture script lives at `scripts/capture-visual-baselines.mjs`; runs against `npm run dev`; uses Playwright transitively (gstack browse skill). Fingerprint-based lint baseline (`themes/lint-baseline.json`) handles "the source bytes didn't change → trust the stored result" so CI doesn't need to re-decode 18 bundles per run.

**Files that are now load-bearing for source-only bundles:**

- `src/loadTheme.ts` — fetches `scheme.sit` or `scheme.rsrc`, sniffs the bytes (rejects 200 + HTML SPA fallback), decodes, returns `LoadedTheme` with `baseUrl` preserved.
- `tools/theme-loader/loadKaleidoscopeScheme.js` — bytes → `LoadedTheme`, with the `inspector` catalog the demo's diagnostic panels read.
- `tools/theme-loader/classifyResources.js` — portable id → role rubric, shared between bake (`gen-resource-roles.mjs`) and runtime (`buildInspector`).
- `src/types.ts:LoadedTheme.inspector` + `ThemeInspector` — type surface for the catalog.
- `.gitignore` — derivative-dir block (`cicns/`, `ppats/`, `icons/`, …) so `npm run build:themes` writes locally without polluting git.
- `themes/lint-baseline.json` — sha256 + status per slug from the maintainer's last full lint run.
- `tests/visual-baselines/scenes/*.png` — Scene panel per theme for eyeball regression.

---

### 2026-05-29 — The codex pattern: "read the structured field, don't guess"

**Context.** After Option A landed, a series of "this looks wrong on theme X" reports surfaced from the maintainer eyeballing per-theme renders against the period references. Each report was traceable to a specific failure mode: the manifest carried the structured answer the artist authored, and the runtime was either parsing a string for the data, falling back to a heuristic, or hard-coding a value. Sixteen commits over a session shipped each fix as a one-line "stop guessing, read the field" — and the cumulative pattern became codified as a documented framework.

**The fixes that surfaced the pattern.** Each row is "what the runtime was doing" → "what it should do":

| Bug | Wrong source | Right source |
|---|---|---|
| Buttons un-themed under in-memory load | regex on `asset` path string | `chromeElement.sourceCicnId` (numeric) |
| Info bar flat gray | hard-coded `#e6e6e6` | `chromeElement(-9567).bgPattern` → `bodyBackground.pattern` → `headerColors.active.fill` → flat |
| Volume icon shows generic grid | only `-3790` lookup | `-3790` → `-14336` fallback → `FINDER_GRID_PNG` |
| Default ring outset wrong on big cicns | `ring.width / 4` heuristic | `(ring.width - face.width) / 2` authored delta |
| Reference images scale wildly | no max-width | `.frame.reference img { max-width: 280px }` |
| 9-slice always stretches | always-stretch | `slice.tile: true` from cinf → tile mode |
| 1990 title missing | source-x widget positions | per-cell mapped output-x via the placement record |
| Crayon "On" 80px tall | `lineH = face.height` | `opts.height` override on `ButtonOptions` |
| `theme.baseUrl=''` cache collisions | decoder default `''` | preserve `bundleUrl` in `loadTheme` |
| Title color B/W only | composed-buffer luminance | `composed.titleFillRgb` from cicn 0x5530 marker — with contrast rejection so a bg-matching marker falls back to luminance |
| Desktop pattern often missing | `/desktop/i` slug regex | `ppat-17` canonical fallback (5 themes ship it) |
| Dialog body wrong texture | every windowType applied bodyBg | gate by windowType slug (`/utility\|mini\|floating\|palette\|dialog\|alert/`) |
| Info bar text illegible on dark | hard-coded `#000` | contrast-pick from resolved bg luminance |
| Earth icon in apple-platinum-2 | non-folder ids in folder priority list | folder-only priority + doc blocklist |
| Pinstripe flatter than authored | only `darkTinge` | `lightTinge → fill → darkTinge` 3-tone |
| `slice.side` collapsed to corner | `{l: c, t: c, r: c, b: c}` square inset | `{l: c, t: side, r: c, b: side}` per kDEF TMPL 129 |

**The codex framework.** To make this pattern reviewable, we introduced three coupled artifacts:

1. **`scripts/scene-coverage-audit.mjs`** — walks every bundle's decoded manifest, runs each Scene SLOT's tier resolver, prints a per-theme table. Modes: console (default) / `--write` (regen `docs/scene-codex.md`) / `--json` / `--check` (CI: exit 1 on any slot at hard fallback) / `--theme=<slug>` (filter).

2. **`docs/scene-slot-spec.md`** — hand-authored contract for every slot. Lists the tier hierarchy, why each tier exists, where the runtime / demo implements it, multi-flavor variant flags.

3. **`docs/scene-codex.md`** — auto-generated by `--write`. The corpus-wide audit: per-theme tier resolution table + tier distribution per slot + shipped resource counts + variant flags.

Ten slots currently audited: `info-bar-bg`, `volume-icon`, `window-body-bg`, `desktop-bg`, `dialog-body-bg`, `info-bar-text-color`, `progress-bar-hue`, `title-widget-glyph`, `scroll-arrow-glyph`, `folder-scene-icons`. New slot = one entry in the audit script + one section in the spec doc.

**The pattern recipe.**

When something looks wrong against the reference:

1. **Identify the slot.** Which visual element is off? (info bar / button / dialog body / title / scrollbar / …)
2. **Look up its tier.** `docs/scene-codex.md` says which tier the live render landed on per theme.
3. **Check the manifest.** Does the bundle ship a richer source the tier hierarchy doesn't reach? (the just-fixed cases were all "yes — a structured field was sitting in the manifest unused")
4. **Add or reorder the tier.** Wire the new tier into the runtime + demo + audit + spec doc. The codex regenerates from `--write`.

**Cross-cutting patterns this surfaced.**

- **The 9-slice family fields** — `slice.corner`, `slice.side`, `slice.tile`, `slice.resizeBehavior` — are all decoded but were partially honoured. The button compositor sweep wired them; progress / scrollbar / slider / tab / list-header followed in `adc8bc3`. Remaining: `resizeBehavior` (15 values; collapsed to a binary tile/stretch).
- **The cinf anchor family** — `chromeElement.bgAnchor`, `embossAnchor`, `sourceCinfId` — decoded but never typed before `adc8bc3`. Now on the public type surface for future consumers, even though no current consumer reads them.
- **The header-state family** — `headerColors.active.{frame, fill, lightTinge, darkTinge, lightBevel, darkBevel}` — `darkTinge` and `fill` were the only consumers in the corpus pre-session; `lightTinge` is now wired into the procedural pinstripe (`42ed44b`).

**Per-theme deferred items + why.**

These didn't fit the codex pattern — they're per-bundle quirks where the bundle data is non-canonical or the kDEF model isn't a straightforward field lookup:

- **floppies + windows-95 default ring thin.** [RESOLVED 2026-05-28] Bundle shipped `-10231`/`-10232` (16×16) with 3px TRANSPARENT outer rim. Fix: `opaqueBounds` as the 9-slice source (`src/controls.ts` composeButton) — period-faithful kDEF behaviour, the kDEF blitted the visible art, not the raster bounds.
- **monkey-paradise + animals OK button shows menu wallpaper.** [RESOLVED 2026-05-29] Two bundles assign `-10239` (the canonical active push-button id slot) to `solo-menu-background-2` — non-canonical authoring. They ship inactive (-10240) + pressed (-10238) push-button cicns but no active slot at all. Fix: `loadPushButtonFace` (src/controls.ts) resolves the face via the manifest's STRUCTURED role name first (`push-button-active`, `active-push-button`, `active-button`, `push-button`), then falls back to id-based lookup that REJECTS anti-role keys (`/menu|tab-pane|pull-down|popup|window|dialog|scroll/`). When no active face exists, substitutes the pressed face — the AppearanceManager's documented behaviour when an active-state slot was empty. Codex-aligned: the manifest carries the structured answer (the role name), the runtime was guessing from an id collision.
- **dolphin-som title nameplate too narrow + left frame thin.** Specific to its wnd# recipe — needs the kdef231-recipe-walk per part code.

**Application.**

For any new "this looks wrong" report:

1. Don't reach for hard-coded fallbacks. Check the manifest first — `tools/theme-loader/buildThemeJson.js` lists every decoded field.
2. Treat the codex + spec as the system of record for slot resolution. Add new slots there; don't bury per-slot logic in demo/runtime code without an entry.
3. If you're about to write a regex-on-string or a heuristic-on-pixel: stop and check whether a decoded structured field would give the right answer.
4. The visual baselines (`tests/visual-baselines/scenes/<slug>.png`) are the eyeball net for "the path ran but produced an empty / wrong-looking output" — lint can't catch this class.
5. The decoded-manifest sha256 fingerprint in `themes/lint-baseline.json` (`--strict` mode) catches "the bundle bytes didn't change but the decoder regressed" — the parity-gate replacement that came in with Option A.

**Files that became load-bearing for the codex pattern.**

- `scripts/scene-coverage-audit.mjs` — the audit
- `docs/scene-codex.md` — the auto-generated artifact (committed)
- `docs/scene-slot-spec.md` — the human contract
- `tests/visual-baselines/scenes/*.png` — the eyeball net
- `themes/lint-baseline.json` (with `decodedSha256`) — the decoder-output gate

---

### 2026-05-29 — Asymmetric slice insets need a 9-slice clamp (don't relitigate)

**Context.** Pass C wired the cinf's `slice.side` as the VERTICAL 9-slice inset (was collapsed to `corner` for both axes everywhere). Six callers in `controls.ts` started passing `{l: corner, t: side, r: corner, b: side}` to `pixelBuffer.nineSlice`. Almost everything worked.

**The gotcha.** 1990 + evolution ship `-10231`/`-10232` rings at 21×21 with `slice.corner=7, slice.side=14`. Inset math: `t + b = 28 > sr.h = 21`. The unclamped nineSlice silently corrupted:
- `smy = sr.h - t - b = 21 - 14 - 14 = -7`.
- The four side / center spans each early-returned via `if (sw <= 0 || sh <= 0)`.
- The four corner blits (each `l × t` = 7×14) drew INTO a destination that was larger than the source corners could cover gap-free.
- Top corners read source rows 0..13. Bottom corners read source rows `sr.h - b .. sr.h` = 7..21 — **the corner ranges overlapped** (rows 7..13). The middle band art got duplicated in BOTH halves.

The result was four corner-stack failures visible as garbled default-button rings, and the buggy renders were briefly committed to the visual baselines before the framework-architecture + code-quality reviewers spotted them.

**Fix.** Clamp insets BEFORE the math:

```ts
const _l = Math.max(0, Math.min(ins.l, Math.floor(sr.w / 2)));
const _r = Math.max(0, Math.min(ins.r, sr.w - _l));
const _t = Math.max(0, Math.min(ins.t, Math.floor(sr.h / 2)));
const _b = Math.max(0, Math.min(ins.b, sr.h - _t));
```

Worst case is a degraded-but-CONSISTENT render the eyeball can catch on first sight, not a silent corruption that ships to the baseline.

**Application.**

- When wiring a structured field into a geometric primitive, check the **arithmetic bounds** before trusting the inputs. The cinf TMPL allows the artist to declare `corner + side > raster_size` because the bake doesn't enforce a per-resource ceiling; the runtime has to.
- The visible-baseline fixtures (`tests/visual-baselines/scenes/*.png`) caught this one round-trip after the silent regression shipped — they're an eyeball net, not a deterministic gate. Adding pixel-diff (SSIM > 0.99 or similar) on these baselines as part of `npm test` would have caught it in the same commit (framework reviewer B6).
- The framework reviewer's "tier resolvers should be a SHARED MODULE the runtime + audit both consume" is the prophylactic that prevents this whole class — when the runtime ships a value the audit must observe, they can't disagree.
- See `src/pixelBuffer.ts:nineSlice` — the clamp now lives there. Comment cites the 1990 + evolution case as the canonical example. Any future "the inset doesn't draw what I expected" is most likely either (a) `corner + side > raster_size` triggering the clamp (visible as a tighter-than-authored band), or (b) the cinf carrying an exotic `resizeBehavior` the runtime collapses to binary tile/stretch (the 13-of-15 TMPL 139 values still unsupported).

**Sibling gotcha — flatten rect bounds.** `composeFaceButton` paints a flatten rect AFTER the face nineSlice to erase the cinf text marker. The flatten rect's bounds also need the per-axis insets, not `fIns` for both. Same root cause: silent partial coverage when `fSide < fIns`.

---

### 2026-05-29 — Option-A blob URLs break asset-path-based id lookups (read first)

**This bug class has now bitten three times in two months. If you write a "look up the resource by parsing an id out of the asset path" function, STOP and read this entry.**

Under Option A, `loadKaleidoscopeScheme` rewrites every asset reference (chromeElements, patterns, icons) to a `blob:...` URL pointing at an in-memory `OffscreenCanvas`. The rewrite happens once at load and is invisible to consumers — `theme.manifest.chromeElements['…'].asset` no longer contains `cicns/cicn-n10239-….png`, it contains `blob:http://localhost…/uuid-…`.

Code that tries to derive an id by regex-on-asset-path then silently returns null. Every consumer downstream falls to a procedural / hard fallback. **Three observed occurrences**:

1. **`elementById` for chromeElements** (commit `4ba57a3`, 2026-05-26) — the path-parsing regex matched nothing under blob URLs → every elementById call returned null → buttons / default-rings / textAnchors silently un-themed across every theme. Caught by parity-gate.
2. **`bodyBackgroundStyle` friendly-key lookup** (commit `8b641b0`, 2026-05-29) — first attempted fix used the manifest's friendly KEY (`patterns['utility-pattern']`). Worked for monkey-paradise + animals + crayon-os but missed 1984 (whose ppat-42 ships under the friendly key "blue-utility") and 1990 (whose ppat-42 is unnamed). Half-fix; the user surfaced the gap.
3. **`patternByResourceId` via `sourcePpatId`** (commit `68f5ff8`, 2026-05-29) — the structural fix: add a numeric id field to every pattern at decode time, look up by `|sourcePpatId|`. Survives the blob-URL rewrite.

**The structural fix.** Add a `source<X>Id` numeric field at decode time, mirror the `sourceCicnId` pattern, look up by `|sourceXxxId|`. Three live cases:

| Resource | Decode field | Lookup helper | First commit |
|---|---|---|---|
| chromeElement (cicn) | `sourceCicnId` | `elementById` (`src/controls.ts`) | 4ba57a3 |
| chromeElement (cinf) | `sourceCinfId` | (typed-only, no current consumer) | adc8bc3 |
| pattern (ppat) | `sourcePpatId` | `patternByResourceId` (`src/renderWindow.ts`) | 68f5ff8 |

Pending consumers that should be id-based, not asset-path-based:
- ics4 / ics8 glyph lookup (currently goes through `theme.glyphs[id]` by string key — safe, but if a future caller wants to walk by asset path, same trap).
- Any future "find a chromeElement by role family" helper that today might be tempted to grep `chromeElement.asset` for `cicn-n8278-` or similar.

**Detection-after-the-fact.** The decoded-manifest fingerprint (`themes/lint-baseline.json`'s `decodedSha256`, opt-in via `--decoded` or `--strict`) catches "the decoder output changed without the source bytes changing." It WILL fire when a new `source<X>Id` field is added — that's a legitimate decoder output change, run `npm run lint:themes -- --update`. It will also fire when a code change accidentally drops the id rewrite (the prophylactic). The visual-baseline byte-diff (`npm run verify:scenes`) catches the downstream effect: silent un-themed renders show up as different pixels.

**Application.**

1. **Never parse an id out of an asset path at runtime.** If you find yourself writing `asset.includes('cicn-n')` or `/ppat-(\d+)/.exec(path)`, stop. Use the structured `source<X>Id` field instead, or add one if the decoder doesn't write one yet.
2. **When you add a new resource type with a canonical id slot, add the `source<X>Id` field BEFORE writing any consumers.** The decoder is one edit + one type update + one re-baseline. Doing it after writing consumers means the consumers ship broken and the decoded-fingerprint guard misses it (because the consumer reads via blob URL, the guard reads via the manifest's structured field — they diverge silently).
3. **Friendly keys are author-decorative; ids are structured truth.** Two bundles can ship the same kDEF resource under wildly different friendly keys (1984's `ppat-42` is "blue-utility"; monkey-paradise's `ppat-42` is "utility-pattern"; 1990's is unnamed). The id is invariant; the key is not. Look up by id.
4. **A separate but-related trap: the `friendly key` lookup misses the same case for chromeElements.** push-button-active is canonically `push-button-active`, but apple-platinum-2's decoder emits `cicn--10239` (generic dump key, no semantic info). The role-name walker in `loadPushButtonFace` (`3c36723`) walks a list of canonical key aliases AND falls back to id-with-anti-role-rejection. Same shape; different field.

---

### 2026-05-29 — Visual misreads at thumbnail resolution flip "spec wrong vs runtime wrong"

The `dialog-body-bg` codex slot was reverted from a 3-tier hierarchy to flat-white once before this session — see `b6e9b86` and the spec-doc comment "the visual audit confirmed the references show FLAT bodies." That visual audit was wrong. At thumbnail resolution (the per-theme Scene tile in the demo's index), a subtle `ppat-42` tile reads as flat off-white; the references that actually carry a themed utility body (1984's blue-utility, 1990's green ppat-42, monkey-paradise's beige) look identical to the references that don't (1984 vs apple-platinum-2 at thumb size, indistinguishable).

The user surfaced the misread on 2026-05-29 with the screenshots that prompted commit `8b641b0` — the 3-tier hierarchy is back, by canonical resource id rather than friendly key (`68f5ff8`).

**Application.**

- When a hypothesis says "every reference shows X," verify by pixel-probing the reference images, not by eyeballing thumbnails. The `.scratch/crop-baseline.mjs`-style PNG decoder is enough; classify the rectangle the slot occupies and confirm.
- When retracting a tier from the codex, add a "retraction trigger" line in the spec entry: "if any reference reading sees a non-flat utility body, reinstate." It's the same idea as a parked issue's "unpark when" — make the next reviewer's job easier.
- Visual baselines (`tests/visual-baselines/scenes/*.png`) at the thumbnail resolution they live in are an existence check ("the pipeline ran"), not a faithful-rendering check. The reference images shipped with each bundle are the source of truth for "does this theme look right."

---

### 2026-05-29 — The corpus IS the spec (and the prior decompile was already on disk)

**This is the meta-learning that closes the "why are we guessing about id roles" bug class.** Two structural lessons combined into one entry:

#### 1. The corpus bundles document themselves — read them

Each `.sit` / `.rsrc` ships **author-supplied NAMED resource labels** in the resource fork's resource map. `parseResourceFork` exposes them as `r.name` per entry. For two months we wrote `slugify(r.name) || \`cicn-${r.id}\`` into the decoded manifest as the KEY and threw the original label away. Meanwhile:

- **`1138` alone documents 442 NAMED resource labels.**
- **17 of 18 bundles** carry labels. `windows-31` + `windows-95` are the only zero-label ones.
- **6,842 NAMED labels** aggregated across the corpus. Each is the bundle author's own primary-source role label — written when the cicn was designed, in MacRoman, by the person who knew what they meant.

This is more authoritative than:
- The 1.8.2 + 2.3.1 kDEF decompile (which gives the dispatch model, not the role labels).
- Apple's `Appearance.h` / `IconsCore.h` enums (which give role pegs, not Kaleidoscope's storage ids).
- The surviving Kaleidoscope-era public docs (Companion + FAQ; second-hand quotes of the bundled docs that are locked in the installer's compressed payload).
- The reference image pixel-probe (verifies the runtime; doesn't tell us the author's intent).

The corroborated table now lives at `docs/spec/corpus-corroborated-ids.md` (auto-generated by `scripts/dump-author-hints.mjs`). Highlights that resolved long-standing spec "(?)" entries:

- **`-3790`** → `"Snap-To-Grid"` / `"Grid Arrangement"` (n=3) — **NOT a volume icon**. Two months of LEARNINGS / spec / demo prose was wrong. Apple's actual volume icon is `kGenericHardDiskIconResource = -3995`. The codex slot is now `finder-header-badge`.
- **`-10223`** → `"Progress Bar: Lavender"` (n=6) — confirms the codex T1 hypothesis with primary-source citation.
- **TMPL 129 cinf byte layout** — shipped in 16 of 18 bundles. Resolves §3.5 "(?)" for byte[2]=Tile Sides + byte[3]=Pattern Anchor + bytes[4..17] full pixel-coord map.
- **Corner-sprite vs cicn-template chrome convention split** — provably real per author labels: corner-sprite path uses `-14336 inactive / -14332 active`, cicn-template uses `-14336/-14335`. Same id range, different draw path.

**Application.** Whenever asked "what is id X for?":
1. `grep -E '"sourceCicnId":\s*-?X\b' docs/spec/corpus-author-labels.json` → see every bundle's author label.
2. `grep -E '\\| X \\|' docs/spec/corpus-corroborated-ids.md` → see the cross-corroborated consensus.
3. Only then consult Apple's enums (`docs/spec/apple-primary-source.md`) for the role peg.
4. Only then consult public Kaleidoscope archives (`docs/spec/kaleidoscope-author-docs.md`) for period community knowledge.
5. Only then guess.

The decoder now wires `authorLabel` onto every chromeElement + pattern (commit `ebeb57b`) so the runtime can read primary-source role labels directly from `theme.manifest.chromeElements[slug].authorLabel`.

#### 2. The prior decompile is in git history + .scratch — look there before re-searching

`docs/tracking/kdef-disassembly-findings.md` was committed in `75f4b69` (May 2026) — the 1.8.2 binary archaeology pass — then retired by `8fdf294` ("prune stale window-model docs") when the project moved to 2.3.1 as the reference. The findings stayed VALID for the structural facts (QuickDraw + CopyBits, kDEF themes surroundings + Appearance Mgr draws controls, only 4 hardcoded `_GetResource` calls), but the doc was archived rather than evolved.

`.scratch/iso-recon/` carries the Apple Mac OS 8.5 System file (`85-System.bin`) decompiled — `WDEF-125.asm` (Platinum WDEF), `CDEF-n1.asm` (button family), `CDEF-n63.asm` (track family), `wdef125_decomp.c`, `pef-decompress.py` (the PEF data-section decompressor), `findings/appearancelib-spike.md` (DrawThemeButton TVector decoded — proves it's a thin dispatcher on a theme-provider vtable +0xCC; data/drawer split confirmed).

When the user surfaced "we some week ago decompiled it," I had to be reminded to look in `.scratch/` and git history — I'd been chasing online sources instead. Restored to `docs/spec/`:

- `docs/spec/kdef182-disassembly-findings.md` (from `75f4b69`)
- `docs/spec/apple-appearancelib-spike.md` + `apple-cdef-geometry.md` + `apple-cdef-button-geometry.md` (from `.scratch/iso-recon/findings/`)

**Application.**

- Before chasing online primary sources, run `git log --all --oneline -- 'docs/**'` and `git log --all -S "<keyword>"` to surface any prior work that was removed by a later commit. The history is searchable; relying on online archives for things we ourselves wrote and then deleted is wasted effort.
- `.scratch/` is gitignored but PERSISTS across sessions — when an agent says "I'll save artifacts to `.scratch/`," they survive. Future searches for "where's the kdef decompile" should include `find .scratch -name '*.asm' -o -name '*decomp*'`.

#### Citation chain for "what role does id X play"

```
corpus-corroborated-ids.md   (n bundles agreeing on author label)         ← primary
   ↓ if missing
apple-primary-source.md      (Apple Appearance.h / IconsCore.h enum)       ← role peg
   ↓ if missing
kaleidoscope-author-docs.md  (Companion + FAQ Wayback archives)            ← period community
   ↓ if missing
kdef231-reference.md         (2.3.1 binary decompile)                      ← runtime model
   ↓ if missing
kdef182-disassembly-findings.md  (1.8.2 binary archaeology)                ← cross-engine
   ↓ if missing
apple-appearancelib-spike.md  (Apple System code reverse-engineering)      ← OS reference
   ↓ if missing
probe-reference-slot.mjs     (pixel-match against bundle reference PNG)    ← visual ground truth
```

Each layer is a separate primary-source channel. The earlier layers are higher-authority. Guessing is now the last resort, properly.

---

## 2026-05-30 — Post-batch citation-coherence pass: a reusable checklist

After a big batch lands (the 2026-05-29/30 overnight pass was 30+ commits + 8 new spec docs), the failure modes that creep in aren't decode errors — they're **drift in human-readable references**: a slug rename that updated the canonical doc but not the half-dozen cross-references, a new spec doc added without an entry in `docs/spec/README.md`, a CLAUDE.md pointer to a section that got moved. None of these break the runtime; all of them make the next person (or agent) chase a wrong lead.

Running a citation-coherence pass after a big batch caught 9 fixes out of 15 findings on that batch. The methodology is mechanical enough to be checklist-able:

1. **Cross-grep the "high-risk" identifiers the user flagged in the batch** — addresses (`0x...`), enum values, slug names, role labels. Anything the maintainer corrected partway through is at risk of remaining stale in docs that mention it.
2. **Cross-reference every `docs/spec/<name>.md` mention against `ls docs/spec/`** — broken links to renamed/deleted files surface here.
3. **Spot-check `kdef-faithfulness-ledger.md` rows** — every divergence row needs `asm address + file:line + "why we diverge"` all present.
4. **Spot-check the newly-added docs for asm-address citations on every "the kDEF does X" claim** — new docs are most likely to have the unsourced assertions that grow into folklore.

The fix surface was exclusively human-readable comment + table-cell text (no runtime behavior); `npm run gates` stays green throughout. The worked example is at `docs/archive/overnight-coherence-review.md`; the checklist above is what survives.

**Application.** After any batch ≥ ~10 commits that touches `docs/spec/` or renames slugs, run the four-step check before declaring the batch done. Most of the time it finds nothing; when it finds something, it's a 5-minute fix that would have cost an hour for someone tracking down the wrong address two months later.

## 2026-05-30 — Silent prod-skinning failure: Firefox/Safari restored `<input type="checkbox" checked>` as unchecked

**The symptom.** User reported the GH Pages landing rendering with no chrome on the cards — toggle showed "skinned: on", but the four feature windows came up as plain HTML with light borders. No console errors. Folder strip + `?theme=` URL parsing still worked, so the boot script did run partly. Owner's screenshot caught the smoking gun: the checkbox itself was visibly UNCHECKED next to a label that said "skinned: on".

**The cause.** Firefox + Safari preserve user-modified `<input>` state across reload — even when the HTML attribute says `checked`. If the user ever toggled OFF and refreshed, the box came back off. My boot's `if (toggle.checked) await mountPowers()` skipped the mount; nothing else painted chrome. The label stayed "skinned: on" because it was set ONCE in the static HTML and only re-set inside mountPowers/unmountPowers, so it could lie about reality. A pure form-state-restoration interaction — no bundle drift, no env diff between dev and prod (local `vite preview --config vite.demo.config.js` reproduced the working render fine until the cache was simulated).

**Fix.** Three defensive layers, all in `demo/index.html`:
1. `autocomplete="off"` on the input (works in Chrome, partial in Safari < 16, ignored by old Firefox).
2. Programmatically `toggle.checked = true` on boot — overrides whatever the browser restored.
3. Sync the label to actual state on boot AND on every change — `toggleLabel.textContent = toggle.checked ? 'skinned: on' : 'skinned: off'` — so the label can never desync from reality.

The 3-layer defense matters: each individual mechanism has browser/version gaps; together they catch the cache override regardless of which browser engine quirk is in play.

**Tooling that surfaced this faster.** Added `npm run preview:demo` (a `vite preview --config vite.demo.config.js` wrapper at `/aaron-ui/` base path) so we can hit the actual minified bundle locally before push. Cuts the diagnosis loop from push-deploy-wait to a 3-second restart. The bug wasn't bundling-deterministic, but the workflow is the right one for the next time something IS.

**Generalisable lesson.** When skin/render state is derived from a form control's `.checked`, never trust it on boot. Always read the state from a source of truth you OWN (URL, dataset attribute, application state object), and force the form control to match. Visible labels must follow the same rule — derive from the source-of-truth at update time, never set-once-then-forgotten.

## 2026-05-30 — Mobile perf audit: 6.7MB of theme archives loading on first paint for icons users hadn't looked at

**The symptom.** Owner reported the landing page had performance issues loading on mobile and asked for runtime-slotting focus (the .sit decompression cost being a known constraint they'd already accepted). Dispatched a network/runtime perf reviewer with a Playwright harness emulating Pixel 5 + Fast 3G (1.6 Mbps / 562ms RTT) + CPU 4× throttle. First-window-painted measured at ~8300ms; time-to-interactive at ~38 seconds.

**The cause.** `themePicker.ts:126` was firing `Promise.allSettled` on all 18 themes at mount with a comment promising "18 parallel decodes wall-time ≈ max(1)". On a desktop with wifi + an idle 8-core CPU that's true. On mobile, all 18 contend for the 6-connection HTTP/1.1 budget AND for the main thread for decode (StuffIt unwrap + resource-fork walk + cicn rasterise + Mac 1.8 → sRGB 2.2 gamma transform). Each finished archive (some up to 1.65MB for evolution) blocked the main thread for ~400ms during decode. The output was 32×32 folder-icon srcs for tiles the user might never look at.

Compounding the picker preload: (a) the demo had a top-level `await Promise.all(document.fonts.load(...))` blocking the entry chunk for ~700ms while the library's own `preloadFonts()` gate inside mountDeclarative would have covered it anyway; (b) every `.rsrc`-only theme (5 of 18, including the page default `1138`) ate a wasted ~580ms `.sit` 404 because `loadTheme`'s source hint wasn't being threaded from the manifest the resolver already had; (c) every theme then fetched its own `meta.json` (18 × ~660ms RTT) even though the manifest already carried name/author/year.

**Fix.** Five-part landing in commit `6f1d6fc`:

1. **Lazy picker decode via IntersectionObserver** — placeholder shown immediately (the dotted-outline CSS shipped in the boot affordance pass), decode triggered only when a tile intersects viewport (or on click). Active tile decoded eagerly (it's already being loaded for the page chrome). Decode queue capped at 2 concurrent + yields via `requestIdleCallback` between decodes.
2. **Drop demo's inline font-await + `<link rel=preload>` in `<head>`** — the woff fetches now start in parallel with JS download instead of after it.
3. **Thread `source` hint manifest → resolver → loadTheme** — the resolver builds a `slug → ThemeHint` index at construction time; `loadByUrl` looks up the hint and passes `source` through. Kills the wasted `.sit` 404 RTT for `.rsrc`-only themes.
4. **`opts.meta` short-circuits loadTheme's `meta.json` fetch** when the manifest already has the data. Resolver passes through automatically.
5. **The post-mount canvas-existence sanity check became deletable** in the demo's boot script because `MountHandle.stats` from the earlier reviewer-audit landing already covers that signal — same code, but now consumed via the published API surface rather than a probe.

**Measured result.** Same Pixel 5 + Fast 3G + CPU 4× harness:
- First window painted: 8300ms → **3044ms** (-63%)
- Theme archives loaded in first 10s: 18 (6.7MB) → **4** (~750KB)
- meta.json fetches in first 10s: 18 → **0**
- Wasted .sit 404s on .rsrc-only themes: 2 → **0**

The 4 themes that load are exactly the tiles intersecting the default viewport (1138 / 1984 / 1990 / animals). The other 14 wait for scroll or click. New ceiling: ~3s, gated by 1138's 725KB `.rsrc` download — the perf agent's exact architectural prediction.

**Generalisable lesson.** "Preload everything in parallel" performance reasoning is desktop-shaped. Mobile pricing is different along all three axes:
- **Network**: connection-pool contention (HTTP/1.1's 6-connection cap turns 18 parallel into 3 waves of serialized fetches; each wave is RTT-bound)
- **CPU**: a 400ms decode on a desktop core is ~2s on a mid-range ARM core, and contends with the main thread the user is trying to scroll on
- **Battery**: every byte downloaded and decoded is unsubsidized by user attention

The cheaper pattern, when work can be deferred without affecting first paint: show the structural placeholder synchronously, decode on demand. IntersectionObserver + a small concurrency cap + yields cover almost all "preload N things" cases. Comment claims about "wall-time ≈ max(1)" should be measured on the slowest device profile you intend to serve, not the development machine.

The 2-reviewer pattern (perf + UX in parallel) paid off again here: the UX reviewer's "dotted-outline placeholder" CSS work (in `87b30f9`) was already in place when the perf reviewer's "lazy-load" recommendation landed — the visual affordance for the now-deferred work was already shipped. Convergent design.


## 2026-05-30 — Two `:root` blocks, one stylesheet, and 80% of boot affordance silently never ran

**The symptom.** Diagnostic Playwright probe spawned to verify the corner-sprite code-split (#191's P5) flagged a `console.warn` from the scanner — `"bootAffordance is enabled but scriptoscope.css is not loaded"` — even though the CSS file was returning HTTP 200 with 10869 bytes and `document.styleSheets` reported it loaded with 14 rules. Probing `getComputedStyle(document.body).getPropertyValue('--scriptoscope-wipe-duration')` on a fresh Chromium page returned empty string. The CSS file as served had the var declared on line 140 inside a `:root` block. The browser's CSSOM saw only ONE `:root` rule (the first block, at line 27) with five vars and none of the boot-affordance variables.

**The cause.** A nested-comment trap that survived a "fix" that just moved it.

`scriptoscope.css` had a documentation comment block opening at line 118 and closing at line 136. Inside it, two example lines:
```
     /* opt out an element entirely */
     .my-window { animation: none !important; } */
```
CSS does not nest block comments. The first `*/` (on the "opt out" line) closes the outer comment early. The `.my-window` line then leaks into the stylesheet as a real CSS rule. The trailing `} */` produces a stray `*/` token that the parser is supposed to recover from by skipping to the next top-level recovery point — and in Chromium that recovery consumes the entire next `:root { ... }` block. Net effect: the second `:root` (containing `--scriptoscope-wipe-duration`, `--scriptoscope-icon-fade-duration`, `--scriptoscope-placeholder-color`, `--scriptoscope-placeholder-bg`) silently vanishes from the parsed CSSOM. Every rule that referenced those vars (the wipe-in animation, the icon-fade animation, the picker placeholder outline) had `var(--undefined)` with no fallback, which makes the property invalid → animation never runs, placeholder has no outline.

The "fix" attempt that didn't fix: I removed the example code and wrote a warning comment saying "do not put `` `/* */` `` markers inside this comment." The backticks have no meaning in CSS — the literal `/* */` inside the warning IS a `/*` and a `*/`, which reintroduced the exact bug being warned against. Diagnostic probe still failed; second-pass fix had to spell out the markers without ever writing the literal characters.

**The signal that almost caught it earlier.** The "scriptoscope.css is not loaded" `console.warn` shipped in the 2026-05-30 a11y audit (commit `2b2b0ff`) as a silent-fail defense for consumers who opted into the affordance but forgot the `<link>`. It worked as designed — the warning fires whenever `--scriptoscope-wipe-duration` doesn't resolve on the loading element, which is true whether the file is missing OR the file is loaded but the var declaration was lost in a parse error. The warning was firing in production from the day the file shipped, but on a page that visually looked fine (the chrome rendered, the picker worked, the boot affordance just didn't animate). It took dispatching a probe for an UNRELATED reason (verifying the corner-sprite code-split) and noticing the warning in console output to surface it.

**Fix.** Three lines:
1. Replace the example block-comment markers in the documentation with prose (`":root with --scriptoscope-wipe-duration: 200ms"` instead of `:root { --scriptoscope-wipe-duration: 200ms; }`).
2. Replace the warning about block-comment markers with prose that names them by description rather than by character ("do not write a block-comment open or close marker anywhere inside this header").
3. Rebuild the demo; the diagnostic probe now shows `--scriptoscope-wipe-duration: 140ms` resolved on `document.body`, 0 console errors, 0 warnings.

**Generalisable lesson.** Three layers:

1. **CSS parsers fail silently and locally.** A syntax error 20 lines from a `:root` block can drop the entire `:root` block from CSSOM without any console message, any compilation error, any tooling complaint. The browser is spec-compliant; the spec mandates skip-to-recovery on a token error. The only signal is "the var doesn't resolve" — and `var(--undefined)` is itself silent (the property becomes invalid; no warning).

2. **Documentation about a footgun must not commit the footgun.** Writing about `/* */` inside a CSS comment is the same as writing `/* */` for the parser. The same shape applies in shell (`# don't use $(rm -rf)` in a heredoc), in regex (`# avoid .*?` inside a regex character class), in SQL (`-- don't write '; DROP TABLE` inside a string literal). When documenting a parser-level footgun, either use prose to describe the offending syntax without producing it, or use a parser-level escape mechanism (here: there is none for CSS comments). The "warn against the bug" comment is exactly where the bug hides.

3. **A noisy-but-survivable warning is worth its weight.** The silent-fail defense added on 2026-05-30 didn't prevent the bug, but it surfaced it the next time anyone ran a Playwright probe with console capture. Without the warning, the boot affordance could have stayed broken for months — visually fine, functionally degraded, no signal. Build that pattern into any feature whose failure mode is "still kind of works."

**The discovery path was also worth recording.** Code-split work (#191 P5: dynamic-import the corner-sprite compositor) required a Playwright probe to verify the chunk loaded for some themes and not others. That probe captured `console` output. The warning surfaced; the corner-sprite verification became secondary. Tooling built for one purpose surfacing an unrelated bug is a sign the tooling has the right granularity.

## 2026-05-30 — Post-P5 + CSS-fix perf re-measurement

Re-ran the live Pixel 5 + Fast 3G + CPU 4× harness against the production
GH Pages bundle at commit `330443e` (P5 corner-sprite code-split + the
boot-affordance CSS bug fix described in the previous entry). Numbers vs
the perf-batch end measurement (3044ms local, post-P3..P6):

| metric                          | this run (live) | prev (local) |
|---------------------------------|-----------------|--------------|
| First window painted            | 3247ms          | 3044ms       |
| Theme archives in first 10s     | 4               | 4            |
| Total bytes in first 10s        | 1144 KB         | ~750 KB      |
| meta.json fetches in first 10s  | 0               | 0            |
| Wasted `.sit` 404s              | 0               | 0            |

The first-window-painted variance (~200ms) is within CDN/3G simulation noise — the live run rides through GH Pages' real geographic RTT on top of the synthetic Fast 3G latency. The byte difference is a similar story (the production CDN's headers, fingerprinting params, and theme tile ordering vary).

P5's expected savings (~8KB code-split chunk for the 14 non-corner-sprite themes) is ~40ms on Fast 3G — below measurement floor. The win is structural rather than wall-clock-visible at this connection profile: a future heavier corner-sprite compositor would have grown the main chunk; this isolates that risk to the four themes that actually need it.

**The bigger qualitative change isn't in these numbers.** Before the CSS fix, the boot affordance's wipe-in + icon-fade + placeholder-dot animations had `var(--undefined)` references → invalid property values → silently disabled. The page reached "first window painted" in the same ~3s but with a popcorn-like rendering — chrome appearing instantly when its texture finished decoding, no transition cover. Post-fix, the wipe reveals the chrome smoothly over the consumer's already-visible markup; perceived perf at the same 3s wall-clock improves a level. The metric-vs-feel gap matters here.

**Generalisable lesson.** Numerical perf tracking measures the timing axis; it cannot distinguish "renders fine" from "renders fine with a smooth transition." When fixing a feature that's only visible during the loading window, re-measure the metric, but ALSO eyeball the deployed bundle on the slowest profile you intend to serve. Some "wins" don't move the chart and some chart-flat changes are felt.

## 2026-05-31 — The layout-patch chain: stop bandaging, refactor to Posture B

A week of accumulated layout bugs in the declarative front door, each with a
plausible "small fix," ended in a posture refactor (`cf267ac`) that retired
half the scaffolding. Worth recording as a chain because no single patch was
the mistake — the mistake was iterating along an axis that the architecture
wouldn't carry.

### The chain

Starting point (pre-2026-05-26): every promoted host was created as
`position: absolute` and positioned at the source element's captured
`getBoundingClientRect`. The scanner pre-captured rects for all hosts in a
single pass before promote, then handed them via a WeakMap to
`ScriptoscopeWindow.promote`. To keep the rest of the page from collapsing
when a host went absolute, the scanner pinned each ancestor's `min-height` to
its captured height. Cumulative chrome growth across sibling hosts was
tracked in a `cascade` shift counter.

That posture mostly worked. It also produced a steady drip of bugs whose
fixes accumulated:

1. **`21d176f`** — added `extra-width`/`extra-height` because the theme-
   picker's runtime-populated tiles grew the chrome post-promote, showing
   nested scrollbars in the gap before auto-resize caught up. Same commit
   added class inheritance from source el onto host (without it, consumer
   CSS targeting `.my-class` was orphaned on the now-removed source).
2. **`4c9bf85`** — wired `ResizeObserver` always (not just for explicit-
   fit) + emit a 500 ms / 30 px growth warning with a copy-paste fix
   pointing at `extra-height`.
3. **`ba984fe`** — `display: block` lockdown on the host, because
   inherited consumer classes like `.card { display: grid }` were
   collapsing the host's box and decoupling it from the chrome canvas.
   Also fixed natural-rect fit semantics (use `width: 100%` not
   `max-content` when we have a natural rect — the max-content path was
   silently measuring the longest unwrapped line of prose). Added a
   px-only cap on `max-width`/`max-height` (`parseFloat('100%')` returned
   100, not NaN, so % was being treated as a 100px cap → Read Me window
   collapsed to a 100 px-wide column).
4. **`d8df2ef`** — extended lockdown to `padding`, `border`, `background`.
   `padding` was offsetting the canvas inside the host's box (stripes of
   host-bg visible); `border` was double-framing; `background` was
   showing through transparent chrome corners.

### The refactor (`cf267ac`)

The FE reviewer running against the post-#4 codebase recommended a posture
inversion: stop trying to mimic in-flow layout via absolute positioning, and
just **be** in-flow by default. Hosts default to `position: static`. Setting
`-x` or `-y` opts into absolute (the original posture, now scoped to overlay/
desktop use cases). The drag handler converts static → absolute on first
move so a dragged window lifts out of flow cleanly.

What got deleted:
- Pre-capture pass in the scanner.
- WeakMap `inheritedRect` handoff (file deleted in `0652704`).
- Ancestor `min-height` pinning.
- The `cascade` shift counter for in-flow paths.
- The demo's `.powers-readme { position: static !important }` workaround.

What remains:
- The class-inheritance + lockdown decisions from #1-#4 (those were
  about chrome correspondence, not posture).
- `ResizeObserver` auto-fit (the growth-warning still helps consumers).
- Absolute path via `-x`/`-y` for overlay/floater use cases (unchanged).

The owner's framing was the key insight: dogfooding the runtime on the
demo's own landing page (the cards, theme picker, Read Me article) generated
more bug pressure in two weeks than 17 themes of faithful-chrome work
generated in a month. The runtime had been designed for the absolute-overlay
use case (Mac desktop scatter); the landing exercised the in-flow case
(article-like cards in a grid). The patches in #1-#4 were each making the
absolute path mimic in-flow better. Posture B accepts that the in-flow case
is the more common one and serves it natively.

### Post-refactor P0s caught by the FE reviewer (`0652704`)

The Posture B refactor itself shipped two latent regressions that a focused
review surfaced before any user hit them:

- **Persistence**: `readHostPosition` returned `(0, 0)` for in-flow hosts
  (whose top/left were never authoritative). Persistence wrote those. On
  reload, the scanner restored `data-scriptoscope-x="0"`/`y="0"` from
  storage — which triggered the absolute-opt-in path. Result: every
  undragged window would yank to viewport origin on the first
  persistence-enabled reload after the refactor. Fix: only persist
  position when the host is genuinely absolute.
- **Lying lockdown comment**: the in-flow path set
  `host.style.position = 'static'` inline, then the doc-comment claimed
  consumer-class CSS for position/top/left still applied. Inline beats
  class. Fix: clear the inline (`host.style.position = ''`) so consumer
  class CSS — and the UA static default — actually take precedence.

### Generalisable lessons

1. **Posture > patches.** When the third bug in a row asks the same
   primitive to behave like a different one (absolute pretending to be
   in-flow), the bug is the primitive choice, not the patches. Each fix
   in #1-#4 was technically correct AND made the system more brittle by
   adding scaffolding that the next bug had to navigate.

2. **The dogfood gradient surfaces the real workload.** The faithful-
   chrome corpus stressed the decode model; the landing page stressed
   the consumption layer. If your library has a consumption layer, USE
   IT FOR SOMETHING NON-TRIVIAL IN YOUR OWN REPO — the test suite won't
   surface "consumer class inherited onto the host silently kills the
   layout" because tests don't ship consumer classes.

3. **Layout-affecting CSS from consumer classes is a load-bearing
   security boundary.** Moving an element's DOM identity to a new host
   means the new host inherits the consumer's classes (you need this
   for selector continuity) AND inherits any layout-affecting CSS those
   classes carry (you don't want this — your chrome's box correspondence
   breaks). The split has to be enforced; you can't just hope consumers
   write only color/font rules. The lockdown set
   (`display`/`box-sizing`/`padding`/`border`/`background`) is the
   minimal viable defence; extend it when a sixth property bites.

4. **CSS shrinks-and-grows asymmetrically.** A `ResizeObserver`-driven
   auto-fit must only GROW past the captured baseline, never shrink —
   transient layout collapses (image flicker during reflow, font swap
   mid-paint, scrollbar gutter appearance) routinely produce smaller
   measurements for a frame or two, and shrinking the chrome in response
   yanks the visible window underneath the user.

5. **A noisy-but-survivable warning earns its place.** The 30 px / 500 ms
   growth warning surfaces "you should have declared `extra-height` here"
   without breaking the auto-fit fallback path. Same pattern as the
   boot-affordance CSS warning that surfaced the nested-comment bug
   (`2026-05-30 — Two :root blocks` entry): warn loudly, degrade
   gracefully, let the next person catch the report.

6. **A refactor with no architectural test surface is half-done.** Both
   the persistence P0 and the lying-lockdown P0 were invisible to the
   typecheck + unit test gates. They surfaced only on a targeted FE
   review of the diff. Posture-B test coverage should include flex/grid
   parent, transformed ancestor, persistence round-trip on in-flow
   windows, and drag handoff under scroll.

### Application

- New layout-touching code goes in `ScriptoscopeWindow.promote`'s
  documented comment block (lines 95-227), not in the scanner. Posture
  decisions live with the host, not with the scan.
- Any future "small fix" to layout that adds more scaffolding around the
  absolute path should trigger this entry as a re-read.
- The `WindowManager.setPosition(host, x, y)` chokepoint (mentioned in
  the FE review as the v2-reflow groundwork) is still un-built. Geometry
  mutations remain scattered across `interactive.ts` drag/keyboard
  handlers, `scanner.ts` cross-tab restore, and `ScriptoscopeWindow.promote`'s
  absolute branch. Worth landing before v2 reflow features start.

## 2026-06-01 — Post-Posture-B polish: the chokepoint, the ninth lockdown bit, the dev/prod CSS gap

A 12-commit working day immediately after the Posture B refactor (entry above) filled in the architectural gaps the FE reviewer flagged but the refactor commit didn't itself close. The pattern is interesting on its own: a refactor surfaces its own follow-on work, and the follow-on work is uniformly smaller and more defensible than the original patches it replaced.

### The chokepoint the Posture B entry said was "still un-built"

Same day the entry was written, commit `6152f17` landed `WindowManager.setPosition(host, x, y)` and `WindowManager.toAbsolute(host)` in `src/interactive.ts:680-720`. Drag, keyboard-arrow, and the Posture-B handoff funnel through them; `setPosition` fires `onChange` so persistence + consumer event listeners see every commit from a single site. The previous state — `host.style.left = '…'` scattered across three handlers and the scanner — was the genuine v2-reflow blocker the entry called out. Closing it took ~60 lines.

Follow-on (`2026-06-01`): the FE reviewer caught that the chokepoint had three remaining bypass paths — promote-time initial placement, pointer-drag mouseup commit, and cross-tab restore. Routed all three through `setPosition`. The chokepoint contract is now "every committed move" (the pointermove hot loop intentionally bypasses for 60Hz smoothness, then `setPosition` fires once on pointerup).

### The lockdown set grew from 5 to 9 properties over 36 hours

The Posture B entry predicted: *"extend it when a sixth property bites."* The sixth was `overflow` (`2fbe0b3`) — a consumer-class `overflow: auto` on a card row was clipping the chrome canvas's outer 2-6px edge. The FE reviewer then predicted the next bleeds: `margin`, `transform`, `filter`. All three landed in the lockdown set defensively. The current set is `display, box-sizing, padding, border, background, overflow, margin, transform, filter` — nine properties.

Lesson: the prediction was right and the prediction's lead time was hours, not weeks. Layout-affecting consumer CSS bites in a long tail. The lockdown set is "current," not "complete." The next bleed will surface in real-consumer-CSS, not in our demo.

### Dev served a different stylesheet than prod for ~36 hours

The boot-affordance CSS warning (the noisy-but-survivable warning praised in the Posture B entry's lesson #5) fired in production from the day `scriptoscope.css` shipped, because the dev server didn't serve it at all — the `<link rel="stylesheet" href="scriptoscope.css">` in the demo 404'd silently in dev, while the prod GH-Pages bundle resolved it fine. Owner only noticed when a Playwright probe spawned for an unrelated reason caught the warning in console output.

Fix (`2fbe0b3`): a 12-line Vite middleware (`vite.config.js` `serve-scriptoscope-css`) that serves `src/scriptoscope.css` at the same URL the prod build outputs. Dev and prod now serve byte-equivalent stylesheets. Same commit added the native-scrollbar hide on `.scriptoscope-slot` and `[data-scriptoscope-theme-picker]` so the period-correct themed scrollbar isn't visually doubled by the OS one (visible under macOS's always-show-scrollbars setting). Consumer opt-out: `scrollbar-width: auto` on either element.

### The themed-horizontal-scrollbar-for-picker gap is now an acknowledged TODO with a workaround

The picker strip uses a mask-gradient at the right edge to signal scrollability because no themed horizontal scrollbar exists yet. The in-CSS comment at `src/scriptoscope.css` is the authoritative record. When the gap closes (a real themed horizontal scrollbar that drives the picker's scrollLeft), drop the picker from the hide list.

### Posture-B test battery now uses real pointer events

The original drag-handoff test poked `host.style` directly to mimic what the handler does — would pass even if the handler was deleted. Tightened to use Playwright's `page.mouse.move/down/up` on the chrome's title-bar coordinates. Five tests now: inline-position-cleared, real-pointer drag-handoff, persistence round-trip on in-flow, no-ancestor-pin, max-height-respected. All pass against the production bundle.

### Generalisable lessons

1. **Refactor + follow-on is a unit.** The Posture B commit alone was half the work; the chokepoint, the sixth-through-ninth lockdown bits, the dev/prod parity middleware all landed in the next 24 hours. A retro that only looks at the refactor commit misses the cost.
2. **Dev/prod stylesheet parity is its own gate.** The Vite middleware should have shipped with the original `scriptoscope.css` introduction; the only reason it didn't is the dev server's silent 404 looked like "working as intended" to a contributor who'd never visited the prod URL. Future first-party assets get the same treatment.
3. **Acknowledge gaps in shipped comments, not TODO files.** The horizontal-scrollbar gap is in `scriptoscope.css` as a paragraph the next person opening that file will read. A separate TODO file would have rotted.
4. **Tests must fire real events, not mimic them.** A test that pokes style directly to simulate a drag passes even if the handler is deleted. Same shape as the React "you forgot to call setState in your test" anti-pattern. Posture-B tests now drive real pointer events; the test fails if `toAbsolute` is removed from the handler.
5. **Chokepoint compliance is a verifiable property, not a goal.** "All geometry mutations route through setPosition" is testable: grep for `host.style.left` outside the chokepoint helpers. If it's there, the chokepoint isn't one. The FE reviewer's audit found three bypass paths the refactor missed; the test gate that should exist is "interactive.ts + scanner.ts + ScriptoscopeWindow.ts contain zero `host.style.left` assignments outside `WindowManager.setPosition` / `toAbsolute`."

## 2026-06-01 (later) — Picker UX: special tiles + modal-as-themed-window

User-driven UX restructure that nearly added a library API and ended up not needing one. Two demo-side affordances (top-right "See the bare HTML" toggle + dashed-box drop zone below the picker) moved INTO the theme picker as folder-style tiles, and the drop zone became a themed `movable-modal` window triggered by clicking its tile.

### What was tempting: a library API for "special tiles"

The picker's tile-rendering loop is library-owned (`data-scriptoscope-theme-picker` auto-populates from the `themes` array). The natural reflex was: extend the library API so consumers can pass "non-theme" tiles alongside themes, with their own click handlers. That would have meant a public type, a position knob, an a11y contract, a roving-tabindex carve-out for non-tile children — a real API surface to maintain.

### What shipped instead: CSS `order` + a distinct CSS class

The demo pre-seeds two `<button class="powers-picker-special-tile">` elements inside the picker container BEFORE `mountDeclarative` runs. The library's scanner only promotes elements matching the theme-tile selector — special-tile is a different class, so the library walks past them. CSS `order: -1` / `order: 99` places them at the strip ends without depending on DOM order. Event delegation on the picker container handles their clicks (one listener, two `data-special` branches).

The library knows nothing. No API extension. No version-coupling between demo and library.

### One real bug surfaced in review

The picker's "Load your own" click handler opens the modal synchronously, but if the runtime is currently un-skinned, the modal article (a `data-scriptoscope-window`) was un-promoted by the prior `handle.disconnect()` — so opening the wrap would show bare HTML inside the backdrop until `mountPowers()` resolved later. Fix: `await mountPowers()` BEFORE `openModal()` in the click handler. Two-line guard, caught only on second-pass FE review.

Generalisable: any "opens this themed window" gesture that fires while the runtime might be disconnected has to await re-mount first. Same pattern would bite any consumer wiring "open my themed modal" from outside the runtime's lifecycle.

### Modal-as-themed-window: free demonstration of the third window-type

The drop-zone modal is a real `data-scriptoscope-window-type="movable-modal"` — promoted at mount time like any other window. The demo wraps it in a `position: fixed; visibility: hidden; opacity: 0; pointer-events: none` container, then toggles a `.open` class on the wrap. Backdrop click + Escape close it.

Free byproduct: the demo now exercises THREE window-types (document, titled-utility, movable-modal) where it previously exercised two. movable-modal had been runtime-supported but never demo-shown. The picker UX restructure surfaced it for free.

### README slim — gotchas as their own doc

Same-day docs reshape: the README's 200-line "Integration guide" extracted to `docs/integration-edge-cases.md`, with a 6-line "Three things to know up front" callout in the README pointing at it. The previous README read as "here are 200 lines of things that will break your page"; the new one reads as "drop these two URLs in, here's what you can tag — link to deeper docs when you hit something weird."

Bundle-size claims also went from drift-prone hand-counts (187 KB) to actual measurements (220 KB raw, 66 KB gzip — the docs auditor's drift catch). Worth scripting before the next release: `node -e "console.log(require('fs').statSync('dist/scriptoscope.js').size)"` plus `gzip -c dist/scriptoscope.js | wc -c` baked into a `npm run audit:doc-claims` gate.

### Generalisable lessons

1. **When a demo wants something the library doesn't expose, ask first**: can I do it ENTIRELY in demo-side HTML/CSS/JS using existing library extension points (event delegation, distinct classes, opt-out stamps)? If yes, the demo absorbs the complexity and the library stays small. If no — if the demo would need to reach into library internals or duplicate library logic — then build the API. The picker tile case was the first; future cases (custom title-bar widgets, per-window menu hooks) should ask the same question.
2. **Modal-as-themed-window is the same trick** — the demo's `movable-modal` flow uses zero library API beyond what every promoted window uses. The wrap/visibility/`.open` plumbing is consumer-side. The runtime contract is: "you promote a window; you control visibility." Anything more elaborate (focus trap, autoclose-on-escape, backdrop-click-dismiss) is consumer wiring, not library wiring.
3. **The async-await trap of "open a themed window from outside the lifecycle":** if the runtime might be disconnected when the gesture fires, mount-then-open is the pattern. Two lines; easy to miss; caught only on review. Worth a one-line warning in `docs/integration-edge-cases.md` framework section if any consumer reports it.
4. **Drift-prone numeric claims need a CI gate.** Bundle sizes were stated three times in the README; the README slim updated two and missed the third. The same shape applies to "lockdown set is N properties" (changed 5 → 6 → 9 → 10 in five days; three docs to update each time). For these claims, source-of-truth should be runnable (`wc -c`, `lockdown.length`) and asserted in a doc-audit script.


---

## 2026-05-31 (later) — Three-reviewer lateral pass: widgets opt-in + scriptoscope:close event + openModal helper

After landing the picker UX work, I dispatched three reviewer agents through different lenses — period-Mac historian (Mac OS 8.5 Appearance Manager + classic HIG), library architect (consumer-DX vs library API), and product strategist (lateral use cases). The reports converged in two specific places where my recent calls were wrong from two independent angles, and split in their forward-direction recommendations.

### Convergence #1: the window-type pick yesterday was wrong twice over

I had set Read Me + Schemes Folder to `movable-modal` window-type purely as a 'pick a type whose canonical cicn has no widgets' hint, then accepted that 'schemes whose movable-modal cicn DOES paint close still close' as 'graceful degradation.' Both reviewers independently flagged this as the wrong call:

- **Period-historian lens**: `kThemeMovableModalWindow` (`movableDBoxProc`, def 5) was Apple's specific BLOCKING-but-draggable dialog type — Print options, registration, the modal-with-OK/Cancel that asks a question. A Read Me in 1998 was a SimpleText/TeachText document → `kThemeDocumentWindow`. A Kaleidoscope theme picker was a tool palette → `kThemeUtilityWindow` (slimmer title bar, persistent floater, doesn't take focus — Mac OS 9's actual Appearance CP was authored against this type).
- **Architect lens**: 'movable-modal as a hint for please-no-close' is markup lying about intent. A consumer who wants doc-window LOOK without close has zero recourse. The right primitive is `data-scriptoscope-widgets="close,zoom,collapse"` — opt-in subset; omit a widget to leave its cicn art drawn but the click inert.

The synthesis was clean and lands both fixes at once: ship the widgets attribute, revert the type picks. Read Me is now `document-window` + `widgets="zoom,collapse"`. Schemes Folder is now `titled-utility-window` + `widgets=""` (all painted widgets inert).

### Convergence #2: surface scriptoscope:close, delete the MutationObserver

Architect's #1 ROI call: the demo's modal had a `MutationObserver` watching for shadow-root-bearing elements being removed from the wrap — that was the close-detection signal. Reverse-engineering an internal lifecycle event from DOM removal is the smell. Fix: `ScriptoscopeWindow.unmount` dispatches a bubbling `scriptoscope:close` CustomEvent on the host BEFORE teardown. Demo modal listens at the wrap, removes 14 lines of observer. Every future consumer that wants 'do X on close' gets it free.

### Convergence #3: delete `pickerDecodeConcurrency`

Architect's #2: internal tuning knob that leaked through three layers of API surface. No consumer can sensibly tune it without reading the lib reviewer comment thread that calibrated it. Hardcoded inline at 2; re-expose if a real consumer hits a perf cliff.

### Period-correct addition: author credit byline

Period agent's #12 + strategist's authorship lens both surfaced 'corpus authors are invisible.' P0-light version: on every retheme, the Schemes Folder window shows 'Now wearing 1138 by Erik Ekengren · 1998' from the theme manifest's name/author/year fields (already there since the picker added them). Updates via the existing `retheme` event. Full About-this-Scheme dialog awaits the menu bar (P1 candidate) — needs a launch point.

### P1: handle.openModal() helper with focusin-based trap

Architect's #5: ~70 LoC of consumer modal wiring (visibility class, backdrop click, Esc, MutationObserver) compresses to one library call. Plus: the demo's hand-rolled modal was missing a focus trap, a real a11y bug. New `MountHandle.openModal(wrap, options?)` owns: attribute toggle (`data-scriptoscope-modal-open`), backdrop click, Esc key, focusin-based trap (cycles Tab/Shift+Tab inside, including shadow-DOM chrome buttons), focus restore on close, bubbled scriptoscope:close listener.

First focus-trap attempt intercepted Tab keys directly + cycled through a focusables array. Caught the 'Tab from last' case but missed shadow-DOM focusables that my finder didn't enumerate — Tab would escape to a DOM-next focusable outside the wrap. Switched to the standard `focusin` redirect pattern (react-aria / focus-trap / dialog polyfill): listen for any focusin event document-wide; if the new target is outside the wrap, redirect to the wrap's first focusable. Catches Tab, mouse-click, and programmatic focus changes uniformly. Caveat: `document.activeElement` at modal-open time is BODY (not the trigger) when triggered from a mouse click — so the API takes an optional `returnFocusTo` for accurate focus restore. Documented.

### What's left for the next pass

The convergent P0s are landed. The forward-direction divergence is unresolved (period agent wants menu bar + snd ; architect wants per-window addressing API; strategist wants museum page). User picked openModal for P1; the menu bar + museum are next-pass calls. The 'no-close' attribute that I un-shipped yesterday + the type-as-hint pattern are both gone from the codebase — superseded by the widgets-opt-in API.

The takeaway for the meta-rule (architect's #9): when a demo-side pattern is correctness-orthogonal, demo-side wins (less API surface, smaller library). When it's correctness-load-bearing — reverse-engineering library internals, missing an a11y guarantee — promote to library. The `scriptoscope:close` event + `openModal` helper are both 'correctness was leaking into the consumer'; the picker special-tiles + the modal CSS shell are 'visual style is the consumer's job, library shouldn't care.'




## 2026-05-31 (later still) — Drag-handoff page-shift fix: reserve the static slot with a placeholder

User report: dragging an in-flow window made the page visibly shift the moment the host lifted to absolute — siblings collapsed upward into the host's vacated static slot. The drag was technically working but the page-shift was disorienting, especially because the eye was on the window being grabbed.

### First attempt (wrong) — drop dragging for in-flow hosts entirely

The natural read of "drop the reflow on static→floating" was "drop the static→floating conversion." I deleted toAbsolute + the drag/keyboard-move handlers' calls to it, made in-flow windows non-draggable, and asked consumers to opt into dragging via `data-scriptoscope-x`/`-y`. The user immediately came back with "but now I can't move the windows?" — confirmed the wrong axis. Reverted in one command.

The lesson: my AskUserQuestion option labels conflated two different things. "Drop the static→absolute conversion (toAbsolute)" sounded like the right fix because it WAS what caused the page-shift, but the option's description said "in-flow hosts stay in-flow forever" — which the user read past. Either I should have labeled the option "Drop dragging entirely for in-flow hosts" OR (better) led with the placeholder option as recommended.

### Second attempt (right) — placeholder reserves the static slot

`WindowManager.toAbsolute(host)` now inserts a same-sized `<div data-scriptoscope-placeholder>` immediately before the host in its parent, then flips the host to absolute. The placeholder is display:block, width/height pulled from the pre-flip getBoundingClientRect, invisible + aria-hidden + pointer-events:none + zero margin/padding/border so it occupies exactly the host's footprint without leaving visible artifacts or absorbing clicks.

Lifecycle is a single cleanup point in `WindowManager.remove` (called from `ScriptoscopeWindow.unmount` and the manager's own internal teardown paths). Stored on the host element as a JS property (`host.__scriptoscopePlaceholder`) — keeps the lookup O(1) without needing a WeakMap or a side-channel registry. The placeholder persists for the window's lifetime, matching the Mac OS desktop behavior where a dragged window leaves a visible 'origin' gap until you put it back.

### Why a placeholder + not a ghost outline

A ghost outline (visible dotted rectangle showing where the host was) is the period-Mac drag-resize pattern (CDEF-130 / WDEF-125 both draw outlines during interactive resize/move). But for STATIC→ABSOLUTE handoff specifically, the period reference is "window dragged off its static origin" — no ghost was drawn for that case in 1998 because Mac OS didn't have CSS-flow windows in the first place. The placeholder is the web-adaptation: it reserves the FLOW slot (a web concept that doesn't exist on the period Mac desktop), without drawing visible chrome (which would imply the window is still THERE, which it isn't).

### Test

Added `posture-b: drag-handoff inserts a placeholder so siblings do not collapse upward` to the spec battery. Drives a real pointer drag of the Read Me window 100px down, then asserts:
  - The card directly below MUST NOT shift (cardShift <= 2px tolerance)
  - A `[data-scriptoscope-placeholder]` element MUST exist
  - The placeholder's width/height MUST match the pre-drag host rect (within 2px)

Without the fix the card shifts ~696px upward (the height of the lifted Read Me). 8/8 posture-b spec passes with the fix.

### Diff cost

~20 LoC added to toAbsolute (the placeholder insertion + the stored reference). ~5 LoC added to WindowManager.remove (cleanup). One regression test (~30 LoC). No public API change; same MountHandle / WindowManager surface.

