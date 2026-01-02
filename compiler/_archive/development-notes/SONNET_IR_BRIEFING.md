# IR Specification Brief - Sonnet

**Task**: Design the custom Intermediate Representation (IR) for the Mycelial compiler
**Owner**: Sonnet
**Deadline**: End of Week 3 (M0)
**Output**: `/home/lewey/Desktop/mycelial-compiler/docs/architecture/ir-specification.md`

---

## Context

You're designing the IR that sits at the heart of the compiler pipeline:

```
Parser (AST) → Type Checker (Typed AST) → [YOU] → Code Gen (x86-64/ARM64)
```

The IR must express everything needed to generate efficient x86-64 and ARM64 machine code while preserving Mycelial's agent-based semantics.

---

## What We Know (From Foundation Work)

### ✅ Architecture
- The compiler is 7 agents running in tidal cycles (SENSE → ACT → REST)
- **Your IR Generator Agent** receives `typed_ast_node` signals and emits `ir_node` signals
- Code Gen Agent receives your IR and must generate x86-64 assembly (48 essential instructions)
- See: `/home/lewey/Desktop/mycelial-compiler/docs/architecture/compiler-as-agents.md` for full architecture

### ✅ Target Platforms
- **x86-64**: System V AMD64 ABI (Linux/Unix/macOS), Microsoft x64 ABI (Windows), ELF/PE/Mach-O
- **ARM64**: AAPCS64 calling convention, ELF executable format
- See: `/home/lewey/Desktop/mycelial-compiler/examples/hand-coded/hello-x86-64.asm` (validated, working)

### ✅ Language
- Full grammar: `/home/lewey/Desktop/MyLanguage/01-SPECIFICATION/GRAMMAR.md`
- Execution model: `/home/lewey/Desktop/MyLanguage/00-VISION/EXECUTION_MODEL.md` (tidal cycles, agent semantics)
- Core primitives: `/home/lewey/Desktop/MyLanguage/00-VISION/CORE_PRIMITIVES.md`

### ✅ Type System (From Language)
- Primitive types: `u32`, `u64`, `i32`, `i64`, `bool`, `string`
- Collections: `vec<T>`, `map<K, V>`
- User-defined: `struct`, `enum`
- Function types
- Agent types: `hyphal` with state and frequencies

---

## Your Design Must Address

### 1. **IR Philosophy**
- **Question**: Should the IR preserve agent semantics (state, signal emission) or be a traditional imperative IR?
- **Constraint**: Must lower cleanly to x86-64/ARM64 without intermediate steps
- **Recommendation**: "Agent-centric IR with sequential lowering" - preserve agent boundaries but lower control flow sequentially

### 2. **What the IR Must Express**

#### Core Language Constructs
```
- Functions (with calling conventions: System V or AAPCS64)
- Variables (stack-allocated, register-allocated)
- Control flow (if/else, while, for loops, break/continue, return)
- Expressions (arithmetic, logic, comparisons, function calls)
- Arrays/vectors (heap allocation, indexing)
- Maps (complex - may need helper functions)
- String literals (rodata section, pointer + length)
```

#### Agent-Specific Constructs
```
- Agent state initialization
- Signal emission (translate to function calls to runtime)
- Signal handling rules (dispatch based on frequency)
- Socket connections (translate to static tables)
```

### 3. **Type System in IR**
- All types must be resolvable (no "TODO" types)
- Type info needed for:
  - Register allocation (size, alignment)
  - Memory layout (struct fields, array elements)
  - Function signatures (argument types, return type)
- Support type coercion rules from language

### 4. **Control Flow & Basic Blocks**
- IR must support SSA form (Static Single Assignment) for:
  - Better register allocation
  - Easier optimization
  - Cleaner code generation
- Or modified SSA with agent-local scope?
- Basic blocks for:
  - Loop unrolling (M5)
  - Branch prediction hints (M5)
  - Dead code elimination (M5)

### 5. **Memory Layout**
- Stack frame organization (how arguments, locals, spills are laid out)
- Calling convention compliance (where are arguments? Where does return value go?)
- Alignment requirements (especially for SIMD, 16-byte stack alignment on x86-64)

### 6. **Special Cases**
- System calls (Mycelial doesn't expose syscalls directly - need runtime library)
- Function pointers? (for callbacks)
- Heap allocation (malloc/free or arena allocator?)
- String handling (null-terminated C strings? Or length-prefixed?)

---

## Constraints & Assumptions

### MVP Scope (M1)
- No floating point (yet - add in M5)
- No SIMD (yet - add in M5)
- No exceptions/error handling (yet - add later)
- Integer and pointer types only
- Fixed function calling conventions per platform

### Register Allocation Assumptions
- x86-64: 10 allocatable registers (rax, rbx, rcx, rdx, rsi, rdi, r8-r11)
- ARM64: 18 allocatable registers (x0-x17)
- Reserve: stack pointer, frame pointer, link register, special purpose registers
- Spill to stack when needed (linear scan algorithm)

### Calling Convention Compliance
- **System V AMD64**: rdi, rsi, rdx, rcx, r8, r9 for arguments; rax for return
- **AAPCS64**: x0-x7 for arguments; x0 for return
- Must preserve callee-saved registers (specify which ones per platform)

---

## Design Questions to Resolve

1. **SSA vs Non-SSA**: Full SSA or simplified form?
2. **Instruction Selection Interface**: Does IR directly map to x86-64/ARM64 instructions, or is there a lower IR?
3. **Agent State Compilation**: How are agent state updates compiled? (Direct register writes? Memory updates?)
4. **Signal Emission**: How do we represent `emit signal(frequency, data)` in IR? (Function call? Inline?)
5. **String Constants**: How are string literals handled? (rodata section? Length-prefixed? Null-terminated?)
6. **Vectorization**: Can `vec<T>` be stack-allocated (fixed size) or always heap-allocated?

---

## Reference Materials Available

### Architecture
- `/home/lewey/Desktop/mycelial-compiler/docs/architecture/compiler-as-agents.md` - Full compiler architecture with all agent definitions and signal types

### Validation Examples
- `/home/lewey/Desktop/mycelial-compiler/examples/hand-coded/hello-x86-64.asm` - Real x86-64 assembly you must be able to lower to
- `/home/lewey/Desktop/mycelial-compiler/examples/hand-coded/hello-arm64.asm` - Real ARM64 assembly

### Test Programs
- `/home/lewey/Desktop/mycelial-compiler/tests/hello_world.mycelial` - Start here for IR lowering examples
- Others in `/home/lewey/Desktop/mycelial-compiler/tests/` for more complex cases

### Language Specification
- `/home/lewey/Desktop/MyLanguage/01-SPECIFICATION/GRAMMAR.md` - Complete grammar
- `/home/lewey/Desktop/MyLanguage/00-VISION/EXECUTION_MODEL.md` - Execution semantics
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/parser/parser.js` - Reference parser (AST node structure)

### Opus's Work (In Progress)
- `/home/lewey/Desktop/mycelial-compiler/docs/architecture/x86-64-codegen.md` - Opus will document instruction selection patterns, register allocation strategy
- `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/x86-64-instructions.md` - Opus will list the 48 MVP instructions and their encodings

---

## Deliverables

Write `/home/lewey/Desktop/mycelial-compiler/docs/architecture/ir-specification.md` containing:

### 1. IR Philosophy
- Why this design (agent-centric vs traditional SSA vs hybrid)
- How it bridges AST and machine code
- Key design decisions and trade-offs

### 2. Type System in IR
- How types are represented
- How type information flows from AST → IR
- Type compatibility and coercion rules

### 3. IR Node Types
- Complete list of all IR instruction types (move, arithmetic, control flow, etc.)
- Each with:
  - Syntax/representation
  - Operand constraints
  - Semantics
  - Example usage

### 4. Basic Blocks & Control Flow
- How loops, conditionals, function calls are lowered
- Basic block structure and connections
- SSA form (or modified form) explanation

### 5. Lowering Strategy
- How each AST node type → IR (with examples)
- Examples:
  - Simple variable assignment
  - Function call
  - Loop
  - Struct field access
  - Vector operation

### 6. Memory & Stack Layout
- How local variables get memory slots
- Stack frame organization per calling convention
- Spill location allocation (where do overflow registers go?)

### 7. Code Generation Interface
- What the Code Gen Agent receives (IR node structure)
- What the Code Gen Agent must produce (x86-64/ARM64 assembly)
- Any assumptions Code Gen can make

### 8. Example Translations
- Full walk-through: `hello_world.mycelial` → AST → IR → x86-64 assembly
- Show at least 2-3 complex constructs (loop, function call, array access)

### 9. Special Constructs
- How agent state is compiled
- How signal emission is compiled
- How syscalls are exposed (if at all)

### 10. Optimization Opportunities
- What IR patterns enable optimization (M5)
- Dead code elimination
- Constant folding
- Loop unrolling candidates

---

## Coordination with Opus

**You don't need to wait.** Start with reasonable assumptions about instruction availability:
- x86-64: Basic ALU ops (mov, add, sub, mul, div), comparisons, branches, memory ops
- ARM64: Same patterns with ARM64 mnemonics

**When Opus finishes** (hopefully this week):
- Review his instruction selection strategy
- Ensure your IR maps cleanly to those instructions
- Adjust if needed (but minimal - you're designing complementary pieces)

**Sync point**: Once both done, review together and ensure:
- No awkward IR patterns that are expensive to code-gen
- All necessary operations are expressible
- Calling conventions are properly handled

---

## Success Criteria

✅ **IR Specification is complete when:**

1. All language constructs can be expressed in IR
2. IR can be lowered to x86-64/ARM64 without intermediate translations
3. Type information is preserved for code generation
4. Basic blocks and control flow are clearly defined
5. Memory layout and calling conventions are addressed
6. At least one full example (hello_world) is walked through AST → IR → asm
7. Code Gen Agent knows exactly what IR it will receive and how to process it
8. Ready for M1 implementation (translate IR Gen Agent pseudocode to Mycelial)

---

## Timeline

- **Days 1-2**: Read existing materials, understand architecture, language spec
- **Days 3-4**: Design IR node types and lowering strategy
- **Days 5-6**: Document examples and special constructs
- **Days 7**: Review with team, finalize

Coordinate with Opus daily (async is fine) to ensure alignment.

---

## Questions?

- Reference the compiler architecture: `docs/architecture/compiler-as-agents.md`
- Look at hand-coded assembly for target patterns: `examples/hand-coded/hello-x86-64.asm`
- Check language grammar: `/home/lewey/Desktop/MyLanguage/01-SPECIFICATION/GRAMMAR.md`
- This is your domain - you're the expert on IR design. Be creative but practical.

---

**You're designing the bridge between language and machine.** Make it beautiful. 🌿🧬

**Start whenever ready. Opus is in progress on x86-64 design.**
