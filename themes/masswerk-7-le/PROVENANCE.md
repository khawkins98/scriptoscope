# mass:werk 7 Le — provenance

This bundle is a faithful port of **mass:werk 7 Le v. 1.1**, a freeware Kaleidoscope 2.x color scheme authored by Norbert Landsteiner (mass:werk).

## Author

**Norbert Landsteiner** — <info@masswerk.at> — <https://www.masswerk.at>

Published 2001/01/13 (v. 1.1, final). First published 2000/12/31 (v. 1.0).

## Source

- Upstream URL: <https://www.masswerk.at/schemes.php>
- Original archive: `masswerk7le.sit`
- Local extraction source: `.scratch/schemes/masswerk-7-le/scheme.r` (DeRez of the original `.ksc`)

## License

From the original `ReadMe-masswerk7Le` (preserved verbatim):

> This scheme is freeware and you can distribute as long as with this readme file.

We honor that by shipping this bundle with author attribution preserved in `meta.json` and the original readme cross-referenced here.

## Description (from the original readme)

> "mass:werk 7 Le" is a color scheme for Kaleidoscope 2.x. "mass:werk 7 Le" is based on "System 7" by Gregory D. Landweber and Arlo Rose. "mass:werk 7 Le" is meant to combine the looks and feels of Apple's System 7 and Mac OS 8/9. The scheme is a light version without any System 7 like icons as indicated by "Le".

## Why this is Aaron UI's bundled-default theme

Per the 2026-05-17 Kaleidoscope-runtime pivot ([LEARNINGS entry "Aaron UI is a Kaleidoscope-compatibility runtime, not a Platinum re-author"](../../LEARNINGS.md)), Aaron UI does not hand-author a first-party Platinum theme. Instead it ships this scheme as the bundled default — mass:werk 7 Le is Platinum-faithful, freeware-licensed, single-author provenance, and reachable upstream.

## Aaron UI bundle contents

| File | Purpose |
|---|---|
| `theme.json` | Schema-conformant theme bundle per [`docs/kaleidoscope-geometry-spec.md`](../../docs/kaleidoscope-geometry-spec.md) §7 |
| `meta.json` | Sidecar metadata fed to `scheme-extract --meta` during regeneration |
| `cicns/*.png` | Extracted chrome bitmaps (cicn resources) |
| `ppats/*.png` | Extracted tile patterns (ppat resources) |
| `PROVENANCE.md` | This file |

## Regenerating

```sh
node scripts/build-theme-bundles.mjs
```

(Requires `.scratch/schemes/masswerk-7-le/` populated with the upstream archive's DeRez output. The script reads the existing `extraction-manifest.json` from `demo/assets/themes/masswerk-7-le/`, copies PNGs into subdirs, runs the extractor's `buildThemeJson`, and validates against the schema.)
