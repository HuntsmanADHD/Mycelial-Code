# System V AMD64 ABI Reference

**Owner**: Opus (Claude Opus 4.5)
**Status**: COMPLETE
**Version**: 1.0
**Purpose**: Complete reference for the System V AMD64 calling convention used on Linux, macOS, and BSD

---

## Overview

The System V AMD64 ABI (Application Binary Interface) defines how functions call each other on x86-64 Unix-like systems. This document covers everything needed to generate correct function calls in the Mycelial compiler.

**Applies to:** Linux, macOS (x86-64), FreeBSD, OpenBSD, NetBSD

**Does NOT apply to:** Windows (uses Microsoft x64 ABI)

---

## 1. Register Usage

### General Purpose Registers

| Register | Purpose | Preserved Across Calls? |
|----------|---------|------------------------|
| `rax` | Return value, syscall number | No (caller-saved) |
| `rbx` | Callee-saved register | **Yes** |
| `rcx` | 4th argument, syscall clobbered | No |
| `rdx` | 3rd argument, 2nd return value | No |
| `rsi` | 2nd argument | No |
| `rdi` | 1st argument | No |
| `rbp` | Frame pointer (optional) | **Yes** |
| `rsp` | Stack pointer | **Yes** (special) |
| `r8` | 5th argument | No |
| `r9` | 6th argument | No |
| `r10` | Scratch, syscall uses for 4th arg | No |
| `r11` | Scratch, syscall clobbers | No |
| `r12` | Callee-saved register | **Yes** |
| `r13` | Callee-saved register | **Yes** |
| `r14` | Callee-saved register | **Yes** |
| `r15` | Callee-saved register | **Yes** |

### Caller-Saved vs Callee-Saved

**Caller-Saved (Volatile):** The caller must save these before a call if needed after:
```
rax, rcx, rdx, rsi, rdi, r8, r9, r10, r11
```

**Callee-Saved (Non-Volatile):** The callee must restore these before returning:
```
rbx, rbp, r12, r13, r14, r15
```

### Floating-Point Registers (SSE/AVX)

| Register | Purpose | Preserved? |
|----------|---------|------------|
| `xmm0` | 1st FP arg, FP return | No |
| `xmm1` | 2nd FP arg, 2nd FP return | No |
| `xmm2-xmm7` | FP args 3-8 | No |
| `xmm8-xmm15` | Scratch | No |

**Note:** All XMM registers are caller-saved!

---

## 2. Function Arguments

### Integer/Pointer Arguments

Arguments are passed in registers in this order:

| Argument | Register |
|----------|----------|
| 1st | `rdi` |
| 2nd | `rsi` |
| 3rd | `rdx` |
| 4th | `rcx` |
| 5th | `r8` |
| 6th | `r9` |
| 7th+ | Stack |

### Floating-Point Arguments

| Argument | Register |
|----------|----------|
| 1st-8th | `xmm0` through `xmm7` |
| 9th+ | Stack |

### Mixed Arguments

Integer and floating-point arguments use separate register sequences:

```c
void example(int a, double b, int c, double d);
//           rdi    xmm0     rsi    xmm1
```

### Stack Arguments

When registers are exhausted, remaining arguments go on the stack:

1. Arguments pushed **right-to-left** (last arg pushed first)
2. Each argument aligned to 8 bytes minimum
3. Accessed relative to `rsp` after prologue

```asm
; Calling func(a, b, c, d, e, f, g, h, i)
; a=rdi, b=rsi, c=rdx, d=rcx, e=r8, f=r9
; g, h, i on stack

push i                    ; 3rd stack arg
push h                    ; 2nd stack arg
push g                    ; 1st stack arg [rsp] after pushes
mov r9, f
mov r8, e
mov rcx, d
mov rdx, c
mov rsi, b
mov rdi, a
call func
add rsp, 24               ; Clean up stack args (3 * 8 bytes)
```

### Stack Layout at Call Site

```
    ┌─────────────────────┐ High addresses
    │ Argument 9          │ [rsp + 16] (before call)
    │ Argument 8          │ [rsp + 8]
    │ Argument 7          │ [rsp + 0]
    ├─────────────────────┤
    │ Return Address      │ ← pushed by CALL
    └─────────────────────┘ Low addresses (rsp after call)
```

---

## 3. Return Values

### Integer/Pointer Returns

| Return Type | Register(s) |
|-------------|-------------|
| ≤64 bits | `rax` |
| 64-128 bits | `rax` (low), `rdx` (high) |

### Floating-Point Returns

| Return Type | Register(s) |
|-------------|-------------|
| float/double | `xmm0` |
| Complex/pair | `xmm0`, `xmm1` |

### Struct Returns

**Small structs (≤16 bytes):**
- Returned in registers (rax, rdx and/or xmm0, xmm1)

**Large structs (>16 bytes):**
- Caller allocates space and passes hidden pointer in `rdi`
- Original first argument shifts to `rsi`
- Callee writes to memory and returns pointer in `rax`

```c
// Large struct return
struct Big { char data[32]; };
struct Big create_big(int x);

// Actually called as:
struct Big* create_big(struct Big* hidden, int x);
//                     rdi              rsi
// Returns: rax = hidden
```

---

## 4. Stack Frame

### Frame Layout

```
    High Addresses
    ┌─────────────────────────┐
    │ Stack Argument N        │ [rbp + 16 + (N-7)*8]
    │ ...                     │
    │ Stack Argument 7        │ [rbp + 16]
    ├─────────────────────────┤
    │ Return Address          │ [rbp + 8]
    ├─────────────────────────┤
    │ Saved RBP               │ [rbp]  ← rbp points here
    ├─────────────────────────┤
    │ Local Variable 1        │ [rbp - 8]
    │ Local Variable 2        │ [rbp - 16]
    │ ...                     │
    ├─────────────────────────┤
    │ Saved Callee Registers  │
    ├─────────────────────────┤
    │ Spill Slots             │
    ├─────────────────────────┤
    │ Outgoing Stack Args     │
    │ (16-byte aligned)       │ ← rsp
    └─────────────────────────┘
    Low Addresses
```

### Stack Alignment

**CRITICAL:** The stack must be **16-byte aligned** before every `CALL` instruction.

Since `CALL` pushes an 8-byte return address, the stack is at `16n + 8` when a function starts. The prologue must account for this.

```asm
; At function entry: rsp = 16n + 8 (misaligned)
push rbp              ; rsp = 16n (aligned)
mov rbp, rsp
sub rsp, 0x20         ; Must be multiple of 16!
```

---

## 5. Function Prologue/Epilogue

### Standard Prologue

```asm
function_name:
    push rbp                    ; Save old frame pointer
    mov rbp, rsp                ; Set new frame pointer
    sub rsp, frame_size         ; Allocate locals (16-byte aligned!)

    ; Save callee-saved registers we'll modify
    mov [rbp - 8], rbx
    mov [rbp - 16], r12
    ; ...
```

### Standard Epilogue

```asm
    ; Restore callee-saved registers
    mov r12, [rbp - 16]
    mov rbx, [rbp - 8]

    ; Restore stack and frame pointer
    mov rsp, rbp
    pop rbp
    ret
```

### LEAVE Instruction

`leave` is equivalent to:
```asm
mov rsp, rbp
pop rbp
```

Compact epilogue:
```asm
    leave
    ret
```

### Leaf Function Optimization

Functions that don't call others can skip frame setup:

```asm
leaf_function:
    mov rax, rdi
    add rax, rsi
    ret
```

---

## 6. The Red Zone

### What Is It?

The 128 bytes below `rsp` are the "red zone" - a scratch area that leaf functions can use without adjusting `rsp`.

```
    ├─────────────────────────┤ ← rsp
    │                         │
    │ Red Zone (128 bytes)    │ ← Leaf functions can use
    │                         │
    └─────────────────────────┘ ← rsp - 128
```

### Rules

1. Only **leaf functions** (no calls) can use it
2. Maximum 128 bytes
3. Signal handlers must not use it

### Mycelial Decision

For simplicity in M1, we **don't use the red zone**. Always allocate stack space explicitly.

---

## 7. Position-Independent Code

### RIP-Relative Addressing

Access data relative to the instruction pointer:

```asm
; Load address of global_var
lea rax, [rip + global_var]

; Load value of global_var
mov rax, [rip + global_var]
```

### Encoding

RIP-relative uses ModR/M with mod=00 and r/m=101:

```
mov rax, [rip + offset]
  48 8B 05 XX XX XX XX
```

---

## 8. Variadic Functions

### Calling Variadic Functions

When calling functions like `printf`:

1. Pass fixed arguments normally
2. Set `al` = number of XMM registers used for variadic args

```asm
; printf("x=%d, y=%f\n", 42, 3.14)
lea rdi, [rip + format_string]
mov esi, 42
movsd xmm0, [rip + float_3_14]
mov al, 1                       ; 1 XMM register used
call printf
```

---

## 9. Complete Examples

### Example 1: Simple Function

```c
int64_t add(int64_t a, int64_t b) {
    return a + b;
}
```

```asm
add:
    lea rax, [rdi + rsi]
    ret
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
    push rbp
    mov rbp, rsp

    mov rax, rdi
    add rax, rsi                ; sum = a + b
    mov [rdx], rax              ; *result = sum

    pop rbp
    ret
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
    push rbp
    mov rbp, rsp
    sub rsp, 32
    push rbx

    mov rbx, rdi                ; Save x in callee-saved register

    mov rdi, rbx
    call helper1
    mov [rbp - 8], rax          ; Save result a

    mov rdi, rbx
    call helper2                ; b in rax

    add rax, [rbp - 8]          ; return a + b

    pop rbx
    leave
    ret
```

### Example 4: Many Arguments

```c
int64_t many_args(int64_t a, int64_t b, int64_t c,
                  int64_t d, int64_t e, int64_t f,
                  int64_t g, int64_t h);
```

**Caller:**
```asm
    sub rsp, 16
    mov qword [rsp + 8], h_val  ; 8th arg
    mov qword [rsp], g_val      ; 7th arg
    mov r9, f_val
    mov r8, e_val
    mov rcx, d_val
    mov rdx, c_val
    mov rsi, b_val
    mov rdi, a_val
    call many_args
    add rsp, 16
```

**Callee:**
```asm
many_args:
    push rbp
    mov rbp, rsp

    mov rax, rdi
    add rax, rsi
    add rax, rdx
    add rax, rcx
    add rax, r8
    add rax, r9
    add rax, [rbp + 16]         ; g
    add rax, [rbp + 24]         ; h

    pop rbp
    ret
```

---

## Summary Tables

### Register Usage Quick Reference

| Register | Argument# | Return | Callee-Saved |
|----------|-----------|--------|--------------|
| rdi | 1 | - | No |
| rsi | 2 | - | No |
| rdx | 3 | (2nd) | No |
| rcx | 4 | - | No |
| r8 | 5 | - | No |
| r9 | 6 | - | No |
| rax | - | 1st | No |
| r10 | - | - | No |
| r11 | - | - | No |
| rbx | - | - | **Yes** |
| r12 | - | - | **Yes** |
| r13 | - | - | **Yes** |
| r14 | - | - | **Yes** |
| r15 | - | - | **Yes** |
| rbp | - | - | **Yes** |

### Key Rules Summary

1. **Arguments:** rdi, rsi, rdx, rcx, r8, r9, then stack
2. **Return:** rax (and rdx for 128-bit)
3. **Caller saves:** rax, rcx, rdx, rsi, rdi, r8-r11
4. **Callee saves:** rbx, rbp, r12-r15
5. **Stack alignment:** 16 bytes before CALL
6. **Red zone:** 128 bytes below rsp (leaf functions only)

---

*"The calling convention is the handshake between functions."*
