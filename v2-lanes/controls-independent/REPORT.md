# #459 independent controls candidate

This is independent test-author material for PM and a DIFFERENT Tier-2 reviewer.
Do not forward it, its rule tables, assertions or mutation harness to runtime authors.
Only the safe input / expected / actual behavior findings have been sent to PM.
The initial author freeze is `8e304e49839b93d0d5f8f66e85950b88e10eb72a`.
No runtime, loader, spec, evidence appendix, CHANGELOG or ledger-status edits are owned here.
Native glyph, device, transfer and historical provider equivalence remain UNKNOWN.

## Oracle and assertion scope

`tests/rendering-options/controls459-rules.mjs` transcribes the reviewed safe
`docs/spec/engine/push-button.md` PB1–PB13 / DR1–DR6 and
`docs/spec/engine/checkables.md` CB1–CB24 / all six icon rows. It imports no runtime
code, tables or rendered output. `qd-primitives.md` supplies B/E/S dependencies.
The executable row registry binds all 43 rows to named discriminating checks.
No source-backed expectation was obtained from a current renderer screenshot.
The fixture PNGs/rasters are inputs; they do not establish native rendering.

The independent assertions cover disabled254/255 precedence, alternate checkbox
versus radio conversion in both lanes, signed state IDs, NULL versus UNKNOWN,
original-value reread, same-tier mixed fallback, repeated mask request, no
normal-tier/unchecked retry, mask-owner-only color lookup, no ics4 substitution,
all-set/partial masks, picture/custom transfer asymmetry, and hidden opaque color.
They cover visibility/recorders, face/emboss/text/ring order, art versus metadata
NULL, fallback0/1, ring body=false with poisoned sampler, RGB16 sentinel/equality
and display collisions, mask-clear samples, missing exact points, negative/odd
geometry, complete source/storage bounds with positive/negative origins and mask
holes, metrics/clip, empty/interior/final CR boundaries and unsupported lowDepth.
Mode5 uses a deep opaque source on the whole s-inset; its absent body erases only
the R1/R2 union. Adapter nearest-neighbor scaling remains modern policy.

`controls459-resources.test.mjs` separately exercises malformed, duplicate and
raw-but-undecoded cicn/color inputs, exact occurrence mismatch, legacy declared
input behavior for other families, finite sample snapshots and replacement assets,
URL ownership/release, pre-abort and pending disposal, plus explicit cinfBodies=[]
opt-out versus a selected typed body preload. It retains the two originally failing
occurrence regressions, which pass after the separately authored preparation repair;
neither assertion was converted to skip/todo and runtime was not self-edited.

`controls459.spec.mjs` drives the real public source and built entry points over
all 18 archives (360 composition rows per mode), checking signed selection and
request order against the independent table. It also has a separately derived
literal prepared-environment cross-union plane, explicit NULLs, environment object
identity, no-ring/no-base/mode5/display boundaries, bitmap pen/glyph placement,
browser substitution policy, and a poisoned unnecessary local raw-body preload.
Exact native browser/bitmap glyph equivalence is not claimed.

`loader-parity.mjs` compares public source/built/standalone loader outputs on an
owned literal typed fork, explicitly verifies each [] companion/raw-cinf opt-out,
raw owner/occurrence census, complete bounds of both signs, masked versus opaque
alpha planes, and exact-point sample presence. The packed npm consumer independently
installs the actual tarball and uses its own production browser bundle.

## Three obsolete primitive assertions

The original three failures are preserved in external `frozen-primitives.log`
and `frozen-primitives.exit` (exit 1). The replacements are independently retraced:

* B2 `0x109ea..0x10a00` is an icon blit into inset(D,s,s), independent of c;
  I1–I3 distinguish the deep opaque companion. It is no longer an unimplemented Q6.
* E4 `0x10cee..0x10cfc` uses the whole middle strip forward. W6/c2 produces
  source columns [2,4), hence destination samples 30,40,30,40,30,40.
* B0 skips body resources AND all source color outputs on the ring path;
  `0x1089e..0x109aa` is inside the body-enabled gate. The replacement poisons the
  ring sampler and separately preserves positive face sampling assertions.

Only `src/engine/qd/cinfFrame.test.mjs` was edited in the primitive area.

## Mutations and regression traces

Ten isolated process-only runtime/oracle mutations have valid positive controls:
wrong push state; disabled254 precedence; ring outset; original-value reread;
color/custom-bottleneck branch; ring sampling; raw sentinel; source/storage origin;
mask-request multiplicity; and an independently wrong oracle state mapping.
Each requires an ERR_ASSERTION in its named target, exit1, no timeout/signal/spawn
error, and no missing mutation token or import failure. An intentional setup
failure is explicitly rejected as a killed mutant. Raw control/mutant transcripts
are in external `mutations/`; no on-disk runtime source was mutated.
The first broken recursive Node test harness attempt is retained separately and
is NOT counted as mutation evidence.

New seed IDs for the PR line: `engine-diff: pushButton, checkables`.
`pushButton` has 432 cells, `checkables` 2304: every archive, state, mixed/value and
alternate setting, odd/small/public-size boundaries and default-ring choices.
Source-ID guards come from the independent table. The new Node corpus adapter
reads full bounds from actual selected fork bytes rather than inheriting the
known public missing-origin defect. These seeds are regression trace evidence,
NOT original/source pixel oracle proof. Earlier draft seed receipts are retained.
No existing family's cases, expected entries or baselines were changed.

## Binding audit

The read-only historical loader reconstructs pre-migration conversion at
`23c8048b`, in memory, with no second checkout edits. Expanded old core observations
reproduce the committed binding inventories. Across all 18 archives:

* The default core recipe's complete sources/resources/assets/manifests/envelope
  are unchanged; the binding artifact update changes only three toolchain hashes.
* Each previous public asset path retains exactly its dimensions and RGBA digest.
* Exactly 422 additive opaque planes are reported separately; these are real new
  asset planes, not a claim that the public asset inventory stayed identical.
* Removing only newly added engineColorSamples, boundsOrigin, authorized iconBlit
  fields and the documented new raw cinf IDs recovers every prior public manifest.
  Existing versions of those fields are compared, never stripped.

`binding-audit.json`, expanded old/new observations and command receipts are
outside the checkout in the durable receipt directory. No blind hash blessing,
source identity change, asset replacement or envelope reduction was accepted.

## Confirmed blocking behavior on the initial freeze

1. A decoded cicn occurrence can disagree with the unique raw same-ID census
   occurrence and still be accepted instead of UNKNOWN.
2. Finite raw samples can survive a replaced occurrence at the same asset path,
   dimensions and display policy. Those facts alone do not establish identity.
3. Ordinary public loading omits checkable cicn full-bounds origin; 156 cicn-lane
   public composition rows fail in EACH of source and built mode.

The first packed-consumer timeout was diagnosed: its finite-transfer precondition
applied one masked expectation to both the existing masked plane and the new
opaque companion. The fixture now independently asserts exact path identity,
RGB, dimensions, distinct alpha expectations and exactly one emission of each.
With this corrected precondition, the installed consumer proceeds to mount and
fails with 2 promoted controls rather than 3, with the same explicit missing-origin
error. Neither generic timeout nor navigation failure is mutation-kill evidence.

## Receipts and review state

All commands retain their own exit status and output under:
`/Users/khawkins/orca/worker-receipts/v2-lanes/459-controls-independent/`.
`run-command.mjs` records argv, head, start/end, status, signal, error and log path;
no pipeline masks command failures. Original setup/harness failures are retained.
The initial preexisting npm lock edit was preserved as
`preexisting-package-lock.patch` and the frozen lock restored before validation.

Pinned Linux uses the repository's required Playwright image digest and
linux/amd64. Old sheets are retained in `goldens-old/`; partial recording outputs,
failed-capture artifacts and own-exit receipts must survive any later repair run.
Partial icon-only sheets are UNAPPROVED CANDIDATES. Missing/failed cicn pages are
not blessed. A DIFFERENT Tier-2 reviewer and actual production demo visual review
are required; neither is performed by this test author. No status is promoted.
The final exact-head lane receipt is external so recording it cannot dirty or
move the tested commit. Final command results and any repair integration are
listed in the addendum below.

## Initial-freeze checkpoint

Before integrating any repair: primitive+rule checks pass (34/34); ten mutations
plus setup-failure rejection pass; two resource occurrence regressions fail;
engine-diff against the exact frozen author head passes with only the two new
families declared. Public corpus source/built each retain 156 missing-origin
errors, while the independent declared-environment/bitmap/display tests pass in
both modes. Source/built/standalone loader outputs and all three [] opt-outs agree,
but each fails both signed-origin cases (six missing-origin assertions total).
The packed consumer advances beyond its corrected finite-plane precondition and
fails promotion on that same origin prerequisite.

The first pinned Linux record exits 1: 26 failed pages and 10 passed pages in
13.6 minutes. `goldens-recorded/` retains the complete directory with explicit
per-sheet recorded status in `png-comparison.json`; 26 files there are retained
old originals, NOT completed candidates. Ten changed sheets have old/new/diff
planes and are unapproved partial candidates. The checked-in goldens were
restored after archiving; PM expressly deferred verifying this incomplete set.
No missing page is represented as a new successful capture.

PM then authorized integration of a separate frozen cleanroom preparation repair
`fc5e96956b0541657f615602ac45aefb35a2b152`, limited to theme resource preparation,
convert metadata and types. Runtime edits remain owned by that author. Subsequent
receipts distinguish this integration from the initial-freeze failures.

## Frozen repair integration checkpoint

The initial independent checkpoint is `b4316ef3`; merge `734bc8fb` incorporates
only the separately authorized `fc5e96956b0541657f615602ac45aefb35a2b152` runtime
freeze. Tests now supply the documented shared occurrence object in their valid
positive fixtures. The stale-occurrence negative still changes only the selected
occurrence while retaining old sample ownership; copied census and foreign
provider references are separately rejected. The original failures and first
post-merge invalid legacy-fixture setup are preserved, not counted as new kills.
No NULL/UNKNOWN gate or runtime binding check was loosened.

After this integration: all four independent browser source/built tests pass;
resource assertions pass including the original two regressions; the actual npm
installed consumer and all three package negatives pass; source/built/standalone
loader parity, both signed full-bound origins and every [] opt-out pass. The
repaired engine-diff check passes against the original author freeze with only
`pushButton,checkables` declared; no baseline re-seed was needed for this repair.

The repair adds `cicnSource` identity metadata to default core manifests as well
as public manifests. A second expanded audit removes only that newly added
preparation metadata in addition to the earlier documented fields, recomputes
catalog/manifest hashes from recovered values, and recovers the ENTIRE prior
binding structure. All existing asset planes are unchanged and the 422 public
opaque companion additions remain separately enumerated. The regenerated binding
artifact now includes those audited additive metadata hashes; it is no longer
merely the initial three toolchain hash changes. Detailed repaired recovery is in
`binding-repaired-audit.json`, and reconstructed initial recovery is in
`initial-binding-structural-report.json`, both outside the checkout.

## Coherent candidate and residual blocker

The final ordinary-corpus pinned Linux recording from `11883e85` passes all 36
pages (7.6 minutes). It is distinct from the initial incomplete recording.
`goldens-final-recorded/`, `png-final-comparison.json` and its diff PNG directory
retain all old/new/diff evidence. All 36 sheets change; sheet heights change with
the control allocation, so diff maps use top-left alignment with transparent
padding to the maximum extent, never scaling. Magenta marks any changed RGBA
pixel; raw old/new source PNGs are retained alongside size and SHA256 identities.
These are UNAPPROVED CANDIDATES, even after exact verification succeeds.

Broader unit validation exposed two additional obsolete test assumptions. The
unsigned-name alias expectation in `src/controls.test.mjs` contradicts PB5–PB7's
signed identity and declared archive/base lookup, so its expected owner is now
the base signed resource. The new family's exact 432-cell grid cannot satisfy the
old generic >1000 guard; the new 432/2304 grids receive exact count assertions,
while every existing family's >1000 requirement is unchanged. Empty expected
files register ONLY the two newly seeded families; no existing blessing changes.
The earlier failed broad/harness runs are retained; both targeted replacements
pass independently. The final exact-head lane performs the complete current suite.

One residual blocker was found after the preparation repair and explicitly
accepted by PM for separate follow-up: non-NULL typed UNKNOWN cicn + valid same-ID
cinf reaches `cicn.width` and throws TypeError rather than preserving an explicit
unsupported/UNKNOWN diagnostic. No alternate state is borrowed in the probe, and
native malformed-resource pixels remain UNKNOWN. Runtime was not self-edited.
PM requested its regression outside the ordinary candidate suite so the coherent
ordinary-corpus record/verify can finish without hiding this blocker.

Portable private regression:
`/Users/khawkins/orca/worker-receipts/v2-lanes/459-controls-independent/push-unknown-regression.test.mjs`.
Run it with Node --test from any candidate checkout root. It pins valid decoded
art + same-ID cinf as a passing positive, proven NULL + same-ID cinf as a second
passing positive, and two named explicit UNKNOWN/unsupported propagation assertions
for the face and pressed ring as failing negatives. `residual-unknown-regression.json` records exit1; the
negative fails an ERR_ASSERTION caused by the TypeError, with both positives
passing. Its test/oracle material must not be sent to runtime authors; only safe
behavior facts were sent to PM. A green ordinary lane does not resolve this defect.

The portable v2 regression and hash are retained separately. Independent v3
adjudication accepts `unsupported` alongside `unspecified` and `unimplemented`
as explicit diagnostic fields: the field spelling is not the source oracle. Both
negative cases now require an explicit `unknown` trace status and their exact
original ambiguity reason, as well as that same reason in the unsupported
result. No generic exception or absent-trace pass is accepted. The two positive
controls still pass on `5f5ea033`; both negative assertions still fail on the
original TypeError (`residual-unknown-regression-v3`, exit1). V3 SHA256 is
`3de51c46cfef03eeb9935694291b3129f664aefd5d7b02ea38497b27e5fcb420`.

The PNG comparison parser now counts only successful capture lines, excluding
failed-test summaries. Recomputed initial evidence identifies only 10 captured
pages and 26 retained old pages; final evidence identifies all 36 captures.
This corrects evidence attribution without changing any PNG or pixel diff.

## Frozen engine UNKNOWN repair and public boundary

PM authorized frozen pushed `6f2c75273f593237d6c0067754209a5890cf485c` only after
current Linux verify settled. Verification on `5f5ea033` completed exit0, all 36
pages (21.5 minutes), before that integration; record provenance remains
`11883e85`. Neither command was replaced or re-seeded. The frozen repair merged
at `abef2c48`; no runtime changes were authored in this test lane.

The unchanged private v3 command passes all four cases immediately after merge.
The same regression is now owned at `controls459-unknown.test.mjs`. An additional
isolated guard-removal mutation reproduces the two original TypeErrors and is
killed by named assertions, with valid-art, true-NULL and unmutated UNKNOWN
positive controls. This brings focused acceptance to 58 passing checks, including
11 runtime/oracle mutations and a separate harness-failure rejection. Runtime
files are never changed on disk by mutations. Raw mutation output remains outside
the checkout. All four independently derived source/built corpus/environment
browser checks and the actual installed npm consumer (including three defective
package negatives) pass on the frozen repair. These do not establish native
malformed-resource pixels.

The author's interrupted browser run is NOT counted as passing or as mutation
evidence. Independent reproduction of six selected old checks fails in both
source and built: finite availability has 8/27 passed comparisons, including old
painted-selection/resource-owner joins; bitmap snapshot fixture has no cinf and
no completed text paint; border1138 joins an absent legacy selected manifestKey.
The new engine transcript and independently derived corpus checks remain separate
from these old diagnostic-shape assumptions. `unknown-repair-legacy-browser-triage`
records exit1 and its full artifacts are retained; no old assertion was blindly
replaced, skipped or promoted.

A further public boundary is confirmed independently and PM adjudicated it as
required diagnostic plumbing: duplicate raw cicn ownership must preserve visible
selected-resource ambiguity rather than silently report blank themed success.
Both public source and built observations use the same valid decoded face with
same-ID cinf as a positive (139 opaque pixels), and proven no-cicn with that cinf
as a NULL positive (null/unavailable, PB8 NULL diagnostic). With two raw cicn
occurrences at the same ID instead, the facade returns a 24x9 transparent plane,
reports `themed`, and publishes only `engine:PB7:cicn:theme-0`, losing the exact
engine UNKNOWN reason. The public ambiguity assertion fails, with both controls
passing (`unknown-repair-public-diagnostic-v2`, exit1). Its observations and
artifacts are preserved externally. The tests constrain visible ambiguity, not
its field spelling or native painting. PM is routing a separate narrow facade
repair; this candidate does not self-fix runtime or hide this blocker.

The bitmap lifetime failure was independently narrowed to invalid setup, not an
assertion needing replacement. PB9/PB10 require cinf metadata and finite source
colors for text painting; its manual face/ring manifest supplied neither. That
fixture now uses existing independently hand-encoded cicn/cinf bytes through the
actual loader. The snapshot, late-abort and decode-failure assertions are
unchanged; both source and built pass (`bitmap-lifetime-valid-source`, exit0).
No raw value was reconstructed from a display image. Old failed receipts remain
intact; the availability and border diagnostic joins remain unresolved.

After the engine UNKNOWN repair, engine-diff again passes against the initial
author freeze with only the two new families declared, without another seed.
Source/built/standalone loader parity passes, and the expanded structural binding
audit again recovers every old manifest, source/envelope identity and asset plane
(`unknown-repair-engine-diff`, `unknown-repair-loader-parity`, and
`unknown-repair-binding-audit`, all exit0).

The public probe also covers normal-ring ambiguity with valid-ring and absent-ring
controls. Both source and built retain valid face pixels (139 opaque pixels) but
silently label the duplicate-ring result `themed`, omit the ambiguity diagnostic,
and allocate the ring reserve; valid ring paints 140 opaque pixels and true absent
ring paints 139. Both face and ring diagnostic assertions fail specifically after
all four controls pass (`unknown-repair-public-face-ring`, exit1). Raw observations
are retained in `public-unknown-face-ring-observations/`; no unsupported ring pixels
or new fallback policy are inferred from the 139 retained face pixels.

PM subsequently confirmed that the reviewed public trace API is a superset
contract: missing selected identity and metadata counted as paint are runtime
regressions, not permission to drop the old checks. Safe gaps independently
observed are: missing owner base URL/depth and resource type/signed ID/source cinf
ID/manifest key/provenance; successful cinf lookup counted as an extra face paint;
ring cinf mislabeled face; no explicit pressed-ring-to-active decision despite the
-10230 NULL then -10231 hit; and lost `resource-id` selection decisions. Availability
and border checks/expectations stay intact, with the full source/built reproducer
and raw comparisons retained. The earlier references to diagnostic joins describe
the observed failure location, not an adjudication that the loss is legitimate.

Two existing availability outcomes require separate source-contract adjudication:
a merely named asset without the canonical signed ID, and absent disabled face
previously borrowing active art. Their unavailable results follow PB5–PB8's strict
signed state lookup/no-other-face-state retry; restoring old behavior would be a
source-rule contradiction. No reviewed expectation, source evidence or status was
changed here. PM has received these two distinctions separately from the trace
regressions so an identity repair cannot accidentally restore forbidden fallback.

## Frozen public UNKNOWN repair and inactive availability correction

PM authorized exact settled `5d4ee22832f896ee0317570dfe1d90c2976994a0`, merged at
`18a0c1fd` without runtime self-edits. After rebuilding, the UNCHANGED public
source/built face/ring ambiguity regression passes first. All four valid/NULL
controls remain passing; both ambiguous selections now expose their reason rather
than returning a themed composition. Expanded independent controls/bitmap browser
acceptance passes all 10 checks, and the actual installed-package consumer with
three defective-package negatives passes. Earlier failures remain retained.
The initial fetch used an incorrect branch name (exit128); exact frozen object was
already present and merged, and ls-remote then verified the real
`pm/459-push-unknown-repair` head equals the authorized SHA. No alternate runtime
patch was substituted.

An additional facade mutation replaces only its unsupported-result rejection
condition in memory. It uses an explicit synthetic typed-provider import boundary;
real loader/decode coverage remains in the browser and package tests. Valid art,
NULL face, NULL ring, and unmutated exact face/ring ambiguity controls establish
setup before the missing-rejection mutant is assessed. The first static-import
attempt failed module resolution, and the second failed mutation-token setup after
transpilation; BOTH are preserved harness failures and neither counts as a kill.

PM authorized a narrow versioned correction for only
`synthetic.named-unknown-id` and `synthetic.inactive-to-active`. The independently
authored `tests/control-availability/corrections/459-push-strict-state.json` is an
INACTIVE 1.0.15→1.0.16 candidate: exact old rows and prior review are archived,
PB5/PB7/PB8 and the safe document hash are cited, proposed outcomes are unavailable,
and effective candidate outcomes remain unknown until different Tier-2 acceptance.
The current active reviewed inventory is byte-identical. Its independent guard
allows only those two finite rows and those outcome/policy/note fields; source
input identities, fixture evidence, options, exclusions, every unrelated row,
existing owner/resource joins and all prior unknowns are preserved. This is not a
self-review activation or an availability promotion.
The corrected facade mutation run passes all 17 checks (12 meaningful mutations,
separate setup-failure rejection, three facade controls/assertions and the inactive
correction guard); the removed rejection is killed by explicit error/outcome
assertions. Raw positive/mutant logs are retained under `public-repair-mutations/`.
`public-repair-engine-diff` also passes without another seed. Selected trace-identity
regressions remain open for PM's separate repair; this success does not erase them.

## Frozen trace repair and approved two-row activation

PM authorized exact settled `1ee442d999d0e22e7be1d7bba987cad31859ba6f`, merged at
`79eea491` with only its four runtime files. The unchanged focused suite passes
63 checks, and engine-diff passes with no seed change. The first unchanged public
availability/border run is retained as exit1. It confirms restored structured
owner/resource/manifest joins, metadata-versus-paint and pressed-ring fallback for
valid-cinf cases: availability increases from 8/27 to 16/27 passing. Remaining
11 cases are the two separately approved unavailable corrections plus nine
art-present/no-cinf cases that formerly demanded painted selections. Those nine
must not be satisfied by fabricating PB9/PB10 paint. Border36/36 still fail: 20
valid-cinf cases miss conditional NULL body-admission diagnostics, six pattern
cases miss body request/mode contract, and ten no-cinf probes dereference a missing
paint selection. All raw artifacts and observed execution records are archived;
no broad assertion update, native-pixel claim or runtime self-fix is made.

A DIFFERENT bounded reviewer approved the frozen two-row correction: task
`task_250da34b4ee4`, dispatch `ctx_665557c4ea84`, session
`orca_session_id:0ddda36d-6b99-47bf-aa9d-18e8913a21a8`, dated 2026-10-23,
receipt `/Users/khawkins/Documents/git/scriptoscope-lanes/459-availability-review/REPORT.md`.
PM explicitly authorized exact application. Active 1.0.16 now changes ONLY those
two outcomes and adds their scoped policy rule; its recomputed case digest exactly
matches the reviewer's prospective
`3b17c3e7ea05462073f65dad01c12a8618d84105bacc55bbf15fca64da35205f`.
Full old review is archived under previousReview, and frozen draft/before rows and
overlay SHA remain unchanged. The accepted-state guard reconstructs all27 old rows
to the old case digest, verifies exact new rows plus only activation fields,
reviewer identity/receipt/date/linkage and scoped policy. Source validation passes.

The first focused comparison run exposed a unit-only counterexample coupled to the
now-corrected named-unknown-id active outcome. Its renderer-free identity-spoofing
assertions remain unchanged; its synthetic expectation now reads the exact archived
before declaration so it continues to prove that signed null cannot be replaced by
a canonical request ID. It makes no current public availability claim. The failed
setup receipt is retained; corrected inventory/comparison/correction13 checks pass.

## Inactive no-cinf admission proposal (separate review required)

PM's explicit disposition preserves a themed PixelBuffer for known selected art
plus proven absent cinf; that modern API return kind does not certify painted
pixels or native success. The separate candidate
`tests/control-availability/corrections/459-no-cinf-admission.json` archives nine
exact current rows and the full prior review. Draft 1.0.17 moves their unchanged
owner/resource identities from painted dependencies to a separately checked art
admission, requires exact cinf/cinf0 NULL attempts, and forbids completed paint.
It leaves proposed public outcome themed, draft effective availability unknown,
all fixture/source inputs unchanged, and every unrelated row/join intact. No
UNKNOWN/malformed metadata may count as known NULL. Nothing is activated.

The same candidate contains exact before/after text and inactive patches for the
comparator and border probes. The comparator adds an optional independent admission
check; it removes no existing owner/resource/paint check. The border proposal may
use admission ONLY for undeclared push inputs independently bound to missing local
cinf; it retains full source/fork/asset/payload/owner joins and omitted-size checks,
explicitly proves both metadata misses and no completed painting, and retains all
pixels as unknown. Valid-cinf and bevel paths still require actual paint. The
entire later border model/pixel/band assertions and explicit owned-cinf0 reruns are
byte-identical. Before archives and code hashes remain auditable; patches apply
cleanly under --check and both proposed modules pass syntax checking.

A separately executable pure admission guard has one literal positive and 17
specific negative counterexamples, each with a positive control. Wrong owner,
depth, key, signed state, cinf identity, missing/duplicate admissions, metadata hit,
UNKNOWN-as-NULL, missing/reordered retries, fabricated band/label/paint and art-NULL
conflation all fail their named check. The proposal guard checks exact nine-row
scope, unchanged inputs, current 1.0.16 archive and all inactive code identities.
Both guards pass. Source/built candidate browser checks pass the nine admissions
and all five missing-local-push-cinf archives (three states, explicit and omitted
sizes): all ten source/built archive scopes retain raw payload/fork/asset ownership
and unassessed pixels. These executions test the candidate; they do not activate
it, approve native pixels, or claim the full old border suite passes.
