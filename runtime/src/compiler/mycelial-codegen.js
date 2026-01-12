/**
 * Mycelial Code Generator (Main Orchestrator)
 *
 * Ties together all compilation phases to generate complete x86-64 assembly
 * from a Mycelial network AST.
 *
 * Pipeline:
 *   Network AST → Symbol Table → Code Generators → Assembly Text
 *
 * Generates complete assembly file with:
 *   - .text section: handlers, scheduler, builtins
 *   - .rodata section: string literals, routing table
 *   - .data section: agent states, queues, heap metadata
 *   - .bss section: heap arena
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-10
 */

const { SymbolTable } = require('./symbol-table.js');
const { ExpressionCompiler } = require('./expression-compiler.js');
const { StatementCompiler } = require('./statement-compiler.js');
const { HandlerCodeGenerator } = require('./handler-codegen.js');
const { SchedulerCodeGenerator } = require('./scheduler-codegen.js');
const { BuiltinFunctionsGenerator } = require('./builtin-asm.js');

class MycelialCodeGenerator {
  constructor(network) {
    this.network = network;
    this.symbolTable = null;
    this.exprCompiler = null;
    this.stmtCompiler = null;
    this.handlerGen = null;
    this.schedulerGen = null;
    this.builtinGen = null;
  }

  /**
   * Generate complete x86-64 assembly from network AST
   * @returns {string} Complete assembly source code
   */
  generate() {
    // Phase 1: Build symbol table
    this.symbolTable = new SymbolTable(this.network);
    this.symbolTable.analyze();

    // Phase 2-6: Initialize code generators
    this.exprCompiler = new ExpressionCompiler(this.symbolTable);
    this.stmtCompiler = new StatementCompiler(this.symbolTable, this.exprCompiler);
    this.handlerGen = new HandlerCodeGenerator(this.symbolTable, this.exprCompiler, this.stmtCompiler);
    this.schedulerGen = new SchedulerCodeGenerator(this.symbolTable);
    this.builtinGen = new BuiltinFunctionsGenerator();

    // Generate complete assembly
    const sections = [];

    // File header
    sections.push(this.generateFileHeader());

    // .text section (code)
    sections.push(this.generateTextSection());

    // .rodata section (read-only data)
    sections.push(this.generateRodataSection());

    // .data section (initialized data)
    sections.push(this.generateDataSection());

    // .bss section (uninitialized data)
    sections.push(this.generateBssSection());

    return sections.join('\n\n');
  }

  /**
   * Generate file header with metadata
   */
  generateFileHeader() {
    const lines = [];

    lines.push('# ================================================================');
    lines.push('# Mycelial Native Code - x86-64 Assembly');
    lines.push(`# Network: ${this.network.name}`);
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push('# Target: Linux x86-64 (System V AMD64 ABI)');
    lines.push('# ================================================================');
    lines.push('');
    lines.push('.intel_syntax noprefix');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate .text section (executable code)
   */
  generateTextSection() {
    const lines = [];

    lines.push('# ================================================================');
    lines.push('# .text section - Executable code');
    lines.push('# ================================================================');
    lines.push('.section .text');
    lines.push('.global _start');
    lines.push('');

    // 1. Scheduler and main loop
    lines.push('# ----------------------------------------------------------------');
    lines.push('# Scheduler and Main Loop');
    lines.push('# ----------------------------------------------------------------');
    const schedulerCode = this.schedulerGen.generateScheduler();
    lines.push(schedulerCode);
    lines.push('');

    // 2. Signal handlers
    lines.push('# ----------------------------------------------------------------');
    lines.push('# Signal Handlers');
    lines.push('# ----------------------------------------------------------------');
    const handlers = this.handlerGen.generateAllNetworkHandlers();
    for (const handler of handlers) {
      lines.push(handler.code);
      lines.push('');
    }

    // 3. Builtin functions
    lines.push('# ----------------------------------------------------------------');
    lines.push('# Builtin Functions');
    lines.push('# ----------------------------------------------------------------');
    const builtinCode = this.builtinGen.generateAll();
    lines.push(builtinCode);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate .rodata section (read-only data)
   */
  generateRodataSection() {
    const lines = [];

    lines.push('# ================================================================');
    lines.push('# .rodata section - Read-only data');
    lines.push('# ================================================================');
    lines.push('.section .rodata');
    lines.push('');

    // String literals collected during expression compilation
    lines.push('# String literals');
    const stringLiterals = this.exprCompiler.getStringLiterals();
    if (stringLiterals.size === 0) {
      // Add a default empty string if none were collected
      lines.push('.str_empty:');
      lines.push('    .asciz ""');
    } else {
      for (const [str, label] of stringLiterals.entries()) {
        lines.push(`${label}:`);
        lines.push(`    .asciz "${this.escapeString(str)}"`);
      }
    }
    lines.push('');

    // Newline string for println
    lines.push('# Newline character for println');
    lines.push('newline_str:');
    lines.push('    .asciz "\\n"');
    lines.push('');

    // Output signal prefix
    lines.push('# Output signal prefix');
    lines.push('output_prefix:');
    lines.push('    .asciz "OUTPUT: "');
    lines.push('');

    // Minus sign for negative numbers
    lines.push('# Minus sign for integer printing');
    lines.push('minus_sign:');
    lines.push('    .asciz "-"');
    lines.push('');

    // Space character
    lines.push('# Space character');
    lines.push('space_str:');
    lines.push('    .asciz " "');
    lines.push('');

    // Routing table (static dispatch table)
    lines.push('# Signal routing table');
    lines.push('# Format: [frequency_id, from_agent_id, to_agent_id, handler_ptr]');
    lines.push('routing_table:');
    lines.push('    .quad 0    # placeholder - routing is done in emit_signal');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate .data section (initialized data)
   */
  generateDataSection() {
    const lines = [];

    lines.push('# ================================================================');
    lines.push('# .data section - Initialized data');
    lines.push('# ================================================================');
    lines.push('.section .data');
    lines.push('');

    // Agent states
    lines.push('# Agent states');
    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      lines.push(`agent_${agentId}_state:`);

      const typeDef = agent.typeDef;
      if (typeDef.state && typeDef.state.length > 0) {
        // Initialize each state field with its initial value (or 0 if not specified)
        for (const field of typeDef.state) {
          const size = this.getTypeSize(field.type);
          // Get initial value from field.default (set by parser)
          let initialValue = 0;

          if (field.default) {
            if (field.default.type === 'literal') {
              initialValue = field.default.value;
            } else if (field.default.type === 'map-literal' && field.type.startsWith('map')) {
              // Empty map literal {} - point to empty map structure
              initialValue = `agent_${agentId}_${field.name}_empty_map`;
            } else if (field.default.type === 'array-literal' && field.type.startsWith('vec')) {
              // Empty array literal [] - point to empty vec structure
              initialValue = `agent_${agentId}_${field.name}_empty_vec`;
            }
          }

          if (size === 8) {
            if (field.type === 'string' || field.type.startsWith('vec') || field.type.startsWith('map')) {
              lines.push(`    .quad ${initialValue}    # ${field.name}: ${field.type} (pointer)`);
            } else {
              lines.push(`    .quad ${initialValue}    # ${field.name}: ${field.type}`);
            }
          } else if (size === 4) {
            lines.push(`    .long ${initialValue}    # ${field.name}: ${field.type}`);
          } else if (size === 1) {
            lines.push(`    .byte ${initialValue}    # ${field.name}: ${field.type}`);
          }
        }
      } else {
        // No state - just a placeholder
        lines.push('    .quad 0    # no state');
      }
      lines.push('');
    }

    // Empty map/vec structures for state initialization
    lines.push('# Empty structures for state initialization');
    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      const typeDef = agent.typeDef;
      if (typeDef.state && typeDef.state.length > 0) {
        for (const field of typeDef.state) {
          if (field.default) {
            if (field.default.type === 'map-literal' && field.type.startsWith('map')) {
              // Generate empty map structure: { ptr: 0, len: 0, cap: 0 }
              lines.push(`agent_${agentId}_${field.name}_empty_map:`);
              lines.push(`    .quad 0    # ptr (null for empty map)`);
              lines.push(`    .quad 0    # len`);
              lines.push(`    .quad 0    # cap`);
            } else if (field.default.type === 'array-literal' && field.type.startsWith('vec')) {
              // Generate empty vec structure: { ptr: 0, len: 0, cap: 0 }
              lines.push(`agent_${agentId}_${field.name}_empty_vec:`);
              lines.push(`    .quad 0    # ptr (null for empty vec)`);
              lines.push(`    .quad 0    # len`);
              lines.push(`    .quad 0    # cap`);
            }
          }
        }
      }
    }
    lines.push('');

    // Agent ID labels (for runtime identification)
    lines.push('# Agent IDs');
    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      lines.push(`agent_${agentId}_id:`);
      lines.push(`    .asciz "${agentId}"`);
    }
    lines.push('');

    // Frequency ID labels
    lines.push('# Frequency IDs');
    let freqId = 1;
    for (const [freqName, freqDef] of this.symbolTable.frequencies.entries()) {
      lines.push(`freq_${freqName}:`);
      lines.push(`    .asciz "${freqName}"`);
      lines.push(`freq_${freqName}_id:`);
      lines.push(`    .quad ${freqId}`);
      freqId++;
    }
    lines.push('');

    // Initial payload - detect frequency from first input connection
    let initialFreq = null;
    for (const [key, dests] of this.symbolTable.routingTable.entries()) {
      if (key.startsWith('input.')) {
        const [source, frequency] = key.split('.');
        initialFreq = frequency;
        break;
      }
    }

    lines.push('# Initial payload');
    lines.push('initial_payload:');

    if (initialFreq) {
      const freqDef = this.symbolTable.frequencies.get(initialFreq);
      if (freqDef && freqDef.fields.length > 0) {
        lines.push(`    # Payload for frequency: ${initialFreq}`);

        // Generate initial values for each field with proper alignment
        let currentOffset = 0;
        for (const field of freqDef.fields) {
          const typeSize = this.getTypeSize(field.type);

          // Add padding for alignment if needed
          if (typeSize === 8 && currentOffset % 8 !== 0) {
            const padding = 8 - (currentOffset % 8);
            lines.push(`    .skip ${padding}    # alignment padding`);
            currentOffset += padding;
          } else if (typeSize === 4 && currentOffset % 4 !== 0) {
            const padding = 4 - (currentOffset % 4);
            lines.push(`    .skip ${padding}    # alignment padding`);
            currentOffset += padding;
          }

          if (field.type === 'string') {
            lines.push(`    .quad initial_${field.name}_str    # ${field.name}: ${field.type}`);
            currentOffset += 8;
          } else if (field.type.startsWith('vec<')) {
            // Create a test vector with some data
            lines.push(`    .quad initial_${field.name}_vec    # ${field.name}: ${field.type}`);
            currentOffset += 8;
          } else if (typeSize === 8) {
            lines.push(`    .quad ${field.name === 'id' ? 1 : 0}    # ${field.name}: ${field.type}`);
            currentOffset += 8;
          } else if (typeSize === 4) {
            lines.push(`    .long ${field.name === 'id' ? 1 : 0}    # ${field.name}: ${field.type}`);
            currentOffset += 4;
          } else if (typeSize === 1) {
            lines.push(`    .byte 0    # ${field.name}: ${field.type}`);
            currentOffset += 1;
          }
        }

        lines.push('');

        // Generate string literals for string fields
        for (const field of freqDef.fields) {
          if (field.type === 'string') {
            lines.push(`initial_${field.name}_str:`);
            lines.push(`    .asciz "test_data"`);
          }
        }

        // Generate test vectors for vector fields
        for (const field of freqDef.fields) {
          if (field.type.startsWith('vec<')) {
            lines.push(`# Test vector for ${field.name}`);
            lines.push(`initial_${field.name}_vec:`);
            lines.push(`    .quad initial_${field.name}_vec_data    # ptr`);
            lines.push(`    .quad 9                                   # len`);
            lines.push(`    .quad 9                                   # cap`);
            lines.push(`initial_${field.name}_vec_data:`);
            lines.push(`    .quad 1, 2, 3, 4, 5, 6, 7, 8, 9    # test data [1..9]`);
          }
        }
      } else {
        lines.push('    .quad 0    # empty payload');
      }
    } else {
      // Fallback: greeting signal
      lines.push('    .quad initial_name_str    # name field');
      lines.push('');
      lines.push('initial_name_str:');
      lines.push('    .asciz "World"');
    }
    lines.push('');

    // Signal queues for each agent
    lines.push('# Signal queues (head, tail, count)');
    for (const [agentId, agent] of this.symbolTable.agents.entries()) {
      lines.push(`queue_${agentId}:`);
      lines.push(`    .quad 0    # head`);
      lines.push(`    .quad 0    # tail`);
      lines.push(`    .quad 0    # count`);
      lines.push('');
    }

    // Signal queues for fruiting bodies
    for (const fb of this.symbolTable.fruitingBodies) {
      lines.push(`queue_${fb}:`);
      lines.push(`    .quad 0    # head`);
      lines.push(`    .quad 0    # tail`);
      lines.push(`    .quad 0    # count`);
      lines.push('');
    }

    // Heap pointer (for bump allocator)
    lines.push('# Heap metadata');
    lines.push('heap_ptr:');
    lines.push('    .quad heap_arena    # current heap pointer');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate .bss section (uninitialized data)
   */
  generateBssSection() {
    const lines = [];

    lines.push('# ================================================================');
    lines.push('# .bss section - Uninitialized data');
    lines.push('# ================================================================');
    lines.push('.section .bss');
    lines.push('');

    // Heap arena (64KB for dynamic allocation)
    lines.push('# Heap arena for dynamic allocation (64KB)');
    lines.push('heap_arena:');
    lines.push('    .skip 65536');
    lines.push('');
    lines.push('heap_end:');
    lines.push('');

    // Signal storage pool (pre-allocated signal buffers)
    const poolSize = 1000; // 1000 signals
    const signalSize = 64;  // 64 bytes per signal
    lines.push(`# Signal storage pool (${poolSize} signals x ${signalSize} bytes)`);
    lines.push('signal_pool:');
    lines.push(`    .skip ${poolSize * signalSize}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Get size of a type in bytes
   */
  getTypeSize(type) {
    const sizeMap = {
      'u8': 1, 'i8': 1, 'bool': 1,
      'u16': 2, 'i16': 2,
      'u32': 4, 'i32': 4, 'f32': 4,
      'u64': 8, 'i64': 8, 'f64': 8,
      'string': 8,  // pointer
      'vec': 8,     // pointer
      'map': 8      // pointer
    };

    return sizeMap[type] || 8; // default to 8 bytes (pointer)
  }

  /**
   * Escape string for assembly
   */
  escapeString(str) {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}

module.exports = { MycelialCodeGenerator };
