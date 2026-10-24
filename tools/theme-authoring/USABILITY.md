# Task-based authoring review and Themix comparison

Review of prototype commit `66637acb`, prompted by the observation that the polished workbench still feels wrong for theme authoring. This review evaluates the editing task, rather than another visual treatment.

## Method

A fresh agent acted as a junior theme developer, using the running app through the `agent-browser` CLI before reading its implementation or UX rationale. Tasks included creating an amber variation, finding named design properties, coordinating normal/pressed/disabled and active/inactive states, comparison/reset, and saving/reopening. This is a task-based agent walkthrough, not a human usability study or a statistical assessment.

Themix was examined separately through its official screenshots and current public model/preview/plugin source. We did not run its GTK application locally and do not claim a comparative hands-on task completion measurement.

## Task results

The walkthrough began at 1280×577 and continued at 1440×1000. It used only the UI, not app source or implementation documentation.

| Task                                                                                       | Observed result                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Understand where to begin                                                                  | Partial: base scheme and two component families were clear; full editable scope was not.                                                                     |
| Make an amber variation across active/inactive windows and Normal/Pressed/Disabled buttons | Partial: the Normal button face became amber and its label remained legible; the requested overall variation was not achieved.                               |
| Find button background, title text and selection/accent properties                         | Partial: the face was guessed from a black swatch; no semantic title-text or accent property was found.                                                      |
| Coordinate related states and understand sharing                                           | Blocked: separate records, differing palettes and no discovered cross-state role operation.                                                                  |
| Compare, reset, save and reopen                                                            | Passed: Original comparison worked; reset removed the edit; downloaded JSON reopened with the amber edit restored and source verification confirmed.         |
| Use/install the resulting theme                                                            | Blocked by stated v0 scope: the saved project is neither a compiled web theme nor an edited classic export. This is a capability limit, not a broken export. |

## Prioritized findings

| Severity | Observed obstacle                                                                                                                                                | Implication                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| High     | A desired button background becomes Palette record 0…6, source RGB and resource identity. A guessed face record also recolors outlines.                          | Add truthful semantic bindings, including coupling; retain precise source editing as an advanced route.                 |
| High     | Normal has seven palette records; Pressed has eight. The Normal edit leaves Pressed/Disabled grey.                                                               | A coherent family needs explicit compatible-state mappings and a preview of affected states, rather than index copying. |
| High     | The selected component exposes only face/window artwork, while the disclosure excludes text, body patterns, rings or other recipe parts.                         | Show supported and unsupported design properties up front. Broader authoring requires real write paths.                 |
| High     | The output limitation is revealed in a bottom Source preservation disclosure after the user edits and saves.                                                     | Establish project purpose and available output before authoring and beside Save.                                        |
| Medium   | Resource search for accent returns nothing; button returns radio buttons but misses mapped push-button artwork with an Untitled source name.                     | Search needs semantic component/state aliases as well as raw labels and IDs.                                            |
| Medium   | At the short initial viewport, preview and inspector content extend beyond the visible work area; source pixels remain below the fold even at a taller viewport. | Favor a dense property form and a compact representative preview, with advanced source editing deliberately opened.     |

## Interpretation

The component navigator and selectable specimen provide a plausible starting point. Once the task becomes “make the button background amber,” the user meets numbered palette records, source RGB, occurrence identities and independent source measurements. The app can select an admitted resource without explaining enough of its visual design roles to support a coherent theme edit.

A Normal button face could be made amber. Pressed and Disabled remained grey. The sampled Normal and Pressed images expose different palette counts, so copying a record number across states would not establish the same semantic edit. A theme-level operation needs explicit source bindings and application scope. The amber edit also affected outlines sharing that palette entry: relabelling the record as an independently editable background would hide real coupling.

The UI itself explains that button body patterns, rings and text are separate dependencies and other window recipe parts are not editable. These limits are material to authoring. A different form layout cannot manufacture those capabilities.

## What Themix contributes

The official [application screenshot](https://github.com/themix-project/themix-gui/blob/master/screenshots/screenshot_gui.png) shows three stable working areas: presets, an editing form, and a compact representative preview. Its [theme model](https://github.com/themix-project/themix-gui/blob/master/oomox_gui/theme_model.py) gives fields human design roles, declares defaults/fallbacks, and filters fields for supported styles/plugins. Its [preview implementation](https://github.com/themix-project/themix-gui/blob/master/oomox_gui/preview.py) covers a header, menu, label, selection, entry and button; the [plugin API](https://github.com/themix-project/themix-gui/blob/master/oomox_gui/plugin_api.py) separates supported properties and exports.

The useful pattern is the relationship between the semantic model, editable property sheet and representative preview. We can adopt that relationship without adopting GTK as the runtime or reducing imported Kaleidoscope themes to Themix's color dictionary.

| Current emphasis                                           | Proposed authoring emphasis                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Select a source-bearing component, then decode its palette | Choose a starting theme and edit named, supported design properties                                                  |
| Large specimen with source editing below it                | Property sheet remains the main work area; a compact gallery shows the consequences                                  |
| Palette record numbers are primary property names          | Human role names are primary; exact source bindings remain inspectable                                               |
| Each state requires manual rediscovery of related colors   | Each operation states which verified states/resources it will change; independent overrides remain explicit          |
| Missing features are explained after selecting a component | A capability summary explains editable, retained-only and unavailable parts before a user commits to the task        |
| Saving provides an experimental source-backed project      | Save project and destination output are separate, with an honest explanation of how the result can currently be used |

## Proposed next slice

1. Define a small, real authoring profile and its source bindings before another UI overhaul. A curated starter template can declare these roles up front; an arbitrary imported scheme may only have partial coverage. Let expert authors intentionally name bindings, and preserve coupled roles rather than silently claiming independent parameters. For each editable role, specify affected source occurrences/fields, independent or shared states, exact value representation, and current renderer support. Keep provenance for the role mapping.
2. Build a grouped property sheet for those supported roles. Candidate groups include window appearance, button appearance and state variations, but names such as button text or global accent require a real admitted write path before becoming controls. Unknown palettes must not be assigned roles from their position, equal RGB values or filenames.
3. Give each theme a visible editing-coverage summary. Imported artwork can be retained perfectly while having only partial semantic editing coverage. Source inspection remains an advanced route for intentional low-level work.
4. Make related-state edits an explicit selection of verified bindings. Show affected states and allow independent overrides. Avoid copying palette indices or recoloring every equal RGB value across a scheme.
5. Use a compact gallery that exercises the properties the profile actually edits. Retain the existing renderer for the compatibility preview; disclose unsupported components instead of inventing them.
6. Keep exact source retention and typed source operations underneath the authoring profile. Introduce any new operation type with a precise admission rule, preserved untouched bytes, stale-edit validation and save/reopen tests. Existing v0 files must not silently change meaning.

The first acceptance task should be concrete: a junior developer can make one coherent variation across the profile's supported window/button states, preserve legibility, compare it, save/reopen it, and explain what output they have. This task should succeed without needing resource IDs, palette indices or source geometry knowledge. If a supported role cannot be bound safely, narrow the profile visibly rather than guessing.

## What remains separate

Themix's UI pattern does not establish a lossless interchange format for arbitrary Kaleidoscope schemes. The retained original plus explicit operations remains the preservation mechanism. A future semantic authoring layer, compiled web output and Linux adapters require their own coverage and round-trip contracts, as already tracked in [#472](https://github.com/khawkins98/scriptoscope/issues/472).

The current editor's only write operations are palette RGB16 edits and two admitted geometry bytes (`project.ts`). Theme-wide semantic colors, broad control editing and destination-ready export therefore require capability work as well as UI work. Existing renderer metadata must be checked per field: for example, a title-bar frame tint is not automatically the authored title-text color.

## Session evidence

The agent recorded screenshots and notes under `/tmp/junior-theme-review/` on the review machine. Relevant artifacts are `screenshots/03-workspace.png`, `06-amber-rendered.png`, `08-pressed.png`, `09-window-active.png`, `10-search-accent.png`, `11-search-button.png`, `13-reset.png`, `17-output-disclosure.png` and `18-reopened-rendered.png`. These local paths are not published web assets. The numbered task steps and outcomes above are the durable record.

No page errors were observed. Native color-input filling through the automation tool did not persist, so the tester used the visible RGB16 fields for the amber edit. That automation behavior is not classified as an application bug without a native-picker reproduction. No app implementation was read during the walkthrough and no application code was changed for this review.
