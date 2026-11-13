# Vendored munbox — provenance + patches

**Upstream:** https://github.com/idolpx/munbox (MIT) · commit `1602f2dc9440d70287b0d199a72f548e2c48b342` (2026-01-20)

Only the minimal buildable subset is vendored: `include/munbox.h`, `lib/munbox.c`,
`lib/munbox_internal.h`, `lib/layers/*.{c,h}`, `LICENSE`. (Upstream `cmd/`, `test/`, `cmake/`,
`docs/` are not needed for the WASM library build.)

Four local patches, all candidates to upstream. Patches 1–3 are marked in-source with a
`spike fix`/`spike patch` comment, patch 4 with a `hardening:` comment at each changed site.

## 1. `lib/munbox.c` — drop the spurious `<threads.h>` include

The C11 `<threads.h>` is paired only with `#define THREAD_LOCAL _Thread_local`. `_Thread_local`
is a compiler keyword and needs no header. Apple's clang (and some libcs) don't ship
`<threads.h>`, so the include breaks the build for no benefit.

```diff
 #if __STDC_VERSION__ >= 201112L
-#include <threads.h>
 #define THREAD_LOCAL _Thread_local
```

## 2. `lib/layers/sit.c` — classic-SIT folder markers must not count against `num_files`

`sit_read_next_entry()` stops when `files_processed >= num_files` (the real-file count from the
archive header). But the folder-start (method 32), folder-end (33), and unknown-marker branches
each did `files_processed++`. For a classic `SIT!` archive with a single file nested in a folder
(`num_files == 1`), the folder-start marker exhausted the budget before the loop reached the file,
so `open()` returned 0 entries — "Successfully extracted" with **no output**. Removing the
increment at the three marker sites fixes it; folder *depth* tracking is unchanged. (This is what
every Kaleidoscope `.sit` we've seen needs — the scheme is wrapped in a named folder.)

```diff
         current = header + 112;
         st->format_state.classic.current_offset = current - data;
-        st->format_state.classic.files_processed++;
         continue;   // (×3: folder start, folder end, unknown marker)
```

## 3. `lib/layers/sit.c` — `num_files` counts ROOT entries; folder sub-entries must not count

Patch #2 stopped folder-marker bytes from counting, but the deeper problem stayed: classic
`SIT!`'s `num_files` field at offset 4 is the count of **root-level archive entries**, not the
total file count. A folder IS one root entry that contains N sub-entries; those sub-entries
must also not count against the root budget, or the iterator exits after the first nested file.

Pre-patch behaviour on a classic archive with `num_files == 1` and one root folder containing
4 files (e.g. `duplex.sit`: scheme + ReadMe + Icon + desktop-pattern sidecar):
- folder open (method 32) → continue (correct per patch #2)
- first file inside folder → process, `files_processed = 1`
- loop check: `1 >= 1` → exit. The other 3 files (incl. the actual Kaleidoscope scheme) are
  silently skipped.

Fix: only ROOT-level (`folder_depth == 0`) files count. Folder ENDS (method 33) that bring the
depth back to 0 also count (the root folder is one root entry that has finished its walk). The
loop's termination condition is extended to "exit when `folder_depth == 0 AND files_processed
>= num_files`" — so we keep reading sub-entries while inside a folder regardless of the budget.

```diff
 static int sit_read_next_entry(sit_layer_state_t *st) {
-    if (st->format_state.classic.files_processed >= st->format_state.classic.num_files) {
+    if (st->format_state.classic.folder_depth == 0 &&
+        st->format_state.classic.files_processed >= st->format_state.classic.num_files) {
         return 0;
     }
-    while (st->format_state.classic.files_processed < st->format_state.classic.num_files) {
+    while (st->format_state.classic.folder_depth > 0 ||
+           st->format_state.classic.files_processed < st->format_state.classic.num_files) {

     // Folder end (method 33)
     if (st->format_state.classic.folder_depth > 0) {
         st->format_state.classic.folder_depth--;
+        if (st->format_state.classic.folder_depth == 0) {
+            st->format_state.classic.files_processed++; // root folder finished
+        }
     }

     // Regular file entry
-    st->format_state.classic.files_processed++;
+    if (st->format_state.classic.folder_depth == 0) {
+        st->format_state.classic.files_processed++; // root-level files only
+    }
```

Verified on four real-world archives (`duplex.sit`, `fantasia.sit`, `falloutiv.sit`,
`dtunderfloatsnow.sit`) that all wrap a Kaleidoscope scheme in a folder alongside sidecars:
post-patch, every fork is reachable and `stuffItResourceFork`'s "largest non-Icon" picker
correctly lands on the scheme (type='Colr' creator='Acid', the Kaleidoscope OSType).

## 4. `lib/layers/{sit,sit13,sit15,cpt}.c`, `lib/munbox.c` — malformed input must end in an error

Several values taken straight from the archive were used without a bounds, progress or validity
check, so a damaged or crafted file could make the decoder never return, abort, or read and
write outside its buffers. In a WebAssembly build an out-of-bounds write stays inside linear
memory, where it corrupts the allocator for every later decode on the shared instance. None of
the cases needs a valid checksum. Each row is one missing check and what the patch does instead;
well-formed archives take the same path as before and decode to the same bytes.

| Where | Was | Now |
| --- | --- | --- |
| `sit.c` `sit_stream_fill`, stored (method 0) fork | A fork with fewer stored bytes than its declared length copied zero bytes forever | Error `SIT: stored fork ends before its declared length` |
| `sit.c` `sit_read_next_entry`, fork bounds | `offset + length` was summed in `size_t`; on a 32-bit target (wasm32) it wrapped, a huge length passed, and the cursor could step backwards onto the same entry forever | Summed in 64 bits; error `SIT: fork data out of range` (this check used to return −1 with no message) |
| `sit.c` `sit5_read_next_entry`, first header | A declared header length under the 48 fixed bytes overflowed the heap copy made for the CRC, and a zero length never advanced | Error `SIT5: header1 too short` |
| `sit.c` `sit5_read_next_entry`, data-fork bounds | Same 32-bit wrap as the classic check | Summed in 64 bits |
| `sit.c` `sit5_read_next_entry`, folders and markers | One C stack frame per folder or marker entry (recursion) | A loop |
| `sit.c` entry names (classic and SIT5) | The name copy could read past the end of the archive | Error `SIT: entry name out of range` / `SIT5: entry name out of range` |
| `sit.c`, `cpt.c` layer constructors | `read` stayed `NULL` until the first `open()`; the format probe calls `read` first, so an archive with no entries called through `NULL` | `read` is set when the layer is created |
| `sit13.c` `next_bits`, `sit13_init` | Every read loaded 4 bytes at the cursor with no bounds check, so a short stream read past the fork and, for the last fork, past the archive | `sit13_init` copies the fork into a buffer followed by 32 zero bytes (`SIT13_INPUT_PAD`), so bytes past the end read as zero. The decode loops test once per symbol whether the cursor is more than 32 bits past the end and fail if so; a decode error is then final for that fork. The comment at `SIT13_INPUT_PAD` shows why 32 bytes cover the most a decoder can read between two tests. A bounds check on every read was the alternative; it was measurably slower (see the experiment record) |
| `sit13.c` `add_code`, `next_bits` | Code lengths from the stream were validated only by `assert()`: an abort, or with assertions off a walk through a leaf | `add_code` returns an error, which fails the tree build |
| `sit13.c` `tree_from_code_lengths` | A code length below −1 (reachable with the "decrement" command) was never matched, so the loop ran about 2³² passes | Lengths below −1 count as "no code", like 0 and −1; lengths above 32 are rejected |
| `sit13.c` `extract_tree_with_metacode` | The repeat commands stored past the end of the `lengths[]` stack array | Every store is bounded by `n_codes` |
| `sit13.c` `tree_to_value` | A bit pattern with no code in an incomplete tree dereferenced a `NULL` child | Returns −1, which the callers report as an error |
| `sit13.c` `new_tree_node`, `sit13_free` | Tree nodes were never freed (about 1,300 per fork, plus the metacode tree): roughly 7 MB per pass over the 13 bundled archives, never returned. `malloc` failure was not checked | `free_tree()` releases the three trees on `sit13_free`, on every failed setup, and the metacode tree after use; allocation failure fails the build. The one-shot `sit13()` wrapper, unused here, now goes through the same init/read/free path |
| `sit15.c` zero-run decoding | The run counters overflowed `int` after about 31 run symbols; a negative count then passed the block-size check ahead of a `memset` | The run is checked against the block size as it grows. `1 << i` for the top bit is now an unsigned shift |
| `cpt.c` `cpt_pfx_build` | With over-subscribed code lengths the insertion walk stepped through a leaf, whose fields hold a symbol value, and used that value as a node index | A leaf or already-occupied node on the path rejects the table; the partly built table is freed |
| `cpt.c` `cpt_walk_dir_mem` | Directory nesting came from the input with no limit (about 1 KB of stack per level) | At most 64 levels; error `CPT directory nesting too deep` |
| `munbox.c` `munbox_process_new` | Wrappers nested without limit; every read recurses once per layer | At most 16 layers, the limit `munbox_probe()` already had |

The output-size bound is not in the vendored tree: munbox has no such limit, so it lives in
`../shim.c` (`SIT_MAX_OUTPUT_BYTES`, 32 MiB). A fork's declared length is otherwise the only
bound, and a few dozen bytes can declare 4 GiB.

Not changed, deliberately: a fork that a decompressor cannot finish (Compact Pro with a rejected
code table, methods 1, 2, 13 and 15 on a stream that ends early or fails) still comes back the way
it did before — short or empty where the layer reports end-of-data, an error where it reports
one, some of them without a message. Only the stored fork gained a new error, because its old
behaviour was the endless loop.

Upstream status: not fixed upstream at `1602f2dc9440d70287b0d199a72f548e2c48b342` (still the head
of upstream `main` on 2026-11-13). Upstream's `SECURITY.md` asks for private reports, so these are
not filed as public issues.

Checked with native builds under AddressSanitizer and UndefinedBehaviorSanitizer and with a
seeded corruption corpus through the WebAssembly build; the
[experiment record](../../../docs/runtime-optimization-experiments.md#stuffit-decoder-hardening-decode-time-cost-662)
has the decode-time cost. `../sit-wasm.malformed.test.mjs` keeps one small input per row class.

## Rebuild

See `../README.md`. `../build.sh` compiles this subset + `../shim.c` to `../dist/munbox.{mjs,wasm}`.
For environments without an Emscripten install on PATH, the project's docker-based recipe is:

```sh
docker run --rm -v "$(pwd):/src" -w /src emscripten/emsdk:latest bash build.sh
```
