# qd-primitives — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Listing-level source for
> [`qd-primitives.md`](qd-primitives.md), copied verbatim on 2026-10-21 (v2 lane
> L2) from v2 commit `1183816e`. The originating sections stay in place in
> `kdef231-reference.md` and `kdef231-recipe-walk.md` until those documents are
> split (L2 doc-split PR); this copy is the frozen text the behavioural spec was
> derived from. Nothing was re-decoded during the move.
>
> The 2026-10-22 revision (appended at the end) re-read every row and adds
> the trace for the new rows; the frozen copies below are kept unchanged.
>
> Listing used by the source sections: `.scratch/k231-kdef/kDEF/k231-kdef0.asm`
> (root checkout only, gitignored) and `/tmp/kaleido-trace/kDEF231_0.asm`;
> resource SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.

## Verifier marks

Independent Tier-1 verifier, 2026-10-22, PR #392 head `43a7d24c` (listing:
root checkout raw `k231-kdef0.asm`, read only; Traps.h pinned; IWQD page
footers checked). The non-blocking precisions in the notes column were applied
in the follow-up commit.

| spec row(s) | addresses re-traced | mark | note |
|---|---|---|---|
| T0, T1, T2, T3–T7 | `0xfec2..0xff2a`, `0xff3e..0x10018`, `0x10036..0x10262` | CONFIRMED | T1 loop also stops at `srcRect.bottom` (implicit in the row) |
| T8 | `0x100a0..0x100f6`, `0x1019e..0x101fa`, `0x10146` | CONFIRMED | |
| X1, X2 | `0x1010e..0x10144`, `0x101fe..0x10234` | CONFIRMED | `thePort+92` is `picSave` in both port layouts; `grafProcs` is +104. First-split "custom bottlenecks" was a misread |
| X3, X4 | `0x10046..0x1006a` | CONFIRMED | |
| L1, L2 | `0xff6c..0xff96`, `0xffd4..0xfffa`, `0xfa8a..0xfae8` | CONFIRMED | "nonzero" = mask bit `7 − (h & 7)` of mask row `v` |
| L3 | `0x108ee`; IWQD p. 3-18 | CONFIRMED (Apple-documented label correct) | |
| Q3 equivalence paragraph | as above + `0xf9f6`, `0x10702` | CONFIRMED with precision | holds when the cross extents are equal (every decoded caller); add that condition |
| W1–W3 | `0x59a8..0x59e8` | CONFIRMED | |
| W4 | `0x5938..0x59f8` | CONFIRMED with precision | loop also calls the title-text routine `0x5530` after the title side (`0x59fc..0x5a02`): text, not a chrome cell |
| SC1–SC4 | `0x10350..0x10414` | CONFIRMED | both branches masked |
| scaling = modern policy | IWQD pp. 3-113, 3-114, 3-119 | CONFIRMED (label correct) | |
| corner forms | `0x10282..0x102ce`, `0x102d0..0x1031e` | CONFIRMED | |
| I1–I3 (and scrollbar AC5) | `0xfe44..0xfe90`; caller `0xc736..0xc746` | CONFIRMED | `cmpiw #1, pixelSize (+32)` → CopyMask(srcRect as maskRect); else CopyBits srcCopy, NIL mask. I1 opaque even for a 1-bit pixmap |
| colour setup §3 | `0xf378`, `0xf30a`, save/restore sites | CONFIRMED | IWQD p. 3-117 |
| S1–S6 | `0xfa8a..0xfc5a`, `0xfc5c..0xfdf6`, `0x10702..0x10766` | CONFIRMED | no bounds compare anywhere; "table size" in S2 = ctSize (entries − 1) |
| R1, R2 | `0xf68c..0xf718`; caller `0xc6e4..0xc730` | CONFIRMED | no MapRgn: 1:1 |
| F1 | `0xf930..0xf9ec`, `0xf87e..0xf926` | CONFIRMED | |
| F2–F4 | `0xf7cc..0xf87c`, `0xf71a..` | CONFIRMED | |
| Q7 phase sign | F1 + IWQD p. 3-6 | CONFIRMED (Apple-documented label correct) | p. 2-32 paraphrase omits Apple's "upper-left corner of the port rectangle" wording; 3-6 is the controlling text |
| P1–P5 | `0x10aae..0x10af6`, push order `0x10b14..0x10b22` | CONFIRMED | |
| B0–B6, body inset rects | `0x108fc..0x10bbe` | CONFIRMED | |
| §3 cinf requests (Q8), sampled colours | `0x10814..0x1089c`, `0x116f8..0x11722`, `0x108fc..0x10998` | CONFIRMED | in cache mode the cicn is not disposed on the cinf-NULL path (`0x10fa8`) |
| E1, E3–E6 | `0x10bc0..0x10f82` | CONFIRMED | |
| E2 "overlap … the corners"; §5 "`s > c`" consequence | `0x10cc4..0x10d34`, `0x10e9a..0x10f82` | **REFUTED** at `43a7d24c`; corrected at `61a42452` and **CONFIRMED** in verifier round 2 (bands never cover corners; `(s − c) × (s − c)` overlap squares next to each corner, left/right win) |
| §5 border rect table | `0x10c0c..0x10f82` | CONFIRMED | |
| T-B inset reconciliation | `0x109ea..0x10a00` vs `0x10a28..0x10a34` | CONFIRMED | |
| lowDepth §2 | `0xf2d6..0xf308`, `0xf488..0xf4b8` | CONFIRMED | |
| census figures §6 | `cinf-geometry-census.out.txt` | CONFIRMED (counts match output) | |

## From `kdef231-reference.md`: 1.5 Blit primitives

````text
### 1.5 Blit primitives + 9-slice

| addr | name | purpose | args | callees |
|---|---|---|---|---|
| `0x0feae` | **TILE blit** (default) | tile src across dst along ONE axis, chosen by `srcH == dstH` (`0x10146`, `0x10236`); dir byte selects the anchor end (§5.1). 1px-along-run fast paths `0xff3e`, `0xffba` | `fp@(8)`=cicn (→`d4`, `a4@(1934)`), `fp@(12)`=src rect (`a3`), `fp@(16)`=dst rect (`a2`), `fp@(20)`=dir byte (`(pc==11\|\|pc==14)?0:1`, caller `0x59c8`), `fp@(22)`=long from caller `d6` (alternate source pixmap, `0x1005c`) | `$A8EC` CopyBits / `$A817` CopyMask, `0x1027a` (skip if degenerate) |
| `0x10320` | **single scaled blit** (code 18) | ONE CopyBits (`0x103ea` `$A8EC`) or CopyMask (`0x10402` `$A817`), mapped src→dst (scales if dst grew) | `fp@(8)`=cicn (`a2`), `fp@(12)`=src rect (`d6`), `fp@(16)`=dst rect (`a3`) | `$A8EC`/`$A817`, RGBForeColor `0xf30a` |
| `0x102d0` | **corner 1:1 copy** | translate src rect by (dst−src) offset, then `0x10320` → places a corner at 1:1 size | `fp@(8)`=cicn, `fp@(12)`=src (`a2`), `fp@(16/18)`=dst origin | `0x10320` |
| `0x107fe` | **cinf body + border engine** | load cicn + cinf, optionally fill body, then paint square corners and independently thick masked edge bands | `fp@(8)`=id (`d4`), `fp@(10)`=dst rect (`a2`), `fp@(14)`=text RGB output, `fp@(18)`=emboss RGB output, `fp@(22)`=body-fill flag | `0x116f8` (cinf), `0x10472`/`0xed70` (cicn), `0xfc5c` (GetPixel — sample px → RGB; see §1.4), `0xf930`, `0xfdf8` |
| `0x108a0` | (inside `0x107fe`) | reads cinf corner size and side thickness: `d3`=byte[0] (`a3@`), `d4`=byte[1] (`a3@(1)`); style switch on cinf byte[3] (`a0@(3)`, `cmpib #5` + `subq #1` chain) | cinf `a3@`: `[0]`=square corner size, `[1]`=independent side thickness, `[3]`=pattern anchor/mode | — |
| `0x10fc0` | face wrapper (controls) | pushes body-fill true, forwards `fp@(8..18)` to `0x107fe` | `fp@(8)`=id, `fp@(10)`=dst rect, `fp@(14/18)`=text/emboss RGB outputs | `0x107fe` |
| `0x10fe0` | 9-slice wrapper (window regions) | sibling: loads cicn (`0x10472`) + cinf (`0x116f8`) itself, then slices | `fp@(8)`=id (`a3`), `fp@(10)`=rect (`a2`), `fp@(14)`=`d4`, `fp@(18)`=alt flag | `0x10472`, `0x116f8` |
````

## From `kdef231-reference.md`: 3.6 Rect layout

````text
### 3.6 Rect layout

Mac `Rect` = 4× int16 in order **`{top, left, bottom, right}`** at `+0/+2/+4/+6`.
`0x0feae`/`0x10320` read `rect@(0)`=top, `@(2)`=left, `@(4)`=bottom, `@(6)`=right
(e.g. `0xfec2` `movew %a2@(6)` = right, compared to `@(2)` = left). Dest rects
flow in as `fp@(16)` (dst) / `fp@(12)` (src) pointers; the 9-slice computes the
four corner sub-rects by adding/subtracting `d3`/`d4` (the cinf insets) to the
outer rect (`0x10a28`-`0x10a34`: `addw d3,@(-14)` left+=X, `addw d4,@(-16)` top+=Y,
`subw d3,@(-10)` right-=X, `subw d4,@(-12)` bottom-=Y).
````

## From `kdef231-reference.md`: 5. Blit primitives

````text
## 5. Blit primitives (arg conventions)

| primitive | addr | call form | semantics |
|---|---|---|---|
| TILE | `0x0feae` | `feae(cicn, srcRect*, dstRect*, dirByte, pixmap)` (`fp@8/12/16/20/22`) | tile along the side's run axis, one src-sized CopyBits/CopyMask per step. `dir` = anchor end, NOT axis: 1 = forward from dst top-left, 0 = reverse from dst bottom-right (`(pc==11\|\|pc==14)?0:1`). See §5.1. **Always tiles; never scales.** |
| SCALE | `0x10320` | `f10320(cicn, srcRect*, dstRect*)` (`fp@8/12/16`) | ONE CopyBits (`$A8EC`)/CopyMask (`$A817`) src→dst → scales if dst grew. Used for partCode 18 (`0x59ba`) and named-widget rects (`0x6062`). |
| CORNER 1:1 | `0x102d0` | `(cicn, srcRect*, dstX, dstY)` | shift src by dst−src, call `0x10320` → 1:1 placement |
| BODY + BORDER | `0x107fe` | `(id, dstRect*, textRGB*, embossRGB*, bodyFill)` | square corners from byte[0], independent side bands from byte[1], optional body; see [solid face geometry](control-face-geometry.md) |
| FACE wrap (control) | `0x10fc0` | `(id, …)` pushes bodyFill=true → `0x107fe` | push face (`0x7594`) and bevel (`0x7778`); ring uses false via `0x107de` |
| 9-SLICE wrap (window) | `0x10fe0` | `(id, rect, d4, altFlag)` | loads cicn+cinf itself, then slices |
| RING blit | `0x107a4` | `(id, dstRect*, flag)` | the default-button ring 9-slice (its own wrapper over the slice engine) |
````

## From `kdef231-reference.md`: 5.1 `0xfeae`

````text
### 5.1 `0xfeae` tile blit: argument frame, axis and direction byte (traced 2026-10-21)

Traced from the local `m68k-elf-objdump` listing of kDEF 0
(`.scratch/k231-kdef/kDEF/k231-kdef0.asm`, sha256 of the resource in
[kdef-binary-inventory.md](kdef-binary-inventory.md)). Static reading only;
no original code was executed. Earlier rows in §1.5 and §5 put the direction
byte at `fp@(8)` and called it a horizontal/vertical selector. Both were wrong.

**Caller frame (`0x59c6..0x59ee`).** The caller pushes, in order: `d6` (long),
the direction byte (`moveb` to a word slot), `&fp@(-8)`, `&fp@(-16)` and
`a4@(1934)`. It pops 18 bytes. So inside `0xfeae`: `fp@(8)` = `a4@(1934)`
(`d4`, the chrome cicn), `fp@(12)` = src rect (`a3`), `fp@(16)` = dst rect
(`a2`), `fp@(20)` = direction byte, `fp@(22)` = the `d6` long. The src/dst
roles match `0x5356`, which writes the src rect through `sp@(32)` from the
template borders `a4@(2788)` and the dst rect through `sp@(36)` from the
placed borders `a4@(2140)`. The 18-byte pop matches 4+4+4+2+4.

**`0x5356` fixes the cross axis.** On sides 0 and 1 (top, bottom) it sets
dst height = src height (`0x539c..0x53a6`, `0x5404..0x540c`). On sides 2 and 3
(left, right) it sets dst width = src width (`0x5470..0x547c`,
`0x54da..0x54e6`). The run-axis bounds come from the border lists. A placed
cell therefore differs from its source only along the run.

**Fast paths (direction-independent).** These run before `fp@(20)` is read:

- `0xff3e..0xffb6`: src width 1 and dst width > 1. For each source row
  (rows map 1:1), sample the pixel (`0xf9f6`), then MoveTo/LineTo across the
  dst width.
- `0xffba..0x10018`: src height 1 and dst height > 1. The same, one source
  column per dst column.

Because of `0x5356`, these fire only for a source that is 1 px along the run.

**General path.** `d5` = src width and `d3` = src height (`0x10036..0x10042`).
`tstb fp@(20)` at `0x10074` chooses the branch:

| byte | code | first tile | partial-tile clip | step (`0x10146` / `0x10236`) | loop exit |
|---|---|---|---|---|---|
| 1 | all non-18 except 11/14 | at dst top-left (`0x10088..0x10098`) | far end: trims src right/bottom, keeps the leading src columns/rows (`0x100a0..0x100f6`) | `srcH != dstH` → `top,bottom += srcH`; else `left,right += srcW` | `left >= dst.right` or `top >= dst.bottom` (`0x10162..0x10176`) |
| 0 | 11, 14 | at dst bottom-right (`0x1018a..0x1019a`) | near end: trims src left/top, keeps the trailing src columns/rows (`0x1019e..0x101fa`) | same test, but subtracts | `right <= dst.left` or `bottom <= dst.top` (`0x10252..0x10262`) |

Each step does one blit of the clipped tile. When the port's `grafProcs`
(`port+92`) is non-nil, that blit is CopyBits (`$A8EC`) srcCopy with no mask.
That copy is opaque: transparent source pixels overwrite what is underneath.
Otherwise it is CopyMask (`$A817`) (`0x1010e`/`0x101fe`). Only the forward
branch first culls a tile against the bbox of `thePort`'s clipRgn
(`0x100fa..0x1010c`; bbox read at `0xff06..0xff12`). The listing shows only
the cull. That the cull changes no pixels is an inference from Toolbox
clipping semantics.

**Answer to "what does the byte select".** It selects the tile anchor and copy
order. It does not select the tiling axis. The axis comes from `srcH == dstH`.
With `0x5356` fixing the cross axis, horizontal sides always step horizontally.
Vertical sides step vertically. The one exception is a run exactly `srcH` long,
where both branches draw one identical full copy. So:

- **Code 8 on a vertical side** (and every other non-18 tile cell, codes 8, 12,
  13 and the default/fixed classes, on any side) tiles along the run from the
  top (or left). Source offset 0 is at the dst start, and the final partial
  tile keeps the source's leading pixels.
- **Codes 11 and 14 on any side** tile along the run from the far end, right
  on top/bottom and bottom on left/right. Source offset `srcLen-1` is at the
  last dst pixel. The partial tile at the near end shows the source's trailing
  pixels. A remainder cell shorter than its source shows its last `dstLen`
  pixels.

As a formula, dst index `k ∈ [0, dw)` of a cell with source length `sw` reads
source offset `k % sw` forward and `sw - 1 - ((dw - 1 - k) % sw)` reversed.
The two coincide when `dw` is a multiple of `sw`.

A structural consequence (not original-engine evidence): forward cells keep the
template adjacency `s0-1 | s0` at their near boundary. 11/14 cells keep
`s1-1 | s1` at their far boundary instead.

For a 1 px run, both branches are direction-independent (every tile is the
same source pixel), and so are the fast paths. The fast paths draw with
RGBForeColor and LineTo, and only where `0xf9f6` returns nonzero. Whether
their pixels are identical to the general path's CopyMask is not shown. The
PR #367 1px-only check could therefore not tell the two readings apart.

**A second consumer of the same byte.** `0x6390` also walks the side lists and
passes `(pc==11||pc==14)?0:1` to `0x11452` (`0x651c..0x653c`). That routine
and what it draws are not traced here.

**Corpus scope** (13 wnd# archives, every sliced type, sampled at template
+97 × +33 with the runtime cell placement, cell index 0 skipped). Script and
output are in the private store `campaign-20261021/lanes/H/`. Counts are
**per state**, so each cell is counted once for active and once for inactive.

- Code 11: 38 horizontal rows, all 1 px (direction-neutral). 6 vertical rows,
  4 with varying >1 px sources: animals `side-floating-utility-window` right
  (15 px) and `collapsed-no-title-utility` left (3 px), that is 2 cells.
- Code 14: 6 horizontal rows, 4 varying: animals `document-window` and
  `collapsed-document-window` bottom (6 px), 2 cells. 6 vertical rows, 2
  varying: monkey-paradise `document-window` right (4 px), 1 cell.
- Code 13: 28 horizontal rows, 6 varying and phase-sensitive (animals). They
  are forward under the trace and the runtime alike, so they are not a
  divergence.
- Code 8: 678 horizontal and 512 vertical rows. 205 and 140 of them have a
  varying >1 px source and need the forward anchor.

So five cells (× 2 states) are where the byte is visible.

**Runtime and checker (2026-10-21).** `drawTile` in `src/composeChrome.ts`
now takes the anchor from the part code: 11/14 tile from the far end, and
every other tile cell from the start. There is no per-theme branch.
`tests/rendering-options/window-chrome-rules.mjs` asserts the formula above
for every non-18 cell, unknown-class cells included, over the runtime-placed
width. It counts 1 px, whole-copy, forward >1 px and reverse >1 px pixels
separately, and checks opaque source pixels only. Opaque CopyBits and the
CopyMask-over-earlier-sides order are not modelled. Nonzero forward/reverse
counts do not show that an archive exercises the anchor, because a uniform
source passes under any anchor. A per-archive mutation table makes it
explicit:

- The flip 11/14 mutation (the pre-fix runtime) fails only animals and
  monkey-paradise.
- Inverted-anchor and scaled blits fail 1990, animals, crayon-os,
  dolphin-som, evolution, floppies and monkey-paradise.
- 1138, 1984, apple-lisa, beos-r503, windows-31 and windows-95 pass all three
  mutations, so they do not discriminate.

This is a source-rule check against the runtime, not native capture
evidence.

**Code-10 corollary (Q2, partial, corrected after review).** The widget draw
is `0x632e` → `0x6062`, not `0x5ffc`. `0x5ffc` → `0x5ddc` is a point hit-test
and draws nothing. `0x6062` is not independent of the side lists:

- Its dst rect is the rect-list (`a4@(1938)`) entry rect in template
  coordinates, remapped by `0x5cb6`. `0x5cb6` walks every side's cells through
  `0x5356` and offsets each corner by its containing cell's placed − template
  delta, so it depends on the `0x5178` widths.
- In the state-0 path it blits the chrome template `a4@(1934)` itself (src =
  raw entry rect), not a widget cicn.

What a code-10 collapse would do to widget placement or art is therefore not
established. This corollary must not be used to justify collapsing code 10.

Still open:

- Which callers of `0x632e` draw close (part 4) and collapse (part 9) on a full
  frame draw. Inside `0x572e`, only part 5 is drawn (`0x5a28..0x5a3c`).
- The meaning of flags `a4@(502/503/506/507/508)` and of the state byte.
- `0x5cb6`'s behaviour when a corner falls in a cell placed at width 0.
- How the rect-list rects are derived.
````

## From `kdef231-recipe-walk.md`: Q2. Source region

````text
## Q2. Source region per segment

`FUN_00005356` @ `0x5356` builds, per `(side, segIdx)`:

- **SRC rect** from the SOURCE side-list at `a4@(2788)` (`lea a4@(2788)`, indexed
  by `side*162` then `segIdx*4` — `0x53b8`, `0x53c8`, etc.). The src x-range of
  segment `segIdx` is **`[srcBorder[segIdx-1], srcBorder[segIdx])`** — it reads
  `SRC.left = border[segIdx-1]` (`0x53be`, index `segIdx-1`) and `SRC.right =
  border[segIdx]` (`0x53ce`, index `segIdx`), and the draw loop (`0x5970`) pairs
  that span with **`part[segIdx]`** (`d3 = entry[segIdx].part`). So the part code
  travels with the border that ENDS the cell — segment i is `[border[i-1],
  border[i])` tagged `part[i]` (END-BASED). (An earlier draft of this line also
  wrote "its own `[border[i],border[i+1])`", which is the START-based reading and
  is WRONG — the compositor shipped that off-by-one until it was corrected; see
  `recipeCells` in `composeChrome.ts`.)
- **DST rect** from the DEST side-list at `a4@(2140)` (`lea a4@(2140)`,
  `0x53d4`, `0x53e0`) — the window-relative borders computed by `0x5178`.

The cross-axis (the edge's other coordinate) comes from the cicn rect
(`param_5`/`param_6` = the structure-rect handle, `0x5390`–`0x53a6`). So a
segment copies from **its own cicn x-band, full edge height**, NOT from a 1px
column and NOT from a shared rect-list rect (the rect-list is used only for the
named-widget hit/draw rects, via `FUN_00005356`'s param plumbing). The 1px
behaviour emerges only because many template cells are authored 1px wide.
````

## From `kdef231-recipe-walk.md`: Q5. Tile vs stretch

````text
## Q5. Tile vs stretch

- **`FUN_0000feae` @ `0xfeae`** (the default blit, called from `0x59e8`):
  ALWAYS TILES, one source-sized CopyBits/CopyMask tile at a time. Steps are
  `0x10146`–`0x10176` in the forward branch and `0x10236`–`0x10262` in the
  reverse branch. Each step moves by the source width or height (axis test
  `srcH == dstH`). The final partial tile is clamped at `0x100a4`/`0x100d4`
  (forward, far end) or at `0x101a2`/`0x101d4` (reverse, near end). Special fast paths: a 1px-wide *src* (dst wider) draws each
  source row as a line across the dst (`0xff3e`–`0xffb6`); a 1px-tall src (dst
  taller) draws each source column as a line down the dst (`0xffba`–`0x10018`).
  The caller passes a direction byte (`(pc==11||pc==14) ? 0 : 1`, `0x59c8`–
  `0x59da`, read at `fp@(20)` / `0x10074`). **Corrected 2026-10-21:** it
  selects the anchor end, not the axis. 1 tiles forward from the dst
  top-left. 0 (codes 11/14) tiles backward from the dst bottom-right, so the
  partial tile falls at the near end. The axis is `srcH == dstH`
  (`0x10146`/`0x10236`), which with `0x5356`'s fixed cross axis is always the
  side's run axis. The 1px fast paths trigger on a 1px *source* along the run.
  Full trace: [kdef231-reference.md §5.1](kdef231-reference.md).
- **`FUN_00010320` @ `0x10320`** (the partCode-18 blit, called from `0x59ba`):
  a **single** `CopyBits` (`0x103ea`) or `CopyMask` (`0x10402`) — drawn ONCE,
  mapped src-rect → dst-rect (so it scales if the dst grew).

So: codes that tile use `0xfeae` (stepping by the cicn cell size). Code 18 uses
`0x10320` (one blit). Code 12 is forced (in `0x5178`) to a whole multiple of its
src width so that `0xfeae`'s tiling lands cleanly.
````

---

## 2026-10-22 revision trace (spec writer, branch `v2-spec-qd-answers`)

Static reading of `.scratch/k231-kdef/kDEF/k231-kdef0.asm` (root checkout
`/Users/khawkins/Documents/git/aaron-ui`) and of the maintainer's annotated
copy `campaign-20261021/v2-lanes/L1/annotated/kdef0.annotated.txt` (trap names
from the Traps.h table). No annotation or disassembly tool was written or run;
no original code was executed. Struct offsets are Apple's (`Quickdraw.h`:
GrafPort/CGrafPort, PixMap, BitMap, CIcon, ColorTable, GDevice, Region).

Apple text: *Imaging With QuickDraw* (1994) PDF from
`https://vintageapple.org/inside_r/pdf/Imaging_With_QuickDraw_1994.pdf`,
SHA-256 `f8e079d02b57516900f4b45c1f09629ef734313a51c171029278c9d97f6b497a`,
private copy `campaign-20261021/v2-lanes/spec-qd/apple/iwqd.pdf`. Pages quoted:
2-32 (bkPat: patterns aligned with the port's coordinate system), 3-6 ("all
patterns are always drawn relative to the origin of the graphics port"), 3-18
(pen draws below and right), 3-113 (CopyBits scales), 3-114 (shrink dither on
direct devices), 3-117 (maskRgn clipping; fore/back colouring; GDevice colour
table), 3-119 (CopyMask scales; maskRect same size as srcRect), 3-120 ("Calls
to CopyMask are not recorded in pictures and do not print").

### T-port. Port fields tested

- `0xfef0..0xff04`, `0x1033a..0x1034e`, `0xfe12..0xfe26`, `0xf7fa..0xf810`:
  `thePort+6` (portVersion) `& 0xC000 == 0xC000` → `colorPort`.
- Tile blit `0x1010e`/`0x101fe`: `tstl a0@(92)` where `a0` = thePort. Offset 92
  in both GrafPort and CGrafPort is **`picSave`** (txFont 68, txFace 70,
  txMode 72, txSize 74, spExtra 76, fgColor 80, bkColor 84, colrBit 88,
  patStretch 90, picSave 92, rgnSave 96, polySave 100, grafProcs 104). The
  first split's "grafProcs (`port+92`)" was a mislabel. Row X1.
- Scale blit `0x103ae..0x103be`: `tstl a0@(92)` (picSave) **or** `tstl a0@(104)`
  (grafProcs) → region path. Row SC4.
- Clip bbox: `thePort+28` = clipRgn handle; `*clipRgn+2..+9` = rgnBBox.

### T-flags. `lowDepth` (`a4@(1222)`), colour setup

- `0x4216..0x422a`: DeviceLoop (`$ABCA`, `0x420e`) drawing proc; `fp@(12)` =
  targetDevice GDHandle → `0xf2d6`.
- `0xf2d6..0xf308`: pushes `(gdFlags & 1) != 0` (GDevice +20, gdDevType bit)
  and `(*gdPMap)->pixelSize` (GDevice +22 → PixMap +32) → `0xf488`.
- `0xf488..0xf4b8`: depth > 4 → clear; depth < 4 → set; depth == 4 → set iff
  gdDevType bit set.
- `0xf378..0xf3a8`: `a4@(192..196)` := 0,0,0 (black), `a4@(186..190)` :=
  FFFF×3 (white); RGBForeColor(black), RGBBackColor(white).
- `0xf30a..0xf35c`: HLock icon handle and its iconData handle; `iconPMap.baseAddr
  := *iconData`; `iconMask.baseAddr := &iconMaskData` (CIcon +82);
  `iconBMap.baseAddr := iconMaskData + (mask.bounds.bottom − top) × mask.rowBytes`.
  No colour call. `0xf35e` unlocks both.

### T-tile. `0xfeae..0x10280`

- Frame: `fp@8` icon (`d4`), `fp@12` src (`a3`), `fp@16` dst (`a2`), `fp@20`
  direction byte, `fp@22` altSource long (as in the first split).
- `0xfec2..0xfee6`: skip when dst.right ≤ dst.left, dst.bottom ≤ dst.top,
  src.right ≤ src.left or src.bottom ≤ src.top.
- `0xff06..0xff2a`: clip bbox to `fp@(-48..-41)`; skip when dst.bottom ≤
  bbox.top, or bbox.bottom ≤ dst.top (`d7` = bbox.bottom). Row T0.
- `0xff2e..0xff3a`: GetForeColor/GetBackColor saved, `0xf378`.
- T1 `0xff3e..0xffb6`: `d5` = src.left; src width − 1 == 0 and dst width > 1.
  `thePort+68` (txFont) saved in `d6` and set to −12345 (`0xff5a..0xff62`),
  restored at `0xffae..0xffb2`. Loop `d3` = src.top..src.bottom−1, `d5` = `d3 +
  dst.top − src.top` while `< dst.bottom`: `0xf9f6(icon, h = src.left, v = d3,
  testMask = 1)`; on nonzero MoveTo(dst.left, d5) `$A893`, LineTo(dst.right −
  1, d5) `$A891`. Exits via `0x1026e` (colours restored; no unlock needed: the
  fast path never locked).
- T2 `0xffba..0x10018`: src height 1, dst height > 1; `d3` = src.left..; `d5` =
  `d3 + dst.left − src.left` while `< dst.right`; sample `(h = d3, v =
  src.top)`; MoveTo(d5, dst.top), LineTo(d5, dst.bottom − 1). No txFont marker.
- `0x1001c`: `0xf30a(icon)` (lock). `fp@(-16..-9)` = src, `fp@(-8..-1)` = dst;
  `d5` = src width, `d3` = src height.
- Source selection `0x10046..0x1006a`: lowDepth → `(*icon)+64` (iconBMap);
  `d6` (colorPort) false → iconBMap; else `fp@22` if non-nil, else `*icon`
  (iconPMap). Row X3/X4.
- `0x1006c..0x10072`: `d6` := thePort+2 (portBits / portPixMap).
- Forward `0x1007c..0x10176`: mask rect `fp@(-24)` := src. Tile dst.right :=
  dst.left + srcW, dst.bottom := dst.top + srcH. Per step: if dst.right(a2@6) <
  tile.right → tile.right := dst.right, src.right := src.left + dst.right −
  tile.left, mask.right likewise; same for bottom. Cull `0x100fa..0x1010c`
  (tile.bottom ≤ bbox.top or tile.top ≥ bbox.bottom → skip transfer). Transfer:
  picSave non-nil → CopyBits(src, portBits, &src, &tile, 0, NIL)
  `0x10118..0x10128`; else CopyMask(src, (*icon)+50 iconMask, portBits, &src,
  &mask, &tile) `0x1012c..0x10144`. Step `0x10146..0x1015e`: dst height ≠ srcH
  → top/bottom += srcH, else left/right += srcW. Exit `0x10162..0x10176`.
- Reverse `0x1017e..0x10262`: mask rect `fp@(-32)`; tile.left := dst.right −
  srcW, tile.top := dst.bottom − srcH; cut at dst.left/top moves src.left/top
  (`0x1019e..0x101fa`); same transfer pair `0x101fe..0x10234`; no cull; steps
  subtract `0x10236..0x1024e`; exit `0x10252..0x10262`.
- T8: with vertical stepping, the horizontal cut `0x100a0..0x100cc` (forward)
  or `0x1019e..0x101ce` (reverse) is applied once and persists in `src`; no
  horizontal stepping happens, so a narrower source leaves the rest undrawn.
- `0x10266..0x10278`: unlock, restore colours.

### T-scale. `0x10320..0x1041e`

- `0x10350..0x10374`: clip bbox; skip when dst.bottom ≤ bbox.top or dst.top ≥
  bbox.bottom.
- `0x10378..0x1038a`: save colours, `0xf378`, lock.
- `0x1038e..0x103a4`: lowDepth or not colorPort → `(*icon)+64`; else `*icon`.
  `fp@22`-style altSource absent.
- `0x103ae..0x103f0`: picSave or grafProcs → NewRgn; BitMapToRegion `$A8D7`
  (rgn, iconMask); MapRgn `$A8FB`(rgn, srcRect, dstRect); CopyBits(src,
  portBits, srcRect, dstRect, 0, rgn); DisposeRgn.
- `0x103f2..0x10402`: CopyMask(src, iconMask, portBits, srcRect, srcRect,
  dstRect).
- `0x10404..0x10414`: unlock, restore colours.
- `0x102d0..0x1031e`: offset src by (`fp@16` − src.left, `fp@18` − src.top) →
  `0x10320`. `0x10282..0x102ce`: same offset → `0xfdf8`.

### T-icon. `0xfdf8..0xfeac`

- `fp@8` icon (`d3`), `fp@12` srcRect (`d4`), `fp@16` dstRect (`d6`).
- `0xfe44..0xfe4e`: lowDepth or not colorPort → `0xfe7e`: CopyBits(iconBMap,
  portBits, src, dst, 0, NIL).
- `0xfe50..0xfe6a`: `(*icon)->iconPMap.pixelSize` (+32) == 1 → CopyMask(*icon,
  iconMask, portBits, src, src, dst).
- `0xfe6e..0xfe7a`: else CopyBits(*icon, portBits, src, dst, 0, NIL).
- Already recorded in `docs/spec/cicn-sparse-transfer.md` ("fdf8–fe7a ...
  depth-one CopyMask versus greater-depth CopyBits(srcCopy, null region)").

### T-sample. `0xf9f6`, `0xfa2a`, `0xfa5a`, `0xfa8a`, `0xfc5c`, `0x10702`

- `0xf9f6`: `fa8a(icon, h, v, &rgb, testMask)`; RGBForeColor(&rgb) always;
  returns `fa8a`'s result.
- `0xfa8a`: testMask → bit `7 − (h & 7)` of `iconMaskData[v × mask.rowBytes +
  (h >> 3)]` (`0xfa9a..0xfae4`); else 1. Zero → return 0 without writing rgb.
  lowDepth → iconBMap bit → rgb := black/white (`0xfaee..0xfb76`). Else pixel
  from `*iconData + v × pixRowBytes`, switch on pixelSize 1/2/4/8
  (`0xfb92..0xfc34`), then `0x10702(ctab = *pmTable, &rgb, value)`.
- `0xfc5c`: same addressing, no testMask; always samples the mask bit first
  (`0xfc64..0xfcc4`) and returns it in the low byte (`0xfdec`); lowDepth →
  black/white (`0xfcc8..0xfd30`); else pixelSize switch (`0xfd34..0xfdd0`),
  default branch falls to `0xfdd2` with an unset value (S6); `0x10702`.
- `0xfa2a`/`0xfa5a`: `0xfc5c` then RGBForeColor / RGBBackColor.
- No comparison of `h`/`v` against bounds anywhere in `0xfa8a` or `0xfc5c` (S5).
- `0x10702..0x10766`: `d4` = value, `d5` = ctSize (+6). value ≤ ctSize and
  `ctTable[value].value == value` → that entry (`0x10714..0x1071c`, `0x10728`).
  Else `ctTable[ctSize].value == 0` → `d3` := value (positional, `0x1071e..0x10726`
  → `0x10728`). Else search `i = ctSize .. 0` for `.value == value`
  (`0x1072c..0x10742`); not found → `d3 = −1` → 0 (`0x10744..0x10748`). Copy
  `ctTable[d3].rgb` (entry +2, i.e. table +10 + 8i).

### T-fill. `0xf930`, `0xf7cc`, `0xf87e`, `0xf71a`, `0xf68c`, `0xf6e0`

- `0xf930(rect a2, pixpat fp@12, x = fp@16, y = fp@18)`: `d5` =
  portRect.left (+18), `d6` = portRect.top (+16); SetOrigin(d5 − x, d6 − y)
  `0xf956..0xf962`. clipRgn bbox left > −32000 and top > −32000 → OffsetRgn(clip,
  −x, −y) `0xf964..0xf98e`. rect −= (x, y) `0xf990..0xf9a8`; `0xf7cc(rect,
  pixpat)`; rect += (x, y) `0xf9b6..0xf9c0`; bbox right < 32000 and bottom <
  32000 → OffsetRgn(clip, x, y) `0xf9c4..0xf9e6`; SetOrigin(d5, d6).
- `0xf7cc`: SysZone; HLock pixpat; colorPort → save and clear `thePort+62`
  (CGrafPort fillPixPat) `0xf812..0xf81c`; lowDepth → black/white, FillRect(rect,
  &(*pixpat)->pat1Data (+20)) `$A8A5`, restore colours `0xf820..0xf856`; else
  FillCRect(rect, pixpat) `$AA0E` `0xf858..0xf85e`; restore fillPixPat
  `0xf860..0xf868`; HSetState; zone.
- `0xf87e(rgn fp@8, pixpat fp@12, x fp@16, y fp@18)` / `0xf71a`: as above with
  OffsetRgn on the target region and FillCRgn `$AA12` / FillRgn `$A8D6`.
- `0xf68c(icon, rgn, rect, h, v)`: `0xf6e0(icon, rgn)` = lock; BitMapToRegion
  (rgn, iconMask); nonzero result → SetEmptyRgn `$A8DD`; unlock. RectRgn(tmp,
  rect) `$A8DF`; DiffRgn(tmp, rgn, rgn) `$A8E6`; OffsetRgn(rgn, h − rect.left,
  v − rect.top); DisposeRgn(tmp).
- Scroll-bar composite `0xc6e4..0xc746`: pattern present → `0x10320(icon, src
  fp@-8, dst fp@-16)`; `0xf68c(icon, rgn, &src, dst.left, dst.top)`; `0xf87e(rgn,
  pattern, phase from the control's rect top-left)`. No pattern →
  `0xfdf8(icon, &src, &dst)`.

### T-cinf. `0x107fe..0x10fbe`

- `0x10806..0x10812`: `d4` = id, `a2` = D, `d6` = emboss out; `d7` := 0.
- `0x10814..0x10830`: CurResFile → `d3`; Gestalt `$A1AD` selector `0x436F706C`
  ('Copl'); success → UseResFile(low word of the response).
- `0x10832..0x1085e`: `fp@(-36)` := 0; cache mode `a4@(1221)` → `0xed70(id)`
  entry in `d7`, icon = entry+2; else `0x10472(id)` → `d5`.
- `0x10472`: SysZone; CurResFile; Gestalt 'Copl' → UseResFile; `a4@(3436)`
  non-nil → sparse switch on id (`0x104ba`, table `0x104c0..0x1050f`) to
  per-id slots filled lazily by `0x10420` (GetCIcon `$AA1E` when the slot is
  empty); default and table-absent → GetCIcon(id) `0x10694..0x10698`;
  restores zone and resource file.
- `0x10860..0x1086a`: UseResFile(d3); `d5 == 0` → return 0 (`0x10fb8`).
- `0x1086e..0x1089c`: `0x116f8(id, 0)`; NULL → `0x116f8(bodyFill ? 0 : 1, 0)`;
  NULL → `0x10fa8`. `0x116f8` uses GetResource `$A9A0` type `0x63696E66`
  ('cinf').
- `0x108a0..0x108b0`: `d3` = byte[0] (c), `d4` = byte[1] (s).
- `0x108b4..0x108ca`: NULL output pointers replaced by locals.
- `0x108cc..0x108e2`: clip bbox to `fp@(-64..-57)`.
- `0x108e8..0x108fa`: GetPenState `$A898`, PenNormal `$A89E`, HGetState/HLock cinf.
- `0x108fc..0x10998` (bodyFill only): `fc5c(icon, h = word@8, v = word@6,
  &bg)`; `fc5c(icon, word@12, word@10, textOut)`; emboss Point at +14: both
  words 0 → `embossOut.red := 0x1234` (`0x10938..0x10958`); else sample, and if
  the three components equal bg's → `0x1234` (`0x1096e..0x10990`). Return
  values of `fc5c` unused. RGBBackColor(white) `0x10994..0x10998`.
- `0x1099a..0x109a4`: `fp@(-24..-17)` := icon iconPMap.bounds (+6..+13).
- Body `0x109aa..0x10bbe`: RGBBackColor(bg); mode byte[3] == 5 →
  `0x10472(word@4)`; found → src := icon iconBMap.bounds (+70..+77); dst := D
  with top/left += s, bottom/right −= s (`0x109ea..0x10a00`); `0xfdf8`;
  DisposeCIcon `$AA25`. Absent → EraseRoundRect(R1 = D with left/right ±c,
  top/bottom ±s, oval 0) `0x10a1e..0x10a3e`; c ≠ s → EraseRoundRect(R2 = left/
  right ±s, top/bottom ±c) `0x10a46..0x10a66`. mode ≠ 5 → `a4@(1220)` ?
  `0xeeea(word@4)` : `0x10440(word@4)` (GetPixPat in SysZone); found → phase
  switch `0x10aae..0x10af6` → `0xf930(R1, pp, x, y)`; c ≠ s → `0xf930(R2, ...)`;
  uncached → DisposePixPat `$AA08`. Absent → erase R1/R2 `0x10b72..0x10bb8`.
  Then RGBForeColor(textOut) `0x10bba..0x10bbe`.
- `0x10bc0..0x10bfc`: `d7` (cache entry) and byte[2] (tile) ≠ 0 → rect := icon
  bounds inset (s, s) (InsetRect `$A8A9`); `fp@(-36)` := `0xea6c(entry,
  thePort, &rect)`.
- `0xea6c`: QDExtensions `$AB1D` selector `0x40017` on the port → its pixmap;
  reuse the entry's buffer when depth, colour table and size match; else copy the
  PixMap header, set bounds = icon bounds, rowBytes for the port depth,
  NewHandle in SysZone; four CopyMask(icon, iconMask, cache) calls over
  `[bounds.top, rect.top)`, `[rect.bottom, bounds.bottom)` (full width), and the
  left `[bounds.left, rect.left)` / right `[rect.right, bounds.right)` columns
  between `rect.top` and `rect.bottom` (`0xebbe..0xec9c`); returns the cached
  PixMap. The window draw loop calls the same routine at `0x58a4..0x58b6`
  with its own rect (not traced).
- Corners and bands: as in spec §5 table, each line range cited there. Notes:
  TL `0x10c0c..0x10c54` src := B, right := min(left + c, B.right), bottom :=
  min(top + c, B.bottom), `0x102d0(icon, &src, D.left, D.top)`. TR
  `0x10c58..0x10cb2` src.left := max(B.right − c, B.left), dest h :=
  `D.right − (src.right − src.left)`. Top band `0x10cc4..0x10d34`: src.left +=
  c, src.right −= c, src.bottom := min(B.top + s, B.bottom); tile == 0 →
  src.right := src.left + 1; dst := D, left += c, right −= c, bottom := top +
  src height; `0xfeae(icon, &src, &dst, 1, fp@(-36))`. BL/BR
  `0x10d50..0x10e0e`, bottom `0x10e22..0x10e92`, left `0x10e9a..0x10f0a`
  (no clip cull), right `0x10f0e..0x10f82` (no clip cull) by symmetry. Culls:
  `0x10c00..0x10c08` (D.top + c ≤ bbox.top), `0x10cba..0x10cc2` (D.top + s),
  `0x10d3c..0x10d4c` (D.bottom − c ≥ bbox.bottom), `0x10e16..0x10e20`
  (D.bottom − s).
- `0x10f86..0x10fb6`: cache present → `0xecb6(entry)` (HUnlock/HPurge);
  HSetState cinf; SetPenState; not cache mode → `0x106ae(icon)` (DisposeCIcon
  unless it is the loader's cached slot `a4@(1212)`); return 1.

### T-B. Inset reconciliation (first split §6 item 6)

`0x10a28..0x10a34` (`addw d3` left, `addw d4` top, `subw d3` right, `subw d4`
bottom) builds R1 for the B3 erase; it is not a 9-slice corner computation as
the reference's §3.6 note said. B2's destination is `0x109ea..0x10a00`
(`addw d4` to left and top, `subw d4` from right and bottom). Both are right;
they are different rects.

### T-W. Window loop and side lists (Q11)

- `0x36ce..0x373c`: the four source side lists (`a4@(2788)`, 162 bytes each)
  are block-copied from the `wnd#` after its rect list; each starts with a count
  word, and `(part, border)` word pairs follow.
- `0x5938..0x59f8`: for each side `d5` in `[d3, fp@(-80))` (0..4, or 0..2 /
  2..4 per flags `a4@(510)`/`a4@(507)`, `0x58b8..0x58da`), cells `d4 = 1 ..
  count` (`0x595c`, `0x59f6..0x59f8`), part = `list[4·d4 + 2]`, rects from
  `0x5356` = `[border[d4 − 1], border[d4])`. No cell after `border[count]`.

### Census (own forks)

Script `campaign-20261021/v2-lanes/spec-qd/tools/cinf-geometry-census.mjs`
(SHA-256 `4d6325844cbb8c6d7d76c57166f9041adc2690600652937987dfb855f4c8b0e9`),
run against this worktree's `tests/control-availability/source-choices.json`
forks; output `cinf-geometry-census.out.txt` (SHA-256
`4492bae284d0422ea9e9f321153d2a7b17124da346c25c0f14b6784b1f09685d`). Row-byte
check for the three 1138 out-of-bounds samples:
`tools/cicn-rowbytes.mjs` (SHA-256
`e29ea3b87a51f9a45f5bf8161fe917021a92384024429034e89e2a3d1b65a4b4`): all three
icons are 1-bit with 1-byte rows, so `h = 1, 2` read padding bits. Mode/tile
counts re-confirmed with `scripts/survey-cinf-body.mjs`.
