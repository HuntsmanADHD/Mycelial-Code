# Prompt for Sonnet - IR Generator Agent Implementation

**From**: Haiku (COO)
**Status**: M0 Complete - Ready for M1
**Timeline**: Week 8 of M1 (after Parser agent completes)

---

## Your Mission

Implement the **IR Generator Agent** in Mycelial - the component that translates the abstract syntax tree into an intermediate representation that powers code generation.

---

## What You Need to Do

### Immediate (Before M1 Week 8)

1. **Read your comprehensive briefing**: `/SONNET_M1_BRIEF.md`
   - Full context on IR Generator Agent responsibilities
   - What you'll receive from Parser agent
   - What you'll emit to Code Gen agent
   - Coordination strategy

2. **Review your own IR specification**:
   - Your ir-specification.md (complete - 1,469 lines)
   - Sections 1-8 contain all design details
   - Section 10.1 contains hello_world example (critical reference)

3. **Study the complete lowering pipeline**:
   - **Section 6**: Lowering strategy (AST → HIR → LIR)
   - **6.1**: State access compilation
   - **6.2**: Signal emission compilation
   - **6.3**: Conditional compilation
   - **6.4**: Arithmetic expression lowering
   - **6.5**: Pattern matching compilation

4. **Understand what you'll receive**:
   - Parser emits ASTNode signals (Weeks 1-3)
   - Each node represents language construct
   - Type information attached (from Type Checker)
   - Source location for error messages

5. **Understand what you'll emit**:
   - HIR nodes (high-level representation preserving agent semantics)
   - LIR instructions (30+ instruction types from Section 5)
   - Type information attached to all values
   - Memory layout information for allocations

### When M1 Week 8 Starts

1. **Wait for Parser Agent to complete** (Weeks 1-3)
   - You'll receive ASTNode signals from Parser
   - Type Checker will have validated types
   - All information you need is available

2. **Implement AST → HIR lowering**:
   - frequency definitions → HIR nodes
   - hyphal (agent) definitions → HIR nodes
   - rule definitions → HIR nodes
   - Expression lowering (reference Section 6)

3. **Implement HIR → LIR lowering**:
   - **State access** (Section 6.1): Load/store state fields
   - **Signal emission** (Section 6.2): Allocate signal, set fields, emit
   - **Conditionals** (Section 6.3): Branching with phi nodes
   - **Arithmetic** (Section 6.4): Binary and unary operations
   - **Pattern matching** (Section 6.5): Frequency ID dispatch with guards

4. **Attach type information**:
   - Every LIR value carries size information
   - Compute and attach for all operations
   - Enable Code Gen to choose proper instructions

5. **Compute memory layouts**:
   - Agent state struct field offsets
   - Signal struct field offsets
   - Stack frame organization
   - Pass to Code Gen for correct addressing

6. **Emit HIR and LIR signals**:
   - Each HIR node as separate signal
   - Each LIR instruction as separate signal
   - Enable streaming pipeline to next agent

---

## Your Role

**Input**: ASTNode signals (from Parser Agent)
- ASTNode { type, location, children, data }

**Processing**:
- AST → HIR lowering (preserves agent structure)
- HIR → LIR lowering (imperative instructions)
- Type propagation through IR
- Memory layout computation

**Output**: LIR instruction signals (to Code Gen Agent)
- LIRInstruction { op, operands, type }
- Unlimited virtual registers
- Complete type information

---

## Success Criteria

✅ All language constructs lower to HIR correctly
✅ All HIR nodes lower to LIR correctly
✅ Type information preserved and computed throughout
✅ Memory layouts computed accurately
✅ hello_world.mycelial lowers completely
✅ Output matches expected lowering in ir-specification.md Section 10.1
✅ Integration test passes: AST → LIR → x86-64 (full pipeline)

---

## Key Resources

**Your IR Specification**:
- `/docs/architecture/ir-specification.md` - Your complete design (1,469 lines)
- Section 2: Type system (all types you'll use)
- Section 4: HIR node types (frequency, hyphal, rule, expression)
- Section 5: LIR instruction types (30+ operations)
- Section 6: Lowering strategy (complete algorithm)
- Section 7: Memory layout (struct offset calculations)
- Section 10.1: hello_world example (step-by-step walkthrough)

**Opus's Architecture**:
- `/docs/architecture/x86-64-codegen.md` - Understand target machine
- `/docs/knowledge-base/x86-64-instructions.md` - What Code Gen will produce
- `/examples/hand-coded/hello-x86-64.asm` - Expected final output

**Language Grammar**:
- `/home/lewey/Desktop/MyLanguage/01-SPECIFICATION/GRAMMAR.md` - Language syntax
- Reference implementation parser available for logic verification

**Team Support**:
- Haiku: Available for questions on IR design or lowering strategy
- Opus: Can clarify instruction selection requirements if needed

---

## Implementation Tips

1. **Start with simple constructs**: Implement arithmetic operations first
2. **Test incrementally**: Each lowering rule should be validated
3. **Use hello_world as reference**: Your Section 10.1 example is the test case
4. **Preserve type information**: Attach to every LIR value
5. **Validate memory layouts**: Use formulas from Section 7
6. **Handle all edge cases**: Pattern matching, guard clauses, signal dispatch
7. **Stream pipeline**: Emit signals as you produce them (don't batch)

---

## Implementation Pattern

For each AST node type:

1. **Identify lowering rule**: Reference Section 6 for your construct type
2. **Create HIR representation**: Use HIR node types from Section 4
3. **Lower to LIR**: Use LIR instruction types from Section 5
4. **Attach type info**: Compute and propagate types
5. **Emit signals**: Send HIR and LIR to next agent
6. **Test**: Verify against Section 10.1 example

---

## Critical Sections to Master

- **Section 6.1** (State access): How to compile state field reads/writes
- **Section 6.2** (Signal emission): How to compile signal creation and emission
- **Section 6.5** (Pattern matching): How to compile rule pattern matching
- **Section 7** (Memory layout): How to compute struct field offsets
- **Section 10.1** (hello_world): Your complete test case and reference

---

## Expected Timeline

- **Weeks 1-3**: Wait for Lexer, Parser, Type Checker agents
- **Week 8**: Implement IR Generator agent (you have 1 week)
- **By end of Week 8**: All hello_world AST → LIR lowering complete
- **Week 9**: Code Gen agent takes your LIR, produces x86-64
- **Week 10**: Assembler produces machine code
- **Week 11**: Linker produces executable

---

## Questions?

- **On HIR design?** Reference ir-specification.md Section 4
- **On LIR instructions?** Reference ir-specification.md Section 5
- **On lowering strategy?** Reference ir-specification.md Section 6
- **On memory layout?** Reference ir-specification.md Section 7
- **On calling conventions?** Reference ir-specification.md Section 8
- **On implementation approach?** Ask Haiku

---

## Ready?

You've designed the bridge between language and code generation beautifully. Now it's time to implement it. Your specification is precise - follow it exactly.

Your IR Generator agent will be the **translator** that makes everything else possible. The Code Gen agent depends on you producing correct, well-formed LIR. Make it beautiful. 🚀

---

## When to Start

You'll need:
1. **Parser agent output** (ASTNode signals from Weeks 1-3)
2. **Type information** (from Type Checker agent)
3. **Your IR specification** (you already have this)

Then implement the agent in Mycelial following Section 6 lowering strategy.

**Questions or blockers?** Reach out to Haiku immediately.
