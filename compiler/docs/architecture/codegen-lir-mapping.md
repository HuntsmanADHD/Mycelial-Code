# Code Generator: LIR to x86-64 Mapping

**Owner**: Opus (Claude Opus 4.5)
**Status**: READY FOR M1 IMPLEMENTATION
**Version**: 1.0
**Purpose**: Complete mapping from Sonnet's LIR instructions to x86-64 assembly

---

## Overview

This document maps every LIR instruction from Sonnet's IR specification to the x86-64 instructions documented in my code generation strategy. This is the implementation blueprint for the Code Generator Agent.

**Input**: LIR functions with virtual registers in SSA form
**Output**: x86-64 assembly with physical registers

---

## 1. LIR Instruction → x86-64 Mapping

### 1.1 Data Movement

| LIR Instruction | x86-64 Assembly | Notes |
|-----------------|-----------------|-------|
| `move dst, src` | `mov dst, src` | Register-to-register |
| `load dst, [addr]` | `mov dst, [addr]` | Memory to register |
| `store [addr], src` | `mov [addr], src` | Register to memory |
| `load_field dst, obj, offset` | `mov dst, [obj + offset]` | Struct field load |
| `store_field obj, offset, src` | `mov [obj + offset], src` | Struct field store |
| `const dst, value` | `mov dst, imm64` | Use MOVABS for 64-bit |

**Encoding Reference**: `x86-64-instructions.md` Section 1

### 1.2 Arithmetic

| LIR Instruction | x86-64 Assembly | Notes |
|-----------------|-----------------|-------|
| `add dst, lhs, rhs` | `mov dst, lhs; add dst, rhs` | Two-address form |
| `sub dst, lhs, rhs` | `mov dst, lhs; sub dst, rhs` | Two-address form |
| `mul dst, lhs, rhs` | `mov rax, lhs; imul rhs; mov dst, rax` | Uses rax |
| `div dst, lhs, rhs` | `mov rax, lhs; cqo; idiv rhs; mov dst, rax` | Uses rax:rdx |
| `mod dst, lhs, rhs` | `mov rax, lhs; cqo; idiv rhs; mov dst, rdx` | Remainder in rdx |
| `neg dst, src` | `mov dst, src; neg dst` | Two's complement |

**Encoding Reference**: `x86-64-instructions.md` Section 2

### 1.3 Logical / Bitwise

| LIR Instruction | x86-64 Assembly | Notes |
|-----------------|-----------------|-------|
| `and dst, lhs, rhs` | `mov dst, lhs; and dst, rhs` | Bitwise AND |
| `or dst, lhs, rhs` | `mov dst, lhs; or dst, rhs` | Bitwise OR |
| `xor dst, lhs, rhs` | `mov dst, lhs; xor dst, rhs` | Bitwise XOR |
| `not dst, src` | `mov dst, src; not dst` | Bitwise NOT |
| `shl dst, src, amt` | `mov dst, src; mov cl, amt; shl dst, cl` | Shift amount in cl |
| `shr dst, src, amt` | `mov dst, src; mov cl, amt; shr dst, cl` | Logical shift right |

**Encoding Reference**: `x86-64-instructions.md` Section 3

### 1.4 Comparison

| LIR Instruction | x86-64 Assembly | Notes |
|-----------------|-----------------|-------|
| `cmp_eq dst, lhs, rhs` | `cmp lhs, rhs; sete al; movzx dst, al` | Set if equal |
| `cmp_ne dst, lhs, rhs` | `cmp lhs, rhs; setne al; movzx dst, al` | Set if not equal |
| `cmp_lt dst, lhs, rhs` | `cmp lhs, rhs; setl al; movzx dst, al` | Set if less (signed) |
| `cmp_le dst, lhs, rhs` | `cmp lhs, rhs; setle al; movzx dst, al` | Set if less or equal |
| `cmp_gt dst, lhs, rhs` | `cmp lhs, rhs; setg al; movzx dst, al` | Set if greater |
| `cmp_ge dst, lhs, rhs` | `cmp lhs, rhs; setge al; movzx dst, al` | Set if greater or equal |

**Encoding Reference**: `x86-64-instructions.md` Section 4

### 1.5 Control Flow

| LIR Instruction | x86-64 Assembly | Notes |
|-----------------|-----------------|-------|
| `jump label` | `jmp label` | Unconditional |
| `branch cond, t, f` | `test cond, cond; jnz t; jmp f` | Conditional |
| `ret value` | `mov rax, value; ret` | Return in rax |
| `ret` (void) | `ret` | No return value |
| `call dst, func, args` | `<arg setup>; call func; mov dst, rax` | See calling convention |

**Encoding Reference**: `x86-64-instructions.md` Section 5

### 1.6 Special Operations

| LIR Instruction | x86-64 Assembly | Notes |
|-----------------|-----------------|-------|
| `alloc dst, size` | `mov rdi, size; call runtime_alloc; mov dst, rax` | Runtime call |
| `free ptr` | `mov rdi, ptr; call runtime_free` | Runtime call |
| `phi dst, [v1,bb1], [v2,bb2]` | (handled by register allocator) | SSA resolution |
| `get_field_addr dst, obj, off` | `lea dst, [obj + off]` | Address calculation |
| `bitcast dst, src, type` | `mov dst, src` | No-op (same bits) |

---

## 2. Register Allocation Strategy

### 2.1 Available Registers (10)

From `x86-64-codegen.md` Section 5:

| Register | Purpose | Allocatable |
|----------|---------|-------------|
| rax | Return value, scratch | Yes (temp) |
| rbx | Callee-saved | Yes |
| rcx | 4th argument | Yes (temp) |
| rdx | 3rd argument | Yes (temp) |
| rsi | 2nd argument | Yes (temp) |
| rdi | 1st argument | Yes (temp) |
| r8 | 5th argument | Yes (temp) |
| r9 | 6th argument | Yes (temp) |
| r10 | Scratch | Yes |
| r11 | Scratch | Yes |
| r12 | Agent context | **Reserved** |
| r13 | Signal pool | **Reserved** |
| r14 | Scheduler | **Reserved** |
| r15 | Callee-saved | Yes |
| rbp | Frame pointer | **Reserved** |
| rsp | Stack pointer | **Reserved** |

**Allocation Order**: r10, r11, rbx, r15, then caller-saved

### 2.2 Linear Scan Algorithm

From `x86-64-codegen.md` Section 5.2:

```python
def linear_scan(intervals):
    active = []
    allocation = {}

    for interval in sorted(intervals, key=lambda i: i.start):
        # Expire old intervals
        active = [a for a in active if a.end > interval.start]

        # Get free registers
        used = {allocation[a.var] for a in active}
        free = [r for r in REGISTERS if r not in used]

        if free:
            allocation[interval.var] = free[0]
            active.append(interval)
        else:
            # Spill longest-living
            spill = max(active, key=lambda a: a.end)
            if spill.end > interval.end:
                allocation[interval.var] = allocation[spill.var]
                emit_spill(spill)
                active.remove(spill)
                active.append(interval)
            else:
                emit_spill(interval)

    return allocation
```

### 2.3 Spill Code Generation

```asm
; Spill register to stack slot
mov [rbp - offset], reg

; Reload from stack slot
mov reg, [rbp - offset]
```

---

## 3. Calling Convention (System V AMD64)

### 3.1 Argument Passing

From `system-v-abi.md`:

| Argument | Register |
|----------|----------|
| 1 | rdi |
| 2 | rsi |
| 3 | rdx |
| 4 | rcx |
| 5 | r8 |
| 6 | r9 |
| 7+ | Stack |

### 3.2 Call Sequence

```asm
; For call dst, func, arg1, arg2, arg3
mov rdi, arg1
mov rsi, arg2
mov rdx, arg3
call func
mov dst, rax
```

### 3.3 Caller-Saved Registers

Must save before call if needed after: `rax, rcx, rdx, rsi, rdi, r8, r9, r10, r11`

### 3.4 Callee-Saved Registers

Must restore before return: `rbx, rbp, r12, r13, r14, r15`

---

## 4. Function Prologue/Epilogue

### 4.1 Standard Prologue

```asm
func_name:
    push rbp
    mov rbp, rsp
    sub rsp, frame_size        ; Must be 16-byte aligned

    ; Save callee-saved registers we use
    mov [rbp - 8], rbx
    mov [rbp - 16], r12
    ; ...
```

### 4.2 Standard Epilogue

```asm
    ; Restore callee-saved registers
    mov r12, [rbp - 16]
    mov rbx, [rbp - 8]

    mov rsp, rbp
    pop rbp
    ret
```

### 4.3 Stack Frame Layout

```
High Address
┌─────────────────────┐
│ Arg 8+              │ [rbp + 24+]
│ Arg 7               │ [rbp + 16]
├─────────────────────┤
│ Return Address      │ [rbp + 8]
├─────────────────────┤
│ Saved RBP           │ [rbp]
├─────────────────────┤
│ Local Variable 1    │ [rbp - 8]
│ Local Variable 2    │ [rbp - 16]
│ ...                 │
├─────────────────────┤
│ Spill Slots         │
├─────────────────────┤
│ Shadow/Scratch      │ [rsp]
└─────────────────────┘
Low Address
```

---

## 5. Complete LIR → x86-64 Translation Example

### 5.1 LIR Input (from IR spec Section 10.1)

```
function greeter_rule_0(state_ptr: *AgentState_greeter, signal_ptr: *Signal) -> void {
bb0:
    %g = bitcast %signal_ptr, *Signal_greeting
    %g_name_ptr = get_field_addr %g, 4
    %g_name = load [%g_name_ptr]
    %template = const "Hello, {}!"
    %formatted = call runtime_format_string, %template, %g_name
    %resp_size = const 16
    %resp_ptr = call runtime_alloc_signal, 2, %resp_size
    %freq_id_ptr = get_field_addr %resp_ptr, 0
    %freq_id_val = const 2
    store [%freq_id_ptr], %freq_id_val
    %msg_ptr = get_field_addr %resp_ptr, 8
    store [%msg_ptr], %formatted
    call runtime_emit_signal, %state_ptr, %resp_ptr
    ret
}
```

### 5.2 Register Allocation

Virtual → Physical mapping:
```
%signal_ptr → rsi (param 2)
%state_ptr → rdi (param 1, save to stack)
%g → rsi (same as signal_ptr, bitcast is no-op)
%g_name_ptr → r10
%g_name → r10 (reuse after load)
%template → rdi (arg 1 for call)
%formatted → rbx (callee-saved, survives calls)
%resp_size → rsi (arg 2)
%resp_ptr → r15 (callee-saved, survives calls)
%freq_id_ptr → r10
%freq_id_val → immediate 2
%msg_ptr → r10
```

### 5.3 x86-64 Assembly Output

```asm
    .section .text
    .global greeter_rule_0
    .type greeter_rule_0, @function

greeter_rule_0:
    ; Prologue
    push rbp
    mov rbp, rsp
    sub rsp, 32                     ; Frame: locals + alignment
    push rbx                        ; Callee-saved
    push r15                        ; Callee-saved

    ; Save state_ptr for later (param 1)
    mov [rbp - 8], rdi

    ; %g = bitcast %signal_ptr (no-op, rsi already has signal_ptr)
    ; %g_name_ptr = get_field_addr %g, 4
    lea r10, [rsi + 4]

    ; %g_name = load [%g_name_ptr]
    mov r10, [r10]

    ; Call runtime_format_string(%template, %g_name)
    lea rdi, [rip + .L_template]    ; arg1: template
    mov rsi, r10                    ; arg2: g_name
    call runtime_format_string
    mov rbx, rax                    ; Save result (callee-saved)

    ; Call runtime_alloc_signal(2, 16)
    mov edi, 2                      ; arg1: freq_id
    mov esi, 16                     ; arg2: size
    call runtime_alloc_signal
    mov r15, rax                    ; Save resp_ptr (callee-saved)

    ; Store freq_id field (offset 0)
    mov dword ptr [r15], 2

    ; Store message field (offset 8)
    mov [r15 + 8], rbx

    ; Call runtime_emit_signal(state_ptr, resp_ptr)
    mov rdi, [rbp - 8]              ; Restore state_ptr
    mov rsi, r15                    ; resp_ptr
    call runtime_emit_signal

    ; Epilogue
    pop r15
    pop rbx
    mov rsp, rbp
    pop rbp
    ret

    .section .rodata
.L_template:
    .asciz "Hello, {}!"
```

---

## 6. Instruction Encoding Quick Reference

### 6.1 Common Encodings

| Instruction | Encoding |
|-------------|----------|
| `push rbx` | `53` |
| `pop rbx` | `5B` |
| `mov rax, rbx` | `48 89 D8` |
| `mov rax, [rbx]` | `48 8B 03` |
| `mov [rbx], rax` | `48 89 03` |
| `add rax, rbx` | `48 01 D8` |
| `sub rax, rbx` | `48 29 D8` |
| `call label` | `E8 xx xx xx xx` |
| `ret` | `C3` |
| `jmp label` | `E9 xx xx xx xx` |
| `je label` | `0F 84 xx xx xx xx` |
| `jne label` | `0F 85 xx xx xx xx` |

### 6.2 REX Prefix

For 64-bit operands: `REX.W = 0x48`

For extended registers (r8-r15):
- REX.R for reg field
- REX.B for r/m or base
- REX.X for index

---

## 7. Implementation Checklist

### 7.1 Phase 1: Basic Operations
- [ ] Implement `move` (register copy)
- [ ] Implement `const` (immediate load)
- [ ] Implement `add`, `sub` (arithmetic)
- [ ] Implement `load`, `store` (memory access)
- [ ] Implement `ret` (function return)

### 7.2 Phase 2: Control Flow
- [ ] Implement `jump` (unconditional)
- [ ] Implement `branch` (conditional)
- [ ] Implement basic block ordering
- [ ] Implement label emission

### 7.3 Phase 3: Function Calls
- [ ] Implement argument marshaling
- [ ] Implement `call` instruction
- [ ] Implement prologue generation
- [ ] Implement epilogue generation
- [ ] Implement callee-saved register preservation

### 7.4 Phase 4: Register Allocation
- [ ] Build live intervals from SSA
- [ ] Implement linear scan allocator
- [ ] Implement spill code insertion
- [ ] Handle two-address instructions (x86-64 quirk)

### 7.5 Phase 5: Testing
- [ ] Generate assembly for hello_world.mycelial
- [ ] Compare with hand-coded reference
- [ ] Pass to Assembler agent
- [ ] Verify executable runs correctly

---

## 8. Alignment with Other Agents

### 8.1 From IR Generator (Sonnet)

I will receive:
```rust
Function {
    name: String,
    params: Vec<(String, Type)>,
    return_type: Type,
    basic_blocks: Vec<BasicBlock>,
}
```

Each basic block contains:
```rust
BasicBlock {
    label: String,
    instructions: Vec<Instruction>,
    terminator: Terminator,
}
```

### 8.2 To Assembler Agent

I will emit:
```
AsmFunction {
    name: String,
    instructions: Vec<AsmInstruction>,
}

AsmInstruction {
    label: Option<String>,
    mnemonic: String,
    operands: Vec<Operand>,
}
```

The Assembler will encode these to machine code bytes.

---

## Summary

This document provides the complete mapping from Sonnet's LIR to x86-64 assembly:

1. **27 LIR instruction types** mapped to x86-64
2. **Linear scan register allocation** with 10 available registers
3. **System V AMD64 calling convention** compliance
4. **Complete translation example** (hello_world rule handler)
5. **Encoding reference** for machine code generation

**Status**: Ready for M1 Week 8-9 implementation.

---

*"Every LIR instruction has a home in x86-64."*
