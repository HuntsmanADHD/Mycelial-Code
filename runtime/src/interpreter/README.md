# Mycelial Interpreter

A complete JavaScript interpreter for the Mycelial language that can directly execute any Mycelial program without needing pre-implemented agents.

## Overview

The Mycelial interpreter enables the M3 bootstrap by providing a runtime that can interpret the 10,700-line `compiler.mycelial` code and produce binaries, enabling the Gen0 → Gen1 → Gen2 self-hosting pipeline.

## Architecture

```
Mycelial Source Code
    ↓
[Parser] → AST (network definition)
    ↓
[Executor] → Agents with State + Signal Queues
    ↓
[Scheduler] → Run tidal cycles (REST → SENSE → ACT)
    ↓
[Signal Router] → Deliver signals between agents
    ↓
Output (binaries, files, reports)
```

## Components

### 1. MycelialParser (`parser.js`)

Parses Mycelial source code into an Abstract Syntax Tree (AST).

**Features:**
- Network definitions with frequencies, hyphae, and topology
- State declarations with default values
- Signal handlers with guards
- Full expression parsing (literals, variables, operators, function calls)
- Statement parsing (let, if, for, while, emit, report)

**Example:**
```javascript
const { MycelialParser } = require('./parser.js');

const parser = new MycelialParser();
const network = parser.parseNetwork(sourceCode);
```

### 2. MycelialExecutor (`executor.js`)

Executes Mycelial programs by creating agents and managing their state.

**Features:**
- Agent creation from hyphal definitions
- State initialization with defaults
- Expression evaluation (arithmetic, logic, field access)
- Statement execution (assignments, control flow, emissions)
- Built-in function library (format, len, vec_push, etc.)
- Signal emission and routing

**Example:**
```javascript
const { MycelialExecutor } = require('./executor.js');

const executor = new MycelialExecutor(network, parser);
executor.initialize();
```

### 3. MycelialScheduler (`scheduler.js`)

Implements the tidal cycle execution model.

**Tidal Cycle:**
1. **REST**: Execute rest handlers (idle phase)
2. **SENSE**: Dequeue one signal per agent
3. **ACT**: Process signals and execute handlers

**Termination:**
- Stops when all signal queues are empty for N consecutive cycles
- Configurable max cycles to prevent infinite loops

**Example:**
```javascript
const { MycelialScheduler } = require('./scheduler.js');

const scheduler = new MycelialScheduler(executor, {
  verbose: false,
  emptyThreshold: 10,
  maxCycles: 1000
});

const stats = scheduler.run();
```

### 4. SignalRouter (`signal-router.js`)

Routes signals between agents based on socket definitions.

**Features:**
- Socket-based routing: `socket A -> B (frequency: ping)`
- Multiple destinations per source
- Fast lookup using routing table

**Example:**
```javascript
const { SignalRouter } = require('./signal-router.js');

const router = new SignalRouter(network.sockets);
const destinations = router.getDestinations('agent1', 'ping');
```

## Usage

### Basic Example

```javascript
const { MycelialParser } = require('./parser.js');
const { MycelialExecutor } = require('./executor.js');
const { MycelialScheduler } = require('./scheduler.js');
const fs = require('fs');

// 1. Read and parse source
const source = fs.readFileSync('program.mycelial', 'utf-8');
const parser = new MycelialParser();
const network = parser.parseNetwork(source);

// 2. Initialize executor
const executor = new MycelialExecutor(network, parser);
executor.initialize();

// 3. Inject initial signals (optional)
executor.signalQueues['agent1'].push({
  frequency: 'start',
  sourceAgentId: 'input',
  payload: { value: 42 },
  timestamp: Date.now()
});

// 4. Run scheduler
const scheduler = new MycelialScheduler(executor);
const stats = scheduler.run();

// 5. Get results
const output = executor.getOutput();
console.log('Results:', output);
```

### Running Tests

```bash
cd runtime/src/interpreter
node test-interpreter.js
```

### Running Demo

```bash
cd runtime/src/interpreter
node demo.js
```

## Supported Features

### Language Constructs

- ✅ Network definitions
- ✅ Frequency declarations
- ✅ Hyphal (agent) definitions
- ✅ State declarations with defaults
- ✅ Signal handlers with guards
- ✅ Topology (spawns, sockets, fruiting bodies)

### Statements

- ✅ `let` - Variable declarations
- ✅ `=` - Assignments (variables and state)
- ✅ `emit` - Signal emission
- ✅ `if/else` - Conditional execution
- ✅ `for` - Iteration over collections
- ✅ `while` - Conditional loops
- ✅ `report` - Reporting values
- ✅ `return` - Return from handlers

### Expressions

- ✅ Literals (numbers, strings, booleans, arrays)
- ✅ Variables
- ✅ Binary operators (`+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `||`)
- ✅ Unary operators (`-`, `!`)
- ✅ Field access (`obj.field`)
- ✅ Array access (`arr[index]`)
- ✅ Function calls

### Built-in Functions

**String:**
- `format(template, args...)` - String formatting with `{}`
- `string_concat(strings...)` - Concatenation
- `len(str)` - String length

**Vector:**
- `vec_push(vec, value)` - Append to vector
- `vec_pop(vec)` - Remove last element
- `vec_len(vec)` - Vector length
- `vec_get(vec, index)` - Get element
- `vec_set(vec, index, value)` - Set element
- `vec_clear(vec)` - Clear vector

**Math:**
- `abs(x)` - Absolute value
- `min(...values)` - Minimum
- `max(...values)` - Maximum
- `pow(base, exp)` - Power

**Type Conversion:**
- `to_string(x)` - Convert to string
- `to_int(x)` - Convert to integer
- `to_float(x)` - Convert to float

**Debug:**
- `print(args...)` - Print to console
- `debug(args...)` - Debug print

## Test Results

```
╔════════════════════════════════════════════╗
║   Tests Passed:  56                         ║
║   Tests Failed:   0                         ║
╚════════════════════════════════════════════╝

🎉 All tests passed!
```

### Test Coverage

- Parser tests (network structure, state, expressions, function calls)
- Executor tests (agent creation, expression evaluation, built-in functions, statements)
- Signal router tests (routing, multiple destinations)
- Scheduler tests (tidal cycles, termination)
- Integration tests (full pipeline, real Mycelial files)

## Files

```
interpreter/
├── parser.js              # MycelialParser - Parses source to AST
├── executor.js            # MycelialExecutor - Executes agents
├── scheduler.js           # MycelialScheduler - Tidal cycle execution
├── signal-router.js       # SignalRouter - Signal routing
├── test-interpreter.js    # Comprehensive test suite
├── demo.js                # Live demonstration
└── README.md              # This file
```

## Future Enhancements

- [ ] More built-in functions (string manipulation, file I/O)
- [ ] Better error messages with source locations
- [ ] Debugger/tracer for step-by-step execution
- [ ] Performance optimizations
- [ ] Memory management for large programs
- [ ] Integration with runtime.js for ELF binary generation

## Bootstrap Path

```
1. node mycelial-compile.js compiler.mycelial
   → Interpreter parses compiler.mycelial
   → Executor runs all compiler agents
   → Scheduler coordinates signal flow
   → Generates Gen0 binary ✅

2. ./gen0 compiler.mycelial
   → Gen0 interprets compiler
   → Generates Gen1 binary ✅

3. ./gen1 compiler.mycelial
   → Gen1 interprets compiler
   → Generates Gen2 binary ✅

4. md5sum gen1 gen2
   → IDENTICAL → FIXED POINT ACHIEVED! 🎉
```
