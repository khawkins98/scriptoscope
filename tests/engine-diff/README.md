# Engine diff gate

This gate renders finite window-chrome and scroll-bar cells in Node and compares
trace digests with committed baselines. [run.mjs](./run.mjs) owns the checking
rules. It is a regression gate, not original-pixel evidence.

```sh
npm run engine-diff
node tests/engine-diff/run.mjs --check --base-commit <sha> --declared <family>
npm run engine-diff:write
node tests/engine-diff/run.mjs --dump <family>/<slug>/<cell-key>
```

The write command re-seeds baselines only after review of the intended change.
CI checks against the PR merge-base in `ci.yml` and `v2-docs.yml`, including
applicable docs-only PRs. All PRs target `main`; `v2` is a retired branch name.

## What a v2 → main release PR must declare

This retained anchor now describes any focused PR to `main`:

1. Declare each changed or newly seeded family in the PR body as
   `engine-diff: <family>[, ...]`.
2. Bless every changed, added or removed cell relative to the merge-base in
   `expected/<family>.json`, with the final digest and cited family rule. Do not
   prune expectations still needed for comparison with that base.
3. A family with no baseline at the base takes the seed path and must be declared.
4. When `cases.mjs` changed, CI also runs the base's cases against the head runtime;
   expected entries must cover every change observed by that base harness.

The former instruction to accumulate expectations across successive `v2` releases
is historical. [Integration decisions](../../docs/v2/DECISIONS.md) own branch policy.

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
