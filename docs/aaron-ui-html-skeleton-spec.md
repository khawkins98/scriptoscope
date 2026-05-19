# Aaron UI — HTML Skeleton Specification

**Status:** v1.0 — written 2026-05-19. Locks in the DOM contract Aaron UI produces for every Kaleidoscope-supported element.

**Audience:**
- External consumers building Kaleidoscope-themed web apps — this is the contract you target with declarative HTML or programmatic JS
- Maintainers of Aaron UI's runtime — every output mechanism must produce DOM matching the shapes here

**Companion specs:**
- [`docs/aaron-ui-architecture-spec.md`](./aaron-ui-architecture-spec.md) — the Kaleidoscope format + WDEF protocol context
- (TBD) `docs/aaron-ui-raster-mapping-spec.md` — how scheme resources fill the DOM defined here
- (TBD) `docs/aaron-ui-composer-spec.md` — the runtime that walks scheme + produces this DOM

**Scope:** the **complete** Kaleidoscope HIG vocabulary as documented in:
- K2 Scheme Reference §Windows, §Buttons, §Menus, §Sliders, §Progress, §Scrollbars, §Popup Menus, §Tabs, §Placards, §Headers, etc.
- Scheme Factory v1.0PR2 `STR# 128` (127-entry canonical region vocabulary)
- Apple Inside Macintosh: Macintosh Toolbox Essentials, Window Manager + Control Manager chapters

---

## 1. Universal contract

Every Aaron-UI-emitted element follows this shape:

```html
<{tag} class="aaron-{family}{-variant}?"
       data-state="normal|pressed|disabled|focused"
       data-aaron-{family}            <!-- declarative-promotion marker -->
       role="..."
       aria-*="...">
  ...per-family internal structure...
</{tag}>
```

### 1.1 Class naming convention

| Class | When used |
|---|---|
| `aaron-window` | Window root |
| `aaron-{family}` | Every other family (e.g., `aaron-button`, `aaron-slider`) |
| `aaron-{family}--{variant}` | When the family has size or directional variants (e.g., `aaron-button--default`, `aaron-tab--small`) |
| `aaron-{family}__{part}` | BEM-style sub-elements (e.g., `aaron-titlebar__title`) |

### 1.2 State attributes

These three apply to every interactive control. Render bindings (raster mapping spec, §B) key off them.

| Attribute | Values | Meaning |
|---|---|---|
| `data-state` | `normal` / `pressed` / `disabled` / `focused` / `inactive` / `collapsed` / `collapsed-active` / `collapsed-inactive` | Interaction state. Multiple in space-separated form not supported; precedence: `disabled` > `pressed` > `focused` > `normal` |
| `aria-checked` | `true` / `false` / `mixed` | For checkboxes + radios |
| `aria-disabled` | `true` / absent | Mirrors `data-state="disabled"` for screen readers |
| `aria-selected` | `true` / `false` | For tabs |
| `aria-expanded` | `true` / `false` | For disclosure triangles + popup menus |
| `aria-valuenow` / `aria-valuemin` / `aria-valuemax` | numeric | For sliders + progress bars |

### 1.3 Declarative promotion

For each interactive family, Aaron UI's scanner promotes existing HTML (or native form elements) into themed instances via a `data-aaron-{family}` marker. This preserves form semantics + accessibility — the native `<input>` / `<button>` stays in the DOM; Aaron UI styles around it.

```html
<!-- Consumer writes -->
<button data-aaron-button>OK</button>

<!-- Aaron UI promotes to -->
<button class="aaron-button" data-state="normal" data-aaron-button data-aaron-promoted>OK</button>
```

The `data-aaron-promoted` sentinel prevents re-scan on dynamically inserted DOM.

### 1.4 Programmatic API

Each family also has a `new AaronXxx({...})` constructor for app-level use. Same DOM output; both paths produce identical elements.

### 1.5 ARIA + semantic ground rules

- **Native form elements preserved** — `<input type="checkbox">` stays in the DOM (form-submit + screen reader semantics intact); Aaron UI styles around it
- **`role`** is set explicitly when there's no native equivalent (`role="tab"`, `role="dialog"`, `role="progressbar"`)
- **Keyboard activation** — Space + Enter trigger `activate`; Escape closes modals; Arrow keys move focus within `role="tablist"` and `role="radiogroup"`
- **No `:hover` styling** — period-faithful (classic Mac OS had no hover state)
- **Focus ring** — CSS `outline` (universal, predictable across schemes); cicn-derived focus is out of scope

---

## 2. Window family

The most complex family. Kaleidoscope's wnd# defines 8+ window types per scheme.

### 2.1 Window types

| Kaleidoscope name (STR# 128) | Aaron UI class | Use |
|---|---|---|
| Document Window | `aaron-window--document` | App main windows |
| Modal Dialog | `aaron-window--modal-dialog` | Block UI alerts requiring action |
| Modal Alert | `aaron-window--modal-alert` | Confirm/warning alerts |
| Movable Dialog | `aaron-window--movable-dialog` | Modal dialog the user can drag |
| Movable Alert | `aaron-window--movable-alert` | Movable warning |
| Utility Window | `aaron-window--utility` | Floating tool palette with title |
| Side Floating Utility Window | `aaron-window--utility-side` | Side-anchored tool palette |
| Untitled Utility Window | `aaron-window--utility-untitled` | Toolbox without titlebar |
| Popup Window | `aaron-window--popup` | Tabbed window pinned to screen edge (Finder pop-up) |

Each can additionally be `collapsed` (windowshade state).

### 2.2 DOM shape

```html
<div class="aaron-window aaron-window--{type}"
     data-aaron-window
     data-state="active|inactive|collapsed|collapsed-inactive"
     data-window-type="{type}"
     role="dialog"
     aria-labelledby="aaron-title-{N}"
     aria-modal="{true if modal/alert}">

  <div class="aaron-titlebar" role="presentation">
    <div class="aaron-titlebar__title">
      <span id="aaron-title-{N}">{title text}</span>
    </div>
    <!-- Hit-target overlays (transparent divs over the chrome cicn,
         positioned per wnd# parts table). One per named-widget part. -->
    <div class="aaron-titlebar__widgets" aria-hidden="true">
      <button class="aaron-widget aaron-widget--close" data-part="close"
              aria-label="Close"></button>
      <button class="aaron-widget aaron-widget--zoom" data-part="zoom"
              aria-label="Zoom"></button>
      <button class="aaron-widget aaron-widget--collapse" data-part="collapse"
              aria-label="Collapse"></button>
      <!-- Additional widgets per scheme (proxy-icon, alt-zoom, etc.) -->
    </div>
  </div>

  <div class="aaron-content">
    {consumer-provided body}
  </div>

  <!-- 8 resize handles (n, s, e, w, ne, nw, se, sw) — transparent, cursors only -->
  <div class="aaron-resize" data-direction="n"></div>
  <div class="aaron-resize" data-direction="s"></div>
  <!-- ... -->
</div>
```

### 2.3 State attribute values

| Value | Meaning |
|---|---|
| `active` | Window has focus (or is being dragged) |
| `inactive` | Window has lost focus |
| `collapsed` | Windowshade is collapsed (only titlebar visible) |
| `collapsed-inactive` | Collapsed + inactive |

### 2.4 Hit targets → AaronWindow events

| Hit target | Apple `wInXxx` | AaronWindow event |
|---|---|---|
| `.aaron-widget--close` | `wInGoAway` (4) | `close()` |
| `.aaron-widget--zoom` | `wInZoomIn`/`wInZoomOut` (5/6) | `zoom()` |
| `.aaron-widget--collapse` | `wInCollapseBox`/`wInCollapseBoxAll` (7/8) | `collapse()` |
| `.aaron-widget--proxy` | `wInProxyIcon` (9) | `proxyIconClick()` |
| `.aaron-titlebar` (non-widget area) | `wInDrag` (2) | drag |
| `.aaron-resize[data-direction]` | `wInGrow` (3) | resize |
| `.aaron-content` | `wInContent` (1) | passthrough to consumer |

### 2.5 Declarative promotion

```html
<div data-aaron-window data-aaron-window-type="document" data-aaron-window-title="My App">
  <p>...content...</p>
</div>
```

The scanner promotes this to a full themed window with the DOM shape above.

---

## 3. Push buttons + default buttons + bevel buttons

### 3.1 Push button — `aaron-button`

```html
<button class="aaron-button"
        data-aaron-button
        data-state="normal|pressed|disabled|focused"
        type="button">
  Click me
</button>
```

When `data-state="focused"` AND the button is the default in a dialog, render the **default ring** as an outer overlay:

```html
<button class="aaron-button aaron-button--default"
        data-aaron-button-default
        data-state="normal|pressed|disabled|focused">
  OK
</button>
```

### 3.2 Bevel button — `aaron-button--bevel`

Three size variants × on/off/mixed value × three states (= 27 visual combinations, but only ~9 cicn variants per K2):

```html
<button class="aaron-button aaron-button--bevel"
        data-aaron-button-bevel
        data-size="small|normal|large"
        data-value="on|off|mixed"
        data-state="normal|pressed|disabled"
        type="button"
        aria-pressed="true|false|mixed">
  {label or icon}
</button>
```

### 3.3 State machine

All button-family controls share:
- `pointerdown` → `data-state="pressed"`
- `pointerup` over button → fire `activate` event → `data-state="normal"`
- `pointerleave` while pressed → cancel; revert state
- `focus` → `data-state="focused"`
- `Space` or `Enter` while focused → equivalent to pointer-press

---

## 4. Checkboxes, radios, alternate checkboxes

K2 IDs: `-9504` (checkbox) through `-9484` (radio). Kaleidoscope handles 3-state (off/on/mixed), 3 interaction states (disabled/normal/pressed), and an "alternate-checked" variant.

### 4.1 Checkbox — `aaron-checkbox`

```html
<label class="aaron-checkbox"
       data-state="normal|pressed|disabled"
       data-value="off|on|mixed|alternate-on">
  <input type="checkbox" data-aaron-checkbox
         aria-checked="false|true|mixed">
  <span class="aaron-checkbox__chrome" aria-hidden="true"></span>
  <span class="aaron-checkbox__label">{label}</span>
</label>
```

The native `<input>` is preserved (form-submit semantics); the `<span class="aaron-checkbox__chrome">` is what the raster mapping paints onto. `data-value` flips when the input's `checked` toggles.

### 4.2 Radio — `aaron-radio`

```html
<label class="aaron-radio"
       data-state="normal|pressed|disabled"
       data-value="off|on|mixed">
  <input type="radio" data-aaron-radio name="{group}"
         aria-checked="false|true|mixed">
  <span class="aaron-radio__chrome" aria-hidden="true"></span>
  <span class="aaron-radio__label">{label}</span>
</label>
```

### 4.3 Radio group

Multiple radios sharing a `name` form a group. Aaron UI's scanner wraps them in:

```html
<div role="radiogroup" aria-labelledby="{label-id}">
  <!-- radios here -->
</div>
```

Arrow keys (Up/Down/Left/Right) move focus + selection within the group.

---

## 5. Disclosure triangles

K2 IDs: `-10112` to `-10081`. Right-facing + down-facing + (optional) left-facing variants. Each has a normal/pressed/disabled state + optional 5-frame animation.

```html
<button class="aaron-disclosure"
        data-aaron-disclosure
        data-facing="right|down|left"
        data-state="normal|pressed|disabled"
        aria-expanded="false|true"
        aria-controls="{disclosed-region-id}">
  <span class="aaron-disclosure__glyph" aria-hidden="true"></span>
  <span class="aaron-disclosure__label">{label}</span>
</button>
```

When `aria-expanded` flips, Aaron UI plays the animation (per scheme's animation cicns -10109 through -10105 if present). The animation is purely visual; `aria-expanded` flips synchronously.

---

## 6. Little arrows + spin arrows

K2 IDs: `-10048` to `-10045`. Up/down arrow pair used in number-field steppers + similar.

```html
<div class="aaron-arrows"
     data-aaron-arrows
     data-state="normal|disabled"
     role="group">
  <button class="aaron-arrows__up"
          data-state="normal|pressed|disabled"
          aria-label="Increment"></button>
  <button class="aaron-arrows__down"
          data-state="normal|pressed|disabled"
          aria-label="Decrement"></button>
</div>
```

Repeats fire while pressed (mouse held down) at ~10 Hz.

---

## 7. Tabs

K2 IDs: `-9984` (large) and `-9976` (small). Tab + tab-pane × selected/unselected × states.

### 7.1 DOM shape

```html
<div class="aaron-tabs aaron-tabs--{large|small}"
     data-aaron-tabs
     role="tablist"
     aria-label="{group label}">

  <div class="aaron-tabs__strip">
    <button class="aaron-tab aaron-tab--{large|small}"
            data-state="normal|pressed|disabled"
            role="tab"
            aria-selected="true|false"
            aria-controls="panel-{N}"
            id="tab-{N}">
      {label}
    </button>
    <!-- additional tabs -->
  </div>

  <div class="aaron-tabs__pane"
       data-state="normal|disabled"
       role="tabpanel"
       aria-labelledby="tab-{N}"
       id="panel-{N}">
    {panel content}
  </div>
</div>
```

### 7.2 Variants

| Variant | Class | K2 size |
|---|---|---|
| Large tabs | `aaron-tabs--large` | 21 px high |
| Small tabs | `aaron-tabs--small` | 16 px high |

### 7.3 Keyboard

- Left/Right arrows move focus within the tablist
- Enter / Space activates the focused tab
- `Home` / `End` jump to first / last

---

## 8. Scrollbars

K2 IDs: `-10208` (thumbs) + `-8288`–`-8273` (tracks). Large variant (16 px) + small variant (11 px).

### 8.1 DOM shape

```html
<div class="aaron-scrollbar aaron-scrollbar--{vertical|horizontal} aaron-scrollbar--{large|small}"
     data-aaron-scrollbar
     data-state="normal|pressed|disabled|empty"
     data-direction="vertical|horizontal"
     role="scrollbar"
     aria-orientation="vertical|horizontal"
     aria-valuenow="{0-100}"
     aria-valuemin="0"
     aria-valuemax="100"
     aria-controls="{scroll-content-id}">

  <button class="aaron-scrollbar__arrow aaron-scrollbar__arrow--{a|b}"
          data-state="normal|pressed|disabled"
          aria-label="Scroll up/left"></button>
  <!-- arrow b: at the other end OR adjacent depending on Colr settings -->

  <div class="aaron-scrollbar__track" data-state="normal|pressed|empty">
    <button class="aaron-scrollbar__thumb"
            data-state="normal|pressed"
            aria-label="Scroll position"></button>
  </div>

  <button class="aaron-scrollbar__arrow aaron-scrollbar__arrow--c"
          data-state="normal|pressed|disabled"
          aria-label="Scroll down/right"></button>
</div>
```

### 8.2 Variants by Colr settings

The scheme's `Colr` resource has flags:
- **Unified Scroll Bar Track** → track extends behind thumb (uses mask)
- **Windows-style Scrollbars** → both arrows at one end
- **Stretch Scroll Bar Thumb from Center** → thumb growth behavior

Aaron UI reads these flags from the loaded theme + emits `data-arrow-layout="split|paired|single"` etc. on the scrollbar root so CSS can position correctly.

### 8.3 Thumb states

K2 mentions ghost thumbs (drag preview). Render via:

```html
<div class="aaron-scrollbar__thumb-ghost" data-state="visible|hidden"></div>
```

Mounted alongside the live thumb; visible during drag.

---

## 9. Sliders

K2 IDs: `-10144` to `-10113`. Track + thumb + tick marks. 4 directional variants + non-directional × disabled/normal/pressed.

### 9.1 DOM shape

```html
<div class="aaron-slider aaron-slider--{horizontal|vertical}"
     data-aaron-slider
     data-state="normal|pressed|disabled"
     data-direction="up|down|left|right|none"
     role="slider"
     aria-orientation="horizontal|vertical"
     aria-valuenow="{N}"
     aria-valuemin="{N}"
     aria-valuemax="{N}">

  <div class="aaron-slider__track"
       data-state="normal|pressed|disabled"
       data-direction="up|down|left|right|none">
    <!-- Tick marks (optional, only for directional sliders) -->
    <span class="aaron-slider__tick" data-state="normal|disabled"
          aria-hidden="true" style="--tick-position: 25%"></span>
    <!-- ...more ticks... -->
  </div>

  <button class="aaron-slider__thumb"
          data-state="normal|pressed|disabled|ghost"
          aria-label="Slider value"></button>
</div>
```

### 9.2 Direction variants

| `data-direction` | Visual |
|---|---|
| `up` / `down` / `left` / `right` | Tick marks point in that direction off the track |
| `none` | Non-directional (no tick marks supported) |

### 9.3 Keyboard

- Arrow keys (axis-aware) change value by 1
- Page Up / Page Down change by 10
- Home / End jump to min / max

---

## 10. Progress bars

K2 IDs: `-10080`–`-10075`. Frame + fill + track × enabled/disabled. Plus barber-pole (indeterminate) via `ppat -10080` through `-10073`.

### 10.1 DOM shape

```html
<div class="aaron-progress"
     data-aaron-progress
     data-state="normal|disabled"
     data-mode="determinate|indeterminate"
     role="progressbar"
     aria-valuenow="{0-100}"
     aria-valuemin="0"
     aria-valuemax="100">

  <div class="aaron-progress__frame" data-state="normal|disabled" aria-hidden="true"></div>
  <div class="aaron-progress__track" data-state="normal|disabled" aria-hidden="true">
    <div class="aaron-progress__fill" data-state="normal|disabled"
         style="--progress: 0.42"></div>
  </div>
</div>
```

### 10.2 Indeterminate mode

When `data-mode="indeterminate"`, the fill is replaced by a tiled ppat that animates. Aaron UI cycles through the 8 ppat frames at ~125 ms intervals (per K2 timing).

```html
<div class="aaron-progress__fill aaron-progress__fill--indeterminate"
     data-state="normal" aria-hidden="true"
     data-frame="0|1|2|3|4|5|6|7">
</div>
```

---

## 11. Menubar + pull-down menus + free menus

K2 IDs: `-12240`–`-12225`. Menubar + pull-down + free menu × backgrounds + items + dividers + selected highlights.

### 11.1 Menubar

```html
<nav class="aaron-menubar"
     data-aaron-menubar
     role="menubar"
     aria-label="Main menu">

  <button class="aaron-menubar__item"
          data-state="normal|pressed|selected|disabled"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded="false|true">
    File
  </button>
  <!-- more items -->

  <!-- Application menu grip (Mac OS 8.5+) — separates application menu from clock area -->
  <div class="aaron-menubar__grip"
       data-state="normal|pressed|disabled"
       aria-hidden="true"></div>

  <div class="aaron-menubar__clock" aria-live="polite">
    {current time}
  </div>
</nav>
```

### 11.2 Pull-down menu

Opened from a menubar item. Positioned absolute below the trigger.

```html
<div class="aaron-menu aaron-menu--pull-down"
     data-aaron-menu
     data-state="open|closed"
     role="menu"
     aria-labelledby="menu-trigger-{N}">

  <button class="aaron-menu__item"
          data-state="normal|pressed|disabled|selected"
          role="menuitem"
          tabindex="-1">
    New
    <kbd class="aaron-menu__shortcut">⌘N</kbd>
  </button>

  <div class="aaron-menu__divider" aria-hidden="true"
       role="separator"></div>

  <!-- more items -->
</div>
```

### 11.3 Free menu

Same DOM as pull-down but `aaron-menu--free`. Used for context menus + popup menu dropdowns. Per K2, "Kaleidoscope sometimes draws a pull-down menu as a free menu," so the two should not be too distinct visually.

### 11.4 Solo menu

Standalone menu background (per Scheme Factory STR# 128: "Free Menu Background", "Selected Solo Menu Background"). Used for cases like the macOS classic "About" menu standalone.

### 11.5 Extended borders + transparent menus

Kaleidoscope 2.3+ supports extended menu borders with optional 8-bit alpha masks (cicn `-12228`, `-12226`) + transparency level (last 2 bytes of cinf).

```html
<div class="aaron-menu aaron-menu--pull-down"
     data-aaron-menu
     data-state="open"
     data-has-extended-border="true|false"
     data-alpha="0xFFFF">  <!-- 0x0000 = solid, 0xFFFF = fully transparent -->
  ...
</div>
```

Aaron UI reads these from cinf at theme load time, stamps as data attributes.

---

## 12. Popup menus

K2 IDs: `-8208`–`-8188`. Text-variant + arrow-only variant × small + large arrows × states.

### 12.1 DOM shape

```html
<div class="aaron-popup-menu"
     data-aaron-popup-menu
     data-state="normal|pressed|disabled"
     data-variant="text|arrow-only"
     role="combobox"
     aria-haspopup="listbox"
     aria-expanded="false|true">

  <!-- Text variant: text section + arrow section side-by-side -->
  <div class="aaron-popup-menu__text" data-state="normal|pressed|disabled">
    {selected option text}
  </div>
  <div class="aaron-popup-menu__arrow"
       data-state="normal|pressed|disabled"
       data-arrow-size="small|large"
       aria-hidden="true">
    <span class="aaron-popup-menu__arrow-glyph"
          data-state="normal|pressed|disabled"></span>
  </div>

  <!-- Hidden <select> preserved for form semantics + a11y -->
  <select hidden>...</select>

  <!-- Popup dropdown — rendered as aaron-menu--free when open -->
</div>
```

### 12.2 Variant: arrow-only

When the popup isn't wide enough to show text, K2 specifies the arrow-only variant. Aaron UI detects this via min-width threshold OR explicit `data-variant="arrow-only"` from the consumer.

```html
<div class="aaron-popup-menu aaron-popup-menu--arrow-only">
  <div class="aaron-popup-menu__arrow-only" data-state="normal|pressed|disabled">
    <span class="aaron-popup-menu__arrow-glyph"></span>
  </div>
</div>
```

---

## 13. Window headers (Finder)

K2 IDs: `-9568` (active) / `-9567` (inactive). Used at the top of Finder windows + other applications. "Simply stretched" per K2.

```html
<div class="aaron-window-header"
     data-aaron-window-header
     data-state="active|inactive">
  {column headers or content}
</div>
```

Often combined with `role="rowgroup"` for actual Finder-style list views, but the DOM shape itself is just a styled container.

---

## 14. Placards

K2 IDs: `-9792`–`-9790`. Embossed label slabs used by Appearance-savvy apps. "Simply stretched" per K2.

```html
<div class="aaron-placard"
     data-aaron-placard
     data-state="normal|pressed|disabled">
  {label text or controls}
</div>
```

---

## 15. Dialog + alert colors

K2 IDs: `-9776`–`-9773`. **NOT a rendered element** — color extraction only. Aaron UI extracts text + background colors + bg pattern from these cicn/cinf pairs and stamps them as CSS custom properties on `:root`:

```css
:root {
  --aaron-dialog-active-bg: #dddddd;
  --aaron-dialog-active-fg: #000000;
  --aaron-dialog-inactive-bg: #888888;
  --aaron-dialog-inactive-fg: #555555;
  --aaron-alert-active-bg: ...;
  --aaron-alert-active-fg: ...;
}
```

Modal dialog + alert windows reference these via their own CSS.

---

## 16. Finder window colors

K2 IDs: `-9552`–`-9548`. Color extraction only (like §15):
- Desktop icon label background + text
- Icon view background + text
- List view background + text
- List view sort-column background
- List view separator line color

Stamped as `--aaron-desktop-icon-bg`, `--aaron-list-view-bg`, etc.

---

## 17. Notification window (Mac OS 9)

K2 ID: `-9547`. Color extraction only. Yellow notification banners. Stamped as `--aaron-notification-bg`.

---

## 18. Cursors

K2 IDs: `crsr 0` (arrow) + `crsr -20488`/`-20487`/`-20486` (contextual / alias / copy). Mapped to CSS:

```css
:root {
  cursor: url("/themes/<slug>/cursors/arrow.png") 1 1, auto;
}
.aaron-cursor--contextual { cursor: url(...) 1 1, context-menu; }
.aaron-cursor--alias      { cursor: url(...) 1 1, alias; }
.aaron-cursor--copy       { cursor: url(...) 1 1, copy; }
```

Aaron UI doesn't emit `aaron-cursor--*` classes by default; consumers opt in for specific elements.

---

## 19. Animation hooks

Three families have animation requirements per K2:

| Family | Animation | Trigger |
|---|---|---|
| Disclosure triangle | 5-frame transitions (right↔down, left↔down) at 1/20s intervals | `aria-expanded` flip |
| Indeterminate progress bar | 8 ppat frames at ~125ms; OR single ppat shifted 4px/frame | Mounted with `data-mode="indeterminate"` |
| Menus | Open + close transitions per Colr settings (Spinning Zoom Rects) | `data-state="open"` change |

Aaron UI emits `data-frame="0..N"` attributes that swap based on animation tick. CSS keys off `data-frame` if author wants visible animation; defaults to no animation for `prefers-reduced-motion`.

---

## 20. Scheme global settings (Colr)

The scheme's `Colr` resource holds flags that affect rendering across families. Aaron UI reads these once at theme load + stamps as data attributes on `<html>` or `.aaron-window` root:

| Flag | DOM attribute | Affects |
|---|---|---|
| `unifiedScrollbarTrack` | `data-aaron-scrollbar-style="unified"` | §8 scrollbar variant |
| `windowsStyleScrollbars` | `data-aaron-scrollbar-layout="paired"` | §8 arrow positioning |
| `stretchScrollbarThumbFromCenter` | `data-aaron-thumb-stretch="center"` | §8 thumb growth behavior |
| `menuHighlightOverlay` | `data-aaron-menu-overlay="true"` | §11.2 selected item rendering |
| `extendedScrollbarArrows` | `data-aaron-scrollbar-arrows="extended"` | §8 arrow shape |

CSS keys off these for cross-family scheme-level behavior.

---

## 21. Declarative scanner conventions

Aaron UI's runtime includes a DOM scanner that promotes consumer-authored markup into themed instances. The promotion is governed by a sentinel:

```
<{tag} data-aaron-{family} ...>
```

The scanner uses `MutationObserver` to handle dynamic content. Once promoted, the sentinel attribute `data-aaron-promoted` prevents re-scan.

### 21.1 Promotion rules per family

| Sentinel | Native element preferred | Notes |
|---|---|---|
| `data-aaron-window` | `<div>` | Becomes `.aaron-window` with full chrome |
| `data-aaron-button` | `<button>` | Form-submit semantics preserved |
| `data-aaron-button-default` | `<button>` | Same + default-ring overlay |
| `data-aaron-button-bevel` | `<button>` | + size/value attributes |
| `data-aaron-checkbox` | `<input type="checkbox">` | Wrap in `<label>` |
| `data-aaron-radio` | `<input type="radio">` | Wrap in `<label>`; group via `name` |
| `data-aaron-disclosure` | `<button>` | + `aria-expanded` toggling |
| `data-aaron-arrows` | `<div>` | Wraps two `<button>`s |
| `data-aaron-tabs` | `<div>` | + `role="tablist"` structure |
| `data-aaron-scrollbar` | `<div>` | + `role="scrollbar"` |
| `data-aaron-slider` | `<input type="range">` | Preferred; wrap with chrome divs |
| `data-aaron-progress` | `<progress>` | Preferred; wrap with chrome divs |
| `data-aaron-menubar` | `<nav>` | + role + items |
| `data-aaron-menu` | `<div>` | Created at runtime by popup-menu / context-menu opens |
| `data-aaron-popup-menu` | `<select>` | Preferred; wrap with text/arrow chrome divs |
| `data-aaron-window-header` | `<div>` | + `data-state` |
| `data-aaron-placard` | `<div>` | + `data-state` |

### 21.2 Promotion side effects

For each promotion, the scanner:
1. Adds `class="aaron-{family}"` + variant classes
2. Sets initial `data-state="normal"` (or per attributes)
3. Wraps native form elements as needed (preserving them inside)
4. Attaches the state-machine listeners (per §1.4)
5. Adds `data-aaron-promoted` sentinel

### 21.3 Programmatic API parity

Each `new AaronXxx(opts)` produces DOM equivalent to a declared `data-aaron-{family}` element. Either path leads to identical themed output.

---

## 22. What this spec does NOT define

- **How scheme rasters fill this DOM** — that's the raster-mapping spec (§B, TBD)
- **How the JS runtime composes** — that's the composer spec (§C, TBD)
- **CSS layout details** — only the DOM shape + state attributes; CSS keys off them but its exact rules belong in the per-family theme stylesheets
- **Internationalization / RTL** — Phase 6 polish
- **Touch / mobile pointer refinements** — Pointer Events handles the basics; further refinement is Phase 6

---

## 23. Conformance levels

A runtime implementing this spec can claim partial support honestly:

- **Level 1 — Window chrome only** (§2). Document, modal, alert, utility, popup window types + their states.
- **Level 2 — Standard controls** (§3–§10). Buttons, checkboxes/radios, disclosure, arrows, tabs, scrollbars, sliders, progress bars.
- **Level 3 — Full HIG** (§11–§16). Menus, popup menus, window headers, placards, all color-extraction families.
- **Level 4 — Interaction** Hit-test wiring (§2.4) + scheme-flag respect (§20) + animation (§19).
- **Level 5 — Reference parity** Visually validated against real Kaleidoscope in UTM across the full corpus.

Aaron UI today is at **Level 1** for the runtime + **partial Level 2** (Phase 3 CSS-drawn buttons/checkboxes/radios/text fields exist but are not cicn-driven).

---

## 24. References

- K2 Scheme Reference (Kaleidoscope 2.3.1 installer) — sections §Windows, §Buttons, §Menus, §Sliders, §Progress, §Scrollbars, §Popup Menus, §Tabs, §Placards
- Scheme Factory 1.0PR2 binary — `STR# 128` (127-entry vocabulary), `MENU 139` (15 resize behaviors)
- Apple Inside Macintosh: Macintosh Toolbox Essentials — Window Manager + Control Manager chapters
- ARIA Authoring Practices (W3C) — `role` + state attribute conventions
- `docs/aaron-ui-architecture-spec.md` §6 — Canonical resource ID conventions
- `docs/tracking/kdef-disassembly.md` — open questions for future runtime refinements
