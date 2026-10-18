# Managed button composition context

The #270 browser adapter connects the direct [body/context model](control-pattern-context.md)
to actual `WindowManager` content viewports and interactive push buttons. This is
an explicit browser integration policy, not an observation of an original GrafPort.
Bevels retain their direct caller-supplied context; tabs, list headers, checkables,
sliders and closed selects are not automatically bound by this adapter.

## Public ownership

`manager.contentPort(host)` returns that manager's read-only port or `null`.
A port exposes `id`, `displayScale`, `disposed`, measurement/subscription and
`refresh()`. Only the manager can commit its viewport authority. The identity is
a browser lifetime, not a theme/resource owner or historical port address.

`bindButtonToContentPort(button, port, { scale: 'managed' })` binds an already
prepared `interactiveButton`. The returned binding has `state`, asynchronous
`refresh()` and asynchronous `dispose()`. Binding rejects a native baseline
fallback with no themed canvas. `{ scale: 'preserve' }` retains caller CSS size;
if its units differ from the port, the result is explicitly unsupported.

The default managed policy adopts only the canvas CSS width/height at the
window's committed integer scale. It leaves slotted HTML and native siblings
alone. Thus an independently prepared1x button deliberately becomes2x when
bound to a2x window. Unbind restores only values and priorities still matching
its own writes; later consumer edits survive. Explicit caller context updates
through `setButtonCompositionContext(button, context)` detach the provider before
preparation. Invalid declarations reject without detaching. An old binding's
disposer cannot detach a replacement. Await disposal before releasing a borrowed
theme; the compatibility restoration can still need its assets.

The scanner automatically binds its own promoted push buttons inside windows
owned by that same mount. It uses the existing scoped child-list observer to
follow moves between those windows and enroll existing faces after window
promotion. It does not infer authority from a foreign manager's DOM marker.
Standalone declarations and controls in a foreign imperative window require
explicit binding; ordinary HTML is untouched. The current declarative window
API has no scale attribute, so this automatic path is1x. Explicit imperative
binding covers1x/2x windows. A caller context override or explicit binding opts
that face out of later automatic enrollment. Retheme creates a new owned face.

## Coordinate policy and unsupported mappings

The logical content viewport has O=(0,0). D is the actual canvas raster origin
relative to that committed viewport, divided by their common uniform effective
scale, plus the compositor's actual `faceRect` inset. The default ring contributes
only through this layout result; no second resource lookup guesses its size.
The clip is the committed visible viewport rectangle in the same logical units.
Pattern-origin state remains unknown, with the direct compositor's documented
zero-offset compatibility substitution. Scrolling moves D relative to this fixed
viewport, rather than inventing a historical SetOrigin operation.

Whole-window translation cancels, including shared fractional CSS translation.
DPR is transport resolution, not another logical scale. Rotation, nonuniform
transforms, canvas padding/borders, mismatched units, fractional logical
coordinates, out-of-range coordinates and unequal normal/pressed state layouts
report explicit unsupported reasons. Unsupported measurements request an explicit
compatibility-default context, not the last valid managed D. Normal/pressed
natural layout mismatch remains unsupported until both states can be mapped
separately; the direct API still works with its prior local context.

## Pending state, failure and lifetime

`binding.state.measurement` describes the requested browser mapping. It is NOT
proof that those pixels have committed. `committedContext` describes the actual
paired buffers; `pending` and `error` distinguish preparation from completion.
A ready measurement can coexist with the previous committed context during an
await. State snapshots and nested context values are frozen.

Normal and pressed buffers prepare from one context snapshot, then commit as a
pair under one epoch. The existing visible canvas, focus, event forwarding and
current pressed state survive that commit. A superseded decode cannot commit
old context or start the next owned dependency. A current error preserves the
last committed pair and is exposed through state/explicit refresh rejection.
Explicit refresh retries a failed mapping; unchanged healthy mappings do not
recompose. This is button-pair atomicity, not a whole-window or desktop pixel
transaction. Window chrome and control preparation can complete separately.

`binding.dispose()` synchronously unsubscribes and invalidates managed work, then
restores the pre-binding context asynchronously. `WindowManager.remove()`
terminally disposes the port, notifies subscribers once, restores still-owned
scale styles and requests compatibility repaint under the button lifetime.
`disposed` can therefore be true while the requested reset remains pending.
It does not dispose caller-owned interaction listeners or borrowed themes.
Reinserting the old host cannot revive its removed port. Scanner disconnect
first disposes its own button interaction/pending paints, then removes windows
and releases owned theme resources.

## Finite tracking and evidence

One shared RAF tracker per browsing context iterates only bound canvases and
caches each managed viewport measurement once per pass. Signatures contain
logical D, clip, scale and validity, not raw screen position. Hidden, detached
or outside-port bindings invalidate once and become dormant; a single shared
mutation observer/resize listener can wake them. Disposal removes subscriptions
and cancels RAF/observer work when the set becomes empty. No per-control document
observer or per-frame descendant scan is used.

The source/built browser tests use an asymmetric5x3 synthetic tile with literal
RGBA expectations, actual source Crayon ppat samples, and real window/control
paths. At D=(55,65), Crayon's q=(8,8) must sample ppat17 at(63,9), yielding
RGB(248,248,221) under the declared display transform. The pre-adapter source and
bundle instead yielded local-D0 RGB(235,228,207); both fixed paths use the expected
source sample. This establishes source/context arithmetic, not original-device
palette, Resource Manager ownership or historical port state.

With12/100 bound controls under eight wrapper ancestors,20 idle frames produce
20 viewport reads and240/2000 canvas reads, with zero compositions. Ten translated
window frames also produce zero compositions; one logical move produces exactly
two state compositions, and disposal leaves zero reads/compositions. Earlier
local unthrottled Chromium geometry probes measured4.3–6.4ms total for12 controls
and27.2ms for100 controls over20 frames (1.36ms/frame for100); those are bounded
local measurement observations, not field-performance guarantees. Tests also
cover held real decode, terminal removal, reconnect, unsupported geometry,
caller opt-out, consumer styles, retheme and native/focus preservation.

Original port/scroll/offset behavior, arbitrary clipping regions, mode5 bodies,
low-depth device color and independent reference captures remain outside these
claims. The parent fidelity work remains incomplete.
