# `scrollbar.draw` — Kaleidoscope 2.3.1 scroll-bar CDEF: state, resources, geometry, draw order

Behavioural spec, v2 lane L5 (2026-10-21). Skeleton: [v2 PLAN §5](../../v2/PLAN.md);
template `docs/spec/engine/TEMPLATE.md` (L2). Implementers read this file,
[`qd-primitives.md`](qd-primitives.md) (blit, sampler and pattern-fill rules),
Apple Inside Macintosh / Universal Interfaces, and only the rule tables the
[implementer brief](IMPLEMENTER-BRIEF.md) allows. Every value an implementer
needs is stated in this file (§4–§5, with worked examples in §7).
`tests/rendering-options/range-rules.mjs` is a test-author file and is **not**
an implementer input (the brief forbids it). The geometry rule rows derived
from §7 are `tests/rendering-options/scrollbar-geometry-rules.mjs` (PR #390);
they repeat this file's numbers and become implementer input only once the
brief lists them. The address-by-address trace is in `scrollbar.evidence.md`;
implementers do not open it.

Every row cites the 2.3.1 listing by file offset. Rect intervals are half-open
`[start, end)`. "Along" means the axis the bar runs on (x for a horizontal bar,
y for a vertical one); "cross" means the other axis. "Low" is the left/top end,
"high" the right/bottom end.

## 1. Unit id and scope

| field | value |
|---|---|
| unit id | `scrollbar.draw` (plus the state, region and hit-test facts it depends on) |
| family | scroll bar (`scrollBarProc` 16, Appearance `kControlScrollBarProc` 384 family) |
| message | 0 `drawCntl`; also 1 `testCntl` (part codes), 11 `calcThumbRgn`, because the draw shares their state and rects |
| binary | Kaleidoscope 2.3.1 `kDEF 0`, 107,726 B, SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` |
| entry | service-table slot 1, `0x997e` (installed at `0x1cc4`). **Not** slot 5 `0x8d36`; see §8 |
| cited range | `0x997e..0x9c02` (dispatch), `0x9d84..0xa194` (per-message state), `0xa196..0xa502` (cleanup, regions, draw), `0xa506..0xa676` (hit test), `0xa8c6..0xae1c` (boxes, thumb geometry, flags), `0xaed6..0xbcee` (thumb, track, slicing), `0xc2d2..0xc850` (track source, arrows). Shared helpers cited where used |
| out of scope | tracking and drag messages (5, 6, 13, 26, 128, §1.1); the QuickDraw blit internals (`qd.blit` unit, `docs/spec/engine/qd-primitives.md`); how the cached loader `0x10472` maps ids to cache slots; sliders and progress bars (no 2.3.1 decode, `docs/spec/range-controls.md`) |

### 1.1 Message map of the scroll-bar CDEF (`0x99c8..0x9a0e`)

Before every message the CDEF rebuilds its per-message state (§4.1, `0x9d84`, called at `0x99bc`) and releases the handles it took after (`0xa196`, called at `0x9be6`).

| message | handler | covered here |
|---|---|---|
| 0 draw | `0xa2b6` | yes |
| 1 test | `0xa506`; SmartScroll hit hook `0x1c46` notified after | yes (§4.8) |
| 2 calcCRgns | `0xa1fe` → 10 or 11 by the high bit of the region argument | region facts only |
| 3 init / 4 dispose | `0xa1ce` / `0xa1e8`: allocate / free the thumb region kept as control data | yes (§2) |
| 5 posCntl | `0x1c16`, `0xa678` | no |
| 6 thumbCntl | `0xa808` | no |
| 10 calcCntlRgn | `0xa248`: the control rect | yes |
| 11 calcThumbRgn | `0xa26e`: recomputes the thumb (§4.6) and copies its rect region; sets the drag pattern to system pattern 17 unless Gestalt(`Aarp`) byte 16 is set | geometry only |
| 13 drawGhost | `0xbf5c` → ghost drawer `0xc000`/`0xc084` (ghost cicns -8272 vertical / -8271 horizontal, +18 at thickness ≤ 11, `0xc1e4..0xc22c`) | no |
| 19 getFeatures | `0x9af6`: bit 0, bit 13, and bit 10 when variant bit 1 (live) is set | no |
| 26 calcValueFromPos | `0x9c06` | no |
| 27 testNewMsgSupport | `0x9aec`: `' ok '` | no |
| 34 | `0x9b42`: per-part theme-sound selectors: arrows `sbap`/`sbae`/`sbax`/`sbar`, page parts `sbtp`, thumb `sbth` (live) or `sbgh` | corroborates the part codes only |
| 128 | `0x9a9c` → `0xbcf0` (live drag) | no |

## 2. Inputs

### Control inputs

| input | meaning | values / domain |
|---|---|---|
| `rect` | the control rect `R`, in port coordinates | `top, left, bottom, right` |
| `visible` | the control is visible | bool |
| `hilite` | the control's highlight value | 0, 1..253, 254, 255 |
| `value`, `min`, `max` | the control's 16-bit value fields. With Appearance 1.1 or later (Gestalt(`apvr`) ≥ `0x0110`, `0x9d90..0x9db4`) they are read through accessor glue (`0x9938`, `0x995a`, `0x996c`) that reads the same 16-bit fields. One difference: without Appearance 1.1 the proportional thumb length (§5.6) forms `max − min` as a 16-bit difference, which wraps for ranges above 32767 (`0xac8e..0xaca4`); unreachable under the declared defaults | integers, `min ≤ value ≤ max` assumed (Control Manager pins value) |
| `parentInactive` | there is an embedding parent and it is inactive | bool; only read when hilite is 255 and Appearance is present |

### Environment inputs

| input | meaning | source |
|---|---|---|
| `appearancePresent` | Gestalt(`appr`) succeeds | `0x9f9c..0x9fac` |
| `resourceStart` | the resource file made current before every resource request: Gestalt(`Copl`) low word when that selector exists, else the current file is left alone | `0x9f3e..0x9f58`, `0xbcc6`, `0x10498..0x104ae` |
| `option27` .. `option36` | bytes 27, 31, 32, 33, 34 and 36 of the Gestalt(`Acid`) response block; all clear when the selector is absent (`0x9db8..0x9e1e`). What sets them is not decoded (§6) | bytes |
| `finderWindow` | the current process's signature is `MACS` (GetProcessInformation, `$A88F` selector 58) **and** the owner window's windowKind is 20 | `0x9ebc..0x9f0a` |
| `smartScroll` | the SmartScroll extension is installed (Gestalt(`MMBS`) with its `MMBS` tags, `0x1b1a`) | `0x1b1a..0x1b9e` |
| `atiPresent` | Gestalt(`ATIr`) exists (an ATI accelerator) | `0x1c90..0x1ca4`, read at `0xba78` |
| `lowDepth` | the device being drawn has pixel depth < 4, or depth 4 with gdFlags bit 0 set; clear above 4 | `0xf2d6`, `0xf488..0xf4b8` |

### Derived state (rebuilt for every message, `0x9d84..0xa194`)

| state | definition | source |
|---|---|---|
| `inactive` | hilite = 254; or hilite = 255, `appearancePresent`, the control has a parent and the parent is not active | `0x9f7a..0x9fd6` |
| `disabled` | hilite ≥ 254, or `min = max` | `0xada2..0xadfc`, stored `0x9e3c..0x9e42` |
| `pressed` | hilite in 1..253 | `0xa01c..0xa030` |
| `horizontal` | `R.right − R.left > R.bottom − R.top` (a square control is vertical) | `0xadfe..0xae1c` |
| `t` (thickness) | the cross size of `R`: `R.bottom − R.top` if horizontal, else `R.right − R.left` | `0xbc92..0xbcc4` |
| `double` | `option33` set **and** the along length of `R` is at least `8·t` | `0x9dfa`, `0x9e7e..0x9eb8` |
| `proportional` | `option34` set **and** `finderWindow` | `0x9e04`, `0x9ebc..0x9f0a` |
| `wholeTrack` | `option31` set | `0x9de6` |
| `thumbSlice` | `option27` (signed byte) | `0x9df0` |
| `pressedHalves` | `option32` set, `wholeTrack`, not disabled, hilite ≠ 0 | `0x9e0e`, `0x9e64..0x9e7a` |
| `pressedSideOnly` | `option36` set, not `wholeTrack`, not disabled, hilite ≠ 0 | `0x9e18`, `0x9e46..0x9e60` |

Every `inactive` control is also `disabled` (both need hilite ≥ 254). A
"together arrows" layout flag exists in the listing but is cleared for every
message and never set (`0x9e1e`), so all its branches are unreachable in 2.3.1
and are omitted here.

### Scriptoscope mapping (DECISIONS #4) and declared defaults

| public input | native reading |
|---|---|
| `state: 'normal'` | hilite 0, `min < max` |
| `state: 'pressed'` + `pressedPart` `up` / `down` / `pageUp` / `pageDown` / `thumb` | hilite 20 / 21 / 22 / 23 / 129 |
| `state: 'pressed'` without a part | hilite 129 (`thumb`) |
| `state: 'inactive'` | hilite 254 |
| `state: 'disabled'` | hilite 255 with no inactive parent |

Declared defaults (modern policy, not original observations): every `option*`
clear, `finderWindow` false, `smartScroll` absent, `atiPresent` absent, `lowDepth` clear (≥ 8-bit
output), and a resource chain of the archive's own fork, then its base chain.
The Kaleidoscope control-panel fork that `resourceStart` would also reach is not
shipped (DECISIONS #5), a recorded divergence.

## 3. Outputs

### Resources requested, in order

1. Track cicn (§4.2, GetCIcon `$AA1E`), one to three probes; a NULL is never
   retried at another tier.
2. Track pattern (§4.3, GetPixPat `$AA0C`), up to three probes.
3. Thumb length (§5.6, before the draw loop, `0xa3b8`): the thumb cicn through
   the cached loader `0x10472`, one or two probes. Not when `disabled` (`0xa988`).
4. Draw: for each drawn arrow (§4.5): composite → for a pressed, non-hit arrow
   one cicn probe and one ppat probe at `trackId − 1`; icon lane → `ics#`
   then `ics8` at one id (`0xf4ba`). Then the thumb cicn again (§4.6), one or
   two probes, not when `disabled` (TH2). Then per track segment, when the id − 1 variant applies (§4.7),
   one cicn and one ppat probe at `trackId − 1`.

The CDEF never requests `ics4`, and never requests cicns -10204..-10197.

### Rects

Arrow boxes (§5.3), track rect `T` (§5.2), thumb rect `Th` (§5.7), track
segments (§5.8), all in port coordinates. The thumb region (control data) is
`Th` as a rectangle region; a separate drawn-thumb region is the thumb cicn's
mask mapped into `Th` (§4.6).

### Draw order (`0xa44c..0xa502`, `0xaed6..0xb004`)

Nothing is drawn when the control is invisible, `R` is empty, the port's visRgn
is empty, or the pen is hidden and no picture is being recorded
(`0xa324..0xa360`). Otherwise, through the kDEF's per-device draw loop
(`0xf112`), for each device, with PenNormal, black foreground and white
background (`0xa464..0xa470`):

1. arrow 0 (low end, low arrow) — always (§4.5 AD1);
2. arrow 2 (high end, low arrow) — when `double`;
3. arrow 3 (high end, high arrow) — always;
4. arrow 1 (low end, high arrow) — when `double`;
5. thumb (§4.6), recording the drawn-thumb region;
6. track (§4.7): the low segment then the high segment, or the whole track in
   one pass, clipped to (current clip ∩ `R`) minus the drawn-thumb region.

The draw message's part argument does not change what is drawn: every part is
drawn from `hilite` (`0xa378..0xa3d8` only decides whether the thumb rect is
recomputed).

## 4. Decision tables

Row ids are stable; `src/engine/tables/scrollbar.ts` mirrors one row per spec
row with the same `source`.

### 4.1 State

| # | condition | output | source |
|---|---|---|---|
| ST1 | hilite = 254 | `inactive`, `disabled` | `0x9f82`, `0xadb2` |
| ST2 | hilite = 255, `appearancePresent`, parent exists, parent not active | `inactive`, `disabled` | `0x9f94..0x9fd6`, `0xadb2` |
| ST3 | hilite = 255 otherwise | `disabled`, not `inactive` | `0xadb2` |
| ST4 | hilite < 254, `min = max` | `disabled` | `0xadbe..0xadf0` |
| ST5 | hilite in 1..253, `min < max` | `pressed` | `0xa01c..0xa030` |
| ST6 | hilite = 0, `min < max` | normal | `0xa01c..0xa030` |

ST4 with hilite in 1..253 is `disabled` and also `pressed`. Tier selection
gives `disabled` precedence (TR2), but AC2 reads `pressed` from hilite alone, so
such a control draws its non-hit composite arrows from `trackId − 1` (tier 0).

### 4.2 Track cicn

`base` = -8288 if horizontal, else -8280 (`0xa032..0xa03e`).

| # | condition | output | source |
|---|---|---|---|
| TR1 | `inactive` | tier 0 | `0xa042..0xa048` |
| TR2 | `disabled`, not `inactive` | tier 1 | `0xa04c..0xa052` |
| TR3 | `pressed`, not `disabled` | tier 3 | `0xa056..0xa05a` |
| TR4 | otherwise | tier 2 | `0xa05e` |
| TR5 | always | `trackId` starts as `base + tier` | `0xa06c..0xa070` |
| TR6 | `t ≤ 11` and `double` | probe `base + tier + 22`; on success `trackId = base + tier + 22`, `doubleArt` | `0xa074..0xa0a8` |
| TR7 | `t ≤ 11`, nothing found yet | probe `base + tier + 18`; `trackId = base + tier + 18` **whether or not it is found** | `0xa0ae..0xa0c2` |
| TR8 | nothing found yet, `double` | probe `base + tier + 4`; on success `trackId += 4`, `doubleArt` | `0xa0cc..0xa0f8` |
| TR9 | nothing found yet | probe `base + tier`; `trackId` unchanged | `0xa0fe..0xa10e` |
| TR10 | every probe NULL | no track cicn (no cross-tier retry) | `0xa0cc..0xa112` |

Consequence of TR7 + TR8/TR9: at `t ≤ 11` with no small art, the full-size
cicn is used but `trackId` keeps the +18 (or becomes +22), and every later
lookup keyed on `trackId` (TP1, arrow id − 1, TF3) uses that id.

### 4.3 Track pattern

| # | condition | output | source |
|---|---|---|---|
| TP1 | always | probe ppat `trackId` | `0xa112..0xa11a` |
| TP2 | TP1 NULL and `doubleArt` | probe ppat `trackId − 4` | `0xa11e..0xa136` |
| TP3 | still NULL | probe ppat `base + tier` | `0xa13a..0xa14a` |
| TP4 | still NULL | no track pattern | `0xa13a..0xa14a` |

### 4.4 Composite flag

| # | condition | output | source |
|---|---|---|---|
| CF1 | a track cicn was found and its bounds width > 16 or height > 16 | `composite` | `0xa14e..0xa184` |
| CF2 | otherwise (including no track cicn) | icon lane | `0xa14e..0xa158` |

### 4.5 Arrows

Arrow index: 0 = low arrow at the low end, 1 = high arrow at the low end,
2 = low arrow at the high end, 3 = high arrow at the high end. A "low" arrow
is left/up, a "high" arrow right/down.

| # | condition | output | source |
|---|---|---|---|
| AD1 | always (the only skip condition is the unreachable together flag) | draw arrow 0 | `0xa47c..0xa496` |
| AD2 | `double` | draw arrows 2 and 1 | `0xa49a..0xa4b4`, `0xa4c6..0xa4de` |
| AD3 | always | draw arrow 3 | `0xa4b8..0xa4c0` |
| AD4 | `inactive` | the arrow drawer draws nothing | `0xc34a` |
| AH1 | hilite = 20 | arrows 0 and 2 are hit | `0xc3a0..0xc3ae`, `0xc764..0xc77e` |
| AH2 | hilite = 21 | arrows 1 and 3 are hit | `0xc3b0..0xc3c0`, `0xc782..0xc790` |
| AH3 | any other hilite | no arrow is hit | `0xc3c2` |
| AC1 | `composite` | the arrow box (§5.3) is drawn from a cell of the track cicn (§5.4) | `0xc37e..0xc402` |
| AC2 | `composite`, `pressed`, arrow not hit | cell source is cicn `trackId − 1`, falling back to the track cicn; pattern is ppat `trackId − 1`, falling back to the track pattern | `0xc3cc..0xc3fe` |
| AC3 | `composite`, otherwise | cell source is the track cicn and the track pattern | `0xc37e..0xc382` |
| AC4 | `composite`, a pattern is present | blit the cell into the box with the scale blit (masked; qd-primitives SC1–SC4), then region-fill the cell's mask-clear pixels with the pattern, anchored at `R`'s top-left (qd-primitives R1, F1–F3; the region is placed 1:1 at the box's top-left, not scaled) | `0xc6e4..0xc730`, `0xf68c`, `0xf87e` |
| AC5 | `composite`, no pattern | blit the cell into the box with the icon blit (qd-primitives I1–I3): masked (I2) only in a colour port, not `lowDepth`, with a 1-bit cell pixel map; a deeper cicn (I3) is copied **opaque**, its mask ignored, and at `lowDepth` or in a non-colour port (I1) the 1-bit image is copied opaque even for a 1-bit cicn (corrected 2026-10-22; earlier wording said "through its mask") | `0xc736..0xc746`, `0xfdf8` |
| AI1 | icon lane, not `disabled`, not hit | icon id: low h -10202, low v -10204, high h -10201, high v -10203 | `0x9f0e..0x9f38`, `0xc792..0xc7b6` |
| AI2 | icon lane, not `disabled`, hit | icon id: low h -10198, low v -10200, high h -10197, high v -10199 | same |
| AI3 | icon lane, `disabled` | icon id: low h -10206, low v -10208, high h -10205, high v -10207 (no hit form) | `0xc7ba..0xc7fa` |
| AI4 | icon lane | draw `ics#` at the id (loaded into the system heap); no `ics#` → nothing; colour port and not `lowDepth` → `ics8` from the **same file** as the `ics#` (Get1Resource) if present and the kDEF's icon pixmap exists (allocated when the kDEF loads, `0xf3aa`; assume present), else the 1-bit `ics#` image (AI5); the `ics#` mask is applied unless it is all set or a picture is being recorded, and in the 1-bit branch also unless the port has custom bottlenecks | `0xc7fe..0xc81e`, `0xf4ba..0xf684` |
| AI5 | icon lane, the 1-bit branch of AI4 | the `ics#` image plane (the first 32 bytes, 16 × 16 at 2 bytes per row) is copied in `srcCopy` with black foreground and white background (`0xf4fa`), through the `ics#` mask plane (the second 32 bytes) under the AI4 mask conditions: set bits black, clear bits white, mask-clear pixels left untouched. No corpus archive reaches it (all icon-lane archives ship `ics8` for every id) | `0xf4fa`, `0xf5c6..0xf61c` |
| AI6 | icon lane, destination | the icon's 16 × 16 frame (an inference: the source rect is a kDEF global with no writer in the listing, `0xf4c6..0xf4cc`; 16 × 16 is the only frame consistent with the 2-byte icon rows and the kDEF's 16 × 16 icon pixmap, `0xf3aa`) is copied into the arrow box of §5.3 (`t × t`; 1:1 at `t = 16`, scaled by CopyBits/CopyMask otherwise) | `0xc810..0xc816`, `0xf4c6..0xf4cc`, `0xf5f2..0xf61a` |

### 4.6 Thumb

| # | condition | output | source |
|---|---|---|---|
| TH1 | `T` (§5.2) empty | no thumb and no track drawn | `0xaee2..0xaf04` |
| TH2 | `disabled` | thumb rect empty (§5.7); no thumb drawn; the whole `T` is filled as one track segment with the page flag false | `0xa988..0xa99e`, `0xaf08..0xaf20` |
| TH3 | hilite = 129 | thumb id -10205 h / -10207 v | `0xaf24..0xaf42` |
| TH4 | otherwise | thumb id -10206 h / -10208 v | `0xaf44..0xaf54` |
| TH5 | `t ≤ 11` | probe `thumbId + 1956` first, then `thumbId` | `0xaf56..0xaf82` |
| TH6 | no thumb cicn | nothing drawn; drawn-thumb region stays empty | `0xaf84..0xaf86` |
| TH7 | thumb cicn found | slice the whole cicn into `Th` (§5.9, mode `thumbSlice`), recording the cicn mask mapped into `Th` as the drawn-thumb region | `0xaf88..0xafbe`, `0xb44c` |

### 4.7 Track fill

| # | condition | output | source |
|---|---|---|---|
| TF1 | `wholeTrack` | one segment `T`, page flag false | `0xafc2..0xafda`, `0xb078..0xb10e` |
| TF2 | otherwise | low segment (page flag: hilite = 22), then high segment (page flag: hilite = 23), §5.8 | `0xafdc..0xaffa`, `0xb18c..0xb306` |
| TF3 | `pressedHalves`, or `pressedSideOnly` with page flag false | the segment uses cicn `trackId − 1` and ppat `trackId − 1`, each **without** fallback | `0xba3e..0xba6c` |
| TF4 | otherwise | the segment uses the track cicn and track pattern | `0xba36..0xba3a` |
| TF5 | segment rect empty | nothing | `0xba1e..0xba30` |
| TF6 | no cicn and no pattern | paint the segment white | `0xbb16..0xbb26` |
| TF7 | pattern present | pattern-fill the segment, phase anchored at `R`'s top-left; at `lowDepth` the pattern's 1-bit form in black on white | `0xbb28..0xbb44`, `0xf930`, `0xf7cc` |
| TF8 | cicn present (after TF7) | slice the track source rect (§5.5) into the segment, mode "halves" (§5.9) | `0xbb48..0xbb74`, `0xc2d2` |
| TF9 | `wholeTrack`, `pressedHalves`, hilite 20 or 21 | before the fill, redraw the hit arrow(s) (20: arrow 0, and arrow 2 if `double`; 21: arrow 3, and arrow 1 if `double`); arrows drawn in half mode (§5.4) are removed from the fill clip | `0xb080..0xb0fe`, `0xc822..0xc848` |

When `atiPresent` is absent, every segment is drawn into a temporary offscreen
GWorld of the segment rect and copied to the port with `srcCopy`. When
`atiPresent` is set, the offscreen is used only if the segment has a pattern
**and** a picture is being recorded; otherwise the segment draws straight into
the port (`0xba74..0xbbea`). If the offscreen cannot be created or locked, the
segment draws straight into the port. See §6 for pixels that neither the
pattern nor the cicn covers.

### 4.8 Hit test (part codes, `0xa506..0xa676`)

| # | condition (point `P`) | part | source |
|---|---|---|---|
| HT1 | `disabled`, or `P` outside `R` | 0 | `0xa512..0xa540` |
| HT2 | `P` in arrow box 0 | 20 | `0xa544..0xa576` |
| HT3 | `double`, `P` in arrow box 1 | 21 | `0xa57a..0xa5a8` |
| HT4 | `double`, `P` in arrow box 2 | 20 | `0xa5ac..0xa5e0` |
| HT5 | `P` in arrow box 3 | 21 | `0xa5e4..0xa60c` |
| HT6 | `P` in `Th` (recomputed) | 129 | `0xa60e..0xa62c` |
| HT7 | otherwise, `P`'s along coordinate < the along centre of `Th` (`(start + end) >> 1`) | 22 | `0xa62e..0xa66c` |
| HT8 | otherwise | 23 | same |

So `up` (20) = a low arrow, `down` (21) = a high arrow, `pageUp` (22) = the
track on the low side of the thumb, `pageDown` (23) = the high side, `thumb`
(129) = the thumb. Boxes are tested in the order above, so an overlap pixel
belongs to the earlier box.

## 5. Geometry

All integer arithmetic; `>> 1` is an arithmetic shift (floor); `trunc` rounds
toward zero. Formulas are written for a horizontal bar; a vertical bar swaps
x/y (left↔top, right↔bottom) everywhere.

### 5.1 Notation

`L = R.left`, `Rr = R.right`, `t` (§2), `c = t − 1`. `e = 0` if `composite`
else `1`.

### 5.2 Track rect `T` (`0xbbf4..0xbc90`)

- `inactive`: `T = R`.
- otherwise, `n = double ? 2c : c`; `T = [L + n, Rr − n)` along, `R`'s full cross.

### 5.3 Arrow boxes (`0xa8c6..0xa97a`)

Cross extent is `R`'s full cross. Along:

| arrow | box |
|---|---|
| 0 | `[L, L + c + e)` |
| 1 | `[L + c, L + 2c + e)` |
| 2 | `[Rr − 2c − e, Rr − c)` |
| 3 | `[Rr − c − e, Rr)` |

Composite boxes are `c` long and abut `T`; icon-lane boxes are `t × t` and
overlap `T` (and each other, when `double`) by one pixel. The track is drawn
after the arrows, so in the icon lane the track's end column covers the arrow
box's inner column wherever the track art is opaque.

### 5.4 Composite arrow cells (`0xc402..0xc6e0`)

`[l, r)` and `h` are the bounds (along) and cross size of the **cicn that
supplies the cell**, i.e. the cicn chosen by AC2/AC3: `trackId − 1` for a
pressed non-hit arrow when that cicn exists, else the track cicn
(`0xc402..0xc420`, read after the AC2 selection at `0xc3cc..0xc3fe`). They are
recomputed for every arrow; nothing is carried over from the track cicn except
the `composite`, `doubleArt` and `half` flags. `d = h − 1`. `half` = `pressedHalves`.

Example (animals and monkey-paradise, horizontal, pressed with hit 20): the
track cicn is -8285 (61 × 16) but the non-hit high arrow draws from -8286
(43 × 16), so its cell is `[28, 43)` of -8286, not `[46, 61)`.

Cells are computed from the source's own bounds, but a source shorter along
than `d` still gives a cell that extends past it. Reachable case: 1138 with
`min = max` and a pressed hilite (ST4: tier 1 track -8287, 33 × 16,
composite) draws a non-hit arrow from -8288 (5 × 16), whose high cell is
`[−10, 5)`. The part of a cell outside its source's bounds is not defined by
the kDEF or by Apple for CopyBits/CopyMask (the scale blit SC3/SC4 and icon
blit I3 rows of `qd-primitives.md` apply no bounds test; samples outside an
icon are undefined per its S5 row). Record those pixels as `unspecified`;
do not invent them.

| arrow | cell (not `half`) | cell (`half`) |
|---|---|---|
| 0 | `[l, l + d)` | (unless `double`) `[l, (l + r) >> 1)`, box end = box start + cell length |
| 1, `doubleArt` | `[l + d, l + 2d)` | `[l + d, (l + r) >> 1)`, box end = box start + cell length |
| 1, no `doubleArt` | `[r − d − 1, r − 1)` | same as not `half` |
| 2, `doubleArt` | `[r − 2d, r − d)` | `[(l + r + 1) >> 1, r − d)`, box start = box end − cell length |
| 2, no `doubleArt` | `[l + 1, l + d + 1)` | same as not `half` |
| 3 | `[r − d, r)` | (unless `double`) `[(l + r + 1) >> 1, r)`, box start = box end − cell length |

The cell's cross extent is the cicn's full cross. When cell and box differ in
size the blit scales.

### 5.5 Track source rect (`0xc2d2..0xc336`)

The bounds of the **cicn the segment draws** (the track cicn, or the
`trackId − 1` cicn under TF3), inset along at both ends by
`k = (h − 1) · (doubleArt ? 2 : 1)`, `h` being that cicn's cross size, when
`composite` and not `inactive`; otherwise its whole bounds (`0xbb4c..0xbb54`
passes the drawn cicn to `0xc2d2`). The `composite` and `doubleArt` flags stay
those of the track cicn (§4.4, TR6/TR8).

### 5.6 Thumb length `len` (`0xab68..0xad60`)

`trackLen` = along length of `T` (`0xad62`). `minLen` = the along size of the
thumb cicn chosen as in TH3–TH5, or `t + 1` when there is none; minus 5 when
`t ≤ 11` and the small thumb (`+1956`) was missing (`0xab74..0xac16`).

- `proportional`: `len = trunc(trackLen · alongR / (max − min + alongR))`,
  clamped to `[minLen, trackLen]` (upper clamp first, then the lower), where
  `alongR` is the along length of `R` (`0xac20..0xacc4`). The "`len = 0` if
  `len > trackLen`" rule below does **not** apply to this branch (it returns
  directly, `0xacc4`), so when `minLen > trackLen` the result is `minLen`,
  longer than the track.
- otherwise, SmartScroll present: its thumb rect's along length (minus
  `2t − 2` when `double` and that exceeds `trackLen`), at least `minLen`;
  SmartScroll absent: `len = minLen`. Then `len = 0` if `len > trackLen`
  (`0xacc8..0xad58`).

### 5.7 Thumb rect `Th` (`0xa97c..0xab66`)

- `disabled`: `Th = (0, 0, 0, 0)`.
- otherwise `range = max − min`, `offset = value − min` (`offset = 0` when
  `len = 0`), `free = trackLen − len`;
  `pos = trunc(offset · free / range + 0.5)` with the division in floating
  point, `range` first rounded to single precision, and `offset · free` an
  unsigned 32-bit product (`0xaa36..0xaaea`); `pos = 0` when `range = 0`.
- horizontal: `Th = [T.left + pos, T.left + pos + len)` along,
  `[T.top, T.top + t)` cross. The control-data region becomes `Th`
  (`0xab46..0xab5a`).

Worked example (1138, horizontal, `R` = 120 × 16, min 0, max 100, value 50):
`c = 15`, composite, boxes `[0,15)` and `[105,120)`, `T = [15,105)`,
`trackLen = 90`, thumb -10206 is 17 wide so `len = 17`, `free = 73`,
`pos = trunc(36.5 + 0.5) = 37`, `Th = [52,69)`.

### 5.8 Track segments (two-pass, `0xb18c..0xb306`)

- low: drawn if `Th.left > T.left`: `[T.left, Th.left + 1)`.
- high: drawn if `T.right > Th.right`: `[Th.right − 1, T.right)`.

Both have `T`'s cross extent. Each reaches one pixel under the thumb, where
the thumb clip hides it. When `len = 0`, `Th` is the empty interval at `T.left`,
so only the high segment `[T.left − 1, T.right)` is drawn. With no thumb cicn
(TH6) the clip removes nothing and `Th`'s interior between the two overlaps is
left undrawn.

### 5.9 Slicing a source rect `S` into a destination `D` (`0xb44c..0xba0c`)

`s` = along length of `S`, `w` = along length of `D`, `m = min(s, w)`,
`a = m >> 1`. If `S` and `D` have equal width and height, one 1:1 copy.
Otherwise pieces, each spanning the full cross of `S` and of `D` (so the cross
axis scales):

**Halves** (mode > 0; track fill uses mode 1):

| piece | destination | source |
|---|---|---|
| 1 | `[D.start, D.start + a)` | `[S.start, S.start + a)` |
| 2 (only `s < w`) | `[D.start + a, D.end − (m − a))` | the one column `[S.start + a, S.start + a + 1)` |
| 3 | `[D.end − (m − a), D.end)` | `[S.end − (m − a), S.end)` |

**Caps** (mode ≤ 0; cap `k = 3` for mode 0, `k = −mode` for mode < 0;
`mid = (D.start + D.end) >> 1`):

| piece | destination | source |
|---|---|---|
| 1 | `[D.start, D.start + k)` | `[S.start, S.start + k)` |
| 2 (only `s < w`) | `[D.start + k, mid − a + k)` | column `[S.start + k − 1, S.start + k)` |
| 3 | `[mid − a + k, mid + (m − a) − k + 1)` | `[S.start + k + q1, S.end − k + 1 − q2)`; when `s > w`, `q1 = trunc((s − w + 1)/2)`, `q2 = trunc((s − w)/2)`, else 0 |
| 4 (only `s < w`) | `[mid + (m − a) − k + 1, D.end − k + 1)` | column `[S.end − k, S.end − k + 1)` |
| 5 | `[D.end − k + 1, D.end)` | `[S.end − k + 1, S.end)` |

A one-column source piece whose source and destination cross sizes match is
drawn as one line per row in that pixel's colour, skipping rows the sampler
rejects (`0xb362..0xb432`); every other piece goes through the scale blit
(`0x10320`). For the thumb, each piece's mask region is mapped into its
destination and unioned into the drawn-thumb region (`0xb332..0xb360`).

## 6. Not decoded / unknown; corpus impact

Open questions. Implementers stop here and file a spec question.

1. What writes the Gestalt(`Acid`) response bytes 27, 31–34, 36 (scheme,
   control-panel preference or constant). Under the declared defaults they
   are clear; with them clear TR6, TR8, TP2, AD2, AC `half`, TF1, TF3, TF9,
   HT3, HT4 and the `proportional` branch are unreachable.
2. Which open file owns a found resource after `resourceStart` (scheme file,
   control panel, System), and what the control-panel fork holds. DECISIONS #5
   records the archive-plus-base chain as the divergence.
3. The cached loader `0x10472`: it serves a fixed id set (including the four
   thumbs) from a cache filled on first request; cache lifetime across scheme
   changes is not decoded. Treat it as GetCIcon from `resourceStart`.
4. Track segment pixels covered by neither the pattern nor an opaque cicn
   pixel: they come from a fresh offscreen whose contents the listing never
   sets (the default, `atiPresent` absent). When `atiPresent` is set and the
   segment has no pattern or no picture is being recorded, no offscreen is
   used and the port's existing pixels remain (`0xba74..0xbb12`). Undefined;
   see the corpus row below. Engine policy (not an original observation):
   leave those port pixels unchanged and mark them unspecified in the trace;
   do not synthesise content.
5. The blit primitives' pixel rules are specified in
   [`qd-primitives.md`](qd-primitives.md): scale blit SC1–SC4 (masked), line
   sampler L1–L3 and S1–S6, icon blit I1–I3 (`0xfdf8`, opaque above 1 bit),
   pattern fills F1–F4 and the mask-clear region R1–R2. What stays open there
   (scaled-pixel mapping, pen state) is listed in its §6.
6. SmartScroll's thumb rect (`0x1bbe`): an external extension; absent by
   declaration.
7. Messages 5, 6, 13, 26 and 128 (tracking, ghost, value from position).
8. `lowDepth` beyond TF7 and AI4: resolved in
   [`qd-primitives.md`](qd-primitives.md) §2 (a 4-bit colour device sets it, a
   4-bit grey device does not) and rows X3, SC1, I1, S3, F3 (1-bit art in
   black on white).

### Corpus impact (own forks; scratch census in the private store, v2-lanes/L5)

| rows | archives |
|---|---|
| CF1 composite (tiers 1–3, both orientations) | 1138, 1984, 1990, animals, apple-lisa, beos-r503, crayon-os, dolphin-som, evolution, floppies, monkey-paradise, windows-31, windows-95 (13) |
| CF2 icon lane, AI1–AI4 | apple-platinum-2, black-platinum, platinum-8, slimes, system7-nostalgia-silver (all 16 × 16 tracks; all ship `ics#` and `ics8` -10208..-10197; black-platinum ships no `ics4`) |
| tier-0 cicn not composite (5 × 16) | 1138 only; no effect, since `inactive` draws no arrows and uses the whole bounds |
| TP1/TP3 pattern found | apple-lisa, crayon-os, slimes, system7-nostalgia-silver, windows-95. slimes has no -8288 ppat (inactive horizontal draws no pattern) |
| AC4 composite arrows with pattern | apple-lisa, crayon-os, windows-95 |
| TF7 + TF8 with mask-clear track pixels (pattern shows through) | apple-lisa (-8285/-8286/-8287, -8277/-8278/-8279, small -8259/-8260/-8267/-8268), crayon-os and windows-95 (16 clear pixels in every tier), system7-nostalgia-silver (-8285/-8286, -8277/-8278: exactly its ppat ids) |
| §6 item 4 (clear track pixels, no pattern) | beos-r503 -8274 only (vertical double normal; needs `double`) |
| TH7 thumb with mask-clear pixels (track shows through) | animals, monkey-paradise, crayon-os (-10206, -10208), slimes (-10206) |
| TR6/TR7 small tracks present | 1138 (incl. +22), 1984, apple-lisa, beos-r503, floppies (incl. +22), windows-31, windows-95 (incl. +22) |
| TR7 quirk (no small art, `trackId` keeps +18; pressed non-hit composite arrows then fall back to the pressed cicn) | 1990, animals, crayon-os, dolphin-som, evolution, monkey-paradise (composite, no small art) |
| TH5 small thumbs (-8252..-8249) | 1138, 1984, apple-lisa, beos-r503, floppies, monkey-paradise, windows-31, windows-95; all others take `minLen − 5` at `t ≤ 11` |
| TR8 +4 art | 1138 and 1984 (tiers 1–3), beos-r503, crayon-os, floppies, windows-95 (all tiers) |
| never requested by this CDEF | cicn -10204..-10197 (apple-platinum-2, black-platinum, slimes -10203, system7-nostalgia-silver); floppies' arrow icons (its tracks are composite); every `ics4` |

All 18 archives ship the eight standard track tiers and the four thumbs, so
TR10 and TH6 are reached by no archive.

## 7. Test hooks

For the test-author agent (implementers do not need these files: every value
is in this spec). Selection assertions go in
`tests/rendering-options/range-rules.mjs`, geometry rows in
`tests/rendering-options/scrollbar-geometry-rules.mjs` (PR #390), derived from
this spec, never importing `src/`.
Selection rows can keep the sentinel-substitution method of range-rules;
geometry rows need the engine trace (rects per draw step).

| rows | assertion | mutations that must fail |
|---|---|---|
| ST1–ST6, TR1–TR4 | per state, the drawn track id is `base + tier` | tier map permuted (e.g. pressed ↔ inactive, the runtime's old map); hilite 255 treated as tier 0 when there is no inactive parent |
| TR7 | at `t ≤ 11` an archive without small art draws the full tier cicn but its pressed non-hit composite arrows use the pressed cicn (1990, animals) | resetting `trackId` after a small miss |
| TR10, TP4 | a missing tier draws no track (needs a synthetic fork) | retrying another tier |
| CF1/CF2 | crayon-os and windows-95 (31 × 16) are composite; the five 16 × 16 archives are icon lane | composite test as length ≥ 2t; or ≥ 16 instead of > 16 |
| AD1–AD4 | arrows 0 and 3 drawn at rest; none when inactive | skipping arrow 0; drawing arrows when inactive |
| AH1–AH3, AC2/AC3 | pressed 20 in a composite archive: low box from tier 3, high box from tier 2; pressed 22/23/129: both boxes tier 2 | non-hit box from tier 3; hit tested on part 22 |
| AI1–AI4 | icon lane: raised ids at rest, hit id only on the hit arrow, disabled ids -10206/-10205 (h) and -10208/-10207 (v); `ics8` never `ics4` | raised/hit swapped; disabled drawn raised; `ics4` used; icon drawn without `ics#` |
| §5.2, §5.3 | box and `T` rects for 1138 and platinum-8 at 120 × 16 (`[0,15)`/`[105,120)`, `T = [15,105)`; icon lane `[0,16)`/`[104,120)`, same `T`) | `c = t` instead of `t − 1`; icon boxes `c` long |
| §5.4, §5.5 | 1138 -8286: cells `[0,15)` and `[18,33)`, track source `[15,18)` | cell length `h` instead of `h − 1` |
| TH2–TH5, §5.6, §5.7 | worked example `Th = [52,69)`; thumb length = thumb cicn width (not proportional); disabled/inactive draw no thumb | proportional length by default; `+0.5` rounding dropped (`pos` 36); thumb drawn when disabled; pressed thumb id at rest |
| §5.8, TF2 | segments `[15,53)` and `[68,105)` in the worked example; drawn after the thumb and clipped by it | segments not overlapping the thumb by one pixel; track drawn before the thumb (assert on the engine trace order: with a mask-honouring blit the pixels cannot show it) |
| §5.9 track | halves for the track (`a = m >> 1`) | cap 3 used for the track |
| §5.9 thumb, TH5, §5.6 | at `t = 16` every archive's thumb is copied 1:1 (cicn `N × 16`, `len = N`), so the thumb slice mode cannot fail there. Use `t = 11` on an archive without small thumbs (1990, dolphin-som or evolution): horizontal thumb -10206 is 16 × 16, `minLen = 16 − 5 = 11`, `Th` is 11 × 11, caps of 3: dst `[0,3)` ← src `[0,3)`, dst `[3,9)` ← src `[6,12)` (centre trim `q1 = 3`, `q2 = 2`), dst `[9,11)` ← src `[14,16)`, cross scaled 16 → 11 (offsets relative to `Th.left`) | halves for the thumb (dst `[0,5)` ← `[0,5)`, `[5,11)` ← `[10,16)`); no `−5`; cap 2 |
| TF6–TF8 | crayon-os or windows-95 (a pattern for every tier and 16 mask-clear pixels per track cicn), with `R` placed at an offset that is not a multiple of 8: the pattern shows in the clear pixels under the track cicn, phase anchored at `R`'s top-left | pattern drawn over the cicn; phase anchored at the port origin |
| HT1–HT8 | part codes for points in each box, the thumb and both sides | 22 and 23 swapped; thumb tested before arrows |

A row that no mutation can fail is a finding; report it rather than drop it.

Note for the test author: the current `range-rules.mjs` icon census treats
`ics4` or `ics8` as the colour icon. The CDEF uses only `ics8` (from the
`ics#`'s file) and otherwise draws the 1-bit `ics#` image (AI4). No corpus
outcome changes (all five icon-lane archives ship `ics8` for every id), but a
fork with `ics4` and no `ics8` would be mispredicted.

## 8. Relation to earlier documents

- `docs/spec/range-controls.md` (Lane I) cites the scroll-bar CDEF as
  "second CDEF main `0x8d36` (service-handler slot 5)". The rows it decodes
  are right, but they belong to slot 1 `0x997e`: nothing in slot 5's range
  (`0x8d36..0x991e`) reaches `0x9d84` or any drawer above, its hit test
  returns part 10, and its message 34 answers `bevp`-family tags.
  `kdef-service-handlers.md` and `kdef231-reference.md` §1 carry the same
  slot swap. Slot 5 is undecoded here.
- range-controls.md calls `0xbbf4` the thumb rect. It is the track rect `T`
  (§5.2); the thumb is §5.6–§5.7.
- range-controls.md's draw order says arrow 0 is skipped when double arrows
  are on. It is drawn whenever `double` is set (AD1); only the unreachable
  together flag skips it.
- range-controls.md says a disabled control redraws the track in the thumb
  rect. It fills the whole track rect `T` (TH2).
- range-controls.md leaves icon depth open: the CDEF draws `ics8` or `ics#`,
  never `ics4` (AI4).
