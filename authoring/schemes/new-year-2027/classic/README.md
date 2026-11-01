# Midnight 2027 in real Kaleidoscope 2.3.1

Current `refinement-*.png` captures are native 640×480, 1× visual compatibility
illustrations, **not** admitted fidelity evidence. Earlier upscaled captures
and their complete notes remain in the
[archive](https://github.com/khawkins98/scriptoscope/tree/6c4067db5c760d617435188b5fb3e5c20a7e86d4/authoring/schemes/new-year-2027/classic).

## Captured build and conditions

Exact source/package hashes were verified before `hcopy -m` staging:

- `scheme.rsrc`: `bfb27ff09bb788d00a3e244f36e3d553d9439c31a8972d973165867b4b4bff4b`
- `scheme.bin`: `b4cb64c42041c81a411c3081495f5d4276ad60277e2d0ca99b5af54ef136c79d`

Tested with System 7.5.5 / Kaleidoscope 2.3.1 in Basilisk II JS/WASM,
8 bpp, 640×480, 64 MB, sound off. Exact packages were staged on stopped HFS
media, then selected through native **Select Scheme…** using fresh seed copies.
Guest Shutdown and audible sounds were not tested. See the
[shared conditions](https://github.com/khawkins98/scriptoscope/blob/19d09d5927aa2bce55b7b76a14e33576cccef2b5/authoring/schemes/kingfisher/classic/README.md#captured-build-and-conditions)
and repeat the [maintainer procedure](../../../../docs/authoring-a-scheme.md#48-test-in-real-kaleidoscope)
for changed bytes.

## Observations

- Rich header, curved fireworks, large “2027”, gold plate and clock ornaments
  load without guest error. A saved position can hide upper art under the
  menu bar; moving the window down reveals the complete header.
- About text/icon fit; Finder/picker show the firework icon. Night desktop
  and clock-shaped scroll thumbs draw.
- Intermediate width shortens the title inside its plate; smaller width
  removes title, year and fireworks while widgets remain usable.
- Normal/default Standard File buttons and document close widget were held
  separately; close was cancelled by releasing outside. File menu was opened.
- The expected Folder/Trash-icon restart notice followed switching away from
  Apple Lisa; no restart. Stock Finder/panel dialogs did **not** exercise the
  champagne-segment progress art, so this run makes no native progress claim.

| Current capture | Observation |
|---|---|
| `refinement-desktop.png` | Wide Finder window and complete header |
| `refinement-control-panel.png` | Selected scheme; classic options enabled |
| `refinement-about.png` | Fitted text and icon |
| `refinement-scheme-picker.png` | Native picker and normal/default buttons |
| `refinement-truncated-title.png` | Intermediate shortened title |
| `refinement-narrow.png` | Title/year/fireworks dropped |
| `refinement-menu-open.png` | File menu held open |
| `refinement-default-pressed.png` | Default Select held |
| `refinement-normal-pressed.png` | Normal Cancel held |
| `refinement-widget-pressed.png` | Document close held |

## Historical build and palette observations

The archive's unprefixed upscales show the smaller October 31 build, package
SHA-256 `f4d5f97f5145dae3a2ae294f84336c26bd572790d13960e12edc9207d0a2c151`.
Two clean v16l boots loaded it without errors. About text fitted; `hcopy -m`
set Finder flags `0x0400` and its custom icon appeared. Highlighted picker rows
became generic as described in [Castle's record](../../castle/classic/README.md).
At 143px outer width title/year/fireworks vanished; at 213px all returned
with “Syste…” (web “Syst…”); the wider measured view was 599px.

Historical 8 bpp colours: gold `#ffda54/#ffffda/#dab354` and pink `#ff87da`
(web `#ffcc33/#ffffcc/#cc9933`, pink `#ff66cc`); cyan
`#54daff/#00b3da/#87b3da`. Frame navy was `#00003f`, desktop `#000054`.
The cursor's gold outline read against navy; its dark fill read on white.
Chicago 12 narrows the title plate. Finder Colors is disabled under System 7;
Finder Icons, Accent Color and Alternate Checkboxes were not shipped.
Above-bar clipping was not tested in that earlier run; the current run
observed it. General differences are in
[R16](../../../../docs/authoring-exotic-frames.md#2-art-outside-the-body--irregular-silhouettes-r13r19).
