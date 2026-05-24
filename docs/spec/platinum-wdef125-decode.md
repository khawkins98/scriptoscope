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

## Message dispatch
_(Task 2)_

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
