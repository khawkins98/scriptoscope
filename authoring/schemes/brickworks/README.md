# Brickworks

Glossy toy bricks with a crane, a studded title bar and a green baseplate.
The [concept brief](concept/brief.md) defines the art direction. Plastic
surfaces, studs and the crane are procedural; `concept-pieces.mjs` holds the
small corner sprite with shared active/inactive palette roles.

Button faces use `cinf.tileSides` to repeat a complete stud band. A 26px source
with 9px fixed corners leaves an 8px repeat: one 6px stud and its 2px gap.
Keep the full stud inside the 6px side thickness. Check short and long labels,
pressed/disabled states and the separate default ring when editing it.

```sh
npm run author -- authoring/schemes/brickworks
npm run check:schemes
npm run capture:authoring -- authoring/schemes/brickworks
```

`preview.png` and `preview-sizes.png` show the browser render.
[Native checks](classic/README.md) record capture conditions and build hashes.
