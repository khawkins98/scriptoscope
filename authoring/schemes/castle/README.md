# Castle

A stone keep with conical roofs, pennants and a red title banner. The
[concept brief](concept/brief.md) defines its art direction. `frames.mjs`
and `stone.mjs` combine repeating masonry with fixed towers and slits.

Keep interior mortar and highlights close to the stone faces so the keep
reads as large masses and the banner remains the focal point. Silhouette
outlines and openings carry the stronger contrast. The body uses a flat 8×8
parchment pattern to keep live text readable.

```sh
npm run author -- authoring/schemes/castle
npm run check:schemes
npm run capture:authoring -- authoring/schemes/castle
```

`preview.png` and `preview-sizes.png` show the browser render.
[Native checks](classic/README.md) record capture conditions and build hashes.
