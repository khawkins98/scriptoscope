# Code 10 and the baked widgets (2.3.1 kDEF decode note, 2026-10-21)

Static reading of `.scratch/k231-kdef/kDEF/k231-kdef0.asm` only. No original
code was executed. This note covers part code 10, the rect-list widgets
(close / zoom / collapse) and the widget-related cinf/work flags. It records a
decode and the runtime change made from it (§9, implemented after
independent review, `campaign-20261021/lanes/K/REVIEW.json`). None of this is
native-capture evidence.

## 0. Answer

The question asked: what must be true for the runtime to collapse code-10
cells on untitled sides without losing the baked widget art? Its premise is a
misread of the `0x5178` argument frame.

- `0x5178` receives **two** flag bytes. `fp@(24)` goes to `0x49d6`, so `0x4a0c`
  returns it for code 10 (`0x52fc`). `fp@(26)` gates only the 5/6 collapse
  (`0x530c`). The `#1` pushed at `0x4db4`/`0x4dd4` is the `fp@(26)` byte. The
  `#1` at `0x515e` is the start index, not a flag. Every call site passes
  `0x4a64`'s `fp@(-3)` as the `fp@(24)` byte (`0x4db8`, `0x4dd8`, `0x5104`,
  `0x5124`, `0x514a`).
- `fp@(-3)` is cleared at `0x4aac`. It is set to 1 only at `0x4e0e`, when the
  side's placed extent is **smaller than the sum of its fixed cell widths**
  (`0x4dfe..0x4e0c`). So code 10 means "fixed, but dropped first when the side
  is too short". Whether the side carries a title makes no difference.
- So code 10 **never collapses at or above the template size.** The runtime's
  FIXED classification is the decoded behaviour at every size the checker
  samples. A code-10 collapse happens only below the template minimum. There
  the kDEF itself does not draw the baked art of a collapsed cell. Nothing in
  the full-frame draw puts a rect-list type 1–3 widget (close, zoom, collapse)
  back; the only `0x632e` call there is the partial-zoom part 5 (§3). The
  rect-list hit/press rects follow the collapsed cell through `0x5cb6`.

To collapse code 10 faithfully, the runtime therefore needs the below-minimum
negotiation (§2) and a general `0x5cb6` widget-rect remap (§4b, §7). It does
not need a widget stamp.

## 1. The `0x5178` frame (correction)

`0x5178` uses `link fp,#-4`. The pushes at `0x4db4..0x4dcc` (and the same
shape at `0x4dd4`, `0x5100`, `0x5120` and `0x5148`) build this frame:

| slot | pushed by | meaning |
|---|---|---|
| `fp@(8)` | `movel a2` (last) | SOURCE side list (widths read as `a3@(4) − a0@(4,i−1)`, `0x5322..0x532a`) |
| `fp@(12)` | `movel a3` | DEST side list (budget read at `0x518a..0x5194`, borders written at `0x5332..0x533c`) |
| `fp@(16)` | `movew #1` / `d4+1` | first segment |
| `fp@(18)` | `d3` / `a3@` / `d7` | last segment |
| `fp@(20)` | `fp@(-18)` / `fp@(-20)` / sum | primary-grower count |
| `fp@(22)` | `fp@(-32)` / `fp@(-14)` / `fp@(-16)` | required fixed width |
| `fp@(24)` | `moveb fp@(-3)` | **`0x49d6` flag**, read at `0x52fc` |
| `fp@(26)` | `moveb #1` / `fp@(-290)` / `clrb` | **5/6 gate**, read at `0x530c` |

`0x49d6` (`0x49da` → helper `0x148`) dispatches through its table at `0x49e4`:
default `0x4a5e`, and code 10 → `0x4a0c` `moveb fp@(10),d0`. Its `fp@(10)` is
the byte pushed at `0x52fc`, which is `fp@(24)` above.

Reference §1.4 (`0x5178` row) and §4.2 currently say that `fp@(26)` is the flag
handed to `0x49d6`. That is wrong. The compositor-spec code-10 row, the
faithfulness-ledger `0x4a0c` row and the `window-chrome-rules` code-10 `todo`
(expected `[18, 0, 2]` at width 20) all inherit the misreading.

## 2. When code 10 collapses (`0x4a64`, too-small step)

`0x4a64`'s arguments (callers `0x3866`/`0x3888` in `0x3680`) are:
`fp@(8)` = source list, `fp@(12)` = dest list, `fp@(16)` = template body rect
`0x6582(0)`, `fp@(20)` = the `0x4778` window rect, and `fp@(24)` = `#1` for
sides 0/1 (horizontal) or `0` for sides 2/3. That last byte is an **axis**
selector, not a "titled" flag.

1. The first pass (`0x4af8..0x4be0`) covers segments 1..N under flag
   `fp@(-3)=0`. `fp@(-16)` += src width of every cell where `0x49d6(code,0)==0`
   and the code is not in {5,6,8,11,12,13,14,18} (`0x4b64..0x4ba4`). Code 10
   counts here, as FIXED. `fp@(-30)` collects the code-10 widths separately
   (`0x4ba8`). `fp@(-6)` += code-4 widths when `0x487e`, and −= code-17 widths
   (`0x4bb2..0x4bd2`).
2. Dest border[0] is src border[0] + (window − template) leading edge, and
   dest border[N] is src border[N] + the trailing-edge delta (`0x4be4..0x4c60`).
   The placed extent therefore equals the template extent plus the content-size
   difference.
3. `0x4dfe..0x4e0c`: if `destBorder[N] − destBorder[0] < fp@(-16)`, then
   `fp@(-3) = 1`, `fp@(-16) −= fp@(-30)`, title width `fp@(-2) = 0` and the
   title string's length byte `fp@(-290) = 0` (`0x4e0e..0x4e20`). `fp@(-290)`
   is the GetWTitle Str255 (`0x4a98` `pea fp@(-290)`, `$A919`; `StringWidth`
   `$A88C` → `fp@(-2)`); its length byte is what reaches `fp@(26)` on the title
   path. It is also zeroed at `0x4f5e` when ≤2px of title room is left.
4. `0x4e24..0x4e42`: if the side is still too short and `fp@(-6) > 0`, it
   clears `a4@(500)` (the collapse/shade widget, which `0x487e` reads) and
   subtracts `fp@(-6)`.
5. In `0x5178`, code 10 with flag 1 goes `0x4a0c` → 1 → `bnes 0x532e`, with
   `d6 = 0` from `0x5260`. That gives **width 0**. With flag 0 the code is FIXED
   (`0x531e..0x532a`). Because the title length byte is now 0, codes 5/6 also
   collapse. (Code 0 returns 1 under either flag, `0x49ec` → `0x4a12`, so it is
   zero-width in both cases. Codes 2/3/4 are fixed iff goAway `+112` /
   `a4@(501)` / `0x487e`; 15/16/17 the inverse.)

One exception: the popup-family path (`d4 && a4@(509)`, `0x4c64..0x4dfa`) runs
before step 3, so code 10 always stays FIXED there.

## 3. (a) Who draws close (4), zoom (5/6) and collapse (9)

`0x4216` is the DeviceLoop draw callback (`0x41ee`, `$ABCA`). It switches on
`a4@(462)`, the WDEF draw param (table at `0x4270`, offsets relative to
`0x4278`):

- **param 0** → `0x428c`. If `a4@(497)` it does the outline draw `0x42d8`;
  otherwise it does the **full frame draw `0x572e`** (`0x429a`).
- **params 4, 5, 6, 9** → `0x42a2` → `0x632e(part, state)`. `state = d4 = 1`
  when bit 0 of `*a4@(514)` is clear (`0x4256..0x4264`). After the draw the bit
  is toggled (`0x42ae..0x42c8`), so successive highlight calls alternate
  pressed (1) and normal (0). For params below 4 the bit is cleared first
  (`0x4242..0x4254`).
- params 1, 2, 3, 7, 8 do nothing.

Inside `0x572e`, sides are walked through `0x5356`, and cells with
`right <= left` or `bottom <= top` are skipped (`0x5990..0x59a6`). After the
sides, the only rect-list widget call (types 1–3) is `0x5a28..0x5a3c`:
`if (a4@(502) && a4@(508)) 0x632e(5, 0)`. **No full-frame draw paints close
(4) or collapse (9) separately.** Their normal-state art is whatever template
pixels the side cells copy. They are drawn on their own only on the
highlight-toggle draws (params 4/9).

Two other full-draw blocks exist. Under `a4@(509)` (set only for procID family
63, `0x3210`), `0x5b7a..0x5c92` does three `0x10320` blits from the chrome
template `a4@(1934)`: rect-list entries of type 5 and type 6 (`0x6582(5)`,
`0x6582(6)`, each offset relative to `0x6582(0)`), and a 15×15 corner at the
bottom-right of `0x6582(0)`. These use raw rects, not `0x5cb6`, and are not
types 1–3, so the close/collapse conclusion holds. The `0x5b5a..0x5b78` call
(`!a4@(510) && 0x489c` → `0x480a`/`0x45b2`) is untraced.

## 4. (b) `0x5cb6` when a code-10 cell collapses

`0x5cb6(rect)` (frame `0x5d2e..0x5d46`) calls
`0x5356(side d6, seg d3, a2 = fp@(-8), a3 = fp@(-16), …)`. That makes
`fp@(-8)` the **template** cell and `fp@(-16)` the **placed** cell (`0x5362`,
`0x5366`, `0x53be..0x53e6`).

- The search order is side 0, 1, 2, 3 (top, bottom, left, right, per the
  `0x5356` cross-axis cases), then segments 1..N (`0x5d26`). The leading
  `[0, border[0])` region is never a candidate.
- topLeft: the first template cell containing it (`PtInRect`, half-open,
  `0x5d4a..0x5d5a`) translates `rect.top/left` by that cell's
  (placed − template) (`0x5d60..0x5d74`).
- botRight − 1 (`0x5d04..0x5d08` decrement a copy): the first containing cell
  translates `rect.bottom/right` by its own delta (`0x5d78..0x5da4`). The two
  corners are matched **independently**.
- If either corner matches nothing, the rect is emptied (`0x5dc6..0x5dd0`).

A collapsed code-10 cell keeps its **template** rect, so it still matches. The
widget rect is translated, not shrunk. Its leading edge lands at the collapse
point, `destBorder[i−1]`, at full template size. It overlaps whatever placed
cells follow. A rect that straddles a border gets a different delta per corner
and changes size. No corpus widget straddles a code-10 border (§6).

## 5. (c) The state-0 template blit

`0x6062(part, state, entryRect)` has three source paths:

| condition | source | lines |
|---|---|---|
| part ∈ {5,6} and `a4@(502)` | `GetCIcon(base+1)`. If missing and `a4@(507)`, `base−7`. src = rect at origin, `+height` if state≠0, `+width` if `a4@(503)` | `0x60aa..0x614e` |
| state ≠ 0 | `GetCIcon(base)` (`−8` fallback if `a4@(507)`). Pressed strip laid out horizontally: close at x=0, zoom at w(close), collapse at w(close)+w(zoom) (`0x6582(1)`/`0x6582(2)` widths). `+height` row if `a4@(510)` and the cicn holds two rows | `0x6158..0x62ee` |
| state = 0 (and not the first row) | **the chrome template `a4@(1934)` itself**, src = raw entry rect | `0x62f0..0x6318` |

In every path, dst = `0x5cb6(entryRect)` (`0x6138`, `0x62b0`, `0x6308`), and
there is one `0x10320` blit. `base = −14330`, +32 if `a4@(506)`, +8 more if
`a4@(507)` (`0x607a..0x608e`).

So the template art of a collapsed cell **is** redrawn at the widget's
remapped rect, but only by `0x632e`. During a full draw that happens only for
part 5 under `a4@(502) && a4@(508)`, and only when cicn `base+1` is missing
(`0x60e4` → `0x6158` → `0x62f0`). Collapse and close are redrawn only on
param-9 or param-4 highlight draws. The pressed (state 1) draw comes from the
widget cicn. The release (state 0) re-blits the template's widget pixels at
the collapse point, over the neighbouring cells. Hit testing, on the other
hand, still works:
`0x41be` → `0x487e` (`a4@(500) && a4@(505) && !a4@(496)`) → `0x5ffc(pt,3)` →
`0x5ddc`, which uses the same `0x5cb6` remap (`0x5f72`). Step 2.4 clears
`a4@(500)` only when the side is too short even after dropping code 10.
Otherwise a collapsed code-10 collapse box stays hit-testable while it is
invisible. That follows from the listing. It has not been seen running.

## 6. (d) Flags

Set in the precompute `0x2e02`. The clear block is `0x2e0a..0x2e4a` (508 and
510 are assigned, not cleared: `0x2e52`, `0x2e62`), and
the per-procID table at `0x2e6c` is decoded with helper `0x148` (offsets
relative to each offset word).

| flag | set when | used by (includes; not exhaustive) |
|---|---|---|
| `a4@(502)` | procID 1026–1029 (`0x2fba`, `0x2fe8`, `0x3010`, `0x3038`); families 66/67 with variation 4..11 (`0x3194`) | `0x6062` part 5/6 alt cicn; `0x5a28` gate |
| `a4@(503)` | procID 1026/1027 (`0x2fc0`, `0x2fee`); families 66/67 with variation 4..7 (`0x31a8`) | `0x6062` column offset (+width) |
| `a4@(506)` | family 66/67 (`0x3132`), family 124 (`0x31ba`) | widget cicn base +32; title text style (`0x4f0e`) |
| `a4@(507)` | family 67 (`0x3150`); family 124 with variation bit 3 (`0x31fe`) | base +8 with −8 fallback; `0x572e` sides 2..3 when `a4@(510)` |
| `a4@(508)` | `WindowRecord+111` (`0x2e52`); forced for 66/67/124 when variation bit 0 is clear (`0x315e`, `0x31d4`) | `0x5a30` gate; widget hit-tests `0x4124`; also `0x334a`, `0x3386`, `0x3db0`, `0x3fa6`, `0x45be` |
| `a4@(510)` | result of `0xf078(window)` (`0x2e62`); cleared for family 63 (`0x3216`) | `0x572e` side range (`0x58c0..0x58d4`); `0x6062`/`0x5ddc` second-row offset |

ProcIDs 1026–1029 are the vertical/horizontal-zoom document variants, so
`a4@(502)` means a **partial-zoom** variant. Treat that reading as an
inference from the Appearance procID numbering. In the classic `WindowRecord`
layout, offset +111 is `hilited` (+110 visible, +112 goAwayFlag, read at
`0x4a1a`; +114 strucRgn is read at both `0x5760` and `0x5a56`). So
`a4@(508)` behaves as **"draw active"**, not "grow box" as reference §3.3
says. That part is an inference from the struct layout. The listing shows only
the `+111` read. `0xf078` and the exact meaning of `a4@(510)` were not traced.

## 7. Corpus (20 code-10 cells, all 13 wnd# archives)

Lane K's `scripts/scan-code10.mjs` produced this table. The scan assumes all
widgets are present, as `widgetPresent` does: 2/3/4 count as fixed and
15/16/17 as non-fixed. *Shrink* is the number of pixels the content can lose
on that axis, relative to the template, before code 10 collapses: collapse
when the content shrinks by more than this.

| archive | window type | side | src span | shrink | rect-list overlap |
|---|---|---|---|---:|---|
| 1138 | titled-utility / collapsed-titled-utility | top | [38,48) | 10 | part-3 (collapse) [39,5,47,13] |
| 1138 | no-title-utility / collapsed-no-title-utility | top | [30,40) | 3 | part-3 [31,4,39,12] |
| 1138 | side-floating-utility / collapsed-side-utility | left | [29,39) | 3 | part-3 [4,30,12,38] |
| 1984 | document / collapsed-document | bottom | [41,75) | 1 | — |
| 1984 | document | right | [28,64) | 1 | — |
| 1984 | titled-utility | top / bottom | [19,35) / [7,54) | 6 / 1 | — |
| 1984 | side-floating-utility / no-title-utility | right / bottom | [7,34) | 1 | — |
| animals | document / collapsed-document | bottom | [31,44) | 35 | — |
| animals | titled-utility | top | [209,220) | 164 | part-3 [209,55,220,66] |
| apple-lisa | titled-utility | top | [30,42) | 5 | part-3 [32,3,41,12] |
| apple-lisa | no-title-utility / side-floating-utility | top / left | [27,38) | 5 | part-3 |
| windows-95 | side-floating-utility | left | [29,40) | 2 | part-3 [5,29,15,40] |

Every widget that overlaps a code-10 cell is the rect-list **type 3 (collapse)**
widget, and it sits wholly inside that cell. So code 10 is the utility-window
collapse-box cell, plus 1984's long plain bar runs, and those are the first
things dropped when the window is too short.

## 8. Runtime gap before this change (origin/main 4433ddfb, not fitted)

- `classifyPart` treats code 10 as FIXED (`src/composeChrome.ts`). That
  matches the decode at every size ≥ template. Below the minimum,
  `distributeHalf` keeps the fixed cells and zeroes the growers. It runs
  neither step 2.3 nor step 2.4.
- `resolveTitleWidgetRects` (`src/renderWindow.ts`) maps only the x of topLeft
  through **top-edge** placements, inclusive at both ends. It keeps the
  template y. It ignores the left, right and bottom sides, the independent
  bottom-right corner and the empty-on-miss rule. Lane K's probe
  (`probe-widget-rects.out`) shows this. In 1138 side-floating-utility at
  content +50 the left code-10 cell is placed at y=83, but the runtime's
  collapse rect stays at y=30. apple-lisa: cell y=77, rect y=29. Only the hit
  and press rects are wrong. The baked art is drawn in the right place.
- The probe also shows 1138 side-floating's left code-10 cell at y=33 when the
  window is exactly template size (template y=29). That side has border[0]=5,
  and the trailing `[lastAt, H)` interval is handled separately. This matches
  Lane D's open "trailing vertical regions" unknown and was not traced here.
- In 139 of 510 corpus sides, border[0] > 0. `0x572e` and `0x5cb6` both start
  at segment 1. The runtime draws `[0, border[0])` as a 1:1 corner. Whether the
  kDEF covers that region through the crossing side was not traced.

## 9. Implementation spec (implemented: `negotiateSides` in `src/composeChrome.ts`, `resolveTitleWidgetRects` in `src/renderWindow.ts`)

1. **Per-side too-small negotiation** in `composeEdge`/`distributeSide`,
   before distribution. Use segments 1..N only, never the leading region or the
   far cap.
   - `fixed0` = Σ src width of the codes that are fixed under flag 0: 1, 7, 9,
     10, other defaults, 2/3/4 when the widget is present, and 15/16/17 when it
     is absent.
   - `extent` = (srcBorder[N] − srcBorder[0]) + (content dimension − template
     content dimension) on that axis.
   - If `extent < fixed0`: code 10 → width 0, 5/6 → width 0, title width 0,
     and `fixed0 −= Σcode10`.
   - If still `extent < fixed0` and `shadeGap = Σcode4 − Σcode17` (shade widget
     present) is > 0: mark the shade widget absent. That makes 4 → 0 and
     17 → fixed for this side and the later sides, in order top, bottom, left,
     right. Then `fixed0 −= shadeGap`.
   - Growers then share `extent − fixed0` as now.
   - Skip all of this on the popup-family title path (§2 exception).
2. **No widget stamp.** A collapsed cell draws nothing, as at `0x5990`. Do not
   re-add baked widget art in the full draw. The `0x5a3c` partial-zoom pass is
   a separate, unimplemented gap: the runtime does not model procIDs
   1026–1029.
3. **General `0x5cb6` remap** in place of `resolveTitleWidgetRects`'
   top-edge x shift. Build each drawn segment's 2-D template rect and placed
   rect for all four sides; the cross axis comes from `0x5356`. For each
   rect-list widget, apply §4: first match in side then segment order, corners
   matched independently, empty on a miss. Exclude the leading corner and the
   far cap. Hit testing and press feedback should both use it.
4. **Policy (PM decision, maintainer may override):** follow the decode. An
   invisible collapse box in a dropped code-10 cell stays hit-testable unless
   step 2.4 cleared `a4@(500)` (`ComposedChrome.shadeCleared`), which removes
   the collapse hit (`0x41be`). Recorded in the faithfulness ledger.
5. Synced alongside: reference §1.4 (`0x4a64`, `0x4f58`, `0x5178`, `0x572e`
   rows), §3.3 (`a4@(508)`) and §4.2, the compositor-spec code-10 row and note,
   the faithfulness-ledger `0x4a0c` and widget-pass rows, and the
   `window-chrome-rules.mjs` class comment.
6. Approximations kept (recorded in the ledger row): widget presence is the
   runtime's single `widgetPresent` flag; after a title drop the titled-half
   split keeps the runtime's undecoded split; renderWindow's title text for a
   dropped title is unchanged (`0x5530` not traced for this case). The popup
   exception is keyed on the `popup-window` request (service slot 8, procID
   family 63).

## 10. Checker and golden impact (measured on this branch)

- `window-chrome-rules` now samples content offsets {−12,0,1,2,7,97} ×
  {−12,0,1,33}. `sideTooShort` derives the verdict from the recipe (widget-gated
  codes bound `fixed0`; undetermined → code 10 unknown). Code 10 is asserted
  fixed at and above the template and width 0 when the verdict holds; all 13
  archives pass in Node and source/built. The old `todo` (`[18,0,2]` at width
  20) is replaced by the sourced traces `[14,4,2]` (width 20) and `[3,0,2]`
  (width 5), a boundary case (`[0,4,2]` at width 6, `bges`), and checker
  mutations (code 10 kept below, dropped above).
- Chrome pixels (`scripts/pixel-diff.mjs`, 33,396 compositions: 13 archives,
  every sliced type, both states, offsets {−40,−12,−6,−2,−1,0,1,2,7,33,97}²):
  **0 compositions change at or above the template.** 2,112 below-template
  compositions change (688,743 px). Every changed type has a dropped code-10
  cell, a dropped 5/6 title run or a cleared shade gap (codes 4/17); see
  `pixel-diff.out` in the lane store.
- Scene captures (`verify:scenes`) are byte-identical between this branch and
  origin/main (both drift from the committed baselines in this environment, all
  18 including corner-sprite schemes, so that drift is pre-existing). The
  rendering-options goldens are control-matrix pages with no windows.
- Hit/press rects: 650 of 3,450 sampled compositions (28 window types) change
  under the general remap (`diff-widget-rects.out`). Beyond the vertical-side
  growth fix, the old top-edge lookup's **inclusive** cell end attributed a
  widget starting exactly on a border to the previous cell (e.g. windows-31
  document zoom at x=66 instead of x=85, where its art is drawn), and side-only
  widget windows (collapsed side utilities) had no rects at all. No chrome
  pixel moves; only overlays, press darkening and title clipping inputs change.
  Not every move is a decoded correction: at template size with no title, 22 of
  138 window types already have rects off their template rects, because the
  runtime's existing placement is not the identity there (e.g. 1138
  side-floating close y 7→6, zoom 19→23; windows-31 side-floating zoom 40→16).
  The rects now follow the drawn art by construction, but are only as faithful
  as that placement, which includes the open border[0] and trailing-region
  questions (§8). The remap spec checks plumbing against the runtime's own
  placement, not placement fidelity.
- Known overlap (follow-up): at template width the WindowManager grow-box
  overlay covers the left-edge collapse overlay of 1138's side-floating utility
  window, so a click there resolves to the grow box. The remap spec uses
  windows 60px wider to test the remap itself.

## 11. Confidence and unknowns

- High: the two-byte `0x5178` frame, the `fp@(-3)` too-small source, the
  `0x4216` dispatch, the `0x5a28` gate, the `0x5cb6` mechanics and the
  `0x6062` paths. Each was read instruction by instruction above.
- Medium: the flag meanings in §6 (procID family names, `hilited`), the "still
  clickable" consequence, and the corpus thresholds (they assume all widgets
  present).
- Resolved by the PR #377 review: the `a4@(500)` clear is not sticky. The WDEF
  entry `0x28e0` calls `0x2e02` on every message except 1000/1001
  (`0x2910..0x291e`); `0x2e02` resets `a4@(500)` from the procID table and then
  runs the per-side layout itself (`0x3826..0x38c2` → `0x4a64`, before its `rts`
  at `0x38c8`). So the clear is recomputed for every call, including wHit
  (`0x3f2c` → `0x41be` → `0x487e`): the collapse hit is absent exactly when the
  current geometry clears the gap. `a4@(513)` is a pre-layout copy (`0x321a`)
  used by `0x29f2`.
- Unknown: `0xf078` / `a4@(510)`; `0x5b5a..0x5b78`; the coverage of the border[0] region; the trailing
  `[lastAt, extent)` handling; no native capture of any below-minimum window.
