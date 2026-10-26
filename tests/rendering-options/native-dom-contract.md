# Native public DOM/form contract review

Established before inspecting runtime implementation details.

Native checkbox/radio inputs are authoritative for checked state, accessible names,
form ownership, disabled state and activation. Redundant aria-checked is not required.
A radio group has the browser's normal sequential focus behavior: the checked radio
is the group tab stop; arrow keys move selection. On macOS WebKit, full-control
keyboard navigation uses Option+Tab when the platform setting excludes controls
from ordinary Tab navigation. A plain-native browser control validates this
keyboard path independently of the runtime. Original inputs, state, attributes,
labels and parent/sibling position must survive disconnect and remount. Consumer
changes must survive teardown. Native disabled controls cannot be focused or activated;
disabled fieldsets have their normal browser effect.

interactiveButton returns a native button whose default type is button. Each enabled
browser click invokes its callback once; disabling prevents activation. Native Enter
and Space timings apply. Dispatching untrusted pointer/keyboard events alone does
not synthesize browser activation. Element.click() is a meaningful disconnected
activation path; a canceled click must not cause form submission. The declarative
control forwards activation to its original source exactly once and preserves that
source's submit/reset default action and form owner. Detached presentation controls
must stop forwarding after disconnect.

Public contract tests must preserve semantic assertions and negative controls.
Existing tests that mix DOM contracts with excluded evidence material remain
unmodified and unresolved in this assignment. The focused native DOM suite uses a
separate blank page and ordinary list reporting, without evidence instrumentation.

## Justification of existing acceptance changes

Checkable lifecycle assertions use native checked state and retain restoration,
form values, consumer mutations, stale-event isolation, listener cleanup and
remount coverage. Sequential focus visits the checked radio once per group.
Disabled-button assertions use native disabled state and reject attempted focus;
existing geometry, painting, event suppression and teardown checks stay intact.
The form fixture admits native buttons while retaining every original form
semantic/default action assertion and named semantic negative control.
Disconnected preparation still must succeed, but synthetic key dispatch is now
a negative activation control followed by explicit native click activation.

The process-only mutation previously matched an obsolete local identifier, so
its transform assertion prevented the module from loading. The mutation now
checks that one current neutral-type assignment exists and changes fallback
neutrality only. Valid themed controls stay positive; actual unwanted form
submission is the decisive negative. The isolated clean suite verifies import
success and this behavioral distinction in each browser.

The showcase DOM tag admission now accepts native button presentation for both
themed and fallback controls. Its malformed-element negative rejects a non-button,
and its presentation selector follows the same native contract. These three
surgical substitutions preserve every other byte in the two affected files,
including all provenance, pixel, malformed-structure, callback and teardown checks.
The tag assertion was inspected and checked independently through AST projection;
excluded evidence inputs and pixel/provenance logic were not reviewed. The legacy
shared reporter/fixture path was not executed in this assignment; final full-suite
validation remains an integration obligation. The clean suite is additional
independent semantic coverage, not a claim that all thirteen previous failures or
the full browser suite now pass.
