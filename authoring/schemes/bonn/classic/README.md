# Bonn in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off).
`@2x`/`@3x`/`@4x` files are nearest-neighbour upscales. These are illustrations
that the scheme loads and draws in the real engine; they are **not** admitted
fidelity evidence. The general findings about tall frames are in
[`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | the transfer disk's window (icon view) over the desktop pattern, the arrow cursor on the desktop (2026-10-31, control-panel extras run) |
| `wide@2x.png` | the System Folder list view widened to 609 px (the earlier 2026-10-31 run) |
| `narrow-title-drop@3x.png` | left: 153 px wide, title, cathedral and palace all gone; right: 188 px wide, "Sy…" with both landmarks back |
| `menubar-clips-skyline@3x.png` | the window dragged up to the menu bar: the whole skyline is under it |
| `water-zoom@4x.png` | the bridge and river in the bottom band |
| `about@2x.png` | About This Scheme: the about box over the control panel |
| `cursor@6x.png` | the arrow cursor over the desktop pattern (crop of `desktop@2x.png`) |
| `scheme-picker@2x.png` | the Select Scheme list with the scheme icons |
| `control-panel@2x.png` | the Kaleidoscope control panel with Bonn selected: which options are enabled |
| `menu-open@2x.png` | the File menu held open: peach bar, city-red highlight |

## 2026-10-31 (later): control-panel extras, and the picker icon verified

One clean boot (fresh copies of the v16l system and transfer seeds, sound off
with `nosound true`, 8 bpp) loaded Halcyon, a test copy of Halcyon with the
accent flag set (not committed), Halcyon again, Midnight 2027, Castle,
Brickworks and Bonn in turn through **Select Scheme…**, from the transfer disk.
A second clean boot loaded the rebuilt Bonn (its cursor was changed after the
first).
The screenshots are from the second boot, of the final build: `scheme.bin`
sha256 `557faccc42dcd949596840d2fe8adaa65c0c659f31b6d32174301e0f434e1514`.
(The first boot loaded `e63c30700969534700f77a38f1fcc28e62e9d6497217a7eb2fa26cefb318485d`,
which differs only in the cursor colours.) `desktop@2x.png` was retaken (the
transfer disk's window, icon view).

- **Loading:** no errors in either boot. The panel reads "Bonn / An original
  first-party scheme for Scriptoscope, 2026".
- **Picker icon (added earlier today): verified.** The cherry blossom shows in
  the Select Scheme list (`scheme-picker@2x.png`), where the first run showed
  a blank icon.
- **Enabled now:** Arrow Cursor, WindowShade Sounds, Desktop Pattern and About
  This Scheme (`control-panel@2x.png`).
- **Still greyed:** Finder Icons (not shipped), Finder Colors (the scheme ships
  the Finder colour records `cicn -9552…-9548`, but the panel's own help says
  the box is disabled under System 7, so it can't be checked on this disk),
  Accent Color (not shipped, see Halcyon's README) and Alternate Checkboxes.
- **About box** (`about@2x.png`): the scheme's dialog frame, the picker icon
  (`cicn 128`) and the text. A click anywhere closes it. The text is drawn in
  the panel's small application font, not the Chicago 12 the box was sized
  for, so there is spare room under the text.
- **WindowShade sounds:** not audibly verified (sound off). Collapsing and
  expanding a window with the sounds enabled ran without errors (tried on
  Bonn).
- **Scheme picker** (`scheme-picker@2x.png`): the Select Scheme list shows each
  scheme's icon. A highlighted row is always drawn with the generic document
  icon, for every scheme including Apple Lisa, so the shot highlights another
  row.
- **Cursor: changed after the first boot.** The first build's Rhine-teal
  arrow with a cream edge all but vanished on the teal blossom desktop. The
  final cursor is the frame's near-black outline colour (`#330000`) with the
  cream edge (`cursor@6x.png`), clear on the desktop and on window bodies.
- **Collapse/expand:** clicking the collapse box shaded and restored the
  transfer disk's window with the sounds enabled (first boot), no errors.
- **Not intended / different:** the cursor, as above.

## 2026-10-31: classic extras added (verified later the same day, above)

Added after the run below: the scheme picker icon (`ICN#`/`icl8`/`icl4`/
`ics#`/`ics8`/`ics4` -16455, a five-petal cherry blossom with a yellow heart,
the close box's flower, drawn separately at 32×32 and 16×16). This reverses
the earlier "blank by design" decision. The desktop pattern was already there.
Verified in real Kaleidoscope in the control-panel-extras run above.

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
(`docs/authoring-visual-design.md`). The screenshots of those earlier builds
were removed when the scheme was repainted from its concept.
