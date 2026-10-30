# Visual design for authored schemes

A design review of the four first-party schemes (Halcyon, Castle, Brickworks,
Bonn) and the guidance that falls out of it. It is written for the engineers
and agents who build schemes with `tools/theme-author/`, and it assumes you
have read [`authoring-a-scheme.md`](./authoring-a-scheme.md) §4 (masks, the
256-colour budget, hidden swatches, gamma, smooth edges, dithering) and skimmed
[`authoring-exotic-frames.md`](./authoring-exotic-frames.md). Nothing here
asks the format for something it can't do.

The review looked at each scheme's `preview.png` and `preview-sizes.png`
(web runtime, DPR 2), the `classic/*.png` captures (real Kaleidoscope 2.3.1 on
System 7.5.5 at 8 bpp), the raw real-Kaleidoscope capture sets (kept privately; the committed
selections are in each scheme's `classic/` folder), and 4×/8× nearest-neighbour crops made with
Pillow (a selection is in `authoring/experiments/design-review/`) (`*-crops.png`, `*-8x.png`,
`*-classic-8x.png`, `sim8-vs-classic.png`). Two before/after mockups and three
small prototype tools live in the same directory; section 4 lists them.

A short version of the whole document: **these schemes are structurally
sound and the engine rules are respected everywhere. What separates them from
the best corpus schemes is not the format, it is three habits: textures made
of edges instead of surfaces, soft (anti-aliased) strokes where a 1-bit
format wants whole pixels, and palettes chosen in sRGB without checking what
the 8-bit system palette will make of them.**

---

## 1. Per-theme critique

Each section ends with a table of the changes that would make the biggest
visual difference, in priority order, with the file and function where the
change lives. Contrast ratios are WCAG on the on-screen (post-gamma) colours
from each `palette.mjs`; the full numbers are in the appendix.

### 1.1 Halcyon (`authoring/schemes/halcyon/`)

**What works.** The restraint. One accent (`#1689a8`) used on exactly the
things that matter (close, default ring, checked state, active tab's top
edge), white everywhere else, a 1 px sheen under the top edge and a 1 px
separator under the bar. The push buttons and checkboxes are the cleanest of
the four and the default ring is parallel to the face's corner curve, which is
the detail most people get wrong. It also degrades best at 8 bpp: the
bar gradient collapses to two greys and nothing is lost
(`classic/desktop@2x.png`, `classic/dialog@2x.png`).

**What doesn't.**

- *The window has no edge.* The border `#97a2b2` is 2.6:1 against the white
  body and 1.7:1 when inactive (`#c4c9d0`). On the preview's slate background
  it reads; on a white page a Halcyon window is a white rectangle with a
  faint grey hairline, and two overlapping inactive windows merge. Compare
  the inactive "Shared" window behind "System Folder" in
  `classic/desktop@2x.png`: its edge is almost gone. A 2020s look can have a
  soft outline, but it cannot have *no* outline at 1 px.
- *Inactive titles are 2.4:1* (`#9aa1ab` on `#f6f7f9`). "Movable Modal" and
  "Long document" in `preview.png` are the quietest text in any of the four
  schemes. Inactive should read as "not in front", not "disabled".
- *The title-bar glyphs are mush.* `drawGlyphButton` strokes the ×, + and −
  with `strokeLineSmooth(…, 1.25, ink)` inside a 12 px disc. At 1× the + and −
  are grey smears with no crisp pixel (`../authoring/experiments/design-review/halcyon-8x.png`,
  top; `halcyon-classic-8x.png`). The same applies to the scroll thumb's
  three grip lines and to the `^ v < >` arrowheads: a 1.25 px anti-aliased
  stroke on a 1-bit format is the single most "generated" tell at this scale.
  See the mockup in section 4.
- *The collapsed (windowshade) sliver.* `../authoring/experiments/design-review/halcyon-classic-sliver-zoom@6x.png`
  shows a white hairline under the bar when collapsed; the bottom corners are
  rounded with `radiusTop` but the outline row below them is not closed.
  Small, but it is the one state a classic user will see every day.
- *The accent moves at 8 bpp.* `#1689a8` snaps to `#009999`, a greener,
  louder teal than the web shows. Pick an accent that sits on a cube entry
  (`#0099cc`, `#3399cc`, `#006699`) or accept the shift knowingly.

| # | Change | Where | Why |
|---|---|---|---|
| 1 | Hand-place the widget glyphs on whole pixels: a 5×5 × from (4,4), a 5 px bar, a 5 px cross; keep the smooth disc. | `scheme.mjs` → `drawGlyphButton` (the three `stroke(...)` calls) | Crisp at 1×, identical at 8 bpp, reads as designed rather than rendered. Mockup: `../authoring/experiments/design-review/mockup-halcyon-glyphs.png`. |
| 2 | Darken the frame outline to about `#6f7a8a` active / `#a5adb8` inactive (≥ 3:1 against white), keep the 1 px sheen inside it. | `palette.mjs` → `C.active.border`, `C.inactive.border`; used in `paintFrame` via `r.outlineEdges` | The silhouette must survive a white page and stacked inactive windows. |
| 3 | Inactive title to about `#6b7380` (≥ 4.5:1 on the inactive bar). | `palette.mjs` → `C.inactive.title` | "Behind" should still be legible. |
| 4 | Replace the thumb's three smooth grip lines with three 1 px lines on whole rows, two pixels apart; replace the arrow chevrons with 5 px pixel arrows. | `parts/scrollbars.mjs` (thumb and arrow painters) | Same reason as 1. |
| 5 | Close the outline under the collapsed bar (one row of `p.border` across the sliver's bottom, corners included). | `scheme.mjs` → `paintFrame` (the `layout.bottom === 0` branch) | Removes the white hairline in `05c-sliver-zoom@6x.png`. |

### 1.2 Castle (`authoring/schemes/castle/`)

**What works.** The idea is strong and it is carried through: the banner is
the title plate, towers are the corners, the gate is the grow-box end of the
plinth, the close box is a shield, the scroll thumb is a bound oak barrel, and
the oak push button with a brass default ring is genuinely good (the OK
button in `preview.png` is the best control in the four schemes). The banner
text is 7.5:1 and the engine's bitmap title on it (`classic/desktop@2x.png`)
looks like it belongs. The exotic-frame rules (code 12 merlons, code 13
fillers, the 1 px inset on the tower shaft) are all handled.

**What doesn't.**

- *The stone is all edges.* `stone.mjs` → `ashlar()` gives every block a
  lit top row, a lit left column, a shaded bottom row, a shaded right column,
  a 1 px mortar line *and* 10 % grit speckle, on a 5 px course with 12 px
  blocks. That is four rows of edge treatment per five rows of wall: there is
  no surface left, only outlines, and the five "different" stone tones
  (`#a59e91 … #979084`, all within 20 RGB units) are invisible under them.
  At 1× it reads as a grey mesh (`../authoring/experiments/design-review/castle-8x.png`, rows 1 and
  3). Real pixel masonry picks a *few* blocks to highlight and leaves the rest
  flat.
- *The light is on the towers but not on the wall.* `towerLight()` dithers a
  highlight down the left 22 % and a shade down the right 28 % of each tower
  shaft. Both towers get the same treatment, so the light is "from the left"
  for the left tower and also "from the left" for the right tower, while the
  curtain wall between them has no directional light at all. A tower that is
  lit should cast its shade on the wall next to it, or the wall should share
  the same left-to-right falloff. Because the falloff is dithered, at 1× it
  reads as a dirty right edge rather than shade.
- *Chroma noise at 8 bpp.* The warm greys straddle system-palette cells. The
  five base tones all snap to `#999999` (so the variety is gone), but the
  `mix(tone, stoneHi, 0.55)` highlight rows snap to `#cc9999` (pink) and the
  moss to `#669933`/`#99cc33`. The classic capture
  (`../authoring/experiments/design-review/castle-classic-8x.png`) shows pink mortar bands and
  bright green flecks on the plinth; `sim8-vs-classic.png` row 1 reproduces
  it. A grey that is slightly warm in sRGB is not slightly warm at 8 bpp: it
  is either grey or pink.
- *The flagstone body behind live text.* With a stone frame *and* a stone
  body (`patterns.mjs` → `flagstones()`), the window has no value hierarchy:
  frame, body and the gaps between windows are all mid-light warm grey. The
  parchment body on dialogs and the movable modal is much better and should
  be the document body too (the classic engine doesn't tile bodies anyway,
  R22).
- *Widget iconography.* The shield close box reads at 1×. The portcullis zoom
  is a black blob with a grille (`castle-8x.png`, row 2) and the arrow-loop
  collapse is a dagger on a plate; neither says "bigger" or "roll up". The
  pressed shield (gold on blue) is the one pressed state in the four schemes
  that is clearly a different state, so keep that idea.
- *Narrow windows.* In `preview-sizes.png` and the classic
  `02a-narrow-zoom@4x.png` the two 26 px towers and the gatehouse eat most of
  a 160 px window and the title plate collapses to "Sys…". `frameLayout`
  already drops code-10 cells; the towers could be code 10 with a plain
  merlon corner behind them for windows under about 220 px.

| # | Change | Where | Why |
|---|---|---|---|
| 1 | Rebuild the stone: 6 px courses, 14 px blocks, **two** block tones ≥ 12 units apart, mortar two steps darker than the block (not `#615b52`), a lit top row on about half the blocks, a shaded right end on a third, no speckle. Keep `periodX` behaviour. | `stone.mjs` → `ashlar()`; `patterns.mjs` → `flagstones()` for the body | Surfaces instead of outlines; survives 8 bpp (both tones land on one grey, the mortar on the next). Mockup: `../authoring/experiments/design-review/mockup-castle-stone.png`. |
| 2 | Light the towers with solid bands, not dither: a 1 px `stoneHi` column inside the outline on the lit side, a 2–3 px `stoneLo` band on the far side; mirror for the right tower *or* keep both lit from the left but add a 2 px shade on the wall where it meets the left tower. | `frames.mjs` → `towerLight()` and `paintTower()` | One light direction for the whole frame; a 1 px solid highlight reads at 1× where a dithered 22 % band doesn't. |
| 3 | Pick stone and moss colours on or very near system-palette entries (`#999999`/`#aaaaaa` greys with `#bbbbbb` highlights and `#777777` shade; moss `#669966` rather than `#5a6b33`) and cut the mix steps that fall between cells. | `palette.mjs` → `C.active.stone*`, `C.active.moss`; the `mix(...)` calls in `ashlar()` | Kills the pink/green chroma noise in `classic/desktop@2x.png`. Run the palette report (section 3.4) after. |
| 4 | Make the document body parchment (the 16×16 mottle already in `patterns.mjs` → `parchment()`), reserve flagstones for the Finder background if anywhere. | `patterns.mjs` → `build()` (which ppat `-9551`/`-9550` name) | Gives the window a light interior against a mid-grey frame; live text stops fighting joints. |
| 5 | Redraw zoom and collapse as 12 px pixel glyphs on a plain stone plate: zoom = a small square with a larger square outline (a "window" opening), collapse = a horizontal bar with a chevron above (a drawbridge going up). Keep the shield for close. | `widgets.mjs` → `drawZoom()`, `drawCollapse()` | Legibility of function beats legibility of ornament for the two widgets people hunt for. |
| 6 | Towers as code-10 cells with a plain crenellated corner behind them, so windows under ~220 px shed the towers before they shed the title. | `frames.mjs` → `spec()` (top edge cells) | `preview-sizes.png` "Keep" and the classic narrow capture. |

### 1.3 Brickworks (`authoring/schemes/brickworks/`)

**What works.** This is the most legible of the four at 1× and the best at
8 bpp (`classic/desktop@2x.png` could be a 1998 scheme). The reasons are
instructive: a hard 1 px dark outline on the whole silhouette
(`frames.mjs` → `outline()`), one gloss row and one seam row per brick with a
flat body between them (`bodyRows()`), primary colours that sit near cube
entries, a white title tile that gives the engine's bitmap title a clean
plate, and the scroll thumb is a red 2×1 brick, which is the best piece of
widget iconography in the set. The studs along the bar in 12 px runs tile
without a visible seam at any width (`preview-sizes.png`, "A wide window").

**What doesn't.**

- *The dithered sheen on fixed blocks.* `drawBlock()` paints a Bayer-dithered
  sheen over the left 25 % and shade over the right 20 % of every corner
  block, and `drawStud()` dithers a five-stop gradient across a 6 px stud.
  At 1× the yellow corners look dirty (`../authoring/experiments/design-review/brick-8x.png`, top)
  and at 8 bpp the dither is plainly a checkerboard
  (`brick-classic-8x.png`). The bar bricks, which have *no* dither, look
  better than the corners that do. A 6 px stud needs two colours (lit, base)
  plus a 1 px top highlight, not five.
- *Inactive is muddy.* `pal('inactive')` mixes every brick 62 % toward
  `#c9c6bf`. Red becomes a dusty pink, blue a slate, the yellow corner a
  khaki, and the title goes to 3.0:1 on the faded tile. Inactive "plastic"
  should stay plastic; drop saturation less (around 35 %) and lift value, or
  keep the hue and switch to the `grey` brick for the bar only.
- *Baseplate body behind text.* `patterns.mjs` → `baseplate()` draws a lit
  and shaded ring in every 8 px cell. It is faint, but under 13 px body text
  the ring edges line up with letter stems and make the text look rough
  (`preview.png`, "An active document window…"). Classic doesn't tile
  bodies (R22) so this is web-only; a plain `BODY` or a 4 px dot grid would
  keep the toy feel without the moiré.
- *The widgets are from a different toy.* Red/green/blue glossy spheres
  with 1.7 px smooth strokes, on a scheme that is otherwise all hard edges
  and flat colour. They read fine, but a round "1×1 round brick" (flat disc,
  one highlight pixel, 1 px glyph) would belong to the family; the current
  sphere highlight and the stroke width are the two softest things in the
  scheme.
- *Dialog and alert colours are ambiguous.* The dialog's blue bar with a
  yellow centre brick and the alert's yellow bar with a red centre brick look
  like inactive document windows at a glance because the preview shows them
  without a title and in their own hues. That is partly the preview's fault,
  but a stronger cue (the alert's `!` brick in red with a white glyph, a 2 px
  outline on the centre brick) would help.

| # | Change | Where | Why |
|---|---|---|---|
| 1 | Remove the Bayer sheen/shade from fixed blocks; use a 1 px `gloss` column inside the left seam and a 1 px `lo` column inside the right, same as `paintSides` does for the walls. | `frames.mjs` → `drawBlock()` (the `bayer(...)` branches) | Flat plastic reads as plastic; the checkerboard disappears at 8 bpp. |
| 2 | Studs: `hi` top row, `gloss` for the left 2 px, `base` for the rest, `deep` for the right 1 px, no gradient. | `frames.mjs` → `drawStud()` | Same as 1. Five colours in a 6 px stud is noise. |
| 3 | Inactive palette: `fade(b, 0.35)` and mix toward a lighter `#e4e2dc`; inactive title `#5e5b55` (≥ 4.5:1). | `palette.mjs` → `fade()`, `pal()` | Keeps hue identity per window type while clearly "behind". |
| 4 | Body pattern: a plain `BODY` fill, or a 2 px dot every 8 px, instead of 8 px rings. | `patterns.mjs` → `baseplate()` | Live text should not sit on circles. |
| 5 | Widgets as flat round bricks: `fillCircleSmooth` outline + flat face, one `gloss` pixel at (−2, −2), 1 px pixel glyphs (5×5 ×, 5 px + and −). | `widgets.mjs` → `drawWidget()` | Family consistency; crisp glyphs. |

### 1.4 Bonn (`authoring/schemes/bonn/`)

**What works.** The most considered palette of the four: sandstone bar,
city red/yellow for the pennant and the default ring, Rhine teal for the river
and the collapse box, blossom pink used sparingly. The pennant title plate
with a 1 px dark-red shadow on cream text (5.5:1) is the best title treatment
in the set, and the engine's bitmap title on it in `classic/desktop@2x.png`
looks right. The scalloped wave edge along the bottom and the two embankment
piers are a genuinely good solution to "what does the plinth do at the
corners" (`../authoring/experiments/design-review/bonn-8x.png`, row 4). The inactive state (grey
plate, dark text, grey discs) is the clearest inactive state of the four.

**What doesn't.**

- *The skyline is sub-pixel.* `skyline.mjs` draws the Minster's windows as
  single yellow pixels two rows apart, the Post Tower's floor lines as
  alternating 35 % mixes, and the trees as three overlapping smooth circles.
  At 1× (`bonn-8x.png`, row 1) the result is a dark silhouette with yellow
  noise; the only buildings that read are the pink Town Hall (flat, outlined,
  six white 1×2 windows) and the Post Tower. The Town Hall is the model: flat
  fill, one lighter roof edge, windows as 1×2 blocks on a 3 px rhythm.
- *The scrollbar is the loudest thing in the window.* Saturated red arrow
  boxes (`scrollbars.mjs` → `SB.btnTop/btnBottom`) on a cream track, next to
  a cream body and a sandstone frame. Red is the *title* colour in this
  scheme; using it for four arrow boxes per window demotes the pennant.
  The thumb's smooth sine-wave "grip" (`thumbImage()`, 1.1 px stroke) is a
  white smear at 1×.
- *Three unrelated widgets.* Close is a five-petal blossom with a pinkish
  edge (`#b5577a`), zoom a red/yellow badge with a white square, collapse a
  teal disc with a wave. Each is nice, together they are three different
  objects. The fix is small: give all three the same 13 px disc silhouette
  and the same `p.outline` rim, then put the blossom, the badge and the wave
  *inside* the disc.
- *The water bands at 8 bpp.* `paintBottom()` dithers a four-stop teal
  gradient over 8 rows with 5 levels. The classic capture
  (`bonn-classic-8x.png`, row 3) shows it as horizontal stripes of
  checkerboard; `glass1`/`water0` and `skyHi`/`glass2`/`water2`/`water3`
  collapse to two system entries. Two flat teal bands (`#339999`, `#336666`)
  with the foam dashes would look the same on the web and cleaner in classic.
- *The bar's red/yellow rule.* The 1 px red over 1 px yellow at the bottom of
  the bar is the right idea, but the yellow row is the lighter one and sits
  on the darker end of the bar gradient, so at 1× it reads as a red line with
  a light fringe. Swap to yellow over red (light on light, dark against the
  body) or add a 1 px `barLine` under both.
- *Skyline clipping and placement* are known (R16: the menu bar covers art
  above the bar in classic; `classic/menubar-clips-skyline@3x.png`). Not a
  design flaw, but it argues for keeping the skyline short (≤ 14 px above
  the bar) so the Minster spire isn't the first thing to go.

| # | Change | Where | Why |
|---|---|---|---|
| 1 | Redraw the Minster in the Town Hall's style: flat `sky` masses, a 1 px `skyHi` edge on each roof's lit side, windows as 1×2 `yellow` blocks on a 3 px rhythm (not single pixels on a 2 px rhythm), trees as a 5×5 hand-placed blob rather than three smooth circles. | `skyline.mjs` → `minster()`, `tree()`, `postTower()` | Reads at 1× and at 8 bpp; drops ~10 near-duplicate colours. |
| 2 | Arrow boxes in sandstone (`stone`/`stoneLo`) with a `red` 5 px pixel arrowhead; thumb grip as three 1 px `foam` dots or a 3 px wave on whole pixels. | `scrollbars.mjs` → `SB` colours, `paintArrow()`, `thumbImage()` | Red stays reserved for the title; grips become crisp. |
| 3 | One disc silhouette and one rim colour (`p.outline`) for all three widgets; blossom, badge and wave inside it. | `widgets.mjs` → `drawClose()` (`edge`), `drawZoom()`, `drawCollapse()` | A widget *family*, not three souvenirs. |
| 4 | Water as two flat bands plus the foam dashes; keep the scalloped `waveEdge`. | `frames.mjs` → `paintBottom()` (the `ditheredGradient` call) | Identical on web and classic; `palette.mjs` loses four teal near-duplicates. |
| 5 | Bar rule: yellow row above red row, `barLine` under. | `frames.mjs` → `paintBar()` (rows `y1 - 3`, `y1 - 2`) | The rule reads as a two-colour stripe rather than a red line with a fringe. |

---

## 2. Pixel-UI guidance for this format

### 2.1 One light, from the top left

Every corpus scheme that looks "right" uses the Macintosh convention: light
from the upper left, so top and left edges are lit and bottom and right edges
are shaded. Decide this once per scheme and apply it to **everything**:
frame bevels, blocks, studs, buttons, thumbs, tabs, the raised title plate,
the sunk track. The three failure modes seen in this review:

- *Two lights.* Castle's left and right towers are both lit from the left
  while the wall between them is flat. Brickworks' studs are lit from the
  left while brick bodies are lit from the top; that one works because the
  stud is a cylinder (left-lit) on a slab (top-lit) and both are consistent
  with upper-left light.
- *No light.* Bonn's bar is a vertical gradient with no lit edge; the frame
  reads as flat paper. Fine for paper; not fine if the piers and the title
  plate next to it are bevelled.
- *Gradient as light.* A smooth gradient is not a light source at 1×. A 1 px
  highlight row **is**. Use gradients for material (glass, water) and 1 px
  rows for form.

### 2.2 Outlines and highlights

- **Outline the silhouette, not the parts.** A 1 px dark outline around the
  whole frame (Brickworks `outline()`, Castle `outlineSilhouette()`) is what
  makes a window read on any background. Inside the silhouette, outline only
  what the eye needs to separate: the title plate, widgets, the content hole.
  Do not outline every block, stud or petal.
- **Outline colour is a dark of the material, not black.** Brickworks uses
  `#1e1712` (warm near-black), Castle `#2b2824`. Both right. `#000000` is
  only right on pure Platinum-style chrome.
- **One highlight pixel beats a dithered band.** A single `hi` row on the top
  edge and a single `hi` column on the left edge of a shape is the standard
  1990s bevel. A 22 % dithered falloff is invisible at 1× and a checkerboard
  at 8 bpp.
- **Selective highlights.** In a texture (stone, bricks, cobbles), highlight
  roughly a third to a half of the elements, chosen by hash, and leave the
  rest flat. All-highlighted equals none-highlighted.
- **Anti-aliasing: use it for curves against a known matte, never for
  strokes under 2 px.** `fillRoundRectSmooth` and `fillCircleSmooth` are
  good for button corners and discs because the blend is against real
  pixels. `strokeLineSmooth` at 1–1.7 px produces a 2–3 px grey smear with no
  solid core; every title-bar glyph, arrowhead and grip in the four schemes
  that uses it looks soft. Place glyphs on whole pixels by hand (a 5×5 ×, a
  5 px bar, a 3-row chevron) and use the stroke function only for diagonals
  wider than 2 px.
- **Rounded corners at 1×:** radius 2–4 px, drawn as a pixel stair (1-2-1)
  not a blended arc. The hard outer edge is forced by the 1-bit mask anyway
  (guide §4.5); make it look intentional.

### 2.3 Palette construction

- **Ramps per material, 3–5 steps, visibly different.** Castle's five stone
  tones are within 20 RGB units: one tone. A usable ramp has steps of 25–40
  units in value, and the extremes (`hi`, `lo`) 60+ units from the base.
  Brickworks' `brick()` records (`gloss, hi, base, lo, deep, seam`) are the
  right shape; use at most four of the six on any one surface.
- **Hue-shift the ramp.** Shadows go cooler and more saturated, highlights
  warmer and less saturated (Bonn's `water[]` does this; Castle's stone does
  not and looks like concrete). Keep the shift small enough that the 8-bit
  snap does not flip it (next point).
- **Design inside the 6×6×6 cube when the scheme must look the same in
  classic.** The system palette has 51-unit steps; a colour 20 units from a
  grey axis snaps to a *coloured* entry. `SYSTEM_PALETTE_256` is exported
  from `tools/theme-author`; check every ramp step against it and either (a)
  land each step on a distinct entry, or (b) accept that steps collapse and
  design so the collapse is harmless (Halcyon). The report in section 3.4
  does this mechanically. Warm greys are the worst case: at 8 bpp they are
  grey or pink, never "warm grey".
- **Contrast floors.** Active title ≥ 4.5:1 on its plate (all four pass);
  inactive title ≥ 3:1 and ideally 4.5:1 (Halcyon 2.4, Brickworks 3.0 fail);
  frame outline ≥ 3:1 against white and against the scheme's own body (Halcyon
  fails); button label ≥ 4.5:1 (all pass); glyph on widget ≥ 3:1. Measure
  on the on-screen colours; the engine's bitmap title is 1 px strokes, so it
  needs *more* contrast than a modern font would.
- **Colour budget.** 256 per `cicn` is generous if ramps are flat colours;
  it is gone in one frame if every edge is a smooth blend and every tone has
  three mixes. `fitPalette` saves the build but merges the rarest colours
  first, which are the deliberate 1 px highlights. Build with flat ramps so
  `fitPalette` has nothing to do.

### 2.4 Texture and live text

The web runtime tiles a `ppat` behind live DOM text (R21); classic does not
(R22). Two rules:

- **Texture contrast under text ≤ 1.15:1** between its lightest and darkest
  pixel, and no feature on a 1–2 px rhythm (letter stems are 1 px; a 1 px
  joint grid aliases with them). Bonn's petals (5 shapes per 32 px) and
  Castle's parchment are right; Brickworks' 8 px rings and Castle's flagstone
  joints are on the edge.
- **Frame texture and body texture need a value step between them.** If the
  frame is mid-grey stone, the body should be light; if the frame is light
  sandstone, the body can be cream but the bar needs a rule. A window is a
  figure on a ground; the content hole is a second figure.

### 2.5 Ornaments, tiling and size

- Put ornaments in **fixed** cells (code 1 or 10), never in a 1 px grower,
  and keep one plain column between an ornament and a grower (R8). Bonn's
  `checkTiles()` guard is a good pattern; copy it.
- Make the ornament **droppable**: code 10 cells disappear on narrow windows,
  so the title survives. Castle's towers are code 1 and win over the title in
  `preview-sizes.png` "Keep"; Bonn's skyline is code 10 and goes first.
- **Tile period vs. feature size.** A 12 px tile with a 7 px merlon and a
  5 px gap reads as a rhythm; a 12 px tile with a 7 px merlon and two 2.5 px
  half-gaps reads as a seam. Design the tile so the repeat lands in the
  *middle* of a gap.
- **Big windows amplify.** At 900 px wide the bar is 70 copies of the tile.
  Any 1 px feature per tile becomes a dotted line (Bonn's first build, R8);
  any dither becomes stripes (guide §4.5). Check `sizes.html` for every tile
  change, not just the default preview.
- **Small windows subtract.** List what each window type sheds in order
  (ornament, then the second widget, then the title end caps) and make sure
  what is left still looks like the scheme. A 160 px Castle should still be a
  castle without its towers.

### 2.6 Widget families and states

- **One silhouette, one rim, one glyph grammar** for close/zoom/collapse.
  Halcyon (three discs) and Brickworks (three spheres) are families;
  Bonn (blossom, badge, disc) and Castle (shield, arch, plate) are
  collections. Variety belongs in the *fill*, not the shape.
- **Glyphs say what the widget does.** × for close, a square or + for zoom,
  a bar or chevron for collapse. A portcullis is a nice idea for "zoom" only
  after the user knows it is the zoom box.
- **Pressed must be visibly a different state**, not a darker copy: Castle's
  shield goes gold-on-blue (good); Halcyon's close goes a slightly darker
  teal (hard to see). Invert, don't darken.
- **Inactive is a quieter version of the same object**: keep the silhouette
  and outline, drop the glyph (all four do this, correctly), lift the fill
  toward the inactive bar colour, and keep the title at ≥ 3:1. A 62 % fade
  to a single grey (Brickworks) turns every colour into the same mud; a
  per-hue desaturation keeps the window-type colour coding.
- **Push button, checkbox, radio, scroll parts, tab** should share the
  scheme's edge colour, corner radius and highlight rule. The four schemes
  all do this well for buttons and boxes; the scrollbar is where each one
  drifts (Bonn's red arrows, Halcyon's chevrons, Castle's wooden thumb on a
  flat beige track).

### 2.7 Avoiding the generated look

The tells, in the order reviewers notice them:

1. Anti-aliased strokes under 2 px (section 2.2).
2. Every element highlighted and outlined; no flat surface anywhere (Castle
   stone, Brickworks corner sheen).
3. Ramps of five near-identical tones and gradients where a 1 px highlight
   was wanted.
4. Hashed "random" variation on every pixel (speckle, grit) instead of a few
   deliberate chips.
5. Smooth circles for things that should be pixel clusters (trees, blossoms,
   studs).
6. A different idea for each widget.
7. Palettes chosen by name in sRGB rather than by eye against the system
   palette and against each other.

The opposite of each is cheap in this toolkit: `r.set` on whole pixels,
`hline`/`vline` for highlights, a 3-tone ramp, a hash that chooses *which*
block gets the chip rather than *whether each pixel* does.

---

## 3. A design workflow

What follows assumes the engine mechanics are solved (frames tile, checks
pass). Run it per scheme, and re-run steps 4–7 after any change to a tile,
a ramp or a widget.

1. **Mood board (30 minutes).** Three to five reference images of the real
   material (stone, moulded plastic, sandstone, frosted glass) and two
   corpus schemes with the same ambition (`themes/<slug>/` reference images:
   `1984`, `crayon-os`, `dolphin-som`, `animals` for ornament, `beos-r503`
   for asymmetry). Write the light direction and the one "memorable thing"
   in `scheme.mjs`'s header comment.
2. **Palette ramps.** Per material, 3–5 named steps in `palette.mjs`. Run the
   palette report (3.4): every step on its own system entry or a documented
   collapse; contrast pairs for title/active, title/inactive, label/button,
   outline/white, glyph/widget above the floors in 2.3.
3. **Key frame at 1× and 4×.** Paint the document frame first, look at it at
   1× on a white page *and* on the slate preview, then at 4×. Fix anything
   that only reads at 4×.
4. **Stress sizes.** `/authoring-preview.html?scheme=…&layout=/authoring/preview-layouts/sizes.html`.
   Look for seams in long bars, dotted lines, what a 160 px window sheds.
5. **8 bpp check.** Quantise the preview (3.4, `sim8`) and compare with the
   web. Fix chroma noise and collapsed ramps before the real-Kaleidoscope
   boot; the boot is expensive and should confirm, not discover.
6. **Family sheet.** Contact sheet of every `cicn` at 4× (3.4). Check: one
   rim colour, one radius, one highlight rule, glyphs on whole pixels, pressed
   visibly different, inactive quieter not muddier.
7. **Real Kaleidoscope.** Per `authoring-a-scheme.md` §8a. Capture desktop,
   control panel, a dialog, a narrow window and a collapsed window; put the
   `@2x` crops next to the web crops.

**Review artefacts** (what to attach to a scheme PR or keep in
`authoring/schemes/<slug>/review/` if the maintainer wants them):

- `preview.png`, `preview-sizes.png` (already produced).
- `crops-4x.png`: title bar left and right ends, a control row, the bottom
  edge, the scrollbar, at 4×.
- `sim8.png`: the preview through the 8-bit simulation.
- `cicn-sheet.png`: every image resource at 4× with its id and size.
- `palette-report.txt`: the ramp/collapse/contrast table.

**Checklist** (copy into the PR description):

- [ ] One light direction, stated in the header comment, visible on every bevel.
- [ ] Silhouette outlined; interior outlines only on plate, widgets, content hole.
- [ ] No `strokeLineSmooth` narrower than 2 px; glyphs on whole pixels.
- [ ] Each material ramp ≤ 5 steps, each step ≥ 25 units apart.
- [ ] Palette report: no unintended collapses; contrast floors met.
- [ ] Texture under live text ≤ 1.15:1, no 1–2 px rhythm.
- [ ] Ornaments in fixed/droppable cells; `sizes.html` clean at 160 px and 900 px.
- [ ] Widgets share silhouette, rim, radius; pressed is inverted, inactive is quieter.
- [ ] 8-bit simulation looks like the web preview, give or take a step.
- [ ] Classic captures match the simulation.

### 3.4 Tooling that would help (prototyped, not in the repo)

The prototypes (`sim8.py`, `palette_report.py`) are in `authoring/experiments/design-review/` and are a few dozen lines
each. If adopted they belong in `tools/theme-author/` (pure, no fs) with thin
`scripts/` wrappers, matching the existing split.

**`sim8` — 8-bit simulation of a preview.**
Prototype: `../authoring/experiments/design-review/sim8.py in.png out.png [--dpr 2] [--zoom 4]`.
Maps every pixel to the nearest `SYSTEM_PALETTE_256` entry. The prototype
quantises on-screen sRGB values; the repo version should first invert the
display transform (`srgbToStored` in `tools/theme-author/color.js`), quantise
the *stored* values (that is what classic does), then map back through
`macRgbToSrgb` for display, so the simulation matches
`classic/*.png` rather than approximating it. Output: the quantised PNG and a
count of distinct colours before/after. Suggested home:
`tools/theme-author/simulate-8bit.js` + `scripts/sim-8bit.mjs`. Proof of
value: `../authoring/experiments/design-review/sim8-vs-classic.png` (web | simulation | classic)
reproduces Castle's pink mortar, Bonn's striped water and Brickworks'
checkerboard sheen from the preview alone.

**`palette-report` — ramp, collapse and contrast table.**
Prototype: `../authoring/experiments/design-review/palette_report.py` (the colour lists are
inlined; the repo version should import `palette.mjs` directly). For each
named colour: nearest system entry, distance, and the other names that share
the entry (marked `COLLAPSE`); for each declared pair, the WCAG ratio and a
pass/fail against the floors in 2.3. A scheme would declare its pairs in
`palette.mjs` (`export const CONTRAST = [[title, plate, 'title'], …]`) so the
check runs under `npm run author`. Output from the prototype for all four
schemes is in the appendix. Suggested home: `tools/theme-author/palette-report.js`,
called from `check-scheme.js` as warnings.

**`cicn-sheet` — contact sheet of every image at 4×.**
Not prototyped (the decode path already exists in `tools/theme-loader/`;
`scripts/render-window.mjs` shows how to drive it). Input: a `scheme.rsrc` or
`scheme.bin`; output: one PNG, every `cicn` (and `ppat` tiled 3×3) at 4× on a
checkerboard, labelled with id, size and colour count, grouped by family
(frames, widgets strip, push, ring, check/radio, scroll, tabs, menus,
progress). This is the single artefact that makes "do the widgets belong to
one family" a five-second question. Suggested home: `scripts/cicn-sheet.mjs`.

A fourth, smaller one: a **`pixelGlyph(r, x, y, rows)`** helper in
`raster.js` that stamps a glyph from an array of strings (`'X...X'`), so
authors stop reaching for `strokeLineSmooth` for 5 px glyphs. It is ten lines
and would have prevented every soft glyph in this review.

---

## 4. Mockups

Both were made with Pillow (a selection is in `authoring/experiments/design-review/`); each shows 1× strips at
the bottom and 4×/8× above.

**`../authoring/experiments/design-review/mockup-castle-stone.png` — the Castle wall and left
tower, before and after, each at 1× and through the 8-bit simulation.**
*Before* is a port of `stone.mjs` → `ashlar()` with the shipped parameters
(5 px course, 12 px block, five tones, lit top and left, shaded bottom and
right, 10 % speckle) and `towerLight()`'s dithered bands. *After* is the
section 1.2 proposal: 6 px course, 14 px block, two tones, mortar two steps
darker, a lit top row on half the blocks, an occasional shaded end, no
speckle; the tower gets a 1 px solid highlight column on the left and a 3 px
solid shade band on the right, with a dark outline between tower and wall.
At 1× the *after* reads as stone courses with a round tower in front of a
wall; at 8 bpp the *before* shows the pink and olive snaps and the *after*
stays grey.

**`../authoring/experiments/design-review/mockup-halcyon-glyphs.png` — the three title-bar
widgets, as shipped (1.25 px smooth strokes) and with 5 px whole-pixel
glyphs on the same smooth disc.** The disc can stay anti-aliased; only the
strokes change. The 1× strip at the bottom is the comparison that matters.

---

## Appendix: numbers from the palette report

Nearest system-palette entry per colour (display sRGB; the repo tool should
use stored values, see 3.4). `COLLAPSE` marks names that land on one entry.

```
Castle active:   stone0/1/2/4 -> #999999 COLLAPSE   stone3 -> #888888
                 stoneHi -> #bbbbbb  stoneLo -> #777777  mortar -> #555555
                 banner0/1 -> #993333 COLLAPSE  banner2 -> #660033  bannerLo -> #550000
                 trim -> #cc9933  title -> #ffffcc
Castle inactive: stone0/1/2/4 -> #bbbbbb COLLAPSE
Brickworks:      no collapses in the red/yellow/white ramps (every step has its own entry)
Bonn active:     barTop/stoneHi/tree0 -> #ffcccc COLLAPSE   barBottom/stone -> #cccc99 COLLAPSE
                 barLine/stoneLo -> #cc9966 COLLAPSE   skyHi/glass2/water2/water3 -> #336666 COLLAPSE
                 glass1/water0 -> #669999 COLLAPSE   foam/tree2 -> #eeeeee COLLAPSE
Halcyon:         barTop/in.barTop -> #ffffff COLLAPSE   border/in.title -> #aaaaaa COLLAPSE
                 accent #1689a8 -> #009999 (shift)
```

Contrast (WCAG, on-screen colours):

| Pair | Castle | Brickworks | Bonn | Halcyon | Floor |
|---|---|---|---|---|---|
| active title on plate | 7.5 | 15.9 | 5.5 | 13.9 | 4.5 |
| inactive title on plate | 3.6 | **3.0** | 6.8 | **2.4** | 3.0 (4.5 ideal) |
| button label on face | 4.9 | 10.9 | — | 7.0 (glyph) | 4.5 |
| outline vs white | — | — | — | **2.6** / **1.7** inactive | 3.0 |
| white glyph on accent | — | — | — | 4.1 | 3.0 |

Source files for the critique: `authoring/schemes/<slug>/preview.png`,
`preview-sizes.png`, `classic/*.png`; the full real-Kaleidoscope capture sets (kept
privately); crops, mockups and prototypes in `authoring/experiments/design-review/`.
