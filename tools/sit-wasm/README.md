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

Keep `dist/munbox.wasm` beside `dist/munbox.mjs`; the wrapper loads it on first
use. A bundler may relocate these assets together. For a custom WASM location, add
the Emscripten `locateFile` hook to `moduleOptions` in `index.mjs`; every
instantiation uses those options.

### The shared instance and when it is replaced

Calls share one decoder instance. It is replaced in two cases:

- **A decode crashed it** (a runtime abort or a WebAssembly trap). The failed call
  rejects with that error, unchanged. Nothing the decode allocated was released
  and the instance's heap may be damaged, so it is never called again. The next
  call loads a replacement.
- **It outgrew its memory limit.** The decoder does not return everything it
  allocates and WebAssembly memory cannot shrink, so a reused instance only gets
  bigger. After each decode the wrapper compares the instance's linear memory with
  `max(2 × initial, initial + 3 × (input bytes + output bytes))`, where `initial`
  is the instance's size when new (337 pages, 21.1 MB). Above that, the instance
  is still healthy: the decode that took it there returns its result, and the
  next call loads a replacement before decoding. The second term is there so that
  one large input does not cause a replacement on every decode (an input of about
  4 MB or more grows even a new instance; decoding needs up to about
  2 × (input + output) above the initial size).

An ordinary decoder error (`decodeArchive: …`) is neither case and keeps the
instance.

What this bounds: an instance found over its limit after one decode is replaced
before the next call decodes, and the replacement starts at the initial size.
Memory is not held at the initial size between replacements. Calls that were
already waiting on the old instance when it passed the limit are still served by
it. Decoding the 13 bundled archives in a loop, an instance grows
from 337 to at most 701 pages (43.8 MB) and is replaced about every four passes
(10 instances in 40 passes); without replacement it reached 326.6 MB over the
same 40 passes. A single decode can take memory as far as that archive needs. A
replaced instance's memory is returned when the JavaScript engine collects it.

What a replacement costs: nothing is loaded ahead of need, so the call that needs
the replacement waits for one instantiation.

- In a browser where the first instance was compiled by streaming (the normal
  case), the wrapper keeps that compiled `WebAssembly.Module` and instantiates
  replacements from it. They make no network request and do not depend on the
  network.
- In Node a replacement reads and compiles `munbox.wasm` from disk again. Measured
  medians on one host ranged from 0.3 ms to 5.6 ms depending on load, against 2.5
  to 20 ms to decode one bundled archive on a quiet host.
- In a browser that could not stream the first compile (for example a server that
  sends `.wasm` with the wrong MIME type), no module is kept and each replacement
  requests the file again, twice, as the first load did.

When instantiation fails:

- **The very first instantiation.** The failure is kept for the life of the page
  or process and every later call rejects with it, as before. The Emscripten
  runtime also logs it with `console.error`.
- **A replacement after a crash.** The calls waiting on it reject with the
  instantiation error. It is not kept; the next call tries again.
- **A replacement for an instance over its limit.** The call is served by that
  instance, which is still healthy, and each later call tries again while the
  instance stays over its limit.

To keep the compiled module the wrapper replaces `WebAssembly.instantiateStreaming`
for the length of the one synchronous factory call that starts the first load,
then restores it. The call, its request and its errors pass through unchanged. If
the property cannot be assigned, nothing is kept and replacements load like the
first instance.

`__createDecoderForTests` is a named export of `index.mjs`, and so of this
package and of any bundle chunk built from it. It is internal: it builds a
separate decoder over a caller-supplied factory for this package's tests, and is
not part of the supported API.

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

## Malformed input and limits

For a damaged or hostile archive, `decodeArchive` either rejects with an `Error`
whose message starts `decodeArchive: `, or resolves with the entries it could
decode. The decoder used to hang, abort or write outside its buffers on some such
inputs; [munbox/PATCHES.md](./munbox/PATCHES.md) lists the checks that now
prevent that, and the next call on the shared instance decodes normally.

- **A partial result is still a result.** When an entry cannot be opened after
  earlier entries decoded, the call resolves with the earlier entries (the same
  rule that tolerates munbox's SIT5 over-run, above). When a fork fails while
  it is being read, the call rejects, and decoding now stops there: the
  message is the first failure, where it used to be whichever error came last
  after reading on through the rest of the archive.
- **Messages.** Some decoder errors carry no text of their own and read
  `decodeArchive: No error`.
- **Output cap.** The decoded forks of one archive, with their names and headers,
  may total at most 32 MiB (`SIT_MAX_OUTPUT_BYTES` in [shim.c](./shim.c)); beyond
  that the call rejects with `decodeArchive: decoded output exceeds the 32 MiB
  limit`. A fork's declared length comes from the archive, and a few dozen bytes
  can declare 4 GiB. The largest bundled archive decodes to about 1.55 MiB.
  Reaching the cap leaves the instance's memory at about 69 MiB, which
  WebAssembly does not give back.
- **Lengths are enforced.** A stored (uncompressed) StuffIt fork with fewer
  bytes than its header declares is an error. A method 13 fork is decoded from
  exactly its declared compressed bytes, so a fork whose header understates
  them fails where it used to read on into the bytes that follow. A fork whose
  declared position or length lies outside the archive is an error, including
  lengths near 4 GiB that used to wrap a 32-bit sum and pass.
- **Unchanged.** Other forks that end early keep munbox's behaviour: short or
  empty where the layer reports end-of-data (Compact Pro with a rejected code
  table, for one), an error where it reports one. Checksums are verified where
  munbox verifies them, no more.
- **Nesting.** At most 16 wrapper layers are unwrapped and 64 Compact Pro
  directory levels walked.
- **Memory.** Repeated decodes through the one instance do not grow its memory:
  12 passes over the 13 bundled archives stay at the initial 21 MB. They used
  to add about 7 MB a pass.

The checks were exercised with 9,000 seeded corruptions, native
AddressSanitizer/UndefinedBehaviorSanitizer builds and coverage-guided fuzzing;
that is evidence, not proof, so keep treating archives from unknown sources as
untrusted input. The
[experiment record](../../docs/runtime-optimization-experiments.md#stuffit-decoder-hardening-decode-time-cost-662)
has the decode-time cost.

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

[munbox/PATCHES.md](./munbox/PATCHES.md) owns upstream provenance and the local
patches: the clang include and folder-count fixes, and the malformed-input
checks; [munbox/LICENSE](./munbox/LICENSE) retains munbox's MIT
terms. The first-party wrapper has its own [MIT license](./LICENSE).

## Layout

| File | Purpose |
| --- | --- |
| `index.mjs` / `index.d.ts` | Public wrapper / types |
| `shim.c` / `build.sh` | Packed in-memory bridge / WASM build |
| `dist/` | Committed generated ES module and WASM |
| `munbox/` | Vendored subset, license and patch record |
| `sit-wasm.test.mjs` | Archive/fork regression tests, included in repository `npm test` |
| `instance-recovery.test.mjs` | Instance replacement, module reuse and buffer-freeing tests, included in repository `npm test` |
| `sit-wasm.malformed.test.mjs` / `malformed-archives.fixture.mjs` | Malformed-input, output-cap and memory tests, and the small inputs they build in code |
