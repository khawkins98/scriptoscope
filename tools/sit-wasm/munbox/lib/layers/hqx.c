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

// hqx.c
// BinHex 4.0 (.hqx) format decoder layer implementation.

#include <ctype.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "munbox.h"
#include "munbox_internal.h"

// The BinHex 4.0 signature that must appear at the start of the file.
static const char *BINHEX_SIGNATURE = "(This file must be converted with BinHex";

// Update a CRC-16-CCITT value with 'length' bytes from 'data'
static uint16_t crc16_ccitt_update(uint16_t crc, const uint8_t *data, size_t length) {
    // CRC lookup table for fast CRC-16-CCITT computation (poly 0x1021)
    const uint16_t table[] = {
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
    while (length--)
        crc = (crc << 8) ^ table[(crc >> 8) ^ *data++];
    return crc;
}

// Holds runtime state for a BinHex decoding layer
typedef struct {
    munbox_layer_t *source; // The underlying source layer
    unsigned char decode_table[256];

    int seq; // Sequence counter (0-3) for 4-char groups
    bool rle_active; // True if the next byte is a repeat count
    uint8_t last_symbol; // Leftover 6-bit symbol from a previous group
    uint8_t last_output_byte; // The last byte produced, for RLE
    int rle_count; // Remaining count for an active RLE sequence

    enum { HQX_STATE_HEADER, HQX_STATE_DATA, HQX_STATE_RSRC, HQX_STATE_DONE, HQX_STATE_ERROR } stream_state;

    uint16_t header_crc;
    uint16_t data_crc;
    uint16_t rsrc_crc;

    size_t data_rem;
    size_t rsrc_rem;

    // File metadata extracted from BinHex header
    munbox_file_info_t file_info;

    // Iteration state for open()/NEXT
    bool iterating;
    bool opened; // require open() before read()
    bool ever_read; // indicates bytes have been read since last (FIRST) open; triggers rewind on next FIRST
} hqx_layer_state_t;

// --- Layer Implementation ---

// Read decompressed bytes from the BinHex layer into buf
static ssize_t hqx_layer_read(munbox_layer_t *self, void *buf, size_t cnt);
// Close the BinHex layer and free resources
static void hqx_layer_close(munbox_layer_t *self);

// Handle open(FIRST/NEXT) for the BinHex layer and return fork info
static int hqx_layer_open(munbox_layer_t *self, munbox_open_t what, munbox_file_info_t *info);

// Re-parse the HQX header and reset decoding state after rewinding the source
static int decode_one_byte(hqx_layer_state_t *state); // forward declaration
static int hqx_layer_reparse(hqx_layer_state_t *state) {
    // Reset low-level decoder state
    state->seq = 0;
    state->rle_active = false;
    state->last_symbol = 0;
    state->last_output_byte = 0;
    state->rle_count = 0;
    state->stream_state = HQX_STATE_HEADER;
    state->header_crc = 0;
    state->data_crc = 0;
    state->rsrc_crc = 0;
    state->data_rem = 0;
    state->rsrc_rem = 0;
    state->iterating = false; // caller will set as needed
    state->opened = false;
    state->ever_read = false;

    // 1. Scan forward until ':' (start of encoded data)
    uint8_t c;
    bool found_colon = false;
    while (state->source->read(state->source, &c, 1) == 1) {
        if (c == ':') {
            found_colon = true;
            break;
        }
    }
    if (!found_colon) {
        return munbox_error("hqx rewind: no ':' marker found");
    }

    // 2. Decode header exactly as during initial construction
    int res = decode_one_byte(state);
    if (res < 0)
        return munbox_error("hqx rewind: failed to read name length");

    uint8_t name_len = (uint8_t)res;
    state->last_output_byte = name_len;

    int header_data_len = name_len + 1 + 4 + 4 + 2 + 4 + 4; // filename + nul + type + creator + flags + lengths
    uint8_t header_buf[256 + 22];
    header_buf[0] = name_len;
    state->header_crc = crc16_ccitt_update(0, header_buf, 1);

    for (int i = 0; i < header_data_len + 2; ++i) { // +2 for CRC
        res = decode_one_byte(state);
        if (res < 0)
            return munbox_error("hqx rewind: failed while reading header");
        header_buf[i + 1] = (uint8_t)res;
        state->last_output_byte = (uint8_t)res;
        state->header_crc = crc16_ccitt_update(state->header_crc, &header_buf[i + 1], 1);
    }
    if (state->header_crc != 0)
        return munbox_error("hqx rewind: header CRC mismatch");

    // Populate metadata
    memset(&state->file_info, 0, sizeof(munbox_file_info_t));
    size_t name_copy_len = (name_len < sizeof(state->file_info.filename) - 1) ? name_len : sizeof(state->file_info.filename) - 1;
    memcpy(state->file_info.filename, header_buf + 1, name_copy_len);
    state->file_info.filename[name_copy_len] = '\0';

    const uint8_t *type_ptr = header_buf + 1 + name_len + 1;
    const uint8_t *creator_ptr = type_ptr + 4;
    const uint8_t *flags_ptr = creator_ptr + 4;
    state->file_info.type = (type_ptr[0] << 24) | (type_ptr[1] << 16) | (type_ptr[2] << 8) | type_ptr[3];
    state->file_info.creator = (creator_ptr[0] << 24) | (creator_ptr[1] << 16) | (creator_ptr[2] << 8) | creator_ptr[3];
    state->file_info.finder_flags = (flags_ptr[0] << 8) | flags_ptr[1];

    const uint8_t *p = header_buf + 1 + name_len + 1 + 4 + 4 + 2;
    state->data_rem = (p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3];
    p += 4;
    state->rsrc_rem = (p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3];
    state->file_info.has_metadata = true;

    state->stream_state = (state->data_rem > 0) ? HQX_STATE_DATA : HQX_STATE_RSRC;
    return 0;
}

// Read the next non-whitespace encoded character from the source stream
static int get_next_encoded_char(hqx_layer_state_t *state) {
    uint8_t c;
    while (state->source->read(state->source, &c, 1) == 1) {
        if (!isspace(c)) {
            // The stream ends with a ':'
            if (c == ':') {
                return EOF;
            }
            return c;
        }
    }
    return EOF; // Physical end of stream
}

// Decodes one byte from the source stream. Returns the byte or < 0 on error/EOF.
static int decode_one_byte(hqx_layer_state_t *state) {
    // First, handle any leftover RLE from a previous call
    if (state->rle_count > 0) {
        state->rle_count--;
        return state->last_output_byte;
    }

    while (true) {
        int c = get_next_encoded_char(state);
        if (c == EOF) {
            return MUNBOX_ERROR; // Unexpected EOF
        }
        uint8_t current_symbol = state->decode_table[c];
        if (current_symbol > 63) {
            return munbox_error("invalid character in BinHex stream");
        }

        // The HQX stream encodes 3 output bytes across 4 6-bit symbols.
        // We collect symbols in 'seq' steps and then assemble the resulting
        // output byte using shifts and masks.
        uint8_t next_byte;
        bool have_output_byte = false;

        switch (state->seq) {
        case 0: // Expecting C1.
            state->last_symbol = current_symbol;
            state->seq = 1;
            break;
        case 1: // Expecting C2, have C1. Produce Byte 1.
            next_byte = (state->last_symbol << 2) | (current_symbol >> 4);
            state->last_symbol = current_symbol;
            state->seq = 2;
            have_output_byte = true;
            break;
        case 2: // Expecting C3, have C2. Produce Byte 2.
            next_byte = ((state->last_symbol & 0x0F) << 4) | (current_symbol >> 2);
            state->last_symbol = current_symbol;
            state->seq = 3;
            have_output_byte = true;
            break;
        case 3: // Expecting C4, have C3. Produce Byte 3.
            next_byte = ((state->last_symbol & 0x03) << 6) | current_symbol;
            state->seq = 0;
            have_output_byte = true;
            break;
        }

        if (have_output_byte) {
            if (state->rle_active) {
                state->rle_active = false;
                if (next_byte == 0) {
                    // A count of 0 after the RLE marker encodes a literal 0x90
                    // byte; the marker itself was a literal.
                    return 0x90;
                }
                if (next_byte > 1) {
                    // Repeat the last output byte (count - 1) times
                    state->rle_count = next_byte - 2; // -1 for this byte, -1 for the one we return now
                    return state->last_output_byte;
                }

                // A count of 1 is invalid in BinHex RLE and treated as an error
                return munbox_error("invalid RLE count of 1 in BinHex stream");
            } else if (next_byte == 0x90) {
                state->rle_active = true;
                // Continue loop to get the count
            } else {
                return next_byte; // Regular byte
            }
        }
    }
}

// Implement read() for a BinHex layer; returns bytes written or error
static ssize_t hqx_layer_read(munbox_layer_t *self, void *buf, size_t cnt) {
    hqx_layer_state_t *state = (hqx_layer_state_t *)self->internal_state;
    if (!state->opened)
        return munbox_error("read() called before open() on hqx layer");
    uint8_t *out_buf = (uint8_t *)buf;
    size_t bytes_written = 0;

    if (state->stream_state == HQX_STATE_ERROR)
        return MUNBOX_ERROR;
    if (state->stream_state == HQX_STATE_DONE || cnt == 0)
        return 0;

    while (bytes_written < cnt) {
        if (state->stream_state == HQX_STATE_DATA) {
            if (state->data_rem == 0) {
                // Finished data fork, read and verify CRC
                uint8_t crc_bytes[2];
                for (int i = 0; i < 2; ++i) {
                    int byte = decode_one_byte(state);
                    if (byte < 0)
                        return munbox_error("failed to read data fork CRC");
                    crc_bytes[i] = (uint8_t)byte;
                }
                state->data_crc = crc16_ccitt_update(state->data_crc, crc_bytes, 2);
                if (state->data_crc != 0)
                    return munbox_error("data fork CRC mismatch");

                // If iterating, stop after data fork so caller can open NEXT for rsrc
                if (state->iterating) {
                    state->stream_state = HQX_STATE_DONE;
                    break;
                }
                state->stream_state = HQX_STATE_RSRC;
                continue; // Re-evaluate state
            }

            int byte = decode_one_byte(state);
            if (byte < 0) {
                state->stream_state = HQX_STATE_ERROR;
                return munbox_error("unexpected end of data fork");
            }

            out_buf[bytes_written] = (uint8_t)byte;
            state->last_output_byte = (uint8_t)byte;
            state->data_crc = crc16_ccitt_update(state->data_crc, &out_buf[bytes_written], 1);
            bytes_written++;
            state->data_rem--;
            state->ever_read = true;

        } else if (state->stream_state == HQX_STATE_RSRC) {
            if (state->rsrc_rem == 0) {
                // Finished rsrc fork, read and verify CRC
                if (state->rsrc_crc != 0) { // Only read CRC if there was data
                    uint8_t crc_bytes[2];
                    for (int i = 0; i < 2; ++i) {
                        int byte = decode_one_byte(state);
                        if (byte < 0)
                            return munbox_error("failed to read resource fork CRC");
                        crc_bytes[i] = (uint8_t)byte;
                    }
                    state->rsrc_crc = crc16_ccitt_update(state->rsrc_crc, crc_bytes, 2);
                    if (state->rsrc_crc != 0)
                        return munbox_error("resource fork CRC mismatch");
                }
                state->stream_state = HQX_STATE_DONE;
                break; // End of stream
            }

            int byte = decode_one_byte(state);
            if (byte < 0) {
                state->stream_state = HQX_STATE_ERROR;
                return munbox_error("unexpected end of resource fork");
            }

            out_buf[bytes_written] = (uint8_t)byte;
            state->last_output_byte = (uint8_t)byte;
            state->rsrc_crc = crc16_ccitt_update(state->rsrc_crc, &out_buf[bytes_written], 1);
            bytes_written++;
            state->rsrc_rem--;
            state->ever_read = true;

        } else {
            // Should not happen if initialized correctly
            state->stream_state = HQX_STATE_DONE;
            break;
        }
    }

    return (ssize_t)bytes_written;
}

// Close the BinHex layer and underlying source
static void hqx_layer_close(munbox_layer_t *self) {
    if (!self)
        return;
    hqx_layer_state_t *state = (hqx_layer_state_t *)self->internal_state;
    if (state) {
        state->source->close(state->source);
        free(state);
    }
    free(self);
}

// Factory: create a new BinHex decoding layer for 'input' if it appears to be HQX
munbox_layer_t *munbox_new_hqx_layer(munbox_layer_t *input) {
    // Identify HQX without using peek() when possible. Prefer open(FIRST)+read
    // to avoid consuming the stream on failure; reset to the beginning afterward.
    bool recognized = false;
    if (input->open) {
        munbox_file_info_t dummy;
        int rc = input->open(input, MUNBOX_OPEN_FIRST, &dummy);
        if (rc >= 0) {
            char buf[256];
            ssize_t n = input->read(input, buf, sizeof(buf));
            if (n >= (ssize_t)strlen(BINHEX_SIGNATURE)) {
                // Ensure NUL-termination for strstr
                size_t m = (size_t)n < sizeof(buf) - 1 ? (size_t)n : sizeof(buf) - 1;
                buf[m] = '\0';
                if (strstr(buf, BINHEX_SIGNATURE) != NULL) {
                    recognized = true;
                }
            }
            // Reset stream to the beginning for subsequent processing
            (void)input->open(input, MUNBOX_OPEN_FIRST, &dummy);
        }
    }

    // No fallback without open(); base layers implement open(), so this should suffice.

    if (!recognized) {
        return NULL; // Not HQX
    }

    // 2. Signature found. Allocate state.
    munbox_layer_t *layer = malloc(sizeof(munbox_layer_t));
    hqx_layer_state_t *state = calloc(1, sizeof(hqx_layer_state_t));
    if (!layer || !state) {
        free(layer);
        free(state);
        return NULL;
    }

    // 3. Initialize state
    state->source = input;

    // HQX uses a 64-character alphabet to encode 6-bit values; build a
    // reverse lookup table (character -> value). The alphabet intentionally
    // omits easily-confused characters.
    const unsigned char encode[] = "!\"#$%&'()*+,-012345689@ABCDEFGHIJKLMNPQRSTUVXYZ[`abcdefhijklmpqr";
    memset(state->decode_table, 0xFF, sizeof(state->decode_table));
    for (unsigned int i = 0; i < strlen((char *)encode); i++)
        state->decode_table[encode[i]] = (uint8_t)i;

    // 4. Scan forward past the signature and up to the first ':'
    uint8_t c;
    bool found_colon = false;
    while (input->read(input, &c, 1) == 1) {
        if (c == ':') {
            found_colon = true;
            break;
        }
    }
    if (!found_colon) {
        free(layer);
        free(state);
        munbox_error("BinHex signature found, but no data start marker ':'");
        return NULL;
    }

    // 5. Decode the header to get fork lengths
    uint8_t name_len;
    int res = decode_one_byte(state);
    if (res < 0) {
        free(layer);
        free(state);
        return NULL;
    }

    // First byte of the header is the filename length
    name_len = (uint8_t)res;
    state->last_output_byte = name_len;

    // Header consists of: name_len bytes (filename), 1 nul, 4 type, 4 creator,
    // 2 flags, 4 data length, 4 resource length, plus a 2-byte CRC at the end.
    int header_data_len = name_len + 1 + 4 + 4 + 2 + 4 + 4;
    uint8_t header_buf[256 + 22];
    header_buf[0] = name_len;
    state->header_crc = crc16_ccitt_update(0, header_buf, 1);

    // Read header bytes (including trailing 2-byte CRC) and update CRC as we go
    for (int i = 0; i < header_data_len + 2; ++i) { // +2 for CRC
        res = decode_one_byte(state);
        if (res < 0) {
            free(layer);
            free(state);
            return NULL;
        }
        header_buf[i + 1] = (uint8_t)res;
        state->last_output_byte = (uint8_t)res;
        state->header_crc = crc16_ccitt_update(state->header_crc, &header_buf[i + 1], 1);
    }

    if (state->header_crc != 0) {
        free(layer);
        free(state);
        munbox_error("BinHex header CRC mismatch");
        return NULL;
    }

    // Parse and populate file metadata
    memset(&state->file_info, 0, sizeof(munbox_file_info_t));

    // Extract filename (limited to buffer size minus 1 for null terminator)
    size_t name_copy_len =
        (name_len < sizeof(state->file_info.filename) - 1) ? name_len : sizeof(state->file_info.filename) - 1;
    memcpy(state->file_info.filename, header_buf + 1, name_copy_len);
    state->file_info.filename[name_copy_len] = '\0';

    // Extract type and creator (4 bytes each)
    const uint8_t *type_ptr = header_buf + 1 + name_len + 1;
    const uint8_t *creator_ptr = type_ptr + 4;
    const uint8_t *flags_ptr = creator_ptr + 4;

    state->file_info.type = (type_ptr[0] << 24) | (type_ptr[1] << 16) | (type_ptr[2] << 8) | type_ptr[3];
    state->file_info.creator = (creator_ptr[0] << 24) | (creator_ptr[1] << 16) | (creator_ptr[2] << 8) | creator_ptr[3];
    state->file_info.finder_flags = (flags_ptr[0] << 8) | flags_ptr[1];

    // Extract fork lengths (big-endian 32-bit values) from the header buffer
    const uint8_t *p = header_buf + 1 + name_len + 1 + 4 + 4 + 2;
    state->data_rem = (p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3];
    p += 4;
    state->rsrc_rem = (p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3];

    // file_info.length will be populated per fork in hqx_layer_open
    state->file_info.has_metadata = true;

    // 6. Finalize layer setup
    state->stream_state = HQX_STATE_DATA;
    if (state->data_rem == 0) { // If no data fork, move to rsrc fork
        state->stream_state = HQX_STATE_RSRC;
    }

    layer->internal_state = state;
    layer->read = hqx_layer_read;
    layer->close = hqx_layer_close;
    // no extract; HQX is a pure stream transformer
    layer->open = hqx_layer_open; // Support iterating forks

    return layer;
}

// Open iteration over decoded forks for a BinHex layer (FIRST/NEXT)
static int hqx_layer_open(munbox_layer_t *self, munbox_open_t what, munbox_file_info_t *info) {
    if (!self || !info)
        return munbox_error("Invalid parameters to hqx_layer_open");
    hqx_layer_state_t *state = (hqx_layer_state_t *)self->internal_state;

    state->iterating = true;

    if (what == MUNBOX_OPEN_FIRST) {
        // If we've already read some bytes, attempt a rewind + reparse
        if (state->ever_read) {
            if (!state->source->open)
                return munbox_error("underlying source cannot rewind for HQX FIRST");
            munbox_file_info_t dummy;
            if (state->source->open(state->source, MUNBOX_OPEN_FIRST, &dummy) < 0)
                return munbox_error("failed to rewind underlying source for HQX FIRST");
            if (hqx_layer_reparse(state) < 0)
                return MUNBOX_ERROR; // error already reported
        }
        state->opened = true;
        // After (optional) reparse, present first available fork
        if (state->stream_state != HQX_STATE_DATA && state->stream_state != HQX_STATE_RSRC)
            return munbox_error("cannot start iteration at this point");

        if (state->data_rem > 0) {
            *info = state->file_info;
            info->fork_type = MUNBOX_FORK_DATA;
            info->length = (uint32_t)state->data_rem;
            return 1;
        }
        if (state->rsrc_rem > 0) {
            state->stream_state = HQX_STATE_RSRC;
            *info = state->file_info;
            info->fork_type = MUNBOX_FORK_RESOURCE;
            info->length = (uint32_t)state->rsrc_rem;
            return 1;
        }
        return 0; // nothing
    } else { // NEXT
        // If currently in DATA and resource exists, fast-forward to start of resource fork
        if (state->stream_state == HQX_STATE_DATA && state->rsrc_rem > 0) {
            // Consume remaining data bytes to compute CRC correctly
            while (state->data_rem > 0) {
                int byte = decode_one_byte(state);
                if (byte < 0)
                    return munbox_error("unexpected end of data while advancing to resource fork");
                uint8_t b = (uint8_t)byte;
                state->last_output_byte = b;
                state->data_crc = crc16_ccitt_update(state->data_crc, &b, 1);
                state->data_rem--;
                state->ever_read = true;
            }
            // Read and validate data CRC (2 bytes)
            uint8_t crc_bytes[2];
            for (int i = 0; i < 2; ++i) {
                int byte = decode_one_byte(state);
                if (byte < 0)
                    return munbox_error("failed to read data fork CRC while advancing");
                crc_bytes[i] = (uint8_t)byte;
                state->ever_read = true;
            }
            state->data_crc = crc16_ccitt_update(state->data_crc, crc_bytes, 2);
            if (state->data_crc != 0)
                return munbox_error("data fork CRC mismatch while advancing");

            // Now at start of resource fork
            state->stream_state = HQX_STATE_RSRC;
            *info = state->file_info;
            info->fork_type = MUNBOX_FORK_RESOURCE;
            info->length = (uint32_t)state->rsrc_rem;
            return 1;
        }
        // If we already finished data and have resource
        if (state->stream_state == HQX_STATE_DONE && state->rsrc_rem > 0) {
            state->stream_state = HQX_STATE_RSRC;
            *info = state->file_info;
            info->fork_type = MUNBOX_FORK_RESOURCE;
            info->length = (uint32_t)state->rsrc_rem;
            return 1;
        }
        // Already in rsrc or nothing left
        return 0;
    }
}