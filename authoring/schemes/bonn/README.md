# Bonn

Bonn landmarks above a sandstone title bar, cherry blossoms at the left corner,
and a bridge over the Rhine below. The Minster, Rathaus, Post Tower, bough and
bridge are extracted from the selected concept; repeating canopy, masonry and
water stay in code.

- [Art direction and geometry](concept/brief.md)
- [Editable PNGs and reproducible extraction](sprites/README.md)
- [Native compatibility checks and exact build hashes](classic/README.md)

The landmark caps move with the title and disappear at narrow widths. Fixed
corners retain the bough and Post Tower. Custom 26px window medallions have
matching pressed masks; the bridge's transparent arch reveals the river.

```sh
npm run author -- authoring/schemes/bonn
npm run check:schemes
npm run capture:authoring -- authoring/schemes/bonn
```

This is an original, unofficial scheme with no connection to the City of Bonn
or the institutions depicted. Its shield is a stylised emblem inspired by the
city's arms. The buildings are concept-derived pixel art, not traced photographs.
