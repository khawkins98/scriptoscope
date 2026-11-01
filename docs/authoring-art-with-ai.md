# AI-assisted art for authored schemes

Use AI to explore composition or propose constrained pixels. The
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
Kingfisher's [`parts/sprites/`](../authoring/schemes/kingfisher/parts/sprites/)
shows binary-alpha checks and paired state dimensions.

## 2. Text routes in `agy`

A text model can return grid rows and a legend for `Raster.sprite`, or drawing
code. Specify exact dimensions, palette, alpha and glyph role; request structured
output without shell/file tools. Inspect generated code before running it and
review the result at 1×. Check your installed CLI's help for current options;
model names and speed rankings are not part of a reproducible scheme build.

## 3. The image route

Supply the [brief](../authoring/concept-brief-template.md), geometry SVG, target
outer size and title/widget reservations. Ask for a complete composition and
save the selected image and exact prompt under `concept/`.

An image model may invent its own grid, soft edges or painted transparency.
Measure the resulting scale and try extracting the actual illustration before
asking a model to redraw it. `npm run paint-over` is an initial sampling route;
Bonn's [crop recipe](../authoring/schemes/bonn/sprites/README.md) shows explicit
masks and reproducible source-derived palettes. Record crops, sampling, masks,
palette changes and any repairs. Thin rays or glyphs may need final-grid drawing.

Keep alpha binary: values 1–127 have hidden-swatch meaning in the encoder.
Apply hidden colour samples in code after import. Preserve approved crops and
palettes when adding another asset. Compare the rendered window with the concept
crop at equal outer widths, preserving aspect ratios.

## Validation and experiment history

Use the normal [browser, 8-bit and exact-build VM checks](./authoring-a-scheme.md#4-the-workflow).
A valid PNG does not establish fidelity or classic compatibility. Earlier tool
experiments are [archived in git](https://github.com/khawkins98/scriptoscope/tree/0daca6601342a1956189ac770b4bbd391fdebbb6/authoring/experiments);
they are optional research history.
