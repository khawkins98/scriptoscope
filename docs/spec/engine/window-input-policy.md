# Window input follow-up policy

Modern browser integration policy for #619 and #628. These rules do not claim
original-engine fidelity and introduce no theme or browser exceptions.

## Content focus (#619)

The runtime-created content viewport and declarative scroll wrapper are not
sequential keyboard stops. Themed scroll bars supply keyboard scrolling, so an
extra anonymous viewport stop adds no keyboard operation. Tab and Shift+Tab must
skip these wrappers both before and after layout/style rebuilds, activation,
collapse/expand and retheme, in every supported engine. Focusable descendants
remain in document order; chrome controls retain their documented order.

Excluding wrappers from sequential navigation must preserve programmatic focus
and native click focus. Clicking a content control focuses that control, activates
and raises its window, and delivers its action once (#550). Do not prevent the
content's native pointer default or redirect focus to chrome. Consumer-supplied
content with an explicit tabindex retains that tabindex and its intended stop;
this policy controls runtime-owned anonymous wrappers and browser-inferred stops,
not explicit application keyboard navigation.

## Widget gesture lifetime (#628 L1)

A pointer gesture starting on an inactive title widget activates and raises the
window without invoking the widget. Suppression belongs to that gesture only,
including a click delivered to the widget after release. Once that gesture is
over, a standalone synthetic or assistive-technology click with nonzero detail
and no preceding press must run the widget action once. Pointer cancellation
must not leave suppression that swallows an unrelated later click. Keyboard and
detail-zero activation retain their current behavior.

## Failed initial activation (#628 L2)

When adding a window requesting active state fails during initial rendering,
reject the add and remove its provisional entry. Preserve the prior successfully
managed active window and its active chrome; a failed add must not leave an
otherwise active manager without an active window. A later successful active add
still wins, and only one managed window is active. Do not resurrect a window that
was removed, or overwrite a subsequent deliberate activation during asynchronous
preparation.

A concurrent activation or superseding operation must not convert a failed initial
render into a successful add. If no initial render can successfully commit, reject
the add and remove its provisional entry even when other work superseded the
failing preparation. Keep any subsequent legitimate activation authoritative.
Background preparation failures must be handled without unhandled promise
rejections.

## Inactive widget focus (#628 L3)

A real mouse press on an inactive title widget moves keyboard focus into that
window, to its move handle when focus was outside the window, without triggering
the widget. Pointer capture retargets the mouse click away from the widget in all
supported engines. Consequently a mouse-only regression does not test the
click-time suppression check; the synthetic touch/pen path must independently
exercise a click delivered to the widget after activation and verify suppression.
