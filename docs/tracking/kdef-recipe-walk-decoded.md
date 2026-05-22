# kDEF frame recipe — decoded from `kDEF_0.asm`

Research-only. No code changed. Decodes how Kaleidoscope's `kDEF 0` (68k)
turns a `wnd#` `(partCode, border)` side list into a drawn window frame.
Every claim cites a file offset in `/tmp/kaleido-trace/kDEF_0.asm` (offsets =
file offsets; Ghidra `FUN_xxxx` use the same numbers). The objdump
mis-renders 32-bit `bsr.l` as `61ff ffff aXXX` and 32-bit `jsr` similarly;
those three words are ONE instruction (a far call) and the trailing `aXXX`
word is the actual A-trap. All call targets below were re-resolved with a
custom decoder, not trusted from objdump's `%pc@()` text.

---

## TL;DR — the headline finding

**The kDEF does NOT walk the `wnd#` `(part, border)` side list per-segment to
draw the frame, and there is no `switch(partCode)` that selects fixed-vs-stretch.**

Searched exhaustively: every `CopyBits` (`$a8ec`) / `CopyMask` (`$a817`) call
site (18 total, offsets listed below), every caller of the two blit setups
`0xe02`/`0x1018` (39 sites), and every window-draw function reachable from the
WDEF message dispatcher `0xc8d8`. **None** of them indexes an array of int16
pairs while comparing a running position to successive `border` values. The
only `partCode` switch in the whole binary is a **hit-test classifier**
(`0x9312` @ `0x947x`), not a draw path.

What the kDEF actually does for window chrome is three separate mechanisms,
none of which is a recipe walk:

1. **Region/vector geometry** (`MoveTo`/`LineTo` = `$a893`/`$a891`): draws the
   rounded-corner staircases and structure-region outline.
   (`0xa5f4` @ `0xa708`–`0xa7be`; `0xd368` @ `0xd4f0`–`0xd59x`.)
2. **Edge fill = TILE a cicn strip** by stepping the dest rect by the cicn's
   own width/height (`0xde84` @ `0xdf4a`–`0xdf6e`). Single `CopyBits` for short
   edges (`0xdf74`).
3. **Title text composited through a Kaleidoscope text plugin** via an offscreen
   GWorld + `CopyBits` (`0xad62`/`0xb2a0`/`0xb2ca`, selector calls `$ab1d`).

The `(part, border)` side list is consumed by the **host** (Kaleidoscope's app
+ the OS/replacement `WDEF` that the kDEF loads at `0x9338`), to (a) build the
structure/content regions the kDEF then fills and (b) hit-test. The kDEF
receives a window **cicn** (passed in via `A4`/params, never `GetResource`'d by
the literal `'wnd#'`/`'cicn'` type — confirmed: those 4-char tags do not appear
in the binary; the only window-ish type fetched in-code is `'WDEF'` at
`0x9338`).

So the per-segment "fixed vs stretch" decision the question asks about is **not
made by the kDEF from the part code at all**. It is made by the *scheme author*
when they author the side list, and it is encoded as **segment SPAN**, per the
period "Creating Color Schemes" (K2) speed note. That is the rule that resolves
the 1138-vs-evolution puzzle (see §5).

---

## 1. The blit primitive and its two setups (verified)

`0xe02(cicnPixStruct a2, *srcRect d3, *dstRect d6)` — `kDEF_0.asm` `0xe02`:

- `$a874` GetPort, `$aa19` GetGWorld, `$aa1a` SetGWorld, `$aa14`/`$aa15`
  GetPort/SetPort save/restore (`0xe34`–`0xe68`).
- `$a069`/`$a029` HGetState/HLock the pixmap (`0xe6a`–`0xe72`).
- At `0xef6`: `cmpiw #1, %a0@(32)` — **if the cicn pixel depth field == 1, use
  `CopyMask` (`$a817`, `0xf10`), else `CopyBits` (`$a8ec`, `0xf20`/`0xf34`)**.
- Args confirm a **single blit from one src rect to one dst rect**; QuickDraw
  scales (sample-and-hold) when the rects differ in size. This is THE stretch
  primitive.

`0x1018` is byte-for-byte the same logic (`0x1018`–`0x1016`), with the dst rect
pre-offset by a delta in the thin wrappers `0xf6e`/`0xfc2` (`0xf90`–`0xfb2`:
add (dx,dy) to the dst rect, then `jsr 0xe02`).

`0xb64(pixHandle, x, y)` (`0xb64`) is NOT a frame blit — it walks
`rowBytes`/`baseAddr` (`0xc22`–`0xc6a`) to read **one pixel** at (x,y). Used for
corner-color and title-text-color sampling.

**All 18 CopyBits/CopyMask sites:** `0x746,0x796` (prim core), `0xf10,0xf20,
0xf34` (`0xe02`), `0x1132,0x1146,0x1162,0x117a` (`0x1018`), `0x2a0c,0x2a36,
0x2b54,0x2b7e` (buttons `0x26e0`/`0x30a8`), `0x74d6` (popup tab `0x75c8`),
`0xb2a0,0xb2ca` (doc-window title composite `0xad62`). Note: **zero** of these
sit inside a `(part,border)` loop.

---

## 2. The plugin/message architecture (why there's no recipe walk in kDEF_0)

- Boot (`0x160`) registers six handlers into a dispatch table
  (`0x18a`–`0x1c0`): `0x1e28, 0x4b1c, 0x89b0, 0x9312, 0xc8d8, 0x42be`.
- `0x9312` is the **window message front-end**. At `0x9338` it does
  `GetResource('WDEF', -14330)` (`#0x57444546` = `"WDEF"`), `HGetState`/`HLock`
  it (`0x934c`/`0x9354`), `StripAddress` (`$a055`, `0x9412`) and **`jsr %a0@`**
  (`0x9416`) — i.e. it **executes the loaded WDEF** to compute regions /
  hit results. The kDEF is a WDEF shim.
- `0xc8d8` is the **WDEF message switch**: `cmpiw #8,%d0` then
  `jmp %pc@(0xc930,%d0:w)` (`0xc920`–`0xc92c`). Jump table at `0xc930`
  (9 entries) → msg1 `wDraw` = `0xd05a`, others = `0xce48/0xcdd0/0xce2c/...`.
- `wDraw` (`0xd05a`) is **pure region clipping**: `RectInRgn` (`$a8e8`),
  `SetRectRgn` (`$a8df`), `UnionRgn` (`$a8dc`), `InsetRgn` (`$a8e1`), `SectRgn`
  (`$a8e6`), `DiffRgn` (`$a8e5`), `EqualRect` (`$a8ad`). It decides WHICH parts
  are dirty, then dispatches to part-draw helpers via a second switch
  (`0xd2aa`): part0 → `0xd2be`→`0xd368`, etc.

None of these reads a side list. The side list never enters kDEF_0 as iterated
data; the structure region (already partitioned by the host from the side list)
does.

---

## 3. What each candidate frame function actually is

| addr | role | evidence |
|---|---|---|
| `0xe02`/`0x1018` | single scaled CopyBits/CopyMask blit (the stretch primitive) | `0xef6` depth test; `$a8ec`/`$a817` |
| `0xb64` | 1-pixel sampler | `0xc22`–`0xc6a` rowBytes math |
| `0x35b0` | **title/text anchor** (NOT frame, NOT recipe) | reads anchor `@0x11`, margin `@0x2a`, title-fit test `0x35b0`@`0x3878..` |
| `0x5eb4` | **popup-window tab** centred stretch | `Gestalt('Acid')` `0x5eca`; `divsw #2` everywhere (`0x5f3c`,`0x5f50`,…) — confirmed ignore |
| `0x66b4` | **scrollbar** drawer | picks cicn `-8277..-8288` (`0x66ee`–`0x6732`); 16px fixed corners + `cmpiw #16` small-bar collapse (`0x67be`) — confirmed NOT the doc frame |
| `0xa5f4` | doc/utility **region-outline + corner staircase** | `GetResource(-14332/-14336)` (`0xa63a`/`0xa64a`); `MoveTo`/`LineTo` corner loops `d3:0..6` (`0xa708`,`0xa750`) |
| `0xde84` | **edge fill = TILE a cicn strip** | `0xdf1c`: `d3 = a1@(10)-a0@(6)` (cicn width); loop `0xdf4a`–`0xdf6e` steps dst by `d3`, `jsr 0xe02`, `while dst.left < edgeEnd`; `<=7`px → one `CopyBits` (`0xdf74`/`$a8a2`) |
| `0xad62`/`0xb2a0`/`0xb2ca` | **doc-window title-text** composite | font traps `$a887/$a88a/$a888/$a889`; Kaleidoscope text plugin selectors `$ab1d` (`#262167`,`#524294`); CopyBits with equal src=dst (1:1, text-masked) |
| `0x9312` @ `0x947x` | **hit-test part classifier** (the only partCode switch) | see §4 |

`0xde84` is the closest thing to "fixed corners + stretched/tiled middle," but
its middle is **tiled by the cicn's intrinsic width** — it is not driven by a
side list and has no per-part branching.

---

## 4. The ONLY partCode switch is a hit-test, not a draw selector

`0x9312`, after `jsr %a0@` returns the hit code in `d7`, with
`d3 = varCode & 7`:

- `0x947c`: `cmpiw #1,%d3` … `#2` … `#3` … `#5,%d3` → if any, `0x9490`:
  `orl #8, dest` (mark as a named-widget / draggable hit: close=1, zoom/grow=2,
  collapse=3, drag/title=5).
- else `0x949a`: `andl #4` then call helper.

So part codes **1,2,3,5** are the *named clickable widgets* (close / zoom /
collapse / drag-title) used for **hit-testing and the rectList stamp**, exactly
matching `wnd#` rectList entries `part-1..part-4`. They carry **no stretch
semantics**. This is the only place the kDEF inspects a part code, and it never
touches a blit.

---

## 5. The real rule (from the format, not from kDEF_0 instructions)

Because the kDEF delegates the partition to the host and just fills regions, the
fixed-vs-stretch decision lives in **how the author authored the side list**.
The authoritative statement is the K2 "Creating Color Schemes" speed note
(captured verbatim in `docs/aaron-ui-raster-mapping-spec.md` §3.1):

> "…For windows, Kaleidoscope runs fastest if the **stretch regions are only one
> pixel high or wide**. If a one pixel stretch region does not fit into your
> window frame, you can **split a larger stretch region into two regions, making
> the first pixel the stretch region and the remainder a null region (part code
> 0) that does not draw**."

This yields the actual algorithm (host-side recipe walk, faithful to what the
kDEF then fills):

1. **Group + walk pairwise.** Sort entries by `border`; segment `i` is
   `[border_i, border_{i+1})` tagged `part_i`. The last entry is a **terminator**
   (its part code is unused; its position is the edge end).
2. **Per-segment behaviour:**
   - **part 0 → null: draw nothing** (skip). This is the deliberate "padding"
     that lets authors place a 1px stretch beside a static remainder.
   - **parts 1–4 → STAMP** the matching `rectList[part]` rect, 1:1, native size,
     anchored at the segment start (the close/zoom/collapse/drag widgets).
   - **everything else (5,6,8,10,11,15,17,18) → STRETCH** that segment's **own
     source slice** (`[border_i, border_{i+1})` along the cicn band) across the
     segment's own span. There is **no special part-code branching** among these
     — they are all "stretch this slice." (18 is documented as a gradient but is
     drawn the same scaled-slice way; the scale-don't-tile distinction matters
     only so a multi-pixel ramp isn't repeated.)
3. **Source region per segment** = its own x-range in the cicn (`[border_i,
   border_{i+1})` of the corresponding cicn band), **not** a rectList rect
   (except the 1–4 stamps) and **not** a forced 1px column. A 1px-span segment
   therefore naturally samples a 1px column and stretches it → a solid bar; a
   wide segment samples a wide slice and stretches it → preserved art.
4. **Growth distribution.** The cicn is the *minimum* window. Extra window width
   is absorbed by **the stretch segments only** (parts 0 and 1–4 keep native
   size). Because each segment stretches its own slice, the natural model is:
   each stretch segment grows so that the segment boundaries scale with the
   window — i.e. boundaries between the fixed/stamped anchors are interpolated,
   and the stretch slices in between fill the gap. In practice the dominant
   wide-span stretch segment (the title/side fill) absorbs almost all of it,
   because the 1px rods can't visibly "grow" (a 1px column stretched to 1px → no
   change) while a wide fill stretched wider just gets wider. **This is not a
   part-code-keyed proportional split; it is a direct consequence of "stretch
   each slice across its span," with spans scaling to the resized frame.**

### Why this is the discriminator the question asked for

> "**span**, not part code." The fixed-vs-stretch axis is set by parts 0 and
> 1–4 (null + named widgets = not stretched); among the stretch codes there is
> no further per-code distinction in the kDEF. The *appearance* (solid bar vs.
> preserved ornament) is set by **how wide the author made the segment** — a
> deliberate 1px stretch reads as a colour bar; a wide stretch preserves graphic
> content.

---

## 6. Corpus validation (computed spans)

Top edges, walked pairwise (`span = border_{i+1} − border_i`):

**1138** `p0[1,35)=34 · p1[35,36)=1 · p11[36,46)=10 · p6[46,47)=1 ·
p5[47,55)=8 · p6[55,56)=1 · p8[56,102)=46` (term @102)
- The **title-bar pinstripe that fills the middle** is `p8 @ [56,102) span=46`,
  the wide universal-stretch panel — it stretches its own 46px slice across the
  growing middle. Correct: a uniform light pinstripe filling the bar.
- The dark 1px `p1 @ [35,36)` is a 1px hairline (a single dark column), NOT the
  bar fill. The earlier renderer's bug was treating that 1px `p1` as the
  stretch target, producing a dark bar.
- close box left = `p11`/`p1` near x35; zoom/collapse right = the `p5/p6`
  sandwich + `p8`. Matches "close left, zoom/shade right, title centred."

**evolution** the `p18` segments are spans 4/4/3/4/3/2 (the metallic "links")
and the `p1` rods between them are span 1; the title bezel is
`p6[69,70)=1 · p5[70,71)=1 · p6[71,73)=2`.
- `p18` links: each is a few-px slice stretched only across its own few-px span
  → drawn essentially once (fixed-looking), exactly as required. (Don't tile the
  ramp; scale the slice — the "code 18 = scale" point.)
- `p1` rods (span 1) stretch — but a 1px slice stretched stays a thin rod, and
  the *boundaries* slide as the window grows → the rods are what give. Correct.
- evolution's `p5` is **span 1** (a 1px bezel) — so it cannot become a box.
  Correct.

**The 1138 vs evolution puzzle, resolved:** 1138's bar is `p8 span=46`;
evolution's bezel is `p5 span=1`. Different segments, **different spans** — the
same part code (5/6/8 are all just "stretch") never has to mean two things,
because the *span*, authored by the scheme designer, is the signal. 1138's
title plate is the wide `p8`, not its `p5`; evolution's `p5` is an intentional
1px sliver. Nothing keys on the part code.

**1990** `p8` panels span 15/12/11/11/5/34 between 1px `p1` rods: the camo `p8`
panels each stretch their own slice across their own span (drawn once-looking),
the 1px `p1` rods stretch (slide). Correct.

**1984** `p8 @ [47,58) span=11` (button-row strip) stretches its own 11px slice;
the wide stamps `p2/p15/p3/p4` are the baked widgets. Correct: button row drawn
once.

**beos** bottom border is one wide `p1`/`p8`-class span filling the edge → its
slice stretches to fill (a wide uniform border stretching). The 65px figure is
the bottom-edge fill segment; same mechanism. Correct.

---

## 7. Honest limits (what is NOT pinned to an instruction)

- The **per-segment slice/stamp/null rule** (§5.2) and the **growth model**
  (§5.4) are **NOT** decoded from kDEF_0 instructions, because **kDEF_0 does not
  contain the recipe walk** — it is performed host-side / by the loaded WDEF
  (`-14330`, fetched at `0x9338`, executed at `0x9416`), whose code is not in
  this binary. The rule above is the K2-documented model, *cross-checked* to be
  consistent with what kDEF_0 demonstrably does (tile/stretch a cicn slice via
  the `0xe02` scaled blit; stamp rectList widgets; draw corners as vectors) and
  with all five corpus schemes.
- I could not find a `cinf.tileSides` test inside the frame path of kDEF_0 (the
  tile-vs-stretch override lives with the cicn's cinf, consumed where the host
  builds the fill); `0xde84` shows the kDEF *can* tile (step-by-width loop), so
  the tile path exists, gated outside this code.
- Whether growth is strictly "interpolate boundaries" vs "widest stretch segment
  absorbs all" is not instruction-provable here; both reduce to the same visible
  result for the corpus because the non-fill stretch segments are 1–4px.

## 8. Recommendation for the v2 compositor

Replace the part-code→behaviour heuristic and the pixel-classification "find the
plate column" hack with the **span-driven** rule:

- part 0 → skip; parts 1–4 → stamp rectList rect at native size, anchored at
  segment start; **all other codes → stretch the segment's own cicn slice across
  its own span** (scale, never tile, unless `cinf.tileSides`).
- Source x-range for a stretch segment = its own `[border_i, border_{i+1})` in
  the cicn band — a 1px span gives a 1px column (→ solid bar), a wide span gives
  a wide slice (→ preserved art). This single rule reproduces 1138's pinstripe
  AND evolution's bezel with no part-code special-casing and no bitmap
  variance/saturation scoring.
- Distribute window growth by scaling segment boundaries with the frame so each
  stretch slice fills its (now larger) span; widgets/null stay fixed.
