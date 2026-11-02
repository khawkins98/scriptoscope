# Runtime performance benchmark

Start `npm run dev`, then run:

```sh
npm run bench:render
PERF_THEMES=all npm run bench:render
PERF_THEMES=beos-r503,evolution,animals npm run bench:render
```

The default selection is Dolphin SOM and Platinum 8; `all` uses the demo manifest.
Both 480×320 and 1280×800 content sizes run five warmups and 40 measured samples.
`PERF_URL` overrides the dev-server origin. Install Chromium with
`npx playwright install chromium` if needed. JSON results go to stdout; save raw
samples as run artifacts rather than committing them to the repository.

The isolated host loads the bundled fonts before timing and removes caller-owned
window elements after every case. `render` measures the `renderWindow` promise.
`focusCommit` measures synthetic pointer activation until both windows commit.
Frames run between activations, outside the timer. Loading and presentation are
excluded: these measurements are not INP. Avoid concurrent builds/tests when timing.

## Shared target reconciliation

For frames and control targets, exact rectangle matches remain mounted. Other
still-owned spans are reassigned; only the remaining count difference allocates
or removes elements. Reconciliation preserves rectangle order and repairs removed
or reparented targets. It uses the saved coordinate snapshot, not mutable inputs.
There are no theme-specific branches or persistent spare-node pools.

In a large Animals focus probe, creation/removal fell from 3,230 elements each to
34 each: 3,098 exact matches stayed untouched and 98 spans were updated/reinserted.

## Observations, 2026-11-02

Apple M5, macOS, Chromium 156.0.8078.4. The latest comparison isolates general
reconciliation against `b8baec95`, which already contains the region cache and
unchanged-target retention. All 18 themes ran at both sizes; six themes were
repeated in a second before/after pair. All 72 sampled active/inactive pixel
configurations matched in the full run, as did all 24 repeated configurations.
This is regression coverage, not original-engine fidelity evidence.

Large-window focus-commit medians, milliseconds (— means not repeated):

| Theme | Full run before → after | Repeat before → after |
| --- | ---: | ---: |
| 1138 | 6.7 → 7.3 | — |
| 1984 | 8.0 → 8.0 | — |
| 1990 | 9.7 → 10.1 | — |
| animals | 26.3 → 15.9 | 24.4 → 19.4 |
| apple-lisa | 6.3 → 6.7 | — |
| apple-platinum-2 | 8.4 → 7.6 | — |
| beos-r503 | 6.2 → 6.4 | 6.6 → 6.5 |
| black-platinum | 6.6 → 8.1 | — |
| crayon-os | 7.4 → 7.3 | — |
| dolphin-som | 20.6 → 20.4 | 23.6 → 22.9 |
| evolution | 12.4 → 11.3 | 10.2 → 10.1 |
| floppies | 10.2 → 8.8 | — |
| monkey-paradise | 12.0 → 11.1 | 9.6 → 11.2 |
| platinum-8 | 8.4 → 7.8 | 7.3 → 6.9 |
| slimes | 8.0 → 7.0 | — |
| system7-nostalgia-silver | 7.7 → 6.9 | — |
| windows-31 | 7.6 → 6.5 | — |
| windows-95 | 8.3 → 6.5 | — |

Animals improved in both comparisons; other results were unchanged, improved or
mixed. The algorithm saves allocation/layout work generally, but elapsed gains
depend on target geometry and count. Other machine activity was uncontrolled;
these observations are not CI deadlines. Raw samples remain local run artifacts.

## Regression checks

```sh
SCRIPTOSCOPE_PERF_URL=http://127.0.0.1:5173 node --test src/windowRegionReuse.implementation.test.mjs
```

Regressions cover exact matches, recycling, duplicates, reordering, external
removal/reparenting, mutated inputs, RGB/alpha changes, scaling and failure recovery. The two-state region
cache retains one additional source snapshot/path per window.

Production demo build, full gates, 190 focused Chromium contracts and 24 focused
Firefox/WebKit contracts passed, including native wheel, masks and target placement.
Full rendering-matrix, pinned golden and cross-engine release checks remain separate.

`PERF_STAGES=1` enables inclusive internal-method diagnostics, including startup
and warmups. Nested/overlapping timings and Promise microtask delay mean stage
medians must not be summed or interpreted as synchronous self time. Disable this
instrumentation for before/after comparisons.
