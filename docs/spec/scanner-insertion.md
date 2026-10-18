# Declarative added-subtree scanning

`mountDeclarative({ root })` initially scans descendants of `root`; an Element
root is a scope, not itself a promotion target. After that initial pass, the
observer scans each added Element including the added node itself. This covers
window, button, native checkbox/radio/range/select, tabs, field, icon and configured
theme-picker targets. Icons still require matching art; pickers still require a
catalog. No family acquires a new rendering or interaction policy.

A scan snapshots target identities before promoting windows. Window promotion
moves children and detaches the source, so querying only that source afterward
would lose its declared controls. Windows run first, tabs next, then the remaining
families. While the scan receiver remains within the mount, fresh descendant
queries are unioned with retained identities after window/tab preparation. This
preserves controls added during the initial asynchronous pass, before its observer
exists. A detached window source uses only its retained identities; the scanner
does not substitute its parent or expand to the mount root.

Observer additions remain in a deduplicated subtree queue while theme requests or
preparation are pending. The queue retains include-self semantics across the theme
barrier. In-flight and promotion stamps prevent duplicate publication/listeners;
queued nodes are checked against current mount ownership. Disconnect clears the
queue and blocks new scanner publication after a pending theme load. Existing
family-specific cancellation and teardown still apply. In particular, tabs check
connectivity rather than mount ownership during their own asynchronous paint:
a tab group moved to another connected subtree during that paint can still
publish there. The scanner's final ownership check only prevents its registration.
Disconnect does not restore existing tab/field markup. These pre-existing
lifecycle limits are not repaired by this discovery change. Individual failed
scans are reported without discarding other queued additions.

## Explicit boundary

Later additions inside an already-promoted window host are not scanned, whether
they are direct controls or containers holding controls. The check uses the
actual `data-scriptoscope-window-host` outer marker as well as legacy chrome:
light-DOM content cannot find the shadow-DOM `.scriptoscope-window` using
`closest()`. Before #281, that ineffective check accidentally allowed some
wrapped late controls to promote, while direct late controls were skipped by
receiver-exclusive queries. Enforcing the documented boundary removes that
accidental wrapped path. It does not enroll controls in another manager's host.

Create a new declared window with its children before inserting it. To change
existing content, ordinary consumer DOM continues to work; automatic promotion
of new controls inside existing hosts needs a separately defined ownership API.

Cascade selection remains its existing one-shot behavior. An added window does
not trigger a search or re-layout of ancestor cascade containers. This change
also does not add attribute-mutation discovery, reopen the initial window target
list during a scan, or rescan the whole document. Theme-switcher wiring retains
its existing page-scope stamp check.

Source/built tests compare direct and container insertion, real native child
behavior, all standalone families, theme and decode barriers, later queued
additions, no whole-root window query, repeated mutations, disconnect during
actual conversion, initial-scope semantics and late initial control discovery.
These are scanner/ownership contracts, not rendering-fidelity assertions.
