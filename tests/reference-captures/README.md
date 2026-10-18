# Independent reference capture intake (request draft 0.2.0)

This is a finite request and review contract for [#190](https://github.com/khawkins98/scriptoscope/issues/190),
under the [draft compatibility target](../../docs/spec/fidelity-compatibility-contract.md).
**Six original observations have independent AI review under the narrow
`public-api-empty-face` scope.** They do not satisfy any whole request or
verify any requirement. Seven requests remain missing; all six observed
requests remain evidence-incomplete. See [original observations and limits](./ORIGINALS.md).
[Six quarantined v4/v5 observations](../../docs/research/original-observations/2026-10-18/README.md)
and [four v6 default-dialog observations](../../docs/research/default-dialog-observations/2026-10-18/README.md)
are preserved separately. They are not admitted here and do not satisfy any request.
The thirteen requests are provisional experiments, not historical default sizes,
complete control coverage, or an acceptance denominator. Intake never runs the
original engine, invokes Scriptoscope to produce references, or certifies fidelity.

## Requested first batch

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
create a competing source catalog. A request digest includes its version/content,
source entry/archive/fork pins and selection-review status, authoritative compatibility
document ID/version/full-file SHA-256, ledger version, exact target requirement
wording and engine component pin. Source-registry/ledger paths are also checked
against their existing authorities.
The compatibility document is the single identity/version authority: request pins must match its authoritative header. Even an unversioned document edit invalidates prior request digests;
reviewed document changes still require a version increment. These draft source
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
