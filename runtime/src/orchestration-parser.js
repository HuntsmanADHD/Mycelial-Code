/**
 * Mycelial Orchestration Parser
 *
 * Parses Mycelial network definition files (.mycelial) and extracts:
 * - Frequency definitions (signal type names and fields)
 * - Type definitions (enums, structs)
 * - Hyphal definitions (agent types with state and rules)
 * - Topology (spawns, sockets, fruiting bodies)
 *
 * Uses simplified regex/string parsing (not full AST parsing).
 *
 * @author Claude Opus 4.5
 * @date 2026-01-01
 */

class OrchestrationParser {
  constructor() {
    this.source = '';
    this.position = 0;
    this.line = 1;
    this.column = 1;
  }

  /**
   * Parse a Mycelial network definition file
   * @param {string} source - The source code to parse
   * @returns {NetworkDefinition} The parsed network definition
   * @throws {Error} If parsing fails
   */
  parse(source) {
    this.source = source;
    this.position = 0;
    this.line = 1;
    this.column = 1;

    const result = {
      networkName: '',
      frequencies: {},      // Map: frequency_name -> { fields: { name: type } }
      types: {
        enums: {},          // Map: enum_name -> { values: [] }
        structs: {}         // Map: struct_name -> { fields: { name: type } }
      },
      hyphae: {},           // Map: hyphal_name -> { state: {}, rules: [] }
      topology: {
        fruitingBodies: [], // List of external interfaces
        spawns: [],         // List of { hyphalType, instanceId }
        sockets: []         // List of { from, to, frequency }
      }
    };

    try {
      // Extract network name
      result.networkName = this.extractNetworkName();

      // Extract sections
      result.frequencies = this.extractFrequencies();
      result.types = this.extractTypes();
      result.hyphae = this.extractHyphae();
      result.topology = this.extractTopology();

      return result;
    } catch (error) {
      throw new Error(`Parse error at line ${this.line}, column ${this.column}: ${error.message}`);
    }
  }

  /**
   * Extract network name from the source
   * @returns {string} The network name
   */
  extractNetworkName() {
    const match = this.source.match(/network\s+(\w+)\s*\{/);
    if (!match) {
      throw new Error('Network declaration not found');
    }
    return match[1];
  }

  /**
   * Extract a balanced block starting from a position
   * @param {number} startPos - Position of opening brace
   * @param {string} source - Optional source string (defaults to this.source)
   * @returns {string} Content inside the balanced braces
   */
  extractBalancedBlock(startPos, source = null) {
    const text = source || this.source;
    let braceCount = 0;
    let start = -1;
    let end = -1;

    for (let i = startPos; i < text.length; i++) {
      const char = text[i];

      if (char === '{') {
        if (braceCount === 0) {
          start = i + 1;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          end = i;
          break;
        }
      }
    }

    if (start === -1 || end === -1) {
      return '';
    }

    return text.substring(start, end);
  }

  /**
   * Extract frequencies section
   * @returns {Object} Map of frequency definitions
   */
  extractFrequencies() {
    const frequencies = {};

    // Find the frequencies block using balanced brace matching
    const freqBlockStart = this.source.indexOf('frequencies {');
    if (freqBlockStart === -1) {
      return frequencies;
    }

    const frequenciesBlock = this.extractBalancedBlock(freqBlockStart + 'frequencies '.length);

    // Match individual frequency definitions
    const lines = frequenciesBlock.split('\n');
    let currentFreq = null;
    let currentFields = {};
    let braceDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Check for frequency start
      const freqMatch = trimmed.match(/^(\w+)\s*\{/);
      if (freqMatch && braceDepth === 0) {
        // Save previous frequency if exists
        if (currentFreq && Object.keys(currentFields).length > 0) {
          frequencies[currentFreq] = { fields: currentFields };
        }

        currentFreq = freqMatch[1];
        currentFields = {};
        braceDepth = 1;
        continue;
      }

      // Track brace depth
      braceDepth += (trimmed.match(/\{/g) || []).length;
      braceDepth -= (trimmed.match(/\}/g) || []).length;

      // Extract field definitions
      if (currentFreq && braceDepth > 0) {
        const fieldMatch = trimmed.match(/^(\w+)\s*:\s*([\w<>,\s]+)/);
        if (fieldMatch) {
          currentFields[fieldMatch[1]] = fieldMatch[2].trim();
        }
      }

      // Frequency end
      if (braceDepth === 0 && currentFreq) {
        if (Object.keys(currentFields).length > 0) {
          frequencies[currentFreq] = { fields: currentFields };
        }
        currentFreq = null;
        currentFields = {};
      }
    }

    return frequencies;
  }

  /**
   * Extract types section (enums and structs)
   * @returns {Object} Type definitions
   */
  extractTypes() {
    const types = {
      enums: {},
      structs: {}
    };

    const typesBlockStart = this.source.indexOf('types {');
    if (typesBlockStart === -1) {
      return types;
    }

    const typesBlock = this.extractBalancedBlock(typesBlockStart + 'types '.length);

    // Extract enum definitions
    const enumRegex = /enum\s+(\w+)\s*\{([^}]*)\}/g;
    let enumMatch;

    while ((enumMatch = enumRegex.exec(typesBlock)) !== null) {
      const enumName = enumMatch[1];
      const valuesBlock = enumMatch[2];

      // Extract enum values (comma-separated)
      const values = valuesBlock
        .split(/[,\n]/)
        .map(v => v.trim())
        .filter(v => v && !v.startsWith('#'));

      types.enums[enumName] = { values };
    }

    // Extract struct definitions
    const structRegex = /struct\s+(\w+)\s*\{([^}]*)\}/g;
    let structMatch;

    while ((structMatch = structRegex.exec(typesBlock)) !== null) {
      const structName = structMatch[1];
      const fieldsBlock = structMatch[2];

      const fields = {};

      // Extract field definitions: name: type
      const fieldRegex = /(\w+)\s*:\s*([\w<>,\s]+)/g;
      let fieldMatch;

      while ((fieldMatch = fieldRegex.exec(fieldsBlock)) !== null) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2].trim();
        fields[fieldName] = fieldType;
      }

      types.structs[structName] = { fields };
    }

    return types;
  }

  /**
   * Extract hyphae section (agent definitions)
   * @returns {Object} Map of hyphal definitions
   */
  extractHyphae() {
    const hyphae = {};

    // Find all hyphae blocks (there can be multiple)
    let searchPos = 0;
    while (true) {
      const hyphaeStart = this.source.indexOf('hyphae {', searchPos);
      if (hyphaeStart === -1) break;

      const hyphaeBlock = this.extractBalancedBlock(hyphaeStart + 'hyphae '.length);
      searchPos = hyphaeStart + hyphaeBlock.length + 10;

      // Extract individual hyphal definitions within this hyphae block
      let hyphalSearchPos = 0;
      while (true) {
        const hyphalStart = hyphaeBlock.indexOf('hyphal ', hyphalSearchPos);
        if (hyphalStart === -1) break;

        // Extract hyphal name
        const nameMatch = hyphaeBlock.substring(hyphalStart).match(/hyphal\s+(\w+)\s*\{/);
        if (!nameMatch) break;

        const hyphalName = nameMatch[1];
        const hyphalBodyStart = hyphalStart + nameMatch[0].length - 1;

        // Extract balanced hyphal body
        let braceCount = 0;
        let bodyStart = -1;
        let bodyEnd = -1;

        for (let i = hyphalBodyStart; i < hyphaeBlock.length; i++) {
          if (hyphaeBlock[i] === '{') {
            if (braceCount === 0) bodyStart = i + 1;
            braceCount++;
          } else if (hyphaeBlock[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              bodyEnd = i;
              break;
            }
          }
        }

        if (bodyStart === -1 || bodyEnd === -1) break;

        const hyphalBody = hyphaeBlock.substring(bodyStart, bodyEnd);
        hyphalSearchPos = bodyEnd + 1;

        const hyphalDef = {
          state: {},
          rules: []
        };

        // Extract state block
        const stateStart = hyphalBody.indexOf('state {');
        if (stateStart !== -1) {
          const stateBlock = this.extractBalancedBlock(stateStart + 'state '.length, hyphalBody);

          // Extract state field definitions
          const fieldRegex = /(\w+)\s*:\s*([\w<>,\s]+)/g;
          let fieldMatch;

          while ((fieldMatch = fieldRegex.exec(stateBlock)) !== null) {
            const fieldName = fieldMatch[1];
            const fieldType = fieldMatch[2].trim();
            hyphalDef.state[fieldName] = fieldType;
          }
        }

        // Extract rules
        hyphalDef.rules = this.extractRules(hyphalBody);

        hyphae[hyphalName] = hyphalDef;
      }
    }

    return hyphae;
  }

  /**
   * Extract rules from a hyphal body
   * @param {string} hyphalBody - The body of the hyphal definition
   * @returns {Array} List of rule definitions
   */
  extractRules(hyphalBody) {
    const rules = [];

    // Extract "on rest" rules
    const onRestRegex = /on\s+rest\s*\{([\s\S]*?)\n\s*\}/g;
    let onRestMatch;

    while ((onRestMatch = onRestRegex.exec(hyphalBody)) !== null) {
      rules.push({
        type: 'on_rest',
        trigger: null,
        condition: null,
        body: onRestMatch[1].trim()
      });
    }

    // Extract "on cycle" rules
    const onCycleRegex = /on\s+cycle\s*\{([\s\S]*?)\n\s*\}/g;
    let onCycleMatch;

    while ((onCycleMatch = onCycleRegex.exec(hyphalBody)) !== null) {
      rules.push({
        type: 'on_cycle',
        trigger: null,
        condition: null,
        body: onCycleMatch[1].trim()
      });
    }

    // Extract "on signal" rules
    const onSignalRegex = /on\s+signal\s*\(\s*(\w+)\s*(?:,\s*(\w+))?\s*\)\s*(?:where\s+([^{]+))?\s*\{([\s\S]*?)\n\s*\}/g;
    let onSignalMatch;

    while ((onSignalMatch = onSignalRegex.exec(hyphalBody)) !== null) {
      const frequency = onSignalMatch[1];
      const paramName = onSignalMatch[2] || 'signal';
      const condition = onSignalMatch[3] ? onSignalMatch[3].trim() : null;
      const body = onSignalMatch[4].trim();

      rules.push({
        type: 'on_signal',
        trigger: frequency,
        paramName: paramName,
        condition: condition,
        body: body
      });
    }

    // Extract standalone rule definitions
    const ruleDefRegex = /rule\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([\w<>,\s]+))?\s*\{([\s\S]*?)\n\s*\}/g;
    let ruleDefMatch;

    while ((ruleDefMatch = ruleDefRegex.exec(hyphalBody)) !== null) {
      const ruleName = ruleDefMatch[1];
      const params = ruleDefMatch[2].trim();
      const returnType = ruleDefMatch[3] ? ruleDefMatch[3].trim() : 'void';
      const body = ruleDefMatch[4].trim();

      rules.push({
        type: 'rule',
        name: ruleName,
        params: this.parseParameters(params),
        returnType: returnType,
        body: body
      });
    }

    return rules;
  }

  /**
   * Parse function parameters
   * @param {string} paramsStr - Parameter string like "x: u32, y: string"
   * @returns {Array} List of {name, type} objects
   */
  parseParameters(paramsStr) {
    if (!paramsStr || paramsStr.trim() === '') {
      return [];
    }

    const params = [];
    const paramParts = paramsStr.split(',');

    for (const part of paramParts) {
      const match = part.trim().match(/(\w+)\s*:\s*([\w<>,\s]+)/);
      if (match) {
        params.push({
          name: match[1],
          type: match[2].trim()
        });
      }
    }

    return params;
  }

  /**
   * Extract topology section
   * @returns {Object} Topology definition
   */
  extractTopology() {
    const topology = {
      fruitingBodies: [],
      spawns: [],
      sockets: []
    };

    const topologyMatch = this.source.match(/topology\s*\{([\s\S]*?)\n\s*\}/);

    if (!topologyMatch) {
      return topology;
    }

    const topologyBlock = topologyMatch[1];

    // Extract fruiting body declarations
    const fruitingBodyRegex = /fruiting_body\s+(\w+)/g;
    let fruitingBodyMatch;

    while ((fruitingBodyMatch = fruitingBodyRegex.exec(topologyBlock)) !== null) {
      topology.fruitingBodies.push(fruitingBodyMatch[1]);
    }

    // Extract spawn declarations
    const spawnRegex = /spawn\s+(\w+)\s+as\s+(\w+)/g;
    let spawnMatch;

    while ((spawnMatch = spawnRegex.exec(topologyBlock)) !== null) {
      topology.spawns.push({
        hyphalType: spawnMatch[1],
        instanceId: spawnMatch[2]
      });
    }

    // Extract socket declarations
    const socketRegex = /socket\s+(\w+)\s*->\s*(\w+)\s*(?:\(\s*frequency:\s*(\w+)\s*\))?/g;
    let socketMatch;

    while ((socketMatch = socketRegex.exec(topologyBlock)) !== null) {
      topology.sockets.push({
        from: socketMatch[1],
        to: socketMatch[2],
        frequency: socketMatch[3] || null
      });
    }

    return topology;
  }

  /**
   * Get default value for a type
   * @param {string} type - The type name
   * @returns {*} Default value for the type
   */
  static getDefaultValue(type) {
    // Handle primitive types
    if (type.startsWith('u') || type.startsWith('i')) {
      return 0;
    }

    if (type.startsWith('f')) {
      return 0.0;
    }

    if (type === 'boolean') {
      return false;
    }

    if (type === 'string') {
      return '';
    }

    if (type === 'binary') {
      return new Uint8Array(0);
    }

    // Handle collection types
    if (type.startsWith('vec<')) {
      return [];
    }

    if (type.startsWith('queue<')) {
      return [];
    }

    if (type.startsWith('map<')) {
      return new Map();
    }

    // Default to null for unknown types (structs, enums)
    return null;
  }
}

/**
 * NetworkDefinition type
 * @typedef {Object} NetworkDefinition
 * @property {string} networkName - Name of the network
 * @property {Object} frequencies - Map of frequency definitions
 * @property {Object} types - Type definitions (enums and structs)
 * @property {Object} hyphae - Map of hyphal definitions
 * @property {Object} topology - Topology configuration
 */

module.exports = { OrchestrationParser };
