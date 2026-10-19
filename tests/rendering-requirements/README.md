# Partial rendering requirement ledger

`ledger.json` is reviewed acceptance data, separate from rendering and screenshots.
Inventory 1.5.1 declares thirty exact direct cases and seven explicit dimensions per
case. **Every case has OPEN inventory closure.** The declared obligation
count is a finite bookkeeping denominator, not an exhaustive denominator of
historical control behavior. No whole-control completion percentage is reported.

Run `npm run test:requirements` for offline validation and a Markdown/JSON report
under `test-results/rendering-evidence/requirements/`. Offline issue liveness is
explicitly unchecked. CI uses `--check-issues --require-execution` after the
browser suite: mismatch issues must still be open, and all registered source and
built assertions must have run successfully at the current execution commit.
The live issue check is read-only and fails closed on network/API errors.

The reviewed status vocabulary is `verified`, `mismatched`, `unsupported`,
`unknown`. Unsupported and unknown requirements remain in the denominator.
A case becomes verified only if its inventory closure is explicitly reviewed
closed **and every declared obligation is independently verified**. Open cases
remain unknown even when all currently listed obligations pass. Known mismatches
and unsupported requirements remain visible at case level.

## Changing requirements and evidence

1. Declare exact inputs/options/base chain and all applicable dimensions before
   assessing the case. The seven dimensions are scaffolding, not a claim that
   we have discovered every historical behavior. Add specific unknown obligations
   whenever the source model is incomplete. Exclusions require a reason and review;
   a nonempty label cannot exclude typography. Substitutions are explicit.
2. Cite original archive bytes or a precise source decode. Record original version,
   exact input digest, file offsets/resource coordinates, claim and limitations.
   `EVIDENCE.md` identifies the locally fingerprinted original kDEF0 plus its
   extraction recipe. CI does not ship or execute the original engine. Evidence
   locators have excerpt hashes, so unrelated prose edits do not invalidate them.
3. Register a stable executable assertion ID, marker and exact case coverage.
   Annotate its actual browser test with `fidelity-assertion`; the dedicated
   reporter records test result, source/built mode, project and execution commit.
   A test can assert additional project policy without independently establishing
   that policy as original behavior. For example slider opaque-art retention is
   verified, while decoder/state mapping/historical placement/mask remain unknown.
4. Obtain independent review of each status change. Passing tests, goldens and
   runtime observations never promote an unknown requirement automatically.
   `verified` requires independent evidence and an assertion for that exact case.
   `mismatched` requires a live issue. A runtime-fix PR must update linked mismatch
   assessments and evidence **before the issue closes**, or the live CI gate fails.
   If only part of an issue is fixed, retain the remaining mismatch/unknown scope.
5. Bump `inventoryVersion` for reviewed obligation/scope changes and recompute
   `inventorySha256` using exported `inventoryDigest`. Changing a count to improve
   a completion metric is not a valid review. Review closure separately from
   individual assertions; the initial inventory is intentionally open.

## Reports and execution evidence

The JSON and Markdown reports separate requirement status, case status/closure,
exclusions/substitutions, and observed execution. The browser reporter writes to
`test-results/rendering-evidence/requirements/execution.json`; absent results are
**not run**, stale commits are ignored, and failed/incomplete runs are not passes.
Dirty or unknown worktree cleanliness is untrusted and reported as not run, both
locally and in CI. Git checks actual tracked edits and untracked source while
ignoring generated ignored outputs; no CI cleanliness value is assumed. The
observed test path must match its registered assertion path as well as ID/mode. A later
golden invocation does not erase the contract assertion evidence.

Regression observation files are listed separately, including observed case
counts/statuses when supplied. They are not an independently established source
availability inventory. Lack of an observation is not proof that art is missing.
PNG hashes and baseline provenance stay with the separate regression goldens.
The JSON report includes exact input/evidence identities and all assessments;
the report does not claim the independent assertions test every case in the
70-case smoke matrix.

The validator's negative tests cover disappearing obligations, invalid evidence,
wrong assertion scope, changed inputs, closed tracking issues, and stale/missing
execution evidence. Tests deliberately exercise trust boundaries instead of
reimplementing the control compositor.

Inventory 1.0.1 aligns Lisa with the exact 80px-wide, 20px-high empty normal
input covered by the merged #233 corner oracle. Only that geometry assessment
changes from mismatched to verified; all eight inventories remain OPEN.

Evidence used by an assessment must share at least one named non-engine input
with that exact case's `inputs` or `baseInputs`. Engine-only source rules can
apply generally. A combined source-art note can support multiple cases whose
inputs it explicitly names, such as the two tab sources. This guard rejects
wholly unrelated archive/fixture evidence; it does not authenticate all options,
resource coordinates, base ordering or the completeness of the source claim.
Those still require independent review and exact executable coverage (#274).


Inventory 1.1.0 adds eight direct text/pattern cases and 83 obligations, preserving
all original eight cases and 51 assessments. Its 134 declared obligations include
24 verified requirements, two known tab mismatches and 108 unknown requirements;
these counts do not measure whole-control fidelity. Five source/built assertion
registrations bind the new finite claims to actual selected IDs/owners and cases.

Authored text verification covers selected raw RGB16 samples and their consumption
under the current declared display transform. The masked fixture additionally
checks emboss-before-foreground and (+1,+1) at fully opaque or empty pixels of an
independent browser-font mask. That mask is not an original glyph oracle; font,
metrics, transfer, antialiasing, destination palette and device color stay unknown.
Push cases do not declare a `small` option; only small-bevel cases do.

The 29×9 synthetic pattern case checks every pixel against literal rows. The
37×16 default-buffer case checks two interior samples and four clip/ring sentinels,
with the face origin separate from the four-pixel buffer reservation; remaining
raster/mask behavior stays unknown. Its diagnostic 5×3 tile is not an eligible
original resource. The real Crayon case checks three pinned selected-source
samples. Seven original selection/geometry/fill/device/state/placement/port
obligations remain unknown in each pattern case. No capture, golden or managed-port
integration is promoted by these direct source-model checks (#274).


Inventory 1.1.1 changes only the two existing 1138/1990 `AgjpQy` tab
`tab.full-raster-coordinates` assessments. The independently pinned CDEF 8
contract and exact source/built body-coordinate assertion support that requirement;
all 132 other assessments and all case declarations remain unchanged. Counts are
26 narrowly verified, zero mismatched, and 108 unknown, with all 16 closures OPEN.
This is not zero defects or whole-tab verification: original selection, fonts,
transfer/device behavior, complete geometry and pattern-center handling remain
unknown. Catalog byte bindings identify expected source art, not a tab paint trace.

## Inventory 1.2.0: two selected solid-background cases

The extension preserves all sixteen prior case objects and 134 assessments. Two
exact empty-label synthetic cases cover masked push and opaque palette-collision
bevel backgrounds. Their single new requirement includes the actual selected
owner/load/occurrence/payload join, declared current same-owner pattern miss,
raw RGB16 sample consumption under the existing LUT, and complete 29×9 literal
solid union. The other 46 rows in the same browser test do not extend inventory.

Independent automated root/Astra review approved the exact finite extension on
2026-10-18 (draft scope digest `16a76c6c2c2343d378d626ffc8bf954b11a32cb5a2015718cb2ce7dd917893a0`).
Reviewed counts are eighteen OPEN inventories and 150 obligations: 28 narrowly
verified and 122 unknown. Original resource ownership,
remaining geometry/fill, state mapping, placement/port and device color stay
unknown. Empty-label typography and direct-only interaction are explicit scoped
exclusions. No original capture, golden or whole-control status is promoted.


## Inventory 1.3.0: finite whole-header and sampled-band obligations (#301)

Four exact synthetic cases add 45 obligations while preserving all eighteen
prior cases and 150 assessments. The proposed applied inventory contains 36
narrowly verified, one unsupported and 158 unknown requirements; every case
remains OPEN. No original capture, complete surface or device-color claim follows.

Two c2/s3 whole-header cases exercise the ordinary full-plane and clipped
list-view rectangles. The clipped case observes body through top-band mask holes
and retained top-band pixels only; it does not observe cropped side overlap or
partial tails. Its retained row10 x8/x9 does distinguish bottom extension: an
ordinary-height output paints tokens7/6 there, whereas the list-view output keeps
body RGB48. The negative verifier substitutes those actual ordinary pixels while
leaving trace metadata unchanged, and separately corrupts the reported height.

The collision header remains explicitly unsupported for sampled-line color.
Its assertion establishes the API's rejection/no-paint policy, not original
unavailability. The collision push case establishes only two sampled gray pixels
and an ordinary red corner, with selected dependency joins to actual owning
load/resource occurrences and independent serialized cicn/cinf payload pins.
No original Resource Manager selection claim is inferred from those joins.

Three assertion registrations select exactly these four rows. Their negative
mutations cover wrong invocation/context, literal pixels, owner/load/key/ID,
occurrence, payload/fork, missing/duplicate rows, sampler branch and false paint
claims. Other renderer matrix observations do not extend these obligations.
Original font, broader state/fill/geometry, port conditions, device conversion
and native interaction remain unknown even for empty/direct synthetic cases.

## Recorded-condition comparisons

Six additional OPEN cases pin explicit measured-profile DATA/id, source bytes,
80×20 empty nondefault options and original intake/crop/white background. Only
`output.recorded-composited-face` is verified; five broad original obligations
per case remain unknown. The existing six-render source/built test compares all
1600 pixels and joins actual completed modern paint, including System7 legacy
compatibility paint. That trace is not original painter attribution.

`scoped-original` evidence is accepted only through current reviewed-scoped
reference intake and exact case bindings. When authority/ledger versions change,
freeze authority text first, recompute requests/capture digests, obtain explicit
metadata-only review amendments, then bind evidence and inventory hashes. Do not
put those resulting hashes into the authority document or broad request targets:
that would create a digest cycle. Original artifact/condition bytes stay unchanged.

## Prepared-strike SOURCE scope (1.5.0)

Two existing direct push renders register three finite obligations each: exact
caller-declared synthetic strike identity, source-metric signed pen and literal
mask paint. The X/space DATA and expected coordinates are independent of runtime
layout helpers. Automatic local sizing is a compatibility policy; the negative
origin/overhang case uses an explicit synthetic clip. Full clipped nontransparent
pixels and automatic nonwhite opaque pixels are checked; occupancy records describe
mask stages before foreground overwrites. No original font/provider, transfer,
device, port or typography claim follows. Existing lifetime tests remain guards.

All thirty inventories remain OPEN: 257 obligations, 48 narrowly verified, one
unsupported, 208 unknown. The previous 28 cases/231 assessments and requirement
definitions retain their semantics; only six recorded-comparison digest bindings
are refreshed after authority 0.1.11 freezes. Request definitions/artifacts remain
unchanged. Independent metadata-only amendments are required before intake passes.
Actual source/built markers, exact test path and clean current execution remain
necessary; dirty or missing evidence is not run.

Inventory 1.5.1 refreshes only recorded-face request/capture digest bindings for
the reviewed semantic-digest migration. All thirty cases, 257 assessments and
requirement definitions are unchanged. Global provenance versions no longer
force reference re-attestation; original artifacts and earlier reviews remain
exactly preserved.


## Crayon recorded output (1.6.0)

One additional OPEN case compares the empty normal Crayon face under the
separately pinned v14c profile. Existing source/built renders gain one row with
explicit controlOrigin20,20, portOrigin0, unknown patternOrigin and full-port
clip. The complete1600 composited pixels, face/cinf/ppat byte identities and
completed face output must agree; selected pattern metadata is not occupancy
proof. All prior30 cases/257 assessments and requirement definitions remain
exact. Totals:31 OPEN,263 obligations,49 narrow verified,1 unsupported,213 unknown.
No original phase/mask/provider or general body claim follows.

## Lisa recorded output (1.7.0)

One new OPEN direct case compares the complete recorded 80×20 empty normal face
under its same-run 22-tuple profile. Source/built execution must join the exact
scope-v4 capture, selected face/cinf payloads, completed face paint, explicit port
context and modern no-ppat 0 observation. The original provider/cache/pattern state,
mask and broader requirements remain unknown. Existing 31 cases/263 assessments
and definitions remain exact. Totals: 32 OPEN, 269 obligations, 50 narrow verified,
1 unsupported,218 unknown. Eight recorded-condition comparisons remain separate
from SOURCE requirements and never close cases.
