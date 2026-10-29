# Shared CPU raster core — PR493

PR493 consolidates the shared pixel execution used by window chrome and controls. It preserves the ordinary PixelBuffer constructor, methods, result envelopes, mutable byte arrays and aliases. The adopted contract in [PUBLIC-CONTRACT.md](PUBLIC-CONTRACT.md) includes the two approved changes: nested method/internal buffer interception and stable pixel/rectangle/inset getter-read counts and order. Callers observing nested composites or internal painting must move observations to explicit public operation boundaries; callers relying on getter-read counts/order must use ordinary plain stable input values. This requires no new API and does not approve arbitrary changes to mutating-getter results or private Region/span behavior.

The eight old pixel/transfer/tile/scale/pen/lines/pattern/region modules are removed. A single immediate CPU raster implementation supplies their required operations, while PixelBuffer remains a thin charged public surface. Resource choice, unknown branches, metadata/resource errors, callbacks, native forms, accessibility, host integration, window state and lifetime remain required.

Family painting still exists in controls, platinum primitives, procedural-frame region/shape painting, slider initialization, cinf frames and slice orchestration. That code is retained at zero deletion credit. This is not removal of the full graphics model, a native-fidelity proof, or an original-native size/speed comparison.

| Accounting against base26e | Result |
| --- | ---: |
| All modified production source | -161 noncomment lines; -472 contextual AST tokens |
| Separately identified unused internal cleanup | -23 lines; -434 tokens |
| Shared-core/adapter change excluding dead cleanup | -138 lines; -38 tokens |
| All emitted JS, including shared/lazy chunks | 689,203 to 687,146 bytes (-2,057) |
| Sum of per-chunk gzip sizes | 221,767 to 220,964 bytes (-803) |
| Ordinary API consumer migrations | zero required under retained public surface; observation-dependent callers follow the migration above |
| Current production census | 13,292 noncomment lines; 179,259 contextual AST tokens; 91 files |
| Resources/fonts/data/decision tables | unchanged |

All new delegates, types, adapters, repairs and import changes are charged. Formatting/comment bytes do not earn savings. The necessary native keyboard/lifetime repairs cost 27 lines, 345 tokens, 1,131 emitted JS bytes and 388 summed gzip bytes against the approved 429 revision; all are included above. The 5,000-token implementation forecast remains missed; unused cleanup does not retroactively pass that forecast. No full-goal success, speedup, equivalence or memory claim is made.

The direct integer-border trial is parked at 8a870c22: it passed own parity but added 129 tokens and an additional unapproved private-allocation observation delta. It and all other parked candidates are excluded from PR493. Audit JSON snapshots and ignored development harnesses are separate research artifacts and should not be included in a feature PR.

Native button Space activation now survives ordinary window resize. A valid committed scrollbar retry survives z-only state updates, while superseded or disposed work remains cancelled. These repairs preserve ordinary behavior without adding a private DOM ancestry promise or expanding the two approved observation retirements.

Independent source re-review of production fa76 found no blocker. Independent keyboard review found no blocker, with the regression red on 429 and 18 green checks across all three browsers. Independent retry checks passed 64 source/built Chromium/WebKit cases including the original scanner; review of the new retry regression test remains pending. The earlier configured Linux CI failure (one native Space case; 616 passed) remains recorded, and full final Linux CI is outstanding. These focused results do not establish full CI passage.

The package-script Node unit preflight on the matching production source tree exited 0: 1,177 tests, 1,163 passed, zero failed/cancelled, two skipped and 12 todo. This preflight does not replace full configured Linux CI.
