# Midnight 2027 in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off), taken
2026-10-31. `@2x`/`@3x` files are nearest-neighbour upscales of the native
640×480 frame. These are illustrations that the scheme loads and draws in the
real engine; they are **not** admitted fidelity evidence. The general findings
about tall frames are in
[`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | the transfer disk's window (icon view) over the desktop pattern, the arrow cursor on the desktop (2026-10-31, control-panel extras run) |
| `wide@2x.png` | the System Folder list view widened to 599 px (the earlier 2026-10-31 run) |
| `narrow-title-drop@3x.png` | left: 143 px wide, title, "2027" and both fireworks gone; right: 213 px wide, "Syste…", "2027" and the fireworks back |
| `about@2x.png` | About This Scheme: the about box over the control panel |
| `cursor@6x.png` | the arrow cursor over the desktop pattern (crop of `desktop@2x.png`) |
| `scheme-picker@2x.png` | the Select Scheme list with the scheme icons |
| `control-panel@2x.png` | the Kaleidoscope control panel with Midnight 2027 selected: which options are enabled |
| `menu-open@2x.png` | the File menu held open: navy menu with the gold highlight |

## 2026-10-31 (later): control-panel extras

One clean boot (fresh copies of the v16l system and transfer seeds, sound off
with `nosound true`, 8 bpp) loaded Kingfisher, a test copy of Kingfisher with the
accent flag set (not committed), Kingfisher again, Midnight 2027, Castle,
Brickworks and Bonn in turn through **Select Scheme…**, from the transfer disk.
A second clean boot loaded the rebuilt Bonn (its cursor was changed after the
first).
`scheme.bin` sha256 `74debc874b7a9b327b04a9c1f0e1e2b48d70798157d2a22d82b3d93e3995531e`.
`desktop@2x.png` was retaken in this run (the transfer disk's window, icon
view, over the starry desktop).

- **Loading:** no errors. The panel reads "Midnight 2027 / An original
  first-party scheme for Scriptoscope, 2026".
- **Enabled now:** Arrow Cursor, WindowShade Sounds, Desktop Pattern and About
  This Scheme (`control-panel@2x.png`).
- **Still greyed:** Finder Icons (not shipped), Finder Colors (the scheme ships
  the Finder colour records `cicn -9552…-9548`, but the panel's own help says
  the box is disabled under System 7, so it can't be checked on this disk),
  Accent Color (not shipped, see Kingfisher's README) and Alternate Checkboxes.
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
- **Cursor** (`cursor@6x.png`): on the night-sky desktop the navy fill merges
  with the desktop and the arrow reads as its gold outline, as intended; on
  white bodies the navy fill carries it.
- **Not intended / different:** nothing beyond the above.

## 2026-10-31: first run

One clean boot that switched Kingfisher → Castle → Brickworks → Bonn → Midnight
2027 through **Select Scheme…**. `scheme.bin` sha256
`cec8c40473c811c321af14ac29a51def044c2edad9560661229b1c9661e18ee9`.

- **Loading:** no errors. The panel reads "Midnight 2027 / 0.1 Midnight 2027
  (Scriptoscope authoring)"; the picker shows the scheme icon; the menu bar,
  menus and desktop pattern are themed. The Select Scheme dialog gets the Midnight
  dialog frame.
- **Same as the web preview** (`../preview.png`): firework, plate, "2027" and
  widget positions match the web runtime at the same outer width (599 px).
- **Narrow windows:** at 143 px outer width the title plate, "2027" and both
  fireworks are dropped; at 213 px they are all drawn ("Syste…"). The web
  runtime does the same at the same two widths ("Syst…", its font is wider).
- **8 bpp colour shifts in the fireworks.** The bursts keep their shape but
  move to the 8-bit palette: the gold burst is `#ffda54` / `#ffffda` /
  `#dab354` with `#ff87da` sparks (web `#ffcc33` / `#ffffcc` / `#cc9933` with
  `#ff66cc`). The cyan burst shows as `#54daff` / `#00b3da` /
  `#87b3da`. On screen the gold reads paler and more lemon, the pink sparks
  brighter.
- **Navy:** the frame's navy is `#00003f` and the desktop `#000054`; the
  active frame sits on a desktop of nearly the same colour, so the window
  edge is carried by the gold content outline and the starfield break.
- **Other differences from the web preview:** the title is bitmap Chicago 12,
  so the plate is narrower.
- Art above the title bar: these windows were dragged clear of the menu bar,
  so no firework is hidden in the shots; under the menu bar was not tested.
