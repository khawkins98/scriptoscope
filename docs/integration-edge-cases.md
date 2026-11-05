# Integration edge cases

Use this guide when a promoted page has unexpected layout, styling or lifecycle
behavior. Start with the [npm tutorial](./npm-consumer.md) or
[hosted starter](../README.md#five-minute-setup); use the
[hosted reference](./hosted-reference.md) for markup/options and
[interaction reference](./interaction.md) for gestures, keyboard and events.

## Mobile + responsive

Choose a responsive layout or skip promotion below your breakpoint. Use shrinking
grid tracks (`minmax(0, 1fr)`, `min-width: 0`), allow for cascade offsets, and test
your themes at the narrowest supported width. Fixed-art chrome has a minimum
useful width; the runtime does not automatically shrink oversized windows.

For width changes, serialize teardown and remount so an older asynchronous mount
cannot attach after a newer layout. The demo's
[responsive host](../demo/example-responsive.mjs) is a worked implementation.
Disconnect before replacing the root; do not leave a pending mount unowned.

<a id="️-the-css-only-fallback-is-a-footgun-use-the-js-conditional-mount-above"></a>

### Restore native HTML at breakpoints

Hiding a promoted host also hides the live content inside it. Hiding only its
canvas leaves invisible interactive overlays. To show native HTML at a narrow
breakpoint, disconnect the host and restore the original nodes. Keep layout
changes outside the promotion transaction rather than maintaining a duplicate
mobile DOM tree.

## Content Security Policy

Account for these resources in your site's policy:

| Resource | Policy consideration |
|---|---|
| `.sit` decoding | WebAssembly needs `script-src 'wasm-unsafe-eval'` under strict CSP. |
| Decoded images | Allow `blob:` in image/connect sources. |
| Picker previews | Allow `data:` images. |
| Hosted modules, themes and stylesheet | Allow their origin in the corresponding script, connect, image and style sources. |
| Inline module in a starter | Authorize it with your site's nonce/hash, or move it into an allowed external module. |

The runtime also writes element style properties. Check your full stylesheet and
policy in target browsers; a source list alone is not a complete deployment CSP.
If WASM is forbidden, host an actual raw `scheme.rsrc` archive and select it with
`{ source: 'scheme.rsrc' }`. This path skips the StuffIt decoder. A source hint
does not convert a `.sit` into `.rsrc`, and bundles may supply only one format.

## Controlling which widgets do something: `data-scriptoscope-widgets`

Omit the attribute to wire the widgets supported by the window type. Set
`data-scriptoscope-widgets="zoom,collapse"` to leave close painted but inert, or
`data-scriptoscope-widgets=""` to wire none. Do not choose a different window
type just to disable close. [Widget behavior](./interaction.md#4-title-bar-widgets)
explains actions, focus and the close event.

## Cascade layout: `data-scriptoscope-cascade`

The example host places descendant windows at successive offsets once at mount.
Defaults are 32 px right and 28 px down; `-step-x`, `-step-y`, `-base-x` and
`-base-y` configure them. Explicit per-window `-x` or `-y` wins. Nested cascade
containers act independently. The helper reserves vertical space with
`min-height` and sets every cascade container's inline `position` to `relative`
while mounted, overriding fixed or absolute positioning from inline styles or
classes. Use a separate outer wrapper when the cascade needs fixed or absolute
page placement. It does not continually reposition windows after user moves.
See the [markup table](./hosted-reference.md#the-full-data-scriptoscope--vocabulary).

<a id="how-positioning-works-posture-b-2026-05-31"></a>

## Position and size the window

Without `data-scriptoscope-x`/`-y`, the promoted host occupies the source's normal
flow position. Either coordinate opts into absolute placement against its
containing block. Coordinates are CSS pixels, not percentages or relative units.
The runtime maps pointer input through transformed ancestors; transforms do not
in themselves make dragging unsupported.

Preparation leaves the original content connected until it can commit the host
and move the same child nodes synchronously. Failed preparation restores the
source and clears its stamp for an explicit retry. Removal or reparenting during
preparation cancels it; the runtime does not pull the source back. Final frame
size can still change layout.

The first real drag, keyboard move or grow-box resize converts an in-flow host
to absolute placement and leaves a hidden placeholder in its original slot.
The placeholder lasts until removal. A host already positioned absolute or fixed
needs no placeholder. See [moving](./interaction.md#2-moving).

## Auto-resize: content growing after promote

Auto-captured dimensions are **outer bounds**, including chrome. A retheme fits
the new frame inside those bounds, so content reflows. Declared
`data-scriptoscope-width`/`-height` are **content** sizes; the frame is added
outside. `extra-width`/`extra-height` enlarge auto-captured bounds and are ignored
on a declared axis.

A shared content `ResizeObserver` watches undeclared axes. Auto-fit grows past
its baseline and does not shrink below it. A user grow-box resize stops auto-fit
for that window; subsequent overflow follows the window's scrolling policy.
Programmatic sizing and zoom do not emit `scriptoscope:userresize`.

CSS `max-width`/`max-height` caps expressed in px bound the whole window from its
first committed size. Other units are ignored by this cap parser; convert a
viewport-relative cap to px yourself when the viewport changes. Source inline
styles are not carried to the new host, so use a class rule. Reserve expected
async growth with `extra-*` to avoid a visible refit and its growth warning.

## Class inheritance and the locked-down properties

The host copies the source's id, classes, ARIA attributes, ordinary data
attributes, `lang`, `dir` and `title`. Its inline layout rules protect correspondence
between the outer box and chrome:

| Properties | Managed value |
|---|---|
| `display`, `box-sizing` | `block`, `border-box` |
| `padding`, `border`, `margin` | zero |
| `background`, `overflow` | transparent, visible |
| `transform`, `filter`, `contain`, `clip-path` | none |
| `pointer-events` in region mode | none on the host; native targets take input inside the region |

Font, color, custom properties, class-based positioning and px max-size caps can
still apply. Put grid/flex layout and padding on your content rather than the
managed outer host. After user movement/resizing, the runtime owns its inline
position and dimensions. The native slot scrollbar is hidden when a themed bar
provides scrolling; deliberately exposing a native scrollbar can produce two bars.

## Common pitfall — don't change child layout after mount-class flips

Source measurement happens before promotion. Keep ready/loading classes visual:
do not switch content `display`, grid tracks, padding, margins or sizing as the
mount completes. Those changes invalidate the dimensions you just measured.
For layout that must change, disconnect, apply the layout, then mount again.

## Shadow DOM — what's reachable from your CSS, what isn't

Canvas, chrome controls and wrappers live in an open shadow root. Page selectors
such as `canvas` or `.scriptoscope-window` do not reach them. Content remains
light DOM and your ordinary content styles apply. The host itself is selectable
with `[data-scriptoscope-window-host]`, but its managed properties above take
precedence. Use the exposed `::part(window)` and
`--scriptoscope-window-shadow` for optional shell shadows; setting `filter` on the
host is not a supported workaround. The [page guide](./decorate-a-page.md#style-the-window-shell-and-dialog-body)
covers dialog colors and shell variables.

<a id="promotion-is-destructive--your-original-element-is-moved--removed"></a>

## Keep ownership of the wrapper and its children clear

Window promotion replaces the wrapper and moves its live children. References
and listeners on the detached wrapper no longer address the live window;
listeners and values on its child nodes survive. Listen for host events on a
stable ancestor. Restore the source before allowing a framework to reconcile or
replace the wrapper.

### Theme ownership on teardown

`handle.disconnect()` aborts pending work and restores windows, buttons, controls,
fields and tabs before releasing internally loaded themes. It rolls back only
still-owned changes, retaining later application edits and native values.
Registered themes/base chains are borrowed; their owner disposes them after the
last dependent disconnects. See [ownership and completion](./hosted-reference.md#ownership-and-completion)
for latest-request ordering, failed replacement and direct-host responsibilities.

For programmatic input changes, follow the native control's
[refresh contract](./interaction.md#6-controls). In particular, assign a range's
value and dispatch `input` or `change` to repaint immediately. Retheme or later
interaction also samples it. Button disabled/default state is sampled during
promotion and retheme; there is no live button-attribute observer.

## Known incompatibilities

- Test content-box resets and content padding against the measured outer bounds.
  The host's managed border-box rules do not normalize arbitrary child layout.
- A transformed ancestor can establish a different containing block. Check the
  intended absolute-position anchor before changing pointer math.
- Page-scroll locks and fixed content can change positioning and input behavior.
  Test opening a modal during a move and the scroll ownership you intend.
- In region mode, fixed/escaped children are clipped to the frame. Put menus and
  tooltips in the top layer (`popover`, native dialog/select), outside the window,
  or choose box hit mode.
- Form controls are native elements in light DOM: broad input/button resets can
  affect them. The chrome's shadow root does not isolate all consumer controls.

## Internal stamps — don't set these yourself

SSR should emit authored markup, not runtime markers. Promotion guards and
reported state include `data-scriptoscope-promoted`, `-window-host`,
`-tabs-promoted`, `-field-promoted`, `-icon-promoted`, `-theme-picker-promoted`,
`-switcher-wired`, `-current-state`, `-hit-effective`, `-placeholder` and
`-modal-open` (all with the `data-scriptoscope` prefix). A host's `-theme` also
reports its painted theme; on source markup this attribute is an authored override.
`SCRIPTOSCOPE_PROMOTED_ATTR` is the exported constant for the main guard.

## Dynamically inserted declarative targets

There is no discovery/retry service. For later native buttons/controls use
`await handle.attach({ buttons: [...], controls: [...] })`; detach before moving,
removing or replacing them. Disconnect before replacing the root. Newly added
window/field/tab sources require your own explicit host or a fresh selection
and mount. See the [handle reference](./hosted-reference.md#explicit-page-host-options).

## Framework integration notes

Mount after the framework creates the DOM (React effect, Vue `onMounted`, Svelte
`onMount`). Keep ownership of the promoted wrapper outside ordinary reconciliation;
framework content can remain inside it if its ownership is compatible with the
move. On cleanup, cancel your mount attempt and disconnect even if the mount
promise resolves late. Handle mount rejection rather than leaving a rejected
promise unobserved. Exercise React development remounts and rapid route changes.

Static-rendered HTML can be promoted on the client; that is not server-side canvas
rendering. For modals, pass an explicit `returnFocusTo` when opening from a pointer
trigger and use the [modal contract](./interaction.md#7-modals).

<a id="owned-theme-inputs-during-the-transport-migration"></a>

## Display images from owned themes

Owned loaders return `OwnedTheme`; its source fields are resource references,
not ready image URLs. Use `themeImageUrl(theme, ref)` or `theme.imageUrl(ref)`
for an image/CSS consumer. Do not pass `theme.source` where a ready-image
`LoadedTheme` is expected. Composition and promotion accept owned theme inputs.

A child borrows its base; disposing the child does not dispose the base. Release
only after dependent windows/faces finish, and treat borrowed pixel arrays as
immutable. See [owned API](./v2/owned-theme-api.md) for the full lifecycle boundary.
