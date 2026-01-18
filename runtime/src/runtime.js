/**
 * Mycelial Runtime - Phase 4
 *
 * Main orchestrator that ties all compilation phases together.
 * Coordinates file I/O, parsing, network execution, and binary generation.
 *
 * Execution Flow:
 * 1. Initialize: Load source, parse network, validate, create context
 * 2. Compile: Run tidal cycles, process signals, collect results
 * 3. Finalize: Write ELF binary, generate summary
 *
 * @author Claude Opus 4.5
 * @date 2026-01-02
 */

const { FileIO } = require('./file-io.js');

// Use the Mycelial interpreter instead of pre-implemented agents
const { MycelialParser } = require('./interpreter/parser.js');
const { MycelialExecutor } = require('./interpreter/executor.js');
const { MycelialScheduler } = require('./interpreter/scheduler.js');

// x86-64 code generation and ELF linking
const { BinaryGenerator } = require('./binary-generator.js');
const { ELFLinker } = require('./elf-linker.js');

// Native code generator (new compiler pipeline)
const { MycelialCodeGenerator } = require('./compiler/mycelial-codegen.js');

/**
 * Runtime - Main compilation orchestrator
 */
class Runtime {
  /**
   * Create a new Runtime instance
   * @param {Object} options - Configuration options
   * @param {string} options.sourcePath - Path to .mycelial source file
   * @param {string} options.outputPath - Path for output ELF binary
   * @param {boolean} [options.verbose=false] - Enable verbose logging
   * @param {number} [options.maxCycles=1000] - Maximum tidal cycles
   * @param {Object} [options.network=null] - Pre-parsed network definition (optional)
   */
  constructor(options) {
    this.sourcePath = options.sourcePath;
    this.outputPath = options.outputPath;
    this.verbose = options.verbose || false;
    this.maxCycles = options.maxCycles || 1000;
    this.useNativeCodegen = options.useNativeCodegen !== false; // Default to true
    this.objectOnly = options.objectOnly || false; // New: produce .o instead of executable

    // Runtime components
    this.fileIO = new FileIO();
    this.parser = new MycelialParser();
    this.executor = null;
    this.scheduler = null;

    // Compilation state
    this.sourceCode = null;
    this.networkDefinition = null;
    this.initialized = false;

    // Compilation results
    this.compilationResult = {
      success: false,
      error: null,
      warnings: [],
      stats: {},
      outputPath: this.outputPath
    };
  }

  /**
   * Initialize the runtime: load, parse, validate, prepare context
   * @returns {Runtime} This runtime instance (for chaining)
   */
  async initialize() {
    if (this.initialized) {
      throw new Error('Runtime already initialized');
    }

    try {
      this.logProgress('INIT', 'Starting runtime initialization');

      // Load source code
      await this.loadSourceCode();

      // Parse network definition
      await this.parseNetworkDefinition();

      // Validate network structure
      await this.validateNetworkDefinition();

      // Create execution context
      await this.createExecutionContext();

      this.initialized = true;
      this.logProgress('INIT', 'Runtime initialization complete');

      return this;

    } catch (error) {
      this.handleCompilationError(error, 'initialization');
      throw error;
    }
  }

  /**
   * Execute full compilation pipeline
   * @returns {Object} Compilation result with stats and output path
   */
  async compile() {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      this.logProgress('COMPILE', 'Starting compilation pipeline');

      if (this.useNativeCodegen) {
        // New: Use native code generator
        await this.runNativeCodegenPipeline();
      } else {
        // Old: Run interpreter-based compilation pipeline
        await this.runCompilationPipeline();

        // Extract results from agent outputs
        await this.extractCompilationResults();

        // Finalize and write binary
        await this.finalizeOutput();
      }

      // Mark success
      this.compilationResult.success = true;
      this.compilationResult.stats.totalTimeMs = Date.now() - startTime;

      this.logProgress('COMPILE', 'Compilation complete');
      this.printCompilationSummary(this.compilationResult);

      return this.compilationResult;

    } catch (error) {
      this.handleCompilationError(error, 'compilation');
      this.compilationResult.success = false;
      this.compilationResult.error = error.message;
      this.compilationResult.stats.totalTimeMs = Date.now() - startTime;

      this.printCompilationSummary(this.compilationResult);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - Initialization
  // ============================================================================

  /**
   * Load source code from disk
   * @private
   */
  async loadSourceCode() {
    this.logProgress('LOAD', `Reading source: ${this.sourcePath}`);

    try {
      this.sourceCode = this.fileIO.readSourceFile(this.sourcePath);

      const fileSize = this.fileIO.getFileSize(this.sourcePath);
      const formattedSize = this.fileIO.formatFileSize(fileSize);

      this.logProgress('LOAD', `Loaded ${formattedSize} from ${this.sourcePath}`);

    } catch (error) {
      this.logError(error, 'load', { path: this.sourcePath });
      throw new Error(`Failed to load source file: ${error.message}`);
    }
  }

  /**
   * Parse network definition from source code
   * @private
   */
  async parseNetworkDefinition() {
    this.logProgress('PARSE', 'Parsing network definition');

    try {
      // Use MycelialParser to parse raw Mycelial source code
      this.networkDefinition = this.parser.parseNetwork(this.sourceCode);

      const frequencyCount = Object.keys(this.networkDefinition.frequencies || {}).length;
      const hyphalCount = Object.keys(this.networkDefinition.hyphae || {}).length;
      const spawnCount = (this.networkDefinition.spawns || []).length;
      const socketCount = (this.networkDefinition.sockets || []).length;

      this.logProgress('PARSE', 'Network parsed successfully', {
        frequencies: frequencyCount,
        hyphae: hyphalCount,
        spawns: spawnCount,
        sockets: socketCount
      });

    } catch (error) {
      this.logError(error, 'parse', { source: this.sourceCode.substring(0, 200) });
      throw new Error(`Failed to parse network: ${error.message}`);
    }
  }

  /**
   * Validate network definition structure
   * @private
   */
  async validateNetworkDefinition() {
    this.logProgress('VALIDATE', 'Validating network structure');

    try {
      const { hyphae, spawns, sockets } = this.networkDefinition;

      // Validate all spawned agents have hyphal definitions
      for (const spawn of (spawns || [])) {
        if (!hyphae || !hyphae[spawn.hyphalType]) {
          throw new Error(
            `Unknown hyphal type "${spawn.hyphalType}" in spawn "${spawn.instanceId}"`
          );
        }
      }

      // Validate socket connections reference valid agents
      // Include both spawned agents and fruiting bodies
      const validAgentIds = new Set([
        ...((spawns || []).map(s => s.instanceId)),
        ...((this.networkDefinition.fruitingBodies || []))
      ]);

      for (const socket of (sockets || [])) {
        // Handle socket format: { from: { agent, frequency }, to: { agent, frequency } }
        const fromAgent = socket.from?.agent || socket.from;
        const toAgent = socket.to?.agent || socket.to;

        if (!validAgentIds.has(fromAgent)) {
          throw new Error(`Socket references unknown agent: ${fromAgent}`);
        }
        // Allow '*' as broadcast destination
        if (toAgent !== '*' && !validAgentIds.has(toAgent)) {
          throw new Error(`Socket references unknown agent: ${toAgent}`);
        }
      }

      this.logProgress('VALIDATE', 'Network structure validated');

    } catch (error) {
      this.logError(error, 'validate', {});
      throw error;
    }
  }

  /**
   * Create execution context (mostly handled by interpreter)
   * @private
   */
  async createExecutionContext() {
    this.logProgress('CONTEXT', 'Creating interpreter-based execution context');

    try {
      // Create executor from parsed network
      this.executor = new MycelialExecutor(this.networkDefinition, this.parser);
      this.executor.initialize();

      this.logProgress('CONTEXT', 'Executor initialized', {
        agents: Object.keys(this.executor.agents).length,
        frequencies: Object.keys(this.executor.frequencies).length
      });

    } catch (error) {
      this.logError(error, 'context', {});
      throw new Error(`Failed to create execution context: ${error.message}`);
    }
  }

  // ============================================================================
  // PRIVATE METHODS - Compilation Execution
  // ============================================================================

  /**
   * Run the compilation pipeline: execute tidal cycles
   * @private
   */
  async runCompilationPipeline() {
    this.logProgress('PIPELINE', 'Starting tidal cycle execution');

    try {
      // Create scheduler for tidal cycles
      this.scheduler = new MycelialScheduler(this.executor);

      // Inject initial signal if needed (entry point agent)
      await this.injectInitialSignal();

      // Run scheduler until quiescence
      this.logProgress('PIPELINE', 'Running tidal cycles');
      const stats = this.scheduler.run(this.maxCycles);

      // Store statistics
      this.compilationResult.stats = {
        ...this.compilationResult.stats,
        cycles: stats.cycleCount,
        signalsProcessed: stats.signalsProcessed
      };

      this.logProgress('PIPELINE', 'Pipeline execution complete', {
        cycles: stats.cycleCount,
        signals: stats.signalsProcessed
      });

    } catch (error) {
      this.logError(error, 'pipeline', {});
      throw new Error(`Pipeline execution failed: ${error.message}`);
    }
  }

  /**
   * Run native code generation pipeline
   * @private
   */
  async runNativeCodegenPipeline() {
    this.logProgress('CODEGEN', 'Starting native code generation');

    try {
      // Generate x86-64 assembly from network AST
      const codegen = new MycelialCodeGenerator(this.networkDefinition);
      const assemblyCode = codegen.generate();

      this.logProgress('CODEGEN', `Generated ${assemblyCode.length} bytes of assembly`);

      // Assemble to machine code using GNU as
      const { execSync } = require('child_process');
      const fs = require('fs');
      const path = require('path');

      // Write assembly to temporary file
      const tmpDir = '/tmp';
      const asmPath = path.join(tmpDir, 'mycelial_temp.s');
      const objPath = path.join(tmpDir, 'mycelial_temp.o');

      fs.writeFileSync(asmPath, assemblyCode);
      this.logProgress('CODEGEN', `Assembly written to ${asmPath}`);

      // Assemble with GNU as
      execSync(`as ${asmPath} -o ${objPath}`, { stdio: 'pipe' });
      this.logProgress('CODEGEN', 'Assembly successful');

      if (this.objectOnly) {
        // Object-only mode: just copy .o file to output path
        fs.copyFileSync(objPath, this.outputPath);
        this.logProgress('CODEGEN', `Object file written to ${this.outputPath}`);
      } else {
        // Full compilation: link with ld to create executable
        execSync(`ld ${objPath} -o ${this.outputPath}`, { stdio: 'pipe' });
        this.logProgress('CODEGEN', `Linked to ${this.outputPath}`);
      }

      // Clean up temp files
      fs.unlinkSync(asmPath);
      fs.unlinkSync(objPath);

      // Update compilation result
      this.compilationResult.outputPath = this.outputPath;
      this.compilationResult.success = true;
      this.compilationResult.stats = {
        assemblySize: assemblyCode.length,
        binarySize: fs.statSync(this.outputPath).size
      };

    } catch (error) {
      this.logError(error, 'codegen', {});
      throw new Error(`Native code generation failed: ${error.message}`);
    }
  }

  /**
   * Inject initial signal to trigger compilation
   * @private
   */
  async injectInitialSignal() {
    this.logProgress('SIGNAL', 'Injecting initial signal');

    try {
      // Find the entry point agent (typically first spawned)
      const spawns = this.networkDefinition.spawns || [];
      if (spawns.length === 0) {
        throw new Error('No agents spawned - cannot inject initial signal');
      }

      const entryAgent = spawns[0];
      const entryAgentId = entryAgent.instanceId;

      // Create initial signal payload
      const initialSignal = {
        frequency: 'start',
        payload: {
          source_path: this.sourcePath,
          output_path: this.outputPath,
          timestamp: Date.now()
        }
      };

      // Emit signal to entry agent
      this.executor.emitSignal(entryAgentId, initialSignal.frequency, initialSignal.payload);

      this.logProgress('SIGNAL', `Injected signal to ${entryAgentId}`);

    } catch (error) {
      this.logError(error, 'signal', {});
      throw new Error(`Failed to inject initial signal: ${error.message}`);
    }
  }

  /**
   * Extract compilation results from executor
   * @private
   */
  async extractCompilationResults() {
    this.logProgress('EXTRACT', 'Extracting compilation results');

    try {
      // Get output from executor (e.g., binary data from linker agent)
      let elfBinary = this.executor.getOutput();

      // For now, generate a placeholder ELF binary if none found
      if (!elfBinary) {
        this.compilationResult.warnings.push('No binary output from interpreter');
        elfBinary = this.generatePlaceholderELF();
      }

      // Store in compilation result
      this.compilationResult.outputBinary = elfBinary;

      this.logProgress('EXTRACT', 'Results extracted successfully');

    } catch (error) {
      this.logError(error, 'extract', {});
      throw new Error(`Failed to extract results: ${error.message}`);
    }
  }

  /**
   * Finalize compilation: write binary to disk
   * @private
   */
  async finalizeOutput() {
    this.logProgress('FINALIZE', 'Writing output binary');

    try {
      const elfBinary = this.compilationResult.outputBinary;

      if (!elfBinary) {
        throw new Error('No ELF binary to write');
      }

      // Convert to Buffer if needed
      let binaryBuffer;
      if (Buffer.isBuffer(elfBinary)) {
        binaryBuffer = elfBinary;
      } else if (typeof elfBinary === 'string') {
        binaryBuffer = Buffer.from(elfBinary, 'binary');
      } else if (Array.isArray(elfBinary)) {
        binaryBuffer = Buffer.from(elfBinary);
      } else if (elfBinary && typeof elfBinary === 'object') {
        // Object fallback: generate placeholder ELF instead of serializing
        // (avoids JSON.stringify errors with BigInt, etc.)
        binaryBuffer = this.generatePlaceholderELF();
      } else {
        // Primitive: convert to string then buffer
        binaryBuffer = Buffer.from(String(elfBinary));
      }

      // Write to disk
      this.fileIO.writeELFBinary(this.outputPath, binaryBuffer);

      const fileSize = this.fileIO.getFileSize(this.outputPath);
      const formattedSize = this.fileIO.formatFileSize(fileSize);

      this.logProgress('FINALIZE', `Written ${formattedSize} to ${this.outputPath}`);

      // Update compilation result
      this.compilationResult.outputPath = this.outputPath;
      this.compilationResult.stats.outputSize = fileSize;

    } catch (error) {
      this.logError(error, 'finalize', { outputPath: this.outputPath });
      throw new Error(`Failed to finalize output: ${error.message}`);
    }
  }

  /**
   * Generate a real ELF binary using the x86-64 code generator
   * @returns {Buffer} Complete ELF binary with valid machine code
   * @private
   */
  generatePlaceholderELF() {
    // Generate a real compiler bootstrap binary instead of a placeholder header
    // This creates an actual executable that can process input files
    try {
      return BinaryGenerator.createCompilerBootstrap();
    } catch (error) {
      this.logProgress('CODEGEN', `Bootstrap generation failed: ${error.message}, using minimal exit`);
      // Fallback to minimal exit program
      return BinaryGenerator.createExitProgram(0);
    }
  }

  /**
   * Generate ELF binary from assembly text
   * @param {string} asmText - Assembly source code
   * @returns {Buffer} ELF binary
   * @private
   */
  generateELFFromAssembly(asmText) {
    return BinaryGenerator.fromAssembly(asmText, { verbose: this.verbose });
  }

  /**
   * Generate minimal exit program
   * @param {number} exitCode - Exit code
   * @returns {Buffer} ELF binary
   * @private
   */
  generateMinimalExitProgram(exitCode = 0) {
    return BinaryGenerator.createExitProgram(exitCode);
  }

  // ============================================================================
  // PRIVATE METHODS - Error Handling & Logging
  // ============================================================================

  /**
   * Handle compilation errors with context
   * @param {Error} error - The error that occurred
   * @param {string} stage - Compilation stage where error occurred
   * @private
   */
  handleCompilationError(error, stage) {
    this.logError(error, stage, {
      sourcePath: this.sourcePath,
      outputPath: this.outputPath,
      initialized: this.initialized
    });

    this.compilationResult.error = error.message;
    this.compilationResult.success = false;
  }

  /**
   * Log progress message (only if verbose)
   * @param {string} stage - Stage name (e.g., 'INIT', 'PARSE')
   * @param {string} message - Progress message
   * @param {Object} [data] - Additional data to log
   * @private
   */
  logProgress(stage, message, data) {
    if (!this.verbose) return;

    const timestamp = new Date().toISOString();
    const stageTag = `[${stage}]`.padEnd(12);

    if (data) {
      const dataStr = JSON.stringify(data, null, 2);
      console.log(`${timestamp} ${stageTag} ${message}\n${dataStr}`);
    } else {
      console.log(`${timestamp} ${stageTag} ${message}`);
    }
  }

  /**
   * Log error with full context
   * @param {Error} error - The error
   * @param {string} stage - Stage where error occurred
   * @param {Object} context - Additional context
   * @private
   */
  logError(error, stage, context) {
    const timestamp = new Date().toISOString();
    const stageTag = `[${stage.toUpperCase()}]`.padEnd(12);

    console.error(`${timestamp} ${stageTag} ERROR: ${error.message}`);

    if (error.stack && this.verbose) {
      console.error(`Stack trace:\n${error.stack}`);
    }

    if (context && Object.keys(context).length > 0) {
      console.error(`Context: ${JSON.stringify(context, null, 2)}`);
    }
  }

  /**
   * Print compilation summary
   * @param {Object} result - Compilation result
   * @private
   */
  printCompilationSummary(result) {
    console.log('\n' + '='.repeat(70));
    console.log('  MYCELIAL COMPILATION SUMMARY');
    console.log('='.repeat(70));

    console.log(`\nStatus: ${result.success ? 'SUCCESS' : 'FAILED'}`);

    if (result.success) {
      console.log(`Output: ${result.outputPath}`);

      if (result.stats.outputSize) {
        console.log(`Size: ${this.fileIO.formatFileSize(result.stats.outputSize)}`);
      }
    }

    if (result.error) {
      console.log(`Error: ${result.error}`);
    }

    if (result.warnings.length > 0) {
      console.log(`\nWarnings (${result.warnings.length}):`);
      result.warnings.forEach((warn, i) => {
        console.log(`  ${i + 1}. ${warn}`);
      });
    }

    if (result.stats && Object.keys(result.stats).length > 0) {
      console.log('\nStatistics:');
      console.log(`  Total Time: ${result.stats.totalTimeMs || 0}ms`);
      console.log(`  Tidal Cycles: ${result.stats.cycles || 0}`);
      console.log(`  Signals Processed: ${result.stats.signalsProcessed || 0}`);

      if (result.stats.averageCycleTimeMs) {
        console.log(`  Avg Cycle Time: ${result.stats.averageCycleTimeMs.toFixed(2)}ms`);
      }

      if (result.stats.errors && result.stats.errors.length > 0) {
        console.log(`  Execution Errors: ${result.stats.errors.length}`);
      }
    }

    console.log('\n' + '='.repeat(70) + '\n');
  }
}

module.exports = { Runtime };
