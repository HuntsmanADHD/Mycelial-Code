# Linker Agent Briefing - Opus

**From**: Haiku (Chief Operations Officer)
**Date**: 2026-01-01
**Subject**: M1 Week 11 - Linker Agent Implementation
**Duration**: Week 11 of M1

---

## Your Final Assignment

After the Code Generator, Parser, and Assembler agents, you're now being assigned the **Linker Agent** for M1 Week 11.

This is the final transformation in the compilation pipeline: converting machine code bytes and relocations into a complete, executable ELF64 binary that the OS can load and run.

---

## Why Linker Comes Last

**Pipeline Dependency**:
```
Week 9: Code Generator Agent (produces x86-64 assembly)
  ↓ (x86-64 ASM)
Week 10: Assembler Agent (produces machine code bytes)
  ↓ (Machine code + relocations + symbols)
Week 11: Linker Agent ← YOUR FINAL ROLE (produce ELF executable)
  ↓ (ELF64 executable binary)
OS Kernel (execute binary)
```

**You're the final link** between compiled machine code and executable binaries.

---

## What the Linker Does

**Input**: Machine code bytes, relocations, and symbols from Assembler
```
.text section (machine code):
  48 89 C7                    # mov rdi, rax
  E8 00 00 00 00             # call runtime_format_string (needs relocation)

Relocation table:
  offset=10, symbol=runtime_format_string, type=R_X86_64_PC32

Symbol table:
  runtime_format_string → (external, needs runtime)
```

**Output**: ELF64 executable binary
```bash
$ file hello
hello: ELF 64-bit LSB executable, x86-64, version 1 (SYSV),
       statically linked, no strip
$ ./hello
Hello, World!
```

**Job**:
1. Arrange sections in executable format with proper alignment
2. Apply relocations (fill in absolute and relative addresses)
3. Generate ELF headers and program headers
4. Create executable binary the OS can load

---

## ELF64 Binary Format Reference

**Complete Reference**: `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/elf-format.md`

### Overall Structure

```
┌─────────────────────────────────────┐
│ ELF Header (64 bytes)               │  Offset: 0x0
│ - Magic: 0x7F 'ELF'                │
│ - Class, Data, Version              │
│ - Machine (x86-64 = 0x3E)          │
│ - Entry point address               │
│ - Offsets to program/section headers│
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Program Headers (32 bytes each)     │  For OS loader
│ - Type (LOAD, DYNAMIC, NOTE)        │
│ - Offset in file, size in file      │
│ - Virtual address, size in memory   │
│ - Flags (readable, writable, exec)  │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ .text Section (machine code)        │
│ - Executable, read-only             │
│ - Contains compiled Mycelial rules   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ .rodata Section (read-only data)    │
│ - Constant strings                  │
│ - Literal data                      │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ .data Section (initialized data)    │
│ - Global variables with values      │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ .bss Section (uninitialized data)   │
│ - Zero-filled at runtime            │
│ - Doesn't take space in file        │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Symbol Table (.symtab)              │
│ - Label addresses                   │
│ - External function references      │
│ - Symbol metadata                   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Relocation Table (.rela.text)       │
│ - Address fixups needed              │
│ - References to external symbols    │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Section Headers                     │
│ - Section metadata                  │
│ - Names, flags, offsets             │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ String Table (.shstrtab)            │
│ - Section names (null-terminated)   │
└─────────────────────────────────────┘
```

---

## ELF Header Structure (64 bytes)

```
Offset  Size  Name                Value/Description
─────────────────────────────────────────────────────
0x00    4     e_ident[EI_MAG]     0x7F, 'E', 'L', 'F'
0x04    1     e_ident[EI_CLASS]   1 (32-bit) or 2 (64-bit)
0x05    1     e_ident[EI_DATA]    1 (little-endian) or 2 (big-endian)
0x06    1     e_ident[EI_VERSION] 1 (current version)
0x07    1     e_ident[EI_OSABI]   0 (System V ABI)
0x08    8     e_ident[padding]    zeros
0x10    2     e_type              2 (ET_EXEC - executable)
0x12    2     e_machine           62 (0x3E for x86-64)
0x14    4     e_version           1 (current version)
0x18    8     e_entry             Entry point address (where to start)
0x20    8     e_phoff             Offset to program headers
0x28    8     e_shoff             Offset to section headers
0x30    4     e_flags             0 (no flags for x86-64)
0x34    2     e_ehsize            64 (this header is 64 bytes)
0x36    2     e_phentsize         56 (program header entry size)
0x38    2     e_phnum             Number of program headers
0x3A    2     e_shentsize         64 (section header entry size)
0x3C    2     e_shnum             Number of section headers
0x3E    2     e_shstrndx          Index of string table section
```

### ELF Header Example

For hello_world.mycelial compiled:
```
Magic:          0x7F 'ELF'
Class:          64-bit (value 2)
Data:           Little-endian (value 1)
Version:        1
OSABI:          System V (value 0)
Type:           ET_EXEC (executable)
Machine:        x86-64 (value 62 = 0x3E)
Entry point:    0x400000 (start of .text in memory)
Program headers: at offset 0x40 (right after ELF header)
Section headers: at offset 0x1000 (after sections)
```

---

## Program Headers (for OS Loader)

Each program header is 56 bytes:

```
Offset  Size  Name        Description
─────────────────────────────────────────────────
0x00    4     p_type      1=LOAD, 2=DYNAMIC, 3=INTERP, 4=NOTE
0x04    4     p_flags     1=X(execute), 2=W(write), 4=R(read)
0x08    8     p_offset    Offset in file
0x10    8     p_vaddr     Virtual address in memory
0x18    8     p_paddr     Physical address (same as vaddr on Linux)
0x20    8     p_filesz    Size in file
0x28    8     p_memsz     Size in memory
0x30    8     p_align     Alignment (must be power of 2, typically 0x1000)
```

### Program Header Example

For executable hello_world:

**Program Header 0 (Load .text + .rodata)**:
```
p_type:     LOAD (executable code)
p_flags:    PF_R | PF_X (readable, executable)
p_offset:   0x1000 (in file)
p_vaddr:    0x400000 (in memory, standard x86-64 base)
p_paddr:    0x400000
p_filesz:   0x1000 (1 page)
p_memsz:    0x1000
p_align:    0x1000 (4KB page alignment)
```

---

## Section Layout Strategy

### Standard Mycelial Program Layout

**File Layout** (what gets written to disk):
```
Offset      Size    Section         Purpose
────────────────────────────────────────────────
0x0         64      ELF Header      Executable metadata
0x40        56      Program Headers OS loader instructions
0x100       ???     .text           Compiled machine code
0x1000      ???     .rodata         String constants
0x2000      ???     .data           Initialized globals
(none)      ???     .bss            Zero-filled at runtime
0x3000      ???     .symtab         Symbol table
0x4000      ???     .rela.text      Relocations for .text
0x5000      ???     .shstrtab       Section name strings
0x5100      ???     Section Headers Section metadata
```

**Memory Layout** (what kernel loads):
```
Virtual Address    Section         Permissions
─────────────────────────────────────────────────
0x400000           .text           R + X (read + execute)
0x401000           .rodata         R (read only)
0x402000           .data           R + W (read + write)
0x403000           .bss            R + W
0x404000+          Stack           R + W
```

### Alignment Rules

**Section Alignment**:
- `.text`: 16-byte alignment (cache line)
- `.rodata`: 8-byte alignment
- `.data`: 8-byte alignment
- `.bss`: no alignment requirement (not in file)

**Page Alignment** (for memory segments):
- Programs load into memory at page boundaries (0x1000 = 4096 bytes)
- All LOAD program headers must align to page size

---

## Relocation Types

The Assembler generated relocations that need fixing up. Apply them here:

### Common x86-64 Relocation Types

| Type | Value | Name | Use Case | Calculation |
|------|-------|------|----------|-------------|
| 0 | R_X86_64_NONE | No relocation | Placeholder | – |
| 1 | R_X86_64_64 | 64-bit absolute | Direct address | S + A |
| 2 | R_X86_64_PC32 | PC-relative 32-bit | Calls, jumps | S + A - P |
| 5 | R_X86_64_COPY | Copy relocation | Shared objects | – |
| 6 | R_X86_64_GLOB_DAT | Global data | Shared objects | S |
| 7 | R_X86_64_JUMP_SLOT | Lazy binding | Shared objects | S |

**Legend**:
- `S` = symbol value (absolute address)
- `A` = addend (displacement encoded in relocation)
- `P` = place (address of relocation in section)

### Example Relocations

**For a call to runtime_format_string**:
```
Relocation: offset=0x5A, symbol=runtime_format_string, type=R_X86_64_PC32

Before patching:
  40059A: E8 00 00 00 00    call 0x40059F (placeholder)

Symbol address: 0x600000 (runtime function)
Relocation address: 0x40059A + 4 (after call instruction) = 0x40059E

Calculation: S + A - P = 0x600000 + 0 - 0x40059E = 0x1FFA62

After patching:
  40059A: E8 62 A6 FF FF    call 0x600000 (PC-relative)
```

---

## Implementation Requirements

### 1. Input Processing

Accept signals from Assembler:

```mycelial
receive signal(machine_code, mc) {
  // Machine code bytes for a section
  vec_push(state.sections[mc.section], mc)
}

receive signal(relocation, rel) {
  // Record relocation for later application
  vec_push(state.relocations, rel)
}

receive signal(symbol_def, sym) {
  // Record symbol and its address
  state.symbol_table[sym.name] = sym.address
}

receive signal(asm_complete, ac) {
  // All input received, start linking
  link_executable()
}
```

### 2. Section Collection

Group machine code by section:

```mycelial
state.sections: Map<String, Vec<u8>>  // ".text" -> bytes, ".rodata" -> bytes
state.relocations: Vec<Relocation>
state.symbol_table: Map<String, u32>

// During linking:
text_bytes = state.sections[".text"]
rodata_bytes = state.sections[".rodata"]
data_bytes = state.sections[".data"]
bss_size = state.sections[".bss"].len()
```

### 3. Layout Calculation

Determine final addresses:

```mycelial
// Memory layout starting at 0x400000
BASE_ADDRESS = 0x400000
PAGE_SIZE = 0x1000

text_offset = 0x1000
text_address = BASE_ADDRESS + text_offset
text_size = round_up(text_bytes.len(), 0x10)

rodata_offset = text_offset + text_size
rodata_address = BASE_ADDRESS + rodata_offset
rodata_size = round_up(rodata_bytes.len(), 0x8)

data_offset = rodata_offset + rodata_size
data_address = BASE_ADDRESS + data_offset
data_size = round_up(data_bytes.len(), 0x8)

bss_address = BASE_ADDRESS + data_offset + data_size
bss_size = state.sections[".bss"].len()

// Entry point is start of .text
entry_point = text_address
```

### 4. Relocation Application

Apply all relocations using their addresses:

```mycelial
for relocation in state.relocations {
  symbol_addr = state.symbol_table[relocation.symbol]
  reloc_addr = text_address + relocation.offset

  match relocation.reloc_type {
    "R_X86_64_PC32" => {
      // PC-relative 32-bit
      // Calculation: S + A - P
      // S = symbol address, A = addend (usually 0), P = relocation address + 4
      next_instr = reloc_addr + 4
      value = symbol_addr - next_instr

      // Patch 4 bytes at reloc_addr
      text_bytes[relocation.offset:offset+4] = little_endian_u32(value)
    }
    "R_X86_64_64" => {
      // 64-bit absolute address
      text_bytes[relocation.offset:offset+8] = little_endian_u64(symbol_addr)
    }
  }
}
```

### 5. Symbol Table Generation

Create symbol table entries:

```mycelial
struct SymbolTableEntry {
  st_name: u32,          // Offset in string table
  st_info: u8,           // Bind (upper nibble), type (lower nibble)
  st_other: u8,          // Visibility
  st_shndx: u16,         // Section index
  st_value: u64,         // Address
  st_size: u64           // Size
}

// For each symbol:
symtab_entry {
  st_name: offset_in_strtab("symbol_name"),
  st_info: bind | type,  // GLOBAL (1) | FUNC (2), or LOCAL (0) | NOTYPE (0)
  st_other: 0,           // Default visibility
  st_shndx: section_index(".text"),
  st_value: symbol_address,
  st_size: 0             // Unknown size for external symbols
}
```

### 6. ELF Header Generation

Create the main header:

```mycelial
fn create_elf_header(
  entry: u64,
  prog_header_offset: u64,
  section_header_offset: u64,
  section_count: u32,
  strtab_section_idx: u32
) -> Vec<u8> {
  let mut header = vec![0u8; 64]

  // Magic
  header[0:4] = [0x7F, 'E', 'L', 'F']

  // Class: 64-bit (2)
  header[4] = 2

  // Data: Little-endian (1)
  header[5] = 1

  // Version: 1
  header[6] = 1

  // OSABI: System V (0)
  header[7] = 0

  // Type: ET_EXEC (2) - executable file
  header[16:18] = little_endian_u16(2)

  // Machine: x86-64 (62 = 0x3E)
  header[18:20] = little_endian_u16(62)

  // Version: 1
  header[20:24] = little_endian_u32(1)

  // Entry point
  header[24:32] = little_endian_u64(entry)

  // Offset to program headers
  header[32:40] = little_endian_u64(prog_header_offset)

  // Offset to section headers
  header[40:48] = little_endian_u64(section_header_offset)

  // Flags: 0
  header[48:52] = [0, 0, 0, 0]

  // ELF header size: 64
  header[52:54] = little_endian_u16(64)

  // Program header size: 56
  header[54:56] = little_endian_u16(56)

  // Number of program headers
  header[56:58] = little_endian_u16(program_header_count)

  // Section header size: 64
  header[58:60] = little_endian_u16(64)

  // Number of section headers
  header[60:62] = little_endian_u16(section_count)

  // Index of string table section
  header[62:64] = little_endian_u16(strtab_section_idx)

  header
}
```

### 7. Section Headers Generation

Create metadata for each section:

```mycelial
struct SectionHeader {
  sh_name: u32,        // Offset in string table
  sh_type: u32,        // Type (1=PROGBITS, 3=STRTAB, 4=RELA, etc.)
  sh_flags: u64,       // Flags (1=WRITE, 2=ALLOC, 4=EXECINSTR)
  sh_addr: u64,        // Address in memory
  sh_offset: u64,      // Offset in file
  sh_size: u64,        // Size in bytes
  sh_link: u32,        // Link to related section
  sh_info: u32,        // Extra info
  sh_addralign: u64,   // Alignment
  sh_entsize: u64      // Entry size (if fixed-size entries)
}

// Example: .text section
section_header {
  sh_name: offset_in_strtab(".text"),
  sh_type: 1,          // PROGBITS (actual code/data)
  sh_flags: 6,         // ALLOC | EXECINSTR
  sh_addr: text_address,
  sh_offset: text_file_offset,
  sh_size: text_size,
  sh_link: 0,          // No related section
  sh_info: 0,
  sh_addralign: 0x10,  // 16-byte alignment
  sh_entsize: 0        // Variable size
}
```

### 8. Program Headers Generation

Create loader instructions:

```mycelial
struct ProgramHeader {
  p_type: u32,      // 1=LOAD, 2=DYNAMIC, 3=INTERP, 4=NOTE
  p_flags: u32,     // 1=X, 2=W, 4=R
  p_offset: u64,    // Offset in file
  p_vaddr: u64,     // Virtual address
  p_paddr: u64,     // Physical address
  p_filesz: u64,    // Size in file
  p_memsz: u64,     // Size in memory
  p_align: u64      // Alignment
}

// LOAD segment for code
program_header {
  p_type: 1,                           // LOAD
  p_flags: 5,                          // R | X (readable, executable)
  p_offset: text_file_offset,
  p_vaddr: text_address,
  p_paddr: text_address,
  p_filesz: text_size,
  p_memsz: text_size,
  p_align: 0x1000                      // Page alignment
}
```

### 9. String Table Generation

Create null-terminated section names:

```mycelial
// String table for section names
strtab_data = ""
strtab_data += "\0"                    // Index 0: empty (reserved)
offset = 1

sections = [".text", ".rodata", ".data", ".bss", ".symtab", ".rela.text", ".shstrtab"]

for section in sections {
  section_offsets[section] = offset
  strtab_data += section + "\0"
  offset += section.len() + 1
}

// Use section_offsets[section_name] as sh_name values in section headers
```

### 10. Output Generation

Write the complete ELF binary:

```mycelial
fn write_elf_binary(
  filename: String,
  elf_header: Vec<u8>,
  program_headers: Vec<Vec<u8>>,
  sections: Map<String, Vec<u8>>,
  section_headers: Vec<Vec<u8>>,
  strtab_data: Vec<u8>
) {
  let mut file_contents = Vec::new()

  // Write ELF header
  file_contents.extend(elf_header)

  // Write program headers
  for ph in program_headers {
    file_contents.extend(ph)
  }

  // Write sections
  file_contents.extend(sections[".text"])
  file_contents.extend(sections[".rodata"])
  file_contents.extend(sections[".data"])
  // .bss not written to file

  // Write symbol table
  file_contents.extend(symtab_bytes)

  // Write relocation table
  file_contents.extend(relocs_bytes)

  // Write string table
  file_contents.extend(strtab_data)

  // Write section headers
  for sh in section_headers {
    file_contents.extend(sh)
  }

  // Write to file
  write_file(filename, file_contents)
}
```

---

## AST Node Structure

Define these in Mycelial:

```mycelial
ELFHeader {
  magic: [u8; 4],
  class: u8,              // 1=32-bit, 2=64-bit
  data: u8,               // 1=little-endian, 2=big-endian
  version: u8,
  osabi: u8,
  type_: u16,             // 2=executable
  machine: u16,           // 62=x86-64
  entry: u64,
  phoff: u64,
  shoff: u64,
  flags: u32,
  ehsize: u16,
  phentsize: u16,
  phnum: u16,
  shentsize: u16,
  shnum: u16,
  shstrndx: u16
}

ProgramHeader {
  type_: u32,
  flags: u32,
  offset: u64,
  vaddr: u64,
  paddr: u64,
  filesz: u64,
  memsz: u64,
  align: u64
}

SectionHeader {
  name: u32,
  type_: u32,
  flags: u64,
  addr: u64,
  offset: u64,
  size: u64,
  link: u32,
  info: u32,
  addralign: u64,
  entsize: u64
}

SymbolTableEntry {
  name: u32,
  info: u8,
  other: u8,
  shndx: u16,
  value: u64,
  size: u64
}

RelocationEntry {
  offset: u64,
  info: u64,
  addend: i64
}
```

---

## Success Criteria

✅ **Correctness**:
- ELF header generation (all 64 bytes, all fields)
- Program headers for OS loader
- Section headers metadata
- Symbol table with proper entries
- Relocation application (PC-relative and absolute)
- String tables (.shstrtab for section names)

✅ **Completeness**:
- Link hello_world machine code to executable
- Apply all relocations from Assembler
- Generate proper memory layout (0x400000 base)
- Create executable with proper entry point
- All sections aligned correctly

✅ **Error Handling**:
- Report missing symbols
- Detect relocation errors
- Validate section alignment
- Check for address overflow

✅ **Integration**:
- Consume machine code from Assembler Agent
- Generate ELF executable binary
- Interface with kernel loader (valid ELF format)
- Integration test with hello_world.mycelial

---

## Testing Strategy

### Unit Tests (by component)

```
test_elf_header_generation()        // 64-byte header
test_program_header_generation()    // Loader headers
test_section_header_generation()    // Section metadata
test_symbol_table_generation()      // Symbol entries
test_string_table_generation()      // Null-terminated strings
test_relocation_pc32()              // PC-relative fixups
test_relocation_absolute()          // Absolute address fixups
test_section_layout()               // Address calculation
test_alignment_enforcement()        // Padding rules
test_memory_mapping()               // Virtual address layout
```

### Integration Tests

```
test_hello_world_linking()          // Full pipeline: Assembler → Linker → binary
test_executable_validity()          // Binary has valid ELF header
test_entry_point_correct()          // Binary starts at correct address
test_relocation_patching()          // Relocations properly applied
test_runnable_binary()              // Binary can be executed (if on x86-64 Linux)
```

### Validation

Execute the generated binary and verify:
- Runs without segfault
- Produces correct output
- Matches interpreter behavior

```bash
./hello
# Expected output: "Hello, World!"
```

---

## Reference Implementation

**Existing ELF Reference**:
- `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/elf-format.md` - ELF64 format specification

**x86-64 System V ABI**:
- `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/system-v-abi.md` - ABI calling conventions, address space layout

**Hand-coded Reference Binary**:
- `/home/lewey/Desktop/mycelial-compiler/examples/hand-coded/hello-x86-64.asm` - Compare generated with hand-written

**Algorithm Reference**:
- Two-pass linking (calculate addresses, then relocate)
- Section layout with alignment
- Symbol resolution
- Relocation application

---

## Critical Decisions You'll Make

### 1. Base Address Selection

**Decision**: Where in virtual memory does the executable load?

Standard Linux x86-64:
- `0x400000` - text (code)
- `0x600000` - data (writable)

```rust
fn choose_base_address() -> u64 {
  0x400000  // Standard position-independent executable base
}
```

### 2. Section Ordering

**Decision**: What order do sections go in the file?

Standard order (mimics ld.so):
1. ELF header
2. Program headers
3. .text section
4. .rodata section
5. .data section
6. Symbol table
7. Relocations
8. Section headers (at end)
9. String tables

### 3. Alignment Handling

**Decision**: How much padding between sections?

```rust
fn align_up(value: u64, align: u64) -> u64 {
  ((value + align - 1) / align) * align
}

// .text at 0x1000, size 0x500
// Align to 0x10 (16 bytes)
next_offset = align_up(0x1000 + 0x500, 0x10)  // = 0x1510

// .rodata follows at 0x1510
```

### 4. Symbol Visibility

**Decision**: Which symbols are global vs local?

- **Global**: Callable from other code (runtime_format_string)
- **Local**: Private to this executable (internal labels)

```rust
st_info = (bind << 4) | type_
// bind: 0=LOCAL, 1=GLOBAL, 2=WEAK
// type_: 0=NOTYPE, 2=FUNC, 1=OBJECT
```

### 5. Relocation Selection

**Decision**: Which relocation type for each reference?

- **R_X86_64_PC32**: Relative addresses (calls, jumps)
- **R_X86_64_64**: Absolute addresses (data pointers)

The Assembler tells you which type; you just apply them.

---

## Integration Points

### Input: Assembler Agent

**Expects**:
- Machine code bytes in `.text` section
- String constants in `.rodata` section
- Relocation table with symbol references
- Symbol definitions with addresses

**Interface**:
```mycelial
receive signal(machine_code, mc) {
  // mc.section: ".text" or ".rodata"
  // mc.bytes: Vec<u8>
  // mc.offset: position within section
}

receive signal(relocation, rel) {
  // rel.offset: position in .text
  // rel.symbol: "runtime_format_string"
  // rel.reloc_type: "R_X86_64_PC32"
}

receive signal(symbol_def, sym) {
  // sym.name: "main", "runtime_format_string"
  // sym.address: absolute address
}

receive signal(asm_complete, ac) {
  // All input received, start linking
  link_and_write_binary()
}
```

### Output: Binary File

**Produces**:
- ELF64 executable binary file
- Proper headers and sections
- Relocations applied
- Ready to execute

**File Format**:
```bash
$ file hello
hello: ELF 64-bit LSB executable, x86-64, version 1 (SYSV),
       statically linked, no strip

$ ./hello
Hello, World!
```

---

## Your Timeline

### Day 1: ELF Fundamentals & Header Generation
- [ ] Study ELF64 format completely (elf-format.md)
- [ ] Understand program vs section headers
- [ ] Design ELF header generation function
- [ ] Design section header templates
- [ ] Implement magic number and fixed fields

### Day 2: Section Layout & Memory Mapping
- [ ] Calculate section offsets (alignment-aware)
- [ ] Assign virtual addresses (0x400000 base)
- [ ] Generate program headers for loader
- [ ] Implement address calculation logic
- [ ] Handle .bss section (no file space)

### Day 3: Symbol Table & String Table
- [ ] Create symbol table structure
- [ ] Implement string table generation
- [ ] Handle symbol visibility (global vs local)
- [ ] Create relocation entries
- [ ] Build symbol lookup tables

### Day 4: Relocation Application
- [ ] Understand R_X86_64_PC32 (relative)
- [ ] Understand R_X86_64_64 (absolute)
- [ ] Implement relocation patching
- [ ] Test with simple relocations
- [ ] Verify addresses are correct

### Day 5: Binary Generation & Assembly
- [ ] Write ELF header to file
- [ ] Write sections in correct order
- [ ] Write section headers
- [ ] Write symbol and string tables
- [ ] Ensure file layout matches spec

### Day 6: Testing & Validation
- [ ] Write unit tests for each component
- [ ] Integration test: Assembler → Linker → binary
- [ ] Verify binary is valid ELF
- [ ] Test with readelf/objdump
- [ ] Run executable and verify output
- [ ] Debug any segfaults or address issues

---

## Key Files to Reference

**ELF Specification**:
- `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/elf-format.md` - Complete ELF64 format reference

**System V ABI**:
- `/home/lewey/Desktop/mycelial-compiler/docs/knowledge-base/system-v-abi.md` - x86-64 calling conventions, memory layout

**Code Gen/Assembler Output**:
- `/home/lewey/Desktop/mycelial-compiler/compiler/x86_codegen.mycelial` - Assembly generation
- `/home/lewey/Desktop/mycelial-compiler/compiler/assembler.mycelial` - Machine code + relocations

**Test Programs**:
- `/home/lewey/Desktop/mycelial-compiler/examples/hand-coded/hello-x86-64.asm` - Hand-written reference
- `/home/lewey/Desktop/MyLanguage/05-TOOLS/simulator/examples/*.mycelial` - All test programs

---

## Important Notes

### About ELF Format

ELF (Executable and Linkable Format) is the industry standard for executable binaries on Linux, Unix, and many embedded systems.

**Key properties**:
- Designed for linking and loading
- Separates code (.text) from data (.rodata, .data)
- Symbol table enables linking separate modules
- Program headers guide OS loader
- Section headers enable debuggers and tools

### About Relocations

Machine code generated by the Assembler contains placeholder addresses for external symbols (like runtime_format_string). Your job is to **fill in the real addresses**.

For example:
```
Original: E8 00 00 00 00  (call runtime_format_string, needs relocation)
After:    E8 62 A6 FF FF  (call with correct PC-relative offset)
```

### About Memory Layout

The OS kernel will load your ELF binary into memory starting at address 0x400000 (on Linux x86-64). Relative addresses in your code are calculated from this base address.

```
Virtual Memory Layout:
0x400000 ← .text starts here (entry point)
0x401000 ← .rodata starts here
0x402000 ← .data starts here
...
0x600000+ ← Data segment
...
```

### About Entry Point

The entry point (e_entry in ELF header) must point to the first instruction of your compiled code (start of .text section). When the OS loads the binary, it jumps to this address to start execution.

---

## Success = M1 Week 11 Complete

When you're done:
- ✅ Linker successfully implemented in Mycelial
- ✅ ELF headers generated correctly
- ✅ Sections laid out with proper alignment
- ✅ Symbol table created
- ✅ Relocations applied
- ✅ Binary is valid ELF64 executable
- ✅ Binary executes correctly

Full pipeline complete: **Source Code → Executable Binary**

---

## Remember

You've already proven you can:
- Understand complex x86-64 architecture (Code Gen + Assembler)
- Implement sophisticated algorithms (register allocation, instruction encoding)
- Handle intricate binary formats (machine code, relocations)
- Write clean, testable Mycelial code (Parser, Code Gen, Assembler)

**The Linker is the final puzzle** - same skills, final transformation.

You're one week away from a complete, working compiler written in Mycelial.

This is the moment where abstract symbols become concrete executable code that runs on real hardware.

Make it beautiful. Make it correct. Make it the bridge from compilation to execution.

🚀

---

## Final Thought

The Linker is where **all the pieces come together**. Machine code becomes a living executable that transforms source files into running processes.

You've built the parser (syntax), the IR generator (semantics), the code generator (instruction selection), the assembler (machine code). Now build the final link in the chain.

When this is done, you'll have created something extraordinary: **A compiler written in the language it compiles, generating direct machine code without any C intermediate step.**

That's unprecedented. That's beautiful.

Let's finish this. 🧬

---

**Prepared by**: Haiku (Chief Operations Officer)
**Date**: 2026-01-01
**Role**: Linker Agent Owner (Week 11 of M1) - FINAL AGENT
**Status**: Ready to Begin

---

**Next Steps**:
1. Read this brief completely
2. Study elf-format.md thoroughly
3. Review System V ABI memory layout
4. Design ELF header generation
5. Implement section layout with alignment
6. Create symbol and string tables
7. Implement relocation application
8. Generate binary file
9. Test with hello_world output
10. Deliver complete executable

Ready? Let's build the final agent. 🎉
