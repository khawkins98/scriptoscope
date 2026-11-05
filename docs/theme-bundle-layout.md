# Theme bundle layout

Use this reference when hosting, importing or inspecting a theme. For a working
application, start with the [npm guide](./npm-consumer.md); for a corpus addition,
follow [porting a scheme](./porting-a-kaleidoscope-scheme.md). To make new art,
use the [authoring guide](./authoring-a-scheme.md).

## What's actually shipped (in git)

A community bundle keeps its source archive and provenance:

```text
themes/<slug>/
  scheme.sit       # original StuffIt archive, preferred
  # OR scheme.rsrc # unwrapped raw resource fork
  meta.json        # identity, author, source and original terms
  PROVENANCE.md    # human-readable sourcing and license record
```

Retain any additional files required by the original redistribution terms. The
runtime decodes the source in the browser; generated PNGs and `theme.json` are
not required to host a bundle. Themes are separate inputs, not installed by the
runtime npm package. First-party examples live separately under `authoring/`.

## Files

### `scheme.sit` / `scheme.rsrc`

Prefer the untouched archive the author distributed. Use a raw resource fork
when that is the available source. A macOS resource-fork stream, an AppleDouble
wrapper and a raw fork are different representations; do not rename a wrapper
and assume its bytes are a raw fork. The loader accepts supported containers;
the [porting guide](./porting-a-kaleidoscope-scheme.md#2-place-the-bundle-source--sit-preferred-rsrc-as-fallback)
explains preservation during transfer.

### `meta.json`

The sidecar contains facts the archive may not expose consistently:

```json
{
  "name": "Scheme name",
  "author": { "name": "Original author", "year": 1999 },
  "origin": {
    "kind": "kaleidoscope-port",
    "originalFormat": "ksc",
    "originalLicense": "<verbatim terms from the original readme>",
    "sourceUrl": "https://example.org/original-archive"
  }
}
```

Preserve `origin.originalLicense` verbatim, rather than substituting an SPDX id
or paraphrase. Keep author contact details when supplied by the original.
The [porting guide](./porting-a-kaleidoscope-scheme.md#4-author-the-provenance-sidecars)
covers the review needed before redistribution.

### `PROVENANCE.md`

Record the original author, archive URL, readme/terms, sourcing history and reason
for inclusion. Use an existing corpus bundle as a format example, without
copying its factual claims. Keep this record consistent with `meta.json`;
resolve discrepancies against the original source rather than inventing terms.

## URL convention at runtime

For `loadTheme('/themes/beos-r503')` or `loadOwnedTheme`:

1. Try `scheme.sit`, then fall back to `scheme.rsrc` when no usable source is
   fetched. This is sequential fallback, not an archive race. Pass
   `{ source: 'scheme.rsrc' }` when the filename is known.
2. Fetch `meta.json` alongside the archive, unless a complete `meta` option is
   supplied. Picker display labels do not replace source/license metadata.
3. Decode the source in-browser. StuffIt sources lazily load the bundled decoder;
   raw forks do not require it.
4. Return either ready-image `LoadedTheme` assets or an `OwnedTheme` whose source
   paths are resource references. Owned references are not fetchable URLs; use
   the public image export helpers when an image URL is needed.

Release owned resources after their last dependent unmounts. Registered themes
are borrowed by the host. See the [owned-theme lifecycle contract](./v2/owned-theme-api.md)
and [npm lifecycle example](./npm-consumer.md#attachment-and-ownership).
The in-memory manifest type is [`src/types.ts`](../src/types.ts), distinct from
this on-disk layout.

## What `npm run build:themes` produces locally (gitignored)

| Output under `themes/<slug>/` | Local purpose |
|---|---|
| `theme.json` | Generated manifest for file-based diagnostics |
| `extraction-manifest.json` | Per-resource status and extraction inventory |
| `cicns/`, `ppats/`, `icons/` | Decoded PNGs and icon index |
| `rasters.json`, `resource-roles.json` | Inspector inventory and role classification |
| `diag/` | Headless render PNGs and placement maps |

These are regenerable derivatives, not deployment inputs. An extraction pass
may mark resources skipped even when another pass decodes them; skipped is not
proof that the archive lacks the resource or every runtime path ignores it.

## Regenerating local derivatives

```sh
node scripts/extract-scheme.mjs beos-r503
node scripts/extract-icons.mjs beos-r503
# Or all bundles, inventories and the demo catalog:
npm run build:themes
```

For a complete single-bundle pipeline use `npm run import -- <slug>`. It can
scaffold provenance placeholders; complete them and rerun before review. For
render commands and their limits, see [diagnostic tooling](./diagnostic-tooling.md).

## Porting a new scheme

Follow the [porting procedure](./porting-a-kaleidoscope-scheme.md) for rights,
metadata, browser review, lint and container-recorded scene baselines. This
reference does not duplicate that checklist.

## What's *not* in a bundle

A source archive may contain sounds, fonts, cursors, desktop images and other
extras. Loading it does not automatically install all those extras on a web
page. Supply page audio, fonts and backgrounds explicitly and retain their own
terms. Do not confuse omitted generated directories with absent archive content.

## Source-of-truth pairing

| Concern | Canonical home |
|---|---|
| Bundle files and deployment | This reference |
| Corpus addition workflow | [Porting guide](./porting-a-kaleidoscope-scheme.md) |
| Public loaders and ownership | [`src/loadTheme.ts`](../src/loadTheme.ts), [owned API](./v2/owned-theme-api.md) |
| Manifest shape and validation | [`src/types.ts`](../src/types.ts), [`validateTheme.js`](../tools/theme-loader/validateTheme.js) |
| Decode and manifest construction | [`tools/theme-loader/`](../tools/theme-loader/) |
| Local extraction | [`extract-scheme.mjs`](../scripts/extract-scheme.mjs), [`extract-icons.mjs`](../scripts/extract-icons.mjs) |
