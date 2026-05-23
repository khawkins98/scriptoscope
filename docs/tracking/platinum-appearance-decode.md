# Platinum appearance decode — Mac OS 8.0 (68k) WDEF/CDEF

Reverse-engineering the **original** Mac OS 8.0 Platinum drawing so we can
reimplement it faithfully (clean-room) in our pixel compositor (`src/platinum.ts`)
— the engine fallback for cicn-less / no-theme rendering. Same playbook as the
Kaleidoscope kDEF (`kdef231-reference.md`), applied to Apple's own window/control
definitions. **Work in progress** (started 2026-05-23, autonomous session).

## Why this source
Platinum is **procedural QuickDraw code**, not bitmaps/vectors (confirmed: the
8.6 Appearance folder has no theme artwork; the System cicns are 32×32 alert
icons, not control glyphs). The **8.0 m68k** System file is the tractable target:
its WDEF/CDEF are **68k** (our existing `m68k-elf-objdump` + Ghidra pipeline) and
they draw the frame **directly** with QuickDraw — no `_AppearanceDispatch`
indirection — so the exact algorithm + colors are recoverable from one resource
each, like the kDEF.

## Toolchain (reproducible)
```
# the 8.0 m68k install CD (HFS):
hmount "~/Downloads/Apple Mac OS 8.0/Apple MacOS 8.0 (m68k).iso"
hcd "System Folder"; hcopy -m "System" /tmp/sys80.macbin   # MacBinary = both forks
# extract the resource fork from the MacBinary (rsrcLen @ off 87), then:
#   parseResourceFork (tools/theme-loader) -> WDEF/CDEF bytes -> .bin
m68k-elf-objdump -D -b binary -m m68k:68040 -EB WDEF_0.bin > WDEF_0.asm
```
Extracted to `/tmp/platinum-trace/`: `WDEF_0.bin` (4206B, window), `CDEF_0.bin`
(1350B, push button + checkbox/radio via varCode), `CDEF_1.bin` (3172B, scrollbar),
`MDEF_0.bin` (4654B, menu).

## QuickDraw trap reference (the drawing vocabulary)
`MoveTo $A893 · LineTo $A891 · Move $A894 · Line $A892 · FrameRect $A8A1 ·
PaintRect $A8A2 · EraseRect $A8A3 · InvertRect $A8A4 · FillRect $A8A5 ·
FrameRoundRect $A8B0 · PaintRoundRect $A8B1 · RGBForeColor $AA14 · RGBBackColor
$AA15 · GetForeColor $AA19 · GetBackColor $AA1A · ForeColor $A862 · BackColor
$A863 · PenPat $A89D · PenSize $A89B · PenMode $A89C · GetResource $A9A0`.

## Resource inventory (8.0 System)
- `wctb 0` — the window color table is the **B&W default** (white content, black
  frame); the Platinum **grays are RGBColor immediates in the WDEF/CDEF code**,
  not this table.
- `cicn` (15) — all 32×32 system/alert icons (NOT control glyphs).
- `ppat 16` (128×128), `ppat 18` (8×8), `ppat 42` (16×16) — background/pen
  patterns (candidate: the 8×8 may be a fill pattern). Not yet characterized.
- `cctb 0` (control colour table) — **also B&W default** (#000 frame / #fff body /
  #000 text + #ccccff/#333366 selection), like `wctb 0`. So the Platinum control
  grays are NOT in any resource — they're supplied by the **Appearance Manager**,
  which is a **PPC CFM library** (`cfrg` directory present; code in the System data
  fork), NOT a 68k resource. → the exact control gradient/colours are only
  obtainable by reverse-engineering the PPC Appearance Manager (`DrawThemeButton`)
  — a separate, much larger effort than these clean 68k WDEF/CDEF decodes. The
  WINDOW (WDEF 0) is the one piece that draws Platinum *directly* in decodable 68k.

## WDEF 0 — window frame drawing recipe (DECODED)

Resource has a 12-byte header (`600a` branch + `'WDEF'` + `000f`); code starts at
**0xc**. Pascal args: `fp@(8)`=varCode→d6, `fp@(12)`=message, `fp@(14)`=WindowPtr→a3
(all window fields `a3@(off)`), `fp@(18)`=draw-part selector→d5 (`d5 = param & 3`;
**1 = title bar present**). Message **jump table at 0x19c** (word offsets, target =
0x19c+entry): msg0 wDraw→0x242, 1 wHit→0x694, 2 wCalcRgns→0x788, 3 wNew→0x1aa,
4 wDispose→0x236, 5 wGrow→0x806, 6 wDrawGIcon→0x860. Title-bar height = font
ascent+descent+4, **min ~19px**.

wDraw (0x242) computes the part colour then calls the appearance trap `$ABCA` with
a **callback at 0x27c** — the callback (→0x2d0) does the actual pixel drawing.
Recipe, in order (window rect in a4 = `Rect{t,l,b,r}`):
1. **Outer frame**: `FrameRect` 1px (colour index 19/active or 1=black when titled;
   bg index 0=white). If a structure shadow width `d4>0`: `PenSize(d4,d4)` + manual
   MoveTo/LineTo to **thicken the right + bottom edges** (the Platinum drop-shadow).
2. **Title-bar 3-D bevel** (when d5==1): an **8-segment** bevel from the table at
   0xfbc — active indices `{26,24,26,23,30,32,32,28}`, inactive/B&W
   `{21,21,21,21,18,18,18,18}` (+ a 50% PenPat). `drawBevelLines(topHL, leftHL,
   botShadow)` per edge + a `FrameRect`. `_InsetRect` (= trap **`$A8A9`**) shrinks
   the rect between passes.
3. **Title-bar fill + pinstripe**: `FillRect` with pattern **`FF00FF00`** =
   horizontal 1-on/1-off rows = the **racing-stripe** texture, over a light-gray
   fill. (Our `y+=2` line loop reproduces this.)
4. **Title slot**: `EraseRect` a centred slot (width = (barW−stringW)/2, min 2, or
   32 when a zoom box is present) so stripes don't run through the title; text is
   overlaid by the appearance toolbox.
5. **Widgets**: close (left) + zoom/collapse (right) via 0xb00/0xb08 — **title-bar-
   height squares**, corner-inset; each = `PaintRect` + `FrameRect`(index 22) +
   3-colour bevel (indices 7/8 active, 8/11 pressed; 36=white inner highlight).

**Colour model:** never hard-coded RGB in wDraw — every fill/line is
`getColor(index)`. Colour port: index≥16 → blend table at 0xf3c `(baseA,baseB,
frac/15)` → `baseB + (baseA−baseB)*frac/15`; index<16 → the window `wctb`. Bases
0–12 are supplied by the system Appearance at RUNTIME (the WDEF's own fallback
palette is B&W+selection-blue, NOT Platinum) — so the **blend structure is exact,
the absolute grays are the canonical Platinum ramp**:

```
white #FFFFFF · #EEEEEE · #DDDDDD · #CCCCCC (title fill) · #BBBBBB ·
#AAAAAA (stripe/mid) · #999999 · #888888 (frame) · #777777 · #666666 (shadow) · #000000
```
Inactive windows remap to the desaturated light/mid grays (#33-ish→light, →mid).

→ Implemented in `platinumWindow()`: 19px bar, `FF00FF00` pinstripe, corner-inset
square boxes, 1px frame, centred title slot. Refinements outstanding: the 8-segment
title-bar bevel + the right/bottom drop-shadow + locking the default grays to the
canonical ramp.

## CDEF 0 — button / checkbox / radio (DECODED) — and where the gradient really is

**Important architectural finding:** CDEF 0 is the *legacy* System-7-derived
`ButtonCDEF` carried into 8.0 (verified instruction-for-instruction against the
leaked 7.1 `ButtonCDEF.a`). It draws a **flat** control, NOT the glossy Platinum
gradient: a 1px `_FrameRoundRect` outline + a single-colour `_EraseRoundRect` face
+ centred title, with **all colours from the control's CCTB** (cFrameColor=idx0,
cBodyColor=idx1, cTextColor=idx2) — there are **zero RGB immediates** in the
resource. The **Platinum face gradient + highlight + shadow + default ring are
drawn by the Appearance Manager's `DrawThemeButton`**, which intercepts when
Appearance is active — that's a SEPARATE, bigger decode target (the Appearance
Manager code, not a tidy CDEF). So the gradient we reproduce procedurally is our
own faithful approximation of the documented Platinum face, not a CDEF transcript.

What CDEF 0 DID give us (the verified geometry):
- entry 0xc; message gate {0,1,2,10,11}; jump table at 0x118 → drawCntl at 0x14c.
- **Push button = rounded rect, oval diameter = control height/2 → corner radius =
  height/4** (`RoundCalc` 0x3da). ← the key fix (we had hard corners).
- Pressed: face filled with cTextColor (colour) or `_InverRoundRect` (B&W).
  Disabled: `InsetRect(1,1)` + `PenPat(50% gray)` + `PenMode(patBic)` +
  `_PaintRoundRect` (knock toward white) + grayish title text.
- **Checkbox/radio** (varCode 1/2, branch at 0x468): a **12×12** box at the left,
  vert-centred, gap ~18 to the title; checkbox = `EraseRect`+`FrameRect` (+ check
  from contrlValue), radio = `FrameOval`+`PaintOval` (+ dot); same CCTB colours +
  gray-disable path. (Matches our platinumCheckable structure.)
- Default-button ring: NOT here — Dialog/Appearance Manager adornment.

→ Implemented in `platinumButton()`: rounded rect at **radius height/4**, canonical
Platinum face gradient (FACE_TOP→FACE_BOT), 1px #888 rounded frame, white top
highlight + soft bottom shadow, rounded 2px default ring. Pressed/disabled handled.
Outstanding: decode the Appearance Manager `DrawThemeButton` for the *exact*
gradient/ring (separate target); checkbox/radio colour-from-CCTB.

## Verification
`node scripts/render-platinum.mjs <outdir>` renders the procedural sprites to PNGs
headlessly (label-less — `rasterizeText` needs a DOM canvas) for before/after
comparison as the decoded colours/geometry are folded into `platinum.ts`.

## Status / next
- [x] Confirmed 8.0 WDEF/CDEF are 68k + draw directly (tractable).
- [x] Extraction pipeline (`hfsutils` → MacBinary → resource fork → objdump) +
      headless render harness (`scripts/render-platinum.mjs`).
- [x] **WDEF 0 decoded** → `platinumWindow` refined: title-bar 3-D bevel +
      structure drop-shadow + canonical gray ramp (pinstripe/19px-bar already matched).
- [x] **CDEF 0 decoded** → `platinumButton` rewritten as a **rounded rect (radius
      = height/4)** with the Platinum gradient face, #888 rounded frame, white
      highlight, rounded default ring. The big "hard corners → rounded" fidelity fix.
- [x] Slider thumb rounded (2px) to match.
- [x] Verified in the demo (AP2 playground window + the Procedural Platinum
      baseline buttons) and confirmed NO regression on themed schemes (the
      platinum path is fallback-only; themed windows/controls use cicns).
- [ ] **The exact button gradient/ring** lives in the Appearance Manager's
      `DrawThemeButton`, NOT CDEF 0 — a separate, bigger decode target (the
      Appearance Manager code in the System, likely not a tidy resource). Our
      gradient is a faithful procedural reproduction of the documented Platinum
      face; decoding DrawThemeButton would make it byte-exact.
- [ ] CDEF 0 checkbox/radio colour-from-CCTB; CDEF 1 scrollbar exact metrics
      (current procedural versions are decode-consistent in structure + look right).
