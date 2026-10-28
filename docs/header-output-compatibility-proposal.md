# Full-clip header allocator substitution — proposal

This document describes the behavior proposed in [PR #500](https://github.com/khawkins98/scriptoscope/pull/500). That PR records the compatibility decision, release status and current checks; measurements below apply to the frozen v1 candidate.

## Behavior and scope

Before this change, the header facade allocates its output through the public overridable static PixelBuffer.alloc, paints into a detached copy, and transfers that copy into the output. The proposal constructs and paints a fresh output within the compositor when the already prepared effective clip covers the entire requested rectangle. It removes one output-sized allocation, its clone copy, and the final full-area transfer on that route.

Full coverage includes an unbounded clip or a containing rectangle, and applies to window and list header surfaces. Early returns before output construction are unchanged. Clipped and empty header outputs retain the public allocator and detached painting. Header columns, other controls, and the existing generic/prepared caller-supplied-buffer functions retain their existing behavior.

The new compositor takes paint inputs, constructs its own output, and returns only after painting. Callers cannot supply an output buffer or assert private ownership. Its declaration is available through the internal engine barrel; package exports are unchanged.

## Proposed compatibility change

For full-clip header calls reaching output construction, PixelBuffer.alloc overrides are no longer invoked. This removes their invocation count, instrumentation and side effects, thrown errors and their precedence, custom dimensions, initial bytes, returned object/data identity, and aliasing to resources or other externally retained buffers. Output instead has the requested dimensions and fresh ordinary zero-initialized storage. Removing allocations also changes resource-pressure behavior.

Applications using allocator overrides only to measure calls would need to instrument the surrounding application operation. There is no transparent migration for custom returned buffers or allocator-dependent errors; those users would need to retain the current implementation or review a separately designed explicit-buffer API. This proposal does not introduce that API.

No additional option/resource snapshot is proposed. The existing prepared plan determines coverage; dynamic resource pixels, admission, diagnostics, callback order and lifetime checks remain governed by the retained contracts. This is an ordinary module ownership boundary, not a guarantee against replaced globals or hostile prototype mutation.

## Evidence and costs

The frozen source revision changes two production files: +624 source bytes, +6 noncomment lines and +249 raw / +80 summed Node gzip9 bytes across all seven emitted JavaScript files. One compositor and a compound result record are added; existing generic paths remain. This is execution optimization, not a source-complexity reduction.

The source-owned census observes a full 1200×800 header removing 3,840,000 allocated bytes, 7,680,000 logical copied bytes and 960,000 scalar transfer iterations. That is a stress geometry, not a typical header. Counters are logical work accounting, not browser heap measurements or speed evidence. Source review reproduced all seven frozen JavaScript files from both source versions and found no blocking source issue. Independent source-blind validation matched 60 ordinary public header cases, plus allocator, alias/SAB, async, error and sensitivity probes, under the explicitly proposed allocator exception.

Independent timing retained all 1,512 fixed samples across six fresh headless Chrome processes on one machine. Calls include public preparation, allocation, painting and result resolution; module import and fixture creation are excluded. Warm candidate/baseline ratios use six process means with 95% intervals over their logs.

| Synthetic group | Baseline / candidate ms | Ratio (95% interval) |
| --- | ---: | ---: |
| Ordinary full-pattern, 160×24 | 0.05858 / 0.03227 | 0.551 (0.531–0.573) |
| Large full-pattern, 1024×256 | 1.90310 / 0.28081 | 0.147 (0.143–0.152) |
| Ordinary no-pattern | 0.06887 / 0.03907 | 0.566 (0.503–0.638) |
| Ordinary clipped control | 0.02702 / 0.02942 | 1.089 (1.017–1.165) |

The clipped control regressed by about 9%, or 0.0024 ms per call. Small headers and an unaffected progress control did not establish a gain. This is not a universal improvement, cold-start result, application profile or historical-fidelity proof. A larger facade-routing revision added eight more noncomment lines and 455 JS bytes without establishing a consistent clipped-call improvement in source-owned trials; it was parked.

The opaque-runtime verifier could not call lower-level engine functions absent from shipped entrypoints; those received separate source review. Loader-owned disposal/abort races remain an independent coverage gap. Independent synthetic parity does not replace the package, browser, corpus and reviewed-golden release gates.

Frozen identity metadata SHA256: 828b6884a240fc2e7bb61e26a689c74f1818dc22642cca78c481a39a3f508624. Independent prospective plan SHA256: 669ddad717eba5e2c7b518cfc497102d3ee760c40440756245c69bd159d33473. Identities bind evidence and do not themselves grant approval.
