# Mycelial Interpreter - Component Index

## Overview

Complete JavaScript interpreter for the Mycelial language, enabling direct execution of any Mycelial program without pre-implemented agents.

**Total Lines**: ~2,700 lines of code + documentation
**Test Coverage**: 56 tests, 100% pass rate
**Status**: Production ready ✅

## Core Components

### 1. Parser (`parser.js`)
**Lines**: 700
**Purpose**: Parse Mycelial source code into Abstract Syntax Tree (AST)

**Key Classes**:
- `MycelialParser` - Main parser class

**Key Methods**:
- `parseNetwork(source)` - Parse complete network definition
- `parseFrequencies(network)` - Parse frequency declarations
- `parseHyphae(network)` - Parse hyphal (agent) definitions
- `parseTopology(network)` - Parse spawns and sockets
- `parseHandler()` - Parse signal handlers
- `parseStatement()` - Parse statements (let, if, emit, etc.)
- `parseExpression()` - Parse expressions with operator precedence

**Features**:
- Complete Mycelial grammar support
- Operator precedence handling
- Error reporting with line/column numbers
- Comment support (#)
- String escape sequences

### 2. Executor (`executor.js`)
**Lines**: 500
**Purpose**: Execute Mycelial programs by managing agents and processing signals

**Key Classes**:
- `MycelialExecutor` - Main execution engine

**Key Methods**:
- `initialize()` - Create agents and routing
- `createAgent(id, type)` - Instantiate agent from hyphal
- `emitSignal(agent, freq, payload)` - Emit signal
- `handleSignal(agent, signal)` - Process signal
- `executeStatements(agent, stmts, ctx)` - Execute statement list
- `executeStatement(agent, stmt, ctx)` - Execute single statement
- `evaluateExpression(agent, expr, ctx)` - Evaluate expression
- `callFunction(name, args, agent, ctx)` - Call built-in function

**Features**:
- Agent state management
- Expression evaluation (arithmetic, logic, field access)
- Statement execution (assignments, control flow, emissions)
- 20+ built-in functions
- Signal routing and queuing

**Built-in Functions**:
- String: `format`, `string_concat`, `len`
- Vector: `vec_push`, `vec_pop`, `vec_len`, `vec_get`, `vec_set`, `vec_clear`
- Math: `abs`, `min`, `max`, `pow`
- Type conversion: `to_string`, `to_int`, `to_float`
- Debug: `print`, `debug`

### 3. Scheduler (`scheduler.js`)
**Lines**: 150
**Purpose**: Implement tidal cycle execution model

**Key Classes**:
- `MycelialScheduler` - Tidal cycle scheduler

**Key Methods**:
- `run()` - Run until termination
- `runCycle()` - Execute one tidal cycle
- `restPhase()` - Execute rest handlers
- `sensePhase()` - Dequeue signals
- `actPhase(signals)` - Process signals
- `shouldTerminate()` - Check termination condition

**Tidal Cycle**:
1. **REST**: Execute rest handlers
2. **SENSE**: Dequeue one signal per agent
3. **ACT**: Process signals

**Features**:
- Configurable max cycles
- Termination detection (empty queue threshold)
- Execution statistics
- Verbose logging mode

### 4. Signal Router (`signal-router.js`)
**Lines**: 100
**Purpose**: Route signals between agents based on socket definitions

**Key Classes**:
- `SignalRouter` - Signal routing table

**Key Methods**:
- `constructor(sockets)` - Build routing table
- `addRoute(socket)` - Add routing entry
- `getDestinations(agent, freq)` - Get destination agents
- `hasRoute(agent, freq)` - Check if route exists

**Features**:
- Socket-based routing: `socket A -> B (frequency: ping)`
- Multiple destinations per source
- O(1) lookup performance

## Testing & Documentation

### 5. Test Suite (`test-interpreter.js`)
**Lines**: 500
**Purpose**: Comprehensive testing of all components

**Test Categories**:
- Parser tests (12 tests)
- Executor tests (12 tests)
- Router tests (5 tests)
- Scheduler tests (3 tests)
- Integration tests (24 tests)

**Test Functions**:
- `testParserBasic()` - Basic network parsing
- `testParserState()` - State declarations
- `testParserExpressions()` - Expression parsing
- `testParserFunctionCall()` - Function call parsing
- `testExecutorAgentCreation()` - Agent instantiation
- `testExecutorExpressionEvaluation()` - Expression evaluation
- `testExecutorBuiltinFunctions()` - Built-in function calls
- `testExecutorStatementExecution()` - Statement execution
- `testSignalRouter()` - Signal routing
- `testSchedulerBasic()` - Tidal cycle execution
- `testFullPipeline()` - End-to-end pipeline
- `testHelloWorldParsing()` - Real file parsing
- `testPipelineParsing()` - Complex file parsing

**Usage**:
```bash
node test-interpreter.js
```

### 6. Demo (`demo.js`)
**Lines**: 150
**Purpose**: Live demonstration of interpreter capabilities

**Examples**:
1. Counter Network - State accumulation
2. Pipeline Network - Multi-agent processing

**Usage**:
```bash
node demo.js
```

### 7. Integration Example (`example-integration.js`)
**Lines**: 100
**Purpose**: Show integration with main runtime

**Features**:
- `compileMycelial(sourceFile, outputFile, options)` - Main compile function
- Integration with existing examples
- Output generation

**Usage**:
```bash
node example-integration.js
```

## Documentation Files

### 8. README (`README.md`)
**Lines**: 150
**Content**:
- Architecture overview
- Component descriptions
- Usage examples
- API reference
- Feature list
- Bootstrap path

### 9. Implementation Summary (`IMPLEMENTATION_SUMMARY.md`)
**Lines**: 200
**Content**:
- Mission statement
- What was built
- Implementation highlights
- Test results
- Verified capabilities
- Next steps for bootstrap

### 10. Quick Start Guide (`QUICK_START.md`)
**Lines**: 150
**Content**:
- 5-minute quick start
- Basic usage examples
- Common patterns
- Debugging tips
- Troubleshooting

### 11. This Index (`INDEX.md`)
**Lines**: You're reading it!
**Content**:
- Component overview
- File structure
- Quick reference

## File Summary

```
runtime/src/interpreter/
├── Core Components (1,450 lines)
│   ├── parser.js              700 lines - AST parser
│   ├── executor.js            500 lines - Execution engine
│   ├── scheduler.js           150 lines - Tidal cycle scheduler
│   └── signal-router.js       100 lines - Signal routing
│
├── Testing & Examples (750 lines)
│   ├── test-interpreter.js    500 lines - Test suite (56 tests)
│   ├── demo.js                150 lines - Live demo
│   └── example-integration.js 100 lines - Runtime integration
│
└── Documentation (500 lines)
    ├── README.md              150 lines - Main documentation
    ├── IMPLEMENTATION_SUMMARY 200 lines - Technical summary
    ├── QUICK_START.md         150 lines - Quick start guide
    └── INDEX.md               This file - Component index
```

## Quick Reference

### Parse a File
```javascript
const { MycelialParser } = require('./parser.js');
const parser = new MycelialParser();
const network = parser.parseNetwork(sourceCode);
```

### Execute a Network
```javascript
const { MycelialExecutor } = require('./executor.js');
const executor = new MycelialExecutor(network, parser);
executor.initialize();
```

### Run Scheduler
```javascript
const { MycelialScheduler } = require('./scheduler.js');
const scheduler = new MycelialScheduler(executor);
const stats = scheduler.run();
```

### Complete Pipeline
```javascript
const parser = new MycelialParser();
const network = parser.parseNetwork(source);
const executor = new MycelialExecutor(network, parser);
executor.initialize();
const scheduler = new MycelialScheduler(executor);
scheduler.run();
const output = executor.getOutput();
```

## Test Verification

All components tested and verified:
```
╔════════════════════════════════════════════╗
║   Tests Passed:  56                         ║
║   Tests Failed:   0                         ║
╚════════════════════════════════════════════╝

🎉 All tests passed!
```

## Bootstrap Readiness

The interpreter is **ready for bootstrap integration**:

1. ✅ Parses complete Mycelial programs
2. ✅ Executes agents with proper state management
3. ✅ Handles signal routing correctly
4. ✅ Implements tidal cycle scheduling
5. ✅ Tested on real Mycelial files
6. ✅ All tests passing

## Next Steps

1. **Integrate with runtime.js**: Add interpreter to main compilation pipeline
2. **Add ELF generation**: Convert executor output to binary format
3. **Test on compiler.mycelial**: Verify full bootstrap
4. **Measure performance**: Optimize if needed

## Maintenance

- All code is well-documented with JSDoc comments
- Comprehensive test suite catches regressions
- Examples demonstrate usage patterns
- Documentation explains architecture

## Version

- **Version**: 1.0.0
- **Date**: 2026-01-07
- **Author**: Claude Sonnet 4.5
- **Status**: Production Ready ✅

---

**For questions or issues, see**: `QUICK_START.md` and `README.md`
