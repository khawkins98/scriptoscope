# Castle — concept brief

## 1. Art direction

The window is a stone keep; its title is a red banner hung from the wall.
Round towers, conical tiled roofs and pennants establish the silhouette above
a crenellated wall. Grey ashlar stays broad and quiet, with selective highlights
and upper-left light. Red cloth, gold fringe, oak and iron provide accents;
the content is pale parchment.

## 2. Chosen target

[`concept.jpg`](./concept.jpg), selected as `concept-1c`, supplies the tower
scale, banner, barrel thumb, portcullis corner and moat plinth. Its extra grey
title bar is deliberately omitted: the banner is the only title plate.
Soft tower shadows and gradients become bounded, whole-pixel material shapes.
The saved prompt remains in this folder.

## 3. Build translation

[`frames.mjs`](../frames.mjs) owns cell lists, ornament dimensions and title
reservations; [`palette.mjs`](../palette.mjs) owns the ramps. Towers occupy fixed
cells, merlons use whole repeats with quiet filler, and banner caps move with the
title. Side walls and the plinth have independent recipes.

Keep mortar subordinate to stone faces; avoid outlining every block or adding
speckles. Check the repeated coping across a wide frame and the surviving towers
and banner at narrow widths. Oak buttons, iron-bound checks, barrel thumbs and
red/gold progress should read as parts of the same keep.

## 4. Signature details the implementer must not lose

- Towers and pennants rising clearly above the crenellated wall.
- One red banner title with gold fringe and legible shadowed text.
- Broad stone planes, quiet joints and restrained highlights.
- Portcullis corner, barrel thumb and arrow slits spaced by the side recipe.

Use the [workflow](../../../../docs/authoring-a-scheme.md#4-the-workflow) for
matched-scale, 8-bit and native review. Exact tested builds and states live in
[`classic/README.md`](../classic/README.md).
