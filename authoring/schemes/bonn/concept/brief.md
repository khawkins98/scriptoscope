# Bonn — current concept translation

A window on the Rhine in blossom season: recognizable Bonn landmarks rise
from a connected tree line above a sandstone bar, a red ribbon carries the
title, and a broad arch bridge joins the river banks below. Light comes from
the upper left. The original `concept.jpg` remains the composition reference.

## Concept-derived art

The buildings, cherry bough and bridge come from actual pixels of the original
concept. Editable PNGs in `sprites/` replace the procedural reconstructions.
`concept/extract-assets.mjs` records the crops, masks and 3px source-grid
sampling; see [`sprites/README.md`](../sprites/README.md) for reproduction.

| Asset | Source crop x,y,w,h | Native PNG |
|---|---|---|
| Minster |459,27,123,234 |41×78 |
| Rathaus |618,117,162,144 |54×48 |
| Post Tower |822,66,75,195 |25×65 |
| Cherry bough |168,165,231,96 |77×32 |
| Bridge |438,633,231,75 |77×25 |

Cleanup removes the background and consolidates JPEG noise into source-derived
palettes. Interiors, window clusters, roof forms, blossom clusters and bridge
stonework are retained. The first four approved PNGs stay unchanged when the
bridge is extracted; it has its own 32-colour palette. The bridge opening is
transparent so the frame's river shows through. Langer Eugen is absent from
the concept, so it is omitted from this composition; Beethoven stays in About.

Each sprite fits its cell with a uniform nearest-neighbor scale. The bridge
fits the 120px cell as 120×39px inside the 40px river band. No extra arch
outline or masonry is painted over it. Assets remain separate from layout.

## Geometry and title budget

| Part | Current dimensions / behavior |
|---|---|
| Document source | 302×206px; 62,212-byte 8bpp colour plane |
| Top | 110px skyline plus 34px bar |
| Sides / bottom | 22px sandstone piers / 40px Rhine band |
| Bridge | One centred 120px arch |
| Corners | 72px left bough / 58px right towers |
| Landmark caps | Code 6; move/drop with the title |
| Canopy growers and plate | Compact 12px periods; only sky rows vary in the tiled plate |
| Title | 266px fixed budget; 158px available at 424px outer width; a 145px title fits from 411px |

Narrow windows shorten the title and eventually lose the title/landmark caps,
while the fixed blossom and tower corners remain. Verify the actual narrow
and wide renders rather than treating the concept as a removal-order rule.
The ribbon extends 12px into each title cap, leaving 6px of breathing room
beside the text after the notch and hem, without changing the document's
title-width budget.

## Custom window buttons

All three medallions are 26×26px with binary masks and whole-pixel detail:
cherry rose for close, city-inspired shield for zoom, Rhine wave for collapse.
The close box sits under the bough's right end; zoom and collapse sit below
the right towers. Their `wnd#` rectangles, rather than an OS-standard button
size or offset, define placement.

The document pressed strip is 78×26px; the utility strip is 26×26px. Each
circular hit mask has 484 opaque pixels. Utility close uses the same size for
compatibility with the current web document-strip path. Pressed states reverse
the bevel and darken the motifs; inactive states retain the detail in grey.

## Review and native compatibility

Compare crop `168,27,780,681` of the original concept with the full browser
scene at the same outer width. The standard content sample is 380×210px,
producing 424×394px outer chrome in this revision. Inspect each landmark at
1× and 4×, then the whole active/inactive, narrow/wide and 8-bit scenes.

Bonn's earlier large source template failed in native Kaleidoscope; compacting
its canopy repeat preserved the visible dimensions and loaded successfully.
This revision keeps the source plane within that observed passing envelope,
which is a cautious design choice rather than proof of an internal size limit.
Exact tested hashes, native outcomes and captures belong in
[`classic/README.md`](../classic/README.md). Each subsequent art/rectangle change
requires validation of its own final bytes.
