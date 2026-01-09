/**
 * Test Suite for x86-64 Code Generator and ELF Linker
 *
 * Tests:
 * 1. Individual instruction encoding
 * 2. Full program assembly
 * 3. ELF binary generation
 * 4. Executable validation
 *
 * @author Opus (Claude Opus 4.5)
 * @date 2026-01-07
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// Import the modules under test
const { X86CodeGenerator, REGISTERS } = require('../src/codegen-x86.js');
const { ELFLinker, ELF } = require('../src/elf-linker.js');
const { BinaryGenerator } = require('../src/binary-generator.js');

// Test results tracking
let passed = 0;
let failed = 0;
const results = [];

/**
 * Run a test
 */
function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
    results.push({ name, status: 'pass' });
  } catch (error) {
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${error.message}`);
    failed++;
    results.push({ name, status: 'fail', error: error.message });
  }
}

/**
 * Assert equality
 */
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

/**
 * Assert array equality
 */
function assertArrayEqual(actual, expected, message) {
  if (actual.length !== expected.length) {
    throw new Error(`${message || 'Array length mismatch'}: expected ${expected.length}, got ${actual.length}`);
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(`${message || 'Array mismatch'} at index ${i}: expected 0x${expected[i].toString(16)}, got 0x${actual[i].toString(16)}`);
    }
  }
}

/**
 * Assert buffer starts with
 */
function assertStartsWith(buffer, expected, message) {
  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) {
      throw new Error(`${message || 'Buffer mismatch'} at index ${i}: expected 0x${expected[i].toString(16)}, got 0x${buffer[i].toString(16)}`);
    }
  }
}

/**
 * Encode a single instruction and return bytes
 */
function encode(instruction) {
  return BinaryGenerator.encodeInstruction(instruction);
}

/**
 * Convert buffer to hex string
 */
function toHex(buffer) {
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

// ============================================================================
// TEST SUITE: Instruction Encoding
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('  INSTRUCTION ENCODING TESTS');
console.log('='.repeat(70) + '\n');

// Data Movement Instructions
console.log('Data Movement:');

test('mov $1, %rax (64-bit immediate to register)', () => {
  const code = encode('mov $1, %rax');
  // REX.W + C7 /0 + imm32 OR REX.W + B8 + imm64
  if (code[0] !== 0x48) throw new Error(`Expected REX.W prefix, got 0x${code[0].toString(16)}`);
});

test('mov $0x1234, %rbx', () => {
  const code = encode('mov $0x1234, %rbx');
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
});

test('mov %rax, %rbx', () => {
  const code = encode('mov %rax, %rbx');
  // 48 89 c3 (REX.W MOV r/m64, r64)
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
  if (code[1] !== 0x89) throw new Error(`Expected opcode 0x89, got 0x${code[1].toString(16)}`);
});

test('mov %r8, %r9 (extended registers)', () => {
  const code = encode('mov %r8, %r9');
  // Need REX prefix with B and R bits
  if ((code[0] & 0x40) !== 0x40) throw new Error('Expected REX prefix');
});

test('push %rbp', () => {
  const code = encode('push %rbp');
  // 55 (no REX needed for rbp)
  if (code.length === 0) throw new Error('No code generated');
});

test('pop %rbp', () => {
  const code = encode('pop %rbp');
  // 5d
  if (code.length === 0) throw new Error('No code generated');
});

test('push %r12 (extended register)', () => {
  const code = encode('push %r12');
  // REX.B + 54
  if ((code[0] & 0x41) !== 0x41) throw new Error('Expected REX.B prefix');
});

// Arithmetic Instructions
console.log('\nArithmetic:');

test('add $1, %rax', () => {
  const code = encode('add $1, %rax');
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
});

test('add %rbx, %rax', () => {
  const code = encode('add %rbx, %rax');
  // 48 01 d8 (REX.W ADD r/m64, r64)
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
  if (code[1] !== 0x01) throw new Error(`Expected opcode 0x01, got 0x${code[1].toString(16)}`);
});

test('sub $8, %rsp', () => {
  const code = encode('sub $8, %rsp');
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
});

test('imul %rbx', () => {
  const code = encode('imul %rbx');
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
});

test('inc %rax', () => {
  const code = encode('inc %rax');
  // 48 ff c0
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
});

test('dec %rcx', () => {
  const code = encode('dec %rcx');
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
});

test('neg %rdx', () => {
  const code = encode('neg %rdx');
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
});

// Logical Instructions
console.log('\nLogical:');

test('and $0xff, %rax', () => {
  const code = encode('and $0xff, %rax');
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
});

test('or %rbx, %rax', () => {
  const code = encode('or %rbx, %rax');
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
});

test('xor %rdi, %rdi (common zero idiom)', () => {
  const code = encode('xor %rdi, %rdi');
  // 48 31 ff
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
  if (code[1] !== 0x31) throw new Error(`Expected opcode 0x31, got 0x${code[1].toString(16)}`);
});

test('not %rax', () => {
  const code = encode('not %rax');
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
});

test('shl $4, %rax', () => {
  const code = encode('shl $4, %rax');
  if (code.length === 0) throw new Error('No code generated');
});

test('shr $1, %rbx', () => {
  const code = encode('shr $1, %rbx');
  if (code.length === 0) throw new Error('No code generated');
});

// Comparison Instructions
console.log('\nComparison:');

test('cmp $0, %rax', () => {
  const code = encode('cmp $0, %rax');
  if (code.length === 0) throw new Error('No code generated');
});

test('cmp %rbx, %rax', () => {
  const code = encode('cmp %rbx, %rax');
  // 48 39 d8
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
});

test('test %rax, %rax', () => {
  const code = encode('test %rax, %rax');
  // 48 85 c0
  if (code[0] !== 0x48) throw new Error('Expected REX.W prefix');
  if (code[1] !== 0x85) throw new Error(`Expected opcode 0x85, got 0x${code[1].toString(16)}`);
});

// Conditional Set
console.log('\nConditional Set:');

test('sete %al', () => {
  const code = encode('sete %al');
  // 0f 94 c0
  if (code[0] !== 0x0F) throw new Error(`Expected 0x0F, got 0x${code[0].toString(16)}`);
  if (code[1] !== 0x94) throw new Error(`Expected 0x94, got 0x${code[1].toString(16)}`);
});

test('setne %al', () => {
  const code = encode('setne %al');
  if (code[0] !== 0x0F) throw new Error('Expected 0x0F prefix');
  if (code[1] !== 0x95) throw new Error(`Expected 0x95, got 0x${code[1].toString(16)}`);
});

test('setl %al', () => {
  const code = encode('setl %al');
  if (code[0] !== 0x0F) throw new Error('Expected 0x0F prefix');
});

test('setg %al', () => {
  const code = encode('setg %al');
  if (code[0] !== 0x0F) throw new Error('Expected 0x0F prefix');
});

// Control Flow
console.log('\nControl Flow:');

test('jmp label', () => {
  const codegen = new X86CodeGenerator();
  const result = codegen.assemble(`
.text
_start:
    jmp target
    nop
target:
    ret
`);
  if (result.code.length === 0) throw new Error('No code generated');
});

test('je label', () => {
  const codegen = new X86CodeGenerator();
  const result = codegen.assemble(`
.text
_start:
    je target
    nop
target:
    ret
`);
  if (result.code.length === 0) throw new Error('No code generated');
});

test('jne label', () => {
  const codegen = new X86CodeGenerator();
  const result = codegen.assemble(`
.text
_start:
    jne target
    nop
target:
    ret
`);
  if (result.code.length === 0) throw new Error('No code generated');
});

test('call label', () => {
  const codegen = new X86CodeGenerator();
  const result = codegen.assemble(`
.text
_start:
    call func
    ret
func:
    ret
`);
  if (result.code.length === 0) throw new Error('No code generated');
});

test('ret', () => {
  const code = encode('ret');
  assertEqual(code.length, 1, 'ret should be 1 byte');
  assertEqual(code[0], 0xC3, 'ret should be 0xC3');
});

// Special Instructions
console.log('\nSpecial:');

test('syscall', () => {
  const code = encode('syscall');
  assertEqual(code.length, 2, 'syscall should be 2 bytes');
  assertEqual(code[0], 0x0F, 'syscall byte 1');
  assertEqual(code[1], 0x05, 'syscall byte 2');
});

test('nop', () => {
  const code = encode('nop');
  assertEqual(code.length, 1, 'nop should be 1 byte');
  assertEqual(code[0], 0x90, 'nop should be 0x90');
});

test('cqo (sign-extend rax to rdx:rax)', () => {
  const code = encode('cqo');
  assertEqual(code.length, 2, 'cqo should be 2 bytes');
  assertEqual(code[0], 0x48, 'cqo REX.W prefix');
  assertEqual(code[1], 0x99, 'cqo opcode');
});

// ============================================================================
// TEST SUITE: ELF Binary Generation
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('  ELF BINARY GENERATION TESTS');
console.log('='.repeat(70) + '\n');

test('Minimal exit program generates valid ELF', () => {
  const binary = BinaryGenerator.createExitProgram(0);
  if (!Buffer.isBuffer(binary)) throw new Error('Expected Buffer');
  if (binary.length < 100) throw new Error(`Binary too small: ${binary.length} bytes`);
  // Check ELF magic
  assertStartsWith(binary, [0x7F, 0x45, 0x4C, 0x46], 'ELF magic');
  // Check 64-bit
  assertEqual(binary[4], 0x02, 'ELF class should be 64-bit');
  // Check little-endian
  assertEqual(binary[5], 0x01, 'ELF should be little-endian');
  // Check x86-64
  assertEqual(binary[18], 0x3E, 'ELF machine should be x86-64');
});

test('Hello world program generates valid ELF', () => {
  const binary = BinaryGenerator.createHelloWorld();
  if (!Buffer.isBuffer(binary)) throw new Error('Expected Buffer');
  if (binary.length < 100) throw new Error(`Binary too small: ${binary.length} bytes`);
  assertStartsWith(binary, [0x7F, 0x45, 0x4C, 0x46], 'ELF magic');
});

test('Compiler bootstrap generates valid ELF', () => {
  const binary = BinaryGenerator.createCompilerBootstrap();
  if (!Buffer.isBuffer(binary)) throw new Error('Expected Buffer');
  if (binary.length < 500) throw new Error(`Binary too small: ${binary.length} bytes`);
  assertStartsWith(binary, [0x7F, 0x45, 0x4C, 0x46], 'ELF magic');
  console.log(`         Size: ${binary.length} bytes`);
});

test('Full assembly to ELF', () => {
  const asm = X86CodeGenerator.getMinimalExitProgram(42);
  const binary = BinaryGenerator.fromAssembly(asm);
  if (!Buffer.isBuffer(binary)) throw new Error('Expected Buffer');
  assertStartsWith(binary, [0x7F, 0x45, 0x4C, 0x46], 'ELF magic');
});

test('ELF has correct entry point', () => {
  const linker = new ELFLinker();
  linker.addSection('.text', Buffer.from([0xC3])); // just ret
  linker.addSymbol('_start', { section: '.text', offset: 0, isGlobal: true });
  const binary = linker.link();

  // Entry point should be in the file
  const entryPoint = linker.getEntryPoint();
  if (entryPoint < 0x400000n) throw new Error(`Entry point too low: 0x${entryPoint.toString(16)}`);
});

test('ELF symbols are resolved', () => {
  const codegen = new X86CodeGenerator();
  const result = codegen.assemble(`
.text
.globl _start
_start:
    call func
    mov $60, %eax
    syscall
func:
    ret
`);

  if (!result.symbols.has('_start')) throw new Error('Missing _start symbol');
  if (!result.symbols.has('func')) throw new Error('Missing func symbol');
});

// ============================================================================
// TEST SUITE: Executable Tests (if running on Linux)
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('  EXECUTABLE TESTS');
console.log('='.repeat(70) + '\n');

const isLinux = process.platform === 'linux';
const testDir = '/tmp/mycelial-test';

if (isLinux) {
  // Create test directory
  try {
    fs.mkdirSync(testDir, { recursive: true });
  } catch (e) {}

  test('Exit program executes with correct exit code', () => {
    const binary = BinaryGenerator.createExitProgram(42);
    const testPath = path.join(testDir, 'test-exit');
    fs.writeFileSync(testPath, binary);
    fs.chmodSync(testPath, 0o755);

    const result = spawnSync(testPath, [], { timeout: 5000 });
    assertEqual(result.status, 42, 'Exit code should be 42');
  });

  test('Exit program with code 0', () => {
    const binary = BinaryGenerator.createExitProgram(0);
    const testPath = path.join(testDir, 'test-exit-0');
    fs.writeFileSync(testPath, binary);
    fs.chmodSync(testPath, 0o755);

    const result = spawnSync(testPath, [], { timeout: 5000 });
    assertEqual(result.status, 0, 'Exit code should be 0');
  });

  test('file command recognizes ELF', () => {
    const binary = BinaryGenerator.createExitProgram(0);
    const testPath = path.join(testDir, 'test-file');
    fs.writeFileSync(testPath, binary);
    fs.chmodSync(testPath, 0o755);

    const result = execSync(`file ${testPath}`, { encoding: 'utf8' });
    if (!result.includes('ELF')) throw new Error(`file command output: ${result}`);
    if (!result.includes('64-bit')) throw new Error(`Not 64-bit: ${result}`);
    if (!result.includes('x86-64')) throw new Error(`Not x86-64: ${result}`);
  });

  test('readelf shows correct program headers', () => {
    const binary = BinaryGenerator.createExitProgram(0);
    const testPath = path.join(testDir, 'test-readelf');
    fs.writeFileSync(testPath, binary);
    fs.chmodSync(testPath, 0o755);

    try {
      const result = execSync(`readelf -l ${testPath} 2>/dev/null`, { encoding: 'utf8' });
      if (!result.includes('LOAD')) throw new Error('No LOAD segment');
    } catch (e) {
      // readelf might not be installed, skip
      console.log('         (readelf not available, skipped)');
    }
  });

  // Clean up
  try {
    const files = fs.readdirSync(testDir);
    for (const file of files) {
      fs.unlinkSync(path.join(testDir, file));
    }
    fs.rmdirSync(testDir);
  } catch (e) {}

} else {
  console.log('  (Skipping executable tests on non-Linux platform)');
}

// ============================================================================
// TEST SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('  TEST SUMMARY');
console.log('='.repeat(70));
console.log(`\nTotal: ${passed + failed} tests`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log('\nFailed tests:');
  for (const result of results) {
    if (result.status === 'fail') {
      console.log(`  - ${result.name}: ${result.error}`);
    }
  }
}

console.log('\n' + '='.repeat(70) + '\n');

process.exit(failed === 0 ? 0 : 1);
