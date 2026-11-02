# Scriptoscope Reference Native Theme in real Kaleidoscope 2.3.1

`refinement-*.png` are native 640×480, 1× compatibility illustrations, **not**
admitted fidelity evidence. They show the frosted-header build under its former
name, Kingfisher. The current source renames the scheme and About text; these
captures do not verify that revised text layout.

## Captured build and conditions

- `scheme.rsrc` SHA-256: `1b7abc936ac2cba6ea12a2f6d31ce7ddb86c00236377cedfd4c7f3175d854572`
- `scheme.bin` SHA-256: `ed557d103c0454a5993b3b61d52b0dbe234e3aa7473bd40786f4e8e0e1ba0d1b`

System 7.5.5 / Kaleidoscope 2.3.1 in Basilisk II JS/WASM, 640×480, 8 bpp,
64 MB, sound off. Exact packages were staged on stopped HFS media, then selected
through native **Select Scheme…** using fresh seed copies. No loader error or
guest crash occurred. Guest Shutdown and audible sounds were not tested.
Repeat the [maintainer procedure](../../../../docs/authoring-a-scheme.md#48-test-in-real-kaleidoscope)
for changed bytes.

## Observations

- The frosted field, white reflection and lavender/blue lower bevel draw;
  bird/ripple art retains its cleaned pixels.
- Narrow/wide Finder windows retain the title pill; Finder shortens narrow
  titles. Chicago 12 produces a narrower pill than the browser font.
- Captured About text fits. Finder and the scheme picker display the bird icon.
  Finder flags `0x0400` enable the custom Finder icon; picker icons do not need it.
- File menu, held default alert button and utility collapse widget draw.
  Switching from Apple Lisa shows the expected icon-restart notice; no restart
  was performed in this run.
- Classic alert/dialog bodies are system grey. Finder Colors is disabled under
  System 7; Finder Icons, Accent Color and Alternate Checkboxes were not shipped.

| Capture | Observation |
|---|---|
| `refinement-desktop.png` | Wide Finder composition and desktop |
| `refinement-control-panel.png` | Selected scheme; classic options enabled |
| `refinement-about.png` | Fitted text and icon |
| `refinement-scheme-picker.png` | Native picker and short/wide buttons |
| `refinement-narrow.png` | Narrow title behavior |
| `refinement-menu-open.png` | File menu held open |
| `refinement-default-pressed.png` | Default native button held |
| `refinement-utility-pressed.png` | Utility collapse held |

## Earlier evidence

Pre-frosted upscales, exact earlier hashes and full run notes remain in the
[historical archive](https://github.com/khawkins98/scriptoscope/tree/6c4067db5c760d617435188b5fb3e5c20a7e86d4/authoring/schemes/kingfisher/classic).
Those captures also document 8-bit colour shifts and highlighted native picker
rows becoming generic. They describe earlier bytes, not the current package.
