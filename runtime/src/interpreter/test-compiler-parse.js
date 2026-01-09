/**
 * Test parsing the actual mycelial-compiler.mycelial file
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-07
 */

const { MycelialParser } = require('./parser.js');
const fs = require('fs');
const path = require('path');

console.log('╔════════════════════════════════════════════╗');
console.log('║   Compiler File Parse Test                 ║');
console.log('╚════════════════════════════════════════════╝\n');

const compilerPath = path.join(__dirname, '../../../mycelial-compiler.mycelial');

console.log(`Reading: ${compilerPath}`);

if (!fs.existsSync(compilerPath)) {
  console.error('✗ Compiler file not found');
  process.exit(1);
}

const source = fs.readFileSync(compilerPath, 'utf8');
console.log(`✓ File loaded (${source.length} bytes, ${source.split('\n').length} lines)`);

// Strip import statements (parser doesn't handle imports yet)
const lines = source.split('\n');
const networkStart = lines.findIndex(l => l.trim().startsWith('network '));
if (networkStart === -1) {
  console.error('✗ Network definition not found');
  process.exit(1);
}

console.log(`✓ Network definition starts at line ${networkStart + 1}`);

const networkSource = lines.slice(networkStart).join('\n');

console.log('\nParsing network...');

const parser = new MycelialParser();
let ast;

try {
  ast = parser.parseNetwork(networkSource);
  console.log('✓ Parse successful!\n');
} catch (err) {
  console.error('✗ Parse failed:', err.message);
  console.error('\nError details:');
  const match = err.message.match(/line (\d+), column (\d+)/);
  if (match) {
    const line = parseInt(match[1]);
    const col = parseInt(match[2]);
    const errorLines = networkSource.split('\n').slice(Math.max(0, line - 3), line + 2);
    errorLines.forEach((l, i) => {
      const lineNum = line - 2 + i;
      console.error((lineNum === line ? '>>> ' : '    ') + lineNum + ': ' + l);
    });
  }
  process.exit(1);
}

// Validate parsed structure
console.log('Network Analysis:');
console.log(`  Name: ${ast.name}`);
console.log(`  Frequencies: ${Object.keys(ast.frequencies).length}`);

const freqNames = Object.keys(ast.frequencies);
console.log(`    Sample: ${freqNames.slice(0, 5).join(', ')}${freqNames.length > 5 ? ', ...' : ''}`);

console.log(`  Hyphae: ${Object.keys(ast.hyphae).length}`);
Object.keys(ast.hyphae).forEach(name => {
  const hyphal = ast.hyphae[name];
  console.log(`    ${name}:`);
  console.log(`      State fields: ${hyphal.state.length}`);
  console.log(`      Handlers: ${hyphal.handlers.length}`);
  console.log(`      Rules: ${hyphal.rules.length}`);
});

console.log(`  Spawns: ${ast.spawns.length}`);
console.log(`  Sockets: ${ast.sockets.length}`);
console.log(`  Fruiting Bodies: ${ast.fruitingBodies.length}`);

// Verify specific features that were fixed
console.log('\nVerifying Fixed Features:');

let issues = 0;

// Check for report statements with struct literals
let foundReportStructLiteral = false;
Object.values(ast.hyphae).forEach(hyphal => {
  hyphal.handlers.forEach(handler => {
    if (handler.body) {
      handler.body.forEach(stmt => {
        if (stmt.type === 'report' && stmt.value && stmt.value.type === 'struct-literal') {
          foundReportStructLiteral = true;
        }
      });
    }
  });
});

if (foundReportStructLiteral) {
  console.log('  ✓ Report with struct literal parsed');
} else {
  console.log('  ✗ No report with struct literal found (expected in compiler.mycelial)');
  issues++;
}

// Check for return statements
let foundReturn = false;
Object.values(ast.hyphae).forEach(hyphal => {
  hyphal.handlers.forEach(handler => {
    if (handler.body) {
      handler.body.forEach(stmt => {
        if (stmt.type === 'return') {
          foundReturn = true;
        }
      });
    }
  });
});

if (foundReturn) {
  console.log('  ✓ Return statements parsed');
} else {
  console.log('  ⚠ No return statements found');
}

// Check for function calls in assignments
let foundFunctionCallAssignment = false;
Object.values(ast.hyphae).forEach(hyphal => {
  hyphal.handlers.forEach(handler => {
    if (handler.body) {
      handler.body.forEach(stmt => {
        if (stmt.type === 'assignment' &&
            stmt.value && stmt.value.type === 'function-call') {
          foundFunctionCallAssignment = true;
        }
      });
    }
  });
});

if (foundFunctionCallAssignment) {
  console.log('  ✓ Function calls in assignments parsed');
} else {
  console.log('  ✗ No function call assignments found (expected in compiler.mycelial)');
  issues++;
}

// Check for if expressions
let foundIfExpression = false;
function checkForIfExpression(node) {
  if (!node || typeof node !== 'object') return;

  if (node.type === 'if-expression') {
    foundIfExpression = true;
    return;
  }

  Object.values(node).forEach(val => {
    if (Array.isArray(val)) {
      val.forEach(checkForIfExpression);
    } else if (typeof val === 'object') {
      checkForIfExpression(val);
    }
  });
}

checkForIfExpression(ast);

if (foundIfExpression) {
  console.log('  ✓ If expressions parsed');
} else {
  console.log('  ⚠ No if expressions found');
}

console.log('\n╔════════════════════════════════════════════╗');
if (issues === 0) {
  console.log('║   Status: ALL CHECKS PASSED ✓              ║');
  console.log('╚════════════════════════════════════════════╝\n');
  process.exit(0);
} else {
  console.log(`║   Status: ${issues} ISSUES FOUND                   ║`);
  console.log('╚════════════════════════════════════════════╝\n');
  process.exit(1);
}
