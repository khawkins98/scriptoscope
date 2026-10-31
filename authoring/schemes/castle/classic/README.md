# Castle in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off).
`@2x` files are nearest-neighbour upscales of the native 640×480 frame. These are
illustrations that the scheme loads and draws in the real engine; they are
**not** admitted fidelity evidence. The general findings about tall frames
(click-through on transparent frame pixels, the menu bar covering art above the
title bar, narrow-window behaviour, 8 bpp colour shifts) are in
[`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | the transfer disk's window (icon view) over the desktop pattern, the arrow cursor on the desktop (2026-10-31, control-panel extras run) |
| `wide@2x.png` | the System Folder list view widened to 608 px (the earlier 2026-10-31 run) |
| `about@2x.png` | About This Scheme: the about box over the control panel |
| `cursor@6x.png` | the arrow cursor over the desktop pattern (crop of `desktop@2x.png`) |
| `scheme-picker@2x.png` | the Select Scheme list with the scheme icons |
| `control-panel@2x.png` | the Kaleidoscope control panel with Castle selected: which options are enabled |
| `menu-open@2x.png` | the File menu held open: stone bar, banner-red highlight |

## 2026-10-31 (later): control-panel extras, and the desktop verified

One clean boot (fresh copies of the v16l system and transfer seeds, sound off
with `nosound true`, 8 bpp) loaded Halcyon, a test copy of Halcyon with the
accent flag set (not committed), Halcyon again, Midnight 2027, Castle,
Brickworks and Bonn in turn through **Select Scheme…**, from the transfer disk.
A second clean boot loaded the rebuilt Bonn (its cursor was changed after the
first).
`scheme.bin` sha256 `ac6051f59f389d8aaac95e481baf835dc90c9e579d99f447e56cca646a00dac8`.
`desktop@2x.png` was retaken in this run (the transfer disk's window, icon
view).

- **Loading:** no errors. The panel reads "Castle / An original first-party
  scheme for Scriptoscope, 2026".
- **Desktop pattern (added earlier today): verified.** The flat sky with pale
  wisps tiles the whole desktop (`desktop@2x.png`), and the panel's Desktop
  Pattern box is enabled.
- **Enabled now:** Arrow Cursor, WindowShade Sounds, Desktop Pattern and About
  This Scheme (`control-panel@2x.png`). The 2026-10-31 note below said About
  This Scheme was enabled before Castle shipped an about box; the screenshots
  from that run can't confirm it, so treat that line as unverified.
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
- **Cursor** (`cursor@6x.png`): the banner-red arrow with a parchment edge,
  clear on the sky and on window bodies.
- **Picker icon flicker (not understood):** Castle's row in the Select Scheme
  list was drawn with the generic document icon in every list opened right
  after a scheme switch in the same panel session (4 of 4, in both boots,
  including one where Castle was never loaded), and with the tower in every
  list opened from a freshly opened panel (3 of 3). No other scheme's row did
  this. `scheme-picker@2x.png` shows the tower.
- **Not intended / different:** nothing else.

## 2026-10-31: classic extras added (verified later the same day, above)

Added after the run below: a desktop pattern (`ppat 17`, 64×64: flat sky
`#6699cc` with a sparse grain of pale `#99cccc` wisps, exact system-palette
entries stored raw). The picker icon was already there. Verified in real
Kaleidoscope in the control-panel-extras run above.

## 2026-10-31: after the paint-over

Taken in one clean boot that switched Halcyon → Castle → Brickworks → Bonn →
Midnight 2027 through **Select Scheme…**. `scheme.bin` sha256
`8478d29fdd697abf4f31f7b6e1cdf82eea6abd33556789866e5037133668b262`.

- **Loading:** no errors. The panel reads "Castle / 0.2 Castle (Scriptoscope
  authoring)"; About This Scheme is enabled; the picker shows the scheme icon.
- **Same as the web preview** (`../preview.png`): tower, flag and crenellation
  placement, the red title plate, the widget positions and the moat strip.
- **Narrow windows:** at 160 px outer width (the Finder's minimum here) the
  title is truncated to "System…" and still drawn; the towers overlap the
  title band but nothing drops.
- **Differences from the web preview:**
  - the title is bitmap Chicago 12, so the plate is narrower than the web one;
  - the Finder's info bar and column-header band are drawn tan
    (`#b38754`), a strip the web preview has no equivalent for;
  - the desktop stays the system grey: Castle ships no desktop pattern
    (`Desktop Pattern` is greyed in the panel; one has since been added,
    see above);
  - colours sit on the 8 bpp palette levels (e.g. cream body, tan header);
    no banding was visible in the stone or the title plate.
- Art above the title bar: these windows were dragged clear of the menu bar,
  so nothing is hidden in the shots. Castle under the menu bar was not
  re-tested in this run.

## Earlier run (2026-10-30)

One clean boot; then redone after the visual design pass
(`docs/authoring-visual-design.md`). The screenshots of those earlier builds
were removed when the scheme was repainted from its concept.
