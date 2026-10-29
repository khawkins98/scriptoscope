# Drop-zone listener closure: public verifier handoff

Candidate production commit: `d964c291`; frozen parent: `a00f9f097613751cf0af9a20949c00206fd856cb`.
Only production change: `src/declarative/themeDropZone.ts`, +11/-16 lines (net -5).
Seven listeners retain their order, callbacks, targets and default options; one private controller replaces their removal list and the detached boolean.
`detach()` aborts synchronously before clearing the active class and removing the input, with idempotence from `signal.aborted`.
No caller signal exists on this API; native form/input identity, in-flight callback ownership and reattachment remain unchanged.

Existing-controller sites were considered first: draggable removeMove/removeUp/removeCancel are gesture-owned, control root unlisten arrays are root-owned, and scrollbar window listeners end on pointerup as well as render abort; those lifetimes cannot be merged.
The modal/persistence helpers offered smaller reductions; no unrelated code or shared helper was changed.
No stop-sign file or report was used as an implementation input.

Frozen compiled reference: `/tmp/listener-closure-d4fca3ef/baseline/` (copied from the untouched parent build before edits).
Callable interface: serve that directory as browser ES modules, import `scriptoscope.js`, then call exported `attachThemeDropZone(target, options)` and returned `detach()`.
Own executable differential probe: `node /tmp/listener-closure-d4fca3ef/probe.mjs` from this worktree; it serves frozen reference and current `dist`, importing only their public exports in separate Chromium pages.
Probe SHA256: `6d53621d374f3a6dd6619227dee5f80834ea42c850f6e40ed57a32ed4bb0124d`.
Probe checks exact callback/error traces, keyboard cancellation, drag cancellation/class state, child dragleave, picker/drop input, pending completion after detach, retained-node events after detach, duplicate detach, and remount.
Probe passed against native Chromium; results and ordinary gate logs are under `/tmp/listener-closure-d4fca3ef/`.

Ordinary checks passed: build, typecheck, cleanroom (0 hits), npm test (1160 pass, 0 fail, 2 skipped, 12 todo), test:package, and git diff --check.
Whole non-test src LOC using assigned loc:src: 19698 -> 19693 (logic 17375 -> 17370; tables 2323 unchanged).
Same installed dependencies and build command; all top-level dist JS summed: 704347 -> 704097 bytes; sum of Node default gzip per file: 223611 -> 223591 bytes.
No speed claim; no golden updates; independent review, broader/exact-head gates, CI and landing remain coordinator-owned.

Source SHA256 before -> after:
- themeDropZone.ts: `e6a09e2365bc8f1465b478fe3aea9f6ddee98c2f369783b58acd2ce80e1bd6b0` -> `e7aff6e77adf50b9bc56d5726112b180707daa34c5182fafc82c1e9954af2600`
- listenUntilAborted.ts unchanged: `891a61784dfe968a7fc3a51bfb79e5605667c9178ad68efd2c16feb4d1987840`
- package-lock.json unchanged: `2d10f2c59a71894453a9abb20ea6ddb6a87fdb75e296c92c3f035ac2c55af0be`
- frozen main chunk index-vUFUCeft.js: `614265ab84a5e014be7ae260498f6ec0e2b3817c201fe1d3bfa14bbfb07b2935`
- candidate main chunk index-HdiNSL99.js: `de5639493dcffef3c7f5d5fd3514bbccf9baa9de72daa09c6a0967318f5fdb43`
