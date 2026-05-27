# Vendored munbox — provenance + patches

**Upstream:** https://github.com/idolpx/munbox (MIT) · commit `1602f2dc9440d70287b0d199a72f548e2c48b342` (2026-01-20)

Only the minimal buildable subset is vendored: `include/munbox.h`, `lib/munbox.c`,
`lib/munbox_internal.h`, `lib/layers/*.{c,h}`, `LICENSE`. (Upstream `cmd/`, `test/`, `cmake/`,
`docs/` are not needed for the WASM library build.)

Two local patches, both candidates to upstream. Each is marked in-source with a `spike fix`/
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

## Rebuild

See `../README.md`. `../build.sh` compiles this subset + `../shim.c` to `../dist/munbox.{mjs,wasm}`.
