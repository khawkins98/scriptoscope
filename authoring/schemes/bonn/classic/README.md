# Bonn in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off).
`@2x`/`@3x`/`@4x` files are nearest-neighbour upscales. These are illustrations
that the scheme loads and draws in the real engine; they are **not** admitted
fidelity evidence. The general findings about tall frames are in
[`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | System Folder list view (active, 434 px wide) over the inactive disk window: skyline, peach title bar, sandstone sides, bridge and river, themed menu bar and desktop |
| `wide@2x.png` | the same window widened to 609 px |
| `narrow-title-drop@3x.png` | left: 153 px wide, title, cathedral and palace all gone; right: 188 px wide, "Sy…" with both landmarks back |
| `menubar-clips-skyline@3x.png` | the window dragged up to the menu bar: the whole skyline is under it |
| `water-zoom@4x.png` | the bridge and river in the bottom band |
| `desktop-before-repaint@2x.png` | the 2026-10-30 build, before the paint-over from the concept art |
| `water-zoom-before-redesign@4x.png` | the build before the visual design pass |

## 2026-10-31: classic extras added, not yet verified in Kaleidoscope

Added after the run below: the scheme picker icon (`ICN#`/`icl8`/`icl4`/
`ics#`/`ics8`/`ics4` -16455, a five-petal cherry blossom with a yellow heart,
the close box's flower, drawn separately at 32×32 and 16×16). This reverses
the earlier "blank by design" decision. The desktop pattern was already there.
Built with `npm run author` (no errors) and checked in the 8-bit simulation,
but these have **not been verified in real Kaleidoscope yet**: the screenshots
and notes below predate them.

## 2026-10-31: after the paint-over

One clean boot that switched Halcyon → Castle → Brickworks → Bonn → Midnight
2027 → Bonn through **Select Scheme…**. `scheme.bin` sha256
`460f04ab07e32503047368cd07df796abb6e8623ccc5f55f52a60e9f935ad551`.

- **Loading:** no errors either time. The panel reads "Bonn / 0.1 Bonn
  (Scriptoscope authoring)". The scheme picker shows a **blank icon** (Bonn
  shipped no picker icon then; one has since been added, see above). The
  menu bar (peach with a red rule) and the blossom desktop pattern are themed.
- **The skyline on the code-6 caps beside the title: the original engine
  places it the same way as the web runtime.** Measured at the same outer
  width (609 px) against `demo/authoring-preview.html`:
  - the cathedral rides the cap left of the title plate: its left edge is
    30 px left of the plate's left edge in both (classic 221 vs plate 251;
    web 216 vs plate 246, window-relative);
  - the palace rides the cap right of the plate: its left edge is 3 px inside
    the plate's right edge in both (classic 352 vs 355; web 358 vs 361);
  - the blossom stays on the left corner and the tower on the right corner.
  
  The only difference is where the plate edges fall: Chicago 12 "System Folder"
  gives a narrower plate (105 px with its notches) than the web font (116 px),
  so both landmarks sit about 5 px closer to the centre in classic. In the
  wide window the cathedral and palace follow the title to the middle, as on
  the web.
- **Narrow windows drop the title and the cap landmarks together.** At 153 px
  outer width there is no title plate, no cathedral and no palace; only the
  blossom, the tower and the widgets are drawn. At 188 px the plate comes back
  ("Sy…") with both landmarks. The web runtime does the same at the same two
  widths (dropped at 153; a plate at 188, showing only "…" because its font is
  wider).
- **Art above the title bar goes under the menu bar.** With the title bar
  dragged up against the menu bar, the entire skyline is hidden; nothing shows
  between the menu bar and the title bar.
- **Colours:** on the 8 bpp palette the peach title bar is `#ffdab3` (web
  `#ffcc99`) and the stone and water keep their bands; no extra banding seen.
- **Other differences from the web preview** (`../preview.png`): the title is
  bitmap Chicago 12; the Finder's column-header band is peach.

## Earlier run (2026-10-30)

One clean boot; then redone after the visual design pass
(`docs/authoring-visual-design.md`). Files named `*-before-redesign*` show
that earlier build.
