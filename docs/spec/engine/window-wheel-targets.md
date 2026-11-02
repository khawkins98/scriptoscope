# Managed-window native wheel and pointer targets

This is a modern web-host policy for managed windows. It changes neither the
prepared structure region nor the original window/control action rules. It
defines the behavior required when replacing the region hit layer's blocking
wheel-routing workaround with native target surfaces. Removing that workaround
requires the complete contract below in Chromium, Firefox and WebKit; support
for a CSS property or a DOM hit-test result alone is insufficient.

## Region and coordinates

`S` is the structure region prepared for the current committed recipe window.
It includes the solid content rectangle `C` and the masked contributions of the
placed frame cells, using the same committed template, state, layout and
tile/scale placement as the chrome. Holes and disconnected runs retain their
exact membership. A collapsed window uses its committed collapsed region and
empty content rectangle. Built-in frames, modal exemptions and failed region
preparations retain their existing effective `box` behavior.

The region's origin is the chrome canvas's origin, at the padding-box origin
of the window element. Region pixel `(x, y)` covers the local CSS rectangle
`[x*k, y*k, (x+1)*k, (y+1)*k]`, where `k` is the integer display scale. The
content rectangle and every private target use that same local coordinate
model. Device pixel ratio is not multiplied into these coordinates. Browser
zoom and ancestor transforms act on the window and targets together; they do
not cause viewport-coordinate region preparation.

Membership is exact at integer device alignment. Existing edge tolerance at
fractional host positions, fractional scaling, rotation or skew remains at
most one device pixel along a region edge. This does not authorize eroding,
dilating or substituting a bounding box for `S`.

## Paint clip and native hit surfaces

The window element remains the unclipped first element of the host's shadow
root, retaining its public part, role, label, shell shadow and gesture-capture
identity. Its persistent inner hit layer fills its box without border,
padding or margin. The inner layer retains one `clip-path: path("…")` whose
filled set is exactly `S` at rest. Unclipped decoration remains outside that
layer and pointer-transparent, including focus indicators and resize outlines.

In effective `region` mode, the host, window element, inner layer and chrome
paint surfaces are pointer-transparent. The content viewport explicitly
restores native pointer participation, preserving consumer pointer policy
within its subtree. Nonfocusable private native targets cover the frame's
interactive area exactly within `S`. These targets receive real browser input
and remain descendants of the window element, so frame handlers retain their
normal event ancestry.

An original chrome control may be pointer-transparent while nonfocusable
native target children inside it cover the intersection of its existing hit
box with `S`. The union must preserve all applicable region runs and holes.
The original control's mask and action rules still decide whether an input
acts on that control or follows its existing frame behavior. A target must
not create a widget action at a mask-clear point, permit a widget action
outside `S`, or change control/frame priority inside `S`. No target rectangle
may be enlarged merely to reduce the target count.

The paint canvas, content viewport, controls and their focusable original
elements stay in their existing persistent inner layer. Native targets must
not duplicate, reparent or replace consumer content or original controls.
They introduce no tab stops, semantic controls, accessible names or competing
focus rings. Pointer activation, keyboard activation and focus indication
remain owned by the original controls.

## Original-control pointer coordinates

Changing the native event target to a private child must not change the point
used by an original control's hit-mask check or action. Every pointer-driven
decision uses the equivalent point in the original control/window coordinate
model, including the display scale and ancestor transforms. A child-local
event offset is not an original-control offset when the child has a different
origin. Nonzero child origins and mask holes must therefore retain the same
accepted/rejected presses and actions as the original control at the same
point.

This applies to press, movement, release, click and double-click behavior,
including pressed art, title-widget masks, grow interactions and scrollbar
actions. Native child ancestry must preserve activation/focus ordering and
pointer-capture behavior. Keyboard and assistive-technology activation keep
their existing coordinate-independent action rules. No synthetic event
redispatch or manual forwarding may substitute for trusted native input.

## Native wheel ownership and overflowing content

At an excluded frame pixel, trusted native wheel input reaches the element
beneath, including page content or another window. A scrollable underlying
element scrolls under its normal native rules; the covered window's content
does not consume that input. Inside the window, native content and nested
scrollers retain their normal ownership, chaining and boundary behavior.
Wheel input on a solid frame follows its normal native ancestor/page behavior.
Page input outside the window remains page input.

The existing themed outer scrollbar policy is preserved. Its wheel handling
may consume input, call `preventDefault` and apply its defined scroll amount;
the native-content and nested-scroller guarantees above apply where that
existing control policy does not intercept the input. Native target children
introduce no new control priority or change to that policy. The routing
replacement itself adds no event cancellation or manual scrolling.

Away from boundaries, an initial wheel input must move its intended scroll
owner in the input direction while unintended owners remain unchanged.
Continued input over a valid target must produce further intended movement.
Native displacement may depend on the browser's wheel policy and viewport;
this contract does not require an identical number of pixels per wheel delta
across engines. The routing replacement must not fabricate scroll positions,
select behavior by user-agent text or forward synthetic wheel events.

The inner clip continues to constrain all of its ordinary descendants to `S`,
including fixed-position content or descendants whose containing block lies
outside the content viewport. Their existing content-overflow behavior is
otherwise unchanged. They must not be tightened to `C` as a routing shortcut.
Escaped content must not cause native wheels at another excluded frame point
to be consumed by the window or routed to the wrong scroll owner. Top-layer
content retains its existing escape from the clip and its native behavior.

Hover, cursor, touch/default gestures, press and click pass through excluded
pixels as before. Outside-press deactivation follows the requested hit mode
and existing modal/closed-shadow/touch-tap exceptions; native target children
do not change the host's event ancestry used for that classification.

## Commits, modes, gestures and lifetime

The clip and target geometry belong to the same prepared region and chrome
commit. They are installed synchronously with that commit; pending or stale
asynchronous preparations cannot mix old target geometry with new pixels.
Target preparation uses local committed geometry and may reuse unchanged
inputs under the existing region reuse rules. A relevant template, state,
layout, size, collapse or display-scale change invalidates affected geometry.

Pointer moves, hover, dragging, resize outlines, scrolling, z-order-only
changes and mode-only switches do not rebuild the structure region. There is
no size-based fallback to `box`. Mode-only changes use the saved committed
region and prepared target geometry synchronously. Preparation failure keeps
the existing retryable effective-`box` behavior; empty or stale targets must
not leave a committed window inaccessible.

In effective `box` mode, disable the region-only target surfaces and restore
the existing pointer behavior without a clip, content reparenting or a chrome
commit. Switching back to `region` restores the last valid committed region
and its native target surfaces. Requested-mode inheritance, built-in-frame
exemptions and modal transitions retain their existing meanings. The host's
clip remains locked to `none`; its region-mode pointer transparency remains
locked, and `box` restores the existing consumer pointer policy.

The inner layer, decoration layer, pooled canvas, content viewport and every
original control present in both states retain their existing identity and
focus across commits and mode changes. The existing collapse exception for
the grow control remains. Private nonfocusable targets may be reconciled
without replacing those original elements, disturbing tab order, losing a
pending keyboard action or adding event listeners on every move.

Captured pointer frame drags and grow resizes retain the existing clip
suspension: suspend the inner clip during capture, restore the latest
committed region when the gesture ends, and preserve gesture ownership across
intervening commits. Pass-through wheel/hover at excluded pixels is not
required during that suspension. Keyboard move/resize does not suspend the
clip. A newer drag's suspension must survive an older resize preparation's
commit until the newer gesture ends.

Removal and manager disposal release private targets and their listeners
with the existing window lifetime. They leave no native hit surface over the
page, release capture and pending work, and prevent stale preparation or
gesture continuation from reviving removed windows. Reusing a manager for a
new window starts a new lifetime and does not revive old targets.

## Performance boundary

The WebKit limits remain unchanged: median hit-test batch cost at most 3 ms,
and hover/drag frame p95 at most the same-run `box` baseline plus 3 ms. Retain
the existing five alternating box/region trials, individual observations,
runner/browser identity and release-cost reporting. Chromium and Firefox
remain report-only for this performance budget. New native targets receive
no exemption from these limits, and a slow or failed run is not a reason to
raise the ceilings or discard samples. Idle callbacks or DOM event timing
do not establish compositor presentation latency under contention.
