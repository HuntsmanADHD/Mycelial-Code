/**
 * Symbol Table & Memory Layout Analyzer
 *
 * Analyzes Mycelial network AST and builds:
 * - Symbol table with all agents, frequencies, handlers
 * - Memory layout (offsets for agent states, queues)
 * - Routing table from socket definitions
 * - Type information
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-09
 */

class SymbolTable {
  constructor(networkAST) {
    this.network = networkAST;

    // Symbol tables
    this.frequencies = new Map();      // frequency_name -> { fields: [...] }
    this.hyphalTypes = new Map();      // hyphal_type -> { state: [...], handlers: [...] }
    this.agents = new Map();           // agent_id -> { type, stateOffset, stateSize }
    this.handlers = [];                // [{ agent, frequency, label, handler }]
    this.timedHandlers = [];           // [{ agent, cycleNumber, label, handler }]
    this.routingTable = new Map();     // agent_id.frequency -> [dest_agent_ids]
    this.fruitingBodies = new Set();   // Set of fruiting body names

    // Memory layout
    this.memoryLayout = {
      agentStatesBase: 0x2000,   // Start of agent state data
      signalQueuesBase: 0x3000,  // Start of signal queue metadata
      signalPoolBase: 0x4000,    // Start of signal pool storage
      heapBase: 0x10000,         // Start of dynamic heap

      totalAgentStateSize: 0,
      totalQueueSize: 0,
      totalPoolSize: 8192        // 8KB signal pool
    };

    // Type sizes (in bytes)
    this.typeSizes = {
      'u8': 1, 'i8': 1,
      'u16': 2, 'i16': 2,
      'u32': 4, 'i32': 4, 'f32': 4,
      'u64': 8, 'i64': 8, 'f64': 8,
      'boolean': 1, 'bool': 1,
      'string': 8,     // Pointer (8 bytes)
      'pointer': 8
    };
  }

  /**
   * Analyze the network AST and build symbol table
   */
  analyze() {
    this.log('Starting symbol table analysis');

    // Phase 1: Collect frequency definitions
    this.collectFrequencies();

    // Phase 2: Collect hyphal type definitions
    this.collectHyphalTypes();

    // Phase 3: Collect agent instances (spawns)
    this.collectAgents();

    // Phase 4: Collect fruiting bodies
    this.collectFruitingBodies();

    // Phase 5: Build routing table from sockets
    this.buildRoutingTable();

    // Phase 6: Calculate memory layout
    this.calculateMemoryLayout();

    // Phase 7: Build handler list
    this.buildHandlerList();

    this.log('Symbol table analysis complete');
    this.printSummary();

    return this;
  }

  /**
   * Collect frequency definitions
   */
  collectFrequencies() {
    this.log('Collecting frequencies');

    if (!this.network.frequencies) {
      return;
    }

    for (const [name, def] of Object.entries(this.network.frequencies)) {
      // Fields are in an array
      const fields = def.fields || [];

      this.frequencies.set(name, {
        name: name,
        fields: fields.map(f => ({
          name: f.name,
          type: f.type,
          offset: 0  // Will calculate later
        }))
      });

      this.log(`  - ${name}: ${fields.length} fields`);
    }
  }

  /**
   * Collect hyphal type definitions
   */
  collectHyphalTypes() {
    this.log('Collecting hyphal types');

    if (!this.network.hyphae) {
      return;
    }

    for (const [typeName, def] of Object.entries(this.network.hyphae)) {
      const stateFields = def.state || [];
      const handlers = def.handlers || [];

      this.hyphalTypes.set(typeName, {
        name: typeName,
        state: stateFields,
        handlers: handlers
      });

      this.log(`  - ${typeName}: ${stateFields.length} state fields, ${handlers.length} handlers`);
    }
  }

  /**
   * Collect agent instances from spawns
   */
  collectAgents() {
    this.log('Collecting agents');

    if (!this.network.spawns) {
      return;
    }

    for (const spawn of this.network.spawns) {
      const agentId = spawn.instanceId;
      const hyphalType = spawn.hyphalType;

      const typeDef = this.hyphalTypes.get(hyphalType);
      if (!typeDef) {
        throw new Error(`Unknown hyphal type: ${hyphalType}`);
      }

      this.agents.set(agentId, {
        id: agentId,
        type: hyphalType,
        typeDef: typeDef,
        stateOffset: 0,  // Will calculate later
        stateSize: 0     // Will calculate later
      });

      this.log(`  - ${agentId}: type=${hyphalType}`);
    }
  }

  /**
   * Collect fruiting bodies
   */
  collectFruitingBodies() {
    this.log('Collecting fruiting bodies');

    if (!this.network.fruitingBodies) {
      return;
    }

    for (const fbName of this.network.fruitingBodies) {
      this.fruitingBodies.add(fbName);
      this.log(`  - ${fbName}`);
    }
  }

  /**
   * Build routing table from socket definitions
   */
  buildRoutingTable() {
    this.log('Building routing table');

    if (!this.network.sockets) {
      return;
    }

    for (const socket of this.network.sockets) {
      // Sockets have from/to objects with agent and frequency properties
      const fromAgent = socket.from.agent;
      const toAgent = socket.to.agent;
      const frequency = socket.from.frequency || socket.to.frequency;

      const key = `${fromAgent}.${frequency}`;

      if (!this.routingTable.has(key)) {
        this.routingTable.set(key, []);
      }

      // Handle broadcast routing: socket X -> *
      if (toAgent === '*') {
        // Add all agents as destinations
        for (const agentId of this.agents.keys()) {
          this.routingTable.get(key).push(agentId);
        }
        this.log(`  - ${fromAgent} --[${frequency}]--> * (broadcast to ${this.agents.size} agents)`);
      } else {
        this.routingTable.get(key).push(toAgent);
        this.log(`  - ${fromAgent} --[${frequency}]--> ${toAgent}`);
      }
    }
  }

  /**
   * Calculate memory layout and offsets
   */
  calculateMemoryLayout() {
    this.log('Calculating memory layout');

    let currentOffset = this.memoryLayout.agentStatesBase;

    // Calculate size and offset for each agent's state
    for (const [agentId, agent] of this.agents.entries()) {
      let stateSize = 0;

      // Calculate size of state fields
      for (const field of agent.typeDef.state) {
        const fieldSize = this.getTypeSize(field.type);
        stateSize += fieldSize;
      }

      // 8-byte alignment
      stateSize = Math.ceil(stateSize / 8) * 8;

      agent.stateOffset = currentOffset;
      agent.stateSize = stateSize;

      currentOffset += stateSize;

      this.log(`  - ${agentId}: offset=0x${agent.stateOffset.toString(16)}, size=${stateSize} bytes`);
    }

    this.memoryLayout.totalAgentStateSize = currentOffset - this.memoryLayout.agentStatesBase;
    this.log(`Total agent state size: ${this.memoryLayout.totalAgentStateSize} bytes`);
  }

  /**
   * Build handler list with labels
   */
  buildHandlerList() {
    this.log('Building handler list');

    for (const [agentId, agent] of this.agents.entries()) {
      for (const handler of agent.typeDef.handlers) {
        if (handler.type === 'signal') {
          const label = `handler_${agentId}_${handler.frequency}`;

          this.handlers.push({
            agent: agentId,
            frequency: handler.frequency,
            label: label,
            handler: handler
          });

          this.log(`  - ${label}: on ${handler.frequency}`);
        } else if (handler.type === 'cycle') {
          // Extract cycle number from literal expression if needed
          let cycleNum = handler.cycleNumber;
          if (typeof cycleNum === 'object' && cycleNum.type === 'literal') {
            cycleNum = cycleNum.value;
          }

          const label = `handler_${agentId}_cycle${cycleNum}`;

          this.timedHandlers.push({
            agent: agentId,
            cycleNumber: handler.cycleNumber,
            label: label,
            handler: handler
          });

          this.log(`  - ${label}: on cycle ${cycleNum}`);
        }
      }
    }
  }

  /**
   * Get size of a type in bytes
   */
  getTypeSize(type) {
    // Handle simple types
    if (this.typeSizes[type]) {
      return this.typeSizes[type];
    }

    // Handle vec<T>
    if (type.startsWith('vec<')) {
      return 24;  // { ptr, len, cap } = 8 + 8 + 8
    }

    // Handle map<K,V>
    if (type.startsWith('map<')) {
      return 24;  // { ptr, len, cap } = 8 + 8 + 8
    }

    // Default: assume 8 bytes (pointer)
    return 8;
  }

  /**
   * Get routing destinations for agent + frequency
   */
  getRoutingDestinations(agentId, frequency) {
    const key = `${agentId}.${frequency}`;
    return this.routingTable.get(key) || [];
  }

  /**
   * Print summary
   */
  printSummary() {
    console.log('\n=== Symbol Table Summary ===');
    console.log(`Network: ${this.network.name}`);
    console.log(`Frequencies: ${this.frequencies.size}`);
    console.log(`Hyphal Types: ${this.hyphalTypes.size}`);
    console.log(`Agents: ${this.agents.size}`);
    console.log(`Signal Handlers: ${this.handlers.length}`);
    console.log(`Timed Handlers: ${this.timedHandlers.length}`);
    console.log(`Routing Rules: ${this.routingTable.size}`);
    console.log(`Fruiting Bodies: ${this.fruitingBodies.size}`);
    console.log(`Total Agent State: ${this.memoryLayout.totalAgentStateSize} bytes`);
    console.log('============================\n');
  }

  /**
   * Log message
   */
  log(message) {
    if (process.env.DEBUG) {
      console.log(`[SymbolTable] ${message}`);
    }
  }
}

module.exports = { SymbolTable };
