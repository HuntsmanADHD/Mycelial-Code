#!/usr/bin/env node
/**
 * Test Scheduler Code Generator
 *
 * Tests the scheduler/main loop code generator with hello_world.mycelial
 */

const { MycelialParser } = require('./src/interpreter/parser.js');
const { SymbolTable } = require('./src/compiler/symbol-table.js');
const { SchedulerCodeGenerator } = require('./src/compiler/scheduler-codegen.js');
const fs = require('fs');

console.log('='.repeat(70));
console.log('Testing Scheduler Code Generator with hello_world.mycelial');
console.log('='.repeat(70));

// Load and parse hello_world.mycelial
const sourceCode = fs.readFileSync('../tests/hello_world.mycelial', 'utf8');
const parser = new MycelialParser();
const network = parser.parseNetwork(sourceCode);

// Build symbol table
console.log('\n--- Building Symbol Table ---\n');
const symbolTable = new SymbolTable(network);
symbolTable.analyze();

// Create scheduler generator
const schedulerGen = new SchedulerCodeGenerator(symbolTable);

console.log('\n--- Generating Scheduler Code ---\n');

// Generate complete scheduler
const schedulerCode = schedulerGen.generateScheduler();

console.log(schedulerCode);

console.log('\n' + '='.repeat(70));
console.log('Scheduler Code Generation Complete!');
console.log('='.repeat(70));

// Show what was generated
console.log('\n--- Summary ---');
console.log(`Network: ${network.name}`);
console.log(`Agents: ${symbolTable.agents.size}`);
console.log(`Handlers: ${symbolTable.handlers.length}`);
console.log(`Routing Rules: ${symbolTable.routingTable.size}`);
console.log('\nGenerated Components:');
console.log('  ✓ _start (entry point)');
console.log('  ✓ init_agents (agent state initialization)');
console.log('  ✓ init_queues (signal queue setup)');
console.log('  ✓ inject_initial_signal (startup)');
console.log('  ✓ tidal_cycle_loop (main execution loop)');
console.log('  ✓ sense_phase (signal dequeuing)');
console.log('  ✓ act_phase (handler dispatch)');
console.log('  ✓ emit_signal (signal routing)');
console.log('  ✓ enqueue_signal_simple (queue operations)');
console.log('  ✓ do_exit (program termination)');

console.log('\n' + '='.repeat(70));
