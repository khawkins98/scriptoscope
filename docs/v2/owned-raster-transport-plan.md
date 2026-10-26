# Owned raster transport feature PR

Status: in progress; delivery goal active. One integration PR with optional stacked
sub-PRs. The integration branch targets `v2`: [draft PR #480](https://github.com/khawkins98/scriptoscope/pull/480).

The working branch is `refactor/runtime-streamlining`, starting from
`de942c6399c81d1f15d23247dfd62a36e11a64bc` with upstream `origin/v2`.
The [consumer inventory and ownership contract](raster-asset-consumers.md) records
the first design decision. The owned loader and all low-level renderer families accept the explicit owned
contract. Owner-local captured entries replace the global raster registry. The shared
owned resolver/mount and main demo adoption are implemented. Diagnostic catalog adoption and final current-API application measurements are implemented; net reduction, historical-baseline comparison and eight older visual-check failures remain open. The
[owned loading API](owned-theme-api.md) records the current supported boundary.

Architecture review with Astra selected one owner implementation with two explicit
contracts: an eager compatibility adapter for existing URL-bearing themes and a
distinct render-focused result/type with asynchronous image materialization.
Synchronous PNG getters are rejected because ordinary lifecycle enumeration,
serialization and inspection would trigger broad encoding.

## Current validation

- Production comparator: 8,424 painted push/default cases and 18,704 raster image
  comparisons pass across all 18 themes, source and built entries. An additional
  1,728 window paints and 432 scrollbar paints match exactly. This includes
  mixed owned/legacy bases and 648 prepared bitmap label cases. Thirty-six each
  of zero-PNG rendering, interactive activation, diagnostic URL and disposal
  checks pass. Public button dimensions and pixels are compared; internal face
  layout is separately compared by the source-only benchmark.
- The renderer-family slice adds 19,152 comparisons: 15,278 paints, 3,474
  matching missing outcomes and 400 explicitly unsupported checkable outcomes
  where the sparse child lacks a declared census. None are counted as painted
  output. There are zero mismatches or unexpected errors. Another 108 completed
  tab, bevel and header diagnostic checks pass.
- Current full gates pass: 1,134 Node tests pass, 2 skip and 12 remain TODO,
  with zero failures. This includes ownership, failure, diagnostic snapshot and
  duplicate-path occurrence checks. Typechecking includes negative public-source
  compatibility assertions.
- Current library build and packed-consumer validation pass. Acceptance bindings
  have been refreshed and verified for the loader changes.
- The six previously failing/interrupted source/built image-decode lifecycle
  cases now pass unchanged. Existing loaders are eager compatibility adapters
  again; the distinct owned path has its own abort/disposal and snapshot tests.
  The 56-case window/managed-context browser suite passes on the final slice;
  full final browser/golden validation remains required.
  The family migration full run passed 562 cases and found 14 consumed-cinf
  diagnostic failures; the correction passed all 38 affected border/cinf cases.
  Registry retirement then passed 90 targeted browser cases, with another 24
  lifecycle/transport cases passing after the final owner-state version change.
- Shared lazy image exports and bundle loading are implemented, with pending
  image reuse, failure retry and late disposal cleanup. The transitional
  pixel-registration-behind-PNG-URLs path has been removed.
- Thirty-six mounted owned windows preserve input identity and interactive content
  through retheming. Selected-only CSS export/disposal checks pass, as do two
  baseline sizing and two pending-CSS disposal probes. The final transport report
  records runtime, built and harness hashes and rejects changed inputs.
- All 12,902 engine-diff cells remain unchanged.
- Shared scanner comparison passes 36 eager/owned mounted cases across all 18
  themes and source/built exports, plus two dropped File registrations and two
  borrowed legacy registrations. Pending mixed-contract mounts reject and
  same-contract calls share one handle. All 69 targeted page/scanner/button
  lifecycle browser cases pass; fresh demo build and packed consumer pass.
- Final six-trial current-API application measurements pass their harness checks; median startup is 2,602 ms eager / 340 ms owned. Owned live backing storage is higher, and timing/retention anomalies remain recorded.
- Final required browser coverage passes across the 568-case initial success and isolated rerun of eight shared-output failures. All 36 Linux goldens, package checks and lane readiness pass on `f927ff5a`. Net reduction, matching historical-baseline evidence and the eight older visual-check failures remain open.

## Next vertical slice and compatibility boundary

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
- [x] Public image consumers, browser lifecycles and package paths pass.
- [ ] Existing independent acceptance checks retain their meaning and pass.
- [x] Disposed owners release buffers, URLs and pending work without releasing bases.
- [x] Loading benefit reproduced on the actual delivered path; memory results recorded.
- [ ] Replaced plumbing deleted; net affected production logic decreases.
- [x] No indefinite experimental flag or duplicate implementation remains.
- [x] Final PR description names limitations, measurements and completed checks.

If a stage cannot preserve behavior or reduce total complexity, narrow or revise
that stage before merging. Keep the integration PR open until its outcome is
supported by the measurements, rather than declaring completion after the store
has merely been added.

## Intermediate size after owner-local retirement

At `5989db59`, `src/` non-test logic is 17,663 lines versus the frozen 17,477
(+186); cited engine tables remain 2,323. Loader non-test JavaScript is 4,229
versus 4,139 (+90). Combined affected production growth is +276 lines. Removing
the registry simplifies ownership but does not yet meet the net reduction condition.
At that stage, shared mount/image-consumer adoption and further deletion were
still required.

Astra identified bounded follow-up simplifications: remove the tab facade's
obsolete copied ThemeView snapshot after binding finite selected patterns;
consolidate captured decoded-or-image preparation without delaying legacy decode
start; and avoid declared-cinf/diagnostic metadata preparation for pixel-only
control lookups where it adds no validation. Preserve family admission and trace
ordering; do not introduce a generic diagnostic framework to meet a line count.

## Diagnostic consumer validation

The owned diagnostic page passes all 18 targeted page/history browser cases.
A local source-browser probe records 312 closed inventory images with no image
exports assigned. Opening the 1138 raster panel exports all 542 thumbnails as
blob URLs while the separate icon inventory remains deferred. Holding 473 new
1984 image exports, switching themes and releasing them publishes none into the
detached panel. See `tools/runtime-spike/diagnostic-results.json`.

An additional `npm run test:visual-baselines` run has 33 passes and 8 failures
(ring/label expectations, inherited-face census, a showcase locator and shell
shadow). Their relation to this migration remains unproven; do not claim those
checks pass or change their fixtures to accommodate the transport. Triage remains
part of the final verification audit. Required final browser/pinned-golden checks,
actual mounted loading/memory measurements and net reduction are still open.

## Intermediate size after consumer adoption

At `47ec08d0`, `src/` non-test logic is 17,740 lines (+263 over the frozen
17,477), with cited tables unchanged at 2,323. Loader non-test JavaScript remains
4,229 (+90), for combined affected production growth of +353 lines. The owned
mount and image consumers are adopted; actual code reduction remains unmet.
The next slice measures real mounted startup/switching and retained memory, then
removes obsolete preparation/adapters where the measurements and source audit
support it. Docker is available for final pinned-golden verification.


### Application measurement and bounded cleanup, 2026-10-26

`0a3ffc89` records six fresh-browser trials of the actual advertisement app,
including real theme switches and twenty public mount/disconnect cycles per
trial. See `tools/runtime-spike/application-results.json` and its README for raw
samples, hashes and limitations. This compares current eager/owned APIs rather
than a frozen historical executable; Vite servers and OS caches are shared.

Eager startup is 2,512 / 2,557 / 2,759 ms; owned is 4,160 / 277 / 335 ms. The
promising owned median must be read alongside the unexplained slow trial and its
two slow first-round switches. Initial PNG URLs drop from 3,196 to 2. Owned
caches retain 9,360,204 decoded pixel bytes; ready backing storage rises from
4.87 MB to 13.84 MB. Observed advertisement storage and global URLs release on
teardown; after cycle batches DOM nodes/listeners stabilize, but JS heap grows.
This is bounded lifecycle evidence, not proof of lower retained memory or no
leaks. Timing and memory acceptance remain unresolved.

`42f0f4c9` consolidates the two PNG encoding shells and removes copied tab
catalogs, retaining selected resource captures and display capabilities. Astra
reviewed the cleanup and measurement methodology without finding a correctness
or ownership blocker. Typecheck/build, seven encoder/failure tests, eleven tab
tests and all 12,902 engine-diff cells pass. The full source/built transport matrix
passes again with zero mismatches. All 1,134 Node tests pass; the final gate
required refreshing generated loader acceptance bindings, which now validate.
Packed-consumer validation passes. Full browser/pinned Linux checks are running.

Production source is now 17,737 logic lines plus 2,323 cited-table lines; loader
JavaScript is 4,205 lines. Against the same baseline, combined production growth
is +326 lines. This cleanup removes 27 lines, but net reduction remains unmet.
The draft PR also retains the eight unresolved additional visual-baseline
failures. Lane readiness reported an unavailable `Traps.h` prerequisite; it is
not recorded as passed. No golden expectations were changed.


### Final checks and diagnostic follow-up

All 36 pinned Linux Chromium golden checks pass unchanged. The full local browser
contract run remains live. A stricter TypeScript unused-local/parameter audit
passes and reveals no additional dead internal declarations to remove.

The optional application `--diagnostic` mode now records phase spans, long tasks
and HTTP resource timings in a separate artifact. Both smoke trials pass on the
cleaned production code. They overlap browser validation and retain tracing data,
so their timing and memory figures do not replace the six-trial measurement.
The prior owned startup outlier did not recur and remains unexplained.

The published JavaScript census is 713,285 bytes / 225,215 gzip bytes (per-file
level 9), including lazy chunks. Full package size is 1,004,082 compressed bytes.
`tools/runtime-spike/shipped-size-results.json` pins each JavaScript hash. A
matching compiled frozen-baseline artifact remains unavailable; no historical
shipped-size delta is claimed.

The trap-table prerequisite is resolved: the check consumes the exact pinned
Apple UI 3.0.1 header, SHA-256
`b2d54498b8f790f6ca959bdfe5cfb2ef84bec8e0a565bd65c1a09dc7c3d34c7b`,
from the public UniversalInterfaces mirror at revision
`328d38f2b72b2d4ceda30170eea32ca6b9de218a`, path
`3.0.1/Universal/Interfaces/CIncludes/Traps.h`. `gen-trap-table --check` passes.
The header was used only as verifier input. The first lane-readiness run also
rejected a moving HEAD/worktree while these changes were being committed; its
runtime checks passed, but the aggregate is not a readiness pass. Rerun against
the frozen committed worktree with `SCRIPTOSCOPE_TRAPS_H` set to the pinned file.


### Final normal-mode measurement and acceptance status

The current `application-results.json` records six normal-mode trials on cleaned
production commit `f927ff5a`, with no concurrent task-started build/validation.
The original six-trial result is retained byte-for-byte in
`application-initial-results.json`. Eager startup is 2,602 / 2,514 / 4,649 ms;
owned is 267 / 2,257 / 340 ms. Median startup is 2,602 / 340 ms, respectively.
Both modes have slow trials and long switches. Tracked advertisement storage and
URLs release at teardown, but post-GC heaps grow during repeated mounting. One
eager trial retains 366 nodes / 17 listeners in its last two batches; other
trials have 350/16. Neither uniform memory stabilization nor leak-free behavior
is claimed. Astra's final measurement review found no evidenced production
regression requiring a broader implementation change.

All required 576 browser cases pass across the full run and isolated rerun of
eight shared-output failures. The initial run had 568 passes; rebuilding once
and rerunning its eight failures serially passed all eight. These included
missing dist files/trace files and production-page setup/readiness failures
while the pinned Linux job rebuilt shared outputs. All 36 pinned Linux goldens
pass. Final lane readiness exits zero on the clean pushed `f927ff5a` after the
feature branch upstream and exact pinned header prerequisite were corrected.
Serialize build/browser/golden jobs to avoid repeating that output contention.

The older optional visual suite still has 33 passes / 8 failures when run
serially. A temporary runtime-only probe of the inherited-face failure observed
Windows95 root owner/depth 0, requested cicn -10239 with raw index 238, but decoded
`cicnSource` -10240/index 239. Fresh eager and owned loader results preserve
matching identities for both entries. How the failing invocation prepared or
changed its inputs still needs listing-free clarification. The diagnostic was
restored byte-for-byte; no independent tests, fixtures or goldens were edited.
Other ring, label, showcase-locator and shell-shadow failures remain unresolved;
passing current own/eager comparisons do not prove that these predate migration.

Production growth remains +326 lines. The original decrease condition is unmet;
user clarification on transport scope versus a deeper simplification is pending.
No compiled artifact matching the frozen starting revision was found, so the
historical loading/shipped-byte comparison also remains unverified. The PR stays
draft; those requirements are not waived by the passing current-API checks.


### Scope expansion authorized by maintainer

The maintainer chose deeper simplification to require a net code reduction, rather
than accepting the transport migration's +326-line production growth. Start with
shared cinf/header geometry and visibility, then consolidate axis traversal while
preserving transfer semantics, masks, clipped phase, painter order and diagnostic
identities. Retire each duplicate implementation in the same slice; report actual
source/loader totals rather than projected savings. Keep supported public APIs.

The maintainer also authorized locating or remaking a compiled frozen baseline.
Any remake uses an isolated automated build of the pinned implementation and
exposes only compiled output and build metadata to the implementer. Do not inspect
historical source, original listings, independent acceptance sources or private
verifier material. Existing independent CI is green on `82e7d9f3`; its verified
behavior remains the regression harness for the expanded work.
