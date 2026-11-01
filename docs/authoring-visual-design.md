# Visual design for authored schemes

Use this reference while following the [authoring workflow](./authoring-a-scheme.md#4-the-workflow).
The [geometry reference](./authoring-exotic-frames.md) explains the recipe rules;
the [main guide](./authoring-a-scheme.md#3-five-ideas-you-need) explains masks,
colour storage and palettes.

## 1. What separates a good scheme

Judge the complete window at 1×: silhouette, proportions, materials and readable
live text. A valid resource fork can still have the wrong composition. Preserve
the concept's defining shapes before adding texture, and compare at the same
outer width so an undersized ornament cannot hide behind screenshot scaling.

## 2. Pixel-UI guidance for this format

### 2.1 One light, from the top left

Choose one light direction for frame bevels, ornaments and controls. Upper-left
light fits Macintosh chrome: top/left edges are lit, bottom/right edges shaded.
A crisp highlight row describes form; a broad gradient describes material.
Use both deliberately rather than shading every surface independently.

### 2.2 Outlines and highlights

Outline the silhouette and important boundaries: title plate, widgets and content
hole. Outlining every brick, leaf or stone produces a wire grid. Use a dark of
the material, such as navy for blue glass, rather than defaulting to black.

Keep glyphs on whole pixels with `Raster.sprite`. A smooth stroke narrower than
2 px can become a grey smear; reserve smooth drawing for wider forms against a
known matte. The outer mask is binary, so rounded silhouettes need intentional
pixel stairs. Within a texture, selective highlights often read better than
lighting every element equally.

### 2.3 Palette construction

For procedural controls and surfaces, start with short, clearly separated material
ramps. Hue-shift shadows and highlights consistently, and prefer system-palette
entries where they preserve the intended material. Warm near-greys can snap to
pink; inspect the 8-bit simulation instead of assuming a subtle ramp survives.

Extracted illustrations may retain source-derived palettes. Every compiled
`cicn` still has a 256-colour budget. Excessive blending can spend that budget
on rare edge colours and force `fitPalette` to merge deliberate highlights.
Keep approved illustration palettes stable when adding unrelated assets.
Neither system entries nor a clean simulation guarantee identical native colour.

Use these contrast targets for the displayed colours:

| Pair | Target |
|---|---|
| Active title or button label on its face | 4.5:1 |
| Inactive title on its plate | 3:1, preferably 4.5:1 |
| Widget glyph on its face | 3:1 |
| Frame outline against body and white | 3:1 |

`author --palette` reports declared contrast pairs and palette collapses.
Bitmap titles have thin strokes: inspect them at 1× as well as reading ratios.

### 2.4 Texture and live text

Keep the body quieter than the frame. A useful target for texture beneath text
is ≤1.15:1 between lightest and darkest pixels, without a strong 1–2 px rhythm
that competes with letter stems. Give frame and content a clear value boundary.

The web can tile a scheme pattern behind content; ordinary classic application
windows own their body drawing. Dialog colour tables are another path. See
[body textures](./authoring-exotic-frames.md#4-window-body-textures-r21r23)
before treating a browser background as native evidence.

### 2.5 Ornaments, tiling and size

Design ornaments in fixed or droppable cells (codes 1/10), or title caps (6)
when they belong beside the title. Keep repeating material separate. The lint
checks declared uniform regions and recipe bounds; it cannot recognize an
illustration accidentally painted into an unrestricted tile.

Every fixed pixel on a titled edge reduces title room. Code 10 is not a promise
that an ornament disappears before the title: inspect
`layout.minWidthForTitle(px)` and the actual narrow render
([cell rules](./authoring-exotic-frames.md#1-cell-codes-rules-r1r12)).

Place repeat boundaries in quiet gaps. A tiny highlight repeated across a
900 px bar becomes a dotted line, and dither can become stripes. Review both
narrow and wide windows after changing a tile. Keep source repeats compact and
probe unfamiliar geometry in classic early; a successful compact source does
not establish a universal native size limit.

### 2.6 Widget families and states

Window-button rectangles are authored, with no fixed 14 px limit. Budget larger
badges alongside title and ornaments, and update normal masks, pressed strips
and utility resources together. Follow the
[pressed-widget rules](./authoring-exotic-frames.md#5-pressed-widgets-r24).

Use a coherent rim, lighting and glyph grammar across window buttons and other
controls. Keep functional glyphs recognizable. Pressed must read immediately;
inversion, a sunk bevel or a clear fill change works better than a barely darker
copy. Inactive should preserve the object's form while reducing emphasis.
Avoid turning every hue into the same grey mud or making scroll arrows louder
than the title.

### 2.7 Avoiding the generated look

Prefer deliberate clusters, material planes and empty space over scattered
speckles. Whole-pixel glyphs and consistent rims help the scheme read as one
system. Surface detail should support the silhouette, not substitute for it.

## 3. Designing from a concept

Record the selected image, prompt and measurements in the
[brief](../authoring/concept-brief-template.md). Measure relative header,
ornament, title and control sizes against the complete window. Change geometry
when necessary to preserve the composition.

Try extracting distinctive illustration pixels before reconstructing them.
Preserve proportions, shading and character; record crop, sampling, masks,
palette choices and repairs. Bonn's [extraction recipe](../authoring/schemes/bonn/sprites/README.md)
provides a reproducible example. Keep placement and repeats in code.

Use a matched-width comparison with both aspect ratios intact. Judge silhouette,
composition, material and texture separately. Keep essential identity in the bar
rows too: native menu bars may cover art above a window near the screen top.

## 4. Review checklist

Save a before capture when improving an existing scheme. Useful diagnoses:

| Symptom | Correction to try |
|---|---|
| Stone reads as a wire grid | Quiet larger faces; fewer bright internal joints |
| Skyline reads as disconnected icons | A low connecting mass within the recipe's fixed/title-cap/growing cells |
| Fireworks read as confetti | Coherent ray directions, curved trails and deliberate dark gaps |
| Glass reads as a flat panel | Broad reflections and value transitions that survive palette fitting |
| Controls look unrelated | Shared spacing, rim and lighting across the complete control family |

Before review, check:

- Signature silhouette, material and relative scale survive at 1×.
- Title, widget glyphs and live content remain readable in active/inactive states.
- Normal and pressed widgets align; narrow/wide windows have deliberate outcomes.
- Repeats join cleanly; palette fitting and `sim8` preserve defining details.
- Concept comparison uses equal outer widths without stretching either image.
- Final previews and native observations identify the built bytes actually tested.

Use the [workflow](./authoring-a-scheme.md#4-the-workflow) for commands and
capture requirements. Keep tests for reusable geometry and resource behavior;
visual review should not require snapshots of every incidental illustration.
