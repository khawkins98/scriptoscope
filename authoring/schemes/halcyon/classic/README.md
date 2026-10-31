# Halcyon in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` loaded in the original Kaleidoscope 2.3.1
control panel on System 7.5.5. They were taken in the maintainers' private
reference emulator (Basilisk II, 8 bpp, sound off; see
[`docs/maintainer-reference-environment.md`](../../../../docs/maintainer-reference-environment.md)).
The `@2x` files are nearest-neighbour upscales of the native 640×480 frame.

| File | What it shows |
|---|---|
| `desktop@2x.png` | the transfer disk's window (icon view) over the desktop pattern, the arrow cursor on the desktop (2026-10-31, control-panel extras run) |
| `menu-open@2x.png` | the Finder's File menu held open: teal title and item highlight |
| `control-panel@2x.png` | the Kaleidoscope control panel with Halcyon selected: Arrow Cursor, WindowShade Sounds, Desktop Pattern and About This Scheme enabled; the navy cursor on the desktop |
| `dialog@2x.png` | the stock "different Folder and Trash icons … restart" alert, with Halcyon's alert frame and default ring |
| `windowshade@2x.png` | the System Folder window shaded (collapsed): only the top band is left |
| `utility-collapse-pressed@6x.png` | **older art** (2026-10-30 build); not re-shot on 2026-10-31 |
| `about@2x.png` | About This Scheme: the about box over the control panel |
| `cursor@6x.png` | the arrow cursor over the desktop pattern (crop of `desktop@2x.png`) |
| `scheme-picker@2x.png` | the Select Scheme list with the scheme icons |

## 2026-10-31 (later): control-panel extras

One clean boot (fresh copies of the v16l system and transfer seeds, sound off
with `nosound true`, 8 bpp) loaded Halcyon, a test copy of Halcyon with the
accent flag set (not committed), Halcyon again, Midnight 2027, Castle,
Brickworks and Bonn in turn through **Select Scheme…**, from the transfer disk.
A second clean boot loaded the rebuilt Bonn (its cursor was changed after the
first).
`scheme.bin` sha256 `800d6cd94f49f00bfcf763f6a7767193587835bd5e1c381f7b82003aa69ef8d1`.
`control-panel@2x.png`, `desktop@2x.png` and `menu-open@2x.png` were retaken in
this run.

- **Loading:** no errors. The panel now reads "Halcyon / An original
  first-party scheme for Scriptoscope, 2026" (`STR# -14320`; before, it showed
  the `vers` string).
- **Enabled now:** Arrow Cursor, WindowShade Sounds, Desktop Pattern and About
  This Scheme (`control-panel@2x.png`).
- **Still greyed:** Finder Icons (not shipped), Finder Colors (the scheme ships
  the Finder colour records `cicn -9552…-9548`, but the panel's own help says
  the box is disabled under System 7, so it can't be checked on this disk),
  Accent Color (not shipped, see below) and Alternate Checkboxes.
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
- **Cursor** (`cursor@6x.png`): the navy arrow with a white edge, clear on the
  lavender desktop and on white window bodies. The 1-bit fallback is the
  standard arrow.
- **Desktop and menus:** `desktop@2x.png` is the transfer disk's window (icon
  view) over the desktop pattern; `menu-open@2x.png` the File menu with Get
  Info highlighted. No change from the earlier run.
- **Accent Color experiment (not shipped):** a copy of Halcyon with only
  `Colr 129` byte 3 ("Has accent colors") set enabled the Accent Color popup.
  Its names are fixed by the control panel itself (`MENU -14334`: Lavender,
  Gold, Emerald … Teal, one `clut` 300–318 each; a scheme can only replace the
  colours behind those names). Choosing Gold changed nothing visible: the menu
  title and item highlights stayed Halcyon's teal, because they are the
  scheme's own `cicn`s. The panel's help says accents recolour selected menu
  items, progress bars and scroll thumbs "in certain schemes such as Apple
  platinum", and Apple Platinum 2 ships per-accent art for exactly those
  (e.g. `cicn -12287…-12280` "Menu Highlight: Lavender…", `-10223…`
  "Progress Bar: …"). That per-accent id scheme isn't decoded for the newer
  `-12240` menu family, so shipping the flag would offer a popup that does
  nothing.
- **Not intended / different:** nothing beyond the above.

## 2026-10-31: after the paint-over

One clean boot that loaded Halcyon, Castle, Brickworks, Bonn and Midnight 2027
in turn through **Select Scheme…** (fresh copies of the v16l seeds, sound off).
`scheme.bin` sha256 `3b8bf9c9d6cf866b57c5576d8e091a024042f8dfdb01299f8e65a3b304fa6526`.

- **Loading:** no errors. The panel reads "Halcyon / 0.2 Halcyon (Scriptoscope
  authoring)"; About This Scheme is greyed (no about box shipped). The scheme
  picker shows Halcyon's icon. Closing the panel after switching from Apple
  Lisa brought up the Folder/Trash icon restart alert (`dialog@2x.png`).
- **Art above the title bar goes under the menu bar.** The top band is 62 px,
  and the title strip (close box, title, zoom/collapse) is the top ~20 px of it.
  Windows that open at their saved Finder positions put that strip under the
  menu bar: the control panel and both Finder windows opened with only the
  kingfisher's lower half and the lavender/blue band showing, and no title or
  close box. Dragging the visible lower band moves the window, which is how
  these shots were set up.
- **Title bar colours:** the web art already stores the band as flat steps
  (`#d4ffff`/`#d4d4ff`/`#a8d4ff`, alternate rows), and the 8 bpp screen shows
  the same steps at its own levels (`#daffff`/`#dadaff`/`#b3daff`). No extra
  banding or dithering beyond that.
- **Still different from the web preview** (`../preview.png`):
  - a plain alert/dialog body is the system dialog grey `#E7E7E7` under the
    frame's white top band; the web runtime filled it white at the time (since
    fixed: the web now uses the same dialog colour, #585);
  - the title is bitmap Chicago 12, narrower than the web font, so the title
    pill is narrower;
  - Finder icons, cursors, sounds, Finder Colors and Accent Color stay on the
    system defaults (not shipped).

These are illustrations that the generated file is a valid, complete scheme.
They are **not** admitted fidelity evidence (no reference-intake review, 8 bpp
palette condition), and no golden or ledger row depends on them.

## Earlier runs (2026-10-30)

- **Loading:** the first run (frames, buttons and checkboxes only) loaded in
  one boot with no errors, and a Windows 95 control run behaved the same.
- **Complete scheme:** it also loaded in one boot. It exposed one bug: tab-pane
  labels were drawn white on white. A final boot confirmed the fix.
- **Open question then:** a faint white band under the inactive window's bottom
  edge in the desktop shot, unexplained (not seen in the 2026-10-31 shots).
- After the visual design pass (`docs/authoring-visual-design.md`) the shots
  were redone from one clean boot per scheme.
