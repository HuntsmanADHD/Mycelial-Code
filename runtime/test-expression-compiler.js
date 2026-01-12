#!/usr/bin/env node
/**
 * Test Expression Compiler
 *
 * Tests the expression compiler with various expression types
 * and shows the generated x86-64 assembly code.
 */

const { MycelialParser } = require('./src/interpreter/parser.js');
const { SymbolTable } = require('./src/compiler/symbol-table.js');
const { ExpressionCompiler } = require('./src/compiler/expression-compiler.js');
const fs = require('fs');

console.log('='.repeat(70));
console.log('Testing Expression Compiler');
console.log('='.repeat(70));

// Load and parse hello_world.mycelial to get a real network
const sourceCode = fs.readFileSync('../tests/hello_world.mycelial', 'utf8');
const parser = new MycelialParser();
const network = parser.parseNetwork(sourceCode);

// Build symbol table
const symbolTable = new SymbolTable(network);
symbolTable.analyze();

// Create expression compiler
const exprCompiler = new ExpressionCompiler(symbolTable);

console.log('\n--- Test Cases ---\n');

// Test context for G1 agent with greeting handler
const context = {
  agentId: 'G1',
  signalFrequency: 'greeting',
  signalBinding: 'g',
  locals: {}
};

// Test 1: Number literal
console.log('1. Number Literal: 42');
console.log('   Expression AST: { type: "literal", value: 42 }');
const expr1 = { type: 'literal', value: 42 };
const asm1 = exprCompiler.compile(expr1, context);
console.log('   Generated Assembly:');
console.log(asm1);
console.log();

// Test 2: String literal
console.log('2. String Literal: "Hello, World!"');
const expr2 = { type: 'literal', value: 'Hello, World!' };
const asm2 = exprCompiler.compile(expr2, context);
console.log('   Generated Assembly:');
console.log(asm2);
console.log();

// Test 3: Boolean literal
console.log('3. Boolean Literal: true');
const expr3 = { type: 'literal', value: true };
const asm3 = exprCompiler.compile(expr3, context);
console.log('   Generated Assembly:');
console.log(asm3);
console.log();

// Test 4: Field access (signal payload)
console.log('4. Field Access: g.name');
const expr4 = {
  type: 'field-access',
  object: { type: 'variable', name: 'g' },
  field: 'name'
};
const asm4 = exprCompiler.compile(expr4, context);
console.log('   Generated Assembly:');
console.log(asm4);
console.log();

// Test 5: Binary operation (addition)
console.log('5. Binary Operation: 10 + 5');
const expr5 = {
  type: 'binary-op',
  operator: '+',
  left: { type: 'literal', value: 10 },
  right: { type: 'literal', value: 5 }
};
const asm5 = exprCompiler.compile(expr5, context);
console.log('   Generated Assembly:');
console.log(asm5);
console.log();

// Test 6: Binary operation (multiplication)
console.log('6. Binary Operation: 7 * 3');
const expr6 = {
  type: 'binary-op',
  operator: '*',
  left: { type: 'literal', value: 7 },
  right: { type: 'literal', value: 3 }
};
const asm6 = exprCompiler.compile(expr6, context);
console.log('   Generated Assembly:');
console.log(asm6);
console.log();

// Test 7: Comparison
console.log('7. Comparison: 10 > 5');
const expr7 = {
  type: 'comparison',
  operator: '>',
  left: { type: 'literal', value: 10 },
  right: { type: 'literal', value: 5 }
};
const asm7 = exprCompiler.compile(expr7, context);
console.log('   Generated Assembly:');
console.log(asm7);
console.log();

// Test 8: Logical operation (AND)
console.log('8. Logical Operation: true && false');
const expr8 = {
  type: 'logical-op',
  operator: '&&',
  left: { type: 'literal', value: true },
  right: { type: 'literal', value: false }
};
const asm8 = exprCompiler.compile(expr8, context);
console.log('   Generated Assembly:');
console.log(asm8);
console.log();

// Test 9: Unary operation (negation)
console.log('9. Unary Operation: -42');
const expr9 = {
  type: 'unary-op',
  operator: '-',
  operand: { type: 'literal', value: 42 }
};
const asm9 = exprCompiler.compile(expr9, context);
console.log('   Generated Assembly:');
console.log(asm9);
console.log();

// Test 10: Function call
console.log('10. Function Call: string_len("test")');
const expr10 = {
  type: 'function-call',
  name: 'string_len',
  args: [
    { type: 'literal', value: 'test' }
  ]
};
const asm10 = exprCompiler.compile(expr10, context);
console.log('   Generated Assembly:');
console.log(asm10);
console.log();

// Test 11: Complex expression (nested)
console.log('11. Complex Expression: (10 + 5) * 2');
const expr11 = {
  type: 'binary-op',
  operator: '*',
  left: {
    type: 'binary-op',
    operator: '+',
    left: { type: 'literal', value: 10 },
    right: { type: 'literal', value: 5 }
  },
  right: { type: 'literal', value: 2 }
};
const asm11 = exprCompiler.compile(expr11, context);
console.log('   Generated Assembly:');
console.log(asm11);
console.log();

// Show string literals that were generated
console.log('--- String Literals (.rodata section) ---');
const stringLiterals = exprCompiler.getStringLiterals();
for (const [str, label] of stringLiterals.entries()) {
  console.log(`${label}:`);
  console.log(`    .string "${str}"`);
}

console.log('\n' + '='.repeat(70));
console.log('Expression Compiler Tests Complete!');
console.log('='.repeat(70));
