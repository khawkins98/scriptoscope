# Visual baselines

Committed eyeball-comparison fixtures for the runtime. Each PNG under `scenes/<slug>.png`
captures the demo's **Scene · reference** panel for one theme — the live render on the
left, the period reference screenshot on the right. The maintainer eyeballs these against
the current dev demo when chasing a "did this look right before?" question.

These are sanity-check fixtures, not an automated pixel-diff harness. A regression that
loses theming (e.g. buttons silently un-themed) is obvious from a side-by-side glance.

## Regenerate

```sh
npm run baseline:scenes               # all 18 themes
npm run baseline:scenes -- <slug>     # one theme
```

The script (`scripts/capture-visual-baselines.mjs`) launches a headless Chromium via
Playwright, boots the dev server (or reuses one already on :5173), navigates to
`/?theme=<slug>`, waits for the Scene canvas to compose, and screenshots `#d-scene`.

## Why these aren't pixel-diffed in CI

We're prototype-mode: the theme renders are deterministic when the bundle source is
unchanged (which `npm run lint:themes` verifies via sha256), so an automated pixel-diff
would mostly catch *intentional* improvements to the renderer and force a baseline
re-capture. Eyeballing is faster than chasing flake. If the renderer ever stabilises
enough to benefit, the shape is here: drop a pixelmatch import into a tiny diff script.

## When to recapture

- After a runtime change that affects rendering (composeChrome, controls, renderWindow…).
- After a theme bundle is re-imported or a new bundle is added.
- After a decoder change in `tools/theme-loader/`.

Eyeball the diff against the previous commit (`git diff tests/visual-baselines/`).
