# @aaron-ui/scheme-extractor

Decode Kaleidoscope scheme resources (`cicn` color icons, `ppat` pixel patterns) into PNGs for use in Aaron UI theme bundles.

**Status:** working, validated against two real schemes (mass:werk 7 Le, mass:werk Dark ErgoBox 2). Internal tool today; the lib/ is intentionally browser-portable so the same code can later power a web-based extractor.

---

## What it does

Takes the DeRez-decompiled text form of a classic Mac resource fork (`.r` file), parses out individual resources, decodes the `cicn` and `ppat` binary structures per [Inside Macintosh: Imaging With QuickDraw](https://developer.apple.com/library/archive/documentation/mac/QuickDraw/QuickDraw-1.html) (chapter 4), and writes one PNG per asset plus a JSON manifest.

Currently supports:

- **`cicn`** — color icons with 1-bit mask, indexed pixel data, color table. Produces 32-bit RGBA PNGs with transparency.
- **`ppat`** — color pixel patterns (patType 1). Produces 32-bit RGBA PNGs (fully opaque).

Pass-throughs (recorded in manifest, no PNG):

- `cinf`, `wnd#`, `clut`, `dctb`, `actb`, `STR#`, `DLOG`, `DITL`, `TMPL`, `vers`, `Colr`, `PICT`, `icl8`, `ICN#`, `ics8`, `ics#`, `icns` — known types we don't (yet) need to extract.

Not yet supported:

- `ppat` patType 0 (1-bit black-and-white pattern, 8 bytes only) — schemes typically include color patterns instead.
- `ppat` patType 2 (RGBPixPat, direct color) — rare in chrome assets.
- `PICT` decoding — would need a separate QuickDraw picture-opcode interpreter.

---

## Three modes, one decoder

The actual decoding work lives in **`src/themes/loader/`** (moved from `tools/scheme-extractor/lib/` in the loader-phase-1 refactor — same code, runtime-importable now). It uses only `Uint8Array` and plain JS — **no Node-specific imports.** That means the same decoder runs in three places:

| Mode | How it's wrapped | Status |
|---|---|---|
| **Runtime (browser)** | Imported directly from `src/themes/loader/` by the Aaron UI runtime — used by the upcoming `loadKaleidoscopeScheme(bytes)` API | 🟡 in progress (phase 2) |
| **CLI** (`bin/extract.js`) | Node script: file I/O via `fs`, PNG encoding via `pngjs`. Re-routes through `src/themes/loader/` after the move | ✅ working |
| **Node API** (`import from '@aaron-ui/scheme-extractor'`) | Re-exports `src/themes/loader/` for backward compat | ✅ working |

The CLI is today's default because the input side currently relies on macOS `DeRez` to decompile resource forks, and macOS is where the source schemes naturally live. **Phase 2 of the loader plan** adds a pure-JS resource-fork parser so the runtime can decode any `.ksc` / `.rsrc` blob directly — no `DeRez` step needed.

## Usage

### CLI

```sh
# From repo root, after `npm install` inside tools/scheme-extractor/
node tools/scheme-extractor/bin/extract.js \
  --input  .scratch/schemes/masswerk-7-le/scheme.r \
  --output .scratch/extracted/masswerk-7-le/ \
  --verbose
```

Options:

| Flag | Short | Default | Notes |
|---|---|---|---|
| `--input <file>` | `-i` | — required | DeRez `.r` text file |
| `--output <dir>` | `-o` | — required | Output directory (created if missing) |
| `--types <list>` | `-t` | `cicn,ppat,cinf,wnd#` | Comma-separated types to decode |
| `--meta <file>` | `-m` | none | Sidecar JSON with bundle metadata (`name`, `author`, `origin`, `options`) merged into `theme.json` |
| `--validate` | — | off | Run schema validation on the emitted `theme.json`. Exit non-zero on violation. |
| `--verbose` | `-v` | off | Per-resource progress logging |
| `--help` | `-h` | — | Show help |

#### Sidecar metadata

The binary `.ksc` doesn't carry author/license info — that lives in the scheme's readme. Supply it via `--meta path/to/meta.json`:

```json
{
  "name": "mass:werk 7 Le",
  "author": {
    "name": "Norbert Landsteiner",
    "url": "https://www.masswerk.at",
    "year": 2001
  },
  "origin": {
    "kind": "kaleidoscope-port",
    "originalFormat": "ksc",
    "originalLicense": "freeware-with-attribution",
    "originalReadme": "ReadMe-masswerk7Le",
    "sourceUrl": "https://www.masswerk.at/schemes.php"
  }
}
```

The extractor merges this on top of the chrome/patterns sections it derives from the resource fork.

#### Schema validation

`--validate` runs the emitted `theme.json` through a runtime validator that mirrors the TypeScript schema in [`src/themes/schema/parseTheme.ts`](../../src/themes/schema/parseTheme.ts) (issue #35). Errors surface as a dotted path — e.g. `theme.json.windowTypes.document.parts.part-1.rect[3]: expected finite number` — so you can locate the offending field in the bundle.

The JS-side validator lives at [`lib/validateTheme.js`](./lib/validateTheme.js). It's a slim mirror of the TS source-of-truth; the shared-fixture test at [`lib/buildThemeJson.test.js`](./lib/buildThemeJson.test.js) runs both validators against the canonical mass:werk fixtures and asserts they agree on every shape. If you change the TS schema, mirror the change here and the test will catch any drift.

### Programmatic

```js
import { parseDerezText, decodeAll } from '@aaron-ui/scheme-extractor';
import { readFileSync } from 'node:fs';

const text = readFileSync('scheme.r', { encoding: 'latin1' }); // preserve MacRoman
const records = parseDerezText(text);
const decoded = decodeAll(records);

for (const { record, decoded: img, error } of decoded) {
  if (error || !img) continue;
  // img = { width, height, rgba: Uint8Array, debug: {...} }
  console.log(`${record.type} ${record.id} "${record.name}" → ${img.width}×${img.height}`);
}
```

The `lib/` modules use only `Uint8Array` and plain objects — no Node-specific imports — so the same decoder can be loaded in a browser bundle.

---

## Preparing input

DeRez (`/usr/bin/DeRez`, ships with Xcode Command Line Tools) decompiles a resource fork into `.r` text:

```sh
DeRez "/path/to/scheme file" > scheme.r
```

The scheme file must still have its resource fork intact. `.sit` archives from Macintosh Garden / mass:werk preserve forks; `unar` (Homebrew: `brew install unar`) extracts them correctly:

```sh
unar masswerk7le.sit
DeRez "masswerk 7 Le/masswerk 7 Le" > scheme.r
```

---

## Output

For each decoded asset:

```
<output>/cicn-<id>-<slug>.png
<output>/ppat-<id>-<slug>.png
<output>/extraction-manifest.json
```

The `id` is the resource ID (e.g., `-8287` written as `n8287` for filesystem safety). The `slug` is derived from the resource's name field (e.g., "Active Document Window" → `active-document-window`).

`extraction-manifest.json` shape:

```json
{
  "source": "scheme.r",
  "extractedAt": "2026-05-16T20:42:00.000Z",
  "counts": { "total": 125, "ok": 125, "skipped": 0, "errored": 0 },
  "assets": [
    {
      "type": "cicn",
      "id": -14335,
      "name": "Active Document Window",
      "status": "ok",
      "file": "cicn-n14335-active-document-window.png",
      "width": 74, "height": 25,
      "debug": { "pixelSize": 4, "colorCount": 16, "rowBytes": 38, ... }
    },
    ...
  ]
}
```

---

## Validation

Validated end-to-end against the two schemes documented in `docs/scheme-deconstruction/`:

| Scheme | cicn | ppat | OK | Skipped | Errored |
|---|---:|---:|---:|---:|---:|
| mass:werk 7 Le | 119 | 6 | 125 | 0 | 0 |
| mass:werk Dark ErgoBox 2 | 159 | 25 | 184 | 0 | 0 |

Spot-checked the extracted PNGs by eye against the author's preview thumbnails. The pixel-faithful output matches the original chrome work (composite titlebar widget sets, scrollbar thumb grips, barber-pole indeterminate-progress pattern, checkbox state matrix).

A useful empirical finding from validation: **the cicn chrome bitmaps don't fully capture a theme's perceived aesthetic.** ErgoBox feels "dark" in screenshots largely because of the dark menubar, dark desktop, and projecting-tab layout, not because the chrome cicns themselves are dark. Aaron UI theme bundles need to capture compositional metadata (palette, layout, menubar style) alongside the chrome rasters.

---

## Longer-term goal

The lib/ → bin/ split is intentional. The decoder is the kind of thing that's genuinely useful to expose as a web tool — drop a `.ksc` file (or its DeRez output, or eventually a wrapped `.bin` / `.hqx` / AppleSingle), get a preview of every chrome asset and a download for the extracted set. That browser-based version would need:

1. A pure-JS resource-fork parser to skip the DeRez preprocessing step (today's CLI relies on macOS `DeRez`).
2. Support for the AppleSingle / MacBinary / BinHex archive wrappers so uploaded files retain their resource forks.
3. A small UI: file picker, grid of extracted PNGs with names, download-as-zip button.

None of that is built yet; this internal CLI is the validated foundation.

---

## References

- [Inside Macintosh: Imaging With QuickDraw](https://developer.apple.com/library/archive/documentation/mac/QuickDraw/QuickDraw-1.html) — chapter 4 documents the PixMap, BitMap, ColorTable, and pixel pattern structures.
- [pngjs](https://www.npmjs.com/package/pngjs) — pure-JS PNG encoder used for output.
- `docs/scheme-deconstruction/` — per-scheme analysis docs that informed the decoder's design.
- `docs/RESEARCH-SPIKE-THEMES.md` — the spike doc that scoped this workstream.
