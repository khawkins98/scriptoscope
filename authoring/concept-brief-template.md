# <Scheme name> — concept brief

Copy to `authoring/schemes/<slug>/concept/brief.md` from the repository root. Record design decisions here; keep
build hashes and tested native states in `classic/README.md`. Adjust relative
links for the destination folder.

## Art direction

- One-sentence idea and defining silhouette:
- Recognizable details that must survive at 1×:
- Materials, light direction and active/inactive palette roles:
- Quiet areas reserved for title, widgets and live text:
- Selected image and saved prompt:

## Geometry before illustration

Build a skeleton and generate its geometry sheet:
`node scripts/authoring-concept.mjs <scheme-dir> --out /tmp/geometry.html`.
The SVG describes source cells, not the expanded window. Match the concept's
relative header, ornament, title and control sizes. Measure the finished concept
and revise the initial skeleton; inherited compact dimensions are not binding.

| Feature | Fixed / growing / title-cap behavior | Source size | Narrow-window outcome |
|---|---|---|---|
| Signature ornament | | | |
| Title and caps | | | |
| Material repeat | | period: | |
| Close / zoom / collapse | fixed | | |

- Target content and outer dimensions:
- Representative title width and `minWidthForTitle` result:
- Actual narrow/wide behavior (do not assume ornaments drop before titles):

## Concept and translation

Try extracting distinctive illustration pixels before reconstructing them.
Keep approved crops and palettes stable while adding assets.

Record a small inventory of defining features before implementation. For an
adaptation, state the design reason or evidenced runtime limitation; code
simplicity and successful builds are not fidelity evidence. Using original
geometric logo artwork does not authorize simplifying other concept details.

| Defining feature | Measured geometry / layer order | Preserve or adapt; reason | Live comparison result |
|---|---|---|---|
| Outer mask and corner cuts | | | |
| Border rails and inlays, outside to inside | | | |
| Material shading and highlights | | | |
| Controls: sizes, depth and gaps | | | |

- Full-window concept crop (`x,y,width,height`) and measured grid scale:
- Editable PNGs, paired state dimensions and source-derived palettes:
- Reproducible crop/sampling/mask recipe and final-grid repairs:
- Procedural surfaces, glyphs and repeating periods:
- Deliberate departures and their reasons:

Compare concept and live scene at equal outer widths without changing aspect
ratios. Review silhouette, composition, materials and texture at 1×, narrow/wide
and 8 bits; inspect each inventory entry, including enlarged corner/border detail.
Matching width and broad palette alone is insufficient. Use behavioral tests for title room and complete ornaments rather
than locking incidental illustration dimensions.

## Native validation

Probe unfamiliar geometry early. Complete classic extras, freeze `.rsrc` and
`.bin`, then record exact hashes and states actually tested in `classic/README.md`.
A later art edit needs validation of the new bytes. Follow the
[transfer and capture rules](../docs/authoring-a-scheme.md#48-test-in-real-kaleidoscope).
