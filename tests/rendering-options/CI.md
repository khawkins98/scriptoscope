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
  review without committing them. Run it after source-backed renderer fixes.

All 70 bounded cases are captured in two independent contact-sheet pages per
corpus theme (at most 35 cases each), yielding 36 reviewable PNGs. Each page gets
its own browser context, limiting retained DOM and capture size. The manifest
records the exact per-page case inventory.
The manifest gates browser/Playwright versions, platform, fonts, archive hashes,
case inventory and display zoom. Commit and built-bundle hashes are provenance
only, so ordinary code changes still compare against the approved images.

Golden verification is a separate opt-in command until the initial Linux sheets
have been reviewed and committed. Do not claim the golden layer is armed before
that seed and its CI verification step land. Image equality is a regression signal;
source/cinf evidence and independent geometry/color contracts establish fidelity.

Failures retain exact case/options metadata, raw source/output PNGs, DOM screenshots
and traces under `test-results/rendering-options`, with an HTML report under
`playwright-report/rendering-options`. Golden mismatches also include Playwright's
expected/actual/diff images. Artifact failures never replace the original error.
There are no automatic retries or baseline updates in verification.
