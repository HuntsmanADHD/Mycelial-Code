# 🌿🧬 Mycelial Native Compiler

**A self-hosting compiler written IN Mycelial that generates direct machine code (x86-64, ARM64)**

Direct to machine code. No C intermediate. No GCC/LLVM dependencies. Pure, beautiful, agent-based compilation.

---

## 🎯 Vision

From Huntsman:

> "I want to create something unbelievably beautiful. I don't care about time or constraints. Everyone will always say 'we can't' or 'it won't be possible,' but not everyone thinks like me. And no one can code like you. We're a match made in heaven."

This compiler proves that a bio-inspired, agent-based language can handle real systems programming. No compromises. Direct to machine code. Pure self-hosting.

---

## Quick Navigation

### 📋 Core Documentation
- **[plan.md](plan.md)** - Complete 40-week implementation roadmap (6 milestones)
- **[PROGRESS_TRACKER.md](PROGRESS_TRACKER.md)** - Phase-by-phase checkpoint tracking
- **[OPERATIONS.md](OPERATIONS.md)** - Quality gates and review criteria

### 📚 Architecture & Design
- **[docs/architecture/](docs/architecture/)** - Compiler design documents
  - `compiler-as-agents.md` - 7-agent architecture overview
  - `x86-64-codegen.md` - x86-64 code generation strategy
  - `arm64-codegen.md` - ARM64 code generation strategy
  - `ir-specification.md` - Intermediate representation design
- **[docs/knowledge-base/](docs/knowledge-base/)** - CPU and system documentation
  - `x86-64-instructions.md` - x86-64 instruction reference
  - `system-v-abi.md` - System V AMD64 ABI
  - `elf-format.md` - ELF executable format

### 💻 Implementation
- **[compiler/](compiler/)** - The compiler implementation (7 agents in Mycelial)
  - `mycelial-compiler.mycelial` - Main orchestration file
  - `lexer.mycelial` - Tokenization agent
  - `parser.mycelial` - AST generation agent
  - `type_checker.mycelial` - Type validation agent
  - `ir_generator.mycelial` - IR lowering agent
  - `x86_codegen.mycelial` - Machine code generation agent
  - `assembler.mycelial` - Binary encoding agent
  - `linker.mycelial` - ELF linking agent
- **[tests/](tests/)** - Test programs (6 examples)
  - `hello_world.mycelial` - Basic signal routing
  - `pipeline.mycelial` - Sequential processing
  - `map_reduce.mycelial` - Parallel data processing
  - `distributed_search.mycelial` - Task distribution
  - `consensus.mycelial` - Distributed voting
  - `clawed_code.mycelial` - P2P messaging
- **[examples/](examples/)** - Example code and hand-written assembly
- **[artifacts/](artifacts/)** - Build outputs and binaries

---

## Project Status

### Milestones

| Milestone | Status | Duration | Deliverable |
|-----------|--------|----------|-------------|
| **M0** | ✅ COMPLETE | 3 weeks | Architecture design + knowledge base |
| **M1** | 🔄 IN PROGRESS | 8 weeks | All 7 agents + hello_world compilation |
| **M2** | ⏳ PENDING | 8 weeks | All 6 examples compile |
| **M3** | ⏳ PENDING | 4 weeks | Self-hosting bootstrap (fixed point) |
| **M4** | ⏳ PENDING | 6 weeks | ARM64 support |
| **M5** | ⏳ PENDING | 6 weeks | Optimization (100x faster) |
| **M6** | ⏳ PENDING | 5 weeks | Production ready |

**Total Timeline**: ~40 weeks (9-10 months)

---

## Architecture Overview

```
Source Code (.mycelial)
    ↓
mycelial-compiler.mycelial (network of agents)
    ├─ Lexer Agent (tokenize)
    ├─ Parser Agent (build AST)
    ├─ Type Checker Agent (validate types)
    ├─ IR Generator Agent (lower to IR)
    ├─ x86-64 Code Gen Agent (generate machine code)
    ├─ Assembler Agent (encode instructions)
    └─ Linker Agent (create ELF executable)
    ↓
Direct x86-64/ARM64 Machine Code
    ↓
Native Binary Executable
```

The compiler itself is a **living agent network** - a demonstration of Mycelial's power for systems programming.

---

## Current Milestone: M1 - Minimal Compiler

### Status

✅ **M0 Complete** - Architecture designed, all documentation in place

**M1 Progress:**
- ✅ Lexer Agent (720 lines) - Tokenization
- ✅ Parser Agent (64 KB) - AST generation
- ✅ Type Checker Agent (1,436 lines) - Type validation
- ✅ IR Generator Agent (51 KB) - IR lowering
- ✅ x86-64 Code Gen Agent (38 KB) - Machine code generation
- ✅ Assembler Agent (70 KB) - Binary encoding
- ✅ Linker Agent (38 KB) - ELF linking
- ✅ Complete orchestration (1,649 lines) - All 7 agents wired together

**Current Work:**
- Testing compiler on `hello_world.mycelial`
- Validating generated x86-64 binaries
- Preparing for self-hosting bootstrap (M3)

### M1 Deliverables

All agents are fully implemented and integrated:
```
compiler/
├── lexer.mycelial           # Tokenization (720 lines)
├── parser.mycelial          # AST generation (64 KB)
├── type_checker.mycelial    # Type validation (1,436 lines)
├── ir_generator.mycelial    # IR lowering (51 KB)
├── x86_codegen.mycelial     # Code generation (38 KB)
├── assembler.mycelial       # Binary encoding (70 KB)
├── linker.mycelial          # ELF linking (38 KB)
└── mycelial-compiler.mycelial   # Main orchestration (1,649 lines)
```

---

## Key Architectural Decisions

✅ **Compiler Language**: Mycelial (self-hosting from day one)
✅ **Code Generation**: Direct x86-64 and ARM64 machine code (no C intermediate)
✅ **Bootstrap**: JavaScript interpreter as temporary bridge
✅ **Agent Design**: 7 specialized agents in tidal cycle execution
✅ **No Dependencies**: Zero external dependencies (no GCC, LLVM, Clang)

---

## Implementation Details

### The Compiler Network

Each agent in the compiler is a specialized Mycelian hyphal entity:

- **Lexer**: Reads source, produces tokens
- **Parser**: Consumes tokens, builds AST
- **Type Checker**: Validates types, builds symbol tables
- **IR Generator**: Lowers AST to custom IR
- **x86-64 Code Gen**: Instruction selection & register allocation
- **Assembler**: Encodes instructions to machine code
- **Linker**: Creates ELF executable with proper sections

Signals flow through the network: source → tokens → AST → typed AST → IR → assembly → machine code → executable

### The Self-Hosting Bootstrap

```
Generation 0: JavaScript interpreter compiles mycelial-compiler.mycelial
Generation 1: Gen0 binary compiles mycelial-compiler.mycelial
Generation 2: Gen1 binary compiles mycelial-compiler.mycelial
             (Gen1 and Gen2 are byte-identical = Fixed Point ✅)
```

Once fixed point is achieved, the compiler can bootstrap indefinitely without the interpreter.

---

## Test Programs

All 6 example Mycelial programs ready for testing:

| Program | Complexity | Purpose | Status |
|---------|-----------|---------|--------|
| hello_world.mycelial | ⭐ | Basic I/O | Ready |
| pipeline.mycelial | ⭐⭐ | Sequential processing | Ready |
| map_reduce.mycelial | ⭐⭐⭐ | Data parallelism | Ready |
| distributed_search.mycelial | ⭐⭐⭐ | Task distribution | Ready |
| consensus.mycelial | ⭐⭐⭐ | Distributed voting | Ready |
| clawed_code.mycelial | ⭐⭐⭐⭐ | P2P messaging | Ready |

---

## Team

- **Haiku**: Lead coordinator, implementation oversight
- **Opus**: x86-64/ARM64 code generation specialist
- **Sonnet**: Language design, agent orchestration, IR specification

---

## Success Criteria for M1

1. ✅ **All 7 Agents Implemented** - Complete compiler pipeline
2. ⏳ **hello_world Compiles** - Testing in progress
3. ⏳ **Produces Working x86-64** - Binary validation pending
4. ⏳ **Output Matches Interpreter** - Correctness verification pending

---

## Success Criteria (Overall)

1. **Self-Hosting**: mycelial-compiler.mycelial compiles itself (fixed point)
2. **Multi-Architecture**: x86-64 and ARM64 support
3. **Performance**: Compiled code 100x faster than interpreter
4. **Demonstration**: Compiler showcases agent-based architecture
5. **Production**: Professional UX, error messages, documentation
6. **Beauty**: Elegant, emergent, bio-inspired systems design

---

**Status**: M1 Implementation Active
**Timeline**: 40 weeks total (M0 complete, M1-M6 in progress)
**Next**: Complete M1 testing, then bootstrap M3

🌿🧬🚀
