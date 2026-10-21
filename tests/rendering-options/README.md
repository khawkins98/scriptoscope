# Control rendering matrix

This harness exercises the public runtime across all 18 shipped schemes. Shared,
Node-importable `cases.mjs` describes supported options; `browser.mjs` invokes the
public compositors or real declarative scanner. It contains no copied slicing or
resource-selection implementation. The page loads the consumer stylesheet too:
raw canvas comparison alone misses shadows, native-input synchronization and host
layout defects.

## Run and review

The companion browser runner supplies these commands. [CI and golden workflow
details](./CI.md) cover the pinned container, exact comparisons and failure artifacts:

```sh
npx playwright install --with-deps chromium
npm run test:rendering
npm run test:rendering:extended
```

The bounded run uses all 18 themes in Chromium at DPR 1, comparing source and built
public entry points. The extended run uses all cases in Chromium at DPR 1 plus
bounded cases in Chromium at DPR 2, Firefox and WebKit at DPR 1 (install those
browsers first). See the runner's configuration for selection and artifact paths.
These checks do not claim original-engine fidelity from agreement with ourselves.

The separate golden workflow is explicit:

```sh
npm run test:rendering:goldens
npm run test:rendering:goldens:update
# Cross-platform entry to the exact Linux/amd64 environment:
npm run test:rendering:container -- record
npm run test:rendering:container -- verify
```

CI now compares the 36 [reviewed Linux sheets](./goldens/REVIEW.md) exactly on
code-changing PRs. A missing manifest/image or changed pixel fails verification.
Updates create candidates for review; they do not automatically bless current
output. Browser/font, DPR, source and runtime provenance accompany the seed and
every executed page. Read the [known limits](./KNOWN-LIMITS.md): regression-image
approval is separate from historical fidelity and interaction correctness.

Interactive contact sheets show ordered case IDs, requested options via metadata, actual
control output, and decoded source-art candidates. Source canvases use labeled
integer magnification for inspection; their backing pixels remain untouched.
The separate 12px label probe is an input aid, **not** the renderer's resolved
font-size/colour/placement oracle. Explicit tiny controls may deliberately clip
text; treating every small output as a failure would contradict the public API.

## Button lifecycle checks

`button-lifecycle.spec.mjs` exercises native identity/form actions, consumer style
ownership, focus after enclosing-window teardown, replacement listener disposal,
insertion-observer cancellation and held real archive/image work in source and
built public paths. Moved sources remain consumer-owned; a connected source moved
within the mount retries under its current parent/theme at most once per frame. The actual showcase
No Theme → System 7 → No Theme flow is covered by `button-showcase.spec.mjs`.
These are web lifecycle assertions; they do not certify historical button pixels
or add tab/text-field restoration to the contract.

## Coverage inventory

The smoke profile contains 70 cases per theme (1,260 renders per transport/browser
configuration). It is a diagonal selection of axes, plus comparable button state
groups. The extended profile contains 660 cases per theme (11,880 renders per
configuration), including valid combined states. Neither is every possible value
or every Cartesian combination of the entire runtime API.

| Family | Public dimensions | Options covered |
| --- | --- | --- |
| Push/default button | Auto; min width + face height 32×12, 80×20, 180×32 | Normal, pressed, disabled; default-ring family; empty/OK/long/AgjpQy labels; custom foreground probe |
| Bevel button | Same size modes; small art selected for small mode | Off/on, pressed, disabled; extended pressed-on and disabled-on; four label classes |
| List header | Auto height with required column width; explicit sizes | Active/inactive; one-column label classes |
| Checkbox/radio | Authored native glyph dimensions; no size API | Empty/labeled/long/ascender-descender; checked, mixed, disabled; extended disabled-checked/mixed |
| Closed select | Declarative automatic geometry only | Empty/short/long/ascender-descender selection; enabled/disabled; native dropdown remains browser-owned |
| Slider | Auto or length 48/120/240 | Horizontal/vertical; values 0/0.5/1; normal/pressed/disabled/inactive |
| Progress | Auto or length 48/120/240 | Values 0/0.5/1; active/inactive |
| Tabs | Authored height, label-derived width; no size API | Selected/unselected; four label classes; real declarative tab strip |
| Scrollbar | Auto or length 48/120/240 | Both orientations; values 0/0.5/1; four states; proportional/fixed thumb with extent 0.25 |
| Disclosure | Authored dimensions | Right/down; normal/pressed/disabled/inactive |
| Grow box | Authored dimensions | Normal/inactive |

Declarative cases cover push/default buttons, checkbox/radio, horizontal range,
closed select and tabs. They preserve native controls for interaction assertions.
No unsupported declarative size/orientation attributes are invented. Each also
contains declarative and imperative window hosts to inspect actual stylesheet
scope. A dedicated grid/flex fixture pairs each host with a taller sibling; the
painted window part may be smaller than its stretched host. Imperative scale 1/2
is supported in that fixture; declarative scaling is not a public attribute.

**Window/chrome coverage remains separate.** This matrix does not enumerate every
window type, active/inactive state, arbitrary size, title, collapse state, scale,
widget set, scroll position or base-theme combination. Existing compositor tests
cover allocation, native/240/320 corpus corners and synthetic geometry; diagnostic
Scene captures cover representative compositions. The window fixtures here cover
shadow scope, grid/flex behavior and imperative scale, not the full window API.

## Browser API

Serve the repository root with the built `dist/` present, then visit:

```
/tests/rendering-options/page.html?runtime=/dist/scriptoscope.js&css=/dist/scriptoscope.css
```

For source mode, use Vite serving the repository root and substitute
`runtime=/src/index.ts&css=/src/scriptoscope.css`. Optional URL parameters:
`themeBase=/themes/`, `catalog=/demo/themes-manifest.json`,
`fonts=/demo/assets/fonts/`, `sourceZoom=4`, `labelZoom=1`. Reference zoom accepts
1/2/4/8 and changes CSS display size only; keep it fixed in golden configuration.
CSS and bundled fonts must load successfully. Both
Chicago/Charcoal names use bundled Virtue to avoid local-font substitutions;
Charcoal 12 uses the bundled bitmap face.

```js
await controlMatrix.ready;
const cases = controlMatrix.listCases({ profile: 'smoke', families: ['push', 'select'] });
const result = await controlMatrix.runCase(cases[0], { slug: 'windows-95' });
controlMatrix.readCase(result.recordKey); // fresh DOM/style/native state after interaction
await controlMatrix.runWindowLayout({ slug: 'system7-nostalgia-silver', layout: 'grid', scale: 2 });
await controlMatrix.dispose();
```

`runCase` replaces the previous case by default. Use `retain: true` for bounded
contact-sheet batches, then `clear()` to disconnect mounts and remove all cards.
`dispose()` additionally disposes loaded themes. `baseSlug` explicitly enables a
base chain; omission exercises each scheme standalone. `includeReferences: false`
skips source-art cards for fast interaction checks. Do not call `runCase`
concurrently in one page: its DOM/mount lifecycle is intentionally sequential.

Results contain the original case definition and group key, status
(`rendered`, `unavailable`, `error`), output canvas selectors/dimensions/opaque bounds,
native input state, promoted control rectangles/styles, both window paths and
host/chrome/canvas/painted-part geometry, resource provenance candidates, and label
probe metadata. Canvas selectors permit independent RGBA readback. `unavailable`
means the public compositor returned null; no procedural fallback is silently
inserted by the harness. Declarative cases exercise the runtime's actual fallback.
Group keys exclude state but retain size/label/orientation/value: they help compare
appropriate button states, not imply that every family's states have equal sizes.

Resource candidates retain signed ids, owner slugs, cinf slice/anchor metadata and
raw decoded pixels. They are evidence for a specific source-backed invariant, not
a promise that the renderer selected every candidate or that canonical ids alone
resolve noncanonical author roles. Source-vs-built parity and reviewed self-goldens
catch regressions; source-backed invariants and external evidence assess fidelity.


Direct push/default/bevel cases include an actual per-render `resolutionTrace` in
case evidence. Other paths report null. These observations expose selected owner,
resource IDs and compatibility decisions; they are not independent availability
or fidelity expectations. Candidate-art cards remain candidates. See the
[diagnostic contract](../../docs/spec/control-resolution-diagnostics.md).

Every shared-fixture observation now carries an execution envelope with the
actual Git HEAD and cleanliness, built library/built CSS/package-lock hashes, Playwright and
actual browser versions, platform, and configured DPR. Declared coverage modes are explicit
(`source`/`built`, or an empty list when unreported); filenames do not establish
which runtime executed. Declared modes are intended coverage, not proof that a failed run reached every mode; completed per-case assertions remain separate. Caller-supplied execution fields cannot override those
observations. Environment commit declarations are retained separately, including
disagreement with the checkout; missing Git identity stays unknown. This is
portable writer metadata, not authentication of assertions or historical fidelity.
The requirement summary reads the canonical envelope and retains legacy golden
provenance as such; old artifacts without cleanliness remain unknown.

## Preserved failed runs

The failure reporter copies failed, timed-out and interrupted test attachments to
`test-results/rendering-failure-archive/failure-*/` before another Playwright run
can clear its normal output. This applies to contracts and golden comparisons.
Each unique directory contains `record.json`, the original errors, measured Git
identity, attachment SHA-256/size, and available trace/screenshot/case bytes,
including in-memory attachments. Repeated attempts preserve separate records.

Missing or unreadable attachments make `archiveComplete` false; preservation
errors never replace the primary test failure. No attachments also means
incomplete preservation. Completeness covers the attachments Playwright reported;
it does not establish that every desired diagnostic was produced.
This is diagnostic retention, not a passing result or
fidelity approval. Run logs remain separate. Archives persist until explicitly
removed after review; they are ignored by Git and included in CI failure uploads.
Keep custom `--output` directories separate from this archive and its ancestors.

### Actual tab paint evidence

`tab-trace.spec.mjs` tests the opt-in public tab diagnostic callback in source and
built modes. It joins actual face selection to the owning decoder occurrence and
independent 1138/1990 byte pins, with wrong-owner/request/key/depth/payload/branch
negatives, explicit missing/ambiguous evidence, concurrent shared callbacks and
on/off pixel/decode parity. The matrix also attaches direct tab traces. Successful
observations retain only selected resource records; failures retain the full load
records. This extends diagnostic coverage, not the separately reviewed requirement
ledger or historical typography/device/variant-selection claims.

### Literal push/default branch coverage

The mandatory `control-trace.spec.mjs` source/built cases reuse the owned ring
stencil from `visual-baselines/control-ring.spec.mjs`: unequal face/ring source
sizes, a transparent margin, a pixel overlapping the face, and a colored ring
body that must remain omitted. A literal decision table covers disabled before
pressed (including both flags), present pressed art, pressed-to-active retry,
missing inactive art without active retry, missing active art, and no ring/default.
It asserts the four-pixel expansion of the face rectangle and after-face ring
paint. Actual public `promoteButton` paths exercise normal/pressed/released and
native-disabled behavior against the same independent pixel literals.

These conditional source-branch assertions do not establish original caller
state construction, aux-chain default eligibility, provider/cache identity or
historical default-control pixels. Plain-button footprint reservation remains
modern layout policy. The broader selection/geometry/default-caller obligations
remain open; this test adds no capture or ledger promotion. Existing translated
clip checks in `pattern-body.spec.mjs` and lifecycle/package checks retain their
separate scope.

### Window-chrome source rules

`window-chrome-rules.mjs` is a literal rule table with a kDEF address or
reference section on every row. `window-chrome-rules.test.mjs` (Node, part of
`npm test`) and `window-chrome-rules.spec.mjs` (source/built) run it over the
actual archives. The 13 `wnd#` archives cover every sliced window type, both
states and content sizes of template + {0,1,2,7,97} × {0,1,33}. The checks are
END-based cells (`0x5356`), the 1:1 `[0,border[0])` corner (`0x4a64`),
flag-independent part-code widths (`0x49d6`/`0x5178`), the two-pass per-half
allocation (`0x5178`, nonnegative budgets, given the observed half extent) and
opaque-pixel tiling (`0xfeae`). The tiling check follows the decoded direction
byte (`(pc==11||pc==14)?0:1`, [reference §5.1](../../docs/spec/kdef231-reference.md)).
Codes 11/14 tile from the far end, so dst index `k` reads
`sw-1-((dw-1-k) % sw)`. Every other non-18 cell reads `k % sw`. Pixels are
counted separately for 1px runs, whole copies, forward and reverse >1px runs.
Only animals and monkey-paradise have reverse runs. Opaque CopyBits under
`grafProcs` and transparent pixels are not modelled. The cross-axis origin
comes from runtime placement. Selection follows the twelve-mask `wnd#` ladder (`0x356c..0x367e`)
for all 13 canonical requests. The Node test adds 1,794 one-type-removed
variants. Author labels on all 18 archives must not contradict the selected
state. Negative cases confirm the checker rejects START-based cells, primary
shares for 13/14, untruncated tiles and changed pixels. Mutation cases confirm
it rejects forward-tiled 11/14 cells, reverse-tiled forward cells and scaled
tile cells.

These checks do not cover codes 5/10/2/3/4/15/16/17 (flag-gated), title-anchor
half extents, below-minimum windows, side draw order, CopyMask transparency,
code-18 scaled pixels, trailing side regions, the `0x632e`/`0x6062` widget pass, ladder
misses (where the runtime heuristic substitutes) or the five corner-sprite
archives. A failing `todo` records the code-10 decode disagreement (flag 1 should
collapse it). An observation test records an undecoded overrun, with no expected
value: the 1138 document-window title bar at its template size places 107px in
103px. No image or golden is added.

### Checkable source rules

`checkable-rules.mjs` transcribes the 2.3.1 checkbox/radio lanes from
[checkable-icons.md](../../docs/spec/checkable-icons.md), with an address on
every rule. It covers the state bytes (`0x66e8–0x6770`), the CICN lane
`-9504 + 12*kind + 3*value + tier` with the value-2 same-tier retry
(`0x71ec–0x728a`), the CICN-miss branch into the icon lane (`0x728c–0x7314`),
and the pinned `0x18b88` icon table with the missing-`ics#` retry
(`0x7314–0x73fa`). The checker parses each archive's resource map itself and
imports nothing from `src/`. `checkable-rules.test.mjs` (Node) checks the
table hash, cross-checks that census against the loader, and predicts the 216
public rows: 18 archives × checkbox/radio × off/on/mixed × normal/disabled,
empty label. That gives 13 CICN-lane archives and 5 icon-only ones. Floppies
ships both lanes and draws the CICN. Only Animals radio mixed reaches the
value-2 retry.

Five wrong readings each change corpus predictions: swapped tiers, no retry,
retry to unchecked, icon lane first, kind ignored. `checkRow` rejects each of
them. A sixth, the runtime normal-tier retry, changes no corpus row (below). `checkable-rules.spec.mjs` runs the public `composeCheckable` in source
and built modes. Each output must equal the archive raster of the predicted
resource: alpha everywhere, RGB where opaque. 178 of the 216 rows
discriminate. The spec pins the other 38 rows, which also equal another
archive raster, for example where an archive's disabled and pressed art are
identical. The Node test also checks each lane id's bytes against the loader's
provenance hash. Five temporary runtime mutations each failed the source
spec: mixed-first removed, disabled tier swapped, icon lane first, icon
disabled row ignored, and mixed retry to unchecked.

These rows are conditional. The public-to-native mapping is modern policy:
mixed before checked, disabled as hilite 255, no pressed option. The checks
also assume the Gestalt(`Acid`) byte +20 is clear and that the resource chain
is the archive fork alone. The original CICN lane fetches after
`UseResFile` of a Gestalt(`Copl`) refnum, and the icon lane after
`UseResFile(0)`. The rows do not establish which file owns the art, what an
install supplies for missing art, the ics8/ics4 depth choice (the runtime
draws ics8), pressed or value-3 art, glyph placement in a control Rect, or
the label pen (`left + 18`) relative to the runtime's `glyph width + 5` raster.
The runtime retries the normal-tier CICN after a same-tier miss; the decode
has no such retry. No shipped archive reaches that branch, and the Node test
records the disagreement on a minimal fork. It is left as the compatibility
policy pinned by `mixed-checkable.spec.mjs`. Popup buttons (`-8194..-8208`)
are not covered: the kDEF routes them to a loaded `WDEF -14336` that is not
decoded. No image or golden is added.
