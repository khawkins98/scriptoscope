# `window.layout` + `window.widgets` — evidence appendix (never read by implementers)

Evidence for [window-widgets.md](window-widgets.md). Static reading of the raw
2.3.1 `kDEF 0` listing only; no original code was executed. Trap identities are
from the pinned Apple Universal Interfaces 3.0.1 `Traps.h`.

Part A is the 2026-10-21 decode note (`docs/spec/kdef231-code10-widgets.md`,
lane K, PR #377) moved here verbatim from its §0 onwards; its section numbers
are kept. Part B (§R) is the 2026-10-22 re-trace by the L2 split lane, with a
mark on every claim, and the new traces behind the three corrections. Where
Part A and Part B disagree, Part B and the spec win.

---

# Part A — 2026-10-21 decode note (moved verbatim)

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

---

# Part B — §R re-trace, 2026-10-22 (L2 split lane, spec writer)

Listing: `.scratch/k231-kdef/kDEF/k231-kdef0.asm` (33,999 lines), navigated by
hand. Marks are the spec writer's own re-trace; an independent verifier has
not yet marked them.

## R1. Marks on Part A

| Part A claim | mark | note |
|---|---|---|
| §0/§1: `0x5178` frame, `fp@(24)` = too-short byte read at `0x52fc`, `fp@(26)` = 5/6 gate at `0x530c`; gate pushes `#1` (`0x4db4`, `0x4dd4`), `fp@(-290)` (`0x5100`, `0x5120`), `clrb` (`0x5148`); `#1` at `0x515e` is the first-segment word; `fp@(-3)` pushed at `0x4db8`, `0x4dd8`, `0x5104`, `0x5124`, `0x514a` | CONFIRMED | push order gate, flag, required, growers, last, first, dest, source; `link fp,#-4` at `0x5178` |
| §1: `0x49d6` table at `0x49e4`, default `0x4a5e`, code 10 → `0x4a0c` | CONFIRMED | `0x148` sparse switch: default `0x007a`, range `0..0x11`, count−1 `7`, then (key, offset-from-offset-word) pairs: 0→`0x4a12`, 2→`0x4a16`, 3→`0x4a24`, 4→`0x4a2e`, 10→`0x4a0c`, 15→`0x4a3a`, 16→`0x4a48`, 17→`0x4a52` |
| §2: callers `0x3866`/`0x3888`; `fp@(8)` source `a4@(2788)+162·side`, `fp@(12)` dest `a4@(2140)+162·side`, `fp@(16)` `0x6582(0)`, `fp@(20)` the `0x4778` rect, `fp@(24)` `#1` sides 0/1, `clrb` sides 2/3 | CONFIRMED | `0x384e..0x3888` |
| §2.1 first pass `0x4af8..0x4be0`: `fp@(-16)`, `fp@(-30)`, `fp@(-6)` (code 4 add / code 17 subtract, both under `0x487e`) | CONFIRMED | `0x4b64..0x4bd2` |
| §2.2 placed ends `0x4be4..0x4c60` | CONFIRMED | `fp@(24)`≠0: rect `+2`/`+6` (left/right); else `+0`/`+4` |
| §2.3 `0x4dfe..0x4e20` (ledger-pinned) | CONFIRMED | `bges 0x4e46` at `0x4e0c` (signed) |
| §2.4 `0x4e24..0x4e42` | CONFIRMED | `bges` at `0x4e32`, `bles` at `0x4e38` (`fp@(-6) ≤ 0` skips) |
| §2.5 code 10 with flag 1 → width 0 | CONFIRMED | `0x52fc..0x530a` with `d6` cleared at `0x5260` |
| §2 popup exception `d4 && a4@(509)` at `0x4c64` | CONFIRMED | the popup path returns via `0x4dfa` `braw 0x5170` before `0x4dfe` |
| §3 `0x4216` dispatch, table `0x4270`/`0x4278`, toggle `0x42ae..0x42c8`, clear `0x4242..0x4254` | CONFIRMED | table words `0x14,0x36,0x36,0x36,0x2a,0x2a,0x2a,0x36,0x36,0x2a` for params 0..9; params > 9 skip via `bhis 0x42ae` |
| §3 `0x5990..0x59a6` skip, `0x5a28..0x5a3c` partial-zoom gate | CONFIRMED | skip compares the PLACED rect (`fp@(-8)`) |
| §3 family-63 block `0x5b7a..0x5c92` | PARTLY | three `0x10320` calls (`0x5bd8`, `0x5c34`, `0x5c92`), types 5 and 6, `moveq #-15` at `0x5c4c`/`0x5c56`; the destination offset rect `fp@(-24)` was not traced |
| §4 `0x5cb6` search order, independent corners, empty on miss | CONFIRMED | |
| §4 "botRight − 1 … translates `rect.bottom/right` by its own delta"; "A collapsed code-10 cell … the widget rect is translated, not shrunk … at full template size" | **REFUTED** | see R2 |
| §5 `0x6062` three paths, base id, `0x10320` blits | CONFIRMED | `+8` is nested under the `a4@(506)` test (`0x607e..0x608e`) |
| §5 "Hit testing … still works: `0x41be` → `0x487e` → `0x5ffc(pt,3)` → `0x5ddc`, which uses the same `0x5cb6` remap" | CONFIRMED as a call chain; **REFUTED** as "still hit-testable while invisible" | the remapped rect is empty (R2), and `0x5ddc` also needs the widget cicn and its region (R4) |
| §6 flag set sites `0x2fba`, `0x2fc0`, `0x2fe8`, `0x2fee`, `0x3010`, `0x3038`, `0x3132`, `0x3150`, `0x315e`, `0x3194`, `0x31a8`, `0x31ba`, `0x31d4`, `0x31fe`, `0x2e52`, `0x2e62`, `0x3210`, `0x3216` | CONFIRMED (each writes the named flag) | the per-procID key mapping was checked for 1026–1029 only: table at `0x2e6c`, keys `0x0402..0x0405` → `0x2fae`, `0x2fd6`, `0x3004`, `0x3026` |
| §6 `a4@(510)` "not traced" | NARROWED | `0xf078`: Gestalt(`appr`) → `$AA74` selector 16, else `$AA42` GetAuxWin and a flag bit; `0x4778` zeroes the content rect's height (width under `a4@(507)`) when set (`0x47ea..0x4802`). Read as "collapsed" (inference) |
| §7 corpus table (20 cells, shrink values) | CONFIRMED | recomputed from the recipes (lane store `v2-lanes/L2-split/scan-shrink.out`) |
| §11 "the `a4@(500)` clear is not sticky … recomputed for every call, including wHit" | **REFUTED in part** | the clear is reset every message, but the layout that would re-apply it is skipped on a cache hit (R3) |

## R2. Remap far edge (`0x5356`, `0x5cb6`)

`0x5cb6` builds `fp@(-32)` = `0x4778` content rect, `fp@(-40)` = `0x6582(0)`
body rect, `fp@(-48)` = `(*a4@(1934))+6..+13` (the chrome cicn's bounds), then
for each side `d6` and segment `d3` pushes `pea fp@(-32)`, `pea fp@(-48)`,
`pea fp@(-40)`, `pea fp@(-16)`, `pea fp@(-8)`, `movew d3`, `movew d6` and calls
`0x5356` (`0x5d2e..0x5d46`). `0x5356` saves six registers (24 bytes), so
`sp@(28)` = side, `sp@(30)` = segment, `sp@(32)` → `a2` = `fp@(-8)`,
`sp@(36)` → `a3` = `fp@(-16)`, `sp@(40)` → `d5` = body rect,
`sp@(44)` → `d7` = bounds, `sp@(48)` → `d4` = content rect (`0x535a..0x5372`).
Side 0 (`0x538e..0x53ec`) writes `a2@` = 0, `a2@(4)` = body.top, `a3@(4)` =
content.top, `a3@` = `a3@(4) − a2@(4) + a2@`, and `a2@(2)`/`a2@(6)` from the
source list `a4@(2788)`, `a3@(2)`/`a3@(6)` from the dest list `a4@(2140)`. So
`fp@(-8)` is the **template** cell and `fp@(-16)` the **placed** cell. Sides
1–3 (`0x53f0`, `0x5458`, `0x54c2`) as in spec CR2–CR4.

Corner deltas: top-left (`0x5d60..0x5d74`) adds `fp@(-14) − fp@(-6)`
(placed.left − template.left) to `a2@(2)` and `fp@(-16) − fp@(-8)` (top) to
`a2@`. Bottom-right (`0x5d8c..0x5da0`) adds `fp@(-10) − fp@(-2)` (placed.right −
template.right) to `a2@(6)` and `fp@(-12) − fp@(-4)` (bottom) to `a2@(4)`. The
bottom-right corner therefore follows the cell's far edge. For a code-10 cell
dropped to width 0, `placed.right = placed.left = P[i−1]` and
`template.right = S[i]`, so the widget's right edge moves by
`P[i−1] − S[i]` while its left moves by `P[i−1] − S[i−1]`: the width shrinks by
`w(i)`. The corpus collapse boxes are 8–11 px long inside 10–12 px code-10
cells (spec §6.2; animals and windows-95 fill their cell exactly), so each
becomes empty (length ≤ 0).

## R3. Layout cache (`0x3746..0x38a8`, `0x38fe..0x39d8`)

`0x3746`: `a2` = `WindowRecord+130` (dataHandle); `0x374e` `0x4778` → `fp@(-16)`.
`0x375c..0x376a`: unless `(*a2)+36` = `'wnd#'` (`0x776e6423`) `a2` is zeroed.
`0x376c` `cmpiw #2,a4@(464)` (the message) `beqw 0x3814`; `0x3776` `a2` null →
`0x3814`; `0x377c..0x378c` `$A8A6` EqualRect(`(*a2)+40`, `fp@(-16)`), false →
`0x3814`. Otherwise `0x3790..0x380e` copies four 162-byte lists from
`(*a2)+48+162·side` into `a4@(2140)+162·side` and `0x3810` `braw 0x38c2`
(the routine's exit), skipping the `0x3826` side loop that calls `0x4a64`.
`0x3814..0x3820` stores the rect at `(*a2)+40`; `0x3892..0x38a8` stores each
side's dest list after `0x4a64`. The tag is written only by the window-creation
handler `0x38fe` (dispatch case 3) at `0x39d2`, inside the `tstb a4@(501)` block
that starts at `0x397c`; the 696-byte handle (`0x3962` `$A122` NewHandle) is
stored at `WindowRecord+130` (`0x396c`). `a4@(500)` is cleared at `0x2e26` and
set only by the per-procID table (`0x2ee6..0x31c0`); the only other write is
`0x4e3a`. `0x2e02` is called for every message except 1000/1001
(`0x2910..0x291e`) and runs to `0x38c8` with no other return.

## R4. Widget hit (`0x5ddc`)

`0x5de8` no chrome template → 0. `0x5df6..0x5e0a` base −14330 (+32, +8 as in
`0x6062`). `0x5e0c..0x5e24` Gestalt(`Copl`) (`$A1AD`), `$A994` CurResFile saved,
`$A998` UseResFile. `0x5e26..0x5e42` `$AA1E` GetCIcon(base), −8 fallback under
`a4@(507)`; null → `0x5fee` (restore, return 0). Selector switch
`0x5e4a..0x5e5a`: 0 → `0x5e5e` (source at origin, `$A8A8` OffsetRect), 1 →
`0x5e8c` (+ width of `0x6582(1)`), 3 → `0x5ee8` (+ widths of `0x6582(1)` and
`0x6582(2)`). `0x5f6e` `0x5cb6(fp@(-16))`. `0x5f76..0x5f96` second row under
`a4@(510)`. `0x5f98` `$A8D8` NewRgn, `0xf6e0(cicn, rgn)`, `$A8E0` OffsetRgn by
(placed − source) top-left, `$A8E8` PtInRgn, then `$A8AD` PtInRect(pt, placed);
both true → 1. `$A8D9` DisposeRgn, `$AA25` DisposeCIcon, UseResFile restore.
`0x5ffc` maps selector 0/1/3 to entry type 1/2/3 and walks `a4@(1938)` entries
(10 bytes: type at +2, rect at +4) from the last down (`0x6020..0x6056`).
`0x632e` is the same walk for the draw (`0x635c..0x6386`).

Hit dispatch `0x411c..0x41e4`: `tstb a4@(505)` clear → 1; `tstb a4@(508)`
clear → 2; `a3@(112)` (goAwayFlag) and `0x5ffc(pt,0)` → 4; exact-point
fallbacks at `0x414a..0x4164` and `0x4194..0x41bc` (point compared with
`fp@(-16)+(12,16)` and `fp@(-16)`/`fp@(-10)` offsets; not decoded); `a4@(501)`
and `0x5ffc(pt,1)` → `0x466e` ? 5 : 6; `0x41be` `0x487e` and `0x5ffc(pt,3)` → 9;
else 2. `0x487e` = `a4@(500) && a4@(505) && !a4@(496)` (`0x4880..0x4896`).
`a4@(496)` set at creation clears `goAwayFlag` (`0x3958..0x395e`).

## R5. Titled side (`0x4e46..0x5146`) and allocation budget (`0x5180..0x51c6`)

`0x4e46..0x4e50`: `d4` (anchor) and `fp@(24)` (axis) both nonzero, else
`0x5148`. `0x4e54..0x4eec`: `fp@(-14)` (before) and `fp@(-12)` (after) summed
with `0x49d6(code, fp@(-3))` and the {8,11,18,12,13,14} exclusions only, split
at `d4` (`bges`/`bles` at `0x4eb8`/`0x4ece`). `0x4eee..0x4f02`: room =
dest[N] − dest[0] − before − after, `bges 0x4f46` when room ≥ `fp@(-2)`.
`0x4f04..0x4f42`: `d3` = `$A88C`; `$A888` TextFace 33 (`a4@(506)`) or 32;
`d5` = `$A88C`; TextFace 1 or 0; `fp@(-2) −= d3 − d5`. `0x4f46..0x4f62`: room
recomputed, `cmpiw #2` / `bgts 0x4f66`, else `fp@(-290)` and `fp@(-2)` cleared.
`0x4f66..0x4fa4`: when the length byte is 0, dest code at `d4+1` = 6 →
`fp@(-12) −= S[d4+1] − S[d4]`; at `d4−1` = 6 → `fp@(-14) −= S[d4−1] − S[d4−2]`.
`0x4fa8..0x4fcc`: dest[`d4−1`] = dest[0] + before; dest[`d4`] = dest[N] − after.
`0x4fd0..0x5046`: both counts nonzero and before > after → centre
`(C.left + C.right)` (32-bit) halved with the `lsrl` sign trick + `asrl #1`,
minus half of `fp@(-2) + fp@(-296) − S[d4−1] + fp@(-298) − S[d4]`
(`fp@(-296)`/`fp@(-298)` = T4 left/right copied at `0x4adc..0x4aee`); raise
dest[`d4−1`]; cap dest[`d4`] at dest[`d4−1`] + `fp@(-2)`. `0x5048..0x50ba` the
other case (16-bit halving at `0x5086..0x508e`). `0x50be..0x50fa` title width
negative. `0x5100..0x513c` the two `0x5178` calls (first `#1`, last `d7` =
`d4−1`; first `d4+1`, last `a3@`).

`0x5180..0x519c`: budget `fp@(-2)` = dest[`fp@(18)`] − dest[`fp@(16)`−1] −
`fp@(22)`, with no clamp. `0x51a4..0x51b0` skip the first pass when the count
`fp@(20)` or the budget is 0 (`d5` stays −1). `0x51b4..0x51c6` `divsw`
(truncating, remainder sign of dividend) gives the primary share and the
remainder `d4`. A negative budget therefore gives negative shares.

## R6. Corpus scans (lane store, theme recipes only)

`v2-lanes/L2-split/scan-widgets.mjs` (`scan-widgets.out.json`): 20 code-10
segments, 0 sides with a 5/6 segment off a titled horizontal side, 0 unsorted
side lists, 211 widget entries with every corner in a code 1/2/3/4/10 segment,
the 11 in code 10 all collapse boxes. `scan-shrink.mjs` (`scan-shrink.out`):
the §7 shrink values.

---

# Part C — window-migration answers, 2026-10-22 (spec writer)

Listing: the same `k231-kdef0.asm`, navigated by hand. Corpus scans read only
the theme-loader's decoded recipes, rect lists and chrome cicn pixels (scripts
and outputs in the lane store `v2-lanes/window-widgets-answers/`). No tooling
was run over the original binaries. Marks are the spec writer's; an
independent verifier has not marked them.

## C1. LS9: the side span ends at `P[N]` (question 1, F9)

`0x4be4..0x4c60`: with the axis byte `fp@(24)` set, `a3@(4)` (dest border 0)
= `a2@(4)` + `fp@(20)`→`+2` (content left) − `fp@(16)`→`+2` (body left); dest
border `N` (`a3@(4,N:l:4)`) = `a2@(4,N:l:4)` + content `+6` (right) − body
`+6`. Clear: `+0`/`+4` (top/bottom). These are the only writes to dest borders
0 and `N` in `0x4a64`. The AP3 call `0x5148..0x5166` pushes first = 1, last =
`a3@` (= `N`), required `fp@(-16)`; `0x5178` budget `0x5180..0x519c` =
dest[last] − dest[first−1] − required = `P[N] − P[0] − F`, and the walk
`0x532e..0x534a` writes dest borders `first..last` only. AP2: TT5
`0x4fa8..0x4fcc` reads dest[0] and dest[`N`]; the two `0x5178` calls cover
`1..d4−1` and `d4+1..N`. The full draw `0x5938..0x59f8` walks segments `1..N`
and builds each cell with `0x5356` from the dest borders. No other code
reaches past dest[`N`]. CONFIRMED. The runtime cross-check is
`src/composeChrome.ts` `composeEdge`/`distributeSide` on origin/v2:
`distributeHalf(cells, 0, n, outExtent − srcStart)` with `outExtent` the full
window width/height (`fullW = frame.left + contentW + frame.right`, frame from
`drawableExtent`), plus the horizontal far-edge cap.

## C2. TT10: untitled windows (question 3)

`0x4a94..0x4aa6`: GetWTitle into `fp@(-290)`, StringWidth into `fp@(-2)`; an
empty title gives length byte 0 and width 0 with no drop. LS6 `0x4b20..0x4b3a`
then leaves `fp@(-2)` = `(S[i] − T4.right) + (T4.left − S[i−1])`. TT4
`0x4f66` tests the length byte itself (`tstb fp@(-290)`), so it fires for an
empty title. The TT9 calls push `fp@(-290)` as the gate (`0x5100`, `0x5120`),
read at `0x530c`: zero → codes 5/6 width 0 (`0x5312..0x531c`). The anchor cell
is outside both calls; TT6 `0x5034..0x5042` caps dest[`d4`] at dest[`d4−1`] +
`fp@(-2)`, TT7 `0x5094..0x50ba` the same from the other side. TT8
`0x50be..0x50fa` runs when `fp@(-2)` < 0. CONFIRMED. Corpus (`scan2.out`): 83
anchored sides, plate widths 0 ×63, positive ×10, negative ×10.

## C3. TT2: condensed width (question 4)

`0x4f04..0x4f42`: `d3` = StringWidth (current face); TextFace 33 or 32
(`a4@(506)`); `d5` = StringWidth; TextFace 1 or 0; `fp@(-2) −= d3 − d5`.
CONFIRMED. The value of `d5` is the Font Manager's; nothing in the kDEF
computes it. TT2a is a declared default from Apple's documented synthetic
condense, not an observation.

## C4. PP1–PP7: popup placement (question 5)

`0x4c64..0x4c6e`: `d4` (anchor) and `a4@(509)` (family 63), no axis test.
`0x4c72..0x4c8c`: window `+130` (dataHandle) dereferenced; `fp@(-326)` = word
at `+22`, `fp@(-330)` = long at `+16`. `0x4c92..0x4cbc`: long `+16` = −2 →
`d0` = `fp@(-326)` halved (`lsrw #8`, `lsrw #7`, add, `asrw #1`: truncation
toward zero), `d1` = word `+26` − content left + 4 − `d0`; else `0x4cbe`
`d0` = `fp@(-328)` (the low word of the `+16` long, offset 18). Result →
`fp@(-316)` (`X`). `0x4cc6..0x4d5c`: `fp@(-32)` (before) and `fp@(-34)`
(after) summed over `0x49d6(code, fp@(-3))` keep and not {8,11,18,12,13,14};
`fp@(-3)` is 0 here (the step at `0x4dfe` has not run). `0x4d5e..0x4d86`:
dest[`d4−1`] = content left + `X` + 10 + `S[d4−1]` − `fp@(-296)` (T4 left).
`0x4d8a..0x4db0`: dest[`d4`] = content left + `X` + `fp@(-326)` − 10 + `S[d4]`
− `fp@(-298)` (T4 right). `0x4db4..0x4df0`: two `0x5178` calls, gate `#1`,
flag `fp@(-3)`, required `fp@(-32)`/`fp@(-34)`, growers `fp@(-18)`/`fp@(-20)`,
ranges `1..d4−1` and `d4+1..N`. `0x4dfa` returns. CONFIRMED.

Creation: `0x38fe` (`wNew`, dispatch case 3). `0x390a` `tstb a4@(509)`;
`0x3910..0x3916` NewHandle(28) stored at window `+130`; `0x3920..0x3950`
writes long 0 at 0, 4, 8; long 10312 at 12; long 0 at 16; long 33 at 20; word
0 at 26 and 24; `0x3954` returns to the dispatcher. So `pdMode` 0, `pdX` 0,
`pdLen` = low word of 33 = 33, `pdCentre` 0. Writers after creation: none in
`0x4a64`, `0x38fe` or the message 1000/1001 handlers (`0x2dbc..0x2dd6`, which
call `0xee7a`/`0xef8a` and `0xeeb2`/`0xf010` without the window). Not searched
beyond these: Q10. The cache tag test at `0x375c` reads `+36`, past the
28-byte block; its outcome there is not decoded (it would need heap contents).

Corpus: `popup-window` has a code-5 top anchor in all 13 `wnd#` archives
(`c5.mjs`).

## C5. WD13, HT8: blit and hit region (question 6)

Calls in `0x6062..0x638e` (a plain text search of the existing listing):
`0x6146`, `0x62e0`, `0x6318` are each `bsrl 0x10320` (scale blit), after
`0x5cb6` at `0x6138`, `0x62b0`, `0x6308`. qd-primitives SC3/SC4 give the
transfer. `0xf6e0`: `0xf30a` (pixmap lock), `$A8D7` BitMapToRegion(rgn,
`(*cicn)+50`) — `+50` is the CIcon's `iconMask` BitMap after the 50-byte
`iconPMap` — and on a nonzero result `$A8DD` SetEmptyRgn; `0xf35e` unlock.
`0x5f98..0x5fbe` (in `0x5ddc`): NewRgn, `0xf6e0`, `$A8E0` OffsetRgn by
(placed left − source left, placed top − source top) from `fp@(-14)`−`fp@(-6)`
and `fp@(-16)`−`fp@(-8)`; no MapRgn. CONFIRMED.

## C6. TT4a (question 7)

`0x4f6c..0x4f7a` reads the code at dest `+2 + 4·(d4+1)`; `0x4f88..0x4f96` at
`+2 + 4·(d4−1)`. Dest codes are written only for entries `1..N` (`0x4b14`
copies the source long at entry *i* for *i* = 1..`N`); `0x4a88` writes the
count, `0x4bfe` border 0. For `d4 = 1` the read is entry 0's code; for
`d4 = N` entry `N+1`. Neither is written in `0x4a64`. The source lists are
copied as fixed 162-byte blocks from the `wnd#` (`0x36ce..0x373c`), but the
dest lists at `a4@(2140)` are not. For `d4 = 1` the subtracted width would be
`S[0] − a2@(0)` (the count word), since index `d4−2 = −1`. NOT DECODED beyond
the read.

## C7. AW1a (question 8)

First pass `0x51f2..0x5212`: code 12, `d6` = width; `beqs 0x5214` on 0 skips
the remainder term. Second pass `0x526c..0x527c`: width 0 → `0x5298` `d6` = 0.
CONFIRMED.

## C8. Rect lists (question 9)

`dups.mjs` over the raw `wnd#` rect lists (`tools/theme-loader/decoders/wnd.js`):
138 resources; every list's first entry has type 0; type 4 repeats in 8; no
type 1–3 repeat; 32 lack type 4. `buildThemeJson.js` keys `parts` by type and
overwrites, so it keeps the last rect per type at the first key's position.

## C9. Q3: full draw paints (question 10)

`0x572e..0x5cb4` walked end to end. Writes to the port or the offscreen: the
GWorld setup (`$AB1D` selectors `0x16` NewGWorld into `fp@(-56)` with the
structure bbox, `0x17`, `0x01`, `0x05`, `0x06`), `0xea6c` (border cache, a
pixmap built by four CopyMask calls; it paints the cache, not the port), the
side loop `0x5938..0x5a1a` (`0xfeae` tile, `0x10320` scale, `0x5530` title),
`0x632e(5, 0)` at `0x5a3c`, the four `$A8EC` CopyBits at `0x5a9e..0x5b32`
(offscreen → window, srcCopy, mask = DiffRgn(strucRgn, contRgn), rects = the
structure bbox above, below, left and right of the content rect), the untraced
`0x480a`/`0x45b2` pair (Q8) and the family-63 blits `0x5bd8`, `0x5c34`,
`0x5c92`. No EraseRect, FillRect or pattern fill of the offscreen was found in
this range. CONFIRMED for the range; the offscreen's prior contents and Q8 are
open.

## C10. TX1–TX9: title text (question 12)

`0x5538` no template → exit. `0x5540..0x5554` GetWTitle into `fp@(-284)`;
empty and `a4@(511)` clear → exit. `0x5558..0x5578` `fp@(-16)` = body rect,
`fp@(-8)` = T4. `0x557e..0x5592` `0xfc5c` samples at (T4 left, T4 bottom − 4)
into `fp@(-290)`, later `$AA15` RGBBackColor (`0x55ea`). `0x5598` `0x5cb6(T4)`;
`0x55a2..0x55ba` right = left or bottom = top → exit (equality only).
`0x55be` right += 2. `0x55c2..0x55e4` NewRgn ×2, GetClip, RectRgn(T4p),
SectRgn, SetClip. `0x55ec..0x5606` room = right − left; StringWidth(title) ≤
room → skip. `0x5608..0x5634` TextFace 33/32, `$A8B5` with selector
`0x8208FFE0` (TruncString: width, string, truncWhere 0). `0x5638` TextMode 1.
`0x563e..0x56ae` colours: family 63 samples (body left, body bottom − 1) into
`fp@(-22)` and (body left + 1, same row) into `fp@(-28)`; otherwise (body left,
body top) and (body left + 1, body top). `0x56b2..0x56ce` compare; different →
`0x56d0..0x56ec` RGBForeColor(`fp@(-28)`), MoveTo(left + 1, bottom − 3),
DrawString. `0x56ee..0x5706` RGBForeColor(`fp@(-22)`), MoveTo(left, bottom −
4), DrawString. `0x5708..0x5724` TextFace 1/0, SetClip(saved), DisposeRgn ×2.
CONFIRMED. `0x58ee..0x5936` picks the side; `0x59fc` calls `0x5530` after that
side's segments.

Note for the reference's owner: `kdef231-reference.evidence.md` (`0x5530` row)
names `fp@(-28)` the text colour and `fp@(-22)` the shadow. By the draw order
above, `fp@(-28)` is drawn first at (+1, +1) and `fp@(-22)` on top at the
unshifted point, so `fp@(-22)` is the text and `fp@(-28)` the shadow. The
reference's own prose ("text in colour1 + a ~1px-offset shadow in colour2",
colour1 sampled first) agrees with this reading. Not edited here.

## C11. HT2 (question 14)

`0x4124..0x4128` `tstb a4@(508)`, clear → result 2, ahead of every widget test
(`0x412c`, `0x4168`, `0x41be`). Re-read, CONFIRMED. The keyboard is not a WDEF
message. The full draw's only `a4@(508)` gate is WD5 (`0x5a30`); close and
collapse art at rest are the template pixels the side cells copy, so whether
an inactive window shows widget art depends on its template, not on a widget
draw.

## C12. F6 corpus (question 2)

`f6b.mjs` / `f6b.out`: for each `wnd#` window type and state, the decoded
chrome cicn's last column and row with alpha > 16 (the runtime's
`drawableExtent` threshold) against its bounds, keeping sides with at least
one segment. 19 types have a bottom (height differs) or right (width differs)
side; no type-1–3 rect reaches past the drawn extent. The implementer's list of
seven is a subset, except beos collapsed-no-title-utility, whose only side is
the top, where CR1 does not read `B`.

## C13. Corrections after the #437 review (2026-10-22)

The Tier-1 verifier's REVIEW-437 refuted two Part C claims. The spec now
carries the verifier's replacement text.

- **C1 overclaim (B1).** "No other code reaches past dest[`N`]" holds, but the
  walk `0x532e..0x534a` rewrites dest[last] = dest[`N`] with the running sum.
  So the side ends at `P[N]` only when the allocation hands out its whole
  budget. That needs a code 8/11/13/14/18 recipient and no code-12 cell of
  width 0 (`0x5202`), or a zero budget. With no primary grower (`0x52b0`,
  `0x52e6`) the side ends at `P[0] + F`, and code-12-only growers leave the
  remainder `d4` undistributed. Two corpus AP3 sides are inexact: floppies
  collapsed-document-window right and animals collapsed-no-title-utility right
  (the verifier's `span-fill.out`). LS9, §5, F9 and §9 row 1 are corrected.
- **C2 counts (B2).** The 83 anchored sides include 13 `popup-window` top
  sides, which take AP1 at `0x4c64`/`0x4c6a` and return at `0x4dfa` before
  TT4–TT10. On the other 70: 52 zero, 9 positive, 9 negative. The 1138
  popup-window side is not a TT8 case.
- **C8.** `dups.out` itself shows crayon-os −14332 starting with type 4
  (order 4, 1, 2, 3, 0, each once). 137 of 138 lists start with type 0, and the
  equivalence conclusion stands.
- **C9.** Two items were missing from the call list, and neither paints:
  `0xecb6` at `0x5a22` (handle unlock and purge) and the `0x489c` gate before
  the Q8 pair. WD6's held rect is the content rect from `0x4778` (`0x5786`);
  the WD6 row is corrected.

## C14. F5 reach and WD6 reach (2026-10-22, after the #444 test author's note)

`ts3.mjs` / `ts3.out` (lane store; theme-loader recipes and rect lists only)
applies TS1–TS3 to every `wnd#` side with every widget present. Codes 15, 16
and 17 are zero, and so is code 0. `F` excludes {5, 6, 8, 11, 12, 13, 14, 18}.
`G` = Σ code 4 − Σ code 17. TS3 can fire when `G > 0` and the smallest
placed extent (content 0) is below `F − D`. The scan finds 42 types in 10
archives, and 12 sides at content delta −12. For each such type it finds the
collapse rect's two corner cells by first match in side then segment order
(RM3/RM4), using the template cross bands of CR1–CR4. A corner in a code-4
cell on the first firing side or a later one, or in a dropped code-10 cell,
counts as emptying (RM6). That test is a corner-cell reading, not a full
layout, so four types were checked by hand from `sf.out`:

- 1990 side-floating-utility: top-left in top segment `[0,14)` code 1,
  bottom-right in left segment `[9,14)` code 4. With that cell at width 0 the
  rect's top and bottom both land at `9 + Δ`, so it is empty.
- monkey-paradise side-floating-utility: bottom-right in right segment
  `[0,22)` code 4. The height comes out at −2, so it is empty.
- dolphin-som side-floating-utility `[2,2,8,8]` and no-title-utility
  `[57,7,61,11]`: both corners lie in one top cell, code 1 (segment `[0,14)`)
  and code 3 (segment `[57,63)`) respectively. Neither cell is zeroed by TS3,
  so the rect is not emptied.

The LC1 path itself is as R3: `collapseRequested` comes back from the table
at `0x2e26`, the cached placed lists are reused, and HT5 then reads
`collapseBox` at `0x41be`. Whether a dolphin-som utility window is
`cacheable` depends on `hasZoom` at creation, which is per-procID and not
known to the runtime.

`wd6.mjs` / `wd6.out`: all 13 `popup-window` types have type-5 and type-6
rect-list entries. WD6 runs under `popupFamily` in the full draw
(`0x5b7a`), so it is exercised wherever AP1 is.


## C15. Issue #459: title samples and #445 wording (2026-10-23)

Writer-only static reading of L1 `kdef0.annotated.txt` in
`campaign-20261021/v2-lanes/L1/annotated/`; no execution. Independent verifier
must re-trace these new TC rows; this writer makes no verifier marks.

- `0x5560..0x5564`: `0x6582(0)` → fp-16 = A. `0x5574..0x5578`:
  `0x6582(4)` → fp-8 = T4. `0x557e..0x5592` passes T4.left and
  T4.bottom−4 into `0xfc5c`, result fp-290; `0x55e6..0x55ea` sets RGBBackColor.
- `0x563e` tests A4+509, not a direct popup-family identity. Nonzero samples
  A.left,A.bottom−1 (`0x5644..0x5672`); zero samples A.left,A.top
  (`0x567e..0x56a8`). First result fp-22 is text; second fp-28 is shadow.
- `0x56b2..0x56ce` compares three words; any mismatch reaches shadow RGBForeColor
  and MoveTo(left+1,bottom−3), DrawString (`0x56d0..0x56ec`). Text uses
  fp-22 and MoveTo(left,bottom−4), DrawString (`0x56ee..0x5706`).
- Trap identities: `$AA15` RGBBackColor, `$AA14` RGBForeColor, `$A893` MoveTo,
  `$A884` DrawString, `$A889` TextMode, from pinned Traps.h.

N1–N5 preserve the independent #445 review's conclusions and attribution:
`v2-lanes/window-migration/REVIEW-445.json` and `REVIEW-445.evidence.md`,
independent Tier-1 verifier (Claude, Opus 5.5), 2026-10-22. N1: zero type-5/6
entries in 1990, dolphin-som and evolution leave only WD6's corner paint.
N2: 38 types have both corners in the zeroed code-4 cell; the other two empty
by actual layout (1990 height 0, monkey-paradise height −2). N3: the collapse
sub-rect mask is fully set in cicns −14330, −14298 and −14290; dolphin-som
side-floating-utility's zoom rect is empty after TS3 (top-left maps through
top code-1), so HT4 cannot shadow the collapse hit. N4 counts four types,
not three bullets. N5: `0x5df6..0x5e42`, `0x607a..0x608e` apply +8 only
with altWidgets; the sideTitle −8 NULL retry remains independent.


## S. Issue #381: bounded outer hit / grow trace (2026-10-24)

Static reading only of
`/Users/khawkins/Documents/git/aaron-ui/.scratch/k231-kdef/kDEF/k231-kdef0.asm`,
SHA-256 `6372c10fff5fb1120bc091978d58d8161e1550e0c6d406ccdf611bda2fae902d`.
The binary identity remains §1 of the safe spec: 2.3.1 kDEF 0, 107,726 B,
SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342`;
the listing hash is a separate text identity, not a rehash of the binary.
No execution, native acquisition, runtime inspection or broad family decode.
Trap identities checked in the supplied UI 3.0.1 `Traps.h`: A8E8 PtInRgn,
A8AD PtInRect. Classic WindowRecord offsets (visible 110, structure region
114, content region 118) are the same structural interpretation used above.

- Caller: message 1 dispatches at `0x296c..0x2978` to `0x3f2c`, passing the
  window and message point and retaining its returned result. Per-message
  preparation precedes this at `0x2910..0x2924`.
- Outer rejection: `0x3f38..0x3f66` returns 0 for invisible windows or a point
  outside the structure region. `0x4778` supplies the global content rect.
- Grow gate: `0x3f6a..0x3f7a` bypasses the early grow test for popup flag 509,
  collapsed flag 510, or clear flag 499. Preparation clears 499 at `0x2e22`;
  per-procID assignments include `0x3164..0x316c` and `0x31da..0x31e2`.
  This pass deliberately does not identify the public 1138 option's procID.
- Grow geometry: `0x480a..0x482a` selects d=16, or (flag 506 set) d=11 when
  flag 495, otherwise d=15. `0x4832..0x4856` makes left=C.right−d+1,
  top=C.bottom−d+1, right=C.right+2, bottom=C.bottom+2. `0x485a..0x4872`
  offsets all four edges by +3 only with flag 496 and clear flag 495.
  Crucially the caller `0x3f86..0x3f94` then overwrites right and bottom with
  the structure region bounding box's right and bottom. HG3 describes this
  caller-adjusted rectangle, not the helper's intermediate draw rectangle.
- `0x3f96..0x3fb2` tests this rectangle with PtInRect and immediately returns
  3 when active flag 508 is set, 1 otherwise. It does not consult widgets.
- After a miss/bypass, `0x3fb6..0x3fc6` returns 1 on the content-region hit.
  `0x3fca..0x3fce` routes a non-popup miss to `0x411c`, the existing HT path.
  Thus outer precedence is structure rejection → eligible grow → content →
  widget branch; it is not widget-first. Popup `0x3fd2..0x4118` is excluded.

Unknowns / limits: the exact original procID, global content rectangle,
structure region and click point for the issue's template-width 1138 case
have not been bound by this pass. The existing §10 observation describes a
modern overlay and its +60 px workaround, not an original grow-region oracle.
No numerical original overlap or native result is asserted. Exact-point
close/zoom fallback Q6 and the full structure-region construction remain
outside this trace; HG uses the region supplied to the WDEF. Public DOM
stacking and enlarged resize zones require modern policy; DECISIONS #12
remains in force. Safe handoff is §4.11a HG1–HG5 only, after independent
review; this appendix is not implementer material.
