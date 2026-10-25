# Owned raster transport feature PR

Status: in progress; delivery goal active. One integration PR with optional stacked
sub-PRs. The integration branch targets `v2`: [draft PR #480](https://github.com/khawkins98/scriptoscope/pull/480).

The working branch is `refactor/runtime-streamlining`, starting from
`de942c6399c81d1f15d23247dfd62a36e11a64bc` with upstream `origin/v2`.
The [consumer inventory and ownership contract](raster-asset-consumers.md) records
the first design decision. Stage 2 is being validated; subsequent stages remain open.

Architecture review with Astra selected one owner implementation with two explicit
contracts: an eager compatibility adapter for existing URL-bearing themes and a
distinct render-focused result/type with asynchronous image materialization.
Synchronous PNG getters are rejected because ordinary lifecycle enumeration,
serialization and inspection would trigger broad encoding.

## Current validation

- Production comparator: 5,184 painted push/default cases and 18,704 raster image
  comparisons pass across all 18 themes, source and built entries. Thirty-six
  post-disposal checks pass. The public button API returns pixels; internal
  face layout is separately compared by the source-only spike.
- Initial full Node run: 1,100 passed, 14 skipped, zero failed. After architecture
  review, 11 affected ownership/failure tests and typechecking pass, including
  post-encoding assembly cleanup.
- Library build and packed-consumer validation pass. Acceptance bindings require
  the mechanical runtime-provenance refresh as the loader changes.
- Full browser run is not green: 45 passed, 3 failed, 1 interrupted and 527 not
  run before stopping. Source/built bitmap snapshot checks and a held normal
  decode lifecycle check timed out; the interrupted moved-source check also waited
  for a held decode. The owned path bypasses that boundary. Preserve the asserted
  snapshot/abort/disconnect guarantees while updating scheduling fixtures; do not
  insert fake image work or count these checks as obsolete.
- Lazy image materialization, default first-party adoption, retained-memory
  measurements, final code reduction and full final acceptance remain open.

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

The spike adds seven runtime lines and does not change production defaults.
Its empty blob URLs are unsuitable for public image consumers.

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

- [ ] Ownership and public URL compatibility decisions recorded and implemented.
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
