# Finite push/bevel border-size checks

`tests/rendering-options/border-boundaries.spec.mjs` executes one group per
source and runtime: all 18 canonical sources, source and built modules, one
cached load per group. It checks empty push faces in active/pressed/inactive
states and all twelve bevel combinations of small/normal, on/off and those
three states. It never sets pressed and disabled simultaneously. Existing
resolver fallbacks are observed modern policy, not an original selection oracle.
Default rings and typography are outside this claim. Every generated composition
supplies minWidth and height; omitted/default-dimension behavior remains OPEN.

## Inputs and size selection

The canonical archive/entry/fork pins come from `source-choices.json`. Actual
loader input, selected cicn/cinf occurrences, payload hashes, emitted key,
asset URL and completed band dependencies must join them. The Node converter's
RGBA hash is a bound input, not independent validation of that decoder. Hidden
RGB below alpha zero is normalized only for the canvas transport hash. No
source pixels or runtime assets are substituted.

Raw selected cinf bytes supply corner, side and repeat flag. A repeated band
consumes source size minus twice the corner; a nonrepeated band consumes one
column/row. For each axis, test deduplicated destination middle lengths
`0, 1, S−1, S, S+1, 2S+1` (discard negative lengths). Preserve unreachable
transitions explicitly. Empty public push/bevel width floors are currently
24/16 pixels; these are API policies, not historical minimum sizes. Include that
width anchor and positive height `max(1,2c+1)` so unreachable widths do not
silently eliminate vertical transitions. Cross the remaining finite axis sets.

Planning only: 270 option tuples yielded 159 cinf-backed candidates, 87 missing
cinf cases and 24 missing faces; 623 axis transitions were below public limits.
The estimated 960 compositions per runtime exclude 270 selection-only probes.
The threshold set begins at middle0: below-2c overlap is covered by the literal
short-height vectors (and incidental minimum-width anchors), not systematically
across corpus heights. Ring footprint offset is current standalone layout policy,
not historical geometry or a general base-chain claim.
Executed observations, not this estimate, report actual selected faces/counts.
The probes use minimum width/height1 solely to observe selection, without pixel
claims. Every requested tuple remains in the report.

## Independent coordinate decision

Pinned kDEF0 SHA256:
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.
The reverse per-pixel model imports no renderer, PixelBuffer helper or trace:

- Square source-clamped corners: TL `10c18–10c54`, TR `10c58–10cb2`,
  BL `10d50–10da6`, BR `10daa–10e0e`. Destination size does not halve corners.
- Forward order `10c18–10f82`: TL/TR/top/BL/BR/bottom/left/right. Search in
  reverse order for the last opaque source writer. Later transparent samples
  leave earlier writers intact, including overlapping corners.
- False repeat selects the first middle column/row at
  `10cf6/10e54/10ecc/10f44`. Original destination origins survive clipping.
- FEAE width-one expansion `ff3e–ffba` precedes height-one `ffba–1001c`.
  The other axis is sampled once (`ff98–ffac`, `fffc–10016`), so the model
  requires that source/destination axis lengths match; it never generalizes
  this to unrestricted two-dimensional sampling.
- Ordinary partial tails shrink source and destination together at
  `100a4–100f6`, with stepping at `10146–10176`. Modulo coordinates therefore
  retain phase through the final partial tile.

Literal model checks reuse the established 9×9 c4/s1 and 21×21 c7/s14 source
coordinates and 7×7 c3/s1 one-pixel branch. Additional hand-written vectors
exercise a height3 destination (bottom corner begins at−1) and a masked final
partial tile with an exclusive clip edge. Existing sampled-band public tests
separately establish the ordinary red versus sampled gray48 collision.

## Report and limitations

Each composition reports exact size, asserted opaque-border pixels, unassessed
body/mask-hole pixels, final-writer counts, output hash and completed paint
regions. No checked pixels are sampled or capped. Failure records retain the
mismatch total and first eight exact coordinates/source decisions/colors, plus
the output image. Passing artifacts contain no full pixel planes.

Only binary source alpha is admitted. Expanded bands require the loader's
bounded current-display sampling-equivalence record; otherwise those pixels
remain unknown. Missing/short cinf, unsafe source spans, missing faces and
legacy painter paths remain explicit. No inferred slice defaults replace
missing cinf. All-transparent/unassessed borders have no verified-pixel claim.
This is a conditional composition check against decoded inputs, not independent
palette, decoder, body, alpha-hole, provider, historical state-selection or
whole-output validation. The original port and destination-device conditions
remain unknown. Broader 15-family envelope closure and every ledger case remain
OPEN; these varying options are not assigned to unrelated exact ledger cases.
