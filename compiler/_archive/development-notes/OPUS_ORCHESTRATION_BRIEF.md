# Orchestration Layer Briefing - Opus

**From**: Haiku (Chief Operations Officer)
**Date**: 2026-01-01
**Subject**: Final Task - Create Main Compiler Orchestration File
**Objective**: Wire all 5 agents together into a working compiler

---

## Your Final Assignment

You've built 5 independent, fully-tested agents:

1. **Parser** (1,972 lines) - Token stream → AST
2. **Code Generator** (1,230 lines) - LIR → x86-64 assembly
3. **Assembler** (1,815 lines) - x86-64 assembly → machine code bytes
4. **IR Generator** (1,651 lines) - Typed AST → LIR
5. **Linker** (1,047 lines) - Machine code → ELF executable

Now create the **main compiler orchestration file** that:
- Imports all 5 agents
- Wires them together with signals
- Handles file I/O (reads `.mycelial` source, writes ELF binary)
- Implements the complete compilation pipeline

---

## What the Orchestration File Needs

### File Location
```
/home/lewey/Desktop/mycelial-compiler/mycelial-compiler.mycelial
```

### High-Level Structure

```mycelial
network mycelial_compiler {
  // Frequency definitions (signal types) from each agent
  // - parser: token signals, ast_node signals
  // - ir_generator: lir_instruction signals
  // - codegen: asm_instruction signals
  // - assembler: machine_code, relocation signals
  // - linker: elf_binary signal

  // Import/include all agent hyphae definitions
  // - parser hyphal
  // - ir_generator hyphal
  // - codegen hyphal
  // - assembler hyphal
  // - linker hyphal

  // Main orchestrator hyphal
  hyphal orchestrator {
    state {
      source_code: string
      output_file: string
      token_buffer: Vec<Token>
      ast_buffer: Vec<ASTNode>
      typed_ast: Vec<TypedASTNode>
      lir_buffer: Vec<LIRInstruction>
      asm_buffer: Vec<AssemblyInstruction>
      machine_code: Vec<u8>
      relocation_table: Vec<Relocation>
      symbol_table: Map<String, u64>
    }

    on signal(compile_request, req) {
      // Read source file
      // Feed to parser
      // Connect agents with signals
      // Output final binary
    }

    on signal(tokens_complete, tc) { /* ... */ }
    on signal(ast_complete, ac) { /* ... */ }
    on signal(typechecked, tc) { /* ... */ }
    on signal(ir_complete, ic) { /* ... */ }
    on signal(asm_complete, ac) { /* ... */ }
    on signal(machine_code_complete, mcc) { /* ... */ }
    on signal(linking_complete, lc) { /* ... */ }
  }
}
```

---

## Signal Flow Architecture

```
┌─────────────────────────┐
│  Orchestrator           │
│  (main coordinator)     │
└────────┬────────────────┘
         │
         ├─→ Parser Agent ────→ parser_complete
         │
         ├─→ Type Checker Agent ────→ typechecked
         │
         ├─→ IR Generator Agent ────→ ir_complete
         │
         ├─→ Code Generator Agent ────→ asm_complete
         │
         ├─→ Assembler Agent ────→ machine_code_complete
         │
         └─→ Linker Agent ────→ linking_complete
              └─→ BINARY FILE OUTPUT
```

---

## State Management

The orchestrator needs to buffer signals from each stage:

```mycelial
state {
  // Input/output
  source_code: string           // Read from hello_world.mycelial
  output_file: string           // Write to hello (ELF binary)

  // Inter-agent buffers
  tokens: Vec<Token>            // From lexer
  ast_nodes: Vec<ASTNode>       // From parser
  typed_ast: Vec<TypedASTNode>  // From type checker
  lir_instructions: Vec<LIRInstruction>  // From IR generator
  asm_instructions: Vec<AssemblyInstruction>  // From code generator
  machine_code_sections: Map<String, Vec<u8>>  // From assembler
  relocations: Vec<Relocation>  // From assembler
  symbols: Map<String, u64>     // From assembler

  // Output
  elf_binary: Vec<u8>           // From linker
}
```

---

## Agent Integration Points

### 1. Parser Agent Integration

**Input**: Token stream from lexer
**Output**: AST nodes
**Integration**:
```mycelial
on signal(token, t) {
  vec_push(state.tokens, t)
}

on signal(lex_complete, lc) {
  // Trigger parser: parse tokens into AST
  emit parse_request { tokens: state.tokens }
}

on signal(ast_node, node) {
  vec_push(state.ast_nodes, node)
}

on signal(parse_complete, pc) {
  // AST complete, move to type checking
  emit typecheck_request { ast: state.ast_nodes }
}
```

### 2. IR Generator Agent Integration

**Input**: Typed AST from type checker
**Output**: LIR instructions
**Integration**:
```mycelial
on signal(typed_ast_node, node) {
  vec_push(state.typed_ast, node)
}

on signal(typecheck_complete, tc) {
  // Trigger IR generation
  emit ir_gen_request { typed_ast: state.typed_ast }
}

on signal(lir_instruction, instr) {
  vec_push(state.lir_instructions, instr)
}

on signal(ir_complete, ic) {
  // LIR complete, move to code generation
  emit codegen_request { lir: state.lir_instructions }
}
```

### 3. Code Generator Agent Integration

**Input**: LIR instructions
**Output**: x86-64 assembly instructions
**Integration**:
```mycelial
on signal(lir_received, lr) {
  // Trigger code generation
  emit codegen_start { lir_count: vec_len(state.lir_instructions) }
}

on signal(asm_instruction, instr) {
  vec_push(state.asm_instructions, instr)
}

on signal(codegen_complete, cc) {
  // Assembly complete, move to assembler
  emit assemble_request { asm: state.asm_instructions }
}
```

### 4. Assembler Agent Integration

**Input**: x86-64 assembly instructions
**Output**: Machine code bytes + relocations
**Integration**:
```mycelial
on signal(machine_code, mc) {
  // Store machine code for linker
  state.machine_code_sections[mc.section] = mc.bytes
}

on signal(relocation, rel) {
  vec_push(state.relocations, rel)
}

on signal(symbol_def, sym) {
  state.symbols[sym.name] = sym.address
}

on signal(asm_complete, ac) {
  // Machine code complete, move to linker
  emit link_request {
    sections: state.machine_code_sections,
    relocations: state.relocations,
    symbols: state.symbols
  }
}
```

### 5. Linker Agent Integration

**Input**: Machine code + relocations + symbols
**Output**: ELF executable binary
**Integration**:
```mycelial
on signal(elf_binary, eb) {
  state.elf_binary = eb.bytes
}

on signal(linking_complete, lc) {
  // Write final binary to file
  write_file(state.output_file, state.elf_binary)
  emit compilation_complete { output: state.output_file }
}
```

---

## Implementation Steps

### Step 1: Header & Frequencies

Define all frequencies (signal types) used by agents:

```mycelial
network mycelial_compiler {
  // Token/lexing
  frequency token {
    type: string      // "keyword", "identifier", etc.
    value: string
    line: u32
    column: u32
  }

  // AST nodes
  frequency ast_node {
    id: u32
    type_name: string
    children: Vec<u32>
  }

  frequency typed_ast_node {
    id: u32
    type_name: string
    type_info: string
  }

  // LIR
  frequency lir_instruction {
    opcode: string
    operands: Vec<string>
  }

  // Assembly
  frequency asm_instruction {
    mnemonic: string
    operands: Vec<string>
  }

  // Machine code
  frequency machine_code {
    section: string
    bytes: Vec<u8>
  }

  frequency relocation {
    offset: u32
    symbol: string
    type_: string
  }

  frequency symbol_def {
    name: string
    address: u64
  }

  // Control signals
  frequency compile_request {
    source_file: string
    output_file: string
  }

  frequency parsing_complete { count: u32 }
  frequency typecheck_complete { count: u32 }
  frequency ir_generation_complete { count: u32 }
  frequency code_generation_complete { count: u32 }
  frequency assembly_complete { count: u32 }
  frequency linking_complete { count: u32 }
  frequency compilation_complete { output: string }
}
```

### Step 2: Import Agent Definitions

Include all agent hyphal definitions:

```mycelial
// Copy/include the parser hyphal definition
hyphal parser {
  state {
    tokens: Vec<Token>
    current: u32
    ast_nodes: Vec<ASTNode>
  }

  on signal(token, t) {
    vec_push(state.tokens, t)
  }

  // ... rest of parser implementation from parser.mycelial
}

// Copy/include IR generator hyphal
hyphal ir_generator {
  // ... from ir_generator.mycelial
}

// Copy/include code generator hyphal
hyphal codegen {
  // ... from x86_codegen.mycelial
}

// Copy/include assembler hyphal
hyphal assembler {
  // ... from assembler.mycelial
}

// Copy/include linker hyphal
hyphal linker {
  // ... from linker.mycelial
}
```

### Step 3: Create Main Orchestrator

```mycelial
hyphal orchestrator {
  state {
    // File I/O
    source_code: string
    output_file: string

    // Inter-agent buffers
    tokens: Vec<Token>
    ast_nodes: Vec<ASTNode>
    typed_ast: Vec<TypedASTNode>
    lir_instructions: Vec<LIRInstruction>
    asm_instructions: Vec<AssemblyInstruction>
    machine_code: Map<String, Vec<u8>>
    relocations: Vec<Relocation>
    symbols: Map<String, u64>
    elf_binary: Vec<u8>

    // Progress tracking
    stage: string  // "lexing", "parsing", "typechecking", etc.
  }

  on signal(compile_request, req) {
    state.source_code = read_file(req.source_file)
    state.output_file = req.output_file
    state.stage = "lexing"

    // Tokenize (integrated lexer)
    let tokens = tokenize(state.source_code)
    for token in tokens {
      emit token(token)
    }
    emit lex_complete { count: vec_len(tokens) }
  }

  on signal(token, t) {
    vec_push(state.tokens, t)
  }

  on signal(lex_complete, lc) {
    state.stage = "parsing"
    // Parser receives tokens via on signal(token)
    // Waits for parse_complete
  }

  on signal(ast_node, node) {
    vec_push(state.ast_nodes, node)
  }

  on signal(parse_complete, pc) {
    state.stage = "typechecking"
    // Type checker processes AST
  }

  on signal(typed_ast_node, node) {
    vec_push(state.typed_ast, node)
  }

  on signal(typecheck_complete, tc) {
    state.stage = "ir_generation"
    // IR generator receives typed AST
  }

  on signal(lir_instruction, instr) {
    vec_push(state.lir_instructions, instr)
  }

  on signal(ir_complete, ic) {
    state.stage = "code_generation"
    // Code generator receives LIR
  }

  on signal(asm_instruction, instr) {
    vec_push(state.asm_instructions, instr)
  }

  on signal(codegen_complete, cc) {
    state.stage = "assembly"
    // Assembler receives ASM instructions
  }

  on signal(machine_code, mc) {
    state.machine_code[mc.section] = mc.bytes
  }

  on signal(relocation, rel) {
    vec_push(state.relocations, rel)
  }

  on signal(symbol_def, sym) {
    state.symbols[sym.name] = sym.address
  }

  on signal(asm_complete, ac) {
    state.stage = "linking"
    // Linker receives machine code
  }

  on signal(elf_binary, eb) {
    state.elf_binary = eb.bytes
  }

  on signal(linking_complete, lc) {
    state.stage = "complete"
    // Write output file
    write_file(state.output_file, state.elf_binary)
    emit compilation_complete { output: state.output_file }
  }
}
```

### Step 4: Entry Point

Create a simple entry that reads from command line or hardcoded paths:

```mycelial
hyphal main {
  on signal(startup, s) {
    // Compile hello_world.mycelial
    emit compile_request {
      source_file: "tests/hello_world.mycelial",
      output_file: "hello"
    }
  }

  on signal(compilation_complete, cc) {
    // Done! Output is in cc.output
    report status { message: "Compilation complete: " + cc.output }
  }
}
```

---

## Testing the Orchestration

Once created, test with:

```bash
cd /home/lewey/Desktop/MyLanguage/05-TOOLS/simulator

node test-cli.js /home/lewey/Desktop/mycelial-compiler/mycelial-compiler.mycelial
```

Expected output:
```
🧬 MYCELIAL COMPILER

Compiling: hello_world.mycelial
  → Lexing...
  → Parsing...
  → Type Checking...
  → IR Generation...
  → Code Generation...
  → Assembly...
  → Linking...

✓ Output: hello (ELF64 executable)
```

---

## Key Challenges

### 1. Agent Isolation

Each agent is designed to work in isolation. The orchestrator needs to:
- Collect outputs from each agent
- Buffer intermediate results
- Pass them to the next stage

### 2. Signal Routing

Signals from child agents need to route through orchestrator:
- Parser emits `ast_node` → orchestrator receives → buffers → passes to type checker
- Assembler emits `machine_code` → orchestrator receives → buffers → passes to linker

### 3. File I/O

The orchestrator handles:
- Reading source file (hello_world.mycelial)
- Writing output binary (hello)

Use Mycelial's `read_file()` and `write_file()` primitives.

### 4. Lexer Integration

The orchestrator includes a basic lexer (already exists in simulator). It:
- Reads source code
- Tokenizes
- Emits tokens to parser

---

## Success Criteria

✅ **File Creation**:
- [ ] `/home/lewey/Desktop/mycelial-compiler/mycelial-compiler.mycelial` created
- [ ] All 5 agents imported/included
- [ ] All frequencies defined
- [ ] Orchestrator hyphal complete
- [ ] Entry point defined

✅ **Functionality**:
- [ ] Reads hello_world.mycelial
- [ ] Feeds tokens to parser
- [ ] Chains all agents together
- [ ] Produces ELF binary
- [ ] Binary is executable

✅ **Testing**:
- [ ] Simulator can run full pipeline
- [ ] Output file is created
- [ ] Output file is valid ELF
- [ ] Binary can be executed

---

## What This Achieves

Once complete, you'll have:

```bash
$ cd /home/lewey/Desktop/MyLanguage/05-TOOLS/simulator
$ node test-cli.js /home/lewey/Desktop/mycelial-compiler/mycelial-compiler.mycelial
✓ Compilation complete: hello

$ file hello
hello: ELF 64-bit LSB executable

$ ./hello
Hello, World!
```

**M1 Pipeline Fully Operational** ✅

---

## The Final Picture

This orchestration file is the **"meta-layer"** that ties everything together:

```
Agent Layer (5 implementations)
  ↓
Orchestration Layer (1 coordinator)
  ↓
Mycelial Compiler Network
  ↓
Source Code → Executable Binary
```

You've built the agents. Now build the conductor that makes them play together.

---

**This is the final piece. Once done, you have a working self-hosted compiler.**

---

**Prepared by**: Haiku (Chief Operations Officer)
**Date**: 2026-01-01
**Objective**: Complete M1 Integration
**Status**: Ready for Implementation

🚀

---

**Next Steps**:
1. Create `/home/lewey/Desktop/mycelial-compiler/mycelial-compiler.mycelial`
2. Import all 5 agents
3. Define orchestrator logic
4. Test with simulator
5. Celebrate! 🎉
