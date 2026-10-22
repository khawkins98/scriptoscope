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
states and content sizes of template + {−12,0,1,2,7,97} × {−12,0,1,33}. The checks are
END-based cells (`0x5356`), the 1:1 `[0,border[0])` corner (`0x4a64`),
flag-independent part-code widths (`0x49d6`/`0x5178`), the two-pass per-half
allocation (`0x5178`, nonnegative budgets, given the observed half extent) and
opaque-pixel tiling (`0xfeae`). The tiling check follows the decoded direction
byte (`(pc==11||pc==14)?0:1`, [reference §5.1](../../docs/spec/kdef231-reference.md)).
Codes 11/14 tile from the far end, so dst index `k` reads
`sw-1-((dw-1-k) % sw)`. Every other non-18 cell reads `k % sw`. That includes
the unknown-class cells (5/6/10/flag-gated), which are checked over their
runtime-placed width. Pixels are counted separately for 1px runs, whole
copies, forward and reverse >1px runs. Only animals and monkey-paradise have
reverse runs. Nonzero counts bound discrimination but do not prove it: a
source that is uniform along the run passes under any anchor. The Node test
therefore re-runs the corpus check under three repainted wrong blits and
asserts which archives fail:

| archive | flip 11/14 (pre-fix runtime) | inverted anchor | scaled |
|---|---|---|---|
| 1990, crayon-os, dolphin-som, evolution, floppies | passes | FAILS | FAILS |
| animals, monkey-paradise | FAILS | FAILS | FAILS |
| 1138, 1984, apple-lisa, beos-r503, windows-31, windows-95 | passes | passes | passes |

The six archives in the last row cannot tell the anchor or tiling from
scaling at the sampled sizes. 1138, 1984, beos-r503 and windows-31 have only
1px and whole-copy pixels. apple-lisa and windows-95 have uniform >1px
sources. Opaque CopyBits under
`grafProcs` and transparent pixels are not modelled. The cross-axis origin
comes from runtime placement. Selection follows the twelve-mask `wnd#` ladder (`0x356c..0x367e`)
for all 13 canonical requests. The Node test adds 1,794 one-type-removed
variants. Author labels on all 18 archives must not contradict the selected
state. Negative cases confirm the checker rejects START-based cells, primary
shares for 13/14, untruncated tiles and changed pixels. Mutation cases confirm
it rejects forward-tiled 11/14 cells, reverse-tiled forward cells and scaled
tile cells.

Code 10 is asserted from the too-short step (`0x4dfe..0x4e0e`;
[engine/window-widgets.md](../../docs/spec/engine/window-widgets.md) rows PV5, TS1, TS2): fixed
when the side's placed extent reaches its fixed-cell sum, width 0 below it.
`sideTooShort` computes the verdict from the recipe and the content delta,
bounding widget-gated codes, and leaves code 10 unknown when the bound
straddles the extent. The −12 samples reach the step; sourced hand traces
(`[14,4,2]` at width 20, `[3,0,2]` at width 5) and checker mutations (code 10
kept below the template, dropped above it) are in the Node test. Widget hit and
press rects (`0x5cb6`) are checked in `src/titleWidgets.test.mjs` and, through
WindowManager overlays, in `window-widget-remap.spec.mjs` (source/built).

These checks do not cover codes 5/2/3/4/15/16/17 (flag-gated), title-anchor
half extents, the second too-short step (shade-widget clear), side draw order,
CopyMask transparency, code-18 scaled pixels, trailing side regions, the
`0x632e`/`0x6062` widget draw pass, ladder misses (where the runtime heuristic
substitutes) or the five corner-sprite archives. An observation test records an
undecoded overrun, with no expected value: the 1138 document-window title bar at
its template size places 107px in 103px. No image or golden is added.

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

### Scroll-bar source rules

`range-rules.mjs` transcribes the 2.3.1 scroll-bar CDEF (`0x997e`, service slot 1) selection
from [range-controls.md](../../docs/spec/range-controls.md), with an address on
every rule: the state bytes (`0x9f7a–0x9fd6`, `0xada2`), the track
`(-8288 | -8280) + tier` with no cross-tier retry (`0xa032–0xa10e`), the
bounds-over-16 composite flag (`0xa14e–0xa184`), the arrow lanes (`0xc338`;
record ids `0x9f0e–0x9f38`, disabled ids `0xc7ba–0xc7fa`) and the thumb
(`0xaed6`, none while disabled). It imports nothing from `src/` and reuses
`checkable-rules.mjs`'s resource-map parse. `range-rules.test.mjs` (Node)
cross-checks that census, each id's bytes and its bounds against the loader,
pins the per-archive composite/icon-lane partition, and predicts the 144 public
rows: 18 archives × horizontal/vertical × normal/pressed/disabled/inactive at
length 120, value 0.5. Public `pressed` names no part, so a pressed row may
match any of hilite 20, 21, 22, 23 or 129. A per-archive mutation table names
which archives each of thirteen wrong readings changes, with a separate table for
the normal rows; the runtime's normal-tier
retry changes none (shown on a minimal fork).

`range-rules.spec.mjs` runs the public `composeScrollbar` in source and built
modes (the paragraph below describes the pre-engine runtime; since the v2 driver
all 144 rows match and the lists are empty) after replacing every candidate cicn and arrow icon of the loaded theme
with a same-size solid sentinel, so each row reports exactly which resources
reached the output. It checks selection only, not art or geometry. The 32
normal rows of 16 archives match. The other 112 rows disagree with the decode
and are pinned per class (R1 pressed/inactive track tier, R2 thumb drawn while
disabled, R3 icon-lane arrows, R4 procedural arrows, R5 non-hit arrow boxes);
a runtime fix must shrink those lists. The ledger records them as mismatched
under issue #374, and the normal rows of 13 archives as verified. Four temporary runtime mutations each
failed the source spec: normal track -8285, thumb orientation swapped, raised
arrows swapped, and a partial R2 fix (which drops 22 rows from the list).

The rows are conditional on modern policy (disabled = hilite 255, inactive =
254, min < max, thickness 16), clear Gestalt(`Acid`) preference bytes, a
non-empty track rect (`0xbbf4`) and thumb rect (`0xab68` length, `0xa97c` position; non-empty at length 120) and an archive-only resource chain. Arrow colour art is `ics8` only, else the 1-bit `ics#`; `ics4` is never used. The track
ppats of apple-lisa, crayon-os, slimes, system7-nostalgia-silver and windows-95
are fetched by the CDEF but never drawn by the runtime; their draw path is not
decoded. Sliders and progress bars have no selection decode and are recorded
as explicit unknowns. No image or golden is added.

### Scroll-bar geometry rules

`scrollbar-geometry-rules.mjs` transcribes the geometry, hit-test, slicing and
fill rows of [engine/scrollbar.md](../../docs/spec/engine/scrollbar.md) (§4.5–§4.8,
§5) under the declared defaults; it imports nothing from `src/`.
`scrollbar-geometry-rules.test.mjs` pins sixteen rows (G1–G16) to the spec's own
numbers: the 1138 worked example (boxes `[0,15)`/`[105,120)`, `T = [15,105)`,
thumb `[52,69)`, segments `[15,53)`/`[68,105)`, halves for the track), the
platinum-8 icon-lane boxes, the thickness-11 thumb slice on 1990, dolphin-som and
evolution (caps of 3: `[0,3)←[0,3)`, `[3,9)←[6,12)`, `[9,11)←[14,16)`), the
TR7 ≤ 11 quirk archives, the pressed-part arrow-box map (20/21/22/23/129), the
part codes, the crayon-os pattern underlay with the control at (13, 5), the
ATIr offscreen rule, draw order, the composite flag and `ics8`-only icon art.
A mutation table names the rows each of 25 wrong readings fails; every row is
failed by at least one. One reading (page split at the thumb edge instead of
its centre) changes no reachable part code; that is recorded as a finding.
Twelve rows that need the runtime's `pressedPart` option or the engine trace
(D1–D12, `DRIVER_ROWS`) keep their spec values as data, pinned against the model.
`scrollbar-driver-binding.test.mjs` compares the v2 engine driver with them
through its trace on each archive's own fork (D2–D6 and D8–D10 agree, including
the #396 answers: a pressed non-hit cell cut from its own cicn's bounds, and a
narrow-source cell that extends past its cicn, whose out-of-source port pixels
stay untouched and are traced unspecified; D11/D12, from the #395 review, pin
that an inactive control draws no arrows (AD4) and that its track rect is `R`
with the whole-bounds source (§5.2, §5.5, on 1984's composite tier-0 track); D7 stays pending because the trace
has no offscreen flag), and `range-rules.spec.mjs` binds D1 through the public
`pressedPart`, source and built. With the engine driver every one of the 144
public rows matches the rule table, so the recorded disagreement lists are
empty.

### Built-in window frame rules (schemes without `wnd#`)

`procedural-frame-rules.mjs` transcribes
[engine/procedural-frame.md](../../docs/spec/engine/procedural-frame.md) (§3–§6):
the frame kDEF 0 draws for the five schemes that ship neither a `wnd#` nor a
`WDEF` -14330 (`apple-platinum-2`, `black-platinum`, `platinum-8`, `slimes`,
`system7-nostalgia-silver`). It imports nothing. The model names sample points
only. `procedural-frame-rules.test.mjs` resolves them against each archive's own
cicn colour table, as raw RGB16 before the bake-time gamma policy. It also checks
that a value-match lookup and the kDEF serialized-palette sampler agree on every
frame and dialog pixel, so the lookup choice cannot matter.

The test pins 31 rows to the spec's own numbers:

- **Selection.** Frame cicn -14332/-14336, dialog cicns, widget ids (close
  -14336, zoom -14334, collapse -14335, `ics#` + `ics8`, never `ics4`), stripe
  layers (`ppat` first, then the scheme's own cicn; slimes is the only `ppat`
  scheme), and grow art.
- **Geometry.** *H* = ascent + descent + 6, made odd, minimum 22. Structure by kind
  (6-px sides and bottom plus the 1-px shadow; dialog outset 6, or 3 when thin).
  Widget slots at *T*.l + 4, *T*.r − 17 and *T*.r − 33, and their drop rules.
  The 17 × 17 grow box at (*C*.r − 15, *C*.b − 15). Title limits, stripe
  segments, message-8 regions, get-features, the §4 / §5 / §5A draw lists and the
  baseline.
- **Colours.** Fill (6, 3), text (7, 3), shadow (9, 3) as a +1/+1 pass only when
  it differs from the text, the drop shadow (0, 0), band and ring colours.
- **State.** Widgets and stripes are drawn only when hilited.
- **Hit codes.** The probe points (*T*.l + 16, *T*.t + 12) and
  (*T*.r − 16, *T*.t + 12), the `ics#` mask test and the title-bar +1 row.
- **Title mode.** The `WdrB` box/joined table.

A mutation table records, for each of 47 wrong readings, which rows fail and in
which scheme × state cells. Every row and every cell fails under at least one
reading. The cells a reading misses are named as findings, for example:

- every corpus shadow sample differs from its text sample, so only a synthetic row
  can fail "always draw the shadow pass";
- apple-platinum-2's two frame cicns sample identically;
- the spec's own "sample row 4" mutation is blind on three inactive frames;
- black-platinum has no `ics4`.

Eleven rows need the engine driver (D1–D11, `DRIVER_ROWS`): requests, regions,
draw order, composed-port pixel probes, slimes pattern fill, glyph plots, font
metrics, the hit message, text passes, the grow op and the dialog ring. They are
todo tests marked "awaits procedural-frame driver". Their spec values are pinned
against the model now.

`procedural-frame.spec.mjs` (source/built, assertion `window.procedural-frame`)
binds D4 and D6 to public `renderWindow`. It reads each archive's raw resource
fork in the page (sit-wasm + `parseResourceFork`) for the §1.1 gate: no `wnd#`,
no WDEF -14330. 1138's fork is the negative control for `wnd#`. No corpus
archive ships a WDEF, so that clause is only a guard. For an active and an
inactive 200 × 140 document window of each of the five archives, it checks the
structure size, every D4 port probe against that archive's own -14332 / -14336
cicn, and the D6 widget slots against each glyph's `ics8` pixels where its `ics#`
mask is set. When inactive, no glyph pixel that differs from the title fill may
show in any of the three slots. It caught a swapped frame state, swapped
zoom/collapse ids, a dropped hilite gate, a 1-px collapse-slot shift, and zoom
and collapse drawn on an inactive window. Mask-clear pixels are not checked. The
frame-state probes cannot fail on apple-platinum-2 (see above).

**Revision 3 (#415): utility family and shared rows.** The same two files bind
spec §9 and the rev-3 shared rows. The model adds `toggleRun` (TG1–TG3, UM1–UM2),
`ctEntry`/`ctEqual` (CT1–CT4), `copyPixel` and `kind5GrowOps` (GB1–GB6, GL1–GL4),
and the utility functions `utilityGeometry` (UI, UG, UP), `utilityFrameOps`
(UFC, UFH, UFS, UFT), `utilityFrameArt` (UFA), `utilityStripes` (US),
`utilityTitleRect`/`utilityTitleOps` (UT), `utilityDrawOrder`/`utilityWidgets`
(UW, UM3), `utilityGrowArt` (UGB) and `utilityHit` (UH). `geometry` now applies
WP1–WP4 as rev 3 states them: the drops depend on *goAway*, and WP3 never drops
the zoom box. Utility readings live under `reading.utility`, so a utility
mutation never touches the document rows. The test pins 42 rows (one or more
per group) to hand-derived spec values and archive facts. 62 named mutations
are pinned in a table. Every row and every per-scheme cell fails under at least
one of them, and every group named above has a failing row. Findings the
corpus cannot discriminate are asserted, not dropped:

- UG5's "+ 1" is invisible for both bar thicknesses that occur.
- UH7's 6-px drag band is covered by the content and *T*.
- apple-platinum-2's utility frames are pixel-identical by state.
- Every corpus colour table has value = position, so CT1–CT3 are synthetic-only.
- Every utility frame and grow cicn mask is all ones, so GB3 = GB3a on the corpus.
- Every utility shadow sample equals its fill, so UT7 never draws the shadow pass.

The rows also cover the #421 review's N5 (UT6 with an even ascent + descent)
and N6 (the 4-px US4 boundary).

`procedural-frame-utility.spec.mjs` (source/built, assertion
`window.procedural-frame-utility`) drives public `renderWindow` for the five
reachable utility types on all five archives, active and inactive, 160 × 90
content titled "Inspector". The legacy aliases `collapsed-titled-utility` and
`collapsed-side-utility` are driven too. `collapsed-no-title-utility-window` is
excluded: the loader does not expose it (#423). Expectations come from
`utilityPlan`, the rule model placed at the structure origin, resolved against
each archive's own -14316/-14320 (side -14315/-14319) frame cicns, -14314
(side -14318, else -14314) stripes and -14320/-14318/-14319 glyphs. It checks:

- **Routing.** Every slug, canonical or legacy, draws the utility family. A
  legacy alias draws the same pixels as its canonical slug.
- **Geometry.** Structure size and `ComposedChrome.frame` insets per type
  (UG1–UG3, UI10). The collapsed titled bar equals the expanded one (#421 B2).
- **Frame selection.** Probes on the UFC/UFH/UFS rows and columns and the UFT3
  shadow equal the drawn state's cicn sample points. Probes where a widget
  glyph could land are checked only when inactive. Frame state discriminates on
  every archive but apple-platinum-2.
- **Inactive windows.** One 9-px period of the stripes band holds each tile
  row when active and only the fill when inactive. No widget box shows a
  discriminating glyph pixel when inactive, and at least one does when active.
  An inactive type that draws no title (no-title, side) shows only the fill
  across its whole frame interior (#424 review N3).

Eleven runtime mutations were run in a scratch worktree, source and built. Ten
failed it: #421 B1 reverted to a direct slug lookup, B2's title gate reverted,
UFA1 horizontal and side states swapped, UFH9 transposed, the UW4 and UW2
hilite gates dropped, UG2 raised by *H* − 2, US1's band moved one row, and UI10
titled *H* 14. One survived: UFH7 sampling P(6, i) instead of P(4, i). That
reading is invisible on this corpus, because P(6, i) = P(4, i) for rows 0–2 of
every frame cicn. A twelfth, added for review N3, draws the title on
no-title-utility-window while keeping *H* at 13. It fails only the
interior check, in source and built mode. The fill outside the band (except
on untitled inactive windows), the title raster and the masked corners are
not checked.

### Tab and header source rules

`tab-header-rules.mjs` restates the CDEF 8 tab selection and 0x16e body painter
([tab-cdef8-body.md](../../docs/spec/tab-cdef8-body.md#corpus-rule-table-2026-10-21)),
and the PACH 130 header selection, regions, body and pattern anchor
([header-surface.md](../../docs/spec/header-surface.md#corpus-rule-table-2026-10-21)).
It imports nothing from `src/`. `tab-header-corpus.mjs` parses each archive's
resource map itself: ids, raw cinf bytes and the ppat census. It takes rasters,
patterns and raw background samples from the shared decoder, after checking the
decoder's bytes for each id against its own parse. `tab-header-rules.test.mjs`
(Node) pins three things:

- the corpus partition: 14 archives with tab art, 13 with header art, no fallback
  or pressed-front ids, animals -9984 without a cinf, and apple-platinum-2's
  panes without a cinf;
- the decoded branches that the public API does not reach;
- literal rows for both models, where each wrong reading must change pixels.

`tab-header-rules.spec.mjs` runs `composeTab` (two rows, using the runtime's
width) and `composeHeaderSurface` (24 rows) in source and built modes for all
18 archives. Every rule-fixed pixel must match. It pins four things:

- the rows that match another candidate id, which cannot discriminate selection;
- the per-archive tables of which wrong reading each archive fails;
- the 1,664 unasserted crayon-os tab centre pixels (ppat 17, legacy path);
- the runtime's small-to-large retry. The decode probes `-9960+state`; only the
  four archives without tab art reach this retry. Under the declared archive-only
  chain nothing is drawn there. The 2.3.1 control-panel fork ships the
  clut-recoloured fallback ids, though, so the original probably draws a tab where
  the runtime returns null (a probable divergence).

Seven temporary runtime mutations each failed the source spec:

- tab selected ignored, large variant first, band always repeats and centre
  skipped;
- header polarity swapped, list-view extension removed and pattern mode
  ignored.

An eighth mutation, the tab background sample read with x and y swapped, changed
no corpus row. Width, panes, disabled/pressed tabs, the original pattern offset
`R`, resource files and `composeListHeader` are not covered. No image or golden
is added.
