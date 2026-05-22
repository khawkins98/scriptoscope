# kDEF re-trace v2 — verifying the decompilation, recovering the clean model

**Date:** 2026-05-22 · **Branch:** `v2-reset`

Driven by the observation that `composeEdgeFromRecipe` has grown far more
procedural conditional logic than a compact 68k DEF could have contained. Litmus
test (from the user): *this was a 68k program; there is a scalable, non-messy way
they did it.* Every heuristic we have (uniformity, plate scoring, dark-outlier
bezel, bracket-fixing, distribution) is a symptom of GUESSING something the
recipe data already encodes.

## 1. Decompilation soundness — is the trace trustworthy?

`/tmp/kaleido-trace/` has: `kDEF_0.bin` (60732B, the 68k DEF), `kDEF_0.asm`
(objdump, MC68020), `kdef_decomp.c` (Ghidra, **287 `halt_baddata` regions** —
the decompiler choked), and `kdef_decomp_nop.c` (the SAME binary with the bad
bytes NOP'd out, so Ghidra produces fuller but **potentially fabricated** C).

Verdict:
- **The raw asm is the trustworthy ground truth.** The resource is a standard
  code resource: `0x0: bras 0xc` skips an 8-byte "kDEF" header; real code at
  `0xc+` decodes cleanly (`moveml`/`jsr`/`lea`/A-traps). Key functions have
  clean prologues (`5eb4: linkw %fp,#-36`, reached via `jsr pc@(0x5eb4)`).
- Most of the 2151 objdump "mis-decodes" are Mac **A-traps** (`a0xx` → `.short`,
  valid toolbox calls objdump doesn't name) + the 8-byte header. Not real
  disassembly failures.
- The 287 `halt_baddata` are the **decompiler** choking, not the disassembler.
  **Anything read only from `kdef_decomp_nop.c` is suspect** and must be
  cross-checked against `kDEF_0.asm`.

## 2. A mis-attribution in the prior trace

`FUN_00005eb4` (the "centre the title, stretch the middle column" routine the
earlier review cited for document-window centering) is the **POPUP-WINDOW TAB**
stretch, not the document title. Its caller `FUN_0000653c` reads a popup-tab
struct (`*(*(param_1+4)+0x1c)`), and the doc describes exactly this for popups
("stamps the tab… stretching the middle column"). Document windows are drawn
differently ("simply stretching the icon").

## 3. The recipe is `(part, border)` — the part code is the ONLY per-segment signal

`tools/theme-loader/decoders/wnd.js`: each side-recipe entry is just
`{ part: int16, border: int16 }` (a part code + a pixel position). There is no
per-segment stretch/fixed flag in the data. So a 68k DEF decides behaviour by a
`switch (partCode)` jump table — NOT by measuring pixel uniformity, scoring
columns, or luminance outliers. **Our entire heuristic pile is re-deriving the
part code's meaning.** The clean model is a small part-code → draw-mode table.

## 4. Title TEXT placement — SOLVED + implemented

kdef-disassembly-findings §9.4: the title text is a **centered part** (anchor
placement mode 0: `left = cx − w/2`, `cx` = window content centre), positioned
independently of frame growth. Implemented in `renderWindow.ts` (commit
`fcfbaf6`): centre on `frame.left + contentW/2`. Fixes the 1138 title CENTERING.
The grow box / scrollbar parts use the same 3×3 anchor grid (§9.4 modes 1–8).

## 5. OPEN — the frame recipe-walk fixed-vs-stretch rule (the crux)

This is the remaining unknown and the source of every flip-flop:
- **1138**: `p5@47` (8px pinstripe) is the title-bar background and must STRETCH
  to fill the bar; `p1@35` (1px dark frame line) should NOT be the thing that
  stretches across the whole bar.
- **evolution**: `p5@70` (1px black bezel) must stay FIXED (else a dark box
  appears beside the title).
- **1990**: `p8` camo panels FIXED (drawn once), `p1` rods STRETCH.
- **BeOS**: `p1` (65px, uniform) STRETCHES to fill the bottom border.
- **1984**: `p8` button row FIXED (drawn once).

No width rule and no uniformity rule satisfies all of these (we tried). The
part-code table must — but the exact mapping (and how growth is distributed
across the grow segments) has to come from the kDEF's recipe-walk loop, decoded
from `kDEF_0.asm`, NOT guessed. That is the next trace.

### Current provisional state (to be replaced by the real rule)
- Rule B (`e68bb1b`): plate column = the `part-4` text-colour marker x (verified
  = the right column in all 5 themes); deleted the colStats/bezel/median pile.
  GOOD, keep.
- Bracket rule (same commit): non-plate `p5/p6` → fixed. This keeps evolution's
  box away but REGRESSES 1138's bar (fixes the pinstripe `p5`, leaving only the
  dark `p1@35` to stretch). Symptom of not having the real rule — do not treat
  as final.

## 6. Next: decode the recipe-walk in `kDEF_0.asm`
Find the function that loads the `wnd#` side lists and walks each edge's
`(part, border)` entries. Determine: (a) the part-code → fixed/stretch/widget
table, (b) where the cicn source for each segment comes from, (c) how the
window's extra width is distributed across the stretch segments. Cross-check asm
vs `kdef_decomp_nop.c`. The answer must be simple (the litmus).
