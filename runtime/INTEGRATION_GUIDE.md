# ErrorHandler Integration Guide

## Quick Start

### 1. Installation
```javascript
const { ErrorHandler } = require('./src/error-handler.js');
```

### 2. Basic Setup
```javascript
const errorHandler = new ErrorHandler({
  verbose: true,      // Enable recovery logging
  maxErrors: 100      // Stop after 100 errors
});
```

### 3. Add Errors
```javascript
// Simple error
errorHandler.addError(
  new Error('Parse error'),
  'parser',
  {}
);

// Error with context
errorHandler.addError(
  new Error('Unexpected token'),
  'parser',
  {
    file: 'program.mycelial',
    line: 42,
    column: 10,
    text: '  let x = {}'
  }
);
```

### 4. Check Status
```javascript
if (errorHandler.hasErrors()) {
  errorHandler.printErrorReport();
}

if (!errorHandler.canContinue()) {
  console.error('Fatal errors detected');
  process.exit(1);
}
```

## Integration with Runtime

### Option 1: Runtime Property
```javascript
class Runtime {
  constructor(options) {
    this.errorHandler = new ErrorHandler({
      verbose: options.verbose,
      maxErrors: options.maxErrors || 100
    });
  }

  async compile() {
    try {
      const result = await this.runPipeline();
      return {
        success: !this.errorHandler.hasErrors(),
        ...result,
        errors: this.errorHandler.getSummary()
      };
    } catch (error) {
      this.errorHandler.addError(error, 'runtime', {});
      throw error;
    }
  }
}
```

### Option 2: Pass Through Stages
```javascript
async function compilePipeline(source, errorHandler) {
  // Stage 1
  const tokens = lex(source, errorHandler);
  if (!errorHandler.canContinue()) return null;

  // Stage 2
  const ast = parse(tokens, errorHandler);
  if (!errorHandler.canContinue()) return null;

  // Stage 3
  return generate(ast, errorHandler);
}
```

## Error Handling Patterns

### Pattern 1: Try-Catch with Error Handler
```javascript
try {
  const result = riskyOperation();
} catch (error) {
  const canContinue = errorHandler.addError(error, 'stage', context);
  if (!canContinue) {
    throw error; // Fatal, propagate
  }
  // Continue with default value
  result = getDefaultValue();
}
```

### Pattern 2: Validation with Error Handler
```javascript
function validateInput(input, errorHandler) {
  if (!input) {
    errorHandler.addError(
      new Error('Input is required'),
      'validation',
      { input }
    );
    return false;
  }
  return true;
}
```

### Pattern 3: Multi-Stage Compilation
```javascript
async function compile(source) {
  const errors = new ErrorHandler({ verbose: true });

  // Stage 1
  const tokens = await lexer(source, errors);
  if (!errors.canContinue()) return handleFailure(errors);

  // Stage 2
  const ast = await parser(tokens, errors);
  if (!errors.canContinue()) return handleFailure(errors);

  // Stage 3
  const binary = await codegen(ast, errors);

  return {
    success: !errors.hasErrors(),
    binary,
    summary: errors.getSummary()
  };
}
```

## Best Practices

1. **Always provide context**
   - Include file, line, column when available
   - Add relevant source text
   - Provide helpful metadata

2. **Check continuation after each stage**
   - Use `canContinue()` between stages
   - Stop early on fatal errors
   - Avoid cascading errors

3. **Use appropriate stages**
   - lexer: Tokenization errors
   - parser: Syntax errors
   - ir: Intermediate representation errors
   - codegen: Code generation errors
   - assembler: Assembly errors
   - linker: Linking errors
   - runtime: Runtime errors

4. **Leverage recovery**
   - Let ErrorHandler attempt recovery
   - Check return value of `addError()`
   - Continue with defaults when safe

5. **Report comprehensively**
   - Use `printErrorReport()` for users
   - Use `serialize()` for logging
   - Use `getSummary()` for statistics

## API Reference

### Constructor
```javascript
new ErrorHandler(options)
```
- `options.verbose`: boolean - Enable recovery logging
- `options.maxErrors`: number - Maximum errors before stopping

### Methods

**Error Management:**
- `addError(error, stage, context)` → boolean
- `addWarning(warning, stage)`
- `hasErrors()` → boolean
- `canContinue()` → boolean
- `getErrors()` → Array
- `getWarnings()` → Array
- `getStageErrors(stage)` → Array

**Reporting:**
- `getSummary()` → Object
- `formatError(error)` → string
- `formatErrorReport()` → string
- `printErrorReport()`

**Utilities:**
- `clear()`
- `serialize()` → Object

## Examples

See the following files for complete examples:
- `src/test-error-handler.js` - Unit tests
- `src/example-error-handler-integration.js` - Integration examples
- `verify-error-handler.js` - Feature verification
