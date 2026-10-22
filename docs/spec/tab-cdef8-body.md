# CDEF 8 tab body: full-raster bands and a separate center

Static investigation and bounded implementation, 2026-10-18. No original code executed or redistributed;
held `/tmp/scriptoscope-tab-slices` prototype untouched.

*Listing-level narrative (registers, frame offsets, instruction excerpts) for this document lives in [`engine/tab-cdef8-body.evidence.md`](engine/tab-cdef8-body.evidence.md) — spec writers and verifiers only.*

## Identity

Installer component CDEF 8, 15,902 bytes, SHA256
`4c9fecff46f6bfe2171961fa71e0831e5e2b85174f55531ad1a2fe895a82c680`.
An independent Python read of the pinned installer AppleDouble/resource map
matched this payload byte-for-byte with the existing local extraction.
Same installer/wrapper/raw-fork chain as kDEF/PACH inventory; raw-fork payload
42778, resource-map reference997278. This is installer-component identity, not
attribution of a running Appearance provider. All addresses below are payload
relative. The local disassembly path and toolchain are recorded in the evidence
appendix (spec writers and verifiers only).

## Actual caller and selection

- `0x7de` receives control, tab index, state, destination Rect. `0x8d2..0x8dc`
  adds3 to the state when the index equals the control value (selected tab).
- Small variant `(data+32)&7 == 1`: `0x8f6..0x8fe` passes `-9976+state` to
  painter `0x16e`, falling back to `-9960+state` at `0x914..0x91c` only on miss.
  Large variant uses `-9984+state`, fallback `-9968+state` (`0x930..0x956`).
- Resting draw caller `0xcc2..0xce0` maps hilite254/255 to state0, other values
  to1; per-tab enabled byte may force0 (`0xdb4..0xdc4`). Tracking toggles1/2 at
  `0x117a..0x11a8`. Thus small enabled rear1 selects-9975, front4 selects-9972.
  Existing small-then-large library fallback is a compatibility policy, not this
  original variant-specific fallback ladder.
- Caller starts a nominal16/21px vertical tab strip (`0x81c..0x82e`) and uses
  StringWidth+24 horizontally (`0x856..0x864`,`0x896..0x8a8`), plus20 if an icon
  is present. The helper ultimately rewrites Rect.bottom to top+source height
  (`0x614..0x61e`): do NOT turn16/21 into an invented minimum output height.

## Body helper 0x16e: full source coordinates and ordered bands

`0x23da` supplies the icon, `0x2f3c` obtains same-ID cinf via GetResource at2f62.
At `0x394..0x39e`, c=unsigned cinf[0], s=unsigned cinf[1]. Full source Rect S is
read from cicn PixMap.bounds at `0x420..0x42a`; no opaque-bounds scan.
For destination D, source height H, painter order is:

1. Source `[S.left,S.top,S.left+c,S.bottom]` copied1:1 to `(D.left,D.top)`;
   right `[S.right-c,S.top,S.right,S.bottom]` to `(D.right-c,D.top)`
   (`0x430..0x47e`, helper2228→227e).
2. Top band source x `[S.left+c,S.right-c]`, y `[S.top,S.top+s]`;
   if cinf[2]==0, right becomes left+1 (`0x4a2..0x4b4`). Destination x
   `[D.left+c,D.right-c]`, y `[D.top,D.top+s]`; draw helper1e48 with forward
   tiling flag1 (`0x484..0x4e2`).
3. Bottom band uses the same x rule and source y `[S.bottom-s,S.bottom]`.
   Destination y `[D.top+H-s,D.top+H]`, regardless of incoming D.bottom
   (`0x4e8..0x552`). It paints after top, including overlap when2*s>H.
4. Sample cinf background coordinates+6/+8 using19bc→1bce, set RGBBackColor
   (`0x558..0x566`). Interior is x `[D.left+c,D.right-c]`,
   y `[D.top+s,D.top+H-s]` (`0x56c..0x592`). On no pattern use EraseRect
   (`0x5fa..0x600`); otherwise cinf+4 pattern and mode0..4 origin through1888.
   This is one rectangular center, not push/bevel's unequal-inset union.
5. Restore pen position and set caller's output bottom=top+H (`0x60a..0x61e`).

The1e48→1e7c helper rejects empty source/destination rectangles. Width-one
source bands use per-row sampled color plus mask-return gating and horizontal
LineTo (`0x1f10..0x1f86`); general forward repeats clip the last fragment and
use CopyMask in the ordinary bitmap-port branch (`0x2046..0x20f8`). Fixed-end
helper227e uses CopyMask at2360, with an alternate region/CopyBits path for
custom port procedures at2310..234e. General transfer/device/custom-procedure
parity is not proved by browser alpha compositing. In the intended full-color,
ordinary masked raster subset, opaque pixels write and transparent pixels leave
previous paint intact; overlapping lower band must not erase a prior upper
opaque sample merely because its own mask bit is zero.

## Why the prior compositor failed the two concrete fixtures

- 1138 rear: full23x16,c10,s10, tilefalse; cropped width19 makes prior middle
negative. Original horizontal band repeats only column10. Its text sample at
(11,5) is semantic, not repeated center art. Top/bottom bands overlap y6..9;
center height16-20 is empty.
- 1990 rear: full32x16,c14,s14,tilefalse; cropped width28 makes prior middle
zero. Original repeats only column14, not text sample column15. Bands overlap
y2..13; center height16-28 is empty.
These explain both the current missing strips and the marker bars in the held
full-X-only prototype. No marker removal heuristic is needed or justified.

## Text is a separate source contract

`0x3b4..0x3c6` samples cinf+10/+12 into foreground; `0x3cc..0x3f8` sets absent
emboss sentinel only for coordinates(0,0), otherwise samples+14/+16. Caller
`0x9e0..0xa12` paints nonsentinel emboss(+1,+1), then foreground. This helper
DOES NOT perform push/bevel's background-equality emboss suppression. Therefore
reusing current controlColorSamples.embossDecision blindly would be incorrect.
The CDEF full-color palette helper2678..26ec has the same positional-match,
last-value-zero, reverse-search, entry-zero-fallback order as kDEF10702. Existing
raw background sample metadata can therefore support the solid center under the
declared display transform. Full tab emboss policy still needs its own rule.
The caller's font setup is at 0xa1c and data/style-controlled, not bh*0.42.
Changing font size or arbitrary output height is outside a first body fix.

## Bounded implementation and acceptance

A tab-body-specific full-raster painter targets the ordinary full-color
masked subset; it preserves existing public label width/font policy explicitly. Do
not claim complete original tab layout. Keep source owner with resolved art and
cinf. Begin with empty-label source-art/geometry requirements; any color policy
change must have independent raw sample/selected-owner checks. Do not route tabs
through generic push/bevel nine-band/union semantics.

Independent acceptance before visual deltas:
- hand-encoded asymmetric bands and actual23x16,c10/s10 and32x16,c14/s14 with an interior marker
  column distinct from the first band column; assert every destination pixel
  against literal rows, transparent end padding and overlapping band coverage;
  top/bottom overlap maps identical source coordinates, so pixel fixtures cannot
  distinguish their order. The ordering claim rests on source instructions;
- tile=true multi-column diagnostic band with a partial final repeat; alpha holes
  remain transparent; sides retain fullsourceheight; source marker not
  arbitrarily erased outside the documented center/band selection;
- a positive center fixture c2/s1/H9 with separate authored bg sample and glyph
  marker: fill center from bg, preserve all four bands, no stretched marker;
- actual1138/1990 rear empty-label proofs against independently pinned cicn/cinf
  bounds/bytes plus source-coordinate oracles, source+built; record the expected
  catalog binding separately from paint selection, which has no tab trace yet;
- review all affected goldens after these source checks. Keep original font,
  transfer/device, variant fallback, pattern phase and full-tab placement unknown
  where not covered. Existing two ledger mismatch claims can be reassessed only
  for the fixed full-source/band requirement, never whole-tab certification.

## First finite corpus scope

Generated metadata inspection of all18 themes finds tab art in14 themes; only
Crayon has a nonzero body-pattern request in the four supported active front/rear
small/large IDs. Pattern-backed positive centers retain the explicitly unverified
legacy compositor until tab-specific pattern phase is implemented. Missing cinf
also retains compatibility behavior. No per-theme branch chooses this policy.

The initial source/built fixture run against af7c434a failed all4 contracts: literal
rows expose stretched semantic columns, and actual1138/1990 middle strips lose
opaque pixels (expected alpha255, actual0). These are implementation negatives,
not original screenshot comparisons. The raw archive/cicn/cinf pins are in
`tests/decoder-fixtures/tab-body-source-pins.json`, obtained with independent
big-endian resource-map/header reads. Original binaries are not test fixtures.

## Background sample equivalence, limited to the full-color path

CDEF `0x19bc..0x19e6` calls `0x1bce` and sets RGBBackColor (`AA15`)
unconditionally. The sampler computes the mask bit separately, but its color
path reads local x/y, indexed row bytes and packed 1/2/4/8-bit pixels
(`0x1cb0..0x1d6c`), then calls `0x2678` (`0x1d70..0x1d80`). The mask is
returned only at `0x1d8a`; it does not suppress the background RGB assignment.
The palette branches match kDEF `0x10702`: positional value match at `0x269a`,
last-entry value-zero shortcut at `0x26aa`, reverse search at `0x26b4..0x26ca`,
and entry-zero fallback at `0x26cc..0x26d0`. Neither samples through ctFlags.
Thus the existing raw background sample metadata supports this specific color
path, including RGB under a mask hole. The runtime consumes its declared display
RGB; it does not apply the display transform twice. A masked-background fixture
checks that transport boundary. It does not independently prove the loader or
historical device conversion. Mono sampling, device palette, custom port
procedures and browser/original transfer equivalence remain outside this claim.

Positive centers require an explicit raw bodyRequest.resourceId of zero. Missing
raw requests cannot be inferred from absent catalog links and retain the legacy
compositor. Given an explicit zero request, manifests lacking usable sample
metadata may use an opaque, in-bounds background sample. A transparent canvas sample is unknown because premultiplying
transport loses its RGB. Missing/unsafe metadata retains the old compositor.
The source-model helper also declines invalid slice dimensions rather than
claiming original behavior for malformed resources.

## Exact labeled acceptance

The same pinned 1138/1990 inputs also exercise `{label: 'AgjpQy', selected:
false}`. Every output pixel outside the current browser glyph mask is compared
to its independently determined full-source end/first-column coordinate. The
mask only excludes the separate text layer; it does not synthesize body pixels
or establish the historical font. Whole-body empty-label and literal diagnostic
fixtures cover the area under that excluded text layer separately. The resulting
requirement is middle-strip/source-coordinate retention, not whole-tab fidelity.

## Corpus rule table (2026-10-21)

`tests/rendering-options/tab-header-rules.mjs` restates the selection and body rules
above as a pure table. Its Node test and source/built spec check every archive's
public `composeTab` rows (`selected` false/true, empty label) against them. The
expectations come from each archive's own resource map: ids, raw cinf bytes, and the
shared decoder's rasters and raw background samples. This checks the runtime against
the decode, not against original output. These additions were re-read in the
pinned listing (CDEF 8 sha256 `4c9fecff…`):

- Selection (0x7de, 0x8d2–0x956, 0xcc2–0xce0): state 0 for hilite 254/255 or a zero per-tab enabled byte (0xdb4–0xdc4), else 1; tracking toggles 1 and 2 (0x117a–0x11a8); +3 when the tab index equals the control value; the small variant draws -9976+state and the large variant -9984+state.
- Fallback (0x16e, 0x914, 0x950): the painter returns false only when its icon is NULL (0x18c–0x194), and only then does the caller probe -9960+state (small) or -9968+state (large); a found icon without same-id cinf returns true and draws nothing (0x38e to 0x622).
- Body (0x16e, 0x394–0x61e): c = cinf[0] is horizontal and s = cinf[1] vertical. Full-height c-column ends are drawn first (0x430–0x47e). Then come the top and bottom s-row bands over destination x [c, W−c), tiled forward from source x [c, w−c), or from the single column c when cinf[2] is zero (0x484–0x552). Last, the centre [c, W−c)×[s, H−s) is erased in the raw background sample when cinf+4 is zero (0x558–0x600). The output height is the source height (0x614–0x61e).
- Fallback colours (0x1ba–0x376): helper 0x263a is GetResource('clut'). States 0–4 of both fallback ladders (-9968..-9964, -9960..-9956; -9963..-9961 and -9955 are not recoloured) get icon colour-table entries from clut -14336 (ids -9964/-9967/-9956/-9959) or clut -14335 (-9965/-9968/-9957/-9960). The pressed ids -9966/-9958 also sample two colours from cicn -10238 at cinf -10238 (or cinf 0) points through 0x1bce. Before GetCIcon, 0x16e makes the Gestalt('Copl') file current (0x198–0x1b8). The 2.3.1 control-panel fork (installer-component identity, same chain as CDEF 8) ships cicn and cinf for exactly those ten ids plus clut -14336/-14335; all 18 archives also ship both cluts. Which file and which clut copy answer at draw time is not established.
- Centre fill (0x5fa–0x600) is trap A8B2, EraseRoundRect with zero oval size, painting the sampled RGBBackColor; earlier sections call it EraseRect, which is the same rectangle.

The public API maps to small variant, hilite 0, enabled, not tracking. That is modern
policy, so the rows reach only state 1 (-9975) and state 4 (-9972). States 0, 2, 3 and
5, the large variant and the -9960/-9968 fallback stay unexercised. Findings:

- All 14 archives with tab art draw the predicted id with every rule-fixed pixel equal
  to the 0x16e model at the runtime's width. Crayon-os requests ppat 17 for its
  centre (cinf+4); the phase is not decoded, so 1,664 centre pixels are unasserted,
  and the runtime keeps its legacy path there. The other 13 take the source-band path.
- The runtime retries the large id after a small miss (-9975 then -9983). The decode
  probes -9959. Only the four archives without tab art (black-platinum, platinum-8,
  slimes, system7-nostalgia-silver) reach a second probe. Under the declared
  archive-fork-only chain both sides find nothing, and the runtime returns null.
  Under a chain that includes the Gestalt('Copl') file, the decode would find the
  control-panel fallback (-9959/-9956) and draw a recoloured tab. So the runtime's
  null there is a probable divergence from the original, not agreement.
- Width-one bands use the sampled-line path (0x1f10–0x1f86). `composeTabBody` copies
  raster colours without consulting `samplingEquivalence`. Every corpus tab face has
  status `equivalent`, so no row is affected; a face with `different` would be.
- animals ships cicn -9984 without a cinf. The decode would draw nothing for it; the
  runtime's legacy path would draw. No public row reaches it.
- Rows that cannot discriminate (identical state art) are pinned in the spec: 1990,
  apple-lisa, windows-31 and windows-95 in both rows, the apple-platinum-2 rear and the
  beos-r503 front. Width (StringWidth+24, 0x856–0x8a8) and tab panes (-9977/-9969,
  -9978/-9970, which the runtime does not draw) are not covered.
