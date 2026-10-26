# Bevel delivery amendment: metadata snapshots

This is a listing-free amendment to [bevel.md](bevel.md) and
[bevel-current-boundary.md](bevel-current-boundary.md). The user explicitly
approved: “Allow snapshots; document timing change”. This approval changes the
metadata timing contract for bevel consolidation only. It adds no original-engine
or native-fidelity claim.

## Approved timing change

`composeBevelButton` may capture the metadata needed by an invocation at render
entry, before its first asynchronous artwork operation, and render from that
captured description. This includes selected metadata and the metadata used to
resolve the invocation's face, body, pattern and sampled-border dependencies.
Public option and composition-context values may likewise be captured for that
invocation. Snapshotting is permitted; this amendment does not introduce a new
public snapshot API.

Changing those input values while the invocation is pending is unsupported.
Such changes need not retarget the invocation, affect later geometry or color
reads, or change its diagnostic attribution. A later invocation may capture the
then-current values. Code must not depend on metadata getters being called a
particular number of times, in the previous traversal order, or after an artwork
await; getters that change other metadata to influence subsequent reads have no
preserved mutation-order guarantee under this amendment.

This supersedes only the previous requirements to retain live metadata references,
delayed metadata reads and their getter/mutation timing in BV02, BV03, BV06 and
BV07, and the corresponding temporal descriptions in the current-boundary
addendum. It does not supersede those sections' ordinary value-based behavior.
The existing independent delivery cases remain unchanged.

## Requirements retained

For input values that remain stable during an invocation, preserve selection,
owner-chain precedence, positive aliases, repeated fallback attempts and events,
source identities, and all existing admission and missing/unknown distinctions.
Ordinary supplied legacy metadata remains distinct from declared cinf admission;
absent or malformed raw engine cinf does not acquire new authority over that
legacy path. Snapshotting must not introduce JSON/structured-clone compatibility,
plain-object, uniqueness, raw-census or stricter asset-validation requirements as
new public admission rules.

Preserve dimensions, source sampling, colors, pattern phase, clips, aligned
masked/unmasked mode5, rectangular fallback, and the existing two-stage border
alpha policy. Stable diagnostic identities, branch meanings, completed coverage
and error outcomes remain required. Do not add artwork decoding or image exports
for unselected resources merely to populate a snapshot. Capturing metadata does
not require copying or materializing every raster plane.

Diagnostic completion and failures retain BV08 and the current-boundary
contract: staged body/legacy completion waits for successful rendering; the
callback is invoked once when trace construction succeeds; callback-error
precedence and trace construction/freezing failures remain unchanged. This
approval does not authorize moving callbacks, changing their synchronous
completion behavior, freezing caller-owned input objects as a new side effect,
or converting a failure into successful completion.

Registered raster-owner lifetime remains live. A metadata snapshot does not
extend resource lifetime, keep a disposed owner usable, suppress a required
pre/post-render disposal check, or add bevel cancellation/signal semantics.
Existing captured-transport behavior, demanded decode/export failures and
resource-release/cache behavior remain in force. Disposal is not an unsupported
metadata mutation and is not covered by the timing waiver.

No public export, option, loader policy, expectation, golden, evidence pin or
native claim changes through this amendment. Other families' metadata timing
contracts are unchanged.
