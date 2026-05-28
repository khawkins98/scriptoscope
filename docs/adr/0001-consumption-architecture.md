# ADR-0001 — Consumption architecture: applying a theme to a live web page

- **Status:** Partially Accepted — Decision 3 (front door) and parts of Decision 2 (encapsulation, less Shadow DOM) shipped 2026-05-28; Decision 1 (CSS-first hybrid) **spike PASSED 2026-05-28** ([`docs/superpowers/specs/2026-05-28-css-emitter-spike.md`](../superpowers/specs/2026-05-28-css-emitter-spike.md)); Decision 4 (ingestion) shipped 2026-05-27. PC implementation now unblocked.
- **Date:** 2026-05-25 (reviewed 2026-05-26, 2026-05-27, 2026-05-28 — see §Update + §Spike result)
- **Supersedes:** the CSS-custom-property theme model and "Phase 1 WM shipped" assumptions in `PRD.md` (drifted from the v3 canvas reset). See `docs/history.md`, `docs/spec/compositor-spec.md`.
- **Deciders:** maintainer (khawkins)

## Spike result — 2026-05-28 (Decision 1 PASSED — CSS-first hybrid validated)

The §Gating spike ran and resolved. Full writeup:
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

### 1. Rendering: CSS-first hybrid, gated by a spike

Emit the **body frame** (4 corners + left/right/bottom edges) as CSS `border-image` generated from the `composeChrome` slice recipe — it scales with the box natively, is accessible, SSR-able, and cheap at scale. Keep the **canvas compositor** for the **title bar** (close/zoom/shade widgets, the measured-width title plate, `collapse`-to-0 cells, asymmetric title pinning — none expressible as a border) and as a **whole-frame fallback** for edges the CSS path can't represent.

`border-image` has a hard ceiling: **one source image, four preserved corners, only two repeat values** (one horizontal pair, one vertical pair). Our recipe is richer (per-edge `tile` vs `stretch` vs `scale`, asymmetric titles). Therefore this decision is **gated by a throwaway spike** (see §Gating spike). If the spike shows a class of edges/schemes can't be faithfully expressed, those fall back to canvas, selected **deterministically by a representability classifier** — a static check (in the spirit of `lint:themes`: detect divergence by rule, not by eyeballing renders) that decides per-edge which emitter to use.

Both emitters consume the **same** `composeChrome` recipe, so fidelity stays single-sourced; the only per-scheme/per-edge question is which emitter can render it faithfully.

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

## Gating spike — ✅ PASSED 2026-05-28

Build a **throwaway** `border-image` emitter for ONE window frame straight from the slice recipe and compare against the canvas render. **Cover one scheme per compositor** (see §Update): a recipe scheme (`1138` / `beos-r503`, via `composeWindowChrome`) and a corner-sprite scheme (`apple-platinum-2` / `platinum-8`, via `composeCornerSprite` — likely the easier win). Acceptance: the body frame (corners + L/R/bottom) is faithful at integer scale across ≥3 corpus schemes spanning both paths; document which edges/schemes need the canvas fallback. Output: confirm/deny Decision 1, and the rules for the representability classifier. **No production code until the spike resolves.**

**Resolved 2026-05-28:** spike PASSED across both paths. See §Spike result above and the full writeup at [`docs/superpowers/specs/2026-05-28-css-emitter-spike.md`](../superpowers/specs/2026-05-28-css-emitter-spike.md). Spike file at `demo/_spike-css-emitter.html` (delete with PC PR).

## Consequences

**Positive:** accessibility (real DOM frame), SSR/first-paint without JS (no FOUC), native scaling on resize/zoom (no per-window `ResizeObserver` re-blit), cheap at scale (many decorated regions), single-sourced fidelity (one recipe, two emitters), and a clean "skin an existing site" ergonomic via data-attributes.

**Negative / costs:** two emitters to maintain (canvas + CSS) plus a representability classifier; the title bar remains raster (still needs the canvas path + DOM a11y twins for its widgets); Shadow DOM constrains how host content composites over the hole; high-DPI/fractional-zoom shimmer is inherited equally by both paths (intentional retro trade-off, no regression).

**Follow-ons unlocked:** a CSS emitter + a shipped `aaron-ui.css`; a real WM (drag/resize/z/persistence); in-browser ingestion; theme-schema versioning.

## Alternatives considered

- **Canvas-only** (extend the current renderer with `ResizeObserver` re-compose + focusable DOM a11y twins). Rejected as the *default*: worst accessibility, no SSR, per-window observer fan-out at scale. Retained as the title-bar renderer + fallback.
- **CSS-custom-property reskin** (the old PRD model: `--aaron-titlebar-bg`, `chrome.css`/`controls.css`). Rejected: superseded by the faithful canvas compositor; hand-tuned CSS variables can't be pixel-faithful to an arbitrary decoded scheme.
- **Full web-component authoring kit** (React95-style `<Window>`/`<Button>` tree). Rejected: that's "author the markup," not "skin an existing site"; framework-leaning; wrong model for the North Star.

## Phase map (issues cut AFTER the spike resolves)

- **P0 — Reconcile + decide:** PRD refresh (done alongside this ADR); run the gating spike; finalize Decision 1.
- **PA — One front door:** `AaronWindow` + `data-aaron-window` scanner over the *existing* renderer, validated on a sample third-party page (validates the decoration model, no new look-work).
- **PB — WM behaviors:** drag / resize / z-order / persistence.
- **PC — CSS/`border-image` emitter** (if spike passes) + shipped `aaron-ui.css` + representability classifier.
- **PD — In-browser ingestion:** drop zone + `assetUrl` passthrough; archive unpacking as a separable sub-track.
- **PE — Opt-in control decoration** (explicitly *not* native form-control reskin).
- **Cross-cutting:** a11y audit (axe + keyboard), Shadow-DOM encapsulation, npm/packaging, theme-schema versioning, consumption test harness.

## References

- Engine: `src/composeChrome.ts` (the slice recipe — the thing to emit as `border-image`), `src/renderWindow.ts` (canvas + inset model + a11y wiring to preserve), `src/interactive.ts` (where focusable DOM twins live).
- Ingestion: `tools/theme-loader/loadKaleidoscopeScheme.js`, `tools/theme-loader/resource-fork.js`, `src/cicnImage.ts`, `src/loadTheme.ts` (the `assetUrl` blob passthrough).
- Spec: `docs/spec/compositor-spec.md`; bundle: `docs/theme-bundle-layout.md`.
- External precedent: jQuery UI ThemeRoller (downloadable theme bundle + class/state framework — the closest analog to "decode a theme → apply live via classes"); 98.css/XP.css (CSS-class fidelity floor); React95 (theme-as-data swapping, rejected authoring model).
