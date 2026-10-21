# Partial rendering requirement ledger

`ledger.json` is reviewed acceptance data, separate from rendering and screenshots.
Inventory 1.21.0 declares 144 exact direct cases and seven explicit dimensions per
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

At 1.3.0, the collision header was explicitly unsupported for sampled-line color; the reviewed 1.8.0 transition below supersedes only that assessment.
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

## Sampled whole-header support (1.8.0)

The unchanged `synthetic.header.collision.repeat.state1.w11.h16` input now uses its retained owner-bound sampled companion. One `fill.sampled-line-color` obligation moves from unsupported to verified after independent source/literal review; all other assessments and definitions remain exact. Counts: 32 OPEN cases,269 obligations,51 verified,0 unsupported,218 unknown. The prior ledger is exactly reconstructible from [header-sampling-transition.json](header-sampling-transition.json); original observations and request semantic digests are unchanged. Missing-companion rejection remains separately tested. See [the bounded model](../../docs/spec/header-sampled-lines.md).


## Conditional mixed checkable selection

Eight owned 1×1 cases reuse the existing mixed-checkable source/built test:
checkbox/radio × normal/disabled × mixed present/absent. Only conditional selector
arithmetic and the same-tier checked retry are source-verified, assuming explicit
native kind/value2/tier and declared resource availability. The separate modern
invocation is `mixed:true, checked:false` with an empty label. Exact fork, decoded
occurrence, payload, decode URL and full literal endpoint output are joined.

Mixed-over-checked precedence, active-state/icon compatibility tails, historical
provider/cache selection, decoder/device behavior, typography and whole-control
fidelity are outside this assertion. The five existing broad obligations remain
unknown for each case. All 32 prior cases and 269 assessments remain exact; eight
conditional obligations plus 40 unknown obligations bring the inventory to 317.
No original capture, intake policy, request digest or original artifact changes.

## Conditional group2 slider endpoints

Six owned normal rows reuse the existing endpoint source/built test: horizontal
and vertical at normalized values 0, 0.5 and 1, length 48, thumb axis 7 and cross
16, with declared group-base corner 3. Only the conditional CDEF3 inset, direction
and truncation geometry is verified. Literal positions are H 3/20/38 and V
38/20/3; odd travel 35 distinguishes truncation order. The registered assertion
binds actual options, prepared provider data, selected external cinf occurrence,
loaded fork, exact thumb occurrence/key/decode URL and complete literal pixels.
The full plane checks the conditional output; it does not establish original
transfer or decoder behavior.

The six cases assume a positive native range, in-range numerator and no drag
override. Public normalization and caller range formation are not source-proven.
The existing Windows 95 default-geometry cases remain unchanged. Actual native
provider/cache, decoder/device, state, transfer and whole-control obligations
stay unknown; all case closures remain OPEN. Input pins and verifier negatives
reuse the existing test without adding compositions.

`conditional-controls-transition.json` retains the exact prior inventory and all
40 cases/317 assessments through version/digest and complete registry-prefix
hashes. No authority, capture, catalog or reference-attestation changes apply.

## Conditional checkable icon selection

Sixteen existing owned rows cover checkbox/radio, declared native tier 0 or 2,
and off, checked, mixed, or missing mixed mask with same-tier checked retry. The
source table and mask lookup branch establish only conditional ID selection.
Native tier/value are declared separately from public Boolean options; the
original mapping between them remains unknown. Actual fork bytes, complete raw
mask census, selected icon index/type/depth/URL and literal stripe output must
join. Icons have no per-occurrence resource-observer records: occurrence evidence
uses the loaded whole-fork hash, exact owned raw list, and actual icon index/mask
census. Manual themes, incomplete or malformed masks, missing color variants and
8-bit depth-policy examples remain outside this source registration.

The batch adds 22 narrowly verified obligations and 110 unknown obligations:
62 OPEN cases, 449 assessments, 81 verified and 368 unknown. No whole-control
completion is implied. Existing browser cases and outputs supply execution;
there are no additional render calls or original reference admissions.

## Coherent delivery batches

For a related family or milestone, integrate the implementation, executable
harness and ledger assertions, and documentation before one freeze, independent
review and final required check chain. Parallel agents should have explicit file
ownership. Retain successful receipts when executable inputs are unchanged;
rerun affected checks after real changes and keep required CI. This does not
combine unrelated changes or bypass the focused logical-change guidance in
CONTRIBUTING.


## Four conditioned Crayon/Lisa state comparisons (1.11.0)

Four additional fixed empty 80×20 cases reuse the existing measured-profile
source/built loop: logical highlight and disabled state for Crayon OS and Apple
Lisa. The reviewed output obligation compares all 1,600 face pixels over the
recorded white background. Source archive/fork, exact face/cinf occurrences,
selected same-owner ppat or ppat 0 absence, prepared profile, port context and
completed composition must join the independently reviewed capture. This does
not observe an original private provider or a separate pattern-write event.

The retained profiles cover all 2,224 Crayon and 22 Lisa whole-load RGB16 inputs;
actual new palette/gamma/device/producer bindings support their explicit
cross-run reuse. Calibration coverage is a prerequisite, not pixel equality.
The capture remains valid evidence if comparison fails; its pixels and the
expected oracle must not be adjusted to the renderer.

`four-state-recorded-transition.json` preserves the complete prior inventory,
including all 62 cases and 449 assessments. The reviewed inventory is 66 OPEN
cases and 473 obligations (85 narrow verified, 388 unknown). Independent automated
root and frontend review approved the bounded integration at 8600ff04; the clean
development source/built pair matched all 1,600 pixels per face. Final registered
execution remains separately required. No historical provider,
alpha/mask, original phase, font, whole request or whole-control claim is added.

## Animals measured-profile comparisons (1.12.0)

Three fixed empty Animals state cases reuse the existing measured-profile
source/built loop and 80×20 native face crop. The separate 209-tuple calibration
covers the current whole-load inventory; exact positional palette reverse joins
and recorded device/gamma/producer agreement support bounded cross-run use.
Actual pixel equality is a separate requirement. The normal face selects its
bound ppat −12239 with mode 2; highlighted and disabled faces retain the actual
same-owner ppat 0 absence observation. No original private pattern ownership or
phase is inferred from those modern dependencies.

The original observations share one boot in fixed normal→highlighted→disabled
order, with fresh controls and host acknowledgment before advancement. This is
not cold-cache or state-order independence. The face is compared over recorded
white; original alpha/mask, provider/cache, font and whole-control claims remain
unknown. Calibration telemetry omits widMax, while the capture logs record 14;
no complete cross-run font identity is asserted.

`animals-recorded-transition.json` retains all six prior registry arrays,
including 66 cases and 473 assessments. The first clean comparison at `fb9f7ecd`
retained a 1,404-pixel Animals normal mismatch caused by author-label rejection.
The source-defined numeric selector correction at `b6ac38af` matched all three
1,600-pixel faces in source and built modes, with unchanged originals/profile/pins;
root independently checked the actual planes. Only the three recorded-output
obligations become verified. The resulting 69 OPEN cases contain 491 obligations:
88 narrowly verified and 403 unknown. Final combined review and registered
execution remain separate gates; no original provider, phase or mask claim is added.


## BeOS measured-profile comparisons (1.13.0)

Three fixed empty BeOS state cases extend the existing source/built
measured-profile assertion pair to eighteen rows and 28,800 compared pixels per
mode. The v2 profile supports complete preparation, but the actual face traces
retain signed cicn/cinf dependencies and a same-owner ppat0 miss. Prepared
ppat128 is not a face participant.

The prior 69 cases and 491 assessments, including all six registry prefixes,
remain exact. Only three `output.recorded-composited-face` obligations become
verified. The resulting 72 OPEN cases contain 509 obligations: 91 narrow verified
and 418 unknown. Original provider/cache/phase/mask and whole-control conditions
remain unknown, including missing cross-run port-table and widMax observations.

## Shared307 recorded-condition comparisons (1.14.0)

Eighteen added cases cover normal, Hilite10 and Hilite255 empty 80×20 faces
for 1138, Apple Platinum 2, Black Platinum, Platinum 8, Slimes and Windows 3.1.
Each uses its own 307 repeat-measured RGB16 mappings. The explicit
`recorded-case-registry.json` binds profile identity, options and modern paint
kind; nullable source pins distinguish paired-cinf bands from actual completed
legacy-face compatibility paint. Neither path identifies the historical painter.

The registry's `profile` remains the default for every state. An optional
`profilesByState` maps a registered state to a complete `{path, id, sha256}`
binding from its own reviewed acquisition. Capture bindings and browser case
descriptors resolve the same slug/state pair; every declared profile file is
hash-checked, and malformed overrides fail rather than use the default. The
browser loads each distinct profile separately within a subject. This allows a
later state's calibration without replacing earlier accepted bindings; declaring
an override does not admit a capture or promote an output obligation.

The reviewed private source/built execution compared 57,600 pixels without a
difference. Public execution still requires the exact scoped capture bindings,
completed paint and full-plane equality. Only 18 recorded-output obligations
are added as verified: totals are 90 OPEN cases, 617 obligations, 109 verified
and 508 unknown. `shared307-recorded-transition.json` and its tests preserve
all prior 72 cases, 509 assessments and registry prefixes. Fixed-order shared
boot/cache history, Black Platinum's startup anomaly and Slimes' uncaptured
initial fixture launch remain conditions. Missing port color-table, calibration
widMax, main-device equality and full font/provider observations remain unknown.

## Evolution empty-state extension (1.15.0)

The inventory appends two exact empty Evolution normal/inactive cases and twelve
obligations, preserving all prior 90 cases and 617 assessments through
`evolution-recorded-transition.json`. All 92 case closures remain OPEN. The two
recorded-output obligations are narrowly verified after the public source/built
pair passed and independent root review recomputed the native image comparisons;
their other ten obligations remain unknown. Totals are 111 verified and 518 unknown
assessments across 629 obligations. The existing generic source/metadata/paint verifier
binds actual selected CICN/CINF occurrences, eight face bands and the missing
ppat-0 lookup. No completed body-fill event is inferred.

Only empty composition uses these two records. Native font/query payloads,
labeled observations, original masks, font/provider identity, pattern phase and
whole-control claims are excluded. Intake review and actual execution remain
separate gates. This coherent batch includes data, finite profile, harness,
ledger and documentation before its final required checks.

## Monkey Paradise extension (1.16.0)

Three cases and eighteen obligations append to the exact prior 92 cases and
629 assessments, retained by `monkey-recorded-transition.json`. All 95 cases
remain OPEN. After independent root review of actual registered source/built execution, totals
are 114 verified and 533 unknown across 647 obligations. Only the three new
recorded-output obligations are promoted; their other fifteen remain unknown.

Independent pins join normal ppat128 occurrence459, exact payload/catalog/load/URL
and decoded pattern plane to the generic completed body event: 1,216 writes in
the 76×16 union. Modern phase[-80,0] is explicitly unverified original phase.
Pressed/inactive preserve missing0 and completed face bands. No theme-name
exception, private-provider claim, new scope or typography closure is introduced.
The registered pair retains full results before assertions, so rejected trace
or pixel observations remain inspectable without being counted as acceptance.

## Four-claim Floppies/Evolution extension

Inventory1.17.0 appends four cases/24 obligations to the exact prior95/647.
There are99 OPEN cases/671 obligations:118 narrowly verified and553 unknown. Only the four new
output obligations were promoted after independent review of the registered
source/built pair:45 faces and72,000 pixels per mode, zero differences.
Floppies has six source-eligible bands at height20; Evolution pressed has eight.
The generic per-state profile override preserves old Evolution normal/inactive
bindings. Neither missingppat0 nor zero-height body invents completed body paint.
All broader requirements and inventory closure remain open.

## Window-chrome source-rule extension (1.18.0)

Eighteen `window-chrome` cases and 129 obligations append to the exact prior
99 cases and 671 assessments, retained by `window-chrome-transition.json`.
There are 117 OPEN cases and 800 obligations: 131 narrowly verified and 669
unknown. Independent review (campaign lanes/D/REVIEW.json, head 4ccd2f57)
promoted only `window.wnd-ladder` for the 13 `wnd#` cases.

The 13 archives that ship `wnd#` recipes each get one case over every manifest
window type, both states and 15 sampled content sizes. Four primary-decode
locators in `docs/spec/kdef231-reference.md` (the 0x356c ladder, END-based
cells, the 0x5178 allocation table and the 0xfeae tile blit) back two
registered source/built assertions in `window-chrome-rules.spec.mjs`. Their
`recipe-cells` and `tile-blit` carry evidence but stay unknown. The recipe-cells
claim is narrowed (no code 6, nonnegative budgets, observed titled-half
extent, runtime 5/6 split) and may be re-proposed. Tile pixels are asserted only
for 1px source runs, because the 0xfeae direction byte is not decoded. Half extents,
flag-gated codes, masked composition, transparent/scaled pixels and the state
pairing stay unknown, with their reasons. The five archives without `wnd#`
(corner-sprite) get all-unknown cases: no original drawing path is decoded.


### Optional finite CIcon preparation binding (held data extension)

A subject may explicitly declare `cicnTransfer: {path, sha256, id, contractId,
maskPolicy: 'source-mask-alpha'}` alongside its profile bindings. The closed
binding is included in capture identity and the load-cache key; malformed,
missing or altered data and mismatched prepared result/context IDs reject before
loading. Existing subjects without this field retain their exact bindings and
per-state profile selection.

The ordinary public factory and loader prepare the results. Recorded execution
retains each actual finite element, its inspector URL, typed occurrence, load/fork,
source representation, operation context and destination-plane hash. This is a
whole-load preparation dependency: the selected push face may use ordinary
source decoding (in the nine registered subjects below it is a slider tick or checkbox, never the face). Original consumer geometry and the finite preparation operation
remain separate. Source-mask alpha is explicit modern preparation; sampler,
original mask/provider and generalized missing-color claims remain unverified.

Opted-in subjects report the unprofiled output/URL comparison as null; the owned
fixture separately requires strict mapped-default decoding to reject its missing
source color before URL allocation. Committed transfer DATA is stored compactly and
recovered to its bound original bytes (`readOriginal` in Node; the spec passes those
bytes to the browser).

## Nine-face 1984/1990/Dolphin extension (j1223)

Inventory 1.19.0 appends nine cases/54 obligations to the exact prior 117/800:
126 OPEN cases/854 obligations, 140 narrowly verified and 714 unknown. Only the
nine `output.recorded-composited-face` obligations are promoted, after the
independently reviewed private source/built comparison (18 calls, 28,800 pixels,
zero differences) and nine v5 scoped intake attestations. Each environment has
its own 1,223-key profile and finite transfer DATA (1984 −10139 slider tick;
1990/Dolphin −9504 checkbox), bound to the whole load and unrelated to the face.

The 1990 and Dolphin state cicns are byte-identical across both schemes and
differ only in the centre title-colour pixel, which an empty label never uses.
Their six rows are marked state-non-discriminating: they verify one shared face
art under two separately measured environments, not hilite→cicn selection. The
three 1984 face comparisons are state-discriminating (a wrong state face would
fail); the original selection remains unknown for all nine. Title colour is
untested in all nine. The caller-declared `RECORDED_FIXTURE_PORT_CONTEXT` (formerly named
after Crayon) is the native fixtures' logged geometry: 160×80 port, local origin
0, control (20,20,100,40), full-port clip, unknown pattern phase. Shutdown
acknowledgement, provider/cache/patch order, mask/phase/font, whole-port
equivalence, consumer port table/widMax and cold-cache independence stay unknown.

A follow-up wording pass changed only unhashed ledger prose. It updated the
assertion claim, the 1990/Dolphin evidence limits and geometry/fill/placement
rationales (which now carry the `State-non-discriminating` marker), and the three
1984 evidence locators, with their `EVIDENCE.md` excerpts and `excerptSha256`.
`inventorySha256` covers scope, requirements and cases, and none of those changed,
so the version stays 1.19.0 and every status is the same. The ledger test requires
the marker on every 1990/Dolphin row, case substitution list and evidence
locator/limit, and forbids it on the 1984 rows.

## Checkable source-rule extension (1.20.0)

Eighteen `checkable` cases and 185 obligations append to the exact prior 126
cases and 854 assessments, retained by `checkable-rules-transition.json`.
There are 144 OPEN cases and 1,039 obligations: 153 narrowly verified and 886
unknown. Independent review (campaign lanes/G/REVIEW.json, head 52d07faf)
promoted only `checkable.lane-selection` for the 13 CICN-lane archives.

Each archive gets one case over the 12 public empty-label rows (checkbox/radio
× off/on/mixed × normal/disabled). Seven primary-decode locators in
`docs/spec/checkable-icons.md` back one registered source/built assertion,
`checkable.selection-rules`, in `checkable-rules.spec.mjs`. The 13 verified
lane-selection rows certify agreement with the decode under three declared
conditions: the public-to-native mapping, a clear Gestalt(`Acid`) byte and an
archive-only resource chain. They do not establish which file supplied the
art. Each rationale names the distinctions its shared-pixel rows cannot
discriminate. For example, Apple Lisa's normal and disabled art are identical,
so its tier is not evidenced. The Animals retry rows also assume no other file
supplies −9485/−9486. Icon-only lane selection stays unknown, because the
icon lane fetches from the System file. Raster retention also stays unknown,
because the decoder is shared. The other obligations
are recorded with their decoded limits and no runtime check: the resource
files (`UseResFile` of a Gestalt `Copl` refnum, `UseResFile(0)` for icons),
the public state mapping, the pressed tier, value 3, glyph placement, the
label pen, icon depth (5 icon-only archives) and device colour.

## Tile-direction re-proposal (1.21.0)

Inventory 1.21.0 keeps all 144 cases and every requirement. It
edits rows in place, unlike the earlier append-only extensions.
`tile-direction-transition.json` stores the prior `kdef.tile-blit` evidence row
and the 13 prior `window.tile-blit` rationales. The ledger test restores them
to rebuild the exact 1.20.0 ledger that the older transitions hash.

[kdef231-reference.md §5.1](../../docs/spec/kdef231-reference.md) decodes the
`0xfeae` direction byte as the tile anchor, not the axis. Codes 11/14 tile from
the far end; all other codes tile from the start. The decode was independently
reviewed (campaign lanes/H/REVIEW.json, ACCEPT-WITH-CHANGES). The evidence row
now cites that decode. `window.recipe-rules` asserts both offset formulas over
every non-18 cell, unknown-class cells included, and records per-archive
mutation discrimination (`tests/rendering-options/README.md`). The PR #373
review (lanes/H/PR-REVIEW.json, head 70e3ff92) **rejected** promoting all 13
`window.tile-blit` obligations. Its round 2 (head 28921fd7) **approved** a
narrow promotion. Exactly seven become **verified**: 1990, animals,
crayon-os, dolphin-som, evolution, floppies and monkey-paradise. That covers
agreement with the decoded rule at sampled sizes, for opaque pixels, with each
archive's check failing under inverted or scaled tiles. Only animals and
monkey-paradise exercise the 11/14 reverse direction. The other five state
that direction is unexercised. 1138, 1984, apple-lisa, beos-r503, windows-31
and windows-95 cannot discriminate, so they stay **unknown**. The ledger now
has 160 verified and 879 unknown obligations across 1,039. The 1.20.0
reconstruction still restores the prior rows exactly. The runtime fix changes five 11/14 cells
(animals ×4, monkey-paradise ×1, both states). Opaque CopyBits under
`grafProcs`, transparent pixels and the CopyMask order over earlier sides
remain unmodelled.
