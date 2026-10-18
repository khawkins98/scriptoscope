# Reviewed evidence for the partial control inventory

This records narrow claims for #227. It is not a replacement for the original
source, a full control specification, or an expected-image generator.

## Engine identity

Kaleidoscope 2.3.1, `kDEF 0`, 68k, 107,726 bytes. SHA256:
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
The local binary was fingerprinted from
`.scratch/k231-kdef/kDEF/id-0-680x0_DefProcs.bin`; extraction is documented in
[the binary inventory](../../docs/spec/kdef-binary-inventory.md). Addresses below
are file offsets. The original code is neither redistributed nor executed.

## Background sample

The 2.3.1 slice path at 0x10904..0x1091a passes cinf +6/+8 coordinates to the pixel sampler, then 0x109b2 supplies sampled RGB to RGBBackColor.

The Windows95 active and inactive source faces have authored background samples.
The executable oracle samples the decoded resource at its authored `bgAnchor`
and compares the output's center for an empty label and explicit 20px face.
This establishes that sample equality only. It does not verify all interior
pixels, decoder fidelity, font policy, borders, state selection or masks.

## Ring rectangle and square corners

The 2.3.1 default-ring path at 0x7698..0x76a2 expands the face rectangle by four pixels on each side before ring dispatch at 0x76c4.

The slice path at 0x10c18..0x10c28 retains square corner-size blocks; side thickness independently governs edge bands.

The synthetic corner3/side1 fixture tests source(2,2) at target(2,2), along with
the four-pixel outer allocation. Its opaque colored source is an engineered
sentinel, not an original theme. These assertions do not certify every ring
pixel, overlapping band, mask, resource-selection rule or default-button text.

## Decoded slider art retention

The Windows95 horizontal groove is 5x4 and thumb sheet is 11x64; the vertical groove is 4x5 and thumb sheet is 64x11. Four decoded cells yield native thumb cross sizes 16 and 16.

The oracle compares every opaque pixel of the decoded cell with output pixels.
That independently checks *retention of decoded opaque cell art*. The decoder
is shared, so it does not verify the original archive decoder. The test's
floor-centered placement and selected cell are project policies used to locate
the pixels, not independently verified historical arithmetic or state mapping.
The unresolved source gap is recorded in
[kDEF reference §7.4](../../docs/spec/kdef231-reference.md).

## Known tab mismatch (#223)

1138 rear cicn -9975 is 23x16 with opaque x2..20 and cinf corner10; 1990 rear cicn -9975 is 32x16 with opaque x1..28 and cinf corner14. Applying those original corner sizes after opaque cropping yields middle widths -1 and 0.

The current tab compositor skips that middle strip. This is a reviewed geometric
mismatch against the full source raster, tracked in
[#223](https://github.com/khawkins98/scriptoscope/issues/223); it is not inferred
solely from a snapshot. The `AgjpQy` unselected automatic-size cases are scoped
here. Font choice/size and complete historical tab placement remain unknown.
No claim of Windows95/Windows31 glyph clipping is made.

## Narrow Lisa square-corner retention (corrected by PR233)

Apple Lisa active cicn -10239 is 9x9 with cinf corner4/side1. The original square4x4 corner rule retains source(2,2); the rectangular4x1 face slicer can substitute source(2,1).

The previous rectangular slicer caused that mismatch. Merged
[PR233](https://github.com/khawkins98/scriptoscope/pull/233) corrects the source
geometry. The registered oracle compares alpha and opaque color for every pixel
in all four Lisa source corner blocks with an empty label, normal state,
`minWidth: 80` and `height: 20`. This exact geometry requirement is verified.
The other face requirements remain unknown; #218 stays open for patterns, list
headers and legacy-path limits. No whole-face, text, decoder or state fidelity
is inferred. Inventory 1.0.1 explicitly aligns the Lisa input with this 80px oracle.

## Input association boundary

The validator rejects assessment evidence whose named non-engine inputs are all
unrelated to the case's declared primary/base inputs. General engine-only rules
remain allowed; the combined tab note names both applicable archives. This is a
necessary association check, not full parameter or source-claim authentication.
The reviewed inventory, statuses and open closures are unchanged by this guard.
