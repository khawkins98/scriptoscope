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

At `0x1c7c`, 9 internal-service function pointers: `0x6688, 0x997e, 0xdd22, 0x118b8, 0x1525a, 0x8d36, 0x28e0, 0x1d3e, 0x17452`. `0x118b8` is the cinf consumer.

### 3. cinf load site (2.3.1)

At `0x1171a`: `pea 'cinf', movw d7,-(sp), GetResource` (id from d7). New-format-vs-old-format discriminator: `GetHandleSize > 18`.

### 4. `wnd#` fallback ladder (NEW)

At `0x356c..0x367e` — 12-step degraded-id fallback. Tries the requested id, then ANDs with `-2, -3, -4, -5, -6, -15, -16, -17, -18, -21, -22` in sequence until one resolves.

**Implication for our runtime:** `composeChrome.ts` looks up an EXACT id from the bundle's `wnd#` index. The 2.3.1 binary walks a FALLBACK CHAIN. Hits we currently treat as "no recipe for this id" would have resolved to a stripped variant. **Worth modeling explicitly** — `docs/spec/kdef231-reference.md` §7 lists this as a still-open question.

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
