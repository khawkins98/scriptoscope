# Independent reference capture intake (request draft 0.3.0)

This is a finite request and review contract for [#190](https://github.com/khawkins98/scriptoscope/issues/190),
under the [draft compatibility target](../../docs/spec/fidelity-compatibility-contract.md).
**Fifty-four original observations have independent AI review under the narrow
`public-api-empty-face` scopes v1–v5.** They satisfy no whole request and verify
no intake target. The fixed empty-push campaign now plans all 18 canonical
sources × normal/logically highlighted/disabled states: 54 requests, including
those eight existing observations. Five earlier default/shift experiments remain
separate, for 59 requests total. The Animals, BeOS, six-source Shared307, three Evolution, three Monkey Paradise, three Floppies and nine 1984/1990/Dolphin observations bring the stored corpus to fifty-four
reviewed scoped records; every campaign request now has a capture and only the five older
experiments have none. All fifty-four scoped requests remain evidence-incomplete.

Scope v5 applies only to the 46 newly appended campaign IDs. It requires the
same fixed port, face, background and full-image evidence, actual public
HiliteControl state and explicit unknown original pattern phase. It does not
change old scopes, request objects, record/review digests or full-request
requirements. A campaign request is a research gap, never a fabricated capture.
The scoped records retain their actual full frames, port/context/face crops,
ordinary stopped HFS export checks and sanitized invocation/condition bindings.
Separate independent automated root review approved their exact v5 scope.
Acquisition and calibration review alone do not approve intake.

See [original observations and limits](./ORIGINALS.md). Quarantined research
observations remain separate from admitted intake. Public comparison requires
actual source/state dependency pins and complete measured RGB16 input coverage,
with reviewed cross-run palette/gamma/device/producer joins. Matching opaque
pixels does not establish original masks, providers, font independence or phase.
Data, independent review, source/built comparison, narrow ledger bindings and
documentation share one coherent batch; missing calibration or pixel
mismatches remain explicit rather than changing the oracle.

Maintainers: the [private reference environment guide](../../docs/maintainer-reference-environment.md)
links the Forgejo asset store and explains hash-verified fetch, restore prerequisites
and acquisition limits. Public intake/CI does not access those private assets.

## Preserved first-batch requests

| Scheme | Requests | Purpose |
|---|---|---|
| Windows 95 | normal, pressed, inactive, default | Empty-label body/state and default-ring reference |
| System 7 Nostalgia Silver | normal, pressed, inactive, default | Same explicit inputs on a second target |
| Apple Lisa | normal | Unequal corner4/side1 face |
| 1990 | default | Unequal corner7/side14 ring bands |
| Crayon OS | zero-origin baseline, shifted-origin placement control, fixed-physical-placement phase experiment | Pattern-bearing body; invocation and pattern-origin state unresolved |

Every request specifies an empty label and an **80×20 control Rect** (at (20,20),
except the fixed-physical-placement experiment at (23,25)),
white background, an active window and native 1:1 pixels. “Inactive” here requests
a **disabled control in an active window**, not an inactive window. “Default” is
normal/enabled with the original default mechanism engaged; its actual mechanism
must be recorded. Pressed requires the original pressed condition, not a renamed
normal screenshot. No CDEF number, hilite byte or rendering flag is inferred from
these logical names: record the observed original invocation and have it reviewed.

The full capture is 160×80 pixels. Most crops are port Rect (12,12,96,36),
leaving context outside the nominal face and possible ring. Keep the full image;
do not trim alpha/opaque bounds, rescale, rotate, resample, recolor or crop away an
unexpected artifact. If the original environment cannot meet a request, revise
and review the request instead of relabeling another capture as a match.

### Origin experiments and unresolved invocation preconditions

Image coordinates are `portXY - portOrigin`. The three Crayon requests separate
coordinate motion from a possible phase experiment:

| Request suffix | Port origin O | Control Rect D | Crop in port | Crop in image | Intended distinction |
|---|---|---|---|---|---|
| `normal` | (0,0) | (20,20,80,20) | (12,12,96,36) | (12,12,96,36) | Baseline |
| `normal.shifted-port` | (3,5) | (20,20,80,20) | (12,12,96,36) | (9,7,96,36) | Coordinate-placement control: physical face moves |
| `normal.fixed-physical-phase` | (3,5) | (23,25,80,20) | (15,17,96,36) | (12,12,96,36) | Physical face/crop held fixed; potential local pattern-phase discrimination |

These are provisional input specifications, **not predictions of historical
pixels or valid ordinary Control Manager usage**. Apple's *Inside Macintosh:
Imaging With QuickDraw* (1994), printed page 2-45, explicitly requires origin
(0,0) before Window/Control Manager routines. The two nonzero-origin requests
therefore require `controlDefinition.invocationClass: "reviewed-direct-drawing"`
and `directOriginEvidence` with the actual invocation, justification for its
nonzero-origin validity, and source reference. The invocation is currently
**unknown**; no CDEF number, bypass or supported entry point is invented here.
A hashed `direct-origin-invocation` JSON artifact must exactly contain
`{controlDefinition, directOriginEvidence, patternOriginState}` from `observed`.
Independent review must affirm `directOriginInvocation`; an ordinary manager
invocation is rejected and an unknown invocation remains incomplete.

The pinned kDEF component's f94e/f952 save O, f956–f962 set O−P, f990–f9a8 use
D−P, and f9e8–f9ec restore O. Thus physical D−O is preserved by that paired
translation; local coordinates alone do not establish the full observed pattern
phase. Later QuickDraw `QDSetPatternOrigin` adds a per-port pattern offset.
All three Crayon requests require observed `patternOriginState`:
`apiAvailability` (`available` or `unavailable`), `offset` (observed integer [x,y]
when available; null when unavailable), and `evidence` describing how the state
or API unavailability was established. Unknown availability/offset is incomplete;
zero is never assumed. The independent review check `patternOriginState` is
required. Compare phase only with a valid invocation and reviewed, controlled
pattern-origin state; the validator predicts no phase shift or pixel result.

Pinned source references for these experimental constraints:

- [Apple Imaging With QuickDraw PDF](https://vintageapple.org/inside_r/pdf/Imaging_With_QuickDraw_1994.pdf),
  printed pp. 2-45 (SetOrigin restriction) and 3-6 (pattern continuity), SHA-256
  `f8e079d02b57516900f4b45c1f09629ef734313a51c171029278c9d97f6b497a`.
- [Apple Universal Interfaces 3.4.1 Quickdraw.h documentation, QDSetPatternOrigin](https://www.ioi-xd.net/os9docs/Quickdraw_8h.html#afff2dba5362303c1881307f1448db977),
  rendered header reference SHA-256
  `9e30372f277b70b9c877c628204db448526cec3ee8dfb849ab6e4af0c9c444ef`.
  It documents per-port offset semantics and Non-Carbon CFM availability from
  NQD 8.5, CarbonLib 1.3 and Mac OS X 10.1; the actual capture environment remains unknown.

`requests.json` is authoritative for exact inputs. It references the existing
[source-choice registry](../control-availability/source-choices.json); it does not
create a competing source catalog. The `request-semantic-v1` digest binds the exact request object, selected source
record, engine component, target requirement definitions, supported scope
objects, transitive experiment baseline inputs and applicable sections of the
[normative eligibility policy](./eligibility-policy.json). Changing any of these
requires new review bindings. See the [digest/migration spec](../../docs/spec/reference-semantic-digest.md).

The authority ID remains pinned and catalog/header versions must agree. Global
authority bytes/version, catalog request version, ledger inventory version and
registry-wide metadata are reported provenance, not individual obligations.
Unrelated documentation or ledger additions therefore do not stale attestations.
Source-registry/ledger paths and source archive bytes still undergo their existing
checks. Normative eligibility changes must update the relevant policy rules and
version; an unrelated prose edit cannot silently introduce a new decision rule.
These draft source
choices identify
requested bytes; they do **not** approve historical Resource Manager selection or
which provider owned each resource. The known kDEF0 2.3.1 hash identifies one
component, not a full engine installation, PACH stack or original OS.

## Full-admission original conditions must be supplied

The templates leave OS, installation, patches, bases, original provider search
order, font, palette and capture pipeline **null**. No Mac OS version, base theme,
Charcoal/Virtue substitution, palette or patch configuration is silently assumed.
Under the default/full-admission path, a capture becomes eligible for independent
review only after its producer records:

- Exact source archive/entry/fork and pinned engine component; full original OS
  and Kaleidoscope installation names, versions and artifact SHA-256 identities.
  The installation must be Kaleidoscope 2.3.1. Do not infer its complete identity
  from the pinned kDEF component alone.
- Ordered patch stack, explicit base chain and original resource-provider search
  order, each with names/versions/hashes. An empty patch/base array needs a reason;
  an unknown chain must remain null. Runtime fallback choices are not evidence of
  the original search chain. Installation/OS binaries need not be redistributed.
- Actual control procedure/variant, hilite/value, enabled/window-active state,
  default mechanism and invocation. Record additional relevant flags in the
  invocation description; independent review must assess their completeness.
- Font name/version/resource identity, point size and style, even with no ink in
  this body-only batch. Record original palette/color configuration depth, hash
  and description. Font/metric equivalence and labeled typography remain unknown;
  they require separate text requests, not approval of these empty-label cases.
- Original capture producer/time/method, PNG bytes/dimensions/hash, and hashed
  capture log plus environment manifest. The latter is JSON containing exactly
  `{source, engineComponent, observed}` from the submitted capture; its identity
  must agree with the claimed metadata. Hashes of OS/font/palette artifacts are
  recorded identities reviewed against this evidence, not binaries decoded by CI.

Do not fabricate a value to satisfy a required field. Partial evidence is useful
but remains **partial**, with the missing fields named. An experiment in a
different environment may be retained as non-independent/qualitative material;
it cannot silently satisfy this version-matched request.

## Narrow public-API face scope

An explicit version 1 `public-api-empty-face` scope is available only for
`windows-95.normal` and `system7-nostalgia-silver.normal`. It covers the entire
fixed 80×20 empty normal face as **composited pixels under recorded conditions**.
It preserves the full 160×80 request image, 96×36 context and original full frame;
it cannot certify alpha/masks, fonts, automatic size, other states, rings or
private provider/painter selection.

Version 2 additionally supports only the four existing Windows95/System7
`pressed` and `inactive` requests: `HiliteControl(10)` logical highlight or
`HiliteControl(255)` disabled control in an **active window**, respectively.
It binds the actual state API/hilite and excludes physical mouse gestures and
inactive-window claims. Normal v1 scope/digests and the two current records stay
unchanged; only the four new scope-bound request digests change. Four v10 records have separate evidence reviews; defining the scope alone
does not admit an observation.

Unknown font/patch/base/provider/cache fields may remain explicitly null with
reasons, while relevant installation, configured scheme, public invocation,
port/clip/background, indexed palette and producer evidence remain mandatory.
The capture/review bind the exact scope/version/exclusions. An eligible reviewed
record is a `reviewed-scoped-observation`; the whole request stays
`evidence-incomplete`, and all five requirement IDs remain unresolved.
Associated geometry/fill IDs are not whole requirements verified by one image.
See the [scoped observation contract](../../docs/spec/scoped-reference-observations.md)
for fields, artifacts and limits. Omitted scope or explicit `full` keeps every
old strict gate. Defining the scope alone approves no observation; the six
current records have separate [evidence reviews](./reviews.json).

## Intake and review

```sh
# Honest report: six scoped observations, seven missing requests, zero verified requirements.
npm run test:references

# Write a request template; no image or approval is generated.
node tests/reference-captures/run.mjs --template windows-95.normal > /tmp/intake.json

# Optional narrow unapproved template; exact face/full context remain mandatory.
node tests/reference-captures/run.mjs --template windows-95.normal \
  --scope public-api-empty-face > /tmp/scoped-intake.json

# After external evidence exists, validate it against separately reviewed records.
node tests/reference-captures/run.mjs --captures /path/to/intake.json \
  --reviews /path/to/reviews.json --output /tmp/reference-review
```

Image/log paths are relative to the intake JSON directory and must stay inside
it, including symlink resolution. PNG checks cover chunk checksums, decompression,
scanline structure, dimensions and complete-file hash. No original pixels are
rendered or image similarity tolerance invented. Output JSON/Markdown goes to
`test-results/reference-captures/` by default. Missing requests alone exit zero
(the repository has an acknowledged evidence gap); submitted partial, rejected
or unreviewed evidence exits nonzero. This is a metadata/intake gate, **not** a
historical fidelity pass.

The capture manifest and review manifest are separate. `captureTemplate()` and
`reviewTemplate()` in `contract.mjs` generate unapproved records; review checks
remain null. An accepted record requires a named reviewer distinct from the
producer, review time/notes, the exact capture and request digests, and affirmative
checks of original provenance, source/base identity, installation/patch stack,
conditions/transform, image/artifacts, and independence from Scriptoscope. Review
is limited to the request's named requirement IDs; it does not verify an entire
ledger case. Editing image, source, condition or provenance metadata invalidates
its attestation. A rejection remains visible; duplicate decisions must be resolved
explicitly rather than choosing the convenient one.

A supplied review file is a human-maintained trust input, not a signature or an
authenticated identity service. The validator cannot prove that a reviewer is
independent or that someone truthfully recorded an original session. Repository
capture/review additions require PR review of full evidence; a producer cannot
turn their own capture into evidence merely by passing a custom review file.
After eligibility, a separate reviewed comparison must establish exact obligation
scope, raw-art/geometry/mask/text layers and any explained substitutions. This
intake **never changes ledger statuses** and does not compare renderer output.

## Evidence categories and failure cases

`independent-original` records progress through partial, rejected,
awaiting-independent-review or reviewed-independent-capture on the full path, or reviewed-scoped-observation
on the explicit narrow path. Each request remains
missing/evidence-incomplete until an eligible full-scope reviewed capture exists; scoped observations appear
separately and leave all broader obligations unresolved. Unknown
request environment slots stay visible even when a particular observation fills
them; accepting that observation does not establish a historical default.

`qualitative-author-preview`, `scriptoscope-regression` and `synthetic-test`
records are classified separately. The repository currently contains 18 author
preview PNGs and 54 self-regression PNGs (36 option sheets and 18 scenes). The
synthetic availability/requirement fixtures are another separate category.
Known repository image hashes reject renamed preview/golden bytes submitted as
original evidence. This is a **contamination check, not authentication**: an
unknown or modified self-render can evade byte matching and still needs honest
provenance review. Known author attribution never supplies missing version,
geometry, text, palette or capture conditions.

Unit fixtures deliberately exercise the validator with synthetic temporary PNGs
and fictional review records. They are labeled TEST ONLY, deleted after each test,
never added to `captures.json`/`reviews.json`, and never used as reference baselines. Negative
cases cover missing pins/version/hash/conditions, mismatched state/rect/origin/
crop/scale/text, changed request/source identity, swapped image bytes, relabeled
selfgoldens/previews and absent/self/stale/rejected review. No count here is an
overall fidelity percentage or an assertion that the historical target is closed.


### Crayon normal scope v3

Only `crayon-os.normal` gains v3 of `public-api-empty-face`. It preserves the
fixed empty80×20/public normal invocation, full-port clip and recorded white
background. `patternOriginState` must be null with an explicit reason for this
scoped output; origin0 does not establish original phase or API availability.
Full-request phase requirements remain unchanged. The new applicable policy
section leaves v1/v2 captures, reviews and request digests exact.

### Native telemetry acquisition: verify the stopped-media export

A successful API return or visible UI result does not establish a complete telemetry export. Record requested and actual write counts, detect short writes, and record close, `FlushVol` and readback results as diagnostics. Then stop the environment and verify the actual exported bytes: complete expected length/content, hashes, and joins to the exact source, run and observed conditions. Runtime readback alone is not a substitute for that export.

The Lisa v15 attempt reported write status 0 while the stopped HFS file had EOF 0. Its v16 correction passed all File Manager checks with expected/written/readback EOF of 34,254 bytes, followed by an ordinary stopped HFS export of exactly 34,254 complete bytes. This is the observed corrected run, not a guarantee of future exports.

Data recovered from physical writes must remain explicitly labeled as recovered and quarantined pending separate review. Do not silently present reconstructed bytes as an ordinary complete file export.

This is acquisition guidance, not a new eligibility rule or a retrospective rejection of the seven complete exports already reviewed. Retain their existing evidence and scoped decisions unchanged.

## Lisa conditioned normal face (scope v4)

Only `apple-lisa.normal` adds a scoped observation: empty 80×20 at 20,20 in a
160×80 white port, with its separate same-run 22-tuple profile. The original
private resource/provider/cache and pattern state remain unknown. The modern
selected face/cinf bytes and missing ppat 0 observation are checked separately;
no whole-request or mask/phase claim follows. Prior scopes and records remain exact.

## Animals fixed-order acquisition batch

The three Animals candidates use the existing v5 requests and scope, with no
policy or request changes. One boot captures normal, logically highlighted and
disabled empty controls in that order. Each control is newly created, and each
ordinary HFS log is durable before the host frame is acknowledged and the next
control is created. The boot's OS/resource/cache history is shared; this does not
certify cold-cache or order independence. State 0's screenshot-path failure was
completed on the host from the retained frame before ACK, without another native
C or frame acquisition. Original images and timestamps remain exact.

A separate Animals calibration measures all 209 current whole-load inventory
RGB16 tuples twice. Index2Color results join the same-run positional palette;
palette, gamma, semantic device fields and producer core match the three-state
observations. Conditions bracket mapping after the calibration draw, while the
state logs bracket their fixture redraws; neither establishes private cache
identity or uniquely brackets the later host image. The calibration retains the
v16 font log format without widMax, whereas the state logs record widMax 14.
No complete cross-run font/provider identity is inferred.

Acquisition and measurement approval are distinct from scoped intake and actual
pixel comparison. See [the batch proposal](animals-state-proposal.md) and
`animals-calibration/measurement.json`. The prior 12 capture/review objects and
all 59 request objects/digests are pinned by `animals-retention.json`. No original
mask, phase, private provider, default state or whole-control claim is added.


## BeOS fixed-order observations

The three BeOS records reuse the existing v5 scope and fixed campaign requests.
Each retains its ordinary stopped log export, full raw/PNG equality, exact crops,
state/ACK sequence and canonical configured fork. Acquisition review, scoped
intake review and source/built comparison remain separate evidence steps.

The finite B278 version2 profile binds 278 RGB16 inputs measured twice and
three separately measured direct-RGB8 inputs. Zero-origin direct attribution
was declared from source and primary documentation before offline comparison.
That preparation permits complete theme conversion; pattern128 is not the
observed button body dependency. The three faces instead retain actual signed
face/cinf joins, same-owner ppat0 absence and completed paint dependencies.

Cross-run device palette, gamma, definition payloads and producer agree. State
logs omit portColorTable, while calibration omits widMax; neither full port-table
nor full font/provider identity is claimed. Fixed normal→highlighted→disabled
order and shared boot/cache history remain explicit. Only recorded opaque-white
composited output is verified; whole requests and broader conditions stay open.


## Shared307 six-source campaign

1138, Apple Platinum 2, Black Platinum, Platinum 8, Slimes and Windows 3.1
retain normal, logically highlighted and disabled empty faces from six separate
boots. Each environment has its own 307 RGB16 inputs measured twice; the shared
query list does not establish shared device/cache conditions or permit pooling
profiles. All 18 faces match source and reviewed built output in the private
comparison: 36 calls and 57,600 independently recomputed composited pixels.
Public CI repeats the scoped comparisons using distributable inputs and actual
completed-paint joins.

Four sources have no paired cinf: their modern completion is explicitly the
legacy compatibility face painter. 1138 and Windows 3.1 instead retain paired
cinf bands and actual same-owner ppat0 absence. The shared verifier follows these
resource identities rather than theme-name exceptions. Neither trace identifies
the original private painter.

Black Platinum retains a browser transport startup failure and prolonged idle.
Slimes retains an uncaptured default-scheme fixture launch, ordinary quit,
corrected scheme selection and a fresh fixture launch in the same boot. Neither
incident retried a captured measurement; both remain part of cache/draw history.
The older private 1138 profile's unobserved current/main-device equality assertion
was removed, with measured mappings, palette and producer unchanged. The complete
comparison uses the corrected profile identity; no native recapture was needed.

State portColorTable and calibration widMax remain absent. Current-device palette
identity does not establish equality with GetMainDevice. Original masks, phase,
font/provider/cache identity, order independence and whole controls remain
unknown. Acquisition review, scoped intake and actual public execution are
separate checks; no broad requirement or whole request is certified.

## Evolution empty-state addition

Only normal and inactive empty 80×20 faces are admitted. Their actual caller uses
font 0, size 0 and face 0; font identity remains unknown. Labeled states, native
font handles and post-capture font-query payloads are excluded from this corpus.
The 1,971-key profile retains actual repeated Color2Index measurements; calibration
used size 12 after the four-state sequence. Shared boot/history and missing
current/main-device, port-table, patch/cache and pattern-phase observations remain
explicit. The two public comparison rows exercise empty composition without a
caller-supplied font. Existing v5 authority and all prior records are unchanged.

## Monkey Paradise three empty states

The three `monkey-paradise.*.m288` records retain untouched full frames and integer
crops, scalar invocation/condition logs with payloads withheld, actual canonical
fork/FCB identities and durable ordinary exports. Existing v5 scopes and all
38 earlier capture/review objects and 59 requests remain exact. The finite profile
uses only the later same-boot 576 native queries, giving 288 repeat-equal mappings.
Consumer current/main equality and port ColorTable are unobserved; typography,
private provider/cache/phase/mask and whole-control fidelity remain unknown.

The normal modern comparison requires actual same-owner ppat128 occurrence459,
its catalog/load/URL and decoded plane, and completed `pattern-fill-union` writes.
This proves a modern intermediate stage, not original phase or provider. Pressed
and inactive requests retain missing ppat0 without inventing completion. The registered source/built pair passed all 41 faces and 65,600 pixels per mode;
independent root review accepted only three new output obligations. Scoped intake
and actual execution remain separate gates.
The private history retains six trace-rejected observations, four subsequent
offline validations and two modern normal followups; no native capture was retried.

## Floppies and Evolution pressed batch

Four additional v5 records cover Floppies normal/pressed/inactive and Evolution
pressed. The existing Evolution normal/inactive capture and profile bindings are
unchanged. Each selected scheme has its own actual calibration: 7,692 rows/3,846
keys for Floppies and 3,942 rows/1,971 keys for Evolution. The generic registry
selects the new Evolution profile only for pressed; no measured rows are pooled.

The [independent byte review](./floppies-evolution-independent-byte-review.json)
binds four original full frames, crops, ordinary exports and sanitized conditions.
The private comparison matched twelve calls and 19,200 pixels, including two
private Evolution controls. The public registered source/built pair passed all45 faces/72,000 pixels per mode
with zero differences. Independent root review accepted only the four new output
obligations; all broader claims remain unknown. Floppies corner10/side10 at height20
produces six nonempty face bands and no body height; Evolution has eight bands.
All four request absent ppat0, with no invented completed body-fill event.

Shutdown was requested; explicit worker/poweroff acknowledgement remains unknown.
No separate pre-export stopped-media copy was retained; immutable after-export
copies exist privately. Consumer current/main equality and port ColorTable,
original phase/provider/cache/font/mask and whole-control fidelity remain unknown.
No native font/query payload, engine binary, media or raw resource log is public.

Private recovery evidence is stored as `floppies-evolution-empty-batch-20261020`
in the maintainer asset store, commit `5b78f6be5c8d757744c49738264b5c3f90507827`.
The archive SHA-256 is `a401622fa96b43eacd9ca13bae2cc5e8fab9a2d140b7743744584b79a090c402`;
a fresh selective LFS restore verified all 550 regular files and two symlinks.
This locator supplies private recovery, not additional public admission.

## Compact evidence format (compact-json-v1)

Committed evidence holds only what tests read, once, compactly. The registry
[`tests/compact-evidence.json`](../compact-evidence.json) and helper
[`tests/helpers/compact-json.mjs`](../helpers/compact-json.mjs) define three
mechanisms. None changes a recorded sha256, capture/review digest or assertion:

- **Layout.** `compact-json-v1` is valid JSON with LF, 2-space indentation and raw
  UTF-8. Arrays of primitives stay on one line. Any other array/object is inline
  when its minified form is ≤120 characters, otherwise one member per line. As a
  result each profile mapping, palette entry or measured row takes one line.
  `formatCompactJSON(value)` is the canonical writer.
- **Migrated identities.** Files that were already bound by byte sha256 (captures,
  ledger, recorded-case registry, profile bindings) are stored compactly and
  registered under `compacted` with their exact original encoding, bytes and
  sha256. Byte checks read through `readOriginal`/`originalBytes`, which re-encode
  the parsed value and require it to reproduce the registered original identity.
  The lookup is content-addressed, so any semantic edit yields unregistered bytes
  and fails every existing check. JSON readers parse the compact file unchanged.
- **One copy.** A byte-identical duplicate is removed and listed under `aliases`
  with its single retained copy (measured profiles live in `tests/decoder-fixtures/`).
  The intake validator follows an alias only for the repository corpus, never for
  an external intake directory.
- **Private raw evidence.** Unread raw evidence (calibration full frames, durable
  status screenshots) is listed under `external` with sha256, bytes and its
  Forgejo asset/commit/archive/member locator. Files that any check reads, such as
  capture artifacts the intake validator hashes or inspects, stay committed.

Write newly derived files (prepared profiles, capture manifests, bindings) in
`compact-json-v1` (`node tests/helpers/compact-json.mjs --write <file>…`) **before**
their first sha256 is recorded, so no registry entry is needed. Some files' sha256
is already sealed in a private `FILES.json` or review, for example members of the
nine-state acquisition. Keep those private and reference them by sha256. If a
committed copy is needed, either commit the exact bytes or register it under
`compacted`. Never rewrite one unregistered. Commit one profile per
measured run, in `tests/decoder-fixtures/measured-display-profile-<x>.json`. A
capture artifact naming the prepared profile should use an alias instead of a second
copy. Keep raw measurement dumps, logs and full frames that no test reads in the
private asset store and reference them by sha256.
Only add `compacted` entries when migrating bytes that are already bound. Never
re-encode a file without registering its original identity.

## 1984, 1990 and Dolphin empty states (compact batch)

Nine v5 records (`<slug>.<state>.j1223`) come from three separately booted
environments, each running the A3A consumer (fresh controls, HiliteControl
0/10/255), CIcon Rank Probe and Joint1223 calibration once. They are the first
batch stored in the compact format: committed per record are only the request
port image, full frame, sanitized capture log and the small JSON manifests the
validator binds. Each environment's palette and producer table are byte-identical
to the earlier calibration copies, so their per-slug paths are aliases of the
`1138-calibration` files (same bytes and sha256; the record bindings are
unchanged). The profile artifact is an alias of the single `tests/decoder-fixtures`
copy.
Crops, status screenshots, raw logs and calibration rows stay private, listed by
sha256 in [`nine-state-evidence.json`](./nine-state-evidence.json). Face crops
derive from the logged global origin and control rect, not a literal.

The 1990 and Dolphin state faces are pixel-identical (their state cicns differ
only in the unused title-colour pixel), so they do not discriminate state
selection and count as one face art under two environments. The finite transfer
data bound to each load concerns a slider tick or checkbox, not the face. Native
shutdown acknowledgement, provider/cache/patch order, mask/phase/font, whole-port
equivalence, consumer port table/widMax and cold-cache independence stay unknown.

The 1984 face comparisons are state-discriminating: a wrong state face would fail.
Original hilite→cicn selection remains unknown for all nine. The sealed
`nine-state-evidence.json` limit still reads "Only 1984 demonstrates hilite->cicn
selection". It is left unchanged because its sha256 is bound in the nine reviewed
capture records; this paragraph and the ledger give the narrower reading.

The records' `captureMethod` says "No modal/retry". It means zero *native* retries
and no modal dialog. Two disclosed details fall outside that wording. In 1984,
initial fast clicks opened no menu and paced mouse input was used before capture,
and a non-modal Kaleidoscope instruction window is visible in the consumer frames,
outside the port (visRgn stays rectangular and the target is `FrontWindow()`). For Dolphin, the field also
omits the post-measurement CRP status mirror inside the port. Both are recorded in
`nine-state-evidence.json` (`schemes.1984.closure.preCaptureHistory`,
`schemes.dolphin-som.closure.statusMirror` and `limits`). The digested
records are not rewritten; changing the field would alter each captureDigest and
need a new review.
