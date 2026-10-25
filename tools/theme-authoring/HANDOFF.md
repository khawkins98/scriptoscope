# Parked proof of concept — pickup guide

Parked at the user's request on 2026-10-25. [PR #475](https://github.com/khawkins98/scriptoscope/pull/475) stays open as a draft with the `parked` label. This is a useful experimental checkpoint, not a merge-ready product or a commitment to its document format. Broader architecture and format work remains in [issue #472](https://github.com/khawkins98/scriptoscope/issues/472).

The last implementation commit is `9b466ca19786963cf93a9be306c617d91b9cdca3`. The parking follow-up only adds documentation and screenshots.

## What is proved

- A separate React companion can preserve the entire imported Kaleidoscope source/archive and reopen occurrence-bound edits through the public loader.
- Verified button face/label/emboss roles and active/inactive document-window title plate/text/shadow roles support named editing, shared-source warnings, scoped resets, history, Original comparison and save/reopen.
- Advanced source supports indexed palette picking, exact RGB16 values, admitted corner/side geometry edits and original recovery.
- A coherent document specimen and the main site's visual identity make the editing task understandable. Junior walkthroughs covered actual editing, source coupling, project output, native input undo and phone navigation.
- File/Edit/View/Help are working editor menus using existing procedural Platinum drawing primitives plus semantic DOM interaction. They are stable editor chrome; they do not implement a scheme-aware menu compositor.

[Desktop checkpoint](./docs/workbench-desktop.png) · [320px File menu](./docs/workbench-phone-menu.png)

## What remains experimental or absent

The v0 Studio project is a source-backed working document, **not the canonical interchange standard**. Reopening still decodes the retained original resources. Original recovery is byte-exact; exporting an edited classic scheme is not implemented.

There is no decoder-free web export/runtime artifact, Linux/Xfwm4/GTK adapter, Tauri packaging, general paint/image replacement, independent copies of shared source colors, or full window-recipe authoring. Document text/background/selection and controls beyond the verified push-button family are not semantic authoring controls. The fixed specimen content is not saved as a theme property. Imported external providers/base chains are outside this slice. Current previews and same-renderer comparisons do not prove original-engine fidelity.

## Reproduce before changing anything

Use Node 24, matching CI. From a checkout of this branch (`khawkins98/theme-authoring`):

```sh
npm ci
npm ci --prefix tools/theme-authoring
npx playwright install chromium
npm test --prefix tools/theme-authoring
npm run build --prefix tools/theme-authoring
npm run test:browser --prefix tools/theme-authoring
npm run lint:cleanroom
npm run dev --prefix tools/theme-authoring
```

Open http://localhost:5174/. The browser test starts its own server on port 5184. The app is not wired into the public site's deployment; the loopback URL is not a hosted preview.

Start with 1138, edit the Active title plate, make an Inactive override, apply the amber button variation, compare Original, undo/reset, then download and reopen the project in a fresh session. Use Animals to exercise archive import. Test File/Edit/View/Help, pending-field Command/Control+S, native input undo and 320px navigation.

At the implementation checkpoint, both GitHub checks were green:

- [Authoring prototype](https://github.com/khawkins98/scriptoscope/actions/runs/40137665062): 26 model tests, companion build/typecheck and expanded Chromium acceptance.
- [Repository CI](https://github.com/khawkins98/scriptoscope/actions/runs/40137665080): Gates + build + browser contracts.

Local build, browser acceptance, clean-room lint and diff checks also passed. Automated axe checks found no violations in inspected screens; canvas/decorative contrast had incomplete checks and was visually reviewed. This is not an accessibility conformance claim. Detailed junior results are in [USABILITY.md](./USABILITY.md).

## Code map

| Area | Start here |
| --- | --- |
| Retained source, v0 validation, narrow patch operations | `project.ts`, `project.test.mjs` |
| Declared button-role admission and atomic assignments | `profile.ts`, `profile.test.mjs` |
| Renderer-selected window title roles and shared fallback | `window-profile.ts`, `window-profile.test.mjs` |
| Named properties and specimen | `AuthoringSheet.tsx`, `AuthoringGallery.tsx` |
| History, loading, save/open and command handlers | `main.tsx` |
| Accessible menu interaction and field guide | `StudioMenu.tsx` |
| Site identity / legacy source workbench styling | `workbench.css`, `style.css` |
| Source navigation, pixel picker and geometry guides | `components.ts`, `source-picking.ts`, `ArtworkEditor.tsx` |
| End-to-end acceptance | `browser.test.mjs` |
| Research and design rationale | `UX.md`, issue #472 |

## Invariants to preserve

1. Keep original archive/fork bytes, hashes, attribution and occurrence identities. Unknown resources stay intact. Never rebuild the source fork from preview PNGs or serialize runtime/blob handles.
2. Derive bindings from the retained original source and renderer declarations. Never guess semantic roles from names, equal displayed colors, resource ID alone, or matching palette positions across states.
3. The declared engine color sampler ignores mask/ctFlags; ordinary visible-pixel picking has different rules. Do not collapse the two paths.
4. Shared roles/state fallbacks remain shared. Scope does not promise independent copies. Reject ambiguous, stale or conflicting assignments atomically.
5. Untouched RGB16 values stay exact. New preview-color choices have an explicit nearest-source quantization policy.
6. Do not silently change the persisted v0 contract or present project download as theme export. Review clean-room policy before renderer work; independent oracle evidence is not implementation material.

## Recommended pickup order

1. Refresh from remote `main`, read this guide, [README](./README.md), [UX](./UX.md), [USABILITY](./USABILITY.md) and #472, then reproduce the existing acceptance task. Do not assume the old CI checkpoint validates later renderer changes.
2. Choose one concrete next milestone before expanding UI: a validated canonical lossless document, a measured decoder-free web export, or one real Linux export/edit/reimport experiment. Treat Xfwm4/GTK as potential adapters, not an automatically lossless master format.
3. Specify unsupported features, source retention, compatibility/version rules and round-trip evidence for that milestone. Preserve the current renderer and source-backed project as a baseline while the canonical-format decision remains open.
4. If expanding authoring coverage, admit actual source bindings for one coherent family at a time and test the rendered result, byte boundaries, coupling and fresh-session reopening. Selection/document colors need evidence, not a generic accent picker.
5. Decide how the companion will be packaged and reached from the main site. Consolidate the iterative legacy/workbench stylesheet layers before treating this UI as a maintained product; scheme-aware menu rendering is a separate runtime task.

The root `package-lock.json` had a pre-existing local change (0 additions, 42 deletions). It was excluded from every prototype/parking commit and deliberately left untouched. It is not required by this proof of concept.
