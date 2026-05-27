# `_deferred/` — archived, NOT in the build pipeline

These modules are kept as a reference/fallback but are **not imported by any live
code** (`generate-platinum.mjs`, the build scripts, or tests). They were moved here so
`scripts/generate-platinum/` reflects what's actually wired. To revive one, move it back
up a level and restore its import paths (it gained one `../` level when archived).

## The data-driven control DRAWER (PB3, reverted)

`control-metrics.mjs` · `draw-control.mjs` · `build-controls.mjs` · `raster.mjs`

A control SPEC (`control-metrics`) + a generic DRAWER (`draw-control` over the
`raster` primitives) that `build-controls` ran to generate the Platinum controls
procedurally — mirroring AppearanceLib's data/drawer split. **Reverted** because the
real shipped art is more faithful: the live generator grafts the push-button face
(-10239) + ring (-10231) from platinum-8, slices control glyphs from screenshots, and
uses the real ics4 checkbox/radio pictograms. Procedural redraw was a fidelity
regression. Kept as the elegant/future-proof template + the geometry/wiring foundation,
should a faithful procedural path ever be wanted for cicn-less schemes.

## `sample-palette.mjs`

A standalone dev CLI (never imported) that samples the accent cluts out of a scheme's
cicns — used once to extract `sources/platinum-palette.json`. Kept for re-runs.
