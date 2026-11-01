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
Every unprefixed screenshot in the table above is from this historical run.

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

- `scheme.rsrc`: `2dc4d52b498a5c274ba9c285e17f001d783a87725a96683f2e25d8d0338f9de7`
- `scheme.bin`: `7fc014bf49f69dc05b99fc8119760ea21b4b060112fa5f47322842433a310957`

- The panel and About box load without error; the About text fits.
- The crane, frame brick courses and stud row above the title draw at both
  captured widths. The Finder and picker show the custom red-brick icon.
- Native short/wide control-panel and Standard File buttons show the revised
  stud row. Normal Desktop/Cancel, default Select and held normal/default
  states were inspected. Their labels remain readable, although the studs
  sit close to the tops of the glyphs on these short classic controls.
- These screenshots cover actual control-panel/Standard File sizes, not an
  exhaustive synthetic button-size or progress-bar matrix.

| New capture | Observation |
|---|---|
| `refinement-desktop.png` | Wider active Finder window, current frame and desktop |
| `refinement-control-panel.png` | Current scheme selected; classic options enabled |
| `refinement-about.png` | About This Scheme, text and icon |
| `refinement-scheme-picker.png` | Native Select Scheme list and short/wide buttons |
| `refinement-narrow.png` | Narrower Finder window and title behavior |
| `refinement-menu-open.png` | File menu held open |
| `refinement-default-pressed.png` | Default native button held down |
| `refinement-normal-pressed.png` | Normal native Cancel button held down |
