# Halcyon — concept brief (phase 1, art direction)

## 1. Art direction

**Big idea: a kingfisher has landed on a frosted modern window.** Halcyon stays the
calm, light, 2020s-style desktop it already is (white body, frosted glass chrome,
one teal accent) but gets one bold illustrated ornament, in the Animals/Monkey
Paradise manner: a chunky pixel-art kingfisher perched on a branch at the top-left
corner, rising above the title bar, with the branch running along the top edge as
the bar's upper rim. The bottom edge is a band of still water with a single ripple
under the window. Everything else is restrained so the bird reads as *the* detail.

**Materials.** Frosted ice-glass chrome (a flat light grey-white face, one 1 px
white sheen row under the outline, a hard slate outline so the window finally has
an edge). Matte olive branch. Flat teal water with white foam dashes. No gradients
across tiled cells; the sky-blue wash in the concept image becomes a flat tint.

**Palette (chosen on 6×6×6 cube / grey-ramp entries, all EXACT in
`SYSTEM_PALETTE_256`; design in these, let the loader's gamma do the display
transform):**

| Role | Hex | Note |
|---|---|---|
| body / plate white | `#ffffff` | |
| glass face | `#eeeeee` | grey ramp entry |
| glass shade / inactive face | `#cccccc` | |
| glass deep (tracks, sunk channels) | `#999999` | |
| outline, active | `#336699` | slate-blue; ≥3:1 on white |
| outline, inactive | `#999999` | |
| accent teal (glyphs, checked, default ring, active tab) | `#0099cc` | |
| accent deep | `#006699` | pressed faces, text on teal plates |
| accent light (sheen on teal, thumb grips) | `#66ccff` | |
| bird back/head | `#0099cc` / `#006699` / `#33cccc` (3-step ramp) | |
| bird breast | `#ff9933` / `#cc6600` | |
| bird cheek, eye ring | `#ffffff`, `#000000` | |
| beak | `#333333` / `#666666` | |
| branch | `#669933` / `#336600` | |
| water | `#66ccff` (upper band) / `#3399cc` (lower band) | two flat bands |
| foam / ripple | `#ffffff` | 1 px dashes |
| inactive title | `#666666` | ≥4.5:1 on `#eeeeee` |
| active title | `#000000` | |

Light from the upper-left: 1 px `#ffffff` sheen on top/left inside the outline, a
1 px `#cccccc` shade row on the bottom/right inside the outline, on every raised
part (bar, buttons, thumb, tabs). Sunk parts (scroll track, slider track, text
fields) reverse it.

**Signature ornaments:** the kingfisher; the branch-as-top-rim; the water band with
one ripple; a round river pebble as the grow box.

## 2. Chosen target

**`concept-1b.jpg`** (preview `concept-1b-preview.png`). It has the right scale of
ornament (the bird is big, in the Animals register, and it rises above the bar),
the clearest chrome (dark outline, raised title pill, crisp widgets at the right
size) and the water band with the ripple. `concept-1c` is a good secondary
reference for a *compact* bird and for the branch continuing across the bar; its
bird can be used as a size reference for the minimum-width fallback.
`concept-1a` is too soft and its bird is painted, not built.

Known deviations in 1b to ignore: the soft sky gradient in the band (becomes flat
`#eeeeee` glass with the bird on it, transparent above/around the bird), the
drop-shadowed buttons, and the duplicate "Document Window" title in the inactive
window (inactive titles use `#666666`).

## 3. Build translation

Template: one `wnd#` cicn per window type. Document template roughly **150 × 80**
with content rect `A = (left 5, top 46, right 145, bottom 64)`.

**Top band, 46 rows** (the bar is the bottom 20 rows, rows 26–45; rows 0–25 are
transparent except the bird and the branch).

- Cell 1, **code 1 (fixed), 36 px wide, full 46 rows**: the kingfisher (about
  28 × 30 incl. tail, facing right, hard-edged, 1 px `#336699` outline so it reads
  on any page) sitting on the branch; the bar's left rounded corner and the
  **close widget** (13 px disc) in the bar row below the bird. Widget rect sits
  wholly inside this cell (never touching a grower, R11).
- Cell 2, **code 11 (tile from the far end), 8 px source**: one period of bar +
  branch. The branch is 3 rows of olive (`#669933` top row, `#336600` lower) that
  replace the bar's top outline rows, with a leaf nub every period if wanted. Rows
  above the branch transparent.
- Cell 3, **code 6 bezel, 4 px**: the title plate's left rounded end.
- Cell 4, **code 5 title plate, 1 px tile**: white `#ffffff`, 1 px `#cccccc` bottom shade.
- Cell 5, **code 6 bezel, 4 px**: right end.
- Cell 6, **code 8 (tile from the near end), 8 px**: same bar+branch period, so the
  branch continues to the right corner (as in concept-1c). Branch thins to 2 rows
  from the midpoint so the bird's end reads heavier.
- Cell 7, **code 1 (fixed), 34 px, full height**: zoom and collapse discs, the
  right rounded corner; above the bar the branch tip ends in two leaves (rows
  18–25, transparent elsewhere).

Fixed top width = 36 + 4 + 4 + 34 = **78 px**. A 260 px window leaves ~182 px of
title room (a 90 px title fits from ~170 px). Below ~120 px the bird cell could be
code 10 so narrow palettes drop it; the titled-utility template uses a smaller
20 × 18 bird (concept-1c scale) and a 16 px bar.

**Bottom band, 16 rows** (`A.bottom` → 80): rows 0–1 glass ledge with the outline
and sheen; rows 2–13 water as two flat bands (`#66ccff` 6 rows over `#3399cc` 6
rows) with 1 px white foam dashes every 12 px, offset per band; rows 14–15 outline
and `#3399cc` base. Recipe: `1@16 (left pier + pebble shadow) | 11 | fixed 24 px ripple
(three concentric 1 px white arcs on whole pixels) | 8 | 1@16` — the right fixed
cell is the **grow box: a round grey pebble** (`#cccccc`/`#999999`, 1 px sheen) sitting
in the water. Ripple centred via 11/8 phase-locking (R3).

**Left/right bands, 5 px**: 1 px `#336699` outline, 1 px `#ffffff` sheen, 2 px
`#eeeeee`, 1 px `#cccccc` inner shade (right side: shade outside, sheen inside
swapped). One code-8 1 px grower each, from `A.top` (R1).

**Corners** are a 1-2-1 pixel stair, radius 3, hard-edged (no matte, R17).
Collapsed sliver: close the outline row under the bar (visual-design §1.1 #5).

**Drop from the concept because the format can't do it:** the blue sky gradient
in the top band, the soft button shadows, the anti-aliased ripple, the
semi-transparent glass look. Keep the *silhouette* of everything.

**Widgets (13 × 13 discs, all three identical in silhouette):** 1 px `#336699` rim
drawn as a pixel circle, `#eeeeee` face, 1 px `#ffffff` sheen row 1, glyph in
`#0099cc` on whole pixels: close = 5 × 5 ×; zoom = 5 × 5 hollow square with a
centre pixel; collapse = 5 × 1 bar. Pressed: `#0099cc` face, white glyph.
Inactive: `#cccccc` rim, no glyph (a dimple).

**Controls in this style:**
- *Push button*: 20 px tall, 3 px stair corners, `#336699` outline, `#ffffff` face,
  1 px `#eeeeee` bottom row; default = 2 px `#0099cc` ring one pixel outside,
  parallel to the stair (already done well — keep). Pressed: `#cccccc` face.
  Disabled: `#cccccc` outline/text.
- *Checkbox* 12 px: outline square, white face; checked = `#0099cc` fill + 7 px
  white pixel check (2-3-2 stair). *Radio*: 12 px pixel circle; on = `#0099cc` fill,
  3 px white dot.
- *Scroll bar* 16 px: track `#eeeeee` with 1 px `#cccccc` top/left sunk edge;
  arrows are 5 px pixel triangles in `#0099cc` on `#ffffff` plates; thumb a
  frosted pill with three 1 px `#0099cc` grip lines 2 px apart (whole rows); the
  thumb's top sheen is `#ffffff`.
- *Slider*: 4 px sunk teal `#3399cc` groove with 1 px `#006699` top edge; thumb is
  the same river pebble as the grow box (13 px disc, `#eeeeee`, 1 px sheen).
- *Progress*: sunk white channel, fill `#3399cc` with a 1 px `#66ccff` top row and
  the water foam dashes (ties to the bottom band). Indeterminate: dashes scroll.
- *Tabs*: frosted glass, active tab `#ffffff` with a 2 px `#0099cc` top edge and
  no bottom line; inactive `#eeeeee`, 1 px `#cccccc` top.
- *Menus*: `#ffffff` panel, `#336699` 1 px outline, highlight `#0099cc` with white
  text; the menu bar is the frosted bar texture with the branch rim (1 px olive
  line under the menu bar as the one touch of the theme).
- *List headers*: `#eeeeee` plates, 1 px `#cccccc` separators, teal sort arrow.

## 4. Signature details the implementer must not lose

1. The **kingfisher**: 3-tone teal back, orange breast, white cheek, a 1 px dark
   beak that overhangs the bar. It must be hard-edged and sit *above* the bar on
   the branch, not inside it.
2. The **branch is the bar's top rim** along the whole width (two leaves at the far
   right end), so the bird belongs to the frame rather than being pasted on.
3. The **water band + one ripple + pebble grow box** at the bottom: two flat teals,
   white dashes, the ripple exactly centred; the pebble doubles as the slider thumb.
4. The **window finally has an outline** (`#336699` active / `#999999` inactive)
   with a 1 px white sheen inside it; keep that same rim on every disc and button
   so the chrome reads as one material.
5. Teal is spent only on: glyphs, checked/on states, the default ring, the active
   tab edge, the water. Nothing else.
