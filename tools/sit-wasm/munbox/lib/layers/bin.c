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

// bin.c
// MacBinary II/II+ (.bin) format decoder layer implementation.

#include <ctype.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "munbox.h"
#include "munbox_internal.h"

#define MB_BLOCK_SIZE 128

// Forward declaration for helpers used before their definitions

// Skip and discard 'n' bytes from 'src' (forward declaration)
static int skip_bytes(munbox_layer_t *src, size_t n);
static int read_fully(munbox_layer_t *src, uint8_t *buf, size_t n); // forward
static uint16_t be16(const uint8_t *p); // forward
static uint32_t be32(const uint8_t *p); // forward

// Detect if a buffer appears to be a StuffIt archive (classic or SIT5)
static bool looks_like_sit(const uint8_t *buf, size_t len) {
    if (len >= 80) {
        if (memcmp(buf, "StuffIt (c)1997-", 16) == 0 &&
            memcmp(buf + 20, " Aladdin Systems, Inc., http://www.aladdinsys.com/StuffIt/", 58) == 0) {
            return true; // SIT5
        }
    }
    if (len >= 14) {
        const char *magic1[] = {"SIT!", "ST46", "ST50", "ST60", "ST65", "STin", "STi2", "STi3", "STi4"};
        for (int i = 0; i < 9; i++) {
            if (memcmp(buf, magic1[i], 4) == 0 && memcmp(buf + 10, "rLau", 4) == 0) {
                return true; // Classic SIT
            }
        }
    }
    return false;
}

// CRC-16/XMODEM (a.k.a. CCITT-FALSE): poly 0x1021, init 0x0000, no reflect, xorout 0x0000
static uint16_t crc16_xmodem_update(uint16_t crc, const uint8_t *data, size_t len) {
    static const uint16_t table[256] = {
        0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50A5, 0x60C6, 0x70E7, 0x8108, 0x9129, 0xA14A, 0xB16B, 0xC18C, 0xD1AD,
        0xE1CE, 0xF1EF, 0x1231, 0x0210, 0x3273, 0x2252, 0x52B5, 0x4294, 0x72F7, 0x62D6, 0x9339, 0x8318, 0xB37B, 0xA35A,
        0xD3BD, 0xC39C, 0xF3FF, 0xE3DE, 0x2462, 0x3443, 0x0420, 0x1401, 0x64E6, 0x74C7, 0x44A4, 0x5485, 0xA56A, 0xB54B,
        0x8528, 0x9509, 0xE5EE, 0xF5CF, 0xC5AC, 0xD58D, 0x3653, 0x2672, 0x1611, 0x0630, 0x76D7, 0x66F6, 0x5695, 0x46B4,
        0xB75B, 0xA77A, 0x9719, 0x8738, 0xF7DF, 0xE7FE, 0xD79D, 0xC7BC, 0x48C4, 0x58E5, 0x6886, 0x78A7, 0x0840, 0x1861,
        0x2802, 0x3823, 0xC9CC, 0xD9ED, 0xE98E, 0xF9AF, 0x8948, 0x9969, 0xA90A, 0xB92B, 0x5AF5, 0x4AD4, 0x7AB7, 0x6A96,
        0x1A71, 0x0A50, 0x3A33, 0x2A12, 0xDBFD, 0xCBDC, 0xFBBF, 0xEB9E, 0x9B79, 0x8B58, 0xBB3B, 0xAB1A, 0x6CA6, 0x7C87,
        0x4CE4, 0x5CC5, 0x2C22, 0x3C03, 0x0C60, 0x1C41, 0xEDAE, 0xFD8F, 0xCDEC, 0xDDCD, 0xAD2A, 0xBD0B, 0x8D68, 0x9D49,
        0x7E97, 0x6EB6, 0x5ED5, 0x4EF4, 0x3E13, 0x2E32, 0x1E51, 0x0E70, 0xFF9F, 0xEFBE, 0xDFDD, 0xCFFC, 0xBF1B, 0xAF3A,
        0x9F59, 0x8F78, 0x9188, 0x81A9, 0xB1CA, 0xA1EB, 0xD10C, 0xC12D, 0xF14E, 0xE16F, 0x1080, 0x00A1, 0x30C2, 0x20E3,
        0x5004, 0x4025, 0x7046, 0x6067, 0x83B9, 0x9398, 0xA3FB, 0xB3DA, 0xC33D, 0xD31C, 0xE37F, 0xF35E, 0x02B1, 0x1290,
        0x22F3, 0x32D2, 0x4235, 0x5214, 0x6277, 0x7256, 0xB5EA, 0xA5CB, 0x95A8, 0x8589, 0xF56E, 0xE54F, 0xD52C, 0xC50D,
        0x34E2, 0x24C3, 0x14A0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405, 0xA7DB, 0xB7FA, 0x8799, 0x97B8, 0xE75F, 0xF77E,
        0xC71D, 0xD73C, 0x26D3, 0x36F2, 0x0691, 0x16B0, 0x6657, 0x7676, 0x4615, 0x5634, 0xD94C, 0xC96D, 0xF90E, 0xE92F,
        0x99C8, 0x89E9, 0xB98A, 0xA9AB, 0x5844, 0x4865, 0x7806, 0x6827, 0x18C0, 0x08E1, 0x3882, 0x28A3, 0xCB7D, 0xDB5C,
        0xEB3F, 0xFB1E, 0x8BF9, 0x9BD8, 0xABBB, 0xBB9A, 0x4A75, 0x5A54, 0x6A37, 0x7A16, 0x0AF1, 0x1AD0, 0x2AB3, 0x3A92,
        0xFD2E, 0xED0F, 0xDD6C, 0xCD4D, 0xBDAA, 0xAD8B, 0x9DE8, 0x8DC9, 0x7C26, 0x6C07, 0x5C64, 0x4C45, 0x3CA2, 0x2C83,
        0x1CE0, 0x0CC1, 0xEF1F, 0xFF3E, 0xCF5D, 0xDF7C, 0xAF9B, 0xBFBA, 0x8FD9, 0x9FF8, 0x6E17, 0x7E36, 0x4E55, 0x5E74,
        0x2E93, 0x3EB2, 0x0ED1, 0x1EF0};
    while (len--) {
        uint8_t idx = (uint8_t)((crc >> 8) ^ *data++);
        crc = (uint16_t)((crc << 8) ^ table[idx]);
    }
    return crc;
}

// Holds the runtime state for the MacBinary transformer layer
typedef struct {
    munbox_layer_t *source;
    munbox_file_info_t file_info;
    uint32_t data_rem; // Remaining bytes in data fork to stream
    uint32_t rsrc_len; // Resource fork length (for metadata only)
    bool error;
    bool streaming_rsrc; // true if we decided to stream the resource fork
    // Iteration mode state
    bool iterating; // true if open()/NEXT is used to iterate forks
    bool started_read; // true after first read() call
    bool opened; // true after open(FIRST) called; required before read()
    uint32_t data_total; // total data fork length
    bool ever_read; // indicates any bytes consumed since last (FIRST) open; triggers rewind on next FIRST
} bin_layer_state_t;

// Read up to 'cnt' bytes from the currently selected fork in the bin layer
static ssize_t bin_layer_read(munbox_layer_t *self, void *buf, size_t cnt) {
    bin_layer_state_t *st = (bin_layer_state_t *)self->internal_state;
    if (!st || st->error)
        return MUNBOX_ERROR;
    if (!st->opened)
        return munbox_error("read() called before open() on bin layer");
    if (cnt == 0)
        return 0;

    // Legacy heuristic: if we prefer streaming the resource fork (decided at factory)
    // defer the skip until first actual read, so that calling open() before reading
    // can still iterate both forks in order.
    if (!st->iterating && !st->started_read && st->streaming_rsrc) {
        // Need to skip past data fork and its padding to reach resource fork start
        size_t data_len = st->data_total;
        size_t pad = (MB_BLOCK_SIZE - (data_len % MB_BLOCK_SIZE)) % MB_BLOCK_SIZE;
        if (skip_bytes(st->source, data_len) != 0)
            return MUNBOX_ERROR;
        if (pad && skip_bytes(st->source, pad) != 0)
            return MUNBOX_ERROR;
        // Now set remaining to resource length
        st->data_rem = st->rsrc_len;
    }

    st->started_read = true;
    if (st->data_rem == 0)
        return 0; // End of current fork

    size_t to_read = st->data_rem < cnt ? st->data_rem : cnt;
    ssize_t r = st->source->read(st->source, buf, to_read);
    if (r < 0)
        return r;
    st->data_rem -= (uint32_t)r;
    if (r > 0) st->ever_read = true;
    return r;
}

// Close the bin layer and free its internal state
static void bin_layer_close(munbox_layer_t *self) {
    if (!self)
        return;
    bin_layer_state_t *st = (bin_layer_state_t *)self->internal_state;
    if (st) {
        if (st->source)
            st->source->close(st->source);
        free(st);
    }
    free(self);
}

// Open the next fork (FIRST/NEXT) for iteration and populate 'info'
static int bin_layer_open(munbox_layer_t *self, munbox_open_t what, munbox_file_info_t *info) {
    bin_layer_state_t *st = (bin_layer_state_t *)self->internal_state;
    if (!st || !info)
        return munbox_error("Invalid parameters to bin_layer_open");

    if (what == MUNBOX_OPEN_FIRST) {
        // Rewind & reparse if any bytes have been consumed already
        if (st->ever_read) {
            if (!st->source->open)
                return munbox_error("underlying source cannot rewind for bin FIRST");
            munbox_file_info_t dummy;
            if (st->source->open(st->source, MUNBOX_OPEN_FIRST, &dummy) < 0)
                return munbox_error("failed to rewind underlying source for bin FIRST");
            // Reparse header & metadata (shared logic inline to avoid code duplication with factory)
            uint8_t hdr[MB_BLOCK_SIZE];
            if (read_fully(st->source, hdr, sizeof(hdr)) != 0)
                return munbox_error("bin rewind: failed reading header");
            uint8_t ver = hdr[0];
            uint8_t name_len = hdr[1];
            if (!((ver == 0) || (ver == 1)) || ver != 0 || hdr[74] != 0 || name_len == 0 || name_len > 63)
                return munbox_error("bin rewind: invalid header");
            uint16_t crc_calc = crc16_xmodem_update(0, hdr, 124);
            uint16_t crc_stored = be16(hdr + 124);
            if (crc_calc != crc_stored && hdr[82] != 0)
                return munbox_error("bin rewind: CRC mismatch");
            uint16_t sec_len = be16(hdr + 120);
            if (sec_len > 0) {
                if (skip_bytes(st->source, sec_len) != 0)
                    return munbox_error("bin rewind: failed skipping secondary header");
                size_t pad = (size_t)(MB_BLOCK_SIZE - (sec_len % MB_BLOCK_SIZE)) % MB_BLOCK_SIZE;
                if (pad && skip_bytes(st->source, pad) != 0)
                    return munbox_error("bin rewind: failed skipping secondary header pad");
            }
            // Re-populate metadata
            memset(&st->file_info, 0, sizeof(st->file_info));
            size_t copy_len = name_len < sizeof(st->file_info.filename) - 1 ? name_len : sizeof(st->file_info.filename) - 1;
            memcpy(st->file_info.filename, hdr + 2, copy_len);
            st->file_info.filename[copy_len] = '\0';
            st->file_info.type = be32(hdr + 65);
            st->file_info.creator = be32(hdr + 69);
            uint16_t finder_flags = ((uint16_t)hdr[73] << 8) | hdr[101];
            finder_flags &= (uint16_t)~((1u << 0) | (1u << 1) | (1u << 8) | (1u << 9) | (1u << 10));
            st->file_info.finder_flags = finder_flags;
            st->file_info.has_metadata = true;
            st->data_total = be32(hdr + 83);
            st->data_rem = st->data_total;
            st->rsrc_len = be32(hdr + 87);
            st->streaming_rsrc = false; // will be recalculated via sniff
            st->started_read = false;
            st->opened = false;
            st->iterating = false;
            // Perform SIT sniff again
            uint8_t sniff[128];
            ssize_t sniffed = st->data_total > 0 ? st->source->read(st->source, sniff, sizeof(sniff)) : 0;
            // Rewind again to start of forks
            if (st->source->open(st->source, MUNBOX_OPEN_FIRST, &dummy) < 0)
                return munbox_error("bin rewind: failed to re-rewind after sniff");
            if (read_fully(st->source, hdr, sizeof(hdr)) != 0)
                return munbox_error("bin rewind: failed re-reading header");
            sec_len = be16(hdr + 120);
            if (sec_len > 0) {
                if (skip_bytes(st->source, sec_len) != 0)
                    return munbox_error("bin rewind: failed skipping secondary header (2)");
                size_t pad2 = (size_t)(MB_BLOCK_SIZE - (sec_len % MB_BLOCK_SIZE)) % MB_BLOCK_SIZE;
                if (pad2 && skip_bytes(st->source, pad2) != 0)
                    return munbox_error("bin rewind: failed skipping secondary header pad (2)");
            }
            bool data_is_sit = (sniffed > 0) && looks_like_sit(sniff, (size_t)sniffed);
            if (!data_is_sit && st->rsrc_len > 0)
                st->streaming_rsrc = true;
            st->ever_read = false; // fresh state until new reads occur
        }
        st->iterating = true;
        st->started_read = false;
        st->opened = true;
        // Ensure data_rem reset if rewound but not iterating earlier
        if (!st->streaming_rsrc)
            st->data_rem = st->data_total;
        // Start at data fork if present; otherwise resource (order unspecified)
        if (st->data_total > 0) {
            st->streaming_rsrc = false;
            st->data_rem = st->data_total;
            *info = st->file_info;
            info->fork_type = MUNBOX_FORK_DATA;
            info->length = st->data_total;
            return 1;
        } else if (st->rsrc_len > 0) {
            st->streaming_rsrc = true;
            // Skip data fork (length 0) padding none; remain at resource start
            st->data_rem = st->rsrc_len;
            *info = st->file_info;
            info->fork_type = MUNBOX_FORK_RESOURCE;
            info->length = st->rsrc_len;
            return 1;
        } else {
            return 0; // No forks
        }
    } else { // MUNBOX_OPEN_NEXT
        if (!st->iterating) {
            return munbox_error("call open(MUNBOX_OPEN_FIRST, ...) before MUNBOX_OPEN_NEXT");
        }
        // If currently streaming data and resource exists, fast-forward to resource
        if (!st->streaming_rsrc && st->rsrc_len > 0) {
            // Skip any remaining data and padding
            size_t remaining = st->data_rem;
            if (remaining > 0) {
                if (skip_bytes(st->source, remaining) != 0)
                    return MUNBOX_ERROR;
                if (remaining > 0) st->ever_read = true;
            }
            size_t pad = (MB_BLOCK_SIZE - (st->data_total % MB_BLOCK_SIZE)) % MB_BLOCK_SIZE;
            if (pad && skip_bytes(st->source, pad) != 0)
                return MUNBOX_ERROR;
            if (pad) st->ever_read = true;
            st->streaming_rsrc = true;
            st->data_rem = st->rsrc_len;
            st->started_read = false;
            *info = st->file_info;
            info->fork_type = MUNBOX_FORK_RESOURCE;
            info->length = st->rsrc_len;
            return 1;
        }
        // No more forks to iterate
        return 0;
    }
}

// Read exactly n bytes from 'src' into 'buf' or return an error
static int read_fully(munbox_layer_t *src, uint8_t *buf, size_t n) {
    size_t off = 0;
    while (off < n) {
        ssize_t r = src->read(src, buf + off, n - off);
        if (r <= 0)
            return MUNBOX_ERROR;
        off += (size_t)r;
    }
    return 0;
}

// Skip and discard 'n' bytes from 'src'
static int skip_bytes(munbox_layer_t *src, size_t n) {
    uint8_t tmp[256];
    while (n > 0) {
        size_t chunk = n < sizeof(tmp) ? n : sizeof(tmp);
        ssize_t r = src->read(src, tmp, chunk);
        if (r <= 0)
            return MUNBOX_ERROR;
        n -= (size_t)r;
    }
    return 0;
}

// Read 16-bit big-endian value from p
static uint16_t be16(const uint8_t *p) { return (uint16_t)((p[0] << 8) | p[1]); }
// Read 32-bit big-endian value from p
static uint32_t be32(const uint8_t *p) {
    return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | (uint32_t)p[3];
}

// Factory: create a MacBinary transformer layer for 'input'. Returns a new
// munbox_layer_t on success or NULL on failure.
munbox_layer_t *munbox_new_bin_layer(munbox_layer_t *input) {
    if (!input)
        return NULL;

    // Use open(FIRST)+read to non-destructively probe the header when available.
    // If open() is not available, we cannot safely probe; return NULL.
    uint8_t hdr[MB_BLOCK_SIZE];
    if (!input->open) {
        return NULL;
    }
    munbox_file_info_t dummy;
    if (input->open(input, MUNBOX_OPEN_FIRST, &dummy) < 0)
        return NULL;
    if (read_fully(input, hdr, sizeof(hdr)) != 0) {
        // Reset and bail
        (void)input->open(input, MUNBOX_OPEN_FIRST, &dummy);
        return NULL;
    }
    // Reset to the beginning so we can construct the layer and consume properly
    (void)input->open(input, MUNBOX_OPEN_FIRST, &dummy);

    // Basic checks (MacBinary II): byte 0 and 74 must be 0; filename length 1..63
    uint8_t ver = hdr[0];
    uint8_t name_len = hdr[1];
    if (!((ver == 0) || (ver == 1)))
        return NULL; // 0 = MB II file, 1 = II+ folder block

    // For this transformer, only accept regular file records (ver==0)
    if (ver != 0)
        return NULL;

    if (hdr[74] != 0)
        return NULL;
    if (name_len == 0 || name_len > 63)
        return NULL;

    // CRC check over bytes 0..123 (MacBinary II) with MacBinary I fallback
    uint16_t crc_calc = crc16_xmodem_update(0, hdr, 124);
    uint16_t crc_stored = be16(hdr + 124);
    if (crc_calc != crc_stored) {
        // MacBinary I compatibility: accept if byte 82 == 0
        if (hdr[82] != 0)
            return NULL;
    }

    // Extract key fields
    uint32_t data_len = be32(hdr + 83);
    uint32_t rsrc_len = be32(hdr + 87);
    // Sanity bounds (historical ~8MB recommended upper bound, but accept larger within 31-bit)
    if (data_len > 0x7FFFFFFFu || rsrc_len > 0x7FFFFFFFu)
        return NULL;

    // Passed validation; construct layer and consume header from the stream
    munbox_layer_t *layer = malloc(sizeof(munbox_layer_t));
    bin_layer_state_t *st = calloc(1, sizeof(bin_layer_state_t));
    if (!layer || !st) {
        free(layer);
        free(st);
        return NULL;
    }

    // Now actually read the header from the stream to advance position
    if (read_fully(input, hdr, sizeof(hdr)) != 0) {
        free(layer);
        free(st);
        return NULL;
    }

    // Secondary header length (MB II requires 0; skip if non-zero just in case)
    uint16_t sec_len = be16(hdr + 120);
    if (sec_len > 0) {
        // Skip the secondary header and pad to 128-byte boundary
        if (skip_bytes(input, sec_len) != 0) {
            free(layer);
            free(st);
            return NULL;
        }
        size_t pad = (size_t)(MB_BLOCK_SIZE - (sec_len % MB_BLOCK_SIZE)) % MB_BLOCK_SIZE;
        if (pad && skip_bytes(input, pad) != 0) {
            free(layer);
            free(st);
            return NULL;
        }
    }

    // Populate metadata
    memset(&st->file_info, 0, sizeof(st->file_info));
    size_t copy_len = name_len < sizeof(st->file_info.filename) - 1 ? name_len : sizeof(st->file_info.filename) - 1;
    memcpy(st->file_info.filename, hdr + 2, copy_len);
    st->file_info.filename[copy_len] = '\0';

    st->file_info.type = be32(hdr + 65);
    st->file_info.creator = be32(hdr + 69);
    uint16_t finder_flags = ((uint16_t)hdr[73] << 8) | hdr[101];
    // Sanitize per spec: clear desktop(0), bFOwnAppl(1), Inited(8), Changed(9), Busy(10)
    finder_flags &= (uint16_t)~((1u << 0) | (1u << 1) | (1u << 8) | (1u << 9) | (1u << 10));
    st->file_info.finder_flags = finder_flags;
    // st->file_info.length will be set per fork in bin_layer_open
    st->file_info.has_metadata = true;

    st->source = input;
    st->data_total = data_len;
    st->data_rem = data_len;
    st->rsrc_len = rsrc_len;
    st->streaming_rsrc = false;
    st->iterating = false;
    st->started_read = false;
    st->opened = false;

    // Heuristic: if data fork does NOT look like a SIT archive but the
    // resource fork likely does (common for self-extracting .sea.bin), then
    // skip to resource fork and stream that instead so downstream SIT layer
    // can extract files.

    // Inspect beginning of data fork to see if it looks like SIT
    uint8_t sniff[128];
    ssize_t sniffed = st->data_total > 0 ? st->source->read(st->source, sniff, sizeof(sniff)) : 0;
    // Rewind data fork by re-opening FIRST and re-consuming header and secondary header
    if (input->open) {
        (void)input->open(input, MUNBOX_OPEN_FIRST, &dummy);
        // Re-consume header and secondary header to restore position for normal streaming
        if (read_fully(input, hdr, sizeof(hdr)) != 0) {
            free(layer);
            free(st);
            return NULL;
        }
        uint16_t sec_len2 = be16(hdr + 120);
        if (sec_len2 > 0) {
            if (skip_bytes(input, sec_len2) != 0) {
                free(layer);
                free(st);
                return NULL;
            }
            size_t pad2 = (size_t)(MB_BLOCK_SIZE - (sec_len2 % MB_BLOCK_SIZE)) % MB_BLOCK_SIZE;
            if (pad2 && skip_bytes(input, pad2) != 0) {
                free(layer);
                free(st);
                return NULL;
            }
        }
    }
    bool data_is_sit = (sniffed > 0) && looks_like_sit(sniff, (size_t)sniffed);

    if (!data_is_sit && rsrc_len > 0) {
        // Skip data fork and padding to get to resource fork start
        // Defer the skip until the first read() unless iteration is requested.
        // Flag that we should prefer resource fork when streaming in legacy mode.
        st->streaming_rsrc = true;
    }

    layer->internal_state = st;
    layer->read = bin_layer_read;
    layer->close = bin_layer_close;
    layer->open = bin_layer_open;

    return layer;
}
