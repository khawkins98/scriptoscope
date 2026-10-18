# Independent reference capture intake (draft 0.1.0)

This is a finite request and review contract for [#190](https://github.com/khawkins98/scriptoscope/issues/190),
under the [draft compatibility target](../../docs/spec/fidelity-compatibility-contract.md).
**There are no original captures or capture approvals in this initial corpus.**
The twelve requests are provisional experiments, not historical default sizes,
complete control coverage, or an acceptance denominator. Intake never runs the
original engine, invokes Scriptoscope to produce references, or certifies fidelity.

## Requested first batch

| Scheme | Requests | Purpose |
|---|---|---|
| Windows 95 | normal, pressed, inactive, default | Empty-label body/state and default-ring reference |
| System 7 Nostalgia Silver | normal, pressed, inactive, default | Same explicit inputs on a second target |
| Apple Lisa | normal | Unequal corner4/side1 face |
| 1990 | default | Unequal corner7/side14 ring bands |
| Crayon OS | normal at port origins (0,0) and (3,5) | Pattern-bearing body and phase |

Every request specifies an empty label, an **80×20 control Rect at (20,20)**,
white background, an active window and native 1:1 pixels. “Inactive” here requests
a **disabled control in an active window**, not an inactive window. “Default” is
normal/enabled with the original default mechanism engaged; its actual mechanism
must be recorded. Pressed requires the original pressed condition, not a renamed
normal screenshot. No CDEF number, hilite byte or rendering flag is inferred from
these logical names: record the observed original invocation and have it reviewed.

The full capture is 160×80 pixels. The requested crop is port Rect (12,12,96,36),
leaving context outside the nominal face and possible ring. Image coordinates are
`portXY - portOrigin`, so the shifted Crayon crop is image Rect (9,7,96,36), not
(12,12,96,36). These are explicit **experimental coordinate requirements**, not a
claim about historical pattern arithmetic. Keep the full image as evidence; do
not trim alpha/opaque bounds, rescale, rotate, resample, recolor or crop away an
unexpected artifact. If the original environment cannot meet a request, revise
and review the request instead of relabeling a different capture as a match.

`requests.json` is authoritative for exact inputs. It references the existing
[source-choice registry](../control-availability/source-choices.json); it does not
create a competing source catalog. A request digest includes its version/content,
source entry/archive/fork pins and selection-review status, compatibility version,
ledger version and engine component pin. These draft source choices identify
requested bytes; they do **not** approve historical Resource Manager selection or
which provider owned each resource. The known kDEF0 2.3.1 hash identifies one
component, not a full engine installation, PACH stack or original OS.

## Unknown original conditions must be supplied

The templates leave OS, installation, patches, bases, original provider search
order, font, palette and capture pipeline **null**. No Mac OS version, base theme,
Charcoal/Virtue substitution, palette or patch configuration is silently assumed.
A capture becomes eligible for independent review only after its producer records:

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

## Intake and review

```sh
# Honest repository report: currently twelve missing requests, zero approvals.
npm run test:references

# Write a request template; no image or approval is generated.
node tests/reference-captures/run.mjs --template windows-95.normal > /tmp/intake.json

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
awaiting-independent-review or reviewed-independent-capture. Each request remains
missing/evidence-incomplete until an eligible reviewed capture exists. Unknown
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
