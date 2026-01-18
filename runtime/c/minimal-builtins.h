/*
 * Mycelial Minimal Builtin Runtime - Header
 *
 * Function declarations for the 10 core builtins.
 */

#ifndef MYCELIAL_MINIMAL_BUILTINS_H
#define MYCELIAL_MINIMAL_BUILTINS_H

#include <stdint.h>

// Forward declarations
typedef struct MycelialVector MycelialVector;

// Vector operations
MycelialVector* builtin_vec_new(void);
void builtin_vec_push(MycelialVector* vec, void* item);
uint32_t builtin_vec_len(MycelialVector* vec);
void* builtin_vec_get(MycelialVector* vec, uint32_t index);
void builtin_vec_set(MycelialVector* vec, uint32_t index, void* value);

// String operations
uint32_t builtin_string_len(const char* s);
uint8_t builtin_char_at(const char* s, uint32_t index);
char* builtin_format(const char* fmt, ...);

// I/O operations
void builtin_write_file(const char* path, MycelialVector* data);
void builtin_chmod(const char* path, uint32_t mode);

// Bonus helpers
void builtin_print(const char* s);
void builtin_exit(uint32_t code);

#endif // MYCELIAL_MINIMAL_BUILTINS_H
