#!/usr/bin/env node
/**
 * Test Mycelial Code Generator (Complete Pipeline)
 *
 * Tests the complete code generation pipeline from Mycelial source
 * to x86-64 assembly.
 */

const { MycelialParser } = require('./src/interpreter/parser.js');
const { MycelialCodeGenerator } = require('./src/compiler/mycelial-codegen.js');
const fs = require('fs');

console.log('='.repeat(70));
console.log('Testing Complete Mycelial Code Generator');
console.log('='.repeat(70));

// Load and parse hello_world.mycelial
const sourceCode = fs.readFileSync('../tests/hello_world.mycelial', 'utf8');

console.log('\n--- Source Code ---\n');
console.log(sourceCode);

const parser = new MycelialParser();
const network = parser.parseNetwork(sourceCode);

console.log('\n--- Network AST ---\n');
console.log(`Network name: ${network.name}`);
console.log(`Frequencies: ${Object.keys(network.frequencies).join(', ')}`);
console.log(`Hyphae: ${Object.keys(network.hyphae).join(', ')}`);
console.log(`Spawns: ${network.spawns.map(s => s.instanceId).join(', ')}`);
console.log(`Sockets: ${network.sockets.length} connections`);

console.log('\n' + '='.repeat(70));
console.log('Generating Complete x86-64 Assembly');
console.log('='.repeat(70));

// Generate code
const codegen = new MycelialCodeGenerator(network);
const assemblyCode = codegen.generate();

// Display the complete assembly
console.log('\n' + assemblyCode);

console.log('\n' + '='.repeat(70));
console.log('Code Generation Complete!');
console.log('='.repeat(70));

// Write assembly to file
const outputPath = '/tmp/hello_world.s';
fs.writeFileSync(outputPath, assemblyCode);
console.log(`\nAssembly written to: ${outputPath}`);

// Show statistics
console.log('\n--- Statistics ---');
const lines = assemblyCode.split('\n');
console.log(`Total lines: ${lines.length}`);
console.log(`Size: ${assemblyCode.length} bytes`);

const sections = {
  text: assemblyCode.match(/\.section \.text/g)?.length || 0,
  rodata: assemblyCode.match(/\.section \.rodata/g)?.length || 0,
  data: assemblyCode.match(/\.section \.data/g)?.length || 0,
  bss: assemblyCode.match(/\.section \.bss/g)?.length || 0
};

console.log('\nSections:');
console.log(`  .text (code): ${sections.text ? '✓' : '✗'}`);
console.log(`  .rodata (strings): ${sections.rodata ? '✓' : '✗'}`);
console.log(`  .data (initialized): ${sections.data ? '✓' : '✗'}`);
console.log(`  .bss (uninitialized): ${sections.bss ? '✓' : '✗'}`);

console.log('\nComponents:');
console.log(`  Handlers: ${(assemblyCode.match(/handler_\w+_\w+:/g) || []).length}`);
console.log(`  Builtin functions: ${(assemblyCode.match(/builtin_\w+:/g) || []).length}`);
console.log(`  Agent states: ${(assemblyCode.match(/agent_\w+_state:/g) || []).length}`);
console.log(`  String literals: ${(assemblyCode.match(/\.str_\w+:/g) || []).length}`);

console.log('\n' + '='.repeat(70));
