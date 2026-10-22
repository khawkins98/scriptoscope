# kDEF binary inventory (local — `.scratch/`)

The Kaleidoscope kDEF code resources for **both** versions extracted locally on 2026-05-29. Sizes match the prior-pass 1.8.2 disassembly findings doc exactly — verification signal passed. **Not committed** (binaries are gitignored under `.scratch/`); reproducible via `.scratch/dump-kaleido-cdev.mjs`.

*Listing-level narrative (registers, frame offsets, instruction excerpts) and the toolchain/listing paths for this document live in [`engine/kdef-binary-inventory.evidence.md`](engine/kdef-binary-inventory.evidence.md) — spec writers and verifiers only.*

## Extraction method (verified working)

Both installers are unpacked with `unar`; the 2.3.1 installer's DATA FORK is itself a StuffIt 5 archive (STi4 / ST65 magic at offset 0), which yields `Kaleidoscope.rsrc` (the control panel) + `Kaleidoscope Extension.rsrc`. `.scratch/dump-kaleido-cdev.mjs` then parses AppleDouble and dumps every code resource. Exact commands are in the evidence file.

## Files extracted to `.scratch/`

### `.scratch/k231-kdef/kDEF/`

| File | Size | Header | Notes |
|---|---:|---|---|
| `id-0-680x0_DefProcs.bin` | 107,726 | code-resource header with `kDEF` tag | **2.3.1 68k m68k — never before extracted** |
| `id-1.bin` | 175,572 | CFM-68k shim + `Joy!peff pwpc` @ 0x20 | **2.3.1 PowerPC PEF — never before extracted** |
| `k231-kdef1-code.bin` | 163,304 | — | raw PPC code section |

The 68k and PPC disassembly listings for 2.3.1 are listed in the evidence file.

### `.scratch/k182-kdef/kDEF/`

| File | Size | Notes |
|---|---:|---|
| `id-0-680x0_DefProcs.bin` | 60,732 | 1.8.2 68k — matches `kdef182-disassembly-findings.md` |
| `id-1.bin` | 99,960 | 1.8.2 PEF PPC |

The 1.8.2 68k disassembly listing is listed in the evidence file.

Plus per-installer dumps of every WDEF / CDEF / MDEF / LDEF / cdev / PACH / Zoom / INIT resource. Full index at `.scratch/k{182,231}-kdef/_index.json` (547 resources in 2.3.1, 404 in 1.8.2).

## PACH identity and reconstructed source chain (2026-10-18)

The tab investigation in #223 cites PACH 130, not kDEF 0. A fresh static
extraction with unar 1.10.7 reconstructed these exact bytes from the locally
held `Kaleidoscope231US.bin`; no installer or original engine code was executed.
The extracted kDEF 0 also matches the already fingerprinted 2.3.1 reference.
These are observed artifact identities, not a complete installation/patch-stack
or historical rendering certification.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| MacBinary installer | 1908736 | `4173477d60f3081e03e4b18bd1cf17da16ad5381315ff04d8f51e8bb4cb7012a` |
| Installer data fork, an ST65 archive | 1687965 | `8aad109da26d11791d9ada2e8cf92327af1d617f396659cc63bd7ce70a0b01ce` |
| Control-panel AppleDouble wrapper | 1005617 | `b5fd81a12072da1e3a1af9fedd9f6846d88e2e5187a8dd152266a00aa0cfba6c` |
| Control-panel raw resource fork, AppleDouble entry 2 | 1005535 | `0d4af8bab15e467f00b9dfaac99bb9adec6ee884e12e04f3de03d74b3fdc9c0b` |
| PACH 130, “68k Patches” | 87914 | `bf113e709425a811e0805e97dea7c028e46c50909fadb781226295e0b52d5b44` |
| PACH 131, “PowerPC Patches” | 145320 | `465b312d14eca52ed9e3164caceb7759272613a862b0d4fb8dcee8c0da82fd7c` |
| kDEF 0, “680x0 DefProcs” | 107726 | `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` |

Within the **unwrapped raw resource fork**, PACH 130's map reference starts at
998394 and its payload at 135431; PACH 131's are 998406 and 223349; kDEF 0's are
1003302 and 612937. Payload offsets exclude the preceding four-byte length word.
These offsets are not installer offsets. Source routine addresses are relative
to the start of the named resource payload, with resource offset zero as base.

The installed unar binary SHA-256 was
`088e447a9fa8ab818768e7e9f48d6a7666f6a2f32c2ecc508f9904b4654adcd0`.
The extraction can be reproduced in a fresh directory with two `unar -q -forks visible`
passes (installer, then its payload); the commands are in the evidence file.

Read `payload/Kaleidoscope 2.3.1 Installer/Kaleidoscope.rsrc` as AppleDouble,
select entry 2, and then read its resource map. Independently reading those
big-endian fields reproduced all three payloads byte-for-byte against the local
scratch files and hashes above; the repository parser was not used for that
verification. Alternate installer/wrapper bytes require their own identity
record rather than being assumed to match this chain. Original binaries remain
local and are not repository fixtures or CI inputs.

The [bounded tab-source notes](tab-body-investigation.md) retain what the pinned
PACH supports and what remains unknown. Fingerprinting it does not establish a
tab body painter, justify erasing semantic source pixels or close #223.

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
| 1 | `0x997e` | scroll-bar CDEF (saves the kDEF globals pointer via `0x9930`; per-message state `0x9d84`; `docs/spec/engine/scrollbar.md`) — corrected 2026-10-21, was "re-entrant CDEF entry" |
| 2 | `0xdd22` | GDevice-aware focus / state helper *(re-verify: rests on the former GetCTSeed trap name)* |
| 3 | `0x118b8` | wnd# gate (document windows, id `-14336`) → slot 6 on hit; system `'WDEF'` fallback on miss |
| 4 | `0x1525a` | wnd# gate (utility windows, id `-14304`) → slot 6 with msg-base `+1984` |
| 5 | `0x8d36` | separate CDEF, undecoded (68 B aux, hit test returns part 10, `bevp` tags; likely bevel button) — **not** the scroll bar; corrected 2026-10-21 |
| 6 | `0x28e0` | master compositor dispatcher (msg 1000 = INIT, 1001..1009 verbs) |
| 7 | `0x1d3e` | WDEF main (35-entry msg table at `0x1d68`, see §1) |
| 8 | `0x17452` | wnd# gate (popup / tab, id `-12320`) → trampolines to a loaded `'WDEF', -14336` via a call through the loaded handle |

The cinf consumer is `0x116f8` (see §3), **NOT** slot 3 `0x118b8` — slot 3 loads `'wnd#'`, not `'cinf'`. (Slots 3, 4, 8 are three parallel wnd#-loading family gates.)

### 3. cinf load site (2.3.1)

At `0x1171a`: `GetResource('cinf', id)`, with the id passed in by the caller. Inside the routine at `0x116f8`. New-format-vs-old-format discriminator: `GetHandleSize > 18` at `0x11740`. The corpus ships 1032/1033 cinfs at exactly 18 bytes (old format); the binary's 20-byte and 56-byte paths are populated at load via a back-patch of byte 18 from the `'pWin'` Gestalt query (`_Gestalt`, `$A1AD` at `0x11768`; runs only when the cinf is ≤ 18 bytes; not a resource fetch) and `0xfc5c` pixel-sample cache (bytes 20..55) respectively, never read from disk. Full trace + decision: `docs/spec/cinf-extended-decode.md`.

### 4. `wnd#` fallback ladder — **DECODED 2026-05-29**

At `0x356c..0x367e` — 12-step degraded-id fallback. Tries the requested id, then ANDs with `-2, -3, -4, -5, -6, -15, -16, -17, -18, -21, -22` in sequence until one resolves. Each step calls `_GetResource` (`0xA9A0`) with `'wnd#'` (FourCC `0x776e6423`) and the masked id, and skips the rest of the cascade once a non-null handle returns.

**Per-step asm pattern + the full landing table** (which canonical slugs degrade into which) live in `docs/spec/kdef231-reference.md §3.4.1`. **Runtime mirror**: `src/wndCascade.ts` (clean-room) + integration at `src/renderWindow.ts:resolveWindowType`. Corpus impact: 16 of 18 bundles ship at least one canonical slug the cascade resolves; three baselines (`crayon-os`, `windows-31`, `windows-95`) drifted into period-faithful resolutions when the helper landed.

**1.8.2 cross-check.** `grep -c "wnd#"` over both binaries: 1.8.2 returns **0**, 2.3.1 returns **17** matches (12 cascade attempts + 5 outside refs). The wnd# resource model + cascade were a 2.3.1-only addition.

### 5. FourCC vocabulary

Per-resource markers in 2.3.1 kDEF 0:

- **Window**: `wnd#`, `cinf`, `cicn`, `clut`, `actb`, `WDEF`; `pWin` is a Gestalt selector (`$A1AD` at `0x11768`), not a resource type
- **System probes**: `ATIr` (ATI Rage check), `qd `, `sysv`, `AOCE`, `HFS `
- **Theme creators**: `Acid` (Kaleidoscope), `Aarn`/`Aarp`/`Aaru` (Mac OS Aaron extension interop), `Copl` (Copland)
- **Control palette markers (NEW)**: `btnp`, `dbtp`, `cbtp`, `chkp`, `radp` (button / default-button / cmd-button / checkbox / radio palettes), `sbap`, `sbae`, `sbar`, `sbax`, `sbgh`, `sbth`, `sbtp` (scrollbar parts; answered by slot 1's message 34 at `0x9b42`), `bevp` (bevel; answered by slot 5's message 34 at `0x98ca`)
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

## Tab CDEF 8 identity (2026-10-18)

The same pinned control-panel AppleDouble and raw-fork chain above contains CDEF
8,15902bytes,SHA256 `4c9fecff46f6bfe2171961fa71e0831e5e2b85174f55531ad1a2fe895a82c680`.
Independent Python resource-map parsing located its reference at997278 and its
payload at42778, relative to the unwrapped raw fork. It exactly matches local
`.scratch/k231-kdef/CDEF/id-8.bin`. This establishes installer-component identity;
attribution of a running provider is separate. No original code is redistributed
or executed. The [tab body source contract](tab-cdef8-body.md) uses payload-relative
addresses and records its narrow painter/coordinate/mask claims.
