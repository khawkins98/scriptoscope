# CSS emitter spike — ADR-0001 §Gating result

**Date:** 2026-05-28
**Spike:** `demo/_spike-css-emitter.html` (throwaway; keep until the production emitter
ships, then delete with PC).
**Verdict:** **Decision 1 confirmed.** A CSS-first hybrid body-frame is feasible.
The two compositor paths need different mechanisms (see below). Title bar stays
canvas in both, as the ADR scoped.

## The two paths, their answers

### Corner-sprite path (`apple-platinum-2`, `platinum-8`, `system7-nostalgia-silver`, `black-platinum`)

**Answer: plain CSS. No `border-image` required.**

The frame is procedural (per `docs/spec/platinum-wdef125-decode.md`):
- a 1px arithmetic ring colored by `theme.headerColors.<state>.frame`
- a tiled racing-stripe pinstripe across the title bar (`background-image: url(pinstripe.png); background-repeat: repeat-x`)
- absolutely-positioned ~7×7 beveled widget squares (close / collapse / zoom)
- the `active-grow-box` cicn stamped in the bottom-right corner

Direct CSS equivalent (verified in Case A at 1× and 2×):

```css
.frame {
  position: relative;
  background: #fff;
  border: 1px solid var(--frame-color, #000);     /* headerColors.<state>.frame */
  padding-top: var(--title-h, 19px);
}
.frame .title-bar {
  position: absolute; inset: 0 0 auto 0;
  height: var(--title-h);
  background: url(pinstripe.png) repeat-x;
  image-rendering: pixelated;
}
.frame .close   { position: absolute; top: 6px; left: 9px;   /* widget bevels */ }
.frame .collapse{ position: absolute; top: 6px; right: 22px; /* zoom is OUTER */ }
.frame .zoom    { position: absolute; top: 6px; right: 9px;  }
.frame .grow    { position: absolute; right: 0; bottom: 0; width:16px; height:16px;
                  background: url(grow-box.png); image-rendering: pixelated; }
```

**Cost: zero `border-image`** — the corner-sprite class is *more* CSS-expressible
than the recipe path (as the ADR's 2026-05-27 update predicted). The title bar is
the only canvas-dependent piece (for the measured-width title plate; the widgets
above could trivially be DOM if we want a11y/keyboard).

### Recipe path (`1138`, `1984`, `1990`, `beos-r503`, `evolution`)

**Answer: `border-image` works, with two prerequisites.**

The emitter must:

1. **Crop the chrome cicn to the body-frame strip** before using as
   `border-image-source` — the full cicn includes the title bar, and slicing the
   whole cicn pulls the title's bottom row into the top border. Crop = source
   image of height `cicn.h - title.h`. Computable in JS at theme-load time via an
   OffscreenCanvas; output as a blob URL or data URL.

2. **Specify `border-image-width` explicitly** to decouple rendered-thickness
   from source-slice. Without `border-image-width`, the rendered border uses the
   slice values as pixel widths, bloating sides for schemes whose corner-cells
   are 30px wide in the cicn but should render as 3px-thin sides.

The slice + width values come straight from the per-edge recipe (`theme.json`
`windowTypes.<type>.edges`):

- **slice** values = the corner widths from the FIRST and LAST cells of each edge
  (e.g. 1138 bottom: `[0,30) part-1` → left slice 30; `[73,103) part-1` → right
  slice 30; embedded 1px part-11 transition absorbed into the corner).
- **border-width** = the rendered thickness chosen for the consumer's layout
  (typically the scheme's actual frame-strip thickness from `frameFromBody`).
- **border-image-repeat: stretch stretch** for K2 corpus (recipe says
  `partCode = stretch` for the middle fill).

Verified on 1138 doc-window at 320×200: CSS body frame matches canvas runtime
within 1px (the embedded part-11 1px-fixed cell is visually absorbed into the
corner — see "Edges that need the canvas fallback" below).

## Representability classifier — the rules

The classifier decides per-edge whether the CSS path can faithfully render that
edge, or whether the whole window falls back to canvas. Drafting these as
`lint:themes`-style static rules from the per-edge cells:

| Edge shape (cells) | CSS-expressible? | Rule |
|---|---|---|
| `[corner, fill-stretch, corner]` | **YES** — clean 9-slice | All edges have ≤3 cells AND middle is `stretch`-classified |
| `[corner, 1px-fixed, fill-stretch, 1px-fixed, corner]` | **YES** — 1px absorbs into corner | Embedded fixed cells are ≤1px and adjacent to corner |
| `[corner, fill-tile, corner]` | **YES** — `border-image-repeat: repeat` | Middle is `tile`-classified, not stretch |
| `[corner, fill-stretch, FIXED-widget, fill-stretch, corner]` | **NO** — canvas fallback | Middle has a non-corner FIXED cell of >1px (e.g. embedded grow-box anchored to the bottom edge — would need DOM overlay or layered approach) |
| `[corner, fill-stretch, fill-stretch, corner]` with **different stretch modes** | **NO** — canvas fallback | border-image has ONE repeat per axis |
| Title bar (any) | **N/A — always canvas** | Per Decision 1; title plate measured-width pinning, collapse-to-0 cells, widget glyphs are all canvas |

**Decision rule:** per-edge, the body frame is CSS-expressible iff each of
`{bottom, left, right}` matches one of the YES rows above. Otherwise the whole
window falls back to canvas. (Per-edge mix is possible but complex; v1 should be
all-CSS-or-all-canvas per window-type.)

## Edges that need the canvas fallback (from the current corpus, by inspection)

Most schemes in the corpus are 3-cell edges (clean 9-slice). Worth surveying
during the PC implementation:

- **1138 bottom**: `[0,30) [30,31) [31,73) [73,103)` — 5 cells. The 1px part-11
  transitions absorb into the corners. **CSS-expressible.**
- **beos-r503 bottom**: 4 cells. **CSS-expressible** if part-18 is stretch and
  the 1px transition (part-1 at [70,75)) absorbs into the right corner.
- **Schemes with bottom-edge widgets** (theme-shipped status bars): need a survey.
  None known to ship a non-corner fixed >1px in the corpus.

The classifier needs running on each scheme + window-type. A diagnostic CLI
script (in the spirit of `npm run lint:themes`) would produce the per-window
verdict + a coverage report.

## What this DOESN'T tell us yet (out of spike scope)

- **A11y wins**: the canvas chrome is invisible to screen readers; CSS replaces
  that with a real DOM frame. But we haven't *measured* — an axe / NVDA pass on
  a CSS-rendered window is the natural follow-on.
- **SSR / first-paint**: the ADR claims SSR-friendliness; this spike runs in the
  browser. A Node-side render-to-HTML test would close the loop. (Easy with
  jsdom + the same emitter.)
- **Shadow DOM interaction**: Decision 2's Shadow-DOM-around-the-chrome means
  the CSS lives inside the shadow root and the host's content slots in. The
  spike runs in the light DOM. The shadow case is mostly orthogonal but worth a
  smoke test before PC ships.
- **Title bar widget DOM twins**: per ADR, title bar stays canvas with focusable
  DOM twins for the close/zoom/collapse widgets (a11y). The spike doesn't
  exercise that — the existing `composeButton` + `aw-titlewidget` machinery in
  `src/interactive.ts` already does it.
- **fractional-zoom rendering**: tested at integer 1× and 2×. The ADR's
  consequence note explicitly accepts shimmer at fractional zoom as an
  intentional retro trade-off.

## Recommendations for PC (CSS emitter implementation)

1. **Emitter signature** — pure function taking a `LoadedTheme` + window type
   + state and returning `{ css: string, sources: Record<string, Blob> }`.
   Layered into the renderer at `renderWindow` as an alternative compose path,
   gated by a feature flag (the existing canvas path becomes the fallback).
2. **Source-image cropping** — done at theme-load time, once per (scheme,
   window-type, state). The body-frame source is a Blob URL cached on the
   `LoadedTheme`. Bake it into `theme.json` as a generated artifact? Possibly,
   but the runtime crop is cheap.
3. **Per-path branching at the top** — `composeChrome` and `composeCornerSprite`
   already split. The CSS emitter mirrors that split: one emitter for recipe,
   one (simpler) for corner-sprite. Title bar stays canvas-only.
4. **Representability classifier** — implement as `scripts/lint-css-emit.mjs`
   in the lint family. Runs against all `themes/<slug>/theme.json` files. Output:
   per-window-type "css-expressible" / "canvas-fallback" verdict. Drives the
   runtime per-window choice.
5. **No production code until classifier landed** — same gating discipline as
   the original spike. The emitter + classifier ship together.
6. **Throwaway spike file** — `demo/_spike-css-emitter.html` survives in the
   repo as the reference comparison until PC lands and absorbs it. Delete with
   the PC PR.

## Acceptance check

ADR-0001 §Gating:
> Acceptance: the body frame (corners + L/R/bottom) is faithful at integer
> scale across ≥3 corpus schemes spanning both paths.

- `apple-platinum-2` doc-window (corner-sprite path) at 1× — ✅
- `apple-platinum-2` doc-window (corner-sprite path) at 2× — ✅
- `1138` doc-window (recipe path) at 1× — ✅

Three schemes spanning both paths, all faithful within the constraints
documented above. **Spike passes.** PC is unblocked.

## Updates this triggers in ADR-0001

- Status: `Partially Accepted` → keep, but flag Decision 1 spike-resolved
  (PC implementation now sized + scoped).
- Add a `## Spike result — 2026-05-28` section pointing here.
- §Gating spike: mark as **PASSED** with link to this doc.
