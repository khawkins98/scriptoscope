# Midnight 2027 in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off).
`@2x`/`@3x`/`@6x` files are nearest-neighbour upscales of the native 640×480
frame. These are illustrations that the scheme loads and draws in the real
engine; they are **not** admitted fidelity evidence. The general findings
about tall frames are in
[`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | the transfer disk's window (icon view) over the starry desktop |
| `wide@2x.png` | the System Folder list view widened to 599 px |
| `narrow-title-drop@3x.png` | left: 143 px wide, title, "2027" and both fireworks gone; right: 213 px wide, "Syste…", "2027" and the fireworks back |
| `menu-open@2x.png` | the File menu held open: navy menu with the gold highlight |
| `control-panel@2x.png` | the control panel with Midnight 2027 selected: Arrow Cursor, WindowShade Sounds, Desktop Pattern and About This Scheme enabled |
| `about@2x.png` | About This Scheme over the control panel |
| `scheme-picker@2x.png` | the Select Scheme list in the Midnight dialog frame |
| `cursor@6x.png` | the arrow cursor over the desktop pattern (crop of `desktop@2x.png`) |

## 2026-10-31 (final): before PR #540

Two clean boots from fresh copies of the v16l seeds, sound off
(`nosound true`), 8 bpp; the run is described in Kingfisher's README.
`scheme.bin` sha256 `f4d5f97f5145dae3a2ae294f84336c26bd572790d13960e12edc9207d0a2c151`.
Every unprefixed screenshot in the table above is from this historical run.

- **Loading:** no errors. The panel reads "Midnight 2027 / An original
  first-party scheme for Scriptoscope, 2026".
- **About box:** sized to its text. The shortened description ("Fireworks over
  a midnight sky for New Year 2027.") fits on one line; with the name and the
  credit there is no clipping and modest margins (the layout asks for 16 px).
- **Custom-icon flag:** `hcopy -m` sets Finder flags `0x0400` on the file (read
  from the HFS catalog), and the Finder shows the firework icon instead of the
  generic document.
- **Scheme picker:** the icon shows in every list. A row turns generic only
  once it has been highlighted in that list (see Castle's README).
- **Narrow windows:** unchanged: at 143 px outer width the plate, "2027" and
  both fireworks are dropped; at 213 px they are all drawn ("Syste…"). The web
  runtime does the same at the same two widths ("Syst…", its font is wider).
- **Wide window** (599 px): firework, plate, "2027" and widget positions as in
  the earlier comparison with the web runtime at the same width.
- **WindowShade sounds:** not audibly verified (sound off).

## Web vs classic (still true from the earlier 2026-10-31 runs)

- **8 bpp colour shifts in the fireworks.** The bursts keep their shape but move
  to the 8-bit palette: the gold burst is `#ffda54` / `#ffffda` / `#dab354` with
  `#ff87da` sparks (web `#ffcc33` / `#ffffcc` / `#cc9933` with `#ff66cc`); the
  cyan burst is `#54daff` / `#00b3da` / `#87b3da`. On screen the gold reads paler
  and more lemon, the pink sparks brighter.
- **Navy:** the frame's navy is `#00003f` and the desktop `#000054`, so the
  active window's edge is carried by the gold content outline and the
  starfield break.
- **Cursor:** on the night desktop the navy fill merges with the desktop and
  the arrow reads as its gold outline, as intended; on white bodies the navy
  fill carries it.
- The title is bitmap Chicago 12, so the plate is narrower. Menus, the About
  box, cursor, sounds, the desktop pattern and the Finder/picker icons are
  classic-only.
- **Still greyed in the panel:** Finder Icons (not shipped), Finder Colors (the
  panel disables it under System 7), Accent Color and Alternate Checkboxes
  (not shipped; see Kingfisher's README).
- Art above the title bar under the menu bar was not tested for Midnight 2027.

## 2026-11-01 refinement compatibility run

The `refinement-*.png` files are new, native 640×480 captures at 1× of the
richer current scheme. The older unprefixed captures remain historical.
This is a visual compatibility smoke test, not admitted fidelity evidence.

The exact source/package hashes were verified before `hcopy -m` staging:

- `scheme.rsrc`: `bfb27ff09bb788d00a3e244f36e3d553d9439c31a8972d973165867b4b4bff4b`
- `scheme.bin`: `b4cb64c42041c81a411c3081495f5d4276ad60277e2d0ca99b5af54ef136c79d`

A fresh copy of each immutable v16l seed booted System 7.5.5 in Basilisk II
JS/WASM at the seed's default 8 bpp, 640×480, 64 MB and `nosound true`.
The automatically reopened colour-query app was quit before native
**Select Scheme…** switched Apple Lisa → Midnight 2027. This boot never
selected the earlier Bonn candidate that failed in a separate boot.
HFS operations were serialized and the volume was unmounted before boot.
The owned browser and media server were stopped before the next disk update;
this was a host stop, not a guest Shutdown test. The original seed hashes
remain those recorded in Kingfisher's refinement-run section and were
checked unchanged before each fresh copy.

Private raw frames, input receipts, frozen packages and stopped disk copies
remain in maintainer workspace `authoring-refinement-20261101-zjanp4pi`
(`midnight-passed-work/` for this boot's stopped media).

- The rich header, curved fireworks, large “2027”, gold title plate and round
  clock widgets load without a guest error. A saved window position can put
  the upper artwork under the menu bar; the complete header is shown after
  moving the window down.
- The About text and icon fit. The Finder and native picker show the custom
  firework icon. The night desktop and clock-shaped scroll thumbs draw.
- At the intermediate captured width the Finder shortens the title inside
  its gold plate. At the smaller width the title, large year and firework
  ornaments all disappear, while the clock widgets remain usable.
- Normal and default Standard File buttons were held down for separate
  captures; the document close-clock widget was also held down and cancelled
  by releasing outside it. The File menu was captured open.
- The expected Folder/Trash-icon restart notice appeared after switching
  away from Apple Lisa. No restart was performed. Sounds were not audibly
  tested. Stock Finder/control-panel dialogs did not exercise the authored
  champagne-segment progress bar, so this run makes no native progress claim.

| New capture | Observation |
|---|---|
| `refinement-desktop.png` | Wider active Finder window and complete rich header |
| `refinement-control-panel.png` | Current scheme and enabled classic options |
| `refinement-about.png` | About This Scheme text and icon |
| `refinement-scheme-picker.png` | Native picker and normal/default buttons |
| `refinement-truncated-title.png` | Intermediate width, shortened title |
| `refinement-narrow.png` | Smaller width, title/year/firework ornaments dropped |
| `refinement-menu-open.png` | File menu held open |
| `refinement-default-pressed.png` | Default Select button held down |
| `refinement-normal-pressed.png` | Normal Cancel button held down |
| `refinement-widget-pressed.png` | Close-clock widget held down |
