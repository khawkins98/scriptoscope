# Proposed separate public-consumer assignment for PR 484

Deliverable: one consumer-migration commit based on the current PR 484 head,
plus a listing-free summary of affected public uses and normal check results.
Do not merge the PR. This is a public-consumer author role, separate from the
clean-room runtime implementer. Assignment requires maintainer authorization.

The runtime implementer cannot read demo or package-consumer source under the
exhaustive `docs/spec/engine/IMPLEMENTER-BRIEF.md` scope and must not receive
excluded test sources, evidence or verifier reports.

Use an isolated Orca worktree based on PR 484's current head. No private assets,
original program sources, historical renderer sources, evidence mounts or links
to other checkouts. Read only current public consumer code and instructions:
`demo/`, README, CHANGELOG, package metadata and package-consumer examples. Do
not open independent acceptance fixtures, rules, golden data, reference captures,
maintainer stores or review reports. Author consumer code, not runtime code or
independent test expectations. Run ordinary checks and report diagnostics.

First inventory public/dynamic uses of these API families without declaring
export-only functions dead: `interactiveCheckbox`, `radioGroup`,
`interactiveSlider`, `interactiveScrollbar`, `interactiveButton`, promotion of
buttons/selects, and associated option types. Check package examples and the
built/demo path as well as direct imports. The CI build already reports uses of
`interactiveCheckbox` and `radioGroup` in `demo/diagnostic.html`.

The current implemented retirement is checkbox/radio only: create native inputs
and labels, initialize native state, use native change listeners, and mount via
the existing declarative surface. Preserve theme, form association, label and
visible layout. Do not introduce another custom keyboard/radio state machine or
copy the deleted runtime code into demo. Count production consumer additions
against runtime deletions. A new imperative wrapper needs review and measurement.

Slider/scrollbar retirement and native button/select changes are candidates
under assessment, not yet final requirements. Inventory their uses now; await a
public runtime contract before migrating them. Vertical standalone sliders and
scrollbars are not automatically equivalent to the current horizontal native
range adapter. Keep WindowManager scrolling and raster composition available.

Return only the migration commit ID, public caller/API inventory, migration
notes, net consumer production-line delta and check exit/count summaries. Do not
send evidence locators, old sources, excluded acceptance content or verifier
review details to the runtime implementer. A blocker is preferable to inventing
a behavioral contract.
