# ARM64 AAPCS64 Calling Convention Reference

**Owner**: Opus (Claude Opus 4.5)
**Status**: COMPLETE
**Version**: 1.0
**Purpose**: Complete reference for the ARM64 Procedure Call Standard (AAPCS64) used on Linux and macOS

---

## Overview

The AAPCS64 (ARM Architecture Procedure Call Standard for 64-bit) defines how functions call each other on ARM64 systems. This document covers everything needed to generate correct function calls in the Mycelial compiler.

**Applies to:** Linux ARM64, macOS ARM64 (Apple Silicon), FreeBSD ARM64, Android ARM64

**Note:** macOS has minor variations documented in Section 8.

---

## 1. Register Usage

### General Purpose Registers

| Register | Alias | Purpose | Preserved Across Calls? |
|----------|-------|---------|------------------------|
| x0-x7 | - | Arguments 1-8, return values | No (caller-saved) |
| x8 | XR | Indirect result location | No |
| x9-x15 | - | Temporary (caller-saved) | No |
| x16 | IP0 | Intra-procedure call scratch 0 | No |
| x17 | IP1 | Intra-procedure call scratch 1 | No |
| x18 | PR | Platform register | **Reserved** |
| x19-x28 | - | Callee-saved registers | **Yes** |
| x29 | FP | Frame pointer | **Yes** |
| x30 | LR | Link register (return address) | **Yes** |
| sp | SP | Stack pointer | **Special** |
| xzr | ZR | Zero register (reads as 0) | N/A |
| pc | PC | Program counter | N/A |

### Caller-Saved vs Callee-Saved

**Caller-Saved (Volatile):** The caller must save these before a call if needed after:
```
x0-x18
```

**Callee-Saved (Non-Volatile):** The callee must restore these before returning:
```
x19-x28, x29 (FP), x30 (LR)
```

### SIMD/Floating-Point Registers

| Register | Purpose | Preserved? |
|----------|---------|------------|
| v0-v7 | FP arguments 1-8, FP return values | No |
| v8-v15 | Callee-saved (lower 64 bits only!) | **Partial** |
| v16-v31 | Temporary | No |

**Important:** Only the lower 64 bits of v8-v15 are preserved. The upper 64 bits are caller-saved.

---

## 2. Function Arguments

### Integer/Pointer Arguments

Arguments are passed in registers in this order:

| Argument | Register |
|----------|----------|
| 1st | x0 |
| 2nd | x1 |
| 3rd | x2 |
| 4th | x3 |
| 5th | x4 |
| 6th | x5 |
| 7th | x6 |
| 8th | x7 |
| 9th+ | Stack |

### Floating-Point Arguments

| Argument | Register |
|----------|----------|
| 1st-8th | v0 through v7 |
| 9th+ | Stack |

### Mixed Arguments

Integer and floating-point arguments use **separate register sequences**:

```c
void example(int a, double b, int c, double d, int e);
//           x0     v0       x1     v1       x2
```

This is different from System V AMD64 where FP and integer arguments are completely separate.

### Stack Arguments

When registers are exhausted, remaining arguments go on the stack:

1. Arguments pushed in **natural order** (left-to-right in memory)
2. Each argument aligned to its natural alignment (8 bytes for 64-bit values)
3. Accessed relative to `sp` after prologue
4. Stack must remain 16-byte aligned

```asm
; Calling func(a, b, c, d, e, f, g, h, i, j)
; a=x0, b=x1, c=x2, d=x3, e=x4, f=x5, g=x6, h=x7
; i, j on stack

; Set up stack arguments (before call)
SUB sp, sp, #16           ; Allocate 16 bytes (16-byte aligned)
STR x9, [sp, #0]          ; i (9th argument)
STR x10, [sp, #8]         ; j (10th argument)

; Set up register arguments
MOV x0, ...               ; a
MOV x1, ...               ; b
; ... etc ...
MOV x7, ...               ; h

BL func

ADD sp, sp, #16           ; Clean up stack
```

### Stack Layout at Call Site

```
    ┌─────────────────────┐ High addresses
    │ Argument 10         │ [sp + 8] (before BL)
    │ Argument 9          │ [sp + 0]
    ├─────────────────────┤
    │ (BL saves LR, not   │ ← BL instruction stores return
    │  on stack but x30)  │   address in LR, not on stack!
    └─────────────────────┘ Low addresses (sp)
```

**Key difference from x86-64:** ARM64's `BL` instruction saves the return address to the link register (x30), not to the stack. The callee may later push it to the stack if needed.

---

## 3. Return Values

### Integer/Pointer Returns

| Return Type | Register(s) |
|-------------|-------------|
| ≤64 bits | x0 |
| 65-128 bits | x0 (low), x1 (high) |

### Floating-Point Returns

| Return Type | Register(s) |
|-------------|-------------|
| float/double | v0 |
| Complex/pair | v0, v1 |

### Struct Returns

**Small structs (≤16 bytes):**
- Returned in x0, x1 (integers) or v0, v1 (floating-point) based on composition

**Large structs (>16 bytes):**
- Caller allocates space and passes hidden pointer in x8
- Callee writes to memory
- x8 is NOT returned (unlike x86-64 which returns the hidden pointer)

```c
// Large struct return
struct Big { char data[32]; };
struct Big create_big(int x);

// Calling convention:
// Caller: Sets x8 to address of result space
//         Sets x0 to x
// Callee: Writes to [x8]
//         Does NOT return x8 in x0
```

---

## 4. Stack Frame

### Frame Layout

```
    High Addresses
    ┌─────────────────────────┐
    │ Stack Argument N        │ [x29 + 16 + (N-9)*8]
    │ ...                     │
    │ Stack Argument 9        │ [x29 + 16]
    ├─────────────────────────┤
    │ Saved LR (x30)          │ [x29 + 8]
    ├─────────────────────────┤
    │ Saved FP (x29)          │ [x29]  ← x29 points here
    ├─────────────────────────┤
    │ Local Variable 1        │ [x29 - 8]
    │ Local Variable 2        │ [x29 - 16]
    │ ...                     │
    ├─────────────────────────┤
    │ Saved Callee Registers  │
    │ (x19-x28 as needed)     │
    ├─────────────────────────┤
    │ Spill Slots             │
    ├─────────────────────────┤
    │ Outgoing Stack Args     │
    │ (16-byte aligned)       │ ← sp
    └─────────────────────────┘
    Low Addresses
```

### Stack Alignment

**CRITICAL:** SP must **always** be 16-byte aligned. This is stricter than x86-64.

```asm
; CORRECT: Allocate 32 bytes
SUB sp, sp, #32

; INCORRECT: Would misalign stack
SUB sp, sp, #24          ; This will cause a hardware fault!
```

---

## 5. Function Prologue/Epilogue

### Standard Prologue

```asm
function_name:
    ; Save frame pointer and link register (as a pair)
    STP x29, x30, [sp, #-frame_size]!   ; Pre-decrement SP
    MOV x29, sp                          ; Set frame pointer

    ; Save callee-saved registers we'll modify
    STP x19, x20, [sp, #16]
    STP x21, x22, [sp, #32]
    ; ... more pairs as needed
```

### Standard Epilogue

```asm
    ; Restore callee-saved registers
    LDP x21, x22, [sp, #32]
    LDP x19, x20, [sp, #16]

    ; Restore frame pointer, link register, and deallocate frame
    LDP x29, x30, [sp], #frame_size     ; Post-increment SP
    RET                                  ; Return via x30
```

### STP/LDP Instructions

ARM64 has efficient pair load/store:

```asm
; Store pair (equivalent to two STR but more efficient)
STP x29, x30, [sp, #-16]!   ; Push x29 and x30, decrement sp

; Load pair (equivalent to two LDR but more efficient)
LDP x29, x30, [sp], #16     ; Pop x29 and x30, increment sp
```

### Leaf Function Optimization

Functions that don't call others can skip frame setup entirely:

```asm
add_numbers:
    ADD x0, x0, x1    ; Simple operation
    RET               ; Return immediately (no frame setup needed)
```

---

## 6. The Red Zone (No Red Zone!)

**Important:** ARM64 **does NOT have a red zone**.

Unlike x86-64's 128-byte red zone below RSP, ARM64 has no protected area below SP. If you need scratch space, you must explicitly allocate it:

```asm
; x86-64 (with red zone):
MOV [rsp - 8], rax    ; Legal in leaf functions

; ARM64 (no red zone):
SUB sp, sp, #16       ; Must explicitly allocate
STR x0, [sp, #0]      ; Then use
```

---

## 7. Complete Examples

### Example 1: Simple Function

```c
int64_t add(int64_t a, int64_t b) {
    return a + b;
}
```

```asm
add:
    ADD x0, x0, x1
    RET
```

### Example 2: Function with Locals

```c
int64_t sum_and_store(int64_t a, int64_t b, int64_t* result) {
    int64_t sum = a + b;
    *result = sum;
    return sum;
}
```

```asm
sum_and_store:
    ADD x0, x0, x1        ; sum = a + b
    STR x0, [x2]          ; *result = sum
    RET                   ; return sum (already in x0)
```

### Example 3: Function that Calls Others

```c
int64_t process(int64_t x) {
    int64_t a = helper1(x);
    int64_t b = helper2(x);
    return a + b;
}
```

```asm
process:
    ; Prologue
    STP x29, x30, [sp, #-32]!
    MOV x29, sp
    STP x19, x20, [sp, #16]

    MOV x19, x0              ; Save x in callee-saved register

    ; Call helper1(x)
    MOV x0, x19
    BL helper1
    MOV x20, x0              ; Save result a

    ; Call helper2(x)
    MOV x0, x19
    BL helper2               ; b in x0

    ; Return a + b
    ADD x0, x20, x0

    ; Epilogue
    LDP x19, x20, [sp, #16]
    LDP x29, x30, [sp], #32
    RET
```

### Example 4: Many Arguments

```c
int64_t many_args(int64_t a, int64_t b, int64_t c,
                  int64_t d, int64_t e, int64_t f,
                  int64_t g, int64_t h, int64_t i);
// a=x0, b=x1, c=x2, d=x3, e=x4, f=x5, g=x6, h=x7, i=[sp+0]
```

**Caller:**
```asm
    ; Allocate space for stack argument (16-byte aligned)
    SUB sp, sp, #16
    MOV x9, i_val
    STR x9, [sp, #0]          ; 9th argument

    ; Set up register arguments
    MOV x0, a_val
    MOV x1, b_val
    MOV x2, c_val
    MOV x3, d_val
    MOV x4, e_val
    MOV x5, f_val
    MOV x6, g_val
    MOV x7, h_val

    BL many_args

    ADD sp, sp, #16           ; Clean up
```

**Callee:**
```asm
many_args:
    STP x29, x30, [sp, #-16]!
    MOV x29, sp

    ; Sum all arguments
    ADD x0, x0, x1            ; a + b
    ADD x0, x0, x2            ; + c
    ADD x0, x0, x3            ; + d
    ADD x0, x0, x4            ; + e
    ADD x0, x0, x5            ; + f
    ADD x0, x0, x6            ; + g
    ADD x0, x0, x7            ; + h
    LDR x9, [x29, #16]        ; Load i from stack
    ADD x0, x0, x9            ; + i

    LDP x29, x30, [sp], #16
    RET
```

---

## 8. Platform Variations

### macOS ARM64 Differences

Apple's ARM64 has these variations from standard AAPCS64:

| Aspect | Standard AAPCS64 | macOS ARM64 |
|--------|------------------|-------------|
| x18 | Platform register (reserved) | Reserved (Thread Local Storage) |
| Variadic args | Via GPRs/FPRs | All via GPRs after format string |
| System calls | SVC #0 | SVC #0x80 |

### Variadic Functions on macOS

macOS ARM64 passes all variadic arguments in GPRs (not FP registers):

```c
printf("%f", 3.14);
// Standard AAPCS64: format in x0, 3.14 in v0
// macOS ARM64: format in x0, 3.14 as integer bits in x1
```

---

## Summary Tables

### Register Usage Quick Reference

| Register | Argument# | Return | Callee-Saved |
|----------|-----------|--------|--------------|
| x0 | 1 | 1st | No |
| x1 | 2 | 2nd | No |
| x2 | 3 | - | No |
| x3 | 4 | - | No |
| x4 | 5 | - | No |
| x5 | 6 | - | No |
| x6 | 7 | - | No |
| x7 | 8 | - | No |
| x8 | - | (struct ptr) | No |
| x9-x15 | - | - | No |
| x16-x17 | - | - | No |
| x18 | - | - | **Reserved** |
| x19-x28 | - | - | **Yes** |
| x29 | - | - | **Yes** (FP) |
| x30 | - | - | **Yes** (LR) |

### Key Rules Summary

1. **Arguments:** x0-x7, then stack
2. **Return:** x0 (and x1 for 128-bit)
3. **Caller saves:** x0-x18, v0-v7, v16-v31
4. **Callee saves:** x19-x28, x29, x30, v8-v15 (lower 64 bits)
5. **Stack alignment:** 16 bytes **always** (not just at calls)
6. **No red zone:** Always allocate before using stack space
7. **Link register:** Return address in x30, not stack
8. **Large struct returns:** Hidden pointer in x8 (not returned)

### Comparison with System V AMD64

| Aspect | System V AMD64 | AAPCS64 |
|--------|----------------|---------|
| Argument registers | 6 (rdi, rsi, rdx, rcx, r8, r9) | 8 (x0-x7) |
| Return address | On stack (via CALL) | In LR/x30 (via BL) |
| Red zone | 128 bytes | None |
| Stack alignment | 16 bytes at CALL | 16 bytes always |
| Hidden return ptr | rdi (returned in rax) | x8 (not returned) |
| Callee-saved | 6 GPRs | 10 GPRs |

---

*"Eight argument registers, no red zone, 16-byte alignment always."*
