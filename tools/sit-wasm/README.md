# sit-wasm — decode classic Mac archives

A self-contained WebAssembly wrapper around [munbox](https://github.com/idolpx/munbox)
(MIT). It accepts bytes and returns data/resource forks in browsers or Node, without
a server or filesystem. Scriptoscope loads it lazily for archive conversion.

## Install

Use the local package from a Scriptoscope checkout:

```sh
npm install /absolute/path/to/scriptoscope/tools/sit-wasm
```

Its package name is `stuffit-wasm`. You can also copy this directory and import
`index.mjs` directly. The committed `dist/munbox.mjs` and `dist/munbox.wasm` remove
the need for Emscripten unless you rebuild. This example does not assume registry
publication or an independently deployed CDN package.

## API

```js
import { decodeArchive, stuffItResourceFork } from 'stuffit-wasm';

const entries = await decodeArchive(bytes); // Uint8Array or ArrayBuffer
// [{ name, type, creator, forkType, bytes }]
const fork = await stuffItResourceFork(bytes);
```

`forkType` is 0 for data and 1 for resource. `type`/`creator` are unsigned OSType
numbers, not strings. `stuffItResourceFork` selects the largest nonempty,
non-`Icon` resource fork and throws if none exists. This is a compatibility
selection policy, not an independently reviewed source-choice oracle; use
`decodeArchive` when you need explicit entry selection.

### Node

```js
import { readFileSync } from 'node:fs';
import { decodeArchive } from 'stuffit-wasm';

const entries = await decodeArchive(readFileSync('scheme.sit'));
for (const entry of entries) {
  console.log(entry.name, entry.forkType, entry.bytes.length);
}
```

### Browser (`<input type="file">`)

Serve a page beside the copied module, keeping its `dist/` directory in place:

```html
<input type="file" id="f">
<script type="module">
  import { stuffItResourceFork } from './index.mjs';
  document.getElementById('f').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    const fork = await stuffItResourceFork(await file.arrayBuffer());
    console.log('resource fork:', fork.length, 'bytes');
  });
</script>
```

### Locating the `.wasm`

Keep `dist/munbox.wasm` beside `dist/munbox.mjs`; the wrapper instantiates it once
on first use. A bundler may relocate these assets together. For a custom WASM
location, change the Emscripten `locateFile` hook in `index.mjs`'s factory call.

## Coverage

munbox decodes the StuffIt compression methods that 1997–2001 archives actually use: classic
`SIT!` methods 0/1/2 and the modern **method 13 (LZSS+Huffman)** + **method 15 (Arsenic
BWT+arithmetic)**, plus SIT5. It also reads BinHex `.hqx`, MacBinary `.bin`, and Compact Pro
`.cpt`, and auto-chains nested wrappers (e.g. `.sit.hqx`). Not supported: StuffIt X (`.sitx`)
and the rare classic methods 3/5/8/14. A non-archive input passes through as a data fork (so
`stuffItResourceFork` throws "no resource fork" rather than mis-decoding).

**Multi-file archives:** a scheme often ships in a folder with a custom-folder-icon file
(`Icon\r`) and a ReadMe, each with its own small resource fork. `stuffItResourceFork` returns
the **largest** resource fork (the scheme dwarfs the others) and skips the folder-icon file;
use `decodeArchive` if you need every entry. Note: munbox's SIT5 iterator over-runs the last
entry and returns an error instead of a clean end-of-archive — the shim keeps the entries it
decoded rather than discarding them, so a trailing over-run is harmless.

## Rebuild

The committed `dist/` was built with **Emscripten 5.0.7**. From this directory with
that release of the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html)
active:

```sh
source ~/emsdk/emsdk_env.sh
./build.sh
```

Or use the matching Docker image:

```sh
docker run --rm -v "$(pwd):/src" -w /src emscripten/emsdk:5.0.7 bash build.sh
```

Both routes reproduce the committed `munbox.mjs` and `munbox.wasm` byte for byte
(checked on macOS arm64 with the native SDK and in the linux/arm64 image). Another
Emscripten release produces different bytes, and `build.sh` warns when it sees one.
The build runs the Closure Compiler that ships with the SDK.

[build.sh](./build.sh) owns compiler inputs/flags. Preserve its 5 MB stack,
growable memory, filesystem-free ES-module factory and browser/Node support when
changing the build; a too-small wasm32 stack can corrupt decoder memory. Memory
starts at 337 pages (about 21 MB) and grows on demand. `build.sh` once passed
`-sINITIAL_MEMORY=32MB`, but no shipped binary was ever built with it, so the flag
was removed to keep the shipped behaviour.

The glue is built with `-sTEXTDECODER=2`, so it decodes every string with the
platform `TextDecoder`. Through `index.mjs` nothing changes: the wrapper already
needed `TextDecoder`, and the only strings it reads from the glue are ASCII error
messages. Code that imports `dist/munbox.mjs` directly sees three differences from
builds before this flag:

- instantiation throws `ReferenceError` where there is no global `TextDecoder`
  (previously the glue fell back to its own decoder);
- `UTF8ToString` on a string of 16 bytes or fewer that is not valid UTF-8 returns
  U+FFFD replacement characters, and a leading byte-order mark is dropped, where
  the old hand decoder returned other code units (longer strings already went
  through `TextDecoder`);
- lines passed to a `print` callback change the same way at any length, because
  the old glue always hand-decoded them: a diagnostic line holding a high-bit Mac
  filename now carries U+FFFD where it used to merge the byte with its neighbour
  (23 of the 167 lines printed for the bundled archives differ).

After a rebuild, refresh the `munbox.wasm` pin in
`tests/control-availability/source-candidates.json` and regenerate
`tests/acceptance-bindings/bindings.json`. The
[experiment record](../../docs/runtime-optimization-experiments.md#stuffit-decoder-build-flags-size-optimized-build-chosen-662)
has the measurements behind the current flags.

## What's vendored, and our patches

[munbox/PATCHES.md](./munbox/PATCHES.md) owns upstream provenance and the clang
include/folder-count fixes; [munbox/LICENSE](./munbox/LICENSE) retains munbox's MIT
terms. The first-party wrapper has its own [MIT license](./LICENSE).

## Layout

| File | Purpose |
| --- | --- |
| `index.mjs` / `index.d.ts` | Public wrapper / types |
| `shim.c` / `build.sh` | Packed in-memory bridge / WASM build |
| `dist/` | Committed generated ES module and WASM |
| `munbox/` | Vendored subset, license and patch record |
| `sit-wasm.test.mjs` | Archive/fork regression tests, included in repository `npm test` |
