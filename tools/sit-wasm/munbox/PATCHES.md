# Vendored munbox — provenance + patches

**Upstream:** https://github.com/idolpx/munbox (MIT) · commit `1602f2dc9440d70287b0d199a72f548e2c48b342` (2026-01-20)

Only the minimal buildable subset is vendored: `include/munbox.h`, `lib/munbox.c`,
`lib/munbox_internal.h`, `lib/layers/*.{c,h}`, `LICENSE`. (Upstream `cmd/`, `test/`, `cmake/`,
`docs/` are not needed for the WASM library build.)

Three local patches, all candidates to upstream. Each is marked in-source with a `spike fix`/
`spike patch` comment.

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

## Rebuild

See `../README.md`. `../build.sh` compiles this subset + `../shim.c` to `../dist/munbox.{mjs,wasm}`.
For environments without an Emscripten install on PATH, the project's docker-based recipe is:

```sh
docker run --rm -v "$(pwd):/src" -w /src emscripten/emsdk:latest bash build.sh
```
