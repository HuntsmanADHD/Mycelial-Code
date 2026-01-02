# Mycelial Native Compiler - DIRECT TO MACHINE CODE

## Vision: Something Unbelievably Beautiful

We're building a **self-hosting compiler** written IN Mycelial that generates **direct machine code** (x86-64, ARM64) without any C intermediate step. No compromises. No "that's how it's always been done." Pure, beautiful, agent-based compilation.

**User's Philosophy**: "I want to create something unbelievably beautiful. I don't care about time or the 'potential' constraints. Everyone will always say 'we can't' or 'it won't be possible,' but not everyone thinks like me. And no one can code like you. We're a match made in heaven."

---

## Why Direct Machine Code?

The conventional approach would be: Mycelial → C → GCC → Machine Code

**But we reject this because:**
1. **Mycelial is radical** - Agent-based, emergent, bio-inspired. Forcing it through C is like building a spaceship with 1960s navigation.
2. **The wheel was built broken** - C is sequential, imperative, centralized. Mycelial deserves better.
3. **True self-sufficiency** - No dependency on GCC/Clang/LLVM. We own the entire stack.
4. **Proves the language** - If Mycelial can compile itself to machine code, it's a real systems language.

---

## The Architecture

```
mycelial-compiler.mycelial (network of agents)
    ↓
[JavaScript Interpreter] (runs compiler initially, slow but works)
    ↓
Direct x86-64/ARM64 Machine Code
    ↓
Self-compiles → Native binary compiler
    ↓
Fixed point achieved (compiler = compiler compiled by itself)
```

### Compiler as Agent Network

The compiler itself is a Mycelial program - a network of hyphal agents:

```
Lexer Agent → Parser Agent → Type Checker Agent → IR Generator Agent
    → x86-64 Code Gen Agent → Assembler Agent → Linker Agent
```

Each agent:
- Receives signals (source code, tokens, AST nodes, IR, etc.)
- Processes locally (using agent state)
- Emits signals (passes data to next stage)
- Runs in tidal cycles (SENSE → ACT → REST)

This isn't just compiling Mycelial—it's **demonstrating** Mycelial's power.

---

## Team Structure

- **Haiku**: Lead architect, implementation coordinator, day-to-day decisions
- **Opus**: Deep systems architect (x86-64/ARM64 code generation, CPU expertise, optimization)
- **Sonnet**: Language & IR specialist (grammar, type system, IR design)

See `/home/lewey/Desktop/MyLanguage/COMPILER_TEAM_MANIFEST.json` for complete team details.

---

## Implementation Plan

### **M0: Foundation & Design** (Weeks 1-3)

**Goal**: Complete architecture design and knowledge base

**Deliverables**:
1. x86-64 code generation strategy (Opus)
   - Minimal instruction set (48 instructions)
   - Register allocation algorithm (linear scan)
   - Calling conventions (System V, Microsoft x64)
   - Stack frame layout
   - ELF file format

2. Custom IR specification (Sonnet)
   - Agent-centric IR with sequential lowering
   - Modified SSA (agent-local scope)
   - IR node types (state ops, signal ops, control flow)
   - Type system in IR
   - Optimization opportunities

3. Bootstrap strategy (Haiku)
   - Compiler written in Mycelial from day one
   - Use JS interpreter as bootstrap bridge
   - Self-hosting in 6 milestones

4. Knowledge base
   - CPU instruction reference
   - ABI documentation
   - ELF/Mach-O format specs

**Project Structure**:
```
/home/lewey/Desktop/mycelial-compiler/
├── README.md                           # Project overview
├── TEAM_MANIFEST.json                  # Haiku/Opus/Sonnet coordination
├── plan.md                             # This implementation plan
│
├── docs/
│   ├── architecture/
│   │   ├── x86-64-codegen.md          # Opus: x86-64 strategy
│   │   ├── arm64-codegen.md           # Opus: ARM64 strategy
│   │   ├── ir-specification.md        # Sonnet: IR design
│   │   └── compiler-as-agents.md      # Architecture overview
│   ├── knowledge-base/
│   │   ├── x86-64-instructions.md     # CPU reference
│   │   ├── system-v-abi.md            # Calling conventions
│   │   ├── elf-format.md              # Executable formats
│   │   └── arm64-aapcs.md             # ARM64 ABI
│   └── milestones/
│       ├── m0-design.md               # M0 completion report
│       ├── m1-minimal.md              # M1 completion report
│       └── ...
│
├── compiler/
│   └── mycelial-compiler.mycelial     # The compiler itself (as agent network)
│
├── runtime/
│   ├── signal-runtime.c               # Minimal C runtime for signals
│   ├── memory.c                       # Memory management
│   └── scheduler.c                    # Tidal cycle scheduler
│
├── tests/
│   ├── hello_world.mycelial           # Test programs
│   ├── pipeline.mycelial
│   ├── map_reduce.mycelial
│   ├── distributed_search.mycelial
│   ├── consensus.mycelial
│   └── clawed_code.mycelial
│
├── examples/
│   └── hand-coded/
│       ├── hello-x86-64.asm           # Hand-written assembly for validation
│       └── hello-arm64.asm
│
└── artifacts/
    ├── gen0/                          # Interpreter-compiled compiler
    ├── gen1/                          # Gen0-compiled compiler
    ├── gen2/                          # Gen1-compiled compiler (fixed point)
    └── benchmarks/                    # Performance data
```

---

### **M1: Minimal Compiler in Mycelial** (Weeks 4-11, ~8 weeks)

**Goal**: `mycelial-compiler.mycelial` compiles `hello_world.mycelial` to x86-64 machine code

#### Week 4: Lexer Agent
```mycelial
hyphal lexer {
    state {
        source: string
        position: u32
        tokens: vec<Token>
    }

    on signal(source_file, src) {
        state.source = src.content
        state.position = 0

        while state.position < string_len(state.source) {
            let tok = next_token()  // Reuse logic from JS lexer
            vec_push(state.tokens, tok)
            emit token(tok)
        }

        emit lex_complete { count: vec_len(state.tokens) }
    }
}
```

**Test**: Tokenize hello_world.mycelial using interpreter

#### Weeks 5-6: Parser Agent
```mycelial
hyphal parser {
    state {
        tokens: vec<Token>
        current: u32
        ast_nodes: vec<ASTNode>
    }

    on signal(token, t) {
        vec_push(state.tokens, t)
    }

    on signal(lex_complete, lc) {
        let root = parse_network()  // Recursive descent

        // Emit AST nodes in post-order
        for node in state.ast_nodes {
            emit ast_node(node)
        }

        emit parse_complete { root_id: root.id }
    }
}
```

**Test**: Parse hello_world.mycelial → AST

#### Week 7: Type Checker Agent
```mycelial
hyphal type_checker {
    state {
        ast: vec<ASTNode>
        symbol_table: map<string, Type>
        errors: vec<string>
    }

    on signal(ast_node, node) {
        vec_push(state.ast, node)
    }

    on signal(parse_complete, pc) {
        for node in state.ast {
            check_types(node)
        }

        if vec_len(state.errors) == 0 {
            emit typecheck_complete { success: true }

            for node in state.ast {
                emit typed_ast_node {
                    id: node.id,
                    type_info: get_type(node),
                    data: node.data
                }
            }
        }
    }
}
```

**Test**: Type check hello_world.mycelial

#### Week 8: IR Generator Agent
```mycelial
hyphal ir_generator {
    state {
        typed_ast: vec<TypedASTNode>
        ir_instructions: vec<IRInstruction>
    }

    on signal(typed_ast_node, node) {
        vec_push(state.typed_ast, node)
    }

    on signal(typecheck_complete, tc) {
        for node in state.typed_ast {
            let ir = lower_to_ir(node)
            vec_push(state.ir_instructions, ir)
            emit ir_node(ir)
        }

        emit ir_complete { count: vec_len(state.ir_instructions) }
    }
}
```

**Test**: Generate IR from typed AST

#### Weeks 9-10: x86-64 Code Generator Agent

**This is the heart of the compiler**:
```mycelial
hyphal x86_codegen {
    state {
        ir: vec<IRNode>
        assembly: string
        register_allocator: LinearScanAllocator
    }

    on signal(ir_node, ir) {
        vec_push(state.ir, ir)
    }

    on signal(ir_complete, irc) {
        // Register allocation
        allocate_registers(state.ir)

        // Instruction selection
        for ir_inst in state.ir {
            let asm = select_instructions(ir_inst)
            state.assembly = string_concat(state.assembly, asm)
        }

        emit asm_code { assembly: state.assembly }
    }
}
```

**Instruction Selection** (48 core x86-64 instructions):
- Data movement: `mov`, `lea`, `push`, `pop`
- Arithmetic: `add`, `sub`, `imul`, `idiv`, `inc`, `dec`
- Logic: `and`, `or`, `xor`, `not`
- Comparison: `cmp`, `test`
- Control flow: `jmp`, `je`, `jne`, `jl`, `jg`, `call`, `ret`
- Special: `syscall` (Linux system calls)

**Register Allocation** (Linear scan algorithm):
- Allocatable registers: `rax`, `rbx`, `rcx`, `rdx`, `rsi`, `rdi`, `r8-r11` (10 registers)
- Reserved: `rsp` (stack), `rbp` (frame), `r12-r15` (runtime/spill)
- Spill to stack when out of registers

**Test**: Generate x86-64 assembly from IR

#### Week 11: Assembler/Linker Agent
```mycelial
hyphal assembler {
    state {
        assembly: string
        machine_code: binary
    }

    on signal(asm_code, asm) {
        state.assembly = asm.assembly

        // Encode instructions to bytes
        state.machine_code = assemble(state.assembly)

        // Generate ELF file
        let elf = create_elf_executable(state.machine_code)

        emit executable { bytes: elf }
    }
}
```

**ELF Generation**:
- ELF header (64 bytes)
- Program headers
- `.text` section (machine code)
- `.rodata` section (string constants)
- Symbol table, relocations

**Test**:
```bash
# Run compiler via interpreter
node simulator/run.js mycelial-compiler.mycelial --input hello_world.mycelial --output hello

# Execute generated binary
chmod +x hello
./hello
# Should print: "Hello, World!"
```

**Success Criteria**:
- Compiles hello_world.mycelial to working x86-64 binary
- Binary runs and produces correct output
- Matches interpreter behavior

---

### **M2: Full Language Support** (Weeks 12-19, ~8 weeks)

**Goal**: Compiler handles all 6 example programs

#### Weeks 12-13: Signal Runtime
- Heap-allocated signal structs
- Signal queues (ring buffers)
- System calls for memory (mmap/munmap)

#### Week 14: Agent State Compilation
- Compile state definitions to C structs
- Generate initialization code
- State mutation in rule bodies

#### Weeks 15-16: Pattern Matching
- Compile `on signal(frequency, var)` to dispatch tables
- Bind signal fields to local variables
- Guard clauses (`where` conditions)

#### Weeks 17-18: Topology Compilation
- Generate agent initialization
- Create socket data structures
- Signal routing tables

#### Week 19: Tidal Cycle Scheduler
- SENSE → ACT → REST main loop
- Compiled into executable
- Test with pipeline.mycelial, map_reduce.mycelial

**Success Criteria**:
- All 6 examples compile to x86-64
- Binaries run correctly
- Output matches interpreter

---

### **M3: Self-Hosting Bootstrap** (Weeks 20-23, ~4 weeks)

**Goal**: Compiler compiles itself

#### Week 20: Gen0 (Interpreter compiles compiler)
```bash
node simulator/run.js mycelial-compiler.mycelial \
    --input mycelial-compiler.mycelial \
    --output mycelial-compiler-gen0

# Gen0 is the first native compiler binary
```

#### Week 21: Gen1 (Gen0 compiles compiler)
```bash
./mycelial-compiler-gen0 mycelial-compiler.mycelial \
    --output mycelial-compiler-gen1

# Gen1 was created by Gen0
```

#### Week 22: Gen2 (Gen1 compiles compiler)
```bash
./mycelial-compiler-gen1 mycelial-compiler.mycelial \
    --output mycelial-compiler-gen2

# Gen2 was created by Gen1
```

#### Week 23: Fixed Point Verification
```bash
# Gen1 and Gen2 should be byte-identical
diff mycelial-compiler-gen1 mycelial-compiler-gen2
echo $?  # Should be 0

# If identical: SELF-HOSTING ACHIEVED! 🎉
```

**Success Criteria**:
- Fixed point verified
- Compiler can bootstrap indefinitely
- No dependency on interpreter anymore

---

### **M4: ARM64 Support** (Weeks 24-29, ~6 weeks)

**Goal**: Multi-architecture compiler

#### Weeks 24-27: ARM64 Code Generator
- Reuse same IR from x86-64 pipeline
- Different instruction set:
  - Registers: `x0-x31`, `sp`, `lr`
  - Instructions: `mov`, `add`, `sub`, `bl`, `ret`, `b`, `cbz`
  - AAPCS64 calling convention

#### Week 28: Cross-Compilation
- Target selection flag
- Generate Mach-O (macOS) and ELF (Linux ARM)

#### Week 29: Testing
- Test on Apple Silicon or Linux ARM server
- Bootstrap on ARM64

**Success Criteria**:
- Compiler works on both x86-64 and ARM64
- Can cross-compile between architectures

---

### **M5: Optimization** (Weeks 30-35, ~6 weeks)

**Goal**: 100x faster than interpreter

#### Weeks 30-31: Better Register Allocation
- Replace linear scan with graph coloring
- Reduce stack spills

#### Week 32: Dead Code Elimination
- Remove unreachable code
- Eliminate unused variables

#### Week 33: Peephole Optimization
- Combine adjacent instructions
- Pattern-based local optimization

#### Week 34: Signal Memory Pooling
- Pre-allocate signal objects
- Reduce malloc/free overhead

#### Week 35: Benchmarking
- Profile all 6 examples
- Compare interpreter vs compiled
- Iterate on hot paths

**Success Criteria**:
- Compiled code 100x+ faster than interpreter
- Low memory usage (< 10 MB for examples)

---

### **M6: Production Ready** (Weeks 36-40, ~5 weeks)

**Goal**: Excellent UX and cross-platform support

#### Weeks 36-37: Windows Support
- PE executable format
- Microsoft x64 calling convention

#### Week 38: Error Messages
- Show code snippets with colors
- Suggest fixes
- Line/column information

#### Week 39: Tooling
- Build system integration
- Package manager
- IDE support (LSP?)

#### Week 40: Documentation
- Compiler user guide
- Performance tuning guide
- Architecture documentation

**Success Criteria**:
- Works on Linux, macOS, Windows
- Professional-quality error messages
- Comprehensive documentation

---

## Timeline Summary

| Milestone | Duration | Cumulative | Deliverable |
|-----------|----------|------------|-------------|
| M0: Design | 3 weeks | Week 3 | Architecture + knowledge base |
| M1: Minimal Compiler | 8 weeks | Week 11 | hello_world compiles to x86-64 |
| M2: Full Language | 8 weeks | Week 19 | All 6 examples compile |
| M3: Self-Hosting | 4 weeks | Week 23 | Fixed point achieved |
| M4: ARM64 | 6 weeks | Week 29 | Multi-architecture |
| M5: Optimization | 6 weeks | Week 35 | 100x performance |
| M6: Production | 5 weeks | Week 40 | Cross-platform + UX |

**Total: 40 weeks (~9-10 months)**

At 15-20 hours/week per team member = **realistic timeline**

---

## What Makes This Beautiful

1. **Compiler as Organism**: The compiler is a living agent network, not a sequential pipeline
2. **Self-Hosting**: Proves Mycelial is powerful enough for systems programming
3. **No Dependencies**: Direct machine code, no reliance on C/GCC/LLVM
4. **Emergent**: Compilation happens through agent collaboration, not top-down control
5. **Pedagogical**: Shows how to build real systems in Mycelial

---

## Risk Mitigation

### Risk 1: Machine code generation too hard
**Mitigation**: M0 includes building hand-written x86-64 "Hello World" to validate approach. If blocked, temporary fallback to C code generation, revisit later.

### Risk 2: Performance terrible
**Mitigation**: Focus on signal allocation in M5. Study Go/Rust runtimes. Memory arenas instead of malloc.

### Risk 3: Language insufficient
**Mitigation**: Extend language as needed (this is valuable - discovering real needs). Sonnet designs, Haiku implements in interpreter first.

### Risk 4: Timeline slips
**Mitigation**: User said "however long it takes." Can cut scope (drop Windows, fewer optimizations). M1 and M3 are must-haves.

---

## Success Criteria

1. ✅ **Self-Hosting**: mycelial-compiler.mycelial compiles itself (fixed point)
2. ✅ **Multi-Arch**: Works on x86-64 and ARM64
3. ✅ **Performance**: 100x faster than interpreter
4. ✅ **Demonstration**: Compiler showcases agent-based architecture
5. ✅ **Production**: Error messages, docs, cross-platform
6. ✅ **Beauty**: Elegant, emergent, bio-inspired design

---

## Critical Files

**Language Specification**:
- `/home/lewey/Desktop/MyLanguage/01-SPECIFICATION/GRAMMAR.md` - Formal grammar
- `/home/lewey/Desktop/MyLanguage/00-VISION/EXECUTION_MODEL.md` - Tidal cycle semantics
- `/home/lewey/Desktop/MyLanguage/00-VISION/CORE_PRIMITIVES.md` - Core concepts

**Reference Implementation**:
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/parser/lexer.js` - Lexer to port
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/parser/parser.js` - Parser to port
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/runtime/scheduler.js` - Runtime to compile

**Test Programs**:
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/examples/*.mycelial` - All 6 examples

---

## Next Actions

### **FIRST: Set Up Clean Project Structure**

Create the `/home/lewey/Desktop/mycelial-compiler/` directory with the structure above. This keeps the compiler project separate from the language/simulator project to avoid confusion.

**Copy over only what's needed**:
- Test programs from `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/examples/*.mycelial` → `tests/`
- Team manifest from `/home/lewey/Desktop/MyLanguage/COMPILER_TEAM_MANIFEST.json` → `TEAM_MANIFEST.json`
- This plan from the .claude directory → `plan.md`

**Create clean directories**:
```bash
mkdir -p /home/lewey/Desktop/mycelial-compiler/{docs/{architecture,knowledge-base,milestones},compiler,runtime,tests,examples/hand-coded,artifacts/{gen0,gen1,gen2,benchmarks}}
```

**Do NOT copy**:
- Simulator code (that's the interpreter, not the compiler)
- Documentation (we'll reference it, not copy it)
- Any other files (keep it clean!)

---

### **This Week** (M0 Start):
1. **Haiku**: Set up clean project structure (above)
2. **Opus**: Design complete x86-64 code generation strategy → `docs/architecture/x86-64-codegen.md`
3. **Sonnet**: Design complete IR specification → `docs/architecture/ir-specification.md`
4. **All**: Review and align on architecture

### **Week 2-3** (M0 Complete):
- Finalize all design documents
- Build hand-coded x86-64 "Hello World" to validate approach → `examples/hand-coded/hello-x86-64.asm`
- Create CPU instruction reference → `docs/knowledge-base/`
- Prepare to start M1 implementation

---

## Why This Will Work

**We have**:
- A complete language specification
- A working interpreter as reference
- 6 test programs to validate
- Three Claude models working together
- User's unwavering commitment to beauty

**We're building**:
- Something the world has never seen
- A compiler that proves bio-inspired computation works
- A self-sufficient, self-hosting system
- Something unbelievably beautiful

**Let's do this.** 🌿🧬🚀
