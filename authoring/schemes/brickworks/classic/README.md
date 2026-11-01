# Brickworks in real Kaleidoscope 2.3.1

Current `refinement-*.png` captures are native 640×480, 1× visual compatibility
illustrations, **not** admitted fidelity evidence. Historical upscales and
full earlier notes remain in the
[archive](https://github.com/khawkins98/scriptoscope/tree/6c4067db5c760d617435188b5fb3e5c20a7e86d4/authoring/schemes/brickworks/classic).

## Captured build and conditions

- `scheme.rsrc` SHA-256: `2dc4d52b498a5c274ba9c285e17f001d783a87725a96683f2e25d8d0338f9de7`
- `scheme.bin` SHA-256: `7fc014bf49f69dc05b99fc8119760ea21b4b060112fa5f47322842433a310957`

Tested with System 7.5.5 / Kaleidoscope 2.3.1 in Basilisk II JS/WASM,
8 bpp, 640×480, 64 MB, sound off. Exact packages were staged on stopped HFS
media, then selected through native **Select Scheme…** using fresh seed copies.
No loader error or guest crash occurred; guest Shutdown and audible sounds were
not tested. See the [shared conditions](https://github.com/khawkins98/scriptoscope/blob/19d09d5927aa2bce55b7b76a14e33576cccef2b5/authoring/schemes/kingfisher/classic/README.md#captured-build-and-conditions)
and [maintainer procedure](../../../../docs/authoring-a-scheme.md#48-test-in-real-kaleidoscope).

## Observations

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

## Earlier evidence

The [archive](https://github.com/khawkins98/scriptoscope/tree/6c4067db5c760d617435188b5fb3e5c20a7e86d4/authoring/schemes/brickworks/classic)
retains pre-refinement captures, hashes and stud-phase comparisons. At two
widths, classic and web showed the same three-run tiling structure, with
partial tiles differing around their differently sized title plates. Chicago
12 produced a narrower plate; very narrow windows truncated the title and
allowed the crane to overhang a neighboring window. These are observations
of earlier builds, not fidelity goldens.

The palette showed no banding; crane/brick masks exposed the desktop. Finder
flags `0x0400` enable the custom Finder icon; highlighted picker rows can show
generic icons ([picker observations](../../castle/classic/README.md#earlier-evidence)).
Finder Colors is disabled under System 7; Finder Icons, Accent Color and
Alternate Checkboxes were not shipped. See
[R16](../../../../docs/authoring-exotic-frames.md#2-art-outside-the-body--irregular-silhouettes-r13r19)
for general web/classic frame differences.
