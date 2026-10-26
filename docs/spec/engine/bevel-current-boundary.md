# Current bevel consolidation boundary

Baseline: `f7d93afb37e08491da30f69fdc30dcd774ec72ee` (current `origin/v2` at assignment).
This implementation-owned, listing-free addendum records current compatibility
behavior (C), not original-engine evidence. It refreshes the stale C descriptions
identified below in `bevel.md`; it does not authorize changing behavior to suit a
future refactor. No historical implementation, independent oracle, or verifier
material was read. The old contract's hashes and size baseline do not describe
this baseline. The hashes below identify the current files used for this review.

Implementation status: the narrower shared-body extraction was evaluated and
rejected because it did not substantiate worthwhile net deletion. The subsequent
[compatibility retirement proposal](../../../tools/runtime-spike/bevel-retirement-proposal.md)
is a separate decision and has not changed the behavior recorded here.

## Approved timing amendment (2026-10-26)

The user approved a future bevel renderer capturing selected metadata at the start
of a render. Getter invocation counts and metadata mutations during asynchronous
rendering need not retain the baseline behavior described below. This is a
compatibility change: callers must finish metadata edits before starting a render;
edits made while it is pending are not guaranteed to affect that render. A later
render may observe those edits. This permission does not authorize caching across
renders or snapshotting an unrelated catalog.

Normal themed pixels, public API signatures, resource selection and admission,
callback completion/error behavior and owner disposal protection remain required.
The baseline temporal observations below describe the frozen reference; they are
not additional requirements where they conflict with this amendment. Production
has not yet adopted the snapshot boundary.

## Current transport and temporal boundaries (BV01/BV02/BV07/BV08)

`composeBevelButton` accepts `ThemeInput` and enters `withThemeView` before reading
requested-state diagnostics. That wrapper normalizes the input and checks the
current base chain for disposed registered owners before invoking the renderer.
After the renderer and diagnostic completion return successfully, it checks the
chain again. Thus a post-render lifetime rejection can follow a completed themed
diagnostic callback; it is not converted into a second error callback. A thrown
renderer or callback failure bypasses that final successful-return check. Bevel
still has no public signal argument; do not add one or transplant push's
ResourceChain cancellation policy.

`ThemeView` preserves live metadata access; it is not a deep snapshot. Calling
`asset(ref)` captures the registered owner and local entry, or resolves a legacy
URL at that call. Pixels and later image export use that captured transport.
Changing the owner's origin or manifest asset field afterward does not retarget
that capture. Custom owned inputs without a registered local owner use their
captured export function/ref. Methods on captured registered resources reject
when that owner is disposed. Ordinary external/legacy URL decoding retains its
URL-keyed promise cache; release evicts the cache without reinsertion on pending
completion. That old URL fact is not a blanket promise that an owned public
bevel render succeeds after disposal. Owned binary-alpha pixels can be borrowed;
authoritative/fractional resources use image decoding. No eager export is required
solely to obtain direct pixels.

`loadResolvedFace` first applies `snapshotBodyCinfFace`; declared elements are
shallow-copied, ordinary elements remain live. It then captures the RasterSource,
selected signed ID, diagnostic resource/provenance (when traced), and owner
identity. With diagnostics it awaits that source's public image URL, records
selection, and only then awaits pixels. Without diagnostics it directly starts
the pixel request. Both requests use the same captured source. Image export can
fail before selection is recorded. `declaredBodyFace` subsequently attaches the
consumed cinf lookup to the captured loaded resource identity, without rereading
face asset identity. Other declared-admission gates remain in the caller.

## Pattern and mode5 preparation timing (BV03/BV04/BV07)

The existing bevel pattern search retains its ordered link reads, Object.keys
fallback, duplicate-link suppression, and family-specific permissive admission.
Do not substitute the engine/header selectors. In traced calls, rejected linked
patterns capture their RasterSource and resource scalars as they are discovered;
rejection records are deferred until `reportRejected`, which awaits each captured
image export in order before recording that rejection. Selection search finishes
before that replay. A selected pattern's RasterSource and diagnostic scalar
identity are captured before the replay. The replay is awaited even when empty.
Then selected pixels are awaited; with diagnostics, selected image export is
awaited afterward and the selected record is published. An export failure is a
real asynchronous failure, not a lookup miss or solid fallback. The prior claim
that all rejected-link events occur immediately during search is not applicable.

Mode5 captures the diagnostic target identity, body RasterSource, target
RasterSource, copy mode and derived path before pixel decoding. It validates
returned size and alpha before diagnostic exports. With diagnostics it then
awaits both body and target image URLs concurrently, using the body URL for
sourceAssetUrl and target URL for selected resource attribution. Without
diagnostics internal keys suffice; no public image export is added. Keep the
existing predecode visibility gate and its rejection order.

## Sampled border attribution (BV06/BV07)

Border setup still retains the companion descriptor object and computes proof
and eligibility before the first dependent await. On the first eligible visible
expanded band it captures `theme.asset(companion.asset)` and awaits pixels once.
Changing descriptor.asset during that wait does not change the captured source.
Dimension/mask validation and compatibility fallback remain unchanged.

For a completed sampled-companion band with diagnostics, the band is first
composited onto the intermediate border plane; then its captured sampled source's
image URL is awaited and cached for later bands. The band record follows that
await. Export failure can therefore leave earlier band records but prevents this
record and final buffer publication. The derived path/model/displayPolicy remain
live reads of the retained descriptor at record construction; derived assetUrl
comes from the captured source, not a fresh descriptor.asset read.

Each emitted band uses `resolved.loadedIdentity.resource`, including any consumed
cinf overlay. It does NOT call resourceIdentity anew for every band. Its owner
origin/depth fields are constructed at emission. Preserve the distinction between
captured resource identity and live owner/descriptor reads. Legacy-stage
attribution likewise uses loadedIdentity. The diagnostic wrapper's existing
freeze/callback/error policy remains separate from these transport awaits.

## Current body mechanics (BV05)

The old allocation-grid pattern loop description is stale at this baseline.
Current bevel composition calls `cinfBodyRects` once before body dependencies:
first corner/side inset, then transposed unless equal, filtering empty Rects.
It creates `pixelBodyRects` by applying Math.ceil to all four endpoints.
Pattern painting calls `fillPattern` for each resulting rectangle, in order,
with negated phase. Overlap is painted twice; declared clipping is applied at
final face clearing, not before each pattern sample. The primitive returns for
empty rectangles or nonpositive pattern dimensions, captures data arrays, and
uses pixelIndex/modulo addressing rather than invoking PixelBuffer.getPixel.
Do not restore the older getter/once-per-union traversal during consolidation.

Pattern coverage is computed separately by `bodyWriteCount` on the ceiled boxes,
allocation and local clip, provided pattern dimensions are positive. That helper
skips points already contained in earlier boxes. Counts include transparent
pattern writes; zero-size patterns yield no completed pattern-body record.
Diagnostic unionRects still derive from the original, allocation-clamped raw
bodyRects. Actual repeated painting, visible union coverage and diagnostic
mathematical rectangles are distinct observations.

Solid body painting uses the retained raw bodyRects and passes endpoint-derived
width/height to PixelBuffer.fillRect, in order. It does not use the ceiled boxes.
This replaces the old contract's direct width-minus-twice-inset arithmetic as the
current reference. Missing-mode5 erase coverage nevertheless uses the ceiled
boxes and bodyWriteCount. Preserve these different arithmetic/traversal paths.

The shared engine fillPattern and eraseRect remain their own primitives. In
particular eraseRect's empty check, optional trace color reads, data capture,
per-point bounds admission and interleaved live channel reads/writes remain as
specified in BV05. Do not implement engine erase by pre-capturing a bevel tuple.
Bevel mode5 continues its explicit visible aligned copy and count. The border's
scalar extents, repeated getPixel observations, and two alpha-over stages remain
in place. This addendum does not broaden supported geometry or validate inputs
that the current path leaves to arithmetic/typed-array behavior.

## Recommended first implementation assignment

PM should explicitly scope the initial slice to existing `src/controls.ts`,
`src/engine/qd/cinfFrame.ts`, `src/engine/qd/pattern.ts`, and new
`src/engine/qd/frameOperations.ts`, plus separately assigned implementation-owned
unit checks. Preserve public exports and keep selection, browser font work,
resource preparation, orchestration and diagnostic publication in their current
owners. Both bevel and cinfFrame must consume any new shared operation/coverage
or bodyPaint constructor; remove the replaced implementations in the same patch.
A moved helper alone is not a consolidation result.

Keep two concrete transfer policies where observable semantics differ; do not
introduce a callback framework to disguise different grids, alpha or getter
behavior. Share completed operation facts/record construction without publishing
bevel body records before border/labels/final clipping succeed, or changing
engine drawOps timing. Treat direct engine calls as observable too, not merely
public facade calls with ordinary immutable inputs.

The facade/driver split and `controlBody.ts` remain a later, separately scoped
part of the full proposal. Do not create them merely to move existing code.
`ownedTheme.ts`, `cicnImage.ts`, rasterAssets, diagnostics, resource adapters and
header/tab/push code are read-only reference roots for this initial slice.
No header/tab binder rewrite, resource admission unification, new public API,
independent evidence modification or transport-lifetime redesign is authorized
by this addendum. The narrower staged assignment needs PM adoption; this advisor
file is a recommendation, not self-issued expansion of edit authority.

## Limits and unresolved items

This review identifies current-source amendments; it is not an exhaustive
getter/failure equivalence certification or independent acceptance result.
Old behavior examples describing once-only pattern sampling or old raw solid
arithmetic must not be used as current expectations. Ordinary byte equality can
coexist with different getter observations. Any uncovered discrepancy between
an old C clause and these current pinned files requires a listing-free public
clarification before implementing that aspect. Q/U claims in bevel.md are not
upgraded or revised here. Independent coverage readiness remains separately
owned. Measure actual net deletion after wiring both callers; no line target or
relocation credit is promised.

## Current reference hashes

| SHA-256 | Path |
| --- | --- |
| `0a9bbbc22f0d2a08cdf9339e6504df72a3bfae59a26e55a6426f7032f2b3f906` | `docs/spec/engine/bevel.md` |
| `07adacd8eea8ccedf3abdcb489a84379ada1a58dd2343c2c5ae076699a22005e` | `src/controls.ts` |
| `32561aa5ca7ac45dfedffa4ef69be26fa8d5b2f71218072ab214d19234fe33da` | `src/engine/qd/cinfFrame.ts` |
| `f0c90059f75f9d17ca5f27babf1e15dc39d85dc22267e99298e1a3bc19969d4e` | `src/engine/qd/pattern.ts` |
| `5b00750ef8823125e9c408c6a8bc8305d1daaf914199096aeee49c9c4711aa5c` | `src/engine/qd/pixel.ts` |
| `9a2e2c892e9b057a65aa83979877bf4b5adb135259b5edb83fe97d54aca7c620` | `src/ownedTheme.ts` |
| `061d7d77b911ab1580cfd2fe9e82e9903256864ce0b4f248664633e42f20b8f1` | `src/cicnImage.ts` |
| `ae9ac7028b8a9b922d729da7393003e0944e08e919fc6025115422160b777d20` | `src/controlDiagnostics.ts` |
| `9ce0ae6fea08124dbc8769ae644d3a135dfe216773c1a89cab53cbe5d662308d` | `src/engine/resources/theme.ts` |
| `c532e689df2a19cbffd52472daebdb7a19982bf5b2c0fedc9a3f03d1f2ad1800` | `src/baseChain.ts` |
| `8cbb4c084c038875bc7a02284d67886cb0526bcb7a020aa8d16cefa901c32aa7` | `tools/theme-loader/rasterAssets.js` |
| `09020316393de52ec3281ba39417df484c15e6e643a0788ae630192f88afaf6e` | `src/pixelBuffer.ts` |
| `68c46e736f1edf5759bdddb0a00a4c49cd5a7a1c6ff83e250742f514a1f83639` | `src/controlComposition.ts` |
