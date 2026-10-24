# Theme authoring UX: analysis and implementation decisions

This evolves the first source-preserving prototype in [#475](https://github.com/khawkins98/scriptoscope/pull/475), within the architecture investigation [#472](https://github.com/khawkins98/scriptoscope/issues/472). The editing document remains source-backed v0; this pass changes the authoring experience without adopting another renderer or format.

## Reference analysis

| Reference                                                                                                                                                               | Documented pattern                                                                   | Decision for this app                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ThemeRoller](https://jqueryui.com/themeroller/)                                                                                                                        | Settings update a gallery of live controls; presets can be customized and downloaded | Keep a real specimen visible and support an imported-original comparison. Expand the gallery only as component mappings become trustworthy.                                              |
| [Godot theme editor](https://docs.godotengine.org/en/stable/tutorials/ui/gui_using_theme_editor.html)                                                                   | Preview picker, grouped theme properties, visible defaults and explicit overrides    | Select the component/state from the specimen; show edited markers and exact per-property resets. This is UX reuse, not an engine dependency.                                             |
| [Penpot variants](https://help.penpot.app/user-guide/design-systems/variants/) and [component overrides](https://help.penpot.app/user-guide/design-systems/components/) | Named state dimensions and overrides within a component                              | One Push button with Normal/Pressed/Disabled states and one Document window with Active/Inactive states. Preserve independent state geometry; never silently link equal-looking records. |
| [Piskel](https://www.piskelapp.com/)                                                                                                                                    | Pixel artwork alongside a live preview                                               | Separate Theme preview and Artwork surfaces. Provide integer zoom, transparency background and independently adjustable geometry guides. Defer brushes, layers and image replacement.    |
| [Themix](https://github.com/themix-project/themix-gui)                                                                                                                  | Theme authoring and target-specific import/export plugins                            | Keep source project saving distinct from destination-specific exports. Export settings, coverage and approximations belong to future adapters; no inactive export UI is added now.       |

These sources establish useful interaction patterns. The mapping and prioritization below are our design decisions, not claims that the projects implement Kaleidoscope semantics. We reuse patterns in the existing React app rather than adding an entire editor dependency.

## Problems in the first prototype

The resource list exposes historical names and numbers before explaining the component being edited. Different state images appear as separate entries. Numeric geometry fields have no direct manipulation. A user must remember what changed and use global undo to restore a single property. The preview cannot be used to select a component or inspect the original. Precise RGB16 controls are useful but dominate ordinary color edits.

The first workbench pass framed the task as **choose a component → choose a state → edit its appearance → check the result → save**. The task review in [USABILITY.md](./USABILITY.md) showed that users still had to infer design roles from source palettes; the primary workflow below supersedes that emphasis. Raw records remain available for inspection, source recovery and unsupported components.

## Advanced source workbench interaction contract

### Navigation and state

The default left panel lists named component families. A separate Resources view retains search, original labels and occurrence identities. The selected component has a labelled state strip with rendered button thumbnails (source thumbnails for admitted window artwork) and edited markers. Selecting a state updates the inspector and artwork view; selecting a document state also updates the specimen's active/inactive window state.

Only two component families are admitted initially. Push-button face selection follows the engine's declared source request and selected manifest entry. Sliced document artwork follows the current window resolver. Both require the decoder's exact `cicnSource.resourceIndex` to match the retained resource occurrence. Author labels, asset filenames, matching colors and the first raw record with a coincident ID are not role evidence. Procedural/multi-asset or unsupported window selections remain explicitly unavailable in this single-artwork inspector. The resource view is still usable.

Clicking or keyboard-activating a specimen selection target selects its component and state. The specimen is an inspection surface; its rendered disabled button can still be selected for editing. Selection targets are HTML controls outside the renderer's source pixels. No interactive runtime behavior is changed. A face selection does not claim to encompass every body-pattern, ring or font dependency.

### Preview and artwork surfaces

Theme preview uses the existing renderer at multiple sizes. Working/Original comparison switches to a separately loaded, retained original fork under the same standalone policy. Comparison never resets edits and never changes saved data. Editing controls are disabled while viewing the original to avoid invisible edits; returning to Working restores the edited view.

Artwork displays source pixels at integer zoom. Corner and side measurements remain independent source fields, not one generic nine-patch margin. C adjusts corner size horizontally; S adjusts side thickness vertically. Pointer motion updates only a temporary guide; pointer-up commits one undoable operation. Escape, pointer cancellation and loss of capture discard the draft. Keyboard arrows adjust one pixel; Home/End retain the source byte range. Out-of-template values remain intact and are explained, rather than silently normalized. These guides are source measurements, not a replacement specification for the engine's border/body behavior. Window recipes are not simplified into these two fields.

### Overrides and reversibility

Edited status is per palette color, geometry field and component state. Reset color restores all three original 16-bit channels. Each geometry field can reset independently. Reset selected artwork removes its palette edits and unique matching geometry edits as one undoable action. Shared source occurrences remain shared: a reset is explained as a source-record operation and may affect more than one component/state that uses that record. No theme-wide color linking is inferred.

The color picker remains an explicitly source-RGB picker in this iteration. Exact RGB16 values move under an advanced disclosure; using the picker deliberately writes an 8-bit source color while untouched entries remain exact. The displayed swatches and specimen apply the existing runtime display policy. A future display-color picker needs a documented inverse/quantization policy and separate tests.

### Save and future exports

Save project, Open project and Recover original retain their existing guarantees. There is no export-format change. A future export flow should choose a target, show supported/approximate/unavailable components, preview the target where available, then produce target files plus an external-edit map. Ordinary Save must not be confused with edited classic export or Linux publication.

## Acceptance for this iteration

- Component/state selection from the sidebar, state strip and specimen agrees with admitted decoder occurrences; unknown/ambiguous mappings are not guessed.
- Resource search remains available and duplicate records retain separate occurrence identities.
- Selected palette/geometry resets restore exact original values, preserve other edits and support undo/redo.
- Original comparison is pixel-equal to the imported baseline under the same renderer policy, leaves edits unchanged and disables editing until Working is restored.
- Guide dragging commits one history operation, keyboard changes are accessible, and Escape/cancellation commits nothing.
- Source recovery and fresh-session project reopen continue to preserve bytes and intended rendered edits.
- Narrow-screen layout, focus indication, reduced motion and automated accessibility checks remain part of verification.

## Deferred, intentionally

Broader control families, pattern/body dependency navigation, full window-recipe editing, a paint editor, shared palette tokens, state generation, target-native previews, Linux adapters and a compiled web format require their own mappings and tests. An infinite canvas or scene graph is not required for the current authoring task.

## Verification (2026-10-24)

The implementation keeps the existing source-backed document and renderer. The semantic mapping helper admits only matching decoder occurrences; tests include duplicate IDs, missing provenance and absent assets. Its reset test proves unrelated operations survive and ambiguous geometry is not inferred.

The original 10 model tests, the companion typecheck/production build, and the expanded Chromium round-trip scenario pass. Browser coverage includes all three selection entry points, active/inactive synchronization, original pixels and disabled edit controls, exact color reset, independent geometry reset, whole-artwork reset/undo, pointer commit as one undo step, keyboard adjustment, Escape/pointer-cancel/lost-capture cancellation, resource search, save/reopen and original recovery. The 390px overflow check passes. Root typecheck and clean-room lint also pass; this iteration changes no core renderer code.

Desktop preview and artwork surfaces were inspected in Chromium. Automated axe WCAG A/AA checks reported zero violations on both surfaces after correcting selected-state label contrast. Axe leaves some contrast checks incomplete because of patterned backgrounds; this result is not a full accessibility conformance claim. Narrow layouts use explicit Explorer / Workspace / Properties panel navigation rather than compressing editing controls.

The next useful UX work is a dependency-aware component inventory: distinguish face artwork, body patterns, rings, text and window recipe dependencies before expanding beyond the two admitted families. That should precede any generic nine-slice editor or automatic linking of similar-looking colors.

## Astra workbench overhaul and designer review

The earlier visual pass established a conventional three-column editor. This overhaul makes the authoring relationship explicit: **component → state → source occurrence → appearance / overrides**. The main surface is the live result; the source dock is a deliberate inspection and geometry workspace. Selecting an exact source pixel connects the two without inventing paint, tokens, state inheritance, or a generic nine-slice model.

### Hierarchy and working context

| Before                                                         | After                                                                                                                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Separate brand and project bars consumed vertical space        | A single charcoal project bar groups identity, local save status and file actions. Cool neutral surfaces and indigo selection keep attention on imported artwork.                                                                     |
| Source thumbnails made states look like disconnected assets    | The button state rail uses `composeButton` with named states; the same occurrence mapping drives the library, rail, specimen and inspector. Pending or unsupported compositions clear their old thumbnails.                           |
| A selected component's title mixed semantic and raw identity   | A component heading, selected-state breadcrumb and subordinate source ID separate the levels. Exact occurrence identity remains in the inspector.                                                                                     |
| The specimen competed with a narrow source card                | The full-width live specimen is primary; the source editing dock follows. Preview-only and focused-source views retain the same selection. The shorter specimen content keeps its complete frame visible at the default desktop size. |
| Source guide interactions were hard to discover below the fold | The dock has **Expand source / Back to specimen**. The inspector provides **Open source artwork** and **Adjust guides in source**, each opening the same selected source.                                                             |
| Many small bordered cards had equal visual weight              | Restrained section dividers, soft shadows, consistent nested corners and a small set of selection/status colors establish hierarchy. System typography uses tabular numbers, smoothing and balanced headings.                         |

### Source selection and appearance

| Before                                                             | After                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A user had to guess which swatch controlled a pixel                | Click or keyboard-navigate a source pixel to select its exact palette record. Selection reads indexed data, not gamma-corrected canvas RGB. A coordinate/index/record readout confirms the relationship.                                                           |
| Equal colors or duplicate indices could invite incorrect inference | Positional tables use record position; explicit tables require a unique index match. Duplicate, missing and transparent mappings explain why the editor cannot pick a record. The palette remains available for explicit selection.                                |
| The artwork surface offered only zoom and geometry                 | An optional pixel grid and visible pixel cursor support close inspection. Source pixels remain read-only; C/S retain their independent geometry semantics and gesture history.                                                                                     |
| Palette buttons lacked identity and edit status                    | Numbered record swatches and warm override dots distinguish source records, selected color and modified values. The inspector shows display hex and original/working swatches for edited colors while preserving the source RGB picker and exact RGB16 disclosure. |
| Source usage was only described in generic helper copy             | A scope card lists verified admitted states using the exact occurrence, links back to them, and explains that face artwork excludes body patterns, rings and text. It explicitly does not claim a complete dependency inventory.                                   |

### Overrides and navigation

| Before                                                                  | After                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only a global raw Changes list explained edits                          | **Appearance / Overrides** gives a scoped review of the selected artwork, original/working values and individual undoable operation resets. Original comparison disables these resets.                                             |
| Selecting an override discarded component context                       | Global Changes uses semantic component/state labels when admitted and returns to that state and exact palette record. Unknown raw resources retain raw identity; ambiguous geometry targets stay unavailable.                      |
| Phone source inspection and color editing required manual panel hunting | The source surface has **Edit color record →**; inspector source/guide actions return directly to the workspace. Panel navigation retains selection and original comparison.                                                       |
| Keyboard and pointer behavior could diverge                             | Pixel selection works with pointer, arrows and Enter; existing field undo, editor undo/redo, guide cancellation and source preservation remain unchanged. Focus indicators, 40px actions and reduced-motion behavior are retained. |

### Verification and limits

The model suite now has 11 tests, including explicit/positional index lookup, duplicate and missing palette records, transparent pixels, the decoder's opaque-outside-mask compatibility behavior and invalid coordinates. The browser round trip checks rendered state thumbnails, pointer/keyboard pixel selection without creating edits, expand/return navigation, local override resets and read-only comparison, then the existing geometry/history/source recovery/reopen checks. Phone coverage includes source-to-color and inspector-to-source navigation and overflow.

The companion build and root clean-room lint pass. Desktop, focused-source, edited-override and phone surfaces are inspected with Chromium. Automated axe WCAG A/AA checks are used to catch contrast and structure regressions; patterned backgrounds and non-text symbols still require manual review. This is not a full conformance claim.

`project.ts`, renderer core and the experimental document profile are unchanged. There are no new runtime dependencies, theme-wide color tokens, inferred state inheritance, paint tools or target-export controls in this pass. The next semantic expansion remains a real dependency inventory and explicit target adapters, as described in #472.

## Primary named-property authoring

The [task-based review](./USABILITY.md) established that the source workbench remained a source editor, even after visual polishing. The implemented primary flow now follows the useful Themix relationship: **starting theme → named property sheet → compact persistent gallery**. The advanced workbench remains available, with its preservation guarantees, but no palette-record knowledge is needed for the supported button variation task.

### Authoring relationship

| Before                                                        | After                                                                                                                                                                                                                            |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component/source selection was the entry point                | A starting-theme rail, primary **Theme properties** sheet and compact all-state gallery are the default. **Advanced source** is an explicit separate workspace.                                                                  |
| Background and label colors required guessing swatches        | Verified **Button face color**, **Button label color** and, where admitted, **Label emboss color** bind to declared source samples. Unsupported roles show a reason, with no fabricated color control.                           |
| Each state required rediscovering its palette                 | **All states / Normal / Pressed / Disabled** sets operation scope. Each role lists its actual affected states; partial coverage has a visible warning. Mixed preview values are identified explicitly.                           |
| A family variation was a sequence of manual edits             | **Apply amber variation** assigns coordinated, distinct face/label colors through verified bindings as one history operation. Partial admission uses an explicit supported-states action; linked-role conflicts fail atomically. |
| Source RGB had to be understood before picking a modern color | Named controls use preview RGB, with a nearest-representable-source conversion. Advanced source still provides raw source RGB and exact RGB16.                                                                                   |
| A “background” edit could silently recolor outlines           | Each property explains shared artwork effects. Coupled roles and unselected states sharing a source color are called out; no independent-state copy is implied.                                                                  |
| Only per-record reset was available                           | Reset one named role or the button-color group in the selected scope as one undoable operation. Each binding resets to its own exact imported values.                                                                            |
| Preview and editing competed at short heights                 | A compact three-state gallery remains alongside the property sheet at desktop sizes, with tighter spacing at short heights. Narrow screens start with **Properties**, with **Bases / Preview** panel navigation.                 |
| Output limitations appeared late                              | **Project only · reopen in Studio** sits beside Save. Coverage identifies window artwork as advanced-only and global accent as unbound; the gallery explains that installable exports are not available.                         |
| Semantic resource names were hard to find                     | Advanced resource search includes admitted component/state aliases as well as original names and IDs.                                                                                                                            |

### Binding and color contract

`profile.ts` derives bindings from the retained original theme and its source, never from a freshly recolored preview. Admission requires the renderer-selected push-button occurrence, unique same-ID `cinf`, declared source anchor agreement and exact original RGB16 sample agreement. Button role sampling follows the current kdef sampler policy, which ignores `ctFlags` and mask alpha; that is deliberately separate from the ordinary indexed-pixel picker in Advanced source. Unknown or ambiguous bindings are unavailable rather than guessed from equal colors, resource names or matching indices across states.

Operations compile to the existing palette edits. They do not add a persisted operation type or change v0 project meaning. Role edits and coordinated variations are batched into one project history step. Shared bindings stay shared. The amber recipe uses different state tones and checks readable label contrast under the current display policy; it does not recolor unrelated window/artwork resources or create missing effects.

`colors.ts` defines the named-picker policy: search the existing 256-level source-to-preview lookup for the nearest preview channel, break ties toward the lower source channel, then expand by 257. This is an explicit quantization policy under the renderer's declared display approximation, not full color management or an inverse used on imported colors. Unchanged uniform displayed values do not trigger edits. A deliberate all-state assignment may quantize targeted members; untouched roles/states and all stored original bytes retain exact precision. Exact source values remain inspectable in Advanced source.

### Acceptance and verification

The primary browser acceptance task starts with 1138 and applies one amber variation, proves all three rendered button states change, proves one Undo restores all three, edits only Pressed, resets faces while retaining the Disabled label override, resets the full named group, compares read-only Original, saves and reopens in a fresh context with identical gallery pixels. It then runs the existing advanced palette/geometry/history/download/source recovery regressions. Phone coverage checks property-first navigation, gallery-to-state selection, comparison, starter access and overflow. Semantic resource search is also covered.

The model suite covers role admission, original precision, same-source coupling/conflicts, recipe byte boundaries and reopen, readable recipe contrast and nearest-preview-color quantization. No renderer-core or source-document changes, new runtime dependencies, Linux adapters, window semantic controls or global accent controls are introduced by this slice.
