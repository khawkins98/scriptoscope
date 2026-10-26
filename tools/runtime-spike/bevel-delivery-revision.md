# Preserve legacy inputs in the prepared bevel runtime

Revision of draft PR #483, runtime `0f8ea230`, against frozen merged `f7d93afb`.
This supersedes the initial candidate's proposed raw-cinf requirement, changed
partial-alpha rendering, integer-only allocation gate and diagnostic differences.
Those compatibility losses are not being requested for approval by this revision.
Metadata snapshot timing remains the one approved contract amendment.

## Implementation

The facade prepares supplied legacy metadata into an explicit modern operation:
geometry, selected body resource/transport, display background and pattern phase.
This is not a synthetic decoded cinf, RGB16 sample or resource census declaration.
Absent or malformed raw cinf cannot veto valid supplied metadata. Ordinary raw
cinf/resource admission in other engine families is unchanged.

Preparation retains ordered linked/unique pattern selection and ambiguity,
aligned same-owner masked/unmasked mode5 binding, missing/unsupported/failure
separation, raster-solid and validated raw-display background selection. A slice
with a valid raster background still selects a solid body without a body request.
Existing soft fallbacks can select rectangular compatibility rather than becoming
new hard errors. Declared environments keep their stricter existing gates.

The engine shares body execution and coverage with normal cinf rendering. Prepared
bevel borders consume the same geometry planner while retaining two source-over
stages, independently normalized border insets and raw body insets. The prepared
border pass is asynchronous: it paints and reports each completed band before
requesting the next dependency. Later sampler failure retains earlier band
observations but withholds completed body/legacy stages. Callback-error precedence
and live owner disposal checks remain intact.

The facade supplies its existing raster allocator to this modern prepared path;
the ordinary synchronous engine has no new runtime dependency on the browser
facade or PixelBuffer module. Registered resources are captured only when needed.
Compatibility sampler admission remains independent of an equivalence proof;
wholly clipped bands do not even resolve an unused companion reference. Pattern
phase still validates signed control edges before painting, including mode 0.
The experimental integer-only allocation guard has been removed.

## Honest reduction

| Measure | Frozen baseline | Revised candidate | Delta |
| --- | ---: | ---: | ---: |
| Production logic physical lines | — | — | **−55** |
| Production table physical lines | — | — | 0 |
| All emitted JavaScript chunks, bytes | 704891 | 703643 | **−1248** |
| Sum of individually gzipped chunks, bytes | 223651 | 223699 | **+48** |

The former 222-line saving is withdrawn for the revised implementation. Adapter,
prepared-input types, async orchestration, transfer policy and all runtime loader
changes count in the 55-line result. Relocation is not separately credited. Tests,
spike tooling and documentation are reported separately; the overall repository
patch adds validation material. No package tarball reduction, startup, memory or
paint-throughput improvement is claimed.

This is a modest consolidation. It does not establish a substantial simplification
of the whole runtime or close the gap with the original application. Keep the PR
draft while assessing whether the small reduction and shared execution justify
the change; do not present it as the larger optimization effort being complete.

## Frozen-reference measurement

The final public source and built renderers, through default eager and owned
loading, match all 13824 ordinary comparisons: 12672 identical rendered results and
1152 matching nulls across 18 bundled themes and six rectangular synthetic fixtures.
The three separate probes formerly rejected by the candidate—missing-cinf solid,
missing-cinf pattern and present short cinf—now match reference pixels.
Metadata-backed opaque and alpha 128 pattern probes also match in both source and
built code; the earlier 103-pixel partial-alpha difference has been eliminated.
These seven additional probes are not included in the 13824 matching denominator.

Local ignored receipt:
`tools/runtime-spike/.artifacts/bevel-delivery-05/bevel-delivery-results.json`,
20829 bytes, SHA-256
`56a46933a2eec86702fc2665aead86a5f78ef6a979ea725ddb12e784a988eced`.
It pins the runtime/build/driver/archive inputs; system fonts are not pinned.
This is bounded current-output comparison, not native-fidelity certification.

```sh
npm run build
SCRIPTOSCOPE_RUNTIME_REFERENCE_ENTRY=tools/runtime-spike/.artifacts/deletion-baseline/compiled/scriptoscope.js \
SCRIPTOSCOPE_ARTIFACT_DIR=tools/runtime-spike/.artifacts/bevel-revision-next \
node tools/runtime-spike/run.mjs --bevel-delivery
```

## Validation

Build, typecheck, clean-room lint and eleven focused prepared-input regressions
pass. The generic push engine's twelve tests pass after removing the experimental
runtime PixelBuffer dependency. An earlier full Node run exposed that module
resolution regression; the fresh stable final run passes 1165 with 0 failures,
2 skipped and 12 TODOs.

At runtime `4ee529a9`, all 54 unchanged independent affected checks passed,
including frozen delivery 26/26 and existing affected 28/28. The full normal
default browser suite then passed **602/602, with 0 failures** in Chromium DPR1.
All 18 public option/source-built theme matrices passed; no other-family
regression appeared in that run.

After merging final runtime `0f8ea230` and documentation `6f333816`, the isolated
independent author rebuilt and reran the affected suites: **54/54 pass**, retaining
frozen delivery 26/26 and existing affected 28/28. Eight additional public probes
pass across source and built code: signed pattern-edge bounds, an unused clipped
companion reference, negative-corner border normalization, and fractional pattern
geometry. The full browser suite was not repeated for these final targeted fixes.
Final build, typecheck and clean-room lint pass; the latter reports 0 hits.

Acceptance assertions, evidence and goldens remain unchanged. Earlier prototype
failures remain recorded in the superseded candidate report; they are not final
revision failures and were not removed by changing expectations. These are bounded
compatibility checks, not exhaustive input coverage, native-fidelity certification
or a performance benchmark. Chromium default-profile results do not establish
all-browser or all-platform output identity. The approved metadata timing amendment
and the modest consolidation assessment remain as stated above.
