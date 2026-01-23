/*
 * Mycelial Complete Builtin Runtime - Header
 *
 * Function declarations for ALL builtins (~30 functions).
 */

#ifndef MYCELIAL_COMPLETE_BUILTINS_H
#define MYCELIAL_COMPLETE_BUILTINS_H

#include <stdint.h>
#include <stdbool.h>

// Forward declarations
typedef struct MycelialVector MycelialVector;
typedef struct MycelialMap MycelialMap;

// Vector operations
MycelialVector* builtin_vec_new(void);
void builtin_vec_push(MycelialVector* vec, void* item);
uint32_t builtin_vec_len(MycelialVector* vec);
void* builtin_vec_get(MycelialVector* vec, uint32_t index);
void builtin_vec_set(MycelialVector* vec, uint32_t index, void* value);
MycelialVector* builtin_vec_from(void* first, ...);
bool builtin_vec_contains(MycelialVector* vec, void* item);
void builtin_vec_remove(MycelialVector* vec, uint32_t index);
MycelialVector* builtin_vec_reverse(MycelialVector* vec);
int32_t builtin_vec_index_of(MycelialVector* vec, void* item);
void builtin_vec_clear(MycelialVector* vec);

// Map operations
MycelialMap* builtin_map_new(void);
void builtin_map_set(MycelialMap* map, void* key, void* value);
void builtin_map_insert(MycelialMap* map, void* key, void* value);  // Alias for set
void* builtin_map_get(MycelialMap* map, void* key);
void* builtin_map_get_or_default(MycelialMap* map, void* key, void* default_value);
bool builtin_map_has(MycelialMap* map, void* key);
bool builtin_map_contains(MycelialMap* map, void* key);  // Alias for has
MycelialVector* builtin_map_keys(MycelialMap* map);
uint32_t builtin_map_len(MycelialMap* map);
void builtin_map_clear(MycelialMap* map);
bool builtin_map_contains_key(MycelialMap* map, void* key);
MycelialVector* builtin_map_values(MycelialMap* map);

// String operations
uint32_t builtin_string_len(const char* s);
char* builtin_char_at(const char* s, uint32_t index);
uint8_t builtin_char_code_at(const char* s, uint32_t index);
char* builtin_char_to_string(uint8_t ch);
char* builtin_string_char_at(const char* s, uint32_t index);  // Alias
char* builtin_format(const char* fmt, ...);
char* builtin_string_slice(const char* s, uint32_t start, uint32_t end);
char* builtin_string_trim(const char* s);
char* builtin_string_lower(const char* s);
char* builtin_string_upper(const char* s);
char* builtin_string_concat(const char* s1, const char* s2);
bool builtin_starts_with(const char* s, const char* prefix);
bool builtin_ends_with(const char* s, const char* suffix);
bool builtin_contains(const char* s, const char* substring);
bool builtin_string_contains(const char* s, const char* substring);  // Alias
int32_t builtin_string_index_of(const char* s, const char* substring);
MycelialVector* builtin_string_split(const char* s, const char* delimiter);
bool builtin_string_eq(const char* s1, const char* s2);

// Parsing operations
uint8_t builtin_parse_u8(const char* s);
uint32_t builtin_parse_u32(const char* s);
int32_t builtin_parse_i32(const char* s);
int64_t builtin_parse_i64(const char* s);
double builtin_parse_f64(const char* s);
uint64_t builtin_parse_hex(const char* s);
uint8_t builtin_hex_decode(const char* s);

// I/O operations
MycelialVector* builtin_read_file(const char* path);
void builtin_write_file(const char* path, MycelialVector* data);
void builtin_chmod(const char* path, uint32_t mode);

// Memory allocation
void* builtin_heap_alloc(uint64_t size);

// Encoding/Serialization
char* builtin_json_encode(void* value);

// Bonus helpers
void builtin_print(const char* s);
void builtin_println(const char* s);
void builtin_exit(uint32_t code);
bool builtin_is_numeric(const char* s);
uint64_t builtin_time_now(void);

#endif // MYCELIAL_COMPLETE_BUILTINS_H
