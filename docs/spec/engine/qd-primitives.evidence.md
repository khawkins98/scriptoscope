# qd-primitives — evidence appendix

> **Evidence appendix — never read by implementers** ([implementer brief](IMPLEMENTER-BRIEF.md)).
> Spec writers and verifiers only. Listing-level source for
> [`qd-primitives.md`](qd-primitives.md), copied verbatim on 2026-10-21 (v2 lane
> L2) from v2 commit `1183816e`. The originating sections stay in place in
> `kdef231-reference.md` and `kdef231-recipe-walk.md` until those documents are
> split (L2 doc-split PR); this copy is the frozen text the behavioural spec was
> derived from. Nothing was re-decoded during the move.
>
> Listing used by the source sections: `.scratch/k231-kdef/kDEF/k231-kdef0.asm`
> (root checkout only, gitignored) and `/tmp/kaleido-trace/kDEF231_0.asm`;
> resource SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`.

## Verifier marks

| spec row(s) | addresses | mark | verifier, date, listing |
|---|---|---|---|
| T1–T7, W1–W3 | see spec §4 | PENDING | — |
| B0–B6, P1–P5, E1–E4 | see spec §4 | PENDING | — |
| §6 item 6 (inset reconciliation) | `0x10a28..0x10a34`, `0x109da..0x10a1a` | OPEN | — |

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
