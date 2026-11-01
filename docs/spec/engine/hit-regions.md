# `window.regions` + `window.hit` — Kaleidoscope 2.3.1 window structure regions and frame hit-testing

Issue [#597](https://github.com/khawkins98/scriptoscope/issues/597), 2026-10-31.
Spec writer: lane 597 (decode researcher). Independent review: Tier 1 REQUEST CHANGES at `5aba2b9a` (decode confirmed, five spot-checks matched; citation, propagation and test-hook asks addressed in revision 2, 2026-10-31); **APPROVED** at `6d02a4e0` (Tier 1 re-check of the changed claims, PR #610). `kdef231-reference.md` still awaits the pinned-hash correction (evidence E1).
Evidence appendix: [`hit-regions.evidence.md`](./hit-regions.evidence.md). Implementers must not read it.
Revision 3 (2026-10-31, spec writer lane 597p): adds §9, the web host policy, from the maintainer's #597 decisions. The decode in §0–§7 is unchanged in substance. Only three lines touch it: a pointer to §9 after §0, U7's status in §6, and the "chosen" note in §8. §9 is policy, not decode. Revision 3b records the Q1–Q4 answers. Revision 3c addresses the §9 review at `ddaefb1e` and the maintainer's review decisions 1–3. Revision 3d addresses the re-review at `595591f9` (R1–R3). Revision 3g (2026-11-01): HP48 declares the title axis per public window type; WK5 points to it. Revision 3f (2026-11-01): focus rings in both modes, grow-box identity across collapse, and the side-title axis from the window kind. Revision 3e applies the PM's rulings on the implementer's questions (2026-11-01): tab order, HP7's reachable cases, collapsed SR6, optional reuse, debug labels and HP47 timing.

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

Web host policy is not part of this decode; see §9.

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
| WK5 | The public runtime has no procID; which public window types correspond to which procIDs is not established here (window-widgets §2.3). The web policy does not need it: §9 HP48 declares each public type's title axis directly, without a procID | — |

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
- **U7.** *Measured 2026-10-31 (issue #597).* At content 320 × 200, 7 of the
  13 recipe themes have document-window gaps large enough to click on purpose
  (animals, monkey-paradise, dolphin-som, evolution, 1990, beos-r503, 1984).
  `popup-window` has an 8–17% band in 10 of 13. Four of the five #540 schemes
  are heavily affected. The built-in frame has 4 px. Policy: §9.
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
divergence, not an untraced one. Policy options. **Chosen 2026-10-31: option 3,
with region mode on by default for recipe windows and a box opt-out; see §9.**

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

## 9. Web host policy (#597)

**This section is policy, not decode.** §0–§7 state what Kaleidoscope 2.3.1
does. §9 states what the Scriptoscope web runtime does with that, and why.
Every row cites the decode rows it implements or departs from. Row ids: `HP`
(host policy rules), `HPT` (policy test hooks). They never reuse §4 or §7 ids.

Basis: maintainer decisions on #597, 2026-10-31, all recorded on the issue.

1. Clicks on frame pixels outside the structure region pass through to the page.
   This is on by default for recipe (`wnd#`) windows.
2. Consumers can opt out to the box hit area.
3. The mechanism is a CSS `clip-path` built from the decoded structure region
   (§8 option 3).
4. A ledger divergence records the gap until this ships
   (`kdef-faithfulness-ledger.md`, `host→decode`).
5. Q1: clip an inner layer, not the host (§9.5).
6. Q2: match the original. A press that passes through to page content
   deactivates the active window (§9.5a).
7. Q3: add a page-wide default on the `WindowManager`, overridden per window,
   with the same unknown-value handling (HP14, HP41).
8. Q4: the bare `renderWindow()` element is never clipped (HP2).
9. Review decision 1: windows opened with `openModal` keep the box hit area and
   are exempt from region mode (HP42). Classic modal dialogs never let clicks
   escape, so a frame gap must not close the modal.
10. Review decision 2: `box` restores the full pre-#597 behaviour, with no clip
    and no outside-press deactivation. `region` mode gets both (HP1, HP38).
11. Review decision 3: mouse and pen deactivate on press, as the original did.
    Touch deactivates only on a completed tap (a `click`), never on a scroll or
    swipe (HP39).
12. Follow-up decision (recorded on #597): outside-press deactivation follows
    the **requested** hit mode, not the effective one. Windows that request or
    inherit `region` deactivate on outside presses even when they are exempt
    from clipping (built-in frames, HP4). Only an explicit `box` request, per
    window or as the manager default, turns deactivation off. Modals stay exempt
    (HP42).

U7 is measured (issue #597): with the box hit area, 7 of the 13 recipe themes
have frame gaps large enough to click on purpose in the document window, and
`popup-window` has an 8–17% transparent band in 10 of 13.

### 9.1 Modes and scope

| id | rule | basis |
|---|---|---|
| HP1 | Every managed window has a requested hit mode and an effective hit mode, each `region` or `box`. The two modes govern two things. **Clipping follows the effective mode.** Effective `box`: the window's whole chrome box receives every press, and nothing is clipped. Effective `region`: a point hits the window only if it lies in the structure region `S` (§4.2) built for the current commit. At any other point inside the box, the browser hit-tests whatever lies beneath (another window, page content or the document). **Outside-press deactivation follows the requested mode** (§9.5a). A window that requests or inherits `region` is deactivated by outside presses, even when its effective mode is `box` (HP4, HP7, HP44). The exceptions are modal-exempt windows (HP42) and windows inside closed shadow roots (HP47). An explicit `box` request, per window or as the manager default, is the full pre-#597 behaviour **in hit area, clipping and deactivation**: the whole box hits, nothing is clipped, and outside presses do not deactivate. Focus-ring painting is not part of that guarantee. It improves in both modes (HP28). | decisions 1, 2, 10, 12; SR10, WH1; PM ruling 2026-11-01 (focus rings) |
| HP2 | Scope: windows managed by `WindowManager`, both declarative (`data-scriptoscope-window`) and imperative (`WindowManager.add`). The bare `renderWindow()` element has no host, decoration layer or lifecycle, so it is never clipped. | decision 8 (Q4) |
| HP3 | The requested mode comes from HP10, HP11 and HP14. The effective mode is decided at **each commit**, and again on each mode-only change (HP11, HP41, HP42). It is `region` iff all of the following hold. (a) The request is `region`. (b) The window type that actually rendered is a recipe window: after base-chain resolution (the resolved owner's window type, not the requested theme's slug), it has a `wnd#` recipe (model other than `corner-sprite`) and a loaded chrome template. (c) The window is not modal-exempt (HP42). (d) The region build at the last commit succeeded and is non-empty (HP22, HP44). A mode-only change uses the `S` built at the last commit and never builds one itself. Otherwise the effective mode is `box`. | decisions 1, 9; RT1, RT2, RT4 |
| HP4 | **Built-in frame (no `wnd#`) is exempt:** the effective mode is `box`. This covers `apple-platinum-2`, `black-platinum`, `platinum-8`, `slimes` and `system7-nostalgia-silver`, plus any base chain that resolves to them. Why: PF1's only excluded pixels are the two 2-px notches at the ends of the shadow, 4 px per window. No 5 × 5 neighbourhood fits in them (U7), so nobody clicks there on purpose. Clipping would add a stacking context, the decoration layer (§9.5) and a per-commit path to five themes, for no usable gain. The exemption covers clipping only. Under decision 12, these windows still deactivate on outside presses unless `box` was requested explicitly (HP38), as the original did in the #540 capture. The kept notches are a permanent divergence, recorded in the ledger. | PF1, PF2; U7; decision 12 |
| HP5 | The rect-only procIDs 2, 3, 1040 and 1041 are unreachable: no public slug maps to them (WK5). If a mapping is added, they are recipe windows under HP3, and `S` is the SR1/SR2 rectangles. **No hook:** no public input reaches them. | SR1, SR2, WK2, WK5 |
| HP6 | The no-chrome baseline window (nothing in the base chain ships window chrome) is `box`. It has no decoded structure region. | policy |
| HP7 | **No region available: `box`.** Two cases are reachable. (a) A recipe window type that has no chrome template (SR3). **Departure:** the decode leaves `strucRgn` unchanged (empty after `NewWindow`, U5). An empty region would make the window unclickable, so the web keeps the box. (b) A region build that fails (HP44). A chrome template that exists but **fails to load** is out of scope: `renderWindow` rejects, `WindowManager.add` rejects, and no window exists to fall back (PM ruling, 2026-11-01). | SR3, U5; HP44 |
| HP8 | Collapsed recipe windows are in scope. `S` keeps only the title-axis sides and an empty `C`, so the former content area is not part of the window. The title-axis sides are top and bottom, or left and right for side-titled kinds. **The title axis comes from the public window type (HP48), never from the runtime layout's `sideTitle` flag** (PM ruling, 2026-11-01). That flag is a declared default that the runtime never sets (window-widgets §2.3). Side-titled types walk sides 2 and 3 (left, right) when collapsed; every other type walks 0 and 1 (top, bottom). `C` contributes nothing while collapsed, whichever axis it is emptied on (CN2). **Runtime layout (PM question, 2026-11-01).** The runtime draws a collapsed recipe window at content height 0, with the layout's collapsed flag unset, so it lays out and draws all four sides. Building `S` from that same layout with all four sides walked meets HP15's "same layout as drawn" rule, but it does **not** meet SR6. Measured with the U7 method at content width 320, it differs from SR6 in 2 of the 48 collapsed kind and activation rows: animals `collapsed-titled-utility` (16 px) and animals `collapsed-no-title-utility` (3 px), in both activation states. In those rows, left- or right-side cells are non-empty at content height 0 and their mask pixels are drawn. The other 46 rows are identical, because their left and right cells are empty at height 0. **Required:** while the window is collapsed, the region builder walks only the title-axis sides of the committed layout (SR6), whatever the layout's collapsed flag. Those cells are still placed by the same layout (HP15). Pixels drawn by the other sides' cells are then outside `S` and pass through. **Not required by §9:** the decoded draw also walks only the title-axis sides when collapsed (window-widgets WD4). Making the runtime drawing match WD4, for example by setting the layout's collapsed flag, would remove those drawn pixels. That is a window-family drawing change and may move goldens, so it belongs to its own lane. | SR6, CN2, WK4; WD4; HP48 |
| HP9 | `popup-window` is in scope. Its tab, corner rects and bottom-right square lie inside `S`, so they keep their WH5 answers. Only the band beside the tab passes through. | CN1, WH5 |
| HP48 | **Title axis per public window type (declared mapping).** **`side-floating-utility-window` and `collapsed-side-utility` are side-titled: their title axis is left/right. Every other public window type is top-titled: its title axis is top/bottom.** This includes `document-window`, `collapsed-document-window`, `dialog`, `alert`, `movable-modal`, `movable-alert`, `popup-window`, `titled-utility-window`, `collapsed-titled-utility`, `no-title-utility-window` and `collapsed-no-title-utility`, plus any alias that resolves to one of them. The rule applies to the type that actually rendered, after collapsed-variant and base-chain resolution (HP3 b). It is a **declared mapping** (policy), not a procID decode, and it rests on three listing-free sources. (1) SR6, WD4 and window-widgets §2.2 say the decoded `sideTitle` flag is what moves the collapsed side walk to sides 2 and 3; the per-procID table sets it. (2) In every corpus `wnd#` recipe (13 bundles), these two types are the only ones that place their title-bar widget cells (close, zoom, collapse) on the left side: 13 of 13 `side-floating-utility-window` recipes and 3 of 3 `collapsed-side-utility` recipes. In one of them, the collapse cell is on the right. window-widgets §6.2 lists 1138's as an example. Every other type has its widget cells and its title plate (code 5) on the top side. The one exception, a single widget-code cell on monkey-paradise's `movable-modal` left side, does not make that type side-titled. (3) The built-in frame's declared slug table maps the same two types to the utility family with the side-title variation bit (procedural-frame UI4), and no others. | SR6, WD4; window-widgets §2.2, §6.2; procedural-frame UI4; PM ruling 2026-11-01 |
| HP42 | **Modal exemption.** A window whose host lies inside an open `openModal` wrap (an ancestor carries `data-scriptoscope-modal-open`) is modal-exempt, so its effective mode is `box`. That means no clip and no outside-press deactivation. A press on a frame gap therefore stays with the modal window and can never reach the wrap as a backdrop press. The state is tracked as follows. `openModal` notifies the window hosts inside the wrap when it opens and when it closes, for example with a bubbling event that the manager listens for on each host. `ScriptoscopeWindow.promote` re-checks after it inserts a host into the page, which covers a window promoted into an already-open wrap. Entering or leaving the exemption is a mode-only change (HP11). After close, the window returns to its requested or inherited mode. Modal-style windows not opened through `openModal` are not detected; such consumers use `box`. | decision 9 |

### 9.2 Opt-out, API and observables

| id | rule | basis |
|---|---|---|
| HP10 | **Declarative:** `data-scriptoscope-hit` on the `data-scriptoscope-window` element. The value is trimmed and case-insensitive: `box` requests box; `region` requests region. An absent attribute inherits the page-wide default (HP14). An empty or unknown value is ignored as if absent and logs once through the runtime's `debug` channel. Like every window attribute, it is read at promotion. The host does not carry consumer `data-scriptoscope-*` attributes, so later edits to the source element are not observed; use HP11. | decision 2; `data-scriptoscope-*` surface (`parse.ts` conventions: trimmed, case-insensitive like `-widgets`; values that match nothing behave as absent, like `-state`) |
| HP11 | **Imperative:** `WindowManager.add(theme, opts, handlers, { hit })` with `hit?: 'region' \| 'box'`; when omitted, the window inherits the page-wide default (HP14). `applyState(host, { hit })` changes the window's own request at runtime, and `hit: null` clears it back to inheriting. Omitted means unchanged, as for the other `ManagedWindowState` fields. String values from untyped callers are normalised as in HP10. **A mode-only change** (`applyState` hit, `setDefaultHit`, the modal exemption) re-renders no chrome (render frequency contract). It switches the clip, `pointer-events` (HP26) and deactivation tracking in the same task. **Persistence:** `hit` is page configuration, not user state. It is not persisted, and a mode-only change does **not** call the `setChangeListener` callback. The page re-applies its attribute or option on reload. | decisions 2, 7 |
| HP12 | **Reflection:** after every commit and every mode change, the host carries `data-scriptoscope-hit-effective="region"` or `"box"`. It is read-only output; writing it has no effect. | policy |
| HP13 | **Retheme:** the requested mode persists across retheme and is never reset. The effective mode and `S` are recomputed for the new theme in the same commit as the new chrome (HP21). A window rethemed to a built-in frame theme becomes effective `box`. Rethemed back to a recipe theme, it becomes `region` again, unless the consumer requested `box`. | decision 2; HP3 |
| HP14 | **Page-wide default.** `mountDeclarative` was removed in 0.7.0 (#491), so the page-wide default lives on the object a page shares across its windows, the `WindowManager`: `new WindowManager({ hit })`, and `setDefaultHit(mode)` at runtime. Both the declarative path (`ScriptoscopeWindow.promote` receives the manager in its deps) and `WindowManager.add` use it. Absent, the default is `region`. The value is normalised as in HP10; an empty or unknown value is ignored, so the default stays `region`, and logs once. Example helpers that create a manager (such as the demo's `mountExplicitPage`) forward a `hit` option to it. Precedence: the window's own request (HP10, HP11), then the manager default, then `region`. | decision 7 (Q3) |
| HP41 | `setDefaultHit(mode)` re-derives the effective mode of every window that has no own request, in the same task, as a mode-only change (HP11). Windows with their own request are untouched. A retheme or a per-window `applyState` never changes the manager default. | decision 7 |
| HP45 | **Observables (for tests and consumers).** `describe(host)` gains three fields. `active` (boolean) is the window's activation state. `hit` is the window's own request, or `undefined` when it inherits. `hitEffective` is the effective mode. `part="window"` keeps reporting `data-scriptoscope-current-state`. A **chrome commit** is observed in two ways: (1) one `setChangeListener` call for that window, which every commit already makes (a z-only `applyState` or a position commit also calls it, so tests isolate those); (2) attribute mutation records on the chrome canvas (its size and style are rewritten on every commit). A **region build** is observed on the `debug` channel. The new `region` category carries four labels: `built` (exactly one per successful build of `S`, whether or not the result is applied or equals the previous `S`), `build failed` (HP44), `ignored hit value` (HP10, HP14) and `closed shadow root` (HP47). Tests enable `setDebug({ categories: ['region'] })` and count events by label. Attribute records on L2 are **not** a build observable: in all three engines, writing an identical `clip-path` value queues no MutationObserver record. They are used only to check that the clip and the canvas change in the same task (HPT26). The shadow root stays `open`, so tests reach L2 through it. | review B5, R3 |

### 9.3 Region source, coordinates and representation

| id | rule | basis |
|---|---|---|
| HP15 | `S` is built by SR5–SR12 from the chrome template used for this commit (SR14) and the placed cells of the **same** layout that drew this commit's frame. It is never derived from the composed canvas, from the chrome buffer's alpha after title or pressed-widget drawing, or from the grow-box sprite. U7 found `S` equal to the drawn chrome's alpha outside `C` at three sizes in all 18 themes, for expanded kinds. That is a cross-check, not a source. For collapsed windows, "same layout" means the same placed cells, walked per SR6 (HP8). | SR5–SR14; T2, T14 |
| HP16 | **Coordinates.** `S` is a bitmap in chrome-buffer pixels. Its origin is the chrome canvas's origin, which is the top-left of L1's padding box (`part="window"`, HP26). L2 fills that box exactly and has no border, padding, margin or `part`, so consumer CSS cannot shift or clip it. Region pixel (x, y) covers the CSS-pixel rectangle [x·k, y·k, (x+1)·k, (y+1)·k], where `k` is the window's integer display scale (`RenderWindowOptions.scale`, default 1). `C` sits at the composed frame's (left, top), like the canvas. No other offset applies. | review N4 |
| HP17 | **Local space.** The path uses CSS pixels in L2's local coordinates. Device pixel ratio does not enter it: the canvas has chrome-buffer resolution and is CSS-scaled by `k`, and the browser maps the clip the same way. Browser zoom, CSS `zoom` and ancestor transforms (scale, rotate, skew; #515, #519) act on the clip exactly as on the canvas, and hit testing inverts them natively. So DPR, zoom and ancestor-transform changes do **not** trigger a recompute, and no viewport-space measurement (`getBoundingClientRect`, `viewportFrame`) enters `S`. | policy |
| HP18 | **Edge sampling.** The path hit test is geometric. When the device pixel ratio is an integer, `k` is an integer and no ancestor applies a non-integer scale, rotation or skew, every CSS rectangle of HP16 maps to whole device pixels. Tests then sample chrome-pixel centres exactly, including 2-px features such as PF1 notches and single mask-difference pixels. At fractional DPR, page zoom or under transforms, the browser may rasterise the canvas edge and the clip edge to different device pixels, so up to one device pixel of disagreement along an edge of `S` is accepted. In those configurations, tests sample only points whose surrounding 3 × 3 chrome pixels are all in `S` or all out of it. | review B4 |
| HP19 | **Representation:** `clip-path: path("…")` with the default `nonzero` rule, on L2. The filled set must equal `S` exactly. The reference form is the band decomposition: consecutive rows with identical run lists form a band, and each run of a band becomes one rectangle subpath `M l t H r V b H l Z`. Coordinates are integers times `k`, and all rectangles have the same orientation. A form with fewer subpaths is an **optional** optimisation, allowed without a policy change, provided it is still one `path()` with an identical filled set and integer coordinates. An example is one traced rectilinear outline per connected component, holes included, under a fill rule that yields exactly `S`. It is not expected to fix hit-test cost: WebKit's cost tracks the path's length, not its subpath count (HP20). Rejected representations: `url(#id)` to an SVG `clipPath`, because references from inside a shadow root resolve inconsistently across engines; `polygon()`, which cannot express disjoint pieces without seams; `mask-image`, which does not change hit testing (§8 option 4). | decision 3; §8 option 3; review N1 |
| HP20 | **Cost.** U7 measured band-rectangle counts for the active document window with a 48-px title. At content 320 × 200: dolphin-som 781, animals 415, monkey-paradise 257, evolution 193, 1990 117, 1984 35, floppies 30, 1138 27, beos-r503 2, and 1 for the other four. At 1280 × 800: dolphin-som 2449, animals 1500, monkey-paradise 601, the rest unchanged. Each rectangle takes about 19 characters, so the largest path is about 47 KB. The count grows with the window's perimeter, not its area. In the review's probe, a hit test against the 2451-subpath band path cost about 0.04 ms in Chromium, 0.4 ms in Firefox and 2.3 ms in WebKit. A second probe on a jagged 1320 × 860 frame compared the same filled set in two forms. The band form (1660 subpaths, 32 KB) cost 1.29 ms in WebKit; one traced outline with a hole (2 subpaths, 25 KB) cost 1.20 ms. WebKit's cost follows the path's length, so cutting subpaths saves little. Frame-interval p95 in headless runs was about 18–19 ms with no clip at all, and stayed in that range with either clip. Hover hit-tests on every pointer move, so WebKit carries a budget relative to a same-run no-clip baseline (HPT36). Rules: build `S` and its path once per commit, during render preparation, never per pointer move or per resize-outline frame. Reusing it when the template, layout, collapsed state, title width and `k` are unchanged is an **optional** optimisation; rebuilding at every commit is conformant (PM ruling, 2026-11-01). There is **no** size-based fallback to `box`: a silent fallback would make hit behaviour depend on window size. | U7; render frequency contract; review N1 |
| HP44 | **Build failure.** If building `S` or its path throws, or yields an empty region, the window is effective `box` for that commit (no clip; deactivation still follows the requested mode, HP38), and the failure logs once through the `debug` channel. The next commit tries again. The chrome commit itself still proceeds. | review N9 |

### 9.4 When to recompute

| id | rule | basis |
|---|---|---|
| HP21 | `S` is rebuilt during render preparation and applied in the **same synchronous commit** that puts the new chrome pixels on screen. No frame may show new chrome with an old region, or the reverse. While a render is pending, the old canvas and the old clip stay together. | policy |
| HP22 | Every chrome commit recomputes `S`. Triggers, each of which already commits: (a) size changes, i.e. `setContentSize` and `setOuterSize`, declarative auto-fit growth, a user grow-box commit (pointer release, and each keyboard resize step), and zoom; (b) collapse and expand; (c) activation flips (SR14), including deactivation by an outside press (HP39); (d) retheme (HP13); (e) a change of `k`; (f) a title change. The title width is the layout's `SW`, which sizes the title plate (window-widgets TT rows). Today `k` and the title are fixed at `add`, with no runtime setter. A setter added later must commit through `render`, and it gets a hook then (HPT27). **Built whatever the mode:** `S` and its path are built at **every** commit of a window whose rendered type is a recipe window with a loaded chrome template (HP3 b). This holds whatever its requested mode, inheritance or modal exemption. A window that is effective `box` keeps the built `S` but applies no clip. A later mode-only switch into `region` (`applyState`, `setDefaultHit`, modal close; HP11, HP41, HP42) can then apply the last commit's `S` synchronously, without a commit. If the last commit's build failed (HP44), such a switch leaves the window effective `box` until a later commit builds `S`. | SR14; TT rows; review R2 |
| HP23 | **Activation, U2 policy:** `S` follows the template that is **drawn**. The decode leaves open whether the Window Manager recalculates regions on a hilite-only change (U2). The web recomputes on every activation flip, so the hit area always matches what the user sees. The active and inactive masks differ by at most 28 px per kind, and only in animals, crayon-os, floppies and monkey-paradise. | SR14, U2 |
| HP24 | **Not triggers:** dragging (it changes position only; `S` is host-relative); a z-order raise without an activation flip; pressed-widget art and title text pixels (SR13); scrolling; content reflow that does not change the window size; the Posture B in-flow to absolute handoff; mode-only changes (they set or clear the clip and reuse the `S` built at the last commit, HP22). | SR13 |
| HP25 | During a pointer resize, `S` stays the last commit's region. The ghost outline is decoration (HP31), not region. | policy |

### 9.5 Layering: what is clipped

The clip goes **inside** the host's shadow root, not on the host element
(decision 5). A `clip-path` on the host would clip everything the host paints,
including the shell shadow, the focus indicators and the resize outline. None
of those could then escape without new light-DOM siblings next to the host,
which in-flow (Posture B) hosts cannot position reliably. Clipping one level
inside gives the same hit result, and everything stays inside the window's own
shadow tree.

| id | rule | basis |
|---|---|---|
| HP26 | **Layers.** (L1) The `part="window"` element remains the shadow root's first child and the **unclipped** element that bounds the chrome box. It keeps today's role, label and `::part(window)` contract, including the shell shadow. (L2) A single **clipped layer** with L1's box sits inside L1 and carries the HP19 path. It contains every element that takes pointer input for the window: the chrome canvas, the content box with its slot, the grow sprite, the title-widget overlays, the grow-box overlay and the window scrollbars. It also contains the move handle. **Tab order:** every focusable element of the chrome keeps its pre-#597 DOM order inside L2, so the tab order is unchanged in both modes. The move handle stays in its old position relative to the title widgets, the grow box and the window scrollbars (PM ruling, 2026-11-01). (L3) An **unclipped decoration** part inside L1, outside L2, with `pointer-events: none`, holds the focus ring of HP28 and the resize outline of HP31. (L4) **`pointer-events`** in effective `region` mode: `none` on the host and on L1, `auto` on L2. Slotted content inherits from L2. In effective `box` mode there is no clip and no `pointer-events` change, so hits are exactly as before #597. | decisions 3, 5; PM ruling 2026-11-01 (tab order) |
| HP43 | **Identity of L2 (normative).** L2 and L3 are created once per host and never detached, replaced or re-parented, whatever commits, mode switches, modal changes or retheme happen. The pooled chrome canvas, the content box and every overlay that exists in both the expanded and the collapsed state are L2's children for the window's lifetime. They keep their identity across every commit, resize, collapse and expand, activation flip, mode switch and retheme. L2 exists in `box` mode too, so a mode switch moves no node. **Exception (pre-#597 behaviour, kept):** the grow-box overlay exists only while expanded. Collapse removes it and expand recreates it (#563), with focus handled as before #597. While the window stays expanded, it keeps its identity across commits, resizes and retheme like any other overlay. Why: today's guarantees depend on DOM identity. Overlays are never detached, so focus and a pending Space activation survive a commit (#533, #525). The overlay reuse check compares an overlay's parent with the window element it reconciles. The commit reconciles the window element's children in place. The window-scrollbar staleness check compares against the live window element. L2 adds one level, so these checks address L2 where they address the overlays' parent today, and L1 where they address `shadowRoot.firstChild`. A replaced L2 would detach overlays (losing focus), double them, or make live scrollbars look stale. | review B2; #533; #563; PM ruling 2026-11-01 |
| HP27 | **Host lockdown.** `WindowManager.add` sets `clip-path: none` inline on **every** host it creates, imperative and declarative, in both modes, so consumer CSS cannot clip the host's decoration. It also sets `pointer-events` inline to `none` in effective `region` mode and clears it in `box` mode, where consumer CSS applies as before. The other ten locked properties stay where they are today, in `ScriptoscopeWindow.promote`, so imperative hosts keep their current scope. The locked set still only grows. | Posture B lockdown; review N3 |
| HP28 | **Focus ring.** In **both** modes, the outline of a focused title widget, move handle, grow box or window scrollbar is drawn by L3. It is a ring with the control's border box, outset by the same offset and drawn in the same style as `box` mode, visible iff the control matches `:focus-visible`. It is repositioned on every commit, because controls move on resize. The control's own outline is suppressed in both modes, so no clipped partial ring doubles it. In `box` mode this is an **accessibility fix**, not a regression (PM ruling, 2026-11-01). Before #597, the vertical window scrollbar painted over the move handle's native outline. L3 sits above L2, so no chrome control can occlude a ring. This includes the move handle's ring, whose top segment lies above the window's top edge, outside L2's box. The result looks the same in both modes. | WCAG 2.4.7; §8 "keyboard focus unaffected" |
| HP29 | **Host and content focus.** The host's own focus outline (`scriptoscope.css`, `[data-scriptoscope-promoted]:focus-visible`) is on the unclipped host and is unchanged. Light-DOM content lies in `C`, which is inside `S` (SR11). Its focus rings are already clipped by the content box's own `overflow`, so they are unchanged too. | SR11 |
| HP30 | **Shell shadow.** It is unchanged. L1 paints it from `--scriptoscope-window-shadow` through `::part(window)`. It stays rectangular around the chrome box: pass-through changes hits, not pixels. The host's `filter` stays locked to `none`; no `drop-shadow` moves onto the host. A `box-shadow` is never a hit target, so the shadow never catches clicks. | `scriptoscope.css` shell policy |
| HP31 | **Resize outline (behaviour fix).** The grow-box ghost outline renders in L3, in both modes, so it stays visible beyond the current `S` and the current box. Today it is appended to the host's light DOM, where the default slot projects it into the content box and the content's `overflow` clips it. Moving it to L3 fixes that. | HP25; review N5 |
| HP32 | **Overflowing descendants.** Content still scrolls inside `C`. Some consumer descendants escape the content box: `position: fixed` elements, or elements whose containing block lies outside it. In `region` mode they are clipped to `S`, because `clip-path` clips descendants whatever their containing block. In `box` mode nothing is clipped. Top-layer content is not clipped: native `<select>` pop-ups, `<dialog>.showModal()`, the Popover API and fullscreen. Consumer guidance: put menus and tooltips in the top layer or outside the window, or opt out with `box`. The runtime renders no pop-up inside L2 today. Any future runtime menu must use the top layer. | policy |
| HP33 | **Posture B placeholder.** It is a light-DOM sibling of the host, `pointer-events: none` and hidden. It is never clipped and never a hit target. The handoff changes neither `S` nor the clip's anchor, which is L1, and it does not touch the host's `pointer-events` (HP24, HP27). | Posture B |
| HP34 | **Drag, widgets and grow box.** A frame drag starts only from a point in `S`. The title-widget overlays keep their mask hit (window-widgets HT7, HT8) inside `S`. A widget-mask pixel outside `S` misses, because WH1 precedes the widget branch. The grow-box overlay, including WM381's enlarged overlay, keeps working at its points inside `S`. Points over excluded frame pixels miss, because WH1 precedes WH3 (T9). Every point of `C` hits (SR11). **Mid-gesture:** a drag or resize in progress keeps pointer capture on L1, and its move and release tracking is document-level. Leaving `S` mid-gesture therefore does not end it, and a release over the page is no outside press (HP38 counts only the press). A retheme or resize commit during a drag is safe, because L1 and L2 keep their identity (HP43). | WH1, WH3, HT7, HT8, SR11; WM381; review B2 |
| HP35 | **Activation on pass-through.** A press on an excluded pixel neither activates nor raises the window it passed through. Whatever receives it behaves as if the window were absent. Another managed window activates through its own handler. Page content gets trusted events with all default actions (focus, selection, links, form controls), and a `region` active window is then deactivated (HP38, HP39). This matches the #540 capture, where a desktop click deactivated the window. | decision 6; OS3, OS4, U1; DECISIONS #12 unaffected |
| HP36 | **Hover, cursor, wheel and touch** over excluded pixels go to the element beneath. Page scrolling and touch gestures work there; the window's `touch-action: none` applies only inside `S`. | policy |
| HP46 | **Nested windows** (a window host inside another window's content) are not supported beyond today's behaviour. The inner window is additionally clipped by the outer window's L2, and a press inside it is inside both windows for HP38, so it deactivates neither. | review N8 |

### 9.5a Deactivation by outside presses (decisions 6, 10, 11)

| id | rule | basis |
|---|---|---|
| HP38 | **Tracking.** A window is **deactivation-tracked** iff its **requested** mode, its own request or else the inherited manager default, is `region` (decision 12). The effective mode does not matter: a built-in-frame window, a window with no template and one whose region build failed are all tracked when they request `region`. The window is not tracked if it is modal-exempt (HP42) or inside a closed shadow root (HP47). An explicit `box` request, per window or as the manager default, turns tracking off and keeps pre-#597 activation (decision 10). Tracking is re-derived on every mode-only change (HP11, HP41, HP42). A manager whose active window is tracked holds document-level listeners for `pointerdown`, `pointercancel`, `click`, `keydown` and `contextmenu`, in the capture phase and passive. It holds them only while its active window is tracked. The listener set is **re-derived whenever the active window or its tracking changes**: an activation flip (an inside press or #550 focus-in), deactivation by an outside press, `add`, `remove`, a mode-only change (HP11, HP41) and a modal open or close (HP42). A press is **inside** a window iff that window's host is in the event's `composedPath()`. This is a DOM-ancestry test, never a geometry test, so presses on shadow-root chrome, on light-DOM content, and on top-layer elements whose DOM lives in a window's content (popovers, `showModal` dialogs) count as inside that window. Every other press in the document is **outside**: page content, a press that passed through an excluded pixel (HP35), promoted controls outside any window, and windows of a different manager. Only primary pointers count (`isPrimary`). Any button counts for mouse. | decisions 6, 10, 12 |
| HP39 | **When and what.** For **mouse and pen**, an outside `pointerdown` deactivates the active tracked window at once (decision 11). For **touch**, an outside primary `pointerdown` only records a pending tap. A `pointercancel` for that pointer (scroll, swipe, pinch) discards it. A pending tap is also discarded by the next `pointerdown` of any pointer (which is then handled under its own rule), by any `keydown` or `contextmenu`, and when the listeners are removed or tracking turns off. This covers a long-press context menu, and a page that calls `preventDefault` on `touchend` so that no `click` follows. The `click` that follows the tap, with `composedPath()` also outside and no discard in between, commits it and deactivates. A `click` with no pending touch tap never deactivates: keyboard-generated clicks, `element.click()`, and mouse or pen clicks, which already acted at press. **Deactivating** sets the window inactive and renders it with its inactive template. That is an activation flip, so HP22c recomputes `S`, and the window drops the active z-index boost while keeping its order among the other windows. No window becomes active, so the manager has no active window until a window is pressed or receives focus (#550). The listeners never call `preventDefault` or `stopPropagation`, and they do not wait for the render, so the page receives the press or tap with all its default actions. An inside press keeps today's behaviour: that window activates and rises. | decisions 6, 11; SR14 |
| HP40 | **Limits.** The active window stays active in these cases: presses the document never sees (other applications, browser UI, cross-document iframes); the browser window losing focus; keyboard focus leaving every window. Activation by keyboard focus entering a window (#550) is unchanged. The first two are host limits, recorded in the ledger. Keyboard focus leaving is unchanged pending a separate decision. | host limits |
| HP47 | **Closed shadow roots.** A host inside a closed shadow root is hidden from `composedPath()` at the document, so HP38 would read every inside press as outside. Outside-press deactivation is unsupported for such windows. The manager detects that a host's root node is a closed `ShadowRoot` at the first sync or press after the host is inserted (PM ruling, 2026-11-01), not necessarily at insertion. It then disables HP38/HP39 for that window and logs once through the `debug` channel. The timing is acceptable as long as the outcome holds: no inside press ever causes a deactivate-then-reactivate pair (HPT37). The window's hit mode is unaffected. | review N2 |

### 9.6 Accessibility

| id | rule | basis |
|---|---|---|
| HP37 | `clip-path` changes painting and hit testing only. It does not change the accessibility tree, roles, names, focusability, tab order, keyboard move and resize, focus-in activation (#550) or DECISIONS #12's operable inactive-window widgets. Keyboard focus and screen-reader reading (virtual cursor, browse mode) are unaffected. Assistive technology that hit-tests the screen, such as touch exploration, reports what lies beneath at excluded pixels, as a pointer user sees it. Focus indicators stay fully visible (HP28, HP29). | §8 "keyboard focus unaffected" |

### 9.7 Consumer documentation and changed flows (implementation lane)

The implementation commit documents these, without adding policy beyond §9:

- `data-scriptoscope-hit` in the README attribute reference;
- the `hit` option of `WindowManager.add`, `applyState` and `describe` (with the new `active`, `hit` and `hitEffective` fields), and the page-wide default (`new WindowManager({ hit })`, `setDefaultHit`);
- `data-scriptoscope-hit-effective`;
- a CHANGELOG entry. In `region` mode, the default for recipe windows: frame gaps pass clicks through, and a press on page content outside every window deactivates the active window (touch: a completed tap). An explicit `box`, per window or page-wide, restores the full pre-#597 behaviour. `openModal` windows keep the box automatically. Built-in-frame themes keep their box hit area but still deactivate on outside presses unless `box` is requested;
- HP32's pop-up guidance, and the closed-shadow-root limit (HP47);
- a note that a consumer `box-shadow` on `::part(window)` keeps working.
- the new `region` debug category (HP45) in the `debug.ts` category list;
- a CHANGELOG accessibility note: focus rings on chrome controls (title widgets, move handle, grow box, window scrollbars) are drawn above the chrome in both modes, so they are no longer hidden. Previously the vertical window scrollbar covered the move handle's ring (HP28).

**Demo flows that change** (all `region` by default unless the demo opts out):

- `demo/index.html` (landing) and `demo/landing.html`: any press on page copy, links or background outside the windows now deactivates the active window. Presses through the frame gaps of recipe-themed windows reach the page beneath.
- `demo/showcase.html`: the hero-strip `<select>` and other controls outside the windows now deactivate the active window. The theme-picker tiles inside the Schemes Folder window are inside presses and are unchanged. Windows opened with `openModal` keep the box (HP42).
- `demo/diagnostic.html` and the per-scheme inspectors: the inspector controls outside the windows deactivate the active window. The diagnostic `renderWindow()` previews are bare elements and are unchanged (HP2).
- `demo/explicit-host.mjs`, `demo/declarative-hostile-css.html` and `demo/capabilities.html`: the same deactivation on outside presses, plus pass-through at frame gaps. The hostile-CSS page also checks HP27 against its consumer `clip-path` and `pointer-events` rules, if it has them.
- Built-in-frame themes in any demo: the hit area is unchanged (HP4), but outside presses now deactivate the active window, as for recipe themes.

### 9.8 Test hooks

**Fixtures.** The test author chooses every point from the **decode**: §4.2,
applied to the template mask and placed cells for the exact window
configuration (theme, kind, content size, title, active state, `k`). Points
are never taken from the runtime's region, its canvas, its clip string, or
`elementFromPoint` on the window. Each fixture records chrome-pixel
coordinates for three points:

- `p_out`, an excluded frame pixel;
- `p_in`, an opaque frame pixel in `S`;
- `p_c`, a content pixel.

Unless a hook says otherwise, hooks run at DPR 1 with `k` = 1 and sample pixel
centres exactly (HP18). Under HPT11's transformed or fractional configurations,
the points also need a uniform 3 × 3 neighbourhood.

Page: a sentinel element lies beneath the whole window box and records
`pointerdown`, `pointerup`, `click`, `wheel` and `pointerover`. The host
records `pointerdown`. Commits and region rebuilds are counted with HP45's
observables.

**Themes:**

- dolphin-som `document-window`: jagged frame, all bands;
- animals `document-window`: sky band, plus a pixel whose mask differs between the active and inactive templates, for HPT6;
- 1984 `document-window`: the left column under the close knob;
- 1984 `popup-window`: the band beside the tab, and the tab;
- beos-r503 `movable-modal` or monkey-paradise `movable-alert`: modal kinds with large gaps, for HPT34;
- windows-95 `document-window`: `S` is the whole box, the negative control;
- platinum-8 `document-window`: built-in frame, exempt.

**Matrix:** source and built modes; Chromium in the PR shards; Firefox and
WebKit in the release tier. Register the spec in
`tests/rendering-options/interaction-specs.mjs`. Observations claim "web host
policy (hit-regions §9); the Window Manager half is U1".

| hook | assertion | mutation that must fail it |
|---|---|---|
| HPT1 (HP1, HP3) | In `region` mode, for each recipe fixture: `elementFromPoint` at `p_out` returns the sentinel. A real mouse click at `p_out` reaches the sentinel. The host sees no `pointerdown`, and the window is not raised or dragged. | default `box`; clip to the bounding box; build `S` relative to `C` instead of the canvas origin; clip only the canvas |
| HPT2 (HP1, SR11) | `elementFromPoint` at `p_in` returns the host (shadow retargeting). At `p_c` it returns the content element or a descendant. A press-drag from a title-bar `p_in` moves the window. windows-95: every sampled box point hits the window. | invert the mask; leave `C` out of `S`; derive `S` from canvas alpha after the title (use a synthetic title over a mask-clear pixel, as in T14) |
| HPT3 (HP10–HP12, HP45) | `data-scriptoscope-hit="box"` and `" BOX "`, and `add(…, { hit: 'box' })`: `p_out` returns the host, and the effective attribute and `describe().hitEffective` read `box`. `applyState({ hit: 'region' })`: `p_out` passes, with zero change-listener calls and zero canvas mutation records. `"boxed"`: `region`. | ignore the attribute; case-sensitive parse; `applyState` re-renders or calls the change listener; reflection not updated; build `S` only for effective `region` commits (the switch from `box` then has no `S`) |
| HPT4 (HP22a) | After `setOuterSize` growth, auto-fit growth, and a user grow-box commit (pointer and keyboard), a point that is excluded only at the new size passes. A point that was excluded at the old size and is now in `C` hits. | compute `S` once at `add`; recompute on pointer resize only |
| HPT5 (HP8, HP22b) | Collapsed: a point in the former content area passes. Expanded again: it hits. | keep the expanded `S` while collapsed |
| HPT39 (HP8, SR6) | animals `collapsed-titled-utility` and `collapsed-no-title-utility`, collapsed at the runtime's committed width. The test author takes, from the decode, a pixel of a left- or right-side cell that the four-side layout places and masks in at content height 0. It is outside `S` and passes. Title-axis cell pixels in `S` hit. **Side-titled case:** a collapsed `collapsed-side-utility` (1138, whose recipe titles the left side, or another corpus theme with that kind). A left-side title-strip pixel in `S` hits. A top- or bottom-side cell pixel that the layout places is outside `S` and passes. | walk all four sides of the committed layout while collapsed; take the title axis from the layout's `sideTitle` flag (the side-titled case then walks top and bottom) |
| HPT40 (HP26, tab order) | For a recipe window with every widget enabled, a grow box and both window scrollbars, the Tab sequence through the chrome's focusable elements and the slotted content matches pre-#597 behaviour in both modes. The reference sequence is recorded by the test author on a `main` commit without the #597 runtime (for example the branch's merge base) and committed with the fixture. | move the move handle after the grow box; move it into L3 or outside L2 |
| HPT6 (HP23) | animals at DPR 1: the mask-difference pixel follows the drawn template in both activation states, sampled exactly at its centre (HP18). | always use the active template; skip the recompute on an activation flip |
| HPT7 (HP13) | Retheme dolphin-som → windows-95: dolphin's `p_out` now hits. → platinum-8: effective `box`. → dolphin-som: `p_out` passes again. A `box` opt-out survives every step. | no recompute on retheme; reset the requested mode on retheme |
| HPT8 (HP28) | dolphin-som in `region` mode. Tab to the move handle, a title widget, the grow box and a window scrollbar. Ring pixels outside `S`, and the move handle's ring above the top edge, show the ring colour and match a `box`-mode capture. | leave the widget outline on the clipped control; leave the move handle's native outline (its top segment is then clipped) |
| HPT9 (HP30) | With `scriptoscope.css` and `--scriptoscope-window-shadow: 4px 5px 0 rgb(1, 2, 3)` in `region` mode, pixels just past the bottom-right edge show the shadow colour. The existing `window-shadow.spec.mjs` passes in both modes. | put the clip on L1 or on the host |
| HPT10 (HP26, HP30) | At DPR 1 and `k` = 1, with `scriptoscope.css` and `--scriptoscope-window-shadow: 4px 5px 0 rgb(1, 2, 3)` set: at rest, screenshots of each fixture, including the shadow area, are identical in `region` and `box` modes. | erode `S` by 1 px; clip L1 instead of L2 (the shadow disappears) |
| HPT11 (HP16–HP18) | Under a scaled (#515), rotated and skewed (#519) ancestor, at `k` = 2, and at DPR 2: `p_out` passes and `p_in` hits (points mapped from local to viewport by the test; 3 × 3 rule under transforms). | omit `k`; build `S` from `getBoundingClientRect` |
| HPT12 (HP32) | A content child with `position: fixed` that extends past the box is clipped outside `S` in `region` mode and not clipped in `box` mode. A `popover` shown from the content displays fully in both modes. | `box` mode leaves the clip set; the clip moves to the host (the pop-over's DOM ancestor) without top-layer handling |
| HPT13 (HP33) | An in-flow host is dragged (Posture B handoff). At the new position, `p_out` passes and `p_in` hits. At the old flow position, the page beneath is hit. | the handoff restores the host's `pointer-events`; the clip is anchored to the old flow position |
| HPT14 (HP34) | If a fixture's grow overlay overlaps excluded frame pixels, a press there passes; otherwise this uses a synthetic case as in T9. A press in the overlay's part inside `C` resizes. | keep the grow overlay outside L2 |
| HPT15 (HP37) | The accessibility snapshot and Tab order are identical in both modes. Keyboard move (move handle) and keyboard resize (grow box) work in `region` mode. | make L2 `inert`; set `aria-hidden` on L1 |
| HPT16 (HP4) | platinum-8 at DPR 1: the effective mode is `box`. A PF1 notch pixel, sampled exactly at its centre, hits the window. With the default (inherited `region`) request, a mouse press on page content deactivates the window, after one change-listener call. With an explicit `data-scriptoscope-hit="box"`, a page press leaves it active. | clip built-in frames by PF1; key deactivation on the effective mode (platinum-8 then stays active); deactivate an explicit `box` window |
| HPT17 (HP3) | Base chain: a requested theme whose window type resolves to a recipe owner is `region`, and one that resolves to a built-in-frame owner is `box` (corpus pair if the base chains provide one, else synthetic). | decide by the requested theme's slug |
| HPT18 (HP35, HP38, HP39) | dolphin-som, `region` mode, window active, the sentinel a focusable `<button>`. A real **mouse** click at `p_out`: the sentinel receives `pointerdown` and `click` and takes focus (default action intact). The window is inactive by the sentinel's `click` (`describe().active` false, current state `inactive`), after exactly one change-listener call, with its order among other windows unchanged. **Pen:** the same, at press. **Touch:** a tap at `p_out` deactivates only after the `click`. A touch swipe that starts at `p_out` and scrolls the page (`pointercancel`) leaves the window active. A keyboard-activated click on a page button leaves it active. A click on page content outside the box deactivates windows-95 in `region` mode. A click in `p_c` or on `p_in` keeps the window active. A `popover` opened from the content and shown outside the box: a click in it keeps the window active. Two windows A (active) and B, with B beneath A's `p_out`: a click there activates B and deactivates A. **Exempt but requested `region`:** platinum-8 (built-in frame), a synthetic recipe with no template (HP7) and a synthetic recipe whose region build throws (HP44) each deactivate on a page click. A modal-kind window inside an open `openModal` wrap does not. **Stale tap:** a touch long-press at `p_out` that opens a context menu (no `click`), followed by a keyboard-activated click on a page button, leaves the window active. So does a touch `pointerdown` whose `touchend` the page cancels, followed by Enter on a button. **Listener lifecycle:** with A tracked and B an explicit `box` window, pressing B makes B active, and a later page click leaves B active. Pressing A again re-arms deactivation, and a page click then deactivates A. | keep a pending tap across `keydown`, `contextmenu` or a later `pointerdown`; re-derive the listeners only on mode-only changes; key deactivation on the effective mode (the built-in, no-template and build-failure cases then stay active); deactivate modal-exempt windows; deactivate on touch `pointerdown`; deactivate on any `click`; call `stopPropagation` or `preventDefault` in a listener; classify by `event.target` instead of `composedPath()`; classify by box geometry; keep the listeners after the last `region` window is removed |
| HPT19 (HP40) | A press inside a same-origin iframe beside the window, and `window.blur()`, leave the window active. Tab from the window's content to a page link leaves it active. | deactivate on `blur` or on `focusout` |
| HPT20 (HP10, HP11, HP14, HP41) | Manager `{ hit: 'box' }`: a window without the attribute is `box` (`p_out` hits the window, and a page press does not deactivate it); a window with `data-scriptoscope-hit="region"` is `region`. Manager default `region` with attribute `box`: `box`. Manager `{ hit: 'Boxed' }`: `region`, with one debug log. Attribute `"boxed"` under manager `box`: `box` (ignored, so it inherits). `setDefaultHit('region')`: the inheriting window becomes `region`, and the window with its own `box` stays `box`, with zero change-listener calls and zero canvas mutation records. `applyState({ hit: null })` returns a window to inheriting. | the default overrides the attribute; ignore the default; `setDefaultHit` re-renders, calls the change listener or changes windows with their own request; an unknown attribute value forces `region` instead of inheriting; build `S` only for effective `region` commits |
| HPT21 (HP2) | A bare `renderWindow()` element placed over the sentinel: no element in it has a `clip-path` or a changed `pointer-events`, and `p_out` returns the window element. | `renderWindow` applies the clip |
| HPT22 (HP6, HP7) | Three synthetic cases, each effective `box`, with `p_c` and the frame hitting the window: a theme with no window chrome in its base chain (HP6); a recipe window type with no chrome template (HP7a); a recipe whose region build throws (HP7b, as HPT38). A template that fails to load gets no hook: `add` rejects and no window exists. | build `S` for the baseline window; use an empty `S` when the template is missing; clip with an empty `S` after a failed build |
| HPT23 (HP9) | 1984 `popup-window`: a tab pixel hits the window. The band beside the tab passes. | drop the tab cell from `S` |
| HPT24 (HP19) | Static: L2's computed `clip-path` begins with `path(`. No `url(`, `polygon(` or `mask` property is set on the host, L1 or L2. Path coordinates are integer multiples of `k`. | an SVG `url()` implementation; a mask-image implementation |
| HPT25 (HP20, HP24, HP25) | With the `region` debug category enabled, zero `built` events (HP45) and zero canvas attribute records occur during: a title-bar drag (moves and release), a 200-step hover sweep, a pointer resize before release, a raise of an already active window, and a content reflow with no size change. During the pointer resize, a point excluded from the old `S` still passes. On release, exactly one `built` event and one commit are recorded. A mode-only switch (`applyState({ hit: 'box' })`, then `'region'`) emits zero `built` events. | rebuild on pointer move; rebuild on raise; rebuild during the resize ghost |
| HPT26 (HP21) | On a resize commit, the L2 style record and the canvas attribute records arrive in the same MutationObserver callback. | apply the clip in a later frame or after an `await` |
| HPT27 (HP22e, HP22f) | `k` = 1 and `k` = 2 windows of the same configuration give `S` scaled by `k` (HPT11). When a runtime setter for `k` or the title exists, a change through it moves `p_out` as the decode predicts for the new layout. Until then, this hook is conditional and records "no setter". | keep the old `S` after the setter commits |
| HPT28 (HP27) | A consumer class sets `clip-path: circle(10px)` and `pointer-events: none` on the host, for a declarative and an imperative window. In `region` mode the whole frame is still visible and `p_in` hits. In `box` mode, the consumer's `pointer-events` applies again. | lock `clip-path` only in `promote`; keep `pointer-events: none` in `box` mode |
| HPT29 (HP29) | The host's focus outline and a content `<input>`'s focus ring look the same in both modes. | clip the host or L1 |
| HPT30 (HP31) | During a pointer resize that grows the window, the ghost outline is visible beyond the old box in both modes. | keep the outline in the host's light DOM; put it inside L2 |
| HPT31 (HP34, widget clause) | A synthetic theme where an opaque widget-mask pixel lies over a mask-clear template pixel outside `C`: a press there reaches the sentinel, and the widget handler does not run. A press on an opaque widget-mask pixel that **is** in `S` runs the handler. | test the widget before `S`: the widget overlay sets `pointer-events: auto` and sits outside L2 (the outside press then runs the handler); place the widget overlays outside L2 without `pointer-events: auto` (the inside press then misses) |
| HPT32 (HP34, mid-gesture clause) | A drag from `p_in`, moved across `p_out` and released over the sentinel, moves the window by the pointer delta. The sentinel gets no `pointerdown`, `pointerup` or `click`, and the window stays active. A retheme triggered mid-drag does not end the drag, and the release commits the move. | capture on an element that a commit replaces; release pointer capture when the pointer leaves `S`; end the drag on `pointerleave` |
| HPT33 (HP36) | At `p_out`: a wheel scrolls the scrollable sentinel, not the window content; a hover fires `pointerover` on the sentinel, and the computed cursor is the sentinel's. | `pointer-events: auto` on L1 |
| HPT34 (HP42) | A modal-kind fixture inside an `openModal` wrap. While open, the window is effective `box`: `p_out` hits the window, and a press there neither closes the modal nor calls the change listener. A backdrop press does not deactivate the modal. A window promoted into the wrap while it is open is also `box`. After close, the window is `region` again. | no modal exemption; exemption only at promotion; exemption not cleared on close; skip the `S` build while modal-exempt (pass-through then fails after close without a commit) |
| HPT35 (HP43) | Across a resize, an activation flip, collapse and expand, a retheme and both mode switches: the L2 and L3 nodes, the canvas, and each overlay that exists in both states keep their identity, and L1 stays the shadow root's first child. The grow-box overlay keeps its identity across commits, resizes and retheme while expanded. Across collapse it is absent while collapsed and present again after expand; its identity across collapse is not asserted. A focused title widget keeps focus across a retheme. | recreate L2 or L3 on retheme; recreate L2 on a mode switch; insert L2 only in `region` mode; recreate the grow box on every commit while expanded |
| HPT36 (HP20, performance, WebKit) | dolphin-som `document-window` at content 1280 × 800, `region` mode, WebKit release tier. Measure, in the same run, a **baseline** with the same window and the same sweeps under `hit: 'box'` (no clip). Ceilings (WebKit): the median `elementFromPoint` cost over 200 points in the frame band, timed in batches, is at most 3.0 ms (the band form measured about 2.3 ms). The frame-interval p95, during a 200-step hover sweep across the frame and during a 200-step title-bar drag, is at most the baseline's p95 + 3 ms. Every engine reports both numbers and the baseline in the observations; Chromium and Firefox are report-only. | a size-based fallback to `box` (HPT2's point checks fail at this size); a per-move rebuild (HPT25's build count and the frame budget) |
| HPT37 (HP47) | A window whose host is inside a closed shadow root: after insertion, the first sync or press produces one `closed shadow root` event, and no inside press, including that first one, causes a change-listener call (no deactivate-then-reactivate). | classify by `composedPath()` alone |
| HPT38 (HP44) | A synthetic recipe whose region build throws is effective `box`, with one `build failed` event; its chrome still commits. Its own request then switches `box` → `region` by `applyState`, and it stays effective `box` with no `built` event until a later commit succeeds. | leave the window clipped with an empty or stale `S`; build `S` during the mode-only switch |

HP5 has no hook (unreachable, WK5). HP46 has no hook (unsupported beyond today's behaviour).

### 9.9 Resolved questions (maintainer, 2026-10-31, recorded on #597)

- **Q1.** Decision 3 said "clip-path of the host". **Resolved: clip an inner
  layer**, as §9.5 specifies. The host becomes pointer-transparent; the hit
  result is the same, and the shell shadow, focus rings and resize outline
  stay unclipped.
- **Q2.** Should pressing page content through a gap deactivate the active
  window? **Resolved: match the original**, as in the #540 capture. Narrowed
  by review decisions 2 and 3 and follow-up decision 12: windows that request or
  inherit `region`, effective mode irrelevant, modals excepted; touch only on a
  completed tap (§9.5a).
- **Q3.** A page-wide default? **Resolved: yes**, on the `WindowManager`
  (`mountDeclarative` no longer exists), overridden per window, with the same
  unknown-value handling: HP14, HP41, HPT20.
- **Q4.** Is the bare `renderWindow()` element clipped? **Resolved: never**
  (HP2).
- **Review decisions 1–3 (§9 review at `ddaefb1e`):** `openModal` windows keep
  the box (HP42); `box` restores the full pre-#597 behaviour (HP1, HP38); and
  the touch rule above (HP39). Follow-up: deactivation follows the requested
  mode (decision 12; HP1, HP4, HP38).
