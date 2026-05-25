# System 7 Nostalgia Silver — provenance

A real, third-party **Kaleidoscope** scheme: *System 7 Nostalgia Silver* by **mollusc**
(15 December 1997), from the Kaleidoscope Shack (`oz.net/~mollusc`). A silver/gray
System-7-nostalgia appearance, very Platinum-adjacent (System 7 pinstripe title bar,
the same close-left / collapse+zoom-right widget layout).

Extracted from its binary resource fork (`scheme.rsrc`, unpacked from
`system7nostalgiasilver.sit`) by `scripts/extract-scheme.mjs`. The `.sit` was retrieved
from the Internet Archive (the original kaleidoscope.net is long gone):
`https://web.archive.org/web/20140226134043/http://www.kaleidoscope.net/schemes/schemes/system7nostalgiasilver.sit`

## Why it's here

Added as a **reference theme** — a real, rich scheme (171 chrome elements) whose
geometry sits close to Platinum. The author's own rendering is preserved at
`demo/assets/references/system7-nostalgia-silver.png` (from the Kaleidoscope archive,
kaleidoscope.hryjksn.com) as the trustworthy visual reference.

## NOT a window-geometry base (the hoped-for use didn't pan out)

It was hoped this scheme would carry complete window geometry to build Platinum windows
from. It does **not**: its `scheme.rsrc` has `cicn`/`ppat`/`clut`/`TMPL`/`actb`/`Colr`
but **no `wnd#` and no `cinf`** — like platinum-8, it's a look-only scheme that rides
the default WDEF for window layout, so it extracts to `windowTypes: 0`. Its windows in
the demo are therefore drawn by the base layer (`apple-platinum-replica`). The
Platinum-style window *geometry* already lives in that replica (from the WDEF-125
decode); these look-only schemes don't add to it.

## License

Freeware Kaleidoscope scheme (Kaleidoscope Shack distribution). Author: mollusc
(mollusc@oz.net), 1997. Redistributed here with attribution for a preservation project.
