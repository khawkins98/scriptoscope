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

## Control and title allocation follow-up

A second comparison against `195e8fd2` exercises shared control/title paths:

| Probe | Before → after |
| --- | ---: |
| 12 standalone slider updates, new canvases | 12 → 0 |
| 8 selections across 4 tabs, new canvases | 96 → 64 |
| 3 long, truncated window titles, new canvases | 435 → 15 |
| Same titles, `measureText` calls | 417 → 411 |
| 100 idle managed controls over 20 frames, serialized measurements | 2,000 → 0 |

Standalone slider and tab face canvases now keep their identity. Promoted native
ranges preserve their existing canvas publication lifecycle, which the packaged
consumer repaint contract requires. Remaining tab canvases are
composition surfaces. Private synchronous canvas uploads avoid an intermediate
pixel copy; public `toImageData()` still returns an independent snapshot. Title
probes share one lazy context and only the last measurement within each request,
so font changes are observed on subsequent renders. Managed controls still read
fresh geometry/styles each frame; only identical frozen results are reused.
All sampled slider, tab and long-title pixel hashes matched the baseline.
The follow-up also ran all 18 themes at both sizes: all 72 active/inactive window
pixel configurations matched. Across themes, the median after/before ratio of
per-theme medians was 0.93 for small-window rendering, 0.94 for small focus commits,
0.79 for large-window rendering and 0.83 for large focus commits. Some individual
results regressed (large Monkey Paradise focus: 9.7 → 12.5 ms; Platinum 8 render:
2.7 → 3.5 ms). This single pair is observational and does not establish a universal
speedup; the allocation counts above are the more direct evidence.

Retheme-only scrollbar deferral was trialled and removed: an eight-window probe
still forced nine layouts. Broader layout batching needs a separate measured
change that preserves gutter-dependent dimensions and commit ordering.

## Regression checks

```sh
SCRIPTOSCOPE_PERF_URL=http://127.0.0.1:5173 node --test src/windowRegionReuse.implementation.test.mjs src/controlReuse.implementation.test.mjs
```

Regressions cover exact matches, recycling, duplicates, reordering, external
removal/reparenting (including overlay-parent cleanup), mutated inputs, RGB/alpha
changes, scaling and failure recovery. Held tab decodes also check that the latest
selection wins, superseded errors are discarded, and current errors still propagate. The two-state region
cache retains one additional source snapshot/path per window.

Follow-up validation passed: theme extraction, production demo build, full gates,
packaged consumer, 106 focused Chromium source/production contracts and 26 final
range rechecks. Firefox/WebKit added 50 passes; two WebKit shared-storage cases
were skipped. Both opt-in implementation browser regressions passed. Full
rendering-matrix, pinned golden and cross-engine release checks remain for CI.

`PERF_STAGES=1` enables inclusive internal-method diagnostics, including startup
and warmups. Nested/overlapping timings and Promise microtask delay mean stage
medians must not be summed or interpreted as synchronous self time. Disable this
instrumentation for before/after comparisons.

## Fixed title surface (#646), 2026-11-03

Apple M5, macOS, Chromium 156.0.8078.4, compared with `bf93341e` (including
#643). The standard `npm run bench:render` selection ran first, followed by the
same harness with the title replaced by `'Palette '.repeat(32) + 'Ç'` to exercise
truncation. Each case retained five warmups and 40 measured samples. Before and
after runs were sequential, after local tests finished; other machine activity
was uncontrolled. All 16 sampled active/inactive pixel hashes matched.

Medians in milliseconds, before → after:

| Title | Theme | Content width | Render | Focus commit |
| --- | --- | ---: | ---: | ---: |
| Standard | Dolphin SOM | 480 | 1.7 → 1.4 | 8.3 → 6.7 |
| Standard | Dolphin SOM | 1280 | 3.9 → 3.5 | 15.4 → 16.0 |
| Standard | Platinum 8 | 480 | 1.0 → 1.0 | 4.3 → 2.7 |
| Standard | Platinum 8 | 1280 | 2.0 → 1.5 | 4.8 → 4.6 |
| Long | Dolphin SOM | 480 | 2.9 → 2.2 | 8.6 → 6.9 |
| Long | Dolphin SOM | 1280 | 4.3 → 4.1 | 16.0 → 17.5 |
| Long | Platinum 8 | 480 | 0.9 → 1.2 | 6.1 → 6.7 |
| Long | Platinum 8 | 1280 | 1.9 → 1.9 | 5.9 → 6.1 |

This single pair shows mixed timing, not a universal speedup or a CI threshold.
Browser resource checks and implementation tests separately require one reused
4096×32 plain title canvas for fitting and both colour passes, no resize after
context acquisition, and bounded subrectangle readbacks. Wider/taller publication
uses disjoint tiles, with synthetic alpha checks at both horizontal and vertical
seams. The canvas plus current RGBA readback retain the existing 1,048,576-byte
bound; small clips now use the declared full surface rather than a smaller
backend-dependent allocation. This intentionally trades that small-clip backing
size for consistent native coverage. Raw timing samples remain local artifacts.
