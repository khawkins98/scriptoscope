# Visual design for authored schemes

*A reference for making a scheme look good, not just load. The workflow
(brief, concept, paint-over, build, preview, 8-bit check) is in
[`authoring-a-scheme.md`](./authoring-a-scheme.md) §4, and the engine
mechanics this doc assumes (masks, the 256-colour budget, hidden swatches,
gamma, dithering) are in its §3. Nothing here asks the format for something
it can't do.*

## 1. What separates a good scheme

The first versions of the four early schemes (Halcyon, Castle, Brickworks,
Bonn) were structurally sound and passed every check, and they still looked
generated next to the best corpus schemes (`animals`, `evolution`, `1984`).
A design review traced that to three habits, none of them a format limit:

- **Textures made of edges instead of surfaces.** Castle's first stone gave
  every block a lit row, a shaded row, a mortar line and speckle, so at 1× it
  read as a grey mesh.
- **Soft strokes where a 1-bit format wants whole pixels.** Title-bar glyphs,
  arrowheads and thumb grips drawn with 1–1.7 px anti-aliased strokes came out
  as grey smears.
- **Palettes chosen in sRGB without checking the 8-bit system palette.** A
  warm grey 10–20 units off the grey axis showed as pink at 8 bpp, and five
  stone tones within 20 units of each other collapsed onto one entry.

The fix for all three was the same: design the whole window first as a
concept image, then rebuild it on whole pixels in system-palette colours
(the workflow in the authoring guide). Section 2 is the pixel guidance that
came out of the review; section 3 is what the concept passes taught.

## 2. Pixel-UI guidance for this format

### 2.1 One light, from the top left

Every corpus scheme that looks "right" uses the Macintosh convention: light
from the upper left, so top and left edges are lit and bottom and right edges
are shaded. Decide this once per scheme, write it in `scheme.mjs`'s header
comment, and apply it to **everything**: frame bevels, blocks, studs,
buttons, thumbs, tabs, the raised title plate, the sunk track.

- *Two lights.* Lighting both corner towers from the left while the wall
  between them stays flat reads as a dirty edge, not shade. One light
  direction covers the whole frame.
- *Gradient as light.* A smooth gradient is not a light source at 1×. A 1 px
  highlight row **is**. Use gradients for material (glass, water) and 1 px
  rows for form.
- A cylinder lit from the left on a slab lit from the top (a stud on a brick)
  is still consistent with upper-left light.

### 2.2 Outlines and highlights

- **Outline the silhouette, not the parts.** A 1 px dark outline around the
  whole frame (`raster.outlineEdges`) is what makes a window read on any
  background. Inside the silhouette, outline only what the eye needs to
  separate: the title plate, widgets, the content hole. Don't outline every
  block, stud or petal.
- **Outline colour is a dark of the material, not black.** A warm near-black
  for warm materials, navy for blue glass. `#000000` is only right on pure
  Platinum-style chrome.
- **One highlight pixel beats a dithered band.** A single lit row on the top
  edge and a single lit column on the left edge of a shape is the standard
  1990s bevel. A dithered falloff over a fifth of a shape is invisible at 1×
  and a checkerboard at 8 bpp.
- **Selective highlights.** In a texture (stone, bricks, cobbles), highlight
  roughly a third to a half of the elements, chosen by hash, and leave the
  rest flat. All-highlighted equals none-highlighted.
- **Anti-aliasing: use it for curves against a known matte, never for
  strokes under 2 px.** `fillRoundRectSmooth` and `fillCircleSmooth` are
  good for button corners and discs because the blend is against real
  pixels. `strokeLineSmooth` at 1–1.7 px produces a 2–3 px grey smear with no
  solid core. Place glyphs on whole pixels with `raster.sprite(x, y, rows,
  legend)` (a 5×5 ×, a 5 px bar, a 3-row chevron), and use the stroke function
  only for diagonals wider than 2 px.
- **Rounded corners at 1×:** radius 2–4 px, drawn as a pixel stair (1-2-1),
  not a blended arc. The 1-bit mask forces a hard outer edge anyway; make it
  look intentional.

### 2.3 Palette construction

- **Ramps per material, 3–5 steps, visibly different.** A usable ramp has
  steps of 25–40 units in value, and the extremes (lit, shade) 60+ units from
  the base. A record like Brickworks' `brick(hi, base, lo, deep)` is the right
  shape.
- **Hue-shift the ramp.** Shadows go cooler and more saturated, highlights
  warmer and less saturated. Keep the shift small enough that the 8-bit snap
  doesn't flip it.
- **Design inside the 6×6×6 cube** (plus the grey ramp) so the scheme looks
  the same in classic. The system palette has 51-unit steps; a colour 20 units
  off the grey axis snaps to a *coloured* entry. Land each ramp step on its
  own entry, or accept that steps collapse and design so the collapse is
  harmless. `--palette` checks this mechanically. Warm greys are the worst
  case: at 8 bpp they are grey or pink, never "warm grey"; put the warmth in
  other materials instead (Castle's stone is plain grey, its roofs and banner
  are warm).
- **Contrast floors**, on the on-screen colours:

  | Pair | Floor |
  |---|---|
  | active title on its plate | 4.5:1 |
  | inactive title on its plate | 3:1, ideally 4.5:1 |
  | frame outline against white and against the scheme's own body | 3:1 |
  | button label on its face | 4.5:1 |
  | glyph on its widget | 3:1 |

  The engine's bitmap title is 1 px strokes, so it needs *more* contrast than
  a modern font would. `npm run author` prints the title and label ratios;
  declare the other pairs in `palette.mjs`'s `CONTRAST` export and `--palette`
  checks them.
- **Colour budget.** 256 per `cicn` is generous if ramps are flat colours;
  it is gone in one frame if every edge is a smooth blend and every tone has
  three mixes. `fitPalette` saves the build but merges the rarest colours
  first, which are often the deliberate 1 px highlights. Build with flat ramps
  so `fitPalette` has nothing to do.

### 2.4 Texture and live text

The web runtime tiles a `ppat` behind live page text
([R21](./authoring-exotic-frames.md#4-window-body-textures-r21r23)); classic
does not (R22). Two rules:

- **Texture contrast under text ≤ 1.15:1** between its lightest and darkest
  pixel, and no feature on a 1–2 px rhythm (letter stems are 1 px; a 1 px
  joint grid aliases with them). Rings or joints every 8 px already make body
  text look rough.
- **Frame and body need a value step between them.** If the frame is
  mid-grey stone, the body should be light; if the frame is light sandstone,
  the body can be cream but the bar needs a rule. A window is a figure on a
  ground, and the content hole is a second figure. A stone frame on a stone
  body has no hierarchy at all.

### 2.5 Ornaments, tiling and size

- Put ornaments in **fixed** cells (code 1 or 10), never in a 1 px grower,
  and keep one plain column between an ornament and a grower. `layout.lint`
  catches art that leaks into a tiled cell.
- Make big ornaments **droppable**: code 10 cells disappear on narrow
  windows. But every pixel of ornament on the title bar comes out of the
  title's room, and the engine drops the title before it drops a code-10 cell
  ([R6](./authoring-exotic-frames.md#1-cell-codes-rules-r1r12)). Print
  `layout.minWidthForTitle(px)` and size the ornament by it.
- **Tile period vs. feature size.** A 12 px tile with a 7 px merlon and a
  5 px gap reads as a rhythm; a 12 px tile with a 7 px merlon and two 2.5 px
  half-gaps reads as a seam. Design the tile so the repeat lands in the
  *middle* of a gap.
- **Big windows amplify.** At 900 px wide the bar is 70 copies of the tile.
  Any 1 px feature per tile becomes a dotted line; any dither becomes
  stripes. Check the `sizes.html` preview layout after every tile change.
- **Small windows subtract.** List what each window type sheds in order
  (ornament, then the second widget, then the title end caps) and make sure
  what's left still looks like the scheme.

### 2.6 Widget families and states

- **One silhouette, one rim, one glyph grammar** for close, zoom and
  collapse. Three discs with different glyphs are a family; a shield, an arch
  and a plate are a collection. Variety belongs in the *fill*, not the shape.
- **Glyphs say what the widget does.** × for close, a square or + for zoom,
  a bar or chevron for collapse. A themed glyph (a portcullis for zoom) only
  works once the user already knows which box is zoom.
- **Pressed must be visibly a different state**, not a darker copy. Invert
  (gold on blue becomes blue on gold); don't darken by 10%.
- **Inactive is a quieter version of the same object**: keep the silhouette
  and outline, drop the glyph, lift the fill toward the inactive bar colour,
  and keep the title at ≥ 3:1. Fading every colour 60% toward one grey turns
  them all into the same mud; a per-hue desaturation keeps window-type colour
  coding.
- **Push button, checkbox, radio, scroll parts and tabs** share the scheme's
  edge colour, corner radius and highlight rule. The scrollbar is where
  schemes drift most: loud arrow boxes in the title's colour demote the
  title.

### 2.7 Avoiding the generated look

The tells, in the order reviewers notice them:

1. Anti-aliased strokes under 2 px (§2.2).
2. Every element highlighted and outlined; no flat surface anywhere.
3. Ramps of five near-identical tones, and gradients where a 1 px highlight
   was wanted.
4. Hashed "random" variation on every pixel (speckle, grit) instead of a few
   deliberate chips.
5. Smooth circles for things that should be pixel clusters (trees, blossoms,
   studs).
6. A different idea for each widget.
7. Palettes chosen by name in sRGB rather than against the system palette
   and against each other.

The opposite of each is cheap in this toolkit: `r.set` and `r.sprite` on
whole pixels, `hline`/`vline` for highlights, a 3-tone ramp, and a hash that
chooses *which* block gets the chip rather than *whether each pixel* does.

## 3. Designing from a concept

These are the lessons from running the concept workflow (brief, concept,
paint-over, clean-up) on all five schemes. They belong in the brief.

- **Start from references.** Before the brief, look at three to five photos
  of the real material and at corpus schemes with the same ambition
  (`themes/<slug>/` reference images: `animals` for ornament, `beos-r503` for
  asymmetry, `1984`, `crayon-os`, `dolphin-som`). Write down the light
  direction and the one memorable thing.
- **Give numbers, not adjectives.** The first implementation of each concept
  copied the motifs and missed the scale: the right objects at sticker size on
  the old thin frame. A second pass with numeric targets measured off the
  concept fixed it. The targets that worked for a document window of about
  400×260: side bands 14–18 px of real material; a top band of 34–44 px plus
  ornaments that stand 16–40 px above the bar; a bottom band of 14–22 px with
  its own motif. A restrained scheme can keep thin sides and put the weight
  into one ornament (Halcyon: 6 px sides and one big bird).
- **Silhouette beats texture.** One scale-up pass of Castle thickened the
  walls but shrank the conical roofs into pepper-pots, and it read less like a
  castle than before. Name the one silhouette that carries the theme in the
  brief, and check it survives every pass.
- **Budget the title's room.** Ornaments in the top edge's fixed cells raise
  the width at which the title appears, and a narrow window shows the
  ornament and "…". Decide that trade-off on purpose
  ([R6](./authoring-exotic-frames.md#1-cell-codes-rules-r1r12)).
- **Keep the essential look in the bar rows.** In classic, a window at the
  top of the screen has everything above its title bar under the menu bar
  (R16). Art above the bar is decoration.
- **Calm bodies.** Asked for "parchment", agents reach for a saturated
  butter-yellow. Give a low-chroma hex range and check it in the 8-bit
  simulation: `#e8e0cc` snapped to pink at 8 bpp, while `#efe8d8` maps to a
  neutral grey.
- **A title plate can carry a repeat.** The engine tiles the code-5 plate
  across the title width, so a stud row or a fringe can run over the title.
  Mark the cell `tiled: true` in `frameLayout`, and `lint` checks only the
  title rows.

## 4. Review checklist

Copy this into the scheme's PR description:

- [ ] One light direction, stated in the header comment, visible on every bevel.
- [ ] Silhouette outlined; interior outlines only on plate, widgets, content hole.
- [ ] No `strokeLineSmooth` narrower than 2 px; glyphs on whole pixels.
- [ ] Each material ramp ≤ 5 steps, each step ≥ 25 units apart, all on system-palette entries.
- [ ] `--palette`: no unintended collapses; contrast floors (§2.3) met.
- [ ] Texture under live text ≤ 1.15:1, no 1–2 px rhythm.
- [ ] Ornaments in fixed or droppable cells; `sizes.html` clean at 160 px and 900 px.
- [ ] Widgets share silhouette, rim and radius; pressed is inverted, inactive is quieter.
- [ ] The signature silhouette from the brief is intact at 1×.
- [ ] `npm run sim8` output looks like the web preview, give or take a step.
- [ ] Classic captures (if taken) match the simulation.

Attach, or regenerate locally for review: `preview.png` and
`preview-sizes.png` (`npm run capture:authoring`), the `sim8` image, the
contact sheet (`--sheet`) and the palette report (`--palette`).
