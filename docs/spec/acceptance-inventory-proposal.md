# Proposed acceptance inventory

Version **0.1.0 — DRAFT**. Inventory closure **OPEN**. API/source snapshot: `619840a8b6fae97ae9702e796a96ed8aa554a91d`.

This is a reviewable proposal for the full 18-scheme target in the [compatibility contract](fidelity-compatibility-contract.md#surfaces-and-option-classes), not a replacement contract or a claim of exhaustive acceptance. It proposes stable classes and identifies the concrete records still needed to freeze the inventory. No new tests, expected pixels, eligibility rules or verified assessments are registered here. The existing 32 cases / 269 obligations / 50 verified assessments and original-reference bindings are unchanged.

A [machine-readable envelope draft](acceptance-envelope-proposal.json) now
materializes all 18 source references × 15 families through their 33 currently
exposed family/path bindings (594 required cells), with a newer explicit API
snapshot. Its option domains retain omission and its unresolved combinations,
boundaries and evidence remain OPEN/UNKNOWN. This is planning data, not registered
tests, an exhaustive option product, or inventory closure; the historical proposal
snapshot and existing normative/evidence registries are unchanged.

## Input authority and proposed record identity

The single scheme catalog remains [source-choices.json](../../tests/control-availability/source-choices.json), all **18** `sources` entries, with no filtering by available art or evidence. Snapshot SHA-256: `2d5a74527fa2c9c3bfc2c4c486bbfb2c41b8de2690dff69e7f27145775aca487`. Each proposed cell references the registry slug and its exact archive/entry/fork identity; this document does not duplicate that catalog. Changed source choices require inventory review.

Proposed cell ID: `acceptance/<slug>/<family>/<path>/<option-class-set>/<input-instance>`. Family, path and class tokens below are stable proposed IDs; concrete instance IDs, exact values and legal combinations are **not yet frozen**. A cell must carry:

- Exact source reference, ordered base references (or explicit no-base), API/markup, requested options including omission, dimensions, labels and environment/provider identities.
- Expected availability and base/provider outcome: **UNKNOWN** unless an existing reviewed record covers that exact input and claim. Link that record; never lift a general policy into historical selection truth.
- Applicable evidence obligations, proposed boundary-invariant IDs, and links to existing tests/observations as coverage only. Record unsupported behavior and missing evidence without deleting the cell.
- A reviewed reason for any inapplicable path/dimension; lack of art or implementation is not grounds to remove a contracted family from a scheme.

## Paths

| ID | Public boundary and locator | Distinct obligations |
| --- | --- | --- |
| `pixels` | `compose*` exports in [src/index.ts](../../src/index.ts), options below | Selection, decoding, composition and output alpha; no implied DOM interaction |
| `interactive` | `interactiveButton`, `interactiveCheckbox`, `radioGroup`, `interactiveDisclosure`, `interactiveSlider`, `interactiveScrollbar`; options in [interactive.ts](../../src/interactive.ts) | Actual pointer/keyboard state, callbacks, scale, focus and owned lifecycle |
| `promoted` | `mountDeclarative`, `promoteButton`, `promoteTabs`; [scanner.ts](../../src/declarative/scanner.ts), [control.ts](../../src/declarative/control.ts), [parse.ts](../../src/declarative/parse.ts) | Supported markup/native properties, naming, value/event preservation, retheme/disconnect/reconnect; direct promotion versus scanner ownership |
| `window-render` | `renderWindow` / `RenderWindowOptions` in [renderWindow.ts](../../src/renderWindow.ts) | Chrome plus title/content/CSS placement |
| `window-manager` | `WindowManager`, `titleWidgetHits` in [interactive.ts](../../src/interactive.ts) | Widgets, focus, move/resize/collapse, asynchronous retheme and content ports |
| `window-promoted` | `ScriptoscopeWindow`, `mountDeclarative` in [declarative/index.ts](../../src/declarative/index.ts) | Parsed attributes, slotted content and manager integration |
| `managed-context` | `bindButtonToContentPort`, `setButtonCompositionContext` in [buttonComposition.ts](../../src/buttonComposition.ts) | Explicit binding or scanner adoption, measured scale/clip, refresh, reparenting and disposal |

These paths are not interchangeable. Native range constraints are not the imperative normalized slider contract. Markup cannot acquire a size/state attribute merely to fill a grid.

## Families and finite option classes

Within a row, each slash-separated token after the class prefix is a proposed class ID. Boolean options retain omitted/false/true distinctions until reviewed equivalence allows consolidation. Legal products and concrete representatives remain to be reviewed, including simultaneous flags and error boundaries.

| Family ID / paths | API and options locator | Proposed finite classes (plus applicable shared classes below) |
| --- | --- | --- |
| `push`, `default` / `pixels`, `interactive`, `promoted`, `managed-context` | `ButtonOptions`, `composeButton` in [controls.ts](../../src/controls.ts); `InteractiveButtonOptions` | `button.state/normal/pressed/disabled/pressed-disabled`; `button.ring/omitted/off/on`; `button.size/auto/minWidth/height/both`; `button.ink/authored/fg-override`; `push.font/browser/prepared-strike`. Ring requests do not establish DialogManager default selection or Return handling. |
| `bevel` / `pixels` | `BevelButtonOptions`, `composeBevelButton` in [controls.ts](../../src/controls.ts) | `bevel.state/off/on` crossed with pressed/disabled flags; `bevel.size/small/large`, minWidth/height omission and overrides; fontSize, label, fg and compositionContext. No prepared-strike or imperative bevel API invented. |
| `list-columns` / `pixels` | `ListHeaderOptions`, `ListHeaderColumn`, `composeListHeader` in [controls.ts](../../src/controls.ts) | `columns.count/omitted/empty/one/multiple`; `columns.width/equal/unequal/boundary`; `columns.height/auto/explicit`; inactive flag and per-column labels. |
| `header-surface` / `pixels` | `HeaderSurfaceOptions`, result/reason unions in [headerSurface.ts](../../src/headerSurface.ts) | `header.kind/window-header/list-view-header`; `header.state/zero/nonzero/invalid`; exact Rect/context; `header.admission/rendered/unavailable/unsupported/error`, with every current reason kept distinct. Body/sampling cases include unsupported patterns/mode5, not just the implemented solid subset. |
| `checkbox`, `radio` / `pixels`, `interactive`, `promoted` | `composeCheckable` in [controls.ts](../../src/controls.ts); `InteractiveCheckableOptions`, `RadioGroupOptions` in [interactive.ts](../../src/interactive.ts) | `check.flags/checked/mixed/disabled` legal combinations; label/fg; `radio.group/single/multiple/selection-change`. Inspect each path's actual options: mixed on a direct radio is not proof of native radio semantics. |
| `select` / `promoted` | Native select preparation in [control.ts](../../src/declarative/control.ts) | `select.label/empty/short/long/ink`; `select.state/enabled/disabled`; selection change and retheme. Closed face only; native popup behavior stays separately classified. |
| `slider` / `pixels`, `interactive`, `promoted` | `SliderOptions` in [controls.ts](../../src/controls.ts), `InteractiveSliderOptions`, native adapter in [interactive.ts](../../src/interactive.ts) | `slider.axis/horizontal/vertical` where exposed; `slider.state/normal/pressed/disabled/inactive` direct; length/value classes. `slider.native/bounds/step-any/step-finite/fieldset-disabled/legend-exempt` and live native updates remain separate from normalized imperative values. |
| `progress` / `pixels` | `ProgressOptions`, `composeProgress` in [controls.ts](../../src/controls.ts) | `progress.state/normal/pressed/disabled/inactive` accepted ControlState inputs, outcomes unproven; length/value classes. No public orientation option invented. |
| `scrollbar` / `pixels`, `interactive` | `ScrollbarOptions` in [controls.ts](../../src/controls.ts), `InteractiveScrollbarOptions` in [interactive.ts](../../src/interactive.ts) | `scrollbar.axis/horizontal/vertical`; direct ControlState classes; `scrollbar.thumb/proportional/fixed`, extent and length/value boundaries. Imperative options lack the direct proportional switch. |
| `tab` / `pixels`, `promoted` | `TabOptions`, `composeTab` in [controls.ts](../../src/controls.ts); [tabs.ts](../../src/declarative/tabs.ts) | `tab.selected/omitted/off/on`; labels; `tab.group/one/multiple/panel-switch`; actual small/large art and supported/legacy body selection, not a caller size option. |
| `disclosure` / `pixels`, `interactive` | `DisclosureOptions` in [controls.ts](../../src/controls.ts), `InteractiveDisclosureOptions` in [interactive.ts](../../src/interactive.ts) | `disclosure.direction/right/down`; direct ControlState classes; imperative open/toggle and scale. Authored dimensions only. |
| `growbox` / `pixels` | `composeGrowBox(theme,{state})` in [controls.ts](../../src/controls.ts) | `growbox.state/normal/pressed/disabled/inactive` accepted ControlState inputs and authored dimensions; shared active-art behavior is not historical state equivalence, no caller size API. |
| `window` / `pixels`, `window-render`, `window-manager`, `window-promoted` | `composeWindowChrome` in [composeChrome.ts](../../src/composeChrome.ts), `composeCornerSpriteChrome` in [composeCornerSprite.ts](../../src/composeCornerSprite.ts), `RenderWindowOptions` | `window.model/parts/corner-sprite`; `window.type/canonical/legacy-alias/raw-key/exact-custom`; `window.state/active/inactive/collapsed-active/collapsed-inactive` ([WindowState](../../src/types.ts)); title/size/scale; `window.widget/none/close/zoom/collapse`; expanded/collapsed and reuseCanvas. Enumerate actual types and aliases per scheme, including missing variants and base fallback. Low-level `cinf`/`titleWidthPx` and all `CornerSpriteOptions` resource/color/title/widget inputs need distinct concrete bindings, not assumed equivalence to `renderWindow`. |

## Shared class catalog and boundary proposals

Classes partition inputs for planning; representative values are not asserted equivalent. Every boundary justification below is **UNKNOWN** for full-target coverage, even where narrower existing source assertions can later be linked. Retain omitted/explicit/default/error cases until their relationship is justified.

| Class ID / finite members | Proposed invariant ID and review needed |
| --- | --- |
| `size/auto/native/minimum/below-minimum/representative/resized` | `boundary.size`: identify each actual art/layout transition, clamping and auto-size versus forced clipping; exact minimum/native values are source-specific, not universal 32×12/80×20 presets. |
| `repeat/empty-span/one-pixel/exact-tile/partial-tail/overlap` | `boundary.slices`: classify source corner/side dimensions, masked overlap, repetition/sample branches and tails; retain unsupported or unsafe source geometry. |
| `value/min/interior/max/outside/nonfinite`; `extent/zero/interior/full/outside` | `boundary.range`: prove normalized mapping, native sanitization and rounding separately; include zero travel and changing thumb extents. |
| `label/empty/short/long/ink/space/unsupported` | `boundary.text`: separate advance, ink overhang, clipping and automatic sizing; arbitrary text/encoding/provider behavior is not certified by four strings. |
| `font/browser-default/nominal-override/prepared-strike/mismatch` | `boundary.font`: finite>=6 nominal bounds, exact strike size, glyph coverage and metrics; unsupported labels/context remain explicit. Provider identity stays unknown absent evidence. |
| `context/omitted/explicit/managed`; `clip/full/partial/empty/unknown`; `origin/local/translated/negative/unknown` | `boundary.port`: port/control/pattern origins and body modes, clipping, pattern phase, signed limits and unsupported mapping. Inspect [ControlCompositionContext](../../src/controlComposition.ts); no inferred original state from defaults. |
| `scale/unit/integer-upscale/unsupported-mapping`; `layout/stable/reflow/scroll/reparent` | `boundary.placement`: CSS/content mapping and managed adoption, not DPR/font/device equivalence; direct control and window scaling policies differ. |
| `display/legacy/prepared-profile/incompatible`; `color/authored/caller-override` | `boundary.color`: exact RGB16 tuple coverage, device/producer conditions, raw-versus-decoded sampling, alpha and declared display-domain colors; no extrapolation from one finite profile. |
| `owner/self/base/missing/ambiguous`; `load/raw/pre-extracted/registered` | `boundary.ownership`: exact ordered base inputs, alias and state fallback, profile compatibility, borrowed/owned lifetime and asynchronous failure. Current manifest policy is distinct from historical resource search. |
| `lifecycle/initial/update/retheme/disconnect/remount/pending-cancel`; `input/pointer/keyboard/programmatic` | `boundary.integration`: actual public path's state/events/accessibility/consumer ownership and async commit behavior; do not infer interaction from pixels. |
| `request/valid/omitted/invalid`; `diagnostics/off/on/concurrent/error` | `boundary.admission`: validation, unavailable/unsupported/error distinctions and completed paint identity; tracing is not independent selection proof. |

The numeric values, strings, contexts and source resources for each class must be recorded before a concrete cell is frozen. Whole-header UInt32 nonzero equivalence, arbitrary lengths and labels, base chains and window aliases each require their own applicable justification; a convenient Cartesian sample does not supply it.

## Export-to-scope reconciliation

The two entry points are [src/index.ts](../../src/index.ts) and [src/declarative/index.ts](../../src/declarative/index.ts). These classifications preserve the contract's themed chrome/closed-face target while making adjacent behavior visible for review; they do not certify any export.

| Export group | Proposed inventory treatment |
| --- | --- |
| Themed `compose*`, `renderWindow`, `interactive*`, `radioGroup`, `WindowManager`, `titleWidgetHits`, promotion/window entry points | Family/path rows above; low-level chrome results and high-level DOM outputs need separate obligations. |
| `loadTheme`, `loadKaleidoscopeScheme`, `assetUrl`, `findChromeElement`, resolver/bootstrap/drop-zone APIs, `prepareDisplayProfile`, `prepareBitmapFont` | Input/decoding/ownership/provider dependencies of cells, plus API failure/lifetime obligations; arbitrary BYO schemes are not silently added to the fixed historical 18. |
| `bindButtonToContentPort`, `setButtonCompositionContext`, public context/measurement types | Managed-context/placement classes; no second theme resolver or presumed original port state. |
| `platinum*` including menus/menu bar/popup/list header; `baselineButton`, `baselineCheckable` | Explicit procedural compatibility outputs or fallback dependencies. Keep browser/product behavior obligations separate; do not represent them as an original scheme's authored pixels or silently expand the historical target to every menu feature. |
| `promoteField`, `isFieldEligible`, `promoteIcon`, `ICON_NAMES`, theme picker/synchronization, `openModal`, parsing/URL helpers, public markers | Native/product/declarative integration; map any actual contracted window/control dependency to its cell. Remaining product behavior is separately classified, not evidence of historical fidelity. This boundary still needs review. |
| `PixelBuffer`, `loadCicnBuffer`, `rasterizeText`, `bufferToCanvas`, `frameFromBody`, `partRole`, debug/version, public types | Shared decoding/raster/transport/support contracts; capture their effects in applicable cells, without inventing extra historical surfaces or excluding dependency failures. |

## What must be reviewed before inventory closure

1. Materialize every source-registry entry × contracted family, then the legal paths/options above; list missing implementation/art/evidence rather than omit it. Resolve every unassigned option/export and exact alias/base input; review any proposed inapplicability explicitly.
2. For every concrete cell assign selection, decoding, geometry, fill/mask, typography, state, placement, interaction and distribution obligations with limits. The current seven ledger dimensions are not exhaustive. Source/built/package and browser/CSS conditions are execution dimensions, not interchangeable fidelity evidence.
3. Justify each boundary invariant from applicable source/reference evidence or retain it unknown with the unresolved input domain visible. Review finite-combination reduction explicitly; do not silently treat pairwise or diagonal coverage as exhaustive.
4. Link exact existing [availability records](../../tests/control-availability/expectations.json), [requirement assessments](../../tests/rendering-requirements/ledger.json), [matrix samples](../../tests/rendering-options/cases.mjs) and [original observations](../../tests/reference-captures/README.md). Preserve their distinct scopes; reviewed goldens establish regression stability, not historical expected pixels.
5. Independently review the resulting inventory and only then propose its frozen version. This draft itself closes neither the inventory nor fidelity; unknown availability, provider, evidence and boundary justification remain counted work. No overall percentage is authorized.
