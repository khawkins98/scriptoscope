# `window.layout` + `window.widgets` — Kaleidoscope 2.3.1 window recipe: part-code widths, the too-short step, the title side, and the rect-list widget remap, draw and hit

Behavioural spec, v2 lane L2 (2026-10-22). Template:
[TEMPLATE.md](TEMPLATE.md). It replaces the 2026-10-21 decode note
`docs/spec/kdef231-code10-widgets.md` (now a stub; implementers do not open
it). The instruction-level reasoning is in `window-widgets.evidence.md`;
implementers do not open that either. Implementers read this file,
[`qd-primitives.md`](qd-primitives.md) (tile and scale blits),
[`../compositor-spec.md`](../compositor-spec.md) ("Distribution", for the
grower arithmetic this file cites), Apple Inside Macintosh / Universal
Interfaces, and the rule tables the [implementer brief](IMPLEMENTER-BRIEF.md)
allows.

Every row cites the 2.3.1 `kDEF 0` listing by file offset. Rect intervals are
half-open `[start, end)`. All arithmetic is signed 16-bit unless a row says
otherwise, and every division truncates toward zero (QuickDraw-era `DIVS`
semantics: the remainder takes the sign of the dividend).

This re-trace (2026-10-22) **corrects three claims of the 2026-10-21 note**.
They are listed in §8, and the runtime findings they cause are in §7.2.

**Amended 2026-10-22 (window-migration answers).** §9 answers the 16
questions the window-recipe migration raised. Three open items are now
decoded: the popup-family placement (§4.6a, was Q1), the title text draw
(§4.12, was Q4) and the widget hit region (HT8, was Q5). The leading and
trailing regions (Q3) are narrowed. New rows: LS9, AW1a, TT2a, TT4a, TT10,
PP1–PP7, WD13, HT8, TX1–TX9. *2026-10-23:* TT2a's declared default is now `SWc = SW` (note after §4.6), and §7.2 adds F11 (runtime font substitution, DECISIONS #13). §7.2 adds finding F9 (sides are budgeted to end at `P[N]`) and
F10 (title text), and corrects F6's scope.

## 1. Unit id and scope

| field | value |
|---|---|
| unit id | `window.layout` (per-side layout, too-short step, title side, width allocation verdicts) and `window.widgets` (rect-list widget remap, draw, hit) |
| family | window (sliced `wnd#` recipes, the 13 archives that ship them) |
| message | every WDEF message except the custom messages 1000 and 1001 runs the layout (`0x2910..0x291e`). The widget draw answers `wDraw` (0) with draw parameter 0, 4, 5, 6 or 9. The widget hit answers `wHit` (1) |
| binary | Kaleidoscope 2.3.1 `kDEF 0`, 107,726 B, SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` |
| cited range | `0x2e02..0x38c8` (per-message flags, layout cache, per-side layout loop), `0x4778` (content rect), `0x487e` (collapse-box test), `0x49d6..0x4a62` (part-code verdict), `0x4a64..0x5176` (per-side layout), `0x5178..0x5354` (allocation walk), `0x5356..0x552e` (cell rects), `0x5cb6..0x5dda` (remap), `0x5ddc..0x6060` (widget hit), `0x6062..0x638e` (widget draw), `0x4124..0x41e6` (hit dispatch), `0x41ee..0x42d6` (draw dispatch), `0x572e..0x5cb4` (full draw: `0x58b8..0x58d8`, `0x5990..0x59c4`, `0x5a28..0x5a42`), `0x4c6a..0x4dfa` (popup placement), `0x38fe..0x3954` (popup data at window creation), `0x5530..0x572c` (title text), `0xf6e0..0xf718` (widget hit region) |
| out of scope | the grower arithmetic itself (two-pass shares, tiles and remainder: [compositor-spec "Distribution"](../compositor-spec.md), restated only where this unit changes it); the tile and scale blits ([`qd-primitives.md`](qd-primitives.md)); the structure region (`wCalcRgns`, now [`hit-regions.md`](hit-regions.md)) and the full draw's offscreen buffer; the built-in procedural frame of the five recipe-less schemes ([`procedural-frame.md`](procedural-frame.md)) |

## 2. Inputs

### 2.1 Recipe and rects

| input | meaning | values / domain |
|---|---|---|
| `side` | which frame side a list describes | 0 top, 1 bottom, 2 left, 3 right. The layout runs them in this order (`0x3826..0x38c0`) |
| `horizontal(side)` | the side runs along x | true for sides 0 and 1, false for 2 and 3 (`0x3848..0x3888`) |
| template list `S` | the side's `wnd#` side list as authored: a count `N` and entries `0..N`, each a part code and a border. `S[i]` is entry *i*'s border, `code(i)` its part code | `N = −1` means the side has no recipe: the layout returns at once (`0x4a8a..0x4a90`) and the side has no segments anywhere below |
| placed list `P` | the output: same count and codes as `S` (`0x4a88`, `0x4b14`), borders in global coordinates | written by this unit |
| segment *i* | the cell `[border[i−1], border[i])` tagged `code(i)`, for *i* = 1..N. Entry 0's code is never read by the layout or the remap; `[0, S[0])` is not a segment | END-based ([compositor-spec](../compositor-spec.md) "Draw + distribution") |
| `w(i)` | template width of segment *i*: `S[i] − S[i−1]`, taken in list order (the lists are not sorted) | may be 0 |
| `C` | content rect: the window's port rect converted to global coordinates (`0x4778..0x47e6`). For `wGrow` (5) it is the rect passed with the message (`0x4782..0x4796`). When `collapsed`, its bottom is set to its top, or its right to its left under `sideTitle` (`0x47ea..0x4802`) | Rect |
| rect-list lookup by type | the **last** rect-list entry of the requested type; if no entry has that type, the first entry's rect (`0x6582..0x65b8`). `A`, `T4` and the widths in WD9 and HT7 use it | Rect |
| `A` | template body rect: the rect-list lookup (`0x6582`) for type 0 | Rect, template coordinates |
| `B` | template bounds: the chrome template cicn's bounds | Rect |
| `T4` | the title text rect: the rect-list lookup for type 4 (`0x4a74..0x4a82`) | Rect, template coordinates |
| widget entries | rect-list entries of type 1 (close), 2 (zoom), 3 (collapse). Several entries may share a type; every walk below visits entries **last to first** (`0x6020..0x6056`, `0x635c..0x6386`) | Rects, template coordinates |
| `title` | the window title, read with `$A919` GetWTitle (`0x4a94..0x4a9c`); `titleLen` is its length byte, so it is 0 for an **untitled** window as well as after TS1 or TT3; `SW` = `$A88C` StringWidth(title) in the port's current face (`0x4a9e..0x4aa6`), 0 for an empty title | Str255 |
| `SWc` | StringWidth(title) measured with TextFace condense (32), or bold + condense (33) under `altWidgets` (TT2). QuickDraw computes it, not the kDEF | integer; runtime value: TT2a |
| popup data | family 63 only: the block the window's `dataHandle` points to. `pdMode` = the 32-bit value at offset 16, `pdX` = the word at offset 18 (the low word of `pdMode`), `pdLen` = the word at offset 22, `pdCentre` = the word at offset 26 (`0x4c72..0x4c8c`) | at window creation (PP6): `pdMode = 0`, `pdX = 0`, `pdLen = 33`, `pdCentre = 0` |

### 2.2 Window flags (rebuilt for every message, `0x2e0a..0x2e62` then the per-procID table at `0x2e6c`)

| flag | meaning | source |
|---|---|---|
| `hasClose` | the window's `goAwayFlag` | read at `0x4a1a`, `0x4a3e`, `0x412c` |
| `hasZoom` | zoom box present (set by the per-procID table) | read at `0x4a24`, `0x4a48`, `0x4168` |
| `collapseRequested` | collapse box requested by the per-procID table; the too-short step can clear it (TS3) | cleared `0x2e26`, set `0x2ee6..0x31c0`, cleared `0x4e3a` |
| `widgetFrame` | per-procID flag that gates every widget hit (`0x411c`) and the collapse box (`0x487e`). Meaning beyond that is not decoded | `0x4886`, `0x411c` |
| `noWidgets` | per-procID flag: when set at window creation the `goAwayFlag` is cleared (`0x3958..0x395e`), and it vetoes the collapse box | `0x488c` |
| `collapseBox` | `collapseRequested ∧ widgetFrame ∧ ¬noWidgets` | `0x487e..0x489a` |
| `drawActive` | the window's `hilited` (classic `WindowRecord` layout; an inference from the layout, see §6 Q7), forced on for some procID families | `0x2e52`, `0x315e`, `0x31d4` |
| `collapsed` | the window is collapsed: the result of a helper that asks the Appearance Manager (`$AA74` selector 16, identity not in the pinned Traps.h) or else an auxiliary-window flag bit (`0xf078`). Cleared for the popup family | `0x2e62`, `0x3216` |
| `partialZoom`, `partialZoomColumn` | the vertical/horizontal-zoom document variants (procIDs 1026–1029; the column flag for 1026/1027) and families 66/67 with some variations | `0x2fba..0x3038`, `0x3194`, `0x31a8` |
| `altWidgets` | alternate widget cicn set (+32) and bold title face; set exactly for procID families 66, 67 and 124, regardless of variation (PF1–PF3) | `0x3132`, `0x31ba`, read `0x4f0e`, `0x607e` |
| `sideTitle` | side-titled variant: widget id +8 only when `altWidgets` is also set (WD11); on a missing widget cicn, retry id −8 under `sideTitle`; collapsed content zeroes width not height | `0x3150`, `0x31fe` |
| `popupFamily` | procID family 63 | `0x3210` |
| `outlineDraw` | draw parameter 0 draws the outline instead of the frame | `0x428c..0x4292` |
| `cacheable` | the window's private data carries the layout-cache tag, written at window creation only when `hasZoom` was set (`0x397c`, `0x39d2`) | `0x3746..0x376a` |

### 2.3 Scriptoscope mapping and declared defaults

The runtime has no procID. The following rows distinguish the original
per-message decode from the declared public-type adapter. A procID family is
its signed 16-bit value divided by 16 with arithmetic right-shift semantics;
variation is its low four bits. The original resets both widget flags before
family selection on every message.

| row | condition | result | source |
|---|---|---|---|
| PF1 | procID family 66 or 67 (1056–1087) | `altWidgets = true`; `sideTitle = true` only for family 67. Every variation qualifies, including 0–3 and 12–15; partial zoom does not gate alternate art | `0x2e3e..0x2e42`, `0x3116..0x3156` |
| PF2 | procID family 124 (1984–1999) | `altWidgets = true`; `sideTitle` from variation bit 3 | `0x31ae..0x3204` |
| PF3 | every other procID family | `altWidgets = false`; no other path in this selection sets it | `0x2e3e`, `0x2e6c..0x321a` |
| PF4 | procID family 63 (1008–1023) | `popupFamily = true`, `collapsed = false` even when the window-state helper reports collapse. Content rect `C` keeps both dimensions (§2.1); WD4 walks four sides; WD9/HT7 do not select a collapsed second row | `0x3204..0x321a`, `0x47ea..0x4802` |
| PM1 | actual rendered type is `titled-utility-window`, `no-title-utility-window`, `side-floating-utility-window`, or a collapsed variant of one of them | **Declared mapping:** `altWidgets = true`. This includes legacy `collapsed-titled-utility`, `collapsed-no-title-utility`, `collapsed-side-utility` and their canonical aliases. All other rendered public types have `altWidgets = false`. Resolve aliases, collapsed variants and base-chain fallback first; use the type that actually rendered, as HP48 does for the title axis | PF1–PF3; modern adapter policy, #624 |
| PM2 | actual rendered type is `popup-window` | **Modern policy, PM ruling 2026-11-02 (#625):** ignore a collapse request. Effective `collapsed` is false for rendering, content visibility, hit geometry and public state reporting, including initial/add, apply and toggle paths. Keep the requested expanded width and height for later type/state transitions; never pre-empty a dimension. This normalizes the web state to PF4; the original decode does not define these web lifecycle operations | PF4; PM ruling |

Other declared defaults (modern policy, not original observations):
`popupFamily` from the `popup-window` request (service slot 8),
`partialZoom`, `partialZoomColumn`, `outlineDraw` and `noWidgets` clear,
`widgetFrame` set, `drawActive` from the window's active state. `collapsed`
comes from the caller/window state, subject to PM2. `hasClose`, `hasZoom` and
`collapseRequested` are currently one runtime flag (finding F7).

`sideTitle` is set from the actual rendered type by
[`hit-regions.md`](hit-regions.md) HP48, including collapsed and canonical
aliases. It is **one** flag: every decoded use reads the same value, including
collapsed `C`, WD4, WD8/WD9/HT7 retries and WD11. Together PM1 and WD11 request
−14298 for top-titled utilities and −14290 for side-titled utilities; WD9/HT7
retry the side strip at −14298 when −14290 is absent. Other types request
−14330. This is a shared type mapping, never an archive-name branch. PM1 changes only `altWidgets`; it does not establish new mappings for
`utilityFrame`, `growEnabled`, `noWidgets` or title suppression. Keep their
existing declared defaults and caller rules. Every existing decoded consumer
of `altWidgets` uses the same mapped value, including TT2/TX5/TX9's bold
face and HG3's size choice when that row is reachable. Do not add a separate
widget-only flag or infer other utility flags from PM1. These
rows govern recipe windows; the recipe-less built-in frame retains its own
family and resource rules in `procedural-frame.md`.

## 3. Outputs

- **Placed lists** `P` for the four sides (LS, TS, AP, TT, AW rows), and a
  possibly cleared `collapseRequested` (TS3), which later sides of the same
  message and every later reader of `collapseBox` see.
- **Widget rects**: the remapped rect of each widget entry (RM rows), in
  global coordinates; `(0,0,0,0)` when it cannot be placed.
- **Draw order** of the full frame: sides in order, each side's segments 1..N
  (WD4), then the partial-zoom widget (WD5), then the popup-family raw blits
  (WD6). Resource requests (widget cicns): WD8–WD11; a NULL widget cicn is
  retried only at the `sideTitle` fallback id, then the stage is skipped.

## 4. Decision tables

### 4.1 Part-code verdict `V(code, drop)` (`0x49d6`, table at `0x49e4`)

`V` answers "does this code collapse to width 0?". `drop` is the side's drop
flag (TS1).

| # | code | `V` is "zero" when | otherwise | source |
|---|---|---|---|---|
| PV1 | 0 | always | — | `0x4a12` |
| PV2 | 2 (close gap) | `¬hasClose` | keep | `0x4a16..0x4a22` |
| PV3 | 3 (zoom gap) | `¬hasZoom` | keep | `0x4a24..0x4a2c` |
| PV4 | 4 (collapse gap) | `¬collapseBox` | keep | `0x4a2e..0x4a38` |
| PV5 | 10 | `drop` | keep | `0x4a0c` |
| PV6 | 15 (close cell) | `hasClose` | keep | `0x4a3a..0x4a46` |
| PV7 | 16 (zoom cell) | `hasZoom` | keep | `0x4a48..0x4a50` |
| PV8 | 17 (collapse cell) | `collapseBox` | keep | `0x4a52..0x4a5c` |
| PV9 | any other code | never | keep | default `0x4a5e` |

### 4.2 Layout sums and placed ends (`0x4a64`, first pass `0x4af8..0x4be0`, ends `0x4be4..0x4c60`)

The first pass visits segments 1..N with `drop = 0`.

| # | quantity | definition | source |
|---|---|---|---|
| LS1 | `F` (required fixed width) | Σ `w(i)` over segments with `V(code, 0)` = keep and code ∉ {5, 6, 8, 11, 12, 13, 14, 18}. Code 10 counts | `0x4b64..0x4ba4` |
| LS2 | `D` (droppable width) | Σ `w(i)` over code-10 segments | `0x4ba8..0x4bae` |
| LS3 | `G` (collapse gap) | Σ `w(i)` of code 4 minus Σ `w(i)` of code 17, each term only while `collapseBox` | `0x4bb2..0x4bd2` |
| LS4 | `anchor` | index of the **last** code-5 segment, 0 when none | `0x4b1a..0x4b20` |
| LS5 | `growersBefore`, `growersAfter` | count of segments with code 8, 11, 12 or 18; a segment counts as "after" once any code-5 segment has been seen, else "before" | `0x4b3e..0x4b60` |
| LS6 | `W` (title width) | `SW`, then for every code-5 segment *i*: `W −= (T4.right − S[i]) + (S[i−1] − T4.left)`, which is `SW` plus the cell's margins around `T4` | `0x4b20..0x4b3a` |
| LS7 | placed ends | horizontal: `P[0] = S[0] + C.left − A.left`, `P[N] = S[N] + C.right − A.right`; vertical: the same with top and bottom | `0x4be4..0x4c60` |
| LS8 | `E` (placed extent) | `P[N] − P[0]` = template extent + (content size − template body size) on the side's axis | `0x4dfe..0x4e04` |
| LS9 | side span | the side's segments start at `P[0]`. Every allocation is budgeted to end at `P[N]`: AP3 budgets `P[N] − P[0] − F` (AW8), and AP2 and AP1 split the same span at the anchor (TT5, PP4). The walk (AW7) rewrites each border it visits, `P[last]` included, so the side ends where the widths sum. That is exactly `P[N]` when the budget is 0, or when the range has a code 8, 11, 13, 14 or 18 cell and no code-12 cell of width 0. Otherwise the side ends between `P[N]` and `P[0] + F`: at `P[0] + F` with no primary grower (AW9), and short of `P[N]` (past it below the template size) by the tile fractions no cell receives when code 12 is the only grower, and by one primary share for each code-12 cell of width 0 (AW1a). Nothing in the layout, the remap or the full draw places a cell before `P[0]`. On the corpus, two AP3 sides have no remainder recipient: floppies collapsed-document-window right (no grower) and animals collapsed-no-title-utility right (code 12 only, tile width 2). The titled halves with no grower are exact, because TT5 leaves their budget at 0 | `0x4be4..0x4c60`, `0x5180..0x519c`, `0x532e..0x534a`, `0x4fa8..0x4fcc`, `0x5938..0x59f8` |

### 4.3 Too-short step (`0x4dfe..0x4e42`)

Runs once per side, unless AP1 applies. `drop` starts at 0 (`0x4aac`).

| # | condition | effect | source |
|---|---|---|---|
| TS1 | `E < F` | `drop = 1`; `F −= D`; `W = 0`; `titleLen = 0` (the layout's own copy of the title) | `0x4e08..0x4e20` |
| TS2 | TS1 did not fire (`E ≥ F`) | nothing; `drop` stays 0, and code 10 keeps its template width at every size from the template up | `0x4e0c` |
| TS3 | TS1 fired, then still `E < F`, and `G > 0` | clear `collapseRequested` for the rest of this message (window-wide, so the sides laid out later see codes 4 → zero and 17 → keep, and so does this side's allocation); `F −= G` | `0x4e24..0x4e42` |
| TS4 | TS1 fired, and `E ≥ F` after dropping `D`, or `G ≤ 0` | the collapse box is left alone | `0x4e2e..0x4e38` |

Whether the side carries a title does not enter TS1–TS4.

### 4.4 Allocation path per side (`0x4c64`, `0x4e46..0x4e50`, `0x5148..0x516c`)

| # | condition | path | source |
|---|---|---|---|
| AP1 | `anchor ≠ 0` and `popupFamily` (on either axis: the test does not read `horizontal`) | popup placement (§4.6a, PP1–PP7) with `drop = 0` and the title gate set to 1. **The too-short step does not run**; code 10 always keeps its width. The titled-side rows TT1–TT9 do not run either | `0x4c64..0x4dfa` |
| AP2 | otherwise, after TS: `anchor ≠ 0` and `horizontal(side)` | titled side (§4.6) | `0x4e46..0x4e50` |
| AP3 | otherwise | one allocation over segments 1..N: required `F`, primary count `growersBefore + growersAfter`, the side's `drop`, title gate 0 | `0x5148..0x5166` |

Under AP3 the title gate is 0, so every code-5 or code-6 segment gets width 0
(AW5). No corpus side has a 5/6 segment off an AP2 side (§6.2).

### 4.5 Per-cell width in an allocation (`0x5178..0x5354`)

An allocation is called with a segment range `first..last`, a required width,
a primary count, the side's `drop`, and a title gate.

| # | code | width | source |
|---|---|---|---|
| AW1 | 12 | whole tiles of the primary share ([compositor-spec](../compositor-spec.md) "Distribution") | `0x5266..0x529a` |
| AW1a | 12 with `w(i) = 0` | 0. In the first pass it adds nothing to the remainder (the tile fraction is skipped, not divided) | `0x5202`, `0x527c` |
| AW2 | 8, 11, 18 | primary share + remainder share | `0x529e..0x52d8` |
| AW3 | 13, 14 | remainder share only | `0x52da..0x52fa` |
| AW4 | any other, `V(code, drop)` = zero | 0 | `0x52fc..0x530a` |
| AW5 | 5 or 6, title gate 0 | 0 | `0x530c..0x531c` |
| AW6 | any other | its template width `w(i)` | `0x531e..0x532a` |
| AW7 | (walk) | `P[i] = P[i−1] + width(i)` for *i* = first..last, in order | `0x532e..0x534a` |
| AW8 | (budget) | `budget = P[last] − P[first−1] − required`. **It is not clamped.** A negative budget yields negative primary shares, so growers get negative widths and the later borders move back; a placed cell with right ≤ left (bottom ≤ top) is not drawn (WD4) | `0x5180..0x519c`, `0x51b4..0x51c6` |
| AW9 | (no primary grower, or budget 0) | the first pass is skipped; every 8/11/12/13/14/18 cell gets 0 | `0x51a4..0x51b0`, `0x52b0..0x52b8`, `0x52e6` |

So code 10 is "fixed, but dropped first when the side is too short" (PV5 +
TS1 + AW4/AW6), and codes 5/6 never grow inside an allocation.

### 4.6 Titled side (AP2, `0x4e54..0x5146`)

`Fb` and `Fa` are recomputed after TS, with the side's current `drop`.

| # | condition | effect | source |
|---|---|---|---|
| TT1 | always | `Fb` (`Fa`) = Σ `w(i)` over segments *i* < `anchor` (> `anchor`) with `V(code, drop)` = keep and code ∉ {8, 11, 12, 13, 14, 18}. Codes 5/6 count here; code 10 does not once `drop = 1` | `0x4e54..0x4eec` |
| TT2 | `R = E − Fb − Fa < W` | `W −= SW − SWc`, where `SWc` is StringWidth(title) measured with `$A888` TextFace condense (32), or bold + condense (33) under `altWidgets`; the face is then set back to plain (0), or bold (1) under `altWidgets` | `0x4eee..0x4f42` |
| TT2a | (runtime value of `SWc`) | **declared default** (modern policy, not decoded: the width comes from the Font Manager, not the kDEF): `SWc = SW − titleLen`, Apple's synthetic condense of one pixel less per character (Inside Macintosh: Text, Font Manager style extra). Not observed for Charcoal or Virtue; a measured condensed width replaces it. `SWc = SW` makes TT2 inert and is a divergence, not this default | Inside Macintosh: Text |
| TT3 | `R ≤ 2` | `titleLen = 0`, `W = 0` | `0x4f46..0x4f62` |
| TT4 | `titleLen = 0` (by TS1, TT3 or an untitled window, TT10) | if segment `anchor+1` is code 6, `Fa −=` its width; if segment `anchor−1` is code 6, `Fb −=` its width | `0x4f66..0x4fa4` |
| TT4a | `anchor = 1` or `anchor = N` | the code TT4 reads for "segment `anchor−1`" is entry 0's code in the placed list, and for "segment `anchor+1`" the slot after entry `N`. The layout writes neither slot, so what they hold is **not decoded**. Declared default: no subtraction. No corpus side has its anchor at 1 or `N` (§6.2) | `0x4f6c..0x4f96` |
| TT5 | always | `P[anchor−1] = P[0] + Fb`; `P[anchor] = P[N] − Fa` | `0x4fa8..0x4fcc` |
| TT6 | `growersBefore > 0`, `growersAfter > 0` and `Fb > Fa` | `L = mid − (W + (T4.left − S[anchor−1]) + (T4.right − S[anchor])) / 2`; if `L > P[anchor−1]`, `P[anchor−1] = L`. Then if `P[anchor−1] + W < P[anchor]`, `P[anchor] = P[anchor−1] + W` | `0x4fd0..0x5046` |
| TT7 | otherwise | if `growersAfter > 0`: `R' = mid + (W + (S[anchor] − T4.right) + (S[anchor−1] − T4.left)) / 2` when `growersBefore > 0`, else `R' = P[anchor−1] + W`; if `R' < P[anchor]`, `P[anchor] = R'`. Then, if `growersBefore > 0`: if `P[anchor] − W > P[anchor−1]`, `P[anchor−1] = P[anchor] − W` | `0x5048..0x50ba` |
| TT8 | `W < 0` | `P[anchor−1] −= S[anchor−1] − T4.left`, `Fb −=` the same; `P[anchor] −= S[anchor] − T4.right`, `Fa +=` the same; then the working template borders `S[anchor−1]`, `S[anchor]` become `T4.left`, `T4.right` for the rest of this message | `0x50be..0x50fa` |
| TT9 | always | two allocations: segments `1..anchor−1` (required `Fb`, primary count `growersBefore`) and `anchor+1..N` (required `Fa`, `growersAfter`), both with the side's `drop` and the title gate `titleLen` | `0x5100..0x513c` |
| TT10 | untitled window (`titleLen = 0`, `SW = 0`, no drop) | the same rows as after a drop, except `W`: TT4 removes the code-6 neighbours from `Fb`/`Fa`, and TT9's gate 0 gives every 5/6 segment inside the two allocations width 0 (AW5), so the **bezels are not drawn**. The anchor (plate) cell is **not** forced to 0: `W = (T4.left − S[anchor−1]) + (S[anchor] − T4.right)` (LS6 with `SW = 0`), and TT6/TT7 cap the cell at that width when either half has a primary grower. It is 0 where the two margins sum to 0 (`T4` fills the cell, or is shifted inside it as on monkey-paradise movable-modal), positive where `T4` is narrower, and negative where `T4` overhangs it, which runs TT8 | `0x4a94..0x4aa6`, `0x4b20..0x4b3a`, `0x4f66`, `0x530c` |

**TT2a amended 2026-10-23 (DECISIONS #13, maintainer).** The declared
default is now `SWc = SW`, the full drawn width of the title in the runtime's
face. The runtime's title font has no condensed face, so TT2 changes nothing
(§7.2 F11). This supersedes the `SWc = SW − titleLen` the TT2a row above
still states. That row stays verbatim because a ledger locator quotes it, and
it remains the reference value (Apple's synthetic condense) for a runtime that
gains a condensed face. TT2 and every other decoded row are unchanged.

`mid = (C.left + C.right) / 2` (`0x4fe6..0x5002`, `0x5054..0x5070`). The
anchor (code-5) cell is not part of either allocation. Its span is
`[P[anchor−1], P[anchor])`, where the first allocation's walk (AW7) rewrites
`P[anchor−1]` and TT5–TT8 set `P[anchor]`.

After a title drop (`W = 0`), TT6/TT7 leave the anchor cell at width ≤ 0
whenever either half has a primary grower. With no grower in either half, the
anchor cell spans the whole room `E − Fb − Fa`, which can be positive (§6 Q2).

### 4.6a Popup placement (AP1, `0x4c6a..0x4dfa`)

The popup family places the anchor cell from its popup data, not from the
title. `SW`, `W` and `titleLen` are not read on this path.

| # | condition | effect | source |
|---|---|---|---|
| PP1 | `pdMode = −2` | `X = pdCentre − C.left + 4 − pdLen / 2` (16-bit, the halving truncates toward zero) | `0x4c92..0x4cbc` |
| PP2 | otherwise | `X = pdX` | `0x4cbe` |
| PP3 | always | `Fb` (`Fa`) = Σ `w(i)` over segments *i* < `anchor` (> `anchor`) with `V(code, 0)` = keep and code ∉ {8, 11, 12, 13, 14, 18}. Codes 5, 6 and 10 count | `0x4cc6..0x4d5c` |
| PP4 | always | `P[anchor−1] = C.left + X + 10 + S[anchor−1] − T4.left`; `P[anchor] = C.left + X + pdLen − 10 + S[anchor] − T4.right`. `C.left` is used on either axis | `0x4d5e..0x4db0` |
| PP5 | always | two allocations: segments `1..anchor−1` (required `Fb`, primary count `growersBefore`) and `anchor+1..N` (required `Fa`, `growersAfter`), both with `drop = 0` and title gate 1, so codes 5 and 6 keep their template widths | `0x4db4..0x4df6` |
| PP6 | window creation (`wNew`, family 63) | the popup data is a new 28-byte block: offsets 0–11 zero, the 32-bit value 10312 at 12, 0 at 16, 33 at 20, 0 at 24 and 26. So `pdMode = 0`, `X = pdX = 0`, `pdLen = 33`. Family-63 windows get no layout-cache block | `0x390a..0x3954` |
| PP7 | (runtime values) | **declared default**: the creation values of PP6. Who changes the popup data after creation is **not decoded** (§6 Q10); the runtime has no such writer. Visible consequence: every popup title gets 15 px of room (TX5), so a longer title is condensed and truncated. The writer is plausibly the application; a runtime that fits the plate to the title departs from this default and records it | — |

With the creation values and a `T4` that fills its cell, the anchor cell is
`[C.left + 10, C.left + 23)`: a 13-pixel plate 10 pixels in from the content's
left edge, whatever the title. The title text draws in the remapped `T4`
(§4.12), so a longer title is truncated (TX5).

### 4.7 Layout cache (`0x3746..0x38a8`)

| # | condition | effect | source |
|---|---|---|---|
| LC1 | `cacheable`, message ≠ `wCalcRgns` (2), and `C` equals the cached content rect (`$A8A6` EqualRect) | the four placed lists are copied from the cache and **no layout runs**: no LS, TS, AP, TT or AW row for this message | `0x376c..0x3810` |
| LC2 | otherwise | the layout runs; when `cacheable` the rect and each placed list are stored | `0x3814..0x38a8` |
| LC3 | every message | `collapseRequested` is first re-derived from the per-procID table (`0x2e26`, table), so after LC1 it holds its table value even when the cached geometry was laid out with it cleared | `0x2e26`, `0x4e3a` |

### 4.8 Cell rects (`0x5356`)

For side *s* and segment *i*, the template cell `t` and placed cell `p`. Along
the side: `t` spans `[S[i−1], S[i])`, `p` spans `[P[i−1], P[i])`.

| # | side | across the side (template `t`, placed `p`) | source |
|---|---|---|---|
| CR1 | 0 top | `t`: `[0, A.top)`; `p`: `[C.top − A.top, C.top)` | `0x538e..0x53ec` |
| CR2 | 1 bottom | `t`: `[A.bottom, B.bottom)`; `p`: `[C.bottom, C.bottom + B.bottom − A.bottom)` | `0x53f0..0x5454` |
| CR3 | 2 left | `t`: `[B.left, A.left)`; `p`: `[C.left − A.left + B.left, C.left)` | `0x5458..0x54c0` |
| CR4 | 3 right | `t`: `[A.right, B.right)`; `p`: `[C.right, C.right + B.right − A.right)` | `0x54c2..0x5528` |

### 4.9 Widget rect remap (`0x5cb6`)

Input: a widget entry rect `r` in template coordinates. Output: `r` placed.

| # | condition | effect | source |
|---|---|---|---|
| RM1 | no chrome template loaded | `r` is returned unchanged | `0x5cd0..0x5cd4` |
| RM2 | always | two corners are looked up: `tl = (r.left, r.top)` and `br = (r.right − 1, r.bottom − 1)` | `0x5cc2..0x5cc6`, `0x5d04..0x5d08` |
| RM3 | always | candidate cells in order: sides 0, 1, 2, 3, and in each side segments 1..N of `S` (CR rows). `[0, S[0])` is never a candidate | `0x5d0c..0x5dc2` |
| RM4 | a corner lies in a cell's **template** rect `t` (`$A8AD` PtInRect, half-open) and that corner is not yet matched | it is matched to that cell. Each corner takes the first cell that contains it, independently of the other | `0x5d4a..0x5d5e`, `0x5d78..0x5d8a` |
| RM5 | `tl` matched to a cell | `r.left += p.left − t.left`; `r.top += p.top − t.top` | `0x5d60..0x5d76` |
| RM6 | `br` matched to a cell | `r.right += p.right − t.right`; `r.bottom += p.bottom − t.bottom` (the cell's **far** edges) | `0x5d8c..0x5da4` |
| RM7 | both corners matched | stop | `0x5da6..0x5dac` |
| RM8 | after all candidates, either corner unmatched | `r = (0, 0, 0, 0)` | `0x5dc6..0x5dd0` |

### 4.10 Widget draw (`0x41ee`, `0x4216`, `0x632e`, `0x6062`, `0x572e`)

| # | condition | effect | source |
|---|---|---|---|
| WD1 | `wDraw`, window visible | the frame is drawn through `$ABCA` DeviceLoop; nothing when invisible | `0x41f4..0x420e` |
| WD2 | draw parameter 0 | `outlineDraw` ? outline : full frame draw (WD4–WD6) | `0x428c..0x429e` |
| WD3 | draw parameter 4, 5, 6 or 9 | widget draw (WD7) of that part with `state` = 1 (pressed) when the press-toggle bit is clear, 0 (normal) when it is set | `0x4256..0x4264`, `0x42a2..0x42ac` |
| WD3a | draw parameter < 4 | the press-toggle bit is cleared before drawing | `0x4242..0x4254` |
| WD3b | after a parameter 4, 5, 6 or 9 draw | the press-toggle bit flips. Parameters 1, 2, 3, 7, 8 and above 9 draw nothing and do not flip it (1–3 have already cleared it, WD3a) | `0x42ae..0x42c8` |
| WD4 | full draw | sides 0..3 (when `collapsed`: sides 0..1, or 2..3 under `sideTitle`), segments 1..N; a placed cell `p` with right ≤ left or bottom ≤ top is skipped; code 18 is one scale blit, other codes tile ([`qd-primitives.md`](qd-primitives.md) table W) | `0x58b8..0x58d8`, `0x5990..0x59c4` |
| WD5 | full draw, after the sides, `partialZoom ∧ drawActive` | widget draw of part 5, state 0. **This is the only widget draw in the full draw**: close (4) and collapse (9) art at rest is whatever template pixels the side cells copy | `0x5a28..0x5a42` |
| WD6 | full draw, `popupFamily` | three blits from the chrome template at rect-list rects, not through the remap (source the raw rect): type 5 translated by `(C.left − A.left, C.top − A.top)`, type 6 by `(C.right − A.right, C.top − A.top)`, and the 15×15 rect at `A`'s bottom-right corner by `(C.right − A.right, C.bottom − A.bottom)`. *Corrected 2026-10-22*: the rect the full draw holds is the content rect `C` | `0x5786`, `0x5b7a..0x5c92` |
| WD7 | widget draw of part *k* | part 4 → entry type 1, 5 or 6 → type 2, 9 → type 3; every entry of that type, last to first, is drawn by WD8–WD10 | `0x632e..0x6386` |
| WD8 | part 5 or 6, `partialZoom`, and cicn `base+1` exists (or `base−7` under `sideTitle`) | source: the entry rect moved to the origin, `+height` down when `state ≠ 0`, `+width` right under `partialZoomColumn`; one scale-blit (`0x10320`) to the remapped entry rect | `0x60aa..0x6154` |
| WD9 | otherwise, `state ≠ 0` and cicn `base` exists (or `base−8` under `sideTitle`) | pressed strip, laid out across: close at x = 0, zoom at x = width(type 1 entry), collapse at width(type 1) + width(type 2); one row down when `collapsed` and the cicn is at least twice the source bottom tall. Blit to the remapped entry rect. A missing cicn draws nothing | `0x6158..0x62ee` |
| WD10 | otherwise, `state = 0` | source: the **chrome template itself** at the raw entry rect; blit to the remapped entry rect | `0x62f0..0x631e` |
| WD11 | ids | `base = −14330`, `+32` under `altWidgets`, and a further `+8` when `sideTitle` is also set | `0x607a..0x608e` |
| WD12 | resource context | the widget cicns are read with the file named by Gestalt(`Copl`) current; the previous file is restored after | `0x6090..0x60a8`, `0x6322` |
| WD13 | the blit of WD8, WD9 and WD10 | the scale blit (`0x10320`, [`qd-primitives.md`](qd-primitives.md) SC1–SC4) from the source sub-rect to the remapped entry rect. On screen that is CopyMask with the **source cicn's own mask** (SC3): the pressed strip's mask for WD8/WD9, the chrome template's for WD10. Under picture recording or custom bottlenecks it is CopyBits through the mapped mask region (SC4), still masked. It is never an opaque copy. When the remapped rect differs in size from the source, the art is scaled, not tiled | `0x6146`, `0x62e0`, `0x6318` |

### 4.11 Widget hit (`0x4124..0x41e6`, `0x5ffc`, `0x5ddc`)

| # | condition | result | source |
|---|---|---|---|
| HT1 | in the widget branch of `wHit`, `widgetFrame` clear | 1 (`wInContent`) | `0x411c..0x4120` |
| HT2 | `drawActive` clear | 2 (`wInDrag`): no widget is hit-testable in an inactive window. The test comes before every widget test, so a press on an inactive window's close, zoom or collapse art is answered as a drag-region press. (Apple-side, not in the kDEF: the Window Manager tracks and highlights a widget only after a widget result, and a drag-region press goes to DragWindow, which activates the window; Inside Macintosh: Toolbox Essentials.) The WDEF has no keyboard path; what a keyboard activation should do is not in the decode | `0x4124..0x4128` |
| HT3 | `hasClose` and the close widget is hit (HT6) | 4 (`wInGoAway`) | `0x412c..0x4146` |
| HT4 | else `hasZoom` and the zoom widget is hit | 5 or 6 by the window's zoom state (`0x466e`, not traced here) | `0x4168..0x4192` |
| HT5 | else `collapseBox` and the collapse widget is hit | 9 (collapse box) | `0x41be..0x41dc` |
| HT5a | else | 2 (`wInDrag`) | `0x41e0` |
| HT6 | "widget of type *k* is hit" | some entry of type *k* (last to first) passes HT7 | `0x5ffc..0x6058` |
| HT7 | one entry | false when no chrome template is loaded (`0x5de8..0x5df0`), or when the widget cicn `base` is missing and (under `sideTitle`) so is the retry `base−8`. Otherwise the source sub-rect is the entry rect moved to the origin (close), `+width(type 1)` (zoom), or `+width(type 1) + width(type 2)` (collapse), one row down under the WD9 `collapsed` rule; `p` = the remapped entry rect. Hit ⇔ the point is in the cicn's region (HT8) offset so the source sub-rect lands on `p` (`$A8E8` PtInRgn) **and** in `p` (`$A8AD` PtInRect) | `0x5ddc..0x5ff2` |
| HT8 | the region of HT7 | the widget cicn's **mask** as a region (`$A8D7` BitMapToRegion of the cicn's mask bitmap, in the cicn's bounds coordinates); an empty region when BitMapToRegion fails. It is offset by `(p.left − source.left, p.top − source.top)`: moved 1:1, **not scaled** to `p`. The region covers the whole strip, so when `p` is larger than the source sub-rect, points of `p` past it test the neighbouring strip art's mask | `0xf6e0..0xf718`, `0x5f98..0x5fbe` |

Two fallbacks that return 4 or 5/6 when the point equals one exact offset of
a frame rect (`0x414a..0x4164`, `0x4194..0x41bc`) are not decoded (§6 Q6).

### 4.11a Outer hit classification and grow precedence (issue #381)

HT1–HT8 describe only the widget branch. The enclosing `wHit` path uses
the global point, the window's structure and content regions, and `C` (§2.1).
For this bounded trace, `growEnabled` denotes the per-procID flag read at
`0x3f76`; `utilityFrame` denotes the per-procID flag read at `0x481c`.
These names do not establish a mapping from public window options to procIDs.
The popup family has a separate path, outside the following ordinary path.

| row | condition (in order) | result / rule | evidence |
|---|---|---|---|
| HG1 | window not visible, or point outside its structure region | 0 (`wNoHit`); no grow, content or widget test follows | `0x3f38..0x3f66` |
| HG2 | not `popupFamily`, not `collapsed`, and `growEnabled` | test grow rect `G` (HG3) before content and widgets; a hit returns 3 (`wInGrow`) when `drawActive`, otherwise 1 (`wInContent`), and stops | `0x3f6a..0x3fb2` |
| HG3 | HG2's rectangle | let `d = 16` when `altWidgets` is clear, otherwise 11 when `utilityFrame`, otherwise 15. Let `s = 3` when `noWidgets` and not `utilityFrame`, otherwise 0. Then `G = [C.right − d + 1 + s, C.bottom − d + 1 + s, structureBounds.right, structureBounds.bottom]` in `[left, top, right, bottom]` order. Membership uses half-open `PtInRect`. This is a bottom-right rectangle, not a band spanning the window edge | `0x480a..0x4876`, `0x3f7c..0x3fa4` |
| HG4 | no earlier result, point in content region | 1 (`wInContent`); widgets are not tested | `0x3fb6..0x3fc6` |
| HG5 | no earlier result, not `popupFamily` | enter the widget branch HT1–HT8 (including its inactive gate); its existing exact-point close/zoom fallbacks remain Q6 | `0x3fca..0x3fce`, `0x411c..0x41e4` |

Thus a point in both the original grow rectangle and a collapse hit region
is classified by HG2, **before** collapse. A point covered only by a modern
expanded resize overlay does not thereby belong to the original grow region.
The source rule alone neither proves the numeric original intersection for
1138's template-width side-floating utility nor prescribes public DOM stacking,
resize-target enlargement, or widget priority within enlarged targets. Those
require bound geometry inputs or an explicit modern policy. Adding 60 px to a
regression window does not test the reported template-width overlap. DECISIONS
#12 continues to govern operable public widgets on inactive windows; HG2 and
HT2 are decoded WDEF results, not a reversal of that accessibility decision.

#### Modern public WindowManager collision policy (issue #381)

The following is an explicit modern compatibility policy authorized by the PM
on 2026-10-24 after an independent public-layer reproducer. It does not change
HG1–HG5 or establish original-engine fidelity.

| row | public-layer condition | required behavior | authority |
|---|---|---|---|
| WM381 | an enlarged resize overlay overlaps a visible, enabled title-widget DOM button (close, zoom or collapse) | the button retains its pointer hit target and performs its title action; the same press must not also start resize. Uncovered grow targets and keyboard resize remain available. DECISIONS #12's operable inactive-window buttons remain unchanged | PM compatibility decision, 2026-10-24, issue #381 |

The bounded regression case is 1138 side-floating utility at template content
size 2×35 (full window 20×45), where the independent reproducer found collapse
presses reaching the grow overlay; the +60 px width control avoids that collision.
Cover the template-width collision as well as ordinary grow and keyboard resize.
This public geometry is not an original procID, global structure-region or
native click binding; the numeric original intersection remains unknown.

### 4.12 Title text (`0x5530`, called from the full draw)

| # | condition | effect | source |
|---|---|---|---|
| TX1 | when | once per full draw, right after the side that holds `T4` has drawn its segments: side 0 when `T4.bottom ≤ A.top`, else 1 when `T4.top ≥ A.bottom`, else 2 when `T4.right ≤ A.left`, else 3 when `T4.left ≥ A.right`, else 0 | `0x58ee..0x5936`, `0x59fc..0x5a02` |
| TX2 | no chrome template; or the title (re-read with GetWTitle, so the layout's `titleLen = 0` does not reach it) is empty and a per-window flag is clear | nothing is drawn. The flag's meaning is not decoded (§6 Q11); declared default clear, so an untitled window draws no text | `0x5538..0x5554` |
| TX3 | always | `t4p` = `T4` remapped (RM rows). If `t4p.right = t4p.left` or `t4p.bottom = t4p.top`, nothing is drawn. The test is equality only: a `t4p` with right < left or bottom < top is drawn, into a clip (TX4) at most 1 px wide | `0x556a..0x55ba` |
| TX4 | always | the text is clipped to the old clip ∩ `t4p` widened by 2 on the right | `0x55be..0x55e4` |
| TX5 | `StringWidth(title) > room`, `room = t4p.right + 2 − t4p.left` | TextFace condense (32; 33 under `altWidgets`), then `$A8B5` TruncString(room, title, truncate at end). The condensed face stays on for the draw | `0x55ec..0x5636` |
| TX6 | always | TextMode 1 (`srcOr`) | `0x5638..0x563c` |
| TX7 | the two sampled text colours differ. The first colour is the chrome template's pixel at `(A.left, A.top)`, the second the pixel one to its right; the popup family samples at `(A.left, A.bottom − 1)` and one to its right (sampling and colour interpretation: TC1–TC5 below) | the shadow string first: second colour, pen at `(t4p.left + 1, t4p.bottom − 3)`, DrawString | `0x563e..0x56ec` |
| TX8 | always | the text: first colour, pen at `(t4p.left, t4p.bottom − 4)`, DrawString. Left-aligned: the kDEF does not centre the string; the centring is the layout's (TT6/TT7, §5) | `0x56ee..0x5706` |
| TX9 | after the draw | TextFace back to plain (bold under `altWidgets`), clip restored | `0x5708..0x5724` |

### 4.13 Title colour sampling

Samples use the loaded chrome template's original pixel coordinates, before
remapping, blitting or display-profile conversion. The colours are full
QuickDraw RGB triples; compare all three 16-bit channels. Use the indexed
pixel sampler in [qd-primitives.md](qd-primitives.md) §4, Samplers; a mask-clear pixel
still supplies colour. No palette role or scheme-name default substitutes for
a valid sample (`0x557e..0x5592`, `0x563e..0x56ce`, `0xfc5c..0xfd74`).

| # | condition | effect | source |
|---|---|---|---|
| TC1 | title path before remapping `T4` | background := template pixel `(T4.left, T4.bottom − 4)`; RGBBackColor(background) after setting the title clip | `0x556a..0x5592`, `0x55e6..0x55ea` |
| TC2 | per-window lower-swatch flag clear | text := template pixel `(A.left, A.top)`; shadow := template pixel `(A.left + 1, A.top)` | `0x563e..0x5642`, `0x567e..0x56a8` |
| TC3 | per-window lower-swatch flag set | text := template pixel `(A.left, A.bottom − 1)`; shadow := template pixel `(A.left + 1, A.bottom − 1)` | `0x5644..0x5672` |
| TC4 | text RGB equals shadow RGB | skip the shadow draw; draw text once (TX8) | `0x56b2..0x56ce`, `0x56ee..0x5706` |
| TC5 | any channel differs | draw shadow first at TX7's (+1,+1) pen offset, then text at TX8's pen; keep TextMode `srcOr` for both | `0x5638..0x563c`, `0x56d0..0x5706` |

The lower-swatch flag is `popupFamily` (`0x3210`), distinct from TX2's
empty-title flag. Use the lower swatch for `popupFamily`, upper otherwise. Out-of-bounds samples follow the sampler's unspecified-input
boundary; do not replace them with invented colours. Independent verification
must test differing RGB channels, equal colours and mask-clear swatches.

**Runtime title-font policy.** The substitute glyphs retain the existing
transparent-coverage, browser alpha-over painter, with shadow first and text
second. As with [control text colours](../control-text-colors.md) and
[prepared bitmap fonts](../prepared-bitmap-font.md), this does not establish
pixel equivalence to QuickDraw's `srcOr` text transfer. TX6 and TC5 record the
original requested mode; no bitwise RGB formula is inferred from that mode.
The title sizing, clip and baseline policies remain those of DECISIONS #13.

| id | condition | runtime font policy | authority |
|---|---|---|---|
| TF1 (`window.title-fit`) | substitute title font, every sliced archive | Measure and draw at full width (`SWc = SW`). Preserve a whole title whenever its measured width fits `room = min(t4p.width + 2, max(plate.right − t4p.left, t4p.width))`; otherwise retain the longest prefix plus ellipsis that fits, or ellipsis alone when no glyph-plus-ellipsis fits (even when the marker itself exceeds room). Keep TX4's clip and the DECISIONS #13 baseline adjustment. This is a finite substitute-font sizing contract, not whole typography fidelity or an original-font raster claim. | DECISIONS #13; TX5 truncEnd; declared substitute marker policy |

## 5. Geometry

- **Placed extent.** `E = (S[N] − S[0]) + (C.right − C.left) − (A.right − A.left)`
  on horizontal sides; top and bottom on vertical ones (LS7–LS8).
- **Too-short threshold.** With `TS` evaluated on template-derived sums, a side
  drops its code-10 cells when the content is smaller than the template body
  by more than `shrink = (S[N] − S[0]) − F` on that axis (§6.2 lists the
  corpus values).
- **Remap, by cell kind.** For a widget whose corners both lie in one cell of
  template length `n` and placed length `m` (RM5, RM6, CR rows):
  `left' = left + (P[i−1] − S[i−1])`, `right' = right + (P[i] − S[i])`, so
  the width changes by `m − n`. A fixed cell (`m = n`) translates the widget. A
  grown cell stretches it. A **dropped** cell (`m = 0`) shrinks it by `n`;
  a widget wholly inside the cell (length ≤ `n`) becomes an empty rect, so it is
  neither drawn (WD8–WD10 blit to an empty rect) nor hit (HT7 needs the point
  in `p`). The cross axis always translates (CR rows keep the template band's
  thickness).
- **Titled side.** `mid = trunc((C.left + C.right) / 2)`; the halving in TT6
  and TT7 truncates toward zero (32-bit in TT6, 16-bit in TT7; equal for
  in-range values).
- **Title rect.** When TT6 or TT7 leaves the anchor cell at width `W`, the
  remapped title rect `t4p` (TX3) is exactly `SW` wide:
  `t4p.left = P[anchor−1] + (T4.left − S[anchor−1])`, and its width is
  `(T4.right − T4.left) + W − (S[anchor] − S[anchor−1]) = SW`. Under TT6 its
  left edge is `mid − SW/2` (truncated), so the string is centred on the content
  rect's centre, not on the plate; the two differ by half the margin difference
  when the margins around `T4` are unequal. Under TT7 with no grower before the
  anchor, the string starts `T4.left − S[anchor−1]` after `P[anchor−1]`. When
  the room is smaller than `W`, the cell and `t4p` are narrower and TX5
  truncates.
- **Popup plate.** `P[anchor] − P[anchor−1] = pdLen − 20 + w(anchor) − (T4.right − T4.left)`;
  `t4p` is `pdLen − 20` wide, from `C.left + X + 10`.
- **Side span.** A side starts at `P[0]`, which is `S[0]` moved by the content delta (LS7). It ends at `P[N]`, `S[N]` moved by the content delta, when its allocation hands out the whole budget, and otherwise between `P[N]` and `P[0] + F` (LS9). It is not stretched to the window's outer edge.

## 6. Not decoded / unknown; corpus impact

### 6.1 Open questions (implementers stop here)

- **Q1** *Resolved 2026-10-22*: popup placement is §4.6a (PP1–PP7). What
  remains open is Q10.
- **Q2** Anchor-cell width after a title drop when neither half has a primary
  grower (TT5 leaves it at `E − Fb − Fa`). Whether that value can be positive
  on a too-short side, and what the tile blit then draws, is not established.
  No corpus window has been checked for this case.
- **Q3** *Narrowed 2026-10-22.* The trailing region `[S[N], extent)` and the
  leading region `[0, S[0])` are not segments. The whole full draw (`0x572e`)
  was walked: its only frame paints are the WD4 segment blits, the WD5 and WD6
  blits and the title text. So **no routine of the full draw paints either
  region**; a pixel there is painted only where a crossing side's segment,
  a WD5/WD6 blit, the title text or the untraced Q8 pair covers it. What the screen shows at an unpainted structure pixel is not
  decoded: the full draw composes into an offscreen buffer that is not erased
  in the traced code, and the structure region (`wCalcRgns`) is not traced.
  Painting these regions is a runtime policy, recorded as a divergence (§7.2
  F9).
- **Q4** *Resolved 2026-10-22*: the title text is §4.12 (TX1–TX9). It
  re-reads the title, so a layout drop does not suppress it; it is suppressed
  when the remapped `T4` has exactly zero width or height (TX3), which is what a drop
  produces when `T4` fills the anchor cell.
- **Q5** *Resolved 2026-10-22*: the hit region is the widget cicn's mask (HT8).
- **Q6** The exact-point hit fallbacks (§4.11) and the zoom state `0x466e`.
- **Q7** The meanings of `widgetFrame`, `noWidgets` and `outlineDraw`,
  `drawActive` = `hilited` (struct-layout inference), and `collapsed` (the
  Appearance selector is not in the pinned Traps.h).
- **Q8** `0x5b5a..0x5b78` (when not `collapsed`, a helper test `0x489c` gates
  two calls `0x480a`, `0x45b2` in the full draw) is untraced.
- **Q9** No native capture of any below-template window exists. Every row
  here is a static reading.
- **Q10** Who writes the popup data (`pdMode`, `pdX`, `pdLen`, `pdCentre`)
  after window creation. Nothing in the layout or the creation handler does
  after PP6; the writer, if any, is outside the traced code (an application or
  the system). PP7 declares the creation values.
- **Q11** The per-window flag that lets TX2 draw an empty title is not decoded.
- **Q12** The contents of the two placed-list slots TT4a reads at the list
  ends.

### 6.2 Corpus impact (re-derived 2026-10-22 from the 13 `wnd#` archives' recipes)

20 code-10 segments, in 5 archives. *Shrink* assumes every widget present
(codes 2/3/4 keep, 15/16/17 zero): the content may lose that many pixels on the
side's axis before TS1 fires. A segment marked "collapse box" contains a
rect-list type 3 widget wholly inside it. Rect tuples are (left, top, right, bottom) in template coordinates.

| archive | window type(s) | side | template span | shrink | widget inside |
|---|---|---|---|---:|---|
| 1138 | titled-utility, collapsed-titled-utility | top | [38,48) | 10 | collapse box [39,5,47,13] |
| 1138 | no-title-utility, collapsed-no-title-utility | top | [30,40) | 3 | collapse box [31,4,39,12] |
| 1138 | side-floating-utility, collapsed-side-utility | left | [29,39) | 3 | collapse box [4,30,12,38] |
| 1984 | document, collapsed-document | bottom | [41,75) | 1 | — |
| 1984 | document | right | [28,64) | 1 | — |
| 1984 | titled-utility | top / bottom | [19,35) / [7,54) | 6 / 1 | — |
| 1984 | side-floating-utility / no-title-utility | right / bottom | [7,34) | 1 | — |
| animals | document, collapsed-document | bottom | [31,44) | 35 | — |
| animals | titled-utility | top | [209,220) | 164 | collapse box [209,55,220,66] |
| apple-lisa | titled-utility | top | [30,42) | 5 | collapse box [32,3,41,12] |
| apple-lisa | no-title-utility / side-floating-utility | top / left | [27,38) | 5 | collapse box [29,1,38,10] / [1,29,10,38] |
| windows-95 | side-floating-utility | left | [29,40) | 2 | collapse box [5,29,15,40] |

- Of 211 manifest widget rects across the 13 archives (one per type per window type), every corner of every rect
  lies in a segment of code 1, 2, 3, 4 or 10. The 11 entries whose corners lie
  in a code-10 segment are all collapse boxes (above). So the far-edge rule
  (RM6) changes a widget rect only for those 11, and only below their shrink
  threshold.
- No side has a code-5 or code-6 segment outside an AP2 side (AW5 under AP3
  is unexercised).
- Every side list is in ascending border order.
- Rows no archive exercises: WD5, WD8, TT4a, LC1 (the runtime has no message
  stream). *Corrected 2026-10-22:* WD6 is exercised. All 13 `popup-window`
  types have rect-list type-5 and type-6 entries (both are zero rects in
  1990, dolphin-som and evolution, so only the 15×15 corner blit paints there), and the full draw runs WD6
  for every `popupFamily` window, the AP1 case below.
- *Corrected 2026-10-22.* AP1 is reachable: the `popup-window` type of all 13
  archives has a code-5 anchor on its top side, and the runtime sets
  `popupFamily` for a `popup-window` request (§2.3). TT8 is reachable on
  untitled windows (below).

Added 2026-10-22 (window-migration answers; scans of the decoded recipes and
chrome cicns, lane store `v2-lanes/window-widgets-answers/`):

- **Anchors.** 83 sides carry a code-5 segment, all of them top sides, each
  with exactly one. None has its anchor at segment 1 or `N`.
- **Untitled plates (TT10).** Of the 83 anchored sides, the 13 `popup-window` top sides take AP1 (the PP rows), not TT10. On the other 70, with `SW = 0` the plate width `(T4.left − S[anchor−1]) + (S[anchor] − T4.right)` is 0 on 52, positive on 9 (animals 6 types, 1–5 px; monkey-paradise 3 types, 3–6 px), and negative on 9 (1138 titled-utility and collapsed-titled-utility, −2; floppies 7 types, −1 or −2), where TT8 runs.
- **Side spans (LS9).** Of 502 sides with at least one segment, 150 (in 68
  window types, 11 archives) have `S[N]` different from the chrome cicn's drawn
  extent on the side's axis (the last column or row with alpha > 16, + 1): 88
  stop short of it and 62 run past it. Examples: 1138 document top 102 vs 103,
  1138 document left/right 26 vs 42.
- **Template bounds `B` (CR2, CR4).** The cicn bounds exceed the drawn extent
  on the axis of a bottom or right side with segments in 19 window types, 5
  archives (both states): animals 10 (popup-window, movable-alert,
  side-floating-utility, movable-modal, collapsed-no-title-utility,
  collapsed-titled-utility, dialog, collapsed-document, titled-utility,
  no-title-utility), beos-r503 document, crayon-os collapsed-document,
  evolution collapsed-document, monkey-paradise 6 (titled-utility,
  popup-window, no-title-utility, dialog, alert, movable-alert). The excess
  columns and rows are transparent (alpha ≤ 16), and no widget rect of type 1–3
  reaches into them.
- **Rect lists.** Of 138 `wnd#` resources, 137 rect lists start with a type-0 entry;
  crayon-os −14332 runs types 4, 1, 2, 3, 0, each once. Type 4 repeats in 8 (1990, dolphin-som, evolution and
  monkey-paradise, ids −14324 and −14322, four type-4 entries each); types 1–3
  never repeat. 32 have no type-4 entry, so their `T4` is the first entry's
  rect, `A`. A loader that keeps one rect per type, the last, therefore gives
  the same lookups and the same WD7/HT6 walks as the full list on this corpus.

## 7. Test hooks

### 7.1 Rule rows and mutations

| spec rows | rule row | mutation that must fail |
|---|---|---|
| PV5, LS1, LS2, LS8, TS1, TS2 | `tests/rendering-options/window-chrome-rules.mjs` `sideTooShort` + `cellClass` code 10 (the below-template sample −12, sourced traces, and the `E = F` boundary assertion in `window-chrome-rules.test.mjs`) | keep code 10 below the threshold; drop it at or above; count code 10 out of `F` |
| PV1–PV4, PV6–PV9 | `window-chrome-rules.mjs` `cellClass` (widget-gated codes are "unknown" while presence is not decoded) | swap the 2/15 polarity |
| AW1–AW3, AW6, AW7, AW9 | `allocateHalf` (nonnegative budgets only) | give 13/14 a primary share |
| AW8 | none: `allocateHalf` returns null on a negative budget | **a row no mutation can fail (finding)** |
| TS3, TS4 | none | **no rule row (finding)** |
| AP1–AP3, TT1–TT9 | none | **no rule row (finding)** |
| RM1–RM8, CR1–CR4 | `src/titleWidgets.test.mjs`, `tests/rendering-options/window-widget-remap.spec.mjs` (runtime tests; not implementer paths) exercise the runtime remap, not these rows. They assert the near-edge delta for `br`, which RM6 refutes for dropped cells (F1) | — |
| WD, HT, LC | none | — |

Hooks for the rows added 2026-10-22. None exists yet (finding); each names the
mutation it must fail, so a hook that cannot fail it does not count.

| spec rows | hook to add | mutation that must fail |
|---|---|---|
| LS9 | engine-diff window cells at template size for a side with `S[N]` short of the drawn extent (1138 document top) and one past it (1138 document left) | end the side at the window's full extent instead of `P[N]`; pin the last border to `P[N]` on floppies collapsed-document-window right |
| AW1a | a synthetic allocation with a width-0 code-12 segment and a code-8 grower | divide by the zero width, or give the code-12 cell a nonzero width |
| TT2a | a titled side with `R` between `W − titleLen` and `W` | apply a condensed width (`SWc < SW`), so the plate shrinks below `W`; the amended default is `SWc = SW` (F11) |
| TT4a | a synthetic side with its anchor at segment 1 and entry 0 coded 6 | subtract entry 0's width from `Fb` |
| TT10 | untitled document windows: animals (plate 5 px), 1984 (plate 0), floppies (TT8) | drop the plate to 0 on animals; keep the bezels; skip TT8 on floppies |
| PP1–PP7 | a `popup-window` cell set with `popupFamily` on (1138, animals) | lay the popup side out with the TT rows; ignore `pdLen`; use the `pdMode = −2` branch with the creation values |
| WD13 | a pressed widget whose remapped rect differs in size from its source, with transparent strip pixels | an opaque copy; tiling instead of scaling |
| HT8 | a press on a transparent pixel inside a widget's remapped rect, and on a stretched widget past its source width | hit on mask-clear pixels; scale the region to `p` |
| TX1–TX9 | title text placement on animals document (unequal margins) and a truncating title | centre on the plate; truncate without the condensed face; draw an untitled window's text |

### 7.2 Runtime cross-check (current `src/composeChrome.ts`, `src/renderWindow.ts`)

| runtime behaviour | spec row | verdict |
|---|---|---|
| `classifyPart` code 10: zero when too short, else fixed | PV5, AW4, AW6 | covered |
| `negotiateSides`: `fixed0` over segments ≥ 1 of the cells classed fixed; `extent` = recipe span + content delta; side order top, bottom, left, right | LS1, LS8, TS1, §2.1 | covered. The runtime sorts each recipe by border; the decode uses list order (equal on the corpus, §6.2) |
| too short → `fixed0 −= Σ10`, title dropped | TS1 | covered |
| still short and shade gap > 0 → shade absent for this and later sides | TS3 | covered |
| popup family with a code-5 segment skips the step | AP1 | covered for the step. The runtime does not draw the popup placement (PP1–PP7, decoded 2026-10-22) |
| `distributeHalf` clamps the budget to 0 | AW8 | **finding F2**: the decode does not clamp. Below the threshold the fixed cells after a negative grower move back. Already recorded in compositor-spec as a runtime limit |
| `distributeSide`, `dropTitle`: every 5/6 cell of the run gets 0 | AW5 via TT9 for the non-anchor cells; TT6/TT7 for the anchor | covered when a half has a primary grower; **finding F3** otherwise (Q2) |
| `distributeSide` half split (even split, or a grower-less half keeps its width) and the code-5 plate `max(src, titleWidthPx)` capped at `plateCap` | TT1–TT9 | **finding F4**: the decode places the plate on the content-rect centre with `W = SW + margins` (it can be narrower than the template cell), condenses before dropping, and drops at ≤ 2 px of room. The runtime split is not the decoded one |
| no widget stamp; a zero-width cell draws nothing | WD4, WD5 | covered. The partial-zoom pass (WD5) is not modelled; no procID 1026–1029 input exists |
| `resolveTitleWidgetRects`: sides in order, segments ≥ 1, half-open template match, corners independent, empty on a miss | RM2–RM5, RM7, RM8 | covered |
| `resolveTitleWidgetRects`: `br` translated by the cell's **near**-edge delta | RM6 | **finding F1**: the decode uses the far edge. In a dropped code-10 cell the collapse box becomes empty (not drawn, not hit). The runtime keeps a full-size hit and press rect at the collapse point |
| `resolveTitleWidgetRects`: no collapse rect when `shadeCleared` | TS3 + HT5, LC1–LC3 | covered for a message that ran the layout. **Finding F5**: under LC1 the decode re-derives `collapseRequested` from the procID table, so the HT5 gate passes again on a cached message. The collapse box is hit only where its remapped rect (from the cached placed lists) is non-empty. *Corrected 2026-10-22.* TS3 is not confined to one side. By TS1/TS3 it fires on any too-short side whose code-4 width exceeds its code-17 width (`G > 0`) once dropping code 10 still leaves `E < F`. With every widget present, that happens for some content size on 42 window types in 10 archives (1984, 1990, animals, apple-lisa, crayon-os, dolphin-som, evolution, floppies, monkey-paradise, windows-95). At content delta −12 it fires on 12 sides in 6 archives (1984, animals, evolution, floppies, monkey-paradise, windows-95). On 38 of the 42 types both corners of the collapse rect lie in the code-4 cell that TS3 zeroes, so RM5 and RM6 give it zero extent. On 2 more (1990 and monkey-paradise side-floating-utility) the bottom-right corner lies in that cell and the laid-out rect has height 0 and −2 respectively. These 40 types have no collapse hit on the cached message. The two exceptions are both dolphin-som. In side-floating-utility the collapse rect lies wholly in a top code-1 cell while TS3 fires on the left side (content height more than 18 below the template). In no-title-utility it lies wholly in a top code-3 cell while TS3 fires on the top (content width more than 18 below). There the remapped rect stays non-empty. On a cached message of a `cacheable` window (LC1, which needs `hasZoom` at creation), the original answers 9 (collapse box) where the laid-out message, like the runtime, gives no collapse hit. The runtime has no message stream (LC1 unexercised, §6.2), so this is a decode-internal difference the runtime cannot show |
| `distributeSide` grows each side over the full window extent (the drawn extent + the content delta, from `S[0]`), and stamps a far-edge cap past the last border on horizontal sides | LS7, LS9, AW8 | **finding F9** (2026-10-22): the decode budgets every side to end at `P[N] = S[N] + content delta`, and the growers share `P[N] − P[0] − F`. The side ends there whenever the allocation hands out the whole budget, which is every corpus side except the two in LS9. The decode and the runtime differ on the 150 corpus sides whose `S[N]` is not the drawn extent (§6.2): there the runtime stretches growers into the region past `P[N]`, or short of it. The runtime's far-edge cap is a runtime policy for a region the decode does not paint (Q3) |
| template band for bottom/right cells uses the drawable extent (`drawH`, `drawW`) | CR2, CR4 | **finding F6** (scope corrected 2026-10-22): the decode uses the template cicn bounds. They differ on the axis of a bottom or right side in 19 window types across animals, beos-r503, crayon-os, evolution and monkey-paradise (§6.2), not only beos's active document window. The excess is transparent and holds no widget, so under CopyMask the pixels drawn are the same; the cell rects, the remap's `t`/`p` for those sides and the window's outer size differ |
| `renderWindow` centres the title text on the code-5 plate and ellipsizes it to the plate's width | TX1–TX9, §5 "Title rect" | **finding F10** (2026-10-22): the decode draws the string left-aligned in the remapped `T4` (baseline 4 above its bottom), clipped to that rect + 2 px, truncated with TruncString in the condensed face only when it does not fit, and draws nothing for an empty title or a remapped `T4` of zero width or height (TX3 tests equality only; a negative-width rect is drawn into a clip of at most 1 px). The string is centred on the content rect's centre, so it matches plate-centring only where the margins around `T4` are equal |
| title text in the runtime's title font (not the original's Charcoal/Virtue bitmap faces) | TT2, TT2a, TX4, TX8 | **finding F11** (2026-10-23, runtime font substitution, DECISIONS #13): a deliberate divergence, not a decode gap. The runtime cannot reproduce the original's title fonts, so it departs from the decode in two places. (1) It has no condensed face, so TT2a's `SWc` is `SW`, the full drawn width (the TT2a amendment below §4.6). TT2 then never shrinks `W`, so a title the original would fit by condensing reaches TT3 or the TT6/TT7 cap at full width and is truncated sooner. (2) Its title font is taller than the original's. The decoded clip of TX4 (`t4p` widened by 2 on the right) and the decoded pen position (baseline `t4p.bottom − 4`, TX8, shadow at (+1, +1), TX7) are kept, except that when the drawn glyphs' ascent would start above `t4p.top`, the baseline moves down by exactly that overflow (baseline = max(`t4p.bottom − 4`, `t4p.top` + ascent)), so the glyphs fit the clip. (Amended 2026-10-23: a vertically widened clip was tried first and overdrew frame art on windows-31 and floppies.) No decoded row changes |
| hit and press areas are the remapped rect | HT7 | **finding F8**: the decode also requires the widget cicn to exist and the point to be in its region, and it gates every widget hit on `drawActive`, `widgetFrame` and the per-widget flags (HT1–HT5) |
| one `widgetPresent` flag for close, zoom and collapse | PV2–PV4, PV6–PV8 | **finding F7** (approximation already recorded in the faithfulness ledger) |

## 8. Corrections to the 2026-10-21 decode note

1. **Remap far edge (RM6).** The note said each corner is translated by "its
   own cell's delta", and that a widget in a dropped code-10 cell keeps its
   template size "at the collapse point … still hit-testable". In fact the
   bottom-right corner moves by the cell's far-edge delta. A widget inside a
   dropped cell is emptied, so it is neither redrawn nor hittable. The PM policy
   "an invisible collapse box stays hit-testable" (note §9.4) followed the
   refuted reading.
2. **The collapse-box clear is not recomputed on every message.** The note
   (§11, "resolved by the PR #377 review") missed the layout cache (LC1–LC3):
   for a `cacheable` window, every message except `wCalcRgns` with an unchanged
   content rect skips the layout, and `collapseRequested` comes back from the
   table.
3. **The widget hit is not rect-only** (HT7). It needs the widget cicn and its
   region. The note described the hit as "the same `0x5cb6` remap".

Everything else in the note re-traced as stated (evidence §R).

## 9. Window-migration questions (2026-10-22)

The window-recipe migration's 16 questions, by the rows that answer them.
Evidence: Part C of the evidence appendix.

| # | question | answer | rows |
|---|---|---|---|
| 1 | Does a side end at `P[N]`, not the full window extent? | Yes, decoded, wherever the allocation hands out the whole budget (LS9; two corpus AP3 sides end short). Added as F9 | LS7, LS9, AW7–AW9 |
| 2 | F6 scope | 19 window types in 5 archives, not only beos; pixels unchanged under CopyMask | CR2, CR4, §6.2, F6 |
| 3 | Untitled windows drop bezels and plate? | Bezels yes. The plate takes width `W` = its margins around `T4`: on the 70 non-popup anchored sides, 0 on 52, positive on 9, negative (TT8) on 9. `popup-window` sides take the PP rows instead | TT4, TT10, AW5, TT6–TT8, AP1 |
| 4 | Condensed StringWidth? | Decoded as a Font Manager measurement; runtime value declared | TT2, TT2a |
| 5 | Popup placement | Decoded from the popup data, not the TT rows | AP1, PP1–PP7 |
| 6 | Widget blit, transfer, hit region | Scale blit, CopyMask with the source cicn's mask; hit region = the cicn's mask, offset not scaled | WD13, HT7, HT8 |
| 7 | TT4 at anchor 1 or `N` | Slots the layout does not write; not decoded; declared default no subtraction; no corpus case | TT4a |
| 8 | Code 12 of width 0 | Width 0, no remainder contribution, decoded | AW1a |
| 9 | One rect per type in the loader | Equivalent on the corpus (types 1–3 never repeat; 137 of 138 lists start with type 0 and the other has each type once) | §2.1, §6.2 |
| 10 | Leading and trailing regions | No routine of the full draw paints them; the runtime's painting is a policy | Q3, LS9 |
| 11 | Draw order | Decoded order is sides 0..3 with CopyMask; the runtime's order with opaque copies is a recorded divergence | WD4, qd-primitives Q5 |
| 12 | Title text | Decoded | TX1–TX9, F10 |
| 13 | Zoom part 5 or 6 | Decoded as "5 or 6 by zoom state"; the state is not traced | HT4, Q6 |
| 14 | Inactive windows' widgets | Inert to the WDEF hit: every press answers `wInDrag`. No keyboard path in the decode. At rest, widget art is the template's own pixels (WD5 note); only the partial-zoom widget (WD5) is gated on `drawActive` | HT2, WD5 |
| 15 | 16-bit wrap | The decode wraps; every corpus value is in range | §1 arithmetic note |
| 16 | Layout cache | LC1 cannot arise without a message stream; LC2 with LC3 | LC1–LC3 |
