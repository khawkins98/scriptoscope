#!/usr/bin/env bash
# Build the munbox StuffIt/BinHex/MacBinary decoder → WebAssembly (dist/munbox.{mjs,wasm}).
# Requires the Emscripten SDK on PATH: `source ~/emsdk/emsdk_env.sh` first.
# The committed dist/ output means CONSUMERS never need emscripten — only rebuilding does.
#
# The committed artefacts were built with Emscripten 5.0.7 and rebuild byte-for-byte with
# that release (native SDK and the emscripten/emsdk:5.0.7 image). Another release will
# produce different bytes; re-measure and refresh the hash pins if you change it.
set -euo pipefail
cd "$(dirname "$0")"

EMCC_PINNED=5.0.7

if ! command -v emcc >/dev/null 2>&1; then
  echo "error: emcc not found. Run:  source ~/emsdk/emsdk_env.sh" >&2
  exit 1
fi
if ! emcc --version | head -n 1 | grep -q " ${EMCC_PINNED} "; then
  echo "warning: expected Emscripten ${EMCC_PINNED}; found: $(emcc --version | head -n 1)" >&2
  echo "warning: the output will not match the committed dist/ bytes." >&2
fi

# -Os: about 13% fewer WASM bytes than -O2 with no measured decode slowdown; -Oz is smaller
#   still but decoded measurably slower. dlmalloc stays: emmalloc is smaller but grew the
#   heap further on repeated decodes.
# --closure 1: minifies the JS glue. Needs the Closure Compiler the SDK ships (and Java
#   where it has no native build).
# TEXTDECODER=2: the wrapper already requires TextDecoder, so drop the glue's fallback.
#   Code that imports dist/munbox.mjs directly now needs a global TextDecoder too.
# No -sINITIAL_MEMORY: this script used to pass 32MB, but no shipped binary was ever
#   built with it. The flag was removed so memory keeps starting at Emscripten's default
#   for these settings (337 pages, about 21 MB: 16 MB heap + the 5 MB stack + data) and
#   growing on demand, exactly as the shipped decoder always has.
mkdir -p dist
emcc -Os --closure 1 \
  -I munbox/include -I munbox/lib \
  munbox/lib/munbox.c \
  munbox/lib/layers/bin.c munbox/lib/layers/cpt.c munbox/lib/layers/hqx.c \
  munbox/lib/layers/sit.c munbox/lib/layers/sit13.c munbox/lib/layers/sit15.c \
  shim.c \
  -o dist/munbox.mjs \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createMunbox \
  -sENVIRONMENT=web,node \
  -sFILESYSTEM=0 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sSTACK_SIZE=5MB \
  -sTEXTDECODER=2 \
  -sEXPORTED_FUNCTIONS=_sit_decode,_sit_free,_sit_error,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=HEAPU8,UTF8ToString

echo "built:"
ls -la dist/munbox.mjs dist/munbox.wasm
