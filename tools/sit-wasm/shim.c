// WASM entry point over munbox. Decodes a classic-Mac archive (StuffIt .sit, BinHex
// .hqx, MacBinary .bin, Compact Pro .cpt) held in memory and returns ALL forks in one
// packed buffer the JS wrapper parses — bytes in, forks out, no filesystem.
//
// Packed layout (all u32 little-endian):
//   [u32 totalLen][u32 count]
//   count × { [u32 nameLen][name][u32 type][u32 creator][u32 forkType][u32 forkLen][fork] }
//   forkType: 0 = data fork, 1 = resource fork.
//
// sit_decode() returns NULL on error; call sit_error() for the message. Free the
// returned buffer with sit_free().
#include "munbox.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <emscripten.h>

typedef struct { uint8_t *p; size_t len, cap; int ok; } buf_t;

static void bput(buf_t *b, const void *src, size_t n) {
    if (!b->ok) return;
    if (b->len + n > b->cap) {
        size_t nc = b->cap ? b->cap : 4096;
        while (b->len + n > nc) nc *= 2;
        uint8_t *np = realloc(b->p, nc);
        if (!np) { b->ok = 0; return; }
        b->p = np; b->cap = nc;
    }
    memcpy(b->p + b->len, src, n);
    b->len += n;
}

static void bu32(buf_t *b, uint32_t v) {
    uint8_t t[4] = { (uint8_t)(v & 255), (uint8_t)((v >> 8) & 255), (uint8_t)((v >> 16) & 255), (uint8_t)((v >> 24) & 255) };
    bput(b, t, 4);
}

static void patch_u32(uint8_t *p, uint32_t v) {
    p[0] = (uint8_t)(v & 255); p[1] = (uint8_t)((v >> 8) & 255);
    p[2] = (uint8_t)((v >> 16) & 255); p[3] = (uint8_t)((v >> 24) & 255);
}

EMSCRIPTEN_KEEPALIVE
uint8_t *sit_decode(const uint8_t *in, int in_len) {
    munbox_layer_t *mem = munbox_new_mem_layer(in, (size_t)in_len);
    if (!mem) return NULL;
    munbox_layer_t *proc = munbox_process_new(mem); // auto-detects + chains the format layer
    if (!proc) return NULL;

    buf_t b = { NULL, 0, 0, 1 };
    bu32(&b, 0); // totalLen placeholder (backpatched)
    bu32(&b, 0); // count placeholder
    uint32_t count = 0;

    munbox_file_info_t info;
    int r;
    munbox_open_t what = MUNBOX_OPEN_FIRST;
    while ((r = proc->open(proc, what, &info)) == 1) {
        what = MUNBOX_OPEN_NEXT;
        uint32_t nameLen = (uint32_t)strlen(info.filename);
        bu32(&b, nameLen);
        bput(&b, info.filename, nameLen);
        bu32(&b, info.type);
        bu32(&b, info.creator);
        bu32(&b, (uint32_t)info.fork_type);

        size_t lenPos = b.len;   // backpatch the fork length here once we've read it all
        bu32(&b, 0);
        uint32_t forkLen = 0;
        uint8_t tmp[16384];      // kept modest to bound per-call stack use (build.sh raises the
                                 // WASM stack to 5MB; the default 64KB would overflow on big frames)
        ssize_t n;
        while ((n = proc->read(proc, tmp, sizeof tmp)) > 0) { bput(&b, tmp, (size_t)n); forkLen += (uint32_t)n; }
        if (n < 0) b.ok = 0;
        if (b.ok) patch_u32(b.p + lenPos, forkLen);
        count++;
    }
    proc->close(proc);

    // A trailing open() error AFTER we've collected entries is munbox over-running the end of
    // some archives (SIT5 iteration doesn't always stop cleanly — it reads one entry past the
    // last and trips a bounds check instead of returning end-of-archive). The entries already
    // decoded are valid, so keep them. Only fail hard if nothing decoded or our own buffer broke.
    if (!b.ok || (r < 0 && count == 0)) { free(b.p); return NULL; }
    patch_u32(b.p + 0, (uint32_t)b.len);
    patch_u32(b.p + 4, count);
    return b.p;
}

EMSCRIPTEN_KEEPALIVE void sit_free(uint8_t *p) { free(p); }
EMSCRIPTEN_KEEPALIVE const char *sit_error(void) { return munbox_last_error(); }
