/**
 * Example: Integration with Main Runtime
 *
 * Shows how to integrate the Mycelial interpreter with the existing runtime
 * to compile .mycelial files.
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-07
 */

const { MycelialParser } = require('./parser.js');
const { MycelialExecutor } = require('./executor.js');
const { MycelialScheduler } = require('./scheduler.js');
const fs = require('fs');
const path = require('path');

/**
 * Compile a Mycelial program to output
 * @param {string} sourceFile - Path to .mycelial source file
 * @param {string} outputFile - Path for output (optional)
 * @param {Object} options - Compilation options
 */
async function compileMycelial(sourceFile, outputFile, options = {}) {
  console.log(`Compiling: ${sourceFile}`);

  // 1. Read source
  const source = fs.readFileSync(sourceFile, 'utf-8');

  // 2. Parse
  const parser = new MycelialParser();
  const network = parser.parseNetwork(source);

  console.log(`  Network: ${network.name}`);
  console.log(`  Agents: ${network.spawns.length}`);
  console.log(`  Frequencies: ${Object.keys(network.frequencies).length}`);

  // 3. Initialize executor
  const executor = new MycelialExecutor(network, parser);
  executor.initialize();

  // 4. Inject initial signals if provided
  if (options.initialSignals) {
    for (const sig of options.initialSignals) {
      executor.signalQueues[sig.to].push({
        frequency: sig.frequency,
        sourceAgentId: sig.from,
        payload: sig.payload,
        timestamp: Date.now()
      });
    }
  }

  // 5. Run scheduler
  const scheduler = new MycelialScheduler(executor, {
    verbose: options.verbose || false,
    emptyThreshold: options.emptyThreshold || 10,
    maxCycles: options.maxCycles || 1000
  });

  const stats = scheduler.run();

  console.log(`  Cycles: ${stats.cycleCount}`);
  console.log(`  Signals processed: ${stats.signalsProcessed}`);

  // 6. Get output
  const output = executor.getOutput();

  // 7. Write output if specified
  if (outputFile) {
    // For now, write JSON output
    // In the future, this would generate ELF binaries
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`  Output written to: ${outputFile}`);
  }

  return {
    network,
    stats,
    output,
    executor
  };
}

/**
 * Example usage
 */
async function main() {
  const examplesDir = '/home/lewey/Desktop/mycelial-code/07-EXAMPLES';

  // Compile hello_world.mycelial
  console.log('\n=== Compiling hello_world.mycelial ===\n');

  const helloWorldPath = path.join(examplesDir, 'hello_world.mycelial');
  const result = await compileMycelial(helloWorldPath, null, {
    verbose: false,
    initialSignals: [
      {
        from: 'input',
        to: 'G1',
        frequency: 'greeting',
        payload: { name: 'Mycelial' }
      }
    ]
  });

  console.log('\n=== Results ===');
  console.log('Agent States:', JSON.stringify(result.executor.agents.G1.state, null, 2));

  const outputSignals = result.executor.getFruitingBodyOutput('output');
  console.log('\nOutput Signals:');
  for (const sig of outputSignals) {
    console.log(`  ${sig.frequency}:`, sig.payload);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { compileMycelial };
