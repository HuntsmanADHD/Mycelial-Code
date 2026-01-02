/**
 * Mycelial Signal Router
 *
 * Routes signals between agents based on network topology.
 * Manages signal queuing and validates signal types against frequency definitions.
 *
 * @author Claude Opus 4.5
 * @date 2026-01-01
 */

/**
 * SignalRouter - Routes signals between agents based on topology
 */
class SignalRouter {
  /**
   * Create a new SignalRouter from network definition
   * @param {Object} networkDefinition - Parsed network definition from OrchestrationParser
   */
  constructor(networkDefinition) {
    this.networkDefinition = networkDefinition;
    this.routingTable = new Map(); // Map<sourceId+frequency, Set<destinationIds>>
    this.agentRegistry = new Map(); // Map<instanceId, { type: string, instance: AgentInstance }>
    this.frequencyDefinitions = networkDefinition.frequencies || {};

    // Build routing table from topology
    this.buildRoutingTable();
  }

  /**
   * Build routing table from network topology sockets
   */
  buildRoutingTable() {
    const { sockets } = this.networkDefinition.topology;

    for (const socket of sockets) {
      const { from, to, frequency } = socket;

      // If frequency is specified, create route for that frequency only
      // If no frequency specified, the route is open to all frequencies (wildcard)
      if (frequency) {
        this.addRoute(from, frequency, [to]);
      } else {
        // Wildcard route: add route for all known frequencies
        const frequencies = Object.keys(this.frequencyDefinitions);
        for (const freq of frequencies) {
          this.addRoute(from, freq, [to]);
        }

        // Also track wildcard route separately for dynamic signal types
        this.addRoute(from, '*', [to]);
      }
    }
  }

  /**
   * Add a route from source to destinations for a specific frequency
   * @param {string} sourceId - Source agent instance ID
   * @param {string} frequency - Signal frequency (type)
   * @param {Array<string>} destinationIds - List of destination agent IDs
   */
  addRoute(sourceId, frequency, destinationIds) {
    const routeKey = `${sourceId}:${frequency}`;

    if (!this.routingTable.has(routeKey)) {
      this.routingTable.set(routeKey, new Set());
    }

    const destinations = this.routingTable.get(routeKey);

    for (const destId of destinationIds) {
      destinations.add(destId);
    }
  }

  /**
   * Get destination IDs for a source and frequency
   * @param {string} sourceId - Source agent instance ID
   * @param {string} frequency - Signal frequency (type)
   * @returns {Array<string>} List of destination agent IDs
   */
  getRoutes(sourceId, frequency) {
    const routeKey = `${sourceId}:${frequency}`;
    const destinations = new Set();

    // Check for exact frequency match
    if (this.routingTable.has(routeKey)) {
      const exactMatches = this.routingTable.get(routeKey);
      for (const dest of exactMatches) {
        destinations.add(dest);
      }
    }

    // Check for wildcard routes
    const wildcardKey = `${sourceId}:*`;
    if (this.routingTable.has(wildcardKey)) {
      const wildcardMatches = this.routingTable.get(wildcardKey);
      for (const dest of wildcardMatches) {
        destinations.add(dest);
      }
    }

    return Array.from(destinations);
  }

  /**
   * Register an agent instance
   * @param {string} instanceId - Agent instance ID
   * @param {string} agentType - Hyphal type name
   * @param {Object} agentInstance - AgentInstance object
   */
  registerAgent(instanceId, agentType, agentInstance) {
    if (this.agentRegistry.has(instanceId)) {
      throw new Error(`Agent ${instanceId} is already registered`);
    }

    this.agentRegistry.set(instanceId, {
      type: agentType,
      instance: agentInstance
    });
  }

  /**
   * Get registered agent instance
   * @param {string} instanceId - Agent instance ID
   * @returns {Object|null} Agent instance or null if not found
   */
  getAgent(instanceId) {
    const entry = this.agentRegistry.get(instanceId);
    return entry ? entry.instance : null;
  }

  /**
   * Validate signal against frequency definition
   * @param {string} frequency - Signal frequency (type)
   * @param {Object} payload - Signal payload
   * @returns {boolean} True if valid, false otherwise
   */
  validateSignal(frequency, payload) {
    const freqDef = this.frequencyDefinitions[frequency];

    if (!freqDef) {
      // Unknown frequency - allow it (for dynamic types)
      return true;
    }

    // Check that all required fields are present
    const requiredFields = Object.keys(freqDef.fields || {});

    for (const fieldName of requiredFields) {
      if (!(fieldName in payload)) {
        return false;
      }
    }

    // Type checking could be added here if needed
    return true;
  }

  /**
   * Get routing table for debugging
   * @returns {Object} Routing table as plain object
   */
  getRoutingTable() {
    const table = {};

    for (const [key, destinations] of this.routingTable.entries()) {
      table[key] = Array.from(destinations);
    }

    return table;
  }

  /**
   * Get agent connections (which agents are registered)
   * @returns {Object} Agent registry information
   */
  getAgentConnections() {
    const connections = {};

    for (const [instanceId, entry] of this.agentRegistry.entries()) {
      connections[instanceId] = {
        type: entry.type,
        registered: true
      };
    }

    return connections;
  }
}

/**
 * SignalQueue - Manages queued signals for agents
 */
class SignalQueue {
  constructor() {
    this.queues = new Map(); // Map<agentId, Array<signal>>
    this.stats = {
      totalEnqueued: 0,
      totalDequeued: 0,
      currentQueueSize: 0
    };
  }

  /**
   * Enqueue a signal for a destination agent
   * @param {string} destinationAgentId - Target agent instance ID
   * @param {Object} signal - Signal object with frequency and payload
   */
  enqueue(destinationAgentId, signal) {
    if (!this.queues.has(destinationAgentId)) {
      this.queues.set(destinationAgentId, []);
    }

    this.queues.get(destinationAgentId).push(signal);
    this.stats.totalEnqueued++;
    this.stats.currentQueueSize++;
  }

  /**
   * Enqueue multiple signals at once
   * @param {Array} signals - Array of {destinationAgentId, signal} objects
   */
  enqueueBatch(signals) {
    for (const { destinationAgentId, signal } of signals) {
      this.enqueue(destinationAgentId, signal);
    }
  }

  /**
   * Get all queued signals for an agent
   * @param {string} agentId - Agent instance ID
   * @returns {Array} List of queued signals (does not remove them)
   */
  getQueuedSignals(agentId) {
    return this.queues.get(agentId) || [];
  }

  /**
   * Clear queue for an agent (after processing)
   * @param {string} agentId - Agent instance ID
   * @returns {Array} The signals that were cleared
   */
  clearQueue(agentId) {
    const signals = this.queues.get(agentId) || [];
    const count = signals.length;

    this.queues.delete(agentId);
    this.stats.totalDequeued += count;
    this.stats.currentQueueSize -= count;

    return signals;
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  getStats() {
    return {
      totalEnqueued: this.stats.totalEnqueued,
      totalDequeued: this.stats.totalDequeued,
      currentQueueSize: this.stats.currentQueueSize,
      agentsWithQueuedSignals: this.queues.size
    };
  }

  /**
   * Check if an agent has queued signals
   * @param {string} agentId - Agent instance ID
   * @returns {boolean} True if agent has queued signals
   */
  hasQueuedSignals(agentId) {
    const queue = this.queues.get(agentId);
    return queue && queue.length > 0;
  }

  /**
   * Get total number of queued signals across all agents
   * @returns {number} Total queued signal count
   */
  getTotalQueuedCount() {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }
}

module.exports = { SignalRouter, SignalQueue };
