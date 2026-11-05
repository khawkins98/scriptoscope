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
evidence. In the five built-in-frame schemes (apple-platinum-2, black-platinum,
platinum-8, slimes, system7-nostalgia-silver) the dialog's On/Off/OK row is the
diagnostic page's own fallback (segmented toggle and baseline button), not
scheme-rendered buttons: those schemes ship push faces without a cinf, which
`composeButton` reports as unavailable (#608).

The 2026-10-18 refresh used Chromium 156.0.8078.4 on macOS after the whole-tile
allocation correction and migration of the scene to `diagnostic.html`.

## Manual browser suites (`npm run test:visual-baselines`)

The `*.spec.mjs` files in this directory are `node:test` suites driven by
Playwright's library API, not Playwright Test specs, so neither
`tests/rendering-options/playwright.config.mjs` nor CI runs them. They are
manual, maintainer-run checks; `npm run test:visual-baselines` runs the suite list in package.json. Each owns an
isolated Vite server; the table below routes focused checks.

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

Install dependencies/Chromium once, then run a selected Node-driven suite:

```sh
npm ci
npx playwright install chromium
node --test --experimental-strip-types tests/visual-baselines/boot-affordance.spec.mjs
```

These suites close owned Vite/browser processes even on failure. For the boot
smoke, `BASE=http://localhost:4173/scriptoscope/` targets an existing preview
instead. Shared setup does not make these part of required Playwright Test CI.

## Atomic window promotion

`window-promotion.spec.mjs` delays chrome preparation across painted frames and
checks original content, inherited styles, focus and sibling layout. It also
checks first-render/content-fit failures, retry and unmount.

## Mobile demo layout

`mobile-layout.spec.mjs` checks 320px and 390px mobile viewports across four
showcase schemes, the upload modal, OFF → Restore chrome and locally scrolling
blog code. Page width and visible windows must fit without scaling chrome canvases.

## Automatic control-template sizing

`control-template-size.spec.mjs` checks real source art, centered labels, corpus
state geometry and showcase controls. Fixed-height diagnostic Scenes do not cover
automatic sizing.

## Control fill and shell styling

`control-background-sample.spec.mjs` compares interiors with original cinf samples
and checks state/base metadata. `window-shell-style.spec.mjs` checks computed
styles/frame bounds, stretched grid/flex hosts and print. These retain separate
pixel and DOM obligations.

## Source-backed default rings

`control-ring.spec.mjs` checks corpus footprints/corners, full label ink and
independent coordinate sentinels for masked/overlapping bands, repeat modes,
pressed selection and margins. Explicit face height remains caller-controlled;
ring allocation adds four pixels per side. Regression snapshots do not establish
complete fidelity; [#218](https://github.com/khawkins98/scriptoscope/issues/218)
retains broader face/pattern limits. The independent diagnostic-hash contracts
have their own [scope record](./diagnostic-hash.md).
