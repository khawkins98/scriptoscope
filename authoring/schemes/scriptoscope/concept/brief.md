# Scriptoscope Reference — concept brief

Charcoal enamel, a recessed warm-paper plaque and the site's six-tile mark.
The defining character is the cut-corner silhouette and layered brass edging,
not just the palette. Colour belongs mainly to the mark and progress fill;
functional chrome stays quiet, with upper-left light and darker recessed edges.

## Geometry and defining features

The initial skeleton was revised after measuring the finished concept. Source
measurements and recipes live in `parts/frames.mjs`; utilities use a compact
header allocation rather than squeezing the document layout into small windows.

| Feature | Translation and review |
|---|---|
| Cut outer corners | Binary 4px diagonal chamfer adapts the concept's small stepped notch to the 1× grid; every nested rail follows the cut. No opaque rectangle behind it. |
| Border, outside to inside | Dark outline → pale bevel → enamel separator → brass inlay → broad charcoal rail. Preserve this order at corners, sides and footer. |
| Title and widgets | Recessed ivory plaque, separate 20px bevelled widgets, larger glyphs and generous document gaps; fixed cells keep controls apart on narrow windows. |
| Material | Low-contrast enamel grain, shallow ivory bevels and muted inactive mark. Neutral grain avoids red speckles at 8 bits. |
| Controls | Square push faces, repeating dotted brass default ring, chunky bevelled colour segments, fine neutral slider rail and brass thumb grips. |
| Footer | Sparse 16px tick period and diagonal grow hatch, between fixed chamfered corners. |

The matched scene uses **400×204 content / 416×254 outer pixels**. The selected
concept's front window is cropped at **190,180,1242,762**, approximately 3×;
both images keep their aspect ratios. Review narrow/wide captions independently:
title room comes from `minWidthForTitle`, not an assumed ornament-drop order.

## Concept and translation

Selected image: [concept.png](concept.png); exact generation prompt:
[prompt.txt](prompt.txt). [preview-concept.png](../preview-concept.png) is the
matched live composition. Frames, rules, glyphs and repeat periods are procedural.
The logo alone uses its authoritative site geometry: exact tile order/colours,
21px square, 2px gaps and −8° rotation, sampled to a binary grid. This choice does
not authorize simplifying the rest of the concept.

Deliberate differences: a pixel chamfer replaces the softly rendered corner
notch; native system fonts replace illustrated lettering; scrollbar tracks stay
uniform along their stretched axis rather than imitate painted diagonal texture.
Progress uses a repeatable six-colour period. The comparison scene's slider and
progress are public-renderer specimens; its buttons, checkables and tabs are live.
The ordinary overview includes the interactive native-input slider too.

## Native validation

Browser and 8-bit review establish neither native compatibility nor fidelity.
The exact frozen package and states tested in Kaleidoscope are recorded in
[classic/README.md](../classic/README.md); earlier bytes do not validate this build.
