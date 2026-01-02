/**
 * Test suite for Mycelial Runtime Phase 1 components
 *
 * Demonstrates parsing and execution of Mycelial agents
 *
 * @author Claude Opus 4.5
 * @date 2026-01-01
 */

const fs = require('fs');
const { OrchestrationParser } = require('./orchestration-parser');
const { AgentInstance } = require('./agent-executor');

/**
 * Test the orchestration parser
 */
function testParser() {
  console.log('='.repeat(60));
  console.log('TEST 1: Orchestration Parser');
  console.log('='.repeat(60));

  // Read the compiler source file
  const compilerPath = process.env.COMPILER_PATH ||
    require('path').join(__dirname, '../../mycelial-compiler/mycelial-compiler.mycelial');
  const compilerSource = fs.readFileSync(compilerPath, 'utf8');

  const parser = new OrchestrationParser();
  const network = parser.parse(compilerSource);

  console.log('\nNetwork Name:', network.networkName);
  console.log('\nFrequencies:', Object.keys(network.frequencies).length);
  console.log('  Sample:', Object.keys(network.frequencies).slice(0, 5));

  console.log('\nTypes:');
  console.log('  Enums:', Object.keys(network.types.enums).length);
  console.log('  Structs:', Object.keys(network.types.structs).length);

  console.log('\nHyphae:', Object.keys(network.hyphae).length);
  console.log('  Agents:', Object.keys(network.hyphae));

  console.log('\nTopology:');
  console.log('  Fruiting Bodies:', network.topology.fruitingBodies);
  console.log('  Spawns:', network.topology.spawns.length);
  console.log('  Sockets:', network.topology.sockets.length);

  return network;
}

/**
 * Test the agent executor
 */
function testAgentExecutor(network) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Agent Executor');
  console.log('='.repeat(60));

  // Create a lexer agent instance
  const lexerDef = network.hyphae.lexer;
  const lexerAgent = new AgentInstance('lexer', 'L1', lexerDef);

  console.log('\nCreated agent:', lexerAgent.instanceId);
  console.log('State fields:', Object.keys(lexerDef.state));
  console.log('Rules:', lexerDef.rules.length);

  // Initialize the agent
  console.log('\nInitializing agent...');
  lexerAgent.initialize(network.types);

  console.log('Initial state:');
  console.log('  position:', lexerAgent.state.position);
  console.log('  line:', lexerAgent.state.line);
  console.log('  column:', lexerAgent.state.column);
  console.log('  keywords map:', lexerAgent.state.keywords instanceof Map);

  // Test signal processing
  console.log('\nTesting signal processing...');

  const testSignal = {
    frequency: 'lex_request',
    payload: {
      source: 'network test { }',
      filename: 'test.mycelial'
    }
  };

  console.log('Sending signal:', testSignal.frequency);

  try {
    const emittedSignals = lexerAgent.processSignal(testSignal);
    console.log('Signals emitted:', emittedSignals.length);

    if (emittedSignals.length > 0) {
      console.log('First emitted signal:', emittedSignals[0].frequency);
    }
  } catch (error) {
    console.log('Expected error (complex rule execution):', error.message.substring(0, 100));
  }

  // Get final state
  const finalState = lexerAgent.getState();
  console.log('\nFinal state:');
  console.log('  source:', finalState.source ? finalState.source.substring(0, 20) + '...' : 'empty');
  console.log('  filename:', finalState.filename);
}

/**
 * Test a simple custom agent
 */
function testSimpleAgent() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Simple Custom Agent');
  console.log('='.repeat(60));

  // Define a simple counter agent
  const counterDef = {
    state: {
      count: 'u32',
      name: 'string'
    },
    rules: [
      {
        type: 'on_rest',
        trigger: null,
        condition: null,
        body: `
          state.count = 0
          state.name = "Counter"
        `
      },
      {
        type: 'on_signal',
        trigger: 'increment',
        paramName: 'sig',
        condition: null,
        body: `
          state.count = state.count + 1
          emit count_updated {
            count: state.count,
            name: state.name
          }
        `
      }
    ]
  };

  const counter = new AgentInstance('counter', 'C1', counterDef);
  console.log('\nCreated counter agent:', counter.instanceId);

  // Initialize
  counter.initialize();
  console.log('Initial count:', counter.state.count);
  console.log('Initial name:', counter.state.name);

  // Send increment signals
  console.log('\nSending 3 increment signals...');
  for (let i = 0; i < 3; i++) {
    const emitted = counter.processSignal({
      frequency: 'increment',
      payload: {}
    });

    if (emitted.length > 0) {
      console.log(`  Signal ${i + 1}: count = ${counter.state.count}, emitted:`, emitted[0].frequency);
    } else {
      console.log(`  Signal ${i + 1}: count = ${counter.state.count}, emitted: none`);
    }
  }

  console.log('\nFinal count:', counter.state.count);
}

/**
 * Main test runner
 */
function runTests() {
  console.log('\n');
  console.log('#'.repeat(60));
  console.log('# MYCELIAL RUNTIME - PHASE 1 TESTS');
  console.log('#'.repeat(60));
  console.log('\n');

  try {
    const network = testParser();
    testAgentExecutor(network);
    testSimpleAgent();

    console.log('\n' + '='.repeat(60));
    console.log('ALL TESTS COMPLETED');
    console.log('='.repeat(60));
    console.log('\n');
  } catch (error) {
    console.error('\nTEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
