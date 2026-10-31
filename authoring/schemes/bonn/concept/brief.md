# Bonn — concept brief (phase 1, art direction)

## 1. Art direction

**Big idea: a window on the Rhine, with the Bonn skyline standing on the title bar
in blossom season.** The current scheme has the best palette of the four and a good
pennant; what it lacks is scale and legibility. The target makes the skyline a bold,
flat, outlined silhouette group that rises above the bar as free-standing art (the
Minster with its tall spire and four flanking towers, the pink baroque Old Town
Hall with the outside stair, the slim glass Post Tower at the right), a cherry
branch with blossom clusters along the top-left, sandstone piers with visible
ashlar down both sides, and a Rhine band at the bottom with a stone arch bridge in
the middle as the one fixed bottom ornament. The title stays a red pennant with
cream text; widgets are three matching sandstone discs.

**Materials.** Warm sandstone (flat `#ffcc99` with 1 px `#ffffcc` lit top and
`#cc9966` shade, `#996633` mortar); slate-teal building silhouettes with flat
lighter roof edges and yellow 1×2 windows on a 3 px rhythm; pink plaster for the
Town Hall; two flat teals for the water with white foam dashes; pink blossom as
5 px five-pixel rosettes on a brown branch.

**Palette (EXACT cube entries):**

| Role | Hex |
|---|---|
| sandstone face / lit / shade / mortar | `#ffcc99` / `#ffffcc` / `#cc9966` / `#996633` |
| outline | `#663333` |
| body | `#ffffff` plain, with a 1 px `#ffcc99` inset line (no dot pattern behind text) |
| city red / red shade | `#cc0000` / `#990000` |
| city yellow | `#ffcc00` |
| pennant text | `#ffffcc` with 1 px `#660000` shadow |
| skyline mass / roof lit edge | `#336666` / `#669999` |
| skyline windows | `#ffcc00` (1 × 2 blocks) |
| Town Hall plaster / shade / white trim | `#ffcccc` / `#cc9999` / `#ffffff` |
| Post Tower glass / glass lit | `#6699cc` / `#99ccff` |
| Rhine upper / lower band | `#339999` / `#336666` |
| foam | `#ffffff` |
| blossom / blossom shade / branch | `#ff99cc` / `#cc6699` / `#663300` |
| inactive: stone `#cccccc`/`#eeeeee`, skyline `#999999`, pennant `#999999`, title `#333333` | |

Light from the upper-left: lit top rows on every stone part, the bridge arch and
the discs; the right pier gets a 1 px `#cc9966` column; roofs lit on the left slope.

## 2. Chosen target

**`concept-1b`**, committed as `concept.jpg` (the other runs were not kept). Its skyline stands *on* the
bar as a silhouette group that breaks the rectangle (the Animals way), the bridge
arch cuts into the water band, the side piers are real ashlar, the pennant is the
title, and the widgets are a matching disc family. `concept-1c` (the framed "view"
with a dark sky) is a strong alternative but its opaque 40 px band would be mostly
hidden under the classic menu bar and takes too much height; `concept-1a` splits the
title bar in two.

Ignore in 1b: the tall Minster spire (must be capped, see below), the drop shadow
behind the skyline, the shield-like zoom badge (keep a plain red/yellow halved
disc, no coat of arms), the "INACTIVE document" title text.

## 3. Build translation

Document template about **200 × 100**, content rect
`A = (left 8, top 46, right 192, bottom 82)`.

**Top band, 46 rows.** Rows 0–23 above the bar: transparent except the skyline and
blossom branch (so the cap is **24 px above the bar**, as R16 advises: the classic
menu bar hides anything above the bar on a top-of-screen window, so the Minster
spire is the first thing to go; design the group so it still reads with the top
10 rows cut). Rows 24–45: the sandstone bar, 22 px, with a 1 px `#ffffcc` lit row,
the pennant hanging in its middle rows, 1 px `#ffcc00` over 1 px `#cc0000` rule at
the bottom, then `#663333` line.

- Cell 1, **code 1, 24 px, full height**: left corner stone with the **close disc**
  (14 px) in the bar; above it the start of the cherry branch (brown, 2 px) with a
  7 px blossom cluster.
- Cell 2, **code 8, 12 px**: blossom tile: bar + branch (2 px brown at row 20–21,
  a 5 px rosette every tile alternating above/below the branch). Tiles from the near
  end so the branch continues from the corner.
- Cell 3, **code 6 bezel, 6 px**: pennant's left swallow-tail notch.
- Cell 4, **code 5 plate, 1 px**: `#cc0000` cloth with `#ffcc00` top row and
  `#990000` bottom row.
- Cell 5, **code 6 bezel, 6 px**: pennant's right point.
- Cell 6, **code 8, 1 px**: plain bar.
- Cell 7, **code 10, 72 px** (dropped on narrow windows before the title is, R6):
  the **skyline group** above the bar: Minster (28 px wide, spire to row 0, four
  flanking towers to row 10, nave to row 14, 1×2 yellow windows on a 3 px rhythm,
  `#669999` lit roof edges), Town Hall (26 px, pink, 3 floors of white 1×2
  windows, grey mansard, a small stair at the base), Post Tower (12 px, `#6699cc`
  with `#99ccff` 1 px floor lines every 4 rows, rising to row 2). Everything is
  one connected silhouette with a `#663333` 1 px outline and a 3 px dark
  `#336666` tree line linking the bases on the bar's top edge.
- Cell 8, **code 8, 1 px**: plain bar.
- Cell 9, **code 1, 36 px, full height**: right corner stone with the **zoom** and
  **collapse** discs, 1 px gap.

Fixed top width = 24 + 6 + 6 + 72 + 36 = **144 px**. The skyline drops (code 10)
below the fixed sum, so from ~150 px the title still shows (whole 90 px title from
about 240 px). If a smaller `minWidthForTitle` is wanted, narrow the skyline to
56 px by dropping the Town Hall's stair wing. Titled-utility template: branch only,
no skyline, 16 px bar.

**Bottom band, 18 rows:** rows 0–3 embankment (`#ffcc99` with `#ffffcc` lit row and
`#996633` kerb line), rows 4–15 water: `#339999` 6 rows over `#336666` 6 rows with
1 px white foam dashes (4 px long, 12 px pitch, offset between bands), rows 16–17
`#663333` outline + `#336666`. Recipe: `1@14 (left pier foot) | 11 (12 px water
period) | fixed 32 px bridge: a sandstone arch spanning rows 0–13 with a `#336666`
semicircular opening (1-2-3 stair) and water showing through it, lit `#ffffcc`
top row | 8 | 1@22 (right pier foot + grow box: a sandstone mooring bollard, 14 px,
round top on a 1-2-1 stair, rope ring in `#996633`)`. Keep the scalloped `waveEdge`
on the kerb if it survives at 1×; otherwise a straight kerb.

**Side bands, 8 px:** `#663333` outline, a 6 px sandstone pier with 10 px blocks
(`#ffcc99` face, `#ffffcc` top row of each block, `#996633` mortar) and a 1 px
`#cc9966` inner shade line; one code-8 grower holding a 20 px period (two
offset blocks).

**Drop from the concept:** the sky gradient behind the skyline (transparent),
shadows under the buildings, the dithered water gradient (two flat bands, as the
design review already says), the vertical scroll bar drawn inside the content, the
soft shield badge.

**Widgets (14 × 14 sandstone discs, identical rim):** `#663333` 1-2-1 stair rim,
`#ffcc99` face, `#ffffcc` top-left arc. Close = 5 px pink rosette (`#ff99cc` four
pixels around a `#cc6699` centre); zoom = disc halved red over yellow with a 3 × 3
`#ffffcc` square (plain, no heraldry); collapse = 7 px teal wave on whole pixels
(`#339999` 2-row zigzag). Pressed: `#cc9966` face. Inactive: `#cccccc` disc, no glyph.

**Controls:**
- *Push button*: sandstone block 20 px, `#ffcc99` face, `#ffffcc` top row, `#cc9966`
  bottom row, `#663333` outline; default = 2 px ring `#cc0000` with a 1 px `#ffcc00`
  inner line (keep). Pressed: `#cc9966` face. Disabled: `#eeeeee` with `#999999`.
- *Checkbox* 12 px: outline square, cream face; checked = `#cc0000` 7 px pixel
  check. *Radio*: 12 px disc; on = `#cc0000` 5 px dot with 1 px `#ffcc00` ring.
- *Scroll bar* 16 px: track = Rhine (`#339999` with white dashes), arrows =
  sandstone plates with 5 px `#cc0000` arrowheads (red stays small), thumb = a
  sandstone block with three 1 px `#ffffff` foam dots (crisp grips, visual-design §2.2).
- *Slider*: track = river band 5 px; thumb = the mooring bollard disc.
- *Progress*: sandstone channel, fill = Rhine teal with foam dashes; indeterminate =
  a small barge silhouette (`#336666`, 12 × 5) moving along.
- *Tabs*: pennant-shaped tabs? No: sandstone blocks; the active tab carries a 2 px
  `#cc0000`/`#ffcc00` top rule (the city stripe), inactive `#eeeeee`.
- *Menus*: `#ffffff` panel, `#663333` outline, a 2 px red/yellow rule under the
  title row; highlight `#cc0000` with `#ffffcc` text. Menu bar = the sandstone
  bar with the blossom branch tile (no skyline).
- *List headers*: sandstone plates with `#996633` separators.

## 4. Signature details the implementer must not lose

1. **The skyline group as one outlined silhouette standing on the bar**: Minster
   spire + four towers, pink Town Hall with white windows, glass Post Tower. Flat
   masses, lit roof edges, windows as 1×2 blocks on a 3 px rhythm; capped at 24 px
   above the bar.
2. **The blossom branch** running from the top-left corner along the bar's top edge,
   with 5 px rosettes; the only pink in the chrome besides the Town Hall.
3. **The arch bridge in the water band**, centred, water visible through the arch,
   and the **bollard grow box**.
4. **Two flat teals + white foam dashes** for every "water" surface (bottom band,
   scroll track, progress fill), identical on web and at 8 bpp.
5. **Red is the title's colour**: pennant, default ring, checked states and 5 px
   arrowheads only. Sandstone everywhere else.
