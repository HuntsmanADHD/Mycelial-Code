/**
 * Binary Generator - Integrates x86-64 codegen with ELF linker
 *
 * This module bridges the gap between the Mycelial interpreter/compiler
 * and the x86-64 code generator + ELF linker. It can:
 *
 * 1. Take assembly text output from compiler agents and generate machine code
 * 2. Create complete ELF executables from the generated code
 * 3. Provide utilities for testing individual instruction encoding
 *
 * @author Opus (Claude Opus 4.5)
 * @date 2026-01-07
 */

const { X86CodeGenerator } = require('./codegen-x86.js');
const { ELFLinker, ELF } = require('./elf-linker.js');
const fs = require('fs');

/**
 * Binary Generator class
 */
class BinaryGenerator {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.codegen = new X86CodeGenerator();
    this.linker = null;

    // Accumulated assembly sections
    this.asmSections = {
      text: [],
      rodata: [],
      data: []
    };

    // Assembly text buffer (for assembly-based code generation)
    this.asmBuffer = '';

    // Generated binary
    this.outputBinary = null;
  }

  /**
   * Reset generator state
   */
  reset() {
    this.codegen.reset();
    this.linker = null;
    this.asmSections = {
      text: [],
      rodata: [],
      data: []
    };
    this.asmBuffer = '';
    this.outputBinary = null;
  }

  /**
   * Add assembly instruction to the buffer
   * @param {Object} instr - Assembly instruction { label, mnemonic, operands }
   */
  addInstruction(instr) {
    let line = '';

    if (instr.label) {
      line += `${instr.label}:\n`;
    }

    if (instr.mnemonic) {
      const operandStr = (instr.operands || []).join(', ');
      line += `    ${instr.mnemonic} ${operandStr}\n`;
    }

    this.asmBuffer += line;
  }

  /**
   * Add data directive to the buffer
   * @param {Object} data - Data directive { label, dataType, value }
   */
  addData(data) {
    let line = '';

    if (data.label) {
      line += `${data.label}:\n`;
    }

    if (data.dataType && data.value !== undefined) {
      line += `    .${data.dataType} ${data.value}\n`;
    }

    this.asmBuffer += line;
  }

  /**
   * Set assembly text directly
   * @param {string} asmText - Complete assembly text
   */
  setAssemblyText(asmText) {
    this.asmBuffer = asmText;
  }

  /**
   * Append to assembly text
   * @param {string} asmText - Assembly text to append
   */
  appendAssembly(asmText) {
    this.asmBuffer += asmText + '\n';
  }

  /**
   * Generate binary from accumulated assembly
   * @returns {Buffer} ELF binary
   */
  generate() {
    if (!this.asmBuffer) {
      throw new Error('No assembly code to generate');
    }

    if (this.verbose) {
      console.log('[CODEGEN] Assembling code...');
      console.log(this.asmBuffer.substring(0, 500));
    }

    // Assemble to machine code
    const asmResult = this.codegen.assemble(this.asmBuffer);

    if (this.verbose) {
      console.log(`[CODEGEN] Generated ${asmResult.code.length} bytes of code`);
      console.log(`[CODEGEN] Symbols: ${asmResult.symbols.size}`);
      console.log(`[CODEGEN] Relocations: ${asmResult.relocations.length}`);
    }

    // Link to ELF
    this.linker = new ELFLinker();
    this.linker.addSection('.text', asmResult.code);
    this.linker.addSection('.rodata', asmResult.rodata);
    this.linker.addSection('.data', asmResult.data);
    this.linker.addSection('.bss', asmResult.bss);
    this.linker.addSymbols(asmResult.symbols);
    this.linker.addRelocations(asmResult.relocations);

    this.outputBinary = this.linker.link();

    if (this.verbose) {
      console.log(`[LINKER] Generated ELF binary: ${this.outputBinary.length} bytes`);
      console.log(`[LINKER] Entry point: 0x${this.linker.getEntryPoint().toString(16)}`);
    }

    return this.outputBinary;
  }

  /**
   * Generate from existing assembly result
   * @param {Object} asmResult - Result from X86CodeGenerator.assemble()
   * @returns {Buffer} ELF binary
   */
  generateFromAsmResult(asmResult) {
    return ELFLinker.createExecutable(asmResult);
  }

  /**
   * Write generated binary to file
   * @param {string} path - Output file path
   * @param {boolean} makeExecutable - Set executable permission
   */
  writeToFile(path, makeExecutable = true) {
    if (!this.outputBinary) {
      throw new Error('No binary generated yet. Call generate() first.');
    }

    fs.writeFileSync(path, this.outputBinary);

    if (makeExecutable) {
      fs.chmodSync(path, 0o755);
    }

    if (this.verbose) {
      console.log(`[OUTPUT] Written ${this.outputBinary.length} bytes to ${path}`);
    }
  }

  /**
   * Get the generated binary
   * @returns {Buffer} ELF binary
   */
  getBinary() {
    return this.outputBinary;
  }

  /**
   * Get assembly buffer for inspection
   * @returns {string} Assembly text
   */
  getAssembly() {
    return this.asmBuffer;
  }

  // ============================================================================
  // STATIC FACTORY METHODS
  // ============================================================================

  /**
   * Create a minimal exit program
   * @param {number} exitCode - Exit code (default 0)
   * @returns {Buffer} ELF binary
   */
  static createExitProgram(exitCode = 0) {
    return ELFLinker.createMinimalExitProgram(exitCode);
  }

  /**
   * Create a hello world program
   * @returns {Buffer} ELF binary
   */
  static createHelloWorld() {
    return ELFLinker.createHelloWorldProgram();
  }

  /**
   * Create executable from assembly text
   * @param {string} asmText - Assembly text
   * @param {Object} options - Options { verbose }
   * @returns {Buffer} ELF binary
   */
  static fromAssembly(asmText, options = {}) {
    const gen = new BinaryGenerator(options);
    gen.setAssemblyText(asmText);
    return gen.generate();
  }

  /**
   * Assemble text without linking
   * @param {string} asmText - Assembly text
   * @returns {Object} { code, rodata, data, symbols, relocations }
   */
  static assembleOnly(asmText) {
    const codegen = new X86CodeGenerator();
    return codegen.assemble(asmText);
  }

  /**
   * Test single instruction encoding
   * @param {string} instruction - Assembly instruction
   * @returns {Buffer} Machine code bytes
   */
  static encodeInstruction(instruction) {
    const asmText = `.text\n_start:\n    ${instruction}\n`;
    const codegen = new X86CodeGenerator();
    const result = codegen.assemble(asmText);
    return result.code;
  }

  // ============================================================================
  // INTEGRATION WITH MYCELIAL RUNTIME
  // ============================================================================

  /**
   * Process signals from code generator agents
   * @param {Array} signals - Array of asm_instruction signals
   */
  processCodegenSignals(signals) {
    for (const signal of signals) {
      if (signal.frequency === 'asm_instruction') {
        this.addInstruction(signal.payload);
      } else if (signal.frequency === 'asm_data') {
        this.addData(signal.payload);
      } else if (signal.frequency === 'asm_section') {
        this.appendAssembly(`.section ${signal.payload.name}`);
      }
    }
  }

  /**
   * Create a compiler bootstrap program
   * This generates the minimal runtime needed for a self-hosting compiler.
   * Uses stack-based storage instead of complex RIP-relative data access.
   * @returns {Buffer} ELF binary with compiler bootstrap code
   */
  static createCompilerBootstrap() {
    // This generates a minimal compiler that:
    // 1. Checks for proper arguments (input and output paths)
    // 2. Opens and reads the input file
    // 3. Writes a basic ELF binary to output
    // 4. Exits with status code indicating success/failure
    //
    // Stack layout (negative offsets from rbp):
    //   -8:   input_fd
    //   -16:  output_fd
    //   -24:  input_path (pointer)
    //   -32:  output_path (pointer)
    //   -40:  file_size
    //   -168: ELF header buffer (128 bytes)
    //   -8360: file_buffer (8192 bytes)

    const asmText = `
.text
.globl _start

# ELF header template (embedded in code as data)
elf_template:
    .byte 0x7f, 0x45, 0x4c, 0x46    # Magic: \\x7FELF
    .byte 0x02                       # Class: 64-bit
    .byte 0x01                       # Data: little-endian
    .byte 0x01                       # Version
    .byte 0x00                       # OS/ABI
    .byte 0x00, 0x00, 0x00, 0x00    # Padding
    .byte 0x00, 0x00, 0x00, 0x00
    .byte 0x02, 0x00                 # Type: executable
    .byte 0x3e, 0x00                 # Machine: x86-64
    .byte 0x01, 0x00, 0x00, 0x00     # Version
    .byte 0x78, 0x00, 0x40, 0x00     # Entry point: 0x400078
    .byte 0x00, 0x00, 0x00, 0x00
    .byte 0x40, 0x00, 0x00, 0x00     # Program header offset: 64
    .byte 0x00, 0x00, 0x00, 0x00
    .byte 0x00, 0x00, 0x00, 0x00     # Section header offset
    .byte 0x00, 0x00, 0x00, 0x00
    .byte 0x00, 0x00, 0x00, 0x00     # Flags
    .byte 0x40, 0x00                 # ELF header size: 64
    .byte 0x38, 0x00                 # Program header size: 56
    .byte 0x01, 0x00                 # Number of program headers
    .byte 0x40, 0x00                 # Section header size
    .byte 0x00, 0x00                 # Number of section headers
    .byte 0x00, 0x00                 # Section name string table index

# Program header template
phdr_template:
    .byte 0x01, 0x00, 0x00, 0x00     # Type: PT_LOAD
    .byte 0x05, 0x00, 0x00, 0x00     # Flags: PF_R | PF_X
    .byte 0x00, 0x00, 0x00, 0x00     # Offset
    .byte 0x00, 0x00, 0x00, 0x00
    .byte 0x00, 0x00, 0x40, 0x00     # Virtual address: 0x400000
    .byte 0x00, 0x00, 0x00, 0x00
    .byte 0x00, 0x00, 0x40, 0x00     # Physical address: 0x400000
    .byte 0x00, 0x00, 0x00, 0x00
    .byte 0x84, 0x00, 0x00, 0x00     # File size: 132 (64+56+12)
    .byte 0x00, 0x00, 0x00, 0x00
    .byte 0x84, 0x00, 0x00, 0x00     # Memory size: 132
    .byte 0x00, 0x00, 0x00, 0x00
    .byte 0x00, 0x10, 0x00, 0x00     # Alignment: 0x1000
    .byte 0x00, 0x00, 0x00, 0x00

# Exit code template (12 bytes)
exit_template:
    .byte 0xbf, 0x00, 0x00, 0x00, 0x00   # mov $0, %edi
    .byte 0xb8, 0x3c, 0x00, 0x00, 0x00   # mov $60, %eax
    .byte 0x0f, 0x05                     # syscall

_start:
    # At _start, RSP points directly to argc on the stack
    # Stack layout:
    #   [rsp]      = argc
    #   [rsp + 8]  = argv[0] (program name)
    #   [rsp + 16] = argv[1] (first arg)
    #   [rsp + 24] = argv[2] (second arg)
    #   ...

    # Save argc and argv pointer
    mov (%rsp), %r12           # r12 = argc
    lea 8(%rsp), %r13          # r13 = &argv[0]

    # Set up stack frame
    push %rbp
    mov %rsp, %rbp
    sub $8368, %rsp            # Stack space for local variables

    # Check argc >= 3 (program, input, output)
    cmp $3, %r12
    jl error_usage

    # Save input_path (argv[1])
    mov 8(%r13), %rax
    mov %rax, -24(%rbp)

    # Save output_path (argv[2])
    mov 16(%r13), %rax
    mov %rax, -32(%rbp)

    # === Open input file ===
    mov -24(%rbp), %rdi        # input_path
    xor %esi, %esi             # O_RDONLY = 0
    xor %edx, %edx             # mode = 0
    mov $2, %eax               # syscall: open
    syscall

    # Check for error
    test %rax, %rax
    js error_open_input

    # Save file descriptor
    mov %rax, -8(%rbp)

    # === Read input file ===
    mov -8(%rbp), %rdi         # input_fd
    lea -8360(%rbp), %rsi      # file_buffer
    mov $8192, %edx
    xor %eax, %eax             # syscall: read = 0
    syscall

    # Check for error
    test %rax, %rax
    js error_read

    # Save file size
    mov %rax, -40(%rbp)

    # === Close input file ===
    mov -8(%rbp), %rdi
    mov $3, %eax               # syscall: close
    syscall

    # === Create output file ===
    mov -32(%rbp), %rdi        # output_path
    mov $577, %esi             # O_WRONLY|O_CREAT|O_TRUNC
    mov $493, %edx             # 0755
    mov $2, %eax               # syscall: open
    syscall

    # Check for error
    test %rax, %rax
    js error_open_output

    # Save file descriptor
    mov %rax, -16(%rbp)

    # === Write ELF header ===
    mov -16(%rbp), %rdi
    lea elf_template(%rip), %rsi
    mov $64, %edx
    mov $1, %eax               # syscall: write
    syscall

    # === Write program header ===
    mov -16(%rbp), %rdi
    lea phdr_template(%rip), %rsi
    mov $56, %edx
    mov $1, %eax               # syscall: write
    syscall

    # === Write exit code ===
    mov -16(%rbp), %rdi
    lea exit_template(%rip), %rsi
    mov $12, %edx
    mov $1, %eax               # syscall: write
    syscall

    # === Close output file ===
    mov -16(%rbp), %rdi
    mov $3, %eax               # syscall: close
    syscall

    # === Exit success ===
    xor %edi, %edi
    jmp do_exit

error_usage:
    mov $1, %edi
    jmp do_exit

error_open_input:
    mov $2, %edi
    jmp do_exit

error_read:
    mov $3, %edi
    jmp do_exit

error_open_output:
    mov $4, %edi
    jmp do_exit

do_exit:
    mov %rbp, %rsp
    pop %rbp
    mov $60, %eax              # syscall: exit
    syscall
`;

    const gen = new BinaryGenerator({ verbose: false });
    gen.setAssemblyText(asmText);
    return gen.generate();
  }
}

// ============================================================================
// TEST HARNESS
// ============================================================================

/**
 * Run tests on the binary generator
 */
function runTests() {
  console.log('='.repeat(70));
  console.log('  BINARY GENERATOR TESTS');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  // Test 1: Encode single instruction
  function test(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (error) {
      console.log(`[FAIL] ${name}: ${error.message}`);
      failed++;
    }
  }

  // Test instruction encoding
  test('mov rax, 1', () => {
    const code = BinaryGenerator.encodeInstruction('mov $1, %rax');
    if (code.length === 0) throw new Error('No code generated');
    // mov $1, %rax should be: 48 c7 c0 01 00 00 00 or 48 b8 01 00 ...
    if (code[0] !== 0x48) throw new Error(`Expected REX.W prefix 0x48, got 0x${code[0].toString(16)}`);
  });

  test('xor rdi, rdi', () => {
    const code = BinaryGenerator.encodeInstruction('xor %rdi, %rdi');
    if (code.length === 0) throw new Error('No code generated');
    // xor %rdi, %rdi: 48 31 ff
    if (code[0] !== 0x48) throw new Error(`Expected 0x48, got 0x${code[0].toString(16)}`);
  });

  test('syscall', () => {
    const code = BinaryGenerator.encodeInstruction('syscall');
    if (code.length !== 2) throw new Error(`Expected 2 bytes, got ${code.length}`);
    if (code[0] !== 0x0F || code[1] !== 0x05) {
      throw new Error(`Expected 0F 05, got ${code[0].toString(16)} ${code[1].toString(16)}`);
    }
  });

  test('ret', () => {
    const code = BinaryGenerator.encodeInstruction('ret');
    if (code.length !== 1) throw new Error(`Expected 1 byte, got ${code.length}`);
    if (code[0] !== 0xC3) throw new Error(`Expected 0xC3, got 0x${code[0].toString(16)}`);
  });

  test('push rbp', () => {
    const code = BinaryGenerator.encodeInstruction('push %rbp');
    if (code.length === 0) throw new Error('No code generated');
    // push rbp: 55 (or with REX prefix)
  });

  test('pop rbp', () => {
    const code = BinaryGenerator.encodeInstruction('pop %rbp');
    if (code.length === 0) throw new Error('No code generated');
    // pop rbp: 5d
  });

  // Test minimal program generation
  test('Minimal exit program', () => {
    const binary = BinaryGenerator.createExitProgram(42);
    if (!Buffer.isBuffer(binary)) throw new Error('Expected Buffer');
    if (binary.length < 100) throw new Error(`Binary too small: ${binary.length} bytes`);
    // Check ELF magic
    if (binary[0] !== 0x7F || binary[1] !== 0x45 || binary[2] !== 0x4C || binary[3] !== 0x46) {
      throw new Error('Invalid ELF magic');
    }
  });

  test('Hello world program', () => {
    const binary = BinaryGenerator.createHelloWorld();
    if (!Buffer.isBuffer(binary)) throw new Error('Expected Buffer');
    if (binary.length < 100) throw new Error(`Binary too small: ${binary.length} bytes`);
    // Check ELF magic
    if (binary[0] !== 0x7F || binary[1] !== 0x45 || binary[2] !== 0x4C || binary[3] !== 0x46) {
      throw new Error('Invalid ELF magic');
    }
  });

  test('Full assembly program', () => {
    const asm = X86CodeGenerator.getMinimalExitProgram(0);
    const binary = BinaryGenerator.fromAssembly(asm);
    if (!Buffer.isBuffer(binary)) throw new Error('Expected Buffer');
    if (binary.length < 100) throw new Error(`Binary too small: ${binary.length} bytes`);
  });

  // Test compiler bootstrap
  test('Compiler bootstrap', () => {
    const binary = BinaryGenerator.createCompilerBootstrap();
    if (!Buffer.isBuffer(binary)) throw new Error('Expected Buffer');
    if (binary.length < 500) throw new Error(`Binary too small: ${binary.length} bytes`);
    // Check ELF magic
    if (binary[0] !== 0x7F || binary[1] !== 0x45 || binary[2] !== 0x4C || binary[3] !== 0x46) {
      throw new Error('Invalid ELF magic');
    }
    console.log(`  Bootstrap size: ${binary.length} bytes`);
  });

  console.log('='.repeat(70));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  return failed === 0;
}

// Export
module.exports = { BinaryGenerator, runTests };

// Run tests if executed directly
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
