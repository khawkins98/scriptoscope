# Reviewed original face observations

The corpus contains six `reviewed-scoped-observation` records under
[`public-api-empty-face` versions 1 and 2](../../docs/spec/scoped-reference-observations.md).
An independent Astra AI agent reviewed the original artifacts and wrote the
separate [review records](./reviews.json). This is explicitly automated review,
not human or maintainer attestation. The capture/preparation producer is also
identified as AI in [captures.json](./captures.json).

| Request | Original run | Retained images | Measurement timing |
|---|---|---|---|
| `windows-95.normal` | `V9-20261018-01` | [Full frame](./windows-95/full-frame.png), [port](./windows-95/port.png), [context](./windows-95/context.png) | Palette/producer measurements bracket the mapping batch after drawing |
| `system7-nostalgia-silver.normal` | `V7D-20261018-01` | [Full frame](./system7-nostalgia-silver/full-frame.png), [port](./system7-nostalgia-silver/port.png), [context](./system7-nostalgia-silver/context.png) | Conditions bracket `Draw1Control` |
| `windows-95.pressed` | `V10W-20261019-01` | [Full frame](./windows-95-highlighted/full-frame.png), [port](./windows-95-highlighted/port.png), [context](./windows-95-highlighted/context.png) | Conditions bracket drawing after `HiliteControl` |
| `windows-95.inactive` | `V10W-20261019-01` | [Full frame](./windows-95-disabled/full-frame.png), [port](./windows-95-disabled/port.png), [context](./windows-95-disabled/context.png) | Conditions bracket drawing after `HiliteControl` |
| `system7-nostalgia-silver.pressed` | `V10S-20261019-01` | [Full frame](./system7-nostalgia-silver-highlighted/full-frame.png), [port](./system7-nostalgia-silver-highlighted/port.png), [context](./system7-nostalgia-silver-highlighted/context.png) | Conditions bracket drawing after `HiliteControl` |
| `system7-nostalgia-silver.inactive` | `V10S-20261019-01` | [Full frame](./system7-nostalgia-silver-disabled/full-frame.png), [port](./system7-nostalgia-silver-disabled/port.png), [context](./system7-nostalgia-silver-disabled/context.png) | Conditions bracket drawing after `HiliteControl` |

Each record retains the complete unaltered 640×480 native frame, exact 160×80
port and 96×36 context. The entire 80×20 face is at port/image (20,20), with
frame origin (80,90). Review checked full-frame RGBA against the native producer
plane and checked pixel-exact integer crops. These images came from the copied
original environment, not Scriptoscope output or self-goldens.

Review checked the configured scheme file/fork, installed Kaleidoscope 2.3.1
components, native public invocation and observed state/geometry/clip/background,
palette/gamma bytes, capture glue and external producer build identities.
Configured-file identity does not prove which private resource or painter ran.
The original capture IDs retain their preparation suffix `.draft` as stable
identifiers; eligibility comes from the bound reviews, not the ID text.

Each subject directory includes a sanitized capture log with original log
hashes, exact retained line numbers and redaction hashes. Source/installation
bindings and producer builds are identities, not bundled executables. The OS
identity hash explicitly identifies the copied preboot volume, not an isolated
System-file hash. No original engine, emulator, OS, ROM, app or font payload is
included; binary supporting artifacts contain only observed palette/gamma
tables. Original font/cache byte dumps were omitted.

For the normal records, the measured display profile links to Windows 95 in the same run. System
7's link is cross-run equality of the recorded palette and gamma, not proof of
identical hidden conditions or a universal transfer algorithm. Windows 95's
post-draw measurements must not be relabeled as pre-draw observations. Producer
semantic release and clean-shutdown acknowledgment remain unestablished.

Font realization, complete patch/base/search order, selected provider/cache and
private default flags remain explicit unknowns. No public default API was
invoked. One opaque white background cannot prove mask/alpha behavior; an empty
label cannot prove typography or font independence. Other states, automatic
sizing, margins/rings and private painter selection remain outside this scope.

Run `npm run test:references` for the current report: six scoped observations,
seven missing requests, all six observed requests evidence-incomplete, zero
verified requirements and all five broader targets unresolved for each record.
Admission performs no Scriptoscope pixel comparison and changes no ledger
assessment. The declared target still has no overall fidelity percentage.


The four v10 records use version2: “pressed” is logical `HiliteControl(10)`
highlight, and “inactive” is a disabled `HiliteControl(255)` control, both in an
active window. They do not record physical mouse gestures or an inactive window.
Public creation/draw remains NewControl/Draw1Control with procedure/variant/value0
and no default API. Before/after drawing palette/gamma bytes and exact crops are
bound to each record; the link to the v9 profile is equality of those recorded
conditions, not a universal transfer model or hidden-state proof.

The Windows95 v10 wrapper retained a mistaken static System7 label. Its
`label-clarification.json` preserves that wording/hash and correction evidence;
the configured Copl/FCB identity and exact Windows95 fork establish the configured
scheme. A wrapper label is not selected-provider authority. The original normal
v1 records and review attestations are unchanged. Separate published renderer
comparisons are not used as original pixels or intake authentication.
