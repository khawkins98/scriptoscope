# ADR-0001 — Consumption architecture: applying a theme to a live web page

- **Status:** Proposed (spike-gated — see §Decision 1 and §Gating spike)
- **Date:** 2026-05-25
- **Supersedes:** the CSS-custom-property theme model and "Phase 1 WM shipped" assumptions in `PRD.md` (drifted from the v3 canvas reset). See `docs/history.md`, `docs/spec/compositor-spec.md`.
- **Deciders:** maintainer (khawkins)

## Context

The vision (per `PRD.md` North Star): a consumer either picks a bundled theme **or drags in a Kaleidoscope scheme**, and applies it to their **existing website** via `data-aaron-*` attributes — the library generates wrapper elements + CSS to skin it. Themes are runtime-switchable.

What actually exists today (verified 2026-05-25):

- **Built:** a faithful canvas chrome compositor (`src/composeChrome.ts` → `src/renderWindow.ts`) that replays the Kaleidoscope kDEF and insets real DOM content into the frame's interior; interactive controls with real ARIA (`src/interactive.ts`); base-theme inheritance (`src/baseChain.ts`); browser-portable decoders (`tools/theme-loader/`, incl. `loadKaleidoscopeScheme.js` which already accepts a `Blob` and emits blob-URL assets via `OffscreenCanvas`). Zero runtime deps, ~51 KB ESM.
- **Not built — the entire consumption layer:** no `data-aaron-*` scanner, no `MutationObserver`, no wrapper generation, **no emitted CSS at all** (everything is inline CSS-in-JS), no `AaronWindow` front door, and no real window manager (`WindowManager` does focus + z-index only — not drag/resize/persistence).

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
- **Ingestion v1 = curated bundles + a bare resource fork** dropped in (the decode core is already portable; needs a drop zone + an `assetUrl` blob-URL passthrough in `src/loadTheme.ts`). **Archive unpacking** (`.sit`/`.hqx`/MacBinary off Macintosh Garden) is a **separable later track** — StuffIt in particular has no clean JS decompressor; don't promise "drop any download" in v1.

## Gating spike (must pass before committing Decision 1 and cutting phase issues)

Build a **throwaway** `border-image` emitter for ONE window frame straight from the `composeChrome` recipe and compare against the canvas render. Acceptance: the body frame (corners + L/R/bottom) is faithful at integer scale across ≥3 corpus schemes (e.g. `apple-platinum-replica`, `1138`, `beos-r503`); document which edges/schemes need the canvas fallback. Output: confirm/deny Decision 1, and the rules for the representability classifier. **No production code until the spike resolves.**

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
