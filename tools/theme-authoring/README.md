# Scriptoscope Studio — authoring prototype

A browser-first React experiment for [#472](https://github.com/khawkins98/scriptoscope/issues/472). It tests the source-preserving **import → edit → save → reopen** loop using the existing Scriptoscope renderer. This is an experimental standalone companion app; it adds no React dependency or new API to the runtime package.

## Run it

From the repository root, install the runtime's existing development dependencies and the companion's isolated dependencies:

```sh
npm ci
npm ci --prefix tools/theme-authoring
npm run dev --prefix tools/theme-authoring
```

Open **http://localhost:5174/**. For a production build:

```sh
npm run build --prefix tools/theme-authoring
npm run preview --prefix tools/theme-authoring
```

The app is not added to the public demo deployment. The two sample files and their metadata are bundled locally; importing and saving do not upload source data. Both samples retain their original terms in the saved metadata: see [1138 provenance](../../themes/1138/PROVENANCE.md) and [Animals provenance](../../themes/animals/PROVENANCE.md).

## Try the round trip

1. Start with **1138**, or choose **Animals** to exercise StuffIt import. You can also import a supported scheme/container file.
2. Select **Normal** under Push button, or click a button in the live specimen. The state strip and inspector follow the selection. Choose a palette record and edit its source color using the picker or the **Precise source color (RGB16)** disclosure. The picker deliberately expands an 8-bit source color to 16-bit channels; untouched entries retain their original precision. The display preview applies the runtime's existing color policy.
3. Change **Corner size** or **Side thickness** when a unique same-ID `cinf` exists. These fields apply to that source occurrence, not all button states. Records are never synthesized and missing external providers are not supplied by the app.
4. Inspect the window and three button states. Switch active/inactive or compact/wide. Use **Original / Working** to compare without changing edits. Reset a color, one geometry field, or the selected artwork; every reset is undoable. On the **Artwork** surface, drag C horizontally or S vertically to adjust source geometry; arrows adjust one pixel, and Escape cancels a drag.
5. **Save project**, refresh or open another session, then **Open project**. The original archive/fork and selection are verified before edits are reapplied through a fresh loader call.
6. **Recover original** downloads exactly the imported bytes, even after edits.

All color icons can be inspected and palette-edited. The live specimen only exercises a document window and push buttons; other assets may not affect it. Component mappings follow the current renderer and decoder's exact source occurrences; unsupported or multi-asset selections are explicitly unavailable. Switch to **Resources** for the raw library. The raw resource library keeps occurrence identities and original names, including duplicate IDs. Unsupported palettes remain preserved.

## UX rationale

[UX.md](./UX.md) analyzes ThemeRoller, Godot, Penpot, Piskel and Themix, records the patterns adopted here, and defines acceptance criteria and deferred work. Component navigation and preview picking use the existing React/renderer stack; no editor engine is added.

## Experimental document contract

Saved `.scriptoscope-project.json` files use `scriptoscope-authoring-experiment`, version `0`, with required profile `kaleidoscope-source-edits/0`. This is **not a stable interchange standard**.

The document stores:

- The complete original file and selected resource fork, base64 encoded, with SHA-256 hashes and selection metadata. Keeping only a parsed inventory would lose unknown resources and fork/container metadata.
- Original attribution/provenance metadata where supplied. Dropped files have no external sidecar; archive companions remain recoverable in the original archive.
- Palette operations identified by resource occurrence, signed ID and palette-record position, with original and edited RGB16 values.
- Geometry operations identified by occurrence and signed ID, covering only the first two `cinf` bytes.

Compilation copies the retained fork and changes only the admitted fixed-size fields. It never reconstructs the fork from PNGs, rewrites masks or indices, reorders resources, or serializes runtime handles. The public loader then rebuilds all derived assets and engine inputs. Stale preview jobs cannot replace the latest revision; owned URLs are disposed on replacement. Canvas is a display surface, not the source of saved pixels.

Opening rejects unknown required profiles, mismatched original/fork hashes or archive selection, duplicate/stale edit operations, out-of-range channels and unsupported operations. Reordering JSON object keys does not change selection identity. Sources are limited to 16 MiB and project files to 48 MiB. These are input limits, not a claim of a hardened archive sandbox; decoding uses the existing importer and its allocation behavior.

## Scope and next steps

This prototype is **source-backed**: reopening still decodes Kaleidoscope resources. It does not implement a standalone compiled web format, a portable original-control profile, image replacement, a paint editor, edited classic export, Linux adapters, external providers/base chains, or a Tauri shell. Original recovery is separate from exporting an edited classic scheme. The preview uses the current renderer's standalone compatibility behavior and does not establish original-engine fidelity.

The next decision gates remain those in #472: validated persisted resource admission, one measured decoder-free deployment path, and one real Linux export/edit/reimport. Keep format and rendering decisions independent of React or a possible desktop wrapper.

## Checks

```sh
npm test --prefix tools/theme-authoring
npm run build --prefix tools/theme-authoring
npx playwright install chromium
npm run test:browser --prefix tools/theme-authoring
```

The model tests check semantic occurrence admission (including duplicates and missing provenance), scoped resets, byte-exact source recovery, narrowly scoped edits, masks, duplicate occurrence identity, archive selection and malformed projects. The browser test starts its own server on port 5184. It verifies real rendered edits, undo/redo, geometry, synchronized component/state/preview selection, read-only original comparison, per-field/artwork resets, guide dragging as one undo step, keyboard adjustment and gesture cancellation, downloaded project/original files, pixel-identical fresh-session reopening, invalid-project recovery, StuffIt sample switching, and narrow-screen overflow. These are same-renderer regression checks, not independent classic-system comparisons. Chromium must be installed; it is not silently skipped.
