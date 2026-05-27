// SPDX-License-Identifier: MIT
/**
 *
 * MIT License
 *
 * Copyright (c) dafo123
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
 * Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 * WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// cpt.c
// Compact Pro (.cpt) format layer implementation for munbox.

#include "munbox.h"
#include "munbox_internal.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#ifndef SSIZE_MAX
#define SSIZE_MAX ((ssize_t)(SIZE_MAX/2))
#endif

// --- Utility: big-endian loads (Compact Pro stores multi-byte values big-endian) ---
#define LOAD_BE16(p) ((uint16_t)((uint8_t *)(p))[0] << 8 | (uint16_t)((uint8_t *)(p))[1])
#define LOAD_BE32(p)                                                                                                   \
    ((uint32_t)((uint8_t *)(p))[0] << 24 | (uint32_t)((uint8_t *)(p))[1] << 16 | (uint32_t)((uint8_t *)(p))[2] << 8 |  \
     (uint32_t)((uint8_t *)(p))[3])

// --- CPT Format Constants ---
#define CPT_MAGIC_BYTE    0x01
#define CPT_VOLUME_SINGLE 0x01
// Streaming-only implementation: remove unused legacy constants

// File flags bits
#define CPT_FLAG_ENCRYPTED 0x0001
#define CPT_FLAG_RSRC_LZH  0x0002
#define CPT_FLAG_DATA_LZH  0x0004

// Directory entry type flag
#define CPT_ENTRY_DIR_FLAG 0x80

// --- CPT Archive File Entry ---

// Represents a single file entry in a CPT archive directory

typedef struct {
    char name[256];
    uint8_t volume;
    uint32_t file_offset; // absolute offset to file data
    uint32_t type; // Mac OS file type
    uint32_t creator; // Mac OS file creator
    uint32_t create_date; // seconds since 1904-01-01
    uint32_t mod_date; // seconds since 1904-01-01
    uint16_t finder_flags; // Finder flags
    uint32_t data_crc; // CRC-32 of uncompressed data
    uint16_t flags; // file flags (encryption, compression)
    uint32_t rsrc_uncomp_len; // resource fork uncompressed length
    uint32_t data_uncomp_len; // data fork uncompressed length
    uint32_t rsrc_comp_len; // resource fork compressed length
    uint32_t data_comp_len; // data fork compressed length
} cpt_file_entry_t;

// State for an open CPT layer including parsed entries and streaming state
typedef struct cpt_layer_state {
    munbox_layer_t *source;
    uint8_t *archive_data; // entire archive in memory for random access
    size_t archive_size; // total size
    cpt_file_entry_t *entries;
    size_t entry_count;

    // Iteration state for open()/read
    size_t iter_index; // current entry index
    int iter_fork; // 0=data, 1=resource
    uint8_t *cur_buf; // decompressed current fork (actually reader state)
    munbox_file_info_t cur_info;
    bool opened; // require open() before read()
} cpt_layer_state_t;

// CRC utilities removed (unused in streaming path)

// --- RLE + streaming helpers are defined later; fork decompressor below uses them ---

// --- LZH Decompression (streaming core used below) ---

// --- Streaming LZH + RLE ---
typedef struct {
    uint8_t *buf;
    size_t len;
    size_t cap;
    size_t bitpos;
    int streaming;
    int (*src)(void *, int *);
    void *src_ctx;
} cpt_br_t;

// Initialize a bit-reader supplier that pulls bytes via 'src'
static void cpt_br_init_supplier(cpt_br_t *br, int (*src)(void *, int *), void *ctx) {
    br->buf = (uint8_t *)malloc(8192);
    br->len = 0;
    br->cap = br->buf ? 8192 : 0;
    br->bitpos = 0;
    br->streaming = 1;
    br->src = src;
    br->src_ctx = ctx;
}

static int cpt_br_refill(cpt_br_t *br, size_t need_bytes) {
    if (!br->streaming || !br->src)
        return 0;
    size_t bytepos = br->bitpos >> 3;
    if (bytepos > 0) {
        size_t rem = (br->len > bytepos) ? (br->len - bytepos) : 0;
        if (rem && br->buf)
            memmove(br->buf, br->buf + bytepos, rem);
        br->len = rem;
        br->bitpos &= 7;
    }
    if (br->len + need_bytes > br->cap) {
        size_t ncap = br->cap ? br->cap : 8192;
        while (ncap < br->len + need_bytes)
            ncap <<= 1;
        uint8_t *nb = (uint8_t *)realloc(br->buf, ncap);
        if (!nb)
            return -1;
        br->buf = nb;
        br->cap = ncap;
    }
    size_t pulled = 0;
    int b;
    while (pulled < need_bytes) {
        if (!br->src(br->src_ctx, &b))
            break;
        br->buf[br->len++] = (uint8_t)b;
        pulled++;
    }
    return (int)pulled;
}

static unsigned cpt_br_bits_left(cpt_br_t *br) {
    size_t avail = (br->len * 8 > br->bitpos) ? (br->len * 8 - br->bitpos) : 0;
    if (avail == 0 && br->streaming) {
        (void)cpt_br_refill(br, 1);
        avail = (br->len * 8 > br->bitpos) ? (br->len * 8 - br->bitpos) : 0;
    }
    return (unsigned)avail;
}

static unsigned cpt_br_peek(cpt_br_t *br, unsigned n) {
    if (n == 0)
        return 0;
    size_t avail_bits = cpt_br_bits_left(br);
    if (avail_bits < n && br->streaming) {
        size_t need = ((n - (unsigned)avail_bits) + 7) / 8;
        (void)cpt_br_refill(br, need);
    }
    unsigned acc = 0;
    unsigned got = 0;
    size_t bp = br->bitpos;
    while (got < n) {
        if (bp / 8 >= br->len)
            break;
        unsigned b = br->buf[bp / 8];
        unsigned rem = 8 - (bp & 7);
        unsigned take = (n - got < rem) ? (n - got) : rem;
        unsigned chunk = (b >> (rem - take)) & ((1u << take) - 1);
        acc = (acc << take) | chunk;
        bp += take;
        got += take;
    }
    return (got == n) ? acc : (acc << (n - got));
}

// Advance bit position by n bits
static void cpt_br_skip(cpt_br_t *br, unsigned n) { br->bitpos += n; }

// Read and consume n bits from the bit-reader
static unsigned cpt_br_get(cpt_br_t *br, unsigned n) {
    unsigned v = cpt_br_peek(br, n);
    cpt_br_skip(br, n);
    return v;
}

typedef struct {
    int tbits;
    int maxl;
    int minl;
    struct {
        uint8_t len; /* prefix length (<= 16) fits in 8 bits */
        int val;
    } *tab;
    struct {
        int b0, b1;
    } *tree;
    int n;
} cpt_pfx_t;
// Helper to check if a prefix tree node is a leaf
static int cpt_is_leaf(cpt_pfx_t *pc, int node) { return pc->tree[node].b0 == pc->tree[node].b1; }
// Return leaf node value
static int cpt_leaf_val(cpt_pfx_t *pc, int node) { return pc->tree[node].b0; }
// Allocate and initialize a new tree node, returning its index
static int cpt_new_node(cpt_pfx_t *pc) {
    void *nt = realloc(pc->tree, (size_t)(pc->n + 1) * sizeof(*pc->tree));
    if (!nt)
        return -1;
    pc->tree = nt;
    pc->tree[pc->n].b0 = -1;
    pc->tree[pc->n].b1 = -2;
    return pc->n++;
}

// Build prefix tables/trees from code length arrays for fast Huffman-style decoding
// Returns 0 on success, -1 on error
static int cpt_pfx_build(cpt_pfx_t *pc, const int *lens, int count, int maxLen) {
    memset(pc, 0, sizeof(*pc));
    pc->tbits = 10;
    pc->minl = 0x7fffffff;
    pc->maxl = 0;
    pc->n = 0;
    pc->tree = NULL;
    pc->tab = NULL;
    if (cpt_new_node(pc) < 0)
        return -1; // root
    int code = 0, left = count;
    for (int l = 1; l <= maxLen; l++) {
        for (int i = 0; i < count; i++)
            if (lens[i] == l) {
                int node = 0;
                for (int bp = l - 1; bp >= 0; bp--) {
                    int bit = (code >> bp) & 1;
                    int next = bit ? pc->tree[node].b1 : pc->tree[node].b0;
                    if (next < 0) {
                        next = cpt_new_node(pc);
                        if (next < 0)
                            return -1;
                        if (bit)
                            pc->tree[node].b1 = next;
                        else
                            pc->tree[node].b0 = next;
                    }
                    node = next;
                }
                pc->tree[node].b0 = pc->tree[node].b1 = i;
                if (l > pc->maxl)
                    pc->maxl = l;
                if (l < pc->minl)
                    pc->minl = l;
                code++;
                if (--left == 0)
                    goto built;
            }
        code <<= 1;
    }
built:;
    int tsizebits = (pc->maxl < pc->minl) ? 10 : (pc->maxl >= 10 ? 10 : pc->maxl);
    pc->tbits = tsizebits;
    unsigned tsizeu = 1u << (unsigned)tsizebits;
    if (tsizeu > INT32_MAX) return -1;
    int tsize = (int)tsizeu;
    pc->tab = malloc((size_t)tsize * sizeof(*pc->tab));
    if (!pc->tab)
        return -1;
    for (int i = 0; i < tsize; i++) {
        int node = 0;
        int depth = 0;
        for (;;) {
            if (cpt_is_leaf(pc, node)) {
                pc->tab[i].len = (uint8_t)depth;
                pc->tab[i].val = cpt_leaf_val(pc, node);
                break;
            }
            if ((unsigned)depth == (unsigned)tsizebits) {
                pc->tab[i].len = (uint8_t)(tsizebits + 1);
                pc->tab[i].val = node;
                break;
            }
            int bit = (i >> (tsizebits - 1 - depth)) & 1;
            int next = bit ? pc->tree[node].b1 : pc->tree[node].b0;
            if (next < 0) {
                pc->tab[i].len = 0;
                pc->tab[i].val = 0;
                break;
            }
            node = next;
            depth++;
        }
    }
    return 0;
}

// Free the resources allocated by a prefix structure
static void cpt_pfx_free(cpt_pfx_t *pc) {
    free(pc->tab);
    free(pc->tree);
    memset(pc, 0, sizeof(*pc));
}

// Decode the next symbol from the prefix structure using the bit reader
// Returns symbol index on success or -1 on error/EOF
static int cpt_pfx_next(cpt_pfx_t *pc, cpt_br_t *br) {
    if (cpt_br_bits_left(br) == 0)
        return -1;
    unsigned bits = cpt_br_peek(br, (unsigned)pc->tbits);
    unsigned len = pc->tab[bits].len;
    int val = pc->tab[bits].val;
    if (len == 0)
        return -1;
    if (len <= (unsigned)pc->tbits) {
        cpt_br_skip(br, len);
        return val;
    }
    cpt_br_skip(br, (unsigned)pc->tbits);
    int node = val;
    while (!cpt_is_leaf(pc, node)) {
        if (cpt_br_bits_left(br) == 0)
            return -1;
        unsigned bit = cpt_br_get(br, 1);
    int next = bit ? pc->tree[node].b1 : pc->tree[node].b0;
        if (next < 0)
            return -1;
        node = next;
    }
    return cpt_leaf_val(pc, node);
}

typedef struct {
    cpt_br_t br;
    uint8_t win[8192];
    unsigned wmask;
    size_t pos;
    unsigned blockcount;
    unsigned blockstart;
    cpt_pfx_t lit, lenp, offp;
    int lit_built, len_built, off_built;
} cpt_lzh_core_t;

// Memory-based LZH init removed; use supplier variant

static void cpt_lzh_core_init_supplier(cpt_lzh_core_t *lz, int (*src)(void *, int *), void *ctx) {
    memset(lz, 0, sizeof(*lz));
    cpt_br_init_supplier(&lz->br, src, ctx);
    memset(lz->win, 0, sizeof(lz->win));
    lz->wmask = 8192 - 1;
    lz->pos = 0;
    lz->blockcount = 0;
    lz->blockstart = 0;
    lz->lit_built = lz->len_built = lz->off_built = 0;
}

static int cpt_lzh_build_tables(cpt_lzh_core_t *lz) {
    unsigned numbytes;
    int lens[256];
    memset(lens, 0, sizeof(lens));
    if (cpt_br_bits_left(&lz->br) < 8u)
        return -1;
    numbytes = cpt_br_get(&lz->br, 8);
    if (numbytes * 2u > 256u)
        return -1;
    for (unsigned i = 0; i < numbytes; i++) {
    if (cpt_br_bits_left(&lz->br) < 8u)
            return -1;
    unsigned v = cpt_br_get(&lz->br, 8);
    lens[2 * i] = (int)(v >> 4);
    lens[2 * i + 1] = (int)(v & 0x0f);
    }
    if (cpt_pfx_build(&lz->lit, lens, 256, 15))
        return -1;
    lz->lit_built = 1;

    int lens2[64];
    memset(lens2, 0, sizeof(lens2));
    if (cpt_br_bits_left(&lz->br) < 8u)
        return -1;
    numbytes = cpt_br_get(&lz->br, 8);
    if (numbytes * 2u > 64u)
        return -1;
    for (unsigned i = 0; i < numbytes; i++) {
    if (cpt_br_bits_left(&lz->br) < 8u)
            return -1;
    unsigned v = cpt_br_get(&lz->br, 8);
    lens2[2 * i] = (int)(v >> 4);
    lens2[2 * i + 1] = (int)(v & 0x0f);
    }
    if (cpt_pfx_build(&lz->lenp, lens2, 64, 15))
        return -1;
    lz->len_built = 1;

    int lens3[128];
    memset(lens3, 0, sizeof(lens3));
    if (cpt_br_bits_left(&lz->br) < 8u)
        return -1;
    numbytes = cpt_br_get(&lz->br, 8);
    if (numbytes * 2u > 128u)
        return -1;
    for (unsigned i = 0; i < numbytes; i++) {
    if (cpt_br_bits_left(&lz->br) < 8u)
            return -1;
    unsigned v = cpt_br_get(&lz->br, 8);
    lens3[2 * i] = (int)(v >> 4);
    lens3[2 * i + 1] = (int)(v & 0x0f);
    }
    if (cpt_pfx_build(&lz->offp, lens3, 128, 15))
        return -1;
    lz->off_built = 1;

    lz->blockcount = 0;
    lz->blockstart = (unsigned)(lz->br.bitpos / 8);
    return 0;
}

static void cpt_lzh_free_tables(cpt_lzh_core_t *lz) {
    if (lz->lit_built) {
        cpt_pfx_free(&lz->lit);
        lz->lit_built = 0;
    }
    if (lz->len_built) {
        cpt_pfx_free(&lz->lenp);
        lz->len_built = 0;
    }
    if (lz->off_built) {
        cpt_pfx_free(&lz->offp);
        lz->off_built = 0;
    }
}

typedef struct {
    cpt_lzh_core_t core;
    unsigned have_pending;
    unsigned pend_pos;
    unsigned pend_len;
    uint8_t pend_buf[8192];
} cpt_lzh_supplier_t;

// Initialize an LZH supplier wrapper given a source callback
static void cpt_lzhs_init_from_supplier(cpt_lzh_supplier_t *s, int (*sup)(void *, int *), void *ctx) {
    memset(s, 0, sizeof(*s));
    cpt_lzh_core_init_supplier(&s->core, sup, ctx);
}

// Dispose and free an LZH supplier instance
static void cpt_lzhs_dispose(cpt_lzh_supplier_t *s) {
    if (!s)
        return;
    cpt_lzh_free_tables(&s->core);
    if (s->core.br.streaming && s->core.br.buf) {
        free(s->core.br.buf);
        s->core.br.buf = NULL;
        s->core.br.len = s->core.br.cap = s->core.br.bitpos = 0;
        s->core.br.streaming = 0;
    }
}

// Produce the next decompressed byte from the streaming LZH supplier
// Returns 1 and sets *outbyte on success, 0 on EOF, -1 on error
static int cpt_lzhs_next(cpt_lzh_supplier_t *s, int *outbyte) {
    if (s->have_pending) {
        if (s->pend_pos < s->pend_len) {
            *outbyte = s->pend_buf[s->pend_pos++];
            s->core.win[s->core.pos & s->core.wmask] = (uint8_t)*outbyte;
            s->core.pos++;
            if (s->pend_pos == s->pend_len)
                s->have_pending = 0;
            return 1;
        }
        s->have_pending = 0;
    }
    for (;;) {
        if (s->core.blockcount >= 0x1fff0) {
            unsigned rem = (unsigned)(s->core.br.bitpos & 7);
            if (rem)
                cpt_br_skip(&s->core.br, 8 - rem);
            unsigned consumed = (unsigned)(s->core.br.bitpos / 8 - s->core.blockstart);
            if (consumed & 1)
                cpt_br_skip(&s->core.br, 24);
            else
                cpt_br_skip(&s->core.br, 16);
            s->core.blockcount = 0;
            s->core.blockstart = (unsigned)(s->core.br.bitpos / 8);
            cpt_lzh_free_tables(&s->core);
        }
        if (!s->core.lit_built) {
            if (cpt_lzh_build_tables(&s->core))
                return 0;
        }
        if (cpt_br_bits_left(&s->core.br) == 0)
            return 0;
        unsigned flag = cpt_br_get(&s->core.br, 1U);
        if (flag) {
            s->core.blockcount += 2;
            int sym = cpt_pfx_next(&s->core.lit, &s->core.br);
            if (sym < 0)
                return 0;
            uint8_t b = (uint8_t)sym;
            s->core.win[s->core.pos & s->core.wmask] = b;
            s->core.pos++;
            *outbyte = b;
            return 1;
        } else {
            s->core.blockcount += 3;
            int lsym = cpt_pfx_next(&s->core.lenp, &s->core.br);
            if (lsym < 0)
                return 0;
            int osym = cpt_pfx_next(&s->core.offp, &s->core.br);
            if (osym < 0)
                return 0;
            unsigned off = ((unsigned)osym) << 6;
            off |= cpt_br_get(&s->core.br, 6U);
            unsigned mlen = (unsigned)lsym;
            if (mlen == 0)
                return 0;
            size_t start = s->core.pos - (size_t)off;
            uint8_t first = s->core.win[start & s->core.wmask];
            s->core.win[s->core.pos & s->core.wmask] = first;
            s->core.pos++;
            *outbyte = first;
            if (mlen > 1) {
                s->pend_len = mlen - 1;
                s->pend_pos = 0;
                for (unsigned i = 1; i < mlen; i++) {
                    s->pend_buf[i - 1] = s->core.win[(start + i) & s->core.wmask];
                }
                s->have_pending = 1;
            }
            return 1;
        }
    }
}

typedef int (*cpt_getbyte_cb)(void *ctx, int *outbyte);

// Memory-backed byte supplier for raw (non-LZH) forks
typedef struct {
    const uint8_t *base; // pointer to start of archive memory
    size_t pos; // current absolute position in archive
    size_t end; // absolute end position (exclusive)
} cpt_mem_supplier_t;

// Initialize an in-memory supplier over base[offset:offset+length)
static int cpt_mem_sup_init(cpt_mem_supplier_t *s, const uint8_t *base, size_t archive_size, size_t offset,
                            size_t length) {
    if (!s || !base)
        return -1;
    if (offset > archive_size || length > archive_size || offset + length > archive_size)
        return -1;
    s->base = base;
    s->pos = offset;
    s->end = offset + length;
    return 0;
}

// Memory-backed supplier: return next byte from the configured window
static int cpt_mem_next(void *ctx, int *outbyte) {
    cpt_mem_supplier_t *s = (cpt_mem_supplier_t *)ctx;
    if (!s || !s->base)
        return 0;
    if (s->pos >= s->end)
        return 0;
    *outbyte = s->base[s->pos++] & 0xFF;
    return 1;
}

/* --- Stateful RLE stream decoder (no full output buffer) --- */
typedef struct {
    int repeat;
    int saved;
    int half;
    cpt_getbyte_cb getb;
    void *ctx;
} cpt_rle_stream_t;

// Initialize RLE stream decoder state
static void cpt_rle_stream_init(cpt_rle_stream_t *st, cpt_getbyte_cb getb, void *ctx) {
    memset(st, 0, sizeof(*st));
    st->getb = getb;
    st->ctx = ctx;
}

// Read decompressed bytes from the RLE90-style stream into 'out'
// Returns bytes produced, 0 on EOF, or -1 on error
static ssize_t cpt_rle_stream_read(cpt_rle_stream_t *st, uint8_t *out, size_t outlen) {
    size_t dp = 0;
    while (dp < outlen) {
        if (st->repeat) {
            st->repeat--;
            out[dp++] = (uint8_t)st->saved;
            continue;
        }
        int byte;
        if (st->half) {
            byte = 0x81;
            st->half = 0;
        } else {
            if (!st->getb(st->ctx, &byte)) {
                if (dp > (size_t)SSIZE_MAX) return -1;
                return (ssize_t)dp;
            }
        }
        if (byte == 0x81) {
            int b2;
            if (!st->getb(st->ctx, &b2)) { /* need more source; return partial */
                if (dp > (size_t)SSIZE_MAX) return -1;
                return (ssize_t)dp;
            }
            if (b2 == 0x82) {
                int n;
                if (!st->getb(st->ctx, &n)) {
                    if (dp > (size_t)SSIZE_MAX) return -1;
                    return (ssize_t)dp;
                }
                if (n != 0) {
                    st->repeat = n - 2;
                    if (dp >= outlen) {
                        if (dp > (size_t)SSIZE_MAX) return -1;
                        return (ssize_t)dp;
                    }
                    out[dp++] = (uint8_t)st->saved;
                } else {
                    if (dp >= outlen) {
                        if (dp > (size_t)SSIZE_MAX) return -1;
                        return (ssize_t)dp;
                    }
                    out[dp++] = 0x81;
                    st->saved = 0x82;
                    st->repeat = 1;
                }
            } else {
                if (b2 == 0x81) {
                    st->half = 1;
                    st->saved = 0x81;
                    if (dp >= outlen) {
                        if (dp > (size_t)SSIZE_MAX) return -1;
                        return (ssize_t)dp;
                    }
                    out[dp++] = 0x81;
                } else {
                    if (dp >= outlen) {
                        if (dp > (size_t)SSIZE_MAX) return -1;
                        return (ssize_t)dp;
                    }
                    out[dp++] = 0x81;
                    st->saved = b2;
                    st->repeat = 1;
                }
            }
        } else {
            if (dp >= outlen) {
                if (dp > (size_t)SSIZE_MAX) return -1;
                return (ssize_t)dp;
            }
            st->saved = byte;
            out[dp++] = (uint8_t)byte;
        }
    }
    if (dp > (size_t)SSIZE_MAX) return -1;
    return (ssize_t)dp;
}

// Probe an input layer to determine if it contains a CPT archive header
// Returns 1 if recognized, 0 if not, or negative on I/O error
static int cpt_probe_header(munbox_layer_t *input) {
    if (!input)
        return munbox_error("input is NULL in cpt_probe_header");

    uint8_t hdr[8];
    if (!input->open)
        return 0; /* Cannot safely probe without open() */
    munbox_file_info_t dummy;
    int rc = input->open(input, MUNBOX_OPEN_FIRST, &dummy);
    if (rc < 0)
        return rc;
    if (rc == 0)
        return 0;
    ssize_t n = input->read(input, hdr, sizeof(hdr));
    if (n < 0)
        return (int)n;
    if (n < 8) {
        (void)input->open(input, MUNBOX_OPEN_FIRST, &dummy);
        return 0;
    }
    // Reset to start for the factory to proceed
    (void)input->open(input, MUNBOX_OPEN_FIRST, &dummy);

    /* Check magic bytes */
    if (hdr[0] != CPT_MAGIC_BYTE || hdr[1] != CPT_VOLUME_SINGLE) {
        return 0; /* Not a CPT archive */
    }

    /* Basic sanity check on directory offset */
    uint32_t dir_offset = LOAD_BE32(hdr + 4);
    if (dir_offset < 8 || dir_offset > 0x10000000) { /* Reasonable limit */
        return 0;
    }

    return 1; /* Recognized as CPT */
}

// Append a parsed cpt_file_entry_t to the dynamic entries array
// Returns 0 on success, -1 on allocation failure
static int cpt_entries_push(cpt_file_entry_t **entries, size_t *count, size_t *cap, const cpt_file_entry_t *src) {
    if (*count >= *cap) {
        size_t ncap = (*cap == 0) ? 16 : (*cap * 2);
        void *nb = realloc(*entries, ncap * sizeof(cpt_file_entry_t));
        if (!nb)
            return -1;
        *entries = (cpt_file_entry_t *)nb;
        *cap = ncap;
    }
    (*entries)[*count] = *src;
    (*count)++;
    return 0;
}

// Build a combined path into dest from parent and name, truncating safely
// dest must be at least 256 bytes
static void cpt_build_path(char dest[256], const char *parent, const char *name, size_t name_len) {
    dest[0] = '\0';
    size_t dp = 0;
    if (parent && parent[0]) {
        size_t lp = strnlen(parent, 255);
        if (lp > 0) {
            size_t cpy = lp < 255 ? lp : 255;
            memcpy(dest, parent, cpy);
            dp = cpy;
            if (dp < 255)
                dest[dp++] = '/';
        }
    }
    size_t cpy2 = name_len;
    if (cpy2 > 0) {
        if (dp + cpy2 > 255)
            cpy2 = 255 - dp;
        memcpy(dest + dp, name, cpy2);
        dp += cpy2;
    }
    dest[dp] = '\0';
}

// Walk a directory structure located in-memory and append entries to out_entries
// Returns 0 on success or negative on error
static int cpt_walk_dir_mem(const uint8_t *data, size_t size, size_t *cursor, int entries_in_this_dir,
                            const char *parent_rel, cpt_file_entry_t **out_entries, size_t *out_count,
                            size_t *out_cap) {
    while (entries_in_this_dir > 0) {
        if (*cursor >= size)
            return munbox_error("Directory entry beyond end of archive");
        uint8_t nlentype = data[*cursor];
        int name_len = nlentype & 0x7F;
        bool is_dir = (nlentype & CPT_ENTRY_DIR_FLAG) != 0;
        if (*cursor + 1 + (size_t)name_len > size)
            return munbox_error("Entry name beyond file size");
        const char *nameptr = (const char *)(data + *cursor + 1);
        char namebuf[256];
        if (name_len > 0) {
            size_t cpy = (size_t)name_len < sizeof(namebuf) - 1 ? (size_t)name_len : sizeof(namebuf) - 1;
            memcpy(namebuf, nameptr, cpy);
            namebuf[cpy] = '\0';
        } else {
            namebuf[0] = '\0';
        }
        *cursor += 1 + (size_t)name_len;

        char fullpath[256];
        cpt_build_path(fullpath, parent_rel, namebuf, (size_t)name_len);

        if (is_dir) {
            if (*cursor + 2 > size)
                return munbox_error("Directory child count beyond file size");
            uint16_t child_count = LOAD_BE16(data + *cursor);
            *cursor += 2;
            int r = cpt_walk_dir_mem(data, size, cursor, child_count, fullpath, out_entries, out_count, out_cap);
            if (r < 0)
                return r;
            entries_in_this_dir -= (child_count + 1);
            continue;
        }

        size_t need = 1 + 4 * 10 + 2 + 2; /* 45 bytes of file metadata */
        if (*cursor + need > size)
            return munbox_error("File metadata extends beyond archive");
        const uint8_t *meta = data + *cursor;
        size_t off = 0;
        cpt_file_entry_t fe;
        memset(&fe, 0, sizeof(fe));
        strncpy(fe.name, fullpath, sizeof(fe.name) - 1);
        fe.volume = meta[off++];
        fe.file_offset = LOAD_BE32(meta + off);
        off += 4;
        fe.type = LOAD_BE32(meta + off);
        off += 4;
        fe.creator = LOAD_BE32(meta + off);
        off += 4;
        fe.create_date = LOAD_BE32(meta + off);
        off += 4;
        fe.mod_date = LOAD_BE32(meta + off);
        off += 4;
        fe.finder_flags = LOAD_BE16(meta + off);
        off += 2;
        fe.data_crc = LOAD_BE32(meta + off);
        off += 4;
        fe.flags = LOAD_BE16(meta + off);
        off += 2;
        fe.rsrc_uncomp_len = LOAD_BE32(meta + off);
        off += 4;
        fe.data_uncomp_len = LOAD_BE32(meta + off);
        off += 4;
        fe.rsrc_comp_len = LOAD_BE32(meta + off);
        off += 4;
        fe.data_comp_len = LOAD_BE32(meta + off);
        off += 4;
        if (cpt_entries_push(out_entries, out_count, out_cap, &fe) < 0)
            return munbox_error("oom entries");
        *cursor += need;
        entries_in_this_dir -= 1;
    }
    return 0;
}

// Parse the CPT directory located at dir_offset inside data and return dynamic entries
// Returns 0 on success, negative on error
static int cpt_parse_directory_mem(const uint8_t *data, size_t size, uint32_t dir_offset,
                                   cpt_file_entry_t **out_entries, size_t *out_count) {
    if (!data || !out_entries || !out_count)
        return munbox_error("Invalid args to cpt_parse_directory_mem");
    if (dir_offset + 7 > size)
        return munbox_error("Directory header beyond file size");
    const uint8_t *hdr7 = data + dir_offset;
    uint32_t dir_crc = LOAD_BE32(hdr7);
    (void)dir_crc; /* CRC currently not validated */
    uint16_t total_entries = LOAD_BE16(hdr7 + 4);
    uint8_t comment_len = hdr7[6];
    size_t cursor = dir_offset + 7 + comment_len;
    if (cursor > size)
        return munbox_error("Comment extends beyond file size");
    cpt_file_entry_t *entries = NULL;
    size_t count = 0, cap = 0;
    int r = cpt_walk_dir_mem(data, size, &cursor, (int)total_entries, "", &entries, &count, &cap);
    if (r < 0) {
        free(entries);
        return r;
    }
    *out_entries = entries;
    *out_count = count;
    return 0;
}

// --- Fork Decompression (streaming) ---

// Adapter: call LZH supplier to get next single byte
static int getbyte_lzh(void *ctx, int *outbyte) { return cpt_lzhs_next((cpt_lzh_supplier_t *)ctx, outbyte); }

typedef struct {
    bool use_lzh; // Supplier for LZH or RAW
    cpt_lzh_supplier_t lzh;
    cpt_getbyte_cb getb;
    void *getb_ctx;
    cpt_rle_stream_t rle; // RLE state
    size_t out_remaining; // Remaining uncompressed bytes to produce
    int finished; // Finished flag
} cpt_fork_stream_t;

// Init variant for when the caller already has a getbyte supplier (e.g., file-backed raw forks)
// out_len is the expected uncompressed output length
static void cpt_fork_stream_init_with_supplier(cpt_fork_stream_t *fs, cpt_getbyte_cb getb, void *ctx, size_t out_len) {
    memset(fs, 0, sizeof(*fs));
    fs->use_lzh = false;
    fs->out_remaining = out_len;
    fs->finished = (out_len == 0);
    fs->getb = getb;
    fs->getb_ctx = ctx;
    cpt_rle_stream_init(&fs->rle, fs->getb, fs->getb_ctx);
}

// Initialize fork stream to use LZH supplier for compressed input
// out_len is the expected uncompressed output length
static void cpt_fork_stream_init_lzh_supplier(cpt_fork_stream_t *fs, cpt_getbyte_cb sup, void *ctx, size_t out_len) {
    memset(fs, 0, sizeof(*fs));
    fs->use_lzh = true;
    fs->out_remaining = out_len;
    fs->finished = (out_len == 0);
    cpt_lzhs_init_from_supplier(&fs->lzh, sup, ctx);
    fs->getb = getbyte_lzh;
    fs->getb_ctx = &fs->lzh;
    cpt_rle_stream_init(&fs->rle, fs->getb, fs->getb_ctx);
}

// Dispose of any resources held by the fork stream
static void cpt_fork_stream_dispose(cpt_fork_stream_t *fs) {
    if (!fs)
        return;
    if (fs->use_lzh)
        cpt_lzhs_dispose(&fs->lzh);
}

// Read up to max_out decompressed bytes from the fork stream into out
// Returns number of bytes produced, 0 on EOF, or negative on error
static ssize_t cpt_fork_stream_read(cpt_fork_stream_t *fs, uint8_t *out, size_t max_out) {
    if (fs->finished || fs->out_remaining == 0)
        return 0;
    if (max_out > fs->out_remaining)
        max_out = fs->out_remaining;
    ssize_t n = cpt_rle_stream_read(&fs->rle, out, max_out);
    if (n < 0)
        return n;
    fs->out_remaining -= (size_t)n;
    if (n == 0 || fs->out_remaining == 0)
        fs->finished = 1;
    return n;
}

// Reader object stored in cur_buf while a fork is open; owns a compressed buffer when sourced from file
typedef struct cpt_stream_reader {
    cpt_fork_stream_t fork;
    cpt_mem_supplier_t mem_sup;
} cpt_stream_reader_t;

// --- Legacy extract implementation removed ---

// Close and free a CPT layer and its internal state
static void cpt_layer_close(munbox_layer_t *self) {
    if (!self)
        return;
    cpt_layer_state_t *st = (cpt_layer_state_t *)self->internal_state;
    if (st) {
        if (st->source)
            st->source->close(st->source);
        free(st->archive_data);
        free(st->entries);
        if (st->cur_buf) {
            cpt_stream_reader_t *sr = (cpt_stream_reader_t *)st->cur_buf;
            cpt_fork_stream_dispose(&sr->fork);
            free(st->cur_buf);
        }
        free(st);
    }
    free(self);
}

// Read from the currently-open fork in the CPT layer
static ssize_t cpt_layer_read(munbox_layer_t *self, void *buf, size_t cnt) {
    cpt_layer_state_t *st = (cpt_layer_state_t *)self->internal_state;
    if (!st)
        return MUNBOX_ERROR;
    if (!st->opened)
        return munbox_error("read() called before open() on cpt layer");
    cpt_stream_reader_t *sr = (cpt_stream_reader_t *)st->cur_buf; // repurpose cur_buf to hold reader state
    if (!sr)
        return 0;
    ssize_t n = cpt_fork_stream_read(&sr->fork, (uint8_t *)buf, cnt);
    if (n == 0)
        return 0;
    if (n < 0)
        return MUNBOX_ERROR;
    return n;
}

// Open the next file/fork in the CPT layer and return its metadata in info
// Returns 1 on success with info filled, 0 when no more entries, negative on error
static int cpt_layer_open(munbox_layer_t *self, munbox_open_t what, munbox_file_info_t *info) {
    if (!self || !info)
        return munbox_error("NULL args to cpt_layer_open");
    cpt_layer_state_t *st = (cpt_layer_state_t *)self->internal_state;
    if (!st || !st->entries || st->entry_count == 0)
        return 0;
    st->opened = true;

    if (what == MUNBOX_OPEN_FIRST) {
        st->iter_index = 0;
        st->iter_fork = 0; // start with data fork
    } else { // NEXT
        if (st->iter_index >= st->entry_count)
            return 0;
        // advance fork then entry
        const cpt_file_entry_t *e = &st->entries[st->iter_index];
        if (st->iter_fork == 0 && e->rsrc_uncomp_len > 0) {
            st->iter_fork = 1;
        } else {
            st->iter_index++;
            st->iter_fork = 0;
        }
    }

    // Skip empty forks
    while (st->iter_index < st->entry_count) {
        const cpt_file_entry_t *e = &st->entries[st->iter_index];
        if (st->iter_fork == 0 && e->data_uncomp_len == 0) {
            st->iter_fork = 1;
            continue;
        }
        if (st->iter_fork == 1 && e->rsrc_uncomp_len == 0) {
            st->iter_index++;
            st->iter_fork = 0;
            continue;
        }
        break;
    }
    if (st->iter_index >= st->entry_count)
        return 0;

    // Initialize streaming decompressor for selected fork
    if (st->cur_buf) {
        cpt_stream_reader_t *old = (cpt_stream_reader_t *)st->cur_buf;
        cpt_fork_stream_dispose(&old->fork);
        free(st->cur_buf);
    }
    st->cur_buf = NULL;
    const cpt_file_entry_t *e = &st->entries[st->iter_index];
    bool is_data = (st->iter_fork == 0);
    uint32_t uncomp_len = is_data ? e->data_uncomp_len : e->rsrc_uncomp_len;
    uint32_t comp_len = is_data ? e->data_comp_len : e->rsrc_comp_len;
    uint32_t comp_off = e->file_offset + (is_data ? e->rsrc_comp_len : 0);
    bool use_lzh = is_data ? ((e->flags & CPT_FLAG_DATA_LZH) != 0) : ((e->flags & CPT_FLAG_RSRC_LZH) != 0);
    if ((size_t)comp_off + comp_len > st->archive_size)
        return munbox_error("CPT fork extends beyond archive");
    if (uncomp_len > 0) {
        cpt_stream_reader_t *sr = (cpt_stream_reader_t *)calloc(1, sizeof(cpt_stream_reader_t));
        if (!sr)
            return munbox_error("Out of memory");
        if (cpt_mem_sup_init(&sr->mem_sup, st->archive_data, st->archive_size, comp_off, comp_len) < 0) {
            free(sr);
            return munbox_error("mem supplier init failed");
        }
        if (use_lzh)
            cpt_fork_stream_init_lzh_supplier(&sr->fork, cpt_mem_next, &sr->mem_sup, uncomp_len);
        else
            cpt_fork_stream_init_with_supplier(&sr->fork, cpt_mem_next, &sr->mem_sup, uncomp_len);
        st->cur_buf = (uint8_t *)sr; // store state pointer
    }

    // Populate file info
    memset(&st->cur_info, 0, sizeof(st->cur_info));
    strncpy(st->cur_info.filename, e->name, sizeof(st->cur_info.filename) - 1);
    st->cur_info.length = is_data ? e->data_uncomp_len : e->rsrc_uncomp_len;
    st->cur_info.type = e->type;
    st->cur_info.creator = e->creator;
    st->cur_info.finder_flags = e->finder_flags;
    st->cur_info.has_metadata = true;
    st->cur_info.fork_type = is_data ? MUNBOX_FORK_DATA : MUNBOX_FORK_RESOURCE;
    *info = st->cur_info;

    // Ensure read is available for streaming after open()
    self->read = cpt_layer_read;
    // get_file_info removed; metadata available via open()
    return 1;
}

// === Factory ===
// Create a new CPT layer around input if it contains a CPT archive, otherwise return NULL
munbox_layer_t *munbox_new_cpt_layer(munbox_layer_t *input) {
    if (!input)
        return NULL;

    // Probe header without consuming input
    int rc = cpt_probe_header(input);
    if (rc < 0) {
    // Fatal I/O error while probing
        return NULL;
    }
    if (rc == 0) {
    // Not recognized
        return NULL;
    }

    // Allocate layer and state
    munbox_layer_t *layer = (munbox_layer_t *)malloc(sizeof(munbox_layer_t));
    cpt_layer_state_t *st = (cpt_layer_state_t *)calloc(1, sizeof(cpt_layer_state_t));
    if (!layer || !st) {
        free(layer);
        free(st);
        return NULL;
    }

    // Read entire archive into memory (required for random access due to absolute offsets)
    size_t cap = 0, size = 0;
    uint8_t *buf = NULL;
    {
        munbox_file_info_t dummy;
        if (input->open)
            (void)input->open(input, MUNBOX_OPEN_FIRST, &dummy);
        uint8_t chunk[64 * 1024];
        ssize_t n;
        while ((n = input->read(input, chunk, sizeof(chunk))) > 0) {
            if (size + (size_t)n > cap) {
                size_t ncap = cap ? cap * 2 : 128 * 1024;
                while (ncap < size + (size_t)n)
                    ncap *= 2;
                uint8_t *nb = (uint8_t *)realloc(buf, ncap);
                if (!nb) {
                    free(buf);
                    free(layer);
                    free(st);
                    return NULL;
                }
                buf = nb;
                cap = ncap;
            }
            memcpy(buf + size, chunk, (size_t)n);
            size += (size_t)n;
        }
        if (n < 0) {
            free(buf);
            free(layer);
            free(st);
            return NULL;
        }
    }
    if (size < 8) {
        free(buf);
        free(layer);
        free(st);
        return NULL;
    }
    uint32_t dir_offset = LOAD_BE32(buf + 4);

    // Parse directory and build file entries
    cpt_file_entry_t *entries = NULL;
    size_t entry_count = 0;
    if (cpt_parse_directory_mem(buf, size, dir_offset, &entries, &entry_count) < 0) {
        free(buf);
        free(layer);
        free(st);
        return NULL;
    }

    // Initialize state
    st->source = input;
    st->archive_data = buf;
    st->archive_size = size;
    st->entries = entries;
    st->entry_count = entry_count;

    // Initialize layer vtable
    layer->internal_state = st;
    layer->read = NULL; // will be set on first open()
    layer->close = cpt_layer_close;
    layer->open = cpt_layer_open;
    // no extract; use open/read

    return layer;
}
