/**
 * Mycelial Interpreter Demo
 *
 * Demonstrates the complete interpreter executing a simple Mycelial program
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-07
 */

const { MycelialParser } = require('./parser.js');
const { MycelialExecutor } = require('./executor.js');
const { MycelialScheduler } = require('./scheduler.js');

// Example 1: Simple counter network
const counterExample = `
network Counter {
  frequencies {
    tick {
      value: u32
    }

    report {
      count: u32
    }
  }

  hyphae {
    hyphal counter {
      state {
        count: u32 = 0
      }

      on signal(tick, t) {
        state.count = state.count + t.value

        emit report {
          count: state.count
        }
      }
    }
  }

  topology {
    fruiting_body input
    fruiting_body output

    spawn counter as C

    socket input -> C (frequency: tick)
    socket C -> output (frequency: report)
  }
}
`;

// Example 2: Pipeline with multiple agents
const pipelineExample = `
network SimplePipeline {
  frequencies {
    input_data {
      value: u32
    }

    doubled {
      value: u32
    }

    result {
      final: u32
    }
  }

  hyphae {
    hyphal doubler {
      on signal(input_data, d) {
        emit doubled {
          value: d.value * 2
        }
      }
    }

    hyphal incrementer {
      on signal(doubled, d) {
        emit result {
          final: d.value + 1
        }
      }
    }
  }

  topology {
    fruiting_body input
    fruiting_body output

    spawn doubler as D
    spawn incrementer as I

    socket input -> D (frequency: input_data)
    socket D -> I (frequency: doubled)
    socket I -> output (frequency: result)
  }
}
`;

function runExample(name, source, initialSignals) {
  console.log(`\n╔${'═'.repeat(60)}╗`);
  console.log(`║ ${name.padEnd(58)} ║`);
  console.log(`╚${'═'.repeat(60)}╝\n`);

  // Parse
  console.log('1️⃣  Parsing network...');
  const parser = new MycelialParser();
  const network = parser.parseNetwork(source);
  console.log(`   ✓ Network: ${network.name}`);
  console.log(`   ✓ Frequencies: ${Object.keys(network.frequencies).length}`);
  console.log(`   ✓ Hyphae: ${Object.keys(network.hyphae).length}`);
  console.log(`   ✓ Agents: ${network.spawns.length}`);

  // Initialize executor
  console.log('\n2️⃣  Initializing executor...');
  const executor = new MycelialExecutor(network, parser);
  executor.initialize();
  console.log(`   ✓ Created ${Object.keys(executor.agents).length} agent(s)`);
  for (const [id, agent] of Object.entries(executor.agents)) {
    console.log(`     - ${id}: ${agent.type}`);
  }

  // Inject initial signals
  console.log('\n3️⃣  Injecting initial signals...');
  for (const sig of initialSignals) {
    executor.signalQueues[sig.to].push({
      frequency: sig.frequency,
      sourceAgentId: sig.from,
      payload: sig.payload,
      timestamp: Date.now()
    });
    console.log(`   ✓ ${sig.from} -> ${sig.to}: ${sig.frequency}(${JSON.stringify(sig.payload)})`);
  }

  // Run scheduler
  console.log('\n4️⃣  Running scheduler...');
  const scheduler = new MycelialScheduler(executor, {
    verbose: false,
    emptyThreshold: 3,
    maxCycles: 100
  });
  const stats = scheduler.run();
  console.log(`   ✓ Cycles: ${stats.cycleCount}`);
  console.log(`   ✓ Signals processed: ${stats.signalsProcessed}`);

  // Show results
  console.log('\n5️⃣  Results:');

  // Agent states
  console.log('   Agent States:');
  for (const [id, agent] of Object.entries(executor.agents)) {
    console.log(`     ${id}: ${JSON.stringify(agent.state)}`);
  }

  // Reports
  if (Object.keys(executor.reports).length > 0) {
    console.log('\n   Reports:');
    for (const [agentId, reports] of Object.entries(executor.reports)) {
      if (Object.keys(reports).length > 0) {
        console.log(`     ${agentId}: ${JSON.stringify(reports)}`);
      }
    }
  }

  // Output signals
  const outputSignals = executor.getFruitingBodyOutput('output');
  if (outputSignals.length > 0) {
    console.log('\n   Output Signals:');
    for (const sig of outputSignals) {
      console.log(`     ${sig.frequency}: ${JSON.stringify(sig.payload)}`);
    }
  }

  console.log('');
}

// Run examples
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║         Mycelial Interpreter - Live Demonstration             ║');
console.log('╚════════════════════════════════════════════════════════════════╝');

runExample('Example 1: Counter Network', counterExample, [
  { from: 'input', to: 'C', frequency: 'tick', payload: { value: 5 } },
  { from: 'input', to: 'C', frequency: 'tick', payload: { value: 3 } },
  { from: 'input', to: 'C', frequency: 'tick', payload: { value: 7 } }
]);

runExample('Example 2: Pipeline Network', pipelineExample, [
  { from: 'input', to: 'D', frequency: 'input_data', payload: { value: 10 } },
  { from: 'input', to: 'D', frequency: 'input_data', payload: { value: 20 } }
]);

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║                    Demo Complete! ✨                           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');
