# AI-assisted art for authored schemes

Use this optional tool-selection reference to choose an output for an authoring task. AI can explore composition or propose constrained pixels. The
[authoring workflow](./authoring-a-scheme.md#4-the-workflow) owns build and
validation; no external art service is required to build the examples.

| Need | Useful output |
|---|---|
| Overall silhouette, composition and materials | Whole-window concept using the geometry sheet and brief |
| Distinctive final illustration | Extracted transparent 1× PNG, with limited repairs |
| Small glyph or control | Exact-size grid with palette legend, or `Raster` drawing code |
| Repeating masonry, plastic or bevels | Procedural pixels using existing scheme painters |

## 1. claude-pxl

[claude-pxl](https://github.com/crsolver/claude-pxl) is an optional code-to-PNG
route for exact-size sprites. Review third-party code before running it:

```sh
node /path/to/claude-pxl/bin/pxl.js build my-sprites.px.js
node /path/to/claude-pxl/bin/pxl.js ascii my-sprites.px.js checkbox_on
```

Import through `decodePng` → `Raster.fromRgba`. Keep large illustrations as
editable PNGs instead of translating them into hundreds of character-grid rows.
Keep active/inactive dimensions matched and reject partial alpha on import.

## 2. Text routes in `agy`

A text model can return grid rows and a legend for `Raster.sprite`, or drawing
code. Specify exact dimensions, palette, alpha and glyph role; request structured
output without shell/file tools. Inspect generated code before running it and
review the result at 1×. Check your installed CLI's help for current options;
model names and speed rankings are not part of a reproducible scheme build.

## 3. The image route

Supply the [brief](../authoring/concept-brief-template.md), geometry SVG, target
outer size and title/widget reservations. Save the selected composition and
exact prompt under `concept/`.

Models can invent a grid, soft edges or painted transparency. Measure the scale
and extract distinctive illustration before redrawing it. The
[paint-over workflow](./authoring-a-scheme.md#43-paint-over-the-concept) gives the
sampling command; the brief records crop, scale, masks, palette and repairs.
Use explicit masks/source-derived palettes when voting loses important detail.
Keep approved assets stable when adding unrelated ones.

Use original source geometry for an existing brand mark, rather than a generated
approximation. Keep imported alpha at 0/255: values 1–127 mean hidden swatches
to the encoder. Apply actual hidden samples after import. Compare concept/live
art at equal outer widths, preserving aspect ratios; see the
[visual checklist](./authoring-visual-design.md#4-review-checklist).

## Validation and experiment history

Use the normal [browser, 8-bit and exact-build VM checks](./authoring-a-scheme.md#4-the-workflow).
A valid PNG does not establish fidelity or classic compatibility. Earlier tool
experiments are [archived in git](https://github.com/khawkins98/scriptoscope/tree/0daca6601342a1956189ac770b4bbd391fdebbb6/authoring/experiments);
they are optional research history.
