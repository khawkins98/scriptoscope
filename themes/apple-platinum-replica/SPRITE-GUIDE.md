# Painting the Platinum window sprites

This bundle defines **all 13 canonical Mac OS window types** (each active + inactive
= 26 base sprites). Each sprite is **one minimum-size cicn** that the runtime
**slices and tiles** to any window size via that type's `wnd#` recipe in
`theme.json`. The generator draws a procedural starting scaffold; **you repaint
the sprites by hand** (one master atlas in Photoshop, etc.) and the recipes slice
your art unchanged. This is the path to authentic raster fidelity — the decode
fixes the *geometry*, you paint the *pixels*.

## The model in one paragraph

Every window type is a tiny base sprite split into cells by its `wnd#` recipe.
On the **top edge** there are three cells: a **fixed LEFT corner**, a **GROW
title-fill** strip (8px, tiled/stretched across the title width), and a **fixed
RIGHT corner**. Widgets (close/collapse/zoom) are baked into the fixed corners,
so they're drawn 1:1 at the window's corners. The sides + bottom are 1px fixed
bands that tile. Collapsed types ship **only** a top recipe (title bar only, no
body frame). The compositor (`src/composeChrome.ts`) does all the slicing.

## Workflow: paint the whole set in one document

### 1. Generate the atlases

```
node scripts/generate-platinum-atlas.mjs
```

Writes **two** PNGs:

- **`sprite-atlas.png`** (≈114×231) — the **PAINTABLE** surface. All 26 sprites
  in a 2-column grid (active | inactive), one row per type, drawn at **1× native
  resolution**. Sprites are separated by a **magenta (`#ff00ff`) gutter void**;
  the sprite rects themselves hold **only paintable art** — no labels, no slice
  lines over the pixels. This is what you paint. Because it's 1×, **zoom in your
  editor** to do pixel work (Platinum is pixel art — paint at native scale, not on
  a downsampled grid).

- **`sprite-atlas-guide.png`** (478×1026) — the **REFERENCE MAP**. The same set
  upscaled to **4×**, each labeled with its type + state, with **magenta slice
  lines** drawn over the art so you can see where every cut falls:
  - **vertical magenta** = the top-edge cell boundaries (LEFT-corner edge and
    GROW-fill edge). Paint the corners (incl. widgets) between the outer edge and
    the first/last line; paint a **horizontally-seamless** texture in the GROW
    band (it stretches/tiles across the title).
  - **horizontal magenta** = the title/body divider (only on titled types).

  This map is **read-only** — never paint it and never slice it. Consult it
  alongside the paintable atlas to know which columns are the cut boundaries.

### 2. Paint

Repaint the sprites **in place** on **`sprite-atlas.png`** (the 1× paintable
one). Stay inside each sprite's magenta-bounded rect. Rules:

- **Paint at 1× native** — zoom your editor; one atlas pixel = one cicn pixel.
- **FIXED corner cells** → paint anything; drawn 1:1 at the window corners.
- **GROW title-fill cell** → repeats/stretches across the title width, so keep it
  horizontally seamless and **don't** put position-specific detail there.
- **Do not move sprites, resize the canvas, or paint into the magenta gutters** —
  the slicer reads fixed coordinates and copies each sprite rect verbatim. The
  magenta is *outside* the art; use the **guide map** to see the internal cuts.

### 3. Slice back into the bundle

```
node scripts/slice-platinum-atlas.mjs              # writes the 26 cicn PNGs
node scripts/slice-platinum-atlas.mjs --dry        # preview, write nothing
npm run lint:themes                                # validate the bundle
```

The slicer reads **`sprite-atlas.png`** and copies each sprite's pixels **1:1**
from its layout rect into the per-type cicn PNG at native dimensions — no
downsampling, no magenta handling (the magenta lives only in the gutters, outside
every sprite rect). It writes **only** the per-type cicn PNGs; the `theme.json` /
`wnd#` recipes are independent of the pixels and don't need regenerating.

**Layout is shared.** Both the atlas generator and the slicer import
`scripts/generate-platinum/atlas-layout.mjs` (`computePaintableLayout`), so they
always agree on every sprite's `(x, y, w, h)` slot. Round-tripping the *generated*
1× atlas back through the slicer reproduces the source sprites **byte-for-byte**.

## The 13 window types — region map

| slug | wnd# | cicn dims | title bar | top cells (L / fill / R) | widgets |
|---|---|---|---|---|---|
| document-window | −14336 | 47×22 | 19px | 15 / 8 / 24 | close · collapse · zoom |
| collapsed-document-window | −14332 | 47×22 | 19px | 15 / 8 / 24 | close · collapse · zoom |
| dialog | −14328 | 18×3 | none | 5 / 8 / 5 | — |
| alert | −14326 | 18×3 | none | 5 / 8 / 5 | — |
| movable-modal | −14324 | 29×19 | 16px | 16 / 8 / 5 | close |
| movable-alert | −14322 | 29×19 | 16px | 16 / 8 / 5 | close |
| titled-utility-window | −14304 | 29×14 | 11px | 16 / 8 / 5 | close |
| collapsed-titled-utility | −14300 | 29×14 | 11px | 16 / 8 / 5 | close |
| side-floating-utility-window | −14296 | 18×14 | 11px | 5 / 8 / 5 | — |
| collapsed-side-utility | −14292 | 18×14 | 11px | 5 / 8 / 5 | — |
| no-title-utility-window | −14288 | 18×3 | none | 5 / 8 / 5 | — |
| collapsed-no-title-utility | −14284 | 18×3 | none | 5 / 8 / 5 | — |
| popup-window | −12320 | 18×17 | 14px | 5 / 8 / 5 | — |

cicn pairing follows the Mac OS WDEF convention: **inactive = wnd# id**,
**active = wnd# id + 1** (e.g. document-window: inactive −14336, active −14335).
The "collapsed" types share the open type's geometry but ship an empty
bottom/left/right recipe, so only the title bar renders. The
side-floating-utility scaffold approximates its side bar as a thin top bar (a
clean-room simplification — repaint as desired within the same cells).

## Recipe correctness (why the cells are what they are)

Per `classifyPart` in `src/composeChrome.ts`:

- **part 1** = FIXED (drawn 1:1) — corners, widget cells, frame bands.
- **part 8** = GROW (absorbs the window's slack) — the title-fill strip.
- **part 0** = COLLAPSES to width 0 — never used for a kept cell.

Cells are END-based: a `{part, border}` entry closes the cell at `border`,
spanning from the previous border. The leading `[0, border[0])` region is always
the fixed corner. So each top edge is
`[{part:1, border:leftFixed}, {part:8, border:leftFixed+8}, {part:1, border:W}]`
= fixed-left / grow-middle / fixed-right. The body `part-0` rect is always
non-degenerate (`lint:themes` rejects `bottom ≤ top` or `right ≤ left`).

## Regenerating the scaffold

```
node scripts/generate-platinum.mjs        # redraws ALL 26 cicns + theme.json
```

**This overwrites hand-painted cicns** with the procedural scaffold. Once you've
painted, treat the bundle PNGs (or the atlas) as the source of truth and use the
slicer, not the generator. To change a type's geometry (cell sizes, bar height,
widgets), edit `scripts/generate-platinum/window-types.mjs` and re-run the
generator + atlas once for a fresh scaffold at the new size.

## Source layout

- `scripts/generate-platinum/window-types.mjs` — the 13 type configs +
  `geometryFor()` (the single geometry source of truth).
- `scripts/generate-platinum/draw-window.mjs` — generic per-type placeholder drawer.
- `scripts/generate-platinum/manifest.mjs` — builds the cicn/wnd#/cinf assets.
- `scripts/generate-platinum/atlas-layout.mjs` — shared grid coords:
  `computePaintableLayout()` (1× slicer-facing) + `computeGuideLayout()` (4× map).
- `scripts/generate-platinum/atlas.mjs` + `scripts/generate-platinum-atlas.mjs` —
  emits both `sprite-atlas.png` (paintable) and `sprite-atlas-guide.png` (map).
- `scripts/generate-platinum/slice-atlas.mjs` + `scripts/slice-platinum-atlas.mjs` —
  the 1:1 slicer (reads the 1× paintable atlas).
