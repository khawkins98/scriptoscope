# `qd.blit` — kDEF blit primitives: tile, scale, corner, icon blit, samplers, pattern fills, cinf body + border

*Behavioural spec, [TEMPLATE](TEMPLATE.md) shape. First split out of
`kdef231-reference.md` §1.5 / §3.6 / §5 / §5.1 and `kdef231-recipe-walk.md`
Q2 / Q5 on 2026-10-21 (v2 lane L2, moved prose). **Revised 2026-10-22** (spec
writer, `v2-spec-qd-answers`) to answer the L4 implementer's questions Q1–Q11
(§8): every row below was re-read in the 2.3.1 listing, several rows were
corrected (§9), and rows were added for the icon blit, the samplers, the
pattern fills and the cinf border rects. It has **not** yet had an independent
verifier pass. Listing provenance: `qd-primitives.evidence.md` (spec writers
and verifiers only).*

**Two kinds of statement.** Rows with an address in `source` are decoded from
the kDEF. QuickDraw itself is not in the kDEF: whatever CopyBits, CopyMask,
LineTo or a pattern fill does *inside* the Toolbox is marked **Apple-documented,
not binary-decoded** and cites *Inside Macintosh: Imaging With QuickDraw*
(Apple, 1994; "IWQD" below, page numbers as printed). Where Apple is silent the
row says **not specified** and names the policy the runtime uses instead.

---

## 1. Unit id and scope

| field | value |
|---|---|
| unit id | `qd.blit` (tile, scale, corner 1:1, icon blit, samplers, pattern fills) and `qd.cinfFrame` (cinf body + border engine) |
| family | shared QuickDraw-level primitives used by the window recipe walk, the control faces and the scroll bar |
| binary | Kaleidoscope 2.3.1 `kDEF 0`, 107,726 B, SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` |
| cited range | tile `0xfeae..0x10280`; scale `0x10320..0x1041e`; corner `0x102d0`; icon blit `0xfdf8..0xfeac` and its corner form `0x10282`; samplers `0xf9f6`, `0xfa2a`, `0xfa5a`, `0xfa8a`, `0xfc5c`, colour lookup `0x10702`; colour setup `0xf378`; low-depth flag `0xf2d6`, `0xf488`; pattern fills `0xf930`/`0xf7cc` (rect) and `0xf87e`/`0xf71a` (region); mask-clear region `0xf68c`/`0xf6e0`; border cache `0xea6c`; cinf body + border `0x107fe..0x10fbe`; wrappers `0x10fc0`, `0x107a4`, `0x10fe0` |
| callers cited | window draw loop `0x5938..0x59f8` (scale at `0x59ba`, tile at `0x59e8`); rect-list widget draw `0x6062`; push face `0x7594`, bevel `0x7778` (via `0x10fc0`); default ring (via `0x107a4`); scroll-bar arrows `0xc6e4..0xc746`, track `0xbb28..0xbb44` (see [scrollbar](scrollbar.md)) |
| out of scope | the part-code classifier and width distribution ([compositor-spec](../compositor-spec.md)); resource selection ladders (family specs); the second direction-byte consumer `0x6390 → 0x11452` (§6) |

## 2. Inputs

**Rect convention.** A Mac `Rect` is `{top, left, bottom, right}`; width =
right − left, height = bottom − top; a rect is empty when right ≤ left or
bottom ≤ top. Intervals below are half-open `[start, end)`.

**Shared environment inputs** (read by several primitives):

| input | meaning |
|---|---|
| `colorPort` | the current port is a colour port (`CGrafPort`) |
| `lowDepth` | a kDEF flag set per device by the device-loop callback (`0xf2d6` → `0xf488`): **set** when the device's pixel depth is below 4, or is exactly 4 on a colour device; **clear** when the depth is above 4, or exactly 4 on a grey-scale device. A 32 bpp target always has `lowDepth` clear |
| `recordingPicture` | a picture is being recorded into the port (its `picSave` is non-nil) |
| `customBottlenecks` | the port has custom bottleneck procedures (its `grafProcs` is non-nil) |
| `clip` | the port's clip region; some primitives test only its bounding box |

### Tile blit (`0xfeae`)

| input | meaning |
|---|---|
| `source` | the colour icon (pixel map, mask, 1-bit image) the cell is copied from |
| `srcRect` | the source sub-rect, in the icon's bounds coordinates |
| `dstRect` | the destination rect in the port |
| `direction` | anchor byte: `1` = forward, `0` = reverse. The window caller passes `0` for part codes 11 and 14 and `1` for every other tiled code (`0x59c8..0x59da`); the cinf engine passes `1` for all four edge bands (`0x10d26`, `0x10e84`, `0x10efc`, `0x10f74`) |
| `altSource` | optional pixel map used instead of the icon's own pixel map (row X4). Pixel-neutral: see §5 "Border cache" |

### Scale blit (`0x10320`)

`source`, `srcRect`, `dstRect`.

### Corner 1:1 (`0x102d0`) and icon-blit corner (`0x10282`)

`source`, `srcRect`, destination top-left `(dstX, dstY)`.

### Icon blit (`0xfdf8`)

`source`, `srcRect`, `dstRect`. Used by the mode-5 cinf body (B2), the
scroll-bar composite arrow without a pattern (scrollbar AC5) and the corner
form `0x10282`.

### Samplers

| sampler | inputs | outputs | source |
|---|---|---|---|
| colour sample | icon, point `(h, v)` | the point's colour; also returns the point's mask bit | `0xfc5c` |
| line sample | icon, point, `testMask` | sets the foreground colour to the point's colour; returns the mask bit when `testMask`, else always true | `0xf9f6` → `0xfa8a` |
| foreground / background sample | icon, point | sets the foreground (`0xfa2a`) or background (`0xfa5a`) colour to the point's colour | `0xfa2a`, `0xfa5a` |

### Pattern fills

| fill | inputs | source |
|---|---|---|
| rect fill | rect, pixel pattern, phase point `(x, y)` | `0xf930` → `0xf7cc` |
| region fill | region, pixel pattern, phase point `(x, y)` | `0xf87e` → `0xf71a` |
| mask-clear region | icon, `srcRect`, destination top-left; outputs a region | `0xf68c` → `0xf6e0` |

### cinf body + border (`0x107fe`)

| input | meaning |
|---|---|
| `id` | the resource id; the engine requests **both** the cicn and the cinf at this id (§3) |
| `D` | the face rect, width `W_D`, height `H_D` |
| `bodyFill` | paint the body and sample colours. True from the face wrapper `0x10fc0` (push face, bevel); false from the ring path of `0x107a4` |
| outputs `textRGB`, `embossRGB` | colours sampled from the cicn, returned to the caller |

cinf header fields (TMPL 129 names, see
[cinf-lookup-contract](../cinf-lookup-contract.md)): `c` = Corner Size, `s` =
Side Thickness, `tile` = Tile Sides, `mode` = Pattern Anchor, `backgroundId` =
Background Pattern ID (signed), and the background / text / emboss sample
points. The cicn's bounds are `B`, width `W`, height `H`.

## 3. Outputs

### Colour setup (every blit)

The tile, scale and icon blits save the port's foreground and background
colours, set **black foreground and white background** (`0xf378`), draw, and
restore both colours afterwards (`0xff2e..0xff3a`, `0x1026e..0x10278`;
`0x10378..0x10384`, `0x1040a..0x10414`; `0xfe28..0xfe34`, `0xfe98..0xfea2`).
Apple documents that CopyBits and CopyMask apply the port's foreground and
background colours to the image, and that black-on-white avoids colouring it
(IWQD p. 3-117): with this setup a transfer copies colours unchanged
(Apple-documented, not binary-decoded).

### Tile blit

Draws nothing when either rect is empty, or when `dstRect` lies entirely above
or entirely below the bounding box of `clip` (T0). Otherwise either a line fast
path (T1/T2) or a sequence of per-tile transfers (T3–T7, X1–X4).

### Scale blit

Exactly one masked transfer `srcRect → dstRect`, scaled when the rects differ
in size (SC1–SC4). Draws nothing when `dstRect` lies entirely above or below
the bounding box of `clip` (`0x10362..0x10374`). Used for window part code 18
(`0x59ba`), every rect-list widget draw (`0x6062`), the scroll-bar slices and
composite arrows, and the cinf corners (via the corner 1:1 form).

### Corner forms

`0x102d0` offsets `srcRect` so its top-left lands on `(dstX, dstY)` and calls
the scale blit: a 1:1 **masked** copy. `0x10282` does the same through the
icon blit (I1–I3), so its copy is opaque for a colour icon deeper than 1 bit.

### Wrappers

| wrapper | behaviour | source |
|---|---|---|
| face | `bodyFill = true`, forwards to the cinf engine; used by push face (`0x7594`) and bevel (`0x7778`) | `0x10fc0` |
| ring | with its flag clear: the cinf engine with `bodyFill = false` and no colour outputs. With its flag set: the window 9-slice wrapper into a new region, which is then painted | `0x107a4..0x107f6` |
| window 9-slice | loads the cicn (`0x10472`) and cinf (`0x116f8`) itself, then slices; its two extra arguments are not decoded here | `0x10fe0` |

### cinf body + border

Resource requests, in order:

1. **cicn `id`**, first (`0x10836..0x1085e`). The current resource file is
   first switched to the file named by the `'Copl'` Gestalt response when that
   Gestalt call succeeds (`0x10814..0x10830`); the request goes through the
   kDEF's cicn loader (`0x10472`, which serves a fixed id set from a cache and
   otherwise calls GetCIcon `$AA1E`, `0x10694..0x10698`) or, when the kDEF's
   cache mode is on, its cache lookup (`0xed70`). The caller's resource file is
   restored afterwards (`0x10860..0x10862`). **On NULL the engine returns at
   once: nothing is drawn, the cinf is not requested and no colour is sampled**
   (`0x10864..0x1086a → 0x10fb8`).
2. **cinf `id`** (GetResource `$A9A0` inside `0x116f8`, so the whole resource
   chain is searched). On NULL, **one** retry: cinf 0 when `bodyFill`, cinf 1
   when not (`0x10880..0x10898`). On a second NULL the body + border stage is
   skipped (`0x1089a → 0x10fa8`); the cicn is released then only when the cache mode is off (`0x10fa8..0x10fb4`). No synthesised
   default.
3. the body resource, only when `bodyFill` (table B): a **cicn** when
   `mode == 5`, otherwise a **ppat**, at `backgroundId` in both cases. A zero
   `backgroundId` is still requested. On NULL the body is erased with the
   sampled background instead; no retry.

The engine saves the pen state and sets PenNormal before drawing
(`0x108e8..0x108ee`) and restores it at the end (`0x10fa2..0x10fa6`).

Sampled colours (only when `bodyFill`, `0x108fc..0x10998`): background from
the background point, text from the text point, emboss from the emboss point,
each through the colour sample (S1–S5). The emboss output is marked **absent**
(its red component set to `0x1234`) when the emboss point is `(0,0)`
(`0x10938..0x10958`) **or** when the sampled emboss colour equals the
background colour in all three components (`0x1096e..0x10990`). The mask bit at
a sample point is ignored: a sample on a transparent pixel still yields that
pixel's colour. The background colour becomes the port's background colour for
the body (`0x109b2..0x109b6`); after the body the foreground colour is set to
the text colour (`0x10bba..0x10bbe`).

Draw order: body (if `bodyFill`), then border TL, TR, top, BL, BR, bottom,
left, right (`0x10c00..0x10f82`), with the rects of table E.

## 4. Decision tables

### Tile blit

| # | condition | behaviour | source |
|---|---|---|---|
| T0 | `dstRect` or `srcRect` empty; or `dstRect.bottom ≤ clip-bbox top`; or `clip-bbox bottom ≤ dstRect.top` | draw nothing. Only the vertical extent of the clip bounding box is tested | `0xfec2..0xfee6`, `0xff06..0xff2a` |
| T1 | source width 1, dst width > 1 | line fast path, before `direction` is read: for source row `r` from `srcRect.top` while `r < srcRect.bottom` and the dst row `dstRect.top + (r − srcRect.top)` is below `dstRect.bottom`: line-sample `(srcRect.left, r)` with `testMask` true; when it returns true, draw a line across `[dstRect.left, dstRect.right)` on that dst row in that colour (L1–L3) | `0xff3e..0xffb6`; sampler `0xf9f6` |
| T2 | source height 1, dst height > 1, T1 not taken | the same with axes swapped: source column `k` paints dst column `dstRect.left + (k − srcRect.left)` down `[dstRect.top, dstRect.bottom)` | `0xffba..0x10018` |
| T3 | otherwise | general path; tile size = source width × source height | `0x10036..0x10042` |
| T4 | general path, step axis | `srcH ≠ dstH` → step vertically by `srcH`; else step horizontally by `srcW`. The direction byte never selects the axis | `0x10146..0x1015e`, `0x10236..0x1024e` |
| T5 | `direction == 1` | first tile at the dst top-left; a tile that passes `dstRect.right` or `dstRect.bottom` is cut there and keeps the source's **leading** columns/rows; stop when the tile's left ≥ `dstRect.right` or its top ≥ `dstRect.bottom` | `0x1007c..0x100f6`, `0x10162..0x10176` |
| T6 | `direction == 0` | first tile at the dst bottom-right; steps subtract; a tile that passes `dstRect.left` or `dstRect.top` is cut there and keeps the source's **trailing** columns/rows; stop when the tile's right ≤ `dstRect.left` or its bottom ≤ `dstRect.top` | `0x1017e..0x101fa`, `0x10252..0x10262` |
| T7 | forward branch only | a tile wholly above or below the clip bounding box is skipped (vertical test only). Pixel-neutral: the skipped tile lies outside the clip, and Apple documents that drawing is clipped to the clip region (IWQD p. 3-117, CopyBits maskRgn paragraph; Apple-documented) | `0x100fa..0x1010c` |
| T8 | vertical stepping (T4) with `srcW ≠ dstW` | the tiles form **one column** of source width at the anchor edge: forward at `dstRect.left`, reverse ending at `dstRect.right`. A source wider than the dst is cut (forward keeps its left columns, reverse its right columns); a narrower source leaves the rest of the dst width undrawn. Horizontal stepping implies `srcH = dstH` | `0x100a0..0x100f6`, `0x1019e..0x101fa`, `0x10146` |

The window caller fixes the cross axis: on top/bottom sides the placed cell's
height equals the source's, on left/right sides its width does
(`0x5356`, `0x539c..0x53a6`, `0x5404..0x540c`, `0x5470..0x547c`,
`0x54da..0x54e6`). The cinf engine does the same for its bands (table E). So
every spec caller steps along the run, T8 is not reached by any decoded caller,
and T1/T2 fire only for a source 1 px along the run. The one exception: a run
exactly `srcH` long, where both branches draw one identical full copy.

### Tile blit: per-tile transfer

| # | condition | transfer | source |
|---|---|---|---|
| X1 | `recordingPicture` | CopyBits `$A8EC`, mode `srcCopy`, no mask region: **opaque**, transparent source pixels overwrite the destination | `0x1010e..0x10128`, `0x101fe..0x10218` |
| X2 | otherwise (every on-screen draw) | CopyMask `$A817` with the icon's mask, mask rect = the (cut) source rect: masked-out source pixels leave the destination unchanged | `0x1012c..0x10144`, `0x1021c..0x10234` |
| X3 | `lowDepth`, or not `colorPort` | the transfer source is the icon's **1-bit image** (black where set, white where clear) | `0x10046..0x1005a` |
| X4 | `colorPort`, not `lowDepth` | the transfer source is `altSource` when given, else the icon's pixel map | `0x1005c..0x1006a` |

Apple documents that "calls to CopyMask are not recorded in pictures and do
not print" (IWQD p. 3-120); X1 is the kDEF's picture-safe substitute.
The earlier wording of X1 ("the port has custom bottleneck procedures") was a
misreading of the port field the tile blit tests; see §9.

### Line fast path (T1/T2 and the scroll-bar one-column slices)

| # | condition | behaviour | source |
|---|---|---|---|
| L1 | sample returns false (mask bit clear, `testMask` true) | that row/column is not drawn | `0xff7c..0xff82`, `0xffe2..0xffe8`, `0xfa9a..0xfaea` |
| L2 | sample returns true | foreground := the point's colour (S2 or S3); MoveTo the first dst pixel, LineTo the last dst pixel (`dstRect.right − 1` or `dstRect.bottom − 1`) | `0xff84..0xff96`, `0xffea..0xfffa`; `$A893`, `$A891` |
| L3 | pixels painted | with a normal pen (1 × 1, black pattern, `patCopy`) the line paints every pixel from the first to the last dst pixel inclusive in the foreground colour (Apple-documented, not binary-decoded: "the graphics pen draws below and to the right of the
defining points", IWQD p. 3-18). The cinf engine and the scroll-bar draw set PenNormal; the tile blit itself does not set the pen, and the window draw loop's pen state is not established (§6) | `0x108ee`; scrollbar `0xa464` |

**Equivalence with the general path (answer to Q3).** Where L2 draws, the
general path (X2) would copy the same source pixel to the same dst pixels; where
L1 skips, X2's mask leaves the dst unchanged. So with a normal pen, no picture
being recorded, a direct-colour device and equal cross-axis extents of source
and destination (true for every decoded caller, which fixes the cross axis), the fast path's pixels equal the
general path's: both write the pixel's colour-table colour, unchanged by the
black/white colour setup (Apple-documented colour mapping, IWQD p. 3-117;
not binary-decoded). Differences that remain: (a) when
`recordingPicture`, the fast path still tests the mask, while X1 would be
opaque; (b) the fast path's colour comes from the kDEF's own lookup S2, which
can differ from QuickDraw's for an icon whose colour table lacks the pixel's
value (S2 rows b–d). A one-pixel-long run (dst length 1) never takes the
fast path.

### Window caller: which blit

| # | part code | blit | direction | source |
|---|---|---|---|---|
| W1 | 18 | scale | — | `0x59ba` |
| W2 | 11, 14 | tile | 0 (reverse) | `0x59c8..0x59da`, `0x59e8` |
| W3 | every other drawn code | tile | 1 (forward) | same |
| W4 | — | per side, the loop draws cells `1..count` of the side's border list, cell `i` = `[border[i−1], border[i])` with part `part[i]`; nothing before `border[0]` or after `border[count]` is drawn by this loop. Inside the loop, after the title side, the title-text routine `0x5530` is called (text, not a chrome cell; `0x59fc..0x5a02`). Sides run top, bottom, left, right (a kDEF flag can restrict the loop to one pair) | `0x58b8..0x58da`, `0x5938..0x59f8`; lists copied verbatim from the `wnd#` at `0x36ce..0x373c` |

### Scale blit

| # | condition | transfer | source |
|---|---|---|---|
| SC1 | `lowDepth`, or not `colorPort` | source = the icon's 1-bit image | `0x1038e..0x103a2` |
| SC2 | `colorPort`, not `lowDepth` | source = the icon's pixel map (never `altSource`) | `0x103a4` |
| SC3 | neither `recordingPicture` nor `customBottlenecks` | CopyMask `$A817`, mask = the icon's mask, mask rect = `srcRect` | `0x103f2..0x10402` |
| SC4 | `recordingPicture` or `customBottlenecks` | a region is built from the icon's mask (BitMapToRegion `$A8D7`), mapped from `srcRect` to `dstRect` (MapRgn `$A8FB`) and passed as the mask region of one CopyBits `$A8EC` `srcCopy`: still masked, but by the scaled mask *region* | `0x103ae..0x103f0` |

Scaling (both SC3 and SC4): Apple documents only that "for differently sized
rectangles, CopyBits scales the source image to fit the destination" (IWQD
p. 3-113) and the same for CopyMask (p. 3-119), with `maskRect` the same size
as `srcRect`; and that "CopyBits always dithers images when shrinking them
between pixel maps on direct devices" (p. 3-114). **Apple does not specify
which source pixel a scaled destination pixel takes**, and the scaling is
inside QuickDraw, not in the kDEF or the CDEFs. The runtime's sample-and-hold
mapping `src = floor(k · sw / dw)` is a **modern policy**, not a decoded or
documented rule; it stays until a native capture pins the mapping. The shrink
dither is not modelled.

### Icon blit (`0xfdf8`)

| # | condition | transfer | source |
|---|---|---|---|
| I1 | `lowDepth`, or not `colorPort` | CopyBits `$A8EC` `srcCopy`, no mask, from the icon's **1-bit image**: opaque black and white | `0xfe44..0xfe4e`, `0xfe7e..0xfe90` |
| I2 | `colorPort`, not `lowDepth`, the icon's pixel map is 1 bit deep | CopyMask `$A817` with the icon's mask, mask rect = `srcRect`: masked | `0xfe50..0xfe6a` |
| I3 | `colorPort`, not `lowDepth`, pixel map deeper than 1 bit | CopyBits `$A8EC` `srcCopy`, no mask: **opaque**, the icon's mask is ignored and mask-clear pixels draw their stored colour | `0xfe6e..0xfe7a` |

Scaling as for the scale blit. No picture or bottleneck test.

### Samplers

| # | condition | behaviour | source |
|---|---|---|---|
| S1 | every sample | the point `(h, v)` is read as an offset from the icon's first stored pixel (row `v`, column `h`), **with no range check**. For every corpus cicn the bounds start at `(0, 0)`, so the offset equals the bounds coordinate (census, §6) | `0xfc5c..0xfcc4`, `0xfa8a..0xfae4` |
| S2 | not `lowDepth` | colour = the stored pixel value (1, 2, 4 or 8 bit; leftmost pixel in the high bits) looked up in the icon's colour table, in this order: (a) value ≤ the table's last index (`ctSize`, i.e. entries − 1) and that entry's value equals it → that entry; (b) else, if the **last** entry's value is 0 → the entry at that position (beyond the table when the value exceeds the last index: undefined); (c) else the highest-indexed entry whose value equals it; (d) none → entry 0 | `0xfd34..0xfde8`, `0x10702..0x10766` |
| S3 | `lowDepth` | colour = the icon's 1-bit image bit: set → black, clear → white | `0xfcc8..0xfd30` |
| S4 | the returned mask bit | the line path tests it (L1); the cinf colour samples ignore it | `0xfcb8..0xfcc4`, `0x1091a`, `0x10934`, `0x1096a` |
| S5 | point outside the icon's bounds | if it still falls inside the stored row bytes (row padding), the stored padding bits are read; otherwise memory outside the icon's data is read and the result is **undefined**. Not a defined colour in the original: an implementation records it as `unspecified` rather than invent one | `0xfc5c..0xfde8` (no bounds test) |
| S6 | depth 16 or 32 icon pixel maps | not handled by the sampler (no branch); not reached by the corpus | `0xfd4a..0xfd5e` |

### cinf body (`bodyFill` true)

| # | condition | behaviour | source |
|---|---|---|---|
| B0 | `bodyFill` false | skip body and colour sampling; border continues | `0x108fc..0x10900`, `0x109aa..0x109ae → 0x10bc0` |
| B1 | `mode == 5` | request cicn `backgroundId` through the cicn loader | `0x109be`, `0x109c8..0x109d0`; `0x10472` |
| B2 | B1 found | icon blit (I1–I3) of the icon's whole bounds into `D` inset by `s` on all four sides (scaled), then dispose it. Not a pattern fill and not the inset-cross union | `0x109da..0x10a1a` |
| B3 | B1 absent | erase R1, then R2 unless `c == s` (§5), with the sampled background | `0x10a1e..0x10a68` |
| B4 | `mode != 5` | request ppat `backgroundId` (cached or uncached loader, chosen by a kDEF flag) | `0x109c4 → 0x10a6c..0x10a92`; GetPixPat `$AA0C` via `0x10440` |
| B5 | B4 found | rect-fill R1, then R2 unless `c == s`, with the pattern at phase P (table P, F1–F3) | `0x10a96..0x10b5a` |
| B6 | B4 absent | erase R1 and R2 as B3 | `0x10a9a → 0x10b72..0x10bb8` |

The erase is EraseRoundRect `$A8B2` with both oval sizes zero, i.e. an erase of
the rect with the port's background pattern in the background colour.
Apple-documented: an erase fills with the background pattern (IWQD p. 3-6);
that it shows the background *colour* assumes the port's background pattern is
the default white pattern (not established for every caller).

### Pattern phase P (B5)

| # | `mode` | phase `(x, y)` | source |
|---|---|---|---|
| P1 | 1 | `(D.left, D.top)` | `0x10ac8` |
| P2 | 2 | `(D.right, D.top)` | `0x10ad2` |
| P3 | 3 | `(D.left, D.bottom)` | `0x10adc` |
| P4 | 4 | `(D.right, D.bottom)` | `0x10ae8` |
| P5 | 0 or 6–255 | `(0, 0)` | `0x10af4` |

### Pattern fills (rect `0xf930`, region `0xf87e`)

| # | condition | behaviour | source |
|---|---|---|---|
| F1 | every fill | the port's origin is moved so that the phase point becomes local `(0, 0)`; the target rect/region and the clip region are moved by the same amount so the fill lands on the **same pixels**; everything is moved back afterwards. The clip is left unmoved when its bounding box already reaches the coordinate limit (top or left ≤ −32000 before, bottom or right ≥ 32000 after) | `0xf944..0xf9ec`; `0xf892..0xf926`; SetOrigin `$A878`, OffsetRgn `$A8E0` |
| F2 | not `lowDepth` | FillCRect `$AA0E` (rect) / FillCRgn `$AA12` (region) with the pixel pattern | `0xf858..0xf85e`, `0xf7a6..0xf7ac` |
| F3 | `lowDepth` | FillRect `$A8A5` / FillRgn `$A8D6` with the pattern's 1-bit form, black foreground on white background, colours restored afterwards | `0xf820..0xf856`, `0xf76e..0xf7a4` |
| F4 | `colorPort` | the port's fill pixel pattern field is cleared for the duration and restored; no pixel effect established | `0xf812..0xf81c`, `0xf860..0xf868` |

**Phase sign (answer to Q7).** The controlling Apple text is "all patterns are
always drawn relative to the origin of the graphics port" (IWQD p. 3-6).
p. 2-32 says patterns are "always aligned with the port's coordinate system"
and that "the upper-left corner of the pattern is aligned with the upper-left
corner of the port rectangle"; read literally, that second clause would make
F1 a no-op, so it is taken as describing the usual case where the port
rectangle starts at local `(0, 0)`. With F1, local `(0, 0)` is the phase point, so **port pixel
`(X, Y)` shows pattern pixel `((X − x) mod pw, (Y − y) mod ph)`**, with `mod`
the non-negative remainder and `(X, Y)`, `(x, y)` in the caller's local
coordinates. The origin move and the compensating offsets are binary-decoded;
that QuickDraw aligns to the moved origin is Apple-documented, not
binary-decoded (if alignment ignored the origin, F1 would be a no-op).
P5's `(0, 0)` is the caller's own local origin.

### Mask-clear region (`0xf68c`) and composite fill

| # | condition | behaviour | source |
|---|---|---|---|
| R1 | every call | region = `srcRect` minus the icon's mask region (BitMapToRegion `$A8D7`, DiffRgn `$A8E6`), moved so `srcRect`'s top-left lands on the given destination top-left. **1:1, not scaled**, even when the caller's blit scaled the icon | `0xf68c..0xf6d2` |
| R2 | BitMapToRegion fails | the mask region is emptied, so the region is all of `srcRect` | `0xf6fc..0xf708` |

The scroll-bar composite arrow with a pattern (scrollbar AC4,
`0xc6e4..0xc730`) draws the cell with the scale blit (masked), then
region-fills R1's region with the track pattern: the pattern appears only in
the cell's mask-clear pixels.

### Border bands (table E; rects in §5)

| # | condition | behaviour | source |
|---|---|---|---|
| E1 | every corner | a `c × c` source block at the icon's corner, cut to the icon's bounds, copied **1:1 and masked** (corner form → scale blit) at the face's matching corner | `0x10c00..0x10cb6`, `0x10d3c..0x10e12` |
| E2 | every edge band | thickness `s` (independent of `c`) cut to the icon; along the run `[c, extent − c)` with the *uncut* `c`; tile blit with `direction = 1`. Bands never overlap the corners (a corner reaches at most `cw`/`ch` ≤ `c`). When `s > c`, a top/bottom band and a left/right band overlap in the square `[c, s) × [c, s)` next to each corner (relative to that corner); left and right are drawn last, so their opaque pixels win there and, with the masked transfer (X2), their transparent pixels show the top/bottom band or the body beneath | `0x10cba..0x10d38`, `0x10e16..0x10f82` |
| E3 | `tile == 0` | the band's source is the **one** middle column (top/bottom) or row (left/right) at offset `c`; with a dst run longer than 1 this is the line fast path (T1/T2), so each source row/column is painted across the band where its mask bit is set | `0x10cee..0x10cfc`, `0x10e4c..0x10e5a`, `0x10ec4..0x10ed2`, `0x10f3c..0x10f4a` |
| E4 | `tile != 0` | the band's source is the whole middle strip `[c, extent − c)`, repeated forward from the band's start (T5); empty when `2c ≥` the icon extent, and then nothing is drawn (T0) | same branches → `0xfeae` |
| E5 | top pieces (TL, TR, top band) | skipped when `D.top + c ≤ clip-bbox top` (corners) or `D.top + s ≤ clip-bbox top` (band); bottom pieces skipped when `D.bottom − c ≥ clip-bbox bottom` or `D.bottom − s ≥ clip-bbox bottom`. Pixel-neutral culls, as T7 | `0x10c00..0x10c08`, `0x10cba..0x10cc2`, `0x10d3c..0x10d4c`, `0x10e16..0x10e20` |
| E6 | the cache mode is on and `tile != 0` | a border cache is built before the corners (§5 "Border cache") and passed to the four bands as `altSource`; pixel-neutral | `0x10bc0..0x10bfc`, `0x10d22`, `0x10e80`, `0x10ef8`, `0x10f70` |

Neither E3 nor E4 is whole-band stretching.

## 5. Geometry

**Tile index formula.** For a cell with source length `sw` along the run and
dst length `dw`, dst index `k ∈ [0, dw)` reads source offset

- forward (`direction == 1`): `k % sw`
- reverse (`direction == 0`): `sw − 1 − ((dw − 1 − k) % sw)`

The two coincide when `dw` is a multiple of `sw`. A reverse cell shorter than
its source shows the source's last `dw` pixels.

**cinf border rects (answer to Q1).** Source rects are relative to the icon
bounds' top-left; destinations are in the port. Let
`cw = min(c, W)`, `ch = min(c, H)`, `sw = min(s, W)`, `sh = min(s, H)`,
`e = (tile != 0) ? W − c : c + 1` and `f = (tile != 0) ? H − c : c + 1`.

| piece | source x × y | destination x × y | source |
|---|---|---|---|
| TL | `[0, cw) × [0, ch)` | `[D.left, D.left + cw) × [D.top, D.top + ch)` | `0x10c0c..0x10c54` |
| TR | `[W − cw, W) × [0, ch)` | `[D.right − cw, D.right) × [D.top, D.top + ch)` | `0x10c58..0x10cb2` |
| top | `[c, e) × [0, sh)` | `[D.left + c, D.right − c) × [D.top, D.top + sh)` | `0x10cc4..0x10d34` |
| BL | `[0, cw) × [H − ch, H)` | `[D.left, D.left + cw) × [D.bottom − ch, D.bottom)` | `0x10d50..0x10da6` |
| BR | `[W − cw, W) × [H − ch, H)` | `[D.right − cw, D.right) × [D.bottom − ch, D.bottom)` | `0x10daa..0x10e0e` |
| bottom | `[c, e) × [H − sh, H)` | `[D.left + c, D.right − c) × [D.bottom − sh, D.bottom)` | `0x10e22..0x10e92` |
| left | `[0, sw) × [c, f)` | `[D.left, D.left + sw) × [D.top + c, D.bottom − c)` | `0x10e9a..0x10f0a` |
| right | `[W − sw, W) × [c, f)` | `[D.right − sw, D.right) × [D.top + c, D.bottom − c)` | `0x10f0e..0x10f82` |

Consequences, all from the formulas:

- `2c > W` (or `> H`): the two corner sources overlap (each is cut to the whole
  icon extent) and E4 bands are empty (nothing drawn). E3 bands read column
  (row) `c`, which lies outside the icon when `c ≥ W` (`c ≥ H`): S5, undefined.
- `2c ≥ W_D` (or `H_D`): the destination band is empty (nothing drawn); the
  destination corners overlap and the later corner wins where its mask is set
  (order TL, TR, BL, BR).
- `s > c`: bands are thicker than the corners are long, but still start at
  `c`, so they never cover a corner. The top/bottom bands overlap the
  left/right bands in an `(s − c) × (s − c)` square next to each corner
  (e.g. `[D.left + c, D.left + s) × [D.top + c, D.top + s)`); left/right are
  drawn last and win there where their mask is set. All four corner blocks
  survive (agrees with `face-bands.spec.mjs`).
- `s` larger than the icon: the band thickness is cut to the icon (`sw`, `sh`).

**Body inset rects** (relative to `D`'s top-left, as `(x, y, w, h)`):
`R1 = (c, s, W_D − 2c, H_D − 2s)` and `R2 = (s, c, W_D − 2s, H_D − 2c)`
(`0x10a1e..0x10a34`, `0x10a46..0x10a5c`, `0x10afa..0x10b44`). `R2` is skipped
when `c == s`. Empty rects contribute nothing. The mode-5 icon body (B2) uses a
third rect, `D` inset by `s` on all four sides (`0x109ea..0x10a00`).

**Border cache.** When built (E6), the cache is a pixel map at the port's
depth, filled by four masked copies of the icon (CopyMask) covering the four
strips of the icon outside its bounds inset by `s` (`0xea6c..0xecac`). The
edge bands only read inside those strips, and the tile blit still masks with
the icon's own mask (X2), so the pixels drawn are the icon's pixels. That the
cache's colour conversion is lossless is Apple-documented colour mapping, not
binary-decoded. An implementation copies from the icon directly.

## 6. Not decoded / unknown; corpus impact

Open questions (implementers stop here and file a spec question):

1. The window draw loop's pen state for the line fast path (L3): the tile blit
   does not set the pen. While T1 draws, a port text field is set to a marker
   value and restored (`0xff5a..0xff62`, `0xffae..0xffb2`); its consumer is not
   traced and no pixel effect is established.
2. The scaled-pixel mapping of CopyBits/CopyMask and the shrink dither (SC
   rows): not specified by Apple, not in these binaries. Modern policy until a
   native capture pins it.
3. Whether the scaled mask (SC3) and the mapped mask region (SC4) select
   exactly the same pixels: not specified by Apple.
4. S2 rows (b)–(d) versus QuickDraw's own lookup for a sparse colour table:
   see [cicn-sparse-transfer](../cicn-sparse-transfer.md); the kDEF sampler's
   rule is decoded, QuickDraw's is not.
5. An erase (B3, B6) shows the background colour only if the port's
   background pattern is the default white pattern.
6. The second direction-byte consumer: `0x6390` walks the side lists and
   passes the same `0 for 11/14, else 1` byte to `0x11452`
   (`0x651c..0x653c`). Not traced; so W4's "nothing past the last border" is
   established for the frame draw loop only.
7. The window 9-slice wrapper `0x10fe0`'s two extra arguments, and the border
   cache rect the window draw loop passes (`0x58a4..0x58b6`).

Resolved since the first split (kept for traceability): `altSource` (X4, E6,
§5 border cache); the degenerate guard (T0); the fast-path sample and its
equivalence (L1–L3); the scale-blit selection and its colour call (SC1–SC4,
§3 colour setup); the inset reconciliation (B2 versus R1, §9); the pattern
fill path and phase sign (F1–F4).

Corpus impact (13 `wnd#` archives, every sliced type, counts per state;
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

cinf census (own forks, 14 archives with cinfs, 1,033 records; script and
output in the private store, `v2-lanes/spec-qd/`):

- mode 0: 964, mode 1: 49, mode 2: 9, mode 3: 8, mode 4: 3, mode ≥ 5: none
  (B1–B3 and I1–I3 unexercised by the cinf body); `tile` 0 = 818, 1 = 215.
- 7 records have no same-id cicn in their own fork (crayon-os, floppies):
  under §3 step 1 they draw nothing unless the base chain supplies the cicn.
- Every same-id cicn has bounds starting at `(0, 0)` (S1).
- `2c > W` or `2c > H`: 160 records in all 14 archives (empty E4 bands, cut
  corners). `s > c`: 164 records (9 archives). `s` beyond the icon: 12.
- E3 sample outside the icon (`tile == 0`, `c ≥ W` or `c ≥ H`): 11 records,
  ids -12235 (1138, 1984, 1990, beos-r503, dolphin-som, evolution, floppies,
  windows-31, windows-95), -12232 (beos-r503) and -12236 (floppies). Undefined
  in the original when the face is taller (wider) than `2c + 1`.
- Colour samples on mask-clear pixels: 183 background and 179 text samples
  (13 archives); S4 says they still yield their colour.
- Samples outside the bounds: 1138 -9549 and -9548 (text, 1 × 1 icons) and
  -9776 (emboss, 2 × 1): all inside the stored row byte, so S5 reads stored
  padding bits.

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
- Primitive unit tests the v2 engine should add: T0 for each empty-rect and
  clip case; tile forward and reverse with a partial tile at each end;
  whole-multiple coincidence; T1/T2 triggers with a mask-clear source row (L1);
  T8 single column; X1 versus X2 on a transparent source pixel; SC3/SC4 both
  masked; I2 masked versus I3 opaque on a mask-clear pixel (the mutation "I3
  masked" must fail); S2 rows (a)–(d) with a hand-built colour table; S4: a
  cinf whose background point is mask-clear still yields its colour; F1 sign:
  a 2 × 2 pattern filled at phase `(1, 0)` puts pattern pixel `(0, 0)` at port
  pixel `(1, 0)` (the mutation "phase negated" must fail); R1 not scaled;
  table E rects for `2c > W`, `s > c` (all four corner blocks intact; the band–band overlap squares next to each corner show the left/right band where its mask is set — the mutation "bands cover the corners" must fail) and `s > H`; B0–B6 and P1–P5 each with a
  failing mutation; cicn NULL → nothing drawn and no cinf request; cinf NULL →
  single retry → skip.

## 8. Answers to implementer questions (L4, PR #391)

| Q | question (short) | answer | rows |
|---|---|---|---|
| Q1 | cinf corner / band rects; `2c > W`, `s > c`, `s` beyond the icon | The engine's reading is right for corners and bands, with three precisions: corner sources are cut to the icon (`cw`, `ch`) and the destination corner takes the cut size; band thickness is cut to the icon (`sw`, `sh`) and the band's dst thickness equals it; the along range uses the uncut `c`, so bands never cover corners; with `s > c` bands overlap each other next to the corners and left/right win. Edge cases follow from the formulas | §5 cinf border rects, E1–E5 |
| Q2 | E4 tile direction | `1` (forward) for all four bands; the source is the whole middle strip; with the cache mode on, `altSource` is a pixel-neutral border cache | E4, E6, §2 tile inputs |
| Q3 | "nonzero" in T1/T2; equal to CopyMask? | The icon's mask bit at the sample point (the fast path asks the sampler to test the mask). Colour = S2 (or S3 at `lowDepth`). Pixels equal CopyMask's under a normal pen, no picture recording, a direct-colour device and equal cross-axis extents; the residual differences are listed | T1, T2, L1–L3, S2–S4 |
| Q4 | CopyBits scaling rule; scale-blit selection | Selection decoded: CopyMask on screen; CopyBits through the scaled mask region when recording a picture or with custom bottlenecks. The 0xf30a "RGBForeColor" claim was wrong: colours are black/white (`0xf378`). The pixel mapping of scaling is not specified by Apple and not in these binaries: keep `floor(k · sw / dw)` as a recorded **modern policy** | SC1–SC4, §3 colour setup, §6 item 2 |
| Q5 | window chrome transfer | **CopyMask** for every on-screen chrome tile, and for code 18 unless the port has custom bottlenecks (then CopyBits through the mapped mask region, still masked: SC4); opaque CopyBits only while a picture is being recorded (not when bottlenecks are custom: that was a misread field). The runtime's opaque CopyBits for every cell is a divergence from the decode; changing it (192 digests) is a family decision, not this unit's. The faithfulness-ledger row `0xfeae` still names `drawTile`; its owner should update it | X1–X4, W1–W4 |
| Q6 | vertical step with unequal cross widths | One column of source width at the anchor edge, cut if wider, the rest left undrawn if narrower. No decoded caller reaches it | T8 |
| Q7 | pattern phase sign; FillCRect vs FillRect | Positive: port pixel `(X, Y)` shows pattern `((X − x) mod pw, (Y − y) mod ph)` (origin move decoded, alignment Apple-documented). FillCRect normally; FillRect with the 1-bit pattern in black on white at `lowDepth` | F1–F4, P1–P5 |
| Q8 | when the cinf engine requests its own cicn | Always, **first**, before the cinf (from the `'Copl'` Gestalt file when available, through the kDEF's cicn loader). NULL → return immediately: nothing drawn, no cinf request, no colour sampled | §3 cinf requests step 1 |
| Q9 | samples outside the cicn | No range check in the original: inside the stored row bytes it reads padding; beyond, undefined. Record as `unspecified`. Separately, a sample on a **mask-clear** pixel is valid and yields its colour (183 corpus records) | S1, S4, S5 |
| Q10 | mode-5 icon body inset | Reconciled: B2 is `D` inset by `s` on all four sides; the `c`-horizontal/`s`-vertical rect at `0x10a28..0x10a34` is B3's first erase rect R1, not a slice rect. B2 uses the icon blit (I1–I3), so a deep icon body is opaque. No corpus cinf has mode 5 | B2, B3, §5 body inset rects, I1–I3 |
| Q11 | window far-edge cap | The frame draw loop draws cells `1..count` only; there is no cap cell past the last recipe border and no 1:1 stamp there. The runtime's `[lastAt, srcExtent)` cap is runtime policy with no decoded basis; keep it labelled as such (DECISIONS/ledger), not as a spec row. The untraced second side walker (§6 item 6) is the only reason this is not "never" | W4 |

## 9. Corrections in this revision

| earlier wording | now | why |
|---|---|---|
| tile transfer: CopyBits when the port has custom bottlenecks (`grafProcs`) | CopyBits when a **picture is being recorded** (`picSave`); CopyMask otherwise (X1/X2) | the field the tile blit tests is the port's picture-save field, not its bottleneck field; Apple: CopyMask is not recorded in pictures (IWQD p. 3-120) |
| scale blit "also calls RGBForeColor (`0xf30a`)" | `0xf30a` locks the icon and points its images at their data; colours come from `0xf378` (black/white) | re-read of `0xf30a` and `0xf378` |
| "corner 1:1 offsets `srcRect` by `(dstX, dstY)` minus its own top-left" | unchanged meaning; added the opaque sibling `0x10282` | `0x10282` routes through the icon blit |
| B2 "copy the icon" | icon blit I1–I3: masked only for a 1-bit icon | `0xfdf8` branches on depth |
| §6 item 6 "inset reconciliation" open | resolved: two different rects | `0x109f4..0x10a00` (B2) versus `0x10a28..0x10a34` (B3 R1) |
| emboss absent only at `(0,0)` | also when its colour equals the background colour | `0x1096e..0x10990` |
| cinf requests: cinf first | cicn first, then cinf; NULL cicn ends the call | `0x10836..0x1086a` |
| ring wrapper `0x107de` | the ring wrapper is `0x107a4`; `0x107de` is its no-region branch | routine starts at `0x107a4` |
