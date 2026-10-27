# Shared CPU raster core — PR493

PR493 consolidates the shared pixel execution used by window chrome and controls. It preserves the ordinary PixelBuffer constructor, methods, result envelopes, mutable byte arrays and aliases. The adopted contract in [PUBLIC-CONTRACT.md](PUBLIC-CONTRACT.md) includes the two approved changes: nested method/internal buffer interception and stable pixel/rectangle/inset getter-read counts and order. Callers observing nested composites or internal painting must move observations to explicit public operation boundaries; callers relying on getter-read counts/order must use ordinary plain stable input values. This requires no new API and does not approve arbitrary changes to mutating-getter results or private Region/span behavior.

The eight old pixel/transfer/tile/scale/pen/lines/pattern/region modules are removed. A single immediate CPU raster implementation supplies their required operations, while PixelBuffer remains a thin charged public surface. Resource choice, unknown branches, metadata/resource errors, callbacks, native forms, accessibility, host integration, window state and lifetime remain required.

Family painting still exists in controls, platinum primitives, procedural-frame region/shape painting, slider initialization, cinf frames and slice orchestration. That code is retained at zero deletion credit. This is not removal of the full graphics model, a native-fidelity proof, or an original-native size/speed comparison.

| Accounting against base26e | Result |
| --- | ---: |
| All modified production source | -188 noncomment lines; -817 syntax tokens |
| Separately identified unused internal cleanup | -23 lines; -434 tokens; zero emitted savings |
| Shared-core/adapter change excluding dead cleanup | -165 lines; -383 tokens |
| All emitted JS, including shared/lazy chunks | 689,203 to 686,015 bytes |
| Sum of per-chunk gzip sizes | 221,767 to 220,576 bytes |
| Ordinary API consumer migrations | zero required under retained public surface; observation-dependent callers follow the migration above |
| Font/data/decision tables | unchanged |

All new delegates, types, adapters, repairs and import changes are charged. Formatting/comment bytes do not earn savings. The 5,000-token implementation forecast remains missed at 5,373 charged tokens; unused cleanup does not retroactively pass that forecast. No full-goal success or performance winner is claimed. Performance speed and equivalence remain unproven.

The direct integer-border trial is parked at 8a870c22: it passed own parity but added 129 tokens and an additional unapproved private-allocation observation delta. It and all other parked candidates are excluded from PR493. Audit JSON snapshots and ignored development harnesses are separate research artifacts and should not be included in a feature PR.
