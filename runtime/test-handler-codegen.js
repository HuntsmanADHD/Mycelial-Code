#!/usr/bin/env node
/**
 * Test Handler Code Generator
 *
 * Tests the handler code generator with real Mycelial handlers
 * and shows the complete generated x86-64 assembly code.
 */

const { MycelialParser } = require('./src/interpreter/parser.js');
const { SymbolTable } = require('./src/compiler/symbol-table.js');
const { ExpressionCompiler } = require('./src/compiler/expression-compiler.js');
const { StatementCompiler } = require('./src/compiler/statement-compiler.js');
const { HandlerCodeGenerator } = require('./src/compiler/handler-codegen.js');
const fs = require('fs');

console.log('='.repeat(70));
console.log('Testing Handler Code Generator with hello_world.mycelial');
console.log('='.repeat(70));

// Load and parse hello_world.mycelial
const sourceCode = fs.readFileSync('../tests/hello_world.mycelial', 'utf8');
console.log('\n--- Source Code ---\n');
console.log(sourceCode);

const parser = new MycelialParser();
const network = parser.parseNetwork(sourceCode);

// Build symbol table
console.log('\n--- Building Symbol Table ---\n');
const symbolTable = new SymbolTable(network);
symbolTable.analyze();

// Create compilers
const exprCompiler = new ExpressionCompiler(symbolTable);
const stmtCompiler = new StatementCompiler(symbolTable, exprCompiler);
const handlerGen = new HandlerCodeGenerator(symbolTable, exprCompiler, stmtCompiler);

console.log('\n--- Generating Handler Code ---\n');

// Generate all handlers for the network
const allHandlers = handlerGen.generateAllNetworkHandlers();

console.log(`Generated ${allHandlers.length} handler(s)\n`);

// Display each generated handler
for (const handler of allHandlers) {
  console.log('='.repeat(70));
  console.log(`Handler: ${handler.label}`);
  console.log('='.repeat(70));
  console.log(handler.code);
  console.log();
}

// Show string literals that were collected
console.log('='.repeat(70));
console.log('String Literals (.rodata section)');
console.log('='.repeat(70));
const stringLiterals = exprCompiler.getStringLiterals();
for (const [str, label] of stringLiterals.entries()) {
  console.log(`${label}:`);
  console.log(`    .asciz "${str}"`);
}

console.log('\n' + '='.repeat(70));
console.log('Handler Code Generation Complete!');
console.log('='.repeat(70));

// Test with a custom handler that has more features
console.log('\n\n');
console.log('='.repeat(70));
console.log('Testing with Custom Handler (with state and guard)');
console.log('='.repeat(70));

const customNetwork = {
  name: 'CustomNetwork',
  frequencies: {
    tick: {
      fields: [{ name: 'value', type: 'u32' }]
    },
    result: {
      fields: [{ name: 'total', type: 'u32' }]
    }
  },
  hyphae: {
    accumulator: {
      name: 'accumulator',
      state: [
        { name: 'sum', type: 'u32' },
        { name: 'count', type: 'u32' }
      ],
      handlers: [
        {
          type: 'signal',
          frequency: 'tick',
          binding: 't',
          guard: {
            type: 'comparison',
            operator: '>',
            left: {
              type: 'field-access',
              object: { type: 'variable', name: 't' },
              field: 'value'
            },
            right: { type: 'literal', value: 0 }
          },
          body: [
            {
              type: 'assignment',
              target: {
                type: 'field-access',
                object: { type: 'variable', name: 'state' },
                field: 'sum'
              },
              value: {
                type: 'binary-op',
                operator: '+',
                left: {
                  type: 'field-access',
                  object: { type: 'variable', name: 'state' },
                  field: 'sum'
                },
                right: {
                  type: 'field-access',
                  object: { type: 'variable', name: 't' },
                  field: 'value'
                }
              }
            },
            {
              type: 'assignment',
              target: {
                type: 'field-access',
                object: { type: 'variable', name: 'state' },
                field: 'count'
              },
              value: {
                type: 'binary-op',
                operator: '+',
                left: {
                  type: 'field-access',
                  object: { type: 'variable', name: 'state' },
                  field: 'count'
                },
                right: { type: 'literal', value: 1 }
              }
            },
            {
              type: 'if',
              condition: {
                type: 'comparison',
                operator: '>=',
                left: {
                  type: 'field-access',
                  object: { type: 'variable', name: 'state' },
                  field: 'count'
                },
                right: { type: 'literal', value: 10 }
              },
              then: {
                type: 'emit',
                frequency: 'result',
                payload: {
                  total: {
                    type: 'field-access',
                    object: { type: 'variable', name: 'state' },
                    field: 'sum'
                  }
                }
              },
              else: null
            }
          ]
        }
      ],
      rules: []
    }
  },
  spawns: [
    { instanceId: 'A1', hyphalType: 'accumulator' }
  ],
  sockets: [],
  fruitingBodies: []
};

const customSymbolTable = new SymbolTable(customNetwork);
customSymbolTable.analyze();

const customExprCompiler = new ExpressionCompiler(customSymbolTable);
const customStmtCompiler = new StatementCompiler(customSymbolTable, customExprCompiler);
const customHandlerGen = new HandlerCodeGenerator(customSymbolTable, customExprCompiler, customStmtCompiler);

const customHandlers = customHandlerGen.generateAllNetworkHandlers();

for (const handler of customHandlers) {
  console.log('\n' + '='.repeat(70));
  console.log(`Handler: ${handler.label}`);
  console.log('='.repeat(70));
  console.log(handler.code);
}

console.log('\n' + '='.repeat(70));
console.log('All Tests Complete!');
console.log('='.repeat(70));
