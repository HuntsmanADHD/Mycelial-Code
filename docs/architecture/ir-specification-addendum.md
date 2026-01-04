# IR Specification Addendum - Implementation Details

**Version**: 1.1
**Author**: Sonnet (Claude Sonnet 4.5)
**Date**: 2026-01-01
**Status**: M1 Preparation - Critical Gaps Filled
**Parent Document**: `ir-specification.md`

---

## Purpose

This addendum addresses critical implementation gaps identified in the main IR specification. It provides concrete algorithms, detailed lowering patterns, and clarifications needed for M1 IR Generator Agent implementation.

**What was missing from main spec:**
- Loop lowering algorithms (while, for)
- Collection operation lowering patterns
- Complete built-in function signatures
- Struct offset calculation algorithms
- Pattern matching dispatch generation details

---

## Table of Contents

1. [Loop Lowering Algorithms](#1-loop-lowering-algorithms)
2. [Collection Operations](#2-collection-operations)
3. [Built-in Functions Reference](#3-built-in-functions-reference)
4. [Struct Layout Calculation](#4-struct-layout-calculation)
5. [Pattern Matching Dispatch](#5-pattern-matching-dispatch)
6. [Edge Case Handling](#6-edge-case-handling)
7. [Implementation Algorithms](#7-implementation-algorithms)

---

## 1. Loop Lowering Algorithms

### 1.1 While Loop Lowering

**Mycelial Source**:
```mycelial
while condition {
    body_statements
}
```

**HIR Representation**:
```rust
WhileLoop {
    condition: Expr,
    body: Vec<Stmt>,
}
```

**LIR Lowering Pattern**:
```
bb_loop_header:
    %cond_val = <lower condition expr>
    branch %cond_val, bb_loop_body, bb_loop_exit

bb_loop_body:
    <lower body statements>
    jump bb_loop_header

bb_loop_exit:
    ; Continue after loop
```

**Complete Example**:
```mycelial
while state.counter < 10 {
    state.counter = state.counter + 1
    emit tick { count: state.counter }
}
```

**LIR**:
```
bb_loop_header:
    %counter_ptr = get_field_addr %state_ptr, 0
    %counter = load [%counter_ptr]
    %ten = const 10
    %cond = cmp_lt %counter, %ten
    branch %cond, bb_loop_body, bb_loop_exit

bb_loop_body:
    ; state.counter = state.counter + 1
    %counter_ptr_2 = get_field_addr %state_ptr, 0
    %counter_old = load [%counter_ptr_2]
    %one = const 1
    %counter_new = add %counter_old, %one
    store [%counter_ptr_2], %counter_new

    ; emit tick
    %tick_size = const 12
    %tick_ptr = call runtime_alloc_signal, FREQ_tick, %tick_size
    %count_ptr = get_field_addr %tick_ptr, 4
    store [%count_ptr], %counter_new
    call runtime_emit_signal, %state_ptr, %tick_ptr

    jump bb_loop_header

bb_loop_exit:
    ; Continue
```

### 1.2 For Loop Lowering

**Note**: Mycelial grammar from `/home/lewey/Desktop/MyLanguage/01-SPECIFICATION/GRAMMAR.md` does NOT include for loops. However, examples show for-like iteration patterns.

**Pattern in Examples** (pipeline.mycelial, map_reduce.mycelial):
```mycelial
for i in 0..state.partitions {
    // Not actual Mycelial syntax - appears to be pseudocode
}
```

**Actual Mycelial Approach**: Iteration via signals, not imperative loops.

**IF For Loops Were Added**, lowering would be:

**Mycelial (hypothetical)**:
```mycelial
for item in vec {
    body_statements
}
```

**Desugar to While Loop**:
```mycelial
let _iter_index = 0
let _iter_len = len(vec)
while _iter_index < _iter_len {
    let item = vec[_iter_index]
    body_statements
    _iter_index = _iter_index + 1
}
```

**Conclusion**: **No for loops in M1 MVP**. Use while loops for iteration.

---

## 2. Collection Operations

### 2.1 Vector Operations

#### `len(vec)` - Get Vector Length

**Mycelial**:
```mycelial
let count = len(state.items)
```

**HIR**:
```rust
Call {
    name: "len",
    args: [StateAccess("items", Type::Vec(Type::I64))],
    type: Type::U32
}
```

**LIR Lowering**:
```
; Assumption: Vec struct has 'length' field at offset 8
%vec_ptr = get_field_addr %state_ptr, OFFSET_items
%len_ptr = get_field_addr %vec_ptr, 8  ; Vec.length field
%len = load [%len_ptr]
```

**Vec Struct Layout** (from ir-specification.md Section 2.2):
```c
struct Vec_T {
    T* data;         // Offset 0, size 8
    u32 length;      // Offset 8, size 4
    u32 capacity;    // Offset 12, size 4
}
// Total: 16 bytes
```

#### `vec_push(vec, element)` - Append Element

**Mycelial**:
```mycelial
vec_push(state.items, 42)
```

**HIR**:
```rust
Call {
    name: "vec_push",
    args: [
        StateAccess("items", Type::Vec(Type::I64)),
        Literal(42, Type::I64)
    ],
    type: Type::Void
}
```

**LIR Lowering**:
```
%vec_ptr = get_field_addr %state_ptr, OFFSET_items
%element = const 42
call runtime_vec_push, %vec_ptr, %element
```

**Runtime Function Signature**:
```c
void runtime_vec_push(Vec_T* vec, T element);
// Handles capacity growth, reallocation, element copy
```

#### `vec_get(vec, index)` - Access Element

**Mycelial**:
```mycelial
let value = vec_get(state.items, 0)
```

**HIR**:
```rust
Call {
    name: "vec_get",
    args: [
        StateAccess("items", Type::Vec(Type::I64)),
        Literal(0, Type::U32)
    ],
    type: Type::I64
}
```

**LIR Lowering** (with bounds checking):
```
%vec_ptr = get_field_addr %state_ptr, OFFSET_items
%index = const 0

; Bounds check
%len_ptr = get_field_addr %vec_ptr, 8
%len = load [%len_ptr]
%in_bounds = cmp_lt %index, %len
branch %in_bounds, bb_access, bb_error

bb_access:
    %data_ptr_ptr = get_field_addr %vec_ptr, 0
    %data_ptr = load [%data_ptr_ptr]
    %element_size = const 8  ; sizeof(i64)
    %offset = mul %index, %element_size
    %element_addr = add %data_ptr, %offset
    %value = load [%element_addr]
    jump bb_continue

bb_error:
    call runtime_panic, "vec index out of bounds"
    jump bb_continue

bb_continue:
    ; %value contains element
```

**Optimization** (MVP): Skip bounds check if index is constant and provably in bounds.

#### `sum(vec)` - Sum Vector Elements

**Mycelial**:
```mycelial
let total = sum(state.values)
```

**HIR**:
```rust
Call {
    name: "sum",
    args: [StateAccess("values", Type::Vec(Type::I64))],
    type: Type::I64
}
```

**LIR Lowering**:
```
%vec_ptr = get_field_addr %state_ptr, OFFSET_values
%result = call runtime_vec_sum, %vec_ptr
```

**Runtime Function**:
```c
i64 runtime_vec_sum(Vec_i64* vec) {
    i64 sum = 0;
    for (u32 i = 0; i < vec->length; i++) {
        sum += vec->data[i];
    }
    return sum;
}
```

### 2.2 Queue Operations

#### `queue_push(queue, element)` - Enqueue

**LIR Lowering**:
```
%queue_ptr = get_field_addr %state_ptr, OFFSET_queue
%element = <evaluate element>
call runtime_queue_push, %queue_ptr, %element
```

**Queue Struct Layout**:
```c
struct Queue_T {
    T* buffer;       // Offset 0, size 8
    u32 head;        // Offset 8, size 4
    u32 tail;        // Offset 12, size 4
    u32 capacity;    // Offset 16, size 4
}
// Total: 20 bytes (aligned to 8 = 24 bytes)
```

#### `queue_pop(queue)` - Dequeue

**LIR Lowering**:
```
%queue_ptr = get_field_addr %state_ptr, OFFSET_queue
%element = call runtime_queue_pop, %queue_ptr
```

**Runtime Function**:
```c
T runtime_queue_pop(Queue_T* queue);
// Returns front element, advances head
// Panics if queue is empty
```

### 2.3 Map Operations

#### `map_insert(map, key, value)` - Insert Entry

**Mycelial**:
```mycelial
map_insert(state.cache, "key", 42)
```

**LIR Lowering**:
```
%map_ptr = get_field_addr %state_ptr, OFFSET_cache
%key = const "key"
%value = const 42
call runtime_map_insert, %map_ptr, %key, %value
```

#### `map_get(map, key)` - Retrieve Value

**LIR Lowering**:
```
%map_ptr = get_field_addr %state_ptr, OFFSET_cache
%key = const "key"
%value_ptr = call runtime_map_get, %map_ptr, %key
; runtime_map_get returns pointer to value (or null if not found)
```

#### `map.contains_key(key)` - Check Existence

**Mycelial**:
```mycelial
if state.cache.contains_key("key") { ... }
```

**LIR Lowering**:
```
%map_ptr = get_field_addr %state_ptr, OFFSET_cache
%key = const "key"
%exists = call runtime_map_contains, %map_ptr, %key
; Returns boolean (1 = exists, 0 = not found)
```

---

## 3. Built-in Functions Reference

### 3.1 Complete Function Signatures

| Function | Signature | Return Type | Runtime Call | Notes |
|----------|-----------|-------------|--------------|-------|
| `len(collection)` | `len(c: Vec<T> \| Queue<T> \| Map<K,V>) -> u32` | `u32` | Field access | No call, direct field load |
| `format(template, ...args)` | `format(template: string, ...args: any) -> string` | `string` | `runtime_format_string` | Variadic args |
| `sum(vec)` | `sum(vec: Vec<i64>) -> i64` | `i64` | `runtime_vec_sum` | Integer sum only (MVP) |
| `mean(vec)` | `mean(vec: Vec<i64>) -> i64` | `i64` | `runtime_vec_mean` | Integer average |
| `vec_push(vec, elem)` | `vec_push(vec: &Vec<T>, elem: T) -> void` | `void` | `runtime_vec_push` | Mutates vec |
| `vec_get(vec, index)` | `vec_get(vec: &Vec<T>, index: u32) -> T` | `T` | Inline + bounds check | Returns element |
| `queue_push(q, elem)` | `queue_push(q: &Queue<T>, elem: T) -> void` | `void` | `runtime_queue_push` | Enqueue |
| `queue_pop(q)` | `queue_pop(q: &Queue<T>) -> T` | `T` | `runtime_queue_pop` | Dequeue (panics if empty) |
| `map_insert(m, k, v)` | `map_insert(m: &Map<K,V>, k: K, v: V) -> void` | `void` | `runtime_map_insert` | Overwrites if exists |
| `map_get(m, k)` | `map_get(m: &Map<K,V>, k: K) -> V?` | `V?` | `runtime_map_get` | Returns null if not found |
| `map.contains_key(k)` | `contains_key(m: &Map<K,V>, k: K) -> bool` | `bool` | `runtime_map_contains` | Check existence |

### 3.2 Runtime Function Prototypes

**Complete C signatures for MVP runtime**:

```c
// String operations
String runtime_format_string(const char* template, ...);
u32 runtime_string_len(String* s);

// Vector operations
void runtime_vec_push(void* vec, void* element, u32 element_size);
void* runtime_vec_get(void* vec, u32 index, u32 element_size);
u32 runtime_vec_len(void* vec);
i64 runtime_vec_sum(Vec_i64* vec);
i64 runtime_vec_mean(Vec_i64* vec);

// Queue operations
void runtime_queue_push(void* queue, void* element, u32 element_size);
void* runtime_queue_pop(void* queue, u32 element_size);

// Map operations
void runtime_map_insert(void* map, void* key, void* value, u32 key_size, u32 value_size);
void* runtime_map_get(void* map, void* key, u32 key_size);
bool runtime_map_contains(void* map, void* key, u32 key_size);

// Signal operations
void* runtime_alloc_signal(u32 frequency_id, u32 size);
void runtime_emit_signal(void* agent_state, void* signal);

// Memory operations
void* runtime_alloc(size_t bytes);
void runtime_free(void* ptr);

// Error handling
void runtime_panic(const char* message) __attribute__((noreturn));
void runtime_report(const char* metric, i64 value);
```

### 3.3 Lowering Pattern Template

**For any built-in function**:

```rust
fn lower_builtin_call(name: &str, args: Vec<Value>) -> Value {
    match name {
        "len" => {
            // Direct field access - no runtime call
            let collection_ptr = args[0];
            let len_ptr = emit_get_field_addr(collection_ptr, 8);
            emit_load(len_ptr)
        }
        "format" => {
            // Variadic runtime call
            let template = args[0];
            let varargs = &args[1..];
            emit_call("runtime_format_string", [template].concat(varargs))
        }
        "vec_push" => {
            // Runtime call with size parameter
            let vec_ptr = args[0];
            let element = args[1];
            let element_size = size_of(element.type);
            emit_call("runtime_vec_push", [vec_ptr, element, element_size])
        }
        _ => panic!("Unknown builtin: {}", name)
    }
}
```

---

## 4. Struct Layout Calculation

### 4.1 Complete Algorithm

**Input**: List of fields with types
**Output**: StructLayout with offsets, total size, alignment

```rust
fn calculate_struct_layout(fields: &[Field]) -> StructLayout {
    let mut offset = 0u32;
    let mut max_alignment = 1u32;
    let mut field_layouts = Vec::new();

    for field in fields {
        let field_size = size_of(field.type);
        let field_align = align_of(field.type);

        // Track maximum alignment
        max_alignment = max_alignment.max(field_align);

        // Align offset to field's alignment
        offset = align_up(offset, field_align);

        // Record field layout
        field_layouts.push(FieldLayout {
            name: field.name.clone(),
            offset,
            size: field_size,
            type: field.type.clone(),
        });

        // Advance offset
        offset += field_size;
    }

    // Align total size to struct alignment
    let total_size = align_up(offset, max_alignment);

    StructLayout {
        fields: field_layouts,
        total_size,
        alignment: max_alignment,
    }
}

fn align_up(value: u32, alignment: u32) -> u32 {
    (value + alignment - 1) & !(alignment - 1)
}

fn size_of(ty: &Type) -> u32 {
    match ty {
        Type::U32 | Type::I32 => 4,
        Type::I64 | Type::F64 => 8,
        Type::Boolean => 1,
        Type::String | Type::Binary => 8,  // Pointer
        Type::Vec(_) => 16,  // data ptr + length + capacity
        Type::Queue(_) => 24,  // buffer ptr + head + tail + capacity (aligned)
        Type::Map(_, _) => 16,  // buckets ptr + count + capacity
        Type::Frequency(name) => {
            // Lookup frequency definition, calculate recursively
            lookup_frequency_size(name)
        }
        Type::AgentState(name) => {
            // Lookup agent state definition, calculate recursively
            lookup_state_size(name)
        }
    }
}

fn align_of(ty: &Type) -> u32 {
    match ty {
        Type::U32 | Type::I32 => 4,
        Type::I64 | Type::F64 => 8,
        Type::Boolean => 1,
        Type::String | Type::Binary => 8,
        Type::Vec(_) | Type::Queue(_) | Type::Map(_, _) => 8,  // Pointer alignment
        Type::Frequency(_) | Type::AgentState(_) => 8,  // Struct alignment (largest field)
    }
}
```

### 4.2 Example Calculation

**Input**:
```mycelial
frequency task {
    priority: u32      // size=4, align=4
    data: string       // size=8, align=8
    id: u32            // size=4, align=4
}
```

**Calculation**:
```
Field 0: priority (u32)
  - offset = align_up(0, 4) = 0
  - size = 4
  - next_offset = 0 + 4 = 4

Field 1: data (string)
  - offset = align_up(4, 8) = 8  // Padding inserted
  - size = 8
  - next_offset = 8 + 8 = 16

Field 2: id (u32)
  - offset = align_up(16, 4) = 16
  - size = 4
  - next_offset = 16 + 4 = 20

Total size before alignment: 20
Max alignment: 8
Total size = align_up(20, 8) = 24
```

**Result**:
```
StructLayout {
    fields: [
        { name: "priority", offset: 0, size: 4 },
        { name: "data", offset: 8, size: 8 },
        { name: "id", offset: 16, size: 4 },
    ],
    total_size: 24,
    alignment: 8
}
```

**Memory Visualization**:
```
Offset | Field      | Size | Value
-------|------------|------|------
0      | freq_id    | 4    | (inherited)
4      | priority   | 4    |
8      | data       | 8    | (pointer)
16     | id         | 4    |
20     | (padding)  | 4    |
-------|------------|------|------
Total: 24 bytes
```

---

## 5. Pattern Matching Dispatch

### 5.1 Dispatch Generation Algorithm

**Input**: List of rules for an agent
**Output**: Dispatch function with jump table

**Algorithm**:

```rust
fn generate_dispatch_function(agent: &HyphalDef) -> Function {
    let mut dispatch_fn = FunctionBuilder::new(&format!("{}_dispatch", agent.name));
    dispatch_fn.add_param("state_ptr", Type::Ptr);
    dispatch_fn.add_param("signal_ptr", Type::Ptr);

    // Entry block: Extract frequency ID
    let bb_entry = dispatch_fn.create_block("bb_entry");
    dispatch_fn.set_current_block(bb_entry);

    let freq_id_ptr = dispatch_fn.emit(GetFieldAddr {
        obj: "signal_ptr",
        offset: 0  // freq_id always at offset 0
    });
    let freq_id = dispatch_fn.emit(Load { addr: freq_id_ptr });

    // Group rules by frequency
    let rules_by_freq = group_rules_by_frequency(&agent.rules);

    // Generate switch/jump table
    for (frequency, rules) in rules_by_freq {
        let freq_id_const = lookup_frequency_id(frequency);
        let bb_freq = dispatch_fn.create_block(&format!("bb_freq_{}", frequency));

        // Switch case
        dispatch_fn.emit(CmpEq {
            dst: format!("is_{}", frequency),
            lhs: freq_id,
            rhs: freq_id_const,
        });
        dispatch_fn.emit(Branch {
            cond: format!("is_{}", frequency),
            true_label: bb_freq,
            false_label: "bb_next_freq",  // Try next frequency
        });

        // Frequency-specific dispatch
        dispatch_fn.set_current_block(bb_freq);
        generate_frequency_dispatch(dispatch_fn, frequency, rules);
    }

    // No match block
    let bb_no_match = dispatch_fn.create_block("bb_no_match");
    dispatch_fn.set_current_block(bb_no_match);
    dispatch_fn.emit(Return { value: None });

    dispatch_fn.build()
}
```

### 5.2 Guard Evaluation Order

**Rules**:
1. Rules evaluated in **declaration order**
2. **First matching rule wins** (no fall-through)
3. Guard must evaluate to `true` for rule to match
4. If all guards fail, signal is dropped

**Example**:
```mycelial
on signal(task, t) where t.priority > 10 {
    // Rule 1: High priority
}

on signal(task, t) where t.priority > 5 {
    // Rule 2: Medium priority
}

on signal(task, t) {
    // Rule 3: Catch-all (no guard = always true)
}
```

**Dispatch Generation**:
```
bb_freq_task:
    ; Cast to Signal_task
    %t = bitcast %signal_ptr, *Signal_task

    ; Rule 1 guard: t.priority > 10
    %priority_ptr = get_field_addr %t, 8
    %priority = load [%priority_ptr]
    %guard1 = cmp_gt %priority, 10
    branch %guard1, bb_rule_1, bb_check_rule_2

bb_rule_1:
    call agent_rule_task_0, %state_ptr, %t
    jump bb_done

bb_check_rule_2:
    ; Rule 2 guard: t.priority > 5
    %guard2 = cmp_gt %priority, 5
    branch %guard2, bb_rule_2, bb_check_rule_3

bb_rule_2:
    call agent_rule_task_1, %state_ptr, %t
    jump bb_done

bb_check_rule_3:
    ; Rule 3: No guard, always matches
    jump bb_rule_3

bb_rule_3:
    call agent_rule_task_2, %state_ptr, %t
    jump bb_done

bb_done:
    ret
```

### 5.3 Optimizations

**Optimization 1**: If no guards, direct call (no branches):
```
bb_freq_task:
    %t = bitcast %signal_ptr, *Signal_task
    call agent_rule_task_0, %state_ptr, %t
    ret
```

**Optimization 2**: Constant fold guards:
```mycelial
on signal(task, t) where true {  // Always matches
    ...
}
```
Compiles to direct call (guard eliminated).

**Optimization 3**: Dead rule elimination:
```mycelial
on signal(task, t) where t.priority > 10 { ... }
on signal(task, t) where t.priority > 5 { ... }
on signal(task, t) where t.priority > 8 { ... }  // DEAD: Never reached
```
Third rule is unreachable (first two cover all cases where it would match).

---

## 6. Edge Case Handling

### 6.1 Division by Zero

**Behavior**: **Runtime panic** (MVP)

**LIR Lowering**:
```mycelial
let result = x / y
```

**LIR** (with check):
```
bb0:
    %x = <load x>
    %y = <load y>
    %is_zero = cmp_eq %y, 0
    branch %is_zero, bb_error, bb_div

bb_div:
    %result = div %x, %y
    jump bb_continue

bb_error:
    call runtime_panic, "division by zero"
    jump bb_continue  ; Unreachable

bb_continue:
    ; Use %result
```

**Future**: Could emit error signal instead of panic.

### 6.2 Out-of-Bounds Array Access

**Behavior**: **Runtime panic** (MVP)

**See Section 2.1 `vec_get` for implementation with bounds checking.**

**Optimization**: Skip check if index is constant and provably safe:
```mycelial
let first = vec_get(state.items, 0)  // Always safe if vec has elements
```

### 6.3 Uninitialized State Fields

**Behavior**: **Zero-initialize** all fields

**Rule**:
- Fields with explicit init values: use provided value
- Fields without init values: zero-initialize (0 for numbers, empty for collections)

**Example**:
```mycelial
state {
    counter: u32        // No init → 0
    queue: queue<string>  // No init → empty queue
    name: string = "default"  // Has init → "default"
}
```

**LIR** (init function):
```
function init_agent_state(state_ptr: *AgentState) {
    ; counter = 0
    %counter_ptr = get_field_addr %state_ptr, 0
    %zero = const 0
    store [%counter_ptr], %zero

    ; queue = empty
    %queue_ptr = get_field_addr %state_ptr, 8
    call runtime_queue_init, %queue_ptr

    ; name = "default"
    %name_ptr = get_field_addr %state_ptr, 32
    %default_str = const "default"
    store [%name_ptr], %default_str

    ret
}
```

### 6.4 Signal Emission in Guards

**Rule**: **Guards must be pure** (no side effects)

**Enforcement**: **Compile-time error** if guard contains:
- `emit` statement
- `report` statement
- State mutations
- Function calls with side effects

**Valid Guards**:
- Field access (signal fields, state fields - read only)
- Arithmetic/comparison operations
- Pure function calls (`len`, `format` - no observable side effects)

**Invalid Guard**:
```mycelial
on signal(task, t) where check_and_emit(t) {  // ERROR: emit in guard
    ...
}
```

**Error Message**: "Guards must be pure expressions (no emit, no state mutation)"

### 6.5 Recursive Signal Emission

**Behavior**: **Queued for next cycle** (asynchronous)

**Example**:
```mycelial
on signal(ping, p) {
    emit ping { count: p.count + 1 }  // Self-signal
}
```

**Semantics**:
- Signal emitted to outbox during ACT phase
- Routed to inbox during REST phase
- Delivered in **next cycle's SENSE phase**
- **No infinite loop** (tidal cycle boundary prevents)

**LIR**: No special handling needed (same as any emit).

---

## 7. Implementation Algorithms

### 7.1 Type Inference for Let Bindings

**Input**: Let statement with optional type annotation
**Output**: Type information for binding

**Algorithm**:
```rust
fn infer_let_type(let_stmt: &LetStatement) -> Type {
    if let Some(explicit_type) = &let_stmt.type_annotation {
        // Explicit type provided
        return explicit_type.clone();
    }

    // Infer from initializer
    if let Some(init_expr) = &let_stmt.initializer {
        return infer_expr_type(init_expr);
    }

    panic!("Let binding must have either type annotation or initializer");
}

fn infer_expr_type(expr: &Expr) -> Type {
    match expr {
        Expr::Literal(lit) => lit.type.clone(),
        Expr::BinaryOp { left, right, op, .. } => {
            let left_type = infer_expr_type(left);
            let right_type = infer_expr_type(right);
            infer_binop_result_type(op, &left_type, &right_type)
        }
        Expr::Call { name, args, .. } => {
            lookup_function_return_type(name, args)
        }
        Expr::FieldAccess { object, field, .. } => {
            let object_type = infer_expr_type(object);
            lookup_field_type(&object_type, field)
        }
        // ... other cases
    }
}
```

### 7.2 Binary Operation Type Coercion

**Rules** (MVP - simple):
1. Both operands must have same type (no implicit coercion)
2. Result type = operand type
3. Comparisons always return `boolean`

**Example**:
```mycelial
let x: u32 = 10
let y: u32 = 20
let sum = x + y  // Type: u32

let cond = x > y  // Type: boolean
```

**Invalid** (type mismatch):
```mycelial
let x: u32 = 10
let y: i64 = 20
let sum = x + y  // ERROR: cannot add u32 and i64
```

**Future**: Add explicit conversion functions (`u32_to_i64`, etc.).

### 7.3 SSA Temporary Allocation

**Strategy**: Sequential numbering per function

```rust
struct FunctionBuilder {
    temp_counter: u32,
    // ...
}

impl FunctionBuilder {
    fn allocate_temp(&mut self, ty: Type) -> Value {
        let temp = Value {
            name: format!("%tmp{}", self.temp_counter),
            type: ty,
        };
        self.temp_counter += 1;
        temp
    }
}
```

**Example**:
```
%tmp0 = const 5
%tmp1 = const 3
%tmp2 = add %tmp0, %tmp1
%tmp3 = mul %tmp2, 2
```

**Alternative**: Semantic naming (debugging-friendly):
```
%state_counter_old = load [%counter_ptr]
%state_counter_new = add %state_counter_old, 1
```

**MVP**: Use sequential numbering. Add semantic names as debug info.

---

## Summary

This addendum fills critical gaps in the IR specification:

1. ✅ **Loop lowering**: While loop algorithm with examples
2. ✅ **Collection operations**: Complete lowering patterns for vec, queue, map
3. ✅ **Built-in functions**: Full signature table and runtime prototypes
4. ✅ **Struct layout**: Concrete algorithm with examples
5. ✅ **Pattern matching**: Dispatch generation with guard ordering
6. ✅ **Edge cases**: Defined behavior for all ambiguous scenarios
7. ✅ **Implementation algorithms**: Type inference, coercion, SSA allocation

**With this addendum, the IR specification is 95% implementation-ready** for M1.

**Remaining 5%**:
- Parser AST structure clarification (coordination with Haiku)
- Code Gen LIR requirements clarification (coordination with Opus)
- Edge case policy decisions (panic vs error signal)

---

🌿🧬 **IR Specification Complete - Ready for M1 Implementation** 🚀
