# Self-Hosted Mycelial Compiler

This directory contains the self-hosted version of the Mycelial compiler - a compiler written in Mycelial that compiles Mycelial programs (including itself).

## Vision

The Mycelial compiler as an agent network where each compilation phase is a set of agents communicating via signals. This demonstrates that Mycelial is powerful enough to compile itself.

## Architecture

The compiler is structured as multiple interconnected agent networks:

```
Source File
    ↓
[Lexer Network] → Tokens
    ↓
[Parser Network] → AST
    ↓
[Analyzer Network] → Symbol Table + Memory Layout
    ↓
[CodeGen Network] → Assembly Code
    ↓
[Assembler Network] → Machine Code
    ↓
[Linker Network] → ELF Binary
```

## Directory Structure

- `lexer/` - Lexical analyzer (tokenizer)
- `parser/` - Parser (tokens → AST)
- `analyzer/` - Symbol table & memory layout analyzer
- `codegen/` - Code generators (expression, statement, handler)
- `assembler/` - x86-64 assembler
- `linker/` - ELF linker
- `lib/` - Shared utilities (string ops, data structures)
- `tests/` - Test programs for each component

## Development Approach

We build incrementally:

1. **Phase 1: Foundation** - Build shared libraries (string, vector, map operations)
2. **Phase 2: Lexer** - Tokenize source code
3. **Phase 3: Parser** - Parse tokens to AST
4. **Phase 4: Analyzer** - Build symbol table and routing tables
5. **Phase 5: Code Generation** - Generate assembly code
6. **Phase 6: Assembler** - Convert assembly to machine code
7. **Phase 7: Linker** - Create ELF binaries
8. **Phase 8: Integration** - Connect all phases into single compiler
9. **Phase 9: Bootstrap** - Compile itself

Each phase is compiled and tested with the JavaScript compiler before moving to the next.

## Bootstrap Process

Once complete:

```bash
# Stage 0: Use JavaScript compiler to compile Mycelial compiler
node runtime/mycelial-compile.js self-hosted-compiler/mycelial-compiler.mycelial
# Output: mycelial-compiler-stage1.elf

# Stage 1: Use stage1 to compile itself
./mycelial-compiler-stage1.elf self-hosted-compiler/mycelial-compiler.mycelial
# Output: mycelial-compiler-stage2.elf

# Stage 2: Verify reproducibility
./mycelial-compiler-stage2.elf self-hosted-compiler/mycelial-compiler.mycelial
# Output: mycelial-compiler-stage3.elf

# Compare stage2 and stage3 - should be identical
diff mycelial-compiler-stage2.elf mycelial-compiler-stage3.elf
```

If stage2 and stage3 are byte-for-byte identical, we've achieved self-hosting!

## Current Status

- [ ] Phase 1: Foundation library
- [ ] Phase 2: Lexer
- [ ] Phase 3: Parser
- [ ] Phase 4: Analyzer
- [ ] Phase 5: Code Generation
- [ ] Phase 6: Assembler
- [ ] Phase 7: Linker
- [ ] Phase 8: Integration
- [ ] Phase 9: Bootstrap

## Reference Implementation

The JavaScript compiler in `/runtime/src/` serves as the reference implementation. We can compare outputs and behavior against it during development.

---

**Started:** 2026-01-11
**Target Completion:** 2026
**Status:** In Development
