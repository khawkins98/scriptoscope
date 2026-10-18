# Managed control context — integration design in progress

This document describes the unshipped #270 browser adapter prototype. It is not
an original-port observation or a complete public API. The direct compositor
context and face-layout seam come from the separate C implementation. This
branch must be rebased onto that reviewed implementation before a delivery PR.

## Coordinate authority

A WindowManager-owned controller stores the viewport and integer display scale
only when window chrome commits. Its consumer-facing port will expose measurement
and refresh/subscription, not the controller's commit operation or mutable window
entry. A runtime port ID identifies that browser coordinate authority; it does
not identify a theme resource owner or historical GrafPort.

The logical content viewport has O=(0,0). The face origin is the actual canvas
raster origin relative to that viewport, divided by their common effective
uniform scale, plus the compositor's faceRect offset. Default-ring reservation
therefore contributes only through the actual layout result. The rectangular
clip is the committed visible content viewport in those same units. Pattern
origin remains explicitly unknown, with C's documented compatibility default.
Scrolling moves D relative to this fixed viewport; this is browser adapter
policy, not evidence of historical SetOrigin behavior.

Whole-window translation cancels, including fractional CSS translation shared
by canvas and viewport. DPR is not another logical scale. Rotation, nonuniform
transforms, incompatible canvas/port units, unsupported raster boxes, fractional
logical coordinates and out-of-range coordinates return explicit reasons. An
unsupported binding resets to compatibility-default context rather than keeping
a stale managed D. The diagnostic must preserve that distinction.

## Scale adoption and ownership

Unbound imperative controls keep their independent default scale1 or explicit
caller scale. Explicit binding may adopt the committed managed display scale.
Scanner-owned promoted buttons inside scanner-managed windows will use that
policy automatically. Ordinary slotted HTML/native controls and standalone
promoted buttons remain untouched.

This intentionally makes declared buttons in a scale2 window twice their former
scale1 display size. Review the real sibling layout, wrapping, scroll and overflow
at scale2; do not describe this integration as pixel/geometry unchanged. Adoption
owns only the canvas styles it writes. Unbind restores a previous value only
while the current property still equals the owned value, preserving later consumer
edits. A direct caller context override atomically detaches the provider. An old
binding's disposer cannot detach a replacement binding.

## Refresh and lifetime

The standalone prototype has one shared frame tracker per browsing context. It
measures each committed viewport once per pass and iterates a finite set of bound
canvases. Context signatures contain logical D, clip, scale and validity, not raw
screen position. A position-only sibling reflow is observable; unchanged logical
context does not request a repaint. When all bindings detach, a single document
mutation observer wakes tracking on reconnection. No per-control document
observers or descendant scans are used. Explicit refresh supports imperative
clients. Unbind/disconnect cancels owned work. Hidden/collapsed ports invalidate once and then become dormant; attribute
changes, reconnect and viewport resize can wake the shared pass.

Interactive integration must stage matching normal and pressed states from one
context snapshot. An epoch/lifetime guard commits the pair atomically, selects
the currently active interaction state, and preserves the existing canvas,
focus/listeners and native forwarding. Superseded decode completions cannot
publish stale context or start a later owned asset request. This behavior is not
yet implemented by the standalone measurement prototype.

## Prototype evidence and remaining delivery checks

An actual Crayon control with faceRect(4,4,80,20) at logical wrapper(20,30)
measures D=(24,34) in matching scale1 and scale2 windows. A scale1 canvas inside
a scale2 port returns scale-mismatch. Whole-window moves and shared fractional
translation preserve D; a logical3px control move changes only D.x by3. Rotation
and canvas borders are explicitly unsupported.

With 12 bound controls, 20 idle frames produced 20 viewport reads, 240 control
measurements and zero context-change notifications. Ten translated-window frames
also produced zero changes; a position-only movement produced one. Detach
invalidated each binding once then stopped, reconnect resumed, and final disposal
left zero measurement work. The local unthrottled Chromium run spent 4.3–6.4 ms total
inside measurement over 20 idle frames. These are finite prototype observations,
not field performance or actual repaint counts. A second Chromium probe with
100 controls, each under eight additional ancestors, measured 27.2 ms over
20 idle frames (1.36 ms/frame); shared viewport reads remained one per frame.

Delivery still requires source/built literal pattern-pixel checks through real
imperative and declarative windows; normal/pressed/default state pairing;
scroll/negative D; scale1/2 and DPR1/2; held decode, retheme and teardown; consumer
style/context overrides; and measured refresh/recomposition counts after the
interactive integration. No final API or fidelity claim follows from this
prototype alone.
