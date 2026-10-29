# Measured simplification

Our optimization approach is **consolidation and specialization, guided by measurement and differential testing**. It pursues two separate outcomes: less production machinery to maintain, and less work during execution. Neither outcome proves the other.

## Ask for it again

> Pursue measured simplification for both performance and code bloat. Consolidate duplicated runtime mechanisms into a small shared core. Prepare inputs once at an established boundary, then use proven constraints to replace expensive general work with simpler arithmetic or bulk operations. Validate against the frozen implementation through the existing harness, including exact pixels, errors, callbacks and lifetimes. Measure complete public operations and count all production code, including adapters and compatibility paths. Prefer net deletion; justify any added code with measured gains. Report speed, size, scope and limitations separately.

## The working loop

1. **Freeze and measure.** Record baseline revision, production tree, build configuration and toolchain. Profile representative public operations to find actual costs. Distinguish cold startup, warm rendering, drawing kernels and whole application behavior.
2. **State the contract.** Identify admitted inputs and observable results before editing. Include geometry, aliasing, phase, alpha, resource decisions, error order, callbacks, ownership and lifetime. Existing getter and snapshot behavior also counts unless an explicit compatibility decision changes it.
3. **Consolidate repeated mechanisms.** Look for duplicate executors, conversions, representations and orchestration. Replace them with one implementation where their contracts coincide, and delete the superseded paths. Charge every new adapter or repair against the savings.
4. **Find an existing preparation boundary.** Prefer private values already validated, resolved and copied into ordinary records. Prove useful facts there: integer coordinates, bounded rectangle cardinality, decoded pixel layout, opacity, clipping and non-aliasing. Reusing such facts can remove repeated work without adding another public policy.
5. **Simplify the operation.** Replace enumeration with arithmetic, repeated sampling with byte spans, or redundant passes with a shared operation. For example, clipped coverage of two integer rectangles is the sum of their areas minus their intersection. Decoded pattern rows can sometimes be seeded and repeated with bulk copies.
6. **Compare behavior independently.** Execute the frozen baseline and candidate through the same public harness. Compare complete RGBA bytes, including RGB under zero alpha, dimensions, statuses, resource records, traces, errors, callbacks and lifetime observations. Include boundary cases and checks that deliberately detect incorrect results. Label comparator sensitivity checks separately from runtime mutation tests.
7. **Measure the complete operation.** Keep fixture generation, decoding warm-up and correctness assertions outside timed samples. Include ordinary preparation, allocation, drawing and publication inside the measured public call. Alternate baseline/candidate order, use multiple processes, retain the planned samples, and report variation and uncertainty.
8. **Account and land.** Review the source and independent evidence, then run the required build, package contracts, browser matrix and exact goldens on the release revision. Ship one coherent change with its concrete benefits and limits.

Preparation is not permission to move validation, change asynchronous snapshot timing or reorder errors. If a needed contract change is intentional, propose its exact behavior and migration for review.

## Validate the measurement method

Bind actual serialized fixture and asset bytes before comparing builds; a hash of the generator alone does not prove its outputs identical. Use fresh logically equivalent mutable state for each variant. Verify the actual owned browser executable, product/version and live user-agent separately; the installed browser application may not be the browser the tool launches. Syntax-check the exact browser evaluation payload, and check numerical admission and analysis against synthetic known contrasts before freezing the experiment.

Counterbalanced order and multiple processes do not by themselves establish that two variants measured in one page have independent execution histories. An identical-baseline audit of the bevel protocol found a patterned ordinary workload second/first ratio of 0.820685, with simultaneous interval [0.727976, 0.925200], despite identical runtime bytes. That exceeded its preregistered reciprocal five-percent neutrality band. Slot contrasts remained inconclusive: a period effect alone does not prove an earlier counterbalanced candidate estimate biased or identify a JIT, cache or host mechanism.

If controls drift or a method changes, preregister a bounded identical-artifact audit before making a new speed claim. Keep process/block units separate from batch counts, fix practical resolution and multiple-endpoint inference before data, and retain all planned records. Wide nonsignificant intervals are inconclusive, not evidence of neutrality. A fresh process per artifact is a next isolation hypothesis to validate, not a demonstrated cure.

On admission failure, preserve partial records and stop that registration. A launch-wrapper repair or browser-identity correction needs a fresh binding before further measurement; failed attempts do not become accepted evidence retrospectively. Do not extend or repeat an audit merely to obtain a preferred result. Record the named workloads, actual browser/host scope, exposed configuration limits and positive resource cleanup.

## Keep the two scorecards separate

| Outcome | Evidence required |
| --- | --- |
| Smaller or simpler runtime | Net production lines/tokens and all emitted JavaScript, including shared/lazy chunks, wrappers, adapters, compatibility paths and repairs. Explain which representation, mechanism or policy disappeared. |
| Faster runtime | Measured complete operations on named workloads, with baseline/candidate identity, warm-up, paired sampling, variation and uncertainty. Fewer calls or a faster private kernel alone is insufficient. |
| Preserved behavior | Differential checks for the retained contract, plus required regression and fidelity checks. A passing baseline comparison does not independently prove fidelity to the original program. |

Use the same counting method and compressor for each before/after pair. Distinguish physical lines from noncomment lines, scanner tokens from contextual syntax tokens, and raw JavaScript from summed per-file gzip sizes. Do not combine unlike measures. A long instruction string counts as one literal token; that does not make its encoded operations simpler. Review the maintained data grammar, decoder, geometry and editing workflow as well as the numeric delta. Fixed-result specialization must earn its maintenance cost.

Moving logic into generated data, another package or an adapter does not erase its production cost. Minification may reduce shipped bytes, but it is not deletion of runtime logic. Static resources and fonts remain visible in the accounting.

A small code increase can be worthwhile for a substantial measured execution improvement. Report it as that tradeoff, not as code reduction. Likewise, a deletion can be valuable without a demonstrated speedup.

## Examples already landed

- [PR #493](https://github.com/khawkins98/scriptoscope/pull/493) consolidated eight private drawing executors into a shared CPU raster core. Including adapters and lifecycle repairs, it removed **161 noncomment production lines and 2,057 emitted JavaScript bytes**. It adopted two explicitly reviewed observation changes; no speedup was established.
- [PR #494](https://github.com/khawkins98/scriptoscope/pull/494) replaced a header coverage scan with arithmetic over privately prepared integer rectangles. It added **seven physical source lines and 117 emitted JavaScript bytes**. Independent measurements across five Chrome processes found **20–47% less time** for the measured warm synthetic solid-body header calls at 64×12, 320×24 and 1280×64, with exact public behavior checks. That is a workload-specific execution gain, not a whole application speed claim.

These demonstrate complementary results. Their timings must not be multiplied or generalized to unmeasured paths. Further specializations must earn their own evidence and full code-cost accounting.

## Guardrails

- Preserve the broader generic route when its supported inputs exceed the prepared route. An internal export alone does not authorize retiring behavior.
- Validate actual source, destination and storage constraints. Integer clip coordinates do not prove an integer backing stride; plan dimensions do not automatically prove destination dimensions match.
- Avoid accumulating a second renderer, caches, eligibility policies and fallback layers around every optimization. Reassess when compatibility machinery outweighs the benefit.
- Reject or park trials that change retained pixels or behavior, fail to improve measured operations meaningfully, or add unjustified production complexity. A rejected experiment is useful evidence.
- Keep benchmark collection responsive without inserting instrumentation into timed samples. A control-protocol timeout does not establish that the browser workload stopped.
- Freeze artifact payloads. Publish content-addressed archives/manifests and verify every emitted file. If packaging changes, prove payload identity before reusing execution evidence.

## Repository roles and evidence

The [runtime implementer brief](spec/engine/IMPLEMENTER-BRIEF.md) remains authoritative for assigned source roles. This guide does not broaden anyone's read scope. Use listing-free contract and reproduction handoffs where tests, specifications or original-reference evidence are excluded.

Keep source implementation and independent verification roles separate. Coordinators can exchange immutable artifacts, identities and listing-free results without inspecting excluded implementations or raw evidence. Keep bulky investigation output out of feature diffs; retain reproducible harnesses and evidence in their appropriate development or verification location.
