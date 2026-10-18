# Solid control-face geometry

The source-backed path currently covers push/default and bevel faces with explicit
`cinf` slice metadata, no `bgPattern`, and an in-bounds opaque `bgAnchor` sample.
It does not claim complete control fidelity. Pattern-backed faces (including
Crayon OS), list headers, missing/transparent sample metadata, and text sizing,
color and emboss policies remain explicit limitations under #218/#221.

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

Pattern paths differ: `0x109be` selects the background-cicn case and
`0x10a6c..0x10b70` handles pattern lookup/phase. Their existing approximation is
retained pending independent pattern requirements. List headers share code in
Scriptoscope, but their original call-site equivalence has not been established;
they explicitly retain legacy geometry. Missing/transparent background samples
also retain that path because decoded transparent pixels do not preserve source
RGB. Text rendering remains a runtime policy: the original does read text and
emboss samples at `0x10922..0x10990`; our contrast heuristic is not that algorithm.

Selection is a separate boundary. Author-label anti-role rejection, named-role
preference, base inheritance and active/pressed/inactive fallback are declared
runtime compatibility policies. The original push dispatcher uses numeric IDs;
its existence does not prove our heuristic fallbacks. Actual selection tracing
must record those policy decisions, not certify them as historical truth.
