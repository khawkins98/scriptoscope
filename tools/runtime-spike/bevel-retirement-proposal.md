# Bevel renderer retirement proposal

Decision requested: accept losing authored bevel rendering in six bundled themes
in favor of the caller's procedural/native fallback, so the existing cinf engine
can replace bevel's separate renderer. The spike loses 864 of 2,592 current
renders; its surviving samples match. This is a proposal, not a new
behavioral specification or permission to change shipped rendering. The user
authorized preparing compatibility changes for review on 2026-10-26.

Baseline: `f7d93afb37e08491da30f69fdc30dcd774ec72ee` (merged #480).
Production source is unchanged in this spike. Astra advised the scope and
reviewed the deletion sketch. No historical source, private reference material,
independent acceptance source or verifier material was consulted.

## Recommended scope

Keep `composeBevelButton`, its ordinary state options, sizing, labels, logical
composition context, eager and owned theme inputs. Replace bevel's body/border
execution with `themeResourceChain` and `drawCinfFrame` directly. A push-button
driver would introduce unwanted state, ring and label policy.

Delete the replaced renderer in the delivery PR. Do not retain it behind a
compatibility flag. Keep public `PixelBuffer.nineSlice`, the grow/disclosure
lookup graph, other control families, and both theme loader contracts.

Owned-only API retirement is a separate, broader migration. It affects package
callers, mounts, resolvers and image consumers while offering no demonstrated
large renderer deletion. It is not recommended for this first cut.

## Compatibility changes to review

| Boundary | Proposed contract and migration |
| --- | --- |
| Missing metadata | If selected art has no usable cinf after the engine's normal lookup/retry, return `null`; callers choose `platinumBevelButton` or their native presentation. Remove bevel's nine-slice plus sampled-center approximation. |
| Invalid present data | Reject malformed, ambiguous or unknown dependencies. Do not turn uncertainty or decoder errors into missing resources. |
| Geometry | Require positive, finite integer allocation dimensions no greater than 32767. Use admitted engine metadata and Rect geometry. Retire bevel-only fractional traversal and scalar arithmetic guarantees. |
| Partial alpha | Use engine transfer semantics; retire the two successive bevel alpha-over stages. This can visibly change fractional-alpha artwork. It is not equivalent blending. |
| Identity | Preserve state precedence and the candidate sequence, but use exact signed resource identities. Positive aliases and contradictory/duplicate catalog declarations must be corrected or reloaded from their source archive. |
| Body resources | Use existing same-face-owner preparation and census/ambiguity rules. Keep aligned mode-5 copy restrictions; do not introduce scaling or silently fall back to approximate painting. |
| Samples | Use the engine's finite sample and companion admission. Do not recreate a second bevel-only sampling implementation. Inputs lacking required outputs remain unsupported. |
| Mutation | Options and finite selected facts belong to one preparation. Mutating supplied theme metadata while composition is in progress is outside the new contract. Retire getter-count, late descriptor mutation and partial-write observation guarantees. Preserve owner identity and disposal protection. |
| Diagnostics | Keep the completion callback envelope and callback-error policy. Selection/body/band observations come from the engine. Event ordering/reasons can change; bevel no longer emits `legacyFacePaint`. Consumers must stop treating the old transcript as stable. |

Keep the existing declared cinf environment's admission, no-body result and label
restriction unless separately changed by a public specification. The prototype
does not implement that boundary; it rejects it explicitly. This omission is
not a recommendation to remove the feature. Ordinary text sizing, centering,
foreground overrides and emboss remain facade policies.

No old pixel difference becomes approved merely because the new engine produced
it. This proposal makes no claim of better original-engine fidelity.

## Deletion budget

Current function spans, counted from declaration start to closing brace in
`src/controls.ts`, including comments inside the function:

| Function | Physical lines |
| --- | ---: |
| `loadCicnBody` | 49 |
| `loadBodyPattern` | 69 |
| `composeFaceButton` | 202 |
| `composeControlBorder` | 65 |
| `composeBevelButtonWithTrace` | 23 |
| Total gross replacement surface | 408 |

These are gross spans, not net savings. A replacement sketch needs approximately
160–255 production lines for selection/preparation, sizing/text, execution/clip
and diagnostic translation. This suggests 153–248 lines of possible net
reduction, conditional on the reviewed contract. Additional shared changes also
count against the budget. Ancillary type/import/helper cleanup is not credited
in advance. Moving code or compressing formatting earns no architecture credit.

Delivery gate: at least 150 fewer production logic lines across `src/` and the
runtime loader, with cited table data reported separately. Stop and reconsider
if the measured implementation cannot meet that gate. Report built/gzip bytes
separately; source reduction does not establish a smaller or faster package.

## Non-shipping comparison

`bevel-candidate.mjs` exercises the existing resource adapter and cinf painter;
it is not exported by the package or included in the library build. It loads
additional bevel cinf/sample inputs through the current loader options, so a
future delivery must register those needs and tell existing callers to reload
themes. A renderer-only swap on old decoded objects is not the migration.

The existing runtime-spike runner validates the frozen compiled reference's
hashes, executes public exports opaquely, pins current runtime/build/driver bytes
and rejects changes in those pinned inputs. Its runtime inventory includes tracked
files; it does not pin fetched theme archives, fonts or untracked runtime files.
Extend that provenance before using it as a delivery-validation receipt.
`--bevel-proposal` reports `measured`, never an equivalence pass. The comparison is
a frozen public renderer versus an internal proposed adapter, not two complete
public implementations. Raw reports remain ignored under `.artifacts/`.

```sh
SCRIPTOSCOPE_RUNTIME_REFERENCE_ENTRY=tools/runtime-spike/.artifacts/deletion-baseline/compiled/scriptoscope.js \
SCRIPTOSCOPE_ARTIFACT_DIR=tools/runtime-spike/.artifacts/bevel-proposal-next \
node tools/runtime-spike/run.mjs --bevel-proposal
```

The measured matrix covers 18 bundled themes and 144 combinations each: regular/
small, on/off, normal/pressed/disabled, automatic or explicit size, empty/text
labels, and local/offset clipped contexts. Four mutation probes check that the
comparator detects pixel, dimension, availability and error differences.

Measured results (2,592 comparisons):

| Outcome | Cases |
| --- | ---: |
| Both render, identical dimensions and RGBA | 1,440 |
| Both return `null` | 288 |
| Existing render becomes `null` because cinf lookup is absent | 864 |
| Different pixels among two rendered results | 0 |
| Changed errors or dimensions | 0 |

All 864 lost themed renders are in six themes, 144 each: `1138`, `1984`,
`apple-platinum-2`, `black-platinum`, `platinum-8`, and
`system7-nostalgia-silver`. Selected art exists; the engine cannot find its cinf
or the fallback cinf. Today's bevel path paints anyway. The proposal returns
`null` and requires the caller's procedural/native fallback. This is a visible
compatibility cost, not an optimization that preserves every theme's pixels.
Three runs gave the same aggregate counts. The second adds the missing-resource
stage and direction to each availability difference. The final run corrects the
prototype's handling of a defined empty foreground override; overrides remain
outside this matrix. Earlier receipts are retained.

Authoritative local receipt:
`.artifacts/bevel-proposal-03/bevel-proposal-results.json`, 625250 bytes,
SHA-256 `fb3889cf94ea5e8a37c6b4cdd5718ef71d78ff856678a0c8f778c8b9cd0c15b7`.
Runtime fingerprint `5f83483787e4702fb9234b9240236fdf5f1350df62e62aab318808daefa5a2a3`;
driver fingerprint `f590b4c68361185ab74f184f9e574b3c194bbb907382d6cc3d46b7b5b4a0ff3b`.
The frozen compiled build and its per-file hashes are retained in the local
`.artifacts/deletion-baseline/build.json`. Missing source-map warnings are
expected: this comparison loads compiled exports without historical maps.

Limits: owned loading only; no standalone declared environment, base inheritance,
foreground overrides, malformed/fractional synthetic input, temporal mutation or diagnostic transcript
coverage. It measures compatibility loss against today's runtime, not correctness
against the original application. It is not a benchmark.

## Delivery sequence

1. Review the concrete compatibility boundaries and corpus effects in this spike.
2. Have the independent specification/test owner publish the revised public
   behavioral contract and acceptance additions. Preserve existing results as
   evidence of deliberately changed compatibility; do not rewrite them to agree
   with the prototype. #481's coverage is a prerequisite, not authorization to
   relax its expectations.
3. Implement one typed bevel facade using the existing engine, register loader
   inputs, retain required declared-environment and completion behavior, and
   delete the old path in the same feature PR. No new generic operation framework.
4. Run the frozen-reference harness: unchanged families remain exact; every bevel
   difference must match an independently approved boundary. Add public migration
   examples for `null`, invalid inputs, aliases, metadata reload and diagnostics.
5. Require measured net deletion, ordinary build/type checks, relevant independent
   browser/engine checks and adversarial review before landing.

The immediate review is about this narrow retirement, not a full reimplementation
or permission to delete other public APIs.
