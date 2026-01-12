#!/usr/bin/env node
const { MycelialParser } = require('./src/interpreter/parser.js');
const fs = require('fs');

const src = fs.readFileSync('../tests/pipeline.mycelial', 'utf8');
const parser = new MycelialParser();
const network = parser.parseNetwork(src);

const validator = network.hyphae.validator;
const handler = validator.handlers[0]; // First handler (raw_data signal)

console.log('=== Validator raw_data Handler ===');
console.log('Signal:', handler.signal);
console.log('Param:', handler.param);
console.log('\nBody type:', handler.body.type);
console.log('\nFull body:');
console.log(JSON.stringify(handler.body, null, 2));
