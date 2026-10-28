# Runtime optimization experiments

Use [measured simplification](measured-simplification.md): identify code or work that can disappear, charge every replacement, then verify behavior and complete public-operation cost. A negative result applies to its inspected scope, not every possible implementation.

## Landed results

| Change | Evidence and limit |
| --- | --- |
| [#493](https://github.com/khawkins98/scriptoscope/pull/493): shared raster executor | Consolidated duplicate CPU mechanisms. Reported −161 noncomment production lines and −2,057 emitted JS bytes under that study’s census. No speed claim. |
| [#494](https://github.com/khawkins98/scriptoscope/pull/494): prepared header coverage arithmetic | Synthetic warm public-header time fell 20–47%; +7 production lines, +117 emitted JS bytes. Generic fractional/masked counting remains. |
| [#495](https://github.com/khawkins98/scriptoscope/pull/495): prepared header pattern spans | Synthetic warm header calls improved by size; +23 production lines, +695 emitted JS bytes. |
| [#496](https://github.com/khawkins98/scriptoscope/pull/496): prepared push pattern spans | Synthetic warm opaque-pattern calls took 36–84% less time; +59 production lines, +1,923 emitted JS bytes. Prototype hooks and cloned shared-storage aliases required fixes before landing. |
| [#497](https://github.com/khawkins98/scriptoscope/pull/497): omit no-rect final push scan | 18 synthetic warm public workloads took 8–61% less time; +2 production lines, +38 emitted JS bytes. Narrow allocator-read timing change is documented in [push allocator compatibility](push-allocator-compatibility.md). |

Performance ranges describe the measured fixtures and hosts, not whole applications, cold starts, all browsers, memory, or historical-program fidelity. Counts from different studies need their stated scopes; source-line savings and execution savings are separate scores. The #497 verifier remained runtime-source blind, but accidentally saw author timing summaries during measurement; its fixed harness and analysis were unchanged and all samples retained.

## Rejected structural theories after #497

These trials used the admitted production baseline corresponding to merged #497 (`240d0e1b5e7a8e574421b00383c96da43207360f`). Its production-only source archive excludes tests; a reconstructed subset tree must not be compared as though it were the full repository tree.

| Theory | Concrete result | Constraint on repeating it |
| --- | --- | --- |
| General shared bevel/frame span framework | Raster, pattern, border geometry and transfer executors are already shared. Three apparent bevel traversal sites total only 21 physical lines / 1,045 source bytes before replacement costs. | Identify a whole existing implementation that disappears before adding another executor or prepared sibling. |
| Hoist repeated terminal bevel border calls | Actual prototype: −59 contextual tokens, −194 source bytes, −117 emitted JS bytes, zero physical/noncomment lines. It adds branch bookkeeping. Rejected before parity/timing qualification. | A small call-site cleanup does not establish a materially smaller drawing core. |
| Resolve progress frame metadata once | Diagnostic deletion: −17 contextual tokens, −67 source bytes, zero lines. Stable pixels still changed callbacks/traces; mutable metadata changed pixels; a second-request exception disappeared. No full-bundle or timing claim. | The repeated request is observable protocol work. Validation, resource preparation and fill/track drawing implementations are already shared. |
| Compact push resource record | Source inventory found 24 gross physical lines / 1,662 bytes across three local/preflight regions before required replacements. Larger admission, dependency and lookup blocks still serve other callers. No qualifying prototype. | Count record construction, failure/provenance states, adapters and retained generic routes. A resource-transaction snapshot is an unproven compatibility hypothesis, not an approved migration. |
| Combine facade/lifetime wrappers | Shared helpers already own lifecycle and diagnostics; only six wrapper lines / 174 source bytes remain across three inspected sites before replacement. No prototype or runtime claim. | Preserve distinct callback-error precedence, publication/owner-check order, partial traces and commit rules; adding a generic lifecycle wrapper does not delete those policies. |
| Remove private procedural-frame sample color clone | Exact-source review: −33 contextual tokens, −1 production line, −59 emitted JS bytes; no new helper. Independent public parity passed, but all seven timing intervals crossed no-change across 700 retained pairs. | Parked as insufficient material benefit. Author-only small-frame signal was not independently established. Declared engine callbacks were not available through the shipped package transport. |
| Factor frame-table literal schemas | Cost model: six constructors save 1,165 source bytes after typed helper costs; excluding the losing attribution helper estimates 1,305 bytes with 87 initialization calls. No transformed production candidate. | This trades named fields for long positional calls. No AST, emitted-size, initialization, identity/freeze parity or render-time claim is established. |

## Rules for the next theory

- Start with exact responsibilities and statements that can be deleted; distinguish repeated execution from duplicate implementation.
- Do not claim already-landed consolidation again. Eager and owned themes already converge through ThemeView.
- Preserve provider callbacks, mutable metadata, errors, diagnostic ordering, allocation, fractional geometry, aliasing and lifetimes except for explicitly adopted changes.
- A new representation must pay for types, construction, guards, adapters and every retained fallback; moving code or compressing formatting is not simplification.
- Stop a structurally losing trial before expensive benchmarks. For a viable trial, bind source and opaque runtime artifacts before independent verification.
- Keep verifier handoffs limited to identities and necessary cost metadata; do not embed producer timing summaries or probes.
