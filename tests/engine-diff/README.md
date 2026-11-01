# Engine diff gate

`run.mjs` renders the `cases.mjs` matrix in Node and compares each cell's trace
digest with the baselines at the base commit. The rules are in the header of
`run.mjs`. Commands:

```sh
npm run engine-diff                                     # head vs its own committed baselines
node tests/engine-diff/run.mjs --check --base-commit <sha> [--declared f,g | --declared-from-diff]
npm run engine-diff:write                               # re-seed baselines/ after blessing
node tests/engine-diff/run.mjs --dump <family>/<slug>/<cell key>
```

CI runs `--check --base-commit <merge-base>` for every pull request: `ci.yml`
for PRs into `main` that touch code, and `v2-docs.yml` for every PR into `main`, docs-only PRs included. The PR body's `engine-diff: <family>[, ...]`
lines declare which families may change.

## What a v2 → main release PR must declare

> **Historical framing (2026-10-30).** This section was written for release PRs
> from the `v2` integration branch. `v2` is retired and every PR now targets
> `main` directly ([DECISIONS #1](../../docs/v2/DECISIONS.md)), so each PR
> declares every changed family (rule 1) and blesses every changed, added or
> removed cell in `expected/<family>.json` relative to its merge-base with
> `main` (rule 2; see the header of `run.mjs`). Only rule 2's accumulation of
> entries across v2 PRs, and the warning about pruning them before a release,
> are historical. Rules 3 and 4 still apply to any PR: a family with no
> baseline at the base takes the seed path and must be declared, and a changed
> `cases.mjs` also runs the base's copy.

A release PR is judged against its merge-base with `main`. `main` carries the
window and scroll-bar baselines, so v2's changes since the last sync to main are
judged all at once:

1. `engine-diff: <family>` for every family that has a cell changed on v2 since
   the last main sync.
2. `expected/<family>.json` at the v2 head must bless the final digest of every
   such cell relative to main. Entries therefore accumulate across the v2 PRs
   between releases. Pruning "inert" entries on v2 before a release makes the
   release PR fail.
3. A family added on v2 that main has no baseline for (for example a future
   slider family) takes the seed path and must be declared.
4. If `cases.mjs` changed since main, main's `cases.mjs` also runs, in a child
   process on the head runtime. Every cell it sees change must be covered by an
   expected entry that blesses a change from main's digest.

## Limits

`run.mjs`, the family rule spec list (`cases.mjs` `FAMILIES[f].rules`) and the
ledger evidence ids are read from the head tree. A PR that edits them changes
its own judge, so reviewers read those diffs. Only `cases.mjs` is also run from
the base.

## Collapsed recipe coverage (#625)

The window grid preserves its expanded cells and adds `/collapsed` cells for
all authored collapsed recipe types, both activation states, all three sizes
and both title widths. Keys name the expanded input size. The actual content
rect is empty in height for top titles and empty in width for side titles;
`collapsed` and `sideTitle` are passed together to the layout (window-widgets
§2.1, WD4; hit-regions HP48). No theme-specific branch selects the axis.
The facade grid covers chrome cells, not pressed widget-strip selection:
WD9/HT7's collapsed second row requires the separate widget contracts.
Added digests are regression seeds, not independently established native pixels.
