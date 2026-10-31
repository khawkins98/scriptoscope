# Contributing

Thanks for your interest in contributing to Scriptoscope.

> **Status (2026-10-30):** the current milestone is **incremental decode-first v2**, released per family. All work lands directly on `main` through focused PRs; the former `v2` integration branch is retired and frozen at 0.7.0 (`c5c09a20`, [DECISIONS](./docs/v2/DECISIONS.md) #1). The package version is **0.7.0**. Migration work is tracked in [issue #378](https://github.com/khawkins98/scriptoscope/issues/378); the [#459 batch](https://github.com/khawkins98/scriptoscope/issues/459) is complete. Not every family has migrated. The May “v2 clean-break” and “v3 part-code reset” are historical architecture names, distinct from the retired October `v2` branch and from package versions.

## Start with your role

- **Runtime implementers:** read [`docs/spec/engine/IMPLEMENTER-BRIEF.md`](./docs/spec/engine/IMPLEMENTER-BRIEF.md) **first**, then the assigned listing-free [`engine/<family>.md`](./docs/spec/engine/) spec and only the brief's allowed paths. Its exhaustive read scope, isolation, independent-test and review-material restrictions govern every instruction below. Run assigned independent checks without opening their source or oracle data. If a spec is ambiguous or disagrees with legacy code, record a spec question in your own lane notes and stop on that item; do not resolve it from evidence. The brief forbids history, LEARNINGS and the general spec index as implementer reading.
- **Spec writers and independent verifiers:** use the role-gated [`spec index`](./docs/spec/README.md) and original source evidence to establish or verify behavioural rules. Send implementers only listing-free spec clarifications through the spec author; never hand them verifier reports or oracle data. Spec, independent tests and implementation retain separate ownership.
- **Consumers:** start with the [`README`](./README.md) integration examples. For code orientation, `src/composeChrome.ts` is a facade over `src/engine/families/window.ts`; the control facades delegate migrated scroll-bar, slider, progress, push/default, checkable and tab paths to engine drivers. The engine's `qd/`, `resources/`, `state/`, `tables/` and `trace.ts` support those drivers; remaining families still need incremental migration.

For integration policy, use [`docs/v2/DECISIONS.md`](./docs/v2/DECISIONS.md), especially decisions #1 and #8 (both superseded on 2026-10-30 where they name `v2` as the integration branch). Spec writers/verifiers and integration owners may consult [`PLAN.md`](./docs/v2/PLAN.md) for the architecture and release criteria, reading its 2026-10-22 amendment before the original single-release proposal; its §2 branch and integration rules are superseded (2026-10-30) by DECISIONS #1 and this guide. Implementers use the brief and their assigned lane instead.

## Your first code contribution

Scriptoscope is plain TypeScript with no framework dependency.

Use **Node.js 24** for development, matching CI. Vite 7 requires Node
`^20.19.0 || >=22.12.0`, and the test runner also uses Node's TypeScript
stripping flag. The published package's `engines` field is not the contributor
toolchain requirement.

1. **Fork and clone.**
   ```sh
   # Fork on GitHub first, then:
   git clone https://github.com/<your-handle>/scriptoscope.git
   cd scriptoscope
   npm install
   ```

2. **Start the dev server.**
   ```sh
   npm run dev        # http://localhost:5173 — opens demo/index.html (the ad-style landing); the interactive demo lives at /showcase.html; the dev/contributor showcase + per-scheme inspectors live at /diagnostic.html
   npm run preview:demo # serve the PROD bundle at http://localhost:4173/scriptoscope/ — use before push to catch bundling/minification regressions the dev server hides
   ```

3. **Reproduce, fix, and validate.** Start with a targeted reproducer and an
   acceptance case for the behavior being changed. Independent test authors and
   verifiers derive fidelity expectations from source evidence or reviewed original
   references with matching inputs; implementers follow the brief and assigned
   behavioural specs. Renderer output alone is not an oracle.
   Prefer correcting the shared drawing or resource model over adding another
   theme-specific exception. First check whether a mismatch reveals an incorrect
   selection rule, typed resource identity, coordinate model, or paint operation.
   Keep verified original behavior distinct from modern compatibility policy.

   Interim overrides are acceptable when they move a demonstrated case toward
   fidelity while the general rule remains uncertain. Record their evidence,
   limits and reason for existing; do not present them as original-engine rules.
   Once independent references establish the common behavior, consolidate those
   overrides into shared implementations and single points of correction. Preserve
   the reference cases through consolidation so simplification retains fidelity.

   Use the relevant unit/browser test while iterating. For chrome diagnosis,
   `npm run diag:render` and `npm run diag:audit` help inspect the result.

   On the finished candidate, run `npm run build:themes`, `npm run build`, then
   `npm run gates`; use affected checks while iterating rather than repeating this
   chain after every edit.
   The build supplies the library used by strict lint; theme extraction supplies
   the local derivatives used by the scene audit. For controls, CSS, fonts or
   promotion changes, also run `npm run test:rendering` in the final validation
   chain. The required full rendering run may be supplied by final CI; use the
   affected browser contracts locally during iteration. Install Chromium with
   `npx playwright install --with-deps chromium` first. The rendering matrix and
   pinned Linux golden workflow are documented in
   [`tests/rendering-options/README.md`](./tests/rendering-options/README.md).
   Existing window/Scene browser checks remain documented in
   [`tests/visual-baselines/README.md`](./tests/visual-baselines/README.md).

   For package exports, declarations, build assets or lazy-loading changes, also
   run `npm run test:package`. It installs an actual tarball into a clean consumer
   and verifies the production browser path; repository aliases cannot satisfy
   its imports. See [`tests/package-consumer/README.md`](./tests/package-consumer/README.md).

   Golden updates are review candidates. Inspect source evidence and the
   expected/actual/diff artifacts before accepting a changed image; recording
   current output alone does not establish fidelity to Kaleidoscope. Keep
   unsupported cases visible and distinguish regression coverage from original
   engine evidence.
   Spec writers/verifiers acquiring original captures may reuse the [private maintainer reference environment](./docs/maintainer-reference-environment.md); it is optional and is not a public CI dependency.

   Run the required change-appropriate checks on the finished implementation.
   `gates` already includes typechecking, unit tests and strict theme lint;
   running each again adds no evidence unless something changed or failed.
   Rerun affected checks after changes, failures or unresolved concerns, and
   broaden coverage when those findings justify it. Retain existing CI requirements;
   do not repeat a successful full suite just for an unchanged implementation.

4. **Make a change.** Implementers start from their assigned family spec and lane; the following general suggestions do not expand the brief’s read scope. Other contributors can browse the [epic tracker issues](https://github.com/khawkins98/scriptoscope/issues?q=is%3Aissue+is%3Aopen+label%3Atype-epic) and [`docs/spec/glitch-punchlist.md`](./docs/spec/glitch-punchlist.md) for context. Safe first-time targets:
   - Pick a render glitch off the punch-list and tighten the compositor against the recipe.
   - Improve a JSDoc comment that confused you the first time you read it.
   - Port an additional freeware scheme into the corpus (see "Adding a theme" below).

5. **Push to a feature branch on your fork.**
   ```sh
   git checkout -b feat/my-first-change
   git add <files>
   git commit -m "fix(chrome): correct close-box placement under the 2.3.1 recipe"
   git push -u origin feat/my-first-change
   ```

6. **Open a focused PR** against `main` (engine-family work, release work, docs and hotfixes alike), with the required checks and independent review. Do not self-approve.

## Branching

- Branch from `main` for all work: engine migrations, docs, release work and hotfixes. Follow DECISIONS #8 for release sequencing (#1, the `v2` integration branch, is superseded).
- Use short, descriptive branch names. Conventional prefixes:
  `feat/<thing>`, `fix/<thing>`, `docs/<thing>`, `chore/<thing>`,
  `refactor/<thing>`, `test/<thing>`, `spike/<thing>` (research,
  do-not-merge).
- Contributions come via focused PRs to `main` with an independent review.

## Commit messages — Conventional Commits

All commits follow the [Conventional Commits](https://www.conventionalcommits.org/) spec:

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer>
```

Common types used here:

- `feat` — a new feature
- `fix` — a bug fix
- `docs` — documentation only
- `chore` — tooling, deps, build config
- `refactor` — code change that neither fixes a bug nor adds a feature
- `test` — adding or fixing tests
- `ci` — CI/CD pipeline changes
- `build` — build system or external dependency changes

Scopes that make sense for this project (suggested, not enforced):

- `wm` — window manager core (drag, resize, z-order, focus)
- `chrome` — title bar, controls, growbox, scrollbars
- `controls` — buttons, popups, tabs, fields, etc.
- `themes` — theme engine and theme bundles
- `sounds` — sound playback
- `a11y` — accessibility
- `docs` — documentation
- `demo` — the demo site

Examples:

```
feat(wm): implement 8-direction resize handles
fix(chrome): correct close-box bevel composition under high-DPI
docs(themes): document the CSS custom property catalog
test(wm): add Playwright regression for raise-on-click z-order
```

Use `!` after the type or a `BREAKING CHANGE:` footer for breaking changes:

```
feat(api)!: rename ScriptoscopeWindow constructor option `theme` to `themeId`
```

## Pull requests

- Open a PR against the assigned target for any non-trivial change (see Branching).
- Keep PRs focused — one logical change per PR when practical.
- Include a brief description of *why*, not just *what*.
- Link related issues.
- Obtain one independent review of the focused change and its evidence. Revisit
  that review when material changes or unresolved findings require it; retain
  the existing source-evidence and golden-update review requirements.

### Merging

- **Squash and merge** is the default for larger PRs or any branch with noisy work-in-progress commits. The squash commit message must itself follow Conventional Commits — this keeps `main`'s history clean and changelog-friendly.
- For small PRs that already consist of a single well-formed Conventional Commit, a regular merge is fine.
- Avoid merge commits from `main` into private feature branches; rebase instead. (The main → v2 merge-sync rule of DECISIONS #1 is retired with the `v2` branch.)

## Before opening a PR

- Make sure `npm run typecheck` is clean, and that the relevant diagnostics (`diag:render`, `diag:audit`, `lint:themes`) still pass for any chrome/theme change.
- Update [`PRD.md`](./PRD.md) / the [`docs/spec/`](./docs/spec/) specs if behavior or architecture changed.
- Add a note to [`LEARNINGS.md`](./LEARNINGS.md) if you discovered something non-obvious along the way — Mac OS HIG quirks, browser quirks, theme-bundle format edge cases, accessibility tradeoffs, period-Mac trivia that informed a decision — future contributors will thank you.
- Don't commit build artifacts (`dist/`, `node_modules/`, theme working files, etc.).

## CI tiers

CI runs in two tiers ([DECISIONS](./docs/v2/DECISIONS.md) #14, [#598](https://github.com/khawkins98/scriptoscope/issues/598)).

- **PR tier** (`.github/workflows/ci.yml`, every pull request to `main`, required). It runs gates, the engine diff and the builds; the bounded Chromium rendering contracts, sharded; the exact Linux goldens; and the installed package consumer contract. The required check is the aggregate **Gates + build + browser contracts**. The PR tier is Chromium-only: since the maintainer decision on [#598](https://github.com/khawkins98/scriptoscope/issues/598) the Firefox/WebKit interaction contracts run in the release tier, not on every PR.
- **Release tier** (`.github/workflows/release-gate.yml`). It runs the full extended matrix (`rendering-extended.yml` via `workflow_call`: Chromium at DPR 1 and 2, Firefox and WebKit, every spec, with shard parity), the Firefox/WebKit interaction contracts (**Interaction contracts (firefox)** and **(webkit)**: the pointer, focus and resize specs in [`interaction-specs.mjs`](./tests/rendering-options/interaction-specs.mjs), source and built, with a per-spec, per-engine coverage check), the pinned-container golden verify, `lint:themes -- --strict --decoded`, the installed package consumer contract and the `loc:src` trend against the previous release tag, which it posts to the job summary. `verify:scenes` runs report-only until [#599](https://github.com/khawkins98/scriptoscope/issues/599) refreshes the stale scene fixtures. The aggregate job is **Release gate**. Triggers:
  - manual (`gh workflow run release-gate.yml --ref <branch>`);
  - weekly (Monday 05:00 UTC) on `main`;
  - pull requests from `release/*` branches in this repository (not forks);
  - pushes of `v*` tags. These do not re-run the matrix: a single job fails unless the tagged commit already has a successful release-gate run, and links that run in the summary.

  The **Release gate** job fails unless every required part passed: the extended matrix, both interaction legs and their coverage check, the golden verify, the decoded lint and package consumer, and the size trend.

  A red scheduled run blocks the next release only (maintainer decision, #598). It opens or updates one issue labelled `release-gate`, and the next green run on `main` (scheduled or manual) closes it. PR merges continue. The release is blocked because a `v*` tag push fails unless the tagged commit has its own green dispatch or scheduled release-gate run ("Cutting a release" step 4), and a red run is not one.

  Never make **Release gate** a required branch-protection check. On ordinary PRs every job in it is skipped, and GitHub counts a skipped required check as passing, so it would look green without having run.

## Cutting a release

Releases are GitHub-only: a tag plus a GitHub release, with no npm publication.

1. Branch `release/X.Y.Z` from `main`. Commit `chore(release): prepare X.Y.Z`: bump `package.json`, `package-lock.json` and `VERSION` in `src/renderer.ts`; date the CHANGELOG section and end it with `npm run loc:src -- HEAD --base <previous tag>`; leave an empty Unreleased heading; update docs that describe the release as unreleased.
2. Open the release PR (`release: X.Y.Z`) against `main`. The PR tier and the release tier both run on it. Link the green **Release gate** run in the PR body. This is the early signal; it does not replace step 4.
3. Merge after independent review.
4. Identify the commit to tag (normally the merge commit on `main`). It needs its own green **Release gate** run: the PR run checked the merge preview, which is a different commit. Run `gh workflow run release-gate.yml --ref main`, then check that `gh run list --workflow release-gate.yml --branch main --event workflow_dispatch --json headSha,conclusion,url` shows `success` with `headSha` equal to that commit (only dispatch or scheduled runs count; the tag-push check enforces the same). Do not tag on red, and do not tag a commit whose run is still in progress. If `main` moves before the run finishes, start again on the new commit, or tag the commit that did pass.
5. Tag `vX.Y.Z` on that commit and push the tag. The tag push does not re-run the matrix. It checks that the tagged commit has a successful release-gate run and links it in the run summary. If it fails, the tag went on the wrong commit or was pushed too early: delete the tag before creating a release, then go back to step 4.
6. Create the GitHub release. Its notes link the green release-gate run from step 4 (as 0.7.0 linked its release CI) and include the size trend.
7. Smoke-check the deployed Pages site.

## Fidelity acquisition and implementation batches

Evidence acquisition and original-source inspection below belong to spec writers
and verifiers. Runtime implementers remain within the brief; a general workflow
in this section never grants access to evidence, independent tests or reviews.

### Efficient delivery for focused fixes

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

### Evidence and batch requirements

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
  the [compact evidence format](./tests/reference-captures/README.md#compact-evidence-format-compact-json-v1).
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
  direct condition (see the [reference environment](./docs/maintainer-reference-environment.md#direct-32-bpp-condition))
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

## Periodic documentation cut-throughs

Docs and LEARNINGS rot. The faster the project moves, the faster they rot. Stale guidance is worse than no guidance — a future contributor reading a confidently-worded paragraph that hasn't been true for three months will burn an afternoon before realising. To keep that from happening, schedule deliberate cut-through passes:

**When to run a cut-through:**

- At every phase milestone close (Phase 1 done → review everything once; Phase 4 done → same).
- After any strategic pivot (a North Star change, a scope drop, a renaming) — pivot in-the-moment, then a wider sweep within the week to catch every doc the pivot ricocheted into.
- On any "wait, that's not right anymore" moment while reading docs in normal work. Stop, fix, commit. Don't carry the discrepancy.

**What to review, in order:**

1. **[`README.md`](./README.md)** — does the lede still describe the project accurately? Is the status sentence current? Are linked URLs alive?
2. **[`PRD.md`](./PRD.md)** — does §Phased delivery match what's shipped vs. open? Are §Success criteria still the right targets? Are tracker issue links current?
3. **[`LEARNINGS.md`](./LEARNINGS.md)** — each entry: is this still true? Is it superseded by a later entry? If superseded, add a "**Superseded YYYY-MM-DD by [other entry]**" header at the top of the stale entry — *don't delete it*; the historical record matters.
4. **[`docs/`](./docs/) artifacts** — each spec/architecture/spike doc: does it still describe how the system works? If a spec has drifted from implementation, either fix the spec (preferred) or update the implementation to match (when the spec was right).
5. **This file** — does the contribution flow it describes still match how PRs actually get landed? Are the commit-message examples still representative?

**Tactics for an honest cut-through:**

- **Read each doc as if you've never seen it.** The fastest way to spot stale guidance is to ask "does this match what I'd see if I cloned the repo today?" at every paragraph.
- **Cross-check claims against the code.** "The library exports `X`" — does it? `grep` it. "Phase N has shipped" — has it? Check the milestone.
- **Distinguish drift from supersession.** Drift = the doc was right at the time, code changed, doc didn't follow → update the doc. Supersession = a later decision invalidated an earlier one → mark the older entry as superseded, link to the newer, preserve the historical context.
- **Prefer many small commits over one massive sweep.** "docs(cut-through): update README + PRD §Phased delivery for Phase 4 close" is a better commit than "docs: review everything." Smaller commits make the reviewer's job easier and the changelog more useful.
- **Open a single PR for each cut-through.** Title pattern: `docs(cut-through): post-Phase-N review` or `docs(cut-through): post-pivot review YYYY-MM-DD`. Body summarises what was found and what was changed.

A cut-through is not optional polish — it's part of how the project stays trustworthy. If you're reading this and the project's recent history shows zero cut-through PRs, that's a smell: it means accumulated drift is waiting to bite the next contributor. Run one.

## Adding a theme (porting a Kaleidoscope scheme)

Scriptoscope is a Kaleidoscope-compatibility runtime — themes are *ported* (not hand-authored) from existing `.ksc` schemes. Authoring entirely new chrome means using period Kaleidoscope authoring tools (ResEdit + the Kaleidoscope SDK on classic Mac OS or under SheepShaver), then porting the resulting `.ksc` through the same flow.

The porting flow below applies to the 18 bundled schemes listed in
[`demo/themes-manifest.json`](./demo/themes-manifest.json). Use a full scheme,
such as `beos-r503`, as a worked example; `platinum-8` and
`system7-nostalgia-silver` use corner-sprite windows without wnd# edge recipes,
so they are atypical examples:

1. **Verify the scheme's license permits redistribution.** Check the scheme's readme. When a scheme lacks an explicit license, study it privately but do not port until rights are confirmed.
2. **Create `themes/<scheme-slug>/` and drop in the scheme's resource fork plus its metadata:**
   - **`scheme.sit`** (preferred) or **`scheme.rsrc`** — the original StuffIt archive or raw resource fork of the `.ksc`. The extractors decode either directly; no macOS DeRez step is needed.
   - **`meta.json`** — bundle metadata the binary scheme doesn't carry: `name`, `author`, `origin` (with the readme-stated license verbatim). See `themes/beos-r503/meta.json` for the shape and [`docs/theme-bundle-layout.md`](./docs/theme-bundle-layout.md) for the schema.
   - **`PROVENANCE.md`** — human-readable companion: author, source URL, readme excerpt, our license interpretation, why this scheme is in the corpus. See `themes/beos-r503/PROVENANCE.md` as a canonical example.
3. **Run the importer.** `npm run import -- <slug>` runs the whole pipeline scoped to your scheme (chrome + icons + rasters + roles + lint), scaffolds a `meta.json` stub if you skipped step 2's metadata, and prints a report card (scheme type, window types, header colours, control/icon/glyph coverage, lint verdict). Under the hood that's `extract-scheme.mjs` (decodes `cicn`/`ppat`/`cinf`/`wnd#`/`clut` → PNGs + a schema-validated `theme.json`) + `extract-icons.mjs` (glyphs) — you can run those individually too. (Re-extract every bundle with `npm run build:themes`.)
4. **Smoke test locally.** `npm run dev`, then open the demo and switch to your slug — or load it from the JS console: `await loadTheme('/themes/<your-slug>')`. For a quick headless check, `npm run diag:render` renders a window off a bundle to a PNG, and `npm run lint:themes` validates the bundle.
5. **PR with a side-by-side screenshot** — Scriptoscope rendering vs. the scheme's own preview thumbnail (Kaleidoscope's Scheme Settings preview, or the period screenshot the original author shipped).

The complete step-by-step walk-through (with troubleshooting for common pitfalls) is in [`docs/porting-a-kaleidoscope-scheme.md`](./docs/porting-a-kaleidoscope-scheme.md).

Hand-authoring CSS or SVG chrome as a "first-party Scriptoscope theme" is **out of scope** — the 2026-05-17 LEARNINGS entry "Scriptoscope is a Kaleidoscope-compatibility runtime, not a Platinum re-author" records why. If you want to author a new look, the recommended path is ResEdit + Kaleidoscope SDK on classic Mac OS / SheepShaver, then port the resulting `.ksc` through this flow.

## Reporting bugs

Open an issue with:

- What you tried (the smallest reproducing example, please).
- What you expected.
- What you got.
- Browser + OS + Scriptoscope version.
- Screenshot if visual.

For accessibility issues, please flag explicitly — those jump the queue.

## Reporting scheme-fidelity issues

If Scriptoscope is rendering a loaded Kaleidoscope scheme *differently from how Kaleidoscope itself renders that scheme*, that's a runtime bug — open an issue with a side-by-side screenshot of Scriptoscope's render vs. the scheme's own preview thumbnail (Kaleidoscope's Scheme Settings preview, or a period screenshot if the scheme shipped one). Scheme fidelity is the project's central commitment.

Issues of the form "this scheme doesn't look like the Mac OS 8 HIG" are a separate category — they're authorial choices of the *scheme*, not bugs in Scriptoscope. If you want HIG-faithful chrome, load a HIG-faithful scheme (`apple-platinum-2` in the current corpus is a good one).
