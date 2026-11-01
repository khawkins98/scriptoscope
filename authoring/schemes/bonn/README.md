# Bonn

A first-party Kaleidoscope scheme inspired by the city of Bonn: sandstone
piers, the Rhine under an arched bridge, and a skyline of the Minster, the
Altes Rathaus and the Post Tower, joined by riverside trees and a sweeping
cherry bough. The landmarks, cherry bough and bridge use concept-extracted PNGs in `sprites/`.

**Not an official theme.** Scriptoscope and this scheme have no connection to
the City of Bonn or any of the institutions whose buildings appear in it. The
shield used for the zoom box is a stylised pixel emblem inspired by the city's
arms, not a reproduction of them, and the buildings are original pixel art,
not traced from photographs.

Build and preview: `npm run author -- authoring/schemes/bonn`, then see
[`docs/authoring-a-scheme.md`](../../../docs/authoring-a-scheme.md).
Screenshots from real Kaleidoscope are in [`classic/`](./classic/).

The current frame has a 110px skyline above a 34px bar, 22px sandstone piers
and a 40px Rhine band with one 120px bridge. The actual concept's
window clusters, roof shapes, blossom branch and bridge masonry are preserved
through crops and masks, then fitted proportionally into the frame.
Compact 12px canopy tiles connect the skyline without repeating buildings.

The 26px rose/shield/wave window buttons use custom scheme-defined rectangles:
close below the bough, zoom/collapse below the towers, with matching pressed
hit masks and a same-size utility close. The 266px fixed title budget leaves
158px for text at 424px outer width. Narrow windows eventually drop the title
and landmark caps while retaining the fixed corners.

The original concept remains unchanged. The latest comparison is documented
in [`concept/brief.md`](./concept/brief.md); `preview.png` and
`preview-sizes.png` show the current browser build. Historical classic shots
must be matched to their recorded binary hashes before treating them as
verification of this revision.
