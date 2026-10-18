# Control resource-resolution diagnostics

`composeButton` (plain/default), `composeBevelButton` and `composeTab` accept optional
`diagnostics: { onComplete, correlationId? }`. Each invocation owns a private
collector and calls `onComplete` once with a deeply frozen `ControlRenderTrace`.
Nothing is emitted or retained globally. Tracing does not own themes, dispose
assets, retain decoded pixel buffers, or change selection/rendering decisions.

```ts
const pixels = await composeButton(theme, {
  label: 'OK', default: true,
  diagnostics: {
    correlationId: 'dialog/ok',
    onComplete(trace) { console.log(trace); },
  },
});
```

The public package exports `ControlDiagnostics`, `ControlRenderTrace` and
`ControlResolutionStep` and `TabBodyTrace` types. Completion is per compositor invocation, not per
DOM mount or interaction; a higher-level caller can invoke a compositor more
than once. The declarative mount/closed-select path does not yet forward a
consumer diagnostic callback. Other control families remain outside this trace.

## Record and identity

Version 1 records the family, effective requested state and original boolean
options, ordered resolution steps, and an outcome (`themed`, `unavailable`, or
`error`). A themed outcome also records the returned pixel dimensions. An
unavailable outcome means the compositor returned null; it does not establish
that no applicable original resource exists or that procedural fallback is valid.

Each step records its role, canonical requested ID, action, reason, evidence basis
and usage. Owner identity includes the owning theme's `baseUrl` and zero-based
base-chain depth. Candidate/selected resource identity includes type `cicn`, actual
signed `sourceCicnId`, `sourceCinfId`, manifest key and resolved asset URL. Missing
metadata IDs are null, never fabricated from the requested role. A positive-ID
alias therefore remains positive even though the canonical request is negative.
State-transition or aggregate missing events may have no resource or owner.

Use owner/base-hop/type/signed-ID/cinf/key when assessing selection. Asset URLs
are diagnostic details: blob URLs and server origins vary between executions.
Join source archive hashes from capture provenance; the trace does not invent
an archive identity. Opted-in loads additionally carry exact per-entry
`byteProvenance` references; join these to the owning load record as described in
[actual byte provenance](resource-byte-provenance.md). Absent evidence stays unknown.
A `selected` step means that metadata won the existing
resolver. A later decode/render can fail, so it is not itself proof that those
pixels were painted. `rejected` includes the rejected candidate's identity.

## Policy versus original dispatch

The recorded basis applies to the individual decision, not to the entire render.
Canonical push/bevel IDs and the default-ring state dispatch are established
source facts. Named-key preference, label/key anti-role rejection, positive-ID
aliases, base inheritance, face-state fallback and the final raw-ID escape are
runtime compatibility policies. Their presence in a trace does not certify
historical intent. For example, Animals/Monkey active faces reject the observed
`Solo Menu Background` label on -10239, then choose the pressed face -10238 by
runtime policy. A label is provenance; its interpretation is still a heuristic.

Current reason strings include `named-role`, `resource-id`, `positive-id-alias`,
`anti-role-label`, `anti-role-key`, `missing-resource`, `base-inheritance`,
`active-to-pressed`, `inactive-to-active`, `raw-id-escape`, `active-id-fallback`,
`bevel-unpressed-fallback`, `bevel-default-fallback`, `pressed-ring-to-active`,
`ring-paint` and `ring-unavailable`.

Ring metadata lookup has `usage: layout-reservation`: plain buttons reserve the
ring footprint by runtime policy without decoding an unused ring. A default
button adds a distinct `usage: paint` decision for its selected ring (or missing
ring outcome). The pressed-ring fallback to active is source-backed; selection
can record requested -10230 and actual -10231 without rewriting either identity.

## Completion and failures

The callback is synchronous. On successful rendering, a callback exception
propagates once; it is not reclassified as a rendering error and causes no second
callback. On renderer failure, the callback receives one error trace, any callback
exception is suppressed, and the original renderer error is rethrown unchanged.
No aggregate-error API or logging is introduced. Async callback promises are not
awaited; consumers should handle their own asynchronous reporting failures.

A shared callback can receive concurrent renders in completion order. Use a caller
correlation ID when ordering matters. Records and their nested arrays/objects are
separate and frozen; one callback cannot mutate another invocation's evidence.

## Harness and validation

The matrix records `resolutionTrace` for direct push/default/bevel/tab cases and null
for uninstrumented paths. Source/built case artifacts retain their own actual
traces; transient URLs are not compared as stable IDs. Golden page observations
retain the built trace. Source-art galleries remain candidate art, not a second
resolver or an expected-selection oracle. The visible sheets and their reviewed
PNG expectations are unchanged.

Hand-authored browser expectations cover Animals/Monkey/Windows95 face and ring
states, synthetic child/base ownership, anti-role rejection and raw-ID escape,
positive/unknown signed IDs, bevel fallbacks, metadata-only ring reservation,
concurrent callbacks, error precedence and tracing-on/off pixel equality. Unit
checks isolate completion ordering and deep immutability. These tests establish
the diagnostic contract and declared runtime policies; independent availability
expectations and full historical fidelity remain separate work under #228/#221.

## Tab paint diagnostics

`composeTab(theme, { label, selected, diagnostics })` uses the same completion,
freeze and error contract. The additive `family: 'tab'` record retains
`requested.selected`; its requested state is active (this API has no disabled or
pressed tab option). Resolution records the actual requested front IDs
`-9972`/`-9980` or rear IDs `-9975`/`-9983`, actual selected face and owner, and
`tab-small-to-large` when the small-art attempt is unavailable. This order and
base/alias resolution remain explicit **compatibility policy**. No expected
catalog lookup is substituted for the actual compositor selection.

The exported `TabBodyTrace` type describes `trace.tabBody`, emitted by the body
helper at the branch it actually executes:

- `source-bands` records source dimensions, requested output width, corner/side,
  repeat flag, and `center: 'empty' | 'solid'`. Background policy is `none`,
  `raw-sample`, or `decoded-anchor`. An empty center needs no background request
  and must not be confused with an unsupported positive center.
- `legacy-three-slice` records a precise reason: missing/invalid slice or size,
  missing/invalid body request, nonzero pattern center, missing/invalid anchor,
  or masked decoded background. These are current compatibility decisions,
  **not** proof of the original engine's fallback behavior. A missing face or
  failed decode has no body decision; use the completed outcome and steps.

`source-dispatch` on a supported body identifies the implemented source-derived
band geometry. It does not authenticate a decoded-anchor sample as raw RGB16,
certify device/display conversion, or validate retained text layout and variant
selection. Requested width includes the existing API label-width policy; the
completed outcome reports the actual returned dimensions, including legacy
cropping. Diagnostics do not add a decode, change pixels, or assume ownership.
No detailed branch record is constructed when diagnostics are disabled.

`tab-trace.spec.mjs` joins actual selected face references to the **owning load's
resource occurrence**, then to independent 1138/1990 archive/fork and cicn/cinf
payload pins. Missing trace/provenance remains unknown and cannot pass. Wrong
owner, base depth, manifest key, request, load ID, occurrence, payload or branch
fails even if source and built would agree with each other. Concurrent same-ID
loads carry distinct invocation references; ambiguous generated asset identity
is rejected by the opted-in loader. These finite assertions add diagnostic
coverage only; no requirement-ledger assessment or historical scope is promoted.


## Painted sampled-band dependencies

Push/bevel/default-ring `bandPaints` are emitted only for visible opaque output
regions. They distinguish ordinary raster copies, equivalent-raster expansion,
actual sampled companions and compatibility-raster fallback. Their owner/key
and existing element provenance identify the selected cicn occurrence; only
actual companion paint adds its stable derivation path and volatile URL.
Layout reservation and decoded-but-aborted work do not become painted
companions. See [the sampled-band contract](sampled-control-bands.md) for source
branches, ownership and current-display limits. These are observed decisions,
not original-device or independent decoder certification.

### Mode-5 body paint

`body-fill` steps can carry `bodyPaint` for actual aligned mode-5 writes:
`masked-copy`, `unmasked-copy`, or `missing-erase`, with source/destination
rectangles and visible painted-pixel count. A selected target's ordinary resource
identity remains separate from `bodyPaint.sourceAssetUrl` (the actual derived
transport for unmasked copies) and stable `derivedPath`. Unsupported, clipped,
aborted or failed dependencies do not become successful body paint. The
step is staged until face completion and omitted if a later default-ring failure
prevents publication; other diagnostic channels retain their existing meanings. The
[same-owner binding policy and limits](cicn-body-mode5.md) remain explicit; this
additive step data does not replace band, text, composition, tab or header channels.
