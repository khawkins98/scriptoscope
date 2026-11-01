# Bonn in real Kaleidoscope 2.3.1

**Current build:** `ribbon-*.png` shows the final direct-concept art, 26 px
custom widgets and added horizontal title-ribbon padding. Exact current
hashes are in the final section below. `extracted-*.png` preserves the same
art/widgets before the padding change; unprefixed and `refinement-*.png`
files record still earlier builds.

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
Every unprefixed screenshot in the table above is from this historical run.

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

## 2026-11-01 earlier redrawn rich-scene compatibility run

The `refinement-*.png` files are new, native 640×480 captures at 1× of the
earlier redrawn rich-scene revision. Older unprefixed captures remain historical.
These are visual compatibility illustrations, not admitted fidelity evidence.

Verified source/package hashes:

- `scheme.rsrc`: `54a36e880d35d12bac497fc61f1d89e820dad3be95e372750786c74919d45c3e`
- `scheme.bin`: `72f8a54e3c2198b58b047a03d3da6a687eb084cd505b59df58248b3146b74f12`

A fresh copy of each immutable v16l seed booted System 7.5.5 in Basilisk II
JS/WASM at the seed's default 8 bpp, 640×480, 64 MB, `nosound true`; no depth
helper ran. The automatically reopened colour-query app was quit before
native **Select Scheme…** switched Apple Lisa → Bonn. Exact frozen packages
were staged with `hcopy -m` while stopped, then HFS was unmounted before boot.
The owned browser and server were stopped before the final HFS export; this
was a host stop, not a guest Shutdown test. All five exported resource forks
matched the frozen source bytes. Immutable seed hashes remained unchanged.

Private raw captures, input logs, source/package bytes, stopped media and
export receipts remain in maintainer workspace
`authoring-refinement-20261101-zjanp4pi` (`work/` is this successful Bonn boot's
stopped media). Seed identities are recorded in Kingfisher's refinement-run
section. No public build or CI accesses this private workspace.

- The complete 110 px skyline, continuous forest canopy, Minster, Rathaus,
  fixed Post Tower, broad piers and 120 px Rhine bridge load and draw without
  a guest error. Moving saved Finder windows down reveals artwork initially
  covered by the menu bar.
- The About box fits Beethoven's icon, the three-line description and credit.
  The Finder and native picker show the scheme's custom shield icon.
- At the intermediate captured width the red title ribbon carries an ellipsis
  between the Minster and Rathaus caps. At the smallest captured width the
  title and both caps disappear; the fixed Post Tower and widgets remain.
  The bridge still fits the smaller bottom band.
- Normal and default Standard File buttons and the document close rosette
  were held down for separate captures. The File menu was also captured.
- Switching away from Apple Lisa produced the expected Folder/Trash-icon
  restart notice. No restart was performed and sounds were not audibly tested.

### Preserved unsuccessful candidate

The earlier rich candidate (`scheme.rsrc`
`1cd0d4095dcb26b794734a1cc9bcabc6cfd3b4c815fcfce4428c22078384ab99`,
`scheme.bin` `b5cb46d0fdb9b1740694653aeea70333ab7ec3b8cfb747914b81335576efc993`)
showed a blank guest System error bomb dialog after native selection in a
separate fresh-seed boot. No text/error ID rendered after settling, and no
host JS error was reported. Its raw frames and stopped disks are preserved
privately with `bonn-failure.json`; it is not counted as a successful load.

The tested correction keeps the full skyline height and palette but reduces
the canopy source period from 72 px to 24 px, shrinking the document template
from 468×193 to 324×193 and its 8-bit colour plane from 90,324 to 62,532 bytes.
That corrected candidate passed this run. The observation supports this
specific compatibility fix; it does not establish a universal 64 KiB limit
for Kaleidoscope or prove the bomb's internal cause. A height-only candidate
was prepared but never staged or booted.

| New capture | Observation |
|---|---|
| `refinement-desktop.png` | Wider Finder window, full skyline and bridge |
| `refinement-control-panel.png` | Current Bonn selected and classic options enabled |
| `refinement-about.png` | Beethoven and fitted description/credit |
| `refinement-scheme-picker.png` | Native picker and normal/default buttons |
| `refinement-truncated-title.png` | Intermediate width, ellipsis on the ribbon |
| `refinement-narrow.png` | Smaller width, title/Minster/Rathaus caps dropped |
| `refinement-menu-open.png` | File menu held open |
| `refinement-default-pressed.png` | Default Select button held down |
| `refinement-normal-pressed.png` | Normal Cancel button held down |
| `refinement-widget-pressed.png` | Close-rosette widget held down |

## 2026-11-01 direct-concept art and 26 px widgets (before ribbon padding)

The `extracted-*.png` files are new native 640×480, 1× captures of the final
approved direct-concept build, including the extracted bridge. They are
visual compatibility smoke-test illustrations, not admitted fidelity evidence.

Exact tested source/package identities:

- `scheme.rsrc`: **608,096 bytes**, SHA-256 `41e25b00e794eccd879c3fcb8436d309b086454f2a2773c4bb739cc673a0cb54`
- generated `scheme.bin`: **608,256 bytes**, SHA-256 `9e081f5cc302c4543dfc72e475ebc1ab02ef82874ab160f486e30b13fe09c875`

This was a new isolated boot from fresh immutable v16l seed copies, separate
from all earlier redraw/probe runs. The MacBinary hash was checked before
`hcopy -m` import; the HFS volume was unmounted before boot. System 7.5.5 ran
in the retained Basilisk II JS/WASM environment at the seed's default 8 bpp,
640×480, 64 MB, `nosound true`, with no depth-switch helper. The seed's
reopened colour-query app was quit before native **Select Scheme…** switched
Apple Lisa → Bonn. No source pixels or package bytes changed during the run.

The owned browser and media server were stopped before ordinary HFS export.
The exported resource fork matched all 608,096 frozen bytes and the SHA-256
above exactly. Immutable seed hashes remained unchanged; HFS was unmounted
and the operational lock released. This was a host stop, not a guest Shutdown
test. Sound was off, so WindowShade sounds were not audibly tested.
Private raw frames, input receipts, exact package bytes, stopped disks and
export verification are retained in maintainer workspace
`authoring-bonn-extracted-20261101-suabgp2z`. The older rejected native-grid
26 px-widget build remains privately preserved in
`authoring-bonn-controls-20261101-9ceutvdl`; it was not substituted for this run.

Observed in the real engine:

- The approved concept-cropped Minster, Rathaus, Post Tower and cherry bough
  render with their source silhouettes, warm masonry colours and facade/roof
  details. The repeated canopy remains a background behind the landmarks.
- The actual concept bridge draws as a broad arch. Its binary-transparent
  opening exposes the painted turquoise river and glints beneath it, rather
  than an opaque backdrop or black rectangle. The bridge and river continue
  to fit after narrowing and widening the Finder window.
- The document close rosette, zoom shield and collapse wave are 26×26 px live
  widgets. Each was held separately: its custom pressed state stays aligned
  with its normal art and has no opaque rectangular corner box. The utility
  notice's matching 26 px close rosette was also held separately.
- A probe at the utility close square's transparent corner entered native
  title/background drag tracking instead of pressing the rosette. The mouse
  was released at the same point, so the notice was not relocated by the probe.
  This is an observed native hit result, not a general browser hit-mask claim.
- At the intermediate narrow width the title text disappears while both
  landmark caps remain. At the smaller width the title/caps disappear and
  the fixed bough, Post Tower and custom widgets remain. The wider title
  stays separate from the caps and the large right-hand widget group.
- Clicking the collapse wave shades the document window to its full
  decorative header. Its pressed state also renders while collapsed, and
  clicking again restores the body, river and bridge.
- The About description and Beethoven icon fit. The native picker shows the
  custom shield icon. The expected Folder/Trash-icon restart notice appeared
  when switching away from Apple Lisa; no restart was performed.
- Saved window positions can put the tall artwork under the menu bar. The
  Finder window was moved down for the full-header view. The taller control
  panel has less free screen space and is shown for its title/options; the
  Finder view is the complete composition reference.

| Current capture | Observation |
|---|---|
| `extracted-desktop.png` | Full active Finder composition, extracted landmarks/bough/bridge and river opening |
| `extracted-control-panel.png` | Current scheme selected and enlarged custom widgets |
| `extracted-about.png` | Fitted About text and Beethoven icon |
| `extracted-scheme-picker.png` | Native Select Scheme and custom shield icon |
| `extracted-narrow-title.png` | Narrow title loss while landmark caps remain |
| `extracted-narrow-caps-dropped.png` | Smaller width, title and caps dropped |
| `extracted-document-close-pressed.png` | Custom close rosette held down |
| `extracted-document-zoom-pressed.png` | Custom shield zoom held down |
| `extracted-document-collapse-pressed.png` | Custom wave collapse held down |
| `extracted-utility-close-pressed.png` | Matching utility close rosette held down |
| `extracted-utility-transparent-corner-held.png` | Transparent-corner native hit probe |
| `extracted-collapsed.png` | Shaded document retains the decorative header |
| `extracted-collapsed-pressed.png` | Collapse wave pressed while shaded |

## 2026-11-01 current ribbon-padding check

The small `ribbon-*.png` set is the current native result, at 640×480 and 1×.
It follows the complete `extracted-*` run above: concept pixels, document
source geometry and the custom 26 px widgets are unchanged. The ribbon's
horizontal tail/padding was increased from 6 px to 12 px, including the
utility cap source width.

Exact current tested identities:

- `scheme.rsrc`: **611,456 bytes**, SHA-256 `cb095128e4be560473cbf66055e898f669bc8c9935fe1da94f57c34aad55eaa8`
- generated `scheme.bin`: **611,584 bytes**, SHA-256 `0976f1177169d2fc9de28113277ebbf823fecd457309b8c06f136fdd281617bf`

A new fresh-seed System 7.5.5/Kaleidoscope 2.3.1 boot used the same retained
Basilisk II condition: native 640×480, seed-default 8 bpp, 64 MB, sound off,
no depth helper. The exact package hash was checked before stopped-HFS
`hcopy -m` staging; HFS was unmounted before boot. The seed's reopened
colour-query app was quit before native Select Scheme switched Apple Lisa
to Bonn. No loader error or guest crash was observed.

The normal Finder title now has visible breathing room on both sides before
the notches. The narrower Finder view shortens the title and keeps that gap.
The document close rosette and utility close rosette both render their
pressed states. The available utility shareware notice has no caption, so
this native check covers its cap geometry/pressed close, not a titled utility
text-padding assertion. The prior broader extracted-art run remains the
record for landmarks/bridge, masks, other widgets and collapse/restore.

After stopping the owned browser and server, the ordinary HFS export matched
all 611,456 frozen resource-fork bytes and the current SHA-256 above. HFS was
unmounted, immutable seed hashes checked unchanged and the operational lock
released. The stop was at the host, not a guest Shutdown test. Sound remained
off. Raw frames, input receipts, package bytes, stopped media and export
verification are preserved privately in
`authoring-bonn-ribbon-20261101-mfs433sj`; previous runs remain unchanged.
This is visual compatibility smoke testing, not admitted fidelity evidence.

| Current capture | Observation |
|---|---|
| `ribbon-desktop.png` | Full normal Finder composition and padded title ribbon |
| `ribbon-narrow.png` | Shortened title retains space before the notches |
| `ribbon-document-close-pressed.png` | Current document close rosette held down |
| `ribbon-utility-close-pressed.png` | Current utility close rosette held down |
