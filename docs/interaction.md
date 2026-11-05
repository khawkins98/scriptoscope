# Interaction reference

Use this page to look up pointer/keyboard behavior, focus, controls and events.
For setup use the [npm tutorial](./npm-consumer.md) or [hosted starter](../README.md#five-minute-setup); for markup/options use the [hosted reference](./hosted-reference.md).

## Two ways in

- **Declarative:** a host selects sources and awaits `ScriptoscopeWindow.promote`.
  This adds in-flow placement, undeclared-axis auto-fit and close-as-unmount on
  top of managed windows.
- **Imperative:** `manager.add(theme, opts, handlers, extra)` returns an absolute
  host for you to place. Wire close through `handlers.onClose` and remove both
  the managed window and its DOM host when finished.

Activation and z-order are per `WindowManager`. The example helper shares one
manager except for windows with authored theme overrides, which get their own.
Those windows can remain active beside windows of another manager.

`manager.dispose()` idempotently releases managed windows, listeners and pending
render authority, retaining caller DOM hosts and borrowed themes. It can accept
new windows afterward. For declarative windows use `unmount()` or
`restoreOriginalElement()` instead: manager disposal alone does not restore the
source or emit a close event.

## 1. Activation and focus

### What activates a window

| Input | Result |
|---|---|
| Press frame/content | Activate and raise; content receives its ordinary action. Frame presses can begin a move. |
| Press inactive scrollbar | Activate only; next press scrolls. |
| Press inactive title widget | Activate and potentially move; no widget action/pressed art for that gesture. |
| Press inactive grow box | Activate and focus the grow box only; next press resizes. |
| Focus enters chrome/content | Activate and raise without moving/resizing. |
| Wheel | Scroll where applicable, without activating. |
| Press outside manager's windows | Deactivate unless the active window requests box mode; see [hit area](#1a-hit-area-and-frame-pass-through). |

An inert first widget gesture suppresses its release click, not later independent
synthetic/assistive-technology activation. An active-window press raises it;
only windows whose activation changed repaint.

A manager has at most one active window. Explicit active requests replace its
previous active window; last successful addition wins. Without a state request,
only its first window starts active. An explicitly inactive first window leaves
none active. Failed initial rendering does not steal activation. There is no
public activation method; keyboard focus entering a window activates it.

### Z-order

Each window has a stacking number `z` from a per-manager clock. Every activation takes the next tick, as does every press on the active window's frame, content or grow box. A zoom doesn't change `z` by itself; zooming an inactive window activates it first. The host's `z-index` is `100000 + z` for the active window and `z` for inactive ones, so the active window is always above every inactive one, and inactive windows are stacked by recency.

- Declarative: `data-scriptoscope-z` seeds the initial value. Without it the clock follows document order.
- Imperative: `extra.z` on `add`, and `applyState(host, { z })`.

### Focus inside a window

Tab order: focusable content in DOM order, wired title widgets in visual reading
order, **Move window**, **Resize window** (unless collapsed), vertical then
horizontal scrollbar when needed. Runtime-only content viewports add no tab stop;
authored content `tabindex` remains intact.

Chrome controls retain identity/focus through activation, resize and retheme.
When a focused grow box or scrollbar disappears, focus moves to the move handle.
A frame/grow-box/inactive-widget press focuses that window's move handle or grow
box without a visible pointer focus ring, unless focus is already inside it.
An inactive scrollbar's first press does this too; active scrollbar presses leave
keyboard focus where it was.

### Focus rings

Chrome controls have a runtime-provided 2 px `Highlight` focus-visible outline;
it does not depend on `scriptoscope.css`. The unclipped decoration layer keeps
rings visible over frame gaps. With the optional stylesheet,
`--scriptoscope-focus-color` and `--scriptoscope-focus-width` customize promoted
control focus. Select/range focus is mirrored on the visible face; checkable
faces use a 2 px currentColor outline while their native input is focused.

## 1a. Hit area and frame pass-through

| Requested mode | Input behavior |
|---|---|
| `region` (default) | Content and opaque frame pixels receive input. Frame gaps pass trusted press/hover/wheel/touch to the page beneath; a passed press neither activates nor raises this window. |
| `box` | The full rectangle receives input; outside presses do not deactivate it. |

The effective mode falls back to box for built-in-frame schemes
(`apple-platinum-2`, `black-platinum`, `platinum-8`, `slimes`,
`system7-nostalgia-silver`), no-chrome fallback, open modal windows and a failed
region build. Bare `renderWindow()` output is never clipped. The region follows
committed chrome state/geometry, not pointer motion.

Choose per window with `data-scriptoscope-hit`, `extra.hit` on `add`, or
`applyState(host, { hit })`; pass `hit: null` to inherit again. Otherwise the
manager's default applies (`new WindowManager({ hit })`, `setDefaultHit`), then
region. The example helper's `hit` configures every manager it creates. Trimmed,
case-insensitive values are accepted; invalid/empty values inherit and log once
in region debug. Mode changes do not repaint, notify the change listener or
persist. `data-scriptoscope-hit-effective` reports the result.

**Outside deactivation follows the requested mode**, even for built-in frames
whose effective mode is box. It never applies to windows inside open modal wraps
or closed shadow roots. A press outside all windows of that manager includes a
frame gap, another manager's window or a standalone control.

Mouse/pen deactivate on pointerdown. Touch requires a completed outside tap:
scroll/pinch/cancel, intervening press/key/context-menu cancels it; a keyboard or
programmatic click alone does not count. Inside/outside uses `composedPath()`,
so top-layer popovers/dialogs opened from window content count as inside.
Deactivation repaints inactive art and drops the active z boost without consuming
the page event. Browser UI, cross-origin frames, window blur and Tab leaving the
manager do not trigger it.

Focus rings and resize outlines remain unclipped. Consumer fixed/escaped content
is clipped to the region: put menus/tooltips in the top layer (`popover`, native
modal dialog/select), outside the window, or choose box mode. Optional
`::part(window)` shadows neither clip the frame nor capture gap input. See the
[hit contract](./spec/engine/hit-regions.md) for implementation rules.

## 2. Moving

### Pointer

Press and drag on **any part of the frame**: the title bar, and also the side and bottom borders. This is what lets side-titled palettes (`side-floating-utility-window`) be dragged. Presses on wired title widgets, the grow box and the scroll bars don't start a move. A press on a widget's transparent pixels does (on `wnd#` windows only the pressed widget art's mask counts as the widget).

- Only the primary mouse button, and only the primary pointer (`isPrimary`). A second finger or pen contact doesn't start a second drag.
- The window follows the pointer live by writing `left`/`top`. Nothing re-renders during a drag.
- The pointer is captured on the window, so moves keep arriving when the pointer leaves the window or crosses elements that swallow events.
- A press that never moves by at least half a CSS pixel is no move. An in-flow window stays in flow and no change is committed. A drag released back at its start commits nothing either.
- `pointercancel` or a lost capture (for example the browser takes the gesture) puts the window back where it started and commits nothing.
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

The first real move or resize lifts an in-flow window into absolute positioning
and leaves a hidden placeholder reserving its original slot. It stays absolute
until removed; a host already absolute/fixed needs no placeholder. See
[layout and sizing](./integration-edge-cases.md#how-positioning-works-posture-b-2026-05-31).

### Scaled, rotated and skewed ancestors

Move, resize, range and scrollbar pointer coordinates are mapped into the
containing block's CSS pixels under scale, rotation and skew. Promotion measures
the source's own CSS size, not its transformed screen bounds.

### Persistence and cross-tab restore (example host only)

The library has no persistence. It exposes the pieces: `setChangeListener`, `describe`, `applyState`, `setPosition` and `setOuterSize`. The example host builds layout persistence on them when you pass `persistKey`:

- Positions, sizes, collapsed state and z are saved to `localStorage["scriptoscope:layout:<persistKey>"]`, keyed by `data-scriptoscope-window-id` (or the window's index). Writes are debounced by 250 ms and flushed on `pagehide` and when the page becomes hidden.
- A mid-drag position is never saved: while a window holds pointer capture, saves use its pre-drag position, so a cancelled drag leaves the old position stored.
- Other tabs with the same `persistKey` apply each other's changes live through the `storage` event. A tab only writes back the rows it changed itself.
- A window that was in flow is restored in flow; a dragged one is restored as absolute. A restored size counts as a user size, so auto-fit doesn't grow it afterwards.

`WindowManager.setChangeListener` holds one listener. The example host uses it for persistence, so code that calls it on the same manager replaces persistence.

## 3. Resizing

### Grow box (pointer)

The ghost outline shown during a pointer resize is drawn in the window's decoration layer, so it stays visible beyond the old window size and over transparent frame pixels.

Drag the window's bottom-right corner. The hit zone is the scheme's own grow box when it has one; otherwise it's the frame corner plus the classic 15 px square where the two scroll-bar gutters meet. The scroll bars stop short of that zone, so their end arrows are never under it. Only the corner resizes: the right and bottom edges don't.

- Primary mouse button or primary pointer only. The pointer is captured on the grow box.
- During the drag the runtime draws a dotted outline of the new size. The window re-renders once, on release.
- A press that doesn't change the integer content size is no resize: no handoff, no outline, no event. A drag released at its starting size commits nothing.
- `pointercancel` or a lost capture removes the outline and commits nothing.
- A grow-box press on the active window raises it. A first press on an inactive window's grow box only activates it and focuses the grow box; resizing starts on the next press. Keyboard resize works on both.

### Grow box (keyboard)

Tab to **Resize window**, then:

| Key | Content size change |
|---|---|
| ArrowRight / ArrowLeft | width +8 / -8 px |
| ArrowDown / ArrowUp | height +8 / -8 px |
| with Shift | 32 px steps |

Each step re-renders. A step that the minimum clamps to the current size does nothing.

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

- **Zoom** grows the window to show all its content (the content element's scroll size, at least the current size), capped at 760 × 560 px of content. A window without a content element grows to 1.5 times its size. Zoom un-shades a collapsed window first and raises it (see [Z-order](#z-order)). Zooming again restores the size from before the zoom, including "no size" for a window that had none. While zoomed, `setOuterSize` updates the size that un-zoom restores.
- **Collapse (window-shade)** rolls the window up to its title bar, using the scheme's collapsed art when it has some, and hides the content (the content nodes stay in place). On `wnd#` schemes a side-titled palette (`side-floating-utility-window`) collapses sideways: it keeps its height and rolls up to its vertical title strip. The grow box and scroll bars go away while collapsed. Collapsing again restores it.
- **Double-click any frame edge** toggles window-shade too, including on side-titled palettes. Double-clicks on widgets, scroll bars and the grow box don't. This path always runs the built-in shade, and afterwards calls `handlers.onCollapse` if there is one.
- `data-scriptoscope-collapsed`, `extra.collapsed` or `applyState(host, { collapsed })` set the shade state without running any handler. A rendered `popup-window` ignores collapse requests, remains expanded and reports `collapsed: false`; its requested content size is preserved. This applies to initial state and toggling too.

### Press feedback and activation

- Pointer press on a widget of the active window draws its pressed art. It's released on `pointerup` or when the pointer leaves the widget. Dragging back over it doesn't redraw it pressed.
- The action runs on `click`, so releasing outside the widget cancels it (native button behaviour).
- On `wnd#` windows, only pixels inside the pressed widget art's mask count as the widget. A press on its transparent pixels falls through to the frame.
- Enter and Space on a focused widget always act, on active and inactive windows. Keyboard focus reaching an inactive window's widget activates the window first, as any focus does.
- A pointer press on an inactive window's widget only activates the window and can start a move; it draws no pressed art and runs no action (see [Activation](#1-activation-and-focus), #614). The window's state is read when the press begins.
- A zoom or collapse that runs on an inactive window (only a keyboard, assistive-technology or `element.click()` click can cause one) first activates and raises the window, then acts. This holds for the built-in zoom and collapse and for `onZoom`/`onCollapse` handlers. Close doesn't activate.

### Opting out: `data-scriptoscope-widgets`

A comma-separated subset of `close`, `zoom`, `collapse` (case-insensitive). Only the listed widgets are wired; `data-scriptoscope-widgets=""` wires none. Imperatively, pass `extra.enabledWidgets` (a `Set`).

A widget that isn't wired is still painted (the runtime never paints over the scheme's art), but it has no overlay button. So it isn't in the tab order and it isn't announced, and a press on it acts like a press on the frame: it activates the window and can start a move. Details: [integration-edge-cases.md](./integration-edge-cases.md#controlling-which-widgets-do-something-data-scriptoscope-widgets).

### Built-in frame schemes

The five schemes without a `wnd#` recipe (apple-platinum-2, black-platinum, platinum-8, slimes, system7-nostalgia-silver) draw their widgets only on the active window. The widget buttons stay in place on an inactive window, focusable and announced, but a pointer press where an invisible widget sits only activates the window (and can move it). When keyboard focus reaches one of those buttons, the window activates and redraws with its widgets visible.

## 5. Window scroll bars

When a window's content overflows its declared size, the runtime replaces the browser's scroll bar with the scheme's own. The content box gets `overflow: hidden` on that axis and a 15 px gutter, and a themed bar (`role="scrollbar"`) is drawn over the gutter. The bars always read the real scroll position, so they follow scrolling from any source: focus moving into hidden content, `scrollIntoView`, find-in-page or script.

When there are no themed bars:

- Window types matching `utility`, `palette`, `floating`, `modal` or `dialog` never scroll; their content is clipped.
- Auto-fitted windows grow to their content instead, until a [user resize](#after-a-resize) or a px `max-width`/`max-height` cap stops them. A cap also bounds the size the window starts at: when the captured source box is larger than the host's cap (a `content-box` source adds its padding and border to its `max-height`), the window is fitted inside the cap before `promote` resolves, so its chrome never hangs out of its host while waiting for the first auto-fit frame.
- Collapsed windows.

Imperative note: the scroll container is the `extra.contentEl` you pass to `add` (or the content box if you pass none). Give it `height: 100%` and `overflow: auto`, as the declarative slot has, or vertical overflow isn't detected.

<a id="pointer-567-572"></a>

### Pointer

A press acts on the part under the pointer, hit-tested on the bar as drawn:

| Part | Press | Hold |
|---|---|---|
| Up / down (left / right) arrow | Steps one line (24 px), drawn pressed. | After 400 ms, repeats every 50 ms while the pointer stays over the arrow. Moving off pauses the repeat and the pressed art; moving back resumes it. |
| Track above / below the thumb | Pages by the visible length minus one line (24 px overlap). | Repeats the same way, and stops once the thumb reaches the pointer. |
| Thumb | The scroll position follows the pointer's position along the bar. | Drag to scroll. |

- Mouse: primary button only. The bar captures the pointer. The press ends on release, `pointercancel`, lost capture, window `blur`, or the page becoming hidden. A move with no button down (the release was lost outside the page) also ends it.
- A press on an inactive window's bar only activates the window.
- Steps move by whole pixels with `behavior: 'instant'`, so a consumer `scroll-behavior: smooth` doesn't skew repeated steps.
- If the scheme has no track art for the requested state, a procedural Platinum bar is drawn instead. It has no part geometry: any press on it drags to the pointer position.

### Wheel and trackpad

- Without Shift the vertical bar takes `deltaY` and the horizontal bar `deltaX`. With Shift held only the horizontal bar moves: it takes `deltaX`, or `deltaY` when `deltaX` is 0, so Shift+wheel works whether or not the browser has already converted it to `deltaX`.
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

<a id="inactive-art-594"></a>

### Inactive art

An inactive window's bars draw the scheme's inactive tier. They repaint in place on every activate and deactivate, keeping the same element and ARIA attributes. The procedural fallback bar has no inactive art and looks the same in both states (every corpus scheme ships both tiers).

## 6. Controls

Scriptoscope draws themed art over native form controls. The native element stays the source of truth for value, form association, keyboard and accessibility. The summary:

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
- **No themed art:** when a scheme lacks an admitted face, `interactiveButton` returns a native baseline (procedural Platinum) button with the same press feedback.

Imperative: `interactiveButton(theme, { label, default, disabled, onClick })` is async: it returns a `Promise` that resolves to the `HTMLButtonElement` itself, with no wrapper. `onClick` follows the native `click` (Enter can activate on keydown).

### Checkboxes and radios

The native input moves into a themed `<label>` carrier and sits over the art at full size with `opacity: 0`. The browser owns everything: clicking, Space, label clicks, radio-group arrow keys and `name` grouping. The art repaints from the input's state on `input`, `change`, form `reset`, `pageshow`, and changes to `checked`, `disabled`, an enclosing `<fieldset disabled>` or its first legend. The associated label's text is drawn into the art and the original label is visually hidden. There is no separate pressed art.

### Sliders and `<input type="range">`

A promoted range keeps the native input as its only keyboard and accessibility control (it's visually hidden; the themed slider is `aria-hidden`). Native `min`, `max`, `step` (including fractional and `step="any"`), labels, disabled fieldsets and keyboard event timing stay with the browser.

Pointer, on the themed canvas only (blank space around a stretched wrapper is inert):

- A press on the thumb drags it from where it was grabbed. A press that doesn't move keeps the exact native value.
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
- Selecting shows the matching `data-scriptoscope-panel` and hides the others with `hidden`. The selection survives a retheme.
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
- keeps every window host inside the wrap on the `box` hit area while open, so a press on a frame gap stays with the modal window and never reaches the backdrop, and outside presses don't deactivate it. After close the windows return to their requested mode. A window promoted into an already open wrap is covered too;
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
- `manager.describe(host)` returns `width`, `height`, `collapsed`, `z`, `theme`, and `active`, `hit` (the window's own hit request, `undefined` when it inherits) and `hitEffective` (`'region'` or `'box'`).
- Debugging: `setDebug({ categories: ['region'] })` logs one event per region build (`built`, or `build failed`, after which the window keeps the box for that commit), ignored hit values, and hosts found inside closed shadow roots.
- `interactiveSlider`/`interactiveScrollbar` `onChange(value)`, `interactiveDisclosure` `onToggle(open)`, `interactiveButton` `onClick()`.

### Example host events (`demo/explicit-host.mjs`)

These come from the published example host, not the library.

| Event | Target | Bubbles | Detail | When |
|---|---|---|---|---|
| `ready` | the handle | no | `{ stats }` | Initial promotions, scroll-bar refreshes and boot reveals have settled. |
| `retheme` | the handle | no | `{ ref }` | A `handle.retheme(ref)` request (also from the switcher, picker or auto-cycle) completed and is still the latest. |
| `promoteError` | the handle | no | `{ kind, el, cause }` | A target failed to promote. |
| `unmounted` | the handle | no | none | `handle.disconnect()` finished. |
| `scriptoscope:promoted` | the window host, the button face, or the promoted element (control, field, tabs, icon) | yes | `{ kind, host }` | A target was promoted. `kind` is `window`, `button`, `control`, `field`, `tab` or `icon`. |
| `scriptoscope:promoteError` | the original element | yes | `{ kind, el, cause }` | Same as the handle's `promoteError`. |

## 9. Accessibility notes

Keyboard behavior is specified alongside each control above.

- Windows with a title are labelled by it (`aria-label`), with roles as in [Modals](#7-modals).
- Within one `WindowManager`, keyboard focus is always in the active, frontmost window, so a focused control is never hidden under another of that manager's windows (#550, WCAG 2.2 SC 2.4.11). This isn't guaranteed across managers: a window with its own manager (see [Two ways in](#two-ways-in)) stays active alongside the others, and its z-index isn't coordinated with theirs. Title widgets follow visual reading order (#537, WCAG 2.4.3).
- A window whose close widget isn't wired (or a shaded window's grow box) has no hidden focus stop.
- The chrome has no hover states. That's deliberate; the scheme supplies normal/pressed/disabled artwork, without invented hover art.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, the example host plays no boot reveal and doesn't start `autoCycle`, and `scriptoscope.css` drops the wipe-in and the picker icon fade. Window moves, resizes, zoom and collapse are never animated, so nothing else changes.

## 10. Platform differences

### Touch and pen

- All window interaction uses Pointer Events, so touch and pen work like a mouse for moving, resizing, widgets, scroll bars and sliders. The mouse-only rule is "primary button only"; for touch and pen, frame drags and the grow box need the primary pointer, so a second finger doesn't start a second drag.
- The window chrome, the grow box, the window scroll bars and sliders set `touch-action: none`, so dragging them doesn't scroll or zoom the page. The content area resets `touch-action: auto`, so ordinary content can be swiped.
- A window that shows themed scroll bars has `overflow: hidden` on the scrolled axis, so swiping its content doesn't scroll it. Use the bars.
- If the browser takes over a gesture and sends `pointercancel`, a move or resize in progress is reverted rather than committed.
- In `region` mode, touch and pen over a transparent frame pixel reach the page beneath, so page scrolling works there; `touch-action: none` applies only inside the window's region. An outside touch deactivates the active window only on a completed tap (see [1a](#1a-hit-area-and-frame-pass-through)).
- There's no touch-specific layout. See [integration-edge-cases.md](./integration-edge-cases.md#mobile--responsive).

### Wheel routing and performance

In region mode, gaps route trusted wheel input to the underlying scroll owner;
native content and nested scrollers keep ownership where the themed-scrollbar
policy does not intercept. Wheel input does not activate inactive windows.
Escaped content stays clipped. During a captured frame drag or grow-box resize,
clipping is suspended until the gesture ends; the latest committed region is then
restored. These input rules do not promise compositor latency bounds.

### Firefox and WebKit

Interaction contracts run in multiple engines; see the maintained
[browser test matrix](../tests/rendering-options/CI.md). Coordinate rounding
applies to received CSS-pixel input. WebKit can deliver lost pointer capture at
the next pointer event, delaying cancellation restoration until that event.
Whole-pixel instant scrollbar steps avoid fractional-target truncation.

## Not implemented

The following behaviors have no supported contract:

- Return or Enter activating the default button, and Escape or Command-period cancelling, in a window. (Escape closes an `openModal` wrap, and that's all.)
- A public method to activate a window or bring it to the front.
- Any per-window close, zoom or collapse events in the declarative path apart from `scriptoscope:close`. Use the change listener, or `handle` state, to observe zoom and collapse.
- Resizing from edges or other corners, and keyboard zoom other than the Zoom widget.
- A declarative disclosure-triangle attribute.
- Hover states.

