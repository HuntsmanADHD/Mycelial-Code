#!/usr/bin/env node
const { MycelialParser } = require('./src/interpreter/parser.js');
const fs = require('fs');

const src = fs.readFileSync('../tests/pipeline.mycelial', 'utf8');
const parser = new MycelialParser();

try {
  const network = parser.parseNetwork(src);
  console.log('✅ Parsed successfully!');
  console.log('Network:', network.name);

  const handler = network.hyphae.validator.handlers[0];
  console.log('\n=== First IF statement ===');
  console.log('Condition type:', handler.body[0].condition.type);
  console.log('\nFull condition AST:');
  console.log(JSON.stringify(handler.body[0].condition, null, 2));

  console.log('\n=== Analyzing condition structure ===');
  const cond = handler.body[0].condition;
  if (cond.type === 'binary') {
    console.log('Binary operator:', cond.operator);
    console.log('Left side type:', cond.left.type);
    console.log('Right side type:', cond.right.type);
  }

} catch(e) {
  console.log('❌ Parse error:', e.message);
  console.log(e.stack);
}
