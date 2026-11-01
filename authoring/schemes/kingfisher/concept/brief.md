# Kingfisher — concept brief

## 1. Art direction

A kingfisher perched on a branch above frosted glass. The bird is the signature;
the rest stays calm: pale glass, one teal accent, an olive branch and still water
below. Upper-left light describes the rims and reflections. Preserve broad glass
reflections and depth rather than reducing the material to a flat grey panel.

## 2. Chosen target

[`concept.jpg`](./concept.jpg), with its saved prompt in this folder, is the
composition reference. Preserve the bird's pose, orange breast, white cheek,
strong beak and connection to the branch. The branch forms the top rim; water,
a central ripple and a pebble corner give the window a lower silhouette.

## 3. Build translation

The current geometry is in [`parts/frames.mjs`](../parts/frames.mjs), colours in
[`palette.mjs`](../palette.mjs), and editable illustrations in
[`parts/sprites/`](../parts/sprites/). Those sources own exact dimensions and
colour values. Repeats and placement remain in code; imported PNGs have binary
alpha and paired state sizes.

Reserve fixed cells for bird and corner art, keep glass repeats clear of the
illustration, and measure title room on the expanded frame. Review narrow/wide
windows, inactive glass and pressed widgets. Teal unifies glyphs, selected states,
water and control accents; live content stays quiet.

## 4. Signature details the implementer must not lose

- Bird above the bar, visibly perched on the branch rather than pasted inside it.
- Branch continuing into the frame's upper rim.
- Frosted material with a clear outline and restrained reflections.
- Water, ripple and pebble vocabulary shared with the controls.

Use the matched-width concept workflow from the
[guide](../../../../docs/authoring-a-scheme.md#4-the-workflow). Current native
hashes, captures and tested states live in [`classic/README.md`](../classic/README.md).
