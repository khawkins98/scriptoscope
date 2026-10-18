# Direct control pattern context

This is the intermediate direct-composition stage of #218/#221. It implements
full-color PixPat bodies for push/bevel faces with every raw cinf byte except
mode5, which requests a separate color-icon body. The [managed button adapter](managed-control-context.md) connects this model
to current browser window coordinates under an explicit integration policy. List headers and tabs remain separate. The bounded mode5 color-icon body path is documented in [cicn-body-mode5.md](cicn-body-mode5.md).

## Source and coordinates

The pinned kDEF0 component is SHA-256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
Push dispatch7572/7594 and bevel7770–7778 reach the body-enabled107fe path.
The body phase anchors at10ac8..10af6 use the ORIGINAL control Rect:

| Raw mode | P.x | P.y |
|---|---|---|
|0|0|0|
|1|left|top|
|2|right|top|
|3|left|bottom|
|4|right|bottom|

Right/bottom are the exclusive Rect edges, not the final included pixel.
Mode5 selects the separate cicn path. The equality test at109be and branch
at109c4 send every other byte to the same cache/GetPixPat path at10a6c..10a92.
The zero-extended byte at10ab0..10ab2 encounters four SUBQ/BEQ pairs selecting
only1–4; all other values fall through10ac6 to the zero anchor at10af4/10af6.
Thus modes0 and6–255 share P=(0,0); their original raw mode remains in the trace.
This does not declare the separate Resource Manager lookup policy historical.

At f94e/f952, f930 saves port origin O. It sets O−P at f956..f962, translates
both destination D and the finite clip by−P at f980..f9a8, paints, then restores
them. Thus physical placement `(D−P)−(O−P) = D−O` is invariant. The two body
rectangles share P: inset(horizontal=corner,vertical=side), then the transposed
insets if unequal. Clipping changes coverage, never tile phase. Masked square
corners/independent bands paint after the body. Text foreground and optional
emboss use the separately source-backed [RGB16 sample contract](control-text-colors.md);
font rasterization and browser text transfer remain explicit compatibility policies.

[Apple Imaging With QuickDraw (1994)](https://vintageapple.org/inside_r/pdf/Imaging_With_QuickDraw_1994.pdf),
SHA-256 `f8e079d02b57516900f4b45c1f09629ef734313a51c171029278c9d97f6b497a`,
printed2-45 requires origin0,0 before Window/Control Manager calls. Nonzero direct
experiments must establish a valid direct-drawing invocation; they cannot presume
ordinary DrawControls supports it. Printed3-6 describes pattern continuity.

[Apple Universal Interfaces3.4.1 QDSetPatternOrigin](https://www.ioi-xd.net/os9docs/Quickdraw_8h.html#afff2dba5362303c1881307f1448db977)
(rendered header SHA-256
`9e30372f277b70b9c877c628204db448526cec3ee8dfb849ab6e4af0c9c444ef`)
documents a separate per-port pattern offset R. Its SetOrigin(+10,+10) with
pattern-origin(−10,−10) example preserves content-area alignment. Together with
the ordinary Rect(3,3) sampling example, this gives the additive sampling
convention used here:

`sample(q) = floorMod(D.origin + q − P + R, pattern dimensions)`.

Modulo is normalized for negative coordinates. The offset API is documented from
NQD8.5, CarbonLib1.3 and Mac OS X10.1; availability and actual offset in a historical
environment require evidence. The wrapper does not establish preexisting R.
These are source-derived arithmetic requirements, not admitted original captures.

## Public context and applied policy

`ButtonOptions.compositionContext` and `BevelButtonOptions.compositionContext`
accept immutable-by-snapshot logical coordinates. `controlOrigin` is the FACE's
original port-coordinate top-left; it excludes the four-pixel ring footprint.
`portOrigin` is the corresponding portRect origin. `patternOrigin` distinguishes
known offset, declared API unavailability, and unknown. `clip.rect` is in the SAME
original logical port coordinates, not face-local pixels or CSS coordinates.

The face dimensions are the actual composed width/height. Public sizing remains
`minWidth` plus optional `height`; the internal list-header `width` option is not
a public button option. The browser oracles assert the actual29×9 or80×20 face
dimensions instead of assuming a requested minimum is an exact width. A ring expands the
output buffer but does not translate D or restart its pattern. The internal
`composeButtonWithLayout`/`composeBevelButtonWithLayout` result exposes the actual
face rectangle inside that buffer for the managed adapter; public compose
functions retain their PixelBuffer/null returns.

Omitted context applies local D=0/O=0, zero extra offset and an unbounded clip as
compatibility defaults. Diagnostics explicitly mark `basis: compatibility-default`,
unknown offset/clip and `originalPortState: unverified`. Caller-supplied context,
including `api-unavailable`, is a declaration, not independently verified OS
state. `appliedUnknownPatternOffset` records when zero substitutes for unknown R.
Context coordinates are signed16-bit integers; pattern-phase calculations reject
out-of-range right/bottom edges.
The implementation does not emulate QuickDraw integer overflow or sentinel clips.

Direct interactive buttons forward one context snapshot to normal/pressed paints.
Detached preparation remains valid. Explicit managed bindings and scanner-owned
buttons inside the same mount's windows observe position/reflow/scroll through the
[managed adapter](managed-control-context.md), which accounts for actual face
layout, scale and DPR and commits both state buffers atomically. Independent
controls keep their caller/local context; DOM position is not original-port proof.

## Actual dependency, scope and lifetime

The actual selected face owner supplies the pattern catalog. The loader carries
`ChromeElement.bodyPattern` directly from its last successfully decoded ppat
occurrence for that signed ID, including raw ID0 and excluding mode5. It preserves
all catalog keys and the existing nonzero-only `bgPattern` link. Numeric names
such as`2` then`1` demonstrate why object-key enumeration cannot reconstruct source
order. This binding is emitted with or without opt-in byte observation.

At paint time an exact signed-ID match on the carried binding wins, followed by
a valid legacy `bgPattern` link. A legacy manifest without either valid link can
use one uniquely matching raw-ID candidate. Multiple unbound candidates report
`ambiguous-legacy-pattern-order` and retain the previous face fallback; they do
not silently pick an enumeration order. Wrong-ID links are rejected visibly.
No absolute-ID alias or base search is invented. This is explicit same-owner compatibility policy, not proven
original Resource Manager search order. Missing patterns and unsupported modes
are recorded and retain the prior face fallback. Decode failures still reject.
Legacy manifests without raw body requests retain prior behavior.

A `body-fill` trace step records raw requested mode/ID and the actual selected
ppat ID/key/owner/base depth/asset, plus occurrence-carried byte provenance when
collected. The ppat/cicn resource union distinguishes their provenance types.
Catalog presence alone does not create a paint step. This stage's lookup and
render path actually loads and consumes the selected pattern. Empty or fully
clipped coverage can still select art; selection does not assert visible pixels.

Promoted button/select lifetimes pass through face→pattern→pressed/ring sequential
loads. An abort prevents subsequent loads and publication; an already-issued
image decode is a distinct browser lifetime boundary. No delay, retained revoked
URL cache, borrowed-theme disposal or default-path hashing is added.

## Color and independent checks

f488 clears the alternate-fill flag at depth>4; f7cc then uses FillCRect atf85e.
At depth<4 it selects pat1Data with foreground/background FillRect; depth4 depends
on a separate flag. An 8-bit original port therefore uses the full-color branch,
but QuickDraw's destination palette mapping/quantization remains unimplemented.
Browser decoded RGB plus the existing1.8/2.2 display transform is not an original
8-bit capture color oracle. Framebuffer transport depth does not establish guest
port depth or palette state.

Independent tests use literal asymmetric tile rows, unequal inset unions,
non-power-of-two diagnostic tile dimensions, negative coordinates, exclusive corners, co-translated
D/O/port clips, ring reservation and actual owner/state selection. Deliberately
reversing offset sign or subtracting1 from the right anchor fails those fixtures.
An exhaustive byte test covers all255 non-cicn modes; source/built pixel checks
include6,127,128,255. Non-power-of-two synthetic tiles distinguish phase arithmetic;
they do not certify original QuickDraw resource-size eligibility.
The prior renderer fails the source/built literal-body fixture. Removing lifetime
forwarding fails held decoded-face and held decoded-pattern source/built checks.
The integrated checks cover both promoted buttons and native-select decorations;
all later source requests and publication must stop after owned release.

Real Crayon archive/fork/payload identities reuse
[the pattern pins](../../tests/resource-provenance/pattern-pins.json). Independently
read raw ppat17 samples are (231,222,198) at8,8; (247,247,214) at63,9;
(247,239,214) at0,9. Pressed ppat−10238 at8,8 is(33,33,198). Tests use literal
post-display-policy values and join the ACTUAL paint trace to those pinned
payloads. An actual hand-built fork with numeric pattern names tests last-decoded
paint with and without observation, legacy ambiguity, and exact legacy links.
This verifies the stated source/context model, not original lookup,
complete device color fidelity, arbitrary clipping regions or whole-control truth.

Remaining fidelity obligations: original-port validation of the managed browser
policy (#270); mode5 behavior beyond the [aligned color-port subset](cicn-body-mode5.md); monochrome/4-bit variants;
original port/scroll/pattern-offset integration; and independently eligible
reference comparisons. #218 and the epic remain OPEN.
