# Authored schemes

First-party Kaleidoscope schemes written in code with
[`tools/theme-author/`](../tools/theme-author/). Start with
[`docs/authoring-a-scheme.md`](../docs/authoring-a-scheme.md).

- `schemes/<name>/`: one folder per scheme (Kingfisher, Castle, Brickworks, Bonn,
  and Midnight 2027 in `new-year-2027/`).
- `preview-layouts/`: HTML fragments for the authoring preview's `?layout=`
  option; `sizes.html` is the stress layout.
- `experiments/`: AI-tool experiments behind
  [`docs/authoring-art-with-ai.md`](../docs/authoring-art-with-ai.md).

Each scheme folder holds:

- `scheme.mjs`: the source. It exports `buildScheme()`, which returns the list
  of resources. Bigger schemes split it into one file per family
  (`frames.mjs`, `controls.mjs`, `classic.mjs` …; Kingfisher keeps them in
  `parts/`).
- `palette.mjs`: every colour, all on 8-bit system-palette entries.
- `concept/`: `brief.md` (the art direction and build numbers), the image
  prompt (`brief-*.txt`) and `concept.jpg`, the concept image.
- `scheme.rsrc`: the built scheme, committed so you can drop it on the demo
  without building. A unit test fails if it falls out of date.
- `scheme.bin`: the same scheme as MacBinary (type `Colr`, creator `Acid`),
  for copying onto a classic Mac or an emulator disk.
- `meta.json`: name, author and license, in the same shape as `themes/<slug>/meta.json`.
- `preview.png`, `preview-sizes.png`: the review captures
  (`npm run capture:authoring`).
- `classic/`: screenshots from real Kaleidoscope 2.3.1, with a README of what
  each boot showed.

These are not part of the 18-scheme community corpus in `themes/`, and the
corpus gates (`lint:themes`, scene audits, rendering goldens) don't cover them.

```sh
npm run author -- authoring/schemes/kingfisher
npm run dev   # then open /authoring-preview.html
```
