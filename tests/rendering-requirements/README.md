# Partial rendering requirement ledger

`ledger.json` is reviewed acceptance data, separate from rendering and screenshots.
Inventory 1.0.1 declares eight exact direct cases and seven explicit dimensions per
case. **Every initial case has OPEN inventory closure.** The declared obligation
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
