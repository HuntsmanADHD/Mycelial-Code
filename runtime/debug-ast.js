#!/usr/bin/env node
/**
 * Debug AST structure
 */

const { MycelialParser } = require('./src/interpreter/parser.js');
const fs = require('fs');

const sourceCode = fs.readFileSync('../tests/hello_world.mycelial', 'utf8');
const parser = new MycelialParser();
const network = parser.parseNetwork(sourceCode);

console.log('Network AST:');
console.log(JSON.stringify(network, null, 2));
