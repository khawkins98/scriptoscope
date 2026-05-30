# Platinum Theme Generator — Design (Sub-project ①: generator + window chrome)

> ⚠️ **SUPERSEDED — 2026-05-28.** This design was implemented (the generator + `apple-platinum-replica` theme bundle shipped via the sibling [implementation plan](../plans/2026-05-24-platinum-theme-generator.md)), then **retired**. The maintainer pivoted to deferring to the real 1998 freeware Kaleidoscope scheme [`platinum-8`](../../../themes/platinum-8/) as the Platinum authority (commit `c7ab49d`, 2026-05-25), and the generator + replica bundle were deleted in commit `c935e4c` (2026-05-28). This spec is kept as the historical record of the attempted approach and its architectural decisions; **the work is not active**. For the Platinum authority that ships today, see `themes/platinum-8/` + `src/baseChain.ts` (sparse bundles defer to it via `mountDeclarative({ baseSlug: 'platinum-8' })`).

**Status (original):** Design (brainstormed 2026-05-24). Next step: implementation plan via writing-plans.

## Goal

Produce a complete **Apple Platinum** appearance as a *normal Scriptoscope theme bundle* — generated clean-room from the decoded Platinum window proc — so it renders 1:1 through the unmodified `theme.json` → compositor pipeline, like any ported Kaleidoscope scheme. This sub-project delivers the **generator framework + the document-window chrome (L1)**; all other window types (L2), controls (L3), menus (L4), and the base-layer inheritance mechanism are separate follow-on sub-projects.

## Why (the bigger picture)

Lightly-skinned Kaleidoscope schemes defer their window/control chrome to the OS base look; Scriptoscope has no faithful base Platinum, so it renders those gaps as flat geometry (today's procedural `src/platinum.ts` fallback). Expressing Platinum **as a theme** (rather than a bespoke runtime engine) means:

- **No runtime special-case** — Platinum flows through the single, unmodified compositor; the `platinum.ts` exception to "never hand-author chrome" can retire. Honors the kaleidoscope-runtime pivot.
- **It is the prerequisite for the base-layer fallback** (sub-project ④): a partial scheme can inherit a *bundle's* missing slot; it can't inherit a procedural engine.
- **Net-new code is a build-time script**, not runtime surface — easier to test, isolate, and discard if wrong.

The decode work (`docs/spec/platinum-wdef125-decode.md`) is not wasted: the generator's drawing core *is* a reimplementation of the WDEF, run once at build time to bake a bitmap instead of every frame at runtime.

## Approach (chosen)

**Generate → real `buildThemeJson`/`validateTheme` → standard bundle.** Verified mechanism: `buildThemeJson(manifest, {meta})` consumes a plain manifest object — `{ source, extractedAt, counts, assets: [{type,id,name,status,file?,width?,height?,data?}] }` — exactly what `scripts/extract-scheme.mjs` builds from decoded resources. The generator synthesizes that same manifest from the decode (instead of parsing a `.ksc`), writes the PNGs, then calls the real builder + validator. **No binary resource-fork encoder is needed.**

Rejected alternatives: synthetic `.ksc` → extractor (requires writing cicn/ppat/wnd#/cinf/Colr + resource-fork *encoders* — gold-plating orthogonal to the Platinum appearance; revisit only if exporting real `.ksc` becomes a goal); direct `theme.json` write (bypasses the schema/validator — drift risk).

## Architecture

```
WDEF decode (docs/spec/platinum-wdef125-decode.md) ─┐
decoded Platinum palette (color-source step) ───────┤
                                                     ▼
        scripts/generate-platinum.mjs
          ├─ (a) palette module        — the Platinum gray ramp (see Color source)
          ├─ (b) drawing core          — renders the min-cicn frame PNGs via src/pixelBuffer.ts
          ├─ (c) manifest synthesizer  — emits cicn/ppat/wnd#/cinf assets in the extractor's
          │        shape, canonical Mac OS IDs (-14336 document-window, active = id+1)
          └─ (d) assembler             — buildThemeJson(manifest,{meta}) → validateTheme
                                                     ▼
        themes/apple-platinum-replica/   (cicns/, ppats/, theme.json,
          meta.json, PROVENANCE.md, extraction-manifest.json)
                                                     ▼
                  unchanged runtime pipeline ──▶ rendered Platinum window
```

The bundle is indistinguishable to the runtime from an extracted scheme because the manifest uses the extractor's exact asset shapes, the canonical window-type IDs, and the `active = id+1` / `inactive = id` cicn-pairing convention `buildThemeJson` expects.

## Components

### (a) Palette module
A small named gray-ramp table (the Platinum slots the WDEF decode identified: outline, frame-back, title fill fore/back, bevel highlight/shadow, widget face/outline/highlight, title text). Single source of truth the drawing core reads. Sourced per the Color-source step below; swappable without touching the drawing/manifest code.

### (b) Drawing core
Renders the **minimum-size window cicn** — the smallest frame holding the fixed corners, the 1px-tileable bevel bands, and the title bar with its baked widget boxes — into an RGBA buffer via `src/pixelBuffer.ts`, following the decode:
- Title bar: `titleHeight` rows (fixed; see Frozen parameters), filled with the `AA00AA00AA00AA00` 2-row stipple in the title fore/back colors, framed with the 1px bevel.
- Frame: 1px raised bevel (top/left light, bottom/right dark) per the decoded inset/edge order.
- Widget boxes: close (7×7 at `title.left+4`), zoom + collapse (7×7 at the right), baked into the title-bar art (they ride the fixed cells per the kDEF model).
- Emits the active and inactive variants (the runtime color-swap becomes two baked cicns). The pressed-widget state is **deferred** — it's interaction polish the runtime doesn't trigger for window widgets yet; revisit when widget interaction is wired (not needed to render a static window).

### (c) Manifest synthesizer
Builds the manifest assets:
- `cicn` (file/width/height) for each frame state, at canonical IDs: `inactive = wndId`, `active = wndId+1` (e.g. document-window `wnd# -14336` → inactive cicn `-14336`, active `-14335`).
- `ppat` for the stipple/fill patterns.
- `wnd#` `data`: `{ rectangles:[{part,rect{top,left,bottom,right}}], topSide/bottomSide/leftSide/rightSide:[{part,border}] }` — the recipe that tells the compositor how to tile/stretch the min-cicn (END-based cells; the title cell stretches, the corner/widget cells stay fixed).
- `cinf` `data` (optional but recommended): `{ cornerSize, sideThickness, tileSides, bgPatternId, bgPixel, textPixel, embossPixel, resizeBehavior }` so the compositor tiles the stipple and places the title correctly.

### (d) Assembler
Writes PNGs to `cicns/`/`ppats/`, assembles the manifest + a `meta.json` (`origin.kind: "first-party-generated"`, naming the generator + decode doc as the source in place of a `scheme.rsrc`) + `PROVENANCE.md`, calls `buildThemeJson` then `validateTheme`, and writes `theme.json` + `extraction-manifest.json`. Aborts non-zero on validation failure (same contract as the extractor).

## The document-window min-cicn + recipe (L1)

- **Min-cicn size:** title bar (`titleHeight` tall) + 1px body frame, wide enough to contain the left close-box cell, a minimal (1px-tileable) title-stretch cell, and the right widget cell — plus a 1px-tall body band that tiles vertically and a 1px body bottom.
- **Recipe (top edge):** fixed leading corner + close-box cell → stretch title cell → fixed right widget cell + trailing corner. Left/right/bottom edges: 1px tileable bands. Part codes follow the decoded/kDEF model (the stretch cell uses a grower part code; corners/widgets are fixed).
- The compositor already composes any `wnd#` recipe (`composeWindowChrome`), so once the recipe + cicn are right, the document window renders at any size with no compositor changes.

## Color source (the "decode-first" step)

Decode the authentic Platinum gray ramp before baking it, via this decision tree:
1. **Primary — sample the in-corpus `apple-platinum-2` scheme** (already in `themes/`, licensed, "a real Platinum Kaleidoscope scheme") at the face/bevel pixels the WDEF decode pins. In-repo, no external dependency.
2. **Cross-check — static-resource decode** of the 8.5 System file's `clut`/`wctb`/`cctb` candidates (`.scratch/iso-recon/` toolchain) for Apple's literal values.
3. If (1) and (2) diverge materially, **surface both for the user to adjudicate** (an emulator capture or a trustworthy reference image is the tiebreaker).

Risk/dependency: if neither in-repo source yields a clean ramp, a trustworthy Platinum reference image is needed (tracked in [#190](https://github.com/khawkins98/aaron-ui/issues/190)).

## Frozen parameters (acceptable, and authentic to the format)

A static cicn freezes what real Platinum computes at runtime — and so does every real Kaleidoscope scheme:
- **Title height / font:** baked at the standard classic-Appearance metric (9pt system font, ~`titleHeight` from the decode's `ascent+descent+2 ≥ 10`).
- **Pinstripe phase:** the `AA00` stipple tiles; phase-alignment-at-odd-widths may yield a ≤1px seam — same property as any stipple-pattern scheme; acceptable.
- **Active/inactive:** two baked cicn sets rather than a runtime color-swap.

## Scope

**In scope (this spec):** generator framework (a–d), the color-source step, the **document-window** chrome bundle (active/inactive), and validation.

**Out of scope (separate sub-projects):** L2 all window types (immediate follow-on — same machinery, more recipe data); L3 controls (needs a controls-CDEF decode first); L4 menus/popups/misc; ④ base-layer inheritance in the loader.

## Validation

- `validateTheme` — schema conformance (build-time, aborts on failure).
- `npm run lint:themes` — data-shape invariants (drawable extent, body-in-bounds, edge spans).
- `npm run diag:render` — renders the document window at multiple sizes; visually inspect tiling/stretch seams.
- **Visual diff** of the rendered document window (active + inactive) against the Platinum reference (the same reference used for the color step).
- A unit test that the generator's manifest passes `buildThemeJson` + `validateTheme` and produces the expected window-type/chrome-element slugs.

## Risks & open questions

- **Recipe fidelity for the widget cells:** the kDEF model bakes widgets into fixed cells; confirm the document-window recipe keeps the close/zoom/collapse boxes in fixed (non-stretching) cells at all widths (guarded by `lint:themes` "no widget in a stretch cell").
- **Color-source ambiguity** (see Color source) — the one external dependency.
- **`cinf` necessity:** confirm during implementation whether the document window needs a synthesized `cinf` (for tile-vs-stretch + title placement) or whether the compositor's stretch default suffices.
- **Provenance category:** `origin.kind: "first-party-generated"` is new; confirm `validateTheme` accepts it or extend the schema minimally.
```
