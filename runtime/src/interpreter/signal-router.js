/**
 * Signal Router
 *
 * Routes signals between agents based on socket definitions.
 * Socket format: socket from -> to (frequency: name)
 *
 * Routing table: Maps "agent:frequency" -> list of destination agents
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-07
 */

class SignalRouter {
  constructor(sockets) {
    // Routing table: "sourceAgent:frequency" -> [destAgents]
    this.routes = {};

    // Build routing table from socket definitions
    for (const socket of sockets) {
      this.addRoute(socket);
    }
  }

  /**
   * Add a route from socket definition
   * @param {Object} socket - Socket definition { from, to, frequency }
   */
  addRoute(socket) {
    const fromAgent = socket.from.agent;
    const toAgent = socket.to.agent;
    const frequency = socket.from.frequency || socket.to.frequency;

    if (!frequency) {
      // If no frequency specified, this is a wildcard route
      // For now, we'll skip it or require explicit frequency
      return;
    }

    const key = `${fromAgent}:${frequency}`;

    if (!this.routes[key]) {
      this.routes[key] = [];
    }

    this.routes[key].push({
      agentId: toAgent,
      frequency: frequency
    });
  }

  /**
   * Get destination agents for a signal
   * @param {string} sourceAgentId - Source agent ID
   * @param {string} frequency - Signal frequency
   * @returns {Array<string>} List of destination agent IDs
   */
  getDestinations(sourceAgentId, frequency) {
    const key = `${sourceAgentId}:${frequency}`;
    const routes = this.routes[key] || [];
    return routes.map(r => r.agentId);
  }

  /**
   * Get all routes for debugging
   * @returns {Object} Routing table
   */
  getRoutes() {
    return this.routes;
  }

  /**
   * Check if a route exists
   * @param {string} sourceAgentId - Source agent ID
   * @param {string} frequency - Signal frequency
   * @returns {boolean}
   */
  hasRoute(sourceAgentId, frequency) {
    const key = `${sourceAgentId}:${frequency}`;
    return this.routes[key] && this.routes[key].length > 0;
  }

  /**
   * Get route count
   * @returns {number}
   */
  getRouteCount() {
    return Object.keys(this.routes).length;
  }

  /**
   * Pretty print routing table
   */
  printRoutes() {
    console.log('=== Signal Routing Table ===');
    for (const [key, destinations] of Object.entries(this.routes)) {
      const destList = destinations.map(d => d.agentId).join(', ');
      console.log(`  ${key} -> ${destList}`);
    }
  }
}

module.exports = { SignalRouter };
