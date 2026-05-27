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

// munbox_internal.h
// Internal definitions and structures for the munbox library.

#ifndef MUNBOX_INTERNAL_H
#define MUNBOX_INTERNAL_H

#include "munbox.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h> // For FILE*
#include <stdlib.h>
#include <string.h>

/* --- Internal State Structs for Layers --- */

// Holds state for file-based input layers
typedef struct {
    FILE *file;
    bool eof_reached;
    bool opened; /* true after open(FIRST); required before read() */
} file_layer_state_t;

// Holds state for memory buffer-based input layers
typedef struct {
    const uint8_t *buffer;
    size_t size;
    size_t pos;
    bool opened; /* true after open(FIRST); required before read() */
} mem_layer_state_t;

/* --- Format Handler Registry --- */

// Format layer factory function declarations
munbox_layer_t *munbox_new_hqx_layer(munbox_layer_t *input);
munbox_layer_t *munbox_new_sit_layer(munbox_layer_t *input);
munbox_layer_t *munbox_new_cpt_layer(munbox_layer_t *input);
munbox_layer_t *munbox_new_bin_layer(munbox_layer_t *input);

/**
 * @brief A generic struct to hold a reference to any layer factory.
 *
 * In the unified architecture, all format handlers are layer factories
 * that return munbox_layer_t instances with appropriate capabilities.
 */
typedef struct {
    const char *name;
    munbox_layer_t *(*layer_factory)(munbox_layer_t *input);
} munbox_format_handler_t;

#endif // MUNBOX_INTERNAL_H