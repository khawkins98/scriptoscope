# Bonn in real Kaleidoscope 2.3.1

Screenshots of `../scheme.bin` in the original Kaleidoscope 2.3.1 on System 7.5.5
(maintainers' private reference emulator, Basilisk II, 8 bpp, sound off).
`@2x`/`@3x`/`@4x`/`@6x` files are nearest-neighbour upscales. These are
illustrations that the scheme loads and draws in the real engine; they are
**not** admitted fidelity evidence. The general findings about tall frames are
in [`docs/authoring-exotic-frames.md`](../../../../docs/authoring-exotic-frames.md) R16.

| File | What it shows |
|---|---|
| `desktop@2x.png` | the transfer disk's window (icon view) over the blossom desktop: Beethoven, the Minster, the Altes Rathaus, the Post Tower and the Langer Eugen |
| `wide@2x.png` | the System Folder list view widened to 609 px |
| `narrow-title-drop@3x.png` | left: 153 px wide, title, Minster and Rathaus all gone; right: 188 px wide, "Sy…" with both landmarks back |
| `menubar-clips-skyline@3x.png` | the window dragged up to the menu bar: the whole skyline is under it |
| `water-zoom@4x.png` | the bridge and river in the bottom band |
| `menu-open@2x.png` | the File menu held open: peach bar, city-red highlight |
| `control-panel@2x.png` | the control panel with Bonn selected: Arrow Cursor, WindowShade Sounds, Desktop Pattern and About This Scheme enabled |
| `about@2x.png` | About This Scheme: the 40×48 Beethoven bust and the text |
| `scheme-picker@2x.png` | the Select Scheme list with the scheme icons (Bonn's shield) |
| `cursor@6x.png` | the arrow cursor over the desktop pattern (crop of `desktop@2x.png`) |

## 2026-10-31 (final): the new landmarks, before PR #540

Two clean boots from fresh copies of the v16l seeds, sound off
(`nosound true`), 8 bpp; the run is described in Kingfisher's README. Bonn was
loaded in boot 1.
`scheme.bin` sha256 `054cc5a44dd5951490096e6e59d83057e0c4d766bd8b0161531e335fe27ae600`.
Every screenshot here is from this run.

- **Loading:** no errors. The panel reads "Bonn / An original first-party
  scheme for Scriptoscope, 2026".
- **The new art draws as designed:**
  - the skyline reads as Bonn: the Minster's spired sandstone tower
    on the cap left of the title plate, the rose Altes Rathaus with its gilded
    stair on the cap right of it, and the Post Tower and the pale Langer Eugen
    slab on the right corner;
  - the small Beethoven bust sits on the left corner beside the blossom branch;
  - the zoom box is the shield (black cross on white over the gold lion on
    red), at 9 px still readable as a cross over a lion;
  - inactive windows draw the skyline in the grey inactive variant.
- **Picker and Finder icon:** the shield shows in the Select Scheme list and in
  the Finder. `hcopy -m` sets Finder flags `0x0400` on the file (read from the
  HFS catalog); without it, as for the corpus Apple Lisa and Crayon OS copies on
  the same disk, the Finder draws the generic document. A list row turns
  generic only once it has been highlighted (see Castle's README).
- **About box** (`about@2x.png`): the 40×48 Beethoven bust on the left, the
  text to its right: the name, a three-line description and the credit. It
  fits with no clipping and modest margins (the layout asks for 16 px).
- **Narrow windows drop the title and the cap landmarks together**, as before:
  at 153 px no plate, no Minster and no Rathaus (Beethoven, the blossom, the
  towers and the widgets stay); at 188 px the plate ("Sy…") and both come back.
- **Art above the title bar goes under the menu bar:** with the title bar
  against the menu bar the whole skyline is hidden.
- **WindowShade sounds:** not audibly verified (sound off).

## Web vs classic

- The title is bitmap Chicago 12, so the plate is narrower than on the web
  (105 px with its notches for "System Folder" against the web font's 116 px in
  the earlier measurement) and the cap landmarks sit a few pixels closer to the
  centre. The new landmarks' offsets were not re-measured against the web.
- On the 8 bpp palette the peach title bar is `#ffdab3` (web `#ffcc99`); stone
  and water keep their bands; no extra banding seen. The Finder's column-header
  band is peach.
- Menus, the About box, cursor, sounds, the desktop pattern and the
  Finder/picker icons are classic-only.
- **Still greyed in the panel:** Finder Icons (not shipped), Finder Colors (the
  panel disables it under System 7), Accent Color and Alternate Checkboxes
  (not shipped; see Kingfisher's README).

## Earlier runs (2026-10-30, 2026-10-31)

The earlier skyline (a generic cathedral and palace, a red/yellow zoom shield)
was replaced on 2026-10-31; its screenshots were all retaken above. Findings
that still hold: the cap landmarks follow the title plate to the middle of a
wide window, on the web and in classic alike; the first cursor (Rhine teal)
vanished on the teal desktop, so the cursor is the frame's near-black
`#330000` with a cream edge; collapsing and expanding with WindowShade Sounds
enabled ran without errors.
