# Mac OS 8.5 Platinum window proc — `WDEF` 125 decode

*Clean-room decode of the Mac OS 8.5 `System`-file `WDEF` id 125 (the Platinum
document-window proc). Mirrors the kDEF playbook: cite `0xADDR`, describe the
algorithm, **never** dump Apple's listing. Feeds the Phase-B reimplementation in
`src/platinum.ts`. Companion: [`kdef231-recipe-walk.md`](./kdef231-recipe-walk.md).*

```
# bin location (NOT committed — Apple system code; git-ignored):
#   .scratch/iso-recon/code-out/WDEF-125.bin   (5900B, raw 68k)
# disassemble:
#   m68k-elf-objdump -D -b binary -m m68k:68030 WDEF-125.bin > WDEF-125.asm
# hex-peek a region:
#   m68k-elf-objdump -s -b binary -m m68k WDEF-125.bin | sed -n '<lines>'
```

## Routine map
| addr | name | role | calls | return |
|---|---|---|---|---|
| `0x0000` | `WDEF125_main` | entry: unpack `fp@(8..18)`, set color WMgr port, dispatch on message | `GetPort`/`GetWMgrPort`/`GetCWMgrPort`/`SetPort`; `jsr 0x131c` (colorQD check) | `rtd` |
| `0x0166` | dispatch | sparse `cmpl`/`beq` chain on `d4` (no jump table); routes msg 0-6 to the stubs below; default/`6` → `0x264` exit | — | — |
| `0x0264` | common exit | re-apply fore/back color, `SetPort` back, store `d6` result → `fp@(20)` | `RGBForeColor`/`RGBBackColor`/`SetPort` | `jmp %a0@` (rtd-style) |
| `0x0294` | `wNew` (msg 3) | per-window init / aux-struct alloc (`NewHandleClear` `0xa122`) | `0xa122` | `rts` |
| `0x0392` | `wDraw` whole frame (msg 0, `param==0`) | **draw the entire Platinum window frame**: title bar, bevels, widgets — the `LineTo`/`RGBForeColor` cluster (Task 3 entry) | many; sub-drawers `0x904`/`0x9dc` | `rts` |
| `0x0b10` | `wDraw` close-box highlight (`param==4`) | procedural pressed highlight of the **close** box (geom `0x1018`, release-redraw `0x904`) | `LineTo`/`RGBForeColor` | `rts` |
| `0x0bb6` | `wDraw` zoom-box highlight (`param==5/6`) | procedural pressed highlight of the **zoom** box (geom `0x110e`, release-redraw `0x9dc`) | `LineTo`/`RGBForeColor` | `rts` |
| `0x0c84` | `wHit` (msg 1) | hit-test: which window part the point is in | — | `rts` |
| `0x0d92` | `wCalcRgns` (msg 2) | build structure/content regions — `SetRectRgn` cluster | `SetRectRgn`/region traps | `rts` |
| `0x1244` | `wGrow` (msg 5) | draw the grow outline; `param` Rect copied to `fp@(-60)` by the stub | — | `rts` |
| `0x130c` | `wDispose` (msg 4) | teardown / free per-window state | — | `rts` |
| `0x131c` | colorQD check (helper) | `jsr`-ed from the preamble; returns a byte (color QD present) | — | `rts` |

## Message dispatch

The WDEF message (`d4`, loaded from `fp@(12)`) is dispatched **after** the port
preamble, at `0x166`. Unlike the kDEF CDEF (which uses a `%pc@(0x67b6,%d0:w:2)`
jump table), this WDEF compiles its switch as a **sparse if/else chain of
`cmpl`/`beq` tests** — there is no jump table to hex-decode. The sequence:

- `0x166` `movew %d4,%d0` + `0x168` `extl %d0` — sign-extend the message word.
- `0x16a` `cmpl #3,%d0` → `beq 0x1a0` (message **3 = wNew**).
- `0x170` `tstl %d0` → `beq 0x1ac` (message **0 = wDraw**).
- `0x174` `cmpl #1,%d0` → `beq 0x220` (message **1 = wHit**).
- `0x17c` `cmpl #2,%d0` → `beq 0x234` (message **2 = wCalcRgns**).
- `0x184` `cmpl #5,%d0` → `beq 0x240` (message **5 = wGrow**).
- `0x18c` `cmpl #6,%d0` → `beq 0x264` (message **6 = wDrawGIcon** → the common
  exit; no dedicated handler, i.e. a no-op for this proc).
- `0x194` `cmpl #4,%d0` → `beq 0x25c` (message **4 = wDispose**).
- `0x19c` `bra 0x264` — default fall-through to the common exit/restore-port tail.

Each case is a short stub that pushes args and `jsr`s the real routine, then
`bra 0x264`. The common tail `0x264` re-applies fore/back color and `SetPort`s
back, stashes the `d6` result into `fp@(20)`, and returns via `rtd #12`-style
`jmp %a0@` (`0x28a`-`0x292`).

| index | message | stub | routine `0xADDR` | notes |
|---|---|---|---|---|
| 0 | wDraw | `0x1ac` | **`0x392`** (whole frame, `param==0`) | also routes widget highlights by `param` (`d3`): `0→0x392`, `4→0xb10`, `5/6→0xbb6`; guarded by `tstb a2@(110)` |
| 1 | wHit | `0x220` | `0xc84` | passes `param` (d3), window, varCode |
| 2 | wCalcRgns | `0x234` | `0xd92` | region build |
| 3 | wNew | `0x1a0` | `0x294` | per-window init / alloc |
| 4 | wDispose | `0x25c` | `0x130c` | teardown |
| 5 | wGrow | `0x240` | `0x1244` | copies the `param` Rect into `fp@(-60)` first |
| 6 | wDrawGIcon | (`0x264`) | — | unhandled → common exit (no-op) |

**wDraw `param` sub-dispatch (`0x1ac`).** After `tstb a2@(110)` (a guard byte;
skip to exit if clear), the `param` selector in `d3` is matched: `0` (whole
frame) → `jsr 0x392`; `4` (the **close box**) → `jsr 0xb10`; `5` and `6` (the
**zoom box**, top/side-titlebar variants) → `jsr 0xbb6`. So the **whole-frame
drawer is `0x392`** and the two procedural widget-highlight drawers are
`0xb10` (close pressed) / `0xbb6` (zoom pressed). The widget↔part mapping is
confirmed by `wHit 0xc84` (see Window widgets): part **3 = collapse**, part
**4 = close**, part **5 = zoom**.

### Trap-fingerprint cross-check (labels confirmed)

- **wDraw `0x392`–`0x8ec`**: contains the `LineTo` (`0xa891`) + `RGBForeColor`
  (`0xaa14`) drawing cluster — hits at `0x3fa`, `0x460`/`0x470`/`0x48c`/`0x49a`,
  `0x5c0`/`0x5da`/`0x60a`/`0x630`/`0x63e`/`0x664`/`0x676`/`0x684`, … all inside
  the routine body. A `RectRgn` (`0xa8e9`) at `0x3e6` (it computes a region while
  drawing). **Confirmed** as the frame drawer.
- **wCalcRgns `0xd92`–`0xf34`**: region-heavy — `SetRectRgn` (`0xa8df`) at
  `0xdd6`, `0xe00`, `0xe6a`, `0xec4`, `0xee4`, all inside the routine. No
  `LineTo`. **Confirmed** as the region builder.

The remaining trap hits (`aa14` at `0xfc`/`0x272`) sit in the shared
preamble/exit, not in a message handler.

## TL;DR — the algorithm
_(Task 7)_

## Title-bar fill — the pinstripe

**Headline (and a correction to the task premise):** the Platinum title bar is
**not** painted by a per-scanline `MoveTo`/`LineTo` loop. There is **no backward
branch anywhere in the whole-frame drawer `0x392`–`0x8ec`** — every conditional
and unconditional branch in that range targets a *higher* address (verified:
`0x3f0`, `0x448`, `0x472`, `0x4a0`, `0x4bc`, `0x4c6`, `0x4d0`, `0x4da`, `0x508`,
`0x512`, `0x51c`, `0x526`, `0x546`, `0x55a`, `0x56c`, `0x698`, `0x6a0`, `0x6ca`,
`0x6f4`, `0x706`, `0x730`, `0x790`, `0x79c`, `0x7a0`, `0x7ac`, `0x7b2`, `0x828`,
`0x838`, `0x8a2`, `0x8c8` are all forward). The single counted loop in the whole
resource (`dbf %d4` at `0x1702`, top `0x16f4`) lives in the **`wGrow`** handler,
not the frame drawer. So the fine horizontal pinstripe is produced by a **single
pattern-tiled `FillRect`** (`0xa8a5` @ `0x5d0`), with the stripe texture carried
as the explicit 8-byte `Pattern` argument (`fp@(-316)`, a copy of the runtime
window-struct field `+58`) — not drawn line by line. (There is **no `PaintRect`
`0xa8a2` anywhere in the resource**; `grep -c a8a2` → 0.)

### Where the pinstripe pattern comes from (preamble, `0xc6`–`0xe2`)

The shared message preamble installs the patterns once, before any handler runs:

- `0xc6`–`0xd0`: `moveal fp@(-44),a0` / `addal #58,a0` / `movel a0,sp@-` then
  `PenPat` (`0xa89d` @ `0xd0`) — sets the **pen pattern** from field **`+58`** of
  the local record copy `fp@(-44)` (an 8-byte `Pattern`, the Platinum title
  texture / 1-px pinstripe).
- `0xd2`–`0xdc`: `moveal fp@(-44),a0` / `addal #32,a0` / `movel a0,sp@-` then
  `BackPat` (`0xa87c` @ `0xdc`) — sets the **back pattern** from field **`+32`**.

(`fp@(-44)` is the working window/aux record copy built earlier in the message
preamble; fields `+58`/`+32` are copied in from the source record.) The same
`Pattern` at field `+58` is the one passed explicitly to the title-fill
`FillRect` at `0x5d0` (via the `fp@(-316)` copy) — that `Pattern` *is* the
pinstripe.

### The title-rect fill itself (`0x392`–`0x5e8`)

1. **Title rect derived** at `0x3a6`–`0x3ba`: `jsr 0xf38(varCode, window, &rect)`
   writes the title-bar `Rect` into the local at **`fp@(-356)`** (`v1,h1,v2,h2`
   = `fp@(-356),fp@(-354),fp@(-352),fp@(-350)`). Its height feeds `d5`
   (`0x3be`: `(-352)-(-356)`) and width `d6` (`0x3c8`: `(-350)-(-354)`).
2. **Pen size 1×1** at `0x53a`–`0x542` (`PenSize(1,1)`, `0xa89b` @ `0x542`) — a
   one-pixel pen, consistent with a 1-px pinstripe period.
3. **Active vs inactive split** at `0x544`–`0x55a`: `jsr 0x310` measures the
   window's active state; `bge 0x570` takes the **active** path. The **inactive**
   path (`0x55c`–`0x56c`) does a pattern-tiled `FillRect` (`0xa8a5` @ `0x564`) of
   the title rect `fp@(-356)` with the `Pattern fp@(-316)`, then a 1-px
   `FrameRect` (`0xa8a1` @ `0x56a`) of `fp@(-356)`, then `bra 0x694` (no pinstripe
   colors toggled — it tiles the same pattern in the default port colors).
4. **Active fill** at `0x570`–`0x5e6`:
   - `0x588` `jsr 0x1356` blends two RGBColors (struct `+66` and `+74`) weighted
     by the active level → into the temp at `fp@(-16)`, then `RGBBackColor`
     (`0xaa15` @ `0x594`) sets it as the **back color**; `EraseRect` (`0xa8a3` @
     `0x59a`) clears the title rect `fp@(-356)` to that back color.
   - `0x5b4` `jsr 0x1356` blends struct `+50` with `+58` (weight 8) → fed to
     **`RGBForeColor`** (`0xaa14` @ **`0x5c0`**) = **fore-color slot A**, then
     `PenMode(9)` (`patOr`, `0xa89c` @ `0x5c6`).
   - `0x5d0` **`FillRect(fp@(-356), pattern fp@(-316))`** (`0xa8a5`) — **THE
     patterned pinstripe fill**: tiles the 8-byte `Pattern fp@(-316)` (the field
     `+58` texture) across the whole title rect in the current fore/back colors.
   - `0x5da` **`RGBForeColor`** (`0xaa14` @ **`0x5da`**) loads the color at struct
     **`+18`** = **fore-color slot B**, then `PenMode(8)` (`patCopy`, `0xa89c` @
     `0x5e0`).
   - `0x5e6` **`FrameRect(fp@(-356))`** (`0xa8a1`) — draws the 1-px title-bar
     border outline (1×1 pen), **not** the fill.

### How the two stripe colors alternate

There is **no parity test on a loop counter** (no `btst #0` / `andiw #1` gating a
stripe index — the `andl #8`/`andl #1` tests at `0x440`/`0x4ba`/`0x4fe` select the
*active/highlighted* variant, not stripe parity). Instead the alternation is
**baked into the `Pattern`**: the two stripe colors are the port's **fore vs
back color**, and the `Pattern`'s set/clear bits map fore↔back as `FillRect`
tiles it. The frame sets:

- **back color** ← blend(struct `+66`, struct `+74`) via `RGBBackColor` @ `0x594`
- **fore color slot A** ← blend(struct `+50`, struct `+58`) via `RGBForeColor` @
  `0x5c0` (the color in force at the `FillRect` @ `0x5d0`)
- **fore color slot B** ← struct `+18` via `RGBForeColor` @ `0x5da` (set *after*
  the fill, in force only for the `FrameRect` border @ `0x5e6`)

So the visible pinstripe alternates between the **fore-color slot A at `0x5c0`**
and the **back-color set at `0x594`**, modulated through the **`Pattern` from
struct `+58`** that `FillRect` @ `0x5d0` tiles. The later `0x5da` fore-color +
`PenMode(8)` step re-colors the pen only for the 1-px `FrameRect` outline at
`0x5e6`, not for the fill. (Resolving the literal RGB values at struct
`+18`/`+50`/`+58`/`+66`/`+74` is Task 6.)

### Pseudocode (my words)

```
# preamble (once per message), 0xc6..0xe2:
pat58 = rec[+58]                # 8-byte Pattern = the pinstripe texture (via fp@(-44))
PenPat (pat58)                  # 0xd0
BackPat(rec[+32])               # 0xdc

# whole-frame draw, 0x392..0x5e8:
titleRect = computeTitleRect(varCode, window)   # jsr 0xf38 -> fp@(-356)
PenSize(1, 1)                                    # 0x542
if not active:                                   # bge 0x570 fails
    FillRect(titleRect, fp@(-316))               # 0x564  <-- patterned fill
    FrameRect(titleRect)                         # 0x56a  1-px border
else:
    backCol  = blend(field[+66], field[+74], level)   # 0x588
    RGBBackColor(backCol)                              # 0x594  -> stripe color B
    EraseRect(titleRect)                               # 0x59a  clear to backCol
    foreA    = blend(field[+50], field[+58], 8)        # 0x5b4
    RGBForeColor(foreA); PenMode(patOr)                # 0x5c0 / 0x5c6  -> stripe color A
    FillRect(titleRect, fp@(-316))                     # 0x5d0  <-- THE patterned pinstripe fill (pattern = field[+58])
    RGBForeColor(field[+18]); PenMode(patCopy)         # 0x5da / 0x5e0  (recolors pen for border only)
    FrameRect(titleRect)                               # 0x5e6  1-px title-bar border outline
```

### Period / span / cross-check

- **Period:** the period is **carried by the 8-byte `Pattern` at struct `+58`**
  (passed to `FillRect` @ `0x5d0` as `fp@(-316)`), not by an `addqw #N` in a loop
  (there is no loop). With `PenSize(1,1)`, a classic Platinum-style alternating-row
  pattern yields the expected **1-px** pinstripe period. **Could-not-pin from code
  alone:** the exact period is a property of the pattern *bits* (a runtime resource
  value), so the disassembly cannot prove "1 px" — it only proves the texture is a
  `Pattern` tiled by `FillRect`. This is recorded as an open question for Task 6
  (decode the actual `+58` pattern bytes / `ppat`).
- **Y span:** the full title-bar height — `titleRect` top→bottom = `fp@(-356)`→
  `fp@(-352)` (height in `d5`), as produced by `jsr 0xf38`.
- **X span:** the full title-bar width — `fp@(-354)`→`fp@(-350)` (width in `d6`);
  `FillRect` fills the whole rect edge to edge.
- **Cross-check vs the look:** *consistent.* `PenSize(1,1)` + a tiled `Pattern` +
  a single full-rect `FillRect` is exactly how System 7/8 procs render fine
  pinstripes; the absence of a line loop is the expected idiom, not a red flag.
  The task brief's assumption of a `MoveTo`/`LineTo` stripe loop does **not** hold
  for this resource — the `LineTo` clusters at `0x456`–`0x49a` and `0x626`–`0x684`
  are 4-corner **frame outlines** (each is `MoveTo` + 3×`LineTo` around the rect),
  i.e. Task 4's bevel/edge work, not the fill.

## Frame & bevel insets

**Headline:** the Platinum frame is **not** built with `InsetRect`/`OffsetRect`
shifts of a content rect. It is three strokes layered onto two source rects: a
1-px black `FrameRect` of the **structure box outset by 1**, plus two
`MoveTo`+2×`LineTo` polylines that lay down the bevel highlight/shadow — one
around the **structure box** (bottom+right shadow only) and one around the
**title rect** (a full 4-edge raised bevel). All bevel deltas are **inline
`addqw`/`subqw` on the rect corner words** — the frame/bevel is **not** built by
`InsetRect`/`OffsetRect`-shifting a content rect. The only `InsetRect`s in the
frame+bevel work are the ±1 brackets around the structure outline (`0x424`) and
the title bevel (`0x618` set / `0x692` restore); every one is the standard
`_InsetRect` trap `0xA8A9`, **not** `0xA8D5` (`grep a8d5|a8d4` → 0 anywhere; the
task brief's `0xa8d5/0xa8d4` are misnumbered). The remaining `0xA8A9` sites in
`0x392`–`0x8ec` (`0x714`–`0x87a`) belong to the **Task-5 widget boxes**, not the
frame — and confirm those widgets are rect-based (there are **no ovals** in this
resource).

### The two source rects

- **`fp@(-364..-358)` = structure box** (`top=-364, left=-362, bottom=-360,
  right=-358`). Copied fresh from the live **structure region** handle at window
  `a4@(118)` → `a0@` (region record) `+2` (skip the `rgnSize` word) → the
  `rgnBBox` (`0x406`–`0x416`: two `movel %a0@+,%a1@+`). Then **outset by 1 px on
  all sides** via `InsetRect(rect, −1, −1)` (`0x418`–`0x424`).
- **`fp@(-356..-350)` = title rect** (`top=-356, left=-354, bottom=-352,
  right=-350`). Computed by `jsr 0xf38(varCode, window, &rect)` (`0x3b6`); see T3.
  `d5 = title height (=titleH+1)` (`0x3be`: `bottom−top`), `d6 = title width`
  (`0x3c8`: `right−left`).

### Stroke 1 — outer structure outline (`FrameRect`, `0x434`)

`PenSize(1,1)` (`0x42e`) then **`FrameRect(fp@(-364))`** (`0xa8a1` @ `0x434`):
a 1-px outline of the structure box *outset by 1*. Color in force is set just
above at `0x3ee`–`0x404`: if the aux record `a3 != 0`, `RGBForeColor(a3@(+18))`
(`0xaa14` @ `0x3fa`) and `RGBBackColor(a3@(+10))` (`0xaa15` @ `0x404`). So the
hard outer frame line uses **fore = aux field `+18`**, back = field `+10`.

### Stroke 2 — structure bottom+right shadow (LineTo cluster, `0x44a`–`0x49a`)

Same pen color as stroke 1 (no recolor between `0x404` and here). Branches on
`varCode & 8` (`0x440`–`0x448`) — bit 3 picks **top-titlebar** vs
**side-titlebar** geometry:

- **top-titlebar** (`d4&8==0`, `0x44a`–`0x470`):
  `MoveTo(structLeft+1, structBottom)` (`0x456`) →
  `LineTo(structRight, structBottom)` (`0x460`, **bottom edge**) →
  `LineTo(structRight, structTop − d5 + 1)` (`0x470`, **right edge**, run all the
  way up to the top of the title bar, `structTop − titleHeight`).
- **side-titlebar** (`d4&8!=0`, `0x474`–`0x49a`): mirror — subtracts `d6`
  (titleWidth) from `structLeft` instead, sweeping the bevel along the vertical
  title channel.

This is the classic Platinum **bottom-right outer shadow** — only two edges (the
top/left stay the bright `FrameRect` line), which is what makes the whole window
read raised against the desktop.

### Stroke 3 — title-rect raised bevel (LineTo cluster, `0x60c`–`0x684`)

Runs on the **active** path only (it sits after the `bge 0x570` active branch).
`InsetRect(titleRect, 1, 1)` (`0x60c`) shrinks the title rect 1 px on every side,
then two 2-segment polylines trace it in **two different colors** — the actual
bevel:

- **highlight = top + left edges**, color set at `RGBForeColor(fp@(-16))`
  (`0xaa14` @ **`0x60a`**), where `fp@(-16)` ← `jsr 0x1356` blend of aux fields
  **`+74`** and **`+98`** (weight 0, `0x5ee`–`0x5fe`):
  `MoveTo(left, bottom−1)` (`0x626`) → `LineTo(left, top)` (`0x630`, **left
  edge**, up) → `LineTo(right−1, top)` (`0x63e`, **top edge**, right).
- **shadow = right + bottom edges**, color set at `RGBForeColor(fp@(-16))`
  (`0xaa14` @ **`0x664`**), where `fp@(-16)` ← `jsr 0x1356` blend of aux fields
  **`+106`** and **`+98`** (weight 4, `0x640`–`0x658`):
  `LineTo(right−1, bottom−1)` (`0x676`, **right edge**, down) →
  `LineTo(left, bottom−1)` (`0x684`, **bottom edge**, left).

`InsetRect(titleRect, −1, −1)` (`0x686`) then restores the rect for the widget
pass. The 1-px title `FrameRect` border (`0x5e6`, fore = field `+18`) from T3 sits
just *outside* this bevel.

### Bevel light/dark ordering (what reads raised)

| stroke | rect / edges | inset δ from source | color (aux field via `0x1356`) | `RGBForeColor`/`Back` site |
|---|---|---|---|---|
| 1 `FrameRect` | structure box, all 4 | **+1 outset** (`InsetRect −1,−1` @ `0x424`) | fore = field `+18` / back = field `+10` | `0xaa14` @ `0x3fa`, `0xaa15` @ `0x404` |
| 2 polyline | structure box, **bottom + right** | 0 (corners as-is; `+1` start nudge) | same as stroke 1 (fore `+18`) | (inherits) |
| 3a polyline | title rect, **top + left** (highlight, lighter) | **−1 inset** (`InsetRect 1,1` @ `0x60c`) | blend(field `+74`, field `+98`) | `0xaa14` @ `0x60a` |
| 3b polyline | title rect, **bottom + right** (shadow, darker) | −1 inset (same) | blend(field `+106`, field `+98`) | `0xaa14` @ `0x664` |

So the title bar is a **raised bevel**: top/left = highlight (fields `+74`/`+98`),
bottom/right = shadow (fields `+106`/`+98`). The whole window also reads raised:
top/left = the bright `FrameRect` line (field `+18`), bottom/right = the stroke-2
shadow over it. (Whether field `+74`/`+98`/`+106` resolve to literally
lighter/darker RGB — and the `0x1356` blend weight semantics — is **Task 6**;
this section pins only the slot indices + the geometric light/dark roles.)

### Pseudocode (my words)

```
# structure box, 0x406..0x49a
struct = window.structRgn.rgnBBox          # a4@(118) -> a0@ +2
InsetRect(struct, -1, -1)                  # 0x424  outset 1px (outer frame ring)
PenSize(1, 1)                              # 0x42e
if aux:                                    # 0x3f0
    RGBForeColor(aux[+18]); RGBBackColor(aux[+10])   # 0x3fa / 0x404
FrameRect(struct)                          # 0x434  1px outer outline (top/left bright)
if varCode & 8 == 0:                       # top-titlebar
    MoveTo(struct.left+1, struct.bottom)             # 0x456
    LineTo(struct.right,  struct.bottom)             # 0x460  bottom shadow
    LineTo(struct.right,  struct.top - titleH + 1)   # 0x470  right shadow (up over titlebar)
else:                                      # side-titlebar: subtract titleW from left
    ...mirror...                                     # 0x474..0x49a

# title-rect bevel (active path only), 0x60c..0x686
InsetRect(title, 1, 1)                     # 0x60c  shrink 1px
RGBForeColor(blend(aux[+74],  aux[+98], 0))          # 0x60a  highlight color
MoveTo(title.left,    title.bottom-1)                # 0x626
LineTo(title.left,    title.top)                     # 0x630  LEFT  edge (highlight)
LineTo(title.right-1, title.top)                     # 0x63e  TOP   edge (highlight)
RGBForeColor(blend(aux[+106], aux[+98], 4))          # 0x664  shadow color
LineTo(title.right-1, title.bottom-1)                # 0x676  RIGHT edge (shadow)
LineTo(title.left,    title.bottom-1)                # 0x684  BOTTOM edge (shadow)
InsetRect(title, -1, -1)                   # 0x686  restore
```

### Structure → content inset reconciliation

The frame thickness is **code-fixed, 1 px per side** for the document body:
the outer `FrameRect` is the structure box outset by 1 and stroked at
`PenSize(1,1)`, i.e. the visible frame ring is a single pixel; the content rect
is the structure box itself (the region builder `wCalcRgns 0xd92` partitions
struct vs content — the body sits directly inside the 1-px outline). The **top
inset is dominated by the title-bar height** carried in `d5` (= `titleHeight+1`,
from `jsr 0xf38`), since the title rect is laid out as `[structTop − titleHeight
.. structTop+1]` (`0xf38` @ `0xfee`–`0xffa`: `bottom = top+1; top -= titleHeight`).

So, as coded:

```
content_top    = structure_top    + (titleHeight + 1)   # title bar + 1px under-line
content_left   = structure_left   + 1                   # 1px frame
content_right  = structure_right  - 1                   # 1px frame
content_bottom = structure_bottom - 1                   # 1px frame
```

This **reconciles**: left/right/bottom are the 1-px outline; top = title-bar
height plus the same 1 px. The grow box / lower-right size widget (a Platinum
document window has it) is drawn elsewhere (`wGrow 0x1244`), not folded into the
frame inset here.

**Could-not-pin / open question.** The exact `structTop` semantics depend on a
**runtime region** (`a4@(118)` `rgnBBox`), so the disassembly cannot prove the
absolute title-bar height in pixels — `d5` is `titleHeight+1` where `titleHeight`
itself comes from `0xf38`'s font-metric math (`0xf7a`–`0xfb6`: `GetFontInfo`-style
ascent+descent+2, clamped to ≥10). The frame *deltas* (1 px sides; top = title +
1) are firmly pinned; the literal title-bar pixel height is a runtime/font value
(flagged for Task 6/7, consistent with the T3 "period is a runtime pattern" note).

### Compared to the kDEF cicn model (Phase-B divergence)

The kDEF (`docs/spec/kdef-faithfulness-ledger.md`) derives its insets from the
**cicn art**: `frameFromBody` + `drawableExtent` size the structure rect off the
chrome cicn's *drawable* (last-opaque) extent, trimming any transparent tail
(e.g. beos right 22 px → 5 px). Platinum WDEF 125 does the opposite: it uses
**fixed, code-driven insets** — a flat 1-px ring + a font-derived title height,
with the bevel highlight/shadow strokes hardcoded as the structure box's
bottom-right and the title rect's top-left-vs-bottom-right edges. No art measures
the inset; the geometry is arithmetic. **Phase-B note:** the Platinum reimpl must
*not* try to recover insets from a cicn (there is none for Platinum — see the ISO
recon note that Platinum is built into the System file); it ports these literal
deltas (1 px sides, title-height top) and the 4-edge bevel order directly. This
is the key structural difference from the cicn-derived kDEF schemes.

## Window widgets (close / zoom / collapse)

**Headline.** There are **three title-bar widgets** — close box (left end), zoom
box and collapse/window-shade box (right end) — plus a **fourth, separate**
bottom-right size/grow corner that the frame drawer does *not* paint (it falls to
`wGrow 0x1244`). All three title-bar widgets are **rect-based** (no ovals, no
round-rects): each is a 7×7-pixel square, beveled with a `FrameRect` outline + an
`EraseRect`-filled face + a 2-segment top/left highlight polyline. The close and
zoom boxes share a common box-bevel sub-drawer; the collapse box is drawn inline.
Geometry is **computed arithmetically** off the title rect ends (no art lookup).

### Widget dispatch in the frame-draw tail (`0x694`–`0x6ec`)

The tail of the whole-frame drawer dispatches each widget on a separate gate. The
master gate is `fp@(-20)` (the byte set at `0x3ea` from `RectInRgn 0xa8e9` @
`0x3e6`: "title rect intersects the draw region"); if clear, all widgets skip.
Then per-widget capability bits of the varCode `d4` select which boxes exist:

- **close box** (`0x694`–`0x6be`): guard `fp@(-20) != 0` **and** `a4@(112) != 0`
  (the goAway-present byte in the aux record). Computes its rect via
  `jsr 0x1018(d4, &titleRect fp@(-356), &boxRect fp@(-348))` (`0x6ac`) then draws
  it with `jsr 0x904(aux a3, &boxRect fp@(-348))` (`0x6ba`).
- **zoom box** (`0x6c0`–`0x6ea`): guard `d4 & 4` (`0x6c8`). Rect via
  `jsr 0x110e(d4, &titleRect, window a4, &boxRect fp@(-340))` (`0x6d8`); drawn
  with `jsr 0x9dc(aux a3, &boxRect fp@(-340))` (`0x6e6`).
- **collapse box** (`0x6ec`–`0x786`): guard `d4 & 2` (`0x6f2`). Rect via
  `jsr 0x11fc(window a4, &boxRect fp@(-332))` (`0x6fe`); drawn **inline** (no
  sub-drawer) at `0x708`–`0x786`.

(The block after the collapse box, `0x788`–`0x8e0`, is the **centered title
text** — `TextFont/Face/Size/Mode` via `jsr 0x1478` @ `0x8dc`, `StringWidth` via
`jsr 0x156e` @ `0x7fe` for truncation, gated by `d4 & 8` for top-vs-side
titlebar. It is **not** a widget; cross-referenced here so the seven `InsetRect`
sites are not mis-attributed.)

### Box geometry (the 7×7 squares)

All three boxes are **7 px square** (the `SetRect` corners span 7 in both axes),
vertically centered in the title bar, anchored to the title-rect ends. The
helpers (top-titlebar branch, `d4 & 8 == 0`) compute, with `title = fp@(-356)`
(`top@0,left@2,bottom@4,right@6`) and `vCenter = (title.top+title.bottom)/2`:

| box | helper | `SetRect` site | left | right | top | bottom | anchor |
|---|---|---|---|---|---|---|---|
| close | `0x1018` | `0xa8a7` @ `0x1074` | `title.left+4` | `title.left+11` | `(top+bottom−7)/2` | `(top+bottom+7)/2` | **4 px from LEFT end** |
| zoom | `0x110e` | `0xa8a7` @ `0x116e` | `title.right−11` | `title.right−4` | `(top+bottom−7)/2` | `(top+bottom+7)/2` | **4 px from RIGHT end** |
| collapse | `0x11fc` | (no `SetRect`; corner math) | `title.right−7` | `title.right` − (offset) | `title.bottom−7` | — | RIGHT end, **7 px in** of the right edge then `OffsetRect(1,1)` |

- **Close** (`0x1018`, top path `0x1036`–`0x1074`): `left = title.left+4`,
  `right = title.left+11`, `top = (title.top+title.bottom−7)/2`,
  `bottom = (title.top+title.bottom+7)/2`. So a 7×7 box, left edge 4 px inside the
  title bar's left end, vertically centered. Side-titlebar mirror at
  `0x1098`–`0x10e0` swaps to `a2@(6)/a2@(2)` (right/left of a vertical title
  channel). After `SetRect`, two `jsr 0x168e` clamp tests (`0x1084`, …) may
  `OffsetRect` (`0xa8a8` @ `0x1094`) the box back inside if the title bar is too
  short — a safety nudge, not a normal-case shift.
- **Zoom** (`0x110e`, top path `0x112e`–`0x116e`): `left = title.right−11`,
  `right = title.right−4`, same vertical center math. The exact mirror of close at
  the **right** end. Two `0x168e`/`OffsetRect` (`0x1094`-style `0xa8a8` @ `0x1192`,
  `0x11ba`) clamps keep it (and keep it from overlapping the collapse box).
- **Collapse** (`0x11fc`, `0x120c`–`0x123a`): copies the **window structRgn**
  bbox (`window@(118)` handle → `+2` rgnBBox) into the out rect, then sets
  `top = bottom−7` and `left = right−7`, then `OffsetRect(rect, 1, 1)`
  (`0xa8a8` @ `0x123a`). i.e. a 7×7 box pinned to the right portion of that bbox
  span, nudged 1 px. **Open question:** `0x11fc` derives the collapse box from the
  *structure* bbox rather than the title rect `fp@(-356)`; in a normal top-titlebar
  Platinum window the structRgn top row coincides with the title bar, so this
  lands the collapse box at the title-bar right edge just inboard of the zoom box —
  but the disassembly alone does not prove the two rects coincide for every
  varCode. Flagged for the Phase-B render cross-check.

### Primitive sequence + color slots

**Close box — sub-drawer `0x904`** (args: `a3` = box rect, `a4` = aux/blend
record pointer):

- If `a4 == 0` (`0x914`): plain/disabled — `EraseRect(rect)` (`0xa8a3` @ `0x91a`)
  then `FrameRect(rect)` (`0xa8a1` @ `0x91e`); return. No bevel, no color set
  (uses the inherited port colors).
- Else (the colored path, `0x924`–`0x9d2`):
  1. `RGBForeColor( blend(aux[+66], aux[+106], weight 15) )` — fore set via
     `0x1356` @ `0x93c`, `RGBForeColor 0xaa14` @ `0x948`. **Outline color.**
  2. `FrameRect(rect)` (`0xa8a1` @ `0x94c`) — 1-px box outline.
  3. `InsetRect(rect, 1, 1)` (`0xa8a9` @ `0x958`) — shrink to the face.
  4. `RGBBackColor( blend(aux[+74], aux[+66], weight 4) )` — `0x1356` @ `0x972`,
     `RGBBackColor 0xaa15` @ `0x97e`. **Face color.**
  5. `EraseRect(rect)` (`0xa8a3` @ `0x982`) — fill the face to the back color.
  6. `RGBForeColor( blend(aux[+98], aux[+74], weight 0) )` — `0x1356` @ `0x99a`,
     `RGBForeColor 0xaa14` @ `0x9a6`. **Highlight color.**
  7. Top + left highlight polyline: `MoveTo(rect.left, rect.bottom)`
     (`0xa893` @ `0x9b2`, reading `a3@(2),a3@(4)`) →
     `LineTo(rect.top, rect.left)` (`0xa891` @ `0x9bc`) →
     `LineTo(rect.right, rect.top)` (`0xa891` @ `0x9c6`). (Two segments tracing the
     inner top/left edge = the raised highlight.)
  8. `InsetRect(rect, −1, −1)` (`0xa8a9` @ `0x9d2`) — restore.
  **No internal glyph** in the normal state (Platinum close box is an empty
  beveled square until pressed/hovered — matches the brief).

**Zoom box — sub-drawer `0x9dc`** (same args): structurally the close-box drawer
**plus an inner glyph**.

- If `a4 == 0` (`0x9ec`): `EraseRect` (`0xa8a3` @ `0x9f2`) + `FrameRect`
  (`0xa8a1` @ `0x9f6`), **then an inner-square glyph**: `MoveTo(left, top+3)`
  (`0xa893` @ `0xa04`) → `LineTo(left+3, top+3)` (`0xa891` @ `0xa16`) →
  `LineTo(left+3, top+3)`-style second leg (`0xa891` @ `0xa24`) — a small square
  notch in the upper-left (`+3` corner offsets at `0x9fe`/`0xa0e`/`0xa12`/`0xa20`).
- Else (`0xa2a`–`0xb06`): same 8-step bevel as the close box —
  `RGBForeColor(blend +66/+106 w15)` @ `0xa4e`, `FrameRect` @ `0xa52`,
  `InsetRect(1,1)` @ `0xa5e`, then **the inner-square glyph** drawn in the
  *outline* color before the face fill: `MoveTo(left, top+3)`
  (`0xa893` @ `0xa96`) → `LineTo` (`0xa891` @ `0xaa8`) → `LineTo` (`0xa891` @
  `0xab6`); then `RGBBackColor(blend +74/+66 w4)` @ `0xa84`, `EraseRect` @ `0xa88`;
  highlight `RGBForeColor(blend +98/+74 w0)` @ `0xada` + top/left polyline
  (`0xa893` @ `0xae6`, `0xa891` @ `0xaf0`/`0xafa`); `InsetRect(−1,−1)` @ `0xb06`.
  The **inner square** is the zoom box's classic "two nested boxes" glyph.

**Collapse box — inline (`0x708`–`0x786`)**: same bevel idiom, drawn directly:

- If aux `a3 == 0` (`0x706`): `InsetRect(rect, 1, 1)` (`0xa8a9` @ `0x714`),
  `EraseRect(rect)` (`0xa8a3` @ `0x71a`), `InsetRect(rect, −1, −1)`
  (`0xa8a9` @ `0x728`), `FrameRect(rect)` (`0xa8a1` @ `0x72e`) — plain face + frame.
- Else (`0x732`–`0x786`): `RGBForeColor(aux[+18])` (`0xaa14` @ `0x73a`) then
  `FrameRect(rect)` (`0xa8a1` @ `0x740`) — outline in field `+18`;
  `RGBBackColor( blend(aux[+98], aux[+74], weight 0) )` (`0x1356` @ `0x758`,
  `0xaa15` @ `0x764`) = face color; `InsetRect(rect, 1, 1)` (`0xa8a9` @ `0x772`),
  `EraseRect(rect)` (`0xa8a3` @ `0x778`) fills the face; `InsetRect(rect, −1, −1)`
  (`0xa8a9` @ `0x786`) restore. The collapse box's **horizontal line glyph** is
  **not** drawn in the normal pass here — see the open question below.

| widget | outline color | face color | highlight color | glyph |
|---|---|---|---|---|
| close (`0x904`) | blend(`+66`,`+106`, w15) @ `0x948` | blend(`+74`,`+66`, w4) @ `0x97e` | blend(`+98`,`+74`, w0) @ `0x9a6` | none (empty square) |
| zoom (`0x9dc`) | blend(`+66`,`+106`, w15) @ `0xa4e` | blend(`+74`,`+66`, w4) @ `0xa84` | blend(`+98`,`+74`, w0) @ `0xada` | inner square (`MoveTo`/`LineTo` @ `0xa96`/`0xaa8`/`0xab6`) |
| collapse (inline) | `+18` @ `0x73a` | blend(`+98`,`+74`, w0) @ `0x764` | (none in normal pass) | (see open question) |

(All `+NN` are byte offsets into the aux/blend record `a3`/`a4`; the literal RGBs
and the `0x1356` blend-weight semantics are **Task 6**. The blend triples reuse
the same aux fields as the title bevel: `+66/+74/+98/+106/+18`.)

### State variants

**Active vs inactive.** The whole-frame drawer's active test (`jsr 0x310` + `bge`
at `0x544`/`0x55a`, decoded in T3/T4) gates the *title-bar fill and bevel*, but
the widget pass `0x694`–`0x786` runs on **both** paths — the boxes are drawn
regardless of active state. The active/inactive *look difference* is carried
entirely in the **color slots**: the colored sub-drawer path (`a4 != 0`) draws the
beveled, highlighted box; the **`a4 == 0` path draws the flat fallback** (face +
frame only, no highlight bevel). The `a4`/aux pointer is non-null only when the
aux color record exists (set in `wNew 0x294`); on a window without it (or color QD
absent) every box collapses to the plain `EraseRect`+`FrameRect` look. So
"disabled/inactive" reads as the **un-beveled flat box** via the same code, not a
separate branch. (Whether the slot colors themselves dim on inactive is Task 6.)

**Pressed / highlighted.** The two procedural highlight drawers from the `param`
sub-dispatch (T2). The widget↔part map (from `wHit 0xc84`) is the authoritative
box↔part reference: part **3 = collapse** (`0x11fc` PtInRect → `moveq #3` @
`0xcfc`), part **4 = close** (`0x1018` PtInRect, gated on the goAway byte
`a0@(112)` → `moveq #4` @ `0xd80`), part **5 = zoom** (`0x110e` PtInRect, gated
on `d3 & 4` → `moveq #5` @ `0xd42`). The pressed drawers route by those same
part codes:

- **`0xb10` (close pressed, `param == 4`)**: recomputes the title rect
  (`jsr 0xf38` @ `0xb2c` → `fp@(-24)`) and the **close** box rect via the close
  geometry helper (`jsr 0x1018` @ `0xb3e` → `fp@(-16)`), then:
  - if aux `a3 == 0` (`0xb46`): **`InvertRect(fp@(-16))`** (`0xa8a4` @ `0xb4e`) —
    a straight QuickDraw invert of the box (the cheap pressed look).
  - else, reads the global pressed-state byte at low-mem `0x0B20` bit 0 (`0xb52`):
    if set, recolor (`RGBBackColor(blend +66/+106 w15)` @ `0xb92`) +
    `EraseRect(fp@(-16))` (`0xa8a3` @ `0xb98`) + `FrameRect` (`0xa8a1` @ `0xb9e`)
    — fill the box with the *outline* color (inverted face); if clear, fall to
    `jsr 0x904(aux, &fp@(-16))` (`0xba8`) to **redraw the box in its normal beveled
    look** (i.e. release back to unpressed) — `0x904` is the **close** normal
    drawer. So pressed = solid-filled (face swapped to the dark outline color);
    release = normal bevel.
- **`0xbb6` (zoom pressed, `param == 5/6`)**: same shape — `jsr 0xf38` @
  `0xbd2`, then `jsr 0x110e` @ `0xbe6` (the **zoom** geometry helper) to compute
  the zoom box into `fp@(-16)`. `param & 8` (`0xbf6`) nudges the rect by ±1
  (`addqw/subqw` @ `0xbfa`/`0xbfe` and `0xc68`/`0xc6c`) for the side-titlebar
  variant. Then the same three-way: `a3 == 0` → `InvertRect` (`0xa8a4` @ `0xc0a`);
  `0x0B20` bit 0 set → recolor (`RGBBackColor(blend +66/+106 w15)` @ `0xc4e`) +
  `EraseRect` (`0xa8a3` @ `0xc54`) + `FrameRect` (`0xa8a1` @ `0xc5a`)
  (filled-pressed); else `jsr 0x9dc(aux, &fp@(-16))` (`0xc76`) to redraw normal —
  `0x9dc` is the **zoom** normal drawer.

The `0x0B20` byte is a **WDEF-private global "box is currently pressed" toggle**:
the `param==4/5/6` stubs `eorib #1` it (`0x1f2`, `0x20c`) before calling the
highlight drawer; `param==0` (whole frame) `andib #-2` clears it (`0x1e6`). So a
track-and-release of a box flips the toggle so the highlight drawer alternates
pressed-fill vs normal-bevel on each call — the standard Toolbox `TrackBox`/
`TrackGoAway` "follow the mouse in/out" flicker, done procedurally.

**The collapse box (part 3) has no pressed sub-drawer** — the `param` sub-dispatch
`d3` switch at `0x1bc`–`0x1cc` only matches `4` (→ `0xb10`, close) and `5`/`6`
(→ `0xbb6`, zoom); the collapse box never appears in it. The close and zoom boxes
both have a procedural pressed drawer (`0xb10` / `0xbb6` above); the collapse box's
in/out feedback is not drawn by this WDEF.

### Pseudocode (my words)

```
# frame-draw tail, 0x694..0x786 (after the title fill/bevel):
if not titleVisible(fp@(-20)):           # RectInRgn @ 0x3e6
    skip all widgets

if titleVisible and aux.goAwayPresent (a4@112):     # 0x694..0x6be
    closeRect = computeCloseRect(varCode, title)    # jsr 0x1018 -> fp@(-348)
    drawBox(aux, closeRect, glyph=none)             # jsr 0x904

if varCode & 4:                                      # 0x6c0..0x6ea
    zoomRect = computeZoomRect(varCode, title, win)  # jsr 0x110e -> fp@(-340)
    drawBox(aux, zoomRect, glyph=innerSquare)        # jsr 0x9dc

if varCode & 2:                                      # 0x6ec..0x786
    collapseRect = computeCollapseRect(win)          # jsr 0x11fc -> fp@(-332)
    drawCollapseBoxInline(aux, collapseRect)         # 0x708..0x786

# computeCloseRect (0x1018, top-titlebar):
left  = title.left + 4;  right = title.left + 11     # 7px wide
top   = (title.top + title.bottom - 7) / 2           # vCenter - 3.5
bottom= (title.top + title.bottom + 7) / 2           # 7px tall
clampInsideTitle(rect)                               # 0x168e + OffsetRect

# computeZoomRect (0x110e, top): mirror at the right end
left  = title.right - 11; right = title.right - 4
top/bottom = same vertical center math
clampInsideTitle(rect)

# computeCollapseRect (0x11fc):
rect = window.structRgn.rgnBBox                      # win@118 -> +2
rect.top  = rect.bottom - 7;  rect.left = rect.right - 7
OffsetRect(rect, 1, 1)                               # 0x123a

# drawBox (0x904 close / 0x9dc zoom):
if aux == 0:                                         # plain/disabled
    EraseRect(rect); FrameRect(rect)
    if zoom: drawInnerSquareGlyph(rect)              # 0x9dc only
    return
RGBForeColor(blend(aux[+66], aux[+106], 15))         # outline
FrameRect(rect)
InsetRect(rect, 1, 1)
if zoom: drawInnerSquareGlyph(rect)                  # 0x9dc, in outline color
RGBBackColor(blend(aux[+74], aux[+66], 4))           # face
EraseRect(rect)                                      # fill face
RGBForeColor(blend(aux[+98], aux[+74], 0))           # highlight
MoveTo(left, bottom); LineTo(top,left); LineTo(right,top)   # top+left raised edge
InsetRect(rect, -1, -1)

# pressed highlight (0xb10 close / 0xbb6 zoom), per param sub-dispatch:
recompute box rect (jsr 0xf38 + 0x1018 [close] / 0x110e [zoom])
if aux == 0:           InvertRect(boxRect)           # cheap invert
elif lowmem[0x0B20]&1: RGBBackColor(blend +66/+106 15); EraseRect; FrameRect   # pressed fill
else:                  drawBox(aux, boxRect)         # release -> normal bevel
```

### Cross-check: placement & the kDEF divergence

- **Inside the title rect:** close `[title.left+4 .. title.left+11]` and zoom
  `[title.right-11 .. title.right-4]` both sit 4 px inboard of the title-bar ends,
  vertically centered on `(title.top+title.bottom)/2` with 7 px height — well
  inside the title rect `fp@(-356)` (whose height is `d5 = titleHeight+1 ≥ 11` from
  T4). **Close is at the left, zoom+collapse at the right.** ✔
- **No overlap with the centered title text:** the title text region
  (`0x788`–`0x8e0`) is centered and truncated with `StringWidth` (`jsr 0x156e`)
  against the *available width between the boxes*; the close box ends at
  `title.left+11` and the right boxes start at `title.right-11`, leaving the
  middle for text. ✔ (The truncation math `0x804`–`0x834` measures the gap.)
- **Phase-B divergence vs the kDEF.** The kDEF
  (`docs/spec/kdef-architecture.md`) **bakes the close/zoom/collapse widgets into
  the chrome `cicn` art** — there is no procedural box; the widget pixels are part
  of the active/inactive chrome bitmaps, and hit regions come from the cinf
  layout. Platinum WDEF 125 does the **opposite**: it draws each box
  **procedurally** as a 7×7 beveled rect (`FrameRect`+`EraseRect`+highlight
  polyline) with colors pulled from the aux record's blend slots, and computes the
  hit rects arithmetically (`0x1018`/`0x110e`/`0x11fc`, reused by `wHit 0xc84`).
  **Phase-B note:** the Platinum reimpl must synthesize these three boxes in code
  (square geometry + the bevel + the zoom inner-square / collapse line glyphs),
  **not** expect them in any cicn — mirroring the T4 "fixed code-driven insets"
  finding. The kDEF schemes get their widgets from art; Platinum draws them.

### Could-not-pin / open questions

- **Collapse box source rect** (`0x11fc`): it is built from the **structure-region
  bbox**, not the title rect, then 7×7-cornered at the right + `OffsetRect(1,1)`.
  For a standard top-titlebar window the structRgn top coincides with the title
  bar so this lands at the title-bar right edge inboard of the zoom box, but the
  asm does not prove the two rects coincide for all varCodes. Verify against a
  reference render in Phase-B.
- **Collapse-box glyph (horizontal line).** The inline normal-pass draw
  (`0x708`–`0x786`) lays down only the outline + face fill; I did **not** find a
  `MoveTo`/`LineTo` horizontal-line glyph inside it (unlike the zoom box's inner
  square). The classic Platinum collapse box shows a horizontal bar — it may be (a)
  part of the face pattern/color rather than a stroke, (b) drawn by a shared icon
  the asm reaches elsewhere, or (c) simply absent in this proc's normal state.
  Recorded as unresolved; confirm in Phase-B against the reference image.
- **Collapse-box pressed feedback.** No `param` case targets the collapse box
  (the `d3` switch at `0x1bc`–`0x1cc` only handles `4`→close `0xb10` and
  `5`/`6`→zoom `0xbb6`); the collapse box has no procedural pressed drawer in this
  WDEF. Stated, not pinned to a `0xADDR` (it is out of scope by design). (The close
  and zoom boxes *do* have pressed drawers — `0xb10` / `0xbb6` respectively.)
- **`0x168e` clamp predicate.** The close/zoom helpers call `jsr 0x168e` (a
  small compare returning a flag) to decide whether to `OffsetRect` the box back
  inside a too-short title bar. The exact threshold inside `0x168e` was not fully
  decoded (it is a guard, not normal-case geometry); the normal-case rects above
  are firmly pinned.

## Color sourcing
_(Task 6)_

## Active vs inactive title bar
_(Task 6)_

## Constants (the Phase-B inputs)
_(Task 7)_

## Confirmed (instruction-decoded) vs could-NOT-pin
_(Task 7)_

## Phase-B faithfulness-ledger seed
_(Task 7)_
