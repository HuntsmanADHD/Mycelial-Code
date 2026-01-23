# x86-64 Instruction Reference

**Owner**: Opus (Claude Opus 4.5)
**Status**: COMPLETE
**Version**: 1.0
**Purpose**: Complete reference for the 48 core x86-64 instructions used by the Mycelial compiler

---

## Overview

This document provides a complete reference for every x86-64 instruction used by the Mycelial compiler. Each instruction includes:
- Description and use cases
- Operand forms
- Flags affected
- Machine code encoding
- Example usage

The 48 instructions are organized into 6 categories:
1. Data Movement (10)
2. Arithmetic (12)
3. Bitwise Logic (8)
4. Comparison & Flags (4)
5. Control Flow (10)
6. System (4)

---

## Encoding Fundamentals

### Instruction Format

```
┌─────────┬─────────┬────────┬─────────┬─────────┬─────────────┐
│ Prefix  │   REX   │ Opcode │ ModR/M  │   SIB   │ Disp/Imm    │
│ (0-4)   │ (0-1)   │ (1-3)  │ (0-1)   │ (0-1)   │ (0-8)       │
└─────────┴─────────┴────────┴─────────┴─────────┴─────────────┘
```

### REX Prefix (0x40-0x4F)

Required for 64-bit operands and extended registers (r8-r15):

```
Bits: 0 1 0 0 W R X B
      └─┬─┘   │ │ │ │
        │     │ │ │ └── B: Extends ModR/M r/m or SIB base (for r8-r15)
        │     │ │ └──── X: Extends SIB index (for r8-r15)
        │     │ └────── R: Extends ModR/M reg (for r8-r15)
        │     └──────── W: 64-bit operand size (1 = 64-bit)
        └────────────── Fixed pattern (0100)
```

| REX Value | Meaning |
|-----------|---------|
| 0x48 | REX.W - 64-bit operand |
| 0x49 | REX.WB - 64-bit + r8-r15 in r/m |
| 0x4C | REX.WR - 64-bit + r8-r15 in reg |
| 0x4D | REX.WRB - 64-bit + r8-r15 in both |

### ModR/M Byte

```
Bits: MM RRR MMM
      │  │   │
      │  │   └── R/M: Register or memory operand (3 bits)
      │  └────── Reg: Register operand or opcode extension (3 bits)
      └───────── Mod: Addressing mode (2 bits)
```

| Mod | Meaning |
|-----|---------|
| 00 | Memory, no displacement (special: r/m=101 is RIP-relative) |
| 01 | Memory + 8-bit signed displacement |
| 10 | Memory + 32-bit signed displacement |
| 11 | Register-to-register (no memory) |

### Register Encoding

| Register | Code | With REX.R/B |
|----------|------|--------------|
| rax/eax/ax/al | 000 | r8 |
| rcx/ecx/cx/cl | 001 | r9 |
| rdx/edx/dx/dl | 010 | r10 |
| rbx/ebx/bx/bl | 011 | r11 |
| rsp/esp/sp/spl | 100 | r12 |
| rbp/ebp/bp/bpl | 101 | r13 |
| rsi/esi/si/sil | 110 | r14 |
| rdi/edi/di/dil | 111 | r15 |

### SIB Byte (Scale-Index-Base)

Used when ModR/M r/m = 100 (would be rsp, but signals SIB follows):

```
Bits: SS III BBB
      │  │   │
      │  │   └── Base register (3 bits)
      │  └────── Index register (3 bits, 100 = no index)
      └───────── Scale: 00=1, 01=2, 10=4, 11=8
```

---

## Category 1: Data Movement (10 Instructions)

### MOV - Move Data

The most fundamental instruction. Copies data between registers and memory.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| mov r64, r64 | REX.W 89 /r | `mov rax, rbx` |
| mov r64, r/m64 | REX.W 8B /r | `mov rax, [rbx]` |
| mov r/m64, r64 | REX.W 89 /r | `mov [rax], rbx` |
| mov r64, imm32 | REX.W C7 /0 | `mov rax, 42` |
| mov r64, imm64 | REX.W B8+rd | `mov rax, 0x123456789` |

**Flags:** None affected

**Encoding Examples:**

```
mov rax, rbx
  48 89 D8
  │  │  └── ModR/M: 11 011 000 (mod=reg, reg=rbx, r/m=rax)
  │  └───── Opcode: 89
  └──────── REX.W

mov rax, [rbx]
  48 8B 03
  │  │  └── ModR/M: 00 000 011 (mod=mem, reg=rax, r/m=rbx)
  │  └───── Opcode: 8B
  └──────── REX.W

mov rax, [rbx + 8]
  48 8B 43 08
  │  │  │  └── Displacement: 8
  │  │  └───── ModR/M: 01 000 011 (mod=mem+disp8, reg=rax, r/m=rbx)
  │  └──────── Opcode: 8B
  └─────────── REX.W

mov rax, [rbx + 256]
  48 8B 83 00 01 00 00
  │  │  │  └───────────── Displacement: 256 (little-endian)
  │  │  └──────────────── ModR/M: 10 000 011 (mod=mem+disp32)
  │  └─────────────────── Opcode: 8B
  └────────────────────── REX.W

mov rax, 0x12345678
  48 C7 C0 78 56 34 12
  │  │  │  └───────────── Immediate (sign-extended to 64-bit)
  │  │  └──────────────── ModR/M: 11 000 000
  │  └─────────────────── Opcode: C7 /0
  └────────────────────── REX.W

mov rax, 0x123456789ABCDEF0
  48 B8 F0 DE BC 9A 78 56 34 12
  │  │  └───────────────────────── 64-bit immediate
  │  └────────────────────────────  Opcode: B8 + 0 (rax)
  └─────────────────────────────── REX.W
```

---

### MOVSX - Move with Sign Extension

Sign-extends a smaller value to fill the destination register.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| movsx r64, r/m8 | REX.W 0F BE /r | `movsx rax, bl` |
| movsx r64, r/m16 | REX.W 0F BF /r | `movsx rax, bx` |
| movsxd r64, r/m32 | REX.W 63 /r | `movsxd rax, ebx` |

**Flags:** None affected

**Encoding:**
```
movsxd rax, ebx
  48 63 C3
  │  │  └── ModR/M: 11 000 011
  │  └───── Opcode: 63
  └──────── REX.W
```

---

### MOVZX - Move with Zero Extension

Zero-extends a smaller value to fill the destination register.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| movzx r64, r/m8 | REX.W 0F B6 /r | `movzx rax, bl` |
| movzx r64, r/m16 | REX.W 0F B7 /r | `movzx rax, bx` |

**Note:** 32-bit operations automatically zero-extend to 64-bit, so `mov eax, ebx` zero-extends.

**Flags:** None affected

---

### LEA - Load Effective Address

Computes an address and stores it in a register (doesn't access memory).

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| lea r64, m | REX.W 8D /r | `lea rax, [rbx + rcx*8 + 16]` |

**Flags:** None affected

**Use Cases:**
- Address calculation without memory access
- Arithmetic: `lea rax, [rax + rax*2]` computes rax * 3
- RIP-relative addressing for position-independent code

**Encoding:**
```
lea rax, [rbx + 8]
  48 8D 43 08

lea rax, [rip + offset]  ; RIP-relative
  48 8D 05 XX XX XX XX
```

---

### PUSH - Push to Stack

Decrements RSP and stores value at [RSP].

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| push r64 | 50+rd | `push rax` |
| push r/m64 | FF /6 | `push [rax]` |
| push imm8 | 6A ib | `push 42` |
| push imm32 | 68 id | `push 0x12345678` |

**Flags:** None affected

**Encoding:**
```
push rax    →  50
push rbx    →  53
push r12    →  41 54
push 42     →  6A 2A
```

---

### POP - Pop from Stack

Loads value from [RSP] and increments RSP.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| pop r64 | 58+rd | `pop rax` |
| pop r/m64 | 8F /0 | `pop [rax]` |

**Flags:** None affected

**Encoding:**
```
pop rax     →  58
pop r15     →  41 5F
```

---

### XCHG - Exchange Values

Atomically swaps two operands.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| xchg rax, r64 | 90+rd | `xchg rax, rbx` |
| xchg r64, r/m64 | REX.W 87 /r | `xchg rax, [rbx]` |

**Flags:** None affected

**Note:** `xchg rax, rax` (opcode 90) is NOP.

---

### CMOVcc - Conditional Move

Moves data only if condition is met. Avoids branch misprediction.

**Forms:**
| Condition | Opcode | Example |
|-----------|--------|---------|
| cmove/cmovz | REX.W 0F 44 /r | `cmovz rax, rbx` |
| cmovne/cmovnz | REX.W 0F 45 /r | `cmovnz rax, rbx` |
| cmovl/cmovnge | REX.W 0F 4C /r | `cmovl rax, rbx` |
| cmovle/cmovng | REX.W 0F 4E /r | `cmovle rax, rbx` |
| cmovg/cmovnle | REX.W 0F 4F /r | `cmovg rax, rbx` |
| cmovge/cmovnl | REX.W 0F 4D /r | `cmovge rax, rbx` |

**Flags:** None affected (reads flags, doesn't modify)

---

### MOVQ - Move Quadword

Same as MOV for 64-bit values. Used in some contexts for clarity.

---

### MOVSXD - Move with Sign-Extend Doubleword

Sign-extends 32-bit to 64-bit.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| movsxd r64, r/m32 | REX.W 63 /r | `movsxd rax, ecx` |

---

## Category 2: Arithmetic (12 Instructions)

### ADD - Addition

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| add r/m64, r64 | REX.W 01 /r | `add rax, rbx` |
| add r64, r/m64 | REX.W 03 /r | `add rax, [rbx]` |
| add r/m64, imm8 | REX.W 83 /0 ib | `add rax, 42` |
| add r/m64, imm32 | REX.W 81 /0 id | `add rax, 100000` |

**Flags:** OF, SF, ZF, AF, CF, PF

**Encoding:**
```
add rax, rbx    →  48 01 D8
add rax, 42     →  48 83 C0 2A
```

---

### SUB - Subtraction

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| sub r/m64, r64 | REX.W 29 /r | `sub rax, rbx` |
| sub r/m64, imm8 | REX.W 83 /5 ib | `sub rax, 42` |

**Flags:** OF, SF, ZF, AF, CF, PF

---

### IMUL - Signed Multiply

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| imul r64, r/m64 | REX.W 0F AF /r | `imul rax, rbx` |
| imul r64, r/m64, imm8 | REX.W 6B /r ib | `imul rax, rbx, 10` |
| imul r64, r/m64, imm32 | REX.W 69 /r id | `imul rax, rbx, 100000` |
| imul r/m64 | REX.W F7 /5 | `imul rbx` (rdx:rax = rax * rbx) |

**Flags:** CF, OF (SF, ZF, AF, PF undefined)

---

### IDIV - Signed Divide

Divides rdx:rax by operand. Quotient in rax, remainder in rdx.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| idiv r/m64 | REX.W F7 /7 | `idiv rbx` |

**Important:** Must sign-extend rax into rdx:rax first using CQO!

```
cqo           ; sign-extend rax to rdx:rax
idiv rbx      ; rax = quotient, rdx = remainder
```

---

### MUL - Unsigned Multiply

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| mul r/m64 | REX.W F7 /4 | `mul rbx` (rdx:rax = rax * rbx) |

---

### DIV - Unsigned Divide

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| div r/m64 | REX.W F7 /6 | `div rbx` |

---

### NEG - Two's Complement Negation

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| neg r/m64 | REX.W F7 /3 | `neg rax` |

**Flags:** CF, OF, SF, ZF, AF, PF

---

### INC - Increment

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| inc r/m64 | REX.W FF /0 | `inc rax` |

**Flags:** OF, SF, ZF, AF, PF (CF unchanged!)

---

### DEC - Decrement

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| dec r/m64 | REX.W FF /1 | `dec rax` |

---

### CQO - Sign-Extend RAX to RDX:RAX

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| cqo | REX.W 99 | `cqo` |

**Usage:** Always use before IDIV.

---

### CDQ - Sign-Extend EAX to EDX:EAX

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| cdq | 99 | `cdq` |

---

### ADC - Add with Carry

Adds with the carry flag included.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| adc r/m64, r64 | REX.W 11 /r | `adc rax, rbx` |

---

## Category 3: Bitwise Logic (8 Instructions)

### AND - Bitwise AND

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| and r/m64, r64 | REX.W 21 /r | `and rax, rbx` |
| and r/m64, imm8 | REX.W 83 /4 ib | `and rax, 0xFF` |

**Flags:** OF=0, CF=0, SF, ZF, PF

---

### OR - Bitwise OR

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| or r/m64, r64 | REX.W 09 /r | `or rax, rbx` |
| or r/m64, imm8 | REX.W 83 /1 ib | `or rax, 0x80` |

**Flags:** OF=0, CF=0, SF, ZF, PF

---

### XOR - Bitwise Exclusive OR

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| xor r/m64, r64 | REX.W 31 /r | `xor rax, rbx` |
| xor r/m64, imm8 | REX.W 83 /6 ib | `xor rax, 0xFF` |

**Special:** `xor eax, eax` (31 C0) is the standard idiom to zero a register.

---

### NOT - Bitwise NOT

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| not r/m64 | REX.W F7 /2 | `not rax` |

**Flags:** None affected

---

### SHL - Shift Left

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| shl r/m64, 1 | REX.W D1 /4 | `shl rax, 1` |
| shl r/m64, imm8 | REX.W C1 /4 ib | `shl rax, 4` |
| shl r/m64, cl | REX.W D3 /4 | `shl rax, cl` |

**Flags:** CF, OF, SF, ZF, PF

---

### SHR - Shift Right (Logical)

Shifts right, filling with zeros.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| shr r/m64, 1 | REX.W D1 /5 | `shr rax, 1` |
| shr r/m64, imm8 | REX.W C1 /5 ib | `shr rax, 4` |
| shr r/m64, cl | REX.W D3 /5 | `shr rax, cl` |

---

### SAR - Shift Right (Arithmetic)

Shifts right, preserving sign bit.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| sar r/m64, 1 | REX.W D1 /7 | `sar rax, 1` |
| sar r/m64, imm8 | REX.W C1 /7 ib | `sar rax, 4` |
| sar r/m64, cl | REX.W D3 /7 | `sar rax, cl` |

---

### ROL - Rotate Left

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| rol r/m64, 1 | REX.W D1 /0 | `rol rax, 1` |
| rol r/m64, imm8 | REX.W C1 /0 ib | `rol rax, 4` |
| rol r/m64, cl | REX.W D3 /0 | `rol rax, cl` |

---

## Category 4: Comparison & Flags (4 Instructions)

### CMP - Compare

Subtracts without storing result, only sets flags.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| cmp r/m64, r64 | REX.W 39 /r | `cmp rax, rbx` |
| cmp r/m64, imm8 | REX.W 83 /7 ib | `cmp rax, 42` |
| cmp r/m64, imm32 | REX.W 81 /7 id | `cmp rax, 100000` |

**Flags:** OF, SF, ZF, AF, CF, PF

---

### TEST - Bitwise AND (Flags Only)

ANDs without storing result, only sets flags. Good for null/zero checks.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| test r/m64, r64 | REX.W 85 /r | `test rax, rbx` |
| test r/m64, imm32 | REX.W F7 /0 id | `test rax, 0x80000000` |

**Common Usage:**
```asm
test rax, rax    ; Check if rax is zero (ZF=1 if zero)
jz is_zero
```

---

### SETcc - Set Byte on Condition

Sets byte to 1 if condition true, 0 otherwise.

| Condition | Opcode | Meaning |
|-----------|--------|---------|
| sete/setz | 0F 94 /0 | ZF=1 (equal) |
| setne/setnz | 0F 95 /0 | ZF=0 (not equal) |
| setl/setnge | 0F 9C /0 | SF!=OF (less, signed) |
| setle/setng | 0F 9E /0 | ZF=1 or SF!=OF |
| setg/setnle | 0F 9F /0 | ZF=0 and SF=OF |
| setge/setnl | 0F 9D /0 | SF=OF |

**Usage:**
```asm
cmp rax, rbx
setl al
movzx rax, al  ; Zero-extend to 64-bit boolean
```

---

### CLC - Clear Carry Flag

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| clc | F8 | `clc` |

---

## Category 5: Control Flow (10 Instructions)

### JMP - Unconditional Jump

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| jmp rel8 | EB cb | `jmp short label` |
| jmp rel32 | E9 cd | `jmp label` |
| jmp r/m64 | FF /4 | `jmp rax` |

---

### Jcc - Conditional Jump

| Condition | Short (rel8) | Near (rel32) | Meaning |
|-----------|--------------|--------------|---------|
| je/jz | 74 cb | 0F 84 cd | ZF=1 |
| jne/jnz | 75 cb | 0F 85 cd | ZF=0 |
| jl/jnge | 7C cb | 0F 8C cd | SF!=OF (signed less) |
| jle/jng | 7E cb | 0F 8E cd | ZF=1 or SF!=OF |
| jg/jnle | 7F cb | 0F 8F cd | ZF=0 and SF=OF |
| jge/jnl | 7D cb | 0F 8D cd | SF=OF |
| jb/jc | 72 cb | 0F 82 cd | CF=1 (unsigned below) |
| jbe | 76 cb | 0F 86 cd | CF=1 or ZF=1 |
| ja | 77 cb | 0F 87 cd | CF=0 and ZF=0 |
| jae | 73 cb | 0F 83 cd | CF=0 |

---

### CALL - Call Procedure

Pushes return address and jumps to target.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| call rel32 | E8 cd | `call function` |
| call r/m64 | FF /2 | `call rax` |

**Important:** Offset is calculated from the byte after the CALL instruction!

---

### RET - Return from Procedure

Pops return address and jumps.

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| ret | C3 | `ret` |
| ret imm16 | C2 iw | `ret 16` |

---

### NOP - No Operation

**Forms:**
| Form | Opcode | Example |
|------|--------|---------|
| nop | 90 | `nop` |

**Multi-byte NOPs:** 66 90, 0F 1F 00, etc. for alignment.

---

## Category 6: System (4 Instructions)

### SYSCALL - System Call

Linux system call interface. Clobbers rcx and r11.

**Form:**
| Form | Opcode | Example |
|------|--------|---------|
| syscall | 0F 05 | `syscall` |

**Calling Convention:**
- rax = syscall number
- Arguments: rdi, rsi, rdx, r10, r8, r9
- Return value: rax (negative = error)
- Clobbered: rcx, r11

**Common Syscalls:**
| Number | Name | Args |
|--------|------|------|
| 0 | read | fd, buf, count |
| 1 | write | fd, buf, count |
| 9 | mmap | addr, len, prot, flags, fd, off |
| 60 | exit | code |

---

### INT - Software Interrupt

**Form:**
| Form | Opcode | Example |
|------|--------|---------|
| int imm8 | CD ib | `int 0x80` |

---

### UD2 - Undefined Instruction

Intentionally triggers an invalid opcode exception.

**Form:**
| Form | Opcode | Example |
|------|--------|---------|
| ud2 | 0F 0B | `ud2` |

---

### HLT - Halt

Stops processor until interrupt.

**Form:**
| Form | Opcode | Example |
|------|--------|---------|
| hlt | F4 | `hlt` |

---

## Quick Reference Tables

### Opcode Summary

| Category | Key Opcodes |
|----------|-------------|
| Data Movement | 89, 8B, 8D, 50-5F |
| Arithmetic | 01, 29, 0F AF, F7 |
| Logic | 21, 09, 31, D1, C1 |
| Compare | 39, 85, 0F 9x |
| Control | E9, 0F 8x, E8, C3 |
| System | 0F 05 |

### ModR/M Quick Reference

| Mod | R/M | Meaning |
|-----|-----|---------|
| 00 | reg | [reg] |
| 00 | 100 | SIB follows |
| 00 | 101 | [rip + disp32] |
| 01 | reg | [reg + disp8] |
| 10 | reg | [reg + disp32] |
| 11 | reg | register |

---

*"48 instructions. Infinite possibilities."*
