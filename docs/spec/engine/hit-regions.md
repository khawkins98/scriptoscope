# `window.regions` + `window.hit` — Kaleidoscope 2.3.1 window structure regions and frame hit-testing

Issue [#597](https://github.com/khawkins98/scriptoscope/issues/597), 2026-10-31.
Spec writer: lane 597 (decode researcher). Independent review: Tier 1 REQUEST CHANGES at `5aba2b9a` (decode confirmed, five spot-checks matched; citation, propagation and test-hook asks addressed in revision 2, 2026-10-31); **APPROVED** at `6d02a4e0` (Tier 1 re-check of the changed claims, PR #610). `kdef231-reference.md` was corrected in #611 (evidence E1).
Evidence appendix: [`hit-regions.evidence.md`](./hit-regions.evidence.md). Implementers must not read it.

## 0. Answer

1. **Recipe windows (`wnd#`).** The structure region is the content rectangle
   plus, for every placed frame cell, the chrome template's **mask** inside that
   cell's source rectangle, laid into the placed cell with the same tile or
   scale rule the frame draw uses (SR1–SR9). Masked-out (transparent) frame
   pixels are **not** in the structure region. Four procIDs (`plainDBox` 2,
   `altDBoxProc` 3, `kWindowPlainDialogProc` 1040, `kWindowShadowDialogProc`
   1041) instead get a plain rectangle (SR3, SR4).
2. **Built-in frame (no `wnd#`).** The structure region is built from
   rectangles only; no mask is consulted (PF1). There are no transparent frame
   pixels to exclude except the two 2-px notches at the ends of the 1-px shadow.
3. **Hit test.** Both families answer `wNoHit` (0) for exactly two cases: the
   window is not visible, or the point is outside the structure region (WH1,
   PF2). So a point over a transparent recipe-frame pixel answers `wNoHit`. No
   other path in either `wHit` returns 0.
4. **Window Manager side.** The Window Manager stores the region the kDEF builds
   in `strucRgn`. What `FindWindow` then does with a point outside every
   `strucRgn`, or with `wNoHit`, is Apple behaviour, not kDEF behaviour (OS1–OS4).
   The click-through observed in #540 is consistent with these rows. The Apple
   pages consulted do not state `FindWindow`'s search order (U1).

## 1. Unit id and scope

| field | value |
|---|---|
| unit id | `window.regions` (`wCalcRgns`, message 2, and message 8 codes 32/33) and `window.hit` (`wHit`, message 1) outer classification |
| family | window frame, both the recipe compositor and the built-in frame |
| binary | Kaleidoscope 2.3.1 `kDEF 0`, 107,726 B, SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` |
| cited range | `0x118b8..0x11912`, `0x1525a..0x152ba` (gates); `0x28e0..0x2962` (message switch); `0x2e02..0x321a` (per-procID flags); `0x3ac4..0x3bda` (calc regions); `0x3c24..0x3df6` (content); `0x3df8..0x3e6a` (structure); `0x6390..0x6580` (mask-traced structure); `0x11452..0x116f6` (tiled region); `0xece0..0xed6e`, `0xf6e0..0xf718` (mask region); `0x3f2c..0x41e6` (hit); `0x2d84..0x2dba` (message 8, codes 32/33); built-in frame `0x124d0..0x12808`, `0x1296a..0x129a4`, `0x1596c..0x15a7c` |
| out of scope | the widget branch of the hit (close/zoom/collapse: [`window-widgets.md`](window-widgets.md) HT1–HT8); the grow-rect geometry (window-widgets HG3); the built-in frame's own geometry ([`procedural-frame.md`](procedural-frame.md) §3.3, §9.2); a scheme-supplied `WDEF` −14330 code resource (scheme code, not Kaleidoscope's; no corpus bundle reaches it, U8); the popup/tab family's drawing |

### 1.1 Routing

| id | rule | source |
|---|---|---|
| RT1 | Document windows: when the scheme has `wnd#` −14336, every WDEF message goes to the recipe compositor **unchanged**, with the variation code reduced mod 16 | `0x118b8..0x11912` |
| RT2 | Utility windows: when the scheme has `wnd#` −14304, the message goes to the same compositor unchanged; the procID passed is 1984 + (variation mod 16), family 124 (`floatProc` family) | `0x1525a..0x152ba` |
| RT3 | The compositor dispatches the standard messages: 0 draw, 1 hit, 2 calc regions, 3 new, 4 dispose, 5 grow outline, 6 grow icon, 7 features, 8 get region | `0x292e..0x2962` (switch table at `0x292e`, default `0x2ddc`) |
| RT4 | Without the `wnd#`, the built-in frame handles the window (procedural-frame §1.1) | `0x11916`, `0x152be` |

## 2. Inputs

| input | meaning | values / domain |
|---|---|---|
| `C` | content rectangle in global coordinates (window-widgets §2.1 `C`); empty-height (or empty-width under `sideTitle`) when collapsed | Rect |
| procID | the variation code with its family, as passed by RT1/RT2 | `documentProc` 0 … 1046, 1984–1999 |
| `rectFrame` | per-procID: the frame is a plain rectangle | set for procIDs 2, 3, 1040, 1041 |
| `rectShadow` | per-procID: add the offset shadow | set for procIDs 3, 1041 |
| `collapsed`, `sideTitle`, `popupFamily`, `drawActive`, `widgetFrame`, `growEnabled` | as window-widgets §2.2 | booleans |
| chrome template | the `cicn` the full draw blits the frame cells from, chosen for this message (it differs with `drawActive`) | cicn with pixel image and 1-bit mask |
| template mask region | the chrome template's mask converted to a region (`$A8D7` BitMapToRegion) in template coordinates; empty when the conversion fails | Region |
| `A`, `B` | template body rect (rect-list type 0) and template bounds, as window-widgets §2.1 | Rect |
| frame cells | for each side and entry *i* = 1..N, the source rect in template coordinates and the placed rect in global coordinates, from the same cell routine the full draw uses; each cell carries its part code | from window-widgets §4 (cell rects) |

## 3. Outputs

- `strucRgn` and `contRgn` of the window (global coordinates), written on `wCalcRgns`.
- The same regions into the caller's region for message 8 codes 32 (`kWindowStructureRgn`) and 33 (`kWindowContentRgn`).
- A `wHit` result code from `MacWindows.h` (`wNoHit` 0, `wInContent` 1, `wInDrag` 2, `wInGrow` 3, `wInGoAway` 4, `wInZoomIn` 5, `wInZoomOut` 6, `wInCollapseBox` 9).

## 4. Decision tables

### 4.1 Calc regions (`wCalcRgns`)

| id | condition | result | source |
|---|---|---|---|
| CR1 | always, first | if the window has a zoom box, the zoom-state helper runs (it does not shape either region) | `0x3ad0..0x3ad6` |
| CR2 | `C` is exactly 32000 × 32000 | both regions are the rectangle `C`; nothing else runs | `0x3ae6..0x3b18` |
| CR3 | otherwise | content region (§4.4), then structure region (§4.2) | `0x3b1c..0x3b32` |
| CR4 | message 8, code 32 / 33 | the same structure (§4.2) / content (§4.4) builders, into the caller's region | `0x2d84..0x2dba` |

CR1's companion step after the regions, for `altWidgets`, non-utility-frame,
zoomable windows of a particular window kind, may move the window to fit its
device. It changes the window's position, not the region shapes (`0x3b38..0x3bd2`).

### 4.2 Structure region, recipe windows

| id | condition (in order) | structure region | source |
|---|---|---|---|
| SR1 | `rectFrame` and `rectShadow` | `C` outset 1, unioned with the same rectangle shifted (+2, +2) | `0x3e0e..0x3e48` |
| SR2 | `rectFrame` only | `C` outset 1 | `0x3e4a..0x3e58` |
| SR3 | otherwise, no chrome template loaded | **left unchanged** (the builder writes nothing) | `0x639c..0x63a0` |
| SR4 | otherwise, width(`C`) ≤ 1 and height(`C`) ≤ 1 | one rectangle: left = `C.l − A.l + B.l`, top = `C.t − A.t + B.t`, right = `C.r − A.r + B.r`, bottom = **`C.r`** `− A.b + B.b` (the decode uses the content's right edge in the bottom term; see U4) | `0x63d8..0x643c` |
| SR5 | otherwise | start with the rectangle `C`, then union the cells of SR6 | `0x63a4..0x63b2` |
| SR6 | sides walked | all four sides; when `collapsed`, only sides 0 and 1 (top, bottom), or 2 and 3 under `sideTitle` | `0x644c..0x646c` |
| SR7 | each entry *i* = 1..N of a walked side whose placed rect is non-empty | the cell contribution: the template mask region intersected with the cell's source rect, then placed by SR8/SR9 | `0x64ac..0x64de` |
| SR8 | cell part code 18 | mapped (scaled) from source rect to placed rect (`$A8FB` MapRgn) | `0x64e0..0x651a` |
| SR9 | any other part code | tiled into the placed rect (§4.3), direction 0 for part codes 11 and 14, else 1 | `0x651c..0x6542` |

Consequences (each follows from SR5–SR9):

| id | statement |
|---|---|
| SR10 | A pixel of a placed frame cell is in the structure region **iff** its corresponding template pixel (under the tile or scale rule) has its mask bit set, or the pixel lies in `C`. Transparent frame pixels are excluded. |
| SR11 | The rectangle `C` is always included, whatever the template's body pixels are. |
| SR12 | Pixels covered by no placed cell of any walked side (for example the leading `[0, S[0])` region where no crossing side reaches; window-widgets Q3) are excluded. |
| SR13 | Only the chrome template's mask counts. Pressed-widget art from the −14330 family and title text are not part of the region. |
| SR14 | The template is the one for the window's `drawActive` state at the time of the calc. |

### 4.3 Tiled cell region (SR9)

Let `sw`, `sh` be the source size and `dw`, `dh` the placed size.

| id | condition | contribution | source |
|---|---|---|---|
| TR1 | `sw ≤ 1` or `sh ≤ 1` | the masked source is **scaled** to the placed rect | `0x1148a..0x114ac` |
| TR2 | `sw = dw` and `sh = dh` | the masked source moved 1:1 | `0x114b0..0x114ee` |
| TR3 | otherwise, direction 1 | the masked source is anchored with its top-left at the placed rect's top-left, repeated at pitch `sw` along x and `sh` along y, clipped to the placed rect | `0x11520..0x1159c`, `0x1159e..0x115fa` |
| TR4 | otherwise, direction 0 | the same, anchored bottom-right to bottom-right, repeating toward the top-left | `0x11600..0x116da` |

TR3/TR4 repeat on **both** axes. The frame blit tiles along one axis
([`qd-primitives.md`](qd-primitives.md)); the two agree whenever a cell's cross-axis
size equals its source's. Other cells are U3.

### 4.4 Content region, recipe windows (context)

| id | condition | content region | source |
|---|---|---|---|
| CN1 | `popupFamily` | `C`, minus the masked type-5 and type-6 template rects placed at `C`'s top corners, minus the 16 × 16 corner square at `C`'s bottom-right (outset 1 past `C`) | `0x3c34..0x3d56` |
| CN2 | `collapsed` | empty (its bounding box is set to `C`) | `0x3d5a..0x3d72` |
| CN3 | otherwise | `C`, minus the grow rectangle when the grow box belongs to the frame and `growEnabled`; under `noWidgets` with Gestalt `'Copl'` and `cicn` −14310 present, minus that cicn's (−14309 when `drawActive`) mask at the grow rect instead | `0x3d74..0x3dee` |

### 4.5 Hit test, recipe windows (`wHit`)

Rows in order; the first match wins. WH3–WH5 restate window-widgets HG2–HG5.

| id | condition | result | source |
|---|---|---|---|
| WH1 | window not visible, or `$A8E8` PtInRgn(point, `strucRgn`) false | **0 `wNoHit`** | `0x3f38..0x3f66` |
| WH2 | (no other row returns 0) | — | `0x3f2c..0x41e6` |
| WH3 | not popup, not collapsed, `growEnabled`, point in the grow rect (window-widgets HG3) | 3 if `drawActive`, else 1 | `0x3f6a..0x3fb2` |
| WH4 | point in `contRgn` | 1 | `0x3fb6..0x3fc6` |
| WH5 | `popupFamily` | 2, overridden by 3 for a point in the masked type-5 or type-6 rect placed at `C`'s top corners, overridden by 1 for a point in (`C.r − 15`, `C.b − 15`, `C.r`, `C.b`); 2 when no template is loaded | `0x3fd2..0x4118` |
| WH6 | `widgetFrame` clear | 1 `wInContent` | `0x411c..0x4120` |
| WH7 | `drawActive` clear | 2 `wInDrag` | `0x4124..0x4128` |
| WH8 | close / zoom / collapse widget hit (window-widgets HT3–HT8) | 4 / 5 or 6 / 9 | `0x412c..0x41dc` |
| WH9 | otherwise | 2 `wInDrag` | `0x41e0` |

Thus, for a point that is in the window's placed frame cells:

| point | `widgetFrame` set (e.g. procIDs 0, 4, 5, 8, 12, 13, 1024–1031, 1043, 1045, 1046, utility) | `widgetFrame` clear (procIDs 1, 2, 3, 1040, 1041, 1042, 1044, unlisted variation codes) |
|---|---|---|
| transparent frame pixel, outside `C` | 0 (WH1) | 0 (WH1) |
| transparent pixel inside the grow rect | 0 (WH1 precedes WH3) | 0 |
| opaque frame pixel, active window | 4/5/6/9 on a widget, else 2 | 1 |
| opaque frame pixel, inactive window | 2 | 1 |

### 4.6 Built-in frame (no `wnd#`)

| id | rule | source |
|---|---|---|
| PF1 | The structure region is rectangles only: procedural-frame §3.3 (document family) and UG2/UG3 (utility). No mask contributes. Its only excluded pixels inside the bounding box are the two 2-px notches the (+2, +2) shadow union leaves at the top-right and bottom-left | `0x125e0..0x12808`, `0x1596c..0x15a7c` |
| PF2 | `wHit` returns 0 only when the window is not visible or the point is outside the structure region (procedural-frame HT1, UH1) | `0x1296a..0x129a4`, `0x15aec..0x15b22` |
| PF3 | Masked widget glyphs, the masked grow box and other masked art lie inside the rectangular region, so their transparent pixels answer a non-zero part (procedural-frame HT2–HT9) | `0x1296a..0x12b7e` |

### 4.7 Window kinds and flags

| id | rule | source |
|---|---|---|
| WK1 | Document windows, movable dialogs, alerts, modal dialogs, utility (family 124) and floating (66/67) recipe windows all use the mask-traced structure (SR5–SR9) | `0x2e6c..0x321a`, `0x3e08` |
| WK2 | Only procIDs 2, 3, 1040 and 1041 use the rectangle (SR1, SR2). No other procID sets `rectFrame` | `0x2f3c`, `0x2f46`, `0x308c`, `0x309a` |
| WK3 | Kind changes what an **opaque** frame pixel answers (WH6–WH9), not whether a transparent one answers 0 | `0x411c..0x41e0` |
| WK4 | Collapsed windows keep only the title-axis sides (SR6); their content is empty (CN2) | `0x644c..0x646c`, `0x3d5a` |
| WK5 | The public runtime has no procID; which public window types correspond to which procIDs is not established here (window-widgets §2.3) | — |

### 4.8 Apple-side (Window Manager), not kDEF

| id | rule | authority |
|---|---|---|
| OS1 | `wCalcRgns` must compute the structure and content regions, in global coordinates, into the window's `strucRgn` and `contRgn` | Inside Macintosh: Macintosh Toolbox Essentials, ch. 4, "Defining Your Own Windows" (`wCalcRgns`); `MacWindows.h` `wCalcRgns = 2` |
| OS2 | `wNoHit` "might mean (but not necessarily) that the point isn't in the window" | same section, "Returning the Region of a Mouse-Down Event" |
| OS3 | `FindWindow` maps a mouse-down to a screen area; it may return `inDesk` (0) for a press on a window frame outside the title bar and boxes, and then sets the window to NIL when the press was in no window | IM: Toolbox Essentials, ch. 4, "FindWindow"; `MacWindows.h` `inDesk = 0` |
| OS4 | Which window `FindWindow` asks, in what order, and whether it tests `strucRgn` itself before sending `wHit`, is **not** stated in the pages consulted (U1). Two sub-hypotheses: OS4a, `FindWindow` skips a window whose `strucRgn` excludes the point; OS4b, it sends `wHit` and continues behind after `wNoHit`. With this kDEF they predict the same outcomes (U1). Other windows and the desktop draw where this window's `strucRgn` excludes pixels, which is consistent with the desktop showing through the gaps in #540 | U1 |

**Observation (not decode).** In #540, real Kaleidoscope 2.3.1 on System 7.5.5
(Castle, Brickworks): a click between merlons or studs selected the desktop icon
underneath and deactivated the window. WH1 with SR10 predicts the kDEF half of
that (`wNoHit`, and the point is not in `strucRgn`). The Window Manager half
(the click reaching the desktop) is OS behaviour, U1.

## 5. Geometry

All rectangles are QuickDraw (left, top, right, bottom), right and bottom
exclusive, global coordinates. "Outset 1" grows each side by 1.

- SR1: `S = (C.l − 1, C.t − 1, C.r + 1, C.b + 1)`; region = `S ∪ (S + (2, 2))`.
- TR3 contribution = `⋃_{m,n ≥ 0} (mask ∩ src) + (dst.l − src.l + m·sw, dst.t − src.t + n·sh)`, intersected with `dst`.
- TR4 contribution = `⋃_{m,n ≥ 0} (mask ∩ src) + (dst.r − src.r − m·sw, dst.b − src.b − n·sh)`, intersected with `dst`.
- SR8 and TR1: QuickDraw MapRgn from `src` to `dst` (QuickDraw's own scaling; not re-derived here).

## 6. Not decoded / unknown; corpus impact

- **U1** (Apple-side). `FindWindow`'s walk: whether it skips windows whose
  `strucRgn` excludes the point before sending `wHit` (OS4a), or sends `wHit`
  and continues to the windows behind after a `wNoHit` (OS4b). **Neither capture
  below can separate OS4a from OS4b**: for this kDEF `wNoHit` happens exactly
  when the point is outside `strucRgn` (WH1, PF2), so both sub-hypotheses
  predict the same outcome. Only a WDEF that answers 0 *inside* its `strucRgn`
  could separate them, or a disassembly of the System 7.5.5 `FindWindow`. That
  is enough for #597, which needs the outcome, not the mechanism.

  **Capture plan** (private reference environment,
  `docs/maintainer-reference-environment.md`; CONTRIBUTING "Fidelity acquisition
  and implementation batches"). Predictions are frozen in this table before
  boot.

  | field | value |
  |---|---|
  | scheme archive | Castle `scheme.bin`, SHA-256 `5a22c49854fca78972e2f442ddb2cbdbf17e42ecdfca598322f83eac4b14291c` (PR #540 branch at `d98fe538`, `authoring/schemes/castle/classic/README.md`). The bytes are **not committed**; only the hash is. Take them from the private asset store copy used for the #540 boots, or regenerate them with the #540 authoring build at `d98fe538`. Either way, re-hash before boot and stop on mismatch |
  | capture condition | **8-bit calibrated** boot (the reference environment's default), `nosound true`. The outcome is which window or desktop object receives the click, which does not depend on pixel depth; depth is recorded, not varied, and no pixel comparison is made |
  | windows | Finder windows of the transfer disk. Window F (front): a document window, content rect recorded from the native frame. Window B (back, case 1 only): placed so its opaque title bar or content lies directly under F's merlon row. Record both windows' frame rects in global coordinates from the native frame before clicking |
  | recipe check | Before boot, decode the archive's document `wnd#` top-side list and confirm that the merlon cells (`crenL`/`crenR` in `authoring/schemes/castle/frames.mjs`) carry part code 12. If they carry another code, correct this table (the click-point rule and the cases) and freeze the amended version before boot |
  | click point rule | Before boot, decode the archive's document chrome template and placed top side for F's recorded width; choose the first pixel, left to right on the middle row of the merlon band, whose template mask bit is clear and which lies in a code-12 (merlon) cell outside `C`. Record its global (x, y) in the frozen table. For control, the nearest mask-set pixel in the same row |
  | budget | **two boot attempts**. If neither yields both cases cleanly (window placement as recorded, a single click, the frame captured before and after), stop and report; do not iterate |

  | case | point | prediction (frozen) | refutes |
  |---|---|---|---|
  | 1 | F's gap pixel, B's opaque pixel beneath | B is activated or receives the click (Finder brings B to the front); F is deactivated | WH1/SR10 if F keeps the click; "desktop only" pass-through if the desktop gets it |
  | 2 | F's gap pixel, desktop beneath (a desktop icon placed there) | the desktop icon is selected and F is deactivated (as in #540) | WH1/SR10 if F starts a drag |
  | 3 (control) | F's mask-set pixel next to the gap | F is dragged or activated (`wInDrag`); nothing beneath changes | the mask reading if the click passes through |
- **U2** (Apple-side). Whether the Window Manager recalculates regions when only
  the hilite state changes. SR14 makes the region follow the template chosen at
  the last calc, so this matters only when a scheme's active and inactive
  templates have different masks. Settle with a corpus count of mask differences
  between each active/inactive template pair, then, if any exist, a native
  capture clicking a pixel whose mask differs, after activation only.
- **U3.** Equality of the region (two-axis repeat) and the drawn pixels
  (one-axis tile) for cells whose cross-axis size differs from the source. Settle
  by enumerating corpus cells with both axes changed, then tracing the blit for
  them.
- **U4.** SR4's bottom term reads the content's right edge. Probably an original
  slip; it fires only for content of at most 1 × 1. Implement as decoded or
  record a ledger divergence; do not "fix" silently.
- **U5.** SR3: with no template loaded, `strucRgn` keeps its previous value
  (empty after `NewWindow` per the Window Manager's allocation, Apple-side,
  unverified). Settle by finding a load path that yields no template.
- **U6.** The grow-box-in-frame predicate used by CN3 is only partly traced
  (`0x489c`). It affects the content region, not the structure region.
- **U7.** Corpus impact is unmeasured: how many frame-cell pixels per recipe
  scheme have a clear mask. Measure with a script over the 13 recipe bundles
  (and the authored schemes in #540) before choosing a policy.
- **U8.** A scheme-supplied `WDEF` −14330 code resource replaces both families'
  behaviour; its regions are whatever that code computes. The slot-3 gate checks
  `wnd#` first and the five recipe-less bundles ship no `WDEF`, so no corpus
  bundle reaches it.
- **U9.** The origin of CR2's 32000 sentinel is not traced.

Corpus: 13 bundles reach §4.2 (every bundle with `wnd#`); 5 reach §4.6
(`apple-platinum-2`, `black-platinum`, `platinum-8`, `slimes`,
`system7-nostalgia-silver`).

## 7. Test hooks

Assertions a rule table or engine test must make, each with a mutation that
must make it fail. "Classify" means: build the structure region (§4.2), then
the hit result (§4.5).

| hook | assertion | mutation that must fail it |
|---|---|---|
| T1 (SR10, WH1) | A recipe window with a template whose frame cell has a mask-clear pixel outside `C`: that pixel is not in the structure region and classifies to 0 | build the structure from the placed cell rects without the mask |
| T2 (SR10) | A mask-set pixel of the same cell is in the region and classifies non-zero. Fixture: a mask-set pixel whose colour equals the window's background colour | invert the mask; derive membership from pixel colour ≠ background instead of the mask |
| T3 (SR11) | A template whose body (type-0 rect) is fully transparent still has all of `C` in the region | union only cells, not `C` |
| T4 (TR3, TR4, SR9) | Fixture: a 3 × 2 source whose mask is not uniform along either axis (e.g. rows `110`, `100`), placed into 8 × 5 (neither size a multiple of the source). The mask repeats at the source pitch from the top-left for direction 1 and from the bottom-right for codes 11/14, clipped to the placed rect | scale the cell; anchor codes 11/14 at the top-left (or direction 1 at the bottom-right) |
| T5 (SR8) | Fixture: a code-18 cell with a non-uniform mask (e.g. a 2 × 2 checker) placed at a larger size (e.g. 6 × 6). Its mask is scaled (3-px blocks), not repeated (2-px period) | tile code 18 |
| T6 (TR1) | Fixture: a 1 × 4 source whose mask rows are 1, 0, 1, 0, placed into 8 × 8 (both axes differ). The region is the scaled source: 2-px horizontal bands | repeat it (that gives 1-px alternation); clip instead of scaling along the long axis |
| T7 (SR1, SR2, WK2) | procIDs 2 and 1040 give `C` outset 1; 3 and 1041 add the (+2, +2) shadow; their transparent template pixels do not matter | mask-trace these procIDs |
| T8 (SR12) | A pixel in a leading region reached by no crossing side classifies to 0 | fill the structure's bounding box |
| T9 (WH1 before WH3) | A transparent frame pixel inside the grow rect classifies to 0, not 3 | test the grow rect before the structure region |
| T10 (WH2) | Over a grid of points around any window, 0 occurs only outside the structure region or for an invisible window | return 0 for "frame, not title" points (the Apple standard-WDEF reading of OS2) |
| T11 (WH6) | With `widgetFrame` clear, an opaque frame pixel classifies to 1 | return 2 |
| T12 (SR6, CN2) | Collapsed: only the title-axis sides contribute; the bottom (or the far side) cells do not | walk four sides when collapsed |
| T13 (PF1, PF3) | Built-in frame: a transparent widget-glyph pixel is in the structure and classifies non-zero | mask-trace the built-in frame |
| T14 (SR13) | A pressed-state widget whose −14330 art paints outside the template mask, and title text over a mask-clear pixel, do not extend the region | union the drawn canvas alpha; use the template's pixel alpha after title/widget drawing |

## 8. Implications for the web runtime

Today the whole template box belongs to the window: a press on a transparent
frame pixel starts a drag and never reaches the page (#597;
`docs/authoring-exotic-frames.md` R15/R16 on the #540 branch). The decode says
classic excludes those pixels from the window (SR10, WH1). This is now a decoded
divergence, not an untraced one. Policy options (this lane does not choose; the
implementation is a later lane with a PM decision and a ledger row):

1. **Status quo, documented.** Keep the rectangular hit box and record a ledger
   divergence citing SR10/WH1. Cheapest; the tall-ornament schemes keep blocking
   clicks to the page behind.
2. **Structure mask + pass-through.** The engine emits a structure bitmap
   built by SR1–SR13 (not from the canvas alpha, see T2/T14). `pointer-events`
   is per element, not per pixel, and a `pointerdown` already dispatched to the
   host keeps its target, so it cannot "fall through". Two real variants:
   - **2a. Hover toggle.** On `pointermove` (and `pointerover`), test the point
     against the bitmap and set `pointer-events: none` on the chrome layer while
     the pointer is over an excluded pixel. The next native `pointerdown` then
     targets the element beneath: trusted, with all default actions (focus,
     text selection, link activation, form controls). Costs: it relies on a
     hover move before the press, so it fails for touch and for pens without
     hover, and for a press with no prior move; the state must be reset when
     the pointer leaves or the window moves under a still pointer.
   - **2b. Synthetic re-dispatch.** On the press over an excluded pixel, hide
     the host from hit testing, find the target with `document.elementFromPoint`,
     and dispatch a synthetic pointer/mouse event to it. Works for touch. Costs:
     the event is `isTrusted: false`, so the browser runs no default actions (no
     focus change, no text selection, no link activation, no native form-control
     behaviour); pointer capture, click synthesis and `click`/`dblclick`
     sequencing must be re-created by hand, and listeners that check
     `isTrusted` ignore it.
3. **CSS `clip-path` from the region.** Convert the region (a union of
   rectangles) to a `clip-path: path(...)` on the chrome layer. Hit testing
   honours `clip-path` natively (CSS Masking 1), so no re-dispatch is needed.
   Costs: a large path for detailed masks, recomputation on every resize, DPR
   and CSS-transform interplay, and the window shadow, which must be drawn
   outside the clipped element. `clip-path` also clips the clipped element's
   focus outline/ring and any descendant overflow (menus, tooltips, the grow
   overlay) that extends past the region, which conflicts with "keyboard focus
   unaffected" below unless the focus ring and overflow live outside the
   clipped element.
4. **`mask-image` is not an option by itself**: CSS masks do not change hit
   testing.

Whichever option is chosen must keep: keyboard focus and keyboard move/resize
unaffected; title widgets' existing mask hit (window-widgets HT8, authoring R24);
the grow overlay (window-widgets WM381) with T9's order inside the original grow
rect; `C` fully hittable (SR11); and an opt-out for consumers.
