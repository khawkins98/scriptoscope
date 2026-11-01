# <Scheme name> — concept brief

Copy this to `schemes/<slug>/concept/brief.md`. Keep the original target and
later implementation decisions distinct; replace placeholders with measurements.

## Art direction

- One-sentence idea:
- Signature silhouette that must survive at 1× and narrow widths:
- Distinctive details that must remain recognizable, with a pixel budget for each:
- Materials and light direction:
- Active/inactive palette roles (exact colours; check with `author --palette`):
- What stays quiet so the title and live content remain readable:

## Geometry before illustration

Build a skeleton frame, then generate its geometry sheet with
`node scripts/authoring-concept.mjs <scheme-dir> --out /tmp/geometry.html`.
The SVG describes source-art cells, not the final expanded window.

| Feature | Cell / behavior | Source size | Narrow-window decision |
|---|---|---|---|
| Signature ornament | fixed / droppable / title cap | | |
| Title | plate and caps | | required room for a representative title |
| Material repeat | growing / tiled | repeat period | |
| Close / zoom / collapse | fixed cells | | |

Record the target content size, outer size, title-width budget and the width
at which the actual built recipe loses the title or an ornament. Revise the
layout or concept before detailed painting if these constraints conflict.
The skeleton is provisional. Measure the concept's relative header, ornament,
title and control sizes; changing geometry is preferable to keeping the right
motifs at the wrong scale.

Consider irregular silhouettes, connected landmark groups, multi-pixel material
tiles, title-cap art and a distinct bottom edge when the concept calls for
them. Use the supported recipe behavior deliberately; adding every capability
is not a goal by itself.

## Concept and translation

Try extracting distinctive illustrations from the selected concept before
reconstructing them. Keep approved crops stable when adding another asset;
record any palette change that affects existing art.

- Chosen image and saved prompt:
- Measured image scale and full-window crop (`x,y,width,height`):
- Editable PNG illustrations, paired state sizes and palette:
- Extraction crop/grid/mask recipe; repairs that cannot be recovered from the source:
- Procedural surfaces/glyphs:
- Deliberate departures from the concept and their reasons:

Compare one rendered document with that crop at the same displayed outer
width, preserving both aspect ratios. Judge silhouette, composition, material
and texture separately. Inspect 1×, narrow and wide views before adding detail.

## Review record

| Revision / change | Browser and 8-bit observations | Decision |
|---|---|---|
| | | |

Keep useful behavioral tests (whole ornaments, title room, matched widget
strips), rather than locking every incidental source dimension. Shared scheme
tests already cover build/load, committed bytes, packaging and common assets.

## Classic VM result

Complete the classic extras before freezing files. Record exact `.rsrc` and
`.bin` hashes, VM condition and checks actually performed in `classic/README.md`.
An art edit after a capture needs a new VM result for the new bytes. Follow
`docs/authoring-a-scheme.md` §4.8 for transfer, capture and stopped-disk rules.
