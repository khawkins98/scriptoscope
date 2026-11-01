# Kingfisher

A kingfisher on a branch over a frosted window, with a single ripple in the
water band below. The frame geometry and art direction are in
[`concept/brief.md`](concept/brief.md).

## Editable decorative art

The authoritative illustrations are transparent **1× PNGs** in `parts/sprites/`:

- `kingfisher-active.png` and `kingfisher-inactive.png`: 94×61 pixels;
- `ripple-active.png` and `ripple-inactive.png`: 71×9 pixels.

These replace the earlier ASCII grids without changing their pixels. Edit them
in a pixel editor at their native size, with alpha either 0 or 255. Preserve
the dimensions and the existing system-palette colours; turn antialiasing off.
The inactive images are independent sources, so check both states when editing.
`ornament.mjs` uses the existing PNG decoder, rejects partial alpha and requires
matching active/inactive dimensions.
`frames.mjs` positions and clips the bird and keeps the ripple centred; the
images carry no title swatches or window geometry.

The header is procedural because its growing cells must have identical
columns: a broad pale frosted field, one white upper reflection, and a narrow
lavender/blue lower bevel. It evokes the concept's material without claiming
to reproduce its spatial gradient or transparency.

```sh
npm run author -- authoring/schemes/kingfisher
npm run check:schemes
npm run capture:authoring -- authoring/schemes/kingfisher
```

`preview.png` and `preview-sizes.png` show the current web render. The
[`classic/`](classic/README.md) captures document the earlier build; the new
frosted header has not yet been recaptured in real Kaleidoscope.
