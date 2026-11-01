# Kingfisher in real Kaleidoscope 2.3.1

Historical screenshots of the pre-frosted-pass build loaded in the original Kaleidoscope 2.3.1
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
| `windowshade@2x.png` | the System Folder window shaded (collapsed): only the top band is left (2026-10-31 paint-over run, before the frosted pass) |
| `utility-collapse-pressed@6x.png` | the Kaleidoscope shareware notice (a utility window): zoom box, and the collapse box held down (dark teal, from `cicn -14298`) |
| `cursor@6x.png` | the arrow cursor over the desktop pattern (crop of `desktop@2x.png`) |

## Current art revision (2026-10-31)

The current `../scheme.rsrc` has a quieter frosted header: a broad pale field,
a white upper reflection and a narrow lavender/blue lower bevel replace the
three broad colour bands. Frame geometry, title room and bird/ripple pixels
are unchanged. The decorative ASCII grids were exported losslessly to the
editable 1× PNGs in `../parts/sprites/`; that conversion alone produced an
identical resource fork.

This revision was built, loaded in the web preview and checked in the 8-bit
simulation, then recaptured in real Kaleidoscope in the refinement run below.
The older unprefixed files remain historical captures of the earlier header.

Current hashes:

- `scheme.rsrc`: `1b7abc936ac2cba6ea12a2f6d31ce7ddb86c00236377cedfd4c7f3175d854572`
- generated `scheme.bin`: `ed557d103c0454a5993b3b61d52b0dbe234e3aa7473bd40786f4e8e0e1ba0d1b`

## 2026-10-31 capture run (before the frosted pass)

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

## Earlier observations (2026-10-30, 2026-10-31; before the frosted pass)

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

## 2026-10-31 refinement compatibility run

The `refinement-*.png` files are new, native 640×480 captures of the current
build, taken at 1×. The older unprefixed captures above remain historical.
This is a visual compatibility smoke test, not admitted fidelity evidence.

One fresh boot of the immutable v16l system and transfer seeds was used for
Apple Lisa → Kingfisher → Castle → Brickworks, selected through the native
**Select Scheme…** UI. The seed's default 8 bpp condition was retained; no
depth-switch helper ran. Basilisk II JS/WASM used 64 MB, `nosound true`, and a
640×480 display. The seed's automatically reopened colour-query app was quit
before the first scheme selection. Each exact MacBinary package was staged
with `hcopy -m` while the emulator was stopped and HFS was unmounted before
boot. No scheme-load error or guest crash was observed. Sounds were not
audibly tested. The browser and media server were stopped before preparing
fresh media for the later Bonn/Midnight run; this was a host stop, not a guest
Shutdown test.

Private raw frames, browser input receipts, frozen package bytes, seed hashes
and stopped disk copies are retained in maintainer workspace
`authoring-refinement-20261101-zjanp4pi` (capture timestamps are 2026-10-31 UTC).
Seed hashes were checked unchanged after this boot. The two seeds were
`system755-after-v16l.dsk` (`1ccaa14f906abcda136ec19566d06f319b4444dee2f2533f86789fadd11257ed`)
and `transfer-v16l.dsk` (`0c03ecf688d82a76a971ab203a3953c88f30ef7e51ac3c13986528da75930b4a`).

Current source/package hashes:

- `scheme.rsrc`: `1b7abc936ac2cba6ea12a2f6d31ce7ddb86c00236377cedfd4c7f3175d854572`
- `scheme.bin`: `ed557d103c0454a5993b3b61d52b0dbe234e3aa7473bd40786f4e8e0e1ba0d1b`

- The broad frosted header and narrow lavender/blue lower bevel draw in the
  original engine; the bird and ripple retain their earlier cleaned pixels.
- The About text fits. The Finder shows the custom kingfisher icon, and the
  native picker lists all five authored scheme icons.
- Narrow and wider Finder windows retain the title pill; the narrower title
  is shortened by the native Finder. The File menu, held default alert button
  and held utility collapse widget are captured separately.
- Switching away from Apple Lisa produced the expected Folder/Trash-icon
  restart notice. Its default button was held down for the pressed capture;
  no restart was performed during this boot.

| New capture | Observation |
|---|---|
| `refinement-desktop.png` | Wider active Finder window, current frame and desktop |
| `refinement-control-panel.png` | Current scheme selected; classic options enabled |
| `refinement-about.png` | About This Scheme, text and icon |
| `refinement-scheme-picker.png` | Native Select Scheme list and short/wide buttons |
| `refinement-narrow.png` | Narrower Finder window and title behavior |
| `refinement-menu-open.png` | File menu held open |
| `refinement-default-pressed.png` | Default native button held down |
| `refinement-utility-pressed.png` | Utility collapse widget held down |
