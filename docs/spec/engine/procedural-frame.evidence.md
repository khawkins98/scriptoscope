# Evidence: built-in window frame (`procedural-frame.md`)

**Verifier-only. Implementers must not open this file.**

Listing: `/Users/khawkins/Documents/git/aaron-ui/.scratch/k231-kdef/kDEF/k231-kdef0.asm` (objdump m68k:68030 of `id-0-680x0_DefProcs.bin`, sha256 `2c027276…7c342`). Listing addresses equal file offsets.

**Tooling notice (revision 2).** The first revision was produced with agent-written annotation, jump-table and re-disassembly helpers. Under the updated V2-BRIEF rule, those helpers are withdrawn and must not be rerun. Every table value cited below can be checked by hand from the raw listing. Each dense jump table entry is a signed word added to the table's address. The `0x148` sparse switch layout is default offset, low, high, count − 1, then (value, offset) pairs, with each offset relative to its own word. Trap names come from a by-hand lookup in Universal Interfaces 3.0.1 `Traps.h`. The independent verifier (v2-lanes/L7/REVIEW.json) re-derived the results that way. The maintainer's annotated listings in `v2-lanes/L1/annotated/` are the reference index.

## E0. Conventions used to read immediates

- **Pascal traps** (InsetRect, OffsetRect, PenSize, MoveTo, LineTo) push arguments left to right. A `movel #imm,-(sp)` that stands for two 16-bit arguments therefore has the **later** argument in the high word. For example InsetRect `#0x0000FFFA` gives dv = 0, dh = −6, and InsetRect `#0x00030004` gives dv = 3, dh = 4.
  - Cross-check: every structure/title/ring formula derived this way agrees, e.g. doc structure L/R outset 6 = title-bar L/R outset 6, ring outer = structure. Under the opposite reading the title bar would be 6 px narrower than the structure, and kind 5's title and ring would not meet.
- **C helpers** (`0xfc5c`, `0xf9f6`, `0x10282`) push right to left, so the high word is the **earlier** argument. `0xfc5c(cicn, #0x00060003, &out)` gives x = 6, y = 3.
  - Confirmed by `0xfa8a`: its first word argument `fp@(12)` is used as a bit index (`andiw #7` / `asrl #3`), so it is x. Its second, `fp@(14)`, multiplies rowBytes, so it is y.
- **`0x10282(cicn, &src, h, v)`** offsets src by (h − src.left, v − src.top) and calls `0xfdf8`. `0x102d0` does the same, then calls `0x10320`.
- **WindowRecord offsets:** 110 visible, 111 hilited, 112 goAwayFlag, 113 spareFlag, 114 strucRgn, 118 contRgn, 130 dataHandle, 108 windowKind.
- **GrafPort offsets** (relevant at `0xf4ba`): 68 txFont, 92 picSave, 104 grafProcs.
  - Side note for the reference maintainer: `kdef231-reference.md` calls `port+92` "grafProcs" in the 0xfeae prose. In GrafPort layout, 92 is picSave and 104 is grafProcs. This was not re-traced at 0xfeae.

## E1. Gate and dispatch

```
118e4 movel #'wnd#' ; 118ea movew #-14336 ; 118ee _GetResource ; 118f8 beqs 11916
118fa..11906 push varCode,handle,msg,param ; bsrl 0x28e0 (slot 6)
11918 movel #'WDEF' ; 1191e movew #-14330 ; 11922 _GetResource ; 11928/1192e beqw 11c58 (null or empty)
11a3c movel a3@,d0 ; _StripAddress ; jsr a0@          ; call the scheme WDEF
11c58 bsrl 0x104 (globals) ; 11c6a..11c7a save window/varCode/param/msg to a4@(86/90/92/96)
11c80 bsrl 0x11ee2 (setup) ; 11c8a cmpiw #8 ; table @0x11c9a
```

The word table at 0x11c9a gives 0→0x11cac, 1→0x11cb6, 2→0x11cc8, 3→0x11cd2, 4→0x11cdc, 5→0x11ce6, 6→0x11cf0, 7→0x11cfa, 8→0x11d7e. The callees are 0x12b88, 0x1295e, 0x12486, 0x122c6, 0x123f0, 0x1280a, 0x14286, (inline), and `bsrl 0x148` with the table at 0x11d8c.

The sparse switch at 0x11d8c gives default 0x11ec2; cases 0→11db4 (0x1469a), 1→11dcc (0x14784 + InsetRect `#0xFFFF0000` = dv −1), 2→11df0 (0x148a2), 3→11e08 (0x1496c), 6→11eae (0x1499a), 7→11e20 (0x14904), 32→11e38, 33→11e8e.

The features word is built at 11cfa–11d60: `a4@103?2`, `104?1`, `171?4`, `118?64`, `168?8`, `|16`, `|0xF80`. These match the Appearance feature constants (zoom/grow/collapse/title-bar/modal/get-region), which is how the flag meanings in spec §3.1 were pinned.

Utility gate: 1525a…152a2 (`wnd#` -14304 only, msg + 1984 → 0x28e0; there is no `WDEF` lookup, unlike slot 3); 152be…152f8; the word table at 0x152fc gives 1530e…1538a. Get-region switch: the sparse switch at 0x15396.

Reachability: every routine the spec cites was reached by manual trace from the gate. Whole-region reachability is per the maintainer index (`v2-lanes/L1/annotated/index.json`). That index lists 64 routines in 0x11ee2–0x1525a (62 pc-relative, 1 relocated, 1 unreached) and 40 in 0x1525a–0x17452 (38 pc-relative, 1 entry, 1 relocated). Its one "unreached" routine is 0x12dc0, which is reached through a jump table the listing misaligns. The raw listing line `12da2: 000c` starts a word table 000c 0014 0014 0014 000c 0014 for kinds 0–5. Kinds 0 and 4 go to 0x12da2 + 0x0c = 0x12dae, whose bytes `61ff 0000 0010` (inside the misaligned `12dac: 0014 61ff` / `12db0: 0000 0010` lines) are a bsr.l to 0x12db0 + 0x10 = 0x12dc0.

## E2. Setup 0x11ee2 (spec §3.1, §3.2)

- Flags: 11ef2 `andiw #32` → a4@167; 11f02 `#16` → 166; 11f12 `#64` → 104; 11f22 `andiw #15,a4@(90)`; 11f2c `&7` → 98; 11f38 `&8` → 103; 11f48 kind 0 → 104 = 1; 11f54 kind 5 → 102; 11f62–11f78 118 (titled); 11f7c–11f8c 171; 11f94–11fa4 168.
- Gestalt `qd  ` ≥ 0x100 → a4@105 colour QD (11faa–11fcc).
- Port: GetPort, GetWMgrPort, GetGDevice, GetCWMgrPort, port-state copy, PenPat/BackPat/ForeColor(33)/BackColor(30), GetForeColor/GetBackColor saved, PenNormal (11fda–120be).
- Text: TextFont(0)/TextSize(0)/TextFace(0) (120c8–120d2); GetFontInfo → a4@106.
  - 120da: H = asc + desc + 6.
  - 120e8–120f6: `divsw #2; swap; tstw; bnes` → if the remainder is 0, H −= 1.
  - 120fa–12116: H < 22 → asc += (22 − H)/2 (the `lsrw #8; lsrw #7; add; asrw #1` idiom = signed halve toward 0), H = 22.
  - 1211c–1212c: a4@112 = (H − 11)/2. Written, never read in this module (grep).
- Gestalt `Copl` → a4@136 (the scheme's resource refnum, used by 0x14be4 / 0x17430 UseResFile).
- Gestalt `Aarn` → 144; 138 = resp & 1. Gestalt `Aarp` → 140; 139 = (resp & 2) && Aarp[6].
- 121aa–1226a: narrow-window suppression, via SectRect of zoom (fp−28) / collapse (fp−44) against close (fp−16).
- 12268–1227a: GetWTitle, StringWidth → a4@172.
- a4@169 is cleared at 11eee and never set anywhere in the binary (grep of `a4@(169)`), so the "+20" title widening needs the proxy icon (0x14ab2).

## E3. Geometry (spec §3.3)

- **0x14620:** msg 5 → param rect. Otherwise portRect offset by −bounds.topLeft (pixmap bounds if rowBytes < 0, else portBits.bounds) → global content.
- **0x125e0:**
  - `pea 0xffffffff; InsetRect` (outset 1). Switch: the word table at 0x12618 (0/4→12624, 1→126c0, 2→1268c, 3→12696, 5→12650).
  - 12624: InsetRect `#0xFFFBFFFB` (−5, −5); top −= H − 6; RectRgn; `0x127b6`.
  - 12650: !166 → `#0xFFFDFFFD`; `#0xFFFEFFFE`; top −= H − 1; 0x127b6.
  - 12696: RectRgn, rect +2 all, RectRgn, UnionRgn.
  - 126c0: as 12650 without the top change.
- **0x127b6:** bbox; right −1, bottom −1, all +2; RectRgn; UnionRgn.
- **0x126fc** (collapsed):
  - rect = C; InsetRect `#0x0000FFFA`; bottom = top; top −= H.
  - Gestalt `WdrB`, then `cont.top − struc.top == 22 + H` → bottom += 5.
  - StrucRgn = rect + shadow; contRgn empty; content bbox = degenerate at the top.
- **0x1469a:**
  - EmptyRgn(struc) false and Gestalt `WdrB` ok → struc bbox path (14712).
  - Kind 5: !166 InsetRect `#0xFFFDFFFD`; `#0x0000FFFD`; bottom = top − 2.
  - Otherwise `#0x0000FFFA`; bottom = top.
  - top = bottom − H.
- **0x148a2:**
  - h = T.b − T.t + 1; top = T.t + (h − 13)/2 − 1, stored to a2@0 (the rect's top).
  - a2@4 = top + 13; a2@2 += 4 (left = T.l + 4); right = left + 13.
  - Then right = left + 16, bottom = top + 16.
- **0x14904:** same vertical; left = T.r − 17 (`moveq #-17; add a2@(6)`).
- **0x1496c:** 0x14904, then if 0x14b40 → −16 on left/right.
- **0x1499a:** C; top = b − 16, left = r − 16; +1 on all four, +1 on right/bottom again. 102 && !166 → +3.
- **0x14784 / 0x1480c / 0x14848 / 0x1473a:** as in spec. 0x14848 tests `a4@(90) & 8` directly (14852), not the suppressed a4@103.
- **0x124d0:** RectRgn(C); 0x14b5e && 104 → grow region (kind 5: cicn −14309/−14310 via 0x10472 → `0xf6e0` mask region → OffsetRgn, else the OpenRgn polygon 12564–125c0; otherwise RectRgn); DiffRgn.

## E4. Document frame 0x12dc0 (spec §4)

- 12dc8–12df8: fp−16 = struc bbox with right/bottom −1; fp−8 = cont bbox.
- 12dfc–12e18: hilited → 0x10472(−14332) else (−14336). 12e24 null → exit.
- 12e28–12e58: 0xf078 (collapsed) → Gestalt WdrB / height test → skip to 12fb6.
- 12e5c: fp−8.top = struc.top + H.
- 12e68–12e9e: src (t0? see note) `fp−24..−18` = (top 10, left 0, bottom 16, right 6), dest (h = L, v = B − 6) → 0x10282.

  Note on src layout: fp−24 = top, −22 = left, −20 = bottom, −18 = right. The writes are `clrw −22` (left 0), `#10 → −24` (top 10), `#6 → −18` (right 6), `#16 → −20` (bottom 16).
- 12ea4–12ed2: src (10, 10, 16, 16), dest (R − 6, B − 6).
- 12ed8–12eee: GetPort; save txFont (port + 68); set −12345.
- 12ef0–12f3c, i < 6: `0xf9f6(F, 6, 15 − i, 0)`; MoveTo(L + 6, B − 1 − i); LineTo(R − 7, B − 1 − i).
- 12f3e: restore txFont.
- 12f48–12fb4, i < 6:
  - `0xf9f6(F, i, 6, 0)`; MoveTo(L + i, content.top); LineTo(L + i, B − 7).
  - `0xf9f6(F, 15 − i, 6, 0)`; MoveTo(R − 1 − i, content.top); LineTo(R − 1 − i, B − 7).
- 12fb6–12fe6: `0xf9f6(F, 0, 0, 0)`; MoveTo(L + 2, B); LineTo(R, B); LineTo(R, T + 2).
- 12fe8: 0x106ae release. 12ff0–1301a: !collapsed && 0x14b5e → 0x1499a, 0x144f2.

Here L = struc.left, R = struc.right − 1, B = struc.bottom − 1 (bbox including the shadow) = C.r + 6 / C.b + 6.

## E5. Title bar 0x1380e (spec §5)

- 1382c–138dc: NewGWorld (`QDExtensions` with `#0x00160000` + pea 6), LockPixels/GetGWorld/SetGWorld, text state copied.
- 138e0–1394e: d5 (box mode).
  - Kind 0/4: collapsed → (WdrB fails → 1 at 1390c; WdrB ok and content.top − structure.top == H → 1 at 1392e; else 0); not collapsed → 0 (138fa). The first revision's spec prose inverted the WdrB case; this line was already correct.
  - Other kinds: 1.
- 13938–13986: art id (−14332/−14336; kind 5: 0x14c64 ? −14322/−14326 hilited, −14324/−14328 not).
- 1399a: 0xfc5c(F, `#0x00060003`, a4@154); 139ac `#0x00070003` → 148; 139be `#0x00090003` → 160.
- Corner blits (src fp−16 top, −14 left, −12 bottom, −10 right):
  - 139d0 (0, 0, 4, 4) @ (T.l, T.t)
  - 139f8 (0, 12, 4, 16) @ (T.r − 4, T.t)
  - 13a2e (12, 0, 16, 4) @ (T.l, T.b − 4)
  - 13a5c (12, 12, 16, 16) @ (T.r − 4, T.b − 4)
  - 13a96 (3, 4, 6, 6) @ (T.l + 4, T.b − 3)
  - 13aca (3, 10, 6, 12) @ (T.r − 6, T.b − 3)
- 13b02–13b14: d4 = d5 ? T.b − 5 : T.b − 1.
- 13b16–13b8c, i < 4: `0xf9f6(F, i, 6)`, column T.l + i rows T.t + 4..d4; `0xf9f6(F, 15 − i, 6)`, column T.r − 1 − i.
- 13b8e–13c5c, i < 3: `0xf9f6(F, 6, i)` row T.t + i cols T.l + 4..T.r − 5. Then d5 ? (`0xf9f6(F, 6, 15 − i)`, row T.b − 1 − i, cols T.l + 4..T.r − 5) : (`0xf9f6(F, 6, 5 − i)`, row T.b − 1 − i, cols T.l + 6..T.r − 7).
- 13c6a: InsetRect `#0x00030004`; RGBForeColor(a4@154); PaintRect; InsetRect `#0xFFFDFFFC`.
- 13c8e proxy (0x14ab2 → 0x14020); 13ca2 title 0x13ee8; 13ca8 hilited → 13cac stripes 0x13d98, close/zoom/collapse 0x1414a(n, 0).
- Note: 13996 `beqw 0x13c6a` skips the frame when F is null but still runs the PaintRect.

**Title text 0x13ee8:**

- CurResFile/UseResFile(0).
- Clip = SectRgn(clip, RectRgn(T with left = 0x1480c, right = 0x14848)).
- Title rect = 0x14784 then InsetRect `#0x0000FFFD`.
- x = rect.left + 3 (or + 23 with proxy).
- y = rect.top + (h − (asc + desc))/2 + asc (a4@106 = adjusted ascent).
- 13fb8–13fd4 compares 148 with 160 (three words). If they differ: MoveTo(x + 1, y + 1), RGBForeColor(160), DrawString.
- Then RGBBackColor(154), RGBForeColor(148), DrawString.

**Stripes:**

- 0x13d98: fp−8 = T with top = close.top, bottom = top + 13, left = 0x1480c. Title rect non-empty → right = title.left − 3, call; left = title.right + 3. right = 0x14848, call.
- 0x13e22:
  - width ≤ 7 → exit.
  - id = 102 ? (0x14c64 ? −14321 : −14325) : −14331.
  - `0x10440` = `_GetPixPat(id)` → `0xf930(&rect, ppat, left, top)` (SetOrigin-anchored fill) → DisposPixPat.
  - `_Get1Resource('cicn', id)` → 0x10472(id) → src = iconPMap.bounds → `0xb44c(cicn, &src, &rect, 1, 0, 1, 1)`.
- 0xb44c (b4d2–b614):
  - Equal size → one 0xb31e.
  - Horizontal (fp20 = 1), cap mode 1 (fp26 = 1 → fp−25 = 1): d7 = min(srcW, dstW), half = d7/2.
  - Left: src.right = src.left + half, dst.right = dst.left + half.
  - If d7 < dstW, middle: src column [src.left + half, +1), dst [dst.left + half, dst.right − (d7 − half)).
  - Right: src [src.right − (d7 − half), src.right) → dst [prev, dst.right).
  - 0xb31e: 1-px-wide src with matching heights → per-row `0xf9f6(…, 1)` (mask checked) + MoveTo/LineTo; 1-px-tall with matching widths → per-column; else 0x10320.

## E6. Dialog frames (spec §5A)

- 0x1353a: art per E5. `0xfa2a(D, 0, 0)` → RGBForeColor = P(0, 0). 102 → 0x1302a; `(a4@90 & 3) == 1` → 0x133ac; else 0x134a2. Release.
- 0x135e2:
  - r = C; 166 ? InsetRect `#0xFFFEFFFE` : `#0xFFFBFFFB`.
  - Corners (src fp−20 top, −18 left, −16 bottom, −14 right): (5, 5, 8, 8) @ (r.l − 1, r.t − 1); (5, 8, 8, 11) @ (r.r − 2, r.t − 1); (8, 5, 11, 8) @ (r.l − 1, r.b − 2); (8, 8, 11, 11) @ (r.r − 2, r.b − 2).
  - Loop i < 3, txFont = −12345:
    - `(D, 5 + i, 7)` column r.l − 1 + i rows r.t + 2..r.b − 3
    - `(D, 10 − i, 8)` column r.r − i
    - `(D, 7, 5 + i)` row r.t − 1 + i cols r.l + 2..r.r − 3
    - `(D, 8, 10 − i)` row r.b − i
- 0x1302a / 0x133ac:
  - Shadow (13050–13074 / 133e8–1340c); 0x135e2.
  - !166: region = RectRgn(C) inset `#0xFFFDFFFD` minus C. Colour port → `0x10768(auxWin ctab, 0)`, else RGBForeColor(a4@186 white). PaintRgn.
  - 0x1302a then 0x14b5e → 0x13124.
- 0x134a2: varCode == 3 → right/bottom −2; FrameRect; shadow lines 134da–13534.
- 0x14c64: rows as in the spec table. `'actb'` = `#1633907810`; `0x10702(ctab, 0, &rgb)` on both, then three-word compare. 0xf048 = auxWin byte 17 bit 4.

## E7. Widgets, grow, proxy (spec §6)

- **0x1414a(which, pressed):** 0 → 0x148a2, pressed ? −14333 : −14336; 1 → 0x1496c, −14331 : −14334; 3 → 0x14904, −14332 : −14335. Fore black (a4@192), back white (a4@186), SetZone(system), `0xf4ba(&rect, id)`.
- **0xf4ba:**
  - `_GetResource('ics#')` (`#1768125219`) required.
  - Mask all-ones test f52e–f550.
  - Mono/non-colour → 1-bit; else HomeResFile + `_Get1Resource('ics8')` (`#1768125240`).
  - 1-bit path (f5dc–f5f0): mask all ones, picSave (port + 92) non-nil, or grafProcs (port + 104) non-nil → CopyBits; else CopyMask.
  - ics8 path (f630–f63c): mask all ones or picSave non-nil → CopyBits; else CopyMask. grafProcs is not tested.
  - No `ics4` type code appears in the routine.
- **0x141fc:** IconDispatch `#1549` = 0x060D with ids −14336 / −14334 / −14335.
- **0x144f2:** 102 → 0x13124. Hilited → 0x10472(−14330) else (−14334). `0x102d0(cicn, &bounds, g.left, g.top)`.
- **0x13124:**
  - cicn −14309 / −14310 → 0x102d0.
  - Else OpenRgn polygon 13192–131ec. `0x106ca` = `_GetResource('clut')` (`#1668052340`) id hilited ? −14336 : −14335.
  - `0x10786(ctab, 1)` → EraseRgn.
  - Hilited: `0x10768(ctab, 6)` lines 13240–132e0; `0x10768(ctab, 5)` / `0x10786(ctab, 5)` lines 132fa–1339a.
- **0x14286 (msg 6):** visibility/titled/collapsed gates; 102 → 0x13124. Port; 0xfa2a(frame cicn, 0, 0). MoveTo(port.l, port.b − 15) LineTo(port.r, port.b − 15); MoveTo(port.r − 15, port.t) LineTo(port.r − 15, port.b − 15). Record byte 24 = 1 and a grow cutout when 0x14b5e is false (14400–14442). 0x14474 → clip strucRgn + ClipAbove → 0x144f2.
- **0x122c6 (msg 3):** NewHandle(36) → dataHandle.
  - zoom → spareFlag = 1, std state = screen rect (low-mem 0x9de) inset (9, 9), top += menuBar + H → record[8..15]; 0x14620 → record[0..7].
  - Titled && !movable: record[20] = record[32] = `Aarn`, record[24] = 0, [26] = 0, [30] = 0.
  - Zoom && grow && CurApName set && GetProcessInformation (OSDispatch 58) type `FNDR` / creator `MACS` → [24] = 1.
- **Proxy icon:**
  - 0x14ab2 → 0x149f4: Aarp option, low-mem 0x910, GetProcessInformation, windowKind 20, titled non-movable, 0x14da0 (GetWRefCon) → 0x15188 == `HFS `.
  - 0x14020: Gestalt `Aaru`, record[26] suite, transform 0x4000 / 1 + label << 8, title "Now " check, IconDispatch `#1539` = 0x0603.
  - 0x123f0: IconDispatch `#770` = 0x0302 on record[26].
  - IconDispatch selector names are not checked against a local `Icons.h` (none was found). The behaviour claims in the spec do not depend on them.
- **Hit 0x1295e:** see spec §6.3. The exact-pixel tests use the title rect that 12a1e fills from 0x1469a: (T.l + 16, T.t + 12) at 12a5c–12a72 for close and (T.r − 16, T.t + 12) at 12aa8–12abe for zoom. The first revision wrongly made them relative to the close and zoom rects. The drag region is 12af8–12b66: struc bbox right/bottom −1, InsetRgn `#0x00060006`, DiffRgn, ∪ title bar with bottom + 1.

## E8. Utility family (spec §9)

- 1547e–154d8: flag bits.
- 155e8–155f8: TextFont(1), TextSize(10), TextFace(1).
- 15600–15634: H = 13 / 15 / 13.
- 17048: InsetRect `#0x0000FFFC` (dh −4) or side `#0xFFFC0000` (dv −4). Bottom = top (right = left); top = bottom − H − 1.
- 17258 / 172e2: (h − 10)/2 centring, +2 from start, −12 from end, 10 × 10.
- 17378: −11 when a4@1158.
- 16d14–16d4c: rect right/bottom = +16, 0xf4ba.
- 16cb8–16d0a: widget ids.
- 15e20–15e64: frame ids (d3 = active per the preceding call; not re-traced, so marked moderate).
- 1694c–16978: stripes.
- 173b4: grow 15 / 11.
- 16e1e–16f12: grow ids; scale ×11/15 at 16ec0–16ef0.
- 1740e: "draw active" = hilited || a4@1145 (variation bit 0 clear).
- 17128–1713c: TextFace(33) retry.

## E9. Corpus check (spec §8)

Commands were run against the root checkout's locally baked bundles (gitignored, 2026-10-18 bake):

- `extraction-manifest.json` per bundle: types `wnd#`, `WDEF`, `cicn`, `ppat`, `ics#`, `ics4`, `ics8`, `clut`, `actb`, ids −14340..−14280, with cicn sizes.
- PIL sampling of `cicns/*.png` for −14332 / −14336 at (6, 3), (7, 3), (9, 3), (0, 0), (0..5, 6).

The scripts were inline; re-run them from the spec's tables. The `wnd#` / `WDEF` absence holds for exactly the five bundles named in the spec.

## E10. Verifier checklist (mutation probes to try)

1. Flip the InsetRect word order (E0). Doc title width ≠ structure width → the spec's §3.3 table becomes self-inconsistent.
2. Re-derive `0xfc5c` (x, y) order (E0). For platinum-8 −14336 the decoded text pixel (7, 3) is `#444444` and the shadow (9, 3) is `#ffffff`. Under the swapped reading, (3, 7) and (3, 9) are both `#c6c6c6`, identical to the fill, so the title would be invisible. Prefer the decoded order.
3. Confirm 0x1414a's id pairs against 0x141fc's (the hit test uses −14334 for zoom, −14335 for collapse).
4. Confirm that no `ics4` immediate (`#1768125236`) exists anywhere in kDEF 0. A grep of the listing returns 0 hits.
5. Confirm 0x13e22 calls `_Get1Resource('cicn')` (scheme file only) before 0x10472.
