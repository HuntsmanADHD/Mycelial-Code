#!/usr/bin/env node
/**
 * Test Statement Compiler
 *
 * Tests the statement compiler with various statement types
 * and shows the generated x86-64 assembly code.
 */

const { SymbolTable } = require('./src/compiler/symbol-table.js');
const { ExpressionCompiler } = require('./src/compiler/expression-compiler.js');
const { StatementCompiler } = require('./src/compiler/statement-compiler.js');

console.log('='.repeat(70));
console.log('Testing Statement Compiler');
console.log('='.repeat(70));

// Create a test network with state fields
const testNetwork = {
  name: 'TestNetwork',
  frequencies: {
    input: {
      fields: [
        { name: 'value', type: 'u32' }
      ]
    },
    output: {
      fields: [
        { name: 'result', type: 'u32' }
      ]
    }
  },
  hyphae: {
    counter: {
      name: 'counter',
      state: [
        { name: 'count', type: 'u32' },
        { name: 'total', type: 'u32' }
      ],
      handlers: [],
      rules: []
    }
  },
  spawns: [
    { instanceId: 'C1', hyphalType: 'counter' }
  ],
  sockets: [
    {
      from: { agent: 'input', frequency: 'input' },
      to: { agent: 'C1', frequency: 'input' }
    },
    {
      from: { agent: 'C1', frequency: 'output' },
      to: { agent: 'output', frequency: 'output' }
    }
  ],
  fruitingBodies: ['input', 'output']
};

// Build symbol table
const symbolTable = new SymbolTable(testNetwork);
symbolTable.analyze();

// Create compilers
const exprCompiler = new ExpressionCompiler(symbolTable);
const stmtCompiler = new StatementCompiler(symbolTable, exprCompiler);

console.log('\n--- Test Cases ---\n');

// Test context for C1 agent
const context = {
  agentId: 'C1',
  signalFrequency: 'input',
  signalBinding: 'msg',
  locals: {}
};

// Test 1: Assignment to state field
console.log('1. Assignment: state.count = 42');
const stmt1 = {
  type: 'assignment',
  target: {
    type: 'field-access',
    object: { type: 'variable', name: 'state' },
    field: 'count'
  },
  value: { type: 'literal', value: 42 }
};
const asm1 = stmtCompiler.compile(stmt1, context);
console.log('   Generated Assembly:');
console.log(asm1);
console.log();

// Test 2: Assignment with expression
console.log('2. Assignment: state.count = state.count + 1');
const stmt2 = {
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
};
const asm2 = stmtCompiler.compile(stmt2, context);
console.log('   Generated Assembly:');
console.log(asm2);
console.log();

// Test 3: Emit statement
console.log('3. Emit: emit output { result: 100 }');
const stmt3 = {
  type: 'emit',
  frequency: 'output',
  payload: {
    result: { type: 'literal', value: 100 }
  }
};
const asm3 = stmtCompiler.compile(stmt3, context);
console.log('   Generated Assembly:');
console.log(asm3);
console.log();

// Test 4: If statement (no else)
console.log('4. If: if (state.count > 10) { state.total = 0 }');
const stmt4 = {
  type: 'if',
  condition: {
    type: 'comparison',
    operator: '>',
    left: {
      type: 'field-access',
      object: { type: 'variable', name: 'state' },
      field: 'count'
    },
    right: { type: 'literal', value: 10 }
  },
  then: {
    type: 'assignment',
    target: {
      type: 'field-access',
      object: { type: 'variable', name: 'state' },
      field: 'total'
    },
    value: { type: 'literal', value: 0 }
  },
  else: null
};
const asm4 = stmtCompiler.compile(stmt4, context);
console.log('   Generated Assembly:');
console.log(asm4);
console.log();

// Test 5: If-else statement
console.log('5. If-Else: if (state.count < 5) { ... } else { ... }');
const stmt5 = {
  type: 'if',
  condition: {
    type: 'comparison',
    operator: '<',
    left: {
      type: 'field-access',
      object: { type: 'variable', name: 'state' },
      field: 'count'
    },
    right: { type: 'literal', value: 5 }
  },
  then: {
    type: 'assignment',
    target: {
      type: 'field-access',
      object: { type: 'variable', name: 'state' },
      field: 'total'
    },
    value: { type: 'literal', value: 10 }
  },
  else: {
    type: 'assignment',
    target: {
      type: 'field-access',
      object: { type: 'variable', name: 'state' },
      field: 'total'
    },
    value: { type: 'literal', value: 20 }
  }
};
const asm5 = stmtCompiler.compile(stmt5, context);
console.log('   Generated Assembly:');
console.log(asm5);
console.log();

// Test 6: While loop
console.log('6. While: while (state.count > 0) { state.count = state.count - 1 }');
const stmt6 = {
  type: 'while',
  condition: {
    type: 'comparison',
    operator: '>',
    left: {
      type: 'field-access',
      object: { type: 'variable', name: 'state' },
      field: 'count'
    },
    right: { type: 'literal', value: 0 }
  },
  body: {
    type: 'assignment',
    target: {
      type: 'field-access',
      object: { type: 'variable', name: 'state' },
      field: 'count'
    },
    value: {
      type: 'binary-op',
      operator: '-',
      left: {
        type: 'field-access',
        object: { type: 'variable', name: 'state' },
        field: 'count'
      },
      right: { type: 'literal', value: 1 }
    }
  }
};
const asm6 = stmtCompiler.compile(stmt6, context);
console.log('   Generated Assembly:');
console.log(asm6);
console.log();

// Test 7: Block of statements
console.log('7. Block: { stmt1; stmt2; stmt3; }');
const stmt7 = {
  type: 'block',
  statements: [
    {
      type: 'assignment',
      target: {
        type: 'field-access',
        object: { type: 'variable', name: 'state' },
        field: 'count'
      },
      value: { type: 'literal', value: 0 }
    },
    {
      type: 'assignment',
      target: {
        type: 'field-access',
        object: { type: 'variable', name: 'state' },
        field: 'total'
      },
      value: { type: 'literal', value: 100 }
    }
  ]
};
const asm7 = stmtCompiler.compile(stmt7, context);
console.log('   Generated Assembly:');
console.log(asm7);
console.log();

// Test 8: Report statement
console.log('8. Report: report status: state.count');
const stmt8 = {
  type: 'report',
  key: 'status',
  value: {
    type: 'field-access',
    object: { type: 'variable', name: 'state' },
    field: 'count'
  }
};
const asm8 = stmtCompiler.compile(stmt8, context);
console.log('   Generated Assembly:');
console.log(asm8);
console.log();

console.log('='.repeat(70));
console.log('Statement Compiler Tests Complete!');
console.log('='.repeat(70));
