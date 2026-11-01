# Interaction reference

What a user can do with a Scriptoscope window and its controls, and what a consumer can hook or opt out of. Every statement here was checked against the code on `main` (`src/interactive.ts`, `src/declarative/`, `src/controls.ts`, `demo/explicit-host.mjs`, `demo/explicit-layout.mjs`) and, where one exists, against a browser contract in `tests/rendering-options/`. Where the code and an older doc disagree, this page follows the code.

For layout, CSS and lifecycle gotchas see [integration-edge-cases.md](./integration-edge-cases.md). For the attribute vocabulary see the [README](../README.md#the-full-data-scriptoscope--vocabulary).

**Contents**

- [Two ways in](#two-ways-in)
- [1. Activation and focus](#1-activation-and-focus)
- [1a. Hit area and frame pass-through](#1a-hit-area-and-frame-pass-through)
- [2. Moving](#2-moving)
- [3. Resizing](#3-resizing)
- [4. Title-bar widgets](#4-title-bar-widgets)
- [5. Window scroll bars](#5-window-scroll-bars)
- [6. Controls](#6-controls)
- [7. Modals](#7-modals)
- [8. Events reference](#8-events-reference)
- [9. Accessibility notes](#9-accessibility-notes)
- [10. Platform differences](#10-platform-differences)
- [Not implemented](#not-implemented)

## Two ways in

- **Declarative.** An application host (the published example is `mountExplicitPage` in `demo/explicit-host.mjs`) selects `data-scriptoscope-*` elements and promotes each window with `ScriptoscopeWindow.promote`. A promoted window *is* a `WindowManager` window. The declarative layer adds three things on top: the in-flow default position (Posture B), auto-fit of undeclared dimensions, and "close means unmount".
- **Imperative.** `new WindowManager()` and `manager.add(theme, opts, handlers, extra)`. You get back an absolutely positioned host element, place it yourself, and wire the title widgets through `handlers` (`onClose`, `onZoom`, `onCollapse`).

Both paths share every behaviour in sections 1 to 5. The differences are called out where they matter.

Imperative owners can call `manager.dispose()` to stop managing every window at
once. It performs the same cleanup as removing each window, including document
listeners, pending touch taps, scrollbar listeners and pending render authority.
It is safe to call repeatedly. Hosts stay in the caller's DOM and borrowed themes
stay alive; remove the hosts or dispose themes through their owners as needed.
The manager can accept new windows afterward. For a declaratively promoted
window, use its `unmount()` or `restoreOriginalElement()` lifecycle; manager
disposal alone does not restore the source element or emit `scriptoscope:close`.

Activation, z-order and focus are per `WindowManager`. The example host uses one shared manager, but a window whose source (or an ancestor) has its own `data-scriptoscope-theme` gets a separate manager of its own. Such a window starts active, and activating other windows doesn't deactivate it.

## 1. Activation and focus

### What activates a window

| Input | Result |
|---|---|
| Pointer press anywhere on the window (frame or content) | The window becomes active and moves to the front. A press in the content is then delivered to the content as normal: one click both activates the window and presses the button under the pointer. |
| Pointer press on the frame | Activates and starts a move in the same gesture (see [Moving](#2-moving)). A press that doesn't move only activates (#561). |
| Pointer press on a scroll bar of an **inactive** window | Activates the window and does nothing else. The press doesn't scroll, and the next press acts as usual (#594, `scrollbar-inactive.spec.mjs`). |
| Pointer press on a title widget (close, zoom, collapse) of an **inactive** window | Handled as a press on the frame: it activates and raises the window and can start a move. No pressed art is drawn and the `click` that ends the gesture runs no action, even though the window is active by then. The next press on the widget acts ([#614](https://github.com/khawkins98/scriptoscope/issues/614), `inactive-window-input.md` IP1). |
| Pointer press on the grow box of an **inactive** window | Activates and raises the window and moves keyboard focus to the grow box. Nothing else: no resize, no outline, no move, no `scriptoscope:userresize`. The next press resizes (#614, IP14). |
| Keyboard focus entering the window (Tab, Shift+Tab, script `focus()`), in the chrome or the slotted content | Activates the window and raises it, without moving or resizing it (#550, `window-focus-raise.spec.mjs`). |
| Wheel over an inactive window that shows themed scroll bars | Scrolls it without activating it. |
| Pointer press on page content outside every window of the manager | Deactivates the active window, unless it uses `box` (see [1a](#1a-hit-area-and-frame-pass-through)). No window is then active until one is pressed or focused. |

The inert first-widget press suppresses only its own gesture, including a release click delivered to that widget. A later standalone synthetic or assistive-technology click is handled normally even when its `detail` is nonzero (#628).

A manager has at most one active window. If an added window fails its initial render, its active-state request is discarded and the previously active managed window stays active; a later successful active-state request still wins (#628). A window that asks to start active (`data-scriptoscope-state="active"`, or `opts.state: 'active'` on `WindowManager.add`) becomes active when it is added, and the previously active window becomes inactive. If several windows ask, the last one added wins (for a declarative page, promotion order, normally document order). A window with no state request starts active only if it is the first window of its manager. A window that asks to start inactive (`data-scriptoscope-state="inactive"`, or `opts.state: 'inactive'`) never starts active; if the first window does, no window starts active. Windows with their own `data-scriptoscope-theme` have their own manager (#614, IP6–IP10).

`WindowManager` has no public "activate" method. A `pointerdown` event dispatched on the host activates the window without moving keyboard focus (`window-focus-raise.spec.mjs`, "programmatic activation").

When the active state flips, only the windows whose state changed re-render (their chrome swaps to the active or inactive art). Pressing the already-active window only raises it.

### Z-order

Each window has a stacking number `z` from a per-manager clock. Every activation takes the next tick, as does every press on the active window's frame, content or grow box. A zoom doesn't change `z` by itself; zooming an inactive window activates it first (#614). The host's `z-index` is `100000 + z` for the active window and `z` for inactive ones, so the active window is always above every inactive one, and inactive windows are stacked by recency.

- Declarative: `data-scriptoscope-z` seeds the initial value. Without it the clock follows document order.
- Imperative: `extra.z` on `add`, and `applyState(host, { z })`.

### Focus inside a window

Tab order inside one window is:

1. focusable elements in the slotted content, in their own DOM order;
2. the title widgets that are wired, in visual reading order: rows top to bottom, left to right within a row (#537);
3. the **Move window** handle;
4. the **Resize window** grow box (absent while collapsed);
5. the vertical scroll bar, then the horizontal one (only while the content overflows).

The order is the same in `region` and `box` mode (see [1a](#1a-hit-area-and-frame-pass-through)). Runtime-created content viewports and declarative scroll wrappers are excluded from Tab and Shift+Tab: the themed bars provide keyboard scrolling, so an anonymous viewport adds no operation. This stays the same after style rebuilds and retheme, including in Firefox (#619). Explicit application `tabindex` values on consumer content are preserved. Content controls keep their native click focus and action; a click into an inactive window activates and raises it (#550).

The chrome controls (2 to 5) live in the host's shadow root. They keep their DOM identity across every re-render: activation, collapse, zoom, keyboard resize steps and retheme (#533, `window-overlay-identity.spec.mjs`). So focus stays on them and screen readers don't re-announce them. When a control goes away while it has focus (the grow box on collapse, a scroll bar when the overflow ends), focus moves to the move handle, never to `<body>`.

A pointer press on the frame, the grow box or an inactive window's title widget moves keyboard focus into that window (to the move handle or the grow box, without a visible focus ring) unless focus is already inside it. So after you drag window B, Tab continues from B, not from the window you were in before. A scroll-bar press does this only on an inactive window (the press that activates it). On the active window a scroll-bar press leaves keyboard focus where it was, even outside the window.

### Focus rings

- Chrome controls: a 2 px `Highlight` outline on `:focus-visible`, from a stylesheet the runtime adopts into every window's shadow root. It doesn't depend on `scriptoscope.css`. The ring of a title widget, the move handle, the grow box or a scroll bar is drawn by the window's unclipped decoration layer instead of the control itself, in both hit modes, so it stays whole over transparent frame pixels and is never covered by a neighbouring control.
- With the optional `scriptoscope.css`: `[data-scriptoscope-promoted]:focus-visible` gets an outline in `--scriptoscope-focus-color` (default `rgb(0 95 204)`) at `--scriptoscope-focus-width` (default 2px). A separate rule, using the same two variables, paints focus of a promoted `<select>` on its wrapper (`.scriptoscope-select:focus-within`) and of a promoted range on its themed slider (`input[type=range][data-scriptoscope-promoted]:focus + .scriptoscope-slider`). It matches `:focus`, not `:focus-visible`, so it also shows after a pointer press.
- Promoted checkboxes and radios draw a 2 px `currentColor` outline on their face while the native input has focus. This is inline, so it doesn't need the stylesheet.

## 1a. Hit area and frame pass-through

Many schemes have transparent pixels in their frames: merlons, ornaments, studs, the band beside a popup window's tab. In Kaleidoscope those pixels aren't part of the window, so a click there reaches whatever is behind. Scriptoscope does the same (#597, policy in [`docs/spec/engine/hit-regions.md`](./spec/engine/hit-regions.md) §9).

**Modes.** Every managed window asks for a hit mode, `region` or `box`, and has an effective mode:

- **`region`** (the default): the window takes a pointer only inside its structure region, which is the content area plus every opaque frame pixel of the frame template as drawn. Presses, hover, the cursor, wheel and touch gestures over a transparent frame pixel go to the page or window beneath, as trusted events with all their default actions (focus, selection, links, form controls). A press that passes through neither activates nor raises the window. Title widgets, the grow box and frame drags work wherever they are inside the region. The region follows every chrome change (resize, collapse, activation, retheme), with reuse allowed when all region inputs are unchanged. It is never rebuilt while dragging or hovering, and it follows the active or inactive frame art as drawn.
- **`box`**: the whole window rectangle takes every press, as before #597, and outside presses don't deactivate the window.

The effective mode is `box`, whatever was asked for, for windows of the five built-in-frame schemes (`apple-platinum-2`, `black-platinum`, `platinum-8`, `slimes`, `system7-nostalgia-silver`; their only transparent pixels are two 2 px shadow notches), for windows inside an open `openModal` wrap, for the no-chrome fallback window, and for a commit whose region couldn't be built. The bare `renderWindow()` element is never clipped.

**Choosing a mode.** The window's own request wins, then the manager default, then `region`:

- per window: `data-scriptoscope-hit="box"` (or `"region"`), read at promotion; `manager.add(theme, opts, handlers, { hit: 'box' })`; `manager.applyState(host, { hit: 'box' })` at runtime, and `{ hit: null }` to inherit again;
- page-wide: `new WindowManager({ hit: 'box' })`, or `manager.setDefaultHit('box')` at runtime, which changes only windows without their own request.
- with the example host: `mountExplicitPage({ hit: 'box', … })` passes the default to every manager it creates (the shared one and the per-theme ones).

Values are trimmed and case-insensitive. An empty or unknown value is ignored (the window inherits) and logs once on the `region` debug category. Changing the mode doesn't re-render the chrome or call the change listener, and isn't persisted: it's page configuration, so re-apply it on reload. The host reports the mode in force as `data-scriptoscope-hit-effective="region"` or `"box"` (read-only).

**Outside presses deactivate.** A window that asks for or inherits `region` is deactivated by a press anywhere in the document outside every window of its manager: page content, a pass-through press on a frame gap, a promoted control outside any window, a window of another manager. This follows the request, not the effective mode, so built-in-frame windows deactivate too unless `box` was asked for. Windows in an open `openModal` wrap and windows inside a closed shadow root never do.

- Mouse (any button) and pen deactivate on `pointerdown`.
- Touch deactivates only on the `click` of a completed tap. A scroll, swipe or pinch (`pointercancel`), another press, a key press or a context menu before that click cancels it. A click that wasn't preceded by a touch press outside (keyboard, `element.click()`) never deactivates.
- "Inside" means the window's host is on the event's `composedPath()`, so pop-overs and `showModal()` dialogs opened from a window's content count as inside it.
- The deactivated window re-renders with its inactive art and loses the active z-index boost but keeps its order. The page always gets the event: the listeners are passive and never cancel or stop it.
- Presses the document never sees (other applications, browser UI, cross-origin iframes), the browser window losing focus, and Tab moving focus out of every window don't deactivate.

**Layers.** Inside the shadow root, `part="window"` holds a clipped `.scriptoscope-hit-layer` (canvas, content, title widgets, move handle, grow box, scroll bars) and an unclipped `.scriptoscope-decoration` (focus ring, resize outline). In effective `region` mode the hit layer carries a `clip-path: path(…)` and `pointer-events: auto`, and the host and `part="window"` get `pointer-events: none`. Every host carries `clip-path: none` inline, so consumer CSS can't clip it. The `::part(window)` shadow is unchanged and never catches clicks.

**Content that escapes the content box** (for example `position: fixed` children) is clipped to the region in `region` mode. Put menus and tooltips in the top layer (`popover`, `<dialog>.showModal()`, native `<select>`) or outside the window, or use `box`.

## 2. Moving

### Pointer

Press and drag on **any part of the frame**: the title bar, and also the side and bottom borders. This is what lets side-titled palettes (`side-floating-utility-window`) be dragged. Presses on wired title widgets, the grow box and the scroll bars don't start a move. A press on a widget's transparent pixels does (on `wnd#` windows only the pressed widget art's mask counts as the widget).

- Only the primary mouse button, and only the primary pointer (`isPrimary`). A second finger or pen contact doesn't start a second drag.
- The window follows the pointer live by writing `left`/`top`. Nothing re-renders during a drag.
- The pointer is captured on the window, so moves keep arriving when the pointer leaves the window or crosses elements that swallow events.
- A press that never moves by at least half a CSS pixel is no move. An in-flow window stays in flow and no change is committed (#561). A drag released back at its start commits nothing either.
- `pointercancel` or a lost capture (for example the browser takes the gesture) puts the window back where it started and commits nothing (#563).
- Pointer drags aren't clamped: a window can be dragged partly or fully off screen.
- On release the position is committed through `WindowManager.setPosition`, which fires the manager's change listener once (see [Events](#8-events-reference)).

### Keyboard

Tab to the window's **Move window** handle, an invisible button over the top frame strip, then:

| Key | Moves |
|---|---|
| Arrow keys | 8 px |
| Shift + Arrow keys | 32 px |

Keyboard moves can't take the window's top above 0 in its containing block; the left edge isn't clamped. Each step commits through `setPosition`.

### In-flow to absolute handoff (Posture B)

A declarative window without `data-scriptoscope-x`/`-y` sits in normal flow. The first real move (pointer or keyboard), or the first real resize, lifts it out of flow:

1. The runtime inserts `<div data-scriptoscope-placeholder aria-hidden="true">` before the host, sized to the window's layout box, so the rest of the page doesn't shift.
2. The host becomes `position: absolute` at its current position relative to its containing block, so it doesn't jump.

From then on the window is absolute for the rest of its life. The placeholder stays until the window is removed (`WindowManager.remove`, or close/unmount). A host that is already absolute or fixed, inline or through consumer CSS, gets no placeholder, and the first move starts from where it actually sits (#569). See `posture-b.spec.mjs` and [integration-edge-cases.md](./integration-edge-cases.md#how-positioning-works-posture-b-2026-05-31).

### Scaled, rotated and skewed ancestors

Moves, resizes and slider and scroll-bar pointer mapping work inside CSS-transformed ancestors. Pointer positions are viewport pixels, while `left`/`top` and the window's own geometry are the containing block's CSS pixels; the runtime maps between them, so the window tracks the pointer under `transform: scale()` (#518), rotation and skew (#521). Promotion measures the source element's own CSS size rather than its transformed screen bounds, and control pointers use local CSS pixels (#522). Contract: `transformed-ancestors.spec.mjs`.

### Persistence and cross-tab restore (example host only)

The library has no persistence. It exposes the pieces: `setChangeListener`, `describe`, `applyState`, `setPosition` and `setOuterSize`. The example host builds layout persistence on them when you pass `persistKey`:

- Positions, sizes, collapsed state and z are saved to `localStorage["scriptoscope:layout:<persistKey>"]`, keyed by `data-scriptoscope-window-id` (or the window's index). Writes are debounced by 250 ms and flushed on `pagehide` and when the page becomes hidden (#578, #581).
- A mid-drag position is never saved: while a window holds pointer capture, saves use its pre-drag position, so a cancelled drag leaves the old position stored (#581).
- Other tabs with the same `persistKey` apply each other's changes live through the `storage` event. A tab only writes back the rows it changed itself (#584).
- A window that was in flow is restored in flow; a dragged one is restored as absolute. A restored size counts as a user size, so auto-fit doesn't grow it afterwards.

`WindowManager.setChangeListener` holds one listener. The example host uses it for persistence, so code that calls it on the same manager replaces persistence.

## 3. Resizing

### Grow box (pointer)

The ghost outline shown during a pointer resize is drawn in the window's decoration layer, so it stays visible beyond the old window size and over transparent frame pixels.

Drag the window's bottom-right corner. The hit zone is the scheme's own grow box when it has one; otherwise it's the frame corner plus the classic 15 px square where the two scroll-bar gutters meet. The scroll bars stop short of that zone, so their end arrows are never under it (#524, `growbox-zone.spec.mjs`). Only the corner resizes: the right and bottom edges don't.

- Primary mouse button or primary pointer only. The pointer is captured on the grow box.
- During the drag the runtime draws a dotted outline of the new size. The window re-renders once, on release.
- A press that doesn't change the integer content size is no resize: no handoff, no outline, no event (#552, `growbox-zero-delta.spec.mjs`). A drag released at its starting size commits nothing.
- `pointercancel` or a lost capture removes the outline and commits nothing (#563).
- A grow-box press on the active window raises it. A first press on an inactive window's grow box only activates it and focuses the grow box; resizing starts on the next press (#614). Keyboard resize works on both.

### Grow box (keyboard)

Tab to **Resize window**, then:

| Key | Content size change |
|---|---|
| ArrowRight / ArrowLeft | width +8 / -8 px |
| ArrowDown / ArrowUp | height +8 / -8 px |
| with Shift | 32 px steps |

Each step re-renders. A step that the minimum clamps to the current size does nothing (#552).

### Minimum size

- Width: the content width can't go below the value that keeps the **whole window** at 110 px (the classic Mac minimum), and never below 40 px of content.
- Height: 40 px of content.
- With the pointer, a window that is already smaller than a minimum isn't snapped up to it: the floor is the smaller of the two.

There is no maximum for a grow-box resize.

### After a resize

Both the pointer and the keyboard resize dispatch `scriptoscope:userresize` on the host, with the new content size (see [Events](#8-events-reference)). A declarative window listens for it and **stops auto-fitting for good**: the user owns the size from then on, and content that grows later scrolls instead of growing the window. Zoom, `setContentSize`, `setOuterSize` and `applyState` don't fire the event and don't end auto-fit.

A resize sets an explicit content size, so a window that was sized by an outer bound (an auto-fitted declarative window, or `setOuterSize`) stops following the frame thickness of later themes.

## 4. Title-bar widgets

The scheme's art decides which widgets a window type shows and where. A transparent `<button>` overlays each wired widget (`aria-label` "Close window", "Zoom window" or "Collapse window").

| Widget | Declarative | Imperative |
|---|---|---|
| Close | Unmounts the window: dispatches `scriptoscope:close`, then restores the original element with its live children. | Calls `handlers.onClose`. Without one, close isn't wired. The manager doesn't remove anything itself: call `manager.remove(host)` and remove the host. |
| Zoom | Built-in zoom (below). | `handlers.onZoom` if given, **instead of** the built-in. |
| Collapse | Built-in window-shade (below). | `handlers.onCollapse` if given, **instead of** the built-in. |

- **Zoom** grows the window to show all its content (the content element's scroll size, at least the current size), capped at 760 × 560 px of content. A window without a content element grows to 1.5 times its size. Zoom un-shades a collapsed window first and raises it (see [Z-order](#z-order)). Zooming again restores the size from before the zoom, including "no size" for a window that had none. While zoomed, `setOuterSize` updates the size that un-zoom restores (#542).
- **Collapse (window-shade)** rolls the window up to its title bar, using the scheme's collapsed art when it has some, and hides the content (the content nodes stay in place). On `wnd#` schemes a side-titled palette (`side-floating-utility-window`) collapses sideways: it keeps its height and rolls up to its vertical title strip (#617). The grow box and scroll bars go away while collapsed. Collapsing again restores it.
- **Double-click any frame edge** toggles window-shade too, including on side-titled palettes. Double-clicks on widgets, scroll bars and the grow box don't. This path always runs the built-in shade, and afterwards calls `handlers.onCollapse` if there is one.
- `data-scriptoscope-collapsed`, `extra.collapsed` or `applyState(host, { collapsed })` set the shade state without running any handler.

### Press feedback and activation

- Pointer press on a widget of the active window draws its pressed art. It's released on `pointerup` or when the pointer leaves the widget. Dragging back over it doesn't redraw it pressed.
- The action runs on `click`, so releasing outside the widget cancels it (native button behaviour).
- On `wnd#` windows, only pixels inside the pressed widget art's mask count as the widget. A press on its transparent pixels falls through to the frame.
- Enter and Space on a focused widget always act, on active and inactive windows (`window-widgets.spec.mjs`). Keyboard focus reaching an inactive window's widget activates the window first, as any focus does.
- A pointer press on an inactive window's widget only activates the window and can start a move; it draws no pressed art and runs no action (see [Activation](#1-activation-and-focus), #614). The window's state is read when the press begins.
- A zoom or collapse that runs on an inactive window (only a keyboard, assistive-technology or `element.click()` click can cause one) first activates and raises the window, then acts. This holds for the built-in zoom and collapse and for `onZoom`/`onCollapse` handlers. Close doesn't activate.

### Opting out: `data-scriptoscope-widgets`

A comma-separated subset of `close`, `zoom`, `collapse` (case-insensitive). Only the listed widgets are wired; `data-scriptoscope-widgets=""` wires none. Imperatively, pass `extra.enabledWidgets` (a `Set`).

A widget that isn't wired is still painted (the runtime never paints over the scheme's art), but it has no overlay button. So it isn't in the tab order and it isn't announced, and a press on it acts like a press on the frame: it activates the window and can start a move. Details: [integration-edge-cases.md](./integration-edge-cases.md#controlling-which-widgets-do-something-data-scriptoscope-widgets).

### Built-in frame schemes

The five schemes without a `wnd#` recipe (apple-platinum-2, black-platinum, platinum-8, slimes, system7-nostalgia-silver) draw their widgets only on the active window. The widget buttons stay in place on an inactive window, focusable and announced, but a pointer press where an invisible widget sits only activates the window (and can move it). When keyboard focus reaches one of those buttons, the window activates and redraws with its widgets visible (#614).

## 5. Window scroll bars

When a window's content overflows its declared size, the runtime replaces the browser's scroll bar with the scheme's own. The content box gets `overflow: hidden` on that axis and a 15 px gutter, and a themed bar (`role="scrollbar"`) is drawn over the gutter. The bars always read the real scroll position, so they follow scrolling from any source: focus moving into hidden content, `scrollIntoView`, find-in-page or script (#549, `scrollbar-scroll-sync.spec.mjs`).

When there are no themed bars:

- Window types matching `utility`, `palette`, `floating`, `modal` or `dialog` never scroll; their content is clipped.
- Auto-fitted windows grow to their content instead, until a [user resize](#after-a-resize) or a px `max-width`/`max-height` cap stops them.
- Collapsed windows.

Imperative note: the scroll container is the `extra.contentEl` you pass to `add` (or the content box if you pass none). Give it `height: 100%` and `overflow: auto`, as the declarative slot has, or vertical overflow isn't detected.

### Pointer (#567, #572)

A press acts on the part under the pointer, hit-tested on the bar as drawn:

| Part | Press | Hold |
|---|---|---|
| Up / down (left / right) arrow | Steps one line (24 px), drawn pressed. | After 400 ms, repeats every 50 ms while the pointer stays over the arrow. Moving off pauses the repeat and the pressed art; moving back resumes it. |
| Track above / below the thumb | Pages by the visible length minus one line (24 px overlap). | Repeats the same way, and stops once the thumb reaches the pointer. |
| Thumb | The scroll position follows the pointer's position along the bar. | Drag to scroll. |

- Mouse: primary button only. The bar captures the pointer. The press ends on release, `pointercancel`, lost capture, window `blur`, or the page becoming hidden. A move with no button down (the release was lost outside the page) also ends it.
- A press on an inactive window's bar only activates the window (#594).
- Steps move by whole pixels with `behavior: 'instant'`, so a consumer `scroll-behavior: smooth` doesn't skew repeated steps (#556).
- If the scheme has no track art for the requested state, a procedural Platinum bar is drawn instead. It has no part geometry: any press on it drags to the pointer position.

### Wheel and trackpad

- Without Shift the vertical bar takes `deltaY` and the horizontal bar `deltaX`. With Shift held only the horizontal bar moves: it takes `deltaX`, or `deltaY` when `deltaX` is 0, so Shift+wheel works whether or not the browser has already converted it to `deltaX` (#614).
- Deltas are applied in whole pixels. The fraction carries over to the next event, so slow trackpad scrolls add up to their true sum. A change of direction drops the carried fraction, so it never cancels the first step the other way. Deltas under 0.5 px are ignored. `deltaMode` isn't consulted: deltas are treated as pixels.
- The wheel event is consumed (`preventDefault`) when a themed bar of the window takes an amount of 0.5 px or more, so it doesn't scroll the page, even at the end of the content. Shift+wheel over a window with only a vertical bar isn't consumed.
- The wheel doesn't activate an inactive window.

### Keyboard

Tab to the bar, then:

| Key | Action |
|---|---|
| ArrowDown / ArrowUp (vertical), ArrowRight / ArrowLeft (horizontal) | one line (24 px) |
| PageDown / PageUp | one page |
| Home / End | to the start / end |

Holding a key uses the operating system's key repeat.

### Inactive art (#594)

An inactive window's bars draw the scheme's inactive tier. They repaint in place on every activate and deactivate, keeping the same element and ARIA attributes. The procedural fallback bar has no inactive art and looks the same in both states (every corpus scheme ships both tiers).

## 6. Controls

Since 0.7.0 (#484) Scriptoscope draws themed art over native form controls. The native element stays the source of truth for value, form association, keyboard and accessibility. The summary:

| Control | Interaction surface | Themed art |
|---|---|---|
| `data-scriptoscope-button` | A native `<button type="button">` face; clicks are forwarded to the original button | Push-button art with pressed feedback |
| checkbox, radio | The native input, invisible, laid over the art | Checked and disabled states |
| `<input type="range">` | Pointer on the art; keyboard and accessibility on the native input | Slider art |
| `<select>` | The native select, invisible, laid over the art; the browser's own menu | Passive button art showing the selected option and "▾" |
| `data-scriptoscope-field` | The native text input or textarea | Sunken bevel only |
| `data-scriptoscope-tabs` | Themed tab faces (`role="tab"`) | Tab art |

The example host promotes checkboxes, radios, ranges and selects automatically. Opt one out with `data-scriptoscope-control="off"`.

### Push buttons

`promoteButton(el, theme)` (and the example host for `data-scriptoscope-button`) hides the original button in place and inserts a themed face after it. The face is a real `<button type="button">` built by `interactiveButton`, so native click, Space, Enter, focus and disabled-fieldset behaviour apply. Activating the face calls `el.click()` on the original, so its listeners run and a `type="submit"` or `type="reset"` button inside a `<form>` still submits or resets it.

- **Press tracking:** the face draws pressed on a primary-button `pointerdown`, or Space/Enter `keydown`. It goes back to normal on `pointerup`, `pointerleave`, `pointercancel`, `blur` or `keyup`. Dragging out of the button releases the pressed art, and dragging back in doesn't redraw it. Releasing outside cancels the click (native button behaviour).
- **Disabled:** `data-scriptoscope-disabled` or a native `:disabled` button. No press art, no click. Button disabled and default state are sampled at promotion and retheme; later attribute changes aren't observed.
- **Default button:** `data-scriptoscope-default` draws the OK ring only. There is no Return or Escape key handling (see [Not implemented](#not-implemented)).
- **No themed art:** when a scheme lacks an admitted face, `interactiveButton` returns a native baseline (procedural Platinum) button with the same press feedback (#551).

Imperative: `interactiveButton(theme, { label, default, disabled, onClick })` is async: it returns a `Promise` that resolves to the `HTMLButtonElement` itself, with no wrapper. `onClick` follows the native `click` (Enter can activate on keydown).

### Checkboxes and radios

The native input moves into a themed `<label>` carrier and sits over the art at full size with `opacity: 0`. The browser owns everything: clicking, Space, label clicks, radio-group arrow keys and `name` grouping. The art repaints from the input's state on `input`, `change`, form `reset`, `pageshow`, and changes to `checked`, `disabled`, an enclosing `<fieldset disabled>` or its first legend. The associated label's text is drawn into the art and the original label is visually hidden. There is no separate pressed art.

### Sliders and `<input type="range">`

A promoted range keeps the native input as its only keyboard and accessibility control (it's visually hidden; the themed slider is `aria-hidden`). Native `min`, `max`, `step` (including fractional and `step="any"`), labels, disabled fieldsets and keyboard event timing stay with the browser (`range-constraints.spec.mjs`).

Pointer, on the themed canvas only (blank space around a stretched wrapper is inert):

- A press on the thumb drags it from where it was grabbed. A press that doesn't move keeps the exact native value (`range-pointer.spec.mjs`).
- A press on the track centres the thumb under the pointer, then drags.
- Each change dispatches a synthetic `input` event on the native input. Releasing dispatches `change` if the value differs from where the drag began.
- The value is set through the native input, so it's sanitized to `min`, `max` and `step`.
- A disabled input ignores the pointer.

The art follows `input`/`change` events, form reset, live `min`/`max`/`step`/`value`/`disabled` attribute changes and persisted `pageshow`. A bare `input.value = …` in script isn't observed until the next interaction, `pageshow` or retheme; dispatch `input` or `change` after setting it.

Imperative `interactiveSlider(theme, { orientation, length, value, onChange })` uses a normalized 0..1 value. It is a focusable `role="slider"` with `aria-valuenow` 0..100, and the same thumb-grab and track-centre pointer policy. Arrow keys step 0.05 (Shift: 0.1); Right and Up increase. There's no Home, End or Page key handling. `onChange` fires on every change. Only this imperative slider can be vertical (promoted ranges are always horizontal); a vertical engine slider has its minimum at the bottom.

Imperative `interactiveScrollbar` is a standalone drag surface: a press anywhere sets the value to the pointer position, and arrow keys step like the slider. It isn't the window scroll bar described in section 5.

### Disclosure triangles

Imperative only: there is no `data-scriptoscope-*` attribute. `interactiveDisclosure(theme, { open, onToggle })` returns a focusable `role="button"` with `aria-expanded`. Click, Space or Enter toggles it between right (closed) and down (open) and calls `onToggle(open)`. Wire that to show and hide your content. Without themed art it falls back to the text glyphs ▶ and ▼.

### Tabs

`data-scriptoscope-tabs` builds an ARIA tablist with themed tab faces and a roving tabindex.

- **Pointer:** a press on a tab selects it at once (on `pointerdown`) and focuses it.
- **Keyboard:** ArrowLeft and ArrowRight move to the previous or next tab, wrapping; Home and End go to the first and last. Moving also selects (automatic activation). Space or Enter selects the focused tab.
- Selecting shows the matching `data-scriptoscope-panel` and hides the others with `hidden`. The selection survives a retheme (`tabs-accessibility.spec.mjs`).
- A scheme with no tab art keeps the native buttons, styled as tabs, with the same keyboard handling.

### Theme picker and theme switcher

- `<select data-scriptoscope-theme-switcher>`: a `change` rethemes every window and control on the page.
- `data-scriptoscope-theme-picker` tiles (`role="tab"`): a click or ArrowLeft, ArrowRight, Home or End switches theme immediately. The first `pointerdown`, `keydown` or `wheel` anywhere in the root stops `autoCycle`.

## 7. Modals

`openModal(wrap, { returnFocusTo, onClose })` (also `handle.openModal` on the example host) shows a wrap that already contains a promoted window. It doesn't promote anything itself. It:

- sets `data-scriptoscope-modal-open` on the wrap (your CSS shows the wrap off that attribute), and `role="presentation"` if the wrap has no role;
- makes the rest of the page `inert`: the wrap's siblings at every level up to `<body>`, skipping elements that were already inert, and restores exactly those on close;
- focuses, in a microtask, the first focusable element inside the wrap: light-DOM content first, then the window chrome's controls. If there are none, it focuses the wrap itself (adding `tabindex="-1"`);
- traps focus: any focus that lands outside the wrap is pulled back to the first focusable element inside it;
- keeps every window host inside the wrap on the `box` hit area while open, so a press on a frame gap stays with the modal window and never reaches the backdrop, and outside presses don't deactivate it (#597). After close the windows return to their requested mode. A window promoted into an already open wrap is covered too;
- closes on **Escape** (a `keydown` listener on the document), on a click whose target is the wrap itself (the backdrop, not its children), on the inner window's `scriptoscope:close`, or on `handle.close()`.

On close it removes the attribute and the listeners, lifts the inert state, returns focus (by default to the element focused when the modal opened; pass `returnFocusTo: null` to skip), then calls `onClose`. Calling `openModal` again on an open wrap opens nothing new: it returns a new `{ close }` object bound to the same close function, so either handle closes the modal.

Windows of type `dialog`, `alert`, `movable-modal` and `movable-alert` that have a title carry `role="dialog"` and `aria-modal="true"`. Other utility and popup types get `role="dialog"`, and document windows `role="group"`. The runtime adds no backdrop or trap for these types by itself: `openModal` is what makes a modal modal.

## 8. Events reference

### Library events

| Event | Target | Bubbles | Composed | Detail | When |
|---|---|---|---|---|---|
| `scriptoscope:userresize` | the window host | yes | no | `{ w, h }`: new content width and height in unscaled CSS px | After a grow-box resize by pointer (on release) or keyboard (each step) that changed the size. Fires before the new chrome finishes rendering. Not for zoom or programmatic sizing. Imperative windows fire it too. |
| `scriptoscope:close` | the window host | yes | yes | none | Declarative windows only, when the window is unmounted: by the close widget, or by a direct call to the public `ScriptoscopeWindow.unmount()` (as `demo/advertisement.mjs` does). Fires before teardown, so the host is still readable. Not fired by `restoreOriginalElement()` (which `handle.disconnect()` uses) or by a failed promotion. |
| `input` | the native range input | yes | yes | none | A pointer drag on a promoted range changed its value. |
| `change` | the native range input | yes | no | none | A pointer drag on a promoted range ended at a different value. |

The original element is removed when a window is promoted, so listen for host events on a stable ancestor (`document`, your app root), not on the source element.

### Callbacks (imperative)

- `handlers.onClose`, `onZoom`, `onCollapse` on `WindowManager.add` (section 4).
- `manager.setChangeListener(host => …)`: one listener per manager, called after every committed render (activation flips, including deactivation by an outside press, resizes, collapse, zoom, retheme, outer-size changes) and every committed move (`setPosition`: end of a pointer drag, each keyboard move step, restore). It isn't called per frame during a drag, or for hit-mode changes. Read state back with `describe(host)` and `host.style.left/top`.
- `manager.describe(host)` returns `width`, `height`, `collapsed`, `z`, `theme`, and (#597) `active`, `hit` (the window's own hit request, `undefined` when it inherits) and `hitEffective` (`'region'` or `'box'`).
- Debugging: `setDebug({ categories: ['region'] })` logs one event per region build (`built`, or `build failed`, after which the window keeps the box for that commit), ignored hit values, and hosts found inside closed shadow roots.
- `interactiveSlider`/`interactiveScrollbar` `onChange(value)`, `interactiveDisclosure` `onToggle(open)`, `interactiveButton` `onClick()`.

### Example host events (`demo/explicit-host.mjs`)

These come from the published example host, not the library.

| Event | Target | Bubbles | Detail | When |
|---|---|---|---|---|
| `ready` | the handle | no | `{ stats }` | Initial promotions, scroll-bar refreshes and boot reveals have settled (#565). |
| `retheme` | the handle | no | `{ ref }` | A `handle.retheme(ref)` request (also from the switcher, picker or auto-cycle) completed and is still the latest. |
| `promoteError` | the handle | no | `{ kind, el, cause }` | A target failed to promote. |
| `unmounted` | the handle | no | none | `handle.disconnect()` finished. |
| `scriptoscope:promoted` | the window host, the button face, or the promoted element (control, field, tabs, icon) | yes | `{ kind, host }` | A target was promoted. `kind` is `window`, `button`, `control`, `field`, `tab` or `icon`. |
| `scriptoscope:promoteError` | the original element | yes | `{ kind, el, cause }` | Same as the handle's `promoteError`. |

## 9. Accessibility notes

Keyboard equivalents for every pointer gesture:

| Pointer | Keyboard |
|---|---|
| Click a window to activate it | Tab into it |
| Drag the frame | Move window handle: arrows (8 px), Shift + arrows (32 px) |
| Drag the grow box | Resize window: arrows (8 px), Shift + arrows (32 px) |
| Click close, zoom, collapse | Tab to the widget, Enter or Space |
| Double-click the frame | Tab to Collapse window (if wired), Enter or Space |
| Scroll-bar arrows, track, thumb, wheel | Tab to the bar: arrows, PageUp/PageDown, Home/End |
| Slider drag | Native range keys (promoted) or arrows (imperative) |
| Tab click | Arrows, Home, End, Space, Enter |

- Windows with a title are labelled by it (`aria-label`), with roles as in [Modals](#7-modals).
- Within one `WindowManager`, keyboard focus is always in the active, frontmost window, so a focused control is never hidden under another of that manager's windows (#550, WCAG 2.2 SC 2.4.11). This isn't guaranteed across managers: a window with its own manager (see [Two ways in](#two-ways-in)) stays active alongside the others, and its z-index isn't coordinated with theirs. Title widgets follow visual reading order (#537, WCAG 2.4.3).
- A window whose close widget isn't wired (or a shaded window's grow box) has no hidden focus stop.
- The chrome has no hover states. That's deliberate; see the README's "A heads-up on hover".
- **Reduced motion:** with `prefers-reduced-motion: reduce`, the example host plays no boot reveal and doesn't start `autoCycle`, and `scriptoscope.css` drops the wipe-in and the picker icon fade. Window moves, resizes, zoom and collapse are never animated, so nothing else changes.

## 10. Platform differences

### Touch and pen

- All window interaction uses Pointer Events, so touch and pen work like a mouse for moving, resizing, widgets, scroll bars and sliders. The mouse-only rule is "primary button only"; for touch and pen, frame drags and the grow box need the primary pointer, so a second finger doesn't start a second drag.
- The window chrome, the grow box, the window scroll bars and sliders set `touch-action: none`, so dragging them doesn't scroll or zoom the page. The content area resets `touch-action: auto`, so ordinary content can be swiped.
- A window that shows themed scroll bars has `overflow: hidden` on the scrolled axis, so swiping its content doesn't scroll it. Use the bars.
- If the browser takes over a gesture and sends `pointercancel`, a move or resize in progress is reverted rather than committed (#563).
- In `region` mode, touch and pen over a transparent frame pixel reach the page beneath, so page scrolling works there; `touch-action: none` applies only inside the window's region. An outside touch deactivates the active window only on a completed tap (see [1a](#1a-hit-area-and-frame-pass-through)).
- There's no touch-specific layout. See [integration-edge-cases.md](./integration-edge-cases.md#mobile--responsive).

### Wheel routing and performance

Region windows carry a non-passive no-op wheel listener on the clipped hit layer.
This works around WebKit routing wheel input by the layer's rectangular area
instead of its clip: without it, wheels over transparent frame gaps can fail to
scroll the page beneath. The listener is currently retained in every engine
because a reliable behavioral detection has not been established. It makes
native wheel routing over this layer, including slotted content scrollers, depend
on the main thread in Chromium and Firefox too. Idle-runner latency measurements
cannot establish the cost when that thread is busy. `box` mode removes this
listener. This workaround does not activate an inactive window when scrolling.

During a captured frame drag or grow-box resize the clip is suspended for
WebKit's rendering cost. A resize that finishes preparation during a newer frame
drag keeps the clip suspended until that drag ends, then restores the latest
committed region. HPT36 retains its WebKit limit of 3 ms above the same-run box
frame-p95 baseline, using five interleaved trials; observations include runner
identity, individual trials and release-to-next-frame time. Other engines report
these timings without a performance gate.

### Firefox and WebKit

Five interaction contracts run in Firefox and WebKit at DPR 1 in the release gate, and in Chromium on every PR: `window-pointer-drag`, `growbox-zero-delta`, `growbox-zone`, `posture-b` and `transformed-ancestors` (`tests/rendering-options/interaction-specs.mjs`, [CI.md](../tests/rendering-options/CI.md#firefox-and-webkit-interaction-contracts-598), #598). The extended matrix runs every spec, including `scrollbar-parts`, in every engine. Engine differences those contracts account for:

- **Sub-pixel pointers.** In the contract tests, Playwright's Chromium mouse delivers fractional `clientX`/`clientY`, while its Firefox and WebKit mice floor to whole CSS pixels (`subpixel-pointer.mjs`; this is about Playwright's test mice, not a claim about real devices). The runtime rounds whatever coordinates it receives, so "jitter under half a pixel is no move" (#561, #552) is the same rule in every engine; where the test mouse can't send a fraction, the contracts send the sub-pixel moves as synthetic pointer events.
- **Lost capture timing.** WebKit delivers `lostpointercapture` only before the pointer's next event (#577), so a cancelled drag may revert on the next pointer event rather than at once.
- **Pointer capture and focus.** The list file names pointer capture, sub-pixel coordinates and focus as the areas where engines genuinely differ, which is why these five specs are the ones run per engine.
- **`scrollTo({ behavior: 'instant' })`** is used for scroll-bar steps; whole-pixel steps avoid WebKit truncating a fractional target a pixel short (#556).

## Not implemented

These are absent on `main`. Don't rely on them.

- Return or Enter activating the default button, and Escape or Command-period cancelling, in a window. (Escape closes an `openModal` wrap, and that's all.)
- A public method to activate a window or bring it to the front.
- Any per-window close, zoom or collapse events in the declarative path apart from `scriptoscope:close`. Use the change listener, or `handle` state, to observe zoom and collapse.
- Resizing from edges or other corners, and keyboard zoom other than the Zoom widget.
- A declarative disclosure-triangle attribute.
- Hover states.

