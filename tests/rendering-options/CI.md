# Browser contracts and reviewed image goldens

`npm ci` installs the exact Playwright package in the lockfile. For a native local
contract run, install its browser with `npx playwright install chromium`, then run
`npm run test:rendering`. The command builds the public library first and compares
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
corpus theme (at most 35 cases each), yielding 36 reviewable PNGs. Each page gets
its own browser context, limiting retained DOM and capture size. The manifest
records the exact per-page case inventory.
The manifest gates browser/Playwright versions, platform, fonts, archive hashes,
case inventory and display zoom. Commit and built-bundle hashes are provenance
only, so ordinary code changes still compare against the approved images.

CI compares all 36 [reviewed seed images](./goldens/REVIEW.md) exactly on every
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
