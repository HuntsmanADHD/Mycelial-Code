#!/usr/bin/env node
const { MycelialParser } = require('./src/interpreter/parser.js');
const fs = require('fs');

const src = fs.readFileSync('../tests/pipeline.mycelial', 'utf8');
const parser = new MycelialParser();

const network = parser.parseNetwork(src);

// Check processor handler (has the let statement)
const processorHandler = network.hyphae.processor.handlers[0];
console.log('=== Processor Handler ===');
console.log(`Type: ${processorHandler.type}`);
console.log(`Frequency: ${processorHandler.frequency}`);
console.log(`\nBody (${processorHandler.body.length} statements):`);

processorHandler.body.forEach((stmt, i) => {
  console.log(`\n--- Statement ${i} ---`);
  console.log(`Type: ${stmt.type || 'UNDEFINED'}`);
  console.log(`Full AST:`);
  console.log(JSON.stringify(stmt, null, 2));
});
