# `window.inactiveInput` — widget presses on an inactive window (#614)

Issue [#614](https://github.com/khawkins98/scriptoscope/issues/614), 2026-11-01.
Spec writer: lane 614 (decode researcher). Independent review: pending.
Revision 2 (2026-11-01): maintainer decisions on #614 recorded. §7 IP1–IP4 are decided, IP14 adds the grow-box rule (§7.4) with hooks IPT12–IPT14, and DECISIONS #12 and the faithfulness ledger record the narrowing. The decode in §0–§6 is unchanged.
Revision 3 (2026-11-01): addresses the independent review at `49ae4b48` (ask-1–ask-10). The utility-frame grow area is corrected in §0, §2.4 (IW10a), §2.5 and §7.4 (ask-1); OS6 cites pp. 4-102 to 4-103 (ask-2); hooks IPT1a, IPT1b, IPT10, IPT10a and the IPT12 utility case are added or sharpened (ask-1, ask-3–ask-5); IP5 and IPT7 are reconciled (ask-6); §7.5 adds implementation notes (ask-7); §2.1 states what the runtime passes (ask-8); the ledger says implementation pending (ask-9); IPT8 is corrected (ask-10). PM ruling: IP5–IP13 are decided, with a CHANGELOG note for IP7.
Evidence appendix: [`inactive-window-input.evidence.md`](./inactive-window-input.evidence.md). Implementers must not read it.

This file has two halves that must not be mixed:

- §0–§6 are **decode and Apple documentation**. §2 is what Kaleidoscope 2.3.1
  `kDEF 0` answers. §3 is what Apple documents for the Window Manager and for
  applications. Neither is web policy.
- §7 is **web compatibility policy** for the five behaviours #614 reports. It
  is a recommendation for the maintainer, consistent with the #594 decision ("a
  first press on an inactive window only activates it"). It is not original
  behaviour.

## 0. Answer

1. **The kDEF never reports a widget part for a window that is not drawn
   active.** In the recipe compositor the drawn-active test comes before every
   close, zoom and collapse test, and a failed test answers `wInDrag` (2)
   (IW2). In the built-in frame the same holds for the document family (the
   hilite test gates all three widget tests, IW6) and the utility family (IW9).
   A press where an inactive window's close, zoom or collapse box would be is
   therefore a drag-region press. No family reports `wInGrow` for an inactive
   window. In the recipe compositor and the built-in document frame, a point
   in the inactive grow rectangle answers `wInContent` (1) (IW3, IW7). In the
   built-in **utility** frame the grow test is skipped and the point answers
   as any other (IW10): the part over the content answers 1, but the grow
   rectangle's outer 2 px, which lie in the frame, answer **2 `wInDrag`**, as
   do the frame and shadow beyond them (IW10a).
2. **The built-in frame neither draws nor hits widgets on an inactive window**
   (IW6, IW8, IW9, IW11). The recipe compositor never draws close or collapse
   on its own at rest: their art is whatever the active or inactive chrome
   template holds (IW4). It does not hit them on an inactive window either way.
3. **Apple documents the same contract from the other side.** `wInGoAway`,
   `wInZoomIn`, `wInZoomOut` and `wInGrow` are "active window only", and a
   press where the close box would be on an inactive window "is reported as
   `wInDrag`" (OS1). `FindWindow` returns `inGoAway` and `inZoomIn`/`inZoomOut`
   only for "an active window's" close or zoom box (OS2). The application
   therefore never calls `TrackGoAway` or `TrackBox` for an inactive window. It
   calls `DragWindow`, which activates the window when the button is released
   (OS4, OS5). A content press in an inactive window calls `SelectWindow` and
   "does not make a selection … in response to the first click" (OS3).
4. **Zooming an inactive window is not reachable by pointer in the classic
   model** (rows 1 and 3). Apple's `ZoomWindow` takes a `front` flag: TRUE makes
   the window "the frontmost, active window", FALSE leaves its place in the
   window list unchanged. Apple's sample passes "is this the front window"
   (OS6). Neither choice raises a window without activating it.

## 1. Unit id and scope

| field | value |
|---|---|
| unit id | `window.inactiveInput`: the activation gate on the widget and grow branches of `wHit` (message 1) and on widget drawing, for both window families |
| family | window frame: recipe compositor and built-in frame |
| binary | Kaleidoscope 2.3.1 `kDEF 0`, 107,726 B, SHA-256 `2c027276dae2355964a0dde1ace31f60ba845ab2c5fbf0496fd34ab2afe7c342` |
| cited range | `0x2e52`, `0x315e`, `0x31d4` (drawn-active flag); `0x3f6a..0x3fb2`, `0x411c..0x41e4` (recipe grow and widget hit); `0x5a28..0x5a42` (recipe widget draw at rest); `0x12990`, `0x129a8..0x129f2`, `0x12a10..0x12af8` (built-in document hit); `0x1381a`, `0x13ca8..0x13cf2` (built-in document title draw); `0x1740e..0x17428`, `0x15b26..0x15c88` (built-in utility hit); `0x16736..0x16836` (built-in utility title draw) |
| restates | [`window-widgets.md`](window-widgets.md) HT2, HG2; [`hit-regions.md`](hit-regions.md) WH3, WH7; [`procedural-frame.md`](procedural-frame.md) HT2, HT5–HT8, §5 rows 11–12, UI1, UI6, UH2, UH4–UH7, UW2, UW4. This file collects them for #614. Where it differs, those files win and this one is wrong |
| out of scope | the structure region and pass-through ([`hit-regions.md`](hit-regions.md)); widget geometry and the exact-point fallbacks (window-widgets Q6); scroll bars (decided in #594, [`scrollbar.md`](scrollbar.md) HT1); what the Window Manager does after `wNoHit` (hit-regions U1) |

## 2. Decode (kDEF 0)

### 2.1 Inputs

| input | meaning | source |
|---|---|---|
| `hilited` | the window's hilite state, which the Window Manager sets for the active window | Apple: `HiliteWindow`, OS3 |
| `drawActive` (recipe) | `hilited`, forced on for families 66, 67 and 124 when variation bit 0 is clear | `0x2e52`, `0x315e`, `0x31d4` |
| *active* (built-in utility) | `hilited`, or variation bit 0 clear (*alwaysActive*, procedural-frame UI1, UI6) | `0x1740e..0x17428` |
| `hilited` (built-in document) | read once per hit call | `0x12990` |

Apple's named floating procIDs (`floatProc` 1985 … `floatSideZoomGrowProc`
1999, `kWindowFloatProc` 1057 … `kWindowFloatSideFullZoomGrowProc` 1087) all
have variation bit 0 set (`MacWindows.h` 3.2, lines 198–205, 250–271). So the
forced-on rows apply only to the even variations, which Apple does not name.
Window-widgets §2.3 declares `drawActive` from the window's active state,
but the public runtime does **not** pass the active state to the recipe
compositor: `renderWindow` keeps widgets hittable on every window (the
DECISIONS #12 code site). The recipe compositor's `drawActive` is therefore
always set at runtime, and the inactive gate of this section is applied in the
interactive layer instead (§7.5). Every built-in utility record in the runtime
uses an odd variation, so no public window reaches a forced-on row.

### 2.2 Recipe compositor (`wnd#` present)

| id | condition | result | source |
|---|---|---|---|
| IW1 | point outside the structure region, or window not visible | 0 `wNoHit` (unchanged by activation) | `0x3f38..0x3f66` |
| IW2 | widget branch reached, `widgetFrame` set, `drawActive` clear | **2 `wInDrag`**. The test precedes the close, zoom and collapse tests and the exact-point fallbacks, so no widget part code is reachable | `0x4124..0x4128`, `0x41e0` |
| IW3 | point in the grow rectangle, `growEnabled`, not collapsed, not popup | 3 `wInGrow` when `drawActive`, else **1 `wInContent`** | `0x3f6a..0x3fb2` |
| IW4 | full frame draw | the only widget the full draw draws is the partial-zoom widget, and only when `drawActive`. Close and collapse art at rest is the chrome template's pixels for the window's state | `0x5a28..0x5a42` |
| IW5 | widget-part draw messages (parts 4, 5, 6, 9) | drawn without a `drawActive` test (window-widgets WD3). Apple sends them only while tracking a widget part code (OS4), which IW2 never produces for an inactive window | `0x4256..0x42c8` |

### 2.3 Built-in frame, document family (no `wnd#`)

| id | condition | result | source |
|---|---|---|---|
| IW6 | point in the title bar, window not `hilited` | the close, zoom and collapse tests are skipped; the point goes to the drag test (procedural-frame HT8) and answers **2** | `0x12a18..0x12a1a`, `0x12af8..0x12b66` |
| IW7 | point in the grow area, *grow*, not collapsed | 3 when `hilited`, else **1** | `0x129a8..0x129f2` |
| IW8 | title-bar draw | stripes and the close, zoom and collapse glyphs are drawn only when `hilited` (procedural-frame §5 rows 11 and 12). The title and frame are drawn in both states | `0x13ca8..0x13cf2` |

### 2.4 Built-in frame, utility family

| id | condition | result | source |
|---|---|---|---|
| IW9 | point in the title bar, not *active* | the close, zoom and collapse tests are skipped; the point answers 2 if in the drag area (UH7), else 1 | `0x15b90..0x15c20` |
| IW10 | point in the grow area, not *active* | the grow test is skipped (UH2); a point there answers by UH3–UH8 | `0x15b26..0x15b72` |
| IW10a | consequence of IW10 with the grow rect of procedural-frame UG10, (*C*.r − 14, *C*.b − 14, *C*.r + 2, *C*.b + 2) | the part inside the content answers 1 (UH3); the *smallGrow* cut-out from the content answers 1 (UH8); the outer 2 px past *C*.r and *C*.b, and the frame and shadow out to the structure box, lie in the UH7 band and answer **2** | `0x15b76..0x15c88` |
| IW11 | title-bar draw | stripes and widgets only when *active* (UW2, UW4); an inactive window's title bar is fill and title | `0x16736..0x16836` |

### 2.5 Consequences

| id | statement |
|---|---|
| IW12 | For every public window type the runtime renders, an inactive window answers no widget part and no grow part. A press on an opaque pixel where a widget is (or would be) answers 2 or 1. A press in an inactive grow rectangle answers 1, except the utility frame's outer 2 px, which answer 2 (IW10a). |
| IW13 | Recipe and built-in families agree on IW12. They differ only in what is drawn: a recipe inactive template may show widget art (IW4) that does not hit; a built-in inactive window shows none (IW8, IW11). |
| IW14 | Transparent recipe pixels inside a widget rectangle answer 0 in both states (IW1 precedes IW2). Activation does not change pass-through. |

## 3. Apple-side (Window Manager and applications), not kDEF

All rows cite *Inside Macintosh: Macintosh Toolbox Essentials* (1992/1994),
through [`../apple-primary-source.md`](../apple-primary-source.md) "Window
Manager mouse-down conventions". Page numbers are the printed ones.

| id | rule | authority |
|---|---|---|
| OS1 | A window definition returns `wInGrow`, `wInGoAway`, `wInZoomIn` and `wInZoomOut` "only if the window is active". "In an inactive document window, for example, a mouse-down event in the part of the title bar that would contain the close box if the window were active is reported as `wInDrag`." | TBE p. 4-122 ("Determining the Region of a Mouse-Down Event"); `MacWindows.h` `wInGrow` 3, `wInGoAway` 4, `wInZoomIn` 5, `wInZoomOut` 6 |
| OS2 | `FindWindow` returns `inGoAway` for "an active window's close box" and `inZoomIn`/`inZoomOut` for "an active window's zoom box"; the Event Manager chapter's constant list marks `inGrow`, `inGoAway`, `inZoomIn`, `inZoomOut` "active window only" | TBE pp. 4-93, 2-36; `MacWindows.h` `inGoAway` 6, `inZoomIn` 7, `inZoomOut` 8 |
| OS3 | Application convention, `inContent` in an inactive window: unless a movable modal is in front, call `SelectWindow`, which "brings the newly activated window to the front, highlights it" and sends activate events. The sample "merely activates the window … it does not make a selection in the newly activated window in response to the first click" | TBE pp. 4-43 to 4-45, Listing 4-9 |
| OS4 | Application convention, `inGoAway` → `TrackGoAway`, then close if it returns TRUE; `inZoomIn`/`inZoomOut` → `TrackBox`, then zoom. `TrackGoAway` highlights the close box while the button is down. Neither is called for an inactive window, because OS1/OS2 never report those parts for one | TBE pp. 4-44 to 4-45 (Listing 4-9), 4-103 to 4-104 |
| OS5 | `inDrag` → `DragWindow`. When the button is released, "if the specified window isn't the active window (and the Command key wasn't down …), `DragWindow` makes it the active window"; "after the window is drawn in its new location, it is the active window, whether or not it was active before". A release outside the bounds leaves an inactive window inactive | TBE pp. 4-45, 4-94 to 4-95 |
| OS6 | `ZoomWindow(window, part, front)`: when `front` is TRUE "the window necessarily becomes the frontmost, active window"; when FALSE "the window's position in the window list does not change", and an active window stays active. Apple's sample passes `front` = (window = `FrontWindow`) | TBE pp. 4-102 to 4-103, 4-56 (Listing 4-12) |
| OS7 | Collapse: `MacWindows.h` 3.2 adds `inCollapseBox` 11 and `wInCollapseBox` 9 for Mac OS 8. The 1994 book predates them. Whether Apple's Mac OS 8 documentation states "active only" for the collapse box was not consulted (U2). The kDEF gates it with close and zoom (IW2, IW6, IW9) | `MacWindows.h` lines 410, 427 |

**Prediction (frozen, not observed).** Real 2.3.1 on System 7.5.5 or Mac OS 8,
with a conventional application: a click on an inactive window's close box
location activates and raises that window and closes nothing. A drag from
there moves it. No native capture backs this yet (U1).

## 4. Geometry

None beyond the cited specs. Widget and grow rectangles are as
[`window-widgets.md`](window-widgets.md) HT6–HT8 and HG3 and
[`procedural-frame.md`](procedural-frame.md) §6.2, §6.4, §9.9 define them.

## 5. Corpus impact

- Recipe rows IW1–IW5: the 13 `wnd#` bundles. IW4's visible inactive widget
  art depends on each scheme's inactive template.
- Built-in rows IW6–IW11: `apple-platinum-2`, `black-platinum`, `platinum-8`,
  `slimes`, `system7-nostalgia-silver`. Every one draws no widgets on an
  inactive window (IW8, IW11), which is #614 item 1.
- Forced-on `drawActive` / *alwaysActive* rows: no public window type reaches
  them (§2.1).

## 6. Not decoded / unknown

- **U1.** No native capture of a press on an inactive Kaleidoscope window's
  widget. The prediction in §3 is frozen before any boot. A capture would
  check it; nothing in §7 depends on it beyond what OS1–OS5 already state.
- **U2.** Apple's Mac OS 8 Window Manager pages for the collapse box were not
  consulted (OS7).
- **U3.** The exact-point close and zoom fallbacks (window-widgets Q6) remain
  undecoded. They lie after the IW2 gate, so they cannot answer for an
  inactive window.
- **U4.** The Command-key exception of OS5 (drag without activating) has no
  web counterpart in this policy.

## 7. Web compatibility policy (#614) — policy, not decode

The decode and Apple agree (IW12, OS1–OS5): a press on an inactive window's
widget is a drag-region press, so it activates the window and never runs the
widget. #594 adopted the same rule for scroll bars ("a first press on an
inactive window only activates it"). DECISIONS #12 keeps inactive-window
widgets real, focusable and operable for keyboard and assistive technology.
These rows keep #12 for keyboard and assistive technology. For pointers they
apply the decode.

**Status.** IP1–IP4 (items 1–2) and IP14 (grow box) are **decided** by the
maintainer (2026-11-01, recorded on #614). They narrow the pointer half of
DECISIONS #12, which records the narrowing, as does the faithfulness ledger's
`accessibility→decode` entry (implementation pending). IP5–IP13 (items 3–5)
are **decided** by PM ruling (2026-11-01, review of #622).

**Which windows are inactive.** For IP1 and IP14, a window is inactive if
`describe(host).active` is false when the press begins, whatever made it so:
another window's activation, an explicit `inactive` start, or deactivation by
an outside press (hit-regions HP39, #620). A window deactivated by an outside
press keeps its stacking order and may still be the frontmost window; its
first widget or grow-box press still only activates it.

**CHANGELOG note (IP7, for the implementation lane).** "`state: 'active'` on
`WindowManager.add`, and `data-scriptoscope-state="active"`, now make that
window active when it is added. Previously only the first window of a manager
could start active. If several windows ask, the last one added wins (imperative
callers that passed `state: 'active'` to several windows used to get the
first)."


### 7.1 Widgets on an inactive window (items 1–3)

| id | rule | basis |
|---|---|---|
| IP1 | **Decided.** **Pointer press on a widget of an inactive window.** A primary press (mouse primary button; touch or pen primary pointer) on a title-widget button whose window is inactive when the press begins is handled as a **frame press**. It activates and raises the window, moves keyboard focus into it as a frame press does, and can start a move under the existing threshold (#561). It draws no pressed widget art, and the `click` that ends the gesture runs no widget action, even though the window is active by then. The window's activation state is read **at `pointerdown`**, not at `click`. This holds for both families and both hit modes. | IW2, IW6, IW9, OS1, OS5; #594 |
| IP2 | **Decided.** **A second press acts.** Once the window is active, presses on its widgets work as today (pressed art, action on `click`, release outside cancels). | OS4 |
| IP3 | **Decided.** **Keyboard and assistive technology unchanged (DECISIONS #12).** The widget buttons stay in the DOM, in the tab order and in the accessibility tree on inactive windows, with stable identity (#533). Focus entering one activates the window first (#550). Enter, Space and a `click` with `detail` 0 (keyboard, `element.click()`, assistive technology) act, on active and inactive windows. | DECISIONS #12 |
| IP4 | **Decided.** **Built-in frame (item 1).** An inactive built-in-frame window keeps drawing no widgets (IW8, IW11). Its widget buttons stay in place (IP3) and are inert to pointers by IP1, so a press where an invisible widget sits activates the window and can move it. When keyboard focus reaches such a button, the window activates and re-renders with its widgets drawn, so a focused widget is visible once that render commits. Removing the buttons on inactive windows is **rejected**: it breaks IP3 and #533. | IW8, IW11, IW12 |
| IP5 | **Decided.** **Widget actions activate (item 3).** If a zoom or collapse action runs on an inactive window, which after IP1 only a `detail` 0 click can cause, the manager first activates and raises that window through its ordinary activation path. It then runs the action. This applies to the built-in zoom and collapse and to a consumer `onZoom`/`onCollapse` handler alike. Close does not activate (the window is going away, and in the imperative path the consumer decides whether to remove it). Zoom no longer bumps the stacking number by itself: a window's `z` changes only with an activation, a frame, content or grow-box press on the active window (the host's press handler), or `applyState`. A widget press on the active window is not such a press: it never reaches the host's press handler, so it leaves `z` unchanged (IPT7). No input leaves a window raised but inactive. | OS6 (`front` TRUE); #550 keyboard invariant (focus is always in the active, frontmost window) |

IP5 picks OS6's `front` = TRUE reading. Apple's sample instead passes FALSE
for a window that is not in front. That case cannot arise from a pointer in
either system (OS1). On the web it arises only from keyboard or assistive
technology, where #550 already requires the focused window to be active and
frontmost.

### 7.2 Initial activation (item 4)

| id | rule | basis |
|---|---|---|
| IP6 | **Decided.** **At most one active window per manager**, always. | #550, OS3 |
| IP7 | **Decided.** **Explicit request.** A window added with an explicit `active` request (`data-scriptoscope-state="active"`, or `opts.state: 'active'`) becomes active when it is added. The previously active window of that manager becomes inactive and re-renders. When several windows ask, the **last one added wins**; for declarative pages that is promotion order, normally document order. This matches the classic model, where each new front window becomes the active one. | IP6 |
| IP8 | **Decided.** **No request.** A window with no state request becomes active only if it is the first window of the manager. Later windows with no request start inactive (today's README default). An explicit `inactive` request never starts active. | README vocabulary |
| IP9 | **Decided.** **"Not declared" must stay distinct from `active`.** The declarative parser must pass "no request" through, not default it to `active`. Otherwise every window would claim active and IP7 would make the last one active. | IP8 |
| IP10 | **Decided.** **Scope.** Windows with their own manager (their own `data-scriptoscope-theme`) are unchanged: each starts active within its own manager. | interaction.md "Two ways in" |

### 7.3 Wheel axis (item 5)

No decode exists: the classic Toolbox had no scroll wheel. The rule follows
the common desktop convention that Shift turns a vertical wheel into
horizontal scrolling.

| id | rule |
|---|---|
| IP11 | **Decided.** For one wheel event over a window with themed bars: **with Shift held**, the horizontal amount is `deltaX` when it is not 0, otherwise `deltaY`, and the vertical amount is 0. **Without Shift**, the horizontal amount is `deltaX` and the vertical amount is `deltaY`. This works whether or not the browser has already turned Shift+wheel into `deltaX`. |
| IP12 | **Decided.** Each bar applies its own amount under the existing rules (whole pixels, carried fraction, reversal reset, amounts under 0.5 px ignored). An axis without a themed bar ignores its amount. |
| IP13 | **Decided.** The event is consumed (`preventDefault`) iff some themed bar of the window receives an amount of 0.5 px or more. Wheel input still never activates a window. |

**Code-read note (read-only, `src/interactive.ts` wheel listener, not
verified in a browser).** The horizontal bar reads `deltaY` whenever Shift is
held. An event that a browser has already converted (`deltaX` set, `deltaY`
0, `shiftKey` true) would then move neither bar. IPT10 case (b) checks this.

### 7.4 Grow box on an inactive window (decided)

In the recipe compositor and the built-in document frame, the grow
rectangle of an inactive window answers `wInContent` (IW3, IW7), so
classically a first press there is a content press and only activates (OS3).
In the built-in utility frame (IW10, IW10a) the inner part also answers 1, but
the outer 2 px answer `wInDrag`, so classically a first press there would
activate and could drag the window (OS5).
Before this policy the runtime's grow box activated **and** resized on the
first press.

| id | rule | basis |
|---|---|---|
| IP14 | **Decided.** A primary pointer press on the grow box of a window that is inactive when the press begins activates and raises the window, and moves keyboard focus to the grow box as a grow-box press does. Nothing else follows from that gesture: no resize outline, no Posture-B handoff, no size commit, no `scriptoscope:userresize`, and no frame drag. For the recipe and document families that is the decode (a content press). For the utility frame's outer 2 px, which decode to `wInDrag` (IW10a), **no frame drag is policy**: the whole grow-box overlay takes one rule, so its pixels never split between activate-only and activate-and-drag. Presses on the utility frame outside the grow-box overlay are ordinary frame presses. The activation state is read **at `pointerdown`**. The next press on the grow box of the now active window resizes as today. Keyboard resize (arrows on the focused grow box) is unchanged on active and inactive windows: focus entering activates first (#550). | IW3, IW7, OS3 (decode); IW10a outer 2 px: policy; maintainer 2026-11-01 |

### 7.5 Implementation notes (non-normative)

- **The verdict outlives a rebind.** Overlay nodes keep their identity
  (#533), but every commit rebinds their listeners. The activation render
  that IP1 and IP14 trigger therefore commits between the `pointerdown` and
  the `click` (or `pointerup`) of the same gesture. The "inactive at
  `pointerdown`" verdict must be stored on the window entry or keyed by
  `pointerId`, not in the closure of the listener that saw the press.
- **Read activation first.** Activating the window, and moving focus into it
  (which fires `focusin` and activates, #550), both set the active flag
  synchronously. The widget and grow-box handlers must read the window's
  active state **before** calling either.
- **Gate in the interactive layer.** Do not implement IP1 by passing the
  active state to the recipe compositor. Its widget-hittability filter would
  then return no widgets for an inactive window, dropping the overlay buttons
  and breaking IP3 and #533.

## 8. Test hooks

Every hook uses two windows A and B in one manager, A active, unless it says
otherwise. "Click" means a real Playwright mouse click at the centre of an
opaque pixel of the widget's mask (recipe) or its 16 × 16 rect (built-in). The
observables are `describe(host).active`, the host's `z-index`, the
change-listener count, `onClose`/`onZoom`/`onCollapse` call counts, the
`scriptoscope:close` event and the window's outer size.

| hook | setup and expected | mutations that must fail |
|---|---|---|
| IPT1 (IP1, IP2) | windows-95 and beos-r503 `document-window`. Click B's close. B is active and above A; `onClose` (or `scriptoscope:close`) did not fire; B still exists. Click it again: it closes. Repeat for zoom (size unchanged after the first click, zoomed after the second) and collapse. | read activation at `click` instead of `pointerdown` (first click closes); keep `stopPropagation` on the widget's `pointerdown` without activating (B stays inactive); act and activate on the first click |
| IPT1a (IP1, pressed art) | windows-95 and platinum-8, B inactive. Press and **hold** the mouse on B's close. Wait until B reports active and its activation commit has landed (one change-listener call for B). While still held, the chrome pixel at the widget's centre equals the same pixel of B's normal active render (B rendered active with no pressed widget); it does not equal the pressed render's pixel there (a pixel chosen where the two differ). Release outside the widget. | keep `press()` (pressed-art repaint) on an inactive `pointerdown` |
| IPT1b (IP1, IP14, #620) | dolphin-som, `region` mode, A active and frontmost. Mouse press on page content outside every window: A becomes inactive (HP39) and stays frontmost. Click A's close: A becomes active and is not closed. Repeat with a drag on A's grow box: A becomes active and keeps its size. | decide by stacking order ("frontmost means active") instead of the active state |
| IPT2 (IP1) | windows-95: press on B's zoom, drag 30 px right, release. B is active, its position moved by 30 px, its size is unchanged and it is not zoomed. A press without movement only activates (#561). | swallow the press like the #594 scroll bar (no move); start the zoom on release |
| IPT3 (IP1) | Touch tap and pen click on B's close (windows-95). Same result as IPT1's first click. | apply IP1 to mouse only |
| IPT4 (IP4) | platinum-8 `document-window` and system7-nostalgia-silver `titled-utility-window`, B inactive. Click where B's close box is (B draws no widgets there). B is active and not closed. After the activation render, the pixel at the close glyph's centre differs from the inactive render's pixel there (the glyph is drawn). Click again: B closes. | keep the pre-#614 live button (first click closes); skip the active re-render |
| IPT5 (IP3, IP4) | platinum-8 and windows-95, B inactive. Tab until focus reaches B's Close button: B becomes active before Enter. Enter closes B. B's widget buttons are the same nodes before and after activation (`===`). | remove the widget buttons from inactive windows (no focus stop; identity breaks); require a pointer press first |
| IPT6 (IP5) | windows-95, B inactive, A active. Call `.click()` (`detail` 0) on B's Zoom button. B is zoomed **and** active, with a higher `z-index` than A. Repeat with an imperative `onZoom` handler: the handler runs once and B is active. Repeat with Collapse. `.click()` on B's Close fires `onClose` once and leaves A active. | raise `z` without activating (today's behaviour); activate only inside the built-in zoom (the handler case fails); activate on close |
| IPT7 (IP5) | Zoom the active window A twice by pointer (widget clicks). A's `z` is unchanged by each zoom, since a widget press is not a host press, and A stays above B. | keep the zoom-only `z` bump (`z` changes) |
| IPT8 (IP6–IP9) | Declarative page, three windows in one manager: (a) none declares a state: only the first is active. (b) Only the second declares `active`: the second is active, the others inactive. (c) The first and third declare `active`: only the third is active. (d) The first declares `inactive`, the second `active`: the second is active. In every case exactly one window reports `active`. | parser defaults to `active` ((a) makes the third active); first request wins ((c) fails); allow two active windows; ignore later requests (today: (b), (c) and (d) fail; in (d) no window is active) |
| IPT9 (IP10) | A window with its own `data-scriptoscope-theme` beside an IPT8 (c) page stays active in its own manager. | apply IP7 across managers |
| IPT10 (IP11–IP13) | windows-95 window with both themed bars, scrolled to the middle. Dispatch synthetic `WheelEvent`s on the content, each created with `bubbles: true` and `cancelable: true` (without `cancelable`, `defaultPrevented` is always false): (a) `{deltaY: 120, shiftKey: true}`: only `scrollLeft` changes, by 120; (b) `{deltaX: 120, deltaY: 0, shiftKey: true}`: only `scrollLeft` changes; (c) `{deltaY: 120}`: only `scrollTop`; (d) `{deltaX: 120}`: only `scrollLeft`. Each event is `defaultPrevented`. A window with only a vertical bar, case (a): nothing scrolls and the event is not `defaultPrevented`. Run in Chromium, Firefox and WebKit. | the vertical bar ignores Shift (today: (a) moves both); the horizontal bar reads `deltaY` under Shift ((b) moves nothing); always `preventDefault` (vertical-only case fails) |
| IPT10a (IP13) | windows-95, B inactive and showing a themed vertical bar, B's content not covered by A at the dispatch point. A cancelable `{deltaY: 120}` wheel event on B's content scrolls B by 120, B stays inactive, A stays active, and no change-listener call occurs for either window. | activate on wheel |
| IPT11 (IW14) | dolphin-som, `region` mode, B inactive. A press on a transparent pixel inside B's close rectangle reaches the page beneath and does not activate B. | route widget-rect presses to activation before the region test |
| IPT12 (IP14) | windows-95 and platinum-8 `document-window`, B inactive, in-flow (Posture B) and absolutely placed. Press B's grow box, drag 40 px right and 30 px down, release. B is active and above A; B's content size, host position and `position` style are unchanged; no `scriptoscope:userresize` fired; no resize outline element appeared during the drag; no `region` `built` event beyond the activation commit; keyboard focus is on B's grow box. A second identical drag resizes B by (40, 30) / scale and fires `scriptoscope:userresize` once. A press without movement on the inactive grow box also only activates. **Utility case:** system7-nostalgia-silver `titled-utility-window` with a grow box, B inactive: press on the grow overlay's outer 2 px (past the content's right and bottom edges, IW10a), drag 40 px right and 30 px down, release. B is active, its position and size are unchanged (no move, no resize). | resize on the first press (today); read activation at `pointerup` (the press activated B, so the release would commit); treat the press as a frame drag, or follow IW10a's `wInDrag` for the utility outer 2 px (B moves by 40, 30); stop propagation without activating (B stays inactive) |
| IPT13 (IP14) | Touch and pen on B's inactive grow box: same as IPT12's first drag. | apply IP14 to mouse only |
| IPT14 (IP14, IP3) | Tab to B's grow box while B is inactive: B activates on focus. ArrowRight resizes B by 8 px. | apply IP14's first-press rule to keyboard resize |

Rule-row hooks for the decode rows (IW2, IW3, IW6–IW11) already exist as
window-widgets HT2/HG2 and procedural-frame HT2, HT5–HT8, UH2, UH4–UH7 test
hooks. This file adds no engine rule rows.
