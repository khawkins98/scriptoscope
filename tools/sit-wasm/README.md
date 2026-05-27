# sit-wasm — decode StuffIt `.sit` (and BinHex/MacBinary/Compact Pro) in the browser

A small WebAssembly build of [munbox](https://github.com/idolpx/munbox) (MIT) that decodes
classic-Mac archives **entirely client-side** — bytes in, forks out, no server, no filesystem.
Built for [aaron-ui](https://github.com/khawkins98/aaron-ui) to accept a dropped Kaleidoscope
`.sit` theme, but the module is self-contained and dependency-free: a standalone "decode StuffIt
in the browser" tool that, as far as we could find, didn't otherwise exist. Separable on purpose —
it could become its own package/repo with no changes. (Origin note: the test below compares
against aaron-ui's "corpus" — its set of bundled themes — but the module itself has no aaron-ui
dependency.)

## Install

```sh
npm install stuffit-wasm   # (or copy this folder — it's dependency-free)
```

The build output `dist/munbox.{mjs,wasm}` is **committed**, so consumers never need Emscripten —
only rebuilding does. Runs in the browser and in Node; the WASM instantiates once on first call.

## API

```js
import { decodeArchive, stuffItResourceFork } from 'stuffit-wasm';

// Every fork of every entry:
const entries = await decodeArchive(bytes); // bytes: Uint8Array | ArrayBuffer
//  → [{ name, type, creator, forkType /* 0=data, 1=resource */, bytes: Uint8Array }, ...]
//  `type`/`creator` are u32 OSType codes (e.g. 'APPL' → 0x4150504C), NOT strings.

// Convenience: the largest resource fork — for classic-Mac files that keep their payload there
// (e.g. Kaleidoscope schemes). Throws if the archive has no resource fork.
const fork = await stuffItResourceFork(bytes);
```

### Node

```js
import { readFileSync } from 'node:fs';
import { decodeArchive } from 'stuffit-wasm';

const entries = await decodeArchive(readFileSync('scheme.sit'));
for (const e of entries) {
  console.log(e.name, e.forkType === 1 ? 'rsrc' : 'data', e.bytes.length);
}
```

### Browser (`<input type="file">`)

```html
<input type="file" id="f">
<script type="module">
  import { stuffItResourceFork } from 'https://esm.sh/stuffit-wasm'; // or your bundler / local path
  document.getElementById('f').addEventListener('change', async (ev) => {
    const buf = new Uint8Array(await ev.target.files[0].arrayBuffer());
    const fork = await stuffItResourceFork(buf); // → Uint8Array of the resource fork
    console.log('resource fork:', fork.length, 'bytes');
  });
</script>
```

### Locating the `.wasm`

`index.mjs` loads `dist/munbox.wasm` relative to `dist/munbox.mjs`, so keep them together (a
bundler that fingerprints assets — Vite, etc. — handles this automatically). If you serve the
`.wasm` from a different path, override the Emscripten `locateFile` hook (see `index.mjs`'s
`createMunbox({ … })` call).

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

Requires the Emscripten SDK:

```sh
source ~/emsdk/emsdk_env.sh   # install: https://emscripten.org/docs/getting_started/downloads.html
./build.sh                    # → dist/munbox.mjs + dist/munbox.wasm  (~70 KB wasm)
```

`build.sh` invokes `emcc -O2` over the vendored `munbox/lib/**` + `shim.c`. Key flags (see
`build.sh` for the full set): `-sSTACK_SIZE=5MB` (munbox's decoders, and our chunked reads, want
more than the 64 KB default WASM stack — too small a stack silently corrupts memory on wasm32),
`-sFILESYSTEM=0` (the in-memory API needs no FS), `-sALLOW_MEMORY_GROWTH=1` + `-sINITIAL_MEMORY=32MB`,
and `-sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createMunbox -sENVIRONMENT=web,node` (an ES-module
factory that runs in both the browser and Node — the latter is what the test uses).

## What's vendored, and our patches

`munbox/` holds the minimal buildable subset of upstream munbox plus two small,
upstream-able patches (a spurious `<threads.h>` include; a classic-SIT folder-counting bug that
made single-file-in-a-folder archives extract nothing). See [`munbox/PATCHES.md`](munbox/PATCHES.md)
for the diffs and provenance. munbox is MIT — see [`munbox/LICENSE`](munbox/LICENSE).

## Layout

```
index.mjs     public API: decodeArchive / stuffItResourceFork (JS over the packed buffer)
index.d.ts    TypeScript types
package.json  name "stuffit-wasm", exports, files (MIT)
LICENSE       MIT — covers the first-party files here (munbox/ is separately MIT)
shim.c        C entry point: decode → one packed [count]{name,type,creator,forkType,len,bytes} buffer
build.sh      emcc build → dist/
dist/         committed munbox.mjs + munbox.wasm (no Emscripten needed to consume)
munbox/       vendored upstream subset + LICENSE + PATCHES.md
sit-wasm.test.mjs   Node test: decodes a real .sit byte-identical to a known fork
```

> **License:** MIT — see [`LICENSE`](LICENSE). The vendored `munbox/` is separately MIT
> ([`munbox/LICENSE`](munbox/LICENSE)).
