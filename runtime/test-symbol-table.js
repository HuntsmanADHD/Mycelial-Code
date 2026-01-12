#!/usr/bin/env node
/**
 * Test symbol table with hello_world.mycelial
 */

const { MycelialParser } = require('./src/interpreter/parser.js');
const { SymbolTable } = require('./src/compiler/symbol-table.js');
const fs = require('fs');

console.log('='.repeat(70));
console.log('Testing Symbol Table with hello_world.mycelial');
console.log('='.repeat(70));

// Load and parse hello_world.mycelial
const sourceCode = fs.readFileSync('../tests/hello_world.mycelial', 'utf8');
console.log('\n✓ Source code loaded');

const parser = new MycelialParser();
const network = parser.parseNetwork(sourceCode);
console.log('✓ Network parsed');

// Create and analyze symbol table
console.log('\n--- Building Symbol Table ---\n');
const symbolTable = new SymbolTable(network);
symbolTable.analyze();

// Display detailed information
console.log('\n--- Detailed Information ---\n');

console.log('Frequencies:');
for (const [name, freq] of symbolTable.frequencies.entries()) {
  console.log(`  ${name}:`);
  for (const field of freq.fields) {
    console.log(`    - ${field.name}: ${field.type}`);
  }
}

console.log('\nHyphal Types:');
for (const [name, type] of symbolTable.hyphalTypes.entries()) {
  console.log(`  ${name}:`);
  console.log(`    State fields: ${type.state.length}`);
  console.log(`    Handlers: ${type.handlers.length}`);
  for (const handler of type.handlers) {
    console.log(`      - on ${handler.type}(${handler.frequency})`);
  }
}

console.log('\nAgents:');
for (const [id, agent] of symbolTable.agents.entries()) {
  console.log(`  ${id}:`);
  console.log(`    Type: ${agent.type}`);
  console.log(`    State offset: 0x${agent.stateOffset.toString(16)}`);
  console.log(`    State size: ${agent.stateSize} bytes`);
}

console.log('\nRouting Table:');
for (const [key, dests] of symbolTable.routingTable.entries()) {
  console.log(`  ${key} -> [${dests.join(', ')}]`);
}

console.log('\nHandlers:');
for (const handler of symbolTable.handlers) {
  console.log(`  ${handler.label}: ${handler.agent} on ${handler.frequency}`);
}

console.log('\n' + '='.repeat(70));
console.log('Test complete!');
console.log('='.repeat(70));
