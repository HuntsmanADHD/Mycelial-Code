#!/usr/bin/env node
/**
 * Test hello_world.mycelial with the JavaScript runtime
 */

const { MycelialParser } = require('./src/interpreter/parser.js');
const { MycelialExecutor } = require('./src/interpreter/executor.js');
const { MycelialScheduler } = require('./src/interpreter/scheduler.js');
const fs = require('fs');

console.log('='.repeat(70));
console.log('Testing hello_world.mycelial with JavaScript Runtime');
console.log('='.repeat(70));

// Load the source file
const sourceCode = fs.readFileSync('../tests/hello_world.mycelial', 'utf8');
console.log('\n✓ Source code loaded');

// Parse the network definition
const parser = new MycelialParser();
const network = parser.parseNetwork(sourceCode);
console.log('✓ Network parsed');
console.log('  Network name:', network.name);
console.log('  Frequencies:', Object.keys(network.frequencies || {}).join(', '));
console.log('  Hyphae:', Object.keys(network.hyphae || {}).join(', '));

// Create executor
const executor = new MycelialExecutor(network, parser);
console.log('\n✓ Executor created');

// Initialize executor
executor.initialize();
console.log('✓ Executor initialized');
console.log('  Agents:', Object.keys(executor.agents).join(', '));
console.log('  Signal queues:', Object.keys(executor.signalQueues).join(', '));

// Inject a greeting signal into the input queue
console.log('\n--- Injecting greeting signal ---');
const greetingSignal = {
  frequency: 'greeting',
  sourceAgentId: 'input',
  payload: { name: 'World' },
  timestamp: Date.now()
};

// Find which agents should receive signals from input
const inputDestinations = executor.signalRouter.getDestinations('input', 'greeting');
console.log('Input destinations:', inputDestinations);

// Inject the signal into those queues
for (const destId of inputDestinations) {
  executor.signalQueues[destId].push(greetingSignal);
  console.log(`Injected signal into ${destId}'s queue`);
}

// Create scheduler
const scheduler = new MycelialScheduler(executor, { verbose: true, maxCycles: 10 });
console.log('\n✓ Scheduler created');

// Run the scheduler
console.log('\n--- Running tidal cycles ---');
const results = scheduler.run();

console.log('\n--- Results ---');
console.log('Cycles executed:', results.cycleCount);
console.log('Signals processed:', results.signalsProcessed);

if (executor.outputs && executor.outputs.length > 0) {
  console.log('\nOutputs received:');
  executor.outputs.forEach((output, i) => {
    console.log(`  ${i + 1}.`, JSON.stringify(output));
  });
} else {
  console.log('\nNo outputs received');
}

// Check output queue
if (executor.signalQueues['output']) {
  console.log('\nOutput queue signals:', executor.signalQueues['output'].length);
  executor.signalQueues['output'].forEach((signal, i) => {
    console.log(`  ${i + 1}.`, JSON.stringify(signal));
  });
}

console.log('\n' + '='.repeat(70));
console.log('Test complete!');
console.log('='.repeat(70));
