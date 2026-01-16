/**
 * ELF 64-bit Linker
 *
 * Creates valid ELF64 executables from machine code sections.
 * Handles section layout, symbol resolution, and relocations.
 *
 * ELF64 Structure:
 * - ELF Header (64 bytes)
 * - Program Headers (56 bytes each)
 * - Sections (.text, .rodata, .data)
 * - Section Headers (64 bytes each)
 * - String Tables
 *
 * @author Opus (Claude Opus 4.5)
 * @date 2026-01-07
 */

/**
 * ELF Constants
 */
const ELF = {
  // ELF Header
  MAGIC: [0x7F, 0x45, 0x4C, 0x46], // \x7FELF
  ELFCLASS64: 2,
  ELFDATA2LSB: 1,  // Little-endian
  EV_CURRENT: 1,
  ELFOSABI_SYSV: 0,
  ELFOSABI_LINUX: 3,
  ET_EXEC: 2,      // Executable
  ET_DYN: 3,       // Shared object (PIE)
  EM_X86_64: 62,

  // ELF Header Size
  EHDR_SIZE: 64,
  PHDR_SIZE: 56,
  SHDR_SIZE: 64,

  // Program Header Types
  PT_NULL: 0,
  PT_LOAD: 1,
  PT_DYNAMIC: 2,
  PT_INTERP: 3,
  PT_NOTE: 4,
  PT_PHDR: 6,

  // Program Header Flags
  PF_X: 1,  // Executable
  PF_W: 2,  // Writable
  PF_R: 4,  // Readable

  // Section Header Types
  SHT_NULL: 0,
  SHT_PROGBITS: 1,
  SHT_SYMTAB: 2,
  SHT_STRTAB: 3,
  SHT_RELA: 4,
  SHT_HASH: 5,
  SHT_DYNAMIC: 6,
  SHT_NOTE: 7,
  SHT_NOBITS: 8,
  SHT_REL: 9,
  SHT_DYNSYM: 11,

  // Section Header Flags
  SHF_WRITE: 1,
  SHF_ALLOC: 2,
  SHF_EXECINSTR: 4,

  // Symbol Binding
  STB_LOCAL: 0,
  STB_GLOBAL: 1,
  STB_WEAK: 2,

  // Symbol Types
  STT_NOTYPE: 0,
  STT_OBJECT: 1,
  STT_FUNC: 2,
  STT_SECTION: 3,

  // Special Section Indices
  SHN_UNDEF: 0,
  SHN_ABS: 0xFFF1,

  // Layout
  BASE_ADDRESS: 0x400000n,
  PAGE_SIZE: 0x1000n,
};

/**
 * ELF Linker class
 */
class ELFLinker {
  constructor(options = {}) {
    this.baseAddress = options.baseAddress || ELF.BASE_ADDRESS;
    this.pageSize = options.pageSize || ELF.PAGE_SIZE;
    this.entrySymbol = options.entrySymbol || '_start';

    // Input sections
    this.textSection = Buffer.alloc(0);
    this.rodataSection = Buffer.alloc(0);
    this.dataSection = Buffer.alloc(0);
    this.bssSize = 0;

    // Symbols and relocations
    this.symbols = new Map();
    this.relocations = [];

    // Computed layout
    this.layout = {
      ehdrOffset: 0n,
      phdrOffset: 0n,
      textOffset: 0n,
      rodataOffset: 0n,
      dataOffset: 0n,
      shstrtabOffset: 0n,
      strtabOffset: 0n,
      symtabOffset: 0n,
      shdrOffset: 0n,
      textVaddr: 0n,
      rodataVaddr: 0n,
      dataVaddr: 0n,
      bssVaddr: 0n,
      entryPoint: 0n,
      fileSize: 0n,
    };

    // String tables
    this.shstrtab = [];  // Section name string table
    this.strtab = [];    // Symbol string table
    this.shstrtabIndex = new Map();
    this.strtabIndex = new Map();
  }

  /**
   * Reset linker state
   */
  reset() {
    this.textSection = Buffer.alloc(0);
    this.rodataSection = Buffer.alloc(0);
    this.dataSection = Buffer.alloc(0);
    this.bssSize = 0;
    this.symbols.clear();
    this.relocations = [];
    this.shstrtab = [];
    this.strtab = [];
    this.shstrtabIndex.clear();
    this.strtabIndex.clear();
  }

  /**
   * Add a section of code
   * @param {string} name - Section name (.text, .rodata, .data)
   * @param {Buffer|Array} data - Section data
   */
  addSection(name, data) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

    switch (name) {
      case '.text':
      case 'text':
        this.textSection = buf;
        break;
      case '.rodata':
      case 'rodata':
        this.rodataSection = buf;
        break;
      case '.data':
      case 'data':
        this.dataSection = buf;
        break;
      case '.bss':
      case 'bss':
        this.bssSize = buf.length;
        break;
    }
  }

  /**
   * Add a symbol
   * @param {string} name - Symbol name
   * @param {Object} info - { section, offset, isGlobal, type }
   */
  addSymbol(name, info) {
    this.symbols.set(name, {
      section: info.section || '.text',
      offset: info.offset || 0,
      isGlobal: info.isGlobal !== false,
      type: info.type || 'func',
      vaddr: 0n
    });
  }

  /**
   * Add symbols from a Map
   */
  addSymbols(symbolMap) {
    for (const [name, info] of symbolMap) {
      this.addSymbol(name, info);
    }
  }

  /**
   * Add a relocation
   * @param {Object} reloc - { section, offset, symbol, type, addend }
   */
  addRelocation(reloc) {
    this.relocations.push({
      section: reloc.section || '.text',
      offset: reloc.offset || 0,
      symbol: reloc.symbol,
      type: reloc.type || 'R_X86_64_PC32',
      addend: reloc.addend || 0
    });
  }

  /**
   * Add relocations from an array
   */
  addRelocations(relocs) {
    for (const reloc of relocs) {
      this.addRelocation(reloc);
    }
  }

  /**
   * Link and produce ELF binary
   * @returns {Buffer} Complete ELF executable
   */
  link() {
    // Step 1: Calculate layout
    this.calculateLayout();

    // Step 2: Build string tables
    this.buildStringTables();

    // Step 3: Finalize symbol addresses
    this.finalizeSymbolAddresses();

    // Step 4: Apply relocations
    this.applyRelocations();

    // Step 5: Generate ELF binary
    return this.generateELF();
  }

  /**
   * Calculate section layout
   */
  calculateLayout() {
    const ehdrSize = BigInt(ELF.EHDR_SIZE);
    const phdrSize = BigInt(ELF.PHDR_SIZE);
    const shdrSize = BigInt(ELF.SHDR_SIZE);
    const numPhdrs = 2n; // Two LOAD segments (code + data)

    // ELF header at offset 0
    this.layout.ehdrOffset = 0n;

    // Program headers immediately after ELF header
    this.layout.phdrOffset = ehdrSize;

    // Calculate header total size
    const headerSize = ehdrSize + (numPhdrs * phdrSize);

    // .text section aligned to page boundary
    this.layout.textOffset = this.alignUp(headerSize, this.pageSize);
    this.layout.textVaddr = this.baseAddress + this.layout.textOffset;

    // .rodata follows .text, aligned to 16 bytes
    const textEnd = this.layout.textOffset + BigInt(this.textSection.length);
    this.layout.rodataOffset = this.alignUp(textEnd, 16n);
    this.layout.rodataVaddr = this.baseAddress + this.layout.rodataOffset;

    // .data follows .rodata on next page boundary (writable segment)
    const rodataEnd = this.layout.rodataOffset + BigInt(this.rodataSection.length);
    this.layout.dataOffset = this.alignUp(rodataEnd, this.pageSize);
    this.layout.dataVaddr = this.baseAddress + this.layout.dataOffset;

    // .bss follows .data (not in file, only in memory)
    const dataEnd = this.layout.dataOffset + BigInt(this.dataSection.length);
    this.layout.bssVaddr = this.alignUp(this.layout.dataVaddr + BigInt(this.dataSection.length), 8n);

    // String tables and section headers after data
    this.layout.shstrtabOffset = this.alignUp(dataEnd, 8n);
    // Will be set after building string tables

    // Entry point
    if (this.symbols.has(this.entrySymbol)) {
      const entrySym = this.symbols.get(this.entrySymbol);
      this.layout.entryPoint = this.getSectionVaddr(entrySym.section) + BigInt(entrySym.offset);
    } else {
      // Default to start of .text
      this.layout.entryPoint = this.layout.textVaddr;
    }
  }

  /**
   * Build string tables
   */
  buildStringTables() {
    // Section name string table (.shstrtab)
    this.shstrtab = [0]; // Start with null byte
    this.shstrtabIndex.set('', 0);

    const sectionNames = ['', '.text', '.rodata', '.data', '.bss', '.shstrtab', '.strtab', '.symtab'];
    for (const name of sectionNames) {
      if (!this.shstrtabIndex.has(name)) {
        this.shstrtabIndex.set(name, this.shstrtab.length);
        for (const ch of name) {
          this.shstrtab.push(ch.charCodeAt(0));
        }
        this.shstrtab.push(0);
      }
    }

    // Symbol string table (.strtab)
    this.strtab = [0]; // Start with null byte
    this.strtabIndex.set('', 0);

    for (const [name] of this.symbols) {
      if (!this.strtabIndex.has(name)) {
        this.strtabIndex.set(name, this.strtab.length);
        for (const ch of name) {
          this.strtab.push(ch.charCodeAt(0));
        }
        this.strtab.push(0);
      }
    }

    // Update layout with string table positions
    const dataEnd = this.layout.dataOffset + BigInt(this.dataSection.length);
    this.layout.shstrtabOffset = this.alignUp(dataEnd, 8n);
    this.layout.strtabOffset = this.layout.shstrtabOffset + BigInt(this.shstrtab.length);
    this.layout.strtabOffset = this.alignUp(this.layout.strtabOffset, 8n);

    // Symbol table after string tables
    this.layout.symtabOffset = this.layout.strtabOffset + BigInt(this.strtab.length);
    this.layout.symtabOffset = this.alignUp(this.layout.symtabOffset, 8n);

    // Section headers after symbol table
    const numSymbols = this.symbols.size + 1; // +1 for null symbol
    const symtabSize = BigInt(numSymbols * 24); // 24 bytes per symbol entry
    this.layout.shdrOffset = this.layout.symtabOffset + symtabSize;
    this.layout.shdrOffset = this.alignUp(this.layout.shdrOffset, 8n);

    // Total file size
    const numSections = 8; // null, .text, .rodata, .data, .bss, .shstrtab, .strtab, .symtab
    this.layout.fileSize = this.layout.shdrOffset + BigInt(numSections * ELF.SHDR_SIZE);
  }

  /**
   * Finalize symbol virtual addresses
   */
  finalizeSymbolAddresses() {
    for (const [name, sym] of this.symbols) {
      const sectionVaddr = this.getSectionVaddr(sym.section);
      sym.vaddr = sectionVaddr + BigInt(sym.offset);
    }
  }

  /**
   * Get virtual address for a section
   */
  getSectionVaddr(section) {
    switch (section) {
      case '.text':
      case 'text':
        return this.layout.textVaddr;
      case '.rodata':
      case 'rodata':
        return this.layout.rodataVaddr;
      case '.data':
      case 'data':
        return this.layout.dataVaddr;
      case '.bss':
      case 'bss':
        return this.layout.bssVaddr;
      default:
        return this.layout.textVaddr;
    }
  }

  /**
   * Get file offset for a section
   */
  getSectionOffset(section) {
    switch (section) {
      case '.text':
      case 'text':
        return this.layout.textOffset;
      case '.rodata':
      case 'rodata':
        return this.layout.rodataOffset;
      case '.data':
      case 'data':
        return this.layout.dataOffset;
      default:
        return this.layout.textOffset;
    }
  }

  /**
   * Apply relocations to section data
   */
  applyRelocations() {
    for (const reloc of this.relocations) {
      const sym = this.symbols.get(reloc.symbol);
      if (!sym) {
        console.warn(`Undefined symbol: ${reloc.symbol}`);
        console.warn(`  Available symbols: ${Array.from(this.symbols.keys()).filter(k => k.startsWith('str_')).join(', ')}`);
        continue;
      }

      const symbolVaddr = sym.vaddr;
      const sectionVaddr = this.getSectionVaddr(reloc.section);
      const relocVaddr = sectionVaddr + BigInt(reloc.offset);

      // Get the section buffer to patch
      let sectionBuf;
      switch (reloc.section) {
        case '.text':
        case 'text':
          sectionBuf = this.textSection;
          break;
        case '.data':
        case 'data':
          sectionBuf = this.dataSection;
          break;
        default:
          continue;
      }

      switch (reloc.type) {
        case 'R_X86_64_PC32': {
          // PC-relative 32-bit: S + A - P
          const nextInstr = relocVaddr + 4n;
          const value = Number(symbolVaddr + BigInt(reloc.addend) - nextInstr);
          this.patchInt32(sectionBuf, reloc.offset, value);
          break;
        }
        case 'R_X86_64_64': {
          // 64-bit absolute: S + A
          const value = symbolVaddr + BigInt(reloc.addend);
          this.patchInt64(sectionBuf, reloc.offset, value);
          break;
        }
        case 'R_X86_64_32':
        case 'R_X86_64_32S': {
          // 32-bit absolute: S + A
          const value = Number(symbolVaddr + BigInt(reloc.addend));
          this.patchInt32(sectionBuf, reloc.offset, value);
          break;
        }
      }
    }
  }

  /**
   * Generate complete ELF binary
   */
  generateELF() {
    const buf = Buffer.alloc(Number(this.layout.fileSize));

    // Write ELF header
    this.writeElfHeader(buf);

    // Write program headers
    this.writeProgramHeaders(buf);

    // Write sections
    this.writeSections(buf);

    // Write section headers
    this.writeSectionHeaders(buf);

    return buf;
  }

  /**
   * Write ELF header (64 bytes)
   */
  writeElfHeader(buf) {
    let offset = 0;

    // e_ident (16 bytes)
    buf[offset++] = 0x7F;
    buf[offset++] = 0x45; // 'E'
    buf[offset++] = 0x4C; // 'L'
    buf[offset++] = 0x46; // 'F'
    buf[offset++] = ELF.ELFCLASS64;    // 64-bit
    buf[offset++] = ELF.ELFDATA2LSB;   // Little-endian
    buf[offset++] = ELF.EV_CURRENT;    // Version
    buf[offset++] = ELF.ELFOSABI_SYSV; // OS/ABI
    offset += 8; // Padding

    // e_type (2 bytes) - ET_EXEC
    buf.writeUInt16LE(ELF.ET_EXEC, offset);
    offset += 2;

    // e_machine (2 bytes) - EM_X86_64
    buf.writeUInt16LE(ELF.EM_X86_64, offset);
    offset += 2;

    // e_version (4 bytes)
    buf.writeUInt32LE(ELF.EV_CURRENT, offset);
    offset += 4;

    // e_entry (8 bytes) - Entry point
    buf.writeBigUInt64LE(this.layout.entryPoint, offset);
    offset += 8;

    // e_phoff (8 bytes) - Program header offset
    buf.writeBigUInt64LE(this.layout.phdrOffset, offset);
    offset += 8;

    // e_shoff (8 bytes) - Section header offset
    buf.writeBigUInt64LE(this.layout.shdrOffset, offset);
    offset += 8;

    // e_flags (4 bytes)
    buf.writeUInt32LE(0, offset);
    offset += 4;

    // e_ehsize (2 bytes) - ELF header size
    buf.writeUInt16LE(ELF.EHDR_SIZE, offset);
    offset += 2;

    // e_phentsize (2 bytes) - Program header entry size
    buf.writeUInt16LE(ELF.PHDR_SIZE, offset);
    offset += 2;

    // e_phnum (2 bytes) - Number of program headers
    buf.writeUInt16LE(2, offset); // Two LOAD segments
    offset += 2;

    // e_shentsize (2 bytes) - Section header entry size
    buf.writeUInt16LE(ELF.SHDR_SIZE, offset);
    offset += 2;

    // e_shnum (2 bytes) - Number of section headers
    buf.writeUInt16LE(8, offset); // null, .text, .rodata, .data, .bss, .shstrtab, .strtab, .symtab
    offset += 2;

    // e_shstrndx (2 bytes) - Section name string table index
    buf.writeUInt16LE(5, offset); // .shstrtab is section 5
  }

  /**
   * Write program headers (56 bytes each)
   */
  writeProgramHeaders(buf) {
    let offset = Number(this.layout.phdrOffset);

    // Program header 1: Code segment (PT_LOAD, R-X)
    // .text and .rodata together (read-execute)
    const codeEnd = this.layout.rodataOffset + BigInt(this.rodataSection.length);
    const codeSize = codeEnd - this.layout.textOffset;

    offset = this.writeProgramHeader(buf, offset, {
      type: ELF.PT_LOAD,
      flags: ELF.PF_R | ELF.PF_X,
      offset: this.layout.textOffset,
      vaddr: this.layout.textVaddr,
      paddr: this.layout.textVaddr,
      filesz: codeSize,
      memsz: codeSize,
      align: this.pageSize
    });

    // Program header 2: Data segment (PT_LOAD, RW-)
    const dataFileSz = BigInt(this.dataSection.length);
    const dataMemSz = dataFileSz + BigInt(this.bssSize);

    offset = this.writeProgramHeader(buf, offset, {
      type: ELF.PT_LOAD,
      flags: ELF.PF_R | ELF.PF_W,
      offset: this.layout.dataOffset,
      vaddr: this.layout.dataVaddr,
      paddr: this.layout.dataVaddr,
      filesz: dataFileSz,
      memsz: dataMemSz,
      align: this.pageSize
    });
  }

  /**
   * Write a single program header
   */
  writeProgramHeader(buf, offset, phdr) {
    // p_type (4 bytes)
    buf.writeUInt32LE(phdr.type, offset);
    offset += 4;

    // p_flags (4 bytes)
    buf.writeUInt32LE(phdr.flags, offset);
    offset += 4;

    // p_offset (8 bytes)
    buf.writeBigUInt64LE(phdr.offset, offset);
    offset += 8;

    // p_vaddr (8 bytes)
    buf.writeBigUInt64LE(phdr.vaddr, offset);
    offset += 8;

    // p_paddr (8 bytes)
    buf.writeBigUInt64LE(phdr.paddr, offset);
    offset += 8;

    // p_filesz (8 bytes)
    buf.writeBigUInt64LE(phdr.filesz, offset);
    offset += 8;

    // p_memsz (8 bytes)
    buf.writeBigUInt64LE(phdr.memsz, offset);
    offset += 8;

    // p_align (8 bytes)
    buf.writeBigUInt64LE(phdr.align, offset);
    offset += 8;

    return offset;
  }

  /**
   * Write section data
   */
  writeSections(buf) {
    // Write .text section
    if (this.textSection.length > 0) {
      this.textSection.copy(buf, Number(this.layout.textOffset));
    }

    // Write .rodata section
    if (this.rodataSection.length > 0) {
      this.rodataSection.copy(buf, Number(this.layout.rodataOffset));
    }

    // Write .data section
    if (this.dataSection.length > 0) {
      this.dataSection.copy(buf, Number(this.layout.dataOffset));
    }

    // Write .shstrtab (section name string table)
    for (let i = 0; i < this.shstrtab.length; i++) {
      buf[Number(this.layout.shstrtabOffset) + i] = this.shstrtab[i];
    }

    // Write .strtab (symbol string table)
    for (let i = 0; i < this.strtab.length; i++) {
      buf[Number(this.layout.strtabOffset) + i] = this.strtab[i];
    }

    // Write .symtab (symbol table)
    this.writeSymbolTable(buf);
  }

  /**
   * Write symbol table
   */
  writeSymbolTable(buf) {
    let offset = Number(this.layout.symtabOffset);

    // Null symbol entry
    offset = this.writeSymbolEntry(buf, offset, {
      name: 0,
      info: 0,
      other: 0,
      shndx: 0,
      value: 0n,
      size: 0n
    });

    // Write all symbols
    for (const [name, sym] of this.symbols) {
      const nameIndex = this.strtabIndex.get(name) || 0;
      const sectionIndex = this.getSectionIndex(sym.section);
      const binding = sym.isGlobal ? ELF.STB_GLOBAL : ELF.STB_LOCAL;
      const type = sym.type === 'func' ? ELF.STT_FUNC : ELF.STT_OBJECT;
      const info = (binding << 4) | type;

      offset = this.writeSymbolEntry(buf, offset, {
        name: nameIndex,
        info: info,
        other: 0,
        shndx: sectionIndex,
        value: sym.vaddr,
        size: 0n
      });
    }
  }

  /**
   * Write a symbol table entry (24 bytes)
   */
  writeSymbolEntry(buf, offset, entry) {
    // st_name (4 bytes)
    buf.writeUInt32LE(entry.name, offset);
    offset += 4;

    // st_info (1 byte)
    buf.writeUInt8(entry.info, offset);
    offset += 1;

    // st_other (1 byte)
    buf.writeUInt8(entry.other, offset);
    offset += 1;

    // st_shndx (2 bytes)
    buf.writeUInt16LE(entry.shndx, offset);
    offset += 2;

    // st_value (8 bytes)
    buf.writeBigUInt64LE(entry.value, offset);
    offset += 8;

    // st_size (8 bytes)
    buf.writeBigUInt64LE(entry.size, offset);
    offset += 8;

    return offset;
  }

  /**
   * Get section index for symbol table
   */
  getSectionIndex(section) {
    switch (section) {
      case '.text':
      case 'text':
        return 1;
      case '.rodata':
      case 'rodata':
        return 2;
      case '.data':
      case 'data':
        return 3;
      case '.bss':
      case 'bss':
        return 4;
      default:
        return 1;
    }
  }

  /**
   * Write section headers
   */
  writeSectionHeaders(buf) {
    let offset = Number(this.layout.shdrOffset);

    // Section 0: Null section header
    offset = this.writeSectionHeader(buf, offset, {
      name: 0, type: ELF.SHT_NULL, flags: 0n,
      addr: 0n, offset: 0n, size: 0n,
      link: 0, info: 0, addralign: 0n, entsize: 0n
    });

    // Section 1: .text
    offset = this.writeSectionHeader(buf, offset, {
      name: this.shstrtabIndex.get('.text') || 0,
      type: ELF.SHT_PROGBITS,
      flags: BigInt(ELF.SHF_ALLOC | ELF.SHF_EXECINSTR),
      addr: this.layout.textVaddr,
      offset: this.layout.textOffset,
      size: BigInt(this.textSection.length),
      link: 0, info: 0, addralign: 16n, entsize: 0n
    });

    // Section 2: .rodata
    offset = this.writeSectionHeader(buf, offset, {
      name: this.shstrtabIndex.get('.rodata') || 0,
      type: ELF.SHT_PROGBITS,
      flags: BigInt(ELF.SHF_ALLOC),
      addr: this.layout.rodataVaddr,
      offset: this.layout.rodataOffset,
      size: BigInt(this.rodataSection.length),
      link: 0, info: 0, addralign: 16n, entsize: 0n
    });

    // Section 3: .data
    offset = this.writeSectionHeader(buf, offset, {
      name: this.shstrtabIndex.get('.data') || 0,
      type: ELF.SHT_PROGBITS,
      flags: BigInt(ELF.SHF_ALLOC | ELF.SHF_WRITE),
      addr: this.layout.dataVaddr,
      offset: this.layout.dataOffset,
      size: BigInt(this.dataSection.length),
      link: 0, info: 0, addralign: 8n, entsize: 0n
    });

    // Section 4: .bss
    offset = this.writeSectionHeader(buf, offset, {
      name: this.shstrtabIndex.get('.bss') || 0,
      type: ELF.SHT_NOBITS,
      flags: BigInt(ELF.SHF_ALLOC | ELF.SHF_WRITE),
      addr: this.layout.bssVaddr,
      offset: 0n, // No file content
      size: BigInt(this.bssSize),
      link: 0, info: 0, addralign: 8n, entsize: 0n
    });

    // Section 5: .shstrtab
    offset = this.writeSectionHeader(buf, offset, {
      name: this.shstrtabIndex.get('.shstrtab') || 0,
      type: ELF.SHT_STRTAB,
      flags: 0n,
      addr: 0n,
      offset: this.layout.shstrtabOffset,
      size: BigInt(this.shstrtab.length),
      link: 0, info: 0, addralign: 1n, entsize: 0n
    });

    // Section 6: .strtab
    offset = this.writeSectionHeader(buf, offset, {
      name: this.shstrtabIndex.get('.strtab') || 0,
      type: ELF.SHT_STRTAB,
      flags: 0n,
      addr: 0n,
      offset: this.layout.strtabOffset,
      size: BigInt(this.strtab.length),
      link: 0, info: 0, addralign: 1n, entsize: 0n
    });

    // Section 7: .symtab
    const numSymbols = this.symbols.size + 1;
    const localCount = Array.from(this.symbols.values()).filter(s => !s.isGlobal).length + 1;

    offset = this.writeSectionHeader(buf, offset, {
      name: this.shstrtabIndex.get('.symtab') || 0,
      type: ELF.SHT_SYMTAB,
      flags: 0n,
      addr: 0n,
      offset: this.layout.symtabOffset,
      size: BigInt(numSymbols * 24),
      link: 6, // .strtab section index
      info: localCount, // First global symbol index
      addralign: 8n,
      entsize: 24n
    });
  }

  /**
   * Write a section header (64 bytes)
   */
  writeSectionHeader(buf, offset, shdr) {
    // sh_name (4 bytes)
    buf.writeUInt32LE(shdr.name, offset);
    offset += 4;

    // sh_type (4 bytes)
    buf.writeUInt32LE(shdr.type, offset);
    offset += 4;

    // sh_flags (8 bytes)
    buf.writeBigUInt64LE(shdr.flags, offset);
    offset += 8;

    // sh_addr (8 bytes)
    buf.writeBigUInt64LE(shdr.addr, offset);
    offset += 8;

    // sh_offset (8 bytes)
    buf.writeBigUInt64LE(shdr.offset, offset);
    offset += 8;

    // sh_size (8 bytes)
    buf.writeBigUInt64LE(shdr.size, offset);
    offset += 8;

    // sh_link (4 bytes)
    buf.writeUInt32LE(shdr.link, offset);
    offset += 4;

    // sh_info (4 bytes)
    buf.writeUInt32LE(shdr.info, offset);
    offset += 4;

    // sh_addralign (8 bytes)
    buf.writeBigUInt64LE(shdr.addralign, offset);
    offset += 8;

    // sh_entsize (8 bytes)
    buf.writeBigUInt64LE(shdr.entsize, offset);
    offset += 8;

    return offset;
  }

  /**
   * Align value up to boundary
   */
  alignUp(value, align) {
    const v = BigInt(value);
    const a = BigInt(align);
    return ((v + a - 1n) / a) * a;
  }

  /**
   * Patch 32-bit value in buffer
   */
  patchInt32(buf, offset, value) {
    buf.writeInt32LE(value, offset);
  }

  /**
   * Patch 64-bit value in buffer
   */
  patchInt64(buf, offset, value) {
    buf.writeBigInt64LE(value, offset);
  }

  /**
   * Get entry point address
   */
  getEntryPoint() {
    return this.layout.entryPoint;
  }

  /**
   * Get file size
   */
  getFileSize() {
    return Number(this.layout.fileSize);
  }

  /**
   * Create a minimal executable from assembly code result
   * @param {Object} asmResult - Result from X86CodeGenerator.assemble()
   * @returns {Buffer} ELF executable
   */
  static createExecutable(asmResult) {
    const linker = new ELFLinker();

    linker.addSection('.text', asmResult.code);
    linker.addSection('.rodata', asmResult.rodata || Buffer.alloc(0));
    linker.addSection('.data', asmResult.data || Buffer.alloc(0));

    if (asmResult.symbols) {
      linker.addSymbols(asmResult.symbols);
    }

    if (asmResult.relocations) {
      linker.addRelocations(asmResult.relocations);
    }

    return linker.link();
  }

  /**
   * Create a minimal exit program for testing
   */
  static createMinimalExitProgram(exitCode = 0) {
    // Machine code for:
    // mov $exitCode, %edi   (bf XX 00 00 00)
    // mov $60, %eax         (b8 3c 00 00 00)
    // syscall               (0f 05)
    const code = Buffer.from([
      0xBF, exitCode & 0xFF, 0x00, 0x00, 0x00, // mov $exitCode, %edi
      0xB8, 0x3C, 0x00, 0x00, 0x00,             // mov $60, %eax
      0x0F, 0x05                                 // syscall
    ]);

    const linker = new ELFLinker();
    linker.addSection('.text', code);
    linker.addSymbol('_start', { section: '.text', offset: 0, isGlobal: true });

    return linker.link();
  }

  /**
   * Create a hello world program for testing
   */
  static createHelloWorldProgram() {
    // Message in .rodata
    const message = Buffer.from('Hello, World!\n');

    // Machine code for:
    // mov $1, %edi          # fd = stdout
    // lea message(%rip), %rsi
    // mov $14, %edx         # len
    // mov $1, %eax          # syscall: write
    // syscall
    // xor %edi, %edi        # exit code = 0
    // mov $60, %eax         # syscall: exit
    // syscall

    // Calculate RIP-relative offset for message
    // .text at 0x401000, message at 0x401XXX (after code)
    const codeLen = 34; // Total code bytes
    const messageOffset = codeLen; // Message follows code immediately (will be in rodata)

    const linker = new ELFLinker();

    // Simple approach: inline the message in data section
    const code = Buffer.from([
      // mov $1, %edi (5 bytes)
      0xBF, 0x01, 0x00, 0x00, 0x00,
      // lea message(%rip), %rsi - will be patched (7 bytes)
      // REX.W LEA with RIP-relative addressing
      0x48, 0x8D, 0x35, 0x00, 0x00, 0x00, 0x00,
      // mov $14, %edx (5 bytes)
      0xBA, 0x0E, 0x00, 0x00, 0x00,
      // mov $1, %eax (5 bytes)
      0xB8, 0x01, 0x00, 0x00, 0x00,
      // syscall (2 bytes)
      0x0F, 0x05,
      // xor %edi, %edi (2 bytes)
      0x31, 0xFF,
      // mov $60, %eax (5 bytes)
      0xB8, 0x3C, 0x00, 0x00, 0x00,
      // syscall (2 bytes)
      0x0F, 0x05
    ]);

    linker.addSection('.text', code);
    linker.addSection('.rodata', message);
    linker.addSymbol('_start', { section: '.text', offset: 0, isGlobal: true });
    linker.addSymbol('message', { section: '.rodata', offset: 0, isGlobal: false });

    // Add relocation for the LEA instruction
    linker.addRelocation({
      section: '.text',
      offset: 8, // Offset of the displacement in LEA
      symbol: 'message',
      type: 'R_X86_64_PC32',
      addend: -4
    });

    return linker.link();
  }
}

module.exports = { ELFLinker, ELF };
