# Proposed shared CPU raster core

This review candidate consolidates the shared pixel execution used by window chrome and controls. It preserves the ordinary PixelBuffer constructor, methods, result envelopes, mutable byte arrays and aliases. Exact experimental method/getter observation changes are listed in PUBLIC-CONTRACT.md and are not shipping approved.

The eight old pixel/transfer/tile/scale/pen/lines/pattern/region modules are removed. A single immediate CPU raster implementation supplies their required operations, while PixelBuffer remains a thin charged public surface. Resource choice, unknown branches, metadata/resource errors, callbacks, native forms, accessibility, host integration, window state and lifetime remain required.

Family painting still exists in controls, platinum primitives, procedural-frame region/shape painting, slider initialization, cinf frames and slice orchestration. That code is retained at zero deletion credit. This is not removal of the full graphics model, a native-fidelity proof, or an original-native size/speed comparison.

| Accounting against base26e | Result |
| --- | ---: |
| All modified production source | -188 noncomment lines; -817 syntax tokens |
| Separately identified unused internal cleanup | -23 lines; -434 tokens; zero emitted savings |
| Shared-core/adapter change excluding dead cleanup | -165 lines; -383 tokens |
| All emitted JS, including shared/lazy chunks | 689,203 to 686,015 bytes |
| Sum of per-chunk gzip sizes | 221,767 to 220,576 bytes |
| Production consumer migrations | zero required under retained public surface |
| Font/data/decision tables | unchanged |

All new delegates, types, adapters, repairs and import changes are charged. Formatting/comment bytes do not earn savings. The 5,000-token implementation forecast remains missed at 5,373 charged tokens; unused cleanup does not retroactively pass that forecast. No full-goal success or performance winner is claimed.

Candidate source is 655c59887df938a98d0fe04e0d3c9c5a78ba43c1. Its complete opaque package binding is `.local/tuple1/SHA256SUMS`, covering all 110 files including CSS, declarations and maps, SHA-256 `9fbdb74c214ad80cea614b961c7f83ecca5929947dc62c4a5bd3d1b991f32e5b`. Generated JS/maps were only executed or hashed opaquely.

Own development checks passed: typecheck, declaration emission, clean-room checker, 12,000 primitive cases, 11,024 focused fractional-slice/shifted-view cases and 119,639 bounded decimal cases. Independent current-head confirmation and focused performance review remain coordinator-owned; no independent source/oracle/evidence was read or edited here. Tests are unchanged in this source lane; internal deep-import test migration is separate ownership after removal of unsupported internal entries.

The direct integer-border trial is parked at 8a870c22: it passed own parity but added 129 tokens and an additional unapproved private-allocation observation delta. It is excluded from this candidate. Audit JSON snapshots and ignored development harnesses are separate research artifacts and should not be included in a feature PR.
