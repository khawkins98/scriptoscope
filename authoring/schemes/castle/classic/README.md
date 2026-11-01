# Castle in real Kaleidoscope 2.3.1

Current `refinement-*.png` captures are native 640×480, 1× visual compatibility
illustrations, **not** admitted fidelity evidence. Historical upscales and
full earlier notes remain in the
[archive](https://github.com/khawkins98/scriptoscope/tree/6c4067db5c760d617435188b5fb3e5c20a7e86d4/authoring/schemes/castle/classic).

## 2026-10-31 refinement compatibility run

- `scheme.rsrc` SHA-256: `5f3080458325200015549c2b53145baa33f1ee4f291644fc7eb16641b6e2ab6b`
- `scheme.bin` SHA-256: `5420a108ea7cc1a166707147bbaf0372a90355f64596c1bccc0bca92e48097cf`

Castle was selected between Kingfisher and Brickworks in the
[shared fresh-seed batch](../../kingfisher/classic/README.md#2026-10-31-refinement-compatibility-run).
That record pins the System 7.5.5/Kaleidoscope 2.3.1, Basilisk II JS/WASM,
8 bpp, 640×480, 64 MB, sound-off condition, seed hashes, stopped-HFS staging
and host-stop boundary. No loader error or guest crash occurred; guest
Shutdown and audible sounds were not tested. Private frames, inputs, exact
packages and stopped media remain in `authoring-refinement-20261101-zjanp4pi`.

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

## Historical build and picker-icon investigation

The archived unprefixed upscales show the October 31 pre-refinement build,
package SHA-256 `5a22c49854fca78972e2f442ddb2cbdbf17e42ecdfca598322f83eac4b14291c`.
Castle loaded twice in fresh-seed boot 1 and first in boot 2 without errors.
About text fitted; Finder flags `0x0400` enabled its custom tower icon.
Wide view was 608px; at 160px outer width the title remained as “System…”,
towers overlapped the title band and nothing dropped.

**Picker rows, not a Castle-specific icon failure:** 22 list opens across
both boots (10 after switching, 12 from a freshly opened panel; Castle
current five times) always gave Castle its icon unless its row had been
highlighted. Every list began with Apple Lisa highlighted/generic; visited
rows retained a generic icon for that list, by mouse or keyboard. The older
4/4 report of generic Castle icons did not recur. The custom-icon flag and
smaller About box were the only file changes, but picker icons did not need
the flag (Crayon OS lacked it and showed its icon). Thus the highlight rule
explains the symptom plausibly; the earlier cause was not proven.

Historical differences: Chicago 12 narrows the plate; Finder info/column
headers were tan `#b38754`; stone/plate showed no 8 bpp banding. Finder Colors
is disabled under System 7; Finder Icons, Accent Color and Alternate
Checkboxes were not shipped. Above-bar menu clipping was not tested for
Castle. General frame differences are in
[R16](../../../../docs/authoring-exotic-frames.md#2-art-outside-the-body--irregular-silhouettes-r13r19).
