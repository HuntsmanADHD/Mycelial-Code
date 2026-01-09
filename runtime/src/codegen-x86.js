/**
 * x86-64 Code Generator
 *
 * Converts x86-64 assembly text (Intel syntax) to machine code bytes.
 * Implements the 48-instruction subset needed for the Mycelial compiler.
 *
 * Features:
 * - Register encoding with REX prefixes for r8-r15
 * - Immediate encoding (8-bit, 32-bit, 64-bit)
 * - Memory addressing with ModRM and SIB bytes
 * - Label resolution for jumps and calls
 * - Two-pass assembly for forward references
 *
 * @author Opus (Claude Opus 4.5)
 * @date 2026-01-07
 */

/**
 * Register encoding tables
 */
const REGISTERS = {
  // 64-bit registers (base encoding 0-7)
  rax: { code: 0, extended: false, size: 64 },
  rcx: { code: 1, extended: false, size: 64 },
  rdx: { code: 2, extended: false, size: 64 },
  rbx: { code: 3, extended: false, size: 64 },
  rsp: { code: 4, extended: false, size: 64 },
  rbp: { code: 5, extended: false, size: 64 },
  rsi: { code: 6, extended: false, size: 64 },
  rdi: { code: 7, extended: false, size: 64 },

  // Extended 64-bit registers (r8-r15, need REX.B or REX.R)
  r8:  { code: 0, extended: true, size: 64 },
  r9:  { code: 1, extended: true, size: 64 },
  r10: { code: 2, extended: true, size: 64 },
  r11: { code: 3, extended: true, size: 64 },
  r12: { code: 4, extended: true, size: 64 },
  r13: { code: 5, extended: true, size: 64 },
  r14: { code: 6, extended: true, size: 64 },
  r15: { code: 7, extended: true, size: 64 },

  // 32-bit registers
  eax: { code: 0, extended: false, size: 32 },
  ecx: { code: 1, extended: false, size: 32 },
  edx: { code: 2, extended: false, size: 32 },
  ebx: { code: 3, extended: false, size: 32 },
  esp: { code: 4, extended: false, size: 32 },
  ebp: { code: 5, extended: false, size: 32 },
  esi: { code: 6, extended: false, size: 32 },
  edi: { code: 7, extended: false, size: 32 },

  // Extended 32-bit registers
  r8d:  { code: 0, extended: true, size: 32 },
  r9d:  { code: 1, extended: true, size: 32 },
  r10d: { code: 2, extended: true, size: 32 },
  r11d: { code: 3, extended: true, size: 32 },
  r12d: { code: 4, extended: true, size: 32 },
  r13d: { code: 5, extended: true, size: 32 },
  r14d: { code: 6, extended: true, size: 32 },
  r15d: { code: 7, extended: true, size: 32 },

  // 8-bit registers
  al: { code: 0, extended: false, size: 8 },
  cl: { code: 1, extended: false, size: 8 },
  dl: { code: 2, extended: false, size: 8 },
  bl: { code: 3, extended: false, size: 8 },
  spl: { code: 4, extended: false, size: 8 },
  bpl: { code: 5, extended: false, size: 8 },
  sil: { code: 6, extended: false, size: 8 },
  dil: { code: 7, extended: false, size: 8 },

  // Extended 8-bit registers
  r8b:  { code: 0, extended: true, size: 8 },
  r9b:  { code: 1, extended: true, size: 8 },
  r10b: { code: 2, extended: true, size: 8 },
  r11b: { code: 3, extended: true, size: 8 },
  r12b: { code: 4, extended: true, size: 8 },
  r13b: { code: 5, extended: true, size: 8 },
  r14b: { code: 6, extended: true, size: 8 },
  r15b: { code: 7, extended: true, size: 8 },
};

/**
 * X86-64 Code Generator class
 */
class X86CodeGenerator {
  constructor() {
    this.labels = new Map();       // label -> offset
    this.pending = [];             // { offset, label, size } for fixups
    this.code = [];                // output bytes
    this.currentOffset = 0;
    this.sections = {
      text: [],
      rodata: [],
      data: []
    };
    this.currentSection = 'text';
    this.symbols = new Map();      // symbol -> { section, offset, isGlobal }
    this.relocations = [];         // { section, offset, symbol, type, addend }
  }

  /**
   * Reset the code generator state
   */
  reset() {
    this.labels.clear();
    this.pending = [];
    this.code = [];
    this.currentOffset = 0;
    this.sections = {
      text: [],
      rodata: [],
      data: []
    };
    this.currentSection = 'text';
    this.symbols.clear();
    this.relocations = [];
  }

  /**
   * Assemble a complete assembly text to machine code
   * @param {string} asmText - Assembly source code
   * @returns {Object} { code: Buffer, symbols: Map, relocations: Array }
   */
  assemble(asmText) {
    this.reset();
    const lines = asmText.split('\n');

    // Pass 1: Parse and collect labels
    const instructions = this.pass1(lines);

    // Pass 2: Encode instructions with known label offsets
    this.pass2(instructions);

    // Resolve pending label references
    this.resolvePendingLabels();

    return {
      code: Buffer.from(this.sections.text),
      rodata: Buffer.from(this.sections.rodata),
      data: Buffer.from(this.sections.data),
      symbols: this.symbols,
      relocations: this.relocations
    };
  }

  /**
   * Pass 1: Parse lines and collect labels
   */
  pass1(lines) {
    const instructions = [];
    this.currentOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('#') || line.startsWith(';')) {
        continue;
      }

      // Handle section directives
      if (line.startsWith('.section') || line.startsWith('.text') ||
          line.startsWith('.data') || line.startsWith('.rodata')) {
        const section = this.parseSectionDirective(line);
        this.currentSection = section;
        continue;
      }

      // Handle standalone labels (lines ending with just ':')
      if (line.endsWith(':')) {
        const label = line.slice(0, -1).trim();
        // Don't set labels here - wait for pass2 to get accurate offsets
        // Just record that this is a label for pass2
        instructions.push({ type: 'label', label, offset: this.currentOffset });
        continue;
      }

      // Handle data directives
      if (line.startsWith('.')) {
        const dataSize = this.estimateDataDirective(line);
        this.currentOffset += dataSize;
        instructions.push({ type: 'data', line, offset: this.currentOffset - dataSize });
        continue;
      }

      // Parse instruction
      const parsed = this.parseInstruction(line);
      if (parsed) {
        const size = this.estimateInstructionSize(parsed);
        parsed.offset = this.currentOffset;
        this.currentOffset += size;
        instructions.push({ type: 'instruction', ...parsed });
      }
    }

    return instructions;
  }

  /**
   * Pass 2: Encode all instructions
   */
  pass2(instructions) {
    this.currentOffset = 0;

    for (const instr of instructions) {
      if (instr.type === 'label') {
        // Standalone label - record with actual section offset
        const section = this.sections[this.currentSection];
        this.labels.set(instr.label, section.length);
        this.symbols.set(instr.label, {
          section: this.currentSection,
          offset: section.length,
          isGlobal: !instr.label.startsWith('.')
        });
      } else if (instr.type === 'data') {
        this.encodeDataDirective(instr.line);
      } else if (instr.type === 'instruction') {
        this.encodeInstruction(instr);
      }
    }
  }

  /**
   * Parse a section directive
   */
  parseSectionDirective(line) {
    if (line.startsWith('.text')) return 'text';
    if (line.startsWith('.data')) return 'data';
    if (line.startsWith('.rodata')) return 'rodata';
    if (line.startsWith('.section')) {
      const match = line.match(/\.section\s+(\.\w+)/);
      if (match) {
        return match[1].slice(1); // Remove leading dot
      }
    }
    return 'text';
  }

  /**
   * Parse an instruction line
   */
  parseInstruction(line) {
    // Remove comments
    const commentIdx = line.indexOf('#');
    if (commentIdx !== -1) {
      line = line.slice(0, commentIdx).trim();
    }

    // Handle label: instruction format
    const colonIdx = line.indexOf(':');
    let label = null;
    if (colonIdx !== -1 && !line.includes('[')) {
      label = line.slice(0, colonIdx).trim();
      line = line.slice(colonIdx + 1).trim();
    }

    if (!line) {
      return label ? { mnemonic: '', operands: [], label } : null;
    }

    // Split into mnemonic and operands
    const parts = line.split(/\s+/);
    const mnemonic = parts[0].toLowerCase();
    const operandStr = parts.slice(1).join(' ');

    // Parse operands
    const operands = this.parseOperands(operandStr);

    return { mnemonic, operands, label };
  }

  /**
   * Parse operand string into operand objects
   */
  parseOperands(str) {
    if (!str || !str.trim()) return [];

    const operands = [];
    let current = '';
    let depth = 0;

    for (const ch of str) {
      if (ch === '[') depth++;
      else if (ch === ']') depth--;

      if (ch === ',' && depth === 0) {
        operands.push(this.parseOperand(current.trim()));
        current = '';
      } else {
        current += ch;
      }
    }

    if (current.trim()) {
      operands.push(this.parseOperand(current.trim()));
    }

    return operands;
  }

  /**
   * Parse a single operand
   */
  parseOperand(str) {
    str = str.trim();

    // Remove % prefix (AT&T style) if present
    if (str.startsWith('%')) {
      str = str.slice(1);
    }

    // Immediate value
    if (str.startsWith('$')) {
      const value = this.parseImmediate(str.slice(1));
      return { type: 'imm', value };
    }

    // Memory operand: [base + index*scale + disp] or offset(base)
    if (str.includes('[') || str.includes('(')) {
      return this.parseMemoryOperand(str);
    }

    // Check if it's a register
    const regLower = str.toLowerCase();
    if (REGISTERS[regLower]) {
      return { type: 'reg', name: regLower, ...REGISTERS[regLower] };
    }

    // Must be a label or immediate
    const imm = this.parseImmediate(str);
    if (!isNaN(imm)) {
      return { type: 'imm', value: imm };
    }

    // Label reference
    return { type: 'label', name: str };
  }

  /**
   * Parse a memory operand
   */
  parseMemoryOperand(str) {
    // AT&T style: offset(base, index, scale) or offset(base)
    const atntMatch = str.match(/^(-?\d+)?\(%?(\w+)(?:,\s*%?(\w+)(?:,\s*(\d+))?)?\)$/);
    if (atntMatch) {
      return {
        type: 'mem',
        base: atntMatch[2] ? atntMatch[2].toLowerCase() : null,
        index: atntMatch[3] ? atntMatch[3].toLowerCase() : null,
        scale: atntMatch[4] ? parseInt(atntMatch[4]) : 1,
        disp: atntMatch[1] ? parseInt(atntMatch[1]) : 0,
        ripRelative: false
      };
    }

    // Intel style: [base + index*scale + disp]
    const intelMatch = str.match(/\[([^\]]+)\]/);
    if (intelMatch) {
      const inner = intelMatch[1];
      let base = null, index = null, scale = 1, disp = 0;
      let ripRelative = false;

      // Parse components
      const parts = inner.split(/([+\-])/);
      let sign = 1;

      for (let part of parts) {
        part = part.trim();
        if (part === '+') { sign = 1; continue; }
        if (part === '-') { sign = -1; continue; }
        if (!part) continue;

        // Check for scale*index
        const scaleMatch = part.match(/(\w+)\s*\*\s*(\d+)/);
        if (scaleMatch) {
          index = scaleMatch[1].toLowerCase();
          scale = parseInt(scaleMatch[2]);
          continue;
        }

        // Check for index*scale (reversed)
        const scaleMatch2 = part.match(/(\d+)\s*\*\s*(\w+)/);
        if (scaleMatch2) {
          scale = parseInt(scaleMatch2[1]);
          index = scaleMatch2[2].toLowerCase();
          continue;
        }

        // Check if it's a number
        const num = parseInt(part);
        if (!isNaN(num)) {
          disp += sign * num;
          continue;
        }

        // Check if it's RIP-relative
        if (part.toLowerCase() === 'rip') {
          ripRelative = true;
          continue;
        }

        // Must be a register
        const reg = part.toLowerCase().replace('%', '');
        if (REGISTERS[reg]) {
          if (!base) base = reg;
          else if (!index) index = reg;
        }
      }

      return { type: 'mem', base, index, scale, disp, ripRelative };
    }

    // Label with optional offset: label(%rip) or symbol
    const labelMatch = str.match(/^(\w+)(?:\(%rip\))?$/);
    if (labelMatch) {
      return { type: 'mem', label: labelMatch[1], ripRelative: true, base: null, index: null, scale: 1, disp: 0 };
    }

    return { type: 'mem', base: null, index: null, scale: 1, disp: 0, ripRelative: false };
  }

  /**
   * Parse an immediate value
   */
  parseImmediate(str) {
    str = str.trim();
    if (str.startsWith('0x') || str.startsWith('0X')) {
      return parseInt(str, 16);
    }
    if (str.startsWith('0b') || str.startsWith('0B')) {
      return parseInt(str.slice(2), 2);
    }
    return parseInt(str, 10);
  }

  /**
   * Estimate instruction size (conservative)
   */
  estimateInstructionSize(instr) {
    const { mnemonic, operands } = instr;

    // No-operand instructions
    if (['ret', 'nop', 'syscall', 'cqo', 'cdq', 'cwd'].includes(mnemonic)) {
      return mnemonic === 'syscall' ? 2 : 1;
    }

    // Jump/call instructions
    if (['jmp', 'je', 'jne', 'jz', 'jnz', 'jl', 'jg', 'jle', 'jge', 'jb', 'ja', 'jbe', 'jae', 'call'].includes(mnemonic)) {
      return 5; // Conservative: rel32
    }

    // Most instructions: REX + opcode + ModRM + possible SIB + disp + imm
    let size = 1; // opcode

    // Check if we need REX prefix
    if (operands.some(op => op.type === 'reg' && (op.size === 64 || op.extended))) {
      size += 1;
    }

    // ModRM byte for register/memory operands
    if (operands.length >= 2) {
      size += 1;
    }

    // Check for memory operand (may need SIB + displacement)
    const memOp = operands.find(op => op.type === 'mem');
    if (memOp) {
      if (memOp.index) size += 1; // SIB
      if (memOp.disp !== 0) size += 4; // disp32
    }

    // Check for immediate
    const immOp = operands.find(op => op.type === 'imm');
    if (immOp) {
      const val = immOp.value;
      if (val >= -128 && val <= 127) size += 1;
      else if (val >= -2147483648 && val <= 2147483647) size += 4;
      else size += 8;
    }

    return Math.max(size, 2); // Minimum 2 bytes for most instructions
  }

  /**
   * Estimate data directive size
   */
  estimateDataDirective(line) {
    if (line.startsWith('.byte')) {
      // Count comma-separated values
      const valPart = line.slice(5).trim();
      return valPart.split(',').length;
    }
    if (line.startsWith('.word') || line.startsWith('.short')) return 2;
    if (line.startsWith('.long') || line.startsWith('.int')) return 4;
    if (line.startsWith('.quad')) return 8;
    if (line.startsWith('.ascii')) {
      const match = line.match(/"([^"]*)"/);
      return match ? match[1].length : 0;
    }
    if (line.startsWith('.asciz') || line.startsWith('.string')) {
      const match = line.match(/"([^"]*)"/);
      return match ? match[1].length + 1 : 1;
    }
    if (line.startsWith('.align')) {
      const align = parseInt(line.split(/\s+/)[1]) || 4;
      return align; // Worst case
    }
    if (line.startsWith('.zero') || line.startsWith('.space')) {
      return parseInt(line.split(/\s+/)[1]) || 0;
    }
    return 0;
  }

  /**
   * Encode a data directive
   */
  encodeDataDirective(line) {
    const section = this.sections[this.currentSection];

    if (line.startsWith('.byte')) {
      // Handle comma-separated byte values: .byte 0x7f, 0x45, 0x4c, 0x46
      const valPart = line.slice(5).trim();
      const values = valPart.split(',').map(v => parseInt(v.trim()) & 0xFF);
      for (const val of values) {
        section.push(val);
      }
      this.currentOffset += values.length;
    } else if (line.startsWith('.word') || line.startsWith('.short')) {
      const val = parseInt(line.split(/\s+/)[1]) & 0xFFFF;
      section.push(val & 0xFF, (val >> 8) & 0xFF);
      this.currentOffset += 2;
    } else if (line.startsWith('.long') || line.startsWith('.int')) {
      const val = parseInt(line.split(/\s+/)[1]) >>> 0;
      this.pushInt32(section, val);
      this.currentOffset += 4;
    } else if (line.startsWith('.quad')) {
      const val = BigInt(line.split(/\s+/)[1]);
      this.pushInt64(section, val);
      this.currentOffset += 8;
    } else if (line.startsWith('.ascii')) {
      const match = line.match(/"([^"]*)"/);
      if (match) {
        const str = this.unescapeString(match[1]);
        for (const ch of str) {
          section.push(ch.charCodeAt(0));
        }
        this.currentOffset += str.length;
      }
    } else if (line.startsWith('.asciz') || line.startsWith('.string')) {
      const match = line.match(/"([^"]*)"/);
      if (match) {
        const str = this.unescapeString(match[1]);
        for (const ch of str) {
          section.push(ch.charCodeAt(0));
        }
        section.push(0); // Null terminator
        this.currentOffset += str.length + 1;
      }
    } else if (line.startsWith('.align')) {
      const align = parseInt(line.split(/\s+/)[1]) || 4;
      while (section.length % align !== 0) {
        section.push(0);
        this.currentOffset += 1;
      }
    } else if (line.startsWith('.zero') || line.startsWith('.space')) {
      const count = parseInt(line.split(/\s+/)[1]) || 0;
      for (let i = 0; i < count; i++) {
        section.push(0);
      }
      this.currentOffset += count;
    } else if (line.startsWith('.globl') || line.startsWith('.global')) {
      const symbol = line.split(/\s+/)[1];
      if (this.symbols.has(symbol)) {
        this.symbols.get(symbol).isGlobal = true;
      }
    }
  }

  /**
   * Unescape a string literal
   */
  unescapeString(str) {
    return str.replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\r/g, '\r')
              .replace(/\\0/g, '\0')
              .replace(/\\\\/g, '\\')
              .replace(/\\"/g, '"');
  }

  /**
   * Encode an instruction
   */
  encodeInstruction(instr) {
    const { mnemonic, operands, label } = instr;
    const section = this.sections[this.currentSection];

    // Record label
    if (label) {
      this.labels.set(label, section.length);
      this.symbols.set(label, {
        section: this.currentSection,
        offset: section.length,
        isGlobal: !label.startsWith('.')
      });
    }

    // Empty mnemonic (label only)
    if (!mnemonic) return;

    // Dispatch to specific encoder
    switch (mnemonic) {
      // Data movement
      case 'mov':
      case 'movq':
      case 'movl':
      case 'movw':
      case 'movb':
        this.encodeMov(section, operands, mnemonic);
        break;

      case 'movabs':
      case 'movabsq':
        this.encodeMovabs(section, operands);
        break;

      case 'movzx':
      case 'movzxb':
      case 'movzxw':
      case 'movzbq':
      case 'movzbl':
      case 'movzwl':
      case 'movzwq':
        this.encodeMovzx(section, operands);
        break;

      case 'movsx':
      case 'movsxd':
      case 'movsxb':
      case 'movsxw':
      case 'movsbq':
      case 'movsbl':
      case 'movswq':
      case 'movswl':
      case 'movslq':
        this.encodeMovsx(section, operands);
        break;

      case 'lea':
      case 'leaq':
        this.encodeLea(section, operands);
        break;

      case 'push':
      case 'pushq':
        this.encodePush(section, operands);
        break;

      case 'pop':
      case 'popq':
        this.encodePop(section, operands);
        break;

      // Arithmetic
      case 'add':
      case 'addq':
      case 'addl':
        this.encodeArith(section, operands, 0x01, 0x03, 0); // ADD
        break;

      case 'sub':
      case 'subq':
      case 'subl':
        this.encodeArith(section, operands, 0x29, 0x2B, 5); // SUB
        break;

      case 'imul':
      case 'imulq':
        this.encodeImul(section, operands);
        break;

      case 'idiv':
      case 'idivq':
        this.encodeUnaryArith(section, operands, 7); // IDIV
        break;

      case 'div':
      case 'divq':
        this.encodeUnaryArith(section, operands, 6); // DIV
        break;

      case 'inc':
      case 'incq':
        this.encodeUnaryArith(section, operands, 0); // INC
        break;

      case 'dec':
      case 'decq':
        this.encodeUnaryArith(section, operands, 1); // DEC
        break;

      case 'neg':
      case 'negq':
        this.encodeUnaryArith(section, operands, 3); // NEG
        break;

      // Logic
      case 'and':
      case 'andq':
      case 'andl':
        this.encodeArith(section, operands, 0x21, 0x23, 4); // AND
        break;

      case 'or':
      case 'orq':
      case 'orl':
        this.encodeArith(section, operands, 0x09, 0x0B, 1); // OR
        break;

      case 'xor':
      case 'xorq':
      case 'xorl':
        this.encodeArith(section, operands, 0x31, 0x33, 6); // XOR
        break;

      case 'not':
      case 'notq':
        this.encodeUnaryArith(section, operands, 2); // NOT
        break;

      case 'shl':
      case 'shlq':
      case 'sal':
      case 'salq':
        this.encodeShift(section, operands, 4); // SHL
        break;

      case 'shr':
      case 'shrq':
        this.encodeShift(section, operands, 5); // SHR
        break;

      case 'sar':
      case 'sarq':
        this.encodeShift(section, operands, 7); // SAR
        break;

      // Comparison
      case 'cmp':
      case 'cmpq':
      case 'cmpl':
        this.encodeArith(section, operands, 0x39, 0x3B, 7); // CMP
        break;

      case 'test':
      case 'testq':
      case 'testl':
        this.encodeTest(section, operands);
        break;

      // Conditional set
      case 'sete':
      case 'setz':
        this.encodeSetcc(section, operands, 0x94);
        break;

      case 'setne':
      case 'setnz':
        this.encodeSetcc(section, operands, 0x95);
        break;

      case 'setl':
      case 'setnge':
        this.encodeSetcc(section, operands, 0x9C);
        break;

      case 'setle':
      case 'setng':
        this.encodeSetcc(section, operands, 0x9E);
        break;

      case 'setg':
      case 'setnle':
        this.encodeSetcc(section, operands, 0x9F);
        break;

      case 'setge':
      case 'setnl':
        this.encodeSetcc(section, operands, 0x9D);
        break;

      case 'setb':
      case 'setc':
      case 'setnae':
        this.encodeSetcc(section, operands, 0x92);
        break;

      case 'setbe':
      case 'setna':
        this.encodeSetcc(section, operands, 0x96);
        break;

      case 'seta':
      case 'setnbe':
        this.encodeSetcc(section, operands, 0x97);
        break;

      case 'setae':
      case 'setnb':
      case 'setnc':
        this.encodeSetcc(section, operands, 0x93);
        break;

      // Control flow
      case 'jmp':
        this.encodeJump(section, operands, 0xE9); // JMP rel32
        break;

      case 'je':
      case 'jz':
        this.encodeCondJump(section, operands, 0x84); // JE rel32
        break;

      case 'jne':
      case 'jnz':
        this.encodeCondJump(section, operands, 0x85); // JNE rel32
        break;

      case 'jl':
      case 'jnge':
        this.encodeCondJump(section, operands, 0x8C); // JL rel32
        break;

      case 'jle':
      case 'jng':
        this.encodeCondJump(section, operands, 0x8E); // JLE rel32
        break;

      case 'jg':
      case 'jnle':
        this.encodeCondJump(section, operands, 0x8F); // JG rel32
        break;

      case 'jge':
      case 'jnl':
        this.encodeCondJump(section, operands, 0x8D); // JGE rel32
        break;

      case 'jb':
      case 'jnae':
      case 'jc':
        this.encodeCondJump(section, operands, 0x82); // JB rel32
        break;

      case 'jbe':
      case 'jna':
        this.encodeCondJump(section, operands, 0x86); // JBE rel32
        break;

      case 'ja':
      case 'jnbe':
        this.encodeCondJump(section, operands, 0x87); // JA rel32
        break;

      case 'jae':
      case 'jnb':
      case 'jnc':
        this.encodeCondJump(section, operands, 0x83); // JAE rel32
        break;

      case 'js':
        this.encodeCondJump(section, operands, 0x88); // JS rel32 (jump if sign)
        break;

      case 'jns':
        this.encodeCondJump(section, operands, 0x89); // JNS rel32 (jump if not sign)
        break;

      case 'jo':
        this.encodeCondJump(section, operands, 0x80); // JO rel32 (jump if overflow)
        break;

      case 'jno':
        this.encodeCondJump(section, operands, 0x81); // JNO rel32 (jump if not overflow)
        break;

      case 'jp':
      case 'jpe':
        this.encodeCondJump(section, operands, 0x8A); // JP rel32 (jump if parity)
        break;

      case 'jnp':
      case 'jpo':
        this.encodeCondJump(section, operands, 0x8B); // JNP rel32 (jump if not parity)
        break;

      case 'call':
        this.encodeCall(section, operands);
        break;

      case 'ret':
      case 'retq':
        section.push(0xC3);
        this.currentOffset += 1;
        break;

      // Special
      case 'syscall':
        section.push(0x0F, 0x05);
        this.currentOffset += 2;
        break;

      case 'nop':
        section.push(0x90);
        this.currentOffset += 1;
        break;

      case 'cqo':
      case 'cqto':
        section.push(0x48, 0x99);
        this.currentOffset += 2;
        break;

      case 'cdq':
      case 'cltd':
        section.push(0x99);
        this.currentOffset += 1;
        break;

      case 'int':
        section.push(0xCD, operands[0].value & 0xFF);
        this.currentOffset += 2;
        break;

      case 'rdtsc':
        section.push(0x0F, 0x31);
        this.currentOffset += 2;
        break;

      default:
        console.warn(`Unknown mnemonic: ${mnemonic}`);
    }
  }

  /**
   * Build REX prefix
   */
  buildRex(w, r, x, b) {
    let rex = 0x40;
    if (w) rex |= 0x08;
    if (r) rex |= 0x04;
    if (x) rex |= 0x02;
    if (b) rex |= 0x01;
    return rex;
  }

  /**
   * Build ModR/M byte
   */
  buildModRM(mod, reg, rm) {
    return ((mod & 0x3) << 6) | ((reg & 0x7) << 3) | (rm & 0x7);
  }

  /**
   * Build SIB byte
   */
  buildSIB(scale, index, base) {
    const scaleMap = { 1: 0, 2: 1, 4: 2, 8: 3 };
    return ((scaleMap[scale] || 0) << 6) | ((index & 0x7) << 3) | (base & 0x7);
  }

  /**
   * Encode MOV instruction
   */
  encodeMov(section, operands, mnemonic) {
    if (operands.length !== 2) return;

    const [src, dst] = operands;
    const is64 = mnemonic === 'movq' || mnemonic === 'mov';
    const is32 = mnemonic === 'movl';
    const is16 = mnemonic === 'movw';
    const is8 = mnemonic === 'movb';

    // MOV reg, imm
    if (dst.type === 'reg' && src.type === 'imm') {
      this.encodeMovRegImm(section, dst, src.value, is64);
      return;
    }

    // MOV reg, reg
    if (dst.type === 'reg' && src.type === 'reg') {
      this.encodeMovRegReg(section, dst, src, is64);
      return;
    }

    // MOV reg, mem
    if (dst.type === 'reg' && src.type === 'mem') {
      this.encodeMovRegMem(section, dst, src, is64);
      return;
    }

    // MOV mem, reg
    if (dst.type === 'mem' && src.type === 'reg') {
      this.encodeMovMemReg(section, dst, src, is64);
      return;
    }

    // MOV mem, imm
    if (dst.type === 'mem' && src.type === 'imm') {
      this.encodeMovMemImm(section, dst, src.value, is64);
      return;
    }
  }

  encodeMovRegImm(section, reg, imm, is64) {
    const needsRex = is64 || reg.extended;
    const is64Imm = imm > 0xFFFFFFFF || imm < -2147483648;

    if (is64Imm && is64) {
      // movabs: REX.W + B8+rd + imm64
      if (needsRex) {
        section.push(this.buildRex(true, false, false, reg.extended));
      }
      section.push(0xB8 + reg.code);
      this.pushInt64(section, BigInt(imm));
      this.currentOffset += (needsRex ? 1 : 0) + 1 + 8;
    } else {
      // mov reg, imm32: REX.W + C7 /0 + imm32
      if (needsRex) {
        section.push(this.buildRex(is64, false, false, reg.extended));
      }
      section.push(0xC7);
      section.push(this.buildModRM(3, 0, reg.code));
      this.pushInt32(section, imm);
      this.currentOffset += (needsRex ? 1 : 0) + 1 + 1 + 4;
    }
  }

  encodeMovRegReg(section, dst, src, is64) {
    const needsRex = is64 || dst.extended || src.extended;

    if (needsRex) {
      section.push(this.buildRex(is64, src.extended, false, dst.extended));
    }
    section.push(0x89); // MOV r/m64, r64
    section.push(this.buildModRM(3, src.code, dst.code));
    this.currentOffset += (needsRex ? 1 : 0) + 2;
  }

  encodeMovRegMem(section, dst, src, is64) {
    // MOV r64, r/m64: REX.W + 8B /r
    const memEncoding = this.encodeMemoryOperand(src, dst.code, dst.extended, is64);
    for (const byte of memEncoding) {
      section.push(byte);
    }
    this.currentOffset += memEncoding.length;
  }

  encodeMovMemReg(section, dst, src, is64) {
    // MOV r/m64, r64: REX.W + 89 /r
    const memEncoding = this.encodeMemoryOperand(dst, src.code, src.extended, is64, 0x89);
    for (const byte of memEncoding) {
      section.push(byte);
    }
    this.currentOffset += memEncoding.length;
  }

  encodeMovMemImm(section, dst, imm, is64) {
    // MOV r/m64, imm32: REX.W + C7 /0 + imm32
    const memEncoding = this.encodeMemoryOperand(dst, 0, false, is64, 0xC7);
    for (const byte of memEncoding) {
      section.push(byte);
    }
    this.pushInt32(section, imm);
    this.currentOffset += memEncoding.length + 4;
  }

  /**
   * Encode memory operand
   */
  encodeMemoryOperand(mem, regCode, regExtended, is64, opcode = 0x8B) {
    const bytes = [];
    const baseReg = mem.base ? REGISTERS[mem.base] : null;
    const indexReg = mem.index ? REGISTERS[mem.index] : null;

    // Build REX prefix
    let rexW = is64;
    let rexR = regExtended;
    let rexX = indexReg && indexReg.extended;
    let rexB = baseReg && baseReg.extended;

    const needsRex = rexW || rexR || rexX || rexB;
    if (needsRex) {
      bytes.push(this.buildRex(rexW, rexR, rexX, rexB));
    }

    bytes.push(opcode);

    // Determine mod and displacement size
    let mod, dispSize = 0;
    const disp = mem.disp || 0;

    if (!baseReg && !indexReg && mem.label) {
      // RIP-relative addressing
      mod = 0;
      bytes.push(this.buildModRM(0, regCode, 5)); // RIP-relative

      // Add relocation for the label
      this.pending.push({
        offset: this.currentOffset + bytes.length,
        label: mem.label,
        size: 4,
        pcRelative: true
      });

      this.pushInt32(bytes, 0);
      return bytes;
    }

    if (!baseReg) {
      // disp32 only (SIB with no base)
      mod = 0;
      dispSize = 4;
    } else if (disp === 0 && baseReg.code !== 5) {
      // No displacement (except rbp/r13 which requires disp8)
      mod = 0;
      dispSize = 0;
    } else if (disp >= -128 && disp <= 127) {
      mod = 1;
      dispSize = 1;
    } else {
      mod = 2;
      dispSize = 4;
    }

    // Build ModR/M
    const needsSIB = indexReg || (baseReg && baseReg.code === 4);
    const rm = needsSIB ? 4 : (baseReg ? baseReg.code : 5);

    bytes.push(this.buildModRM(mod, regCode, rm));

    // Build SIB if needed
    if (needsSIB) {
      const baseCode = baseReg ? baseReg.code : 5;
      const indexCode = indexReg ? indexReg.code : 4; // 4 means no index
      bytes.push(this.buildSIB(mem.scale || 1, indexCode, baseCode));
    }

    // Add displacement
    if (dispSize === 1) {
      bytes.push(disp & 0xFF);
    } else if (dispSize === 4 || (!baseReg && !needsSIB)) {
      this.pushInt32(bytes, disp);
    }

    return bytes;
  }

  /**
   * Encode MOVABS (64-bit immediate)
   */
  encodeMovabs(section, operands) {
    if (operands.length !== 2) return;

    const [src, dst] = operands;
    if (dst.type !== 'reg' || src.type !== 'imm') return;

    // REX.W + B8+rd + imm64
    section.push(this.buildRex(true, false, false, dst.extended));
    section.push(0xB8 + dst.code);
    this.pushInt64(section, BigInt(src.value));
    this.currentOffset += 10;
  }

  /**
   * Encode MOVZX (zero-extend)
   */
  encodeMovzx(section, operands) {
    if (operands.length !== 2) return;

    const [src, dst] = operands;

    // movzbl: 0F B6 /r (byte to long)
    // movzbq: REX.W 0F B6 /r (byte to quad)
    // movzwl: 0F B7 /r (word to long)
    // movzwq: REX.W 0F B7 /r (word to quad)

    const is64 = dst.size === 64;
    const srcSize = src.size || 8;

    const needsRex = is64 || dst.extended || (src.type === 'reg' && src.extended);
    if (needsRex) {
      section.push(this.buildRex(is64, dst.extended, false, src.type === 'reg' && src.extended));
    }

    section.push(0x0F);
    section.push(srcSize === 8 ? 0xB6 : 0xB7);

    if (src.type === 'reg') {
      section.push(this.buildModRM(3, dst.code, src.code));
      this.currentOffset += (needsRex ? 1 : 0) + 3;
    } else if (src.type === 'mem') {
      // Memory source
      const memBytes = this.encodeMemoryOperand(src, dst.code, dst.extended, false, srcSize === 8 ? 0xB6 : 0xB7);
      // Remove the opcode we just pushed, the encodeMemoryOperand adds it
      section.pop();
      section.pop();
      for (const b of memBytes) section.push(b);
      this.currentOffset += memBytes.length - 2 + (needsRex ? 1 : 0) + 2;
    }
  }

  /**
   * Encode MOVSX (sign-extend)
   */
  encodeMovsx(section, operands) {
    if (operands.length !== 2) return;

    const [src, dst] = operands;
    const is64 = dst.size === 64;
    const srcSize = src.size || 8;

    const needsRex = is64 || dst.extended || (src.type === 'reg' && src.extended);
    if (needsRex) {
      section.push(this.buildRex(is64, dst.extended, false, src.type === 'reg' && src.extended));
    }

    if (srcSize === 32 && is64) {
      // movsxd (63 /r)
      section.push(0x63);
    } else {
      section.push(0x0F);
      section.push(srcSize === 8 ? 0xBE : 0xBF);
    }

    if (src.type === 'reg') {
      section.push(this.buildModRM(3, dst.code, src.code));
    }

    this.currentOffset += (needsRex ? 1 : 0) + (srcSize === 32 ? 2 : 3);
  }

  /**
   * Encode LEA instruction
   */
  encodeLea(section, operands) {
    if (operands.length !== 2) return;

    const [src, dst] = operands;
    if (dst.type !== 'reg' || src.type !== 'mem') return;

    // LEA r64, m: REX.W + 8D /r
    const memBytes = this.encodeMemoryOperand(src, dst.code, dst.extended, true, 0x8D);
    for (const b of memBytes) section.push(b);
    this.currentOffset += memBytes.length;
  }

  /**
   * Encode PUSH instruction
   */
  encodePush(section, operands) {
    if (operands.length !== 1) return;

    const op = operands[0];

    if (op.type === 'reg') {
      // PUSH r64: 50+rd
      if (op.extended) {
        section.push(this.buildRex(false, false, false, true));
        this.currentOffset += 1;
      }
      section.push(0x50 + op.code);
      this.currentOffset += 1;
    } else if (op.type === 'imm') {
      if (op.value >= -128 && op.value <= 127) {
        // PUSH imm8
        section.push(0x6A);
        section.push(op.value & 0xFF);
        this.currentOffset += 2;
      } else {
        // PUSH imm32
        section.push(0x68);
        this.pushInt32(section, op.value);
        this.currentOffset += 5;
      }
    }
  }

  /**
   * Encode POP instruction
   */
  encodePop(section, operands) {
    if (operands.length !== 1) return;

    const op = operands[0];

    if (op.type === 'reg') {
      // POP r64: 58+rd
      if (op.extended) {
        section.push(this.buildRex(false, false, false, true));
        this.currentOffset += 1;
      }
      section.push(0x58 + op.code);
      this.currentOffset += 1;
    }
  }

  /**
   * Encode arithmetic instructions (ADD, SUB, AND, OR, XOR, CMP)
   */
  encodeArith(section, operands, opcodeRmR, opcodeRRm, immOpExt) {
    if (operands.length !== 2) return;

    const [src, dst] = operands;
    const is64 = (dst.type === 'reg' && dst.size === 64) ||
                 (src.type === 'reg' && src.size === 64);

    // ADD r/m64, imm
    if (dst.type === 'reg' && src.type === 'imm') {
      const needsRex = is64 || dst.extended;

      if (needsRex) {
        section.push(this.buildRex(is64, false, false, dst.extended));
      }

      if (src.value >= -128 && src.value <= 127) {
        // imm8
        section.push(0x83);
        section.push(this.buildModRM(3, immOpExt, dst.code));
        section.push(src.value & 0xFF);
        this.currentOffset += (needsRex ? 1 : 0) + 3;
      } else {
        // imm32
        section.push(0x81);
        section.push(this.buildModRM(3, immOpExt, dst.code));
        this.pushInt32(section, src.value);
        this.currentOffset += (needsRex ? 1 : 0) + 2 + 4;
      }
      return;
    }

    // ADD r/m64, r64
    if (dst.type === 'reg' && src.type === 'reg') {
      const needsRex = is64 || dst.extended || src.extended;

      if (needsRex) {
        section.push(this.buildRex(is64, src.extended, false, dst.extended));
      }
      section.push(opcodeRmR);
      section.push(this.buildModRM(3, src.code, dst.code));
      this.currentOffset += (needsRex ? 1 : 0) + 2;
      return;
    }

    // ADD r64, r/m64
    if (dst.type === 'reg' && src.type === 'mem') {
      const memBytes = this.encodeMemoryOperand(src, dst.code, dst.extended, is64, opcodeRRm);
      for (const b of memBytes) section.push(b);
      this.currentOffset += memBytes.length;
      return;
    }

    // ADD r/m64, r64 (memory destination)
    if (dst.type === 'mem' && src.type === 'reg') {
      const memBytes = this.encodeMemoryOperand(dst, src.code, src.extended, is64, opcodeRmR);
      for (const b of memBytes) section.push(b);
      this.currentOffset += memBytes.length;
      return;
    }
  }

  /**
   * Encode IMUL instruction
   */
  encodeImul(section, operands) {
    if (operands.length === 1) {
      // IMUL r/m64: F7 /5
      const op = operands[0];
      const is64 = op.type === 'reg' && op.size === 64;
      const needsRex = is64 || (op.type === 'reg' && op.extended);

      if (needsRex) {
        section.push(this.buildRex(is64, false, false, op.type === 'reg' && op.extended));
      }
      section.push(0xF7);
      section.push(this.buildModRM(3, 5, op.type === 'reg' ? op.code : 0));
      this.currentOffset += (needsRex ? 1 : 0) + 2;
    } else if (operands.length === 2) {
      // IMUL r64, r/m64: 0F AF /r
      const [src, dst] = operands;
      const is64 = dst.size === 64;
      const needsRex = is64 || dst.extended || (src.type === 'reg' && src.extended);

      if (needsRex) {
        section.push(this.buildRex(is64, dst.extended, false, src.type === 'reg' && src.extended));
      }
      section.push(0x0F);
      section.push(0xAF);
      section.push(this.buildModRM(3, dst.code, src.type === 'reg' ? src.code : 0));
      this.currentOffset += (needsRex ? 1 : 0) + 3;
    } else if (operands.length === 3) {
      // IMUL r64, r/m64, imm
      const [imm, src, dst] = operands;
      const is64 = dst.size === 64;
      const needsRex = is64 || dst.extended || (src.type === 'reg' && src.extended);

      if (needsRex) {
        section.push(this.buildRex(is64, dst.extended, false, src.type === 'reg' && src.extended));
      }

      if (imm.value >= -128 && imm.value <= 127) {
        section.push(0x6B);
        section.push(this.buildModRM(3, dst.code, src.type === 'reg' ? src.code : 0));
        section.push(imm.value & 0xFF);
        this.currentOffset += (needsRex ? 1 : 0) + 3;
      } else {
        section.push(0x69);
        section.push(this.buildModRM(3, dst.code, src.type === 'reg' ? src.code : 0));
        this.pushInt32(section, imm.value);
        this.currentOffset += (needsRex ? 1 : 0) + 2 + 4;
      }
    }
  }

  /**
   * Encode unary arithmetic (INC, DEC, NEG, NOT, IDIV, DIV)
   */
  encodeUnaryArith(section, operands, opExt) {
    if (operands.length !== 1) return;

    const op = operands[0];
    const is64 = op.type === 'reg' && op.size === 64;
    const needsRex = is64 || (op.type === 'reg' && op.extended);

    if (needsRex) {
      section.push(this.buildRex(is64, false, false, op.type === 'reg' && op.extended));
    }
    section.push(0xF7);
    section.push(this.buildModRM(3, opExt, op.type === 'reg' ? op.code : 0));
    this.currentOffset += (needsRex ? 1 : 0) + 2;
  }

  /**
   * Encode shift instructions (SHL, SHR, SAR)
   */
  encodeShift(section, operands, opExt) {
    if (operands.length !== 2) return;

    const [src, dst] = operands;
    const is64 = dst.type === 'reg' && dst.size === 64;
    const needsRex = is64 || (dst.type === 'reg' && dst.extended);

    if (needsRex) {
      section.push(this.buildRex(is64, false, false, dst.type === 'reg' && dst.extended));
    }

    if (src.type === 'imm') {
      if (src.value === 1) {
        section.push(0xD1);
        section.push(this.buildModRM(3, opExt, dst.code));
        this.currentOffset += (needsRex ? 1 : 0) + 2;
      } else {
        section.push(0xC1);
        section.push(this.buildModRM(3, opExt, dst.code));
        section.push(src.value & 0xFF);
        this.currentOffset += (needsRex ? 1 : 0) + 3;
      }
    } else if (src.type === 'reg' && src.name === 'cl') {
      // Shift by CL
      section.push(0xD3);
      section.push(this.buildModRM(3, opExt, dst.code));
      this.currentOffset += (needsRex ? 1 : 0) + 2;
    }
  }

  /**
   * Encode TEST instruction
   */
  encodeTest(section, operands) {
    if (operands.length !== 2) return;

    const [src, dst] = operands;
    const is64 = (dst.type === 'reg' && dst.size === 64) ||
                 (src.type === 'reg' && src.size === 64);

    // TEST r/m64, r64
    if (dst.type === 'reg' && src.type === 'reg') {
      const needsRex = is64 || dst.extended || src.extended;

      if (needsRex) {
        section.push(this.buildRex(is64, src.extended, false, dst.extended));
      }
      section.push(0x85);
      section.push(this.buildModRM(3, src.code, dst.code));
      this.currentOffset += (needsRex ? 1 : 0) + 2;
      return;
    }

    // TEST r/m64, imm32
    if (dst.type === 'reg' && src.type === 'imm') {
      const needsRex = is64 || dst.extended;

      if (needsRex) {
        section.push(this.buildRex(is64, false, false, dst.extended));
      }

      if (dst.code === 0) {
        // TEST AL/AX/EAX/RAX, imm
        section.push(0xA9);
        this.pushInt32(section, src.value);
        this.currentOffset += (needsRex ? 1 : 0) + 5;
      } else {
        section.push(0xF7);
        section.push(this.buildModRM(3, 0, dst.code));
        this.pushInt32(section, src.value);
        this.currentOffset += (needsRex ? 1 : 0) + 2 + 4;
      }
    }
  }

  /**
   * Encode SETcc instructions
   */
  encodeSetcc(section, operands, opcode) {
    if (operands.length !== 1) return;

    const op = operands[0];

    if (op.type === 'reg') {
      const needsRex = op.extended || op.size === 8;

      if (needsRex && op.extended) {
        section.push(this.buildRex(false, false, false, op.extended));
      }
      section.push(0x0F);
      section.push(opcode);
      section.push(this.buildModRM(3, 0, op.code));
      this.currentOffset += (needsRex && op.extended ? 1 : 0) + 3;
    }
  }

  /**
   * Encode unconditional JMP instruction
   */
  encodeJump(section, operands, opcode) {
    if (operands.length !== 1) return;

    const op = operands[0];

    if (op.type === 'label') {
      // JMP rel32
      section.push(opcode);
      this.pending.push({
        offset: section.length,
        label: op.name,
        size: 4,
        pcRelative: true
      });
      this.pushInt32(section, 0);
      this.currentOffset += 5;
    } else if (op.type === 'reg') {
      // JMP r/m64: FF /4
      const needsRex = op.extended;
      if (needsRex) {
        section.push(this.buildRex(false, false, false, op.extended));
      }
      section.push(0xFF);
      section.push(this.buildModRM(3, 4, op.code));
      this.currentOffset += (needsRex ? 1 : 0) + 2;
    }
  }

  /**
   * Encode conditional jump instructions
   */
  encodeCondJump(section, operands, opcode) {
    if (operands.length !== 1) return;

    const op = operands[0];

    if (op.type === 'label') {
      // Jcc rel32: 0F 8x
      section.push(0x0F);
      section.push(opcode);
      this.pending.push({
        offset: section.length,
        label: op.name,
        size: 4,
        pcRelative: true
      });
      this.pushInt32(section, 0);
      this.currentOffset += 6;
    }
  }

  /**
   * Encode CALL instruction
   */
  encodeCall(section, operands) {
    if (operands.length !== 1) return;

    const op = operands[0];

    if (op.type === 'label') {
      // CALL rel32: E8 cd
      section.push(0xE8);
      this.pending.push({
        offset: section.length,
        label: op.name,
        size: 4,
        pcRelative: true
      });
      this.pushInt32(section, 0);
      this.currentOffset += 5;
    } else if (op.type === 'reg') {
      // CALL r/m64: FF /2
      const needsRex = op.extended;
      if (needsRex) {
        section.push(this.buildRex(false, false, false, op.extended));
      }
      section.push(0xFF);
      section.push(this.buildModRM(3, 2, op.code));
      this.currentOffset += (needsRex ? 1 : 0) + 2;
    }
  }

  /**
   * Resolve pending label references
   */
  resolvePendingLabels() {
    for (const pending of this.pending) {
      if (!this.labels.has(pending.label)) {
        // External symbol - add relocation
        this.relocations.push({
          section: 'text',
          offset: pending.offset,
          symbol: pending.label,
          type: pending.pcRelative ? 'R_X86_64_PC32' : 'R_X86_64_32',
          addend: pending.pcRelative ? -4 : 0
        });
        continue;
      }

      const targetOffset = this.labels.get(pending.label);
      const section = this.sections.text;

      if (pending.pcRelative) {
        // PC-relative: target - (instruction end)
        const instrEnd = pending.offset + pending.size;
        const rel = targetOffset - instrEnd;
        this.patchInt32(section, pending.offset, rel);
      } else {
        // Absolute
        this.patchInt32(section, pending.offset, targetOffset);
      }
    }
  }

  /**
   * Push a 32-bit value to section (little-endian)
   */
  pushInt32(section, value) {
    const signed = value | 0;
    section.push(signed & 0xFF);
    section.push((signed >> 8) & 0xFF);
    section.push((signed >> 16) & 0xFF);
    section.push((signed >> 24) & 0xFF);
  }

  /**
   * Patch a 32-bit value at offset
   */
  patchInt32(section, offset, value) {
    const signed = value | 0;
    section[offset] = signed & 0xFF;
    section[offset + 1] = (signed >> 8) & 0xFF;
    section[offset + 2] = (signed >> 16) & 0xFF;
    section[offset + 3] = (signed >> 24) & 0xFF;
  }

  /**
   * Push a 64-bit value to section (little-endian)
   */
  pushInt64(section, value) {
    const bigVal = BigInt(value);
    for (let i = 0; i < 8; i++) {
      section.push(Number((bigVal >> BigInt(i * 8)) & BigInt(0xFF)));
    }
  }

  /**
   * Get a simple exit program for testing
   */
  static getMinimalExitProgram(exitCode = 0) {
    return `
.text
.globl _start
_start:
    mov $${exitCode}, %edi     # exit code
    mov $60, %eax              # syscall: exit
    syscall
`;
  }

  /**
   * Get a hello world program for testing
   */
  static getHelloWorldProgram() {
    return `
.data
message:
    .asciz "Hello, World!\\n"
message_len = . - message

.text
.globl _start
_start:
    # write(1, message, len)
    mov $1, %edi               # fd = stdout
    lea message(%rip), %rsi    # buf = message
    mov $14, %edx              # len
    mov $1, %eax               # syscall: write
    syscall

    # exit(0)
    xor %edi, %edi             # exit code = 0
    mov $60, %eax              # syscall: exit
    syscall
`;
  }
}

module.exports = { X86CodeGenerator, REGISTERS };
