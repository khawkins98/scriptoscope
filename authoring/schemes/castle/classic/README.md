# Castle in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off).
`@2x`/`@6x` files are nearest-neighbour upscales of the native 640×480 frame.
These are illustrations that the scheme loads and draws in the real engine;
they are **not** admitted fidelity evidence. The general findings about tall
frames (click-through on transparent frame pixels, the menu bar covering art
above the title bar, narrow-window behaviour, 8 bpp colour shifts) are in
[`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | the transfer disk's window (icon view) over the sky desktop |
| `wide@2x.png` | the System Folder list view widened to 608 px |
| `menu-open@2x.png` | the File menu held open: stone bar, banner-red highlight |
| `control-panel@2x.png` | the control panel with Castle selected: Arrow Cursor, WindowShade Sounds, Desktop Pattern and About This Scheme enabled |
| `about@2x.png` | About This Scheme over the control panel |
| `scheme-picker@2x.png` | the Select Scheme list, opened right after switching to Castle |
| `cursor@6x.png` | the arrow cursor over the desktop pattern (crop of `desktop@2x.png`) |

## 2026-10-31 (final): before PR #540

Two clean boots from fresh copies of the v16l seeds, sound off
(`nosound true`), 8 bpp; the run is described in Kingfisher's README. Castle
was loaded twice in boot 1 and first in boot 2.
`scheme.bin` sha256 `5a22c49854fca78972e2f442ddb2cbdbf17e42ecdfca598322f83eac4b14291c`.
Every screenshot here is from this run.

- **Loading:** no errors. The panel reads "Castle / An original first-party
  scheme for Scriptoscope, 2026".
- **About box:** sized to its text: the name, a one-line description and the
  credit fit with no clipping and modest margins (the layout asks for 16 px).
- **Custom-icon flag:** `hcopy -m` sets Finder flags `0x0400` on the file (read
  from the HFS catalog), and the Finder shows the tower icon instead of the
  generic document.
- **Picker icon: positional, not Castle's, and not reproduced.** The Select
  Scheme list was opened 22 times on the transfer disk over both boots: 10
  right after a switch and 12 from a freshly opened panel, with each of the
  five schemes current at least once (Castle current 5 times). Every list
  opened with Apple Lisa, the first row, highlighted and drawn with the
  generic document icon; every other row, Castle included, showed its own
  icon (0 of 22 generic). Moving the highlight shows the rule: a row that has
  been highlighted keeps the generic icon for the rest of that list. Clicking
  Brickworks, Crayon OS, Castle and Midnight 2027 in turn left all four
  generic, and type-selecting "c" then pressing Down did the same to Castle
  and Crayon OS. This is the classic list's behaviour, the same for corpus
  and first-party schemes.
  The earlier report (Castle generic in every list opened after a switch,
  4 of 4) did not recur. That file had no custom-icon flag; the flag and the
  smaller about box are the only changes since. The flag is not needed for
  icons in the list (Apple Lisa and Crayon OS have none and Crayon OS shows
  its icon), so the old symptom is most likely the highlight rule above,
  e.g. Castle highlighted while picking a scheme, but this run can't prove
  which.
- **Wide windows** (`wide@2x.png`, 608 px): towers, flags, crenellations and the
  red plate draw as on the web, now over the sky desktop.
- **WindowShade sounds:** not audibly verified (sound off).

## Still true from earlier runs (2026-10-30, 2026-10-31)

- **Narrow windows:** at 160 px outer width (the Finder's minimum here) the
  title is truncated to "System…" and still drawn; the towers overlap the
  title band but nothing drops.
- **Differences from the web preview** (`../preview.png`): the title is bitmap
  Chicago 12, so the plate is narrower; the Finder's info bar and column-header
  band are drawn tan (`#b38754`), a strip the web preview has no equivalent
  for; colours sit on the 8 bpp palette levels, with no banding in the stone or
  the plate. Menus, the About box, cursor, sounds, the desktop pattern and the
  Finder/picker icons are classic-only.
- **Still greyed in the panel:** Finder Icons (not shipped), Finder Colors (the
  panel disables it under System 7), Accent Color and Alternate Checkboxes
  (not shipped; see Kingfisher's README).
- Art above the title bar under the menu bar was not tested for Castle.
