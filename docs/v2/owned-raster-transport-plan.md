# Owned raster transport feature PR

[draft PR #480](https://github.com/khawkins98/scriptoscope/pull/480) targets `v2`.
Runtime implementation: `6cfe9afd`; independently refreshed integration:
`c157454c`; pre-packaging validation/report head: `23183525`. The current PR records
exact-head lane readiness. Independent contract triage has resolved the applicability
of the older optional failures; faithful test maintenance is tracked in issue #481.

## Outcome and implemented boundary

Render from owned decoded pixels and export real image URLs only when requested.
Preserve existing public APIs, resource selection, base ownership, browser
lifecycles and image consumers. Existing eager loaders remain supported adapters;
the additive owned path provides the loading benefit. The
[consumer inventory](raster-asset-consumers.md) and
[owned API](owned-theme-api.md) define these contracts.

One owner supplies captured pixels and asynchronous image exports. Every low-level
family accepts the explicit ThemeView boundary. Asset identity is captured before
awaiting work, so later diagnostics cannot redirect selected pixels. Custom image
factories and external browser decoding remain authoritative. Disposal releases
owned buffers, invalidates pending work and revokes late exports without releasing
borrowed bases.

Owned resolver/mount entry points share the original declarative scanner and
lifecycle. Pending roots reserve one loading contract; registrations borrow legacy
or owned inputs. Icons, pickers and diagnostic inventories export only selected
images with cancellation/lifetime guards. Main demos and dropped archives use the
owned path. The prototype theme disguise, global raster registry, private URI
decoding and superseded PNG/cache plumbing are removed.

The maintainer expanded scope to require a net production-code decrease. Shared
cinf/header geometry, body fills/coverage, ordered transfers, clipped glyph
composition, window-shell identity, scanner bookkeeping, packed-pixel decoding
and painted-control hit mapping replace repeated implementations. Family selection,
transfer/painter order, retry/error policy and diagnostic contracts remain explicit.
The removed title-strip cache disagreed with fresh complete renders; guarded full
renders remove its retained ImageData and invalidation state. This improves
correctness and complexity, not focus speed.

## Evidence and storage

The [harness README](../../tools/runtime-spike/README.md) documents reproduction,
measurements and limitations. The
[evidence index](../../tools/runtime-spike/evidence-index.json) records original
report hashes, sizes, capture provenance and aggregate results. Large per-case
traces and intermediate runs are archived in local maintainer assets; the index
names the archive and pre-cleanup Git snapshot. Report names inside committed
snapshots resolve through this index. Only compact current validation, size and
build manifests remain in the source tree. Runners write new reports to ignored
`.artifacts/` or `SCRIPTOSCOPE_ARTIFACT_DIR`, never over committed snapshots.

Recorded revisions identify HEAD at capture; input fingerprints also identify
working-tree inputs. Earlier reports certify their own stage, not an untested
later head. No independent evidence or behavioral expectations were changed by
the packaging cleanup. Raw failures, timing outliers and earlier receipts remain
available in the hash-verified archive.

| Validation | Recorded result |
| --- | --- |
| Integration gates | 1,147 Node passes, zero failures, two skips, twelve TODOs; all remaining gate commands pass |
| Required browsers | All 576 pass after independent provenance/binding refresh |
| Earlier transport comparator | Historical inputs through the current renderer: 18 themes; 8,424 button paints, 1,728 windows, 432 scrollbars, zero mismatches |
| Public raster checks | 18,704 current and 18,704 additional compiled-reference comparisons, zero mismatches |
| Other families | 19,152 cases, including separately reported missing/unsupported outcomes |
| Focus | 288 cases / 4,608 outputs; cache had 1,312 mismatches, full guarded renders zero |
| Regression/package | 12,902 unchanged engine-diff cells; 36 Linux goldens; packed consumer and 164 loader units pass |
| Optional visuals | Serialized run: 33 pass / eight fail; independently classified stale fixture/consumer expectations, tracked in #481 |

Review corrected the historical comparison: it now invokes the historical public
renderers, checks structural layout and compares diagnostic metadata excluding
transport URL identities. Earlier production captures certify transport parity;
new renderer comparisons have their own fingerprints and outcomes in PR #480.
Seven new scrollbar units cover removal, cancellation, live errors and overlapping
paint ordering. Shared pixel-access primitives remove duplicate facade logic.

## Size and performance limits

| Production physical lines | Frozen start | Candidate | Delta |
| --- | ---: | ---: | ---: |
| Source logic excluding cited tables | 17,477 | 17,495 | +18 |
| Cited source tables | 2,323 | 2,323 | 0 |
| Loader non-test JavaScript | 4,139 | 4,117 | −22 |
| Combined logic and loader | 21,616 | 21,612 | −4 |

Tests, declarations and the unshipped harness/reports are excluded from loader
counts. This is a small net physical-line decrease; line counts alone do not
quantify complexity. Equivalent compiler-recipe JavaScript increases by 3,314
bytes and separate level-9 gzip by 516 at runtime `60d14678`. Smaller source does not imply a smaller
bundle.

The frozen `de942c63` baseline is an isolated compiler-only reconstruction using
the current pinned toolchain. Historical source/configuration/diagnostics are not
inspected or executed as build scripts; extracted inputs are deleted. This is
neither a recovered release nor the original Mac program.

Final historical application startup medians are 8,036 ms reconstructed eager /
788 ms owned. Both modes are slower than the earlier stage; all trials and the
unexplained variation are preserved. The current app and controlled styles are
used, with fresh profiles and shared OS/Vite caches. Ready backing storage is
higher for owned loading (13.71 MB versus 5.50 MB). Teardown counters reach zero,
but heap grows in both modes and an earlier retention anomaly remains unexplained.
No portable latency budget, lower retained memory or leak-free behavior is claimed.

## Independent boundary and remaining acceptance

The maintainer explicitly assigned a fresh verifier in an isolated worktree to
refresh extraction provenance and acceptance bindings at `6cfe9afd`. Their commit
`7e5029c6` was integrated as `c157454c`. Only status, commit identity and public
check results returned; independent sources, evidence diffs and verifier review
material stayed outside implementer context. See the
[public verifier handoff](../../tools/runtime-spike/independent-refresh-handoff.md).

The eight older optional failures remain failing, but their public contracts are
now independently clarified. Their fixtures/expectations conflict with current
signed selection, metadata admission, typography or consumer/CSS setup. The verifier
recommends merge after mandatory checks pass and tracks restored coverage in
[issue #481](https://github.com/khawkins98/scriptoscope/issues/481). Current eager/owned
parity does not establish historical preexistence; no such claim is made. The
[listing-free questions](../../tools/runtime-spike/older-visual-contract-questions.md)
record the permitted diagnostics and listing-free independent classifications.
Do not modify expectations to pass these cases.

Merge requires preserved public/lifecycle behavior, justified independent evidence,
net affected production-code reduction, reproducible measurements, final required
checks and resolution of the remaining optional visual contracts. No experimental
parallel renderer is shipped. Keep the integration draft until those requirements
are met; archive packaging does not waive them.
