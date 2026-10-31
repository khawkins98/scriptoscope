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
Every screenshot here is from this run.

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
