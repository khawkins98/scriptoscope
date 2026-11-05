# Scriptoscope Reference

An original reference based on the Scriptoscope site's maker mark and editorial
palette. Chamfered corners carry layered brass rails around charcoal enamel;
the ivory title plaque is recessed, with bevelled widgets and square controls.
The mark and chunky segmented progress use the six brand colours.
For a new scheme, follow the [authoring workflow](../../../docs/authoring-a-scheme.md);
this page locates the reference assets and its own review records.

```sh
npm run author -- authoring/schemes/scriptoscope --sheet --palette
npm run check:schemes
npm run dev
# /authoring-preview.html?scheme=/authoring/schemes/scriptoscope/scheme.rsrc
npm run capture:authoring -- authoring/schemes/scriptoscope
npm run capture:authoring -- authoring/schemes/scriptoscope --concept \
  --width 400 --height 204 --out preview-concept.png
```

- `scheme.mjs`: push/check controls, metadata and family assembly with duplicate-id checks.
- `palette.mjs`: display colours and important contrast pairs.
- `parts/frames.mjs`: named frame cells, measurements, painted states and pressed strips.
- Other `parts/` files: control families and native control-panel extras.
- `concept/`: design intent, selected generated concept and exact prompt.

[The concept brief](concept/brief.md) maps the defining silhouette, rail layers,
materials, spacing and deliberate adaptations. `preview-concept.png` matches the
concept's composition; `preview.png` and `preview-sizes.png` exercise the wider
control family and narrow/wide windows.

The logo follows the site's source geometry rather than the generated image's
approximation. Header and footer periods remain compact; growing cells never
stretch a corner or widget. The paper body uses `cinf` → `ppat 42`; ordinary
classic applications still own their content drawing.

Review the 1× composition and enlarged corners before accepting a change.
8-bit simulation loses some warm paper/near-black shading, so it supplements
visual review rather than proving native fidelity. Exact-build native checks
and their limits are recorded in [classic/README.md](classic/README.md).
