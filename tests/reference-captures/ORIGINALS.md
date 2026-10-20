# Reviewed original face observations

The corpus contains forty-one `reviewed-scoped-observation` records under
[`public-api-empty-face` versions 1–5](../../docs/spec/scoped-reference-observations.md).
An independent Astra AI agent reviewed the eight earlier observations. A separate independent automated root reviewer approved the four
new records under v5. Its [byte review](./four-state-independent-byte-review.json)
is hash-bound in the [scope attestations](./reviews.json); acquisition review
alone is not intake approval. The later Animals and BeOS batches add six
separately reviewed scoped records, with attestations in the same review file.
The Shared307 campaign adds eighteen more v5 records, independently checked by
root against exact native images, calibration data and completed source/built
output; its [byte review](./shared307-independent-byte-review.json) retains limits.
This is explicitly automated review,
not human or maintainer attestation. The capture/preparation producer is also
identified as AI in [captures.json](./captures.json).
| Request | Original run | Retained images | Measurement timing |
|---|---|---|---|
| `windows-95.normal` | `V9-20261018-01` | [Full frame](./windows-95/full-frame.png), [port](./windows-95/port.png), [context](./windows-95/context.png) | Palette/producer measurements bracket the mapping batch after drawing |
| `system7-nostalgia-silver.normal` | `V7D-20261018-01` | [Full frame](./system7-nostalgia-silver/full-frame.png), [port](./system7-nostalgia-silver/port.png), [context](./system7-nostalgia-silver/context.png) | Conditions bracket `Draw1Control` |
| `windows-95.pressed` | `V10W-20261019-01` | [Full frame](./windows-95-highlighted/full-frame.png), [port](./windows-95-highlighted/port.png), [context](./windows-95-highlighted/context.png) | Conditions bracket `Draw1Control` + `HiliteControl` |
| `windows-95.inactive` | `V10W-20261019-01` | [Full frame](./windows-95-disabled/full-frame.png), [port](./windows-95-disabled/port.png), [context](./windows-95-disabled/context.png) | Conditions bracket `Draw1Control` + `HiliteControl` |
| `system7-nostalgia-silver.pressed` | `V10S-20261019-01` | [Full frame](./system7-nostalgia-silver-highlighted/full-frame.png), [port](./system7-nostalgia-silver-highlighted/port.png), [context](./system7-nostalgia-silver-highlighted/context.png) | Conditions bracket `Draw1Control` + `HiliteControl` |
| `system7-nostalgia-silver.inactive` | `V10S-20261019-01` | [Full frame](./system7-nostalgia-silver-disabled/full-frame.png), [port](./system7-nostalgia-silver-disabled/port.png), [context](./system7-nostalgia-silver-disabled/context.png) | Conditions bracket `Draw1Control` + `HiliteControl` |
| `crayon-os.normal` | `V14C` | [Full frame](./crayon-os/full-frame.png), [port](./crayon-os/port.png), [context](./crayon-os/context.png) | Palette/producer measurements bracket the mapping batch after drawing |
| `apple-lisa.normal` | `V16L` | [Full frame](./apple-lisa/full-frame.png), [port](./apple-lisa/port.png), [context](./apple-lisa/context.png) | Palette/producer measurements bracket the mapping batch after drawing |
| `crayon-os.pressed` | `C18H` | [Full frame](./crayon-os-pressed/full-frame.png), [port](./crayon-os-pressed/port.png), [context](./crayon-os-pressed/context.png), [face](./crayon-os-pressed/face.png) | Conditions bracket `Draw1Control` + `HiliteControl` |
| `crayon-os.inactive` | `C18D` | [Full frame](./crayon-os-inactive/full-frame.png), [port](./crayon-os-inactive/port.png), [context](./crayon-os-inactive/context.png), [face](./crayon-os-inactive/face.png) | Conditions bracket `Draw1Control` + `HiliteControl` |
| `apple-lisa.pressed` | `L18H` | [Full frame](./apple-lisa-pressed/full-frame.png), [port](./apple-lisa-pressed/port.png), [context](./apple-lisa-pressed/context.png), [face](./apple-lisa-pressed/face.png) | Conditions bracket `Draw1Control` + `HiliteControl` |
| `apple-lisa.inactive` | `L18D` | [Full frame](./apple-lisa-inactive/full-frame.png), [port](./apple-lisa-inactive/port.png), [context](./apple-lisa-inactive/context.png), [face](./apple-lisa-inactive/face.png) | Conditions bracket `Draw1Control` + `HiliteControl` |
| `animals.normal` | Animals fixed-order generation1 | [Full frame](./animals-normal/full-frame.png), [port](./animals-normal/port.png), [context](./animals-normal/context.png), [face](./animals-normal/face.png) | Conditions bracket public drawing/state calls |
| `animals.pressed` | Animals fixed-order generation2 | [Full frame](./animals-pressed/full-frame.png), [port](./animals-pressed/port.png), [context](./animals-pressed/context.png), [face](./animals-pressed/face.png) | Conditions bracket public drawing/state calls |
| `animals.inactive` | Animals fixed-order generation3 | [Full frame](./animals-inactive/full-frame.png), [port](./animals-inactive/port.png), [context](./animals-inactive/context.png), [face](./animals-inactive/face.png) | Conditions bracket public drawing/state calls |
| `beos-r503.normal` | BeOS fixed-order generation1 | [Full frame](./beos-r503-normal/full-frame.png), [port](./beos-r503-normal/port.png), [context](./beos-r503-normal/context.png), [face](./beos-r503-normal/face.png) | Conditions bracket public drawing/state calls |
| `beos-r503.pressed` | BeOS fixed-order generation2 | [Full frame](./beos-r503-pressed/full-frame.png), [port](./beos-r503-pressed/port.png), [context](./beos-r503-pressed/context.png), [face](./beos-r503-pressed/face.png) | Conditions bracket public drawing/state calls |
| `beos-r503.inactive` | BeOS fixed-order generation3 | [Full frame](./beos-r503-inactive/full-frame.png), [port](./beos-r503-inactive/port.png), [context](./beos-r503-inactive/context.png), [face](./beos-r503-inactive/face.png) | Conditions bracket public drawing/state calls |

Each record retains the complete unaltered 640×480 native frame, exact 160×80
port and 96×36 context. The entire 80×20 face is at port/image (20,20), with
frame origin (80,90). Review checked full-frame RGBA against the native producer
plane and checked pixel-exact integer crops. These images came from the copied
original environment, not Scriptoscope output or self-goldens.

Review checked the configured scheme file/fork, installed Kaleidoscope 2.3.1
components, native public invocation and observed state/geometry/clip/background,
palette/gamma bytes, capture glue and external producer build identities.
Configured-file identity does not prove which private resource or painter ran.
Some original capture IDs retain their preparation suffix `.draft` as stable
identifiers; eligibility comes from the bound reviews, not the ID text.

Each subject directory includes a sanitized capture log with original log
hashes, exact retained line numbers and redaction hashes. Source/installation
bindings and producer builds are identities, not bundled executables. The OS
identity hash explicitly identifies the copied preboot volume, not an isolated
System-file hash. No original engine, emulator, OS, ROM, app or font payload is
included; binary supporting artifacts contain only observed palette/gamma
tables. Original font/cache byte dumps were omitted.

For Windows 95 normal, the measured display profile was recorded in the same run.
System 7's link is cross-run equality of the recorded palette and gamma, not proof of
identical hidden conditions or a universal transfer algorithm. Windows 95's
post-draw measurements must not be relabeled as pre-draw observations. Producer
semantic release and clean-shutdown acknowledgment remain unestablished.

Font realization, complete patch/base/search order, selected provider/cache and
private default flags remain explicit unknowns. No public default API was
invoked. One opaque white background cannot prove mask/alpha behavior; an empty
label cannot prove typography or font independence. Other states, automatic
sizing, margins/rings and private painter selection remain outside this scope.

Run `npm run test:references` for current eligibility: twelve stored records and
47 requests without captures. Scoped-only requests remain evidence-incomplete,
with zero verified intake requirements and all five broader targets unresolved.
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


## New Crayon/Lisa state batch

C18H/C18D/L18H/L18D record the actual public hilite 10/255 state with an empty
80×20 control and active window. Ordinary stopped HFS exports contain exactly
19,630 / 19,633 / 19,656 / 19,659 bytes, matching the guest expected, written
and reopened EOF counts; all seven File Manager statuses are zero. The original
full producer RGBA matches each full PNG and each exact crop. Eight before/after
payload pairs per capture are stable. Shutdown was requested; explicit worker
exit/poweroff acknowledgment remains unknown. The transfer-volume fork join
identifies the loaded seed, not proof of persisted guest transfer writes.

[four-state-profile-calibration.json](./four-state-profile-calibration.json)
binds the exact retained Crayon and Lisa measured profiles to the new observed
palette, gamma, device fields and producer builds. Existing mappings cover all
2,224 Crayon and 22 Lisa whole-load RGB16 inputs, including the new state-specific
face/cinf/ppat inputs. No mapping was interpolated or remeasured. The new capture
observes the selected device fields; it does not issue a fresh current-versus-main
device-handle query. This is explicit cross-run reuse under recorded matching
conditions, not proof of hidden-state identity or a universal transfer model.

The public comparison supplies control origin (20,20), port origin (0,0), full
160×80 clip and explicitly unknown pattern origin. Its 80×20 face begins at
buffer (4,4), whereas the composition trace uses port (20,20). Only the complete
face composited over white is compared; original masks, private cinf provider,
pattern cache/phase, typography and full control behavior remain unestablished.


## BeOS three-state batch

The normal, logically highlighted and disabled observations come from one
fixed-order System7.5.5/Kaleidoscope2.3.1 boot with fresh controls. Native
ordinary exports are 20,403 / 20,452 / 20,457 bytes. Full producer RGBA/PNG,
state/ACK joins and the canonical configured fork were independently reviewed.
The later B278/D32 calibration boot is distinct; its shared history is explicit.

The measured version2 profile allows whole-load preparation without converting
direct RGB8 inputs to invented RGB16 queries. Prepared pattern128 is checked independently
and is not attributed to these faces. All three recorded 80×20 faces match the
public source and built renderer over white, with actual selected and completed
paint dependencies. This does not recover original alpha/masks, private
providers, pattern phase or general font identity. Missing cross-run port-table
and widMax observations stay visible; equality of recorded fields is not proof
of complete hidden-state equivalence. Scoped review is independent automated AI
review, not a human or maintainer attestation.


## Shared307 campaign observations

The six-source campaign retains one fixed normal→highlighted→disabled sequence
per boot, separately calibrated with 307 exact RGB16 queries repeated twice.

| Source | Normal | Highlighted | Disabled |
|---|---|---|---|
| 1138 | [Face](./1138-normal/face.png) | [Face](./1138-pressed/face.png) | [Face](./1138-inactive/face.png) |
| Apple Platinum 2 | [Face](./apple-platinum-2-normal/face.png) | [Face](./apple-platinum-2-pressed/face.png) | [Face](./apple-platinum-2-inactive/face.png) |
| Black Platinum | [Face](./black-platinum-normal/face.png) | [Face](./black-platinum-pressed/face.png) | [Face](./black-platinum-inactive/face.png) |
| Platinum 8 | [Face](./platinum-8-normal/face.png) | [Face](./platinum-8-pressed/face.png) | [Face](./platinum-8-inactive/face.png) |
| Slimes | [Face](./slimes-normal/face.png) | [Face](./slimes-pressed/face.png) | [Face](./slimes-inactive/face.png) |
| Windows 3.1 | [Face](./windows-31-normal/face.png) | [Face](./windows-31-pressed/face.png) | [Face](./windows-31-inactive/face.png) |

See the [campaign conditions](./README.md#shared307-six-source-campaign) for
the retained Black/Slimes incidents, corrected 1138 profile identity, actual
legacy-versus-cinf paint dependencies and unresolved device/provider conditions.

## Evolution: two empty states, finite measured preparation

[`evolution.normal.e1971`](./evolution-normal/port.png) and
[`evolution.inactive.e1971`](./evolution-inactive/port.png) retain exact empty
normal/hilite-0 and disabled/hilite-255 faces from the same four-state native
sequence. The other two labeled states and all native font/query payloads remain
private and are not admitted. The [independent byte review](./evolution-independent-byte-review.json)
and [scope attestations](./reviews.json) bind the actual images and v5 conditions.

The [measurement record](./evolution-calibration/measurement.json) contains the
actual 3,942 Color2Index/Index2Color rows for 1,971 unique RGB16 keys. The finite
[profile](../decoder-fixtures/measured-display-profile-evolution.json) preserves
those measurements and actual palette/producer channels. Consumer font 0/size 0
and later calibration size 12 are distinct; font identity is null. Missing
current/main equality, consumer port ColorTable, patch/cache and original phase
remain unknown. The Finder incident and ordinary same-boot recovery before
measurement are retained, with cause unproven.

The output comparison covers the complete face, while actual paint evidence
contains eight metadata-defined bands and a missing ppat-0 lookup. It does not
claim a completed interior-fill trace, original masks, typography, private
provider choice, labeled rendering or whole-control fidelity. Evolution pressed
remains a missing campaign capture. The public source/built pair matched all 38 registered faces and 60,800
composited pixels per mode; independent root review recomputed every PNG crop.
Execution remains separately bound from acquisition and scoped intake approval.

## Monkey Paradise empty-state observations

| State | Original face | Full frame |
|---|---|---|
| Normal / hilite0 | [Face](./monkey-paradise-normal/face.png) | [Full frame](./monkey-paradise-normal/full-frame.png) |
| Pressed / hilite10 | [Face](./monkey-paradise-pressed/face.png) | [Full frame](./monkey-paradise-pressed/full-frame.png) |
| Inactive / hilite255 | [Face](./monkey-paradise-inactive/face.png) | [Full frame](./monkey-paradise-inactive/full-frame.png) |

Fresh controls share one fixed-order boot and a subsequent 288-key calibration.
Actual font0/size12 metrics are recorded, identity null; no glyph/query payload
is included. Scoped intake approval is independent of registered source/built
execution. The registered pair matched all41 faces/65,600 pixels per mode;
independent root review recomputed original PNG comparisons and actual dependencies.
Normal requires the actual nonuniform same-owner ppat128 and completed
modern body stage; original phase/provider and general body fidelity are unknown.
Private originals and failure history are retained in asset
`monkey288-three-state-20261020`, private commit
`ce54c3330c3cbe00cdd50a2f0488776adb00f712`, archive SHA-256
`e9a83a1f01ac88eaeb2d09940568ca5f9d0357f2aa8bb2345dd1e0054b50c719`.
Public CI requires none of those private assets.
