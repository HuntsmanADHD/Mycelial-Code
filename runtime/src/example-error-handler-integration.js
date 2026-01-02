/**
 * Example: ErrorHandler Integration with Mycelial Runtime
 *
 * Demonstrates how to integrate the ErrorHandler into the compilation pipeline
 */

const { ErrorHandler } = require('./error-handler.js');
const { FileIO, FileNotFoundError } = require('./file-io.js');

// ============================================================================
// EXAMPLE 1: Basic Integration
// ============================================================================

console.log('Example 1: Basic Error Handling');
console.log('='.repeat(70));

const errorHandler1 = new ErrorHandler({ verbose: true, maxErrors: 50 });

// Simulate compilation stages
try {
  // Stage 1: File I/O
  throw new FileNotFoundError('/path/to/missing.mycelial');
} catch (error) {
  const canContinue = errorHandler1.addError(error, 'lexer', {
    sourcePath: '/path/to/missing.mycelial'
  });

  if (!canContinue) {
    console.log('\nCompilation cannot continue due to fatal error');
    errorHandler1.printErrorReport();
  }
}

// ============================================================================
// EXAMPLE 2: Recoverable Errors
// ============================================================================

console.log('\n\nExample 2: Recoverable Errors');
console.log('='.repeat(70));

const errorHandler2 = new ErrorHandler({ verbose: true });

// Simulate parse errors that can be recovered
const canContinue1 = errorHandler2.addError(
  new Error('Missing ";" at end of statement'),
  'parser',
  { file: 'program.mycelial', line: 10, column: 25 }
);

console.log(`Can continue after parse error: ${canContinue1}`);

const canContinue2 = errorHandler2.addError(
  new Error('Undefined variable "counter"'),
  'codegen',
  { file: 'program.mycelial', line: 42 }
);

console.log(`Can continue after compilation error: ${canContinue2}`);

// Check if we should continue compilation
if (errorHandler2.canContinue()) {
  console.log('\nCompilation can continue with recovered errors');
  const summary = errorHandler2.getSummary();
  console.log(`Recovered: ${summary.recovered_errors} errors`);
  console.log(`Remaining: ${summary.total_errors} errors`);
}

// ============================================================================
// EXAMPLE 3: Multiple Stages with Warnings
// ============================================================================

console.log('\n\nExample 3: Multi-Stage Compilation with Warnings');
console.log('='.repeat(70));

const errorHandler3 = new ErrorHandler({ verbose: false });

// Stage 1: Lexer
errorHandler3.addWarning('Deprecated syntax: use "let" instead of "var"', 'lexer');

// Stage 2: Parser
errorHandler3.addError(
  new Error('Expected "}" but found end of file'),
  'parser',
  {
    file: 'module.mycelial',
    line: 156,
    column: 1,
    text: ''
  }
);

// Stage 3: Type Checking
errorHandler3.addError(
  new Error('Type mismatch: expected int, got string'),
  'codegen',
  {
    file: 'module.mycelial',
    line: 89,
    column: 12,
    text: '  let x: int = "hello";'
  }
);

// Stage 4: More warnings
errorHandler3.addWarning('Unused function "helper"', 'codegen');
errorHandler3.addWarning('Variable "temp" is never read', 'codegen');

// Print comprehensive report
console.log('\nCompilation Results:');
console.log('-'.repeat(70));

const summary3 = errorHandler3.getSummary();
console.log(`Errors:   ${summary3.total_errors}`);
console.log(`Warnings: ${summary3.total_warnings}`);
console.log(`Success:  ${summary3.success}`);
console.log(`Stages:   ${summary3.stages_affected.join(', ')}`);

console.log('\nErrors by Stage:');
for (const [stage, count] of Object.entries(summary3.errors_by_stage)) {
  console.log(`  ${stage}: ${count}`);
}

// ============================================================================
// EXAMPLE 4: Integration Pattern for Runtime
// ============================================================================

console.log('\n\nExample 4: Runtime Integration Pattern');
console.log('='.repeat(70));

class SimpleCompiler {
  constructor(options = {}) {
    this.errorHandler = new ErrorHandler({
      verbose: options.verbose || false,
      maxErrors: options.maxErrors || 100
    });
    this.fileIO = new FileIO();
  }

  async compile(sourcePath, outputPath) {
    try {
      // Stage 1: Load source
      const source = this.loadSource(sourcePath);

      // Stage 2: Parse
      const ast = this.parse(source);

      // Stage 3: Compile
      const binary = this.generate(ast);

      // Stage 4: Write output
      this.writeOutput(outputPath, binary);

      // Return results
      return {
        success: !this.errorHandler.hasErrors(),
        summary: this.errorHandler.getSummary(),
        errors: this.errorHandler.getErrors(),
        warnings: this.errorHandler.getWarnings()
      };

    } catch (error) {
      this.errorHandler.addError(error, 'runtime', {});
      return {
        success: false,
        summary: this.errorHandler.getSummary(),
        errors: this.errorHandler.getErrors(),
        warnings: this.errorHandler.getWarnings()
      };
    }
  }

  loadSource(sourcePath) {
    try {
      return this.fileIO.readSourceFile(sourcePath);
    } catch (error) {
      const canContinue = this.errorHandler.addError(error, 'lexer', {
        sourcePath: sourcePath
      });

      if (!canContinue) {
        throw new Error('Cannot continue: source file not accessible');
      }
    }
  }

  parse(source) {
    // Simulate parsing
    try {
      if (!source) {
        throw new Error('Empty source file');
      }
      return { type: 'Program', body: [] };
    } catch (error) {
      this.errorHandler.addError(error, 'parser', {
        source: source
      });
      throw error;
    }
  }

  generate(ast) {
    // Simulate code generation
    try {
      if (!ast || !ast.body) {
        throw new Error('Invalid AST structure');
      }
      return Buffer.from([0x7f, 0x45, 0x4c, 0x46]); // ELF magic
    } catch (error) {
      this.errorHandler.addError(error, 'codegen', {});
      throw error;
    }
  }

  writeOutput(outputPath, binary) {
    try {
      this.fileIO.writeELFBinary(outputPath, binary);
    } catch (error) {
      this.errorHandler.addError(error, 'linker', {
        outputPath: outputPath
      });
      throw error;
    }
  }

  getReport() {
    return this.errorHandler.formatErrorReport();
  }
}

// Demonstrate the compiler
console.log('\nSimulating compilation with errors...\n');

const compiler = new SimpleCompiler({ verbose: false });

// This will fail at the load stage
compiler.compile('/nonexistent/file.mycelial', '/tmp/output.elf')
  .then(result => {
    console.log('Compilation Result:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Errors:  ${result.errors.length}`);
    console.log(`  Warnings: ${result.warnings.length}`);

    if (!result.success) {
      console.log('\n' + compiler.getReport());
    }
  })
  .catch(error => {
    console.error('Compilation failed:', error.message);
    console.log('\n' + compiler.getReport());
  });

// ============================================================================
// EXAMPLE 5: Error Serialization for Logging
// ============================================================================

setTimeout(() => {
  console.log('\n\nExample 5: Error Serialization');
  console.log('='.repeat(70));

  const errorHandler5 = new ErrorHandler({ verbose: false });

  errorHandler5.addError(
    new Error('Parse error at line 10'),
    'parser',
    { file: 'test.mycelial', line: 10 }
  );

  errorHandler5.addWarning('Unused import', 'parser');

  const serialized = errorHandler5.serialize();

  console.log('\nSerialized Error Data (for logging/debugging):');
  console.log(JSON.stringify(serialized, null, 2));

  console.log('\n\nAll examples complete!');
}, 100);
