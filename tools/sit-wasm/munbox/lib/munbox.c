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

// munbox.c
// Core implementation of the munbox external API.

#include "munbox_internal.h"
#include <errno.h>
#include <stdarg.h>

#if __STDC_VERSION__ >= 201112L
/* spike patch: <threads.h> not shipped by Apple clang; _Thread_local is a keyword, no header needed */
#define THREAD_LOCAL _Thread_local
#elif defined(__GNUC__) || defined(__clang__)
#define THREAD_LOCAL __thread
#elif defined(_MSC_VER)
#define THREAD_LOCAL __declspec(thread)
#else
#error "Compiler does not support thread-local storage"
#endif

// --- Error Handling Implementation ---

#define ERROR_BUFFER_SIZE 1024
static THREAD_LOCAL char g_error_buffer[ERROR_BUFFER_SIZE] = "No error";

// Returns the last error message from the thread-local error buffer
const char *munbox_last_error(void) { return g_error_buffer; }

// Sets an error message in the thread-local buffer and returns MUNBOX_ERROR
int munbox_error(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    vsnprintf(g_error_buffer, sizeof(g_error_buffer), fmt, args);
    va_end(args);
    return MUNBOX_ERROR;
}

// --- File Layer Implementation ---

// Reads data from the file layer's underlying file stream
static ssize_t file_layer_read(struct munbox_layer *self, void *buf, size_t cnt) {
    file_layer_state_t *state = (file_layer_state_t *)self->internal_state;
    if (!state->opened)
        return munbox_error("read() called before open() on file layer");
    if (state->eof_reached)
        return 0;

    size_t bytes_read = fread(buf, 1, cnt, state->file);
    if (bytes_read < cnt) {
        if (ferror(state->file))
            return munbox_error("file read error: %s", strerror(errno));
        if (feof(state->file))
            state->eof_reached = true;
    }
    return (ssize_t)bytes_read;
}

// Opens the file for reading and provides file metadata
static int file_layer_open(struct munbox_layer *self, munbox_open_t what, munbox_file_info_t *info) {
    if (!self || !info)
        return munbox_error("Invalid parameters to file_layer_open");
    file_layer_state_t *state = (file_layer_state_t *)self->internal_state;
    if (!state || !state->file)
        return munbox_error("file layer has no state");
    if (what == MUNBOX_OPEN_FIRST) {
        if (fseek(state->file, 0, SEEK_SET) != 0)
            return munbox_error("file seek failed: %s", strerror(errno));
        state->eof_reached = false;
        state->opened = true;
        memset(info, 0, sizeof(*info));
        info->fork_type = MUNBOX_FORK_DATA;
        info->has_metadata = false;
        return 1; // single stream
    }
    return 0; // no NEXT
}

// Closes the file layer and frees associated resources
static void file_layer_close(struct munbox_layer *self) {
    if (!self)
        return;
    file_layer_state_t *state = (file_layer_state_t *)self->internal_state;
    if (state) {
        if (state->file)
            fclose(state->file);
        free(state);
    }
    free(self);
}

// Creates a new file layer for reading from the specified file path
munbox_layer_t *munbox_new_file_layer(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) {
        munbox_error("could not open file '%s': %s", path, strerror(errno));
        return NULL;
    }

    munbox_layer_t *layer = malloc(sizeof(munbox_layer_t));
    file_layer_state_t *state = calloc(1, sizeof(file_layer_state_t));

    if (!layer || !state) {
        free(layer);
        free(state);
        fclose(f);
        munbox_error("out of memory");
        return NULL;
    }

    state->file = f;
    state->opened = false;
    layer->internal_state = state;
    layer->read = file_layer_read;
    layer->close = file_layer_close;
    layer->open = file_layer_open;

    return layer;
}

// --- Memory Layer Implementation ---

// Reads data from the memory layer's buffer
static ssize_t mem_layer_read(struct munbox_layer *self, void *buf, size_t cnt) {
    mem_layer_state_t *state = (mem_layer_state_t *)self->internal_state;
    if (!state->opened)
        return munbox_error("read() called before open() on memory layer");
    size_t remaining = state->size - state->pos;
    size_t bytes_to_read = (cnt < remaining) ? cnt : remaining;

    if (bytes_to_read > 0) {
        memcpy(buf, state->buffer + state->pos, bytes_to_read);
        state->pos += bytes_to_read;
    }
    return (ssize_t)bytes_to_read;
}

// Closes the memory layer and frees associated resources
static void mem_layer_close(struct munbox_layer *self) {
    if (!self)
        return;
    free(self->internal_state);
    free(self);
}

// Opens the memory buffer for reading and provides metadata
static int mem_layer_open(struct munbox_layer *self, munbox_open_t what, munbox_file_info_t *info) {
    if (!self || !info)
        return munbox_error("Invalid parameters to mem_layer_open");
    mem_layer_state_t *state = (mem_layer_state_t *)self->internal_state;
    if (!state)
        return munbox_error("memory layer has no state");
    if (what == MUNBOX_OPEN_FIRST) {
        state->pos = 0;
        state->opened = true;
        memset(info, 0, sizeof(*info));
        info->fork_type = MUNBOX_FORK_DATA;
        info->has_metadata = false;
        return 1;
    }
    return 0;
}

// Creates a new memory layer for reading from the specified buffer
munbox_layer_t *munbox_new_mem_layer(const void *buffer, size_t size) {
    if (!buffer)
        return NULL;

    munbox_layer_t *layer = malloc(sizeof(munbox_layer_t));
    mem_layer_state_t *state = malloc(sizeof(mem_layer_state_t));

    if (!layer || !state) {
        free(layer);
        free(state);
        munbox_error("out of memory");
        return NULL;
    }

    state->buffer = (const uint8_t *)buffer;
    state->size = size;
    state->pos = 0;
    state->opened = false;

    layer->internal_state = state;
    layer->read = mem_layer_read;
    layer->close = mem_layer_close;
    layer->open = mem_layer_open;

    return layer;
}

// --- Processing Pipeline ---

// extern munbox_layer_t* munbox_new_bin_layer(munbox_layer_t *input);
// extern munbox_layer_t* munbox_new_cpt_layer(munbox_layer_t *input);

// The static list of all known format handlers.
static const munbox_format_handler_t g_format_handlers[] = {
    {"sit", munbox_new_sit_layer},
    {"sit5", munbox_new_sit5_layer},
    {"hqx", munbox_new_hqx_layer},
    {"bin", munbox_new_bin_layer},
    //{"MacBinary Layer", munbox_new_bin_layer},
    {"cpt", munbox_new_cpt_layer},
};
static const int g_num_format_handlers = (int)(sizeof(g_format_handlers) / sizeof(g_format_handlers[0]));

munbox_layer_t *munbox_process_new(munbox_layer_t * initial_layer) {
    if (!initial_layer)
        return NULL;

    munbox_layer_t *current_layer = initial_layer;

    for (;;) {

        munbox_layer_t *next_layer = NULL;
        int i;

        for (i = 0; i < g_num_format_handlers; ++i) {
            next_layer = g_format_handlers[i].layer_factory(current_layer);
            if (next_layer) {
                printf("Detected format: %s\n", g_format_handlers[i].name);
                break;
            }
        }

        // if we reached the end of the list -> no layer recognized the input
        if (i == g_num_format_handlers) {
            return current_layer;
        }

        current_layer = next_layer;
    }
}

// Test if munbox can decompress a file by detecting supported formats
int munbox_probe(munbox_layer_t *initial_layer) {
    if (!initial_layer) {
        munbox_error("munbox_probe: NULL initial_layer");
        return -1;
    }

    munbox_layer_t *current_layer = initial_layer;
    int format_count = 0;

    // Iterate through the format detection pipeline
    // We let each factory try to recognize the format; if it succeeds,
    // it returns a new layer wrapping the current one.
    for (;;) {
        if (format_count >= 16) {
            // Safety limit: too many nested layers (probably a bug)
            munbox_error("munbox_probe: exceeded maximum nesting depth");
            // Close the entire chain starting from the top
            if (current_layer && current_layer->close)
                current_layer->close(current_layer);
            return -1;
        }

        munbox_layer_t *next_layer = NULL;
        int i;

        // Try each format handler to see if it recognizes the current layer
        for (i = 0; i < g_num_format_handlers; ++i) {
            next_layer = g_format_handlers[i].layer_factory(current_layer);
            if (next_layer) {
                // Format recognized; move to the next layer in the chain
                format_count++;
                break;
            }
        }

        // If we reached the end of the handler list, no more formats detected
        if (i == g_num_format_handlers) {
            break;
        }

        current_layer = next_layer;
    }

    // Close the entire layer chain
    // Each layer's close() function is responsible for closing its source layer,
    // so we only need to close the outermost layer
    if (current_layer && current_layer->close)
        current_layer->close(current_layer);

    // Return the number of format layers detected (not including the initial file/mem layer)
    return format_count;
}

// Processes a layer through the pipeline of format handlers and extracts files
/* Deprecated old callback-based munbox_process() removed in favor of munbox_process_new(). */
