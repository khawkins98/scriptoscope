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

Scriptoscope gratefully acknowledges:
- **SHIOCOP** for creating this scheme.
- **[Hannes Jürgens (hryjksn)](https://kaleidoscope.hryjksn.com/)** for archiving the Kaleidoscope scheme community's work — an invaluable resource for porting and preservation.

## How the bundle was produced

1. Downloaded the original Kaleidoscope archive (.sit) from the source cited above.
2. Committed the archive verbatim at `themes/<slug>/scheme.sit` — or, when the upstream .sit was no longer reachable, the unwrapped resource fork as `scheme.rsrc`. Authored `meta.json` + this `PROVENANCE.md` alongside it.
3. The runtime decodes the bundle in-browser via `loadKaleidoscopeScheme` (in `tools/theme-loader/`) on every load. Per-bundle PNG / theme.json derivatives are NOT committed — they are produced on-demand by `npm run build:themes` for local lint / diag work and are gitignored.


## License note

If you are the author of this scheme and would like it removed from this repository, please open an issue at the Scriptoscope repository.
