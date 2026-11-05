# Contributing

Start with your role, then use the workflow for your change. The project is
pre-1.0; public release changes belong in [CHANGELOG](./CHANGELOG.md), and current
integration decisions belong in [DECISIONS](./docs/v2/DECISIONS.md). All focused
PRs target `main`; the former `v2` integration branch is retired.

## Start with your role

- **Runtime implementers:** read the [implementer brief](./docs/spec/engine/IMPLEMENTER-BRIEF.md)
  **first**, then your assigned listing-free family spec and only the brief's
  exhaustive allowed paths. Use a fresh isolated worktree without private assets.
  You may run assigned independent checks, but must never open, search or edit
  their sources, fixtures, oracle data or verifier reports. General links here
  do not expand your scope. If a spec is ambiguous or conflicts with legacy code,
  stop on that item and ask for a listing-free clarification through its author.
- **Spec writers and independent verifiers:** use the role-gated
  [spec index](./docs/spec/README.md) to establish or verify rules. Spec,
  independent tests and implementation keep separate ownership. Never hand
  verifier reports or original evidence to implementers.
- **Consumers:** start with the [README](./README.md) setup choices and
  [npm integration guide](./docs/npm-consumer.md).
- **Scheme authors and porters:** use the [authoring guide](./docs/authoring-a-scheme.md)
  or [porting guide](./docs/porting-a-kaleidoscope-scheme.md), retaining original
  attribution and redistribution terms.

## Your first code contribution

Use **Node.js 24**, matching CI. Work from `main` on a focused branch. The
[contributor workflow](./docs/contributor-workflow.md) owns setup commands,
validation choices and PR mechanics.

1. Install locked dependencies and run the demo using the workflow's setup steps.
2. Reproduce a concrete behavior and identify its acceptance case. Implementers
   use assigned behavioral specs; independent verifiers establish expectations.
3. Fix the shared model where justified. Do not add per-theme exceptions to
   conceal an unresolved selection, geometry or paint rule. Keep modern
   compatibility policy distinct from verified original behavior.
4. Run affected checks while iterating, then the required finished-candidate
   validation and independent review. Preserve failed and incomplete results.
5. Open a focused PR to `main` with the problem, resulting behavior, checks and
   limits. Do not commit generated builds or theme working files.

Passing source/built parity or reviewed regression goldens does **not** establish
historical fidelity. Original evidence, independently reviewed exact claims and
scoped assertions remain separate requirements.

## Branching

See [branching](./docs/contributor-workflow.md#branching). All work targets `main`.

## Commit messages — Conventional Commits

See [commit conventions](./docs/contributor-workflow.md#commit-messages--conventional-commits).

## Pull requests

See [PR requirements](./docs/contributor-workflow.md#pull-requests).

### Merging

See [merging](./docs/contributor-workflow.md#merging); retain required checks and review.

## Before opening a PR

Use the [validation table](./docs/contributor-workflow.md#choose-the-validation-for-your-change).
The [batch requirements](./docs/contributor-fidelity.md#evidence-and-batch-requirements)
retain exact-head readiness, review tiers, evidence integrity and runtime size reports.

## CI tiers

[Browser CI](./tests/rendering-options/CI.md) owns PR/release coverage and artifacts.
The release gate tests an exact commit; it is not an ordinary required PR check.

## Cutting a release

Use the [release procedure](./docs/contributor-release.md). It retains first npm
launch prerequisites, candidate/registry integrity, exact-SHA gates, tag order and
Pages coordination.

### First npm launch

See [first npm launch](./docs/contributor-release.md#first-npm-launch).

### GitHub release gate and tag procedure

See [exact-commit gate and tags](./docs/contributor-release.md#github-release-gate-and-tag-procedure).

## Fidelity acquisition and implementation batches

The [fidelity batch workflow](./docs/contributor-fidelity.md) preserves the detailed
handoff, acquisition, review and delivery requirements. It applies to integration
owners, spec writers and verifiers; implementers remain within their brief.

### Efficient delivery for focused fixes

See [focused delivery](./docs/contributor-fidelity.md#efficient-delivery-for-focused-fixes).

### Evidence and batch requirements

See [evidence and batch requirements](./docs/contributor-fidelity.md#evidence-and-batch-requirements).

## Periodic documentation cut-throughs

Follow the [maintenance policy](./docs/doc-sweep.md) after a milestone, pivot or
confirmed discrepancy. Update the authoritative document instead of adding a
second summary to README or agent instructions. Keep superseded decision records
as history with pointers to their replacements. See the [documentation hub](./docs/index.md)
for current routes.

## Adding a theme (porting a Kaleidoscope scheme)

Follow the [porting workflow](./docs/porting-a-kaleidoscope-scheme.md). Confirm
redistribution rights before adding a third-party scheme; retain its original
archive, metadata and provenance. Validate the result and supply a side-by-side
comparison. New first-party looks must also be real Kaleidoscope schemes, as the
[creation guide](./docs/authoring-a-scheme.md) explains.

## Reporting bugs

Open an issue with a minimal reproducer, expected/actual behavior, browser, OS,
Scriptoscope version and a screenshot for visual defects. Flag accessibility
issues explicitly.

## Reporting scheme-fidelity issues

For a difference from original Kaleidoscope rendering, include a side-by-side
original reference with matching inputs where possible. A scheme differing from
Apple's HIG may be the scheme author's choice; distinguish that from a runtime bug.
