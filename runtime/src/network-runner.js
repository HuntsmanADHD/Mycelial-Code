/**
 * Mycelial Network Runner
 *
 * Entry point for executing a Mycelial network.
 * Coordinates agent spawning, signal routing, and execution scheduling.
 *
 * @author Claude Opus 4.5
 * @date 2026-01-01
 */

const { OrchestrationParser } = require('./orchestration-parser');
const { AgentInstance } = require('./agent-executor');
const { SignalRouter, SignalQueue } = require('./signal-router');

/**
 * NetworkRunner - Orchestrates network execution
 */
class NetworkRunner {
  /**
   * Create a new NetworkRunner
   * @param {Object} networkDefinition - Parsed network definition from OrchestrationParser
   */
  constructor(networkDefinition) {
    this.networkDefinition = networkDefinition;
    this.signalRouter = null;
    this.signalQueue = null;
    this.scheduler = null;
    this.agents = new Map(); // Map<instanceId, AgentInstance>
    this.executionOrder = [];
    this.initialized = false;
  }

  /**
   * Initialize the network: spawn agents, setup routing, compute execution order
   */
  initialize() {
    if (this.initialized) {
      throw new Error('Network already initialized');
    }

    // Create signal router and queue
    this.signalRouter = new SignalRouter(this.networkDefinition);
    this.signalQueue = new SignalQueue();

    // Spawn all agents from topology
    this.spawnAgents();

    // Compute execution order (topological sort based on dependencies)
    this.computeExecutionOrder();

    // Create scheduler (to be implemented in Phase 3)
    // this.scheduler = new TidalCycleScheduler(this.networkDefinition);

    this.initialized = true;
  }

  /**
   * Spawn agent instances from topology
   */
  spawnAgents() {
    const { spawns } = this.networkDefinition.topology;
    const { hyphae } = this.networkDefinition;

    for (const spawn of spawns) {
      const { hyphalType, instanceId } = spawn;

      // Get hyphal definition
      const hyphalDef = hyphae[hyphalType];
      if (!hyphalDef) {
        throw new Error(`Unknown hyphal type: ${hyphalType}`);
      }

      // Create agent instance
      const agent = new AgentInstance(hyphalType, instanceId, hyphalDef);

      // Initialize agent with type definitions
      agent.initialize(this.networkDefinition.types);

      // Register with router
      this.signalRouter.registerAgent(instanceId, hyphalType, agent);

      // Store in local map
      this.agents.set(instanceId, agent);
    }
  }

  /**
   * Compute execution order for agents (topological sort)
   * Ensures agents are executed in dependency order
   */
  computeExecutionOrder() {
    const { sockets, spawns } = this.networkDefinition.topology;

    // Build dependency graph: Map<agentId, Set<dependsOn>>
    const dependencies = new Map();
    const allAgents = new Set();

    // Initialize all agents with empty dependencies
    for (const spawn of spawns) {
      dependencies.set(spawn.instanceId, new Set());
      allAgents.add(spawn.instanceId);
    }

    // Build dependency edges from sockets
    for (const socket of sockets) {
      const { from, to } = socket;

      // 'to' depends on 'from' (must execute after 'from')
      if (dependencies.has(to)) {
        dependencies.get(to).add(from);
      }
    }

    // Topological sort using Kahn's algorithm
    const sorted = [];
    const noDependencies = [];

    // Find nodes with no dependencies
    for (const [agentId, deps] of dependencies.entries()) {
      if (deps.size === 0) {
        noDependencies.push(agentId);
      }
    }

    while (noDependencies.length > 0) {
      const agentId = noDependencies.shift();
      sorted.push(agentId);

      // Remove this agent from other agents' dependencies
      for (const [otherId, deps] of dependencies.entries()) {
        if (deps.has(agentId)) {
          deps.delete(agentId);
          if (deps.size === 0) {
            noDependencies.push(otherId);
          }
        }
      }
    }

    // Check for cycles
    if (sorted.length !== allAgents.size) {
      throw new Error('Circular dependency detected in network topology');
    }

    this.executionOrder = sorted;
  }

  /**
   * Run the network with an input signal
   * @param {Object} inputSignal - Initial signal to inject { frequency, payload, destination }
   * @returns {Promise<Object>} Execution results
   */
  async run(inputSignal) {
    if (!this.initialized) {
      throw new Error('Network not initialized. Call initialize() first.');
    }

    // Inject initial signal into queue
    if (inputSignal) {
      const { frequency, payload, destination } = inputSignal;

      this.signalQueue.enqueue(destination, {
        frequency,
        payload,
        source: 'external'
      });
    }

    // Process signals until queue is empty
    let iterations = 0;
    const maxIterations = 1000; // Prevent infinite loops

    while (this.signalQueue.getTotalQueuedCount() > 0 && iterations < maxIterations) {
      iterations++;

      // Process agents in execution order
      for (const agentId of this.executionOrder) {
        await this.processAgentSignals(agentId);
      }
    }

    if (iterations >= maxIterations) {
      throw new Error('Max iterations reached - possible infinite signal loop');
    }

    // Collect final state from all agents
    const finalState = {};
    for (const [agentId, agent] of this.agents.entries()) {
      finalState[agentId] = agent.getState();
    }

    return {
      iterations,
      finalState,
      queueStats: this.signalQueue.getStats()
    };
  }

  /**
   * Process queued signals for a specific agent
   * @param {string} agentId - Agent instance ID
   */
  async processAgentSignals(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const queuedSignals = this.signalQueue.getQueuedSignals(agentId);
    if (queuedSignals.length === 0) return;

    // Clear queue before processing (prevents reprocessing)
    this.signalQueue.clearQueue(agentId);

    // Process each signal
    for (const signal of queuedSignals) {
      // Validate signal
      if (!this.signalRouter.validateSignal(signal.frequency, signal.payload)) {
        console.error(`Invalid signal ${signal.frequency} for agent ${agentId}`);
        continue;
      }

      // Execute agent with signal
      const emittedSignals = agent.processSignal(signal);

      // Route emitted signals to destinations
      for (const emittedSignal of emittedSignals) {
        this.routeSignal(agentId, emittedSignal);
      }
    }
  }

  /**
   * Route a signal from source to destinations
   * @param {string} sourceId - Source agent instance ID
   * @param {Object} signal - Signal object with frequency and payload
   */
  routeSignal(sourceId, signal) {
    const { frequency, payload } = signal;

    // Get destination agents for this signal
    const destinations = this.signalRouter.getRoutes(sourceId, frequency);

    // Enqueue signal for each destination
    for (const destId of destinations) {
      this.signalQueue.enqueue(destId, {
        frequency,
        payload,
        source: sourceId
      });
    }
  }

  /**
   * Get network status and statistics
   * @returns {Object} Network status information
   */
  getStatus() {
    return {
      networkName: this.networkDefinition.networkName,
      initialized: this.initialized,
      agentCount: this.agents.size,
      executionOrder: this.executionOrder,
      routingTable: this.signalRouter ? this.signalRouter.getRoutingTable() : {},
      queueStats: this.signalQueue ? this.signalQueue.getStats() : {},
      agentStates: this.getAgentStates()
    };
  }

  /**
   * Get current state of all agents
   * @returns {Object} Map of agent states
   */
  getAgentStates() {
    const states = {};
    for (const [agentId, agent] of this.agents.entries()) {
      states[agentId] = agent.getState();
    }
    return states;
  }
}

module.exports = { NetworkRunner };
