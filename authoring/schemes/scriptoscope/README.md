# Scriptoscope Reference

An original reference scheme based on the Scriptoscope site's geometric maker
mark and editorial palette. The charcoal bezel surrounds a flat paper title
plaque; controls use paper, ink and restrained brass. The six colours appear in
the rotated maker mark and repeating segmented progress fill.

```sh
npm run author -- authoring/schemes/scriptoscope --sheet --palette
npm run check:schemes
npm run dev
# /authoring-preview.html?scheme=/authoring/schemes/scriptoscope/scheme.rsrc
npm run capture:authoring -- authoring/schemes/scriptoscope
```

- `scheme.mjs`: push/check controls, metadata and family assembly with duplicate-id checks.
- `palette.mjs`: display colours and important contrast pairs.
- `parts/frames.mjs`: named frame cells, measurements, painted states and pressed strips.
- Other `parts/` files: control families and native control-panel extras.
- `concept/`: design intent, selected generated concept and exact prompt.

The concept established composition and material hierarchy. Its illustration was
not used as a source for the logo: the maker mark is reconstructed directly from
the site's six exact colours, order, spacing and -8° rotation using whole-pixel
sampling. Repeating surfaces and glyphs are deterministic raster geometry.

The document's warm-paper background uses `cinf` → `ppat 42`. Ordinary classic
applications still own their content drawing. The footer hatch is painted inside
a fixed cell; separate grow-box resources serve native content corners.

Browser previews cover active/inactive, narrow/wide and long titles. The 8-bit
simulation retains readable labels and distinct tile colours, while warm paper
becomes neutral and dark enamel shades merge. These are accepted palette
adaptations, not evidence of native fidelity. Native compatibility smoke passed for the final identity, normal frame, About
and picker; broader state checks used the preceding logo-only build. See
[classic/README.md](classic/README.md) for exact hashes, captures and limits.
