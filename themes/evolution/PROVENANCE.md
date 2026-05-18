# 1991 evolution

**Author:** SHIOCOP ([http://www.os.xaxon.ne.jp/~shiocop/hp/index.html](http://www.os.xaxon.ne.jp/~shiocop/hp/index.html))
**Year:** 1999
**Original Kaleidoscope scheme #:** 1991
**License:** Distributed as freeware via the original kaleidoscope.net Mac OS theming community circa 1999-2003.

## Sourcing

The original kaleidoscope.net site is no longer reachable. This bundle was ported from a copy preserved at:

- **Kaleidoscope Scheme Archive:** [kaleidoscope.hryjksn.com](https://kaleidoscope.hryjksn.com/) — a community-maintained archive of 3000+ Kaleidoscope schemes from the original community, lovingly preserved.
- **Source .sit:** [Wayback Machine snapshot](https://web.archive.org/web/20140226161241im_/http://www.kaleidoscope.net/schemes/schemes/1991.sit) of the original kaleidoscope.net download.

## Acknowledgements

Aaron UI gratefully acknowledges:
- **SHIOCOP** for creating this scheme.
- **[Hannes Jürgens (hryjksn)](https://kaleidoscope.hryjksn.com/)** for archiving the Kaleidoscope scheme community's work — an invaluable resource for porting and preservation.

## How the bundle was produced

1. Downloaded `1991.sit` from the Wayback Machine snapshot above.
2. Unpacked with `unar` (the StuffIt archive format).
3. The resource fork was read directly (`<file>/..namedfork/rsrc`) and decompiled to text via `DeRez`.
4. Run through `tools/scheme-extractor` to decode `cicn`, `ppat`, `cinf`, `wnd#` resources into PNGs + `theme.json`.

See `extraction-manifest.json` for the per-resource extraction record.

## License note

If you are the author of this scheme and would like it removed from this repository, please open an issue at the Aaron UI repository.
