# Prepared bevel runtime candidate

Superseded by the [compatibility-preserving revision](bevel-delivery-revision.md).
The measurements and proposed losses below describe the earlier candidate.

This branch contains an implementation for review, not an approved compatibility
change or a merge-ready release. It replaces bevel's independent body resolvers
and border painter with the existing cinf engine and retains rectangular legacy
resizing. The public input adapters still converge on `ThemeView`; no additional
public theme representation or compatibility flag is introduced.

## What was simplified

`prepareThemeIcon` now prepares a captured face for both the ordinary engine
resource adapter and the bevel facade. Selection remains outside this helper.
The bevel facade passes its already-decoded raster, actual signed occurrence and
owner directly; it does not ask the generic catalog to select the face again.
The engine receives that selected attribution explicitly. Same-ID body resources
still use normal same-owner body preparation, independently of the captured face.
Inherited body attribution retains depth relative to the original invocation.

The old bevel-only pattern resolver, mode5 resolver and two-stage border painter
are deleted. Both eager and owned themes follow the same code. Rectangular
`nineSlice` remains a distinct operation with its existing conditional center fill
and detailed legacy diagnostic. Labels, font sizing and clipping remain facade
policies. This is a first vertical slice, not a completed whole-runtime rewrite.

## Measured code and build sizes

Baseline: frozen normal compiled build of merged `f7d93afb`. Candidate runtime:
`c435389a`; driver receipt revision `8f1104b1`. Earlier spike commits change only
implementation-owned tooling/docs and are not credited as runtime savings.

| Measure | Baseline | Candidate | Delta |
| --- | ---: | ---: | ---: |
| Production logic physical lines | — | — | −226 |
| Production table physical lines | — | — | +4 |
| Combined production physical lines | — | — | **−222** |
| All emitted JavaScript chunks, bytes | 704891 | 694696 | **−10195** |
| Sum of individually gzipped JS chunks, bytes | 223651 | 221052 | **−2599** |

Production includes changed `src/` and runtime loader code; tests, experiments,
docs and generated declarations/maps are separate. The five added regression
tests are 111 lines. The helper extraction itself is relocation and earns no
independent saving; the combined production delta counts all adapter additions
and the loader registration. Gzip numbers are sums of compressed chunks, not a
package tarball or browser transfer forecast. Startup time, paint throughput and
memory have not been benchmarked for this candidate; no speedup is claimed.

## Frozen-reference comparison

The current public source and built renderers, through both default eager and
owned loaders, are compared with the frozen public renderer. Its receipt hashes
are checked before use; no historical renderer source or maps are inspected.

- 18 bundled themes ×144 cases ×4 source/build/transport variants: 10368 cases.
- Six implementation-owned rectangular fixtures ×288 cases ×2 source/build
  variants: 3456 cases.
- Total: **12672 identical rendered results, 1152 matching nulls, zero ordinary
  pixel/dimension/availability/error changes** across 13824 comparisons.
- Four comparator mutation probes detect pixels, dimensions, availability and
  errors. This is a bounded measurement, not complete compatibility certification.

The separate exception probes are not included in that matching denominator.
Missing-cinf solid and pattern declarations, and present short cinf, paint in the
reference and reject in the candidate. A metadata-backed opaque pattern fixture
matches; the same fixture at alpha128 changes103 pixels in each source/build
comparison. The engine's transfer semantics deliberately replace the old
successive alpha-over stages. Rectangular partial-alpha compatibility still
matches in its ordinary matrix.

The report pins archives, runtime (including untracked production files), build,
driver bytes and browser identity. It does not pin system fonts or establish
cross-machine performance or original-engine fidelity.

Local ignored receipt:
`tools/runtime-spike/.artifacts/bevel-delivery-03/bevel-delivery-results.json`,
21188 bytes, SHA-256
`22ee0d41c0d832a5824bf466d855103ed1421c3abf8b6494cc6451e81f15019d`.

```sh
npm run build
SCRIPTOSCOPE_RUNTIME_REFERENCE_ENTRY=tools/runtime-spike/.artifacts/deletion-baseline/compiled/scriptoscope.js \
SCRIPTOSCOPE_ARTIFACT_DIR=tools/runtime-spike/.artifacts/bevel-delivery-next \
node tools/runtime-spike/run.mjs --bevel-delivery
```

## Compatibility and migration to review

Only metadata snapshot timing is already approved. The candidate does not promise
a complete entry snapshot or immutable caching across renders. Pending-render
metadata/getter mutation remains outside the approved timing contract; registered
owner lifetime stays live.

Additional changes need review together:

1. Metadata-backed bevel bodies require an admitted raw cinf or the existing
   declared environment. Ordinary supplied legacy fields no longer override
   missing/malformed raw cinf. Reload archive-backed themes with the new loader
   defaults. Hand-built themes need valid cinf/body/sample inputs or a supported
   declared environment; reloading cannot repair an intentionally malformed input.
2. Metadata-backed resource validity, sampling and transfers follow the shared
   engine. Partial alpha can visibly change. This is not a native-fidelity fix.
3. Output allocation dimensions must be positive finite integers no greater than
   32767. Correct fractional or malformed caller dimensions before migrating.
4. Metadata-backed body/band diagnostics adopt engine events, basis and ordering.
   Consumers must stop depending on the old transcript. Callback completion,
   callback-error precedence and disposal protection remain required.

Positive aliases, first-match face selection, state fallback attempts, selected
owner identity, ordinary measured pixels, declared-environment admission/no-body/
label gates and public entry points are retained requirements. Review found and
fixed an alias cinf-key bug and an inherited diagnostic-depth bug; these were
implementation defects, not proposed compatibility retirements.

## Validation status

Build, typecheck and clean-room lint pass. The existing Node suite passed1154
with0 failures,2 skipped and12 TODOs before the two retained-contract fixes;
the five focused captured-face/alias/depth/lifetime regression tests pass afterward.
The isolated redteam passed30 targeted implementation tests at the first candidate.

The independent author keeps acceptance assertions, evidence and goldens frozen.
At the first candidate, the new delivery suite was8 pass/18 fail and additional
pattern/body-completion checks20 pass/2 fail. Relevant existing face-band, mode5,
declared-environment, legacy-trace and callback/disposal checks passed48/48.
Those early failures establish unapproved compatibility losses; admission-blocked
cases do not separately prove later alpha/callback behavior defective. A full
browser run and affected rerun after the retained-contract fixes are tracked by
the independent author and must be reported before marking the PR ready.

Do not merge or update expectations merely to turn these changes green. Review
and approve the compatibility package first, or reject this candidate and choose
a different subsystem. Keep the current checks as the record of the old contract.
