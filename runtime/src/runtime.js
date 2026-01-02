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
const { OrchestrationParser } = require('./orchestration-parser.js');
const { NetworkRunner } = require('./network-runner.js');
const { TidalCycleScheduler } = require('./tidal-cycle-scheduler.js');
const BuiltinFunctions = require('./builtin-functions.js');
const { SignalQueue } = require('./signal-router.js');

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
    this.preloadedNetwork = options.network || null;

    // Runtime components
    this.fileIO = new FileIO();
    this.parser = new OrchestrationParser();
    this.networkRunner = null;
    this.scheduler = null;

    // Compilation state
    this.sourceCode = null;
    this.networkDefinition = null;
    this.executionContext = null;
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

      // Run compilation pipeline
      await this.runCompilationPipeline();

      // Extract results from agent outputs
      await this.extractCompilationResults();

      // Finalize and write binary
      await this.finalizeOutput();

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
      // Use preloaded network if provided, otherwise parse
      if (this.preloadedNetwork) {
        this.networkDefinition = this.preloadedNetwork;
        this.logProgress('PARSE', 'Using preloaded network definition');
      } else {
        this.networkDefinition = this.parser.parse(this.sourceCode);
      }

      const { networkName, frequencies, hyphae, topology } = this.networkDefinition;

      this.logProgress('PARSE', `Network: ${networkName}`, {
        frequencies: Object.keys(frequencies).length,
        hyphae: Object.keys(hyphae).length,
        spawns: topology.spawns.length,
        sockets: topology.sockets.length
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
      const { hyphae, topology } = this.networkDefinition;

      // Validate all spawned agents have hyphal definitions
      for (const spawn of topology.spawns) {
        if (!hyphae[spawn.hyphalType]) {
          throw new Error(
            `Unknown hyphal type "${spawn.hyphalType}" in spawn "${spawn.instanceId}"`
          );
        }
      }

      // Validate socket connections reference valid agents
      const validAgentIds = new Set(topology.spawns.map(s => s.instanceId));

      for (const socket of topology.sockets) {
        if (!validAgentIds.has(socket.from)) {
          throw new Error(`Socket references unknown agent: ${socket.from}`);
        }
        if (!validAgentIds.has(socket.to)) {
          throw new Error(`Socket references unknown agent: ${socket.to}`);
        }
      }

      this.logProgress('VALIDATE', 'Network structure validated');

    } catch (error) {
      this.logError(error, 'validate', { network: this.networkDefinition.networkName });
      throw error;
    }
  }

  /**
   * Create execution context with builtins and buffers
   * @private
   */
  async createExecutionContext() {
    this.logProgress('CONTEXT', 'Creating execution context');

    try {
      const startTime = Date.now();

      // Get all builtin functions
      const builtins = BuiltinFunctions.getAllFunctions();

      // Initialize signal buffers for each frequency
      const buffers = {};
      for (const freqName of Object.keys(this.networkDefinition.frequencies)) {
        buffers[freqName] = [];
      }

      // Create metadata
      const metadata = {
        startTime: startTime,
        sourcePath: this.sourcePath,
        outputPath: this.outputPath,
        networkName: this.networkDefinition.networkName,
        maxCycles: this.maxCycles,
        verbose: this.verbose
      };

      // Initialize outputs collection
      const outputs = {
        elfBinary: null,
        diagnostics: [],
        logs: []
      };

      // Assemble execution context
      this.executionContext = {
        runtime: this,
        builtins: builtins,
        buffers: buffers,
        metadata: metadata,
        outputs: outputs
      };

      this.logProgress('CONTEXT', 'Execution context created', {
        builtinFunctions: Object.keys(builtins).length,
        signalBuffers: Object.keys(buffers).length
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
   * Run the compilation pipeline: inject signal, execute cycles
   * @private
   */
  async runCompilationPipeline() {
    this.logProgress('PIPELINE', 'Initializing network runner');

    try {
      // Create network runner
      this.networkRunner = new NetworkRunner(this.networkDefinition);
      this.networkRunner.initialize();

      // Create tidal cycle scheduler
      const signalQueue = new SignalQueue();
      this.scheduler = new TidalCycleScheduler(
        this.networkRunner.signalRouter,
        this.networkRunner.agents,
        {
          signalQueue: signalQueue,
          maxCyclesPerCompilation: this.maxCycles,
          restDuration: 1
        }
      );

      // Compute execution order
      this.scheduler.computeExecutionOrder();

      // Inject initial compile_request signal
      await this.injectInitialSignal(signalQueue);

      // Run scheduler until quiescence
      this.logProgress('PIPELINE', 'Running tidal cycle execution');
      const stats = await this.scheduler.runCompilation();

      // Store statistics
      this.compilationResult.stats = {
        ...this.compilationResult.stats,
        cycles: stats.totalCycles,
        signalsProcessed: stats.totalSignalsProcessed,
        restTimeMs: stats.totalRestTimeMs,
        senseTimeMs: stats.totalSenseTimeMs,
        actTimeMs: stats.totalActTimeMs,
        averageCycleTimeMs: stats.averageCycleTimeMs,
        errors: stats.errors
      };

      this.logProgress('PIPELINE', 'Pipeline execution complete', {
        cycles: stats.totalCycles,
        signals: stats.totalSignalsProcessed
      });

    } catch (error) {
      this.logError(error, 'pipeline', {});
      throw new Error(`Pipeline execution failed: ${error.message}`);
    }
  }

  /**
   * Inject initial compile_request signal to trigger compilation
   * @param {SignalQueue} signalQueue - Signal queue instance
   * @private
   */
  async injectInitialSignal(signalQueue) {
    this.logProgress('SIGNAL', 'Injecting initial compile_request signal');

    try {
      // Find the entry point agent (typically named 'compiler' or first in topology)
      const entryAgent = this.networkDefinition.topology.spawns[0];

      if (!entryAgent) {
        throw new Error('No agents spawned in topology - cannot inject initial signal');
      }

      // Create compile_request signal
      const initialSignal = {
        frequency: 'compile_request',
        payload: {
          source_path: this.sourcePath,
          output_path: this.outputPath,
          timestamp: Date.now()
        },
        source: 'runtime'
      };

      // Enqueue to entry agent
      signalQueue.enqueue(entryAgent.instanceId, initialSignal);

      this.logProgress('SIGNAL', `Queued signal to ${entryAgent.instanceId}`);

    } catch (error) {
      this.logError(error, 'signal', {});
      throw new Error(`Failed to inject initial signal: ${error.message}`);
    }
  }

  /**
   * Extract compilation results from agent outputs
   * @private
   */
  async extractCompilationResults() {
    this.logProgress('EXTRACT', 'Extracting compilation results');

    try {
      // Collect final state from all agents
      const agentStates = this.networkRunner.getAgentStates();

      // Look for output in special 'output' or 'codegen' agents
      let elfBinary = null;

      for (const [agentId, state] of Object.entries(agentStates)) {
        // Check if agent has binary output
        if (state.output_binary) {
          elfBinary = state.output_binary;
          this.logProgress('EXTRACT', `Found ELF binary in agent ${agentId}`);
          break;
        }

        // Check for compiled_elf field
        if (state.compiled_elf) {
          elfBinary = state.compiled_elf;
          this.logProgress('EXTRACT', `Found compiled ELF in agent ${agentId}`);
          break;
        }
      }

      // For now, generate a placeholder ELF binary if none found
      if (!elfBinary) {
        this.compilationResult.warnings.push('No ELF binary generated by agents');
        elfBinary = this.generatePlaceholderELF();
      }

      // Store in execution context
      this.executionContext.outputs.elfBinary = elfBinary;

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
      const elfBinary = this.executionContext.outputs.elfBinary;

      if (!elfBinary) {
        throw new Error('No ELF binary to write');
      }

      // Convert to Buffer if needed
      const binaryBuffer = Buffer.isBuffer(elfBinary)
        ? elfBinary
        : Buffer.from(elfBinary);

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
   * Generate a placeholder ELF binary (for testing)
   * @returns {Buffer} Minimal ELF binary
   * @private
   */
  generatePlaceholderELF() {
    // Minimal ELF header for x86-64 Linux
    const elfHeader = Buffer.from([
      0x7f, 0x45, 0x4c, 0x46, // ELF magic
      0x02, 0x01, 0x01, 0x00, // 64-bit, little-endian, current version
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // padding
      0x02, 0x00, 0x3e, 0x00, // executable, x86-64
      0x01, 0x00, 0x00, 0x00, // version 1
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // entry point
      0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // program header offset
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // section header offset
      0x00, 0x00, 0x00, 0x00, // flags
      0x40, 0x00, 0x38, 0x00, 0x00, 0x00, 0x00, 0x00  // header size and counts
    ]);

    return elfHeader;
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
