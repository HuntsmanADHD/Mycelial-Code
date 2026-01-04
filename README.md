# 🌿🧬 Mycelial Native Compiler

**A self-hosting compiler written IN Mycelial that generates direct machine code (x86-64, ARM64)**

Direct to machine code. No C intermediate. No GCC/LLVM dependencies. Pure, beautiful, agent-based compilation.

---

## Quick Navigation

### 📋 Operations & Coordination
- **[PROGRESS_TRACKER.md](PROGRESS_TRACKER.md)** - Numerical checkpoint system (WHERE WE LEFT OFF)
- **[OPERATIONS.md](OPERATIONS.md)** - COO management, quality gates, review criteria
- **[COMPILER_TEAM_MANIFEST.json](COMPILER_TEAM_MANIFEST.json)** - Team structure (Haiku, Opus, Sonnet)

### 📖 Planning & Architecture
- **[plan.md](plan.md)** - Complete implementation plan (40 weeks, 6 milestones)
- **[docs/architecture/](docs/architecture/)** - Design documents (all 4 architecture specs)
- **[docs/knowledge-base/](docs/knowledge-base/)** - CPU reference material (5 KB docs)
- **[INDEX.md](INDEX.md)** - Master index for all documentation

### 💻 Implementation & Testing
- **[compiler/](compiler/)** - The compiler itself (mycelial-compiler.mycelial)
- **[tests/](tests/)** - Test programs (6 examples: hello_world, pipeline, map_reduce, etc.)
- **[examples/hand-coded/](examples/hand-coded/)** - Hand-written assembly for validation (tested & working)
- **[runtime/](runtime/)** - Signal runtime library (C stubs for M1)
- **[artifacts/](artifacts/)** - Build artifacts (Gen0, Gen1, Gen2, benchmarks)

---

## Project Status

### Milestones

| Milestone | Status | Duration | Deliverable |
|-----------|--------|----------|-------------|
| **M0** | 🔄 IN PROGRESS | 3 weeks | Architecture design + knowledge base |
| **M1** | ⏳ PENDING | 8 weeks | hello_world compiles to x86-64 |
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
    ├─ Type Checker Agent (validate)
    ├─ IR Generator Agent (lower to IR)
    ├─ x86-64 Code Gen Agent (generate machine code)
    └─ Assembler/Linker Agent (create ELF executable)
    ↓
Direct x86-64/ARM64 Machine Code
    ↓
Native Binary Executable
```

The compiler itself is a **living agent network** - a demonstration of Mycelial's power.

---

## Current Milestone: M0 - Foundation & Design

### M0 Tasks

**Opus** (x86-64 Code Generation):
- [ ] Design x86-64 codegen strategy → `docs/architecture/x86-64-codegen.md`
- [ ] Design ARM64 codegen strategy → `docs/architecture/arm64-codegen.md`
- [ ] Create CPU instruction reference → `docs/knowledge-base/x86-64-instructions.md`
- [ ] Create calling convention docs → `docs/knowledge-base/system-v-abi.md`

**Sonnet** (IR Design):
- [ ] Design IR specification → `docs/architecture/ir-specification.md`
- [ ] Design compiler architecture → `docs/architecture/compiler-as-agents.md`
- [ ] Formalize type system for IR

**Haiku** (Coordination):
- [ ] Set up project structure ✅ DONE
- [ ] Create knowledge base framework
- [ ] Build hand-coded x86-64 "Hello World" → `examples/hand-coded/hello-x86-64.asm`
- [ ] Prepare M1 implementation strategy

### M0 Deliverables

All design documents should be in `docs/architecture/` and `docs/knowledge-base/`:
```
docs/
├── architecture/
│   ├── x86-64-codegen.md           # Opus: instruction selection, register allocation, calling conventions
│   ├── arm64-codegen.md            # Opus: ARM64 code generation strategy
│   ├── ir-specification.md         # Sonnet: IR node types, lowering, optimization
│   └── compiler-as-agents.md       # Architecture: how compiler agents interact
├── knowledge-base/
│   ├── x86-64-instructions.md      # CPU instruction reference
│   ├── system-v-abi.md             # System V AMD64 ABI (calling conventions, registers)
│   ├── microsoft-x64-abi.md        # Microsoft x64 calling convention
│   ├── elf-format.md               # ELF executable format
│   └── arm64-aapcs.md              # ARM64 AAPCS calling convention
└── milestones/
    └── m0-design.md                # Summary of M0 completion
```

---

## Test Programs

All 6 example Mycelial programs are in `tests/`:

| Program | Complexity | Purpose |
|---------|-----------|---------|
| hello_world.mycelial | ⭐ | Basic signal routing |
| pipeline.mycelial | ⭐⭐ | Sequential stages |
| map_reduce.mycelial | ⭐⭐⭐ | Data parallelism |
| distributed_search.mycelial | ⭐⭐⭐ | Task distribution |
| consensus.mycelial | ⭐⭐⭐ | Distributed voting |
| clawed_code.mycelial | ⭐⭐⭐⭐ | P2P messaging |

---

## Key Decisions

✅ **Compiler Language**: Mycelial (self-hosting)
✅ **Code Generation**: Direct x86-64 and ARM64 machine code
✅ **Bootstrap**: Use JavaScript interpreter as temporary bridge
✅ **Runtime**: Minimal C runtime (scheduler, signal routing, memory)
✅ **No Dependencies**: No GCC, LLVM, or C compiler required for final executable

---

## Team

See [COMPILER_TEAM_MANIFEST.json](COMPILER_TEAM_MANIFEST.json) for complete team details.

- **Haiku** (Claude 4.5): Lead architect, implementation coordinator
- **Opus** (Claude 4.5): Systems architect, x86-64/ARM64 expertise
- **Sonnet** (Claude 4): Language design, IR specification

---

## How to Contribute

### For Opus (Code Generation Design)
1. Design x86-64 strategy in `docs/architecture/x86-64-codegen.md`
2. Cover: instruction set, register allocation, calling conventions, stack layout, ELF format
3. Review with Haiku before finalizing

### For Sonnet (IR Design)
1. Design IR spec in `docs/architecture/ir-specification.md`
2. Cover: IR node types, lowering strategy, optimization, type system
3. Ensure it's expressible in Mycelial itself

### For Haiku (Implementation & Coordination)
1. Build hand-coded validation examples
2. Coordinate between Opus and Sonnet
3. Prepare implementation roadmap

---

## Reference Files

**Language Specification**:
- `/home/lewey/Desktop/MyLanguage/01-SPECIFICATION/GRAMMAR.md` - Formal grammar
- `/home/lewey/Desktop/MyLanguage/00-VISION/EXECUTION_MODEL.md` - Tidal cycle semantics
- `/home/lewey/Desktop/MyLanguage/00-VISION/CORE_PRIMITIVES.md` - Core concepts

**Reference Implementation**:
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/parser/lexer.js` - Lexer to port
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/parser/parser.js` - Parser to port
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/runtime/scheduler.js` - Runtime execution model

---

## Success Criteria

1. ✅ **Self-Hosting**: mycelial-compiler.mycelial compiles itself to byte-identical output
2. ✅ **Multi-Architecture**: Works on x86-64 (Linux, macOS, Windows) and ARM64
3. ✅ **Performance**: Compiled programs 100x faster than interpreter
4. ✅ **Demonstration**: Compiler showcases agent-based computation
5. ✅ **Production**: Professional error messages, documentation, cross-platform support
6. ✅ **Beauty**: Elegant, emergent, bio-inspired design

---

## Philosophy

> "I want to create something unbelievably beautiful. I don't care about time or potential constraints. Everyone will always say 'we can't' or 'it won't be possible,' but not everyone thinks like me. And no one can code like you. We're a match made in heaven."

This compiler proves that a bio-inspired, agent-based language can handle real systems programming. No compromises. Direct to machine code. Pure self-hosting.

Let's build something the world has never seen.

---

## Quick Commands

```bash
# View the full implementation plan
cat /home/lewey/Desktop/mycelial-compiler/plan.md

# Check test programs
ls -la /home/lewey/Desktop/mycelial-compiler/tests/

# View team coordination
cat /home/lewey/Desktop/mycelial-compiler/COMPILER_TEAM_MANIFEST.json

# Check project status
ls -la /home/lewey/Desktop/mycelial-compiler/
```

---

**Status**: M0 Design Phase Active
**Timeline**: 40 weeks (9-10 months)
**Next Milestone**: M1 - Minimal Compiler

🌿🧬🚀
