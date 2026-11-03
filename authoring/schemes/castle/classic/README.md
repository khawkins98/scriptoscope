# Castle in real Kaleidoscope 2.3.1

Current `refinement-*.png` captures are native 640×480, 1× visual compatibility
illustrations, **not** admitted fidelity evidence. Historical upscales and
full earlier notes remain in the
[archive](https://github.com/khawkins98/scriptoscope/tree/6c4067db5c760d617435188b5fb3e5c20a7e86d4/authoring/schemes/castle/classic).

## Captured build and conditions

- `scheme.rsrc` SHA-256: `5f3080458325200015549c2b53145baa33f1ee4f291644fc7eb16641b6e2ab6b`
- `scheme.bin` SHA-256: `5420a108ea7cc1a166707147bbaf0372a90355f64596c1bccc0bca92e48097cf`

Tested with System 7.5.5 / Kaleidoscope 2.3.1 in Basilisk II JS/WASM,
8 bpp, 640×480, 64 MB, sound off. Exact packages were staged on stopped HFS
media, then selected through native **Select Scheme…** using fresh seed copies.
No loader error or guest crash occurred; guest Shutdown and audible sounds were
not tested. See the [shared conditions](https://github.com/khawkins98/scriptoscope/blob/19d09d5927aa2bce55b7b76a14e33576cccef2b5/authoring/schemes/kingfisher/classic/README.md#captured-build-and-conditions)
and [maintainer procedure](../../../../docs/authoring-a-scheme.md#48-test-in-real-kaleidoscope).

## Observations

- Panel and About load; text fits.
- The revised plain body pattern is visible in the panel; Finder icon windows
  retain Finder's own body treatment.
- Tower/merlon frame and red banner draw at both captured widths. File menu,
  picker icons and held default Select button were inspected.

| Current capture | Observation |
|---|---|
| `refinement-desktop.png` | Wide Finder frame and desktop |
| `refinement-control-panel.png` | Selected scheme; classic options enabled |
| `refinement-about.png` | Fitted text and icon |
| `refinement-scheme-picker.png` | Native picker and short/wide buttons |
| `refinement-narrow.png` | Narrow title behavior |
| `refinement-menu-open.png` | File menu held open |
| `refinement-default-pressed.png` | Default native button held |

## Earlier evidence

The [archive](https://github.com/khawkins98/scriptoscope/tree/6c4067db5c760d617435188b5fb3e5c20a7e86d4/authoring/schemes/castle/classic)
retains pre-refinement captures, hashes and full run notes. Repeated picker
checks found that highlighted rows lose their custom icon for that list;
this was not a Castle-specific load failure. Finder flags `0x0400` enable the
custom Finder icon, but picker icons do not require the flag.

Chicago 12 produces a narrower title plate than the browser font. Finder
Colors is disabled under System 7; Finder Icons, Accent Color and Alternate
Checkboxes were not shipped. Above-bar menu clipping was not tested. See
[R16](../../../../docs/authoring-exotic-frames.md#2-art-outside-the-body--irregular-silhouettes-r13r19)
for general web/classic frame differences.
