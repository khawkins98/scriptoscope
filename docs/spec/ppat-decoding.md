# Indexed pixel-pattern decoding

This bounded decoder correction addresses [#255](https://github.com/khawkins98/scriptoscope/issues/255)
under #221/#218. It does not implement patterned control bodies or certify their
original placement, resource search chain or rendering phase.

## Independent sources

Apple's *Inside Macintosh: Imaging With QuickDraw* (1994), §4-103/104, describes
compiled `ppat` resources: offsets replace the in-memory PixMap/ColorTable
handles. `PixMap.pmTable` identifies the color table; contiguous placement after
pixel rows is not required by the decoder contract. Sections 4-58/59 describe
indexed full-color patterns and the separate treatment of unassigned colors.

- [Apple manual, preserved PDF](https://vintageapple.org/inside_r/pdf/Imaging_With_QuickDraw_1994.pdf)
- PDF SHA-256: `f8e079d02b57516900f4b45c1f09629ef734313a51c171029278c9d97f6b497a`

[Apple Technical Note QD13, “Principia Off-Screen Graphics Environments”](https://leopard-adc.pepas.com/technotes/qd/qd_13.html)
clarifies the table flags. Bit15 clear associates `ColorSpec.value` with its RGB;
bit15 set associates the record's array position with its RGB. Bit14 refers to an
external destination-window palette, using the value field and ignoring RGB.
Other flags are reserved; they do not redefine these two documented bits.

- Preserved HTML SHA-256: `493a6ce9e1080363441908b16ca104278f22a243c7247195294450036243db36`

No original engine code is executed or redistributed by these tests.

## Implemented boundary

For indexed patterns, `decodePpat` seeks the resource-relative `pmTable` offset,
checks that the header and declared entries fit, and selects colors according to
bit15. A bit14 table returns `null`: no destination palette is supplied to this
standalone decoder. Existing extraction accounting classifies this as skipped
unsupported data; stored RGB is not presented as a substitute palette result.

The implementation stays in `decoders/ppat.js`. The shared `indexToRgb` helper
and `cicn` decoder are unchanged. That helper's position-first behavior remains
an unverified boundary requiring separate resource-format evidence and fixtures.

Existing direct-color/type2 handling is unchanged and is not verified by this
indexed contract. A missing pixel value retains the existing black fallback;
original foreground/background interpolation, duplicate value semantics,
indexed-device quantization and dithering are not implemented or certified here.
The 16-to-8-bit channel reduction remains the existing high-byte policy.

## Executable evidence

[`ppat.test.mjs`](../../tools/theme-loader/ppat.test.mjs) builds small resources
with independently specified offsets and literal pixel/palette bytes. Expected
RGBA rows are written separately from the fixture data. The fixtures cover:

- 4bpp MSB-first nibbles and 8bpp bytes, with distracting row-padding values;
- a color table separated from the rows by an eight-byte gap;
- permuted and sparse pixel values with bit15 clear;
- device tables with repeated, irrelevant value fields and bit15 set;
- bit14 rejection with either setting of bit15;
- invalid table offsets and truncated ColorSpecs.

Six of these eight tests fail against pre-fix `85bbab34`; the sparse and device
fixtures already passed and preserve those supported cases. These are decoder
oracles, not screenshots generated from the renderer.

The raw resources in all 18 explicitly pinned forks were also decoded before and
after the change: all 218 ppat observations, dimensions, outcomes and RGBA hashes
were identical. This is regression evidence only. In particular, Crayon's 64×64
normal/inactive pattern 17 and pressed pattern -10238 have contiguous tables and
sequential values; these defects did not cause its missing patterned button
body. That separate composition work remains open under #218.
