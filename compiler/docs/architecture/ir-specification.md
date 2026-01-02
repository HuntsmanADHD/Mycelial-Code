# Mycelial Intermediate Representation (IR) Specification

**Version**: 1.0
**Author**: Sonnet (Claude Sonnet 4.5)
**Date**: 2026-01-01
**Status**: ✅ COMPLETE (M0 - Foundation & Design)

---

## Table of Contents

1. [IR Philosophy](#1-ir-philosophy)
2. [Type System](#2-type-system)
3. [IR Architecture](#3-ir-architecture)
4. [High-Level IR (HIR)](#4-high-level-ir-hir)
5. [Low-Level IR (LIR)](#5-low-level-ir-lir)
6. [Lowering Strategy](#6-lowering-strategy)
7. [Memory Layout](#7-memory-layout)
8. [Calling Conventions](#8-calling-conventions)
9. [Agent-Specific Constructs](#9-agent-specific-constructs)
10. [Example Translations](#10-example-translations)
11. [Optimization Opportunities](#11-optimization-opportunities)
12. [Code Generation Interface](#12-code-generation-interface)

---

## 1. IR Philosophy

### 1.1 Design Goals

The Mycelial IR bridges two worlds:

1. **Agent-based semantics**: State isolation, signal passing, tidal cycles, pattern matching
2. **Imperative machine code**: Registers, stack frames, function calls, sequential execution

Traditional compiler IRs (LLVM IR, GCC GIMPLE) are designed for imperative languages and don't naturally express:
- Agent state that persists across invocations
- Signal emission creating asynchronous messages
- Pattern matching on signal types
- Tidal cycle phase boundaries

**Our Solution**: A **two-level hybrid IR** preserving agent semantics at the high level while enabling efficient code generation at the low level.

### 1.2 Two-Level Architecture

```
Typed AST
    ↓
┌─────────────────────────────────────┐
│  High-Level IR (HIR)                │
│  - Preserves agent structure        │
│  - State, signals, rules explicit   │
│  - Pattern matching preserved       │
│  - Agent-level optimizations        │
└─────────────────────────────────────┘
    ↓ (Lowering)
┌─────────────────────────────────────┐
│  Low-Level IR (LIR)                 │
│  - Three-address code               │
│  - Modified SSA form                │
│  - Basic blocks & control flow      │
│  - Register allocation ready        │
└─────────────────────────────────────┘
    ↓ (Code Generation)
x86-64 / ARM64 Assembly
```

**Why Two Levels?**

- **HIR**: Enables agent-specific analysis (dead rule elimination, signal flow optimization, topology validation)
- **LIR**: Enables traditional optimizations (dead code elimination, constant folding, register allocation)
- **Separation**: Code generator only sees LIR (clean interface, no special cases)

### 1.3 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Two-level IR** | Preserves agent semantics while enabling traditional optimizations |
| **Modified SSA** | SSA benefits (optimization, register allocation) with agent-local scope |
| **Explicit phases** | State/signal operations marked with phase tags (SENSE/ACT/REST) |
| **Static dispatch** | Pattern matching compiles to jump tables (no runtime reflection) |
| **Copy semantics** | Signal emission always copies payload (prevents aliasing) |
| **No global state** | Everything is agent-local or passed via signals |

---

## 2. Type System

### 2.1 Primitive Types

All primitive types map directly to machine representations:

| Mycelial Type | LIR Type | x86-64 Size | ARM64 Size | Alignment |
|---------------|----------|-------------|------------|-----------|
| `u32` | `i32` | 4 bytes | 4 bytes | 4 |
| `i64` | `i64` | 8 bytes | 8 bytes | 8 |
| `f64` | `f64` | 8 bytes | 8 bytes | 8 |
| `boolean` | `i1` | 1 byte | 1 byte | 1 |
| `string` | `ptr` | 8 bytes (pointer) | 8 bytes (pointer) | 8 |
| `binary` | `ptr` | 8 bytes (pointer) | 8 bytes (pointer) | 8 |

**String Representation**:
```c
struct String {
    char* data;      // Heap-allocated, UTF-8
    u32 length;      // Character count
    u32 capacity;    // Allocated bytes
}
```

**Binary Representation**:
```c
struct Binary {
    u8* data;        // Raw bytes
    u32 length;      // Byte count
    u32 capacity;    // Allocated bytes
}
```

### 2.2 Collection Types

Collections are heap-allocated with runtime support:

**Vector** (`vec<T>`):
```c
struct Vec_T {
    T* data;         // Heap array
    u32 length;      // Element count
    u32 capacity;    // Allocated slots
}
```

**Queue** (`queue<T>`):
```c
struct Queue_T {
    T* buffer;       // Ring buffer
    u32 head;        // Read index
    u32 tail;        // Write index
    u32 capacity;    // Buffer size
}
```

**Map** (`map<K,V>`):
```c
struct Map_K_V {
    Entry_K_V* buckets;  // Hash table
    u32 count;           // Entry count
    u32 capacity;        // Bucket count
}

struct Entry_K_V {
    K key;
    V value;
    u32 hash;
    Entry_K_V* next;     // Collision chain
}
```

**Generic Instantiation**: All generic types are monomorphized at compile time:
- `vec<i64>` → `Vec_i64` (distinct type)
- `map<string, u32>` → `Map_string_u32` (distinct type)

### 2.3 Frequency Types (Structs)

Frequencies define signal payload structures:

```mycelial
frequency task {
    data: string
    priority: u32
}
```

**HIR Representation**:
```
FrequencyDef {
    name: "task",
    fields: [
        Field { name: "data", type: Type::String },
        Field { name: "priority", type: Type::U32 }
    ]
}
```

**LIR Representation** (C-like struct):
```c
struct Signal_task {
    u32 freq_id;     // Frequency identifier
    char* data;      // String pointer
    u32 priority;
}
```

**Memory Layout**:
```
Offset | Field      | Size | Alignment
-------|------------|------|----------
0      | freq_id    | 4    | 4
4      | (padding)  | 4    | -
8      | data       | 8    | 8
16     | priority   | 4    | 4
20     | (padding)  | 4    | -
-------|------------|------|----------
Total: 24 bytes (aligned to 8)
```

### 2.4 Agent State Types

Agent state is a struct persisting across tidal cycles:

```mycelial
hyphal greeter {
    state {
        counter: u32 = 0
        queue: queue<string>
    }
}
```

**HIR Representation**:
```
HyphalDef {
    name: "greeter",
    state_fields: [
        StateField { name: "counter", type: Type::U32, init: Literal(0) },
        StateField { name: "queue", type: Type::Queue(Type::String), init: Empty }
    ]
}
```

**LIR Representation**:
```c
struct AgentState_greeter {
    u32 counter;
    Queue_string queue;
}
```

### 2.5 Type Checking in IR

**HIR**: Full type information preserved
- Every expression has explicit type annotation
- Type checking errors caught before lowering to LIR

**LIR**: Minimal type information
- Only size and signedness matter (i32, i64, ptr, f64)
- Type coercions explicit (e.g., `i32 → i64` via `sext`)

---

## 3. IR Architecture

### 3.1 Compilation Units

A Mycelial network compiles to:

1. **State structs**: One per hyphal definition
2. **Rule handlers**: Functions implementing `on signal()` rules
3. **Initialization code**: Sets up agent instances, topology
4. **Runtime linkage**: Calls to runtime library (signal routing, memory management)

**Example**:
```mycelial
network HelloWorld {
    hyphae {
        hyphal greeter { ... }
    }
    topology {
        spawn greeter as G1
    }
}
```

**Compiles to**:
```c
// State struct
struct AgentState_greeter { ... };

// Rule handlers
void greeter_rule_0(AgentState_greeter* state, Signal* sig);

// Initialization
void init_HelloWorld() {
    AgentState_greeter* G1_state = alloc_state(sizeof(AgentState_greeter));
    register_agent("G1", &greeter_rule_dispatch, G1_state);
    create_socket("input", "G1", FREQ_greeting);
    create_socket("G1", "output", FREQ_response);
}
```

### 3.2 Module Structure

```
Module {
    name: string,
    frequencies: Vec<FrequencyDef>,
    hyphae: Vec<HyphalDef>,
    topology: TopologyDef,

    // Generated during IR lowering
    structs: Vec<StructDef>,          // State structs, signal structs
    functions: Vec<FunctionDef>,       // Rule handlers, helpers
    global_init: FunctionDef,          // Topology initialization
}
```

---

## 4. High-Level IR (HIR)

### 4.1 Purpose

HIR preserves the structure of Mycelial programs:
- Agent definitions (hyphae)
- Signal types (frequencies)
- Pattern matching rules
- Topology metadata

**HIR is for**:
- Semantic analysis
- Agent-specific optimizations
- Dead rule elimination
- Signal flow analysis

**HIR is not for**:
- Code generation (too high-level)
- Register allocation (no concept of registers)

### 4.2 HIR Node Types

#### Frequency Definition

```rust
FrequencyDef {
    name: String,
    fields: Vec<Field>,
    freq_id: u32,
}

Field {
    name: String,
    type: Type,
}
```

#### Hyphal Definition

```rust
HyphalDef {
    name: String,
    state: Vec<StateField>,
    rules: Vec<Rule>,
}

StateField {
    name: String,
    type: Type,
    init_value: Option<Expr>,
}

Rule {
    trigger: RuleTrigger,
    guard: Option<Expr>,
    body: Vec<Stmt>,
}

RuleTrigger {
    kind: TriggerKind,      // SignalMatch | Rest | Cycle
    frequency: Option<String>,  // For SignalMatch
    binding: Option<String>,    // Variable name for signal payload
    period: Option<u32>,        // For Cycle
}
```

#### Statements

```rust
Stmt =
    | Emit { frequency: String, fields: Vec<(String, Expr)> }
    | Assign { target: LValue, value: Expr }
    | If { cond: Expr, then: Vec<Stmt>, else_ifs: Vec<(Expr, Vec<Stmt>)>, else_: Vec<Stmt> }
    | Report { metric: String, value: Expr }
    | Spawn { hyphal_type: String, instance_id: String }
    | Die
```

#### Expressions

```rust
Expr =
    | Literal { value: Constant, type: Type }
    | StateAccess { field: String, type: Type }
    | SignalAccess { field: String, type: Type }  // Access signal binding variable
    | FieldAccess { object: Box<Expr>, field: String, type: Type }
    | BinaryOp { op: BinOp, left: Box<Expr>, right: Box<Expr>, type: Type }
    | UnaryOp { op: UnOp, operand: Box<Expr>, type: Type }
    | Call { name: String, args: Vec<Expr>, type: Type }
    | VecSlice { vec: Box<Expr>, start: Box<Expr>, end: Box<Expr>, type: Type }
    | MapIndex { map: Box<Expr>, key: Box<Expr>, type: Type }
```

### 4.3 HIR Example

**Mycelial Code**:
```mycelial
hyphal greeter {
    state {
        count: u32 = 0
    }

    on signal(greeting, g) {
        state.count = state.count + 1
        emit response {
            message: format("Hello, {}!", g.name)
        }
    }
}
```

**HIR**:
```rust
HyphalDef {
    name: "greeter",
    state: [
        StateField {
            name: "count",
            type: Type::U32,
            init_value: Some(Literal(0, Type::U32))
        }
    ],
    rules: [
        Rule {
            trigger: RuleTrigger {
                kind: SignalMatch,
                frequency: Some("greeting"),
                binding: Some("g")
            },
            guard: None,
            body: [
                Assign {
                    target: StateAccess("count"),
                    value: BinaryOp {
                        op: Add,
                        left: StateAccess("count", Type::U32),
                        right: Literal(1, Type::U32),
                        type: Type::U32
                    }
                },
                Emit {
                    frequency: "response",
                    fields: [
                        ("message", Call {
                            name: "format",
                            args: [
                                Literal("Hello, {}!", Type::String),
                                FieldAccess {
                                    object: SignalAccess("g", Type::Signal_greeting),
                                    field: "name",
                                    type: Type::String
                                }
                            ],
                            type: Type::String
                        })
                    ]
                }
            ]
        }
    ]
}
```

---

## 5. Low-Level IR (LIR)

### 5.1 Purpose

LIR is a **three-address code** representation suitable for code generation:
- Instructions with at most 3 operands
- Explicit temporaries (SSA form)
- Basic blocks with control flow edges
- Register allocation ready

**LIR is for**:
- Traditional compiler optimizations
- Register allocation
- Instruction selection
- Machine code generation

### 5.2 LIR Instruction Set

#### Data Movement

```
move dst, src              # Copy value
load dst, [addr]           # Load from memory
store [addr], src          # Store to memory
load_field dst, obj, offset  # Load struct field
store_field obj, offset, src # Store struct field
```

#### Arithmetic

```
add dst, lhs, rhs          # dst = lhs + rhs
sub dst, lhs, rhs          # dst = lhs - rhs
mul dst, lhs, rhs          # dst = lhs * rhs
div dst, lhs, rhs          # dst = lhs / rhs (signed)
mod dst, lhs, rhs          # dst = lhs % rhs
neg dst, src               # dst = -src
```

#### Logical

```
and dst, lhs, rhs          # Bitwise AND
or dst, lhs, rhs           # Bitwise OR
xor dst, lhs, rhs          # Bitwise XOR
not dst, src               # Bitwise NOT
shl dst, src, amount       # Shift left
shr dst, src, amount       # Shift right (logical)
```

#### Comparison

```
cmp_eq dst, lhs, rhs       # dst = (lhs == rhs)
cmp_ne dst, lhs, rhs       # dst = (lhs != rhs)
cmp_lt dst, lhs, rhs       # dst = (lhs < rhs)
cmp_le dst, lhs, rhs       # dst = (lhs <= rhs)
cmp_gt dst, lhs, rhs       # dst = (lhs > rhs)
cmp_ge dst, lhs, rhs       # dst = (lhs >= rhs)
```

#### Control Flow

```
jump label                 # Unconditional jump
branch cond, true_label, false_label  # Conditional branch
ret value                  # Return from function
call dst, func, args...    # Function call
```

#### Special Operations

```
alloc dst, size            # Allocate heap memory
free ptr                   # Free heap memory
phi dst, [val1, bb1], [val2, bb2], ...  # SSA phi node
const dst, value           # Load constant
get_field_addr dst, obj, offset  # Calculate field address
bitcast dst, src, type     # Type conversion (no-op, reinterpret)
```

### 5.3 SSA Form

LIR uses **modified SSA (Static Single Assignment)**:

**Standard SSA Properties**:
- Each variable assigned exactly once
- Phi nodes at control flow merge points
- Simplifies optimization and register allocation

**Modification for Agents**:
- State fields are NOT in SSA form (mutable across rules)
- Temporaries within rules ARE in SSA form
- Signals are immutable (natural SSA)

**Example**:

```mycelial
on signal(task, t) {
    let x = t.priority + 1
    let y = x * 2
    if y > 10 {
        emit high { value: y }
    } else {
        emit low { value: y }
    }
}
```

**LIR (SSA)**:
```
; Entry block
bb0:
    %t = load_param 0                    ; Signal parameter
    %t_priority = load_field %t, 8       ; t.priority (offset 8)
    %x_1 = add %t_priority, 1
    %y_1 = mul %x_1, 2
    %cond = cmp_gt %y_1, 10
    branch %cond, bb1, bb2

; Then block
bb1:
    call emit_high, %y_1
    jump bb3

; Else block
bb2:
    call emit_low, %y_1
    jump bb3

; Merge block
bb3:
    ret
```

### 5.4 Basic Blocks

```rust
BasicBlock {
    label: String,
    instructions: Vec<Instruction>,
    terminator: Terminator,
}

Terminator =
    | Jump { target: String }
    | Branch { cond: Value, true_label: String, false_label: String }
    | Return { value: Option<Value> }
```

**Control Flow Graph (CFG)**:
- Nodes: Basic blocks
- Edges: Control flow (jump, branch)
- Used for: Dominance analysis, loop detection, dead code elimination

### 5.5 LIR Example

**Mycelial Code**:
```mycelial
state.counter = state.counter + 1
```

**LIR**:
```
bb0:
    %state_ptr = load_param 0              ; Agent state pointer
    %counter_ptr = get_field_addr %state_ptr, 0  ; &state.counter
    %counter_old = load [%counter_ptr]     ; Load current value
    %one = const 1
    %counter_new = add %counter_old, %one  ; Increment
    store [%counter_ptr], %counter_new     ; Store back
    ret
```

---

## 6. Lowering Strategy

### 6.1 HIR → LIR Process

Lowering transforms agent-centric HIR to imperative LIR:

1. **State Compilation**: Agent state blocks → struct definitions + field access instructions
2. **Rule Compilation**: Each rule → function with state parameter
3. **Signal Emission**: `emit` → allocate signal struct + call runtime
4. **Pattern Matching**: Signal dispatch → switch/jump table
5. **Control Flow**: If/else → basic blocks with branches

### 6.2 State Access Lowering

**HIR**:
```
StateAccess { field: "counter" }
```

**LIR**:
```
%state_ptr = load_param 0           ; Function parameter: AgentState*
%field_ptr = get_field_addr %state_ptr, OFFSET_counter
%value = load [%field_ptr]
```

**Field Offset Calculation**:
```c
// Given struct definition
struct AgentState_greeter {
    u32 counter;      // offset 0, size 4
    Queue_string q;   // offset 8 (aligned), size 24
};

OFFSET_counter = 0
OFFSET_q = 8  // Aligned to 8 bytes
```

### 6.3 Signal Emission Lowering

**HIR**:
```
Emit {
    frequency: "response",
    fields: [
        ("message", Expr)
    ]
}
```

**LIR**:
```
; Allocate signal struct
%sig_size = const 24  ; sizeof(Signal_response)
%sig_ptr = call runtime_alloc_signal, FREQ_ID_response, %sig_size

; Evaluate field expression
%msg_val = ...  ; Expression result

; Store freq_id field
%freq_id_ptr = get_field_addr %sig_ptr, 0
store [%freq_id_ptr], FREQ_ID_response

; Store message field
%msg_field_ptr = get_field_addr %sig_ptr, 8  ; offset 8
store [%msg_field_ptr], %msg_val

; Enqueue to agent outbox
%state_ptr = load_param 0
call runtime_emit_signal, %state_ptr, %sig_ptr
```

### 6.4 Conditional Lowering

**HIR**:
```
If {
    cond: BinaryOp { op: Gt, left: x, right: Literal(10) },
    then: [Emit { ... }],
    else: [Emit { ... }]
}
```

**LIR**:
```
bb0:
    %cond = cmp_gt %x, 10
    branch %cond, bb_then, bb_else

bb_then:
    call emit_high, ...
    jump bb_merge

bb_else:
    call emit_low, ...
    jump bb_merge

bb_merge:
    ; Continue...
```

### 6.5 Pattern Matching Lowering

**HIR**:
```
Rule {
    trigger: SignalMatch { frequency: "task", binding: "t" },
    guard: Some(BinaryOp { op: Gt, left: FieldAccess(t, priority), right: Literal(5) }),
    body: [...]
}
```

**LIR** (Dispatch function for agent):
```
function agent_dispatch(state_ptr: *AgentState, signal_ptr: *Signal) {
bb0:
    %freq_id_ptr = get_field_addr %signal_ptr, 0
    %freq_id = load [%freq_id_ptr]

    ; Jump table for frequency types
    switch %freq_id {
        FREQ_task => bb_rule_task,
        _ => bb_no_match
    }

bb_rule_task:
    ; Extract signal payload
    %t = bitcast %signal_ptr, *Signal_task

    ; Evaluate guard
    %priority_ptr = get_field_addr %t, 8  ; offset 8
    %priority = load [%priority_ptr]
    %guard_cond = cmp_gt %priority, 5
    branch %guard_cond, bb_rule_task_body, bb_no_match

bb_rule_task_body:
    call greeter_rule_0, %state_ptr, %t
    jump bb_done

bb_no_match:
    ; No rule matched, drop signal
    jump bb_done

bb_done:
    ret
}
```

### 6.6 Built-in Function Lowering

**`len(collection)`**:
```
HIR: Call { name: "len", args: [StateAccess("queue")] }

LIR:
    %queue_ptr = get_field_addr %state_ptr, OFFSET_queue
    %len_ptr = get_field_addr %queue_ptr, 8  ; length field offset
    %len = load [%len_ptr]
```

**`format(template, ...args)`**:
```
HIR: Call { name: "format", args: [Literal("Hello, {}!"), x] }

LIR:
    %template = const "Hello, {}!"
    %result = call runtime_format_string, %template, %x
```

**`sum(vec)`**:
```
HIR: Call { name: "sum", args: [vec_expr] }

LIR:
    %vec_ptr = ...  ; Evaluate vec_expr
    %sum = call runtime_vec_sum, %vec_ptr
```

---

## 7. Memory Layout

### 7.1 Stack Frame Organization

Each rule handler is a function with standard stack frame:

**System V AMD64 ABI** (x86-64 Linux/Unix):
```
High Address
    ┌────────────────┐
    │  Return Addr   │  (pushed by call)
    ├────────────────┤
    │  Saved RBP     │  ← RBP (frame pointer)
    ├────────────────┤
    │  Local Var 0   │
    │  Local Var 1   │
    │      ...       │
    │  Spill Slot 0  │
    │  Spill Slot 1  │
    ├────────────────┤
    │  Arg 7+        │  (overflow args, if any)
    └────────────────┘  ← RSP (stack pointer)
Low Address
```

**Arguments** (System V):
- Args 1-6: `rdi`, `rsi`, `rdx`, `rcx`, `r8`, `r9`
- Args 7+: Stack (pushed right-to-left)
- Return value: `rax`

**AAPCS64 ABI** (ARM64):
```
High Address
    ┌────────────────┐
    │  Return Addr   │  (in LR register, may spill to stack)
    ├────────────────┤
    │  Saved FP      │  ← FP (x29, frame pointer)
    ├────────────────┤
    │  Local Var 0   │
    │  Local Var 1   │
    │      ...       │
    │  Spill Slot 0  │
    ├────────────────┤
    │  Arg 9+        │  (overflow args, if any)
    └────────────────┘  ← SP (stack pointer)
Low Address
```

**Arguments** (AAPCS64):
- Args 1-8: `x0` - `x7`
- Args 9+: Stack
- Return value: `x0`

### 7.2 Struct Layout

**Field Ordering**: Fields ordered by declaration
**Alignment**: Each field aligned to its natural alignment
**Padding**: Inserted to maintain alignment

**Example**:
```mycelial
frequency task {
    priority: u32      # 4 bytes, align 4
    data: string       # 8 bytes (pointer), align 8
    id: u32            # 4 bytes, align 4
}
```

**Memory Layout**:
```
Offset | Field    | Size | Align | Padding
-------|----------|------|-------|--------
0      | freq_id  | 4    | 4     | -
4      | priority | 4    | 4     | -
8      | data     | 8    | 8     | -
16     | id       | 4    | 4     | -
20     | (pad)    | 4    | -     | 4 (struct align to 8)
-------|----------|------|-------|--------
Total: 24 bytes
```

**Optimization** (M5): Reorder fields by descending size to minimize padding

### 7.3 Heap Allocation

**Strings, Vectors, Maps**: Heap-allocated via runtime allocator

**Allocator Interface**:
```c
void* runtime_alloc(size_t bytes);
void runtime_free(void* ptr);
void* runtime_realloc(void* ptr, size_t new_size);
```

**Garbage Collection** (MVP):
- Manual memory management (explicit free)
- Future: Reference counting or tracing GC

---

## 8. Calling Conventions

### 8.1 Rule Handler Signature

All rule handlers follow this convention:

```c
void rule_handler(AgentState* state, Signal* signal);
```

**Parameters**:
1. `state`: Pointer to agent's persistent state
2. `signal`: Pointer to incoming signal (for `on signal()` rules)

**Returns**: `void` (signals emitted via runtime calls)

**Calling Convention**:
- **x86-64 (System V)**: `state` in `rdi`, `signal` in `rsi`
- **ARM64 (AAPCS64)**: `state` in `x0`, `signal` in `x1`

### 8.2 Runtime Function Calls

Runtime provides helper functions:

```c
// Signal management
void* runtime_alloc_signal(u32 frequency_id, u32 size);
void runtime_emit_signal(AgentState* state, void* signal);

// Memory management
void* runtime_alloc(size_t bytes);
void runtime_free(void* ptr);

// Collections
void runtime_vec_push(Vec* vec, void* element);
void* runtime_vec_get(Vec* vec, u32 index);
u32 runtime_vec_len(Vec* vec);
i64 runtime_vec_sum(Vec_i64* vec);

// String operations
String runtime_format_string(const char* template, ...);
u32 runtime_string_len(String* s);
```

**Calling Convention**: Same as C ABI per platform

### 8.3 Callee-Saved Registers

**x86-64 (System V)**:
- Callee-saved: `rbx`, `rbp`, `r12-r15`
- Caller-saved: `rax`, `rcx`, `rdx`, `rsi`, `rdi`, `r8-r11`

**ARM64 (AAPCS64)**:
- Callee-saved: `x19-x28`, `x29` (FP), `x30` (LR)
- Caller-saved: `x0-x18`

**IR Implication**: Register allocator must preserve callee-saved registers across function calls

---

## 9. Agent-Specific Constructs

### 9.1 State Initialization

**HIR**:
```
StateField {
    name: "counter",
    type: Type::U32,
    init_value: Some(Literal(0))
}
```

**LIR** (Initialization function):
```
function init_greeter_state(state_ptr: *AgentState_greeter) {
bb0:
    %counter_ptr = get_field_addr %state_ptr, 0
    %zero = const 0
    store [%counter_ptr], %zero

    %queue_ptr = get_field_addr %state_ptr, 8
    call runtime_queue_init, %queue_ptr

    ret
}
```

### 9.2 Signal Dispatch

**Pattern Matching**:
```
on signal(task, t) where t.priority > 5 { ... }
on signal(task, t) { ... }  # Default handler
```

**Dispatch Logic**:
```
function agent_dispatch(state: *State, signal: *Signal) {
    switch signal.freq_id {
        FREQ_task => dispatch_task(state, signal),
        _ => /* no handler */
    }
}

function dispatch_task(state: *State, signal: *Signal_task) {
    ; Rule 1: Guard check
    if signal.priority > 5 {
        rule_task_priority(state, signal);
        return;
    }

    ; Rule 2: Default
    rule_task_default(state, signal);
}
```

### 9.3 Tidal Cycle Phases

**SENSE Phase**: Signals delivered by runtime (not in IR)

**ACT Phase**: Rule handlers execute (compiled code)

**REST Phase**: `on rest` handlers execute

**LIR Representation**:
```
; ACT phase: process signals
function agent_act(state: *State, inbox: *SignalQueue) {
    while (runtime_queue_has_next(inbox)) {
        signal = runtime_queue_pop(inbox);
        agent_dispatch(state, signal);
    }
}

; REST phase: cleanup
function agent_rest(state: *State) {
    ; Execute "on rest" rules
    greeter_rest_handler(state);
}
```

### 9.4 Topology Compilation

**Topology is metadata**, not executable code:

```mycelial
topology {
    spawn greeter as G1
    socket input -> G1 (frequency: greeting)
}
```

**Compiles to initialization calls**:
```c
void init_topology() {
    AgentState_greeter* G1 = runtime_spawn_agent("greeter", sizeof(AgentState_greeter));
    init_greeter_state(G1);
    runtime_register_dispatch(G1, &greeter_dispatch);

    runtime_create_socket("input", "G1", FREQ_greeting);
}
```

---

## 10. Example Translations

### 10.1 Hello World Complete Translation

**Mycelial Code**:
```mycelial
network HelloWorld {
  frequencies {
    greeting { name: string }
    response { message: string }
  }

  hyphae {
    hyphal greeter {
      on signal(greeting, g) {
        emit response {
          message: format("Hello, {}!", g.name)
        }
      }
    }
  }

  topology {
    fruiting_body input
    fruiting_body output
    spawn greeter as G1
    socket input -> G1 (frequency: greeting)
    socket G1 -> output (frequency: response)
  }
}
```

#### HIR (High-Level IR)

```rust
Module {
  name: "HelloWorld",

  frequencies: [
    FrequencyDef {
      name: "greeting",
      fields: [ Field { name: "name", type: Type::String } ],
      freq_id: 1
    },
    FrequencyDef {
      name: "response",
      fields: [ Field { name: "message", type: Type::String } ],
      freq_id: 2
    }
  ],

  hyphae: [
    HyphalDef {
      name: "greeter",
      state: [],

      rules: [
        Rule {
          trigger: RuleTrigger {
            kind: SignalMatch,
            frequency: Some("greeting"),
            binding: Some("g")
          },
          guard: None,
          body: [
            Emit {
              frequency: "response",
              fields: [
                ("message", Call {
                  name: "format",
                  args: [
                    Literal("Hello, {}!", Type::String),
                    FieldAccess {
                      object: SignalAccess("g", Type::Signal_greeting),
                      field: "name",
                      type: Type::String
                    }
                  ],
                  type: Type::String
                })
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

#### LIR (Low-Level IR)

**Struct Definitions**:
```c
struct Signal_greeting {
    u32 freq_id;     // = 1
    String name;
};

struct Signal_response {
    u32 freq_id;     // = 2
    String message;
};

struct AgentState_greeter {
    // Empty (no state fields)
};
```

**Rule Handler**:
```
function greeter_rule_0(state_ptr: *AgentState_greeter, signal_ptr: *Signal) -> void {
bb0:
    ; Cast generic Signal* to Signal_greeting*
    %g = bitcast %signal_ptr, *Signal_greeting

    ; Extract g.name field (offset 4)
    %g_name_ptr = get_field_addr %g, 4
    %g_name = load [%g_name_ptr]

    ; Call format("Hello, {}!", g.name)
    %template = const "Hello, {}!"
    %formatted = call runtime_format_string, %template, %g_name

    ; Allocate response signal
    %resp_size = const 16  ; sizeof(Signal_response)
    %resp_ptr = call runtime_alloc_signal, 2, %resp_size  ; freq_id = 2

    ; Set freq_id field (offset 0)
    %freq_id_ptr = get_field_addr %resp_ptr, 0
    %freq_id_val = const 2
    store [%freq_id_ptr], %freq_id_val

    ; Set message field (offset 8, aligned)
    %msg_ptr = get_field_addr %resp_ptr, 8
    store [%msg_ptr], %formatted

    ; Emit signal
    call runtime_emit_signal, %state_ptr, %resp_ptr

    ret
}
```

**Dispatch Function**:
```
function greeter_dispatch(state_ptr: *AgentState_greeter, signal_ptr: *Signal) -> void {
bb0:
    %freq_id_ptr = get_field_addr %signal_ptr, 0
    %freq_id = load [%freq_id_ptr]

    ; Switch on frequency ID
    %is_greeting = cmp_eq %freq_id, 1
    branch %is_greeting, bb_greeting, bb_no_match

bb_greeting:
    call greeter_rule_0, %state_ptr, %signal_ptr
    jump bb_done

bb_no_match:
    ; No handler, drop signal
    jump bb_done

bb_done:
    ret
}
```

#### x86-64 Assembly (Code Gen Output)

```asm
    .section .text
    .global greeter_rule_0
    .type greeter_rule_0, @function

greeter_rule_0:
    ; Prologue
    pushq   %rbp
    movq    %rsp, %rbp
    subq    $32, %rsp               # Local space

    ; Parameters: rdi = state_ptr, rsi = signal_ptr
    movq    %rsi, %r12              # Save signal_ptr (g) in callee-saved reg

    ; Extract g.name (offset 4 in Signal_greeting)
    movq    4(%r12), %rsi           # rsi = g.name (2nd arg for format)

    ; Call runtime_format_string("Hello, {}!", g.name)
    leaq    format_template(%rip), %rdi  # 1st arg: template
    call    runtime_format_string
    movq    %rax, %r13              # Save formatted string

    ; Allocate response signal
    movl    $2, %edi                # arg1: freq_id = FREQ_response
    movl    $16, %esi               # arg2: size = sizeof(Signal_response)
    call    runtime_alloc_signal
    movq    %rax, %r14              # Save signal pointer

    ; Set response.freq_id = 2
    movl    $2, 0(%r14)

    ; Set response.message = formatted (offset 8)
    movq    %r13, 8(%r14)

    ; Emit signal
    movq    -8(%rbp), %rdi          # arg1: state_ptr (restore from stack)
    movq    %r14, %rsi              # arg2: signal_ptr
    call    runtime_emit_signal

    ; Epilogue
    addq    $32, %rsp
    popq    %rbp
    ret

    .section .rodata
format_template:
    .asciz "Hello, {}!"
```

---

## 11. Optimization Opportunities

### 11.1 HIR-Level Optimizations

**Dead Rule Elimination**:
- Analyze signal flow through topology
- Identify rules that never receive matching signals
- Remove unreachable rules

**Signal Flow Analysis**:
- Track which signals are emitted/consumed
- Warn about orphaned signals (emitted but never consumed)
- Warn about sinks (consumed but never emitted)

**Type-Based Optimization**:
- Inline small struct copies
- Eliminate redundant type checks

### 11.2 LIR-Level Optimizations

**Dead Code Elimination**:
- Remove instructions with unused results
- Remove unreachable basic blocks

**Constant Folding**:
```
%a = const 2
%b = const 3
%c = add %a, %b

=> %c = const 5
```

**Common Subexpression Elimination**:
```
%a = add %x, %y
%b = add %x, %y  ; Same as %a

=> %b = %a
```

**Copy Propagation**:
```
%a = move %x
%b = add %a, %y

=> %b = add %x, %y
```

**Strength Reduction**:
```
%a = mul %x, 8

=> %a = shl %x, 3  ; Shift is faster
```

### 11.3 Register Allocation Optimizations

**Linear Scan Algorithm** (MVP):
- Fast, simple, good for most cases
- O(n) complexity

**Graph Coloring Algorithm** (M5):
- Better register utilization
- Fewer spills to stack
- O(n²) complexity

**Spill Minimization**:
- Prioritize hot variables for registers
- Use callee-saved registers for long-lived variables

---

## 12. Code Generation Interface

### 12.1 What Code Gen Receives

The code generation agent receives **LIR functions** in SSA form:

```rust
Function {
    name: String,
    params: Vec<(String, Type)>,
    return_type: Type,
    basic_blocks: Vec<BasicBlock>,
}

BasicBlock {
    label: String,
    instructions: Vec<Instruction>,
    terminator: Terminator,
}
```

### 12.2 What Code Gen Must Produce

Assembly code or machine code bytes:

**Assembly Output**:
```asm
greeter_rule_0:
    pushq   %rbp
    movq    %rsp, %rbp
    ...
    ret
```

**Or Machine Code** (ELF .text section bytes):
```
[0x55, 0x48, 0x89, 0xe5, ...]
```

### 12.3 Register Allocation Contract

**Input**: LIR with unlimited virtual registers (`%r0`, `%r1`, ...)

**Output**: Assembly with physical registers (`rax`, `rbx`, ...)

**Responsibilities**:
1. Map virtual registers to physical registers
2. Insert spill code when out of registers
3. Respect calling convention
4. Handle register pressure

### 12.4 Instruction Selection

| LIR Instruction | x86-64 Assembly | ARM64 Assembly |
|----------------|----------------|----------------|
| `add dst, lhs, rhs` | `addq rhs, dst` | `add dst, lhs, rhs` |
| `load dst, [addr]` | `movq (addr), dst` | `ldr dst, [addr]` |
| `store [addr], src` | `movq src, (addr)` | `str src, [addr]` |
| `call func, args...` | `call func` | `bl func` |
| `ret value` | `movq value, %rax; ret` | `mov x0, value; ret` |
| `branch cond, t, f` | `test cond; jnz t; jmp f` | `cbnz cond, t; b f` |

---

## Summary

This IR specification provides:

1. **Two-level architecture**: HIR for agent semantics, LIR for code generation
2. **Complete type system**: Primitives, collections, frequencies, agents
3. **Lowering strategy**: Transform agent constructs to imperative code
4. **Memory layout**: Stack frames, struct layouts, calling conventions
5. **Optimization framework**: Dead code elimination, constant folding, register allocation
6. **Code gen interface**: Clean separation between IR and assembly

**Ready for Implementation**: M1 can now translate Mycelial programs through this IR to machine code.

---

🌿🧬 **The bridge between language and machine is complete.** 🚀
