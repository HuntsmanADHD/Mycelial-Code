# Compiler as Agent Network Architecture

**Owner**: Haiku
**Status**: 🔄 IN PROGRESS
**Purpose**: Agent-based compiler architecture demonstrating Mycelial's power

---

## Vision: The Compiler is an Organism

The Mycelial compiler isn't a traditional sequential pipeline. It's a **living network of hyphal agents** that collaborate to transform source code into machine code. Each agent:
- Has local state (context-specific data)
- Receives signals (tokens, AST nodes, IR instructions)
- Processes locally (transformation logic)
- Emits signals (results flowing to next agents)
- Runs in tidal cycles (SENSE → ACT → REST)

This architecture directly demonstrates Mycelial's ability to handle real systems programming through agent-based collaboration rather than centralized control.

---

## Compiler Agent Network Overview

```
SOURCE CODE
     ↓
┌────────────────────────────────────────────────────────────┐
│              MYCELIAL AGENT NETWORK                        │
│                                                            │
│  [Lexer Agent]                                            │
│      ↓ emits: token(Token)                               │
│      ↓ emits: lex_complete()                             │
│                                                            │
│  [Parser Agent] ← receives: token(Token)                 │
│      ↓ emits: ast_node(ASTNode)                          │
│      ↓ emits: parse_complete()                           │
│                                                            │
│  [Type Checker Agent] ← receives: ast_node(ASTNode)      │
│      ↓ emits: typed_ast_node(TypedASTNode)               │
│      ↓ emits: typecheck_complete() | compile_error()    │
│                                                            │
│  [IR Generator Agent] ← receives: typed_ast_node()       │
│      ↓ emits: ir_node(IRInstruction)                    │
│      ↓ emits: ir_complete()                              │
│                                                            │
│  [x86-64 Code Gen Agent] ← receives: ir_node()           │
│      ↓ emits: asm_instruction(AsmInstr)                 │
│      ↓ emits: codegen_complete()                         │
│                                                            │
│  [Assembler Agent] ← receives: asm_instruction()         │
│      ↓ emits: machine_code_byte(byte)                   │
│      ↓ emits: assemble_complete()                        │
│                                                            │
│  [Linker Agent] ← receives: machine_code_byte()          │
│      ↓ writes: ELF executable file                       │
│      ↓ emits: link_complete(filename)                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
     ↓
EXECUTABLE BINARY
```

---

## Tidal Cycle Execution Model

The compiler executes according to Mycelial's tidal cycle: **SENSE → ACT → REST**

Each agent in the network follows this pattern per cycle:

### SENSE Phase
- Agent checks its signal queue
- Reads all buffered signals from previous agents
- Populates its local state (tokens, AST nodes, IR, etc.)

### ACT Phase
- Agent processes accumulated data
- Transforms input to output (tokens→AST, AST→IR, IR→machine code)
- Emits result signals to downstream agents

### REST Phase
- Agent enters dormancy
- Signals propagate through network
- System synchronizes

### Example: Single Tidal Cycle

```
Cycle N:
  Lexer SENSE:     Read source code from input buffer
  Lexer ACT:       Tokenize, emit token() signals
  Lexer REST:      Dormant
  ───────────────────────────────────────
  Parser SENSE:    Receive token() signals (buffered from Lexer cycle N)
  Parser ACT:      Build AST, emit ast_node() signals
  Parser REST:     Dormant
  ───────────────────────────────────────
  TypeChecker SENSE: Receive ast_node() signals (buffered from Parser)
  TypeChecker ACT:   Check types, emit typed_ast_node() signals
  TypeChecker REST:  Dormant
  ───────────────────────────────────────
  ... (IR Generator, Code Gen, Assembler, Linker similarly)
```

**Critical insight**: Each agent processes in parallel, with signals buffered between cycles. The network is inherently **pipelined** - Lexer emits tokens while Parser consumes them in the next cycle.

---

## Agent Definitions (Mycelial Code)

### 1. Lexer Agent

```mycelial
hyphal lexer {
    frequency tidal_cycle

    state {
        source: string
        position: u32
        tokens: vec<Token>
    }

    on signal(compile_start, job) {
        # SENSE phase: received compilation job
        state.source = job.source_code
        state.position = 0
        vec_clear(state.tokens)
    }

    rule lex_pass {
        # ACT phase: tokenize source
        while state.position < string_len(state.source) {
            let tok = next_token()
            vec_push(state.tokens, tok)
            emit token(tok)
        }
        emit lex_complete {
            token_count: vec_len(state.tokens)
        }
    }
}
```

**Inputs**: `signal(compile_start, job)` - source code to compile
**Outputs**: `signal(token, Token)` - individual tokens; `signal(lex_complete, metadata)`
**State**: Source code, current position, accumulated tokens

---

### 2. Parser Agent

```mycelial
hyphal parser {
    frequency tidal_cycle

    state {
        tokens: vec<Token>
        current: u32
        ast_root: ASTNode
    }

    on signal(token, t) {
        # SENSE phase: received token from lexer
        vec_push(state.tokens, t)
    }

    on signal(lex_complete, lc) where vec_len(state.tokens) > 0 {
        # ACT phase: parse all tokens into AST
        state.current = 0
        state.ast_root = parse_network()

        # Emit AST nodes in post-order (children first)
        emit_ast_recursive(state.ast_root)

        emit parse_complete {
            root_id: state.ast_root.id
        }
    }
}
```

**Inputs**: `signal(token, Token)` - tokens from lexer; `signal(lex_complete, metadata)`
**Outputs**: `signal(ast_node, ASTNode)` - AST nodes; `signal(parse_complete, metadata)`
**State**: Token buffer, AST tree, current position

---

### 3. Type Checker Agent

```mycelial
hyphal type_checker {
    frequency tidal_cycle

    state {
        ast_nodes: vec<ASTNode>
        symbol_table: map<string, Type>
        errors: vec<string>
    }

    on signal(ast_node, node) {
        # SENSE phase: received AST node from parser
        vec_push(state.ast_nodes, node)
    }

    on signal(parse_complete, pc) where vec_len(state.ast_nodes) > 0 {
        # ACT phase: type check all nodes
        for node in state.ast_nodes {
            if !check_types(node) {
                vec_push(state.errors, format_error(node))
            }
        }

        if vec_len(state.errors) == 0 {
            emit typecheck_complete {
                success: true,
                symbols: state.symbol_table.count()
            }

            # Emit typed AST nodes for IR generation
            for node in state.ast_nodes {
                emit typed_ast_node {
                    id: node.id,
                    type_info: get_type(node),
                    data: node.data
                }
            }
        } else {
            emit compile_error {
                phase: "type_checker",
                message: vec_get(state.errors, 0)
            }
        }
    }
}
```

**Inputs**: `signal(ast_node, ASTNode)` - AST from parser; `signal(parse_complete, metadata)`
**Outputs**: `signal(typed_ast_node, TypedASTNode)` - typed AST; `signal(typecheck_complete, metadata)` or `signal(compile_error, error)`
**State**: AST buffer, symbol table, error buffer

---

### 4. IR Generator Agent

```mycelial
hyphal ir_generator {
    frequency tidal_cycle

    state {
        typed_ast: vec<TypedASTNode>
        ir_instructions: vec<IRInstruction>
        basic_block_map: map<string, u32>
    }

    on signal(typed_ast_node, node) {
        # SENSE phase: received typed AST node from type checker
        vec_push(state.typed_ast, node)
    }

    on signal(typecheck_complete, tc) where vec_len(state.typed_ast) > 0 {
        # ACT phase: lower AST to IR
        for node in state.typed_ast {
            let ir = lower_to_ir(node, state.symbol_table)
            vec_push(state.ir_instructions, ir)
            emit ir_node(ir)
        }

        emit ir_complete {
            instruction_count: vec_len(state.ir_instructions)
        }
    }
}
```

**Inputs**: `signal(typed_ast_node, TypedASTNode)` - typed AST from type checker; `signal(typecheck_complete, metadata)`
**Outputs**: `signal(ir_node, IRInstruction)` - IR instructions; `signal(ir_complete, metadata)`
**State**: Typed AST buffer, IR instructions, basic block map

---

### 5. Code Generator Agent (x86-64)

```mycelial
hyphal x86_codegen {
    frequency tidal_cycle

    state {
        ir_instructions: vec<IRInstruction>
        asm_instructions: vec<AsmInstruction>
        register_allocator: LinearScanAllocator
    }

    on signal(ir_node, ir) {
        # SENSE phase: received IR instruction from IR generator
        vec_push(state.ir_instructions, ir)
    }

    on signal(ir_complete, irc) where vec_len(state.ir_instructions) > 0 {
        # ACT phase 1: register allocation
        allocate_registers(state.ir_instructions, state.register_allocator)

        # ACT phase 2: instruction selection (IR → x86-64 assembly)
        for ir_inst in state.ir_instructions {
            let asm = select_instructions(ir_inst, state.register_allocator)
            vec_push(state.asm_instructions, asm)
            emit asm_instruction(asm)
        }

        emit codegen_complete {
            instruction_count: vec_len(state.asm_instructions)
        }
    }
}
```

**Inputs**: `signal(ir_node, IRInstruction)` - IR from IR generator; `signal(ir_complete, metadata)`
**Outputs**: `signal(asm_instruction, AsmInstruction)` - x86-64 assembly; `signal(codegen_complete, metadata)`
**State**: IR buffer, assembly output, register allocator

---

### 6. Assembler Agent

```mycelial
hyphal assembler {
    frequency tidal_cycle

    state {
        asm_instructions: vec<AsmInstruction>
        machine_code: vec<byte>
        instruction_positions: vec<u32>
    }

    on signal(asm_instruction, asm) {
        # SENSE phase: received assembly instruction from code gen
        vec_push(state.asm_instructions, asm)
    }

    on signal(codegen_complete, cc) where vec_len(state.asm_instructions) > 0 {
        # ACT phase: encode instructions to machine code bytes
        let offset = 0u32
        for asm_inst in state.asm_instructions {
            vec_push(state.instruction_positions, offset)

            let bytes = encode_instruction(asm_inst)
            for byte in bytes {
                vec_push(state.machine_code, byte)
            }

            offset = offset + vec_len(bytes)
            emit machine_code_chunk { bytes: bytes }
        }

        emit assemble_complete {
            byte_count: vec_len(state.machine_code)
        }
    }
}
```

**Inputs**: `signal(asm_instruction, AsmInstruction)` - assembly from code gen; `signal(codegen_complete, metadata)`
**Outputs**: `signal(machine_code_chunk, bytes)` - machine code bytes; `signal(assemble_complete, metadata)`
**State**: Assembly buffer, machine code, instruction positions

---

### 7. Linker Agent

```mycelial
hyphal linker {
    frequency tidal_cycle

    state {
        machine_code: vec<byte>
        sections: map<string, Section>
        symbol_table: map<string, Symbol>
    }

    on signal(machine_code_chunk, chunk) {
        # SENSE phase: received machine code from assembler
        for byte in chunk.bytes {
            vec_push(state.machine_code, byte)
        }
    }

    on signal(assemble_complete, ac) where vec_len(state.machine_code) > 0 {
        # ACT phase: create ELF executable file
        let elf = create_elf_executable(
            state.machine_code,
            state.sections,
            state.symbol_table
        )

        # Write binary file
        let output_file = write_elf_file(elf, "a.out")

        emit link_complete {
            filename: output_file,
            file_size: vec_len(elf.data)
        }
    }
}
```

**Inputs**: `signal(machine_code_chunk, bytes)` - machine code from assembler; `signal(assemble_complete, metadata)`
**Outputs**: Writes ELF executable file; `signal(link_complete, metadata)`
**State**: Machine code accumulator, ELF sections, symbol table

---

## Signal Routing Topology

The signal routing is **sequential pipeline**:

```
compile_start
    ↓
[Lexer] → emits: token(Token)
          emits: lex_complete()
    ↓
[Parser] → emits: ast_node(ASTNode)
           emits: parse_complete()
    ↓
[Type Checker] → emits: typed_ast_node(TypedASTNode)
                 emits: typecheck_complete()
                 OR emits: compile_error()
    ↓
[IR Generator] → emits: ir_node(IRInstruction)
                 emits: ir_complete()
    ↓
[Code Gen] → emits: asm_instruction(AsmInstruction)
             emits: codegen_complete()
    ↓
[Assembler] → emits: machine_code_chunk(bytes)
              emits: assemble_complete()
    ↓
[Linker] → writes: output.elf
           emits: link_complete()
```

### Signal Frequencies

Each agent operates at **tidal_cycle** frequency:
- Processes all buffered signals from previous agent
- Transforms and emits result signals
- Rests for synchronization

This creates a **natural pipeline** where stages overlap:
- Cycle 1: Lexer processes code, Parser blocks (no tokens yet)
- Cycle 2: Lexer DONE, Parser processes tokens, TypeChecker blocks
- Cycle 3: Parser DONE, TypeChecker processes AST, IR Generator blocks
- And so on...

---

## Error Handling Strategy

Errors can occur at multiple phases:

### Type Errors
```mycelial
on signal(ast_node, node) where has_type_error(node) {
    emit compile_error {
        phase: "type_checker",
        line: node.line,
        message: format_error(node)
    }
}
```

### Code Generation Errors
```mycelial
on signal(ir_node, ir) where cannot_allocate_registers(ir) {
    emit compile_error {
        phase: "code_gen",
        message: "Register allocation failed"
    }
}
```

**Central error handler**: Main orchestrator listens for `compile_error()` signals and stops pipeline.

---

## Integration with Mycelial Language

The compiler is written in Mycelial itself, using:

### Frequencies
- **tidal_cycle**: All compiler agents run at tidal frequency
- Ensures predictable pipeline execution
- Natural parallelism opportunities for future optimization

### Signal Types
```mycelial
signal compile_start(source_code: string, output_file: string)
signal token(token: Token)
signal ast_node(node: ASTNode)
signal typed_ast_node(node: TypedASTNode)
signal ir_node(ir: IRInstruction)
signal asm_instruction(asm: AsmInstruction)
signal machine_code_chunk(bytes: vec<byte>)
signal compile_error(phase: string, line: u32, message: string)
signal lex_complete(token_count: u32)
signal parse_complete(root_id: u32)
signal typecheck_complete(success: bool, symbols: u32)
signal ir_complete(instruction_count: u32)
signal codegen_complete(instruction_count: u32)
signal assemble_complete(byte_count: u32)
signal link_complete(filename: string, file_size: u32)
```

### Shared State Structures
```mycelial
struct Token {
    type: TokenType
    value: string
    line: u32
    column: u32
}

struct ASTNode {
    id: u32
    type: ASTNodeType
    children: vec<u32>
    parent: u32
    line: u32
}

struct TypedASTNode {
    id: u32
    data: ASTNode
    type_info: Type
}

struct IRInstruction {
    op: IROpcode
    operands: vec<IROperand>
    metadata: IRMetadata
}

struct AsmInstruction {
    mnemonic: string
    operands: vec<string>
    encoding: vec<byte>
}
```

---

## Performance Considerations

### Pipelining Efficiency
- Agents process in parallel cycles
- Minimal context switching (each agent has fixed state)
- Signal buffering prevents busy-waiting

### Memory Usage
- Each agent accumulates data (tokens, AST nodes, IR, etc.)
- Could be optimized: stream-process instead of buffering
- MVP: Simple buffering, optimize in M5

### Optimization Opportunities (M5)
- Signal streaming: Don't buffer entire AST, emit→process→discard
- Parallel agents: Multiple IR generators for independent functions
- Memoization: Cache type checking results
- Lazy evaluation: Generate only reachable code

---

## Comparison with Traditional Compilers

| Aspect | Traditional (monolithic) | Mycelial (agent-based) |
|--------|-------------------------|----------------------|
| **Control Flow** | Centralized: main() calls lexer() then parser() then codegen() | Distributed: Agents emit signals, orchestrator watches |
| **Data Passing** | Function calls with return values | Signal emission with buffering |
| **Parallelism** | Sequential (lexer finishes, then parser starts) | Natural pipelining (overlap stages) |
| **Error Handling** | Exceptions, error codes | Signal-based errors |
| **Scalability** | Linear complexity | Potential for parallel agent clones |
| **Code Organization** | Monolithic or multiple passes | Modular agent definitions |
| **Self-Hosting** | Possible but difficult | Natural demonstration of language |

---

## Success Criteria for M0

✅ **Compiler-as-agents architecture is complete when:**

1. All 7 agent definitions are specified in Mycelial pseudocode
2. Signal routing topology is clear and documented
3. Tidal cycle execution model is explained with examples
4. Integration with Mycelial type system and frequencies is demonstrated
5. Error handling strategy is defined
6. Performance considerations are identified
7. Ready for implementation in M1

---

## Next Phase: M1 Implementation

When this design is approved:
1. Translate agent pseudocode to actual Mycelial code
2. Implement each agent's state and rule logic
3. Test signal flow with simple programs
4. Integrate with Opus's code generation and Sonnet's IR specification

This architecture proves that **Mycelial's agent-based model can handle real systems programming** - the ultimate goal.

---

**Status**: 🔄 IN PROGRESS - Complete architecture with all agent definitions and signal flow documented. 🚀
