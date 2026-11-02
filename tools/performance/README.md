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

## Observations, 2026-11-02

Apple M5, macOS, Chromium 156.0.8078.4. Two interleaved comparisons against
unchanged main (`d0eac009`), all 18 themes at both sizes. All 72 sampled
active/inactive pixel configurations matched in both pairs. This is regression
coverage, not independent original-engine fidelity evidence.

Large-window focus-commit medians, milliseconds:

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

Complex recipe frames show the largest repeated gains. Some timings varied
substantially; 1138, 1984 and Animals had mixed second-pair focus results, and
Animals remains slower. Standalone rendering and procedural-frame results varied.
Other machine activity was uncontrolled; these observations are not CI deadlines.

## Regression checks

```sh
SCRIPTOSCOPE_PERF_URL=http://127.0.0.1:5173 node --test src/windowRegionReuse.implementation.test.mjs
```

The regression covers retained/repaired/replaced targets, isolated RGB/alpha
mutations, scale/theme changes and failed-build recovery. The two-state region
cache retains one additional source snapshot/path per window.

Production demo build, full gates, 190 focused Chromium source/production browser
contracts and 27 affected implementation unit checks passed. Full rendering-matrix,
pinned golden and cross-engine release checks remain separate.

`PERF_STAGES=1` enables inclusive internal-method diagnostics, including startup
and warmups. Nested/overlapping timings and Promise microtask delay mean stage
medians must not be summed or interpreted as synchronous self time. Disable this
instrumentation for before/after comparisons.
