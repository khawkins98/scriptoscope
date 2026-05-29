# kDEF binary inventory (local — `.scratch/`)

The Kaleidoscope kDEF code resources for **both** versions extracted locally on 2026-05-29. Sizes match the prior-pass 1.8.2 disassembly findings doc exactly — verification signal passed. **Not committed** (binaries are gitignored under `.scratch/`); reproducible via `.scratch/dump-kaleido-cdev.mjs`.

## Extraction method (verified working)

```sh
unar -o /tmp/k182 ~/Downloads/kaleidoscope182US.sit
unar -o /tmp/k231 ~/Downloads/Kaleidoscope231US.bin
# The installer's DATA FORK is itself a StuffIt 5 archive (STi4 / ST65 magic at offset 0).
unar -forks visible -o /tmp/k231-inner "/tmp/k231/Kaleidoscope 2.3.1 Installer"
# Yields: Kaleidoscope.rsrc (the control panel) + Kaleidoscope Extension.rsrc
node .scratch/dump-kaleido-cdev.mjs  # parses AppleDouble + dumps every code resource
```

## Files extracted to `.scratch/`

### `.scratch/k231-kdef/kDEF/`

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

Plus per-installer dumps of every WDEF / CDEF / MDEF / LDEF / cdev / PACH / Zoom / INIT resource. Full index at `.scratch/k{182,231}-kdef/_index.json` (547 resources in 2.3.1, 404 in 1.8.2).

## New architectural findings (2.3.1, not in `kdef182-disassembly-findings.md`)

### 1. WDEF message dispatch table

`kDEF 0` at `0x1d68` — 35-entry indexed-jump table. Decoded:

| msg | handler addr | role |
|---:|---:|---|
| 0 (wDraw) | 0x1dae | frame painting |
| 1 (wHit) | 0x238a | hit testing |
| 2 (wCalcRgns) | 0x23b2 | structure/content region |
| 3 (wNew) | 0x23c6 | init |
| 4 (wDispose) | 0x2610 | teardown |
| 8 (wGrowIcon) | 0x2638 | grow box |
| 10, 11 | 0x23b8 | (shared region calc) |
| 19, 20, 21, 27, 29, 34 | 0x2696..0x26ca | Appearance/Carbon extension msgs |
| 5–7, 9, 12–18, 22–26, 28, 30–33 | 0x28d2 | default no-op |

### 2. Master service-handler table

At `0x1c7c`, 9 internal-service function pointers: `0x6688, 0x997e, 0xdd22, 0x118b8, 0x1525a, 0x8d36, 0x28e0, 0x1d3e, 0x17452`. **All 9 roles confirmed** — full per-slot trace in `docs/spec/kdef-service-handlers.md`. Summary:

| slot | addr | role |
|---:|---:|---|
| 0 | `0x6688` | CDEF main (push-button family, 32 B `'Acid'` aux) |
| 1 | `0x997e` | re-entrant CDEF entry (callback-safe, saves `a4` via `0x9930`) |
| 2 | `0xdd22` | GDevice-aware focus / state helper |
| 3 | `0x118b8` | wnd# gate (document windows, id `-14336`) → slot 6 on hit; system `'WDEF'` fallback on miss |
| 4 | `0x1525a` | wnd# gate (utility windows, id `-14304`) → slot 6 with msg-base `+1984` |
| 5 | `0x8d36` | second CDEF main (scrollbar / slider, 68 B aux) |
| 6 | `0x28e0` | master compositor dispatcher (msg 1000 = INIT, 1001..1009 verbs) |
| 7 | `0x1d3e` | WDEF main (35-entry msg table at `0x1d68`, see §1) |
| 8 | `0x17452` | wnd# gate (popup / tab, id `-12320`) → trampolines to a loaded `'WDEF', -14336` via `jsr a0@` |

The cinf consumer is `0x116f8` (see §3), **NOT** slot 3 `0x118b8` — slot 3 loads `'wnd#'`, not `'cinf'`. (Slots 3, 4, 8 are three parallel wnd#-loading family gates.)

### 3. cinf load site (2.3.1)

At `0x1171a`: `pea 'cinf', movw d7,-(sp), GetResource` (id from d7). Inside the routine at `0x116f8`. New-format-vs-old-format discriminator: `GetHandleSize > 18` at `0x11740`. The corpus ships 1032/1033 cinfs at exactly 18 bytes (old format); the binary's 20-byte and 56-byte paths are populated at load via a `pWin` back-patch (byte 18) and `0xfc5c` pixel-sample cache (bytes 20..55) respectively, never read from disk. Full trace + decision: `docs/spec/cinf-extended-decode.md`.

### 4. `wnd#` fallback ladder — **DECODED 2026-05-29**

At `0x356c..0x367e` — 12-step degraded-id fallback. Tries the requested id, then ANDs with `-2, -3, -4, -5, -6, -15, -16, -17, -18, -21, -22` in sequence until one resolves. Each step pushes `'wnd#'` (FourCC `0x776e6423`) then the masked id, traps `_GetResource` (`0xA9A0`), and `bnes` past the rest of the cascade once a non-null handle returns.

**Per-step asm pattern + the full landing table** (which canonical slugs degrade into which) live in `docs/spec/kdef231-reference.md §3.4.1`. **Runtime mirror**: `src/wndCascade.ts` (clean-room) + integration at `src/renderWindow.ts:resolveWindowType`. Corpus impact: 16 of 18 bundles ship at least one canonical slug the cascade resolves; three baselines (`crayon-os`, `windows-31`, `windows-95`) drifted into period-faithful resolutions when the helper landed.

**1.8.2 cross-check.** `grep -c "wnd#"` over both binaries: 1.8.2 returns **0**, 2.3.1 returns **17** matches (12 cascade attempts + 5 outside refs). The wnd# resource model + cascade were a 2.3.1-only addition.

### 5. FourCC vocabulary

Per-resource markers in 2.3.1 kDEF 0:

- **Window**: `wnd#`, `cinf`, `cicn`, `clut`, `actb`, `WDEF`, `pWin`
- **System probes**: `ATIr` (ATI Rage check), `qd `, `sysv`, `AOCE`, `HFS `
- **Theme creators**: `Acid` (Kaleidoscope), `Aarn`/`Aarp`/`Aaru` (Mac OS Aaron extension interop), `Copl` (Copland)
- **Control palette markers (NEW)**: `btnp`, `dbtp`, `cbtp`, `chkp`, `radp` (button / default-button / cmd-button / checkbox / radio palettes), `sbap`, `sbae`, `sbar`, `sbax`, `sbgh`, `sbth`, `sbtp` (scrollbar parts), `bevp` (bevel)
- **Appearance/Finder**: `appr` (8 sites — Appearance Manager hooks), `apvr`, `WdrB`, `ics#`/`ics8`/`SICN`/`icm#`, `proc`

The control-palette FourCCs suggest the kDEF's controls system uses **palette/tag-based resource lookup keyed by these FourCCs**, not by hardcoded cicn ids. We currently look up by raw id; the FourCC tags may provide a higher-level naming.

### 6. PEF imports — 2.3.1 added 17 new AppearanceLib calls

| Library | 1.8.2 | 2.3.1 |
|---|---:|---:|
| InterfaceLib | 174 | 185 |
| AppearanceLib | 2 | **19** |
| IconServicesLib | 1 | **3** |
| ControlsLib | — | **6** |
| WindowsLib | — | **2** |

New AppearanceLib calls: `DrawThemePlacard`, `DrawThemeWindowHeader`, `GetThemeScrollBarArrowStyle`, `GetThemeScrollBarThumbStyle`, `NormalizeThemeDrawingState`, `IsControlActive`, `GetBestControlRect`.

**Plus** `GetWindowProxyIcon` + `IsWindowModified` — first-class proxy-icon support in title bars + the "dirty document" dot. **Not modeled in our runtime today.**

ControlsLib imports `GetControl32BitMinimum/Value/Maximum`, `SetControl32BitValue`, `GetControlViewSize` — 2.3.1 understands Carbon 32-bit control values (range > 16-bit).

## Where this work lives

- **`.scratch/dump-kaleido-cdev.mjs`** — the extractor (the verified-working method). Re-runnable.
- **`.scratch/k231-kdef/_index.json`** — 547-resource index for 2.3.1's control panel.
- **`.scratch/k182-kdef/_index.json`** — 404 resources for 1.8.2.

## Companion docs

- `docs/spec/kdef231-reference.md` — the standing reference (extend with the new findings above)
- `docs/spec/kdef182-disassembly-findings.md` — May 2026 prior-pass findings (1.8.2 only)
- `docs/spec/apple-drawtheme-decode.md` — Apple-side AppearanceLib decode (companion)
