# Mycelial Compiler Project - Complete Index

**Project Root**: `/home/lewey/Desktop/mycelial-compiler/`

---

## 📋 Start Here

1. **[README.md](README.md)** - Project overview and quick navigation
2. **[plan.md](plan.md)** - Complete 40-week implementation plan
3. **[COMPILER_TEAM_MANIFEST.json](COMPILER_TEAM_MANIFEST.json)** - Team structure and coordination

---

## 🏗️ Project Organization

### Core Documentation

**Architecture Designs** (`docs/architecture/`)
- [x86-64 Code Generation](docs/architecture/x86-64-codegen.md) - **Opus**: Instruction selection, register allocation, calling conventions
- [ARM64 Code Generation](docs/architecture/arm64-codegen.md) - **Opus**: ARM64-specific strategies
- [IR Specification](docs/architecture/ir-specification.md) - **Sonnet**: Intermediate representation design
- [Compiler as Agents](docs/architecture/compiler-as-agents.md) - **Haiku**: Agent network architecture

**Knowledge Base** (`docs/knowledge-base/`)
- [x86-64 Instructions](docs/knowledge-base/x86-64-instructions.md) - Complete instruction reference
- [System V AMD64 ABI](docs/knowledge-base/system-v-abi.md) - Linux/Unix calling conventions
- [Microsoft x64 ABI](docs/knowledge-base/microsoft-x64-abi.md) - Windows calling conventions
- [ELF64 Format](docs/knowledge-base/elf-format.md) - Executable file format
- [ARM64 AAPCS64](docs/knowledge-base/arm64-aapcs.md) - ARM64 calling conventions

**Milestones** (`docs/milestones/`)
- [M0 Design Completion](docs/milestones/m0-design.md) - Tracking M0 deliverables

### Implementation

**Compiler Source** (`compiler/`)
- `mycelial-compiler.mycelial` - The compiler itself (to be written in M1+)

**Runtime Library** (`runtime/`)
- `signal-runtime.c` - Signal handling and routing
- `memory.c` - Memory management
- `scheduler.c` - Tidal cycle scheduler
- *(to be implemented in M1+)*

### Testing & Examples

**Test Programs** (`tests/`)
- `hello_world.mycelial` - Basic test (M1)
- `pipeline.mycelial` - Sequential stages (M2)
- `map_reduce.mycelial` - Data parallelism (M2)
- `distributed_search.mycelial` - Task distribution (M2)
- `consensus.mycelial` - Distributed voting (M2)
- `clawed_code.mycelial` - P2P messaging (M2)

**Hand-Coded Examples** (`examples/hand-coded/`)
- `hello-x86-64.asm` - x86-64 assembly (M0)
- `hello-arm64.asm` - ARM64 assembly (M0)

### Build Artifacts

**Artifacts** (`artifacts/`)
- `gen0/` - Interpreter-compiled compiler (M3)
- `gen1/` - Gen0-compiled compiler (M3)
- `gen2/` - Gen1-compiled compiler, fixed point (M3)
- `benchmarks/` - Performance data (M5)

---

## 🎯 Current Status: M0 - Foundation & Design

### What M0 Includes

**Design Documents** (Being written now)
- [ ] x86-64 code generation strategy (Opus)
- [ ] ARM64 code generation strategy (Opus)
- [ ] IR specification (Sonnet)
- [ ] Compiler-as-agents architecture (Haiku)

**Knowledge Base** (Being written now)
- [ ] x86-64 instruction reference (Opus)
- [ ] System V AMD64 ABI (Opus)
- [ ] Microsoft x64 ABI (Opus)
- [ ] ELF64 format reference (Opus/Haiku)
- [ ] ARM64 AAPCS64 (Opus)

**Validation** (To be created)
- [ ] Hand-coded x86-64 "Hello World" (Haiku)
- [ ] Hand-coded ARM64 "Hello World" (Haiku)

### M0 Checklist

See [docs/milestones/m0-design.md](docs/milestones/m0-design.md) for detailed progress tracking.

---

## 📖 How to Navigate

### For Opus (Code Generation Design)
1. Read: [README.md](README.md) - Overall context
2. Review: [plan.md](plan.md) - Milestones and timeline
3. Write:
   - `docs/architecture/x86-64-codegen.md`
   - `docs/architecture/arm64-codegen.md`
   - `docs/knowledge-base/x86-64-instructions.md`
   - `docs/knowledge-base/system-v-abi.md`
   - `docs/knowledge-base/microsoft-x64-abi.md`
   - `docs/knowledge-base/elf-format.md`
   - `docs/knowledge-base/arm64-aapcs.md`

### For Sonnet (IR Design)
1. Read: [README.md](README.md) - Overall context
2. Review: [plan.md](plan.md) - Milestones and timeline
3. Read: `docs/architecture/x86-64-codegen.md` (Opus's output)
4. Write:
   - `docs/architecture/ir-specification.md`
   - `docs/architecture/compiler-as-agents.md`

### For Haiku (Coordination & Implementation)
1. Read: [README.md](README.md) - Project overview
2. Review: [plan.md](plan.md) - Full 40-week plan
3. Coordinate:
   - Sync Opus's and Sonnet's work
   - Ensure documents are complete
   - Validate architecture alignment
4. Implement:
   - Hand-coded assembly examples
   - M0 completion summary
   - Prepare M1 strategy

---

## 🔗 Reference Files (Outside This Project)

**Language Specification**
- `/home/lewey/Desktop/MyLanguage/01-SPECIFICATION/GRAMMAR.md` - Formal grammar
- `/home/lewey/Desktop/MyLanguage/00-VISION/EXECUTION_MODEL.md` - Tidal cycle semantics
- `/home/lewey/Desktop/MyLanguage/00-VISION/CORE_PRIMITIVES.md` - Core concepts

**Reference Implementation**
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/parser/lexer.js` - Lexer
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/parser/parser.js` - Parser
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/src/runtime/scheduler.js` - Runtime

---

## 📅 Timeline

| Milestone | Duration | End Date | Status |
|-----------|----------|----------|--------|
| M0 Design | 3 weeks | Week 3 | 🔄 IN PROGRESS |
| M1 Minimal Compiler | 8 weeks | Week 11 | ⏳ PENDING |
| M2 Full Language | 8 weeks | Week 19 | ⏳ PENDING |
| M3 Self-Hosting | 4 weeks | Week 23 | ⏳ PENDING |
| M4 ARM64 | 6 weeks | Week 29 | ⏳ PENDING |
| M5 Optimization | 6 weeks | Week 35 | ⏳ PENDING |
| M6 Production | 5 weeks | Week 40 | ⏳ PENDING |

---

## 🚀 Next Steps

### This Week (Weeks 1-3 of M0)
1. Opus begins x86-64 design work
2. Sonnet begins IR design work
3. Haiku coordinates and creates hand-coded examples
4. All three stay aligned via team manifest

### Week 2-3 Completion
- All design documents complete
- Hand-coded assembly examples validated
- Review and alignment
- Prepare for M1

### After M0 (Week 4+)
- Start M1: Write mycelial-compiler.mycelial
- Implement lexer, parser, type checker, IR generator, code gen agents
- Test on hello_world.mycelial

---

## 📞 Coordination

**Team Manifest**: [COMPILER_TEAM_MANIFEST.json](COMPILER_TEAM_MANIFEST.json)

**Communication**:
- Opus updates: Architecture designs, knowledge base
- Sonnet updates: IR spec, language refinements
- Haiku updates: Implementation progress, integration

---

## ✨ Project Philosophy

> "I want to create something unbelievably beautiful. I don't care about time or potential constraints."

This compiler proves that a bio-inspired, agent-based language can handle real systems programming. No compromises. Direct to machine code. Pure self-hosting.

The compiler itself is a demonstration of Mycelial's power - a living agent network transforming source code into executables.

---

## 📊 Project Statistics

**Directory Structure**: ✅ Complete
- Architecture documents: 4 placeholders
- Knowledge base: 5 placeholders
- Test programs: 6 copied
- Artifact storage: Ready
- Runtime stubs: Ready

**Total Size**: ~100 KB (minimal, no fluff)

---

**Status**: 🌿🧬 Ready to build something beautiful. 🚀
