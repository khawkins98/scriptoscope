# Porting a Kaleidoscope scheme into Scriptoscope

Add an existing scheme to the community corpus under `themes/<slug>/`, with its
original archive, attribution and redistribution terms. If you only want to try
a scheme, open its file in the [showcase](https://khawkins98.github.io/scriptoscope/showcase.html);
you do not need a corpus PR. To create original art, use [authoring](./authoring-a-scheme.md).

The [bundle reference](./theme-bundle-layout.md) owns file and metadata details;
this guide owns the import/review procedure. Commands below run from the repo
root with dependencies installed; see [development setup](../CONTRIBUTING.md).

## 0. Before you start

Check the original readme for permission to redistribute, including required
credits and accompanying files. If rights are unclear, study privately and
resolve them before proposing a corpus addition. The runtime's clean-room
boundary does not grant rights to third-party artwork.

You need the repository's Node toolchain and `npm install`. An external extractor
such as `unar` is optional for inspecting an archive or recovering a raw fork;
the runtime and import pipeline decode supported `.sit` archives themselves.

## 1. Acquire the scheme

Download the original archive from the author or a preservation source such as
[Mac Themes Garden](https://macthemes.garden/) or
[Macintosh Garden](https://macintoshgarden.org/apps/kaleidoscope). Record its URL
and retain the original readme. Stage inspection files in `.scratch/`, without
changing directories for the following repo-root commands.

## 2. Place the bundle source — `.sit` preferred, `.rsrc` as fallback

### Preferred — drop the original `.sit` directly

```sh
mkdir -p themes/<slug>
cp /path/to/original.sit themes/<slug>/scheme.sit
```

Keep the original archive intact rather than committing decoded PNGs.

### Fallback — unwrap to `scheme.rsrc`

If the source is a raw resource fork, copy it as `themes/<slug>/scheme.rsrc`.
On macOS, an intact classic file can expose its fork as:

```sh
cp '/path/to/classic-file/..namedfork/rsrc' themes/<slug>/scheme.rsrc
```

A near-empty fork usually means it was lost during transfer. AppleDouble `._`
files contain a wrapper; extract its resource-fork entry rather than assuming
the wrapper is raw `.rsrc` data. Prefer loading the intact supported archive
when possible. `loadTheme` tries `.sit` then `.rsrc`; a known `source` option
avoids the missing-file request.

## 3. Run the (local) extractor

Complete the provenance sidecars in [step 4](#4-author-the-provenance-sidecars),
then run the single-bundle pipeline:

```sh
npm run import -- <slug>
# Alternatively, copy the source and import in one call:
node scripts/import-scheme.mjs <slug> /path/to/original.sit
```

It extracts chrome and icons, indexes rasters, classifies resource roles,
regenerates the demo catalog and runs lint. Missing sidecars are scaffolded with
placeholders **after** extraction; fill them in and rerun so generated metadata
matches. Check the report, command failures and warnings; a scaffold is not
verified provenance.

The [bundle reference](./theme-bundle-layout.md#what-npm-run-buildthemes-produces-locally-gitignored)
lists generated outputs. They support local diagnostics; the browser loads the
original archive rather than these extracted files.

### Local icon diagnostics

If running individual extraction steps, run both:

```sh
node scripts/extract-scheme.mjs <slug>
node scripts/extract-icons.mjs <slug>
```

The second writes the local `icons/` inventory, including supported 4-bit and
8-bit icon families. Review a zero-output failure when icon resources are
present. These files are not a runtime dependency; skipping a local icon bake
does not change browser archive decoding. The full import/build pipeline
already includes it.

## 4. Author the provenance sidecars

### 4a. `themes/<your-slug>/meta.json`

Use the [metadata shape](./theme-bundle-layout.md#metajson). Copy author identity,
source URL and **verbatim** original terms. Do not fabricate dates or replace
the original terms with a license label. Decoder-derived colours do not require
a hand-authored palette.

### 4b. `themes/<your-slug>/PROVENANCE.md`

Record sourcing, original terms, any required readme material and why the scheme
belongs in the corpus. Use an existing bundle as a structural example, not as
permission for a different archive. Keep the JSON and prose consistent with
the original source. Rerun the import after metadata changes.

## 5. Smoke-test it locally

```sh
npm run dev
```

Open `/showcase.html` and pick the local source file to test decoding, or open
`/diagnostic.html?dev=1` after import to inspect the regenerated catalog entry.
Check active/inactive windows, resizing, title colour, control states and any
scheme-specific ornaments. Loading through the file picker tests the archive;
also check hosted bundle loading when reviewing sidecar metadata.

For headless recipe inspection, build and bake first, then give a slug:

```sh
npm run build
npm run diag:render -- <slug> --title Hello --w 240 --h 120
npm run diag:audit -- <slug>
```

The render CLI requires a slug and does not support built-in procedural-frame
schemes. The audit checks placement invariants, **not screenshot similarity**.
Use [diagnostic tooling](./diagnostic-tooling.md) for prerequisites and limits.

## 6. Side-by-side fidelity check

Preserve a source preview under `demo/assets/references/<slug>.png` with its
provenance. It may be an author's thumbnail or a native capture with recorded
conditions. Compare matching window type, state, size and display conditions;
a general thumbnail cannot verify every state or pixel.

Keep regression and fidelity claims separate: a browser capture records current
output. It does not establish original behavior. Follow the repository's
[reference intake](../tests/reference-captures/README.md) and
[contributor role boundaries](../CONTRIBUTING.md#start-with-your-role) for admitted
independent evidence. A visual discrepancy is an investigation, not permission
to patch a per-theme compositor exception.

## 7. Open the PR

```sh
npm run lint:themes -- --update <slug>
npm run baseline:scenes:container -- <slug>
```

Record scene fixtures in the pinned container (Docker required). Host captures
are not comparable with those fixtures. See the
[visual-baseline procedure](../tests/visual-baselines/README.md) and run the
[required contribution checks](../CONTRIBUTING.md#before-opening-a-pr).

Review and include:

- Source archive, complete `meta.json`, `PROVENANCE.md`, and any files required
  by the original terms; decoded derivatives remain gitignored.
- `themes/lint-baseline.json`, the new scene baseline, the regenerated
  `demo/themes-manifest.json`, and the source preview/provenance.
- Original author/terms, browser smoke-test results, comparison conditions,
  unresolved discrepancies and validation limits in the PR description.

Bundle discovery does not require a source registry edit. Inspect `git diff`
before staging; importing regenerates the shared demo catalog too.

## Common pitfalls

| Symptom | Next check |
|---|---|
| White body instead of a pattern | Inspect decoded `bodyBackground` and the actual body-pattern resources; application-owned native body drawing is separate. |
| Widget overlay or title lands incorrectly | Inspect the decoded recipe and rectangle list in the diagnostic view; report the resource/state involved rather than guessing roles from filenames. |
| Ornament repeats or smears when resized | Identify its source cell and placement mode in the slice inspector. Record a minimal case for the responsible runtime lane. |
| Nearly empty `.rsrc` or no resources decoded | Reacquire the intact archive and check resource-fork preservation/container extraction. |

## What you don't need to do

Do not hand-edit generated `theme.json`, extracted PNGs or role inventories.
Change source/provenance inputs and regenerate. New artwork belongs in a real
authored scheme, not a per-theme alternate renderer. Archives may carry fonts,
sounds or desktop extras; their presence does not mean the web runtime installs
them automatically.

## Resources

- [Bundle layout and loader paths](./theme-bundle-layout.md)
- [Diagnostic tools](./diagnostic-tooling.md)
- [Original-scheme authoring](./authoring-a-scheme.md)
- [Mac Themes Garden](https://macthemes.garden/)
- [mass:werk schemes](https://www.masswerk.at/schemes.php)
