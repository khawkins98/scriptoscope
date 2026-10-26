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
application lifecycle and retained-memory validation remain open.

The global private-reference registry is retired. Main demo loading and drops use the owner-local boundary; diagnostic inventories now export on open and ignore detached completions. Final
application measurements remain open. Resource indexing and
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
