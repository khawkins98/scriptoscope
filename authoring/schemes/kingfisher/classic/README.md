# Kingfisher in real Kaleidoscope 2.3.1

`refinement-*.png` shows the current frosted-header build at native 640×480,
1×. These are visual compatibility illustrations, **not** admitted fidelity
evidence; no golden or ledger row depends on them. Earlier upscaled captures
and their full run notes are in the
[historical archive](https://github.com/khawkins98/scriptoscope/tree/6c4067db5c760d617435188b5fb3e5c20a7e86d4/authoring/schemes/kingfisher/classic).

The current header replaces broad colour bands with a pale frosted field,
white reflection and narrow lavender/blue lower bevel. Geometry, title room
and bird/ripple pixels are unchanged. Exporting decorative grids to the
editable `../parts/sprites/*.png` alone produced an identical resource fork.

## 2026-10-31 refinement compatibility run

Current source/package SHA-256:

- `scheme.rsrc`: `1b7abc936ac2cba6ea12a2f6d31ce7ddb86c00236377cedfd4c7f3175d854572`
- `scheme.bin`: `ed557d103c0454a5993b3b61d52b0dbe234e3aa7473bd40786f4e8e0e1ba0d1b`

This shared batch booted Apple Lisa → Kingfisher → Castle → Brickworks through
native **Select Scheme…**, using fresh immutable v16l seed copies. Condition:
System 7.5.5 / Kaleidoscope 2.3.1, Basilisk II JS/WASM, 640×480, default 8 bpp,
64 MB, `nosound true`; no depth helper. The reopened colour-query app was
quit before selection. Packages were hash-checked and staged with `hcopy -m`
while stopped; HFS was unmounted before boot. No loader error or guest crash
occurred. Host browser/server stops preceded later media changes; this did
not test guest Shutdown or audible WindowShade sounds.

Private raw frames, inputs, frozen packages and stopped disks remain in
`authoring-refinement-20261101-zjanp4pi` (timestamps are October 31 UTC).
Both seed hashes were checked unchanged:

- `system755-after-v16l.dsk`: `1ccaa14f906abcda136ec19566d06f319b4444dee2f2533f86789fadd11257ed`
- `transfer-v16l.dsk`: `0c03ecf688d82a76a971ab203a3953c88f30ef7e51ac3c13986528da75930b4a`

Repeat the [maintainer procedure](../../../../docs/authoring-a-scheme.md#48-test-in-real-kaleidoscope)
for a new hash; these observations do not validate later bytes.

- The broad frosted header and lower bevel draw; bird/ripple keep their
  earlier cleaned pixels. About text fits, Finder shows the kingfisher icon,
  and the picker lists all five authored icons.
- Narrow/wide Finder windows retain the title pill; Finder shortens the
  narrow title. File menu, held default alert button and utility collapse
  widget were captured separately.
- Switching away from Apple Lisa produced the expected Folder/Trash-icon
  restart notice. Its default button was held; no restart was performed.

| Current capture | Observation |
|---|---|
| `refinement-desktop.png` | Wide Finder composition and desktop |
| `refinement-control-panel.png` | Selected scheme; classic options enabled |
| `refinement-about.png` | Fitted text and icon |
| `refinement-scheme-picker.png` | Native picker and short/wide buttons |
| `refinement-narrow.png` | Narrow title behavior |
| `refinement-menu-open.png` | File menu held open |
| `refinement-default-pressed.png` | Default native button held |
| `refinement-utility-pressed.png` | Utility collapse held |

## Historical builds and observations

The archive's unprefixed upscales show the pre-frosted build. Its package
SHA-256 was `00a17d60d8a1d0e6512d8d8dccc15b7a79dac41e46642e8993dc41c021b1f44a`.
Two fresh-seed boots selected all five schemes; the first then restarted from
Finder to expose Kingfisher's shareware notice, and the second retook menus.
All archived images except `windowshade@2x.png` are from that run; the shaded
window is from an earlier October 31 paint-over pass. Loading, renamed
“Kingfisher” labels, About fit, Finder/picker icon and utility pressed strip
`cicn -14298` were checked without load errors; sound was off.

The old 62px top band could put title/widgets under the menu bar at saved
Finder positions. Its `#d4ffff/#d4d4ff/#a8d4ff` steps appeared at
`#daffff/#dadaff/#b3daff` in 8 bpp. Chicago 12 makes narrower title pills than
the web font; classic alert/dialog bodies are system grey (`#E7E7E7`).
The original white-on-white tab-pane labels were fixed and rechecked.

Finder flags `0x0400` enabled custom Finder icons; picker icons did not need
that flag. Highlighted picker rows became generic in the native Standard File
list. Finder Colors is disabled
under System 7; Finder Icons, Accent Color and Alternate Checkboxes were not
shipped. A historical `Colr 129` byte-3 experiment enabled the fixed-name
Accent popup but changed no visible modern-family menu art; it was not shipped
([control-panel extras](../../../../docs/authoring-a-scheme.md#72-control-panel-extras)).
