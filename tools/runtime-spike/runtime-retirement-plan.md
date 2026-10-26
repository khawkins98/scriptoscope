# Runtime retirement pivot

Status: implementation proposal; no public API retirement approved or applied.
Audit base: current production `f7d93afb37e08491da30f69fdc30dcd774ec72ee`.
PR #483 remains a separate draft experiment. This branch does not contain it.

## Decision

Target duplicate DOM interaction ownership before another renderer abstraction.
Keep the existing raster composers and theme artwork as the comparison harness.
The candidate delivery is one coordinated native-form migration, with deletion
of the imperative interaction APIs that would otherwise keep the old machinery
alive. First prove the deletion budget on checkboxes/radios. Do not commit to a
whole-runtime rewrite or claim a large saving before that measurement.

A native control here means browser-owned form/keyboard/accessibility semantics
with a themed decorative face. It does not mean replacing scheme pixels with
browser artwork or procedural gray controls.

## Measured scope

Run `node tools/runtime-spike/retirement-audit.mjs` from this checkout with dev
dependencies installed. It parses current production TypeScript without loading
application code or reading tests. Comments do not count as caller evidence.

| Current source category | Physical lines |
| --- | ---: |
| Engine logic | 5,451 |
| Declarative logic | 3,888 |
| Other runtime logic | 8,159 |
| Total runtime logic | 17,498 |
| Engine tables | 2,323 |

These are physical non-test source lines, including comments and blanks. They
are not the repository's official LOC metric. The earlier approximate 21.6K
inventory included conversion tooling as well as runtime; it was not a `src/`
subtotal. Tooling, styles and migrated consumer code must also be counted in a
final before/after report so moving code cannot masquerade as deletion.

The audit's source fingerprint is
`bce6af5d1981a2f27bbb61ead6ffb1c9fc8a3e02ea8da19ab830369b03fe8264`.

| Responsibility | Observed production callers | Deletion constraint |
| --- | --- | --- |
| `buildToggle` (54 function lines) | `interactiveCheckbox`, `interactiveRadio`, `radioGroup` | Migrating declarative controls alone leaves this implementation live. |
| `interactiveCheckbox` / `interactiveRadio` (6 lines each) | Declarative `prepareInput` | Checkbox is also a root export; radio is an internal source export. |
| `radioGroup` (22 lines) | Root export only | Public root; external use remains unknown. |
| `syncRadioGroup` (9 lines) | Declarative preparation and synchronization | Browser can own selection, but visual synchronization still needs an implementation. |
| `interactiveDisclosure` (30 lines) | Root export only | Different feature; not needed for the first form migration. |
| `interactiveSlider` (15 lines) | Root export only | Removing it does not delete shared drag logic. |
| `interactiveScrollbar` (22 lines) | Root export only | Contrary to an old navigation comment, WindowManager does not call this function. |
| `buildDraggable` (238 lines) | Native slider plus imperative slider/scrollbar | Native range remains a live root. Do not count all 238 as removable. |
| Picker promotion (306 function lines) / icon loader (40) | Scanner plus declarative public exports | Live product functionality. Moving it into a demo is not a repository reduction. |

The four export-only imperative widget bodies total only **89 lines**, before
associated types/imports and required migrations. That is not a substantial
runtime simplification on its own. No item in this table is proven dead public
code. The script inventories identifiers, not alias/dataflow/dynamic calls;
it scans `src/`, not demos, external applications or independent tests.

## First implementation slice

Prototype checkboxes/radios together, with these proposed compatibility terms:

- Original inputs and labels own focus, keyboard activation, radio selection,
  form participation, disabled behavior and accessibility. Decorative faces
  have no competing role, tabindex, activation handler or checked-state model.
- Preserve the raster APIs, theme selection, face pixels, scale and fallback
  policy. Compare the same state through old and new DOM adapters.
- Retire root `interactiveCheckbox`, `radioGroup` and
  `InteractiveCheckableOptions` rather than retain their custom interaction
  model as compatibility baggage. Remove internal `interactiveRadio` and
  `buildToggle` after migrating their declarative callers. Keep other imperative
  widgets outside this first slice.
- Support ordinary `checked` updates followed by native `input`/`change` events,
  form reset, restoration, retheme and teardown. Do not add polling or intercept
  native property setters to emulate undocumented property-write timing.
- Review DOM, CSS/focus targets, event target/order, callback-to-event migration,
  radio grouping by form/root/name, fieldset/legend disabling, validation and
  submission explicitly. Exact old wrapper DOM and synthetic callback timing
  are not promises of this proposed contract.

Migration for imperative callers: create native `<input type="checkbox">` or
same-name radio inputs with associated labels before mounting; initialize
`checked`/`disabled` on the input; replace `onChange` callbacks with native
`change` listeners. Use the public declarative mount for promotion. Consumers
requiring imperative per-widget mounting must be identified before retirement;
do not invent a second wrapper API to preserve that usage without measuring it.
Existing declarative markup remains the intended front door, but wrapper CSS
and focus assumptions require consumer review.

Before removal, obtain an independent author's public consumer inventory and
behavioral handoff, including demo/package consumers and dynamic uses. The
implementer cannot inspect excluded independent acceptance material. Internal
caller search is not a substitute for that inventory.

## Deliver as one feature PR

1. Freeze the native-input contract and approved API retirement in the feature
   PR. Have an independent author specify the changed behavior without copying
   old wrapper quirks into the new contract.
2. Implement one complete checkbox/radio slice; delete the replaced paths in
   that same diff. Review the prototype before extending to buttons or sliders.
3. Validate normal/checked/disabled and missing-art pixels with unchanged raster
   composers, plus browser tests of labels, keyboard, focus, grouping across
   forms/roots, reset, events, submission, retheme races and unmount restoration.
   An independent author owns acceptance changes; implementers do not weaken
   expectations or update goldens to fit the new implementation.
4. Report official runtime LOC, all production additions/removals including
   styles/consumer migrations, built bytes and gzip. Startup, memory or speed
   claims require separate measurements. Complete the required gates and
   independent review on the final tree before landing.

A deprecation-only release is possible if consumers need notice, but it is a
migration milestone, not a completed code-reduction result. Sub-PRs may prepare
contracts or callers; the delivery PR must actually remove the superseded path.
Do not copy retired implementation into a compatibility package inside this repo
and report that as a net saving.

## Stop criteria

This is a bounded deletion experiment, not another open-ended framework.

Proceed beyond the first slice only if it removes at least 20% of the combined
old checkable/promotion production code under comparison, counting replacement
adapters and CSS, and decreases total production code. Freeze the initial
baseline at 401 physical lines: the complete 274-line
`src/declarative/control.ts` plus the 127-line checkable section of
`src/interactive.ts` (191–317 at the audit base). There are no checkable-specific
selectors in current `src/scriptoscope.css`; any added styling counts against
the saving. At least 81 net lines must disappear from that fixed scope; changes
to shared helpers, styles or consumer implementations also count in the overall
production delta. Keep the baseline fixed rather than selecting favorable
functions after implementation. This is a proposed
experiment threshold, not an achieved result or a project-wide saving.
Stop if the design retains `buildToggle`, recreates a custom keyboard/radio
state machine, loses scheme artwork, needs a new generic state framework, or
misses that threshold. Reassess the product/API boundary instead of extending
the experiment to chase a favorable LOC count.

Astra's advice favored native-input ownership over deleting picker/persistence
features. The shared imperative callers are the important qualification: native
promotion alone cannot justify claiming the shared old implementation deleted.

## Audit validation

`node --check tools/runtime-spike/retirement-audit.mjs` and
`npm run lint:cleanroom` passed (0 clean-room hits). Repeated audit runs
produce identical output on the frozen source tree. Runtime tests were not
run for this tooling/proposal-only change; no production code was changed.

A current-production compiled baseline has also been frozen locally at
`tools/runtime-spike/.artifacts/native-controls-baseline/`: `compiled/` contains
the JS chunks and stylesheet; `receipt.json` binds each file's SHA-256 and size
to the source fingerprint, build head and Node/TypeScript/Vite versions. It is
ignored and not committed as generated reference bulk. `npm run build` passed.
The baseline has 704,891 JS bytes and 223,651 bytes summed over individually
gzipped JS chunks. These are baseline measurements, not optimization results.
Use it opaquely to compare public behavior; it does not establish original
Kaleidoscope fidelity. Archive this local baseline before deleting the worktree.
