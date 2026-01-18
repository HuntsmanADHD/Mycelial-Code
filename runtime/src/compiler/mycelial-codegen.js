/**
 * Mycelial Code Generator - Main Orchestrator
 *
 * Ties together all compilation phases to generate native x86-64 code
 * from Mycelial network AST.
 *
 * Pipeline:
 * 1. Build symbol table from AST
 * 2. Generate scheduler and main loop
 * 3. Generate handler functions
 * 4. Combine into complete assembly
 * 5. Assemble to machine code
 * 6. Link into ELF binary
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-15
 */

const { SymbolTable } = require('./symbol-table.js');
const { HandlerCodegen } = require('./handler-codegen.js');
const { SchedulerCodegen } = require('./scheduler-codegen.js');
const { BuiltinFunctionsGenerator } = require('./builtin-asm.js');

class MycelialCodegen {
  constructor(networkAST, options = {}) {
    this.network = networkAST;
    this.options = {
      verbose: options.verbose || false,
      debugInfo: options.debugInfo || false,
      optimize: options.optimize || false
    };

    this.symbolTable = null;
    this.assembly = [];
    // Shared label counter for all compilers to ensure unique labels
    this.sharedLabelCounter = { count: 0 };
  }

  /**
   * Generate complete assembly code from network AST
   */
  generate() {
    if (this.options.verbose) {
      console.error('[CODEGEN] Starting code generation...');
    }

    // Phase 1: Build symbol table
    this.symbolTable = new SymbolTable(this.network);
    this.symbolTable.build();

    // Phase 2: Generate assembly code
    this.assembly = [];
    
    this.generateHeader();
    this.generateTextSection();
    this.generateDataSection();
    
    if (this.options.verbose) {
      console.error(`[CODEGEN] Generated ${this.assembly.length} lines of assembly`);
    }

    return this.assembly.join('\n');
  }

  /**
   * Generate file header with metadata
   */
  generateHeader() {
    this.assembly.push('# ================================================================');
    this.assembly.push('# Generated Mycelial Program');
    this.assembly.push(`# Network: ${this.network.name}`);
    this.assembly.push(`# Generated: ${new Date().toISOString()}`);
    this.assembly.push('# ================================================================');
    this.assembly.push('# Agents: ' + this.symbolTable.stats.agentCount);
    this.assembly.push('# Frequencies: ' + this.symbolTable.stats.frequencyCount);
    this.assembly.push('# Handlers: ' + this.symbolTable.stats.handlerCount);
    this.assembly.push('# Total State: ' + this.symbolTable.totalStateSize + ' bytes');
    this.assembly.push('# ================================================================');
    this.assembly.push('');
    this.assembly.push('.intel_syntax noprefix');
    this.assembly.push('');
  }

  /**
   * Generate .text section (code)
   */
  generateTextSection() {
    this.assembly.push('.text');
    this.assembly.push('.globl _start');
    this.assembly.push('');

    // Generate scheduler and main loop
    const schedulerGen = new SchedulerCodegen(this.symbolTable);
    this.assembly.push(...schedulerGen.generateScheduler());
    this.assembly.push(...schedulerGen.generateSignalProcessors());
    this.assembly.push(...schedulerGen.generateQueueFunctions());
    this.assembly.push(...schedulerGen.generateInitialSignalHelper());

    // Generate handlers for all agents
    const allStringLiterals = [];

    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      if (this.options.verbose) {
        console.error(`[CODEGEN] Generating handlers for agent: ${agentId}`);
      }

      const handlerGen = new HandlerCodegen(this.symbolTable, agentId, this.sharedLabelCounter);
      const handlers = handlerGen.generateAllHandlers();

      console.error(`[DEBUG] After generateAllHandlers for ${agentId}:`);
      console.error(`[DEBUG]   handlerGen.stmtCompiler.exprCompiler.stringLiterals =`,
        handlerGen.stmtCompiler.exprCompiler.stringLiterals);

      for (const handler of handlers) {
        this.assembly.push(...handler.code);
        // Collect string literals from this handler
        console.error(`[DEBUG]   handler.name = ${handler.name}, handler.stringLiterals =`, handler.stringLiterals);
        if (handler.stringLiterals) {
          allStringLiterals.push(...handler.stringLiterals);
        }
      }

      // Add dispatch table to data section (we'll add it later)
    }

    // Deduplicate string literals by label
    const uniqueLiterals = new Map();
    for (const lit of allStringLiterals) {
      if (!uniqueLiterals.has(lit.label)) {
        uniqueLiterals.set(lit.label, lit);
      }
    }
    const deduplicatedLiterals = Array.from(uniqueLiterals.values());

    console.error(`[DEBUG] Total string literals collected: ${allStringLiterals.length}, unique: ${deduplicatedLiterals.length}`, deduplicatedLiterals);

    // Store string literals for later use in data section
    this.stringLiterals = deduplicatedLiterals;

    // Builtin functions are provided by the C runtime (complete-builtins.o)
    // Do NOT generate them here - they should be external symbols
    // this.assembly.push('# ================================================================');
    // this.assembly.push('# Builtin Functions');
    // this.assembly.push('# ================================================================');
    // const builtinGen = new BuiltinFunctionsGenerator();
    // this.assembly.push(builtinGen.generateStringFunctions());
    // this.assembly.push(builtinGen.generateIOFunctions());
    // this.assembly.push(builtinGen.generateMemoryFunctions());
    // this.assembly.push(builtinGen.generateVectorFunctions());
    // this.assembly.push(builtinGen.generateMapFunctions());
    // this.assembly.push(builtinGen.generateUtilityFunctions());
    this.assembly.push('');
  }

  /**
   * Generate .data and .bss sections
   */
  generateDataSection() {
    const schedulerGen = new SchedulerCodegen(this.symbolTable);

    this.assembly.push('# ================================================================');
    this.assembly.push('# Data Section');
    this.assembly.push('# ================================================================');

    // Queue data structures
    this.assembly.push(...schedulerGen.generateQueueDataStructures());

    // Dispatch tables (skipped - handlers called directly for now)
    // for (const [agentId, agent] of this.symbolTable.agents.entries()) {
    //   const handlerGen = new HandlerCodegen(this.symbolTable, agentId);
    //   this.assembly.push(...handlerGen.generateDispatchTable());
    // }

    // String literals
    this.assembly.push('.data');
    this.assembly.push('');
    this.assembly.push('# String literals');
    this.assembly.push('newline_str:');
    this.assembly.push('    .byte 10, 0              # "\\n" with null terminator');
    this.assembly.push('');
    this.assembly.push('minus_sign:');
    this.assembly.push('    .byte 45, 0              # "-" with null terminator');
    this.assembly.push('');
    this.assembly.push('output_prefix:');
    this.assembly.push('    .string "OUTPUT: "');
    this.assembly.push('');

    // Add collected string literals
    if (this.stringLiterals && this.stringLiterals.length > 0) {
      this.assembly.push('# Program string literals');
      for (const { label, value } of this.stringLiterals) {
        // Escape the string value for .string directive
        const escaped = value
          .replace(/\\/g, '\\\\')  // Backslash → \\
          .replace(/"/g, '\\"')     // Quote → \"
          .replace(/\n/g, '\\n')    // Newline → \n
          .replace(/\t/g, '\\t')    // Tab → \t
          .replace(/\r/g, '\\r');   // Carriage return → \r
        this.assembly.push(`${label}:`);
        this.assembly.push(`    .string "${escaped}"`);
      }
      this.assembly.push('');
    }

    // Heap management variables
    this.assembly.push('# Heap management');
    this.assembly.push('.bss');
    this.assembly.push('heap_ptr:');
    this.assembly.push('    .skip 8                  # Current heap pointer');
    this.assembly.push('heap_end:');
    this.assembly.push('    .skip 8                  # End of heap');
    this.assembly.push('heap_arena:');
    this.assembly.push('    .skip 65536              # 64KB heap for signal payloads');
    this.assembly.push('');
  }

  /**
   * Get symbol table (for debugging)
   */
  getSymbolTable() {
    return this.symbolTable;
  }

  /**
   * Get assembly as array of lines
   */
  getAssemblyLines() {
    return this.assembly;
  }

  /**
   * Get statistics about generated code
   */
  getStats() {
    return {
      assemblyLines: this.assembly.length,
      network: this.network.name,
      ...this.symbolTable.stats,
      totalStateSize: this.symbolTable.totalStateSize
    };
  }
}

module.exports = { MycelialCodeGenerator: MycelialCodegen };
