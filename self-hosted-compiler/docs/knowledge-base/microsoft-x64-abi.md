# Microsoft x64 Calling Convention Reference

**Owner**: Opus (Claude Opus 4.5)
**Status**: COMPLETE
**Version**: 1.0
**Purpose**: Complete reference for the Microsoft x64 calling convention used on Windows

---

## Overview

The Microsoft x64 calling convention is fundamentally different from System V AMD64. This document covers everything needed to generate correct function calls for Windows targets in the Mycelial compiler.

**Applies to:** Windows x64, Windows ARM64 (via emulation), UEFI

**Does NOT apply to:** Linux, macOS, BSD (use System V AMD64)

---

## 1. Key Differences from System V AMD64

| Aspect | System V AMD64 | Microsoft x64 |
|--------|----------------|---------------|
| Argument registers | rdi, rsi, rdx, rcx, r8, r9 | rcx, rdx, r8, r9 |
| Number of reg args | 6 | 4 |
| Shadow space | None | 32 bytes (required!) |
| Red zone | 128 bytes | None |
| Callee-saved XMM | None | xmm6-xmm15 |
| FP arg passing | xmm0-xmm7 (separate) | xmm0-xmm3 (shared with int) |
| Register volatility | Different | Different |

**Critical difference:** Microsoft x64 requires a 32-byte "shadow space" (also called "home space" or "spill space") above the return address, even for functions with fewer than 4 arguments.

---

## 2. Register Usage

### General Purpose Registers

| Register | Purpose | Volatile? |
|----------|---------|-----------|
| rax | Return value, syscall number | **Volatile** |
| rcx | 1st argument | **Volatile** |
| rdx | 2nd argument | **Volatile** |
| r8 | 3rd argument | **Volatile** |
| r9 | 4th argument | **Volatile** |
| r10 | Scratch | **Volatile** |
| r11 | Scratch | **Volatile** |
| rbx | Callee-saved | Non-volatile |
| rbp | Frame pointer (optional) | Non-volatile |
| rsp | Stack pointer | Non-volatile (special) |
| rsi | Callee-saved | Non-volatile |
| rdi | Callee-saved | Non-volatile |
| r12 | Callee-saved | Non-volatile |
| r13 | Callee-saved | Non-volatile |
| r14 | Callee-saved | Non-volatile |
| r15 | Callee-saved | Non-volatile |

### Volatile vs Non-Volatile

**Volatile (Caller-Saved):** Modified freely by callees:
```
rax, rcx, rdx, r8, r9, r10, r11
xmm0, xmm1, xmm2, xmm3, xmm4, xmm5
```

**Non-Volatile (Callee-Saved):** Must be preserved by callees:
```
rbx, rbp, rdi, rsi, r12, r13, r14, r15
xmm6, xmm7, xmm8, xmm9, xmm10, xmm11, xmm12, xmm13, xmm14, xmm15
```

**Key difference from System V:** In Microsoft x64, rdi and rsi are **callee-saved** (not used for arguments!), and xmm6-xmm15 are also callee-saved.

### XMM Registers

| Register | Purpose | Volatile? |
|----------|---------|-----------|
| xmm0 | 1st FP arg, FP return | **Volatile** |
| xmm1 | 2nd FP arg | **Volatile** |
| xmm2 | 3rd FP arg | **Volatile** |
| xmm3 | 4th FP arg | **Volatile** |
| xmm4-xmm5 | Scratch | **Volatile** |
| xmm6-xmm15 | Callee-saved | Non-volatile |

---

## 3. Function Arguments

### Integer/Pointer Arguments

| Argument | Register |
|----------|----------|
| 1st | rcx |
| 2nd | rdx |
| 3rd | r8 |
| 4th | r9 |
| 5th+ | Stack |

### Floating-Point Arguments

| Argument | Register |
|----------|----------|
| 1st | xmm0 |
| 2nd | xmm1 |
| 3rd | xmm2 |
| 4th | xmm3 |
| 5th+ | Stack |

### Unified Argument Slots

**Critical difference from System V:** Integer and floating-point arguments share the same slots!

```c
void example(int a, double b, int c, double d);
//           rcx    xmm1     r8     xmm3
//           slot 1 slot 2   slot 3 slot 4
```

Each argument occupies a slot. The register used depends on the type:
- Integer/pointer → rcx, rdx, r8, r9
- Floating-point → xmm0, xmm1, xmm2, xmm3

The slot number determines which register, regardless of type mixing.

### Stack Arguments

Arguments beyond the 4th go on the stack:

1. Pushed right-to-left (last argument at highest address)
2. 8-byte aligned
3. Located above the shadow space

```asm
; Calling func(a, b, c, d, e, f)
; a=rcx, b=rdx, c=r8, d=r9, e=[rsp+40], f=[rsp+48]

sub rsp, 56              ; 32 (shadow) + 16 (args) + 8 (align)
mov [rsp + 48], f_val    ; 6th argument
mov [rsp + 40], e_val    ; 5th argument
mov r9, d_val
mov r8, c_val
mov rdx, b_val
mov rcx, a_val
call func
add rsp, 56
```

---

## 4. The Shadow Space (Critical!)

### What Is It?

The shadow space is 32 bytes of stack space that the **caller** must allocate for every function call, even if the function takes 0-3 arguments.

```
    ┌─────────────────────┐ High addresses
    │ Stack Argument 6    │ [rsp + 48]
    │ Stack Argument 5    │ [rsp + 40]
    ├─────────────────────┤
    │ Shadow for r9       │ [rsp + 32]  ← Shadow space
    │ Shadow for r8       │ [rsp + 24]    (32 bytes)
    │ Shadow for rdx      │ [rsp + 16]
    │ Shadow for rcx      │ [rsp + 8]
    ├─────────────────────┤
    │ Return Address      │ [rsp + 0]   ← After CALL
    └─────────────────────┘ Low addresses
```

### Why It Exists

1. **Register spilling:** Callee can save register arguments to their home locations
2. **Debugging:** Consistent stack layout for debuggers
3. **Variadic functions:** Arguments always at predictable locations

### Rules

1. Caller **always** allocates 32 bytes minimum
2. Callee **may** use shadow space to store arguments
3. Shadow space is above the return address

```asm
; Callee using shadow space
function_name:
    ; Arguments are in rcx, rdx, r8, r9
    ; Callee can store them in shadow space:
    mov [rsp + 8], rcx     ; Home location for 1st arg
    mov [rsp + 16], rdx    ; Home location for 2nd arg
    mov [rsp + 24], r8     ; Home location for 3rd arg
    mov [rsp + 32], r9     ; Home location for 4th arg
```

---

## 5. Return Values

### Integer/Pointer Returns

| Return Type | Register(s) |
|-------------|-------------|
| ≤64 bits | rax |
| 64-128 bits | Not supported directly |

**Note:** Unlike System V, Microsoft x64 does **not** use rdx for 128-bit integer returns.

### Floating-Point Returns

| Return Type | Register |
|-------------|----------|
| float | xmm0 (lower 32 bits) |
| double | xmm0 (lower 64 bits) |
| __m128 | xmm0 |

### Struct Returns

**Small structs (≤8 bytes):**
- Returned in rax

**Larger structs (>8 bytes):**
- Caller allocates space and passes hidden pointer in rcx
- Original first argument shifts to rdx
- Callee returns the pointer in rax

```c
// Struct larger than 8 bytes
struct Big { char data[16]; };
struct Big create_big(int x);

// Actually called as:
struct Big* create_big(struct Big* hidden, int x);
//                     rcx              rdx
// Returns: rax = hidden
```

---

## 6. Stack Frame

### Frame Layout

```
    High Addresses
    ┌─────────────────────────┐
    │ Stack Argument N        │ [rbp + 16 + 32 + (N-5)*8]
    │ ...                     │
    │ Stack Argument 5        │ [rbp + 48]
    ├─────────────────────────┤
    │ Shadow for r9           │ [rbp + 40]
    │ Shadow for r8           │ [rbp + 32]
    │ Shadow for rdx          │ [rbp + 24]
    │ Shadow for rcx          │ [rbp + 16]
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
    │ (rbx, rsi, rdi, etc.)   │
    ├─────────────────────────┤
    │ Shadow Space (32 bytes) │
    │ for outgoing calls      │
    ├─────────────────────────┤
    │ Outgoing Stack Args     │
    │ (16-byte aligned)       │ ← rsp
    └─────────────────────────┘
    Low Addresses
```

### Stack Alignment

**CRITICAL:** The stack must be **16-byte aligned** before every `CALL` instruction.

Since `CALL` pushes an 8-byte return address, the stack is at `16n + 8` when a function starts.

```asm
; At function entry: rsp = 16n + 8 (misaligned)
push rbp              ; rsp = 16n (aligned)
mov rbp, rsp
sub rsp, 0x40         ; Must maintain alignment (32 shadow + locals)
```

### No Red Zone

**Important:** Microsoft x64 has **no red zone**. Unlike System V's 128-byte scratch area, Windows requires explicit stack allocation.

---

## 7. Function Prologue/Epilogue

### Standard Prologue

```asm
function_name:
    push rbp                    ; Save old frame pointer
    mov rbp, rsp                ; Set new frame pointer
    sub rsp, frame_size         ; Allocate locals + shadow (16-byte aligned!)

    ; Save non-volatile registers we'll modify
    mov [rbp - 8], rbx
    mov [rbp - 16], rsi
    mov [rbp - 24], rdi
    mov [rbp - 32], r12
    ; ...

    ; Optionally store arguments in shadow space
    mov [rbp + 16], rcx         ; 1st arg home
    mov [rbp + 24], rdx         ; 2nd arg home
    mov [rbp + 32], r8          ; 3rd arg home
    mov [rbp + 40], r9          ; 4th arg home
```

### Standard Epilogue

```asm
    ; Restore non-volatile registers
    mov r12, [rbp - 32]
    mov rdi, [rbp - 24]
    mov rsi, [rbp - 16]
    mov rbx, [rbp - 8]

    ; Restore stack and frame pointer
    mov rsp, rbp
    pop rbp
    ret
```

### Leaf Function (No Frame Pointer)

Functions that don't call others can use a simpler form:

```asm
leaf_function:
    sub rsp, 8              ; Align stack (if needed)
    ; ... work ...
    add rsp, 8
    ret
```

---

## 8. Variadic Functions

### Calling Variadic Functions

For variadic functions (like printf), all arguments that could be passed in registers must be **mirrored** in both integer and XMM registers for the first 4 slots:

```asm
; printf("%d %f", 42, 3.14)
sub rsp, 40              ; Shadow space (32) + alignment (8)

lea rcx, [rip + format_string]    ; 1st arg
mov edx, 42                        ; 2nd arg (integer)
movsd xmm2, [rip + float_3_14]    ; 3rd arg in xmm2
mov r8, xmm2                       ; Also copy to r8!

call printf

add rsp, 40
```

The callee doesn't know which are variadic, so it may read from either register depending on the format string.

---

## 9. Windows System Calls

### Using syscall (NT API)

Windows system calls are complex and not typically called directly:

```asm
; Windows syscall (internal, undocumented)
mov r10, rcx            ; syscall clobbers rcx
mov eax, syscall_number ; Syscall number (changes between Windows versions!)
syscall
; Return in rax
```

**Note:** Windows syscall numbers change between versions. Always use ntdll.dll or kernel32.dll instead.

### Using Windows API

Standard approach is calling DLL exports:

```asm
; Call WriteFile(handle, buf, count, &written, NULL)
sub rsp, 56             ; Shadow (32) + 5th arg (8) + align (16)

mov rcx, handle         ; 1st arg: file handle
lea rdx, [buffer]       ; 2nd arg: buffer
mov r8d, count          ; 3rd arg: byte count
lea r9, [written]       ; 4th arg: pointer to bytes written
mov qword [rsp + 32], 0 ; 5th arg: overlapped (NULL)

call WriteFile          ; Import from kernel32.dll

add rsp, 56
```

---

## 10. Complete Examples

### Example 1: Simple Function

```c
int64_t add(int64_t a, int64_t b) {
    return a + b;
}
```

```asm
add:
    lea rax, [rcx + rdx]
    ret
```

### Example 2: Function with Shadow Space Usage

```c
int64_t process(int64_t a, int64_t b, int64_t c, int64_t d) {
    // Use all 4 register arguments
    return a + b + c + d;
}
```

```asm
process:
    ; Store arguments in shadow space (optional, for debugging)
    mov [rsp + 8], rcx
    mov [rsp + 16], rdx
    mov [rsp + 24], r8
    mov [rsp + 32], r9

    ; Compute result
    lea rax, [rcx + rdx]
    add rax, r8
    add rax, r9
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
    sub rsp, 48                 ; 32 (shadow) + 16 (locals, aligned)
    push rbx                    ; Save callee-saved register

    mov rbx, rcx                ; Save x in callee-saved register

    mov rcx, rbx                ; First argument
    call helper1
    mov [rbp - 8], rax          ; Save result a

    mov rcx, rbx
    call helper2                ; b in rax

    add rax, [rbp - 8]          ; return a + b

    pop rbx
    add rsp, 48
    pop rbp
    ret
```

### Example 4: Many Arguments

```c
int64_t many_args(int64_t a, int64_t b, int64_t c,
                  int64_t d, int64_t e, int64_t f);
```

**Caller:**
```asm
    sub rsp, 56              ; 32 (shadow) + 16 (stack args) + 8 (align)
    mov [rsp + 48], f_val    ; 6th argument
    mov [rsp + 40], e_val    ; 5th argument
    mov r9, d_val
    mov r8, c_val
    mov rdx, b_val
    mov rcx, a_val
    call many_args
    add rsp, 56
```

**Callee:**
```asm
many_args:
    ; Arguments: rcx=a, rdx=b, r8=c, r9=d, [rsp+40]=e, [rsp+48]=f
    mov rax, rcx
    add rax, rdx
    add rax, r8
    add rax, r9
    add rax, [rsp + 40]      ; e (after shadow space)
    add rax, [rsp + 48]      ; f
    ret
```

---

## 11. PE Executable Format Notes

### Header Differences from ELF

| Field | ELF Value | PE Value |
|-------|-----------|----------|
| Magic | 0x7F454C46 | "MZ" + PE signature |
| Machine | 0x3E (EM_X86_64) | 0x8664 |
| Entry point | 0x401000 (typical) | 0x140001000 (typical) |
| Base address | 0x400000 | 0x140000000 |

### PE Structure Overview

```
PE Executable:
┌─────────────────────────┐
│ DOS Header (MZ)         │ 64 bytes
├─────────────────────────┤
│ DOS Stub                │ Optional
├─────────────────────────┤
│ PE Signature ("PE\0\0") │ 4 bytes
├─────────────────────────┤
│ COFF File Header        │ 20 bytes
├─────────────────────────┤
│ Optional Header (PE64)  │ 112+ bytes
├─────────────────────────┤
│ Section Headers         │ 40 bytes each
├─────────────────────────┤
│ .text section           │ Code
├─────────────────────────┤
│ .data section           │ Initialized data
├─────────────────────────┤
│ .rdata section          │ Read-only data
├─────────────────────────┤
│ .idata section          │ Import tables
└─────────────────────────┘
```

### COFF File Header

```
typedef struct {
    uint16_t Machine;              // 0x8664 for AMD64
    uint16_t NumberOfSections;
    uint32_t TimeDateStamp;
    uint32_t PointerToSymbolTable;
    uint32_t NumberOfSymbols;
    uint16_t SizeOfOptionalHeader;
    uint16_t Characteristics;      // 0x22 = executable, large addresses
} COFF_FILE_HEADER;
```

### Optional Header (PE64)

```
typedef struct {
    uint16_t Magic;                // 0x20B for PE32+
    uint8_t  MajorLinkerVersion;
    uint8_t  MinorLinkerVersion;
    uint32_t SizeOfCode;
    uint32_t SizeOfInitializedData;
    uint32_t SizeOfUninitializedData;
    uint32_t AddressOfEntryPoint;
    uint32_t BaseOfCode;
    uint64_t ImageBase;            // 0x140000000 typical
    uint32_t SectionAlignment;     // 0x1000
    uint32_t FileAlignment;        // 0x200
    // ... more fields ...
} PE_OPTIONAL_HEADER64;
```

---

## Summary Tables

### Register Usage Quick Reference

| Register | Argument# | Return | Volatile |
|----------|-----------|--------|----------|
| rcx | 1 | - | Yes |
| rdx | 2 | - | Yes |
| r8 | 3 | - | Yes |
| r9 | 4 | - | Yes |
| rax | - | 1st | Yes |
| r10 | - | - | Yes |
| r11 | - | - | Yes |
| rbx | - | - | **No** |
| rsi | - | - | **No** |
| rdi | - | - | **No** |
| r12 | - | - | **No** |
| r13 | - | - | **No** |
| r14 | - | - | **No** |
| r15 | - | - | **No** |
| rbp | - | - | **No** |

### Key Rules Summary

1. **Arguments:** rcx, rdx, r8, r9, then stack
2. **Return:** rax (64-bit), xmm0 (floating-point)
3. **Shadow space:** 32 bytes **always required**
4. **Caller saves:** rax, rcx, rdx, r8-r11, xmm0-xmm5
5. **Callee saves:** rbx, rbp, rdi, rsi, r12-r15, xmm6-xmm15
6. **Stack alignment:** 16 bytes before CALL
7. **No red zone:** Always allocate stack space explicitly
8. **Unified slots:** FP and int args share the same 4 slots

### Comparison with System V AMD64

| Aspect | System V AMD64 | Microsoft x64 |
|--------|----------------|---------------|
| 1st arg | rdi | rcx |
| 2nd arg | rsi | rdx |
| 3rd arg | rdx | r8 |
| 4th arg | rcx | r9 |
| 5th arg | r8 | stack |
| 6th arg | r9 | stack |
| Shadow space | None | 32 bytes |
| Red zone | 128 bytes | None |
| rsi/rdi | Caller-saved | **Callee-saved** |
| xmm6-xmm15 | Caller-saved | **Callee-saved** |

---

*"Four arguments, shadow space always, no red zone."*
