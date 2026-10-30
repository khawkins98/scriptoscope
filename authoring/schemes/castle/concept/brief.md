# Castle — concept brief (phase 1, art direction)

## 1. Art direction

**Big idea: the window IS a stone keep, and the title is a banner hung from its
wall.** The present scheme has the right idea but the wrong *weight*: thin merlons,
small towers, stone that is all edges. The target is the Animals register: two big
round corner towers with conical red-tiled roofs and pennants rising well above
the bar, a crenellated curtain wall between them, a deep-red heraldic banner with
gold fringe as the only title plate, arrow slits down the walls, a plinth over a
narrow moat at the bottom and a portcullis in the lower-right corner as the grow
box. Stone is a surface, not a mesh: big blocks, two tones, a lit top edge on about
a third of them, dark mortar only where the eye needs a joint.

**Materials.** Grey ashlar (flat, 14 px blocks on 6 px courses); terracotta roof
tiles in horizontal rows; red cloth with gold fringe and a wooden pole; oak planks
with iron bands for buttons; iron grille for the portcullis; cream parchment body.

**Palette (all EXACT `SYSTEM_PALETTE_256` entries; the stone sits on the grey ramp
so 8 bpp cannot turn it pink):**

| Role | Hex |
|---|---|
| stone A / stone B (two block tones, hashed) | `#999999` / `#aaaaaa` |
| stone lit top edge (≈ 1/3 of blocks) | `#cccccc` |
| stone shade (right tower band, under merlons) | `#777777` |
| mortar | `#666666` |
| outline (whole silhouette; not black) | `#333333` |
| roof tile / roof lit row | `#993333` / `#cc6666` |
| roof shade (right side) | `#660000` |
| banner cloth / fold shade | `#990000` / `#660000` |
| gold fringe, finials, brass ring | `#ffcc33` / `#cc9900` |
| banner text | `#ffffcc` with 1 px `#660000` shadow |
| oak face / oak grain / oak shade | `#996633` / `#cc9966` / `#663300` |
| iron | `#333333` / `#666666` |
| moss (sparse, base of walls only) | `#669966` |
| moat water | `#336699` / `#6699cc` |
| parchment body / parchment fleck | `#ffffcc` / `#cccc99` (sparse 1 px flecks, 1 per 16×16) |
| inactive: stone goes `#aaaaaa`/`#bbbbbb`, banner `#999999`, title `#333333` | |

Light from the upper-left, **one light for the whole frame**: left tower gets a
1 px `#cccccc` column inside its outline on the left, the right tower a 3 px
`#777777` band on its right; the wall has a 2 px `#777777` shade where it meets the
left tower. Roofs: lit tile rows on the left half, `#660000` on the right third.

## 2. Chosen target

**`concept-1c.jpg`** (preview `concept-1c-preview.png`). It has the tower scale,
the merlon rhythm, the banner, the barrel thumb, the portcullis corner, the moat
plinth and the arrow slits all at once, with the best-balanced stone (big blocks,
flat faces). `concept-1a`/`1b` are the same composition with worse text.

**One correction the implementer must make:** the concept draws a *second*,
Platinum-style grey title bar under the wall. That bar does not exist. The banner
IS the title plate, and the wall row it hangs from IS the title bar; the three
widgets sit directly on that wall row (shield at the left, window opening and
drawbridge at the right). Also ignore: the soft shadow under the towers, the moss
gradient, the cartoony "Checkboxex" labels.

## 3. Build translation

Document template about **190 × 110**, content rect
`A = (left 10, top 64, right 180, bottom 92)`.

**Top band, 64 rows.** Rows 0–23: towers/roofs/pennants only, transparent between
them. Rows 24–37: merlons (6 px tall, transparent gaps). Rows 38–63: the wall =
the title bar (26 px tall, four courses), with the banner hanging over it.

- Cell 1, **code 1, 30 px, full height** (document) / **code 10** (so windows under
  ~200 px shed it, R12): left tower. 30 px wide round tower, conical roof 14 rows
  tall with 1 px pennant pole, the **close widget (shield, 14 × 14)** set into the
  tower's wall row. Below the band the tower continues as the left band's fixed
  cell (R14), so `A.left = 10` is the wall *and* the tower's lower 10 px overlap
  the wall column; the tower's extra width above is transparent in the side band.
  Simpler alternative if that is awkward: towers 26 px wide and `A.left = 8`.
- Cell 2, **code 13, 1 px**: filler column of plain wall (no merlon), for code-12
  leftovers (R4).
- Cell 3, **code 12, 14 px**: one merlon (8 px) + one gap (6 px) over four wall
  courses. Whole tiles only, so merlons are never cut.
- Cell 4, **code 6 bezel, 6 px**: banner's left end: pole finial + the cloth's
  rolled edge + the first 2 px of fringe.
- Cell 5, **code 5 plate, 2 px tile**: `#990000` cloth, a `#ffcc33` fringe row with
  2 px teeth (tooth column, gap column: that is why the source is 2 px), a
  `#660000` bottom shadow row. It tiles to any title width without a seam.
- Cell 6, **code 6 bezel, 6 px**: mirror of cell 4.
- Cell 7, **code 12, 14 px** then cell 8, **code 13, 1 px**: merlons to the right.
- Cell 9, **code 1 / code 10, 30 px**: right tower with the **zoom** (window
  opening) and **collapse** (drawbridge) widgets stacked side by side in its wall
  row (14 × 14 each, 1 px gap); roof shaded on the right.

Fixed top width = 30 + 6 + 6 + 30 = **72 px** (+2 fillers). A 260 px window keeps
~175 px for the title; the banner hangs centred between the two merlon runs
(11/8 phase-locking is not needed because 12/13 pairs centre the leftovers).
The banner's cloth hangs 6 rows below the wall's bottom edge into the content
top (that is still inside the band because the wall is the band's bottom; if the
checker objects, keep the fringe inside the band and drop the overhang).

**Bottom band, 18 rows:** rows 0–9 plinth (two courses of the same stone, a
`#cccccc` top row), rows 10–15 moat (`#336699` with 1 px `#6699cc` highlight dashes
every 10 px), rows 16–17 `#333333` outline + `#777777` base. Recipe:
`1@12 (left tower foot) | 11 (10 px plinth/moat period) | 8 | 1@24 (portcullis
grow box: 16 × 16 iron grille, 3 × 3 cells, set in a stone arch)`. If a centred
gate is wanted on dialog/alert bottoms use `11 | fixed 16 | 8`.

**Side bands, 10 px:** 1 px outline, a stone column 8 px wide (two tones in a 12
row period: block, mortar), 1 px inner `#666666` shadow line against the body.
Recipe per side: `1@16 (tower foot) | 8 (12 px period) | fixed 10 px arrow slit
every ~60 px via several 8 growers (R "many growers spread ornaments evenly")`.
Arrow slit = 2 × 7 `#333333` with a 1 px `#cccccc` left lip.

**Drop from the concept:** the lower grey title bar, soft tower shadows, moss
gradient (moss = 3–4 flat `#669966` pixel tufts on the plinth only), the vignette
on the roofs. Rounded tower tops become a 2-1 pixel stair.

**Widgets (14 × 14, all on a plain `#aaaaaa` stone plate with a `#333333` rim):**
close = heater shield, `#336699` field, `#ffcc33` chevron, 1 px outline (keep the
existing pressed state: gold field, blue chevron); zoom = 9 × 9 `#333333` square
outline with a 5 × 5 `#ffffcc` opening (a window); collapse = 7 px `#996633` bar
with a 3-row `#333333` chevron above it (drawbridge up). Pressed: plate goes
`#777777`. Inactive: no glyph, `#bbbbbb` plate.

**Controls:**
- *Push button*: oak plank 20 px tall, `#996633` face with 1 px `#cc9966` grain
  rows every 4 px (two rows only), 1 px `#663300` bottom/right, iron band 2 px at
  each end (`#333333` with a `#666666` lit pixel); default = 2 px `#ffcc33` ring
  with 1 px `#cc9900` under-edge. Pressed: `#663300` face, `#ffffcc` text.
- *Checkbox* 12 px: iron-bound plate (`#aaaaaa` face, `#333333` rim, `#666666`
  rivet pixels in the corners); checked = 7 px `#990000` pixel X. *Radio*: round
  shield boss, `#999999` disc; on = `#990000` 5 px centre with 1 px `#ffcc33` ring.
- *Scroll bar* 16 px: track is a stone channel (`#777777` face, `#666666` mortar
  lines on a 6 px rhythm), arrows are `#aaaaaa` plates with a 5 px `#333333`
  carved arrowhead and 1 px `#cccccc` lit edge; thumb = bound oak barrel (keep:
  `#996633` staves, two `#333333` hoops with `#666666` highlights, ends rounded
  on a 1-2 stair).
- *Slider*: 5 px iron rail (`#333333` with `#666666` top row); thumb = a small
  shield (13 px) in `#336699`/`#ffcc33`.
- *Progress*: channel of dark stone, fill = red cloth `#990000` with a `#ffcc33`
  1 px top row (the banner unrolling). Indeterminate: a moving gold fringe.
- *Tabs*: stone merlons! Each tab is a merlon-shaped stone plate; the active tab
  is `#aaaaaa` with the `#cccccc` lit top row and no bottom line, inactive `#999999`.
- *Menus*: parchment `#ffffcc` panel with a `#333333` outline and 1 px `#996633`
  oak top rail; highlight `#990000` with `#ffffcc` text. Menu bar = one wall
  course with merlons along its top (the same 14 px tile as the frame).
- *List headers*: oak rail with iron separators.

## 4. Signature details the implementer must not lose

1. **Towers with conical red roofs and pennants rising a full 24 px above the
   merlons**, one lit from the left, the other shaded on the right. They are the
   silhouette.
2. **The banner is the title**: red cloth, gold fringe teeth, pole finials at both
   ends, the engine's bitmap title on it with the 1 px dark-red shadow. No other
   title bar.
3. **Flat stone with selective highlights**: two tones, 14 px blocks, a lit top
   edge on a third of them chosen by hash, mortar one step darker, no speckle.
4. **The portcullis grow box** in a stone arch, and the **barrel thumb**: the two
   bits of iconography that make the scroll bar and corner feel like a keep.
5. **Arrow slits** spaced evenly down both side walls (they must move apart as the
   window grows: several equal growers, not one).
