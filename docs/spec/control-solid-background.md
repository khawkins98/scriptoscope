# Solid push/bevel background samples

The full-color solid body consumes the selected face owner's retained background
sample, including RGB hidden beneath a cicn mask hole. The already converted
`displayRgb` is used once; it is the existing high-byte plus 1.8/2.2 display
policy, not an original device/palette color claim. This is a bounded correction
under #218/#221, not complete control fidelity.

## Source boundary

The pinned Kaleidoscope 2.3.1 kDEF0 component is SHA-256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
At `0x10904..0x1091a`, the sampler reads cinf background y/x offsets 6/8.
`0x109aa..0x109ae` gates body painting, and `0x109b2..0x109b6` applies that RGB
with RGBBackColor without requiring an opaque mask bit. The sampler's palette
search is separately established in [the color-sample contract](control-text-colors.md).

Mode5 takes the separate cicn-body path. Other raw bytes request a pattern at
`0x10a6c..0x10a92`; the signed resource ID includes zero. The NULL handle check
at `0x10a96..0x10a9a` reaches solid fill at `0x10b72`. The first rectangle is
inset by corner horizontally and side vertically; when they differ, a second
rectangle uses the transposed insets (`0x10b94..0x10bb8`). Their union is painted
before the masked square corners and independent edge bands. A nonzero ID does
not itself prove a pattern was found, and zero does not intrinsically mean solid.

## Runtime admission and limits

The new raw-background path requires an explicit non5 byte mode, signed16
resource ID, byte-range integer corner/side geometry, a current same-owner
pattern lookup miss, and usable background coordinates/sample metadata from the
actual resolved face. A selected pattern takes priority, including ppat0.
Ambiguous pattern order, absent raw request, unsupported geometry/mode, missing
or unusable sample metadata and `ambiguous-asset-path` do not admit this path.
An attempted pattern decode failure still rejects; it is not a lookup miss.

This records current selection policy, not historical Resource Manager lookup
truth. Existing base/face selection remains unchanged. Mode5 and legacy fallback
behavior are preserved, including existing decoded-anchor behavior when usable
raw evidence is absent. List headers remain on their separate legacy path.
Raw samples are preferred for opaque anchors too: kDEF palette search can differ
from the ordinary raster decoder's table-flag policy, so mask state must not
choose the color interpretation.

Public theme loading validates raw RGB16/display consistency. Direct hand-built
Theme metadata remains caller-declared, as for text samples; rendering checks
model, declared policy, channel ranges and usable coordinates, but does not
recompute or authenticate a caller's display triple. No second LUT is applied.
Explicit foreground overrides affect labels, not body color. Browser glyphs,
alpha-over transfer, device color, monochrome paths and original lookup ownership
remain separate obligations.

## Independent regression evidence

`solid-background.mjs` hand-encodes a 7×7 cicn with corner3/side1, a masked
background sample RGB16(0x2121,0x2121,0x2121), and an opaque blue top-left sentinel.
Source and built public loader/compositor tests require literal 29×9 gray-union
rows: display(48,48,48), including the side arms, while preserving the blue corner.
The old paths instead produced a blue rectangular interior and omitted the arms.
An opaque `ctFlags=0x8000` palette-collision variant independently distinguishes
source-sample gray from the raster decoder's red. Neither decoded transparency
nor source/built agreement is the expected-color oracle.

Tests join actual selected owner/key/state and cicn/cinf occurrence hashes to the
hand-encoded bytes. Push/bevel active/pressed/inactive states, parent fallback,
foreground overrides, real label ink, absent/invalid/ambiguous metadata,
unsupported requests, selected ppat0/nonzero patterns and decode rejection are
covered. The prior masked-text fixture now expects its authored white body where
an explicit foreground override suppresses emboss; its foreground and green
emboss assertions remain exact.

The finite survey covered 18 pinned corpus themes and 15 requested push/bevel
variants each: 270 selections per source/built mode. Three selected background
samples were masked: Crayon push normal, pressed and inactive, all with selected
pattern bodies. No masked-solid selections and no opaque raw/display-versus-raster
RGB differences occurred in this finite set. This is an impact survey, not a
claim about all resources or historical variants. No corpus golden change is
expected, and no requirement-ledger assessment is promoted by this correction.
