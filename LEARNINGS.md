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

*New learnings get appended below this line as the project ships.*
