# Kingfisher in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` loaded in the original Kaleidoscope 2.3.1
control panel on System 7.5.5. They were taken in the maintainers' private
reference emulator (Basilisk II, 8 bpp, sound off; see
[`docs/maintainer-reference-environment.md`](../../../../docs/maintainer-reference-environment.md)).
The `@2x`/`@6x` files are nearest-neighbour upscales of the native 640×480
frame. They are illustrations that the scheme loads and draws in the real
engine, **not** admitted fidelity evidence (no reference-intake review, 8 bpp
palette condition); no golden or ledger row depends on them.

| File | What it shows |
|---|---|
| `desktop@2x.png` | the transfer disk's window (icon view) over the desktop pattern; the five first-party schemes show their own icons |
| `menu-open@2x.png` | the Finder's File menu held open: teal title and item highlight |
| `control-panel@2x.png` | the control panel with Kingfisher selected: Arrow Cursor, WindowShade Sounds, Desktop Pattern and About This Scheme enabled |
| `about@2x.png` | About This Scheme over the control panel |
| `scheme-picker@2x.png` | the Select Scheme list with the scheme icons |
| `dialog@2x.png` | the stock "different Folder and Trash icons … restart" alert, with Kingfisher's alert frame and default ring |
| `windowshade@2x.png` | the System Folder window shaded (collapsed): only the top band is left (2026-10-31 paint-over run; art unchanged since) |
| `utility-collapse-pressed@6x.png` | the Kaleidoscope shareware notice (a utility window): zoom box, and the collapse box held down (dark teal, from `cicn -14298`) |
| `cursor@6x.png` | the arrow cursor over the desktop pattern (crop of `desktop@2x.png`) |

## 2026-10-31 (final): before PR #540

Two clean boots, each from fresh copies of the v16l system and transfer seeds,
sound off (`nosound true`), 8 bpp. The five schemes were copied to the transfer
disk with `hcopy -m`. Boot 1 switched Apple Lisa → Kingfisher → Castle →
Brickworks → Bonn → Midnight 2027 → Castle → Brickworks → Kingfisher through
**Select Scheme…**, then restarted from the Finder (same disk copies) to get the
shareware notice under Kingfisher. Boot 2 switched Apple Lisa → Castle →
Brickworks → Midnight 2027 → Kingfisher and retook the File menu shots.
`scheme.bin` sha256 `00a17d60d8a1d0e6512d8d8dccc15b7a79dac41e46642e8993dc41c021b1f44a`.
Every file in the table above except `windowshade@2x.png` is from this run.

- **Loading:** no errors in either boot. Switching from Apple Lisa brought up
  the Folder/Trash restart alert, as before (Apple Lisa ships Finder icons).
- **Name (renamed from Halcyon):** "Kingfisher" everywhere: the file name on
  disk and in the Select Scheme list, the panel's name line ("Kingfisher / An
  original first-party scheme for Scriptoscope, 2026"), and the About box.
- **About box:** sized to its text. The name, the two-line description and the
  credit fit with no clipping and modest margins (the layout asks for 16 px);
  the spare band under the text is gone.
- **Custom-icon flag:** `hcopy -m` carries it. The file's catalog record on the
  disk copy has Finder flags `0x0400` (read from the HFS catalog; `hls -l`
  doesn't show flags). The Finder now shows Kingfisher's own icon
  (`desktop@2x.png`); Apple Lisa and Crayon OS, copied without the flag
  (`0x0000`), show the generic document icon. The Select Scheme list shows
  the scheme icons with or without the flag (Crayon OS shows its own there).
- **Scheme picker:** see Castle's README for the icon test. In short, a row is
  drawn with the generic document icon once it has been highlighted in that
  list; nothing scheme-specific.
- **Pressed utility widgets** (`utility-collapse-pressed@6x.png`): holding the
  collapse box on a utility window draws the scheme's utility strip
  (`cicn -14298`) in classic, as R24 describes.
- **WindowShade sounds:** not audibly verified (sound off).

## Still true from earlier runs (2026-10-30, 2026-10-31)

- **Art above the title bar goes under the menu bar.** The top band is 62 px;
  the title strip is its top ~20 px. Windows that open at their saved Finder
  positions near the top put that strip under the menu bar, leaving only the
  lower half of the kingfisher and no title or close box. Dragging the visible
  lower band moves the window.
- **Colours:** the title band's flat steps (`#d4ffff`/`#d4d4ff`/`#a8d4ff`) show
  at the 8 bpp levels (`#daffff`/`#dadaff`/`#b3daff`), with no extra banding.
- **Differences from the web preview** (`../preview.png`): the title is bitmap
  Chicago 12, so the title pill is narrower. Menus, the About box, cursors,
  sounds, the desktop pattern and the Finder/picker icons are classic-only
  (the web runtime doesn't draw them). A plain alert/dialog body is the
  system dialog grey `#E7E7E7`; the web now uses the same colour (#585).
- **Still greyed in the panel:** Finder Icons (not shipped), Finder Colors (the
  panel disables it under System 7 whatever the scheme ships), Accent Color
  and Alternate Checkboxes (not shipped).
- **Accent Color experiment (not shipped):** a copy with only `Colr 129`
  byte 3 ("Has accent colors") set enabled the Accent Color popup. Its names
  are fixed by the control panel (`MENU -14334`, Lavender … Teal, one `clut`
  300–318 each). Choosing Gold changed nothing visible, because the menu
  highlights are the scheme's own `cicn`s; the per-accent art ids that Apple
  Platinum 2 ships (`cicn -12287…`, `-10223…`) aren't decoded for the newer
  `-12240` menu family. Shipping the flag would offer a popup that does nothing.
- **2026-10-30:** the first complete build drew tab-pane labels white on white;
  fixed and confirmed in a later boot.
