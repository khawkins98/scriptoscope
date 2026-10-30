# Brickworks — concept brief (phase 1, art direction)

## 1. Art direction

**Big idea: a window snapped together from generic toy bricks on a toy construction
site.** The present scheme already has the right discipline (hard warm-dark outline,
one gloss row, cube-entry primaries). The target adds *character* in the Animals /
Crayon OS register: a yellow lattice crane standing on the top-right corner block
and rising above the bar with a single red brick dangling from its hook, a big
yellow 2×2 corner block top-left, a stack of loose blue and green bricks leaning
on the bottom-left corner, a green studded baseplate as the plinth, a grey wheel
as the grow box, and side walls of staggered red and blue courses with visible
seams. Studs become real cylinders (lit top ring, flat side, 1 px shade) and the
whole thing stays flat, glossy and chunky. No brand names, logos, minifigures or
printed studs.

**Materials.** Flat glossy plastic: each face is base colour + one 1 px `hi` row
on top + one 1 px `lo` column on the right + a warm near-black outline. Nothing
dithered. Studs: 6 px diameter, `hi` top arc, `base` side, `deep` 1 px shade.

**Palette (EXACT cube entries):**

| Brick | hi | base | lo | deep |
|---|---|---|---|---|
| red | `#ff6666` | `#cc0000` | `#990000` | `#660000` |
| yellow | `#ffff99` | `#ffcc00` | `#cc9900` | `#996600` |
| blue | `#6699ff` | `#3366cc` | `#003399` | `#003366` |
| green | `#66cc66` | `#339933` | `#006600` | `#003300` |
| white tile | `#ffffff` | `#eeeeee` | `#cccccc` | `#999999` |
| grey (wheel, axle, tracks) | `#cccccc` | `#999999` | `#666666` | `#333333` |

Outline `#330000` everywhere (warm near-black). Body `#eeeeee` plain (no baseplate
rings behind text). Inactive: keep hue, lift value: red→`#cc6666`, blue→`#6699cc`,
yellow→`#cccc66`, green→`#66cc99`→ prefer `#669966`; title `#666666` on the tile.
Light from the upper-left: `hi` on top edges of bricks, on the left arc of studs.

## 2. Chosen target

**`concept-2a.jpg`** (preview `concept-2a-preview.png`). It has the crane, the loose
brick stack, the wheel grow box, the green stud baseplate, the staggered side
courses, round-stud widgets, brick buttons and a brick progress bar; all in flat
colour with crisp outlines. `concept-1a` is a cleaner but plainer version (useful
as the reference for the *inactive* window and for stud spacing).

Ignore in 2a: the faint sheen gradients on the side bricks, the soft shadow under
the crane, the oversized checkboxes, the gloss on the baseplate.

## 3. Build translation

Document template about **170 × 96**, content rect
`A = (left 10, top 40, right 160, bottom 80)`.

**Top band, 40 rows.** Rows 0–17: above the bar, transparent except the corner
block's studs (rows 10–17) and the crane (rows 0–17). Rows 18–39: the bar = one
course of red 2×4 bricks, 22 px tall, with studs on top (rows 14–19 overlap the
brick's top edge so studs read as standing on it).

- Cell 1, **code 1, 28 px, full height**: yellow 2×2 corner block (28 × 22) with two
  studs rising above; the **close widget** (red round stud, 14 px) sits on the
  block's front face in the bar row.
- Cell 2, **code 13, 1 px**: red brick filler (flat `#cc0000` column with the `hi`
  row and stud-less top).
- Cell 3, **code 12, 24 px**: one red 2×4 brick with two studs (12 px pitch) and its
  1 px seam. Whole bricks only: leftovers go to cells 2/8.
- Cell 4, **code 6 bezel, 3 px**: the white tile's left edge (outline + 2 px).
- Cell 5, **code 5 plate, 1 px**: white tile `#eeeeee`, `#ffffff` top row,
  `#cccccc` bottom row.
- Cell 6, **code 6 bezel, 3 px**.
- Cell 7, **code 12, 24 px** and cell 8, **code 13, 1 px**: bricks to the right.
- Cell 9, **code 1, 46 px, full height**: the **crane corner**. A yellow 2×2 block
  (28 px) carrying the zoom (green stud) and collapse (blue stud) widgets in its
  front face; standing on it a 1 px-outlined yellow lattice boom 18 px wide rising
  from row 0 to the block top, angled up-right as a 3-step stair, with a black
  1 px cable dropping to a 10 × 7 red brick hanging just left of the boom tip
  (inside the cell, above the bar). Keep the dangling brick's silhouette hard.

Fixed top width = 28 + 3 + 3 + 46 = **80 px** (+2 fillers). At 260 px that leaves
~178 px for the title; the crane cell should be **code 10** so windows narrower than
~150 px shed the crane before the title (R6/R12); a 28 px code-1 corner block (no
crane) sits behind it for that case (titled-utility uses the small corner).

**Bottom band, 16 rows:** green baseplate: 1 px outline, row of studs (6 px, 8 px
pitch, standing proud above the plate as transparent-gapped bumps in rows 0–3),
plate `#339933` with `#66cc66` top row and `#006600` bottom row, outline.
Recipe: `1@30 (stack of loose bricks: a blue 2×2 over a green 1×4 leaning at the
corner, inside the band) | 11 (8 px stud period) | 8 | 1@22 (wheel grow box: 16 px
grey wheel, `#999999` tyre, `#cccccc` hub, `#333333` axle pixel, 1-2-1 stair rim)`.

**Side bands, 10 px:** staggered courses: left wall alternates a red 1×2 (10 × 22)
and a blue 1×2 with a 1 px `#330000` seam, one period = 46 rows, `hi` top row and
`lo` right column on each brick; use one **code-8 grower holding the whole 46 px
period** (R2). Right wall the same with the colours swapped. No stud on the side
faces.

**Drop from the concept:** side sheens, drop shadows, perspective on the crane
(it is a flat side view), bevels on the baseplate, the chunky checkbox corners.

**Widgets (14 × 14 round studs, identical silhouette):** outline circle (1-2-1
stair), `base` face, `hi` arc top-left (3 px), `lo` 1 px bottom-right, 1 px white
glyph on whole pixels: × 5 × 5, + 5 × 5, − 5 × 1. Red close, green zoom, blue
collapse. Pressed: `deep` face. Inactive: `#cccccc` stud, no glyph.

**Controls:**
- *Push button*: yellow 2×3 brick 20 px tall with two 6 px studs on top (the studs
  rise 3 px above the button rect; keep them inside the cicn), `hi` row, `lo`
  column, `#330000` outline, text `#330000`; default = a 2 px `#cc0000` plate
  outline 1 px outside (as now). Pressed: `#cc9900` face. Disabled: grey brick.
- *Checkbox* 12 px: white 1×1 plate (`#eeeeee`, `#ffffff` top row, outline);
  checked = `#cc0000` 7 px pixel check. *Radio*: 12 px yellow round stud; on =
  `#cc0000` 5 px centre.
- *Scroll bar* 16 px: track `#cccccc` with a `#999999` top/left sunk line; arrows =
  blue 1×1 plates with 5 px white arrowheads; thumb = red 2×1 brick (keep) with a
  single stud pair on the face drawn as two 4 px discs.
- *Slider*: track = a grey 1×8 plate lying flat (`#999999`, studs every 8 px drawn
  as 2 px `#cccccc` dots); thumb = yellow round stud 13 px.
- *Progress*: grey channel, fill = a row of green 1×1 bricks (8 px each, 1 px seam)
  — the concept's bar, exactly. Indeterminate: the bricks walk.
- *Tabs*: each tab is a 1×2 brick in the window-type colour with one stud on top
  (the stud is the tab's "bump" above the row); active = yellow, inactive = grey.
- *Menus*: `#eeeeee` panel with `#330000` outline and a red brick top rail with
  studs; highlight `#3366cc` with white text. Menu bar = one red brick course
  with studs (the top-band tile).
- *List headers*: white tiles with a 1 px `#cccccc` seam.

## 4. Signature details the implementer must not lose

1. **The crane on the top-right corner block** with the dangling red brick: the one
   thing that says "construction site" rather than "brick wall".
2. **Real studs**: 6 px cylinders with a lit top arc and a 1 px shade, standing
   proud of the bar and baseplate so the top and bottom silhouettes are bumpy.
3. **Loose bricks** stacked at the bottom-left corner and the **grey wheel** grow
   box at the bottom-right: the frame has a floor things sit on.
4. **Staggered two-colour side courses** with seams, like a real wall, rather than
   a single flat column.
5. **Round-stud widgets, brick buttons, brick progress bar**: every control is a
   piece from the same box.
