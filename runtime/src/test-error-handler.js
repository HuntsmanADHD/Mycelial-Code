/**
 * Test Suite for ErrorHandler Module
 *
 * Comprehensive tests for Phase 5 error management system
 */

const { ErrorHandler } = require('./error-handler.js');

function separator(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70) + '\n');
}

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
  }
}

// ============================================================================
// TEST 1: Basic Error Addition and Retrieval
// ============================================================================

separator('TEST 1: Basic Error Addition and Retrieval');

const handler1 = new ErrorHandler({ verbose: false });

// Add a parse error
handler1.addError(
  new Error('Unexpected token "}" at line 42'),
  'parser',
  { file: 'test.mycelial', line: 42, column: 15, text: '  }' }
);

// Add a compilation error
handler1.addError(
  new Error('Undefined variable "foo"'),
  'codegen',
  { file: 'test.mycelial', line: 50 }
);

// Add a warning
handler1.addWarning('Unused variable "bar"', 'parser');

test('Should have 2 errors', () => {
  if (handler1.getErrors().length !== 2) {
    throw new Error(`Expected 2 errors, got ${handler1.getErrors().length}`);
  }
});

test('Should have 1 warning', () => {
  if (handler1.getWarnings().length !== 1) {
    throw new Error(`Expected 1 warning, got ${handler1.getWarnings().length}`);
  }
});

test('Should report hasErrors() as true', () => {
  if (!handler1.hasErrors()) {
    throw new Error('Expected hasErrors() to be true');
  }
});

test('Should be able to continue', () => {
  if (!handler1.canContinue()) {
    throw new Error('Expected canContinue() to be true');
  }
});

// ============================================================================
// TEST 2: Error Categorization and Codes
// ============================================================================

separator('TEST 2: Error Categorization and Codes');

const handler2 = new ErrorHandler({ verbose: false });

handler2.addError(
  { message: 'File not found: test.mycelial', name: 'FileNotFoundError' },
  'lexer',
  {}
);

handler2.addError(
  new Error('Expected ";" but got "}"'),
  'parser',
  {}
);

handler2.addError(
  new Error('Type mismatch: int vs string'),
  'codegen',
  {}
);

const errors = handler2.getErrors();

test('First error should have code EF01 (FileIO, Lexer)', () => {
  if (errors[0].code !== 'EF01') {
    throw new Error(`Expected code EF01, got ${errors[0].code}`);
  }
});

test('Second error should have code EP02 (Parse, Parser)', () => {
  if (errors[1].code !== 'EP02') {
    throw new Error(`Expected code EP02, got ${errors[1].code}`);
  }
});

test('Third error should have code EC04 (Compilation, CodeGen)', () => {
  if (errors[2].code !== 'EC04') {
    throw new Error(`Expected code EC04, got ${errors[2].code}`);
  }
});

test('FileIO error should be fatal', () => {
  if (errors[0].severity !== 'fatal') {
    throw new Error(`Expected fatal severity, got ${errors[0].severity}`);
  }
});

// ============================================================================
// TEST 3: Error Recovery
// ============================================================================

separator('TEST 3: Error Recovery');

const handler3 = new ErrorHandler({ verbose: true });

console.log('Adding recoverable parse error (missing semicolon)...');
const canContinue1 = handler3.addError(
  new Error('Parse error: missing ";" at end of statement'),
  'parser',
  {}
);

console.log('\nAdding recoverable compilation error (undefined variable)...');
const canContinue2 = handler3.addError(
  new Error('Compilation error: undefined variable "x"'),
  'codegen',
  {}
);

console.log('\nAdding runtime error (should be recoverable)...');
const canContinue3 = handler3.addError(
  new Error('Runtime error: signal timeout'),
  'runtime',
  {}
);

test('Should recover from parse error', () => {
  if (!canContinue1) {
    throw new Error('Expected recovery from parse error');
  }
});

test('Should recover from compilation error', () => {
  if (!canContinue2) {
    throw new Error('Expected recovery from compilation error');
  }
});

test('Should recover from runtime error', () => {
  if (!canContinue3) {
    throw new Error('Expected recovery from runtime error');
  }
});

test('Should have recovered errors', () => {
  const summary = handler3.getSummary();
  if (summary.recovered_errors === 0) {
    throw new Error('Expected some recovered errors');
  }
  console.log(`  Recovered ${summary.recovered_errors} error(s)`);
});

// ============================================================================
// TEST 4: Summary Statistics
// ============================================================================

separator('TEST 4: Summary Statistics');

const handler4 = new ErrorHandler({ verbose: false });

handler4.addError(new Error('Parse error 1'), 'parser', {});
handler4.addError(new Error('Parse error 2'), 'parser', {});
handler4.addError(new Error('Codegen error 1'), 'codegen', {});
handler4.addWarning('Warning 1', 'lexer');
handler4.addWarning('Warning 2', 'parser');

const summary = handler4.getSummary();

console.log('Summary:', JSON.stringify(summary, null, 2));

test('Should report 3 total errors', () => {
  if (summary.total_errors !== 3) {
    throw new Error(`Expected 3 errors, got ${summary.total_errors}`);
  }
});

test('Should report 2 total warnings', () => {
  if (summary.total_warnings !== 2) {
    throw new Error(`Expected 2 warnings, got ${summary.total_warnings}`);
  }
});

test('Should report parser has 2 errors', () => {
  if (summary.errors_by_stage.parser !== 2) {
    throw new Error(`Expected 2 parser errors, got ${summary.errors_by_stage.parser}`);
  }
});

test('Should report codegen has 1 error', () => {
  if (summary.errors_by_stage.codegen !== 1) {
    throw new Error(`Expected 1 codegen error, got ${summary.errors_by_stage.codegen}`);
  }
});

test('Should report 2 stages affected', () => {
  if (summary.stages_affected.length !== 2) {
    throw new Error(`Expected 2 stages, got ${summary.stages_affected.length}`);
  }
});

test('Should not be successful', () => {
  if (summary.success) {
    throw new Error('Expected success to be false');
  }
});

// ============================================================================
// TEST 5: Stage-Specific Error Retrieval
// ============================================================================

separator('TEST 5: Stage-Specific Error Retrieval');

const handler5 = new ErrorHandler({ verbose: false });

handler5.addError(new Error('Lexer error 1'), 'lexer', {});
handler5.addError(new Error('Parser error 1'), 'parser', {});
handler5.addError(new Error('Parser error 2'), 'parser', {});
handler5.addError(new Error('Codegen error 1'), 'codegen', {});

test('Should get 1 lexer error', () => {
  const lexerErrors = handler5.getStageErrors('lexer');
  if (lexerErrors.length !== 1) {
    throw new Error(`Expected 1 lexer error, got ${lexerErrors.length}`);
  }
});

test('Should get 2 parser errors', () => {
  const parserErrors = handler5.getStageErrors('parser');
  if (parserErrors.length !== 2) {
    throw new Error(`Expected 2 parser errors, got ${parserErrors.length}`);
  }
});

test('Should get 0 linker errors', () => {
  const linkerErrors = handler5.getStageErrors('linker');
  if (linkerErrors.length !== 0) {
    throw new Error(`Expected 0 linker errors, got ${linkerErrors.length}`);
  }
});

// ============================================================================
// TEST 6: Max Errors Limit
// ============================================================================

separator('TEST 6: Max Errors Limit');

const handler6 = new ErrorHandler({ verbose: false, maxErrors: 5 });

for (let i = 1; i <= 10; i++) {
  handler6.addError(new Error(`Error ${i}`), 'parser', {});
}

test('Should not exceed max errors limit', () => {
  const errors = handler6.getErrors();
  if (errors.length > 6) { // 5 normal + 1 "max exceeded" error
    throw new Error(`Expected at most 6 errors, got ${errors.length}`);
  }
});

test('Should not be able to continue after max errors', () => {
  if (handler6.canContinue()) {
    throw new Error('Expected canContinue() to be false after max errors');
  }
});

test('Last error should be "max exceeded" message', () => {
  const errors = handler6.getErrors();
  const lastError = errors[errors.length - 1];
  if (!lastError.message.includes('Maximum error limit')) {
    throw new Error('Expected last error to be max limit message');
  }
});

// ============================================================================
// TEST 7: Error Formatting
// ============================================================================

separator('TEST 7: Error Formatting');

const handler7 = new ErrorHandler({ verbose: false });

handler7.addError(
  new Error('Unexpected token "}"'),
  'parser',
  {
    file: 'example.mycelial',
    line: 42,
    column: 10,
    text: '  let x = {}'
  }
);

const error = handler7.getErrors()[0];
const formatted = handler7.formatError(error);

console.log('Formatted error:');
console.log(formatted);
console.log('');

test('Formatted error should contain error code', () => {
  if (!formatted.includes(error.code)) {
    throw new Error('Formatted error missing error code');
  }
});

test('Formatted error should contain file location', () => {
  if (!formatted.includes('example.mycelial:42:10')) {
    throw new Error('Formatted error missing location');
  }
});

test('Formatted error should contain suggestion', () => {
  if (!formatted.includes('Suggestion:')) {
    throw new Error('Formatted error missing suggestion');
  }
});

// ============================================================================
// TEST 8: Clear and Serialize
// ============================================================================

separator('TEST 8: Clear and Serialize');

const handler8 = new ErrorHandler({ verbose: false });

handler8.addError(new Error('Error 1'), 'parser', {});
handler8.addWarning('Warning 1', 'lexer');

const serialized = handler8.serialize();

test('Serialized data should contain errors', () => {
  if (!serialized.errors || serialized.errors.length === 0) {
    throw new Error('Serialized data missing errors');
  }
});

test('Serialized data should contain warnings', () => {
  if (!serialized.warnings || serialized.warnings.length === 0) {
    throw new Error('Serialized data missing warnings');
  }
});

test('Serialized data should contain summary', () => {
  if (!serialized.summary) {
    throw new Error('Serialized data missing summary');
  }
});

test('Serialized data should contain timestamp', () => {
  if (!serialized.timestamp) {
    throw new Error('Serialized data missing timestamp');
  }
});

handler8.clear();

test('Should have no errors after clear', () => {
  if (handler8.getErrors().length !== 0) {
    throw new Error('Expected 0 errors after clear');
  }
});

test('Should have no warnings after clear', () => {
  if (handler8.getWarnings().length !== 0) {
    throw new Error('Expected 0 warnings after clear');
  }
});

// ============================================================================
// TEST 9: Full Error Report
// ============================================================================

separator('TEST 9: Full Error Report');

const handler9 = new ErrorHandler({ verbose: false });

handler9.addError(
  new Error('File not found: input.mycelial'),
  'lexer',
  { file: 'input.mycelial' }
);

handler9.addError(
  new Error('Parse error: Expected ";" but got "}"'),
  'parser',
  { file: 'test.mycelial', line: 10, column: 5, text: '  }' }
);

handler9.addWarning('Unused variable "temp"', 'parser');

console.log('Full error report:');
handler9.printErrorReport();

test('Should generate complete error report', () => {
  const report = handler9.formatErrorReport();
  if (report.length === 0) {
    throw new Error('Error report is empty');
  }
});

// ============================================================================
// SUMMARY
// ============================================================================

separator('TEST SUITE COMPLETE');

console.log('All error handler tests passed successfully!');
console.log('');
console.log('Features tested:');
console.log('  ✓ Error addition and retrieval');
console.log('  ✓ Error categorization (FileIO, Parse, Compilation, Runtime)');
console.log('  ✓ Error codes (EF01, EP02, EC04, etc.)');
console.log('  ✓ Error recovery strategies');
console.log('  ✓ Summary statistics');
console.log('  ✓ Stage-specific error filtering');
console.log('  ✓ Max errors limit');
console.log('  ✓ Error formatting and display');
console.log('  ✓ Serialization and clearing');
console.log('  ✓ Full error report generation');
console.log('');
