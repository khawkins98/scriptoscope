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

For #64.2 (title-pill positioning), the cleanest interface between the runtime renderer and the consumer's CSS turned out to be **two CSS custom properties** stamped on the titlebar element: `--aaron-title-pill-left` and `--aaron-title-pill-right`. The renderer computes them from the wnd# top recipe (widest coalesced fill-segment run); the consumer's CSS reads them via `var()` with sensible fallbacks.

**Why custom properties over inline `left:` / `right:` styles:** consumers retain full control over the title element's other styling (font, color, padding, focus treatment, etc.). The runtime contributes only the *constraint* — where the title is allowed to live. This matches the broader Aaron UI ethos that the runtime drives geometry, the consumer drives presentation.

**Algorithm choice:** widest *coalesced* fill run, not single widest fill. A run of consecutive non-named parts (e.g., part-8 then part-6 then part-5) should be treated as one zone since they're all fillable; only a named part actually breaks the zone. Without coalescing, the 7 Le pill would have picked a 3-pixel single-fill segment instead of the 10-pixel run.

**Known sharp edge:** the pill is computed in *cicn-pixel* space, not *titlebar-pixel* space. For schemes with narrow cicn widths (7 Le is 74px) and many named parts, the pill ends up small relative to typical title lengths, forcing ellipsization. A future refinement could recompute on resize in titlebar-pixel space, but the current implementation is strictly better than the prior "title overflows everything" state and ships without a ResizeObserver cost on every window. Document the limitation, ship, iterate from real consumer feedback.

---

### 2026-05-17 — Side composition: same algorithm as top, just with the axes (and the anchor) swapped

For #64.3 I extended the V2 top composer to bottom/left/right. The structural decision worth recording: **don't generalize over directions prematurely**. I wrote three near-duplicate functions (`composeBottomEdge`, `composeLeftEdge`, `composeRightEdge`) rather than one parameterized `composeEdge(side)` — the per-edge differences (which axis to iterate, which cicn region to sample for fills, which container edge to anchor named parts to) compound just enough that the parameterized version would have been a knot of conditionals.

Later, I did factor `composeLeftEdge` + `composeRightEdge` into a private `composeVerticalEdge(..., side)` helper because they really are mirror images (only the sample column and anchor edge differ). But top + bottom stayed separate — anchoring to `top:0` vs `bottom:0` plus the cicn-sample-row inference for bottom made them more divergent than the left/right pair. Good rule of thumb: factor only the *true* mirror pairs; let the "similar but actually different" cases stay as separate functions until a third or fourth call site forces them together.

**Container model:** the three new edge containers (`.aaron-window__edge--{bottom,left,right}`) added to `AaronWindow` are pure structural — `position: absolute; pointer-events: none; overflow: hidden` and nothing else. All visible styling (thickness, where they sit relative to the titlebar) lives in the consumer's CSS. This matches the pattern from #64.2 (CSS custom properties carry constraints, consumer carries presentation) and keeps the runtime contract narrow.

**Heuristic risk:** the bottom-strip-start inference (look for a named part whose rect sits in the bottom 5px of the cicn) works for both canonical bundles but is brittle for schemes that don't follow the same convention. Documented as a known limitation; will iterate from real consumer feedback. Don't over-engineer the heuristic now — wait for a scheme that breaks it, then add explicit fallback or `edgeThickness` schema field.

**Test discipline (jsdom gotcha):** writing tests for the side composer surfaced a jsdom behavior — the browser normalizes `-0px` to `0px` in serialized `style.backgroundPosition`. Cost me one failing assertion. Use string `.startsWith` checks for px values that might be zero, not strict equality with the `-0` form.

---

### 2026-05-18 — The chrome composer was structurally wrong; reference image is the authoritative spec

After three composer iterations (V1 stretched-segments, V2 named-vs-fill, V3 with side composition) the user surfaced screenshots showing the rendering still didn't read right — "still lots of weird artefacts." The root cause was a flawed mental model of how Kaleidoscope chrome works: I'd been assuming the cicn is a **per-segment composition** with named parts spreading proportionally across the titlebar width. The reference rendering (already on the page in the side-by-side fidelity window) shows otherwise: close-box pinned to the **left pixel edge**, zoom-box pinned to the **right pixel edge**, and the middle **tiles** the cicn's pinstripe pattern as the window grows.

This is structurally a **3-slice template**, which CSS `border-image` ships natively. Took one PR to replace ~500 lines of per-segment composer logic with ~100 lines of inline `border-image-*` styles + 6 piece divs for the bottom/side edges (where `border-image` doesn't fit because the container is too thin).

**Pattern worth keeping:** when the user shows screenshots and says "weird artefacts," check the rendering against the reference image *first*, before reaching for incremental fixes. Three PRs of "make the per-segment composer slightly less wrong" was less productive than one PR of "throw out the model and use the standard CSS feature designed for this." The reference image was sitting there the whole time.

**Implementation detail:** `border-image-repeat: round` tiles whole-number copies of the middle slice and resizes them slightly to fit — period-correct for pinstripe patterns where partial cuts at the ends would look broken. `image-rendering: pixelated` is essential — without it browsers smooth the cicn upscale and the crisp 1-bit chrome looks blurry.

**Edge case the rewrite uncovered:** `border-image` requires the container to have enough height for the slice geometry to make sense. The titlebar at 25px tall, with slice `0 39 0 25` (top 0, right 39, bottom 0, left 25), works fine — top/bottom borders are 0 width so the middle "fill" region spans full height. But for the bottom edge container which is only 3px tall and wants to show the cicn's bottom rows, `border-image` would scale the entire cicn into that 3px height (terrible). Solved by falling back to the per-piece div approach for thin edges where `background-position-y: bottom` does the alignment correctly.

**Cumulative chrome PR count:** #58 → #59 → #60 → #61 (gap analysis) → #62 (revert) → #65 (V1) → #66 (research) → #67 (spec) → #68 (V2) → #85 (title pill) → #86 (side composition) → this PR (3-slice). 11 PRs across two days. Don't pretend the path was linear — it wasn't. Every iteration moved understanding forward even when the implementation got reverted. The honest gap analysis from #61 was the critical methodological step that made the rest possible; without it I'd still be shipping reactive per-segment fixes.

---

### 2026-05-18 — Border THICKNESS is also per-scheme (1px for 7 Le, 6px for ErgoBox); derive both color + geometry from the cicn

After shipping the 1px hairline (initial pass on this PR) the user immediately corrected: ErgoBox's reference shows a 6px beveled border with shading and patterns. Same scheme that needed a 3-slice titlebar approach needs a fundamentally different *side* approach too — its chrome cicn (132×64) carries a full bordered window, not just a titlebar.

**Solution:** derive per-side thickness at runtime via pixel scanning. New `deriveFrameGeometry(url)` returns `{ color, top, right, bottom, left }`. Scans inward from each edge at the mid-axis counting consecutive "border" pixels (opaque + not near-white) until it hits a "body" pixel. For ErgoBox this returns `{ left: 6, right: 6, bottom: 7 }`; for 7 Le it returns the cap (titlebar-only cicn has no body), which gets clamped to `{ left: 1, right: 1, bottom: 2 }`.

**Clamp rule:** if scanned thickness > max(8, extent/4), treat as titlebar-only cicn → use 1px. Otherwise use scanned value. This makes the same renderer work for both "titlebar-only" and "full-window" cicns without per-scheme conditionals.

**Stamped as CSS custom properties:** `--aaron-frame-{left,right,bottom}-px` on the window root. Consumer CSS sizes the edge containers from these. Both canonical bundles now render with their period-correct border thickness.

**Meta-lesson:** when correcting a course based on user feedback, look at MULTIPLE references before re-implementing. I assumed all schemes had thin hairline frames (because 7 Le does) and shipped a "drop the edge containers" PR. The ErgoBox reference would have revealed the structural-difference-per-scheme answer before any code was written. Both canonical bundles are on the demo page — always check both before generalizing.

### 2026-05-18 — Palette `window-frame` is often wrong; sample the cicn's outermost opaque pixel at runtime

The extractor pre-fills `theme.palette.window-frame` with a generic gray (`#888` for 7 Le), but the actual cicn's outermost opaque pixel is `#000` (solid black — the 1-bit Mac chrome). When the frame color was wired to `--aaron-colr-window-frame` in CSS, the rendered hairline read as a faint gray instead of the period-correct black line.

**Fix:** new runtime helper `deriveFrameColor(cicnUrl)` — fetch the cicn, draw to an OffscreenCanvas, find the first opaque pixel scanning leftmost column then rightmost column. Cache per URL. Stamp as `--aaron-cicn-frame-color` on the window root. Consumer CSS uses it: `box-shadow: inset 0 0 0 1px var(--aaron-cicn-frame-color, var(--aaron-colr-window-frame, #666))`.

**Subtle correctness:** windows in the demo default to `data-state="inactive"`. The runtime resolves `cicnUrl` from `windowType.chrome[state]`, so the INACTIVE cicn gets sampled by default — which has a dimmer outer pixel (`#555` for 7 Le inactive vs `#000` active). Period-faithful: classic Mac OS dimmed the frame of unfocused windows. The frame color tracks state automatically because `applyChromeFromTheme` runs again when state flips and re-samples.

**Architecture pivot also in this PR:** dropped the per-edge composer rendering (#86's bottom/left/right `applyXxxEdgeAs3Slice` calls) in favor of the single hairline frame. The edge containers remain as DOM placeholders (`display: none`) for future scheme-specific decoration where a 1px line isn't enough — but for both canonical bundles, a 1px line matches the reference rendering exactly. Saved ~100 lines of CSS background-position math that wasn't adding visual value.

**Pattern worth keeping:** when palette values look approximated or generic, prefer sampling the source pixels. The cicn is the source of truth; the palette is a hint. Same applies to other palette fields (`titlebar-active-bg`, etc.) — if the extractor pre-fills them, double-check against the actual rendered cicn before trusting.

---

### 2026-05-18 — Chrome cicns split into 3 kinds; classifier dispatches 3-slice vs 9-slice rendering

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

Mirror of `composeTopRecipe` for the bottom-edge container. Same logic with vertical anchoring flipped (named parts anchor to container *bottom* via `bottom: (cicnHeight - rect.bottom)`), and fills sample from the cicn's bottom rows via `background-position-y: bottom` so the bottom-strip frame line / decoration shows in the rendered bottom edge.

**Wiring:** when the top recipe applies + a `[data-aaron-edge="bottom"]` container exists, we also run the bottom recipe. If bottom recipe applies → 9-slice on window root is *not* dispatched (would otherwise double-render). If bottom recipe doesn't apply but the cicn is Kind B → 9-slice still runs as before for sides + bottom.

**Visible:** Big Blue's iconic Apple-tab silhouettes now visible at window *bottoms* too (previously only top corners). 1990 + evolution show their bottom frame decorations. 7 Le + ErgoBox unchanged from before — they were already clean.

**Demo CSS observation:** the bottom-edge container is sized by `--aaron-frame-bottom-px` (derived from cicn, typically 1-7px). For schemes whose bottom-row decoration is tall (Big Blue's 17px tabs), the named parts get partially clipped by `overflow: hidden` on the container. That's a demo-CSS choice, not a renderer limitation — consumers can make the container taller if they want more decoration visible.

**Phase 4c queued:** left + right edges (vertical iteration of the recipe walker). After 4c lands, the border-image fallback paths become unused — kept for one cycle as dead code, then deleted.

---

### 2026-05-18 — Phase 4c: recipe-driven left + right edges (loader rewrite complete)

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

V1 of `composeRichRecipe` cropped named-widget segments to their part rect: "segment references part-1 → display cicn[part-1.rect]". For 1990's top edge this looked correct (close-box pixels appeared at the close-box position). On the bottom edge it produced visible mismapping — part-1 is referenced 7× on the bottom recipe but part-1's rect is at cicn y=11..19 (top region). Painting top-row widget pixels onto the bottom edge gave a scattered widget look.

The fix (V2): **every segment crops the cicn at its own edge position**, regardless of whether it's named. The only thing that varies between widget vs fill is flex behavior (widget pins at native width; fill grows proportional to span). The part rect is metadata for *hit-testing* (which we may wire later as a click-target overlay), not for *rendering*.

**Why it matters:** this is the same flavor of mistake as the #103 Phase 4 revert — interpreting wnd# entries as paint commands instead of as boundary markers. Same lesson, different angle. The wnd# `part` field on a recipe entry identifies what KIND of segment lives at that boundary (widget anchor vs fill zone); it doesn't specify where to source pixels.

**How to apply:** when designing renderers from the wnd#/cinf data, ask "is this geometry metadata for rendering, or topology metadata for behavior?" before using it. Most rect-like fields in Kaleidoscope's format are the latter.

## 2026-05-18 — Corner pinning is non-optional for recipe composers (#112)

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
