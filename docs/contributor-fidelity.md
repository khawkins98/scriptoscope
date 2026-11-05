# Fidelity acquisition and implementation batches

Evidence acquisition and original-source inspection below belong to spec writers
and verifiers. Runtime implementers remain within the brief; a general workflow
in this section never grants access to evidence, independent tests or reviews.

## Efficient delivery for focused fixes

Agreed working practice (2026-10-24): reduce repeated work while retaining the
existing clean-room boundaries, review tiers, exact-head readiness and required CI.

- **Settle the question first.** Start with a bounded reproduction, an acceptance
  case and a check for missing behavioural rules. Resolve material spec questions
  before implementation; distinguish decoded behaviour from modern compatibility
  policy. Add a spec specialist only when the question needs one.
- **Use a small, stable team.** Default to one implementer, one independent
  test/review lane and one integration owner for a focused fix. Keep independent
  spec verification separate from spec authorship. After spec verification, run
  implementation and independent test authoring in parallel with separate file
  ownership and the implementer's existing access restrictions.
- **Preflight clean-room handoffs.** Read every required implementation reference
  before dispatch; an allowlisted filename does not make embedded private pointers,
  independent test oracles or review outcomes safe. Move such material to gated
  evidence appendices while preserving behavioral rules, then independently review
  the split. Verify the exact changed paths and blobs of behavior-only handoff
  commits before providing them to an implementer. Preserve and classify any
  exposure incident; a repaired document does not erase an earlier exposure.
- **Keep the reviewer through corrections.** Return findings to their existing
  owner and have the same independent reviewer check the changed claims and
  dependencies. Carry approval over provably unchanged content. A mechanical
  integration needs an exact tree/delta check, not a new review of every unchanged
  component; unresolved findings and material changes still reopen their review.
- **Validate narrowly while iterating.** Run affected contracts and meaningful
  negative or mutation checks. On the finished integrated candidate, run one
  change-appropriate validation chain and the ordinary exact-head `lane:ready`.
  Let required CI supply the full repository matrix when applicable. Repeat or
  broaden checks only for changes, failures or unresolved concerns; retain required
  final checks and independent visual review for changed pixels. A failure must
  remain visible rather than being retried until green.
- **Check provenance before expensive runs.** Verify the actual checkout, clean
  state, dependency/browser versions, capture configuration and artifact output
  paths first. Record each command's exit and each run's actual commit/tree;
  declared labels do not repair missing execution identity. Preserve failed or
  incomplete receipts and diagnose the gap before repeating a long run.
- **Integrate once per coherent fix.** Freeze the related spec, implementation,
  independent tests and documentation together for final review and PR checks.
  Keep an explicit owner and next gate so handoffs do not become serial idle time.
  Profile CI and consider caching or sharding as separate work; do not silently
  remove coverage or change approval gates to make the current fix faster.

## Evidence and batch requirements

- **Check the claim and dependencies before acquisition.** Name the public consumer,
  source inputs, operation, required color mappings and conditions, and independent
  pixel or source oracle. Identify missing dependencies before collecting outputs
  that cannot support the intended comparison; never invent mappings to complete it.
- **Batch a coherent claim.** Carry the related model, evidence, harness/ledger,
  documentation and CHANGELOG changes to one reviewable freeze. Keep independent
  file ownership explicit and unresolved claims visible; avoid a PR per receipt or
  theme when they share one model and acceptance boundary. Batch shared mechanisms
  across compatible themes and states, with explicit per-case inputs and conditions.
  Prepare independent source, fixture and comparison work in parallel where useful;
  serialize access to shared media, native runs and other locked resources.
- **Commit evidence compactly.** Commit only what checks read, in one copy, using
  the [compact evidence format](../tests/reference-captures/README.md#compact-evidence-format-compact-json-v1).
  Keep unread raw native evidence in the private asset store, referenced by sha256.
  Write newly derived files compact before their first hash. A copy of an already
  sealed private member stays private (by sha256) or gets a `compacted` registry entry.
- **Consolidate the preboot gate.** Review the frozen source, compiled packages,
  copied media and host protocol together before execution. Carry approved inputs
  forward; reopen the affected review for material changes or unresolved findings,
  rather than repeating unchanged audits at each preparation step.
- **Separate acquisition identity from execution identity.** Preserve immutable
  acquisition and profile inputs, and bind runtime, comparator and validator versions
  separately to each execution. A comparator correction must not rewrite captures or
  silently replace their original validation results. Review the changed validator
  and revalidate retained evidence where sufficient. Identify the evidence gap before
  repeating acquisition; link new acquisition or runtime execution to the preserved
  inputs and prior results.
- **Keep one current stage owner and manifest.** Record the authoritative inputs/head,
  active process or terminal exit, evidence locations and next gate. Link immutable
  receipts instead of copying their status into competing handoffs. Scope operational
  locks to the actual owned processes, media and shared resources.
- **Review and validate the delta.** Carry prior review over provably unchanged inputs;
  independently review changed claims and material dependencies. Preserve failures,
  record each command's own exit status, and use the finished-tree checks above.
  Equivalent rebases or metadata-only changes do not justify repeating unaffected
  suites; required CI and applicable independent original-evidence review remain mandatory.
- **Finish one delivery batch.** Use targeted checks during development, then one
  final change-appropriate validation chain, consolidated PR and CHANGELOG entry for
  the coherent batch. Rerun affected checks when subsequent changes or failures
  require it. Keep bounded research separate from delivery: state its question,
  evidence needed and stop criteria, and bring it into the batch only when it
  supports the named claim or a demonstrated shared correction.
- **Rules first; captures sample them.** Prefer a source-addressed rule asserted
  across every applicable theme (the push/default tables and window-chrome rule
  tables are the model: a few hundred lines, no images) over one native capture per
  theme × state. Use native captures to confirm a rule's boundary classes (sizes,
  partial tiles, overlaps, colour classes, states), not to enumerate cells. A rule
  table checks the runtime against the decode, not against original output:
  unsampled cells and themes stay unknown in the ledger, and a predictor that shares
  the decode with the runtime is not native evidence.
- **One capture, many observations.** A native fixture should draw many controls,
  sizes and states per boot. Freeze a plan before boot that names, for every
  observation, its rect, the public Scriptoscope call it will be compared against
  and the decoded rule that predicts it. Predictions written after capture are not
  independent.
- **Prove each comparison can fail.** Review must perturb inputs (wrong state
  resource, wrong scheme, one mapping, one pixel, a mutated runtime rule) and show
  the check fails. Record what a passing row *cannot* discriminate: for example, two
  state cicns that differ only in a pixel an empty face never shows do not test
  state selection, and identical art in two schemes is one observation, not two.
- **Name the capture condition.** The 8-bit calibrated condition and the 32 bpp
  direct condition (see the [reference environment](../docs/maintainer-reference-environment.md#direct-32-bpp-condition))
  are separate evidence; never pool them. Direct-condition logs must show depth,
  pixel type and row bytes around every draw, with exact colour sentinels, or the
  observation is rejected. State which modern plane is compared: the default Mac 1.8 → sRGB
  2.2 display policy, or an analysis-only pre-gamma plane (not a public runtime mode).
- **Budget native attempts.** Stop after two consecutive failed native attempts.
  Resume only under an explicit, bounded diagnostic that names the single variable
  under test. Never reveal or rearrange windows, retry or refit to obtain a pass.
- **Work in durable lanes.** Parallel lanes each own a worktree and output directory
  outside `/tmp` (temporary directories have been lost mid-campaign), plus a single
  deliverable. Only one lane at a time owns the emulator and HFS media.
- **Pass `lane:ready` before asking for review.** Run `npm run lane:ready` on the
  exact head you want reviewed (`-- --skip-tests` for docs-only diffs; it needs the
  private `Traps.h` via `SCRIPTOSCOPE_TRAPS_H`). It requires a clean worktree and a
  pushed head equal to the tested head, rejects leftover `PENDING` / "Awaiting
  independent review" / "PROPOSED verified" labels, and runs the clean-room linter,
  `gen-trap-table --check`, `report-coverage`, `build-ledger.mjs --check`, the
  ledger history guard, `validate-source`, typecheck and `npm test`. It also fails
  a silent revert: a branch built on an old tree but given a new parent, so its diff
  undoes base commits that landed in between (#440 undid #434, #435 and #438 that
  way). The window is the last 50 first-parent base commits before the merge-base
  (about a day of `main`), filtered to those that changed a file the branch changes. A
  commit counts as undone when the branch's copy of a file equals the copy before that
  commit, or when the branch's diff reverses every hunk the commit made, as those hunks
  stand at the merge-base (its new lines removed and its old lines restored, not
  rewritten into something else). Removal alone (a deleted file, or exactly deleting lines a commit only
  added) counts only when the same commit is also undone with its old content restored,
  or is removed that way from two or more files. The row names the file and the base
  commit; rebase onto the base to fix it. A deliberate revert passes when a branch
  commit carries git's `This reverts commit <sha>` line,
  or with `-- --allow-revert <sha>` (7+ hex characters). Known limits: commits older
  than the window (a lane started from a stale local tree more than a day old), a
  revert of only some of a commit's hunks, and removal-only reverts with no such
  corroboration, such as deleting files a commit added or a CHANGELOG conflict resolved
  to "ours". Typecheck, tests, goldens and the ledger history guard are the backstop
  there. One `PENDING`
  reviewer label on a hash-only expectations bump passes with a WARN, so the PM
  replaces it after the Tier 0 check. Paste its summary block, with the commit and
  each exit code, into the PR body. A PR without a passing summary goes back
  unreviewed.
- **Declare engine changes.** The engine diff gate (`npm run engine-diff`,
  `tests/engine-diff/`) traces the window-chrome and scroll-bar matrix over every
  archive in Node and compares each cell with the committed baseline. A PR that
  changes any cell lists it in `tests/engine-diff/expected/<family>.json` as
  `{ key, rule, sha256, why }` (`rule` is a decision-table row id of the family spec),
  re-seeds with `npm run engine-diff:write`, and declares the family with a PR body
  line `engine-diff: <family>`. Every other PR changes no cell.
- **Review by tier.** Tier 0, PM mechanical check with no agent review: hash-only
  bumps, inserting reviewer labels, doc wording and typos, citation-only corrections
  with no change in meaning, a regenerated `ledger.json`. Tier 1, one review round:
  specs, tooling and tests with no status change, after `lane:ready` passes; the
  reviewer re-traces the claims and runs mutation probes, and only blocking findings
  trigger a second round. Tier 2, full adversarial review: runtime and `src/engine`
  changes, golden candidates, ledger status promotions or mismatches, changes to the
  clean-room boundary (brief, linter, allowed paths) and the denominator.
- **Measure and shrink the runtime** (maintainer rule, 2026-10-22). The v2 engine
  should replace code, not sit beside it.
  - **Delete what you replace.** A PR that moves a family onto the engine deletes the
    legacy path it replaces in the same PR. If something legacy must stay, the PR
    names it and the issue that will remove it.
  - **Report the size.** A PR that changes `src/` pastes the output of
    `npm run loc:src -- HEAD --base origin/main` into its body. It counts non-test `.ts`
    lines under `src/` in two parts: engine tables (cited data rows) and logic
    (everything else). The base is measured at the merge-base, so commits that landed
    on `main` after the branch forked don't count as the PR's own change.
  - **Reviewers flag growth.** The reviewer flags any increase in logic lines that the
    PR does not justify. Tables may grow with the decode; logic should not.
  - **Every release reports the trend.** Each release's CHANGELOG section ends with the
    same table measured against the previous release tag, e.g.
    `npm run loc:src -- HEAD --base v0.2.0`.
- **Retire architecture in measured steps.** Audit callers and drivers first: distinguish proven dead private paths from live or uncertain public/dynamic roots. Retire a measured, bounded slice before a larger migration, require independent behavior verification, and report the actual net runtime LOC change.
- **Bound finite adapters.** Name the exact supported inputs/operation and the consumer
  claim or preparation dependency they serve. Stop on an unmatched context, missing
  mapping or unexplained difference. A finite result is not a general source rule:
  preserve strict defaults and unknown branches, and require a concrete next claim
  before adding more isolated cases.
