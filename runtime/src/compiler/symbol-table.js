/**
 * Mycelial Symbol Table Builder
 *
 * Analyzes network AST and builds symbol tables for code generation
 *
 * @author Claude Sonnet 4.5
 * @date 2026-01-15
 */

class SymbolTable {
  constructor(networkAST) {
    this.network = networkAST;

    // Symbol tables
    this.frequencies = new Map();      // frequency name -> { id, fields, size }
    this.types = new Map();             // type name -> { fields, size }
    this.hyphalTypes = new Map();       // hyphal type -> { handlers, stateFields, stateSize }
    this.agents = new Map();            // agent id -> { hyphalType, stateOffset, stateSize }
    this.routingTable = [];             // [{source, target, frequency}]
    this.fruitingBodies = new Map();    // frequency -> {input: bool, output: bool}

    // Memory layout
    this.totalStateSize = 0;
    this.agentStateOffsets = new Map(); // agent id -> offset in .data section

    // Statistics
    this.stats = {
      frequencyCount: 0,
      hyphalTypeCount: 0,
      agentCount: 0,
      handlerCount: 0,
      timedHandlerCount: 0,
      socketCount: 0,
      fruitingBodyCount: 0
    };
  }

  /**
   * Build complete symbol table from network AST
   */
  build() {
    console.error('[SYMBOL-TABLE] Building symbol table...');

    // Phase 1: Analyze type definitions
    this.analyzeTypes();

    // Phase 2: Analyze frequencies
    this.analyzeFrequencies();

    // Phase 3: Analyze hyphal types and their state
    this.analyzeHyphae();

    // Phase 4: Analyze agent instances (spawns)
    this.analyzeAgents();

    // Phase 5: Build routing table from sockets
    this.buildRoutingTable();

    // Phase 6: Analyze fruiting bodies
    this.analyzeFruitingBodies();

    // Phase 7: Calculate memory layout
    this.calculateMemoryLayout();

    this.logSummary();

    return this;
  }

  /**
   * Analyze type definitions (structs and enums)
   */
  analyzeTypes() {
    if (!this.network.types) return;

    for (const [typeName, typeDef] of Object.entries(this.network.types)) {
      if (typeDef.type === 'enum') {
        // Enum type: store variant info including data types
        const variantMap = new Map();
        let maxDataSize = 0;

        if (typeDef.variants && Array.isArray(typeDef.variants)) {
          typeDef.variants.forEach((variant, index) => {
            // Handle both old format (string) and new format (object with name and dataType)
            const variantName = typeof variant === 'string' ? variant : variant.name;
            const dataType = typeof variant === 'object' ? variant.dataType : null;

            let dataSize = 0;
            if (dataType) {
              // Calculate size of the data type
              dataSize = this.getTypeSize(dataType);
              maxDataSize = Math.max(maxDataSize, dataSize);
            }

            variantMap.set(variantName, {
              ordinal: index,
              dataType: dataType,
              dataSize: dataSize
            });
          });
        }

        // Tagged union size: 8 bytes for tag + max data size across all variants
        const totalSize = 8 + maxDataSize;

        this.types.set(typeName, {
          kind: 'enum',
          variants: variantMap,
          size: totalSize,
          tagSize: 8,
          maxDataSize: maxDataSize
        });

        const dataInfo = maxDataSize > 0 ? ` (with data: ${maxDataSize} bytes)` : '';
        console.error(`[SYMBOL-TABLE] Type ${typeName}: ${variantMap.size} enum variants, ${totalSize} bytes${dataInfo}`);
      } else {
        // Struct type: calculate field offsets
        const fields = [];
        let offset = 0;

        if (typeDef.fields && Array.isArray(typeDef.fields)) {
          for (const field of typeDef.fields) {
            const size = this.getTypeSize(field.type);
            fields.push({
              name: field.name,
              type: field.type,
              offset: offset,
              size: size
            });
            offset += size;
          }
        }

        this.types.set(typeName, {
          kind: 'struct',
          fields: fields,
          size: offset
        });

        console.error(`[SYMBOL-TABLE] Type ${typeName}: ${fields.length} fields, ${offset} bytes`);
      }
    }
  }

  /**
   * Analyze frequency definitions
   */
  analyzeFrequencies() {
    if (!this.network.frequencies) return;

    let freqId = 0;
    for (const [freqName, freqDef] of Object.entries(this.network.frequencies)) {
      const fields = [];
      let offset = 0;

      if (freqDef.fields && Array.isArray(freqDef.fields)) {
        for (const field of freqDef.fields) {
          const size = this.getTypeSize(field.type);
          fields.push({
            name: field.name,
            type: field.type,
            offset: offset,
            size: size
          });
          offset += size;
        }
      }

      this.frequencies.set(freqName, {
        id: freqId++,
        fields: fields,
        size: offset
      });

      this.stats.frequencyCount++;
      console.error(`[SYMBOL-TABLE] Frequency ${freqName}: ${fields.length} fields, ${offset} bytes`);
    }
  }

  /**
   * Analyze hyphal types (agent templates)
   */
  analyzeHyphae() {
    if (!this.network.hyphae) return;

    for (const [hyphalName, hyphalDef] of Object.entries(this.network.hyphae)) {
      // Analyze state fields
      const stateFields = [];
      let stateSize = 0;

      if (hyphalDef.state && Array.isArray(hyphalDef.state)) {
        for (const field of hyphalDef.state) {
          // IMPORTANT: Gen0 stores ALL state fields as 8-byte values:
          // - Primitives: 8 bytes (padded)
          // - Pointers (string, vec, map): 8 bytes
          // - Struct types: 8 bytes (heap pointer)
          // This matches the code generator which uses 64-bit mov for all state access.
          const size = 8;  // Always 8 bytes for state fields
          stateFields.push({
            name: field.name,
            type: field.type,
            offset: stateSize,
            size: size
          });
          stateSize += size;
        }
      }

      // Analyze handlers
      const handlers = {
        rest: null,
        signal: new Map(),  // frequency -> handler AST
        timer: new Map()    // interval -> handler AST
      };

      if (hyphalDef.handlers && Array.isArray(hyphalDef.handlers)) {
        for (const handler of hyphalDef.handlers) {
          if (handler.type === 'rest') {
            handlers.rest = handler.body;
            this.stats.handlerCount++;
          } else if (handler.type === 'signal') {
            handlers.signal.set(handler.frequency, {
              paramName: handler.binding,
              body: handler.body
            });
            this.stats.handlerCount++;
          } else if (handler.type === 'timer') {
            handlers.timer.set(handler.interval, {
              body: handler.body
            });
            this.stats.timedHandlerCount++;
          }
        }
      }

      // Analyze rule definitions (helper functions)
      const rules = new Map(); // rule name -> { params, returnType, body }
      if (hyphalDef.rules && Array.isArray(hyphalDef.rules)) {
        for (const rule of hyphalDef.rules) {
          rules.set(rule.name, {
            params: rule.params || [],
            returnType: rule.returnType,
            body: rule.body
          });
        }
      }

      this.hyphalTypes.set(hyphalName, {
        stateFields: stateFields,
        stateSize: stateSize,
        handlers: handlers,
        rules: rules
      });

      this.stats.hyphalTypeCount++;
      console.error(`[SYMBOL-TABLE] Hyphal ${hyphalName}: ${stateFields.length} state fields, ${stateSize} bytes, ${handlers.signal.size} signal handlers`);
    }
  }

  /**
   * Analyze agent instances (spawns)
   */
  analyzeAgents() {
    if (!this.network.spawns) return;

    for (const spawn of this.network.spawns) {
      const hyphalType = this.hyphalTypes.get(spawn.hyphalType);

      if (!hyphalType) {
        throw new Error(`Unknown hyphal type: ${spawn.hyphalType}`);
      }

      const agentId = spawn.instanceId || spawn.id;

      this.agents.set(agentId, {
        hyphalType: spawn.hyphalType,
        stateFields: hyphalType.stateFields,
        stateSize: hyphalType.stateSize,
        handlers: hyphalType.handlers,
        rules: hyphalType.rules
      });

      this.stats.agentCount++;
      console.error(`[SYMBOL-TABLE] Agent ${agentId}: type=${spawn.hyphalType}, state=${hyphalType.stateSize} bytes`);
    }
  }

  /**
   * Build static routing table from socket definitions
   */
  buildRoutingTable() {
    if (!this.network.sockets) return;

    for (const socket of this.network.sockets) {
      const route = {
        source: socket.from.agent,
        target: socket.to.agent,
        frequency: socket.to.frequency
      };

      this.routingTable.push(route);
      this.stats.socketCount++;

      console.error(`[SYMBOL-TABLE] Route: ${socket.from.agent} -> ${socket.to.agent} (${socket.to.frequency})`);
    }
  }

  /**
   * Analyze fruiting bodies (external I/O points)
   */
  analyzeFruitingBodies() {
    if (!this.network.fruitingBodies) return;

    for (const fbName of this.network.fruitingBodies) {
      // Determine if this is input, output, or both based on socket connections
      let isInput = false;
      let isOutput = false;

      for (const socket of this.network.sockets) {
        // Socket structure: {from: {agent, frequency}, to: {agent, frequency}}
        if (socket.from && socket.from.agent === fbName) {
          isInput = true;
        }
        if (socket.to && socket.to.agent === fbName) {
          isOutput = true;
        }
      }

      this.fruitingBodies.set(fbName, {
        input: isInput,
        output: isOutput
      });

      this.stats.fruitingBodyCount++;
      console.error(`[SYMBOL-TABLE] Fruiting body ${fbName}: input=${isInput}, output=${isOutput}`);
    }
  }

  /**
   * Calculate memory layout for all agents
   */
  calculateMemoryLayout() {
    let offset = 0;

    for (const [agentId, agent] of this.agents.entries()) {
      // Align to 8-byte boundary
      if (offset % 8 !== 0) {
        offset += 8 - (offset % 8);
      }

      this.agentStateOffsets.set(agentId, offset);
      offset += agent.stateSize;

      console.error(`[SYMBOL-TABLE] Agent ${agentId} state at offset ${this.agentStateOffsets.get(agentId)}, size ${agent.stateSize}`);
    }

    this.totalStateSize = offset;
    console.error(`[SYMBOL-TABLE] Total agent state: ${this.totalStateSize} bytes`);
  }

  /**
   * Get size in bytes for a type
   */
  getTypeSize(type) {
    // Handle basic types
    if (type === 'u8' || type === 'i8' || type === 'bool' || type === 'boolean') return 1;
    if (type === 'u16' || type === 'i16') return 2;
    if (type === 'u32' || type === 'i32' || type === 'f32') return 4;
    if (type === 'u64' || type === 'i64' || type === 'f64') return 8;
    if (type === 'string' || type === 'vec' || type === 'map') return 8; // Pointer

    // Handle custom struct types - Gen0 stores ALL structs as pointers
    const customType = this.types.get(type);
    if (customType && customType.kind === 'struct') {
      return 8;  // Pointer size, not full struct size
    }
    if (customType && customType.kind === 'enum') {
      return 8;  // Enums are also stored as pointers to tagged unions
    }

    // Default to pointer size
    console.warn(`[SYMBOL-TABLE] Unknown type size for ${type}, defaulting to 8 bytes`);
    return 8;
  }

  /**
   * Get handler for an agent and frequency
   */
  getHandler(agentId, frequency) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    return agent.handlers.signal.get(frequency);
  }

  /**
   * Get REST handler for an agent
   */
  getRestHandler(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    return agent.handlers.rest;
  }

  /**
   * Get all routes that target a specific agent
   */
  getIncomingRoutes(agentId) {
    return this.routingTable.filter(route => route.target === agentId);
  }

  /**
   * Get all routes from a specific agent
   */
  getOutgoingRoutes(agentId) {
    return this.routingTable.filter(route => route.source === agentId);
  }

  /**
   * Get state field offset for an agent
   */
  getStateFieldOffset(agentId, fieldName) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    const field = agent.stateFields.find(f => f.name === fieldName);
    return field ? field.offset : null;
  }

  /**
   * Get state field type for an agent
   */
  getStateFieldType(agentId, fieldName) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    const field = agent.stateFields.find(f => f.name === fieldName);
    return field ? field.type : null;
  }

  /**
   * Get agent state base offset in .data section
   */
  getAgentStateOffset(agentId) {
    return this.agentStateOffsets.get(agentId) || 0;
  }

  /**
   * Get frequency definition by name
   */
  getFrequency(freqName) {
    return this.frequencies.get(freqName);
  }

  /**
   * Get field offset within a frequency payload
   */
  getFrequencyFieldOffset(freqName, fieldName) {
    const freq = this.frequencies.get(freqName);
    if (!freq) return null;

    const field = freq.fields.find(f => f.name === fieldName);
    return field ? field.offset : null;
  }

  /**
   * Get field type within a frequency payload
   */
  getFrequencyFieldType(freqName, fieldName) {
    const freq = this.frequencies.get(freqName);
    if (!freq) return null;

    const field = freq.fields.find(f => f.name === fieldName);
    return field ? field.type : null;
  }

  /**
   * Check if a function name is a rule for the given agent
   */
  isRule(agentId, functionName) {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.rules) return false;
    return agent.rules.has(functionName);
  }

  /**
   * Get rule definition for an agent
   */
  getRule(agentId, ruleName) {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.rules) return null;
    return agent.rules.get(ruleName);
  }

  /**
   * Log symbol table summary
   */
  logSummary() {
    console.error('\n=== Symbol Table Summary ===');
    console.error(`Network: ${this.network.name}`);
    console.error(`Frequencies: ${this.stats.frequencyCount}`);
    console.error(`Hyphal Types: ${this.stats.hyphalTypeCount}`);
    console.error(`Agents: ${this.stats.agentCount}`);
    console.error(`Signal Handlers: ${this.stats.handlerCount}`);
    console.error(`Timed Handlers: ${this.stats.timedHandlerCount}`);
    console.error(`Routing Rules: ${this.stats.socketCount}`);
    console.error(`Fruiting Bodies: ${this.stats.fruitingBodyCount}`);
    console.error(`Total Agent State: ${this.totalStateSize} bytes`);
    console.error('============================\n');
  }

  /**
   * Export symbol table as JSON for debugging
   */
  toJSON() {
    return {
      network: this.network.name,
      stats: this.stats,
      frequencies: Array.from(this.frequencies.entries()).map(([name, data]) => ({name, ...data})),
      types: Array.from(this.types.entries()).map(([name, data]) => ({name, ...data})),
      hyphalTypes: Array.from(this.hyphalTypes.entries()).map(([name, data]) => ({name, ...data})),
      agents: Array.from(this.agents.entries()).map(([id, data]) => ({id, ...data})),
      routingTable: this.routingTable,
      fruitingBodies: Array.from(this.fruitingBodies.entries()).map(([name, data]) => ({name, ...data})),
      memoryLayout: {
        totalStateSize: this.totalStateSize,
        agentOffsets: Array.from(this.agentStateOffsets.entries()).map(([id, offset]) => ({id, offset}))
      }
    };
  }
}

module.exports = { SymbolTable };
