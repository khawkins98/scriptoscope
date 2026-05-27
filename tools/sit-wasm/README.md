# sit-wasm — decode StuffIt `.sit` (and BinHex/MacBinary/Compact Pro) in the browser

A small WebAssembly build of [munbox](https://github.com/idolpx/munbox) (MIT) that decodes
classic-Mac archives **entirely client-side** — bytes in, forks out, no server, no filesystem.
Built for [aaron-ui](../../README.md) to accept a dropped Kaleidoscope `.sit` theme, but the
module is self-contained and dependency-free: a standalone "decode StuffIt in JavaScript" tool
that, as far as we found, didn't otherwise exist. Separable on purpose — it could become its own
package/repo with no changes.

## Use

```js
import { decodeArchive, stuffItResourceFork } from './index.mjs';

// All forks of every entry:
const entries = await decodeArchive(bytes); // bytes: Uint8Array | ArrayBuffer
//  → [{ name, type, creator, forkType /* 0=data, 1=resource */, bytes: Uint8Array }, ...]

// Convenience for classic Mac files that keep everything in the resource fork:
const fork = await stuffItResourceFork(bytes); // Uint8Array, or throws if there's none
```

Runs in the browser and in Node (the test decodes a real `.sit`). The WASM lazily instantiates
on first call. `dist/munbox.{mjs,wasm}` is **committed**, so consumers never need Emscripten —
only rebuilding does.

## Coverage

munbox decodes the StuffIt compression methods that 1997–2001 archives actually use: classic
`SIT!` methods 0/1/2 and the modern **method 13 (LZSS+Huffman)** + **method 15 (Arsenic
BWT+arithmetic)**, plus SIT5. It also reads BinHex `.hqx`, MacBinary `.bin`, and Compact Pro
`.cpt`, and auto-chains nested wrappers (e.g. `.sit.hqx`). Not supported: StuffIt X (`.sitx`)
and the rare classic methods 3/5/8/14. A non-archive input passes through as a data fork (so
`stuffItResourceFork` throws "no resource fork" rather than mis-decoding).

## Rebuild

Requires the Emscripten SDK:

```sh
source ~/emsdk/emsdk_env.sh   # install: https://emscripten.org/docs/getting_started/downloads.html
./build.sh                    # → dist/munbox.mjs + dist/munbox.wasm  (~70 KB wasm)
```

`build.sh` notes: `-sSTACK_SIZE=5MB` (munbox's decoders, and our chunked reads, want more than the
64 KB default WASM stack — too small a stack silently corrupts memory on wasm32), `-sFILESYSTEM=0`
(the in-memory API needs no FS), `-sALLOW_MEMORY_GROWTH=1`.

## What's vendored, and our patches

`munbox/` holds the minimal buildable subset of upstream munbox plus two small,
upstream-able patches (a spurious `<threads.h>` include; a classic-SIT folder-counting bug that
made single-file-in-a-folder archives extract nothing). See [`munbox/PATCHES.md`](munbox/PATCHES.md)
for the diffs and provenance. munbox is MIT — see [`munbox/LICENSE`](munbox/LICENSE).

## Layout

```
shim.c        C entry point: decode → one packed [count]{name,type,creator,forkType,len,bytes} buffer
index.mjs     JS wrapper over the packed buffer (decodeArchive / stuffItResourceFork)
build.sh      emcc build → dist/
dist/         committed munbox.mjs + munbox.wasm (no Emscripten needed to consume)
munbox/       vendored upstream subset + LICENSE + PATCHES.md
sit-wasm.test.mjs   Node test: decodes a real .sit byte-identical to the corpus fork
```
