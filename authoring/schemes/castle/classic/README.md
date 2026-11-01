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
Every unprefixed screenshot in the table above is from this historical run.

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

- `scheme.rsrc`: `5f3080458325200015549c2b53145baa33f1ee4f291644fc7eb16641b6e2ab6b`
- `scheme.bin`: `5420a108ea7cc1a166707147bbaf0372a90355f64596c1bccc0bca92e48097cf`

- The panel and About box load without error; the About text fits.
- The revised plain body pattern is visible in the control panel. Finder icon
  windows still use the Finder's own body treatment.
- The tower/merlon frame and red title banner draw at both captured widths;
  the File menu, picker icons and held default Select button are captured.

| New capture | Observation |
|---|---|
| `refinement-desktop.png` | Wider active Finder window, current frame and desktop |
| `refinement-control-panel.png` | Current scheme selected; classic options enabled |
| `refinement-about.png` | About This Scheme, text and icon |
| `refinement-scheme-picker.png` | Native Select Scheme list and short/wide buttons |
| `refinement-narrow.png` | Narrower Finder window and title behavior |
| `refinement-menu-open.png` | File menu held open |
| `refinement-default-pressed.png` | Default native button held down |
