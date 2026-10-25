# Decoded raster transport spike

This experiment asks whether the existing push-button renderer can consume decoded
RGBA directly, avoiding RGBA → PNG → Image → Canvas → RGBA. It does not replace the
renderer, change resource lookup policy, or enable a new production loading mode.

Run `npm run spike:runtime` from the repository root. It requires the installed
`agent-browser` CLI and its Chromium browser. The runner starts a temporary Vite
server and an isolated browser session, writes `results.json`, and closes both.
An error or output mismatch returns a nonzero exit code. Results are local
measurements, not a portable performance budget.

## Recorded result

The 2026-10-25 local Chromium 153 run in `results.json` passed all **1,944
painted comparisons**, with zero missing faces, errors or mismatches. All 54
direct-load disposal checks passed, as did the comparator mutation probes.

| Measurement | PNG transport | Direct buffers |
| --- | ---: | ---: |
| Load | 401.4 ms | 60.1 ms |
| First narrow render | 1.6 ms | 0.2 ms |
| Warm render | 0.2 ms | 0.2 ms |

Each figure is the median of the 18 per-theme medians, rather than a combined
page-load measurement. This supports removing serialization from the loading
path; it shows no material warm-render improvement. Process memory was not
measured. The normal repository gates, library build and engine-diff also pass;
the latter retains all 12,902 committed cells unchanged.

## Implementation

The initial spike added seven lines in `src/cicnImage.ts` to register decoded
buffers. That experimental seam is now replaced by the production raster owner in
`tools/theme-loader/rasterAssets.js`. The spike still supplies the loader's custom
asset factory with empty blob URLs as lifetime identities. Its PNG comparison uses
an explicit custom PNG encoder, so the new built-in pixel shortcut cannot make
the old-versus-new comparison compare the same direct path twice.

These empty URLs are **render-only identities, not usable image URLs**. Inspector,
picker, CSS background and consumer `<img>` paths need real URLs. A production
migration would supply lazy image encoding and preserve URL ownership semantics;
this spike deliberately does not implement that second representation.

The production loader still creates valid PNG URLs; eligible renderer reads now
borrow owned pixels. Custom factories and external images retain image decoding.
No package exports change. No net code-size saving is claimed at this stage.
The experimental harness is under `tools/runtime-spike/`; it is not shipped.

`node tools/runtime-spike/run.mjs --production` compares the production owner
against explicit PNG transport through source and built entries. It additionally
decodes public image URLs and compares their pixels with direct buffer access,
and exercises push/default buttons through own/base and clipped contexts.
Results go to `production-results.json`; this requires a current `npm run build`.

The first production run passed **5,184 painted push/default comparisons** across
source and built public entries, with own and synthetic sparse-base themes and
clipped/unclipped composition. All **18,704 public raster image comparisons**
matched direct access exactly, and 36 post-disposal source/built checks passed.
There were no matching errors or missing faces counted as successful paint.
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
availability. Every direct theme disposal must evict a previously registered URL.

The first render is a narrow unlabeled normal button. Before warm measurements,
every case is rendered once on both transports; subsequent per-call timings
alternate transport order between repetitions. Very short calls are close to the
browser timer's resolution. Inspect loading and warm rendering separately.

`rawBytes` records registered pixel storage, not total process memory or retained
heap. Views share the decoded arrays instead of copying them. Eager registration
also retains unpainted assets until theme disposal, so this experiment does not
establish a memory improvement.

## Decision boundary

A successful run supports migrating raster transport incrementally, while keeping
the existing family engine and acceptance harness. It does not establish parity
for other control families, destination composition, base chains, prepared bitmap
fonts, diagnostics, independent original captures, real DOM lifecycles, built
entry points, or other browsers. Those remain acceptance work for adoption.

The next bounded change would implement an owned raster store with lazy real image
URLs, then exercise those consumers before retiring the corresponding PNG/cache
plumbing. Resource indexing and diagnostic simplification remain separate
experiments. Avoid combining them with this transport change: otherwise the
source of a mismatch or speedup would become harder to identify.
