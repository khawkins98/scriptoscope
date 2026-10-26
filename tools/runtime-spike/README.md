# Decoded raster transport spike

This experiment asks whether the existing push-button renderer can consume decoded
RGBA directly, avoiding RGBA → PNG → Image → Canvas → RGBA. It does not replace the
renderer or change resource lookup policy. The experiment now drives the
production owned loader introduced in feature PR #480.

Run `npm run spike:runtime` from the repository root. It requires the installed
`agent-browser` CLI and its Chromium browser. The runner starts a temporary Vite
server and an isolated browser session, writes `results.json`, and closes both.
An error or output mismatch returns a nonzero exit code. Results are local
measurements, not a portable performance budget.

## Recorded result

The 2026-10-26 00:04 UTC local Chromium 153 run in `results.json`, using
the owner-local capture implementation (runtime hashes recorded), passed all **1,944
painted comparisons**, with zero missing faces, errors or mismatches. All 54
direct-load disposal checks passed, as did the comparator mutation probes.

| Measurement | PNG transport | Direct buffers |
| --- | ---: | ---: |
| Load | 661.7 ms | 23.1 ms |
| First narrow render | 2.4 ms | 0.3 ms |
| Warm render | 0.5 ms | 0.3 ms |

Each figure is the median of the 18 per-theme medians, rather than a combined
page-load measurement. Repository validation ran concurrently; this is a local
transport probe, not an isolated application benchmark. This supports removing serialization from the loading
path; it shows no material warm-render improvement. Process memory was not
measured. The normal repository gates, library build and engine-diff also pass;
the latter retains all 12,902 committed cells unchanged.

## Implementation

The original empty-blob spike and pixel registration behind PNG URLs have been
replaced by the production owned loader. The benchmark now calls
`loadOwnedKaleidoscopeScheme` and the same button facade used by public APIs. Its
baseline uses an explicit PNG encoder and the existing ready-image loader.
Owned references are private resource identities; actual image requests export
valid URLs lazily. Existing loaders remain eager compatibility adapters over the
same owner. The public loading boundary is documented in
[`owned-theme-api.md`](../../docs/v2/owned-theme-api.md).

Custom factories and external images retain authoritative browser decoding.
No net code-size saving is claimed at this stage.
The experimental harness is under `tools/runtime-spike/`; it is not shipped.

`node tools/runtime-spike/run.mjs --production` compares the production owner
against explicit PNG transport through source and built entries. It additionally
decodes public image URLs and compares their pixels with direct buffer access,
and exercises push/default buttons through own/base and clipped contexts.
Results go to `production-results.json`; this requires a current `npm run build`.

The current production run passed **8,424 painted push/default comparisons**
across source and built public entries, with own, sparse-base and mixed
owned/legacy themes, clipped/unclipped composition and 648 synthetic prepared
bitmap label cases. All **18,704 public raster image comparisons** matched direct
access exactly. The expanded window matrix compares 1,728 cases across document, dialog,
titled and untitled utility requests, active/inactive states, 1×/2× scale,
and own/base/mixed ownership. It compares chrome pixels, layout and CSS tile
pixels; comparator probes reject pixel, tile and layout mutations. All 1,728
cases paint, with zero baseline fallbacks. All 432 scrollbar comparisons paint
exactly. Thirty-six mounted owned windows retain original input identity and
interactive content through retheming. Two baseline sizing and two pending-CSS
disposal probes pass across source and built entries.
Thirty-six each of interactive activation, diagnostic URL,
zero-PNG rendering and post-disposal source/built checks passed. One requested
image shares work and does not encode unrelated assets.
The family matrix adds **19,152 cases** through public source and built APIs:
15,278 painted outputs, 3,474 matching missing outcomes and 400 explicitly
unsupported checkable outcomes for sparse children without a declared census.
Slider, progress, checkable, disclosure, grow, tab, bevel and both header APIs
participate; checkable also distinguishes unknown from explicitly empty census.
There are zero mismatches or unexpected errors. Another 108 completed tab,
bevel and header diagnostic checks verify real image URLs and one completion.
Missing and unsupported outcomes are reported separately from successful paint.
Public button output is a pixel buffer; its dimensions and bytes are compared.
The internal face-layout assertion remains in the original source-only spike.

## Comparison and timing

All discovered bundled themes are loaded from their existing archives through the
public loader wrapper. For each transport, three fresh decodes are measured, with
alternating load order. Source bytes are fetched before timing; network and module
startup are excluded. Decode, conversion and asset transport are included.

Each theme exercises 36 push-button combinations: minimum widths 32/80/180,
normal/pressed/disabled, default ring off/on, empty/AgjpQy label, at height 20.
The same source facade renders both transports. Comparisons check availability,
errors, layout, dimensions and every RGBA byte, including transparent RGB. Matching
errors and missing faces are reported separately from successful painted output.
Mutation probes require the comparator to detect a changed pixel, layout and
availability. Every direct theme disposal must reject subsequent access through a captured source.

The first render is a narrow unlabeled normal button. Before warm measurements,
every case is rendered once on both transports; subsequent per-call timings
alternate transport order between repetitions. Very short calls are close to the
browser timer's resolution. Inspect loading and warm rendering separately.

`rawBytes` records owned pixel storage, not total process memory or retained
heap. Views share the decoded arrays instead of copying them. Decoded ownership
also retains unpainted assets until theme disposal, so this experiment does not
establish a memory improvement.

## Decision boundary

A successful run supports migrating raster transport incrementally, while keeping
the existing family engine and acceptance harness. The bounded push/base/bitmap/
diagnostic/activation cases do not establish parity for other control families,
all destination composition, independent original captures, complete DOM
lifecycles or other browsers. Window regression coverage is described above; complete
application lifecycle and retained-memory limits are recorded below.

The global private-reference registry is retired. Main demo loading and drops use the owner-local boundary; diagnostic inventories now export on open and ignore detached completions. Application measurements are recorded below. Resource indexing and
diagnostic redesign remain separate experiments.

New runner reports pin runtime, built and harness hashes, and reject changed inputs
during measurement. Older reports predate that provenance guard.

The recorded revision is checkout HEAD at run start; runtime hashes also identify
uncommitted source changes included in that run. Reports are excluded from the
fingerprint so saving measurement output does not invalidate it.

The production matrix now also mounts eager and owned themes through the public
scanner for all 18 themes and source/built exports. It compares canvases, icon and
CSS tile pixels, native input state and promotion counts, then checks activation,
retheming and disconnect. Pending-root reservation probes reject mixed loading
contracts and share same-contract handles. A real File decode exercises dropped
owned registration, legacy registration and borrowed-theme survival after teardown.

`diagnostic-results.json` records a local source-browser inventory probe: closed
images remain unexported, opening the raster inventory produces real blob images,
and detached images ignore held export completions. It also records the separate
visual-baseline command's eight unresolved failures; those checks are not green.


## Real application measurement

Run `node tools/runtime-spike/application.mjs` after `npm run build`. It serves the
existing advertisement app with local instrumentation and uses its real switch
buttons, five windows, and public declarative mount/disconnect APIs. It compares
the current eager compatibility API with the owned API, not a historical binary.
Each trial has a fresh Chromium profile; the two Vite servers and OS caches are
shared across trials. Source and built input hashes must remain stable during a
run. `--smoke` performs one trial per mode. The harness and hooks are not shipped.

The initial six-trial run preserved in `application-initial-results.json` passed its action,
window/theme assertions, URL cleanup and input-stability checks. Its timings
were measured before the subsequent shared PNG encoder/tab snapshot cleanup;
that cleanup requires separate output revalidation. Pass does not mean that a
performance or memory budget was met.

| Measurement | Eager compatibility | Owned |
| --- | ---: | ---: |
| Startup trials, milliseconds | 2,512 / 2,557 / 2,759 | 4,160 / 277 / 335 |
| Startup median, milliseconds | 2,557 | 335 |
| Initial live blob URLs | 3,196 | 2 |
| Ready backing storage, decimal MB | 4.87 | 13.84 |
| Ready JavaScript heap, approximately MB | 7.2 | 8.0 |
| After 20 mount cycles, JS heap, approximately MB | 6.8 | 7.25 |

The owned 4,160 ms trial also has 1,898 ms and 1,150 ms first-round theme
switches. No phase trace was captured to explain these delays. Keep that trial
when assessing the promising median; this run does not establish a uniform
startup improvement. Subsequent switches cluster near 33 ms, including two
animation frames, so they do not resolve underlying composition-time differences.

Owned advertisement themes retain 9,360,204 decoded pixel bytes while cached.
Their observed counters return to zero on teardown; global live blob URLs also
return to zero in both modes. Post-GC backing storage converges to approximately
3.645 MB. After the mount batches, DOM nodes/listeners stabilize at 350/16 in
both modes, but JavaScript heap grows across batches. Twenty cycles do not prove
absence of leaks. Advertisement owner telemetry does not observe mount-cycle
owners; their retention evidence is heap/backing storage, DOM and global URL
counts. Frame/task settling does not prove all asynchronous work is complete.

The artifact separately records the sum of browser-process RSS, which includes
browser infrastructure, allocator retention and potentially shared pages. Its
lower observed owned values do not establish lower application-retained memory.
A separate phase/long-task diagnostic run is needed before stronger performance
claims; the existing measurements should remain available unchanged.


`--diagnostic` records startup and completed-run traces in the separate
`application-diagnostic-results.json` artifact; combine it with `--smoke` for a
single trial per mode. It wraps font loading, theme resolution, promotion and
retheming with phase spans and observes main-thread long tasks and HTTP resource
timings. Phase durations overlap; retheming includes theme loading, so do not sum
them. These wrappers change promise scheduling, and retained trace arrays/resource
buffers change heap measurements. Diagnostic timing/heap figures must not replace
normal-mode measurements. Long tasks do not explain worker/network/scheduling
waits. The trace is intended to localize future delays, not retrospectively explain
the earlier outlier without evidence.


The separate diagnostic smoke run passes both modes on the cleaned production
implementation. It overlaps the local full browser suite and is not an isolated
benchmark. Eager startup is 3,570 ms, with five overlapping resolution spans of
2,790–3,320 ms and two startup main-thread long tasks of 375/1,924 ms. Owned
startup is 364 ms, resolution spans are 46–219 ms, and its startup long task is
186 ms. Window promotion spans are 8–31 ms eager / 4–23 ms owned. These spans
locate work in this run; they do not explain the earlier slow owned trial, which
did not recur. The artifact retains both startup snapshots and full-run traces.

`shipped-size-results.json` records the current `npm pack --dry-run` surface and
hashes of each built JavaScript file. JavaScript totals 713,285 bytes, or 225,215
bytes when each file is gzipped separately at level 9. This includes the lazy
archive decoder and procedural-frame chunk; it is not the initial network
payload. Package size is 1,004,082 compressed bytes / 3,321,567 unpacked bytes,
including maps, declarations, CSS and documentation. No compiled artifact matching
the frozen baseline was found, so this is a current size census, not a historical
delta. The source-line comparison remains +326 production lines.


### Final cleaned implementation: normal measurement

The canonical `application-results.json` now records six normal-mode trials on
`f927ff5a`, after the shared PNG encoder/tab snapshot cleanup. No other
task-started validation or build ran concurrently. Browser profiles are fresh;
Vite servers and OS caches remain shared. The initial artifact is preserved
byte-for-byte as `application-initial-results.json`.

| Measurement | Eager compatibility | Owned |
| --- | ---: | ---: |
| Startup trials, milliseconds | 2,602 / 2,514 / 4,649 | 267 / 2,257 / 340 |
| Startup median, milliseconds | 2,602 | 340 |
| Initial live blob URLs | 3,196 | 2 |
| Ready backing storage, decimal MB | 4.87 | 13.84 |
| Final mount-batch JS heap range, decimal MB | 6.80–7.42 | 7.23–7.30 |

All six trials pass the harness's action, window/theme, URL-cleanup and
input-stability assertions. Both modes have slow startup/switch trials; the
slowest switches are approximately 1.84 seconds eager / 2.03 seconds owned.
Those trials record twelve browser processes rather than eleven; this is a
correlation, not an explanation. The median benefit is reproduced, but uniform
latency improvement is not established.

All recorded teardown and batch samples have zero live blob URLs, and tracked
advertisement owners release their pixel storage. Owned live backing storage is
still about 9 MB higher while themes are cached. Post-GC JS heap grows across
mount batches in both modes. Eager repetition 1 ends batches 3 and 4 at 366 DOM
nodes / 17 listeners, compared with 350/16 elsewhere. That persistent anomaly
is retained in the report; it does not identify a production leak or attribute
one to the migration. Memory stability, lower application-retained memory and
absence of leaks are not claimed.

Astra reviewed the final artifact and found no new harness failure or evidenced
production regression. These measurements support sharply fewer PNG exports and
better median startup in the current eager/owned comparison, with a decoded
storage tradeoff and unresolved variability. They do not compare a frozen
historical executable or establish additional original-engine fidelity.

## Reconstructed starting revision

`node tools/runtime-spike/build-frozen.mjs` rebuilds the exact frozen revision
`de942c6399c81d1f15d23247dfd62a36e11a64bc` in an isolated temporary directory.
The current pinned compiler consumes historical implementation inputs with an
explicit configuration; the runner does not inspect historical source or execute
historical build scripts. Extracted inputs are removed, and only compiled JS,
CSS and `build.json` remain. This is a reconstruction, not a recovered release.
`frozen-build-results.json` records the recipe, toolchain and artifact hashes.

Set `SCRIPTOSCOPE_EAGER_ENTRY` to the printed compiled `scriptoscope.js` path,
then run `node tools/runtime-spike/application.mjs --smoke` (or omit `--smoke`
for three trials per mode). The harness verifies every frozen artifact hash and
compares its eager API with the current built owned API in the same current
application and controlled styles. It writes separate `application-historical-*`
reports, preserving current-API reports. This does not recreate the historical
application release.

`application-historical-smoke-results.json` verifies that both compiled APIs
mount all five windows, switch themes and complete twenty mount cycles per mode.
Its single startup trial per mode is an integration check, not a performance
budget or final historical comparison. The reconstructed baseline contains
698,396 JavaScript bytes across all chunks; final current-build comparisons must
use equivalent compiler settings and include every lazy chunk.

## Focus-cache simplification

`node tools/runtime-spike/focus.mjs current` exercises both public loaders, all
18 themes, document/titled utility/side utility/collapsed document windows and
180×90 / 900×600 content sizes. Each case alternates two windows eight times.
The probe compares every committed full chrome raster with a fresh public render
of its declared state, checks persistent content/selection and pooled canvas
identity, checks two post-commit notifications per settled switch, and verifies
that clicking an already active window performs no render. It uses its own local
server and browser session. It does not read independent expectations or original
engine outputs; consistency with the public render is the checked contract.

To reproduce the earlier cache implementation, rebuild revision
`f905de9d` using `build-frozen.mjs` with its full SHA from
`focus-cache-build-results.json`, set `SCRIPTOSCOPE_FOCUS_ENTRY` to the compiled
entry, and run `node tools/runtime-spike/focus.mjs cache`. The runner verifies
reference artifact hashes. Reports retain all timings and input fingerprints.
The pre-removal cache produces 1,312 mismatching raster comparisons across the
288 cases. Cache removal repaints complete chrome through the guarded render
path; it also removes retained title-strip ImageData. Eager decoding already had
its own pixel cache, so direct raster transport alone does not explain the cost
of recomposition. Compare focus latency separately from startup latency.

`src/windowFocus.test.mjs` holds preparations to check rapid two/three-window
focus, removal, already-active clicks and retheming. All changed renders start
before focus awaits completion; per-window render epochs suppress stale commits.
Post-render change callbacks follow completion order. The tests do not certify
all scrollbar interactions or all asynchronous browser interleavings.

`SCRIPTOSCOPE_EXPECTED_ENTRY=/path/to/reconstructed/compiled/scriptoscope.js node
 tools/runtime-spike/focus.mjs compositor` compares the current committed window
chrome with fresh renders from a separate compiled implementation. It verifies
that implementation's artifact manifest and fingerprints both bundles, theme
archives, metadata and the stylesheet. `focus-compositor-results.json` records
288 cases / 4,608 exact byte comparisons with no mismatch against the pre-removal
`f905de9d` fresh renderer after the clipped glyph painters were consolidated.
This comparison avoids using the old focus cache as the expected raster.

The final focus-cache removal measurement in `focus-current-results.json` has
4.9 ms median / 9.2 ms p95 warm focus work for two large owned windows, with a
16.9 ms maximum. Eager large windows measure 4.9 / 12.1 ms, maximum 31.1 ms.
The first four switches per case are excluded from these warm aggregates.
Timings end at render completion, before the browser presents the next frame.
These local figures are not a portable frame-time guarantee.
