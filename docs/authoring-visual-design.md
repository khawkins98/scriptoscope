# Visual design for authored schemes

*A reference for making a scheme look good, not just load. The workflow
(brief, concept, extraction, build, preview, 8-bit and native checks) is in
[`authoring-a-scheme.md`](./authoring-a-scheme.md) §4, and the engine
mechanics this doc assumes (masks, the 256-colour budget, hidden swatches,
gamma, dithering) are in its §3. Nothing here asks the format for something
it can't do.*

## 1. What separates a good scheme

Structural correctness does not establish visual quality. Review silhouette,
material, lighting and live-text readability at 1×, then at narrow and wide
sizes. Common failures are excessive internal edges, thin antialiased glyphs
and ramps that collapse or shift at 8 bpp. The
[workflow](./authoring-a-scheme.md#4-the-workflow) covers how to build and test;
these are the visual decisions to make during that process.

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

- Before generating the concept, use the [geometry reference and matched-width
  review](./authoring-a-scheme.md#42-make-the-concept-image). Give the artist the
  actual fixed/growing cells and reserved title/widget rectangles. Review one
  rendered window beside the matching concept crop at the same outer width;
  keep aspect ratios intact so a compressed silhouette or an oversized band
  cannot hide behind a different screenshot scale.
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
- **Small windows subtract.** Measure what each actual recipe loses as it
  narrows; there is no universal removal order. Make sure the surviving
  silhouette is deliberate and record when the title stops fitting.

### 2.6 Widget families and states

- **Use the available space deliberately.** Window-button rectangles are
  scheme-defined. A larger detailed badge can sit at a different offset
  inside a fixed frame cell; it does not have to remain a tiny standard
  corner button. Budget its footprint alongside the title and ornaments,
  and rebuild/verify the pressed mask rather than enlarging only the picture.
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

Use whole-pixel glyphs, short material ramps and deliberate clusters. Avoid
outlining every internal surface or scattering pseudo-random speckles.
The symptom table in the [review checklist](#4-review-checklist) identifies
concrete corrections; the preceding sections explain their geometry and palette
constraints. Repeated stylistic rules are not additional build gates.

## 3. Designing from a concept

Use the [brief template](../authoring/concept-brief-template.md) to record
these decisions:

- Name the one memorable silhouette and the material reference.
- Measure band/ornament sizes and title space instead of asking for “larger”
  or “more ornate.” Check the expanded window, not only the source template.
- Preserve recognizable silhouettes before adding texture; an elaborate
  surface cannot rescue the wrong proportions.
- Preserve identity details from the actual concept. Try extracting its
  pixel clusters before reconstructing a landmark, blossom or bridge in code.
  Compare the crop and extracted PNG at the same size; retain proportions,
  shading and character. Redraw only details extraction cannot recover, and
  distinguish those repairs from source pixels. Bonn's concept-derived PNGs
  replaced recognizable subjects whose procedural versions still felt wrong.
- Keep the essential look in the bar rows. Art above a title bar may disappear
  under the classic menu bar ([R16](./authoring-exotic-frames.md#2-art-outside-the-body--irregular-silhouettes-r13r19)).
- Use low-chroma bodies and test palette snapping; subtle warm grey can turn
  pink at 8 bpp.
- A code-5 plate can carry a small repeat above/below the text. Mark it
  `tiled: true` and lint the title rows; accept a partial repeat at the end.

## 4. Review checklist

For an existing scheme, save a before capture and change one visual problem
at a time. Keep the signature silhouette and behavior while changing its
surroundings. Useful diagnoses from the first-party reviews:

| Symptom | Check first | Prefer |
|---|---|---|
| Castle-like stone reads as a wire grid | joint and highlight contrast at 1× | larger quiet faces and fewer bright internal edges |
| Brick-like controls look unrelated to the frame | the full repeated stud row at short and long widths | the same stud spacing and light direction across controls |
| A skyline reads as disconnected icons | gaps between silhouettes at the final expanded width | a low connecting mass that respects fixed/title-cap/growing cells |
| Fireworks read as confetti | whether ray directions and empty space survive at 1× | coherent warm rays and deliberate dark gaps, with the year kept legible |
| Frosted glass becomes a flat panel | broad reflections, value transitions and palette limits | preserve the material's defining light; do not equate desaturation with depth |

Check the whole window again after changing a local motif. Repeating a better
tile 70 times can still make a worse surface. Use before/after and concept
comparisons as visual decisions, not as a reason to add pixel snapshots for
every illustration. Keep tests for the reusable geometry and resource rules.

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
- [ ] A matched-width concept comparison preserves aspect ratios; deliberate departures are recorded.
- [ ] `npm run sim8` output looks like the web preview, give or take a step.
- [ ] Classic extras are included before the final VM build is frozen.
- [ ] VM observations identify exact `.rsrc`/`.bin` hashes and tested states; later edits are not labelled as already tested.

Attach, or regenerate locally for review: `preview.png` and
`preview-sizes.png` (`npm run capture:authoring`), the `sim8` image, the
contact sheet (`--sheet`) and the palette report (`--palette`).
