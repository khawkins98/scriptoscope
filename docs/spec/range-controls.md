# Range controls: scroll bars, sliders, progress bars

This records what the 2.3.1 kDEF establishes about range-control resource
selection, what the runtime does with it, and what stays unknown. It backs the
rule table in `tests/rendering-options/range-rules.mjs`. Nothing here is a
geometry, colour or native-pixel claim.

## Scroll-bar selection (2.3.1 decode)

kDEF 0, SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`,
second CDEF main `0x8d36` (service-handler slot 5). File offsets. The rows are
read from the local disassembly and cited by address; they are not executed or
shipped. ControlRecord offsets are Inside Macintosh's: contrlRect +8, hilite +17,
value +18, min +20, max +22.

- Scroll state bytes (0x9f7a–0x9fd6, 0xada2, 0xa01c–0xa030): blob byte47 (inactive) is set for hilite 254, and for hilite 255 when Gestalt('appr') succeeds and GetSuperControl's parent is not active; byte20 (disabled) is set for hilite >= 254 or min == max (0xada2; read through the local helpers 0x996c/0x995a when Gestalt('apvr') is at least 0x110, else directly); a hilite of 1..253 is pressed.
- Scroll track (0xa032–0xa10e, 0xbcc6): byte21 (0xadfe: width > height) selects base -8288, else -8280; tier is 0 when byte47, else 1 when byte20, else 3 when pressed, else 2; the track cicn is base + tier fetched with _GetCIcon after UseResFile(Gestalt 'Copl' low word, 0x9f3e–0x9f58); when the thickness (0xbc92) is at most 11 the id + 18 is probed first; when Acid byte +33 (byte18) or byte77 is set the id + 4 is probed first; a NULL result is not retried at another tier.
- Scroll composite flag (0xa14e–0xa184): byte72 is set when the selected track cicn's bounds exceed 16 in width or height.
- Scroll track pattern (0xa112–0xa14a): a ppat with the record id a2@(66) is fetched (on a miss: id - 4 when the +4 track variant was taken, then base + tier); 0xba0e and 0xc6e4 draw with it when present, by a path not decoded here.
- Scroll arrows (0x9f0e–0x9f38, 0xc338–0xc84a): an inactive control (byte47) draws no arrow (0xc34a); with byte72 the arrow boxes come from the track cicn, and for a pressed control each arrow that is not the hit one uses cicn a2@(66) - 1 (0xc3cc–0xc3fe); without byte72 the icon id is the blob word at +24 + 8*high + 4*vertical + 2*hit (0xc79e–0xc7b6), hit meaning hilite 20 for the low arrow and 21 for the high one, and a disabled control (byte20) instead uses -10206/-10205 horizontal or -10208/-10207 vertical (0xc7ba–0xc7fa); icons are drawn through 0xf4ba, which requires the ics# mask (0xf50c–0xf51e).
- Scroll thumb (0xaed6–0xaf84): nothing is drawn if 0xbbf4 yields an empty thumb rect; a disabled control (byte20) redraws the track in the thumb rect (0xaf08–0xaf20) and draws no thumb; hilite 129 selects -10205 horizontal or -10207 vertical, otherwise -10206 or -10208; at thickness 11 or less the id + 1956 is probed first; both go through 0x10472.
- Scroll draw order (0xa44c–0xa4e2): arrow 0 (low) unless byte18 or byte77, arrow 2 when either is set, arrow 3 (high) always, arrow 1 when byte18, then the thumb.

The record words written at 0x9f0e–0x9f38 are: +24 -10202 / +26 -10198 (left
raised / hit), +28 -10204 / +30 -10200 (up), +32 -10201 / +34 -10197 (right),
+36 -10203 / +38 -10199 (down). The corpus author labels agree with the tier
reading wherever they exist (for example 1138 -8285 "Pressed Horizontal Scroll
Bar Track/Arrows", -8287 "Horzontal Nothing To Scroll Track", -8288 "Inactive
Horizontal Scroll Bar Track"; system7-nostalgia-silver -8286 "Normal Horizontal
Scrollbar"), but the labels are corroboration, not the source of the rule.

Not decoded: the thumb rect (0xbbf4) and every other layout value, how the
track is filled between the arrow boxes, the ppat draw path, 0xf2d6, what sets
the Gestalt('Acid') bytes, and which open file owns a found resource.

## What the rule table declares

`composeScrollbar` has no control Rect, part code, min/max or Gestalt state.
The rule table declares, as modern policy rather than an original observation:
`normal` = hilite 0, `disabled` = hilite 255 with no inactive embedding parent,
`inactive` = hilite 254, min < max, the track cicn's 16px cross size as the
control thickness (so the small path at 11px or less is never taken), the
Gestalt('Acid') response bytes +27, +31..+34 and +36 and blob byte77 clear
(so no double-arrow or id - 1 track variant), and a resource chain holding only the archive's own fork. Public
`pressed` names no part, so a pressed row passes if any of hilite 20, 21, 22,
23 or 129 predicts exactly what was drawn. The spec replaces every candidate
cicn (-8288..-8249, -10208..-10197) and arrow icon (-10208..-10197) of the
loaded theme with a solid sentinel raster of the same size, so a row reports
which resources reached the output; it does not compare art.

## Demonstrated disagreements (recorded, not fixed)

The runtime agrees with the decode for the normal rows of 16 archives. It
disagrees in 112 of the 144 sampled rows (every pressed, disabled and inactive
row, plus the crayon-os and windows-95 normal rows). `range-rules.spec.mjs` pins each
class per archive; a runtime change must shrink these lists.

- **R1 track tier** (pressed and inactive rows, all 18 archives). The runtime
  draws pressed as -8288/-8280 and inactive as the normal -8286/-8278 (its
  comment cites a 1.8.2-era drawer). The decode gives pressed -8285/-8277 and
  inactive -8288/-8280.
- **R2 thumb while disabled** (disabled and inactive rows, all 18). The runtime
  stamps the normal thumb; 0xaf08–0xaf20 draws none.
- **R3 icon-lane arrows** (apple-platinum-2, black-platinum, platinum-8, slimes,
  system7-nostalgia-silver; pressed, disabled and inactive rows). The runtime
  draws the raised icons for disabled and inactive and the hit icons for both
  arrows when pressed. The decode draws -10206/-10205 (-10208/-10207) for
  disabled, nothing for inactive, and the hit icon for at most one arrow.
- **R4 procedural arrows** (crayon-os and windows-95, every row; 1138, 1990,
  dolphin-som and evolution pressed rows). The runtime treats a track as a square
  cell unless its along-axis length is at least twice its thickness, then draws
  procedural triangles where the archive has no arrow icons. The decode's
  discriminator is bounds > 16 (0xa14e–0xa184), so the 31×16 crayon-os and
  windows-95 tracks are composite. The pressed-row cases come from R1 picking
  the 5px (1138) or 20px tier-0 tracks.
- **R5 non-hit arrow boxes** (the 13 composite-track archives, pressed rows). A
  pressed composite control draws its non-hit arrow boxes from the normal-tier
  cicn (0xc3cc–0xc3fe); the runtime draws one cicn.

These are not fixed here. Fixing R1–R3 changes the reviewed regression goldens
of every archive, and a faithful pressed row needs a public part option, which
is an API decision. The runtime's normal-tier retry on a missing track (no
decoded counterpart) is never reached: every archive ships all eight standard
tiers.

Two older statements conflict with this decode and are left for a reviewed
follow-up (kdef231-reference.md is hash-pinned by control-availability
evidence): §2.3 labels -8286/-8285 "inactive/active" and calls
-10208..-10205 a slider family, and §2.4 says there is no separate
disabled-arrow art. The `composeScrollbar` comment repeats the 1.8.2-era
tier map. The decode above gives -8286 normal, -8285 pressed, the cicns
-10208..-10205 as scroll thumbs and the icons -10208..-10205 as disabled arrows.

## Sliders and progress bars: explicit unknowns

The kDEF 0 listing contains the slider ids (-10144..-10113) and progress ids
(-10080..-10064) neither as immediates nor as computed bases, and the kDEF 1
listing has no negative word immediates at all. No 2.3.1 routine that selects
them has been traced. -10224/-10223 appear only in the 0x10472 cache switch. Slider and
progress selection, state mapping and layout are therefore unknown. The
runtime's slider (-10131/-10130/-10132 horizontal, -10115/-10114/-10116
vertical, four-row thumb sheets -10129/-10113) and progress (lavender
-10223/-10224, or the -10080/-10079/-10078 family) models are compatibility
policy informed by author labels. The labels are not consistent enough to stand
in for a decode: 1990 names -10131 "Down Pointing Slider Track" and animals
gives -10132 the active track's label.
