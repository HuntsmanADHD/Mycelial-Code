# M1 Team Kickoff - Next Steps for Opus and Sonnet

**Date**: 2026-01-01
**Status**: M0 Complete ✅ - Ready for M1
**Next Phase**: Implementation Begins Week 4

---

## Executive Summary

M0 is complete. All architecture and design documents are finalized. Your briefing documents and next steps are ready. M1 implementation begins when Lexer Agent starts (Week 4).

**For Opus**: Focus on Code Generation Agent (Weeks 8-9)
**For Sonnet**: Focus on IR Generator Agent (Week 8)

---

## What Each Team Member Should Do Now

### **OPUS - Code Generator Agent**

**Read these documents (in order)**:
1. `/OPUS_NEXT_STEPS.md` - Your immediate action items
2. `/OPUS_M1_BRIEF.md` - Complete context and responsibilities
3. Your own `/docs/architecture/x86-64-codegen.md` - Your strategy
4. Your own `/docs/knowledge-base/x86-64-instructions.md` - 48 instructions
5. Sonnet's `/docs/architecture/ir-specification.md` - Section 5 (LIR types)

**What you'll implement**:
- Instruction selection (LIR → x86-64)
- Register allocation (linear scan)
- Function prologue/epilogue generation
- System V calling convention compliance

**Timeline**:
- Weeks 1-7: Prepare and understand IR specification
- Weeks 8-9: Implement Code Gen agent
- By end Week 9: Integration test passes (LIR → x86-64)

**Success looks like**:
- Translating Sonnet's LIR instructions to x86-64 assembly
- Allocating registers correctly
- Generating working x86-64 code that Assembler can encode

---

### **SONNET - IR Generator Agent**

**Read these documents (in order)**:
1. `/SONNET_NEXT_STEPS.md` - Your immediate action items
2. `/SONNET_M1_BRIEF.md` - Complete context and responsibilities
3. Your own `/docs/architecture/ir-specification.md` - Your complete design
4. **Critical sections**: 6 (lowering strategy) and 10.1 (hello_world example)
5. `/SONNET_M1_BRIEF.md` - Integration points with Code Gen

**What you'll implement**:
- AST → HIR lowering (preserves agent structure)
- HIR → LIR lowering (imperative instructions)
- Type propagation through IR
- Memory layout computation

**Timeline**:
- Weeks 1-3: Receive Parser agent output (AST nodes)
- Week 8: Implement IR Generator agent
- By end Week 8: Complete hello_world AST → LIR lowering

**Success looks like**:
- Converting Parser's AST to your HIR representation
- Lowering HIR to LIR instructions
- Producing well-formed LIR that Code Gen can use
- Preserving type information throughout

---

## The Pipeline You're Building

```
Week 4: Lexer Agent (tokenize)
   ↓
Week 5: Parser Agent (→ AST)
   ↓
Week 6: Type Checker Agent (validate types)
   ↓
Week 8: SONNET - IR Generator Agent (AST → HIR → LIR)
   ↓
Week 9: OPUS - Code Gen Agent (LIR → x86-64)
   ↓
Week 10: Assembler Agent (x86-64 → machine code)
   ↓
Week 11: Linker Agent (machine code → ELF executable)
   ↓
Integration Test: Run the compiled binary
```

---

## Key Coordination Points

**Between Sonnet and Opus**:
- Sonnet produces: LIR instructions with type information
- Opus consumes: LIR instructions, produces x86-64 assembly
- Interface: `/docs/architecture/ir-specification.md` Section 12 (Code Gen interface)
- Test case: `/examples/hand-coded/hello-x86-64.asm` (reference output)

**Both should study**:
- The hello_world example in ir-specification.md Section 10.1
- Shows complete pipeline: Mycelial → HIR → LIR → x86-64
- This is your integration test case

---

## Available Resources

**All M0 Deliverables** (13 documents):
- 3 architecture docs (~3,350 lines)
- 5 knowledge base docs (~3,080 lines)
- 1 IR specification (1,469 lines)
- 4 organizational docs
- **Total**: ~7,200 lines of specification

**Key Reference Files**:
- `/docs/architecture/` - All architecture designs
- `/docs/knowledge-base/` - Reference material
- `/examples/hand-coded/hello-x86-64.asm` - Target output
- `/docs/milestones/m0-design.md` - M0 completion report
- `/PROGRESS_TRACKER.md` - Detailed checkpoint system

---

## Quality Expectations

**M0 Quality**: ⭐⭐⭐⭐⭐ (Exceptional)
**Your M1 Work Should Match This Quality**:
- Comprehensive: Cover all cases
- Clear: Well-organized, documented
- Correct: Follow your own specifications
- Tested: Validate with hello_world example
- Integrated: Work seamlessly with other agents

---

## Communication & Support

**If you have questions**:
- Reach out to Haiku immediately
- Reference the relevant documentation
- Ask for clarification on design decisions
- Flag any blockers early

**Check-in Points**:
- Haiku will monitor progress during M1
- Regular status updates help coordination
- Any alignment issues caught early prevent rework

---

## Success Criteria for M1

✅ Lexer Agent produces tokens
✅ Parser Agent produces AST
✅ Type Checker validates types
✅ **Sonnet's IR Generator produces correct LIR** (Week 8)
✅ **Opus's Code Gen produces x86-64 assembly** (Week 9)
✅ Assembler encodes to machine code
✅ Linker produces ELF executable
✅ **Integration test passes**: hello_world.mycelial compiles and runs

---

## Ready to Begin?

**For Opus**:
1. Read `/OPUS_NEXT_STEPS.md` and `/OPUS_M1_BRIEF.md`
2. Familiarize yourself with your x86-64 strategy
3. Study Sonnet's IR specification (especially Section 5)
4. Wait for Sonnet's IR Generator to produce LIR
5. Implement Code Gen agent in Weeks 8-9

**For Sonnet**:
1. Read `/SONNET_NEXT_STEPS.md` and `/SONNET_M1_BRIEF.md`
2. Review your complete IR specification
3. Study the hello_world example (Section 10.1)
4. Wait for Parser agent to produce AST
5. Implement IR Generator agent in Week 8

**For Haiku (me)**:
- Monitor M1 progress
- Coordinate team communication
- Ensure smooth handoffs between agents
- Maintain quality and timeline

---

## The Goal

Build a **self-hosting compiler** that:
1. Reads Mycelial source code
2. Parses it to AST
3. Lowers to IR
4. Generates x86-64 machine code
5. **Compiles itself** (fixed point)

This is **beautiful work**. You're building the bridge between language and machine. Make it extraordinary.

🌿🧬 **Let's build something incredible.** 🚀

---

**M0 Complete**: 2026-01-01
**M1 Kickoff**: 2026-01-??  (Week 4 timeline)
**M1 Target Completion**: Week 11-12 (hello_world compiles and runs)

---

**Questions?** Reach out to Haiku.
**Ready?** Let's make M1 legendary.
