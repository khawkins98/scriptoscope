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

// sit15.c
// Implementation of SIT algorithm 15 ("Arsenic") decompression.

#include <setjmp.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "munbox.h"
#include "munbox_internal.h"
#include "sit.h"

// =============================================================================
// SECTION 0: DATA STRUCTURES & STATE
// =============================================================================

// Bitstream reader used throughout the SIT15 decompression stages.
typedef struct {
    const uint8_t *buffer;
    size_t buffer_len;
    size_t byte_pos;
    uint32_t bit_container;
    int bits_in_container;
} bit_stream_t;

// Symbol-frequency pair for arithmetic coding models.
typedef struct {
    int symbol;
    int frequency;
} arithmetic_symbol_t;

// Adaptive arithmetic model storing symbol frequencies and update parameters.
typedef struct {
    int total_frequency;
    int update_increment;
    int frequency_limit;
    int symbol_count;
    arithmetic_symbol_t symbols[128];
} arithmetic_model_t;

// Small state for the arithmetic decoder used during SIT15 decoding.
typedef struct {
    int range;
    int code;
} arithmetic_decoder_t;

// Move-to-Front (MTF) decoder state.
typedef struct {
    int table[256];
} mtf_state_t;

// Main decompressor state used by one-shot and streaming APIs.
typedef struct {
    // --- Core State & Error Handling ---
    bit_stream_t stream;
    jmp_buf error_handler; // Used for handling fatal errors like EOF.
    bool end_of_stream_reached;

    // --- Algorithm-specific States ---
    arithmetic_decoder_t arith_decoder;
    mtf_state_t mtf_state;

    // --- Arithmetic Models ---
    arithmetic_model_t primary_model; // For stream headers and flags.
    arithmetic_model_t selector_model; // For choosing data type (zero-run vs symbol).
    arithmetic_model_t mtf_symbol_models[7]; // For decoding MTF symbols.

    // --- Block-level Buffers and Data ---
    int block_size;
    int block_bits;
    uint8_t *mtf_output_buffer; // Stores the output of Stage 3 (MTF).
    uint32_t *bwt_transform_array; // Stores the prepared BWT transform.
    int bwt_primary_index; // Starting index for the BWT reconstruction.
    int bytes_decoded_in_block; // Number of bytes currently in the MTF buffer.

    // --- Output Generation State ---
    int output_bytes_from_block; // Counter for bytes produced from the current block.
    int bwt_current_index; // Current position in the BWT reconstruction chain.
    bool is_randomized; // Flag for Stage 5.

    // Stage 5: Randomization State
    int randomization_table_index;
    int randomization_next_pos;

    // Stage 6: Final RLE State
    int final_rle_last_byte;
    int final_rle_consecutive_count;
    int final_rle_repeat_count;

} decompressor_state_t;

// Public opaque context for streaming
struct sit15_ctx {
    decompressor_state_t *st;
    size_t bytes_left; // remaining bytes expected by caller
    bool initialized;
};

// Static table of offsets for the Randomization stage.
static const uint16_t RANDOMIZATION_TABLE[] = {
    0xee, 0x56, 0xf8,  0xc3, 0x9d, 0x9f,  0xae, 0x2c, 0xad, 0xcd,  0x24, 0x9d, 0xa6, 0x101, 0x18, 0xb9, 0xa1, 0x82,
    0x75, 0xe9, 0x9f,  0x55, 0x66, 0x6a,  0x86, 0x71, 0xdc, 0x84,  0x56, 0x96, 0x56, 0xa1,  0x84, 0x78, 0xb7, 0x32,
    0x6a, 0x3,  0xe3,  0x2,  0x11, 0x101, 0x8,  0x44, 0x83, 0x100, 0x43, 0xe3, 0x1c, 0xf0,  0x86, 0x6a, 0x6b, 0xf,
    0x3,  0x2d, 0x86,  0x17, 0x7b, 0x10,  0xf6, 0x80, 0x78, 0x7a,  0xa1, 0xe1, 0xef, 0x8c,  0xf6, 0x87, 0x4b, 0xa7,
    0xe2, 0x77, 0xfa,  0xb8, 0x81, 0xee,  0x77, 0xc0, 0x9d, 0x29,  0x20, 0x27, 0x71, 0x12,  0xe0, 0x6b, 0xd1, 0x7c,
    0xa,  0x89, 0x7d,  0x87, 0xc4, 0x101, 0xc1, 0x31, 0xaf, 0x38,  0x3,  0x68, 0x1b, 0x76,  0x79, 0x3f, 0xdb, 0xc7,
    0x1b, 0x36, 0x7b,  0xe2, 0x63, 0x81,  0xee, 0xc,  0x63, 0x8b,  0x78, 0x38, 0x97, 0x9b,  0xd7, 0x8f, 0xdd, 0xf2,
    0xa3, 0x77, 0x8c,  0xc3, 0x39, 0x20,  0xb3, 0x12, 0x11, 0xe,   0x17, 0x42, 0x80, 0x2c,  0xc4, 0x92, 0x59, 0xc8,
    0xdb, 0x40, 0x76,  0x64, 0xb4, 0x55,  0x1a, 0x9e, 0xfe, 0x5f,  0x6,  0x3c, 0x41, 0xef,  0xd4, 0xaa, 0x98, 0x29,
    0xcd, 0x1f, 0x2,   0xa8, 0x87, 0xd2,  0xa0, 0x93, 0x98, 0xef,  0xc,  0x43, 0xed, 0x9d,  0xc2, 0xeb, 0x81, 0xe9,
    0x64, 0x23, 0x68,  0x1e, 0x25, 0x57,  0xde, 0x9a, 0xcf, 0x7f,  0xe5, 0xba, 0x41, 0xea,  0xea, 0x36, 0x1a, 0x28,
    0x79, 0x20, 0x5e,  0x18, 0x4e, 0x7c,  0x8e, 0x58, 0x7a, 0xef,  0x91, 0x2,  0x93, 0xbb,  0x56, 0xa1, 0x49, 0x1b,
    0x79, 0x92, 0xf3,  0x58, 0x4f, 0x52,  0x9c, 0x2,  0x77, 0xaf,  0x2a, 0x8f, 0x49, 0xd0,  0x99, 0x4d, 0x98, 0x101,
    0x60, 0x93, 0x100, 0x75, 0x31, 0xce,  0x49, 0x20, 0x56, 0x57,  0xe2, 0xf5, 0x26, 0x2b,  0x8a, 0xbf, 0xde, 0xd0,
    0x83, 0x34, 0xf4,  0x17};

// =============================================================================
// SECTION 1: FORWARD DECLARATIONS OF STAGED FUNCTIONS
// =============================================================================

static uint8_t decompress_byte(decompressor_state_t *state);
static void decode_and_prepare_next_block(decompressor_state_t *state);
static uint8_t reconstruct_byte_from_bwt(decompressor_state_t *state);

// =============================================================================
// SECTION 2: LOW-LEVEL HELPER FUNCTIONS
// =============================================================================

// Abort decompression by longjmp-ing to the stored error handler.
static void handle_error(decompressor_state_t *state) { longjmp(state->error_handler, 1); }

// --- BitStream Functions ---
// Ensure the bit container has at least 24 bits by pulling bytes from the input.
static void fill_bit_buffer(decompressor_state_t *state) {
    bit_stream_t *stream = &state->stream;
    while (stream->bits_in_container <= 24) {
        if (stream->byte_pos >= stream->buffer_len) {
            return;
        }
        stream->bit_container |= (uint32_t)stream->buffer[stream->byte_pos++] << (24 - stream->bits_in_container);
        stream->bits_in_container += 8;
    }
}

// Read 'num_bits' MSB-first from the bit container and advance the stream.
static uint32_t read_bits(decompressor_state_t *state, int num_bits) {
    bit_stream_t *stream = &state->stream;
    if (num_bits > stream->bits_in_container) {
        fill_bit_buffer(state);
        if (num_bits > stream->bits_in_container) {
            handle_error(state);
        }
    }
    uint32_t bits = stream->bit_container >> (32 - num_bits);
    stream->bit_container <<= num_bits;
    stream->bits_in_container -= num_bits;
    return bits;
}

// Read up to 'num_bits' by combining multiple read_bits calls when needed.
static uint32_t read_long_bits(decompressor_state_t *state, int num_bits) {
    if (num_bits <= 25)
        return read_bits(state, num_bits);
    uint32_t high = read_bits(state, 25);
    uint32_t low = read_bits(state, num_bits - 25);
    return (high << (num_bits - 25)) | low;
}

// --- Arithmetic Model Functions ---
// Reset frequencies in the arithmetic model to the configured increment.
static void reset_arithmetic_model(arithmetic_model_t *model) {
    model->total_frequency = model->update_increment * model->symbol_count;
    for (int i = 0; i < model->symbol_count; i++) {
        model->symbols[i].frequency = model->update_increment;
    }
}

// Initialize an arithmetic model for symbols in range [first_sym..last_sym].
static void initialize_arithmetic_model(arithmetic_model_t *model, int first_sym, int last_sym, int increment,
                                        int limit) {
    model->update_increment = increment;
    model->frequency_limit = limit;
    model->symbol_count = last_sym - first_sym + 1;
    for (int i = 0; i < model->symbol_count; i++) {
        model->symbols[i].symbol = i + first_sym;
    }
    reset_arithmetic_model(model);
}

// Update the frequency of 'symbol_index', and rescale if the total exceeds limit.
static void update_arithmetic_model(arithmetic_model_t *model, int symbol_index) {
    model->symbols[symbol_index].frequency += model->update_increment;
    model->total_frequency += model->update_increment;

    if (model->total_frequency > model->frequency_limit) {
        model->total_frequency = 0;
        for (int i = 0; i < model->symbol_count; i++) {
            model->symbols[i].frequency = (model->symbols[i].frequency + 1) >> 1;
            model->total_frequency += model->symbols[i].frequency;
        }
    }
}

#define ARITHMETIC_BITS       26
#define ARITHMETIC_RANGE_ONE  (1 << (ARITHMETIC_BITS - 1))
#define ARITHMETIC_RANGE_HALF (1 << (ARITHMETIC_BITS - 2))

// Initialize arithmetic decoder internal range and fill initial code bits.
static void initialize_arithmetic_decoder(decompressor_state_t *state) {
    state->arith_decoder.range = ARITHMETIC_RANGE_ONE;
    state->arith_decoder.code = (int)read_long_bits(state, ARITHMETIC_BITS);
}

// Decode one symbol from 'model' using the arithmetic decoder state.
static int decode_arithmetic_symbol(decompressor_state_t *state, arithmetic_model_t *model) {
    arithmetic_decoder_t *decoder = &state->arith_decoder;
    if (model->total_frequency == 0)
        handle_error(state);

    int renorm_factor = decoder->range / model->total_frequency;
    if (renorm_factor == 0)
        handle_error(state);

    int freq_threshold = decoder->code / renorm_factor;
    int cumulative_freq = 0;
    int symbol_index;
    for (symbol_index = 0; symbol_index < model->symbol_count - 1; symbol_index++) {
        if (cumulative_freq + model->symbols[symbol_index].frequency > freq_threshold)
            break;
        cumulative_freq += model->symbols[symbol_index].frequency;
    }

    int sym_low = cumulative_freq;
    int sym_size = model->symbols[symbol_index].frequency;

    int low_increment = renorm_factor * sym_low;
    decoder->code -= low_increment;
    if (sym_low + sym_size == model->total_frequency) {
        decoder->range -= low_increment;
    } else {
        decoder->range = sym_size * renorm_factor;
    }

    while (decoder->range <= ARITHMETIC_RANGE_HALF) {
        decoder->range <<= 1;
        decoder->code = (int)(((uint32_t)decoder->code << 1) | read_bits(state, 1));
    }

    update_arithmetic_model(model, symbol_index);
    return model->symbols[symbol_index].symbol;
}

// Decode a little-endian bit string of 'num_bits' bits where each bit is
// produced by decoding a single arithmetic symbol from 'model'.
static int decode_arithmetic_bit_string(decompressor_state_t *state, arithmetic_model_t *model, int num_bits) {
    int result = 0;
    for (int i = 0; i < num_bits; i++) {
        if (decode_arithmetic_symbol(state, model)) {
            result |= 1 << i;
        }
    }
    return result;
}

// --- MTF Functions ---
// Reset the MTF table to the identity permutation (0..255).
static void reset_mtf_decoder(mtf_state_t *mtf) {
    for (int i = 0; i < 256; i++)
        mtf->table[i] = i;
}

// Apply Move-To-Front decoding: return value at 'symbol' and move it to front.
static int decode_mtf_symbol(mtf_state_t *mtf, int symbol) {
    int value = mtf->table[symbol];
    if (symbol > 0) {
        size_t count = (size_t)symbol; /* symbol in [0,255] */
        memmove(&mtf->table[1], &mtf->table[0], count * sizeof(int));
    }
    mtf->table[0] = value;
    return value;
}

// --- BWT Functions ---
// Build the inverse BWT transform array mapping positions to original indices.
static void prepare_inverse_bwt_transform(uint32_t *transform_array, const uint8_t *block_data, int block_len) {
    int counts[256] = {0};
    int cumulative_counts[256];

    for (int i = 0; i < block_len; i++)
        counts[block_data[i]]++;

    int total = 0;
    for (int i = 0; i < 256; i++) {
        cumulative_counts[i] = total;
        total += counts[i];
        counts[i] = 0;
    }

    for (int i = 0; i < block_len; i++) {
        int b = block_data[i];
        int pos = cumulative_counts[b] + counts[b];
        transform_array[(size_t)pos] = (uint32_t)i;
        counts[b]++;
    }
}

// =============================================================================
// SECTION 3: MAIN DECOMPRESSION LOGIC & STAGES
// =============================================================================

// Main SIT15 decompression function: one-shot API that writes up to dst_len bytes.
size_t sit15_decompress(uint8_t *dst, size_t dst_len, const uint8_t *src, size_t src_len) {
    decompressor_state_t *state = (decompressor_state_t *)calloc(1, sizeof(decompressor_state_t));
    if (!state)
        return 0;

    // Setup error handling. On error, longjmp will return 1 here.
    if (setjmp(state->error_handler) != 0) {
        free(state->mtf_output_buffer);
        free(state->bwt_transform_array);
        free(state);
        return 0; // Indicate failure
    }

    // --- Initialize State & Read Stream Header ---
    state->stream.buffer = src;
    state->stream.buffer_len = src_len;
    initialize_arithmetic_decoder(state);

    initialize_arithmetic_model(&state->primary_model, 0, 1, 1, 256);
    if (decode_arithmetic_bit_string(state, &state->primary_model, 8) != 'A' ||
        decode_arithmetic_bit_string(state, &state->primary_model, 8) != 's') {
        handle_error(state); // Invalid signature
    }
    state->block_bits = decode_arithmetic_bit_string(state, &state->primary_model, 4);
    /* block_size is always positive and fits in int (block_bits in [0,15]) but
       we compute using unsigned to avoid sign-conversion warnings, then range check. */
    unsigned computed_block_size = 1u << (unsigned)(state->block_bits + 9);
    if (computed_block_size > (unsigned)INT32_MAX) {
        handle_error(state);
    }
    state->block_size = (int)computed_block_size; /* <= 1<<(4+9)=8192 typical */
    state->end_of_stream_reached = decode_arithmetic_symbol(state, &state->primary_model);

    // Allocate buffers based on block size from header
    state->mtf_output_buffer = (uint8_t *)malloc((size_t)state->block_size);
    state->bwt_transform_array = (uint32_t *)malloc((size_t)state->block_size * sizeof(uint32_t));
    if (!state->mtf_output_buffer || !state->bwt_transform_array)
        handle_error(state);

    // --- Main Decompression Loop ---
    for (size_t i = 0; i < dst_len; i++) {
        dst[i] = decompress_byte(state);
    }

    // --- Cleanup ---
    free(state->mtf_output_buffer);
    free(state->bwt_transform_array);
    free(state);

    return dst_len;
}

// Produce one decompressed byte, handling final RLE and requesting new blocks.
static uint8_t decompress_byte(decompressor_state_t *state) {
    // STAGE 6: Final Run-Length Decoding (Part 1: Handle active run)
    if (state->final_rle_repeat_count > 0) {
        state->final_rle_repeat_count--;
        return (uint8_t)state->final_rle_last_byte;
    }

    // Check if the current block's buffer is exhausted
    if (state->output_bytes_from_block >= state->bytes_decoded_in_block) {
        if (state->end_of_stream_reached) {
            handle_error(state); // Requesting bytes past the end of the stream
        }
        decode_and_prepare_next_block(state);
    }

    // Get a byte from the BWT/Randomization stages
    uint8_t byte = reconstruct_byte_from_bwt(state);

    // STAGE 6: Final Run-Length Decoding (Part 2: State management and triggers)
    if (state->final_rle_consecutive_count == 4) {
        state->final_rle_consecutive_count = 0;
        if (byte == 0) { // Special case: a zero byte here means retry
            return decompress_byte(state);
        }
    state->final_rle_repeat_count = (int)byte - 1;
    return (uint8_t)state->final_rle_last_byte;
    } else {
        if (byte == state->final_rle_last_byte) {
            state->final_rle_consecutive_count++;
        } else {
            state->final_rle_consecutive_count = 1;
            state->final_rle_last_byte = byte;
        }
        return byte;
    }
}

// Decode a full compressed block from the stream and prepare data for output.
// This runs stages 1..4 (arithmetic/zero-run/MTF and inverse BWT prep).
static void decode_and_prepare_next_block(decompressor_state_t *state) {
    // --- Initialize Models for New Block ---
    initialize_arithmetic_model(&state->selector_model, 0, 10, 8, 1024);

    // Refactored initialization of MTF symbol models
    const int mtf_first_syms[] = {2, 4, 8, 16, 32, 64, 128};
    const int mtf_last_syms[] = {3, 7, 15, 31, 63, 127, 255};
    const int mtf_increments[] = {8, 4, 4, 4, 2, 2, 1};
    for (int i = 0; i < 7; i++) {
        initialize_arithmetic_model(&state->mtf_symbol_models[i], mtf_first_syms[i], mtf_last_syms[i],
                                    mtf_increments[i], 1024);
    }

    reset_mtf_decoder(&state->mtf_state);

    // --- Read Block Header ---
    state->is_randomized = decode_arithmetic_symbol(state, &state->primary_model);
    state->bwt_primary_index = decode_arithmetic_bit_string(state, &state->primary_model, state->block_bits + 9);
    state->bytes_decoded_in_block = 0;

    // --- STAGES 1, 2 & 3: Arithmetic, Zero RLE, and MTF Decoding ---
    for (;;) {
        int selector = decode_arithmetic_symbol(state, &state->selector_model);
        int symbol;

        if (selector == 10) { // End-of-block marker
            break;
        } else if (selector == 0 || selector == 1) { // STAGE 2: Zero Run-Length Decoding
            int zero_run_state = 1;
            int zero_run_count = 0;
            do {
                if (selector == 0)
                    zero_run_count += zero_run_state;
                else
                    zero_run_count += 2 * zero_run_state; // selector == 1
                zero_run_state *= 2;
                selector = decode_arithmetic_symbol(state, &state->selector_model);
            } while (selector < 2);

            if (state->bytes_decoded_in_block + zero_run_count > state->block_size)
                handle_error(state);

            int zero_value = decode_mtf_symbol(&state->mtf_state, 0);
            memset(&state->mtf_output_buffer[state->bytes_decoded_in_block], zero_value, (size_t)zero_run_count);
            state->bytes_decoded_in_block += zero_run_count;

            if (selector == 10)
                break; // End-of-block followed a zero run
        }

        // STAGE 1: Decode a single symbol
        if (selector == 2) {
            symbol = 1;
        } else {
            symbol = decode_arithmetic_symbol(state, &state->mtf_symbol_models[selector - 3]);
        }

        // STAGE 3: MTF Decode the symbol and store in buffer
        if (state->bytes_decoded_in_block >= state->block_size)
            handle_error(state);
    state->mtf_output_buffer[state->bytes_decoded_in_block++] = (uint8_t)decode_mtf_symbol(&state->mtf_state, symbol);
    }

    if (state->bwt_primary_index >= state->bytes_decoded_in_block && state->bytes_decoded_in_block > 0)
        handle_error(state);

    // --- Read Block Footer ---
    reset_arithmetic_model(&state->selector_model);
    for (int i = 0; i < 7; i++)
        reset_arithmetic_model(&state->mtf_symbol_models[i]);

    if (decode_arithmetic_symbol(state, &state->primary_model)) {
        decode_arithmetic_bit_string(state, &state->primary_model, 32); // Skip CRC
        state->end_of_stream_reached = true;
    }

    // --- STAGE 4: Inverse BWT (Preparation) ---
    if (state->bytes_decoded_in_block > 0) {
        prepare_inverse_bwt_transform(state->bwt_transform_array, state->mtf_output_buffer,
                                      state->bytes_decoded_in_block);
    }

    // --- Reset state for output generation from this new block ---
    state->output_bytes_from_block = 0;
    state->final_rle_consecutive_count = 0;
    state->final_rle_last_byte = 0;
    state->bwt_current_index = state->bwt_primary_index;
    state->randomization_table_index = 0;
    state->randomization_next_pos = RANDOMIZATION_TABLE[0];
}

// Reconstruct one byte using the inverse BWT transform and apply randomization.
static uint8_t reconstruct_byte_from_bwt(decompressor_state_t *state) {
    // STAGE 4: Inverse BWT (Byte Reconstruction)
    state->bwt_current_index = (int)state->bwt_transform_array[state->bwt_current_index];
    if (state->bwt_current_index < 0 || state->bwt_current_index >= state->bytes_decoded_in_block)
        handle_error(state);
    uint8_t byte = state->mtf_output_buffer[state->bwt_current_index];

    // STAGE 5: Randomization XOR
    if (state->is_randomized && state->randomization_next_pos == state->output_bytes_from_block) {
        byte ^= 1;
        state->randomization_table_index = (state->randomization_table_index + 1) & 255;
        state->randomization_next_pos += RANDOMIZATION_TABLE[state->randomization_table_index];
    }

    state->output_bytes_from_block++;
    return byte;
}

// =============================================================================
// SECTION 4: STREAMING WRAPPER API
// =============================================================================

// Initialize a streaming SIT15 context for incremental reads from 'src'.
sit15_ctx_t *sit15_init(const uint8_t *src, size_t src_len) {
    decompressor_state_t *st = (decompressor_state_t *)calloc(1, sizeof(decompressor_state_t));
    if (!st)
        return NULL;
    if (setjmp(st->error_handler) != 0) {
        free(st->mtf_output_buffer);
        free(st->bwt_transform_array);
        free(st);
        return NULL;
    }
    // Initialize bitstream and arithmetic decoder / models as one-shot does
    st->stream.buffer = src;
    st->stream.buffer_len = src_len;
    initialize_arithmetic_decoder(st);

    initialize_arithmetic_model(&st->primary_model, 0, 1, 1, 256);
    if (decode_arithmetic_bit_string(st, &st->primary_model, 8) != 'A' ||
        decode_arithmetic_bit_string(st, &st->primary_model, 8) != 's') {
        handle_error(st);
    }
    st->block_bits = decode_arithmetic_bit_string(st, &st->primary_model, 4);
    unsigned computed_block_size2 = 1u << (unsigned)(st->block_bits + 9);
    if (computed_block_size2 > (unsigned)INT32_MAX) {
        handle_error(st);
    }
    st->block_size = (int)computed_block_size2;
    st->end_of_stream_reached = decode_arithmetic_symbol(st, &st->primary_model);

    st->mtf_output_buffer = (uint8_t *)malloc((size_t)st->block_size);
    st->bwt_transform_array = (uint32_t *)malloc((size_t)st->block_size * sizeof(uint32_t));
    if (!st->mtf_output_buffer || !st->bwt_transform_array)
        handle_error(st);

    struct sit15_ctx *ctx = (struct sit15_ctx *)calloc(1, sizeof(struct sit15_ctx));
    if (!ctx) {
        free(st->mtf_output_buffer);
        free(st->bwt_transform_array);
        free(st);
        return NULL;
    }
    ctx->st = st;
    ctx->bytes_left = (size_t)-1; // unknown to the streaming engine
    ctx->initialized = true;
    return ctx;
}

// Read up to 'out_cap' decompressed bytes into 'out'. Returns bytes produced or MUNBOX_ERROR.
ssize_t sit15_read(sit15_ctx_t *ctx, uint8_t *out, size_t out_cap) {
    if (!ctx || !ctx->st || !out)
        return MUNBOX_ERROR;
    decompressor_state_t *st = ctx->st;
    if (setjmp(st->error_handler) != 0) {
        return MUNBOX_ERROR;
    }
    size_t produced = 0;
    while (produced < out_cap) {
        // Try to produce a byte; if EOS and no pending (including final RLE repeats), return 0
        if (st->end_of_stream_reached && st->output_bytes_from_block >= st->bytes_decoded_in_block &&
            st->final_rle_repeat_count == 0) {
            break;
        }
        uint8_t b = decompress_byte(st);
        out[produced++] = b;
    }
    return (ssize_t)produced;
}

// Free a streaming SIT15 context and all associated buffers.
void sit15_free(sit15_ctx_t *ctx) {
    if (!ctx)
        return;
    if (ctx->st) {
        free(ctx->st->mtf_output_buffer);
        free(ctx->st->bwt_transform_array);
        free(ctx->st);
    }
    free(ctx);
}
