# Runtime rendering and focus benchmark

Focus commits used to remove frame hit-target nodes and recreate them even when
their geometry was unchanged. The manager now retains those nodes and lets its
existing rectangle reconciliation replace changed geometry and repair detached
nodes. A bounded two-state region cache also reuses active/inactive preparations
across fresh wrappers of the same decoded resource, checking backing-data identity,
exact pixel bytes and complete layout/state keys. Failed builds remain retryable.

Title scratch canvases request CPU-friendly readback, and template extent scanning
reads alpha directly without creating per-pixel tuples. Visible canvases retain
their existing rendering path. The region cache costs one additional source
snapshot/path per managed window; it is cleared on theme changes and failed builds.

## Running the benchmark

Start `npm run dev` in one terminal, then run:

```sh
npm run bench:render
PERF_THEMES=all npm run bench:render
PERF_THEMES=beos-r503,evolution,animals npm run bench:render
```

The default selection is Dolphin SOM and Platinum 8. `all` reads the demo theme
manifest. Both content sizes, 480×320 and 1280×800, are measured for each theme.
Use `PERF_URL=http://127.0.0.1:5174` for another dev-server origin. Install the
repository Chromium with `npx playwright install chromium` if necessary.

Each isolated case loads the bundled Charcoal 12 and Virtue fonts before timing.
It reports median, p95 and every sample after five warmups. The host contains two
managed windows and is cleaned between cases: manager disposal alone intentionally
leaves caller-owned hosts mounted. Theme/font/module loading is excluded.

`render` measures the public `renderWindow` promise through detached canvas and
DOM construction. `focusCommit` measures synthetic pointer activation until both
affected windows commit their chrome and regions. Frames run between activations,
outside that timer. These are runtime work measurements, not INP or actual
input-to-presentation latency. Run comparisons on the same browser and machine
without concurrent builds, tests or profiling; timings are report-only.

## All-theme observations (2026-11-02)

Apple M5, macOS, Chromium 156.0.8078.4. Two interleaved baseline/candidate pairs,
40 samples per case per run. Baseline is unchanged `main` at
`d0eac0096e9c8efbf946ac7aa1865f7f3a2b3317`; the candidate is the complete runtime
patch in this PR. Source/diff hashes and raw samples are recorded in
[measurements.json](./measurements.json). No other test/build jobs from this task
ran during measurement; other machine activity is uncontrolled.

All 72 sampled active/inactive chrome configurations match baseline pixel hashes
in both pairs. This is regression evidence for sampled output, not a new claim of
independent fidelity to the original engine.

Large-window (1280×800 content) focus-commit medians, in milliseconds:

| Theme | Pair 1 baseline → candidate | Pair 2 baseline → candidate |
| --- | ---: | ---: |
| 1138 | 7.9 → 5.8 | 9.3 → 9.8 |
| 1984 | 10.2 → 6.3 | 9.0 → 9.3 |
| 1990 | 14.2 → 8.1 | 19.0 → 10.4 |
| animals | 27.3 → 24.0 | 32.6 → 32.9 |
| apple-lisa | 6.9 → 5.1 | 9.9 → 7.4 |
| apple-platinum-2 | 8.2 → 8.3 | 7.0 → 7.8 |
| beos-r503 | 7.3 → 5.2 | 11.4 → 7.0 |
| black-platinum | 6.5 → 6.4 | 8.3 → 7.9 |
| crayon-os | 8.3 → 6.2 | 9.9 → 7.1 |
| dolphin-som | 52.0 → 17.1 | 58.0 → 21.5 |
| evolution | 15.9 → 9.2 | 16.0 → 9.3 |
| floppies | 11.1 → 7.5 | 16.7 → 12.4 |
| monkey-paradise | 19.3 → 8.9 | 27.2 → 15.6 |
| platinum-8 | 6.8 → 6.6 | 9.4 → 11.3 |
| slimes | 6.2 → 6.2 | 8.9 → 11.3 |
| system7-nostalgia-silver | 6.6 → 6.2 | 8.5 → 10.9 |
| windows-31 | 7.8 → 5.8 | 9.1 → 7.3 |
| windows-95 | 8.0 → 5.9 | 11.0 → 9.1 |

The largest repeated focus gains occur in complex recipe frames: Dolphin SOM,
1990, Evolution and Monkey Paradise. Other recipe themes also improve in many
cases, while 1138, 1984 and Animals have mixed second-pair focus results. Animals
remains a slower case. Procedural-frame themes and standalone rendering show
run-to-run variation; these data do not establish a universal rendering speedup.
Both sizes, render timings, p95s and individual samples are retained in the JSON.

## Diagnostics and validation

For inclusive per-method diagnostics, run:

```sh
PERF_STAGES=1 npm run bench:render
SCRIPTOSCOPE_PERF_URL=http://127.0.0.1:5173 node --test src/windowRegionReuse.implementation.test.mjs
```

Stage samples include initialization and all activations, including warmups.
Methods nest and asynchronous calls overlap; `.finally()` timing may include
microtask delay. Do not sum stage medians or interpret them as synchronous self
time. Keep instrumentation disabled for before/after comparisons.

Validation on the runtime patch: fresh production demo build, full `gates` with
zero failures, 190 focused Chromium source/production browser contracts, 27
implementation unit checks and the cache/target browser regression passed.
The browser checks cover trusted wheel routing, frame holes, widget masks,
inactive input, scrollbar target placement, overlay identity, pointer drag and
resize. The implementation-owned regression checks retained/repaired/replaced
targets and isolated RGB/alpha mutations, scale, theme and failure invalidation.
Independent agent review found no concrete runtime defect; test feedback was
addressed. Full rendering-matrix, pinned goldens and cross-engine release checks
remain CI responsibilities. Performance measurements are not CI deadlines.

Readback hint semantics: [HTML canvas specification](https://html.spec.whatwg.org/dev/canvas.html).
