# ADR-0001 — Consumption architecture: applying a theme to a live web page

- **Status:** Partially Accepted — Decision 3 (front door) shipped 2026-05-28; Decision 4 (ingestion) shipped 2026-05-27; Decision 2 (Shadow DOM) still open; **Decision 1 REVISED 2026-05-28** — the CSS `border-image` emitter is retired after three rounds of spike couldn't reach fidelity for the exotic schemes ([`docs/superpowers/specs/2026-05-28-css-emitter-spike.md`](../superpowers/specs/2026-05-28-css-emitter-spike.md)). The architecture is now explicitly "DOM structure + canvas decoration" — what the existing implementation already does. See §Spike result and the revised §Decision 1 below.
- **Date:** 2026-05-25 (reviewed 2026-05-26, 2026-05-27, 2026-05-28 — see §Update + §Spike result)
- **Supersedes:** the CSS-custom-property theme model and "Phase 1 WM shipped" assumptions in `PRD.md` (drifted from the v3 canvas reset). See `docs/history.md`, `docs/spec/compositor-spec.md`.
- **Deciders:** maintainer (khawkins)

## Spike result — 2026-05-28 (Decision 1 RETIRED — adopt explicit hybrid)

The §Gating spike ran three iterations and concluded **differently** than the
original Decision 1 anticipated. Each round produced a verdict the next round
disproved:

1. **Round 1** — "trivially expressible in plain CSS" (`border` + `box-shadow`
   + positioned widgets). **Caught** by owner side-by-side: matched topology,
   missed the 3px beveled panel + widget bevels. Withdrawn.
2. **Round 2** — "Path 2 passed: synthesized PNG sources for both compositor
   paths, pixel-faithful." Verified only on apple-platinum-2; the exotic
   schemes weren't tested. **Caught** by owner request to test 1138, evolution,
   BeOS. Withdrawn.
3. **Round 3** — fixed two bugs (canvas-title-bar overlay; DOM-measured frame
   thickness). 1138 + evolution body frames passed; **BeOS exposed asymmetric
   title bar that the clip-path simplification can't preserve, and
   apple-platinum-2's synthesizer doesn't match its measured frame thickness**.
   The pattern of "another iteration" producing another gap was the signal to
   stop iterating.

The headline architectural insight:

> **The existing implementation IS the hybrid the ADR was searching for.**
> DOM owns the window container (position, size, drag, resize, z-order, focus),
> the body content (real DOM, host-CSS-reachable), and the widget hit targets
> (focusable buttons over the canvas). Canvas owns the chrome pixels (always
> faithful, sourced from the runtime compositor). The spike kept trying to
> push chrome into CSS too — at cost: per-scheme tuning, fidelity loss, two
> rendering paths, classifier complexity. The wins (SSR, native resize, scale
> efficiency) are real but small for the actual consumer profile.

**Decision 1 is therefore RETIRED in its CSS-first-hybrid form** and replaced
with an explicit framing of the architecture that already ships — see the
revised §Decision 1 below. The CSS emitter (`src/cssEmitter.ts`), the
representability classifier (`scripts/lint-css-emit.mjs`), and the PC phase as
originally defined are dropped from the phase map. The spike file is deleted.

Full retrospective writeup:
[`docs/superpowers/specs/2026-05-28-css-emitter-spike.md`](../superpowers/specs/2026-05-28-css-emitter-spike.md).
TL;DR:

- **Corner-sprite path** (apple-platinum-2, platinum-8, system7-nostalgia-silver, black-platinum):
  the frame is procedural and trivially expressible in **plain CSS** — `border` + tiled
  `background-image` + positioned widgets. **No `border-image` needed.** This is *more* CSS-friendly
  than the ADR predicted (the 2026-05-27 update already noted this; the spike confirms).
- **Recipe path** (1138, 1984, 1990, beos-r503, evolution): `border-image` works with two
  prerequisites that go into the production emitter: (1) crop the chrome cicn to the body-frame
  strip before using as `border-image-source` (otherwise the title bar's bottom row bleeds into
  the top border); (2) specify `border-image-width` explicitly so rendered thickness is decoupled
  from source-slice. The slice values come straight from the per-edge recipe in `theme.json`.
- **Title bar stays canvas** in both paths, exactly as Decision 1 reserved.
- **Representability classifier** rules drafted in the writeup — per-edge, body-frame is
  CSS-expressible iff the edge is `[corner, fill-stretch|fill-tile, corner]` plus a tolerated
  ≤1px transition cell absorbed into the corner. Edges with non-corner FIXED cells of >1px
  (e.g. a status-bar-style widget anchored mid-edge) fall back to canvas. None known in the
  current corpus by inspection; the classifier runs as `scripts/lint-css-emit.mjs` in PC.

Verified at integer 1× and 2× across two compositor paths (≥3 schemes total: apple-platinum-2
1×, apple-platinum-2 2×, 1138 1×). Spike file: `demo/_spike-css-emitter.html` (delete with the
PC PR). **PC implementation is now unblocked** — see §Recommendations in the spike writeup.

## Update — 2026-05-28 (consumption-layer FRONT DOOR shipped — Decision 3 LIVE)

Decision 3 (imperative + declarative front door) shipped on `main` (commits `2e22d48` … `beec030`, 2026-05-27/28). The "Confirmed still absent" list in the 2026-05-26 update below has flipped almost entirely — what's now in `src/declarative/` + `src/interactive.ts`:

- `data-aaron-*` scanner with `MutationObserver` (`src/declarative/scanner.ts`)
- `AaronWindow` class (`src/declarative/AaronWindow.ts`)
- A real WindowManager: drag from any edge, grow-box resize, z-order, window-shade (collapse), zoom-to-fit, themed scrollbars on overflow, runtime theme switching (`src/interactive.ts`)
- `ResizeObserver`-driven content-fit re-render
- Themed `data-aaron-control` promotion (checkbox / radio / slider) over native form widgets (`src/declarative/control.ts`) — a partial relaxation of Decision 4's "native controls NOT themed" scope guard, scoped to controls the consumer explicitly opts into via attribute (the spirit of "opt-in" Decision 4 reserves)
- Two validation demos: `demo/declarative.html` (OS 8.6 desktop) and `demo/declarative-site.html` ("skin an existing site")
- Public re-exports from `src/index.ts` (`mountDeclarative`, `AaronWindow`, `promoteButton`, etc.)

Full design + build log: `docs/superpowers/specs/2026-05-27-declarative-windows-design.md`.

**Still NOT shipped** (this ADR's open work):
- Decision 1 — CSS `border-image` emitter + representability classifier. Still spike-gated; the gating spike has not been run. **This is the next gate.** All chrome rendering today goes through the canvas compositor (per-window canvas; no SSR; canvas is invisible to AT — the accessibility motivation for Decision 1 stands).
- Decision 2 — Shadow DOM around chrome. Not yet wrapped; chrome currently renders into the same DOM tree as host content. The case still holds for hostile third-party CSS environments; the demos so far run on clean pages.
- Phase map items PC (CSS emitter), PE (broader control decoration) — open. PD (ingestion) shipped 2026-05-27 (see below).

**The ADR's central decision (CSS-first hybrid) is therefore still unproven.** Production chrome is canvas-only. The front door was built without prejudicing that decision: the renderer plumbing in `src/renderWindow.ts` is the canvas path; a future CSS emitter can be slotted behind the same `composeWindowChrome` recipe (see §1).

## Update — 2026-05-26 (engine deepened; decisions unchanged) — ⚠️ "still absent" list now SUPERSEDED by the 2026-05-28 update above

A ~50-commit review found all work since this ADR landed on the **rendering engine**, none on the **consumption layer** — so every decision below still stands, and the §Gating spike is still the unstarted next gate. ~~Confirmed still absent: any `data-aaron-*` scanner, `MutationObserver`, `customElements`, `border-image`, Shadow DOM, `AaronWindow`, `ResizeObserver`, or emitted CSS.~~ (Ingestion note now stale — see the 2026-05-27 update below: the blob-URL passthrough Decision 4 needs HAS landed.)

**Ingestion is now LIVE (update 2026-05-27):** the whole in-browser drag-drop conversion path shipped — drop a Kaleidoscope theme (`.sit` via a munbox→WASM decoder in `tools/sit-wasm/`, or `.hqx`/MacBinary/AppleDouble/raw `.rsrc`) and `loadKaleidoscopeScheme` → `convertScheme` produces a render-ready in-memory `LoadedTheme` with `OffscreenCanvas` blob-URL assets, which `renderWindow` paints — no build, no server. The `assetUrl` blob-URL passthrough Decision 4 calls for HAS landed (5afd70b). See `docs/superpowers/specs/2026-05-27-browser-conversion-design.md`. **Consequence for this ADR:** the consumer can now receive a translated theme two ways, and the choice is a consumption-layer decision to make at the §Gating spike — (a) an **in-page handoff** (pass the in-memory `LoadedTheme` straight to the consumer, no disk round-trip) or (b) a **saved/exported bundle** (`theme.json` + PNG assets, zipped) the consumer re-loads. "Save/export the translated output" is therefore deliberately deferred until this ADR's spike picks the consumption shape, so we don't build a save format the consumer can't use.

**Open architecture item for the consumption layer (noted 2026-05-27):** the base-theme chain is wired ONLY in `demo/index.html` (`BASE_SLUG = 'apple-platinum-replica'` + `loadWithBase`), not in the `loadTheme` library default or any manifest — so a non-demo consumer gets NO base (missing controls/windows won't fall back). When the consumption layer is built, base selection should move to the library/manifest level. (Related: the `apple-platinum-replica` base is now narrow — post the ics4 wiring its only unique supply is the slider + window-geometry fallbacks — and its chrome is sliced from real Mac screenshots; a retire-and-promote-`apple-platinum-2` is actionable but breaks the generator suite + demo showcase. Owner call.)

Two context updates that **reinforce** Decision 1 rather than alter it:

1. **There are now TWO window compositors**, both already 9-slice-shaped:
   - `composeWindowChrome` (`src/composeChrome.ts`) — the kDEF cicn 9-walk / per-edge recipe path (schemes that ship `wnd#`/`cinf`, e.g. `1138`, `beos-r503`).
   - `composeCornerSprite` (`src/composeCornerSprite.ts`, new) — for look-only schemes that ship corner cicns + sprites but no `wnd#` recipe (`apple-platinum-2`, `platinum-8`, `system7-nostalgia-silver`). Its frame is **procedural**: a 1px arithmetic ring (→ a CSS `border`), a tiled pinstripe title bar (→ `background-repeat`), and corner-1:1 + edge-stretch cells (→ literally `border-image`'s model). `renderWindow` routes recipe → corner-sprite → base → procedural baseline.
   The corner-sprite frame is *more* CSS-expressible than the recipe path, so the CSS-first-hybrid thesis holds harder. The cost: the border-image emitter + representability classifier must source from **both** compositors.

2. **Adjusted §Gating spike scope:** test **one scheme per compositor** — a recipe scheme (`1138` / `beos-r503`) **and** a corner-sprite scheme (`apple-platinum-2` / `platinum-8`). Expect the corner-sprite frame to be the easier border-image win; learning that early de-risks the emitter.

Also noted (no decision change): the engine added control classes (bevel button, list header, menus/popups), ics4/ics8/icl8 icon decode, the Charcoal title font, and 3 themes — all of which *widen* the eventual PE control-decoration surface but don't move the v1 scope guard (host-native form controls stay out).

## Context

The vision (per `PRD.md` North Star): a consumer either picks a bundled theme **or drags in a Kaleidoscope scheme**, and applies it to their **existing website** via `data-aaron-*` attributes — the library generates wrapper elements + CSS to skin it. Themes are runtime-switchable.

What actually exists today (verified 2026-05-25):

- **Built:** a faithful canvas chrome compositor (`src/composeChrome.ts` → `src/renderWindow.ts`) that replays the Kaleidoscope kDEF and insets real DOM content into the frame's interior; interactive controls with real ARIA (`src/interactive.ts`); base-theme inheritance (`src/baseChain.ts`); browser-portable decoders (`tools/theme-loader/`, incl. `loadKaleidoscopeScheme.js` which already accepts a `Blob` and emits blob-URL assets via `OffscreenCanvas`). Zero runtime deps, ~51 KB ESM.
- **Not built — the entire consumption layer:** no `data-aaron-*` scanner, no `MutationObserver`, no wrapper generation, **no emitted CSS at all** (everything is inline CSS-in-JS), no `AaronWindow` front door, and no production window manager (`WindowManager` now does focus + z-index + demo-grade drag-to-move / grow-box resize / title-widget press, but still no persistence, snapping, or constraints — see the 2026-05-27 update).

The central tension: faithful chrome is a **fixed-resolution raster**, but a live site's content **reflows, is selectable/accessible, zooms, scrolls, and is responsive**. Wrapping a third party's live DOM in a canvas frame fights all of that — and a canvas is invisible to assistive tech.

The load-bearing realization: the chrome is **already modeled internally as a 9-slice / per-edge slice recipe** (`composeChrome.ts` — `SliceMode = 'fixed'|'stretch'|'tile'|'scale'|'collapse'|'stamp'`, walked per edge with 1:1 corners). The same recipe can be emitted **two ways** from one source of truth: as a canvas raster (today) or as CSS `border-image`.

## Decision

### 1. Rendering: DOM structure + canvas decoration (revised 2026-05-28)

**Chrome stays canvas — that's where pixel-faithful Kaleidoscope rendering lives. Everything around the chrome is DOM.** Each window is:

```
<div class="aw-window">                    ← DOM container — CSS-positioned (drag, resize, z-order, focus)
  <canvas class="aw-chrome" />             ← Canvas overlay — chrome pixels, transparent body hole
  <div class="aw-content"> <slot> </div>   ← Real DOM body — selectable, scrollable, host-CSS-reachable
  <button class="aw-titlewidget close"/>   ← Focusable DOM twin for close (a11y)
  <button class="aw-titlewidget zoom"/>    ← …for zoom
  <button class="aw-titlewidget collapse"/>← …for collapse
  <div class="aw-growbox" />               ← DOM grow box for resize handle
</div>
```

Per-window canvas chrome is acceptable cost for pixel fidelity. Where DOM/CSS naturally helps — outer drop shadow, focus ring, theme cascade, content background, host-page CSS reach — DOM/CSS does it. Where chrome pixels need to be faithful to an arbitrary decoded Kaleidoscope scheme, canvas does it. **No CSS emitter, no representability classifier, no per-scheme tuning of CSS source images.**

The earlier CSS-first hybrid spec (emit the body frame as `border-image` from the slice recipe) was retired 2026-05-28 after three rounds of spike couldn't reach fidelity for the exotic schemes (evolution, BeOS) without per-scheme tuning that the architecture wasn't designed for. The wins it sought (SSR-able first paint, native CSS scaling on resize, cheap at scale) are real but small for the actual consumer profile (SPA-driven pages with a handful of windows, not server-rendered sites with hundreds). The faithful-to-the-decode brand commitment beats those wins.

This decision **matches what already ships** in `src/renderWindow.ts` + `src/interactive.ts` + `src/declarative/`. PC's role shrinks from "build the CSS emitter" to "finish the hybrid": DOM-twin coverage audit + Shadow DOM wrapping (Decision 2) + canvas-repaint efficiency pass + a small consumer-facing `aaron-ui.css` for the outer-shell affordances.

The slice recipe in `composeChrome.ts` keeps its current role — it's how the canvas chrome is composed; the same recipe is no longer a candidate for CSS emission.

### 2. Encapsulation: Shadow DOM around the chrome only

Skinning a **third-party** page means CSS fights in both directions (host resets/`!important` break our chrome; our styles leak into their page). Wrap **only the chrome** in a Shadow root; the **host's own content stays in the light DOM** (positioned over / slotted into the frame hole) so the host's CSS still reaches its own content. Expose theming hooks via CSS custom properties / `::part`.

### 3. Front door: imperative foundation + declarative scanner (matches PRD North Star)

- **Foundation:** an imperative `AaronWindow` class + `loadTheme()` (the existing renderer is the engine underneath).
- **Primary surface:** a declarative scanner that promotes `[data-aaron-*]` elements, driven by a **single root `MutationObserver`** (idempotent — mark promoted nodes; batch; `disconnect()` on teardown) for dynamic content.
- **Fallback surface:** class selectors (`.aaron-window`, …) for CSP/CMS environments.
- Internally, the declarative path may be realized as a custom element + the Shadow boundary from Decision 2; the public contract is the data-attribute.

### 4. Scope guards (to bound maintenance surface)

- **Native host form controls (`<input>`, `<select>`, scrollbars) are NOT themed in v1.** Faithful cross-browser control reskinning via CSS is a tar pit. v1 themes window **chrome** + **opt-in** controls the consumer explicitly wraps.
- **Ingestion v1 = curated bundles + a bare resource fork** dropped in (the decode core is already portable; needs a drop zone + an `assetUrl` blob-URL passthrough in `src/loadTheme.ts`). **Archive unpacking** (`.sit`/`.hqx`/MacBinary off Macintosh Garden) is a **separable later track** — StuffIt in particular has no clean JS decompressor; don't promise "drop any download" in v1. **→ SUPERSEDED (2026-05-27, see the update note above): archive unpacking SHIPPED — the drop zone, the `assetUrl` passthrough, and `.sit`/`.hqx`/MacBinary decoding (StuffIt via the `tools/sit-wasm` WASM build) are all live. "Drop any download" is now largely true (caveat: `.sitx` unsupported).**

## Gating spike — 🛑 CONCLUDED DIFFERENTLY 2026-05-28 (Decision 1 retired, not "passed/failed")

Originally framed as a binary pass/fail on the CSS `border-image` emitter. After three iterations (Round 1: pure CSS; Round 2: synthesized source images; Round 3: DOM-measured frame + canvas-title overlay), the spike **concluded that the question itself was wrong**. The actual architecture — DOM structure + canvas decoration — was already shipping and was the right answer all along; the spike was repeatedly trying to push chrome rendering into CSS at cost the project's faithful-to-the-decode posture wouldn't accept.

Retrospective + per-round findings: [`docs/superpowers/specs/2026-05-28-css-emitter-spike.md`](../superpowers/specs/2026-05-28-css-emitter-spike.md). Two associated LEARNINGS entries (the 2026-05-28 "topology vs fidelity" entry from Round 1 + the "three rounds of premature verdicts" entry from the conclusion).

Spike file `demo/_spike-css-emitter.html` deleted with the retirement commit.

## Consequences (revised 2026-05-28)

**Positive:**
- **Pixel-faithful chrome** for any Kaleidoscope scheme, including the visually distinctive ones (evolution, BeOS) — the canvas compositor already proved this.
- **Real DOM body** that's selectable, scrollable, accessible, and reachable by host-page CSS.
- **DOM twins for widgets + grow box** give a11y a clean target (already partially built; finish in PC).
- **Drop-in via `data-aaron-*`** — the data-attribute scanner + WindowManager already shipped (Decision 3).
- **Simple emitter mental model** — one rendering path, not two. No CSS emitter, no representability classifier to maintain.

**Negative / costs:**
- **Per-window canvas allocation** — small per-window cost (~1 chrome canvas per window). Acceptable for typical consumer profiles (handful of windows per page).
- **No SSR-able first paint without JS** — chrome only renders after JS executes. Consumers who need pre-paint can ship a static thumbnail; the canvas appears on hydrate. Real but bounded.
- **Resize re-paint** — ResizeObserver triggers a chrome re-render on window resize (~1ms per window, in a typical case). Mitigatable with debouncing if a real perf problem appears.
- **Title bar widgets' canvas pixels need DOM-twin focus** — already done partially in `src/interactive.ts`; finish the audit in PC.

**Follow-ons unlocked:**
- **Shadow DOM around the chrome** (Decision 2) — still highly valuable for hostile-host-CSS environments.
- **A shipped `aaron-ui.css`** — a small consumer-facing stylesheet for the outer-shell affordances (drop shadow, focus ring, default desktop background).
- **a11y audit** — close the DOM-twin gaps; verify keyboard nav + screen reader coverage.
- **Repaint efficiency audit** — ensure chrome only re-renders on size/theme/state change.

## Alternatives considered

- **CSS-first hybrid** (the original Decision 1 — emit body frame as `border-image`, keep title bar canvas). **Tried 2026-05-28, retired.** Three iterations couldn't reach fidelity for the exotic schemes without per-scheme tuning the architecture wasn't designed for. The wins (SSR, native scaling) are real but small for the actual consumer profile; the costs (CSS emitter complexity, classifier, fidelity loss on exotic schemes) are too large. See §Spike result.
- **CSS-custom-property reskin** (the old PRD model: `--aaron-titlebar-bg`, `chrome.css`/`controls.css`). Rejected: hand-tuned CSS variables can't be pixel-faithful to an arbitrary decoded scheme.
- **Full web-component authoring kit** (React95-style `<Window>`/`<Button>` tree). Rejected: that's "author the markup," not "skin an existing site"; framework-leaning; wrong model for the North Star.

## Phase map (revised 2026-05-28)

- **P0 — Reconcile + decide:** PRD refresh (done alongside this ADR); spike concluded; Decision 1 revised. ✅
- **PA — One front door:** `AaronWindow` + `data-aaron-window` scanner over the existing renderer. **SHIPPED 2026-05-28.**
- **PB — WM behaviors:** drag / resize / z-order / shade / zoom / themed scrollbars / runtime theme switch. **SHIPPED 2026-05-28.** Persistence remains open.
- **PC — Finish the hybrid (revised):** ~~CSS emitter / classifier~~ retired. New scope: (1) DOM-twin coverage audit (widgets, scrollbars, slider); (2) Shadow DOM wrapping (Decision 2); (3) canvas repaint efficiency audit; (4) shipped `aaron-ui.css` for outer-shell affordances; (5) a11y audit (axe + keyboard + screen reader).
- **PD — In-browser ingestion:** drop zone + `assetUrl` passthrough + archive unpacking (`.sit`/`.hqx`/MacBinary). **SHIPPED 2026-05-27.** `.sitx` unsupported (unrelated).
- **PE — Opt-in control decoration** (explicitly *not* native form-control reskin). **Partially shipped** via `data-aaron-control` 2026-05-28; broader widget surfaces (menu, popup, list-header) remain open.
- **Cross-cutting:** npm/packaging, theme-schema versioning, consumption test harness, persistence story.

## References

- Engine: `src/composeChrome.ts` (the slice recipe that drives the canvas compositor), `src/renderWindow.ts` (canvas + inset model + a11y wiring), `src/interactive.ts` (WindowManager + focusable DOM twins for widgets), `src/declarative/` (the `data-aaron-*` scanner + AaronWindow).
- Ingestion: `tools/theme-loader/loadKaleidoscopeScheme.js`, `tools/theme-loader/resource-fork.js`, `src/cicnImage.ts`, `src/loadTheme.ts` (the `assetUrl` blob passthrough).
- Spec: `docs/spec/compositor-spec.md`; bundle: `docs/theme-bundle-layout.md`.
- Spike retrospective: `docs/superpowers/specs/2026-05-28-css-emitter-spike.md` (three rounds + conclusion).
- External precedent: jQuery UI ThemeRoller (downloadable theme bundle + class/state framework); 98.css/XP.css (CSS-class fidelity floor — the look without the runtime); React95 (theme-as-data swapping, rejected authoring model).
