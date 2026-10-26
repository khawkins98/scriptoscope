# Owned raster transport feature PR

Status: implemented draft; final validation and independent evidence refresh remain open. One integration PR with optional stacked
sub-PRs. The integration branch targets `v2`: [draft PR #480](https://github.com/khawkins98/scriptoscope/pull/480).

The working branch is `refactor/runtime-streamlining`, starting from
`de942c6399c81d1f15d23247dfd62a36e11a64bc` with upstream `origin/v2`.
The [consumer inventory and ownership contract](raster-asset-consumers.md) records
the first design decision. The owned loader and all low-level renderer families accept the explicit owned
contract. Owner-local captured entries replace the global raster registry. The shared
owned resolver/mount and main demo adoption are implemented. Diagnostic catalog adoption and current-API application measurements are implemented. Combined runtime and loader code now decreases; a compiler-only historical baseline has been reconstructed. Independent extraction provenance and eight older optional visual-check failures remain open. The
[owned loading API](owned-theme-api.md) records the current supported boundary.

Architecture review with Astra selected one owner implementation with two explicit
contracts: an eager compatibility adapter for existing URL-bearing themes and a
distinct render-focused result/type with asynchronous image materialization.
Synchronous PNG getters are rejected because ordinary lifecycle enumeration,
serialization and inspection would trigger broad encoding.

## Current validation

The final implementation revision is `6cfe9afd`. Reports in
`tools/runtime-spike/` retain their individual revision and input hashes; an
older report is stage-specific evidence, not a claim about an untested final head.

- All 164 loader units and the packed-package consumer pass on this candidate.
- The production reference comparator checks all 18 themes, 8,424 push/default
  paints, 1,728 windows, 432 scrollbars and the 19,152-case family matrix.
  It additionally compares 18,704 public rasters against the separately compiled
  pre-simplification implementation. The final input-pinned run has zero differences after the last decoder edit.
- Focus comparison against the separate compiled fresh renderer passes 4,608
  exact outputs across 288 cases. Six held-preparation tests cover rapid focus,
  removal and retheme races. Three compositing units cover clipping and aliasing.
- Required browser contracts finish with 574 passes and two availability failures,
  both reporting extraction toolchain hash drift. No other browser failure appears.
  Previous transport-head CI was green; it does not certify this expanded head.
- Full gates stop at the Node suite with 1,139 passes, two skips and twelve TODOs,
  plus eight failing availability tests because decoder changes
  invalidate independently pinned extraction toolchain hashes. The implementer
  has not edited independent evidence. `extraction-change-results.json` records
  exact before/after hashes for the review owner. Output equivalence does not
  waive this provenance requirement.
- All 12,902 engine-diff cells remain unchanged on the final candidate. Strict
  theme lint, scene audit, requirements, reference and source-input checks pass.
  Acceptance bindings separately report artifact drift and require independent
  regeneration/review.
- All 36 pinned Linux goldens pass. The final six-trial historical application
  comparison passes; startup medians are 8,036 ms reconstructed eager / 788 ms
  owned, with substantial variation. The clean library package census is 996,635
  compressed bytes / 3,288,067 unpacked bytes, 116 entries. Earlier reports retain
  their own stage-specific hashes. Lane readiness remains blocked by the same
  independent provenance/binding failures. The older optional suite has 33 passes and eight
  unresolved failures; public input/expectation clarification is still needed.

| Production physical lines | Frozen start | Candidate | Delta |
| --- | ---: | ---: | ---: |
| Source logic, excluding cited tables | 17,477 | 17,491 | +14 |
| Cited source tables | 2,323 | 2,323 | 0 |
| Loader non-test JavaScript | 4,139 | 4,117 | −22 |
| Combined logic and loader | 21,616 | 21,608 | −8 |

Tests, declarations, benchmark harness and reports are excluded from the loader
count. This is a small net physical-line reduction. The structural changes remove
redundant decoding, title-strip cache/invalidation, repeated geometry/transfer
loops and orchestration; the line count alone does not quantify complexity.

## Implementation boundary

The explicit internal `ThemeView` now serves every low-level control family and
window chrome/body patterns. `asset(ref)` captures one transport identity before
asynchronous work, with pixels, dimensions and optional public image export on
that identity. Selection and diagnostic metadata remain captured by each family;
diagnostic URLs cannot redirect the pixels subsequently loaded. The prototype
view and owner rebinding are removed. The generic `WindowManager` preserves
original public input identity and defaults to its existing `LoadedTheme` contract.

The global private-reference registry and decoder prefix branches are removed;
owner-local entries supply captured pixels, and the ordinary external image cache
remains. The shared scanner now accepts either resolver through an additive
`mountOwnedDeclarative` entry. `createThemeResolver` and `mountDeclarative` preserve
their existing eager contracts; owned registrations may borrow legacy or owned
inputs. Generic `ScriptoscopeWindow` dependencies preserve the supplied theme and
manager types. A pending root reservation prevents competing mount contracts from
promoting the same DOM. Icons await selected exports and recheck attributes,
scope and cancellation; picker previews retain the selected base owner.

The advertisement, showcase, responsive examples, capabilities page and hostile
CSS demo now use owned loading; showcase and shared helper drops decode owned
themes. The diagnostic inspector now exports selected scene/sprite images and defers
closed inventories until opened, guarding detached panels against late results. Selected owner/reference handoffs now capture actual owner entries. Public
`assetUrl` no longer recognizes the private identity prefix.

## Outcome

Render from owned decoded pixels instead of encoding PNGs and reading those PNGs
back through browser images. Preserve existing rendering, resource selection,
public image consumers and disposal. Finish by deleting replaced transport paths
and demonstrating a net reduction in production logic across the affected runtime
and loader code, alongside measured loading and memory behavior.

The user expanded scope to deeper compositor simplification to achieve a net production-code reduction. Preserve the current family contracts and draw order, while sharing equivalent geometry, visibility, coverage and transfer traversal. Resource indexing and diagnostic redesign remain separate experiments unless needed by a measured simplification.

## Starting evidence

The [transport spike](../../tools/runtime-spike/README.md) passed 1,944 exact
push-button comparisons across 18 themes and 54 disposal checks. Local median
loading decreased from 401.4 ms to 60.1 ms; warm rendering stayed at 0.2 ms.
These are medians of per-theme medians in one local Chromium run. No memory
improvement or cross-browser equivalence is established.

That original experiment added seven runtime lines and used empty blob URLs;
it has been superseded by the production owner and explicit loading API. The
ready-image compatibility loaders retain eager encoding.

## Delivery structure

Use one feature branch and draft integration PR as the final review surface.
Maintain a checklist and current validation results in its description. Stages
may be commits on that branch or stacked sub-PRs targeting it. Each stage must
build and preserve supported behavior; merge the integration PR into its target
only after the final acceptance conditions pass. Do not create parallel engines
or bless different output to accommodate the transport migration.

| Stage | Deliverable | Completion and removal condition |
| --- | --- | --- |
| 1 | Asset-consumer inventory and ownership contract | Identify every pixel, image, CSS, inspector and export consumer; specify disposal, borrowing, pending work, external URLs and legacy themes. Resolve lazy URL compatibility before changing defaults. |
| 2 | Owned store and push/default integration | Exact push/default output across all themes, including base chains, clipping, labels and source/built paths. Replace the spike registration seam with production ownership. Existing real image URLs remain functional. |
| 3 | Lazy image materialization | Encode only on a supported image request. Verify previews, picker, CSS backgrounds, inspector, export and consumer images; prove encoding reuse, error cleanup and cancellation. Remove the replaced eager work for the migrated path. |
| 4 | Remaining renderer families | Move each family to owned pixels and remove its superseded image decode/cache path in the same change. Preserve resource ownership, fallback, display and unsupported outcomes. |
| 5 | Retirement and final validation | Remove experiment-only production seams and obsolete transport plumbing. Record production logic, shipped bytes, loading and retained memory against the frozen starting revision; complete final browser and package checks. |

## First design decision

Existing manifest asset fields contain synchronously usable image URL strings.
Lazy PNG encoding is asynchronous. An opaque handle or Promise cannot silently
replace one of those strings.

Inventory those contracts first. Preserve existing caller behavior, including
custom asset factories and pre-extracted themes. If preserving ready image URLs
requires eager materialization for an existing API, keep that compatibility path
and name its remaining cost. An additive render-focused loading path may be
needed to expose full lazy loading; record its API and consumers explicitly.
Do not promise the spike's loading improvement for a path that still eagerly
encodes every asset. Do not retain two complete pixel representations without
measuring the memory cost and specifying which owner releases each one.

## Validation contract

Freeze the starting revision, source inputs and comparison cases before production
edits. Retain the existing implementation as the comparison executable outside
the shipping runtime. Tests and benchmarks must not become a second shipped
renderer. Keep existing independent rules and original-reference checks separate
from old-versus-new regression comparisons.

- Compare exact RGBA, dimensions, layout, hit regions and applicable resource and
  unsupported outcomes. Retain mutation probes proving the comparator can fail.
- Extend push coverage to base inheritance, clipping and pattern phase, browser
  and prepared bitmap labels, and source/built public behavior.
- Verify real DOM interactions and public image consumers, including switching,
  unmounting, shared bases, repeated disposal, pending work and encode failures.
- Benchmark fresh loading, first paint and genuinely warm rendering separately.
  Record browser, corpus, repetitions and order; exclude network only when named.
- Measure live pixel bytes, live URLs and pending work over repeated switching;
  supplement with retained-heap/process measurements. Allocation counters alone
  do not establish absence of a leak.
- Track net production logic in both `src/` and `tools/theme-loader/`, separating
  rule tables and experimental harness code. Moving code does not count as a
  reduction. Report built and compressed bytes separately from source size.
- During development run affected checks. On the final candidate run the required
  theme build, library build, repository gates, engine-diff, rendering checks,
  pinned golden verification and package-consumer tests. Reuse final CI where the
  repository permits it; do not regenerate goldens to conceal differences.

## Merge conditions

- [x] Ownership and public URL compatibility decisions recorded and implemented.
- [x] Push/default and all migrated families pass exact behavior comparisons.
- [x] Public image consumers, lifecycle cases and package paths pass; two independent browser availability checks remain blocked below.
- [ ] Existing independent acceptance checks retain their meaning and pass.
- [x] Disposed owners release buffers, URLs and pending work without releasing bases.
- [x] Loading benefit and memory results rerun on the final candidate; limitations recorded.
- [x] Replaced plumbing deleted; net affected production logic decreases across source and loader.
- [x] No indefinite experimental flag or duplicate implementation remains.
- [x] Draft PR description names limitations, measurements and completed checks on the delivered implementation.

If a stage cannot preserve behavior or reduce total complexity, narrow or revise
that stage before merging. Keep the integration PR open until its outcome is
supported by the measurements, rather than declaring completion after the store
has merely been added.

## Simplification and reference evidence

Shared cinf/header geometry, body fills and union coverage replace repeated
geometry branches. Ordered axis traversal preserves reverse partial tiles,
source/destination aliasing and painter order. PixelBuffer and both window title
painters share clipped alpha-over; pure units preserve rounding, hidden RGB,
source aliasing and negative glyph origins. Window shell identity/accessibility
and scanner promotion/retheme traversal are shared while family admission,
retry, cleanup and error policies remain explicit. Currency is checked before
pruning and after every helper await.

The removed title-strip focus cache disagreed with fresh complete public renders
in 1,312 of 4,608 comparisons across 288 cases. Full guarded renders remove its
retained ImageData and invalidation state. Focus flags publish synchronously;
all changed renders start before awaiting completion, and per-window epochs
suppress stale commits. Six held-preparation units cover rapid two/three-window
focus, removal, already-active clicks and completed retheme. Full rerendering is
more expensive than partial caching; this is a correctness and simplicity change,
not a focus-speed improvement. The recorded warm owned large-window work is
4.9 ms median / 9.2 ms p95, ending at render completion rather than presentation.

One MSB-first packed-pixel primitive now serves indexed images, masks and icon
planes. Arithmetic unit cases cover 84 depth/width/padding layouts, truncated
reads and empty unsupported-depth inputs. Redundant alpha writes, repeated slug
allocation, painted hit mapping and scrollbar axis branches are removed. Icon
conversion adds a small temporary index plane; memory reduction is not claimed.
The unused internal `indexToRgb` export is removed; package exports are unchanged.

The exact frozen `de942c63` revision was reconstructed in an isolated compiler-only
build, using explicit settings and the current pinned toolchain. Historical source,
configuration and diagnostics are not inspected; extracted inputs are deleted.
Only compiled artifacts and build metadata remain. This is a reconstruction,
not a recovered release or a comparison with the original Mac program.
Equivalent-build JavaScript is 698,396 bytes frozen / 701,413 current (+3,017);
separate level-9 gzip totals are 221,364 / 221,831 (+467). Net source reduction
therefore does not establish a compiled-size reduction.

The earlier six-trial application report is preserved as
`application-historical-before-simplification-results.json`: frozen eager startup
median 2,501 ms / owned 241 ms at `f905de9d`. It uses the current application and
controlled styles with the reconstructed library, not a historical application
release. The final candidate report is `application-historical-results.json`: eager startup
5,546 / 8,036 / 8,493 ms, owned 619 / 1,230 / 788 ms. Both modes are slower
than the earlier stage; the cause is unestablished. These are fresh browser
profiles with shared OS/Vite caches, and no concurrent task-started validation or
build jobs. Ready backing storage is about 5.50 MB eager / 13.71 MB owned. All
recorded teardown/batch URL and advertisement-owner pixel counts are zero; final
batch DOM/listener samples are 350/16 in all six trials. Post-GC heap still grows
in both modes. This run does not resolve the earlier retention anomaly.
Earlier current-API reports retain timing outliers, higher owned live backing
storage, heap growth in both modes and one eager DOM/listener retention anomaly.
No portable latency budget, leak-free behavior or lower retained memory is claimed.

The eight older optional visual failures remain unresolved. A runtime-only probe
of the inherited-face invocation requested cicn −10239/raw index238 while its
decoded occurrence identified −10240/index239; fresh eager/owned loads agree on
both identities. The intended input preparation and contract require listing-free
clarification. Other failures concern ring/label behavior, showcase lookup and
shell shadow. Passing own/eager comparisons do not prove those failures predate
the migration. A frozen compiled-entry replay stopped at fixture readiness before
assertions and supplies no historical failure evidence.

Local and Forgejo maintainer-asset metadata, archive indexes and available handoff
searches did not identify the missing public reproducer. Original/private verifier
content was not opened. Independent extraction hashes and acceptance bindings
remain unchanged; their owner must review and refresh provenance before full
gates can pass. See the exact hash delta in
`tools/runtime-spike/extraction-change-results.json`.

Astra recommends a fresh independently assigned verifier in an isolated worktree,
with no inherited implementation conversation. The public task and permitted
return boundary are in [the prepared handoff](../../tools/runtime-spike/independent-refresh-handoff.md).
The maintainer authorized that separate assignment, now running in isolated
branch `khawkins98/independent-extraction-refresh`. The implementer will not
inspect independent sources, evidence diffs or verifier review material.
