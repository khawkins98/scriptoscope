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

## 6. RESULT — the recipe-walk is NOT in `kDEF_0` (`kdef-recipe-walk-decoded.md`)

Decoding `kDEF_0.asm` end to end: **there is no recipe walk and no
`switch(partCode)` in the kDEF.** The kDEF is a WDEF SHIM —
`GetResource('WDEF', -14330)` (`0x9338`) + `jsr %a0@` (`0x9416`) to run that
WDEF for region/draw work; the only fill the kDEF does itself is a cicn-strip
**tile** loop (`0xde84`, stepping the dst by the cicn width). The `'wnd#'` /
`'cicn'` literals never appear — the side list + cicn are passed in by the host.
So **the exact fixed-vs-stretch algorithm lives in the WDEF resource, which is
NOT in our artifacts** and cannot be instruction-decoded here.

## 7. Consequence: no simple corpus-inferred rule fits all five themes

We tried, against the corpus: part-code table, segment width, walk-axis
uniformity, dark-outlier exclusion, and a p5/p6 "bracket=fixed" rule. Each
resolves some cases and breaks others. The unresolvable conflict:
- **1138** title bar must FILL with the light pinstripe as it widens — but the
  pinstripe panels (`p11`/`p5`/`p8`) read as non-uniform (and `p8` carries the
  zoom/shade widgets), so uniformity fixes them and the only thing left to
  stretch is the 1px dark `p1@35` frame line → a dark band.
- **evolution** the 1px `p5@70` bezel must NOT stretch (else a ~28px dark box),
  but it is uniform → uniformity stretches it.
Same codes, opposite required behaviour, and content (uniformity/luminance)
can't separate "the title-bar fill that should grow" from "a uniform frame
line that shouldn't." That separation is exactly what the WDEF encodes and we
don't have.

## 8. Leading hypothesis for a genuinely clean model (verify next)

The kDEF's own fill is a **tile**, and the doc says document windows STRETCH
while utility windows TILE — both 9-slice-shaped (corners fixed, edges
filled). The `cinf` resource carries `cornerSize`, `sideThickness`, `tileSides`,
`patternAnchor` (§13.2). So the real model is plausibly:

> **9-slice from `cinf`:** fixed `cornerSize` corners; the four edges are FILLED
> (stretch, or TILE when `cinf.tileSides`) at `sideThickness`; widgets anchored
> via the rect-list + the §9 anchor grid; the title centred (§9.4). The `wnd#`
> recipe + rect-list are for WIDGET anchoring + hit-testing, NOT per-segment
> frame fixed/stretch.

This is compact (the 68k litmus), uses data we have (cinf), and would naturally
fill 1138's pinstripe (stretch the uniform edge) and repeat 1990/evolution's
decorated borders (tile). **To verify:** decode `cinf` per theme (the loader has
`decoders/cinf.js`; the resource-fork accessor shape needs fixing first) and
check whether decorated themes set `tileSides` and simple ones don't. If so,
rebuild the compositor around 9-slice+cinf and retire the per-segment recipe
walk + all its heuristics.

## 9b. BREAKTHROUGH — we were decoding the WRONG kDEF VERSION

All of §1–§8 (and both sub-agent traces) read the **Kaleidoscope 1.8.2** kDEF.
But our schemes (1138/1984/1990/evolution/beos) are **K2-format** — they ship
`wnd#` recipes + dozens of `cinf` resources, and `wnd#`-driven chrome is a 2.x
feature. Decisive check:

| engine | kDEF size | `'wnd#'` (0x776e6423) refs |
|---|---|---|
| **1.8.2** (`kDEF_0.bin`) | 60,732 B | **0** |
| **2.3.1** (`kDEF231_0.bin`) | 107,726 B | **17** |

So the 1.8.2 kDEF has NO recipe-walk because the recipe model didn't exist yet —
not because "the walk is WDEF-side." The `WDEF -14330` / macOS-ISO hunt was a
red herring (that was 1.8.2's pre-recipe window def). The REAL recipe-walk is in
the **2.3.1 kDEF**, extracted to `/tmp/kaleido-trace/kDEF231_0.bin` +
`kDEF231_0.asm`, with `GetResource('wnd#')` anchors at `0x11918` / `0x1747c`.
Decoding that (in progress) is the actual algorithm our schemes use — supersedes
the inferred rules in §7/§8. (2.3.1 control panel also has 547 resources incl.
its own WDEFs; still no `WDEF -14330` — confirming that ID was never the answer.)

## 9. Code state left (2026-05-22)

- Title centring on `cx` (§9.4) — kept, correct (`fcfbaf6`).
- Plate column = the rect-list marker (Rule B) — kept, correct & simple.
- Removed the p5/p6 "bracket=fixed" over-fit — frame fill is now PLAIN
  uniformity for all non-corner/non-widget segments. Cleaner, but with two
  known cosmetic limitations (1138 dark-ish left bar segment; evolution ~28px
  bezel box) that only the WDEF rule or the §8 9-slice+cinf model can fully
  resolve. Documented here rather than patched with more heuristics.
