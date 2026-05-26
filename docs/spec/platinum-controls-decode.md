# Mac OS 8.5/8.6 Platinum controls — `CDEF` + `AppearanceLib` decode

*Clean-room decode of the Platinum standard controls. Geometry from the 68k
`CDEF` (id -63); drawing model from the PowerPC `AppearanceLib` `DrawTheme*`
suite. Mirrors the kDEF/WDEF playbook: cite `0xADDR`/offset, describe the
algorithm, **never** dump Apple's listing. Feeds the Phase-B control generator.
Companion: [`platinum-wdef125-decode.md`](./platinum-wdef125-decode.md),
[`platinum-controls-faithfulness-ledger.md`](./platinum-controls-faithfulness-ledger.md).*

```
# bins (NOT committed — Apple system code; git-ignored in .scratch/iso-recon):
#   code-out/CDEF-n63.bin   (5426B, 68k)
#   85-System.bin           (PowerPC PEF host of AppearanceLib)
# disassemble the CDEF:
#   m68k-elf-objdump -D -b binary -m m68k:68030 CDEF-n63.bin > CDEF-n63.asm
# PEF / PPC: see the AppearanceLib spike section for the chosen disassembler.
```

## Routine map (CDEF)
_(Task 5 — from the T2 geometry findings)_

## Message dispatch (CDEF)
_(Task 5 — from T2)_

## Per-kind geometry
_(Task 5 — from T2: push/bevel button, checkbox, radio, popup, scrollbar
track/thumb/arrows, slider+ticks, tab, disclosure, progress, little-arrows)_

## AppearanceLib drawing model (spike: DrawThemeButton / push)
_(Task 5 — from the T4 spike)_

## Spike-gate decision (scale vs fallback)
_(Task 5 — from T4: the verdict + rationale that gates Phase-B)_

## Accent application model
_(Task 5 — how the accent clut maps onto each control)_

## Color data (accents + grays)
_(Task 5 — summary; authoritative values in
`themes/apple-platinum-replica/sources/platinum-palette.json`)_

## Constants (the Phase-B inputs)
_(Task 5 — consolidated, every row citing its 0xADDR/offset/data source)_

## Confirmed (instruction/data-backed) vs could-NOT-pin
_(Task 5 — the integrity gate; Phase-B may only build on "confirmed")_

## Phase-B ledger seed
_(Task 5 — see platinum-controls-faithfulness-ledger.md)_

## Next plan (per the spike gate)
_(Task 5 — SCALE → platinum-controls-appearancelib-decode plan;
FALLBACK → platinum-controls-generate plan)_
