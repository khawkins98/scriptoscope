# Brickworks in real Kaleidoscope 2.3.1

Current `refinement-*.png` captures are native 640×480, 1× visual compatibility
illustrations, **not** admitted fidelity evidence. Historical upscales and
full earlier notes remain in the
[archive](https://github.com/khawkins98/scriptoscope/tree/6c4067db5c760d617435188b5fb3e5c20a7e86d4/authoring/schemes/brickworks/classic).

## 2026-10-31 refinement compatibility run

- `scheme.rsrc` SHA-256: `2dc4d52b498a5c274ba9c285e17f001d783a87725a96683f2e25d8d0338f9de7`
- `scheme.bin` SHA-256: `7fc014bf49f69dc05b99fc8119760ea21b4b060112fa5f47322842433a310957`

Brickworks followed Castle in the
[shared fresh-seed batch](../../kingfisher/classic/README.md#2026-10-31-refinement-compatibility-run).
That record pins the System 7.5.5/Kaleidoscope 2.3.1, Basilisk II JS/WASM,
8 bpp, 640×480, 64 MB, sound-off condition, seed hashes, stopped-HFS staging
and host-stop boundary. No loader error or guest crash occurred; guest
Shutdown and audible sounds were not tested. Private frames, inputs, exact
packages and stopped media remain in `authoring-refinement-20261101-zjanp4pi`.

- Panel and About load; text fits.
- Crane, brick courses and stud row over the title draw at both widths.
  Finder and picker show the red-brick icon.
- Short/wide control-panel and Standard File buttons show the revised stud
  row. Normal Desktop/Cancel, default Select and held normal/default states
  were inspected. Labels remain readable, but studs sit close to the glyph
  tops on short classic controls.
- This covers actual native control sizes, not an exhaustive synthetic
  button-size or progress-bar matrix.

| Current capture | Observation |
|---|---|
| `refinement-desktop.png` | Wide Finder frame and desktop |
| `refinement-control-panel.png` | Selected scheme; classic options enabled |
| `refinement-about.png` | Fitted text and icon |
| `refinement-scheme-picker.png` | Native picker and short/wide buttons |
| `refinement-narrow.png` | Narrow title behavior |
| `refinement-menu-open.png` | File menu held open |
| `refinement-default-pressed.png` | Default button held |
| `refinement-normal-pressed.png` | Normal Cancel held |

## Historical build and stud-phase comparison

The archived unprefixed upscales show the October 31 pre-refinement build,
package SHA-256 `26695862812ae6c0e3e68845fbf68789a45dbd872c6f2baab67e73c3302d28db`.
It loaded without error in two fresh-seed boots; About text fitted, Finder
flags `0x0400` enabled the brick icon, and the native picker showed it except
after highlighting ([list behavior](../../castle/classic/README.md)).

At 618 and 522px outer width, window-relative dark outlines showed the same
three-run stud tiling in classic and web: double seams at the plate edges;
left 18px tiles phased to end at the plate (partial corner tile: classic
2px at 618, web 15px); plate run begins with 2px, ends with a truncated tile
and a 3px piece; right run begins whole and is clipped at the corner. Chicago
12 “System Folder” produced a 97px plate, web 108px. This is one geometry
at two widths, not admitted fidelity evidence. At 153px the title remained
“S…” and the crane overhung the neighboring window.

The historical palette showed no banding; crane/brick masks exposed the
desktop. Finder Colors is disabled under System 7; Finder Icons, Accent Color
and Alternate Checkboxes were not shipped. See
[R16](../../../../docs/authoring-exotic-frames.md#2-art-outside-the-body--irregular-silhouettes-r13r19)
for general web/classic frame differences.
