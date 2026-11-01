# AI-assisted art for authored schemes

Use AI for concept exploration and exact-size sprite proposals. The
[authoring workflow](./authoring-a-scheme.md#4-the-workflow) owns the process;
this page describes the available art routes. Tool observations below are
from the first-party experiments in October 2026, not current service guarantees.

Choose the output before choosing a tool:

| Need | Output | Route |
|---|---|---|
| Composition, silhouette and materials | concept mockup | image model, constrained by the geometry sheet |
| Detailed final illustration | transparent 1× PNG | extract the selected concept, then repair unrecoverable detail |
| Small exact glyph or control | short grid or drawing code | text model using the palette and `Raster` API |
| Repeating stone, plastic, bevels | procedural pixels | existing scheme painters |

A general image model's picture of pixel art is not a final sprite. It may
invent its own grid, painted transparency and soft outlines. Keep alpha
binary, check the palette, and apply hidden swatches after import in code.

## 1. claude-pxl

[claude-pxl](https://github.com/crsolver/claude-pxl) produced exact-size PNGs
from palette/grid/shape code in the original experiments. Read third-party
code before running it. A local checkout can render and inspect a sprite:

```sh
node /path/to/claude-pxl/bin/pxl.js build my-sprites.px.js
node /path/to/claude-pxl/bin/pxl.js ascii my-sprites.px.js checkbox_on
```

Import the 1× output through `decodePng` → `Raster.fromRgba`. For decorative
illustrations, keep the PNG as the editable source rather than converting a
large image into hundreds of character-grid rows. Kingfisher's `parts/sprites/`
shows PNG loading, binary-alpha checks and matched active/inactive sizes.

## 2. Text routes in `agy`

The existing signed-in CLI was used for grids and `Raster` drawing code.
Check the installed CLI's help for available models and options. Save the
prompt and resulting source; model names and speed rankings are not part of
the scheme's build contract.

A small grid brief should specify dimensions, palette, alpha and glyph role.
Request structured output so the model needs no shell/file tools:

```sh
agy -p 'Return a 13x13 checked checkbox as rows and a palette legend. Do not use tools.' \
  --json-schema sprite-schema.json --output-format json > sprite-response.json
```

Example schema:

```json
{"type":"object","properties":{"rows":{"type":"array","items":{"type":"string"}},"legend":{"type":"object","additionalProperties":{"type":"string"}}},"required":["rows","legend"]}
```

Inspect the response before running generated drawing code. For a grid, use
`Raster.sprite(x, y, rows, legend)` and check at 1×; an enlarged grid preview
can make good borders appear broken or obscure alignment errors.

## 3. The image route

Supply the [brief template](../authoring/concept-brief-template.md), the actual
geometry SVG, a target outer size, title/widget reservations and a small
palette. Ask for the whole window's composition, not isolated themed widgets.
Save the selected concept and its exact prompt under `concept/`.

In the original `agy` runs:

- Image jobs were slow and overlapping jobs sometimes cancelled. Run one at
  a time and use a suitable print timeout for that installed CLI.
- Output was JPEG at the model's own scale, sometimes with a painted
  checkerboard. Requests for exact pixel dimensions or transparency were not
  reliable.
- The reported output path could differ from the requested path; inspect the
  returned result rather than assuming a file was written.

Measure the resulting grid scale and try extracting the actual illustration
before asking a model to reconstruct it. Record crop coordinates, grid
sampling, background masks and palette changes; preserve proportions and
intentional outlines. Use `npm run paint-over` for an initial extraction, or
follow Bonn's [reproducible crop recipe](../authoring/schemes/bonn/sprites/README.md)
when the source needs explicit masks. Keep the resulting PNGs as editable
assets and keep placement and repetition in code. Repair detail extraction
cannot recover; thin rays, stars and glyphs may need drawing on the final grid.
Compare the rendered window with its concept crop at the same outer width,
keeping aspect ratios intact. Reject a pass that loses the defining shape
or material even when all structural checks pass.

## Validation and experiment history

Use the regular build, browser, 8-bit and exact-build VM checks from the
[workflow](./authoring-a-scheme.md#4-the-workflow). An art tool's valid PNG or
a clean authoring report does not establish visual quality or classic compatibility.

Historical comparison grids, model timings and unsuccessful image-cleanup
experiments are retained in [PR #540's experiment commit](https://github.com/khawkins98/scriptoscope/tree/0daca6601342a1956189ac770b4bbd391fdebbb6/authoring/experiments).
They are research history, not additional required tools or steps. No external
pixel-art service or new API key is required to build the schemes.
