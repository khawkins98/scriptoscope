# Bonn in real Kaleidoscope 2.3.1

**Current:** `ribbon-*.png` tests direct-concept art, 26 px window widgets and
increased title-ribbon padding. The earlier `extracted-*` run covers the same
art/widgets more broadly; `refinement-*` and unprefixed images are historical.
Current and broader extracted-art captures remain here; older images and full
notes are in the [historical archive](https://github.com/khawkins98/scriptoscope/tree/6c4067db5c760d617435188b5fb3e5c20a7e86d4/authoring/schemes/bonn/classic).
These are compatibility illustrations, **not** admitted fidelity evidence or goldens.

The November runs used fresh immutable v16l seed copies: System 7.5.5,
Kaleidoscope 2.3.1, Basilisk II JS/WASM, 640×480, default 8 bpp, 64 MB,
`nosound true`, no depth helper. Packages were hash-checked before stopped-HFS
`hcopy -m` staging; HFS was unmounted before boot. The reopened colour-query
app was quit before Select Scheme switched Apple Lisa → Bonn. Stops were at
the host, not guest Shutdown tests; sounds were not audibly verified.
Seed identities are in [Kingfisher's run record](../../kingfisher/classic/README.md#2026-10-31-refinement-compatibility-run).
Repeat the [maintainer procedure](../../../../docs/authoring-a-scheme.md#48-test-in-real-kaleidoscope);
[tall-frame findings](../../../../docs/authoring-exotic-frames.md#2-art-outside-the-body--irregular-silhouettes-r13r19)
explain menu-bar clipping and web/classic differences.

## Current ribbon-padding check — 2026-11-01

- `scheme.rsrc`: **611,456 bytes**, SHA-256 `cb095128e4be560473cbf66055e898f669bc8c9935fe1da94f57c34aad55eaa8`
- generated `scheme.bin`: **611,584 bytes**, SHA-256 `0976f1177169d2fc9de28113277ebbf823fecd457309b8c06f136fdd281617bf`

This new isolated boot follows the broader extracted-art run below. Concept
pixels, document source geometry and 26 px widgets are unchanged; horizontal
ribbon tail/padding increased from 6 px to 12 px, including utility cap width.
No loader error or guest crash occurred.

The Finder title has breathing room before both notches; a narrower view
shortens the title and keeps that gap. Document and utility close rosettes
render their pressed states. The available utility shareware notice has no
caption, so this check covers cap geometry/pressed close, **not** titled-utility
text padding. The broader run below covers other widgets, masks and collapse.

After host stop, HFS export matched all frozen resource bytes and the hash
above. HFS was unmounted, immutable seed hashes checked unchanged and the
operational lock released. Private raw frames, input receipts, package bytes,
stopped media and export verification remain in
`authoring-bonn-ribbon-20261101-mfs433sj`; previous runs remain unchanged.

| Current 1× capture | Observation |
|---|---|
| `ribbon-desktop.png` | Complete composition and padded title ribbon |
| `ribbon-narrow.png` | Shortened title retains space before notches |
| `ribbon-document-close-pressed.png` | Document close rosette held |
| `ribbon-utility-close-pressed.png` | Utility close rosette held |

## Broader direct-concept / 26 px-widget run — 2026-11-01

These native 1× captures precede the padding change and must not be presented
as captures of the current bytes.

- `scheme.rsrc`: **608,096 bytes**, SHA-256 `41e25b00e794eccd879c3fcb8436d309b086454f2a2773c4bb739cc673a0cb54`
- generated `scheme.bin`: **608,256 bytes**, SHA-256 `9e081f5cc302c4543dfc72e475ebc1ab02ef82874ab160f486e30b13fe09c875`

A separate fresh-seed boot held these bytes unchanged throughout. After host
stop, ordinary HFS export matched all 608,096 bytes and the hash above;
immutable seeds remained unchanged and the operational lock was released.
Raw frames, inputs, exact packages, stopped media and export verification are
private in `authoring-bonn-extracted-20261101-suabgp2z`. The older rejected
native-grid 26 px-widget build remains separately preserved in
`authoring-bonn-controls-20261101-9ceutvdl`; it was not substituted for this run.

Observed:

- Extracted Minster, Rathaus, Post Tower and bough retain their silhouettes,
  roof/facade detail and warm masonry; canopy stays behind them.
- The concept bridge's transparent arch shows painted river/glints rather
  than an opaque backdrop. Bridge and river fit narrow and wide windows.
- Each 26×26 document rosette, shield and wave was held separately. Pressed
  masks match normal art without rectangular corners; utility close also fits.
- Holding a transparent corner of the utility close square entered native
  title/background drag tracking, not rosette press. Release at the same
  point left the notice unmoved. This is one native hit observation, not a
  general browser hit-mask claim.
- At intermediate width title text disappears while landmark caps remain;
  smaller still, title/caps disappear while bough, Post Tower and widgets stay.
- Collapse retains the decorative header and its pressed wave; restoring
  brings back body, river and bridge.
- About text/Beethoven fit; picker shows the shield. Switching away from
  Apple Lisa produced the expected Folder/Trash-icon restart notice; no restart.
- Finder was moved down to reveal artwork under the menu bar. The taller
  control panel shows title/options; Finder is the complete composition view.

| Earlier 1× capture | Observation |
|---|---|
| `extracted-desktop.png` | Landmarks, bough, bridge and river opening |
| `extracted-control-panel.png` | Selected scheme and custom widgets |
| `extracted-about.png` | Fitted text and Beethoven icon |
| `extracted-scheme-picker.png` | Native picker and custom shield icon |
| `extracted-narrow-title.png` | Title loss while caps remain |
| `extracted-narrow-caps-dropped.png` | Smaller width, title/caps dropped |
| `extracted-document-close-pressed.png` | Rosette held |
| `extracted-document-zoom-pressed.png` | Shield held |
| `extracted-document-collapse-pressed.png` | Wave held |
| `extracted-utility-close-pressed.png` | Utility rosette held |
| `extracted-utility-transparent-corner-held.png` | Native transparent-corner hit probe |
| `extracted-collapsed.png` | Shaded decorative header |
| `extracted-collapsed-pressed.png` | Wave pressed while shaded |

## Earlier builds

- **2026-10-31, unprefixed upscales:** two clean boots (Bonn in boot 1),
  `scheme.bin` SHA-256 `054cc5a44dd5951490096e6e59d83057e0c4d766bd8b0161531e335fe27ae600`.
  Loaded without error; shield appeared in Finder/picker with Finder flags
  `0x0400`; the 40×48 Beethoven About icon and text fitted. At 153 px outer
  width title/Minster/Rathaus vanished, returning at 188 px with “Sy…”.
  This older drawing also had the Langer Eugen and small Beethoven ornament.
- **2026-11-01, `refinement-*`:** earlier redrawn 110 px skyline and 120 px
  bridge, before concept extraction. Resource SHA-256
  `54a36e880d35d12bac497fc61f1d89e820dad3be95e372750786c74919d45c3e`;
  package SHA-256 `72f8a54e3c2198b58b047a03d3da6a687eb084cd505b59df58248b3146b74f12`.
  Loaded; About/icon, narrowing, held normal/default buttons and close, and
  open File menu were checked. All five exported forks matched their frozen
  source bytes. Private receipts/media: `authoring-refinement-20261101-zjanp4pi`
  (`work/`); the `refinement-*` filename suffixes identify these views.
- Still earlier generic cathedral/palace art was replaced. The first teal
  cursor vanished against its desktop and became near-black with a cream
  edge. WindowShade collapse/restore ran without error; sound was off.

Historical comparisons found a narrower Chicago 12 title plate (105 px with
notches for “System Folder”, web 116 px); new landmark offsets were not
remeasured. The peach bar appeared `#ffdab3` (web `#ffcc99`) with no extra
banding. Finder Colors is disabled under System 7; Finder Icons, Accent Color
and Alternate Checkboxes were not shipped. Highlighted picker rows becoming
generic follow the list behavior documented in [Castle's record](../../castle/classic/README.md).

The archive retains the older upscaled desktop/wide, title-drop, menu-bar
clipping, river close-up, menu/panel, About/picker and cursor views, plus the
superseded `refinement-*` set. The current folders retain only the broader
`extracted-*` and final `ribbon-*` evidence.

## Preserved unsuccessful candidate

An earlier rich redraw failed after native selection with a blank System-error
bomb; no text/error ID or host JS error appeared. Resource SHA-256
`1cd0d4095dcb26b794734a1cc9bcabc6cfd3b4c815fcfce4428c22078384ab99`;
package SHA-256 `b5cb46d0fdb9b1740694653aeea70333ab7ec3b8cfb747914b81335576efc993`.
Raw frames/stopped disks and `bonn-failure.json` remain privately preserved;
this is not counted as a successful load.

The successful refinement above kept height/palette but reduced canopy
period 72→24 px: source template 468×193→324×193 and 8-bit colour plane
90,324→62,532 bytes. This supports that specific fix, **not** a universal
64 KiB limit or a proven internal cause. A height-only probe was prepared
but never staged or booted.
