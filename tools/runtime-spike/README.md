# Owned raster regression harness

This local, unshipped harness compares decoded-buffer rendering with eager image
transport and separately compiled implementations. It checks regression
consistency; it does not certify original Kaleidoscope fidelity.

## Recorded evidence

The compact snapshots in this directory retain production size, published size,
build provenance, validation status and unresolved optional cases. Large per-case
traces live outside the source tree. [evidence-index.json](evidence-index.json)
records their exact byte counts, SHA-256 hashes, capture provenance and key totals.
Revisions identify HEAD at capture; recorded input hashes also pin working-tree
inputs. Results from different stages must not be pooled.

| Check | Recorded outcome |
| --- | --- |
| Production reference | 18 themes; 8,424 button paints, 1,728 windows, 432 scrollbars; zero mismatches |
| Public rasters | 18,704 current checks and 18,704 additional compiled-reference checks; zero mismatches |
| Renderer families | 19,152 cases: 15,278 paints, 3,474 matching missing and 400 explicitly unsupported outcomes |
| Focus consistency | 288 cases / 4,608 outputs; removed cache had 1,312 mismatches, guarded full renders have zero |
| Independent refresh integration | 1,147 Node tests and all 576 required browsers pass |
| Other validation | 12,902 unchanged engine-diff cells; 36 Linux goldens; packed consumer passes |
| Optional visual suite | 33 pass / eight unresolved failures; see [public questions](older-visual-contract-questions.md) |

The focus probe also checks content/selection and canvas identity, notifications
and already-active clicks. Six held-preparation units cover focus/removal/retheme
races. Recorded warm large-window owned focus work is 4.9 ms median / 9.2 ms p95,
ending at render completion, before presentation. Full recomposition is more
expensive than partial caching; cache removal fixes correctness and complexity.

The final six application trials compare a reconstructed frozen eager library
with the current owned API in the current advertisement app. Startup is
5,546 / 8,036 / 8,493 ms eager and 619 / 1,230 / 788 ms owned; medians
8,036 / 788 ms. Both modes are slower than the preserved earlier stage
(2,501 / 241 ms medians); the cause is unestablished. Fresh profiles share OS/Vite
caches. No other task-started validation/build ran alongside the final trials.
Diagnostic traces and normal trials remain separate in the archive.

Ready backing storage is about 5.50 MB eager / 13.71 MB owned. Teardown/batch live
URLs and tracked advertisement-owner pixel bytes reach zero; final batches have
350 DOM nodes / 16 listeners. Heap grows in both modes, and an earlier eager
retention anomaly remains unexplained. No portable latency budget, lower retained
memory or leak-free behavior is claimed.

Production source logic plus loader JavaScript decreases from 21,616 to 21,608
physical lines (−8; source alone +14). Equivalent compiler-recipe JavaScript grows
by 3,017 bytes; separate level-9 gzip totals grow by 467. The normal library package
is 996,635 compressed / 3,288,067 unpacked bytes, 116 entries. See
[production-size-results.json](production-size-results.json) and
[shipped-size-results.json](shipped-size-results.json).

## Reproduce

Requires installed dependencies, the `agent-browser` CLI and its Chromium browser.
Run from the repository root with a current library build:

```sh
npm run build
node tools/runtime-spike/run.mjs
node tools/runtime-spike/run.mjs --production
node tools/runtime-spike/application.mjs --smoke
node tools/runtime-spike/focus.mjs current
```

Runners write raw JSON into ignored `tools/runtime-spike/.artifacts/`, leaving
curated committed snapshots untouched. Set `SCRIPTOSCOPE_ARTIFACT_DIR` to a fresh
external run directory for captures you intend to retain. Application runs omit
`--smoke` for three trials per mode; `--diagnostic` writes a separate instrumented
report whose timings and retained trace memory must not replace normal results.
Servers and task-owned browser sessions close after each run. Serialize builds
and measurements; do not change inputs during a capture.

`build-frozen.mjs` rebuilds the exact frozen starting revision by default, or an
explicit full SHA, with a common pinned compiler recipe. It does not inspect old
source/configuration or run old build scripts; extracted inputs are deleted.
Only compiled JS, CSS and build metadata remain. This is a reconstruction, not a
recovered release or original Mac executable.

Point these variables at a compiled `scriptoscope.js` with its adjacent build
manifest; each runner verifies the artifact hashes:

- `SCRIPTOSCOPE_EAGER_ENTRY`: reconstructed eager library for the application run.
- `SCRIPTOSCOPE_RUNTIME_REFERENCE_ENTRY`: reference loader/rasters for production.
- `SCRIPTOSCOPE_FOCUS_ENTRY`: implementation under the focus probe.
- `SCRIPTOSCOPE_EXPECTED_ENTRY`: separate fresh renderer for focus comparisons.

## Archive and review boundary

The hash-verified local archive is under `Scriptoscope-maintainer-assets` at the
relative directory recorded in `evidence-index.json`. It contains all 22 original
JSON snapshots, plus verified frozen/pre-simplification/current compiled builds.
It has not been uploaded; it is not a public download link. Removed reports also
exist at the index's pre-cleanup Git revision. Archive folders are immutable;
keep new captures in a new folder. Use a squash merge to keep the earlier bulky
feature commits out of the target branch's history.

Independent acceptance sources, fixtures, goldens and verifier review material
are outside this packaging change. The separately authorized provenance/binding
refresh and its return boundary are recorded in
[independent-refresh-handoff.md](independent-refresh-handoff.md).
[validation-results.json](validation-results.json) records the prior runtime
candidate; current exact-head lane results are reported in PR #480.
