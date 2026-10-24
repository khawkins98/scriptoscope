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

The central task should read: **choose a component → choose a state → edit its appearance → check the result → save**. Raw records remain available for inspection, source recovery and unsupported components.

## Interaction contract

### Navigation and state

The default left panel lists named component families. A separate Resources view retains search, original labels and occurrence identities. The selected component has a labelled state strip with thumbnails and edited markers. Selecting a state updates the inspector and artwork view; selecting a document state also updates the specimen's active/inactive window state.

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

All 10 model tests, the companion typecheck/production build, and the expanded Chromium round-trip scenario pass. Browser coverage includes all three selection entry points, active/inactive synchronization, original pixels and disabled edit controls, exact color reset, independent geometry reset, whole-artwork reset/undo, pointer commit as one undo step, keyboard adjustment, Escape/pointer-cancel/lost-capture cancellation, resource search, save/reopen and original recovery. The 390px overflow check passes. Root typecheck and clean-room lint also pass; this iteration changes no core renderer code.

Desktop preview and artwork surfaces were inspected in Chromium. Automated axe WCAG A/AA checks reported zero violations on both surfaces after correcting selected-state label contrast. Axe leaves some contrast checks incomplete because of patterned backgrounds; this result is not a full accessibility conformance claim. Narrow layouts stack the library, workspace and inspector rather than compressing the editing controls.

The next useful UX work is a dependency-aware component inventory: distinguish face artwork, body patterns, rings, text and window recipe dependencies before expanding beyond the two admitted families. That should precede any generic nine-slice editor or automatic linking of similar-looking colors.

## Visual reimplementation and designer review

A dedicated UX/UI design reviewer inspected the running implementation at 1600×1000 and 1440×900. The resulting direction is a compact editor: neutral panels and charcoal application chrome, restrained emerald selection, and imported artwork as the primary visual content. The new layout keeps the rendered component, its source image and its properties in one working context. This is a visual and structural replacement of the first presentation.

| Before                                             | Implemented after review                                                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview and artwork are mutually exclusive         | Split workspace is the default. Wide centers place the specimen and source editor side by side; narrower centers stack them. Single-pane modes remain available. |
| Large introductory cards compete with authoring    | Compact project actions, explorer, working surfaces, inspector and footer. Original recovery lives with source details.                                          |
| Component title omits the selected state           | Persistent semantic component/state title with a subordinate exact source breadcrumb. Raw labels remain in Resources.                                            |
| Promotional content in the specimen                | Neutral document content and stable control labels. Selection targets retain the renderer's source pixels.                                                       |
| Original is easy to mistake for another edit mode  | A visible read-only comparison banner explains that working edits are retained and offers a return action.                                                       |
| Selection and edits use similar emphasis           | Emerald outline/tint identifies selection; a small warm dot and Edited text identify overrides.                                                                  |
| Palette preview duplicates the source editor       | Inspector focuses on palette and geometry properties; source pixels and guides occupy their own workspace pane.                                                  |
| Geometry fields appear unrelated to their guides   | Corner and side field labels share their corresponding guide colors.                                                                                             |
| Changes require hunting through artwork            | Changes view lists actual palette/geometry overrides and selects their source artwork. Ambiguous geometry-to-artwork selections are disabled.                    |
| History requires footer buttons                    | Command/Ctrl-Z and Shift-Z work outside native text/number fields; native field undo is retained.                                                                |
| Phone layout puts the full explorer before editing | Workspace opens first, with explicit Explorer/Workspace/Properties controls; selecting artwork returns to Workspace.                                             |
| Short windows obscure the specimen's lower frame   | The preview has bounded internal scrolling with a visible scrollbar treatment and reduced padding.                                                               |
| Rebuilding can briefly imply unsupported source    | Loading labels distinguish pending admission from confirmed unavailable mappings.                                                                                |

The review deliberately preserves independent corner/side source semantics and exact RGB16 controls. It does not introduce a generic layer hierarchy or treat an image face as the complete component definition. A dependency-aware selection model remains the next design step.

Verification for the reimplementation includes default simultaneous surfaces, Changes selection, keyboard history, phone panel navigation, and the existing byte-preserving browser round trip. The earlier acceptance criteria still apply.
