# Proposed independent evidence-owner handoff

Status: the maintainer explicitly authorized the separate verifier assignment.
A fresh verifier is working in isolated branch
`khawkins98/independent-extraction-refresh`, based on the exact candidate below.
The implementer remains excluded from independent evidence and review material.

## Assignment and return boundary

Assign a fresh independent verifier, in a separate isolated worktree with no
inherited implementer conversation, to establish and review extraction-provenance
and acceptance-binding freshness for the frozen candidate below. This must be a
separate evidence-owner assignment, not an expansion of the implementer role.
The implementer remains excluded from independent sources, oracle data and
verifier review material under docs/spec/engine/IMPLEMENTER-BRIEF.md.

The verifier must follow the evidence owner's existing update/review rules.
Determine what each pin attests to and whether the supported generators consume
permitted inputs. Regenerate using the documented procedures rather than manually
replacing failing hashes. Hash-only updates are sufficient only if the independent
contract permits that and associated extraction payloads are independently shown
to be unchanged. Review acceptance-binding drift separately; do not assume it is
justified by refreshing extraction identities.

Do not change behavioral expectations, goldens or source fixtures. Do not inspect
original listings or private/reference sources. If review requires those inputs,
a behavioral expectation change, or authority reserved to a named owner, stop
and route the issue to that owner. A fresh context alone does not establish
independence or permission. Any implementation clarification must be listing-free
and routed through the spec author.

Own the generated evidence changes in a separate commit or small stacked evidence
PR. Detailed verifier review goes to the maintainer/evidence owner, never to the
implementer. Return only completion/blocking status, commit identification and
permitted public command results. The implementer can then rerun assigned public
checks without inspecting independent artifacts or their diffs.

## Frozen inputs and public evidence

- Implementation candidate: `6cfe9afda52825b848702aef942065f3daf6a647`.
- Frozen starting revision: `de942c6399c81d1f15d23247dfd62a36e11a64bc`.
- Separately compiled regression reference: `f905de9d240a89b29bfa745588b5e0f7f7a90d7e`.
- Decoder consolidation commit: `1ff5c50f`; interaction cleanup: `6cfe9afd`.
- Hash delta baseline: `68a97a30311d80a013c91824e3c1cc4afdebdebf`.
- Exact delta: `extraction-change-results.json` in this directory.
- Output comparator and input fingerprints: `production-reference-results.json`.
- Check ledger: `validation-results.json`.
- Build provenance: `frozen-build-results.json`, `current-build-results.json`,
  and the reference build metadata embedded in the comparator report.

The comparator passes all 18 themes: 8,424 button paints, 1,728 windows,
432 scrollbars, 18,704 current public raster checks and 18,704 additional reference
raster checks; zero mismatches. It also exercises the 19,152-case family matrix,
which includes painted, matching missing and explicitly unsupported outcomes.
This is regression evidence, not an acceptance oracle or authorization to approve
a provenance refresh. The reference is a compiler-only reconstruction, not a
recovered release or original-engine executable. The reference comparison ran
alongside browser contracts and is not isolated performance evidence.

## Changed runtime input identities

These are changed implementation inputs, not a claim that every listed file is
independently pinned. The verifier must establish the actual pinned scope.

| Runtime input | Before SHA-256 | Candidate SHA-256 |
| --- | --- | --- |
| `tools/theme-loader/buildThemeJson.js` | `0173d9601e07d43d8e0b55a2bf93c006a57f70bf0e3a3c880d9d1303ab511dce` | `dcb2785a8963083133c57947bd6c39cf3a436941bff26220e41584a043da1d86` |
| `tools/theme-loader/convert.js` | `6b795864fd2aecb0181ca90a8fca928965524e3fca337b6dddd58a49e89b1cf9` | `05601ef8f6eec3b465930d8590a4c8289c7e5945b472740b5adb33d4326acd26` |
| `tools/theme-loader/decoders/cicn.js` | `35cc33ca8eae4181ab10d40e1c72afdccd7429977b62f99fb5f62f0bda314b7e` | `f3171f93025127e2f6c2a8b98393ab6909f279a4f49236b006f0e50630a1121e` |
| `tools/theme-loader/decoders/ppat.js` | `2b4dc9158ac63fa776333a63282b8264bf6afab8d11a662e3574b7452bcf1bbb` | `5ff62a44eca9ecbcf99b7a4adb938f13efb3178d256a0c5d864f075368f3d908` |
| `tools/theme-loader/decoders/shared.js` | `706dc51b01571efdaca7eb674a90cc643c28b7995500f5b1a0394a0a35e9e8a5` | `b69cd652074d6016ae48c57267e114654c07e0e8bf2fe12ce060ea945660bcbf` |

## Observed public checks

- `npm run gates`: typecheck and clean-room pass; Node suite has 1,139 passes,
  eight failures, two skips and twelve TODOs. All eight failures report extraction
  toolchain hash drift; the umbrella stops there.
- `npm run test:availability:sources`: extraction toolchain hash drift.
- `npm run test:rendering`: 574 passes / two availability failures, both reporting
  extraction toolchain hash drift. No other browser failure appeared.
- `npm run test:acceptance:bindings`: binding artifact drift; regenerate and review.
- `npm run test:rendering:container -- verify`: all 36 pinned Linux goldens pass.
- Loader units: all 164 pass. Packed consumer passes. All 12,902 engine-diff cells
  remain unchanged. Strict theme lint, scene audit, requirements, references and
  source-input checks pass when run separately.

After justified evidence regeneration and owner review, rerun complete gates and
the required browser suite, not only the ten previously blocked tests. Preserve
their meaning and existing golden expectations. Record candidate/input identities,
generator commands and public validation outcomes in the verifier's own evidence
commit/review. Keep the integration draft until the independent process completes.

The eight older optional visual failures are a separate unresolved spec handoff;
this refresh must not rewrite their expected behavior or imply they are resolved.
