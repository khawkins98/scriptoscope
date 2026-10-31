# Brickworks in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off).
`@2x`/`@4x`/`@6x` files are nearest-neighbour upscales. These are illustrations
that the scheme loads and draws in the real engine; they are **not** admitted
fidelity evidence. The general findings about tall frames are in
[`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | the transfer disk's window (icon view) over the desktop pattern, the arrow cursor on the desktop (2026-10-31, control-panel extras run) |
| `wide@2x.png` | the System Folder list view widened to 618 px (the earlier 2026-10-31 run) |
| `control-panel@2x.png` | the Kaleidoscope control panel with Brickworks selected: Arrow Cursor, WindowShade Sounds, Desktop Pattern and About This Scheme enabled |
| `title-plate-tiling@4x.png` | the stud row over the title plate in `wide@2x.png`, showing the seams at both plate edges |
| `corner-zoom@6x.png` | the zoom and collapse widgets at the right end of the title bar |
| `desktop-before-repaint@2x.png` | the 2026-10-30 build, before the paint-over from the concept art |
| `corner-zoom-before-redesign@6x.png` | the build before the visual design pass |
| `about@2x.png` | About This Scheme: the about box over the control panel |
| `cursor@6x.png` | the arrow cursor over the desktop pattern (crop of `desktop@2x.png`) |
| `scheme-picker@2x.png` | the Select Scheme list with the scheme icons |
| `menu-open@2x.png` | the File menu held open: the new yellow plate menu bar, red selection |

## 2026-10-31 (later): control-panel extras, menus, and the icon and desktop verified

One clean boot (fresh copies of the v16l system and transfer seeds, sound off
with `nosound true`, 8 bpp) loaded Halcyon, a test copy of Halcyon with the
accent flag set (not committed), Halcyon again, Midnight 2027, Castle,
Brickworks and Bonn in turn through **Select Scheme…**, from the transfer disk.
A second clean boot loaded the rebuilt Bonn (its cursor was changed after the
first).
`scheme.bin` sha256 `bdb0a42cf6616d31aeeb356cd5d7ae04d4329637b1384d9f9a6dcccade7ee1cd`.
`control-panel@2x.png` and `desktop@2x.png` were retaken in this run.

- **Loading:** no errors. The panel reads "Brickworks / An original
  first-party scheme for Scriptoscope, 2026".
- **Picker icon (added earlier today): verified.** The red 2×2 brick shows in
  the Select Scheme list (`scheme-picker@2x.png`), where the first run showed
  a blank icon.
- **Desktop pattern (added earlier today): verified.** The green baseplate
  with one stud per tile covers the desktop (`desktop@2x.png`).
- **Menus (new):** the menu bar is a yellow plate with a lit top row and the
  warm near-black outline; the selected title and item are red brick with
  white text; menus are white tiles in the outline (`menu-open@2x.png`).
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
- **Cursor** (`cursor@6x.png`): the red plastic arrow with a white edge, clear
  on the green baseplate and on white bodies.
- **Not intended / different:** nothing beyond the above.

## 2026-10-31: classic extras added (verified later the same day, above)

Added after the run below: the scheme picker icon (`ICN#`/`icl8`/`icl4`/
`ics#`/`ics8`/`ics4` -16455, a red 2×2 brick with four studs in three-quarter
view, drawn separately at 32×32 and 16×16) and a desktop pattern (`ppat 17`,
16×16: a muted green baseplate `#669966` with one stud per tile, rims
`#99cc99` / `#336633`, exact system-palette entries stored raw). Menus came
later the same day. Both were verified in real Kaleidoscope in the
control-panel-extras run above.

## 2026-10-31: after the paint-over

One clean boot that switched Halcyon → Castle → Brickworks → Bonn → Midnight
2027 through **Select Scheme…**. `scheme.bin` sha256
`6f4e7d0c69dbb6785a8d0b7e2fd73f8f8570ed99d49eefbf933d7ff3c884caa9`.

- **Loading:** no errors. The panel reads "Brickworks / 0.1 Brickworks
  (Scriptoscope authoring)". The scheme picker shows a **blank icon** for
  Brickworks (no scheme icon was shipped), and the menu bar and desktop stay on
  the system defaults (no menus module, no desktop pattern). The icon and the
  desktop pattern have since been added; see above.
- **The tiled stud row over the title plate: the original engine tiles it the
  same way as the web runtime.** Both were measured at the same outer widths
  (618 and 522 px) against `demo/authoring-preview.html`, by the window-relative
  x of the dark brick outlines in the stud row:
  - the row is cut into three runs at the plate edges, with a double seam at
    each edge;
  - the run left of the plate is phased so that its last whole 18 px tile ends
    at the plate's left edge, with a partial tile against the left corner
    (classic 2 px at 618, web 15 px);
  - the run over the plate starts with a 2 px piece, then whole tiles, then a
    truncated tile and a 3 px end piece before the right edge;
  - the run right of the plate starts with a whole tile at the plate's right
    edge and is cut short at the right corner.
  
  The seams land at the same offsets from the plate edges in both. The only
  difference is the plate width, which follows the title font: Chicago 12
  "System Folder" gives a 97 px plate, the web font 108 px, so the counts
  inside the plate differ. One geometry (two widths, one title); not admitted
  evidence.
- **Narrow windows:** at 153 px outer width the title is truncated to "S…" and
  still drawn; the crane overhangs the next window.
- **Other differences from the web preview** (`../preview.png`): the title is
  bitmap Chicago 12; colours sit on the 8 bpp palette levels (the reds, yellows
  and blues stay clean, no banding seen); the crane and corner brick over the
  desktop show the desktop pattern through their transparent pixels as
  expected.

## Earlier run (2026-10-30)

One clean boot; then redone after the visual design pass
(`docs/authoring-visual-design.md`). Files named `*-before-redesign*` show
that earlier build.
