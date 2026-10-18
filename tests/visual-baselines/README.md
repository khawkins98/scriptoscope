# Visual baselines

Each committed `scenes/<slug>.png` captures the diagnostic demo's **Scene · reference**
panel: the live render on the left and the period reference image on the right.
These are browser regression fixtures for reviewing visible changes. They are not
an independent pixel-fidelity oracle for the original Kaleidoscope engine; focused
compositor tests separately check allocation and original corpus RGBA pixels.

## Capture and compare

Install the optional browser tooling (not required for `npm test`):

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run verify:scenes                         # capture all themes to scratch, compare
npm run verify:scenes -- monkey-paradise      # capture and compare one theme
npm run verify:scenes -- --diff-only          # compare existing scratch captures
npm run verify:scenes -- monkey-paradise --diff-only
npm run baseline:scenes                      # overwrite all committed fixtures
npm run baseline:scenes -- platinum-8        # overwrite one committed fixture
npm run baseline:scenes -- monkey-paradise --out-dir /tmp/scene-review
```

Capture opens `/diagnostic.html?theme=<slug>` at 1024×720, device scale 1, verifies
the selected theme, and waits for composed canvases, fonts, and reference images
before screenshotting `#d-scene`. An unknown slug or failed capture exits nonzero.
Verification writes only to `.tmp/visual-baselines/fresh`; failure or interruption
never overwrites committed fixtures. `--diff-only` compares those scratch files,
and missing files or byte differences exit nonzero. A single-theme capture clears
the previous scratch set; pass the same slug to subsequent `--diff-only` checks.

By default capture starts an isolated Vite server on an available localhost port
and closes it and Chromium in `finally`, including on failure or SIGINT/SIGTERM.
It never silently reuses a server on port 5173. Set `BASE` explicitly to use an
existing dev or preview site; the script leaves that server running. Root URLs,
path prefixes, and landing-page URLs resolve to their sibling `diagnostic.html`:

```sh
BASE=http://localhost:4173/scriptoscope/ npm run verify:scenes -- platinum-8
CAPTURE_TIMEOUT_MS=10000 npm run verify:scenes -- platinum-8
```

The default navigation/readiness timeout is 30 seconds per operation; owned Vite
startup is capped at 15 seconds. The script logs its Chromium version. Use the
same browser build, OS, and fonts when interpreting byte comparisons: browser
layout, clipping, antialiasing, and PNG encoding can change without a renderer bug.
These optional captures are not part of the portable static CI gates.

## When to refresh

Review fresh images against the committed ones after an intentional renderer,
decoder, theme, or diagnostic scene change. Keep the reference source images
unchanged. Only regenerate the affected scene fixtures after checking the diff.

The 2026-10-18 refresh uses Chromium 156.0.8078.4 on macOS after the whole-tile
allocation correction and migration of the scene to `diagnostic.html`. All 18
captures repeated byte for byte in independent runs. Fourteen retained their
exact dimensions; apple-lisa, slimes, windows-31, and windows-95 gained one pixel
of screenshot height from layout/clipping rounding. All remain 1024 pixels wide.
The combined PNG size changed from 545,675 to 544,743 bytes. The side-by-side panel
retains the same intended live scene and reference content.

## Boot-affordance smoke test

Install the optional browser tooling once (it is not required for `npm test`):

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node --test --experimental-strip-types tests/visual-baselines/boot-affordance.spec.mjs
```

The smoke test starts an isolated Vite server on an available port and closes it
and every browser after the run, including failed assertions. To check an existing
dev server or production preview instead, pass its full landing-page URL in `BASE`:

```sh
BASE=http://localhost:4173/scriptoscope/ node --test --experimental-strip-types tests/visual-baselines/boot-affordance.spec.mjs
```

## Atomic window promotion

```sh
node --test --experimental-strip-types tests/visual-baselines/window-promotion.spec.mjs
```

Uses the same optional Playwright installation above and an isolated Vite server.
The test delays chrome preparation across painted frames and checks that the
original content, inherited styles, focus, and following sibling stay intact.
It also exercises first-render and content-fit failures, retry, and unmount.

## Mobile demo layout

```sh
node --test --experimental-strip-types tests/visual-baselines/mobile-layout.spec.mjs
```

Uses the same optional Playwright setup and an isolated server. At 320px and
390px mobile viewports it checks four showcase schemes, the upload modal,
OFF → Restore chrome, and the personal blog's locally scrolling code. Page
width and visible window bounds must fit without scaling the chrome canvases.
