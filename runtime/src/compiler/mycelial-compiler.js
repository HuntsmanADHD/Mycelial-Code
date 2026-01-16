/**
 * Mycelial Compiler - End-to-End Compilation
 *
 * Compiles Mycelial source code to native x86-64 ELF binaries.
 *
 * Pipeline:
 * 1. Parse source code to AST (using existing parser)
 * 2. Generate x86-64 assembly (using code generator)
 * 3. Assemble to machine code (using existing assembler)
 * 4. Link to ELF binary (using existing linker)
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-15
 */

const { MycelialCodegen } = require('./mycelial-codegen.js');
const { BinaryGenerator } = require('../binary-generator.js');
const fs = require('fs');

class MycelialCompiler {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      debugInfo: options.debugInfo || false,
      optimize: options.optimize || false
    };
  }

  /**
   * Compile network AST to ELF binary
   * @param {Object} networkAST - Parsed network definition
   * @param {string} outputPath - Output file path for binary
   * @returns {Object} Compilation result
   */
  compile(networkAST, outputPath) {
    const startTime = Date.now();
    const result = {
      success: false,
      outputPath: outputPath,
      stats: {},
      errors: [],
      warnings: []
    };

    try {
      if (this.options.verbose) {
        console.error(`[COMPILER] Compiling network: ${networkAST.name}`);
      }

      // Step 1: Generate assembly code
      if (this.options.verbose) {
        console.error('[COMPILER] Step 1: Generating assembly code...');
      }

      const codegen = new MycelialCodegen(networkAST, this.options);
      const assemblyText = codegen.generate();
      const codegenStats = codegen.getStats();

      if (this.options.verbose) {
        console.error(`[COMPILER] Generated ${codegenStats.assemblyLines} lines of assembly`);
      }

      // Step 2: Assemble and link to ELF binary
      if (this.options.verbose) {
        console.error('[COMPILER] Step 2: Assembling and linking...');
      }

      const binaryGen = new BinaryGenerator({ verbose: this.options.verbose });
      binaryGen.setAssemblyText(assemblyText);
      
      const binary = binaryGen.generate();

      if (this.options.verbose) {
        console.error(`[COMPILER] Generated ${binary.length} byte ELF binary`);
      }

      // Step 3: Write to file
      if (this.options.verbose) {
        console.error(`[COMPILER] Step 3: Writing to ${outputPath}...`);
      }

      binaryGen.writeToFile(outputPath, true);

      // Step 4: Collect statistics
      const endTime = Date.now();
      result.success = true;
      result.stats = {
        compilationTime: endTime - startTime,
        assemblyLines: codegenStats.assemblyLines,
        binarySize: binary.length,
        agents: codegenStats.agentCount,
        handlers: codegenStats.handlerCount,
        frequencies: codegenStats.frequencyCount,
        totalStateSize: codegenStats.totalStateSize
      };

      if (this.options.verbose) {
        console.error('[COMPILER] Compilation successful!');
        console.error(`[COMPILER] Time: ${result.stats.compilationTime}ms`);
        console.error(`[COMPILER] Binary size: ${result.stats.binarySize} bytes`);
      }

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);

      if (this.options.verbose) {
        console.error('[COMPILER] Compilation failed:', error.message);
        if (error.stack) {
          console.error(error.stack);
        }
      }
    }

    return result;
  }

  /**
   * Compile Mycelial source file to binary
   * @param {string} sourcePath - Path to .mycelial source file
   * @param {string} outputPath - Path for output binary
   * @param {Object} parser - MycelialParser instance
   * @returns {Object} Compilation result
   */
  compileFile(sourcePath, outputPath, parser) {
    if (this.options.verbose) {
      console.error(`[COMPILER] Reading source: ${sourcePath}`);
    }

    // Read source code
    const sourceCode = fs.readFileSync(sourcePath, 'utf-8');

    // Parse to AST
    if (this.options.verbose) {
      console.error('[COMPILER] Parsing source code...');
    }

    const networkAST = parser.parseNetwork(sourceCode);

    if (this.options.verbose) {
      console.error(`[COMPILER] Parsed network: ${networkAST.name}`);
    }

    // Compile AST to binary
    return this.compile(networkAST, outputPath);
  }
}

module.exports = { MycelialCompiler };
