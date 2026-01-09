# Mycelial Interpreter - Quick Start Guide

## Installation

The interpreter is ready to use - no installation needed. All files are in:
```
/home/lewey/Desktop/mycelial-code/runtime/src/interpreter/
```

## 5-Minute Quick Start

### 1. Run Tests

Verify everything works:
```bash
cd /home/lewey/Desktop/mycelial-code/runtime/src/interpreter
node test-interpreter.js
```

Expected output:
```
╔════════════════════════════════════════════╗
║   Tests Passed:  56                         ║
║   Tests Failed:   0                         ║
╚════════════════════════════════════════════╝

🎉 All tests passed!
```

### 2. Run Demo

See the interpreter in action:
```bash
node demo.js
```

This runs two example networks and shows the complete execution flow.

### 3. Run Integration Example

Execute a real Mycelial file:
```bash
node example-integration.js
```

This compiles and runs `hello_world.mycelial` from the examples directory.

## Basic Usage

### Parse a Mycelial File

```javascript
const { MycelialParser } = require('./parser.js');
const fs = require('fs');

const source = fs.readFileSync('program.mycelial', 'utf-8');
const parser = new MycelialParser();
const network = parser.parseNetwork(source);

console.log('Network:', network.name);
console.log('Agents:', network.spawns.length);
```

### Execute a Network

```javascript
const { MycelialExecutor } = require('./executor.js');
const { MycelialScheduler } = require('./scheduler.js');

// Initialize executor
const executor = new MycelialExecutor(network, parser);
executor.initialize();

// Inject initial signal
executor.signalQueues['agent1'].push({
  frequency: 'start',
  sourceAgentId: 'input',
  payload: { value: 42 },
  timestamp: Date.now()
});

// Run scheduler
const scheduler = new MycelialScheduler(executor, {
  verbose: true,        // Show execution details
  maxCycles: 100        // Limit cycles
});

const stats = scheduler.run();

// Get results
const output = executor.getOutput();
console.log('Results:', output);
```

### Get Agent State

```javascript
// After execution
for (const [id, agent] of Object.entries(executor.agents)) {
  console.log(`Agent ${id}:`, agent.state);
}
```

### Get Output Signals

```javascript
// Get signals sent to a fruiting body
const outputSignals = executor.getFruitingBodyOutput('output');

for (const sig of outputSignals) {
  console.log(`${sig.frequency}:`, sig.payload);
}
```

## Simple Example

Here's a complete minimal example:

```javascript
const { MycelialParser } = require('./parser.js');
const { MycelialExecutor } = require('./executor.js');
const { MycelialScheduler } = require('./scheduler.js');

const source = `
network Echo {
  frequencies {
    input { msg: string }
    output { msg: string }
  }

  hyphae {
    hyphal echo {
      on signal(input, i) {
        emit output { msg: i.msg }
      }
    }
  }

  topology {
    fruiting_body in
    fruiting_body out
    spawn echo as E
    socket in -> E (frequency: input)
    socket E -> out (frequency: output)
  }
}
`;

// Parse
const parser = new MycelialParser();
const network = parser.parseNetwork(source);

// Execute
const executor = new MycelialExecutor(network, parser);
executor.initialize();

// Inject signal
executor.signalQueues.E.push({
  frequency: 'input',
  sourceAgentId: 'in',
  payload: { msg: 'Hello, Mycelial!' },
  timestamp: Date.now()
});

// Schedule
const scheduler = new MycelialScheduler(executor, { maxCycles: 10 });
scheduler.run();

// Get output
const output = executor.getFruitingBodyOutput('out');
console.log('Output:', output[0].payload.msg);
// Output: Hello, Mycelial!
```

## Debugging

### Enable Verbose Mode

```javascript
const scheduler = new MycelialScheduler(executor, {
  verbose: true  // Show cycle details
});
```

### Inspect Agent State

```javascript
console.log('Agent state:', executor.agents.agentId.state);
```

### Track Signal Flow

```javascript
console.log('Signal queues:');
for (const [id, queue] of Object.entries(executor.signalQueues)) {
  console.log(`  ${id}: ${queue.length} signals`);
}
```

### Get Execution Statistics

```javascript
const stats = scheduler.run();
console.log('Cycles:', stats.cycleCount);
console.log('Signals processed:', stats.signalsProcessed);
```

## Common Patterns

### Counter Agent

```javascript
const source = `
network Counter {
  frequencies {
    tick { value: u32 }
    total { sum: u32 }
  }

  hyphae {
    hyphal counter {
      state { sum: u32 = 0 }

      on signal(tick, t) {
        state.sum = state.sum + t.value
        emit total { sum: state.sum }
      }
    }
  }

  topology {
    fruiting_body input
    fruiting_body output
    spawn counter as C
    socket input -> C (frequency: tick)
    socket C -> output (frequency: total)
  }
}
`;
```

### Pipeline Pattern

```javascript
const source = `
network Pipeline {
  frequencies {
    input { x: u32 }
    intermediate { y: u32 }
    output { z: u32 }
  }

  hyphae {
    hyphal stage1 {
      on signal(input, i) {
        emit intermediate { y: i.x * 2 }
      }
    }

    hyphal stage2 {
      on signal(intermediate, i) {
        emit output { z: i.y + 1 }
      }
    }
  }

  topology {
    fruiting_body in
    fruiting_body out
    spawn stage1 as S1
    spawn stage2 as S2
    socket in -> S1 (frequency: input)
    socket S1 -> S2 (frequency: intermediate)
    socket S2 -> out (frequency: output)
  }
}
`;
```

## Troubleshooting

### "Parse error at line X"
- Check syntax: all blocks need closing braces
- Check operators: use `==` not `=` for comparison
- Check keywords: `hyphal`, `on signal`, `emit`

### "Undefined variable"
- Make sure variable is declared with `let`
- Check spelling of state field names
- Use `state.field` to access agent state

### "Unknown hyphal type"
- Check hyphal name matches spawn name
- Verify hyphal is defined in `hyphae` block

### Infinite loops
- Set `maxCycles` option in scheduler
- Check termination conditions in `while` loops
- Verify signal routing doesn't create cycles

## Files Reference

- `parser.js` - Parse Mycelial source to AST
- `executor.js` - Execute agents and manage state
- `scheduler.js` - Run tidal cycles
- `signal-router.js` - Route signals between agents
- `test-interpreter.js` - Run test suite
- `demo.js` - See examples in action
- `example-integration.js` - Integration with runtime

## Next Steps

1. Try the examples in `/home/lewey/Desktop/mycelial-code/07-EXAMPLES/`
2. Read the full documentation in `README.md`
3. Explore the test suite in `test-interpreter.js`
4. Integrate with the main runtime for full bootstrap

## Support

For issues or questions, refer to:
- `README.md` - Full documentation
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `test-interpreter.js` - Usage examples

---

**Happy coding with Mycelial!** 🌿
