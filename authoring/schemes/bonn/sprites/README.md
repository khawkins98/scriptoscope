# Bonn concept sprites

These transparent PNGs contain pixels sampled from the original
[`concept.jpg`](../concept/concept.jpg), not newly drawn buildings or flowers.

| Asset | Source crop (x, y, width, height) | Native PNG |
| --- | --- | --- |
| Minster | 459, 27, 123, 234 | 41×78 |
| Rathaus | 618, 117, 162, 144 | 54×48 |
| Post Tower | 822, 66, 75, 195 | 25×65 |
| Cherry bough | 168, 165, 231, 96 | 77×32 |
| Rhine bridge | 438, 633, 231, 75 | 77×25 |

The source pixel grid is approximately 3×3 JPEG pixels per art pixel. Each
output pixel samples the center of that source cell. A shared adaptive
96-color palette for the first four assets consolidates JPEG noise without
substituting the scheme's palette. The bridge uses its own 32-color adaptive palette so adding it does
not change the four previously approved assets. All PNG alpha values are either 0 or 255.

Cleanup is limited to removing the background: traced outer polygons for
the buildings, removal of tan inactive-title-bar pixels behind the upper
Minster spire, and color separation of the pink petals / brown branch / dark
outline from the gray and teal backgrounds. No interior windows, roofs,
blossoms, branches or shading were repainted. Langer Eugen is not present in
the concept and is not added to these assets.

Reproduce from the original JPEG using a lossless PNG conversion:

```sh
sips -s format png authoring/schemes/bonn/concept/concept.jpg --out /tmp/bonn-concept.png
node authoring/schemes/bonn/concept/extract-assets.mjs /tmp/bonn-concept.png /tmp/bonn-assets/
```

The generated `*-6x.png` files are inspection previews only. The five named
1× PNGs are authoritative. The extraction script records crops, traced masks
and the palette algorithm. `skyline.mjs` reads the PNGs directly and fits each one
with a single uniform nearest-neighbor scale; its inactive treatment is a
deterministic grayscale conversion. It does not reconstruct architecture.

Original JPEG SHA256:
`00f078a92d7dff797519961cc5c27a0e7559e93d04b5740b53a935b2f3912c1e`.

The bridge retains its sampled cornices, stair-stepped voussoirs, arch edge
and plinths. Its teal water and white foam samples are transparent; the
frame paints river pixels behind that opening. No masonry is reconstructed.
The 77×25 source fits proportionally to 120×39 inside the 120×40 river cell.
