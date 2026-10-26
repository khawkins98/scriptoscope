# Owned raster transport feature PR

Status: in progress; delivery goal active. One integration PR with optional stacked
sub-PRs. The integration branch targets `v2`: [draft PR #480](https://github.com/khawkins98/scriptoscope/pull/480).

The working branch is `refactor/runtime-streamlining`, starting from
`de942c6399c81d1f15d23247dfd62a36e11a64bc` with upstream `origin/v2`.
The [consumer inventory and ownership contract](raster-asset-consumers.md) records
the first design decision. The owned loader and all low-level renderer families accept the explicit owned
contract. Owner-local captured entries replace the global raster registry. The shared
owned resolver/mount and main demo adoption are implemented. Diagnostic catalog
adoption, final measurements and reduction remain open. The
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
- Current full gates pass: 1,131 Node tests pass, 2 skip and 12 remain TODO,
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
- Diagnostic catalog adoption, retained-heap/process measurements, final code
  reduction and full final acceptance remain open.

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
themes. The diagnostic inspector still needs explicit async image adoption. Selected owner/reference handoffs now capture actual owner entries. Public
`assetUrl` no longer recognizes the private identity prefix.

## Outcome

Render from owned decoded pixels instead of encoding PNGs and reading those PNGs
back through browser images. Preserve existing rendering, resource selection,
public image consumers and disposal. Finish by deleting replaced transport paths
and demonstrating a net reduction in production logic across the affected runtime
and loader code, alongside measured loading and memory behavior.

Keep the current family renderers. Resource indexing and diagnostic redesign are
outside this PR; either needs its own measured experiment.

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
- [ ] Push/default and all migrated families pass exact behavior comparisons.
- [ ] Public image consumers, browser lifecycles and package paths pass.
- [ ] Existing independent acceptance checks retain their meaning and pass.
- [ ] Disposed owners release buffers, URLs and pending work without releasing bases.
- [ ] Loading benefit reproduced on the actual delivered path; memory results recorded.
- [ ] Replaced plumbing deleted; net affected production logic decreases.
- [ ] No indefinite experimental flag or duplicate implementation remains.
- [ ] Final PR description names limitations, measurements and completed checks.

If a stage cannot preserve behavior or reduce total complexity, narrow or revise
that stage before merging. Keep the integration PR open until its outcome is
supported by the measurements, rather than declaring completion after the store
has merely been added.

## Intermediate size after owner-local retirement

At `5989db59`, `src/` non-test logic is 17,663 lines versus the frozen 17,477
(+186); cited engine tables remain 2,323. Loader non-test JavaScript is 4,229
versus 4,139 (+90). Combined affected production growth is +276 lines. Removing
the registry simplifies ownership but does not yet meet the net reduction condition.
Shared mount/image-consumer adoption and further deletion remain required.

Astra identified bounded follow-up simplifications: remove the tab facade's
obsolete copied ThemeView snapshot after binding finite selected patterns;
consolidate captured decoded-or-image preparation without delaying legacy decode
start; and avoid declared-cinf/diagnostic metadata preparation for pixel-only
control lookups where it adds no validation. Preserve family admission and trace
ordering; do not introduce a generic diagnostic framework to meet a line count.
