/**
 * Mycelial Tidal Cycle Scheduler
 *
 * Implements the REST → SENSE → ACT execution model for the Mycelial runtime.
 * Coordinates signal flow between agents in the network using tidal cycles.
 *
 * Phase 2 Implementation - Tidal Cycle Execution Engine
 *
 * @author Claude Opus 4.5
 * @date 2026-01-01
 */

/**
 * TidalCycleScheduler - Orchestrates REST → SENSE → ACT cycles
 *
 * The scheduler runs a loop of tidal cycles, where each cycle consists of:
 * 1. REST phase - Brief pause (1ms default, expandable for future features)
 * 2. SENSE phase - Collect queued signals for all agents, group by frequency
 * 3. ACT phase - Process signals in dependency order, route emitted signals
 *
 * Cycles continue until no more signals are present (network quiescence).
 */
class TidalCycleScheduler {
  /**
   * Create a new tidal cycle scheduler
   * @param {SignalRouter} signalRouter - The signal router instance (or object with routing methods)
   * @param {Map<string, AgentInstance>} agents - Map of agent ID to AgentInstance
   * @param {Object} options - Configuration options
   */
  constructor(signalRouter, agents, options = {}) {
    this.signalRouter = signalRouter;
    this.signalQueue = options.signalQueue || signalRouter; // Allow separate queue
    this.agents = agents;

    // Configuration
    this.restDuration = options.restDuration || 1; // milliseconds
    this.cycleLimitMs = options.cycleLimitMs || 10000; // max time per cycle
    this.maxCyclesPerCompilation = options.maxCyclesPerCompilation || 1000;

    // Execution state
    this.currentCycle = 0;
    this.isRunning = false;
    this.executionOrder = [];

    // Statistics
    this.stats = {
      totalCycles: 0,
      totalSignalsProcessed: 0,
      totalRestTimeMs: 0,
      totalSenseTimeMs: 0,
      totalActTimeMs: 0,
      cycleTimesMs: [],
      signalsPerCycle: [],
      errors: []
    };
  }

  /**
   * Run the compilation - execute tidal cycles until completion
   * @returns {Object} Cycle execution statistics
   */
  async runCompilation() {
    this.isRunning = true;
    this.currentCycle = 0;

    const startTime = Date.now();

    console.log('\nStarting tidal cycle execution...');
    console.log(`  Max cycles: ${this.maxCyclesPerCompilation}`);
    console.log(`  Execution order: ${this.executionOrder.join(' -> ')}`);

    while (this.isRunning && this.currentCycle < this.maxCyclesPerCompilation) {
      const cycleResult = await this.executeCycle();

      // Check for completion (no signals processed)
      if (cycleResult.signalsProcessed === 0) {
        console.log(`\nCycle ${this.currentCycle}: Network quiescence detected (no signals)`);
        break;
      }

      // Check for cycle timeout
      if (cycleResult.totalTimeMs > this.cycleLimitMs) {
        console.warn(`\nCycle ${this.currentCycle}: Exceeded cycle time limit (${this.cycleLimitMs}ms)`);
        this.stats.errors.push(`Cycle ${this.currentCycle} timeout`);
      }

      this.currentCycle++;
    }

    this.isRunning = false;

    const totalTime = Date.now() - startTime;

    console.log('\nTidal cycle execution complete');
    console.log(`  Total cycles: ${this.stats.totalCycles}`);
    console.log(`  Total signals: ${this.stats.totalSignalsProcessed}`);
    console.log(`  Total time: ${totalTime}ms`);

    return this.getStats();
  }

  /**
   * Execute a single tidal cycle: REST → SENSE → ACT
   * @returns {Object} Cycle results
   */
  async executeCycle() {
    const cycleStartTime = Date.now();
    let signalsProcessed = 0;

    // Track phase times
    let restTime = 0;
    let senseTime = 0;
    let actTime = 0;

    try {
      // ===== REST PHASE =====
      const restStart = Date.now();
      await this.restPhase();
      restTime = Date.now() - restStart;
      this.stats.totalRestTimeMs += restTime;

      // ===== SENSE PHASE =====
      const senseStart = Date.now();
      const sensedSignals = await this.sensePhase();
      senseTime = Date.now() - senseStart;
      this.stats.totalSenseTimeMs += senseTime;

      // Count total signals
      for (const [agentId, agentSignals] of sensedSignals) {
        signalsProcessed += agentSignals.all.length;
      }

      // ===== ACT PHASE =====
      const actStart = Date.now();
      await this.actPhase(sensedSignals);
      actTime = Date.now() - actStart;
      this.stats.totalActTimeMs += actTime;

    } catch (error) {
      console.error(`Error in cycle ${this.currentCycle}:`, error.message);
      this.stats.errors.push(`Cycle ${this.currentCycle}: ${error.message}`);
    }

    // Update statistics
    const totalTimeMs = Date.now() - cycleStartTime;
    this.stats.totalCycles++;
    this.stats.totalSignalsProcessed += signalsProcessed;
    this.stats.cycleTimesMs.push(totalTimeMs);
    this.stats.signalsPerCycle.push(signalsProcessed);

    // Log cycle summary
    if (signalsProcessed > 0) {
      console.log(
        `Cycle ${this.currentCycle}: ` +
        `${signalsProcessed} signals, ` +
        `REST=${restTime}ms, SENSE=${senseTime}ms, ACT=${actTime}ms, ` +
        `Total=${totalTimeMs}ms`
      );
    }

    return {
      cycle: this.currentCycle,
      signalsProcessed,
      restTimeMs: restTime,
      senseTimeMs: senseTime,
      actTimeMs: actTime,
      totalTimeMs
    };
  }

  /**
   * REST phase - Brief pause
   * Future expansion point for:
   * - Garbage collection
   * - Checkpointing
   * - Network synchronization
   */
  async restPhase() {
    if (this.restDuration > 0) {
      await new Promise(resolve => setTimeout(resolve, this.restDuration));
    }
  }

  /**
   * SENSE phase - Collect queued signals for all agents
   * @returns {Map<string, Object>} Map of agentId to { all: signals[], grouped: Map<frequency, signals[]> }
   */
  async sensePhase() {
    const sensedSignals = new Map();

    for (const [agentId, agent] of this.agents) {
      // Get queued signals for this agent
      const queuedSignals = this.signalQueue.getQueuedSignals
        ? this.signalQueue.getQueuedSignals(agentId)
        : [];

      if (queuedSignals.length > 0) {
        // Group signals by frequency
        const grouped = this.groupSignalsByFrequency(queuedSignals);

        sensedSignals.set(agentId, {
          all: queuedSignals,
          grouped: grouped
        });
      }
    }

    return sensedSignals;
  }

  /**
   * ACT phase - Process signals in execution order
   * @param {Map<string, Object>} sensedSignals - Signals collected in SENSE phase
   */
  async actPhase(sensedSignals) {
    // Process agents in topological order
    for (const agentId of this.executionOrder) {
      const agentSignalData = sensedSignals.get(agentId);

      if (!agentSignalData) {
        continue; // No signals for this agent
      }

      const agent = this.agents.get(agentId);
      if (!agent) {
        console.warn(`Agent ${agentId} not found in agent registry`);
        continue;
      }

      const signals = agentSignalData.all;

      // Process each signal for this agent
      for (const signal of signals) {
        try {
          // Execute the agent's signal processing logic
          const emittedSignals = agent.processSignal(signal);

          // Route emitted signals to destination agents
          if (emittedSignals && emittedSignals.length > 0) {
            await this.routeEmittedSignals(agentId, emittedSignals);
          }

        } catch (error) {
          console.error(
            `Error processing signal in agent ${agentId}:`,
            error.message
          );
          this.stats.errors.push(
            `Agent ${agentId} error: ${error.message}`
          );
          // Continue processing other signals even if one fails
        }
      }

      // Clear this agent's queue after processing
      if (this.signalQueue.clearQueue) {
        this.signalQueue.clearQueue(agentId);
      }
    }
  }

  /**
   * Route emitted signals to destination agents
   * @param {string} sourceAgentId - Agent that emitted the signals
   * @param {Array<Object>} signals - Emitted signals
   */
  async routeEmittedSignals(sourceAgentId, signals) {
    for (const signal of signals) {
      if (!signal.frequency) {
        console.warn(`Signal from ${sourceAgentId} missing frequency`);
        continue;
      }

      // Get destination agents for this frequency
      const destinations = this.signalRouter.getRoutes
        ? this.signalRouter.getRoutes(sourceAgentId, signal.frequency)
        : this.signalRouter.getDestinations
        ? this.signalRouter.getDestinations(sourceAgentId, signal.frequency)
        : [];

      // Enqueue signal to each destination
      for (const destAgentId of destinations) {
        if (this.signalQueue.enqueue) {
          this.signalQueue.enqueue(destAgentId, signal);
        } else if (this.signalQueue.enqueueSignal) {
          this.signalQueue.enqueueSignal(destAgentId, signal);
        }
      }
    }
  }

  /**
   * Compute execution order based on signal dependencies
   * Uses topological sort to ensure agents process in correct order
   */
  computeExecutionOrder() {
    const agentIds = Array.from(this.agents.keys());
    const graph = new Map();
    const inDegree = new Map();

    // Initialize graph and in-degree map
    for (const agentId of agentIds) {
      graph.set(agentId, []);
      inDegree.set(agentId, 0);
    }

    // Build dependency graph from signal router
    const routes = this.signalRouter.getAllRoutes
      ? this.signalRouter.getAllRoutes()
      : this.buildRoutesFromTopology();

    for (const route of routes) {
      const { from, to } = route;

      // Add edge: from -> to (from must execute before to)
      if (graph.has(from)) {
        graph.get(from).push(to);
      }

      // Increment in-degree for destination
      if (inDegree.has(to)) {
        inDegree.set(to, inDegree.get(to) + 1);
      }
    }

    // Topological sort using Kahn's algorithm
    const queue = [];
    const result = [];

    // Start with agents that have no dependencies
    for (const [agentId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(agentId);
      }
    }

    while (queue.length > 0) {
      // Use lexicographic order for deterministic behavior
      queue.sort();

      const current = queue.shift();
      result.push(current);

      // Process neighbors
      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);

        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check for cycles
    if (result.length !== agentIds.length) {
      console.warn('Circular dependency detected in agent network');
      // Fall back to original order
      this.executionOrder = agentIds;
    } else {
      this.executionOrder = result;
    }

    return this.executionOrder;
  }

  /**
   * Build routes list from router's routing table (for actual SignalRouter)
   * @returns {Array<Object>} Array of {from, to, frequency} routes
   */
  buildRoutesFromTopology() {
    const routes = [];

    if (this.signalRouter.routingTable) {
      // Extract from actual SignalRouter's routingTable
      for (const [key, destinations] of this.signalRouter.routingTable) {
        const [from, frequency] = key.split(':');
        for (const to of destinations) {
          routes.push({ from, to, frequency });
        }
      }
    }

    return routes;
  }

  /**
   * Group signals by frequency
   * @param {Array<Object>} signals - Array of signals
   * @returns {Map<string, Array<Object>>} Map of frequency to signals
   */
  groupSignalsByFrequency(signals) {
    const grouped = new Map();

    for (const signal of signals) {
      const frequency = signal.frequency;

      if (!grouped.has(frequency)) {
        grouped.set(frequency, []);
      }

      grouped.get(frequency).push(signal);
    }

    return grouped;
  }

  /**
   * Get execution statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      averageCycleTimeMs:
        this.stats.cycleTimesMs.length > 0
          ? this.stats.cycleTimesMs.reduce((a, b) => a + b, 0) /
            this.stats.cycleTimesMs.length
          : 0,
      averageSignalsPerCycle:
        this.stats.signalsPerCycle.length > 0
          ? this.stats.signalsPerCycle.reduce((a, b) => a + b, 0) /
            this.stats.signalsPerCycle.length
          : 0
    };
  }

  /**
   * Stop execution early
   */
  stop() {
    this.isRunning = false;
  }
}

module.exports = { TidalCycleScheduler };
