# Bevel engine consolidation: compatibility package for review

Status: proposal only. Snapshot timing is approved; the other changes below are
not approved or implemented. This replaces the unsupported exact-preservation
deletion estimate in the experiment report. Astra reviewed the current public
implementation and proposed this package.

## Proposed boundary

Keep `composeBevelButton`, eager and owned inputs, state precedence and fallback
attempts, positive aliases, first-match face selection, sizing defaults, labels,
composition context and diagnostic completion/error handling. Carry the selected
owner and captured face raster into preparation rather than reselecting it through
the generic engine catalog. Preserve declared-environment admission, transparent
no-body results and label restrictions.

Use two recipes:

- Admitted metadata-backed faces use existing cinf body preparation and
  `drawCinfFrame`, including its geometry, resource and sampling admission and
  transfer semantics.
- Ordinary faces without cinf, body requests or solid-body declarations keep
  rectangular `nineSlice` and conditional sampled-center fill, including current
  copying, alpha treatment and `legacyFacePaint` diagnostics.

Missing-cinf faces carrying solid, pattern or mode-5 declarations become
unsupported errors. Present malformed cinf also rejects. Some of these inputs
currently render; this is a compatibility loss, not a correctness fix. Require
positive finite integer output dimensions within the engine's supported range;
fractional and malformed-value rendering is retired.

Metadata-backed fractional-alpha artwork can change because engine transfers
replace bevel's two-stage blending. Metadata-backed diagnostic body/band events
and ordering adopt engine observations. Keep their field schemas and the
completion envelope, callback-error precedence and selected-owner attribution;
consumers depending on the old detailed transcript must migrate.

Capture selected metadata per invocation under the approved timing amendment.
Keep registered-owner disposal checks live. Do not load unselected raster planes
for snapshotting. Retain demand-driven companion loading where supported by the
existing engine; do not promise the old asynchronous observation sequence.

## Evidence and remaining work

The prototype measured 4,032 matching rendered results and 288 matching nulls,
restoring the six themes lost by the rejected full-fallback retirement. This is
bounded pixel evidence, not validation of this complete package.

Three separate probes already demonstrate compatibility losses: missing-cinf
solid, missing-cinf pattern and present short cinf currently render and the
prototype rejects them. Metadata-backed partial alpha, mode-5 variations,
selected-face adaptation with aliases, declared environments, inheritance,
diagnostics, malformed dimensions and failures need targeted comparisons.
Rectangular partial-alpha matches do not validate metadata-backed blending.

## Delivery and review gate

Replace `composeFaceButton`, `composeControlBorder`, `loadBodyPattern` and
`loadCicnBody` orchestration with a small facade, captured selected-face adapter
and the two recipes. Keep grow/disclosure helpers and public `nineSlice`. Delete
the replaced metadata-backed renderer in the same PR; no compatibility flag.

The counted replacement surface is 408 physical lines. Astra's preliminary
replacement allowance is 200–300 lines before shared adapter/loader changes.
This is a hypothesis to test, not a net-saving promise. Count all production
changes and report bundle bytes separately. If the adapter recreates a large
admission framework, reassess rather than claiming relocation as simplification.

Review this package as a whole before implementation. Approval of metadata
snapshots alone does not authorize its pixel, admission or diagnostic changes.
If these losses are unacceptable, the present experiments do not establish a
substantial behavior-preserving bevel deletion; pursue a different subsystem.
