# Documentation maintenance

Keep active instructions accurate and easy to find. Use this policy for routine
code changes, release preparation and larger editorial sweeps. The
[task index](./index.md) routes readers; the [documentation map](./documentation-map.json)
classifies the whole repository without turning the README into a catalog.

## Editorial policy

1. **Name the reader and result.** A page should answer one coherent question or
   support one task. Use [Diátaxis](https://diataxis.fr/compass/) to distinguish
   tutorials, how-to guides, reference and explanation. Apply the distinction
   where it helps; do not create empty quadrants or a file for every heading.
2. **Update one authoritative home.** Replace the existing explanation instead
   of appending a second account. Guides may show the subset needed for a task;
   exhaustive options and edge cases belong in reference. README owns orientation,
   one working starter, material adoption limits and routes onward.
3. **Verify changed claims.** Check public exports, commands, source and executable
   examples. Preserve prerequisites, lifetimes, cleanup, compatibility limits,
   accessibility caveats and third-party terms. Remove obsolete behavior from
   active guides; record uncertainty when verification is incomplete.
4. **Keep records in context.** Historical plans, experiments, original observations,
   evidence, provenance and generated inventories are not prose to shorten for
   appearance. Preserve original claims, inputs and limitations. Add a route or
   dated superseding note rather than rewriting a record into current instructions.
   Source-derived contracts require their own spec/review process; editorial work
   must not change engine rules or weaken evidence requirements.
5. **Review for subtraction and navigation.** Classify paragraphs as keep, move,
   merge, delete or verify. Move material only to serve an identified need. Repair
   inbound links and anchors, including `llms.txt` and package documentation.
   Prefer manifest/source links over repeated counts or rolling status summaries.
6. **Test the reader's path.** Can a new reader choose a setup, run the complete
   example, find an advanced option and discover the relevant limits? Report
   README and total documentation changes, including new files. Word budgets are
   review signals; successful tasks and preserved contracts determine quality.

Runtime implementers follow their [brief](./spec/engine/IMPLEMENTER-BRIEF.md) and
assigned allowed paths. This policy, the index and audit tool grant no extra
reading scope. Repository-wide documentation audits are for documentation
maintainers, not an implementer onboarding step.

## The recipe

### 1. Enumerate the deltas

Review `git log --oneline <last-doc-commit>..HEAD` and the code diff. Identify public
API changes, integration behavior, user interactions and changed setup/deployment
requirements. Internal refactors need documentation only when a documented
contract or contributor task changes.

### 2. Find the affected home

Use the [task index](./index.md). Hosted setup goes in the page guide; attributes
and host methods in the hosted reference; application ownership in the npm guide;
user gestures/events in interaction; framework/layout constraints in integration;
commands and release steps in the contributor workflow. New APIs do not
automatically warrant a README entry.

Search those specific active documents for removed names. Historical occurrences
are records, not necessarily errors. Preserve LEARNINGS entries and add a dated
superseding pointer when a later decision changes their applicability.

### 3. Update the contract and its affected examples

Check example imports, attributes, option names and teardown against the public
implementation. Update the task guide only when its recipe changes. Update agent
and contributor instructions only when their essential workflow changes.
For new internal DOM stamps, maintain the integration reference so SSR consumers
can distinguish native sources from runtime-owned hosts.

### 4. Verify discovery and distribution

Check moved-page links, heading anchors and inbound links; retain short pointer
pages where useful. Repository docs linked from the published README must use
repository URLs unless they actually ship in the npm package. Verify package
links and runnable examples with the [package-consumer check](../tests/package-consumer/README.md)
when their paths or code change. Run only the other checks relevant to the edit.

For a repository-wide sweep:

```sh
node scripts/docs-audit.mjs --check --base origin/main
```

The audit checks classification coverage and preserved record bodies, reports
active-page budget warnings and counts all documentation, including added pages.
It does not validate links, execute examples or verify factual/engine correctness.
Classify new documentation in the map's existing family or add an explicit rule.
Do not raise a budget simply to hide a warning: first check reader need, duplication
and whether the page should be a reference.

### 5. Review the result

Check the complete task path after editing. Report verified behavior, unresolved
facts and any navigation cost. Put release changes in CHANGELOG and implementation
work status in its tracker, not in repeated prose across guides. Record a false
start or decision chain in LEARNINGS only when the rationale is reusable; one
entry per lesson is more useful than one per intermediate patch.

## Reusable editing brief

> Identify this document's reader and task. Verify affected claims against the
> implementation or executable examples. Update the authoritative home rather
> than append another account. Keep the starter complete, move exhaustive detail
> to useful reference, and remove repetition and obsolete active instructions.
> Preserve prerequisites, cleanup, material limits, contracts and historical
> evidence. Check links and reader tasks. Report total documentation change and
> unresolved facts; a shorter README alone does not establish improvement.
