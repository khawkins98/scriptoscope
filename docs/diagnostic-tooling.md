# Diagnostic tooling

Use placement diagnostics to identify which recipe slice painted a region.
For a consumer integration problem, start with [integration edge cases](./integration-edge-cases.md).
For a new corpus bundle, follow [porting](./porting-a-kaleidoscope-scheme.md).

`ComposedChrome.placement` records source rectangles, part codes/roles, render
modes and output rectangles. These tools explain the current renderer's output;
they do not independently prove original Kaleidoscope fidelity.

## In the browser — the slice inspector

Run `npm run dev`, open `/diagnostic.html?dev=1`, choose a scheme and expand its
slice inspector. Select a source slice to highlight its output regions, or hover
the rendered window to identify the slice beneath the pointer. Edge filters
isolate top, bottom, left, right or widget placements. A tiled slice can produce
many regions; a scaled slice produces a differently sized destination.

Record the scheme, window type/state, size, part code, source and output rect
when reporting a discrepancy. A screenshot alone often hides the relevant
allocation decision.

## Headless — Node CLIs (no browser)

Build the runtime and generate local theme derivatives before these file-based
tools; they read `themes/<slug>/theme.json` and decoded PNGs:

```sh
npm run build
node scripts/extract-scheme.mjs 1138
npm run diag:render -- 1138 --title Hello --w 178 --h 98
npm run diag:audit -- 1138
```

See [bundle derivatives](./theme-bundle-layout.md#what-npm-run-buildthemes-produces-locally-gitignored)
for the full bake pipeline. Rebuild after runtime/source changes.

### `npm run diag:render -- <slug> [windowType] [flags]`

A slug is required. The default type is the document window when available,
otherwise the first renderable recipe. Flags:

| Flag | Meaning |
|---|---|
| `--w N`, `--h N` | Content dimensions; defaults 240×120 |
| `--title T` | Estimate title width at six pixels per character; no browser glyph rasterization |
| `--plate N` | Explicit bare title width; recipe margins are added by layout |

Writes `themes/<slug>/diag/<windowType>.png` and `.json` (including placement)
and prints a slice table. These outputs are gitignored. The CLI handles recipe
windows, not built-in procedural-frame schemes; use the browser for those.
It is not a substitute for DOM/CSS or font testing.

### `npm run diag:audit -- [slug]`

Omit the slug to inspect all locally baked themes. The audit checks edge
coverage, code-to-mode expectations, widget placement and excessive tile counts.
It exits nonzero on warnings. It does **not** compare reference screenshots or
establish independent decoder correctness. Interpret a warning against the
relevant contract before treating it as a runtime defect.

## Files

| Concern | Home |
|---|---|
| Placement output | [`src/composeChrome.ts`](../src/composeChrome.ts) and delegated engine families |
| Render/audit entrypoints | [`render-window.mjs`](../scripts/render-window.mjs), [`audit-placement.mjs`](../scripts/audit-placement.mjs) |
| File-based PNG and window helpers | [`diag-lib.mjs`](../scripts/diag-lib.mjs) |
| Interactive inspector | [`demo/diagnostic.html`](../demo/diagnostic.html) |
