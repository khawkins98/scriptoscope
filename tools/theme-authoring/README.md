# Scriptoscope Studio — authoring prototype

A browser-first React experiment for [#472](https://github.com/khawkins98/scriptoscope/issues/472). It tests the source-preserving **import → edit → save → reopen** loop using the existing Scriptoscope renderer. This is an experimental standalone companion app; it adds no React dependency or new API to the runtime package. Its output is a local **Studio project** that can be reopened here. It does not yet produce an installable Linux theme, compiled web theme, or edited classic scheme.

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

1. Choose **1138** or **Animals** in the starting-theme library, or import a supported scheme/container. The default **Theme properties** workspace opens an **Overview** of this scheme’s verified coverage beside one document scene: Active and Inactive windows, with Normal / Pressed / Disabled buttons in context. Editing coverage and project-only output are visible up front.
2. Open **Controls**, keep **All states** selected and choose **Apply amber variation**. Verified button face and label bindings receive distinct state colors in one undoable operation. If only part of an imported theme is admitted, the action and coverage warning identify the supported states; unsupported states remain untouched.
3. Edit **Button face color** or **Button label color** using the picker or hex field. These are preview RGB colors: new choices map to the nearest representable source color. **Mixed** means selected states have different preview colors. A color choice deliberately applies to every listed state; the state swatches show the result. **Label emboss color** appears as editable only when the imported source declares an active, verified effect.
4. Click **Normal**, **Pressed**, or **Disabled**, or pick a gallery button, to edit an individual state. Visible source-effect notes explain that bound colors may also recolor outlines/details or coupled roles. Scope never creates independent copies of shared source records.
5. Compare **Original / Working** in the gallery. Original is read-only and leaves the working project intact. Reset one role or **Reset all button colors** (or **Reset Pressed colors** in an individual state); each reset is a single undoable operation. Command/Ctrl-Z and Shift-Z provide editor history outside native fields.
6. **Save project**, refresh or open another session, then **Open project**. The original archive/fork and selection are verified before edits are reapplied through a fresh loader call. Reopening restores both named-role values and rendered state previews. This download is an editable project, not an installable/exported theme.

Open **Windows** to edit **Title bar color**, **Window title text** and **Title shadow color**, scoped to **Both states / Active / Inactive**. Click a window frame or its state label to open that state. The property sheet identifies linked roles and states; for example, 1138’s inactive text and shadow share one color. Reset one role or the selected window group in one undoable action. Window border artwork remains in Advanced source; document surface, document text, selection and global accent have no verified authoring controls.

**Text & selection** explains the fixed sample content. Its text, typography and selection highlight help compare the theme in context; they are not editable theme values or saved document content. Original comparison applies to both windows and all three button states together.

On phones, **Bases / Properties / Preview** keeps the property sheet first and gives the gallery its own panel. Picking a gallery state returns to that state's properties. Coverage remains available in the property sheet, and output purpose remains beside Save.

### Advanced source editing

Choose **Advanced source** for the existing component/resource library, indexed palette editor, geometry guides, global Changes review and exact source recovery. Semantic aliases such as “Push button Pressed” supplement raw artwork names and IDs in resource search.

**Preview + source** keeps the live document specimen and source dock together. **Expand source**, **Open source artwork** or **Focus source** opens the indexed image. Click a visible pixel or use the arrow keys to select its exact palette record; **Pixel grid** and integer zoom aid inspection. Duplicate/missing index mappings and transparent pixels explain why picking is unavailable instead of guessing.

**Corner size** and **Side thickness** edit a unique same-ID `cinf` when present. Drag C horizontally or S vertically; arrows adjust one pixel and Escape cancels a drag. Color, geometry-field and whole-artwork resets remain undoable. **Recover original** downloads exactly the imported bytes. On phones, **Explorer / Workspace / Properties** switches advanced panels, with a direct **Edit color record →** action from source artwork.

Advanced **Source RGB color** deliberately writes an 8-bit source color expanded to 16-bit channels. **Precise source color (RGB16)** retains exact channel editing. The named property sheet has a separate, documented nearest-preview-color conversion; untouched original values are never run through that conversion. Original values remain independent and exact until explicitly targeted by an edit.

All color icons can be inspected and palette-edited. The live specimen only exercises a document window and push buttons; other assets may not affect it. Component mappings follow the current renderer and decoder's exact source occurrences; unsupported or multi-asset selections are explicitly unavailable. Switch to **Resources** for the raw library. The raw resource library keeps occurrence identities and original names, including duplicate IDs. Unsupported palettes remain preserved.

## UX rationale

[UX.md](./UX.md) analyzes ThemeRoller, Godot, Penpot, Piskel and Themix, records the patterns adopted here, and defines acceptance criteria and deferred work. [USABILITY.md](./USABILITY.md) records the task walkthrough that led to the primary named-property workflow. The profile, form and preview use the existing React/renderer stack; no editor engine is added.

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

The 26-test model suite checks declared document-window title roles, state fallback and shared roles, plus declared button-role admission, exact RGB16 resets, atomic cross-state recipes, linked-role conflicts, nearest-preview-color conversion and untouched precision, as well as indexed pixel-to-record selection (including positional indices, duplicate/missing mappings and masks), semantic occurrence admission (including duplicates and missing provenance), scoped resets, byte-exact source recovery, narrowly scoped edits, masks, duplicate occurrence identity, archive selection and malformed projects. The browser test starts its own server on port 5184. It first verifies actual window chrome edits, frame-to-property selection, shared inactive text/shadow behavior, whole-scene comparison, history and scoped reset, then a downloaded window project reopening with identical pixels. It also verifies the primary amber task across all three states, one-step history, individual-state overrides, role/group resets, original comparison, project download and fresh-session named-role reopening. It then verifies rendered state thumbnails, pixel picking without edits, source expand/return navigation, contextual override reset/review, real rendered edits, undo/redo, geometry, synchronized component/state/preview selection, read-only original comparison, per-field/artwork resets, guide dragging as one undo step, keyboard adjustment and gesture cancellation, downloaded project/original files, pixel-identical fresh-session reopening, invalid-project recovery, StuffIt sample switching, narrow-screen overflow, phone named-property/gallery navigation, and phone source-to-color navigation. These are same-renderer regression checks, not independent classic-system comparisons. Chromium must be installed; it is not silently skipped.
