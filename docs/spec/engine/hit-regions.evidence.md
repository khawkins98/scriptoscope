# `window.regions` + `window.hit` — evidence appendix (never read by implementers)

Evidence for [hit-regions.md](hit-regions.md). This is a static reading of the raw
2.3.1 `kDEF 0` listing (`kDEF/id-0-680x0_DefProcs.bin`, 107,726 B, SHA-256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`, re-hashed
2026-10-31; listing `k231-kdef0.asm` from the maintainer's local `.scratch/k231-kdef/kDEF/`).
No original code was executed. Trap identities are from the pinned Universal
Interfaces `Traps.h` (`SCRIPTOSCOPE_TRAPS_H`). `WindowRecord` offsets are from
Universal Interfaces 3.2 `MacWindows.h` (`strucRgn` +114, `contRgn` +118,
`windowKind` +108, `visible` +110, `hilited` +111, `goAwayFlag` +112). Work-struct
bytes are named after `window-widgets.md` §2.2 where that doc already names them.

Marks: **C** confirmed by reading every instruction in the cited range; **I**
inference from the shape of the code (stated reason); **U** unresolved.

## E1. Message routing for recipe windows

| site | reading | mark |
|---|---|---|
| `0x118b8..0x11912` | document gate: varCode `&15`; `_GetResource('wnd#', -14336)` at `0x118ee`; non-null → `bsrl 0x28e0` with (param, **unchanged message**, window, varCode) | C |
| `0x1525a..0x152ba` | utility gate: `_GetResource('wnd#', -14304)`; non-null → `0x28e0` with the message unchanged and **varCode `(v&15)+1984`** (`0x15270..0x15274`). The +1984 is a procID (family 124), not a message base | C |
| `0x28e0..0x2960` | stores window/varCode/param/message at work-struct 454/458/460/464; runs precompute `0x2e02` unless message is 1000/1001; `0x148` switch; the table starts at the return address `0x292e`: default `+0x4ae` → `0x2ddc` (the common exit every handler branches to), min 0, max 1001, count−1 = 10 (11 pairs from `0x2936`). *(Corrected 2026-10-31 after review: an earlier revision gave `0x2930`/`0x2dde`.)* | C |
| table `0x2936..0x2962` | (0 → `0x2962` → `0x41ee` draw), (1 → `0x296c` → `0x3f2c` **hit**), (2 → `0x2980` → `0x3ac4` **calc regions**), (3 → `0x298e` → `0x38fe` new), (4 → `0x299c` → `0x3aa8` dispose), (5 → `0x29aa` → `0x3e6c` grow outline), (6 → `0x29b4` → `0x436c` grow icon), (7 → `0x29be` features), (8 → `0x2a5e` get region), (1000 → `0x2dbc`), (1001 → `0x2dd0`) | C |

**Correction (to `kdef-service-handlers.md` slot 6 and `kdef-binary-inventory.md`
§2).** The objdump listing renders the `0x148` table words as instructions
(`subil #1001,%fp@(10)` at `0x292e`), which an earlier reading took for a
"msg − 1001" dispatch over verbs 1001..1009. Decoding the switch helper
`0x148..0x16a` (word default offset, word min, word max, word count−1, then
`(value, offset)` pairs with the target relative to the offset word) gives the
standard WDEF messages 0..8 plus 1000/1001. `window-widgets.md` already uses
`0x3f2c` for `wHit`; this is consistent.

**Propagation status (2026-10-31).** Corrected in place: `kdef-service-handlers.md`
(summary rows 6/7, the slot-6 body and table, the slot-7 heading),
`kdef-binary-inventory.md` (§1 heading and rows 1/2, §2 rows 6/7), and the
evidence twins (`kdef231-reference.evidence.md` gate table, slot-6 paragraph and
`0x28e0` row; the other two twins' stale rows marked superseded).
`kdef231-reference.md` §1.4 was corrected in #611: the gate-table column
"msg base into slot 6" (now "args into slot 6 (message / varCode)") and its
slot-3 "per `0x28e0` table (1001..1009)", slot-4 "varCode + 1984" and slot-8
"varCode + 1008" cells (each gate passes the message unchanged and rewrites only
the varCode), the slot-6 paragraph "msgs 1001..1009", the `0x28e0` row
"dispatches msg-1001", and the gate intro's miss path (slot 8 falls back to the
private dispatch `0x174c8` → table `0x174e8`, not a system `'WDEF'`). The non-pinned `kdef-binary-inventory.md` §2 row 4,
`kdef-service-handlers.md` slot 4 and the `kdef-service-handlers.evidence.md`
slot-4/8 rows were corrected or marked superseded in the same PR, which also
made the hash-only control-availability bump 1.0.18 → 1.0.19 that the nine
`documentSha256` pins required.

**Correction (to `kdef-binary-inventory.md` §1 and `kdef-service-handlers.md`
slot 7).** Slot 7 `0x1d3e` is CDEF-shaped, not the WDEF main:

| site | reading | mark |
|---|---|---|
| `0x1d3e..0x1d64` | args varCode `fp@18`, handle `fp@14`, message `fp@12`, param `fp@8`; messages > 34 → `0x28d2`; table at `0x1d68` | C |
| `0x1dae..0x1dc2` (msg 0) | dereferences the **handle** (a WDEF receives a WindowPtr), tests byte +16 (`contrlVis`) and `_EmptyRect` (`$A8AE`) on +8 (`contrlRect`) | C |
| `0x23b2..0x23c2` (msg 2) | strips bit 31 of param, then `_RectRgn(param, &(*h)->contrlRect)` — the CDEF `calcCRgns` contract (param is a RgnHandle), not `wCalcRgns` (no param) | C |
| `0x238a..0x23ae` (msg 1) | calls `$AA73` with selector −2 on the aux record; result returned | C (trap identity not looked up) |

Its family is undecoded. The labels "wHit 0x238a / wCalcRgns 0x23b2" in
`kdef-binary-inventory.md` §1 do not describe window messages. **Nothing in this
spec depends on slot 7.**

## E2. Per-message flags used here (`0x2e02..0x321a`)

Cleared at `0x2e0a..0x2e4a`; `drawActive` ← `hilited` (`0x2e52`); `collapsed` ←
`0xf078` (`0x2e5c..0x2e62`); then the procID switch at `0x2e6c` (table at
`0x2e72`: default `+0x2a4` → `0x3116`, range 0..1046, 24 pairs). Byte names:
495 `utilityFrame`, 496 `noWidgets`, **497 `rectFrame` (new name)**, **498
`rectShadow` (new name)**, 499 `growEnabled`, 500 `collapseRequested`, 501
`hasZoom`, 505 `widgetFrame`, 506 `altWidgets`, 507 `sideTitle`, 508
`drawActive`, 509 `popupFamily`, 510 `collapsed`.

| procID | target | flags set | mark |
|---:|---|---|---|
| 0 | `0x2f0c` | grow, collapseReq, widgetFrame | C |
| 1 | `0x2f32` | noWidgets | C |
| 2 | `0x2f3c` | **rectFrame** | C |
| 3 | `0x2f46` | **rectFrame, rectShadow** | C |
| 4 | `0x2f22` | collapseReq, widgetFrame | C |
| 5 | `0x2f6c` | noWidgets, widgetFrame | C |
| 8 | `0x2eda` | grow, zoom, collapseReq, widgetFrame | C |
| 12 | `0x2ef6` | zoom, collapseReq, widgetFrame | C |
| 13 | `0x2f56` | zoom, noWidgets, widgetFrame | C |
| 1024–1031 | `0x2f7c..0x3088` | utilityFrame, collapseReq, widgetFrame, plus grow/zoom/partial-zoom per id | C |
| 1040 | `0x308c` | utilityFrame, **rectFrame** | C |
| 1041 | `0x309a` | utilityFrame, **rectFrame, rectShadow** | C |
| 1042 | `0x30ae` | utilityFrame, noWidgets | C |
| 1043 | `0x30bc` | utilityFrame, noWidgets, widgetFrame | C |
| 1044 | `0x30d0` | utilityFrame, noWidgets, byte 504 | C |
| 1045 | `0x30e4` | utilityFrame, noWidgets, 504, widgetFrame | C |
| 1046 | `0x30fe` | utilityFrame, noWidgets, widgetFrame, grow | C |
| other | `0x3116` | none from the table | C |
| family 66/67 | `0x3116..0x31ac` | utilityFrame, altWidgets, collapseReq, widgetFrame (+sideTitle for 67; grow/zoom from variation bits) | C |
| family 124 (utility gate) | `0x31ae..0x3202` | altWidgets, collapseReq, widgetFrame; grow/zoom/sideTitle from variation bits 1/2/3; `drawActive` forced on when bit 0 clear | C |
| family 63 | `0x3204..0x3216` | popupFamily; `collapsed` cleared | C |

Reads (grep of `a4@(497)` and `a4@(498)`): sets above, clears at
`0x2e1a`/`0x2e1e`. The **region builder** reads them only at `0x3e08` and
`0x3e0e`. `rectShadow` is also read twice in a draw path, `0x42f2` (the
structure bbox, from `strucRgn`, is shrunk by 2 at right and bottom before
`_FrameRect` `$A8A1` at `0x4304`) and `0x4306` (then the shadow lines are drawn
with `_MoveTo`/`_LineTo`, `0x430c..0x4368`). Those draw reads change no region
rule. **C** *(Corrected 2026-10-31 after review: an earlier revision said
"read only at `0x3e08..0x3e12`".)*

## E3. `wCalcRgns` (`0x3ac4..0x3bda`)

| site | reading | mark |
|---|---|---|
| `0x3ad0..0x3ad6` | if `hasZoom`, call `0x466e` (zoom-state helper) first | C |
| `0x3adc..0x3ae0` | `C` ← `0x4778` (content rect, global) | C |
| `0x3ae6..0x3b18` | if `C.right−C.left == 32000` **and** `C.bottom−C.top == 32000`: `_RectRgn(contRgn, C)`, `_RectRgn(strucRgn, C)`, done | C |
| `0x3b1c..0x3b32` | else `0x3c24(contRgn, &C)` then `0x3df8(strucRgn, &C)` | C |
| `0x3b38..0x3bd2` | if `altWidgets ∧ ¬utilityFrame ∧ hasZoom ∧ windowKind == 64`: `_GetMaxDevice` (`$AA27`) of a 1×1 rect at `C`'s top-left, compare the device's bottom − 2 with the structure bbox bottom, then `_MoveWindow` (`$A91B`). Does not change either region's shape | C (purpose I) |

## E4. Structure region `0x3df8..0x3e6a`

Args: `fp@8` = the destination region, `fp@12` = &C (modified in place).

| site | reading | mark |
|---|---|---|
| `0x3e08..0x3e0c` | `rectFrame` clear → `0x6390(rgn)` (E5) | C |
| `0x3e0e..0x3e48` | `rectFrame ∧ rectShadow`: `_InsetRect(C, −1, −1)`; `_RectRgn(rgn, C)`; `C` += (2,2) on all four edges; `NewRgn tmp`; `_RectRgn(tmp, C)`; `_UnionRgn(tmp, rgn, rgn)`; dispose | C |
| `0x3e4a..0x3e58` | `rectFrame` only: `_InsetRect(C, −1, −1)`; `_RectRgn(rgn, C)` | C |
| callers | `0x3b32` (msg 2, strucRgn), `0x2ab2`, `0x2bd4`, `0x2cc6` (msg 8 helpers on a temp), `0x2d94` (msg 8 code 32 into the caller's region) | C |

Message 8 code switch at `0x2a66` (table `0x2a6c`): 0 → `0x2a9c`, 1 → `0x2b3a`,
2 → `0x2b66`, 3 → `0x2b92`, 5 → `0x2bbe`, 6 → `0x2c98`, 7 → `0x2d0e`, 8 →
`0x2d3a`, **32 → `0x2d84`** (`0x3df8` into the `GetWindowRegionRec` region),
**33 → `0x2da0`** (`0x3c24`). **C**

## E5. Mask-traced structure `0x6390..0x6580`

| site | reading | mark |
|---|---|---|
| `0x639c..0x63a0` | chrome template `a4@(1934)` nil → return; **the region argument is not written** | C |
| `0x63a4..0x63b2` | `C` ← `0x4778`; `_RectRgn(rgn, C)` | C |
| `0x63b4..0x63d2` | `A` = rect-list type 0 (`0x6582(0)`); `B` = template bounds (`(*template)+6..+13`, `iconPMap.bounds`) | C |
| `0x63d8..0x643c` | if width(C) ≤ 1 **and** height(C) ≤ 1: rgn ← rect (top `C.t−A.t+B.t`, left `C.l−A.l+B.l`, bottom **`C.r`**`−A.b+B.b`, right `C.r−A.r+B.r`). The bottom term reads the content **right** (`d3` = `fp@(-22)`) at `0x6426`; the other three use the matching edge | C (that it is a slip: I) |
| `0x6440..0x644a` | mask region ← `0xece0(a4@(1930))` | C |
| `0x644c..0x646c` | sides 0..3; if `collapsed`: sides 0..1, or 2..3 under `sideTitle` | C |
| `0x6476..0x64a8` | per side, placed list `a4@(2140)+162·side`, template list `a4@(2788)+162·side`; entries `i = 1..N` | C |
| `0x64ac..0x64c4` | `0x5356(side, i, &src, &dst, &A, &B, &C)` — the same cell-rect routine the full draw uses at `0x5970..0x5990` | C |
| `0x64c8..0x64de` | skip when `dst` is empty (`right ≤ left` or `bottom ≤ top`) | C |
| `0x64e0..0x651a` | code 18: `tmp ← RectRgn(src) ∩ mask`; `_MapRgn(tmp, src, dst)` (`$A8FB`); `_UnionRgn(rgn, tmp, rgn)` | C |
| `0x651c..0x6542` | other codes: `0x11452(mask, rgn, &src, &dst, dir)` with `dir = 0` for codes 11 and 14, else 1 — the same direction rule as the draw's `0x59c8..0x59da` | C |
| `0x656e..0x6576` | `0xed4e(a4@(1930))`: `_HPurge` the cached mask region | C |

Template identity: `a4@(1934)` = `(*a4@(1930)).+2` (`0x355a..0x3562`); `a4@(1930)`
is the cache record `0xed70(id)` for the id chosen at `0x3344..0x3428`
(−14336 base; +32 `altWidgets`, +8 `sideTitle` or +16 when window +138 is 0;
**+1 when `drawActive`**; +8/+4/+2 `noWidgets` variants; popup −12320/−12318 by
`drawActive`). The full draw blits from the same `a4@(1934)` (`0x59b6`, `0x59e4`). **C**

Mask region `0xece0..0xed4c`: record nil or no cicn at +2 → nil. Cached region at
+60 still allocated → `_HNoPurge`, reuse. Otherwise dispose the stale handle,
`_NewRgn` in the system zone (`0x2a6`), store at +60, `0xf6e0(region, cicn)`. **C**

`0xf6e0..0xf718`: lock (`0xf30a`), `_BitMapToRegion(rgn, &(*cicn)->iconMask)`
(`+50`, the `iconMask` BitMap after the 50-byte `iconPMap`); nonzero result →
`_SetEmptyRgn`; unlock (`0xf35e`). **C**

## E6. Tiled region `0x11452..0x116f6`

Args: `fp@8` mask region, `fp@12` destination region (accumulated), `fp@16` src,
`fp@20` dst, `fp@24` direction byte.

| site | reading | mark |
|---|---|---|
| `0x1145a..0x11488` | `sw`, `sh` = src size; `tmp ← RectRgn(src) ∩ mask` | C |
| `0x1148a..0x114ac` | `sw ≤ 1` or `sh ≤ 1` → `_MapRgn(tmp, src, dst)`, union, done (the 1-px source is **stretched**) | C |
| `0x114b0..0x114ee` | dst size == src size → `_OffsetRgn` src→dst, union, done | C |
| `0x11520..0x11540` | dir 1: offset tmp so src top-left lands on dst top-left | C |
| `0x11600..0x1161a` | dir 0: offset so src bottom-right lands on dst bottom-right | C |
| `0x11542..0x11552`, `0x1161c..0x1162c` | dst narrower than src → tmp ∩ RectRgn(dst) | C |
| `0x11554..0x1159c` (dir 1), `0x1162e..0x1167a` (dir 0) | doubling loop along x: while `sw < dw`: copy = tmp (or tmp ∩ (dst less `sw` at the far end) when `2·sw > dw`); offset by `+sw` (dir 1) or `−sw` (dir 0); union into tmp; `sw ·= 2` | C |
| `0x1159e..0x115fa`, `0x1167c..0x116da` | the same along y with `sh`, `dh` | C |
| `0x116dc..0x116ee` | union tmp into the destination region; dispose | C |

Net effect: the mask of the source cell repeated at the source pitch from the
anchor corner, clipped to `dst`, on **both** axes. Other callers: `0x112b6`,
`0x11334`, `0x113b4`, `0x11430` (not traced here).

## E7. `wHit` `0x3f2c..0x41e6`

| site | reading | mark |
|---|---|---|
| `0x3f38..0x3f40` | `visible` clear → 0 | C |
| `0x3f44..0x3f66` | `_PtInRgn(point, strucRgn)` (`$A8E8`) false → 0 | C |
| `0x3f6a..0x3fb2` | ¬popup ∧ ¬collapsed ∧ grow: grow rect `0x480a` with right/bottom from the strucRgn bbox; `_PtInRect` → `drawActive ? 3 : 1` | C |
| `0x3fb6..0x3fc6` | `_PtInRgn(point, contRgn)` → 1 | C |
| `0x3fca..0x3fce` | ¬popup → widget branch `0x411c` | C |
| `0x3fd2..0x4118` | popup: result 2; no template → 2. Mask region of the template; type-5 rect (right clamped to `A.left+16`) ∩ mask, offset by `(C.l−A.l, C.t−A.t)`, point in it → 3; type-6 rect ∩ mask, offset by `(C.r−A.r, C.t−A.t)` → 3; `(C.r−15, C.b−15, C.r, C.b)` → 1 (last test wins) | C |
| `0x411c..0x4120` | `widgetFrame` clear → 1 | C |
| `0x4124..0x4128` | `drawActive` clear → 2 | C |
| `0x412c..0x41dc` | close 4 / zoom 5,6 / collapse 9 (window-widgets HT3–HT8) | C |
| `0x41e0` | otherwise 2 | C |

The only `moveq #0` results are `0x3f3e` and `0x3f64`. **C**

## E8. Content region `0x3c24..0x3df6` (context only)

| site | reading | mark |
|---|---|---|
| `0x3c34..0x3d56` | popup: `RectRgn(C)`; with a template, subtract (type-5 rect ∩ mask, offset by `(C.l−A.l, C.t−A.t)`), (type-6 rect ∩ mask, offset by `(C.r−A.r, C.t−A.t)`) and `(C.r−15, C.b−15, C.r+1, C.b+1)` | C |
| `0x3d5a..0x3d72` | collapsed: `_SetEmptyRgn`, then the region's bbox is overwritten with `C` | C |
| `0x3d74..0x3dee` | else `RectRgn(C)`; if `0x489c` (grow box in the frame, partly traced) ∧ grow: subtract the grow rect `0x480a`, or under `noWidgets` with Gestalt `'Copl'` and a `cicn` −14310 present (`0x3bdc`), the mask of `cicn` −14309 (`drawActive`) / −14310 offset to the grow rect | C |

## E9. Built-in frame (no `wnd#`)

| site | reading | mark |
|---|---|---|
| `0x125e0..0x12808` | structure: only `_RectRgn`/`_UnionRgn`/`_SetEmptyRgn` and `0x127b6` shadow; no `0xf6e0`, no `_BitMapToRegion` | C |
| `0x124d0..0x125de` | content: the only mask region (`0xf6e0` at `0x12544`), for the movable-modal grow cut-out | C |
| `0x1296a..0x129a4` | hit: `visible` clear → 0; `_PtInRgn(point, strucRgn)` false → 0 | C |
| `0x1596c..0x15a7c` | utility structure: `_RectRgn`/`_UnionRgn` only | C |
| `0x15aec..0x15b22` | utility hit: `visible`/strucRgn → 0 | C (per procedural-frame §9.9 UH1) |

## E10. Apple sources consulted

- Universal Interfaces 3.2 `MacWindows.h` (elliotnunn/UniversalInterfaces,
  `3.2/Universal/Interfaces/CIncludes/MacWindows.h`, SHA-256
  `c1fc80dc93e90c7b4036bc8bfefbf2c6d0d941a5ca1c216fdd7cc5e200d1d184`): `wNoHit`
  0 … `wInCollapseBox` 9 (lines 420–428); `inDesk`/`inNoWindow` 0 (400–401);
  `wCalcRgns` 2 (470); `kWindowStructureRgn` 32, `kWindowContentRgn` 33
  (336–337); procIDs 1024–1046 (219–244); `floatProc` family 1985–1999.
- Inside Macintosh: Macintosh Toolbox Essentials, ch. 4, "FindWindow"
  (developer.apple.com archive `Toolbox-242.html`): FindWindow "might return
  [inDesk] if, for example, the user presses the mouse button while the cursor
  is on the window frame but not in the title bar, close box, or zoom box."
- Same chapter, "Defining Your Own Windows" (Dev.CD mirror
  `imWindowMgrRef.20.htm`): "The return value wNoHit might mean (but not
  necessarily) that the point isn't in the window"; on `wCalcRgns`, "you
  calculate the window's structure and content regions … in global coordinates".
- Same chapter summary (`Toolbox-296.html`): `wCalcRgns` "calculate strucRgn and
  contRgn".
- Inside Macintosh Volume I, "The Window Manager" (FindWindow, window regions,
  "Defining Your Own Windows"): listed as a source to consult for U1; **not
  re-read in this lane**, so nothing in the spec rests on it.

None of these pages states FindWindow's search order or whether it tests
`strucRgn` before sending `wHit`.
