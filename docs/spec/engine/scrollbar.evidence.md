# `scrollbar.draw` — evidence appendix (verifiers only; implementers never open this file)

Listing: `.scratch/k231-kdef/kDEF/k231-kdef0.asm` (root checkout, gitignored),
SHA-256 `6372c10fff5fb1120bc091978d58d8161e1550e0c6d406ccdf611bda2fae902d`,
disassembly of `id-0-680x0_DefProcs.bin` SHA-256
`2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` (107,726 B).
Addresses are file offsets. Line numbers are listing lines. Writer: v2 lane L5,
2026-10-21. The **verifier** column is for the independent verifier
(CONFIRMED / REFUTED + note); it is blank until then.

Conventions below: the per-message state block is the 78-byte frame record
built by the CDEF entry (`fp@(-78)` of `0x997e`) and passed to every handler as
`a2`/`a3` ("blk"). blk+0 control handle, blk+4 ControlPtr (`*h`), blk+8
message word, blk+10 param. ControlRecord (IM): +4 contrlOwner, +8 contrlRect
(top 8, left 10, bottom 12, right 14), +16 contrlVis, +17 contrlHilite, +18
value, +20 min, +22 max, +28 contrlData. CIcon: iconPMap.bounds at +6..+13,
maskBMap at +50. "blkNN" = byte/word at blk+NN.

## E0. Entry point: slot 1 `0x997e`, not slot 5 `0x8d36`

| addr | fact | verifier |
|---|---|---|
| `0x1cc4..0x1cca` | `lea 0x997e,%a0; movel %a0,%a2@(4)` — service slot 1 | |
| `0x1cec..0x1cf2` | `lea 0x8d36,%a0; movel %a0,%a2@(20)` — slot 5 | |
| `0x997e..0x99c8` | `linkw #-78`; builds blk (handle, `*h`, msg, param) at fp-78; `bsrl 0x9d84` (state) at `0x99bc`; `bsrl 0x148` dispatch at `0x99c8` | |
| `0x99ce..0x9a12` | switch table: default `0x0214`→`0x9be2`, range 0..0x80, 15 entries: 0→`0x9a12`(`0xa2b6`), 1→`0x9a26`(`0xa506`, then `0x1c46`), 2→`0x9a4c`(`0xa1fe`), 3→`0x9a60`(`0xa1ce`), 4→`0x9a70`(`0xa1e8`), 5→`0x9a80`(`0x1c16`,`0xa678`), 6→`0x9ab0`(`0xa808`), 10→`0x9ac4`(`0xa248`), 11→`0x9ad8`(`0xa26e`), 13→`0x9b1a`(`0xbf5c`), 19→`0x9af6`, 26→`0x9b2e`(`0x9c06`), 27→`0x9aec` (`movel #0x206f6b20` = `' ok '`), 34→`0x9b42`, 128→`0x9a9c`(`0xbcf0`). Offsets are relative to each offset word (helper `0x148`: `addaw %a0@,%a0; jmp`) | |
| `0x9af6..0x9b16` | getFeatures: `btst #1,%fp@(19)` → 0x400; `oriw #1`; `oril #0x2000` | |
| `0x9b42..0x9be0` | msg 34: switch on part word (20,21,22,23,129): 20/21 by sub-index 1..4 → `sbap`/`sbae`/`sbax`/`sbar` (`0x9b80..0x9ba4`); 22/23 → `sbtp` only for sub-index 1 (`0x9ba8..0x9bb2`); 129 → `sbth` if varCode bit 1 else `sbgh`, only for sub-index 5 (`0x9bbc..0x9bda`) | |
| `0x9be2..0x9be6` | every message ends with `bsrl 0xa196` (dispose blk58 region, blk62 cicn `$AA25`, blk68 ppat `$AA08`) | |
| `0x9d84` callers | only `0x99bc` (grep `0x9d84`) | |
| `0x8d36..0x991e` | slot 5 body: msg-1 handler `0x8da4..0x8dda` returns 254 or `moveq #10` (part 10); msg 34 `0x98ca..0x990a` writes `'bevp'` (0x62657670) and patches its last byte to `e`/`x`/`r`. No call to `0x9d84`, `0xa2b6`, `0xaed6`, `0xc338` from this range (grep of `bsrl`/`jsr` targets) | |

## E1. Per-message state `0x9d84..0xa194` (spec §2 derived state, §4.1–§4.4)

| addr | instruction(s) | meaning | verifier |
|---|---|---|---|
| `0x9d90..0x9db4` | Gestalt `$A1AD` `'apvr'`; `cmpil #272` (0x110); blk76 = 1 if ≥ | apvr ≥ 1.1 | |
| `0x9db8..0x9dcc` | `clrb` blk48, blk49, blk18, blk19, blk74, blk75 | defaults clear | |
| `0x9dd0..0x9e18` | Gestalt `'Acid'` (0x41636964); on noErr copy response+31→blk48, +27→blk49, +33→blk18, +34→blk19, +32→blk74, +36→blk75 | option bytes | |
| `0x9e1e` | `clrb %a2@(77)` | blk77 cleared; the only write to +77 in the CDEF (grep `(77)`: writes only here; reads at `0xa086 0xa0d8 0xa484 0xa4a0 0xa54a 0xa5b2 0xb098 0xb0b4 0xb120 0xb1e6 0xb294 0xbc30 0xbc5a 0xc54a 0xc6b0`) | |
| `0x9e22..0x9e2a` | `bsrl 0xadfe` → blk21 | horizontal | |
| `0x9e2e..0x9e36` | `bsrl 0xbc92` → blk22 (word) | thickness | |
| `0x9e3a..0x9e42` | `bsrl 0xada2` → blk20 | disabled | |
| `0x9e46..0x9e60` | if blk20 or blk48 or hilite==0 → `clrb` blk75 | pressedSideOnly gate | |
| `0x9e64..0x9e7a` | if blk20 or !blk48 or hilite==0 → `clrb` blk74 | pressedHalves gate | |
| `0x9e7e..0x9eb8` | if blk18: `lslw #3` of blk22; along length (h: right−left, v: bottom−top); `bges` keep else `clrb` blk18 | double needs length ≥ 8t | |
| `0x9ebc..0x9ef2` | PSN from `a4@(362)`; `$A88F` selector `#58` (GetProcessInformation), info length 60; signature at info+20 (`fp@(-44)`) `cmpil #0x4d414353` ('MACS'); else `clrb` blk19 | Finder process | |
| `0x9ef6..0x9f0a` | owner window (`contrlOwner`) nil or `cmpiw #20,%a3@(108)` (windowKind) ≠ → `clrb` blk19 | windowKind 20 | |
| `0x9f0e..0x9f38` | `movew #-10204` blk28, `-10200` blk30, `-10203` blk36, `-10199` blk38, `-10202` blk24, `-10198` blk26, `-10201` blk32, `-10197` blk34 | icon id table | |
| `0x9f3e..0x9f58` | Gestalt `'Copl'`; noErr → blk40 = low word of response (`fp@(-86)`), else blk40 = -1 | resource start | |
| `0x9f5e..0x9f74` | Gestalt `'Aarp'`; noErr → blk46 = response ptr +16 | drag pattern option | |
| `0x9f7a..0x9f8a` | `clrb` blk47; `cmpib #-2,%a0@(17)` → blk47 = 1 | hilite 254 inactive | |
| `0x9f90..0x9fd6` | hilite 255 → Gestalt `'appr'` noErr → `$AA73` selector 21 (GetSuperControl) noErr, parent ≠ nil → `$AA73` selector 5 (IsControlActive) on parent returns 0 → blk47 = 1 | inactive parent | |
| `0x9fdc..0xa000` | blk50..57 = bbox of contrlData region (`*rgn` +2..+9) | previous thumb rect | |
| `0xa006..0xa00e` | blk58 = NewRgn `$A8D8` | drawn-thumb region | |
| `0xa012..0xa01a` | `bsrl 0xbcc6`: CurResFile `$A994`, UseResFile `$A998` (blk40) unless -1; old file saved, restored at `0xa18a..0xa18c` | resource start | |
| `0xa01c..0xa030` | d4 = 1 if hilite ≠ 0 and `cmpib #-2` `bccs` (unsigned < 254) | pressed | |
| `0xa032..0xa03e` | d3 = blk21 ? `#-8288` : `#-8280` | base | |
| `0xa042..0xa05e` | blk47 → 0; blk20 → 1; pressed → 3; else 2 | tier | |
| `0xa060..0xa070` | `clrb` blk73; `clrl` blk62, blk68; blk66 = d3 + d4 | trackId | |
| `0xa074..0xa07c` | `cmpiw #11` blk22; `bgts 0xa0cc`; `addiw #18,%d3` | small path | |
| `0xa080..0xa0a8` | if blk18 or blk77: GetCIcon `$AA1E`(d3+d4+4); hit → blk66 += 22, blk73 = 1 | TR6 | |
| `0xa0ae..0xa0c2` | if blk62 nil: GetCIcon(d3+d4) → blk62; `addiw #18` blk66 **unconditionally** | TR7 quirk | |
| `0xa0c8` | `subiw #18,%d3` | | |
| `0xa0cc..0xa0f8` | if blk62 nil and (blk18 or blk77): GetCIcon(d3+d4+4); hit → `addqw #4` blk66, blk73 = 1 | TR8 | |
| `0xa0fe..0xa10e` | if blk62 nil: GetCIcon(d3+d4) → blk62 (blk66 unchanged) | TR9 | |
| `0xa112..0xa14a` | GetPixPat `$AA0C`(blk66) → blk68; nil and blk73 → GetPixPat(blk66−4); nil → GetPixPat(d3+d4) | TP1–TP3 | |
| `0xa14e..0xa184` | `clrb` blk72; if blk62: bounds = `*cicn`+6..+13; `cmpiw #16` on width and height, `bgts` → blk72 = 1 | composite | |

Helpers:

| addr | fact | verifier |
|---|---|---|
| `0xadfe..0xae1c` | `(right−left) > (bottom−top)` `sgt` | |
| `0xbc92..0xbcc4` | blk21 ? bottom−top : right−left of contrlRect | |
| `0xada2..0xadfc` | hilite `cmpib #-2` `bcss` else 1; blk76 → `0x996c` (reads +20) vs `0x995a` (reads +22), equal → 1; else `cmpw` +20/+22 equal → 1; else 0 | |
| `0x9938`, `0x995a`, `0x996c` | `moveaw` of ControlRecord +18 / +22 / +20 (sign-extended 16-bit). Without blk76 the proportional path `0xac8e..0xaca4` forms max−min with `subw` (16-bit, wraps above 32767) before `extl` | |
| `0xbcc6..0xbcee` | CurResFile; UseResFile(blk40) unless -1; returns old | |

## E2. Draw `0xa2b6..0xa502`

| addr | fact | verifier |
|---|---|---|
| `0xa2be..0xa2c2` | d3 = draw part (param low word, pushed at `0x9a16`) | |
| `0xa2cc..0xa322` | part 22/23 with hilite 0 and process signature `'ALFA'` (0x414c4641, `$A88F` sel 58 on `a4@(354)`) → ClipRect(portRect) `$A87B` | process-specific clip quirk, no selection effect | |
| `0xa324..0xa360` | contrlVis 0 → exit; EmptyRect `$A8AE`(contrlRect) → exit; port pnVis (+66) < 0 and picSave (+92) nil → exit; EmptyRgn `$A8E2`(visRgn +24) → exit | guards | |
| `0xa364..0xa376` | d4 = NewRgn; RectRgn `$A8DF`(contrlRect) | | |
| `0xa378..0xa398` | part 0 with hilite ≠ 0 → part = hilite; 254/255 → 0 | | |
| `0xa39a..0xa3d8` | part 129: EmptyRgn(contrlData) before and after `0xa97c`; differ → part 0 | | |
| `0xa3ae..0xa3be` | `cmpiw #26` blk8; ≠ → `bsrl 0xa97c` | thumb recompute (not on msg 26) | |
| `0xa3da..0xa408` | GetClip `$A87A` → a3; part 129, hilite 0, EmptyRgn(clip) → ClipRect(contrlRect) | | |
| `0xa40a..0xa42a` | `bsrl 0xbcc6`; closure {blk, part}; `bsrl 0xf112`(d4, `0xa44c`, closure, 0) — per-device loop | | |
| `0xa430..0xa43e` | UseResFile(old), SetClip `$A879`, DisposeRgn ×2 | | |
| `0xa44c..0xa472` | `0xea08` save; PenNormal `$A89E`; RGBForeColor `$AA14`(`a4@(192)`) ; RGBBackColor `$AA15`(`a4@(186)`); `bsrl 0xf2d6`(device) | colours: `0xf378..0xf394` sets `a4@(192..197)` = 0 (black), `a4@(186..191)` = -1 (white) | |
| `0xa47c..0xa496` | `tstb` blk18 `bnes 0xa48a` (draw); `tstb` blk77 `bnes 0xa49a` (skip); `0xa48a`: `bsrl 0xc338`(blk, 0, nil) | arrow 0 drawn iff blk18 or !blk77 (**refutes** range-controls "unless byte18 or byte77") | |
| `0xa49a..0xa4b4` | blk18 or blk77 → arrow 2 | | |
| `0xa4b8..0xa4c0` | arrow 3 always | | |
| `0xa4c6..0xa4de` | blk18 → arrow 1 | | |
| `0xa4e2..0xa4e4` | `bsrl 0xaed6` (thumb + track) | | |
| `0xa4ea..0xa4f2` | `0xea2e` restore | | |
| closure `+4` (part) | not read in `0xa44c` (only `%a3@` → blk) | part argument does not select art | |

## E3. Arrow boxes `0xa8c6..0xa97a`

Args: contrlRect, out rect, index byte (`sp@(28)`), blk. `moveq #1,%d3`; blk72 → d3 = 0.
Horizontal: d4 = (bottom−top) − 1. idx1: left += d4 (`0xa90e`); idx2: right −= d4 (`0xa91a`) then left = right − d4 − d3 (`0xa91e`); idx3: left = right − d4 − d3; then (all) right = left + d4 + d3 (`0xa92a`). idx0 falls straight to `0xa92a`. Vertical mirrors on top/bottom `0xa938..0xa972`. **Verifier:** |

## E4. Track rect `0xbbf4..0xbc90`

Start = contrlRect. blk47 → unchanged. d3 = blk18 ? 2·blk22 − 2 : blk22 − 1. Horizontal: blk77 and !blk18 → right −= 2·d3 (unreachable); else left += d3, right −= d3. Vertical mirrors (`0xbc5a..0xbc7a`). Writes the rect to the caller's out pointer. Callers: `0x9c2a`, `0xa700`, `0xa84c`, `0xaa24`, `0xad6e`, `0xaee8`, `0xbda6`, `0xbf80`, `0xc0a8`. **Verifier:** |

`0xad62..0xada0`: along length of the `0xbbf4` rect. **Verifier:** |

## E5. Thumb length `0xab68..0xad60`

| addr | fact | verifier |
|---|---|---|
| `0xab74..0xab78` | d4 = blk22 + 1 | |
| `0xab7a..0xabaa` | hilite `cmpib #-127` (129) → -10205 h / -10207 v; else -10206 / -10208 | |
| `0xabb2..0xabd2` | blk22 ≤ 11: `0x10472`(id+1956); nil → flag fp-17 = 1 | |
| `0xabd8..0xabe6` | nil → `0x10472`(id) | |
| `0xabe8..0xac0c` | found: d4 = h ? bounds right−left (+12 − +8) : bottom−top (+10 − +6) | |
| `0xac10..0xac16` | flag → `subqw #5,%d4` | |
| `0xac18..0xac1a` | `0x106ae` release | |
| `0xac20..0xacc4` | blk19: d6 = trackLen (`0xad62`), d5 = along of contrlRect, d0 = (max−min) + d5; d1 = d5·d6 `mulsl`, `divsll` d0; clamp ≤ d6 then ≥ d4; return | proportional | |
| `0xacc8..0xad06` | rect init from blk8; `bsrl 0x1bbe`(handle, &rect, blk22 + (blk18 ? blk22−1 : 0), d4) | GetSmartScrollRect (name string `0x1c00` "GETSMARTSCROLLRECT"; dispatcher `0x1b1a` needs Gestalt `'MMBS'` with `'MMBS'` at +20/+24, default result -50) | |
| `0xad08..0xad4e` | result ≠ 0 → d3 = d4; else d3 = along of rect; blk18 and d3 > trackLen → d3 − 2·blk22 + 2; clamp ≥ d4 | | |
| `0xad50..0xad56` | d3 > trackLen (`fp@(10)`) → 0 | | |

## E6. Thumb rect `0xa97c..0xab66`

| addr | fact | verifier |
|---|---|---|
| `0xa988..0xa99e` | blk20 → rect 0,0,0,0 | |
| `0xa9a2..0xa9fe` | d3 = max − min, d5 = value − min (via helpers when blk76) | |
| `0xaa00..0xaa1c` | d6 = trackLen; d4 = `0xab68`(d3 word, d6, blk); d7 = d6 − d4 | |
| `0xaa1e..0xaa34` | T = `0xbbf4` | |
| `0xaa36..0xaa3e` | d4 == 0 → d5 = 0 | |
| `0xaa40..0xaa52` | d3 == 0 → result extended 0 | |
| `0xaa54..0xaac0` | SANE `$A9EB`: comp(d3) → ext (`#0x300e`), → single (`#0x1010`) in place; `mulul %d7,%d0` (d5·d7 unsigned) → comp → ext (`#0x300e`); ext /= single (`#0x1006`); ext += 0.5 (`#0x0000`, constant `0x3ffe8000 0…`) | | |
| `0xaad2..0xaaea` | `#0x0016` truncate to integer; `#0x3010` → comp; d6 = low long | | |
| `0xaaee..0xab42` | h: top = T.top, left = T.left + d6, bottom = top + blk22, right = left + d4; v: top = T.top + d6, left = T.left, bottom = top + d4, right = left + blk22 | | |
| `0xab46..0xab5a` | RectRgn(contrlData, rect); blk50..57 = rect | | |

## E7. Thumb + track `0xaed6..0xb004`

| addr | fact | verifier |
|---|---|---|
| `0xaee2..0xaf04` | T = `0xbbf4`; right ≤ left or bottom ≤ top → exit | TH1 | |
| `0xaf08..0xaf20` | blk20 → `0xba0e`(T, blk, 0); exit | TH2 | |
| `0xaf24..0xaf54` | thumb id by hilite 129 / blk21 | TH3/TH4 | |
| `0xaf56..0xaf82` | blk22 ≤ 11 → `0x10472`(id+1956) first; nil → `0x10472`(id) | TH5 | |
| `0xaf84..0xafbe` | found: `0xb44c`(cicn, bounds, &blk50, blk21, blk58, blk49, 1); `0x106ae` | TH7 | |
| `0xafc2..0xafda` | blk48 → `0xb006`(T, 0, blk) | TF1 | |
| `0xafdc..0xaffa` | else `0xb006`(T, 1, blk) then `0xb006`(T, 0, blk) | TF2 | |

## E8. Track segment driver `0xb006..0xb31c`

| addr | fact | verifier |
|---|---|---|
| `0xb00e..0xb040` | d6 = side flag (1 low, 0 high); fp-32 = T; fp-8 = T; fp-16 = blk50..57 (Th) | |
| `0xb046..0xb076` | d4 = GetClip; a3 = RectRgn(contrlRect); SectRgn `$A8E4`(d4, a3, a3); DiffRgn `$A8E6`(a3, blk58, a3); SetClip(a3) | clip = clip ∩ R − drawn thumb | |
| `0xb078..0xb102` | blk48: if blk74: hilite 20 → arrow 0 (if blk18 or !blk77) with clip a3, arrow 2 (blk18 or blk77); hilite 21 → arrow 3, arrow 1 if blk18 | TF9 | |
| `0xb102..0xb112` | SetClip(a3); `0xba0e`(fp-8 = T, blk, 0) | TF1 | |
| `0xb114..0xb188` | blk72 and blk77 and !blk18 → 1-px end cap via `0x10320` (unreachable) | | |
| `0xb18c..0xb1ae` | d3 = d6 ? hilite == 22 : hilite == 23 | page flag | |
| `0xb1b8..0xb1d6` | h: Th.left > T.left → fp-8.right = Th.left + 1; d6 → `0xba0e`(fp-8, blk, d3) | low segment | |
| `0xb1dc..0xb22a` | blk72 and blk77 and !blk18 → end cap (unreachable) | | |
| `0xb22e..0xb256` | T.right > Th.right → fp-8.left = Th.right − 1, fp-8.right = T.right; !d6 → `0xba0e` | high segment | |
| `0xb264..0xb306` | vertical mirrors (top/bottom) | | |
| `0xb30a..0xb314` | SetClip(d4); dispose | | |

## E9. Track fill `0xba0e..0xbbf2`

| addr | fact | verifier |
|---|---|---|
| `0xba1e..0xba30` | rect empty → exit | TF5 | |
| `0xba34..0xba3a` | d7 = 0; d3 = blk62 cicn; d4 = blk68 ppat | | |
| `0xba3e..0xba6c` | blk74, or (blk75 and !arg flag `fp@(16)`): d7 = 1; d3 = GetCIcon(blk66 − 1); d4 = GetPixPat(blk66 − 1) — replaces both, no fallback | TF3 | |
| `0xba6e..0xba8a` | GetPort; `a4@(3440)` (set at `0x1c90..0x1ca4` = Gestalt `'ATIr'` exists). Clear → `beqs 0xba8c`: offscreen always attempted. Set → offscreen only if d4 (ppat) non-nil and port picSave (+92) non-nil, else skip to `0xbb16` drawing into the port | | |
| `0xba8c..0xbb12` | `$AA32` device; NewGWorld (`$AB1D` 0x00160000) depth = device pixmap pixelSize, bounds = rect, flags 6; GetGWorldPixMap (0x00040017), LockPixels (0x00040001); ok → GetGWorld (0x00080005), SetGWorld (0x00080006); else DisposeGWorld (0x00040004) | offscreen; contents never initialised | |
| `0xbb16..0xbb26` | d3 nil and d4 nil → RGBForeColor(white `a4@(186)`), PaintRect `$A8A2` | TF6 | |
| `0xbb28..0xbb44` | d4 → `0xf930`(rect, ppat, contrlRect.left, contrlRect.top) | TF7 | |
| `0xbb48..0xbb74` | d3 (the drawn cicn, possibly the `0xba3e` id − 1 replacement) → `0xc2d2`(blk, &src, d3), which reads bounds from its cicn argument (`sp@(24)` at `0xc2de`) and flags blk47/72/73; `0xb44c`(cicn, src, rect, blk21, 0, 1, 1) | TF8, mode 1 | |
| `0xbb78..0xbb8a` | d7 → DisposeCIcon / DisposePixPat | | |
| `0xbb8c..0xbbea` | offscreen → SetGWorld back; RGBFore black / RGBBack white; CopyBits `$A8EC`(gworld+2, port+2, rect, rect, 0, nil); UnlockPixels (0x00040002 at `0xbbd8`), DisposeGWorld | | |

`0xf930..0xf9f4` (pattern helper): SetOrigin `$A878`(portRect.left − left, portRect.top − top); OffsetRgn clip unless near ±32000; offset rect; `0xf7cc`; undo. `0xf7cc`: `a4@(1222)` set → FillRect `$A8A5` with the ppat's 1-bit pattern (+20) in black on white; else FillCRect `$AA0E`. `0xf2d6`/`0xf488`: flag = depth < 4, or depth == 4 and gdFlags bit 0; clear for depth > 4. **Verifier:** |

## E10. Track source rect `0xc2d2..0xc336`

src = cicn bounds; blk47 → done; !blk72 → done; h: d3 = (bottom − top) − 1, doubled when blk73; left += d3, right −= d3; v: on top/bottom with width. **Verifier:** |

## E11. Slicer `0xb44c..0xba0c` and piece copier `0xb31e..0xb44a`

| addr | fact | verifier |
|---|---|---|
| `0xb454..0xb464` | args: cicn, src, dst, horizontal `fp@(20)`, region `fp@(22)`, mode `fp@(26)`, draw flag `fp@(28)` | |
| `0xb468..0xb482` | dst empty → SetEmptyRgn(region) `$A8DD`, exit | |
| `0xb486..0xb4a6` | mode 0 → fp-25 = 0, cap d3 = 3; mode > 0 → fp-25 = 1 (halves); mode < 0 → d3 = −mode | |
| `0xb4a8..0xb4c8` | region → d5 = mask region (`0xf6e0`: BitMapToRegion `$A8D7` of maskBMap +50), SetEmptyRgn(region) | |
| `0xb4ca..0xb4d0` | draw flag 0 → cicn = nil (region only) | |
| `0xb4d2..0xb520` | equal width and height → one `0xb31e` | |
| `0xb52c..0xb54c` | h: d7 = min(src w, dst w); fp-22 = d7 >> 1 (`asrw`) | |
| `0xb56c..0xb614` | halves: piece 1, piece 2 if d7 < dst w (column at src.left + half), piece 3 | |
| `0xb618..0xb796` | caps: piece 1 `[0,k)`; mid = (dst.right + dst.left) >> 1; piece 2 (column src.left + k − 1); centre with the `lsrw #8; lsrw #7; add; asrw #1` trunc-halves trim when src w > dst w; piece 4 (column src.right − k); piece 5 `[right − k + 1, right)` | |
| `0xb79a..0xb9f0` | vertical mirror | |
| `0xb31e..0xb360` | region: RectRgn(src) ∩ mask, MapRgn `$A8FB`(src → dst), UnionRgn `$A8E5` into region | |
| `0xb362..0xb432` | src 1 px wide and heights equal → per row `0xf9f6`(cicn, x, y, 1) true → MoveTo `$A893`/LineTo `$A891` across dst; 1 px tall mirror | |
| `0xb434..0xb440` | else `0x10320`(cicn, src, dst) | |

## E12. Arrow drawer `0xc338..0xc850`

| addr | fact | verifier |
|---|---|---|
| `0xc34a` | blk47 → exit | AD4 | |
| `0xc352..0xc36e` | box = `0xa8c6`(contrlRect, &box, index, blk) | | |
| `0xc372..0xc37a` | !blk72 → icon lane `0xc764` | | |
| `0xc37e..0xc39c` | a3 = blk62, d6 = blk68; fp-33 = hilite in 1..253 | | |
| `0xc3a0..0xc3c8` | hit = (idx 0 or 2 and hilite 20) or (idx 1 or 3 and hilite 21) | AH1–AH3 | |
| `0xc3cc..0xc3fe` | pressed and !hit: a3 = GetCIcon(blk66 − 1) else blk62; d6 = GetPixPat(blk66 − 1) else blk68 | AC2 | |
| `0xc402..0xc40a` | src = a3 bounds — a3 is the cell-source cicn **after** the AC2 swap at `0xc3cc..0xc3ea` (GetCIcon(blk66 − 1), else blk62), so `l, r` and `d` (`0xc418..0xc420`, from the same rect) are those of the drawn cicn. Answers L6-Q1 | | |
| `0xc418..0xc420` | h: d3 = (bottom − top) − 1 | d | |
| `0xc43a..0xc474` | idx0: blk74 and !blk18 → src.right = (l+r)/2, box.right = box.left + src w, half; else src.right = l + d | | |
| `0xc478..0xc4d6` | idx1: blk73 → (blk74: src.right = (l+r)/2, src.left = l + d, box.right adj, half; else src.left = l + d, src.right = l + 2d); !blk73 → src.left = r − d − 1, src.right = r − 1 | | |
| `0xc4da..0xc53a` | idx2: blk73 → (blk74: src.left = (l+r+1)/2, src.right = r − d, box.left adj, half; else src.right = r − d, src.left = r − 2d); !blk73 → src.right = l + d + 1, src.left = l + 1 | | |
| `0xc53e..0xc580` | idx3: blk74 and !blk18 and !blk77 → src.left = (l+r+1)/2, box.left adj, half; else src.left = r − d | | |
| `0xc584..0xc6e0` | vertical mirrors | | |
| `0xc6e4..0xc734` | ppat → `0x10320`(cell, src, box); rgn = `0xf68c` (src rect − mask region, offset to box); `0xf87e`(rgn, ppat, contrlRect.left, contrlRect.top) | AC4 | |
| `0xc736..0xc746` | no ppat → `0xfdf8`(cell, src, box) | AC5 | |
| `0xc74a..0xc760` | dispose id − 1 handles if not the blk ones | | |
| `0xc764..0xc7b6` | icon lane: parity = idx & 1; hit = parity 0 ? hilite 20 : hilite 21; id = word blk + 0x18 + 8·parity + 4·!blk21 + 2·hit | AI1/AI2 | |
| `0xc7ba..0xc7fa` | blk20: table {-10206, -10208, -10205, -10207} at fp-24..-18, index 4·parity + 2·!blk21 | AI3 | |
| `0xc7fe..0xc820` | TheZone = SysZone (`0x2a6`); `0xf4ba`(box, id); restore | AI4 | |
| `0xc822..0xc848` | clip arg and half → DiffRgn(clip, RectRgn(box), clip) | TF9 | |

`0xf4ba..0xf684`: GetResource `$A9A0` `'ics#'` (0x69637323); nil → exit; mask (+32..+63) all ones → no mask; colour port → flag `a4@(1222)`, else 1-bit; colour and !flag → HomeResFile `$A9A4` → UseResFile → Get1Resource `$A81F` `'ics8'` (0x69637338); ics8 and the icon PixMap `a4@(1216)` (allocated by NewPixMap at kDEF load, `0xf3aa`) → CopyBits/CopyMask from the ics8 data through that pixmap; else 1-bit CopyBits/CopyMask of the ics# image (no mask when all-ones mask or picSave set; the grafProcs test is only in the 1-bit branch). No `'ics4'` (0x69637334) immediate anywhere in the listing (grep count 0). **Verifier:** |

## E13. Hit test `0xa506..0xa676`

blk20 → 0; PtInRect `$A8AD` contrlRect miss → 0; box 0 (if blk18 or !blk77) → 20; box 1 (blk18) → 21; box 2 (blk18 or blk77) → 20; box 3 → 21; `0xa97c`; PtInRect blk50 → 129; h: `(right + left) >> 1` > pt.h → 22 else 23; v with v. **Verifier:** |

## E14. Cached loader `0x10472..0x106ac`

TheZone = SysZone; UseResFile(Gestalt `'Copl'` low word); if cache block `a4@(3436)`: switch (`0x104c0`, 18 ids from -14332 to -8271: -14332, -14331, -14330, -12288, -12287, -12272, -10224, -10223, -10208, -10207, -10206, -10205, -8286, -8285, -8278, -8277, -8272, -8271) → slot GetCIcon once (`0x10420`); `a4@(1212)` = cached handle; nil → GetCIcon(id) uncached; restore. `0x106ae` disposes unless the handle is `a4@(1212)`. **Verifier:** |

## E15. Corpus census

Scripts (private store): `campaign-20261021/v2-lanes/L5/scripts/tab.mjs` over
`lanes/I/census.json`; `masks.mjs` reads each archive's own fork through
`tools/theme-loader/containers.js` and `tools/sit-wasm` and counts mask-clear
pixels per cicn. Outputs in `v2-lanes/L5/`. **Verifier:** |

## E16. Findings against earlier documents

| # | claim in earlier doc | status by this trace |
|---|---|---|
| R-1 | range-controls.md / kdef-service-handlers.md: scroll-bar CDEF = slot 5 `0x8d36` | REFUTED: slot 1 `0x997e` (E0) |
| R-2 | range-controls.md: "nothing is drawn if 0xbbf4 yields an empty thumb rect" | REFUTED as worded: `0xbbf4` is the track rect; an empty track rect skips thumb and track (E4, E7) |
| R-3 | range-controls.md + lanes/I/REVIEW.json drawOrder: "arrow 0 (low) unless byte18 or byte77" | REFUTED: drawn iff byte18 or !byte77; byte77 is never set (E1 `0x9e1e`, E2 `0xa47c`) |
| R-4 | range-controls.md declared condition "blob byte77 clear" | redundant: byte77 is always clear |
| R-5 | range-controls.md arrows/thumb/state/track rows | CONFIRMED (E1, E7, E12) |

## E17. L6 spec questions (2026-10-22)

| q | trace | verifier |
|---|---|---|
| Q1 | (cells may still extend past a narrow source: 1138 ST4 pressed, -8288 5 × 16, high cell `[−10, 5)`; no bounds test before `0xc6f8`/`0xc740`) `0xc3cc..0xc402`: the swap to GetCIcon(blk66 − 1) happens before `0xc402` reads `*a3`+6..+13, so cell bounds come from the cell-source cicn. TF3 likewise: `0xba3e..0xba6c` replaces d3, `0xbb4c` passes d3 to `0xc2d2` | |
| Q2 | `0xacc2..0xacc4`: proportional result → `braw 0xad5a`, bypassing the `cmpw %fp@(10),%d3` zero rule at `0xad50` | |
| Q3 | `0xc810..0xc816`: `0xf4ba`(id, &box fp-16) where box = `0xa8c6` output; `0xf4ba` dst = its rect arg (d6), src bounds = global `a4@(178..185)` (`0xf4c6..0xf4cc`; no static writer found in the listing; 16 × 16 is the only frame consistent with rowBytes 2 at `0xf562`/`0xf5ca` and the 16 × 16 icon PixMap built at `0xf3aa..0xf412`) | |
| Q5 | `0xf4fa` `jsr 0xf378` (fore black `a4@(192)`=0, back white `a4@(186)`=-1); 1-bit path `0xf5c6..0xf61c`: bitmap fp-26 baseAddr = ics# data, rowBytes 2; CopyBits mode 0 (`0xf5fe clrw`) when mask all-ones/picSave/grafProcs, else CopyMask with mask bitmap fp-40 (data +32) | |
