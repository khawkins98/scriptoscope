# Browser contracts and reviewed image goldens

`npm ci` installs the exact Playwright package in the lockfile. For a native local
contract run, install its browser with `npx playwright install chromium`, then run
`npm run test:rendering`. The command builds the public library and production demo first and compares
it with the source entry through separate static/Vite servers. It exercises every
corpus theme, the bounded option cases, source-art and synthetic slice/ring oracles,
label ink, value endpoints, actual promoted DOM, keyboard focus, and grid/flex
window-part bounds at native/2× scale. Missing themed art is recorded explicitly;
native/CSS fallback controls are compared as DOM screenshots, not invented canvases.

`npm run test:rendering:extended` runs the full valid case inventory in Chromium
at DPR1 and the bounded inventory at Chromium DPR2, Firefox and WebKit DPR1.
Install those browsers with `npx playwright install chromium firefox webkit`.
`SCRIPTOSCOPE_RENDERING_BROWSERS=chromium` narrows a local extended run. The explicit
**Extended rendering matrix** workflow runs all four projects. This is broader
option coverage, not proof of period rendering fidelity for every combination.

The workflow's `browsers` input defaults to `all`; select `firefox`, `chromium`,
or `webkit` for a focused diagnostic rerun. Every configured engine first launches
and opens a page in global setup, so a broken browser environment fails before
the matrix. The extended container uses UID 1001, matching the Actions-mounted
home directory and [Playwright's container CI example](https://playwright.dev/docs/ci#via-containers).
Firefox rejects a root process with a home directory owned by another user.
The Chromium-only golden workflow does not require this Firefox launch change.

CI uses the immutable Playwright Linux image named in the workflows and the
matching exact npm version. The same image is available locally:

```sh
npm run test:rendering:container -- contracts
npm run test:rendering:container -- record  # unreviewed candidates
npm run test:rendering:container -- verify
```

The helper selects Linux/amd64, uses an isolated anonymous `node_modules` volume,
and removes its container after the run. It writes generated builds, test results
and candidate goldens into the current checkout; use an isolated checkout for
review. Docker must have enough available memory; the helper never stops unrelated
containers. An isolated copy without `.git` can supply `SCRIPTOSCOPE_GIT_COMMIT`.

Golden recording and verification are separate commands:

- `npm run test:rendering:goldens:update` explicitly records Linux/amd64 candidates.
- `npm run test:rendering:goldens` verifies reviewed files and fails if a manifest
  or image is missing. It never creates or changes expected images.
- The **Record rendering golden candidates** workflow uploads candidates for
  review without committing them. Its default `mode=record` records then verifies;
  `mode=verify` compares committed images without recording. Optional
  `negative_probes=true` checks missing manifest/image and one-pixel mutation
  failures, restores exact expected bytes, then verifies the restored sheet.

All 70 bounded cases are captured in two independent contact-sheet pages per
corpus theme (at most 35 cases each), yielding 36 controls PNGs. A third page adds two collapsed managed windows
(document and side utility) and two directly rendered collapsed utilities with
the close widget pressed (top and side title axes) per theme, for 54 PNGs in total. Each page gets
its own browser context, limiting retained DOM and capture size. The manifest
records the exact per-page case inventory.
The manifest gates browser/Playwright versions, platform, fonts, archive hashes,
case inventory and display zoom. Commit and built-bundle hashes are provenance
only, so ordinary code changes still compare against the approved images.

CI compares the [reviewed seed images](./goldens/REVIEW.md) exactly on every
code-changing PR, alongside the independent browser contracts. Missing images,
manifest/input drift and even one changed pixel fail verification. Updates remain
an explicit candidate-and-review operation. Image equality is a regression signal;
the [known limits](./KNOWN-LIMITS.md) distinguish source-backed requirements from
acknowledged mismatches, unverified appearances and interaction gaps.

Compact JSON observations are always uploaded from `test-results/rendering-evidence`,
including executed case status/dimensions and actual golden-run environment and
provenance. They survive successive contract/golden commands. Observed unavailable
output is not an independent expected-availability oracle. Detailed screenshots,
traces and diffs are uploaded only for failures; optional negative-probe artifacts
are retained separately even when their expected failures make the proof succeed.

Failures retain exact case/options metadata, raw source/output PNGs, DOM screenshots
and traces under `test-results/rendering-options`, with an HTML report under
`playwright-report/rendering-options`. Golden mismatches also include Playwright's
expected/actual/diff images. Artifact failures never replace the original error.
There are no automatic retries or baseline updates in verification.

## CI sharding (#576)

CI runs the bounded contracts as five parallel `--shard=i/5` jobs in the same
container, with gates and goldens in their own jobs. The required check
**Gates + build + browser contracts** is the aggregate. Each shard writes a
Playwright JSON report (`SCRIPTOSCOPE_RENDERING_JSON_REPORT`) and its own
`rendering-evidence` tree. The aggregate does three things:

- `node tests/rendering-options/shards.mjs parity` checks that every test in the
  unsharded `--list` inventory ran exactly once, and that nothing else ran.
- `shards.mjs evidence` merges the observation trees in run order, with the later
  writer winning as in a serial run. It also concatenates the shard
  `requirements/execution.json` records under one commit identity.
- `test:requirements --require-execution` then validates the merged record.

The extended workflow shards each project three ways and runs the same parity
check. Playwright shards by test count and keeps a file's tests that share a
worker in one shard, so the balance between shards is approximate. Coverage
does not depend on it.

## What the PR tier leaves to the release tier

The bounded profile that CI runs on every PR skips two kinds of test. Both still
run in the extended matrix, which the release gate requires. The lists live in
[`pr-tier.mjs`](./pr-tier.mjs), which the config reads.

- **Built-mode twins.** Most specs run each test against the source modules and
  again against the built bundle. Both share the decoder, resolver and
  compositor, so the built twin only catches packaging differences, and it was a
  third of PR browser time. On PRs a built twin still runs when its spec
  registers `fidelity-assertion` annotations
  (`test:requirements -- --require-execution` needs both modes of every
  registered assertion) or is in `BUILT_SMOKE_SPECS` (the production demo bundle
  and the public explicit-host entry). `matrix.spec.mjs` keeps its source/built
  pixel comparison for all 18 themes, and the gates job runs the installed
  package consumer contract.
- **Report-only specs.** `frame-pass-through-perf.spec.mjs` asserts its budget
  only in WebKit. In Chromium it reports and returns, so it does not run on PRs.

`SCRIPTOSCOPE_RENDERING_BUILT=all npm run test:rendering` runs the full bounded
inventory locally. The aggregate job's `--list` uses the same config, so shard
parity still compares like with like.

## Firefox and WebKit interaction contracts (#598)

The specs listed in [`interaction-specs.mjs`](./interaction-specs.mjs) are where
engines genuinely differ on pointer capture, sub-pixel pointer coordinates and
focus: `window-pointer-drag`, `growbox-zero-delta`, `growbox-zone`, `posture-b`,
`transformed-ancestors`, the `frame-pass-through*` specs of #597 (hit-regions
§9.8; HPT36's WebKit budget is gated only in that engine) and the rest of the
list. They ran on every PR until the maintainer moved them to the release tier
(#598, DECISIONS #14). The PR tier is Chromium-only, and Chromium still runs these
specs on every PR in the bounded shards (source mode, plus built where pr-tier.mjs
keeps it).

In the release tier, the extended matrix runs every spec, these included, in
source and built modes in `firefox-dpr1` and `webkit-dpr1`. A separate
**Interaction contracts (firefox)/(webkit)** job used to run the list again in
both engines; it was removed because it repeated the extended run (about 25
minutes of WebKit per release run). The release gate's **Interaction contract
coverage (firefox, webkit)** job, required by the aggregate, now reads the
extended Firefox and WebKit shard reports. It lists the extended inventory for
those two engines and runs `shards.mjs parity` with
`--require-projects firefox-dpr1,webkit-dpr1 --require-files <list>`: every listed
test ran exactly once, and each interaction spec file listed and ran at least one
test in each engine. A renamed or emptied spec fails rather than passing as
"nothing listed, nothing ran". Failures upload with the extended shards.

Locally, `npm run test:rendering:interaction` builds the library and demo, then
runs the list in Firefox and WebKit (`SCRIPTOSCOPE_RENDERING_SUITE=interaction`;
`SCRIPTOSCOPE_RENDERING_BROWSERS` narrows or widens the engines). The list file is
the only place the spec set is named: the config, the npm script and the CI
check all read it.

## Current coverage boundaries

Source/built parity uses the same semantic decoder, resolver, compositor and text
rasterizer. It can catch packaging differences while both paths share a fidelity
error. The explicit 20px push/bevel ink oracle checks clipping and placement against
an input glyph mask, not original font correctness. Source-art cards are candidates,
not actual resource-selection traces or a complete glyph oracle.

Unavailable themed output is recorded honestly, but the matrix does not yet have
an independently reviewed availability inventory. A shared new null result can
escape parity; the reviewed smoke goldens catch its visual change, while an
extended-only absence needs a separate availability contract.

Native select keyboard focus, selection, replacement and disabled skipping have
focused System 7/Windows 95 checks. Generic focus probes and state-render cases do
not exhaust button activation, check/radio grouping, slider drag/keyboard changes
or tab navigation. Window fixtures cover representative grid/flex layout, scale
and shadow behavior, not the complete window-management lifecycle.

See the [fidelity plan](../../docs/spec/fidelity-verification-plan.md) and
[epic #221](https://github.com/khawkins98/scriptoscope/issues/221) for independent
truth, actual selection provenance and requirement-level verification work.

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
