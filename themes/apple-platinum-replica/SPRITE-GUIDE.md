# Painting the Platinum document-window sprite

This bundle's document window is **one base sprite** (the minimum-size window cicn)
that the runtime **slices and tiles** to any window size via the `wnd#` recipe in
`theme.json`. The generator (`scripts/generate-platinum.mjs`) drew a procedural
starting scaffold; **you can repaint the sprite by hand** (Photoshop, etc.) and the
recipe will slice your art unchanged. This is the intended path to authentic raster
fidelity — the decode fixes the *geometry*, you paint the *pixels*.

## The two sprites

Each is **47 × 22 px**, RGBA, native resolution (zoom in your editor; this is pixel art):

- `cicns/cicn-n14335-active-document-window.png` — **active** window
- `cicns/cicn-n14336-document-window-inactive.png` — **inactive** window

(`ppats/ppat-128-title-pinstripe.png` is an 8×8 pinstripe tile — secondary; the
title fill is baked into the cicn.)

## Slice map (see `platinum-slicemap.png`)

Vertical slice lines at **x=15** and **x=23** split the top edge into three cells:

| region | x-range | behavior | paint… |
|---|---|---|---|
| **LEFT corner** | `[0, 15)` | **FIXED** (drawn 1:1) | the close box + the bar around it, full 2D detail |
| **TITLE fill** | `[15, 23)` (8px) | **TILED** across the title width | a **horizontally-seamless** texture (Platinum's pinstripe is horizontally uniform, so this is natural) |
| **RIGHT corner** | `[23, 47)` | **FIXED** (drawn 1:1) | the collapse + zoom boxes + the bar around them, full 2D detail |

Rows: **y=0** top outline · **y=1–19** title bar · **y=20** title/body divider · **y=21** bottom outline. Left/right columns (`x=0`, `x=46`) are the 1px side frame.

Current widget boxes (7×7, at **y=7–13**): **close** `x5–11`, **collapse** `x26–32`, **zoom** `x35–41`. You can move/restyle them freely *within the fixed cells*.

### The one rule
- **FIXED cells** → paint anything; it's drawn 1:1 at the window's corners.
- **TILE cell** → it repeats across the whole title width, so keep it horizontally seamless and **don't** put position-specific detail there (it'll tile). The pinstripe pattern lives here.
- Keep the pinstripe in the fixed cells' backgrounds matching the tile so the bar reads continuously.

## Re-import workflow

1. Edit the two `cicns/*.png` at **47×22** (don't change the dimensions, or the recipe coordinates won't line up).
2. Re-render to check: `node scripts/render-window.mjs apple-platinum-replica --w 360 --h 240 --title "Untitled"` → writes `diag/document-window.png`.
3. Validate: `npm run lint:themes`.

**Important:** once you hand-paint, the bundle PNGs are the source of truth — **do not** re-run `node scripts/generate-platinum.mjs`, which would overwrite your art with the procedural scaffold. The recipe (`theme.json` / `wnd#`) is independent of the pixels and won't need regenerating.

## Want a different canvas?
If 47×22 is awkward, the cell sizes are in `scripts/generate-platinum/metrics.mjs`
(`cells.leftFixed` / `cells.titleStretch` / `cells.rightFixed`) and `titleBarHeight`.
Bump them, re-run the generator once for a fresh scaffold at the new size, then paint.
