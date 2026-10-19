# Whole-header sampled line colors

This extends only the full-color, ordinary nonrecording solid subset of
[`composeHeaderSurface`](header-surface.md). Pattern and mode5 bodies, original
device caches, mono drawing and historical resource ownership remain outside it.
The earlier equivalence-only admission described there is superseded for retained
sample companions by this note; missing data still produces explicit unsupported.

PACH130 `0x5cb8` selects the horizontal line branch when the original source width
is one and destination width exceeds one, otherwise the vertical line branch
when source height is one and destination height exceeds one. `0x5d48..0x5e26`
uses mask-gated `0x5874` and palette sampler `0x687e`. This is the same reviewed
full-color RGB16 rule retained by the loader's sampled-band companion; it can
differ from ordinary raster ColorSpec interpretation. The source payload and
ordinary masking/geometry bindings remain those in the whole-header spec.

For those expansion branches only, the header uses the selected owner's existing
`sampledBandAsset` when ordinary-raster equivalence is not established. Exact
model/comparison/display-policy/dimensions and derived-path shape must match;
the decoded dimensions and entire mask must match the source. Source masks remain
binary. Missing/incompatible data returns `unverified-line-sampling`; a real decode
failure remains an error. Equivalent raster paths and ordinary corner/repeated
copies are unchanged. No compatibility-raster fallback is added. Handcrafted
metadata remains a caller declaration, not authenticated raw-byte derivation.

Companions are already realized in the owner's current-display policy and are not
transformed again. Branch selection precedes clipping; clipping does not reset
sample coordinates. Mask holes preserve earlier body/border paint. The returned
size and list-view bottom extension are unchanged.

Diagnostics report `headerSurface.lineSampling: sampled-companion` for admitted
companion preparation, and completed `bandPaints` only for actual nontransparent
companion writes. Those records join the already selected face owner/resource to
the actual derived transport; they are not an independent historical painter or
device attribution. Empty clips and rejected/error results claim no band paint.

The independent literal uses the existing 7×7 bit15 palette collision with c3/s1,
repeat=true, requested 11×16. At source (3,0)/(0,3), the ordinary raster is red;
PACH's lookup selects RGB16(8481,8481,8481), current-display gray48. The top band
covers x3..7 at y0; the left covers x0 at y3..12. The solid union is x3..7/y1..14
plus x1..9/y3..12. Every other pixel remains transparent. A separate opaque-corner
fixture ensures ordinary corner red is not replaced by sampled gray. These are
synthetic source/current-display expectations, not original captures.
