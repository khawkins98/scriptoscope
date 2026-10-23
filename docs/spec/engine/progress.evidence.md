# Evidence: progress bar CDEF 5 (`progress.md`)

**Verifier-only. Implementers must not open this file.**

Binary: Kaleidoscope 2.3.1 `CDEF 5`, `.scratch/k231-kdef/CDEF/id-5.bin` (root
checkout, gitignored), 14,313 B, SHA-256
`0f159bd353e84c276e85d41f1a8e7f0c63dfc1ad37868f04f034ae8c6764939c`. Listing: the
maintainer's annotated listing
`campaign-20261021/v2-lanes/L1/annotated/cdef5.annotated.txt` (private store),
SHA-256 `4f6abafa4d71a19fc8b6053b491367a7e04ed6e8c91987e3c5519541a979940d`; index
`index.json` SHA-256 `1934d2247d6965820f72fc208ca04caa99885da7cfa83fd8953f0d523828993d`.
Addresses are file offsets. No disassembly or annotation tool was written or
run; the only processing was a column trim of the maintainer's listing (drop the
hex-bytes column, `v2-lanes/progress/cdef5.compact.txt`) for reading, and grep /
sed range prints. Raw binary bytes were read only with `xxd` for the spot checks
in E12. Trap names: Universal Interfaces 3.0.1 `Traps.h` (SHA-256 `b2d54498…`);
`$AA73` is absent there. QDOffscreen selectors (`$AB1D`, d0 = param-bytes << 16 |
selector): Inside Macintosh: Imaging With QuickDraw, chapter 6. Writer: v2 spec
lane `v2-progress-spec`, 2026-10-22. The verifier column is empty until the
independent Tier-1 verifier fills it.

## E0. Conventions

- main `0x13c` is a Pascal CDEF: `fp@(8)` param (long), `fp@(12)` message
  (word), `fp@(14)` control handle, `fp@(18)` varCode (never read), result
  `fp@(20)` written as `sp@(56)` (24-byte `moveml` + 12-byte frame); `rtd #12`.
- Internal helpers are CodeWarrior C (args pushed right to left; first arg at
  `fp@(8)`). The DeviceLoop callback `0x5d2` is Pascal (`rtd #12`): `fp@(8)`
  userData (control), `fp@(12)` GDHandle, `fp@(16)` flags, `fp@(18)` depth.
- ControlRecord (IM): +8 contrlRect (top 8, left 10, bottom 12, right 14),
  +17 contrlHilite, +18 value, +20 min, +22 max, +28 contrlData.
- CIcon: iconPMap +0 (rowBytes 4, bounds 6..13, pixelSize 32, pmTable 42),
  maskBMap +50 (rowBytes 54, bounds 56..63), iconBMap +64 (baseAddr 64,
  rowBytes 68, bounds 70), iconData +78, iconMaskData +82.
- GrafPort: portBits/portPixMap +2, portVersion +6, portRect +16, visRgn +24,
  clipRgn +28, bkPixPat +32, rgbFgColor +36, rgbBkColor +42, pnPixPat +58,
  fillPixPat +62 (CGrafPort), pnVis +66, txFont +68, txFace +70, txMode +72,
  txSize +74, picSave +92, rgnSave +96, grafProcs +104.
- **Private record** (contrlData, `NewHandle(8)`, no nil check): +0
  indeterminate flag (byte), +2 last-advance TickCount (long), +6 phase (byte).
- A4 globals at `0x343a` (set by `0x104`: `lea 0x0` + 13370). +0..+5 white RGB,
  +6..+11 black RGB, +94/+102 black/white 8-byte patterns (normalise), +110/+118
  black/white patterns (restore), +126 HasColorQD cache (initial 0xff = unknown),
  +128 white RGB, +134 black RGB, +140 Point (0,0), +144 lavender RGB
  (CCCC CCCC FFFF), +150 dark grey RGB (4445 4444 4444), +156 ppat cache table,
  +216 cicn cache table, +856 last loaded cicn, +860/+861 cache flags (0, never
  written), +862 lowDepth, +864 icon-cache table pointer (0, never written),
  +868/+872 relocation state.

## E1. CDEF 5 entry glue and relocation (`0xc..0x13a`)

| addr | fact | verifier |
|---|---|---|
| CDEF 5 `0xc..0x24` | save regs; `jsr 0x104`; `lea 0x0`, `$A055` StripAddress; `jsr 0xae`; restore; `jmp 0x13c` (main) | |
| CDEF 5 `0x28..0x36` | returns base + 14294 = `0x37d6` (relocation table) via `$A055` | |
| CDEF 5 `0xae..0x102` | if A4+868 ≠ current base: relocate (`jsr 0x28`, `jsr 0x38`), store base in A4+868; flush decision via `$A746`(`$A89F`) vs `$A346`(`$A198`), then `$A198` HWPriv d0 = 1 | |
| CDEF 5 `0x104..0x114` | `lea 0x0; addal #13370` (= `0x343a`); `$A055`; `exg d0,a4` | |
| CDEF 5 `0x116..0x13a` | CodeWarrior sparse-switch helper (used by `0x1aa8`) | |
| `0x38..0xac` | relocation runtime (out of scope, `inScope:false`) | |

## E2. CDEF 5 main `0x13c..0x30a`

| addr | fact | verifier |
|---|---|---|
| CDEF 5 `0x144..0x158` | a2 = control, d6 = message, d4 = param, d3 = 0 (result) | |
| CDEF 5 `0x15a..0x188` | copy contrlRect to fp-8; `bottom − top` (`fp@(-4) − fp@(-8)`) `cmpiw #14`; if ≠, `bottom = top + 14` and the rect is written back into the ControlRecord (RECT1, RECT2) | |
| CDEF 5 `0x18e..0x19c` | `cmpiw #27; bhiw 0x2fc`; dense word switch at `0x1a0` (E12 raw check): 0→`0x226`, 1→`0x244`, 2→`0x24a`, 3→`0x25e`, 4→`0x280`, 10/11→`0x250`, 18→`0x1d8`, 19→`0x29a`, 20→`0x2d4`, 21→`0x29e`, 27→`0x292`, others →`0x2fc` | |
| CDEF 5 `0x1d8..0x224` | idle: rec = `*contrlData`; `tstb rec+0` → `0x226` if 0; target = rec+2 + 3; `$A975` TickCount; `cmpl; bcss 0x226` (unsigned below); `addqb #1, rec+6`; rec+2 = TickCount; `$AA73` d0 = 6 on the control, result byte → `bsrl 0x30e` if non-zero (IDLE2) | |
| CDEF 5 `0x226..0x240` | `$AA73` d0 = 6 (IsControlVisible), result byte; if non-zero `bsrl 0x30e` (DRAW1, IDLE3). Reached by message 0 and by fall-through from idle | |
| CDEF 5 `0x244..0x246` | message 1: d3 = 0 (HIT1) | |
| CDEF 5 `0x24a..0x25a` | message 2: `andil #0x7fffffff` param; 10/11 join: `$A8DF` RectRgn(param, &contrlRect) (HIT2) | |
| CDEF 5 `0x25e..0x27e` | message 3: `$A122` NewHandle(8) → contrlData; clrb +0, clrl +2, clrb +6 (no nil test: DATA4) | |
| CDEF 5 `0x280..0x290` | message 4: if contrlData ≠ nil, `$A023` DisposeHandle | |
| CDEF 5 `0x292` | message 27: d3 = `#544172832` = 0x206F6B20 `' ok '` | |
| CDEF 5 `0x29a` | message 19: d3 = 72 | |
| CDEF 5 `0x29e..0x2d2` | message 21: a3 = param (ControlDataAccessRec: tag +0, part +4, size +8, dataPtr +12); `subil #1768842341` (`'inde'`); match: if dataPtr ≠ 0, copy rec byte 0 to *dataPtr; size = 1; else d3 = −30581 (DATA2, DATA3) | |
| CDEF 5 `0x2d4..0x2f6` | message 20: match `'inde'`: `*rec = *dataPtr` (byte, no nil or size test); else d3 = −30581 (DATA1, DATA3) | |
| CDEF 5 `0x2fc..0x30a` | restore A4; result; `rtd #12` | |

## E3. CDEF 5 draw entry `0x30e` and device loop `0x7f4..0x9c0`

| addr | fact | verifier |
|---|---|---|
| CDEF 5 `0x30e..0x358` | NewRgn; RectRgn(contrlRect); `0x7f4(rgn, 0x5d2 (relocated), control, 0)`; DisposeRgn | |
| CDEF 5 `0x7fc..0x822` | GetPort; NewRgn a2; SectRgn(visRgn, clipRgn, a2); SectRgn(param rgn, a2, a2) | |
| CDEF 5 `0x824..0x852` | d3 = 1; colour port (`0xa26`) → d3 = 0; d4 = `0xa3c(port)`; grafProcs (+104) ≠ 0 → d3 = 0 | |
| CDEF 5 `0x854..0x882` | picSave (+92) or rgnSave (+96) ≠ 0 → d4 = 1 (skip the empty test); else `$A8E2` EmptyRgn(a2) or pnVis (+66) < 0 → dispose, return (DRAW2) | |
| CDEF 5 `0x886..0x938` | d4 → d3 = 0. d3 path: LocalToGlobal(A4+140); a2 := visRgn ∩ clipRgn (recomputed, no longer ∩ R); `0xa04` WMgr port (GetCWMgrPort if colour QD else GetWMgrPort); SetPort; save clip; SetOrigin(−global); SetClip(a2); save and copy font, size, face, mode from the window port; save colours; RGBFore black, RGBBack white (DRAW5) | |
| CDEF 5 `0x93a..0x96a` | d4 path: depth = colour port ? `(*portPixMap)->pixelSize` : 1; proc(depth, 0, `$AA32` GetGDevice, control) (DRAW4) | |
| CDEF 5 `0x96c..0x97c` | else `$ABCA` DeviceLoop(a2, proc, control, 0) (DRAW3) | |
| CDEF 5 `0x97e..0x9b4` | d3 path: restore clip, origin, text state, colours, port | |
| CDEF 5 `0x9c2..0xa02` | Gestalt `'qd  '` (`#1902387232`) ≥ 256 → colour QD; cached at A4+126 | |
| CDEF 5 `0xa04..0xa24` | GetCWMgrPort `$AA48` / GetWMgrPort `$A910` | |
| CDEF 5 `0xa26..0xa3a` | IsColorGrafPort: `(portVersion & 0xC000) == 0xC000` | |
| CDEF 5 `0xa3c..0xaa0` | "not the screen": false when CurApRefNum (`0x900`) is 0 or CurApName (`0x910`) length > 31; else compares the port's pixel base address with the WMgr port's (colour: `**portPixMap` baseAddr vs `(*wmgr.portPixMap)->baseAddr`; else portBits.baseAddr); differ → true | |

## E4. CDEF 5 device pass `0x5d2..0x7f0` (O1–O6, procedural bar)

| addr | fact | verifier |
|---|---|---|
| CDEF 5 `0x5d2..0x60a` | a3 = GDHandle, a2 = control, d3 = contrlData; fp-8 = contrlRect; fp-92 = A4+150 (dark grey), fp-86 = A4+144 (lavender) | |
| CDEF 5 `0x610..0x626` | `0xcfc(fp-80)` (save object: `0xaa2` init, `0xb02` capture); `0xc6a` normalise; `0xd60(gdh)` lowDepth | |
| CDEF 5 `0x62c..0x64a` | `0x35a(control)`; non-zero → `0xd22(fp-80, −1)` restore, return | |
| CDEF 5 `0x64e..0x65e` | `0x1aa8(−10224)` (cicn get); nil → `0x6ec` | |
| CDEF 5 `0x662..0x692` | `0x108a(cicn, 11, 13)` (`#720909` = 0x000B000D: high word 11 is the column at `fp@(12)`, low word 13 the row at `fp@(14)`; corrected 2026-10-22 per REVIEW-440 B2, earlier text misread it as (11, 11)) → RGBForeColor(pixel colour); MoveTo(left+1, bottom−1); LineTo(right−1, bottom−1); LineTo(right−1, top+1) (FB1) | |
| CDEF 5 `0x6a6..0x6d4` | `0x108a(cicn, 0, 0)`; MoveTo(left, bottom−2); LineTo(left, top); LineTo(right−2, top) (FB2) | |
| CDEF 5 `0x6d6..0x6e6` | `0x108a(cicn, 1, 1)` (`#65537`); `$AA25` DisposeCIcon (FB3) | |
| CDEF 5 `0x6ec..0x708` | InsetRect(fp-8, 1, 1); `$A8A1` FrameRect; InsetRect(1, 1) (FB5, FB6) | |
| CDEF 5 `0x70a..0x710` | `tstb *contrlData` → `0x75e` if 0 | |
| CDEF 5 `0x712..0x72e` | GetPixPat(−10064); nil → RGBForeColor(fp-86 lavender); PaintRect(fp-24). fp-24..fp-17 is written only at `0x7bc..0x7c8` (determinate branch); the save object spans fp-80..fp-25; so fp-24 is uninitialised here (FB9) | |
| CDEF 5 `0x732..0x75c` | `0xf56(&fp-8, ppat, left + 4·phase, top)` (`lslw #2` of rec+6, `addw fp@(-6)`); DisposePixPat (FB8) | |
| CDEF 5 `0x75e..0x7ac` | fp-16 = rect; d4 = right − left (`moveaw` sign-extend, `subl`); d5 = value − min; d3 = max − min, 0 → 1; `mulsl d5,d0; divsll d3,d0`; + left → fp-10 (right) | |
| CDEF 5 `0x7b0..0x7d8` | RGBForeColor(fp-92 dark grey); PaintRect(fp-16); fp-24 = rect with left = fp-10; RGBForeColor(fp-86 lavender); PaintRect(fp-24) (FB7) | |
| CDEF 5 `0x7da..0x7f0` | `0xd22(fp-80, −1)`; `rtd #12` | |
| listing grep | hilite (+17) is read only in `0x35a` (FB10) | |

## E5. CDEF 5 Kaleidoscope art `0x35a..0x5d0`

| addr | fact | verifier |
|---|---|---|
| CDEF 5 `0x362..0x374` | d3 = contrlData; a3 = 0; d4 = −10080; d5 = 0 | |
| CDEF 5 `0x376..0x3a6` | `cmpib #-2` / `#-1` on +17; match: d4 = −10077, `0x2e84(−10077, false)`; found → d5 = 1; else d5 = 0, d4 = −10080 (GATE1, GATE1a) | |
| CDEF 5 `0x3aa..0x3c4` | a3 nil → `0x2e84(d4, false)`; still nil → return 0 (GATE2) | |
| CDEF 5 `0x3c6..0x3ec` | fp-8 = contrlRect; `0x1f72(d4, &fp-8, false)`; 0 → return 0 (GATE3) | |
| CDEF 5 `0x3ee..0x430` | fp-8 = contrlRect; `cmpib #2, cinf byte 0; blss`: > 2 → InsetRect(byte0, byte1); else InsetRect(2, byte1) (INSET1, INSET2) | |
| CDEF 5 `0x432..0x438` | `tstb *contrlData` → `0x532` if 0 | |
| CDEF 5 `0x43c..0x45e` | GetPixPat(−10079 + 8·d5); found → DisposePixPat, a2 = 0 (IND1) | |
| CDEF 5 `0x460..0x48e` | `cmpib #8, rec+6; bccs 0x490` (≥ 8 unsigned → a2 stays 0); else GetPixPat(−10080 + 8·d5 + phase) | |
| CDEF 5 `0x490..0x4be` | a2 nil → `clrb rec+6`; GetPixPat(−10080 + 8·d5) (IND2, IND3) | |
| CDEF 5 `0x4c0..0x4e2` | nil → return 1; `0xf56(&fp-8, ppat, left, top)`; DisposePixPat; return 1 (IND4, IND6) | |
| CDEF 5 `0x4e6..0x52e` | probe missing: GetPixPat(−10080 + 8·d5); nil → return 1; `0xf56(&fp-8, ppat, left + 4·phase, top)`; DisposePixPat (IND5) | |
| CDEF 5 `0x532..0x580` | d5 = right − left; d6 = value − min; d3 = max − min, 0 → 1 (`tstl; bnes; moveq #1`); fp-16 = rect; fp-10 = left + `mulsl`/`divsll` (DET1, DET2) | |
| CDEF 5 `0x584..0x592` | `0x1d7e(d4 + 1, &fp-16)` (fill) | |
| CDEF 5 `0x594..0x5c4` | fp-16 = rect; fp-14 (left) = same split; `0x1d7e(d4 + 2, &fp-16)` (track) | |
| CDEF 5 `0x5c8` | return 1 (both `0x1d7e` results are ignored: GATE4) | |

## E6. CDEF 5 fill and track slicer `0x1d7e..0x1f70`, tile wrapper `0x1516`

| addr | fact | verifier |
|---|---|---|
| CDEF 5 `0x1d8e..0x1dbe` | `0x1aa8(id)`; nil → 0; `0x2e84(id, false)`; nil → release cicn, 0 (SLICE1) | |
| CDEF 5 `0x1dc2..0x1dd0` | d3 = cinf byte 0 (`a`); HGetState/HLock | |
| CDEF 5 `0x1dd2..0x1e0e` | fp-24 = cicn bounds; fp-8 = T; fp-8 (top) = `(T.top + T.bottom − S.bottom + S.top)` `extl; divsw #2`; fp-4 (bottom) = top + S.bottom − S.top (SLICE2) | |
| CDEF 5 `0x1e12..0x1e20` | `addw d0,d0` (2a); L = `fp@(-2) − fp@(-6)`; `cmpw; bgtw 0x1eaa` (L > 2a → caps) | |
| CDEF 5 `0x1e24..0x1ea6` | halves: src = S, src.right = S.left + `(L+1) divsw 2`; `0x18f6(cicn, src, T.left, D.top)`; src = S, src.left = S.right − `L divsw 2`; `0x18f6(cicn, src, T.right − L/2, D.top)` (SLICE3) | |
| CDEF 5 `0x1eaa..0x1efa` | caps: src.right = S.left + a at (T.left, D.top); src.left = S.right − a at (T.right − a, D.top) (SLICE4) | |
| CDEF 5 `0x1efe..0x1f24` | middle src = S with left += a, right −= a; `tstb cinf byte 2; bnes`: 0 → right = left + 1 (SLICE5, SLICE6) | |
| CDEF 5 `0x1f28..0x1f56` | dst = D with left += a, right −= a; flag = `cinf byte 3 == 0` (`seq; negb`); `0x1516(cicn, src, dst, flag)` → `0x154a(…, flag, 0)` (SLICE7) | |
| CDEF 5 `0x1f5a..0x1f66` | HSetState; `0x1cea` release; return 1 | |

## E7. CDEF 5 frame drawer `0x1f72..0x1fd0`, `0x1fd2..0x2758`

| addr | fact | verifier |
|---|---|---|
| CDEF 5 `0x1f72..0x1fca` | flag (fp+14) false (the only caller, `0x3dc`, passes `clrb`) → `0x1fd2(id, rect, 0, 0, false)`; true path (NewRgn, `0x275a`, PaintRgn) unreachable | |
| CDEF 5 `0x1fec..0x200a` | CurResFile saved; Gestalt `'Copl'` (`#1131376748`) noErr → UseResFile(response low word) | |
| CDEF 5 `0x200e..0x203e` | A4+861 = 0 → `0x1aa8(id)` (not the `0x3288` cache); UseResFile(saved) | |
| CDEF 5 `0x2040..0x2046` | cicn nil → return 0 | |
| CDEF 5 `0x204a..0x2078` | `0x2e84(id, false)`; nil → `0x2e84(bodyFill ? 0 : 1, false)` = cinf 1; still nil → `0x2742` (returns 1) (FRAME1) | |
| CDEF 5 `0x207c..0x20b8` | d3 = byte 0 (c), d4 = byte 1 (s); clip bbox fp-54..-48; GetPenState fp-90; PenNormal; HLock cinf | |
| CDEF 5 `0x20ba..0x2148` | bodyFill (fp+22) false → colour sampling skipped (FRAME8) | |
| CDEF 5 `0x214a..0x219a` | fp-24 = cicn bounds; A4+861 = 0 → no border cache (d7 = 0) | |
| CDEF 5 `0x219c..0x2256` | `D.top + c ≤ clip.top` → skip; TL: src right = min(B.left + c, B.right), bottom = min(B.top + c, B.bottom) at (D.left, D.top); TR: src left = max(B.right − c, B.left) at (D.right − w, D.top) | |
| CDEF 5 `0x225a..0x22d6` | `D.top + s ≤ clip.top` → skip; top band src = B, left += c, right −= c, bottom = min(B.top + s, B.bottom); byte 2 = 0 → right = left + 1; dst left += c, right −= c, bottom = D.top + src height; `0x154a(cicn, src, dst, true, d7)` | |
| CDEF 5 `0x22da..0x23ae` | `D.bottom − c ≥ clip.bottom` → skip; BL at (D.left, D.bottom − h); BR at (D.right − w, D.bottom − h), sources cut as TL/TR | |
| CDEF 5 `0x23b2..0x2430` | `D.bottom − s ≥ clip.bottom` → skip; bottom band (top = max(B.bottom − s, B.top)) | |
| CDEF 5 `0x2434..0x24a2` | left band: src top += c, bottom −= c, right = min(B.left + s, B.right); byte 2 = 0 → bottom = top + 1; dst top += c, bottom −= c, right = D.left + src width (no cull) | |
| CDEF 5 `0x24a6..0x251a` | right band: src left = max(B.right − s, B.left) (no cull) | |
| CDEF 5 `0x251c..0x252e` | d7 = 0 → no `0x3262` | |
| CDEF 5 `0x2530..0x2534` | `tstb fp@(22)` (bodyFill) → `0x2734`: body path `0x2538..0x272e` (mode-5 cicn via `0x1462`, EraseRoundRect `$A8B2`, ppat via `0x3394`/`0x1a6e` and `0xf56`) is skipped | |
| CDEF 5 `0x2734..0x2758` | HSetState; SetPenState; A4+861 = 0 → `0x1cea` release; return 1 | |

## E8. CDEF 5 blit helpers

| addr | fact | verifier |
|---|---|---|
| CDEF 5 `0x154a..0x15ca` | tiler(cicn, src, dst, dir byte fp+20, alt fp+22): empty dst or src → return; GetPort; colour-port flag; clip bbox; `dst.bottom ≤ clip.top` or `dst.top ≥ clip.bottom` → return (BLIT8) | |
| CDEF 5 `0x15ce..0x15da` | save colours; `0xe04` (black fg, white bg) | |
| CDEF 5 `0x15de..0x1654` | src width 1, dst width > 1: save txFont, set −12345; for row r from src.top while r < src.bottom and dst row < dst.bottom: `0x104a(cicn, src.left, r, true)` → mask bit; set → MoveTo(dst.left, y) LineTo(dst.right − 1, y); restore txFont (BLIT3) | |
| CDEF 5 `0x1658..0x16b8` | src height 1, dst height > 1: per column, MoveTo(x, dst.top) LineTo(x, dst.bottom − 1); no txFont change (BLIT4) | |
| CDEF 5 `0x16bc..0x170a` | `0xd96` prepare; source = iconBMap (+64) when lowDepth or not colour port; else alt (0 here) or the pixmap (BLIT2) | |
| CDEF 5 `0x1714..0x17fc` | forward: tile at dst top-left, cut at dst.right/bottom with src right/bottom cut; vertical cull; picSave → CopyBits srcCopy no mask; else CopyMask(src, mask, tile); step x by src width when src height = dst height, else y (BLIT5–BLIT7) | |
| CDEF 5 `0x1800..0x18c2` | reverse: start at bottom-right, cut at dst.left/top with src left/top cut; same transfers | |
| CDEF 5 `0x18c4..0x18ec` | fp-32 = 0 → no `$AB1D` 0x00040004 (DisposeGWorld); `0xde8`; restore colours | |
| CDEF 5 `0x18f6..0x194a` | corner form: dst = src moved to (h, v); `0x194c` | |
| CDEF 5 `0x194c..0x1a4a` | scale blit: vertical clip cull; `0xe04`; `0xd96`; source 1-bit if lowDepth or not colour; picSave or grafProcs → BitMapToRegion(mask), MapRgn(src→dst), CopyBits srcCopy with the region; else CopyMask(src, mask, src, dst) (BLIT1, BLIT2, BLIT7) | |
| CDEF 5 `0xd96..0xde6`, `0xde8..0xe02` | HLock cicn and its data; iconBMap baseAddr := data + mask size; unlock | |
| CDEF 5 `0xe04..0xe34` | A4+0..5 := white, A4+6..11 := black; RGBForeColor(black), RGBBackColor(white) | |
| CDEF 5 `0xe36..0xe66` | lowDepth := depth < 4, or depth = 4 and colour flag | |
| CDEF 5 `0xd60..0xd94` | colour flag = `gdFlags & 1`; depth = `(*(*gdh)->gdPMap)->pixelSize` → `0xe36` | |

## E9. CDEF 5 pattern fill `0xf56..0x1048`, `0xea6..0xf54`

| addr | fact | verifier |
|---|---|---|
| CDEF 5 `0xf56..0xf94` | args (rect, ppat, h, v); GetPort; SetOrigin(portRect.left − h, portRect.top − v) | |
| CDEF 5 `0xf96..0xfce` | clip bbox left > −32000 and top > −32000 → OffsetRgn(clip, −h, −v) | |
| CDEF 5 `0xfd0..0xff2` | rect offset by (−h, −v); `0xea6(rect, ppat)`; rect restored | |
| CDEF 5 `0x1004..0x1040` | clip bbox right < 32000 and bottom < 32000 → OffsetRgn(clip, h, v); SetOrigin(portRect.left, portRect.top) | |
| CDEF 5 `0xea6..0xf54` | colour port: save and clear fillPixPat (+62); lowDepth: black/white, `$A8A5` FillRect(rect, `(*ppat)+20` pat1Data), colours restored; else `$AA0E` FillCRect(rect, ppat); restore +62 (PAT1–PAT3) | |

## E10. CDEF 5 colour samplers `0x104a..0x1460`, `0x1d08..0x1d7c`

| addr | fact | verifier |
|---|---|---|
| CDEF 5 `0x104a..0x1088` | `0x10c4(cicn, h, v, &rgb, testMask)`; RGBForeColor(rgb); returns the mask flag | |
| CDEF 5 `0x108a..0x10c2` | `0x129c(cicn, h, v, &rgb)`; RGBForeColor(rgb) (mask bit computed, ignored by callers: COL2) | |
| CDEF 5 `0x10c4..0x1126` | testMask: mask bit at (h, v) from iconMaskData (+82) with mask rowBytes; else 1; 0 → return without colour | |
| CDEF 5 `0x112c..0x11b4`, `0x12f2..0x137a` | lowDepth: icon bit (iconBMap baseAddr +64, rowBytes +68) set → black (A4+6), clear → white (A4+0) (COL1a) | |
| CDEF 5 `0x11b8..0x1290`, `0x137e..0x1456` | pixel at row v of `*iconData` (+78) with pmap rowBytes; pixelSize 1/2/4/8 branches; others fall through with an unset value (COL1c); `0x1d08(ctab, &rgb, value)` | |
| CDEF 5 `0x1d08..0x1d7c` | ctSize = ct+6; value ≤ ctSize and entry[value].value = value → value; else entry[ctSize].value = 0 → value (by position); else search from ctSize down; −1 → 0; rgb = entry.rgb (COL1) | |

## E11. CDEF 5 resource getters and state save

| addr | fact | verifier |
|---|---|---|
| CDEF 5 `0x1aa8..0x1ce8` | SetZone(SysZone); CurResFile; Gestalt `'Copl'` → UseResFile; A4+864 = 0 → skip the 18-id sparse switch (−14332..−8271, includes −10224, −10223) → A4+856 := 0, `$AA1E` GetCIcon(id); restore zone and res file (CHAIN1) | |
| CDEF 5 `0x1a4c..0x1a6c` | cache-slot GetCIcon (inert: only reached through the switch) | |
| CDEF 5 `0x1cea..0x1d06` | release: if ≠ A4+856, clear A4+856 and DisposeCIcon | |
| CDEF 5 `0x2e84..0x2ff0` | SetZone(SysZone); `$A9A0` GetResource(`'cinf'` `#1667853926`, id); LoadResource; HNoPurge; extended (fp+10) false at every caller → return (CINF1); the extended path (`0x2ecc..0x2fe2`: size 54 test, SetHandleSize 54, samples via `0x129c`, `0x1234` markers) is inert | |
| CDEF 5 `0x2ff2..0x2ffe` | GetHandleSize glue (negative → 0) | |
| CDEF 5 `0xaa2..0xace`, `0xcfc..0xd20` | save object init (vtable A4+12/A4+24, NewRgn for the clip copy, flags 0) and capture | |
| CDEF 5 `0xb02..0xbbc` | GetGWorld (`$AB1D` `#524293`) if colour QD else GetPort; GetClip; GetPenState; colours; colour port: save pnPixPat (+58) and bkPixPat (+32), each kept only when its pattern type word is non-zero and its handle is 28 bytes | |
| CDEF 5 `0xbbe..0xc68` | SetClip; SetPenState; colours; SetGWorld (`#524294`) or SetPort; PenPixPat or PenPat(A4+110); BackPixPat or BackPat(A4+118) | |
| CDEF 5 `0xc6a..0xcfa` | colour port with bkPixPat size ≠ 28 → port +32 := 0; BackPat(A4+102 white); PenPat(A4+94 black); PenNormal; colour QD → RGBFore(A4+134 black), RGBBack(A4+128 white) (O2) | |
| CDEF 5 `0xd22..0xd5e`, `0xad0..0xb00`, `0x3000..0x302a` | restore and destroy the save object (DisposeRgn; operator delete) | |
| CDEF 5 `0x3288..0x333e`, `0x3340`, `0x3358`, `0x302c..0x3260`, `0x3262` | cicn and border caches: reached only when A4+861 / A4+860 ≠ 0 (never written): inert | |
| CDEF 5 `0x275a..0x2bf0`, `0x2bf2..0x2e82`, `0xe68..0xea4` | frame region form: reached only from `0x1f72` with flag true: inert | |
| CDEF 5 `0x1462..0x1514`, `0x1a6e..0x1aa6` | icon blit and uncached GetPixPat: reached only from the frame body path: inert | |

## E12. Raw-byte spot checks (`xxd` on `id-5.bin`)

| range | bytes | fact | verifier |
|---|---|---|---|
| CDEF 5 `0x343a..0x3445` | `ffff ffff ffff 0000 0000 0000` | A4+0 white, A4+6 black | |
| CDEF 5 `0x3498..0x34b7` | `ffff…ff 0000…00 ffff…ff 0000…00` | A4+94 black pattern, +102 white, +110 black, +118 white | |
| CDEF 5 `0x34b8..0x34d5` | `ff00 ffff ffff ffff 0000 0000 0000 0000 0000 cccc cccc ffff 4445 4444 4444` | A4+126 = 0xff; +128 white; +134 black; +140 (0,0); +144 lavender; +150 dark grey | |
| CDEF 5 `0x3792..0x37a1` | all zero | A4+856..+871: last cicn, cache flags +860/+861, lowDepth, +864 table pointer all 0 | |
| CDEF 5 `0x1a0..0x1d7` | `0086 00a4 00aa 00be 00e0 015c ×5 00b0 00b0 015c ×6 0038 00fa 0134 00fe 015c ×5 00f2` | the main switch targets in E2 | |
| CDEF 5 `0x16a..0x17f` | `fffc 906e fff8 0c40 000e 6718 700e d06e fff8 3d40 fffc` | `cmpiw #14` and `moveq #14` (RECT1) | |

## E13. Corpus census and the Kaleidoscope control-panel file

Census script `v2-lanes/progress/scripts/census.mjs` (SHA-256 `6dcb6ab4…`),
output `census.json` (SHA-256 `14ef8e04…`): own forks of the 18 archives through
`tools/theme-loader/containers.js` and `tools/sit-wasm`, resources in
−10080..−10064, −10224 and −10223 (theme data only). Findings used in §6:

- `cinf −10080`: 1138, 1984, 1990, apple-lisa, crayon-os, dolphin-som, evolution,
  floppies, windows-31, windows-95; `cinf −10077`: the same minus apple-lisa.
  No other archive ships a progress `cinf`. Every `cinf` is 18 bytes.
- Frame `cinf` bytes 0..3: (2, 2, 0, 0) 1138, 1984, apple-lisa, windows-31,
  windows-95 (−10077 (2, 1, 0, 0)); (2, 2, 1, 0) 1990, crayon-os, dolphin-som,
  evolution, floppies.
- Fill / track `cinf` and cicn sizes as in the spec's corpus table.
- `ppat`: listed per archive in `census.json`; every one is pattern type 1.
- `cicn −10224` colour tables and the (11,13) / (0,0) / (1,1) samples (census re-run with (11,13): the same value and colour as (11,11) in all 8 archives; script sha256 `18fe9706…`, output `13e3260f…`) (looked up
  with COL1): see the spec table. apple-platinum-2, black-platinum and
  system7-nostalgia-silver hold value 15 at (1, 1) in a 6-entry table whose last
  entry has value 15 (found by the search: black).
- No archive ships a `CDEF`.

Kaleidoscope 2.3.1 control-panel file (`.scratch/k231-kdef/_index.json`,
SHA-256 `b824a38b…`): `cicn −10224`, `cicn −10223`, `cicn −10208..−10205` and
`ppat −10064` are present; no `cinf` in −10080..−10064 (its `cinf`s are
−9968..−9964, −9960..−9956, 0 and 1). So the control panel could supply only
the procedural bar's colour cicn and pattern (CHAIN3); its `cinf 1` would only
matter to FRAME1's unreachable retry.

## E14. Relation to other documents

- `docs/spec/kdef231-reference.md` row "progress bar" (frame −10080/−10077, track
  −10075, barber-pole `ppat −10064`, "+4px right each draw") is 1.8.2-era
  material marked `[DOC]`; that pinned document is not edited. CDEF 5 uses
  `ppat −10064` only in the procedural bar, and its own patterns are
  −10080..−10065; the 4-pixel step per phase is CDEF 5's shift mode.
- `docs/spec/progress-caller-boundary.md`: the PACH 130 helpers it describes
  (PACH `0x9496`, `0x95d8`) select frame cinf −10080/−10077 with the same
  inactive-missing rule as GATE1a. CDEF 5's procedural FB7 PaintRects (10 rows,
  dark grey and lavender) match the patch's admission description; whether the
  patch repaints them is not decoded here (spec §6 item 1).
- PACH 130 compares against `cicn −10223` (PACH `0x8f7a`, `0x10e10`); CDEF 5
  never requests it.


## E13. Issue #459 FB9 count correction (2026-10-23)

`v2-lanes/progress/REVIEW-440.json` N2 and `review-440/corpus-scan.json`
record 36 FB9 unspecified cells for monkey-paradise (3 states × 3 lengths ×
4 phases), correcting the PR body's 24. The source rule remains CDEF 5
`0x71e..0x72e`; no new execution or native observation is claimed. This is
transcription of the independent review, not a self-verification verdict.
