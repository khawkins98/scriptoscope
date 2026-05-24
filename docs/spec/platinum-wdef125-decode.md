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
_(Task 3)_

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
