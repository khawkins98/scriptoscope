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

// sit.h
// Header file for StuffIt (.sit) format implementation.

#ifndef SIT_H
#define SIT_H

#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>

// SIT algorithm 15: "Arsenic" decompression
// Complex multi-stage algorithm with arithmetic coding, BWT, MTF, and RLE
// One-shot API (kept for compatibility/tests)
size_t sit15_decompress(uint8_t *dst, size_t dst_len, const uint8_t *src, size_t src_len);

// Streaming API
// Create a streaming decompressor context bound to the compressed buffer.
// Returns NULL on failure.
typedef struct sit15_ctx sit15_ctx_t;
sit15_ctx_t *sit15_init(const uint8_t *src, size_t src_len);

// Produce up to out_cap bytes; returns number of bytes written, 0 on clean end,
// or MUNBOX_ERROR on failure.
ssize_t sit15_read(sit15_ctx_t *ctx, uint8_t *out, size_t out_cap);

// Free the context.
void sit15_free(sit15_ctx_t *ctx);

// SIT algorithm 13 streaming API
// Opaque context for streaming method 13
typedef struct sit13_ctx sit13_ctx_t;

// Initialize method 13 streaming over a contiguous compressed buffer
sit13_ctx_t *sit13_init(const uint8_t *src, size_t src_len);

// Read up to out_cap uncompressed bytes; returns bytes produced, 0 on EOF, or MUNBOX_ERROR
ssize_t sit13_read(sit13_ctx_t *ctx, uint8_t *out, size_t out_cap);

// Free the context and any internal allocations
void sit13_free(sit13_ctx_t *ctx);

#endif // SIT_H
