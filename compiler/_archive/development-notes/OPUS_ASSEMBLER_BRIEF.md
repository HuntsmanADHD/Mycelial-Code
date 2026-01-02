# Assembler Agent Briefing - Opus

**From**: Haiku (Chief Operations Officer)
**Date**: 2026-01-01
**Subject**: M1 Week 10 - Assembler Agent Implementation
**Duration**: Week 10 of M1

---

## Your Next Assignment

After the Code Generator and Parser agents, you're now being assigned the **Assembler Agent** for M1 Week 10.

This is the final transformation in the compilation pipeline: converting x86-64 assembly text into machine code bytes, ready for linking and execution.

---

## Why Assembler Comes Next

**Pipeline Dependency**:
```
Week 8: IR Generator Agent (Sonnet - produces LIR)
  ↓ (LIR instructions)
Week 9: Code Generator Agent (Opus - produces assembly)
  ↓ (x86-64 assembly text)
Week 10: Assembler Agent ← YOUR ROLE (encode to machine code)
  ↓ (Machine code bytes)
Week 11: Linker Agent (generate ELF executable)
```

**You're the critical link** between human-readable assembly and executable machine code.

---

## What the Assembler Does

**Input**: x86-64 assembly instructions from Code Gen
```
movabs rax, 0x1234
mov rdi, rax
add rsi, rdx
ret
```

**Output**: Machine code bytes for Linker
```
Byte 0: 48 B8 34 12 00 00 00 00 00 00  (movabs rax, 0x1234)
Byte 10: 48 89 C7                      (mov rdi, rax)
Byte 13: 48 01 D6                      (add rsi, rdx)
Byte 16: C3                            (ret)
```

**Job**: Encode instruction mnemonics and operands into precise machine code bytes with correct prefix, opcode, and addressing mode bytes.

---

## x86-64 Instruction Encoding Reference

**Complete Reference**: `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/x86-64-instructions.md` (18,261 bytes)

**Key Encoding Concepts**:

### 1. REX Prefix (0x40-0x4F)

Required for 64-bit operands and extended registers (r8-r15):

```
Structure:  0 1 0 0 W R X B
            └─┬─┘   │ │ │ │
              │     │ │ │ └── B: Extends r/m field for r8-r15
              │     │ │ └──── X: Extends SIB index for r8-r15
              │     │ └────── R: Extends reg field for r8-r15
              │     └──────── W: 64-bit operand size
              └──────────────  Fixed pattern (0100)
```

Common REX values:
- `0x48` - REX.W (64-bit operand)
- `0x49` - REX.WB (64-bit + r/m uses r8-r15)
- `0x4C` - REX.WR (64-bit + reg uses r8-r15)
- `0x4D` - REX.WRB (64-bit + both use r8-r15)

### 2. ModR/M Byte (Addressing Mode)

```
Bits:  M M R R R M M M
       │ │ │ │ │ │ │ │
       │ │ │ │ │ └─┴─┴─ R/M field (register or memory)
       │ │ └─┴─┴───────  Reg field (register or opcode extension)
       └─┴──────────────  Mod field (addressing mode)
```

**Mod values**:
- `00` - Memory, no displacement (or RIP-relative for r/m=101)
- `01` - Memory with 8-bit signed displacement
- `10` - Memory with 32-bit signed displacement
- `11` - Register-to-register (no memory access)

### 3. SIB Byte (Scale-Index-Base)

```
Bits:  S S I I I B B B
       │ │ │ │ │ │ │ │
       │ │ │ │ │ └─┴─┴─ Base register (r/m=4)
       │ │ └─┴─┴───────  Index register
       └─┴──────────────  Scale (2^n multiplier)
```

**Scale values**:
- `00` - Scale 1x
- `01` - Scale 2x
- `10` - Scale 4x
- `11` - Scale 8x

### 4. Register Encoding (3-bit codes)

| Register | Code | With REX.R/B |
|----------|------|--------------|
| rax      | 0    | rax          |
| rcx      | 1    | rcx          |
| rdx      | 2    | rdx          |
| rbx      | 3    | rbx          |
| rsp      | 4    | rsp          |
| rbp      | 5    | rbp          |
| rsi      | 6    | rsi          |
| rdi      | 7    | rdi          |
| r8       | 0    | r8 (REX.B=1) |
| r9       | 1    | r9 (REX.B=1) |
| r10      | 2    | r10 (REX.B=1) |
| ...      | ...  | ... (r11-r15)|

### 5. Addressing Mode Examples

**Register direct**: `mov rax, rbx`
```
REX.W: 0x48
Opcode: 0x89 (MOV r/m64, r64)
ModR/M: 0xD8 (Mod=11, Reg=rbx(3), R/M=rax(0))
Bytes: 48 89 D8
```

**Memory indirect**: `mov rax, [rdi]`
```
REX.W: 0x48
Opcode: 0x8B (MOV r64, r/m64)
ModR/M: 0x07 (Mod=00, Reg=rax(0), R/M=rdi(7))
Bytes: 48 8B 07
```

**Memory + displacement**: `mov rax, [rbx + 8]`
```
REX.W: 0x48
Opcode: 0x8B (MOV r64, r/m64)
ModR/M: 0x43 (Mod=01, Reg=rax(0), R/M=rbx(3))
Displacement: 0x08 (8-bit signed)
Bytes: 48 8B 43 08
```

**SIB addressing**: `mov rax, [rcx + 2*rdx]`
```
REX.W: 0x48
Opcode: 0x8B (MOV r64, r/m64)
ModR/M: 0x04 (Mod=00, Reg=rax(0), R/M=100 [SIB follows])
SIB: 0x51 (Scale=01, Index=rdx(2), Base=rcx(1))
Bytes: 48 8B 04 51
```

---

## Assembler Architecture

### Input Format (from Code Gen)

The Code Gen Agent produces assembly in this format:

```mycelial
AssemblyLine {
  instruction: Instruction
  operands: Vec<Operand>
  label: Option<String>
  comment: Option<String>
}

Instruction = mov | add | sub | imul | idiv | ...

Operand =
  | Register { name: String }              // "rax", "r8", etc.
  | Memory { base: String, offset: i32 }  // "[rdi]", "[rbx + 8]", etc.
  | Immediate { value: u64 }              // "0x1234", etc.
  | Label { name: String }                // ".L0", etc.
```

### Output Format (to Linker)

```mycelial
MachineCodeSection {
  address: u64
  code: Vec<u8>
  relocations: Vec<Relocation>
}

Relocation {
  offset: u32
  symbol: String
  relocation_type: RelType  // ABSOLUTE, REL32, etc.
}
```

---

## Implementation Requirements

### 1. Instruction Encoding

Implement encoding for all 48 x86-64 instructions:

**Data Movement** (10):
- `mov` (8B, 89, C7, C6) - Register, memory, immediate forms
- `lea` (8D) - Load effective address
- `push` (50-57, FF) - Push to stack
- `pop` (58-5F, 8F) - Pop from stack
- `movabs` (B8, BA, BB, etc.) - 64-bit immediate move

**Arithmetic** (12):
- `add` (03, 01, 05, 81, 83) - Add with register, memory, immediate
- `sub` (2B, 29, 2D, 81, 83) - Subtract
- `imul` (AF, F7, 69, 6B) - Signed multiply
- `idiv` (F7) - Signed divide
- `neg` (F7) - Negate
- `inc`, `dec` (FF, FE) - Increment, decrement

**Bitwise Logic** (8):
- `and` (23, 21, 25, 81, 83) - Bitwise AND
- `or` (0B, 09, 0D, 81, 83) - Bitwise OR
- `xor` (33, 31, 35, 81, 83) - Bitwise XOR
- `not` (F7) - Bitwise NOT
- `shl` (D3, C1) - Shift left
- `shr` (D3, C1) - Shift right
- `sal`, `sar` - Arithmetic shifts

**Comparison** (4):
- `cmp` (3B, 39, 3D, 81, 83) - Compare (affects flags)
- `test` (85, 84) - Test (affects flags, like AND but no result)

**Control Flow** (10):
- `jmp` (E9, EB, FF) - Unconditional jump
- `je`, `jne`, `jl`, `jle`, `jg`, `jge` (0F 8x, 7x) - Conditional jumps
- `call` (E8, FF) - Call subroutine
- `ret` (C3) - Return from subroutine

**System** (4):
- `syscall` (0F 05) - System call
- `nop` (90) - No operation
- `hlt` (F4) - Halt
- `ud2` (0F 0B) - Undefined instruction

### 2. Operand Handling

For each operand form:

```rust
fn encode_operand(&mut self, op: &Operand) -> Vec<u8> {
  match op {
    Register(r) => encode_register_code(r),
    Memory { base, offset } => {
      // Choose Mod bits (01, 10, 11) based on offset
      // Build ModR/M byte
      // Add displacement bytes
      // Add SIB if needed
    }
    Immediate(imm) => encode_immediate(*imm),
    Label(name) => {
      // Store relocation for linker
      // Return placeholder bytes
    }
  }
}
```

### 3. Symbol and Label Resolution

**During assembly**:
1. First pass: Record all label positions
2. Second pass: Resolve jump targets, forward references
3. Build relocation table for external symbols

```mycelial
symbol_table: Map<String, u32>  // label -> offset in code section

for line in assembly_lines {
  if line.label {
    symbol_table[line.label] = current_offset
  }
  current_offset += encode(line).len()
}

// Second pass: resolve forward references
for relocation in relocations {
  target = symbol_table[relocation.symbol]
  patch_displacement(code, relocation.offset, target)
}
```

### 4. Instruction Selector Matrix

Create lookup tables for instruction encoding:

```mycelial
// Instruction opcode mappings
modrm_opcodes: Map<(Instruction, OperandForm), u8>

// Example:
modrm_opcodes[("add", "r/m64,r64")] = 0x01
modrm_opcodes[("add", "rax,imm32")] = 0x05
modrm_opcodes[("add", "r/m64,imm8")] = 0x83  // with /0 in ModR/M.reg
modrm_opcodes[("add", "r/m64,imm32")] = 0x81  // with /0 in ModR/M.reg
```

### 5. Error Handling

- Invalid register names: Return error with suggestion
- Invalid addressing mode for instruction: Return error
- Displacement out of range (needs 32-bit, got only 8-bit space): Extend encoding
- Circular label references: Detect in symbol resolution

---

## Instruction Encoding Examples

### Example 1: Simple Register Move

**Instruction**: `mov rax, rbx`

**Encoding**:
```
REX.W:     0x48  (64-bit, no extended registers)
Opcode:    0x89  (MOV r/m64, r64)
ModR/M:    0xD8  (Mod=11, Reg=rbx(3), R/M=rax(0))
──────
Bytes:     48 89 D8
```

**Verification**:
- REX.W (0x48) = 0100 1000 (W=1, rest=0)
- Opcode (0x89) = MOV r/m64, r64 (register-to-register)
- ModR/M (0xD8) = 1101 1000 (Mod=11, Reg=011, R/M=000)

### Example 2: Memory Load with Displacement

**Instruction**: `mov rax, [rbx + 8]`

**Encoding**:
```
REX.W:         0x48  (64-bit)
Opcode:        0x8B  (MOV r64, r/m64)
ModR/M:        0x43  (Mod=01, Reg=rax(0), R/M=rbx(3))
Displacement:  0x08  (8-bit signed)
──────
Bytes:         48 8B 43 08
```

### Example 3: SIB Addressing

**Instruction**: `add rax, [rcx + 2*rdx]`

**Encoding**:
```
REX.W:     0x48  (64-bit)
Opcode:    0x03  (ADD r64, r/m64)
ModR/M:    0x04  (Mod=00, Reg=rax(0), R/M=100 [SIB])
SIB:       0x51  (Scale=01, Index=rdx(2), Base=rcx(1))
──────
Bytes:     48 03 04 51
```

### Example 4: Immediate Operand

**Instruction**: `add rax, 0x12345678`

**Encoding**:
```
REX.W:          0x48  (64-bit)
Opcode:         0x81  (ADD r/m64, imm32)
ModR/M:         0xC0  (Mod=11, Reg=/0, R/M=rax(0))
Immediate:      0x78 0x56 0x34 0x12  (little-endian 32-bit)
──────
Bytes:          48 81 C0 78 56 34 12
```

### Example 5: Conditional Jump

**Instruction**: `je .L0` (Jump to label .L0 if equal)

**Encoding** (assuming .L0 is at offset +100 from jump):
```
Opcode:     0x74  (JE rel8) - if displacement fits in 8 bits
Displacement: 0x62  (98 bytes in 8-bit signed form)
──────
Bytes:      74 62
```

Or if displacement is larger:
```
Opcode:     0x0F 0x84  (JE rel32) - 32-bit displacement
Displacement: 0x64 0x00 0x00 0x00  (100 bytes, little-endian)
──────
Bytes:      0F 84 64 00 00 00
```

---

## AST Node Structure

Define these in Mycelial:

```mycelial
AssemblyInstruction {
  mnemonic: String,           // "mov", "add", "jmp", etc.
  operands: Vec<Operand>,     // 0-3 operands
  label: Option<String>,      // ".L0", etc.
  comment: Option<String>
}

Operand =
  | Reg { name: String }                    // rax, rbx, r8, etc.
  | Mem { base: String, offset: i32 }      // [rdi], [rbx + 8], etc.
  | Imm { value: u64 }                      // immediate value
  | LabelRef { name: String }               // reference to label

MachineCodeByte {
  byte: u8
}

Relocation {
  offset: u32
  symbol: String
  reloc_type: String  // "ABSOLUTE", "REL32", etc.
}
```

---

## Success Criteria

✅ **Correctness**:
- All 48 instruction types encode correctly
- ModR/M, SIB, REX, displacement handling correct
- Register codes match CPU specification
- Little-endian immediates and displacements

✅ **Completeness**:
- Encode assembly from Code Gen for all LIR opcodes
- Handle all addressing modes (register, memory, immediate)
- Resolve forward and backward label references
- Generate relocations for external symbols

✅ **Error Handling**:
- Report invalid register names with suggestions
- Detect addressing mode mismatches
- Handle displacement out-of-range (extend encoding)
- Validate instruction-operand combinations

✅ **Integration**:
- Consume assembly from Code Gen Agent
- Emit machine code bytes to Linker Agent
- Interface with Symbol Resolution Agent (shared)
- Integration test with hello_world.mycelial

---

## Testing Strategy

### Unit Tests (by instruction category)

```
test_mov_encoding()              // Data movement
test_add_encoding()              // Arithmetic
test_and_encoding()              // Bitwise logic
test_cmp_encoding()              // Comparison
test_jmp_encoding()              // Control flow
test_syscall_encoding()          // System

test_register_direct()           // Addressing modes
test_memory_indirect()
test_memory_displacement()
test_sib_addressing()
test_immediate_encoding()

test_label_resolution()          // Symbol handling
test_forward_reference()
test_relocation_table()

test_error_invalid_register()    // Error handling
test_error_addressing_mismatch()
test_error_out_of_range()
```

### Integration Tests

```
test_hello_world_assembly()      // Full Code Gen → Assembler → bytes
test_counter_agent_assembly()    // Assembly encoding for counter example
test_complex_network_assembly()  // Full program assembly
```

### Validation

Assemble generated machine code and compare with:
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/examples/hello-x86-64.asm` (hand-written reference)
- Disassembly output matches instruction sequences

---

## Reference Implementation

**Existing x86-64 Reference**:
- `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/x86-64-instructions.md` - All 48 instructions with encoding
- `/home/lewey/Desktop/mycelial-compiler/examples/hand-coded/hello-x86-64.asm` - Hand-written assembly example
- `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/elf-format.md` - Machine code → ELF conversion

**Algorithm Reference**:
- Linear scan through assembly, build symbol table in first pass
- Encode instructions in second pass, resolving symbols
- Generate relocations for external references
- Output: raw machine code bytes

---

## Critical Decisions You'll Make

### 1. Displacement Size Selection

**Decision**: When encoding memory addressing, choose smallest displacement that fits

```rust
fn encode_displacement(offset: i32) -> Vec<u8> {
  if offset == 0 {
    vec![]  // No displacement, Mod=00
  } else if offset >= -128 && offset <= 127 {
    vec![offset as u8]  // 8-bit, Mod=01
  } else {
    // 32-bit, Mod=10
    vec![(offset & 0xFF) as u8, ((offset >> 8) & 0xFF) as u8, ...]
  }
}
```

### 2. Immediate Size Selection

**Decision**: Use smallest immediate that fits (imm8 < imm32 < imm64)

```rust
fn select_immediate_form(instruction: &str, value: u64) -> (u8, Vec<u8>) {
  match instruction {
    "add" | "sub" | "and" | "or" | "xor" => {
      if value <= 0xFF {
        (OPCODE_IMM8, vec![value as u8])
      } else {
        (OPCODE_IMM32, little_endian_u32(value))
      }
    }
    "mov" => {
      if value <= 0xFFFFFFFF {
        (OPCODE_MOV_IMM32, little_endian_u32(value))
      } else {
        (OPCODE_MOVABS_IMM64, little_endian_u64(value))
      }
    }
  }
}
```

### 3. Label Resolution Strategy

**Decision**: Two-pass assembly (record positions, then resolve)

```rust
// Pass 1: Determine code offsets
let mut symbols = Map::new()
let mut offset = 0
for line in assembly {
  if let Some(label) = &line.label {
    symbols[label] = offset
  }
  offset += estimate_instruction_size(&line)
}

// Pass 2: Encode with known offsets
let mut code = Vec::new()
for line in assembly {
  let bytes = encode_instruction(&line, &symbols)
  code.extend(bytes)
}
```

### 4. SIB Byte Generation

**Decision**: When r/m=4 (SIB required), automatically build SIB byte

```rust
fn encode_addressing_mode(base: &str, index: Option<&str>, scale: u8) -> (Vec<u8>, Option<Vec<u8>>) {
  let base_code = register_code(base)

  if index.is_some() || base == "rsp" {
    // Need SIB
    let sib = encode_sib(base, index, scale)
    (vec![ModR/M with r/m=4], Some(vec![sib]))
  } else {
    (vec![ModR/M with r/m=base_code], None)
  }
}
```

---

## Integration Points

### Input: Code Gen Agent

**Expects**:
- Stream of AssemblyInstruction signals from Code Gen
- Each instruction has mnemonic, operands, optional label/comment
- Instructions in program order
- All labels defined before use (or forward references marked)

**Interface**:
```mycelial
receive signal(asm_instruction, instr) {
  vec_push(state.assembly_lines, instr)
}

receive signal(asm_complete, ac) {
  // All instructions received, start encoding
  encode_all_instructions()
  emit machine_code(code_bytes)
}
```

### Output: Linker Agent

**Emits**:
- Machine code bytes organized by section
- Relocation table for external symbols
- Symbol table with absolute addresses
- Section metadata (`.text`, `.rodata`, etc.)

**Interface**:
```mycelial
emit machine_code {
  section: ".text",
  offset: 0,
  bytes: code_buffer,
  relocations: reloc_table
}

emit asm_complete {
  total_bytes: code_buffer.len(),
  symbol_count: symbol_table.len()
}
```

---

## Your Timeline

### Day 1: Setup & Instruction Matrix
- [ ] Understand x86-64 encoding fundamentals
- [ ] Review x86-64-instructions.md completely
- [ ] Design instruction encoding lookup tables
- [ ] Plan ModR/M, SIB, REX generation functions

### Day 2: Basic Encoding
- [ ] Implement REX prefix generation
- [ ] Implement ModR/M byte construction
- [ ] Implement SIB byte construction
- [ ] Test with simple register-to-register instructions

### Day 3: All Instruction Types
- [ ] Encode data movement instructions (mov, lea, push, pop)
- [ ] Encode arithmetic instructions (add, sub, imul, idiv)
- [ ] Encode bitwise logic instructions (and, or, xor, not, shifts)
- [ ] Encode comparison instructions (cmp, test)

### Day 4: Advanced Addressing & Jumps
- [ ] Handle all addressing modes (register, memory, SIB)
- [ ] Implement displacement encoding (8-bit, 32-bit)
- [ ] Encode control flow (jmp, conditional jumps, call, ret)
- [ ] Implement label resolution (symbol table, relocations)

### Day 5: Error Handling & Polish
- [ ] Add error handling for invalid opcodes
- [ ] Add error handling for addressing mode mismatches
- [ ] Implement size selection (choose imm8 vs imm32)
- [ ] Implement out-of-range detection and extension

### Day 6: Testing & Integration
- [ ] Write unit tests for all 48 instruction types
- [ ] Write integration tests with Code Gen output
- [ ] Test label resolution and relocations
- [ ] Test hello_world assembly → machine code
- [ ] Verify against hand-coded reference

---

## Key Files to Reference

**Instruction Reference**:
- `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/x86-64-instructions.md` - Complete encoding for all 48 instructions

**ABI Reference**:
- `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/system-v-abi.md` - Calling conventions, register usage
- `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/elf-format.md` - ELF64 format for sections

**Code Gen Output**:
- `/home/lewey/Desktop/mycelial-compiler/compiler/x86_codegen.mycelial` - Assembly generation code

**Test Programs**:
- `/home/lewey/Desktop/mycelial-compiler/examples/hand-coded/hello-x86-64.asm` - Validation reference
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/examples/*.mycelial` - All 6 test programs

---

## Important Notes

### About Machine Code Validation

The assembly you encode **must** be bit-perfect. Unlike higher-level compilation, there's no tolerance here—every bit matters.

**Validate your encoding**:
1. Encode an instruction
2. Disassemble it with `objdump` or `ndisasm`
3. Verify mnemonic and operands match original

```bash
# Example: encode "mov rax, rbx"
echo "48 89 D8" | xxd -r | objdump -D -b binary -m i386:x86-64

# Should output: mov %rbx,%rax
```

### About REX Prefix Rules

**Key rule**: REX is only needed if:
- 64-bit operand required (W=1)
- OR extended registers (r8-r15) used (R, X, B bits)

**Do NOT emit REX if**:
- 32-bit operand, no extended registers
- Many 32-bit instructions don't need REX

### About ModR/M Encoding

**Critical detail**: The ModR/M byte encoding depends on:
1. Whether memory addressing is used (Mod field)
2. Which register is the register operand (Reg field)
3. Which register/memory is the r/m operand (R/M field)

Get the field mappings wrong and the CPU decodes the instruction incorrectly.

### About Symbol Resolution

The Linker will patch all relocations **after** assembly. Your job is to:
1. Generate correct placeholder bytes for symbol references
2. Record relocation information (offset, symbol, type)
3. Let Linker fill in actual addresses later

---

## Success = M1 Week 10 Complete

When you're done:
- ✅ Assembler successfully implemented in Mycelial
- ✅ All 48 instructions encode correctly
- ✅ All addressing modes supported
- ✅ Label resolution working
- ✅ Relocation table generated
- ✅ Machine code bytes correct (validated against reference)
- ✅ Linker ready to receive machine code

Linker agent can then proceed with Week 11 work (ELF generation).

---

## Remember

You've already proven you can:
- Understand complex x86-64 architecture (code gen design)
- Implement sophisticated algorithms (register allocation)
- Handle intricate encoding details (x86-64 instruction selection)
- Write clean, testable Mycelial code (Code Gen + Parser agents)

**The Assembler is just precision encoding** - same skills, final transformation.

Machine code encoding is deterministic: bytes in, bytes out. No ambiguity. Either it's correct or it's not.

---

## Final Thought

The Assembler is where **abstract architecture becomes concrete bytes**. Every bit you encode will eventually run on real hardware. Make it precise. Make it beautiful. Make it the bridge from human intent to machine execution.

🚀

---

**Prepared by**: Haiku (Chief Operations Officer)
**Date**: 2026-01-01
**Role**: Assembler Agent Owner (Week 10 of M1)
**Status**: Ready to Begin

---

**Next Steps**:
1. Read this brief completely
2. Study x86-64-instructions.md thoroughly
3. Review System V ABI calling conventions
4. Design instruction encoding lookup tables
5. Implement REX, ModR/M, SIB generation
6. Encode all 48 instruction types
7. Test with Code Gen output
8. Validate against hand-coded reference
9. Deliver to Linker agent

Ready? Let's build the Assembler. 🧬
