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

// sit.c
// StuffIt (.sit) format layer implementation for munbox.

#include "sit.h"
#include "munbox.h"
#include "munbox_internal.h"
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Local helper: safely join parent path and name into destination buffer (always NUL terminates).
static void sit_join_path(char *dst, size_t dst_cap, const char *parent, const char *name) {
    if (!dst_cap)
        return;
    dst[0] = '\0';
    if (parent && parent[0]) {
        size_t pos = 0;
        size_t lp = strnlen(parent, dst_cap - 1);
        if (lp) {
            memcpy(dst, parent, lp);
            pos = lp;
        }
        if (pos < dst_cap - 1) {
            dst[pos++] = '/';
        }
        if (name && pos < dst_cap - 1) {
            size_t rem = dst_cap - 1 - pos;
            size_t ln = strnlen(name, rem);
            if (ln)
                memcpy(dst + pos, name, ln);
            pos += ln;
        }
        dst[pos < dst_cap ? pos : (dst_cap - 1)] = '\0';
    } else if (name) {
        size_t ln = strnlen(name, dst_cap - 1);
        memcpy(dst, name, ln);
        dst[ln] = '\0';
    }
}

// Forward declarations for LZW (method 2) streaming helpers
struct lzw_ctx;
// Initialize an LZW streaming context over a compressed buffer.
static struct lzw_ctx *lzw_init(const uint8_t *src, size_t src_len);
// Read up to `cap` bytes from the LZW context into `out`.
static ssize_t lzw_read(struct lzw_ctx *c, uint8_t *out, size_t cap);
// Free an LZW streaming context and its resources.
static void lzw_free(struct lzw_ctx *c);

// --- Utility Macros ---

#define LOAD_BE16(p) (((uint16_t)((uint8_t *)(p))[0] << 8) | ((uint16_t)((uint8_t *)(p))[1]))

#define LOAD_BE32(p)                                                                                                   \
    (((uint32_t)((uint8_t *)(p))[0] << 24) | ((uint32_t)((uint8_t *)(p))[1] << 16) |                                   \
     ((uint32_t)((uint8_t *)(p))[2] << 8) | ((uint32_t)((uint8_t *)(p))[3]))

// --- External Decompression Functions ---

// sit13 and sit15 are implemented in separate files

// --- SIT Layer State ---

// Define streaming kinds and state before the layer state (complete types needed)
// Represents the different decompression methods supported in SIT archives
enum sit_stream_kind { STRM_NONE = 0, STRM_COPY = 1, STRM_RLE90 = 2, STRM_SIT15 = 3, STRM_LZW = 4, STRM_SIT13 = 5 };
typedef enum sit_stream_kind sit_stream_kind_t;

// Holds state for streaming decompression of a single SIT file entry
typedef struct sit_stream_state {
    // common
    sit_stream_kind_t kind;
    const uint8_t *src;
    size_t src_len;
    size_t src_pos;
    size_t out_rem; // uncompressed bytes remaining to produce
    bool skip_crc;
    uint16_t crc_accum;
    // rle90 state
    uint8_t last_byte;
    size_t rep_rem; // remaining repeat count for last_byte
    // LZW state (method 2)
    struct lzw_ctx *lzw;
    // SIT13 state
    sit13_ctx_t *sit13;
} sit_stream_state_t;

typedef struct {
    // Descriptor for a fork: uncompressed/comp lengths, crc, method and pointer
    uint32_t uncomp_len;
    uint32_t comp_len;
    uint16_t crc;
    uint8_t method;
    const uint8_t *comp_ptr; // points into archive_data
} sit_fork_desc_t;

typedef struct {
    munbox_layer_t *source;
    uint8_t *archive_data;
    size_t archive_size;
    bool is_sit5;

    union {
        struct {
            // Sequential reading state for classic SIT
            uint32_t current_offset;     // Current position in archive for next entry header
            uint32_t num_files;          // Number of files from archive header
            uint32_t files_processed;    // How many files we've processed so far
            
            // Directory tracking for path building (stack-based)
            char folder_stack[10][256];  // Classic SIT has simpler folder structure
            int folder_depth;
        } classic;
        struct {
            // Sequential reading state for SIT5
            uint32_t current_cursor;    // Current position in archive for next entry
            uint32_t initial_cursor;    // Starting cursor from archive header
            uint32_t entries_remaining; // Number of entries left to process
            
            // Directory tracking for path building (stack-based)
            struct {
                uint32_t offset;
                char path[512];
                uint32_t parent_offset; // To detect when we exit this directory
            } dir_stack[32];
            int dir_stack_depth;
        } sit5;
    } format_state;

    bool first_open_called;      // Track if first open was called

    // Current file state
    int iter_fork; // 0=data, 1=rsrc
    munbox_file_info_t cur_info;
    
    // Fork descriptors for current file
    sit_fork_desc_t data_fork;
    sit_fork_desc_t rsrc_fork;
    bool has_rsrc_fork;

    // Streaming fields
    sit_stream_kind_t cur_stream_kind; // current mode
    sit_stream_state_t stream; // streaming state for current fork
    uint16_t expected_crc; // expected CRC for current fork
    sit15_ctx_t *sit15_ctx; // SIT15 streaming context, if used
    sit13_ctx_t *sit13_ctx; // SIT13 streaming context, if used
    struct lzw_ctx *lzw_ctx; // LZW streaming context, if used
    bool opened; // require open() before read()
} sit_layer_state_t;

// Debug helper: enable verbose SIT logs if env var is set
// Returns true if SIT debug logging is enabled via MUNBOX_DEBUG_SIT env var
static bool sit_debug_enabled(void) {
    static int inited = 0;
    static bool enabled = false;
    if (!inited) {
        const char *v = getenv("MUNBOX_DEBUG_SIT");
        enabled = (v && *v && strcmp(v, "0") != 0);
        inited = 1;
    }
    return enabled;
}

// Forward declarations for vtable wiring: open/read implementations
static int sit_layer_open(munbox_layer_t *self, munbox_open_t what, munbox_file_info_t *info);
// Read uncompressed bytes from the current fork
static ssize_t sit_layer_read(munbox_layer_t *self, void *buf, size_t cnt);


// Forward declarations for vtable wiring: open/read implementations
static int sit5_layer_open(munbox_layer_t *self, munbox_open_t what, munbox_file_info_t *info);



// --- CRC Calculation ---
// Reflected CRC-16 table (poly 0x8005) shared by all CRC routines in this file
static const uint16_t sit_crc_table[256] = {
    0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241, 0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1,
    0xC481, 0x0440, 0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40, 0x0A00, 0xCAC1, 0xCB81, 0x0B40,
    0xC901, 0x09C0, 0x0880, 0xC841, 0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40, 0x1E00, 0xDEC1,
    0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41, 0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
    0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040, 0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1,
    0xF281, 0x3240, 0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441, 0x3C00, 0xFCC1, 0xFD81, 0x3D40,
    0xFF01, 0x3FC0, 0x3E80, 0xFE41, 0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840, 0x2800, 0xE8C1,
    0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41, 0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
    0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640, 0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0,
    0x2080, 0xE041, 0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240, 0x6600, 0xA6C1, 0xA781, 0x6740,
    0xA501, 0x65C0, 0x6480, 0xA441, 0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41, 0xAA01, 0x6AC0,
    0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840, 0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
    0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40, 0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1,
    0xB681, 0x7640, 0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041, 0x5000, 0x90C1, 0x9181, 0x5140,
    0x9301, 0x53C0, 0x5280, 0x9241, 0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440, 0x9C01, 0x5CC0,
    0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40, 0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
    0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40, 0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0,
    0x4C80, 0x8C41, 0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641, 0x8201, 0x42C0, 0x4380, 0x8341,
    0x4100, 0x81C1, 0x8081, 0x4040,
};

// Updates a CRC-16 (poly 0x8005 reflected) with the provided buffer
static uint16_t sit_crc_process(uint16_t crc, const uint8_t *buffer, size_t length) {
    while (length--) {
        crc = sit_crc_table[(crc ^ *buffer++) & 0xff] ^ (crc >> 8);
    }
    return crc;
}

// Computes CRC-16 over a full buffer starting from zero
static uint16_t sit_crc(const uint8_t *buffer, size_t length) { return sit_crc_process(0, buffer, length); }

// Incrementally updates an existing CRC-16 with new data
static uint16_t sit_crc_update(uint16_t crc, const uint8_t *buffer, size_t length) {
    return sit_crc_process(crc, buffer, length);
}

// (Legacy extraction code removed; layer uses open()/read())

// --- Layer Implementation ---

// SIT layer does not support peeking.

// Close an open SIT layer and free all associated resources.
// Frees internal contexts, buffers, and the layer object.
static void sit_layer_close(munbox_layer_t *self) {
    if (!self)
        return;
    sit_layer_state_t *state = (sit_layer_state_t *)self->internal_state;
    if (state) {
        if (state->source)
            state->source->close(state->source);
        free(state->archive_data);
        if (state->sit15_ctx) {
            sit15_free(state->sit15_ctx);
            state->sit15_ctx = NULL;
        }
        if (state->sit13_ctx) {
            sit13_free(state->sit13_ctx);
            state->sit13_ctx = NULL;
        }
        if (state->lzw_ctx) {
            lzw_free(state->lzw_ctx);
            state->lzw_ctx = NULL;
        }
        free(state);
    }
    free(self);
}

// --- Extended Layer Functions ---

// (Legacy extraction code removed)

/* static int sit_extract(munbox_layer_t *self, const munbox_extract_callbacks_t *callbacks) { return MUNBOX_ERROR; } */

static bool load_archive_from_input(munbox_layer_t *input, uint8_t **archive_data, size_t *archive_size, const uint8_t *hdr, size_t hdr_len) {
    size_t cap = hdr_len ? hdr_len * 2 : 4096;
    *archive_data = (uint8_t *)malloc(cap);
    if (!*archive_data) {
        munbox_error("Out of memory");
        return false;
    }
    if (hdr_len) {
        memcpy(*archive_data, hdr, hdr_len);
    }
    size_t pos = hdr_len;
    for (;;) {
        ssize_t r = input->read(input, *archive_data + pos, cap - pos);
        if (r < 0) {
            free(*archive_data);
            *archive_data = NULL;
            return false;
        }
        if (r == 0)
            break;
        pos += (size_t)r;
        if (pos == cap) {
            size_t ncap = cap * 2;
            uint8_t *tmp = (uint8_t *)realloc(*archive_data, ncap);
            if (!tmp) {
                free(*archive_data);
                *archive_data = NULL;
                munbox_error("Out of memory");
                return false;
            }
            *archive_data = tmp;
            cap = ncap;
        }
    }
    *archive_size = pos;
    return true;
}

// Create a new classic SIT layer that scans the input for an embedded classic SIT archive and
// prepares the layer for open()/read() iteration (archive kept in memory).
munbox_layer_t *munbox_new_sit_layer(munbox_layer_t *input) {
    if (!input || !input->open)
        return NULL;

    uint8_t *archive_data = NULL;
    size_t archive_size = 0;
    uint8_t hdr14[14];
    size_t have = 0;

    munbox_file_info_t info;
    int rc = input->open(input, MUNBOX_OPEN_FIRST, &info);
    while (rc == 1) {
        if (sit_debug_enabled()) {
            fprintf(stderr, "[SIT] scanning fork: filename='%s' length=%lld\n", info.filename, (long long)info.length);
        }
        
        have = 0;
        size_t want14 = 14;
        if ((size_t)info.length > 0 && (size_t)info.length < want14)
            want14 = (size_t)info.length;
        
        ssize_t r;
        while (have < want14) {
            r = input->read(input, hdr14 + have, want14 - have);
            if (r <= 0) {
                if (sit_debug_enabled())
                    fprintf(stderr, "[SIT] read returned %zd while filling 14-byte header\n", r);
                break;
            }
            have += (size_t)r;
        }

        if (have >= 14) {
            const char *classic_magic[] = {"SIT!", "ST46", "ST50", "ST60", "ST65", "STin", "STi2", "STi3", "STi4"};
            for (int m = 0; m < 9; ++m) {
                if (memcmp(hdr14, classic_magic[m], 4) == 0 && memcmp(hdr14 + 10, "rLau", 4) == 0) {
                    if (sit_debug_enabled())
                        printf("Detected classic SIT format\n");
                    if (load_archive_from_input(input, &archive_data, &archive_size, hdr14, have)) {
                        goto found;
                    } else {
                        return NULL;
                    }
                }
            }
        }
        rc = input->open(input, MUNBOX_OPEN_NEXT, &info);
    }

    return NULL; // Not found

found:;
    munbox_layer_t *layer = malloc(sizeof(munbox_layer_t));
    sit_layer_state_t *state = calloc(1, sizeof(sit_layer_state_t));
    if (!layer || !state) {
        free(layer);
        free(state);
        free(archive_data);
        munbox_error("Out of memory");
        return NULL;
    }

    state->source = input;
    state->archive_data = archive_data;
    state->archive_size = archive_size;
    state->is_sit5 = false;
    
    if (archive_size >= 22) {
        state->format_state.classic.num_files = LOAD_BE16(archive_data + 4);
    }
    state->format_state.classic.current_offset = 22;
    state->format_state.classic.files_processed = 0;
    state->first_open_called = false;
    state->format_state.classic.folder_depth = 0;

    layer->internal_state = state;
    layer->read = NULL;
    layer->close = sit_layer_close;
    layer->open = sit_layer_open;
    return layer;
}


// Create a new SIT5 layer that scans the input for an embedded SIT5 archive and
// prepares the layer for sequential open()/read() iteration (archive kept in memory).
munbox_layer_t *munbox_new_sit5_layer(munbox_layer_t *input) {
    if (!input || !input->open)
        return NULL;

    uint8_t *archive_data = NULL;
    size_t archive_size = 0;
    uint8_t hdr80[80];
    size_t have = 0;

    munbox_file_info_t info;
    int rc = input->open(input, MUNBOX_OPEN_FIRST, &info);
    while (rc == 1) {
        printf("[SIT5] scanning fork: filename='%s' length=%lld\n", info.filename, (long long)info.length);
        
        have = 0;
        size_t want80 = 80;
        if ((size_t)info.length > 0 && (size_t)info.length < want80)
            want80 = (size_t)info.length;
        
        ssize_t r;
        while (have < want80) {
            r = input->read(input, hdr80 + have, want80 - have);
            if (r <= 0) {
                if (sit_debug_enabled())
                    fprintf(stderr, "[SIT5] read returned %zd while filling 80-byte header\n", r);
                break;
            }
            have += (size_t)r;
        }
        
        if (have >= 80) {
            if (memcmp(hdr80, "StuffIt (c)1997-", 16) == 0 && 
                memcmp(hdr80 + 20, " Aladdin Systems, Inc., http://www.aladdinsys.com/StuffIt/", 58) == 0) {
                printf("SIT5: Detected SIT5 format\n");
                if (load_archive_from_input(input, &archive_data, &archive_size, hdr80, have)) {
                    goto found;
                } else {
                    return NULL;
                }
            }
        }
        rc = input->open(input, MUNBOX_OPEN_NEXT, &info);
    }

    return NULL; // Not found

found:;
    munbox_layer_t *layer = malloc(sizeof(munbox_layer_t));
    sit_layer_state_t *state = calloc(1, sizeof(sit_layer_state_t));
    if (!layer || !state) {
        free(layer);
        free(state);
        free(archive_data);
        munbox_error("Out of memory");
        return NULL;
    }

    state->source = input;
    state->archive_data = archive_data;
    state->archive_size = archive_size;
    state->is_sit5 = true;

    layer->internal_state = state;
    layer->read = NULL;
    layer->close = sit_layer_close;
    layer->open = sit5_layer_open;
    return layer;
}



// --- Index building for open()/read iteration ---

// Build index entries for classic SIT archives by parsing per-file headers.
// --- Helper function to read next entry sequentially from classic SIT ---

// Read the next file entry sequentially from classic SIT archive
static int sit_read_next_entry(sit_layer_state_t *st) {
    // spike fix #3: num_files counts ROOT-level entries only. A folder is one root entry that
    // contains N sub-entries; the sub-entries must NOT count against the root budget, or we'd
    // exit after the first nested file. Stay in the loop while EITHER root work remains OR
    // we're inside a folder we haven't finished walking.
    if (st->format_state.classic.folder_depth == 0 &&
        st->format_state.classic.files_processed >= st->format_state.classic.num_files) {
        return 0; // No more files
    }

    uint8_t *data = st->archive_data;
    uint8_t *current = data + st->format_state.classic.current_offset;

    while (st->format_state.classic.folder_depth > 0 ||
           st->format_state.classic.files_processed < st->format_state.classic.num_files) {
        // Check if we have enough space for a header
        if ((size_t)(current - data) + 112 > st->archive_size) {
            // If we're at or near the end of the archive, this might be normal
            return 0; // No more files (end of archive)
        }

        uint8_t *header = current;
        uint8_t res_method = header[0];
        uint8_t data_method = header[1];

        // Folder start
        if (res_method == 32 || data_method == 32) {
            uint8_t name_len = header[2];
            if (st->format_state.classic.folder_depth < 10 && name_len < 64) {
                memcpy(st->format_state.classic.folder_stack[st->format_state.classic.folder_depth], header + 3, name_len);
                st->format_state.classic.folder_stack[st->format_state.classic.folder_depth][name_len] = '\0';
                st->format_state.classic.folder_depth++;
            }
            current = header + 112;
            st->format_state.classic.current_offset = current - data;
            continue; // spike fix: folder markers must NOT count against num_files (the real-file budget)
        }

        // Folder end
        if (res_method == 33 || data_method == 33) {
            if (st->format_state.classic.folder_depth > 0) {
                st->format_state.classic.folder_depth--;
                // spike fix #3: a root-level folder is ONE entry in num_files. When the root
                // folder closes (depth returns to 0), that entry is finished — count it.
                if (st->format_state.classic.folder_depth == 0) {
                    st->format_state.classic.files_processed++;
                }
            }
            current = header + 112;
            st->format_state.classic.current_offset = current - data;
            continue; // spike fix: folder markers themselves must NOT count (folder close handles it)
        }

        if ((res_method & 0xE0) || (data_method & 0xE0)) {
            // Skip unknown folder markers
            current = header + 112;
            st->format_state.classic.current_offset = current - data;
            continue; // spike fix: skipped markers must NOT count against num_files
        }

        // Regular file entry
        uint8_t name_len = header[2];
        char filename[128];
        if (name_len >= sizeof(filename)) {
            name_len = (uint8_t)(sizeof(filename) - 1);
        }
        memcpy(filename, header + 3, name_len);
        filename[name_len] = '\0';

        // Build the full relative path (folder1/folder2/filename)
        st->cur_info.filename[0] = '\0';
        if (st->format_state.classic.folder_depth > 0) {
            size_t pos = 0;
            for (int d = 0; d < st->format_state.classic.folder_depth; d++) {
                const char *seg = st->format_state.classic.folder_stack[d];
                size_t seglen = strlen(seg);
                if (pos + seglen + 1 >= sizeof(st->cur_info.filename)) { // +1 for '/' or '\0'
                    break; // truncate path safely
                }
                memcpy(st->cur_info.filename + pos, seg, seglen);
                pos += seglen;
                if (d < st->format_state.classic.folder_depth - 1) {
                    st->cur_info.filename[pos++] = '/';
                }
            }
            if (pos < sizeof(st->cur_info.filename) - 1) {
                st->cur_info.filename[pos++] = '/';
            }
            st->cur_info.filename[pos] = '\0';
        }
        
        // Append filename (always)
        if (filename[0]) {
            size_t cur = strlen(st->cur_info.filename);
            size_t remain = sizeof(st->cur_info.filename) - 1 - cur;
            if (remain > 0) {
                size_t flen = strnlen(filename, remain);
                memcpy(st->cur_info.filename + cur, filename, flen);
                st->cur_info.filename[cur + flen] = '\0';
            }
        }

        // Extract file metadata
        uint32_t rsrc_len = LOAD_BE32(header + 84);
        uint32_t data_len = LOAD_BE32(header + 88);
        uint32_t rsrc_comp_len = LOAD_BE32(header + 92);
        uint32_t data_comp_len = LOAD_BE32(header + 96);
        uint16_t rsrc_crc = LOAD_BE16(header + 100);
        uint16_t data_crc = LOAD_BE16(header + 102);
        
        st->cur_info.type = LOAD_BE32(header + 66);
        st->cur_info.creator = LOAD_BE32(header + 70);
        st->cur_info.finder_flags = LOAD_BE16(header + 74);
        st->cur_info.has_metadata = true;

        uint8_t *comp_rsrc = header + 112;
        uint8_t *comp_data = comp_rsrc + rsrc_comp_len;
        
        // Verify data doesn't exceed archive bounds
        if ((size_t)(comp_data - data) + data_comp_len > st->archive_size) {
            return -1; // Error: data fork out of range
        }

        // Fill fork descriptors
        st->rsrc_fork.uncomp_len = rsrc_len;
        st->rsrc_fork.comp_len = rsrc_comp_len;
        st->rsrc_fork.crc = rsrc_crc;
        st->rsrc_fork.method = res_method & 0x0F;
        st->rsrc_fork.comp_ptr = comp_rsrc;
        
        st->data_fork.uncomp_len = data_len;
        st->data_fork.comp_len = data_comp_len;
        st->data_fork.crc = data_crc;
        st->data_fork.method = data_method & 0x0F;
        st->data_fork.comp_ptr = comp_data;
        
        st->has_rsrc_fork = (rsrc_len > 0);

        // Update position for next call
        current = comp_data + data_comp_len;
        st->format_state.classic.current_offset = current - data;
        // spike fix #3: only ROOT-level files count toward num_files. Files nested inside a
        // folder are sub-entries of the folder (which is the root entry counted at folder-close).
        if (st->format_state.classic.folder_depth == 0) {
            st->format_state.classic.files_processed++;
        }

        return 1; // Found a file
    }
    
    return 0; // No more files
}

// --- LZW (method 2) streaming implementation ---

// Dictionary node used by the LZW streaming decompressor.
typedef struct dict_node {
    uint16_t parent;
    uint16_t length;
    uint8_t character;
    uint8_t root;
} dict_node_t;

// LZW streaming context for method 2 decompression (state, dictionary, buffers).
typedef struct lzw_ctx {
    const uint8_t *src;
    size_t src_len;
    size_t bit_offset;
    int symbol_size;
    int dict_size;
    int last_symbol; // -1 invalid
    int num_symbols_in_block;
    dict_node_t dict[1 << 14];
    uint8_t out_buf[1 << 14];
    size_t out_pos;
    size_t out_len;
} lzw_ctx;

// Initialize LZW streaming context and base dictionary for method 2.
static lzw_ctx *lzw_init(const uint8_t *src, size_t src_len) {
    lzw_ctx *c = (lzw_ctx *)calloc(1, sizeof(lzw_ctx));
    if (!c)
        return NULL;
    c->src = src;
    c->src_len = src_len;
    c->bit_offset = 0;
    c->symbol_size = 9;
    c->dict_size = 257;
    c->last_symbol = -1;
    c->num_symbols_in_block = 0;
    for (int i = 0; i < 256; i++) {
        c->dict[i].character = (uint8_t)i;
        c->dict[i].parent = UINT16_MAX;
        c->dict[i].root = (uint8_t)i;
        c->dict[i].length = 1;
    }
    return c;
}

// Peek up to 4 bytes safely from the source buffer at an offset.
// Used to fetch a small window for bit-aligned symbol extraction.
static inline uint32_t lzw_peek_u32(const uint8_t *p, size_t len, size_t off_bytes) {
    uint32_t v = 0;
    if (off_bytes < len) {
        size_t rem = len - off_bytes;
        if (rem > 4)
            rem = 4;
        memcpy(&v, p + off_bytes, rem);
    }
    return v;
}

// Read the next symbol from the bitstream using the current symbol size.
// Returns -1 on end-of-input or the symbol value.
static int lzw_read_symbol(lzw_ctx *c) {
    if ((c->bit_offset >> 3) >= c->src_len)
        return -1;
    uint32_t bits = lzw_peek_u32(c->src, c->src_len, c->bit_offset >> 3);
    int mask = (1 << c->symbol_size) - 1;
    int sym = (int)((bits >> (c->bit_offset & 7)) & (uint32_t)mask);
    c->bit_offset += (size_t)c->symbol_size;
    c->num_symbols_in_block++;
    return sym;
}

// Expand a dictionary string identified by `symbol` into the LZW output buffer.
// Writes the expanded bytes into the internal output buffer for later reads.
static void lzw_output_string(lzw_ctx *c, int symbol) {
    size_t len = c->dict[symbol].length;
    if (len > sizeof(c->out_buf))
        len = sizeof(c->out_buf);
    size_t pos = len;
    int cur = symbol;
    while (cur != (int)UINT16_MAX && pos > 0) {
        c->out_buf[--pos] = c->dict[cur].character;
        cur = c->dict[cur].parent;
    }
    memmove(c->out_buf, c->out_buf + pos, len - pos);
    c->out_len = len - pos;
    c->out_pos = 0;
}

// Produce up to `cap` decompressed bytes from the LZW context into `out`.
// Returns number of bytes written or 0 on EOF.
static ssize_t lzw_read(lzw_ctx *c, uint8_t *out, size_t cap) {
    size_t produced = 0;
    while (produced < cap) {
        if (c->out_pos < c->out_len) {
            size_t n = c->out_len - c->out_pos;
            if (n > cap - produced)
                n = cap - produced;
            memcpy(out + produced, c->out_buf + c->out_pos, n);
            c->out_pos += n;
            produced += n;
            continue;
        }
        int sym = lzw_read_symbol(c);
        if (sym < 0)
            break;
        if (sym == 256) {
            if (c->num_symbols_in_block & 7) {
                c->bit_offset += (size_t)(c->symbol_size * (8 - (c->num_symbols_in_block & 7)));
            }
            c->dict_size = 257;
            c->last_symbol = -1;
            c->symbol_size = 9;
            c->num_symbols_in_block = 0;
            continue;
        }
        if (c->last_symbol < 0) {
            if (sym < 256)
                out[produced++] = (uint8_t)sym;
            c->last_symbol = sym;
            continue;
        }
        uint8_t new_char = (sym < c->dict_size) ? c->dict[c->dict[sym].root].character
                                                : c->dict[c->dict[c->last_symbol].root].character;
        if (c->dict_size < (int)(sizeof(c->dict) / sizeof(c->dict[0]))) {
            c->dict[c->dict_size].parent = (uint16_t)c->last_symbol;
            c->dict[c->dict_size].length = c->dict[c->last_symbol].length + 1;
            c->dict[c->dict_size].character = new_char;
            c->dict[c->dict_size].root = c->dict[c->last_symbol].root;
            c->dict_size++;
            if (c->dict_size < (int)(sizeof(c->dict) / sizeof(c->dict[0])) &&
                (c->dict_size & (c->dict_size - 1)) == 0 && c->symbol_size < 14) {
                c->symbol_size++;
            }
        }
        if (sym < c->dict_size) {
            lzw_output_string(c, sym);
        } else {
            // Special KwKwK case: output last string + new_char
            size_t len = (size_t)c->dict[c->last_symbol].length + 1;
            if (len > sizeof(c->out_buf))
                len = sizeof(c->out_buf);
            size_t pos = len;
            c->out_buf[--pos] = new_char;
            int cur = c->last_symbol;
            while (cur != (int)UINT16_MAX && pos > 0) {
                c->out_buf[--pos] = c->dict[cur].character;
                cur = c->dict[cur].parent;
            }
            memmove(c->out_buf, c->out_buf + pos, len - pos);
            c->out_len = len - pos;
            c->out_pos = 0;
        }
        c->last_symbol = sym;
    }
    return (ssize_t)produced;
}

// Free an LZW streaming context and its resources.
static void lzw_free(lzw_ctx *c) { free(c); }

// Fill `dst` with up to `cap` decompressed bytes from the given streaming state.
// Supports raw copy, RLE90, LZW, SIT13 and SIT15 streaming kinds.
static ssize_t sit_stream_fill(sit_stream_state_t *ss, uint8_t *dst, size_t cap, sit15_ctx_t *sit15_ctx) {
    size_t produced = 0;
    if (ss->out_rem == 0)
        return 0;
    while (produced < cap && ss->out_rem > 0) {
        if (ss->kind == STRM_COPY) {
            size_t n = ss->src_len - ss->src_pos;
            if (n > ss->out_rem)
                n = ss->out_rem;
            if (n > cap - produced)
                n = cap - produced;
            memcpy(dst + produced, ss->src + ss->src_pos, n);
            ss->src_pos += n;
            ss->out_rem -= n;
            produced += n;
            if (!ss->skip_crc)
                ss->crc_accum = sit_crc_update(ss->crc_accum, dst + produced - n, n);
        } else if (ss->kind == STRM_RLE90) {
            // produce one byte at a time to honor rep counts
            if (ss->rep_rem > 0) {
                dst[produced++] = ss->last_byte;
                ss->rep_rem--;
                ss->out_rem--;
                if (!ss->skip_crc)
                    ss->crc_accum = sit_crc_update(ss->crc_accum, &dst[produced - 1], 1);
                continue;
            }
            if (ss->src_pos >= ss->src_len)
                break; // input exhausted unexpectedly
            uint8_t b = ss->src[ss->src_pos++];
            if (b == 0x90) {
                if (ss->src_pos >= ss->src_len)
                    break;
                uint8_t n = ss->src[ss->src_pos++];
                if (n == 0x00) {
                    // Literal 0x90; do NOT update last_byte (matches one-shot behavior)
                    dst[produced++] = 0x90;
                    ss->out_rem--;
                    if (!ss->skip_crc)
                        ss->crc_accum = sit_crc_update(ss->crc_accum, &dst[produced - 1], 1);
                } else {
                    if (n > 1) {
                        ss->rep_rem = (size_t)n - 1; // emit last_byte rep_rem times
                    } else {
                        // n==1 means repeat last byte zero times; nothing to do
                    }
                }
            } else {
                dst[produced++] = b;
                ss->last_byte = b;
                ss->out_rem--;
                if (!ss->skip_crc)
                    ss->crc_accum = sit_crc_update(ss->crc_accum, &dst[produced - 1], 1);
            }
        } else if (ss->kind == STRM_SIT15) {
            size_t want = ss->out_rem < (cap - produced) ? ss->out_rem : (cap - produced);
            ssize_t n = sit15_read(sit15_ctx, dst + produced, want);
            if (n < 0)
                return MUNBOX_ERROR;
            if (n == 0)
                break;
            if (!ss->skip_crc)
                ss->crc_accum = sit_crc_update(ss->crc_accum, dst + produced, (size_t)n);
            produced += (size_t)n;
            ss->out_rem -= (size_t)n;
        } else if (ss->kind == STRM_LZW) {
            size_t want = ss->out_rem < (cap - produced) ? ss->out_rem : (cap - produced);
            if (!ss->lzw)
                return MUNBOX_ERROR;
            ssize_t n = lzw_read(ss->lzw, dst + produced, want);
            if (n < 0)
                return MUNBOX_ERROR;
            if (n == 0)
                break;
            if (!ss->skip_crc)
                ss->crc_accum = sit_crc_update(ss->crc_accum, dst + produced, (size_t)n);
            produced += (size_t)n;
            ss->out_rem -= (size_t)n;
        } else if (ss->kind == STRM_SIT13) {
            size_t want = ss->out_rem < (cap - produced) ? ss->out_rem : (cap - produced);
            if (!ss->sit13)
                return MUNBOX_ERROR;
            ssize_t n = sit13_read(ss->sit13, dst + produced, want);
            if (n < 0)
                return MUNBOX_ERROR;
            if (n == 0)
                break;
            if (!ss->skip_crc)
                ss->crc_accum = sit_crc_update(ss->crc_accum, dst + produced, (size_t)n);
            produced += (size_t)n;
            ss->out_rem -= (size_t)n;
        } else {
            return MUNBOX_ERROR;
        }
    }
    return (ssize_t)produced;
}

// Read uncompressed bytes from the currently opened SIT fork into `buf`.
// Delegates to sit_stream_fill and performs CRC check after EOF of fork.
static ssize_t sit_layer_read(munbox_layer_t *self, void *buf, size_t cnt) {
    sit_layer_state_t *st = (sit_layer_state_t *)self->internal_state;
    if (!st)
        return MUNBOX_ERROR;
    if (!st->opened)
        return munbox_error("read() called before open() on sit layer");
    // Streaming path
    ssize_t n = sit_stream_fill(&st->stream, (uint8_t *)buf, cnt, st->sit15_ctx);
    if (st->stream.out_rem == 0) {
        // verify CRC if applicable
        if (!st->stream.skip_crc) {
            if (st->stream.crc_accum != st->expected_crc) {
                if (sit_debug_enabled()) {
                    fprintf(stderr, "[SIT] CRC mismatch: expected=%04x computed=%04x (file='%s', fork=%s)\n",
                            (unsigned)st->expected_crc, (unsigned)st->stream.crc_accum, st->cur_info.filename,
                            st->cur_info.fork_type == (int)MUNBOX_FORK_RESOURCE ? "rsrc" : "data");
                }
                return munbox_error("SIT fork CRC mismatch");
            }
        }
    }
    return n;
}

// Open (or advance) the current file/fork in the SIT archive and return file info.
// Prepares per-fork streaming contexts and fills `info` with metadata.
static int sit_layer_open(munbox_layer_t *self, munbox_open_t what, munbox_file_info_t *info) {
    sit_layer_state_t *st = (sit_layer_state_t *)self->internal_state;
    if (!st || !info)
        return munbox_error("Invalid parameters to sit_layer_open");

    st->opened = true;
    
    if (what == MUNBOX_OPEN_FIRST) {
        // Reset sequential reading state
        st->format_state.classic.current_offset = 22; // Start right after archive header
        st->format_state.classic.files_processed = 0;
        st->format_state.classic.folder_depth = 0;
        st->iter_fork = 0; // start with data fork
        st->first_open_called = true;
        self->read = sit_layer_read;
    } else if (!st->first_open_called) {
        return munbox_error("Must call MUNBOX_OPEN_FIRST before MUNBOX_OPEN_NEXT");
    } else {
        // Advance to next fork/file
        if (st->iter_fork == 0 && st->has_rsrc_fork) {
            st->iter_fork = 1; // Move to resource fork
        } else {
            st->iter_fork = 0; // Move to next file's data fork
            // The next call to sit_read_next_entry will advance to the next file
        }
    }

    // Find the next file/fork to read
    while (true) {
        // If we're looking for a data fork or starting a new file
        if (st->iter_fork == 0) {
            int result = sit_read_next_entry(st);
            if (result == 0) {
                return 0; // No more files
            }
            if (result < 0) {
                return result; // Error
            }
        }
        
        // Determine which fork we're working with
        sit_fork_desc_t *fd = (st->iter_fork == 0) ? &st->data_fork : &st->rsrc_fork;
        
        // Skip empty forks
        if (fd->uncomp_len == 0) {
            if (st->iter_fork == 0 && st->has_rsrc_fork) {
                st->iter_fork = 1; // Try resource fork
                continue;
            } else {
                // This file has no usable forks, move to next file
                st->iter_fork = 0; // This will trigger sit_read_next_entry on next iteration
                continue;
            }
        }
        
        // Found a valid fork to read
        break;
    }

    // Reset any previous streaming state/buffer
    if (st->sit15_ctx) {
        sit15_free(st->sit15_ctx);
        st->sit15_ctx = NULL;
    }
    if (st->sit13_ctx) {
        sit13_free(st->sit13_ctx);
        st->sit13_ctx = NULL;
    }
    if (st->lzw_ctx) {
        lzw_free(st->lzw_ctx);
        st->lzw_ctx = NULL;
    }
    st->cur_stream_kind = STRM_NONE;

    sit_fork_desc_t *fd = (st->iter_fork == 0) ? &st->data_fork : &st->rsrc_fork;
    
    // Initialize streaming for this fork
    st->stream.src = fd->comp_ptr;
    st->stream.src_len = fd->comp_len;
    st->stream.src_pos = 0;
    st->stream.out_rem = fd->uncomp_len;
    st->stream.skip_crc = false;
    st->expected_crc = fd->crc;
    st->stream.crc_accum = 0; // SIT CRC starts from 0
    st->stream.last_byte = 0;
    st->stream.rep_rem = 0;
    
    if (sit_debug_enabled()) {
        fprintf(stderr, "[SIT] fork open: file='%s' fork=%s method=%u comp=%u uncomp=%u crc=%04x\n", 
                st->cur_info.filename,
                (st->iter_fork == 0) ? "data" : "rsrc", (unsigned)fd->method, (unsigned)fd->comp_len,
                (unsigned)fd->uncomp_len, (unsigned)fd->crc);
    }
    
    if (fd->method == 0) {
        st->cur_stream_kind = STRM_COPY;
        st->stream.kind = STRM_COPY;
    } else if (fd->method == 1) {
        st->cur_stream_kind = STRM_RLE90;
        st->stream.kind = STRM_RLE90;
    } else if (fd->method == 2) {
        // Initialize LZW streaming
        st->lzw_ctx = lzw_init(fd->comp_ptr, fd->comp_len);
        if (!st->lzw_ctx)
            return munbox_error("Out of memory");
        st->stream.lzw = st->lzw_ctx;
        st->cur_stream_kind = STRM_LZW;
        st->stream.kind = STRM_LZW;
    } else if (fd->method == 13) {
        st->sit13_ctx = sit13_init(fd->comp_ptr, fd->comp_len);
        if (!st->sit13_ctx)
            return munbox_error("SIT13 init failed");
        st->stream.sit13 = st->sit13_ctx;
        st->cur_stream_kind = STRM_SIT13;
        st->stream.kind = STRM_SIT13;
    } else if (fd->method == 15) {
        st->sit15_ctx = sit15_init(fd->comp_ptr, fd->comp_len);
        if (!st->sit15_ctx)
            return munbox_error("SIT15 init failed");
        st->cur_stream_kind = STRM_SIT15;
        st->stream.kind = STRM_SIT15;
        st->stream.skip_crc = true; // method 15 CRC validated internally
    } else {
        return munbox_error("Unsupported SIT compression method: %d", fd->method);
    }

    // Set up the file info to return
    st->cur_info.length = fd->uncomp_len;
    st->cur_info.fork_type = (st->iter_fork == 0) ? MUNBOX_FORK_DATA : MUNBOX_FORK_RESOURCE;
    *info = st->cur_info;
    return 1;
}



// Helper function to read a single SIT5 entry header at the current cursor position
// Returns: 1 = file entry read, 0 = end of entries, -1 = error
// Populates the current file info and fork descriptors in the state
static int sit5_read_next_entry(sit_layer_state_t *st) {
    if (st->format_state.sit5.entries_remaining == 0 || st->format_state.sit5.current_cursor == 0 || st->format_state.sit5.current_cursor >= st->archive_size) {
        return 0; // end of entries
    }

    uint8_t *data = st->archive_data;
    uint32_t offs = st->format_state.sit5.current_cursor;
    uint8_t *header1 = data + offs;
    
    // Validate header1
    if (offs + 48 > st->archive_size)
        return munbox_error("SIT5: header1 out of range");
    if (LOAD_BE32(header1) != 0xa5a5a5a5)
        return munbox_error("SIT5: invalid entry magic");
    if (header1[4] != 1)
        return munbox_error("SIT5: unsupported entry version");
    
    uint16_t header1_len = LOAD_BE16(header1 + 6);
    if (offs + header1_len > st->archive_size)
        return munbox_error("SIT5: header1 length out of range");
    
    // Verify header CRC
    uint8_t *tmp = malloc(header1_len);
    if (!tmp)
        return munbox_error("Out of memory");
    memcpy(tmp, header1, header1_len);
    tmp[32] = tmp[33] = 0;
    if (sit_crc(tmp, header1_len) != LOAD_BE16(header1 + 32)) {
        free(tmp);
        return munbox_error("SIT5 header CRC mismatch");
    }
    free(tmp);

    uint32_t header_end = offs + header1_len;
    uint8_t flags = header1[9];
    uint32_t parent_offset = LOAD_BE32(header1 + 26);
    uint16_t namelen = LOAD_BE16(header1 + 30);
    uint32_t datalength = LOAD_BE32(header1 + 34);
    uint32_t datacomplen = LOAD_BE32(header1 + 38);
    uint16_t datacrc = LOAD_BE16(header1 + 42);
    
    // Extract name
    char namebuf[256];
    size_t cpylen = namelen < sizeof(namebuf) - 1 ? namelen : sizeof(namebuf) - 1;
    memcpy(namebuf, header1 + 48, cpylen);
    namebuf[cpylen] = '\0';

    // Read header2
    if (header_end + 32 > st->archive_size)
        return munbox_error("SIT5: header2 out of range");
    uint8_t *header2 = data + header_end;
    uint16_t flags2 = LOAD_BE16(header2 + 0);
    uint32_t filetype = LOAD_BE32(header2 + 4);
    uint32_t filecreator = LOAD_BE32(header2 + 8);
    uint16_t finderflags = LOAD_BE16(header2 + 12);
    
    uint32_t second_block_skip = (header1[4] == 1) ? 22 : 18;
    bool hasresource = (flags2 & 0x01) != 0;
    uint8_t *second_block_after_prefix = header2 + 14 + second_block_skip;
    uint8_t *datastart_ptr = second_block_after_prefix;
    
    // Resource fork info
    uint32_t resourcelength = 0, resourcecomplen = 0;
    uint16_t resourcecrc = 0;
    uint8_t resourcemethod = 0;
    if (hasresource) {
        if ((size_t)(second_block_after_prefix - data) + 14 > st->archive_size)
            return munbox_error("SIT5: resource info out of range");
        resourcelength = LOAD_BE32(second_block_after_prefix + 0);
        resourcecomplen = LOAD_BE32(second_block_after_prefix + 4);
        resourcecrc = LOAD_BE16(second_block_after_prefix + 8);
        resourcemethod = *(second_block_after_prefix + 12);
        uint8_t res_passlen = *(second_block_after_prefix + 13);
        datastart_ptr = second_block_after_prefix + 14 + res_passlen;
    }

    // Handle folders
    if (flags & 0x40) {
        uint16_t numfiles = LOAD_BE16(header1 + 46);
        
        if (datalength == 0xffffffff) {
            // Special folder marker - skip
            st->format_state.sit5.entries_remaining++;
            st->format_state.sit5.current_cursor = header_end;
            return sit5_read_next_entry(st); // recursively try next entry
        }
        
        // Regular folder - update directory stack
        char parent_path[512] = "";
        
        // Build parent path by finding the parent folder in our stack
        if (parent_offset != 0) {
            for (int i = 0; i < st->format_state.sit5.dir_stack_depth; i++) {
                if (st->format_state.sit5.dir_stack[i].offset == parent_offset) {
                    strncpy(parent_path, st->format_state.sit5.dir_stack[i].path, sizeof(parent_path) - 1);
                    parent_path[sizeof(parent_path) - 1] = '\0';
                    break;
                }
            }
        }
        
        // Create full folder path
        char folder_path[512];
        sit_join_path(folder_path, sizeof(folder_path), parent_path, namebuf);
        
        // Push this folder onto the stack
        if (st->format_state.sit5.dir_stack_depth < 32) {
            st->format_state.sit5.dir_stack[st->format_state.sit5.dir_stack_depth].offset = offs;
            st->format_state.sit5.dir_stack[st->format_state.sit5.dir_stack_depth].parent_offset = parent_offset;
            strncpy(st->format_state.sit5.dir_stack[st->format_state.sit5.dir_stack_depth].path, folder_path, 
                   sizeof(st->format_state.sit5.dir_stack[st->format_state.sit5.dir_stack_depth].path) - 1);
            st->format_state.sit5.dir_stack[st->format_state.sit5.dir_stack_depth].path[sizeof(st->format_state.sit5.dir_stack[st->format_state.sit5.dir_stack_depth].path) - 1] = '\0';
            printf("SIT5: created folder '%s'\n", st->format_state.sit5.dir_stack[st->format_state.sit5.dir_stack_depth].path);
            st->format_state.sit5.dir_stack_depth++;
        }
        
        st->format_state.sit5.entries_remaining += numfiles;
        st->format_state.sit5.current_cursor = (uint32_t)(datastart_ptr - data);
        return sit5_read_next_entry(st); // recursively try next entry
    }

    // Handle special markers
    if (datalength == 0xffffffff) {
        st->format_state.sit5.current_cursor = header_end;
        return sit5_read_next_entry(st); // recursively try next entry
    }

    // Regular file entry
    uint8_t datamethod = header1[46];
    uint8_t data_passlen = header1[47];
    if ((flags & 0x20) && datalength && data_passlen) {
        return munbox_error("SIT5 encrypted entries are not supported");
    }

    // Build full file path by finding parent folder in directory stack
    char parent_path[512] = "";
    
    if (parent_offset != 0) {
        for (int i = 0; i < st->format_state.sit5.dir_stack_depth; i++) {
            if (st->format_state.sit5.dir_stack[i].offset == parent_offset) {
                strncpy(parent_path, st->format_state.sit5.dir_stack[i].path, sizeof(parent_path) - 1);
                parent_path[sizeof(parent_path) - 1] = '\0';
                break;
            }
        }
    }
    
    char full_filename[512];
    sit_join_path(full_filename, sizeof(full_filename), parent_path, namebuf);

    // Verify fork data is within archive bounds
    uint8_t *comp_rsrc = datastart_ptr;
    uint8_t *comp_data = datastart_ptr + (hasresource ? resourcecomplen : 0);
    if ((size_t)(comp_data - data) + datacomplen > st->archive_size)
        return munbox_error("SIT5: data fork out of range");

    // Populate state with current file info
    memset(&st->cur_info, 0, sizeof(st->cur_info));
    strncpy(st->cur_info.filename, full_filename, sizeof(st->cur_info.filename) - 1);
    st->cur_info.type = filetype;
    st->cur_info.creator = filecreator;
    st->cur_info.finder_flags = finderflags;
    st->cur_info.has_metadata = true;

    // Setup fork descriptors
    st->has_rsrc_fork = hasresource;
    if (hasresource) {
        st->rsrc_fork.uncomp_len = resourcelength;
        st->rsrc_fork.comp_len = resourcecomplen;
        st->rsrc_fork.crc = resourcecrc;
        st->rsrc_fork.method = resourcemethod & 0x0F;
        st->rsrc_fork.comp_ptr = comp_rsrc;
    }
    st->data_fork.uncomp_len = datalength;
    st->data_fork.comp_len = datacomplen;
    st->data_fork.crc = datacrc;
    st->data_fork.method = datamethod & 0x0F;
    st->data_fork.comp_ptr = comp_data;

    // Advance cursor to next entry
    st->format_state.sit5.current_cursor = (uint32_t)((comp_data - data) + datacomplen);
    st->format_state.sit5.entries_remaining--;

    printf("SIT5: created file '%s'\n", full_filename);
    return 1; // Successfully read file entry
}

static int sit5_layer_open(munbox_layer_t *self, munbox_open_t what, munbox_file_info_t *info) {
    sit_layer_state_t *st = (sit_layer_state_t *)self->internal_state;
    if (!st || !info)
        return munbox_error("Invalid parameters to sit5_layer_open");

    // Initialize sequential reading state on first use
    if (!st->first_open_called) {
        uint8_t *data = st->archive_data;
        if (st->archive_size < 100)
            return munbox_error("SIT5: archive too small");
        
        st->format_state.sit5.entries_remaining = LOAD_BE16(data + 92);
        st->format_state.sit5.initial_cursor = LOAD_BE32(data + 94);
        st->format_state.sit5.current_cursor = st->format_state.sit5.initial_cursor;
        st->format_state.sit5.dir_stack_depth = 0;
        st->first_open_called = true;
        self->read = sit_layer_read;
    }

    st->opened = true;
    
    if (what == MUNBOX_OPEN_FIRST) {
        // Reset to beginning of archive
        st->format_state.sit5.current_cursor = st->format_state.sit5.initial_cursor;
        st->format_state.sit5.entries_remaining = LOAD_BE16(st->archive_data + 92);
        st->format_state.sit5.dir_stack_depth = 0;
        st->iter_fork = 0; // start with data fork
        
        // Read the first file entry
        int result = sit5_read_next_entry(st);
        if (result <= 0)
            return result;
    } else {
        // MUNBOX_OPEN_NEXT - advance to next fork or next file
        if (st->iter_fork == 0 && st->has_rsrc_fork && st->rsrc_fork.uncomp_len > 0) {
            // Switch to resource fork of current file
            st->iter_fork = 1;
        } else {
            // Move to data fork of next file
            st->iter_fork = 0;
            int result = sit5_read_next_entry(st);
            if (result <= 0)
                return result;
        }
    }

    // Skip empty forks
    while (true) {
        sit_fork_desc_t *fd = (st->iter_fork == 0) ? &st->data_fork : &st->rsrc_fork;
        if (fd->uncomp_len > 0)
            break; // Found a non-empty fork
            
        // Skip to next fork/file
        if (st->iter_fork == 0 && st->has_rsrc_fork && st->rsrc_fork.uncomp_len > 0) {
            st->iter_fork = 1; // try resource fork
            continue;
        } else {
            // Move to next file
            st->iter_fork = 0;
            int result = sit5_read_next_entry(st);
            if (result <= 0)
                return result;
        }
    }

    // Reset any previous streaming state/buffer
    if (st->sit15_ctx) {
        sit15_free(st->sit15_ctx);
        st->sit15_ctx = NULL;
    }
    if (st->sit13_ctx) {
        sit13_free(st->sit13_ctx);
        st->sit13_ctx = NULL;
    }
    if (st->lzw_ctx) {
        lzw_free(st->lzw_ctx);
        st->lzw_ctx = NULL;
    }
    st->cur_stream_kind = STRM_NONE;
    
    sit_fork_desc_t *fd = (st->iter_fork == 0) ? &st->data_fork : &st->rsrc_fork;
    if (fd->uncomp_len > 0) {
        // Setup streaming for the current fork
        st->stream.src = fd->comp_ptr;
        st->stream.src_len = fd->comp_len;
        st->stream.src_pos = 0;
        st->stream.out_rem = fd->uncomp_len;
        st->stream.skip_crc = false;
        st->expected_crc = fd->crc;
        st->stream.crc_accum = 0; // SIT CRC starts from 0
        st->stream.last_byte = 0;
        st->stream.rep_rem = 0;
        
        if (sit_debug_enabled()) {
            fprintf(stderr, "[SIT5] fork open: file='%s' fork=%s method=%u comp=%u uncomp=%u crc=%04x\n", 
                    st->cur_info.filename,
                    (st->iter_fork == 0) ? "data" : "rsrc", (unsigned)fd->method, (unsigned)fd->comp_len,
                    (unsigned)fd->uncomp_len, (unsigned)fd->crc);
        }
        
        if (fd->method == 0) {
            st->cur_stream_kind = STRM_COPY;
            st->stream.kind = STRM_COPY;
        } else if (fd->method == 1) {
            st->cur_stream_kind = STRM_RLE90;
            st->stream.kind = STRM_RLE90;
        } else if (fd->method == 2) {
            // Initialize LZW streaming
            st->lzw_ctx = lzw_init(fd->comp_ptr, fd->comp_len);
            if (!st->lzw_ctx)
                return munbox_error("Out of memory");
            st->stream.lzw = st->lzw_ctx;
            st->cur_stream_kind = STRM_LZW;
            st->stream.kind = STRM_LZW;
        } else if (fd->method == 13) {
            st->sit13_ctx = sit13_init(fd->comp_ptr, fd->comp_len);
            if (!st->sit13_ctx)
                return munbox_error("SIT13 init failed");
            st->stream.sit13 = st->sit13_ctx;
            st->cur_stream_kind = STRM_SIT13;
            st->stream.kind = STRM_SIT13;
        } else if (fd->method == 15) {
            st->sit15_ctx = sit15_init(fd->comp_ptr, fd->comp_len);
            if (!st->sit15_ctx)
                return munbox_error("SIT15 init failed");
            st->cur_stream_kind = STRM_SIT15;
            st->stream.kind = STRM_SIT15;
            st->stream.skip_crc = true; // method 15 CRC validated internally
        } else {
            return munbox_error("Unsupported SIT compression method: %d", fd->method);
        }
    }

    // Setup info to return to caller
    st->cur_info.length = fd->uncomp_len;
    st->cur_info.fork_type = (st->iter_fork == 0) ? MUNBOX_FORK_DATA : MUNBOX_FORK_RESOURCE;
    printf("SIT5: open file '%s' fork %s method %u\n", st->cur_info.filename,
           (st->iter_fork == 0) ? "data" : "rsrc", (unsigned)fd->method);
    *info = st->cur_info;
    return 1;
}