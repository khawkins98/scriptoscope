# Midnight 2027 — concept brief (art direction)

## 1. Art direction

**Big idea: the window is the night sky at the stroke of midnight on New
Year's Eve 2027. Fireworks burst above the title bar, and the title hangs on
a champagne-gold plate.**

The silhouette that carries the theme is **the two bursts above the bar**: a
big gold-and-pink firework hugging the left end of the plate and the bold gold
numerals **2027** standing on the bar at its right end, with a small cyan
burst behind them. Everything else is quiet midnight navy, so those two shapes
and the gold plate read from across the room. The body is plain white: the
celebration is in the frame, and live text sits on something calm.

**Materials.**
- Night sky: flat midnight navy with single-pixel stars. Stars are chosen per
  tile, never per pixel, and there are no gradients.
- Gold foil: flat gold with a 1 px champagne lit row on top and left and a
  1 px bronze shade on the bottom and right. It's used for the title plate, the
  widget rims, the numerals, the inner rule round the content and the default
  ring.
- Firework light: gold, pink and cyan rays on whole pixels. Each ray has a
  bright head and a darker tail, and there are a few loose sparks. They are
  hard-edged, with no glow.
- Clock: a white face with a gold rim, twelve tick pixels and both hands on
  12. It appears as the scroll thumb (a pocket watch), the alert crest and the
  bottom-right corner of document windows (the grow-box corner).

**Light:** one source from the upper left. Lit rows and columns sit on the
top and left of every raised piece: plate, widgets, numerals, buttons, arrow
plates and thumb. Sunk pieces (the scroll channel, the progress channel) are
shaded on their top and left.

**Palette.** Every entry is an exact `SYSTEM_PALETTE_256` colour
(`tools/theme-author/encode-icons.js`), so an 8 bpp screen keeps each step:

| Role | Active | Inactive |
|---|---|---|
| outline (whole silhouette; not black) | `#000022` | `#333366` |
| sky / bar / band fill | `#000033` | `#666699` |
| sky lit row/column | `#003366` | `#9999cc` |
| band inner shade column | `#000022` | `#333366` |
| star (dim / bright) | `#6699cc` / `#ffffcc` | `#9999cc` / `#cccccc` |
| gold foil: lit / face / shade | `#ffffcc` / `#ffcc33` / `#cc9933` | `#eeeeee` / `#cccccc` / `#999999` |
| bronze (darkest gold, glyph outline) | `#996600` | `#888888` |
| title text / shadow | `#000033` / none (same colour) | `#333333` / none |
| firework gold | `#ffcc33`, tail `#cc9933` | `#bbbbbb` |
| firework pink | `#ff66cc`, tail `#cc3399` | `#aaaaaa` |
| firework cyan | `#33ccff`, tail `#0099cc` | `#aaaaaa` |
| spark white | `#ffffff` | `#dddddd` |
| clock face / hands | `#ffffff` / `#000033` | `#eeeeee` / `#666666` |
| body (web only, exotic-frames R22) | `#ffffff` | same |

The inactive window is the same shape in slate (`#666699`). Gold goes to
silver and the fireworks to greys: a desaturated pink or gold would snap to
odd entries at 8 bpp. The title is dark on the silver plate. The inactive
window keeps the bursts as grey silhouettes, so the shape stays.

## 2. Concept image

`concept.jpg` was generated with `agy`'s image generator from
`brief-concept.txt`, using the same route as Castle
(`/tmp/concepts/run.sh`, Opus 5.5 medium driving the image subagent, with the
animals, monkey-paradise, evolution and crayon-os references; see
`docs/authoring-art-with-ai.md` §3). One run gave two images. The other was
`concept-2a`, which lets "2027" hang outside the window and a burst fall into
the content. The chosen one is `concept-2b`: everything stays inside the
footprint, the plate reads, and the pocket-watch thumb and corner clock are
there. Three more runs, with a prompt asking the bursts to break through the
bar's top edge, ended with the image subagent cancelled at the print timeout
and no image.

It is a target to look at and a source to paint over (`npm run paint-over`),
never final pixels. Its pixel pitch is **3.7 source px per art pixel**
(autocorrelation peaks at 3.7, 7.5 and 11). At 1×, the concept's window is
about 241 px wide, the top band about 40 px, the sides about 7 px, the discs
about 14 px, the big burst 50×44, the cyan burst 30×23, "2027" 55×22 and the
clock about 17 px. Corrections made:

- In the concept the bursts sit inside a tall bar. The brief asks them to
  overshoot it, so the top band has 22 sky rows above a 28-row bar, and the
  bursts are centred on the bar's top edge.
- The bursts and numerals were redrawn on whole pixels from the paint-over
  measurements (`art.mjs`). The concept's soft glow is gone.
- The body is plain white, and the progress bar inside the concept's content
  is a control (`progress.mjs`), not frame art.

## 3. Build translation (numeric targets, 1×, as built)

Document template **230 × 137**, content rect
`A = (left 9, top 50, right 221, bottom 122)`.

**Top band, 50 rows.** Rows 0–21 are sky: transparent except the two
ornaments. Rows 22–49 are the bar (28 rows): the outline row, a 1 px lit
row, flat navy with stars, and a 1 px gold rule on the last row over the
content.

| Concept feature | Cell (top edge, left → right) | Code | 1× size |
|---|---|---|---|
| left corner + close disc | `cornerL` | 1 | 22 px; close 15×15 at (4, 28) |
| big firework (gold rays, pink tips) | `burst` | **10** (droppable) | 42 px cell; burst 41×43 centred on the bar's top edge, rising 21 px above it |
| starry bar, left | `barL` | 11 | 32 px tile (one period of stars) |
| plate end cap | `capL` | 6 | 6 px (rounded gold end, lit left) |
| gold title plate | `plate` | 5 | 2 px source, one colour per row; plate rows 24–46, title rect rows 28–46 |
| plate end cap | `capR` | 6 | 6 px (shaded right end) |
| starry bar, right | `barR` | 8 | 32 px tile |
| "2027" numerals + cyan burst | `year` | **10** (droppable) | 50 px: four 10×16 digits, 2 px gaps, 1 px drop shadow, on the bar's lower rows; cyan burst 31×25 above them |
| right corner + zoom + collapse | `cornerR` | 1 | 38 px; discs 15×15, 2 px apart |

The ornaments ride the corners and the growers sit between them and the
plate, as in the concept. Fixed top width: 22 + 42 + 6 + 6 + 50 + 38 =
**164 px**. A whole 90 px title shows from 254 px. Between 164 and 254 px
the bursts stay and the title truncates. Below 164 px the bursts and the
title drop together (TS1). That is deliberate: the fireworks are the scheme.

**Side bands, 9 px each** (the concept's ~7 px, plus the gold rule). From
outside to inside: 1 px outline, a 1 px lit column (left side only), navy, a
1 px deep shade, a 1 px gold rule. Recipe: `8 (24 px) | 1 (24 px twinkle) | 8 (24 px)`. Several growers between the fixed twinkles spread them evenly as
the window grows.

**Bottom band, 15 px.** Rows: the gold rule, a shade row, navy with stars
and gold flecks, then the outline. Recipe:
`1 cornerBL 24 | 11 (16 px) | 1 mid (twinkle) | 8 (16 px) | 1 clock 24`
(document). The clock face (13 px) sits in the bottom-right corner, where the
web's resize handle is. Dialog and alert use the same recipe with a plain
corner instead of the clock.

**Other windows.**

| Window | Top | Notes |
|---|---|---|
| movable modal / movable alert | the document's top, no widgets (the zoom/collapse discs become plain bar) | same 46 px band |
| titled utility (+ collapsed) | `corner 1 \| 11 \| 6 \| 5 \| 6 \| 8 \| corner 1`, band 28 = 8 sky rows + 20 px bar; a small burst above the right corner | close only, at the document's 15 px (R24); sides 6, bottom 8 |
| dialog | `corner 1 \| 11 \| crest 1 (38 px, centred burst) \| 8 \| corner 1`, band 28 = 13 sky + 15 bar | untitled |
| alert | same, crest = a 17 px clock at midnight | untitled |
| collapsed document | the document's top band only | |

**Widgets (15 × 15):** one family. Each is a disc with a bronze outer ring,
a gold rim (lit on the upper left) and a navy face, with a whole-pixel gold
glyph: close **×** (5×5), zoom **□** (5×5 outline), collapse **–** (5×1).
Pressed is inverted: a gold face with a navy glyph. Inactive keeps the
silver disc and drops the glyph.

**Controls.**
- *Push button*: a navy face with a gold outline (lit top/left, bronze
  bottom/right) and a white label. Pressed is a gold face with a navy label.
  Disabled is slate with a light grey label. The default ring is a 2 px gold
  band in a bronze edge.
- *Checkbox* 13 px: a navy box, gold rim, gold 7×7 check. *Radio*: a navy
  disc, gold rim, gold 5 px dot. Pressed means a lighter navy face. Mixed is
  a 7×3 gold bar.
- *Scroll bar* 16 px: a navy channel, sunk (shade on the near wall, lit far
  lip). Arrows are navy plates with gold rims and 9×5 gold arrowheads. The
  thumb is a gold pocket watch: a round white face, tick pixels and hands on
  12, inside a gold case with flat case ends on the track.
- *Progress*: a navy channel. The fill is champagne rising: gold rows with a
  `#ffffcc` top row and a bronze bottom row. Indeterminate is diagonal
  confetti stripes (gold, pink, cyan) on navy.
- *Slider*: a navy rail with a gold top row. The thumb is a gold marker
  with a navy star, pointing at the value; non-directional sliders use a gold disc.
- *Tabs*: navy plates with a gold top edge. The front tab is lighter
  (`#003366`) and its label is white.
- *Menus*: the menu bar is the night bar (navy, lit row, gold rule). Menus
  are white with a navy rim and a gold top rail. The selected item is gold
  with navy text.
- *Desktop (ppat 17)*: a 64×64 night sky with sparse stars and a few
  confetti flecks, stored raw (exact system entries).

## 4. Signature details the implementer must not lose

1. **The two bursts above the bar**: the big gold/pink firework left of the
   plate, and the gold **2027** with a cyan burst right of it. Both are
   droppable (code 10), and both keep their silhouette when inactive.
2. **The gold plate**, with flat gold rows, a champagne lit row and rounded
   end caps.
3. **The clock at midnight**: the scroll thumb, the bottom-right corner and
   the alert crest.
4. **Calm**: the bar and bands are flat navy with sparse stars, and the body
   is white. No dithering and no gradients anywhere.
