# Platinum Controls Decode — Implementation Plan (Sub-project ③, decode half)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover — clean-room — the geometry, drawing model, and color data needed to render Mac OS 8.5/8.6 Platinum standard controls faithfully, into spec docs + a palette artifact that a later Phase-B reimplement/generate plan builds against.

**Architecture:** Pure decode/derivation, mirroring the WDEF playbook (`2026-05-24-platinum-wdef125-decode.md` — sibling in this archive). Three streams feed a single assembly: (A) `CDEF-n63` 68k geometry, (C) color-data extraction — both parallelizable subagent work — and (B) the `AppearanceLib` PPC `DrawThemeButton` **spike gate**, owned by the lead. Parallel streams write to private findings artifacts; the lead assembles + cross-checks every constant before commit. No code ships in this phase; the deliverables are spec docs + a palette JSON/PNG.

**Tech Stack:** `m68k-elf-objdump` (installed, for the 68k CDEF), a PowerPC disassembler for the PEF (`llvm-objdump`/`otool -tV`/`powerpc-*-objdump` — Task 4 confirms), the existing JS resource toolchain in `.scratch/iso-recon/` + `tools/theme-loader/resource-fork.js`, Node 20.

**Design spec:** `docs/superpowers/specs/2026-05-26-platinum-controls-decode-design.md`.

---

## Clean-room guardrails (apply to EVERY task)

Non-negotiable, inherited from the WDEF decode plan and the project's clean-room rule:

1. **Mimic, never execute.** Disassembly/decompilation is for *understanding* only. Never run or ship Apple's code.
2. **Record facts, not Apple's code text.** Committed docs cite `0xADDR`/offsets and describe the algorithm in prose/tables. **Do not paste runs of Apple's disassembly into committed files.**
3. **All binaries + raw `.asm` stay in `.scratch/iso-recon/`** (already git-ignored, including `.scratch/iso-recon/findings/`). Only *our* extracted color **values** (grays/accent RGBs — facts, like a clut readout) and *our* spec prose enter git.
4. **Never guess a constant.** Instruction-pinned or data-extracted, or it goes to the doc's "could-NOT-pin" list — which gates Phase-B.

## Provenance (already done — do not redo)

- Source: `~/Downloads/Apple Mac OS 8.5/Apple MacOS 8.5 (PowerPC).iso`. Resources extracted to `.scratch/iso-recon/` (git-ignored).
- `CDEF-n63.bin` (5426 B, 68k) already disassembled → `.scratch/iso-recon/code-out/CDEF-n63.asm` (1874 lines). Fingerprint (2026-05-26): `jsr ×50`, `bsr ×0`, sparse QuickDraw (`LineTo ×5`, `FrameRect ×1`, `RGBForeColor ×2`, `EraseRect ×4`) → **delegates drawing, computes geometry**.
- `AppearanceLib` confirmed a PowerPC PEF in `85-System.bin`; exported symbols (byte offsets in the file): `AppearanceLib`@1506228, `DrawThemeButton`@1906490, `DrawThemeTrack`@1963439, `DrawThemeEditTextFrame`@1963062. 57 `DrawTheme*` exports total. PEF containers (`Joy!`) begin at offsets 800, 254688, 305776, ….
- Color data located: `apple-platinum-theme.rsrc` `clut` 200–220 (20 named accents + B&W); System `cctb` id=0 (128 B), `wctb` id=0 (112 B), `clut` id=9 (2056 B, 256-colour system palette).

Regenerate the CDEF disassembly if missing:
```bash
cd ~/Documents/git/scriptoscope/.scratch/iso-recon/code-out
m68k-elf-objdump -D -b binary -m m68k:68030 CDEF-n63.bin > CDEF-n63.asm
```

## Parallelization map (execution guidance)

- **Task 1** (scaffold) — lead, FIRST. Unblocks the rest.
- **Task 2** (CDEF geometry) — **subagent**, parallel. Writes `.scratch/iso-recon/findings/cdef-geometry.md`.
- **Task 3** (color extraction) — **subagent**, parallel/background. Writes `themes/apple-platinum-replica/sources/platinum-palette.json` + PNGs.
- **Task 4** (AppearanceLib spike — THE GATE) — **lead only**, may run concurrently with 2 & 3. Writes `.scratch/iso-recon/findings/appearancelib-spike.md`.
- **Task 5** (assemble + cross-check) — lead, AFTER 2/3/4 land. Merges findings into the committed docs, reconciles every constant, records the gate outcome + the Phase-B next step.

Tasks 2, 3, 4 share no output files, so they cannot clobber each other. Task 5 is the single integration point where faithfulness is verified.

## File Structure

- **Create (committed):** `docs/spec/platinum-controls-decode.md` — geometry + drawing-model decode (the deliverable).
- **Create (committed):** `docs/spec/platinum-controls-faithfulness-ledger.md` — per-kind × feature → source/status/Phase-B-impl ledger.
- **Create (committed):** `themes/apple-platinum-replica/sources/platinum-palette.json` + `*-preview.png` — extracted accent ramps + control grays (our values, not Apple code).
- **Create (git-ignored):** `.scratch/iso-recon/findings/cdef-geometry.md`, `.scratch/iso-recon/findings/appearancelib-spike.md` — working findings the lead assembles.
- **Read-only:** `.scratch/iso-recon/code-out/CDEF-n63.asm`, `85-System.bin`, `apple-platinum-theme.rsrc`, `85-System.rsrc`. Reference for style: `docs/spec/platinum-wdef125-decode.md`, `docs/spec/kdef231-reference.md`, `docs/spec/kdef-faithfulness-ledger.md`.

---

### Task 1: Scaffold the decode doc + ledger (lead, FIRST)

**Files:**
- Create: `docs/spec/platinum-controls-decode.md`
- Create: `docs/spec/platinum-controls-faithfulness-ledger.md`

- [ ] **Step 1: Create the decode doc skeleton**

Match `platinum-wdef125-decode.md`'s reference-header convention (cite the non-committed bins + the disasm commands), then the section skeleton:

````markdown
# Mac OS 8.5/8.6 Platinum controls — `CDEF` + `AppearanceLib` decode

*Clean-room decode of the Platinum standard controls. Geometry from the 68k
`CDEF` (id -63); drawing model from the PowerPC `AppearanceLib` `DrawTheme*`
suite. Mirrors the kDEF/WDEF playbook: cite `0xADDR`/offset, describe the
algorithm, **never** dump Apple's listing. Feeds the Phase-B control generator.*

```
# bins (NOT committed — Apple system code; git-ignored in .scratch/iso-recon):
#   code-out/CDEF-n63.bin   (5426B, 68k)
#   85-System.bin           (PowerPC PEF host of AppearanceLib)
# disassemble the CDEF:
#   m68k-elf-objdump -D -b binary -m m68k:68030 CDEF-n63.bin > CDEF-n63.asm
```

## Routine map (CDEF)
## Message dispatch (CDEF)
## Per-kind geometry
## AppearanceLib drawing model (spike: DrawThemeButton / push)
## Spike-gate decision (scale vs fallback)
## Accent application model
## Color data (accents + grays)
## Constants (the Phase-B inputs)
## Confirmed (instruction/data-backed) vs could-NOT-pin
## Phase-B ledger seed
````

- [ ] **Step 2: Create the ledger skeleton**

Mirror `kdef-faithfulness-ledger.md`'s table shape:

```markdown
# Platinum controls — faithfulness ledger (Phase-B contract)

| control kind | feature | source (CDEF 0xADDR / AppearanceLib off / cctb slot / WDEF-model reuse) | status (confirmed/could-NOT-pin/data/model-reuse) | planned Phase-B impl |
|---|---|---|---|---|
| _(seeded in Task 5)_ | | | | |
```

- [ ] **Step 3: Verify skeleton + commit**

```bash
cd ~/Documents/git/scriptoscope
grep -c '## ' docs/spec/platinum-controls-decode.md   # expect >= 10
mkdir -p .scratch/iso-recon/findings && git check-ignore .scratch/iso-recon/findings || echo "WARN: findings not git-ignored"
git add docs/spec/platinum-controls-decode.md docs/spec/platinum-controls-faithfulness-ledger.md
git commit -m "docs(platinum): scaffold controls decode doc + faithfulness ledger

Skeleton for the Platinum controls decode (geometry from CDEF -63, drawing
model from AppearanceLib). Sections filled by the parallel decode streams and
assembled in the cross-check task. Clean-room: cites offsets, no Apple listing."
```

---

### Task 2: CDEF-n63 geometry decode (SUBAGENT, parallel)

**Files:**
- Create: `.scratch/iso-recon/findings/cdef-geometry.md` (git-ignored working notes)
- Read-only: `.scratch/iso-recon/code-out/CDEF-n63.asm`

**Subagent brief:** clean-room 68k decode. Record facts (offsets, rect arithmetic) to the findings file; never paste Apple listing into anything git-tracked; any value you cannot pin to an instruction goes under a "could-NOT-pin" heading — do not guess.

- [ ] **Step 1: Locate the message dispatch**

The entry unpacks the CDEF args (`varCode`/`d5`-style, `theControl`, `message`, `param`) then dispatches on `message`. Find the range-check + jump table (idiom: `cmp` against a small constant, then `movew %pc@(<tbl>,%d0:w:2),%d0` + `jmp`):
```bash
cd ~/Documents/git/scriptoscope/.scratch/iso-recon/code-out
grep -nE 'cmpiw|cmpw|%pc@\(0x[0-9a-f]+,%d[0-9]:w' CDEF-n63.asm | head -30
```
Map indices to standard CDEF messages: `0 drawCntl · 1 testCntl · 2 calcCRgns · 3 initCntl · 4 dispCntl · 5 posCntl · 6 thumbCntl · 7 dragCntl · 8 autoTrack · 10 calcCntlRgn · 11 calcThumbRgn` (Inside Macintosh: Controls). Record the table base `0xTBL` + each target in the findings file.

- [ ] **Step 2: Pin the control-kind dispatch (`varCode`)**

`drawCntl` branches on the control's *kind* (low bits of `varCode`, or the CDEF's own kind field). Find the secondary dispatch inside the `drawCntl` target and record which kinds route through this CDEF vs. elsewhere. The trap-scan showed sparse drawing + heavy `jsr` — confirm each kind's draw path ends in an outbound call (the `DrawTheme*` delegation), and record *which* call (by the jump-table/glue offset) per kind where determinable.

- [ ] **Step 3: Per-kind geometry pass**

For each kind reachable here (push button, bevel button, checkbox, radio, popup button, scrollbar track/thumb/arrows, slider + tick marks, tab, disclosure triangle, progress, little-arrows): read the rect arithmetic feeding `calcCRgns`/`calcCntlRgn`/`calcThumbRgn` and the draw path. Pin: part layout, insets, min/best size, thumb/track regions, hit regions. Cite each `0xADDR`. Anything ambiguous → "could-NOT-pin".

- [ ] **Step 4: Cross-check geometry self-consistency**

For each kind, verify part rects sit inside the control bounds and don't overlap incoherently. Flag contradictions in "could-NOT-pin" rather than forcing a value.

- [ ] **Step 5: Report**

Write the findings file with: Routine map, dispatch table, per-kind geometry tables (with `0xADDR`), the `DrawTheme*` call map, and the "could-NOT-pin" list. Return a summary to the lead (no commit — Task 5 assembles).

---

### Task 3: Color-data extraction (SUBAGENT, parallel/background)

**Files:**
- Create: `themes/apple-platinum-replica/sources/platinum-palette.json` (committed — our extracted values)
- Create: `themes/apple-platinum-replica/sources/platinum-palette-preview.png` (committed swatch sheet)
- Read-only: `.scratch/iso-recon/apple-platinum-theme.rsrc`, `.scratch/iso-recon/85-System.rsrc`
- Reference: `tools/theme-loader/resource-fork.js`, `.scratch/iso-recon/enumerate.mjs`, `.scratch/iso-recon/decode-patterns.mjs`

**Subagent brief:** mechanical extraction. These are color *values* (facts), fine to commit. Use the existing resource-fork parser.

- [ ] **Step 1: Extract the 20 named accent cluts**

Write a small Node script (in `.scratch/iso-recon/`, ad-hoc) using `parseResourceFork` from `tools/theme-loader/resource-fork.js` to read `apple-platinum-theme.rsrc`, pull `clut` ids 200–220, and emit `{ id, name, entries: [[r,g,b],...] }`. Verify each clut parses to its expected entry count.

- [ ] **Step 2: Extract the default control/window grays**

From `85-System.rsrc`, pull `cctb` id=0, `wctb` id=0, and `clut` id=9. Decode `cctb`/`wctb` to their `{ part → RGB }` slot tables (ControlColorTable / WindowColorTable layout: a count followed by `{value: int16, rgb: 3×uint16}` records). Record the slot→RGB map.

- [ ] **Step 3: Write `platinum-palette.json`**

Emit: `{ accents: { "<name>": [[r,g,b],...] }, controlColors: { "<slotName>": [r,g,b] }, windowColors: {...}, systemPalette: [[r,g,b]×N] }`. RGBs normalized to 8-bit.

- [ ] **Step 4: Verify + preview**

Assert grays are a coherent neutral ramp (R≈G≈B, monotonic) and a sample accent matches its name (e.g. "Bondi" ≈ teal-blue, "Sapphire" ≈ blue). Render a labelled swatch PNG (`src/pixelBuffer.ts` or `sharp`). Verify:
```bash
cd ~/Documents/git/scriptoscope
node -e "const p=require('./themes/apple-platinum-replica/sources/platinum-palette.json'); console.log('accents',Object.keys(p.accents).length,'controlColors',Object.keys(p.controlColors).length)"
# expect: accents 21 (20 + B&W), controlColors > 0
```

- [ ] **Step 5: Report**

Return a summary (accent count, gray ramp values, any clut that failed to parse) to the lead. Commit is done in Task 5 alongside the docs, OR commit the two `sources/` files here standalone:
```bash
git add themes/apple-platinum-replica/sources/platinum-palette.json themes/apple-platinum-replica/sources/platinum-palette-preview.png
git commit -m "data(platinum): extract 20 accent cluts + cctb/wctb control grays

From apple-platinum-theme.rsrc (clut 200-220) + System cctb/wctb/clut-9.
Verified neutral gray ramp + named accents. Phase-B palette input."
```

---

### Task 4: AppearanceLib `DrawThemeButton` spike — THE GATE (lead only)

**Files:**
- Create: `.scratch/iso-recon/findings/appearancelib-spike.md` (git-ignored)
- Read-only: `.scratch/iso-recon/85-System.bin`

This is the bounded PPC reverse-engineering bet. Decode ONE routine end-to-end; the outcome decides whether Phase-B PPC-decodes the rest or falls back to data + the WDEF bevel model.

- [ ] **Step 1: Confirm a PowerPC disassembler**

Try, in order, and use whichever resolves PPC instructions:
```bash
llvm-objdump --version 2>/dev/null && echo "use: llvm-objdump -d --arch=powerpc"
otool --version 2>/dev/null && echo "use: otool -tV (ppc)"
which powerpc-linux-gnu-objdump powerpc-elf-objdump 2>/dev/null
```
Record the chosen tool in the findings file. If none disassemble PPC, note it as a blocker and stop (the gate resolves to "fallback").

- [ ] **Step 2: Isolate the AppearanceLib PEF container**

The `DrawThemeButton` symbol string sits at file offset 1906490, but that's the loader string table, not code. Find the PEF container that owns it: the `Joy!peff` header preceding it, then parse the PEF container header (`Joy!` `peff` `pwpc`, section count, section headers) to locate the **code section** and the **loader section** (which holds the export hash table). Record the container's file range + code-section offset.

- [ ] **Step 3: Resolve `DrawThemeButton`'s code offset**

Parse the PEF loader section's export hash table to map `DrawThemeButton` → its transition vector → code-section offset. (PEF export entries give a symbol's class + offset; cross-reference the hashed name.) Record the code offset. Sanity-check by disassembling a few instructions and confirming a sane PPC function prologue (`mflr`, `stwu r1,-N(r1)`).

- [ ] **Step 4: Decode the push-button draw path**

Disassemble from the entry; follow the dispatch on button *kind* to the push-button case. Pin: bevel inset deltas, edge light/dark order, the gray slots read (correlate to `cctb` offsets via the theme-state struct), and any gradient/fill model. Record each with its code offset. Helper calls (blend/fill) — record the call site + what it computes; recurse only as far as needed to pin the push-button parameters.

- [ ] **Step 5: Cross-check vs `cctb`**

Compare the grays the routine reads against `cctb` id=0 (from Task 3, or extract inline). They should agree within rounding. Agreement strengthens the gate toward "scale"; disagreement is flagged (it may mean the routine computes grays rather than reading them).

- [ ] **Step 6: Record the GATE decision**

In the findings file, write an explicit verdict with rationale:
- **SCALE** — push-button params were instruction-pinnable within bounded effort AND the PPC structure looks repeatable for `DrawThemeTrack`/`DrawThemeTab`/etc. → Phase-B PPC-decodes the remaining kinds.
- **FALLBACK** — too entangled to pin, OR `cctb`+`clut` already specifies the grays such that decode adds little → Phase-B uses extracted data + the proven WDEF bevel model, decoding AppearanceLib only where data is genuinely ambiguous.
Include the effort estimate that justifies the call. Return the verdict to the lead.

---

### Task 5: Assemble + cross-check (lead, AFTER 2/3/4)

**Files:**
- Modify: `docs/spec/platinum-controls-decode.md`, `docs/spec/platinum-controls-faithfulness-ledger.md`
- Read-only: the three findings artifacts + `platinum-palette.json`

- [ ] **Step 1: Merge geometry (from Task 2)**

Transcribe the Routine map, dispatch table, and per-kind geometry into the decode doc's sections. Carry over every `0xADDR`. Move every Task-2 "could-NOT-pin" item into the doc's honesty section verbatim.

- [ ] **Step 2: Merge the spike + gate (from Task 4)**

Fill "AppearanceLib drawing model" + "Spike-gate decision" with the push-button decode and the SCALE/FALLBACK verdict + rationale. Fill "Accent application model" with whatever the spike revealed about how the accent clut maps onto the control (or flag it unresolved).

- [ ] **Step 3: Fold in color data (from Task 3)**

Summarize the extracted accents + grays in "Color data", linking to `platinum-palette.json` as the authoritative artifact (don't duplicate all RGBs in prose).

- [ ] **Step 4: Cross-check every committed constant**

For each `0xADDR`/offset cited, confirm it resolves to a plausible instruction in the corresponding `.asm`:
```bash
cd ~/Documents/git/scriptoscope
grep -oE '0x[0-9a-f]{2,6}' docs/spec/platinum-controls-decode.md | sort -u > /tmp/cited-controls.txt
wc -l /tmp/cited-controls.txt   # spot-check ~5 against CDEF-n63.asm
```
Reconcile any disagreement between the geometry (Task 2) `DrawTheme*` call map and the spike (Task 4) routine identity. Anything unverifiable → "could-NOT-pin", not silently kept.

- [ ] **Step 5: Seed the faithfulness ledger**

One row per control kind × feature → source (CDEF `0xADDR` / AppearanceLib offset / `cctb` slot / WDEF-model reuse) → status → planned Phase-B impl. This is the Phase-B contract.

- [ ] **Step 6: Record the Phase-B next step + commit**

In the decode doc's footer, state the next plan to write per the gate outcome (scale: `…-platinum-controls-appearancelib-decode.md`; fallback: `…-platinum-controls-generate.md`). Then:
```bash
cd ~/Documents/git/scriptoscope
git add docs/spec/platinum-controls-decode.md docs/spec/platinum-controls-faithfulness-ledger.md themes/apple-platinum-replica/sources/platinum-palette.json themes/apple-platinum-replica/sources/platinum-palette-preview.png
git commit -m "docs(platinum): controls decode complete — geometry, spike, palette

CDEF -63 per-kind geometry pinned; AppearanceLib DrawThemeButton spike decoded
with the SCALE/FALLBACK gate verdict recorded; 20 accent cluts + cctb grays
extracted to sources/platinum-palette.json. Faithfulness ledger seeded as the
Phase-B contract. Honesty section lists every could-NOT-pin. Clean-room: offsets
cited, no Apple listing committed."
```

---

## Phase B (separate plan — gated on Task 4's verdict)

Once the gate is recorded, write the follow-on per the outcome:
- **SCALE:** decode the remaining `DrawTheme*` kinds (PPC), extend the ledger, then the generator.
- **FALLBACK:** straight to the procedural control generator — bake control `cicn`s × state × accent from CDEF geometry + `platinum-palette.json` + the WDEF bevel model; wire into the bundle; retire the `apple-platinum-2` control graft; simplify `controls.ts`; verify with `lint:themes` + the ledger + a Playground render.

## Self-Review (against the design spec)

- **Spec coverage:** geometry decode (T2 → spec §"Per-kind geometry"); drawing-model decode + spike gate (T4 → §"AppearanceLib", §"Spike-gate decision"); color-data extraction (T3 → §"Color data" + palette artifact); faithfulness ledger (T5); clean-room guardrails (header + per-task briefs); control-ID mapping discipline (deferred to Phase-B per spec — noted, no T here). The 57-`DrawTheme*` surface is acknowledged but bounded to the push-button spike by design. ✓
- **No placeholders:** decode "discover-then-plug-in" steps (e.g. `0xTBL`) follow the WDEF plan's accepted pattern for RE, not vague TODOs; every step has a concrete command or action. ✓
- **No clobbering / type consistency:** parallel T2/T3/T4 write disjoint files; `platinum-palette.json` shape is defined once (T3) and referenced (T5); findings → committed docs only via the T5 assembly. ✓
- **Faithfulness safeguards (the parallelism risk):** spike-gate owned by lead (T4); single cross-check integration point (T5 step 4); "never guess → could-NOT-pin" in every brief. ✓
