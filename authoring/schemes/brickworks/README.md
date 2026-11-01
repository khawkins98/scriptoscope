# Brickworks

Glossy toy bricks with a crane, a continuous studded title bar and a green
baseplate. The concept is in [`concept/concept.jpg`](concept/concept.jpg).
Repeating plastic surfaces, studs and the crane remain procedural; the small
corner paint-over grid stays in `concept-pieces.mjs` because its palette roles
are shared by active and inactive window states.

Push buttons now repeat the complete stud band rather than carrying only two
studs on their fixed corners. `controls.mjs` uses the existing `cinf.tileSides`
flag: a 26px source with 9px fixed corners leaves an 8px repeat containing one
6px stud and its 2px gap. The 6px side thickness includes the full stud and top
edge. This works with short and long labels, pressed and disabled faces, and
the independent red default ring. No runtime special case or frame recipe
change is needed.

```sh
npm run author -- authoring/schemes/brickworks
npm run check:schemes
npm run capture:authoring -- authoring/schemes/brickworks
```

The committed web previews show the current studded button faces.
Real-Kaleidoscope capture conditions and build hashes are recorded in
[`classic/README.md`](classic/README.md).
