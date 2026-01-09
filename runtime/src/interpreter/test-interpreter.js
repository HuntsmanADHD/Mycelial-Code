/**
 * Mycelial Interpreter Test Suite
 *
 * Tests the complete interpreter pipeline:
 * - Parser tests
 * - Executor tests
 * - Scheduler tests
 * - Full integration tests
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-07
 */

const { MycelialParser } = require('./parser.js');
const { MycelialExecutor } = require('./executor.js');
const { MycelialScheduler } = require('./scheduler.js');
const { SignalRouter } = require('./signal-router.js');

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`✓ ${message}`);
    testsPassed++;
  }
}

function assertEquals(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`❌ FAIL: ${message}`);
    console.error(`  Expected: ${JSON.stringify(expected)}`);
    console.error(`  Actual:   ${JSON.stringify(actual)}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`✓ ${message}`);
    testsPassed++;
  }
}

function runTest(name, testFn) {
  console.log(`\n=== ${name} ===`);
  try {
    testFn();
    console.log(`✓ ${name} passed`);
  } catch (error) {
    console.error(`❌ ${name} failed:`, error.message);
  }
}

// ========== Parser Tests ==========

function testParserBasic() {
  const parser = new MycelialParser();

  const source = `
    network TestNetwork {
      frequencies {
        greeting {
          name: string
        }
      }

      hyphae {
        hyphal greeter {
          on signal(greeting, g) {
            emit response { message: "hello" }
          }
        }
      }

      topology {
        spawn greeter as G1
      }
    }
  `;

  const network = parser.parseNetwork(source);

  assert(network.name === 'TestNetwork', 'Network name parsed');
  assert(network.frequencies.greeting !== undefined, 'Frequency parsed');
  assert(network.hyphae.greeter !== undefined, 'Hyphal parsed');
  assert(network.spawns.length === 1, 'Spawn parsed');
  assert(network.spawns[0].instanceId === 'G1', 'Spawn instance ID correct');
}

function testParserState() {
  const parser = new MycelialParser();

  const source = `
    network Test {
      frequencies {}
      hyphae {
        hyphal counter {
          state {
            count: u32 = 0,
            name: string = "test"
          }
          on rest {}
        }
      }
      topology {}
    }
  `;

  const network = parser.parseNetwork(source);
  const hyphal = network.hyphae.counter;

  assert(hyphal.state.length === 2, 'Two state fields parsed');
  assert(hyphal.state[0].name === 'count', 'First state field name correct');
  assert(hyphal.state[0].type === 'u32', 'First state field type correct');
  assert(hyphal.state[0].default !== null, 'Default value parsed');
}

function testParserExpressions() {
  const parser = new MycelialParser();

  // Test number literal
  parser.source = '42';
  parser.position = 0;
  const num = parser.parseExpression();
  assert(num.type === 'literal', 'Number literal type');
  assert(num.value === 42, 'Number literal value');

  // Test string literal
  parser.source = '"hello world"';
  parser.position = 0;
  const str = parser.parseExpression();
  assert(str.type === 'literal', 'String literal type');
  assert(str.value === 'hello world', 'String literal value');

  // Test binary expression
  parser.source = 'a + b';
  parser.position = 0;
  const binary = parser.parseExpression();
  assert(binary.type === 'binary', 'Binary expression type');
  assert(binary.op === '+', 'Binary operator');

  // Test field access
  parser.source = 'obj.field';
  parser.position = 0;
  const field = parser.parseExpression();
  assert(field.type === 'field-access', 'Field access type');
  assert(field.field === 'field', 'Field name');
}

function testParserFunctionCall() {
  const parser = new MycelialParser();

  parser.source = 'format("Hello, {}!", name)';
  parser.position = 0;
  const call = parser.parseExpression();

  assert(call.type === 'function-call', 'Function call type');
  assert(call.name === 'format', 'Function name');
  assert(call.args.length === 2, 'Argument count');
}

// ========== Executor Tests ==========

function testExecutorAgentCreation() {
  const network = {
    name: 'Test',
    frequencies: {
      ping: { fields: [{ name: 'data', type: 'string' }] }
    },
    hyphae: {
      agent1: {
        name: 'agent1',
        state: [
          { name: 'counter', type: 'u32', default: { type: 'literal', value: 0 } }
        ],
        handlers: []
      }
    },
    spawns: [
      { hyphalType: 'agent1', instanceId: 'A1' }
    ],
    sockets: [],
    fruitingBodies: []
  };

  const parser = new MycelialParser();
  const executor = new MycelialExecutor(network, parser);
  executor.initialize();

  assert(executor.agents.A1 !== undefined, 'Agent created');
  assert(executor.agents.A1.id === 'A1', 'Agent ID correct');
  assert(executor.agents.A1.state.counter === 0, 'Agent state initialized');
}

function testExecutorExpressionEvaluation() {
  const network = {
    name: 'Test',
    frequencies: {},
    hyphae: {
      test: {
        name: 'test',
        state: [{ name: 'x', type: 'u32', default: { type: 'literal', value: 10 } }],
        handlers: []
      }
    },
    spawns: [{ hyphalType: 'test', instanceId: 'T1' }],
    sockets: [],
    fruitingBodies: []
  };

  const parser = new MycelialParser();
  const executor = new MycelialExecutor(network, parser);
  executor.initialize();

  const agent = executor.agents.T1;
  const context = { y: 5 };

  // Test literal
  const lit = executor.evaluateExpression(agent, { type: 'literal', value: 42 }, context);
  assert(lit === 42, 'Literal evaluation');

  // Test variable from context
  const varCtx = executor.evaluateExpression(agent, { type: 'variable', name: 'y' }, context);
  assert(varCtx === 5, 'Variable from context');

  // Test variable from state
  const varState = executor.evaluateExpression(agent, { type: 'variable', name: 'x' }, context);
  assert(varState === 10, 'Variable from state');

  // Test binary operation
  const binExpr = {
    type: 'binary',
    op: '+',
    left: { type: 'literal', value: 3 },
    right: { type: 'literal', value: 4 }
  };
  const binResult = executor.evaluateExpression(agent, binExpr, context);
  assert(binResult === 7, 'Binary operation');
}

function testExecutorBuiltinFunctions() {
  const network = {
    name: 'Test',
    frequencies: {},
    hyphae: {
      test: { name: 'test', state: [], handlers: [] }
    },
    spawns: [{ hyphalType: 'test', instanceId: 'T1' }],
    sockets: [],
    fruitingBodies: []
  };

  const parser = new MycelialParser();
  const executor = new MycelialExecutor(network, parser);
  executor.initialize();

  const agent = executor.agents.T1;
  const context = {};

  // Test format
  const formatResult = executor.callFunction(
    'format',
    [{ type: 'literal', value: 'Hello, {}!' }, { type: 'literal', value: 'World' }],
    agent,
    context
  );
  assert(formatResult === 'Hello, World!', 'format() function');

  // Test len
  const lenResult = executor.callFunction(
    'len',
    [{ type: 'literal', value: 'hello' }],
    agent,
    context
  );
  assert(lenResult === 5, 'len() function');

  // Test vec_push
  context.arr = [1, 2, 3];
  executor.callFunction(
    'vec_push',
    [{ type: 'variable', name: 'arr' }, { type: 'literal', value: 4 }],
    agent,
    context
  );
  assert(context.arr.length === 4, 'vec_push() function');
  assert(context.arr[3] === 4, 'vec_push() value correct');
}

function testExecutorStatementExecution() {
  const network = {
    name: 'Test',
    frequencies: {},
    hyphae: {
      test: {
        name: 'test',
        state: [{ name: 'count', type: 'u32', default: { type: 'literal', value: 0 } }],
        handlers: []
      }
    },
    spawns: [{ hyphalType: 'test', instanceId: 'T1' }],
    sockets: [],
    fruitingBodies: []
  };

  const parser = new MycelialParser();
  const executor = new MycelialExecutor(network, parser);
  executor.initialize();

  const agent = executor.agents.T1;
  const context = {};

  // Test let statement
  const letStmt = {
    type: 'let',
    name: 'x',
    value: { type: 'literal', value: 42 }
  };
  executor.executeStatement(agent, letStmt, context);
  assert(context.x === 42, 'let statement');

  // Test assignment to state
  const assignStmt = {
    type: 'assignment',
    target: { type: 'state-access', object: 'state', field: 'count' },
    value: { type: 'literal', value: 10 }
  };
  executor.executeStatement(agent, assignStmt, context);
  assert(agent.state.count === 10, 'assignment to state');
}

// ========== Signal Router Tests ==========

function testSignalRouter() {
  const sockets = [
    {
      from: { agent: 'A', frequency: 'ping' },
      to: { agent: 'B', frequency: 'ping' }
    },
    {
      from: { agent: 'B', frequency: 'pong' },
      to: { agent: 'C', frequency: 'pong' }
    },
    {
      from: { agent: 'A', frequency: 'ping' },
      to: { agent: 'C', frequency: 'ping' }
    }
  ];

  const router = new SignalRouter(sockets);

  const destFromA = router.getDestinations('A', 'ping');
  assert(destFromA.length === 2, 'Multiple destinations from A');
  assert(destFromA.includes('B'), 'A routes to B');
  assert(destFromA.includes('C'), 'A routes to C');

  const destFromB = router.getDestinations('B', 'pong');
  assert(destFromB.length === 1, 'Single destination from B');
  assert(destFromB[0] === 'C', 'B routes to C');
}

// ========== Scheduler Tests ==========

function testSchedulerBasic() {
  const network = {
    name: 'Test',
    frequencies: {
      ping: { fields: [{ name: 'value', type: 'u32' }] }
    },
    hyphae: {
      pinger: {
        name: 'pinger',
        state: [],
        handlers: [
          {
            type: 'signal',
            frequency: 'ping',
            binding: 'p',
            guard: null,
            body: [
              {
                type: 'report',
                name: 'received',
                value: { type: 'field-access', object: { type: 'variable', name: 'p' }, field: 'value' }
              }
            ]
          }
        ]
      }
    },
    spawns: [
      { hyphalType: 'pinger', instanceId: 'P1' }
    ],
    sockets: [],
    fruitingBodies: []
  };

  const parser = new MycelialParser();
  const executor = new MycelialExecutor(network, parser);
  executor.initialize();

  // Manually enqueue a signal
  executor.signalQueues.P1.push({
    frequency: 'ping',
    sourceAgentId: 'test',
    payload: { value: 42 },
    timestamp: Date.now()
  });

  const scheduler = new MycelialScheduler(executor, { verbose: false, emptyThreshold: 1 });
  const stats = scheduler.run();

  assert(stats.signalsProcessed === 1, 'One signal processed');
  assert(executor.reports.P1.received === 42, 'Report value correct');
}

// ========== Integration Tests ==========

function testFullPipeline() {
  const source = `
    network SimpleTest {
      frequencies {
        start {
          value: u32
        }
        result {
          doubled: u32
        }
      }

      hyphae {
        hyphal doubler {
          state {
            count: u32 = 0
          }

          on signal(start, s) {
            state.count = state.count + 1
            let doubled = s.value * 2
            emit result {
              doubled: doubled
            }
          }
        }
      }

      topology {
        fruiting_body input
        fruiting_body output

        spawn doubler as D

        socket input -> D (frequency: start)
        socket D -> output (frequency: result)
      }
    }
  `;

  // Parse
  const parser = new MycelialParser();
  const network = parser.parseNetwork(source);

  assert(network.name === 'SimpleTest', 'Network parsed');
  assert(network.hyphae.doubler !== undefined, 'Hyphal parsed');

  // Execute
  const executor = new MycelialExecutor(network, parser);
  executor.initialize();

  assert(executor.agents.D !== undefined, 'Agent created');
  assert(executor.agents.D.state.count === 0, 'Initial state correct');

  // Inject initial signal
  executor.signalQueues.D.push({
    frequency: 'start',
    sourceAgentId: 'input',
    payload: { value: 21 },
    timestamp: Date.now()
  });

  // Schedule
  const scheduler = new MycelialScheduler(executor, { verbose: false, emptyThreshold: 2, maxCycles: 10 });
  const stats = scheduler.run();

  assert(stats.signalsProcessed === 1, 'Signal processed');
  assert(executor.agents.D.state.count === 1, 'State updated');

  // Check output
  const output = executor.getFruitingBodyOutput('output');
  assert(output.length === 1, 'Output signal emitted');
  assert(output[0].payload.doubled === 42, 'Output value correct');
}

function testHelloWorldParsing() {
  const fs = require('fs');
  const path = require('path');

  const helloWorldPath = '/home/lewey/Desktop/mycelial-code/07-EXAMPLES/hello_world.mycelial';

  if (!fs.existsSync(helloWorldPath)) {
    console.log('⊘ Skipping hello_world.mycelial test (file not found)');
    return;
  }

  const source = fs.readFileSync(helloWorldPath, 'utf-8');
  const parser = new MycelialParser();

  try {
    const network = parser.parseNetwork(source);
    assert(network.name === 'HelloWorld', 'HelloWorld network name');
    assert(network.frequencies.greeting !== undefined, 'greeting frequency exists');
    assert(network.hyphae.greeter !== undefined, 'greeter hyphal exists');
    console.log('✓ Successfully parsed hello_world.mycelial');
  } catch (error) {
    console.error('❌ Failed to parse hello_world.mycelial:', error.message);
    throw error;
  }
}

function testPipelineParsing() {
  const fs = require('fs');

  const pipelinePath = '/home/lewey/Desktop/mycelial-code/07-EXAMPLES/pipeline.mycelial';

  if (!fs.existsSync(pipelinePath)) {
    console.log('⊘ Skipping pipeline.mycelial test (file not found)');
    return;
  }

  const source = fs.readFileSync(pipelinePath, 'utf-8');
  const parser = new MycelialParser();

  try {
    const network = parser.parseNetwork(source);
    assert(network.name === 'Pipeline', 'Pipeline network name');
    assert(network.hyphae.validator !== undefined, 'validator hyphal exists');
    assert(network.hyphae.processor !== undefined, 'processor hyphal exists');
    assert(network.hyphae.formatter !== undefined, 'formatter hyphal exists');
    assert(network.spawns.length === 3, 'Three agents spawned');
    console.log('✓ Successfully parsed pipeline.mycelial');
  } catch (error) {
    console.error('❌ Failed to parse pipeline.mycelial:', error.message);
    throw error;
  }
}

// ========== Run All Tests ==========

function runAllTests() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Mycelial Interpreter Test Suite         ║');
  console.log('╚════════════════════════════════════════════╝');

  // Parser tests
  runTest('Parser - Basic Network', testParserBasic);
  runTest('Parser - State Definitions', testParserState);
  runTest('Parser - Expressions', testParserExpressions);
  runTest('Parser - Function Calls', testParserFunctionCall);

  // Executor tests
  runTest('Executor - Agent Creation', testExecutorAgentCreation);
  runTest('Executor - Expression Evaluation', testExecutorExpressionEvaluation);
  runTest('Executor - Built-in Functions', testExecutorBuiltinFunctions);
  runTest('Executor - Statement Execution', testExecutorStatementExecution);

  // Router tests
  runTest('Signal Router - Routing', testSignalRouter);

  // Scheduler tests
  runTest('Scheduler - Basic Execution', testSchedulerBasic);

  // Integration tests
  runTest('Integration - Full Pipeline', testFullPipeline);
  runTest('Integration - Parse hello_world.mycelial', testHelloWorldParsing);
  runTest('Integration - Parse pipeline.mycelial', testPipelineParsing);

  // Summary
  console.log('\n╔════════════════════════════════════════════╗');
  console.log(`║   Tests Passed: ${testsPassed.toString().padStart(3)}                         ║`);
  console.log(`║   Tests Failed: ${testsFailed.toString().padStart(3)}                         ║`);
  console.log('╚════════════════════════════════════════════╝');

  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
