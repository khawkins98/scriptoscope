# Brickworks in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off).
`@2x`/`@4x`/`@6x` files are nearest-neighbour upscales. These are illustrations
that the scheme loads and draws in the real engine; they are **not** admitted
fidelity evidence. The general findings about tall frames are in
[`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | the transfer disk's window (icon view) over the baseplate desktop |
| `wide@2x.png` | the System Folder list view widened to 618 px |
| `title-plate-tiling@4x.png` | the stud row over the title plate in `wide@2x.png`, showing the seams at both plate edges |
| `corner-zoom@6x.png` | the zoom and collapse widgets at the right end of the title bar |
| `menu-open@2x.png` | the File menu held open: yellow plate menu bar, red selection |
| `control-panel@2x.png` | the control panel with Brickworks selected: Arrow Cursor, WindowShade Sounds, Desktop Pattern and About This Scheme enabled |
| `about@2x.png` | About This Scheme over the control panel |
| `scheme-picker@2x.png` | the Select Scheme list with the scheme icons |
| `cursor@6x.png` | the arrow cursor over the desktop pattern (crop of `desktop@2x.png`) |

## 2026-10-31 (final): before PR #540

Two clean boots from fresh copies of the v16l seeds, sound off
(`nosound true`), 8 bpp; the run is described in Kingfisher's README.
`scheme.bin` sha256 `26695862812ae6c0e3e68845fbf68789a45dbd872c6f2baab67e73c3302d28db`.
Every screenshot here is from this run.

- **Loading:** no errors. The panel reads "Brickworks / An original
  first-party scheme for Scriptoscope, 2026".
- **About box:** sized to its text: the name, a one-line description and the
  credit fit with no clipping and modest margins (the layout asks for 16 px).
- **Custom-icon flag:** `hcopy -m` sets Finder flags `0x0400` on the file (read
  from the HFS catalog), and the Finder shows the red brick instead of the
  generic document.
- **Scheme picker:** the brick shows in every list. A row turns generic only
  once it has been highlighted in that list (see Castle's README).
- **Wide window** (`wide@2x.png`, 618 px, now over the baseplate desktop and
  under the themed menu bar): the stud-row seams at the plate edges
  (`title-plate-tiling@4x.png`) and the widget corner (`corner-zoom@6x.png`)
  look the same as in the earlier measurement below.
- **WindowShade sounds:** not audibly verified (sound off).

## Still true from earlier runs (2026-10-30, 2026-10-31)

- **The tiled stud row over the title plate: the original engine tiles it the
  same way as the web runtime.** Measured at 618 and 522 px outer width against
  `demo/authoring-preview.html`, by the window-relative x of the dark brick
  outlines in the stud row:
  - the row is cut into three runs at the plate edges, with a double seam at
    each edge;
  - the run left of the plate is phased so that its last whole 18 px tile ends
    at the plate's left edge, with a partial tile against the left corner
    (classic 2 px at 618, web 15 px);
  - the run over the plate starts with a 2 px piece, then whole tiles, then a
    truncated tile and a 3 px end piece before the right edge;
  - the run right of the plate starts with a whole tile at the plate's right
    edge and is cut short at the right corner.

  The only difference is the plate width, which follows the title font:
  Chicago 12 "System Folder" gives a 97 px plate, the web font 108 px. One
  geometry (two widths, one title); not admitted evidence.
- **Narrow windows:** at 153 px outer width the title is truncated to "S…" and
  still drawn; the crane overhangs the next window.
- **Other differences from the web preview** (`../preview.png`): the title is
  bitmap Chicago 12; colours sit on the 8 bpp palette levels (no banding seen);
  the crane and corner brick show the desktop through their transparent
  pixels. Menus, the About box, cursor, sounds, the desktop pattern and the
  Finder/picker icons are classic-only.
- **Still greyed in the panel:** Finder Icons (not shipped), Finder Colors (the
  panel disables it under System 7), Accent Color and Alternate Checkboxes
  (not shipped; see Kingfisher's README).
