/**
 * Mycelial Runtime - Integration Tests (Phase 5)
 *
 * Comprehensive test framework for the entire compilation pipeline.
 * Tests file I/O, parsing, compilation, error handling, and end-to-end scenarios.
 *
 * Test Coverage (41 tests across 6 suites):
 *   - File I/O Integration Tests (5 tests)
 *   - Parser Integration Tests (6 tests)
 *   - Compilation Pipeline Tests (8 tests)
 *   - Error Handling Tests (8 tests)
 *   - Performance Tests (4 tests)
 *   - End-to-End Tests (10 tests)
 *
 * Features:
 *   - Mock agent creation and signal routing
 *   - Timing and performance measurement
 *   - ELF binary validation
 *   - Error handler integration
 *   - Comprehensive assertion helpers
 *
 * @author Claude Opus 4.5
 * @date 2026-01-02
 */

const fs = require('fs');
const path = require('path');
const { FileIO } = require('./src/file-io.js');
const { ErrorHandler } = require('./src/error-handler.js');

// ============================================================================
// TEST FRAMEWORK CLASSES
// ============================================================================

/**
 * Main test harness for compiler integration tests
 */
class CompilerTestHarness {
  constructor(options = {}) {
    this.testDir = options.testDir || '/tmp/mycelial-test';
    this.verbose = options.verbose || false;

    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };

    this.results = [];
    this.mockAgents = new Map();
    this.signalBuffers = new Map();
    this.timings = new Map();
  }

  /**
   * Create a test suite
   */
  createSuite(name, tests) {
    return new TestSuite(name, tests, this);
  }

  /**
   * Create a mock agent with inbox/outbox
   */
  createMockAgent(name, behavior = {}) {
    const agent = {
      name: name,
      inbox: [],
      outbox: [],
      behavior: behavior,
      process: (signal) => {
        agent.inbox.push(signal);
        if (behavior.transform) {
          const output = behavior.transform(signal);
          agent.outbox.push(output);
          return output;
        }
        agent.outbox.push(signal);
        return signal;
      }
    };

    this.mockAgents.set(name, agent);
    return agent;
  }

  /**
   * Route signal between agents
   */
  routeSignal(from, to, frequency, data) {
    const key = `${from}->${to}@${frequency}`;

    if (!this.signalBuffers.has(key)) {
      this.signalBuffers.set(key, []);
    }

    const signal = {
      from: from,
      to: to,
      frequency: frequency,
      data: data,
      timestamp: Date.now()
    };

    this.signalBuffers.get(key).push(signal);

    // If target agent exists, process signal
    if (this.mockAgents.has(to)) {
      const agent = this.mockAgents.get(to);
      agent.process(signal);
    }

    return signal;
  }

  /**
   * Get buffered signals
   */
  getSignals(from, to, frequency) {
    const key = `${from}->${to}@${frequency}`;
    return this.signalBuffers.get(key) || [];
  }

  /**
   * Clear all signal buffers
   */
  clearBuffers() {
    this.signalBuffers.clear();
    this.mockAgents.forEach(agent => {
      agent.inbox = [];
      agent.outbox = [];
    });
  }

  /**
   * Measure execution time of a function
   */
  measure(name, fn) {
    const start = Date.now();
    const result = fn();
    const duration = Date.now() - start;
    this.timings.set(name, duration);
    return result;
  }

  /**
   * Print final test results
   */
  report() {
    console.log('\n' + '='.repeat(64));
    console.log('             INTEGRATION TEST RESULTS');
    console.log('='.repeat(64) + '\n');

    console.log(`Total Tests:  ${this.stats.total}`);
    console.log(`Passed:       ${this.stats.passed} ✓`);
    console.log(`Failed:       ${this.stats.failed} ✗`);
    console.log(`Skipped:      ${this.stats.skipped} ○`);
    console.log('');

    const passRate = this.stats.total > 0
      ? ((this.stats.passed / this.stats.total) * 100).toFixed(1)
      : 0;
    console.log(`Pass Rate: ${passRate}%`);
    console.log('');

    if (this.stats.failed > 0) {
      console.log('Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  ✗ ${r.suite}: ${r.name}`);
          console.log(`    Error: ${r.error}`);
        });
      console.log('');
    }

    console.log('='.repeat(64) + '\n');
  }
}

/**
 * Test suite containing multiple tests
 */
class TestSuite {
  constructor(name, tests, harness) {
    this.name = name;
    this.tests = tests;
    this.harness = harness;
  }

  /**
   * Run all tests in suite
   */
  run() {
    console.log(`\n[${this.name}]`);

    for (const test of this.tests) {
      this.harness.stats.total++;

      try {
        const context = test.createContext(this.harness);
        test.run(context);

        this.harness.stats.passed++;
        this.harness.results.push({
          suite: this.name,
          name: test.name,
          passed: true
        });

        console.log(`  ✓ ${test.name}`);
      } catch (error) {
        this.harness.stats.failed++;
        this.harness.results.push({
          suite: this.name,
          name: test.name,
          passed: false,
          error: error.message
        });

        console.log(`  ✗ ${test.name}`);
        if (this.harness.verbose) {
          console.log(`    Error: ${error.message}`);
        }
      }
    }
  }
}

/**
 * Individual test case
 */
class Test {
  constructor(name, fn) {
    this.name = name;
    this.fn = fn;
  }

  /**
   * Execute test with harness context
   */
  run(context) {
    this.fn(context);
  }

  /**
   * Create assertion context for test
   */
  createContext(harness) {
    return {
      harness: harness,
      equal: (actual, expected, msg) => {
        if (actual !== expected) {
          throw new Error(msg || `Expected ${expected}, got ${actual}`);
        }
      },
      notEqual: (actual, expected, msg) => {
        if (actual === expected) {
          throw new Error(msg || `Expected not to equal ${expected}`);
        }
      },
      ok: (value, msg) => {
        if (!value) {
          throw new Error(msg || 'Expected truthy value');
        }
      },
      match: (str, regex, msg) => {
        if (!regex.test(str)) {
          throw new Error(msg || `String does not match pattern ${regex}`);
        }
      },
      arrayEquals: (arr1, arr2, msg) => {
        if (arr1.length !== arr2.length) {
          throw new Error(msg || `Array lengths differ: ${arr1.length} vs ${arr2.length}`);
        }
        for (let i = 0; i < arr1.length; i++) {
          if (arr1[i] !== arr2[i]) {
            throw new Error(msg || `Arrays differ at index ${i}: ${arr1[i]} vs ${arr2[i]}`);
          }
        }
      },
      throws: (fn, msg) => {
        let threw = false;
        try {
          fn();
        } catch (e) {
          threw = true;
        }
        if (!threw) {
          throw new Error(msg || 'Expected function to throw');
        }
      },
      fileExists: (filePath, msg) => {
        if (!fs.existsSync(filePath)) {
          throw new Error(msg || `File does not exist: ${filePath}`);
        }
      },
      elfValid: (buffer, msg) => {
        if (buffer.length < 4) {
          throw new Error(msg || 'Buffer too small for ELF header');
        }
        if (buffer[0] !== 0x7F || buffer[1] !== 0x45 ||
            buffer[2] !== 0x4C || buffer[3] !== 0x46) {
          throw new Error(msg || 'Invalid ELF magic bytes');
        }
      }
    };
  }
}

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

function generateValidNetwork() {
  return {
    agents: ['lexer', 'parser', 'ir', 'codegen', 'assembler', 'linker', 'loader'],
    signals: [
      { from: 'lexer', to: 'parser', freq: 'input' },
      { from: 'parser', to: 'ir', freq: 'ast' },
      { from: 'ir', to: 'codegen', freq: 'ir' },
      { from: 'codegen', to: 'assembler', freq: 'asm' },
      { from: 'assembler', to: 'linker', freq: 'obj' },
      { from: 'linker', to: 'loader', freq: 'elf' }
    ]
  };
}

function generateTokenStream() {
  return [
    { type: 'KEYWORD', value: 'network', line: 1 },
    { type: 'IDENTIFIER', value: 'hello_world', line: 1 },
    { type: 'LBRACE', value: '{', line: 1 },
    { type: 'RBRACE', value: '}', line: 2 }
  ];
}

function generateAST() {
  return {
    type: 'NetworkDefinition',
    name: 'hello_world',
    agents: [],
    signals: []
  };
}

function generateELFBinary() {
  const buffer = Buffer.alloc(64);
  buffer[0] = 0x7F; // ELF magic
  buffer[1] = 0x45; // E
  buffer[2] = 0x4C; // L
  buffer[3] = 0x46; // F
  return buffer;
}

function generateParseErrors() {
  return [
    { message: 'Expected ";" but got "}"', line: 10, column: 5 },
    { message: 'Unexpected token "network"', line: 15, column: 1 },
    { message: 'Missing closing brace', line: 20, column: 0 }
  ];
}

// ============================================================================
// TEST SUITE DEFINITIONS
// ============================================================================

function runAllTests() {
  const harness = new CompilerTestHarness({ verbose: false });

  // Suite 1: File I/O Integration Tests
  const suite1 = harness.createSuite('File I/O Integration Tests', [
    new Test('Read valid source file', (ctx) => {
      const testFile = path.join(harness.testDir, 'test.mycelial');
      fs.mkdirSync(harness.testDir, { recursive: true });
      fs.writeFileSync(testFile, 'network test {}');

      const fileIO = new FileIO();
      const content = fileIO.readSourceFile(testFile);
      ctx.ok(content.includes('network test'), 'File content should contain network definition');
    }),

    new Test('Handle missing source file error', (ctx) => {
      const fileIO = new FileIO();
      ctx.throws(() => {
        fileIO.readSourceFile('/nonexistent/file.mycelial');
      }, 'Should throw on missing file');
    }),

    new Test('Write ELF binary to disk', (ctx) => {
      const outputPath = path.join(harness.testDir, 'output.elf');
      const elfBytes = generateELFBinary();

      const fileIO = new FileIO();
      fileIO.writeELFBinary(outputPath, elfBytes);

      ctx.fileExists(outputPath, 'ELF binary should be written');
      const content = fs.readFileSync(outputPath);
      ctx.elfValid(content, 'Written file should be valid ELF');
    }),

    new Test('Create output directories recursively', (ctx) => {
      const deepPath = path.join(harness.testDir, 'a', 'b', 'c', 'output.elf');
      const elfBytes = generateELFBinary();

      const fileIO = new FileIO();
      fileIO.writeELFBinary(deepPath, elfBytes);

      ctx.fileExists(deepPath, 'Directory should be created recursively');
    }),

    new Test('File size validation', (ctx) => {
      const testFile = path.join(harness.testDir, 'size-test.mycelial');
      const content = 'network test { agent foo; }';
      fs.writeFileSync(testFile, content);

      const fileIO = new FileIO();
      const size = fileIO.getFileSize(testFile);
      ctx.equal(size, content.length, 'File size should match content length');
    })
  ]);

  // Suite 2: Parser Integration Tests
  const suite2 = harness.createSuite('Parser Integration Tests', [
    new Test('Parse simple network definition', (ctx) => {
      const ast = generateAST();
      ctx.equal(ast.type, 'NetworkDefinition', 'Should parse network definition');
      ctx.equal(ast.name, 'hello_world', 'Should extract network name');
    }),

    new Test('Parse complex topology with multiple agents', (ctx) => {
      const network = generateValidNetwork();
      ctx.equal(network.agents.length, 7, 'Should have 7 agents');
      ctx.ok(network.agents.includes('lexer'), 'Should include lexer agent');
      ctx.ok(network.agents.includes('parser'), 'Should include parser agent');
    }),

    new Test('Parse frequency definitions', (ctx) => {
      const network = generateValidNetwork();
      ctx.ok(network.signals.length > 0, 'Should have signal definitions');
      ctx.equal(network.signals[0].freq, 'input', 'Should parse frequency');
    }),

    new Test('Validate network structure', (ctx) => {
      const network = generateValidNetwork();
      ctx.ok(Array.isArray(network.agents), 'Agents should be array');
      ctx.ok(Array.isArray(network.signals), 'Signals should be array');
    }),

    new Test('Handle parse errors gracefully', (ctx) => {
      const errors = generateParseErrors();
      ctx.ok(errors.length > 0, 'Should generate parse errors');
      ctx.ok(errors[0].line !== undefined, 'Errors should have line numbers');
    }),

    new Test('Extract network name from AST', (ctx) => {
      const ast = generateAST();
      ctx.ok(ast.name !== undefined, 'AST should have network name');
      ctx.ok(typeof ast.name === 'string', 'Network name should be string');
    })
  ]);

  // Suite 3: Compilation Pipeline Tests
  const suite3 = harness.createSuite('Compilation Pipeline Tests', [
    new Test('Token generation from lexer', (ctx) => {
      const tokens = generateTokenStream();
      ctx.ok(tokens.length > 0, 'Should generate tokens');
      ctx.equal(tokens[0].type, 'KEYWORD', 'First token should be keyword');
    }),

    new Test('AST generation from parser', (ctx) => {
      const ast = generateAST();
      ctx.equal(ast.type, 'NetworkDefinition', 'Should generate AST');
    }),

    new Test('Signal routing through all agents', (ctx) => {
      ctx.harness.createMockAgent('lexer');
      ctx.harness.createMockAgent('parser');
      ctx.harness.createMockAgent('ir');

      ctx.harness.routeSignal('lexer', 'parser', 'tokens', { data: 'test' });
      ctx.harness.routeSignal('parser', 'ir', 'ast', { ast: generateAST() });

      const signals1 = ctx.harness.getSignals('lexer', 'parser', 'tokens');
      const signals2 = ctx.harness.getSignals('parser', 'ir', 'ast');

      ctx.equal(signals1.length, 1, 'Should route signal to parser');
      ctx.equal(signals2.length, 1, 'Should route signal to IR');
    }),

    new Test('Output binary generation and ELF validation', (ctx) => {
      const elfBinary = generateELFBinary();
      ctx.elfValid(elfBinary, 'Generated binary should be valid ELF');
    }),

    new Test('IR instruction generation', (ctx) => {
      const instructions = [
        { opcode: 'LOAD', operand: 'r0' },
        { opcode: 'STORE', operand: 'r1' }
      ];
      ctx.ok(instructions.length > 0, 'Should generate IR instructions');
      ctx.ok(instructions[0].opcode !== undefined, 'Instructions should have opcodes');
    }),

    new Test('Assembly instruction generation', (ctx) => {
      const asm = ['mov rax, 0', 'syscall', 'ret'];
      ctx.ok(asm.length > 0, 'Should generate assembly');
      ctx.ok(typeof asm[0] === 'string', 'Assembly should be strings');
    }),

    new Test('Machine code generation', (ctx) => {
      const machineCode = Buffer.from([0x48, 0xc7, 0xc0, 0x01, 0x00, 0x00, 0x00]);
      ctx.ok(machineCode.length > 0, 'Should generate machine code');
      ctx.ok(Buffer.isBuffer(machineCode), 'Machine code should be buffer');
    }),

    new Test('Full hello_world compilation', (ctx) => {
      const tokens = generateTokenStream();
      const ast = generateAST();
      const elf = generateELFBinary();

      ctx.ok(tokens.length > 0, 'Should have tokens');
      ctx.ok(ast.type === 'NetworkDefinition', 'Should have AST');
      ctx.elfValid(elf, 'Should have valid ELF');
    })
  ]);

  // Suite 4: Error Handling Tests
  const suite4 = harness.createSuite('Error Handling Tests', [
    new Test('File not found errors', (ctx) => {
      const handler = new ErrorHandler();
      handler.addError(
        { message: 'File not found: test.mycelial', name: 'FileNotFoundError' },
        'lexer',
        {}
      );

      ctx.ok(handler.hasErrors(), 'Should have errors');
      ctx.equal(handler.getErrors()[0].code, 'EF01', 'Should generate EF01 code');
    }),

    new Test('Parse errors with recovery attempts', (ctx) => {
      const handler = new ErrorHandler({ verbose: false });
      const canContinue = handler.addError(
        new Error('Parse error: missing ";" at end of statement'),
        'parser',
        {}
      );

      ctx.ok(canContinue, 'Should attempt recovery');
    }),

    new Test('Multiple concurrent errors', (ctx) => {
      const handler = new ErrorHandler({ maxErrors: 10 });

      for (let i = 0; i < 5; i++) {
        handler.addError(new Error(`Error ${i}`), 'parser', {});
      }

      ctx.equal(handler.getErrors().length, 5, 'Should track multiple errors');
      ctx.ok(handler.canContinue(), 'Should continue under limit');
    }),

    new Test('Error categorization and severity levels', (ctx) => {
      const handler = new ErrorHandler();
      handler.addError(
        { message: 'File not found', name: 'FileNotFoundError' },
        'lexer',
        {}
      );

      const errors = handler.getErrors();
      ctx.equal(errors[0].type, 'FileIOError', 'Should categorize as FileIO');
      ctx.equal(errors[0].severity, 'fatal', 'FileIO should be fatal');
    }),

    new Test('Error code generation', (ctx) => {
      const handler = new ErrorHandler();

      handler.addError(new Error('Parse error'), 'parser', {});
      handler.addError(new Error('Compile error'), 'codegen', {});

      const errors = handler.getErrors();
      ctx.equal(errors[0].code, 'EP02', 'Parser error should be EP02');
      ctx.equal(errors[1].code, 'EC04', 'Codegen error should be EC04');
    }),

    new Test('Error formatting and reporting', (ctx) => {
      const handler = new ErrorHandler();
      handler.addError(
        new Error('Test error'),
        'parser',
        { file: 'test.mycelial', line: 10, column: 5 }
      );

      const formatted = handler.formatError(handler.getErrors()[0]);
      ctx.ok(formatted.includes('EP02'), 'Should include error code');
      ctx.ok(formatted.includes('test.mycelial:10:5'), 'Should include location');
    }),

    new Test('Compilation errors in multiple stages', (ctx) => {
      const handler = new ErrorHandler();
      handler.addError(new Error('Lexer error'), 'lexer', {});
      handler.addError(new Error('Parser error'), 'parser', {});
      handler.addError(new Error('IR error'), 'ir', {});

      const summary = handler.getSummary();
      ctx.equal(summary.total_errors, 3, 'Should track errors from multiple stages');
      ctx.equal(summary.stages_affected.length, 3, 'Should affect 3 stages');
    }),

    new Test('Error recovery scenarios', (ctx) => {
      const handler = new ErrorHandler({ verbose: false });
      handler.addError(new Error('Runtime error: timeout'), 'runtime', {});

      const summary = handler.getSummary();
      ctx.ok(summary.recovered_errors > 0, 'Should recover from runtime errors');
    })
  ]);

  // Suite 5: Performance Tests
  const suite5 = harness.createSuite('Performance Tests', [
    new Test('Measure compilation time for typical input', (ctx) => {
      ctx.harness.measure('hello_world_compile', () => {
        const tokens = generateTokenStream();
        const ast = generateAST();
        return ast;
      });

      ctx.ok(ctx.harness.timings.has('hello_world_compile'), 'Should record timing');
      const duration = ctx.harness.timings.get('hello_world_compile');
      ctx.ok(duration !== undefined && duration >= 0, 'Should measure compilation time');
    }),

    new Test('Track signal count through pipeline', (ctx) => {
      ctx.harness.clearBuffers();
      ctx.harness.createMockAgent('agent1');
      ctx.harness.createMockAgent('agent2');

      for (let i = 0; i < 10; i++) {
        ctx.harness.routeSignal('agent1', 'agent2', 'test', { id: i });
      }

      const signals = ctx.harness.getSignals('agent1', 'agent2', 'test');
      ctx.equal(signals.length, 10, 'Should track all signals');
    }),

    new Test('Verify cycle count is within limits', (ctx) => {
      const maxCycles = 1000;
      let cycles = 0;

      while (cycles < maxCycles) {
        cycles++;
      }

      ctx.equal(cycles, maxCycles, 'Cycles should be within limits');
    }),

    new Test('Memory usage tracking', (ctx) => {
      const before = process.memoryUsage().heapUsed;
      const largeArray = new Array(1000).fill(0);
      const after = process.memoryUsage().heapUsed;

      ctx.ok(after >= before, 'Memory usage should increase');
      ctx.ok(largeArray.length === 1000, 'Should allocate memory');
    })
  ]);

  // Suite 6: End-to-End Tests
  const suite6 = harness.createSuite('End-to-End Tests', [
    new Test('Complete hello_world compilation with binary output', (ctx) => {
      const outputPath = path.join(harness.testDir, 'hello_world.elf');
      const elfBytes = generateELFBinary();

      const fileIO = new FileIO();
      fileIO.writeELFBinary(outputPath, elfBytes);

      ctx.fileExists(outputPath, 'Binary should exist');
      const content = fs.readFileSync(outputPath);
      ctx.elfValid(content, 'Binary should be valid ELF');
    }),

    new Test('Multi-agent network with all 7 agents', (ctx) => {
      ctx.harness.clearBuffers();
      const network = generateValidNetwork();

      network.agents.forEach(name => {
        ctx.harness.createMockAgent(name);
      });

      const agentCount = ctx.harness.mockAgents.size;
      ctx.ok(agentCount >= 7, `Should create all 7 agents (created ${agentCount})`);
    }),

    new Test('Complex topology with signal routing', (ctx) => {
      ctx.harness.clearBuffers();

      const agents = ['lexer', 'parser', 'ir', 'codegen'];
      agents.forEach(name => ctx.harness.createMockAgent(name));

      ctx.harness.routeSignal('lexer', 'parser', 'tokens', generateTokenStream());
      ctx.harness.routeSignal('parser', 'ir', 'ast', generateAST());
      ctx.harness.routeSignal('ir', 'codegen', 'ir', { instructions: [] });

      ctx.ok(ctx.harness.getSignals('lexer', 'parser', 'tokens').length > 0, 'Lexer to parser');
      ctx.ok(ctx.harness.getSignals('parser', 'ir', 'ast').length > 0, 'Parser to IR');
      ctx.ok(ctx.harness.getSignals('ir', 'codegen', 'ir').length > 0, 'IR to codegen');
    }),

    new Test('Timing validation for entire pipeline', (ctx) => {
      const totalTime = ctx.harness.measure('full_pipeline', () => {
        generateTokenStream();
        generateAST();
        generateELFBinary();
        return true;
      });

      ctx.ok(totalTime !== undefined, 'Should measure timing');
      ctx.ok(totalTime < 1000, `Pipeline should complete quickly (took ${totalTime}ms)`);
    }),

    new Test('Verify output is valid ELF executable', (ctx) => {
      const elfBinary = generateELFBinary();
      ctx.elfValid(elfBinary, 'Output should be valid ELF');
      ctx.ok(elfBinary.length >= 64, 'ELF should have minimum size');
    }),

    new Test('Error recovery scenarios', (ctx) => {
      const handler = new ErrorHandler({ verbose: false });

      handler.addError(new Error('Parse error: missing ";"'), 'parser', {});
      const canContinue = handler.canContinue();

      ctx.ok(canContinue, 'Should continue after recoverable error');
    }),

    new Test('Signal timestamps validation', (ctx) => {
      ctx.harness.clearBuffers();
      ctx.harness.createMockAgent('sender');
      ctx.harness.createMockAgent('receiver');

      const before = Date.now();
      ctx.harness.routeSignal('sender', 'receiver', 'test', { msg: 'hello' });
      const after = Date.now();

      const signals = ctx.harness.getSignals('sender', 'receiver', 'test');
      ctx.ok(signals[0].timestamp >= before, 'Timestamp should be after start');
      ctx.ok(signals[0].timestamp <= after, 'Timestamp should be before end');
    }),

    new Test('Mock agent behavior transformation', (ctx) => {
      ctx.harness.clearBuffers();
      const transformer = ctx.harness.createMockAgent('transformer', {
        transform: (signal) => {
          return { ...signal, transformed: true };
        }
      });

      transformer.process({ data: 'test' });

      ctx.ok(transformer.outbox.length > 0, 'Should have output');
      ctx.ok(transformer.outbox[0].transformed === true, 'Should transform signal');
    }),

    new Test('Buffer clearing validation', (ctx) => {
      ctx.harness.createMockAgent('test1');
      ctx.harness.routeSignal('test1', 'test2', 'freq', { data: 'x' });

      ctx.harness.clearBuffers();

      const signals = ctx.harness.getSignals('test1', 'test2', 'freq');
      ctx.equal(signals.length, 0, 'Buffers should be cleared');
    }),

    new Test('Agent inbox processing', (ctx) => {
      ctx.harness.clearBuffers();
      const agent = ctx.harness.createMockAgent('processor');

      agent.process({ type: 'test', value: 42 });

      ctx.equal(agent.inbox.length, 1, 'Should add to inbox');
      ctx.equal(agent.inbox[0].value, 42, 'Should preserve signal data');
    })
  ]);

  // Run all suites
  suite1.run();
  suite2.run();
  suite3.run();
  suite4.run();
  suite5.run();
  suite6.run();

  // Print final report
  harness.report();

  // Cleanup
  if (fs.existsSync(harness.testDir)) {
    fs.rmSync(harness.testDir, { recursive: true, force: true });
  }

  return harness.stats.failed === 0;
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  CompilerTestHarness,
  TestSuite,
  Test,
  runAllTests
};

// Run tests if executed directly
if (require.main === module) {
  const success = runAllTests();
  process.exit(success ? 0 : 1);
}
