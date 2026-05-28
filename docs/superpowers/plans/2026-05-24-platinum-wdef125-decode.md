# Platinum WDEF 125 Decode — Implementation Plan (Phase A)

> **STATUS — COMPLETE (Phase A shipped).** All 7 tasks were executed and committed task-by-task;
> the deliverable is [`docs/spec/platinum-wdef125-decode.md`](../../spec/platinum-wdef125-decode.md)
> (the full WDEF-125 decode). This file is the historical implementation plan, kept alongside its
> sibling plans (`2026-05-24-platinum-theme-generator.md`, `2026-05-26-platinum-controls-decode.md`).
>
> **Phase B (bottom of this doc) was SUPERSEDED.** Instead of a runtime `src/platinum.ts`
> reimplementation, Platinum became a *generated theme bundle* (`apple-platinum-replica`, via
> `scripts/generate-platinum*`), and the controls CDEF got its own decode + plan
> ([`docs/spec/platinum-controls-decode.md`](../../spec/platinum-controls-decode.md),
> `2026-05-26-platinum-controls-decode.md`). Read the Phase-B section below as the original intent,
> not current work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover the exact title-bar / frame / window-widget drawing algorithm of the Mac OS 8.5 Platinum window proc (`WDEF` id 125) into a concrete, clean-room spec doc (`docs/spec/platinum-wdef125-decode.md`), so a later phase can reimplement it faithfully in `src/platinum.ts`.

**Architecture:** Pure decode/derivation, mirroring the kDEF playbook (`kdef231-recipe-walk.md` + `kdef-faithfulness-ledger.md`). We disassemble the 68k resource (`m68k-elf-objdump`; Ghidra decompiler only where control flow is gnarly), read the `wDraw` and widget paths, and record the algorithm + exact constants (pinstripe period, gray RGBs, bevel insets, widget geometry, active/inactive variants) keyed by file offset (`0xADDR`). **No code is written against the product in this phase** — the output is a spec + a seeded ledger.

**Tech Stack:** `m68k-elf-objdump` (already installed), Ghidra (`ghidraRun`/`pyghidraRun`, optional), the existing JS resource toolchain in `.scratch/iso-recon/`, Node 20.

---

## Clean-room guardrails (apply to EVERY task)

These are non-negotiable and inherited from `kdef-architecture.md §4` and the project memory:

1. **Mimic, never execute.** The disassembly is for *understanding*. Never run or ship Apple's 68k.
2. **Record facts, not Apple's code text.** Committed docs capture the *algorithm* — addresses, constants, geometry, control flow in prose/tables. **Do not paste runs of Apple's disassembly into committed files.** (The kDEF reference does the same: it cites `0xADDR` and describes, it does not dump the listing.)
3. **All binaries + raw `.asm` stay in `.scratch/iso-recon/` only** — already git-ignored (`git check-ignore` confirmed). Nothing Apple-derived enters git.
4. **Faithful to the decode — never guess a constant.** If a value can't be pinned to an instruction, it goes in the doc's "could NOT pin" section, not invented. This is what gates Phase B.

## Provenance (already done — do not redo)

- Source disc: `~/Downloads/Apple Mac OS 8.5/Apple MacOS 8.5 (PowerPC).iso` (HFS, mounted via `hmount`).
- `WDEF 125` resource fork extracted → `.scratch/iso-recon/code-out/WDEF-125.bin` (5900 B, raw 68k, `LINK A6` prologue at offset 0).
- Disassembly → `.scratch/iso-recon/code-out/WDEF-125.asm` (2216 lines).
- Trap-scan confirmed WDEF 125 as the Platinum drawer: `LineTo ×22`, `RGBForeColor ×15`, `RGBBackColor ×10`, `FrameRect ×12`, `PaintOval ×8`, `FrameOval ×3` — raw QuickDraw, **no** Appearance-dispatch delegation.
- Entry dispatcher decoded: `d4=message`, `a2=theWindow`, `d5=varCode`, `d3=param`; preamble does `GetPort`→`GetWMgrPort`(0xA910)→colorQD check (`jsr 0x131c`)→`GetCWMgrPort`(0xAA48)→`SetPort`.

If `WDEF-125.asm` is missing, regenerate:
```bash
cd ~/Documents/git/scriptoscope/.scratch/iso-recon/code-out
m68k-elf-objdump -D -b binary -m m68k:68030 WDEF-125.bin > WDEF-125.asm
```

## File Structure

- **Create:** `docs/spec/platinum-wdef125-decode.md` — the deliverable. Sections (built up task-by-task): Reference header → Routine map → Message dispatch → TL;DR algorithm → Title-bar fill (pinstripe) → Frame/bevel insets → Window widgets → Color sourcing → Active/inactive variants → Constants table → "Confirmed vs could-not-pin" → Phase-B ledger seed.
- **Read-only:** `.scratch/iso-recon/code-out/WDEF-125.asm`, `WDEF-125.bin` (git-ignored; never commit).
- **Reference for house style:** `docs/spec/kdef231-recipe-walk.md`, `docs/spec/kdef231-reference.md`, `docs/spec/kdef-faithfulness-ledger.md`.

---

### Task 1: Scaffold the decode doc + reference header

**Files:**
- Create: `docs/spec/platinum-wdef125-decode.md`

- [ ] **Step 1: Create the doc with the reference header and empty section skeleton**

Match the `kdef231-reference.md` header convention (cite the non-committed bin + the disasm command, then a Routine-map table to be filled):

````markdown
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
````

- [ ] **Step 2: Verify the doc renders and links resolve**

Run:
```bash
cd ~/Documents/git/scriptoscope
test -f docs/spec/platinum-wdef125-decode.md && grep -c '## ' docs/spec/platinum-wdef125-decode.md
ls docs/spec/kdef231-recipe-walk.md docs/spec/kdef-faithfulness-ledger.md
```
Expected: the count is ≥ 11 (all skeleton sections present) and both companion files exist.

- [ ] **Step 3: Commit**

```bash
git add docs/spec/platinum-wdef125-decode.md
git commit -m "docs(platinum): scaffold WDEF 125 decode doc + reference header

Skeleton for the Mac OS 8.5 Platinum window-proc decode (Phase A). Routine map
seeded with the decoded entry dispatcher; remaining sections filled task-by-task.
Clean-room: cites 0xADDR, no Apple listing committed; bin stays in .scratch."
```

---

### Task 2: Decode the message dispatch (find wDraw / wHit / wCalcRgns)

**Files:**
- Modify: `docs/spec/platinum-wdef125-decode.md` (fill "Message dispatch", extend Routine map)
- Read-only: `.scratch/iso-recon/code-out/WDEF-125.asm`

- [ ] **Step 1: Locate the dispatch on `d4` (message)**

The entry loads `message` into `d4` (`movew %fp@(12),%d4` at `0x0c`). Find where `d4` is range-checked and used to index a jump table (look for `cmpiw`/`cmpw` against a small constant, then a `movew %pc@(<tbl>,%d0:w:2),%d0` + `jmp %pc@(<tbl>,...)` — the same idiom catalogued for the kDEF CDEF at `0x67a2`).

Run:
```bash
cd ~/Documents/git/scriptoscope/.scratch/iso-recon/code-out
grep -nE 'cmpiw|cmpw .*%d4|%pc@\(0x[0-9a-f]+,%d[0-9]:w' WDEF-125.asm | head -30
```

- [ ] **Step 2: Decode the jump-table entries**

Once the table base `0xTBL` is found, hex-peek the int16 offset entries and compute each target (`target = TBL + entry`, as in the kDEF reference §1.1). Hex-peek:
```bash
m68k-elf-objdump -s -b binary -m m68k WDEF-125.bin | grep -A4 -iE ' <TBL-hex-row> '
```
Map each index to a WDEF message: `0 wDraw · 1 wHit · 2 wCalcRgns · 3 wNew · 4 wDispose · 5 wGrow · 6 wDrawGIcon` (Inside Macintosh: Windows).

- [ ] **Step 3: Record the dispatch table + extend the routine map**

In "Message dispatch", add a table (index → target `0xADDR` → message name). Add each target routine (`wDraw`, `wHit`, `wCalcRgns`, …) to the Routine map with a one-line role.

- [ ] **Step 4: Cross-check the dispatch by trap fingerprint**

Verify the labels are right by confirming each target's trap fingerprint matches its claimed role:
```bash
# wCalcRgns target should be region-heavy (SetRectRgn 0xa8df / RectRgn 0xa8e9 / NewRgn 0xa8fe);
# wDraw target should hold the LineTo (0xa891) + RGBForeColor (0xaa14) cluster.
grep -nE 'a8df|a8e9|a8fe|a891|aa14' WDEF-125.asm | head -40
```
Expected: the region traps cluster under the index-2 target; the LineTo/RGBForeColor cluster sits under the index-0 target. Note any mismatch in the doc's "could-NOT-pin" list rather than forcing a label.

- [ ] **Step 5: Commit**

```bash
git add docs/spec/platinum-wdef125-decode.md
git commit -m "docs(platinum): decode WDEF 125 message dispatch

Jump table at 0xTBL → wDraw/wHit/wCalcRgns/... targets, each verified by trap
fingerprint. Routine map extended. (replace 0xTBL with the decoded address)"
```

---

### Task 3: Decode the title-bar fill — the pinstripe

**Files:**
- Modify: `docs/spec/platinum-wdef125-decode.md` (fill "Title-bar fill — the pinstripe")

- [ ] **Step 1: Isolate the wDraw title-bar block**

Inside the `wDraw` target (from Task 2), the title bar is filled by a loop. Find the densest `LineTo` (0xa891) cluster and the `RGBForeColor` (0xaa14) calls bracketing it:
```bash
cd ~/Documents/git/scriptoscope/.scratch/iso-recon/code-out
grep -nE 'a891|a893|aa14|aa15|a89b' WDEF-125.asm | sed -n '1,60p'
```

- [ ] **Step 2: Pin the stripe period**

Read the loop body: identify the loop counter register and the **increment added to the Y coordinate each iteration** (look for `addqw #N,<y>` or `addw #N,<y>` where the same register feeds `MoveTo`/`LineTo`). That `N` is the pinstripe period in pixels. Record the loop bounds (start Y, end Y = title-bar height) and whether horizontal lines span the full title width.

- [ ] **Step 3: Pin the alternation**

Determine how the loop alternates colors: either two `RGBForeColor` calls inside the loop guarded by a parity test (`btst #0,<counter>`), or a pre-set pen pattern. Record the exact mechanism and which two color slots it toggles between (the RGB values themselves come from Task 6 — here record *that* it toggles slots X/Y and the period).

- [ ] **Step 4: Record the pinstripe algorithm**

In "Title-bar fill — the pinstripe", write the decoded loop as prose + a tiny pseudocode block (our words, not Apple's listing): period, span, color-slot alternation, and the title-bar rect derivation (where top/height come from — likely `a2@`-relative window struct fields). Cite each `0xADDR`.

- [ ] **Step 5: Cross-check against the rendered look**

Sanity-check: a Platinum active title bar reads as fine horizontal pinstripes. Confirm the recovered period is small (expected 1–2 px) and the loop covers the full title-bar height. If the decoded period contradicts the look (e.g. > 3 px), flag it in "could-NOT-pin" and re-read — do not "correct" it silently.

- [ ] **Step 6: Commit**

```bash
git add docs/spec/platinum-wdef125-decode.md
git commit -m "docs(platinum): decode WDEF 125 title-bar pinstripe loop

Period, span, and two-slot color alternation pinned to the wDraw loop at 0xADDR.
Color values deferred to the color-sourcing task."
```

---

### Task 4: Decode the frame & bevel insets

**Files:**
- Modify: `docs/spec/platinum-wdef125-decode.md` (fill "Frame & bevel insets")

- [ ] **Step 1: Find the structure-frame drawing**

The window's outer frame + 3D bevel uses `FrameRect` (0xa8a1), `InsetRect` (0xa8d5 / inline `addq` on a Rect), and edge `LineTo`s. Locate them in the wDraw target:
```bash
cd ~/Documents/git/scriptoscope/.scratch/iso-recon/code-out
grep -nE 'a8a1|a8d5|a891|a893' WDEF-125.asm | sed -n '1,50p'
```

- [ ] **Step 2: Pin the insets and bevel order**

Read the Rect math feeding each `FrameRect`/`LineTo`: record the inset deltas (how many px in from the structure rect for each bevel line) and the order of light/dark edges (top-left light, bottom-right dark = raised; the reverse = recessed). Record which color slot each edge uses (values from Task 6).

- [ ] **Step 3: Record the frame model**

In "Frame & bevel insets", document the structure→content inset (the frame thickness on each side) and the bevel line sequence with per-edge color slots and pixel offsets. Cite `0xADDR`s. Note: compare against the existing `frameFromBody`/`drawableExtent` model in `kdef-faithfulness-ledger.md` — call out where Platinum's fixed insets differ from the cicn-derived insets the kDEF uses.

- [ ] **Step 4: Cross-check inset arithmetic is self-consistent**

Verify the recovered insets sum correctly: `content_rect = structure_rect inset by (left+right, top+bottom)` with top including the title-bar height from Task 3. If they don't reconcile, flag in "could-NOT-pin".

- [ ] **Step 5: Commit**

```bash
git add docs/spec/platinum-wdef125-decode.md
git commit -m "docs(platinum): decode WDEF 125 frame + bevel insets

Per-edge bevel order, inset deltas, and structure/content reconciliation pinned
to FrameRect/LineTo sites at 0xADDR."
```

---

### Task 5: Decode the window widgets (close / zoom / collapse)

**Files:**
- Modify: `docs/spec/platinum-wdef125-decode.md` (fill "Window widgets")

- [ ] **Step 1: Find the widget draw sites**

The trap-scan showed `PaintOval ×8` / `FrameOval ×3` — the widget glyphs. Locate them and the rect math that positions each box:
```bash
cd ~/Documents/git/scriptoscope/.scratch/iso-recon/code-out
grep -nE 'a8a8|a8a7|a8a1|a8a5|aa11' WDEF-125.asm | sed -n '1,50p'
```

- [ ] **Step 2: Pin each widget's geometry + state**

For each of close / zoom / collapse: record the box size, its offset from the title-bar ends, and the draw primitives (square + bevel? oval highlight?). Determine the **state branches**: active vs inactive, and pressed (the `wDrawGIcon`/param path) — look for a branch on the window's hilite flag or on `param` (`d3`).

- [ ] **Step 3: Record the widget model**

In "Window widgets", document each widget's geometry, the primitive sequence, and the active/inactive/pressed variants, with `0xADDR`s. Cross-reference the kDEF's stance (`kdef-architecture.md`: kDEF widgets are baked into the cicn; Platinum draws them procedurally — note this as the key structural difference for Phase B).

- [ ] **Step 4: Cross-check widget placement**

Verify the widget boxes land inside the title-bar rect (from Task 3) and don't overlap the title text region. Flag any unresolved positioning in "could-NOT-pin".

- [ ] **Step 5: Commit**

```bash
git add docs/spec/platinum-wdef125-decode.md
git commit -m "docs(platinum): decode WDEF 125 window widgets

close/zoom/collapse geometry, primitives, and active/inactive/pressed states
pinned to the PaintOval/FrameRect sites at 0xADDR."
```

---

### Task 6: Decode color sourcing + active/inactive variants

**Files:**
- Modify: `docs/spec/platinum-wdef125-decode.md` (fill "Color sourcing", "Active vs inactive title bar")

- [ ] **Step 1: Trace every RGBForeColor/RGBBackColor argument**

For each `RGBForeColor` (0xaa14) / `RGBBackColor` (0xaa15), read backward to where the `RGBColor` (3×uint16) is built on the stack or loaded. Two possibilities, decide per-site:
- **Hardcoded:** `movew #0xRRRR / #0xGGGG / #0xBBBB` immediates → record the literal RGB.
- **Fetched:** a call into the system (e.g. a `GetGray`-style trap, or reading an Appearance brush) → record the *source*, not a guessed value.
```bash
cd ~/Documents/git/scriptoscope/.scratch/iso-recon/code-out
grep -nE 'aa14|aa15|movew #0x|movel #0x' WDEF-125.asm | sed -n '1,80p'
```

- [ ] **Step 2: Record the color table**

In "Color sourcing", build a table: color-slot → RGB value (or fetch source) → which feature uses it (pinstripe light/dark, bevel light/dark, title-bar base, widget faces). This table is the literal Phase-B palette.

- [ ] **Step 3: Pin the active/inactive branch**

Find the branch on window-active state (the hilited flag in the WindowRecord via `a2@`, or `varCode` `d5`). Record how the inactive title bar differs (Platinum: inactive bar drops the pinstripes / desaturates, widgets hollow). Document the two code paths and which color slots/period each uses.

- [ ] **Step 4: Cross-check the palette is a coherent gray ramp**

Verify the recovered grays form a monotonic light→dark ramp (Platinum is a neutral gray theme; R≈G≈B at each slot). A non-gray or non-monotonic value is a likely mis-decode → flag in "could-NOT-pin", don't ship it.

- [ ] **Step 5: Commit**

```bash
git add docs/spec/platinum-wdef125-decode.md
git commit -m "docs(platinum): decode WDEF 125 color palette + active/inactive paths

Per-slot RGB (or fetch source) traced from every RGBForeColor/RGBBackColor site;
active vs inactive title-bar divergence recorded. Palette verified as a gray ramp."
```

---

### Task 7: Assemble the spec — TL;DR, constants, honesty section, ledger seed

**Files:**
- Modify: `docs/spec/platinum-wdef125-decode.md` (fill the remaining synthesis sections)

- [ ] **Step 1: Write the TL;DR algorithm**

In "TL;DR — the algorithm", summarize the full draw pass in ~8 numbered steps (port setup → frame/bevel → title-bar fill/pinstripe → title text region → widgets → active/inactive), each linking down to its decoded section by `0xADDR`. Mirror the kDEF recipe-walk TL;DR style.

- [ ] **Step 2: Fill the Constants table (the Phase-B contract)**

In "Constants (the Phase-B inputs)", consolidate every pinned number into one table: pinstripe period, title-bar height source, frame insets per side, bevel offsets, each widget's box rect, and the full color palette. Every row cites its `0xADDR`. **Anything not instruction-pinned goes to the next section, not here.**

- [ ] **Step 3: Write "Confirmed vs could-NOT-pin"**

Two honest lists, exactly like `kdef231-recipe-walk.md`: what's instruction-decoded and trusted, and what remains inferred/ambiguous (with why). This is the integrity gate — Phase B may only build on the "confirmed" list.

- [ ] **Step 4: Seed the Phase-B faithfulness ledger**

In "Phase-B faithfulness-ledger seed", add a `kdef-faithfulness-ledger.md`-shaped table (columns: WDEF routine `0xADDR` | role | planned `platinum.ts` impl | status `(planned)` | divergence/notes). One row per decoded feature. This is the contract the Phase-B plan executes against.

- [ ] **Step 5: Self-review the spec against the asm**

Re-read the doc with fresh eyes: every Constants row must cite an address that exists in `WDEF-125.asm`; every "confirmed" claim must be instruction-backed; no invented values. Fix gaps inline.

Run:
```bash
cd ~/Documents/git/scriptoscope
# every 0xADDR cited in the constants table should be a real offset in the asm
grep -oE '0x[0-9a-f]{2,5}' docs/spec/platinum-wdef125-decode.md | sort -u > /tmp/cited.txt
wc -l /tmp/cited.txt
```
Expected: a non-trivial list; spot-check 5 addresses resolve to plausible instructions in `WDEF-125.asm`.

- [ ] **Step 6: Commit**

```bash
git add docs/spec/platinum-wdef125-decode.md
git commit -m "docs(platinum): WDEF 125 decode complete — TL;DR, constants, ledger seed

Phase A done: title-bar pinstripe, frame/bevel, widgets, and gray palette pinned
to instructions; honesty section flags the unresolved bits; Phase-B ledger seeded.
Clean-room: spec only, no Apple listing committed."
```

---

## Phase B (separate plan — blocked on this)

Once `platinum-wdef125-decode.md` lists confirmed constants, write `2026-MM-DD-platinum-wdef125-reimplement.md`:
- TDD `src/platinum.ts` against the Constants table (transcribe values from the decode doc — never re-guess).
- Wire the active/inactive variants and widget states.
- Verify with `npm run lint:themes` + `npm run diag:audit`, and a Playground visual check against the reference Platinum look.
- Promote the decode doc's ledger seed into `kdef-faithfulness-ledger.md` (or a sibling `platinum-faithfulness-ledger.md`), recording every deliberate divergence.
- Also decode the **controls CDEF** (buttons/scrollbars/checkboxes) — likely `CDEF -63` (5426B) — as its own decode doc, same playbook, if the scheme corpus needs procedural Platinum controls beyond the window frame.

## Self-Review (against this plan's intent)

- **Coverage:** dispatch (T2), pinstripe (T3), frame/bevel (T4), widgets (T5), color + active/inactive (T6), synthesis/constants/ledger (T7). The full Platinum window draw pass is covered. Controls CDEF is explicitly deferred to Phase B.
- **No invented constants:** every value is sourced from an instruction or pushed to "could-NOT-pin". This is enforced in T6/T7 cross-checks.
- **Clean-room:** guardrails section + per-commit reminders keep Apple's listing out of git; bin/asm confirmed git-ignored.
- **House style:** doc skeleton (T1) mirrors `kdef231-reference.md`/`recipe-walk`; ledger seed (T7) mirrors `kdef-faithfulness-ledger.md`.
