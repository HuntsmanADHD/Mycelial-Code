/**
 * Builtin Functions (x86-64 Assembly Implementation)
 *
 * Generates x86-64 assembly implementations of Mycelial builtin functions.
 * All functions follow System V AMD64 calling convention:
 * - Arguments: rdi, rsi, rdx, rcx, r8, r9
 * - Return: rax
 * - Callee-saved: rbx, r12-r15, rbp
 *
 * Categories:
 * - String Operations: string_len, string_concat, format
 * - I/O Operations: print, println
 * - Memory Management: heap_alloc, heap_free
 * - Vector Operations: vec_new, vec_push, vec_get, vec_len
 * - Utility: memcpy, memset
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-10
 */

class BuiltinFunctionsGenerator {
  constructor() {
    this.functions = [];
  }

  /**
   * Generate all builtin functions
   * @returns {string} Complete assembly code for all builtins
   */
  generateAll() {
    const sections = [];

    sections.push(this.generateHeader());
    sections.push(this.generateStringFunctions());
    sections.push(this.generateIOFunctions());
    sections.push(this.generateMemoryFunctions());
    sections.push(this.generateVectorFunctions());
    sections.push(this.generateMapFunctions());
    sections.push(this.generateUtilityFunctions());
    sections.push(this.generateTestHelpers());

    return sections.join('\n\n');
  }

  /**
   * Generate header
   */
  generateHeader() {
    return `# ================================================================
# Mycelial Builtin Functions (x86-64)
# System V AMD64 calling convention
# ================================================================`;
  }

  /**
   * Generate string operation functions
   */
  generateStringFunctions() {
    const lines = [];

    // len(str) -> length (alias for string_len)
    lines.push(`# ================================================================`);
    lines.push(`# builtin_len(str: *u8) -> u64`);
    lines.push(`# Returns the length of a null-terminated string`);
    lines.push(`# Arguments: rdi = string pointer`);
    lines.push(`# Returns: rax = length`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_len:`);
    lines.push(`    jmp builtin_string_len    # alias to string_len`);
    lines.push(``);

    // string_len(str) -> length
    lines.push(`# ================================================================`);
    lines.push(`# builtin_string_len(str: *u8) -> u64`);
    lines.push(`# Returns the length of a null-terminated string`);
    lines.push(`# Arguments: rdi = string pointer`);
    lines.push(`# Returns: rax = length`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_string_len:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    xor rax, rax              # length = 0`);
    lines.push(`    test rdi, rdi             # check for null`);
    lines.push(`    jz .strlen_done`);
    lines.push(``);
    lines.push(`.strlen_loop:`);
    lines.push(`    cmp byte ptr [rdi + rax], 0   # check for null terminator`);
    lines.push(`    je .strlen_done`);
    lines.push(`    inc rax`);
    lines.push(`    jmp .strlen_loop`);
    lines.push(``);
    lines.push(`.strlen_done:`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // string_concat(str1, str2) -> new_string
    lines.push(`# ================================================================`);
    lines.push(`# builtin_string_concat(str1: *u8, str2: *u8) -> *u8`);
    lines.push(`# Concatenates two strings and returns a new string`);
    lines.push(`# Arguments: rdi = str1, rsi = str2`);
    lines.push(`# Returns: rax = new string pointer`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_string_concat:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12`);
    lines.push(`    push r13`);
    lines.push(`    push r14`);
    lines.push(``);
    lines.push(`    mov r12, rdi              # save str1`);
    lines.push(`    mov r13, rsi              # save str2`);
    lines.push(``);
    lines.push(`    # Get length of str1`);
    lines.push(`    mov rdi, r12`);
    lines.push(`    call builtin_string_len`);
    lines.push(`    mov r14, rax              # len1 in r14`);
    lines.push(``);
    lines.push(`    # Get length of str2`);
    lines.push(`    mov rdi, r13`);
    lines.push(`    call builtin_string_len`);
    lines.push(`    add r14, rax              # total = len1 + len2`);
    lines.push(`    inc r14                   # +1 for null terminator`);
    lines.push(``);
    lines.push(`    # Allocate memory`);
    lines.push(`    mov rdi, r14`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(`    push rax                  # save result pointer`);
    lines.push(``);
    lines.push(`    # Copy str1`);
    lines.push(`    mov rdi, rax              # dest`);
    lines.push(`    mov rsi, r12              # src = str1`);
    lines.push(`    call builtin_strcpy`);
    lines.push(``);
    lines.push(`    # Copy str2 (append)`);
    lines.push(`    pop rax                   # restore result`);
    lines.push(`    push rax`);
    lines.push(`    mov rdi, rax`);
    lines.push(`    mov rsi, r13              # src = str2`);
    lines.push(`    call builtin_strcat`);
    lines.push(``);
    lines.push(`    pop rax                   # return result`);
    lines.push(`    pop r14`);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // format(template, args...) -> string
    lines.push(`# ================================================================`);
    lines.push(`# builtin_format(argc: u64, ...) -> *u8`);
    lines.push(`# String formatting with {} placeholder replacement`);
    lines.push(`# Arguments: rdi = argc (number of args including format string)`);
    lines.push(`#            [rbp+16] = format string`);
    lines.push(`#            [rbp+24], [rbp+32], ... = arguments`);
    lines.push(`# Returns: rax = formatted string`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_format:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12                  # arg count`);
    lines.push(`    push r13                  # format string`);
    lines.push(`    push r14                  # current arg index`);
    lines.push(`    push r15                  # result buffer`);
    lines.push(`    sub rsp, 32               # local space`);
    lines.push(``);
    lines.push(`    mov r12, rdi              # argc`);
    lines.push(`    # Format string is at highest address: [rbp + 8 + argc*8]`);
    lines.push(`    mov rax, rdi`);
    lines.push(`    shl rax, 3                # argc * 8`);
    lines.push(`    add rax, 8                # + return address`);
    lines.push(`    mov r13, [rbp + rax]      # format string`);
    lines.push(`    xor r14, r14              # current_arg = 0`);
    lines.push(``);
    lines.push(`    # Calculate result length`);
    lines.push(`    mov rdi, r13`);
    lines.push(`    call builtin_string_len`);
    lines.push(`    add rax, 128              # add extra space for arg expansions`);
    lines.push(`    mov rdi, rax`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(`    mov r15, rax              # result buffer`);
    lines.push(``);
    lines.push(`    # Build result string`);
    lines.push(`    mov rdi, r15              # dest = result`);
    lines.push(`    mov rsi, r13              # src = format string`);
    lines.push(``);
    lines.push(`.format_loop:`);
    lines.push(`    movzx eax, BYTE PTR [rsi] # load current char`);
    lines.push(`    test al, al               # check for null terminator`);
    lines.push(`    jz .format_done`);
    lines.push(``);
    lines.push(`    # Check for {}`);
    lines.push(`    cmp al, '{'`);
    lines.push(`    jne .format_copy_char`);
    lines.push(`    movzx ebx, BYTE PTR [rsi + 1]`);
    lines.push(`    cmp bl, '}'`);
    lines.push(`    jne .format_copy_char`);
    lines.push(``);
    lines.push(`    # Found {} - replace with argument`);
    lines.push(`    inc r14                   # arg_index++`);
    lines.push(`    cmp r14, r12              # check if we have more args`);
    lines.push(`    jge .format_skip_placeholder`);
    lines.push(``);
    lines.push(`    # Get argument value from stack (args pushed in reverse order)`);
    lines.push(`    # Stack layout: [rbp+32]=format, [rbp+24]=arg1, [rbp+16]=arg2`);
    lines.push(`    # arg N is at [rbp + (argc - N) * 8 + 8]`);
    lines.push(`    mov rax, r12              # argc`);
    lines.push(`    sub rax, r14              # argc - arg_index`);
    lines.push(`    shl rax, 3                # * 8`);
    lines.push(`    add rax, 8                # + 8`);
    lines.push(`    mov rax, [rbp + rax]      # load argument`);
    lines.push(``);
    lines.push(`    # Check if argument is a string pointer or a number`);
    lines.push(`    # Heuristic: if value looks like a heap address (0x400000-0x500000), treat as string`);
    lines.push(`    # Otherwise, convert number to string`);
    lines.push(`    push rdi`);
    lines.push(`    push rsi`);
    lines.push(`    mov rdx, rax              # save original value`);
    lines.push(`    mov rsi, 0x400000         # lower bound`);
    lines.push(`    cmp rax, rsi`);
    lines.push(`    jb .format_convert_number # if value < 0x400000, it's a number`);
    lines.push(`    mov rsi, 0x500000         # upper bound`);
    lines.push(`    cmp rax, rsi`);
    lines.push(`    ja .format_convert_number # if value > 0x500000, it's a number`);
    lines.push(``);
    lines.push(`    # Value is in pointer range - use as string directly`);
    lines.push(`    mov rsi, rdx              # source = string pointer`);
    lines.push(`    jmp .format_use_string`);
    lines.push(``);
    lines.push(`.format_convert_number:`);
    lines.push(`    # Value is a number - convert to string`);
    lines.push(`    mov rdi, rdx              # value to convert`);
    lines.push(`    call builtin_i64_to_string`);
    lines.push(`    mov rsi, rax              # source = converted string`);
    lines.push(``);
    lines.push(`.format_use_string:`);
    lines.push(`    pop rbx                   # original rsi`);
    lines.push(`    pop rdi                   # dest`);
    lines.push(``);
    lines.push(`    # Copy converted string to result`);
    lines.push(`.format_copy_arg:`);
    lines.push(`    movzx eax, BYTE PTR [rsi]`);
    lines.push(`    test al, al`);
    lines.push(`    jz .format_arg_done`);
    lines.push(`    mov BYTE PTR [rdi], al`);
    lines.push(`    inc rdi`);
    lines.push(`    inc rsi`);
    lines.push(`    jmp .format_copy_arg`);
    lines.push(``);
    lines.push(`.format_arg_done:`);
    lines.push(`    mov rsi, rbx              # restore format string pointer`);
    lines.push(`    add rsi, 2                # skip {}`);
    lines.push(`    jmp .format_loop`);
    lines.push(``);
    lines.push(`.format_skip_placeholder:`);
    lines.push(`    add rsi, 2                # skip {}`);
    lines.push(`    jmp .format_loop`);
    lines.push(``);
    lines.push(`.format_copy_char:`);
    lines.push(`    mov BYTE PTR [rdi], al    # copy character`);
    lines.push(`    inc rdi`);
    lines.push(`    inc rsi`);
    lines.push(`    jmp .format_loop`);
    lines.push(``);
    lines.push(`.format_done:`);
    lines.push(`    mov BYTE PTR [rdi], 0     # null terminator`);
    lines.push(`    mov rax, r15              # return result`);
    lines.push(``);
    lines.push(`    add rsp, 32`);
    lines.push(`    pop r15`);
    lines.push(`    pop r14`);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // Helper: i64_to_string
    lines.push(`# ================================================================`);
    lines.push(`# builtin_i64_to_string(value: i64) -> *u8`);
    lines.push(`# Convert signed 64-bit integer to string`);
    lines.push(`# Arguments: rdi = value`);
    lines.push(`# Returns: rax = pointer to string (heap allocated)`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_i64_to_string:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12                  # original value`);
    lines.push(`    push r13                  # is_negative flag`);
    lines.push(`    push r14                  # digit count`);
    lines.push(`    sub rsp, 32               # temp buffer`);
    lines.push(``);
    lines.push(`    mov r12, rdi              # save value`);
    lines.push(`    xor r13, r13              # is_negative = 0`);
    lines.push(`    xor r14, r14              # digit_count = 0`);
    lines.push(``);
    lines.push(`    # Check if negative`);
    lines.push(`    test rdi, rdi`);
    lines.push(`    jns .i64_positive`);
    lines.push(`    mov r13, 1                # is_negative = 1`);
    lines.push(`    neg rdi                   # make positive`);
    lines.push(``);
    lines.push(`.i64_positive:`);
    lines.push(`    # Handle zero case`);
    lines.push(`    test rdi, rdi`);
    lines.push(`    jnz .i64_convert_loop`);
    lines.push(`    mov BYTE PTR [rbp - 32], '0'`);
    lines.push(`    mov r14, 1`);
    lines.push(`    jmp .i64_build_result`);
    lines.push(``);
    lines.push(`    # Convert digits (least significant first)`);
    lines.push(`.i64_convert_loop:`);
    lines.push(`    test rdi, rdi`);
    lines.push(`    jz .i64_build_result`);
    lines.push(``);
    lines.push(`    xor rdx, rdx              # clear for division`);
    lines.push(`    mov rax, rdi`);
    lines.push(`    mov rcx, 10`);
    lines.push(`    div rcx                   # rax = quotient, rdx = remainder`);
    lines.push(`    mov rdi, rax              # value = quotient`);
    lines.push(``);
    lines.push(`    add dl, '0'               # convert digit to ASCII`);
    lines.push(`    lea rax, [rbp - 32]`);
    lines.push(`    add rax, r14`);
    lines.push(`    mov [rax], dl             # store digit`);
    lines.push(`    inc r14                   # digit_count++`);
    lines.push(`    jmp .i64_convert_loop`);
    lines.push(``);
    lines.push(`.i64_build_result:`);
    lines.push(`    # Allocate heap for result`);
    lines.push(`    mov rdi, r14`);
    lines.push(`    add rdi, r13              # length = digit_count + is_negative`);
    lines.push(`    inc rdi                   # +1 for null terminator`);
    lines.push(`    push r14                  # save digit_count`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(`    pop r14                   # restore digit_count`);
    lines.push(`    push rax                  # save result pointer`);
    lines.push(``);
    lines.push(`    # Copy to result (with reversal)`);
    lines.push(`    mov rdi, rax              # dest = result`);
    lines.push(``);
    lines.push(`    # Add '-' if negative`);
    lines.push(`    test r13, r13`);
    lines.push(`    jz .i64_copy_digits`);
    lines.push(`    mov BYTE PTR [rdi], '-'`);
    lines.push(`    inc rdi`);
    lines.push(``);
    lines.push(`.i64_copy_digits:`);
    lines.push(`    # Copy digits in reverse order`);
    lines.push(`    xor rcx, rcx              # i = 0`);
    lines.push(`.i64_copy_loop:`);
    lines.push(`    cmp rcx, r14`);
    lines.push(`    jge .i64_copy_done`);
    lines.push(``);
    lines.push(`    # Get digit from temp buffer (reversed)`);
    lines.push(`    mov rax, r14`);
    lines.push(`    dec rax`);
    lines.push(`    sub rax, rcx              # index = digit_count - 1 - i`);
    lines.push(`    lea rbx, [rbp - 32]`);
    lines.push(`    add rbx, rax`);
    lines.push(`    mov al, [rbx]`);
    lines.push(``);
    lines.push(`    mov [rdi], al             # store digit`);
    lines.push(`    inc rdi`);
    lines.push(`    inc rcx`);
    lines.push(`    jmp .i64_copy_loop`);
    lines.push(``);
    lines.push(`.i64_copy_done:`);
    lines.push(`    mov BYTE PTR [rdi], 0     # null terminator`);
    lines.push(`    pop rax                   # return result pointer`);
    lines.push(``);
    lines.push(`    add rsp, 32`);
    lines.push(`    pop r14`);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // Helper: strcpy
    lines.push(`# Helper: strcpy(dest, src)`);
    lines.push(`builtin_strcpy:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`.strcpy_loop:`);
    lines.push(`    mov al, [rsi]             # load byte from src`);
    lines.push(`    mov [rdi], al             # store to dest`);
    lines.push(`    test al, al               # check for null`);
    lines.push(`    jz .strcpy_done`);
    lines.push(`    inc rsi`);
    lines.push(`    inc rdi`);
    lines.push(`    jmp .strcpy_loop`);
    lines.push(``);
    lines.push(`.strcpy_done:`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // Helper: strcat
    lines.push(`# Helper: strcat(dest, src)`);
    lines.push(`builtin_strcat:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Find end of dest`);
    lines.push(`.strcat_find_end:`);
    lines.push(`    cmp byte ptr [rdi], 0`);
    lines.push(`    je .strcat_copy`);
    lines.push(`    inc rdi`);
    lines.push(`    jmp .strcat_find_end`);
    lines.push(``);
    lines.push(`.strcat_copy:`);
    lines.push(`    # Copy src to end of dest`);
    lines.push(`    mov al, [rsi]`);
    lines.push(`    mov [rdi], al`);
    lines.push(`    test al, al`);
    lines.push(`    jz .strcat_done`);
    lines.push(`    inc rsi`);
    lines.push(`    inc rdi`);
    lines.push(`    jmp .strcat_copy`);
    lines.push(``);
    lines.push(`.strcat_done:`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate I/O functions
   */
  generateIOFunctions() {
    const lines = [];

    // print(str)
    lines.push(`# ================================================================`);
    lines.push(`# builtin_print(str: *u8)`);
    lines.push(`# Prints a string to stdout (without newline)`);
    lines.push(`# Arguments: rdi = string pointer`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_print:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12`);
    lines.push(``);
    lines.push(`    mov r12, rdi              # save string`);
    lines.push(``);
    lines.push(`    # Get string length`);
    lines.push(`    call builtin_string_len`);
    lines.push(`    mov rdx, rax              # length`);
    lines.push(``);
    lines.push(`    # Write syscall`);
    lines.push(`    mov rax, 1                # syscall: write`);
    lines.push(`    mov rdi, 1                # fd: stdout`);
    lines.push(`    mov rsi, r12              # buffer`);
    lines.push(`    syscall`);
    lines.push(``);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // println(str)
    lines.push(`# ================================================================`);
    lines.push(`# builtin_println(str: *u8)`);
    lines.push(`# Prints a string to stdout with newline`);
    lines.push(`# Arguments: rdi = string pointer`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_println:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Print the string`);
    lines.push(`    call builtin_print`);
    lines.push(``);
    lines.push(`    # Print newline`);
    lines.push(`    mov rax, 1                # syscall: write`);
    lines.push(`    mov rdi, 1                # fd: stdout`);
    lines.push(`    lea rsi, [newline_str]    # newline`);
    lines.push(`    mov rdx, 1                # length = 1`);
    lines.push(`    syscall`);
    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // print_i64(num)
    lines.push(`# ================================================================`);
    lines.push(`# builtin_print_i64(num: i64)`);
    lines.push(`# Prints a signed 64-bit integer to stdout`);
    lines.push(`# Arguments: rdi = number to print`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_print_i64:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    sub rsp, 32               # buffer for string conversion`);
    lines.push(`    push r12`);
    lines.push(`    push r13`);
    lines.push(``);
    lines.push(`    mov r12, rdi              # save number`);
    lines.push(`    lea r13, [rbp - 30]       # buffer pointer`);
    lines.push(`    mov byte ptr [rbp - 1], 0 # null terminator`);
    lines.push(``);
    lines.push(`    # Check if negative`);
    lines.push(`    test r12, r12`);
    lines.push(`    jns .print_i64_positive`);
    lines.push(``);
    lines.push(`    # Handle negative: print '-' and negate`);
    lines.push(`    mov rax, 1                # syscall: write`);
    lines.push(`    mov rdi, 1                # fd: stdout`);
    lines.push(`    lea rsi, [minus_sign]`);
    lines.push(`    mov rdx, 1                # length = 1`);
    lines.push(`    syscall`);
    lines.push(`    neg r12                   # make positive`);
    lines.push(``);
    lines.push(`.print_i64_positive:`);
    lines.push(`    # Convert to string (reverse order)`);
    lines.push(`    mov rax, r12`);
    lines.push(`    lea rdi, [rbp - 2]        # start at end of buffer`);
    lines.push(``);
    lines.push(`.print_i64_convert_loop:`);
    lines.push(`    xor rdx, rdx`);
    lines.push(`    mov rcx, 10`);
    lines.push(`    div rcx                   # rdx = rax % 10, rax = rax / 10`);
    lines.push(`    add dl, 48                # convert to ASCII`);
    lines.push(`    mov [rdi], dl`);
    lines.push(`    dec rdi`);
    lines.push(`    test rax, rax`);
    lines.push(`    jnz .print_i64_convert_loop`);
    lines.push(``);
    lines.push(`    # Print the number`);
    lines.push(`    inc rdi                   # move to first digit`);
    lines.push(`    lea rsi, [rbp - 2]`);
    lines.push(`    sub rsi, rdi              # calculate length`);
    lines.push(`    neg rsi`);
    lines.push(`    inc rsi                   # length`);
    lines.push(`    mov rdx, rsi              # length`);
    lines.push(`    mov rax, 1                # syscall: write`);
    lines.push(`    mov rsi, rdi              # buffer`);
    lines.push(`    mov rdi, 1                # fd: stdout`);
    lines.push(`    syscall`);
    lines.push(``);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    mov rsp, rbp`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate memory management functions
   */
  generateMemoryFunctions() {
    const lines = [];

    // Simple bump allocator
    lines.push(`# ================================================================`);
    lines.push(`# builtin_heap_alloc(size: u64) -> *u8`);
    lines.push(`# Simple bump allocator`);
    lines.push(`# Arguments: rdi = size`);
    lines.push(`# Returns: rax = pointer to allocated memory`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_heap_alloc:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Get current heap pointer`);
    lines.push(`    mov rax, [heap_ptr]`);
    lines.push(``);
    lines.push(`    # Advance heap pointer`);
    lines.push(`    add rdi, rax`);
    lines.push(`    mov [heap_ptr], rdi`);
    lines.push(``);
    lines.push(`    # Check if we exceeded heap limit`);
    lines.push(`    lea rsi, [heap_end]`);
    lines.push(`    cmp rdi, rsi`);
    lines.push(`    jg .heap_overflow`);
    lines.push(``);
    lines.push(`    # Return allocated pointer`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);
    lines.push(`.heap_overflow:`);
    lines.push(`    # Out of memory - exit with error`);
    lines.push(`    mov rdi, 1                # exit code 1`);
    lines.push(`    mov rax, 60               # syscall: exit`);
    lines.push(`    syscall`);
    lines.push(``);

    // heap_free (no-op for bump allocator)
    lines.push(`# builtin_heap_free(ptr: *u8)`);
    lines.push(`# No-op for bump allocator`);
    lines.push(`builtin_heap_free:`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate vector operation functions
   */
  generateVectorFunctions() {
    const lines = [];

    // vec_new() -> vec
    lines.push(`# ================================================================`);
    lines.push(`# builtin_vec_new() -> *vec`);
    lines.push(`# Creates a new vector (ptr, len, cap)`);
    lines.push(`# Returns: rax = vector struct pointer`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_vec_new:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Allocate vector struct (24 bytes)`);
    lines.push(`    mov rdi, 24`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(``);
    lines.push(`    # Initialize: ptr=0, len=0, cap=0`);
    lines.push(`    xor rdx, rdx`);
    lines.push(`    mov qword ptr [rax + 0], rdx    # ptr`);
    lines.push(`    mov qword ptr [rax + 8], rdx    # len`);
    lines.push(`    mov qword ptr [rax + 16], rdx   # cap`);
    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // vec_len(vec) -> length
    lines.push(`# builtin_vec_len(vec: *vec) -> u64`);
    lines.push(`builtin_vec_len:`);
    lines.push(`    mov rax, [rdi + 8]        # return len field`);
    lines.push(`    ret`);
    lines.push(``);

    // vec_push(vec, item)
    lines.push(`# builtin_vec_push(vec: *vec, item: u64)`);
    lines.push(`# Arguments: rdi = vec pointer, rsi = item to push`);
    lines.push(`builtin_vec_push:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12              # save vec pointer`);
    lines.push(`    push r13              # save item`);
    lines.push(``);
    lines.push(`    mov r12, rdi          # save vec pointer`);
    lines.push(`    mov r13, rsi          # save item`);
    lines.push(``);
    lines.push(`    # Load len and cap`);
    lines.push(`    mov rax, [r12 + 8]    # len`);
    lines.push(`    mov rdx, [r12 + 16]   # cap`);
    lines.push(``);
    lines.push(`    # Check if we need to grow`);
    lines.push(`    cmp rax, rdx`);
    lines.push(`    jl .vec_push_no_grow`);
    lines.push(``);
    lines.push(`    # Need to grow: allocate new capacity (cap * 2, or 8 if cap==0)`);
    lines.push(`    test rdx, rdx`);
    lines.push(`    jz .vec_push_init_cap`);
    lines.push(`    shl rdx, 1            # new_cap = cap * 2`);
    lines.push(`    jmp .vec_push_alloc`);
    lines.push(``);
    lines.push(`.vec_push_init_cap:`);
    lines.push(`    mov rdx, 8            # initial capacity = 8`);
    lines.push(``);
    lines.push(`.vec_push_alloc:`);
    lines.push(`    # Allocate new array (new_cap * 8 bytes)`);
    lines.push(`    push rdx              # save new_cap`);
    lines.push(`    shl rdx, 3            # new_cap * 8`);
    lines.push(`    mov rdi, rdx`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(`    pop rdx               # restore new_cap`);
    lines.push(`    mov r14, rax          # save new_ptr`);
    lines.push(``);
    lines.push(`    # Copy old data to new array`);
    lines.push(`    mov rcx, [r12 + 8]    # len`);
    lines.push(`    test rcx, rcx`);
    lines.push(`    jz .vec_push_no_copy`);
    lines.push(`    mov rsi, [r12 + 0]    # old ptr`);
    lines.push(`    mov rdi, r14          # new ptr`);
    lines.push(`.vec_push_copy_loop:`);
    lines.push(`    mov rax, [rsi]`);
    lines.push(`    mov [rdi], rax`);
    lines.push(`    add rsi, 8`);
    lines.push(`    add rdi, 8`);
    lines.push(`    dec rcx`);
    lines.push(`    jnz .vec_push_copy_loop`);
    lines.push(``);
    lines.push(`.vec_push_no_copy:`);
    lines.push(`    # Update vector struct`);
    lines.push(`    mov [r12 + 0], r14    # ptr = new_ptr`);
    lines.push(`    mov [r12 + 16], rdx   # cap = new_cap`);
    lines.push(``);
    lines.push(`.vec_push_no_grow:`);
    lines.push(`    # Add item at end`);
    lines.push(`    mov rax, [r12 + 8]    # len`);
    lines.push(`    mov rdx, [r12 + 0]    # ptr`);
    lines.push(`    mov [rdx + rax * 8], r13  # ptr[len] = item`);
    lines.push(``);
    lines.push(`    # Increment len`);
    lines.push(`    inc rax`);
    lines.push(`    mov [r12 + 8], rax    # len++`);
    lines.push(``);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // vec_get(vec, index) -> item
    lines.push(`# builtin_vec_get(vec: *vec, index: u64) -> u64`);
    lines.push(`builtin_vec_get:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Check bounds`);
    lines.push(`    cmp rsi, [rdi + 8]        # index < len?`);
    lines.push(`    jge .vec_get_bounds`);
    lines.push(``);
    lines.push(`    # Get item: ptr[index]`);
    lines.push(`    mov rax, [rdi + 0]        # ptr`);
    lines.push(`    mov rax, [rax + rsi * 8]  # ptr[index]`);
    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);
    lines.push(`.vec_get_bounds:`);
    lines.push(`    # Out of bounds - return 0`);
    lines.push(`    xor rax, rax`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // vec_set(vec, index, value)
    lines.push(`# builtin_vec_set(vec: *vec, index: u64, value: u64)`);
    lines.push(`# Arguments: rdi = vec pointer, rsi = index, rdx = value`);
    lines.push(`builtin_vec_set:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Check bounds`);
    lines.push(`    cmp rsi, [rdi + 8]        # index < len?`);
    lines.push(`    jge .vec_set_bounds`);
    lines.push(``);
    lines.push(`    # Set item: ptr[index] = value`);
    lines.push(`    mov rax, [rdi + 0]        # ptr`);
    lines.push(`    mov [rax + rsi * 8], rdx  # ptr[index] = value`);
    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);
    lines.push(`.vec_set_bounds:`);
    lines.push(`    # Out of bounds - do nothing`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // vec_slice(vec, start, end) -> new_vec
    lines.push(`# builtin_vec_slice(vec: *vec, start: u64, end: u64) -> *vec`);
    lines.push(`# Arguments: rdi = vec pointer, rsi = start, rdx = end`);
    lines.push(`# Returns: rax = new vector containing elements [start..end)`);
    lines.push(`builtin_vec_slice:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12              # save vec pointer`);
    lines.push(`    push r13              # save start`);
    lines.push(`    push r14              # save end`);
    lines.push(``);
    lines.push(`    mov r12, rdi          # save vec pointer`);
    lines.push(`    mov r13, rsi          # save start`);
    lines.push(`    mov r14, rdx          # save end`);
    lines.push(``);
    lines.push(`    # Validate bounds: start <= end <= len`);
    lines.push(`    mov rcx, [r12 + 8]    # len`);
    lines.push(`    cmp r14, rcx          # end <= len?`);
    lines.push(`    jg .vec_slice_clamp_end`);
    lines.push(`    jmp .vec_slice_bounds_ok`);
    lines.push(``);
    lines.push(`.vec_slice_clamp_end:`);
    lines.push(`    mov r14, rcx          # clamp end to len`);
    lines.push(``);
    lines.push(`.vec_slice_bounds_ok:`);
    lines.push(`    cmp r13, r14          # start <= end?`);
    lines.push(`    jg .vec_slice_empty`);
    lines.push(``);
    lines.push(`    # Calculate slice length`);
    lines.push(`    mov r15, r14`);
    lines.push(`    sub r15, r13          # length = end - start`);
    lines.push(``);
    lines.push(`    # Create new vector`);
    lines.push(`    call builtin_vec_new`);
    lines.push(`    push rax              # save new vec`);
    lines.push(``);
    lines.push(`    # Allocate array for new vector`);
    lines.push(`    mov rdi, r15`);
    lines.push(`    shl rdi, 3            # length * 8`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(`    pop r8                # restore new vec`);
    lines.push(`    mov [r8 + 0], rax     # set ptr`);
    lines.push(`    mov [r8 + 8], r15     # set len`);
    lines.push(`    mov [r8 + 16], r15    # set cap = len`);
    lines.push(``);
    lines.push(`    # Copy elements from source[start..end) to new vector`);
    lines.push(`    test r15, r15         # length == 0?`);
    lines.push(`    jz .vec_slice_done`);
    lines.push(``);
    lines.push(`    mov rsi, [r12 + 0]    # source ptr`);
    lines.push(`    lea rsi, [rsi + r13 * 8]  # source ptr + start offset`);
    lines.push(`    mov rdi, rax          # dest ptr`);
    lines.push(`    mov rcx, r15          # count`);
    lines.push(``);
    lines.push(`.vec_slice_copy_loop:`);
    lines.push(`    mov r9, [rsi]`);
    lines.push(`    mov [rdi], r9`);
    lines.push(`    add rsi, 8`);
    lines.push(`    add rdi, 8`);
    lines.push(`    dec rcx`);
    lines.push(`    jnz .vec_slice_copy_loop`);
    lines.push(``);
    lines.push(`.vec_slice_done:`);
    lines.push(`    mov rax, r8           # return new vec`);
    lines.push(`    pop r14`);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);
    lines.push(`.vec_slice_empty:`);
    lines.push(`    # Return empty vector`);
    lines.push(`    call builtin_vec_new`);
    lines.push(`    pop r14`);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate map operation functions
   * Map structure: { entries: *entry, len: u64, cap: u64 }
   * Entry structure: { key: u64, value: u64 } (16 bytes)
   */
  generateMapFunctions() {
    const lines = [];

    // map_new() -> map
    lines.push(`# ================================================================`);
    lines.push(`# builtin_map_new() -> *map`);
    lines.push(`# Creates a new map (entries, len, cap)`);
    lines.push(`# Returns: rax = map struct pointer`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_map_new:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Allocate map struct (24 bytes)`);
    lines.push(`    mov rdi, 24`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(``);
    lines.push(`    # Initialize: entries=0, len=0, cap=0`);
    lines.push(`    xor rdx, rdx`);
    lines.push(`    mov qword ptr [rax + 0], rdx    # entries`);
    lines.push(`    mov qword ptr [rax + 8], rdx    # len`);
    lines.push(`    mov qword ptr [rax + 16], rdx   # cap`);
    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // map_set(map, key, value)
    lines.push(`# builtin_map_set(map: *map, key: u64, value: u64)`);
    lines.push(`# Arguments: rdi = map, rsi = key, rdx = value`);
    lines.push(`builtin_map_set:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(`    push r12              # save map`);
    lines.push(`    push r13              # save key`);
    lines.push(`    push r14              # save value`);
    lines.push(``);
    lines.push(`    mov r12, rdi          # save map`);
    lines.push(`    mov r13, rsi          # save key`);
    lines.push(`    mov r14, rdx          # save value`);
    lines.push(``);
    lines.push(`    # First check if key already exists`);
    lines.push(`    xor rcx, rcx          # i = 0`);
    lines.push(`.map_set_find_loop:`);
    lines.push(`    cmp rcx, [r12 + 8]    # i < len?`);
    lines.push(`    jge .map_set_not_found`);
    lines.push(`    mov rax, [r12 + 0]    # entries ptr`);
    lines.push(`    mov r15, rcx`);
    lines.push(`    shl r15, 4            # i * 16`);
    lines.push(`    add r15, rax          # &entries[i]`);
    lines.push(`    mov rax, [r15]        # entries[i].key`);
    lines.push(`    cmp rax, r13          # key == target?`);
    lines.push(`    je .map_set_update`);
    lines.push(`    inc rcx`);
    lines.push(`    jmp .map_set_find_loop`);
    lines.push(``);
    lines.push(`.map_set_update:`);
    lines.push(`    # Update existing entry (r15 still points to entry)`);
    lines.push(`    mov [r15 + 8], r14    # entries[i].value = value`);
    lines.push(`    jmp .map_set_done`);
    lines.push(``);
    lines.push(`.map_set_not_found:`);
    lines.push(`    # Need to add new entry - check if we need to grow`);
    lines.push(`    mov rax, [r12 + 8]    # len`);
    lines.push(`    mov rdx, [r12 + 16]   # cap`);
    lines.push(`    cmp rax, rdx`);
    lines.push(`    jl .map_set_no_grow`);
    lines.push(``);
    lines.push(`    # Grow capacity`);
    lines.push(`    test rdx, rdx`);
    lines.push(`    jz .map_set_init_cap`);
    lines.push(`    shl rdx, 1            # new_cap = cap * 2`);
    lines.push(`    jmp .map_set_alloc`);
    lines.push(``);
    lines.push(`.map_set_init_cap:`);
    lines.push(`    mov rdx, 4            # initial capacity = 4`);
    lines.push(``);
    lines.push(`.map_set_alloc:`);
    lines.push(`    # Allocate new entries array (new_cap * 16 bytes per entry)`);
    lines.push(`    push rdx              # save new_cap`);
    lines.push(`    shl rdx, 4            # new_cap * 16`);
    lines.push(`    mov rdi, rdx`);
    lines.push(`    call builtin_heap_alloc`);
    lines.push(`    pop rdx               # restore new_cap`);
    lines.push(`    mov r15, rax          # save new_entries`);
    lines.push(``);
    lines.push(`    # Copy old entries`);
    lines.push(`    mov rcx, [r12 + 8]    # len`);
    lines.push(`    test rcx, rcx`);
    lines.push(`    jz .map_set_no_copy`);
    lines.push(`    mov rsi, [r12 + 0]    # old entries`);
    lines.push(`    mov rdi, r15          # new entries`);
    lines.push(`.map_set_copy_loop:`);
    lines.push(`    mov rax, [rsi]        # key`);
    lines.push(`    mov [rdi], rax`);
    lines.push(`    mov rax, [rsi + 8]    # value`);
    lines.push(`    mov [rdi + 8], rax`);
    lines.push(`    add rsi, 16`);
    lines.push(`    add rdi, 16`);
    lines.push(`    dec rcx`);
    lines.push(`    jnz .map_set_copy_loop`);
    lines.push(``);
    lines.push(`.map_set_no_copy:`);
    lines.push(`    # Update map struct`);
    lines.push(`    mov [r12 + 0], r15    # entries = new_entries`);
    lines.push(`    mov [r12 + 16], rdx   # cap = new_cap`);
    lines.push(``);
    lines.push(`.map_set_no_grow:`);
    lines.push(`    # Add new entry at end`);
    lines.push(`    mov rax, [r12 + 8]    # len`);
    lines.push(`    mov rdx, [r12 + 0]    # entries`);
    lines.push(`    mov r15, rax`);
    lines.push(`    shl r15, 4            # len * 16`);
    lines.push(`    add r15, rdx          # &entries[len]`);
    lines.push(`    mov [r15], r13        # entries[len].key = key`);
    lines.push(`    mov [r15 + 8], r14    # entries[len].value = value`);
    lines.push(``);
    lines.push(`    # Increment len`);
    lines.push(`    inc rax`);
    lines.push(`    mov [r12 + 8], rax    # len++`);
    lines.push(``);
    lines.push(`.map_set_done:`);
    lines.push(`    pop r14`);
    lines.push(`    pop r13`);
    lines.push(`    pop r12`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // map_get(map, key) -> value
    lines.push(`# builtin_map_get(map: *map, key: u64) -> u64`);
    lines.push(`# Returns value for key, or 0 if not found`);
    lines.push(`builtin_map_get:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Search for key`);
    lines.push(`    xor rcx, rcx          # i = 0`);
    lines.push(`.map_get_loop:`);
    lines.push(`    cmp rcx, [rdi + 8]    # i < len?`);
    lines.push(`    jge .map_get_not_found`);
    lines.push(`    mov rax, [rdi + 0]    # entries ptr`);
    lines.push(`    mov r8, rcx`);
    lines.push(`    shl r8, 4             # i * 16`);
    lines.push(`    add r8, rax           # &entries[i]`);
    lines.push(`    mov rdx, [r8]         # entries[i].key`);
    lines.push(`    cmp rdx, rsi          # key == target?`);
    lines.push(`    je .map_get_found`);
    lines.push(`    inc rcx`);
    lines.push(`    jmp .map_get_loop`);
    lines.push(``);
    lines.push(`.map_get_found:`);
    lines.push(`    mov rax, [r8 + 8]     # entries[i].value`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);
    lines.push(`.map_get_not_found:`);
    lines.push(`    xor rax, rax          # return 0`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // map_has(map, key) -> bool
    lines.push(`# builtin_map_has(map: *map, key: u64) -> bool`);
    lines.push(`# Returns 1 if key exists, 0 otherwise`);
    lines.push(`builtin_map_has:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Search for key`);
    lines.push(`    xor rcx, rcx          # i = 0`);
    lines.push(`.map_has_loop:`);
    lines.push(`    cmp rcx, [rdi + 8]    # i < len?`);
    lines.push(`    jge .map_has_not_found`);
    lines.push(`    mov rax, [rdi + 0]    # entries ptr`);
    lines.push(`    mov r8, rcx`);
    lines.push(`    shl r8, 4             # i * 16`);
    lines.push(`    add r8, rax           # &entries[i]`);
    lines.push(`    mov rax, [r8]         # entries[i].key`);
    lines.push(`    cmp rax, rsi          # key == target?`);
    lines.push(`    je .map_has_found`);
    lines.push(`    inc rcx`);
    lines.push(`    jmp .map_has_loop`);
    lines.push(``);
    lines.push(`.map_has_found:`);
    lines.push(`    mov rax, 1            # return true`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);
    lines.push(`.map_has_not_found:`);
    lines.push(`    xor rax, rax          # return false`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // map_delete(map, key)
    lines.push(`# builtin_map_delete(map: *map, key: u64)`);
    lines.push(`# Removes key-value pair if it exists`);
    lines.push(`builtin_map_delete:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Search for key`);
    lines.push(`    xor rcx, rcx          # i = 0`);
    lines.push(`.map_delete_loop:`);
    lines.push(`    cmp rcx, [rdi + 8]    # i < len?`);
    lines.push(`    jge .map_delete_not_found`);
    lines.push(`    mov rax, [rdi + 0]    # entries ptr`);
    lines.push(`    mov r10, rcx`);
    lines.push(`    shl r10, 4            # i * 16`);
    lines.push(`    add r10, rax          # &entries[i]`);
    lines.push(`    mov rdx, [r10]        # entries[i].key`);
    lines.push(`    cmp rdx, rsi          # key == target?`);
    lines.push(`    je .map_delete_found`);
    lines.push(`    inc rcx`);
    lines.push(`    jmp .map_delete_loop`);
    lines.push(``);
    lines.push(`.map_delete_found:`);
    lines.push(`    # Shift remaining entries down`);
    lines.push(`    mov r8, [rdi + 8]     # len`);
    lines.push(`    dec r8                # len - 1`);
    lines.push(`    cmp rcx, r8           # if i == len-1, just decrement len`);
    lines.push(`    je .map_delete_last`);
    lines.push(``);
    lines.push(`    # Move entries[i+1..len] to entries[i..len-1]`);
    lines.push(`    mov rax, [rdi + 0]    # entries ptr`);
    lines.push(`    mov r10, rcx`);
    lines.push(`    shl r10, 4            # i * 16`);
    lines.push(`    add r10, rax          # &entries[i]`);
    lines.push(`    mov r11, r10`);
    lines.push(`    add r11, 16           # &entries[i+1]`);
    lines.push(`    mov rsi, r11          # src = &entries[i+1]`);
    lines.push(`    mov rdx, r10          # dst = &entries[i]`);
    lines.push(`    mov r9, [rdi + 8]     # len`);
    lines.push(`    sub r9, rcx           # count = len - i`);
    lines.push(`    dec r9                # count - 1`);
    lines.push(`.map_delete_shift_loop:`);
    lines.push(`    test r9, r9`);
    lines.push(`    jz .map_delete_last`);
    lines.push(`    mov rax, [rsi]        # key`);
    lines.push(`    mov [rdx], rax`);
    lines.push(`    mov rax, [rsi + 8]    # value`);
    lines.push(`    mov [rdx + 8], rax`);
    lines.push(`    add rsi, 16`);
    lines.push(`    add rdx, 16`);
    lines.push(`    dec r9`);
    lines.push(`    jmp .map_delete_shift_loop`);
    lines.push(``);
    lines.push(`.map_delete_last:`);
    lines.push(`    # Decrement len`);
    lines.push(`    mov rax, [rdi + 8]`);
    lines.push(`    dec rax`);
    lines.push(`    mov [rdi + 8], rax`);
    lines.push(``);
    lines.push(`.map_delete_not_found:`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate utility functions
   */
  generateUtilityFunctions() {
    const lines = [];

    // memcpy
    lines.push(`# ================================================================`);
    lines.push(`# builtin_memcpy(dest: *u8, src: *u8, n: u64)`);
    lines.push(`# Copy n bytes from src to dest`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_memcpy:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    mov rcx, rdx              # count`);
    lines.push(`    rep movsb                 # copy bytes`);
    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // memset
    lines.push(`# builtin_memset(ptr: *u8, value: u8, n: u64)`);
    lines.push(`builtin_memset:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    mov al, sil               # value`);
    lines.push(`    mov rcx, rdx              # count`);
    lines.push(`    rep stosb                 # set bytes`);
    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);
    lines.push(``);

    // sum(vec) -> i64
    lines.push(`# builtin_sum(vec: *vec) -> i64`);
    lines.push(`# Sums all elements in a vector`);
    lines.push(`# Arguments: rdi = vector pointer`);
    lines.push(`# Returns: rax = sum of all elements`);
    lines.push(`builtin_sum:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    xor rax, rax              # sum = 0`);
    lines.push(`    mov rcx, [rdi + 8]        # len`);
    lines.push(`    test rcx, rcx             # if len == 0, return 0`);
    lines.push(`    jz .sum_done`);
    lines.push(``);
    lines.push(`    mov rdx, [rdi + 0]        # ptr`);
    lines.push(`    xor r8, r8                # i = 0`);
    lines.push(``);
    lines.push(`.sum_loop:`);
    lines.push(`    add rax, [rdx + r8 * 8]   # sum += ptr[i]`);
    lines.push(`    inc r8                    # i++`);
    lines.push(`    cmp r8, rcx               # i < len?`);
    lines.push(`    jl .sum_loop`);
    lines.push(``);
    lines.push(`.sum_done:`);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }

  /**
   * Generate test helper functions
   * These are application-specific functions used in test programs
   */
  generateTestHelpers() {
    const lines = [];

    // compute(str) -> i64
    // Test function used in pipeline.mycelial
    // Returns the length of the string as a simple computation
    lines.push(`# ================================================================`);
    lines.push(`# builtin_compute(str: *u8) -> i64`);
    lines.push(`# Test function: computes a value from a string`);
    lines.push(`# For simplicity, returns the string length`);
    lines.push(`# Arguments: rdi = string pointer`);
    lines.push(`# Returns: rax = computed value (length)`);
    lines.push(`# ================================================================`);
    lines.push(`builtin_compute:`);
    lines.push(`    push rbp`);
    lines.push(`    mov rbp, rsp`);
    lines.push(``);
    lines.push(`    # Just return string length as the "computation"`);
    lines.push(`    call builtin_string_len`);
    lines.push(``);
    lines.push(`    pop rbp`);
    lines.push(`    ret`);

    return lines.join('\n');
  }
}

module.exports = { BuiltinFunctionsGenerator };
