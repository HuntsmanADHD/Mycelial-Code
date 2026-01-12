#!/usr/bin/env node
const { MycelialParser } = require('./src/interpreter/parser.js');
const { SymbolTable } = require('./src/compiler/symbol-table.js');
const fs = require('fs');

const src = fs.readFileSync('../tests/pipeline.mycelial', 'utf8');
const parser = new MycelialParser();
const network = parser.parseNetwork(src);

const symbolTable = new SymbolTable(network);
symbolTable.analyze();

console.log('=== Routing Table ===');
console.log(`Total routes: ${symbolTable.routingTable.size}`);
console.log('');

for (const [key, destinations] of symbolTable.routingTable.entries()) {
  console.log(`${key} --> [${destinations.join(', ')}]`);
}

console.log('\n=== Expected Routes ===');
console.log('input.raw_data --> [V]');
console.log('V.validated_data --> [P]');
console.log('P.processed_data --> [F]');
console.log('F.formatted_output --> [output]');
