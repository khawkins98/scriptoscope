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
| Unify horizontal/vertical scrollbar and slider bodies | Source inventory confirms substantial paths already share Axis. Residual slider tick branches have three statements each and drag branches two, with different vertical and read-order policy. No prototype. | Bounded 1–4 inline-line opportunity before adapters is insufficient for a new axis framework; already-shared bodies earn no new deletion credit. |
| Post-optimizer Terser formatting | Source-owned trial: all runtime JS −129,644 raw / −15,881 gzip9 bytes; maps add 20,963 gzip9 bytes, full summed closure +5,082. Representative consumers and public render controls passed. | Strict preservation failed: five comment instances truly absent (two prose, three unclassified); 106 raw PURE instances preserved, attachment not proved. No cold/warm timing or adoption claim; new build-tool costs apply. |

The admitted 104,937-byte index chunk contains a 93,076-byte base64 data URI for the exact 69,806-byte decoder WASM. Those encoded asset bytes are shipped cost, not handwritten drawing logic. A config-only asset-emission prototype preserved the binary and saved 20,127 raw / 9,824 summed gzip9 runtime bytes after charging all JavaScript and WASM, while adding 16 noncomment configuration lines and deleting no drawing logic. Direct browser/CDN-style and Vite controls passed, but bare Rollup omitted the binary and failed unless the consumer added an asset-emission adapter. Parked under the retained consumer contract; bounded synthetic archive roundtrips are not full format-fidelity evidence, and no startup or warm-render timing claim was established.

## What the source census does and does not show

A source-only responsibility census of the #497 baseline counted 92 admitted TypeScript files: 18,205 physical lines / 1,021,958 bytes. Shared raster execution and geometry occupied 487 physical lines / 29,020 bytes. Larger categories included resource-directed layout/painting policy (4,340 lines), public render orchestration (2,843), built-in procedural fallback (2,532), and host lifecycle/interactivity (5,084). Mixed files were assigned by dominant responsibility; these are physical source counts including comments/types, not emitted bytes or execution profiles.

This census established no larger compatible graph deletion from a new display-list interpreter. Such a representation would still need resource-selection policy, mutable-provider barriers, immediate alias semantics, diagnostics and public result adapters. Removing corner-sprite rendering could delete a concentrated graph but would withdraw supported fidelity, so it is not recommended under the faithful-core goal. Continue measuring removable complete-render work; do not interpret a small shared raster kernel as proof that surrounding contracts are free or unnecessary.

## Preserve the existing lazy frame boundary (#501)

Landed in [#501](https://github.com/khawkins98/scriptoscope/pull/501) after exact-head browser/build and documentation gates passed. The loader registry needs four procedural-frame art constant groups. Importing them from the full frame table kept that table eager even though frame painting already used a dynamic import. Moving the exact groups into a shared module and reexporting the original bindings lets the remaining table follow that existing lazy edge. Source review checked mutation/import ordering and preserved the existing eager loader captures and live scrollbar-plane alias.

Independent module-request accounting measured renderer initial JS at 352,555 → 331,549 raw bytes, while the existing frame chunk grows 39,790 → 59,742. The first-frame closure therefore saves only 1,054 raw bytes; all seven shipped JS files together save 1,063 raw / 530 summed Node gzip9 bytes. No extra production fetch is added. Progress-only consumers already shake out the table and gain effectively nothing.

The production cost is +272 source bytes, +6 physical lines and +1 noncomment line under the source review's contextual-token census. This removes an eager dependency, not a maintained rendering mechanism. Public synthetic comparisons, loader checks, consumer execution and alias/import-order checks passed within their stated scopes. Six fresh-process timings establish no broad startup, CPU or memory gain.

Strict consumer compilation reports the same three TS2307 references to missing dist/src companions in both supplied distribution assemblies. This is an existing assembly verification limit, not a new candidate error or proof about unexamined complete npm publications. No shim or skipLibCheck was added to hide it.

## Scalar compositor reads: rejected execution theory

The reviewed #501 runtime was the baseline. A prototype replaced two private per-pixel tuple reads with scalar channel snapshots, retaining the public tuple-returning helper. This duplicates a little read logic: +8 noncomment production lines, +261 source bytes, +231 raw shipped JS bytes and +73 summed Node gzip9 bytes. All seven runtime files and all 101 declaration files were bound to immutable artifacts and reproduced by a separate source reviewer.

Source-owned dynamic-read, thrown-prefix and alias controls passed. Independent comparison retained 4,864 matrix cases plus observer, lifetime, provider and pattern checks without a candidate pixel/behavior mismatch. Exact reflection still failed: incidental minification changed the Function.name values of two public bindings, CicnTransferError and isDebug. No exception was approved. An ideal straight-alpha oracle also failed on translucent destinations equally in both versions; that baseline limitation is distinct from candidate parity and was not relabeled a pass.

Six fresh browser processes retained 30 warm samples per workload and variant, with balanced order across eight complete public operations. No workload established a speed benefit. Candidate/baseline paired process-median ratios were 1.114 (interval 1.010–1.253) for small bevels and 1.117 (1.029–1.219) for large frames; the other six intervals crossed no change. Cold/setup observations were separate. These are synthetic workload results, not whole-application or historical-fidelity measurements.

Park the prototype. Producer allocation sampling suggested less temporary heap traffic, but allocation reduction does not establish faster complete rendering; this trial adds source and shipped code while showing slowdown signals. No independent memory benefit is claimed. Do not repeat the same scalar rewrite or add hard-coded generated-name compatibility shims to rescue it without a new, concrete hypothesis.

## Default-loader boundary census: no compatible cut established

A source-owned emitted-consumer census found no additional saving for a named progress import from the default package entry: both default and renderer consumers already emitted 57,729 raw / 18,380 Node gzip9 bytes. URL loading plus window rendering retained more conversion code, but the inspected dynamic-import cut would add an observable suspension and import-failure behavior at a mutable-input boundary. No production prototype, emitted saving or timing gain was established for that cut. It remains an unapproved compatibility proposal, not a completed optimization.

## Rules for the next theory

- Start with exact responsibilities and statements that can be deleted; distinguish repeated execution from duplicate implementation.
- Do not claim already-landed consolidation again. Eager and owned themes already converge through ThemeView.
- Preserve provider callbacks, mutable metadata, errors, diagnostic ordering, allocation, fractional geometry, aliasing and lifetimes except for explicitly adopted changes.
- A new representation must pay for types, construction, guards, adapters and every retained fallback; moving code or compressing formatting is not simplification.
- Stop a structurally losing trial before expensive benchmarks. For a viable trial, bind source and opaque runtime artifacts before independent verification.
- Keep verifier handoffs limited to identities and necessary cost metadata; do not embed producer timing summaries or probes.
