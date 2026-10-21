# Kaleidoscope 2.3.1 kDEF — window-frame recipe walk (decoded)

*The deep decode derivation — why the model is what it is. For the lookup rubric, see [`kdef231-reference.md`](./kdef231-reference.md); for the architecture tour, [`kdef-architecture.md`](./kdef-architecture.md).*

Research-only. No repo code changed. This decodes how the **Kaleidoscope
2.3.1** `kDEF 0` (68k WDEF replacement) turns a `wnd#` `(partCode, border)`
side list into a drawn window frame.

> This is the **deep derivation** behind §1/§4/§5 of the standing
> [`kdef231-reference.md`](./kdef231-reference.md). For a quick address / id /
> coordinate lookup, go there first; come here for the full argument.

**This supersedes `kdef-recipe-walk-decoded.md`**, which traced the **1.8.2**
kDEF. 1.8.2 references `'wnd#'` ZERO times and predates the recipe model; its
conclusion ("there is no per-segment recipe walk, span is the only signal") is
**wrong for 2.3.1**. 2.3.1 references `'wnd#'` 17× and DOES walk the side list
per segment, with an explicit **part-code-keyed jump table** that decides
fixed-vs-stretch. The span-only theory is dead.

*Listing-level narrative (registers, frame offsets, instruction excerpts) for this document lives in [`engine/kdef231-recipe-walk.evidence.md`](engine/kdef231-recipe-walk.evidence.md) — spec writers and verifiers only. The originals of Q2 and Q5 are in [`engine/qd-primitives.evidence.md`](engine/qd-primitives.evidence.md).*

Ground truth: the 2.3.1 `kDEF 0` binary (107,726 bytes). All addresses below
are file offsets; every call target below was cross-checked against a headless
decompile (296 functions). Toolchain and listing paths are in the evidence file.

Notation: "the kDEF globals" is the work struct the kDEF builds at init.
Side index `s`: **0=top, 1=bottom, 2=left, 3=right**. A side-list "entry" is
`(partCode:int16, border:int16)` at +0/+2; the array starts at +4 of each
side-list block, and `border[i]` is the cumulative offset along the edge.

---

## TL;DR — the algorithm

1. **Init / resize** (`0x3538`–`0x38c8`): `GetResource('wnd#', id)` loads the
   per-window-type recipe (12 IDs, one per chrome type — `0x356c`–`0x367e`).
   The rect-list + 4 side-lists are copied into the kDEF globals. The
   **SOURCE** side-lists (cicn-relative borders = the minimum-window template)
   and a parallel **DEST** side-list buffer (window-relative borders) are held
   there as separate blocks. Each block is 162 bytes, 4 sides.

2. **Layout precompute** @ `0x4a64`: for each side, walk the
   source side list, classify each segment, find the title anchor, then call
   the distribution routine `0x5178` (twice — once per half, split at the title) to fill the DEST
   border array. This is the **growth-distribution** pass. Runs at init and on
   every resize (`0x3848`–`0x38c0` loops `s=0..3`).

3. **Draw** @ `0x572e`: for each side, for each segment, call
   the placement routine `0x5356` (builds the SRC rect from the SOURCE side-list
   and the DEST rect from the DEST side-list via a 4-way switch on side index), then
   blit:
   - partCode **18** → `0x10320`: **ONE** `CopyBits`/`CopyMask`
     (drawn once, scaled to the dst rect).
   - everything else → `0xfeae`: **TILE** the src cell across
     the dst cell (step dst by src width/height; clip the last partial tile).
     A 1px-wide src tiled N times = a uniform fill. **There is no scaled
     CopyBits in `0xfeae` — "stretch" of small cells is always tiling.**

So the pipeline is: **classify (jump table) → distribute extra width
(`0x5178`) → place (`0x5356`) → tile-or-single-blit (`0xfeae`/`0x10320`).**

---

## Q1. Fixed vs stretch — the exact mechanism (with addresses)

There are **two** stacked decisions. Both key on the **part code**.

### (a) The part-code jump table @ `0x49d6`

The routine takes `(partCode:int16, flag:byte)` and returns a byte (1 = "this part may stretch",
0 = "fixed"). It is a single call to the Mac sparse-switch helper at `0x148`, immediately followed by an inline
sparse switch table (the classic Mac `0x148` switch helper: `word[0]`=default
offset, `word[1]`=lo, `word[2]`=hi, `word[3]`=count-1, then `count` `(case,
relOff)` pairs; offsets are PC-relative to the offset word — see `0x148`–`0x16a`).

Decoded table at `0x49e4` (verified by hand-decoding the bytes). F1–F4 are the
four cinf widget-presence flag bytes in the kDEF globals (see the cheat sheet
below; their exact identities are in the evidence file):

| partCode | target | behaviour |
|---|---|---|
| **default** (1,5,6,8,11,12,13,14,18, …) | `0x4a5e` | returns 0 → **FIXED** |
| 0 | `0x4a12` | returns 1 → **STRETCH** (always) |
| 2 | `0x4a16` | stretch iff the widget field (+112) of the window record / port handle is 0 (widget absent) |
| 3 | `0x4a24` | stretch iff flag F2 is 0 |
| 4 | `0x4a2e` | stretch iff the `0x487e` predicate is false |
| 10 | `0x4a0c` | returns the caller-passed `flag` byte |
| 15 | `0x4a3a` | stretch iff that window-record widget field is nonzero (widget PRESENT — inverse of 2) |
| 16 | `0x4a48` | stretch iff flag F2 is nonzero (inverse of 3) |
| 17 | `0x4a52` | stretch iff the `0x487e` predicate is true (inverse of 4) |

`0x487e` = "is there a usable zoom/grow widget" — true iff F1 and
F3 are set and F4 is clear. So codes 2/3/4 (close/zoom/shade gaps) "stretch" only
when the widget is absent (the gap fills), and 15/16/17 (the widget cells)
stretch only when present. These are the named-widget cells, gated on cinf
window-state flags, not on geometry.

### (b) The fill classifier inside the distribution routine @ `0x5178`

The big-fill codes are decided directly by explicit part-code comparison chains in `0x5178`
(NOT via the table). The width-assignment second loop (`0x5260`–`0x534a`):

- **partCode 12** (`0x5266`) → **TILE** count: `dstWidth = floor(slack/numStretch
  / srcWidth) * srcWidth` (`0x5284`–`0x5292`) — a whole number of source widths.
- **partCode 8, 11, 18** (`0x529e`–`0x52ae`) → **STRETCH (grow)**: gets a share
  of the available stretch budget `share = remainder/stretchCount + slack/numStretch`
  (`0x52ba`–`0x52d6`), where `stretchCount` = count of stretch cells (pre-pass
  `0x51e8`–`0x523e`), `remainder` = remainder bucket.
- **partCode 13, 14** (`0x52da`–`0x52e4`) → **STRETCH** with a smaller share
  (`remainder/stretchCount`, no `slack/numStretch` term — `0x52e6`–`0x52f8`).
- **everything else** (`0x52fc`+) → classify via the `0x49d6` table with `(pc, flag)`:
  - if it returns nonzero → leave width 0 (this cell is a stretch participant;
    its real width comes from the budget) — branch at `0x5306`/`0x530a` to `0x532e`.
  - else (fixed) and (`flag` is nonzero OR pc not in {5,6}) → **FIXED**:
    `dstWidth = srcWidth` (`0x531e`–`0x532a`).
  - else (pc in {5,6} AND flag==0) → width 0 / collapse (`0x5312`–`0x531c`).

The `flag` byte (the routine's flag argument) is NOT a constant. In the title-anchor path the two
`0x5178` calls (`0x5100`, `0x5120`) pass the **title-fits** byte
set at `0x4e20`/`0x4f5e` (cleared when the window is too narrow for the title).
The no-title-anchor calls pass 1 (`0x4db4`/`0x4dd4`, `0x515e`) and the
no-stretch fallback passes 0 (`0x5148`). So **codes 5/6 (the bezel beside
the title) are FIXED when the title fits, and collapse to width 0 when the title
does not fit** — they never grow. This is the precise gate, not "always fixed".

**This is the answer to "is it a switch or a width test": it is a switch on the
part code (jump table `0x49d6` + explicit comparison chains in `0x5178`), NOT a
width/threshold test and NOT a per-rect flag.** Geometry/span only matters
through `srcWidth` for the FIXED cells.

---

## Q2. Source region per segment

The placement routine @ `0x5356` builds, per `(side, segIdx)`:

- **SRC rect** from the SOURCE side-list (indexed
  by `side*162` then `segIdx*4` — `0x53b8`, `0x53c8`, etc.). The src x-range of
  segment `segIdx` is **`[srcBorder[segIdx-1], srcBorder[segIdx])`** — it reads
  `SRC.left = border[segIdx-1]` (`0x53be`, index `segIdx-1`) and `SRC.right =
  border[segIdx]` (`0x53ce`, index `segIdx`), and the draw loop (`0x5970`) pairs
  that span with **`part[segIdx]`** (the part code of entry `segIdx`). So the part code
  travels with the border that ENDS the cell — segment i is `[border[i-1],
  border[i])` tagged `part[i]` (END-BASED). (An earlier draft of this line also
  wrote "its own `[border[i],border[i+1])`", which is the START-based reading and
  is WRONG — the compositor shipped that off-by-one until it was corrected; see
  `recipeCells` in `composeChrome.ts`.)
- **DST rect** from the DEST side-list (
  `0x53d4`, `0x53e0`) — the window-relative borders computed by `0x5178`.

The cross-axis (the edge's other coordinate) comes from the cicn rect
(the structure-rect handle arguments, `0x5390`–`0x53a6`). So a
segment copies from **its own cicn x-band, full edge height**, NOT from a 1px
column and NOT from a shared rect-list rect (the rect-list is used only for the
named-widget hit/draw rects, via the placement routine's argument plumbing). The 1px
behaviour emerges only because many template cells are authored 1px wide.

---

## Q3. Growth distribution

Computed entirely in the distribution routine @ `0x5178`:

- The **stretch budget** is `slack = (srcBorder[end] - srcBorder[start-1]) -
  reqWidth` (`0x518a`–`0x519c`), where `reqWidth` (an argument) is the sum of the
  FIXED cells' widths, passed in from `0x4a64`. So
  budget = total dst extent of the half − fixed widths.
- `numStretch` (an argument) = number of stretch cells in this half.
- Each stretch cell gets `slack/numStretch` (signed divide at `0x51b8`), with the
  division remainder distributed one-pixel-at-a-time through the running
  `remainder`/`stretchCount` buckets (`0x52ba`–`0x52d6`). So distribution is **even across
  the stretch cells, remainder spread left-to-right** — NOT proportional to
  source width (except code 12, which is forced to a whole multiple of its
  src width so a tiled motif lands on a tile boundary).
- **Symmetry about the title:** `0x4a64` finds the title anchor cell (index `t`),
  splits the side into `[1 .. t-1]` and `[t+1 .. count]`, and calls `0x5178`
  **twice** (`0x511a`, `0x5138`) — once per half. Each half distributes its own
  budget independently, so growth is symmetric around the centered title.
- Only the cells the classifier marks as stretch (codes 0/2/3/4/8/10/11/12/13/14/
  15/16/17/18 subject to their gates) grow. Fixed cells (1,5,6 in standard mode,
  plus any gated-off widget) keep their template width.

---

## Q4. Named widgets and title text placement

- **Title text:** `0x4a64` sets the title face with `TextFace` (`$A888` @ `0x4f18`/
  `0x4f20`; one of two face values chosen at `0x4f12`), measures it with `StringWidth`
  (`$A88C` @ `0x4f28`) and font ascent/descent, computes the title region center as
  `((leftBound + rightBound)/2)` (the halving at `0x4ff8`/
  `0x501c` is a signed `/2` with rounding), then reserves the title's measured
  width centered there, pinning the two `0x5178` halves to its left/right edges
  (`0x4fa8`–`0x50fa`). If the window is too narrow for the full title the title
  cell collapses (`0x4f58` guard, a comparison against 2; listing detail in evidence).
- **Widgets (close/zoom/shade):** these are part codes 2/3/4 (gaps) and 15/16/17
  (the widget cells) plus rect-list rects. Their presence is gated by the cinf
  flags in `0x49d6`/`0x487e` (Q1a). When present they are FIXED
  width and anchored to the edge ends; the adjacent gap cell (2/3/4) is the one
  that stretches to absorb slack, so the widget stays glued to its corner while
  the bar between widget and title grows.
- The 4-way switch on side in `0x5356` (`0x5376`–`0x538a`) is the per-side
  axis remap (top/bottom use x as the run axis, left/right use y), which is the
  "anchor" step — there is no separate 3×3 anchor function; the 4-way side
  switch plus the title-center math is the whole placement model.

---

## Q5. Tile vs stretch

- **`0xfeae`** (the default blit, called from `0x59e8`):
  ALWAYS TILES, one source-sized CopyBits/CopyMask tile at a time. Steps are
  `0x10146`–`0x10176` in the forward branch and `0x10236`–`0x10262` in the
  reverse branch. Each step moves by the source width or height (axis test
  `srcH == dstH`). The final partial tile is clamped at `0x100a4`/`0x100d4`
  (forward, far end) or at `0x101a2`/`0x101d4` (reverse, near end). Special fast paths: a 1px-wide *src* (dst wider) draws each
  source row as a line across the dst (`0xff3e`–`0xffb6`); a 1px-tall src (dst
  taller) draws each source column as a line down the dst (`0xffba`–`0x10018`).
  The caller passes a direction byte: 0 for codes 11 and 14, 1 otherwise
  (`0x59c8`–`0x59da`; the blit reads it at `0x10074`). **Corrected 2026-10-21:** it
  selects the anchor end, not the axis. 1 tiles forward from the dst
  top-left. 0 (codes 11/14) tiles backward from the dst bottom-right, so the
  partial tile falls at the near end. The axis is `srcH == dstH`
  (`0x10146`/`0x10236`), which with `0x5356`'s fixed cross axis is always the
  side's run axis. The 1px fast paths trigger on a 1px *source* along the run.
  Full trace: [kdef231-reference.md §5.1](kdef231-reference.md).
- **`0x10320`** (the partCode-18 blit, called from `0x59ba`):
  a **single** `CopyBits` (`0x103ea`) or `CopyMask` (`0x10402`) — drawn ONCE,
  mapped src-rect → dst-rect (so it scales if the dst grew).

So: codes that tile use `0xfeae` (stepping by the cicn cell size). Code 18 uses
`0x10320` (one blit). Code 12 is forced (in `0x5178`) to a whole multiple of its
src width so that `0xfeae`'s tiling lands cleanly.

---

## Validation against the corpus — honest results

I re-implemented `0x5178` faithfully and ran the corpus `edges.top` data.
Source: `themes/<slug>/theme.json` `windowTypes["document-window"].edges.top`.

| slug | the FILLING element | kDEF code | classifier result | matches reference? |
|---|---|---|---|---|
| **1138** | `part-8` (46px) | 8 | STRETCH (grow) | **YES** |
| **1990** | `part-8` panels | 8 | STRETCH | partial (see below) |
| **1984** | `part-8` button row | 8 | STRETCH | partial |
| **evolution** | `part-18` links | 18 | STRETCH (grow) | **NO** (see below) |
| **beos** | `part-1` bottom (65px) | 1 | FIXED | depends on mapping |

### What is solidly confirmed (instruction-decoded)

- **1138's pinstripe fills via part code 8.** In 1138 the middle fill is
  `part-8` (`at 56→102`, 46px), with `part-5` a fixed 8px bezel and `part-6`
  the 1px edges. Code 8 is in `0x5178`'s explicit STRETCH set → it grows to fill
  the widening title bar. Codes 5/6 are default→FIXED in `0x49d6`, and `0x5178`'s
  5/6 special case keeps them fixed whenever the title fits (title-fits gate,
  pushed at `0x5100`/`0x5120`), collapsing them to 0 only when the window is too
  narrow for the title. They never grow. **This is exactly the "p8 fills, p5/p6
  stay fixed" behaviour the reference shows, resolved purely from the part code +
  jump table.** The crux the brief asks about is answered: 1138's fill is
  **part 8, not part 5**; part 5 stays fixed (and only ever collapses, never
  grows).

- **The decision is the part code, full stop.** No width threshold, no per-rect
  flag, no span heuristic. 1px vs wide is irrelevant to the classifier; it only
  affects `srcWidth` for cells already classed FIXED.

### The honest discrepancy: evolution `part-18`

The brief states evolution's "metallic p18 links are drawn ONCE; 1px p1 rods
stretch." **The 2.3.1 binary does the opposite of that description:**

- Code **18 is a STRETCH cell** in `0x5178` (it is in `{8,11,18}`), so the p18
  links each get a *dst width that grows* (my sim: 4px src → ~23–50px dst as the window
  widens). And `0x10320` draws p18 with a **single** CopyBits to that grown dst
  rect → the gradient would be **scaled**, not repeated.
- Code **1 is default → FIXED**, so the 1px p1 rods stay 1px — they do NOT
  stretch.

This means one of the following is true, and I cannot pin which from the kDEF
binary alone:
1. The reference image's "links drawn once" is actually the kDEF **scaling** a
   gradient cell (`0x10320` single CopyBits) — which at small zoom looks like
   "drawn once" but is really a stretch; the visible repetition of links would
   then come from the *cicn artwork itself* containing multiple links in one
   wide code-18 cell, not from per-link cells. The theme.json decoder split that
   one wide cell into many small p18 cells, which the kDEF would never have
   produced.
2. The theme.json `part-N` numbering does **not** equal the kDEF's internal
   `partCode N`. If the decoder remapped codes, the corpus "p18"/"p1" labels are
   not the engine's 18/1 and the table lookups above don't apply to them
   directly. (Code 8 lining up perfectly across 1138/1990/1984 argues the
   mapping is at least mostly identity, but evolution breaks it.)

Either way: **the engine keys fixed-vs-stretch on the part code via the
`0x49d6` table + `0x5178` chains. The unresolved question is whether the
corpus's per-link p18 cells reflect how the kDEF actually authored that scheme.**
This should be re-checked by extracting the live 2.3.1 `wnd#` for evolution and
comparing its raw `(partCode, border)` list to `theme.json` before trusting the
p18 expectation.

### beos / 1990 / 1984 notes

- **beos bottom** `part-1` is 65px in the template and FIXED per the table. The
  reference "fills" because the template is already ~window-width; if the window
  is wider, a FIXED part-1 would NOT grow — so if beos visibly fills a wider
  window, beos's bottom fill must actually be a stretch code (8/11/18) in the
  real `wnd#`, again implying a decoder code-mapping question.
- **1990 / 1984** wide `part-8` panels: code 8 STRETCHES per the table, yet the
  reference says they're "drawn once." Per `0x5178`, a single wide code-8 cell
  grows and `0xfeae` TILES it — a wide src tiled across a slightly-wider dst is
  ~one copy plus a sliver, which reads as "drawn once." So these are consistent
  with tiling a wide cell, not with a separate "draw once" rule.

---

## Function map (all addresses are file offsets)

| addr | role |
|---|---|
| `0x148` | Mac sparse-switch helper (table format above) |
| `0x356c`–`0x367e` | `GetResource('wnd#', id&mask)` ×12 — load per-type recipes |
| `0x3680`–`0x38c8` | copy rect-list + side-lists into the kDEF globals; loop `s=0..3` calling `0x4a64` |
| `0x4778` | compute window structure/content rect (`FrameRect` source) |
| `0x487e` | "zoom/grow widget usable?" cinf predicate (feeds `0x49d6` cases 4/17) |
| `0x49d6` | **part-code jump table**: stretch-vs-fixed for codes 0/2/3/4/10/15/16/17 |
| `0x4a64` | **layout precompute** per side: classify, find title anchor, call `0x5178` ×2 |
| `0x5178` | **growth distribution**: fill DEST borders; fill classifier for 8/11/12/13/14/18 + 5/6 special case |
| `0x5356` | **placement**: build SRC rect (SOURCE side-list) + DST rect (DEST side-list); 4-way side switch |
| `0x572e` | **main draw loop**: per side, per segment → `0x5356` then blit |
| `0x6582` | fetch the cicn template rect for side `s` (indexed into the rect-list) |
| `0xfeae` | **TILE blit**: step dst by src size, clip last tile (CopyBits/CopyMask) |
| `0x10320` | **single blit** for partCode 18 (one CopyBits/CopyMask) |

### Globals (a4-relative) cheat sheet

The kDEF globals hold (offsets in the evidence file):

| item | meaning |
|---|---|
| rect-list | rect-list count + base |
| DEST side-lists | window-relative borders, 4×162 bytes |
| SOURCE side-lists | cicn template borders, 4×162 bytes |
| window record / port handle | carries the widget field read by codes 2/15 |
| F1–F4 | cinf widget-presence flags (close/zoom/shade) |
| RTL/flip flag | feeds StringWidth direction |
| window cicn handle | the artwork blitted |

---

## What I could NOT pin to the instruction (flagged honestly)

- The exact identity between theme.json `part-N` and the kDEF's runtime
  `partCode` (the evolution/beos discrepancies above hinge on this). Needs a
  raw `wnd#` dump from the live 2.3.1 resource fork to settle.
- The precise contents of the cinf widget-presence flag bytes F1–F4
  (decoded as widget-presence by behaviour, not by a documented struct).
- Whether `0x10320`'s single CopyBits scales or 1:1-copies in practice depends
  on whether `0x5178` grew that p18 dst — decoded as "grows", but see the
  evolution caveat.
