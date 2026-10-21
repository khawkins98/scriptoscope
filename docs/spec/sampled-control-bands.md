# Sampled colors for expanded control bands

This contract corrects the bounded #296 palette collision in existing push,
bevel and default-ring borders. It uses the current high-byte plus 1.8/2.2
transform. It does not certify original destination palettes, cache conversion,
mono drawing, picture recording, transfer modes or reference-capture fidelity.

## Source branch and coordinates

The pinned kDEF0 SHA256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`
FEAE helper chooses width1 expansion at ff3e–ffba before height1 expansion at
ffba–1001c. Its masked sampler f9f6→fa8a calls palette lookup10702 at fc48.
PACH130 SHA256
`bf113e709425a811e0805e97dea7c028e46c50909fadb781226295e0b52d5b44`
has corresponding5cb8 branches5d48–5dc4/5dc4–5e26 and5810→5874→687e.
See the existing [kDEF reference](kdef231-reference.md) and
[indexed equivalence contract](indexed-sampling-equivalence.md).

The actual painter retains its existing source/destination rectangles and
TL/TR/top/BL/BR/bottom/left/right order. A source width of1 expanded to a
larger destination selects horizontal lines; otherwise a source height of1
expanded vertically selects vertical lines. `tile=true` does not bypass these
branches. Clipping neither changes the branch nor restarts source phase.
Corners and ordinary repeated CopyMask regions keep ordinary raster colors.

## Derived asset and ownership

The indexed decoder retains its ordinary RGBA unchanged. Only a
`samplingEquivalence.status === 'different'` candidate starts a second,
complete opaque sampling pass, memoized by used index. Any unsafe opaque sample
prevents creation; the earlier mismatch is not complete safety evidence.
Equivalent and all-transparent inputs create no companion. Mask-zero pixels
are skipped. Safe companions contain sampler RGB16 high bytes with the same
alpha mask, and the converter applies the unchanged LUT exactly once.

`ChromeElement.sampledBandAsset` is optional and contains only scalar fields:
`model`, `comparison`, `displayPolicy`, `width`, `height`, `asset`, `derivedPath`.
The three model strings match `CicnSamplingEquivalence`. Dimensions cover the
full source raster. The stable `cicn-sampled/*.png` derivation path remains
unchanged when `asset` becomes a URL. Raw and encoded records are immutable.
The ordinary element's byte provenance joins both assets to the actual cicn
occurrence; the derived image is not another original resource. No functions,
indices or palette buffers escape the conversion.

Duplicate ordinary output paths suppress derived links. Unreferenced derived
assets are dropped before encoding; opted-in byte provenance continues to
reject ambiguity before allocating URLs. The usual encoder failure settlement,
URL ownership, disposal notification and raster cache eviction cover companions.
Renderers never dispose a borrowed owner. Structure checks on caller-authored
metadata are not source authentication.

## Painting and diagnostics

A valid equivalent record uses the ordinary raster without another decode.
A valid companion is decoded from the actual resolved face/ring owner only
when a visible opaque expanded band needs it. Unused ring layout reservation,
fully clipped bands and all-transparent regions do not decode it. Abort checks
surround every dependent decode; a cancelled companion cannot publish paint.
Missing/unsafe/legacy evidence retains the existing raster approximation and
reports `compatibility-raster`. An invalid decoded companion size or alpha mask also stays
on that compatibility path. The header primitive's conservative admission gate
is separate; this change does not expand it. Tabs, list-header legacy paths,
scrollbars and other raster consumers remain unchanged.

Optional `trace.bandPaints` records each region that actually contributes
opaque pixels, its original branch, source owner/key/byte reference and policy:
`ordinary-raster`, `equivalent-raster`, `sampled-companion` or
`compatibility-raster`. Only actual companion paint includes a derived path,
URL and model/policy. Resource selection and layout reservation remain separate
steps. A trace is an observation, not independent historical truth.

## Independent checks and limits

The hand-serialized7×7 c3/s1 fixture makes ordinary raster entry0 red while
engine palette lookup chooses gray 0x2121. The six public push/bevel/ring ×
repeat/nonrepeat cases assert literal gray48 expanded bands and red corners in
source and built runtimes; all twelve failed before the change. Other cases
cover repeated multi-pixel sources, one-pixel destination height, clipping,
transparent holes over a distinct body, inherited and concurrent same-key
owners, cancellation, actual disposal/cache eviction, duplicate suppression,
late encoder failure, safe late-index completion and exact one-time transform.

The observed18-input survey reports3325 equivalent cicns and zero companions;
all prior ordinary RGBA hashes remain exact. This is not a new fidelity or
availability denominator, and whole-raster comparison does not identify actual
band incidence. No requirement assessments or original captures are promoted.
