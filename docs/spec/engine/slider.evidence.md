# Evidence: slider CDEF 3 (`slider.md`)

**Verifier-only. Implementers must not open this file.**

Binary: Kaleidoscope 2.3.1 `CDEF 3`, `.scratch/k231-kdef/CDEF/id-3.bin` (root
checkout, gitignored), 11,595 B, SHA-256
`d40e0c27be6b55a37c706b194828b9b6a74800e47eca65d4bf1561a92aef465a`. Listing: the
maintainer's annotated listing
`campaign-20261021/v2-lanes/L1/annotated/cdef3.annotated.txt` (private store),
SHA-256 `9891a1ff0c33504656c8f9cf3aa0fb94cd35d817ea804bffa6209a73d6102447`; index
`index.json` SHA-256 `1934d2247d6965820f72fc208ca04caa99885da7cfa83fd8953f0d523828993d`.
Addresses are file offsets. No disassembly or annotation tool was written or
run; the only processing was a column trim of the maintainer's listing (drop the
hex-bytes column) for reading. Raw binary bytes were read only for the three
spot checks in E11. Trap names: Universal Interfaces 3.0.1 `Traps.h`
(SHA-256 `b2d54498…`). QDOffscreen selectors (`$AB1D`, d0 = param-bytes << 16 |
selector): Inside Macintosh: Imaging With QuickDraw, chapter 6. Variant bits:
HISlider.h. Writer: v2 spec lane `v2-spec-slider`, 2026-10-22. The verifier
column is blank until the independent verifier fills it (CONFIRMED / REFUTED +
note, identity, date).

## E0. Conventions

- main is a Pascal CDEF: `fp@(8)` param (long), `fp@(12)` message (word),
  `fp@(14)` control handle, `fp@(18)` varCode (word), result `fp@(20)`
  (written as `sp@(68)` after the 24-byte `moveml` and 24-byte frame); `rtd #12`.
- Internal helpers are CodeWarrior C (args pushed right to left; first arg at
  `fp@(8)`). The DeviceLoop callback `0xdce` is Pascal (`rtd #12`): `fp@(8)` (CDEF 3)
  userData (control), `fp@(12)` device, `fp@(16)` flags, `fp@(18)` depth.
- ControlRecord (IM): +8 contrlRect (top 8, left 10, bottom 12, right 14),
  +16 contrlVis, +17 contrlHilite, +18 value, +20 min, +22 max, +28 contrlData.
- CIcon: iconPMap +0 (baseAddr 0, rowBytes 4, bounds 6..13, pixelSize 32,
  pmTable 42), maskBMap +50 (rowBytes 54, bounds 56..63), iconBMap +64
  (rowBytes 68), iconData +78, iconMaskData +82.
- GrafPort: portBits/portPixMap +2, portVersion +6, visRgn +24, clipRgn +28,
  bkPixPat +32, rgbFgColor +36, rgbBkColor +42 (CGrafPort), pnVis +66,
  txFont +68, picSave +92, rgnSave +96, grafProcs +104.
- **Private record** (contrlData, 48 bytes, `NewHandle` not cleared):
  +0 tick count (word), +2 word (cleared, never read), +4 RgnHandle (allocated,
  only disposed), +8 horizontal (byte), +9 ghost flag, +10 live flag,
  +12..+19 ghost/live rect, +20 group (byte), +22 base id (word), +24 thumb
  CIconHandle, +28 corner c (long), +32 thumb along size (long), +36
  value − min (long), +40 max − min (long), +44 travel T (long).
- A4 globals at `0x2d24` (set by `0x104`: `lea 0x0` + 11556). +0..+5 white (CDEF 3)
  RGB, +6..+11 black RGB, +12 HasColorQD cache, +14 Point, +18 last cached
  cicn, +22 lowDepth, +24 icon-cache table pointer, +28/+32 relocation state.

## E1. CDEF 3 entry glue and relocation (`0xc..0x13a`)

| addr | fact | verifier |
|---|---|---|
| CDEF 3 `0xc..0x24` | save regs; `jsr 0x104` (A4 = base + 11556 = `0x2d24`); `lea 0x0`, `_StripAddress` `$A055`; `jsr 0xae`; restore; `jmp 0x1fc` (main) | |
| CDEF 3 `0x28..0x36` | returns base + 11589 = `0x2d45` (relocation table) via `$A055` | |
| CDEF 3 `0xae..0x102` | if A4+28 ≠ current base: relocate (`jsr 0x28`, `jsr 0x38`), store base in A4+28; cache-flush decision via `$A746` GetToolTrapAddress(`$A89F`) vs `$A346` GetOSTrapAddress(`$A198`), then `$A198` HWPriv d0=1 | |
| CDEF 3 `0x104..0x114` | `lea 0x0; addal #11556`; `$A055`; `exg d0,a4` | |
| CDEF 3 `0x116..0x13a` | CodeWarrior sparse-switch helper (default offset, low, high, count−1, then value/offset pairs; offsets relative to their own word) | |
| `0x38..0xac` | relocation runtime (out of scope, `inScope:false`) | |

## E2. CDEF 3 gate: CheckResources `0x13c..0x1d2`; main delegation `0x1fc..0x286`

| addr | fact | verifier |
|---|---|---|
| CDEF 3 `0x144..0x170` | rect copy; d0 = bottom−top, d1 = right−left; `cmpw d0,d1; bles` → horizontal = width > height | |
| CDEF 3 `0x172..0x17a` | d3 = −10144; not horizontal → `addiw #16` → −10128 | |
| CDEF 3 `0x17e..0x18c` | `clrb` flag, push d3, `bsrl 0x2b96` ('cinf' get); non-nil → true | |
| CDEF 3 `0x18e..0x1a8` | `btst #3,fp@(9)` (varCode low byte bit 3) → try d3+12 | |
| CDEF 3 `0x1aa..0x1c4` | `btst #2,fp@(9)` → try d3+6 | |
| CDEF 3 `0x1c6..0x1d2` | return 1 / 0 | |
| CDEF 3 `0x20e..0x21a` | main: `jsr 0x13c(varCode, control)`; true → `0x28a` | |
| CDEF 3 `0x21c..0x250` | false: SetZone(low-memory SysZone, `$2A6`); `$A994` CurResFile; `$A998` UseResFile(0); `$A81F` Get1Resource(`0x43444546` 'CDEF', 3); UseResFile(saved); SetZone(saved low-memory TheZone, `$118`) | |
| CDEF 3 `0x252..0x258` | handle nil or `*h` nil → `0x28a` (Kaleidoscope path, G3) | |
| CDEF 3 `0x25a..0x286` | HGetState/HLock; push varCode, control, message, param; `$A055` on `*h`; `jsr a0@`; result → `sp@(68)`; HSetState; `braw 0x6c4` (skips the thumb release) | |
| CDEF 3 `0x1d4..0x1fb` | Macsbug name `CheckResources__FsPP13ControlRecord` (raw bytes E11) | |

## E3. CDEF 3 private record and per-message state `0x28a..0x4a8`

| addr | fact | verifier |
|---|---|---|
| CDEF 3 `0x28a..0x2b0` | A4 setup; d4 = contrlData; non-nil and `GetHandleSize` (`0x2d16`) = 48 → `0x344` | |
| CDEF 3 `0x2b2..0x2da` | nil → `$A122` NewHandle(48) → contrlData; `clrw` +0, +2; `$A8D8` NewRgn → +4 | |
| CDEF 3 `0x2de..0x2e2` | `$A024` SetHandleSize(48) (both new and wrong-size records) | |
| CDEF 3 `0x2e4..0x312` | +8 = width > height | |
| CDEF 3 `0x316..0x332` | +20 = 0; `btst #2,d5` → 1; `btst #3,d5` → 2 (bit 3 wins) | |
| CDEF 3 `0x338..0x340` | `clrb` +9, +10 | |
| CDEF 3 `0x34a..0x35c` | every message: +22 = −10144; +8 clear → `addiw #16` | |
| CDEF 3 `0x362..0x3a0` | `$AA1E` GetCIcon(+20·6 + +22 + 3) → +24; nil → GetCIcon(+22 + 3) | |
| CDEF 3 `0x3a2..0x3a8` | +24 nil → skip to `0x43e` | |
| CDEF 3 `0x3ac..0x3f4` | horizontal: +32 = bounds.right − bounds.left (`a1@(12) − a0@(8)`); +44 = (ctl.right − ctl.left) − +32 − 2·(+28) (`0x3d6` reads +28 before `0x480` writes it) | |
| CDEF 3 `0x3fa..0x43a` | vertical: +32 = bounds.bottom − bounds.top; +44 = (ctl.bottom − ctl.top) − +32 − 2·(+28) | |
| CDEF 3 `0x43e..0x470` | `0x2b96`(+20·6 + +22, false), else `0x2b96`(+22, false) | |
| CDEF 3 `0x472..0x480` | found: `moveq #0; moveb a0@` → +28 (unsigned byte 0); not found: +28 unchanged | |
| CDEF 3 `0x484..0x4a8` | +36 = `subw` value−min, `extl`; +40 = `subw` max−min, `extl` | |

## E4. CDEF 3 message switch `0x4ac..0x6ca`

Sparse switch at `0x4b6..0x4fd` (raw bytes E11): default → `0x6a8`; 0→`0x4fe`, (CDEF 3)
1→`0x516`, 2→`0x52a`, 3→`0x59c`, 4→`0x5ca`, 5→`0x5fe`, 6→`0x610`, 7→`0x6a8`, (CDEF 3)
8→`0x6a8`, 10→`0x56c`, 11→`0x57e`, 13→`0x648`, 19→`0x632`, 26→`0x658`, (CDEF 3)
27→`0x62a`, 34→`0x668`. (CDEF 3)

| addr | fact | verifier |
|---|---|---|
| CDEF 3 `0x4fe..0x512` | `tstb a0@(16)` contrlVis → `bsrl 0xd66` DoDraw | |
| CDEF 3 `0x516..0x526` | `bsrl 0xb90`(param point, control) → result | |
| CDEF 3 `0x52a..0x550` | param < 0 → `0xa82` thumb rect, `$A8DF` RectRgn(param & 0xFFFFFF) | |
| CDEF 3 `0x554..0x568` | else RectRgn(param & 0xFFFFFF, contrlRect) | |
| CDEF 3 `0x56c..0x57a` | msg 10: RectRgn(param, contrlRect) | |
| CDEF 3 `0x57e..0x598` | msg 11: `0xa82` → RectRgn(param) | |
| CDEF 3 `0x59c..0x5be` | msg 3: `btst #1,d5` and `cmpib #2,+20` ≠ → +0 = value (`a0@(18)`); value = min (`movew a0@(20),a1@(18)`) | |
| CDEF 3 `0x5c2..0x5c6` | else `clrw` +0 | |
| CDEF 3 `0x5ca..0x5fa` | msg 4: `$AA25` DisposeCIcon(+24); `$A8D9` DisposeRgn(+4); `$A023` DisposeHandle(contrlData); a2 = nil | |
| CDEF 3 `0x5fe..0x60c` | msg 5: `bsrl 0xc22`(param, control) | |
| CDEF 3 `0x610..0x626` | msg 6: `bsrl 0x95e`(param, *param, control) | |
| CDEF 3 `0x62a` | msg 27: `#544172832` = `0x206f6b20` `' ok '` | |
| CDEF 3 `0x632..0x646` | msg 19: 1; `btst #0,d5` → `oril #1024`; `oril #8192` | |
| CDEF 3 `0x648..0x656` | msg 13: `bsrl 0x7ee` | |
| CDEF 3 `0x658..0x666` | msg 26: `bsrl 0x6d6` | |
| CDEF 3 `0x668..0x6a0` | msg 34: param record (+0 part, +2 sub-index, +4 tag): sub 1 and part 22/23 → `0x736c7470` 'sltp'; sub 5 → bit 0 ? `0x736c7468` 'slth' : `0x736c6768` 'slgh' | |
| CDEF 3 `0x6a8..0x6ba` | a2 non-nil and +24 non-nil → `$AA25` DisposeCIcon(+24) (+24 not cleared) | |
| CDEF 3 `0x6bc..0x6ca` | restore A4; result; `rtd #12` | |

## E5. CDEF 3 band, thumb rect, hit test (`0x866..0xbf6`)

| addr | fact | verifier |
|---|---|---|
| CDEF 3 `0x87e..0x88a` | band = contrlRect | |
| CDEF 3 `0x890..0x8a8` | horizontal: switch +20 (0/1/2, other → unchanged) | |
| CDEF 3 `0x8ac..0x8b4` | g0: bottom = top + 16 | |
| CDEF 3 `0x8b6..0x8be` | g1: top = bottom − 16 | |
| CDEF 3 `0x8c0..0x8d8` | g2: d1 = top+bottom; `lsrw #8; lsrw #7; addw; asrw #1` (signed /2 toward zero); top = d1 − 8; bottom = top + 16 | |
| CDEF 3 `0x8de..0x928` | vertical: same on left/right (`a2@(2)`, `a2@(6)`) | |
| CDEF 3 `0xa9c..0xaa2` | `$A8A7` SetRect(r, 0,0,0,0) | |
| CDEF 3 `0xaa4..0xaaa` | +24 nil → return empty | |
| CDEF 3 `0xaae..0xab2` | r = band (`jsr 0x866`) | |
| CDEF 3 `0xac0..0xaf8` | horizontal, +40 ≠ 0: d1 = (r.right − r.left) − +32 − 2·+28; `mulsl` +36; `divsll` +40; + +28; `addw` to r.left | |
| CDEF 3 `0xafc..0xb08` | r.right = r.left + +32 | |
| CDEF 3 `0xb0e..0xb4e` | vertical, +40 ≠ 0: d1 = (r.bottom − r.top) − +32 − 2·+28; d2 = (+40 − +36)·d1 / +40 + +28; `addw` to r.top | |
| CDEF 3 `0xb50..0xb5a` | r.bottom = r.top + +32 | |
| CDEF 3 `0xb94..0xbb4` | thumb rect `fp-8`, band `fp-16`; `$A8AD` PtInRect(pt, band) | |
| CDEF 3 `0xbbc` | false → `0xbf2` → 0 | |
| CDEF 3 `0xbbe..0xbd4` | PtInRect(pt, thumb) → 129 | |
| CDEF 3 `0xbd6..0xbde` | pt.h (`fp@(10)`) < thumb.left (`fp@(-6)`) → 22 | |
| CDEF 3 `0xbe0..0xbec` | pt.v (`fp@(8)`) ≥ thumb.top (`fp@(-8)`) → 23, else 22 | |

## E6. CDEF 3 tracking messages (`0x6d6..0x836`, `0x95e..0xa3c`, `0xc22..0xd36`)

| addr | fact | verifier |
|---|---|---|
| CDEF 3 `0x6f0..0x6f4` | msg 26: +24 nil → skip to `0x77e` (no value change) | |
| CDEF 3 `0x6f8..0x704` | d4 = max − min (word, `extl`) | |
| CDEF 3 `0x706..0x70c` | band → `fp-8` | |
| CDEF 3 `0x71c..0x738` | horizontal: rgnBBox.left (`*rgn`+4) − band.left (`fp@(-6)`) − +28 | |
| CDEF 3 `0x73a..0x74e` | vertical: band.bottom (`fp@(-4)`) − +28 − rgnBBox.bottom (`*rgn`+6) | |
| CDEF 3 `0x750..0x776` | `mulsl d4`; d1 = (+44 + sign) >> 1; + ; `divsll fp@(-12)` (+44); + min; `movew` to value (`a0@(18)`) — no SetControlValue | |
| CDEF 3 `0x77e..0x7a2` | +10 = 1; +12..+19 = rgnBBox; DoDraw; +10 = 0 | |
| CDEF 3 `0x7ee..0x836` | msg 13 (one routine split at `0x82a`, `0x82e` by the index): +9 = 1; +12..+19 = rgnBBox; DoDraw; `clrb` +9 (`0x82a`); return (`0x82e`) | |
| CDEF 3 `0x982..0x986` | msg 6: +24 nil → return | |
| CDEF 3 `0x98a..0x9a2` | band → `fp-8`, limitRect (`a3`), slopRect (`a3+8`) | |
| CDEF 3 `0x9b2..0x9e8` | horizontal: axis (`a3@(16)`) = 1; d1 = +44·+36 / +40; limit.left = pt.h − d1; limit.right = limit.left + +44 + 1 | |
| CDEF 3 `0x9ee..0xa26` | vertical: axis = 2; d1 = (+40 − +36)·+44 / +40; limit.top = pt.v − d1; limit.bottom = top + +44 + 1 | |
| CDEF 3 `0xa2a..0xa34` | `$A8A9` InsetRect(slop, `#-917519` = `0xFFF1FFF1`: −15, −15) | |
| CDEF 3 `0xc38..0xc3c` | msg 5: +24 nil → return | |
| CDEF 3 `0xc54..0xc86` | horizontal dh > 0: (dh·+40 + trunc(+44/2)) / +44 | |
| CDEF 3 `0xc8a..0xcba` | dh ≤ 0: −(((−dh)·+40 + trunc(+44/2)) / +44) (`negl` before `divsll`) | |
| CDEF 3 `0xcbc..0xcf0` | vertical dv > 0: −((dv·+40 + trunc(+44/2)) / +44) | |
| CDEF 3 `0xcf2..0xd1a` | dv ≤ 0: ((−dv)·+40 + trunc(+44/2)) / +44 | |
| CDEF 3 `0xd20..0xd2e` | `$A963` SetCtlValue(value + Δ) | |

## E7. CDEF 3 draw entry: DoDraw `0xd66..0xdae`, NewDeviceLoop `0x16ba..0x187c`

| addr | fact | verifier |
|---|---|---|
| CDEF 3 `0xd72..0xd8c` | rgn = `$A8D8` NewRgn; `$A8DF` RectRgn(contrlRect) | |
| CDEF 3 `0xd8e..0xda4` | `0x16ba`(rgn, `pea 0xdce` (relocated operand `0xd96`), control, 0); DisposeRgn | |
| CDEF 3 `0x16c2..0x16e6` | `$A874` GetPort; region = visRgn ∩ clipRgn ∩ rgn (`$A8E4` SectRgn ×2) | |
| CDEF 3 `0x16e8..0x16fa` | d3 = 1; colour port (`0x1956`) → 0 | |
| CDEF 3 `0x16fc..0x1706` | d4 = IsOffscreen (`0x19a2`) | |
| CDEF 3 `0x1708..0x1714` | grafProcs (+104) non-nil → d3 = 0 | |
| CDEF 3 `0x171a..0x172a` | picSave (+92) or rgnSave (+96) → d4 = 1 | |
| CDEF 3 `0x172c..0x1744` | else `$A8E2` EmptyRgn or pnVis (+66) < 0 → DisposeRgn, return | |
| CDEF 3 `0x1748..0x174c` | d4 → d3 = 0 | |
| CDEF 3 `0x174e..0x17f8` | d3 (monochrome port): LocalToGlobal; switch to `0x1912` main port, SetOrigin, SetClip(region), copy text font/size/face/mode, black/white | |
| CDEF 3 `0x17fa..0x1826` | d4: call proc directly(depth = colour ? pixMap pixelSize (+32) : 1, flags 0, `$AA32` GetGDevice, userData) | |
| CDEF 3 `0x1828..0x1838` | else `$ABCA` DeviceLoop(region, proc, userData, 0) | |
| CDEF 3 `0x183a..0x1870` | d3: restore clip, origin, text, colours, port | |
| CDEF 3 `0x18b2..0x18f0` | HasColorQD: Gestalt `0x71642020` 'qd  ' ≥ 256, cached in A4+12 (initial `0xFF` = unknown) | |
| CDEF 3 `0x1912..0x1932` | GetMainPort: `$AA48` GetCWMgrPort or `$A910` GetWMgrPort | |
| CDEF 3 `0x1956..0x196e` | IsColorGrafPort: portVersion's top two bits both set | |
| CDEF 3 `0x19a2..0x1a06` | IsOffscreen: false if CurApRefNum (low memory `$900`) = 0 or CurApName length (low memory `$910`) > 31; else port base address ≠ main port's | |

## E8. CDEF 3 drawer `0xdce..0x1474`

| addr | fact | verifier |
|---|---|---|
| CDEF 3 `0xdea..0xdf0` | `bsrl 0x1a34`(device): lowDepth from gdPMap pixelSize and gdFlags bit 0 (`0x1b70`: > 4 → 0; < 4 → 1; = 4 → colour flag) | |
| CDEF 3 `0xdf2..0xe1c` | device nil → gworld nil; else `$AB1D` `#0x160000` NewGWorld(&gw, depth `fp@(18)`, contrlRect, nil, device, `pea 0x2` = noNewDevice); error → gw nil | |
| CDEF 3 `0xe20..0xe24` | gw nil → `0x146e` (return) | |
| CDEF 3 `0xe28..0xe5c` | `#0x40017` GetGWorldPixMap; `#0x40001` LockPixels; `#0x80005` GetGWorld(&port, &gd); `#0x80006` SetGWorld(gw, device) | |
| CDEF 3 `0xe5e..0xe80` | saved port colour → `$AA14` RGBForeColor(port+36), `$AA15` RGBBackColor(port+42) | |
| CDEF 3 `0xe82..0xeb4` | bkPixPat (+32) non-nil, size 28: patType ≠ 0 → `$AA0B` BackPixPat; else `$A87C` BackPat(pat1Data +20) | |
| CDEF 3 `0xeb6..0xec8` | `$AA73` d0 = `#29`, args (control, depth, `moveb #1`) — not in Traps.h 3.0.1 | |
| CDEF 3 `0xeca..0xed0` | `$A8A3` EraseRect(contrlRect) | |
| CDEF 3 `0xed2..0xef6` | d3: hilite `cmpib #-2` or `#-1` → 0; hilite ≠ 0 → 2; else 1 | |
| CDEF 3 `0xef8..0xf0a` | band → `fp-36` | |
| CDEF 3 `0xf0e..0xfa4` | horizontal: `0x2970` with +20·6 + +22 + d3; then +20·6 + +22 + 1; then +22 + d3; then +22 + 1 (stop at first true) | |
| CDEF 3 `0xfa8..0x1038` | vertical: the same with `0x1486` | |
| CDEF 3 `0x103a..0x1060` | d3: hilite −2/−1 → 0; `cmpib #-127` (129) → 2; else 1 | |
| CDEF 3 `0x1062..0x107a` | +24 nil → `0x112e`; src = +24 bounds | |
| CDEF 3 `0x1080..0x10c0` | +9: horizontal src top 48, bottom 64 (`fp@(-24)`, `fp@(-20)`); vertical left 48, right 64; `0x24fa`(+24, src, +12 rect) | |
| CDEF 3 `0x10c4..0x10f0` | horizontal: src top = d3 `lsll #4`, bottom = top + 16; vertical: left/right likewise | |
| CDEF 3 `0x10f2..0x1116` | +10 → dst = +12..+19; else dst = `0xa82` thumb rect | |
| CDEF 3 `0x1116..0x112a` | `0x24fa`(+24, src, dst) | |
| CDEF 3 `0x112e..0x1134` | `cmpiw #1,+0; blew 0x13ba` | |
| CDEF 3 `0x1138..0x113c` | d3 ≠ 0 → 1 | |
| CDEF 3 `0x113e..0x1176` | GetCIcon(+20·6 + +22 + 4 + d3), else GetCIcon(+22 + 4 + d3); nil → `0x13ba` | |
| CDEF 3 `0x117a..0x1184` | tick bounds → `fp-8` | |
| CDEF 3 `0x1194..0x11a4` | horizontal: ctl.bottom − ctl.top < 24 → `0x13b6` (dispose) | |
| CDEF 3 `0x11a8..0x11c8` | +20 = 0: tick top = ctl.top + 16, bottom = top + tick.bottom − tick.top | |
| CDEF 3 `0x11ca..0x11e0` | else: bottom = ctl.bottom − 16, top = bottom − tick.bottom + tick.top | |
| CDEF 3 `0x11e2..0x11f2` | +0 < 2 or +40 ≤ 0 → `0x13b6` | |
| CDEF 3 `0x11fc..0x1228` | v_i = (i·+40 + trunc((n−1)/2)) / (n−1) (`divsll`) | |
| CDEF 3 `0x122e..0x124e` | d1 = ctl.left + +28 + (+44·v_i / +40) | |
| CDEF 3 `0x1250..0x1260` | d0 = +32 − tick.right (`fp@(-2)`) − tick.left (`fp@(-6)`) | |
| CDEF 3 `0x1262..0x127e` | left = trunc(d0/2) + d1; right = left + tick.right − tick.left | |
| CDEF 3 `0x1282..0x129c` | `0x24fa`(tick, tick bounds, tick rect); loop i < +0 | |
| CDEF 3 `0x12a4..0x12f0` | vertical: ctl.right − ctl.left < 24 → dispose; g0 left = ctl.left + 16; else right = ctl.right − 16 | |
| CDEF 3 `0x130c..0x13b2` | vertical loop: d0 = (+40 − v_i)·+44 / +40; d1 = ctl.top + +28 + d0; centring with tick.bottom (`fp@(-4)`) and tick.top (`fp@(-8)`) | |
| CDEF 3 `0x13b6..0x13b8` | `$AA25` DisposeCIcon(tick) | |
| CDEF 3 `0x13ba..0x13c8` | SetGWorld(saved port, saved gd) | |
| CDEF 3 `0x13ca..0x13e0` | save fg/bg; RGBForeColor(A4+6 black), RGBBackColor(A4+0 white) | |
| CDEF 3 `0x13e2..0x1428` | colour port: CopyBits(GetGWorldPixMap(gw), GetGWorldPixMap(port), contrlRect, contrlRect, mode 0, maskRgn nil) | |
| CDEF 3 `0x142a..0x1454` | else CopyBits(gw pixmap, port+2 portBits, …, 0, nil) | |
| CDEF 3 `0x1456..0x146c` | restore colours; `#0x40004` DisposeGWorld | |

## E9. CDEF 3 track slicing: StretchIconHorizontal `0x2970..0x2b72`, StretchIconVertical `0x1486..0x1698`

| addr | fact | verifier |
|---|---|---|
| CDEF 3 `0x2978..0x298a` | `0x2664` MyGetCIcon(id); nil → false | |
| CDEF 3 `0x298e..0x29ae` | `0x2b96`(id, false); nil → `0x28b2` release, false | |
| CDEF 3 `0x29b0..0x29be` | k = byte 0 (unsigned); HGetState/HLock cinf | |
| CDEF 3 `0x29c0..0x29d6` | S = cicn bounds (`fp-24..-18`), D = *rect (`fp-16..-10`) | |
| CDEF 3 `0x29dc..0x2a04` | D.top = trunc((D.top + D.bottom − S.bottom + S.top)/2); D.bottom = D.top + S.bottom − S.top | |
| CDEF 3 `0x2a08..0x2a16` | `cmpw` 2k vs D.right − D.left: `bgtw 0x2aac` when width > 2k | |
| CDEF 3 `0x2a1a..0x2a50` | halves 1: src.right = S.left + trunc((W+1)/2); `0x247e`(cicn, src, D.left, D.top) | |
| CDEF 3 `0x2a54..0x2aa0` | halves 2: src.left = S.right − trunc(W/2); `0x247e`(cicn, src, D.right − trunc(W/2), D.top) | |
| CDEF 3 `0x2aac..0x2ad0` | cap 1: src.right = S.left + k → at (D.left, D.top) | |
| CDEF 3 `0x2ad4..0x2afc` | cap 2: src.left = S.right − k → at (D.right − k, D.top) | |
| CDEF 3 `0x2b00..0x2b10` | middle src = S with left += k, right −= k | |
| CDEF 3 `0x2b14..0x2b26` | `tstb a0@(2)` (byte 2) = 0 → src.right = src.left + 1 | |
| CDEF 3 `0x2b2a..0x2b3a` | dst = D with left += k, right −= k | |
| CDEF 3 `0x2b3e..0x2b58` | flag = (byte 3 = 0) (`seq; negb`); `0x2012`(cicn, src, dst, flag) | |
| CDEF 3 `0x2b5c..0x2b6a` | HSetState(cinf); `0x28b2` release cicn; true | |
| CDEF 3 `0x1486..0x167c` | vertical mirror: centring on left/right (`0x14f6..0x151e`), 2k vs height (`0x1522..0x1530`), halves at (D.left, D.top) and (D.left, D.bottom − trunc(H/2)) (`0x1534..0x15c6`), caps (`0x15ca..0x1622`), byte 2 (`0x1636..0x1648`), byte 3 (`0x1660..0x1676`) | |

## E10. CDEF 3 blit helpers (`0x1a86..0x28ea`, `0x2b96..0x2d16`)

| addr | fact | verifier |
|---|---|---|
| CDEF 3 `0x1a86..0x1ad6` | PrepareCIcon: HLock cicn and iconData; pixmap baseAddr = *iconData; mask baseAddr = cicn+82; iconBMap baseAddr = +82 + (mask bottom − top)·mask rowBytes | |
| CDEF 3 `0x1af2..0x1b0a` | ReleaseCIcon: HUnlock both | |
| CDEF 3 `0x1b26..0x1b56` | SetBlackAndWhite: A4+6..11 = 0, A4+0..5 = `0xFFFF`; RGBForeColor(A4+6), RGBBackColor(A4+0) | |
| CDEF 3 `0x24fa..0x2550` | PlotCIconHandleRect(cicn, src, dst): colour = portVersion test; skip if dst.bottom ≤ clipBBox.top or dst.top ≥ clipBBox.bottom | |
| CDEF 3 `0x2552..0x2566` | save colours; SetBlackAndWhite; PrepareCIcon | |
| CDEF 3 `0x2568..0x257e` | A4+22 or not colour → source = iconBMap (+64); else iconPMap | |
| CDEF 3 `0x2588..0x25ca` | picSave or grafProcs: BitMapToRegion `$A8D7`(mask), MapRgn `$A8FB`(src→dst), CopyBits(src, portBits, src, dst, 0, rgn) | |
| CDEF 3 `0x25cc..0x25dc` | else `$A817` CopyMask(srcBits, maskBMap, portBits, src, src, dst) | |
| CDEF 3 `0x25de..0x25f0` | ReleaseCIcon; restore colours | |
| CDEF 3 `0x247e..0x24c4` | PlotCIconHandlePoint(cicn, src, h `fp@(16)`, v `fp@(18)`): dst = src offset by (h − src.left, v − src.top); `0x24fa` | |
| CDEF 3 `0x2012..0x2030` | PlotCIconTiled(cicn, src, dst, flag) → `0x205e`(…, pixmap nil) | |
| CDEF 3 `0x2072..0x2096` | dst or src empty → return | |
| CDEF 3 `0x20a0..0x20da` | colour flag d7; clip bbox test (vertical only) | |
| CDEF 3 `0x20de..0x20ea` | save colours; SetBlackAndWhite | |
| CDEF 3 `0x20ee..0x2164` | src width 1, dst width > 1: txFont → `#-12345`; for y in src rows while dy < dst.bottom: `0x1bc0`(cicn, src.left, y, true) → MoveTo(dst.left, dy), LineTo(dst.right − 1, dy); restore txFont | |
| CDEF 3 `0x2168..0x21c8` | src height 1, dst height > 1: per column, `0x1bc0`(cicn, x, src.top, true) → vertical line | |
| CDEF 3 `0x21cc..0x2226` | PrepareCIcon; d5 = src width, d3 = src height; source bits per `0x21fa..0x221e` (lowDepth / not colour → iconBMap; pixmap arg; else iconPMap) | |
| CDEF 3 `0x2228..0x2330` | flag ≠ 0: piece = [dst.left, +d5) × [dst.top, +d3); clip right/bottom (src cut at end); picSave → CopyBits unmasked, else CopyMask; advance: dst height ≠ d3 → down by d3, else right by d5; loop while left < dst.right and top < dst.bottom | |
| CDEF 3 `0x2334..0x2414` | flag = 0: piece = [dst.right − d5, dst.right) × [dst.bottom − d3, dst.bottom); clip left/top (src cut at start); advance left/up; loop while right > dst.left and bottom > dst.top | |
| CDEF 3 `0x2418..0x2440` | (dispose of an always-nil gworld); ReleaseCIcon; restore colours | |
| CDEF 3 `0x1bc0..0x1bf2` | CIconHandleForeColor: `0x1c1c`(cicn, h, v, &rgb, flag); RGBForeColor(rgb) (even when false); return result | |
| CDEF 3 `0x1c1c..0x1c78` | flag: mask byte at +82 + v·(maskRowBytes & 32767) + (h >> 3), bit 7 − (h & 7); else 1 | |
| CDEF 3 `0x1c7c..0x1c7e` | mask clear → return false | |
| CDEF 3 `0x1c82..0x1d08` | lowDepth: iconBMap bit → black (A4+6) or white (A4+0) | |
| CDEF 3 `0x1d0c..0x1dc8` | else pixel at depth 1/2/4/8 from *iconData + v·rowBytes; other depths read nothing | |
| CDEF 3 `0x1dcc..0x1de2` | `0x28ea` TableColor(pmTable, &rgb, pixel) | |
| CDEF 3 `0x28ea..0x2944` | index ≤ ctSize and entry[index].value = index → index; else entry[ctSize].value = 0 → index; else search value from ctSize down; none → 0 | |
| CDEF 3 `0x2664..0x26a0` | MyGetCIcon: SysZone; save CurResFile; Gestalt `0x436f706c` 'Copl' noErr → UseResFile(low word) | |
| CDEF 3 `0x26a2..0x26a6` | A4+24 nil → `0x287e` (always: E11) | |
| CDEF 3 `0x26aa..0x287c` | cache switch over −14332..−14330, −12288, −12287, −12272, −10224, −10223, −10208..−10205, −8286, −8285, −8278, −8277, −8272, −8271 (no slider id); `0x2628` GetCacheIcon | |
| CDEF 3 `0x287e..0x2896` | A4+18 = cached (nil); nil → `$AA1E` GetCIcon(id); restore zone and file | |
| CDEF 3 `0x28b2..0x28cc` | MyDisposeCIcon: handle ≠ A4+18 → clear A4+18, DisposeCIcon | |
| CDEF 3 `0x2b96..0x2bcc` | `cinf` get: SysZone; `$A9A0` GetResource(`0x63696e66` 'cinf', id); `$A9A2` LoadResource; `$A04A` HNoPurge | |
| CDEF 3 `0x2bce..0x2bd2` | flag false → return handle (`0x2cf0`) | |
| `0x2bd6..0x2cee` | flag true and size ≠ 54: extend to 54 bytes with colours sampled by `0x1e20` (unreachable from CDEF 3: callers `0x17e`, `0x196`, `0x1b2`, `0x43e`, `0x460`, `0x298e`, `0x14a6` all push false) | |
| CDEF 3 `0x2d16..0x2d22` | GetHandleSize glue (negative → 0) | |

## E11. Raw-byte spot checks

| bytes | fact | verifier |
|---|---|---|
| CDEF 3 `0x2d24..0x2d44` | `ffff ffff ffff 0000 0000 0000 ff00 0000 …` then zeros: A4+0 white, +6 black, +12 `0xFF`, +18/+22/+24 zero | |
| CDEF 3 `0x2d45..0x2d4a` | relocation table: count `0000 0001` at `0x2d45..0x2d48`, one two-byte entry `46 cb` at `0x2d49` → (the word `46cb` hex shifted left 2, then right 1) = `0xd96`, the operand of `pea 0xdce` in DoDraw. So A4+24 is never relocated or written: the icon cache is never used | |
| CDEF 3 `0x4b6..0x4fd` | switch: `01f2 0000 0022 000f` then (0, `003e`), (1, `0052`), (2, `0062`), (3, `00d0`), (4, `00fa`), (5, `012a`), (6, `0138`), (7, `01cc`), (8, `01c8`), (10, `0088`), (11, `0096`), (13, `015c`), (19, `0142`), (26, `0164`), (27, `0132`), (34, `016c`) | |
| CDEF 3 `0x1d4` | `80 23` + `CheckResources__FsPP13ControlRecord` (Macsbug long name) | |

Grep facts (listing): writes to A4+24: none; A4+22 written only at
`0x1b7c`, `0x1b8a`, `0x1b98`, `0x1ba0`, `0x2c06`, `0x2c74`, `0x2ce4`; record +2 never read; (CDEF 3)
record +4 read only at `0x5e2..0x5ea` (dispose). (CDEF 3)

## E12. Corpus census and the Kaleidoscope control-panel file

- Census: `campaign-20261021/v2-lanes/spec-slider/scripts/census.mjs` and
  `census-cells.mjs` (read the 18 archives' own forks through
  `tools/theme-loader/containers.js` and `tools/sit-wasm`; no original code is
  read). Outputs `census.json` SHA-256 `2942ae48…29cbc`, `census-cells.json`
  SHA-256 `0feaa109…4f08e0` (private store). Worktree head `3603c36d`.
- Kaleidoscope 2.3.1 resource index `.scratch/k231-kdef/_index.json`
  (SHA-256 `b824a38b…762969`): `cinf` ids −9968..−9964, −9960..−9956, 0, 1; no
  `cinf` or `cicn` in −10144..−10111. No archive ships a `CDEF` resource.

| claim (spec §6 corpus table) | census fact | verifier |
|---|---|---|
| G1 archives | `cinf` −10144 and −10128 present in exactly 1138, 1984, 1990, animals, apple-lisa, beos-r503, crayon-os, dolphin-som, evolution, windows-31, windows-95 | |
| floppies | cicns −10144..−10111 present (tracks 40×4 / 4×40), zero `cinf` in range | |
| six archives | no resource in −10144..−10111 | |
| bytes | cinf bytes 0..3: 1138 5,16,1,0; 1984 10,16,0,0; 1990 5,16,1,0; animals 10,16,0,0; apple-lisa 5 (g1 4),16,0,0; beos-r503 2,16,0,0; crayon-os 3,3,1,0; dolphin-som 5,16,1,0; evolution 5,16,1,0; windows-31 1,1,0,0; windows-95 2,4,0,0 | |
| thumb cells | no cell 0 is all mask-clear in any archive (per-cell clear counts in `census-cells.json`) | |
| bounds | every cicn in range has bounds top-left (0, 0) | |

