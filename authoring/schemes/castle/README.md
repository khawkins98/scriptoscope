# Castle

A stone keep with red conical roofs, pennants and a red title banner. Its
concept is in [`concept/concept.jpg`](concept/concept.jpg); `frames.mjs` and
`stone.mjs` keep repeating masonry procedural and place fixed towers and slits.

The surface pass keeps the frame silhouette and all recipe geometry. Interior
mortar and lit stone are closer in value to the stone faces, so the keep reads
as larger masses and the banner remains the focal point. Near-black silhouette
outlines, dark openings and the red/gold accents retain their contrast. The
parchment body is a flat 8×8 pattern instead of a flecked 64×64 texture; this
reduces decoration behind live text and removes an unnecessary scatter table.

```sh
npm run author -- authoring/schemes/castle
npm run check:schemes
npm run capture:authoring -- authoring/schemes/castle
```

The committed web previews show the current surface pass. Real-Kaleidoscope
capture conditions and build hashes are recorded in [`classic/README.md`](classic/README.md).
