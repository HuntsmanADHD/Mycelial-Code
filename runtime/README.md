# Mycelial Runtime - Phase 1

Foundational components for the Mycelial runtime system.

## Overview

This implementation provides the core building blocks for executing Mycelial agent networks:

1. **Orchestration Parser** (`src/orchestration-parser.js`) - Parses `.mycelial` network definition files
2. **Agent Executor** (`src/agent-executor.js`) - Executes individual agent state machines

## Architecture

### OrchestrationParser

Parses Mycelial network definitions and extracts:

- **Frequency definitions** - Signal type names and field structures
- **Type definitions** - Enums and structs
- **Hyphal definitions** - Agent types with state and rules
- **Topology** - Spawns, sockets, and fruiting bodies

**Key Methods:**
- `parse(source)` - Parse a network definition file
- `extractFrequencies()` - Extract signal frequency definitions
- `extractTypes()` - Extract enum and struct type definitions
- `extractHyphae()` - Extract agent (hyphal) definitions
- `extractTopology()` - Extract network topology

**Implementation Notes:**
- Uses simplified regex/string parsing (not full AST)
- Handles nested brace structures with balanced brace matching
- Supports multiple `hyphae` blocks in a single file
- Extracts rules: `on rest`, `on cycle`, `on signal`, and standalone `rule` definitions

### AgentInstance

Executes individual agent state machines with full rule support.

**Key Methods:**
- `initialize(typeDefinitions)` - Initialize agent state with type-based defaults
- `processSignal(signal)` - Process incoming signal and execute matching rules
- `executeCycle()` - Execute periodic cycle rules
- `emit(frequency, payload)` - Queue outgoing signal
- `getState()` - Get current state snapshot

**Supported Operations:**

*Variable Management:*
- `let x = value` - Local variable declaration
- `state.field = value` - State field assignment

*String Operations:*
- `string_concat(s1, s2)` - Concatenate strings
- `string_len(s)` - Get string length
- `string_char_at(s, i)` - Get character at index
- `format(template, ...args)` - Format string with arguments

*Vector Operations:*
- `vec_new()` - Create new vector
- `vec_push(vec, item)` - Push item to vector
- `vec_len(vec)` - Get vector length
- `vec_get(vec, i)` - Get item at index

*Map Operations:*
- `map_new()` - Create new map
- `map_insert(map, key, value)` - Insert key-value pair
- `map_get(map, key)` - Get value by key
- `map_contains(map, key)` - Check if key exists
- `map_get_or_default(map, key, default)` - Get value or default

*Signal Emission:*
```mycelial
emit frequency_name {
  field1: value1,
  field2: value2
}
```

*Arithmetic:*
- Basic operations: `+`, `-`, `*`, `/`
- Supports state and context variable references

## Usage

### Parsing a Network Definition

```javascript
const { OrchestrationParser } = require('./src/orchestration-parser');
const fs = require('fs');

const source = fs.readFileSync('mycelial-compiler.mycelial', 'utf8');
const parser = new OrchestrationParser();
const network = parser.parse(source);

console.log('Network:', network.networkName);
console.log('Frequencies:', Object.keys(network.frequencies));
console.log('Agents:', Object.keys(network.hyphae));
```

### Creating and Running an Agent

```javascript
const { AgentInstance } = require('./src/agent-executor');

// Define agent
const counterDef = {
  state: {
    count: 'u32'
  },
  rules: [
    {
      type: 'on_rest',
      body: 'state.count = 0'
    },
    {
      type: 'on_signal',
      trigger: 'increment',
      paramName: 'sig',
      body: `
        state.count = state.count + 1
        emit count_updated {
          count: state.count
        }
      `
    }
  ]
};

// Create and initialize
const agent = new AgentInstance('counter', 'C1', counterDef);
agent.initialize();

// Process signals
const emitted = agent.processSignal({
  frequency: 'increment',
  payload: {}
});

console.log('Count:', agent.state.count);
console.log('Emitted:', emitted);
```

## Running Tests

```bash
npm test
```

The test suite demonstrates:
1. Parsing the full Mycelial compiler network definition
2. Creating and executing a lexer agent
3. Creating and executing a simple counter agent

## Test Results

```
Network Name: mycelial_compiler
Frequencies: 30
Types:
  Enums: 2
  Structs: 1
Hyphae: 3
  Agents: [ 'lexer', 'orchestrator', 'main' ]
Topology:
  Fruiting Bodies: [ 'input', 'output' ]
  Spawns: 8
  Sockets: 47

Counter test results:
  Signal 1: count = 1, emitted: count_updated
  Signal 2: count = 2, emitted: count_updated
  Signal 3: count = 3, emitted: count_updated
```

## Implementation Details

### Parser Design

The parser uses a balanced brace matching algorithm to handle nested structures:

1. Locate section start (e.g., `frequencies {`)
2. Extract balanced block content
3. Parse individual definitions within the block
4. Track brace depth for nested structures

This approach handles complex nested structures without requiring a full AST parser.

### Executor Design

The executor uses a simple statement-based execution model:

1. Parse rule body into statements
2. Identify statement types (assignment, emit, function call, etc.)
3. Execute statements sequentially
4. Track state changes and emitted signals

Expression evaluation supports:
- Literals (strings, numbers, booleans)
- Variable references (state fields, context variables)
- Field access (e.g., `req.field_name`)
- Function calls (built-in functions)
- Arithmetic operations

### Type System

Default values for Mycelial types:

| Type | Default Value |
|------|---------------|
| u8, u16, u32, u64, i8, i16, i32, i64 | 0 |
| f32, f64 | 0.0 |
| boolean | false |
| string | "" |
| binary | Uint8Array(0) |
| vec<T> | [] |
| queue<T> | [] |
| map<K,V> | Map() |

## Phase 1 Completion

This implementation completes Phase 1 of the Mycelial runtime architecture:

- [x] Orchestration parser (~450 lines)
- [x] Agent executor (~580 lines)
- [x] Rule extraction and parsing
- [x] State management
- [x] Signal processing
- [x] Basic built-in functions
- [x] Test suite

**Total:** ~1,100 lines of production-quality JavaScript

## Next Steps (Phase 2+)

Phase 2 will add:
- Network topology execution
- Agent spawning and lifecycle management
- Signal routing between agents
- Fruiting body (external interface) support

Phase 3 will add:
- Full built-in function library
- File I/O operations
- Advanced data structures
- Performance optimizations

## Author

Claude Opus 4.5

## Date

2026-01-01
