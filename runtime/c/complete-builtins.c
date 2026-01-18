/*
 * Mycelial Complete Builtin Runtime
 *
 * ALL builtins needed for the bootstrap compiler.
 * ~30 functions. Complete implementation.
 *
 * Built different. 🔥
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdbool.h>
#include <ctype.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>
#include <time.h>

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

// Vector structure - dynamic array of 64-bit values
typedef struct {
    void** data;      // Array of pointers (can hold any 64-bit value)
    size_t length;    // Number of elements
    size_t capacity;  // Allocated capacity
} MycelialVector;

// Map structure - simple key-value store
typedef struct {
    MycelialVector* keys;    // Vector of keys (strings or any value)
    MycelialVector* values;  // Vector of values
} MycelialMap;

// String is just a char* in C
typedef char* MycelialString;

// ═══════════════════════════════════════════════════════════════════════════
// VECTOR OPERATIONS (5 functions)
// ═══════════════════════════════════════════════════════════════════════════

// Debug: track vector creation
static int vec_creation_id = 0;
static void* known_vectors[200];
static int known_vector_count = 0;

/**
 * vec_new() -> vec<T>
 * Create a new empty vector
 */
MycelialVector* builtin_vec_new(void) {
    MycelialVector* vec = malloc(sizeof(MycelialVector));
    vec->capacity = 16;  // Start with 16 elements
    vec->length = 0;
    vec->data = calloc(vec->capacity, sizeof(void*));
    vec_creation_id++;
    // Debug disabled for now
    return vec;
}

// Helper to check if an address is a known vector
static int is_known_vector(void* addr) {
    for (int i = 0; i < known_vector_count; i++) {
        if (known_vectors[i] == addr) return 1;
    }
    return 0;
}

/**
 * vec_push(vec: vec<T>, item: T)
 * Append item to vector
 */
void builtin_vec_push(MycelialVector* vec, void* item) {
    static int push_count = 0;
    static void* target_vec = NULL;  // The crash vector
    push_count++;

    if (!vec) {
        fprintf(stderr, "ERROR: NULL vector in vec_push\n");
        exit(1);
    }

    // Look for a vector that starts receiving value 50 after pushes start
    // (This is the crash vector pattern)
    if (target_vec == NULL && (long)item == 50 && vec->length == 0 && push_count > 50) {
        target_vec = vec;
        fprintf(stderr, "[TARGET_VEC] Found crash vector at %p (push #%d)\n", (void*)vec, push_count);
    }

    // Track all pushes to the target vector
    if (vec == target_vec) {
        fprintf(stderr, "[TARGET] Push #%d: value=%ld to vec=%p len=%zu\n",
                push_count, (long)item, (void*)vec, vec->length);
    }

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
static int vec_len_calls = 0;
uint32_t builtin_vec_len(MycelialVector* vec) {
    vec_len_calls++;
    if (!vec) {
        fprintf(stderr, "ERROR: NULL vector in vec_len (call #%d)\n", vec_len_calls);
        void* retaddr = __builtin_return_address(0);
        fprintf(stderr, "  Return address: %p\n", retaddr);
        fflush(stderr);
        exit(1);
    }
    return (uint32_t)vec->length;
}

/**
 * vec_get(vec: vec<T>, index: u32) -> T
 * Get element at index
 */
static int vec_get_count = 0;
void* builtin_vec_get(MycelialVector* vec, uint32_t index) {
    vec_get_count++;
    if (!vec) {
        fprintf(stderr, "ERROR: NULL vector in vec_get (call #%d)\n", vec_get_count);
        void* retaddr = __builtin_return_address(0);
        fprintf(stderr, "  Return address: %p\n", retaddr);
        // Print r12 value (agent state base) for debugging
        register void* r12_val __asm__("r12");
        fprintf(stderr, "  r12 (agent state): %p\n", r12_val);
        fprintf(stderr, "  [r12+0]: %p\n", *(void**)r12_val);
        fprintf(stderr, "  [r12+8]: %p\n", *((void**)r12_val + 1));
        fprintf(stderr, "  [r12+16]: %p\n", *((void**)r12_val + 2));
        fprintf(stderr, "  [r12+24]: %p\n", *((void**)r12_val + 3));
        fprintf(stderr, "  [r12+32]: %p\n", *((void**)r12_val + 4));
        fflush(stderr);
        exit(1);
    }

    if (index >= vec->length) {
        fprintf(stderr, "ERROR: Vector index out of bounds: %u >= %zu\n",
                index, vec->length);
        exit(1);
    }
    void* result = vec->data[index];
    return result;
}

/**
 * vec_set(vec: vec<T>, index: u32, value: T)
 * Set element at index
 */
void builtin_vec_set(MycelialVector* vec, uint32_t index, void* value) {
    if (!vec) {
        fprintf(stderr, "ERROR: NULL vector in vec_set\n");
        exit(1);
    }
    if (index >= vec->length) {
        fprintf(stderr, "ERROR: Vector index out of bounds: %u >= %zu\n",
                index, vec->length);
        exit(1);
    }
    vec->data[index] = value;
}

/**
 * vec_from(items: ..., NULL) -> vec<T>
 * Create vector from variadic arguments, terminated by NULL sentinel.
 * The compiler must add NULL as the final argument.
 */
MycelialVector* builtin_vec_from(void* first, ...) {
    MycelialVector* vec = builtin_vec_new();

    // Handle empty case
    if (first == NULL) {
        return vec;
    }

    // Add first element
    builtin_vec_push(vec, first);

    // Iterate through remaining arguments until NULL sentinel
    va_list args;
    va_start(args, first);
    void* item;
    while ((item = va_arg(args, void*)) != NULL) {
        builtin_vec_push(vec, item);
    }
    va_end(args);

    return vec;
}

/**
 * vec_contains(vec: vec<T>, item: T) -> bool
 * Check if vector contains item (pointer equality)
 */
bool builtin_vec_contains(MycelialVector* vec, void* item) {
    if (!vec) {
        fprintf(stderr, "ERROR: NULL vector in vec_contains\n");
        exit(1);
    }
    for (size_t i = 0; i < vec->length; i++) {
        if (vec->data[i] == item) {
            return true;
        }
    }
    return false;
}

/**
 * vec_remove(vec: vec<T>, index: u32)
 * Remove element at index
 */
void builtin_vec_remove(MycelialVector* vec, uint32_t index) {
    if (!vec) {
        fprintf(stderr, "ERROR: NULL vector in vec_remove\n");
        exit(1);
    }
    if (index >= vec->length) {
        fprintf(stderr, "ERROR: Vector index out of bounds: %u >= %zu\n",
                index, vec->length);
        exit(1);
    }

    // Shift elements left
    for (size_t i = index; i < vec->length - 1; i++) {
        vec->data[i] = vec->data[i + 1];
    }
    vec->length--;
}

/**
 * vec_reverse(vec: vec<T>) -> vec<T>
 * Reverse vector (creates new vector)
 */
MycelialVector* builtin_vec_reverse(MycelialVector* vec) {
    if (!vec) {
        fprintf(stderr, "ERROR: NULL vector in vec_reverse\n");
        exit(1);
    }
    MycelialVector* result = builtin_vec_new();

    // Add elements in reverse order
    for (int i = vec->length - 1; i >= 0; i--) {
        builtin_vec_push(result, vec->data[i]);
    }

    return result;
}

/**
 * vec_index_of(vec: vec<T>, item: T) -> i32
 * Find index of item (-1 if not found)
 */
int32_t builtin_vec_index_of(MycelialVector* vec, void* item) {
    if (!vec) {
        fprintf(stderr, "ERROR: NULL vector in vec_index_of\n");
        exit(1);
    }
    for (size_t i = 0; i < vec->length; i++) {
        if (vec->data[i] == item) {
            return (int32_t)i;
        }
    }
    return -1;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAP OPERATIONS (4 functions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * map_new() -> map<K, V>
 * Create a new empty map
 */
MycelialMap* builtin_map_new(void) {
    MycelialMap* map = malloc(sizeof(MycelialMap));
    map->keys = builtin_vec_new();
    map->values = builtin_vec_new();
    return map;
}

/**
 * map_set(map: map<K, V>, key: K, value: V)
 * Set key-value pair
 */
void builtin_map_set(MycelialMap* map, void* key, void* value) {
    if (!map) {
        fprintf(stderr, "ERROR: NULL map in map_set\n");
        exit(1);
    }
    // Check if key already exists (simple linear search for strings)
    for (size_t i = 0; i < map->keys->length; i++) {
        char* existing_key = (char*)map->keys->data[i];
        char* new_key = (char*)key;

        // If both are strings, compare them
        if (strcmp(existing_key, new_key) == 0) {
            // Key exists, update value
            map->values->data[i] = value;
            return;
        }
    }

    // Key doesn't exist, add new entry
    builtin_vec_push(map->keys, key);
    builtin_vec_push(map->values, value);
}

/**
 * map_get(map: map<K, V>, key: K) -> V
 * Get value by key
 */
static int map_get_count = 0;
void* builtin_map_get(MycelialMap* map, void* key) {
    map_get_count++;
    if (!map) {
        fprintf(stderr, "ERROR: NULL map in map_get (call #%d)\n", map_get_count);
        exit(1);
    }
    for (size_t i = 0; i < map->keys->length; i++) {
        char* existing_key = (char*)map->keys->data[i];
        char* search_key = (char*)key;

        if (strcmp(existing_key, search_key) == 0) {
            void* result = map->values->data[i];
            // Trace map_get around potential crash point
            if (map_get_count >= 450 && map_get_count <= 480) {
                fprintf(stderr, "[MAP_GET] #%d key='%s' value=%p\n",
                        map_get_count, search_key, result);
                fflush(stderr);
            }
            return result;
        }
    }

    // Key not found - return NULL
    if (map_get_count >= 450 && map_get_count <= 480) {
        fprintf(stderr, "[MAP_GET] #%d key='%s' NOT FOUND\n",
                map_get_count, (char*)key);
        fflush(stderr);
    }
    return NULL;
}

/**
 * map_has(map: map<K, V>, key: K) -> bool
 * Check if key exists
 */
bool builtin_map_has(MycelialMap* map, void* key) {
    if (!map) {
        fprintf(stderr, "ERROR: NULL map in map_has\n");
        exit(1);
    }
    for (size_t i = 0; i < map->keys->length; i++) {
        char* existing_key = (char*)map->keys->data[i];
        char* search_key = (char*)key;

        if (strcmp(existing_key, search_key) == 0) {
            return true;
        }
    }
    return false;
}

/**
 * map_keys(map: map<K, V>) -> vec<K>
 * Get all keys as a vector
 */
MycelialVector* builtin_map_keys(MycelialMap* map) {
    if (!map) {
        fprintf(stderr, "ERROR: NULL map in map_keys\n");
        exit(1);
    }
    // Return a reference to the keys vector
    return map->keys;
}

/**
 * map_len(map: map<K, V>) -> u32
 * Get number of entries
 */
uint32_t builtin_map_len(MycelialMap* map) {
    if (!map) {
        fprintf(stderr, "ERROR: NULL map in map_len\n");
        exit(1);
    }
    return (uint32_t)map->keys->length;
}

/**
 * map_clear(map: map<K, V>)
 * Remove all entries
 */
void builtin_map_clear(MycelialMap* map) {
    if (!map) {
        fprintf(stderr, "ERROR: NULL map in map_clear\n");
        exit(1);
    }
    map->keys->length = 0;
    map->values->length = 0;
}

/**
 * map_contains_key(map: map<K, V>, key: K) -> bool
 * Alias for map_has
 */
bool builtin_map_contains_key(MycelialMap* map, void* key) {
    return builtin_map_has(map, key);
}

/**
 * map_values(map: map<K, V>) -> vec<V>
 * Get all values as a vector
 */
MycelialVector* builtin_map_values(MycelialMap* map) {
    if (!map) {
        fprintf(stderr, "ERROR: NULL map in map_values\n");
        exit(1);
    }
    return map->values;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRING OPERATIONS (13 functions)
// ═══════════════════════════════════════════════════════════════════════════

// Forward declaration (defined later, used by builtin_char_at)
char* builtin_string_char_at(const char* s, uint32_t index);

/**
 * string_len(s: string) -> u32
 * Get string length
 */
uint32_t builtin_string_len(const char* s) {
    if (!s) return 0;
    return (uint32_t)strlen(s);
}

/**
 * char_at(s: string, index: u32) -> string
 * Get character at index as a single-character string
 * (Same behavior as string_char_at for compatibility with bootstrap compiler)
 */
char* builtin_char_at(const char* s, uint32_t index) {
    // Use the same implementation as string_char_at
    return builtin_string_char_at(s, index);
}

/**
 * format(fmt: string, ...) -> string
 * Format string with {} placeholders (Mycelial-style)
 * Each {} is replaced with the next argument (string or integer)
 */
char* builtin_format(const char* fmt, ...) {
    va_list args;
    va_start(args, fmt);

    // Handle NULL format string
    if (!fmt) {
        char* result = malloc(1);
        result[0] = '\0';
        va_end(args);
        return result;
    }

    // Allocate buffer
    size_t fmt_len = strlen(fmt);
    size_t buf_size = fmt_len * 4 + 256;
    char* result = malloc(buf_size);
    if (!result) {
        va_end(args);
        return strdup("(format error)");
    }

    char* write_ptr = result;
    const char* read_ptr = fmt;
    int arg_count = 0;
    const int max_args = 5;

    while (*read_ptr && (size_t)(write_ptr - result) < buf_size - 64) {
        // Check for {:X} hex format placeholder
        if (read_ptr[0] == '{' && read_ptr[1] == ':' && read_ptr[2] == 'X' && read_ptr[3] == '}') {
            if (arg_count < max_args) {
                uint64_t arg = va_arg(args, uint64_t);
                char num_buf[32];
                int num_len = snprintf(num_buf, sizeof(num_buf), "%lX", (unsigned long)arg);
                memcpy(write_ptr, num_buf, num_len);
                write_ptr += num_len;
                arg_count++;
            }
            read_ptr += 4;
        }
        // Check for {:x} lowercase hex format placeholder
        else if (read_ptr[0] == '{' && read_ptr[1] == ':' && read_ptr[2] == 'x' && read_ptr[3] == '}') {
            if (arg_count < max_args) {
                uint64_t arg = va_arg(args, uint64_t);
                char num_buf[32];
                int num_len = snprintf(num_buf, sizeof(num_buf), "%lx", (unsigned long)arg);
                memcpy(write_ptr, num_buf, num_len);
                write_ptr += num_len;
                arg_count++;
            }
            read_ptr += 4;
        }
        // Check for {} placeholder
        else if (read_ptr[0] == '{' && read_ptr[1] == '}') {
            if (arg_count < max_args) {
                uint64_t arg = va_arg(args, uint64_t);
                char num_buf[32];
                int num_len;

                // Simple heuristic: if in valid pointer range AND first byte is printable
                if (arg >= 0x10000 && arg < 0x800000000000ULL) {
                    const char* maybe_str = (const char*)arg;
                    // Check if first byte looks like start of a string
                    unsigned char first = *((unsigned char*)maybe_str);
                    if (first >= 32 && first < 127) {
                        // Likely a string - copy up to 256 chars
                        size_t i = 0;
                        while (maybe_str[i] && i < 256 &&
                               (size_t)(write_ptr - result + i) < buf_size - 2) {
                            write_ptr[i] = maybe_str[i];
                            i++;
                        }
                        write_ptr += i;
                        arg_count++;
                        read_ptr += 2;
                        continue;
                    }
                }
                // Treat as integer
                num_len = snprintf(num_buf, sizeof(num_buf), "%lu", (unsigned long)arg);
                memcpy(write_ptr, num_buf, num_len);
                write_ptr += num_len;
                arg_count++;
            }
            read_ptr += 2;
        } else {
            *write_ptr++ = *read_ptr++;
        }
    }

    *write_ptr = '\0';
    va_end(args);
    return result;
}

/**
 * string_slice(s: string, start: u32, end: u32) -> string
 * Extract substring from start to end (exclusive)
 */
char* builtin_string_slice(const char* s, uint32_t start, uint32_t end) {
    size_t len = strlen(s);

    // Clamp indices
    if (start > len) start = len;
    if (end > len) end = len;
    if (end < start) end = start;

    size_t slice_len = end - start;
    char* result = malloc(slice_len + 1);
    memcpy(result, s + start, slice_len);
    result[slice_len] = '\0';

    return result;
}

/**
 * string_trim(s: string) -> string
 * Remove leading and trailing whitespace
 */
char* builtin_string_trim(const char* s) {
    // Find first non-whitespace
    while (*s && isspace(*s)) {
        s++;
    }

    if (*s == '\0') {
        // String was all whitespace
        char* result = malloc(1);
        result[0] = '\0';
        return result;
    }

    // Find last non-whitespace
    const char* end = s + strlen(s) - 1;
    while (end > s && isspace(*end)) {
        end--;
    }

    // Allocate and copy
    size_t len = end - s + 1;
    char* result = malloc(len + 1);
    memcpy(result, s, len);
    result[len] = '\0';

    return result;
}

/**
 * string_lower(s: string) -> string
 * Convert to lowercase
 */
char* builtin_string_lower(const char* s) {
    size_t len = strlen(s);
    char* result = malloc(len + 1);

    for (size_t i = 0; i < len; i++) {
        result[i] = tolower(s[i]);
    }
    result[len] = '\0';

    return result;
}

/**
 * string_upper(s: string) -> string
 * Convert to uppercase
 */
char* builtin_string_upper(const char* s) {
    size_t len = strlen(s);
    char* result = malloc(len + 1);

    for (size_t i = 0; i < len; i++) {
        result[i] = toupper(s[i]);
    }
    result[len] = '\0';

    return result;
}

/**
 * char_to_string(ch: u8) -> string
 * Convert a single character (u8) to a string
 */
char* builtin_char_to_string(uint8_t ch) {
    char* result = malloc(2);
    if (!result) {
        fprintf(stderr, "ERROR: Out of memory in char_to_string\n");
        exit(1);
    }
    result[0] = (char)ch;
    result[1] = '\0';
    return result;
}

/**
 * string_concat(s1: string, s2: string) -> string
 * Concatenate two strings
 * SPECIAL HANDLING: If arguments are u8 character values (< 256),
 * automatically converts them to strings
 */
char* builtin_string_concat(const char* s1, const char* s2) {
    // HACK: Detect if "pointers" are actually u8 character values
    // If the pointer value is < 4096 (typical page size), treat as u8
    const uintptr_t CHAR_THRESHOLD = 4096;

    char char_buf1[2] = {0, 0};
    char char_buf2[2] = {0, 0};

    // Check if s1 is actually a u8 character value
    if ((uintptr_t)s1 < CHAR_THRESHOLD) {
        char_buf1[0] = (char)(uintptr_t)s1;
        s1 = char_buf1;
    } else if (!s1) {
        s1 = "";
    }

    // Check if s2 is actually a u8 character value
    if ((uintptr_t)s2 < CHAR_THRESHOLD) {
        char_buf2[0] = (char)(uintptr_t)s2;
        s2 = char_buf2;
    } else if (!s2) {
        s2 = "";
    }

    size_t len1 = strlen(s1);
    size_t len2 = strlen(s2);
    char* result = malloc(len1 + len2 + 1);

    if (!result) {
        fprintf(stderr, "ERROR: Out of memory in string_concat\n");
        exit(1);
    }

    memcpy(result, s1, len1);
    memcpy(result + len1, s2, len2);
    result[len1 + len2] = '\0';

    return result;
}

/**
 * starts_with(s: string, prefix: string) -> bool
 * Check if string starts with prefix
 */
bool builtin_starts_with(const char* s, const char* prefix) {
    if (!s || !prefix) return false;
    size_t prefix_len = strlen(prefix);
    return strncmp(s, prefix, prefix_len) == 0;
}

/**
 * ends_with(s: string, suffix: string) -> bool
 * Check if string ends with suffix
 */
bool builtin_ends_with(const char* s, const char* suffix) {
    size_t s_len = strlen(s);
    size_t suffix_len = strlen(suffix);

    if (suffix_len > s_len) {
        return false;
    }

    return strcmp(s + (s_len - suffix_len), suffix) == 0;
}

/**
 * contains(s: string, substring: string) -> bool
 * Check if string contains substring
 */
bool builtin_contains(const char* s, const char* substring) {
    if (!s || !substring) return false;
    return strstr(s, substring) != NULL;
}

/**
 * string_index_of(s: string, substring: string) -> i32
 * Find index of first occurrence of substring (-1 if not found)
 */
int32_t builtin_string_index_of(const char* s, const char* substring) {
    const char* pos = strstr(s, substring);
    if (pos == NULL) {
        return -1;
    }
    return (int32_t)(pos - s);
}

/**
 * string_split(s: string, delimiter: string) -> vec<string>
 * Split string by delimiter
 */
MycelialVector* builtin_string_split(const char* s, const char* delimiter) {
    MycelialVector* result = builtin_vec_new();

    if (strlen(delimiter) == 0) {
        // Empty delimiter - split into characters
        size_t len = strlen(s);
        for (size_t i = 0; i < len; i++) {
            char* ch = malloc(2);
            ch[0] = s[i];
            ch[1] = '\0';
            builtin_vec_push(result, ch);
        }
        return result;
    }

    // Make a copy we can modify
    char* copy = strdup(s);
    char* token = strtok(copy, delimiter);

    while (token != NULL) {
        builtin_vec_push(result, strdup(token));
        token = strtok(NULL, delimiter);
    }

    free(copy);
    return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSING OPERATIONS (4 functions)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * parse_u8(s: string) -> u8
 * Parse string to unsigned 8-bit integer
 */
uint8_t builtin_parse_u8(const char* s) {
    long value = strtol(s, NULL, 10);
    if (value < 0 || value > 255) {
        fprintf(stderr, "ERROR: parse_u8: value out of range: %ld\n", value);
        exit(1);
    }
    return (uint8_t)value;
}

/**
 * parse_u32(s: string) -> u32
 * Parse string to unsigned 32-bit integer
 */
uint32_t builtin_parse_u32(const char* s) {
    return (uint32_t)strtoul(s, NULL, 10);
}

/**
 * parse_i32(s: string) -> i32
 * Parse string to signed 32-bit integer
 */
int32_t builtin_parse_i32(const char* s) {
    return (int32_t)strtol(s, NULL, 10);
}

/**
 * parse_hex(s: string) -> u64
 * Parse hexadecimal string to unsigned 64-bit integer
 */
uint64_t builtin_parse_hex(const char* s) {
    // Skip 0x prefix if present
    if (s[0] == '0' && (s[1] == 'x' || s[1] == 'X')) {
        s += 2;
    }
    return (uint64_t)strtoull(s, NULL, 16);
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
    printf("%s", s);
    fflush(stdout);
}

/**
 * exit_with_code(code: u32)
 * Exit with status code
 */
void builtin_exit(uint32_t code) {
    exit((int)code);
}

/**
 * is_numeric(s: string) -> bool
 * Check if string is a valid number
 */
bool builtin_is_numeric(const char* s) {
    if (s == NULL || *s == '\0') {
        return false;
    }

    // Skip leading whitespace
    while (isspace(*s)) s++;

    // Check for sign
    if (*s == '+' || *s == '-') s++;

    // Must have at least one digit
    if (!isdigit(*s)) {
        return false;
    }

    // Check all characters are digits
    while (*s) {
        if (!isdigit(*s) && *s != '.') {
            return false;
        }
        s++;
    }

    return true;
}

/**
 * string_eq(s1: string, s2: string) -> bool
 * String equality comparison
 */
// Return type is int (not bool) to ensure GCC generates proper 32-bit return values
// With bool, GCC only sets AL and leaves upper bits of RAX with garbage
int builtin_string_eq(const char* s1, const char* s2) {
    // Handle NULL strings
    if (!s1 || !s2) {
        return (s1 == s2) ? 1 : 0;
    }

    // Fast path for single-character strings (very common in lexer)
    // Compare first character directly - use unsigned char to avoid sign issues
    unsigned char c1 = (unsigned char)s1[0];
    unsigned char c2 = (unsigned char)s2[0];
    if (c1 != c2) {
        return 0;
    }
    // If both are single-char strings, first char match is enough
    if (s1[1] == '\0' && s2[1] == '\0') {
        return 1;
    }
    // Full comparison for longer strings
    int cmp_result = strcmp(s1, s2);
    return (cmp_result == 0) ? 1 : 0;
}

/**
 * string_cmp(s1: string, s2: string) -> i64
 * Compare two strings, returns <0, 0, or >0 like strcmp
 */
int64_t builtin_string_cmp(const char* s1, const char* s2) {
    if (!s1 && !s2) return 0;
    if (!s1) return -1;
    if (!s2) return 1;
    return (int64_t)strcmp(s1, s2);
}

/**
 * parse_i64(s: string) -> i64
 * Parse 64-bit signed integer
 */
int64_t builtin_parse_i64(const char* s) {
    return (int64_t)strtoll(s, NULL, 10);
}

/**
 * heap_alloc(size: u64) -> *void
 * Allocate memory from heap (using malloc)
 */
void* builtin_heap_alloc(uint64_t size) {
    static int alloc_count = 0;
    alloc_count++;
    void* ptr = malloc((size_t)size);
    if (!ptr) {
        fprintf(stderr, "ERROR: Out of memory (failed to allocate %lu bytes)\n",
                (unsigned long)size);
        exit(1);
    }
    // Trace RegisterInfo (11 bytes) and Operand enum (16 bytes) allocations
    if ((size == 11 || size == 16) && alloc_count >= 500 && alloc_count <= 520) {
        fprintf(stderr, "[ALLOC] #%d size=%lu ptr=%p\n", alloc_count, (unsigned long)size, ptr);
        fflush(stderr);
    }
    return ptr;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALIASES AND ADDITIONAL BUILTINS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * vec_clear(vec: vec<T>)
 * Clear all elements from vector
 */
void builtin_vec_clear(MycelialVector* vec) {
    if (!vec) {
        fprintf(stderr, "ERROR: NULL vector in vec_clear\n");
        exit(1);
    }
    vec->length = 0;
}

/**
 * map_insert(map: map<K, V>, key: K, value: V)
 * Alias for map_set
 */
void builtin_map_insert(MycelialMap* map, void* key, void* value) {
    builtin_map_set(map, key, value);
}

/**
 * map_contains(map: map<K, V>, key: K) -> bool
 * Alias for map_has
 */
bool builtin_map_contains(MycelialMap* map, void* key) {
    return builtin_map_has(map, key);
}

/**
 * string_char_at(s: string, index: u32) -> string
 * Returns single character at index as a string
 */
char* builtin_string_char_at(const char* s, uint32_t index) {
    // Fast path: check for null terminator at index to avoid strlen
    if (!s) {
        static char empty[1] = "";
        return empty;
    }
    // Quick bounds check without strlen - just read the char
    // If index is before the null terminator, we're good
    // We can't detect out of bounds without strlen, but for valid indices this is much faster
    char c = s[index];
    if (c == '\0') {
        // Either at end of string or beyond - return empty
        static char empty[1] = "";
        return empty;
    }
    // Use a small pool of static buffers to avoid heap allocation
    static char pool[256][2];
    static int pool_idx = 0;
    char* result = pool[pool_idx];
    pool_idx = (pool_idx + 1) % 256;
    result[0] = c;
    result[1] = '\0';
    return result;
}

/**
 * string_contains(s: string, substring: string) -> bool
 * Alias for contains
 */
bool builtin_string_contains(const char* s, const char* substring) {
    return builtin_contains(s, substring);
}

/**
 * parse_f64(s: string) -> f64
 * Parse 64-bit floating point number
 */
double builtin_parse_f64(const char* s) {
    return strtod(s, NULL);
}

/**
 * println(s: string)
 * Print string with newline
 */
void builtin_println(const char* s) {
    printf("%s\n", s);
    fflush(stdout);
}

/**
 * time_now() -> u64
 * Get current Unix timestamp in milliseconds
 */
uint64_t builtin_time_now(void) {
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    return (uint64_t)ts.tv_sec * 1000 + (uint64_t)ts.tv_nsec / 1000000;
}

/**
 * read_file(path: string) -> string
 * Read file as null-terminated string
 */
char* builtin_read_file(const char* path) {
    FILE* f = fopen(path, "rb");
    if (!f) {
        fprintf(stderr, "ERROR: Cannot open file for reading: %s\n", path);
        // Return empty string instead of exiting
        char* empty = (char*)builtin_heap_alloc(1);
        empty[0] = '\0';
        return empty;
    }

    // Get file size
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);

    // Allocate buffer with null terminator
    char* buffer = (char*)builtin_heap_alloc(size + 1);
    if (!buffer) {
        fclose(f);
        char* empty = (char*)builtin_heap_alloc(1);
        empty[0] = '\0';
        return empty;
    }

    // Read file contents
    size_t bytes_read = fread(buffer, 1, size, f);
    buffer[bytes_read] = '\0';  // Null terminate

    fclose(f);
    return buffer;
}

/**
 * map_get_or_default(map: map<K, V>, key: K, default: V) -> V
 * Get value by key, or return default if not found
 */
void* builtin_map_get_or_default(MycelialMap* map, void* key, void* default_value) {
    void* value = builtin_map_get(map, key);
    return value ? value : default_value;
}

/**
 * hex_decode(s: string) -> u8
 * Decode 2-character hex string to byte
 */
uint8_t builtin_hex_decode(const char* s) {
    uint8_t result = 0;
    for (int i = 0; i < 2 && s[i]; i++) {
        result <<= 4;
        char c = s[i];
        if (c >= '0' && c <= '9') {
            result |= (c - '0');
        } else if (c >= 'a' && c <= 'f') {
            result |= (c - 'a' + 10);
        } else if (c >= 'A' && c <= 'F') {
            result |= (c - 'A' + 10);
        }
    }
    return result;
}

/**
 * json_encode(value: any) -> string
 * Simplified JSON encoding (just returns value as string for now)
 */
char* builtin_json_encode(void* value) {
    // Simplified: treat value as a number and convert to string
    // Real implementation would need type information
    char* buf = malloc(64);
    snprintf(buf, 64, "%lu", (unsigned long)(uintptr_t)value);
    return buf;
}

// ═══════════════════════════════════════════════════════════════════════════
// GEN1 RUNTIME SUPPORT
// These functions are called by the Gen1 self-hosted compiler's generated code
// ═══════════════════════════════════════════════════════════════════════════

// Global variables used by Gen1 generated code
int64_t num_agents = 0;
void* global_registry = NULL;
void* global_routing_table = NULL;
void* global_scheduler = NULL;

// Heap arena (64KB)
static char heap_arena[65536];
static char* heap_ptr = NULL;
static char* heap_end = NULL;

/**
 * heap_init() - Initialize the heap allocator
 */
void heap_init(void) {
    heap_ptr = heap_arena;
    heap_end = heap_arena + sizeof(heap_arena);
    // fprintf(stderr, "[runtime] heap_init: arena at %p, size 64KB\n", (void*)heap_arena);
}

/**
 * registry_create(num_agents: i64) -> ptr
 * Create an agent registry for the given number of agents
 */
void* registry_create(int64_t count) {
    num_agents = count;
    // Allocate space for agent pointers
    void** registry = (void**)malloc(count * sizeof(void*));
    memset(registry, 0, count * sizeof(void*));
    // fprintf(stderr, "[runtime] registry_create: %ld agents\n", count);
    return registry;
}

/**
 * init_agents() - Initialize all agents (stub - real init done by generated code)
 * The Gen1 compiler should generate this function, but we provide a fallback stub
 */
void init_agents(void) {
    // fprintf(stderr, "[runtime] init_agents: stub (agents should be initialized by generated code)\n");
}

/**
 * init_routing_tables() - Initialize routing tables (stub)
 * The Gen1 compiler should generate this function, but we provide a fallback stub
 */
void init_routing_tables(void) {
    // fprintf(stderr, "[runtime] init_routing_tables: stub\n");
}

// Simple scheduler structure
typedef struct {
    void* registry;
    void* routing_table;
    int running;
    int cycle_count;
} Scheduler;

/**
 * scheduler_create(registry: ptr, routing_table: ptr) -> ptr
 * Create a new scheduler instance
 */
void* scheduler_create(void* registry, void* routing_table) {
    Scheduler* sched = (Scheduler*)malloc(sizeof(Scheduler));
    sched->registry = registry;
    sched->routing_table = routing_table;
    sched->running = 0;
    sched->cycle_count = 0;
    // fprintf(stderr, "[runtime] scheduler_create: registry=%p, routing=%p\n", registry, routing_table);
    return sched;
}

/**
 * scheduler_run(scheduler: ptr) - Run the scheduler main loop
 * This is a stub that just reports success - real scheduling done by generated tidal_cycle_loop
 */
void scheduler_run(void* scheduler_ptr) {
    Scheduler* sched = (Scheduler*)scheduler_ptr;
    if (!sched) return;

    sched->running = 1;
    // fprintf(stderr, "[runtime] scheduler_run: starting main loop\n");

    // The actual main loop is expected to be in tidal_cycle_loop generated code
    // This stub just marks the scheduler as having run
    sched->cycle_count = 1;
    sched->running = 0;

    // fprintf(stderr, "[runtime] scheduler_run: completed\n");
}

/**
 * scheduler_destroy(scheduler: ptr) - Clean up scheduler resources
 */
void scheduler_destroy(void* scheduler_ptr) {
    Scheduler* sched = (Scheduler*)scheduler_ptr;
    if (sched) {
        // fprintf(stderr, "[runtime] scheduler_destroy: freeing scheduler\n");
        free(sched);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG INFO
// ═══════════════════════════════════════════════════════════════════════════

void __mycelial_runtime_init(void) {
    fprintf(stderr, "🍄 Mycelial Complete Runtime Initialized\n");
    fprintf(stderr, "   30+ builtins loaded:\n");
    fprintf(stderr, "     • Vector ops: new, push, len, get, set\n");
    fprintf(stderr, "     • Map ops: new, set, get, has, keys, len\n");
    fprintf(stderr, "     • String ops: len, slice, trim, lower, upper, concat\n");
    fprintf(stderr, "     • String search: starts_with, ends_with, contains, index_of, split\n");
    fprintf(stderr, "     • Parsing: parse_u8, parse_u32, parse_i32, parse_hex\n");
    fprintf(stderr, "     • I/O: write_file, chmod, print, format\n");
    fprintf(stderr, "   Ready for Gen1 self-hosting\n");
    fprintf(stderr, "   Built different. 🔥\n\n");
}

// Auto-initialize on load
__attribute__((constructor))
void mycelial_init(void) {
    __mycelial_runtime_init();
}
