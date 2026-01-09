/*
 * Command-Line Argument Parsing Implementation
 * M3 Phase 1b - Mycelial Compiler Bootstrap
 */

#include "args.h"
#include <stdint.h>
#include <stddef.h>

/* Global argc and argv (set by entry point) */
int argc = 0;
char** argv = NULL;

/* =============================================================================
 * STRING UTILITIES
 * ============================================================================= */

/*
 * Compare two strings
 *
 * Returns:
 *   0 if strings are equal
 *   < 0 if s1 < s2
 *   > 0 if s1 > s2
 */
int mycelial_strcmp(const char* s1, const char* s2) {
    if (s1 == NULL || s2 == NULL) {
        return (s1 == s2) ? 0 : (s1 == NULL ? -1 : 1);
    }

    while (*s1 && *s1 == *s2) {
        s1++;
        s2++;
    }

    return (unsigned char)*s1 - (unsigned char)*s2;
}

/*
 * Get length of string
 */
uint32_t mycelial_strlen(const char* s) {
    if (s == NULL) {
        return 0;
    }

    uint32_t len = 0;
    while (*s != '\0') {
        len++;
        s++;
    }
    return len;
}

/*
 * Check if string starts with prefix
 */
int mycelial_starts_with(const char* str, const char* prefix) {
    if (str == NULL || prefix == NULL) {
        return 0;
    }

    while (*prefix != '\0') {
        if (*str != *prefix) {
            return 0;
        }
        str++;
        prefix++;
    }

    return 1;
}

/* =============================================================================
 * ARGUMENT PARSING FUNCTIONS
 * ============================================================================= */

/*
 * Get the value for a named option
 *
 * Supports two formats:
 *   --name value    (separate arguments)
 *   --name=value    (single argument with =)
 */
char* args_get_option(const char* name) {
    if (name == NULL || argc == 0 || argv == NULL) {
        return NULL;
    }

    uint32_t name_len = mycelial_strlen(name);

    for (int i = 0; i < argc; i++) {
        char* arg = argv[i];

        /* Skip if not an option */
        if (arg[0] != '-' || arg[1] != '-') {
            continue;
        }

        /* Skip the "--" prefix */
        arg += 2;

        /* Check for --name=value format */
        int j = 0;
        while (arg[j] != '\0' && arg[j] != '=') {
            j++;
        }

        /* Compare the name part */
        if (j == name_len && mycelial_starts_with(arg, name)) {
            if (arg[j] == '=') {
                /* --name=value format */
                return arg + j + 1;
            } else if (arg[j] == '\0') {
                /* --name value format (value is next argument) */
                if (i + 1 < argc) {
                    return argv[i + 1];
                }
            }
        }
    }

    return NULL;
}

/*
 * Check if a named option exists
 *
 * Supports:
 *   --name          (flag without value)
 *   --name value    (option with value)
 *   --name=value    (option with = syntax)
 */
int args_has_option(const char* name) {
    if (name == NULL || argc == 0 || argv == NULL) {
        return 0;
    }

    uint32_t name_len = mycelial_strlen(name);

    for (int i = 0; i < argc; i++) {
        char* arg = argv[i];

        /* Skip if not an option */
        if (arg[0] != '-' || arg[1] != '-') {
            continue;
        }

        /* Skip the "--" prefix */
        arg += 2;

        /* Check for exact match or --name= */
        int j = 0;
        while (arg[j] != '\0' && arg[j] != '=') {
            j++;
        }

        if (j == name_len && mycelial_starts_with(arg, name)) {
            return 1;
        }
    }

    return 0;
}

/*
 * Get a positional argument by index
 *
 * Positional arguments are those that don't start with --
 * The program name (argv[0]) is NOT counted as a positional argument
 */
char* args_get_positional(int index) {
    if (index < 0 || argc == 0 || argv == NULL) {
        return NULL;
    }

    int pos_count = 0;

    /* Start from 1 to skip program name */
    for (int i = 1; i < argc; i++) {
        char* arg = argv[i];

        /* Check if this is an option */
        if (arg[0] == '-' && arg[1] == '-') {
            /* Check if option has value in --name=value format */
            int has_equals = 0;
            for (int j = 0; arg[j] != '\0'; j++) {
                if (arg[j] == '=') {
                    has_equals = 1;
                    break;
                }
            }

            /* If no equals sign, check if next argument looks like a value */
            if (!has_equals && i + 1 < argc) {
                char* next_arg = argv[i + 1];
                /* Only skip next arg if it doesn't look like an option */
                if (!(next_arg[0] == '-' && next_arg[1] == '-')) {
                    /* Skip the option and its value */
                    i++;
                }
            }
            continue;
        }

        /* This is a positional argument */
        if (pos_count == index) {
            return arg;
        }
        pos_count++;
    }

    return NULL;
}

/*
 * Get the program name (argv[0])
 */
char* args_get_program_name(void) {
    if (argc > 0 && argv != NULL) {
        return argv[0];
    }
    return "mycelial-compiler";
}

/*
 * Print usage/help message
 *
 * Uses syscall write() to output to stdout (fd 1)
 */
void args_print_usage(void) {
    const char* usage =
        "Mycelial Compiler - Bio-Inspired Programming Language\n"
        "\n"
        "USAGE:\n"
        "  mycelial-compiler [OPTIONS] [INPUT] [OUTPUT]\n"
        "\n"
        "OPTIONS:\n"
        "  --input <file>      Input .mycelial source file\n"
        "  --output <file>     Output binary file\n"
        "  --target <arch>     Target architecture (x86-64, arm64)\n"
        "  --verbose           Enable verbose output\n"
        "  --help              Show this help message\n"
        "\n"
        "EXAMPLES:\n"
        "  # Using named options:\n"
        "  mycelial-compiler --input hello.mycelial --output hello\n"
        "\n"
        "  # Using positional arguments:\n"
        "  mycelial-compiler hello.mycelial hello\n"
        "\n"
        "  # With target architecture:\n"
        "  mycelial-compiler --input prog.mycelial --output prog --target x86-64\n"
        "\n";

    /* Use syscall to write to stdout (fd 1) */
    uint32_t len = mycelial_strlen(usage);

    /* Inline assembly for write syscall */
    __asm__ __volatile__ (
        "mov $1, %%rax\n"      /* syscall number: write */
        "mov $1, %%rdi\n"      /* fd: stdout */
        "syscall\n"
        :
        : "S"(usage), "d"(len)
        : "rax", "rdi", "rcx", "r11", "memory"
    );
}

/* =============================================================================
 * ARGUMENT VALIDATION
 * ============================================================================= */

/*
 * Validate that required arguments are present
 *
 * @return: 0 if valid, 1 if missing required arguments
 */
int args_validate(void) {
    /* Check if --help was requested */
    if (args_has_option("help")) {
        args_print_usage();
        return 1;
    }

    /* Check for input file */
    char* input = args_get_option("input");
    if (input == NULL) {
        /* Try positional argument */
        input = args_get_positional(0);
    }

    if (input == NULL) {
        const char* error = "Error: No input file specified. Use --input <file> or provide positional argument.\n";
        uint32_t len = mycelial_strlen(error);

        __asm__ __volatile__ (
            "mov $1, %%rax\n"
            "mov $2, %%rdi\n"  /* stderr */
            "syscall\n"
            :
            : "S"(error), "d"(len)
            : "rax", "rdi", "rcx", "r11", "memory"
        );

        return 1;
    }

    return 0;
}
