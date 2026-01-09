/**
 * Mycelial Scheduler
 *
 * Implements the tidal cycle: REST → SENSE → ACT
 * - REST: Idle phase, execute rest handlers
 * - SENSE: Dequeue one signal per agent
 * - ACT: Process the signals
 *
 * Termination: Stops when all queues are empty for N consecutive cycles
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-07
 */

class MycelialScheduler {
  constructor(executor, options = {}) {
    this.executor = executor;
    this.running = true;
    this.cycleCount = 0;
    this.signalsProcessed = 0;
    this.emptyCount = 0;
    this.maxCycles = options.maxCycles || Infinity;
    this.emptyThreshold = options.emptyThreshold || 10;
    this.verbose = options.verbose || false;
  }

  /**
   * Run the scheduler until termination
   * @returns {Object} Statistics about execution
   */
  run() {
    this.log('Starting scheduler');

    while (this.running && this.cycleCount < this.maxCycles) {
      this.runCycle();

      // Check termination condition
      if (this.shouldTerminate()) {
        this.log('Terminating: no more signals to process');
        this.running = false;
      }
    }

    if (this.cycleCount >= this.maxCycles) {
      this.log(`Terminating: reached max cycles (${this.maxCycles})`);
    }

    return {
      cycleCount: this.cycleCount,
      signalsProcessed: this.signalsProcessed,
      success: true
    };
  }

  /**
   * Run a single tidal cycle
   */
  runCycle() {
    this.cycleCount++;
    this.log(`\n=== Cycle ${this.cycleCount} ===`);

    // REST phase: Execute rest handlers
    this.restPhase();

    // SENSE phase: Dequeue signals
    const signalsThisCycle = this.sensePhase();

    // ACT phase: Process signals
    this.actPhase(signalsThisCycle);
  }

  /**
   * REST phase: Execute rest handlers for all agents
   */
  restPhase() {
    this.log('REST phase: executing rest handlers');
    this.executor.executeRestHandlers();
  }

  /**
   * SENSE phase: Dequeue one signal per agent
   * @returns {Object} Map of agentId to signal
   */
  sensePhase() {
    this.log('SENSE phase: dequeuing signals');

    const signalsThisCycle = {};
    const agentIds = Object.keys(this.executor.agents);

    for (const agentId of agentIds) {
      const queue = this.executor.signalQueues[agentId];

      if (queue && queue.length > 0) {
        const signal = queue.shift();
        signalsThisCycle[agentId] = signal;
        this.log(`  ${agentId} <- ${signal.frequency} from ${signal.sourceAgentId}`);
      }
    }

    return signalsThisCycle;
  }

  /**
   * ACT phase: Process dequeued signals
   * @param {Object} signalsThisCycle - Map of agentId to signal
   */
  actPhase(signalsThisCycle) {
    this.log('ACT phase: processing signals');

    for (const [agentId, signal] of Object.entries(signalsThisCycle)) {
      try {
        this.executor.handleSignal(agentId, signal);
        this.signalsProcessed++;
      } catch (error) {
        console.error(`Error processing signal for ${agentId}:`, error.message);
        throw error;
      }
    }
  }

  /**
   * Check if scheduler should terminate
   * @returns {boolean}
   */
  shouldTerminate() {
    // Count total signals in all queues
    let totalSignals = 0;

    for (const queue of Object.values(this.executor.signalQueues)) {
      totalSignals += queue.length;
    }

    if (totalSignals === 0) {
      this.emptyCount++;
      this.log(`Empty count: ${this.emptyCount}/${this.emptyThreshold}`);

      if (this.emptyCount >= this.emptyThreshold) {
        return true;
      }
    } else {
      this.emptyCount = 0;
    }

    return false;
  }

  /**
   * Log message if verbose mode is enabled
   */
  log(message) {
    if (this.verbose) {
      console.log(message);
    }
  }

  /**
   * Get current scheduler state
   */
  getState() {
    return {
      cycleCount: this.cycleCount,
      signalsProcessed: this.signalsProcessed,
      running: this.running,
      emptyCount: this.emptyCount,
      queueStats: this.getQueueStats()
    };
  }

  /**
   * Get statistics about signal queues
   */
  getQueueStats() {
    const stats = {};

    for (const [agentId, queue] of Object.entries(this.executor.signalQueues)) {
      stats[agentId] = queue.length;
    }

    return stats;
  }
}

module.exports = { MycelialScheduler };
