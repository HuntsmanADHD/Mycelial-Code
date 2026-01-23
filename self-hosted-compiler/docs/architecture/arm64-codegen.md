# ARM64 Code Generation Strategy

**Owner**: Opus (Claude Opus 4.5)
**Status**: COMPLETE
**Version**: 1.0
**Last Updated**: M0 Week 2

---

## Executive Summary

This document defines the complete ARM64 (AArch64) code generation strategy for the Mycelial Native Compiler. ARM64 is a load-store RISC architecture fundamentally different from x86-64's CISC design. This requires distinct instruction selection patterns, different immediate handling, and platform-specific executable generation for Linux (ELF64) and macOS (Mach-O).

**Key differences from x86-64:**
- Fixed 32-bit instruction encoding (no variable-length)
- Load-store architecture (memory only via LDR/STR)
- 31 general-purpose registers (vs 16)
- More complex immediate encoding
- Different calling convention (8 argument registers vs 6)

---

## Table of Contents

1. [ARM64 Architecture Overview](#1-arm64-architecture-overview)
2. [Register Architecture](#2-register-architecture)
3. [Instruction Selection Strategy](#3-instruction-selection-strategy)
4. [Immediate Encoding](#4-immediate-encoding)
5. [Load-Store Patterns](#5-load-store-patterns)
6. [Register Allocation](#6-register-allocation)
7. [Calling Convention (AAPCS64)](#7-calling-convention-aapcs64)
8. [Stack Frame Layout](#8-stack-frame-layout)
9. [Agent Compilation](#9-agent-compilation)
10. [Signal Compilation](#10-signal-compilation)
11. [Executable Generation](#11-executable-generation)
12. [Platform-Specific Details](#12-platform-specific-details)

---

## 1. ARM64 Architecture Overview

### 1.1 Fundamental Characteristics

ARM64 is a **Reduced Instruction Set Computer (RISC)** with these key properties:

| Property | ARM64 | x86-64 |
|----------|-------|--------|
| Instruction size | Fixed 32 bits | Variable 1-15 bytes |
| Memory access | Load-store only | Direct operands |
| Register count | 31 GPRs | 16 GPRs |
| Addressing modes | Limited | Rich |
| Immediate range | Constrained | Flexible |

### 1.2 Load-Store Architecture

ARM64 separates memory access from computation:

```
// ARM64: Two instructions required
LDR x0, [x1]      ; Load from memory
ADD x0, x0, x2    ; Operate on registers

// x86-64: One instruction possible
ADD rax, [rbx]    ; Load + add in one instruction
```

**Implications for Mycelial:**
1. More instructions needed for memory operations
2. Register pressure more critical (need temps for loads)
3. Instruction scheduling opportunities (parallel load/compute)
4. Clear separation in IR between memory and ALU operations

### 1.3 32-Bit Instruction Encoding

Every ARM64 instruction is exactly 32 bits. This constrains:
- Immediate values (limited encoding space)
- Branch distances (26-bit offset = ±128MB)
- No embedded 64-bit constants

```
┌────────────────────────────────────┐
│ 31                               0 │
│ ┌──────┬─────────────────────────┐ │
│ │ Op   │ Instruction-specific    │ │
│ │ code │ fields                  │ │
│ └──────┴─────────────────────────┘ │
└────────────────────────────────────┘
     32 bits (always)
```

---

## 2. Register Architecture

### 2.1 General-Purpose Registers

ARM64 has 31 general-purpose 64-bit registers:

| Register | Name | Purpose | Callee-Saved |
|----------|------|---------|--------------|
| x0-x7 | - | Arguments 1-8, Return value | No |
| x8 | XR | Indirect result register | No |
| x9-x15 | - | Temporary (caller-saved) | No |
| x16 | IP0 | Intra-procedure call scratch | No |
| x17 | IP1 | Intra-procedure call scratch | No |
| x18 | PR | Platform register (reserved) | **Reserved** |
| x19-x28 | - | Callee-saved registers | **Yes** |
| x29 | FP | Frame pointer | **Yes** |
| x30 | LR | Link register (return address) | **Yes** |
| sp | SP | Stack pointer | Special |
| xzr | ZR | Zero register (reads as 0) | N/A |

### 2.2 32-Bit Views

Each 64-bit register has a 32-bit view:

| 64-bit | 32-bit | Notes |
|--------|--------|-------|
| x0-x30 | w0-w30 | Lower 32 bits, zero-extended on write |
| xzr | wzr | 32-bit zero |
| sp | wsp | 32-bit stack pointer (rarely used) |

### 2.3 Mycelial Register Allocation

**10 Allocatable Registers:**
```
x19, x20, x21, x22, x23, x24, x25, x26, x27, x28
```

**Reserved for Mycelial Runtime:**
| Register | Purpose | Notes |
|----------|---------|-------|
| x29 | Frame pointer | Standard ABI |
| x30 | Link register | Return address |
| x19 | Agent context pointer | Like r12 on x86-64 |
| x20 | Signal pool pointer | Like r13 on x86-64 |
| x21 | Scheduler pointer | Like r14 on x86-64 |
| x22 | Current tick pointer | Timing reference |
| sp | Stack pointer | Hardware managed |

**Available for Allocation:**
```
x23, x24, x25, x26, x27, x28, x9, x10, x11, x12
```

### 2.4 SIMD/Floating-Point Registers

32 SIMD registers (128-bit, extendable to 256-bit with SVE):

| Register | Purpose | Callee-Saved |
|----------|---------|--------------|
| v0-v7 | FP arguments, return values | No |
| v8-v15 | Callee-saved (lower 64 bits only) | **Partial** |
| v16-v31 | Temporary | No |

---

## 3. Instruction Selection Strategy

### 3.1 Core Instruction Set (52 Instructions for MVP)

#### Category 1: Data Movement (10 instructions)

| Mnemonic | Description | Encoding |
|----------|-------------|----------|
| MOV | Register to register | ORR Xd, XZR, Xm |
| MOVZ | Move with zero | 1101_0010_1xxx_xxxx |
| MOVK | Move with keep | 1111_0010_1xxx_xxxx |
| MOVN | Move with NOT | 1001_0010_1xxx_xxxx |
| LDR | Load register | 1111_1000_01xx_xxxx |
| LDUR | Load unscaled | 1111_1000_010x_xxxx |
| STR | Store register | 1111_1000_00xx_xxxx |
| STUR | Store unscaled | 1111_1000_000x_xxxx |
| LDP | Load pair | 1010_1001_01xx_xxxx |
| STP | Store pair | 1010_1001_00xx_xxxx |

#### Category 2: Arithmetic (14 instructions)

| Mnemonic | Description | Encoding Pattern |
|----------|-------------|------------------|
| ADD | Add | 1000_1011_0xxx_xxxx |
| ADDS | Add, set flags | 1010_1011_0xxx_xxxx |
| SUB | Subtract | 1100_1011_0xxx_xxxx |
| SUBS | Subtract, set flags | 1110_1011_0xxx_xxxx |
| ADC | Add with carry | 1001_1010_000x_xxxx |
| SBC | Subtract with carry | 1101_1010_000x_xxxx |
| NEG | Negate | SUB Xd, XZR, Xm |
| MUL | Multiply | 1001_1011_000x_xxxx |
| SMULL | Signed multiply long | 1001_1011_001x_xxxx |
| UMULL | Unsigned multiply long | 1001_1011_101x_xxxx |
| SDIV | Signed divide | 1001_1010_110x_xxxx |
| UDIV | Unsigned divide | 1001_1010_110x_xxxx |
| MADD | Multiply-add | 1001_1011_000x_xxxx |
| MSUB | Multiply-subtract | 1001_1011_000x_xxxx |

#### Category 3: Bitwise Logic (8 instructions)

| Mnemonic | Description | Encoding Pattern |
|----------|-------------|------------------|
| AND | Bitwise AND | 1000_1010_0xxx_xxxx |
| ANDS | AND, set flags | 1110_1010_0xxx_xxxx |
| ORR | Bitwise OR | 1010_1010_0xxx_xxxx |
| EOR | Exclusive OR | 1100_1010_0xxx_xxxx |
| BIC | Bit clear | 1000_1010_001x_xxxx |
| ORN | OR NOT | 1010_1010_001x_xxxx |
| EON | Exclusive OR NOT | 1100_1010_001x_xxxx |
| MVN | Move NOT | ORN Xd, XZR, Xm |

#### Category 4: Shift Operations (4 instructions)

| Mnemonic | Description | Encoding Pattern |
|----------|-------------|------------------|
| LSL | Logical shift left | UBFM alias |
| LSR | Logical shift right | UBFM alias |
| ASR | Arithmetic shift right | SBFM alias |
| ROR | Rotate right | EXTR alias |

#### Category 5: Comparison (4 instructions)

| Mnemonic | Description | Encoding |
|----------|-------------|----------|
| CMP | Compare (SUBS) | SUBS XZR, Xn, Xm |
| CMN | Compare negative (ADDS) | ADDS XZR, Xn, Xm |
| TST | Test (ANDS) | ANDS XZR, Xn, Xm |
| CCMP | Conditional compare | 1111_1010_010x_xxxx |

#### Category 6: Control Flow (10 instructions)

| Mnemonic | Description | Encoding Pattern |
|----------|-------------|------------------|
| B | Unconditional branch | 0001_01xx_xxxx_xxxx |
| B.cond | Conditional branch | 0101_0100_xxxx_xxxx |
| BL | Branch with link | 1001_01xx_xxxx_xxxx |
| BR | Branch to register | 1101_0110_0001_1111 |
| BLR | Branch-link register | 1101_0110_0011_1111 |
| RET | Return (BR x30) | 1101_0110_0101_1111 |
| CBZ | Compare-branch zero | 1011_0100_xxxx_xxxx |
| CBNZ | Compare-branch non-zero | 1011_0101_xxxx_xxxx |
| TBZ | Test-branch zero | 0011_0110_xxxx_xxxx |
| TBNZ | Test-branch non-zero | 0011_0111_xxxx_xxxx |

#### Category 7: System (2 instructions)

| Mnemonic | Description | Use |
|----------|-------------|-----|
| SVC | Supervisor call | System calls |
| NOP | No operation | Alignment |

### 3.2 Condition Codes

ARM64 uses these condition codes with B.cond:

| Code | Suffix | Meaning | Flags |
|------|--------|---------|-------|
| 0000 | EQ | Equal | Z=1 |
| 0001 | NE | Not equal | Z=0 |
| 0010 | CS/HS | Carry set / unsigned ≥ | C=1 |
| 0011 | CC/LO | Carry clear / unsigned < | C=0 |
| 0100 | MI | Minus (negative) | N=1 |
| 0101 | PL | Plus (positive or zero) | N=0 |
| 1000 | HI | Unsigned higher | C=1 and Z=0 |
| 1001 | LS | Unsigned lower or same | C=0 or Z=1 |
| 1010 | GE | Signed ≥ | N=V |
| 1011 | LT | Signed < | N≠V |
| 1100 | GT | Signed > | Z=0 and N=V |
| 1101 | LE | Signed ≤ | Z=1 or N≠V |
| 1110 | AL | Always | - |

### 3.3 IR to ARM64 Mapping

| IR Operation | ARM64 Instruction(s) |
|--------------|----------------------|
| IR_LOAD | LDR or LDUR |
| IR_STORE | STR or STUR |
| IR_ADD | ADD or ADDS |
| IR_SUB | SUB or SUBS |
| IR_MUL | MUL |
| IR_DIV_S | SDIV |
| IR_DIV_U | UDIV |
| IR_AND | AND |
| IR_OR | ORR |
| IR_XOR | EOR |
| IR_SHL | LSL |
| IR_SHR | LSR |
| IR_SAR | ASR |
| IR_CMP | CMP (alias for SUBS) |
| IR_BRANCH | B |
| IR_BRANCH_COND | B.cond |
| IR_CALL | BL |
| IR_RET | RET |

---

## 4. Immediate Encoding

### 4.1 The Immediate Problem

ARM64's fixed 32-bit encoding limits immediate values:

| Instruction Type | Immediate Bits | Range |
|------------------|----------------|-------|
| Add/Sub immediate | 12 bits | 0-4095 |
| Logical immediate | Bitmask pattern | Complex |
| Move wide | 16 bits × position | 0-0xFFFF shifted |
| PC-relative | 19-26 bits | ±1MB to ±128MB |

### 4.2 Loading 64-Bit Constants

For arbitrary 64-bit values, use MOVZ + MOVK sequence:

```asm
; Load 0x123456789ABCDEF0 into x0
MOVZ x0, #0xDEF0                ; x0 = 0x000000000000DEF0
MOVK x0, #0x9ABC, LSL #16       ; x0 = 0x000000009ABCDEF0
MOVK x0, #0x5678, LSL #32       ; x0 = 0x000056789ABCDEF0
MOVK x0, #0x1234, LSL #48       ; x0 = 0x123456789ABCDEF0
```

**Optimization:** Check for simpler patterns first:
1. Small positive: MOVZ alone (fits in 16 bits at position 0)
2. Small negative: MOVN with inversion
3. Bitmask pattern: Single ORR with immediate
4. PC-relative: ADR or ADRP + ADD

### 4.3 Bitmask Immediate Encoding

Logical instructions (AND, ORR, EOR) use a special encoding for immediates:

```
Bitmask = Replicate(Rotate(Ones(S+1), R), 64/E)
```

Where:
- **N** (1 bit): Element size selector
- **immr** (6 bits): Rotation amount
- **imms** (6 bits): Number of consecutive ones - 1

Common bitmasks and their encodings:

| Value | Binary Pattern | N:imms:immr |
|-------|----------------|-------------|
| 0x00000001 | single bit | 0:000000:000000 |
| 0xFFFFFFFF | lower 32 | 0:011111:000000 |
| 0x0000FFFF | lower 16 | 0:001111:000000 |
| 0x00FF00FF | repeated | 0:000111:000000 |

### 4.4 Algorithm for Immediate Handling

```python
def encode_immediate(value, instruction_type):
    if instruction_type == "arithmetic":
        if 0 <= value <= 4095:
            return ArithImm(value, shift=0)
        elif 0 <= value <= 4095 * 4096 and value % 4096 == 0:
            return ArithImm(value // 4096, shift=12)
        else:
            return load_constant(value)

    elif instruction_type == "logical":
        bitmask = try_encode_bitmask(value)
        if bitmask:
            return LogicalImm(bitmask)
        else:
            return load_constant(value)

    elif instruction_type == "move":
        return encode_move_wide(value)
```

---

## 5. Load-Store Patterns

### 5.1 Addressing Modes

ARM64 supports several addressing modes:

| Mode | Syntax | Offset Range |
|------|--------|--------------|
| Base | [Xn] | 0 |
| Immediate offset | [Xn, #imm] | -256 to 255 (unscaled) |
| Scaled offset | [Xn, #imm] | 0 to 32760 (×8) |
| Pre-index | [Xn, #imm]! | -256 to 255 |
| Post-index | [Xn], #imm | -256 to 255 |
| Register offset | [Xn, Xm] | - |
| Extended register | [Xn, Wm, SXTW] | - |

### 5.2 Scaled vs Unscaled Loads

```asm
; Scaled: offset must be multiple of size
LDR x0, [x1, #8]     ; Offset is 8 bytes (1 × 8)
LDR x0, [x1, #16]    ; Offset is 16 bytes (2 × 8)

; Unscaled: any offset in range
LDUR x0, [x1, #7]    ; Offset is 7 bytes (not aligned)
LDUR x0, [x1, #-8]   ; Negative offset
```

### 5.3 Load/Store Pair

Efficient for saving/restoring register pairs:

```asm
; Save x29 and x30 (frame pointer and link register)
STP x29, x30, [sp, #-16]!   ; Pre-decrement, store pair

; Restore
LDP x29, x30, [sp], #16     ; Load pair, post-increment
```

### 5.4 Memory Access Patterns for Signals

```asm
; Signal structure at [x20] (signal pool)
; Offset 0:  frequency_id (8 bytes)
; Offset 8:  sender_id (8 bytes)
; Offset 16: timestamp (8 bytes)
; Offset 24: payload_ptr (8 bytes)

signal_read:
    LDR x0, [x20, #0]     ; frequency_id (scaled offset)
    LDR x1, [x20, #8]     ; sender_id
    LDR x2, [x20, #16]    ; timestamp
    LDR x3, [x20, #24]    ; payload_ptr
```

---

## 6. Register Allocation

### 6.1 Linear Scan Allocation (Same Algorithm as x86-64)

ARM64 uses the same linear scan algorithm:

```python
def linear_scan_arm64(intervals, available_regs):
    """
    available_regs = [x23, x24, x25, x26, x27, x28, x9, x10, x11, x12]
    """
    active = []
    allocation = {}

    for interval in sorted(intervals, key=lambda i: i.start):
        # Expire old intervals
        active = [a for a in active if a.end > interval.start]

        used_regs = {allocation[a.var] for a in active}
        free_regs = [r for r in available_regs if r not in used_regs]

        if free_regs:
            allocation[interval.var] = free_regs[0]
            active.append(interval)
        else:
            # Spill the interval ending latest
            spill_target = max(active, key=lambda a: a.end)
            if spill_target.end > interval.end:
                # Spill the longer-living variable
                allocation[interval.var] = allocation[spill_target.var]
                spill_to_stack(spill_target)
                active.remove(spill_target)
                active.append(interval)
            else:
                spill_to_stack(interval)

    return allocation
```

### 6.2 Register Pressure Comparison

ARM64 has lower register pressure than x86-64:

| Aspect | x86-64 | ARM64 |
|--------|--------|-------|
| Total GPRs | 16 | 31 |
| Allocatable | 10 | 10 (conservative) |
| Callee-saved | 6 | 10 |
| Argument regs | 6 | 8 |

We allocate conservatively (10 registers) for consistency, but ARM64 allows expansion.

### 6.3 Spill Code Generation

```asm
; Spill x23 to stack slot at [sp + 16]
STR x23, [sp, #16]

; Reload x23 from stack
LDR x23, [sp, #16]
```

---

## 7. Calling Convention (AAPCS64)

### 7.1 Argument Passing

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

**Floating-point arguments:** v0-v7

### 7.2 Return Values

| Type | Register(s) |
|------|-------------|
| Integer ≤64 bits | x0 |
| Integer 65-128 bits | x0 (low), x1 (high) |
| Float/Double | v0 |
| Complex/pair | v0, v1 |
| Large struct | Via hidden x8 pointer |

### 7.3 Register Preservation

**Caller-saved (volatile):**
```
x0-x18, v0-v7, v16-v31
```

**Callee-saved (non-volatile):**
```
x19-x28, v8-v15 (lower 64 bits only)
```

**Special:**
```
x29 (FP), x30 (LR), sp
```

### 7.4 Stack Alignment

**Critical:** SP must always be 16-byte aligned.

Unlike x86-64, ARM64 requires 16-byte alignment at all times, not just at CALL.

```asm
; Allocating stack space
SUB sp, sp, #32    ; Must be multiple of 16

; WRONG:
SUB sp, sp, #24    ; Would misalign stack (illegal!)
```

### 7.5 Function Call Sequence

**Caller:**
```asm
; Call helper(a, b, c)
MOV x0, x23        ; First argument
MOV x1, x24        ; Second argument
MOV x2, x25        ; Third argument
BL helper          ; Call (saves return address to x30)
; Return value in x0
```

**Callee:**
```asm
helper:
    STP x29, x30, [sp, #-16]!   ; Save frame pointer and link register
    MOV x29, sp                  ; Set up frame pointer

    ; ... function body ...

    LDP x29, x30, [sp], #16      ; Restore FP and LR
    RET                          ; Return via x30
```

---

## 8. Stack Frame Layout

### 8.1 Standard Frame Layout

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
    │ Outgoing Arguments      │
    │ (16-byte aligned)       │ ← sp
    └─────────────────────────┘
    Low Addresses
```

### 8.2 Prologue Pattern

```asm
function_name:
    ; Save frame pointer and link register
    STP x29, x30, [sp, #-frame_size]!
    MOV x29, sp

    ; Save callee-saved registers we'll use
    STP x19, x20, [sp, #16]
    STP x21, x22, [sp, #32]
    ; ...
```

### 8.3 Epilogue Pattern

```asm
    ; Restore callee-saved registers
    LDP x21, x22, [sp, #32]
    LDP x19, x20, [sp, #16]

    ; Restore frame pointer, link register, deallocate frame
    LDP x29, x30, [sp], #frame_size
    RET
```

### 8.4 Leaf Function Optimization

Functions that don't call others can skip frame setup:

```asm
add_numbers:
    ADD x0, x0, x1    ; Simple operation
    RET               ; Return immediately
```

---

## 9. Agent Compilation

### 9.1 Agent Memory Layout (Same as x86-64)

```
Agent Structure (pointed to by x19):
┌────────────────────────────┐ Offset
│ dispatch_table_ptr         │ 0
│ state_ptr                  │ 8
│ inbox_head                 │ 16
│ inbox_tail                 │ 24
│ outbox_head                │ 32
│ outbox_tail                │ 40
│ local_variables[]          │ 48+
└────────────────────────────┘
```

### 9.2 Dispatch Function Structure

```asm
worker_dispatch:
    ; x0 = agent_state_ptr (passed in)
    ; x1 = signal_ptr (passed in)

    ; Set up runtime registers
    STP x29, x30, [sp, #-48]!
    MOV x29, sp
    STP x19, x20, [sp, #16]
    STP x21, x22, [sp, #32]

    MOV x19, x0              ; Agent context
    MOV x20, x1              ; Signal pointer

    ; Load signal frequency_id
    LDR x0, [x20, #0]        ; signal.frequency_id

    ; Dispatch based on frequency
    ; Using compare-branch chain
    MOV x8, #FREQ_HASH_task
    CMP x0, x8
    B.EQ .handler_task

    MOV x8, #FREQ_HASH_result
    CMP x0, x8
    B.EQ .handler_result

    ; Unknown signal - ignore
    B .dispatch_done

.handler_task:
    ; Handle ~task signal
    BL process_task
    B .dispatch_done

.handler_result:
    ; Handle ~result signal
    BL process_result
    B .dispatch_done

.dispatch_done:
    LDP x21, x22, [sp, #32]
    LDP x19, x20, [sp, #16]
    LDP x29, x30, [sp], #48
    RET
```

### 9.3 Dispatch Table Lookup (Alternative)

For many handlers, use indirect branch:

```asm
; x0 = frequency_id (assumed to be table index)
; x8 = dispatch_table_base

    LDR x19, [x0]            ; Agent context
    LDR x20, [x1]            ; Signal pointer
    LDR x9, [x20, #0]        ; frequency_id

    ; Table lookup
    ADRP x8, dispatch_table
    ADD x8, x8, :lo12:dispatch_table
    LSL x9, x9, #3           ; Multiply by 8 (pointer size)
    LDR x10, [x8, x9]        ; Load handler address
    BR x10                   ; Jump to handler
```

### 9.4 State Machine Transitions

```asm
; State stored in agent structure at offset 48 (first local variable)
; States: 0=SENSE, 1=ACT, 2=REST

transition_to_act:
    MOV w0, #1               ; ACT state
    STR w0, [x19, #48]       ; Store in agent.state
    RET

transition_to_rest:
    MOV w0, #2               ; REST state
    STR w0, [x19, #48]
    RET

transition_to_sense:
    MOV w0, #0               ; SENSE state
    STR w0, [x19, #48]
    RET
```

---

## 10. Signal Compilation

### 10.1 Signal Structure (Same as x86-64)

```
Signal Structure (32 bytes):
┌────────────────────┐ Offset
│ frequency_id       │ 0    (8 bytes)
│ sender_id          │ 8    (8 bytes)
│ timestamp          │ 16   (8 bytes)
│ payload_ptr        │ 24   (8 bytes)
└────────────────────┘
```

### 10.2 Emit Signal

```asm
; emit_signal(signal_pool, frequency_id, payload_ptr)
; x0 = signal_pool, x1 = frequency_id, x2 = payload_ptr

emit_signal:
    STP x29, x30, [sp, #-16]!
    MOV x29, sp

    ; Allocate signal from pool
    ; Assume signal_pool has allocation function pointer at offset 0
    LDR x8, [x0, #0]         ; Get allocator function
    BLR x8                   ; Call allocator, returns signal ptr in x0

    ; Fill signal fields
    STR x1, [x0, #0]         ; frequency_id
    LDR x8, [x19, #0]        ; Get sender_id from agent
    STR x8, [x0, #8]         ; sender_id

    ; Get timestamp from scheduler
    LDR x8, [x21, #0]        ; Current tick from scheduler
    STR x8, [x0, #16]        ; timestamp

    STR x2, [x0, #24]        ; payload_ptr

    ; Queue signal
    BL queue_signal

    LDP x29, x30, [sp], #16
    RET
```

### 10.3 Signal Pattern Matching

```asm
; Match: on(~task with {id, priority})
; x20 = signal pointer

match_task_signal:
    ; Check frequency_id
    LDR x0, [x20, #0]
    MOV x8, #FREQ_HASH_task
    CMP x0, x8
    B.NE .no_match

    ; Extract payload fields
    LDR x1, [x20, #24]       ; payload_ptr
    LDR x2, [x1, #0]         ; payload.id
    LDR x3, [x1, #8]         ; payload.priority

    ; Bind to local variables
    STR x2, [x19, #56]       ; agent.locals.id
    STR x3, [x19, #64]       ; agent.locals.priority

    MOV x0, #1               ; Match successful
    RET

.no_match:
    MOV x0, #0               ; No match
    RET
```

---

## 11. Executable Generation

### 11.1 ELF64 for ARM64 Linux

ARM64 Linux uses ELF64 with different machine type:

**Header differences from x86-64:**
| Field | x86-64 Value | ARM64 Value |
|-------|--------------|-------------|
| e_machine | 0x3E (62) | 0xB7 (183) |
| e_entry | 0x401000 | 0x400000 |
| e_flags | 0 | 0 |

### 11.2 ARM64 ELF Header

```
Elf64_Ehdr for ARM64:
Offset  Value           Field
0x00    7F 45 4C 46     Magic: "\x7FELF"
0x04    02              Class: ELFCLASS64
0x05    01              Data: Little endian
0x06    01              Version: 1
0x07    00              OS/ABI: UNIX System V
0x08    00 00 00 00     Padding
        00 00 00 00
0x10    02 00           Type: ET_EXEC
0x12    B7 00           Machine: EM_AARCH64 (183)
0x14    01 00 00 00     Version: 1
0x18    00 00 40 00     Entry point: 0x400000
        00 00 00 00
0x20    40 00 00 00     Program header offset: 64
        00 00 00 00
0x28    00 00 00 00     Section header offset: 0
        00 00 00 00
0x30    00 00 00 00     Flags: 0
0x34    40 00           ELF header size: 64
0x36    38 00           Program header size: 56
0x38    01 00           Number of program headers: 1
0x3A    40 00           Section header size: 64
0x3C    00 00           Number of section headers: 0
0x3E    00 00           Section name string table index: 0
```

### 11.3 Minimal ARM64 Linux Executable

```asm
; Minimal "Hello World" - ARM64 Linux
; Total size: 144 bytes

.text
_start:
    ; write(1, msg, 14)
    MOV x0, #1              ; fd = stdout
    ADR x1, msg             ; buf = message
    MOV x2, #14             ; count = 14
    MOV x8, #64             ; syscall: write
    SVC #0

    ; exit(0)
    MOV x0, #0              ; status = 0
    MOV x8, #93             ; syscall: exit
    SVC #0

msg:
    .ascii "Hello, World!\n"
```

**Machine code:**
```
; Instructions (all 32-bit):
D2800020    ; MOV x0, #1
10000061    ; ADR x1, msg (PC-relative)
D28001C2    ; MOV x2, #14
D2800808    ; MOV x8, #64
D4000001    ; SVC #0
D2800000    ; MOV x0, #0
D2800BA8    ; MOV x8, #93
D4000001    ; SVC #0
; Message (14 bytes)
48 65 6C 6C 6F 2C 20 57 6F 72 6C 64 21 0A
```

### 11.4 System Call Numbers (ARM64 Linux)

| Syscall | Number | Arguments |
|---------|--------|-----------|
| read | 63 | fd, buf, count |
| write | 64 | fd, buf, count |
| open | 56 | path, flags, mode |
| close | 57 | fd |
| mmap | 222 | addr, len, prot, flags, fd, off |
| munmap | 215 | addr, len |
| exit | 93 | status |
| exit_group | 94 | status |
| clone | 220 | flags, stack, ptid, ctid, tls |

**Syscall convention:**
- Syscall number: x8
- Arguments: x0, x1, x2, x3, x4, x5
- Return value: x0
- Invoke: SVC #0

---

## 12. Platform-Specific Details

### 12.1 macOS ARM64 (Apple Silicon)

**Key differences from Linux:**
| Aspect | Linux ARM64 | macOS ARM64 |
|--------|-------------|-------------|
| Executable format | ELF64 | Mach-O |
| System call mechanism | SVC #0 | SVC #0x80 |
| Syscall numbers | Different | BSD-based |
| Memory layout | Different | Different |
| Code signing | Not required | Required |

### 12.2 Mach-O Header Structure

```
mach_header_64:
    magic           0xFEEDFACF    ; MH_MAGIC_64
    cputype         0x0100000C    ; CPU_TYPE_ARM64
    cpusubtype      0x00000000    ; CPU_SUBTYPE_ARM64_ALL
    filetype        0x00000002    ; MH_EXECUTE
    ncmds           varies        ; Number of load commands
    sizeofcmds      varies        ; Total size of load commands
    flags           0x00200085    ; NOUNDEFS|DYLDLINK|TWOLEVEL|PIE
    reserved        0x00000000
```

### 12.3 macOS Syscalls (ARM64)

macOS uses BSD syscall numbers with SVC #0x80:

| Syscall | Number | Notes |
|---------|--------|-------|
| exit | 1 | |
| read | 3 | |
| write | 4 | |
| open | 5 | |
| close | 6 | |
| mmap | 197 | Different from Linux |

```asm
; macOS ARM64 write syscall
MOV x0, #1              ; fd = stdout
ADR x1, msg             ; buf
MOV x2, #14             ; count
MOV x16, #4             ; syscall number in x16
SVC #0x80               ; macOS syscall
```

### 12.4 Cross-Platform Strategy

The Mycelial compiler generates platform-specific code:

```python
def generate_executable(ir, target):
    if target == "linux-arm64":
        return generate_elf64_arm64(ir)
    elif target == "macos-arm64":
        return generate_macho_arm64(ir)
    elif target == "linux-x86-64":
        return generate_elf64_x86_64(ir)
    # ...
```

**Abstraction layers:**
1. IR is platform-independent
2. Instruction selection is arch-specific (x86-64 vs ARM64)
3. Calling convention is ABI-specific
4. Executable format is OS-specific

---

## Appendix A: Complete Instruction Encoding Reference

### A.1 Data Processing (Register)

```
31 30 29 28 27 26 25 24 23 22 21 20      16 15      10 9      5 4      0
┌──┬──┬──┬──────────────┬──┬──┬──────────┬───────────┬─────────┬─────────┐
│sf│op│S │ 0  1  0  1  1│sh│ 0│    Rm    │   imm6    │   Rn    │   Rd    │
└──┴──┴──┴──────────────┴──┴──┴──────────┴───────────┴─────────┴─────────┘

sf  = 1 for 64-bit, 0 for 32-bit
op  = 0 for ADD, 1 for SUB
S   = 1 to set flags
sh  = shift type (00=LSL, 01=LSR, 10=ASR)
Rm  = second source register
imm6 = shift amount
Rn  = first source register
Rd  = destination register
```

### A.2 Data Processing (Immediate)

```
31 30 29 28        23 22 21        10 9        5 4        0
┌──┬──┬──┬──────────┬──┬─────────────┬──────────┬──────────┐
│sf│op│S │1 0 0 0 1 0│sh│    imm12    │    Rn    │    Rd    │
└──┴──┴──┴──────────┴──┴─────────────┴──────────┴──────────┘

sh = 0: imm12 at bit position 0
sh = 1: imm12 at bit position 12 (imm12 << 12)
```

### A.3 Load/Store (Unsigned Offset)

```
31 30 29 28      24 23 22 21          10 9        5 4        0
┌────┬──────────┬──┬──┬───────────────┬──────────┬──────────┐
│size│1 1 1 0 0 1│opc│     imm12     │    Rn    │    Rt    │
└────┴──────────┴──┴──┴───────────────┴──────────┴──────────┘

size = 11 for 64-bit, 10 for 32-bit
opc = 01 for LDR, 00 for STR
imm12 = unsigned offset (scaled by size)
```

### A.4 Branch (Unconditional)

```
31 30   26 25                                               0
┌──┬─────┬──────────────────────────────────────────────────┐
│op│0 0 1 0 1│                  imm26                        │
└──┴─────┴──────────────────────────────────────────────────┘

op = 0 for B (branch), 1 for BL (branch with link)
imm26 = signed offset (×4 to get byte offset)
Range: ±128 MB
```

### A.5 Branch (Conditional)

```
31        24 23        5 4 3    0
┌──────────┬─────────────┬─┬─────┐
│0 1 0 1 0 1 0 0│   imm19   │0│cond │
└──────────┴─────────────┴─┴─────┘

imm19 = signed offset (×4)
cond = condition code (see Section 3.2)
Range: ±1 MB
```

---

## Appendix B: Comparison with x86-64

| Aspect | x86-64 | ARM64 |
|--------|--------|-------|
| Instruction encoding | Variable (1-15 bytes) | Fixed (4 bytes) |
| Memory operands | In most instructions | LDR/STR only |
| Registers | 16 GPRs | 31 GPRs |
| Argument registers | 6 | 8 |
| Zero register | None | xzr |
| Condition flags | Implicit from ops | ADDS/SUBS/etc. |
| Division | idiv (implicit rdx:rax) | SDIV/UDIV (explicit) |
| Multiply-accumulate | No | MADD/MSUB |
| Load pair | No | LDP/STP |
| PC-relative | RIP-relative | ADRP/ADR |

---

## Appendix C: ARM64-Specific Optimizations

### C.1 Conditional Select

Replace simple conditionals with CSEL:

```asm
; if (a > b) x = c; else x = d;
CMP x0, x1           ; Compare a, b
CSEL x2, x3, x4, GT  ; x2 = (GT) ? x3 : x4
```

### C.2 Multiply-Accumulate

Combine multiply and add:

```asm
; x = a * b + c
MADD x0, x1, x2, x3  ; x0 = x1 * x2 + x3

; x = a * b - c
MSUB x0, x1, x2, x3  ; x0 = x3 - x1 * x2
```

### C.3 Address Generation

Use ADRP + ADD for PC-relative addresses:

```asm
; Load address of global_var
ADRP x0, global_var       ; Load page address
ADD x0, x0, :lo12:global_var  ; Add page offset
```

### C.4 Combined Compare-Branch

CBZ/CBNZ/TBZ/TBNZ save an instruction:

```asm
; if (x == 0) goto label
CBZ x0, label        ; Single instruction

; Traditional (2 instructions)
CMP x0, #0
B.EQ label
```

---

## Summary

This document provides the complete ARM64 code generation strategy for the Mycelial Native Compiler:

1. **52 core instructions** for MVP (slightly more than x86-64 due to load-store separation)
2. **10 allocatable registers** (expandable given ARM64's 31 GPRs)
3. **AAPCS64 calling convention** with 8 argument registers
4. **Load-store architecture** requiring explicit memory operations
5. **Fixed 32-bit encoding** with complex immediate handling
6. **Platform support** for Linux (ELF64) and macOS (Mach-O)

The key insight: ARM64's RISC design generates more instructions but with simpler, faster decoding. The compiler's IR remains the same; only instruction selection and encoding differ between x86-64 and ARM64 backends.

---

*"ARM64: More registers, simpler instructions, same beautiful agent code."*
