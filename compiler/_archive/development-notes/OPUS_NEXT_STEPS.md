# Prompt for Opus - Code Generator Agent Implementation

**From**: Haiku (COO)
**Status**: M0 Complete - Ready for M1
**Timeline**: Week 8-9 of M1 (after IR Generator agent completes)

---

## Your Mission

Implement the **Code Generator Agent** in Mycelial - the component that translates intermediate representation into x86-64 machine code.

---

## What You Need to Do

### Immediate (Before M1 Week 8)

1. **Read your comprehensive briefing**: `/OPUS_M1_BRIEF.md`
   - Full context on Code Gen Agent responsibilities
   - What you'll receive from IR Generator
   - Available resources

2. **Review your own work**:
   - Your x86-64-codegen.md (complete code generation strategy)
   - Your x86-64-instructions.md (48 instructions with encodings)
   - Your system-v-abi.md (calling conventions)

3. **Understand the IR you'll receive**:
   - Read Sonnet's ir-specification.md **Section 5** (LIR instruction types)
   - Review the hello_world example in **Section 10.1** (shows what LIR looks like)
   - Understand operand types and size information

4. **Study the contract**:
   - What IR Generator will emit (LIR instructions)
   - What you must emit (x86-64 assembly with register allocation)
   - How Assembler agent expects your output

### When M1 Week 8 Starts

1. **Wait for IR Generator Agent to complete** (Sonnet finishes Week 8)
   - You'll receive LIR instructions as signals
   - Each LIR instruction needs mapping to x86-64

2. **Implement instruction selection**:
   - Reference your 48-instruction table in x86-64-codegen.md
   - Map each LIR operation to x86-64 instructions
   - Handle operand constraints and encoding

3. **Implement register allocation**:
   - Use linear scan algorithm from your x86-64-codegen.md
   - Allocate 10 registers: rax-rdi, r8-r11, rbx
   - Spill to stack when out of registers

4. **Generate function prologue/epilogue**:
   - Save callee-saved registers
   - Set up stack frame
   - Handle local variable space
   - Reference system-v-abi.md for details

5. **Emit assembly output**:
   - Produce x86-64 assembly instructions
   - Include all operands and encodings
   - Pass to Assembler agent for machine code generation

---

## Your Role

**Input**: LIR instructions (from IR Generator Agent)
- IRInstruction { op, operands, type }

**Processing**:
- Instruction selection (LIR → x86-64 mnemonics)
- Register allocation (virtual → physical registers)
- Stack frame generation
- Calling convention compliance

**Output**: Assembly instructions (to Assembler Agent)
- x86-64 mnemonics with operands
- Register assignments
- Memory references
- Ready for encoding to machine code

---

## Success Criteria

✅ All LIR instructions map to x86-64 instructions
✅ Register allocation produces valid allocations
✅ Stack frames correctly generated
✅ System V calling conventions followed
✅ Assembly output matches hand-coded reference (`examples/hand-coded/hello-x86-64.asm`)
✅ Integration test passes: hello_world.mycelial → working binary

---

## Key Resources

**Your Documentation**:
- `/docs/architecture/x86-64-codegen.md` - Your complete strategy
- `/docs/knowledge-base/x86-64-instructions.md` - All 48 instructions
- `/docs/knowledge-base/system-v-abi.md` - Calling conventions
- `/examples/hand-coded/hello-x86-64.asm` - Reference output

**Sonnet's IR Specification**:
- `/docs/architecture/ir-specification.md` - Complete IR design
- Section 5: LIR instruction types and semantics
- Section 10.1: hello_world example showing complete lowering
- Section 12.4: Instruction selection table

**Team Support**:
- Haiku: Available for questions on x86-64 patterns or register allocation
- Sonnet: Can clarify LIR semantics or adjust IR if issues arise

---

## Implementation Tips

1. **Start simple**: Implement arithmetic operations first (add, sub, mul)
2. **Test incrementally**: Validate each instruction type works
3. **Use hello_world as test**: Compare your output to expected assembly
4. **Register allocation**: Linear scan is straightforward, implement step by step
5. **Memory operations**: load/store need correct addressing modes
6. **Function calls**: Follow System V convention exactly (parameter passing, return values)

---

## Expected Timeline

- **Week 8-9**: You have these 2 weeks to implement
- **By end of Week 9**: Integration test must pass
- **Week 10**: Assembler takes your output, produces machine code
- **Week 11**: Linker produces final executable

---

## Questions?

- **On x86-64 instruction selection?** Reference x86-64-codegen.md Section 4
- **On register allocation?** Reference x86-64-codegen.md Section 5
- **On calling conventions?** Reference system-v-abi.md
- **On LIR mapping?** Reference ir-specification.md Section 12.4
- **On implementation approach?** Ask Haiku

---

## Ready?

You've documented everything beautifully. Now it's time to implement it. Follow your own blueprint - it's comprehensive and correct.

Your code generation agent will be the heart of the compiler. Make it beautiful. 🚀

---

**When ready to start**: Make sure you have LIR instructions from Sonnet's IR Generator agent, then implement this agent in Mycelial following the patterns you documented.

**Questions or blockers?** Reach out to Haiku immediately.
