#!/usr/bin/env node
const { MycelialParser } = require('./src/interpreter/parser.js');
const { MycelialCodeGenerator } = require('./src/compiler/mycelial-codegen.js');
const fs = require('fs');

const src = fs.readFileSync('../tests/pipeline.mycelial', 'utf8');
const parser = new MycelialParser();
const network = parser.parseNetwork(src);

const codegen = new MycelialCodeGenerator(network);
const assembly = codegen.generate();

// Find and display initial_payload section
const lines = assembly.split('\n');
const startIdx = lines.findIndex(l => l.includes('initial_payload:'));
if (startIdx >= 0) {
  console.log('=== Initial Payload Section ===');
  for (let i = startIdx; i < Math.min(startIdx + 15, lines.length); i++) {
    console.log(lines[i]);
  }
}

// Find first agent that receives from input
console.log('\n=== Routing Table ===');
for (const [key, routes] of codegen.symbolTable.routingTable.entries()) {
  if (key.startsWith('input.')) {
    console.log(`${key}:`, routes);
  }
}
