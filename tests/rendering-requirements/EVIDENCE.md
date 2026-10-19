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

## Inventory1.1.0 finite source-model additions

All new cases remain OPEN. The tests below establish only their declared narrow source-model requirements. Caller context is not proof of an original port; browser glyph masks and current display conversion are not original transfer/device evidence.

### Selected authored text samples

At 0x10922..0x10934, selected cinf +10/+12 coordinates supply the text RGB output; fc5c samples local raster coordinates and continues RGB lookup independently of the mask bit.

Selected authored text RGB16 is sampled independently of source mask alpha. See [text colors](../../docs/spec/control-text-colors.md) and [direct pattern context](../../docs/spec/control-pattern-context.md) for the pinned engine chain, period documents and explicit limits.

### Emboss enable/disable decision

At 0x1093e..0x10990, emboss coordinates (0,0) or exact three-word RGB16 equality with background disable emboss; the caller tests the raw red 0x1234 sentinel before display conversion.

Exact absent/equal/sentinel decisions precede RGB8/display conversion. See [text colors](../../docs/spec/control-text-colors.md) and [direct pattern context](../../docs/spec/control-pattern-context.md) for the pinned engine chain, period documents and explicit limits.

### Emboss order and relative offset

Push 0x75ca..0x75ea with 0x70a6..0x70ba and bevel 0x89bc..0x8a08 paint enabled emboss at (+1,+1) before foreground; this establishes pass order and relative offset, not browser glyph or TextMode equivalence.

Emboss-first relative offset only. See [text colors](../../docs/spec/control-text-colors.md) and [direct pattern context](../../docs/spec/control-pattern-context.md) for the pinned engine chain, period documents and explicit limits.

### Direct pattern phase and clipping

The 0x10ac8..0x10af6 corner anchors use original exclusive Rect edges; f930 translates both destination and finite clip by -P while changing origin to O-P, leaving physical D-O unchanged.

Original face Rect phase, shared inset phase and clip transformation. See [text colors](../../docs/spec/control-text-colors.md) and [direct pattern context](../../docs/spec/control-pattern-context.md) for the pinned engine chain, period documents and explicit limits.

### Pinned Crayon selected text

Crayon selected active push -10239 and small bevel -10175 text RGB16 is (8481,8481,8481); inactive push -10240 is (34952,34952,34952). Their emboss coordinate is (0,0). Exact cicn/cinf payload hashes and sample coordinates are pinned in tests/decoder-fixtures/control-text-source-samples.json.

Exact selected source samples and absent emboss for the three declared Crayon cases. See [text colors](../../docs/spec/control-text-colors.md) and [direct pattern context](../../docs/spec/control-pattern-context.md) for the pinned engine chain, period documents and explicit limits.

### Pinned Crayon pattern samples

Crayon ppat17 payload SHA256 35c7aa22b9da7e01f83fa5dbd6443e5c93459a3450401ab2c18050f37cdcfea4 has raw RGB samples (231,222,198) at (8,8), (247,247,214) at (63,9), and (247,239,214) at (0,9). The current display policy maps these to (235,228,207), (248,248,221), and (248,242,221).

Three actual selected-pattern samples under declared transform only. See [text colors](../../docs/spec/control-text-colors.md) and [direct pattern context](../../docs/spec/control-pattern-context.md) for the pinned engine chain, period documents and explicit limits.

### Unequal body inset union

At 0x108a6..0x108b0, d3/d4 read cinf corner/side bytes. 0x10afa..0x10b10 copies the original Rect and insets left/right by corner, top/bottom by side, then 0x10b22 calls f930. If corner differs from side (0x10b26..0x10b2c), 0x10b2e..0x10b44 copies the original Rect again with transposed insets and 0x10b56 fills it using the same pattern and phase arguments. The body coverage is the union of these two rectangles.

The engine identity is the pinned kDEF0 above. This rule supports the literal
29×9 source-row oracle, not all control geometry or mask branches.

### Separate pattern-origin offset

Apple Universal Interfaces 3.4.1 QDSetPatternOrigin documents Rect(3,3,10,10) sampling the lower-right 7x7 of a 10x10 tile and SetOrigin(+10,+10) paired with pattern origin (-10,-10) preserving content alignment. These examples support additive R in sample(q)=floorMod(D.origin+q-P+R,tile dimensions); the K2 f930 wrapper alone establishes only the -P translation, not preexisting R.

Source: [Apple Universal Interfaces 3.4.1 rendered Quickdraw.h](https://www.ioi-xd.net/os9docs/Quickdraw_8h.html#afff2dba5362303c1881307f1448db977),
rendered-header SHA-256
`9e30372f277b70b9c877c628204db448526cec3ee8dfb849ab6e4af0c9c444ef`.
The documentation lists NQD 8.5 / CarbonLib 1.3 / Mac OS X 10.1 availability;
that is not proof of availability or a known offset in an original captured
port. See the [direct context contract](../../docs/spec/control-pattern-context.md).


### CDEF 8 full-raster tab bands

CDEF 8 reads the full cicn PixMap bounds at 0x420..0x42a, copies full-height end strips at 0x430..0x47e, and paints independent top/bottom bands at 0x484..0x552. When cinf tileSides is zero, 0x4a2..0x4b4 and 0x506..0x518 reduce the band source to its first column. 1138 rear art is 23x16 with corner10/side10; 1990 rear is 32x16 with corner14/side14. Both have empty centers and overlapping bands, so preserving full source coordinates retains their middle strips without repeating the adjacent semantic sample column.

Installer component CDEF 8: 15,902 bytes, SHA-256
`4c9fecff46f6bfe2171961fa71e0831e5e2b85174f55531ad1a2fe895a82c680`.
The independently reconstructed installer resource-map chain is in the
[binary inventory](../../docs/spec/kdef-binary-inventory.md). No original bytes
are redistributed or executed. [The bounded body contract](../../docs/spec/tab-cdef8-body.md)
records call sites, masking limitations and the separate center rule.
Exact archive/cicn/cinf pins live in `tests/decoder-fixtures/tab-body-source-pins.json`.
The assertion checks the exact existing AgjpQy options outside the browser glyph
mask; that mask excludes text, not the middle band. No actual tab paint-selection
trace or original font/device/transfer claim is inferred from catalog identity.

## Additional actual tab diagnostics (not a ledger transition)

The finite `tab-trace.spec.mjs` source/built cases now observe `composeTab`'s actual
selected owner/key/cicn/cinf reference and body branch. The reference joins to that
owner's decoder resource occurrence before comparison with independent archived
input and payload hashes. Existing `expectedEntryBinding` records in the body
assertions remain expected catalog evidence; they are not silently relabeled as
actual paint. No assessment or denominator changes here. Font, device transfer,
original variant selection and Resource Manager ownership remain separate.

## Inventory 1.2.0 finite solid-background additions

### kdef.raw-solid-background

At 0x10904..0x1091a, fc5c samples the selected cinf background coordinate; 0x109b2..0x109b6 applies RGBBackColor without testing the returned mask. The full-color sampler reads local indices, and 0x10702 applies its positional-match/final-zero shortcuts followed by reverse ColorSpec.value search. For non-mode5 bodies, 0x10a6c..0x10a9a requests the signed pattern ID including zero; a NULL handle reaches 0x10b72..0x10bb8 and erases the union of inset(corner,side) and inset(side,corner).

### fixture.solid-rgb16

The independently encoded 7x7 source has corner3/side1, background index0 at (3,3), RGB16(8481,8481,8481), and a blue opaque (0,0) corner. The masked variant has mask0 at the sample. The opaque variant has ctFlags32768 with ColorSpec values7,0,3: raster positional index0 is red, while the engine sampler selects the gray value0 entry. Current high-byte/LUT maps33 to48 once. At 29x9 the literal gray union is [3,26)x[1,8) UNION [1,28)x[3,6); only (0,0) is blue and all remaining pixels are transparent.

Exact byte/map pins are in `tests/decoder-fixtures/solid-background-source-pins.json`. They were independently transcribed and checked with a separate big-endian raw resource-map walk before registration. The two complete forks have twelve occurrences; push uses0/1, bevel6/7. The test joins actual selected references to these owning load records, never an expected manifest prelookup. Its complete literal output proves sample consumption; the miss trace proves current same-owner policy only. All prior sixteen cases and134 assessments remain semantically unchanged; both new cases retain OPEN closure. Review of proposed statuses is separate from successful execution.


## Finite whole-header and sampled-band extension (#301)

Synthetic literals and static source interpretation are separate from original
engine captures. No original code is executed or redistributed. Exact serialized
payloads, fork hashes, palette and literal pixels are pinned in
`tests/decoder-fixtures/header-band-source-pins.json`. Actual selected references
are joined to the owning load and resource occurrence before comparison.

### source.pach130-header-rect-mask

For the finite whole-header cases, PACH130 c1e8..c1f8 tests the complete UInt32 state for zero and selects -9568 or -9567. The list-view wrapper c524..c546 intersects the original Rect clip and increments drawing bottom before composition. Solid inset union721a..7260 precedes square corners and independent masked bands72a8..7620; ordinary forward repetition5e86..5f84 clips final tiles without resetting phase. This establishes only the declared full-color nonrecording geometry/mask subset, not Resource Manager ownership or device output. Header sampled lines are established independently in PACH130: helper5cb8 enters width1 expansion5d48..5dc4 or height1 expansion5dc4..5e26, invokes5810 with mask checking through5874, and the full-color path calls palette687e via5a32. This is the header sampler source, not an inference from the kDEF push helper.

### fixture.header-overlap-literal

The independently serialized11x9 c2/s3 repeat source and literal19x13 rows are pinned by header-band-source-pins.json. The ordinary full-plane case observes overlapping sides, mask holes and partial tails. The clipped list-view case observes local x5..12,y2..10 only: body survives top-band mask holes, and row10 x8/x9 remains body48 where ordinary-height output contains band tokens7/6. Cropped lower corners, side overlap and the x16 partial tail are not observed by that clipped case.

### source.kdef-sampled-lines

The kDEF0 FEAE helper takes source width1-to-wider before height1-to-taller paths at ff3e..10018. The mask-gated sampler and10702 ColorSpec lookup use positional matching value, last-entry-zero shortcut, reverse matching value, then entry0. A bit15 raster index0 can therefore remain red in ordinary CopyMask while its sampled line color comes from the gray value0 entry. The current high-byte/LUT conversion is a declared display policy, not original-device equivalence.

### fixture.band-collision-literal

The independently encoded7x7 indexed8 collision has ctFlags32768 and ColorSpec values7,0,3. Ordinary raster index0 is red255,0,0; the raw sampler chooses gray RGB16(8481,8481,8481), mapped once to current-display48,48,48. For the exact repeat push case, (4,0) and(0,4) are gray while ordinary corner(0,0) remains red. The separate whole-header collision case returns unsupported without output or painted dependency; no sampled companion is claimed for it.

## Recorded-condition composed faces

Six exact Windows95/System7 empty80×20 normal, logically highlighted and disabled-active observations supply opaque-white composed-pixel references under the explicit v9 measured profile. Original source alpha, font realization, private painter/provider, physical gesture and other conditions remain unverified.

The scoped-original evidence kind reuses reference intake review, never the renderer as its expected-image authority. Exact capture/request/image/profile bindings and actual source/built execution are separate obligations. Metadata-only re-attestation binds changed authority versions without recapturing or changing original image/condition bytes.
