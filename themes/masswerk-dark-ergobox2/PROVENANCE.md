# mass:werk Dark ErgoBox 2 — provenance

This bundle is a faithful port of **mass:werk Dark ErgoBox 2**, a freeware Kaleidoscope 2.3 color scheme authored by Norbert Landsteiner (mass:werk).

## Author

**Norbert Landsteiner** — <info@masswerk.at> — <https://www.masswerk.at>

Authored 2002–2011. Version 2 (the first public release) published August 2011.

## Source

- Upstream URL: <https://www.masswerk.at/schemes.php>
- Original archive: `masswerk_dark_ergobox2.sit`
- Local extraction source: `.scratch/schemes/masswerk-dark-ergobox2/masswerk DarkErgoBox 2/scheme.r` (DeRez of the original `.ksc`)

## License

From the original `Dark ErgoBox 2 - Read Me` (preserved verbatim):

> Distribution: Freeware

We honor that by shipping this bundle with author attribution preserved in `meta.json` and the original readme cross-referenced here.

## Description (from the original readme)

> Yet another color scheme for Kaleidoscope 2.3. Another old scheme, now finally published. BE-like tabbed windows with a gentle blend of Mac OS and Rhapsody elements, CDE-like folders (with reversed tab). The scheme is specially made for high productivity and minimal eye-stress, hence the name "ErgoBox" for ergonomy.

## Why this is Aaron UI's Tier-2 loadable scheme

Dark ErgoBox 2 is the **proof-of-runtime** scheme for Phase 4: a stylistically distant alternative to the bundled-default 7 Le that exercises chrome paths 7 Le doesn't (BeOS-style projecting titlebar tab, dark palette, no collapsed-window states). If the runtime can load both 7 Le and ErgoBox 2 from one code path with the same rendering correctness, the format-as-contract design works.

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

(See sibling `themes/masswerk-7-le/PROVENANCE.md` for prerequisites.)
