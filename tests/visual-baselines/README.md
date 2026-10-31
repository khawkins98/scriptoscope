# Visual baselines

Each committed `scenes/<slug>.png` captures the diagnostic demo's **Scene · reference**
panel: the live render on the left and the period reference image on the right.
These are browser regression fixtures for reviewing visible changes. They are not
an independent pixel-fidelity oracle for the original Kaleidoscope engine; focused
compositor tests separately check allocation and original corpus RGBA pixels.

## Capture and compare

The committed fixtures are recorded and verified in the pinned Playwright image
the rendering goldens use (`mcr.microsoft.com/playwright:v1.64.0-noble@sha256:06a9…`,
Chromium 156.0.8078.4, Linux amd64). The comparison is byte-exact, so a capture
from any other OS, browser build or font set drifts without any renderer change.
Docker is required:

```sh
npm run verify:scenes:container                     # capture all themes to scratch, compare
npm run verify:scenes:container -- monkey-paradise  # one theme
npm run baseline:scenes:container                   # overwrite all committed fixtures
npm run baseline:scenes:container -- platinum-8     # overwrite one committed fixture
```

These run `npm ci`, `npm run build:themes` and then `verify:scenes` or
`baseline:scenes` in the image (`tests/rendering-options/container.mjs`), with the
repository bind-mounted and `node_modules` in a container volume. On an arm64 host
the image runs under amd64 emulation; the release gate's `scenes` job verifies the
same fixtures natively on `ubuntu-24.04`. Run one container at a time: each runs
a Chromium and concurrent containers have crashed it under memory pressure.

The host commands below stay useful for local iteration, but their captures are
not comparable with the committed fixtures unless the host is the pinned image:

```sh
npm ci
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
It never silently reuses a server on port 5173. Chromium launches with
`--disable-partial-raster`, as the goldens profile does (#526). Set `BASE` explicitly to use an
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
These Scene captures remain a separate diagnostic workflow from the mandatory
[control rendering matrix](../rendering-options/README.md), but since #599 they
share its pinned image, and the release gate requires `verify:scenes`.

## When to refresh

Review fresh images against the committed ones after an intentional renderer,
decoder, theme, or diagnostic scene change. Keep the reference source images
unchanged. Only regenerate the affected scene fixtures after checking the diff.

The 2026-10-31 refresh (#599) moves the fixtures from macOS to the pinned image.
All 18 captures repeated byte for byte in three runs, with and without
`--disable-partial-raster` (identical output either way). Every fixture changed:
the diagnostic page restyle (#252, #280) moved the panel and grew it 13-18 px, and
the engine-driver migrations since 2026-10-18 changed scrollbars, progress bars,
checkables, push buttons, default rings and window frames. The PR records the
per-scene review. These are regression fixtures of current output, not fidelity
evidence; in particular the five built-in-frame schemes currently show a blank
On/Off/OK row (see the #599 PR).

The 2026-10-18 refresh used Chromium 156.0.8078.4 on macOS after the whole-tile
allocation correction and migration of the scene to `diagnostic.html`.

## Manual browser suites (`npm run test:visual-baselines`)

The `*.spec.mjs` files in this directory are `node:test` suites driven by
Playwright's library API, not Playwright Test specs, so neither
`tests/rendering-options/playwright.config.mjs` nor CI runs them. They are
manual, maintainer-run checks; `npm run test:visual-baselines` runs the seven
that start their own isolated Vite server. Each is described below.

Status on `v2` at 2026-10-22 (Chromium from the locked Playwright, macOS): passing
`boot-affordance`, `window-promotion`, `mobile-layout`; **failing**
`control-background-sample` (base resource metadata), `control-ring` (1138
automatic label ink overlapped by the ring), `control-template-size` (timeout
waiting for the "Copy install snippet" button canvas), `window-shell-style` (window shadow computed as `none`). These
failures are preserved, not relaxed; they need diagnosis as either a runtime
regression or a stale assertion.

`posture-b.spec.mjs` moved to `tests/rendering-options/` (#536). It is now a
Playwright Test spec on the showcase, run by `npm run test:rendering` in source
and built modes.

## Boot-affordance smoke test

Install the locked development dependencies and Chromium:

```sh
npm ci
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

Uses the locked Playwright installation above and an isolated Vite server.
The test delays chrome preparation across painted frames and checks that the
original content, inherited styles, focus, and following sibling stay intact.
It also exercises first-render and content-fit failures, retry, and unmount.

## Mobile demo layout

```sh
node --test --experimental-strip-types tests/visual-baselines/mobile-layout.spec.mjs
```

Uses the same Playwright setup and an isolated server. At 320px and
390px mobile viewports it checks four showcase schemes, the upload modal,
OFF → Restore chrome, and the personal blog's locally scrolling code. Page
width and visible window bounds must fit without scaling the chrome canvases.

## Automatic control-template sizing

```sh
node --test --experimental-strip-types tests/visual-baselines/control-template-size.spec.mjs
```

Uses the Playwright setup above. Exercises the actual Windows 95 source
art, full centered label pixels, all 18 schemes' state geometry, explicit heights,
and showcase buttons/select interaction. Diagnostic Scene controls request fixed
heights and therefore do not cover this automatic-sizing path.

## Control fill and shell styling

```sh
node --test --experimental-strip-types tests/visual-baselines/control-background-sample.spec.mjs tests/visual-baselines/window-shell-style.spec.mjs
```

Uses the locked Playwright dependency and isolated Vite servers. The fill test compares rendered
interiors with original cinf background samples and checks state/base fallback
metadata. The shell test checks computed styles and actual frame/canvas bounds
for Windows 95 and System 7, including stretched grid/flex hosts and print.

## Source-backed default rings

```sh
node --test --experimental-strip-types tests/visual-baselines/control-ring.spec.mjs
```

Checks all 18 corpus state footprints/source corners and full default-label ink,
plus independent coordinate sentinels for square corners, overlapping masked
bands, repeat modes, pressed-state selection, and transparent margins. Explicit
face heights remain caller-controlled; the ring adds four pixels per side.

These ring snapshots are reviewed regression evidence, not a complete control
fidelity claim. General face geometry and pattern composition remain tracked in
[#218](https://github.com/khawkins98/scriptoscope/issues/218).
