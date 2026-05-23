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

## CDEF 0 — push button (+ checkbox/radio) drawing recipe
*(being decoded — background agent; fill with: drawCntl; rounded-rect shape +
corner radius; face gradient top/bottom grays; bevel highlight/shadow; frame;
pressed/disabled states; default ring; exact color table)*

## Verification
`node scripts/render-platinum.mjs <outdir>` renders the procedural sprites to PNGs
headlessly (label-less — `rasterizeText` needs a DOM canvas) for before/after
comparison as the decoded colours/geometry are folded into `platinum.ts`.

## Status / next
- [x] Confirmed 8.0 WDEF/CDEF are 68k + draw directly (tractable).
- [x] Extraction pipeline + headless render harness.
- [ ] WDEF 0 wDraw recipe + colors → refine `platinumWindow`.
- [ ] CDEF 0 button recipe + colors → refine `platinumButton` (rounded corners!).
- [ ] CDEF 0 checkbox/radio (varCodes) → refine `platinumCheckable`.
- [ ] CDEF 1 scrollbar → refine `platinumScrollbar`.
