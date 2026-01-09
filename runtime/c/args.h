/*
 * Command-Line Argument Parsing
 * M3 Phase 1b - Mycelial Compiler Bootstrap
 *
 * Provides functions to parse command-line arguments for the compiled
 * Mycelial compiler. Enables the compiler to accept --input, --output,
 * and other options when run as a native binary.
 */

#ifndef MYCELIAL_ARGS_H
#define MYCELIAL_ARGS_H

#include <stdint.h>

/* =============================================================================
 * GLOBAL ARGC/ARGV
 * ============================================================================= */

/*
 * Global argc and argv set by entry point (_start)
 * These are populated from the OS when the program starts
 */
extern int argc;
extern char** argv;

/* =============================================================================
 * ARGUMENT PARSING FUNCTIONS
 * ============================================================================= */

/*
 * Get the value for a named option
 *
 * Example:
 *   ./compiler --input file.txt --output binary
 *   args_get_option("input") returns "file.txt"
 *   args_get_option("output") returns "binary"
 *
 * @param name: Option name (without the -- prefix)
 * @return: Pointer to option value string, or NULL if not found
 */
char* args_get_option(const char* name);

/*
 * Check if a named option exists
 *
 * Example:
 *   ./compiler --verbose --input file.txt
 *   args_has_option("verbose") returns 1
 *   args_has_option("quiet") returns 0
 *
 * @param name: Option name (without the -- prefix)
 * @return: 1 if option exists, 0 otherwise
 */
int args_has_option(const char* name);

/*
 * Get a positional argument by index
 *
 * Positional arguments are non-option arguments (don't start with --)
 *
 * Example:
 *   ./compiler input.txt output.bin
 *   args_get_positional(0) returns "input.txt"
 *   args_get_positional(1) returns "output.bin"
 *
 * @param index: Zero-based index of positional argument
 * @return: Pointer to argument string, or NULL if index out of bounds
 */
char* args_get_positional(int index);

/*
 * Get the program name (argv[0])
 *
 * @return: Pointer to program name string
 */
char* args_get_program_name(void);

/*
 * Print usage/help message
 *
 * Displays standard help text for the compiler
 */
void args_print_usage(void);

/* =============================================================================
 * STRING UTILITIES
 * ============================================================================= */

/*
 * Compare two strings
 *
 * @param s1: First string
 * @param s2: Second string
 * @return: 0 if equal, negative if s1 < s2, positive if s1 > s2
 */
int mycelial_strcmp(const char* s1, const char* s2);

/*
 * Get length of a string
 *
 * @param s: String to measure
 * @return: Length of string (not including null terminator)
 */
uint32_t mycelial_strlen(const char* s);

/*
 * Check if string starts with prefix
 *
 * @param str: String to check
 * @param prefix: Prefix to look for
 * @return: 1 if str starts with prefix, 0 otherwise
 */
int mycelial_starts_with(const char* str, const char* prefix);

#endif /* MYCELIAL_ARGS_H */
