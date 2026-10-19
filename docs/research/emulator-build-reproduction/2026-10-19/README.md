# Constructive BasiliskII build reproduction — 2026-10-19

A pinned-source build reproduced the preserved emulator JavaScript and WASM **byte-for-byte**. Root independently compared both complete outputs. This establishes a constructive source/toolchain recipe for those assets, not the identity of their historical builder, an executed font provider or whole-emulator behavioral equivalence. No guest or instrumented run was performed for this milestone.

## Exact result

| Output | Bytes | SHA-256 | Result |
| --- | ---: | --- | --- |
| `BasiliskII` (JavaScript, deployed as `BasiliskII.js`) | 156114 | `4fd750e202686a7b7c3bd0055dbe33d21dd6b3ce2639da8da814ef1036d1c66b` | Exact preserved bytes |
| `BasiliskII.wasm` | 1713564 | `0be9b5ba1179b65d9d1bd30b3cc35ee56daf6713ba1353048c03229f641680bb` | Exact preserved bytes, including custom sections |
| `BasiliskII.wasm.map` | 1233518 | `fc582790cbf3946bc6dbcc4368c070f97838ab231335332cade4edb91fa4fe14` | Newly generated companion; no original-map equality claim |

The [sanitized index](index.json) pins inputs, settings, output hashes and external proof-receipt identities. Binaries, source maps, original font/ROM/OS payloads and private host paths are not included. Receipt hashes identify retained external evidence; they do not make its private contents available from this note.

## Inputs and portable command outline

- Emulator source: [mihaip/macemu at b8f4eb88](https://github.com/mihaip/macemu/tree/b8f4eb889d507551b57090c48f41c8de1db73ed8).
- Host integration context: [Infinite Mac at 30112da0](https://github.com/mihaip/infinite-mac/tree/30112da0db5d04ff5764d77ae757e73111a6ef12). Its macemu pin and import/build scripts provide context, not proof of the historical build machine.
- SDK: [emsdk at 0dfff153](https://github.com/emscripten-core/emsdk/tree/0dfff153dc3c596948ac088b8853006c570f2609), Emscripten **4.0.22**, release `bebaf7e50e31865b0724f17eaa52e161e2dfef5a`; compiler reports commit `0f3d2e62bccf8e14497ff19e05a1202c51eb0c65`.
- [GMP 6.2.1](https://ftp.gnu.org/gnu/gmp/gmp-6.2.1.tar.lz) and [MPFR 4.1.1](https://www.mpfr.org/mpfr-4.1.1/mpfr-4.1.1.tar.xz), with archive hashes in the index.

The following is a command **outline**, not an executed clean-room automation script. `$SDK`, `$MACEMU` and `$PREFIX` denote caller-chosen canonical physical directories, not recorded private paths.

1. Check out the pinned SDK/source; install and activate SDK 4.0.22; source its `emsdk_env.sh`. Keep SDK, `EM_CONFIG`, `EM_CACHE`, dependency paths and working directory canonical and consistent (`pwd -P`), including at final LTO link.
2. In the source build copy, adapt `_embootstrap.sh` to use `./config.guess` for the native build triplet. In `configure.ac`, include the MacOSX config only when `__APPLE__ && USE_XCODE` is true; otherwise the Unix native generator encounters recursive config includes. Use separate caller-owned native/WASM cache files and replace the `/emlibs` include/library prefix with `$PREFIX`. Run the native `_embootstrap.sh` to generate the CPU tables.
3. Build the two dependencies with the SDK (then `make -j4 && make install` in each extracted source directory):

   ```sh
   emconfigure ./configure HOST_CC=cc --disable-assembly --with-readline=no --enable-cxx --host none --prefix="$PREFIX" # GMP
   emconfigure ./configure HOST_CC=cc --enable-assert=none --disable-thread-safe --disable-float128 --disable-decimal-float --host none --with-gmp="$PREFIX" --prefix="$PREFIX" # MPFR
   ```

4. Run the pinned `BasiliskII/src/Unix/_emconfigure.sh` and `make -j4`, retaining the generated compile/link arguments. Configuration is `uae_cpu_2021`, direct addressing, IEEE MPFR, no JIT/assembly optimizations/VOSF, LTO, source maps, worker ES-module factory `emulator`, initial memory 301989888 and exports `_malloc`, `_free`, `_main`. No exception-catching enable flags were added.
5. For the two timestamp-bearing compilation units, set `SOURCE_DATE_EPOCH=1767052800` (2025-12-30 UTC), recompile `main_unix.cpp` and `slot_rom.cpp` with their recorded arguments, then relink with the same canonical SDK/dependency paths. This normalizes both the main banner and slot-ROM `__DATE__`; normalizing only the banner was insufficient. The completed receipt records these two changed objects and 61 unchanged others.
6. Compare full JS/WASM bytes, not merely function counts, code sections or screenshots. Keep the newly generated map associated with this build; its own source-path portability and resolution are separate from JS/WASM byte identity.

The portability changes solve native config recursion and alias/canonical-path disagreement during cached LTO compilation. Timestamp normalization supplies a concrete build input; it does not establish when or where the preserved artifacts were originally built. No emulator source algorithm, guest, observer or exception configuration was changed to obtain this equality.

## Remaining boundary

The separate core-observer prototype remains **unintegrated and unexecuted**. WASM arming refuses while the host-abort boundary is unintegrated; baseline exception catching is disabled. Existing synchronous worker waits are not a safe non-reentrant event-loop adapter. Reproduction provides a baseline for future reviewed integration/calibration, not permission to treat an unacknowledged or aborted trace as complete.

Original glyph consumption, active provider/whole-font identity and transfer semantics remain unresolved. This note changes no compatibility authority, requirement assessment or reference eligibility.
