# `qd.blit` — kDEF blit primitives: tile, scale, corner, cinf body + border

*Behavioural spec, [TEMPLATE](TEMPLATE.md) shape. Split out of
[`kdef231-reference.md`](../kdef231-reference.md) §1.5 / §3.6 / §5 / §5.1 and
[`kdef231-recipe-walk.md`](../kdef231-recipe-walk.md) Q2 / Q5 on 2026-10-21
(v2 lane L2). This is moved prose, not a new decode: every statement below was
already in those documents and keeps their address citations. It has **not**
yet had an independent verifier pass in the v2 sense; the source sections were
reviewed under PR #373 (lanes/H). Listing provenance:
`qd-primitives.evidence.md` (spec writers and verifiers only).*

---

## 1. Unit id and scope

| field | value |
|---|---|
| unit id | `qd.blit` (tile, scale, corner 1:1) and `qd.cinfFrame` (cinf body + border engine) |
| family | shared QuickDraw-level primitives used by the window recipe walk and the control faces |
| binary | Kaleidoscope 2.3.1 `kDEF 0`, 107,726 B, SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` ([inventory](../kdef-binary-inventory.md)) |
| cited range | tile `0xfeae..0x10262` (fast paths `0xff3e..0x10018`); scale `0x10320..0x10402`; corner `0x102d0`; cinf body + border `0x107fe..0x10f82`; wrappers `0x10fc0`, `0x107de`, `0x10fe0`, `0x107a4`; GetPixel `0xfc5c` |
| callers cited | window draw loop `0x572e` (tile at `0x59e8`, scale at `0x59ba`); rect-list widget draw `0x6062`; push face `0x7572..0x7594`, bevel `0x7770..0x7778` (via `0x10fc0`); default ring (via `0x107de`) |
| out of scope | the part-code classifier and width distribution ([compositor-spec](../compositor-spec.md)); resource selection ladders (family specs); the second direction-byte consumer `0x6390 → 0x11452` (§6) |

## 2. Inputs

**Rect convention.** A Mac `Rect` is `{top, left, bottom, right}` (Inside
Macintosh: QuickDraw). Width = right − left, height = bottom − top. All rects
below are in that form.

### Tile blit (`0xfeae`)

Five arguments, in call order:

| input | meaning |
|---|---|
| `source` | the chrome colour icon (pixels + mask) the cell is copied from |
| `srcRect` | the template cell: the source sub-rect for this recipe segment |
| `dstRect` | the placed cell in the window |
| `direction` | anchor byte: `1` = forward, `0` = reverse. The window caller passes `0` for part codes 11 and 14 and `1` for every other tiled code (`0x59c8..0x59da`) |
| `altSource` | a long passed through from the caller; an alternate source pixmap (`0x1005c`). Its use is not decoded (§6) |

Environment inputs: whether the current port has custom bottleneck procedures
(`grafProcs` non-nil), and the port's clip region.

### Scale blit (`0x10320`)

`source`, `srcRect`, `dstRect`.

### Corner 1:1 (`0x102d0`)

`source`, `srcRect`, destination origin `(dstX, dstY)`.

### cinf body + border (`0x107fe`)

| input | meaning |
|---|---|
| `id` | the resource id; used for both the cicn and the cinf |
| `dstRect` | the face rect `D`, width `W`, height `H` |
| `bodyFill` | whether to paint the body. True from the face wrapper `0x10fc0` (push face, bevel); false from the ring wrapper `0x107de` |
| outputs `textRGB`, `embossRGB` | colours sampled from the cicn and returned to the caller |

cinf header fields (TMPL 129 names; byte offsets are the on-disk record, see
[cinf-lookup-contract](../cinf-lookup-contract.md)): `c` = Corner Size,
`s` = Side Thickness, `tile` = Tile Sides, `mode` = Pattern Anchor,
`backgroundId` = Background Pattern ID (signed), and the background / text /
emboss sample pixels.

## 3. Outputs

### Tile blit

A sequence of per-tile transfers into `dstRect`, one source-sized tile per step
(§4 rows T1–T7). Draws nothing for a degenerate rect (`0x1027a`).

Per-tile transfer (`0x1010e` / `0x101fe`):

- port `grafProcs` non-nil → **CopyBits** (`$A8EC`) `srcCopy`, no mask. This is
  opaque: transparent source pixels overwrite what is underneath;
- otherwise → **CopyMask** (`$A817`): masked-out source pixels leave the
  destination unchanged.

### Scale blit

Exactly one transfer, `srcRect → dstRect`, so the source is scaled when the
rects differ in size: CopyBits (`$A8EC`, `0x103ea`) or CopyMask (`$A817`,
`0x10402`). The scale blit also calls RGBForeColor (`0xf30a`). Used for window
part code 18 (`0x59ba`) and for every rect-list widget draw (`0x6062`).

### Corner 1:1

Offsets `srcRect` by `(dstX, dstY)` minus its own top-left and calls the scale
blit, so the corner is placed at 1:1 size.

### Wrappers

| wrapper | behaviour | source |
|---|---|---|
| face | `bodyFill = true`, forwards to the cinf body + border engine; used by push face (`0x7594`) and bevel (`0x7778`) | `0x10fc0` |
| ring | `bodyFill = false`, same engine | `0x107de` |
| window 9-slice | loads the cicn (`0x10472`) and cinf (`0x116f8`) itself, then slices; its two extra arguments are not decoded here | `0x10fe0` |
| default-button ring blit | the ring 9-slice, its own wrapper over the slice engine | `0x107a4` |

### cinf body + border

Resource requests, in order:

1. cinf `id` (GetResource `$A9A0`, not Get1Resource, after restoring the
   caller's resource file, `0x10860..0x10878`). On NULL, **one** retry: cinf 0
   when `bodyFill` is true, cinf 1 when false (`0x10880..0x10898`). On a second
   NULL the whole body + border stage is skipped (`0x1089a → 0x10fa8`); there
   is no further retry and no synthesised default.
2. the body resource, only when `bodyFill` (table B below): a **cicn** when
   `mode == 5`, otherwise a **ppat**, at `backgroundId` in both cases. A zero
   `backgroundId` is still requested (no special case). On NULL the body is
   erased with the sampled background instead; the request is not retried.

Draw order: body (if any), then border TL, TR, top, BL, BR, bottom, left,
right (`0x10c18..0x10f82`).

Sampled colours: background RGB from the background sample pixel
(`0x10904..0x1091a`, applied by RGBBackColor `0x109b2..0x109b6`); text and
emboss RGB from their sample pixels (`0x10922..0x10990`). An emboss coordinate
of `(0,0)` means absent (`0x1093e..0x10954`). Samples are read by GetPixel
`0xfc5c`: it handles 1/2/4/8-bit pixmaps and resolves the colour index through
the colour table (`0x10702`).

## 4. Decision tables

### Tile blit

| # | condition | behaviour | source |
|---|---|---|---|
| T1 | source width 1, dst width > 1 | fast path, before `direction` is read: for each source row (rows map 1:1), sample the source pixel; where the sample is nonzero, set it as the foreground colour and draw a line across the dst width | `0xff3e..0xffb6`; sampler `0xf9f6` |
| T2 | source height 1, dst height > 1 (and T1 not taken) | fast path: the same, one source column per dst column, lines down the dst height | `0xffba..0x10018` |
| T3 | otherwise | general path; tile size = source width × source height | `0x10036..0x10042` |
| T4 | general path, step axis | `srcH != dstH` → step vertically by `srcH`; else step horizontally by `srcW`. The byte never selects the axis | `0x10146`, `0x10236` |
| T5 | `direction == 1` | first tile at dst top-left; the final partial tile at the **far** end keeps the source's leading columns/rows (trims source right/bottom); stop when `left >= dst.right` or `top >= dst.bottom` | `0x10074`, `0x10088..0x10098`, `0x100a0..0x100f6`, `0x10162..0x10176` |
| T6 | `direction == 0` | first tile at dst bottom-right; steps subtract; the partial tile at the **near** end keeps the source's trailing columns/rows (trims source left/top); stop when `right <= dst.left` or `bottom <= dst.top` | `0x1018a..0x1019a`, `0x1019e..0x101fa`, `0x10252..0x10262` |
| T7 | forward branch only | each tile is first culled against the bounding box of the port's clip region. The listing shows only the cull; that it changes no pixels is an inference from Toolbox clipping semantics | `0x100fa..0x1010c`, bbox `0xff06..0xff12` |

The window caller fixes the cross axis: on top/bottom sides the placed cell's
height equals the source's, on left/right sides its width does
(`0x5356`, `0x539c..0x53a6`, `0x5404..0x540c`, `0x5470..0x547c`,
`0x54da..0x54e6`). So on a window side T4 always steps along the side's run,
and T1/T2 fire only for a source 1 px along the run. The one exception: a run
exactly `srcH` long, where both branches draw one identical full copy.

### Window caller: which blit

| # | part code | blit | direction | source |
|---|---|---|---|---|
| W1 | 18 | scale | — | `0x59ba` |
| W2 | 11, 14 | tile | 0 (reverse) | `0x59c8..0x59da`, `0x59e8` |
| W3 | every other drawn code | tile | 1 (forward) | same |

### cinf body (`bodyFill` true)

| # | condition | behaviour | source |
|---|---|---|---|
| B0 | `bodyFill` false | skip body; border continues | `0x109aa..0x109ae → 0x10bc0` |
| B1 | `mode == 5` | request cicn `backgroundId` | `0x109be`, `0x109c8..0x109d0`; GetCIcon `0x10698` |
| B2 | B1 found | copy the icon (source = its bitmap bounds) into `D` inset by `s` on all four sides, then dispose it. Not a pattern fill and not the inset-cross union | `0x109da..0x10a1a` |
| B3 | B1 absent | erase the two inset rects (§5) with the sampled background | `0x109d8 → 0x10a1e..0x10a66` |
| B4 | `mode != 5` | request ppat `backgroundId` (cached or uncached loader, chosen by a kDEF flag) | `0x109c4 → 0x10a6c`; GetPixPat `0xef24`, `0x10460` |
| B5 | B4 found | fill the two inset rects with the pattern at phase P (table P) | `0x10a96..0x10b5a`, fill helper `0xf930` |
| B6 | B4 absent | erase the two inset rects with the sampled background | `0x10a9a → 0x10b72..0x10bb8` |

### Pattern phase P (B5 only)

| # | `mode` | phase `(x, y)` | source |
|---|---|---|---|
| P1 | 1 | `(D.left, D.top)` | `0x10ac8` |
| P2 | 2 | `(D.right, D.top)` | `0x10ad2` |
| P3 | 3 | `(D.left, D.bottom)` | `0x10adc` |
| P4 | 4 | `(D.right, D.bottom)` | `0x10ae8` |
| P5 | 0 or 6–255 | `(0, 0)` | `0x10af4` |

### Border bands

| # | condition | behaviour | source |
|---|---|---|---|
| E1 | every corner | a `c × c` block, square | `0x108a4..0x108b0`, `0x10c18..0x10f82` |
| E2 | every edge band | thickness `s`, independent of `c`; bands may overlap each other and the corner blocks; masked pixels preserve what was drawn earlier, so a transparent edge can reveal the body | `0x10c18..0x10f82` |
| E3 | `tile == 0` | the edge uses the **first** middle source column/row | `0x10cf0`/`0x10cf6`, `0x10e4e`/`0x10e54`, `0x10ec6`/`0x10ecc`, `0x10f3e`/`0x10f44` |
| E4 | `tile != 0` | the full middle strip is repeated through the tile blit | same branches → `0xfeae` |

Neither E3 nor E4 is whole-band stretching. The additional `tile` test at
`0x10bc6` precedes corner painting and is not a fifth edge.

## 5. Geometry

**Tile index formula.** For a cell with source length `sw` along the run and
dst length `dw`, dst index `k ∈ [0, dw)` reads source offset

- forward (`direction == 1`): `k % sw`
- reverse (`direction == 0`): `sw − 1 − ((dw − 1 − k) % sw)`

The two coincide when `dw` is a multiple of `sw`. A reverse cell shorter than
its source shows the source's last `dw` pixels.

**Body inset rects** (relative to `D`'s top-left, as `(x, y, w, h)`):
`R1 = (c, s, W − 2c, H − 2s)` and `R2 = (s, c, W − 2s, H − 2c)`. `R2` is
skipped when `c == s`. Empty rects contribute nothing (`0x10b72..0x10bb8`;
the erase is EraseRoundRect with both oval sizes zero).

## 6. Not decoded / unknown; corpus impact

Open questions (implementers stop here and file a spec question):

1. `altSource` (the tile blit's fifth argument, `0x1005c`): when it is used
   instead of `source`.
2. The degenerate-rect guard (`0x1027a`): its exact condition.
3. Fast paths T1/T2 draw with RGBForeColor + LineTo, and only where the sampler
   `0xf9f6` returns nonzero. What "nonzero" means (mask bit or colour index) and
   whether those pixels equal the general path's CopyMask output are not
   established.
4. Scale blit: what selects CopyBits versus CopyMask, and what colour the
   RGBForeColor call (`0xf30a`) sets.
5. CopyBits vs CopyMask interaction with sides drawn earlier, and device colour.
6. Rect-inset reconciliation: the reference's rect-layout note records an inset
   of `c` horizontally and `s` vertically at `0x10a28..0x10a34`, while B2
   records the mode-5 destination inset by `s` on all four sides
   (`0x109da..0x10a1a`). A verifier must reconcile these before an
   implementation depends on either.
7. Pattern fill helper `0xf930 → 0xf7cc`: it adjusts port origin and rect
   coordinates, then has a FillCRect path (`0xf85e`) and a FillRect path
   (`0xf848`) chosen by a kDEF flag. Port-origin, clip, colour-depth and
   alternate-path behaviour in canvas pixels is not specified.
8. The second direction-byte consumer: `0x6390` walks the side lists and
   passes the same `0 for 11/14, else 1` byte to `0x11452`
   (`0x651c..0x653c`). Not traced.

Corpus impact (13 wnd# archives, every sliced type, counts per state;
survey script and output in the private store, lanes/H):

- Code 11: 38 horizontal rows, all 1 px (direction-neutral); 6 vertical rows,
  4 with varying >1 px sources: animals `side-floating-utility-window` right
  (15 px) and `collapsed-no-title-utility` left (3 px).
- Code 14: 6 horizontal rows, 4 varying: animals `document-window` and
  `collapsed-document-window` bottom (6 px). 6 vertical rows, 2 varying:
  monkey-paradise `document-window` right (4 px).
- Code 13: 28 horizontal rows, 6 varying and phase-sensitive (animals); forward.
- Code 8: 678 horizontal and 512 vertical rows; 205 and 140 have a varying
  >1 px source and need the forward anchor.
- So five cells (× 2 states) are where `direction` is visible.
- cinf: 1,033 records, mode0 964, mode1 49, mode2 9, mode3 8, mode4 3, no
  mode ≥ 5 (B1–B3 unexercised by the corpus); `tile` 0 = 818, 1 = 215
  ([cinf-resize-behavior](../cinf-resize-behavior.md) survey).

## 7. Test hooks

- `tests/rendering-options/window-chrome-rules.mjs` asserts the §5 tile formula
  for every non-18 cell over the runtime-placed width, counting 1 px,
  whole-copy, forward >1 px and reverse >1 px pixels separately, opaque source
  pixels only.
- Mutations that must fail (per-archive table, PR #373 review): flipping the
  11/14 anchor fails only animals and monkey-paradise; inverted-anchor and
  scaled blits fail 1990, animals, crayon-os, dolphin-som, evolution, floppies
  and monkey-paradise. 1138, 1984, apple-lisa, beos-r503, windows-31 and
  windows-95 pass all three mutations, so they do not discriminate T5/T6.
- `tests/rendering-options/face-bands.spec.mjs`: hand-derived 9×9/c4/s1 and
  21×21/c7/s14 sources distinguish square corners (E1), transposed body fill
  (§5 R1/R2), first-strip versus repeat sampling (E3/E4), overlapping edge
  order (E2) and transparent holes.
- Primitive unit tests the v2 engine should add (PLAN §4 L4): tile forward and
  reverse with a partial tile at each end; whole-multiple coincidence; T1/T2
  fast-path triggers; scale with unequal rects; corner offset; B0–B6 and P1–P5
  rows each with a mutation that fails; cinf NULL → single retry → skip, with a
  second NULL never retried.
