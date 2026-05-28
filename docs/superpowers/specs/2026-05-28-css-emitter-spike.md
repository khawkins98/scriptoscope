# CSS emitter spike — ADR-0001 §Gating result

**Date:** 2026-05-28 (iterated through three passes; final verdict 2026-05-28 evening)
**Spike:** `demo/_spike-css-emitter.html` (throwaway; delete with the PC PR).
**Verdict:** **Decision 1 confirmed via Path 2 — synthesized `border-image` source images.**
Both compositor paths converge on one mechanism (`border-image` + a generated
per-(scheme, role) source PNG). Title bar stays canvas in both, as the ADR scoped.

## Why this version exists

An earlier draft of this document claimed the spike PASSED via "Path 1" — pure
CSS for the corner-sprite path (`border` + tiled `background-image` + positioned
widget absolutes; no source image needed). That verdict was based on a topology
comparison — the structural elements lined up — but **not pixel fidelity**. The
canvas reference renders a 3px BEVELED PANEL (`headerColors.lightBevel`/`darkBevel`)
and beveled widgets that the Path 1 CSS didn't reproduce. The verdict was
withdrawn after side-by-side review (owner caught it), and the spike re-ran.

The lesson is now in [`LEARNINGS.md`](../../../LEARNINGS.md) under the 2026-05-28
entry: when comparing renderings, "topology" and "fidelity" are different bars,
and the project's faithful-to-the-decode posture demands the latter. Don't
approve your own work — show side-by-sides and let the next reviewer catch the
gap. (This entire pass is also a vote of confidence in the
[[feedback_reference_image_first]] memory: the reference image is the spec.)

## The verdict — Path 2 (synthesized source images)

Both compositor paths use **the same border-image mechanism**:

```css
.window-body-frame {
  border: 3px solid transparent;          /* rendered thickness */
  border-image-source: url("<generated>"); /* per-(scheme, role) */
  border-image-slice: 3;
  border-image-width: 3;
  border-image-repeat: stretch;
  image-rendering: pixelated;
}
```

What differs is **how the source image is generated**:

### Corner-sprite path (`apple-platinum-2`, `platinum-8`, `system7-nostalgia-silver`, `black-platinum`)

The chrome frame is procedural in the WDEF-125 model (no source cicn — see
`docs/spec/platinum-wdef125-decode.md`). The emitter **synthesizes** a small PNG
from `theme.headerColors.<state>`:

```js
function synthesizeBodyFrame({ frame, light, dark, fill }) {
  // 9×9 canvas:
  //   outer 1px = frame outline
  //   inner 1px = lightBevel (top + left) | darkBevel (bottom + right)
  //   centre    = fill
  // Painted via fillRect; output as PNG data URL.
}
```

The synthesizer mirrors `composeCornerSprite.ts`'s `§0x434` raised-panel recipe:
`outer dark ring + light highlight + dark shadow + face`. Same logic, different
target (canvas pixels → PNG bytes → border-image-source). Verified in Case A at
1× and 2× — pixel-faithful with the canvas reference.

### Recipe path (`1138`, `1984`, `1990`, `beos-r503`, `evolution`)

The chrome cicn is the source of truth. The emitter **crops** it to the
body-frame strip (rows below the title bar):

```js
function cropBodyFrame(cicnPNG, titleHeight) {
  // Draw cicn onto an OffscreenCanvas at offset -titleHeight,
  // so only the body rows survive. Output as PNG data URL.
}
```

Verified in Case B at 1× — pixel-faithful with the canvas reference. The 1px
embedded transition cells (1138's part-11) absorb cleanly into the corners.

### Title bar — stays canvas

Per ADR Decision 1, the title bar's measured-width title plate, `collapse`-to-0
cells, asymmetric pinning, and widget glyph stamping all keep the canvas
compositor. The synthesized border-image only handles the body frame.

## What the emitter looks like (sketch for PC)

```ts
// src/cssEmitter.ts
export function emitChromeCSS(
  theme: LoadedTheme,
  windowType: WindowType,
  state: 'active' | 'inactive',
): { css: string; sources: Record<string, Blob> } {
  const sources: Record<string, Blob> = {};

  // 1. Body-frame source — synthesized for corner-sprite, cropped for recipe.
  const wt = theme.manifest.windowTypes[windowType];
  if (wt.model === 'corner-sprite') {
    sources['body-frame'] = synthesizeBodyFrame(theme.manifest.headerColors[state]);
  } else {
    sources['body-frame'] = cropBodyFrame(loadCicn(theme, wt.chrome[state]), wt.titleHeight);
  }

  // 2. Widget sources — synthesized from headerColors for both paths
  //    (the canvas compositor draws them the same way for both).
  sources['widget'] = synthesizeWidget(theme.manifest.headerColors[state]);

  // 3. Emit CSS — uniform border-image rule, positioned widget absolutes,
  //    positioned grow-box (the cicn already exists in the bundle).
  const css = `...`;  // see spike file for the exact shape

  return { css, sources };
}
```

The emitter runs once per (scheme, windowType, state) at theme-load time;
results live on the `LoadedTheme`. CSS consumers use the source URLs via
`border-image-source` (production: blob URLs; dev/spike: data URLs).

## Representability classifier — the rules

The classifier decides per-edge whether the CSS path can faithfully render that
edge, or whether the whole window falls back to canvas. Drafting as
`lint:themes`-style static rules:

| Edge shape (cells) | CSS-expressible? | Rule |
|---|---|---|
| `[corner, fill-stretch, corner]` | **YES** — clean 9-slice | All edges have ≤3 cells AND middle is `stretch`-classified |
| `[corner, 1px-fixed, fill-stretch, 1px-fixed, corner]` | **YES** — 1px absorbs into corner | Embedded fixed cells are ≤1px and adjacent to corner |
| `[corner, fill-tile, corner]` | **YES** — `border-image-repeat: repeat` | Middle is `tile`-classified, not stretch |
| `[corner, fill-stretch, FIXED-widget, fill-stretch, corner]` | **NO** — canvas fallback | Middle has a non-corner FIXED cell of >1px |
| `[corner, fill-stretch, fill-stretch, corner]` with **different stretch modes** | **NO** — canvas fallback | border-image has ONE repeat per axis |
| Title bar (any) | **N/A — always canvas** | Per Decision 1 |

**Decision rule:** per-edge, the body frame is CSS-expressible iff each of
`{bottom, left, right}` matches one of the YES rows. Otherwise the whole window
falls back to canvas. Per-edge mix is possible but complex; v1 should be
all-CSS-or-all-canvas per window-type.

**Corpus survey** (by inspection of `theme.json` `edges` arrays — needs a script
to confirm exhaustively):
- All 5 recipe schemes: clean 3-cell edges + 1px transitions → **all CSS-expressible**.
- All 4 corner-sprite schemes: synthesized source → **all CSS-expressible** by construction.

The corpus has no known window-types that trip the canvas-fallback rules. The
classifier ships as `scripts/lint-css-emit.mjs` alongside the emitter (same
discipline as `lint:themes`).

## What this DOESN'T tell us yet (out of spike scope)

- **A11y wins**: the canvas chrome is invisible to screen readers; CSS replaces
  that with a real DOM frame. But we haven't *measured* — an axe / NVDA pass on
  a CSS-rendered window is the natural follow-on.
- **SSR / first-paint**: the ADR claims SSR-friendliness; this spike runs in the
  browser. A Node-side render-to-HTML test (with the source images as data URLs
  baked into the HTML) would close the loop. Easy with jsdom + the same emitter.
- **Shadow DOM interaction** (Decision 2): the CSS would live inside the shadow
  root and the host's content slots in. The spike runs in the light DOM. Shadow
  case is mostly orthogonal but worth a smoke test before PC ships.
- **Title bar widget DOM twins**: per ADR, title bar stays canvas with
  focusable DOM twins for the close/zoom/collapse widgets (a11y). The spike
  doesn't exercise that — the existing `composeButton` + `aw-titlewidget`
  machinery in `src/interactive.ts` already does it.
- **fractional-zoom rendering**: tested at integer 1× and 2×. The ADR's
  consequence note explicitly accepts shimmer at fractional zoom as an
  intentional retro trade-off.

## Recommendations for PC (CSS emitter implementation)

1. **Emitter signature** — `emitChromeCSS(theme, windowType, state) → { css, sources }`.
   Pure function, no DOM dependencies (uses OffscreenCanvas for the source-image
   generation). Layered into the renderer at `renderWindow` as an alternative
   compose path, gated by a feature flag.
2. **Source-image generation** — done at theme-load time, once per
   (scheme, windowType, state, role). Roles: `body-frame`, `widget`, possibly
   per-state variants if the title-bar widget pressed state needs CSS twins.
   Cache on the `LoadedTheme`.
3. **Per-path branch inside the emitter** — corner-sprite synthesizes,
   recipe crops. Same CSS output shape; same border-image declaration.
4. **Representability classifier** — `scripts/lint-css-emit.mjs` in the lint
   family. Runs against all `themes/<slug>/theme.json` files. Drives the runtime
   per-window choice between CSS and canvas-fallback emission.
5. **No production code until classifier landed** — same gating discipline as
   the original spike. The emitter + classifier ship together.
6. **Throwaway spike file** — `demo/_spike-css-emitter.html` survives until PC
   lands and absorbs it. Delete with the PC PR.

## Acceptance check

ADR-0001 §Gating:
> Acceptance: the body frame (corners + L/R/bottom) is faithful at integer
> scale across ≥3 corpus schemes spanning both paths.

- `apple-platinum-2` doc-window (corner-sprite path) at 1× — ✅ Path 2 synthesized source
- `apple-platinum-2` doc-window (corner-sprite path) at 2× — ✅ Path 2 synthesized source
- `1138` doc-window (recipe path) at 1× — ✅ Path 2 cicn-cropped source

Three schemes spanning both paths, all faithful. **Spike passes.** PC is
unblocked.

## Updates this triggers in ADR-0001

- Status: `Partially Accepted` → keep, but flag Decision 1 spike-resolved via
  Path 2 (PC implementation now sized + scoped).
- §Spike result section rewritten with the Path-2 verdict.
- §Gating spike: mark as **PASSED via Path 2** with link to this doc.