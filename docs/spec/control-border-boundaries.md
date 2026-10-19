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

## Border-only report and limitations

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
The border-only result is a conditional composition check against decoded
inputs, not independent palette, decoder, body, alpha-hole, provider, historical
state-selection or whole-output validation. The narrowly admitted solid subset
below additionally checks declared modern body/initial pixels. The original port and destination-device conditions
remain unknown. Broader 15-family envelope closure and every ledger case remain
OPEN; these varying options are not assigned to unrelated exact ledger cases.


## Conditional solid-body full-face subset

The same groups and sizes additionally check the full **face rectangle only**
when complete selected-fork input has no matching ppat, current same-owner
lookup explicitly reports `same-face-owner-pattern-unavailable`, usable raw
background samples are bound to the actual cicn/cinf, and all visible border
sampling is supported. Mode5, present/ambiguous/undecodable patterns, missing cinf,
invalid samples and legacy painting remain outside this claim. A same-owner
modern NULL is a **declared condition**, not an observed original GetResource
result; see [cinf lookup contract](cinf-lookup-contract.md).

Original background sampling at `10904–1091a` reads cinf y+6/x+8, and
`109b2–109b6` sets RGBBackColor without using the returned mask. Under the
pattern-NULL branch `10a96–10a9a → 10b72`, the two half-open rectangles are
`[c,s,W−c,H−s)` and `[s,c,W−s,H−c)` (`10b72–10bb8`), with empty extents skipped.
The independent expected pixel is last opaque border writer, otherwise raw
sampled background inside their union, otherwise explicitly initialized modern
transparent RGBA. Raster bgPixel alpha/RGB never substitutes for raw sampler
RGB16 and its once-realized current display RGB. Existing literal masked and
opaque palette-collision inputs independently anchor the complete 29×9 rows.

Each full-face case binds the actual missing-pattern admission step, owner/ID,
raw request and anchor, raw RGB16/display tuple, and completed themed outcome.
The existing trace does not separately record non-mode5 solid pixel writes;
these are verified by the independent output comparison, not invented trace
occupancy. Exact full-face context/clip and empty-label/defaultfalse conditions
remain enforced; the reserved ring outset is not part of the pixel claim.

Preparation predicts 146 tuples / 670 full-face compositions, adding 24,786
union pixels and 1,152 declared-initial pixels to 163,480 opaque-border pixels:
189,418 full-face pixels per runtime. The other 13 pattern-present tuples /
290 compositions retain their border-only coverage and 1,009,232 unassessed
pixels. The 87 missing-cinf tuples remain unknown. Actual execution reports
full-face versus border-only cases and body/border/initial counts separately.
No original destination transparency, mask truth, device colors, provider order,
whole-control fidelity or ledger closure follows from this conditional result.

## Separately declared known-origin pattern subset

The existing unknown-origin invocations remain unchanged and border-only.
Within the same groups, 13 pattern-present tuples receive one additional
invocation per size, with control origin D=(13,17), port origin (0,0), known
pattern offset R=(−3,5), and the finite face rectangle as clip. This adds 290
compositions per runtime, not a mode cross-product. Expected totals are 960
full-face cases (670 solid plus 290 known-pattern) alongside the retained 290
unknown-origin border-only cases; the latter still have 1,009,232 unassessed
pixels. No old invocation gains an inferred known origin.

For the pinned kDEF source, `10ab0–10af6` selects P from the **original face
rectangle**: mode0 (and non5 modes6–255) uses (0,0); modes1–4 use TL, TR, BL,
BR with exclusive right/bottom edges. `10afa–10b56` fills both transposed inset
rectangles with the same P. `f956–f962` establishes O−P, `f980–f9a8` translates
clip/destination by −P, and `f9b2 → f7cc`, `f858–f85e` reaches full-color fill.
The independent sample is floorMod(D+q−P+R,tileSize). Clipping never restarts
phase; list-header bottom+1 is not a control rule. Existing asymmetric 4×2
literal rows anchor all five modes, including negative coordinates/offset and
clipping, independently of production phase helpers or diagnostic phase fields.

The eight actual ppat occurrences are Animals −9567/−12239 (32×16,4-bit),
Lisa −10173 (8×8,1-bit), and Crayon17/−10238/−8206/−10172/−10173 (64×64,
4/8-bit). Ten tuples use mode0; three use mode1. Admission requires a unique
raw matching occurrence, actual selected same-owner ID/key/load/payload hash,
successful conversion, exact decoded-plane hash, opaque finite tile, supported
binary/sampled border, declared context and completed themed composition.
Tiles are cached once per occurrence per source/built pass. Present-but-
undecoded, ambiguous or nonopaque inputs never become NULL.

The independent expected pixel is last opaque border writer, otherwise pattern
inside the inset union, otherwise explicitly initialized modern transparent
RGBA. The added invocations predict 1,218,718 assessed face pixels per runtime:
209,486 border, 1,007,072 patterned union and 2,160 initialized-transparent.
Passing receipts retain counts/hashes and shared pattern identities rather than
full planes. Actual pattern selection and completed composition are observed;
there is no separate non-mode5 pattern occupancy/write event in the trace.
Full pixel agreement supplies the output check, not a fabricated trace event.
Decoded art and the default `mac-1.8-to-2.2-high-byte` realization are conditional
inputs, not independent decoder, original provider/cache/device/palette or
original destination/mask proof. Missing-cinf cases, broader fidelity and ledger
closure remain OPEN.
