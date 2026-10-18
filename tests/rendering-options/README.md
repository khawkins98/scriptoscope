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
