# Browser contracts and reviewed image goldens

Use [the contributor workflow](../../docs/contributor-workflow.md#choose-the-validation-for-your-change)
to choose checks. This page owns browser execution, CI coverage, golden review
and failure artifacts. Goldens compare Scriptoscope against reviewed prior output;
they are not original Kaleidoscope captures or a complete fidelity certificate.

## Run locally

```sh
npm ci
npx playwright install chromium
npm run test:rendering
```

The runner builds public source/production paths and tests bounded cases, actual
DOM/CSS and focused independent assertions. For the full valid inventory in
Chromium DPR1 plus bounded Chromium DPR2/Firefox/WebKit DPR1:

```sh
npx playwright install chromium firefox webkit
npm run test:rendering:extended
```

`SCRIPTOSCOPE_RENDERING_BROWSERS=chromium` narrows local extended runs. The
**Extended rendering matrix** workflow accepts `browsers=all` (default), `chromium`,
`firefox` or `webkit` for diagnostic reruns. Global setup launches each configured
engine before tests; a broken browser environment fails rather than dropping it.
The extended container uses UID 1001 so Firefox can use the Actions-mounted home.

## Record and verify goldens

Use the immutable Linux/amd64 image pinned by `container.mjs` and the workflows:

```sh
npm run test:rendering:container -- contracts
npm run test:rendering:container -- record
npm run test:rendering:container -- verify
```

Docker is required. The helper uses an anonymous dependency volume, removes its
own container and writes generated builds/results/candidates into the checkout.
Use an isolated checkout with enough memory; it never stops unrelated containers.
An isolated copy without `.git` may declare `SCRIPTOSCOPE_GIT_COMMIT`, which is
provenance rather than a substitute for measured Git identity.

`npm run test:rendering:goldens` verifies without changing expectations;
`npm run test:rendering:goldens:update` records candidates. The **Record rendering
golden candidates** workflow uploads uncommitted candidates: default `mode=record`
records then verifies, while `mode=verify` only compares. Its optional
`negative_probes=true` demonstrates missing-manifest/image and one-pixel failures,
restores expected bytes and verifies them again. Recording is never approval.

The manifest records exact case/page inventory and gates browser/Playwright,
platform, fonts, source archives and display zoom. Git/bundle hashes are provenance
so ordinary changes remain comparable. Contact sheets keep bounded page sizes;
collapsed-window pages have a separate declared scope. Missing files, input drift
or a changed pixel fail. Review candidates against their source evidence and
[known limits](./KNOWN-LIMITS.md), separately from interaction correctness.

## Failure artifacts

Compact execution observations accumulate under `test-results/rendering-evidence`.
Detailed failed case/options, PNGs, DOM screenshots and traces go to
`test-results/rendering-options`; the HTML report is in
`playwright-report/rendering-options`. Golden failures include expected/actual/diff.
The [failure archive](./README.md#preserved-failed-runs) preserves separate failed
attempts before another run clears normal output. Artifact preservation failures
must not replace the primary failure. There are no automatic retries or baseline
updates in verification. Optional negative-probe artifacts remain separate.

## CI sharding (#576)

The required PR check is **Gates + build + browser contracts**. The PR tier is
Chromium-only, with gates, engine diff, builds and installed-package checks,
bounded rendering shards and exact reviewed Linux goldens. `matrix.spec.mjs`
runs two shards; other specs run five. `SCRIPTOSCOPE_RENDERING_PART` selects
`matrix` or `rest`; unset runs both locally. Each shard emits a JSON report and
its own evidence tree.

The aggregate uses `shards.mjs parity` to require the unsharded inventory exactly
once with no extras, merges observations and assertion executions under one commit,
and runs `test:requirements -- --check-issues --require-execution`. Missing,
stale or failed registered source/built assertions do not count as execution.

Extended CI shards each project three ways with the same parity check. Sharding
changes execution scheduling, not the required denominator. Check durations before
changing shard layout; a file's shared-worker tests form one shard group. WebKit's
Mesa shader cache is a timing optimization keyed to the image digest, not a pixel
baseline or reason to relax coverage.

## What the PR tier leaves to the release tier

[`pr-tier.mjs`](./pr-tier.mjs) is authoritative for bounded-profile exclusions.
Most built-mode twins and WebKit-gated HPT36 timing trials run only in the
extended tier. Specs registering fidelity assertions retain required modes;
`BUILT_SMOKE_SPECS` and the all-theme matrix retain production coverage. HP20's
functional region-path check still runs on PRs. A renamed or missing registered
spec fails configuration rather than silently shrinking coverage.

Use `SCRIPTOSCOPE_RENDERING_BUILT=all npm run test:rendering` for every bounded
built twin locally. The container forwards this variable; parity uses the same
configuration as execution.

The **Release gate** additionally requires extended browser projects, interaction
coverage, pinned goldens, decoded strict theme lint, the package consumer, pinned
Scene verification and runtime size trend. It runs manually, weekly on main,
for in-repository `release/*` PRs and as an exact-commit tag check. A red scheduled
run blocks release, not ordinary PR merging. Never require **Release gate** in
ordinary PR branch protection: skipped jobs can look green without running.
[Release instructions](../../docs/contributor-release.md) own exact-SHA dispatch,
tag, registry and Pages order; a PR merge preview does not authorize tagging a
different commit.

## Firefox and WebKit interaction contracts (#598)

[`interaction-specs.mjs`](./interaction-specs.mjs) is the single interaction-spec
list shared by configuration and CI. Release **Interaction contract coverage
(firefox, webkit)** validates extended shard reports: every listed test ran once,
and every interaction file listed and executed at least one test in both
`firefox-dpr1` and `webkit-dpr1`, with source/built coverage. Renamed/empty specs
fail. The extended timeout is 180 seconds per test versus bounded 90 seconds.

For focused local diagnosis, `npm run test:rendering:interaction` builds the
library/demo and runs that list in Firefox and WebKit.
`SCRIPTOSCOPE_RENDERING_BROWSERS` narrows or widens its engines. These specs run
in bounded Chromium on PRs as permitted by `pr-tier.mjs`; CI does not repeat the
same Firefox/WebKit list after already validating extended execution.

## Current coverage boundaries

Parity shares the decoder, resolver, compositor and text rasterizer, so both
paths can share a fidelity error. Input glyph-mask checks do not establish
original fonts. Source-art cards are candidates, not selection traces; recorded
nulls are not independent expected availability. The separate
[finite availability contract](../control-availability/README.md) covers only its
reviewed cases. Window, focus and control probes are bounded rather than exhaustive.
Use [KNOWN-LIMITS.md](./KNOWN-LIMITS.md) and the
[fidelity plan](../../docs/spec/fidelity-verification-plan.md) for remaining scope.

## Independent #459 regressions

`controls459-public-boundary.spec.mjs` is discovered by the ordinary rendering
configuration in both source and built modes. It retains the frozen independent
hand-encoded inputs and literal rejection/selection assertions, including valid
and NULL controls, malformed selected/fallback/ring metadata, mode-5 UNKNOWN and
the declared first-raw-cinf policy. `controls459-metadata.test.mjs` and its isolated
guard-removal mutations are included by the ordinary `npm test` glob. Typed
UNKNOWN cinf/ppat/mode-5 inputs must preserve their explicit original reasons.

`controls459-consumer-visibility.spec.mjs` starts a genuine production preview
and runs the unchanged independent presentation probe. Built asset URLs and
four themes' page, pointer, Space, disabled and checkable controls must pass
before visibility failures are considered. Six missing labels on the pre-repair
head remain a retained red result; visible fallback is a modern consumer policy.
This bounded presentation test uses Chromium and does not establish native glyph
OCR, native pixels or all-browser visual equivalence. Neither regression updates
goldens, source verification or native evidence status.

The checkable selection oracle wraps complete archive rasters in the declared
20px allocation using the source placement rules. It compares all alpha and
mask-set RGB, including full transparent source margins and outer padding; it
does not crop to nontransparent bounds. Finite CIcon coverage separately asserts
the complete literal masked and opaque same-occurrence planes.

`controls459-sparse.spec.mjs` and `controls459-sparse.test.mjs` retain the
independent R3 selected/fallback sparse-header rejection contract. Dense arrays,
Uint8Arrays, true NULL and an unused sparse default remain positive controls;
sparse selected metadata cannot authorize a valid fallback or completed paint.
This tests mutable modern manifest/typed-provider input, not a claim that raw
resource-fork decoding produces sparse arrays or that native behavior is known.
