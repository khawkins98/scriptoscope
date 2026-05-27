#!/usr/bin/env bash
# Build the munbox StuffIt/BinHex/MacBinary decoder → WebAssembly (dist/munbox.{mjs,wasm}).
# Requires the Emscripten SDK on PATH: `source ~/emsdk/emsdk_env.sh` first.
# The committed dist/ output means CONSUMERS never need emscripten — only rebuilding does.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v emcc >/dev/null 2>&1; then
  echo "error: emcc not found. Run:  source ~/emsdk/emsdk_env.sh" >&2
  exit 1
fi

mkdir -p dist
emcc -O2 \
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
  -sINITIAL_MEMORY=32MB \
  -sEXPORTED_FUNCTIONS=_sit_decode,_sit_free,_sit_error,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=HEAPU8,UTF8ToString

echo "built:"
ls -la dist/munbox.mjs dist/munbox.wasm
