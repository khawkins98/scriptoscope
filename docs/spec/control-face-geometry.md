# Solid control-face geometry

This document describes the source-backed solid-body and border model for
push/default and bevel faces. The subsequent [pattern/context and authored-color
model](control-pattern-context.md), delivered by #279, adds bounded full-color
`ppat` bodies and raw RGB16 background/text/emboss samples, including sampled RGB
under mask holes. Together these paths require usable explicit `cinf` metadata
and supported body/sample inputs; they do not establish complete control fidelity.
List headers, mode5 color-icon bodies, mono/device paths, original typography,
transfer and resource lookup remain explicit limits under #218/#221.

## Original call sites and rectangles

Offline kDEF 2.3.1 `kDEF0` disassembly:

- Push face `0x7572..0x7594` and bevel face `0x7770..0x7778` call `0x10fc0`.
  That wrapper sets body-fill true and enters `0x107fe`. The default-ring wrapper
  `0x107de` enters the same routine with body-fill false.
- `0x108a4..0x108b0` loads corner `c` and independent side thickness `s`.
- The solid path `0x10b72..0x10bb8` fills the union of two rectangles before
  drawing the border: `(c,s,W−2c,H−2s)` and `(s,c,W−2s,H−2c)`. When `c=s`,
  the second fill is redundant and skipped. Empty rectangles contribute nothing.
- Background RGB comes from the source `bgPixel` sample at `0x10904..0x1091a`,
  applied through `RGBBackColor` at `0x109b2..0x109b6`.
- Border order is TL, TR, top, BL, BR, bottom, left, right, through
  `0x10c18..0x10f82`. Each corner uses `c` in both dimensions. Bands have
  independent thickness `s`, so bands can overlap one another and corner blocks.
  Masked samples preserve earlier pixels; a transparent edge can reveal the body.
- `cinf` byte 2 false chooses the first middle source column/row
  (`0x10cf6`, `0x10e54`, `0x10ecc`, `0x10f44`). True repeats the full middle
  strip through `0xfeae`. Neither operation is generic whole-band stretching.

`composeControlBorder` implements this shared border path; the ring has no body,
while solid faces fill the two rectangles first. The general-purpose rectangular
`PixelBuffer.nineSlice` API remains unchanged for its other callers.

## Independent checks and remaining limits

`tests/rendering-options/face-bands.spec.mjs` uses hand-derived coordinates for
9×9/c4/s1 and 21×21/c7/s14 sources. It distinguishes square corners, transposed
body fill, first-strip versus repeat sampling, overlapping edge order, and
transparent holes inside/outside the body. Both push and bevel state selectors
are exercised in source and built runtimes. The shipped Animals/Monkey/Lisa
faces additionally retain all four authored corner blocks at native/12/20/32
heights. These requirements are narrower than a complete historical pixel match.

Body dispatch remains distinct: `0x109be` selects the mode5 background-cicn
case, which is still unsupported by the source-backed body path;
`0x10a6c..0x10b70` handles non5 pattern lookup/phase. The latter now has independent
asymmetric-tile, phase, inset-union and bounded clip checks; see
[the current pattern/context evidence and limits](control-pattern-context.md).
List headers share implementation in Scriptoscope, but their original call-site
equivalence has not been established; they retain legacy geometry and text policy.

A transparent decoded canvas pixel does not preserve hidden source RGB. The
loader retains raw background/text/emboss samples before that transport, but the
solid-body branch still requires an opaque decoded background anchor and uses
its decoded RGB. A masked background anchor therefore still retains the legacy
body path; retained raw background metadata alone does not fix that limitation.
Push/bevel foreground and emboss decisions do consume the source samples
at `0x10922..0x10990`; browser glyphs/metrics, alpha-over transfer and the declared
high-byte/display LUT remain compatibility policies. These narrower corrections
do not prove original device color, font rendering or complete masking behavior.

Selection is a separate boundary. Author-label anti-role rejection, named-role
preference, base inheritance and active/pressed/inactive fallback are declared
runtime compatibility policies. The original push dispatcher uses numeric IDs;
its existence does not prove our heuristic fallbacks. Actual selection tracing
must record those policy decisions, not certify them as historical truth.
