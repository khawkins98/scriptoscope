# kdef-binary-inventory — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Moved verbatim on 2026-10-21 (v2 lane L2)
> from `docs/spec/kdef-binary-inventory.md` at v2 commit `1183816e`. The behavioural
> replacement text lives in [`kdef-binary-inventory.md`](../kdef-binary-inventory.md). Nothing here was
> re-decoded during the move; verifier CONFIRMED/REFUTED marks are added by the
> verifying lane.

## Extraction method (verified working) (original, lines 7–14)

````text
```sh
unar -o /tmp/k182 ~/Downloads/kaleidoscope182US.sit
unar -o /tmp/k231 ~/Downloads/Kaleidoscope231US.bin
# The installer's DATA FORK is itself a StuffIt 5 archive (STi4 / ST65 magic at offset 0).
unar -forks visible -o /tmp/k231-inner "/tmp/k231/Kaleidoscope 2.3.1 Installer"
# Yields: Kaleidoscope.rsrc (the control panel) + Kaleidoscope Extension.rsrc
node .scratch/dump-kaleido-cdev.mjs  # parses AppleDouble + dumps every code resource
```
````

## Files extracted to `.scratch/` — listing rows and header column (original, lines 20–34)

````text
| File | Size | Header | Notes |
|---|---:|---|---|
| `id-0-680x0_DefProcs.bin` | 107,726 | `600a 0000 kDEF` | **2.3.1 68k m68k — never before extracted** |
| `id-1.bin` | 175,572 | CFM-68k shim + `Joy!peff pwpc` @ 0x20 | **2.3.1 PowerPC PEF — never before extracted** |
| `k231-kdef0.asm` | — | 33,999 lines | `m68k-elf-objdump` |
| `k231-kdef1.asm` | — | 39,980 instructions | capstone PPC |
| `k231-kdef1-code.bin` | 163,304 | — | raw PPC code section |

### `.scratch/k182-kdef/kDEF/`

| File | Size | Notes |
|---|---:|---|
| `id-0-680x0_DefProcs.bin` | 60,732 | 1.8.2 68k — matches `kdef182-disassembly-findings.md` |
| `id-1.bin` | 99,960 | 1.8.2 PEF PPC |
| `k182-kdef0.asm` | — | 19,561 lines |
````

## PACH identity and reconstructed source chain (2026-10-18) — reproduction commands (original, lines 65–70)

````text
The extraction can be reproduced in a fresh directory:

```sh
unar -q -forks visible -o /tmp/pach-review ~/Downloads/Kaleidoscope231US.bin
unar -q -forks visible -o /tmp/pach-review/payload "/tmp/pach-review/Kaleidoscope 2.3.1 Installer"
```
````

## 2. Master service-handler table — slot 1 and slot 8 rows (original, lines 109–116)

````text
| 1 | `0x997e` | re-entrant CDEF entry (callback-safe, saves `a4` via `0x9930`) |
| 2 | `0xdd22` | GDevice-aware focus / state helper |
| 3 | `0x118b8` | wnd# gate (document windows, id `-14336`) → slot 6 on hit; system `'WDEF'` fallback on miss |
| 4 | `0x1525a` | wnd# gate (utility windows, id `-14304`) → slot 6 with msg-base `+1984` |
| 5 | `0x8d36` | second CDEF main (scrollbar / slider, 68 B aux) |
| 6 | `0x28e0` | master compositor dispatcher (msg 1000 = INIT, 1001..1009 verbs) |
| 7 | `0x1d3e` | WDEF main (35-entry msg table at `0x1d68`, see §1) |
| 8 | `0x17452` | wnd# gate (popup / tab, id `-12320`) → trampolines to a loaded `'WDEF', -14336` via `jsr a0@` |
````

## 3. cinf load site (2.3.1) (original, lines 122–122)

````text
At `0x1171a`: `pea 'cinf', movw d7,-(sp), GetResource` (id from d7). Inside the routine at `0x116f8`. New-format-vs-old-format discriminator: `GetHandleSize > 18` at `0x11740`. The corpus ships 1032/1033 cinfs at exactly 18 bytes (old format); the binary's 20-byte and 56-byte paths are populated at load via a `pWin` back-patch (byte 18) and `0xfc5c` pixel-sample cache (bytes 20..55) respectively, never read from disk. Full trace + decision: `docs/spec/cinf-extended-decode.md`.
````

## 4. `wnd#` fallback ladder — per-step pattern (original, lines 126–126)

````text
At `0x356c..0x367e` — 12-step degraded-id fallback. Tries the requested id, then ANDs with `-2, -3, -4, -5, -6, -15, -16, -17, -18, -21, -22` in sequence until one resolves. Each step pushes `'wnd#'` (FourCC `0x776e6423`) then the masked id, traps `_GetResource` (`0xA9A0`), and `bnes` past the rest of the cascade once a non-null handle returns.
````
