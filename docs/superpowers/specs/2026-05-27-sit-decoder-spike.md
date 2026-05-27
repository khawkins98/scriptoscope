# StuffIt `.sit` in-browser decode — spike findings + plan

**Date:** 2026-05-27 · **Status:** validated, GO · **Sibling:** `2026-05-27-browser-conversion-design.md`

> **Update — BUILT (2026-05-27, after this spike):** the WASM port shipped to `tools/sit-wasm/`
> (emsdk was installed; both patches applied; `dist/munbox.{mjs,wasm}` committed). Method **15
> (SIT5)** has since been exercised on a real archive (`masswerk7le.sit`), and a multi-file
> handling + trailing-over-run fix landed. So the "WASM-port plan (gated on emscripten)" and
> "method 15 not yet exercised" notes in the lower half are now **historical** — read them as the
> pre-build plan. Current state + remaining work: the design doc's Status/Next-steps and
> `docs/tracking/byo-theme-todo.md`.

Lets a user drop a real downloaded Kaleidoscope theme (`.sit`) and have it decode to a
resource fork entirely client-side — the last input format the pure-JS unwrappers
(`tools/theme-loader/containers.js`, handles `.hqx`/`.bin`/AppleDouble) can't do.

## Verdict

**Port [munbox](https://github.com/idolpx/munbox) to WebAssembly.** It is the only viable
route, and a native validation against a real Kaleidoscope `.sit` recovered the resource fork
**byte-identical** to our corpus. Build it as a **separate, documented, MIT artifact** (its own
repo / build pipeline), wired into the drop-zone behind the existing input front door — keeping
the conversion layer pure per the layer-separation rule. A tiny in-browser StuffIt→fork decoder
is genuinely missing from the JS ecosystem, so this is also a real community contribution.

### Why munbox (vs the field)
- **munbox** — MIT, pure C99, **zero deps**, no threads/longjmp/mmap/FS, in-memory byte API
  (`munbox_new_mem_layer`), models data/resource forks as first-class independent streams.
  Decodes exactly our era's methods: classic 0/1/2 + **method 13 (LZSS+Huffman)** + **method 15
  (Arsenic BWT+arithmetic)**. Its own docs: "no blocking factors for WASM."
- **libarchive(.js)** — no StuffIt support at all. Out.
- **The Unarchiver / unar / XADMaster** — gold-standard coverage (classic + SIT5 + `.sitx`) but
  Obj-C + Apple Foundation + LGPL → a research-grade port, not a build. Keep only as a native
  reference to diff against. Out for shipping.
- **macutils / nomarch** — can't do methods 13/15. **No pure-JS StuffIt decoder exists.**

## Native validation (no emscripten needed — done with the system clang)

Spike tree `/tmp/munbox-spike` (munbox @ 2026-01-20). Fixture: `.scratch/system7nostalgiasilver.sit`
(32,401 B, git-ignored clean-room source for a scheme already in the corpus).

The fixture is a **classic `SIT!`** archive (not SIT5): magic `SIT!` + `rLau` @8, `num_files=1`,
the scheme nested inside a **folder** entry "System7NostalgiaSilver". The real file entry uses
**resource-fork method 13**, data-fork method 0 (empty) — resource fork 130,067 B compressed to ~32 KB.

Result, driving the **library API directly** (a 40-line harness = exactly what a WASM wrapper does:
`mem_layer → munbox_process_new → open(FIRST/NEXT)/read`):

```
entry 0: name='System7NostalgiaSilver/System 7 Nostalgia Silver' fork=rsrc declared_len=130067
   -> wrote 130067 bytes
mb.0.rsrc vs themes/system7-nostalgia-silver/scheme.rsrc:  BYTE-IDENTICAL ✓
```

Clean-room note: this recovers resource *data* (the legitimate asset-translation op) and the output
equals a fork we already ship — no 68k code is executed or introduced.

## The two patches munbox needs (both small, both upstreamable)

**1. `lib/munbox.c` — spurious `<threads.h>` include.** Apple's clang doesn't ship the C11
`<threads.h>`, and it's only there to pair with `#define THREAD_LOCAL _Thread_local` (a keyword,
no header needed). Drop the include:
```c
#if __STDC_VERSION__ >= 201112L
-#include <threads.h>
 #define THREAD_LOCAL _Thread_local
```

**2. `lib/layers/sit.c` — classic-SIT folder markers wrongly counted against `num_files`.** The
sequential iterator `sit_read_next_entry()` terminates on `files_processed >= num_files`, but the
folder-start (method 32), folder-end (33), and unknown-marker branches each did `files_processed++`.
With `num_files=1`, the single folder-start marker exhausts the real-file budget *before* the loop
reaches the actual nested file → `open()` returns 0 entries, "Successfully extracted" with **no
output**. Fix: markers must not increment `files_processed` (3 sites). Folder *depth* tracking
(`folder_depth++`/`--`) stays — only the file-count increment is removed. After the fix, the
nested method-13 file extracts correctly (validated above). Worth a regression test upstream:
single file wrapped in a folder.

## WASM-port plan (gated on emscripten — NOT installed here; ~1 GB emsdk)

1. Fork munbox to its own repo; apply the two patches above.
2. `emcc` the `lib/` sources; export either the low-level API (`munbox_new_mem_layer`,
   `munbox_process_new`, `open/read/close`, malloc/free) or a single C shim
   `decode(ptr,len) → [{name,type,creator,dataFork,resourceFork}]` packing forks into a buffer.
3. Flags: `-sMODULARIZE -sALLOW_MEMORY_GROWTH -sENVIRONMENT=web -sFILESYSTEM=0` (mem layer ⇒ no FS,
   no pthreads). Expect a low-hundreds-of-KB `.wasm`.
4. JS wrapper: copy `.sit` bytes into the heap → run the chain → copy resource-fork bytes out →
   hand to `loadKaleidoscopeScheme` (which already unwraps the other containers). Detection routing
   is in place: `containers.js detectContainer()` already returns `'stuffit'` for `SIT!`/`StuffIt`.
5. Ship as a standalone MIT module ("decode-stuffit-wasm"); aaron-ui consumes it as a dependency,
   keeping `convert.js` pure.

## Open items / next checks
- **emsdk install** is the gate for steps 2–4 (owner authorization — heavy env change).
- **Method 15 (SIT5 Arsenic/BWT)** not yet exercised — our fixture is classic method 13. Validate
  against a SIT5 sample (the more common 1997–2001 format) before declaring full coverage.
- **Nested wrappers** (`.sit.hqx`, `.sit.bin`) — munbox auto-chains; or feed it the already-de-hqx'd
  bytes from `containers.js`. Confirm on a real nested file.
- **method-13 symbol-320 edge** (munbox treats it as fatal where some notes call it an end marker) —
  didn't trigger on our file; watch for it on others.

### Sources
munbox repo + `docs/internals/{sit,sit13,sit15,architecture}.md`; XADMaster `StuffIt5Format` wiki
(SIT5 magic, "methods 0/13/15"); classic header (`SIT!`/`rLau`, per-fork methods) from unstuffit
`stuffit.h`; libarchive format list (no StuffIt).
