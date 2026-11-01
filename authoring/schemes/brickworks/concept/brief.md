# Brickworks — concept brief

## 1. Art direction

A window assembled from generic toy bricks on a construction site. A yellow
lattice crane and dangling red brick rise from the upper-right block. A large
corner block, loose brick stack, green baseplate and wheel give the frame a
playful silhouette. No branding, printed studs or figures.

Plastic is flat, glossy and chunky: upper-left highlight, shaded right edge,
warm dark outline. Studs read as cylinders rather than embossed dots. Red,
yellow, blue and green share this material grammar; the body stays plain.

## 2. Chosen target

[`concept.jpg`](./concept.jpg), selected as `concept-2a`, is the composition
reference. Preserve the crane, loose stack, wheel corner, baseplate and staggered
side courses. Omit soft shadows and perspective; use crisp pixel silhouettes.
The saved prompt remains in this folder.

## 3. Build translation

[`frames.mjs`](../frames.mjs) owns current cells and title reservations;
[`palette.mjs`](../palette.mjs) owns material ramps. Fixed crane/corner art stays
separate from whole studded repeats. Side recipes carry staggered courses;
the bottom has its own baseplate rhythm and fixed ornaments.

Inspect narrow and wide widths instead of assuming the crane drops before the
title. Check repeat boundaries at gaps and keep stud spacing consistent across
frames, buttons, scrollbars and progress. Pressed/inactive states retain the
same readable forms.

## 4. Signature details the implementer must not lose

- Crane and dangling brick clearly separated from the bar.
- Lit stud cylinders and crisp interlocking seams.
- Loose lower-left stack and wheel at the opposite corner.
- Shared brick vocabulary across the entire control family.

Use the [workflow](../../../../docs/authoring-a-scheme.md#4-the-workflow) for
matched-scale, 8-bit and native review. Exact tested builds and states live in
[`classic/README.md`](../classic/README.md).
