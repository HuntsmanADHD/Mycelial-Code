# Self-Hosted Compiler Development Plan

## Phase 1: Foundation Library (Week 1-2)

Build the core utilities needed by all compiler components.

### lib/string-utils.mycelial
- Character classification (is_digit, is_alpha, is_whitespace)
- String operations (substring, indexOf, split, join)
- String building/accumulation
- Character escape handling

### lib/vector-utils.mycelial
- Vector operations beyond builtins
- Vector iteration helpers
- Vector transformation utilities

### lib/map-utils.mycelial
- Map operations beyond builtins
- Hash table utilities

### lib/file-io.mycelial
- File reading/writing
- Path operations
- Error handling

**Deliverable:** Tested utility libraries

---

## Phase 2: Lexer (Week 3-4)

Build the tokenizer as an agent network.

### Components:
- **CharacterReader Agent** - Reads source character by character
- **TokenBuilder Agent** - Accumulates characters into tokens
- **TokenClassifier Agent** - Determines token types
- **TokenEmitter Agent** - Outputs token stream

### lexer/lexer.mycelial
Main lexer network that produces:
```
Token {
  type: string,      // "identifier", "keyword", "number", "string", etc.
  value: string,     // The actual text
  line: u32,         // Line number
  column: u32        // Column number
}
```

**Test:** Tokenize simple Mycelial programs, compare with JS lexer output

---

## Phase 3: Parser (Week 5-8)

Build the parser as an agent network.

### Components:
- **TokenStream Agent** - Manages token consumption
- **NetworkParser Agent** - Parses top-level network structure
- **FrequencyParser Agent** - Parses frequency definitions
- **HyphalParser Agent** - Parses hyphal type definitions
- **TopologyParser Agent** - Parses topology section
- **ExpressionParser Agent** - Parses expressions
- **StatementParser Agent** - Parses statements
- **HandlerParser Agent** - Parses handler definitions

### parser/parser.mycelial
Produces AST (Abstract Syntax Tree) matching the structure the JS parser creates.

**Test:** Parse hello_world.mycelial, compare AST with JS parser output

---

## Phase 4: Symbol Table Analyzer (Week 9-10)

Build the analyzer that computes memory layouts and routing tables.

### Components:
- **FrequencyCollector Agent** - Collects all frequency definitions
- **HyphalTypeCollector Agent** - Collects all hyphal type definitions
- **AgentCollector Agent** - Collects all spawned agents
- **RoutingTableBuilder Agent** - Builds signal routing table
- **MemoryLayoutCalculator Agent** - Computes memory offsets and sizes

### analyzer/symbol-table.mycelial
Produces SymbolTable with:
- Agent definitions and memory layout
- Routing table
- Handler list
- Type information

**Test:** Analyze hello_world.mycelial, compare with JS analyzer output

---

## Phase 5: Code Generation (Week 11-16)

Build the code generators as agent networks.

### Components:

#### codegen/expression-compiler.mycelial
- **LiteralCompiler Agent** - Compiles literals (numbers, strings, booleans)
- **BinaryOpCompiler Agent** - Compiles binary operations (+, -, *, /, etc.)
- **VariableCompiler Agent** - Compiles variable access
- **FunctionCallCompiler Agent** - Compiles function calls
- **ArrayCompiler Agent** - Compiles array literals
- **MapCompiler Agent** - Compiles map literals

#### codegen/statement-compiler.mycelial
- **AssignmentCompiler Agent** - Compiles assignments
- **EmitCompiler Agent** - Compiles emit statements
- **IfCompiler Agent** - Compiles conditionals
- **ReportCompiler Agent** - Compiles report statements

#### codegen/handler-compiler.mycelial
- **HandlerSetup Agent** - Generates prologue/epilogue
- **HandlerBody Agent** - Compiles handler body
- **HandlerEmitter Agent** - Emits complete handler function

#### codegen/scheduler-compiler.mycelial
- **TidalCycleGenerator Agent** - Generates main execution loop
- **SensePhaseGenerator Agent** - Generates signal dequeuing
- **ActPhaseGenerator Agent** - Generates handler dispatch
- **OutputDrainGenerator Agent** - Generates output collection

#### codegen/mycelial-codegen.mycelial
Main orchestrator that coordinates all code generation.

**Test:** Generate assembly for hello_world.mycelial, compare with JS codegen

---

## Phase 6: Assembler (Week 17-18)

Build the x86-64 assembler as an agent network.

### Components:
- **InstructionParser Agent** - Parses assembly instructions
- **RegisterEncoder Agent** - Encodes register operands
- **ImmediateEncoder Agent** - Encodes immediate values
- **MemoryEncoder Agent** - Encodes memory operands
- **InstructionEncoder Agent** - Produces machine code bytes

### assembler/x86-assembler.mycelial
Converts assembly text to machine code bytes.

**Test:** Assemble simple assembly, compare with JS assembler output

---

## Phase 7: Linker (Week 19-20)

Build the ELF linker as an agent network.

### Components:
- **ELFHeaderBuilder Agent** - Builds ELF headers
- **SectionBuilder Agent** - Builds ELF sections (.text, .data, etc.)
- **RelocationResolver Agent** - Resolves symbol references
- **BinaryEmitter Agent** - Emits final ELF binary

### linker/elf-linker.mycelial
Creates executable ELF binaries.

**Test:** Link hello_world, run it, verify output

---

## Phase 8: Integration (Week 21-22)

Connect all phases into a single compiler program.

### mycelial-compiler.mycelial
Main compiler that:
1. Reads source file
2. Lexes to tokens
3. Parses to AST
4. Analyzes to symbol table
5. Generates assembly
6. Assembles to machine code
7. Links to ELF binary
8. Writes output file

**Test:** Compile all test programs, verify they work

---

## Phase 9: Bootstrap (Week 23-24)

Compile the compiler with itself.

### Steps:
1. Use JS compiler to compile mycelial-compiler.mycelial → stage1
2. Use stage1 to compile mycelial-compiler.mycelial → stage2
3. Use stage2 to compile mycelial-compiler.mycelial → stage3
4. Verify stage2 == stage3 (byte-for-byte identical)
5. Run full test suite with self-hosted compiler
6. Celebrate! 🎉

**Deliverable:** Self-hosted, bootstrapped Mycelial compiler

---

## Testing Strategy

For each phase:
1. **Unit tests** - Test individual agents
2. **Integration tests** - Test the phase as a whole
3. **Comparison tests** - Compare output with JS compiler
4. **Regression tests** - Ensure previous phases still work

---

## Milestones

- **M1 (Week 4):** Lexer complete and tested
- **M2 (Week 8):** Parser complete and tested
- **M3 (Week 10):** Analyzer complete and tested
- **M4 (Week 16):** Code generation complete and tested
- **M5 (Week 18):** Assembler complete and tested
- **M6 (Week 20):** Linker complete and tested
- **M7 (Week 22):** Integrated compiler working
- **M8 (Week 24):** Bootstrap complete - SELF-HOSTING ACHIEVED!

---

## Success Criteria

✅ Self-hosted compiler can compile itself
✅ Stage 2 and Stage 3 binaries are identical
✅ All test programs compile and run correctly
✅ Performance is acceptable (within 10x of JS compiler)
✅ Code is readable and maintainable
✅ Documentation is complete

---

**Timeline:** 24 weeks (6 months)
**Start Date:** 2026-01-12
**Target Completion:** 2026-07-12
