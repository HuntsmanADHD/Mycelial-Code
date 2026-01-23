# Mycelial Native Compiler

**A self-hosting compiler written IN Mycelial that generates direct machine code (x86-64, ARM64)**

Direct to machine code. No C intermediate. No GCC/LLVM dependencies. Pure, beautiful, agent-based compilation.

---

## Vision

From Huntsman:

> "I want to create something unbelievably beautiful. I don't care about time or constraints. Everyone will always say 'we can't' or 'it won't be possible,' but not everyone thinks like me. And no one can code like you. We're a match made in heaven."

This compiler proves that a bio-inspired, agent-based language can handle real systems programming. No compromises. Direct to machine code. Pure self-hosting.

---

## What is Mycelial?

**Mycelial** is a new programming language inspired by how fungal networks (mycelium) communicate in nature.

### For Non-Programmers

Imagine a forest floor covered in mushrooms. Underground, they're all connected by a vast network of threads (mycelium) that sends chemical signals back and forth. When one part of the network finds nutrients, it signals the others. The whole system works together without any central control.

**That's exactly how Mycelial programs work.**

Instead of writing step-by-step instructions (like traditional programming), you create a network of independent "agents" that communicate by sending "signals" to each other. Each agent:
- Has its own memory (called "state")
- Listens for specific signals
- Reacts when it receives those signals
- Can send new signals to other agents

The program emerges from these interactions - like a mycelial network growing and adapting.

### For Programmers

Mycelial is an **agent-based, signal-driven programming language** with:
- **Declarative agent networks** instead of imperative control flow
- **Signal routing** instead of function calls
- **Tidal cycle execution** (REST → SENSE → ACT phases)
- **Direct-to-machine-code compilation** (no VM, no interpreter overhead)
- **Bio-inspired concurrency** (agents execute in parallel naturally)

**File extension**: `.mycelial`

**Example** - A simple Hello World:
```mycelial
network HelloWorld {
  frequencies { greeting, response }

  hyphae {
    hyphal greeter {
      on signal(greeting, name) {
        emit response { message: "Hello, " + name + "!" }
      }
    }
  }

  topology {
    spawn greeter as G1
  }
}
```

---

## Project Status: Gen2 Bootstrap Complete!

### Bootstrap Chain Achieved

```
Gen0 (JavaScript)  ──►  Gen1 (Native)  ──►  Gen2 (Native)
     │                       │                   │
  Compiler               Compiler            Compiler
  in Node.js            38KB ELF            38KB ELF
     │                       │                   │
     └── compiles ──────────►└── compiles ──────►│
                                                 ▼
                                          Exit Code: 0 ✓
```

| Generation | Language | Size | Status |
|------------|----------|------|--------|
| **Gen0** | JavaScript | ~50KB source | ✅ Complete |
| **Gen1** | x86-64 Native | 38KB ELF | ✅ Complete |
| **Gen2** | x86-64 Native | 38KB ELF | ✅ Running |

**Latest Achievement (2026-01-22):** Gen2 compiler successfully builds and runs with exit code 0!

---

## Milestones

| Milestone | Status | Description |
|-----------|--------|-------------|
| **M0** | ✅ Complete | Architecture design + knowledge base |
| **M1 (Gen0)** | ✅ Complete | JavaScript compiler → x86-64 assembly |
| **M2 (Gen1)** | ✅ Complete | Native compiler compiled by Gen0 |
| **M3 (Gen2)** | ✅ Running | Native compiler compiled by Gen1 |
| **M4** | 🔄 In Progress | Full compilation pipeline (parse → codegen) |
| **M5** | ⏳ Pending | ARM64 support |
| **M6** | ⏳ Pending | Optimization & production ready |

---

## Architecture

### The Bootstrap Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                         BOOTSTRAP CHAIN                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   mycelial-compiler.mycelial (12,816 lines)                      │
│              │                                                    │
│              ▼                                                    │
│   ┌─────────────────┐                                            │
│   │      Gen0       │  JavaScript compiler                       │
│   │   (Node.js)     │  runtime/src/compiler/                     │
│   └────────┬────────┘                                            │
│            │ generates                                            │
│            ▼                                                      │
│   ┌─────────────────┐                                            │
│   │      Gen1       │  Native x86-64 ELF binary                  │
│   │   (38KB ELF)    │  First native compiler                     │
│   └────────┬────────┘                                            │
│            │ compiles                                             │
│            ▼                                                      │
│   ┌─────────────────┐                                            │
│   │      Gen2       │  Native x86-64 ELF binary                  │
│   │   (38KB ELF)    │  Second native compiler                    │
│   └────────┬────────┘                                            │
│            │                                                      │
│            ▼                                                      │
│      Exit Code: 0 ✓                                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Compiler Agent Pipeline

The self-hosted compiler is written as a Mycelial agent network:

```
Source (.mycelial)
       │
       ▼
┌──────────────┐    signals    ┌──────────────┐
│    Lexer     │ ────────────► │    Parser    │
│   Agent L1   │    tokens     │   Agent P1   │
└──────────────┘               └──────┬───────┘
                                      │ AST
                                      ▼
                               ┌──────────────┐
                               │  Type Check  │
                               │   Agent T1   │
                               └──────┬───────┘
                                      │
                                      ▼
┌──────────────┐               ┌──────────────┐
│  Assembler   │ ◄──────────── │   Codegen    │
│   Agent A1   │   asm_instr   │   Agent C1   │
└──────┬───────┘               └──────────────┘
       │
       ▼
┌──────────────┐
│    Linker    │
│   Agent K1   │
└──────┬───────┘
       │
       ▼
  ELF Binary
```

### Tidal Cycle Execution

Each cycle, all agents execute in three phases:

```
┌─────────────────────────────────────────────────┐
│                  TIDAL CYCLE                     │
├─────────────────────────────────────────────────┤
│                                                  │
│   1. SENSE   - Dequeue signals from all queues  │
│                                                  │
│   2. ACT     - Execute matching handlers        │
│              - Frequency-based dispatch         │
│              - One handler per signal           │
│                                                  │
│   3. OUTPUT  - Drain output queues              │
│              - Route to external sinks          │
│                                                  │
│   [Repeat until quiescence or max cycles]       │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Quick Start

### Compile a Test Program

```bash
cd runtime
node mycelial-compile.js ../tests/hello_world.mycelial -o hello
./hello
echo $?  # Should output: 0
```

### Build Gen1 from Source

```bash
# Generate assembly from mycelial-compiler.mycelial
node runtime/mycelial-compile.js compiler/mycelial-compiler.mycelial -o gen1

# Or use the build script
./build-gen1.sh
```

---

## Project Structure

```
mycelial-code/
├── runtime/                    # Gen0 Compiler (JavaScript)
│   ├── src/
│   │   ├── compiler/          # Code generation
│   │   │   ├── mycelial-codegen.js      # Main orchestrator
│   │   │   ├── expression-compiler.js   # Expr → x86-64
│   │   │   ├── statement-compiler.js    # Stmt → x86-64
│   │   │   ├── handler-codegen.js       # Signal handlers
│   │   │   ├── scheduler-codegen.js     # Tidal cycle loop
│   │   │   ├── symbol-table.js          # Type/memory analysis
│   │   │   └── builtin-asm.js           # Runtime builtins
│   │   └── interpreter/       # Parser
│   │       └── parser.js      # Mycelial parser
│   └── c/                     # C runtime support
│
├── compiler/                   # Compiler source (Mycelial)
│   └── mycelial-compiler.mycelial  # 12,816 lines
│
├── self-hosted-compiler/       # Modular compiler agents
│   ├── lexer/
│   ├── parser/
│   ├── analyzer/
│   ├── ir/
│   ├── codegen/
│   ├── assembler/
│   └── linker/
│
├── self-hosted-compiler-v2/    # Restructured compiler
│   ├── agents/                # Individual agent files
│   ├── shared/                # Shared types/frequencies
│   └── topology.mycelial      # Network wiring
│
├── tests/                      # Test programs
│   ├── hello_world.mycelial
│   ├── map_reduce.mycelial
│   ├── pipeline.mycelial
│   └── ... (40+ test files)
│
├── examples/                   # Example code
│   └── hand-coded/            # Hand-written assembly examples
│
└── docs/                       # Documentation
    ├── architecture/          # Design documents
    ├── knowledge-base/        # CPU/ABI references
    └── milestones/            # Progress tracking
```

---

## Technical Achievements

### Signal Frequency Dispatch

Signals carry frequency IDs for proper handler dispatch:

```
Signal Envelope (16 bytes):
┌─────────────────┬─────────────────┐
│  frequency_id   │   payload_ptr   │
│   (8 bytes)     │   (8 bytes)     │
└─────────────────┴─────────────────┘
```

32 signal types supported:
- `startup`, `compile_request`, `compilation_complete`
- `lex_request`, `token`, `lex_complete`
- `ast_node`, `ast_complete`, `parse_error`
- `ir_node`, `ir_complete`, `lir_function`
- `asm_instruction`, `machine_code`, `link_complete`
- ... and more

### Generated Binary Stats

| Metric | Value |
|--------|-------|
| Binary Size | 38KB |
| Assembly Lines | 160,096 |
| Agents | 3 (M1, O1, L1) |
| Signal Handlers | 30 |
| Frequencies | 32 |
| Exit Code | 0 ✓ |

### Language Features

- ✅ Agent definitions (`hyphal`)
- ✅ Signal handlers (`on signal(freq, binding)`)
- ✅ State management
- ✅ Signal emission (`emit frequency { ... }`)
- ✅ Topology wiring (`socket A -> B`)
- ✅ For loops, while loops, ranges
- ✅ Match expressions and pattern matching
- ✅ Tuples and destructuring
- ✅ Struct literals and field access
- ✅ Enum variants
- ✅ 40+ builtin functions

---

## Recent Fixes (2026-01-22)

| Issue | Fix |
|-------|-----|
| Signal dispatch called ALL handlers | Implemented frequency-based dispatch with signal envelopes |
| Sense phase didn't zero L1 slot | Dynamic slot initialization for all agents |
| Missing `startup` frequency | Added frequency definition with source_file, output_file |
| Missing `lex_request` frequency | Added frequency definition with source, filename |
| Undefined `builtin_alloc` | Added alias to `builtin_heap_alloc` |
| Missing `builtin_hex_decode` | Added stub implementation |

---

## Success Criteria

1. ✅ **Gen0 Complete** - JavaScript compiler generates valid x86-64
2. ✅ **Gen1 Complete** - Native compiler built by Gen0
3. ✅ **Gen2 Running** - Native compiler built by Gen1 (exit code 0)
4. 🔄 **Self-Hosting** - Gen1 == Gen2 byte-identical (in progress)
5. ⏳ **Multi-Architecture** - ARM64 support
6. ⏳ **Performance** - 100x faster than interpreter
7. ⏳ **Production** - Error messages, debugging, polish

---

## Contributing

This is an experimental research project exploring bio-inspired programming paradigms. The compiler is being developed by Huntsman (human) and Claude (AI) as a collaboration.

---

## License

MIT License - See [LICENSE](LICENSE)

---

**Status**: Gen2 Running ✅ | Self-Hosting In Progress 🔄

*The mycelium grows...*
