/*
 * Mycelial Minimal Builtin Runtime
 *
 * The bare minimum required to run the bootstrap compiler's linker.
 * Only 10 functions. No fat. Built different.
 *
 * We're not C. We're not Rust. We're Mycelial.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdint.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

// Vector structure - dynamic array of 64-bit values
typedef struct {
    void** data;      // Array of pointers (can hold any 64-bit value)
    size_t length;    // Number of elements
    size_t capacity;  // Allocated capacity
} MycelialVector;

// String is just a char* in C
typedef char* MycelialString;

// ═══════════════════════════════════════════════════════════════════════════
// VECTOR OPERATIONS (5 functions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * vec_new() -> vec<T>
 * Create a new empty vector
 */
MycelialVector* builtin_vec_new(void) {
    MycelialVector* vec = malloc(sizeof(MycelialVector));
    vec->capacity = 16;  // Start with 16 elements
    vec->length = 0;
    vec->data = calloc(vec->capacity, sizeof(void*));
    return vec;
}

/**
 * vec_push(vec: vec<T>, item: T)
 * Append item to vector
 */
void builtin_vec_push(MycelialVector* vec, void* item) {
    // Resize if needed
    if (vec->length >= vec->capacity) {
        vec->capacity *= 2;
        vec->data = realloc(vec->data, vec->capacity * sizeof(void*));
    }

    vec->data[vec->length] = item;
    vec->length++;
}

/**
 * vec_len(vec: vec<T>) -> u32
 * Get vector length
 */
uint32_t builtin_vec_len(MycelialVector* vec) {
    return (uint32_t)vec->length;
}

/**
 * vec_get(vec: vec<T>, index: u32) -> T
 * Get element at index
 */
void* builtin_vec_get(MycelialVector* vec, uint32_t index) {
    if (index >= vec->length) {
        fprintf(stderr, "ERROR: Vector index out of bounds: %u >= %zu\n",
                index, vec->length);
        exit(1);
    }
    return vec->data[index];
}

/**
 * vec_set(vec: vec<T>, index: u32, value: T)
 * Set element at index
 */
void builtin_vec_set(MycelialVector* vec, uint32_t index, void* value) {
    if (index >= vec->length) {
        fprintf(stderr, "ERROR: Vector index out of bounds: %u >= %zu\n",
                index, vec->length);
        exit(1);
    }
    vec->data[index] = value;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRING OPERATIONS (3 functions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * string_len(s: string) -> u32
 * Get string length
 */
uint32_t builtin_string_len(const char* s) {
    return (uint32_t)strlen(s);
}

/**
 * char_at(s: string, index: u32) -> u8
 * Get character at index (as ASCII value)
 */
uint8_t builtin_char_at(const char* s, uint32_t index) {
    size_t len = strlen(s);
    if (index >= len) {
        fprintf(stderr, "ERROR: String index out of bounds: %u >= %zu\n",
                index, len);
        exit(1);
    }
    return (uint8_t)s[index];
}

/**
 * format(fmt: string, ...) -> string
 * Format string with arguments (sprintf wrapper)
 *
 * Supports basic format specifiers:
 * - %s: string
 * - %d, %u: integers
 * - %x: hex
 * - {}: placeholder for any value (converts to string)
 */
char* builtin_format(const char* fmt, ...) {
    va_list args;

    // First pass: calculate required size
    va_start(args, fmt);
    int size = vsnprintf(NULL, 0, fmt, args);
    va_end(args);

    if (size < 0) {
        fprintf(stderr, "ERROR: Format string error\n");
        exit(1);
    }

    // Allocate buffer
    char* result = malloc(size + 1);

    // Second pass: actually format
    va_start(args, fmt);
    vsnprintf(result, size + 1, fmt, args);
    va_end(args);

    return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// I/O OPERATIONS (2 functions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * write_file(path: string, data: vec<u8>)
 * Write binary data to file
 */
void builtin_write_file(const char* path, MycelialVector* data) {
    FILE* f = fopen(path, "wb");
    if (!f) {
        fprintf(stderr, "ERROR: Cannot open file for writing: %s\n", path);
        exit(1);
    }

    // Write each byte from the vector
    for (size_t i = 0; i < data->length; i++) {
        // Data is stored as void*, but for vec<u8> it's actually just the byte value
        uint8_t byte = (uint8_t)(uintptr_t)data->data[i];
        fputc(byte, f);
    }

    fclose(f);

    printf("✅ Wrote %zu bytes to %s\n", data->length, path);
}

/**
 * chmod(path: string, mode: u32)
 * Set file permissions (make executable)
 */
void builtin_chmod(const char* path, uint32_t mode) {
    if (chmod(path, (mode_t)mode) != 0) {
        fprintf(stderr, "ERROR: Cannot chmod %s\n", path);
        exit(1);
    }

    printf("✅ Set permissions 0%o on %s\n", mode, path);
}

// ═══════════════════════════════════════════════════════════════════════════
// BONUS: HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * print(s: string)
 * Print to stdout (useful for debugging)
 */
void builtin_print(const char* s) {
    printf("%s\n", s);
}

/**
 * exit_with_code(code: u32)
 * Exit with status code
 */
void builtin_exit(uint32_t code) {
    exit((int)code);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG INFO
// ═══════════════════════════════════════════════════════════════════════════

void __mycelial_runtime_init(void) {
    fprintf(stderr, "🍄 Mycelial Minimal Runtime Initialized\n");
    fprintf(stderr, "   10 core builtins loaded\n");
    fprintf(stderr, "   Ready for self-hosting\n");
    fprintf(stderr, "   Built different. 🔥\n\n");
}

// Auto-initialize on load
__attribute__((constructor))
void mycelial_init(void) {
    __mycelial_runtime_init();
}
