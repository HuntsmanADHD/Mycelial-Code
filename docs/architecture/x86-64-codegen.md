# x86-64 Code Generation Strategy

**Owner**: Opus (Claude Opus 4.5)
**Status**: COMPLETE
**Version**: 1.0
**Date**: 2026-01-01

---

## Philosophy

> *"The compiler speaks directly to the silicon. No intermediaries. No compromises."*

This document specifies how Mycelial's agent-based programs transform into native x86-64 machine code. We're not generating C, we're not calling LLVM—we're emitting the actual bytes that the CPU will execute.

The beauty of this approach:
1. **Total control** over every instruction
2. **No dependencies** on external toolchains
3. **Deep integration** with Mycelial's agent model
4. **Self-hosting** capability (the compiler compiles itself)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [x86-64 Fundamentals](#2-x86-64-fundamentals)
3. [Instruction Selection](#3-instruction-selection)
4. [Register Allocation](#4-register-allocation)
5. [Calling Conventions](#5-calling-conventions)
6. [Stack Frame Layout](#6-stack-frame-layout)
7. [Agent Compilation](#7-agent-compilation)
8. [Signal Compilation](#8-signal-compilation)
9. [ELF64 Generation](#9-elf64-generation)
10. [Instruction Encoding](#10-instruction-encoding)
11. [Implementation Examples](#11-implementation-examples)
12. [Optimization Opportunities](#12-optimization-opportunities)

---

## 1. Architecture Overview

### The Code Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IR (from IR Generator)                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     INSTRUCTION SELECTION                            │
│   IR operations → x86-64 instruction sequences                       │
│   Pattern matching: IR_ADD → add, IR_CALL → call, etc.               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      REGISTER ALLOCATION                             │
│   Virtual registers → Physical registers (rax, rbx, etc.)            │
│   Linear scan algorithm with spilling                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      INSTRUCTION ENCODING                            │
│   x86-64 mnemonics → Raw machine code bytes                          │
│   REX prefixes, ModR/M, SIB, immediates                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        ELF GENERATION                                │
│   Machine code → Executable file                                     │
│   Headers, sections, symbols, relocations                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                          Native Executable
```

### Design Principles

1. **Simplicity First**: Start with a minimal instruction set, expand later
2. **Correctness Over Speed**: Get it working before optimizing
3. **Agent-Centric**: Every design decision considers the agent execution model
4. **Self-Hosting Ready**: The codegen must be expressible in Mycelial itself

---

## 2. x86-64 Fundamentals

### Register Set

x86-64 provides 16 general-purpose 64-bit registers:

| Register | Purpose | Calling Convention |
|----------|---------|-------------------|
| `rax` | Return value, accumulator | Caller-saved |
| `rbx` | General purpose | **Callee-saved** |
| `rcx` | 4th argument, counter | Caller-saved |
| `rdx` | 3rd argument, data | Caller-saved |
| `rsi` | 2nd argument, source index | Caller-saved |
| `rdi` | 1st argument, destination index | Caller-saved |
| `rbp` | Base/frame pointer | **Callee-saved** |
| `rsp` | Stack pointer | **Reserved** |
| `r8` | 5th argument | Caller-saved |
| `r9` | 6th argument | Caller-saved |
| `r10` | Scratch register | Caller-saved |
| `r11` | Scratch register | Caller-saved |
| `r12` | General purpose | **Callee-saved** |
| `r13` | General purpose | **Callee-saved** |
| `r14` | General purpose | **Callee-saved** |
| `r15` | General purpose | **Callee-saved** |

### Register Sub-parts

Each 64-bit register can be accessed as smaller parts:

```
┌────────────────────────────────────────────────────────────────┐
│                            RAX (64-bit)                         │
├────────────────────────────────┬───────────────────────────────┤
│                                │            EAX (32-bit)        │
├────────────────────────────────┼───────────────┬───────────────┤
│                                │               │   AX (16-bit)  │
├────────────────────────────────┼───────────────┼───────┬───────┤
│                                │               │AH(8)  │AL(8)  │
└────────────────────────────────┴───────────────┴───────┴───────┘
```

For r8-r15:
- 64-bit: `r8`, `r9`, ..., `r15`
- 32-bit: `r8d`, `r9d`, ..., `r15d`
- 16-bit: `r8w`, `r9w`, ..., `r15w`
- 8-bit: `r8b`, `r9b`, ..., `r15b`

### Memory Addressing Modes

x86-64 supports rich addressing:

1. **Register Direct**: `mov rax, rbx` — value in register
2. **Immediate**: `mov rax, 42` — constant value
3. **Memory Direct**: `mov rax, [0x1000]` — absolute address
4. **Register Indirect**: `mov rax, [rbx]` — address in register
5. **Base + Displacement**: `mov rax, [rbx + 8]` — base + offset
6. **Base + Index**: `mov rax, [rbx + rcx]` — two registers
7. **Base + Index*Scale + Displacement**: `mov rax, [rbx + rcx*8 + 16]` — full form

For Mycelial, we primarily use modes 1-5. Mode 7 is useful for array access.

---

## 3. Instruction Selection

### Core Instruction Set (48 Instructions)

We define a minimal but complete instruction set for M1. These 48 instructions can express any computation:

#### Data Movement (10 instructions)

| Instruction | Description | Example |
|-------------|-------------|---------|
| `mov` | Move data | `mov rax, rbx` |
| `movsx` | Move with sign-extension | `movsx rax, eax` |
| `movzx` | Move with zero-extension | `movzx rax, al` |
| `lea` | Load effective address | `lea rax, [rbx + 8]` |
| `push` | Push to stack | `push rax` |
| `pop` | Pop from stack | `pop rax` |
| `xchg` | Exchange values | `xchg rax, rbx` |
| `cmovcc` | Conditional move | `cmovz rax, rbx` |
| `movq` | Move quadword (for addresses) | `movq rax, [rip + offset]` |
| `movsxd` | Move with sign-extend dword | `movsxd rax, ecx` |

#### Arithmetic (12 instructions)

| Instruction | Description | Example |
|-------------|-------------|---------|
| `add` | Addition | `add rax, rbx` |
| `sub` | Subtraction | `sub rax, 10` |
| `imul` | Signed multiply | `imul rax, rbx` |
| `idiv` | Signed divide | `idiv rcx` |
| `mul` | Unsigned multiply | `mul rbx` |
| `div` | Unsigned divide | `div rcx` |
| `neg` | Two's complement negate | `neg rax` |
| `inc` | Increment | `inc rax` |
| `dec` | Decrement | `dec rax` |
| `cqo` | Sign-extend rax to rdx:rax | `cqo` |
| `cdq` | Sign-extend eax to edx:eax | `cdq` |
| `adc` | Add with carry | `adc rax, rbx` |

#### Bitwise Logic (8 instructions)

| Instruction | Description | Example |
|-------------|-------------|---------|
| `and` | Bitwise AND | `and rax, rbx` |
| `or` | Bitwise OR | `or rax, 0xFF` |
| `xor` | Bitwise XOR | `xor rax, rax` |
| `not` | Bitwise NOT | `not rax` |
| `shl` | Shift left | `shl rax, 4` |
| `shr` | Shift right (logical) | `shr rax, 1` |
| `sar` | Shift right (arithmetic) | `sar rax, cl` |
| `rol` | Rotate left | `rol rax, 3` |

#### Comparison & Flags (4 instructions)

| Instruction | Description | Example |
|-------------|-------------|---------|
| `cmp` | Compare (sets flags) | `cmp rax, rbx` |
| `test` | Bitwise AND (sets flags) | `test rax, rax` |
| `setcc` | Set byte on condition | `setz al` |
| `clc` | Clear carry flag | `clc` |

#### Control Flow (10 instructions)

| Instruction | Description | Example |
|-------------|-------------|---------|
| `jmp` | Unconditional jump | `jmp label` |
| `je/jz` | Jump if equal/zero | `je target` |
| `jne/jnz` | Jump if not equal/not zero | `jne target` |
| `jl/jnge` | Jump if less (signed) | `jl target` |
| `jle/jng` | Jump if less or equal | `jle target` |
| `jg/jnle` | Jump if greater (signed) | `jg target` |
| `jge/jnl` | Jump if greater or equal | `jge target` |
| `call` | Call function | `call function` |
| `ret` | Return from function | `ret` |
| `nop` | No operation | `nop` |

#### System (4 instructions)

| Instruction | Description | Example |
|-------------|-------------|---------|
| `syscall` | System call (Linux) | `syscall` |
| `int` | Software interrupt | `int 0x80` |
| `ud2` | Undefined instruction (trap) | `ud2` |
| `hlt` | Halt (for debugging) | `hlt` |

### Instruction Selection Patterns

Each IR operation maps to one or more x86-64 instructions:

```
IR_CONST(value, vdst)
  → mov vdst, value

IR_COPY(vsrc, vdst)
  → mov vdst, vsrc

IR_ADD(va, vb, vdst)
  → mov vdst, va
    add vdst, vb

IR_SUB(va, vb, vdst)
  → mov vdst, va
    sub vdst, vb

IR_MUL(va, vb, vdst)
  → mov rax, va
    imul rax, vb
    mov vdst, rax

  OR (3-operand form):
  → imul vdst, va, vb   ; if vb is immediate

IR_DIV(va, vb, vdst)
  → mov rax, va
    cqo                  ; sign-extend to rdx:rax
    idiv vb              ; rax = quotient, rdx = remainder
    mov vdst, rax

IR_MOD(va, vb, vdst)
  → mov rax, va
    cqo
    idiv vb
    mov vdst, rdx        ; remainder

IR_NEG(va, vdst)
  → mov vdst, va
    neg vdst

IR_AND(va, vb, vdst)
  → mov vdst, va
    and vdst, vb

IR_OR(va, vb, vdst)
  → mov vdst, va
    or vdst, vb

IR_XOR(va, vb, vdst)
  → mov vdst, va
    xor vdst, vb

IR_NOT(va, vdst)
  → mov vdst, va
    not vdst

IR_SHL(va, vb, vdst)
  → mov vdst, va
    mov cl, vb           ; shift amount must be in cl
    shl vdst, cl

IR_SHR(va, vb, vdst)
  → mov vdst, va
    mov cl, vb
    shr vdst, cl

IR_CMP_EQ(va, vb, vdst)
  → cmp va, vb
    sete al
    movzx vdst, al

IR_CMP_LT(va, vb, vdst)
  → cmp va, vb
    setl al
    movzx vdst, al

IR_CMP_LE(va, vb, vdst)
  → cmp va, vb
    setle al
    movzx vdst, al

IR_CMP_GT(va, vb, vdst)
  → cmp va, vb
    setg al
    movzx vdst, al

IR_CMP_GE(va, vb, vdst)
  → cmp va, vb
    setge al
    movzx vdst, al

IR_BRANCH(label)
  → jmp label

IR_BRANCH_IF(vcond, label_true, label_false)
  → test vcond, vcond
    jnz label_true
    jmp label_false

IR_LOAD(vaddr, vdst)
  → mov vdst, [vaddr]

IR_STORE(vsrc, vaddr)
  → mov [vaddr], vsrc

IR_CALL(func, args..., vdst)
  → ; set up arguments per ABI
    mov rdi, arg0
    mov rsi, arg1
    mov rdx, arg2
    mov rcx, arg3
    mov r8, arg4
    mov r9, arg5
    ; stack args if > 6
    call func
    mov vdst, rax

IR_RET(vval)
  → mov rax, vval
    ; epilogue
    leave
    ret

IR_ALLOCA(size, vdst)
  → sub rsp, size
    mov vdst, rsp
```

---

## 4. Register Allocation

### Our Register Budget

From the 16 GPRs, we partition them:

**Allocatable Registers (10)**:
- `rax` - Return value, but also general scratch
- `rcx` - 4th arg, general use after args set up
- `rdx` - 3rd arg, general use after args set up
- `rsi` - 2nd arg, general use
- `rdi` - 1st arg, general use
- `r8` - 5th arg, general use
- `r9` - 6th arg, general use
- `r10` - Scratch
- `r11` - Scratch
- `rbx` - Callee-saved, good for long-lived values

**Reserved Registers (6)**:
- `rsp` - Stack pointer (never allocate)
- `rbp` - Frame pointer (for debugging/unwinding)
- `r12` - Agent context pointer (points to hyphal state)
- `r13` - Signal pool pointer (runtime)
- `r14` - Scheduler context (runtime)
- `r15` - Scratch for codegen internals

### Linear Scan Algorithm

We use **Linear Scan Register Allocation** for M1. It's simple, fast, and produces good-enough code.

#### Step 1: Compute Live Intervals

For each virtual register `v`, compute when it's "live" (has a value that may be used later):

```
LiveInterval {
    vreg: VirtualRegister,
    start: InstructionIndex,
    end: InstructionIndex,
    physical_reg: Option<PhysicalRegister>,
    spill_slot: Option<StackOffset>
}
```

Algorithm:
1. Walk instructions in reverse order
2. For each instruction that **uses** `v`: extend interval start to current position
3. For each instruction that **defines** `v`: set interval end to current position

#### Step 2: Sort by Start Position

```
intervals.sort_by(|a, b| a.start.cmp(&b.start))
```

#### Step 3: Linear Scan

```
fn linear_scan_allocate(intervals: &mut [LiveInterval]) {
    let mut active: Vec<&mut LiveInterval> = Vec::new();
    let mut free_regs: Vec<Reg> = [rax, rcx, rdx, rsi, rdi, r8, r9, r10, r11, rbx];
    let mut next_spill_slot = 0;

    for interval in intervals.iter_mut() {
        // Expire old intervals
        active.retain(|i| {
            if i.end < interval.start {
                // This interval ended, free its register
                free_regs.push(i.physical_reg.unwrap());
                false
            } else {
                true
            }
        });

        if free_regs.is_empty() {
            // Need to spill
            // Find the interval that ends furthest in the future
            let spill_candidate = active.iter_mut()
                .max_by_key(|i| i.end)
                .unwrap();

            if spill_candidate.end > interval.end {
                // Spill the candidate, use its register for current
                interval.physical_reg = spill_candidate.physical_reg.take();
                spill_candidate.spill_slot = Some(next_spill_slot);
                next_spill_slot += 8;
            } else {
                // Spill current interval
                interval.spill_slot = Some(next_spill_slot);
                next_spill_slot += 8;
            }
        } else {
            // Assign a free register
            interval.physical_reg = Some(free_regs.pop().unwrap());
            active.push(interval);
            active.sort_by_key(|i| i.end);
        }
    }
}
```

#### Step 4: Generate Spill/Reload Code

After allocation, insert spill and reload instructions:

```
; Before: IR uses virtual register v5 (spilled)
mov rax, [rbp - spill_offset_v5]  ; reload
add rax, rbx
mov [rbp - spill_offset_v5], rax  ; spill back if modified
```

### Register Hints

For better allocation, we add **hints**:
- Function arguments prefer `rdi`, `rsi`, `rdx`, `rcx`, `r8`, `r9`
- Return values prefer `rax`
- Division uses `rax` and `rdx`
- Shift amounts prefer `cl`

---

## 5. Calling Conventions

### System V AMD64 ABI (Linux, macOS, BSD)

This is our primary calling convention.

#### Argument Passing

**Integer/Pointer Arguments** (in order):
1. `rdi` - 1st argument
2. `rsi` - 2nd argument
3. `rdx` - 3rd argument
4. `rcx` - 4th argument
5. `r8` - 5th argument
6. `r9` - 6th argument
7+ Stack (pushed right-to-left)

**Floating-Point Arguments** (if we add FP support):
1. `xmm0` through `xmm7`

#### Return Values

- Integer/pointer: `rax` (and `rdx` for 128-bit values)
- Floating-point: `xmm0` (and `xmm1` for complex)

#### Register Preservation

**Caller-Saved** (call may clobber):
`rax`, `rcx`, `rdx`, `rsi`, `rdi`, `r8`, `r9`, `r10`, `r11`

**Callee-Saved** (function must preserve):
`rbx`, `rbp`, `r12`, `r13`, `r14`, `r15`

#### Stack Alignment

**Critical**: The stack must be 16-byte aligned before `call`.

Since `call` pushes an 8-byte return address, the callee's `rsp` will be at `16n + 8` on entry. The prologue must account for this.

#### Red Zone

On System V, the 128 bytes below `rsp` are the "red zone" - leaf functions can use it without adjusting `rsp`. We won't use this for simplicity.

### Calling Convention in Practice

**Caller side** (calling a function):
```asm
; Save caller-saved registers we care about
push rax
push rcx

; Set up arguments
mov rdi, arg1_value
mov rsi, arg2_value
mov rdx, arg3_value

; Align stack if needed (stack must be 16-byte aligned before call)
; After pushes, check alignment

; Call
call target_function

; Result is in rax

; Restore caller-saved registers
pop rcx
pop rax
```

**Callee side** (function prologue/epilogue):
```asm
function_entry:
    ; Prologue
    push rbp
    mov rbp, rsp
    sub rsp, locals_size    ; Allocate locals (16-byte aligned)

    ; Save callee-saved registers we'll use
    push rbx
    push r12
    ; ... (only if we use them)

    ; Function body
    ; Arguments in rdi, rsi, rdx, rcx, r8, r9
    ; Local variables at [rbp - offset]

    ; ... function code ...

    ; Epilogue
    ; Restore callee-saved registers
    pop r12
    pop rbx

    mov rsp, rbp
    pop rbp
    ret
```

---

## 6. Stack Frame Layout

### Standard Frame Structure

```
    High Addresses
    ┌─────────────────────────┐
    │ Argument 8 (if any)     │ [rbp + 32]
    │ Argument 7 (if any)     │ [rbp + 24]
    ├─────────────────────────┤
    │ Return Address          │ [rbp + 8]   ← pushed by call
    ├─────────────────────────┤
    │ Saved RBP               │ [rbp + 0]   ← rbp points here
    ├─────────────────────────┤
    │ Local Variable 1        │ [rbp - 8]
    │ Local Variable 2        │ [rbp - 16]
    │ Local Variable 3        │ [rbp - 24]
    │ ...                     │
    ├─────────────────────────┤
    │ Saved RBX (if used)     │
    │ Saved R12 (if used)     │
    │ ...                     │
    ├─────────────────────────┤
    │ Spill Slot 1            │
    │ Spill Slot 2            │
    │ ...                     │
    ├─────────────────────────┤
    │ Outgoing Args (if >6)   │
    │ (16-byte aligned)       │ ← rsp
    └─────────────────────────┘
    Low Addresses
```

### Frame Layout Calculation

For each function:

1. **Count local variables** → `locals_size`
2. **Count callee-saved registers used** → `saved_regs_size`
3. **Count spill slots needed** → `spills_size`
4. **Count max outgoing stack arguments** → `outgoing_args_size`

Total frame size:
```
frame_size = align_up(locals_size + saved_regs_size + spills_size + outgoing_args_size, 16)
```

### Optimized Prologue/Epilogue

For **leaf functions** (no calls):
```asm
; Minimal prologue
push rbp
mov rbp, rsp
; Can use red zone for small locals, or:
sub rsp, 16   ; if needed

; ... body ...

; Minimal epilogue
leave         ; equivalent to: mov rsp, rbp; pop rbp
ret
```

For **non-leaf functions**:
```asm
; Full prologue
push rbp
mov rbp, rsp
sub rsp, frame_size

; Save callee-saved regs at known offsets
mov [rbp - 8], rbx
mov [rbp - 16], r12
; ...

; ... body with calls ...

; Restore callee-saved regs
mov rbx, [rbp - 8]
mov r12, [rbp - 16]

; Epilogue
leave
ret
```

---

## 7. Agent Compilation

This is where Mycelial's uniqueness shines. Each **hyphal agent** compiles to a set of native functions.

### Agent Memory Layout

Each hyphal instance has a state struct in memory:

```c
// Generated struct for:
// hyphal worker {
//     state {
//         count: u32
//         name: string
//         items: vec<i64>
//     }
// }

struct HyphalState_worker {
    // Runtime header (24 bytes)
    uint64_t agent_id;        // Unique ID
    uint64_t agent_type;      // Type hash (for dispatch)
    uint64_t flags;           // Status flags

    // User-defined state
    uint32_t count;           // [offset 24]
    uint32_t _pad0;           // Alignment padding
    char* name;               // [offset 32] Pointer to string
    Vec_i64 items;            // [offset 40] Vec struct (ptr, len, cap)
};
```

### Agent as Functions

Each agent compiles to these functions:

1. **Dispatch Function** - Routes signals to handlers
2. **Handler Functions** - One per `on signal(...)` rule
3. **State Initializer** - Sets up initial state

```asm
; Dispatch function: worker_dispatch(state_ptr, signal_ptr)
worker_dispatch:
    push rbp
    mov rbp, rsp

    ; r12 = state pointer (preserved)
    mov r12, rdi
    ; r13 = signal pointer
    mov r13, rsi

    ; Get frequency ID from signal
    mov rax, [r13 + 0]        ; signal.frequency_id

    ; Dispatch based on frequency
    cmp rax, FREQ_HASH_task
    je .handler_task
    cmp rax, FREQ_HASH_stop
    je .handler_stop

    ; Unknown frequency - ignore
    xor eax, eax
    leave
    ret

.handler_task:
    mov rdi, r12              ; state
    mov rsi, r13              ; signal
    call worker_handle_task
    leave
    ret

.handler_stop:
    mov rdi, r12
    mov rsi, r13
    call worker_handle_stop
    leave
    ret
```

### Signal Handler Compilation

A handler like:
```mycelial
on signal(task, t) where t.priority > 5 {
    state.count = state.count + 1
    emit result { value: t.data * 2 }
}
```

Compiles to:
```asm
worker_handle_task:
    push rbp
    mov rbp, rsp
    sub rsp, 32               ; Local space

    ; rdi = state pointer, rsi = signal pointer
    mov r12, rdi              ; Preserve state
    mov r13, rsi              ; Preserve signal

    ; WHERE clause: t.priority > 5
    mov eax, [r13 + 16]       ; t.priority at offset 16
    cmp eax, 5
    jle .skip_handler         ; Guard failed

    ; state.count = state.count + 1
    mov eax, [r12 + 24]       ; state.count at offset 24
    add eax, 1
    mov [r12 + 24], eax

    ; emit result { value: t.data * 2 }
    ; Allocate signal from pool
    mov rdi, [r14]            ; r14 = signal pool pointer
    call signal_pool_alloc    ; rax = new signal
    mov rbx, rax

    ; Set frequency
    mov qword [rbx + 0], FREQ_HASH_result

    ; Set sender
    mov rax, [r12 + 0]        ; state.agent_id
    mov [rbx + 8], rax

    ; Set value: t.data * 2
    mov rax, [r13 + 24]       ; t.data at offset 24
    shl rax, 1                ; * 2
    mov [rbx + 16], rax       ; result.value

    ; Enqueue signal
    mov rdi, [r14 + 8]        ; Signal queue pointer
    mov rsi, rbx
    call signal_queue_push

.skip_handler:
    leave
    ret
```

### State Access Patterns

State fields are accessed via fixed offsets from the state pointer:

```asm
; Read state.count (u32 at offset 24)
mov eax, [r12 + 24]

; Write state.count
mov [r12 + 24], eax

; Read state.name (pointer at offset 32)
mov rax, [r12 + 32]

; Access string data
mov rsi, rax              ; String pointer
call string_length        ; Get length
```

---

## 8. Signal Compilation

### Signal Memory Layout

Signals are small, fixed-size structs:

```c
struct Signal {
    uint64_t frequency_id;    // Hash of frequency name
    uint64_t sender_id;       // Agent ID that emitted
    uint64_t timestamp;       // Cycle number
    // Payload follows (frequency-specific)
};

// For frequency: task { priority: u32, data: i64 }
struct Signal_task {
    uint64_t frequency_id;    // = HASH("task")
    uint64_t sender_id;
    uint64_t timestamp;
    uint32_t priority;        // [offset 24]
    uint32_t _pad;
    int64_t data;             // [offset 32]
};
```

### Signal Emission

The `emit` statement:
```mycelial
emit task { priority: 3, data: 42 }
```

Compiles to:
```asm
    ; Allocate signal
    mov rdi, [r14]            ; Signal pool
    mov rsi, 40               ; Size of Signal_task
    call signal_alloc
    mov rbx, rax              ; rbx = new signal pointer

    ; Set header
    mov qword [rbx + 0], HASH_task    ; frequency_id
    mov rax, [r12 + 0]                ; sender = current agent
    mov [rbx + 8], rax
    mov rax, [r14 + 16]               ; current cycle
    mov [rbx + 16], rax

    ; Set payload
    mov dword [rbx + 24], 3           ; priority = 3
    mov qword [rbx + 32], 42          ; data = 42

    ; Route to destination sockets
    mov rdi, rbx
    call signal_route
```

### Signal Routing

Signals are routed based on the topology:

```asm
signal_route:
    ; rdi = signal pointer
    push rbp
    mov rbp, rsp
    push rbx
    mov rbx, rdi

    ; Look up routing table for this agent
    mov rdi, [rbx + 8]        ; sender_id
    mov rsi, [rbx + 0]        ; frequency_id
    call routing_table_lookup ; rax = destinations array

    ; For each destination
    mov rcx, [rax]            ; destination count
    lea rdi, [rax + 8]        ; destinations array start

.route_loop:
    test rcx, rcx
    jz .route_done

    mov rsi, [rdi]            ; destination agent_id
    push rcx
    push rdi

    mov rdi, rbx              ; signal
    call enqueue_for_agent

    pop rdi
    pop rcx
    add rdi, 8
    dec rcx
    jmp .route_loop

.route_done:
    pop rbx
    leave
    ret
```

---

## 9. ELF64 Generation

We generate standard Linux ELF64 executables.

### ELF Structure Overview

```
┌────────────────────────────────────┐ Offset 0
│ ELF Header (64 bytes)              │
├────────────────────────────────────┤ Offset 64
│ Program Header Table               │
│   - PT_LOAD (code, rx)             │
│   - PT_LOAD (data, rw)             │
├────────────────────────────────────┤
│ .text Section (machine code)       │ ← Entry point
│   - _start                         │
│   - main                           │
│   - agent functions                │
│   - runtime functions              │
├────────────────────────────────────┤
│ .rodata Section (constants)        │
│   - String literals                │
│   - Frequency hash table           │
│   - Routing tables                 │
├────────────────────────────────────┤
│ .data Section (initialized data)   │
│   - Global state                   │
├────────────────────────────────────┤
│ .bss Section (zero-initialized)    │ (not in file)
│   - Agent state buffers            │
│   - Signal pools                   │
├────────────────────────────────────┤
│ Section Header Table (optional)    │
└────────────────────────────────────┘
```

### ELF Header

```c
typedef struct {
    unsigned char e_ident[16];    // Magic number and info
    uint16_t e_type;              // ET_EXEC (2)
    uint16_t e_machine;           // EM_X86_64 (0x3E)
    uint32_t e_version;           // 1
    uint64_t e_entry;             // Entry point address
    uint64_t e_phoff;             // Program header offset
    uint64_t e_shoff;             // Section header offset
    uint32_t e_flags;             // 0
    uint16_t e_ehsize;            // 64
    uint16_t e_phentsize;         // 56
    uint16_t e_phnum;             // Number of program headers
    uint16_t e_shentsize;         // 64
    uint16_t e_shnum;             // Number of section headers
    uint16_t e_shstrndx;          // Section name string table index
} Elf64_Ehdr;

// e_ident values:
// [0-3]:  0x7F 'E' 'L' 'F'   (magic)
// [4]:    2                   (64-bit)
// [5]:    1                   (little-endian)
// [6]:    1                   (ELF version)
// [7]:    0                   (OS/ABI: SYSV)
// [8-15]: 0                   (padding)
```

### Program Header

```c
typedef struct {
    uint32_t p_type;              // PT_LOAD (1)
    uint32_t p_flags;             // PF_R|PF_X (5) or PF_R|PF_W (6)
    uint64_t p_offset;            // Offset in file
    uint64_t p_vaddr;             // Virtual address
    uint64_t p_paddr;             // Physical address (= vaddr)
    uint64_t p_filesz;            // Size in file
    uint64_t p_memsz;             // Size in memory
    uint64_t p_align;             // Alignment (0x1000)
} Elf64_Phdr;
```

### Minimal _start

```asm
; Entry point - sets up stack and calls main
_start:
    xor rbp, rbp              ; Clear frame pointer (end of stack)

    ; argc at [rsp], argv at [rsp+8]
    mov rdi, [rsp]            ; argc
    lea rsi, [rsp + 8]        ; argv

    ; Align stack to 16 bytes
    and rsp, -16

    ; Call mycelial_main (our entry point)
    call mycelial_main

    ; Exit with return value
    mov rdi, rax              ; Exit code
    mov rax, 60               ; sys_exit
    syscall

    ; Should never reach here
    hlt
```

### System Call Interface

Essential Linux syscalls:

| Syscall | Number | Arguments |
|---------|--------|-----------|
| `read` | 0 | fd, buf, count |
| `write` | 1 | fd, buf, count |
| `open` | 2 | filename, flags, mode |
| `close` | 3 | fd |
| `mmap` | 9 | addr, len, prot, flags, fd, offset |
| `munmap` | 11 | addr, len |
| `brk` | 12 | addr |
| `exit` | 60 | code |

```asm
; write(1, message, length)
write_stdout:
    mov rax, 1                ; sys_write
    mov rdi, 1                ; stdout
    ; rsi = buffer (already set by caller)
    ; rdx = length (already set by caller)
    syscall
    ret

; mmap(NULL, size, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0)
mmap_anonymous:
    mov rax, 9                ; sys_mmap
    xor rdi, rdi              ; addr = NULL
    ; rsi = size (set by caller)
    mov rdx, 3                ; PROT_READ | PROT_WRITE
    mov r10, 0x22             ; MAP_PRIVATE | MAP_ANONYMOUS
    mov r8, -1                ; fd = -1
    xor r9, r9                ; offset = 0
    syscall
    ret

; exit(code)
exit:
    mov rax, 60               ; sys_exit
    ; rdi = code (set by caller)
    syscall
    ; no return
```

---

## 10. Instruction Encoding

This section details how to encode x86-64 instructions to bytes.

### Encoding Overview

x86-64 instructions have variable length (1-15 bytes):

```
┌─────────┬─────────┬────────┬─────┬──────────────┬─────────────┐
│ Prefixes│   REX   │ Opcode │ModRM│     SIB      │ Disp/Imm    │
│ (0-4)   │ (0-1)   │ (1-3)  │(0-1)│    (0-1)     │   (0-8)     │
└─────────┴─────────┴────────┴─────┴──────────────┴─────────────┘
```

### REX Prefix

Required for 64-bit operations and accessing r8-r15:

```
Bit layout: 0100 W R X B
            │    │ │ │ │
            │    │ │ │ └─ B: Extension of ModRM r/m or SIB base
            │    │ │ └─── X: Extension of SIB index
            │    │ └───── R: Extension of ModRM reg
            │    └─────── W: 64-bit operand size
            └──────────── Fixed pattern (0100)
```

Examples:
- `REX.W` (0x48): 64-bit operand size
- `REX.WB` (0x49): 64-bit + r8-r15 as r/m
- `REX.WR` (0x4C): 64-bit + r8-r15 as reg

### ModR/M Byte

Specifies register and addressing mode:

```
Bit layout: MM RRR MMM
            │  │   │
            │  │   └─ R/M field (register or memory addressing)
            │  └───── Reg field (register or opcode extension)
            └──────── Mod field (addressing mode)
```

Mod values:
- `00`: Memory, no displacement (or RIP-relative if r/m=101)
- `01`: Memory + 8-bit displacement
- `10`: Memory + 32-bit displacement
- `11`: Register-to-register

Register encoding:
| Reg | Code | Extended (REX.R/B) |
|-----|------|-------------------|
| rax | 000 | r8 |
| rcx | 001 | r9 |
| rdx | 010 | r10 |
| rbx | 011 | r11 |
| rsp | 100 | r12 |
| rbp | 101 | r13 |
| rsi | 110 | r14 |
| rdi | 111 | r15 |

### SIB Byte (Scale-Index-Base)

Used for complex addressing modes:

```
Bit layout: SS III BBB
            │  │   │
            │  │   └─ Base register
            │  └───── Index register
            └──────── Scale (1, 2, 4, or 8)
```

### Common Encodings

**mov rax, rbx** (register to register):
```
48 89 D8
│  │  │
│  │  └─ ModR/M: 11 011 000 (mod=reg, reg=rbx, r/m=rax)
│  └──── Opcode: 89 (mov r/m64, r64)
└─────── REX.W (64-bit mode)
```

**mov rax, [rbx]** (memory to register):
```
48 8B 03
│  │  │
│  │  └─ ModR/M: 00 000 011 (mod=mem, reg=rax, r/m=rbx)
│  └──── Opcode: 8B (mov r64, r/m64)
└─────── REX.W
```

**mov rax, [rbx + 8]** (memory with displacement):
```
48 8B 43 08
│  │  │  │
│  │  │  └─ 8-bit displacement (8)
│  │  └──── ModR/M: 01 000 011 (mod=mem+disp8, reg=rax, r/m=rbx)
│  └─────── Opcode: 8B
└────────── REX.W
```

**mov rax, 0x12345678** (immediate):
```
48 C7 C0 78 56 34 12
│  │  │  └───────────── 32-bit immediate (sign-extended)
│  │  └──────────────── ModR/M: 11 000 000 (mod=reg, reg=0, r/m=rax)
│  └─────────────────── Opcode: C7 (mov r/m64, imm32)
└────────────────────── REX.W
```

**mov rax, 0x123456789ABCDEF0** (64-bit immediate):
```
48 B8 F0 DE BC 9A 78 56 34 12
│  │  └────────────────────────── 64-bit immediate
│  └───────────────────────────── Opcode: B8+rd (mov r64, imm64)
└──────────────────────────────── REX.W
```

### Encoding Functions

```mycelial
fn encode_mov_reg_reg(dst: Reg, src: Reg) -> vec<u8> {
    let bytes = vec_new()

    // REX prefix
    let rex = 0x48
    if reg_is_extended(src) { rex = rex | 0x04 }  // REX.R
    if reg_is_extended(dst) { rex = rex | 0x01 }  // REX.B
    vec_push(bytes, rex)

    // Opcode
    vec_push(bytes, 0x89)

    // ModR/M: mod=11 (register), reg=src, r/m=dst
    let modrm = 0xC0 | ((reg_code(src) & 7) << 3) | (reg_code(dst) & 7)
    vec_push(bytes, modrm)

    bytes
}

fn encode_mov_reg_imm64(dst: Reg, imm: i64) -> vec<u8> {
    let bytes = vec_new()

    // REX prefix
    let rex = 0x48
    if reg_is_extended(dst) { rex = rex | 0x01 }
    vec_push(bytes, rex)

    // Opcode: B8 + register code
    vec_push(bytes, 0xB8 + (reg_code(dst) & 7))

    // 64-bit immediate (little-endian)
    vec_push(bytes, (imm >> 0) & 0xFF)
    vec_push(bytes, (imm >> 8) & 0xFF)
    vec_push(bytes, (imm >> 16) & 0xFF)
    vec_push(bytes, (imm >> 24) & 0xFF)
    vec_push(bytes, (imm >> 32) & 0xFF)
    vec_push(bytes, (imm >> 40) & 0xFF)
    vec_push(bytes, (imm >> 48) & 0xFF)
    vec_push(bytes, (imm >> 56) & 0xFF)

    bytes
}

fn encode_add_reg_reg(dst: Reg, src: Reg) -> vec<u8> {
    let bytes = vec_new()

    let rex = 0x48
    if reg_is_extended(src) { rex = rex | 0x04 }
    if reg_is_extended(dst) { rex = rex | 0x01 }
    vec_push(bytes, rex)

    vec_push(bytes, 0x01)  // add r/m64, r64

    let modrm = 0xC0 | ((reg_code(src) & 7) << 3) | (reg_code(dst) & 7)
    vec_push(bytes, modrm)

    bytes
}

fn encode_call_rel32(offset: i32) -> vec<u8> {
    let bytes = vec_new()
    vec_push(bytes, 0xE8)  // call rel32

    // 32-bit signed offset (little-endian)
    vec_push(bytes, (offset >> 0) & 0xFF)
    vec_push(bytes, (offset >> 8) & 0xFF)
    vec_push(bytes, (offset >> 16) & 0xFF)
    vec_push(bytes, (offset >> 24) & 0xFF)

    bytes
}

fn encode_jmp_rel32(offset: i32) -> vec<u8> {
    let bytes = vec_new()
    vec_push(bytes, 0xE9)  // jmp rel32

    vec_push(bytes, (offset >> 0) & 0xFF)
    vec_push(bytes, (offset >> 8) & 0xFF)
    vec_push(bytes, (offset >> 16) & 0xFF)
    vec_push(bytes, (offset >> 24) & 0xFF)

    bytes
}

fn encode_ret() -> vec<u8> {
    vec_from([0xC3])
}

fn encode_syscall() -> vec<u8> {
    vec_from([0x0F, 0x05])
}
```

---

## 11. Implementation Examples

### Example 1: Hello World

Source:
```mycelial
network HelloWorld {
    hyphae {
        hyphal greeter {
            on signal(start, _) {
                emit message { text: "Hello, World!" }
            }
        }
    }
}
```

Generated assembly:
```asm
section .data
    msg: db "Hello, World!", 10
    msg_len equ $ - msg

section .text
global _start

_start:
    ; Write "Hello, World!\n" to stdout
    mov rax, 1                ; sys_write
    mov rdi, 1                ; stdout
    lea rsi, [rel msg]        ; message
    mov rdx, msg_len          ; length
    syscall

    ; Exit with code 0
    mov rax, 60               ; sys_exit
    xor rdi, rdi              ; code = 0
    syscall
```

Machine code (hexdump):
```
0000: 48 C7 C0 01 00 00 00    mov rax, 1
0007: 48 C7 C7 01 00 00 00    mov rdi, 1
000E: 48 8D 35 XX XX XX XX    lea rsi, [rip + msg_offset]
0015: 48 C7 C2 0E 00 00 00    mov rdx, 14
001C: 0F 05                   syscall
001E: 48 C7 C0 3C 00 00 00    mov rax, 60
0025: 48 31 FF                xor rdi, rdi
0028: 0F 05                   syscall
```

### Example 2: Simple Counter Agent

Source:
```mycelial
hyphal counter {
    state {
        count: i64 = 0
    }

    on signal(increment, i) {
        state.count = state.count + i.amount
    }

    on signal(get, _) {
        emit value { result: state.count }
    }
}
```

Generated dispatch function:
```asm
counter_dispatch:
    push rbp
    mov rbp, rsp
    push r12
    push r13

    mov r12, rdi              ; state pointer
    mov r13, rsi              ; signal pointer

    ; Get frequency from signal
    mov rax, [r13]

    ; Dispatch
    mov rcx, HASH_increment
    cmp rax, rcx
    je .handle_increment

    mov rcx, HASH_get
    cmp rax, rcx
    je .handle_get

    ; Unknown - return
    xor eax, eax
    jmp .return

.handle_increment:
    ; state.count += signal.amount
    mov rax, [r12 + 24]       ; state.count
    add rax, [r13 + 24]       ; + signal.amount
    mov [r12 + 24], rax
    mov eax, 1                ; success
    jmp .return

.handle_get:
    ; Allocate signal for response
    mov rdi, 48               ; sizeof(Signal_value)
    call signal_alloc
    mov rbx, rax

    ; Set frequency
    mov qword [rbx], HASH_value

    ; Set sender
    mov rax, [r12]            ; agent_id
    mov [rbx + 8], rax

    ; Set result = state.count
    mov rax, [r12 + 24]
    mov [rbx + 24], rax

    ; Enqueue
    mov rdi, rbx
    call signal_route

    mov eax, 1

.return:
    pop r13
    pop r12
    leave
    ret
```

### Example 3: Conditional Emission

Source:
```mycelial
on signal(check, c) where c.value > 100 {
    if c.value > 1000 {
        emit critical { level: 3 }
    } else {
        emit warning { level: 1 }
    }
}
```

Generated:
```asm
handle_check:
    push rbp
    mov rbp, rsp
    sub rsp, 32
    push rbx

    mov r12, rdi              ; state
    mov r13, rsi              ; signal

    ; WHERE: c.value > 100
    mov eax, [r13 + 24]       ; c.value
    cmp eax, 100
    jle .skip

    ; IF: c.value > 1000
    cmp eax, 1000
    jle .else_branch

    ; THEN: emit critical { level: 3 }
    mov rdi, 32
    call signal_alloc
    mov rbx, rax
    mov qword [rbx], HASH_critical
    mov rax, [r12]
    mov [rbx + 8], rax
    mov dword [rbx + 24], 3   ; level = 3
    mov rdi, rbx
    call signal_route
    jmp .done

.else_branch:
    ; ELSE: emit warning { level: 1 }
    mov rdi, 32
    call signal_alloc
    mov rbx, rax
    mov qword [rbx], HASH_warning
    mov rax, [r12]
    mov [rbx + 8], rax
    mov dword [rbx + 24], 1   ; level = 1
    mov rdi, rbx
    call signal_route

.done:
.skip:
    pop rbx
    leave
    ret
```

---

## 12. Optimization Opportunities

These are noted for M5 but not implemented in M1.

### Peephole Optimizations

```
; Before: mov rax, rbx; mov rbx, rax
; After:  xchg rax, rbx (or eliminate if no side effects)

; Before: mov rax, 0
; After:  xor eax, eax (shorter, faster)

; Before: add rax, 1
; After:  inc rax (context-dependent)

; Before: imul rax, 2
; After:  shl rax, 1 (or lea rax, [rax + rax])

; Before: imul rax, 8
; After:  shl rax, 3
```

### Dead Code Elimination

Remove instructions whose results are never used:
```
mov rax, 42    ; Dead if rax is overwritten before use
mov rax, 100   ; This is the live value
```

### Register Coalescing

When two virtual registers have non-overlapping live ranges and are connected by a move, assign them the same physical register and eliminate the move.

### Strength Reduction

```
; Multiply by constant powers of 2
imul rax, 16  →  shl rax, 4

; Multiply by small constants
imul rax, 3   →  lea rax, [rax + rax*2]
imul rax, 5   →  lea rax, [rax + rax*4]
imul rax, 9   →  lea rax, [rax + rax*8]
```

### Signal Pool Optimization

Pre-allocate signals of common frequencies:
```asm
; Instead of calling signal_alloc every time:
mov rax, [r14 + freq_offset]  ; Pre-allocated slot
; Fill in payload
; Return to pool after routing
```

---

## Summary

This document specifies the complete x86-64 code generation strategy for the Mycelial compiler:

1. **48 core instructions** covering all computation needs
2. **Linear scan register allocation** with 10 allocatable registers
3. **System V AMD64 ABI** for function calls
4. **Agent compilation** with dispatch tables and state structs
5. **Signal compilation** with memory layouts and routing
6. **ELF64 generation** for standalone executables
7. **Complete instruction encoding** tables

The strategy is designed to be:
- **Implementable in Mycelial** for self-hosting
- **Correct first, fast later** for M1 simplicity
- **Beautiful** in its directness and clarity

---

## Next Steps

1. **Sonnet**: Design IR that maps cleanly to these patterns
2. **Haiku**: Implement instruction encoder as first code
3. **Opus**: Write knowledge base documents (instruction reference, ABI details)
4. **All**: Review and validate against hello_world.mycelial

---

*"The CPU awaits our instructions. Let's speak its language."*
