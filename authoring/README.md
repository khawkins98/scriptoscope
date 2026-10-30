# Authored schemes

First-party Kaleidoscope schemes written in code with
[`tools/theme-author/`](../tools/theme-author/). Each folder holds:

- `scheme.mjs`: the source. It exports `buildScheme()`, which returns the list of resources.
- `scheme.rsrc`: the built scheme, committed so you can drop it on the demo
  without building. A unit test fails if it falls out of date.
- `meta.json`: name, author and license, in the same shape as `themes/<slug>/meta.json`.
- `preview.png`: a screenshot from the authoring preview page.

These are not part of the 18-scheme community corpus in `themes/`, and the
corpus gates (`lint:themes`, scene audits, rendering goldens) don't cover them.

Start with [`docs/authoring-a-scheme.md`](../docs/authoring-a-scheme.md).

```sh
npm run author -- authoring/schemes/halcyon
npm run dev   # then open /authoring-preview.html
```
