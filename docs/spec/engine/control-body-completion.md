# Control body completion diagnostics

This is a modern public observer contract for the opt-in `diagnostics` option
of `composeButton` and `composeBevelButton`. It restores reporting of body
operations that the existing renderer actually completes. A valid selected
signed face, valid metadata requesting a same-owner mode-5 body, and an aligned
1:1 visible destination can already produce correct nonempty pixels and a
`themed` outcome while omitting the completed `bodyPaint` payload. That reporting
gap must be closed without changing rendering, resource selection or state.

The contract uses the existing `ControlDiagnostics`, `ControlRenderTrace`,
`ControlResolutionStep`, `ControlRect` and `ControlCompositionSnapshot` types.
It adds no options, fields, native drawing rule, shape, scaling rule, provider
search or pixel algorithm. Bevel remains a compatibility composer, not a newly
migrated engine family; preserve its working diagnostics and fallback behavior.
This document is sufficient with the implementer brief and runtime types; no
broader behavioral document is needed for this observer change.

## Selection and completion

Keep resource observations in `ControlRenderTrace.steps` in their existing
order. `action: 'selected'`, lookup admission, or `usage: 'paint'` alone does not
mean that pixels were written. Attach `bodyPaint` to the corresponding completed
`role: 'body-fill'` operation only when its actual visible write count is
positive and the enclosing composition succeeds. Enrich the selected pattern
step rather than adding another selection. Keep lookup observations distinct
from completion, including when a later stage prevents publication.

Use the identity captured from the actual selected resource occurrence:
`owner.baseUrl`, `owner.chainDepth`, `resource.type`, `resource.signedId`,
`resource.sourceCinfId`, `resource.manifestKey`, `resource.assetUrl`, and, when
present, `resource.consumedCinf` and occurrence-carried `resource.byteProvenance`.
Retain `requestedId`, `requestedResourceType`, `bodyMode`, `basis`, `usage`,
`action`, `reason` and any `cinfLookup` from the observed operation. The canonical
requested ID does not replace the actual selected signed ID. Do not re-resolve
resources, infer ownership from a caller theme or face name, or invent
provenance to complete the record. A missing resource has no selected occurrence.

Snapshot per-invocation identity, selected transport and context before their
asynchronous consumption. The record must describe that invocation even if a
caller later changes metadata. An asset URL is the actual transport used, and
may be volatile; it is not a stable occurrence key. Optional provenance is
reported only when already collected. Diagnostics introduce no default-path
hashing, extra provider lookup, retained revoked-URL cache, borrowed-theme
disposal or change of cache/ownership policy.

## Completed body payloads

For an admitted mode-5 copy, report `branch: 'masked-copy'` or
`branch: 'unmasked-copy'` according to the copy actually performed, together
with `sourceRect`, `destinationRect`, `paintedPixels` and `sourceAssetUrl`.
`paintedPixels` counts actual writes inside the destination allocation and
caller clip: visible mask-set writes for masked copy, all visible writes for
unmasked copy. This retains the aligned 1:1 admission boundary and existing
decode, size and alpha validation. Clipping does not move the source origin;
wholly clipped coverage needs no dependent decode.

Report the current resource/asset transport actually consumed. Include
`derivedPath` only when an actual unmasked derived companion was used, with its
stable derived identity and corresponding `sourceAssetUrl`. Do not require a
historical companion to exist when the current selected asset is the transport,
or report an unused companion as the source. Preserve the existing copy/fallback
decision; diagnostics cannot make a different asset eligible.

True missing-body erasure is separately `branch: 'missing-erase'`, with
`destinationRect` describing the face allocation and `paintedPixels` counting
visible writes in the existing transposed inset union, with overlaps once.
Use the selected face owner's validated raw background sample under its
existing display policy. This is an absent-body operation (`action: 'missing'`),
not a selected body resource; do not fabricate `resource`, `sourceRect`,
`sourceAssetUrl` or `derivedPath`. Failed, rejected, unsupported or UNKNOWN
dependencies are not proof of absence. If the genuine missing body lacks the
validated raw background sample, retain the explicit
`missing-cicn-body-background-unverified` compatibility fallback without a
source-backed `bodyPaint` claim.

For an existing pattern body operation, enrich its selected completed paint
step with `bodyPaint.branch: 'pattern-fill-union'` and:

- `coordinateSpace: 'face-local-before-ring'` and `unionRects`: the existing
  inset union rectangles bounded by the face allocation, before caller clipping;
- `sourceAssetUrl` and `sourceSize: [width, height]`: the actual loaded pattern
  transport and decoded dimensions;
- `context`: the applied `ControlCompositionSnapshot`;
- `phase.basis: 'modern-composition-policy'`, `phase.offset`: the resolved
  sampling offset actually used, and `phase.originalPatternPhase: 'unverified'`;
- `paintedPixels`: visible writes over the clipped union, counting an overlap
  once and counting transparent pattern writes as writes.

No body payload is inferred from final surviving alpha, a nonempty output,
successful face selection, catalog presence, or a themed outcome. Later border,
label and ring overlays may cover completed body writes without reducing their
count. Existing `legacyFacePaint.retainedNonzeroAlphaPixels` measures a separate
compatibility raster stage and cannot substitute for a body write count.

## Coordinates and context

Every `ControlRect` is `{ x, y, w, h }`, with exclusive right/bottom edges.
Copy `sourceRect` is in source-raster coordinates. Copy `destinationRect`,
missing-erase `destinationRect` and pattern `unionRects` are in the face
allocation's local coordinates before any reserved default-ring placement.
The rectangles describe the operation's bounded geometry, not a replacement
rectangle inferred from its visible pixels.

`context.controlOrigin` locates the face in the caller's logical port space,
excluding reserved ring space. A local point `(x, y)` is tested against a
rectangular `context.clip` at `controlOrigin + (x, y)`; the clip rectangle is in
that same logical port space. `portOrigin` remains the declared port origin;
do not apply an additional translation to the clip. `unknown` and `unbounded`
clip kinds add no clip. Preserve the actual context basis (`caller-declared`,
`managed-content-port` or `compatibility-default`) and pattern-origin status
(`known` with its offset, `api-unavailable` or `unknown`). Omitted context keeps
the existing local compatibility defaults. Report the resolved phase without
turning unknown state into known original state or recomputing sampling from a
clipped rectangle. `composition.faceRect`, when reported, is in logical port
space; it is distinct from these face-local payload rectangles.

## Publication and errors

Stage completion until dependent work, the face and any later default ring
succeed. Zero writes, wholly clipped coverage, abort, failed dependency, failed
face, unavailable result or later ring failure publish no completed `bodyPaint`.
Default-ring drawing remains body-disabled; ring selection or layout reservation
cannot create a body completion. Keep existing load order and cancellation
checks, including checks around dependent decode; an already-issued decode has
its existing lifetime. No observer change may start subsequent work after abort.

Preserve `withControlDiagnostics` callback count, order and error precedence.
With diagnostics enabled, publish one recursively frozen, per-invocation
`ControlRenderTrace` through the captured `onComplete` after rendering settles,
before the public promise resolves or rejects. Keep `version: 1`, captured
`correlationId`, `family`, `requested`, other existing diagnostics and the actual
`outcome`: `themed` with dimensions, `unavailable`, or `error`. Successful body
payloads are published only with the successful composition; failure records
must not assert completed unpublished writes. Preserve existing lookup reporting.
On render success, a callback exception propagates without a second callback.
On render failure, suppress a callback exception and rethrow the original render
error unchanged. Without diagnostics, preserve the existing rendering path.

These records certify modern observed operations only. Original pattern phase,
port state, historical providers, device/cache conversion, arbitrary scaling,
alternate monochrome behavior and unsupported body forms remain unverified.
There is no new original-engine malformed-input claim, native selection rule,
native fidelity claim or change to existing acquisition identity.
