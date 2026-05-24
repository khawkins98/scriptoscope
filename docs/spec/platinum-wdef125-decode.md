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
| `0x0b10` | `wDraw` zoom highlight (`param==4`) | procedural highlight of the zoom box | `LineTo`/`RGBForeColor` | `rts` |
| `0x0bb6` | `wDraw` collapse highlight (`param==5/6`) | procedural highlight of the collapse box | `LineTo`/`RGBForeColor` | `rts` |
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
frame) → `jsr 0x392`; `4` (wInZoomIn/Out) → `jsr 0xb10`; `5` and `6`
(wInCollapseBox / variant) → `jsr 0xbb6`. So the **whole-frame drawer is
`0x392`** and the two procedural widget-highlight drawers are `0xb10` / `0xbb6`.

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
patterned `PaintRect`**, with the stripe texture carried as the graphics-port
**pen pattern** — not drawn line by line.

### Where the pinstripe pattern comes from (preamble, `0xc6`–`0xe2`)

The shared message preamble installs the patterns once, before any handler runs:

- `0xc6`–`0xd0`: `lea a0@(58),sp@-` then `PenPat` (`0xa89d` @ `0xd0`) — sets the
  **pen pattern** from window-struct field **`+58`** (an 8-byte `Pattern`, the
  Platinum title texture / 1-px pinstripe).
- `0xd2`–`0xdc`: `lea a0@(32),sp@-` then `BackPat` (`0xa87c` @ `0xdc`) — sets the
  **back pattern** from field **`+32`**.

(`a2`/the working window record here is the *color* WMgr port copy built at
`0x3a`–`0xc6`; fields `+58`/`+32` are copied in from the source record earlier.)
Because the pen pattern is installed in the preamble, the later `PaintRect` that
fills the title rect inherits it — that pen pattern *is* the pinstripe.

### The title-rect fill itself (`0x392`–`0x5e8`)

1. **Title rect derived** at `0x3a6`–`0x3ba`: `jsr 0xf38(varCode, window, &rect)`
   writes the title-bar `Rect` into the local at **`fp@(-356)`** (`v1,h1,v2,h2`
   = `fp@(-356),fp@(-354),fp@(-352),fp@(-350)`). Its height feeds `d5`
   (`0x3be`: `(-352)-(-356)`) and width `d6` (`0x3c8`: `(-350)-(-354)`).
2. **Pen size 1×1** at `0x53a`–`0x542` (`PenSize(1,1)`, `0xa89b` @ `0x542`) — a
   one-pixel pen, consistent with a 1-px pinstripe period.
3. **Active vs inactive split** at `0x544`–`0x55a`: `jsr 0x310` measures the
   window's active state; `bge 0x570` takes the **active** path. The **inactive**
   path (`0x55c`–`0x56c`) just `InsetRect`s by `fp@(-316)` and does a plain
   `PaintRect` (`0xa8a1` @ `0x56a`) of `fp@(-356)`, then `bra 0x694` (no pinstripe
   colors toggled).
4. **Active fill** at `0x570`–`0x5e6`:
   - `0x588` `jsr 0x1356` blends two RGBColors (struct `+50` and `+58`) weighted
     by the active level → into the temp at `fp@(-16)`, then `RGBBackColor`
     (`0xaa15` @ `0x594`) sets it as the **back color**; `OffsetRect` (`0xa8a3` @
     `0x59a`) nudges the rect.
   - `0x5b4` `jsr 0x1356` blends struct `+50` with `+58` again (weight 8) → fed to
     **`RGBForeColor`** (`0xaa14` @ **`0x5c0`**) = **fore-color slot A**, then
     `PenMode(9)` (`patOr`, `0xa89c` @ `0x5c6`) and `InsetRect` by `fp@(-316)`
     (`0x5d0`).
   - `0x5da` **`RGBForeColor`** (`0xaa14` @ **`0x5da`**) loads the color at struct
     **`+18`** = **fore-color slot B**, then `PenMode(8)` (`patCopy`, `0xa89c` @
     `0x5e0`).
   - `0x5e6` **`PaintRect(fp@(-356))`** (`0xa8a1`) — paints the whole title rect
     **once**, with the 1×1 pen and the preamble pinstripe **pen pattern**.

### How the two stripe colors alternate

There is **no parity test on a loop counter** (no `btst #0` / `andiw #1` gating a
stripe index — the `andl #8`/`andl #1` tests at `0x440`/`0x4ba`/`0x4fe` select the
*active/highlighted* variant, not stripe parity). Instead the alternation is
**baked into the pen pattern**: the two stripe colors are the port's **fore vs
back color**, and the pen pattern's set/clear bits map fore↔back as `PaintRect`
tiles it. The frame sets:

- **back color** ← blend(struct `+50`, struct `+58`) via `RGBBackColor` @ `0x594`
- **fore color slot A** ← blend(struct `+50`, struct `+58`) via `RGBForeColor` @
  `0x5c0` (then overwritten on the same fill by…)
- **fore color slot B** ← struct `+18` via `RGBForeColor` @ `0x5da` (the color in
  force at the `PaintRect`)

So the visible pinstripe alternates between **fore-color slot at `0x5da`** (set
just before the paint) and the **back-color set at `0x594`**, modulated through
the **pen pattern from struct `+58`** (installed by `PenPat` @ `0x0d0`). The
`0x5c0` fore-color + `PenMode(9)` step is an intermediate overlay pass; the final
two-tone the eye reads is `{fore@0x5da, back@0x594}`. (Resolving the literal RGB
values at struct `+18`/`+32`/`+50`/`+58` is Task 6.)

### Pseudocode (my words)

```
# preamble (once per message), 0xc6..0xe2:
PenPat (window.field[+58])      # 8-byte Pattern = the pinstripe texture
BackPat(window.field[+32])

# whole-frame draw, 0x392..0x5e8:
titleRect = computeTitleRect(varCode, window)   # jsr 0xf38 -> fp@(-356)
PenSize(1, 1)                                    # 0x542
if not active:                                   # bge 0x570 fails
    InsetRect(titleRect, fp@(-316)); PaintRect(titleRect)   # plain, no stripes
else:
    backCol  = blend(field[+50], field[+58], level)   # 0x588
    RGBBackColor(backCol)                              # 0x594  -> stripe color B
    OffsetRect(titleRect, ...)                         # 0x59a
    foreA    = blend(field[+50], field[+58], 8)        # 0x5b4
    RGBForeColor(foreA); PenMode(patOr)                # 0x5c0 / 0x5c6  (overlay)
    InsetRect(titleRect, fp@(-316))                    # 0x5d0
    RGBForeColor(field[+18]); PenMode(patCopy)         # 0x5da / 0x5e0 -> stripe color A
    PaintRect(titleRect)                               # 0x5e6  <-- pinstripe via pen pattern
```

### Period / span / cross-check

- **Period:** the period is **carried by the 8-byte pen `Pattern` at struct `+58`**,
  not by an `addqw #N` in a loop (there is no loop). With `PenSize(1,1)`, a classic
  Platinum-style alternating-row pattern yields the expected **1-px** pinstripe
  period. **Could-not-pin from code alone:** the exact period is a property of the
  pattern *bits* (a runtime resource value), so the disassembly cannot prove "1 px"
  — it only proves the texture is a `Pattern` tiled by `PaintRect`. This is recorded
  as an open question for Task 6 (decode the actual `+58` pattern bytes / `ppat`).
- **Y span:** the full title-bar height — `titleRect` top→bottom = `fp@(-356)`→
  `fp@(-352)` (height in `d5`), as produced by `jsr 0xf38`.
- **X span:** the full title-bar width — `fp@(-354)`→`fp@(-350)` (width in `d6`);
  `PaintRect` fills the whole rect edge to edge.
- **Cross-check vs the look:** *consistent.* `PenSize(1,1)` + a tiled `Pattern` +
  a single full-rect `PaintRect` is exactly how System 7/8 procs render fine
  pinstripes; the absence of a line loop is the expected idiom, not a red flag.
  The task brief's assumption of a `MoveTo`/`LineTo` stripe loop does **not** hold
  for this resource — the `LineTo` clusters at `0x456`–`0x49a` and `0x626`–`0x684`
  are 4-corner **frame outlines** (each is `MoveTo` + 3×`LineTo` around the rect),
  i.e. Task 4's bevel/edge work, not the fill.

## Frame & bevel insets
_(Task 4)_

## Window widgets (close / zoom / collapse)
_(Task 5)_

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
