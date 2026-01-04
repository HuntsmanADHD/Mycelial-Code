# ELF64 Format Reference

**Owner**: Opus (Claude Opus 4.5)
**Status**: COMPLETE
**Version**: 1.0
**Purpose**: Complete reference for generating Linux ELF64 executables in the Mycelial compiler

---

## Overview

ELF (Executable and Linkable Format) is the standard binary format on Linux and most Unix systems. This document covers everything needed to generate working ELF64 executables from machine code.

**Goal:** Given raw x86-64 machine code and data, produce a valid executable file.

---

## 1. ELF Structure Overview

### File Layout

```
┌──────────────────────────────────────┐ Offset 0
│ ELF Header (64 bytes)                │
├──────────────────────────────────────┤ Offset 64
│ Program Header Table                 │
│  - Entry 0: PT_LOAD (code segment)   │ 56 bytes each
│  - Entry 1: PT_LOAD (data segment)   │
├──────────────────────────────────────┤
│ .text Section (machine code)         │
├──────────────────────────────────────┤
│ .rodata Section (read-only data)     │
├──────────────────────────────────────┤
│ .data Section (initialized data)     │
├──────────────────────────────────────┤
│ Section Header Table (optional)      │
└──────────────────────────────────────┘
```

### Key Concepts

**Segments vs Sections:**
- **Segments** (Program Headers): Used at runtime - what to load into memory
- **Sections** (Section Headers): Used for linking/debugging - optional for execution

---

## 2. ELF Header

The ELF header is always 64 bytes for ELF64.

### Structure

```c
typedef struct {
    unsigned char e_ident[16];    // Magic number and identification
    uint16_t      e_type;         // Object file type
    uint16_t      e_machine;      // Machine architecture
    uint32_t      e_version;      // Object file version
    uint64_t      e_entry;        // Entry point virtual address
    uint64_t      e_phoff;        // Program header table offset
    uint64_t      e_shoff;        // Section header table offset
    uint32_t      e_flags;        // Processor-specific flags
    uint16_t      e_ehsize;       // ELF header size
    uint16_t      e_phentsize;    // Program header entry size
    uint16_t      e_phnum;        // Number of program headers
    uint16_t      e_shentsize;    // Section header entry size
    uint16_t      e_shnum;        // Number of section headers
    uint16_t      e_shstrndx;     // Section name string table index
} Elf64_Ehdr;
```

### Field Details

#### e_ident (16 bytes)

| Offset | Name | Value | Description |
|--------|------|-------|-------------|
| 0-3 | EI_MAG | `7F 45 4C 46` | Magic: `\x7FELF` |
| 4 | EI_CLASS | `02` | 64-bit |
| 5 | EI_DATA | `01` | Little-endian |
| 6 | EI_VERSION | `01` | ELF version 1 |
| 7 | EI_OSABI | `00` | SYSV / Linux |
| 8-15 | EI_PAD | `00...` | Padding (zeros) |

#### Key Fields

| Field | Value | Description |
|-------|-------|-------------|
| e_type | 2 (ET_EXEC) | Executable file |
| e_machine | 0x3E (62) | AMD x86-64 |
| e_version | 1 | Always 1 |
| e_entry | varies | Entry point address |
| e_phoff | 64 | Program headers start |
| e_ehsize | 64 | Header size |
| e_phentsize | 56 | Program header size |

### Binary Layout (Hex)

```
Offset  Bytes              Description
0x00    7F 45 4C 46        Magic: \x7FELF
0x04    02                 Class: 64-bit
0x05    01                 Endian: Little
0x06    01                 Version: 1
0x07    00                 OS/ABI: SYSV
0x08    00 00 00 00 00 00 00 00  Padding
0x10    02 00              Type: Executable
0x12    3E 00              Machine: x86-64
0x14    01 00 00 00        Version: 1
0x18    XX XX XX XX XX XX XX XX  Entry point (8 bytes)
0x20    40 00 00 00 00 00 00 00  Program header offset (64)
0x28    XX XX XX XX XX XX XX XX  Section header offset
0x30    00 00 00 00        Flags: 0
0x34    40 00              ELF header size: 64
0x36    38 00              Program header size: 56
0x38    XX 00              Program header count
0x3A    40 00              Section header size: 64
0x3C    XX 00              Section header count
0x3E    XX 00              Section name string index
```

---

## 3. Program Headers

Program headers describe memory segments to load at runtime.

### Structure

```c
typedef struct {
    uint32_t p_type;      // Segment type
    uint32_t p_flags;     // Segment flags (permissions)
    uint64_t p_offset;    // Offset in file
    uint64_t p_vaddr;     // Virtual address in memory
    uint64_t p_paddr;     // Physical address (unused)
    uint64_t p_filesz;    // Size in file
    uint64_t p_memsz;     // Size in memory
    uint64_t p_align;     // Alignment
} Elf64_Phdr;
```

**Size:** 56 bytes each

### p_type Values

| Value | Name | Description |
|-------|------|-------------|
| 0 | PT_NULL | Unused entry |
| 1 | PT_LOAD | Loadable segment |
| 2 | PT_DYNAMIC | Dynamic linking info |
| 3 | PT_INTERP | Path to interpreter |

### p_flags Values

| Value | Name | Description |
|-------|------|-------------|
| 0x1 | PF_X | Executable |
| 0x2 | PF_W | Writable |
| 0x4 | PF_R | Readable |

Common combinations:
- `0x5` (PF_R | PF_X) - Code segment
- `0x6` (PF_R | PF_W) - Data segment

### Typical Segments

**Segment 1: Code (PT_LOAD, R+X)**
```
p_type:   1 (PT_LOAD)
p_flags:  5 (PF_R | PF_X)
p_offset: File offset to .text
p_vaddr:  0x401000
p_filesz: Size of code
p_memsz:  Same as p_filesz
p_align:  0x1000 (4KB page)
```

**Segment 2: Data (PT_LOAD, R+W)**
```
p_type:   1 (PT_LOAD)
p_flags:  6 (PF_R | PF_W)
p_offset: File offset to .data
p_vaddr:  Address after code (page-aligned)
p_filesz: Size of .data
p_memsz:  p_filesz + .bss size
p_align:  0x1000 (4KB page)
```

### Address Congruence Rule

Virtual addresses must be congruent to file offsets modulo page size:

```
p_vaddr ≡ p_offset (mod p_align)
```

---

## 4. Sections

Sections organize the file for linking and debugging.

### Common Sections

| Name | Type | Flags | Description |
|------|------|-------|-------------|
| .text | SHT_PROGBITS | A+X | Executable code |
| .rodata | SHT_PROGBITS | A | Read-only data |
| .data | SHT_PROGBITS | A+W | Initialized data |
| .bss | SHT_NOBITS | A+W | Uninitialized data |
| .symtab | SHT_SYMTAB | - | Symbol table |
| .strtab | SHT_STRTAB | - | String table |
| .shstrtab | SHT_STRTAB | - | Section name strings |

### Section Flags

| Value | Name | Description |
|-------|------|-------------|
| 0x1 | SHF_WRITE | Writable |
| 0x2 | SHF_ALLOC | Loaded into memory |
| 0x4 | SHF_EXECINSTR | Executable |

---

## 5. Section Headers

### Structure

```c
typedef struct {
    uint32_t sh_name;       // Offset into .shstrtab
    uint32_t sh_type;       // Section type
    uint64_t sh_flags;      // Section flags
    uint64_t sh_addr;       // Virtual address
    uint64_t sh_offset;     // File offset
    uint64_t sh_size;       // Section size
    uint32_t sh_link;       // Link to another section
    uint32_t sh_info;       // Additional info
    uint64_t sh_addralign;  // Alignment
    uint64_t sh_entsize;    // Entry size (for tables)
} Elf64_Shdr;
```

**Size:** 64 bytes each

### sh_type Values

| Value | Name | Description |
|-------|------|-------------|
| 0 | SHT_NULL | Inactive |
| 1 | SHT_PROGBITS | Program data |
| 2 | SHT_SYMTAB | Symbol table |
| 3 | SHT_STRTAB | String table |
| 8 | SHT_NOBITS | .bss |

---

## 6. String Tables

String tables store null-terminated strings. Referenced by offset.

### Format

```
Offset 0:   \0              (empty string)
Offset 1:   . t e x t \0
Offset 7:   . d a t a \0
Offset 13:  . s h s t r t a b \0
```

### .shstrtab Example

```
00: 00                    ; Empty string
01: 2E 74 65 78 74 00     ; ".text\0"
07: 2E 64 61 74 61 00     ; ".data\0"
0D: 2E 73 68 73 74 72 74 61 62 00 ; ".shstrtab\0"
```

---

## 7. Symbol Tables

### Structure

```c
typedef struct {
    uint32_t st_name;     // Offset into .strtab
    uint8_t  st_info;     // Type and binding
    uint8_t  st_other;    // Visibility
    uint16_t st_shndx;    // Section index
    uint64_t st_value;    // Symbol value (address)
    uint64_t st_size;     // Symbol size
} Elf64_Sym;
```

**Size:** 24 bytes each

### st_info Encoding

```
st_info = (binding << 4) | type
```

**Binding:**
| Value | Name | Description |
|-------|------|-------------|
| 0 | STB_LOCAL | Local symbol |
| 1 | STB_GLOBAL | Global symbol |

**Type:**
| Value | Name | Description |
|-------|------|-------------|
| 0 | STT_NOTYPE | Unspecified |
| 1 | STT_OBJECT | Data object |
| 2 | STT_FUNC | Function |

---

## 8. Relocations

### Structure (RELA)

```c
typedef struct {
    uint64_t r_offset;    // Location to patch
    uint64_t r_info;      // Symbol and type
    int64_t  r_addend;    // Constant addend
} Elf64_Rela;
```

### Common Relocation Types

| Value | Name | Calculation |
|-------|------|-------------|
| 1 | R_X86_64_64 | S + A |
| 2 | R_X86_64_PC32 | S + A - P |

For static executables, relocations aren't needed - all addresses are known at compile time.

---

## 9. Minimal Executable

The smallest possible working ELF executable.

### Requirements

1. ELF header (64 bytes)
2. One PT_LOAD program header (56 bytes)
3. Machine code

### Layout

```
Offset  Size   Content
0x0000  64     ELF Header
0x0040  56     Program Header (PT_LOAD)
0x0078  N      Machine Code (_start)
```

Total header size: 120 bytes (0x78)

### Example: Exit with Code 42

Machine code:
```asm
_start:
    mov rdi, 42         ; Exit code
    mov rax, 60         ; sys_exit
    syscall
```

Bytes: `48 C7 C7 2A 00 00 00 48 C7 C0 3C 00 00 00 0F 05` (16 bytes)

### Complete Minimal ELF (Hex Dump)

```
; ELF Header (64 bytes)
0000: 7F 45 4C 46 02 01 01 00 00 00 00 00 00 00 00 00
0010: 02 00 3E 00 01 00 00 00 78 00 40 00 00 00 00 00
0020: 40 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0030: 00 00 00 00 40 00 38 00 01 00 00 00 00 00 00 00

; Program Header (56 bytes)
0040: 01 00 00 00 05 00 00 00 00 00 00 00 00 00 00 00
0050: 00 00 40 00 00 00 00 00 00 00 40 00 00 00 00 00
0060: 88 00 00 00 00 00 00 00 88 00 00 00 00 00 00 00
0070: 00 10 00 00 00 00 00 00

; Code (16 bytes)
0078: 48 C7 C7 2A 00 00 00    ; mov rdi, 42
007F: 48 C7 C0 3C 00 00 00    ; mov rax, 60
0086: 0F 05                   ; syscall
```

**Total size:** 136 bytes (0x88)
**Entry point:** 0x400078

---

## 10. Complete Executable

### Address Layout

```
Virtual Address    Content
0x400000          ELF header + program headers
0x401000          .text (code)
0x402000          .rodata (read-only data)
0x403000          .data (read-write data)
0x404000          .bss (uninitialized)
```

### Hello World Example

```asm
section .data
    message: db "Hello, World!", 10
    msg_len equ 14

section .text
global _start
_start:
    mov rax, 1              ; sys_write
    mov rdi, 1              ; stdout
    lea rsi, [rel message]  ; buffer
    mov rdx, 14             ; length
    syscall

    mov rax, 60             ; sys_exit
    xor rdi, rdi            ; code 0
    syscall
```

---

## 11. Generation Algorithm

### Step 1: Collect Content

```
code: Vec<u8>           // .text contents
rodata: Vec<u8>         // .rodata contents
data: Vec<u8>           // .data contents
bss_size: u64           // .bss size
entry_symbol: String    // Entry point name
```

### Step 2: Calculate Layout

```
header_size = 64                        // ELF header
phdr_size = 56 * num_segments           // Program headers
headers_end = header_size + phdr_size

code_file_offset = align_up(headers_end, 0x1000)
code_vaddr = 0x400000 + code_file_offset

data_file_offset = align_up(code_file_offset + code.len(), 0x1000)
data_vaddr = 0x400000 + data_file_offset

entry = code_vaddr + find_symbol_offset("_start")
```

### Step 3: Generate ELF Header

```
header[0..4] = [0x7F, 'E', 'L', 'F']     // Magic
header[4] = 2                            // 64-bit
header[5] = 1                            // Little-endian
header[6] = 1                            // Version
header[16..18] = 2                       // ET_EXEC
header[18..20] = 0x3E                    // x86-64
header[24..32] = entry                   // Entry point
header[32..40] = 64                      // Program header offset
header[52..54] = 64                      // Header size
header[54..56] = 56                      // Program header size
header[56..58] = num_segments            // Segment count
```

### Step 4: Generate Program Headers

```
// Code segment (PT_LOAD, R+X)
phdr1.p_type = 1
phdr1.p_flags = 5
phdr1.p_offset = code_file_offset
phdr1.p_vaddr = code_vaddr
phdr1.p_filesz = code.len()
phdr1.p_memsz = code.len()
phdr1.p_align = 0x1000

// Data segment (PT_LOAD, R+W)
phdr2.p_type = 1
phdr2.p_flags = 6
phdr2.p_offset = data_file_offset
phdr2.p_vaddr = data_vaddr
phdr2.p_filesz = data.len()
phdr2.p_memsz = data.len() + bss_size
phdr2.p_align = 0x1000
```

### Step 5: Assemble File

```
output = []
output.extend(elf_header)
output.extend(program_headers)
output.resize(code_file_offset, 0)      // Pad to code offset
output.extend(code)
output.resize(data_file_offset, 0)      // Pad to data offset
output.extend(rodata)
output.extend(data)
```

### Step 6: Write File

```
write_file(path, output)
chmod(path, 0o755)                       // Make executable
```

---

## Quick Reference

### Magic Numbers

| Field | Value | Hex |
|-------|-------|-----|
| ELF Magic | `\x7FELF` | `7F 45 4C 46` |
| 64-bit | 2 | `02` |
| Little-endian | 1 | `01` |
| ET_EXEC | 2 | `02 00` |
| EM_X86_64 | 62 | `3E 00` |
| PT_LOAD | 1 | `01 00 00 00` |

### Structure Sizes

| Structure | Size (bytes) |
|-----------|-------------|
| Elf64_Ehdr | 64 |
| Elf64_Phdr | 56 |
| Elf64_Shdr | 64 |
| Elf64_Sym | 24 |
| Elf64_Rela | 24 |

### Typical Addresses

| Segment | Virtual Address |
|---------|----------------|
| Headers | 0x400000 |
| .text | 0x401000 |
| .rodata | 0x402000 |
| .data | 0x403000 |

---

*"From bytes to binaries. The final step."*
